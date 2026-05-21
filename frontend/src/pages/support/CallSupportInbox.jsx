import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from '@/components/ui/resizable';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneCall, Send, Sparkles, Timer, AlarmClock, Clock,
  ChevronRight, ArrowUpCircle, Wrench, MessageSquare, Mail, Plus,
  Search, Loader2, FileText, Shield, Package, History, Inbox,
  CheckCircle2, AlertTriangle, RotateCw, Command, X, Bot, ListChecks,
} from 'lucide-react';
import ClickToCallButton from '@/components/calls/ClickToCallButton';
import { CountUp, Shimmer } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

// =========================================================================
// Helpers
// =========================================================================
const slaInfo = (ticket) => {
  const due = ticket?.sla_due;
  if (!due) return null;
  const STOPPED = ['closed', 'closed_by_agent', 'resolved_on_call', 'resolved', 'delivered'];
  if (STOPPED.includes(ticket.status)) return null;
  const mins = (new Date(due).getTime() - Date.now()) / 60000;
  if (mins < 0) {
    const hrs = Math.floor(-mins / 60);
    return { tone: 'red', label: hrs >= 1 ? `breached ${hrs}h` : 'breached', mins, dot: 'bg-rose-500' };
  }
  if (mins < 30) return { tone: 'red', label: `${Math.round(mins)}m`, mins, dot: 'bg-rose-500' };
  if (mins < 120) return { tone: 'amber', label: `${Math.round(mins)}m`, mins, dot: 'bg-amber-500' };
  if (mins < 1440) return { tone: 'emerald', label: `${Math.round(mins / 60)}h`, mins, dot: 'bg-emerald-500' };
  return { tone: 'slate', label: `${Math.round(mins / 60)}h`, mins, dot: 'bg-slate-400' };
};

const warrantyExpiryInfo = (w) => {
  if (!w?.warranty_end_date) return null;
  const end = new Date(w.warranty_end_date);
  if (isNaN(end.getTime())) return null;
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0) return { tone: 'slate', label: `expired ${-days}d ago` };
  if (days <= 7) return { tone: 'rose', label: `expires in ${days}d` };
  if (days <= 30) return { tone: 'amber', label: `expires in ${days}d` };
  return null;
};

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = (now - d.getTime()) / 60000;
  if (diff < 60) return `${Math.max(1, Math.round(diff))}m`;
  if (diff < 1440) return `${Math.round(diff / 60)}h`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const FILTERS = [
  { id: 'open',       label: 'Open',         icon: Inbox },
  { id: 'working',    label: 'Working',      icon: Wrench },
  { id: 'breached',   label: 'SLA Risk',     icon: AlarmClock, tone: 'rose' },
  { id: 'all',        label: 'All',          icon: ListChecks },
];

// =========================================================================
// Queue Pane (left)
// =========================================================================
function QueuePane({ tickets, selectedId, onSelect, filter, setFilter, query, setQuery, loading, onCreateNew, onRefresh }) {
  const filtered = useMemo(() => {
    let list = tickets || [];
    if (filter === 'open') {
      list = list.filter(t => ['open', 'new_request', 'call_support_followup'].includes(t.status));
    } else if (filter === 'working') {
      list = list.filter(t => ['in_progress', 'diagnosed', 'call_support_followup'].includes(t.status));
    } else if (filter === 'breached') {
      list = list.filter(t => {
        const i = slaInfo(t);
        return i && i.mins < 120;
      });
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(t =>
        (t.ticket_number || '').toLowerCase().includes(q) ||
        (t.customer_name || '').toLowerCase().includes(q) ||
        (t.customer_phone || '').toLowerCase().includes(q) ||
        (t.device_type || '').toLowerCase().includes(q) ||
        (t.issue_description || '').toLowerCase().includes(q)
      );
    }
    // Sort: SLA urgency first, then created_at desc
    return [...list].sort((a, b) => {
      const ai = slaInfo(a)?.mins ?? Number.POSITIVE_INFINITY;
      const bi = slaInfo(b)?.mins ?? Number.POSITIVE_INFINITY;
      if (ai !== bi) return ai - bi;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [tickets, filter, query]);

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Search + actions */}
      <div className="p-3 border-b border-border/60 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search · ⌘K"
              className="h-8 pl-8 text-xs"
              data-testid="queue-search"
            />
          </div>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onRefresh} title="Refresh (⌘R)">
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="default" className="h-8 px-2" onClick={onCreateNew} title="New ticket (N)">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1 -mx-0.5 flex-wrap">
          {FILTERS.map(f => {
            const Icon = f.icon;
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-secondary/60'
                )}
              >
                <Icon className="w-3 h-3" />
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Shimmer key={i} className="h-14" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground p-6">
            <div className="text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/60" />
              <p>Queue is clear</p>
            </div>
          </div>
        ) : (
          <ul className="py-1">
            {filtered.map((t, idx) => {
              const sla = slaInfo(t);
              const isActive = t.id === selectedId;
              return (
                <motion.li
                  key={t.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(idx, 12) * 0.025, ease: [0.16, 1, 0.3, 1] }}
                >
                  <motion.button
                    whileTap={{ scale: 0.985 }}
                    onClick={() => onSelect(t.id)}
                    className={cn(
                      'relative w-full text-left px-3 py-2.5 border-b border-border/40 transition-colors',
                      isActive ? 'bg-primary/[0.06]' : 'hover:bg-secondary/40',
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="queue-active-bar"
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <div className="flex items-start gap-2">
                      {/* SLA dot */}
                      <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0', sla?.dot || 'bg-slate-300')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-[12px]">
                          <span className="font-mono text-foreground truncate">{t.ticket_number}</span>
                          {sla && (
                            <span className={cn(
                              'text-[10px] font-medium tabular-nums',
                              sla.tone === 'red' && 'text-rose-600',
                              sla.tone === 'amber' && 'text-amber-600',
                              sla.tone === 'emerald' && 'text-emerald-600',
                              sla.tone === 'slate' && 'text-muted-foreground',
                            )}>{sla.label}</span>
                          )}
                          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{fmtTime(t.created_at)}</span>
                        </div>
                        <p className="text-[12.5px] text-foreground truncate font-medium mt-0.5">
                          {t.customer_name || t.customer_phone || '—'}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {t.device_type ? `${t.device_type} · ` : ''}{t.issue_description || ''}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer: count */}
      <div className="border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>{filtered.length} {filtered.length === 1 ? 'ticket' : 'tickets'}</span>
        <span className="text-[10px] tabular-nums">J/K nav · ⏎ open</span>
      </div>
    </div>
  );
}

// =========================================================================
// Detail Pane (middle)
// =========================================================================
function DetailPane({ ticket, onUpdate, onOpenMessage, onReload }) {
  const { token, user } = useAuth();
  const [diagnosis, setDiagnosis] = useState('');
  const [agentNotes, setAgentNotes] = useState('');
  const [statusValue, setStatusValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDiagnosis(ticket?.diagnosis || '');
    setAgentNotes(ticket?.agent_notes || '');
    setStatusValue('');
  }, [ticket?.id]);

  if (!ticket) {
    return (
      <div className="h-full flex items-center justify-center bg-secondary/30">
        <div className="text-center max-w-xs">
          <div className="mx-auto w-14 h-14 rounded-full bg-card shadow-soft flex items-center justify-center mb-3">
            <Inbox className="w-6 h-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground/80">No ticket selected</p>
          <p className="text-xs text-muted-foreground mt-1">Pick a ticket from the queue, or press <kbd className="px-1 py-0.5 bg-card rounded text-[10px] border border-border">N</kbd> for new.</p>
        </div>
      </div>
    );
  }

  const sla = slaInfo(ticket);
  const slaTone = {
    red: 'bg-rose-50 text-rose-700 border-rose-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const save = async () => {
    setSaving(true);
    try {
      const updates = {};
      if (statusValue) updates.status = statusValue;
      if (diagnosis !== (ticket.diagnosis || '')) updates.diagnosis = diagnosis;
      if (agentNotes !== (ticket.agent_notes || '')) updates.agent_notes = agentNotes;
      if (Object.keys(updates).length === 0) {
        toast.info('No changes');
        return;
      }
      await axios.patch(`${API}/tickets/${ticket.id}`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Saved');
      onUpdate?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const escalate = async () => {
    if (!agentNotes || agentNotes.length < 100) {
      toast.error('Add 100+ chars of notes before escalating');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData(); fd.append('notes', agentNotes);
      await axios.post(`${API}/tickets/${ticket.id}/escalate-to-supervisor`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Escalated to supervisor');
      onUpdate?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Escalation failed');
    } finally {
      setSaving(false);
    }
  };

  const routeHW = async () => {
    if (!agentNotes || agentNotes.length < 100) {
      toast.error('Add 100+ chars of notes before routing');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData(); fd.append('notes', agentNotes);
      await axios.post(`${API}/tickets/${ticket.id}/route-to-hardware`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Routed to hardware');
      onUpdate?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Route failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-3 border-b border-border/60 flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[13px] text-foreground tracking-tight">{ticket.ticket_number}</span>
          <StatusBadge status={ticket.status} />
          {sla && (
            <span className={cn('inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full border', slaTone[sla.tone])}>
              <Timer className="w-3 h-3" />
              {sla.label}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="h-7" onClick={onOpenMessage} title="Send WhatsApp (R)">
            <MessageSquare className="w-3.5 h-3.5 mr-1" />Reply
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={onReload} title="Reload">
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-5">
          {/* Customer hero */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-violet-500 text-primary-foreground flex items-center justify-center text-sm font-medium">
              {(ticket.customer_name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[15px] text-foreground">{ticket.customer_name || '—'}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{ticket.customer_phone}</span>
                {ticket.customer_phone && (
                  <ClickToCallButton phone={ticket.customer_phone} customerName={ticket.customer_name} showLabel={false} size="sm" />
                )}
                {ticket.customer_email && <span className="truncate">· {ticket.customer_email}</span>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {ticket.device_type ? `${ticket.device_type} · ` : ''}
                created {new Date(ticket.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Issue */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Issue</p>
            <p className="text-sm text-foreground leading-relaxed bg-secondary/40 rounded-lg p-3">
              {ticket.issue_description || <span className="italic text-muted-foreground">No description</span>}
            </p>
          </div>

          {/* Status + diagnosis + notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Update status</Label>
              <Select value={statusValue} onValueChange={setStatusValue}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="No change" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="diagnosed">Diagnosed</SelectItem>
                  <SelectItem value="software_issue">Software Issue (Resolved)</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="resolved_on_call">Resolved on Call</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:row-span-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Agent notes</Label>
              <Textarea
                value={agentNotes}
                onChange={(e) => setAgentNotes(e.target.value)}
                rows={6}
                placeholder="Internal notes…"
                className="mt-1 resize-none text-sm"
              />
              <p className={cn('text-[10px] mt-1', agentNotes.length >= 100 ? 'text-emerald-600' : 'text-muted-foreground')}>
                {agentNotes.length}/100 chars (escalation/route needs ≥100)
              </p>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Diagnosis</Label>
              <Textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                rows={2}
                placeholder="Quick diagnosis…"
                className="mt-1 resize-none text-sm"
              />
            </div>
          </div>

          {/* History */}
          {ticket.history?.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Activity</p>
              <ol className="border-l-2 border-border/60 ml-1 pl-4 space-y-2 max-h-44 overflow-y-auto">
                {ticket.history.slice().reverse().map((h, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[18px] top-1.5 w-2 h-2 rounded-full bg-primary/40 ring-2 ring-card" />
                    <p className="text-[12.5px] text-foreground">{h.action}</p>
                    <p className="text-[10.5px] text-muted-foreground">{h.by} · {new Date(h.timestamp).toLocaleString()}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="px-5 py-3 border-t border-border/60 flex items-center justify-between gap-2 bg-card/95 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>⌘S save</span><span>·</span><span>E escalate</span><span>·</span><span>H hardware</span><span>·</span><span>R reply</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" disabled={saving || agentNotes.length < 100} onClick={routeHW} className="h-8">
            <Wrench className="w-3.5 h-3.5 mr-1" />Hardware
          </Button>
          <Button size="sm" variant="outline" disabled={saving || agentNotes.length < 100} onClick={escalate} className="h-8">
            <ArrowUpCircle className="w-3.5 h-3.5 mr-1" />Escalate
          </Button>
          <Button size="sm" disabled={saving} onClick={save} className="h-8">
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// Customer 360 + AI + KB pane (right)
// =========================================================================
function ContextPane({ ticket, customerHistory, kbSuggestions, aiSuggestion, aiLoading, onRunAI, onUseNotes, onUseMessage, historyLoading }) {
  if (!ticket) {
    return (
      <div className="h-full flex items-center justify-center bg-secondary/30">
        <p className="text-xs text-muted-foreground">Customer context appears here</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card overflow-y-auto">
      <div className="p-4 space-y-4">

        {/* AI suggestion — top, glassmorphic */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50 via-violet-50 to-white border border-indigo-200/60 p-3.5 shadow-soft">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br from-primary/20 to-violet-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Suggested next step</span>
              </div>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-primary hover:bg-primary/10" onClick={() => onRunAI(!!aiSuggestion)} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : (aiSuggestion ? 'Re-run' : 'Run')}
              </Button>
            </div>
            {aiSuggestion ? (
              <div className="space-y-2 text-[12px]">
                <div className="inline-flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-primary text-primary-foreground rounded-md font-mono text-[10px]">{aiSuggestion.action}</span>
                  <span className="text-[10px] text-muted-foreground">{aiSuggestion.confidence} confidence</span>
                </div>
                <p className="text-foreground/90 leading-relaxed">{aiSuggestion.rationale}</p>
                <div className="flex gap-1.5 pt-1">
                  {aiSuggestion.draft_notes && (
                    <button onClick={() => onUseNotes(aiSuggestion.draft_notes)} className="text-[11px] px-2 py-1 rounded-md bg-white/80 hover:bg-white border border-border text-foreground">
                      Use notes
                    </button>
                  )}
                  {aiSuggestion.draft_message && (
                    <button onClick={() => onUseMessage(aiSuggestion.draft_message)} className="text-[11px] px-2 py-1 rounded-md bg-emerald-100 hover:bg-emerald-200 border border-emerald-200 text-emerald-800">
                      Send as WA
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[11.5px] text-muted-foreground">Run AI for a next-step recommendation.</p>
            )}
          </div>
        </div>

        {/* Customer summary */}
        {customerHistory && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Customer</p>
            <div className="rounded-lg border border-border/60 p-3 text-[12px]">
              <p className="font-medium text-foreground">{customerHistory.customer_name}</p>
              <p className="text-muted-foreground">{customerHistory.customer_phone}</p>
              {customerHistory.customer_email && (
                <p className="text-muted-foreground truncate">{customerHistory.customer_email}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-[11px]">
                <span><span className="font-medium text-foreground">{customerHistory.total_tickets || 0}</span> tickets</span>
                <span><span className="font-medium text-foreground">{customerHistory.warranties?.length || 0}</span> warranties</span>
                <span><span className="font-medium text-foreground">{customerHistory.dispatches?.length || 0}</span> dispatches</span>
              </div>
            </div>
          </div>
        )}

        {/* Prior tickets */}
        {customerHistory?.related_tickets?.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <History className="w-3 h-3" /> Prior tickets ({customerHistory.related_tickets.length})
            </p>
            <div className="space-y-1">
              {customerHistory.related_tickets.slice(0, 4).map(rt => (
                <div key={rt.id} className="rounded-md border border-border/60 px-2.5 py-1.5 text-[11.5px]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{rt.ticket_number}</span>
                    <StatusBadge status={rt.status} />
                  </div>
                  <p className="text-muted-foreground truncate">{rt.issue_description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warranties */}
        {customerHistory?.warranties?.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Warranties
            </p>
            <div className="space-y-1">
              {customerHistory.warranties.map(w => {
                const exp = warrantyExpiryInfo(w);
                const tone = exp?.tone === 'rose' ? 'border-rose-200 bg-rose-50/60' : exp?.tone === 'amber' ? 'border-amber-200 bg-amber-50/60' : 'border-border/60';
                return (
                  <div key={w.id} className={cn('rounded-md border px-2.5 py-1.5 text-[11.5px]', tone)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono">{w.warranty_number}</span>
                      {exp ? (
                        <span className={cn('text-[10px]',
                          exp.tone === 'rose' && 'text-rose-700',
                          exp.tone === 'amber' && 'text-amber-700',
                          exp.tone === 'slate' && 'text-muted-foreground',
                        )}>{exp.label}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">{w.warranty_end_date && new Date(w.warranty_end_date).toLocaleDateString()}</span>
                      )}
                    </div>
                    <p className="text-muted-foreground">{w.device_type}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent dispatches */}
        {customerHistory?.dispatches?.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <Package className="w-3 h-3" /> Recent dispatches
            </p>
            <div className="space-y-1">
              {customerHistory.dispatches.slice(0, 3).map(d => (
                <div key={d.id} className="rounded-md border border-border/60 px-2.5 py-1.5 text-[11.5px]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{d.dispatch_number}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="text-muted-foreground truncate">{d.product_name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KB */}
        {kbSuggestions?.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Knowledge base
            </p>
            <div className="space-y-1">
              {kbSuggestions.map(art => (
                <details key={art.id} className="rounded-md border border-border/60 text-[11.5px] group">
                  <summary className="px-2.5 py-1.5 cursor-pointer flex items-center justify-between hover:bg-secondary/40">
                    <span className="font-medium text-foreground truncate">{art.title}</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground group-open:rotate-90 transition-transform" />
                  </summary>
                  {art.problem_summary && <p className="px-2.5 pb-2 text-muted-foreground">{art.problem_summary}</p>}
                  {art.resolution_steps && (
                    <pre className="px-2.5 pb-2 text-[11px] text-foreground/90 whitespace-pre-wrap font-sans">{art.resolution_steps}</pre>
                  )}
                </details>
              ))}
            </div>
          </div>
        )}

        {historyLoading && !customerHistory && (
          <div className="space-y-2">
            <Shimmer className="h-16" />
            <Shimmer className="h-12" />
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// Top KPI strip
// =========================================================================
function KpiStrip({ tickets, missedCount, onJumpToBreached, onOpenMissed }) {
  const sla = useMemo(() => {
    let breached = 0, soon = 0;
    for (const t of tickets) {
      const i = slaInfo(t);
      if (!i) continue;
      if (i.mins < 0) breached++;
      else if (i.mins < 120) soon++;
    }
    return { breached, soon };
  }, [tickets]);

  const openCount = tickets.filter(t => ['open', 'new_request', 'call_support_followup'].includes(t.status)).length;
  const inProgress = tickets.filter(t => ['in_progress', 'diagnosed'].includes(t.status)).length;

  return (
    <div className="px-4 py-3 border-b border-border/60 bg-card flex items-center gap-6 flex-wrap">
      <button onClick={onJumpToBreached} className="group flex items-center gap-2">
        <span className="relative flex w-2 h-2">
          <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75', sla.breached > 0 && 'bg-rose-400 animate-ping')} />
          <span className={cn('relative inline-flex rounded-full h-2 w-2', sla.breached > 0 ? 'bg-rose-500' : 'bg-emerald-400')} />
        </span>
        <span className="text-[11px] text-muted-foreground group-hover:text-foreground">SLA</span>
        <span className={cn('text-sm font-semibold tabular-nums', sla.breached > 0 ? 'text-rose-600' : 'text-foreground')}>
          <CountUp value={sla.breached} /> breached
        </span>
        <span className="text-[11px] text-muted-foreground">· <CountUp value={sla.soon} /> in 2h</span>
      </button>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-2">
        <Inbox className="w-3.5 h-3.5 text-muted-foreground" />
        <CountUp value={openCount} className="text-sm font-semibold tabular-nums" />
        <span className="text-[11px] text-muted-foreground">open</span>
      </div>
      <div className="flex items-center gap-2">
        <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
        <CountUp value={inProgress} className="text-sm font-semibold tabular-nums" />
        <span className="text-[11px] text-muted-foreground">working</span>
      </div>
      {missedCount > 0 && (
        <>
          <div className="h-5 w-px bg-border" />
          <button onClick={onOpenMissed} className="flex items-center gap-2 hover:opacity-80">
            <PhoneCall className="w-3.5 h-3.5 text-rose-500" />
            <CountUp value={missedCount} className="text-sm font-semibold tabular-nums text-rose-600" />
            <span className="text-[11px] text-muted-foreground">missed calls</span>
          </button>
        </>
      )}
    </div>
  );
}

// =========================================================================
// Page
// =========================================================================
export default function CallSupportInbox() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [missedCount, setMissedCount] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [query, setQuery] = useState('');

  const [customerHistory, setCustomerHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [kbSuggestions, setKbSuggestions] = useState([]);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [messageOpen, setMessageOpen] = useState(false);
  const [messageChannel, setMessageChannel] = useState('whatsapp');
  const [messageDraft, setMessageDraft] = useState('');
  const [cannedResponses, setCannedResponses] = useState([]);
  const [sending, setSending] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ device_type: '', order_id: '', issue_description: '', customer_id: '' });
  const [creating, setCreating] = useState(false);

  const queueListRef = useRef(null);

  // ----- Fetchers
  const fetchTickets = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/tickets`, { headers: { Authorization: `Bearer ${token}` } });
      setTickets(r.data || []);
    } catch (e) {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchMissedCount = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/missed-calls/queue`, { headers: { Authorization: `Bearer ${token}` }, params: { hours: 24 } });
      setMissedCount(r.data?.missed_calls?.length || 0);
    } catch {
      setMissedCount(0);
    }
  }, [token]);

  useEffect(() => { fetchTickets(); fetchMissedCount(); }, [fetchTickets, fetchMissedCount]);

  // Poll for ticket updates every 30s
  useEffect(() => {
    const id = setInterval(() => { fetchTickets(); fetchMissedCount(); }, 30000);
    return () => clearInterval(id);
  }, [fetchTickets, fetchMissedCount]);

  // ----- Selection effects
  const loadSelected = useCallback(async (id) => {
    if (!id) { setSelectedTicket(null); setCustomerHistory(null); setKbSuggestions([]); setAiSuggestion(null); return; }
    try {
      const r = await axios.get(`${API}/tickets/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedTicket(r.data);
      setAiSuggestion(r.data?.ai_suggestion?.suggestion || null);
    } catch {
      toast.error('Failed to load ticket');
    }
    setHistoryLoading(true);
    try {
      const h = await axios.get(`${API}/tickets/${id}/customer-history`, { headers: { Authorization: `Bearer ${token}` } });
      setCustomerHistory(h.data);
    } catch {
      setCustomerHistory(null);
    } finally {
      setHistoryLoading(false);
    }
    try {
      const k = await axios.get(`${API}/tickets/${id}/kb-suggestions`, { headers: { Authorization: `Bearer ${token}` }, params: { limit: 3 } });
      setKbSuggestions(k.data?.suggestions || []);
    } catch {
      setKbSuggestions([]);
    }
  }, [token]);

  useEffect(() => { loadSelected(selectedId); }, [selectedId, loadSelected]);

  // Auto-select first when nothing is selected and tickets arrive
  useEffect(() => {
    if (!selectedId && tickets.length > 0 && !loading) {
      const filtered = tickets.filter(t => ['open', 'new_request', 'call_support_followup'].includes(t.status));
      if (filtered.length > 0) {
        // Sort by SLA urgency
        const sorted = [...filtered].sort((a, b) => (slaInfo(a)?.mins ?? Infinity) - (slaInfo(b)?.mins ?? Infinity));
        setSelectedId(sorted[0].id);
      }
    }
  }, [tickets, selectedId, loading]);

  // ----- Filtered list (mirrors QueuePane)
  const filteredList = useMemo(() => {
    let list = tickets || [];
    if (filter === 'open') list = list.filter(t => ['open', 'new_request', 'call_support_followup'].includes(t.status));
    else if (filter === 'working') list = list.filter(t => ['in_progress', 'diagnosed', 'call_support_followup'].includes(t.status));
    else if (filter === 'breached') list = list.filter(t => { const i = slaInfo(t); return i && i.mins < 120; });
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(t =>
        (t.ticket_number || '').toLowerCase().includes(q) ||
        (t.customer_name || '').toLowerCase().includes(q) ||
        (t.customer_phone || '').toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const ai = slaInfo(a)?.mins ?? Infinity;
      const bi = slaInfo(b)?.mins ?? Infinity;
      if (ai !== bi) return ai - bi;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [tickets, filter, query]);

  // ----- AI suggest
  const runAi = async (force = false) => {
    if (!selectedTicket) return;
    setAiLoading(true);
    try {
      const r = await axios.post(`${API}/tickets/${selectedTicket.id}/ai-suggest${force ? '?force=true' : ''}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAiSuggestion(r.data?.suggestion || null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'AI suggestion failed');
    } finally {
      setAiLoading(false);
    }
  };

  // ----- Messaging
  const openMessageDialog = useCallback((draft) => {
    if (!selectedTicket) return;
    setMessageDraft(draft || '');
    setMessageChannel('whatsapp');
    setMessageOpen(true);
    axios.get(`${API}/canned-responses`, {
      headers: { Authorization: `Bearer ${token}` }, params: { channel: 'whatsapp' },
    }).then(r => setCannedResponses(r.data?.canned_responses || [])).catch(() => setCannedResponses([]));
  }, [selectedTicket, token]);

  const sendMessage = async () => {
    if (!selectedTicket) return;
    if (messageChannel === 'whatsapp' && !messageDraft.trim()) {
      toast.error('Type a message first'); return;
    }
    setSending(true);
    try {
      const r = await axios.post(`${API}/tickets/${selectedTicket.id}/send-message`,
        { channel: messageChannel, message: messageDraft },
        { headers: { Authorization: `Bearer ${token}` } });
      if (r.data?.success) {
        toast.success(`${messageChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} sent`);
        setMessageOpen(false);
        loadSelected(selectedTicket.id);
      } else {
        toast.error(r.data?.error || 'Send failed');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  // ----- Create ticket
  const createTicket = async (e) => {
    e?.preventDefault();
    if (!newTicket.device_type || !newTicket.issue_description) {
      toast.error('Device type and issue required'); return;
    }
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append('device_type', newTicket.device_type);
      fd.append('issue_description', newTicket.issue_description);
      if (newTicket.order_id) fd.append('order_id', newTicket.order_id);
      if (newTicket.customer_id) fd.append('customer_id', newTicket.customer_id);
      const r = await axios.post(`${API}/tickets`, fd, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Ticket created');
      setCreateOpen(false);
      setNewTicket({ device_type: '', order_id: '', issue_description: '', customer_id: '' });
      await fetchTickets();
      if (r.data?.id) setSelectedId(r.data.id);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  // ----- Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      // Ignore when typing in an input/textarea
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;

      // Cmd-K / Ctrl-K — focus queue search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const el = document.querySelector('[data-testid="queue-search"]');
        el?.focus();
        return;
      }
      // Cmd-R — refresh
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r' && !e.shiftKey) {
        // Let the browser handle refresh if focus is in a field; otherwise refresh tickets
        if (!inField) { e.preventDefault(); fetchTickets(); fetchMissedCount(); return; }
      }
      if (inField) return;

      // J/K navigation
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const idx = filteredList.findIndex(t => t.id === selectedId);
        const next = filteredList[Math.min(filteredList.length - 1, (idx < 0 ? 0 : idx + 1))];
        if (next) setSelectedId(next.id);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = filteredList.findIndex(t => t.id === selectedId);
        const next = filteredList[Math.max(0, (idx < 0 ? 0 : idx - 1))];
        if (next) setSelectedId(next.id);
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setCreateOpen(true);
      } else if (e.key.toLowerCase() === 'r' && selectedTicket) {
        e.preventDefault();
        openMessageDialog('');
      } else if (e.key === 'Escape') {
        if (messageOpen) setMessageOpen(false);
        if (createOpen) setCreateOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filteredList, selectedId, selectedTicket, messageOpen, createOpen, openMessageDialog, fetchTickets, fetchMissedCount]);

  return (
    <DashboardLayout title="Call Support">
      <div className="-mx-4 lg:-mx-8 -my-4 lg:-my-8 h-[calc(100vh-4rem)] flex flex-col bg-background">
        <KpiStrip
          tickets={tickets}
          missedCount={missedCount}
          onJumpToBreached={() => setFilter('breached')}
          onOpenMissed={() => navigate('/calls')}
        />

        <div className="flex-1 min-h-0">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={22} minSize={18} maxSize={32}>
              <QueuePane
                tickets={tickets}
                selectedId={selectedId}
                onSelect={setSelectedId}
                filter={filter}
                setFilter={setFilter}
                query={query}
                setQuery={setQuery}
                loading={loading}
                onCreateNew={() => setCreateOpen(true)}
                onRefresh={() => { fetchTickets(); fetchMissedCount(); }}
              />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={48} minSize={32}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedTicket?.id || 'none'}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full"
                >
                  <DetailPane
                    ticket={selectedTicket}
                    onUpdate={() => { fetchTickets(); loadSelected(selectedTicket?.id); }}
                    onReload={() => loadSelected(selectedTicket?.id)}
                    onOpenMessage={() => openMessageDialog('')}
                  />
                </motion.div>
              </AnimatePresence>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={30} minSize={22} maxSize={40}>
              <ContextPane
                ticket={selectedTicket}
                customerHistory={customerHistory}
                kbSuggestions={kbSuggestions}
                aiSuggestion={aiSuggestion}
                aiLoading={aiLoading}
                historyLoading={historyLoading}
                onRunAI={runAi}
                onUseNotes={(notes) => toast.info('Use the notes field on the left — pasted below', { description: 'Copy from suggestion: ' + notes.slice(0, 60) + '…' })}
                onUseMessage={(msg) => openMessageDialog(msg)}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      {/* Message dialog */}
      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              {selectedTicket?.customer_name || 'Customer'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-secondary/40 p-2 rounded text-xs flex justify-between">
              <span className="text-muted-foreground">To</span>
              <span className="font-mono">{selectedTicket?.customer_phone}</span>
            </div>
            <div className="flex gap-2">
              {['whatsapp', 'sms'].map(ch => (
                <button
                  key={ch}
                  onClick={() => setMessageChannel(ch)}
                  className={cn('flex-1 h-8 rounded-md text-sm border transition-colors',
                    messageChannel === ch
                      ? (ch === 'whatsapp' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-blue-600 text-white border-blue-600')
                      : 'bg-card text-foreground border-border hover:bg-secondary/60'
                  )}
                >{ch === 'whatsapp' ? 'WhatsApp' : 'SMS (template)'}</button>
              ))}
            </div>
            {messageChannel === 'whatsapp' ? (
              <>
                <Textarea rows={4} value={messageDraft} onChange={(e) => setMessageDraft(e.target.value)} placeholder="Type message…" autoFocus />
                {cannedResponses.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {cannedResponses.map(cr => (
                      <button key={cr.id} onClick={() => setMessageDraft(cr.body)} title={cr.body}
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-secondary/60">{cr.title}</button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground bg-amber-50 border border-amber-200 p-2 rounded">SMS uses the pre-approved DLT template (free-text not allowed in India).</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button>
            <Button onClick={sendMessage} disabled={sending || (messageChannel === 'whatsapp' && !messageDraft.trim())}>
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New ticket dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New ticket</DialogTitle>
          </DialogHeader>
          <form onSubmit={createTicket} className="space-y-3">
            <div>
              <Label>Device *</Label>
              <Select value={newTicket.device_type} onValueChange={v => setNewTicket({ ...newTicket, device_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
                <SelectContent>
                  {['Inverter', 'Battery', 'Stabilizer', 'Others'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Order ID</Label>
              <Input value={newTicket.order_id} onChange={e => setNewTicket({ ...newTicket, order_id: e.target.value })} />
            </div>
            <div>
              <Label>Issue *</Label>
              <Textarea rows={3} value={newTicket.issue_description} onChange={e => setNewTicket({ ...newTicket, issue_description: e.target.value })} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

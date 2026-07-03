import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import CustomerHistoryBadge from '@/components/customer/CustomerHistoryBadge';
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
import {
  PhoneCall, Send, Sparkles, Timer, AlarmClock,
  ChevronRight, ArrowUpCircle, Wrench, MessageSquare, Plus,
  Search, Loader2, FileText, Shield, Package, History, Inbox,
  CheckCircle2, RotateCw, ListChecks,
} from 'lucide-react';
import ClickToCallButton from '@/components/calls/ClickToCallButton';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, mono, ticketPill } from '@/components/iron/IronKit';

// =========================================================================
// Inline Iron style helpers
// =========================================================================
const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '7px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnGhost = { border: 'none', background: 'transparent', color: T.iron500, borderRadius: 6, padding: '6px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: T.headline, fontWeight: 700, fontSize: 12 };

const SLA_COLOR = { red: T.rose, amber: T.voltageText, emerald: T.green, slate: T.iron400 };
const SLA_DOT = { red: '#C2410C', amber: '#F4C518', emerald: '#1F8A4C', slate: '#CBCBCB' };

const Pill = ({ status }) => { const { label, style } = ticketPill(status); return <span style={style}>{label}</span>; };

// =========================================================================
// Helpers (preserved verbatim)
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
  { id: 'open', label: 'Open', icon: Inbox },
  { id: 'working', label: 'Working', icon: Wrench },
  { id: 'breached', label: 'SLA Risk', icon: AlarmClock },
  { id: 'all', label: 'All', icon: ListChecks },
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
    return [...list].sort((a, b) => {
      const ai = slaInfo(a)?.mins ?? Number.POSITIVE_INFINITY;
      const bi = slaInfo(b)?.mins ?? Number.POSITIVE_INFINITY;
      if (ai !== bi) return ai - bi;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  }, [tickets, filter, query]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.white }}>
      {/* Search + actions */}
      <div style={{ padding: 12, borderBottom: `1px solid ${T.iron200}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={13} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search · ⌘K"
              style={{ ...inputStyle, width: '100%', paddingLeft: 28, height: 32 }}
              data-testid="queue-search"
            />
          </div>
          <button style={{ ...btnGhost, padding: 7 }} onClick={onRefresh} title="Refresh (⌘R)"><RotateCw size={14} /></button>
          <button style={{ ...btnPrimary, padding: '7px 9px' }} onClick={onCreateNew} title="New ticket (N)"><Plus size={14} /></button>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const Icon = f.icon;
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 9px', borderRadius: 6,
                  fontFamily: T.headline, fontWeight: 700, fontSize: 11, cursor: 'pointer',
                  border: `1px solid ${isActive ? T.orange : T.iron200}`,
                  background: isActive ? '#FDEEE6' : T.white,
                  color: isActive ? T.orangeDeep : T.iron500,
                }}
              >
                <Icon size={12} />
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Queue list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ height: 52, background: T.iron100, borderRadius: 6 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
            <div style={{ textAlign: 'center', color: T.iron400 }}>
              <CheckCircle2 size={30} color={T.green} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
              <p style={{ fontSize: 12.5 }}>Queue is clear</p>
            </div>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
            {filtered.map((t) => {
              const sla = slaInfo(t);
              const isActive = t.id === selectedId;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => onSelect(t.id)}
                    className="iron-row"
                    style={{
                      position: 'relative', width: '100%', textAlign: 'left', padding: '10px 12px',
                      borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer',
                      background: isActive ? '#FEF6EF' : 'transparent', border: 'none', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: T.iron200,
                    }}
                  >
                    {isActive && <span style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 3, background: T.orange }} />}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ marginTop: 6, width: 6, height: 6, borderRadius: 999, flexShrink: 0, background: sla ? SLA_DOT[sla.tone] : '#D8D8D8' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ ...mono, fontSize: 12, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.ticket_number}</span>
                          {sla && <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: SLA_COLOR[sla.tone] }}>{sla.label}</span>}
                          <span style={{ ...mono, marginLeft: 'auto', fontSize: 10, color: T.iron400 }}>{fmtTime(t.created_at)}</span>
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: 12.5, fontFamily: T.headline, fontWeight: 600, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.customer_name || t.customer_phone || '—'}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: T.iron500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.device_type ? `${t.device_type} · ` : ''}{t.issue_description || ''}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer: count */}
      <div style={{ borderTop: `1px solid ${T.iron200}`, padding: '6px 12px', fontSize: 11, color: T.iron400, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{filtered.length} {filtered.length === 1 ? 'ticket' : 'tickets'}</span>
        <span style={{ ...mono, fontSize: 10 }}>J/K nav · ⏎ open</span>
      </div>
    </div>
  );
}

// =========================================================================
// Detail Pane (middle)
// =========================================================================
const RESOLVED_STATUSES = ['resolved_on_call', 'closed_by_agent'];

function DetailPane({ ticket, onUpdate, onOpenMessage, onReload, onResolved }) {
  const { token } = useAuth();
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
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: T.iron50 }}>
        <div style={{ textAlign: 'center', maxWidth: 260 }}>
          <div style={{ margin: '0 auto 12px', width: 56, height: 56, borderRadius: 999, background: T.white, border: `1px solid ${T.iron200}`, display: 'grid', placeItems: 'center' }}>
            <Inbox size={24} color={T.iron400} />
          </div>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: T.iron700 }}>No ticket selected</p>
          <p style={{ fontSize: 12, color: T.iron400, marginTop: 4 }}>Pick a ticket from the queue, or press <kbd style={{ padding: '1px 5px', background: T.iron100, borderRadius: 4, fontSize: 10, border: `1px solid ${T.iron200}` }}>N</kbd> for new.</p>
        </div>
      </div>
    );
  }

  const sla = slaInfo(ticket);

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
      if (statusValue && RESOLVED_STATUSES.includes(statusValue)) {
        onResolved?.();
      }
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.white, overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ ...mono, fontSize: 13, color: T.iron900 }}>{ticket.ticket_number}</span>
          <Pill status={ticket.status} />
          {sla && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: SLA_COLOR[sla.tone], background: T.iron50, border: `1px solid ${T.iron200}` }}>
              <Timer size={11} />{sla.label}
            </span>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={btnGhost} onClick={onOpenMessage} title="Send WhatsApp (R)"><MessageSquare size={14} />Reply</button>
          <button style={{ ...btnGhost, padding: 7 }} onClick={onReload} title="Reload"><RotateCw size={14} /></button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Customer hero */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: T.orange, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontFamily: T.headline, fontWeight: 700, flexShrink: 0 }}>
              {(ticket.customer_name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <p style={{ margin: 0, fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>{ticket.customer_name || '—'}</p>
                <CustomerHistoryBadge phone={ticket.customer_phone} variant="badge" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.iron500, marginTop: 2 }}>
                <span style={mono}>{ticket.customer_phone}</span>
                {ticket.customer_phone && (
                  <ClickToCallButton phone={ticket.customer_phone} customerName={ticket.customer_name} showLabel={false} size="sm" />
                )}
                {ticket.customer_email && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>· {ticket.customer_email}</span>}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: T.iron400 }}>
                {ticket.device_type ? `${ticket.device_type} · ` : ''}
                created {new Date(ticket.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Issue */}
          <div>
            <Caps size={9.5} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>Issue</Caps>
            <p style={{ margin: 0, fontSize: 13, color: T.iron900, lineHeight: 1.55, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 12 }}>
              {ticket.issue_description || <span style={{ fontStyle: 'italic', color: T.iron400 }}>No description</span>}
            </p>
          </div>

          {/* Status + diagnosis + notes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Caps size={9.5} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>Update status</Caps>
                <Select value={statusValue} onValueChange={setStatusValue}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="No change" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved_on_call">Resolved on Call</SelectItem>
                    <SelectItem value="closed_by_agent">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Caps size={9.5} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>Diagnosis</Caps>
                <Textarea
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  rows={2}
                  placeholder="Quick diagnosis…"
                  className="resize-none text-sm"
                />
              </div>
            </div>
            <div>
              <Caps size={9.5} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>Agent notes</Caps>
              <Textarea
                value={agentNotes}
                onChange={(e) => setAgentNotes(e.target.value)}
                rows={6}
                placeholder="Internal notes…"
                className="resize-none text-sm"
              />
              <p style={{ fontSize: 10, marginTop: 4, color: agentNotes.length >= 100 ? T.green : T.iron400 }}>
                {agentNotes.length}/100 chars (escalation/route needs ≥100)
              </p>
            </div>
          </div>

          {/* History */}
          {ticket.history?.length > 0 && (
            <div>
              <Caps size={9.5} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>Activity</Caps>
              <ol style={{ borderLeft: `2px solid ${T.iron200}`, margin: '0 0 0 4px', padding: '0 0 0 16px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 176, overflowY: 'auto' }}>
                {ticket.history.slice().reverse().map((h, i) => (
                  <li key={i} style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: -19, top: 6, width: 8, height: 8, borderRadius: 999, background: T.orange, boxShadow: `0 0 0 2px ${T.white}` }} />
                    <p style={{ margin: 0, fontSize: 12.5, color: T.iron900 }}>{h.action}</p>
                    <p style={{ margin: 0, fontSize: 10.5, color: T.iron400 }}>{h.by} · {new Date(h.timestamp).toLocaleString()}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: T.white, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.iron400 }}>
          <span>⌘S save</span><span>·</span><span>E escalate</span><span>·</span><span>H hardware</span><span>·</span><span>R reply</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={{ ...btnOutline, opacity: (saving || agentNotes.length < 100) ? 0.5 : 1 }} disabled={saving || agentNotes.length < 100} onClick={routeHW}>
            <Wrench size={14} />Hardware
          </button>
          <button style={{ ...btnOutline, opacity: (saving || agentNotes.length < 100) ? 0.5 : 1 }} disabled={saving || agentNotes.length < 100} onClick={escalate}>
            <ArrowUpCircle size={14} />Escalate
          </button>
          <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={save}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Save
          </button>
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
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: T.iron50 }}>
        <p style={{ fontSize: 12, color: T.iron400 }}>Customer context appears here</p>
      </div>
    );
  }

  const sectionCard = { border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 12, background: T.white };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: T.white }}>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* AI suggestion */}
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 8, border: `1px solid ${T.iron200}`, background: T.iron50, padding: 14 }}>
          <div style={{ position: 'absolute', right: -16, top: -16, width: 96, height: 96, borderRadius: 999, background: '#FDEEE6', filter: 'blur(28px)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, display: 'grid', placeItems: 'center', background: '#FDEEE6', color: T.orangeDeep }}>
                  <Sparkles size={14} />
                </div>
                <Caps size={10} color={T.iron900} ls=".08em">Suggested next step</Caps>
              </div>
              <button style={{ ...btnOutline, padding: '4px 8px', fontSize: 10, opacity: aiLoading ? 0.6 : 1 }} onClick={() => onRunAI(!!aiSuggestion)} disabled={aiLoading}>
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : (aiSuggestion ? 'Re-run' : 'Run')}
              </button>
            </div>
            {aiSuggestion ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 6, background: T.orange, padding: '2px 8px', fontFamily: T.headline, fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#fff' }}>
                    {aiSuggestion.action}
                  </span>
                  <span style={{ ...mono, fontSize: 10, textTransform: 'uppercase', color: T.iron400 }}>
                    <span style={{ fontWeight: 700, color: T.iron900 }}>{aiSuggestion.confidence}</span> confidence
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: T.iron900 }}>{aiSuggestion.rationale}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                  {aiSuggestion.draft_notes && (
                    <button onClick={() => onUseNotes(aiSuggestion.draft_notes)} style={{ borderRadius: 6, border: `1px solid ${T.iron200}`, background: T.white, padding: '4px 8px', fontSize: 11, fontWeight: 600, color: T.iron700, cursor: 'pointer' }}>
                      Use notes
                    </button>
                  )}
                  {aiSuggestion.draft_message && (
                    <button onClick={() => onUseMessage(aiSuggestion.draft_message)} style={{ borderRadius: 6, border: `1px solid ${T.green}`, background: T.greenTint, padding: '4px 8px', fontSize: 11, fontWeight: 600, color: T.green, cursor: 'pointer' }}>
                      Send as WA
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 11.5, color: T.iron700 }}>
                Click <em style={{ fontStyle: 'normal', fontWeight: 700, color: T.orangeDeep }}>Run</em> for a next-step recommendation.
              </p>
            )}
          </div>
        </div>

        {/* Customer summary */}
        {customerHistory && (
          <div>
            <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>Customer</Caps>
            <div style={{ ...sectionCard, fontSize: 12 }}>
              <p style={{ margin: 0, fontWeight: 600, color: T.iron900 }}>{customerHistory.customer_name}</p>
              <p style={{ margin: 0, color: T.iron500 }}>{customerHistory.customer_phone}</p>
              {customerHistory.customer_email && (
                <p style={{ margin: 0, color: T.iron500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{customerHistory.customer_email}</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 11 }}>
                <span><span style={{ fontWeight: 700, color: T.iron900 }}>{customerHistory.total_tickets || 0}</span> tickets</span>
                <span><span style={{ fontWeight: 700, color: T.iron900 }}>{customerHistory.warranties?.length || 0}</span> warranties</span>
                <span><span style={{ fontWeight: 700, color: T.iron900 }}>{customerHistory.dispatches?.length || 0}</span> dispatches</span>
              </div>
            </div>
          </div>
        )}

        {/* Prior tickets */}
        {customerHistory?.related_tickets?.length > 0 && (
          <div>
            <Caps size={9} color={T.iron400} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}><History size={11} /> Prior tickets ({customerHistory.related_tickets.length})</Caps>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {customerHistory.related_tickets.slice(0, 4).map(rt => (
                <div key={rt.id} style={{ borderRadius: 6, border: `1px solid ${T.iron200}`, padding: '6px 10px', fontSize: 11.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={mono}>{rt.ticket_number}</span>
                    <Pill status={rt.status} />
                  </div>
                  <p style={{ margin: 0, color: T.iron500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rt.issue_description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warranties */}
        {customerHistory?.warranties?.length > 0 && (
          <div>
            <Caps size={9} color={T.iron400} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}><Shield size={11} /> Warranties</Caps>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {customerHistory.warranties.map(w => {
                const exp = warrantyExpiryInfo(w);
                const bColor = exp?.tone === 'rose' ? '#F6D8BA' : exp?.tone === 'amber' ? '#EDDFA6' : T.iron200;
                const eColor = exp?.tone === 'rose' ? T.orangeDeep : exp?.tone === 'amber' ? T.voltageText : T.iron400;
                return (
                  <div key={w.id} style={{ borderRadius: 6, border: `1px solid ${bColor}`, padding: '6px 10px', fontSize: 11.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={mono}>{w.warranty_number}</span>
                      {exp ? (
                        <span style={{ fontSize: 10, color: eColor }}>{exp.label}</span>
                      ) : (
                        <span style={{ fontSize: 10, color: T.iron400 }}>{w.warranty_end_date && new Date(w.warranty_end_date).toLocaleDateString()}</span>
                      )}
                    </div>
                    <p style={{ margin: 0, color: T.iron500 }}>{w.device_type}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent dispatches */}
        {customerHistory?.dispatches?.length > 0 && (
          <div>
            <Caps size={9} color={T.iron400} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}><Package size={11} /> Recent dispatches</Caps>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {customerHistory.dispatches.slice(0, 3).map(d => (
                <div key={d.id} style={{ borderRadius: 6, border: `1px solid ${T.iron200}`, padding: '6px 10px', fontSize: 11.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={mono}>{d.dispatch_number}</span>
                    <Pill status={d.status} />
                  </div>
                  <p style={{ margin: 0, color: T.iron500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.product_name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KB */}
        {kbSuggestions?.length > 0 && (
          <div>
            <Caps size={9} color={T.iron400} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}><FileText size={11} /> Knowledge base</Caps>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {kbSuggestions.map(art => (
                <details key={art.id} className="group" style={{ borderRadius: 6, border: `1px solid ${T.iron200}`, fontSize: 11.5 }}>
                  <summary style={{ padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{art.title}</span>
                    <ChevronRight size={12} color={T.iron400} className="group-open:rotate-90 transition-transform" />
                  </summary>
                  {art.problem_summary && <p style={{ padding: '0 10px 8px', margin: 0, color: T.iron500 }}>{art.problem_summary}</p>}
                  {art.resolution_steps && (
                    <pre style={{ padding: '0 10px 8px', margin: 0, fontSize: 11, color: T.iron700, whiteSpace: 'pre-wrap', fontFamily: T.body }}>{art.resolution_steps}</pre>
                  )}
                </details>
              ))}
            </div>
          </div>
        )}

        {historyLoading && !customerHistory && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 64, background: T.iron100, borderRadius: 6 }} />
            <div style={{ height: 48, background: T.iron100, borderRadius: 6 }} />
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
    <div style={{ padding: '10px 18px', borderBottom: `1px solid ${T.iron200}`, background: T.white, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', flexShrink: 0 }}>
      <button onClick={onJumpToBreached} style={{ ...btnGhost, padding: 0, gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: sla.breached > 0 ? T.rose : T.green }} />
        <Caps size={9} color={T.iron400}>SLA</Caps>
        <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: sla.breached > 0 ? T.rose : T.iron900 }}>{sla.breached}</span>
        <span style={{ fontSize: 11, color: T.iron400, fontWeight: 500 }}>breached · {sla.soon} in 2h</span>
      </button>
      <div style={{ height: 20, width: 1, background: T.iron200 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Inbox size={14} color={T.iron400} />
        <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: T.iron900 }}>{openCount}</span>
        <span style={{ fontSize: 11, color: T.iron400 }}>open</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Wrench size={14} color={T.iron400} />
        <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: T.iron900 }}>{inProgress}</span>
        <span style={{ fontSize: 11, color: T.iron400 }}>working</span>
      </div>
      {missedCount > 0 && (
        <>
          <div style={{ height: 20, width: 1, background: T.iron200 }} />
          <button onClick={onOpenMissed} style={{ ...btnGhost, padding: 0, gap: 8 }}>
            <PhoneCall size={14} color={T.rose} />
            <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: T.rose }}>{missedCount}</span>
            <span style={{ fontSize: 11, color: T.iron400 }}>missed calls</span>
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
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [tickets, setTickets] = useState([]);
  const [missedCount, setMissedCount] = useState(0);
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('ticket') || null);
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

  // Deep-link: open a specific ticket when arriving via ?ticket=<id>
  useEffect(() => {
    const tid = new URLSearchParams(location.search).get('ticket');
    if (tid) setSelectedId(tid);
  }, [location.search]);

  // Auto-select first when nothing is selected and tickets arrive
  useEffect(() => {
    if (!selectedId && tickets.length > 0 && !loading) {
      const filtered = tickets.filter(t => ['open', 'new_request', 'call_support_followup'].includes(t.status));
      if (filtered.length > 0) {
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
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const el = document.querySelector('[data-testid="queue-search"]');
        el?.focus();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r' && !e.shiftKey) {
        if (!inField) { e.preventDefault(); fetchTickets(); fetchMissedCount(); return; }
      }
      if (inField) return;

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

  const newBtn = (
    <button style={btnPrimary} onClick={() => setCreateOpen(true)} title="New ticket (N)"><Plus size={14} />New</button>
  );

  return (
    <IronShell
      title="Support Inbox"
      subtitle="SLA-PRIORITISED QUEUE"
      onRefresh={() => { fetchTickets(); fetchMissedCount(); }}
      headerRight={newBtn}
    >
      <div style={{ margin: -22, height: 'calc(100vh - 58px)', display: 'flex', flexDirection: 'column', background: T.iron50, overflow: 'hidden' }}>
        <KpiStrip
          tickets={tickets}
          missedCount={missedCount}
          onJumpToBreached={() => setFilter('breached')}
          onOpenMissed={() => navigate('/calls')}
        />

        <div style={{ flex: 1, minHeight: 0 }} ref={queueListRef}>
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
              <DetailPane
                ticket={selectedTicket}
                onUpdate={() => { fetchTickets(); loadSelected(selectedTicket?.id); }}
                onReload={() => loadSelected(selectedTicket?.id)}
                onOpenMessage={() => openMessageDialog('')}
                onResolved={() => {}}
              />
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
                  className={
                    'flex-1 h-8 rounded-md text-sm border transition-colors ' +
                    (messageChannel === ch
                      ? (ch === 'whatsapp' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-blue-600 text-white border-blue-600')
                      : 'bg-card text-foreground border-border hover:bg-secondary/60')
                  }
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
    </IronShell>
  );
}

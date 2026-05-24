import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ShieldAlert, Loader2, Search, Filter, Clock, CheckCircle2, AlertTriangle,
  XCircle, Truck, FileText, ChevronRight, MessageSquare, Paperclip,
  ExternalLink, Package, Send, X, Eye, Building2, RefreshCw,
} from 'lucide-react';

const STATUS_META = {
  submitted:              { label: 'Submitted',               tone: 'bg-sky-400/15 text-sky-400 ring-sky-400/25' },
  under_review:           { label: 'Under Review',            tone: 'bg-violet-400/15 text-violet-400 ring-violet-400/25' },
  info_requested:         { label: 'Info Requested',          tone: 'bg-amber-400/15 text-amber-400 ring-amber-400/25' },
  approved:               { label: 'Approved',                tone: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25' },
  replacement_dispatched: { label: 'Replacement Dispatched',  tone: 'bg-primary/15 text-primary ring-primary/25' },
  closed:                 { label: 'Closed',                  tone: 'bg-muted text-muted-foreground' },
  rejected:               { label: 'Rejected',                tone: 'bg-rose-500/15 text-rose-400 ring-rose-500/25' },
};

const STATUS_FILTERS = [
  { id: 'all',                    label: 'All' },
  { id: 'open',                   label: 'Open' },
  { id: 'submitted',              label: 'New' },
  { id: 'under_review',           label: 'In Review' },
  { id: 'info_requested',         label: 'Info Pending' },
  { id: 'approved',               label: 'Approved' },
  { id: 'replacement_dispatched', label: 'Dispatched' },
  { id: 'closed',                 label: 'Closed' },
  { id: 'rejected',               label: 'Rejected' },
];

export default function AdminWarrantyClaims() {
  const { token } = useAuth();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('open');
  const [sla, setSla] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchClaims = useCallback(async () => {
    try {
      setLoading(true);
      const query = {};
      if (filter !== 'all') query.status = filter;
      if (sla) query.sla = sla;
      const resp = await axios.get(`${API}/admin/warranty-claims`, {
        headers: { Authorization: `Bearer ${token}` },
        params: query,
      });
      setClaims(resp.data.claims || []);
      setStats(resp.data.stats || {});
    } catch (err) {
      console.error(err);
      toast.error('Failed to load warranty claims');
    } finally {
      setLoading(false);
    }
  }, [token, filter, sla]);

  useEffect(() => { if (token) fetchClaims(); }, [token, fetchClaims]);

  useEffect(() => {
    const id = params.get('id');
    if (id && claims.length > 0 && !selected) {
      const found = claims.find(c => c.id === id);
      if (found) setSelected(found);
    }
  }, [params, claims, selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return claims;
    const q = search.trim().toLowerCase();
    return claims.filter(c =>
      (c.claim_number || '').toLowerCase().includes(q) ||
      (c.dealer_name || '').toLowerCase().includes(q) ||
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.customer_phone || '').toLowerCase().includes(q) ||
      (c.serial_number || '').toLowerCase().includes(q) ||
      (c.product_name || '').toLowerCase().includes(q)
    );
  }, [claims, search]);

  const slaBadge = (claim) => {
    if (!claim) return null;
    if (claim.sla_breached) {
      return <Badge className="bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25 font-mono text-[10px] uppercase">
        <AlertTriangle className="w-3 h-3 mr-1" /> Breached
      </Badge>;
    }
    if (!claim.created_at) return null;
    const ageDays = Math.floor((Date.now() - new Date(claim.created_at).getTime()) / 86400000);
    if (ageDays >= 5) return <Badge className="bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25 font-mono text-[10px] uppercase">Urgent · {ageDays}d</Badge>;
    if (ageDays >= 3) return <Badge className="bg-amber-400/10 text-amber-400/80 ring-1 ring-amber-400/15 font-mono text-[10px] uppercase">{ageDays}d</Badge>;
    return <Badge className="bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25 font-mono text-[10px] uppercase">Fresh · {ageDays}d</Badge>;
  };

  return (
    <DashboardLayout title="Warranty Claims">
      <div className="space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={ShieldAlert}   label="Total"          value={stats.total}                       tone="text-primary bg-primary/15" />
          <StatCard icon={Clock}         label="Open"           value={stats.open}                        tone="text-sky-400 bg-sky-400/15" />
          <StatCard icon={FileText}      label="New (submitted)" value={stats.submitted}                  tone="text-violet-400 bg-violet-400/15" />
          <StatCard icon={Truck}         label="Dispatched"     value={stats.replacement_dispatched}      tone="text-primary bg-primary/15" />
          <StatCard icon={AlertTriangle} label="SLA Breached"   value={stats.breached}                    tone="text-rose-400 bg-rose-500/15" />
        </div>

        {/* Filters + search */}
        <Card className="mg-card border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search claim no., dealer, customer, S/N, product…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-background border-border text-foreground"
                />
              </div>
              <Button size="sm" variant="outline" onClick={fetchClaims} className="border-border">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
              {STATUS_FILTERS.map(f => (
                <button key={f.id}
                  onClick={() => { setFilter(f.id); setSla(null); }}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors font-mono uppercase tracking-wide
                    ${filter === f.id && !sla ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                  {f.label}
                </button>
              ))}
              <div className="border-l border-border mx-2 h-5" />
              <button
                onClick={() => { setSla(sla === 'breached' ? null : 'breached'); setFilter('all'); }}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors font-mono uppercase tracking-wide
                  ${sla === 'breached' ? 'bg-rose-500 text-white' : 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'}`}>
                <AlertTriangle className="w-3 h-3 inline mr-1" /> SLA Breached Only
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Claims table */}
        <Card className="mg-card border-border">
          <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              {loading ? 'Loading…' : (filtered.length === 0 ? 'No claims found' : `${filtered.length} ${filtered.length === 1 ? 'claim' : 'claims'}`)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading && claims.length === 0 ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">SLA</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Claim</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Dealer</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Customer / Product</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Issue</th>
                    <th className="text-right px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No claims match this filter.</td></tr>
                  )}
                  {filtered.map(c => {
                    const meta = STATUS_META[c.status] || STATUS_META.submitted;
                    return (
                      <tr key={c.id} className="border-b border-border/40 hover:bg-accent/40 cursor-pointer" onClick={() => setSelected(c)}>
                        <td className="px-4 py-3 align-top">{slaBadge(c)}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-mono text-foreground font-semibold">{c.claim_number}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{c.created_at?.slice(0, 10)}</div>
                          {c.out_of_warranty && (
                            <Badge className="bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25 font-mono text-[9px] uppercase mt-1">
                              OOW
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge className={`${meta.tone} font-mono text-[10px] uppercase tracking-wide`}>{meta.label}</Badge>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="text-foreground text-sm">{c.dealer_name}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="text-foreground text-sm">{c.customer_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{c.customer_phone} · {c.customer_city || '—'}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{c.product_name} · S/N <span className="font-mono">{c.serial_number}</span></div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge className="bg-primary/15 text-primary ring-1 ring-primary/25 font-mono text-[10px] uppercase mb-1">
                            {(c.issue_category || '').replace('_', ' ')}
                          </Badge>
                          <div className="text-xs text-muted-foreground line-clamp-2 max-w-md">{c.issue_description}</div>
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail drawer with admin actions */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-popover border-l border-border overflow-y-auto p-0">
          {selected && (
            <AdminClaimDetail
              claim={selected}
              token={token}
              onClose={() => setSelected(null)}
              onAction={() => { fetchClaims(); setSelected(null); }}
            />
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <Card className="mg-card border-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${tone}`}><Icon className="w-5 h-5" /></div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold text-foreground">{value || 0}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminClaimDetail({ claim, token, onClose, onAction }) {
  const meta = STATUS_META[claim.status] || STATUS_META.submitted;
  const [actionDialog, setActionDialog] = useState(null);   // 'review' | 'request-info' | 'approve' | 'reject' | 'dispatch' | 'reverse-pickup'

  return (
    <div>
      <SheetHeader className="px-6 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <SheetTitle className="text-foreground">
            <div className="font-mono text-base">{claim.claim_number}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className={`${meta.tone} font-mono text-[10px] uppercase tracking-wide`}>{meta.label}</Badge>
              {claim.sla_breached && (
                <Badge className="bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25 font-mono text-[10px] uppercase">
                  <AlertTriangle className="w-3 h-3 mr-1" /> SLA Breached
                </Badge>
              )}
            </div>
          </SheetTitle>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
      </SheetHeader>

      <div className="px-6 py-5 space-y-5">
        {/* Action toolbar — varies by status */}
        <Card className="border-primary/20 bg-primary/[0.04]">
          <CardContent className="p-3 flex flex-wrap gap-2">
            {claim.status === 'submitted' && (
              <Button size="sm" onClick={() => setActionDialog('review')} className="bg-violet-500 hover:bg-violet-600 text-white">
                <Eye className="w-4 h-4 mr-1.5" /> Start Review
              </Button>
            )}
            {(claim.status === 'submitted' || claim.status === 'under_review') && (
              <>
                <Button size="sm" onClick={() => setActionDialog('request-info')} className="bg-amber-500 hover:bg-amber-600 text-white">
                  <MessageSquare className="w-4 h-4 mr-1.5" /> Request Info
                </Button>
                <Button size="sm" onClick={() => setActionDialog('approve')} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve
                </Button>
                <Button size="sm" onClick={() => setActionDialog('reject')} className="bg-rose-500 hover:bg-rose-600 text-white">
                  <XCircle className="w-4 h-4 mr-1.5" /> Reject
                </Button>
              </>
            )}
            {claim.status === 'approved' && (
              <Button size="sm" onClick={() => setActionDialog('dispatch')} className="bg-primary text-primary-foreground">
                <Truck className="w-4 h-4 mr-1.5" /> Record Dispatch
              </Button>
            )}
            {!claim.reverse_pickup_initiated && claim.status !== 'closed' && claim.status !== 'rejected' && (
              <Button size="sm" variant="outline" onClick={() => setActionDialog('reverse-pickup')} className="border-border">
                <Package className="w-4 h-4 mr-1.5" /> Init Reverse Pickup
              </Button>
            )}
            {['closed', 'rejected'].includes(claim.status) && (
              <span className="text-sm text-muted-foreground italic">Claim is closed — no further actions available.</span>
            )}
          </CardContent>
        </Card>

        {/* Product/Customer + issue */}
        <Section title="Product & Customer">
          <Row label="Product"        value={claim.product_name} />
          <Row label="Serial No."     value={claim.serial_number} mono />
          <Row label="Purchase"       value={claim.purchase_date?.slice(0, 10)} mono />
          <Row label="Warranty until" value={claim.warranty_expires?.slice(0, 10)} mono />
          <Row label="Dealer"         value={claim.dealer_name} />
          <Row label="Customer"       value={claim.customer_name} />
          <Row label="Phone"          value={claim.customer_phone} mono />
          <Row label="Email"          value={claim.customer_email || '—'} mono />
          <Row label="Address"        value={[claim.customer_address, claim.customer_city, claim.customer_state, claim.customer_pincode].filter(Boolean).join(', ') || '—'} />
        </Section>

        <Section title="Issue Reported">
          <div className="text-sm text-foreground/90 bg-muted/30 rounded-md p-3 border border-border">
            <Badge className="bg-primary/15 text-primary ring-1 ring-primary/25 mb-2 font-mono text-[10px] uppercase">
              {(claim.issue_category || '').replace('_', ' ')}
            </Badge>
            <div className="whitespace-pre-wrap">{claim.issue_description}</div>
          </div>
          {(claim.attachments || []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {claim.attachments.map((a, i) => (
                <a key={i} href={a} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-foreground hover:bg-accent text-xs border border-border">
                  <Paperclip className="w-3 h-3" /> Photo {i + 1} <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
              ))}
            </div>
          )}
        </Section>

        {(claim.replacement_serial || claim.replacement_tracking_id) && (
          <Section title="Replacement Dispatch">
            <Row label="Replacement S/N" value={claim.replacement_serial || '—'} mono />
            <Row label="Tracking ID"     value={claim.replacement_tracking_id || '—'} mono />
            <Row label="Dispatched on"   value={claim.replacement_dispatched_at?.slice(0, 10) || '—'} mono />
          </Section>
        )}
        {claim.reverse_pickup_initiated && (
          <Section title="Reverse Pickup">
            <Row label="Tracking" value={claim.reverse_pickup_tracking_id || 'Pending'} mono />
          </Section>
        )}
        {claim.rejection_reason && (
          <Section title="Rejection Reason">
            <div className="text-sm text-foreground/85 bg-rose-500/[0.06] border border-rose-500/30 rounded-md p-3">
              {claim.rejection_reason}
            </div>
          </Section>
        )}

        <Section title={`Status History (${(claim.status_history || []).length})`}>
          <div className="space-y-2">
            {(claim.status_history || []).map((h, i) => {
              const hMeta = STATUS_META[h.status] || STATUS_META.submitted;
              return (
                <div key={i} className="flex gap-3 p-3 rounded-md bg-muted/20 border border-border/60">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${hMeta.tone.split(' ')[0]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${hMeta.tone} font-mono text-[10px] uppercase tracking-wide`}>{hMeta.label}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{h.at?.slice(0, 19).replace('T', ' ')}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">by {h.by_name || h.by_role || 'system'} ({h.by_role || 'system'})</div>
                    {h.notes && <div className="text-sm text-foreground/85 mt-2 whitespace-pre-wrap">{h.notes}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      <AdminActionDialog
        action={actionDialog}
        claim={claim}
        token={token}
        onClose={() => setActionDialog(null)}
        onDone={() => { setActionDialog(null); onAction(); }}
      />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground w-32 text-xs">{label}</span>
      <span className={`text-foreground flex-1 ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}

function AdminActionDialog({ action, claim, token, onClose, onDone }) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [extra, setExtra] = useState({});  // dispatch fields, reject reason, etc.

  useEffect(() => { setNotes(''); setExtra({}); }, [action]);

  if (!action) return null;

  const config = {
    'review':         { title: 'Start Review',          endpoint: 'review',           tone: 'bg-violet-500',  cta: 'Move to Under Review' },
    'request-info':   { title: 'Request Information',   endpoint: 'request-info',     tone: 'bg-amber-500',   cta: 'Send Info Request' },
    'approve':        { title: 'Approve Claim',         endpoint: 'approve',          tone: 'bg-emerald-500', cta: 'Approve Claim' },
    'reject':         { title: 'Reject Claim',          endpoint: 'reject',           tone: 'bg-rose-500',    cta: 'Reject Claim' },
    'dispatch':       { title: 'Record Dispatch',       endpoint: 'dispatch-replacement', tone: 'bg-primary',  cta: 'Record Dispatch' },
    'reverse-pickup': { title: 'Initiate Reverse Pickup', endpoint: 'init-reverse-pickup', tone: 'bg-primary',  cta: 'Confirm' },
  }[action];

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = { notes: notes.trim() || null, ...extra };
      // Required field validation
      if (action === 'request-info' && (!notes || notes.trim().length < 5)) {
        toast.error('Please describe what information you need'); setSubmitting(false); return;
      }
      if (action === 'reject' && (!extra.rejection_reason || extra.rejection_reason.trim().length < 5)) {
        toast.error('Rejection reason is required'); setSubmitting(false); return;
      }
      await axios.post(
        `${API}/admin/warranty-claims/${claim.id}/${config.endpoint}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(`${config.title} — done`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">{config.title} — {claim.claim_number}</DialogTitle>
        </DialogHeader>

        {action === 'approve' && (
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Resolution Type *</label>
            <Select value={extra.resolution_type || 'replacement'} onValueChange={(v) => setExtra(e => ({ ...e, resolution_type: v }))}>
              <SelectTrigger className="mt-1 bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="replacement" className="text-foreground">Replacement</SelectItem>
                <SelectItem value="repair" className="text-foreground">Repair</SelectItem>
                <SelectItem value="credit_note" className="text-foreground">Credit Note</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {action === 'reject' && (
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Rejection Reason * (customer will see this)</label>
            <Textarea
              value={extra.rejection_reason || ''}
              onChange={(e) => setExtra(ex => ({ ...ex, rejection_reason: e.target.value }))}
              placeholder="Physical damage from mishandling — outside warranty terms."
              className="mt-1 bg-background border-border text-foreground min-h-[70px]"
            />
          </div>
        )}

        {action === 'dispatch' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Replacement S/N</label>
              <Input value={extra.replacement_serial || ''} onChange={(e) => setExtra(ex => ({ ...ex, replacement_serial: e.target.value }))}
                     className="mt-1 bg-background border-border text-foreground font-mono" placeholder="MG2604128" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Dispatch / AWB ID</label>
              <Input value={extra.replacement_dispatch_id || ''} onChange={(e) => setExtra(ex => ({ ...ex, replacement_dispatch_id: e.target.value }))}
                     className="mt-1 bg-background border-border text-foreground font-mono" placeholder="MG-D-20260524-00001" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Tracking ID</label>
              <Input value={extra.replacement_tracking_id || ''} onChange={(e) => setExtra(ex => ({ ...ex, replacement_tracking_id: e.target.value }))}
                     className="mt-1 bg-background border-border text-foreground font-mono" placeholder="Bigship/Delhivery tracking" />
            </div>
          </div>
        )}

        {action === 'reverse-pickup' && (
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Reverse Pickup Tracking ID</label>
            <Input value={extra.reverse_pickup_tracking_id || ''} onChange={(e) => setExtra(ex => ({ ...ex, reverse_pickup_tracking_id: e.target.value }))}
                   className="mt-1 bg-background border-border text-foreground font-mono" placeholder="Optional — leave blank if pending" />
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Notes {action === 'request-info' && '* (this is what the dealer will see)'}
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={action === 'request-info' ? 'Please share clearer photos of the front panel and the bottom of the unit.' : 'Internal notes (optional)'}
            className="mt-1 bg-background border-border text-foreground min-h-[80px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className={`${config.tone} hover:opacity-90 text-white`}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" /> {config.cta}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

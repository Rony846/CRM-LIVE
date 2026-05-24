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
import { toast } from 'sonner';
import {
  Boxes, Loader2, Search, Filter, Clock, CheckCircle2, AlertTriangle,
  XCircle, Truck, FileText, ChevronRight, Package, Send, X, RefreshCw,
  Building2, IndianRupee, ShieldAlert, Ticket, Eye,
} from 'lucide-react';

const STATUS_META = {
  submitted:  { label: 'Submitted',  tone: 'bg-sky-400/15 text-sky-400 ring-sky-400/25' },
  approved:   { label: 'Approved',   tone: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25' },
  dispatched: { label: 'Dispatched', tone: 'bg-primary/15 text-primary ring-primary/25' },
  received:   { label: 'Received',   tone: 'bg-muted text-muted-foreground' },
  rejected:   { label: 'Rejected',   tone: 'bg-rose-500/15 text-rose-400 ring-rose-500/25' },
  cancelled:  { label: 'Cancelled',  tone: 'bg-muted text-muted-foreground' },
};

const REASON_META = {
  claim:   { label: 'Warranty Claim', icon: ShieldAlert, tone: 'bg-rose-500/15 text-rose-400' },
  service: { label: 'Service',        icon: Ticket,       tone: 'bg-amber-400/15 text-amber-400' },
  buffer:  { label: 'Buffer Stock',   icon: Package,      tone: 'bg-violet-400/15 text-violet-400' },
};

const STATUS_FILTERS = [
  { id: 'all', label: 'All' }, { id: 'open', label: 'Open' },
  { id: 'submitted', label: 'New' }, { id: 'approved', label: 'Approved' },
  { id: 'dispatched', label: 'Dispatched' }, { id: 'received', label: 'Received' },
  { id: 'rejected', label: 'Rejected' },
];

export default function AdminSpareOrders() {
  const { token } = useAuth();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('open');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const query = {};
      if (filter !== 'all') query.status = filter;
      if (reasonFilter !== 'all') query.reason_type = reasonFilter;
      const resp = await axios.get(`${API}/admin/spare-orders`, {
        headers: { Authorization: `Bearer ${token}` }, params: query,
      });
      setOrders(resp.data.orders || []);
      setStats(resp.data.stats || {});
    } catch (err) {
      console.error(err);
      toast.error('Failed to load spare orders');
    } finally {
      setLoading(false);
    }
  }, [token, filter, reasonFilter]);

  useEffect(() => { if (token) fetchOrders(); }, [token, fetchOrders]);
  useEffect(() => {
    const id = params.get('id');
    if (id && orders.length && !selected) {
      const f = orders.find(o => o.id === id);
      if (f) setSelected(f);
    }
  }, [params, orders, selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.trim().toLowerCase();
    return orders.filter(o =>
      (o.order_number || '').toLowerCase().includes(q) ||
      (o.dealer_name || '').toLowerCase().includes(q) ||
      (o.claim_number || '').toLowerCase().includes(q) ||
      (o.items || []).some(it => (it.name || '').toLowerCase().includes(q) || (it.part_code || '').toLowerCase().includes(q))
    );
  }, [orders, search]);

  const slaBadge = (o) => {
    if (!o.created_at) return null;
    const ageDays = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 86400000);
    const open = !['received', 'rejected', 'cancelled'].includes(o.status);
    if (!open) return null;
    if (ageDays >= 5) return <Badge className="bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25 font-mono text-[10px] uppercase"><AlertTriangle className="w-3 h-3 mr-1" /> Breached · {ageDays}d</Badge>;
    if (ageDays >= 3) return <Badge className="bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25 font-mono text-[10px] uppercase">Urgent · {ageDays}d</Badge>;
    return <Badge className="bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25 font-mono text-[10px] uppercase">Fresh · {ageDays}d</Badge>;
  };

  return (
    <DashboardLayout title="Spare Parts Orders">
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={Boxes}        label="Total"      value={stats.total}      tone="text-primary bg-primary/15" />
          <StatCard icon={Clock}        label="Open"       value={stats.open}       tone="text-sky-400 bg-sky-400/15" />
          <StatCard icon={FileText}     label="New"        value={stats.submitted}  tone="text-violet-400 bg-violet-400/15" />
          <StatCard icon={CheckCircle2} label="Approved"   value={stats.approved}   tone="text-emerald-400 bg-emerald-500/15" />
          <StatCard icon={Truck}        label="Dispatched" value={stats.dispatched} tone="text-primary bg-primary/15" />
        </div>

        <Card className="mg-card border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search order, dealer, claim, part…" value={search} onChange={(e) => setSearch(e.target.value)}
                       className="pl-9 bg-background border-border text-foreground" />
              </div>
              <Button size="sm" variant="outline" onClick={fetchOrders} className="border-border">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
              {STATUS_FILTERS.map(f => (
                <FilterChip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</FilterChip>
              ))}
              <div className="border-l border-border mx-2 h-5" />
              <FilterChip active={reasonFilter === 'all'} onClick={() => setReasonFilter('all')}>All Reasons</FilterChip>
              {Object.entries(REASON_META).map(([id, m]) => (
                <FilterChip key={id} active={reasonFilter === id} onClick={() => setReasonFilter(id)}>{m.label}</FilterChip>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mg-card border-border">
          <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Boxes className="w-4 h-4 text-primary" />
              {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'order' : 'orders'}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading && orders.length === 0 ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">SLA</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Order</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Reason</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Dealer</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Items</th>
                    <th className="text-right px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Total</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No orders match.</td></tr>
                  )}
                  {filtered.map(o => {
                    const sm = STATUS_META[o.status] || STATUS_META.submitted;
                    const rm = REASON_META[o.reason_type] || REASON_META.buffer;
                    const RIcon = rm.icon;
                    return (
                      <tr key={o.id} className="border-b border-border/40 hover:bg-accent/40 cursor-pointer" onClick={() => setSelected(o)}>
                        <td className="px-4 py-3 align-top">{slaBadge(o)}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-mono text-foreground font-semibold">{o.order_number}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{o.created_at?.slice(0, 10)}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge className={`${rm.tone} ring-1 ring-current/25 font-mono text-[10px] uppercase`}>
                            <RIcon className="w-3 h-3 mr-1" />{rm.label}
                          </Badge>
                          {o.claim_number && <div className="font-mono text-xs text-muted-foreground mt-0.5">{o.claim_number}</div>}
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-foreground">{o.dealer_name}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="text-xs text-foreground">{(o.items || []).length} item(s)</div>
                          <div className="text-xs text-muted-foreground mt-0.5 max-w-[240px] truncate">
                            {(o.items || []).map(it => `${it.qty}× ${it.name}`).join(', ')}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <div className="text-sm font-mono text-foreground inline-flex items-center">
                            <IndianRupee className="w-3 h-3" />{Number(o.subtotal || 0).toLocaleString()}
                          </div>
                          {o.freight_borne_by === 'musclegrid' && (
                            <div className="text-[10px] text-emerald-400 font-mono uppercase mt-0.5">Free freight</div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge className={`${sm.tone} font-mono text-[10px] uppercase`}>{sm.label}</Badge>
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

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-popover border-l border-border overflow-y-auto p-0">
          {selected && (
            <OrderDetail order={selected} token={token} onClose={() => setSelected(null)}
                          onAction={() => { fetchOrders(); setSelected(null); }} />
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

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-md transition-colors font-mono uppercase tracking-wide
        ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
      {children}
    </button>
  );
}

function OrderDetail({ order, token, onClose, onAction }) {
  const sm = STATUS_META[order.status] || STATUS_META.submitted;
  const rm = REASON_META[order.reason_type] || REASON_META.buffer;
  const [actionDialog, setActionDialog] = useState(null);

  return (
    <div>
      <SheetHeader className="px-6 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <SheetTitle className="text-foreground">
            <div className="font-mono text-base">{order.order_number}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className={`${sm.tone} font-mono text-[10px] uppercase`}>{sm.label}</Badge>
              <Badge className={`${rm.tone} ring-1 ring-current/25 font-mono text-[10px] uppercase`}>{rm.label}</Badge>
              {order.freight_borne_by === 'musclegrid' && (
                <Badge className="bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25 font-mono text-[10px] uppercase">
                  Free Freight
                </Badge>
              )}
            </div>
          </SheetTitle>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
      </SheetHeader>

      <div className="px-6 py-5 space-y-5">
        <Card className="border-primary/20 bg-primary/[0.04]">
          <CardContent className="p-3 flex flex-wrap gap-2">
            {order.status === 'submitted' && (
              <>
                <Button size="sm" onClick={() => setActionDialog('approve')} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve
                </Button>
                <Button size="sm" onClick={() => setActionDialog('reject')} className="bg-rose-500 hover:bg-rose-600 text-white">
                  <XCircle className="w-4 h-4 mr-1.5" /> Reject
                </Button>
              </>
            )}
            {order.status === 'approved' && (
              <Button size="sm" onClick={() => setActionDialog('dispatch')} className="bg-primary text-primary-foreground">
                <Truck className="w-4 h-4 mr-1.5" /> Mark Dispatched
              </Button>
            )}
            {['received', 'rejected', 'cancelled'].includes(order.status) && (
              <span className="text-sm text-muted-foreground italic">Order is closed — no further actions.</span>
            )}
            {order.status === 'dispatched' && (
              <span className="text-sm text-muted-foreground italic">Waiting for dealer to confirm receipt.</span>
            )}
          </CardContent>
        </Card>

        <Section title="Order Info">
          <Row label="Dealer" value={order.dealer_name} />
          <Row label="Reason" value={`${rm.label}${order.claim_number ? ' · ' + order.claim_number : ''}`} />
          <Row label="Freight" value={order.freight_borne_by === 'musclegrid' ? "MuscleGrid (free)" : "Dealer's account"} />
          <Row label="Filed" value={order.created_at?.slice(0, 19).replace('T', ' ')} mono />
          <Row label="SLA Due" value={order.sla_due_at?.slice(0, 10) || '—'} mono />
        </Section>

        <Section title={`Items (${(order.items || []).length})`}>
          <div className="space-y-2">
            {(order.items || []).map((it, i) => (
              <div key={i} className="flex items-center gap-3 border border-border/60 rounded-md p-3 bg-muted/20">
                <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {it.image_url ? <img src={it.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-foreground font-medium text-sm truncate">{it.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{it.part_code}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono text-foreground">{it.qty} × ₹{Number(it.unit_price).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground font-mono">₹{Number(it.line_total).toLocaleString()}</div>
                </div>
              </div>
            ))}
            <div className="flex justify-end pt-2 border-t border-border">
              <div className="text-right">
                <div className="text-xs text-muted-foreground font-mono uppercase">Subtotal</div>
                <div className="text-lg font-semibold text-foreground font-mono">₹{Number(order.subtotal || 0).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </Section>

        {(order.tracking_id || order.dispatched_at) && (
          <Section title="Dispatch Details">
            <Row label="Tracking" value={order.tracking_id || '—'} mono />
            <Row label="Dispatched" value={order.dispatched_at?.slice(0, 19).replace('T', ' ')} mono />
          </Section>
        )}

        {order.rejection_reason && (
          <Section title="Rejection Reason">
            <div className="text-sm text-foreground/85 bg-rose-500/[0.06] border border-rose-500/30 rounded-md p-3">{order.rejection_reason}</div>
          </Section>
        )}

        <Section title={`Status History (${(order.status_history || []).length})`}>
          <div className="space-y-2">
            {(order.status_history || []).map((h, i) => {
              const hm = STATUS_META[h.status] || STATUS_META.submitted;
              return (
                <div key={i} className="flex gap-3 p-3 rounded-md bg-muted/20 border border-border/60">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${hm.tone.split(' ')[0]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${hm.tone} font-mono text-[10px] uppercase`}>{hm.label}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{h.at?.slice(0, 19).replace('T', ' ')}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">by {h.by_name || h.by_role}</div>
                    {h.notes && <div className="text-sm text-foreground/85 mt-2 whitespace-pre-wrap">{h.notes}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      <ActionDialog action={actionDialog} order={order} token={token}
                    onClose={() => setActionDialog(null)}
                    onDone={() => { setActionDialog(null); onAction(); }} />
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

function ActionDialog({ action, order, token, onClose, onDone }) {
  const [extra, setExtra] = useState({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { setExtra({}); setNotes(''); }, [action]);
  if (!action) return null;

  const cfg = {
    approve:  { title: 'Approve Order',  endpoint: 'approve',  cta: 'Approve',   tone: 'bg-emerald-500' },
    reject:   { title: 'Reject Order',   endpoint: 'reject',   cta: 'Reject',    tone: 'bg-rose-500' },
    dispatch: { title: 'Mark Dispatched', endpoint: 'dispatch', cta: 'Dispatch', tone: 'bg-primary' },
  }[action];

  const submit = async () => {
    if (action === 'reject' && (!extra.rejection_reason || extra.rejection_reason.trim().length < 5)) {
      toast.error('Rejection reason required'); return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/admin/spare-orders/${order.id}/${cfg.endpoint}`,
        { ...extra, notes: notes.trim() || null },
        { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`${cfg.title} — done`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{cfg.title} — {order.order_number}</DialogTitle>
        </DialogHeader>
        {action === 'reject' && (
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Reason * (dealer will see this)</label>
            <Textarea value={extra.rejection_reason || ''} onChange={(e) => setExtra(x => ({ ...x, rejection_reason: e.target.value }))}
                      className="mt-1 bg-background border-border text-foreground min-h-[70px]"
                      placeholder="Part no longer manufactured — recommend equivalent SKU…" />
          </div>
        )}
        {action === 'dispatch' && (
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Tracking ID</label>
            <Input value={extra.tracking_id || ''} onChange={(e) => setExtra(x => ({ ...x, tracking_id: e.target.value }))}
                   className="mt-1 bg-background border-border text-foreground font-mono" placeholder="BS-1234567890" />
            <div className="text-xs text-muted-foreground mt-2">Dispatch will auto-decrement stock for each item.</div>
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Notes</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 bg-background border-border text-foreground min-h-[60px]"
                    placeholder="Internal notes (optional)" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className={`${cfg.tone} hover:opacity-90 text-white`}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" /> {cfg.cta}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

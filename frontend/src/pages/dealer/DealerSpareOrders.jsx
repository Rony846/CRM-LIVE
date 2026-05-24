import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  Boxes, Loader2, Wrench, Clock, CheckCircle2, XCircle, Truck, Package,
  ChevronRight, X, ShieldAlert, Ticket, IndianRupee, Filter, RefreshCw,
} from 'lucide-react';

const STATUS_META = {
  submitted:  { label: 'Submitted',  tone: 'bg-sky-400/15 text-sky-400 ring-sky-400/25',           icon: Clock },
  approved:   { label: 'Approved',   tone: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25', icon: CheckCircle2 },
  dispatched: { label: 'Dispatched', tone: 'bg-primary/15 text-primary ring-primary/25',           icon: Truck },
  received:   { label: 'Received',   tone: 'bg-muted text-muted-foreground',                       icon: CheckCircle2 },
  rejected:   { label: 'Rejected',   tone: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',        icon: XCircle },
  cancelled:  { label: 'Cancelled',  tone: 'bg-muted text-muted-foreground',                       icon: XCircle },
};

const REASON_META = {
  claim:   { label: 'Warranty Claim', icon: ShieldAlert, tone: 'bg-rose-500/15 text-rose-400' },
  service: { label: 'Service',        icon: Ticket,       tone: 'bg-amber-400/15 text-amber-400' },
  buffer:  { label: 'Buffer Stock',   icon: Package,      tone: 'bg-violet-400/15 text-violet-400' },
};

const FILTERS = [
  { id: 'all', label: 'All' }, { id: 'open', label: 'Open' },
  { id: 'dispatched', label: 'Dispatched' }, { id: 'closed', label: 'Closed' },
];

export default function DealerSpareOrders() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await axios.get(`${API}/dealer/spare-orders`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filter === 'all' ? {} : { status: filter },
      });
      setOrders(resp.data.orders || []);
      setStats(resp.data.stats || {});
    } catch (err) {
      console.error(err);
      toast.error('Failed to load spare orders');
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => { if (token) fetchOrders(); }, [token, fetchOrders]);
  useEffect(() => {
    const id = params.get('id');
    if (id && orders.length && !selected) {
      const f = orders.find(o => o.id === id);
      if (f) setSelected(f);
    }
  }, [params, orders, selected]);

  const confirmReceived = async (id) => {
    if (!window.confirm('Confirm the spare parts have been received?')) return;
    try {
      await axios.post(`${API}/dealer/spare-orders/${id}/confirm-received`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Order closed — thank you!');
      fetchOrders();
      setSelected(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to confirm');
    }
  };

  return (
    <DashboardLayout title="Spare Parts Orders">
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Boxes}        label="Total"      value={stats.total}      tone="text-primary bg-primary/15" />
          <StatCard icon={Clock}        label="Open"       value={stats.open}       tone="text-sky-400 bg-sky-400/15" />
          <StatCard icon={Truck}        label="Dispatched" value={stats.dispatched} tone="text-primary bg-primary/15" />
          <StatCard icon={CheckCircle2} label="Closed (30d)" value={stats.closed_30d} tone="text-emerald-400 bg-emerald-500/15" />
        </div>

        <Card className="mg-card border-border">
          <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex items-center gap-1 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors font-mono uppercase tracking-wide
                    ${filter === f.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={fetchOrders} className="border-border">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
              </Button>
              <Button onClick={() => navigate('/dealer/spare-parts')} className="bg-primary text-primary-foreground">
                <Wrench className="w-4 h-4 mr-1.5" /> Browse Catalog
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mg-card border-border">
          <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Boxes className="w-4 h-4 text-primary" />
              {loading ? 'Loading…' : `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading && orders.length === 0 ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : orders.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Boxes className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-foreground mb-1">No spare orders yet</p>
                <p className="text-sm">Browse the catalog and place your first order for service or buffer stock.</p>
                <Button onClick={() => navigate('/dealer/spare-parts')} className="mt-4 bg-primary text-primary-foreground">
                  <Wrench className="w-4 h-4 mr-1.5" /> Browse Catalog
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {orders.map(o => (
                  <OrderRow key={o.id} o={o} onClick={() => setSelected(o)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-popover border-l border-border overflow-y-auto p-0">
          {selected && (
            <OrderDetail order={selected} onClose={() => setSelected(null)}
                          onConfirmReceived={confirmReceived} />
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

function OrderRow({ o, onClick }) {
  const sm = STATUS_META[o.status] || STATUS_META.submitted;
  const rm = REASON_META[o.reason_type] || REASON_META.buffer;
  const RIcon = rm.icon;
  const SIcon = sm.icon;
  return (
    <button onClick={onClick} className="w-full text-left p-4 hover:bg-accent/40 transition-colors flex items-center gap-4 group">
      <div className={`p-2.5 rounded-lg ring-1 ${sm.tone} flex-shrink-0`}>
        <SIcon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-foreground font-semibold">{o.order_number}</span>
          <Badge className={`${sm.tone} font-mono text-[10px] uppercase`}>{sm.label}</Badge>
          <Badge className={`${rm.tone} ring-1 ring-current/25 font-mono text-[10px] uppercase`}>
            <RIcon className="w-3 h-3 mr-1" />{rm.label}
          </Badge>
          {o.freight_borne_by === 'musclegrid' && (
            <Badge className="bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25 font-mono text-[10px] uppercase">Free freight</Badge>
          )}
        </div>
        <div className="text-sm text-foreground mt-1 truncate">
          {(o.items || []).map(it => `${it.qty}× ${it.name}`).join(', ')}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
          {o.claim_number && <span className="font-mono">{o.claim_number}</span>}
          <span className="font-mono inline-flex items-center"><IndianRupee className="w-3 h-3" />{Number(o.subtotal || 0).toLocaleString()}</span>
          <span>{o.created_at?.slice(0, 10)}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
    </button>
  );
}

function OrderDetail({ order, onClose, onConfirmReceived }) {
  const sm = STATUS_META[order.status] || STATUS_META.submitted;
  const rm = REASON_META[order.reason_type] || REASON_META.buffer;

  return (
    <div>
      <SheetHeader className="px-6 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <SheetTitle className="text-foreground">
            <div className="font-mono text-base">{order.order_number}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className={`${sm.tone} font-mono text-[10px] uppercase`}>{sm.label}</Badge>
              <Badge className={`${rm.tone} ring-1 ring-current/25 font-mono text-[10px] uppercase`}>{rm.label}</Badge>
            </div>
          </SheetTitle>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
      </SheetHeader>

      <div className="px-6 py-5 space-y-5">
        {order.status === 'dispatched' && (
          <Card className="border-primary/30 bg-primary/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <Truck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-foreground">Spare parts dispatched</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {order.tracking_id ? <>Tracking: <span className="font-mono text-foreground">{order.tracking_id}</span></> : 'Tracking will share separately'}
                  </div>
                </div>
              </div>
              <Button onClick={() => onConfirmReceived(order.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm Received
              </Button>
            </CardContent>
          </Card>
        )}

        {order.rejection_reason && (
          <Card className="border-rose-500/30 bg-rose-500/[0.06]">
            <CardContent className="p-4">
              <div className="font-medium text-foreground mb-1">Rejected</div>
              <div className="text-sm text-foreground/85">{order.rejection_reason}</div>
            </CardContent>
          </Card>
        )}

        <Section title="Order Info">
          <Row label="Reason" value={`${rm.label}${order.claim_number ? ' · ' + order.claim_number : ''}`} />
          <Row label="Freight" value={order.freight_borne_by === 'musclegrid' ? "MuscleGrid (free)" : "Your account"} />
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

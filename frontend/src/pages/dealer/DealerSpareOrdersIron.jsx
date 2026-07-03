import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  Boxes, Loader2, Wrench, Clock, CheckCircle2, XCircle, Truck, Package,
  ChevronRight, X, ShieldAlert, Ticket, Filter,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

// Spare-order status -> label + icon + Iron pill tone.
const STATUS_META = {
  submitted:  { label: 'Submitted',  tone: 'info',   icon: Clock },
  approved:   { label: 'Approved',   tone: 'ok',     icon: CheckCircle2 },
  dispatched: { label: 'Dispatched', tone: 'bad',    icon: Truck },
  received:   { label: 'Received',   tone: 'slate',  icon: CheckCircle2 },
  rejected:   { label: 'Rejected',   tone: 'bad',    icon: XCircle },
  cancelled:  { label: 'Cancelled',  tone: 'slate',  icon: XCircle },
};

const REASON_META = {
  claim:   { label: 'Warranty Claim', tone: 'bad',    icon: ShieldAlert },
  service: { label: 'Service',        tone: 'warn',   icon: Ticket },
  buffer:  { label: 'Buffer Stock',   tone: 'violet', icon: Package },
};

const FILTERS = [
  { id: 'all', label: 'All' }, { id: 'open', label: 'Open' },
  { id: 'dispatched', label: 'Dispatched' }, { id: 'closed', label: 'Closed' },
];

const inr = (n) => Number(n || 0).toLocaleString('en-IN');

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

  const statCards = [
    { label: 'Total',        value: stats.total,      icon: Boxes,        tone: T.orange },
    { label: 'Open',         value: stats.open,       icon: Clock,        tone: T.blue },
    { label: 'Dispatched',   value: stats.dispatched, icon: Truck,        tone: T.orangeDeep },
    { label: 'Closed (30d)', value: stats.closed_30d, icon: CheckCircle2, tone: T.green },
  ];

  const browseBtn = (
    <button onClick={() => navigate('/dealer/spare-parts')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
      <Wrench size={14} strokeWidth={2} /> Browse Catalog
    </button>
  );

  return (
    <IronShell title="Spare Orders" subtitle="DEALER · SPARE PARTS ORDERS" onRefresh={fetchOrders} headerRight={browseBtn}>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <IronCard key={s.label} pad={14}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                  <Icon size={18} color={s.tone} strokeWidth={1.9} />
                </div>
                <div>
                  <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{Number(s.value || 0).toLocaleString('en-IN')}</div>
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                </div>
              </div>
            </IronCard>
          );
        })}
      </div>

      {/* Filters + list */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Filter size={14} color={T.iron400} style={{ marginRight: 2 }} />
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  style={{ border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '6px 13px', cursor: 'pointer', fontFamily: T.mono, fontWeight: 700, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                  {f.label}
                </button>
              );
            })}
          </div>
          <Caps size={9} color={T.iron400}>{loading ? 'Loading…' : `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}</Caps>
        </div>

        {loading && orders.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: T.iron400 }}>
            <Boxes size={44} style={{ margin: '0 auto 10px', opacity: 0.35 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No spare orders yet</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Browse the catalog and place your first order for service or buffer stock.</div>
            <button onClick={() => navigate('/dealer/spare-parts')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12, marginTop: 14 }}>
              <Wrench size={14} strokeWidth={2} /> Browse Catalog
            </button>
          </div>
        ) : (
          <div>
            {orders.map((o) => (
              <OrderRow key={o.id} o={o} onClick={() => setSelected(o)} />
            ))}
          </div>
        )}
      </IronCard>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0"
          style={{ background: T.white, borderLeft: `1px solid ${T.iron200}`, color: T.iron900 }}>
          {selected && (
            <OrderDetail order={selected} onClose={() => setSelected(null)} onConfirmReceived={confirmReceived} />
          )}
        </SheetContent>
      </Sheet>
    </IronShell>
  );
}

function OrderRow({ o, onClick }) {
  const sm = STATUS_META[o.status] || STATUS_META.submitted;
  const rm = REASON_META[o.reason_type] || REASON_META.buffer;
  const RIcon = rm.icon;
  const SIcon = sm.icon;
  return (
    <button onClick={onClick} className="iron-row"
      style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: 'none', borderBottom: `1px solid ${T.iron200}`, background: 'transparent', cursor: 'pointer' }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, background: T.iron50, border: `1px solid ${T.iron200}` }}>
        <SIcon size={18} color={T.iron700} strokeWidth={1.9} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...mono, fontWeight: 700, fontSize: 12.5, color: T.orangeDeep }}>{o.order_number}</span>
          <span style={badgeStyle(sm.tone)}>{sm.label}</span>
          <span style={{ ...badgeStyle(rm.tone), display: 'inline-flex', alignItems: 'center', gap: 3 }}><RIcon size={10} />{rm.label}</span>
          {o.freight_borne_by === 'musclegrid' && <span style={badgeStyle('ok')}>Free freight</span>}
        </div>
        <div style={{ fontSize: 12.5, color: T.iron900, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(o.items || []).map(it => `${it.qty}× ${it.name}`).join(', ')}
        </div>
        <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 3, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {o.claim_number && <span>{o.claim_number}</span>}
          <span>₹{inr(o.subtotal)}</span>
          <span>{o.created_at?.slice(0, 10)}</span>
        </div>
      </div>
      <ChevronRight size={16} color={T.iron400} style={{ flexShrink: 0 }} />
    </button>
  );
}

function OrderDetail({ order, onClose, onConfirmReceived }) {
  const sm = STATUS_META[order.status] || STATUS_META.submitted;
  const rm = REASON_META[order.reason_type] || REASON_META.buffer;

  return (
    <div>
      <SheetHeader className="p-0">
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <SheetTitle asChild>
            <div>
              <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: T.iron900 }}>{order.order_number}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={badgeStyle(sm.tone)}>{sm.label}</span>
                <span style={badgeStyle(rm.tone)}>{rm.label}</span>
              </div>
            </div>
          </SheetTitle>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.iron500, padding: 4 }}><X size={18} /></button>
        </div>
      </SheetHeader>

      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {order.status === 'dispatched' && (
          <div style={{ border: `1px solid ${T.orange}`, background: '#FEF6F1', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <Truck size={20} color={T.orangeDeep} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>Spare parts dispatched</div>
                <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 4 }}>
                  {order.tracking_id ? <>Tracking: <span style={{ ...mono, color: T.iron900 }}>{order.tracking_id}</span></> : 'Tracking will share separately'}
                </div>
              </div>
            </div>
            <button onClick={() => onConfirmReceived(order.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.green, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
              <CheckCircle2 size={15} /> Confirm Received
            </button>
          </div>
        )}

        {order.rejection_reason && (
          <div style={{ border: `1px solid #F6D8BA`, background: '#FDEEE6', borderRadius: 8, padding: 16 }}>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.orangeDeep, marginBottom: 4 }}>Rejected</div>
            <div style={{ fontSize: 12.5, color: T.iron700 }}>{order.rejection_reason}</div>
          </div>
        )}

        <Section title="Order Info">
          <Row label="Reason" value={`${rm.label}${order.claim_number ? ' · ' + order.claim_number : ''}`} />
          <Row label="Freight" value={order.freight_borne_by === 'musclegrid' ? 'MuscleGrid (free)' : 'Your account'} />
          <Row label="Filed" value={order.created_at?.slice(0, 19).replace('T', ' ')} mono />
          <Row label="SLA Due" value={order.sla_due_at?.slice(0, 10) || '—'} mono />
        </Section>

        <Section title={`Items (${(order.items || []).length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(order.items || []).map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 12, background: T.iron50 }}>
                <div style={{ width: 46, height: 46, borderRadius: 8, background: T.iron100, display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {it.image_url ? <img src={it.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={18} color={T.iron400} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                  <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{it.part_code}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...mono, fontSize: 12, color: T.iron900 }}>{it.qty} × ₹{inr(it.unit_price)}</div>
                  <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>₹{inr(it.line_total)}</div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: `1px solid ${T.iron200}` }}>
              <div style={{ textAlign: 'right' }}>
                <Caps size={9} color={T.iron400}>Subtotal</Caps>
                <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: T.iron900, marginTop: 2 }}>₹{inr(order.subtotal)}</div>
              </div>
            </div>
          </div>
        </Section>

        <Section title={`Status History (${(order.status_history || []).length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(order.status_history || []).map((h, i) => {
              const hm = STATUS_META[h.status] || STATUS_META.submitted;
              return (
                <div key={i} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: 999, marginTop: 6, flexShrink: 0, background: T.orange }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={badgeStyle(hm.tone)}>{hm.label}</span>
                      <span style={{ ...mono, fontSize: 10.5, color: T.iron500 }}>{h.at?.slice(0, 19).replace('T', ' ')}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.iron400, marginTop: 3 }}>by {h.by_name || h.by_role}</div>
                    {h.notes && <div style={{ fontSize: 12.5, color: T.iron700, marginTop: 6, whiteSpace: 'pre-wrap' }}>{h.notes}</div>}
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
      <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>{title}</Caps>
      {children}
    </div>
  );
}

function Row({ label, value, mono: isMono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', fontSize: 12.5 }}>
      <span style={{ color: T.iron500, width: 120, flexShrink: 0, fontSize: 11 }}>{label}</span>
      <span style={{ color: T.iron900, flex: 1, ...(isMono ? mono : {}) }}>{value || '—'}</span>
    </div>
  );
}

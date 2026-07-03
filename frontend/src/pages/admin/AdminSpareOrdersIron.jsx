import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Boxes, Loader2, Search, Filter, Clock, CheckCircle2, AlertTriangle,
  XCircle, Truck, FileText, ChevronRight, Package, Send, X,
  IndianRupee, ShieldAlert, Ticket,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

// status -> { label, tone } for Iron badgeStyle
const STATUS_META = {
  submitted:  { label: 'Submitted',  tone: 'info' },
  approved:   { label: 'Approved',   tone: 'ok' },
  dispatched: { label: 'Dispatched', tone: 'warn' },
  received:   { label: 'Received',   tone: 'slate' },
  rejected:   { label: 'Rejected',   tone: 'bad' },
  cancelled:  { label: 'Cancelled',  tone: 'slate' },
};

const REASON_META = {
  claim:   { label: 'Warranty Claim', icon: ShieldAlert, tone: 'bad' },
  service: { label: 'Service',        icon: Ticket,       tone: 'warn' },
  buffer:  { label: 'Buffer Stock',   icon: Package,      tone: 'violet' },
};

const STATUS_FILTERS = [
  { id: 'all', label: 'All' }, { id: 'open', label: 'Open' },
  { id: 'submitted', label: 'New' }, { id: 'approved', label: 'Approved' },
  { id: 'dispatched', label: 'Dispatched' }, { id: 'received', label: 'Received' },
  { id: 'rejected', label: 'Rejected' },
];

const inr = (v) => Number(v || 0).toLocaleString('en-IN');
const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };

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
    if (ageDays >= 5) return <span style={{ ...badgeStyle('bad'), display: 'inline-flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={10} /> Breached · {ageDays}d</span>;
    if (ageDays >= 3) return <span style={badgeStyle('warn')}>Urgent · {ageDays}d</span>;
    return <span style={badgeStyle('ok')}>Fresh · {ageDays}d</span>;
  };

  const STAT_CARDS = [
    { icon: Boxes,        label: 'Total',      value: stats.total,      tone: T.orangeDeep, bg: '#FDEEE6' },
    { icon: Clock,        label: 'Open',       value: stats.open,       tone: T.blue,       bg: T.blueTint },
    { icon: FileText,     label: 'New',        value: stats.submitted,  tone: '#6D4AB0',    bg: '#EEE9F7' },
    { icon: CheckCircle2, label: 'Approved',   value: stats.approved,   tone: T.green,      bg: T.greenTint },
    { icon: Truck,        label: 'Dispatched', value: stats.dispatched, tone: T.orangeDeep, bg: '#FDEEE6' },
  ];

  return (
    <IronShell title="Spare Orders" subtitle={`${(stats.total || 0).toLocaleString('en-IN')} ORDERS · DEALER SPARE PARTS`} onRefresh={fetchOrders}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
        {STAT_CARDS.map((s) => {
          const Icon = s.icon;
          return (
            <IronCard key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: s.bg, color: s.tone, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon size={19} />
              </div>
              <div>
                <Caps size={8.5} color={T.iron400}>{s.label}</Caps>
                <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.iron900 }}>{s.value || 0}</div>
              </div>
            </IronCard>
          );
        })}
      </div>

      {/* Filter bar */}
      <IronCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 420 }}>
            <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, dealer, claim, part…"
              style={{ ...inputStyle, paddingLeft: 30 }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <Filter size={13} color={T.iron400} style={{ marginRight: 2 }} />
          {STATUS_FILTERS.map(f => (
            <FilterChip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</FilterChip>
          ))}
          <div style={{ borderLeft: `1px solid ${T.iron200}`, height: 20, margin: '0 6px' }} />
          <FilterChip active={reasonFilter === 'all'} onClick={() => setReasonFilter('all')}>All Reasons</FilterChip>
          {Object.entries(REASON_META).map(([id, m]) => (
            <FilterChip key={id} active={reasonFilter === id} onClick={() => setReasonFilter(id)}>{m.label}</FilterChip>
          ))}
        </div>
      </IronCard>

      {/* Table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          <Boxes size={15} color={T.orange} />
          <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>
            {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'order' : 'orders'}`}
          </span>
        </div>
        {loading && orders.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 220 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {['SLA', 'ORDER', 'REASON', 'DEALER', 'ITEMS', 'TOTAL', 'STATUS', ''].map((h, i) => (
                    <th key={i} style={{ ...thCell, textAlign: h === 'TOTAL' ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '50px 0', color: T.iron400, fontSize: 12.5 }}>No orders match.</td></tr>
                )}
                {filtered.map(o => {
                  const sm = STATUS_META[o.status] || STATUS_META.submitted;
                  const rm = REASON_META[o.reason_type] || REASON_META.buffer;
                  const RIcon = rm.icon;
                  return (
                    <tr key={o.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }} onClick={() => setSelected(o)}>
                      <td style={tdCell}>{slaBadge(o)}</td>
                      <td style={tdCell}>
                        <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{o.order_number}</div>
                        <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 3 }}>{o.created_at?.slice(0, 10)}</div>
                      </td>
                      <td style={tdCell}>
                        <span style={{ ...badgeStyle(rm.tone), display: 'inline-flex', alignItems: 'center', gap: 3 }}><RIcon size={10} />{rm.label}</span>
                        {o.claim_number && <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 4 }}>{o.claim_number}</div>}
                      </td>
                      <td style={{ ...tdCell, color: T.iron900, fontSize: 12.5 }}>{o.dealer_name}</td>
                      <td style={tdCell}>
                        <div style={{ fontSize: 11.5, color: T.iron900 }}>{(o.items || []).length} item(s)</div>
                        <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 2, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(o.items || []).map(it => `${it.qty}× ${it.name}`).join(', ')}
                        </div>
                      </td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        <div style={{ ...mono, fontSize: 12.5, color: T.iron900, display: 'inline-flex', alignItems: 'center' }}>
                          <IndianRupee size={11} />{inr(o.subtotal)}
                        </div>
                        {o.freight_borne_by === 'musclegrid' && (
                          <div><Caps size={8.5} color={T.green} style={{ marginTop: 3, display: 'inline-block' }}>Free freight</Caps></div>
                        )}
                      </td>
                      <td style={tdCell}><span style={badgeStyle(sm.tone)}>{sm.label}</span></td>
                      <td style={{ ...tdCell, textAlign: 'right' }}><ChevronRight size={16} color={T.iron400} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </IronCard>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0" style={{ background: T.white, borderLeft: `1px solid ${T.iron200}`, colorScheme: 'light' }}>
          {selected && (
            <OrderDetail order={selected} token={token} onClose={() => setSelected(null)}
              onAction={() => { fetchOrders(); setSelected(null); }} />
          )}
        </SheetContent>
      </Sheet>
    </IronShell>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '6px 12px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
        fontFamily: T.headline, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase',
        border: active ? 'none' : `1px solid ${T.iron200}`,
        background: active ? T.orange : T.white,
        color: active ? '#fff' : T.iron500,
      }}>
      {children}
    </button>
  );
}

function OrderDetail({ order, token, onClose, onAction }) {
  const sm = STATUS_META[order.status] || STATUS_META.submitted;
  const rm = REASON_META[order.reason_type] || REASON_META.buffer;
  const [actionDialog, setActionDialog] = useState(null);

  const btnPrimary = { border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 };

  return (
    <div>
      <SheetHeader className="p-0">
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <SheetTitle asChild>
            <div>
              <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: T.iron900 }}>{order.order_number}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={badgeStyle(sm.tone)}>{sm.label}</span>
                <span style={badgeStyle(rm.tone)}>{rm.label}</span>
                {order.freight_borne_by === 'musclegrid' && <span style={badgeStyle('ok')}>Free Freight</span>}
              </div>
            </div>
          </SheetTitle>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.iron500, padding: 4 }}><X size={16} /></button>
        </div>
      </SheetHeader>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Actions */}
        <IronCard style={{ display: 'flex', flexWrap: 'wrap', gap: 8, background: '#FDF6F0', borderColor: '#F6D8BA' }}>
          {order.status === 'submitted' && (
            <>
              <button onClick={() => setActionDialog('approve')} style={{ ...btnPrimary, background: T.green }}><CheckCircle2 size={15} /> Approve</button>
              <button onClick={() => setActionDialog('reject')} style={{ ...btnPrimary, background: T.rose }}><XCircle size={15} /> Reject</button>
            </>
          )}
          {order.status === 'approved' && (
            <button onClick={() => setActionDialog('dispatch')} style={{ ...btnPrimary, background: T.orange }}><Truck size={15} /> Mark Dispatched</button>
          )}
          {['received', 'rejected', 'cancelled'].includes(order.status) && (
            <span style={{ fontSize: 12.5, color: T.iron500, fontStyle: 'italic' }}>Order is closed — no further actions.</span>
          )}
          {order.status === 'dispatched' && (
            <span style={{ fontSize: 12.5, color: T.iron500, fontStyle: 'italic' }}>Waiting for dealer to confirm receipt.</span>
          )}
        </IronCard>

        <Section title="Order Info">
          <Row label="Dealer" value={order.dealer_name} />
          <Row label="Reason" value={`${rm.label}${order.claim_number ? ' · ' + order.claim_number : ''}`} />
          <Row label="Freight" value={order.freight_borne_by === 'musclegrid' ? "MuscleGrid (free)" : "Dealer's account"} />
          <Row label="Filed" value={order.created_at?.slice(0, 19).replace('T', ' ')} mono />
          <Row label="SLA Due" value={order.sla_due_at?.slice(0, 10) || '—'} mono />
        </Section>

        <Section title={`Items (${(order.items || []).length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(order.items || []).map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 12, background: T.iron50 }}>
                <div style={{ width: 48, height: 48, borderRadius: 6, background: T.iron100, display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {it.image_url ? <img src={it.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={19} color={T.iron400} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                  <div style={{ ...mono, fontSize: 10.5, color: T.iron500 }}>{it.part_code}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...mono, fontSize: 12.5, color: T.iron900 }}>{it.qty} × ₹{inr(it.unit_price)}</div>
                  <div style={{ ...mono, fontSize: 10.5, color: T.iron500 }}>₹{inr(it.line_total)}</div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: `1px solid ${T.iron200}` }}>
              <div style={{ textAlign: 'right' }}>
                <Caps size={8.5} color={T.iron400}>Subtotal</Caps>
                <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: T.iron900 }}>₹{inr(order.subtotal)}</div>
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
            <div style={{ fontSize: 12.5, color: T.iron900, background: '#FDEEE6', border: `1px solid #F6D8BA`, borderRadius: 8, padding: 12 }}>{order.rejection_reason}</div>
          </Section>
        )}

        <Section title={`Status History (${(order.status_history || []).length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(order.status_history || []).map((h, i) => {
              const hm = STATUS_META[h.status] || STATUS_META.submitted;
              return (
                <div key={i} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={badgeStyle(hm.tone)}>{hm.label}</span>
                      <span style={{ ...mono, fontSize: 10.5, color: T.iron500 }}>{h.at?.slice(0, 19).replace('T', ' ')}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 3 }}>by {h.by_name || h.by_role}</div>
                    {h.notes && <div style={{ fontSize: 12.5, color: T.iron700, marginTop: 6, whiteSpace: 'pre-wrap' }}>{h.notes}</div>}
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
      <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>{title}</Caps>
      {children}
    </div>
  );
}

function Row({ label, value, mono: isMono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0', fontSize: 12.5 }}>
      <span style={{ color: T.iron400, width: 128, fontSize: 11, flexShrink: 0 }}>{label}</span>
      <span style={{ color: T.iron900, flex: 1, ...(isMono ? mono : {}) }}>{value || '—'}</span>
    </div>
  );
}

function ActionDialog({ action, order, token, onClose, onDone }) {
  const [extra, setExtra] = useState({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { setExtra({}); setNotes(''); }, [action]);

  const cfg = {
    approve:  { title: 'Approve Order',   endpoint: 'approve',  cta: 'Approve',  bg: T.green },
    reject:   { title: 'Reject Order',    endpoint: 'reject',   cta: 'Reject',   bg: T.rose },
    dispatch: { title: 'Mark Dispatched', endpoint: 'dispatch', cta: 'Dispatch', bg: T.orange },
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

  if (!action || !cfg) return null;

  const lbl = { display: 'block', fontFamily: T.headline, fontWeight: 700, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: T.iron400, marginBottom: 5 };
  const field = { ...inputStyle };

  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" style={{ background: T.white, border: `1px solid ${T.iron200}`, colorScheme: 'light' }}>
        <DialogHeader>
          <DialogTitle asChild>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>{cfg.title} — {order.order_number}</div>
          </DialogTitle>
        </DialogHeader>
        {action === 'reject' && (
          <div>
            <label style={lbl}>Reason * (dealer will see this)</label>
            <textarea value={extra.rejection_reason || ''} onChange={(e) => setExtra(x => ({ ...x, rejection_reason: e.target.value }))}
              style={{ ...field, minHeight: 70, resize: 'vertical' }}
              placeholder="Part no longer manufactured — recommend equivalent SKU…" />
          </div>
        )}
        {action === 'dispatch' && (
          <div>
            <label style={lbl}>Tracking ID</label>
            <input value={extra.tracking_id || ''} onChange={(e) => setExtra(x => ({ ...x, tracking_id: e.target.value }))}
              style={{ ...field, ...mono }} placeholder="BS-1234567890" />
            <div style={{ fontSize: 11, color: T.iron500, marginTop: 8 }}>Dispatch will auto-decrement stock for each item.</div>
          </div>
        )}
        <div>
          <label style={lbl}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            style={{ ...field, minHeight: 60, resize: 'vertical' }} placeholder="Internal notes (optional)" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
          <button onClick={onClose} style={{ border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12 }}>Cancel</button>
          <button onClick={submit} disabled={submitting}
            style={{ border: 'none', background: cfg.bg, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: T.headline, fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {submitting ? <Loader2 className="animate-spin" size={15} /> : <><Send size={14} /> {cfg.cta}</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ComplianceAlertBanner from '@/components/compliance/ComplianceAlertBanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  BarChart3, Factory, Boxes, IndianRupee, TrendingUp, Package, Headphones,
  AlertTriangle, Shield, ArrowRight, CheckCircle, Clock, Calendar, RefreshCw,
  Activity, Loader2,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import './AdminDashboard.css';

const ACCENT = '#38bdf8';

/* ---------- formatting ---------- */
const fmtINR = (n) => {
  n = Number(n) || 0;
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(2)} L`;
  return `${sign}₹${a.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
const fmtCount = (n) => (Number(n) || 0).toLocaleString('en-IN');
const fmtK = (v) => {
  v = Number(v) || 0;
  if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}k`;
  return `${v}`;
};

/* ---------- count-up (rAF + timer fallback so it never sticks at 0) ---------- */
function useCountUp(target, duration = 1000) {
  const [val, setVal] = useState(target);
  useEffect(() => {
    let raf, start, done = false;
    setVal(0);
    const finish = () => { if (!done) { done = true; setVal(target); } };
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick); else finish();
    };
    raf = requestAnimationFrame(tick);
    const fb = setTimeout(finish, duration + 400);
    return () => { cancelAnimationFrame(raf); clearTimeout(fb); };
  }, [target, duration]);
  return val;
}

const Brackets = () => (
  <><span className="cd-br tl" /><span className="cd-br tr" /><span className="cd-br bl" /><span className="cd-br br" /></>
);

/* ---------- KPI card ---------- */
function KpiCard({ label, rawValue, format, value, delta, deltaTone = 'neutral', sub, icon: Icon }) {
  const counted = useCountUp(rawValue != null ? rawValue : 0);
  const display = rawValue != null ? (format ? format(counted) : Math.round(counted).toLocaleString('en-IN')) : value;
  return (
    <div className="cd-panel cd-kpi cd-in">
      <Brackets />
      <div className="cd-kpitop">
        <span className="cd-kpilabel">{label}</span>
        <span className="cd-kpiico"><Icon size={16} /></span>
      </div>
      <div className="cd-kpival">{display}</div>
      <div className="cd-kpifoot">
        {delta && <span className={`cd-delta ${deltaTone}`}>{delta}</span>}
        {sub && <span className="cd-kpisub">{sub}</span>}
      </div>
    </div>
  );
}

/* ---------- revenue chart tooltip ---------- */
const RevTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#0a1120', border: '1px solid rgba(56,189,248,0.4)', borderRadius: 6, padding: '6px 10px', fontFamily: 'var(--cd-mono)', fontSize: 12 }}>
      <div style={{ color: '#8ea3c4', fontSize: 10 }}>{label}</div>
      <div style={{ color: '#fff' }}>{fmtINR(payload[0].value)}</div>
    </div>
  );
};

/* ---------- mini stat card (Inventory / Payables tabs) ---------- */
function MiniStat({ label, value, icon: Icon }) {
  return (
    <div className="cd-panel cd-kpi cd-in" style={{ padding: 16 }}>
      <Brackets />
      <div className="cd-kpitop">
        <span className="cd-kpilabel">{label}</span>
        <span className="cd-kpiico"><Icon size={16} /></span>
      </div>
      <div className="cd-kpival" style={{ fontSize: 24, marginTop: 12 }}>{value}</div>
    </div>
  );
}

/* ===================== Executive Overview ===================== */
function ExecutiveOverview({ data, onRefresh }) {
  if (!data) {
    return (
      <div>
        <div className="cd-skel" style={{ height: 40, width: 280, marginBottom: 24 }} />
        <div className="cd-kpigrid">{[0, 1, 2, 3].map((i) => <div key={i} className="cd-skel" style={{ height: 132 }} />)}</div>
        <div className="cd-split"><div className="cd-skel" style={{ height: 360 }} /><div className="cd-skel" style={{ height: 360 }} /></div>
      </div>
    );
  }

  const rev = data.revenue || {}, sup = data.support || {}, sal = data.sales || {}, stk = data.stock || {}, ai = data.action_items || {};
  const delta = rev.delta_pct;
  const slaPct = sup.sla_pct ?? 0;
  const lowCount = stk.low_count ?? 0;
  const trend = (rev.trend_30d || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    value: d.value || 0,
  }));

  const alerts = [];
  if ((ai.sla_breaches || 0) > 0) alerts.push({ icon: AlertTriangle, tone: 'bad', code: 'SLA_DEADLINE_EXCEEDED', title: 'SLA breaches', meta: 'Tickets past their resolution deadline', to: '/admin/tickets?sla_breached=true', count: ai.sla_breaches });
  if ((ai.pending_warranties || 0) > 0) alerts.push({ icon: Shield, tone: 'warn', code: 'APPROVAL_REQUIRED', title: 'Warranty approvals', meta: 'Claims waiting for a decision', to: '/admin/warranties?status=pending', count: ai.pending_warranties });
  if ((ai.pending_dispatches || 0) > 0) alerts.push({ icon: Package, tone: 'info', code: 'AWAITING_DISPATCH', title: 'Pending dispatches', meta: 'Orders ready to leave the warehouse', to: '/dispatcher', count: ai.pending_dispatches });

  return (
    <div className="cd-in">
      <div className="cd-head">
        <div>
          <div className="cd-eyebrow"><span className="cd-dot" /> Live · All firms</div>
          <h2 className="cd-title">Executive <span className="thin">Overview</span></h2>
          <p className="cd-sub">Real-time performance across all firms · {data.month_label}</p>
        </div>
        <div className="cd-headbtns">
          <span className="cd-btn"><Calendar size={14} /> Last 30 days</span>
          <button className="cd-btn" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      <div className="cd-kpigrid">
        <KpiCard label="Revenue this month" rawValue={rev.this_month} format={fmtINR}
          delta={delta != null ? `${delta >= 0 ? '+' : ''}${delta}%` : null}
          deltaTone={delta == null ? 'neutral' : delta >= 0 ? 'up' : 'down'}
          sub={rev.last_month != null ? `vs ${fmtINR(rev.last_month)} last mo` : 'No baseline'} icon={TrendingUp} />
        <KpiCard label="Orders this month" rawValue={sal.orders_month} format={fmtCount}
          sub={`${fmtINR(sal.today_revenue)} billed today`} icon={Package} />
        <KpiCard label="Open tickets" rawValue={sup.open} format={fmtCount}
          delta={`${slaPct}% SLA`} deltaTone={slaPct >= 90 ? 'up' : slaPct >= 60 ? 'warn' : 'down'}
          sub="Support queue · all channels" icon={Headphones} />
        <KpiCard label="Active SKUs" rawValue={stk.active_skus} format={fmtCount}
          delta={lowCount > 0 ? `${lowCount} low` : 'In stock'} deltaTone={lowCount > 0 ? 'warn' : 'up'}
          sub={`${fmtCount(stk.total_units)} units in stock`} icon={Boxes} />
      </div>

      <div className="cd-split">
        <div className="cd-panel hot">
          <Brackets />
          <div className="cd-phead">
            <div><h3 className="cd-ptitle">Revenue Velocity</h3><div className="cd-pmeta">Daily revenue · last 30 days</div></div>
          </div>
          <div className="cd-chart">
            <div className="cd-readout"><div className="big">{fmtINR(rev.this_month)}</div><div className="lbl">this month</div></div>
            {trend.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trend} margin={{ top: 28, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="cdArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.34} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#ffffff" strokeOpacity={0.06} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#56698a' }} interval="preserveStartEnd" minTickGap={26} />
                  <YAxis tickLine={false} axisLine={false} width={46} tick={{ fontSize: 10, fill: '#56698a' }} tickFormatter={fmtK} />
                  <RTooltip content={<RevTooltip />} cursor={{ stroke: ACCENT, strokeOpacity: 0.3, strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2.5} fill="url(#cdArea)" dot={false}
                    style={{ filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.55))' }}
                    activeDot={{ r: 4, fill: '#04070e', stroke: ACCENT, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="cd-empty">No revenue data for this period</div>}
          </div>
        </div>

        <div className="cd-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <Brackets />
          <div className="cd-phead">
            <div><h3 className="cd-ptitle">Tactical Alerts</h3><div className="cd-pmeta">Items waiting on a decision</div></div>
            <Activity size={18} className="cd-pico" />
          </div>
          <div style={{ flex: 1, padding: '10px 8px' }}>
            {alerts.length ? alerts.map((a, i) => (
              <Link key={i} to={a.to} className="cd-alert">
                <div className={`cd-aico ${a.tone}`}><a.icon size={17} /></div>
                <div className="cd-abody">
                  <div className="cd-atitlerow"><span className="cd-atitle">{a.title}</span><span className="cd-acount">{a.count}</span></div>
                  <div className="cd-ameta">{a.meta}</div>
                  <div className={`cd-acode ${a.tone}`}>{a.code}</div>
                </div>
                <ArrowRight size={16} style={{ alignSelf: 'center', color: '#56698a' }} />
              </Link>
            )) : (
              <div className="cd-clear">
                <div className="ring"><CheckCircle size={24} /></div>
                <div style={{ fontWeight: 600 }}>All clear</div>
                <div style={{ fontSize: 12, color: '#8ea3c4', marginTop: 4 }}>No SLA breaches, approvals or dispatches pending.</div>
              </div>
            )}
          </div>
          <Link to="/admin/tickets" className="cd-feedfoot">View all tickets →</Link>
        </div>
      </div>
    </div>
  );
}

/* ===================== Root ===================== */
export default function AdminDashboard() {
  const { token } = useAuth();
  const [execData, setExecData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeAdminTab, setActiveAdminTab] = useState('overview');
  const [productionRequests, setProductionRequests] = useState([]);
  const [supervisorPayables, setSupervisorPayables] = useState({ payables: [], summary: {} });
  const [inventoryStock, setInventoryStock] = useState({ raw_materials: [], master_skus: [], summary: {} });
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_reference: '', notes: '' });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { fetchExecutive(); }, [token]);
  useEffect(() => {
    if (activeAdminTab === 'production') fetchProductionData();
    else if (activeAdminTab === 'inventory') fetchInventoryData();
    else if (activeAdminTab === 'payables') fetchPayablesData();
  }, [activeAdminTab, token]);

  const fetchExecutive = async () => {
    try {
      const res = await axios.get(`${API}/admin/dashboard/executive`, { headers: { Authorization: `Bearer ${token}` } });
      setExecData(res.data);
    } catch (e) { console.error('Failed to load executive dashboard', e); }
    finally { setLoading(false); }
  };
  const fetchProductionData = async () => {
    try { const res = await axios.get(`${API}/production-requests`, { headers: { Authorization: `Bearer ${token}` } }); setProductionRequests(res.data || []); }
    catch (e) { console.error('Failed to fetch production data:', e); }
  };
  const fetchPayablesData = async () => {
    try { const res = await axios.get(`${API}/supervisor-payables`, { headers: { Authorization: `Bearer ${token}` } }); setSupervisorPayables(res.data || { payables: [], summary: {} }); }
    catch (e) { console.error('Failed to fetch payables:', e); }
  };
  const fetchInventoryData = async () => {
    try { const res = await axios.get(`${API}/inventory/stock`, { headers: { Authorization: `Bearer ${token}` } }); setInventoryStock(res.data || { raw_materials: [], master_skus: [], summary: {} }); }
    catch (e) { console.error('Failed to fetch inventory:', e); }
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) { toast.error('Please enter a valid payment amount'); return; }
    if (!paymentForm.payment_date) { toast.error('Please select a payment date'); return; }
    setActionLoading(true);
    try {
      await axios.put(`${API}/supervisor-payables/${selectedPayable.id}/payment`, {
        amount: parseFloat(paymentForm.amount), payment_date: paymentForm.payment_date,
        payment_reference: paymentForm.payment_reference || undefined, notes: paymentForm.notes || undefined,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Payment recorded successfully');
      setPaymentDialogOpen(false);
      setPaymentForm({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_reference: '', notes: '' });
      fetchPayablesData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to record payment'); }
    finally { setActionLoading(false); }
  };

  const prodTone = (s) => s === 'received_into_inventory' ? 'ok' : s === 'completed' ? 'info' : s === 'in_progress' ? 'warn' : s === 'accepted' ? 'violet' : 'slate';
  const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'production', label: 'Production', icon: Factory },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'payables', label: 'Payables', icon: IndianRupee },
  ];
  const counts = {
    production: productionRequests.length || null,
    inventory: inventoryStock.summary?.low_stock_alerts || null,
    payables: (supervisorPayables.payables || []).filter((p) => p.payment_status !== 'paid').length || null,
  };
  const invSummary = inventoryStock.summary || {};
  const paySummary = supervisorPayables.summary || {};
  const unpaid = (supervisorPayables.payables || []).filter((p) => p.payment_status !== 'paid');

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="cd-deck">
        {/* Tabs */}
        <div className="cd-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`cd-tab ${activeAdminTab === t.id ? 'active' : ''}`} onClick={() => setActiveAdminTab(t.id)}>
              <t.icon size={15} />{t.label}
              {counts[t.id] != null && <span className="cd-tabcount">{counts[t.id]}</span>}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeAdminTab === 'overview' && (
          <>
            <div className="cd-compliance"><ComplianceAlertBanner /></div>
            <ExecutiveOverview data={loading ? null : execData} onRefresh={fetchExecutive} />
          </>
        )}

        {/* Production */}
        {activeAdminTab === 'production' && (
          <div className="cd-in">
            <div className="cd-head"><div><div className="cd-eyebrow"><Factory size={13} /> Manufacturing</div><h2 className="cd-title">Production <span className="thin">Requests</span></h2></div></div>
            <div className="cd-panel"><Brackets />
              {productionRequests.length === 0 ? (
                <div className="cd-emptybox"><Factory /><p>No production requests found</p></div>
              ) : (
                <div className="cd-tblwrap"><table className="cd-tbl">
                  <thead><tr><th>Request #</th><th>Product</th><th>Firm</th><th className="r">Qty</th><th>Status</th><th>Role</th><th>Created</th></tr></thead>
                  <tbody>{productionRequests.slice(0, 50).map((r) => (
                    <tr key={r.id}>
                      <td className="cd-mono cd-accent">{r.request_number}</td>
                      <td>{r.master_sku_name}</td>
                      <td className="cd-dim">{r.firm_name}</td>
                      <td className="r cd-tnum">{r.quantity_requested}</td>
                      <td><span className={`cd-badge ${prodTone(r.status)}`}>{r.status?.replace(/_/g, ' ')}</span></td>
                      <td className="cd-dim" style={{ textTransform: 'capitalize' }}>{r.manufacturing_role}</td>
                      <td className="cd-dim cd-mono">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>))}</tbody>
                </table></div>
              )}
            </div>
            <p className="cd-note">Showing latest 50 of {productionRequests.length} requests</p>
          </div>
        )}

        {/* Inventory */}
        {activeAdminTab === 'inventory' && (
          <div className="cd-in">
            <div className="cd-head"><div><div className="cd-eyebrow"><Boxes size={13} /> Warehouse</div><h2 className="cd-title">Inventory <span className="thin">Stock</span></h2></div></div>
            <div className="cd-minigrid">
              <MiniStat label="Master SKUs" value={fmtCount(invSummary.total_master_skus || 0)} icon={Package} />
              <MiniStat label="Raw Materials" value={fmtCount(invSummary.total_raw_materials || 0)} icon={Boxes} />
              <MiniStat label="Low Stock" value={invSummary.low_stock_alerts || 0} icon={AlertTriangle} />
              <MiniStat label="Negative Stock" value={invSummary.negative_stock_alerts || 0} icon={AlertTriangle} />
            </div>
            <div className="cd-panel"><Brackets />
              <div className="cd-phead"><div><h3 className="cd-ptitle">Current Stock · Master SKUs</h3><div className="cd-pmeta">Live across all firms</div></div></div>
              <div className="cd-tblwrap"><table className="cd-tbl">
                <thead><tr><th>SKU</th><th>Name</th><th>Firm</th><th>Type</th><th className="r">Stock</th><th>Status</th></tr></thead>
                <tbody>{(inventoryStock.master_skus || []).filter((s) => s.current_stock > 0).slice(0, 30).map((it, i) => (
                  <tr key={`${it.id}-${it.firm_id}-${i}`}>
                    <td className="cd-mono cd-accent">{it.sku_code}</td>
                    <td>{it.name}</td>
                    <td className="cd-dim">{it.firm_name}</td>
                    <td><span className={`cd-badge ${it.product_type === 'manufactured' ? 'violet' : 'slate'}`}>{it.product_type || 'traded'}</span></td>
                    <td className="r cd-tnum" style={{ color: it.is_negative ? '#fb7185' : it.is_low_stock ? '#fbbf24' : '#34d399' }}>{fmtCount(it.current_stock)}</td>
                    <td>{it.is_negative ? <span className="cd-badge bad">Negative</span> : it.is_low_stock ? <span className="cd-badge warn">Low</span> : <span className="cd-badge ok">OK</span>}</td>
                  </tr>))}</tbody>
              </table></div>
            </div>
          </div>
        )}

        {/* Payables */}
        {activeAdminTab === 'payables' && (
          <div className="cd-in">
            <div className="cd-head"><div><div className="cd-eyebrow"><IndianRupee size={13} /> Finance</div><h2 className="cd-title">Supervisor <span className="thin">Payables</span></h2></div></div>
            <div className="cd-minigrid">
              <MiniStat label="Total Payable" value={`₹${(paySummary.total_payable || 0).toLocaleString('en-IN')}`} icon={IndianRupee} />
              <MiniStat label="Total Paid" value={`₹${(paySummary.total_paid || 0).toLocaleString('en-IN')}`} icon={CheckCircle} />
              <MiniStat label="Pending Balance" value={`₹${(paySummary.total_pending || 0).toLocaleString('en-IN')}`} icon={Clock} />
              <MiniStat label="Records" value={fmtCount(paySummary.count || 0)} icon={Factory} />
            </div>
            <div className="cd-panel"><Brackets />
              <div className="cd-phead"><div><h3 className="cd-ptitle">Manufacturing Payables</h3><div className="cd-pmeta">Unpaid &amp; part-paid records</div></div></div>
              {unpaid.length === 0 ? (
                <div className="cd-emptybox"><IndianRupee /><p>No supervisor payables found</p></div>
              ) : (
                <div className="cd-tblwrap"><table className="cd-tbl">
                  <thead><tr><th>Request #</th><th>Product</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Total</th><th className="r">Paid</th><th className="r">Balance</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>{unpaid.slice(0, 50).map((p) => {
                    const bal = (p.total_payable || 0) - (p.amount_paid || 0);
                    return (
                      <tr key={p.id}>
                        <td className="cd-mono cd-accent">{p.production_request_number}</td>
                        <td>{p.master_sku_name}</td>
                        <td className="r cd-tnum">{p.quantity}</td>
                        <td className="r cd-tnum cd-dim">₹{p.rate_per_unit?.toLocaleString('en-IN')}</td>
                        <td className="r cd-tnum">₹{p.total_payable?.toLocaleString('en-IN')}</td>
                        <td className="r cd-tnum" style={{ color: '#34d399' }}>₹{(p.amount_paid || 0).toLocaleString('en-IN')}</td>
                        <td className="r cd-tnum" style={{ color: '#fbbf24' }}>₹{bal.toLocaleString('en-IN')}</td>
                        <td><span className={`cd-badge ${p.payment_status === 'part_paid' ? 'warn' : 'bad'}`}>{p.payment_status?.replace('_', ' ')}</span></td>
                        <td><button className="cd-pay" data-testid={`pay-btn-${p.id}`} onClick={() => {
                          setSelectedPayable(p);
                          setPaymentForm({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_reference: '', notes: '' });
                          setPaymentDialogOpen(true);
                        }}><IndianRupee size={12} /> Pay</button></td>
                      </tr>);
                  })}</tbody>
                </table></div>
              )}
              <p className="cd-note">Showing {unpaid.length} pending records</p>
            </div>
          </div>
        )}
      </div>

      {/* Payment dialog (shadcn) */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><IndianRupee className="w-5 h-5 text-orange-500" /> Record Payment to Supervisor</DialogTitle>
          </DialogHeader>
          {selectedPayable && (
            <div className="space-y-4">
              <div className="bg-secondary/50 border border-border p-3 rounded-lg space-y-0.5">
                <p className="text-muted-foreground text-sm">Request: <span className="text-foreground font-mono">{selectedPayable.production_request_number}</span></p>
                <p className="text-muted-foreground text-sm">Product: <span className="text-foreground">{selectedPayable.master_sku_name}</span></p>
                <p className="text-muted-foreground text-sm">Balance Due: <span className="text-amber-600 font-semibold">₹{((selectedPayable.total_payable || 0) - (selectedPayable.amount_paid || 0)).toLocaleString('en-IN')}</span></p>
              </div>
              <div><Label>Payment Amount (₹) *</Label><Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder="Enter amount" className="mt-1" data-testid="payment-amount-input" /></div>
              <div><Label>Payment Date *</Label><Input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} className="mt-1" data-testid="payment-date-input" /></div>
              <div><Label>Payment Reference</Label><Input value={paymentForm.payment_reference} onChange={(e) => setPaymentForm({ ...paymentForm, payment_reference: e.target.value })} placeholder="e.g., Bank Transfer #12345" className="mt-1" data-testid="payment-ref-input" /></div>
              <div><Label>Notes</Label><Input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} placeholder="Optional notes" className="mt-1" /></div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={actionLoading} data-testid="confirm-payment-btn">
              {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />} Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

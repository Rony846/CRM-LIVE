import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { API, useAuth } from '@/App';
import PowerSearch from '@/components/PowerSearch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import {
  LayoutDashboard, Ticket, Package, Users, ShieldCheck, Boxes, Store, UserCog,
  IndianRupee, BarChart3, FileText, Megaphone, Bell, LogOut, Loader2, RefreshCw,
  Factory, AlertTriangle, Shield, ArrowRight, CheckCircle, Clock, Activity, X,
} from 'lucide-react';

/* Admin Dashboard — MuscleGrid redesign direction 1a "Iron Console".
   Live admin home: 1a visuals + the real /admin/dashboard/executive + production /
   inventory / payables tabs. Brand orange + iron greys, matching the Supervisor page. */

const T = {
  orange: '#F58220', orangeDeep: '#D96A0A', iron900: '#1A1A1A', iron700: '#3A3A3A', iron500: '#6B6B6B',
  iron400: '#9A9A9A', iron200: '#E6E6E6', iron100: '#F2F2F1', iron50: '#FAFAF8', white: '#FFFFFF',
  voltage: '#F4C518', voltageTint: '#FBF3D9', voltageText: '#8A6D00', blue: '#0B6FB8', blueTint: '#E8F1F8',
  green: '#1F8A4C', greenTint: '#E9F4EE', rose: '#C2410C', sidebar: '#161616',
  mono: "'JetBrains Mono', ui-monospace, monospace", headline: "'Inter Tight', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif", display: "'Saira Condensed', system-ui, sans-serif",
};

// Force embedded shadcn-token components (PowerSearch overlay, compliance banner) to
// render in the light Iron-Console palette even though the app theme is dark.
const LIGHT_VARS = {
  '--background': '220 25% 99%', '--foreground': '222 47% 11%',
  '--card': '0 0% 100%', '--card-foreground': '222 47% 11%',
  '--popover': '0 0% 100%', '--popover-foreground': '222 47% 11%',
  '--primary': '28 91% 54%', '--primary-foreground': '0 0% 100%',
  '--secondary': '30 20% 96%', '--secondary-foreground': '222 47% 11%',
  '--muted': '40 12% 95%', '--muted-foreground': '220 5% 42%',
  '--accent': '30 40% 96%', '--accent-foreground': '222 47% 11%',
  '--border': '30 8% 90%', '--input': '30 8% 90%', '--ring': '28 91% 54%',
};

/* formatting */
const fmtINR = (n) => {
  n = Number(n) || 0; const s = n < 0 ? '-' : ''; const a = Math.abs(n);
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)} L`;
  return `${s}₹${a.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
const fmtCount = (n) => (Number(n) || 0).toLocaleString('en-IN');
const fmtK = (v) => {
  v = Number(v) || 0;
  if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}k`;
  return `${v}`;
};
const initials = (n) => (n || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const Fonts = () => (
  <style>{`
    @import url("https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@700;800&family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap");
    .adm1a *{box-sizing:border-box} .adm1a-row:hover{background:${T.iron50}} .adm1a-nav:hover{background:rgba(255,255,255,.05)}
    .adm1a-alert:hover{background:${T.iron50}}
  `}</style>
);
const Caps = ({ children, size = 9, color = T.iron400, ls = '.14em', style }) => (
  <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: size, letterSpacing: ls, textTransform: 'uppercase', color, ...style }}>{children}</span>
);

const Card = ({ children, style, pad = 14 }) => (
  <div style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, boxShadow: '0 1px 2px rgba(15,15,15,.06)', padding: pad, ...style }}>{children}</div>
);

const KpiCard = ({ label, value, accent, sub, delta, deltaTone }) => (
  <Card pad="13px 14px">
    <Caps size={8.5} color={T.iron400}>{label}</Caps>
    <div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 26, color: accent, marginTop: 6, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
      {delta != null && (
        <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 9.5, letterSpacing: '.04em', padding: '1px 6px', borderRadius: 4,
          background: deltaTone === 'up' ? T.greenTint : deltaTone === 'down' ? '#FDEEE6' : deltaTone === 'warn' ? T.voltageTint : T.iron100,
          color: deltaTone === 'up' ? T.green : deltaTone === 'down' ? T.orangeDeep : deltaTone === 'warn' ? T.voltageText : T.iron500 }}>{delta}</span>
      )}
      {sub && <Caps size={8.5} color={T.iron500} ls=".05em">{sub}</Caps>}
    </div>
  </Card>
);

const badgeStyle = (tone) => {
  const map = {
    ok: [T.greenTint, T.green, '#CBE5D6'], info: [T.blueTint, T.blue, '#CBE0F0'],
    warn: [T.voltageTint, T.voltageText, '#EDDFA6'], bad: ['#FDEEE6', T.orangeDeep, '#F6D8BA'],
    violet: ['#EEE9F7', '#6D4AB0', '#DDD3EF'], slate: [T.iron100, T.iron700, T.iron200],
  };
  const [bg, fg, bd] = map[tone] || map.slate;
  return { background: bg, color: fg, border: `1px solid ${bd}`, padding: '2px 8px', borderRadius: 999,
    fontFamily: T.headline, fontWeight: 700, fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' };
};

const th = { textAlign: 'left', padding: '7px 12px' };
const td = { padding: '9px 12px', fontSize: 12, color: T.iron700 };
const mono = { fontFamily: T.mono, fontVariantNumeric: 'tabular-nums' };

/* Light Iron-Console compliance strip — same data as the shared (dark) ComplianceAlertBanner,
   restyled for the light admin page. Pending accounting drafts + open compliance exceptions. */
function ComplianceStrip({ token, navigate }) {
  const [a, setA] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const load = useCallback(async () => {
    try {
      const H = { headers: { Authorization: `Bearer ${token}` } };
      const [dash, drafts] = await Promise.all([
        axios.get(`${API}/compliance/dashboard`, H).catch(() => ({ data: {} })),
        axios.get(`${API}/drafts`, H).catch(() => ({ data: [] })),
      ]);
      setA({ openExceptions: dash.data.total_open || 0, critical: dash.data.by_severity?.critical || 0,
        pendingDrafts: (drafts.data || []).length, drafts: (drafts.data || []).slice(0, 3) });
    } catch { /* */ }
  }, [token]);
  useEffect(() => { load(); const iv = setInterval(load, 60000); return () => clearInterval(iv); }, [load]);
  if (dismissed || !a || (a.openExceptions === 0 && a.pendingDrafts === 0)) return null;
  const finalize = async (d) => {
    try {
      await axios.post(`${API}/drafts/${d.transaction_type}/${d.id}/finalize`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Draft finalized'); load();
    } catch (e) { const dt = e.response?.data?.detail; toast.error((typeof dt === 'object' ? dt.message : dt) || 'Failed to finalize'); }
  };
  return (
    <div style={{ background: T.voltageTint, border: '1px solid #EDDFA6', borderLeft: `4px solid ${T.orange}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>
          <AlertTriangle size={18} color={T.orangeDeep} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900 }}>Compliance Attention Required</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
              {a.pendingDrafts > 0 && <Caps size={9.5} color={T.voltageText} ls=".04em"><Clock size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />{a.pendingDrafts} pending drafts</Caps>}
              {a.openExceptions > 0 && <Caps size={9.5} color={T.orangeDeep} ls=".04em"><AlertTriangle size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />{a.openExceptions} open exceptions{a.critical > 0 ? ` · ${a.critical} critical` : ''}</Caps>}
            </div>
            {a.drafts.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Caps size={8.5} color={T.iron500}>Quick finalize:</Caps>
                {a.drafts.map((d) => (
                  <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '3px 8px' }}>
                    <span style={{ ...mono, fontSize: 10.5, color: T.iron700 }}>{d.reference_number || d.id?.slice(0, 12)}</span>
                    <button onClick={() => finalize(d)} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 'none', background: 'transparent', color: T.orange, cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 10 }}>
                      <CheckCircle size={11} /> Finalize
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={() => navigate('/admin/compliance')} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><Caps size={9.5} color={T.orange}>View Dashboard →</Caps></button>
          <button onClick={() => setDismissed(true)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.iron400, display: 'grid', placeItems: 'center' }}><X size={16} /></button>
        </div>
      </div>
    </div>
  );
}

const RevTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '6px 10px', boxShadow: '0 2px 8px rgba(15,15,15,.1)' }}>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.iron400 }}>{label}</div>
      <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.iron900 }}>{fmtINR(payload[0].value)}</div>
    </div>
  );
};

export default function AdminDashboard1a() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [tab, setTab] = useState('overview');
  const [exec, setExec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [battery, setBattery] = useState(null);
  const [prod, setProd] = useState([]);
  const [pay, setPay] = useState({ payables: [], summary: {} });
  const [inv, setInv] = useState({ master_skus: [], summary: {} });

  const [payOpen, setPayOpen] = useState(false);
  const [selPay, setSelPay] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_reference: '', notes: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const H = { headers: { Authorization: `Bearer ${token}` } };

  const fetchExec = useCallback(async () => {
    try {
      const [e, b] = await Promise.all([
        axios.get(`${API}/admin/dashboard/executive`, H),
        axios.get(`${API}/admin/supervisor-production`, H).catch(() => ({ data: null })),
      ]);
      setExec(e.data); setBattery(b.data);
    } catch (err) { /* */ } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { fetchExec(); }, [fetchExec]);
  useEffect(() => {
    if (tab === 'production') axios.get(`${API}/production-requests`, H).then((r) => setProd(r.data || [])).catch(() => {});
    else if (tab === 'inventory') axios.get(`${API}/inventory/stock`, H).then((r) => setInv(r.data || { master_skus: [], summary: {} })).catch(() => {});
    else if (tab === 'payables') axios.get(`${API}/supervisor-payables`, H).then((r) => setPay(r.data || { payables: [], summary: {} })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, token]);

  const recordPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setActionLoading(true);
    try {
      await axios.put(`${API}/supervisor-payables/${selPay.id}/payment`, {
        amount: parseFloat(payForm.amount), payment_date: payForm.payment_date,
        payment_reference: payForm.payment_reference || undefined, notes: payForm.notes || undefined,
      }, H);
      toast.success('Payment recorded');
      setPayOpen(false);
      axios.get(`${API}/supervisor-payables`, H).then((r) => setPay(r.data || { payables: [], summary: {} }));
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to record payment'); }
    finally { setActionLoading(false); }
  };

  const nav = [
    ['Dashboard', LayoutDashboard, '/admin'],
    ['Tickets', Ticket, '/admin/tickets'],
    ['Orders', Package, '/admin/orders'],
    ['Customers', Users, '/admin/customers'],
    ['Warranties', ShieldCheck, '/admin/warranties'],
    ['Master SKU', Boxes, '/admin/master-sku'],
    ['Dealers', Store, '/admin/dealers'],
    ['Employees', UserCog, '/admin/employees'],
    ['Payroll', IndianRupee, '/admin/payroll'],
    ['Analytics', BarChart3, '/admin/analytics'],
    ['Campaigns', Megaphone, '/admin/campaigns'],
    ['Reports', FileText, '/admin/reports'],
  ];
  const isActive = (p) => location.pathname === p;

  const rev = exec?.revenue || {}, sup = exec?.support || {}, sal = exec?.sales || {}, stk = exec?.stock || {}, ai = exec?.action_items || {};
  const trend = (rev.trend_30d || []).map((d) => ({ date: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: d.value || 0 }));
  const slaPct = sup.sla_pct ?? 0;
  const dataThrough = exec?.data_through ? new Date(exec.data_through).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  const alerts = [];
  if ((ai.sla_breaches || 0) > 0) alerts.push({ icon: AlertTriangle, tone: 'bad', title: 'SLA breaches', meta: 'Tickets past resolution deadline', to: '/admin/tickets?sla_breached=true', count: ai.sla_breaches });
  if ((ai.pending_warranties || 0) > 0) alerts.push({ icon: Shield, tone: 'warn', title: 'Warranty approvals', meta: 'Claims waiting for a decision', to: '/admin/warranties?status=pending', count: ai.pending_warranties });
  if ((ai.pending_dispatches || 0) > 0) alerts.push({ icon: Package, tone: 'info', title: 'Pending dispatches', meta: 'Orders ready to leave the warehouse', to: '/dispatcher', count: ai.pending_dispatches });

  const TABS = [['overview', 'Overview', BarChart3], ['production', 'Production', Factory], ['inventory', 'Inventory', Boxes], ['payables', 'Payables', IndianRupee]];
  const tabCounts = {
    production: prod.length || null,
    inventory: inv.summary?.low_stock_alerts || null,
    payables: (pay.payables || []).filter((p) => p.payment_status !== 'paid').length || null,
  };
  const invSummary = inv.summary || {};
  const paySummary = pay.summary || {};
  const unpaid = (pay.payables || []).filter((p) => p.payment_status !== 'paid');
  const prodTone = (s) => s === 'received_into_inventory' ? 'ok' : s === 'completed' ? 'info' : s === 'in_progress' ? 'warn' : s === 'accepted' ? 'violet' : 'slate';

  return (
    <div className="adm1a" style={{ display: 'grid', gridTemplateColumns: '226px 1fr', minHeight: '100vh', background: T.iron50, fontFamily: T.body, color: T.iron900 }}>
      <Fonts />
      <aside style={{ background: T.sidebar, color: '#fff', display: 'flex', flexDirection: 'column', padding: '18px 14px', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 6px 20px', cursor: 'pointer' }} onClick={() => navigate('/admin')}>
          <img src="/redesign/mg-monogram.png" alt="MG" style={{ width: 34, height: 34 }} />
          <div>
            <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 17, letterSpacing: '.02em' }}>MUSCLEGRID</div>
            <Caps size={8} color={T.orange} ls=".22em">Admin Console</Caps>
          </div>
        </div>
        <Caps size={8.5} color="#6f6f6f" style={{ padding: '6px 8px' }}>Workspace</Caps>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {nav.map(([label, Icon, path]) => {
            const active = isActive(path);
            return (
              <div key={label} className="adm1a-nav" onClick={() => navigate(path)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px', borderRadius: 8, marginBottom: 2, cursor: 'pointer',
                background: active ? 'rgba(245,130,32,.16)' : 'transparent', color: active ? '#fff' : '#c9c9c9' }}>
                <Icon size={15} color={active ? T.orange : '#9a9a9a'} strokeWidth={1.75} />
                <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5 }}>{label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: 10, margin: '8px 0', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: T.orange, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 800, fontSize: 11 }}>{initials(`${user?.first_name || ''} ${user?.last_name || ''}`) || 'AD'}</div>
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>{`${user?.first_name || 'Admin'} ${user?.last_name || ''}`.trim()}</div>
            <Caps size={8} color="#8a8a8a" ls=".1em">Administrator</Caps>
          </div>
        </div>
        <div className="adm1a-nav" onClick={() => { logout?.(); navigate('/login'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', color: '#9a9a9a', cursor: 'pointer', borderRadius: 8 }}>
          <LogOut size={14} strokeWidth={1.75} /><Caps size={10} color="#9a9a9a">Sign Out</Caps>
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: 58, background: T.white, borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 22px', position: 'sticky', top: 0, zIndex: 5 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 16 }}>Admin Dashboard</div>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.iron400 }}>ALL FIRMS · {exec?.month_label || ''}</span>
          <div style={{ flex: 1 }} />
          <div style={LIGHT_VARS}><PowerSearch /></div>
          <button onClick={fetchExec} title="Refresh" style={{ border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, height: 34, width: 34, display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.iron700 }}>
            <RefreshCw size={15} strokeWidth={1.75} />
          </button>
          <Bell size={18} strokeWidth={1.75} color={T.iron700} />
        </header>

        <main style={{ padding: 22, overflow: 'auto' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {TABS.map(([id, label, Icon]) => {
              const on = tab === id;
              return (
                <button key={id} onClick={() => setTab(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${on ? T.iron900 : T.iron200}`, background: on ? T.iron900 : T.white,
                  color: on ? '#fff' : T.iron700, borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12 }}>
                  <Icon size={14} />{label}
                  {tabCounts[id] != null && <span style={{ ...mono, fontSize: 10, background: on ? 'rgba(255,255,255,.2)' : T.iron100, color: on ? '#fff' : T.iron500, borderRadius: 999, padding: '0 6px' }}>{tabCounts[id]}</span>}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
          ) : tab === 'overview' ? (
            <>
              <ComplianceStrip token={token} navigate={navigate} />

              {dataThrough && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: '5px 11px', borderRadius: 6,
                  background: exec?.sales_stale ? T.voltageTint : T.iron100, border: `1px solid ${exec?.sales_stale ? '#EDDFA6' : T.iron200}` }}>
                  {exec?.sales_stale ? <AlertTriangle size={13} color={T.voltageText} /> : <Clock size={13} color={T.iron500} />}
                  <Caps size={9} color={exec?.sales_stale ? T.voltageText : T.iron500} ls=".04em">
                    Sales data through {dataThrough}{exec?.sales_stale ? ' · current month not imported yet' : ''}
                  </Caps>
                </div>
              )}

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
                <KpiCard label="Revenue this month" value={fmtINR(rev.this_month)} accent={T.orange}
                  delta={rev.delta_pct != null ? `${rev.delta_pct >= 0 ? '+' : ''}${rev.delta_pct}%` : null}
                  deltaTone={rev.delta_pct == null ? 'neutral' : rev.delta_pct >= 0 ? 'up' : 'down'}
                  sub={rev.last_month != null ? `vs ${fmtINR(rev.last_month)} last mo` : 'No baseline'} />
                <KpiCard label="Orders this month" value={fmtCount(sal.orders_month)} accent={T.iron900}
                  sub={`${fmtINR(sal.today_revenue)} billed today`} />
                <KpiCard label="Open tickets" value={fmtCount(sup.open)} accent={T.orangeDeep}
                  delta={`${slaPct}% SLA`} deltaTone={slaPct >= 90 ? 'up' : slaPct >= 60 ? 'warn' : 'down'} sub="Support queue" />
                <KpiCard label="SLA on-time" value={`${slaPct}%`} accent={slaPct >= 90 ? T.green : slaPct >= 60 ? T.voltageText : T.orangeDeep}
                  sub={`${fmtCount(sup.breached)} breached`} />
                <KpiCard label="Active SKUs" value={fmtCount(stk.active_skus)} accent={T.blue}
                  delta={stk.low_count > 0 ? `${stk.low_count} low` : 'In stock'} deltaTone={stk.low_count > 0 ? 'warn' : 'up'}
                  sub={`${fmtCount(stk.total_units)} units`} />
              </div>

              {/* Chart + alerts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
                <Card pad={0}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 16px 6px' }}>
                    <div>
                      <Caps size={11} color={T.iron900} ls=".1em">Revenue Velocity</Caps>
                      <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginTop: 3 }}>Daily revenue · last 30 days</Caps>
                    </div>
                    <div style={{ ...mono, fontWeight: 700, fontSize: 20, color: T.orange }}>{fmtINR(rev.this_month)}</div>
                  </div>
                  <div style={{ padding: '0 8px 10px' }}>
                    {trend.length ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={trend} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="adm1aArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={T.orange} stopOpacity={0.28} />
                              <stop offset="100%" stopColor={T.orange} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke={T.iron200} />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.iron400, fontFamily: T.mono }} interval="preserveStartEnd" minTickGap={26} />
                          <YAxis tickLine={false} axisLine={false} width={46} tick={{ fontSize: 10, fill: T.iron400, fontFamily: T.mono }} tickFormatter={fmtK} />
                          <RTooltip content={<RevTooltip />} cursor={{ stroke: T.orange, strokeOpacity: 0.3, strokeWidth: 1 }} />
                          <Area type="monotone" dataKey="value" stroke={T.orange} strokeWidth={2.5} fill="url(#adm1aArea)" dot={false} activeDot={{ r: 4, fill: T.white, stroke: T.orange, strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : <div style={{ display: 'grid', placeItems: 'center', height: 260, color: T.iron400, fontSize: 13 }}>No revenue data for this period</div>}
                  </div>
                </Card>

                <Card pad={0} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
                    <div>
                      <Caps size={11} color={T.iron900} ls=".1em">Tactical Alerts</Caps>
                      <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginTop: 3 }}>Items waiting on a decision</Caps>
                    </div>
                    <Activity size={16} color={T.iron400} />
                  </div>
                  <div style={{ flex: 1, padding: '2px 8px 8px' }}>
                    {alerts.length ? alerts.map((a, i) => (
                      <div key={i} className="adm1a-alert" onClick={() => navigate(a.to)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px', borderRadius: 8, cursor: 'pointer' }}>
                        <div style={{ ...badgeStyle(a.tone), padding: 0, width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center' }}><a.icon size={16} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12.5 }}>{a.title}</span>
                            <span style={{ ...mono, fontWeight: 700, fontSize: 13, color: T.orangeDeep }}>{a.count}</span>
                          </div>
                          <div style={{ fontSize: 11, color: T.iron500 }}>{a.meta}</div>
                        </div>
                        <ArrowRight size={15} color={T.iron400} />
                      </div>
                    )) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 999, background: T.greenTint, color: T.green, display: 'grid', placeItems: 'center', marginBottom: 10 }}><CheckCircle size={22} /></div>
                        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13 }}>All clear</div>
                        <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 3 }}>No SLA breaches, approvals or dispatches pending.</div>
                      </div>
                    )}
                  </div>
                  <div onClick={() => navigate('/admin/tickets')} style={{ borderTop: `1px solid ${T.iron200}`, padding: '10px 16px', cursor: 'pointer' }}>
                    <Caps size={9} color={T.orange}>View all tickets →</Caps>
                  </div>
                </Card>
              </div>

              {/* Battery production strip */}
              {battery && (
                <Card style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Factory size={15} color={T.orange} /><Caps size={11} color={T.iron900} ls=".1em">Battery Production</Caps></div>
                    <div onClick={() => navigate('/admin/supervisor-production')} style={{ cursor: 'pointer' }}><Caps size={9} color={T.orange}>View report →</Caps></div>
                  </div>
                  <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                    {[['Built', fmtCount(battery.total_batteries), T.iron900], ['Owed', fmtINR(battery.owed), T.iron700],
                      ['Paid (bank)', fmtINR(battery.paid_bank), T.green], [battery.outstanding < 0 ? 'Overpaid' : 'Outstanding', fmtINR(Math.abs(battery.outstanding || 0)), battery.outstanding < 0 ? T.blue : T.voltageText]].map(([l, v, c]) => (
                      <div key={l}>
                        <Caps size={8.5} color={T.iron400}>{l}</Caps>
                        <div style={{ ...mono, fontWeight: 700, fontSize: 24, color: c, marginTop: 4 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : tab === 'production' ? (
            <Card pad={0}>
              <div style={{ padding: '13px 16px' }}><Caps size={11} color={T.iron900} ls=".1em">Production Requests</Caps></div>
              {prod.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: T.iron400 }}>No production requests found</div> : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderTop: `1px solid ${T.iron200}`, borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {['REQUEST #', 'PRODUCT', 'FIRM', 'QTY', 'STATUS', 'ROLE', 'CREATED'].map((h) => <th key={h} style={th}><Caps size={8.5}>{h}</Caps></th>)}
                  </tr></thead>
                  <tbody>{prod.slice(0, 50).map((r) => (
                    <tr key={r.id} className="adm1a-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...td, ...mono, fontWeight: 700, color: T.orangeDeep }}>{r.request_number}</td>
                      <td style={td}>{r.master_sku_name}</td>
                      <td style={{ ...td, color: T.iron400 }}>{r.firm_name}</td>
                      <td style={{ ...td, ...mono, textAlign: 'left' }}>{r.quantity_requested}</td>
                      <td style={td}><span style={badgeStyle(prodTone(r.status))}>{r.status?.replace(/_/g, ' ')}</span></td>
                      <td style={{ ...td, color: T.iron500, textTransform: 'capitalize' }}>{r.manufacturing_role}</td>
                      <td style={{ ...td, ...mono, color: T.iron400 }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>))}</tbody>
                </table>
              )}
              <div style={{ padding: '9px 16px', borderTop: `1px solid ${T.iron200}` }}><Caps size={9} color={T.iron400}>Showing {Math.min(prod.length, 50)} of {prod.length} requests</Caps></div>
            </Card>
          ) : tab === 'inventory' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                <KpiCard label="Master SKUs" value={fmtCount(invSummary.total_master_skus)} accent={T.iron900} />
                <KpiCard label="Raw Materials" value={fmtCount(invSummary.total_raw_materials)} accent={T.blue} />
                <KpiCard label="Low Stock" value={fmtCount(invSummary.low_stock_alerts)} accent={T.voltageText} />
                <KpiCard label="Negative Stock" value={fmtCount(invSummary.negative_stock_alerts)} accent={T.orangeDeep} />
              </div>
              <Card pad={0}>
                <div style={{ padding: '13px 16px' }}><Caps size={11} color={T.iron900} ls=".1em">Current Stock · Master SKUs</Caps></div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderTop: `1px solid ${T.iron200}`, borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {['SKU', 'NAME', 'FIRM', 'TYPE', 'STOCK', 'STATUS'].map((h) => <th key={h} style={th}><Caps size={8.5}>{h}</Caps></th>)}
                  </tr></thead>
                  <tbody>{(inv.master_skus || []).filter((s) => s.current_stock > 0).slice(0, 30).map((it, i) => (
                    <tr key={`${it.id}-${it.firm_id}-${i}`} className="adm1a-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...td, ...mono, fontWeight: 700, color: T.orangeDeep }}>{it.sku_code}</td>
                      <td style={td}>{it.name}</td>
                      <td style={{ ...td, color: T.iron400 }}>{it.firm_name}</td>
                      <td style={td}><span style={badgeStyle(it.product_type === 'manufactured' ? 'violet' : 'slate')}>{it.product_type || 'traded'}</span></td>
                      <td style={{ ...td, ...mono, color: it.is_negative ? T.orangeDeep : it.is_low_stock ? T.voltageText : T.green, fontWeight: 700 }}>{fmtCount(it.current_stock)}</td>
                      <td style={td}><span style={badgeStyle(it.is_negative ? 'bad' : it.is_low_stock ? 'warn' : 'ok')}>{it.is_negative ? 'Negative' : it.is_low_stock ? 'Low' : 'OK'}</span></td>
                    </tr>))}</tbody>
                </table>
              </Card>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                <KpiCard label="Total Payable" value={fmtINR(paySummary.total_payable)} accent={T.iron900} />
                <KpiCard label="Total Paid" value={fmtINR(paySummary.total_paid)} accent={T.green} />
                <KpiCard label="Pending Balance" value={fmtINR(paySummary.total_pending)} accent={T.voltageText} />
                <KpiCard label="Records" value={fmtCount(paySummary.count)} accent={T.blue} />
              </div>
              <Card pad={0}>
                <div style={{ padding: '13px 16px' }}><Caps size={11} color={T.iron900} ls=".1em">Manufacturing Payables · Unpaid &amp; Part-Paid</Caps></div>
                {unpaid.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: T.iron400 }}>No supervisor payables found</div> : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderTop: `1px solid ${T.iron200}`, borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {['REQUEST #', 'PRODUCT', 'QTY', 'RATE', 'TOTAL', 'PAID', 'BALANCE', 'STATUS', ''].map((h, i) => <th key={i} style={th}><Caps size={8.5}>{h}</Caps></th>)}
                    </tr></thead>
                    <tbody>{unpaid.slice(0, 50).map((p) => {
                      const bal = (p.total_payable || 0) - (p.amount_paid || 0);
                      return (
                        <tr key={p.id} className="adm1a-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                          <td style={{ ...td, ...mono, fontWeight: 700, color: T.orangeDeep }}>{p.production_request_number}</td>
                          <td style={td}>{p.master_sku_name}</td>
                          <td style={{ ...td, ...mono }}>{p.quantity}</td>
                          <td style={{ ...td, ...mono, color: T.iron400 }}>₹{p.rate_per_unit?.toLocaleString('en-IN')}</td>
                          <td style={{ ...td, ...mono }}>₹{p.total_payable?.toLocaleString('en-IN')}</td>
                          <td style={{ ...td, ...mono, color: T.green }}>₹{(p.amount_paid || 0).toLocaleString('en-IN')}</td>
                          <td style={{ ...td, ...mono, color: T.voltageText, fontWeight: 700 }}>₹{bal.toLocaleString('en-IN')}</td>
                          <td style={td}><span style={badgeStyle(p.payment_status === 'part_paid' ? 'warn' : 'bad')}>{p.payment_status?.replace('_', ' ')}</span></td>
                          <td style={td}>
                            <button onClick={() => { setSelPay(p); setPayForm({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_reference: '', notes: '' }); setPayOpen(true); }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}>
                              <IndianRupee size={12} /> Pay
                            </button>
                          </td>
                        </tr>);
                    })}</tbody>
                  </table>
                )}
                <div style={{ padding: '9px 16px', borderTop: `1px solid ${T.iron200}` }}><Caps size={9} color={T.iron400}>Showing {unpaid.length} pending records</Caps></div>
              </Card>
            </>
          )}
        </main>
      </div>

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><IndianRupee className="w-5 h-5 text-orange-500" /> Record Payment to Supervisor</DialogTitle></DialogHeader>
          {selPay && (
            <div className="space-y-4">
              <div className="bg-secondary/50 border border-border p-3 rounded-lg space-y-0.5">
                <p className="text-muted-foreground text-sm">Request: <span className="text-foreground font-mono">{selPay.production_request_number}</span></p>
                <p className="text-muted-foreground text-sm">Product: <span className="text-foreground">{selPay.master_sku_name}</span></p>
                <p className="text-muted-foreground text-sm">Balance Due: <span className="text-amber-600 font-semibold">₹{((selPay.total_payable || 0) - (selPay.amount_paid || 0)).toLocaleString('en-IN')}</span></p>
              </div>
              <div><Label>Payment Amount (₹) *</Label><Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Enter amount" className="mt-1" /></div>
              <div><Label>Payment Date *</Label><Input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} className="mt-1" /></div>
              <div><Label>Payment Reference</Label><Input value={payForm.payment_reference} onChange={(e) => setPayForm({ ...payForm, payment_reference: e.target.value })} placeholder="e.g., Bank Transfer #12345" className="mt-1" /></div>
              <div><Label>Notes</Label><Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Optional notes" className="mt-1" /></div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={recordPayment} disabled={actionLoading}>{actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />} Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

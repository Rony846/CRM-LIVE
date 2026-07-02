import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { API, useAuth } from '@/App';
import SupervisorTeam from './SupervisorTeam';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { openAuthedFile } from '@/lib/openFile';
import { toast } from 'sonner';
import {
  LayoutDashboard, ShieldCheck, Factory, Calendar, Truck, ClipboardCheck,
  Search, Bell, Zap, LogOut, Loader2, ArrowRight, Wrench, Package, Phone,
  RefreshCw, XCircle, FileText, Shield, History, Clock,
} from 'lucide-react';

/* Supervisor Dashboard — MuscleGrid redesign direction 1a "Iron Console".
   The LIVE supervisor page: 1a visuals + real /supervisor data + the full
   click-through (view ticket, take action, team, search). Brand orange + iron greys. */

const T = {
  orange: '#F58220', orangeDeep: '#D96A0A', iron900: '#1A1A1A', iron700: '#3A3A3A', iron500: '#6B6B6B',
  iron400: '#9A9A9A', iron200: '#E6E6E6', iron100: '#F2F2F1', iron50: '#FAFAF8', white: '#FFFFFF',
  voltage: '#F4C518', voltageTint: '#FBF3D9', voltageText: '#8A6D00', blue: '#0B6FB8', blueTint: '#E8F1F8',
  green: '#1F8A4C', greenTint: '#E9F4EE', sidebar: '#161616',
  mono: "'JetBrains Mono', ui-monospace, monospace", headline: "'Inter Tight', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif", display: "'Saira Condensed', system-ui, sans-serif",
};

// Force embedded shadcn-token components (SupervisorTeam) to render in the light
// Iron-Console palette even though the app's active theme is dark.
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

const CAT = {
  New: { bg: '#FFF1E3', fg: '#C25E05', bd: '#F6D8BA' },
  Assigned: { bg: '#E8F1F8', fg: '#0B6FB8', bd: '#CBE0F0' },
  Dispatch: { bg: '#FBF3D9', fg: '#8A6D00', bd: '#EDDFA6' },
  'In Repair': { bg: '#F2F2F1', fg: '#4A4A4A', bd: '#E0E0DE' },
  Escalated: { bg: '#FFF1E3', fg: '#D96A0A', bd: '#F6D8BA' },
  Resolved: { bg: '#E9F4EE', fg: '#1F8A4C', bd: '#CBE5D6' },
};
function catFor(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('escalat')) return 'Escalated';
  if (s.includes('resolv') || s.includes('closed') || s.includes('delivered') || s.includes('collected')) return 'Resolved';
  if (s.includes('repair') || s.includes('received') || s.includes('factory') || s.includes('parts') || s.includes('invoice')) return 'In Repair';
  if (s.includes('label') || s.includes('pickup') || s.includes('dispatch') || s.includes('ready')) return 'Dispatch';
  if (s.includes('new')) return 'New';
  return 'Assigned';
}
const initials = (n) => (n || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
function slaLabel(t) {
  if (t.sla_breached) return { txt: 'BREACHED', c: T.orangeDeep };
  if (t.is_urgent) return { txt: 'URGENT', c: T.voltageText };
  if (t.sla_due) { try { return { txt: new Date(t.sla_due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), c: T.iron700 }; } catch { /* */ } }
  return { txt: '—', c: T.iron400 };
}
const formatTimeRemaining = (hours) => {
  if (hours == null) return '—';
  if (hours <= 0) return 'OVERDUE';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${Math.round(hours)}h`;
};

const Fonts = () => (
  <style>{`
    @import url("https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@700;800&family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap");
    .sup1a *{box-sizing:border-box} .sup1a-row:hover{background:${T.iron50}} .sup1a-nav:hover{background:rgba(255,255,255,.05)}
  `}</style>
);
const Caps = ({ children, size = 9, color = T.iron400, ls = '.14em', style }) => (
  <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: size, letterSpacing: ls, textTransform: 'uppercase', color, ...style }}>{children}</span>
);

export default function SupervisorDashboard1a() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedSku, setSelectedSku] = useState('');

  const [customerWarranties, setCustomerWarranties] = useState([]);
  const [customerTickets, setCustomerTickets] = useState([]);
  const [loadingCustomerData, setLoadingCustomerData] = useState(false);

  const [ticketSearch, setTicketSearch] = useState('');
  const [searchingTicket, setSearchingTicket] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const h = { headers: { Authorization: `Bearer ${token}` } };
      const [s, q, sk] = await Promise.all([
        axios.get(`${API}/supervisor/stats`, h),
        axios.get(`${API}/supervisor/queue`, h),
        axios.get(`${API}/admin/skus`, h).catch(() => ({ data: [] })),
      ]);
      setStats(s.data || {});
      const ql = Array.isArray(q.data) ? q.data : (q.data.queue || q.data.tickets || []);
      setQueue(ql);
      setSkus(sk.data || []);
    } catch (e) { /* */ } finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const fetchCustomerData = async (customerId, customerPhone) => {
    setLoadingCustomerData(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [w, ct] = await Promise.all([
        axios.get(`${API}/supervisor/customer-warranties`, { headers, params: { customer_id: customerId, phone: customerPhone } }).catch(() => ({ data: [] })),
        axios.get(`${API}/supervisor/customer-tickets`, { headers, params: { customer_id: customerId, phone: customerPhone } }).catch(() => ({ data: [] })),
      ]);
      setCustomerWarranties(w.data || []);
      setCustomerTickets(ct.data || []);
    } catch (e) { /* */ } finally { setLoadingCustomerData(false); }
  };

  const viewTicketDetails = useCallback(async (ticketId) => {
    try {
      const res = await axios.get(`${API}/tickets/${ticketId}`, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedTicket(res.data);
      setDetailsOpen(true);
      if (res.data.customer_id || res.data.customer_phone) fetchCustomerData(res.data.customer_id, res.data.customer_phone);
    } catch (e) { toast.error('Failed to load ticket'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Deep-link: open a ticket when arriving via ?ticket=<id>
  useEffect(() => {
    const tid = new URLSearchParams(location.search).get('ticket');
    if (tid) viewTicketDetails(tid);
  }, [location.search, viewTicketDetails]);

  const searchTickets = async (e) => {
    e?.preventDefault();
    const q = ticketSearch.trim();
    if (!q) return;
    setSearchingTicket(true);
    try {
      const res = await axios.get(`${API}/tickets`, { headers: { Authorization: `Bearer ${token}` }, params: { search: q, limit: 10 } });
      const list = res.data?.tickets || res.data || [];
      if (list.length) {
        await viewTicketDetails(list[0].id);
        if (list.length > 1) toast.message(`${list.length} matches — opened ${list[0].ticket_number}`);
      } else toast.error(`No ticket found for "${q}"`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Search failed');
    } finally { setSearchingTicket(false); }
  };

  const openActionDialog = (ticket) => {
    setSelectedTicket(ticket); setAction(''); setNotes(''); setSelectedSku(''); setActionOpen(true);
  };

  const handleSupervisorAction = async () => {
    if (!action) { toast.error('Please select an action'); return; }
    if (notes.trim().length < 15) { toast.error('Please add a short note (15+ characters) about the action.'); return; }
    setActionLoading(true);
    try {
      const fd = new FormData();
      fd.append('action', action);
      fd.append('notes', notes);
      if (selectedSku) fd.append('sku', selectedSku);
      await axios.post(`${API}/tickets/${selectedTicket.id}/supervisor-action`, fd, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Action completed successfully');
      setActionOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to perform action');
    } finally { setActionLoading(false); }
  };

  const counts = queue.reduce((a, t) => { const c = catFor(t.status); a[c] = (a[c] || 0) + 1; a.All++; return a; }, { All: 0 });
  const FILTERS = ['All', 'New', 'Assigned', 'Escalated', 'In Repair', 'Dispatch', 'Resolved'];
  const visible = (filter === 'All' ? queue : queue.filter((t) => catFor(t.status) === filter)).slice(0, 14);

  const KPIS = [
    { label: 'OPEN IN QUEUE', value: queue.length, sub: 'ALL SUPERVISOR TICKETS', accent: T.orange },
    { label: 'ESCALATED', value: stats?.escalated_tickets ?? 0, sub: 'TO SUPERVISOR', accent: T.orangeDeep },
    { label: 'CUSTOMER ESCALATIONS', value: stats?.customer_escalated ?? 0, sub: 'RAISED BY CUSTOMER', accent: T.voltageText },
    { label: 'URGENT · SLA', value: stats?.urgent_tickets ?? 0, sub: 'BREACH RISK', accent: T.blue },
    { label: 'RESOLVED TODAY', value: stats?.resolved_today ?? 0, sub: 'CLOSED IN 24H', accent: T.green },
  ];

  const nav = [
    ['Dashboard', LayoutDashboard, '/supervisor'],
    ['Warranties', ShieldCheck, '/supervisor/warranties'],
    ['Production', Factory, '/supervisor/production'],
    ['Dispatch', Truck, '/supervisor/dispatch-tasks'],
    ['Calendar', Calendar, '/supervisor/calendar'],
    ['QA Scores', ClipboardCheck, '/supervisor/qa-scorecards'],
  ];
  const isActive = (path) => location.pathname === path;

  return (
    <div className="sup1a" style={{ display: 'grid', gridTemplateColumns: '226px 1fr', minHeight: '100vh', background: T.iron50, fontFamily: T.body, color: T.iron900,
      colorScheme: 'light', '--input-bg': '0 0% 100%', '--input-text': '222 47% 11%', '--input-border': '30 8% 88%', '--input-placeholder': '220 9% 56%' }}>
      <Fonts />
      <aside style={{ background: T.sidebar, color: '#fff', display: 'flex', flexDirection: 'column', padding: '18px 14px', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 6px 20px', cursor: 'pointer' }} onClick={() => navigate('/supervisor')}>
          <img src="/redesign/mg-monogram.png" alt="MG" style={{ width: 34, height: 34 }} />
          <div>
            <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 17, letterSpacing: '.02em' }}>MUSCLEGRID</div>
            <Caps size={8} color={T.orange} ls=".22em">Supervisor</Caps>
          </div>
        </div>
        <Caps size={8.5} color="#6f6f6f" style={{ padding: '6px 8px' }}>Workspace</Caps>
        {nav.map(([label, Icon, path]) => {
          const active = isActive(path);
          return (
            <div key={label} className="sup1a-nav" onClick={() => navigate(path)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 8, marginBottom: 2, cursor: 'pointer',
              background: active ? 'rgba(245,130,32,.16)' : 'transparent', color: active ? '#fff' : '#c9c9c9' }}>
              <Icon size={15} color={active ? T.orange : '#9a9a9a'} strokeWidth={1.75} />
              <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5 }}>{label}</span>
            </div>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: T.orange, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 800, fontSize: 11 }}>{initials(`${user?.first_name || ''} ${user?.last_name || ''}`) || 'SU'}</div>
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>{`${user?.first_name || 'Supervisor'} ${user?.last_name || ''}`.trim()}</div>
            <Caps size={8} color="#8a8a8a" ls=".1em">Supervisor</Caps>
          </div>
        </div>
        <div className="sup1a-nav" onClick={() => { logout?.(); navigate('/login'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', color: '#9a9a9a', cursor: 'pointer', borderRadius: 8 }}>
          <LogOut size={14} strokeWidth={1.75} /><Caps size={10} color="#9a9a9a">Sign Out</Caps>
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 58, background: T.white, borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 22px', position: 'sticky', top: 0, zIndex: 5 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 16 }}>Supervisor Dashboard</div>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.iron400 }}>SERVICE · REPAIR · PRODUCTION</span>
          <div style={{ flex: 1 }} />
          <form onSubmit={searchTickets} style={{ width: 290, height: 34, border: `1px solid ${T.iron200}`, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', color: T.iron400, background: T.white }}>
            {searchingTicket ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} strokeWidth={1.75} />}
            <input
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
              placeholder="Search tickets, serials, customers"
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 12.5, color: T.iron900, fontFamily: T.body }}
            />
          </form>
          <button onClick={fetchData} title="Refresh" style={{ border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, height: 34, width: 34, display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.iron700 }}>
            <RefreshCw size={15} strokeWidth={1.75} />
          </button>
          <Bell size={18} strokeWidth={1.75} color={T.iron700} />
        </header>

        <main style={{ padding: 22, overflow: 'auto' }}>
          {loading ? (
            <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
                {KPIS.map((k) => (
                  <div key={k.label} style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: '13px 14px', boxShadow: '0 1px 2px rgba(15,15,15,.06)' }}>
                    <Caps size={8.5} color={T.iron400}>{k.label}</Caps>
                    <div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 26, color: k.accent, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                    <Caps size={8.5} color={T.iron500} ls=".08em" style={{ marginTop: 3, display: 'block' }}>{k.sub}</Caps>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 292px', gap: 16 }}>
                <div style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, boxShadow: '0 1px 2px rgba(15,15,15,.06)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px 10px', gap: 6, flexWrap: 'wrap' }}>
                    <Caps size={11} color={T.iron900} ls=".1em">Supervisor Ticket Queue</Caps>
                    <div style={{ flex: 1 }} />
                    {FILTERS.map((f) => {
                      const on = filter === f;
                      return (
                        <button key={f} onClick={() => setFilter(f)} style={{ border: `1px solid ${on ? T.iron900 : T.iron200}`, background: on ? T.iron900 : T.white,
                          color: on ? '#fff' : T.iron700, borderRadius: 999, padding: '4px 10px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 11 }}>
                          {f} <span style={{ fontFamily: T.mono, opacity: .7 }}>{counts[f] || 0}</span>
                        </button>
                      );
                    })}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderTop: `1px solid ${T.iron200}`, borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                        {['TICKET', 'CUSTOMER', 'PRODUCT · SERIAL', 'ISSUE', 'STATUS', 'SLA', ''].map((h, i) => (
                          <th key={i} style={{ textAlign: h === '' ? 'right' : 'left', padding: '7px 12px' }}><Caps size={8.5} color={T.iron400}>{h}</Caps></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((t) => {
                        const c = CAT[catFor(t.status)]; const sla = slaLabel(t);
                        return (
                          <tr key={t.id} className="sup1a-row" onClick={() => viewTicketDetails(t.id)} style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }}>
                            <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {t.is_urgent && <span style={{ width: 6, height: 6, borderRadius: 999, background: T.orange }} />}
                                <span style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 11.5, color: t.sla_breached ? T.orangeDeep : T.iron900 }}>{t.ticket_number}</span>
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px', maxWidth: 150 }}>
                              <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.customer_name || '—'}</div>
                              <Caps size={8.5} color={T.iron400} ls=".06em">{t.customer_city || t.device_type || ''}</Caps>
                            </td>
                            <td style={{ padding: '9px 12px', maxWidth: 170 }}>
                              <div style={{ fontSize: 11, color: T.iron700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.product_name || t.device_type || '—'}</div>
                              <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.iron400 }}>{t.serial_number || ''}</span>
                            </td>
                            <td style={{ padding: '9px 12px', maxWidth: 230 }}>
                              <div style={{ fontSize: 11, color: T.iron700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.issue_description || '—'}</div>
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ padding: '3px 9px', borderRadius: 999, background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, fontFamily: T.headline, fontWeight: 700, fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{catFor(t.status)}</span>
                            </td>
                            <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                              <span style={{ fontFamily: T.mono, fontSize: 10.5, fontWeight: 700, color: sla.c }}>{sla.txt}</span>
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); openActionDialog(t); }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep,
                                  borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                                Action <ArrowRight size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {visible.length === 0 && (
                        <tr><td colSpan={7} style={{ padding: '40px 12px', textAlign: 'center', color: T.iron400, fontSize: 13 }}>No tickets in this view.</td></tr>
                      )}
                    </tbody>
                  </table>
                  <div style={{ padding: '9px 16px', borderTop: `1px solid ${T.iron200}` }}>
                    <Caps size={9} color={T.iron400}>Showing {visible.length} of {queue.length}</Caps>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 14, boxShadow: '0 1px 2px rgba(15,15,15,.06)' }}>
                    <Caps size={9} color={T.iron400}>Queue by Status</Caps>
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {['Escalated', 'New', 'Assigned', 'In Repair', 'Dispatch', 'Resolved'].map((k) => {
                        const v = counts[k] || 0; const c = CAT[k]; const max = Math.max(1, ...['Escalated', 'New', 'Assigned', 'In Repair', 'Dispatch', 'Resolved'].map((x) => counts[x] || 0));
                        return (
                          <div key={k}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <Caps size={9} color={c.fg} ls=".06em">{k}</Caps>
                              <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: T.iron700 }}>{v}</span>
                            </div>
                            <div style={{ height: 6, background: T.iron100, borderRadius: 4 }}>
                              <div style={{ height: '100%', width: `${(v / max) * 100}%`, background: c.fg, borderRadius: 4 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ background: T.voltageTint, border: '1px solid #EDDFA6', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Zap size={14} color={T.voltageText} strokeWidth={2} /><Caps size={9} color={T.voltageText}>Escalation Watch</Caps>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#6B4F00', marginTop: 6, lineHeight: 1.5 }}>
                      <b>{stats?.customer_escalated ?? 0} customer escalations</b> and <b>{stats?.urgent_tickets ?? 0} SLA-urgent</b> tickets need a supervisor decision.
                    </div>
                  </div>
                </div>
              </div>

              {/* Sales & Support team — live workload + performance (rendered in the light palette) */}
              <div style={{ marginTop: 16 }}>
                <Caps size={11} color={T.iron900} ls=".1em" style={{ display: 'block', marginBottom: 10 }}>Sales &amp; Support Team</Caps>
                <div style={LIGHT_VARS}><SupervisorTeam /></div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Ticket Details Dialog ── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Ticket Details — {selectedTicket?.ticket_number}
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Ticket Info</TabsTrigger>
                <TabsTrigger value="warranties"><Shield className="h-4 w-4 mr-1" /> Warranties ({customerWarranties.length})</TabsTrigger>
                <TabsTrigger value="history"><History className="h-4 w-4 mr-1" /> All Tickets ({customerTickets.length})</TabsTrigger>
                <TabsTrigger value="timeline"><Clock className="h-4 w-4 mr-1" /> Audit Trail</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-muted-foreground">Status</p><StatusBadge status={selectedTicket.status} /></div>
                  <div><p className="text-sm text-muted-foreground">Device</p><p className="font-medium text-foreground">{selectedTicket.device_type}</p></div>
                  <div><p className="text-sm text-muted-foreground">Customer</p><p className="font-medium text-foreground">{selectedTicket.customer_name}</p></div>
                  <div><p className="text-sm text-muted-foreground">Phone</p><p className="font-mono text-foreground">{selectedTicket.customer_phone}</p></div>
                  <div><p className="text-sm text-muted-foreground">Email</p><p className="font-mono text-sm text-foreground">{selectedTicket.customer_email}</p></div>
                  <div><p className="text-sm text-muted-foreground">City</p><p className="font-medium text-foreground">{selectedTicket.customer_city || '-'}</p></div>
                  {selectedTicket.serial_number && (<div><p className="text-sm text-muted-foreground">Serial Number</p><p className="font-mono text-foreground">{selectedTicket.serial_number}</p></div>)}
                  {selectedTicket.invoice_number && (<div><p className="text-sm text-muted-foreground">Invoice Number</p><p className="font-mono text-foreground">{selectedTicket.invoice_number}</p></div>)}
                </div>
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Issue</p>
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-foreground">{selectedTicket.issue_description}</div>
                </div>
                {selectedTicket.escalation_notes && (
                  <div><p className="mb-1 text-sm text-muted-foreground">Escalation Notes (from Support)</p>
                    <div className="rounded-lg border border-orange-400/20 bg-orange-400/10 p-3 text-orange-300">{selectedTicket.escalation_notes}</div></div>
                )}
                {selectedTicket.supervisor_notes && (
                  <div><p className="mb-1 text-sm text-muted-foreground">Supervisor Notes
                    {selectedTicket.status === 'supervisor_followup' && (<span className="ml-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-400">(In Followup)</span>)}</p>
                    <div className="rounded-lg border border-violet-400/20 bg-violet-400/10 p-3 text-violet-300">{selectedTicket.supervisor_notes}</div></div>
                )}
                {selectedTicket.agent_notes && (
                  <div><p className="mb-1 text-sm text-muted-foreground">Agent Notes</p>
                    <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-3 text-sky-300">{selectedTicket.agent_notes}</div></div>
                )}
                {selectedTicket.invoice_file && (
                  <div><p className="mb-1 text-sm text-muted-foreground">Invoice Document</p>
                    <button onClick={async () => { if (!(await openAuthedFile(selectedTicket.invoice_file, token, API))) toast.error('Could not open the invoice'); }}
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><FileText className="h-4 w-4" /> View Invoice</button></div>
                )}
              </TabsContent>

              <TabsContent value="warranties" className="mt-4">
                {loadingCustomerData ? (<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>)
                  : customerWarranties.length === 0 ? (<div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground"><Shield className="mb-2 h-12 w-12 opacity-30" /><p>No warranties found for this customer</p></div>)
                  : (<div className="space-y-3">{customerWarranties.map((warranty, i) => (
                      <div key={i} className="rounded-lg border border-border bg-muted/40 p-4">
                        <div className="flex items-start justify-between">
                          <div><p className="font-medium text-foreground">{warranty.device_type || warranty.product_type || 'Product'}</p>
                            <p className="text-sm text-muted-foreground">Order: {warranty.order_id || warranty.serial_number || '-'}</p></div>
                          <StatusBadge status={warranty.status} />
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-foreground">
                          <div><span className="text-muted-foreground">Start:</span> {warranty.warranty_start_date ? new Date(warranty.warranty_start_date).toLocaleDateString() : '-'}</div>
                          <div><span className="text-muted-foreground">Expires:</span> {warranty.warranty_end_date ? new Date(warranty.warranty_end_date).toLocaleDateString() : '-'}</div>
                        </div>
                        {warranty.admin_invoice_file && (
                          <button onClick={async () => { if (!(await openAuthedFile(warranty.admin_invoice_file, token, API))) toast.error('Could not open the invoice'); }}
                            className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"><FileText className="h-3 w-3" /> View Invoice</button>
                        )}
                      </div>))}</div>)}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {loadingCustomerData ? (<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>)
                  : customerTickets.length === 0 ? (<div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground"><History className="mb-2 h-12 w-12 opacity-30" /><p>No previous tickets found</p></div>)
                  : (<div className="space-y-2">{customerTickets.map((ticket, i) => (
                      <div key={i} className={`rounded-lg border p-3 ${ticket.id === selectedTicket.id ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/40'}`}>
                        <div className="flex items-start justify-between">
                          <div><p className="font-mono text-sm text-primary">{ticket.ticket_number}</p>
                            <p className="text-sm text-foreground">{ticket.issue_description?.substring(0, 80)}...</p></div>
                          <StatusBadge status={ticket.status} />
                        </div>
                        <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                          <span>{ticket.device_type}</span><span>{ticket.support_type}</span><span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>))}</div>)}
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <div className="max-h-80 space-y-3 overflow-y-auto">
                  <h4 className="border-b border-border pb-2 text-sm font-medium text-foreground">Complete Audit Trail</h4>
                  {selectedTicket.history?.length > 0 ? (selectedTicket.history.map((entry, i) => (
                    <div key={i} className="flex gap-3 border-l-2 border-primary/30 pl-3 text-sm">
                      <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-foreground">{entry.action}</p>
                          <span className="font-mono text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">By: {entry.by || 'System'}</p>
                        {entry.notes && (<div className="mt-1 rounded bg-muted/60 p-2 text-xs text-foreground">{entry.notes}</div>)}
                      </div>
                    </div>))) : (<p className="text-sm text-muted-foreground">No history entries yet</p>)}
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
            {selectedTicket && (
              <Button onClick={() => { setDetailsOpen(false); openActionDialog(selectedTicket); }}>Take Action</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Supervisor Action Dialog ── */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Take Action — {selectedTicket?.ticket_number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">Customer: {selectedTicket?.customer_name}</p>
              <p className="mt-1 text-sm font-medium text-foreground">{selectedTicket?.issue_description}</p>
            </div>
            {selectedTicket?.escalation_notes && (
              <div className="rounded-lg border border-orange-400/20 bg-orange-400/10 p-3">
                <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-orange-400">Agent's Escalation Notes:</p>
                <p className="text-sm text-orange-300">{selectedTicket.escalation_notes}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Action *</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger data-testid="action-select"><SelectValue placeholder="Select action" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_process"><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-amber-400" />In Process (Followup Required)</div></SelectItem>
                  <SelectItem value="resolve"><div className="flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-500" />Resolve on Call</div></SelectItem>
                  <SelectItem value="spare_dispatch"><div className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" />Send Spare Part</div></SelectItem>
                  <SelectItem value="reverse_pickup"><div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-400" />Arrange Reverse Pickup</div></SelectItem>
                  <SelectItem value="close_ticket"><div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-rose-400" />Close Ticket</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            {action === 'spare_dispatch' && skus.length > 0 && (
              <div className="space-y-2">
                <Label>Select SKU</Label>
                <Select value={selectedSku} onValueChange={setSelectedSku}>
                  <SelectTrigger><SelectValue placeholder="Select spare part" /></SelectTrigger>
                  <SelectContent>
                    {skus.filter((s) => s.active && s.stock_quantity > 0).map((sku) => (
                      <SelectItem key={sku.id} value={sku.sku_code}>{sku.model_name} ({sku.sku_code}) - Stock: {sku.stock_quantity}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes * (min 15 characters)</Label>
              <Textarea placeholder="Short note about your decision / next steps..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} data-testid="notes-input" />
              <p className={`font-mono text-xs ${notes.trim().length < 15 ? 'text-rose-400' : 'text-emerald-500'}`}>{notes.trim().length}/15 characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button onClick={handleSupervisorAction} disabled={actionLoading || notes.trim().length < 15 || !action} data-testid="confirm-action-btn">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Confirm Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

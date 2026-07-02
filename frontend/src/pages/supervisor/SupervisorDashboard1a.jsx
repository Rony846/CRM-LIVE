import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import {
  LayoutDashboard, Ticket, Users, Factory, ShieldCheck, Calendar, Search, Bell, Zap, LogOut, Loader2,
} from 'lucide-react';

/* Supervisor Dashboard — MuscleGrid redesign direction 1a "Iron Console", wired to the REAL
   /supervisor/stats + /supervisor/queue endpoints. Brand orange + iron greys, exact tokens. */

const T = {
  orange: '#F58220', orangeDeep: '#D96A0A', iron900: '#1A1A1A', iron700: '#3A3A3A', iron500: '#6B6B6B',
  iron400: '#9A9A9A', iron200: '#E6E6E6', iron100: '#F2F2F1', iron50: '#FAFAF8', white: '#FFFFFF',
  voltage: '#F4C518', voltageTint: '#FBF3D9', voltageText: '#8A6D00', blue: '#0B6FB8', blueTint: '#E8F1F8',
  green: '#1F8A4C', greenTint: '#E9F4EE', sidebar: '#161616',
  mono: "'JetBrains Mono', ui-monospace, monospace", headline: "'Inter Tight', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif", display: "'Saira Condensed', system-ui, sans-serif",
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
const initials = (n) => (n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
function slaLabel(t) {
  if (t.sla_breached) return { txt: 'BREACHED', c: T.orangeDeep };
  if (t.is_urgent) return { txt: 'URGENT', c: T.voltageText };
  if (t.sla_due) { try { return { txt: new Date(t.sla_due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), c: T.iron700 }; } catch { /* */ } }
  return { txt: '—', c: T.iron400 };
}

const Fonts = () => (
  <style>{`
    @import url("https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@700;800&family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap");
    .sup1a *{box-sizing:border-box} .sup1a-row:hover{background:${T.iron50}}
  `}</style>
);
const Caps = ({ children, size = 9, color = T.iron400, ls = '.14em', style }) => (
  <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: size, letterSpacing: ls, textTransform: 'uppercase', color, ...style }}>{children}</span>
);

export default function SupervisorDashboard1a() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    (async () => {
      try {
        const h = { headers: { Authorization: `Bearer ${token}` } };
        const [s, q] = await Promise.all([
          axios.get(`${API}/supervisor/stats`, h),
          axios.get(`${API}/supervisor/queue`, h),
        ]);
        setStats(s.data || {});
        const ql = Array.isArray(q.data) ? q.data : (q.data.queue || q.data.tickets || []);
        setQueue(ql);
      } catch (e) { /* */ } finally { setLoading(false); }
    })();
  }, [token]);

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
    ['Dashboard', LayoutDashboard, true], ['Queue', Ticket, false], ['Team', Users, false],
    ['Production', Factory, false], ['Warranties', ShieldCheck, false], ['Calendar', Calendar, false],
  ];

  return (
    <div className="sup1a" style={{ display: 'grid', gridTemplateColumns: '226px 1fr', minHeight: '100vh', background: T.iron50, fontFamily: T.body, color: T.iron900 }}>
      <Fonts />
      <aside style={{ background: T.sidebar, color: '#fff', display: 'flex', flexDirection: 'column', padding: '18px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 6px 20px' }}>
          <img src="/redesign/mg-monogram.png" alt="MG" style={{ width: 34, height: 34 }} />
          <div>
            <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 17, letterSpacing: '.02em' }}>MUSCLEGRID</div>
            <Caps size={8} color={T.orange} ls=".22em">Supervisor</Caps>
          </div>
        </div>
        <Caps size={8.5} color="#6f6f6f" style={{ padding: '6px 8px' }}>Workspace</Caps>
        {nav.map(([label, Icon, active]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 8, marginBottom: 2, cursor: 'pointer',
            background: active ? 'rgba(245,130,32,.16)' : 'transparent', color: active ? '#fff' : '#c9c9c9' }}>
            <Icon size={15} color={active ? T.orange : '#9a9a9a'} strokeWidth={1.75} />
            <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5 }}>{label}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: T.orange, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 800, fontSize: 11 }}>{initials(`${user?.first_name || ''} ${user?.last_name || ''}`) || 'SU'}</div>
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>{`${user?.first_name || 'Supervisor'} ${user?.last_name || ''}`.trim()}</div>
            <Caps size={8} color="#8a8a8a" ls=".1em">Supervisor</Caps>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', color: '#9a9a9a', cursor: 'pointer' }}>
          <LogOut size={14} strokeWidth={1.75} /><Caps size={10} color="#9a9a9a">Sign Out</Caps>
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 58, background: T.white, borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 22px' }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 16 }}>Supervisor Dashboard</div>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.iron400 }}>SERVICE · REPAIR · PRODUCTION</span>
          <div style={{ flex: 1 }} />
          <div style={{ width: 250, height: 34, border: `1px solid ${T.iron200}`, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', color: T.iron400 }}>
            <Search size={14} strokeWidth={1.75} /><span style={{ fontSize: 12.5 }}>Search tickets, serials, customers</span>
          </div>
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
                        {['TICKET', 'CUSTOMER', 'PRODUCT · SERIAL', 'ISSUE', 'STATUS', 'SLA', 'OWNER'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '7px 12px' }}><Caps size={8.5} color={T.iron400}>{h}</Caps></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((t) => {
                        const c = CAT[catFor(t.status)]; const sla = slaLabel(t);
                        return (
                          <tr key={t.id} className="sup1a-row" style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }}>
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
                            <td style={{ padding: '9px 12px' }}>
                              <div style={{ width: 26, height: 26, borderRadius: 999, background: T.iron100, color: T.iron700, display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 700, fontSize: 9.5 }}>{initials(t.assigned_to_name)}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{ padding: '9px 16px', borderTop: `1px solid ${T.iron200}` }}>
                    <Caps size={9} color={T.iron400}>Showing {visible.length} of {queue.length} · <span style={{ color: T.orange }}>Open full queue →</span></Caps>
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}

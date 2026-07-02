import React, { useState } from 'react';
import {
  LayoutDashboard, Ticket, Users, Truck, BarChart3, Sliders, Search, Bell,
  Zap, ShieldCheck, ChevronLeft, LogOut,
} from 'lucide-react';

/* MuscleGrid CRM redesign — Direction 1a "Iron Console" (preview).
   High-fidelity recreation of the design handoff (file #202): brand orange + iron greys,
   Saira Condensed / Inter Tight / Inter / JetBrains Mono. Standalone preview page — does not
   touch the live CRM. Sample data matches the handoff's shapes; wire to the real API on rollout. */

const T = {
  orange: '#F58220', orangeDeep: '#D96A0A', orangeSoft: '#FFF1E3',
  iron1000: '#0E0E0E', iron900: '#1A1A1A', iron700: '#3A3A3A', iron500: '#6B6B6B',
  iron400: '#9A9A9A', iron300: '#C7C7C7', iron200: '#E6E6E6', iron100: '#F2F2F1',
  iron50: '#FAFAF8', white: '#FFFFFF', voltage: '#F4C518', voltageTint: '#FBF3D9',
  voltageText: '#8A6D00', blue: '#0B6FB8', blueTint: '#E8F1F8', green: '#1F8A4C',
  greenTint: '#E9F4EE', sidebar: '#161616',
  mono: "'JetBrains Mono', ui-monospace, monospace",
  headline: "'Inter Tight', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  display: "'Saira Condensed', 'Oswald', system-ui, sans-serif",
};

const STATUS = {
  New: { bg: '#FFF1E3', fg: '#C25E05', bd: '#F6D8BA' },
  Assigned: { bg: '#E8F1F8', fg: '#0B6FB8', bd: '#CBE0F0' },
  Dispatched: { bg: '#FBF3D9', fg: '#8A6D00', bd: '#EDDFA6' },
  'Parts Awaited': { bg: '#F2F2F1', fg: '#4A4A4A', bd: '#E0E0DE' },
  Resolved: { bg: '#E9F4EE', fg: '#1F8A4C', bd: '#CBE5D6' },
};

const TICKETS = [
  { id: 'MG-4821', p1: true, customer: 'Anil Sharma', city: 'Jaipur · RJ', product: 'MGH0648 Hybrid 6.2kW', serial: 'MGH0648-25-08812', issue: 'Display error E-07 after firmware update — unit in bypass', status: 'New', sla: '1h 20m', slaState: 'ok', owner: 'AM' },
  { id: 'MG-4820', customer: 'Reena Devi', city: 'Patna · BR', product: 'MG5KVA Stabilizer', serial: 'MG5KVA-25-11290', issue: 'Buzzing + relay chatter above 250V input', status: 'Assigned', sla: '3h 05m', slaState: 'ok', owner: 'NP' },
  { id: 'MG-4817', p1: true, customer: 'Farhan Q.', city: 'Meerut · UP', product: 'DSP-07 Display Board', serial: 'MGH0648-25-07741', issue: 'Board dead — no output, awaiting replacement PCB', status: 'Parts Awaited', sla: 'BREACHED', slaState: 'breach', owner: 'VS' },
  { id: 'MG-4815', customer: 'Kavita Rao', city: 'Nagpur · MH', product: 'MG10KVA Heavy Duty', serial: 'MG10K-25-04412', issue: 'RTO returned unit — inbound at gate for inspection', status: 'Dispatched', sla: 'ETA 04 Jul', slaState: 'paused', owner: 'PR' },
  { id: 'MG-4812', customer: 'S. Balaji', city: 'Coimbatore · TN', product: 'MG4KVA AC Stabilizer', serial: 'MG4KVA-25-09930', issue: 'Fixed under warranty — closed after code-verified delivery', status: 'Resolved', sla: '—', slaState: 'closed', owner: 'AM' },
  { id: 'MG-4809', customer: 'Ajay Singh', city: 'Lucknow · UP', product: 'MG6500-48 Inverter', serial: 'MG6500-25-02218', issue: 'ALA52 low-voltage alarm — battery + charging check advised', status: 'New', sla: '42m', slaState: 'risk', owner: 'NP' },
  { id: 'MG-4806', customer: 'Deepak M.', city: 'Indore · MP', product: 'MG120AH 48V Lithium', serial: 'MG48V-25-13004', issue: 'BMS app pairing fails — RS485 comms intermittent', status: 'Assigned', sla: '5h 40m', slaState: 'ok', owner: 'VS' },
];

const KPIS = [
  { label: 'OPEN TICKETS', value: '142', sub: '+12 TODAY', accent: T.orange },
  { label: 'SLA AT RISK', value: '9', sub: 'NEXT BREACH 42M', accent: T.voltageText },
  { label: 'BREACHED', value: '3', sub: 'ESCALATED L2', accent: T.orangeDeep },
  { label: 'AVG FIRST RESPONSE', value: '38m', sub: 'VS 45M TARGET', accent: T.iron900 },
  { label: 'REPLACEMENTS IN TRANSIT', value: '17', sub: 'BLUEDART · DELHIVERY · GATI', accent: T.blue },
];

const FILTERS = [
  ['All', 142], ['New', 38], ['Assigned', 51], ['Dispatched', 17], ['Parts', 9], ['Resolved', 27],
];
const INTAKE = [34, 41, 52, 47, 38, 29, 44];
const TEAM = [['Arjun', 14, true], ['Neha', 11, false], ['Vikram', 9, false], ['Priya', 7, false]];

const Fonts = () => (
  <style>{`
    @import url("https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;700;800&family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap");
    .mgp * { box-sizing: border-box; }
    .mgp-row:hover { background: ${T.iron50}; }
    .mgp-hatch { background-image: repeating-linear-gradient(45deg, rgba(255,255,255,.028) 0 2px, transparent 2px 9px); }
  `}</style>
);

const Caps = ({ children, size = 9, color = T.iron400, ls = '.14em', style }) => (
  <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: size, letterSpacing: ls, textTransform: 'uppercase', color, ...style }}>{children}</span>
);

function StatusPill({ s }) {
  const c = STATUS[s] || STATUS['Parts Awaited'];
  return (
    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, background: c.bg, color: c.fg,
      border: `1px solid ${c.bd}`, fontFamily: T.headline, fontWeight: 700, fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase' }}>{s}</span>
  );
}

/* ---------------- DASHBOARD (1a Iron Console) ---------------- */
function Dashboard() {
  const [filter, setFilter] = useState('All');
  const nav = [
    ['Dashboard', LayoutDashboard, true, null], ['Tickets', Ticket, false, 142],
    ['Customers', Users, false, null], ['Dispatches', Truck, false, 17],
    ['Warranty', ShieldCheck, false, 64], ['Reports', BarChart3, false, null], ['Settings', Sliders, false, null],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '226px 1fr', minHeight: '100vh', background: T.iron50, fontFamily: T.body, color: T.iron900 }}>
      {/* sidebar */}
      <aside style={{ background: T.sidebar, color: T.white, display: 'flex', flexDirection: 'column', padding: '18px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 6px 20px' }}>
          <img src="/redesign/mg-monogram.png" alt="MG" style={{ width: 34, height: 34 }} />
          <div>
            <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 17, letterSpacing: '.02em' }}>MUSCLEGRID</div>
            <Caps size={8} color={T.orange} ls=".22em">Service Console</Caps>
          </div>
        </div>
        <Caps size={8.5} color="#6f6f6f" style={{ padding: '6px 8px' }}>Workspace</Caps>
        {nav.map(([label, Icon, active, badge]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 8, marginBottom: 2, cursor: 'pointer',
            background: active ? 'rgba(245,130,32,.16)' : 'transparent', color: active ? T.white : '#c9c9c9' }}>
            <Icon size={15} color={active ? T.orange : '#9a9a9a'} strokeWidth={1.75} />
            <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, flex: 1 }}>{label}</span>
            {badge != null && <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: active ? T.orange : '#8a8a8a' }}>{badge}</span>}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 999, background: T.orange, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 800, fontSize: 12 }}>AM</div>
            <div>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>Arjun Mehta</div>
              <Caps size={8} color="#8a8a8a" ls=".1em">Senior Agent · L2</Caps>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', color: '#9a9a9a', cursor: 'pointer' }}>
          <LogOut size={14} strokeWidth={1.75} /><Caps size={10} color="#9a9a9a">Sign Out</Caps>
        </div>
      </aside>

      {/* main */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* top bar */}
        <header style={{ height: 58, background: T.white, borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 22px' }}>
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 16 }}>Operations Dashboard</div>
          </div>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.iron400 }}>WED · 02 JUL 2026 · 16:42 IST</span>
          <div style={{ flex: 1 }} />
          <div style={{ width: 250, height: 34, border: `1px solid ${T.iron200}`, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', color: T.iron400 }}>
            <Search size={14} strokeWidth={1.75} /><span style={{ fontSize: 12.5 }}>Search tickets, serials, customers</span>
          </div>
          <div style={{ position: 'relative' }}>
            <Bell size={18} strokeWidth={1.75} color={T.iron700} />
            <span style={{ position: 'absolute', top: -5, right: -6, background: T.orange, color: '#fff', fontFamily: T.mono, fontSize: 9, fontWeight: 700, borderRadius: 999, padding: '1px 5px' }}>4</span>
          </div>
        </header>

        <main style={{ padding: 22, overflow: 'auto' }}>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
            {KPIS.map((k) => (
              <div key={k.label} style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: '13px 14px', boxShadow: '0 1px 2px rgba(15,15,15,.06)' }}>
                <Caps size={8.5} color={T.iron400}>{k.label}</Caps>
                <div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 26, letterSpacing: '-.01em', color: k.accent, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                <Caps size={8.5} color={T.iron500} ls=".08em" style={{ marginTop: 3, display: 'block' }}>{k.sub}</Caps>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 292px', gap: 16 }}>
            {/* queue */}
            <div style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, boxShadow: '0 1px 2px rgba(15,15,15,.06)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px 10px' }}>
                <Caps size={11} color={T.iron900} ls=".1em">Live Ticket Queue</Caps>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  {FILTERS.map(([f, n]) => {
                    const on = filter === f;
                    return (
                      <button key={f} onClick={() => setFilter(f)} style={{ border: `1px solid ${on ? T.iron900 : T.iron200}`, background: on ? T.iron900 : T.white,
                        color: on ? '#fff' : T.iron700, borderRadius: 999, padding: '4px 10px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 11 }}>
                        {f} <span style={{ fontFamily: T.mono, opacity: .7 }}>{n}</span>
                      </button>
                    );
                  })}
                </div>
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
                  {TICKETS.map((t) => (
                    <tr key={t.id} className="mgp-row" style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }}>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {t.p1 && <span style={{ width: 6, height: 6, borderRadius: 999, background: T.orange }} />}
                          <span style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 12, color: t.p1 ? T.orangeDeep : T.iron900 }}>{t.id}</span>
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12 }}>{t.customer}</div>
                        <Caps size={8.5} color={T.iron400} ls=".06em">{t.city}</Caps>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ fontSize: 11.5, color: T.iron700 }}>{t.product}</div>
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.iron400 }}>{t.serial}</span>
                      </td>
                      <td style={{ padding: '9px 12px', maxWidth: 240 }}>
                        <div style={{ fontSize: 11.5, color: T.iron700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.issue}</div>
                      </td>
                      <td style={{ padding: '9px 12px' }}><StatusPill s={t.status} /></td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700,
                          color: t.slaState === 'breach' ? T.orangeDeep : t.slaState === 'risk' ? T.voltageText : t.slaState === 'closed' || t.slaState === 'paused' ? T.iron400 : T.iron700 }}>{t.sla}</span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ width: 26, height: 26, borderRadius: 999, background: T.iron100, color: T.iron700, display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 700, fontSize: 10 }}>{t.owner}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '9px 16px', borderTop: `1px solid ${T.iron200}` }}>
                <Caps size={9} color={T.iron400}>Showing 7 of 142 · <span style={{ color: T.orange }}>Open full queue →</span></Caps>
              </div>
            </div>

            {/* right rail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 14, boxShadow: '0 1px 2px rgba(15,15,15,.06)' }}>
                <Caps size={9} color={T.iron400}>7-Day Intake</Caps>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90, marginTop: 12 }}>
                  {INTAKE.map((v, i) => (
                    <div key={i} style={{ flex: 1, height: `${(v / 52) * 100}%`, background: i === INTAKE.length - 1 ? T.orange : T.blue, borderRadius: '3px 3px 0 0' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <Caps key={i} size={8} color={T.iron400}>{d}</Caps>)}
                </div>
              </div>
              <div style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 14, boxShadow: '0 1px 2px rgba(15,15,15,.06)' }}>
                <Caps size={9} color={T.iron400}>Team Load · Open</Caps>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {TEAM.map(([n, v, over]) => (
                    <div key={n}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 11 }}>{n}</span>
                        <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: over ? T.voltageText : T.iron700 }}>{v}</span>
                      </div>
                      <div style={{ height: 6, background: T.iron100, borderRadius: 4 }}>
                        <div style={{ height: '100%', width: `${(v / 14) * 100}%`, background: over ? T.voltage : T.iron700, borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: T.voltageTint, border: `1px solid #EDDFA6`, borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Zap size={14} color={T.voltageText} strokeWidth={2} /><Caps size={9} color={T.voltageText}>SLA Alert</Caps>
                </div>
                <div style={{ fontSize: 11.5, color: '#6B4F00', marginTop: 6, lineHeight: 1.5 }}>
                  <b>3 SLA breaches</b> escalated to L2 — part-dependent. Review in the 11:00 standup.
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---------------- LOGIN (1a) ---------------- */
function Login() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '54% 1fr', minHeight: '100vh', fontFamily: T.body }}>
      <div className="mgp-hatch" style={{ background: '#141414', color: '#fff', padding: '48px 56px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/redesign/mg-monogram.png" alt="MG" style={{ width: 40, height: 40 }} />
          <Caps size={11} color="#c9c9c9" ls=".22em">Consistency Through You</Caps>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 62, lineHeight: 1.02, letterSpacing: '.005em' }}>
          MUSCLEGRID<br /><span style={{ color: T.orange }}>SERVICE CONSOLE</span>
        </div>
        <div style={{ color: '#b5b5b5', fontSize: 14, marginTop: 16, maxWidth: 420, lineHeight: 1.6 }}>
          One desk for warranty, service tickets and replacement dispatch — across every firm and channel.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          {['Warranty', 'Tickets', 'Dispatch', 'Dealers'].map((c) => (
            <span key={c} style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 999, padding: '5px 12px', fontFamily: T.headline, fontWeight: 600, fontSize: 11, color: '#d5d5d5' }}>{c}</span>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Caps size={9} color="#7a7a7a" ls=".14em">Authorised personnel only · Support 24×7 · 1800-MG-CARE</Caps>
      </div>

      <div style={{ background: T.iron50, display: 'grid', placeItems: 'center', padding: 40 }}>
        <div style={{ width: 360 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 26 }}>Sign in</div>
          <div style={{ color: T.iron500, fontSize: 13, marginTop: 4 }}>Use your MuscleGrid staff or partner ID.</div>
          <div style={{ display: 'flex', border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 3, marginTop: 20, background: T.white }}>
            {['Agent', 'Dealer', 'Admin'].map((r, i) => (
              <div key={r} style={{ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 6, cursor: 'pointer',
                background: i === 0 ? T.iron900 : 'transparent', color: i === 0 ? '#fff' : T.iron500, fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>{r}</div>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <Caps size={9} color={T.iron500}>Employee / Partner ID</Caps>
            <input defaultValue="MG-AGENT-2041" style={{ width: '100%', height: 42, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '0 12px', marginTop: 6, fontFamily: T.mono, fontSize: 13, background: T.white }} />
          </div>
          <div style={{ marginTop: 14 }}>
            <Caps size={9} color={T.iron500}>Password</Caps>
            <input type="password" defaultValue="password" style={{ width: '100%', height: 42, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '0 12px', marginTop: 6, fontFamily: T.mono, fontSize: 13, background: T.white }} />
          </div>
          <button style={{ width: '100%', height: 44, marginTop: 20, background: T.orange, color: '#fff', border: 'none', borderRadius: 8,
            fontFamily: T.headline, fontWeight: 700, fontSize: 13, letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>Sign In</button>
          <div style={{ textAlign: 'center', marginTop: 14, color: T.iron500, fontSize: 12.5, cursor: 'pointer' }}>Forgot password?</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- CUSTOMER 360 (1a) ---------------- */
const C360 = {
  name: 'Anil Sharma', id: 'CU-88412', city: 'Jaipur · RJ', phone: '+91 98290 44xxx', email: 'anil.sharma@example.in',
  dealer: 'Shree Balaji Solar',
  products: [
    { name: 'MGH0648 Hybrid 6.2kW Inverter', serial: 'MGH0648-25-08812', bought: '12 Aug 2025', till: '11 Aug 2028', in: true },
    { name: 'MG120AH 48V Lithium Battery', serial: 'MG48V-25-13004', bought: '12 Aug 2025', till: '11 Aug 2030', in: true },
    { name: 'MG5KVA Stabilizer', serial: 'MG5KVA-23-04410', bought: '03 Mar 2023', till: '02 Mar 2025', in: false },
  ],
  tickets: [
    { id: 'MG-4821', date: '02 Jul 2026', issue: 'Display error E-07 after firmware update', status: 'New', res: '—' },
    { id: 'MG-3980', date: '18 Apr 2026', issue: 'Battery not charging past 80%', status: 'Resolved', res: '2d 4h' },
    { id: 'MG-3120', date: '02 Jan 2026', issue: 'Firmware update request', status: 'Resolved', res: '6h 10m' },
    { id: 'MG-2044', date: '20 Sep 2025', issue: 'Installation guidance', status: 'Resolved', res: '1h 05m' },
  ],
  dispatches: [
    { docket: 'BD-778812345', courier: 'BlueDart Surface', item: 'DSP-07 Display Board', status: 'In Transit', eta: 'ETA 04 Jul' },
    { docket: 'DL-441120987', courier: 'Delhivery 10kg', item: 'MG120AH Battery (replacement)', status: 'Delivered', eta: '28 Jun' },
  ],
  activity: [
    { at: '02 Jul · 16:20', by: 'Arjun M', note: 'Raised MG-4821 — advised battery + charging check before pickup.' },
    { at: '28 Jun · 11:05', by: 'System', note: 'Replacement battery delivered — code-verified.' },
    { at: '18 Apr · 09:40', by: 'Neha P', note: 'Resolved MG-3980 under warranty; BMS recalibrated.' },
  ],
};

function SectionCard({ title, children, right }) {
  return (
    <div style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, boxShadow: '0 1px 2px rgba(15,15,15,.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', borderBottom: `1px solid ${T.iron200}` }}>
        <Caps size={10} color={T.iron900} ls=".1em">{title}</Caps>
        <div style={{ flex: 1 }} />{right}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Customer360() {
  const [tab, setTab] = useState('Overview');
  const tabs = ['Overview', 'Tickets', 'Dispatches'];
  return (
    <div style={{ minHeight: '100vh', background: T.iron50, fontFamily: T.body, color: T.iron900 }}>
      {/* header */}
      <header style={{ height: 58, background: T.white, borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.iron500, cursor: 'pointer' }}>
          <ChevronLeft size={16} strokeWidth={1.75} /><Caps size={10} color={T.iron500}>Dashboard</Caps>
        </div>
        <div style={{ width: 1, height: 24, background: T.iron200 }} />
        <div style={{ width: 34, height: 34, borderRadius: 999, background: T.iron900, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 800, fontSize: 13 }}>AS</div>
        <div>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15 }}>{C360.name}</div>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.iron400 }}>{C360.id} · {C360.city}</span>
        </div>
        <span style={{ padding: '3px 9px', borderRadius: 999, background: T.greenTint, color: T.green, border: '1px solid #CBE5D6', fontFamily: T.headline, fontWeight: 700, fontSize: 9.5, letterSpacing: '.06em' }}>2 IN WARRANTY</span>
        <div style={{ flex: 1 }} />
        <button style={{ background: T.orange, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>New Ticket</button>
      </header>

      {/* contact strip */}
      <div style={{ background: T.white, borderBottom: `1px solid ${T.iron200}`, padding: '10px 22px', display: 'flex', gap: 28 }}>
        {[['PHONE', C360.phone], ['EMAIL', C360.email], ['VIA DEALER', C360.dealer]].map(([l, v]) => (
          <div key={l}><Caps size={8.5} color={T.iron400}>{l}</Caps><div style={{ fontSize: 12.5, marginTop: 2, fontFamily: l === 'PHONE' ? T.mono : T.body }}>{v}</div></div>
        ))}
      </div>

      {/* tabs */}
      <div style={{ background: T.white, borderBottom: `1px solid ${T.iron200}`, padding: '0 22px', display: 'flex', gap: 22 }}>
        {tabs.map((t) => (
          <div key={t} onClick={() => setTab(t)} style={{ padding: '12px 2px', cursor: 'pointer', borderBottom: `2px solid ${tab === t ? T.orange : 'transparent'}`,
            fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, color: tab === t ? T.iron900 : T.iron400 }}>{t}</div>
        ))}
      </div>

      <main style={{ padding: 22, display: 'grid', gridTemplateColumns: (tab === 'Overview' ? '1.4fr 1fr' : '1fr'), gap: 16, alignItems: 'start' }}>
        {(tab === 'Overview' || tab === 'Tickets') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {tab === 'Overview' && (
              <SectionCard title="Registered Products">
                {C360.products.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: i < C360.products.length - 1 ? `1px solid ${T.iron200}` : 'none' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 6, background: T.iron900 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5 }}>{p.name}</div>
                      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.iron400 }}>{p.serial} · bought {p.bought}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontFamily: T.headline, fontWeight: 700, fontSize: 9, letterSpacing: '.06em',
                        background: p.in ? T.greenTint : T.iron100, color: p.in ? T.green : T.iron500, border: `1px solid ${p.in ? '#CBE5D6' : T.iron200}` }}>{p.in ? 'IN WARRANTY' : 'EXPIRED'}</span>
                      <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.iron400, marginTop: 4 }}>till {p.till}</div>
                    </div>
                  </div>
                ))}
              </SectionCard>
            )}
            <SectionCard title="Ticket History">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {C360.tickets.map((t, i) => (
                    <tr key={i} className="mgp-row" style={{ borderBottom: i < C360.tickets.length - 1 ? `1px solid ${T.iron200}` : 'none' }}>
                      <td style={{ padding: '9px 14px', fontFamily: T.mono, fontWeight: 700, fontSize: 11.5, width: 78 }}>{t.id}</td>
                      <td style={{ padding: '9px 6px', fontSize: 11.5, color: T.iron700 }}>{t.issue}</td>
                      <td style={{ padding: '9px 6px', width: 90 }}><StatusPill s={t.status} /></td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: T.mono, fontSize: 10.5, color: T.iron400, width: 74 }}>{t.res}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          </div>
        )}
        {(tab === 'Overview' || tab === 'Dispatches') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionCard title="Replacement Dispatches">
              {C360.dispatches.map((d, i) => (
                <div key={i} style={{ padding: '11px 14px', borderBottom: i < C360.dispatches.length - 1 ? `1px solid ${T.iron200}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 11.5 }}>{d.docket}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontFamily: T.headline, fontWeight: 700, fontSize: 9, letterSpacing: '.06em',
                      background: d.status === 'Delivered' ? T.greenTint : T.blueTint, color: d.status === 'Delivered' ? T.green : T.blue, border: `1px solid ${d.status === 'Delivered' ? '#CBE5D6' : '#CBE0F0'}` }}>{d.status.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.iron700, marginTop: 4 }}>{d.item}</div>
                  <Caps size={9} color={T.iron400} ls=".06em" style={{ marginTop: 2, display: 'block' }}>{d.courier} · {d.eta}</Caps>
                </div>
              ))}
            </SectionCard>
            {tab === 'Overview' && (
              <SectionCard title="Activity">
                {C360.activity.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '11px 14px', borderBottom: i < C360.activity.length - 1 ? `1px solid ${T.iron200}` : 'none' }}>
                    <div style={{ width: 6, height: 6, borderRadius: 999, background: T.orange, marginTop: 5 }} />
                    <div>
                      <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.iron400 }}>{a.at} · {a.by}</span>
                      <div style={{ fontSize: 11.5, color: T.iron700, marginTop: 2 }}>{a.note}</div>
                    </div>
                  </div>
                ))}
              </SectionCard>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function RedesignPreview() {
  const [screen, setScreen] = useState('dashboard');
  const LABELS = { dashboard: 'Dashboard', customer360: 'Customer 360', login: 'Login' };
  return (
    <div className="mgp" style={{ fontFamily: T.body }}>
      <Fonts />
      {/* preview switcher (not part of the design) */}
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 50, display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(20,20,20,.92)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, padding: '6px 8px' }}>
        <Caps size={8.5} color={T.orange} ls=".14em">Preview · 1a Iron Console</Caps>
        {['dashboard', 'customer360', 'login'].map((s) => (
          <button key={s} onClick={() => setScreen(s)} style={{ border: 'none', cursor: 'pointer', borderRadius: 6, padding: '4px 10px',
            background: screen === s ? T.orange : 'transparent', color: screen === s ? '#fff' : '#c9c9c9', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}>{LABELS[s]}</button>
        ))}
      </div>
      {screen === 'dashboard' ? <Dashboard /> : screen === 'customer360' ? <Customer360 /> : <Login />}
    </div>
  );
}

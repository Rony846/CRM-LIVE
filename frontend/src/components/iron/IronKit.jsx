import React from 'react';

/* Shared design kit for the MuscleGrid "Iron Console" (redesign direction 1a).
   Tokens, fonts, small primitives, and the admin nav — imported by every Iron page. */

export const T = {
  orange: '#F58220', orangeDeep: '#D96A0A', iron900: '#1A1A1A', iron700: '#3A3A3A', iron500: '#6B6B6B',
  iron400: '#9A9A9A', iron200: '#E6E6E6', iron100: '#F2F2F1', iron50: '#FAFAF8', white: '#FFFFFF',
  voltage: '#F4C518', voltageTint: '#FBF3D9', voltageText: '#8A6D00', blue: '#0B6FB8', blueTint: '#E8F1F8',
  green: '#1F8A4C', greenTint: '#E9F4EE', rose: '#C2410C', sidebar: '#161616',
  mono: "'JetBrains Mono', ui-monospace, monospace", headline: "'Inter Tight', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif", display: "'Saira Condensed', system-ui, sans-serif",
};

// Force embedded shadcn-token components (PowerSearch overlay, banners) into the light
// Iron-Console palette even though the app's active theme is dark.
export const LIGHT_VARS = {
  '--background': '220 25% 99%', '--foreground': '222 47% 11%',
  '--card': '0 0% 100%', '--card-foreground': '222 47% 11%',
  '--popover': '0 0% 100%', '--popover-foreground': '222 47% 11%',
  '--primary': '28 91% 54%', '--primary-foreground': '0 0% 100%',
  '--secondary': '30 20% 96%', '--secondary-foreground': '222 47% 11%',
  '--muted': '40 12% 95%', '--muted-foreground': '220 5% 42%',
  '--accent': '30 40% 96%', '--accent-foreground': '222 47% 11%',
  '--border': '30 8% 90%', '--input': '30 8% 90%', '--ring': '28 91% 54%',
};

export const Fonts = () => (
  <style>{`
    @import url("https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@700;800&family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap");
    .iron *{box-sizing:border-box} .iron-row:hover{background:${T.iron50}} .iron-nav:hover{background:rgba(255,255,255,.05)}
  `}</style>
);

export const Caps = ({ children, size = 9, color = T.iron400, ls = '.14em', style }) => (
  <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: size, letterSpacing: ls, textTransform: 'uppercase', color, ...style }}>{children}</span>
);

export const IronCard = ({ children, style, pad = 14 }) => (
  <div style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, boxShadow: '0 1px 2px rgba(15,15,15,.06)', padding: pad, ...style }}>{children}</div>
);

export const initials = (n) => (n || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const mono = { fontFamily: T.mono, fontVariantNumeric: 'tabular-nums' };
export const thCell = { textAlign: 'left', padding: '7px 12px' };
export const tdCell = { padding: '10px 12px', fontSize: 12, color: T.iron700, verticalAlign: 'top' };

export const badgeStyle = (tone) => {
  const map = {
    ok: [T.greenTint, T.green, '#CBE5D6'], info: [T.blueTint, T.blue, '#CBE0F0'],
    warn: [T.voltageTint, T.voltageText, '#EDDFA6'], bad: ['#FDEEE6', T.orangeDeep, '#F6D8BA'],
    violet: ['#EEE9F7', '#6D4AB0', '#DDD3EF'], slate: [T.iron100, T.iron700, T.iron200],
  };
  const [bg, fg, bd] = map[tone] || map.slate;
  return { background: bg, color: fg, border: `1px solid ${bd}`, padding: '2px 8px', borderRadius: 999,
    fontFamily: T.headline, fontWeight: 700, fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'inline-block' };
};

// Ticket status -> label + pill tone (collapses the many raw statuses to legible chips).
const STATUS_TONE = {
  new_request: ['New Request', 'bad'], call_support_followup: ['Call Support Followup', 'info'],
  resolved_on_call: ['Resolved on Call', 'ok'], closed_by_agent: ['Closed by Agent', 'ok'],
  closed: ['Closed', 'slate'], hardware_service: ['Hardware Service', 'bad'],
  awaiting_label: ['Awaiting Label', 'warn'], label_uploaded: ['Label Uploaded', 'info'],
  received_at_factory: ['Received at Factory', 'violet'], in_repair: ['In Repair', 'slate'],
  repair_completed: ['Repair Completed', 'ok'], ready_for_dispatch: ['Ready for Dispatch', 'ok'],
  dispatched: ['Dispatched', 'ok'], escalated_to_supervisor: ['Escalated', 'bad'],
  customer_escalated: ['Customer Escalated', 'bad'], supervisor_followup: ['Supervisor Followup', 'warn'],
};
export const ticketPill = (status) => {
  const [label, tone] = STATUS_TONE[status] || [(status || 'Unknown').replace(/_/g, ' '), 'slate'];
  return { label, style: badgeStyle(tone) };
};

export const fmtDateTime = (d) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return '-'; }
};

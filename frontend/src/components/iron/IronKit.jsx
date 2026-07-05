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

/* Complete admin navigation (mirrors the legacy DashboardLayout menu so no option is lost).
   Grouped; rendered collapsibly by IronSidebar. [groupLabel, [ [itemLabel, path], ... ] ] */
export const IRON_ADMIN_NAV = [
  ['Ship Desk', [['Ship Desk', '/ship-desk']]],
  ['Dashboard', [['Overview', '/admin'], ['Compliance', '/admin/compliance']]],
  ['Team Dashboards', [['Call Support', '/support'], ['Supervisor', '/supervisor'], ['Technician', '/technician'], ['Accountant', '/accountant'], ['Dispatcher', '/dispatcher'], ['Gate', '/gate']]],
  ['CRM', [['All Tickets', '/admin/tickets'], ['Call Center', '/calls'], ['Omnidim Calls', '/admin/omnidim-calls'], ['Customer WhatsApp', '/admin/whatsapp-chats'], ['Sales Leads', '/leads'], ['Repairs', '/admin/repairs'], ['Customers', '/admin/customers'], ['Customer 360', '/customer-360'], ['Warranties', '/admin/warranties'], ['Zoho Desk', '/admin/zoho-tickets'], ['Zoho Forms', '/admin/zoho-forms']]],
  ['Solar Samrat', [['Samrat Admin', '/admin/solar-samrat']]],
  ['Sales', [['Orders', '/admin/orders'], ['Quotations', '/quotations'], ['PI Pending Action', '/quotations/pending-action']]],
  ['Inventory', [['Master SKUs', '/admin/master-sku'], ['Firms', '/admin/firms'], ['Serial Numbers', '/inventory/serial-numbers'], ['Stock Reports', '/admin/reports'], ['Product Datasheets', '/admin/product-datasheets']]],
  ['Operations', [['Amazon Orders', '/operations/amazon-orders'], ['SKU Weights', '/admin/sku-weights'], ['File Repository', '/admin/file-repository'], ['Courier Shipping', '/operations/courier-shipping'], ['Courier Tracking', '/operations/courier-tracking'], ['Incoming Queue', '/accountant/incoming-queue'], ['Inventory', '/accountant/inventory'], ['Battery Production', '/admin/supervisor-production'],['Dispatch Queue', '/view/dispatch-queue']]],
  ['Folders', [['Order Folders', '/admin/orders-folders']]],
  ['Online Store', [['Products', '/admin/store-products'], ['Store Orders', '/admin/online-orders']]],
  ['Shopify', [['Orders', '/admin/online-orders?tab=shopify'], ['Products', '/admin/online-orders?tab=products']]],
  ['Browser Agents', [['EBAY UP Browser', '/admin/browser-agent/a9b65de0-ef07-47d7-b778-2a9f63ef52ab'], ['SPV Browser', '/admin/browser-agent/c715c1b7-aca3-4100-8b00-4f711a729829'], ['Electronics Bay Browser', '/admin/browser-agent/76b41510-bb17-42be-887f-abcbfd9f4180'], ['MuscleGrid Gurgaon Browser', '/admin/browser-agent/8bf93db6-045f-4aed-988c-352103ed049d'], ['MGIPL Bigship Browser', '/admin/browser-agent/16abb602-875d-4283-bed9-f8789e688a17']]],
  ['Finance', [['Finance Analytics', '/finance/analytics'], ['Finance & GST', '/finance'], ['Online Orders', '/admin/online-orders'], ['Amazon Refunds', '/admin/refunds'], ['Refund Losses (Legal)', '/admin/refund-losses'], ['A-Z Claims', '/admin/az-claims'], ['Legal Cases', '/admin/legal-cases'], ['TDS Management', '/finance/tds'], ['GST / HSN', '/finance/gst-hsn'], ['GST Audit', '/finance/gst-audit'], ['Amazon Unmapped', '/admin/amazon-unmapped'], ['Bank Match', '/finance/reconciliation'], ['E-commerce Recon', '/finance/ecommerce-reconciliation'], ['Import Costing', '/finance/import-costing'], ['Importer Reconciliation', '/admin/importer-reconciliation'], ['Bank Reconciliation', '/finance/bank-reconciliation'], ['Unbooked Receipts', '/finance/unbooked-receipts'], ['Sales Register', '/accountant/sales'], ['Purchase Register', '/accountant/purchases'], ['Party Master', '/admin/parties'], ['Party Ledger', '/accountant/ledger'], ['Payments', '/accountant/payments'], ['Expenses & Tax Credits', '/accountant/expenses'], ['Credit Notes', '/accountant/credit-notes'], ['Accounting Reports', '/accountant/reports'], ['Reconciliation', '/accountant/reconciliation']]],
  ['Agents', [['Email Agent', '/admin/email-agent'], ['Finance Agent', '/agents/finance'], ['Watch Live', '/agents/finance/watch'], ['Data Inbox', '/agents/finance/inbox']]],
  ['HR & Payroll', [['Salary & Payroll', '/admin/payroll'], ['Employees', '/admin/employees'], ['Attendance', '/admin/attendance'], ['Incentives', '/admin/incentives'], ['Users', '/admin/users']]],
  ['Dealer Portal', [['Applications', '/admin/dealer-applications'], ['All Dealers', '/admin/dealers'], ['Dealer Orders', '/admin/dealer-applications?tab=orders'], ['Dealer Products', '/admin/dealer-applications?tab=products'], ['Warranty Claims', '/admin/warranty-claims'], ['Spare Parts Catalog', '/admin/spare-parts'], ['Spare Orders', '/admin/spare-orders'], ['T&C Audit', '/admin/dealer-terms']]],
  ['System', [['WhatsApp Agent', '/admin/whatsapp-agent'], ['Analytics', '/admin/analytics'], ['Activity Logs', '/admin/activity-logs'], ['Scheduled Jobs', '/admin/cron-runs'], ['Knowledge Base', '/admin/knowledge-base'], ['QA Scorecards', '/supervisor/qa-scorecards'], ['Smartflo Agents', '/admin/smartflo-agents'], ['Amazon Settings', '/admin/amazon-settings'], ['Data Management', '/admin/data-management'], ['Gate Logs', '/admin/gate-logs'], ['Files for Claude', '/admin/files-for-claude'], ['Review Rescue', '/admin/review-rescue']]],
];

// Mirrors the legacy DashboardLayout supervisor menu exactly (all 11 items) + Customer 360.
export const IRON_SUPERVISOR_NAV = [
  ['Workspace', [
    ['Ship Desk', '/ship-desk'],
    ['Dashboard', '/supervisor'],
    ['Customer 360', '/customer-360'],
    ['Call Center', '/calls'],
    ['QA Scorecards', '/supervisor/qa-scorecards'],
    ['Knowledge Base', '/admin/knowledge-base'],
    ['Warranties', '/supervisor/warranties'],
    ['Calendar', '/supervisor/calendar'],
    ['Dispatch Queue', '/view/dispatch-queue'],
    ['My Attendance', '/my-attendance'],
  ]],
];

// Call-support menu (mirrors the legacy DashboardLayout call_support menu) + Customer 360.
export const IRON_SUPPORT_NAV = [
  ['Workspace', [
    ['Dashboard', '/support'],
    ['Customer 360', '/customer-360'],
    ['My Calls', '/calls'],
    ['Ticket Queue', '/support/tickets'],
    ['Create Ticket', '/support/create'],
    ['Sales Leads', '/leads'],
    ['Quotations', '/quotations'],
    ['Create Quotation', '/quotations/new'],
    ['Dispatch Queue', '/view/dispatch-queue'],
    ['My Incentives', '/my-incentives'],
    ['My Attendance', '/my-attendance'],
  ]],
];

export const IRON_ACCOUNTANT_NAV = [
  ['Ship Desk', [['Ship Desk', '/ship-desk']]],
  ['Dashboard', [['Overview', '/accountant'], ['Compliance', '/admin/compliance']]],
  ['Marketplace', [['Amazon Orders', '/operations/amazon-orders'], ['Courier Shipping', '/operations/courier-shipping'], ['Courier Tracking', '/operations/courier-tracking'], ['E-commerce Recon', '/finance/ecommerce-reconciliation'], ['Expenses & Tax Credits', '/accountant/expenses']]],
  ['Finance', [['Finance Analytics', '/finance/analytics'], ['Finance & GST', '/finance'], ['Online Orders', '/admin/online-orders'], ['Amazon Refunds', '/admin/refunds'], ['Refund Losses (Legal)', '/admin/refund-losses'], ['A-Z Claims', '/admin/az-claims'], ['Legal Cases', '/admin/legal-cases'], ['TDS Management', '/finance/tds'], ['GST / HSN', '/finance/gst-hsn'], ['GST Audit', '/finance/gst-audit'], ['Amazon Unmapped', '/admin/amazon-unmapped'], ['Bank Match', '/finance/reconciliation'], ['Sales Register', '/accountant/sales'], ['Purchase Register', '/accountant/purchases'], ['Party Master', '/admin/parties'], ['Party Ledger', '/accountant/ledger'], ['Payments', '/accountant/payments'], ['Credit Notes', '/accountant/credit-notes'], ['Reports', '/accountant/reports'], ['Reconciliation', '/accountant/reconciliation']]],
  ['Agents', [['Finance Agent', '/agents/finance'], ['Data Inbox', '/agents/finance/inbox']]],
  ['Sales', [['Quotations', '/quotations'], ['PI Pending Action', '/quotations/pending-action']]],
  ['Operations', [['Incoming Queue', '/accountant/incoming-queue'], ['Inventory', '/accountant/inventory'], ['Serial Numbers', '/inventory/serial-numbers'], ['Battery Production', '/admin/supervisor-production'],['Master SKUs', '/admin/master-sku'], ['Product Datasheets', '/admin/product-datasheets']]],
  ['Folders', [['Order Folders', '/admin/orders-folders']]],
];

export const IRON_TECHNICIAN_NAV = [['Workspace', [['Ship Desk', '/ship-desk'], ['Dashboard', '/technician'], ['Repair Queue', '/technician/queue'], ['My Repairs', '/technician/my-repairs'], ['Dispatch Queue', '/view/dispatch-queue'], ['My Attendance', '/my-attendance']]]];
export const IRON_DISPATCHER_NAV = [['Workspace', [['Ship Desk', '/ship-desk'], ['Dashboard', '/dispatcher'], ['Dispatch Queue', '/dispatcher/queue'], ['Courier Shipping', '/operations/courier-shipping'], ['Courier Tracking', '/operations/courier-tracking'], ['TV Mode', '/dispatcher/tv'], ['My Attendance', '/my-attendance']]]];
export const IRON_GATE_NAV = [['Workspace', [['Dashboard', '/gate'], ['Scan Parcel', '/gate/scan'], ['Gate Logs', '/gate/logs'], ['Scheduled', '/gate/scheduled'], ['Dispatch Queue', '/view/dispatch-queue'], ['My Attendance', '/my-attendance']]]];
export const IRON_CUSTOMER_NAV = [['Workspace', [['Dashboard', '/customer'], ['My Quotations', '/customer/quotations'], ['My Tickets', '/customer/tickets'], ['Create Ticket', '/customer/tickets/new'], ['Book Appointment', '/customer/appointments'], ['Register Warranty', '/customer/warranty/register'], ['My Warranties', '/customer/warranties']]]];
export const IRON_DEALER_NAV = [['Workspace', [['Dashboard', '/dealer'], ['Customer Book', '/dealer/customers'], ['Product Catalogue', '/dealer/catalogue'], ['Place Order', '/dealer/orders/new'], ['My Orders', '/dealer/orders'], ['Track Dispatches', '/dealer/dispatches'], ['Reorder Suggestions', '/dealer/reorder-suggestions'], ['Sales Targets', '/dealer/targets'], ['Warranty Registration', '/dealer/warranty'], ['Warranty Claims', '/dealer/warranty-claims'], ['Spare Parts', '/dealer/spare-parts'], ['Spare Orders', '/dealer/spare-orders'], ['Announcements', '/dealer/announcements'], ['Ledger', '/dealer/ledger'], ['Performance', '/dealer/performance'], ['Certificate', '/dealer/certificate'], ['Downloads', '/dealer/documents'], ['My Profile', '/dealer/profile'], ['Deposit Status', '/dealer/deposit'], ['Support Tickets', '/dealer/tickets'], ['Promotions', '/dealer/promotions'], ['Dealer Agreement', '/dealer/terms']]]];

// Pick the right sidebar for whoever is viewing (admin sees the full admin menu).
export const NAV_BY_ROLE = {
  admin: IRON_ADMIN_NAV, supervisor: IRON_SUPERVISOR_NAV, call_support: IRON_SUPPORT_NAV,
  accountant: IRON_ACCOUNTANT_NAV, technician: IRON_TECHNICIAN_NAV, service_agent: IRON_TECHNICIAN_NAV,
  dispatcher: IRON_DISPATCHER_NAV, gate: IRON_GATE_NAV, customer: IRON_CUSTOMER_NAV, dealer: IRON_DEALER_NAV,
};
export const ROLE_LABEL = {
  admin: 'Admin Console', supervisor: 'Supervisor', call_support: 'Call Support', accountant: 'Accounts',
  technician: 'Technician', service_agent: 'Technician', dispatcher: 'Dispatch', gate: 'Gate',
  customer: 'Customer Portal', dealer: 'Dealer Portal',
};

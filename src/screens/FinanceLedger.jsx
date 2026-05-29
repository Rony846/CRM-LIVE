import Icon from '../lib/icon';

// Faithful port of stitch finance_party_ledger_gst/code.html (₹ for the GST
// domain). Sample ledger; live party-scoped wiring comes in the next pass.
const LEDGER = [
  { date: '2026-05-24', id: 'INV-88921', type: 'SALES INVOICE', tone: 'primary', debit: '₹1,200.00', credit: '--', bal: '₹4,650.00' },
  { date: '2026-05-21', id: 'PYMT-4402', type: 'PAYMENT RECEIVED', tone: 'success', debit: '--', credit: '₹3,500.00', bal: '₹3,450.00' },
  { date: '2026-05-18', id: 'INV-88845', type: 'SALES INVOICE', tone: 'primary', debit: '₹6,950.00', credit: '--', bal: '₹6,950.00' },
  { date: '2026-05-05', id: 'CRN-1102', type: 'CREDIT NOTE', tone: 'warning', debit: '--', credit: '₹150.00', bal: '₹0.00' },
];

const TONE = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
};

function Kpi({ label, value, valueClass = 'text-text-primary', bar, barColor, sub, subIcon, subClass }) {
  return (
    <div className="bg-surface-card border border-border-subtle p-stack-md rounded-xl">
      <span className="font-label-caps text-label-caps text-text-secondary">{label}</span>
      <div className="flex items-baseline gap-unit mt-unit">
        <span className={`font-display-kpi text-display-kpi ${valueClass}`}>{value}</span>
      </div>
      {bar != null && (
        <div className="w-full bg-surface-variant h-1 mt-stack-sm rounded-full overflow-hidden">
          <div className={`${barColor} h-full`} style={{ width: `${bar}%` }} />
        </div>
      )}
      {sub && (
        <div className={`mt-stack-sm flex items-center gap-unit ${subClass}`}>
          {subIcon && <Icon name={subIcon} style={{ fontSize: 14 }} />}
          <span className="text-label-caps font-label-caps">{sub}</span>
        </div>
      )}
    </div>
  );
}

export default function FinanceLedger() {
  return (
    <div className="px-margin-mobile space-y-stack-lg">
      {/* Party select + actions */}
      <section className="space-y-stack-md">
        <div>
          <label className="font-label-caps text-label-caps text-text-secondary mb-unit block">SELECT PARTY</label>
          <div className="relative">
            <Icon name="search" className="absolute left-stack-md top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text" defaultValue="Industrial Logistics Corp" placeholder="Search Customer or Supplier…"
              className="w-full h-touch-target bg-surface-container border border-border-subtle rounded-lg pl-12 pr-stack-md focus:border-primary focus:ring-1 focus:ring-primary/15 transition-all text-text-primary outline-none"
            />
          </div>
        </div>
        <div className="flex gap-stack-sm">
          <button className="h-touch-target flex-1 px-stack-md bg-surface-container-high border border-border-subtle rounded-lg flex items-center justify-center gap-stack-sm active:scale-95">
            <Icon name="download" className="text-info" />
            <span className="font-body-bold text-body-bold">Export PDF</span>
          </button>
          <button className="h-touch-target flex-1 px-stack-md bg-primary-container text-on-primary-container rounded-lg flex items-center justify-center gap-stack-sm active:scale-95 transition-all">
            <Icon name="receipt_long" />
            <span className="font-body-bold text-body-bold">GST Report</span>
          </button>
        </div>
      </section>

      {/* KPI grid */}
      <section className="grid grid-cols-2 gap-gutter">
        <Kpi label="TOTAL SALES" value="₹42,850" bar={70} barColor="bg-success" />
        <Kpi label="TOTAL RECEIVED" value="₹38,200" bar={88} barColor="bg-primary" />
        <Kpi label="CURRENT BALANCE" value="₹4,650" valueClass="text-warning" sub="DUE IN 4 DAYS" subIcon="schedule" subClass="text-warning" />
        <Kpi label="GST ACCRUED" value="₹7,713" valueClass="text-info" sub="Q1 FILING PENDING" subClass="text-text-secondary" />
      </section>

      {/* Chronological ledger */}
      <section className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden">
        <div className="p-stack-md border-b border-border-subtle flex justify-between items-center bg-surface-container-low">
          <h3 className="font-headline-card text-headline-card text-text-primary">Chronological Ledger</h3>
          <span className="font-body-bold text-body-bold text-primary text-[12px]">MAY 1 – 29</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-high border-b border-border-heavy">
              <tr>
                {['DATE', 'TXN ID', 'TYPE', 'DEBIT (+)', 'CREDIT (−)', 'BALANCE'].map((h, i) => (
                  <th key={h} className={`px-stack-md py-stack-md font-label-caps text-label-caps text-text-secondary whitespace-nowrap ${i >= 3 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {LEDGER.map((r) => (
                <tr key={r.id} className="hover:bg-surface-container-high transition-colors">
                  <td className="px-stack-md py-stack-md font-mono-data text-mono-data whitespace-nowrap">{r.date}</td>
                  <td className="px-stack-md py-stack-md font-mono-data text-mono-data text-primary">{r.id}</td>
                  <td className="px-stack-md py-stack-md">
                    <span className={`border text-label-caps font-label-caps px-stack-sm py-0.5 rounded whitespace-nowrap ${TONE[r.tone]}`}>{r.type}</span>
                  </td>
                  <td className="px-stack-md py-stack-md font-mono-data text-mono-data text-right text-success whitespace-nowrap">{r.debit}</td>
                  <td className="px-stack-md py-stack-md font-mono-data text-mono-data text-right text-error whitespace-nowrap">{r.credit}</td>
                  <td className="px-stack-md py-stack-md font-mono-data text-mono-data text-right text-text-primary font-bold whitespace-nowrap">{r.bal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-stack-md bg-surface-container-low border-t border-border-subtle flex justify-center">
          <button className="text-label-caps font-label-caps text-primary hover:underline">LOAD PREVIOUS TRANSACTIONS</button>
        </div>
      </section>
    </div>
  );
}

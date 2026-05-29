import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../lib/icon';
import { api } from '../lib/api';

// Faithful port of stitch accountant_portal/code.html. KPIs + quick actions +
// incoming queue. Tries GET /api/incoming-queue; falls back to sample rows.
const SAMPLE_QUEUE = [
  { id: 'lot-8829', title: 'Lot #8829 - Zenith Tech', sub: 'Incoming • QC Pending', tag: 'GOOD INVENTORY', tone: 'blue', actions: true },
  { id: 'rma-4412', title: 'RMA-4412 - Client Alpha', sub: 'Return Logged', tag: 'RETURN - GOOD', tone: 'green', actions: false },
  { id: 'batch-901', title: 'Batch #901 - Factory West', sub: 'Damage Reported', tag: 'RETURN - DEFECTIVE', tone: 'error', actions: false },
];

const TONE = {
  blue: 'bg-blue-500/15 text-blue-400',
  green: 'bg-green-500/15 text-green-400',
  error: 'bg-error/15 text-error',
};

const ACTIONS = [
  { icon: 'qr_code_scanner', label: 'Gate Scans', primary: true },
  { icon: 'label', label: 'Dispatch Labels' },
  { icon: 'inventory', label: 'Purchase Reg.' },
  { icon: 'point_of_sale', label: 'Sales Reg.' },
];

function Kpi({ label, value, sub, subClass = 'text-text-secondary', span }) {
  return (
    <div className={`p-stack-md bg-surface-card border border-border-subtle rounded-xl flex flex-col justify-between ${span ? 'col-span-2' : ''}`}>
      <span className="font-label-caps text-label-caps text-text-secondary uppercase">{label}</span>
      <div className="mt-stack-sm">
        <div className="font-display-kpi text-display-kpi text-on-surface">{value}</div>
        <div className={`font-mono-data-sm text-mono-data-sm ${subClass}`}>{sub}</div>
      </div>
    </div>
  );
}

export default function AccountantPortal() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState(SAMPLE_QUEUE);
  const [live, setLive] = useState(false);
  const [counts, setCounts] = useState({ pending: 24, dispatches: 12, trx: 142, outstanding: '₹64,280' });

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const data = await api('/incoming-queue');
        const list = Array.isArray(data) ? data : data?.items || data?.queue;
        if (!off && Array.isArray(list) && list.length) {
          setQueue(list.slice(0, 8).map((r) => ({
            id: r.id || r.tracking_id,
            title: `${r.tracking_id || r.id} — ${r.party_name || r.courier || 'Incoming'}`,
            sub: `Incoming • ${r.status || 'QC Pending'}`,
            tag: (r.classification_type || 'UNCLASSIFIED').replace('_', ' ').toUpperCase(),
            tone: 'blue', actions: true,
          })));
          setCounts((c) => ({ ...c, pending: list.length }));
          setLive(true);
        }
      } catch { /* keep sample */ }
    })();
    return () => { off = true; };
  }, []);

  return (
    <div className="px-margin-mobile space-y-stack-lg">
      <section className="grid grid-cols-2 gap-gutter">
        <Kpi label="Pending Incoming" value={String(counts.pending)} sub={live ? 'live · gate scans' : 'Gate scans required'} />
        <Kpi label="Pending Dispatches" value={String(counts.dispatches)} sub="Labels to generate" subClass="text-warning" />
        <Kpi label="Today's Trx" value={String(counts.trx)} sub="Processed" subClass="text-success" />
        <Kpi label="Outstanding Balances" value={counts.outstanding} sub="38 Accounts" span />
      </section>

      <section className="space-y-stack-md">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-card text-headline-card text-text-primary">Incoming Queue</h2>
          <button onClick={() => navigate('/accountant/ledger')} className="text-primary flex items-center gap-unit">
            <span className="font-label-caps text-label-caps">LEDGER</span>
            <Icon name="arrow_forward" style={{ fontSize: 18 }} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-stack-sm">
          {ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => a.label === 'Gate Scans' && navigate('/accountant/classify')}
              className={`flex flex-col items-center justify-center p-stack-md rounded-xl gap-unit border ${a.primary ? 'bg-primary-container/10 border-primary/20' : 'bg-surface-container-high border-border-subtle'}`}
            >
              <Icon name={a.icon} className={a.primary ? 'text-primary' : 'text-on-surface-variant'} />
              <span className="text-[11px] font-bold uppercase tracking-wider">{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-stack-sm">
        {queue.map((q) => (
          <div key={q.id} className={`bg-surface-card border border-border-subtle rounded-xl overflow-hidden ${q.actions ? '' : 'opacity-80'}`}>
            <div className="p-stack-md flex justify-between items-start">
              <div className="space-y-unit">
                <div className="font-body-bold text-on-surface">{q.title}</div>
                <div className="font-mono-data text-mono-data text-text-secondary">{q.sub}</div>
              </div>
              <span className={`px-2 py-0.5 rounded font-label-caps text-[10px] ${TONE[q.tone]}`}>{q.tag}</span>
            </div>
            {q.actions && (
              <div className="px-stack-md pb-stack-md flex gap-stack-sm">
                <button className="flex-1 py-2 bg-surface-container-high rounded text-xs font-bold">REJECT</button>
                <button onClick={() => navigate('/accountant/classify')} className="flex-1 py-2 bg-primary text-on-primary rounded text-xs font-bold">CLASSIFY</button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

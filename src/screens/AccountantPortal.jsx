import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../lib/icon';
import { api } from '../lib/api';

// Faithful port of stitch accountant_portal_financial_core — the colorful
// accountant dashboard (compliance meter + purchases/sales chart + bento +
// incoming queue). Incoming list tries GET /api/incoming-queue (sample fallback).
const SAMPLE = [
  { id: 'lot-8829', title: 'Lot #8829 - Zenith Tech', sub: 'Incoming • QC Pending', icon: 'inventory_2', prio: 'PRIORITY', prioCls: 'bg-warning/20 text-warning border-warning/30', tag: 'GOOD INVENTORY', tagCls: 'bg-blue-500/15 text-blue-400', actions: true },
  { id: 'rma-4412', title: 'RMA-4412 - Client Alpha', sub: 'Return Logged', icon: 'assignment_return', prio: 'STANDARD', prioCls: 'bg-surface-container-highest text-text-secondary border-border-subtle', tag: 'RETURN - GOOD', tagCls: 'bg-green-500/15 text-green-400', actions: false },
  { id: 'batch-901', title: 'Batch #901 - Factory West', sub: 'Damage Reported', icon: 'warning', prio: 'URGENT', prioCls: 'bg-error/20 text-error border-error/30', tag: 'RETURN - DEFECTIVE', tagCls: 'bg-error/15 text-error', actions: false },
];

const CHART = [
  { day: 'Mon', buy: 60, sell: 80 }, { day: 'Tue', buy: 40, sell: 90 },
  { day: 'Wed', buy: 70, sell: 50 }, { day: 'Thu', buy: 90, sell: 100 },
];
const TABS = ['Queue', 'Inventory', 'Ledger', 'Compliance'];
const ACTIONS = [
  { icon: 'qr_code_scanner', label: 'Gate Scans', primary: true },
  { icon: 'label', label: 'Dispatch Labels' },
  { icon: 'inventory', label: 'Purchase Reg.' },
  { icon: 'point_of_sale', label: 'Sales Reg.' },
];

export default function AccountantPortal() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('Queue');
  const [queue, setQueue] = useState(SAMPLE);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const data = await api('/incoming-queue');
        const list = Array.isArray(data) ? data : data?.items || data?.queue;
        if (!off && Array.isArray(list) && list.length) {
          setQueue(list.slice(0, 8).map((r, i) => ({
            id: r.id || r.tracking_id || `row-${i}`,
            realId: r.id, raw: r,
            title: `${r.tracking_id || r.id} — ${r.customer_name || r.courier || 'Incoming'}`,
            sub: `Incoming • ${r.status || 'QC Pending'}`,
            icon: 'inventory_2',
            prio: 'PRIORITY', prioCls: 'bg-warning/20 text-warning border-warning/30',
            tag: (r.classification_type || 'UNCLASSIFIED').replace('_', ' ').toUpperCase(),
            tagCls: 'bg-blue-500/15 text-blue-400', actions: true,
          })));
        }
      } catch { /* keep sample */ }
    })();
    return () => { off = true; };
  }, []);

  return (
    <div className="px-margin-mobile space-y-stack-lg">
      {/* Compliance Health */}
      <section className="bg-surface-card border border-border-subtle rounded-xl p-stack-md flex flex-col gap-unit">
        <div className="flex justify-between items-center">
          <span className="font-label-caps text-label-caps text-text-secondary uppercase">Compliance Health</span>
          <span className="text-success font-body-bold">92%</span>
        </div>
        <div className="w-full bg-surface-container-high rounded-full h-2 mt-1">
          <div className="bg-success h-2 rounded-full" style={{ width: '92%' }} />
        </div>
        <span className="font-mono-data-sm text-mono-data-sm text-text-secondary">Document Verification Status</span>
      </section>

      {/* Pivot tabs */}
      <div className="flex overflow-x-auto gap-stack-sm pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => (t === 'Ledger' ? navigate('/accountant/ledger') : setTab(t))}
            className={`px-4 py-2 rounded-full font-label-caps text-label-caps whitespace-nowrap transition-colors ${
              tab === t ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-high text-on-surface-variant border border-border-subtle'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Financial Overview chart */}
      <section className="bg-surface-card border border-border-subtle rounded-xl p-stack-md space-y-stack-sm">
        <h2 className="font-headline-card text-headline-card text-text-primary">Financial Overview</h2>
        <div className="flex justify-between items-end h-32 pt-4">
          {CHART.map((c) => (
            <div key={c.day} className="flex flex-col items-center gap-1 w-1/4">
              <div className="flex gap-1 items-end h-20 w-full justify-center">
                <div className="w-3 bg-info rounded-t-sm" style={{ height: `${c.buy}%` }} />
                <div className="w-3 bg-primary rounded-t-sm" style={{ height: `${c.sell}%` }} />
              </div>
              <span className="font-mono-data-sm text-mono-data-sm text-text-secondary">{c.day}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-4 pt-2">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-info" /><span className="font-mono-data-sm text-mono-data-sm text-text-secondary">Purchases</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary" /><span className="font-mono-data-sm text-mono-data-sm text-text-secondary">Sales</span></div>
        </div>
      </section>

      {/* Bento KPIs */}
      <section className="grid grid-cols-2 gap-gutter">
        <div className="p-stack-md bg-surface-card border border-border-subtle rounded-xl flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <span className="font-label-caps text-label-caps text-text-secondary uppercase">Pending Incoming</span>
            <Icon name="local_shipping" className="text-primary" />
          </div>
          <div>
            <div className="font-display-kpi text-display-kpi text-on-surface">{queue.length}</div>
            <div className="font-mono-data-sm text-mono-data-sm text-text-secondary">Gate scans required</div>
          </div>
        </div>
        <div className="p-stack-md bg-surface-card border border-border-subtle rounded-xl flex flex-col justify-between">
          <span className="font-label-caps text-label-caps text-text-secondary uppercase">Pending Dispatches</span>
          <div className="mt-stack-sm">
            <div className="font-display-kpi text-display-kpi text-on-surface">12</div>
            <div className="font-mono-data-sm text-mono-data-sm text-warning">Labels to generate</div>
          </div>
        </div>
        <div className="col-span-2 p-stack-md bg-surface-card border border-border-subtle rounded-xl flex flex-col justify-between">
          <span className="font-label-caps text-label-caps text-text-secondary uppercase">Outstanding Balances</span>
          <div className="mt-stack-sm flex justify-between items-end">
            <div className="font-display-kpi text-display-kpi text-error">₹64,280.50</div>
            <div className="font-mono-data text-mono-data text-text-secondary">38 Accounts</div>
          </div>
        </div>
      </section>

      {/* Incoming queue actions */}
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
              className={`flex flex-col items-center justify-center p-stack-md rounded-xl gap-unit border ${a.primary ? 'bg-primary/10 border-primary/20' : 'bg-surface-container-high border-border-subtle hover:border-primary/50'}`}
            >
              <Icon name={a.icon} className={a.primary ? 'text-primary' : 'text-on-surface-variant'} fill={a.primary} />
              <span className={`text-[11px] font-bold uppercase tracking-wider ${a.primary ? 'text-primary' : ''}`}>{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Transaction list */}
      <section className="space-y-stack-sm">
        {queue.map((q) => (
          <div key={q.id} className={`bg-surface-card border border-border-subtle rounded-xl overflow-hidden ${q.actions ? '' : 'opacity-90'}`}>
            <div className="p-stack-md flex gap-stack-sm items-start">
              <div className="w-12 h-12 rounded bg-surface-container flex-shrink-0 flex items-center justify-center border border-border-subtle">
                <Icon name={q.icon} className="text-on-surface-variant" />
              </div>
              <div className="flex-1 min-w-0 space-y-unit">
                <div className="flex justify-between gap-2">
                  <div className="font-body-bold text-on-surface truncate">{q.title}</div>
                  <span className={`px-2 py-0.5 rounded font-label-caps text-[10px] border shrink-0 ${q.prioCls}`}>{q.prio}</span>
                </div>
                <div className="font-mono-data text-mono-data text-text-secondary">{q.sub}</div>
                <span className={`inline-block px-2 py-0.5 rounded font-label-caps text-[10px] ${q.tagCls}`}>{q.tag}</span>
              </div>
            </div>
            {q.actions && (
              <div className="px-stack-md pb-stack-md flex gap-stack-sm">
                <button className="flex-1 py-2 bg-surface-container-high rounded text-xs font-bold border border-border-subtle">REJECT</button>
                <button onClick={() => navigate(`/accountant/classify/${q.realId || q.id}`, { state: { entry: q.raw } })} className="flex-1 py-2 bg-primary text-on-primary rounded text-xs font-bold shadow-md transition-colors">CLASSIFY</button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

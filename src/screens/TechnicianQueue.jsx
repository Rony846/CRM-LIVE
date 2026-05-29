import { useEffect, useState } from 'react';
import Icon from '../lib/icon';
import { api } from '../lib/api';

// Faithful port of stitch technician_repair_queue/code.html. Tries the live
// CRM endpoint; falls back to sample cards so the screen always renders.
const SAMPLE = [
  { ticket_number: 'MG-R-20260321-01602', customer_name: 'Marcus Thorne', device: 'Industrial Inverter V4', priority: 'Urgent', sla: '04:12:45', risk: 'critical' },
  { ticket_number: 'MG-R-20260321-01648', customer_name: 'Sarah Jenkins', device: 'L-Series Battery Pack', priority: 'Standard', sla: '58:20:12', risk: 'ontrack' },
  { ticket_number: 'MG-R-20260321-01692', customer_name: 'Atlas Logistics Corp', device: 'Solar Controller X', priority: 'Standard', sla: '72:00:00', risk: 'ontrack' },
];

function TabButton({ active, children }) {
  return (
    <button className={`flex-1 py-2 px-4 rounded-lg font-body-bold text-body-bold transition-all active:scale-95 ${active ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-primary'}`}>
      {children}
    </button>
  );
}

function TicketCard({ t }) {
  const critical = t.risk === 'critical';
  return (
    <div className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden active:scale-[0.98] transition-transform">
      <div className={`p-stack-md border-b border-border-subtle flex justify-between items-start ${critical ? 'bg-error-container/5' : ''}`}>
        <div>
          <p className="font-mono-data text-mono-data text-primary mb-1">{t.ticket_number}</p>
          <h3 className="font-headline-card text-headline-card text-text-primary">{t.customer_name}</h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`font-label-caps text-label-caps px-2 py-1 rounded uppercase ${critical ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>
            {critical ? 'Critical SLA' : 'On Track'}
          </span>
          <div className={`flex items-center gap-1 ${critical ? 'text-error' : 'text-on-surface-variant'}`}>
            <Icon name="schedule" style={{ fontSize: 16 }} />
            <span className="font-mono-data text-mono-data">{t.sla}</span>
          </div>
        </div>
      </div>
      <div className="p-stack-md flex flex-col gap-stack-sm">
        <div className="flex items-center gap-stack-md">
          <div className="flex flex-col flex-1">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Device Type</span>
            <span className="font-body-bold text-body-bold text-text-primary">{t.device}</span>
          </div>
          <div className="flex flex-col flex-1">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Priority</span>
            <span className={`font-body-bold text-body-bold ${t.priority === 'Urgent' ? 'text-warning' : 'text-on-surface-variant'}`}>{t.priority}</span>
          </div>
        </div>
        <button className="w-full h-touch-target bg-primary-container text-on-primary-container font-body-bold text-body-bold rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform mt-2">
          <Icon name="play_arrow" />
          Start Work
        </button>
      </div>
    </div>
  );
}

export default function TechnicianQueue() {
  const [tickets, setTickets] = useState(SAMPLE);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api('/technician/queue');
        const list = Array.isArray(data) ? data : data?.tickets || data?.queue;
        if (!cancelled && Array.isArray(list) && list.length) {
          setTickets(list.map((t) => ({
            ticket_number: t.ticket_number || t.id,
            customer_name: t.customer_name || t.customer?.name || 'Customer',
            device: t.device_type || t.product_name || 'Device',
            priority: t.priority === 'urgent' || t.priority === 'high' ? 'Urgent' : 'Standard',
            sla: t.sla_remaining || '—',
            risk: t.sla_breached || t.priority === 'urgent' ? 'critical' : 'ontrack',
          })));
          setLive(true);
        }
      } catch { /* keep sample data */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const critical = tickets.filter((t) => t.risk === 'critical').length;

  return (
    <div className="p-margin-mobile flex flex-col gap-stack-lg">
      <section className="grid grid-cols-2 gap-stack-md">
        <div className="bg-surface-card border border-border-subtle p-stack-md rounded-lg">
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-stack-sm">Active Queue</p>
          <div className="flex items-baseline gap-stack-sm">
            <span className="font-display-kpi text-display-kpi text-primary">{String(tickets.length).padStart(2, '0')}</span>
            <span className="font-mono-data-sm text-mono-data-sm text-success">{live ? 'live' : 'demo'}</span>
          </div>
        </div>
        <div className="bg-surface-card border border-border-subtle p-stack-md rounded-lg">
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-stack-sm">SLA Risk</p>
          <div className="flex items-baseline gap-stack-sm">
            <span className="font-display-kpi text-display-kpi text-error">{String(critical).padStart(2, '0')}</span>
            <span className="font-mono-data-sm text-mono-data-sm text-error">Critical</span>
          </div>
        </div>
      </section>

      <nav className="flex p-1 bg-surface-container-low border border-border-subtle rounded-xl">
        <TabButton active>My Repairs</TabButton>
        <TabButton>Unassigned</TabButton>
      </nav>

      <div className="flex flex-col gap-stack-md">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-card text-headline-card text-text-primary">Repair Queue</h2>
          <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-container px-2 py-1 rounded">
            IN_REPAIR ({String(tickets.length).padStart(2, '0')})
          </span>
        </div>
        {tickets.map((t) => <TicketCard key={t.ticket_number} t={t} />)}
      </div>
    </div>
  );
}

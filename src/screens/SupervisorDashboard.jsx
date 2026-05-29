import { useEffect, useState } from 'react';
import Icon from '../lib/icon';
import { api } from '../lib/api';
import { GlassKpi, GradientHeader, GlassPanel } from '../components/Glass';

// Supervisor portal — real CRM data: stats (GET /api/supervisor/stats) +
// escalation queue (GET /api/supervisor/queue). Actions (resolve / spare /
// escalate via POST /api/tickets/{id}/supervisor-action) are demo-safe here.
const STATUS_TONE = {
  escalated_to_supervisor: 'glass-badge-primary text-primary',
  supervisor_followup: 'bg-warning/15 text-warning border border-warning/20',
  customer_escalated: 'bg-error/15 text-error border border-error/20',
};

export default function SupervisorDashboard() {
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [tab, setTab] = useState('all');
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    let off = false;
    (async () => {
      try { const s = await api('/supervisor/stats'); if (!off) setStats(s); } catch { /* */ }
      try { const q = await api('/supervisor/queue'); if (!off) setQueue(Array.isArray(q) ? q : q?.tickets || []); } catch { /* */ }
    })();
    return () => { off = true; };
  }, []);

  const v = (n) => (n == null ? '…' : n.toLocaleString('en-IN'));
  const shown = tab === 'urgent' ? queue.filter((t) => t.status === 'customer_escalated') : queue;

  const act = (label, t) => setFlash(`Demo: would POST /tickets/${t.ticket_number}/supervisor-action { action: "${label}" }. Live action kept off against production.`);

  return (
    <div className="relative px-margin-mobile space-y-stack-lg">
      <GradientHeader title="Supervisor" subtitle="Escalations & actions" />

      {/* KPIs (real) */}
      <div className="relative z-10 grid grid-cols-2 gap-gutter">
        <GlassKpi label="Escalated" value={v(stats?.escalated_tickets)} icon="priority_high" accent="primary" sub="Awaiting supervisor" />
        <GlassKpi label="Customer Escalated" value={v(stats?.customer_escalated)} icon="sentiment_dissatisfied" accent="error" pulse sub="No update" />
        <GlassKpi label="Urgent" value={v(stats?.urgent_tickets)} icon="bolt" accent="warning" />
        <GlassKpi label="Resolved Today" value={v(stats?.resolved_today)} icon="task_alt" accent="success" />
      </div>

      {/* Filter tabs */}
      <div className="relative z-10 flex p-1 bg-surface-container-low/60 border border-border-subtle rounded-xl">
        {[['all', 'All Escalations'], ['urgent', 'Customer Escalated']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2 rounded-lg font-body-bold text-body-bold transition-all active:scale-95 ${tab === k ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}>
            {l}
          </button>
        ))}
      </div>

      {flash && (
        <div className="relative z-10 flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-stack-sm text-info">
          <Icon name="info" style={{ fontSize: 18 }} />
          <p className="font-mono-data text-mono-data">{flash}</p>
        </div>
      )}

      {/* Escalation queue (real) */}
      <div className="relative z-10 space-y-stack-md">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-card text-headline-card text-text-primary">Escalation Queue</h2>
          <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-container px-2 py-1 rounded">{shown.length}</span>
        </div>
        {shown.length === 0 && <div className="glass-panel rounded-2xl p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">Queue is clear 🎉</div>}
        {shown.slice(0, 15).map((t) => (
          <div key={t.id || t.ticket_number} className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-stack-md border-b border-border-subtle/40 flex justify-between items-start">
              <div className="min-w-0">
                <p className="font-mono-data text-mono-data text-primary mb-1">{t.ticket_number}</p>
                <h3 className="font-headline-card text-headline-card text-text-primary truncate">{t.customer_name || 'Customer'}</h3>
              </div>
              <span className={`px-2 py-1 rounded font-label-caps text-[10px] uppercase shrink-0 ${STATUS_TONE[t.status] || 'bg-surface-container-highest/40 text-on-surface-variant border border-border-subtle'}`}>
                {(t.status || '').replace(/_/g, ' ') || 'open'}
              </span>
            </div>
            <div className="p-stack-md flex flex-col gap-stack-sm">
              <div className="flex items-center gap-stack-md">
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Device</span>
                  <span className="font-body-bold text-body-bold text-text-primary truncate">{t.device_type || t.product_name || '—'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Phone</span>
                  <span className="font-mono-data text-mono-data text-text-primary">{t.customer_phone || '—'}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-stack-sm mt-1">
                <button onClick={() => act('resolve', t)} className="py-2 bg-success/15 text-success rounded-lg text-xs font-bold active:scale-95 transition-transform">Resolve</button>
                <button onClick={() => act('spare_dispatch', t)} className="py-2 glass-badge-primary text-primary rounded-lg text-xs font-bold active:scale-95 transition-transform">Spare Part</button>
                <button onClick={() => act('escalate', t)} className="py-2 bg-warning/15 text-warning rounded-lg text-xs font-bold active:scale-95 transition-transform">Escalate</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

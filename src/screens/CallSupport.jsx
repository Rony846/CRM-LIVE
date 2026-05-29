import { useEffect, useState } from 'react';
import Icon from '../lib/icon';
import { api } from '../lib/api';
import { GlassKpi, GradientHeader, GlassPanel } from '../components/Glass';

// Call-support dashboard — live: GET /api/call-support/stats (feedback calls) +
// GET /api/tickets (incoming ticket queue). Read-only view for now.
const TONE = {
  new_request: 'glass-badge-info text-info',
  call_support_followup: 'bg-warning/15 text-warning border border-warning/20',
  escalated_to_supervisor: 'bg-error/15 text-error border border-error/20',
};

export default function CallSupport() {
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [tab, setTab] = useState('new_request');

  useEffect(() => {
    let off = false;
    (async () => {
      try { const s = await api('/call-support/stats'); if (!off) setStats(s); } catch { /* */ }
    })();
    return () => { off = true; };
  }, []);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const t = await api(`/tickets?status=${tab}`);
        const list = Array.isArray(t) ? t : t?.tickets || [];
        if (!off) setTickets(list.slice(0, 20));
      } catch { if (!off) setTickets([]); }
    })();
    return () => { off = true; };
  }, [tab]);

  const v = (n) => (n == null ? '…' : n);

  return (
    <div className="relative px-margin-mobile space-y-stack-lg">
      <GradientHeader title="Call Support" subtitle="Incoming tickets & feedback calls" />

      <div className="relative z-10 grid grid-cols-2 gap-gutter">
        <GlassKpi label="Pending Feedback" value={v(stats?.pending_feedback_calls)} icon="call" accent="warning" pulse={!!stats?.pending_feedback_calls} sub="Calls to make" />
        <GlassKpi label="My Completed" value={v(stats?.my_completed_feedback_calls)} icon="task_alt" accent="success" sub="Feedback calls" />
      </div>

      <div className="relative z-10 flex p-1 bg-surface-container-low/60 border border-border-subtle rounded-xl">
        {[['new_request', 'New'], ['call_support_followup', 'Follow-up']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2 rounded-lg font-body-bold text-body-bold transition-all active:scale-95 ${tab === k ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}>{l}</button>
        ))}
      </div>

      <GlassPanel title="Ticket Queue" icon="confirmation_number" right={<span className="font-mono-data text-mono-data text-text-secondary">{tickets.length}</span>}>
        <div className="divide-y divide-border-subtle/30 max-h-[60vh] overflow-y-auto">
          {tickets.length === 0 && <div className="p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">No tickets in this queue.</div>}
          {tickets.map((t) => (
            <div key={t.id || t.ticket_number} className="px-stack-md py-stack-md flex items-center gap-stack-md hover:bg-surface-container-high/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-info/10 border border-info/20 flex items-center justify-center shrink-0">
                <Icon name="support_agent" className="text-info" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body-bold text-text-primary truncate">{t.customer_name || 'Customer'}</p>
                <p className="font-mono-data text-text-secondary text-[11px] truncate">{t.ticket_number} · {t.device_type || t.support_type || '—'}</p>
              </div>
              <span className={`px-2 py-1 rounded font-label-caps text-[10px] uppercase shrink-0 ${TONE[t.status] || 'bg-surface-container-highest/40 text-on-surface-variant border border-border-subtle'}`}>
                {(t.status || '').replace(/_/g, ' ') || 'open'}
              </span>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

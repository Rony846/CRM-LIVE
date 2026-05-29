import { useEffect, useState } from 'react';
import Icon from '../lib/icon';
import { api } from '../lib/api';
import { GlassKpi, GradientHeader, ReadOnlyBadge } from '../components/Glass';
import Modal from '../components/Modal';
import { WRITE_ENABLED, READONLY_MSG } from '../lib/flags';

// Supervisor portal — live CRM data + LIVE actions.
// Actions POST form-encoded to /api/tickets/{id}/supervisor-action
// (notes must be >= 100 chars; spare_dispatch needs a SKU).
const STATUS_TONE = {
  escalated_to_supervisor: 'glass-badge-primary text-primary',
  supervisor_followup: 'bg-warning/15 text-warning border border-warning/20',
  customer_escalated: 'bg-error/15 text-error border border-error/20',
};
const MIN_NOTES = 100;
const ACTIONS = {
  resolve: { label: 'Resolve', icon: 'task_alt', cls: 'bg-success/15 text-success' },
  spare_dispatch: { label: 'Spare Part', icon: 'inventory_2', cls: 'glass-badge-primary text-primary' },
  in_process: { label: 'In Process', icon: 'pending_actions', cls: 'bg-warning/15 text-warning' },
};

export default function SupervisorDashboard() {
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [tab, setTab] = useState('all');
  const [modal, setModal] = useState(null); // { ticket, action }
  const [notes, setNotes] = useState('');
  const [sku, setSku] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');

  const refresh = async () => {
    try { const s = await api('/supervisor/stats'); setStats(s); } catch { /* */ }
    try { const q = await api('/supervisor/queue'); setQueue(Array.isArray(q) ? q : q?.tickets || []); } catch { /* */ }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const v = (n) => (n == null ? '…' : n.toLocaleString('en-IN'));
  const shown = tab === 'urgent' ? queue.filter((t) => t.status === 'customer_escalated') : queue;

  const openAction = (action, ticket) => { setModal({ action, ticket }); setNotes(''); setSku(''); setErr(''); };

  const submit = async () => {
    if (busy || !modal) return;
    if (!WRITE_ENABLED) { setErr(READONLY_MSG); return; }
    if (notes.trim().length < MIN_NOTES) { setErr(`Notes must be at least ${MIN_NOTES} characters.`); return; }
    if (modal.action === 'spare_dispatch' && !sku.trim()) { setErr('SKU is required for a spare-part dispatch.'); return; }
    setBusy(true); setErr('');
    try {
      const form = { action: modal.action, notes: notes.trim() };
      if (modal.action === 'spare_dispatch') form.sku = sku.trim();
      const r = await api(`/tickets/${modal.ticket.id}/supervisor-action`, { method: 'POST', form });
      setToast(r.message || `${ACTIONS[modal.action].label} done`);
      setModal(null);
      await refresh();
      setTimeout(() => setToast(''), 4000);
    } catch (e) {
      setErr(e.data?.detail || e.message || 'Action failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="relative px-margin-mobile space-y-stack-lg">
      <GradientHeader title="Supervisor" subtitle="Escalations & actions" action={<ReadOnlyBadge />} />

      <div className="relative z-10 grid grid-cols-2 gap-gutter">
        <GlassKpi label="Escalated" value={v(stats?.escalated_tickets)} icon="priority_high" accent="primary" sub="Awaiting supervisor" />
        <GlassKpi label="Customer Escalated" value={v(stats?.customer_escalated)} icon="sentiment_dissatisfied" accent="error" pulse sub="No update" />
        <GlassKpi label="Urgent" value={v(stats?.urgent_tickets)} icon="bolt" accent="warning" />
        <GlassKpi label="Resolved Today" value={v(stats?.resolved_today)} icon="task_alt" accent="success" />
      </div>

      <div className="relative z-10 flex p-1 bg-surface-container-low/60 border border-border-subtle rounded-xl">
        {[['all', 'All Escalations'], ['urgent', 'Customer Escalated']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2 rounded-lg font-body-bold text-body-bold transition-all active:scale-95 ${tab === k ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}>
            {l}
          </button>
        ))}
      </div>

      {toast && (
        <div className="relative z-10 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-stack-sm text-success">
          <Icon name="check_circle" style={{ fontSize: 18 }} />
          <p className="font-mono-data text-mono-data">{toast}</p>
        </div>
      )}

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
                {Object.entries(ACTIONS).map(([key, a]) => (
                  <button key={key} onClick={() => openAction(key, t)} className={`py-2 rounded-lg text-xs font-bold active:scale-95 transition-transform ${a.cls}`}>{a.label}</button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action modal — real mutation */}
      <Modal
        open={!!modal} onClose={() => !busy && setModal(null)}
        title={modal ? `${ACTIONS[modal.action].label} · ${modal.ticket.ticket_number}` : ''}
        icon={modal ? ACTIONS[modal.action].icon : undefined}
        footer={modal && (
          <>
            <button onClick={() => setModal(null)} disabled={busy} className="flex-1 h-touch-target rounded-lg bg-surface-container-high text-text-primary font-body-bold disabled:opacity-50">Cancel</button>
            <button onClick={submit} disabled={busy || notes.trim().length < MIN_NOTES}
              className="flex-1 h-touch-target rounded-lg bg-gradient-to-r from-primary-container to-inverse-primary text-on-primary-container font-body-bold disabled:opacity-50">
              {busy ? 'Submitting…' : 'Confirm'}
            </button>
          </>
        )}
      >
        {modal && (
          <>
            <p className="font-body-base text-text-secondary text-sm">
              {modal.action === 'resolve' && 'Resolve this escalation. The customer ticket will be marked resolved.'}
              {modal.action === 'spare_dispatch' && 'Create a spare-part dispatch task for the accountant.'}
              {modal.action === 'in_process' && 'Mark in-process (follow-up required); SLA timer is reset.'}
            </p>
            {modal.action === 'spare_dispatch' && (
              <div className="flex flex-col gap-unit">
                <label className="font-label-caps text-label-caps text-text-secondary uppercase">SKU code</label>
                <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. MG-BAT-24100"
                  className="h-touch-target bg-surface-container border border-border-subtle rounded-lg px-stack-md text-on-surface font-mono-data outline-none focus:border-primary" />
              </div>
            )}
            <div className="flex flex-col gap-unit">
              <div className="flex justify-between">
                <label className="font-label-caps text-label-caps text-text-secondary uppercase">Notes (required)</label>
                <span className={`font-mono-data text-mono-data ${notes.trim().length < MIN_NOTES ? 'text-warning' : 'text-success'}`}>{notes.trim().length}/{MIN_NOTES}</span>
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={`Describe the action taken (min ${MIN_NOTES} characters)…`}
                className="bg-surface-container border border-border-subtle rounded-lg p-stack-md text-on-surface font-body-base outline-none focus:border-primary resize-none" />
            </div>
            {err && <div className="flex items-center gap-2 text-error font-mono-data text-mono-data"><Icon name="error" style={{ fontSize: 16 }} />{err}</div>}
          </>
        )}
      </Modal>
    </div>
  );
}

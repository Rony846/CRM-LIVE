import { useEffect, useState } from 'react';
import Icon from '../lib/icon';
import { api } from '../lib/api';
import { GlassKpi, GradientHeader, ReadOnlyBadge } from '../components/Glass';
import Modal from '../components/Modal';
import { WRITE_ENABLED, READONLY_MSG } from '../lib/flags';

// Technician repair queue (glass treatment) wired to the live CRM:
//  - Start Work   -> POST /api/tickets/{id}/start-repair
//  - Complete     -> POST /api/tickets/{id}/complete-repair (form: repair_notes,
//                    board_serial_number, device_serial_number)
// All writes gated behind WRITE_ENABLED (read-only by default).
const SAMPLE = [
  { id: 's1', ticket_number: 'MG-R-20260321-01602', customer_name: 'Marcus Thorne', device_type: 'Industrial Inverter V4', priority: 'high', status: 'received_at_factory', repair_sla_breached: true, repair_hours_remaining: 4 },
  { id: 's2', ticket_number: 'MG-R-20260321-01648', customer_name: 'Sarah Jenkins', device_type: 'L-Series Battery Pack', priority: 'medium', status: 'in_repair', repair_sla_breached: false, repair_hours_remaining: 58 },
];

function sla(t) {
  if (t.repair_sla_breached) return { label: 'Critical SLA', cls: 'bg-error/15 text-error', tone: 'text-error', critical: true };
  return { label: 'On Track', cls: 'bg-success/15 text-success', tone: 'text-on-surface-variant', critical: false };
}
const fmtH = (h) => (h == null ? '—' : `${Math.max(0, Math.round(h))}h`);

export default function TechnicianQueue() {
  const [tickets, setTickets] = useState(SAMPLE);
  const [live, setLive] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState('');
  const [complete, setComplete] = useState(null); // ticket being completed
  const [form, setForm] = useState({ repair_notes: '', board_serial_number: '', device_serial_number: '' });
  const [err, setErr] = useState('');

  const refresh = async () => {
    try {
      const data = await api('/technician/queue');
      const list = Array.isArray(data) ? data : data?.tickets || data?.queue;
      if (Array.isArray(list)) { setTickets(list); setLive(true); }
    } catch { /* keep current */ }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  const startWork = async (t) => {
    if (busyId) return;
    if (!WRITE_ENABLED) { flash(READONLY_MSG); return; }
    setBusyId(t.id);
    try { const r = await api(`/tickets/${t.id}/start-repair`, { method: 'POST' }); flash(r.message || 'Repair started'); await refresh(); }
    catch (e) { flash(e.data?.detail || e.message || 'Could not start'); }
    finally { setBusyId(null); }
  };

  const openComplete = (t) => { setComplete(t); setForm({ repair_notes: '', board_serial_number: '', device_serial_number: '' }); setErr(''); };

  const submitComplete = async () => {
    if (busyId) return;
    if (!WRITE_ENABLED) { setErr(READONLY_MSG); return; }
    if (!form.repair_notes.trim() || !form.board_serial_number.trim() || !form.device_serial_number.trim()) {
      setErr('Repair notes, board serial and device serial are all required.'); return;
    }
    setBusyId(complete.id);
    try {
      const r = await api(`/tickets/${complete.id}/complete-repair`, { method: 'POST', form });
      setComplete(null); flash(r.message || 'Repair completed'); await refresh();
    } catch (e) { setErr(e.data?.detail || e.message || 'Could not complete'); }
    finally { setBusyId(null); }
  };

  const critical = tickets.filter((t) => t.repair_sla_breached).length;
  const inRepair = tickets.filter((t) => t.status === 'in_repair').length;

  return (
    <div className="relative px-margin-mobile space-y-stack-lg">
      <GradientHeader title="Repair Queue" subtitle="Technician work queue" action={<ReadOnlyBadge />} />

      <div className="relative z-10 grid grid-cols-3 gap-gutter">
        <GlassKpi label="Active" value={tickets.length} icon="inventory_2" accent="primary" sub={live ? 'live' : 'demo'} />
        <GlassKpi label="In Repair" value={inRepair} icon="build" accent="info" />
        <GlassKpi label="SLA Risk" value={critical} icon="schedule" accent="error" pulse={critical > 0} />
      </div>

      {toast && (
        <div className="relative z-10 flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 p-stack-sm text-info">
          <Icon name="info" style={{ fontSize: 18 }} /><p className="font-mono-data text-mono-data">{toast}</p>
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-stack-md">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-card text-headline-card text-text-primary">My Repairs</h2>
          <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-container px-2 py-1 rounded">{tickets.length}</span>
        </div>
        {tickets.map((t) => {
          const s = sla(t);
          const started = t.status === 'in_repair';
          const busy = busyId === t.id;
          return (
            <div key={t.id} className="glass-panel rounded-2xl overflow-hidden">
              <div className={`p-stack-md border-b border-border-subtle/40 flex justify-between items-start ${s.critical ? 'bg-error-container/5' : ''}`}>
                <div className="min-w-0">
                  <p className="font-mono-data text-mono-data text-primary mb-1">{t.ticket_number}</p>
                  <h3 className="font-headline-card text-headline-card text-text-primary truncate">{t.customer_name}</h3>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`font-label-caps text-label-caps px-2 py-1 rounded uppercase ${s.cls}`}>{s.label}</span>
                  <div className={`flex items-center gap-1 ${s.tone}`}>
                    <Icon name="schedule" style={{ fontSize: 16 }} />
                    <span className="font-mono-data text-mono-data">{fmtH(t.repair_hours_remaining)}</span>
                  </div>
                </div>
              </div>
              <div className="p-stack-md flex flex-col gap-stack-sm">
                <div className="flex items-center gap-stack-md">
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Device</span>
                    <span className="font-body-bold text-body-bold text-text-primary truncate">{t.device_type || t.product_name || '—'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Priority</span>
                    <span className={`font-body-bold text-body-bold ${t.priority === 'high' || t.priority === 'urgent' ? 'text-warning' : 'text-on-surface-variant'}`}>{t.priority || 'standard'}</span>
                  </div>
                </div>
                {started ? (
                  <button onClick={() => openComplete(t)} disabled={busy}
                    className="w-full h-touch-target bg-gradient-to-r from-success/80 to-success text-on-primary font-body-bold text-body-bold rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
                    <Icon name="check_circle" /> Complete Repair
                  </button>
                ) : (
                  <button onClick={() => startWork(t)} disabled={busy}
                    className="w-full h-touch-target bg-primary-container text-on-primary-container font-body-bold text-body-bold rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
                    <Icon name="play_arrow" /> {busy ? 'Starting…' : 'Start Work'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!tickets.length && <div className="glass-panel rounded-2xl p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">Queue is clear 🎉</div>}
      </div>

      {/* Complete-repair modal — real mutation (gated) */}
      <Modal
        open={!!complete} onClose={() => !busyId && setComplete(null)}
        title={complete ? `Complete · ${complete.ticket_number}` : ''} icon="check_circle"
        footer={complete && (
          <>
            <button onClick={() => setComplete(null)} disabled={busyId} className="flex-1 h-touch-target rounded-lg bg-surface-container-high text-text-primary font-body-bold disabled:opacity-50">Cancel</button>
            <button onClick={submitComplete} disabled={busyId}
              className="flex-1 h-touch-target rounded-lg bg-gradient-to-r from-success/80 to-success text-on-primary font-body-bold disabled:opacity-50">{busyId ? 'Submitting…' : 'Complete'}</button>
          </>
        )}
      >
        {complete && (
          <>
            <div className="flex flex-col gap-unit">
              <label className="font-label-caps text-label-caps text-text-secondary uppercase">Board serial number</label>
              <input value={form.board_serial_number} onChange={(e) => setForm((f) => ({ ...f, board_serial_number: e.target.value }))} placeholder="Board S/N"
                className="h-touch-target bg-surface-container border border-border-subtle rounded-lg px-stack-md text-on-surface font-mono-data outline-none focus:border-primary" />
            </div>
            <div className="flex flex-col gap-unit">
              <label className="font-label-caps text-label-caps text-text-secondary uppercase">Device serial number</label>
              <input value={form.device_serial_number} onChange={(e) => setForm((f) => ({ ...f, device_serial_number: e.target.value }))} placeholder="Device S/N"
                className="h-touch-target bg-surface-container border border-border-subtle rounded-lg px-stack-md text-on-surface font-mono-data outline-none focus:border-primary" />
            </div>
            <div className="flex flex-col gap-unit">
              <label className="font-label-caps text-label-caps text-text-secondary uppercase">Repair notes</label>
              <textarea value={form.repair_notes} onChange={(e) => setForm((f) => ({ ...f, repair_notes: e.target.value }))} rows={3} placeholder="What was repaired…"
                className="bg-surface-container border border-border-subtle rounded-lg p-stack-md text-on-surface font-body-base outline-none focus:border-primary resize-none" />
            </div>
            {err && <div className="flex items-center gap-2 text-error font-mono-data text-mono-data"><Icon name="error" style={{ fontSize: 16 }} />{err}</div>}
          </>
        )}
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import Icon from '../lib/icon';
import { api } from '../lib/api';
import { GlassKpi, GradientHeader, GlassPanel, ReadOnlyBadge } from '../components/Glass';
import { WRITE_ENABLED, READONLY_MSG } from '../lib/flags';

// Gate control — real CRM data: scheduled incoming pickups (GET /api/gate/scheduled)
// + recent scan logs (GET /api/gate/logs). The scan itself (POST /api/gate/scan)
// changes ticket status (received_at_factory / dispatched), so it's kept
// demo-safe here (no live mutation against production).
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function GateDashboard() {
  const [scheduled, setScheduled] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState('inward');
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {ok, msg}

  const refresh = async () => {
    try { const s = await api('/gate/scheduled'); setScheduled(s?.scheduled_incoming || []); } catch { /* */ }
    try { const l = await api('/gate/logs?limit=8'); setLogs(Array.isArray(l) ? l : []); } catch { /* */ }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const today = todayISO();
  const scansToday = logs.filter((l) => (l.scanned_at || '').slice(0, 10) === today).length;
  const inwardCt = logs.filter((l) => l.scan_type === 'inward').length;
  const outwardCt = logs.filter((l) => l.scan_type === 'outward').length;

  const doScan = async () => {
    const id = tracking.trim();
    if (!id || busy) return;
    if (!WRITE_ENABLED) { setResult({ ok: false, msg: READONLY_MSG }); return; }
    setBusy(true); setResult(null);
    try {
      const r = await api('/gate/scan', { method: 'POST', body: { scan_type: tab, tracking_id: id } });
      const matched = r.ticket_number || r.dispatch_number;
      setResult({ ok: true, msg: `${tab === 'inward' ? 'Inward' : 'Outward'} scan recorded${matched ? ` · ${matched}` : ' (no ticket/dispatch matched)'}${r.status ? ` → ${r.status}` : ''}` });
      setTracking('');
      await refresh();
    } catch (e) {
      setResult({ ok: false, msg: e.data?.detail || e.message || 'Scan failed' });
    } finally { setBusy(false); }
  };

  return (
    <div className="relative px-margin-mobile space-y-stack-lg">
      <GradientHeader title="Gate Control" subtitle="Inward & outward scanning" action={<ReadOnlyBadge />} />

      {/* KPIs (real) */}
      <div className="relative z-10 grid grid-cols-2 gap-gutter">
        <GlassKpi label="Scheduled Incoming" value={scheduled.length} icon="local_shipping" accent="info" sub="Awaiting arrival" />
        <GlassKpi label="Scans Today" value={scansToday} icon="qr_code_scanner" accent="success" pulse sub="At the gate" />
        <GlassKpi label="Inward (recent)" value={inwardCt} icon="login" accent="primary" />
        <GlassKpi label="Outward (recent)" value={outwardCt} icon="logout" accent="warning" />
      </div>

      {/* Scan box */}
      <div className="relative z-10 glass-panel rounded-2xl p-stack-lg space-y-stack-md">
        <div className="flex p-1 bg-surface-container-low/60 border border-border-subtle rounded-xl">
          {['inward', 'outward'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg font-body-bold text-body-bold capitalize transition-all active:scale-95 ${tab === t ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="relative">
          <Icon name="qr_code_2" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Scan or enter tracking ID…"
            onKeyDown={(e) => e.key === 'Enter' && doScan()}
            className="w-full h-touch-target pl-12 pr-4 bg-surface-container border border-border-subtle rounded-lg text-on-surface font-mono-data focus:ring-2 focus:ring-primary/15 focus:border-primary outline-none"
          />
        </div>
        <button onClick={doScan} disabled={busy || !tracking.trim()}
          className="w-full h-touch-target bg-gradient-to-r from-primary-container to-inverse-primary text-on-primary-container font-body-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
          style={{ boxShadow: '0 8px 16px rgba(37,99,235,0.3)' }}>
          <Icon name="document_scanner" /> {busy ? 'Recording…' : `Record ${tab} scan`}
        </button>
        {result && (
          <div className={`flex items-start gap-2 rounded-lg border p-stack-sm ${result.ok ? 'border-success/30 bg-success/10 text-success' : 'border-error/30 bg-error/10 text-error'}`}>
            <Icon name={result.ok ? 'check_circle' : 'error'} style={{ fontSize: 18 }} />
            <p className="font-mono-data text-mono-data">{result.msg}</p>
          </div>
        )}
      </div>

      {/* Scheduled incoming (real) */}
      <GlassPanel title="Scheduled Incoming" icon="schedule" iconClass="text-info"
        right={<span className="font-mono-data text-mono-data text-text-secondary">{scheduled.length}</span>}>
        <div className="divide-y divide-border-subtle/30 max-h-80 overflow-y-auto">
          {scheduled.length === 0 && <div className="p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">Nothing scheduled.</div>}
          {scheduled.slice(0, 12).map((s, i) => (
            <div key={s.pickup_tracking || i} className="px-stack-md py-stack-md flex items-center gap-stack-md hover:bg-surface-container-high/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-info/10 border border-info/20 flex items-center justify-center shrink-0">
                <Icon name="inventory_2" className="text-info" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body-bold text-text-primary truncate">{s.customer_name || '—'}</p>
                <p className="font-mono-data text-text-secondary text-[11px] truncate">{s.ticket_number} · {s.pickup_tracking}</p>
              </div>
              <span className="glass-badge-info text-info px-2 py-1 rounded font-label-caps text-[10px] shrink-0">{s.pickup_courier || 'COURIER'}</span>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Recent logs (real) */}
      <GlassPanel title="Recent Scans" icon="receipt_long">
        <div className="divide-y divide-border-subtle/30">
          {logs.length === 0 && <div className="p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">No scans yet.</div>}
          {logs.map((l) => {
            const inward = l.scan_type === 'inward';
            return (
              <div key={l.id} className="px-stack-md py-stack-md flex items-center gap-stack-md">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${inward ? 'bg-primary/10 border-primary/20' : 'bg-warning/10 border-warning/20'}`}>
                  <Icon name={inward ? 'login' : 'logout'} className={inward ? 'text-primary' : 'text-warning'} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body-bold text-text-primary truncate">{l.customer_name || l.ticket_number || l.tracking_id}</p>
                  <p className="font-mono-data text-text-secondary text-[11px] truncate">{l.tracking_id} · {(l.scanned_at || '').slice(0, 16).replace('T', ' ')}</p>
                </div>
                <span className={`px-2 py-1 rounded font-label-caps text-[10px] uppercase shrink-0 ${inward ? 'glass-badge-primary text-primary' : 'bg-warning/15 text-warning border border-warning/20'}`}>{l.scan_type}</span>
              </div>
            );
          })}
        </div>
      </GlassPanel>
    </div>
  );
}

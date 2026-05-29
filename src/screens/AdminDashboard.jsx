import { useEffect, useState } from 'react';
import Icon from '../lib/icon';
import { api } from '../lib/api';
import { GlassKpi, GradientHeader, GlassPanel } from '../components/Glass';

// Admin control — all tiles are REAL CRM metrics from GET /api/admin/stats and
// GET /api/admin/users (no generic server/CPU telemetry; this is a CRM).
const ROLE_BADGE = {
  supervisor: { cls: 'glass-badge-primary text-primary', icon: 'supervisor_account', label: 'Supervisor' },
  call_support: { cls: 'glass-badge-info text-info', icon: 'support_agent', label: 'Call Support' },
  accountant: { cls: 'glass-badge-secondary text-secondary-container', icon: 'account_balance', label: 'Accountant' },
  service_agent: { cls: 'bg-success/10 text-success border border-success/20', icon: 'build', label: 'Technician' },
  gate: { cls: 'bg-info/10 text-info border border-info/20', icon: 'qr_code_scanner', label: 'Gate' },
  dispatcher: { cls: 'bg-warning/10 text-warning border border-warning/20', icon: 'local_shipping', label: 'Dispatcher' },
};
const roleBadge = (r) => ROLE_BADGE[r] || { cls: 'bg-surface-container-highest/40 text-on-surface-variant border border-border-subtle', icon: 'badge', label: (r || 'staff').replace('_', ' ') };

// Human labels + accent for the ticket-status breakdown bars.
const STATUS_META = {
  new_request: ['New', 'info'], in_progress: ['In Progress', 'primary'],
  escalated_to_supervisor: ['Escalated', 'warning'], supervisor_followup: ['Supervisor', 'warning'],
  customer_escalated: ['Cust. Escalated', 'error'], received_at_factory: ['At Factory', 'info'],
  in_repair: ['In Repair', 'primary'], repair_completed: ['Repaired', 'success'],
  awaiting_label: ['Awaiting Label', 'warning'], ready_for_dispatch: ['Ready Dispatch', 'success'],
  dispatched: ['Dispatched', 'success'], hardware_service: ['Hardware', 'info'],
};
const BAR = { primary: 'bg-primary', info: 'bg-info', warning: 'bg-warning', error: 'bg-error', success: 'bg-success' };

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [staff, setStaff] = useState([]);
  const [total, setTotal] = useState(null);

  useEffect(() => {
    let off = false;
    (async () => {
      try { const s = await api('/admin/stats'); if (!off) setStats(s); } catch { /* */ }
      try {
        const u = await api('/admin/users');
        const list = Array.isArray(u) ? u : u?.users || [];
        if (!off) { setStaff(list.slice(0, 6)); setTotal(list.length); }
      } catch { /* */ }
    })();
    return () => { off = true; };
  }, []);

  const v = (n) => (n == null ? '…' : n.toLocaleString('en-IN'));
  const byStatus = stats?.tickets_by_status || {};
  const statusRows = Object.entries(byStatus)
    .filter(([k]) => STATUS_META[k])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxStatus = Math.max(1, ...statusRows.map(([, n]) => n));
  // SLA compliance from real open vs breached counts
  const open = stats?.open_tickets || 0;
  const breached = stats?.sla_breaches || 0;
  const slaOk = open ? Math.round(((open - breached) / open) * 100) : 100;

  return (
    <div className="relative px-margin-mobile space-y-stack-lg">
      <GradientHeader
        title="Admin Control"
        subtitle="Live CRM operations & staff"
        action={
          <button className="h-touch-target px-stack-md glass-panel rounded-xl flex items-center gap-stack-sm text-text-primary active:scale-95 transition-all shrink-0">
            <Icon name="download" className="text-primary" />
            <span className="font-body-bold text-[12px]">Export</span>
          </button>
        }
      />

      {/* Real CRM KPIs */}
      <div className="relative z-10 grid grid-cols-2 gap-gutter">
        <GlassKpi label="Open Tickets" value={v(stats?.open_tickets)} icon="confirmation_number" accent="primary" sub={`${v(stats?.total_tickets)} all-time`} />
        <GlassKpi label="SLA Breaches" value={v(stats?.sla_breaches)} icon="schedule" accent="error" pulse sub="Past due" />
        <GlassKpi label="Today's Tickets" value={v(stats?.today_tickets)} icon="today" accent="info" sub={`${v(stats?.hardware_tickets)} HW · ${v(stats?.phone_tickets)} phone`} />
        <GlassKpi label="Customers" value={v(stats?.total_customers)} icon="groups" accent="secondary" sub={`${v(stats?.pending_warranties)} pending warranties`} />
      </div>

      {/* SLA / pending operations health (real ratios) */}
      <GlassPanel title="Operations Health" icon="health_and_safety" iconClass="text-success">
        <div className="p-stack-md space-y-stack-md">
          <div>
            <div className="flex justify-between items-end mb-unit">
              <span className="font-label-caps text-text-secondary uppercase">SLA On-Time (open tickets)</span>
              <span className={`font-mono-data ${slaOk >= 70 ? 'text-success' : slaOk >= 40 ? 'text-warning' : 'text-error'}`}>{slaOk}%</span>
            </div>
            <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-success to-info" style={{ width: `${slaOk}%`, boxShadow: '0 0 10px rgba(22,163,74,0.5)' }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-stack-md">
            {[['Warranties', stats?.pending_warranties, 'warning'], ['Extensions', stats?.pending_extensions, 'info'], ['Dispatches', stats?.pending_dispatches, 'primary']].map(([l, n, a]) => (
              <div key={l} className="text-center">
                <div className={`font-display-kpi text-3xl ${BAR[a].replace('bg-', 'text-')}`}>{v(n)}</div>
                <div className="font-label-caps text-label-caps text-text-secondary uppercase mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </GlassPanel>

      {/* Tickets by status (real breakdown) */}
      <GlassPanel title="Tickets by Status" icon="donut_large">
        <div className="p-stack-md space-y-stack-sm">
          {statusRows.length === 0 && <p className="text-center text-text-secondary font-mono-data text-mono-data py-4">Loading…</p>}
          {statusRows.map(([k, n]) => {
            const [label, accent] = STATUS_META[k];
            return (
              <div key={k}>
                <div className="flex justify-between items-center mb-unit">
                  <span className="font-body-base text-on-surface-variant">{label}</span>
                  <span className="font-mono-data text-mono-data text-text-primary">{v(n)}</span>
                </div>
                <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full ${BAR[accent]}`} style={{ width: `${Math.round((n / maxStatus) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </GlassPanel>

      {/* Staff Management (live /admin/users) */}
      <GlassPanel
        title="Staff Management" icon="groups"
        right={<span className="text-primary font-label-caps text-[11px] bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">{total ?? '…'} TOTAL</span>}
      >
        <div className="divide-y divide-border-subtle/30">
          {staff.length === 0 && <div className="p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">Loading staff…</div>}
          {staff.map((u) => {
            const b = roleBadge(u.role);
            const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
            return (
              <div key={u.id} className="px-stack-md py-stack-md flex items-center gap-stack-md hover:bg-surface-container-high/40 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-surface-container-highest border border-outline-variant flex items-center justify-center text-text-primary font-body-bold shadow-md shrink-0">
                  {`${u.first_name?.[0] || ''}${u.last_name?.[0] || ''}`.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body-bold text-text-primary truncate">{name}</p>
                  <p className="font-mono-data text-text-secondary opacity-80 text-[11px] truncate">{u.email}</p>
                </div>
                <span className={`px-2.5 py-1.5 rounded-lg font-label-caps text-[10px] tracking-wide inline-flex items-center gap-1 capitalize shrink-0 ${b.cls}`}>
                  <Icon name={b.icon} style={{ fontSize: 13 }} /> {b.label}
                </span>
              </div>
            );
          })}
        </div>
        {total != null && (
          <div className="px-stack-md py-stack-md bg-surface-container-low/30 border-t border-border-subtle/50 text-center">
            <span className="font-mono-data text-text-secondary text-[12px]">Showing {staff.length} of {total} employees</span>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

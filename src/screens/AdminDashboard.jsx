import { useEffect, useState } from 'react';
import Icon from '../lib/icon';
import { api } from '../lib/api';

// Faithful port of stitch admin_control_premium_dashboard (mobile content; the
// desktop sidebar is omitted for the mobile app). Glassmorphism + ambient glow.
const ROLE_BADGE = {
  supervisor: { cls: 'glass-badge-primary text-primary', icon: 'supervisor_account', label: 'Supervisor' },
  call_support: { cls: 'glass-badge-info text-info', icon: 'support_agent', label: 'Call Support' },
  accountant: { cls: 'glass-badge-secondary text-secondary-container', icon: 'account_balance', label: 'Accountant' },
};
const roleBadge = (role) => ROLE_BADGE[role] || { cls: 'bg-surface-container-highest/40 text-on-surface-variant border border-border-subtle', icon: 'badge', label: (role || 'staff').replace('_', ' ') };

function HealthBar({ label, value, pct, valueClass, barClass, glow }) {
  return (
    <div>
      <div className="flex justify-between items-end mb-unit">
        <span className="font-label-caps text-text-secondary uppercase">{label}</span>
        <span className={`font-mono-data ${valueClass}`}>{value}</span>
      </div>
      <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
        <div className={`${barClass} h-full`} style={{ width: `${pct}%`, boxShadow: glow }} />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [staff, setStaff] = useState([]);
  const [total, setTotal] = useState(null);
  const [maint, setMaint] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const data = await api('/admin/users');
        const list = Array.isArray(data) ? data : data?.users || [];
        if (!off) { setStaff(list.slice(0, 6)); setTotal(list.length); }
      } catch { /* leave empty */ }
    })();
    return () => { off = true; };
  }, []);

  return (
    <div className="relative px-margin-mobile space-y-stack-lg">
      {/* ambient glow */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-container/10 rounded-full blur-[120px] pointer-events-none -z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-info/10 rounded-full blur-[100px] pointer-events-none -z-0" />

      {/* page header */}
      <div className="relative z-10 flex items-end justify-between gap-stack-md">
        <div>
          <h1 className="font-display-kpi text-display-kpi uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-fixed to-info">Admin Control</h1>
          <p className="font-body-base text-text-secondary mt-1">System-wide config & staff permissions</p>
        </div>
        <button className="h-touch-target px-stack-md glass-panel rounded-xl flex items-center gap-stack-sm text-text-primary active:scale-95 transition-all shrink-0">
          <Icon name="data_object" className="text-primary" />
          <span className="font-body-bold text-[12px]">Export</span>
        </button>
      </div>

      {/* System Health */}
      <div className="relative z-10 glass-panel rounded-2xl p-stack-md space-y-stack-md">
        <div className="flex items-center gap-stack-sm">
          <Icon name="health_and_safety" className="text-success" />
          <h2 className="font-headline-card text-headline-card text-text-primary">System Health</h2>
        </div>
        <HealthBar label="CPU Usage" value="24%" pct={24} valueClass="text-success" barClass="bg-gradient-to-r from-success to-info" glow="0 0 10px rgba(22,163,74,0.5)" />
        <HealthBar label="Memory Load" value="68%" pct={68} valueClass="text-warning" barClass="bg-gradient-to-r from-warning to-secondary" glow="0 0 10px rgba(245,158,11,0.5)" />
        <HealthBar label="Network I/O" value="1.2 GB/s" pct={45} valueClass="text-info" barClass="bg-gradient-to-r from-info to-primary" glow="0 0 10px rgba(6,182,212,0.5)" />
      </div>

      {/* Settings bento */}
      <div className="relative z-10 grid grid-cols-1 gap-gutter">
        <div className="glass-panel p-stack-lg rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-warning/5 rounded-full blur-3xl -mr-10 -mt-10" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="font-label-caps text-label-caps text-warning/80 uppercase tracking-wider">System Status</p>
              <h3 className="font-headline-card text-headline-card text-text-primary mt-1">Maintenance Mode</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center border border-warning/20">
              <Icon name="construction" className="text-warning" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-stack-md relative z-10">
            <span className="font-body-base text-text-secondary">Disable Public Access</span>
            <button onClick={() => setMaint((m) => !m)}
              className={`w-14 h-7 rounded-full relative border transition-colors ${maint ? 'bg-warning/30 border-warning/40' : 'bg-surface-container-highest border-border-subtle'}`}>
              <div className={`absolute top-1 w-5 h-5 rounded-full shadow-md transition-transform ${maint ? 'left-1 translate-x-7 bg-warning' : 'left-1 bg-outline'}`} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-gutter">
          <div className="glass-panel p-stack-lg rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-info/5 rounded-full blur-3xl -mr-10 -mt-10" />
            <div className="flex justify-between items-start relative z-10">
              <p className="font-label-caps text-label-caps text-info/80 uppercase tracking-wider">Security</p>
              <Icon name="admin_panel_settings" className="text-info/50" />
            </div>
            <div className="flex items-baseline gap-stack-sm mt-stack-md relative z-10">
              <span className="font-display-kpi text-5xl text-text-primary">42</span>
              <span className="px-2 py-1 glass-badge-info text-info rounded text-xs font-bold">+5%</span>
            </div>
            <p className="font-body-base text-text-secondary text-sm mt-2 relative z-10">Active Sessions</p>
          </div>
          <div className="glass-panel p-stack-lg rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-3xl -mr-10 -mt-10" />
            <div className="flex justify-between items-start relative z-10">
              <p className="font-label-caps text-label-caps text-secondary/80 uppercase tracking-wider">Performance</p>
              <Icon name="speed" className="text-secondary/50" />
            </div>
            <div className="flex items-baseline gap-stack-sm mt-stack-md relative z-10">
              <span className="font-display-kpi text-5xl text-text-primary">12ms</span>
            </div>
            <div className="flex items-center gap-2 mt-3 relative z-10">
              <span className="w-2 h-2 rounded-full bg-success pulse-dot" />
              <span className="text-xs font-mono-data text-success">Optimal Routing</span>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Management (live) */}
      <div className="relative z-10 glass-panel rounded-2xl overflow-hidden">
        <div className="px-stack-md py-stack-md border-b border-border-subtle/50 flex justify-between items-center bg-surface-container-low/30">
          <div className="flex items-center gap-stack-sm">
            <Icon name="groups" className="text-primary" />
            <h2 className="font-headline-card text-headline-card text-text-primary">Staff Management</h2>
          </div>
          <span className="text-primary font-label-caps text-[11px] bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">{total ?? '…'} TOTAL</span>
        </div>
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
      </div>

      {/* Terminal / logs */}
      <div className="relative z-10 glass-panel p-stack-lg rounded-2xl bg-[#0a0e1a]/80">
        <div className="flex items-center gap-2 mb-stack-md border-b border-border-subtle/30 pb-3">
          <Icon name="terminal" className="text-outline" />
          <h3 className="font-mono-data text-text-primary uppercase tracking-wider">Terminal / Quick Logs</h3>
          <span className="ml-auto w-2 h-4 bg-primary animate-pulse" />
        </div>
        <div className="space-y-3 font-mono-data text-[13px]">
          <div className="flex items-start gap-3"><span className="text-success/70 shrink-0">[14:22]</span><span><span className="text-primary">SYSTEM</span>: Role update OK <span className="text-success">OK</span></span></div>
          <div className="flex items-start gap-3 opacity-70"><span className="text-text-secondary shrink-0">[14:05]</span><span className="text-outline">backup.sh complete in 4.2s</span></div>
          <div className="flex items-start gap-3"><span className="text-warning/70 shrink-0">[13:45]</span><span className="text-warning">WARN: high latency on EU_WEST_1</span></div>
        </div>
      </div>

      {/* Security lock */}
      <div className="relative z-10 glass-panel p-stack-lg rounded-2xl flex flex-col items-center gap-stack-md text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-container/10 to-transparent" />
        <div className="w-16 h-16 rounded-full bg-primary-container/20 flex items-center justify-center border border-primary-container/30 relative z-10" style={{ boxShadow: '0 0 20px rgba(37,99,235,0.2)' }}>
          <Icon name="security" className="text-primary" style={{ fontSize: 30 }} />
        </div>
        <div className="relative z-10">
          <h3 className="font-headline-card text-text-primary mb-1 text-xl">Admin Security Lock</h3>
          <p className="font-body-base text-text-secondary">Prevent all non-admin edits across global modules.</p>
        </div>
        <button className="relative z-10 mt-2 h-12 px-stack-lg bg-gradient-to-r from-primary-container to-inverse-primary text-on-primary-container rounded-xl font-label-caps text-[12px] uppercase tracking-widest font-bold border border-primary-fixed-dim/30 active:scale-95 transition-all" style={{ boxShadow: '0 8px 16px rgba(37,99,235,0.3)' }}>
          Enable Lockdown
        </button>
      </div>
    </div>
  );
}

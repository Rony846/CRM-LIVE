import Icon from '../lib/icon';

// Shared glassmorphism building blocks for the premium dashboards.

export function GlassKpi({ label, value, icon, accent = 'primary', sub, pulse }) {
  const TONE = {
    primary: 'text-primary', error: 'text-error', info: 'text-info',
    success: 'text-success', warning: 'text-warning', secondary: 'text-secondary-container',
  };
  const GLOW = {
    primary: 'bg-primary/5', error: 'bg-error/5', info: 'bg-info/5',
    success: 'bg-success/5', warning: 'bg-warning/5', secondary: 'bg-secondary/5',
  };
  return (
    <div className="glass-panel p-stack-md rounded-2xl relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-28 h-28 rounded-full blur-3xl -mr-8 -mt-8 ${GLOW[accent]}`} />
      <div className="flex justify-between items-start relative z-10">
        <span className="font-label-caps text-label-caps text-text-secondary uppercase tracking-wider">{label}</span>
        {icon && <Icon name={icon} className={`${TONE[accent]} opacity-60`} />}
      </div>
      <div className="flex items-baseline gap-stack-sm mt-stack-sm relative z-10">
        <span className={`font-display-kpi text-display-kpi ${TONE[accent]} drop-shadow`}>{value}</span>
        {pulse && <span className={`w-2 h-2 rounded-full self-center ${accent === 'error' ? 'bg-error pulse-dot-warning' : 'bg-success pulse-dot'}`} />}
      </div>
      {sub && <p className="font-mono-data-sm text-mono-data-sm text-text-secondary mt-1 relative z-10">{sub}</p>}
    </div>
  );
}

export function GradientHeader({ title, subtitle, action }) {
  return (
    <>
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-container/10 rounded-full blur-[120px] pointer-events-none -z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-info/10 rounded-full blur-[100px] pointer-events-none -z-0" />
      <div className="relative z-10 flex items-end justify-between gap-stack-md">
        <div>
          <h1 className="font-display-kpi text-display-kpi uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-fixed to-info">{title}</h1>
          {subtitle && <p className="font-body-base text-text-secondary mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
    </>
  );
}

export function GlassPanel({ title, icon, iconClass = 'text-primary', right, children }) {
  return (
    <div className="relative z-10 glass-panel rounded-2xl overflow-hidden">
      {title && (
        <div className="px-stack-md py-stack-md border-b border-border-subtle/50 flex justify-between items-center bg-surface-container-low/30">
          <div className="flex items-center gap-stack-sm">
            {icon && <Icon name={icon} className={iconClass} />}
            <h2 className="font-headline-card text-headline-card text-text-primary">{title}</h2>
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

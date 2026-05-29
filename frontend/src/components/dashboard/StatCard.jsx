import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

// Tween a numeric value from 0 → target with a soft ease, but only for plain numbers.
// Strings, currency-with-commas, or non-numeric values are rendered as-is.
function useAnimatedNumber(value, duration = 600) {
  const [display, setDisplay] = useState(value);
  const startedAt = useRef(null);
  const fromRef = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const target = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(target) || reduce) {
      setDisplay(value);
      return undefined;
    }
    fromRef.current = Number(display) || 0;
    startedAt.current = null;
    let rafId;
    const step = (ts) => {
      if (startedAt.current === null) startedAt.current = ts;
      const elapsed = ts - startedAt.current;
      const t = Math.min(1, elapsed / duration);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setDisplay(target >= 100 || target % 1 === 0 ? Math.round(next) : next);
      if (t < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, reduce]);

  return display;
}

// Trend text colour. emerald-500 is remapped to acid lime under the Obsidian theme.
const trendText = (trend) => {
  if (trend === 'up') return 'text-emerald-500';
  if (trend === 'down') return 'text-rose-400';
  return 'text-muted-foreground';
};

const TrendIcon = ({ trend, size = 12 }) => {
  if (trend === 'up') return <TrendingUp style={{ width: size, height: size }} />;
  if (trend === 'down') return <TrendingDown style={{ width: size, height: size }} />;
  return <Minus style={{ width: size, height: size }} />;
};

// Command Deck corner brackets — styled in themes-hud.css under [data-theme^="hud-"] .sc-card
const Brackets = () => (
  <>
    <span className="sc-br sc-tl" /><span className="sc-br sc-tr" />
    <span className="sc-br sc-bl" /><span className="sc-br sc-br2" />
  </>
);

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  className,
  tvMode = false,
  // Optional: indigo / emerald / amber / rose / sky — sets the icon tile tint
  tone = 'indigo',
}) {
  const animated = useAnimatedNumber(value);

  if (tvMode) {
    return (
      <div className={cn('bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-soft-lg', className)}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-slate-400 text-lg uppercase tracking-wider">{title}</span>
          {Icon && <Icon className="w-8 h-8 text-primary" />}
        </div>
        <div className="text-6xl font-semibold text-white tabular-nums tracking-tight">{value}</div>
        {trendValue && (
          <div className={cn('flex items-center gap-1 mt-2 text-lg', trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-slate-400')}>
            <TrendIcon trend={trend} size={20} />
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    );
  }

  // Opacity-based icon tiles — read correctly on both dark and light surfaces.
  const toneTile = {
    indigo: 'bg-primary/15 text-primary',
    emerald: 'bg-[#a4d64c]/15 text-[#a4d64c]',
    amber: 'bg-amber-400/15 text-amber-400',
    rose: 'bg-rose-400/15 text-rose-400',
    sky: 'bg-sky-400/15 text-sky-400',
    slate: 'bg-muted text-muted-foreground',
  }[tone] || 'bg-primary/15 text-primary';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        'mg-card sc-card group relative flex flex-col justify-between overflow-hidden rounded-lg',
        'border border-border bg-card p-5',
        className
      )}
    >
      {/* Command Deck corner brackets (visible under hud-* themes) */}
      <Brackets />

      {/* tactical corner sheen */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/[0.07] blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative flex items-start justify-between">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </span>
        {Icon && (
          <div className={cn('flex h-8 w-8 items-center justify-center rounded transition-transform duration-300 group-hover:scale-105', toneTile)}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
      </div>

      <div className="relative mt-4">
        <div className="sc-value font-mono text-[34px] font-bold leading-none tracking-tight text-foreground tabular-nums">
          {animated}
        </div>
        {trendValue && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <span className={cn('inline-flex items-center gap-1 font-mono text-[11px] font-semibold', trendText(trend))}>
              <TrendIcon trend={trend} />
              {trendValue}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

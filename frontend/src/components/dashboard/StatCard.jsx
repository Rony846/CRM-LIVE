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

const trendTone = (trend) => {
  if (trend === 'up') return 'text-emerald-600 bg-emerald-50';
  if (trend === 'down') return 'text-rose-600 bg-rose-50';
  return 'text-slate-500 bg-slate-100';
};

const TrendIcon = ({ trend, size = 12 }) => {
  if (trend === 'up') return <TrendingUp style={{ width: size, height: size }} />;
  if (trend === 'down') return <TrendingDown style={{ width: size, height: size }} />;
  return <Minus style={{ width: size, height: size }} />;
};

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

  const toneTile = {
    indigo: 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-600 ring-1 ring-amber-100',
    rose: 'bg-rose-50 text-rose-600 ring-1 ring-rose-100',
    sky: 'bg-sky-50 text-sky-600 ring-1 ring-sky-100',
    slate: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  }[tone] || 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        'group relative bg-card border border-border/70 rounded-xl p-5',
        'shadow-soft transition-shadow duration-300 ease-spring',
        'hover:shadow-soft-md',
        className
      )}
    >
      {/* faint gradient sheen on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-primary/[0.02] via-transparent to-transparent" />

      <div className="relative flex items-start justify-between mb-3">
        <span className="text-[12px] font-medium text-muted-foreground tracking-wide">{title}</span>
        {Icon && (
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-105', toneTile)}>
            <Icon className="w-[18px] h-[18px]" />
          </div>
        )}
      </div>
      <div className="relative text-[28px] leading-none font-semibold text-foreground tabular-nums tracking-tight">
        {animated}
      </div>
      {trendValue && (
        <div className={cn(
          'relative inline-flex items-center gap-1 mt-3 text-[11px] font-medium px-1.5 py-0.5 rounded-md',
          trendTone(trend)
        )}>
          <TrendIcon trend={trend} />
          <span>{trendValue}</span>
        </div>
      )}
    </motion.div>
  );
}

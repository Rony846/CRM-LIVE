import React, { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Count-up number — animates from the previous value to the new one (e.g.
// when a dashboard refreshes on a poll). Respects prefers-reduced-motion.
// `decimals` > 0 animates a fractional value (e.g. a 4.2 rating).
export function CountUp({ value, className, duration = 450, decimals = 0 }) {
  const fmt = (n) => (decimals > 0 ? Number(n).toFixed(decimals) : String(Math.round(n)));
  const [display, setDisplay] = useState(() => fmt(Number(value) || 0));
  const fromRef = useRef(Number(value) || 0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const target = Number(value) || 0;
    const from = Number(fromRef.current) || 0;
    if (reduce || from === target) {
      setDisplay(fmt(target));
      fromRef.current = target;
      return undefined;
    }
    let raf, start;
    const tick = (ts) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      setDisplay(fmt(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, decimals, reduce]);

  return <span className={className}>{display}</span>;
}

// Shimmer skeleton block — a sweeping highlight instead of a flat pulse.
export function Shimmer({ className }) {
  return (
    <div
      className={cn(
        'bg-gradient-to-r from-secondary/40 via-secondary/80 to-secondary/40',
        'bg-[length:200%_100%] animate-shimmer rounded-md',
        className
      )}
    />
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
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

const REWARD_COLORS = ['#34d399', '#6366f1', '#fbbf24', '#f472b6', '#38bdf8'];

// Reward burst — a brief confetti + check celebration. Re-plays whenever
// `playKey` changes to a new truthy value. Renders as a non-interactive
// full-screen overlay. Honors prefers-reduced-motion (check only, no confetti).
export function RewardBurst({ playKey, label = 'Resolved!' }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!playKey) return undefined;
    setShow(true);
    const t = setTimeout(() => setShow(false), reduce ? 900 : 1500);
    return () => clearTimeout(t);
  }, [playKey, reduce]);

  const particles = reduce ? 0 : 20;

  return (
    <AnimatePresence>
      {show && (
        <div
          key={playKey}
          className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center"
        >
          {/* Center check + label */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.15, 1, 1], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.3, times: [0, 0.28, 0.5, 1], ease: 'easeOut' }}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-soft-lg">
              <Check className="w-8 h-8 text-white" strokeWidth={3} />
            </div>
            <span className="mt-2 text-sm font-semibold text-emerald-700 bg-card px-3 py-1 rounded-full shadow-soft border border-border">
              {label}
            </span>
          </motion.div>

          {/* Confetti particles */}
          {Array.from({ length: particles }).map((_, i) => {
            const angle = (Math.PI * 2 * i) / particles + (Math.random() - 0.5) * 0.6;
            const dist = 90 + Math.random() * 130;
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;
            return (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x, y: y + 90, opacity: 0, scale: 0.4, rotate: Math.random() * 420 }}
                transition={{ duration: 1.0 + Math.random() * 0.5, ease: 'easeOut' }}
                className="absolute w-2 h-2 rounded-[2px]"
                style={{ backgroundColor: REWARD_COLORS[i % REWARD_COLORS.length] }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

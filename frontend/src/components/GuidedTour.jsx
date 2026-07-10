import React, { useState, useEffect, useCallback } from 'react';

/* A lightweight guided-tour spotlight. Point it at an element (via a ref) and it dims everything else,
   highlights the target with a pulsing ring, and shows a coaching card ("click here"). If targetRef has
   no element (or is null), the card is centered as a plain modal — used for welcome / done steps. */
export function Coachmark({ targetRef, title, body, step, total, onNext, nextLabel = 'Next',
                           onSkip, skipLabel, hint }) {
  const [rect, setRect] = useState(null);

  const measure = useCallback(() => {
    const el = targetRef && targetRef.current;
    if (el && el.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      if (r.width || r.height) { setRect(r); return; }
    }
    setRect(null);
  }, [targetRef]);

  useEffect(() => {
    const el = targetRef && targetRef.current;
    if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {} }
    measure();
    const id = setInterval(measure, 250);  // follow modal open / layout shifts
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { clearInterval(id); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [measure, step, targetRef]);

  const pad = 6;
  const box = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const vw = window.innerWidth, vh = window.innerHeight;
  const CARD_W = 330, CARD_H = 190;
  let tipTop, tipLeft;
  if (box) {
    const below = box.top + box.height + 12;
    tipTop = (below + CARD_H < vh) ? below : Math.max(12, box.top - CARD_H - 12);
    tipLeft = Math.max(12, Math.min(box.left, vw - CARD_W - 12));
  } else { tipTop = vh / 2 - CARD_H / 2; tipLeft = vw / 2 - CARD_W / 2; }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {box && <rect x={box.left} y={box.top} width={box.width} height={box.height} rx="9" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(12,12,14,0.66)" mask="url(#tour-hole)" />
      </svg>
      {box && (
        <div style={{ position: 'absolute', top: box.top, left: box.left, width: box.width, height: box.height,
          border: '2.5px solid #f97316', borderRadius: 9, animation: 'tourPulse 1.4s infinite' }} />
      )}
      <div style={{ position: 'absolute', top: tipTop, left: tipLeft, width: CARD_W, background: '#fff',
        borderRadius: 12, boxShadow: '0 24px 70px rgba(0,0,0,.45)', padding: 16, pointerEvents: 'auto',
        border: '1px solid #fde68a' }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#f97316', letterSpacing: 0.4 }}>STEP {step} OF {total}</div>
        <div style={{ fontFamily: 'Barlow, system-ui, sans-serif', fontWeight: 800, fontSize: 17, marginTop: 2 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#3f3f46', marginTop: 6, lineHeight: 1.45 }}>{body}</div>
        {hint && <div style={{ fontSize: 12, color: '#92400e', background: '#fff7ed', borderRadius: 7, padding: '6px 9px', marginTop: 9, fontWeight: 600 }}>👆 {hint}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 13 }}>
          {onSkip ? <button onClick={onSkip} style={{ border: 'none', background: 'none', color: '#9ca3af', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>{skipLabel || 'Skip'}</button> : <span />}
          {onNext && <button onClick={onNext} style={{ border: 'none', background: '#f97316', color: '#fff', fontWeight: 800, borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 13 }}>{nextLabel}</button>}
        </div>
      </div>
      <style>{`@keyframes tourPulse{0%{box-shadow:0 0 0 4px rgba(249,115,22,.40)}50%{box-shadow:0 0 0 10px rgba(249,115,22,.10)}100%{box-shadow:0 0 0 4px rgba(249,115,22,.40)}}`}</style>
    </div>
  );
}

export default Coachmark;

import React from 'react';

export const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏', '🔥', '✅', '👀', '😮', '😢'];

// Deterministic accent per user id (consistent avatar colors).
const TONES = [
  'bg-primary/20 text-primary', 'bg-[#a4d64c]/20 text-[#a4d64c]', 'bg-sky-400/20 text-sky-300',
  'bg-amber-400/20 text-amber-300', 'bg-rose-400/20 text-rose-300', 'bg-violet-400/20 text-violet-300',
  'bg-cyan-400/20 text-cyan-300', 'bg-orange-400/20 text-orange-300',
];
export function toneFor(id) {
  let h = 0; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}
export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

export function ChatAvatar({ id, name, online, size = 36 }) {
  return (
    <div className="relative flex-shrink-0">
      <div className={`flex items-center justify-center rounded-md font-semibold ${toneFor(id)}`}
        style={{ width: size, height: size, fontSize: size * 0.36 }}>
        {initials(name)}
      </div>
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card ${online ? 'bg-[#a4d64c]' : 'bg-muted-foreground/40'}`} />
      )}
    </div>
  );
}

export function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
export function fmtDay(iso) {
  const d = new Date(iso); const today = new Date();
  const y = new Date(today); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const URL_RE = /(https?:\/\/[^\s]+)/g;
// Lightweight markdown-ish: **bold**, `code`, links. Returns React nodes.
export function renderBody(text) {
  if (!text) return null;
  const lines = String(text).split('\n');
  return lines.map((line, li) => {
    const parts = [];
    let rest = line; let key = 0;
    // links first
    rest.split(URL_RE).forEach((seg) => {
      if (URL_RE.test(seg)) {
        parts.push(<a key={key++} href={seg} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{seg}</a>);
      } else {
        // bold + inline code within plain segment
        const tokens = seg.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        tokens.forEach((t) => {
          if (/^\*\*[^*]+\*\*$/.test(t)) parts.push(<strong key={key++}>{t.slice(2, -2)}</strong>);
          else if (/^`[^`]+`$/.test(t)) parts.push(<code key={key++} className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">{t.slice(1, -1)}</code>);
          else if (t) parts.push(<span key={key++}>{t}</span>);
        });
      }
    });
    return <div key={li}>{parts.length ? parts : ' '}</div>;
  });
}

export function isImage(att) {
  return att && (String(att.type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|heic)$/i.test(att.name || att.url || ''));
}
export function fileUrl(att) {
  const u = att.url || '';
  if (u.startsWith('http')) return u;
  const base = (process.env.REACT_APP_BACKEND_URL || '');
  return `${base}${u}`;
}

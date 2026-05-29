import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Ticket, Truck, ShoppingCart, ExternalLink } from 'lucide-react';

// Matches MG-/MGPO-/DSP-/DIS- style entity references in chat text.
const REF_RE = /\b(MG-[A-Z]{1,2}-[\dA-Z-]+|MGPO-\d+|DSP-[\dA-Z-]+|DIS-[\dA-Z-]+)\b/g;
export function extractRefs(text) {
  if (!text) return [];
  const out = new Set();
  let m;
  REF_RE.lastIndex = 0;
  while ((m = REF_RE.exec(text)) !== null) out.add(m[1]);
  return [...out];
}

// Shared cache so the same ref isn't re-fetched per render/message.
const cache = new Map();

const KIND = {
  ticket: { icon: Ticket, tone: 'text-sky-400' },
  dispatch: { icon: Truck, tone: 'text-amber-400' },
  order: { icon: ShoppingCart, tone: 'text-[#a4d64c]' },
};

export default function MGUnfurl({ refStr }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(() => cache.get(refStr)?.value || null);

  useEffect(() => {
    let alive = true;
    if (cache.has(refStr)) {
      const c = cache.get(refStr);
      if (c.value !== undefined) { setData(c.value); return; }
      c.promise.then((v) => { if (alive) setData(v); });
      return;
    }
    const promise = axios.get(`${API}/chat/unfurl`, { headers: { Authorization: `Bearer ${token}` }, params: { ref: refStr } })
      .then((r) => (r.data && r.data.found ? r.data : null))
      .catch(() => null)
      .then((v) => { cache.set(refStr, { value: v }); return v; });
    cache.set(refStr, { promise, value: undefined });
    promise.then((v) => { if (alive) setData(v); });
    return () => { alive = false; };
  }, [refStr, token]);

  if (!data) return null;
  const k = KIND[data.kind] || KIND.ticket;
  const Icon = k.icon;
  const clickable = !!data.url;

  return (
    <div
      onClick={() => clickable && navigate(data.url)}
      className={`mt-1 inline-flex max-w-sm items-start gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 ${clickable ? 'cursor-pointer hover:bg-muted/60' : ''}`}
      data-testid={`unfurl-${data.kind}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${k.tone}`} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[12px] font-semibold text-foreground">{data.title}</span>
          {data.status && (
            <span className="rounded-full bg-background px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
              {String(data.status).replace(/_/g, ' ')}
            </span>
          )}
          {clickable && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
        </div>
        {data.subtitle && <p className="truncate text-[11px] text-muted-foreground">{data.subtitle}</p>}
        {data.extra && <p className="truncate text-[11px] text-muted-foreground">{data.extra}</p>}
      </div>
    </div>
  );
}

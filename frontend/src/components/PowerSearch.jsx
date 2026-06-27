import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Search, X, Loader2, CornerDownLeft } from 'lucide-react';

// Admin global omni-search: type a customer name / phone / order id / tracking /
// serial / invoice and find the record anywhere (CRM + Amazon). Trigger in the
// header or press Cmd/Ctrl+K. Self-contained; backed by GET /admin/power-search.

const GROUP_ICON = {
  customer: '👤', account: '👤', lead: '🎯', ticket: '🛠', amazon: '📦', sale: '🧾',
  dispatch: '🚚', shipment: '🚚', warranty: '🛡', dealer: '🤝', invoice: '🧾',
  quotation: '📄', gate: '🚪', return: '↩️', zoho: '🎫', call: '📞',
};

export default function PowerSearch() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const reqRef = useRef(0);

  // Cmd/Ctrl+K toggles the palette anywhere
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQ(''); setData(null); }
  }, [open]);

  // debounced search
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setData(null); return; }
    const id = ++reqRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await axios.get(`${API}/admin/power-search`, {
          params: { q: term }, headers: { Authorization: `Bearer ${token}` },
        });
        if (id === reqRef.current) setData(r.data);
      } catch {
        if (id === reqRef.current) setData({ groups: [], total: 0 });
      } finally {
        if (id === reqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, open, token]);

  const go = useCallback((route) => {
    setOpen(false);
    if (route) navigate(route);
  }, [navigate]);

  return (
    <>
      {/* header trigger */}
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        title="Power search (Ctrl/Cmd+K)">
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search anything…</span>
        <kbd className="hidden md:inline rounded border border-border px-1.5 text-[10px] text-muted-foreground">⌘K</kbd>
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm px-4 pt-[10vh]"
          onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            {/* input */}
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Customer name, phone, order id, tracking, serial, invoice…"
                className="flex-1 bg-transparent py-4 text-base text-foreground outline-none placeholder:text-muted-foreground" />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {q.trim().length < 2 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Search across customers, leads, tickets, Amazon &amp; sales orders, dispatches,
                  shipments, warranties, dealers, invoices, gate scans, returns, calls — everywhere.
                </div>
              )}
              {q.trim().length >= 2 && !loading && data && data.total === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">No matches for “{q.trim()}”.</div>
              )}
              {(data?.groups || []).map((g) => (
                <div key={g.key} className="border-b border-border/50 last:border-0">
                  <div className="sticky top-0 bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {GROUP_ICON[g.key] || '•'} {g.label} <span className="text-muted-foreground/60">· {g.count}</span>
                  </div>
                  {g.items.map((it, i) => (
                    <button key={i} onClick={() => go(it.route)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-primary/10">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{it.title}</div>
                        {it.subtitle && <div className="truncate text-xs text-muted-foreground">{it.subtitle}</div>}
                      </div>
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {data?.total > 0 && (
              <div className="border-t border-border px-4 py-2 text-right text-[11px] text-muted-foreground">
                {data.total} result{data.total === 1 ? '' : 's'} across {data.groups.length} categor{data.groups.length === 1 ? 'y' : 'ies'}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import Icon from '../../lib/icon';
import { api } from '../../lib/api';
import { GradientHeader } from '../../components/Glass';

const inr = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);

// Dealer product catalogue — live GET /api/dealer/catalogue ({datasheets:[...]}).
export default function DealerCatalogue() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await api('/dealer/catalogue');
        setItems(d?.datasheets || d?.products || (Array.isArray(d) ? d : []));
      } catch { /* */ }
    })();
  }, []);

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return items.filter((p) => !ql || [p.model_name, p.name, p.sku_code, p.category].some((f) => String(f || '').toLowerCase().includes(ql)));
  }, [items, q]);

  const stockBadge = (p) => {
    const s = p.stock ?? p.stock_quantity;
    if (s == null) return null;
    if (s <= 0) return <span className="px-2 py-0.5 rounded bg-error/15 text-error font-label-caps text-[10px]">OUT OF STOCK</span>;
    if (s <= 5) return <span className="px-2 py-0.5 rounded bg-warning/15 text-warning font-label-caps text-[10px]">LOW ({s})</span>;
    return <span className="px-2 py-0.5 rounded bg-success/15 text-success font-label-caps text-[10px]">IN STOCK</span>;
  };

  return (
    <div className="relative px-margin-mobile space-y-stack-md">
      <GradientHeader title="Catalogue" subtitle="Browse & order inventory" />
      <div className="relative z-10">
        <div className="relative">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…"
            className="w-full h-touch-target pl-12 pr-4 bg-surface-container border border-border-subtle rounded-lg text-on-surface outline-none focus:border-primary" />
        </div>
      </div>
      <div className="relative z-10 space-y-stack-sm">
        {items.length === 0 && <div className="glass-panel rounded-2xl p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">Loading catalogue…</div>}
        {shown.map((p, i) => (
          <div key={p.id || p.sku_code || i} className="glass-panel rounded-xl p-stack-md flex items-center gap-stack-md">
            <div className="w-12 h-12 rounded-lg bg-surface-container-high border border-border-subtle flex items-center justify-center shrink-0">
              <Icon name="bolt" className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body-bold text-text-primary truncate">{p.model_name || p.name || p.sku_code}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="font-mono-data text-mono-data text-primary">{inr(p.dealer_price ?? p.price)}</span>
                {(p.mrp ?? p.msrp) != null && <span className="font-mono-data text-[11px] text-text-secondary line-through">{inr(p.mrp ?? p.msrp)}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {stockBadge(p)}
              <button className="px-3 py-1.5 rounded-lg bg-primary-container/20 border border-primary/30 text-primary font-label-caps text-[10px] flex items-center gap-1 active:scale-95">
                <Icon name="add_shopping_cart" style={{ fontSize: 14 }} /> ADD
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

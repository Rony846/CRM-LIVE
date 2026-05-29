import { useEffect, useState } from 'react';
import Icon from '../../lib/icon';
import { api } from '../../lib/api';
import { GradientHeader } from '../../components/Glass';

const inr = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
const STAGES = ['pending', 'confirmed', 'dispatched', 'delivered'];
const STATUS = {
  delivered: 'bg-success/15 text-success border-success/20',
  dispatched: 'bg-info/15 text-info border-info/20',
  confirmed: 'bg-info/15 text-info border-info/20',
  pending: 'bg-warning/15 text-warning border-warning/20',
  cancelled: 'bg-error/15 text-error border-error/20',
};

// Dealer's orders — live GET /api/dealer/orders, with a status timeline.
export default function DealerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const d = await api('/dealer/orders'); setOrders(Array.isArray(d) ? d : d?.orders || []); } catch { /* */ }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="relative px-margin-mobile space-y-stack-md">
      <GradientHeader title="My Orders" subtitle={`${orders.length} order(s)`} />
      <div className="relative z-10 space-y-stack-md">
        {loading && <div className="glass-panel rounded-2xl p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">Loading…</div>}
        {!loading && orders.length === 0 && <div className="glass-panel rounded-2xl p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">No orders yet.</div>}
        {orders.map((o) => {
          const stage = STAGES.indexOf(o.status);
          return (
            <div key={o.id || o.order_number} className="glass-panel rounded-2xl overflow-hidden">
              <div className="p-stack-md border-b border-border-subtle/40 flex justify-between items-start">
                <div className="min-w-0">
                  <p className="font-body-bold text-text-primary truncate">{o.order_number || o.id}</p>
                  <p className="font-mono-data text-text-secondary text-[11px]">{(o.created_at || '').slice(0, 10)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display-kpi text-2xl text-primary">{inr(o.total_amount ?? o.total ?? o.grand_total)}</p>
                  <span className={`px-2 py-0.5 rounded font-label-caps text-[10px] uppercase border ${STATUS[o.status] || 'bg-surface-container-highest/40 text-on-surface-variant border-border-subtle'}`}>{(o.status || 'pending').replace(/_/g, ' ')}</span>
                </div>
              </div>
              {stage >= 0 && (
                <div className="p-stack-md flex items-center gap-1">
                  {STAGES.map((st, i) => (
                    <div key={st} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`h-1.5 w-full rounded-full ${i <= stage ? 'bg-primary' : 'bg-surface-container-highest'}`} />
                      <span className={`text-[9px] uppercase tracking-wide ${i <= stage ? 'text-primary' : 'text-text-secondary'}`}>{st}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-stack-md pb-stack-md font-mono-data text-mono-data text-text-secondary">
                {(o.items?.length ?? o.item_count ?? 0)} item(s)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

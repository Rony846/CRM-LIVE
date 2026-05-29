import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../lib/icon';
import { api } from '../../lib/api';
import { GlassKpi, GradientHeader, GlassPanel } from '../../components/Glass';

// Dealer's OWN dashboard (the dealer sees this on login) — live GET
// /api/dealer/dashboard. Faithful to the Stitch dealer portal design.
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const STATUS = {
  delivered: 'bg-success/15 text-success border-success/20',
  dispatched: 'bg-info/15 text-info border-info/20',
  confirmed: 'bg-info/15 text-info border-info/20',
  pending: 'bg-warning/15 text-warning border-warning/20',
  cancelled: 'bg-error/15 text-error border-error/20',
};

export default function DealerDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => { try { setData(await api('/dealer/dashboard')); } catch { /* */ } })();
  }, []);

  const s = data?.stats || {};
  const dealer = data?.dealer || {};
  const orders = data?.recent_orders || [];

  const ACTIONS = [
    { icon: 'add_shopping_cart', label: 'New Order', to: '/dealer/catalogue', primary: true },
    { icon: 'receipt_long', label: 'My Orders', to: '/dealer/orders' },
    { icon: 'account_balance_wallet', label: 'Ledger', to: '/dealer/ledger' },
    { icon: 'verified', label: 'Warranty', to: '/dealer/warranty' },
  ];

  return (
    <div className="relative px-margin-mobile space-y-stack-lg">
      <GradientHeader title="MuscleGrid" subtitle={dealer.firm_name || dealer.contact_person || 'Dealer Dashboard'}
        action={dealer.dealer_code && <span className="font-mono-data text-mono-data text-primary bg-primary/10 px-2 py-1 rounded">{dealer.dealer_code}</span>} />

      <div className="relative z-10 grid grid-cols-2 gap-gutter">
        <GlassKpi label="Total Orders" value={s.total_orders ?? '…'} icon="shopping_bag" accent="primary" sub={`${s.pending_orders ?? 0} pending`} />
        <GlassKpi label="Outstanding" value={inr(s.outstanding_balance)} icon="payments" accent={s.outstanding_balance > 0 ? 'warning' : 'success'} />
        <GlassKpi label="Open Tickets" value={s.open_tickets ?? '…'} icon="build" accent="info" />
        <GlassKpi label="Status" value={dealer.tier || '—'} icon="workspace_premium" accent="secondary" sub={dealer.status} />
      </div>

      <div className="relative z-10 grid grid-cols-4 gap-stack-sm">
        {ACTIONS.map((a) => (
          <button key={a.label} onClick={() => navigate(a.to)}
            className={`flex flex-col items-center justify-center gap-1 p-stack-md rounded-xl border active:scale-95 transition-transform ${a.primary ? 'bg-primary-container/15 border-primary/30' : 'glass-panel'}`}>
            <Icon name={a.icon} className={a.primary ? 'text-primary' : 'text-on-surface-variant'} />
            <span className="text-[10px] font-bold uppercase tracking-wide text-center">{a.label}</span>
          </button>
        ))}
      </div>

      <GlassPanel title="Recent Orders" icon="local_shipping"
        right={<button onClick={() => navigate('/dealer/orders')} className="font-label-caps text-label-caps text-primary">VIEW ALL</button>}>
        <div className="divide-y divide-border-subtle/30">
          {orders.length === 0 && <div className="p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">No orders yet.</div>}
          {orders.map((o) => (
            <div key={o.id || o.order_number} className="px-stack-md py-stack-md flex items-center justify-between gap-stack-md">
              <div className="min-w-0">
                <p className="font-body-bold text-text-primary truncate">{o.order_number || o.id}</p>
                <p className="font-mono-data text-text-secondary text-[11px]">{inr(o.total_amount ?? o.total ?? o.grand_total)}</p>
              </div>
              <span className={`px-2 py-1 rounded font-label-caps text-[10px] uppercase shrink-0 border ${STATUS[o.status] || 'bg-surface-container-highest/40 text-on-surface-variant border-border-subtle'}`}>
                {(o.status || 'pending').replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

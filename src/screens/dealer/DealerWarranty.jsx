import { useEffect, useState } from 'react';
import Icon from '../../lib/icon';
import { api } from '../../lib/api';
import { GlassKpi, GradientHeader, GlassPanel } from '../../components/Glass';

// Dealer warranty registrations/claims — live GET
// /api/dealer/warranty-registrations (defensive mapping).
export default function DealerWarranty() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const d = await api('/dealer/warranty-registrations'); setItems(Array.isArray(d) ? d : d?.registrations || d?.claims || []); }
      catch { /* */ } finally { setLoading(false); }
    })();
  }, []);

  const active = items.filter((c) => !['closed', 'resolved', 'dispatched', 'delivered'].includes(c.status)).length;
  const dispatched = items.filter((c) => ['dispatched', 'delivered'].includes(c.status)).length;

  return (
    <div className="relative px-margin-mobile space-y-stack-lg">
      <GradientHeader title="Warranty" subtitle="Registrations & claims"
        action={<button className="h-touch-target px-stack-md glass-panel rounded-xl flex items-center gap-1 text-text-primary active:scale-95"><Icon name="add" className="text-primary" /><span className="font-body-bold text-[12px]">Register</span></button>} />

      <div className="relative z-10 grid grid-cols-3 gap-gutter">
        <GlassKpi label="Total" value={items.length} icon="verified" accent="primary" />
        <GlassKpi label="Active" value={active} icon="assignment" accent="info" />
        <GlassKpi label="Closed" value={dispatched} icon="local_shipping" accent="success" />
      </div>

      <GlassPanel title="Recent" icon="inventory_2">
        <div className="divide-y divide-border-subtle/30 max-h-[55vh] overflow-y-auto">
          {loading && <div className="p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">Loading…</div>}
          {!loading && items.length === 0 && <div className="p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">No warranty records yet.</div>}
          {items.slice(0, 30).map((c, i) => (
            <div key={c.id || c.claim_number || i} className="px-stack-md py-stack-md flex items-center gap-stack-md">
              <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-border-subtle flex items-center justify-center shrink-0">
                <Icon name="shield" className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body-bold text-text-primary truncate">{c.claim_number || c.registration_number || c.serial_number || c.id}</p>
                <p className="font-mono-data text-text-secondary text-[11px] truncate">{c.product_name || c.model_name || c.device_type || '—'}{c.serial_number ? ` · SN ${c.serial_number}` : ''}</p>
              </div>
              {c.status && <span className="px-2 py-1 rounded font-label-caps text-[10px] uppercase shrink-0 bg-surface-container-highest/40 text-on-surface-variant border border-border-subtle">{String(c.status).replace(/_/g, ' ')}</span>}
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

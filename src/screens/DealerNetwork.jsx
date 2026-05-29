import { useEffect, useMemo, useState } from 'react';
import Icon from '../lib/icon';
import { api } from '../lib/api';
import { GlassKpi, GradientHeader, GlassPanel } from '../components/Glass';

// Staff view of the dealer network (the Stitch dealer portal is single-dealer
// self-service / dealer-auth; staff get the admin overview instead). All live:
// GET /api/admin/dealers/summary + /api/admin/dealers. Read-only.
const TIER = {
  platinum: 'bg-info/15 text-info border-info/20',
  gold: 'bg-warning/15 text-warning border-warning/20',
  silver: 'bg-surface-container-highest/50 text-on-surface-variant border-border-subtle',
  bronze: 'bg-secondary/15 text-secondary-container border-secondary/20',
};
const STATUS = {
  approved: 'bg-success/15 text-success border-success/20',
  pending: 'bg-warning/15 text-warning border-warning/20',
  suspended: 'bg-error/15 text-error border-error/20',
  rejected: 'bg-error/15 text-error border-error/20',
};
const inr = (n) => (n == null ? null : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
const lakh = (n) => (n == null ? '…' : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : inr(n));

export default function DealerNetwork() {
  const [summary, setSummary] = useState(null);
  const [dealers, setDealers] = useState([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');

  useEffect(() => {
    (async () => {
      try { setSummary(await api('/admin/dealers/summary')); } catch { /* */ }
      try { const d = await api('/admin/dealers'); setDealers(Array.isArray(d) ? d : d?.dealers || []); } catch { /* */ }
    })();
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return dealers.filter((d) => {
      if (tab === 'approved' && d.status !== 'approved') return false;
      if (tab === 'pending' && d.status !== 'pending') return false;
      if (!ql) return true;
      return [d.firm_name, d.contact_person, d.dealer_code, d.city, d.state].some((f) => String(f || '').toLowerCase().includes(ql));
    });
  }, [dealers, q, tab]);

  return (
    <div className="relative px-margin-mobile space-y-stack-lg">
      <GradientHeader title="Dealer Network" subtitle="Partners, tiers & balances" />

      <div className="relative z-10 grid grid-cols-3 gap-gutter">
        <GlassKpi label="Active" value={summary?.active_dealers ?? '…'} icon="store" accent="success" />
        <GlassKpi label="Pending Apps" value={summary?.pending_applications ?? '…'} icon="how_to_reg" accent="warning" pulse={!!summary?.pending_applications} />
        <GlassKpi label="Revenue MTD" value={lakh(summary?.gross_revenue_mtd)} icon="payments" accent="primary" />
      </div>

      {/* search + filter */}
      <div className="relative z-10 space-y-stack-sm">
        <div className="relative">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dealer, code, city…"
            className="w-full h-touch-target pl-12 pr-4 bg-surface-container border border-border-subtle rounded-lg text-on-surface font-body-base outline-none focus:border-primary" />
        </div>
        <div className="flex p-1 bg-surface-container-low/60 border border-border-subtle rounded-xl">
          {[['all', 'All'], ['approved', 'Approved'], ['pending', 'Pending']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 py-2 rounded-lg font-body-bold text-body-bold transition-all active:scale-95 ${tab === k ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}>{l}</button>
          ))}
        </div>
      </div>

      <GlassPanel title="Dealers" icon="groups" right={<span className="font-mono-data text-mono-data text-text-secondary">{filtered.length}</span>}>
        <div className="divide-y divide-border-subtle/30 max-h-[60vh] overflow-y-auto">
          {dealers.length === 0 && <div className="p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">Loading dealers…</div>}
          {dealers.length > 0 && filtered.length === 0 && <div className="p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">No matches.</div>}
          {filtered.slice(0, 40).map((d) => {
            const name = d.firm_name || d.contact_person || d.dealer_code || 'Dealer';
            const bal = d.ledger_balance ?? d.outstanding;
            return (
              <div key={d.id} className="px-stack-md py-stack-md flex items-center gap-stack-md hover:bg-surface-container-high/40 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-surface-container-highest border border-outline-variant flex items-center justify-center text-text-primary font-body-bold shrink-0">
                  {String(name).trim().slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body-bold text-text-primary truncate">{name}</p>
                  <p className="font-mono-data text-text-secondary text-[11px] truncate">
                    {d.dealer_code || '—'}{(d.city || d.state) ? ` · ${[d.city, d.state].filter(Boolean).join(', ')}` : ''}
                  </p>
                  {bal != null && bal !== 0 && <p className={`font-mono-data text-[11px] mt-0.5 ${bal > 0 ? 'text-warning' : 'text-success'}`}>Bal {inr(bal)}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {d.tier && <span className={`px-2 py-0.5 rounded font-label-caps text-[10px] uppercase border ${TIER[d.tier] || TIER.silver}`}>{d.tier}</span>}
                  <span className={`px-2 py-0.5 rounded font-label-caps text-[10px] uppercase border ${STATUS[d.status] || 'bg-surface-container-highest/40 text-on-surface-variant border-border-subtle'}`}>{d.status || '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </GlassPanel>
    </div>
  );
}

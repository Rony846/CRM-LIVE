import { useEffect, useState } from 'react';
import Icon from '../../lib/icon';
import { api } from '../../lib/api';
import { GlassKpi, GradientHeader, GlassPanel } from '../../components/Glass';

const inr = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);

// Dealer ledger & payments — live GET /api/dealer/ledger (defensive mapping).
export default function DealerLedger() {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => { try { setData(await api('/dealer/ledger')); } catch { /* */ } })();
  }, []);

  const outstanding = data?.outstanding_balance ?? data?.current_balance ?? data?.balance;
  const creditLimit = data?.credit_limit ?? data?.dealer?.credit_limit;
  const txns = data?.transactions || data?.ledger || data?.entries || [];
  const used = creditLimit ? Math.min(100, Math.round(((outstanding || 0) / creditLimit) * 100)) : null;

  return (
    <div className="relative px-margin-mobile space-y-stack-lg">
      <GradientHeader title="Ledger" subtitle="Balance & transactions" />

      <div className="relative z-10 grid grid-cols-2 gap-gutter">
        <GlassKpi label="Outstanding" value={inr(outstanding)} icon="account_balance_wallet" accent={outstanding > 0 ? 'warning' : 'success'} />
        <GlassKpi label="Credit Limit" value={inr(creditLimit)} icon="speed" accent="info" sub={used != null ? `${used}% used` : undefined} />
      </div>

      {used != null && (
        <div className="relative z-10 glass-panel rounded-2xl p-stack-md">
          <div className="flex justify-between mb-unit">
            <span className="font-label-caps text-label-caps text-text-secondary uppercase">Credit Utilization</span>
            <span className={`font-mono-data ${used > 85 ? 'text-error' : used > 60 ? 'text-warning' : 'text-success'}`}>{used}%</span>
          </div>
          <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
            <div className={`h-full ${used > 85 ? 'bg-error' : used > 60 ? 'bg-warning' : 'bg-gradient-to-r from-success to-info'}`} style={{ width: `${used}%` }} />
          </div>
        </div>
      )}

      <GlassPanel title="Transactions" icon="receipt_long">
        <div className="divide-y divide-border-subtle/30 max-h-[55vh] overflow-y-auto">
          {txns.length === 0 && <div className="p-stack-lg text-center text-text-secondary font-mono-data text-mono-data">No transactions.</div>}
          {txns.slice(0, 30).map((t, i) => {
            const debit = t.debit ?? t.dr;
            const credit = t.credit ?? t.cr;
            return (
              <div key={t.id || i} className="px-stack-md py-stack-md flex items-center justify-between gap-stack-md">
                <div className="min-w-0">
                  <p className="font-body-bold text-text-primary truncate">{t.type || t.transaction_type || t.reference || 'Entry'}</p>
                  <p className="font-mono-data text-text-secondary text-[11px]">{(t.date || t.created_at || '').slice(0, 10)} · {t.reference || t.reference_number || ''}</p>
                </div>
                <div className="text-right shrink-0 font-mono-data text-mono-data">
                  {debit ? <span className="text-success">+{inr(debit)}</span> : null}
                  {credit ? <span className="text-error">−{inr(credit)}</span> : null}
                  {t.balance != null && <div className="text-text-primary font-bold">{inr(t.balance)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </GlassPanel>
    </div>
  );
}

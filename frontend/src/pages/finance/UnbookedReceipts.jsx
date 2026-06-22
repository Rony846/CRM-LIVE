import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const TIERS = [
  { key: '', label: 'All' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
];
const tierColor = (c) =>
  c === 'high' ? 'bg-emerald-500/15 text-emerald-400'
    : c === 'medium' ? 'bg-amber-500/15 text-amber-500'
      : 'bg-rose-500/15 text-rose-400';

export default function UnbookedReceipts() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState({});

  const fetchData = async (conf) => {
    setLoading(true);
    try {
      const url = `${API}/finance/unbooked-receipts${conf ? `?confidence=${conf}` : ''}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setData(res.data);
    } catch (e) {
      setData({ dealers: 0, total: 0, by_confidence: {}, rows: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(filter); /* eslint-disable-next-line */ }, [filter, token]);

  const bc = data?.by_confidence || {};
  return (
    <DashboardLayout title="Unbooked Dealer Receipts">
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[26px] font-bold tracking-tight text-foreground flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" /> Unbooked Dealer Receipts
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Dealer payments seen in the bank but booked in <b>neither the CRM nor Vyapar</b> — review and book.
            </p>
          </div>
          <button onClick={() => fetchData(filter)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Total unbooked" value={inr(data?.total)} tone="amber" />
          <Stat label="High confidence" value={inr(bc.high)} tone="emerald" />
          <Stat label="Medium" value={inr(bc.medium)} tone="amber" />
          <Stat label="Low (review)" value={inr(bc.low)} tone="rose" />
        </div>

        {/* filter */}
        <div className="flex items-center gap-2">
          {TIERS.map((t) => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === t.key ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'}`}>
              {t.label}
            </button>
          ))}
          <span className="ml-auto text-sm text-muted-foreground">{data?.dealers || 0} dealers</span>
        </div>

        {/* list */}
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {loading && <div className="px-6 py-10 text-center text-muted-foreground">Loading…</div>}
          {!loading && (data?.rows || []).length === 0 && (
            <div className="px-6 py-10 text-center text-muted-foreground">No unbooked receipts flagged.</div>
          )}
          {!loading && (data?.rows || []).map((r) => (
            <div key={r.id}>
              <button onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}
                className="flex w-full items-center gap-3 px-6 py-3 text-left hover:bg-muted/30">
                {open[r.id] ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                <span className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${tierColor(r.unbooked_bank_confidence)}`}>
                  {r.unbooked_bank_confidence}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{r.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{r.unbooked_bank_count}×</span>
                <span className="font-mono text-sm font-semibold text-foreground">{inr(r.unbooked_bank_total)}</span>
              </button>
              {open[r.id] && (
                <div className="bg-muted/20 px-6 pb-3 pl-12">
                  {(r.unbooked_bank_receipts || []).map((x, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 text-sm border-t border-border/50 first:border-0">
                      <span className="font-mono text-foreground w-28 shrink-0">{inr(x.amount)}</span>
                      <span className="text-muted-foreground w-24 shrink-0">{x.date}</span>
                      <span className="text-muted-foreground w-16 shrink-0">{x.bank}</span>
                      <span className="text-muted-foreground truncate font-mono text-[11px]">{x.narration}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

function Stat({ label, value, tone }) {
  const t = { amber: 'text-amber-500', emerald: 'text-emerald-400', rose: 'text-rose-400' }[tone] || 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${t}`}>{value}</div>
    </div>
  );
}

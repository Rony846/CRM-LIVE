import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { openAuthedFile } from '@/lib/openFile';
import { toast } from 'sonner';
import { RefreshCw, IndianRupee, CheckCircle2, Clock, Image as ImageIcon } from 'lucide-react';

// ₹100 Google-review reward payouts. "To pay" = customers who sent a review screenshot and haven't
// been credited yet — i.e. the numbers to pay ₹100. Backed by /admin/review-rewards.

const Tile = ({ icon: Icon, label, value, tone = 'text-foreground' }) => (
  <div className="rounded-xl border border-border bg-card px-4 py-3">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}{label}
    </div>
    <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
  </div>
);

export default function ReviewRewards() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending'); // pending | paid | awaiting

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/review-rewards`, { headers: { Authorization: `Bearer ${token}` } });
      setData(r.data);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (row) => {
    const ref = window.prompt(`Mark ₹${row.amount} paid to ${row.name || row.phone}?\nOptional payment ref (UPI/txn):`, '');
    if (ref === null) return;
    try {
      await axios.post(`${API}/admin/review-rewards/${row.id}/mark-paid`, { ref }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Marked paid');
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const viewShot = (row) => openAuthedFile(`${API}/admin/review-rewards/${row.id}/screenshot`, token);

  const s = data?.summary || {};
  const rows = (tab === 'pending' ? data?.pending : tab === 'paid' ? data?.paid : data?.awaiting) || [];

  return (
    <DashboardLayout title="Review Rewards (₹100)">
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">Review Rewards · ₹100 token gift</h2>
            <p className="text-sm text-muted-foreground">Customers who posted a Google review &amp; sent a screenshot — the “To pay” list is who to credit ₹100.</p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile icon={IndianRupee} label="To pay (count)" value={s.to_pay ?? '—'} tone={s.to_pay > 0 ? 'text-amber-400' : 'text-foreground'} />
          <Tile icon={IndianRupee} label="To pay (₹)" value={s.to_pay_amount != null ? `₹${s.to_pay_amount}` : '—'} tone={s.to_pay_amount > 0 ? 'text-amber-400' : 'text-foreground'} />
          <Tile icon={CheckCircle2} label="Paid" value={s.paid ?? '—'} tone="text-emerald-400" />
          <Tile icon={Clock} label="Awaiting screenshot" value={s.awaiting_screenshot ?? '—'} />
        </div>

        <div className="flex gap-2">
          {[['pending', `To pay (${s.to_pay ?? 0})`], ['paid', `Paid (${s.paid ?? 0})`], ['awaiting', `Awaiting (${s.awaiting_screenshot ?? 0})`]].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'}`}>
              {lbl}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Customer</th>
                <th className="px-3 py-2 text-left font-medium">Phone (pay ₹100 here)</th>
                <th className="px-3 py-2 text-left font-medium">When</th>
                <th className="px-3 py-2 text-center font-medium">Screenshot</th>
                <th className="px-3 py-2 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">Nothing here.</td></tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2.5 text-foreground">{r.name || '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-foreground">{r.phone}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{((r.screenshot_at || r.offered_at) || '').slice(0, 16).replace('T', ' ')}</td>
                  <td className="px-3 py-2.5 text-center">
                    {r.screenshot_media_id
                      ? <button onClick={() => viewShot(r)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ImageIcon className="h-3.5 w-3.5" /> View</button>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.status === 'pending_payment'
                      ? <button onClick={() => markPaid(r)} className="rounded-lg bg-emerald-600/90 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-600">Mark ₹{r.amount} paid</button>
                      : r.status === 'paid'
                        ? <span className="text-xs text-emerald-400">Paid{r.payment_ref ? ` · ${r.payment_ref}` : ''}</span>
                        : <span className="text-xs text-muted-foreground">awaiting</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}

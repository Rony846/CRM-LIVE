import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, Link2, CheckCircle2, HelpCircle, AlertTriangle, Banknote } from 'lucide-react';

const inr = (n) => (n ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '');

const STATUS = {
  matched: { cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: Link2, label: 'Matched' },
  classified: { cls: 'bg-sky-100 text-sky-800 border-sky-300', icon: CheckCircle2, label: 'Classified' },
  unmatched: { cls: 'bg-amber-100 text-amber-800 border-amber-300', icon: HelpCircle, label: 'Unmatched' },
};
const TYPE_LABEL = {
  intercompany: 'Intercompany transfer', amazon_settlement: 'Amazon settlement',
  gateway_settlement: 'Gateway settlement', fd_sweep: 'FD sweep', bank_interest: 'Bank interest',
  bank_charge: 'Bank charge', gst_payment: 'GST payment',
  customer_receipt: 'Customer receipt', supplier_payment: 'Supplier payment',
};

export default function ReconciliationMatch() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [counts, setCounts] = useState({});
  const [lines, setLines] = useState([]);
  const [firms, setFirms] = useState([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [filter, setFilter] = useState({ firm_id: '', status: '', recon_type: '', period_key: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = Object.entries(filter).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
      const [b, s] = await Promise.all([
        axios.get(`${API}/api/finance/reconciliation/bank${qs ? `?${qs}` : ''}`, { headers }),
        axios.get(`${API}/api/finance/reconciliation/summary`, { headers }),
      ]);
      setCounts(b.data.counts || {});
      setLines(b.data.lines || []);
      setLastRun(s.data.run);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load reconciliation');
    } finally { setLoading(false); }
  }, [filter, token]); // eslint-disable-line

  useEffect(() => { axios.get(`${API}/api/firms`, { headers }).then((r) => setFirms(r.data || [])).catch(() => {}); }, []); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setRunning(true);
    try {
      const r = await axios.post(`${API}/api/finance/reconciliation/run${filter.firm_id ? `?firm_id=${filter.firm_id}` : ''}`, {}, { headers });
      toast.success(`Reconciliation complete — ${r.data.matched} matched, ${r.data.classified} classified, ${r.data.unmatched} unmatched`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Run failed');
    } finally { setRunning(false); }
  };

  const tile = (k, label, cls) => (
    <Card key={k}><CardContent className="py-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${cls}`}>{counts[k] ?? 0}</p>
    </CardContent></Card>
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Banknote className="h-6 w-6 text-primary" /> Bank Reconciliation</h1>
            <p className="text-muted-foreground">Every bank line classified &amp; linked to a CRM record · {lastRun ? `last run ${String(lastRun.run_at).slice(0, 16).replace('T', ' ')} UTC` : 'not run yet'}</p>
          </div>
          <Button onClick={run} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />} Run reconciliation
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {tile('matched', 'Matched (linked)', 'text-emerald-600')}
          {tile('classified', 'Classified', 'text-sky-600')}
          {tile('unmatched', 'Unmatched', 'text-amber-600')}
        </div>

        <Card><CardContent className="py-3 flex flex-wrap items-end gap-3">
          <div><label className="text-xs text-muted-foreground">Firm</label>
            <select value={filter.firm_id} onChange={(e) => setFilter((f) => ({ ...f, firm_id: e.target.value }))}
              className="block mt-1 h-9 rounded-md border border-border bg-background px-2 text-sm w-52">
              <option value="">All firms</option>{firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select></div>
          <div><label className="text-xs text-muted-foreground">Status</label>
            <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
              className="block mt-1 h-9 rounded-md border border-border bg-background px-2 text-sm w-40">
              <option value="">All</option><option value="matched">Matched</option><option value="classified">Classified</option><option value="unmatched">Unmatched</option>
            </select></div>
          <div><label className="text-xs text-muted-foreground">Type</label>
            <select value={filter.recon_type} onChange={(e) => setFilter((f) => ({ ...f, recon_type: e.target.value }))}
              className="block mt-1 h-9 rounded-md border border-border bg-background px-2 text-sm w-48">
              <option value="">All types</option>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div><label className="text-xs text-muted-foreground">Month</label>
            <input value={filter.period_key} onChange={(e) => setFilter((f) => ({ ...f, period_key: e.target.value }))}
              placeholder="2026-03" className="block mt-1 h-9 rounded-md border border-border bg-background px-2 text-sm w-28" /></div>
        </CardContent></Card>

        <Card><CardContent className="p-0">
          {loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="px-3 py-2">Date</th><th className="px-3 py-2">Firm</th><th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Linked to</th><th className="px-3 py-2">Narration</th></tr></thead>
                <tbody>
                  {lines.map((l, i) => {
                    const s = STATUS[l.recon_status] || STATUS.unmatched; const Icon = s.icon;
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-1.5 whitespace-nowrap font-mono text-xs">{l.date}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{l.firm}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-red-600">{inr(l.debit)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">{inr(l.credit)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-xs">{TYPE_LABEL[l.recon_type] || l.recon_type}</td>
                        <td className="px-3 py-1.5"><Badge className={`${s.cls} gap-1`}><Icon className="h-3 w-3" />{s.label}</Badge></td>
                        <td className="px-3 py-1.5 text-xs">{l.recon_ref ? <span className="text-foreground"><span className="text-muted-foreground">{l.recon_ref_type}:</span> {l.recon_ref}</span> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground font-mono truncate max-w-[280px]" title={l.description}>{l.description}</td>
                      </tr>
                    );
                  })}
                  {lines.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No lines — run reconciliation or adjust filters.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2, XCircle, Loader2,
  FileSearch, Building2, Plug, ChevronDown, ChevronRight, Upload, Wallet,
} from 'lucide-react';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const SEV = {
  high: 'bg-red-100 text-red-800 border-red-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  ok: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

function FirmCard({ r }) {
  const [open, setOpen] = useState(r.summary?.high > 0); // auto-expand firms with high-severity findings
  const s = r.summary || {};
  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <Building2 className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold text-foreground">{r.firm}</p>
            <p className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
              {r.gstin || '—'}
              {r.gstin_valid
                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                : <XCircle className="h-3.5 w-3.5 text-red-600" />}
              {!r.gstin_valid && <span className="text-red-600">invalid checksum</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {r.books_source === 'vyapar_vouchers' && (
            <Badge variant="outline" className="font-normal gap-1"><Wallet className="h-3 w-3" /> Vyapar books</Badge>
          )}
          {s.high > 0 && <Badge className={SEV.high}>{s.high} high</Badge>}
          {s.medium > 0 && <Badge className={SEV.medium}>{s.medium} medium</Badge>}
          {s.high === 0 && s.medium === 0 && <Badge className={SEV.ok}>clean</Badge>}
          {s.data_gaps > 0 && <Badge variant="outline">{s.data_gaps} gaps</Badge>}
        </div>
      </button>

      {open && (
        <CardContent className="border-t border-border space-y-3 pt-4">
          <p className="text-xs text-muted-foreground">
            {s.invoices} {r.books_source === 'vyapar_vouchers' ? 'Vyapar invoices (books)' : 'CRM invoices'} · {s.filed_outward_rows} filed outward rows
          </p>

          {/* Input Tax Credit — Electronic Credit Ledger balances imported from the GST portal */}
          {(r.itc_balances || []).length > 0 && (
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-primary" /> Input Tax Credit — Electronic Credit Ledger (GST portal)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-muted-foreground text-left">
                      <th className="font-medium pr-4 pb-1">Month</th>
                      <th className="font-medium pr-4 pb-1 text-right">IGST</th>
                      <th className="font-medium pr-4 pb-1 text-right">CGST</th>
                      <th className="font-medium pr-4 pb-1 text-right">SGST</th>
                      <th className="font-medium pb-1 text-right">Total ITC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.itc_balances.map((b) => (
                      <tr key={b.month} className="border-t border-border/60" title={b.notes || ''}>
                        <td className="pr-4 py-1">{b.month}</td>
                        <td className="pr-4 py-1 text-right">{inr(b.igst)}</td>
                        <td className="pr-4 py-1 text-right">{inr(b.cgst)}</td>
                        <td className="pr-4 py-1 text-right">{inr(b.sgst)}</td>
                        <td className="py-1 text-right font-semibold text-foreground">{inr(b.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(r.checks || []).map((c, i) => (
            <div key={i} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  {c.severity === 'high'
                    ? <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    : c.severity === 'ok'
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                      : <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />}
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.check}</p>
                    {c.note && <p className="text-xs text-muted-foreground mt-0.5">{c.note}</p>}
                    {/* sales reconciliation (gross, incl Amazon) detail */}
                    {c.crm_total_gross !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        CRM {inr(c.crm_total_gross)} (invoices {inr(c.crm_invoices_gross)} + {c.crm_amazon_orders} Amazon {inr(c.crm_amazon_gross)})
                        &nbsp;vs&nbsp; Filed {inr(c.filed_gross)} &nbsp;·&nbsp;
                        <span className={c.severity === 'ok' ? 'text-emerald-600' : 'text-red-600'}>Δ {inr(c.gross_diff)}</span>
                      </p>
                    )}
                    {c.filed_itc !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        Filed ITC {inr(c.filed_itc)} · {c.crm_purchase_records} purchase records in CRM
                      </p>
                    )}
                    {/* Amazon MTR 3-way match breakdown */}
                    {c.mtr_b2b_invoices !== undefined && (
                      <div className="text-xs mt-1.5 space-y-1 font-mono">
                        {c.filed_loaded === false && (
                          <p className="text-amber-600">Filed GSTR-1 not loaded (portal down) — reconciling MTR ↔ CRM only. MTR totals below = filing basis.</p>
                        )}
                        <div className="flex flex-wrap gap-3">
                          <span>MTR B2B: {c.mtr_b2b_invoices}</span>
                          {c.filed_loaded !== false && <span className="text-emerald-600">✓ in GSTR-1: {c.matched_in_gstr1}</span>}
                          <span className="text-emerald-600">✓ order in CRM: {c.order_traced_to_crm}</span>
                          {c.filed_loaded !== false && <span className="text-red-600">in MTR not filed: {c.in_mtr_not_filed_count}</span>}
                          {c.filed_loaded !== false && <span className="text-amber-600">filed not in MTR: {c.filed_not_in_mtr_count}</span>}
                          <span className="text-red-600">order not in CRM: {c.order_not_in_crm_count}</span>
                        </div>
                        <p>MTR totals — B2B {inr(c.mtr_b2b_gross)} · B2C {inr(c.mtr_b2c_gross)}</p>
                        {c.mtr_invoiced_not_filed !== undefined && c.filed_loaded !== false && (
                          <div className="space-y-0.5">
                            <p>B2B value: MTR {inr(c.mtr_b2b_gross)} vs filed {inr(c.filed_b2b_gross)} · <span className={Math.abs(c.b2b_value_diff) > 100 ? 'text-red-600' : 'text-emerald-600'}>Δ {inr(c.b2b_value_diff)}</span></p>
                            <p>B2C value: MTR {inr(c.mtr_b2c_gross)} vs filed {inr(c.filed_b2c_gross)} · <span className={Math.abs(c.b2c_value_diff) > 100 ? 'text-red-600' : 'text-emerald-600'}>Δ {inr(c.b2c_value_diff)}</span></p>
                            {Math.abs(c.mtr_invoiced_not_filed) > 100 && (
                              <p className="text-red-600 font-medium">⚠ Amazon-invoiced but NOT filed in GSTR-1: {inr(c.mtr_invoiced_not_filed)}</p>
                            )}
                            {c.b2b_value_mismatch?.length > 0 && (
                              <p className="text-muted-foreground">
                                <span className={c.b2b_mismatch_unexplained > 0 ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
                                  B2B value mismatches: {c.b2b_value_mismatch.length}
                                </span>
                                {' '}({c.b2b_mismatch_refund_explained} refund-explained{c.b2b_mismatch_unexplained > 0 ? `, ${c.b2b_mismatch_unexplained} UNEXPLAINED` : ', 0 unexplained ✓'}) —{' '}
                                {c.b2b_value_mismatch.map((x) => `${x.invoice} ${x.ratio}×${x.refund_explained ? ' (refund)' : ''}`).join(', ')}
                              </p>
                            )}
                          </div>
                        )}
                        {c.in_mtr_not_filed?.length > 0 && (
                          <p className="text-muted-foreground"><span className="text-red-600">Invoiced on Amazon but NOT filed:</span> {c.in_mtr_not_filed.map((x) => `${x.invoice}/${x.order_id} (${inr(x.taxable)})`).join(', ')}</p>
                        )}
                        {c.order_not_in_crm?.length > 0 && (
                          <p className="text-muted-foreground"><span className="text-red-600">MTR orders missing from CRM:</span> {c.order_not_in_crm.map((x) => `${x.invoice}/${x.order_id}`).join(', ')}</p>
                        )}
                      </div>
                    )}
                    {/* Amazon B2C drill-down */}
                    {c.b2c_invoices !== undefined && (
                      <div className="text-xs mt-1.5 space-y-1 font-mono">
                        <div className="flex flex-wrap gap-3">
                          <span>B2C invoices: {c.b2c_invoices}</span>
                          <span className="text-emerald-600">order in CRM: {c.order_in_crm}</span>
                          <span className="text-red-600">order not in CRM: {c.order_not_in_crm_count}</span>
                          <span className="text-red-600">value mismatch: {c.value_mismatch_count}</span>
                        </div>
                        {c.rate_recon?.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Rate-wise (MTR vs filed b2cs):</span>{' '}
                            {c.rate_recon.map((r) => (
                              <span key={r.rate} className={Math.abs(r.diff) > 100 ? 'text-red-600' : 'text-emerald-600'}>
                                {r.rate}% Δ{inr(r.diff)}&nbsp;&nbsp;
                              </span>
                            ))}
                          </div>
                        )}
                        {c.value_mismatch?.length > 0 && (
                          <p className="text-muted-foreground">
                            <span className={c.value_mismatch_unexplained > 0 ? 'text-red-600' : 'text-amber-600'}>Orders MTR≠CRM: {c.value_mismatch.length}</span>
                            {' '}({c.value_mismatch_refund_explained} refund-explained{c.value_mismatch_unexplained > 0 ? `, ${c.value_mismatch_unexplained} UNEXPLAINED` : ', 0 unexplained ✓'}) —{' '}
                            {c.value_mismatch.slice(0, 8).map((x) => `${x.invoice}/${x.order_id} ${x.ratio}×${x.refund_explained ? ' (refund)' : ''}`).join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                    {/* Invoice-level match breakdown */}
                    {c.only_in_filed_count !== undefined && (
                      <div className="text-xs mt-1.5 space-y-1">
                        <div className="flex flex-wrap gap-3 font-mono">
                          <span className="text-emerald-600">✓ matched {c.matched}{c.fuzzy ? ` (${c.exact} exact + ${c.fuzzy} by amount)` : ''}</span>
                          <span className="text-amber-600">only in CRM {c.only_in_crm_count}</span>
                          <span className="text-red-600">only in filed {c.only_in_filed_count}</span>
                          <span className="text-red-600">value mismatch {c.value_mismatch_count}</span>
                        </div>
                        {c.only_in_filed?.length > 0 && (
                          <p className="text-muted-foreground">
                            <span className="text-red-600 font-medium">In GSTR-1, missing from CRM:</span>{' '}
                            {c.only_in_filed.map((x) => `${x.invoice} (${inr(x.taxable)})`).join(', ')}
                          </p>
                        )}
                        {c.only_in_crm?.length > 0 && (
                          <p className="text-muted-foreground">
                            <span className="text-amber-600 font-medium">In CRM, not in GSTR-1:</span>{' '}
                            {c.only_in_crm.map((x) => `${x.invoice} (${inr(x.taxable)})`).join(', ')}
                          </p>
                        )}
                        {c.value_mismatch?.length > 0 && (
                          <p className="text-muted-foreground">
                            <span className="text-red-600 font-medium">Value mismatch:</span>{' '}
                            {c.value_mismatch.map((x) => `${x.invoice} (CRM ${inr(x.crm_taxable)} vs filed ${inr(x.filed_taxable)})`).join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                    {Array.isArray(c.sample) && c.sample.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                        {c.sample.slice(0, 10).join(', ')}{c.count > 10 ? ` …(+${c.count - 10})` : ''}
                      </p>
                    )}
                    {Array.isArray(c.series) && c.series.map((g, j) => (
                      <p key={j} className="text-xs text-muted-foreground mt-1 font-mono">
                        {g.series}: {g.range} — {g.missing_count} missing ({(g.missing_sample || []).slice(0, 8).join(', ')}…)
                      </p>
                    ))}
                  </div>
                </div>
                {c.count !== undefined && !c.crm_tax && <Badge variant="outline">{c.count}</Badge>}
              </div>
            </div>
          ))}

          {(r.data_gaps || []).length > 0 && (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Needs GST-portal (GSP) data
              </p>
              <ul className="space-y-1">
                {r.data_gaps.map((g, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <Plug className="h-3 w-3 mt-0.5 shrink-0" />{g}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function GSTAudit() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('');
  const [imp, setImp] = useState({ firm: '', period: '', file: null, busy: false, mtrFile: null, mtrBusy: false });

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const params = period ? `?period_key=${encodeURIComponent(period)}` : '';
      const res = await axios.get(`${API}/admin/gst-audit${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to run GST audit');
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => { run(); }, []); // eslint-disable-line

  const doImport = async () => {
    if (!imp.firm || !imp.file) { toast.error('Pick a firm and a GST return JSON file'); return; }
    setImp((s) => ({ ...s, busy: true }));
    try {
      const fd = new FormData();
      fd.append('firm_id', imp.firm);
      if (imp.period) fd.append('period', imp.period);
      fd.append('file', imp.file);
      const res = await axios.post(`${API}/admin/gst-audit/import`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = res.data;
      toast.success(`Imported ${(d.return_type || '').toUpperCase()} · ${d.period} · ${d.rows_imported != null ? `${d.rows_imported} rows` : 'summary'}`);
      setImp((s) => ({ ...s, file: null }));
      run();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Import failed');
    } finally {
      setImp((s) => ({ ...s, busy: false }));
    }
  };

  const doImportMtr = async () => {
    if (!imp.firm || !imp.mtrFile) { toast.error('Pick a firm and an Amazon MTR CSV'); return; }
    setImp((s) => ({ ...s, mtrBusy: true }));
    try {
      const fd = new FormData();
      fd.append('firm_id', imp.firm);
      if (imp.period) fd.append('period', imp.period);
      fd.append('file', imp.mtrFile);
      const res = await axios.post(`${API}/admin/gst-audit/import-mtr`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = res.data;
      toast.success(`MTR imported · ${d.period} · ${d.invoices_imported} invoices (${d.b2b_invoices} B2B)`);
      setImp((s) => ({ ...s, mtrFile: null }));
      run();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'MTR import failed');
    } finally {
      setImp((s) => ({ ...s, mtrBusy: false }));
    }
  };

  const t = data?.totals || {};
  const firms = data?.firms || [];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="gst-audit-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" /> GST Firm Audit
            </h1>
            <p className="text-muted-foreground">
              Reconciliation &amp; compliance audit across firms · {data?.generated_for || '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Period (e.g. 2026-04)"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-44"
            />
            <Button variant="outline" onClick={run} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Run audit
            </Button>
          </div>
        </div>

        {/* GSP connection banner */}
        {data && !data.gsp_connected && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="flex items-start gap-2 py-3">
              <Plug className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">{data.gsp_note}</p>
            </CardContent>
          </Card>
        )}

        {/* Import return JSON (free, no-GSP reconciliation path) */}
        {data && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" /> Import GST return JSON
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Download GSTR-1 / GSTR-2B / GSTR-3B JSON from gst.gov.in and upload it here to reconcile
                without a GSP. Re-uploading the same return/period overwrites (never duplicates).
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Firm</label>
                  <select
                    value={imp.firm}
                    onChange={(e) => setImp((s) => ({ ...s, firm: e.target.value }))}
                    className="block mt-1 h-9 rounded-md border border-border bg-background px-2 text-sm w-56"
                  >
                    <option value="">Select firm…</option>
                    {firms.map((f) => <option key={f.firm_id} value={f.firm_id}>{f.firm}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Period (optional)</label>
                  <Input placeholder="2026-04" value={imp.period}
                    onChange={(e) => setImp((s) => ({ ...s, period: e.target.value }))}
                    className="w-32 mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">Return JSON</label>
                  <input type="file" accept=".json,application/json"
                    onChange={(e) => setImp((s) => ({ ...s, file: e.target.files?.[0] || null }))}
                    className="mt-1 text-sm w-64" />
                </div>
                <Button onClick={doImport} disabled={imp.busy}>
                  {imp.busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  Import &amp; re-audit
                </Button>
              </div>
              {/* Amazon MTR — bridges order id ↔ invoice number for invoice-level Amazon matching */}
              <div className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-border">
                <div>
                  <label className="text-xs text-muted-foreground block">Amazon MTR (CSV)</label>
                  <input type="file" accept=".csv,text/csv"
                    onChange={(e) => setImp((s) => ({ ...s, mtrFile: e.target.files?.[0] || null }))}
                    className="mt-1 text-sm w-64" />
                  <p className="text-[11px] text-muted-foreground mt-0.5">Seller Central → Reports → Tax Document Library → GST MTR.</p>
                </div>
                <Button variant="outline" onClick={doImportMtr} disabled={imp.mtrBusy}>
                  {imp.mtrBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  Import MTR
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Headline tiles */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Firms audited', t.firms, 'text-foreground'],
              ['High-severity', t.high, 'text-red-600'],
              ['Medium', t.medium, 'text-amber-600'],
              ['Data gaps (need GSP)', t.data_gaps, 'text-muted-foreground'],
            ].map(([label, val, cls]) => (
              <Card key={label}>
                <CardContent className="py-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className={`text-3xl font-bold tabular-nums ${cls}`}>{val ?? '—'}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {loading && !data ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            {(data?.firms || []).map((r) => <FirmCard key={r.firm_id} r={r} />)}
            {data && (data.firms || []).length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <FileSearch className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No firms to audit.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

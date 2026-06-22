import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileSpreadsheet, Building2, Download, Loader2, RefreshCw, LogOut,
  Calculator, FileText, CheckCircle2,
} from 'lucide-react';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const FILE_HINTS = {
  153: { label: 'GSTR-1 Templates (V2.2) — import into the Offline Tool', primary: true },
  152: { label: 'GST Returns Offline Tool (GSTN utility)' },
  149: { label: 'GSTR-1 GSTN JSON — all firms (backup)' },
  143: { label: 'Reconciliation workbook (Excel + JSON)' },
};

export default function CADashboard() {
  const { token, user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/ca/gst-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load GST data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const downloadFile = async (number, filename) => {
    setDownloading(number);
    try {
      const res = await axios.get(`${API}/ca/files/${number}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `file-${number}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Download failed');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Calculator className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <div className="text-lg font-bold font-['Barlow_Condensed'] leading-tight text-foreground">
                MuscleGrid — CA Portal
              </div>
              <div className="text-xs text-muted-foreground">GST filing data · read-only</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading GST data…
          </div>
        ) : !data ? (
          <div className="text-center py-24">
            <p className="text-muted-foreground mb-4">No data available.</p>
            <Button onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Retry</Button>
          </div>
        ) : (
          <>
            {/* Title row */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold font-['Barlow_Condensed'] text-foreground">
                  GSTR-1 Filing Summary
                </h1>
                <p className="text-sm text-muted-foreground">
                  Return period: <span className="font-semibold text-foreground">{data.period || '—'}</span>
                  {' '}· {data.group?.firms || 0} firms · reconciled &amp; ready to file
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="w-4 h-4 mr-1" /> Refresh
              </Button>
            </div>

            {/* Group total */}
            <Card className="mb-8 border-primary/40">
              <CardContent className="py-6 flex flex-wrap items-center justify-between gap-6">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Group output GST (all firms)
                  </div>
                  <div className="text-3xl font-bold text-primary">{inr(data.group?.output_gst)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Total taxable value</div>
                  <div className="text-2xl font-semibold text-foreground">{inr(data.group?.taxable_value)}</div>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-sm py-1.5 px-3 hover:bg-emerald-500/15">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Reconciled
                </Badge>
              </CardContent>
            </Card>

            {/* Per-firm cards */}
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> By firm
            </h2>
            <div className="grid gap-4 md:grid-cols-2 mb-10">
              {(data.firms || []).map((f) => (
                <Card key={f.gstin} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base font-bold text-foreground">{f.firm}</CardTitle>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{f.gstin}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">Output GST</div>
                        <div className="text-xl font-bold text-primary">{inr(f.output_gst)}</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-xs text-muted-foreground mb-3">
                      Taxable value: <span className="font-semibold text-foreground">{inr(f.taxable_value)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <Section label="B2B" sub={`${f.sections?.b2b?.invoices || 0} invoices`}
                               tax={f.sections?.b2b?.tax} taxable={f.sections?.b2b?.taxable} />
                      <Section label="B2C" sub={`${f.sections?.b2c?.invoices || 0} large + small`}
                               tax={f.sections?.b2c?.tax} taxable={f.sections?.b2c?.taxable} />
                      <Section label="Credit notes" sub={`${f.sections?.cdn?.notes || 0} notes`}
                               tax={f.sections?.cdn?.tax ? -f.sections.cdn.tax : 0}
                               taxable={f.sections?.cdn?.taxable ? -f.sections.cdn.taxable : 0} />
                      <Section label="HSN rows" sub={`${f.sections?.hsn?.rows || 0} summary rows`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Downloads */}
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Filing files
            </h2>
            <Card>
              <CardContent className="py-4 divide-y divide-border">
                {(data.files || []).map((file) => {
                  const hint = FILE_HINTS[file.number] || {};
                  return (
                    <div key={file.number} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className={`w-5 h-5 shrink-0 ${hint.primary ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate flex items-center gap-2">
                            {file.filename}
                            {hint.primary && (
                              <Badge className="bg-primary/15 text-primary border border-primary/30 text-[10px] hover:bg-primary/15">
                                START HERE
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {hint.label || file.note || `File #${file.number}`}
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant={hint.primary ? 'default' : 'outline'}
                              disabled={downloading === file.number}
                              onClick={() => downloadFile(file.number, file.filename)}>
                        {downloading === file.number
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <><Download className="w-4 h-4 mr-1" /> Download</>}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* How-to */}
            <div className="mt-6 text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg p-4 leading-relaxed">
              <p className="font-semibold text-foreground mb-1">How to file</p>
              Open the <strong className="text-foreground">GST Returns Offline Tool</strong> (#152) →
              {' '}<em>Import → New</em> → select a firm's template from
              {' '}<strong className="text-foreground">GSTR-1 Templates V2.2</strong> (#153) →
              {' '}<em>Generate JSON</em> → upload the validated JSON to the GST portal. The figures above are the
              reconciled totals each firm's return will carry.
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Section({ label, sub, tax, taxable }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <div className="text-xs font-semibold text-foreground">{label}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
      {tax !== undefined && (
        <div className="text-xs text-muted-foreground mt-1">
          Tax <span className="font-semibold text-foreground">{inr(tax)}</span>
          {taxable !== undefined && <span className="text-muted-foreground"> · {inr(taxable)}</span>}
        </div>
      )}
    </div>
  );
}

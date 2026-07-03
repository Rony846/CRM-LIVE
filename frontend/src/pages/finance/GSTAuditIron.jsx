import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';
import {
  ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2, XCircle, Loader2,
  FileSearch, Building2, Plug, ChevronDown, ChevronRight, Upload, Wallet,
} from 'lucide-react';

/* GST Firm Audit — Iron Console restyle. Behaviour preserved 1:1:
   GET  /admin/gst-audit[?period_key=]        (run audit)
   POST /admin/gst-audit/import      (firm_id, period?, file)  — GST return JSON
   POST /admin/gst-audit/import-mtr  (firm_id, period?, file)  — Amazon MTR CSV   */

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// text colour tokens for the dense reconciliation detail blocks
const RED = '#DC2626';
const AMBER = '#B45309';
const GREEN = T.green;
const MUTED = T.iron500;

const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none' };

function FirmCard({ r }) {
  const [open, setOpen] = useState(r.summary?.high > 0); // auto-expand firms with high-severity findings
  const s = r.summary || {};
  return (
    <div style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, boxShadow: '0 1px 2px rgba(15,15,15,.06)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', textAlign: 'left', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {open ? <ChevronDown size={16} color={T.iron400} /> : <ChevronRight size={16} color={T.iron400} />}
          <Building2 size={19} color={T.orange} />
          <div>
            <p style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>{r.firm}</p>
            <p style={{ ...mono, fontSize: 11.5, color: MUTED, display: 'flex', alignItems: 'center', gap: 6 }}>
              {r.gstin || '—'}
              {r.gstin_valid
                ? <CheckCircle2 size={13} color={GREEN} />
                : <XCircle size={13} color={RED} />}
              {!r.gstin_valid && <span style={{ color: RED }}>invalid checksum</span>}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {r.books_source === 'vyapar_vouchers' && (
            <span style={{ ...badgeStyle('slate'), display: 'inline-flex', alignItems: 'center', gap: 4 }}><Wallet size={11} /> Vyapar books</span>
          )}
          {s.high > 0 && <span style={badgeStyle('bad')}>{s.high} high</span>}
          {s.medium > 0 && <span style={badgeStyle('warn')}>{s.medium} medium</span>}
          {s.high === 0 && s.medium === 0 && <span style={badgeStyle('ok')}>clean</span>}
          {s.data_gaps > 0 && <span style={badgeStyle('slate')}>{s.data_gaps} gaps</span>}
        </div>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${T.iron200}`, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 11.5, color: MUTED }}>
            {s.invoices} {r.books_source === 'vyapar_vouchers' ? 'Vyapar invoices (books)' : 'CRM invoices'} · {s.filed_outward_rows} filed outward rows
          </p>

          {/* Input Tax Credit — Electronic Credit Ledger balances imported from the GST portal */}
          {(r.itc_balances || []).length > 0 && (
            <div style={{ borderRadius: 6, border: `1px solid ${T.iron200}`, background: T.iron50, padding: 12 }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Wallet size={13} color={T.orange} /><Caps size={9} color={MUTED}>Input Tax Credit — Electronic Credit Ledger (GST portal)</Caps>
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 11.5, ...mono }}>
                  <thead>
                    <tr style={{ color: MUTED, textAlign: 'left' }}>
                      <th style={{ fontWeight: 500, paddingRight: 16, paddingBottom: 4 }}>Month</th>
                      <th style={{ fontWeight: 500, paddingRight: 16, paddingBottom: 4, textAlign: 'right' }}>IGST</th>
                      <th style={{ fontWeight: 500, paddingRight: 16, paddingBottom: 4, textAlign: 'right' }}>CGST</th>
                      <th style={{ fontWeight: 500, paddingRight: 16, paddingBottom: 4, textAlign: 'right' }}>SGST</th>
                      <th style={{ fontWeight: 500, paddingBottom: 4, textAlign: 'right' }}>Total ITC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.itc_balances.map((b) => (
                      <tr key={b.month} style={{ borderTop: `1px solid ${T.iron200}` }} title={b.notes || ''}>
                        <td style={{ paddingRight: 16, padding: '4px 16px 4px 0' }}>{b.month}</td>
                        <td style={{ padding: '4px 16px 4px 0', textAlign: 'right' }}>{inr(b.igst)}</td>
                        <td style={{ padding: '4px 16px 4px 0', textAlign: 'right' }}>{inr(b.cgst)}</td>
                        <td style={{ padding: '4px 16px 4px 0', textAlign: 'right' }}>{inr(b.sgst)}</td>
                        <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 700, color: T.iron900 }}>{inr(b.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(r.checks || []).map((c, i) => (
            <div key={i} style={{ borderRadius: 6, border: `1px solid ${T.iron200}`, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {c.severity === 'high'
                    ? <AlertTriangle size={16} color={RED} style={{ marginTop: 2, flexShrink: 0 }} />
                    : c.severity === 'ok'
                      ? <CheckCircle2 size={16} color={GREEN} style={{ marginTop: 2, flexShrink: 0 }} />
                      : <AlertTriangle size={16} color={AMBER} style={{ marginTop: 2, flexShrink: 0 }} />}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: T.iron900 }}>{c.check}</p>
                    {c.note && <p style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{c.note}</p>}
                    {/* sales reconciliation (gross, incl Amazon) detail */}
                    {c.crm_total_gross !== undefined && (
                      <p style={{ fontSize: 11.5, color: MUTED, marginTop: 4, ...mono }}>
                        CRM {inr(c.crm_total_gross)} (invoices {inr(c.crm_invoices_gross)} + {c.crm_amazon_orders} Amazon {inr(c.crm_amazon_gross)})
                        &nbsp;vs&nbsp; Filed {inr(c.filed_gross)} &nbsp;·&nbsp;
                        <span style={{ color: c.severity === 'ok' ? GREEN : RED }}>Δ {inr(c.gross_diff)}</span>
                      </p>
                    )}
                    {c.filed_itc !== undefined && (
                      <p style={{ fontSize: 11.5, color: MUTED, marginTop: 4, ...mono }}>
                        Filed ITC {inr(c.filed_itc)} · {c.crm_purchase_records} purchase records in CRM
                        {c.crm_purchase_itc !== undefined && (
                          <> · ITC on bills {inr(c.crm_purchase_itc)}</>
                        )}
                        {c.intra_group_itc_proxy > 0 && (
                          <> &nbsp;(<span style={{ color: AMBER }}>incl. {inr(c.intra_group_itc_proxy)} intra-group, pending own GSTR-2B</span>)</>
                        )}
                      </p>
                    )}
                    {/* Amazon MTR 3-way match breakdown */}
                    {c.mtr_b2b_invoices !== undefined && (
                      <div style={{ fontSize: 11.5, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, ...mono }}>
                        {c.filed_loaded === false && (
                          <p style={{ color: AMBER }}>Filed GSTR-1 not loaded (portal down) — reconciling MTR ↔ CRM only. MTR totals below = filing basis.</p>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          <span>MTR B2B: {c.mtr_b2b_invoices}</span>
                          {c.filed_loaded !== false && <span style={{ color: GREEN }}>✓ in GSTR-1: {c.matched_in_gstr1}</span>}
                          <span style={{ color: GREEN }}>✓ order in CRM: {c.order_traced_to_crm}</span>
                          {c.filed_loaded !== false && <span style={{ color: RED }}>in MTR not filed: {c.in_mtr_not_filed_count}</span>}
                          {c.filed_loaded !== false && <span style={{ color: AMBER }}>filed not in MTR: {c.filed_not_in_mtr_count}</span>}
                          <span style={{ color: RED }}>order not in CRM: {c.order_not_in_crm_count}</span>
                        </div>
                        <p>MTR totals — B2B {inr(c.mtr_b2b_gross)} · B2C {inr(c.mtr_b2c_gross)}</p>
                        {c.mtr_invoiced_not_filed !== undefined && c.filed_loaded !== false && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <p>B2B value: MTR {inr(c.mtr_b2b_gross)} vs filed {inr(c.filed_b2b_gross)} · <span style={{ color: Math.abs(c.b2b_value_diff) > 100 ? RED : GREEN }}>Δ {inr(c.b2b_value_diff)}</span></p>
                            <p>B2C value: MTR {inr(c.mtr_b2c_gross)} vs filed {inr(c.filed_b2c_gross)} · <span style={{ color: Math.abs(c.b2c_value_diff) > 100 ? RED : GREEN }}>Δ {inr(c.b2c_value_diff)}</span></p>
                            {Math.abs(c.mtr_invoiced_not_filed) > 100 && (
                              <p style={{ color: RED, fontWeight: 600 }}>⚠ Amazon-invoiced but NOT filed in GSTR-1: {inr(c.mtr_invoiced_not_filed)}</p>
                            )}
                            {c.b2b_value_mismatch?.length > 0 && (
                              <p style={{ color: MUTED }}>
                                <span style={{ color: c.b2b_mismatch_unexplained > 0 ? RED : AMBER, fontWeight: 600 }}>
                                  B2B value mismatches: {c.b2b_value_mismatch.length}
                                </span>
                                {' '}({c.b2b_mismatch_refund_explained} refund-explained{c.b2b_mismatch_unexplained > 0 ? `, ${c.b2b_mismatch_unexplained} UNEXPLAINED` : ', 0 unexplained ✓'}) —{' '}
                                {c.b2b_value_mismatch.map((x) => `${x.invoice} ${x.ratio}×${x.refund_explained ? ' (refund)' : ''}`).join(', ')}
                              </p>
                            )}
                          </div>
                        )}
                        {c.in_mtr_not_filed?.length > 0 && (
                          <p style={{ color: MUTED }}><span style={{ color: RED }}>Invoiced on Amazon but NOT filed:</span> {c.in_mtr_not_filed.map((x) => `${x.invoice}/${x.order_id} (${inr(x.taxable)})`).join(', ')}</p>
                        )}
                        {c.order_not_in_crm?.length > 0 && (
                          <p style={{ color: MUTED }}><span style={{ color: RED }}>MTR orders missing from CRM:</span> {c.order_not_in_crm.map((x) => `${x.invoice}/${x.order_id}`).join(', ')}</p>
                        )}
                      </div>
                    )}
                    {/* Amazon B2C drill-down */}
                    {c.b2c_invoices !== undefined && (
                      <div style={{ fontSize: 11.5, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, ...mono }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          <span>B2C invoices: {c.b2c_invoices}</span>
                          <span style={{ color: GREEN }}>order in CRM: {c.order_in_crm}</span>
                          <span style={{ color: RED }}>order not in CRM: {c.order_not_in_crm_count}</span>
                          <span style={{ color: RED }}>value mismatch: {c.value_mismatch_count}</span>
                        </div>
                        {c.rate_recon?.length > 0 && (
                          <div>
                            <span style={{ color: MUTED }}>Rate-wise (MTR vs filed b2cs):</span>{' '}
                            {c.rate_recon.map((rr) => (
                              <span key={rr.rate} style={{ color: Math.abs(rr.diff) > 100 ? RED : GREEN }}>
                                {rr.rate}% Δ{inr(rr.diff)}&nbsp;&nbsp;
                              </span>
                            ))}
                          </div>
                        )}
                        {c.value_mismatch?.length > 0 && (
                          <p style={{ color: MUTED }}>
                            <span style={{ color: c.value_mismatch_unexplained > 0 ? RED : AMBER }}>Orders MTR≠CRM: {c.value_mismatch.length}</span>
                            {' '}({c.value_mismatch_refund_explained} refund-explained{c.value_mismatch_unexplained > 0 ? `, ${c.value_mismatch_unexplained} UNEXPLAINED` : ', 0 unexplained ✓'}) —{' '}
                            {c.value_mismatch.slice(0, 8).map((x) => `${x.invoice}/${x.order_id} ${x.ratio}×${x.refund_explained ? ' (refund)' : ''}`).join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                    {/* Invoice-level match breakdown */}
                    {c.only_in_filed_count !== undefined && (
                      <div style={{ fontSize: 11.5, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, ...mono }}>
                          <span style={{ color: GREEN }}>✓ matched {c.matched}{c.fuzzy ? ` (${c.exact} exact + ${c.fuzzy} by amount)` : ''}</span>
                          <span style={{ color: AMBER }}>only in CRM {c.only_in_crm_count}</span>
                          <span style={{ color: RED }}>only in filed {c.only_in_filed_count}</span>
                          <span style={{ color: RED }}>value mismatch {c.value_mismatch_count}</span>
                        </div>
                        {c.only_in_filed?.length > 0 && (
                          <p style={{ color: MUTED }}>
                            <span style={{ color: RED, fontWeight: 600 }}>In GSTR-1, missing from CRM:</span>{' '}
                            {c.only_in_filed.map((x) => `${x.invoice} (${inr(x.taxable)})`).join(', ')}
                          </p>
                        )}
                        {c.only_in_crm?.length > 0 && (
                          <p style={{ color: MUTED }}>
                            <span style={{ color: AMBER, fontWeight: 600 }}>In CRM, not in GSTR-1:</span>{' '}
                            {c.only_in_crm.map((x) => `${x.invoice} (${inr(x.taxable)})`).join(', ')}
                          </p>
                        )}
                        {c.value_mismatch?.length > 0 && (
                          <p style={{ color: MUTED }}>
                            <span style={{ color: RED, fontWeight: 600 }}>Value mismatch:</span>{' '}
                            {c.value_mismatch.map((x) => `${x.invoice} (CRM ${inr(x.crm_taxable)} vs filed ${inr(x.filed_taxable)})`).join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                    {Array.isArray(c.sample) && c.sample.length > 0 && (
                      <p style={{ fontSize: 11.5, color: MUTED, marginTop: 4, ...mono, wordBreak: 'break-all' }}>
                        {c.sample.slice(0, 10).join(', ')}{c.count > 10 ? ` …(+${c.count - 10})` : ''}
                      </p>
                    )}
                    {Array.isArray(c.series) && c.series.map((g, j) => (
                      <p key={j} style={{ fontSize: 11.5, color: MUTED, marginTop: 4, ...mono }}>
                        {g.series}: {g.range} — {g.missing_count} missing ({(g.missing_sample || []).slice(0, 8).join(', ')}…)
                      </p>
                    ))}
                  </div>
                </div>
                {c.count !== undefined && !c.crm_tax && <span style={badgeStyle('slate')}>{c.count}</span>}
              </div>
            </div>
          ))}

          {(r.data_gaps || []).length > 0 && (
            <div style={{ borderRadius: 6, border: `1px dashed ${T.iron200}`, background: T.iron50, padding: 12 }}>
              <p style={{ marginBottom: 6 }}><Caps size={9} color={MUTED}>Needs GST-portal (GSP) data</Caps></p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, listStyle: 'none', margin: 0, padding: 0 }}>
                {r.data_gaps.map((g, i) => (
                  <li key={i} style={{ fontSize: 11.5, color: MUTED, display: 'flex', gap: 6 }}>
                    <Plug size={12} style={{ marginTop: 2, flexShrink: 0 }} />{g}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
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
    setImp((st) => ({ ...st, busy: true }));
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
      setImp((st) => ({ ...st, file: null }));
      run();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Import failed');
    } finally {
      setImp((st) => ({ ...st, busy: false }));
    }
  };

  const doImportMtr = async () => {
    if (!imp.firm || !imp.mtrFile) { toast.error('Pick a firm and an Amazon MTR CSV'); return; }
    setImp((st) => ({ ...st, mtrBusy: true }));
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
      setImp((st) => ({ ...st, mtrFile: null }));
      run();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'MTR import failed');
    } finally {
      setImp((st) => ({ ...st, mtrBusy: false }));
    }
  };

  const t = data?.totals || {};
  const firms = data?.firms || [];

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        placeholder="Period (e.g. 2026-04)"
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        style={{ ...inputStyle, width: 176 }}
      />
      <button style={btnOutline} onClick={run} disabled={loading}>
        <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} /> Run audit
      </button>
    </div>
  );

  const tiles = [
    ['Firms audited', t.firms, T.iron900],
    ['High-severity', t.high, RED],
    ['Medium', t.medium, AMBER],
    ['Data gaps (need GSP)', t.data_gaps, MUTED],
  ];

  return (
    <IronShell
      title="GST Firm Audit"
      subtitle={(data?.generated_for || '—').toString().toUpperCase()}
      onRefresh={run}
      headerRight={headerRight}
    >
      <div data-testid="gst-audit-page" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={22} color={T.orange} />
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.iron900 }}>GST Firm Audit</div>
            <div style={{ fontSize: 12.5, color: MUTED }}>Reconciliation &amp; compliance audit across firms · {data?.generated_for || '—'}</div>
          </div>
        </div>

        {/* GSP connection banner */}
        {data && !data.gsp_connected && (
          <div style={{ border: `1px solid ${T.voltageTint}`, background: T.voltageTint, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Plug size={15} color={T.voltageText} style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 12.5, color: T.voltageText }}>{data.gsp_note}</p>
          </div>
        )}

        {/* Import return JSON (free, no-GSP reconciliation path) */}
        {data && (
          <IronCard pad={14}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900, marginBottom: 8 }}>
              <Upload size={15} color={T.orange} /> Import GST return JSON
            </p>
            <p style={{ fontSize: 11.5, color: MUTED, marginBottom: 12 }}>
              Download GSTR-1 / GSTR-2B / GSTR-3B JSON from gst.gov.in and upload it here to reconcile
              without a GSP. Re-uploading the same return/period overwrites (never duplicates).
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11.5, color: MUTED }}>Firm</label>
                <select
                  value={imp.firm}
                  onChange={(e) => setImp((st) => ({ ...st, firm: e.target.value }))}
                  style={{ ...inputStyle, display: 'block', marginTop: 4, width: 224, height: 36 }}
                >
                  <option value="">Select firm…</option>
                  {firms.map((f) => <option key={f.firm_id} value={f.firm_id}>{f.firm}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11.5, color: MUTED }}>Period (optional)</label>
                <input placeholder="2026-04" value={imp.period}
                  onChange={(e) => setImp((st) => ({ ...st, period: e.target.value }))}
                  style={{ ...inputStyle, width: 128, marginTop: 4, display: 'block' }} />
              </div>
              <div>
                <label style={{ fontSize: 11.5, color: MUTED, display: 'block' }}>Return JSON</label>
                <input type="file" accept=".json,application/json"
                  onChange={(e) => setImp((st) => ({ ...st, file: e.target.files?.[0] || null }))}
                  style={{ marginTop: 4, fontSize: 12.5, width: 256 }} />
              </div>
              <button style={btnPrimary} onClick={doImport} disabled={imp.busy}>
                {imp.busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                Import &amp; re-audit
              </button>
            </div>
            {/* Amazon MTR — bridges order id ↔ invoice number for invoice-level Amazon matching */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.iron200}` }}>
              <div>
                <label style={{ fontSize: 11.5, color: MUTED, display: 'block' }}>Amazon MTR (CSV)</label>
                <input type="file" accept=".csv,text/csv"
                  onChange={(e) => setImp((st) => ({ ...st, mtrFile: e.target.files?.[0] || null }))}
                  style={{ marginTop: 4, fontSize: 12.5, width: 256 }} />
                <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Seller Central → Reports → Tax Document Library → GST MTR.</p>
              </div>
              <button style={btnOutline} onClick={doImportMtr} disabled={imp.mtrBusy}>
                {imp.mtrBusy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                Import MTR
              </button>
            </div>
          </IronCard>
        )}

        {/* Headline tiles */}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {tiles.map(([label, val, cls]) => (
              <IronCard key={label} pad={14}>
                <Caps size={9} color={MUTED}>{label}</Caps>
                <p style={{ ...mono, fontSize: 30, fontWeight: 800, color: cls, marginTop: 4 }}>{val ?? '—'}</p>
              </IronCard>
            ))}
          </div>
        )}

        {loading && !data ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}><Loader2 size={32} color={MUTED} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(data?.firms || []).map((r) => <FirmCard key={r.firm_id} r={r} />)}
            {data && (data.firms || []).length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px 0', color: MUTED }}>
                <FileSearch size={48} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p>No firms to audit.</p>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </IronShell>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';
import {
  FileSpreadsheet, Building2, Download, Loader2, RefreshCw, LogOut,
  FileText, CheckCircle2,
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

  const primaryBtn = {
    border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px',
    fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  };
  const outlineBtn = {
    border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6,
    padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  };

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {user?.email && (
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.iron400 }} className="hidden sm:inline">{user.email}</span>
      )}
      <button style={outlineBtn} onClick={logout}>
        <LogOut size={13} strokeWidth={1.9} /> Sign out
      </button>
    </div>
  );

  return (
    <IronShell title="CA Portal" subtitle="GST FILING DATA · READ-ONLY" onRefresh={load} headerRight={headerRight}>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 0', color: T.iron500 }}>
          <Loader2 className="animate-spin" size={22} style={{ marginRight: 8 }} /> Loading GST data…
        </div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: '96px 0' }}>
          <p style={{ color: T.iron500, marginBottom: 16 }}>No data available.</p>
          <button style={primaryBtn} onClick={load}><RefreshCw size={14} /> Retry</button>
        </div>
      ) : (
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 26, color: T.iron900, letterSpacing: '.01em', lineHeight: 1.05 }}>
                GSTR-1 Filing Summary
              </div>
              <div style={{ fontSize: 12.5, color: T.iron500, marginTop: 4 }}>
                Return period: <span style={{ fontWeight: 700, color: T.iron900 }}>{data.period || '—'}</span>
                {' '}· {data.group?.firms || 0} firms · reconciled &amp; ready to file
              </div>
            </div>
            <button style={outlineBtn} onClick={load}><RefreshCw size={13} /> Refresh</button>
          </div>

          {/* Group total */}
          <IronCard pad={0} style={{ marginBottom: 28, borderColor: 'rgba(245,130,32,.35)' }}>
            <div style={{ padding: '20px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 22 }}>
              <div>
                <Caps size={9} color={T.iron400}>Group output GST (all firms)</Caps>
                <div style={{ ...mono, fontWeight: 700, fontSize: 30, color: T.orange, marginTop: 4 }}>{inr(data.group?.output_gst)}</div>
              </div>
              <div>
                <Caps size={9} color={T.iron400}>Total taxable value</Caps>
                <div style={{ ...mono, fontWeight: 700, fontSize: 24, color: T.iron900, marginTop: 4 }}>{inr(data.group?.taxable_value)}</div>
              </div>
              <span style={{ ...badgeStyle('ok'), display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '6px 12px' }}>
                <CheckCircle2 size={14} /> Reconciled
              </span>
            </div>
          </IronCard>

          {/* Per-firm cards */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Building2 size={15} color={T.iron500} />
            <Caps size={10} color={T.iron500}>By firm</Caps>
          </div>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', marginBottom: 40 }}>
            {(data.firms || []).map((f) => (
              <IronCard key={f.gstin} pad={0} style={{ overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${T.iron200}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>{f.firm}</div>
                      <div style={{ ...mono, fontSize: 11, color: T.iron400, marginTop: 2 }}>{f.gstin}</div>
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <Caps size={8.5} color={T.iron400}>Output GST</Caps>
                      <div style={{ ...mono, fontWeight: 700, fontSize: 19, color: T.orange }}>{inr(f.output_gst)}</div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '10px 16px 14px' }}>
                  <div style={{ fontSize: 12, color: T.iron500, marginBottom: 12 }}>
                    Taxable value: <span style={{ fontWeight: 700, color: T.iron900 }}>{inr(f.taxable_value)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Section label="B2B" sub={`${f.sections?.b2b?.invoices || 0} invoices`}
                             tax={f.sections?.b2b?.tax} taxable={f.sections?.b2b?.taxable} />
                    <Section label="B2C" sub={`${f.sections?.b2c?.invoices || 0} large + small`}
                             tax={f.sections?.b2c?.tax} taxable={f.sections?.b2c?.taxable} />
                    <Section label="Credit notes" sub={`${f.sections?.cdn?.notes || 0} notes`}
                             tax={f.sections?.cdn?.tax ? -f.sections.cdn.tax : 0}
                             taxable={f.sections?.cdn?.taxable ? -f.sections.cdn.taxable : 0} />
                    <Section label="HSN rows" sub={`${f.sections?.hsn?.rows || 0} summary rows`} />
                  </div>
                </div>
              </IronCard>
            ))}
          </div>

          {/* Downloads */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <FileSpreadsheet size={15} color={T.iron500} />
            <Caps size={10} color={T.iron500}>Filing files</Caps>
          </div>
          <IronCard pad={0}>
            <div style={{ padding: '4px 16px' }}>
              {(data.files || []).map((file, idx) => {
                const hint = FILE_HINTS[file.number] || {};
                return (
                  <div key={file.number}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 0',
                      borderTop: idx === 0 ? 'none' : `1px solid ${T.iron200}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <FileText size={20} strokeWidth={1.8} color={hint.primary ? T.orange : T.iron400} style={{ flex: 'none' }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.filename}
                          {hint.primary && (
                            <span style={{ ...badgeStyle('bad'), fontSize: 8.5 }}>START HERE</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: T.iron500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {hint.label || file.note || `File #${file.number}`}
                        </div>
                      </div>
                    </div>
                    <button
                      style={{ ...(hint.primary ? primaryBtn : outlineBtn), opacity: downloading === file.number ? 0.6 : 1 }}
                      disabled={downloading === file.number}
                      onClick={() => downloadFile(file.number, file.filename)}>
                      {downloading === file.number
                        ? <Loader2 className="animate-spin" size={14} />
                        : <><Download size={14} /> Download</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </IronCard>

          {/* How-to */}
          <div style={{ marginTop: 24, fontSize: 12.5, color: T.iron500, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 16, lineHeight: 1.6 }}>
            <div style={{ fontFamily: T.headline, fontWeight: 700, color: T.iron900, marginBottom: 4 }}>How to file</div>
            Open the <strong style={{ color: T.iron900 }}>GST Returns Offline Tool</strong> (#152) →
            {' '}<em>Import → New</em> → select a firm's template from
            {' '}<strong style={{ color: T.iron900 }}>GSTR-1 Templates V2.2</strong> (#153) →
            {' '}<em>Generate JSON</em> → upload the validated JSON to the GST portal. The figures above are the
            reconciled totals each firm's return will carry.
          </div>
        </div>
      )}
    </IronShell>
  );
}

function Section({ label, sub, tax, taxable }) {
  return (
    <div style={{ borderRadius: 6, border: `1px solid ${T.iron200}`, background: T.iron50, padding: '8px 12px' }}>
      <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12, color: T.iron900 }}>{label}</div>
      <div style={{ fontSize: 11, color: T.iron500 }}>{sub}</div>
      {tax !== undefined && (
        <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 4 }}>
          Tax <span style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{inr(tax)}</span>
          {taxable !== undefined && <span style={{ color: T.iron400 }}> · {inr(taxable)}</span>}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import { RefreshCw, Loader2, Link2, CheckCircle2, HelpCircle, Banknote } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inr = (n) => (n ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '');

// recon_status -> label + Iron pill tone + icon (preserves the three legacy states).
const STATUS = {
  matched: { tone: 'ok', icon: Link2, label: 'Matched' },
  classified: { tone: 'info', icon: CheckCircle2, label: 'Classified' },
  unmatched: { tone: 'warn', icon: HelpCircle, label: 'Unmatched' },
};
const TYPE_LABEL = {
  intercompany: 'Intercompany transfer', amazon_settlement: 'Amazon settlement',
  gateway_settlement: 'Gateway settlement', fd_sweep: 'FD sweep', bank_interest: 'Bank interest',
  bank_charge: 'Bank charge', gst_payment: 'GST payment',
  customer_receipt: 'Customer receipt', supplier_payment: 'Supplier payment',
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none' };

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

  const TILES = [
    { k: 'matched', label: 'Matched (linked)', color: T.green },
    { k: 'classified', label: 'Classified', color: T.blue },
    { k: 'unmatched', label: 'Unmatched', color: T.orangeDeep },
  ];

  const subtitle = lastRun ? `LAST RUN ${String(lastRun.run_at).slice(0, 16).replace('T', ' ')} UTC` : 'NOT RUN YET';

  const runBtn = (
    <button onClick={run} disabled={running}
      style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: running ? 'default' : 'pointer', opacity: running ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Run reconciliation
    </button>
  );

  return (
    <IronShell title="Bank Match" subtitle={subtitle} onRefresh={load} headerRight={runBtn}>
      {/* Header line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Banknote size={20} color={T.orange} strokeWidth={2} />
        <div>
          <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 18, color: T.iron900 }}>Bank Reconciliation</div>
          <Caps size={9} color={T.iron400}>Every bank line classified &amp; linked to a CRM record</Caps>
        </div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        {TILES.map((t) => (
          <IronCard key={t.k} pad={14}>
            <Caps size={9} color={T.iron400}>{t.label}</Caps>
            <div style={{ ...mono, fontSize: 30, fontWeight: 800, color: t.color, marginTop: 4, lineHeight: 1 }}>{counts[t.k] ?? 0}</div>
          </IronCard>
        ))}
      </div>

      {/* Filters */}
      <IronCard pad={14} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14 }}>
          <div>
            <Caps size={9} color={T.iron400}>Firm</Caps>
            <select value={filter.firm_id} onChange={(e) => setFilter((f) => ({ ...f, firm_id: e.target.value }))}
              style={{ ...inputStyle, display: 'block', marginTop: 4, width: 210 }}>
              <option value="">All firms</option>{firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <Caps size={9} color={T.iron400}>Status</Caps>
            <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
              style={{ ...inputStyle, display: 'block', marginTop: 4, width: 160 }}>
              <option value="">All</option><option value="matched">Matched</option><option value="classified">Classified</option><option value="unmatched">Unmatched</option>
            </select>
          </div>
          <div>
            <Caps size={9} color={T.iron400}>Type</Caps>
            <select value={filter.recon_type} onChange={(e) => setFilter((f) => ({ ...f, recon_type: e.target.value }))}
              style={{ ...inputStyle, display: 'block', marginTop: 4, width: 190 }}>
              <option value="">All types</option>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <Caps size={9} color={T.iron400}>Month</Caps>
            <input value={filter.period_key} onChange={(e) => setFilter((f) => ({ ...f, period_key: e.target.value }))}
              placeholder="2026-03" style={{ ...inputStyle, display: 'block', marginTop: 4, width: 110 }} />
          </div>
        </div>
      </IronCard>

      {/* Table */}
      <IronCard pad={0}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <Loader2 size={28} className="animate-spin" color={T.iron400} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {['Date', 'Firm', 'Debit', 'Credit', 'Type', 'Status', 'Linked to', 'Narration'].map((h) => (
                    <th key={h} style={{ ...thCell, textAlign: (h === 'Debit' || h === 'Credit') ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const s = STATUS[l.recon_status] || STATUS.unmatched; const Icon = s.icon;
                  return (
                    <tr key={i} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, whiteSpace: 'nowrap' }}>{l.date}</td>
                      <td style={{ ...tdCell, whiteSpace: 'nowrap' }}>{l.firm}</td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.rose }}>{inr(l.debit)}</td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.green }}>{inr(l.credit)}</td>
                      <td style={{ ...tdCell, whiteSpace: 'nowrap' }}>{TYPE_LABEL[l.recon_type] || l.recon_type}</td>
                      <td style={tdCell}>
                        <span style={{ ...badgeStyle(s.tone), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon size={11} />{s.label}
                        </span>
                      </td>
                      <td style={tdCell}>
                        {l.recon_ref
                          ? <span style={{ color: T.iron900 }}><span style={{ color: T.iron400 }}>{l.recon_ref_type}:</span> {l.recon_ref}</span>
                          : <span style={{ color: T.iron400 }}>—</span>}
                      </td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.description}>{l.description}</td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: T.iron400, fontSize: 13 }}>No lines — run reconciliation or adjust filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </IronCard>
    </IronShell>
  );
}

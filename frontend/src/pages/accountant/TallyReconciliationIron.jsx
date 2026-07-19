import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth, API } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell } from '@/components/iron/IronKit';

const inr = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function TallyReconciliationIron() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [minDiff, setMinDiff] = useState(1000);

  const load = (md = minDiff) => {
    setLoading(true);
    axios.get(`${API}/admin/tally/mismatches`, {
      headers: { Authorization: `Bearer ${token}` }, params: { min_diff: md },
    })
      .then((r) => setData(r.data))
      .catch(() => toast.error('Failed to load reconciliation'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const rows = data?.mismatches || [];
  const headers = ['PARTY', 'CRM BALANCE', 'TALLY BALANCE', 'DIFFERENCE', 'FIRMS', ''];

  return (
    <IronShell title="CRM ⇄ Tally Reconciliation"
      subtitle={`${data?.count || 0} MISMATCHES · GAP ₹${inr(data?.total_gap)}`} onRefresh={() => load()}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <IronCard pad={14}>
          <Caps size={9} color={T.iron400}>Parties mismatched</Caps>
          <div style={{ ...mono, fontSize: 26, fontWeight: 800, color: T.rose, marginTop: 4 }}>{data?.count || 0}</div>
        </IronCard>
        <IronCard pad={14}>
          <Caps size={9} color={T.iron400}>Total gap (CRM vs Tally)</Caps>
          <div style={{ ...mono, fontSize: 26, fontWeight: 800, color: T.iron900, marginTop: 4 }}>₹{inr(data?.total_gap)}</div>
        </IronCard>
        <IronCard pad={14}>
          <Caps size={9} color={T.iron400}>Flag gaps above</Caps>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={minDiff} onChange={(e) => setMinDiff(Number(e.target.value))}
              style={{ padding: '7px 10px', borderRadius: 6, border: `1px solid ${T.iron200}`, fontSize: 13 }}>
              {[100, 1000, 10000, 100000].map((v) => <option key={v} value={v}>₹{inr(v)}</option>)}
            </select>
            <button onClick={() => load(minDiff)}
              style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: T.orange, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Apply</button>
          </div>
        </IronCard>
      </div>

      <IronCard pad={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {headers.map((h, i) => (
                  <th key={i} style={{ ...thCell, textAlign: i >= 1 && i <= 3 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: T.iron400 }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: T.iron400 }}>No mismatches 🎉 — CRM and Tally agree.</td></tr>
              ) : rows.map((m, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.iron100}` }}>
                  <td style={{ ...tdCell }}>
                    <div style={{ fontWeight: 700, color: T.iron900 }}>{m.party_name}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{m.gstin}</div>
                  </td>
                  <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>₹{inr(Math.abs(m.crm_balance))} <span style={{ fontSize: 10, color: T.iron400 }}>{m.crm_balance >= 0 ? 'DR' : 'CR'}</span></td>
                  <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>₹{inr(Math.abs(m.tally_balance))} <span style={{ fontSize: 10, color: T.iron400 }}>{m.tally_balance >= 0 ? 'DR' : 'CR'}</span></td>
                  <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 800, color: T.rose }}>₹{inr(m.abs_diff)}</td>
                  <td style={{ ...tdCell, fontSize: 11, color: T.iron500 }}>{[...new Set((m.firms || []).map((f) => (f.company || '').split(' ').slice(0, 2).join(' ')))].join(', ')}</td>
                  <td style={{ ...tdCell, textAlign: 'right' }}>
                    <button onClick={() => navigate(`/accountant/ledger?party=${m.party_id}`)}
                      style={{ border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, padding: '5px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: T.iron700 }}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </IronCard>
      <div style={{ marginTop: 10, fontSize: 11, color: T.iron400 }}>
        Read-only. GSTIN-matched. CRM balance = your ledger; Tally = the authoritative books (net across firms). Intercompany party rows may show large expected gaps.
      </div>
    </IronShell>
  );
}

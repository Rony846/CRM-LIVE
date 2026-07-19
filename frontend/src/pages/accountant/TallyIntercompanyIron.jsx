import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth, API } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell } from '@/components/iron/IronKit';

const inr = (n) => Number(Math.abs(n || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const STATUS = {
  matched: { label: '✓ Matched', bg: '#f0fdf4', bd: '#bbf7d0', fg: '#15803d' },
  mismatch: { label: '⚠ Amount mismatch', bg: '#fffbeb', bd: '#fcd34d', fg: '#b45309' },
  direction_conflict: { label: '⚠ Direction conflict', bg: '#fef2f2', bd: '#fecaca', fg: '#b91c1c' },
  one_sided: { label: 'One-sided', bg: '#f8fafc', bd: '#e2e8f0', fg: '#64748b' },
};

// "A owes B" signed → human phrase from one firm's perspective.
const phrase = (a, b, v) => {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) < 1) return 'settled (₹0)';
  return v > 0 ? `${a} owes ${b} ₹${inr(v)}` : `${b} owes ${a} ₹${inr(v)}`;
};

export default function TallyIntercompanyIron() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    axios.get(`${API}/admin/tally/intercompany`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setData(r.data))
      .catch(() => toast.error('Failed to load intercompany reconciliation'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const pairs = data?.pairs || [];
  const bankPhrase = (p) => {
    const bk = p.bank || {}; const net = bk.net || 0;
    if (!bk.a_to_b && !bk.b_to_a) return { txt: 'no direct transfers', color: T.iron400 };
    if (Math.abs(net) < 1) return { txt: 'even', color: T.iron500 };
    return net > 0
      ? { txt: `${p.firm_a} → ${p.firm_b} ₹${inr(net)}`, color: T.blue }
      : { txt: `${p.firm_b} → ${p.firm_a} ₹${inr(net)}`, color: T.blue };
  };
  return (
    <IronShell title="Intercompany Reconciliation"
      subtitle={`${data?.mismatched || 0} DISAGREEMENTS · GAP ₹${inr(data?.total_gap)}`} onRefresh={load}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <IronCard pad={14}>
          <Caps size={9} color={T.iron400}>Firm pairs disagreeing</Caps>
          <div style={{ ...mono, fontSize: 26, fontWeight: 800, color: T.rose, marginTop: 4 }}>{data?.mismatched || 0}</div>
        </IronCard>
        <IronCard pad={14}>
          <Caps size={9} color={T.iron400}>Total intercompany gap</Caps>
          <div style={{ ...mono, fontSize: 26, fontWeight: 800, color: T.iron900, marginTop: 4 }}>₹{inr(data?.total_gap)}</div>
        </IronCard>
        <IronCard pad={14}>
          <Caps size={9} color={T.iron400}>Firms in Tally</Caps>
          <div style={{ ...mono, fontSize: 26, fontWeight: 800, color: T.iron900, marginTop: 4 }}>{(data?.firms_synced || []).length}</div>
        </IronCard>
      </div>

      <IronCard pad={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {['FIRM PAIR', "FIRM A's BOOKS", "FIRM B's BOOKS", 'ACTUAL CASH (BANK)', 'DIFFERENCE', 'STATUS'].map((h, i) => (
                  <th key={i} style={{ ...thCell, textAlign: i === 4 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: T.iron400 }}>Loading…</td></tr>
              ) : pairs.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: T.iron400 }}>No intercompany ledgers found.</td></tr>
              ) : pairs.map((p, i) => {
                const s = STATUS[p.status] || STATUS.one_sided;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.iron100}` }}>
                    <td style={{ ...tdCell, fontWeight: 700, color: T.iron900 }}>{p.firm_a} <span style={{ color: T.iron400 }}>↔</span> {p.firm_b}</td>
                    <td style={{ ...tdCell, fontSize: 12 }}>
                      {p.a_book.has ? phrase(p.firm_a, p.firm_b, p.a_book.a_owes_b) : <span style={{ color: T.iron400 }}>— no ledger —</span>}
                      {p.a_book.group && <div style={{ fontSize: 10, color: T.iron400 }}>{p.a_book.group}</div>}
                    </td>
                    <td style={{ ...tdCell, fontSize: 12 }}>
                      {p.b_book.has ? phrase(p.firm_a, p.firm_b, p.b_book.a_owes_b_mirror) : <span style={{ color: T.iron400 }}>— no ledger —</span>}
                      {p.b_book.group && <div style={{ fontSize: 10, color: T.iron400 }}>{p.b_book.group}</div>}
                    </td>
                    <td style={{ ...tdCell, fontSize: 12 }}>
                      {(() => { const bp = bankPhrase(p); return (<>
                        <span style={{ color: bp.color, fontWeight: 700 }}>{bp.txt}</span>
                        <div style={{ fontSize: 10, color: T.iron400 }}>net money actually moved</div>
                      </>); })()}
                    </td>
                    <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 800, color: p.status === 'matched' ? T.green : T.rose }}>
                      {p.abs_diff != null ? `₹${inr(p.abs_diff)}` : '—'}
                    </td>
                    <td style={{ ...tdCell }}>
                      <span style={{ display: 'inline-block', background: s.bg, border: `1px solid ${s.bd}`, color: s.fg, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>{s.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </IronCard>
      <div style={{ marginTop: 10, fontSize: 11, color: T.iron400 }}>
        Read-only, from Tally. Each firm's ledger for another group firm is compared with the mirror in that firm's books.
        A clean intercompany balance nets to equal-and-opposite; a "direction conflict" means both firms record the other as owing them.
      </div>
    </IronShell>
  );
}

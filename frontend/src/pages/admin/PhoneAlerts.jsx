import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, mono } from '@/components/iron/IronKit';
import { ShieldAlert, Phone, Users } from 'lucide-react';

/* Fraud-watch board — every phone number used on PIs under 2+ genuinely-different customer names.
   That reuse is the fake-order signature that ran the Barmer ring. Typo / firm-vs-proprietor variants
   are collapsed server-side, so what shows here is worth a human look. */
const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const card = { background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, padding: 14 };

export default function PhoneAlerts() {
  const { token } = useAuth();
  const H = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [minNames, setMinNames] = useState(2);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/duplicate-phone-alerts`, { headers: H, params: { min_names: minNames } });
      setRows(data?.alerts || []);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to load'); }
    finally { setLoading(false); }
  }, [H, minNames]);
  useEffect(() => { load(); }, [load]);

  const totalValue = rows.reduce((s, r) => s + (r.total_value || 0), 0);
  const threePlus = rows.filter((r) => r.distinct_names >= 3).length;

  return (
    <IronShell title="Phone-Reuse Fraud Watch" subtitle="One phone, multiple customer names — the fake-order tell" onRefresh={load}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 10, marginBottom: 14 }}>
        <div style={card}><Caps size={9}>Flagged phones</Caps><div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 26, color: T.iron900 }}>{rows.length}</div></div>
        <div style={{ ...card, borderColor: '#f5c2c2', background: '#fef2f2' }}><Caps size={9}>High risk (3+ names)</Caps><div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 26, color: '#b91c1c' }}>{threePlus}</div></div>
        <div style={card}><Caps size={9}>PI value at these phones</Caps><div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900 }}>{inr(totalValue)}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: T.iron600 }}>Min distinct names:</span>
        {[2, 3].map((n) => (
          <button key={n} onClick={() => setMinNames(n)}
            style={{ border: '1px solid ' + (minNames === n ? T.orange : T.iron200), background: minNames === n ? T.orange : T.white, color: minNames === n ? '#fff' : T.iron700, borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{n}+</button>
        ))}
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: T.iron50, textAlign: 'left' }}>
                {['Phone', 'Names', '# names', 'Customer names on this phone', 'Reps', 'PIs', 'PI value', 'First → last'].map((h) => (
                  <th key={h} style={{ padding: '9px 12px', color: T.iron500, fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: T.iron400 }}>Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: T.iron400 }}>No phones flagged.</td></tr>}
              {!loading && rows.map((r) => {
                const hot = r.distinct_names >= 3;
                return (
                  <tr key={r.phone} style={{ borderTop: '1px solid ' + T.iron100, background: hot ? '#fff6f4' : T.white }}>
                    <td style={{ padding: '8px 12px', ...mono, color: T.iron900, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      <Phone size={12} style={{ display: 'inline', marginRight: 4, color: hot ? '#b91c1c' : T.iron400 }} />{r.phone}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {hot && <span style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 800 }}><ShieldAlert size={11} style={{ display: 'inline', marginRight: 3 }} />HIGH</span>}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 800, color: hot ? '#b91c1c' : T.iron700 }}>{r.distinct_names}</td>
                    <td style={{ padding: '8px 12px', color: T.iron800, maxWidth: 320 }}>{(r.names || []).join(' · ')}</td>
                    <td style={{ padding: '8px 12px', color: T.iron600 }}>{(r.reps || []).join(', ') || '—'}</td>
                    <td style={{ padding: '8px 12px', color: T.iron700 }}>{r.pi_count}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: T.iron900, whiteSpace: 'nowrap' }}>{inr(r.total_value)}</td>
                    <td style={{ padding: '8px 12px', color: T.iron500, fontSize: 11.5, whiteSpace: 'nowrap' }}>{r.first_pi} → {r.last_pi}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: T.iron400, marginTop: 8 }}>
        <Users size={12} style={{ display: 'inline', marginRight: 4 }} />
        A new PI on any of these phones also raises a live warning to the rep at creation time. "HIGH" = 3+ unrelated names (strongest fraud signal).
      </div>
    </IronShell>
  );
}

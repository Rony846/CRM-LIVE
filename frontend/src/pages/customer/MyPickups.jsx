import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell } from '@/components/iron/IronKit';
import { Loader2, Download } from 'lucide-react';

/* Customer portal — "My Pickups": the customer's reverse pickups + the label to download,
   populated by the Return Desk (accountant uploads → WhatsApp + email + here). */

const STAGE = {
  awaiting_label: { t: 'Arranging', c: '#92400e', bg: '#fef3c7' },
  pickup_scheduled: { t: 'Label ready', c: '#1e40af', bg: '#dbeafe' },
  in_transit: { t: 'Picked up', c: '#3730a3', bg: '#e0e7ff' },
  received: { t: 'Received', c: '#166534', bg: '#dcfce7' },
};

export default function MyPickups() {
  const { token } = useAuth();
  const H = { Authorization: `Bearer ${token}` };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await axios.get(`${API}/customer/pickups`, { headers: H }); setRows(Array.isArray(data) ? data : []); }
    catch (e) { toast.error('Could not load your pickups'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const download = async (p) => {
    try {
      const res = await axios.get(`${API}/customer/pickup/${encodeURIComponent(p.pickup_id)}/label.pdf`, { headers: H, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = `pickup_${p.pickup_id}.pdf`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { toast.error('Label not available yet'); }
  };

  return (
    <IronShell title="My Pickups" subtitle={`${rows.length} REVERSE PICKUP${rows.length === 1 ? '' : 'S'}`} onRefresh={load}>
      <IronCard pad={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid ' + T.iron200, background: T.iron50 }}>
              {['Pickup', 'Item', 'Reason', 'Status', 'Label'].map((h, i) => <th key={i} style={thCell}><Caps size={8}>{h}</Caps></th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ ...tdCell, textAlign: 'center', padding: 40, color: T.iron400 }}><Loader2 size={18} className="animate-spin" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} style={{ ...tdCell, textAlign: 'center', padding: 40, color: T.iron400 }}>No pickups arranged yet.</td></tr>
            ) : rows.map((p) => {
              const st = STAGE[p.stage] || { t: p.stage, c: T.iron600, bg: T.iron100 };
              return (
                <tr key={p.pickup_id} className="iron-row" style={{ borderBottom: '1px solid ' + T.iron200 }}>
                  <td style={{ ...tdCell, ...mono, fontSize: 11.5 }}>{p.pickup_id}</td>
                  <td style={{ ...tdCell, fontSize: 12.5, maxWidth: 240 }}>{(p.product || '—').slice(0, 50)}</td>
                  <td style={{ ...tdCell, fontSize: 12, color: T.iron500 }}>{p.reason || '—'}</td>
                  <td style={tdCell}><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: st.bg, color: st.c }}>{st.t}</span>{p.tracking_id && <div style={{ ...mono, fontSize: 10, color: T.iron400, marginTop: 2 }}>{p.tracking_id}</div>}</td>
                  <td style={{ ...tdCell, textAlign: 'right' }}>
                    {p.has_label ? (
                      <button onClick={() => download(p)} style={{ border: '1px solid ' + T.iron200, background: T.white, color: T.iron700, borderRadius: 6, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center' }}><Download size={13} />Label</button>
                    ) : <span style={{ fontSize: 11, color: T.iron400 }}>preparing…</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </IronCard>
      <div style={{ fontSize: 12, color: T.iron500, marginTop: 12 }}>Once a label is ready, print it, tape it on the box, and hand it to the courier at pickup. We also send it on WhatsApp.</div>
    </IronShell>
  );
}

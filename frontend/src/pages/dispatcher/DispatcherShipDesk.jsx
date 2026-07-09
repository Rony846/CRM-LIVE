import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell } from '@/components/iron/IronKit';
import { Loader2 } from 'lucide-react';

/* Dispatcher Ship Desk — each dispatcher's OWN queue, routed by product category:
   inverter → Gaurav (technician), battery/stabilizer/rest → Angad (supervisor), combo → both.
   The night job books the label; here the dispatcher clicks "Print pack" and the full set
   (courier label + invoice on the Samsung; serial + QC + care card on the thermal) prints at the office. */

const btnOutline = { border: '1px solid ' + T.iron200, background: T.white, color: T.iron700, borderRadius: 6, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' };
const btnMini = { border: '1px solid ' + T.iron200, background: T.white, color: T.iron600, borderRadius: 6, padding: '8px 10px', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5, cursor: 'pointer' };

const ownerChip = (label) => {
  const inv = /Inverter/.test(label), combo = /both/.test(label);
  const bg = combo ? '#7c3aed' : inv ? '#ea580c' : '#0369a1';
  return { display: 'inline-block', background: bg, color: '#fff', borderRadius: 5, padding: '2px 8px', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2 };
};

export default function DispatcherShipDesk() {
  const { token, user } = useAuth();
  const H = { Authorization: `Bearer ${token}` };
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [packing, setPacking] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/dispatcher/pack-queue`, { headers: H });
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not load your queue'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const packSet = async (o, e) => {
    const oid = o.order_id || o.amazon_order_id || o.order_number;
    let serial = '';
    if (e?.shiftKey) serial = (window.prompt('Scan the unit serial to bind to this order:', '') || '').trim();
    setPacking(oid);
    try {
      const { data } = await axios.post(`${API}/orders/${encodeURIComponent(oid)}/print-pack-set`, null, { headers: H, params: { serial, customer: o.customer_name || '' } });
      const p = data.printed || {};
      const sn = (data.serials || []).join(', ');
      const okAll = Object.values(p).every((v) => v === true);
      const line = 'Pack set' + (sn ? ` · serial ${sn} (${data.serial_source})` : '') + ' → ' +
        Object.entries(p).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v === true ? '✓' : v}`).join(' · ');
      (okAll ? toast.success : (toast.warning || toast))(line);
    } catch (err) { toast.error(err?.response?.data?.detail || 'Pack set print failed'); }
    finally { setPacking(null); }
  };

  const downloadDoc = async (o, kind) => {
    const oid = o.order_id || o.amazon_order_id || o.order_number;
    const path = kind === 'label' ? 'label.pdf' : 'packing-slip.pdf';
    try {
      const res = await axios.get(`${API}/order-folders/order/${encodeURIComponent(oid)}/${path}`, { headers: H, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank'); // opens the PDF in a new tab → download or print (Ctrl+P)
    } catch (e) {
      toast.error(`Could not fetch the ${kind === 'label' ? 'shipping label' : 'packing slip'}`);
    }
  };

  const itemsText = (o) => {
    const its = o.items && o.items.length ? o.items : (o.master_sku_name ? [{ master_sku_name: o.master_sku_name, quantity: o.quantity }] : []);
    return its.map((i) => `${i.quantity || 1}× ${(i.master_sku_name || i.product_name || i.title || '').slice(0, 40)}`).join(', ') || '—';
  };

  const mine = user?.role === 'service_agent' ? 'Inverters' : user?.role === 'supervisor' ? 'Batteries & Stabilizers' : 'All';

  return (
    <IronShell title="My Ship Desk" subtitle={`${orders.length} ${mine.toUpperCase()} TO PACK`} onRefresh={load}>
      <IronCard pad={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid ' + T.iron200, background: T.iron50 }}>
              {['Order', 'Customer', 'Items', 'Route', 'Tracking ID', 'Pickup status', 'Deliver by (Amazon)', 'Destination', ''].map((h, i) => <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ ...tdCell, textAlign: 'center', padding: 40, color: T.iron400 }}><Loader2 size={18} className="animate-spin" /></td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={9} style={{ ...tdCell, textAlign: 'center', padding: 40, color: T.iron400 }}>Nothing waiting to pack 🎉</td></tr>
            ) : orders.map((o) => {
              const id = o.order_id || o.amazon_order_id || o.order_number;
              return (
                <tr key={o.id} className="iron-row" style={{ borderBottom: '1px solid ' + T.iron200 }}>
                  <td style={{ ...tdCell, ...mono, fontSize: 12 }}>{id || '—'}</td>
                  <td style={tdCell}><div style={{ fontWeight: 600, fontSize: 13 }}>{o.customer_name || '—'}</div><div style={{ ...mono, fontSize: 11, color: T.iron400 }}>{o.phone || ''}</div></td>
                  <td style={{ ...tdCell, color: T.iron500, fontSize: 12.5, maxWidth: 320 }}>{itemsText(o)}</td>
                  <td style={tdCell}><span style={ownerChip(o.owner_label || '')}>{o.owner_label || '—'}</span></td>
                  <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: o.tracking_id ? T.iron700 : T.iron300 }}>{o.tracking_id || '—'}</td>
                  <td style={{ ...tdCell, fontSize: 11.5, fontWeight: 600, color: o.not_picked ? '#c0392b' : T.iron500 }}>{o.pickup_status || (o.source === 'amazon' ? 'Booked · to pack' : 'Ready to pack')}</td>
                  <td style={{ ...tdCell, fontSize: 12, fontWeight: 600, color: o.amazon_deliver_by ? '#c2410c' : T.iron300 }}>{o.amazon_deliver_by || '—'}</td>
                  <td style={{ ...tdCell, color: T.iron500, fontSize: 12.5 }}>{[o.city, o.state, o.pincode].filter(Boolean).join(', ') || '—'}</td>
                  <td style={{ ...tdCell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => downloadDoc(o, 'label')} style={{ ...btnMini, marginRight: 5 }} title="Download / print the shipping label">⬇ Label</button>
                    <button onClick={() => downloadDoc(o, 'slip')} style={{ ...btnMini, marginRight: 5 }} title="Download / print the packing slip">⬇ Slip</button>
                    <button onClick={(e) => packSet(o, e)} disabled={packing === id} style={{ ...btnOutline, opacity: packing === id ? 0.6 : 1 }} title="Print label+invoice (Samsung) and serial+QC+care card (thermal) at the office, and bind a serial number to this unit. Shift-click to scan a serial manually.">{packing === id ? '🖨 …' : '🖨 Print pack'}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </IronCard>
    </IronShell>
  );
}

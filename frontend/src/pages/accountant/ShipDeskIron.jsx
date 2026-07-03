import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';
import { Upload, Loader2, PackageCheck, X, Truck } from 'lucide-react';

/* Ship Desk (Fulfilment V2) — the accountant's one-step action: pick a category + attach the
   Bigship label (PDF + AWB) and the order is routed to the right make-to-order queue
   (inverter→Gaurav, battery→Angad, stabilizer→Angad no-serial, combo→both). */

const CATS = [['auto', 'Auto (from product)'], ['inverter', 'Inverter → Gaurav'], ['battery', 'Battery → Angad'],
  ['stabilizer', 'Stabilizer → Angad (no serial)'], ['combo', 'Combo → both']];
// PF statuses that still need a label + routing
const SHIPPABLE = ['ready_to_dispatch', 'pending_dispatch', 'ready', 'pending'];

const inputStyle = { width: '100%', border: '1px solid ' + T.iron200, borderRadius: 6, padding: '8px 10px', fontSize: 13, color: T.iron900, background: T.white, outline: 'none', fontFamily: T.body };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '10px 18px', fontFamily: T.headline, fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const btnOutline = { border: '1px solid ' + T.iron200, background: T.white, color: T.iron700, borderRadius: 6, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' };

export default function ShipDesk() {
  const { token } = useAuth();
  const H = { Authorization: `Bearer ${token}` };
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);          // order being shipped
  const [form, setForm] = useState({ category: 'auto', awb: '', courier: 'Delhivery', file: null });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/pending-fulfillment`, { headers: H });
      const rows = (Array.isArray(data) ? data : data.entries || data.items || []).filter(
        (o) => SHIPPABLE.includes(o.status));
      setOrders(rows);
    } catch (e) { /* noop */ } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const open = (o) => { setSel(o); setForm({ category: 'auto', awb: '', courier: 'Delhivery', file: null }); };

  const ship = async () => {
    if (!form.awb.trim() && !form.file) { toast.error('Enter the AWB or upload the label'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('category', form.category);
      if (form.awb.trim()) fd.append('awb', form.awb.trim());
      if (form.courier.trim()) fd.append('courier', form.courier.trim());
      if (form.file) fd.append('label_file', form.file);
      const { data } = await axios.post(`${API}/ship-desk/${sel.id}`, fd, { headers: { ...H, 'Content-Type': 'multipart/form-data' } });
      toast.success(data.split_managed ? `Routed to ${data.category === 'combo' ? 'both queues' : (data.category === 'inverter' ? 'Gaurav' : 'Angad')} — ${data.dispatch_number}` : `Sent to dispatch — ${data.dispatch_number}`);
      setSel(null); load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not ship');
    } finally { setBusy(false); }
  };

  const itemsText = (o) => {
    const its = o.items && o.items.length ? o.items : (o.master_sku_name ? [{ master_sku_name: o.master_sku_name, quantity: o.quantity }] : []);
    return its.map((i) => `${i.quantity || 1}× ${(i.master_sku_name || i.product_name || i.title || '').slice(0, 40)}`).join(', ') || '—';
  };

  return (
    <IronShell title="Ship Desk" subtitle={`${orders.length} ORDERS TO SHIP`} onRefresh={load}>
      <IronCard pad={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid ' + T.iron200, background: T.iron50 }}>
              {['Order', 'Customer', 'Items', 'Destination', ''].map((h, i) => <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ ...tdCell, textAlign: 'center', padding: 40, color: T.iron400 }}><Loader2 size={18} className="animate-spin" /></td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={5} style={{ ...tdCell, textAlign: 'center', padding: 40, color: T.iron400 }}>Nothing waiting to ship 🎉</td></tr>
            ) : orders.map((o) => (
              <tr key={o.id} className="iron-row" style={{ borderBottom: '1px solid ' + T.iron200 }}>
                <td style={{ ...tdCell, ...mono, fontSize: 12 }}>{o.order_id || o.amazon_order_id || o.order_number || '—'}</td>
                <td style={tdCell}><div style={{ fontWeight: 600, fontSize: 13 }}>{o.customer_name || '—'}</div><div style={{ ...mono, fontSize: 11, color: T.iron400 }}>{o.phone || ''}</div></td>
                <td style={{ ...tdCell, color: T.iron500, fontSize: 12.5, maxWidth: 320 }}>{itemsText(o)}</td>
                <td style={{ ...tdCell, color: T.iron500, fontSize: 12.5 }}>{[o.city, o.state, o.pincode].filter(Boolean).join(', ') || '—'}</td>
                <td style={{ ...tdCell, textAlign: 'right' }}><button onClick={() => open(o)} style={btnOutline}>Ship</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </IronCard>

      {sel && (
        <div onClick={() => !busy && setSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,.45)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(500px,100%)', height: '100%', background: T.white, overflowY: 'auto', boxShadow: '-8px 0 30px rgba(0,0,0,.2)' }}>
            <div style={{ borderBottom: '1px solid ' + T.iron200, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 16 }}>Ship order</div>
                <div style={{ ...mono, fontSize: 11.5, color: T.iron400 }}>{sel.order_id || sel.amazon_order_id || sel.order_number}</div>
              </div>
              <button onClick={() => setSel(null)} style={{ ...btnOutline, padding: 8 }}><X size={16} /></button>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12.5, color: T.iron500 }}>{sel.customer_name} · {itemsText(sel)}</div>

              <div><Caps size={9} color={T.iron400} style={{ marginBottom: 5 }}>Category (who dispatches)</Caps>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={inputStyle}>
                  {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
                <div><Caps size={9} color={T.iron400} style={{ marginBottom: 5 }}>AWB / tracking</Caps>
                  <input value={form.awb} onChange={(e) => setForm((f) => ({ ...f, awb: e.target.value }))} placeholder="Bigship AWB" style={{ ...inputStyle, fontFamily: T.mono }} /></div>
                <div><Caps size={9} color={T.iron400} style={{ marginBottom: 5 }}>Courier</Caps>
                  <input value={form.courier} onChange={(e) => setForm((f) => ({ ...f, courier: e.target.value }))} style={inputStyle} /></div>
              </div>

              <div><Caps size={9} color={T.iron400} style={{ marginBottom: 5 }}>Label PDF (from Bigship panel)</Caps>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px dashed ' + T.iron200, borderRadius: 8, padding: '14px', cursor: 'pointer', background: T.iron50, color: T.iron500, fontSize: 12.5 }}>
                  <Upload size={16} />{form.file ? form.file.name : 'Upload the label PDF'}
                  <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
                </label></div>

              <div style={{ fontSize: 11.5, color: T.iron400, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Truck size={13} /> The maker enters the serial when they dispatch. Gate scan → finalize books COGS + GST.
              </div>
            </div>
            <div style={{ position: 'sticky', bottom: 0, background: T.white, borderTop: '1px solid ' + T.iron200, padding: '14px 22px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setSel(null)} style={btnOutline}>Cancel</button>
              <button onClick={ship} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <PackageCheck size={16} />} Attach label & route
              </button>
            </div>
          </div>
        </div>
      )}
    </IronShell>
  );
}

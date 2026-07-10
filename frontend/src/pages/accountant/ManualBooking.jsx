import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell } from '@/components/iron/IronKit';
import { Loader2, Upload, Check } from 'lucide-react';

/* Manual Booking — the accountant's landing page. A pre-made worklist of orders that still need a
   label. He enters only a Tracking ID (and, for orders above ₹50,000, the E-way bill number + PDF).
   On save the order moves to Gaurav's or Angad's Ship Desk, where they press Print pack. */

const inputStyle = { width: '100%', border: '1px solid ' + T.iron200, borderRadius: 6, padding: '7px 9px', fontSize: 13, color: T.iron900, background: T.white, outline: 'none', fontFamily: mono.fontFamily };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' };

const ownerChip = (label) => {
  const inv = /Inverter/.test(label), combo = /both/.test(label);
  const bg = combo ? '#7c3aed' : inv ? '#ea580c' : '#0369a1';
  return { display: 'inline-block', background: bg, color: '#fff', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 700 };
};

const L = ({ children }) => <div style={{ fontSize: 10.5, color: '#888', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3, fontWeight: 700 }}>{children}</div>;

export default function ManualBooking() {
  const { token } = useAuth();
  const H = { Authorization: `Bearer ${token}` };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});     // id -> { tracking, eway, file }
  const [saving, setSaving] = useState(null);
  const [offLabels, setOffLabels] = useState([]);   // offline orders on-desk still needing a label PDF
  const [labelUp, setLabelUp] = useState(null);
  const [pendingInv, setPendingInv] = useState([]); // non-Amazon shipments waiting for an invoice upload
  const [invUp, setInvUp] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mb, ol, pi] = await Promise.all([
        axios.get(`${API}/accountant/manual-bookings`, { headers: H }),
        axios.get(`${API}/accountant/offline-labels`, { headers: H }).catch(() => ({ data: [] })),
        axios.get(`${API}/accountant/pending-invoices`, { headers: H }).catch(() => ({ data: [] })),
      ]);
      setRows(Array.isArray(mb.data) ? mb.data : []);
      setOffLabels(Array.isArray(ol.data) ? ol.data : []);
      setPendingInv(Array.isArray(pi.data) ? pi.data : []);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not load the worklist'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const uploadShipmentInvoice = async (awb, file) => {
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    setInvUp(awb);
    try {
      await axios.post(`${API}/accountant/shipment-invoice/${encodeURIComponent(awb)}`, fd,
        { headers: { ...H, 'Content-Type': 'multipart/form-data' } });
      toast.success('Invoice uploaded — order moved to Gaurav / Angad');
      setPendingInv((r) => r.filter((x) => x.awb !== awb));
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not upload the invoice'); }
    finally { setInvUp(null); }
  };

  const uploadOfflineLabel = async (order_id, file) => {
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    setLabelUp(order_id);
    try {
      await axios.post(`${API}/accountant/offline-order/${encodeURIComponent(order_id)}/label`, fd,
        { headers: { ...H, 'Content-Type': 'multipart/form-data' } });
      toast.success('Shipping label attached — Print pack will now print it');
      setOffLabels((r) => r.filter((x) => x.order_id !== order_id));
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not attach the label'); }
    finally { setLabelUp(null); }
  };
  useEffect(() => { load(); }, [load]);

  const upd = (id, k, v) => setForm((f) => ({ ...f, [id]: { ...(f[id] || {}), [k]: v } }));

  const book = async (o) => {
    const st = form[o.id] || {};
    const tracking = (st.tracking || '').trim();
    if (!tracking) { toast.error('Enter the tracking ID'); return; }
    if (o.needs_eway && !(st.eway || '').trim()) { toast.error('E-way bill number is required above ₹50,000'); return; }
    if (o.needs_eway && !st.file) { toast.error('Attach the e-way bill / label PDF above ₹50,000'); return; }
    const fd = new FormData();
    fd.append('tracking_id', tracking);
    if (st.eway) fd.append('eway_bill_number', st.eway.trim());
    if (st.file) fd.append('label_file', st.file);
    setSaving(o.id);
    const url = o.source === 'amazon'
      ? `${API}/accountant/manual-bookings/amazon/${encodeURIComponent(o.amazon_order_id || o.order_id)}`
      : `${API}/accountant/manual-bookings/${o.id}`;
    try {
      const { data } = await axios.post(url, fd, { headers: { ...H, 'Content-Type': 'multipart/form-data' } });
      toast.success(`Booked → ${data.routed_to}`);
      setRows((r) => r.filter((x) => x.id !== o.id));
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not save the booking'); }
    finally { setSaving(null); }
  };

  const prod = (o) => (o.master_sku_name || (o.items && o.items[0] && (o.items[0].master_sku_name || o.items[0].title)) || '—');

  // ---- Add offline order (ANY firm, multi-item, upload invoice / eway / label) ----
  const MGIPL = '16abb602-875d-4283-bed9-f8789e688a17';
  const [showOff, setShowOff] = useState(false);
  const [off, setOff] = useState({ firm_id: MGIPL, items: [{}] });
  const [firms, setFirms] = useState([]);
  const [skuRes, setSkuRes] = useState({});   // rowIdx -> search results
  const [offSaving, setOffSaving] = useState(false);
  const setO = (k, v) => setOff((o) => ({ ...o, [k]: v }));
  const setItem = (i, k, v) => setOff((o) => { const it = [...(o.items || [{}])]; it[i] = { ...it[i], [k]: v }; return { ...o, items: it }; });
  const addItem = () => setOff((o) => ({ ...o, items: [...(o.items || []), {}] }));
  const removeItem = (i) => setOff((o) => ({ ...o, items: (o.items || []).filter((_, idx) => idx !== i) }));

  const openOff = async () => {
    setShowOff(true);
    if (!firms.length) { try { const { data } = await axios.get(`${API}/firms`, { headers: H }); setFirms(Array.isArray(data) ? data : []); } catch (e) {} }
  };
  const searchSkuRow = async (i, q) => {
    setItem(i, '_q', q); setItem(i, 'master_sku_id', undefined); setItem(i, '_name', undefined);
    if (!q || q.length < 2) { setSkuRes((s) => ({ ...s, [i]: [] })); return; }
    try {
      const { data } = await axios.get(`${API}/master-skus/search-for-dispatch`, { headers: H, params: { firm_id: off.firm_id || MGIPL, search: q, in_stock_only: false } });
      setSkuRes((s) => ({ ...s, [i]: (Array.isArray(data) ? data : data.skus || data.items || data.results || []).slice(0, 8) }));
    } catch (e) { setSkuRes((s) => ({ ...s, [i]: [] })); }
  };
  const pickSkuRow = (i, s) => { setItem(i, 'master_sku_id', s.id); setItem(i, '_name', s.name); setItem(i, '_q', s.name); setSkuRes((ss) => ({ ...ss, [i]: [] })); };

  const submitOffline = async () => {
    if (!(off.order_id || '').trim()) { toast.error('Order ID / invoice number is required'); return; }
    if (!(off.customer_name || '').trim()) { toast.error('Customer name is required'); return; }
    const items = (off.items || []).filter((it) => it.master_sku_id).map((it) => ({ master_sku_id: it.master_sku_id, quantity: Number(it.quantity || 1) }));
    if (!items.length) { toast.error('Add at least one product'); return; }
    setOffSaving(true);
    try {
      const { data } = await axios.post(`${API}/accountant/offline-order`, {
        order_id: off.order_id.trim(),
        firm_id: off.firm_id || MGIPL, customer_name: off.customer_name, phone: off.phone, address: off.address,
        city: off.city, state: off.state, pincode: off.pincode, invoice_value: off.invoice_value,
        tracking_id: off.tracking_id, courier: off.courier, eway_bill_number: off.eway_bill_number, items,
      }, { headers: H });
      const oid = data.order_id;
      const up = async (kind, file) => {
        if (!file) return;
        const fd = new FormData(); fd.append('kind', kind); fd.append('file', file);
        try { await axios.post(`${API}/accountant/offline-order/${encodeURIComponent(oid)}/attach`, fd, { headers: { ...H, 'Content-Type': 'multipart/form-data' } }); }
        catch (_e) { toast.error(`${kind} upload failed — attach it later`); }
      };
      await up('invoice', off._invoiceFile); await up('eway', off._ewayFile); await up('label', off._labelFile);
      toast.success(`Offline order created → ${data.routed_to}`);
      setShowOff(false); setOff({ firm_id: MGIPL, items: [{}] }); setSkuRes({}); load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not create the order'); }
    finally { setOffSaving(false); }
  };

  return (
    <IronShell title="Manual Booking" subtitle={`${rows.length} ORDERS NEED A LABEL`} onRefresh={load}>
      <div style={{ marginBottom: 12, textAlign: 'right' }}>
        <button onClick={openOff} style={btnPrimary}>+ Add offline order</button>
      </div>
      {showOff && (
        <div onClick={() => !offSaving && setShowOff(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,.45)', zIndex: 70, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 40 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(620px,95%)', background: T.white, borderRadius: 10, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.3)', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Add offline order</div>
            <div style={{ fontSize: 12, color: T.iron500, marginBottom: 16 }}>Direct / dealer / walk-in order for any firm. Non-Amazon orders release to Gaurav / Angad once the invoice is uploaded.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1 / 3' }}><L>Order ID / invoice number *</L>
                <input style={inputStyle} placeholder="The real invoice / order number, e.g. MGIPL/26-27/592" value={off.order_id || ''} onChange={(e) => setO('order_id', e.target.value)} />
                <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 3 }}>Use the actual invoice number — not auto-generated, so the ship desk & tracking match the invoice.</div></div>
              <div style={{ gridColumn: '1 / 3' }}><L>Firm *</L>
                <select style={inputStyle} value={off.firm_id || MGIPL} onChange={(e) => setO('firm_id', e.target.value)}>
                  {(firms.length ? firms : [{ id: MGIPL, name: 'MGIPL' }]).map((f) => <option key={f.id} value={f.id}>{f.name}{f.gstin ? ` · ${f.gstin}` : ''}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / 3' }}><L>Customer name *</L><input style={inputStyle} value={off.customer_name || ''} onChange={(e) => setO('customer_name', e.target.value)} /></div>
              <div><L>Phone</L><input style={inputStyle} value={off.phone || ''} onChange={(e) => setO('phone', e.target.value)} /></div>
              <div><L>Pincode</L><input style={inputStyle} value={off.pincode || ''} onChange={(e) => setO('pincode', e.target.value)} /></div>
              <div style={{ gridColumn: '1 / 3' }}><L>Address</L><input style={inputStyle} value={off.address || ''} onChange={(e) => setO('address', e.target.value)} /></div>
              <div><L>City</L><input style={inputStyle} value={off.city || ''} onChange={(e) => setO('city', e.target.value)} /></div>
              <div><L>State</L><input style={inputStyle} value={off.state || ''} onChange={(e) => setO('state', e.target.value)} /></div>
            </div>
            <div style={{ marginTop: 12 }}>
              <L>Products *</L>
              {(off.items || [{}]).map((it, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input style={inputStyle} placeholder="search product name / code" value={it._q || ''} onChange={(e) => searchSkuRow(i, e.target.value)} />
                    {it.master_sku_id && <div style={{ fontSize: 10.5, color: '#0b7d3e', marginTop: 2 }}>✓ {it._name?.slice(0, 44)}</div>}
                    {(skuRes[i] || []).length > 0 && (
                      <div style={{ position: 'absolute', zIndex: 6, background: T.white, border: '1px solid ' + T.iron200, borderRadius: 6, width: '100%', maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 20px rgba(0,0,0,.15)' }}>
                        {skuRes[i].map((s) => <div key={s.id} onClick={() => pickSkuRow(i, s)} style={{ padding: '7px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid ' + T.iron100 }}>{s.name}</div>)}
                      </div>
                    )}
                  </div>
                  <input type="number" min="1" style={{ ...inputStyle, width: 64 }} value={it.quantity || 1} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
                  {(off.items || []).length > 1 && <button onClick={() => removeItem(i)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', color: '#b91c1c', padding: '7px 10px' }}>✕</button>}
                </div>
              ))}
              <button onClick={addItem} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: T.orange }}>+ Add item</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div><L>Order value (₹)</L><input type="number" style={inputStyle} value={off.invoice_value || ''} onChange={(e) => setO('invoice_value', e.target.value)} /></div>
              <div><L>Tracking ID (optional)</L><input style={inputStyle} value={off.tracking_id || ''} onChange={(e) => setO('tracking_id', e.target.value)} /></div>
              <div><L>E-way bill no. (if &gt; ₹50k)</L><input style={inputStyle} value={off.eway_bill_number || ''} onChange={(e) => setO('eway_bill_number', e.target.value)} /></div>
              <div><L>Courier</L><input style={inputStyle} placeholder="Delhivery" value={off.courier || ''} onChange={(e) => setO('courier', e.target.value)} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
              {[['_invoiceFile', 'Invoice PDF'], ['_ewayFile', 'E-way PDF'], ['_labelFile', 'Label PDF']].map(([key, lbl]) => (
                <label key={key} style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11.5, color: off[key] ? '#0b7d3e' : T.iron500 }}>
                  {off[key] ? <Check size={13} /> : <Upload size={13} />}{off[key] ? off[key].name.slice(0, 12) : lbl}
                  <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => setO(key, e.target.files[0])} />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button onClick={() => setShowOff(false)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700 }}>Cancel</button>
              <button onClick={submitOffline} disabled={offSaving} style={{ ...btnPrimary, opacity: offSaving ? 0.6 : 1 }}>{offSaving ? 'Adding…' : 'Add order'}</button>
            </div>
          </div>
        </div>
      )}
      {pendingInv.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <IronCard pad={0}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid ' + T.iron200, background: '#fef2f2' }}>
              <Caps size={9}>Non-Amazon orders — upload invoice to release them to Gaurav / Angad ({pendingInv.length})</Caps>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {pendingInv.map((o) => (
                  <tr key={o.awb} className="iron-row" style={{ borderBottom: '1px solid ' + T.iron200 }}>
                    <td style={{ ...tdCell, ...mono, fontSize: 11.5 }}>{o.order_ref}</td>
                    <td style={{ ...tdCell, fontWeight: 600, fontSize: 12.5 }}>{o.customer_name || '—'}</td>
                    <td style={{ ...tdCell, fontSize: 12, color: T.iron600, maxWidth: 240 }}>{(o.product || '—').slice(0, 46)}</td>
                    <td style={{ ...tdCell, ...mono, fontSize: 12, fontWeight: 700 }}>{o.value ? '₹' + Math.round(o.value).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ ...tdCell, ...mono, fontSize: 10.5, color: T.iron400 }}>{o.awb}</td>
                    <td style={{ ...tdCell, textAlign: 'right' }}>
                      <label style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: invUp === o.awb ? 0.6 : 1 }}>
                        <Upload size={13} />{invUp === o.awb ? 'Uploading…' : 'Upload invoice PDF'}
                        <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={invUp === o.awb} onChange={(e) => uploadShipmentInvoice(o.awb, e.target.files[0])} />
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </IronCard>
        </div>
      )}
      {offLabels.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <IronCard pad={0}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid ' + T.iron200, background: '#fff7ed' }}>
              <Caps size={9}>Offline orders on the desk — attach the shipping label so Print pack can print it ({offLabels.length})</Caps>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {offLabels.map((o) => (
                  <tr key={o.order_id} className="iron-row" style={{ borderBottom: '1px solid ' + T.iron200 }}>
                    <td style={{ ...tdCell, ...mono, fontSize: 11.5 }}>{o.order_id}</td>
                    <td style={{ ...tdCell, fontWeight: 600, fontSize: 12.5 }}>{o.customer_name || '—'}</td>
                    <td style={{ ...tdCell, fontSize: 12, color: T.iron600, maxWidth: 240 }}>{(o.master_sku_name || '—').slice(0, 44)}</td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{o.courier || 'Delhivery'} · {o.tracking_id}</td>
                    <td style={{ ...tdCell, textAlign: 'right' }}>
                      <label style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: labelUp === o.order_id ? 0.6 : 1 }}>
                        <Upload size={13} />{labelUp === o.order_id ? 'Uploading…' : 'Attach label PDF'}
                        <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={labelUp === o.order_id} onChange={(e) => uploadOfflineLabel(o.order_id, e.target.files[0])} />
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </IronCard>
        </div>
      )}
      <IronCard pad={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid ' + T.iron200, background: T.iron50 }}>
              {['Order', 'Customer', 'Product', 'Value', 'Goes to', 'Tracking ID', 'E-way (if > ₹50k)', ''].map((h, i) => <th key={i} style={thCell}><Caps size={8}>{h}</Caps></th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ ...tdCell, textAlign: 'center', padding: 40, color: T.iron400 }}><Loader2 size={18} className="animate-spin" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} style={{ ...tdCell, textAlign: 'center', padding: 40, color: T.iron400 }}>Nothing to book — all caught up 🎉</td></tr>
            ) : rows.map((o) => {
              const st = form[o.id] || {};
              return (
                <tr key={o.id} className="iron-row" style={{ borderBottom: '1px solid ' + T.iron200, background: o.needs_eway ? '#fff7ed' : undefined }}>
                  <td style={{ ...tdCell, ...mono, fontSize: 11.5 }}>{o.order_id || o.amazon_order_id || '—'}</td>
                  <td style={tdCell}><div style={{ fontWeight: 600, fontSize: 12.5 }}>{o.customer_name || '—'}</div><div style={{ ...mono, fontSize: 10.5, color: T.iron400 }}>{[o.city, o.pincode].filter(Boolean).join(' · ')}</div></td>
                  <td style={{ ...tdCell, fontSize: 12, color: T.iron600, maxWidth: 220 }}>{prod(o).slice(0, 46)}</td>
                  <td style={{ ...tdCell, ...mono, fontSize: 12, fontWeight: 700, color: o.needs_eway ? '#c2410c' : T.iron700 }}>₹{Math.round(o.order_value || 0).toLocaleString('en-IN')}</td>
                  <td style={tdCell}><span style={ownerChip(o.owner_label || '')}>{(o.owner_label || '').replace(' → ', ' ')}</span></td>
                  <td style={{ ...tdCell, minWidth: 150 }}><input style={inputStyle} placeholder="AWB / tracking" value={st.tracking || ''} onChange={(e) => upd(o.id, 'tracking', e.target.value)} /></td>
                  <td style={{ ...tdCell, minWidth: 170 }}>
                    {o.needs_eway ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input style={inputStyle} placeholder="E-way bill no." value={st.eway || ''} onChange={(e) => upd(o.id, 'eway', e.target.value)} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: st.file ? '#0b7d3e' : T.iron500, cursor: 'pointer' }}>
                          {st.file ? <Check size={13} /> : <Upload size={13} />}{st.file ? st.file.name.slice(0, 18) : 'Attach PDF'}
                          <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => upd(o.id, 'file', e.target.files[0])} />
                        </label>
                      </div>
                    ) : <span style={{ color: T.iron300, fontSize: 11 }}>not needed</span>}
                  </td>
                  <td style={{ ...tdCell, textAlign: 'right' }}>
                    <button onClick={() => book(o)} disabled={saving === o.id} style={{ ...btnPrimary, opacity: saving === o.id ? 0.6 : 1 }}>{saving === o.id ? '…' : 'Book →'}</button>
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

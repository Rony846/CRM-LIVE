import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';
import { Loader2, Upload, Check, Printer, Download } from 'lucide-react';
import { CustomerName } from '@/components/Customer360';

/* Ship Desk 2.0 — one order pipeline, three lanes:
   Awaiting accountant (invoice+tracking+label) → Ready to ship (Gaurav/Angad) → Shipped. */

const MGIPL = '16abb602-875d-4283-bed9-f8789e688a17';
const inputStyle = { width: '100%', border: '1px solid ' + T.iron200, borderRadius: 6, padding: '7px 9px', fontSize: 13, color: T.iron900, background: T.white, outline: 'none', fontFamily: mono.fontFamily };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' };
const L = ({ children }) => <div style={{ fontSize: 10.5, color: '#888', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3, fontWeight: 700 }}>{children}</div>;
const DOC_LABEL = { invoice: 'Invoice', tracking: 'Tracking', label: 'Label', eway: 'E-way' };

export default function ShipDeskBoard() {
  const { token, user } = useAuth();
  const H = { Authorization: `Bearer ${token}` };
  const role = user?.role;
  const [board, setBoard] = useState({ awaiting_accountant: [], ready_to_ship: [], shipped: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});   // order_id::kind -> true
  const [track, setTrack] = useState({});  // order_id -> tracking text

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/ship-desk/board`, { headers: H });
      setBoard(data || {});
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not load the board'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const attach = async (o, kind, { file, tracking } = {}) => {
    const oid = o.order_id;
    const key = `${oid}::${kind}`;
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      if (o.source === 'pending_invoice') {
        // existing dealer order (from the invoice queue) — invoice by AWB releases it to the desk
        if (kind !== 'invoice') { setBusy((b) => ({ ...b, [key]: false })); return; }
        const fd = new FormData(); fd.append('file', file);
        await axios.post(`${API}/accountant/shipment-invoice/${encodeURIComponent(o.awb)}`, fd, { headers: { ...H, 'Content-Type': 'multipart/form-data' } });
        toast.success('Invoice uploaded — released to Gaurav / Angad');
      } else {
        const fd = new FormData(); fd.append('kind', kind);
        if (kind === 'tracking') { if (!(tracking || '').trim()) { setBusy((b) => ({ ...b, [key]: false })); return; } fd.append('tracking_id', tracking.trim()); fd.append('courier', 'Delhivery'); }
        else fd.append('file', file);
        const { data } = await axios.post(`${API}/ship-desk/order/${encodeURIComponent(oid)}/doc`, fd, { headers: { ...H, 'Content-Type': 'multipart/form-data' } });
        if (data.stage === 'ready_to_ship') toast.success('All docs in — moved to Gaurav / Angad');
        else toast.success(`${DOC_LABEL[kind]} saved`);
      }
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || `Could not save ${kind}`); }
    finally { setBusy((b) => ({ ...b, [key]: false })); }
  };

  const printPack = async (o) => {
    const key = `${o.order_id}::pack`;
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      await axios.post(`${API}/orders/${encodeURIComponent(o.order_id)}/print-pack-set`, null, { headers: H, params: { serial: '', customer: o.customer_name || '' } });
      toast.success('Print pack sent — check the printer');
    } catch (e) { toast.error(e?.response?.data?.detail || 'Print pack failed'); }
    finally { setBusy((b) => ({ ...b, [key]: false })); }
  };

  const download = async (oid, path, filename, params) => {
    try {
      const res = await axios.get(`${API}/ship-desk/order/${encodeURIComponent(oid)}/${path}`, { headers: H, responseType: 'blob', params });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) {
      let msg = 'Download failed';
      try { if (e?.response?.data instanceof Blob) { const t = JSON.parse(await e.response.data.text()); msg = t.detail || msg; } } catch (_) {}
      toast.error(msg);
    }
  };
  const sendBack = async (o) => {
    const reason = window.prompt('Send back to accountant — what needs fixing?');
    if (reason === null) return;
    try { await axios.post(`${API}/ship-desk/order/${encodeURIComponent(o.order_id)}/send-back`, { reason }, { headers: H }); toast.success('Sent back to accountant'); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Could not send back'); }
  };
  const ghostBtn = { border: '1px solid ' + T.iron200, background: T.white, color: T.iron700, borderRadius: 6, padding: '6px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 4, alignItems: 'center' };

  // ---- New dispatch modal ----
  const DISPATCH_TYPES = [
    { key: 'new_order', label: 'New order', sub: 'A sale — order ID / invoice' },
    { key: 'spare_part', label: 'Spare part', sub: 'Against a ticket' },
    { key: 'replacement', label: 'Replacement', sub: 'Against a ticket' },
    { key: 'repaired', label: 'Repaired item', sub: 'Against a ticket' },
  ];
  const isTicketType = (dt) => ['spare_part', 'replacement', 'repaired'].includes(dt);
  const [showNew, setShowNew] = useState(false);
  const [firms, setFirms] = useState([]);
  const [nf, setNf] = useState({ firm_id: MGIPL, dispatch_type: 'new_order', payment_mode: 'prepaid' });
  const [skus, setSkus] = useState([]);
  const [ticketInfo, setTicketInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const setF = (k, v) => setNf((o) => ({ ...o, [k]: v }));
  const openNew = async () => { setNf({ firm_id: MGIPL, dispatch_type: 'new_order', payment_mode: 'prepaid' }); setTicketInfo(null); setSkus([]); setShowNew(true); if (!firms.length) { try { const { data } = await axios.get(`${API}/firms`, { headers: H }); setFirms(Array.isArray(data) ? data : []); } catch (e) {} } };
  const searchSku = async (q) => {
    setF('_skuq', q); setF('master_sku_id', undefined); setF('product', q);
    if (!q || q.length < 2) { setSkus([]); return; }
    try { const { data } = await axios.get(`${API}/master-skus/search-for-dispatch`, { headers: H, params: { firm_id: nf.firm_id || MGIPL, search: q, in_stock_only: false } }); setSkus((Array.isArray(data) ? data : data.skus || data.items || []).slice(0, 8)); } catch (e) { setSkus([]); }
  };
  const lookupTicket = async (tn) => {
    setF('ticket_number', tn); setTicketInfo(null);
    if (!tn || tn.trim().length < 6) return;
    try {
      const { data } = await axios.get(`${API}/tickets`, { headers: H, params: { search: tn.trim(), limit: 3 } });
      const list = Array.isArray(data) ? data : (data.tickets || data.items || []);
      const t = list.find((x) => (x.ticket_number || '') === tn.trim()) || list[0];
      if (t) { setTicketInfo(t); if (!nf.customer_name) setF('customer_name', t.customer_name || ''); }
    } catch (e) { /* ignore */ }
  };
  const submitNew = async () => {
    const dt = nf.dispatch_type || 'new_order';
    if (isTicketType(dt)) {
      if (!(nf.ticket_number || '').trim()) { toast.error('Ticket number is required'); return; }
    } else {
      if (!(nf.order_id || '').trim()) { toast.error('Order ID / invoice reference is required'); return; }
      if (!(nf.customer_name || '').trim()) { toast.error('Customer name is required'); return; }
    }
    // product required for new_order & spare_part; replacement/repaired default from the ticket
    if (!nf.master_sku_id && !(nf.product || '').trim() && !['replacement', 'repaired'].includes(dt)) { toast.error('Enter what you are dispatching'); return; }
    if ((nf.payment_mode || 'prepaid') === 'cod' && !(Number(nf.cod_amount) > 0)) { toast.error('Enter the COD amount to collect'); return; }
    setSaving(true);
    try {
      const body = { dispatch_type: dt, firm_id: nf.firm_id || MGIPL, phone: nf.phone, address: nf.address, city: nf.city, state: nf.state, pincode: nf.pincode, invoice_value: nf.invoice_value, payment_mode: nf.payment_mode || 'prepaid', cod_amount: nf.cod_amount };
      if (isTicketType(dt)) body.ticket_number = nf.ticket_number.trim(); else body.order_id = nf.order_id.trim();
      if (nf.customer_name) body.customer_name = nf.customer_name;
      if (nf.master_sku_id) body.items = [{ master_sku_id: nf.master_sku_id, quantity: Number(nf.quantity || 1) }];
      else if (nf.product) body.product = nf.product;
      const { data } = await axios.post(`${API}/ship-desk/order`, body, { headers: H });
      const lbl = (DISPATCH_TYPES.find((x) => x.key === dt) || {}).label || 'Dispatch';
      toast.success(`${lbl} ${data.order_id} created → awaiting accountant`);
      setShowNew(false); setNf({ firm_id: MGIPL, dispatch_type: 'new_order', payment_mode: 'prepaid' }); setSkus([]); setTicketInfo(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not create the dispatch'); }
    finally { setSaving(false); }
  };

  const canEnter = ['call_support', 'admin', 'accountant', 'supervisor', 'service_agent'].includes(role);
  const isAcct = ['accountant', 'admin'].includes(role);
  const isDispatch = ['admin', 'dispatcher', 'supervisor', 'service_agent', 'technician'].includes(role);

  const Chip = ({ ok, label }) => (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginRight: 4, marginTop: 3, display: 'inline-block', background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b' }}>{ok ? '✓' : '✕'} {label}</span>
  );

  const Card = ({ o, children }) => (
    <div style={{ background: T.white, border: '1px solid ' + T.iron200, borderRadius: 8, padding: 11, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5 }}><CustomerName name={o.customer_name} phone={o.phone} /></div>
        <div style={{ ...mono, fontSize: 9.5, color: T.iron400, wordBreak: 'break-all', textAlign: 'right' }}>{o.order_id}</div>
      </div>
      <div style={{ fontSize: 11.5, color: T.iron600, margin: '2px 0 4px' }}>{(o.product || '—').slice(0, 52)}</div>
      <div style={{ fontSize: 10, color: T.iron400 }}>{o.firm_name}{o.value ? ` · ₹${Math.round(o.value).toLocaleString('en-IN')}` : ''}{o.owner_label ? ` · ${o.owner_label}` : ''}</div>
      {children}
    </div>
  );

  const Lane = ({ title, tint, items, render }) => (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div style={{ padding: '8px 12px', borderRadius: '8px 8px 0 0', background: tint, borderBottom: '2px solid ' + T.iron200 }}>
        <Caps size={9}>{title} · {items.length}</Caps>
      </div>
      <div style={{ background: T.iron50, padding: 8, borderRadius: '0 0 8px 8px', minHeight: 120, maxHeight: '72vh', overflowY: 'auto' }}>
        {items.length === 0 ? <div style={{ textAlign: 'center', color: T.iron400, fontSize: 12, padding: 24 }}>—</div> : items.map(render)}
      </div>
    </div>
  );

  return (
    <IronShell title="Ship Desk" subtitle={`${board.counts?.awaiting_accountant || 0} AWAITING · ${board.counts?.ready_to_ship || 0} TO SHIP`} onRefresh={load}>
      {canEnter && (
        <div style={{ marginBottom: 12, textAlign: 'right' }}>
          <button onClick={openNew} style={btnPrimary}>+ New dispatch</button>
        </div>
      )}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.iron400 }}><Loader2 size={20} className="animate-spin" /></div>
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Lane title="Awaiting accountant" tint="#fef2f2" items={board.awaiting_accountant || []} render={(o) => (
            <Card key={o.order_id} o={o}>
              {o.sent_back_reason && <div style={{ fontSize: 10.5, color: '#991b1b', background: '#fef2f2', borderRadius: 4, padding: '3px 6px', marginTop: 6 }}>↩ Sent back: {o.sent_back_reason}</div>}
              <div style={{ marginTop: 6 }}>{(o.required || []).map((k) => <Chip key={k} ok={(o.present || []).includes(k)} label={DOC_LABEL[k]} />)}</div>
              {isAcct && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {!(o.present || []).includes('invoice') && (
                    <label style={{ ...btnPrimary, background: T.iron700, display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11, padding: '6px 9px' }}>
                      <Upload size={12} />Invoice<input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => attach(o, 'invoice', { file: e.target.files[0] })} /></label>)}
                  {!(o.present || []).includes('label') && (
                    <label style={{ ...btnPrimary, background: T.iron700, display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11, padding: '6px 9px' }}>
                      <Upload size={12} />Label<input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => attach(o, 'label', { file: e.target.files[0] })} /></label>)}
                  {(o.required || []).includes('eway') && !(o.present || []).includes('eway') && (
                    <label style={{ ...btnPrimary, background: T.iron700, display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11, padding: '6px 9px' }}>
                      <Upload size={12} />E-way<input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => attach(o, 'eway', { file: e.target.files[0] })} /></label>)}
                  {!(o.present || []).includes('tracking') && (
                    <div style={{ display: 'flex', gap: 4, flex: 1, minWidth: 150 }}>
                      <input style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }} placeholder="Tracking ID" value={track[o.order_id] || ''} onChange={(e) => setTrack((t) => ({ ...t, [o.order_id]: e.target.value }))} />
                      <button onClick={() => attach(o, 'tracking', { tracking: track[o.order_id] })} style={{ ...btnPrimary, background: T.iron700, fontSize: 11, padding: '6px 9px' }}>Save</button>
                    </div>)}
                </div>
              )}
            </Card>
          )} />
          <Lane title="Ready to ship" tint="#eff6ff" items={board.ready_to_ship || []} render={(o) => (
            <Card key={o.order_id} o={o}>
              {o.tracking_id && (
                <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 9.5, color: T.iron400, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700 }}>AWB</span>
                  <span style={{ ...mono, fontSize: 11.5, color: T.iron800, fontWeight: 700 }}>{o.tracking_id}</span>
                  {o.pickup_status && <span style={{ fontSize: 9.5, color: T.iron400 }}>· {o.pickup_status}</span>}
                </div>
              )}
              {isDispatch && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => printPack(o)} disabled={busy[`${o.order_id}::pack`]} style={{ ...btnPrimary, display: 'inline-flex', gap: 4, alignItems: 'center', opacity: busy[`${o.order_id}::pack`] ? 0.6 : 1 }}>
                    <Printer size={13} />{busy[`${o.order_id}::pack`] ? '…' : 'Print pack'}</button>
                  {(o.present || []).includes('label') && <button onClick={() => download(o.order_id, 'file/label', `label_${o.order_id}.pdf`, { awb: o.tracking_id })} style={ghostBtn}><Download size={12} />Label</button>}
                  <button onClick={() => download(o.order_id, 'slip.pdf', `slip_${o.order_id}.pdf`)} style={ghostBtn}><Download size={12} />Slip</button>
                  <button onClick={() => sendBack(o)} style={{ ...ghostBtn, color: '#b91c1c', borderColor: '#fecaca' }}>↩ Back</button>
                </div>
              )}
            </Card>
          )} />
          <Lane title="Shipped" tint="#f0fdf4" items={board.shipped || []} render={(o) => (
            <Card key={o.order_id} o={o}><div style={{ marginTop: 4, fontSize: 10.5, color: '#166534', fontWeight: 700 }}>✓ Packed{o.tracking_id ? ` · ${o.tracking_id}` : ''}</div></Card>
          )} />
        </div>
      )}

      {showNew && (
        <div onClick={() => !saving && setShowNew(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,.45)', zIndex: 70, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 44 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px,95%)', background: T.white, borderRadius: 10, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.3)', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 17, marginBottom: 4 }}>New dispatch</div>
            <div style={{ fontSize: 12, color: T.iron500, marginBottom: 14 }}>What are you dispatching?</div>
            {/* Step 1: dispatch type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {DISPATCH_TYPES.map((d) => {
                const on = (nf.dispatch_type || 'new_order') === d.key;
                return (
                  <button key={d.key} onClick={() => { setF('dispatch_type', d.key); setTicketInfo(null); }}
                    style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 8, cursor: 'pointer',
                      border: `1.5px solid ${on ? T.orange : T.iron200}`, background: on ? '#fff7ed' : T.white }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: on ? T.orange : T.iron800 }}>{d.label}</div>
                    <div style={{ fontSize: 10.5, color: T.iron500 }}>{d.sub}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* Step 2a: reference — order id OR ticket number */}
              {isTicketType(nf.dispatch_type) ? (
                <div style={{ gridColumn: '1 / 3' }}><L>Ticket number *</L>
                  <input style={inputStyle} placeholder="e.g. MG-R-20260219-00004" value={nf.ticket_number || ''} onChange={(e) => lookupTicket(e.target.value)} />
                  {ticketInfo && (
                    <div style={{ fontSize: 11, color: '#166534', background: '#f0fdf4', borderRadius: 6, padding: '5px 8px', marginTop: 4 }}>
                      ✓ {ticketInfo.customer_name}{ticketInfo.customer_phone ? ` · ${ticketInfo.customer_phone}` : ''}{ticketInfo.product_name ? ` · ${ticketInfo.product_name}` : ''}{ticketInfo.serial_number ? ` · SN ${ticketInfo.serial_number}` : ''}
                    </div>)}
                  <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 3 }}>Customer &amp; product come from the ticket. This is recorded on the customer's 360.</div></div>
              ) : (
                <div style={{ gridColumn: '1 / 3' }}><L>Order ID / invoice reference *</L>
                  <input style={inputStyle} placeholder="The real order / invoice / SO / challan number" value={nf.order_id || ''} onChange={(e) => setF('order_id', e.target.value)} />
                  <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 3 }}>Use the actual reference the sale is known by, so invoice, dispatch &amp; tracking all match.</div></div>
              )}
              <div style={{ gridColumn: '1 / 3' }}><L>Firm *</L>
                <select style={inputStyle} value={nf.firm_id || MGIPL} onChange={(e) => setF('firm_id', e.target.value)}>
                  {(firms.length ? firms : [{ id: MGIPL, name: 'MGIPL' }]).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select></div>
              <div style={{ gridColumn: '1 / 3', position: 'relative' }}>
                <L>{nf.dispatch_type === 'spare_part' ? 'Which spare part *' : isTicketType(nf.dispatch_type) ? 'Item (defaults to the ticket product)' : 'What to ship *'} {nf.master_sku_id && <span style={{ color: '#0b7d3e' }}>✓ catalogue</span>}</L>
                <input style={inputStyle} placeholder={nf.dispatch_type === 'spare_part' ? 'e.g. PCB C35, relay, display' : 'e.g. PCB C35, or search a product'} value={nf._skuq || ''} onChange={(e) => searchSku(e.target.value)} />
                {skus.length > 0 && (
                  <div style={{ position: 'absolute', zIndex: 5, background: T.white, border: '1px solid ' + T.iron200, borderRadius: 6, width: '100%', maxHeight: 190, overflowY: 'auto', boxShadow: '0 8px 20px rgba(0,0,0,.15)' }}>
                    {skus.map((s) => <div key={s.id} onClick={() => { setF('master_sku_id', s.id); setF('product', s.name); setF('_skuq', s.name); setSkus([]); }} style={{ padding: '8px 10px', fontSize: 12.5, cursor: 'pointer', borderBottom: '1px solid ' + T.iron100 }}>{s.name}</div>)}
                  </div>)}
              </div>
              {!isTicketType(nf.dispatch_type) && (
                <div style={{ gridColumn: '1 / 3' }}><L>Customer name *</L><input style={inputStyle} value={nf.customer_name || ''} onChange={(e) => setF('customer_name', e.target.value)} /></div>
              )}
              <div><L>Phone{isTicketType(nf.dispatch_type) ? ' (from ticket if blank)' : ''}</L><input style={inputStyle} value={nf.phone || ''} onChange={(e) => setF('phone', e.target.value)} /></div>
              <div><L>Pincode</L><input style={inputStyle} value={nf.pincode || ''} onChange={(e) => setF('pincode', e.target.value)} /></div>
              <div style={{ gridColumn: '1 / 3' }}><L>Address{isTicketType(nf.dispatch_type) ? ' (from ticket if blank)' : ''}</L><input style={inputStyle} value={nf.address || ''} onChange={(e) => setF('address', e.target.value)} /></div>
              <div><L>City</L><input style={inputStyle} value={nf.city || ''} onChange={(e) => setF('city', e.target.value)} /></div>
              <div><L>State</L><input style={inputStyle} value={nf.state || ''} onChange={(e) => setF('state', e.target.value)} /></div>
              <div><L>Qty</L><input type="number" min="1" style={inputStyle} value={nf.quantity || 1} onChange={(e) => setF('quantity', e.target.value)} /></div>
              {!isTicketType(nf.dispatch_type) && <div><L>Order value (₹)</L><input type="number" style={inputStyle} value={nf.invoice_value || ''} onChange={(e) => setF('invoice_value', e.target.value)} /></div>}
            </div>
            {/* Step 3: payment */}
            <div style={{ marginTop: 14, padding: '10px 12px', border: `1px solid ${T.iron200}`, borderRadius: 8, background: T.iron50 }}>
              <L>Payment</L>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {['prepaid', 'cod'].map((m) => {
                  const on = (nf.payment_mode || 'prepaid') === m;
                  return <button key={m} onClick={() => setF('payment_mode', m)} style={{ flex: 1, padding: '8px 10px', borderRadius: 7, cursor: 'pointer', fontWeight: 800, fontSize: 12.5, border: `1.5px solid ${on ? T.orange : T.iron200}`, background: on ? '#fff7ed' : T.white, color: on ? T.orange : T.iron700 }}>{m === 'cod' ? 'COD' : 'Prepaid'}</button>;
                })}
              </div>
              {(nf.payment_mode || 'prepaid') === 'cod' && (
                <div style={{ marginTop: 8 }}><L>COD amount to collect (₹) *</L>
                  <input type="number" style={inputStyle} placeholder="Amount the courier collects" value={nf.cod_amount || ''} onChange={(e) => setF('cod_amount', e.target.value)} /></div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button onClick={() => setShowNew(false)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700 }}>Cancel</button>
              <button onClick={submitNew} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Adding…' : 'Create dispatch'}</button>
            </div>
          </div>
        </div>
      )}
    </IronShell>
  );
}

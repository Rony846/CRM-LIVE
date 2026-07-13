import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, mono } from '@/components/iron/IronKit';
import { Loader2, Upload, Download } from 'lucide-react';
import { CustomerName } from '@/components/Customer360';

/* Return Desk — reverse-pickup pipeline (item comes FROM the customer):
   Awaiting label → Pickup scheduled → In transit → Received. */

const inputStyle = { width: '100%', border: '1px solid ' + T.iron200, borderRadius: 6, padding: '7px 9px', fontSize: 13, color: T.iron900, background: T.white, outline: 'none', fontFamily: mono.fontFamily };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' };
const ghostBtn = { border: '1px solid ' + T.iron200, background: T.white, color: T.iron700, borderRadius: 6, padding: '6px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 4, alignItems: 'center' };
const L = ({ children }) => <div style={{ fontSize: 10.5, color: '#888', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3, fontWeight: 700 }}>{children}</div>;
const LANES = [['awaiting_label', 'Awaiting label', '#fef2f2'], ['pickup_scheduled', 'Pickup scheduled', '#eff6ff'], ['in_transit', 'In transit', '#fefce8'], ['received', 'Received', '#f0fdf4']];

export default function ReturnDeskBoard() {
  const { token, user } = useAuth();
  const H = { Authorization: `Bearer ${token}` };
  const role = user?.role;
  const [board, setBoard] = useState({ counts: {} });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const [track, setTrack] = useState({});
  // Product tabs — split the mixed return list so the inverter tech sees inverters separately from
  // stabilizers (founder ask). 'all' keeps full visibility for supervisors/accountants.
  const prodType = (name) => {
    const t = (name || '').toLowerCase();
    if (t.includes('stabiliz')) return 'stabilizer';
    if (t.includes('inverter')) return 'inverter';
    return 'other';
  };
  const RTABS = [['inverter', 'Inverter'], ['stabilizer', 'Stabilizer'], ['all', 'All']];
  const [tab, setTab] = useState(user?.role === 'service_agent' ? 'inverter' : 'all');
  const laneItems = (key) => {
    const items = board[key] || [];
    return tab === 'all' ? items : items.filter((o) => prodType(o.product) === tab);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await axios.get(`${API}/return-desk/board`, { headers: H }); setBoard(data || {}); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Could not load the board'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const uploadLabel = async (o, file) => {
    if (!file) return;
    const key = o.pickup_id;
    setBusy((b) => ({ ...b, [key]: true }));
    const fd = new FormData(); fd.append('file', file);
    if ((track[o.pickup_id] || '').trim()) { fd.append('tracking_id', track[o.pickup_id].trim()); fd.append('courier', 'Delhivery'); }
    try {
      const { data } = await axios.post(`${API}/return-desk/pickup/${encodeURIComponent(o.pickup_id)}/label`, fd, { headers: { ...H, 'Content-Type': 'multipart/form-data' } });
      toast.success(`Label sent to customer${data.whatsapp_sent ? ' (WhatsApp ✓)' : ''}${data.emailed ? ' (email ✓)' : ''}`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not upload the label'); }
    finally { setBusy((b) => ({ ...b, [key]: false })); }
  };
  const download = async (o) => {
    try {
      const res = await axios.get(`${API}/return-desk/pickup/${encodeURIComponent(o.pickup_id)}/label.pdf`, { headers: H, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = `pickup_${o.pickup_id}.pdf`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { toast.error('Download failed'); }
  };

  // ---- New pickup modal ----
  const RETURN_TYPES = [
    { key: 'faulty_pickup', label: 'Faulty unit', sub: 'Reverse pickup against a ticket' },
    { key: 'refund_return', label: 'Return for refund', sub: 'Against the original order' },
  ];
  const [showNew, setShowNew] = useState(false);
  const [np, setNp] = useState({ return_type: 'faulty_pickup' });
  const [ticketInfo, setTicketInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const setP = (k, v) => setNp((o) => ({ ...o, [k]: v }));
  const isFaulty = (np.return_type || 'faulty_pickup') === 'faulty_pickup';
  const lookupTicket = async (tn) => {
    setP('ticket_number', tn); setTicketInfo(null);
    if (!tn || tn.trim().length < 6) return;
    try {
      const { data } = await axios.get(`${API}/tickets`, { headers: H, params: { search: tn.trim(), limit: 3 } });
      const list = Array.isArray(data) ? data : (data.tickets || data.items || []);
      const t = list.find((x) => (x.ticket_number || '') === tn.trim()) || list[0];
      if (t) { setTicketInfo(t); if (!np.customer_name) setP('customer_name', t.customer_name || ''); if (!np.product) setP('product', t.product_name || t.device_type || ''); }
    } catch (e) { /* ignore */ }
  };
  const submitNew = async () => {
    const rt = np.return_type || 'faulty_pickup';
    if (rt === 'faulty_pickup' && !(np.ticket_number || '').trim()) { toast.error('Ticket number is required'); return; }
    if (!(np.customer_name || '').trim() && !(np.ticket_number || '').trim()) { toast.error('Customer name is required'); return; }
    if (!(np.product || '').trim() && !(np.ticket_number || '').trim()) { toast.error('Enter what to pick up'); return; }
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/return-desk/pickup`, np, { headers: H });
      toast.success(`Pickup ${data.pickup_id} created → awaiting label`);
      setShowNew(false); setNp({ return_type: 'faulty_pickup' }); setTicketInfo(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not create the pickup'); }
    finally { setSaving(false); }
  };

  const canEnter = ['call_support', 'admin', 'accountant', 'supervisor', 'service_agent'].includes(role);
  const isAcct = ['accountant', 'admin'].includes(role);

  const Card = ({ o, children }) => (
    <div style={{ background: T.white, border: '1px solid ' + T.iron200, borderRadius: 8, padding: 11, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontWeight: 700, fontSize: 12.5 }}><CustomerName name={o.customer_name} phone={o.phone} /></div>
        <div style={{ ...mono, fontSize: 9.5, color: T.iron400, wordBreak: 'break-all', textAlign: 'right' }}>{o.pickup_id}</div>
      </div>
      <div style={{ fontSize: 11.5, color: T.iron600, margin: '2px 0 3px' }}>{(o.product || '—').slice(0, 52)}</div>
      {o.reason && <div style={{ fontSize: 10, color: T.iron400 }}>Reason: {o.reason}</div>}
      {(o.whatsapp_sent || o.emailed) && <div style={{ fontSize: 10, color: '#166534', marginTop: 2 }}>{o.whatsapp_sent ? '📱 WhatsApp ✓ ' : ''}{o.emailed ? '📧 Email ✓' : ''}</div>}
      {children}
    </div>
  );

  return (
    <IronShell title="Return Desk" subtitle={`${board.counts?.awaiting_label || 0} AWAITING LABEL`} onRefresh={load}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {RTABS.map(([key, label]) => {
            const on = tab === key;
            const n = key === 'all' ? LANES.reduce((s, [k]) => s + (board[k] || []).length, 0)
              : LANES.reduce((s, [k]) => s + (board[k] || []).filter((o) => prodType(o.product) === key).length, 0);
            return (
              <button key={key} onClick={() => setTab(key)}
                style={{ border: '1.5px solid ' + (on ? T.orange : T.iron200), background: on ? '#fff7ed' : T.white, color: on ? T.orange : T.iron700, borderRadius: 8, padding: '7px 14px', fontFamily: T.headline, fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>
                {label} · {n}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        {canEnter && <button onClick={() => setShowNew(true)} style={btnPrimary}>+ Arrange pickup</button>}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.iron400 }}><Loader2 size={20} className="animate-spin" /></div>
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {LANES.map(([key, title, tint]) => (
            <div key={key} style={{ flex: 1, minWidth: 270 }}>
              <div style={{ padding: '8px 12px', borderRadius: '8px 8px 0 0', background: tint, borderBottom: '2px solid ' + T.iron200 }}><Caps size={9}>{title} · {laneItems(key).length}</Caps></div>
              <div style={{ background: T.iron50, padding: 8, borderRadius: '0 0 8px 8px', minHeight: 120, maxHeight: '72vh', overflowY: 'auto' }}>
                {laneItems(key).length === 0 ? <div style={{ textAlign: 'center', color: T.iron400, fontSize: 12, padding: 24 }}>—</div> : laneItems(key).map((o) => (
                  <Card key={o.pickup_id} o={o}>
                    {key === 'awaiting_label' && isAcct && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <input style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }} placeholder="Reverse AWB (optional)" value={track[o.pickup_id] || ''} onChange={(e) => setTrack((t) => ({ ...t, [o.pickup_id]: e.target.value }))} />
                        <label style={{ ...btnPrimary, display: 'inline-flex', gap: 5, alignItems: 'center', justifyContent: 'center', opacity: busy[o.pickup_id] ? 0.6 : 1 }}>
                          <Upload size={13} />{busy[o.pickup_id] ? 'Sending…' : 'Upload RVP label → send to customer'}
                          <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={busy[o.pickup_id]} onChange={(e) => uploadLabel(o, e.target.files[0])} />
                        </label>
                      </div>
                    )}
                    {o.has_label && <div style={{ marginTop: 8 }}><button onClick={() => download(o)} style={ghostBtn}><Download size={12} />Label{o.tracking_id ? ` · ${o.tracking_id}` : ''}</button></div>}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div onClick={() => !saving && setShowNew(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,.45)', zIndex: 70, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 44 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px,95%)', background: T.white, borderRadius: 10, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.3)', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Arrange a pickup</div>
            <div style={{ fontSize: 12, color: T.iron500, marginBottom: 14 }}>What are you picking up? The accountant then uploads the label, which is WhatsApp'd + emailed to the customer and shown in their portal.</div>
            {/* return type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {RETURN_TYPES.map((d) => {
                const on = (np.return_type || 'faulty_pickup') === d.key;
                return (
                  <button key={d.key} onClick={() => { setP('return_type', d.key); setTicketInfo(null); }}
                    style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${on ? T.orange : T.iron200}`, background: on ? '#fff7ed' : T.white }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: on ? T.orange : T.iron800 }}>{d.label}</div>
                    <div style={{ fontSize: 10.5, color: T.iron500 }}>{d.sub}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {isFaulty ? (
                <div style={{ gridColumn: '1 / 3' }}><L>Ticket number *</L>
                  <input style={inputStyle} placeholder="e.g. MG-R-20260219-00004" value={np.ticket_number || ''} onChange={(e) => lookupTicket(e.target.value)} />
                  {ticketInfo && (
                    <div style={{ fontSize: 11, color: '#166534', background: '#f0fdf4', borderRadius: 6, padding: '5px 8px', marginTop: 4 }}>
                      ✓ {ticketInfo.customer_name}{ticketInfo.customer_phone ? ` · ${ticketInfo.customer_phone}` : ''}{ticketInfo.product_name ? ` · ${ticketInfo.product_name}` : ''}{ticketInfo.serial_number ? ` · SN ${ticketInfo.serial_number}` : ''}
                    </div>)}
                  <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 3 }}>Customer &amp; product come from the ticket; the pickup is recorded on it.</div></div>
              ) : (
                <div style={{ gridColumn: '1 / 3' }}><L>Original order / invoice ref *</L><input style={inputStyle} placeholder="The order the unit is being returned against" value={np.original_ref || ''} onChange={(e) => setP('original_ref', e.target.value)} /></div>
              )}
              <div style={{ gridColumn: '1 / 3' }}><L>Customer name{isFaulty ? ' (from ticket if blank)' : ' *'}</L><input style={inputStyle} value={np.customer_name || ''} onChange={(e) => setP('customer_name', e.target.value)} /></div>
              <div><L>Phone (for WhatsApp)</L><input style={inputStyle} value={np.phone || ''} onChange={(e) => setP('phone', e.target.value)} /></div>
              <div><L>Email</L><input style={inputStyle} value={np.email || ''} onChange={(e) => setP('email', e.target.value)} /></div>
              <div style={{ gridColumn: '1 / 3' }}><L>What to pick up{isFaulty ? ' (from ticket if blank)' : ' *'}</L><input style={inputStyle} placeholder="e.g. MG 8KVA 90V stabilizer (faulty)" value={np.product || ''} onChange={(e) => setP('product', e.target.value)} /></div>
              <div style={{ gridColumn: '1 / 3' }}><L>Reason / notes</L><input style={inputStyle} placeholder={isFaulty ? 'e.g. not powering on, display fault' : 'e.g. buyer refund, DOA'} value={np.reason || ''} onChange={(e) => setP('reason', e.target.value)} /></div>
              <div style={{ gridColumn: '1 / 3' }}><L>Address</L><input style={inputStyle} value={np.address || ''} onChange={(e) => setP('address', e.target.value)} /></div>
              <div><L>City</L><input style={inputStyle} value={np.city || ''} onChange={(e) => setP('city', e.target.value)} /></div>
              <div><L>Pincode</L><input style={inputStyle} value={np.pincode || ''} onChange={(e) => setP('pincode', e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button onClick={() => setShowNew(false)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700 }}>Cancel</button>
              <button onClick={submitNew} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Adding…' : 'Create pickup'}</button>
            </div>
          </div>
        </div>
      )}
    </IronShell>
  );
}

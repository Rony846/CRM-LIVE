import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { T, Caps, mono } from '@/components/iron/IronKit';
import { Loader2, X } from 'lucide-react';

/* Drop-in Customer 360:  <CustomerName name={x} phone={y} />
   Renders the name as a link; clicking opens a big popup with the SAME comprehensive data as the
   /customer-360 page (customer info, stats, tickets, warranties, dispatches, activity). Self-contained. */

const dt = (s) => (s ? String(s).slice(0, 10) : '—');
const terminal = ['closed', 'resolved', 'delivered', 'collected', 'cancelled'];

function Section({ title, items, render, empty = 'None' }) {
  return (
    <div style={{ marginTop: 14 }}>
      <Caps size={9}>{title} · {items.length}</Caps>
      <div style={{ marginTop: 5 }}>
        {items.length === 0 ? <div style={{ fontSize: 12, color: T.iron400 }}>{empty}</div> : items.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid ' + T.iron100, fontSize: 12 }}>{render(it)}</div>
        ))}
      </div>
    </div>
  );
}

export function Customer360Modal({ name, phone, onClose }) {
  const { token } = useAuth();
  const H = { headers: { Authorization: `Bearer ${token}` } };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const doLoad = async (raw) => {
    setLoading(true);
    try {
      let ph = String(raw || '').replace(/\D/g, '').slice(-10);
      if (ph.length < 10) {
        // resolve a phone from a name / serial / ticket via the ticket search (same as the C360 page)
        try {
          const r = await axios.get(`${API}/tickets`, { ...H, params: { search: raw, limit: 1 } });
          const list = Array.isArray(r.data) ? r.data : (r.data?.tickets || r.data?.items || []);
          ph = (list[0]?.customer_phone || '').replace(/\D/g, '').slice(-10);
        } catch (e) { /* ignore */ }
      }
      if (!ph || ph.length < 10) { setData({ empty: true }); return; }
      const { data: d } = await axios.get(`${API}/customer-360`, { ...H, params: { phone: ph } });
      setData(d && d.customer ? d : { empty: true });
    } catch (e) { setData({ error: true }); }
    finally { setLoading(false); }
  };

  useEffect(() => { doLoad(String(phone || '').replace(/\D/g, '').length >= 10 ? phone : name); setQ(name || ''); // eslint-disable-next-line
  }, [name, phone, token]);

  const SearchBox = ({ big }) => (
    <div style={{ display: 'flex', gap: 6, marginTop: big ? 14 : 10 }}>
      <input autoFocus={big} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doLoad(q)}
        placeholder="Phone / name / serial / ticket #" style={{ flex: 1, border: '1px solid ' + T.iron200, borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
      <button onClick={() => doLoad(q)} style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>Search</button>
    </div>
  );

  const c = data?.customer || {};
  const st = data?.stats || {};
  const Stat = ({ label, val }) => (
    <div style={{ flex: 1, textAlign: 'center', padding: '9px 4px', background: T.iron50, borderRadius: 6 }}>
      <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 17 }}>{val ?? 0}</div>
      <div style={{ fontSize: 9.5, color: T.iron500, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
    </div>
  );
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,.5)', zIndex: 90, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 34 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(680px,96%)', background: T.white, borderRadius: 12, padding: 22, boxShadow: '0 24px 70px rgba(0,0,0,.35)', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 19 }}>{c.name || name || 'Customer'}</div>
            <div style={{ ...mono, fontSize: 12, color: T.iron500 }}>{[c.phone || phone, c.email, c.city].filter(Boolean).join(' · ') || '—'}</div>
            {c.dealer_name && <div style={{ fontSize: 11, color: T.iron400 }}>via dealer: {c.dealer_name}</div>}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.iron500 }}><X size={20} /></button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: T.iron400 }}><Loader2 size={20} className="animate-spin" /></div>
        ) : (data?.error || data?.empty) ? (
          <div style={{ padding: '18px 4px' }}>
            <div style={{ fontSize: 13, color: T.iron600 }}>
              {data?.error ? "Couldn't load — try again below." : "We don't have a phone on this record yet. Enter the customer's phone (or search by name / serial / ticket #) to pull up their 360:"}
            </div>
            <SearchBox big />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
              <Stat label="Tickets" val={st.total_tickets} />
              <Stat label="Open" val={st.open_tickets} />
              <Stat label="Products" val={st.products} />
              <Stat label="PIs" val={st.quotations} />
              <Stat label="Orders" val={st.orders} />
            </div>
            <Section title="Quotations / PIs" items={data.quotations || []} render={(q) => (<>
              <div style={{ flex: 1 }}>{(q.items?.[0]?.name || q.firm_name || 'Quotation').slice(0, 46)}<div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{q.quotation_number}</div></div>
              <div style={{ textAlign: 'right' }}>₹{Math.round(q.grand_total || q.total_amount || 0).toLocaleString('en-IN')}<div style={{ fontSize: 10, color: String(q.status || '').toLowerCase() === 'approved' ? '#166534' : T.iron400 }}>{q.status} · {dt(q.created_at)}</div></div>
            </>)} />
            <Section title="Orders" items={data.orders || []} render={(o) => (<>
              <div style={{ flex: 1 }}>{(o.master_sku_name || '—').slice(0, 46)}<div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{o.order_id}</div></div>
              <div style={{ textAlign: 'right', fontSize: 11, color: T.iron500 }}>{o.value ? '₹' + Math.round(o.invoice_value || 0).toLocaleString('en-IN') : ''}<div style={{ fontSize: 10, color: T.iron400 }}>{o.stage || o.status}</div></div>
            </>)} />
            <Section title="Tickets" items={data.tickets || []} render={(t) => (<>
              <div style={{ flex: 1 }}>{(t.product_name || t.device_type || t.issue_description || '—').slice(0, 48)}<div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{t.ticket_number}{t.serial_number ? ` · ${t.serial_number}` : ''}</div></div>
              <div style={{ textAlign: 'right', fontSize: 11, color: terminal.includes(String(t.status || '').toLowerCase()) ? T.iron400 : '#b45309' }}>{t.status}<div style={{ fontSize: 10, color: T.iron400 }}>{dt(t.created_at)}</div></div>
            </>)} />
            <Section title="Products / warranties" items={data.products || []} render={(w) => (<>
              <div style={{ flex: 1 }}>{(w.product_name || w.device_type || '—').slice(0, 48)}<div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{w.serial_number || w.warranty_number}</div></div>
              <div style={{ textAlign: 'right', fontSize: 11, color: T.iron500 }}>{w.status || 'warranty'}<div style={{ fontSize: 10, color: T.iron400 }}>till {dt(w.warranty_end_date)}</div></div>
            </>)} />
            <Section title="Dispatches" items={data.dispatches || []} render={(d) => (<>
              <div style={{ flex: 1 }}>{(d.product_name || '—').slice(0, 48)}<div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{d.dispatch_number}{d.tracking_id ? ` · ${d.tracking_id}` : ''}</div></div>
              <div style={{ textAlign: 'right', fontSize: 11, color: T.iron500 }}>{d.status}<div style={{ fontSize: 10, color: T.iron400 }}>{dt(d.created_at)}</div></div>
            </>)} />
            <Section title="Recent activity" items={(data.activity || []).slice(0, 12)} render={(a) => (<>
              <div style={{ flex: 1 }}>{a.action || '—'}{a.notes ? <span style={{ color: T.iron500 }}> — {String(a.notes).slice(0, 60)}</span> : ''}<div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{a.ticket_number} · {a.by || ''}</div></div>
              <div style={{ textAlign: 'right', fontSize: 10, color: T.iron400 }}>{dt(a.timestamp)}</div>
            </>)} />
          </>
        )}
      </div>
    </div>
  );
}

export function CustomerName({ name, phone, style }) {
  const [open, setOpen] = useState(false);
  if (!name) return <span style={style}>—</span>;
  return (
    <>
      <span onClick={(e) => { e.stopPropagation(); setOpen(true); }} title="Customer 360"
        style={{ color: T.orange, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2, ...style }}>{name}</span>
      {open && <Customer360Modal name={name} phone={phone} onClose={() => setOpen(false)} />}
    </>
  );
}

export default CustomerName;

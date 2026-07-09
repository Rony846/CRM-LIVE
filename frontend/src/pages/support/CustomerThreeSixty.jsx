import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { IRON_ADMIN_NAV, IRON_SUPERVISOR_NAV, IRON_SUPPORT_NAV, T, Caps, IronCard, mono, badgeStyle, ticketPill, fmtDateTime, initials } from '@/components/iron/IronKit';
import { Search, Loader2, User, Phone, Mail, Store, Package, Ticket, Truck, Activity, PlusCircle, ShieldCheck } from 'lucide-react';

const th = { textAlign: 'left', padding: '7px 12px' };
const td = { padding: '9px 12px', fontSize: 12, color: T.iron700, verticalAlign: 'top' };

export default function CustomerThreeSixty() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');

  const nav = user?.role === 'supervisor' ? IRON_SUPERVISOR_NAV : user?.role === 'call_support' ? IRON_SUPPORT_NAV : IRON_ADMIN_NAV;
  const roleLabel = user?.role === 'supervisor' ? 'Supervisor' : user?.role === 'call_support' ? 'Call Support' : 'Admin Console';
  const H = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(async (raw) => {
    const digits = (raw || '').replace(/\D/g, '');
    setLoading(true); setErr(''); setData(null); setTab('overview');
    try {
      let phone = digits.length >= 10 ? digits.slice(-10) : '';
      if (!phone) {
        // resolve a phone from a name/ticket/serial via the strong ticket search
        const r = await axios.get(`${API}/tickets`, { ...H, params: { search: raw, limit: 1 } });
        const list = r.data?.tickets || r.data || [];
        phone = (list[0]?.customer_phone || '').replace(/\D/g, '').slice(-10);
      }
      if (!phone) { setErr('No customer found — try a 10-digit phone number.'); return; }
      const { data: d } = await axios.get(`${API}/customer-360`, { ...H, params: { phone } });
      if (!d.customer && !(d.tickets || []).length) { setErr('No records found for this customer.'); return; }
      setData(d);
    } catch (e) {
      setErr(e.response?.data?.detail || 'Lookup failed.');
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Deep-link: /customer-360?phone=... (e.g. from the call screen-pop)
  useEffect(() => {
    const p = new URLSearchParams(location.search).get('phone');
    if (p) { setQ(p); load(p); }
  }, [location.search, load]);

  const c = data?.customer || {};
  const s = data?.stats || {};
  const wtone = (w) => (String(w.status || '').toLowerCase() === 'active' || (w.warranty_end_date && String(w.warranty_end_date).slice(0, 10) >= new Date().toISOString().slice(0, 10))) ? 'ok' : 'slate';

  const SearchBar = () => (
    <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) load(q); }} style={{ display: 'flex', gap: 8, maxWidth: 560 }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <Search size={15} color={T.iron400} style={{ position: 'absolute', left: 10, top: 11 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Phone number, customer name, serial or ticket #"
          style={{ width: '100%', height: 38, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '0 12px 0 32px', fontFamily: T.body, fontSize: 13, outline: 'none', background: T.white }} />
      </div>
      <button type="submit" style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '0 18px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 13 }}>Look up</button>
    </form>
  );

  const Section = ({ icon: Icon, title, count, children }) => (
    <IronCard pad={0} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.iron200}` }}>
        <Icon size={15} color={T.orange} /><Caps size={11} color={T.iron900} ls=".1em">{title}</Caps>
        {count != null && <span style={{ ...mono, fontSize: 11, color: T.iron400 }}>· {count}</span>}
      </div>
      {children}
    </IronCard>
  );

  const ProductsCard = () => (
    <Section icon={Package} title="Registered Products" count={(data.products || []).length}>
      {(data.products || []).length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: T.iron400, fontSize: 12.5 }}>No registered products.</div> : (
        <div>
          {data.products.map((w, i) => {
            const active = wtone(w) === 'ok';
            return (
              <div key={w.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < data.products.length - 1 ? `1px solid ${T.iron200}` : 'none' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: T.iron900, flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{w.product_name || w.device_type || 'Product'}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.iron400, marginTop: 2 }}>{w.serial_number || w.warranty_number || w.order_id || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={badgeStyle(active ? 'ok' : 'slate')}>{active ? 'In Warranty' : 'Expired'}</span>
                  {w.warranty_end_date && <div style={{ ...mono, fontSize: 9.5, color: T.iron400, marginTop: 4 }}>till {String(w.warranty_end_date).slice(0, 10)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );

  const TicketsCard = ({ limit }) => {
    const list = limit ? (data.tickets || []).slice(0, limit) : (data.tickets || []);
    return (
      <Section icon={Ticket} title="Ticket History" count={(data.tickets || []).length}>
        {list.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: T.iron400, fontSize: 12.5 }}>No tickets.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              {['TICKET', 'ISSUE', 'STATUS', 'CREATED'].map((h) => <th key={h} style={th}><Caps size={8.5}>{h}</Caps></th>)}
            </tr></thead>
            <tbody>{list.map((t) => {
              const pill = ticketPill(t.status);
              return (
                <tr key={t.id} className="iron-row" onClick={() => navigate(user?.role === 'admin' ? `/admin/tickets/${t.id}` : user?.role === 'supervisor' ? `/supervisor?ticket=${t.id}` : `/support?ticket=${t.id}`)} style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }}>
                  <td style={{ ...td, ...mono, fontWeight: 700, color: T.orangeDeep, whiteSpace: 'nowrap' }}>{t.ticket_number}</td>
                  <td style={{ ...td, maxWidth: 320 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.issue_description || t.device_type || '—'}</div></td>
                  <td style={td}><span style={pill.style}>{pill.label}</span></td>
                  <td style={{ ...td, ...mono, fontSize: 10.5, color: T.iron400, whiteSpace: 'nowrap' }}>{fmtDateTime(t.created_at)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </Section>
    );
  };

  const DispatchesCard = () => (
    <Section icon={Truck} title="Replacement Dispatches" count={(data.dispatches || []).length}>
      {(data.dispatches || []).length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: T.iron400, fontSize: 12.5 }}>No dispatches.</div> : (
        <div>{data.dispatches.map((d, i) => (
          <div key={d.id || i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 16px', borderBottom: i < data.dispatches.length - 1 ? `1px solid ${T.iron200}` : 'none' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.iron900 }}>{d.tracking_id || d.dispatch_number}</div>
              <div style={{ fontSize: 11, color: T.iron500, marginTop: 2 }}>{d.product_name || d.sku || '—'}{d.courier ? ` · ${d.courier}` : ''}</div>
            </div>
            <span style={badgeStyle(String(d.status).toLowerCase().includes('deliver') ? 'ok' : 'info')}>{d.status || '—'}</span>
          </div>
        ))}</div>
      )}
    </Section>
  );

  const QuotationsCard = () => (
    <Section icon={Package} title="Quotations / PIs" count={(data.quotations || []).length}>
      {(data.quotations || []).length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: T.iron400, fontSize: 12.5 }}>No quotations / PIs.</div> : (
        <div>{data.quotations.map((qn, i) => (
          <div key={qn.id || i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 16px', borderBottom: i < data.quotations.length - 1 ? `1px solid ${T.iron200}` : 'none' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.iron900 }}>{qn.quotation_number}</div>
              <div style={{ fontSize: 11, color: T.iron500, marginTop: 2 }}>{(qn.items?.[0]?.name || qn.firm_name || 'Quotation').slice(0, 44)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: T.iron900 }}>₹{Math.round(qn.grand_total || qn.total_amount || 0).toLocaleString('en-IN')}</div>
              <span style={badgeStyle(String(qn.status).toLowerCase() === 'approved' ? 'ok' : 'info')}>{qn.status || '—'}</span>
            </div>
          </div>
        ))}</div>
      )}
    </Section>
  );

  const ActivityCard = () => (
    <Section icon={Activity} title="Activity">
      {(data.activity || []).length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: T.iron400, fontSize: 12.5 }}>No recent activity.</div> : (
        <div style={{ padding: '12px 16px' }}>{data.activity.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: i < data.activity.length - 1 ? 12 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: T.orange, marginTop: 5, flex: 'none' }} />
              {i < data.activity.length - 1 && <div style={{ width: 2, flex: 1, background: T.iron200, margin: '3px 0' }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: 4 }}>
              <div style={{ ...mono, fontSize: 9.5, color: T.iron400 }}>{fmtDateTime(a.timestamp)} · {a.by || 'System'} · {a.ticket_number}</div>
              <div style={{ fontSize: 12, color: T.iron700, marginTop: 1 }}>{a.action}{a.notes ? ` — ${a.notes}` : ''}</div>
            </div>
          </div>
        ))}</div>
      )}
    </Section>
  );

  return (
    <IronShell title="Customer 360" subtitle={c.phone ? `· ${c.phone}` : ''} nav={nav} roleLabel={roleLabel} showSearch={false}>
      <div style={{ marginBottom: 18 }}><SearchBar /></div>

      {loading ? <div style={{ display: 'grid', placeItems: 'center', height: 240 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        : err ? <IronCard style={{ textAlign: 'center', padding: 40, color: T.iron500 }}>{err}</IronCard>
        : !data ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <User size={44} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron700 }}>Look up a customer</div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>Search by phone, name, serial, or ticket number to see their full history.</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 52, height: 52, borderRadius: 999, background: T.iron900, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 800, fontSize: 17 }}>{initials(c.name) || '?'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900 }}>{c.name || 'Unknown customer'}</div>
                <div style={{ ...mono, fontSize: 11, color: T.iron400, marginTop: 2 }}>{[c.phone, c.city].filter(Boolean).join(' · ')}</div>
              </div>
              {s.in_warranty > 0 && <span style={{ ...badgeStyle('ok'), padding: '5px 12px', fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}><ShieldCheck size={13} /> {s.in_warranty} IN WARRANTY</span>}
              <button onClick={() => navigate(`/support/create?phone=${c.phone || ''}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 8, padding: '9px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 13 }}><PlusCircle size={15} /> New Ticket</button>
            </div>

            {/* Contact strip */}
            <IronCard style={{ display: 'flex', gap: 34, flexWrap: 'wrap', marginBottom: 16 }}>
              {[[Phone, 'Phone', c.phone], [Mail, 'Email', c.email], [Store, 'Via Dealer', c.dealer_name]].map(([Ic, l, v]) => (
                <div key={l}><Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 3 }}>{l}</Caps>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: v ? T.iron900 : T.iron400, ...(l !== 'Email' ? mono : {}) }}><Ic size={13} color={T.iron400} />{v || '—'}</div></div>
              ))}
              <div><Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 3 }}>Tickets</Caps>
                <div style={{ ...mono, fontSize: 13, color: T.iron900 }}>{s.total_tickets} total · {s.open_tickets} open</div></div>
            </IronCard>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${T.iron200}`, marginBottom: 16 }}>
              {[['overview', 'Overview'], ['tickets', `Tickets (${s.total_tickets})`], ['pis', `PIs (${(data.quotations || []).length})`], ['dispatches', `Dispatches (${(data.dispatches || []).length})`]].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '8px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5,
                  color: tab === id ? T.iron900 : T.iron400, borderBottom: `2px solid ${tab === id ? T.orange : 'transparent'}`, marginBottom: -1 }}>{label}</button>
              ))}
            </div>

            {tab === 'overview' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><ProductsCard /><TicketsCard limit={6} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><QuotationsCard /><DispatchesCard /><ActivityCard /></div>
              </div>
            ) : tab === 'tickets' ? <TicketsCard /> : tab === 'pis' ? <QuotationsCard /> : <DispatchesCard />}
          </>
        )}
    </IronShell>
  );
}

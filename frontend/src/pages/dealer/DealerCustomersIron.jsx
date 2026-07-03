import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Users, Search, Loader2, Phone, Mail, MapPin, ShieldCheck,
  AlertTriangle, Ticket as TicketIcon, Tag, Clock,
  Package, ChevronRight, UserPlus, X, Save,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const FILTERS = [
  { id: 'all',              label: 'All' },
  { id: 'in_warranty',      label: 'In Warranty' },
  { id: 'has_open_tickets', label: 'Open Tickets' },
  { id: 'recent',           label: 'Recent 30d' },
];

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

const day = (d) => (d ? String(d).slice(0, 10) : '');

export default function DealerCustomers() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({ total: 0, in_warranty: 0, has_open_tickets: 0, recent: 0 });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);   // customer object opened in drawer
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (search.trim()) params.q = search.trim();
      if (filter !== 'all') params.filter = filter;
      const resp = await axios.get(`${API}/dealer/customers`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setCustomers(resp.data.customers || []);
      setStats(resp.data.stats || {});
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customer book');
    } finally {
      setLoading(false);
    }
  }, [token, search, filter]);

  useEffect(() => {
    if (token) fetchList();
  }, [token, fetchList]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(fetchList, 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  const openDetail = async (c) => {
    setSelected(c);
    setDetail(null);
    setDetailLoading(true);
    try {
      const resp = await axios.get(`${API}/dealer/customers/${c.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDetail(resp.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customer details');
    } finally {
      setDetailLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Customers', value: stats.total,            icon: Users,          tone: T.orange },
    { label: 'In Warranty',     value: stats.in_warranty,      icon: ShieldCheck,    tone: T.green },
    { label: 'Open Tickets',    value: stats.has_open_tickets, icon: AlertTriangle,  tone: T.voltageText },
    { label: 'Recent (30d)',    value: stats.recent,           icon: Clock,          tone: T.blue },
  ];

  const headers = ['CUSTOMER', 'CONTACT', 'LOCATION', 'STATUS / TAGS', 'PRODUCTS', 'LAST CONTACT', ''];

  const addBtn = (
    <button onClick={() => setAddOpen(true)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
      <UserPlus size={14} /> Add Customer
    </button>
  );

  return (
    <IronShell title="My Customers" subtitle="DEALER CUSTOMER BOOK" onRefresh={fetchList} headerRight={addBtn}>

      {loading && customers.length === 0 ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* KPI tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{(s.value || 0).toLocaleString('en-IN')}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Filter + search + list */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, or email…"
                    style={{ ...inputStyle, paddingLeft: 30, width: 280 }} />
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {FILTERS.map((f) => {
                    const active = filter === f.id;
                    return (
                      <button key={f.id} onClick={() => setFilter(f.id)}
                        style={{ border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '6px 11px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}>
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Caps size={9} color={T.iron400}>
                {customers.length === 0 ? 'No customers yet' : `${customers.length} ${customers.length === 1 ? 'customer' : 'customers'}`}
              </Caps>
            </div>

            {customers.length === 0 ? (
              <EmptyState onAdd={() => setAddOpen(true)} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {headers.map((h, i) => <th key={i} style={{ ...thCell, textAlign: i === headers.length - 1 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>)}
                  </tr></thead>
                  <tbody>{customers.map((c) => (
                    <tr key={c.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }} onClick={() => openDetail(c)}>
                      <td style={tdCell}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 999, background: '#FDEEE6', color: T.orangeDeep, display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                            {(c.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{c.name || 'Unnamed'}</div>
                        </div>
                      </td>
                      <td style={tdCell}>
                        <div style={{ ...mono, fontSize: 11, color: T.iron700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={10} color={T.iron400} />{c.phone || '-'}</div>
                        {c.email && <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 2, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>}
                      </td>
                      <td style={tdCell}>
                        {c.city ? <span style={{ fontSize: 12, color: T.iron700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={11} color={T.iron400} />{c.city}</span> : <span style={{ color: T.iron400 }}>-</span>}
                      </td>
                      <td style={tdCell}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {c.in_warranty_count > 0 && <span style={badgeStyle('ok')}>{c.in_warranty_count} in warranty</span>}
                          {c.open_tickets > 0 && <span style={badgeStyle('warn')}>{c.open_tickets} open</span>}
                          {(c.tags || []).map((t) => <span key={t} style={badgeStyle('violet')}>{t}</span>)}
                          {!(c.in_warranty_count > 0) && !(c.open_tickets > 0) && !(c.tags || []).length && <span style={{ color: T.iron400 }}>-</span>}
                        </div>
                      </td>
                      <td style={{ ...tdCell, ...mono, fontSize: 12, color: T.iron700 }}>
                        <Package size={11} color={T.iron400} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />{c.total_products || 0}
                      </td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{c.last_contact_at ? day(c.last_contact_at) : '-'}</td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        <button onClick={(e) => { e.stopPropagation(); openDetail(c); }} title="View"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}>
                          <ChevronRight size={13} /> View
                        </button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </IronCard>
        </>
      )}

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0" style={{ background: T.white, borderLeft: `1px solid ${T.iron200}` }}>
          {selected && (
            <CustomerDetail
              customer={selected}
              detail={detail}
              loading={detailLoading}
              token={token}
              onClose={() => setSelected(null)}
              onUpdated={async () => { await fetchList(); if (selected) await openDetail(selected); }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Add customer modal */}
      <AddCustomerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        token={token}
        onCreated={() => { setAddOpen(false); fetchList(); }}
      />
    </IronShell>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: T.iron400 }}>
      <Users size={44} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
      <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>Your customer book is empty</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>Customers are added automatically when you register a warranty or raise a service ticket.</div>
      <div style={{ fontSize: 12, marginBottom: 16 }}>You can also add prospects manually.</div>
      <button onClick={onAdd}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
        <UserPlus size={14} /> Add First Customer
      </button>
    </div>
  );
}

function CustomerDetail({ customer, detail, loading, token, onClose, onUpdated }) {
  const [newNote, setNewNote] = useState('');
  const [posting, setPosting] = useState(false);

  const c = detail?.customer || customer;
  const products = detail?.products || [];
  const tickets = detail?.tickets || [];

  const addNote = async () => {
    if (!newNote.trim()) return;
    setPosting(true);
    try {
      await axios.post(`${API}/dealer/customers/${customer.id}/note`, { text: newNote.trim() }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNewNote('');
      toast.success('Note added');
      onUpdated();
    } catch (err) {
      toast.error('Failed to add note');
    } finally {
      setPosting(false);
    }
  };

  const ctaStyle = { display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 12px', textDecoration: 'none', fontFamily: T.headline, fontWeight: 700, fontSize: 12 };

  return (
    <div style={{ fontFamily: T.body, color: T.iron900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, background: '#FDEEE6', color: T.orangeDeep, display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 700, fontSize: 16 }}>
            {(c.name || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 16 }}>{c.name || 'Unnamed'}</div>
            <div style={{ ...mono, fontSize: 11, color: T.iron500 }}>{c.phone}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, height: 30, width: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.iron500 }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Identity */}
        <Section title="Identity & Contact">
          <DetailRow icon={Phone} label="Phone" value={c.phone} mono />
          <DetailRow icon={Mail}  label="Email" value={c.email || '—'} />
          <DetailRow icon={MapPin} label="Address" value={[c.address, c.city, c.state, c.pincode].filter(Boolean).join(', ') || '—'} />
          <DetailRow icon={Tag}   label="Tags" value={(c.tags || []).length ? c.tags.join(', ') : '—'} />
          <DetailRow icon={Clock} label="First seen" value={day(c.first_seen_at) || '—'} mono />
          <DetailRow icon={Clock} label="Last contact" value={day(c.last_contact_at) || '—'} mono />
        </Section>

        {/* Products */}
        <Section title={`Products Owned (${products.length})`}>
          {loading ? <Loader2 className="animate-spin" size={20} color={T.orange} style={{ margin: '16px auto', display: 'block' }} /> :
            products.length === 0 ? (
              <div style={{ fontSize: 12.5, color: T.iron400, padding: '12px 0', textAlign: 'center' }}>
                No warranty registrations yet. Use the Warranty Registration page to add one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {products.map((p) => (
                  <div key={p.id} style={{ border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 12, background: T.iron50 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900 }}>{p.product_name}</div>
                        <div style={{ ...mono, fontSize: 11, color: T.iron500, marginTop: 2 }}>S/N {p.serial_number}</div>
                      </div>
                      <span style={badgeStyle(p.warranty_status === 'active' ? 'ok' : 'slate')}>
                        {p.warranty_status === 'active' ? 'In Warranty' : 'Expired'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, fontSize: 11.5, color: T.iron500 }}>
                      <div>Purchased <span style={{ ...mono, color: T.iron900 }}>{day(p.purchase_date)}</span></div>
                      <div>Expires <span style={{ ...mono, color: T.iron900 }}>{day(p.warranty_expires)}</span></div>
                    </div>
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.iron200}` }}>
                      <a href={`/dealer/warranty-claims?warranty_id=${p.id}`}
                        style={{ fontSize: 11.5, color: T.orangeDeep, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <TicketIcon size={13} /> File a warranty claim for this product →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </Section>

        {/* Tickets */}
        <Section title={`Service Tickets (${tickets.length})`}>
          {loading ? <Loader2 className="animate-spin" size={20} color={T.orange} style={{ margin: '16px auto', display: 'block' }} /> :
            tickets.length === 0 ? (
              <div style={{ fontSize: 12.5, color: T.iron400, padding: '12px 0', textAlign: 'center' }}>No tickets raised yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tickets.map((t) => (
                  <div key={t.id} style={{ border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 12, background: T.iron50 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontSize: 12.5, color: T.iron900 }}>{t.issue_description}</div>
                      <span style={badgeStyle(t.status === 'open' ? 'warn' : 'slate')}>{t.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.iron500, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={mono}>{t.ticket_number}</span>
                      <span>·</span>
                      <span>{day(t.created_at)}</span>
                      {t.product_name && (<><span>·</span><span>{t.product_name}</span></>)}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </Section>

        {/* Notes */}
        <Section title={`Notes (${(c.notes || []).length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {(c.notes || []).length === 0 ? (
              <div style={{ fontSize: 12.5, color: T.iron400, padding: '12px 0', textAlign: 'center' }}>No notes yet.</div>
            ) : (
              c.notes.slice().reverse().map((n) => (
                <div key={n.id} style={{ borderLeft: `2px solid ${T.orange}`, paddingLeft: 12, paddingTop: 4, paddingBottom: 4, background: T.iron50, borderRadius: '0 6px 6px 0' }}>
                  <div style={{ fontSize: 12.5, color: T.iron900 }}>{n.text}</div>
                  <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 3 }}>
                    {n.created_by_name} · {n.created_at?.slice(0, 19).replace('T', ' ')}
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note (e.g. customer prefers evening visits)…"
              style={{ flex: 1, minHeight: 60, fontSize: 12.5, ...inputStyle }}
            />
            <button onClick={addNote} disabled={posting || !newNote.trim()}
              style={{ alignSelf: 'flex-end', border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '9px 12px', cursor: posting || !newNote.trim() ? 'default' : 'pointer', opacity: posting || !newNote.trim() ? 0.5 : 1, display: 'grid', placeItems: 'center' }}>
              {posting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            </button>
          </div>
        </Section>

        {/* Quick CTAs */}
        <div style={{ borderTop: `1px solid ${T.iron200}`, paddingTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href={`/dealer/warranty?phone=${c.phone}&name=${encodeURIComponent(c.name || '')}`} style={ctaStyle}>
            <ShieldCheck size={15} /> Register Warranty
          </a>
          <a href={`/dealer/tickets?action=new&phone=${c.phone}&name=${encodeURIComponent(c.name || '')}`} style={ctaStyle}>
            <TicketIcon size={15} /> Raise Ticket
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>{title}</Caps>
      {children}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, mono: isMono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', fontSize: 12.5 }}>
      <Icon size={14} color={T.iron400} style={{ flexShrink: 0 }} />
      <span style={{ color: T.iron500, width: 96, fontSize: 11 }}>{label}</span>
      <span style={{ color: T.iron900, ...(isMono ? mono : {}) }}>{value}</span>
    </div>
  );
}

function AddCustomerDialog({ open, onClose, token, onCreated }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', note: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', note: '' });
  }, [open]);

  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Name and phone are required');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/dealer/customers`, form, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Customer added');
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" style={{ background: T.white, border: `1px solid ${T.iron200}` }}>
        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 16, color: T.iron900, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <UserPlus size={16} color={T.orange} /> Add Customer
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Name *"  value={form.name}   onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Field label="Phone *" value={form.phone}  onChange={(v) => setForm((f) => ({ ...f, phone: v }))} mono />
          <Field label="Email"   value={form.email}  onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
          <Field label="Address" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <Field label="City"    value={form.city}    onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
            <Field label="State"   value={form.state}   onChange={(v) => setForm((f) => ({ ...f, state: v }))} />
            <Field label="Pincode" value={form.pincode} onChange={(v) => setForm((f) => ({ ...f, pincode: v }))} mono />
          </div>
          <div>
            <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 5 }}>Initial Note</Caps>
            <Textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Walked into shop on 24-May, interested in 1100VA inverter…"
              style={{ minHeight: 60, fontSize: 12.5, width: '100%', ...inputStyle }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12 }}>
          <button onClick={onClose}
            style={{ border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
            {saving ? <Loader2 className="animate-spin" size={14} /> : <><Save size={14} /> Save</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, mono: isMono }) {
  return (
    <div>
      <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 5 }}>{label}</Caps>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, width: '100%', ...(isMono ? mono : {}) }}
      />
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  ArrowLeft, FilePlus2, Phone, Mail, MapPin, Loader2, Download,
  Award, FileText, BadgeCheck,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const TIER_THRESHOLDS = { silver: 0, gold: 500000, platinum: 1500000 };
const TIER_TONE = { platinum: 'info', gold: 'warn', silver: 'slate' };
const STATUS_TONE = {
  approved: 'ok', active: 'info', pending: 'warn', delivered: 'ok',
  dispatched: 'info', confirmed: 'violet', cancelled: 'bad',
};

const inr = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n) || 0);
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—'
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const computeTier = (total) =>
  total >= TIER_THRESHOLDS.platinum ? 'platinum' : total >= TIER_THRESHOLDS.gold ? 'gold' : 'silver';
// Some legacy dealers stored contact_person/address as an object, array, or a
// JSON *string* — render them as readable text instead of raw JSON.
const tryParse = (v) => {
  if (typeof v === 'string') {
    const t = v.trim();
    if (t.startsWith('{') || t.startsWith('[')) { try { return JSON.parse(t); } catch { /* keep */ } }
  }
  return v;
};
const safeText = (v) => {
  v = tryParse(v);
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((x) => (x && (x.name || x.contact_person)) || '').filter(Boolean).join(', ') || '—';
  if (v && typeof v === 'object') return v.name || v.contact_person || '—';
  return '—';
};
const formatAddress = (d) => {
  const a = tryParse(d.address);
  if (a && typeof a === 'object' && !Array.isArray(a)) {
    const parts = [a.line1, a.address_line1, a.line2, a.address_line2, a.city, a.district, a.state, a.pincode]
      .filter((x) => x && typeof x === 'string');
    return parts.length ? [...new Set(parts)].join(', ') : '—';
  }
  const parts = [typeof a === 'string' ? a : null, d.city, d.state, d.pincode].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
};

const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '7px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

function Pill({ tone, children }) {
  return <span style={badgeStyle(tone || 'slate')}>{children}</span>;
}

export default function DealerProfile() {
  const { dealerId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ledger');
  const [tally, setTally] = useState(null);  // authoritative Tally balances (read-only)

  const fetchDealer = () => {
    setLoading(true);
    axios.get(`${API}/admin/dealers/${dealerId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setData(r.data))
      .catch(() => toast.error('Failed to load dealer'))
      .finally(() => setLoading(false));
    axios.get(`${API}/admin/dealers/${dealerId}/tally`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setTally(r.data?.tally_balances || []))
      .catch(() => setTally([]));
  };

  useEffect(() => {
    fetchDealer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerId, token]);

  const dealer = data?.dealer || {};
  const party = data?.party || null;
  const ledger = useMemo(() => (Array.isArray(data?.ledger) ? data.ledger : []), [data]);
  const orders = useMemo(() => (Array.isArray(data?.orders) ? data.orders : []), [data]);

  const lifetimeValue = useMemo(
    () => orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount || 0), 0),
    [orders]
  );
  const tier = dealer.tier || computeTier(lifetimeValue);
  const creditLimit = Number(dealer.credit_limit) || 0;
  const outstanding = party?.current_balance ?? (ledger[0]?.running_balance ?? 0);
  const unlimited = creditLimit <= 0;
  const available = unlimited ? null : creditLimit - outstanding;
  const utilization = unlimited || creditLimit === 0 ? 0 : Math.round((outstanding / creditLimit) * 100);
  const overdue = useMemo(() => {
    const now = Date.now();
    return orders
      .filter((o) => o.status !== 'cancelled'
        && !['received', 'verified'].includes(o.payment_status)
        && o.dispatch_due_date && new Date(o.dispatch_due_date).getTime() < now)
      .reduce((s, o) => s + (o.total_amount || 0), 0);
  }, [orders]);

  const createPI = () => {
    if (!party?.id) {
      toast.error('This dealer has no linked party/account yet — cannot pre-fill a PI.');
      return;
    }
    navigate('/quotations/new', {
      state: {
        prefillPartyId: party.id,
        // Dealer's contracted discount (if set) drives dealer-discounted PI line pricing;
        // null falls back to each product's dealer_discount_percent in the form.
        dealerDiscount: (dealer.discount_percent ?? null),
        prefillParty: {
          id: party.id, name: dealer.firm_name, phone: dealer.phone, email: dealer.email,
          gstin: dealer.gst_number, city: dealer.city, state: dealer.state, pincode: dealer.pincode,
        },
      },
    });
  };

  const exportLedgerCsv = () => {
    const rows = [['Date', 'Entry', 'Type', 'Description', 'Debit', 'Credit', 'Balance']];
    ledger.forEach((e) => rows.push([
      e.created_at || '', e.entry_number || '', e.entry_type || '',
      (e.narration || '').replace(/[\n,]/g, ' '),
      e.debit || 0, e.credit || 0, e.running_balance ?? '',
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c)}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${dealer.firm_name || 'dealer'}_ledger.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const headerRight = (
    <button onClick={createPI} data-testid="create-pi" style={btnPrimary}>
      <FilePlus2 size={14} /> Create Proforma Invoice (PI)
    </button>
  );

  if (loading) {
    return (
      <IronShell title="Dealer Profile" subtitle="DEALER · PROFILE" onRefresh={fetchDealer}>
        <div style={{ display: 'grid', placeItems: 'center', height: 260 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      </IronShell>
    );
  }

  const initials = (dealer.firm_name || '?').replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'DL';

  const labelStyle = { display: 'block', marginBottom: 3 };
  const rowDocs = orders.filter((o) => o.proforma_number || o.final_invoice_number);

  return (
    <IronShell title="Dealer Profile" subtitle={dealer.firm_name ? `· ${dealer.firm_name}` : 'DEALER · PROFILE'} onRefresh={fetchDealer} headerRight={headerRight}>
      <div data-testid="dealer-profile-page">
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => navigate('/admin/dealers')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.iron500, fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0 }}>
            <ArrowLeft size={15} /> Dealer Management
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: 16, alignItems: 'start' }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Entity Profile */}
            <IronCard>
              <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 12 }}>Entity Profile</Caps>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: '#FDEEE6', color: T.orangeDeep, display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 800, fontSize: 14, flex: 'none' }}>{initials}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {dealer.firm_name || '—'}
                    {dealer.status === 'approved' && <BadgeCheck size={15} color={T.green} />}
                  </div>
                  <div style={{ ...mono, fontSize: 11, color: T.iron400 }}>{dealer.dealer_code || dealer.id?.slice(0, 8)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pill tone={TIER_TONE[tier]}><Award size={11} style={{ marginRight: 4, verticalAlign: '-2px' }} />{tier} Tier</Pill>
                <Pill tone={STATUS_TONE[dealer.status]}>{dealer.status}</Pill>
              </div>
              <div style={{ marginTop: 12, borderTop: `1px solid ${T.iron200}`, paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: T.iron500 }}>GST</span>
                <span style={{ ...mono, fontSize: 12.5, color: T.iron900, fontWeight: 600 }}>{dealer.gst_number || '—'}</span>
              </div>
            </IronCard>

            {/* Credit Standing */}
            <IronCard>
              <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>Credit Standing</Caps>
              <div style={{ fontSize: 11.5, color: T.iron500 }}>Available Credit Limit</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div style={{ ...mono, fontSize: 28, fontWeight: 800, color: T.iron900 }}>{unlimited ? 'Unlimited' : inr(available)}</div>
                {!unlimited && <span style={{ fontSize: 11, color: T.iron400, marginBottom: 4 }}>{utilization}% Utilized</span>}
              </div>
              {!unlimited && (
                <div style={{ marginTop: 8, height: 6, width: '100%', borderRadius: 999, background: T.iron100, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, utilization))}%`, background: utilization >= 90 ? T.rose : utilization >= 70 ? T.voltage : T.green }} />
                </div>
              )}
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: `1px solid ${T.iron200}`, paddingTop: 12 }}>
                <div>
                  <Caps size={8.5} color={T.iron400}>Outstanding</Caps>
                  <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: T.iron900, marginTop: 2 }}>{inr(outstanding)}</div>
                </div>
                <div>
                  <Caps size={8.5} color={T.iron400}>Overdue</Caps>
                  <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: overdue > 0 ? T.rose : T.green, marginTop: 2 }}>{inr(overdue)}</div>
                </div>
              </div>
              {!unlimited && <div style={{ marginTop: 8, fontSize: 11, color: T.iron400 }}>Credit limit {inr(creditLimit)}</div>}
            </IronCard>

            {/* Tally — authoritative books (read-only) */}
            {tally && tally.length > 0 && (
              <IronCard style={{ borderLeft: `3px solid ${T.blue}` }}>
                <Caps size={9} color={T.blue} style={{ display: 'block', marginBottom: 8 }}>Tally — authoritative books</Caps>
                {tally.map((t, i) => (
                  <div key={i} style={{ marginBottom: i < tally.length - 1 ? 10 : 0, paddingBottom: i < tally.length - 1 ? 10 : 0, borderBottom: i < tally.length - 1 ? `1px solid ${T.iron200}` : 'none' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.iron700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.company}</div>
                    <div style={{ ...mono, fontSize: 20, fontWeight: 800, marginTop: 3, color: t.payable > 0 ? T.rose : T.green }}>
                      ₹{inr(Math.abs(t.closing_balance || t.payable || t.receivable || 0))}
                    </div>
                    <Caps size={8.5} color={T.iron400}>{t.payable > 0 ? 'Payable (we owe)' : t.receivable > 0 ? 'Receivable' : (t.group || '')}</Caps>
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: 10, color: T.iron400 }}>read-only · synced from Tally</div>
              </IronCard>
            )}

            {/* Logistics & Contact */}
            <IronCard>
              <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>Logistics &amp; Contact</Caps>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12.5 }}>
                <div style={{ fontWeight: 600, color: T.iron900 }}>{safeText(dealer.contact_person)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.iron500 }}><Phone size={13} /> {dealer.phone || '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.iron500 }}><Mail size={13} /> {dealer.email || '—'}</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: T.iron500 }}>
                  <MapPin size={13} style={{ marginTop: 2, flex: 'none' }} />
                  <span>{formatAddress(dealer)}</span>
                </div>
              </div>
            </IronCard>
          </div>

          {/* Right panel */}
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900 }}>Ledger &amp; Operations</div>
            <div style={{ fontSize: 12.5, color: T.iron500, marginBottom: 16 }}>Comprehensive operational view for {dealer.firm_name}.</div>

            <IronCard pad={14}>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${T.iron200}`, marginBottom: 14 }}>
                {[['ledger', 'Ledger & Payments'], ['orders', 'Order History'], ['docs', 'Documents & Contracts']].map(([id, lbl]) => (
                  <button key={id} onClick={() => setTab(id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '8px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5,
                    color: tab === id ? T.iron900 : T.iron400, borderBottom: `2px solid ${tab === id ? T.orange : 'transparent'}`, marginBottom: -1 }}>{lbl}</button>
                ))}
              </div>

              {tab === 'ledger' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Caps size={9} color={T.iron400}>Transaction Ledger</Caps>
                    <button onClick={exportLedgerCsv} disabled={!ledger.length} style={{ ...btnOutline, opacity: ledger.length ? 1 : 0.5, cursor: ledger.length ? 'pointer' : 'not-allowed' }}>
                      <Download size={13} /> Export CSV
                    </button>
                  </div>
                  {ledger.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 12.5, color: T.iron400 }}>No ledger entries.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                          {['Date', 'Ref / Type', 'Description', 'Debit (DR)', 'Credit (CR)', 'Balance'].map((h, i) => (
                            <th key={i} style={{ ...thCell, textAlign: i >= 3 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {ledger.map((e, i) => (
                            <tr key={e.id || i} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                              <td style={{ ...tdCell, whiteSpace: 'nowrap' }}>{fmtDate(e.created_at)}</td>
                              <td style={tdCell}>
                                <span style={badgeStyle(e.credit ? 'ok' : 'bad')}>{e.entry_number || (e.entry_type || '').replace(/_/g, ' ') || '—'}</span>
                                <div style={{ fontSize: 10, color: T.iron400, marginTop: 3 }}>{(e.entry_type || '').replace(/_/g, ' ')}</div>
                              </td>
                              <td style={{ ...tdCell, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.narration || '—'}</td>
                              <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.rose }}>{e.debit ? inr(e.debit) : '—'}</td>
                              <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.green }}>{e.credit ? inr(e.credit) : '—'}</td>
                              <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900 }}>{e.running_balance != null ? inr(e.running_balance) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {ledger.length > 0 && (
                    <div style={{ marginTop: 12, fontSize: 11, color: T.iron400 }}>Showing {ledger.length} most recent entries</div>
                  )}
                </div>
              )}

              {tab === 'orders' && (
                <div>
                  {orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 12.5, color: T.iron400 }}>No orders yet.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                          {['Order #', 'Date', 'Items', 'Total', 'Status', 'Payment'].map((h, i) => (
                            <th key={i} style={{ ...thCell, textAlign: i === 3 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {orders.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).map((o, i) => (
                            <tr key={o.id || i} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                              <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{o.order_number || '—'}</td>
                              <td style={{ ...tdCell, whiteSpace: 'nowrap' }}>{fmtDate(o.created_at)}</td>
                              <td style={tdCell}>{(o.items || []).length}</td>
                              <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>{inr(o.total_amount)}</td>
                              <td style={tdCell}><Pill tone={STATUS_TONE[o.status]}>{o.status}</Pill></td>
                              <td style={{ ...tdCell, fontSize: 11, color: T.iron500 }}>{(o.payment_status || '').replace(/_/g, ' ') || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {tab === 'docs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dealer.status === 'approved' && (
                    <DocRow icon={Award} title="Authorized Dealer Certificate" subtitle="Official MuscleGrid dealer certificate" />
                  )}
                  {rowDocs.map((o) => (
                    <DocRow key={o.id} icon={FileText}
                      title={o.final_invoice_number ? `Invoice ${o.final_invoice_number}` : `Proforma ${o.proforma_number}`}
                      subtitle={`Order ${o.order_number} · ${inr(o.total_amount)}`} />
                  ))}
                  {dealer.status !== 'approved' && rowDocs.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 12.5, color: T.iron400 }}>No documents on file yet.</div>
                  )}
                </div>
              )}
            </IronCard>
          </div>
        </div>
      </div>
    </IronShell>
  );
}

function DocRow({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 8, border: `1px solid ${T.iron200}`, padding: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 6, background: '#FDEEE6', color: T.orangeDeep, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon size={15} /></div>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: T.iron900 }}>{title}</div>
        <div style={{ fontSize: 11, color: T.iron500 }}>{subtitle}</div>
      </div>
    </div>
  );
}

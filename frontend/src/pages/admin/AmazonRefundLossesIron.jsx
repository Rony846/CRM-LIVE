import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import {
  AlertTriangle, Scale, Download, Search, IndianRupee, ShieldCheck, Gavel, Loader2, Inbox,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const STATUS_LABEL = {
  none: 'No action', review: 'Under review', notice_drafted: 'Notice drafted',
  notice_sent: 'Notice sent', case_filed: 'Case filed', recovered: 'Recovered', written_off: 'Written off',
};
const STATUS_ROW_TONE = {
  none: 'slate', review: 'warn', notice_drafted: 'info', notice_sent: 'violet',
  case_filed: 'violet', recovered: 'ok', written_off: 'slate',
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

export default function AmazonRefundLosses({ embedded }) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confidence, setConfidence] = useState('all');
  const [legalStatus, setLegalStatus] = useState('all');
  const [returned, setReturned] = useState('genuine');
  const [search, setSearch] = useState('');
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (confidence !== 'all') params.confidence = confidence;
      if (legalStatus !== 'all') params.legal_status = legalStatus;
      if (returned !== 'all') params.returned = returned;
      const r = await axios.get(`${API}/admin/amazon-refund-losses`, { ...auth, params });
      setData(r.data);
    } catch (e) { toast.error('Failed to load refund losses'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [confidence, legalStatus, returned]);

  const orders = useMemo(() => {
    const o = data?.orders || [];
    const q = search.trim().toLowerCase();
    return q ? o.filter((x) =>
      (x.order_id || '').toLowerCase().includes(q) ||
      (x.customer || '').toLowerCase().includes(q) ||
      (x.phone || '').includes(q) ||
      (x.product || '').toLowerCase().includes(q)) : o;
  }, [data, search]);

  const s = data?.summary || {};
  const statuses = data?.legal_statuses || Object.keys(STATUS_LABEL);

  const update = async (order_id, patch) => {
    try {
      await axios.patch(`${API}/admin/amazon-refund-losses/${order_id}`, patch, auth);
      setData((d) => ({ ...d, orders: d.orders.map((o) => o.order_id === order_id ? { ...o, ...patch } : o) }));
      toast.success('Updated');
    } catch (e) { toast.error('Update failed'); }
  };

  const [creating, setCreating] = useState(false);
  const createCase = async (order_id) => {
    try {
      const r = await axios.post(`${API}/admin/amazon-refund-losses/${order_id}/create-legal-case`, {}, auth);
      const c = r.data.case;
      setData((d) => ({ ...d, orders: d.orders.map((o) => o.order_id === order_id
        ? { ...o, legal_case: { serial: c.serial, status: c.status || 'notice_pending', id: c.id } } : o) }));
      toast.success(r.data.created ? `Legal case ${c.serial} created` : `Case ${c.serial || ''} already existed`);
      return true;
    } catch (e) { toast.error('Failed to create legal case'); return false; }
  };
  const createAllMissing = async () => {
    const missing = orders.filter((o) => !o.legal_case && !o.returned);
    if (!missing.length) { toast.info('All shown orders already have a legal case'); return; }
    if (!window.confirm(`Create a legal case for all ${missing.length} shown orders that don't have one?`)) return;
    setCreating(true);
    let made = 0;
    for (const o of missing) { if (await createCase(o.order_id)) made += 1; }
    setCreating(false);
    toast.success(`Done — ${made} legal cases ready`);
  };

  const exportCsv = () => {
    const cols = ['order_id', 'firm_name', 'customer', 'phone', 'ship_state', 'product', 'refund_amount',
      'channel', 'loss_confidence', 'delivery_proof', 'delivered_date', 'awb', 'legal_status', 'legal_notes'];
    const lines = [cols.join(',')].concat(orders.map((o) =>
      cols.map((c) => `"${String(o[c] ?? '').replace(/"/g, '""')}"`).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'amazon_refund_losses.csv'; a.click();
  };

  const Stat = ({ label, value, sub, icon: Icon, tone }) => (
    <IronCard pad={14}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Caps size={9}>{label}</Caps>
        <Icon size={15} strokeWidth={1.9} color={tone || T.iron400} />
      </div>
      <div style={{ ...mono, fontWeight: 700, fontSize: 24, color: T.iron900, marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.iron400, marginTop: 3 }}>{sub}</div>}
    </IronCard>
  );

  const headers = ['ORDER', 'CUSTOMER', 'STATE', 'PRODUCT', 'REFUND', 'CONFIDENCE', 'DELIVERY PROOF', 'LEGAL STATUS', 'NOTES'];

  const headerRight = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={createAllMissing} disabled={creating}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.6 : 1, fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
        <Gavel size={14} />{creating ? 'Creating…' : 'Create cases for all shown'}
      </button>
      <button onClick={exportCsv}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12, color: T.iron700 }}>
        <Download size={14} /> Export
      </button>
    </div>
  );

  const shell = (kids) => embedded ? kids : (
    <IronShell title="Refund Losses" subtitle="LEGAL RECOVERY · AMAZON" onRefresh={load} headerRight={headerRight}>{kids}</IronShell>
  );
  return shell(<>
      {/* Intro */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>
          <AlertTriangle size={17} color={T.orangeDeep} /> Refund Losses — Legal Recovery
        </div>
        <div style={{ fontSize: 12, color: T.iron500, marginTop: 5, maxWidth: 900 }}>
          Refunded + delivered orders. Cross-checked against the Amazon <b>Returns Report</b> — <b>genuine</b> = never came back (recover via legal); the rest were returned to us.
        </div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <Stat label="Genuine real loss" value={inr(s.total_loss)} sub={`${s.genuine_count || 0} orders · never returned`} icon={IndianRupee} tone={T.orangeDeep} />
        <Stat label="Returned to us" value={inr(s.returned_value)} sub={`${s.returned_count || 0} orders · per Returns Report`} icon={ShieldCheck} tone={T.green} />
        <Stat label="High confidence" value={inr(s.high_loss)} sub={`${s.high_count || 0} of the genuine losses`} icon={AlertTriangle} tone={T.orange} />
        <Stat label="Recovered" value={inr(s.recovered_loss)} sub="marked recovered" icon={Scale} tone={T.blue} />
      </div>

      {/* Filters */}
      <IronCard style={{ marginBottom: 16 }} pad={14}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Search</Caps>
            <div style={{ position: 'relative' }}>
              <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order / customer / phone / product" style={{ ...inputStyle, paddingLeft: 30, width: '100%' }} />
            </div>
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Returned?</Caps>
            <select value={returned} onChange={(e) => setReturned(e.target.value)} style={{ ...selectStyle, width: 170 }}>
              <option value="genuine">Genuine losses</option>
              <option value="returned">Returned to us</option>
              <option value="all">All</option>
            </select>
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Confidence</Caps>
            <select value={confidence} onChange={(e) => setConfidence(e.target.value)} style={{ ...selectStyle, width: 200 }}>
              <option value="all">All confidence</option>
              <option value="High">High (Amazon-confirmed)</option>
              <option value="Medium">Medium (self-ship)</option>
            </select>
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Legal status</Caps>
            <select value={legalStatus} onChange={(e) => setLegalStatus(e.target.value)} style={{ ...selectStyle, width: 170 }}>
              <option value="all">All statuses</option>
              {statuses.map((st) => <option key={st} value={st}>{STATUS_LABEL[st] || st}</option>)}
            </select>
          </div>
        </div>
      </IronCard>

      {/* Table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Inbox size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No loss orders.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {headers.map((h, i) => (
                  <th key={i} style={{ ...thCell, textAlign: h === 'REFUND' ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                ))}
              </tr></thead>
              <tbody>{orders.map((o) => {
                const high = o.loss_confidence?.startsWith('High');
                return (
                  <tr key={o.order_id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={tdCell}>
                      <div style={{ ...mono, fontWeight: 700, fontSize: 11.5, color: T.orangeDeep }}>{o.order_id}</div>
                      {o.returned ? (
                        <span title={`${o.return_resolution || ''} · ${o.return_reason || ''}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: T.green, marginTop: 4 }}>
                          <ShieldCheck size={11} /> Returned{o.return_resolution ? ` · ${o.return_resolution}` : ''}
                        </span>
                      ) : o.legal_case ? (
                        <Link to="/admin/legal-cases" title="Legal case exists for this order"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#6D4AB0', marginTop: 4, textDecoration: 'none' }}>
                          <Gavel size={11} /> Legal case{o.legal_case.serial ? ` ${o.legal_case.serial}` : ''}
                        </Link>
                      ) : (
                        <button onClick={() => createCase(o.order_id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: T.iron400, marginTop: 4, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                          <Gavel size={11} /> + Create legal case
                        </button>
                      )}
                    </td>
                    <td style={tdCell}>
                      <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{o.customer || '—'}</div>
                      <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{o.phone}</div>
                    </td>
                    <td style={{ ...tdCell, fontSize: 11.5 }}>{o.ship_state || '—'}</td>
                    <td style={{ ...tdCell, maxWidth: 180 }}>
                      <div title={o.product} style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{o.product}</div>
                    </td>
                    <td style={{ ...tdCell, textAlign: 'right' }}>
                      <span style={{ ...mono, fontWeight: 700, fontSize: 12.5, color: T.iron900 }}>{inr(o.refund_amount)}</span>
                    </td>
                    <td style={tdCell}>
                      <span style={badgeStyle(high ? 'bad' : 'warn')}>{high ? 'High' : 'Medium'}</span>
                    </td>
                    <td style={{ ...tdCell, fontSize: 10.5, color: T.iron500 }}>
                      {o.delivery_proof}{o.delivered_date ? ` · ${o.delivered_date}` : ''}
                    </td>
                    <td style={tdCell}>
                      <select value={o.legal_status || 'none'} onChange={(e) => update(o.order_id, { legal_status: e.target.value })}
                        style={{ ...selectStyle, width: 150, padding: '5px 8px', fontSize: 11.5, ...badgeStyle(STATUS_ROW_TONE[o.legal_status] || 'slate'), borderRadius: 6, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
                        {statuses.map((st) => <option key={st} value={st}>{STATUS_LABEL[st] || st}</option>)}
                      </select>
                    </td>
                    <td style={tdCell}>
                      <input placeholder="add note…" defaultValue={o.legal_notes || ''}
                        onBlur={(e) => { if ((e.target.value || '') !== (o.legal_notes || '')) update(o.order_id, { legal_notes: e.target.value }); }}
                        style={{ ...inputStyle, width: 160, padding: '5px 8px', fontSize: 11.5 }} />
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </IronCard>
  </>);
}

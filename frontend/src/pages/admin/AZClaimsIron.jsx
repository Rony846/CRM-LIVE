import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import {
  ShieldAlert, Search, IndianRupee, Gavel, Clock, XCircle, AlertTriangle, Inbox, Loader2,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell } from '@/components/iron/IronKit';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const STATUS_LABEL = {
  under_review: 'Under review', granted: 'Granted (lost)', denied: 'Denied (won)', appealed: 'Appealed', closed: 'Closed',
};
// Per-status accent for the inline editor.
const STATUS_ACCENT = {
  under_review: T.voltageText, granted: T.orangeDeep, denied: T.green, appealed: T.blue, closed: T.iron500,
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

export default function AZClaims() {
  const { token } = useAuth();
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (status !== 'all') params.status = status;
      const r = await axios.get(`${API}/admin/az-claims`, { ...auth, params });
      setData(r.data);
    } catch (e) { toast.error('Failed to load A-Z claims'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const claims = useMemo(() => {
    const c = data?.claims || [];
    const q = search.trim().toLowerCase();
    return q ? c.filter((x) => [x.order_id, x.customer, x.phone, x.product].some((v) => (v || '').toLowerCase().includes(q))) : c;
  }, [data, search]);

  const s = data?.summary || {};
  const statuses = data?.statuses || Object.keys(STATUS_LABEL);

  const setClaimStatus = async (order_id, st) => {
    try {
      await axios.patch(`${API}/admin/az-claims/${order_id}`, { status: st }, auth);
      load();
      toast.success(`Marked ${STATUS_LABEL[st] || st}`);
    } catch (e) { toast.error('Update failed'); }
  };

  const statCards = [
    { label: 'Total at risk', value: inr(s.total_at_risk), sub: `${s.count || 0} claims`, icon: IndianRupee, tone: T.voltageText },
    { label: 'Pending', value: inr(s.pending_at_risk), sub: `${s.pending_count || 0} under review/appeal`, icon: Clock, tone: T.blue },
    { label: 'Granted (lost)', value: inr(s.granted_loss), sub: `${s.granted_count || 0} claims`, icon: AlertTriangle, tone: T.orangeDeep },
    { label: 'Denied (won)', value: `${s.denied_count || 0}`, sub: 'we kept the money', icon: XCircle, tone: T.green },
  ];

  const headers = ['ORDER', 'CUSTOMER', 'PRODUCT', 'AT RISK', 'FILED', 'SOURCE', 'STATUS', 'LINKS'];

  return (
    <IronShell title="A-Z Claims" subtitle="AMAZON A-TO-Z GUARANTEE · BUYER CLAIMS" onRefresh={load}>

      {/* Intro banner */}
      <IronCard style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }} pad={14}>
        <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.voltageTint, border: `1px solid #EDDFA6`, flexShrink: 0 }}>
          <ShieldAlert size={18} color={T.voltageText} strokeWidth={1.9} />
        </div>
        <div>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>Amazon A-to-z Guarantee Claims</div>
          <div style={{ fontSize: 12, color: T.iron500, marginTop: 3, lineHeight: 1.5, maxWidth: 720 }}>
            Claims filed by buyers. <b style={{ color: T.orangeDeep }}>Granted</b> = Amazon sided with the buyer (our loss); <b style={{ color: T.green }}>Denied</b> = we won. Seeded from claim emails + Returns Report; upload the A-to-z export for full outcomes.
          </div>
        </div>
      </IronCard>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {statCards.map((sc) => {
          const Icon = sc.icon;
          return (
            <IronCard key={sc.label} pad={14}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Caps size={9} color={T.iron400}>{sc.label}</Caps>
                <Icon size={16} color={sc.tone} strokeWidth={1.9} />
              </div>
              <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1, marginTop: 10 }}>{sc.value}</div>
              {sc.sub && <div style={{ fontSize: 11, color: T.iron400, marginTop: 6 }}>{sc.sub}</div>}
            </IronCard>
          );
        })}
      </div>

      {/* Filters */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order / customer / phone / product"
              style={{ ...inputStyle, paddingLeft: 30, width: '100%' }} />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', minWidth: 170 }}>
            <option value="all">All statuses</option>
            {statuses.map((st) => <option key={st} value={st}>{STATUS_LABEL[st] || st}</option>)}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 240 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : claims.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Inbox size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No A-Z claims.</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Try adjusting your search or filters.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {headers.map((h, i) => <th key={i} style={{ ...thCell, textAlign: i === 3 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>)}
              </tr></thead>
              <tbody>{claims.map((c) => (
                <tr key={c.order_id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                  <td style={{ ...tdCell, ...mono, fontWeight: 700, fontSize: 11.5, color: T.orangeDeep }}>{c.order_id}</td>
                  <td style={{ ...tdCell, maxWidth: 180 }}>
                    <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{c.customer || '—'}</div>
                    <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{c.phone}</div>
                  </td>
                  <td style={{ ...tdCell, maxWidth: 190 }} title={c.product}>
                    <div style={{ fontSize: 11.5, color: T.iron700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{c.product || '—'}</div>
                  </td>
                  <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, fontSize: 12.5, color: T.iron900 }}>{inr(c.amount_at_risk)}</td>
                  <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{c.claim_date}</td>
                  <td style={{ ...tdCell, fontSize: 10, color: T.iron400 }}>{(c.sources || []).join(', ')}</td>
                  <td style={tdCell}>
                    <select value={c.status || 'under_review'} onChange={(e) => setClaimStatus(c.order_id, e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer', padding: '5px 8px', fontSize: 11.5, fontWeight: 700, width: 140,
                        color: STATUS_ACCENT[c.status] || T.iron900, borderColor: STATUS_ACCENT[c.status] ? STATUS_ACCENT[c.status] + '55' : T.iron200 }}>
                      {statuses.map((st) => <option key={st} value={st} style={{ color: T.iron900 }}>{STATUS_LABEL[st] || st}</option>)}
                    </select>
                  </td>
                  <td style={{ ...tdCell }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {c.refund_loss && !c.refund_loss.returned && (
                        <Link to="/admin/refund-losses" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: T.headline, fontWeight: 700, fontSize: 10, color: T.orangeDeep, textDecoration: 'none' }}>
                          <IndianRupee size={11} />loss
                        </Link>
                      )}
                      {c.legal_case && (
                        <Link to="/admin/legal-cases" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: T.headline, fontWeight: 700, fontSize: 10, color: '#6D4AB0', textDecoration: 'none' }}>
                          <Gavel size={11} />{c.legal_case.serial || 'case'}
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </IronCard>
    </IronShell>
  );
}

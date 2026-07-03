import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { openAuthedFile } from '@/lib/openFile';
import { toast } from 'sonner';
import { IndianRupee, CheckCircle2, Clock, Image as ImageIcon } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

// ₹100 Google-review reward payouts. "To pay" = customers who sent a review screenshot and haven't
// been credited yet — i.e. the numbers to pay ₹100. Backed by /admin/review-rewards.

const Tile = ({ icon: Icon, label, value, accent }) => (
  <IronCard pad={14}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {Icon ? <Icon size={13} strokeWidth={1.9} color={T.iron400} /> : null}
      <Caps size={9} color={T.iron400}>{label}</Caps>
    </div>
    <div style={{ marginTop: 6, fontFamily: T.display, fontWeight: 800, fontSize: 26, lineHeight: 1, color: accent || T.iron900, ...mono }}>{value}</div>
  </IronCard>
);

const fmtWhen = (r) => ((r.screenshot_at || r.offered_at) || '').slice(0, 16).replace('T', ' ') || '—';

export default function ReviewRewards() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending'); // pending | paid | awaiting

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/review-rewards`, { headers: { Authorization: `Bearer ${token}` } });
      setData(r.data);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (row) => {
    const ref = window.prompt(`Mark ₹${row.amount} paid to ${row.name || row.phone}?\nOptional payment ref (UPI/txn):`, '');
    if (ref === null) return;
    try {
      await axios.post(`${API}/admin/review-rewards/${row.id}/mark-paid`, { ref }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Marked paid');
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const viewShot = (row) => openAuthedFile(`${API}/admin/review-rewards/${row.id}/screenshot`, token);

  const s = data?.summary || {};
  const rows = (tab === 'pending' ? data?.pending : tab === 'paid' ? data?.paid : data?.awaiting) || [];

  const tabs = [
    ['pending', `To pay (${s.to_pay ?? 0})`],
    ['paid', `Paid (${s.paid ?? 0})`],
    ['awaiting', `Awaiting (${s.awaiting_screenshot ?? 0})`],
  ];

  const H = ['Customer', 'Phone (pay ₹100 here)', 'When', 'Screenshot', 'Action'];

  return (
    <IronShell title="Review Rewards" subtitle="₹100 TOKEN GIFT" onRefresh={load}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>
        <div>
          <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 18, color: T.iron900 }}>Review Rewards · ₹100 token gift</div>
          <div style={{ marginTop: 3, fontSize: 12.5, color: T.iron500 }}>
            Customers who posted a Google review &amp; sent a screenshot — the “To pay” list is who to credit ₹100.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Tile icon={IndianRupee} label="To pay (count)" value={s.to_pay ?? '—'} accent={s.to_pay > 0 ? T.orangeDeep : T.iron900} />
          <Tile icon={IndianRupee} label="To pay (₹)" value={s.to_pay_amount != null ? `₹${s.to_pay_amount}` : '—'} accent={s.to_pay_amount > 0 ? T.orangeDeep : T.iron900} />
          <Tile icon={CheckCircle2} label="Paid" value={s.paid ?? '—'} accent={T.green} />
          <Tile icon={Clock} label="Awaiting screenshot" value={s.awaiting_screenshot ?? '—'} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {tabs.map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)}
              style={tab === k
                ? { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '7px 13px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' }
                : { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '7px 13px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {lbl}
            </button>
          ))}
        </div>

        <IronCard pad={0} style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {H.map((h, i) => (
                  <th key={h} style={{ ...thCell, textAlign: i >= 3 ? 'center' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} style={{ ...tdCell, textAlign: 'center', padding: '40px 12px', color: T.iron400 }}>Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdCell, textAlign: 'center', padding: '40px 12px', color: T.iron400 }}>Nothing here.</td></tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={r.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                  <td style={{ ...tdCell, color: T.iron900, fontWeight: 600 }}>{r.name || '—'}</td>
                  <td style={{ ...tdCell, ...mono, color: T.iron900 }}>{r.phone}</td>
                  <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron500 }}>{fmtWhen(r)}</td>
                  <td style={{ ...tdCell, textAlign: 'center' }}>
                    {r.screenshot_media_id ? (
                      <button onClick={() => viewShot(r)}
                        style={{ border: 'none', background: 'transparent', color: T.blue, fontSize: 12, fontFamily: T.body, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ImageIcon size={13} strokeWidth={1.9} /> View
                      </button>
                    ) : <span style={{ fontSize: 12, color: T.iron400 }}>—</span>}
                  </td>
                  <td style={{ ...tdCell, textAlign: 'center' }}>
                    {r.status === 'pending_payment' ? (
                      <button onClick={() => markPaid(r)}
                        style={{ border: 'none', background: T.green, color: '#fff', borderRadius: 6, padding: '6px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>
                        Mark ₹{r.amount} paid
                      </button>
                    ) : r.status === 'paid' ? (
                      <span style={badgeStyle('ok')}>Paid{r.payment_ref ? ` · ${r.payment_ref}` : ''}</span>
                    ) : (
                      <span style={badgeStyle('slate')}>awaiting</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </IronCard>
      </div>
    </IronShell>
  );
}

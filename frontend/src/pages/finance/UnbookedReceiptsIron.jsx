import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { AlertTriangle, ChevronDown, ChevronRight, Inbox, Loader2 } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const TIERS = [
  { key: '', label: 'All' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
];
// Confidence tier -> Iron pill tone
const tierTone = (c) => (c === 'high' ? 'ok' : c === 'medium' ? 'warn' : 'bad');

export default function UnbookedReceipts() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState({});

  const fetchData = async (conf) => {
    setLoading(true);
    try {
      const url = `${API}/finance/unbooked-receipts${conf ? `?confidence=${conf}` : ''}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setData(res.data);
    } catch (e) {
      setData({ dealers: 0, total: 0, by_confidence: {}, rows: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(filter); /* eslint-disable-next-line */ }, [filter, token]);

  const bc = data?.by_confidence || {};
  const rows = data?.rows || [];

  return (
    <IronShell
      title="Unbooked Receipts"
      subtitle={`${(data?.dealers || 0).toLocaleString('en-IN')} DEALERS · BANK-ONLY RECEIPTS`}
      onRefresh={() => fetchData(filter)}
    >
      {/* Intro note */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
        <AlertTriangle size={18} color={T.orange} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 12.5, color: T.iron500, lineHeight: 1.5 }}>
          Dealer payments seen in the bank but booked in <b style={{ color: T.iron900 }}>neither the CRM nor Vyapar</b> — review and book.
        </div>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 16 }}>
        <Stat label="Total Unbooked" value={inr(data?.total)} color={T.orangeDeep} />
        <Stat label="High Confidence" value={inr(bc.high)} color={T.green} />
        <Stat label="Medium" value={inr(bc.medium)} color={T.voltageText} />
        <Stat label="Low (Review)" value={inr(bc.low)} color={T.orangeDeep} />
      </div>

      {/* Tier filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {TIERS.map((t) => {
          const active = filter === t.key;
          return (
            <button key={t.key} onClick={() => setFilter(t.key)}
              style={{
                border: active ? 'none' : `1px solid ${T.iron200}`,
                background: active ? T.orange : T.white,
                color: active ? '#fff' : T.iron700,
                borderRadius: 6, padding: '7px 14px', cursor: 'pointer',
                fontFamily: T.headline, fontWeight: 700, fontSize: 12,
              }}>
              {t.label}
            </button>
          );
        })}
        <span style={{ marginLeft: 'auto', ...mono, fontSize: 11.5, color: T.iron400 }}>{data?.dealers || 0} dealers</span>
      </div>

      {/* List */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 220 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Inbox size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No unbooked receipts flagged</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Everything the bank shows is booked in CRM or Vyapar.</div>
          </div>
        ) : (
          <div>
            {rows.map((r) => {
              const isOpen = !!open[r.id];
              return (
                <div key={r.id} style={{ borderBottom: `1px solid ${T.iron200}` }}>
                  <button onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}
                    className="iron-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                      padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
                    }}>
                    {isOpen ? <ChevronDown size={15} color={T.iron500} style={{ flexShrink: 0 }} /> : <ChevronRight size={15} color={T.iron500} style={{ flexShrink: 0 }} />}
                    <span style={{ ...badgeStyle(tierTone(r.unbooked_bank_confidence)), flexShrink: 0 }}>{r.unbooked_bank_confidence}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900 }}>{r.name}</span>
                    <span style={{ ...mono, fontSize: 11.5, color: T.iron400, flexShrink: 0 }}>{r.unbooked_bank_count}×</span>
                    <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: T.iron900, flexShrink: 0, minWidth: 90, textAlign: 'right' }}>{inr(r.unbooked_bank_total)}</span>
                  </button>
                  {isOpen && (
                    <div style={{ background: T.iron50, padding: '4px 16px 10px 43px', borderTop: `1px solid ${T.iron200}` }}>
                      {(r.unbooked_bank_receipts || []).map((x, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', fontSize: 12, borderTop: i === 0 ? 'none' : `1px solid ${T.iron200}` }}>
                          <span style={{ ...mono, fontWeight: 700, color: T.iron900, width: 112, flexShrink: 0 }}>{inr(x.amount)}</span>
                          <span style={{ ...mono, color: T.iron500, width: 96, flexShrink: 0 }}>{x.date}</span>
                          <span style={{ color: T.iron500, width: 64, flexShrink: 0 }}>{x.bank}</span>
                          <span style={{ ...mono, fontSize: 11, color: T.iron400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.narration}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </IronCard>
    </IronShell>
  );
}

function Stat({ label, value, color }) {
  return (
    <IronCard pad={14}>
      <Caps size={9} color={T.iron400}>{label}</Caps>
      <div style={{ ...mono, marginTop: 6, fontSize: 21, fontWeight: 700, color: color || T.iron900 }}>{value}</div>
    </IronCard>
  );
}

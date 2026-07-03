import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Package, Clock, Search, Eye, Loader2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

export default function ViewPendingFulfillment() {
  const { token } = useAuth();
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('awaiting');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every 60 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/pending-fulfillment?include_expired=true`, { headers });
      setEntries(res.data?.entries || []);
      setSummary(res.data?.summary || {});
    } catch (error) {
      console.error('Failed to fetch pending fulfillment:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fulfillment status -> Iron pill (label + tone + icon), preserving the original mapping.
  const getStatusBadge = (entry) => {
    let label, tone, Icon;
    if (entry.is_label_expired) { label = 'Expired'; tone = 'bad'; Icon = XCircle; }
    else if (entry.status === 'ready_to_dispatch') { label = 'Ready'; tone = 'ok'; Icon = CheckCircle; }
    else if (entry.status === 'awaiting_stock' || entry.status === 'awaiting_procurement') { label = 'Awaiting Stock'; tone = 'warn'; Icon = Clock; }
    else if (entry.status === 'pending_dispatch') { label = 'Pending Dispatch'; tone = 'bad'; Icon = Package; }
    else if (entry.status === 'dispatched') { label = 'Dispatched'; tone = 'info'; Icon = CheckCircle; }
    else if (entry.status === 'cancelled') { label = 'Cancelled'; tone = 'slate'; Icon = null; }
    else { label = entry.status; tone = 'slate'; Icon = null; }
    return (
      <span style={{ ...badgeStyle(tone), display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {Icon && <Icon size={10} />}{label}
      </span>
    );
  };

  const filteredEntries = entries.filter(entry => {
    // Filter by tab
    if (activeTab === 'awaiting' && !['awaiting_stock', 'awaiting_procurement', 'pending_dispatch'].includes(entry.status)) return false;
    if (activeTab === 'ready' && entry.status !== 'ready_to_dispatch') return false;
    if (activeTab === 'dispatched' && entry.status !== 'dispatched') return false;

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        entry.order_id?.toLowerCase().includes(search) ||
        entry.tracking_id?.toLowerCase().includes(search) ||
        entry.customer_name?.toLowerCase().includes(search) ||
        entry.sku_code?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const statCards = [
    { label: 'Total Entries', value: summary.total || 0, icon: Package, tone: T.iron500 },
    { label: 'Awaiting Stock', value: (summary.awaiting_stock || 0) + (summary.awaiting_procurement || 0), icon: Clock, tone: T.voltageText },
    { label: 'Ready to Dispatch', value: summary.ready_to_dispatch || 0, icon: CheckCircle, tone: T.green },
    { label: 'Expiring Soon', value: summary.expiring_soon || 0, icon: AlertTriangle, tone: T.orange },
    { label: 'Expired Labels', value: summary.expired_labels || 0, icon: XCircle, tone: T.orangeDeep },
  ];

  const tabs = [
    { key: 'awaiting', label: `Pending (${(summary.awaiting_stock || 0) + (summary.awaiting_procurement || 0) + (summary.pending_dispatch || 0)})` },
    { key: 'ready', label: `Ready to Dispatch (${summary.ready_to_dispatch || 0})` },
    { key: 'dispatched', label: 'Dispatched' },
    { key: 'all', label: 'All' },
  ];

  const headers = ['ORDER/PI', 'CUSTOMER', 'SKU', 'FIRM', 'QTY', 'STOCK', 'STATUS', 'CREATED'];

  return (
    <IronShell
      title="Pending Fulfillment"
      subtitle="FULFILLMENT QUEUE · VIEW ONLY · AUTO-REFRESH 60s"
      onRefresh={fetchData}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* Header note */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Eye size={18} color={T.orange} strokeWidth={2} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>Pending Fulfillment Queue</div>
            <span style={badgeStyle('info')}>View Only</span>
            <span style={{ fontSize: 12, color: T.iron500 }}>Monitor fulfillment status in real-time</span>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{Number(s.value).toLocaleString('en-IN')}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Tabs + search + table */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tabs.map((tb) => {
                  const active = activeTab === tb.key;
                  return (
                    <button key={tb.key} onClick={() => setActiveTab(tb.key)}
                      style={{ border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                      {tb.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search order/tracking/SKU..."
                  style={{ ...inputStyle, paddingLeft: 30, width: 250 }} />
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                <Package size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No entries found</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>Try adjusting your search or tab.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {headers.map((h, i) => <th key={i} style={{ ...thCell, textAlign: (h === 'QTY' || h === 'STOCK') ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>)}
                  </tr></thead>
                  <tbody>{filteredEntries.map((entry) => (
                    <tr key={entry.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={tdCell}>
                        <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{entry.order_id || entry.quotation_number || '-'}</div>
                        {entry.tracking_id && <div style={{ ...mono, fontSize: 10, color: T.blue, marginTop: 2 }}>{entry.tracking_id}</div>}
                      </td>
                      <td style={{ ...tdCell, maxWidth: 180 }}>
                        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{entry.customer_name || '-'}</div>
                        {entry.customer_phone && <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{entry.customer_phone}</div>}
                      </td>
                      <td style={{ ...tdCell, maxWidth: 240 }}>
                        {entry.items && entry.items.length > 0 ? (
                          <div>
                            {entry.items.map((item, idx) => (
                              <div key={idx} style={idx > 0 ? { paddingTop: 4, marginTop: 4, borderTop: `1px solid ${T.iron200}` } : undefined}>
                                <div style={{ fontSize: 12, color: T.iron900 }}>{item.master_sku_name || item.sku_name || 'Unknown'}</div>
                                <div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{item.sku_code} x{item.quantity}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: 12, color: T.iron900 }}>{entry.master_sku_name || entry.sku_name || '-'}</div>
                            <div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{entry.sku_code}</div>
                          </>
                        )}
                      </td>
                      <td style={{ ...tdCell, fontSize: 12, color: T.iron700 }}>{entry.firm_name || '-'}</td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900 }}>{entry.quantity}</td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 600, color: entry.current_stock >= entry.quantity ? T.green : T.orangeDeep }}>
                        {entry.current_stock}
                      </td>
                      <td style={tdCell}>{getStatusBadge(entry)}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>
                        {entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-IN') : '-'}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </IronCard>
        </>
      )}
    </IronShell>
  );
}

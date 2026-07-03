import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Package, Truck, Clock, Search } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px 7px 30px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };

const statusPill = (status) => {
  const map = {
    ready_for_dispatch: ['Ready', 'ok'],
    ready_to_dispatch: ['Ready', 'ok'],
    pending_dispatch: ['Pending', 'warn'],
    dispatched: ['Dispatched', 'info'],
  };
  const [label, tone] = map[status] || [status, 'slate'];
  return <span style={badgeStyle(tone)}>{label}</span>;
};

const KpiTile = ({ label, value, Icon, color }) => (
  <IronCard pad={14} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div>
      <Caps size={9} color={T.iron400}>{label}</Caps>
      <div style={{ ...mono, fontSize: 26, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    </div>
    <Icon size={30} strokeWidth={1.5} color={color} style={{ opacity: 0.3 }} />
  </IronCard>
);

export default function ViewDispatchQueue() {
  const { token } = useAuth();
  const [queue, setQueue] = useState([]);
  const [recentDispatches, setRecentDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('queue');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every 60 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [queueRes, recentRes] = await Promise.all([
        axios.get(`${API}/dispatcher/queue`, { headers }),
        axios.get(`${API}/dispatcher/recent`, { headers }).catch(() => ({ data: [] })),
      ]);
      setQueue(queueRes.data || []);
      setRecentDispatches(recentRes.data || []);
    } catch (error) {
      console.error('Failed to fetch dispatch queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredQueue = queue.filter((item) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.order_id?.toLowerCase().includes(search) ||
      item.tracking_id?.toLowerCase().includes(search) ||
      item.customer_name?.toLowerCase().includes(search)
    );
  });

  const filteredRecent = recentDispatches.filter((item) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.order_id?.toLowerCase().includes(search) ||
      item.tracking_id?.toLowerCase().includes(search) ||
      item.customer_name?.toLowerCase().includes(search)
    );
  });

  const readyCount = queue.filter((d) => d.status === 'ready_for_dispatch' || d.status === 'ready_to_dispatch').length;
  const pendingCount = queue.filter((d) => d.status === 'pending_dispatch').length;

  const tabBtn = (key, label) => (
    <button
      onClick={() => setActiveTab(key)}
      style={{
        border: 'none', background: 'transparent', cursor: 'pointer', padding: '9px 4px',
        fontFamily: T.headline, fontWeight: 700, fontSize: 12.5,
        color: activeTab === key ? T.iron900 : T.iron500,
        borderBottom: `2px solid ${activeTab === key ? T.orange : 'transparent'}`,
      }}
    >
      {label}
    </button>
  );

  const content = loading ? (
    <IronCard pad={14} style={{ textAlign: 'center', color: T.iron400, fontFamily: T.mono, fontSize: 12 }}>
      Loading dispatch queue…
    </IronCard>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <KpiTile label="Ready to Dispatch" value={readyCount} Icon={Package} color={T.green} />
        <KpiTile label="Pending Dispatch" value={pendingCount} Icon={Clock} color={T.voltageText} />
        <KpiTile label="Dispatched Today" value={recentDispatches.length} Icon={Truck} color={T.blue} />
      </div>

      {/* Search */}
      <div style={{ position: 'relative', width: 280 }}>
        <Search size={15} color={T.iron400} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          placeholder="Search order/tracking..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 20, borderBottom: `1px solid ${T.iron200}` }}>
        {tabBtn('queue', `Queue (${filteredQueue.length})`)}
        {tabBtn('recent', `Recently Dispatched (${filteredRecent.length})`)}
      </div>

      {activeTab === 'queue' && (
        <IronCard pad={0}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {['Order ID', 'Customer', 'Tracking ID', 'SKU', 'Firm', 'Status', 'Created'].map((h) => (
                  <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...tdCell, textAlign: 'center', padding: '28px 12px', color: T.iron400 }}>
                    No items in dispatch queue
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item) => (
                  <tr key={item.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={{ ...tdCell, ...mono, color: T.iron900 }}>{item.order_id || '-'}</td>
                    <td style={{ ...tdCell, color: T.iron900 }}>{item.customer_name || '-'}</td>
                    <td style={{ ...tdCell, ...mono, color: T.blue }}>{item.tracking_id || '-'}</td>
                    <td style={tdCell}>{item.sku_code || item.master_sku_name || '-'}</td>
                    <td style={tdCell}>{item.firm_name || '-'}</td>
                    <td style={tdCell}>{statusPill(item.status)}</td>
                    <td style={{ ...tdCell, ...mono, color: T.iron500 }}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </IronCard>
      )}

      {activeTab === 'recent' && (
        <IronCard pad={0}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {['Order ID', 'Customer', 'Tracking ID', 'Courier', 'Dispatched By', 'Dispatched At'].map((h) => (
                  <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecent.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...tdCell, textAlign: 'center', padding: '28px 12px', color: T.iron400 }}>
                    No recent dispatches
                  </td>
                </tr>
              ) : (
                filteredRecent.map((item) => (
                  <tr key={item.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={{ ...tdCell, ...mono, color: T.iron900 }}>{item.order_id || item.invoice_number || '-'}</td>
                    <td style={{ ...tdCell, color: T.iron900 }}>{item.customer_name || '-'}</td>
                    <td style={{ ...tdCell, ...mono, color: T.blue }}>{item.tracking_id || '-'}</td>
                    <td style={tdCell}>{item.courier || '-'}</td>
                    <td style={tdCell}>{item.dispatched_by_name || '-'}</td>
                    <td style={{ ...tdCell, ...mono, color: T.iron500 }}>
                      {item.dispatched_at ? new Date(item.dispatched_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </IronCard>
      )}
    </div>
  );

  return (
    <IronShell
      title="Dispatch Queue"
      subtitle="VIEW ONLY · REAL-TIME"
      onRefresh={fetchData}
      headerRight={<span style={badgeStyle('info')}>View Only</span>}
    >
      {content}
    </IronShell>
  );
}

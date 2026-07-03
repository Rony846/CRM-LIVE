import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Truck, Package, ExternalLink, Loader2, Search, MapPin,
  CheckCircle, ArrowRight, Clock
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

// Status -> Iron pill tone + label
const STATUS_TONE = {
  pending:    ['Pending', 'warn'],
  confirmed:  ['Confirmed', 'info'],
  dispatched: ['In Transit', 'bad'],
  delivered:  ['Delivered', 'ok'],
  cancelled:  ['Cancelled', 'slate'],
};
const statusPill = (status) => {
  const [label, tone] = STATUS_TONE[status] || [(status || 'Pending').replace(/_/g, ' '), 'slate'];
  return { label, style: badgeStyle(tone) };
};

export default function DealerDispatches() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dispatches, setDispatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (token) {
      fetchDispatches();
    }
  }, [token]);

  const fetchDispatches = async () => {
    try {
      const response = await axios.get(`${API}/dealer/dispatches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDispatches(response.data);
    } catch (error) {
      toast.error('Failed to load dispatch information');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const filteredDispatches = dispatches.filter(dispatch => {
    if (statusFilter && dispatch.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (dispatch.order_number || '').toLowerCase().includes(term) ||
      (dispatch.awb || '').toLowerCase().includes(term) ||
      (dispatch.courier || '').toLowerCase().includes(term)
    );
  });

  const dispatchedCount = dispatches.filter(d => d.status === 'dispatched').length;
  const deliveredCount = dispatches.filter(d => d.status === 'delivered').length;

  const inputStyle = { border: '1px solid ' + T.iron200, borderRadius: 6, padding: '7px 10px 7px 30px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none', width: '100%' };
  const filterBtn = (active) => ({
    border: '1px solid ' + (active ? T.orange : T.iron200),
    background: active ? T.orange : T.white,
    color: active ? '#fff' : T.iron700,
    borderRadius: 6, padding: '7px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5,
    cursor: 'pointer', whiteSpace: 'nowrap'
  });

  const KpiTile = ({ label, value, icon: Icon, tone }) => (
    <IronCard>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <Caps size={9} color={T.iron400}>{label}</Caps>
          <div style={{ ...mono, marginTop: 6, fontSize: 24, fontWeight: 700, color: T.iron900 }}>{value}</div>
        </div>
        <div style={{ height: 40, width: 40, display: 'grid', placeItems: 'center', borderRadius: 8, background: tone.bg, color: tone.fg, flexShrink: 0 }}>
          <Icon size={20} strokeWidth={1.9} />
        </div>
      </div>
    </IronCard>
  );

  const H = ['Order', 'Status', 'Order Date', 'Items', 'Amount', 'Courier', 'AWB', 'Dispatched', ''];

  const content = loading ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
      <Loader2 className="animate-spin" size={30} color={T.orange} />
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <KpiTile label="In Transit" value={dispatchedCount} icon={Truck} tone={{ bg: '#FDEEE6', fg: T.orangeDeep }} />
        <KpiTile label="Delivered" value={deliveredCount} icon={CheckCircle} tone={{ bg: T.greenTint, fg: T.green }} />
        <KpiTile label="Total Shipments" value={dispatches.length} icon={Package} tone={{ bg: '#EEE9F7', fg: '#6D4AB0' }} />
      </div>

      {/* Filters */}
      <IronCard>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Search size={15} color={T.iron400} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              placeholder="Search by order number, AWB, or courier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={filterBtn(!statusFilter)} onClick={() => setStatusFilter('')}>All</button>
            <button style={filterBtn(statusFilter === 'dispatched')} onClick={() => setStatusFilter('dispatched')}>In Transit</button>
            <button style={filterBtn(statusFilter === 'delivered')} onClick={() => setStatusFilter('delivered')}>Delivered</button>
            <button style={filterBtn(statusFilter === 'confirmed')} onClick={() => setStatusFilter('confirmed')}>Confirmed</button>
          </div>
        </div>
      </IronCard>

      {/* Dispatch list */}
      {filteredDispatches.length === 0 ? (
        <IronCard style={{ padding: 48, textAlign: 'center' }}>
          <Truck size={54} color={T.iron200} style={{ margin: '0 auto 14px' }} />
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 16, color: T.iron900, marginBottom: 6 }}>No Dispatches Found</div>
          <div style={{ fontSize: 13, color: T.iron500, marginBottom: 16 }}>
            {searchTerm || statusFilter
              ? 'No dispatches match your search criteria'
              : 'Your dispatches will appear here once orders are shipped'}
          </div>
          <Link to="/dealer/orders/new" style={{ textDecoration: 'none' }}>
            <span style={{ display: 'inline-block', border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Place New Order
            </span>
          </Link>
        </IronCard>
      ) : (
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid ' + T.iron200, background: T.iron50 }}>
                  {H.map((h, i) => (
                    <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDispatches.map((dispatch) => {
                  const pill = statusPill(dispatch.status);
                  return (
                    <tr key={dispatch.order_id} className="iron-row" style={{ borderBottom: '1px solid ' + T.iron200 }}>
                      <td style={tdCell}>
                        <span style={{ ...mono, fontWeight: 600, color: T.iron900 }}>{dispatch.order_number}</span>
                      </td>
                      <td style={tdCell}>
                        <span style={pill.style}>{pill.label}</span>
                      </td>
                      <td style={{ ...tdCell, ...mono }}>{formatDate(dispatch.created_at)}</td>
                      <td style={{ ...tdCell, ...mono }}>{dispatch.items_count}</td>
                      <td style={{ ...tdCell, ...mono, fontWeight: 600, color: T.iron900 }}>{formatCurrency(dispatch.total_amount)}</td>
                      <td style={tdCell}>
                        {dispatch.awb ? (dispatch.courier || 'N/A') : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.voltageText }}>
                            <Clock size={13} /> Awaiting Dispatch
                          </span>
                        )}
                      </td>
                      <td style={tdCell}>
                        {dispatch.awb ? (
                          <span style={{ ...mono, color: T.orangeDeep, fontWeight: 600 }}>{dispatch.awb}</span>
                        ) : (
                          <span style={{ color: T.iron400 }}>-</span>
                        )}
                      </td>
                      <td style={{ ...tdCell, ...mono }}>
                        {dispatch.dispatch_date ? formatDate(dispatch.dispatch_date) : <span style={{ color: T.iron400 }}>-</span>}
                      </td>
                      <td style={{ ...tdCell, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                          {dispatch.awb && dispatch.tracking_url && (
                            <a href={dispatch.tracking_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '6px 10px', fontFamily: T.headline, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                                <ExternalLink size={13} /> Track
                              </span>
                            </a>
                          )}
                          <Link to={`/dealer/orders/${dispatch.order_id}`} style={{ textDecoration: 'none' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid ' + T.iron200, background: T.white, color: T.iron700, borderRadius: 6, padding: '6px 10px', fontFamily: T.headline, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                              View <ArrowRight size={13} />
                            </span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </IronCard>
      )}

      {/* Info banner */}
      <IronCard style={{ background: T.blueTint, borderColor: '#CBE0F0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <MapPin size={20} color={T.blue} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.blue }}>Tracking Information</div>
            <div style={{ fontSize: 12.5, color: T.iron700, marginTop: 4, lineHeight: 1.5 }}>
              Click the "Track" button to open the courier's tracking page in a new window.
              AWB numbers are provided once your order is dispatched from our warehouse.
              For any delivery issues, please raise a support ticket.
            </div>
          </div>
        </div>
      </IronCard>
    </div>
  );

  return (
    <IronShell title="Dispatches" subtitle="DEALER PORTAL / DISPATCH TRACKING" onRefresh={fetchDispatches}>
      {content}
    </IronShell>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  Search, Loader2, ArrowDownLeft, ArrowUpRight,
  Package, Truck, Clock,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

export default function AdminGateLogs() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [scheduled, setScheduled] = useState({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    scan_type: '',
    search: '',
    from_date: '',
    to_date: '',
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.scan_type && filters.scan_type !== 'all') params.append('scan_type', filters.scan_type);
      if (filters.search) params.append('search', filters.search);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);

      const [logsRes, scheduledRes] = await Promise.all([
        axios.get(`${API}/gate/logs?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/gate/scheduled`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setLogs(logsRes.data);
      setScheduled({
        incoming: scheduledRes.data.scheduled_incoming || [],
        outgoing: scheduledRes.data.scheduled_outgoing || [],
      });
    } catch (error) {
      toast.error('Failed to load gate logs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN');
  };

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const todayStr = new Date().toDateString();
  const inwardToday = logs.filter((l) => l.scan_type === 'inward' && new Date(l.scanned_at).toDateString() === todayStr).length;
  const outwardToday = logs.filter((l) => l.scan_type === 'outward' && new Date(l.scanned_at).toDateString() === todayStr).length;

  const kpis = [
    { label: 'Inward Today', value: inwardToday, accent: T.green, Icon: ArrowDownLeft, tone: 'ok' },
    { label: 'Outward Today', value: outwardToday, accent: T.blue, Icon: ArrowUpRight, tone: 'info' },
    { label: 'Scheduled Incoming', value: scheduled.incoming.length, accent: T.voltageText, Icon: Clock, tone: 'warn' },
    { label: 'Pending Dispatch', value: scheduled.outgoing.length, accent: '#6D4AB0', Icon: Truck, tone: 'violet' },
  ];

  const tableHeaders = ['Type', 'Tracking ID', 'Courier', 'Ticket', 'Customer', 'Scanned By', 'Time'];

  return (
    <IronShell title="Gate Logs" subtitle="IN & OUT · PARCEL MOVEMENT" onRefresh={fetchData}>
      {/* Intro */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 18, color: T.iron900 }}>Gate Activity Logs</div>
        <div style={{ fontSize: 12.5, color: T.iron500, marginTop: 3 }}>
          Track all parcels entering and leaving the factory, including repair items and non-repair inward claimables.
        </div>
      </div>

      {/* Summary KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {kpis.map((k) => {
          const tileBg = badgeStyle(k.tone).background;
          return (
            <IronCard key={k.label} pad="13px 14px">
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: tileBg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <k.Icon size={18} color={k.accent} strokeWidth={2} />
                </div>
                <div>
                  <Caps size={8.5} color={T.iron400}>{k.label}</Caps>
                  <div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 22, color: k.accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>{k.value}</div>
                </div>
              </div>
            </IronCard>
          );
        })}
      </div>

      {/* Scheduled Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Scheduled Incoming */}
        <IronCard pad={0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
            <ArrowDownLeft size={16} color={T.green} />
            <Caps size={10} color={T.iron700}>Scheduled Incoming</Caps>
          </div>
          <div style={{ padding: 12 }}>
            {scheduled.incoming.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '18px 0', color: T.iron400, fontSize: 12 }}>No scheduled incoming parcels</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scheduled.incoming.map((item, idx) => (
                  <div key={idx} style={{ padding: 11, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{item.ticket_number}</div>
                      <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 2 }}>{item.customer_name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11.5, color: T.blue, fontWeight: 600 }}>{item.pickup_courier}</div>
                      <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{item.pickup_tracking}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </IronCard>

        {/* Scheduled Outgoing */}
        <IronCard pad={0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
            <ArrowUpRight size={16} color={T.blue} />
            <Caps size={10} color={T.iron700}>Scheduled Outgoing</Caps>
          </div>
          <div style={{ padding: 12 }}>
            {scheduled.outgoing.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '18px 0', color: T.iron400, fontSize: 12 }}>No scheduled outgoing parcels</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scheduled.outgoing.map((item, idx) => (
                  <div key={idx} style={{ padding: 11, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{item.ticket_number || item.dispatch_number}</div>
                      <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 2 }}>{item.customer_name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11.5, color: T.blue, fontWeight: 600 }}>{item.return_courier || item.courier}</div>
                      <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{item.return_tracking || item.tracking_id}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </IronCard>
      </div>

      {/* Filters */}
      <IronCard style={{ marginBottom: 16 }} pad={14}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Search</Caps>
            <div style={{ position: 'relative' }}>
              <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
              <input
                placeholder="tracking ID / ticket / customer"
                value={filters.search}
                onChange={(e) => setF('search', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                style={{ ...inputStyle, paddingLeft: 30 }}
              />
            </div>
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Type</Caps>
            <select value={filters.scan_type} onChange={(e) => setF('scan_type', e.target.value)} style={selectStyle}>
              <option value="">All</option>
              <option value="inward">Inward</option>
              <option value="outward">Outward</option>
            </select>
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>From</Caps>
            <input type="date" value={filters.from_date} onChange={(e) => setF('from_date', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>To</Caps>
            <input type="date" value={filters.to_date} onChange={(e) => setF('to_date', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <button onClick={fetchData} style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>Apply Filters</button>
          </div>
        </div>
      </IronCard>

      {/* Gate Logs Table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
          <Caps size={10} color={T.iron700}>Recent Gate Activity</Caps>
        </div>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Package size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No gate logs found</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {tableHeaders.map((h, i) => <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={tdCell}>
                      <span style={{ ...badgeStyle(log.scan_type === 'inward' ? 'ok' : 'info'), display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {log.scan_type === 'inward' ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                        {(log.scan_type || '').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{log.tracking_id}</td>
                    <td style={{ ...tdCell, color: T.iron900 }}>{log.courier || '-'}</td>
                    <td style={{ ...tdCell, ...mono, color: T.iron500 }}>{log.ticket_number || '-'}</td>
                    <td style={{ ...tdCell, color: T.iron900 }}>{log.customer_name || '-'}</td>
                    <td style={tdCell}>{log.scanned_by_name}</td>
                    <td style={{ ...tdCell, ...mono, fontSize: 10.5, color: T.iron500 }}>{formatDate(log.scanned_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </IronCard>
    </IronShell>
  );
}

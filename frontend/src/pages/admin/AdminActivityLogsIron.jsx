import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  Loader2, Search, Activity, Filter, Clock, User,
  Package, Ticket, FileText, Truck, Factory, DollarSign, ScanLine,
  Bell, ChevronDown, ChevronUp, FilterX,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle, fmtDateTime } from '@/components/iron/IronKit';

const ACTION_ICONS = {
  // Tickets
  ticket_created: Ticket,
  ticket_updated: Ticket,
  ticket_escalated: Ticket,
  ticket_closed: Ticket,

  // Dispatch
  dispatch_created: Truck,
  dispatch_stock_deducted: Truck,
  dispatch_status_updated: Truck,
  pending_fulfillment_dispatched: Truck,

  // Production
  production_request_created: Factory,
  production_request_accepted: Factory,
  production_request_started: Factory,
  production_request_completed: Factory,
  production_received_into_inventory: Factory,
  production_request_cancelled: Factory,

  // Inventory
  inventory_ledger_entry: Package,
  stock_transfer: Package,
  stock_adjustment: Package,
  incoming_queue_classified: Package,

  // Payments
  supervisor_payment_recorded: DollarSign,

  // Gate
  gate_scan_inward: ScanLine,
  gate_scan_outward: ScanLine,

  // Notifications
  notification_created: Bell,

  // Default
  default: Activity,
};

// Map raw actions to Iron badge tones (mirrors the legacy ACTION_COLORS semantics).
const ACTION_TONES = {
  ticket_created: 'ok',
  dispatch_created: 'ok',
  production_request_created: 'ok',

  ticket_updated: 'info',
  dispatch_status_updated: 'info',
  production_request_accepted: 'info',
  production_request_started: 'info',

  ticket_closed: 'ok',
  production_request_completed: 'ok',
  production_received_into_inventory: 'ok',
  pending_fulfillment_dispatched: 'ok',

  dispatch_stock_deducted: 'warn',
  supervisor_payment_recorded: 'warn',
  stock_transfer: 'warn',

  gate_scan_inward: 'violet',
  gate_scan_outward: 'violet',

  production_request_cancelled: 'bad',

  default: 'slate',
};

// Solid icon-chip colours (kept distinct so the icon tile still reads at a glance).
const ACTION_ICON_BG = {
  ticket_created: T.green,
  dispatch_created: T.green,
  production_request_created: T.green,
  ticket_updated: T.blue,
  dispatch_status_updated: T.blue,
  production_request_accepted: T.blue,
  production_request_started: T.blue,
  ticket_closed: T.green,
  production_request_completed: T.green,
  production_received_into_inventory: T.green,
  pending_fulfillment_dispatched: T.green,
  dispatch_stock_deducted: T.voltageText,
  supervisor_payment_recorded: T.voltageText,
  stock_transfer: T.voltageText,
  gate_scan_inward: '#6D4AB0',
  gate_scan_outward: '#6D4AB0',
  production_request_cancelled: T.orangeDeep,
  default: T.iron500,
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

const formatAction = (action) => (action || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

const KpiTile = ({ label, value, Icon, tint, color }) => (
  <IronCard pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 40, height: 40, borderRadius: 8, background: tint, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <Icon size={19} strokeWidth={1.9} color={color} />
    </div>
    <div>
      <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 3 }}>{label}</Caps>
      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{value}</div>
    </div>
  </IronCard>
);

export default function AdminActivityLogs() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    actionType: 'all',
    userId: 'all',
    entityType: 'all',
    search: '',
    dateFrom: '',
    dateTo: '',
  });
  const [filterOptions, setFilterOptions] = useState({
    actionTypes: [],
    entityTypes: [],
    performers: [],
  });
  const [expandedLogs, setExpandedLogs] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.actionType !== 'all') params.action_type = filters.actionType;
      if (filters.userId !== 'all') params.user_id = filters.userId;
      if (filters.entityType !== 'all') params.entity_type = filters.entityType;
      if (filters.search) params.search = filters.search;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;

      const response = await axios.get(`${API}/admin/activity-logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setLogs(response.data.logs || []);
      setFilterOptions({
        actionTypes: response.data.action_types || [],
        entityTypes: response.data.entity_types || [],
        performers: response.data.performers || [],
      });
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (logId) => {
    setExpandedLogs((prev) => ({ ...prev, [logId]: !prev[logId] }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const clearFilters = () => {
    setFilters({
      actionType: 'all',
      userId: 'all',
      entityType: 'all',
      search: '',
      dateFrom: '',
      dateTo: '',
    });
    setTimeout(fetchLogs, 100);
  };

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    return {
      total: logs.length,
      today: logs.filter((l) => new Date(l.timestamp) >= today).length,
      thisWeek: logs.filter((l) => new Date(l.timestamp) >= thisWeek).length,
      uniqueUsers: new Set(logs.map((l) => l.performed_by)).size,
    };
  }, [logs]);

  const headers = ['', 'ACTION', 'ENTITY', 'PERFORMED BY', 'TIMESTAMP', ''];

  const headerRight = (
    <button
      onClick={() => setShowFilters(!showFilters)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, background: showFilters ? T.iron100 : T.white, borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12, color: T.iron700 }}
    >
      <Filter size={14} /> {showFilters ? 'Hide Filters' : 'Show Filters'}
    </button>
  );

  return (
    <IronShell title="Activity Logs" subtitle="AUDIT TRAIL · ALL ORGANIZATION ACTIONS" onRefresh={fetchLogs} headerRight={headerRight}>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <KpiTile label="Total Logs" value={stats.total} Icon={Activity} tint={T.blueTint} color={T.blue} />
        <KpiTile label="Today" value={stats.today} Icon={Clock} tint={T.greenTint} color={T.green} />
        <KpiTile label="This Week" value={stats.thisWeek} Icon={FileText} tint="#EEE9F7" color="#6D4AB0" />
        <KpiTile label="Active Users" value={stats.uniqueUsers} Icon={User} tint="#FDEEE6" color={T.orangeDeep} />
      </div>

      {/* Filters */}
      {showFilters && (
        <IronCard style={{ marginBottom: 16 }} pad={14}>
          <form onSubmit={handleSearch}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Search</Caps>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                  <input
                    placeholder="Search logs..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    style={{ ...inputStyle, paddingLeft: 30 }}
                  />
                </div>
              </div>
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Action Type</Caps>
                <select
                  value={filters.actionType}
                  onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
                  style={selectStyle}
                >
                  <option value="all">All Actions</option>
                  {filterOptions.actionTypes.map((a) => (
                    <option key={a} value={a}>{formatAction(a)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Entity Type</Caps>
                <select
                  value={filters.entityType}
                  onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
                  style={selectStyle}
                >
                  <option value="all">All Entities</option>
                  {filterOptions.entityTypes.map((e) => (
                    <option key={e} value={e}>{formatAction(e)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Performed By</Caps>
                <select
                  value={filters.userId}
                  onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                  style={selectStyle}
                >
                  <option value="all">All Users</option>
                  {filterOptions.performers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Date From</Caps>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Date To</Caps>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                type="button"
                onClick={clearFilters}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12, color: T.iron500 }}
              >
                <FilterX size={14} /> Clear Filters
              </button>
              <button
                type="submit"
                style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}
              >
                Apply Filters
              </button>
            </div>
          </form>
        </IronCard>
      )}

      {/* Logs Table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          <Activity size={15} color={T.orange} />
          <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>Recent Activity</span>
          <div style={{ flex: 1 }} />
          <Caps size={9} color={T.iron400}>{logs.length} records</Caps>
        </div>

        {loading && logs.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}>
            <Loader2 className="animate-spin" size={28} color={T.iron400} />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Activity size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No activity logs found</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Activity will appear here as users perform actions</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {headers.map((h, i) => <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const ActionIcon = ACTION_ICONS[log.action] || ACTION_ICONS.default;
                  const iconBg = ACTION_ICON_BG[log.action] || ACTION_ICON_BG.default;
                  const tone = ACTION_TONES[log.action] || ACTION_TONES.default;
                  const isExpanded = expandedLogs[log.id];
                  const hasDetails = log.details && Object.keys(log.details).length > 0;

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={{ ...tdCell, width: 48 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 7, background: iconBg, display: 'grid', placeItems: 'center' }}>
                            <ActionIcon size={15} color="#fff" />
                          </div>
                        </td>
                        <td style={tdCell}>
                          <span style={badgeStyle(tone)}>{formatAction(log.action)}</span>
                        </td>
                        <td style={tdCell}>
                          <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>
                            {log.entity_name || log.entity_id || '-'}
                          </div>
                          <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 2 }}>
                            {log.entity_type?.replace(/_/g, ' ')}
                          </div>
                        </td>
                        <td style={tdCell}>
                          <div style={{ fontSize: 12.5, color: T.iron900 }}>{log.performed_by_name || 'System'}</div>
                          <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{log.performed_by_role || ''}</div>
                        </td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>
                          {formatDate(log.timestamp)}
                        </td>
                        <td style={{ ...tdCell, width: 48, textAlign: 'right' }}>
                          {hasDetails && (
                            <button
                              onClick={() => toggleExpanded(log.id)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.iron500, display: 'inline-grid', placeItems: 'center', padding: 4 }}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && log.details && (
                        <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                          <td colSpan={6} style={{ padding: 16 }}>
                            <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>Details</Caps>
                            <pre style={{ ...mono, fontSize: 11, color: T.iron700, background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: 12, overflowX: 'auto', margin: 0 }}>
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </IronCard>
    </IronShell>
  );
}

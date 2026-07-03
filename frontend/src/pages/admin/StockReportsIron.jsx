import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  FileText, Loader2, Download, Filter, Package,
  ArrowRightLeft, TrendingUp, TrendingDown, AlertTriangle, Wrench
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const labelStyle = { display: 'block', marginBottom: 4 };

const ENTRY_TYPE_LABELS = {
  purchase: 'Purchase',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  adjustment_in: 'Adjustment (+)',
  adjustment_out: 'Adjustment (-)',
  dispatch_out: 'Dispatch (Sale)',
  return_in: 'Return Received',
  repair_yard_in: 'Repair Yard In',
  production_consume: 'Production (Consumed)',
  production_output: 'Production (Output)'
};

// Entry type -> Iron pill tone.
const ENTRY_TYPE_TONE = {
  purchase: 'ok',
  transfer_in: 'info',
  transfer_out: 'bad',
  adjustment_in: 'info',
  adjustment_out: 'bad',
  dispatch_out: 'violet',
  return_in: 'ok',
  repair_yard_in: 'warn',
  production_consume: 'violet',
  production_output: 'ok'
};

const IN_TYPES = ['purchase', 'transfer_in', 'adjustment_in', 'return_in', 'repair_yard_in', 'production_output'];

const TABS = [
  { key: 'ledger', label: 'Stock Ledger', icon: FileText },
  { key: 'stock', label: 'Current Stock', icon: Package },
  { key: 'transfers', label: 'Transfers', icon: ArrowRightLeft },
  { key: 'dispatch_return', label: 'Dispatch & Returns', icon: TrendingDown },
  { key: 'adjustments', label: 'Adjustments', icon: Wrench },
];

const nf = (n) => (n || 0).toLocaleString('en-IN');

export default function StockReports() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ledger');

  // Data states
  const [firms, setFirms] = useState([]);
  const [ledgerData, setLedgerData] = useState({ entries: [], totals: {} });
  const [stockData, setStockData] = useState({ raw_materials: [], finished_goods: [], firms_summary: [], totals: {} });
  const [transferData, setTransferData] = useState({ transfers: [], totals: {} });
  const [dispatchReturnData, setDispatchReturnData] = useState({ dispatches: [], returns: [], totals: {} });
  const [adjustmentData, setAdjustmentData] = useState({ all_entries: [], totals: {} });

  // Filter states
  const [filters, setFilters] = useState({
    firm_id: '',
    item_type: '',
    entry_type: '',
    date_from: '',
    date_to: ''
  });

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchFirms();
    fetchSummaryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (activeTab) {
      fetchReportData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters]);

  const fetchFirms = async () => {
    try {
      const response = await axios.get(`${API}/firms`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { is_active: true }
      });
      setFirms(response.data || []);
    } catch (error) {
      console.error('Failed to fetch firms:', error);
    }
  };

  // Fetch summary data for all reports (for header cards)
  const fetchSummaryData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = {
        firm_id: filters.firm_id || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined
      };

      const [ledgerRes, transferRes, dispatchRes, adjRes] = await Promise.all([
        axios.get(`${API}/reports/stock-ledger`, { headers, params }),
        axios.get(`${API}/reports/transfers`, { headers, params }),
        axios.get(`${API}/reports/dispatch-return`, { headers, params }),
        axios.get(`${API}/reports/adjustments`, { headers, params })
      ]);

      setLedgerData(ledgerRes.data);
      setTransferData(transferRes.data);
      setDispatchReturnData(dispatchRes.data);
      setAdjustmentData(adjRes.data);
    } catch (error) {
      console.error('Failed to fetch summary data:', error);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = {
        firm_id: filters.firm_id || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined
      };

      if (activeTab === 'ledger') {
        params.entry_type = filters.entry_type || undefined;
        const res = await axios.get(`${API}/reports/stock-ledger`, { headers, params });
        setLedgerData(res.data);
      } else if (activeTab === 'stock') {
        params.item_type = filters.item_type || undefined;
        const res = await axios.get(`${API}/reports/current-stock`, { headers, params });
        setStockData(res.data);
      } else if (activeTab === 'transfers') {
        const res = await axios.get(`${API}/reports/transfers`, { headers, params });
        setTransferData(res.data);
      } else if (activeTab === 'dispatch_return') {
        const res = await axios.get(`${API}/reports/dispatch-return`, { headers, params });
        setDispatchReturnData(res.data);
      } else if (activeTab === 'adjustments') {
        const res = await axios.get(`${API}/reports/adjustments`, { headers, params });
        setAdjustmentData(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async (reportType) => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        report_type: reportType,
        ...(filters.firm_id && { firm_id: filters.firm_id }),
        ...(filters.date_from && { date_from: filters.date_from }),
        ...(filters.date_to && { date_to: filters.date_to })
      });

      const response = await axios.get(`${API}/reports/export/csv?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}_report.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      firm_id: '',
      item_type: '',
      entry_type: '',
      date_from: '',
      date_to: ''
    });
  };

  const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
  const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };

  const loadingBlock = (
    <div style={{ display: 'grid', placeItems: 'center', padding: '48px 0' }}>
      <Loader2 className="animate-spin" size={28} color={T.iron400} />
    </div>
  );

  const emptyBlock = (msg) => (
    <div style={{ textAlign: 'center', padding: '48px 0', color: T.iron400, fontSize: 13 }}>{msg}</div>
  );

  const tableWrap = (children, maxH = 600) => (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: maxH }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
    </div>
  );

  const headerRow = (cols) => (
    <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
      {cols.map((c, i) => (
        <th key={i} style={{ ...thCell, textAlign: c.right ? 'right' : 'left', position: 'sticky', top: 0, background: T.iron50 }}>
          <Caps size={8.5}>{c.label}</Caps>
        </th>
      ))}
    </tr></thead>
  );

  // Header KPI cards.
  const kpis = [
    {
      label: 'Total Inward', icon: TrendingUp, tone: T.green,
      value: (ledgerData.totals?.total_in || 0) + (transferData.totals?.total_quantity || 0),
      hint: 'Purchases + Transfers In + Returns'
    },
    {
      label: 'Total Outward', icon: TrendingDown, tone: T.orangeDeep,
      value: (ledgerData.totals?.total_out || 0) + (dispatchReturnData.totals?.total_dispatched || 0),
      hint: 'Dispatches + Transfers Out + Adjustments'
    },
    {
      label: 'Inter-Firm Transfers', icon: ArrowRightLeft, tone: T.blue,
      value: transferData.totals?.total_transfers || 0,
      hint: 'GST-compliant movements'
    },
    {
      label: 'Stock Adjustments', icon: Wrench, tone: T.orange,
      value: adjustmentData.totals?.total_entries || 0,
      hint: 'Manual + Repair Yard entries'
    },
  ];

  const headerRight = (
    <button
      onClick={() => handleExportCSV(activeTab === 'dispatch_return' ? 'ledger' : activeTab)}
      disabled={exporting}
      style={{ ...primaryBtn, opacity: exporting ? 0.7 : 1 }}
    >
      {exporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
      Export CSV
    </button>
  );

  return (
    <IronShell title="Stock Reports" subtitle="STOCK MOVEMENT · LEDGER + TRANSFERS + ADJUSTMENTS" onRefresh={fetchReportData} headerRight={headerRight}>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <IronCard key={k.label} pad={14}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                  <Icon size={18} color={k.tone} strokeWidth={1.9} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{nf(k.value)}</div>
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{k.label}</Caps>
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 8 }}>{k.hint}</div>
            </IronCard>
          );
        })}
      </div>

      {/* Filter card */}
      <IronCard pad={14} style={{ marginBottom: 16 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Filter size={15} color={T.iron700} />
          <Caps size={10} color={T.iron700}>Filters</Caps>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div>
            <Caps size={9} color={T.iron400} style={labelStyle}>Firm</Caps>
            <select
              value={filters.firm_id}
              onChange={(e) => setFilters({ ...filters, firm_id: e.target.value })}
              style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
            >
              <option value="">All Firms</option>
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>{firm.name}</option>
              ))}
            </select>
          </div>

          {activeTab === 'ledger' && (
            <div>
              <Caps size={9} color={T.iron400} style={labelStyle}>Entry Type</Caps>
              <select
                value={filters.entry_type}
                onChange={(e) => setFilters({ ...filters, entry_type: e.target.value })}
                style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
              >
                <option value="">All Types</option>
                {Object.entries(ENTRY_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'stock' && (
            <div>
              <Caps size={9} color={T.iron400} style={labelStyle}>Item Type</Caps>
              <select
                value={filters.item_type}
                onChange={(e) => setFilters({ ...filters, item_type: e.target.value })}
                style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
              >
                <option value="">All Items</option>
                <option value="raw_material">Raw Materials</option>
                <option value="finished_good">Finished Goods</option>
              </select>
            </div>
          )}

          <div>
            <Caps size={9} color={T.iron400} style={labelStyle}>From Date</Caps>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          <div>
            <Caps size={9} color={T.iron400} style={labelStyle}>To Date</Caps>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={clearFilters} style={{ ...outlineBtn, flex: 1 }}>Clear</button>
            <button
              onClick={() => handleExportCSV(activeTab === 'dispatch_return' ? 'ledger' : activeTab)}
              disabled={exporting}
              style={{ ...primaryBtn, opacity: exporting ? 0.7 : 1 }}
            >
              {exporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            </button>
          </div>
        </div>
      </IronCard>

      {/* Tabs */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          {TABS.map((tb) => {
            const Icon = tb.icon;
            const active = activeTab === tb.key;
            return (
              <button key={tb.key} onClick={() => setActiveTab(tb.key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                <Icon size={14} strokeWidth={2} />{tb.label}
              </button>
            );
          })}
        </div>

        {/* Stock Ledger Tab */}
        {activeTab === 'ledger' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>Stock Ledger Report</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: T.green }}>In: <b style={mono}>{nf(ledgerData.totals?.total_in)}</b></span>
                <span style={{ color: T.orangeDeep }}>Out: <b style={mono}>{nf(ledgerData.totals?.total_out)}</b></span>
                <span style={{ color: T.iron500 }}>Entries: <b style={mono}>{nf(ledgerData.totals?.total_entries)}</b></span>
              </div>
            </div>
            {loading ? loadingBlock
              : ledgerData.entries?.length === 0 ? emptyBlock('No ledger entries found')
              : tableWrap(
                <>
                  {headerRow([
                    { label: 'Entry #' }, { label: 'Date' }, { label: 'Type' }, { label: 'Item' },
                    { label: 'Firm' }, { label: 'Qty', right: true }, { label: 'Balance', right: true },
                    { label: 'Invoice/Ref' }, { label: 'Reason' }, { label: 'By' }
                  ])}
                  <tbody>
                    {ledgerData.entries.map((entry) => {
                      const isIn = IN_TYPES.includes(entry.entry_type);
                      return (
                        <tr key={entry.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                          <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.orangeDeep, fontWeight: 700 }}>{entry.entry_number}</td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{entry.created_at?.slice(0, 10)}</td>
                          <td style={tdCell}><span style={badgeStyle(ENTRY_TYPE_TONE[entry.entry_type] || 'slate')}>{ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}</span></td>
                          <td style={tdCell}>
                            <div style={{ fontSize: 12.5, color: T.iron900 }}>{entry.item_name}</div>
                            <div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{entry.item_sku}</div>
                          </td>
                          <td style={{ ...tdCell, color: T.iron700 }}>{entry.firm_name}</td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: isIn ? T.green : T.orangeDeep }}>
                            {isIn ? '+' : '-'}{Math.abs(entry.quantity)}
                          </td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900 }}>{entry.running_balance}</td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{entry.invoice_number || '-'}</td>
                          <td style={{ ...tdCell, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.iron500 }} title={entry.reason || ''}>{entry.reason || '-'}</td>
                          <td style={{ ...tdCell, fontSize: 11, color: T.iron500 }}>{entry.created_by_name}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              )}
          </div>
        )}

        {/* Current Stock Tab */}
        {activeTab === 'stock' && (
          <div style={{ padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
              {[
                { label: 'Raw Materials', value: stockData.totals?.total_raw_materials || 0, icon: Package, tone: T.blue },
                { label: 'Finished Goods', value: stockData.totals?.total_finished_goods || 0, icon: Package, tone: T.blue },
                { label: 'Low Stock Items', value: stockData.totals?.low_stock_count || 0, icon: AlertTriangle, tone: (stockData.totals?.low_stock_count > 0) ? T.orange : T.green },
                { label: 'Negative Stock', value: stockData.totals?.negative_stock_count || 0, icon: AlertTriangle, tone: (stockData.totals?.negative_stock_count > 0) ? T.orangeDeep : T.green },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <IronCard key={s.label} pad={14}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                        <Icon size={18} color={s.tone} strokeWidth={1.9} />
                      </div>
                      <div>
                        <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{nf(s.value)}</div>
                        <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                      </div>
                    </div>
                  </IronCard>
                );
              })}
            </div>

            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900, marginBottom: 10 }}>Stock by Firm</div>
            {loading ? loadingBlock : tableWrap(
              <>
                {headerRow([
                  { label: 'Firm' }, { label: 'GSTIN' }, { label: 'Raw Materials', right: true },
                  { label: 'RM Qty', right: true }, { label: 'Finished Goods', right: true },
                  { label: 'FG Qty', right: true }, { label: 'Low Stock Items' }
                ])}
                <tbody>
                  {stockData.firms_summary?.map((firm) => (
                    <tr key={firm.firm_id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, fontWeight: 600, color: T.iron900 }}>{firm.firm_name}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{firm.gstin}</td>
                      <td style={{ ...tdCell, textAlign: 'right', color: T.iron700 }}>{firm.raw_materials_count}</td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.blue }}>{firm.raw_materials_qty}</td>
                      <td style={{ ...tdCell, textAlign: 'right', color: T.iron700 }}>{firm.finished_goods_count}</td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.blue }}>{firm.finished_goods_qty}</td>
                      <td style={tdCell}>
                        {firm.low_stock_items?.length > 0 ? (
                          <span style={{ color: T.orange, fontSize: 12 }}>{firm.low_stock_items.slice(0, 3).join(', ')}{firm.low_stock_items.length > 3 ? '...' : ''}</span>
                        ) : (
                          <span style={{ color: T.green, fontSize: 12 }}>None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </div>
        )}

        {/* Transfers Tab */}
        {activeTab === 'transfers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>Transfer Report</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: T.iron500 }}>Total Transfers: <b style={mono}>{nf(transferData.totals?.total_transfers)}</b></span>
                <span style={{ color: T.blue }}>Total Qty: <b style={mono}>{nf(transferData.totals?.total_quantity)}</b></span>
              </div>
            </div>
            {loading ? loadingBlock
              : transferData.transfers?.length === 0 ? emptyBlock('No transfers found')
              : tableWrap(
                <>
                  {headerRow([
                    { label: 'Transfer #' }, { label: 'Date' }, { label: 'Item' }, { label: 'From' },
                    { label: 'To' }, { label: 'Qty', right: true }, { label: 'Invoice' }, { label: 'By' }
                  ])}
                  <tbody>
                    {transferData.transfers.map((t) => (
                      <tr key={t.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.orangeDeep, fontWeight: 700 }}>{t.transfer_number}</td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{t.created_at?.slice(0, 10)}</td>
                        <td style={tdCell}>
                          <div style={{ fontSize: 12.5, color: T.iron900 }}>{t.item_name}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{t.item_sku}</div>
                        </td>
                        <td style={{ ...tdCell, color: T.orangeDeep }}>{t.from_firm_name}</td>
                        <td style={{ ...tdCell, color: T.green }}>{t.to_firm_name}</td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.iron900 }}>{t.quantity}</td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.blue }}>{t.invoice_number}</td>
                        <td style={{ ...tdCell, fontSize: 11, color: T.iron500 }}>{t.created_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
          </div>
        )}

        {/* Dispatch & Returns Tab */}
        {activeTab === 'dispatch_return' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>Dispatch &amp; Return Report</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: '#6D4AB0' }}>Dispatched: <b style={mono}>{nf(dispatchReturnData.totals?.total_dispatched)}</b></span>
                <span style={{ color: T.green }}>Returned: <b style={mono}>{nf(dispatchReturnData.totals?.total_returned)}</b></span>
                <span style={{ color: T.iron900 }}>Net Out: <b style={mono}>{nf(dispatchReturnData.totals?.net_out)}</b></span>
              </div>
            </div>
            {loading ? loadingBlock : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, padding: 14 }}>
                {/* Dispatches */}
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>
                    <TrendingDown size={15} color="#6D4AB0" />
                    Dispatches ({dispatchReturnData.totals?.dispatch_count || 0})
                  </div>
                  {tableWrap(
                    <>
                      {headerRow([{ label: 'Entry' }, { label: 'Item' }, { label: 'Qty', right: true }, { label: 'Date' }])}
                      <tbody>
                        {dispatchReturnData.dispatches?.map((e) => (
                          <tr key={e.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                            <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.orangeDeep, fontWeight: 700 }}>{e.entry_number}</td>
                            <td style={{ ...tdCell, color: T.iron700 }}>{e.item_sku}</td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.orangeDeep }}>-{e.quantity}</td>
                            <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{e.created_at?.slice(0, 10)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>, 400
                  )}
                </div>

                {/* Returns */}
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>
                    <TrendingUp size={15} color={T.green} />
                    Returns ({dispatchReturnData.totals?.return_count || 0})
                  </div>
                  {tableWrap(
                    <>
                      {headerRow([{ label: 'Entry' }, { label: 'Item' }, { label: 'Qty', right: true }, { label: 'Date' }])}
                      <tbody>
                        {dispatchReturnData.returns?.map((e) => (
                          <tr key={e.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                            <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.orangeDeep, fontWeight: 700 }}>{e.entry_number}</td>
                            <td style={{ ...tdCell, color: T.iron700 }}>{e.item_sku}</td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.green }}>+{e.quantity}</td>
                            <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{e.created_at?.slice(0, 10)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>, 400
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Adjustments Tab */}
        {activeTab === 'adjustments' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>Adjustments &amp; Repair Yard Report</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: T.blue }}>Adj In: <b style={mono}>{nf(adjustmentData.totals?.adjustment_in_qty)}</b></span>
                <span style={{ color: T.orangeDeep }}>Adj Out: <b style={mono}>{nf(adjustmentData.totals?.adjustment_out_qty)}</b></span>
                <span style={{ color: T.voltageText }}>Repair Yard: <b style={mono}>{nf(adjustmentData.totals?.repair_yard_qty)}</b></span>
              </div>
            </div>
            {loading ? loadingBlock
              : adjustmentData.all_entries?.length === 0 ? emptyBlock('No adjustments found')
              : tableWrap(
                <>
                  {headerRow([
                    { label: 'Entry #' }, { label: 'Date' }, { label: 'Type' }, { label: 'Item' },
                    { label: 'Firm' }, { label: 'Qty', right: true }, { label: 'Reason' }, { label: 'By' }
                  ])}
                  <tbody>
                    {adjustmentData.all_entries.map((e) => (
                      <tr key={e.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.orangeDeep, fontWeight: 700 }}>{e.entry_number}</td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{e.created_at?.slice(0, 10)}</td>
                        <td style={tdCell}><span style={badgeStyle(ENTRY_TYPE_TONE[e.entry_type] || 'slate')}>{ENTRY_TYPE_LABELS[e.entry_type]}</span></td>
                        <td style={tdCell}>
                          <div style={{ fontSize: 12.5, color: T.iron900 }}>{e.item_name}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{e.item_sku}</div>
                        </td>
                        <td style={{ ...tdCell, color: T.iron700 }}>{e.firm_name}</td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: e.entry_type === 'adjustment_out' ? T.orangeDeep : T.green }}>
                          {e.entry_type === 'adjustment_out' ? '-' : '+'}{e.quantity}
                        </td>
                        <td style={{ ...tdCell, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.iron700 }} title={e.reason || ''}>{e.reason || '-'}</td>
                        <td style={{ ...tdCell, fontSize: 11, color: T.iron500 }}>{e.created_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
          </div>
        )}
      </IronCard>
    </IronShell>
  );
}

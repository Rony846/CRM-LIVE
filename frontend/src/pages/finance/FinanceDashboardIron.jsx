import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import {
  Building2, TrendingUp, AlertTriangle,
  FileText, Download, RefreshCw, ChevronRight, Package,
  ArrowRightLeft, Receipt, Calculator, Loader2,
  Info, ArrowLeft, Bot,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // default to the CURRENT month
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 7);
  });
  const [firmSummary, setFirmSummary] = useState(null);
  const [inventoryValuation, setInventoryValuation] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [itcDialogOpen, setItcDialogOpen] = useState(false);
  const [financeAgentRunning, setFinanceAgentRunning] = useState(false);

  // Calculate the latest month for which ITC can be entered
  // ITC for a month is only available after 15th of the following month
  const getAvailableITCMonth = () => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    if (currentDay >= 15) {
      // After 15th - can enter ITC for previous month
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
    } else {
      // Before 15th - can only enter ITC for month before previous
      const targetMonth = currentMonth <= 1 ? (currentMonth + 10) : currentMonth - 2;
      const targetYear = currentMonth <= 1 ? currentYear - 1 : currentYear;
      return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    }
  };

  const [itcForm, setItcForm] = useState({
    firm_id: '',
    month: getAvailableITCMonth(),
    igst_balance: 0,
    cgst_balance: 0,
    sgst_balance: 0,
    notes: '',
  });
  const [auditLogs, setAuditLogs] = useState([]);

  const { token } = useAuth();

  useEffect(() => {
    if (token) fetchFirms();
  }, [token]);

  // Re-fetch the dashboard whenever the selected GST period changes.
  useEffect(() => {
    if (token) fetchDashboard(selectedMonth);
  }, [token, selectedMonth]);

  useEffect(() => {
    if (activeTab === 'inventory') {
      fetchInventoryValuation();
    } else if (activeTab === 'transfers') {
      fetchRecommendations();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedFirm && selectedFirm !== 'all') {
      fetchFirmSummary(selectedFirm, selectedMonth);
    }
  }, [selectedFirm, selectedMonth]);

  const fetchDashboard = async (mth = selectedMonth) => {
    try {
      const response = await axios.get(`${API}/finance/dashboard?month=${mth}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDashboard(response.data);
    } catch (error) {
      toast.error('Failed to load finance dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchFirms = async () => {
    try {
      const response = await axios.get(`${API}/firms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFirms(response.data);
    } catch (error) {
      console.error('Failed to load firms');
    }
  };

  const fetchFirmSummary = async (firmId, month) => {
    try {
      const response = await axios.get(`${API}/finance/firm/${firmId}/summary?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFirmSummary(response.data);
    } catch (error) {
      toast.error('Failed to load firm summary');
    }
  };

  const fetchInventoryValuation = async () => {
    try {
      const url = selectedFirm !== 'all'
        ? `${API}/finance/inventory-valuation?firm_id=${selectedFirm}`
        : `${API}/finance/inventory-valuation`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInventoryValuation(response.data);
    } catch (error) {
      toast.error('Failed to load inventory valuation');
    }
  };

  const fetchRecommendations = async () => {
    try {
      const response = await axios.get(`${API}/finance/transfer-recommendations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecommendations(response.data.recommendations || []);
    } catch (error) {
      toast.error('Failed to load transfer recommendations');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const response = await axios.get(`${API}/finance/audit-logs?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAuditLogs(response.data.logs || []);
    } catch (error) {
      toast.error('Failed to load audit logs');
    }
  };

  const handleSaveITC = async () => {
    try {
      await axios.post(`${API}/finance/gst-itc`, itcForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('ITC balance saved successfully');
      setItcDialogOpen(false);
      fetchDashboard();
      if (selectedFirm && selectedFirm !== 'all') {
        fetchFirmSummary(selectedFirm, selectedMonth);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save ITC balance');
    }
  };

  // Manually trigger the daily Amazon-finance agent. Same code path as the
  // 08:00 IST scheduler — books unposted fees + refunds, counts unmatched.
  // Idempotent; safe to spam-click.
  const handleRunFinanceAgent = async () => {
    if (financeAgentRunning) return;
    setFinanceAgentRunning(true);
    try {
      const params = (selectedFirm && selectedFirm !== 'all') ? `?firm_id=${selectedFirm}` : '';
      const res = await axios.post(`${API}/finance/run-daily-agent${params}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const t = res.data?.totals || {};
      const bits = [];
      if (t.fees_total_amount > 0) bits.push(`₹${t.fees_total_amount.toLocaleString('en-IN')} fees`);
      if (t.refunds_posted > 0) bits.push(`${t.refunds_posted} refunds`);
      if (t.unmatched_transactions > 0) bits.push(`${t.unmatched_transactions} unmatched`);
      const summary = bits.length ? bits.join(' · ') : 'nothing new to post';
      toast.success(`Finance agent: ${summary} (${res.data?.firms_run || 0} firm${res.data?.firms_run === 1 ? '' : 's'})`);
      // Re-pull the dashboard so the new journal entries show up
      await fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Finance agent run failed.');
    } finally {
      setFinanceAgentRunning(false);
    }
  };

  const handleExport = async (reportType) => {
    try {
      let url = `${API}/finance/export/${reportType}`;
      if (selectedFirm && selectedFirm !== 'all') {
        url += `?firm_id=${selectedFirm}`;
      }
      if (selectedMonth && reportType === 'month-end') {
        url += url.includes('?') ? `&month=${selectedMonth}` : `?month=${selectedMonth}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  // ------- KPI stat tiles -------
  const statCards = [
    { label: 'Total Inventory Value', value: formatCurrency(dashboard?.total_inventory_value), sub: `${dashboard?.total_firms || 0} firms`, icon: Package, tone: T.blue },
    { label: 'Est. GST Liability', value: formatCurrency(dashboard?.total_gst_liability), sub: `Month: ${dashboard?.current_month || '-'}`, icon: Receipt, tone: T.orange },
    { label: 'Pending Invoices', value: (dashboard?.pending_invoice_entries || 0).toLocaleString('en-IN'), sub: 'Need invoice value', icon: FileText, tone: T.orangeDeep },
    { label: 'Active Firms', value: (dashboard?.total_firms || 0).toLocaleString('en-IN'), sub: 'With inventory', icon: Building2, tone: T.green },
  ];

  const TABS = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'inventory', label: 'Inventory Valuation', icon: Package },
    { key: 'gst', label: 'GST Planning', icon: Receipt },
    { key: 'transfers', label: 'Transfers', icon: ArrowRightLeft },
    { key: 'audit', label: 'Audit Trail', icon: FileText },
  ];

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => navigate(-1)} data-testid="back-btn" title="Back" style={outlineBtn}>
        <ArrowLeft size={14} /> Back
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Caps size={8.5} color={T.iron400}>GST Period</Caps>
        <input
          id="gst-period"
          type="month"
          value={selectedMonth}
          max={new Date().toISOString().slice(0, 7)}
          onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
          data-testid="dashboard-month-picker"
        />
      </div>
      <button onClick={() => setItcDialogOpen(true)} data-testid="enter-itc-btn" style={outlineBtn}>
        <Calculator size={14} /> Enter ITC Balance
      </button>
      <button
        onClick={handleRunFinanceAgent}
        disabled={financeAgentRunning}
        title={
          selectedFirm && selectedFirm !== 'all'
            ? 'Run the Amazon finance agent for the selected firm now (books fees + refunds, flags unmatched)'
            : 'Run the Amazon finance agent for ALL firms now (books fees + refunds, flags unmatched)'
        }
        data-testid="run-finance-agent-btn"
        style={{ ...outlineBtn, opacity: financeAgentRunning ? 0.6 : 1, cursor: financeAgentRunning ? 'default' : 'pointer' }}
      >
        {financeAgentRunning ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
        {financeAgentRunning ? 'Running…' : 'Run Finance Agent'}
      </button>
    </div>
  );

  return (
    <IronShell
      title="Finance & GST"
      subtitle="LIVE · ALL FIRMS"
      onRefresh={() => fetchDashboard()}
      headerRight={headerRight}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <div data-testid="finance-dashboard">
          {/* Alerts */}
          {dashboard?.alerts?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {dashboard.alerts.map((alert, i) => {
                const warn = alert.type === 'warning';
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8,
                    background: warn ? T.voltageTint : T.blueTint,
                    border: `1px solid ${warn ? '#EDDFA6' : '#CBE0F0'}`,
                    color: warn ? T.voltageText : T.blue,
                  }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5 }}>{alert.message}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      <Caps size={9} color={T.iron400}>{s.label}</Caps>
                      <div style={{ ...mono, fontSize: 26, fontWeight: 700, color: T.iron900, lineHeight: 1.1, marginTop: 6 }}>{s.value}</div>
                      <Caps size={8.5} color={T.iron500} ls=".05em" style={{ display: 'block', marginTop: 4 }}>{s.sub}</Caps>
                    </div>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}`, flexShrink: 0 }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {TABS.map((tb) => {
              const Icon = tb.icon;
              const on = activeTab === tb.key;
              return (
                <button key={tb.key} data-testid={`${tb.key}-tab`} onClick={() => setActiveTab(tb.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${on ? T.iron900 : T.iron200}`, background: on ? T.iron900 : T.white, color: on ? '#fff' : T.iron700, borderRadius: 999, padding: '7px 15px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12 }}>
                  <Icon size={14} />{tb.label}
                </button>
              );
            })}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {(dashboard?.firm_summaries || []).map((firm) => {
                const Row = ({ label, value, color }) => (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Caps size={9} color={T.iron400}>{label}</Caps>
                    <span style={{ ...mono, fontWeight: 600, fontSize: 12.5, color: color || T.iron900 }}>{value}</span>
                  </div>
                );
                return (
                  <IronCard key={firm.firm_id} pad={16}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14.5, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firm.firm_name}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.iron400, marginTop: 2 }}>{firm.gstin}</div>
                      </div>
                      <button
                        onClick={() => { setSelectedFirm(firm.firm_id); setActiveTab('gst'); }}
                        style={{ border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, height: 28, width: 28, display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.iron700, flexShrink: 0 }}
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <Row label="Inventory Value" value={formatCurrency(firm.inventory_value)} />
                      <Row label="Monthly Sales" value={formatCurrency(firm.monthly_sales)} color={T.green} />
                      <Row label="Output GST" value={formatCurrency(firm.output_gst)} />
                      <Row label="ITC Balance" value={formatCurrency(firm.itc_balance)} color={T.orange} />
                      <div style={{ borderTop: `1px solid ${T.iron200}`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Caps size={9} color={T.iron700}>Net GST Payable</Caps>
                        <span style={{ ...mono, fontWeight: 700, fontSize: 13, color: firm.net_gst_payable > 0 ? T.orangeDeep : T.green }}>
                          {formatCurrency(firm.net_gst_payable)}
                        </span>
                      </div>
                    </div>
                  </IronCard>
                );
              })}
            </div>
          )}

          {/* Inventory Valuation Tab */}
          {activeTab === 'inventory' && (
            <IronCard pad={0}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${T.iron200}` }}>
                <div>
                  <Caps size={11} color={T.iron900} ls=".1em">Inventory Valuation (WAC Method)</Caps>
                  <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginTop: 3 }}>Weighted Average Cost valuation for all inventory items</Caps>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={selectedFirm}
                    onChange={(e) => { setSelectedFirm(e.target.value); fetchInventoryValuation(); }}
                    style={{ ...inputStyle, cursor: 'pointer', width: 200 }}
                  >
                    <option value="all">All Firms</option>
                    {firms.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <button onClick={() => handleExport('inventory')} style={outlineBtn}>
                    <Download size={14} /> Export CSV
                  </button>
                </div>
              </div>
              <div style={{ padding: 16 }}>
                {(inventoryValuation?.firms || []).map((firm) => (
                  <div key={firm.firm_id} style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: 12, background: T.iron50, borderRadius: 8, border: `1px solid ${T.iron200}` }}>
                      <div>
                        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900 }}>{firm.firm_name}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{firm.gstin}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Caps size={8.5} color={T.iron400}>Total Value</Caps>
                        <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.orange }}>{formatCurrency(firm.total_value)}</div>
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto', border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                            {['SKU Code', 'Item Name', 'HSN', 'GST %', 'Qty', 'WAC', 'Value'].map((h, i) => (
                              <th key={h} style={{ ...thCell, textAlign: i >= 4 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(firm.items || []).slice(0, 20).map((item) => (
                            <tr key={item.item_id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                              <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{item.sku_code}</td>
                              <td style={{ ...tdCell, color: T.iron900 }}>{item.item_name}</td>
                              <td style={{ ...tdCell, ...mono, color: T.iron500 }}>{item.hsn_code || '-'}</td>
                              <td style={{ ...tdCell, ...mono, color: T.iron500 }}>{item.gst_rate}%</td>
                              <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>{item.quantity}</td>
                              <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron500 }}>{formatCurrency(item.wac)}</td>
                              <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.iron900 }}>{formatCurrency(item.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {firm.items?.length > 20 && (
                      <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginTop: 8, textAlign: 'center' }}>
                        Showing top 20 items. Export CSV for full list.
                      </Caps>
                    )}
                  </div>
                ))}
                {inventoryValuation && (
                  <div style={{ marginTop: 8, padding: 16, background: '#FDEEE6', borderRadius: 8, border: '1px solid #F6D8BA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900 }}>Grand Total (All Firms)</span>
                    <span style={{ ...mono, fontSize: 24, fontWeight: 700, color: T.orangeDeep }}>{formatCurrency(inventoryValuation.grand_total)}</span>
                  </div>
                )}
              </div>
            </IronCard>
          )}

          {/* GST Planning Tab */}
          {activeTab === 'gst' && (
            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
              <IronCard pad={16}>
                <Caps size={11} color={T.iron900} ls=".1em">Select Firm & Month</Caps>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                  <div>
                    <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 5 }}>Firm</Caps>
                    <select value={selectedFirm} onChange={(e) => setSelectedFirm(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', width: '100%' }}>
                      <option value="all" disabled>Select Firm</option>
                      {firms.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 5 }}>Month</Caps>
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }} />
                  </div>
                  <button
                    onClick={() => handleExport('month-end')}
                    disabled={!selectedFirm || selectedFirm === 'all'}
                    style={{ ...primaryBtn, width: '100%', justifyContent: 'center', opacity: (!selectedFirm || selectedFirm === 'all') ? 0.5 : 1, cursor: (!selectedFirm || selectedFirm === 'all') ? 'default' : 'pointer' }}
                  >
                    <Download size={14} /> Export Month-End Report
                  </button>
                </div>
              </IronCard>

              <IronCard pad={16}>
                <Caps size={11} color={T.iron900} ls=".1em">
                  {firmSummary ? `${firmSummary.firm.name} — ${firmSummary.month}` : 'Select a firm to view details'}
                </Caps>
                {firmSummary ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
                    {/* Sales & Purchases */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ padding: 14, background: T.greenTint, borderRadius: 8, border: '1px solid #CBE5D6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Caps size={9} color={T.green}>Sales</Caps>
                          {firmSummary.sales.provisional && (
                            <span style={{ fontSize: 8.5, fontWeight: 800, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 5px', letterSpacing: 0.3 }}>LIVE · PROVISIONAL</span>
                          )}
                        </div>
                        <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.green, marginTop: 4 }}>{formatCurrency(firmSummary.sales.total_value)}</div>
                        <Caps size={8} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{firmSummary.sales.count} {firmSummary.sales.provisional ? 'live orders' : 'dispatches'}</Caps>
                        {firmSummary.sales.provisional && (
                          <div style={{ fontSize: 9, color: '#92400e', marginTop: 3 }}>Live marketplace orders — finalizes when this month's MTR is imported.</div>
                        )}
                      </div>
                      <div style={{ padding: 14, background: '#FDEEE6', borderRadius: 8, border: '1px solid #F6D8BA' }}>
                        <Caps size={9} color={T.orangeDeep}>Purchases</Caps>
                        <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.orangeDeep, marginTop: 4 }}>{formatCurrency(firmSummary.purchases.value)}</div>
                        <Caps size={8} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{firmSummary.purchases.count} entries</Caps>
                      </div>
                    </div>

                    {/* GST Breakup */}
                    <div>
                      <Caps size={10} color={T.iron900} ls=".08em" style={{ display: 'block', marginBottom: 8 }}>GST Breakup by Rate</Caps>
                      <div style={{ overflowX: 'auto', border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                              {['Rate', 'Taxable Value', 'GST Amount', 'Count'].map((h, i) => (
                                <th key={h} style={{ ...thCell, textAlign: i === 0 ? 'left' : 'right' }}><Caps size={8.5}>{h}</Caps></th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(firmSummary.sales.gst_by_rate || {}).map(([rate, data]) => (
                              <tr key={rate} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                                <td style={{ ...tdCell, ...mono }}>{rate}%</td>
                                <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>{formatCurrency(data.taxable)}</td>
                                <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>{formatCurrency(data.gst)}</td>
                                <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>{data.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Output & Input GST */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ padding: 14, background: T.voltageTint, borderRadius: 8, border: '1px solid #EDDFA6' }}>
                        <Caps size={9} color={T.voltageText}>Output GST (Liability)</Caps>
                        <div style={{ ...mono, fontSize: 19, fontWeight: 700, color: T.voltageText, marginTop: 4 }}>{formatCurrency(firmSummary.gst.output_gst)}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.iron500, marginTop: 4 }}>
                          IGST: {formatCurrency(firmSummary.gst.output_igst || 0)} | CGST: {formatCurrency(firmSummary.gst.output_cgst || 0)} | SGST: {formatCurrency(firmSummary.gst.output_sgst || 0)}
                        </div>
                      </div>
                      <div style={{ padding: 14, background: T.greenTint, borderRadius: 8, border: '1px solid #CBE5D6' }}>
                        <Caps size={9} color={T.green}>Input GST (From Purchases)</Caps>
                        <div style={{ ...mono, fontSize: 19, fontWeight: 700, color: T.green, marginTop: 4 }}>{formatCurrency(firmSummary.gst.input_gst || firmSummary.purchases?.input_gst || 0)}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.iron500, marginTop: 4 }}>
                          IGST: {formatCurrency(firmSummary.gst.input_igst || 0)} | CGST: {formatCurrency(firmSummary.gst.input_cgst || 0)} | SGST: {formatCurrency(firmSummary.gst.input_sgst || 0)}
                        </div>
                      </div>
                    </div>

                    {/* ITC & Net */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ padding: 14, background: '#FDEEE6', borderRadius: 8, border: '1px solid #F6D8BA' }}>
                        <Caps size={9} color={T.orangeDeep}>ITC Balance (Carry Forward)</Caps>
                        <div style={{ ...mono, fontSize: 19, fontWeight: 700, color: T.orangeDeep, marginTop: 4 }}>{formatCurrency(firmSummary.gst.itc_balance.total)}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.iron500, marginTop: 4 }}>
                          IGST: {formatCurrency(firmSummary.gst.itc_balance.igst)} | CGST: {formatCurrency(firmSummary.gst.itc_balance.cgst)} | SGST: {formatCurrency(firmSummary.gst.itc_balance.sgst)}
                        </div>
                      </div>
                      <div style={{ padding: 14, borderRadius: 8, background: firmSummary.gst.net_payable > 0 ? '#FDEEE6' : T.greenTint, border: `1px solid ${firmSummary.gst.net_payable > 0 ? '#F6D8BA' : '#CBE5D6'}` }}>
                        <Caps size={9} color={firmSummary.gst.net_payable > 0 ? T.orangeDeep : T.green}>Net GST Payable</Caps>
                        <div style={{ ...mono, fontSize: 19, fontWeight: 700, marginTop: 4, color: firmSummary.gst.net_payable > 0 ? T.orangeDeep : T.green }}>
                          {formatCurrency(firmSummary.gst.net_payable)}
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.iron500, marginTop: 4 }}>Output - Input - ITC Balance</div>
                      </div>
                    </div>

                    {/* Other Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      {[['Production', firmSummary.production.value], ['Transfers In', firmSummary.transfers.in.value], ['Returns', firmSummary.returns.value]].map(([lbl, val]) => (
                        <div key={lbl} style={{ padding: 12, background: T.iron50, borderRadius: 8, border: `1px solid ${T.iron200}` }}>
                          <Caps size={9} color={T.iron400}>{lbl}</Caps>
                          <div style={{ ...mono, fontWeight: 700, fontSize: 14, color: T.iron900, marginTop: 4 }}>{formatCurrency(val)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
                    <Calculator size={44} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <div style={{ fontSize: 13 }}>Select a firm to view GST planning details</div>
                  </div>
                )}
              </IronCard>
            </div>
          )}

          {/* Transfer Recommendations Tab */}
          {activeTab === 'transfers' && (
            <IronCard pad={0}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${T.iron200}` }}>
                <div>
                  <Caps size={11} color={T.iron900} ls=".1em">Transfer Recommendations</Caps>
                  <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginTop: 3 }}>Smart suggestions based on stock levels, sales velocity, and ITC balance</Caps>
                </div>
                <button onClick={fetchRecommendations} style={outlineBtn}>
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
              <div style={{ padding: 16 }}>
                {recommendations.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {recommendations.map((rec, i) => {
                      const high = rec.priority === 'high';
                      return (
                        <div key={i} style={{ padding: 14, borderRadius: 8, border: `1px solid ${high ? '#F6D8BA' : T.iron200}`, background: high ? '#FDEEE6' : T.iron50 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                <span style={badgeStyle(high ? 'bad' : 'slate')}>{rec.priority}</span>
                                <span style={{ ...mono, fontWeight: 700, fontSize: 12.5, color: T.iron900 }}>{rec.sku_code}</span>
                                <span style={{ fontSize: 12, color: T.iron500 }}>— {rec.sku_name}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.iron500 }}>
                                  <Building2 size={14} />
                                  <span style={{ color: T.iron900 }}>{rec.from_firm.name}</span>
                                  <span style={{ ...mono, fontSize: 11 }}>({rec.from_firm.current_stock} units)</span>
                                </div>
                                <ArrowRightLeft size={14} color={T.orange} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.iron500 }}>
                                  <Building2 size={14} />
                                  <span style={{ color: T.iron900 }}>{rec.to_firm.name}</span>
                                  <span style={{ ...mono, fontSize: 11 }}>({rec.to_firm.current_stock} units)</span>
                                </div>
                              </div>
                              <div style={{ fontSize: 12, color: T.iron500, marginTop: 8 }}>{rec.reason}</div>
                              {rec.itc_advisory && (
                                <div style={{ fontSize: 11, color: T.orange, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Info size={12} /> {rec.itc_advisory}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <Caps size={8.5} color={T.iron400}>Rec. Qty</Caps>
                              <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.orange }}>{rec.recommended_qty}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
                    <ArrowRightLeft size={44} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <div style={{ fontSize: 13, color: T.iron700 }}>No transfer recommendations at this time</div>
                    <div style={{ fontSize: 12, marginTop: 3 }}>Stock levels are balanced across firms</div>
                  </div>
                )}
              </div>
            </IronCard>
          )}

          {/* Audit Trail Tab */}
          {activeTab === 'audit' && (
            <IronCard pad={0}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${T.iron200}` }}>
                <div>
                  <Caps size={11} color={T.iron900} ls=".1em">Financial Audit Trail</Caps>
                  <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginTop: 3 }}>All financial actions are logged for audit purposes</Caps>
                </div>
                <button onClick={fetchAuditLogs} style={outlineBtn}>
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
              {auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: T.iron400 }}>
                  <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <div style={{ fontSize: 13 }}>No audit logs found</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                        {['Timestamp', 'Action', 'Entity', 'User', 'Details'].map((h) => (
                          <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                          <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{new Date(log.timestamp).toLocaleString()}</td>
                          <td style={tdCell}><span style={badgeStyle('slate')}>{log.action}</span></td>
                          <td style={{ ...tdCell, ...mono, color: T.iron500 }}>{log.entity_type}</td>
                          <td style={{ ...tdCell, color: T.iron900 }}>{log.user_name}</td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron400, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {JSON.stringify(log.details).slice(0, 100)}...
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </IronCard>
          )}
        </div>
      )}

      {/* ITC Entry Dialog (kept as shadcn) */}
      <Dialog open={itcDialogOpen} onOpenChange={setItcDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter GST ITC Balance</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              ITC balance is available after GST returns are filed (15th of following month)
            </p>
          </DialogHeader>
          <div className="space-y-4">
            {/* Info banner */}
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/25">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm text-foreground">
                  <p className="font-medium">How ITC entry works:</p>
                  <p className="mt-1 text-muted-foreground">
                    Today is <strong>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                    {new Date().getDate() >= 15 ? (
                      <> Since it's after 15th, you can enter ITC for <strong>{new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong> (previous month).</>
                    ) : (
                      <> Since it's before 15th, you can enter ITC for <strong>{new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong> or earlier.</>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label>Firm</Label>
              <Select value={itcForm.firm_id} onValueChange={(v) => setItcForm({ ...itcForm, firm_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Firm" />
                </SelectTrigger>
                <SelectContent>
                  {firms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Month (ITC for this month)</Label>
              <Input
                type="month"
                value={itcForm.month}
                max={getAvailableITCMonth()}
                onChange={(e) => setItcForm({ ...itcForm, month: e.target.value })}
              />
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                Latest available: {new Date(getAvailableITCMonth() + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>IGST Balance</Label>
                <Input
                  type="number"
                  value={itcForm.igst_balance}
                  onChange={(e) => setItcForm({ ...itcForm, igst_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>CGST Balance</Label>
                <Input
                  type="number"
                  value={itcForm.cgst_balance}
                  onChange={(e) => setItcForm({ ...itcForm, cgst_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>SGST Balance</Label>
                <Input
                  type="number"
                  value={itcForm.sgst_balance}
                  onChange={(e) => setItcForm({ ...itcForm, sgst_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={itcForm.notes}
                onChange={(e) => setItcForm({ ...itcForm, notes: e.target.value })}
                placeholder="Any notes about this ITC entry..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItcDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveITC} disabled={!itcForm.firm_id}>Save ITC Balance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

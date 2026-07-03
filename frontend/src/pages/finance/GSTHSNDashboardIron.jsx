import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Download, AlertTriangle, CheckCircle2,
  IndianRupee, Package, Map, Loader2,
  Search, ChevronRight, Edit3, AlertCircle,
  TrendingUp, TrendingDown, BarChart3
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell } from '@/components/iron/IronKit';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const formatNumber = (num) => {
  return new Intl.NumberFormat('en-IN').format(num || 0);
};

// Indian states list
const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
  "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

// Iron KPI tile
const KpiTile = ({ label, value, sub, icon: Icon, tone }) => (
  <IronCard pad={14}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
      <Caps size={9} color={T.iron400}>{label}</Caps>
      <div style={{ width: 34, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
        <Icon size={16} color={tone} strokeWidth={1.9} />
      </div>
    </div>
    <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: tone, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ ...mono, fontSize: 10, color: T.iron400, marginTop: 7, textTransform: 'uppercase', letterSpacing: '.04em' }}>{sub}</div>}
  </IronCard>
);

export default function GSTHSNDashboard() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');

  // Data states
  const [hsnSummary, setHsnSummary] = useState([]);
  const [stateWiseData, setStateWiseData] = useState([]);
  const [missingDataAlerts, setMissingDataAlerts] = useState([]);
  const [purchaseVsSales, setPurchaseVsSales] = useState([]);
  const [availableHsnCodes, setAvailableHsnCodes] = useState([]);

  // Filter states
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [selectedHSN, setSelectedHSN] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownData, setDrilldownData] = useState(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionRecord, setCorrectionRecord] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({
    hsn_code: '',
    gst_rate: '',
    state: '',
    reason: ''
  });
  const [actionLoading, setActionLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, alertsRes, hsnCodesRes] = await Promise.all([
        axios.get(`${API}/gst/hsn-summary`, {
          headers,
          params: { from_date: dateRange.from, to_date: dateRange.to }
        }),
        axios.get(`${API}/gst/missing-data-alerts`, { headers }),
        axios.get(`${API}/gst/hsn-codes`, { headers })
      ]);

      setHsnSummary(summaryRes.data.hsn_summary || []);
      setStateWiseData(summaryRes.data.state_wise || []);
      setPurchaseVsSales(summaryRes.data.purchase_vs_sales || []);
      setMissingDataAlerts(alertsRes.data || []);
      setAvailableHsnCodes(hsnCodesRes.data || []);
    } catch (error) {
      console.error('Error fetching GST HSN data:', error);
      toast.error('Failed to load GST HSN data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const handleDrilldown = async (hsn) => {
    try {
      const res = await axios.get(`${API}/gst/hsn-drilldown/${hsn}`, {
        headers,
        params: { from_date: dateRange.from, to_date: dateRange.to }
      });
      setDrilldownData(res.data);
      setSelectedHSN(hsn);
      setDrilldownOpen(true);
    } catch (error) {
      console.error('Error fetching drilldown:', error);
      toast.error('Failed to fetch state-wise details');
    }
  };

  const handleOpenCorrection = (record) => {
    setCorrectionRecord(record);
    setCorrectionForm({
      hsn_code: record.hsn_code || '',
      gst_rate: record.gst_rate?.toString() || '',
      state: record.state || '',
      reason: ''
    });
    setCorrectionOpen(true);
  };

  const handleSaveCorrection = async () => {
    if (!correctionForm.reason) {
      toast.error('Please provide a reason for the correction');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/gst/correct-record`, {
        record_type: correctionRecord.record_type,
        record_id: correctionRecord.record_id,
        corrections: {
          hsn_code: correctionForm.hsn_code || null,
          gst_rate: correctionForm.gst_rate ? parseFloat(correctionForm.gst_rate) : null,
          state: correctionForm.state || null
        },
        reason: correctionForm.reason
      }, { headers });

      toast.success('Correction saved successfully');
      setCorrectionOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving correction:', error);
      // Handle different error formats
      let errorMsg = 'Failed to save correction';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        // Handle FastAPI validation error array
        if (Array.isArray(detail)) {
          errorMsg = detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
        } else if (typeof detail === 'string') {
          errorMsg = detail;
        } else if (typeof detail === 'object') {
          errorMsg = detail.msg || detail.message || JSON.stringify(detail);
        }
      }
      toast.error(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async (type) => {
    try {
      const res = await axios.get(`${API}/gst/export/${type}`, {
        headers,
        params: { from_date: dateRange.from, to_date: dateRange.to },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GST_${type}_${dateRange.from}_to_${dateRange.to}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`${type} export downloaded`);
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Failed to export data');
    }
  };

  // Calculate totals
  const totals = {
    salesValue: hsnSummary.reduce((sum, h) => sum + (h.sales_taxable || 0), 0),
    salesCGST: hsnSummary.reduce((sum, h) => sum + (h.sales_cgst || 0), 0),
    salesSGST: hsnSummary.reduce((sum, h) => sum + (h.sales_sgst || 0), 0),
    salesIGST: hsnSummary.reduce((sum, h) => sum + (h.sales_igst || 0), 0),
    purchaseValue: hsnSummary.reduce((sum, h) => sum + (h.purchase_taxable || 0), 0),
    alertCount: missingDataAlerts.length
  };
  totals.totalGST = totals.salesCGST + totals.salesSGST + totals.salesIGST;

  const filteredHsnSummary = hsnSummary.filter(h => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        h.hsn_code?.toLowerCase().includes(query) ||
        h.product_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const tabs = [
    { key: 'summary', label: 'HSN Summary', icon: Package },
    { key: 'statewise', label: 'State-wise', icon: Map },
    { key: 'comparison', label: 'Purchase vs Sales', icon: BarChart3 },
    { key: 'alerts', label: `Alerts (${totals.alertCount})`, icon: AlertTriangle },
  ];

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '4px 8px', background: T.white }}>
        <input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
          style={{ ...inputStyle, border: 'none', padding: '3px 2px', width: 130 }} />
        <span style={{ ...mono, fontSize: 11, color: T.iron400 }}>to</span>
        <input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
          style={{ ...inputStyle, border: 'none', padding: '3px 2px', width: 130 }} />
      </div>
      <button style={btnOutline} onClick={() => handleExport('hsn-summary')}><Download size={14} />HSN Summary</button>
      <button style={btnOutline} onClick={() => handleExport('detailed')}><Download size={14} />Detailed</button>
    </div>
  );

  const thRight = { ...thCell, textAlign: 'right' };
  const tdRight = { ...tdCell, textAlign: 'right' };

  return (
    <IronShell title="GST / HSN" subtitle="HSN-WISE SALES + PURCHASE SUMMARY · GST REPORTING" onRefresh={fetchData} headerRight={headerRight}>
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* KPI tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            <KpiTile label="Taxable Sales" value={formatCurrency(totals.salesValue)} icon={TrendingUp} tone={T.green} />
            <KpiTile label="Total GST Collected" value={formatCurrency(totals.totalGST)}
              sub={`CGST ${formatCurrency(totals.salesCGST)} · SGST ${formatCurrency(totals.salesSGST)}`} icon={IndianRupee} tone={T.blue} />
            <KpiTile label="IGST" value={formatCurrency(totals.salesIGST)} sub="Inter-state sales" icon={Map} tone="#6D4AB0" />
            <KpiTile label="Taxable Purchases" value={formatCurrency(totals.purchaseValue)} icon={TrendingDown} tone={T.orange} />
            <KpiTile label="Data Alerts" value={totals.alertCount.toString()}
              sub={totals.alertCount > 0 ? 'Missing / incomplete data' : 'All data complete'}
              icon={totals.alertCount > 0 ? AlertTriangle : CheckCircle2}
              tone={totals.alertCount > 0 ? T.rose : T.green} />
          </div>

          {/* Tabs + search */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tabs.map((tb) => {
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
              <div style={{ position: 'relative' }}>
                <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search HSN or Product…"
                  style={{ ...inputStyle, paddingLeft: 30, width: 250 }} />
              </div>
            </div>

            {/* HSN Summary Tab */}
            {activeTab === 'summary' && (
              <div>
                <div style={{ maxHeight: 500, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      <th style={thCell}><Caps size={8.5}>HSN Code</Caps></th>
                      <th style={thCell}><Caps size={8.5}>Product</Caps></th>
                      <th style={thRight}><Caps size={8.5}>Qty Sold</Caps></th>
                      <th style={thRight}><Caps size={8.5}>Taxable Value</Caps></th>
                      <th style={thRight}><Caps size={8.5}>CGST</Caps></th>
                      <th style={thRight}><Caps size={8.5}>SGST</Caps></th>
                      <th style={thRight}><Caps size={8.5}>IGST</Caps></th>
                      <th style={thRight}><Caps size={8.5}>Total GST</Caps></th>
                      <th style={{ ...thCell, width: 30 }}></th>
                    </tr></thead>
                    <tbody>
                      {filteredHsnSummary.length === 0 ? (
                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 0', color: T.iron400, fontSize: 12 }}>No HSN data found for the selected period</td></tr>
                      ) : (
                        filteredHsnSummary.map((hsn, idx) => (
                          <tr key={idx} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }} onClick={() => handleDrilldown(hsn.hsn_code)}>
                            <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{hsn.hsn_code || '-'}</td>
                            <td style={{ ...tdCell, maxWidth: 200 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.iron900 }}>{hsn.product_name || '-'}</div></td>
                            <td style={{ ...tdRight, ...mono }}>{formatNumber(hsn.quantity_sold)}</td>
                            <td style={{ ...tdRight, ...mono, color: T.iron900 }}>{formatCurrency(hsn.sales_taxable)}</td>
                            <td style={{ ...tdRight, ...mono, color: T.green }}>{formatCurrency(hsn.sales_cgst)}</td>
                            <td style={{ ...tdRight, ...mono, color: T.green }}>{formatCurrency(hsn.sales_sgst)}</td>
                            <td style={{ ...tdRight, ...mono, color: '#6D4AB0' }}>{formatCurrency(hsn.sales_igst)}</td>
                            <td style={{ ...tdRight, ...mono, fontWeight: 700, color: T.iron900 }}>{formatCurrency((hsn.sales_cgst || 0) + (hsn.sales_sgst || 0) + (hsn.sales_igst || 0))}</td>
                            <td style={tdCell}><ChevronRight size={14} color={T.iron400} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Totals footer */}
                {filteredHsnSummary.length > 0 && (
                  <div style={{ margin: 14, padding: 12, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, textAlign: 'right' }}>
                      <div>
                        <Caps size={9} color={T.iron400}>Total Taxable</Caps>
                        <div style={{ ...mono, fontWeight: 700, color: T.iron900, marginTop: 3 }}>{formatCurrency(totals.salesValue)}</div>
                      </div>
                      <div>
                        <Caps size={9} color={T.iron400}>Total CGST</Caps>
                        <div style={{ ...mono, fontWeight: 700, color: T.green, marginTop: 3 }}>{formatCurrency(totals.salesCGST)}</div>
                      </div>
                      <div>
                        <Caps size={9} color={T.iron400}>Total SGST</Caps>
                        <div style={{ ...mono, fontWeight: 700, color: T.green, marginTop: 3 }}>{formatCurrency(totals.salesSGST)}</div>
                      </div>
                      <div>
                        <Caps size={9} color={T.iron400}>Total GST</Caps>
                        <div style={{ ...mono, fontWeight: 700, color: T.orangeDeep, marginTop: 3 }}>{formatCurrency(totals.totalGST)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* State-wise Tab */}
            {activeTab === 'statewise' && (
              <div style={{ maxHeight: 500, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    <th style={thCell}><Caps size={8.5}>State</Caps></th>
                    <th style={thRight}><Caps size={8.5}>Invoice Count</Caps></th>
                    <th style={thRight}><Caps size={8.5}>Taxable Value</Caps></th>
                    <th style={thRight}><Caps size={8.5}>CGST</Caps></th>
                    <th style={thRight}><Caps size={8.5}>SGST</Caps></th>
                    <th style={thRight}><Caps size={8.5}>IGST</Caps></th>
                    <th style={thRight}><Caps size={8.5}>Total GST</Caps></th>
                  </tr></thead>
                  <tbody>
                    {stateWiseData.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: T.iron400, fontSize: 12 }}>No state-wise data available</td></tr>
                    ) : (
                      stateWiseData.map((state, idx) => (
                        <tr key={idx} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                          <td style={{ ...tdCell, fontWeight: 600, color: T.iron900 }}>{state.state || 'Not Specified'}</td>
                          <td style={{ ...tdRight, ...mono, color: T.iron500 }}>{formatNumber(state.invoice_count)}</td>
                          <td style={{ ...tdRight, ...mono, color: T.iron900 }}>{formatCurrency(state.taxable_value)}</td>
                          <td style={{ ...tdRight, ...mono, color: T.green }}>{formatCurrency(state.cgst)}</td>
                          <td style={{ ...tdRight, ...mono, color: T.green }}>{formatCurrency(state.sgst)}</td>
                          <td style={{ ...tdRight, ...mono, color: '#6D4AB0' }}>{formatCurrency(state.igst)}</td>
                          <td style={{ ...tdRight, ...mono, fontWeight: 700, color: T.iron900 }}>{formatCurrency((state.cgst || 0) + (state.sgst || 0) + (state.igst || 0))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Purchase vs Sales Tab */}
            {activeTab === 'comparison' && (
              <div style={{ maxHeight: 500, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    <th style={thCell}><Caps size={8.5}>HSN Code</Caps></th>
                    <th style={thCell}><Caps size={8.5}>Product</Caps></th>
                    <th style={thRight}><Caps size={8.5}>Purchase Value</Caps></th>
                    <th style={thRight}><Caps size={8.5}>Purchase Qty</Caps></th>
                    <th style={thRight}><Caps size={8.5}>Sales Value</Caps></th>
                    <th style={thRight}><Caps size={8.5}>Sales Qty</Caps></th>
                    <th style={thRight}><Caps size={8.5}>Difference</Caps></th>
                  </tr></thead>
                  <tbody>
                    {purchaseVsSales.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: T.iron400, fontSize: 12 }}>No comparison data available</td></tr>
                    ) : (
                      purchaseVsSales.map((item, idx) => {
                        const diff = (item.sales_value || 0) - (item.purchase_value || 0);
                        return (
                          <tr key={idx} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                            <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{item.hsn_code || '-'}</td>
                            <td style={{ ...tdCell, maxWidth: 200 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.iron900 }}>{item.product_name || '-'}</div></td>
                            <td style={{ ...tdRight, ...mono, color: T.orange }}>{formatCurrency(item.purchase_value)}</td>
                            <td style={{ ...tdRight, ...mono, color: T.iron500 }}>{formatNumber(item.purchase_qty)}</td>
                            <td style={{ ...tdRight, ...mono, color: T.green }}>{formatCurrency(item.sales_value)}</td>
                            <td style={{ ...tdRight, ...mono, color: T.iron500 }}>{formatNumber(item.sales_qty)}</td>
                            <td style={{ ...tdRight, ...mono, fontWeight: 700, color: diff >= 0 ? T.green : T.rose }}>{diff >= 0 ? '+' : ''}{formatCurrency(diff)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Alerts Tab */}
            {activeTab === 'alerts' && (
              <div style={{ maxHeight: 500, overflow: 'auto', padding: 14 }}>
                {missingDataAlerts.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: T.iron500 }}>
                    <div style={{ marginBottom: 12, width: 60, height: 60, borderRadius: '50%', display: 'grid', placeItems: 'center', background: T.greenTint }}>
                      <CheckCircle2 size={30} color={T.green} />
                    </div>
                    <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 16, color: T.iron900 }}>All Data Complete!</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>No missing HSN, GST rate, or state information found.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {missingDataAlerts.map((alert, idx) => {
                      const sevColor = alert.severity === 'high' ? T.rose : alert.severity === 'medium' ? T.orange : T.voltageText;
                      const sevBg = alert.severity === 'high' ? '#FDEEE6' : alert.severity === 'medium' ? '#FDEEE6' : T.voltageTint;
                      return (
                        <div key={idx} style={{ borderRadius: 8, padding: 14, border: `1px solid ${T.iron200}`, background: T.white }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                              <AlertCircle size={18} color={sevColor} style={{ marginTop: 2, flexShrink: 0 }} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontFamily: T.headline, fontWeight: 700, color: T.iron900 }}>{alert.record_type}</span>
                                  <span style={{ ...mono, fontSize: 12, color: T.iron500 }}>#{alert.record_number}</span>
                                  <span style={{ background: sevBg, color: sevColor, border: `1px solid ${sevColor}33`, padding: '2px 8px', borderRadius: 999, fontFamily: T.headline, fontWeight: 700, fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase' }}>{alert.severity}</span>
                                </div>
                                <div style={{ fontSize: 12.5, marginTop: 4, color: T.iron700 }}>{alert.message}</div>
                                <div style={{ display: 'flex', gap: 16, marginTop: 6, ...mono, fontSize: 10, color: T.iron400, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                                  {alert.party_name && <span>Party: {alert.party_name}</span>}
                                  {alert.date && <span>Date: {new Date(alert.date).toLocaleDateString()}</span>}
                                </div>
                              </div>
                            </div>
                            <button onClick={() => handleOpenCorrection(alert)} style={{ ...btnOutline, flexShrink: 0, padding: '6px 11px', fontSize: 11 }}>
                              <Edit3 size={13} />Fix
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </IronCard>
        </>
      )}

      {/* Drilldown Dialog */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              HSN {selectedHSN} — State-wise Breakdown
            </DialogTitle>
          </DialogHeader>
          {drilldownData && (
            <div style={{ maxHeight: 400, overflow: 'auto', border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  <th style={thCell}><Caps size={8.5}>State</Caps></th>
                  <th style={thRight}><Caps size={8.5}>Qty</Caps></th>
                  <th style={thRight}><Caps size={8.5}>Taxable</Caps></th>
                  <th style={thRight}><Caps size={8.5}>CGST</Caps></th>
                  <th style={thRight}><Caps size={8.5}>SGST</Caps></th>
                  <th style={thRight}><Caps size={8.5}>IGST</Caps></th>
                  <th style={thRight}><Caps size={8.5}>Invoices</Caps></th>
                </tr></thead>
                <tbody>
                  {drilldownData.states?.map((state, idx) => (
                    <tr key={idx} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, fontWeight: 600, color: T.iron900 }}>{state.state}</td>
                      <td style={{ ...tdRight, ...mono, color: T.iron500 }}>{formatNumber(state.quantity)}</td>
                      <td style={{ ...tdRight, ...mono, color: T.iron900 }}>{formatCurrency(state.taxable_value)}</td>
                      <td style={{ ...tdRight, ...mono, color: T.green }}>{formatCurrency(state.cgst)}</td>
                      <td style={{ ...tdRight, ...mono, color: T.green }}>{formatCurrency(state.sgst)}</td>
                      <td style={{ ...tdRight, ...mono, color: '#6D4AB0' }}>{formatCurrency(state.igst)}</td>
                      <td style={{ ...tdRight, ...mono, color: T.iron500 }}>{state.invoice_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Correction Dialog */}
      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-orange-500" />
              Correct Record Data
            </DialogTitle>
          </DialogHeader>
          {correctionRecord && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Record</p>
                <p className="text-foreground font-semibold mt-0.5">{correctionRecord.record_type} #{correctionRecord.record_number}</p>
              </div>

              <div>
                <Label>HSN Code</Label>
                <Select
                  value={correctionForm.hsn_code || 'none'}
                  onValueChange={(v) => setCorrectionForm({ ...correctionForm, hsn_code: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className="mt-1 font-mono">
                    <SelectValue placeholder="Select HSN code" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="none">Select HSN Code</SelectItem>
                    {availableHsnCodes.map((hsn, idx) => (
                      <SelectItem key={idx} value={hsn.code}>
                        <span className="font-mono font-medium">{hsn.code}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          ({hsn.products?.[0]?.substring(0, 20) || 'Unknown'}...)
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableHsnCodes.length === 0 && (
                  <p className="font-mono text-[10px] uppercase tracking-wide text-orange-400 mt-1">No HSN codes found. Add HSN to Master SKUs first.</p>
                )}
                {availableHsnCodes.length > 0 && (
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{availableHsnCodes.length} HSN codes available</p>
                )}
              </div>

              <div>
                <Label>GST Rate (%)</Label>
                <Select
                  value={correctionForm.gst_rate || 'none'}
                  onValueChange={(v) => setCorrectionForm({ ...correctionForm, gst_rate: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select GST rate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select Rate</SelectItem>
                    <SelectItem value="0">0% (Exempt)</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="18">18%</SelectItem>
                    <SelectItem value="28">28%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>State</Label>
                <Select
                  value={correctionForm.state || 'none'}
                  onValueChange={(v) => setCorrectionForm({ ...correctionForm, state: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="none">Select State</SelectItem>
                    {INDIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Reason for Correction *</Label>
                <Textarea
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  placeholder="Explain why this correction is needed"
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCorrectionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCorrection} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

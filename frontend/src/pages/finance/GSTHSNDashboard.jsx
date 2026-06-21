import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText, Download, AlertTriangle, CheckCircle2,
  IndianRupee, Package, Map, Loader2, RefreshCw,
  Search, Filter, ChevronRight, Edit3, AlertCircle,
  TrendingUp, TrendingDown, BarChart3, PieChart
} from 'lucide-react';

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

// KPI card — Obsidian "hero metric"
const KpiCard = ({ label, value, sub, icon: Icon, tone = 'blue' }) => {
  const toneMap = {
    blue:    'bg-primary/15 text-primary',
    green:   'bg-emerald-500/15 text-emerald-500',
    orange:  'bg-orange-400/15 text-orange-400',
    purple:  'bg-violet-400/15 text-violet-400',
    red:     'bg-rose-500/15 text-rose-400',
    cyan:    'bg-sky-400/15 text-sky-400',
  };
  const valueColor = {
    blue:    'text-primary',
    green:   'text-emerald-500',
    orange:  'text-orange-400',
    purple:  'text-violet-400',
    red:     'text-rose-400',
    cyan:    'text-sky-400',
  };
  return (
    <div className="mg-card rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={`font-mono text-[26px] font-bold tabular-nums leading-none ${valueColor[tone]}`}>{value}</p>
      {sub && <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mt-2">{sub}</p>}
    </div>
  );
};

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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Live · GST Reporting
              </span>
            </div>
            <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">GST / HSN Dashboard</h2>
            <p className="mt-1 text-sm text-muted-foreground">HSN-wise sales and purchase summary for GST reporting</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date range picker */}
            <div className="flex items-center gap-2 bg-muted/40 border border-border px-3 py-1.5 rounded-lg">
              <Input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="bg-transparent border-0 text-foreground w-36 text-sm p-0 h-auto shadow-none focus-visible:ring-0"
              />
              <span className="text-muted-foreground font-mono text-[11px]">to</span>
              <Input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="bg-transparent border-0 text-foreground w-36 text-sm p-0 h-auto shadow-none focus-visible:ring-0"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => handleExport('hsn-summary')}>
              <Download className="w-4 h-4 mr-2" />
              HSN Summary
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('detailed')}>
              <Download className="w-4 h-4 mr-2" />
              Detailed
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <KpiCard
            label="Taxable Sales"
            value={formatCurrency(totals.salesValue)}
            icon={TrendingUp}
            tone="green"
          />

          <KpiCard
            label="Total GST Collected"
            value={formatCurrency(totals.totalGST)}
            sub={`CGST: ${formatCurrency(totals.salesCGST)} · SGST: ${formatCurrency(totals.salesSGST)}`}
            icon={IndianRupee}
            tone="cyan"
          />

          <KpiCard
            label="IGST"
            value={formatCurrency(totals.salesIGST)}
            sub="Inter-state sales"
            icon={Map}
            tone="purple"
          />

          <KpiCard
            label="Taxable Purchases"
            value={formatCurrency(totals.purchaseValue)}
            icon={TrendingDown}
            tone="orange"
          />

          <KpiCard
            label="Data Alerts"
            value={totals.alertCount.toString()}
            sub={totals.alertCount > 0 ? 'Missing / incomplete data' : 'All data complete'}
            icon={totals.alertCount > 0 ? AlertTriangle : CheckCircle2}
            tone={totals.alertCount > 0 ? 'red' : 'green'}
          />
        </div>

        {/* Main Content Tabs */}
        <div className="mg-card rounded-lg border border-border bg-card p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <TabsList>
                <TabsTrigger value="summary">
                  <Package className="w-4 h-4 mr-2" />
                  HSN Summary
                </TabsTrigger>
                <TabsTrigger value="statewise">
                  <Map className="w-4 h-4 mr-2" />
                  State-wise
                </TabsTrigger>
                <TabsTrigger value="comparison">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Purchase vs Sales
                </TabsTrigger>
                <TabsTrigger value="alerts">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Alerts ({totals.alertCount})
                </TabsTrigger>
              </TabsList>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search HSN or Product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
            </div>

            {/* HSN Summary Tab */}
            <TabsContent value="summary" className="mt-0">
              <ScrollArea className="h-[500px]">
                <Table cards>
                  <TableHeader>
                    <TableRow>
                      <TableHead>HSN Code</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty Sold</TableHead>
                      <TableHead className="text-right">Taxable Value</TableHead>
                      <TableHead className="text-right">CGST</TableHead>
                      <TableHead className="text-right">SGST</TableHead>
                      <TableHead className="text-right">IGST</TableHead>
                      <TableHead className="text-right">Total GST</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHsnSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No HSN data found for the selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHsnSummary.map((hsn, idx) => (
                        <TableRow
                          key={idx}
                          className="cursor-pointer"
                          onClick={() => handleDrilldown(hsn.hsn_code)}
                        >
                          <TableCell className="font-mono text-sm text-primary">{hsn.hsn_code || '-'}</TableCell>
                          <TableCell className="text-foreground">
                            <div className="truncate max-w-[200px]">{hsn.product_name || '-'}</div>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{formatNumber(hsn.quantity_sold)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-foreground">{formatCurrency(hsn.sales_taxable)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-emerald-500">{formatCurrency(hsn.sales_cgst)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-emerald-500">{formatCurrency(hsn.sales_sgst)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-violet-400">{formatCurrency(hsn.sales_igst)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-semibold text-foreground">
                            {formatCurrency((hsn.sales_cgst || 0) + (hsn.sales_sgst || 0) + (hsn.sales_igst || 0))}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {/* Totals footer */}
                {filteredHsnSummary.length > 0 && (
                  <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border">
                    <div className="grid grid-cols-4 gap-4 text-right">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Total Taxable</p>
                        <p className="font-mono font-bold tabular-nums text-foreground">{formatCurrency(totals.salesValue)}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Total CGST</p>
                        <p className="font-mono font-bold tabular-nums text-emerald-500">{formatCurrency(totals.salesCGST)}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Total SGST</p>
                        <p className="font-mono font-bold tabular-nums text-emerald-500">{formatCurrency(totals.salesSGST)}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Total GST</p>
                        <p className="font-mono font-bold tabular-nums text-primary">{formatCurrency(totals.totalGST)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* State-wise Tab */}
            <TabsContent value="statewise" className="mt-0">
              <ScrollArea className="h-[500px]">
                <Table cards>
                  <TableHeader>
                    <TableRow>
                      <TableHead>State</TableHead>
                      <TableHead className="text-right">Invoice Count</TableHead>
                      <TableHead className="text-right">Taxable Value</TableHead>
                      <TableHead className="text-right">CGST</TableHead>
                      <TableHead className="text-right">SGST</TableHead>
                      <TableHead className="text-right">IGST</TableHead>
                      <TableHead className="text-right">Total GST</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stateWiseData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No state-wise data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      stateWiseData.map((state, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-foreground">{state.state || 'Not Specified'}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{formatNumber(state.invoice_count)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-foreground">{formatCurrency(state.taxable_value)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-emerald-500">{formatCurrency(state.cgst)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-emerald-500">{formatCurrency(state.sgst)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-violet-400">{formatCurrency(state.igst)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-semibold text-foreground">
                            {formatCurrency((state.cgst || 0) + (state.sgst || 0) + (state.igst || 0))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            {/* Purchase vs Sales Tab */}
            <TabsContent value="comparison" className="mt-0">
              <ScrollArea className="h-[500px]">
                <Table cards>
                  <TableHeader>
                    <TableRow>
                      <TableHead>HSN Code</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Purchase Value</TableHead>
                      <TableHead className="text-right">Purchase Qty</TableHead>
                      <TableHead className="text-right">Sales Value</TableHead>
                      <TableHead className="text-right">Sales Qty</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseVsSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No comparison data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchaseVsSales.map((item, idx) => {
                        const diff = (item.sales_value || 0) - (item.purchase_value || 0);
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm text-primary">{item.hsn_code || '-'}</TableCell>
                            <TableCell className="text-foreground truncate max-w-[200px]">{item.product_name || '-'}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-orange-400">{formatCurrency(item.purchase_value)}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{formatNumber(item.purchase_qty)}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-emerald-500">{formatCurrency(item.sales_value)}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{formatNumber(item.sales_qty)}</TableCell>
                            <TableCell className={`text-right font-mono tabular-nums font-semibold ${diff >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                              {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            {/* Alerts Tab */}
            <TabsContent value="alerts" className="mt-0">
              <ScrollArea className="h-[500px]">
                {missingDataAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <p className="text-lg font-semibold text-foreground">All Data Complete!</p>
                    <p className="text-sm mt-1">No missing HSN, GST rate, or state information found.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {missingDataAlerts.map((alert, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg p-4 border border-border bg-muted/20 hover:border-orange-400/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                              alert.severity === 'high' ? 'text-rose-400' :
                              alert.severity === 'medium' ? 'text-orange-400' : 'text-amber-400'
                            }`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-foreground">{alert.record_type}</span>
                                <span className="text-muted-foreground font-mono text-sm">#{alert.record_number}</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                                  alert.severity === 'high'
                                    ? 'bg-rose-500/15 text-rose-400 ring-rose-500/25'
                                    : alert.severity === 'medium'
                                    ? 'bg-orange-400/15 text-orange-400 ring-orange-400/25'
                                    : 'bg-amber-400/15 text-amber-400 ring-amber-400/25'
                                }`}>{alert.severity}</span>
                              </div>
                              <p className="text-muted-foreground text-sm mt-1">{alert.message}</p>
                              <div className="flex items-center gap-4 mt-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                                {alert.party_name && <span>Party: {alert.party_name}</span>}
                                {alert.date && <span>Date: {new Date(alert.date).toLocaleDateString()}</span>}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenCorrection(alert)}
                            className="flex-shrink-0"
                          >
                            <Edit3 className="w-4 h-4 mr-1" />
                            Fix
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Drilldown Dialog */}
        <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                HSN {selectedHSN} — State-wise Breakdown
              </DialogTitle>
            </DialogHeader>
            {drilldownData && (
              <ScrollArea className="max-h-[400px]">
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table cards>
                    <TableHeader>
                      <TableRow>
                        <TableHead>State</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Taxable</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">Invoices</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drilldownData.states?.map((state, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-foreground font-medium">{state.state}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{formatNumber(state.quantity)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-foreground">{formatCurrency(state.taxable_value)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-emerald-500">{formatCurrency(state.cgst)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-emerald-500">{formatCurrency(state.sgst)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-violet-400">{formatCurrency(state.igst)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{state.invoice_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

        {/* Correction Dialog */}
        <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-orange-400" />
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
      </div>
    </DashboardLayout>
  );
}

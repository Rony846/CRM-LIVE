import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Building2, IndianRupee, TrendingUp, AlertTriangle,
  FileText, Download, RefreshCw, ChevronRight, Package,
  ArrowRightLeft, Factory, Receipt, Calculator, Loader2,
  Calendar, Filter, Info, ArrowUp, ArrowDown, ArrowLeft, Bot
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
};

// Obsidian Elite tone map
const STAT_TONES = {
  blue:    'bg-primary/15 text-primary',
  green:   'bg-emerald-500/15 text-emerald-500',
  orange:  'bg-orange-400/15 text-orange-400',
  purple:  'bg-violet-400/15 text-violet-400',
  red:     'bg-rose-500/15 text-rose-400',
  cyan:    'bg-sky-400/15 text-sky-400',
};

const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = "blue" }) => (
  <div className="mg-card rounded-lg border border-border bg-card p-5">
    <div className="flex items-start justify-between">
      <div className="min-w-0">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
        <p className="mt-2 font-mono text-[28px] font-bold tabular-nums leading-none text-foreground">{value}</p>
        {subtitle && <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{subtitle}</p>}
      </div>
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${STAT_TONES[color] || STAT_TONES.blue}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
    {trend && (
      <div className="mt-3 flex items-center gap-1 text-xs">
        {trend > 0 ? (
          <span className="flex items-center gap-1 text-emerald-500">
            <ArrowUp className="w-3 h-3" /> +{trend}%
          </span>
        ) : (
          <span className="flex items-center gap-1 text-rose-400">
            <ArrowDown className="w-3 h-3" /> {trend}%
          </span>
        )}
        <span className="text-muted-foreground ml-1">vs last month</span>
      </div>
    )}
  </div>
);

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
    notes: ''
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
        headers: { Authorization: `Bearer ${token}` }
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
        headers: { Authorization: `Bearer ${token}` }
      });
      setFirms(response.data);
    } catch (error) {
      console.error('Failed to load firms');
    }
  };

  const fetchFirmSummary = async (firmId, month) => {
    try {
      const response = await axios.get(`${API}/finance/firm/${firmId}/summary?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
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
        headers: { Authorization: `Bearer ${token}` }
      });
      setInventoryValuation(response.data);
    } catch (error) {
      toast.error('Failed to load inventory valuation');
    }
  };

  const fetchRecommendations = async () => {
    try {
      const response = await axios.get(`${API}/finance/transfer-recommendations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecommendations(response.data.recommendations || []);
    } catch (error) {
      toast.error('Failed to load transfer recommendations');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const response = await axios.get(`${API}/finance/audit-logs?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAuditLogs(response.data.logs || []);
    } catch (error) {
      toast.error('Failed to load audit logs');
    }
  };

  const handleSaveITC = async () => {
    try {
      await axios.post(`${API}/finance/gst-itc`, itcForm, {
        headers: { Authorization: `Bearer ${token}` }
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
      if (t.refunds_posted > 0)   bits.push(`${t.refunds_posted} refunds`);
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
        responseType: 'blob'
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

  if (loading) {
    return (
      <DashboardLayout title="Finance & GST">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Finance & GST Planning">
      <div className="space-y-6" data-testid="finance-dashboard">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-muted-foreground hover:text-foreground"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Live · All Firms
                </span>
              </div>
              <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">Finance & GST Planning</h2>
              <p className="mt-1 text-sm text-muted-foreground">Firm-wise financial overview and GST planning dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label htmlFor="gst-period" className="text-xs font-medium text-muted-foreground">GST period</label>
              <input
                id="gst-period"
                type="month"
                value={selectedMonth}
                max={new Date().toISOString().slice(0, 7)}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                data-testid="dashboard-month-picker"
              />
            </div>
            <Button variant="outline" onClick={() => setItcDialogOpen(true)} data-testid="enter-itc-btn">
              <Calculator className="w-4 h-4 mr-2" />
              Enter ITC Balance
            </Button>
            <Button
              variant="outline"
              onClick={handleRunFinanceAgent}
              disabled={financeAgentRunning}
              title={
                selectedFirm && selectedFirm !== 'all'
                  ? `Run the Amazon finance agent for the selected firm now (books fees + refunds, flags unmatched)`
                  : `Run the Amazon finance agent for ALL firms now (books fees + refunds, flags unmatched)`
              }
              data-testid="run-finance-agent-btn"
            >
              {financeAgentRunning
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Bot className="w-4 h-4 mr-2" />}
              {financeAgentRunning ? 'Running…' : 'Run Finance Agent'}
            </Button>
            <Button variant="outline" onClick={fetchDashboard}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {dashboard?.alerts?.length > 0 && (
          <div className="space-y-2">
            {dashboard.alerts.map((alert, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg flex items-center gap-2 border ${
                  alert.type === 'warning'
                    ? 'bg-amber-400/10 text-amber-400 border-amber-400/25'
                    : 'bg-primary/10 text-primary border-primary/25'
                }`}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Inventory Value"
            value={formatCurrency(dashboard?.total_inventory_value)}
            subtitle={`${dashboard?.total_firms || 0} firms`}
            icon={Package}
            color="blue"
          />
          <StatCard
            title="Est. GST Liability"
            value={formatCurrency(dashboard?.total_gst_liability)}
            subtitle={`Month: ${dashboard?.current_month}`}
            icon={Receipt}
            color="orange"
          />
          <StatCard
            title="Pending Invoices"
            value={dashboard?.pending_invoice_entries || 0}
            subtitle="Need invoice value"
            icon={FileText}
            color="red"
          />
          <StatCard
            title="Active Firms"
            value={dashboard?.total_firms || 0}
            subtitle="With inventory"
            icon={Building2}
            color="green"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" data-testid="overview-tab">
              <Building2 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="inventory" data-testid="inventory-tab">
              <Package className="w-4 h-4 mr-2" />
              Inventory Valuation
            </TabsTrigger>
            <TabsTrigger value="gst" data-testid="gst-tab">
              <Receipt className="w-4 h-4 mr-2" />
              GST Planning
            </TabsTrigger>
            <TabsTrigger value="transfers" data-testid="transfers-tab">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Transfers
            </TabsTrigger>
            <TabsTrigger value="audit" data-testid="audit-tab">
              <FileText className="w-4 h-4 mr-2" />
              Audit Trail
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {dashboard?.firm_summaries?.map((firm) => (
                <div key={firm.firm_id} className="mg-card rounded-lg border border-border bg-card p-5 hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold tracking-tight text-foreground truncate">{firm.firm_name}</h3>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{firm.gstin}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFirm(firm.firm_id);
                        setActiveTab('gst');
                      }}
                      className="flex-shrink-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Inventory Value</span>
                      <span className="font-mono tabular-nums font-semibold text-foreground text-sm">{formatCurrency(firm.inventory_value)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Monthly Sales</span>
                      <span className="font-mono tabular-nums font-semibold text-emerald-500 text-sm">{formatCurrency(firm.monthly_sales)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Output GST</span>
                      <span className="font-mono tabular-nums font-semibold text-foreground text-sm">{formatCurrency(firm.output_gst)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">ITC Balance</span>
                      <span className="font-mono tabular-nums font-semibold text-primary text-sm">{formatCurrency(firm.itc_balance)}</span>
                    </div>
                    <div className="border-t border-border pt-2.5 flex justify-between items-center">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-foreground font-semibold">Net GST Payable</span>
                      <span className={`font-mono tabular-nums font-bold text-sm ${firm.net_gst_payable > 0 ? 'text-rose-400' : 'text-emerald-500'}`}>
                        {formatCurrency(firm.net_gst_payable)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Inventory Valuation Tab */}
          <TabsContent value="inventory" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Inventory Valuation (WAC Method)</CardTitle>
                    <CardDescription>Weighted Average Cost valuation for all inventory items</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select value={selectedFirm} onValueChange={(v) => { setSelectedFirm(v); fetchInventoryValuation(); }}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select Firm" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Firms</SelectItem>
                        {firms.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => handleExport('inventory')}>
                      <Download className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {inventoryValuation?.firms?.map((firm) => (
                  <div key={firm.firm_id} className="mb-6">
                    <div className="flex items-center justify-between mb-3 p-3 bg-muted/40 rounded-lg border border-border">
                      <div>
                        <h4 className="font-semibold text-foreground">{firm.firm_name}</h4>
                        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{firm.gstin}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Total Value</p>
                        <p className="font-mono text-xl font-bold tabular-nums text-primary">{formatCurrency(firm.total_value)}</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <Table cards>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU Code</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead>HSN</TableHead>
                            <TableHead>GST %</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">WAC</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {firm.items?.slice(0, 20).map((item) => (
                            <TableRow key={item.item_id}>
                              <TableCell className="font-mono text-sm">{item.sku_code}</TableCell>
                              <TableCell className="text-foreground">{item.item_name}</TableCell>
                              <TableCell className="font-mono text-sm text-muted-foreground">{item.hsn_code || '-'}</TableCell>
                              <TableCell className="font-mono tabular-nums text-muted-foreground">{item.gst_rate}%</TableCell>
                              <TableCell className="text-right font-mono tabular-nums">{item.quantity}</TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{formatCurrency(item.wac)}</TableCell>
                              <TableCell className="text-right font-mono tabular-nums font-semibold text-foreground">{formatCurrency(item.value)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {firm.items?.length > 20 && (
                      <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mt-2 text-center">
                        Showing top 20 items. Export CSV for full list.
                      </p>
                    )}
                  </div>
                ))}
                {inventoryValuation && (
                  <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/25 flex justify-between items-center">
                    <span className="font-semibold text-foreground">Grand Total (All Firms)</span>
                    <span className="font-mono text-2xl font-bold tabular-nums text-primary">{formatCurrency(inventoryValuation.grand_total)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* GST Planning Tab */}
          <TabsContent value="gst" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Select Firm & Month</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Firm</Label>
                    <Select value={selectedFirm} onValueChange={setSelectedFirm}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Firm" />
                      </SelectTrigger>
                      <SelectContent>
                        {firms.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Month</Label>
                    <Input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => handleExport('month-end')}
                    disabled={!selectedFirm || selectedFirm === 'all'}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Month-End Report
                  </Button>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>
                    {firmSummary ? `${firmSummary.firm.name} — ${firmSummary.month}` : 'Select a firm to view details'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {firmSummary ? (
                    <div className="space-y-5">
                      {/* Sales & Purchases */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/25">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-emerald-500">Sales</p>
                          <p className="font-mono text-2xl font-bold tabular-nums text-emerald-500 mt-1">{formatCurrency(firmSummary.sales.total_value)}</p>
                          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{firmSummary.sales.count} dispatches</p>
                        </div>
                        <div className="p-4 bg-primary/10 rounded-lg border border-primary/25">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-primary">Purchases</p>
                          <p className="font-mono text-2xl font-bold tabular-nums text-primary mt-1">{formatCurrency(firmSummary.purchases.value)}</p>
                          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{firmSummary.purchases.count} entries</p>
                        </div>
                      </div>

                      {/* GST Breakup */}
                      <div>
                        <h4 className="font-semibold text-foreground mb-2">GST Breakup by Rate</h4>
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <Table cards>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Rate</TableHead>
                                <TableHead className="text-right">Taxable Value</TableHead>
                                <TableHead className="text-right">GST Amount</TableHead>
                                <TableHead className="text-right">Count</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Object.entries(firmSummary.sales.gst_by_rate || {}).map(([rate, data]) => (
                                <TableRow key={rate}>
                                  <TableCell className="font-mono tabular-nums">{rate}%</TableCell>
                                  <TableCell className="text-right font-mono tabular-nums">{formatCurrency(data.taxable)}</TableCell>
                                  <TableCell className="text-right font-mono tabular-nums">{formatCurrency(data.gst)}</TableCell>
                                  <TableCell className="text-right font-mono tabular-nums">{data.count}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* ITC & Net GST */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-orange-400/10 rounded-lg border border-orange-400/25">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-orange-400">Output GST (Liability)</p>
                          <p className="font-mono text-xl font-bold tabular-nums text-orange-400 mt-1">{formatCurrency(firmSummary.gst.output_gst)}</p>
                          <p className="font-mono text-[10px] text-muted-foreground mt-1">
                            IGST: {formatCurrency(firmSummary.gst.output_igst || 0)} |
                            CGST: {formatCurrency(firmSummary.gst.output_cgst || 0)} |
                            SGST: {formatCurrency(firmSummary.gst.output_sgst || 0)}
                          </p>
                        </div>
                        <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/25">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-emerald-500">Input GST (From Purchases)</p>
                          <p className="font-mono text-xl font-bold tabular-nums text-emerald-500 mt-1">{formatCurrency(firmSummary.gst.input_gst || firmSummary.purchases?.input_gst || 0)}</p>
                          <p className="font-mono text-[10px] text-muted-foreground mt-1">
                            IGST: {formatCurrency(firmSummary.gst.input_igst || 0)} |
                            CGST: {formatCurrency(firmSummary.gst.input_cgst || 0)} |
                            SGST: {formatCurrency(firmSummary.gst.input_sgst || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-primary/10 rounded-lg border border-primary/25">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-primary">ITC Balance (Carry Forward)</p>
                          <p className="font-mono text-xl font-bold tabular-nums text-primary mt-1">{formatCurrency(firmSummary.gst.itc_balance.total)}</p>
                          <p className="font-mono text-[10px] text-muted-foreground mt-1">
                            IGST: {formatCurrency(firmSummary.gst.itc_balance.igst)} |
                            CGST: {formatCurrency(firmSummary.gst.itc_balance.cgst)} |
                            SGST: {formatCurrency(firmSummary.gst.itc_balance.sgst)}
                          </p>
                        </div>
                        <div className={`p-4 rounded-lg border ${firmSummary.gst.net_payable > 0 ? 'bg-rose-500/10 border-rose-500/25' : 'bg-emerald-500/10 border-emerald-500/25'}`}>
                          <p className={`font-mono text-[11px] uppercase tracking-wide ${firmSummary.gst.net_payable > 0 ? 'text-rose-400' : 'text-emerald-500'}`}>Net GST Payable</p>
                          <p className={`font-mono text-xl font-bold tabular-nums mt-1 ${firmSummary.gst.net_payable > 0 ? 'text-rose-400' : 'text-emerald-500'}`}>
                            {formatCurrency(firmSummary.gst.net_payable)}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground mt-1">
                            Output - Input - ITC Balance
                          </p>
                        </div>
                      </div>

                      {/* Other Metrics */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 bg-muted/40 rounded-lg border border-border">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Production</p>
                          <p className="font-mono tabular-nums font-semibold text-foreground mt-1">{formatCurrency(firmSummary.production.value)}</p>
                        </div>
                        <div className="p-3 bg-muted/40 rounded-lg border border-border">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Transfers In</p>
                          <p className="font-mono tabular-nums font-semibold text-foreground mt-1">{formatCurrency(firmSummary.transfers.in.value)}</p>
                        </div>
                        <div className="p-3 bg-muted/40 rounded-lg border border-border">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Returns</p>
                          <p className="font-mono tabular-nums font-semibold text-foreground mt-1">{formatCurrency(firmSummary.returns.value)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Select a firm to view GST planning details</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Transfer Recommendations Tab */}
          <TabsContent value="transfers" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Transfer Recommendations</CardTitle>
                    <CardDescription>
                      Smart suggestions based on stock levels, sales velocity, and ITC balance
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={fetchRecommendations}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {recommendations.map((rec, i) => (
                      <div key={i} className={`p-4 rounded-lg border transition-colors ${
                        rec.priority === 'high'
                          ? 'border-rose-500/30 bg-rose-500/10'
                          : 'border-border bg-muted/30'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                                rec.priority === 'high'
                                  ? 'bg-rose-500/15 text-rose-400 ring-rose-500/25'
                                  : 'bg-muted text-muted-foreground ring-border'
                              }`}>{rec.priority}</span>
                              <span className="font-mono font-semibold text-foreground">{rec.sku_code}</span>
                              <span className="text-muted-foreground text-sm">— {rec.sku_name}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm flex-wrap">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Building2 className="w-4 h-4" />
                                <span className="text-foreground">{rec.from_firm.name}</span>
                                <span className="font-mono text-xs">({rec.from_firm.current_stock} units)</span>
                              </div>
                              <ArrowRightLeft className="w-4 h-4 text-primary" />
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Building2 className="w-4 h-4" />
                                <span className="text-foreground">{rec.to_firm.name}</span>
                                <span className="font-mono text-xs">({rec.to_firm.current_stock} units)</span>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">{rec.reason}</p>
                            {rec.itc_advisory && (
                              <p className="text-xs text-primary mt-1 flex items-center gap-1">
                                <Info className="w-3 h-3" />
                                {rec.itc_advisory}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Rec. Qty</p>
                            <p className="font-mono text-2xl font-bold tabular-nums text-primary">{rec.recommended_qty}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No transfer recommendations at this time</p>
                    <p className="text-sm mt-1">Stock levels are balanced across firms</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Trail Tab */}
          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Financial Audit Trail</CardTitle>
                    <CardDescription>All financial actions are logged for audit purposes</CardDescription>
                  </div>
                  <Button variant="outline" onClick={fetchAuditLogs}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table cards>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-muted text-muted-foreground ring-1 ring-border">
                              {log.action}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{log.entity_type}</TableCell>
                          <TableCell className="text-foreground">{log.user_name}</TableCell>
                          <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                            {JSON.stringify(log.details).slice(0, 100)}...
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {auditLogs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No audit logs found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ITC Entry Dialog */}
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
                <Select value={itcForm.firm_id} onValueChange={(v) => setItcForm({...itcForm, firm_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.map(f => (
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
                  onChange={(e) => setItcForm({...itcForm, month: e.target.value})}
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
                    onChange={(e) => setItcForm({...itcForm, igst_balance: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label>CGST Balance</Label>
                  <Input
                    type="number"
                    value={itcForm.cgst_balance}
                    onChange={(e) => setItcForm({...itcForm, cgst_balance: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label>SGST Balance</Label>
                  <Input
                    type="number"
                    value={itcForm.sgst_balance}
                    onChange={(e) => setItcForm({...itcForm, sgst_balance: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>
              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={itcForm.notes}
                  onChange={(e) => setItcForm({...itcForm, notes: e.target.value})}
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
      </div>
    </DashboardLayout>
  );
}

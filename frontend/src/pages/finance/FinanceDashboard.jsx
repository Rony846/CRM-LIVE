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
  Calendar, Filter, Info, ArrowUp, ArrowDown, ArrowLeft
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

const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-slate-800 border-slate-700 text-cyan-400",
    green: "bg-slate-800 border-slate-700 text-green-400",
    orange: "bg-slate-800 border-slate-700 text-orange-400",
    purple: "bg-slate-800 border-slate-700 text-purple-400",
    red: "bg-slate-800 border-slate-700 text-red-400"
  };

  return (
    <Card className={`${colorClasses[color]} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">{title}</p>
            <p className="text-2xl font-bold mt-1 text-white">{value}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-full bg-slate-900`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        {trend && (
          <div className="flex items-center mt-2 text-xs">
            {trend > 0 ? (
              <span className="text-green-400"><ArrowUp className="w-3 h-3 mr-1 inline" /> +{trend}%</span>
            ) : (
              <span className="text-red-400"><ArrowDown className="w-3 h-3 mr-1 inline" /> {trend}%</span>
            )}
            <span className="ml-1 text-slate-500">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [firmSummary, setFirmSummary] = useState(null);
  const [inventoryValuation, setInventoryValuation] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [itcDialogOpen, setItcDialogOpen] = useState(false);
  
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
    if (token) {
      fetchDashboard();
      fetchFirms();
    }
  }, [token]);

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

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${API}/finance/dashboard`, {
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
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Finance & GST Planning">
      <div className="space-y-6" data-testid="finance-dashboard">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="text-slate-400 hover:text-white"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">Finance & GST Planning</h1>
              <p className="text-slate-400">Firm-wise financial overview and GST planning dashboard</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setItcDialogOpen(true)} data-testid="enter-itc-btn" className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <Calculator className="w-4 h-4 mr-2" />
              Enter ITC Balance
            </Button>
            <Button variant="outline" onClick={fetchDashboard} className="border-slate-600 text-slate-300 hover:bg-slate-700">
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
              className={`p-3 rounded-lg flex items-center gap-2 ${
                alert.type === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 
                'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
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
          subtitle="Dispatches need invoice value"
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
            Transfer Recommendations
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
              <Card key={firm.firm_id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{firm.firm_name}</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedFirm(firm.firm_id);
                        setActiveTab('gst');
                      }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <CardDescription className="font-mono text-xs">{firm.gstin}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Inventory Value</span>
                      <span className="font-semibold">{formatCurrency(firm.inventory_value)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Monthly Sales</span>
                      <span className="font-semibold text-green-600">{formatCurrency(firm.monthly_sales)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Output GST</span>
                      <span className="font-semibold">{formatCurrency(firm.output_gst)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">ITC Balance</span>
                      <span className="font-semibold text-blue-600">{formatCurrency(firm.itc_balance)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between items-center">
                      <span className="text-sm font-medium">Net GST Payable</span>
                      <span className={`font-bold ${firm.net_gst_payable > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(firm.net_gst_payable)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                  <div className="flex items-center justify-between mb-3 p-3 bg-slate-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold">{firm.firm_name}</h4>
                      <p className="text-xs text-slate-500 font-mono">{firm.gstin}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Total Value</p>
                      <p className="text-xl font-bold text-blue-600">{formatCurrency(firm.total_value)}</p>
                    </div>
                  </div>
                  <Table>
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
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell className="font-mono text-sm">{item.hsn_code || '-'}</TableCell>
                          <TableCell>{item.gst_rate}%</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.wac)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(item.value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {firm.items?.length > 20 && (
                    <p className="text-sm text-slate-500 mt-2 text-center">
                      Showing top 20 items by value. Export CSV for full list.
                    </p>
                  )}
                </div>
              ))}
              {inventoryValuation && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">Grand Total (All Firms)</span>
                  <span className="text-2xl font-bold text-blue-700">{formatCurrency(inventoryValuation.grand_total)}</span>
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
                  {firmSummary ? `${firmSummary.firm.name} - ${firmSummary.month}` : 'Select a firm to view details'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {firmSummary ? (
                  <div className="space-y-6">
                    {/* Sales & Purchases */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-700">Sales</p>
                        <p className="text-2xl font-bold text-green-800">{formatCurrency(firmSummary.sales.total_value)}</p>
                        <p className="text-xs text-green-600">{firmSummary.sales.count} dispatches</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">Purchases</p>
                        <p className="text-2xl font-bold text-blue-800">{formatCurrency(firmSummary.purchases.value)}</p>
                        <p className="text-xs text-blue-600">{firmSummary.purchases.count} entries</p>
                      </div>
                    </div>

                    {/* GST Breakup */}
                    <div>
                      <h4 className="font-semibold mb-2">GST Breakup by Rate</h4>
                      <Table>
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
                              <TableCell>{rate}%</TableCell>
                              <TableCell className="text-right">{formatCurrency(data.taxable)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(data.gst)}</TableCell>
                              <TableCell className="text-right">{data.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* ITC & Net GST */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-orange-50 rounded-lg">
                        <p className="text-sm text-orange-700">Output GST</p>
                        <p className="text-xl font-bold text-orange-800">{formatCurrency(firmSummary.gst.output_gst)}</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">ITC Available</p>
                        <p className="text-xl font-bold text-blue-800">{formatCurrency(firmSummary.gst.itc_balance.total)}</p>
                        <p className="text-xs text-blue-600">
                          IGST: {formatCurrency(firmSummary.gst.itc_balance.igst)} | 
                          CGST: {formatCurrency(firmSummary.gst.itc_balance.cgst)} | 
                          SGST: {formatCurrency(firmSummary.gst.itc_balance.sgst)}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg ${firmSummary.gst.net_payable > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                        <p className={`text-sm ${firmSummary.gst.net_payable > 0 ? 'text-red-700' : 'text-green-700'}`}>Net GST Payable</p>
                        <p className={`text-xl font-bold ${firmSummary.gst.net_payable > 0 ? 'text-red-800' : 'text-green-800'}`}>
                          {formatCurrency(firmSummary.gst.net_payable)}
                        </p>
                      </div>
                    </div>

                    {/* Other Metrics */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm text-slate-600">Production</p>
                        <p className="font-semibold">{formatCurrency(firmSummary.production.value)}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm text-slate-600">Transfers In</p>
                        <p className="font-semibold">{formatCurrency(firmSummary.transfers.in.value)}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm text-slate-600">Returns</p>
                        <p className="font-semibold">{formatCurrency(firmSummary.returns.value)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
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
                <div className="space-y-4">
                  {recommendations.map((rec, i) => (
                    <div key={i} className={`p-4 rounded-lg border ${rec.priority === 'high' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                              {rec.priority}
                            </Badge>
                            <span className="font-semibold">{rec.sku_code}</span>
                            <span className="text-slate-500">- {rec.sku_name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Building2 className="w-4 h-4 text-slate-400" />
                              <span>{rec.from_firm.name}</span>
                              <span className="text-slate-400">({rec.from_firm.current_stock} units)</span>
                            </div>
                            <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                            <div className="flex items-center gap-1">
                              <Building2 className="w-4 h-4 text-slate-400" />
                              <span>{rec.to_firm.name}</span>
                              <span className="text-slate-400">({rec.to_firm.current_stock} units)</span>
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 mt-2">{rec.reason}</p>
                          {rec.itc_advisory && (
                            <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              {rec.itc_advisory}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-500">Recommended Qty</p>
                          <p className="text-2xl font-bold text-blue-600">{rec.recommended_qty}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
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
              <Table>
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
                      <TableCell className="text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.entity_type}</TableCell>
                      <TableCell>{log.user_name}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-slate-500">
                        {JSON.stringify(log.details).slice(0, 100)}...
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {auditLogs.length === 0 && (
                <div className="text-center py-8 text-slate-500">
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
            <p className="text-sm text-slate-500 mt-1">
              ITC balance is available after GST returns are filed (15th of following month)
            </p>
          </DialogHeader>
          <div className="space-y-4">
            {/* Info banner */}
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">How ITC entry works:</p>
                  <p className="mt-1">
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
              <p className="text-xs text-slate-500 mt-1">
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

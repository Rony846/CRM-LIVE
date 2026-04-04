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

export default function GSTHSNDashboard() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  
  // Data states
  const [hsnSummary, setHsnSummary] = useState([]);
  const [stateWiseData, setStateWiseData] = useState([]);
  const [missingDataAlerts, setMissingDataAlerts] = useState([]);
  const [purchaseVsSales, setPurchaseVsSales] = useState([]);
  
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
      const [summaryRes, alertsRes] = await Promise.all([
        axios.get(`${API}/gst/hsn-summary`, { 
          headers, 
          params: { from_date: dateRange.from, to_date: dateRange.to } 
        }),
        axios.get(`${API}/gst/missing-data-alerts`, { headers })
      ]);

      setHsnSummary(summaryRes.data.hsn_summary || []);
      setStateWiseData(summaryRes.data.state_wise || []);
      setPurchaseVsSales(summaryRes.data.purchase_vs_sales || []);
      setMissingDataAlerts(alertsRes.data || []);
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
      toast.error(error.response?.data?.detail || 'Failed to save correction');
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
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">GST / HSN Dashboard</h1>
            <p className="text-slate-400">HSN-wise sales and purchase summary for GST reporting</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg">
              <Input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="bg-transparent border-0 text-white w-36 text-sm"
              />
              <span className="text-slate-400">to</span>
              <Input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="bg-transparent border-0 text-white w-36 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('hsn-summary')}
              className="text-slate-300 border-slate-600"
            >
              <Download className="w-4 h-4 mr-2" />
              HSN Summary
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('detailed')}
              className="text-slate-300 border-slate-600"
            >
              <Download className="w-4 h-4 mr-2" />
              Detailed
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Taxable Sales</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(totals.salesValue)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total GST Collected</p>
                  <p className="text-2xl font-bold text-cyan-400">{formatCurrency(totals.totalGST)}</p>
                  <p className="text-xs text-slate-500">
                    CGST: {formatCurrency(totals.salesCGST)} | SGST: {formatCurrency(totals.salesSGST)}
                  </p>
                </div>
                <IndianRupee className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">IGST</p>
                  <p className="text-2xl font-bold text-purple-400">{formatCurrency(totals.salesIGST)}</p>
                  <p className="text-xs text-slate-500">Inter-state sales</p>
                </div>
                <Map className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Taxable Purchases</p>
                  <p className="text-2xl font-bold text-orange-400">{formatCurrency(totals.purchaseValue)}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className={`border-slate-700 ${totals.alertCount > 0 ? 'bg-red-900/30 border-red-600' : 'bg-slate-800'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Data Alerts</p>
                  <p className={`text-2xl font-bold ${totals.alertCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {totals.alertCount}
                  </p>
                  <p className="text-xs text-slate-500">
                    {totals.alertCount > 0 ? 'Missing/incomplete data' : 'All data complete'}
                  </p>
                </div>
                {totals.alertCount > 0 ? (
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-slate-900">
                  <TabsTrigger value="summary" className="data-[state=active]:bg-cyan-600">
                    <Package className="w-4 h-4 mr-2" />
                    HSN Summary
                  </TabsTrigger>
                  <TabsTrigger value="statewise" className="data-[state=active]:bg-cyan-600">
                    <Map className="w-4 h-4 mr-2" />
                    State-wise
                  </TabsTrigger>
                  <TabsTrigger value="comparison" className="data-[state=active]:bg-cyan-600">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Purchase vs Sales
                  </TabsTrigger>
                  <TabsTrigger value="alerts" className="data-[state=active]:bg-red-600">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Alerts ({totals.alertCount})
                  </TabsTrigger>
                </TabsList>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search HSN or Product..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64 bg-slate-900 border-slate-600 text-white"
                  />
                </div>
              </div>

              {/* HSN Summary Tab */}
              <TabsContent value="summary" className="mt-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">HSN Code</TableHead>
                        <TableHead className="text-slate-300">Product</TableHead>
                        <TableHead className="text-slate-300 text-right">Qty Sold</TableHead>
                        <TableHead className="text-slate-300 text-right">Taxable Value</TableHead>
                        <TableHead className="text-slate-300 text-right">CGST</TableHead>
                        <TableHead className="text-slate-300 text-right">SGST</TableHead>
                        <TableHead className="text-slate-300 text-right">IGST</TableHead>
                        <TableHead className="text-slate-300 text-right">Total GST</TableHead>
                        <TableHead className="text-slate-300 w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHsnSummary.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                            No HSN data found for the selected period
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredHsnSummary.map((hsn, idx) => (
                          <TableRow key={idx} className="border-slate-700 hover:bg-slate-700/50 cursor-pointer"
                            onClick={() => handleDrilldown(hsn.hsn_code)}>
                            <TableCell className="font-mono text-cyan-400">{hsn.hsn_code || '-'}</TableCell>
                            <TableCell className="text-white">
                              <div className="truncate max-w-[200px]">{hsn.product_name || '-'}</div>
                            </TableCell>
                            <TableCell className="text-right text-white">{formatNumber(hsn.quantity_sold)}</TableCell>
                            <TableCell className="text-right text-white">{formatCurrency(hsn.sales_taxable)}</TableCell>
                            <TableCell className="text-right text-green-400">{formatCurrency(hsn.sales_cgst)}</TableCell>
                            <TableCell className="text-right text-green-400">{formatCurrency(hsn.sales_sgst)}</TableCell>
                            <TableCell className="text-right text-purple-400">{formatCurrency(hsn.sales_igst)}</TableCell>
                            <TableCell className="text-right font-semibold text-cyan-400">
                              {formatCurrency((hsn.sales_cgst || 0) + (hsn.sales_sgst || 0) + (hsn.sales_igst || 0))}
                            </TableCell>
                            <TableCell>
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              {/* State-wise Tab */}
              <TabsContent value="statewise" className="mt-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">State</TableHead>
                        <TableHead className="text-slate-300 text-right">Invoice Count</TableHead>
                        <TableHead className="text-slate-300 text-right">Taxable Value</TableHead>
                        <TableHead className="text-slate-300 text-right">CGST</TableHead>
                        <TableHead className="text-slate-300 text-right">SGST</TableHead>
                        <TableHead className="text-slate-300 text-right">IGST</TableHead>
                        <TableHead className="text-slate-300 text-right">Total GST</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stateWiseData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                            No state-wise data available
                          </TableCell>
                        </TableRow>
                      ) : (
                        stateWiseData.map((state, idx) => (
                          <TableRow key={idx} className="border-slate-700 hover:bg-slate-700/50">
                            <TableCell className="text-white font-medium">{state.state || 'Not Specified'}</TableCell>
                            <TableCell className="text-right text-slate-300">{formatNumber(state.invoice_count)}</TableCell>
                            <TableCell className="text-right text-white">{formatCurrency(state.taxable_value)}</TableCell>
                            <TableCell className="text-right text-green-400">{formatCurrency(state.cgst)}</TableCell>
                            <TableCell className="text-right text-green-400">{formatCurrency(state.sgst)}</TableCell>
                            <TableCell className="text-right text-purple-400">{formatCurrency(state.igst)}</TableCell>
                            <TableCell className="text-right font-semibold text-cyan-400">
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
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">HSN Code</TableHead>
                        <TableHead className="text-slate-300">Product</TableHead>
                        <TableHead className="text-slate-300 text-right">Purchase Value</TableHead>
                        <TableHead className="text-slate-300 text-right">Purchase Qty</TableHead>
                        <TableHead className="text-slate-300 text-right">Sales Value</TableHead>
                        <TableHead className="text-slate-300 text-right">Sales Qty</TableHead>
                        <TableHead className="text-slate-300 text-right">Difference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseVsSales.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                            No comparison data available
                          </TableCell>
                        </TableRow>
                      ) : (
                        purchaseVsSales.map((item, idx) => {
                          const diff = (item.sales_value || 0) - (item.purchase_value || 0);
                          return (
                            <TableRow key={idx} className="border-slate-700 hover:bg-slate-700/50">
                              <TableCell className="font-mono text-cyan-400">{item.hsn_code || '-'}</TableCell>
                              <TableCell className="text-white truncate max-w-[200px]">{item.product_name || '-'}</TableCell>
                              <TableCell className="text-right text-orange-400">{formatCurrency(item.purchase_value)}</TableCell>
                              <TableCell className="text-right text-slate-300">{formatNumber(item.purchase_qty)}</TableCell>
                              <TableCell className="text-right text-green-400">{formatCurrency(item.sales_value)}</TableCell>
                              <TableCell className="text-right text-slate-300">{formatNumber(item.sales_qty)}</TableCell>
                              <TableCell className={`text-right font-semibold ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                      <p className="text-lg font-medium text-white">All Data Complete!</p>
                      <p className="text-sm">No missing HSN, GST rate, or state information found.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {missingDataAlerts.map((alert, idx) => (
                        <div key={idx} className="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-orange-600 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <AlertCircle className={`w-5 h-5 mt-0.5 ${
                                alert.severity === 'high' ? 'text-red-400' : 
                                alert.severity === 'medium' ? 'text-orange-400' : 'text-yellow-400'
                              }`} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-medium">{alert.record_type}</span>
                                  <span className="text-slate-400">#{alert.record_number}</span>
                                  <Badge className={
                                    alert.severity === 'high' ? 'bg-red-600' :
                                    alert.severity === 'medium' ? 'bg-orange-600' : 'bg-yellow-600'
                                  }>
                                    {alert.severity}
                                  </Badge>
                                </div>
                                <p className="text-slate-300 text-sm mt-1">{alert.message}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                  {alert.party_name && <span>Party: {alert.party_name}</span>}
                                  {alert.date && <span>Date: {new Date(alert.date).toLocaleDateString()}</span>}
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenCorrection(alert)}
                              className="text-orange-400 border-orange-600 hover:bg-orange-600/20"
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
          </CardContent>
        </Card>

        {/* Drilldown Dialog */}
        <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-cyan-500" />
                HSN {selectedHSN} - State-wise Breakdown
              </DialogTitle>
            </DialogHeader>
            {drilldownData && (
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">State</TableHead>
                      <TableHead className="text-slate-300 text-right">Qty</TableHead>
                      <TableHead className="text-slate-300 text-right">Taxable</TableHead>
                      <TableHead className="text-slate-300 text-right">CGST</TableHead>
                      <TableHead className="text-slate-300 text-right">SGST</TableHead>
                      <TableHead className="text-slate-300 text-right">IGST</TableHead>
                      <TableHead className="text-slate-300 text-right">Invoices</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drilldownData.states?.map((state, idx) => (
                      <TableRow key={idx} className="border-slate-700">
                        <TableCell className="text-white">{state.state}</TableCell>
                        <TableCell className="text-right text-slate-300">{formatNumber(state.quantity)}</TableCell>
                        <TableCell className="text-right text-white">{formatCurrency(state.taxable_value)}</TableCell>
                        <TableCell className="text-right text-green-400">{formatCurrency(state.cgst)}</TableCell>
                        <TableCell className="text-right text-green-400">{formatCurrency(state.sgst)}</TableCell>
                        <TableCell className="text-right text-purple-400">{formatCurrency(state.igst)}</TableCell>
                        <TableCell className="text-right text-slate-300">{state.invoice_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

        {/* Correction Dialog */}
        <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-orange-500" />
                Correct Record Data
              </DialogTitle>
            </DialogHeader>
            {correctionRecord && (
              <div className="space-y-4">
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-sm text-slate-400">Record</p>
                  <p className="text-white font-medium">{correctionRecord.record_type} #{correctionRecord.record_number}</p>
                </div>

                <div>
                  <Label className="text-slate-300">HSN Code</Label>
                  <Input
                    value={correctionForm.hsn_code}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, hsn_code: e.target.value })}
                    placeholder="Enter HSN code"
                    className="bg-slate-900 border-slate-600 text-white mt-1 font-mono"
                    maxLength={8}
                  />
                </div>

                <div>
                  <Label className="text-slate-300">GST Rate (%)</Label>
                  <Select
                    value={correctionForm.gst_rate || 'none'}
                    onValueChange={(v) => setCorrectionForm({ ...correctionForm, gst_rate: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select GST rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select Rate</SelectItem>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="18">18%</SelectItem>
                      <SelectItem value="28">28%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-300">State</Label>
                  <Input
                    value={correctionForm.state}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, state: e.target.value })}
                    placeholder="Enter state"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Reason for Correction *</Label>
                  <Textarea
                    value={correctionForm.reason}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                    placeholder="Explain why this correction is needed"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                    rows={2}
                  />
                </div>
              </div>
            )}
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setCorrectionOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={handleSaveCorrection}
                disabled={actionLoading}
                className="bg-orange-600 hover:bg-orange-700"
              >
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

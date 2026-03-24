import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  BarChart3, Loader2, Download, IndianRupee, TrendingUp, TrendingDown,
  AlertCircle, Clock, FileText, ArrowUpRight, ArrowDownRight, PieChart
} from 'lucide-react';

export default function AccountingReports() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  
  const [receivablesData, setReceivablesData] = useState(null);
  const [payablesData, setPayablesData] = useState(null);
  const [profitData, setProfitData] = useState(null);
  const [activeTab, setActiveTab] = useState('receivables');

  useEffect(() => {
    fetchFirms();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'receivables') fetchReceivables();
    else if (activeTab === 'payables') fetchPayables();
    else if (activeTab === 'profit') fetchProfit();
  }, [activeTab, selectedFirm, dateRange]);

  const fetchFirms = async () => {
    try {
      const res = await axios.get(`${API}/firms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFirms(res.data || []);
    } catch (error) {
      console.error('Failed to fetch firms');
    }
  };

  const fetchReceivables = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedFirm !== 'all') params.firm_id = selectedFirm;
      if (dateRange.to) params.as_of_date = dateRange.to;
      
      const res = await axios.get(`${API}/reports/receivables`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setReceivablesData(res.data);
    } catch (error) {
      toast.error('Failed to load receivables report');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayables = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedFirm !== 'all') params.firm_id = selectedFirm;
      if (dateRange.to) params.as_of_date = dateRange.to;
      
      const res = await axios.get(`${API}/reports/payables`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setPayablesData(res.data);
    } catch (error) {
      toast.error('Failed to load payables report');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfit = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedFirm !== 'all') params.firm_id = selectedFirm;
      if (dateRange.from) params.from_date = dateRange.from;
      if (dateRange.to) params.to_date = dateRange.to;
      
      const res = await axios.get(`${API}/reports/profit-summary`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setProfitData(res.data);
    } catch (error) {
      toast.error('Failed to load profit report');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = (data, filename) => {
    if (!data) return;
    
    let csv = '';
    if (activeTab === 'receivables' && data.by_party) {
      csv = 'Party Name,Invoice Count,Outstanding Amount\n';
      csv += data.by_party.map(p => 
        `"${p.party_name}",${p.invoices.length},${p.total_outstanding}`
      ).join('\n');
    } else if (activeTab === 'payables' && data.by_supplier) {
      csv = 'Supplier Name,GSTIN,Purchase Count,Outstanding Amount\n';
      csv += data.by_supplier.map(s => 
        `"${s.supplier_name}","${s.supplier_gstin || ''}",${s.purchases.length},${s.total_outstanding}`
      ).join('\n');
    } else if (activeTab === 'profit' && data.monthly_breakdown) {
      csv = 'Month,Sales,Purchases,Credit Notes\n';
      csv += Object.entries(data.monthly_breakdown).map(([month, d]) => 
        `${month},${d.sales},${d.purchases},${d.credit_notes}`
      ).join('\n');
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Report exported');
  };

  return (
    <DashboardLayout title="Accounting Reports">
      <div className="space-y-6">
        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-slate-300">Firm</Label>
                <Select value={selectedFirm} onValueChange={setSelectedFirm}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                    <SelectValue placeholder="All Firms" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all" className="text-white">All Firms</SelectItem>
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id} className="text-white">{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">From Date</Label>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300">To Date</Label>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => exportCSV(
                    activeTab === 'receivables' ? receivablesData : 
                    activeTab === 'payables' ? payablesData : profitData,
                    activeTab
                  )}
                  className="border-slate-600 w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="receivables" className="data-[state=active]:bg-green-600">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              Receivables
            </TabsTrigger>
            <TabsTrigger value="payables" className="data-[state=active]:bg-orange-600">
              <ArrowDownRight className="w-4 h-4 mr-1" />
              Payables
            </TabsTrigger>
            <TabsTrigger value="profit" className="data-[state=active]:bg-cyan-600">
              <PieChart className="w-4 h-4 mr-1" />
              Profit Summary
            </TabsTrigger>
          </TabsList>

          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          )}

          {/* Receivables Tab */}
          <TabsContent value="receivables" className="mt-4">
            {receivablesData && !loading && (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <p className="text-slate-400 text-sm">Total Receivable</p>
                      <p className="text-green-400 text-2xl font-bold">
                        ₹{receivablesData.total_receivable?.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <p className="text-slate-400 text-sm">Invoice Count</p>
                      <p className="text-white text-2xl font-bold">{receivablesData.invoice_count}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <p className="text-slate-400 text-sm">Parties with Due</p>
                      <p className="text-white text-2xl font-bold">{receivablesData.party_count}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <p className="text-slate-400 text-sm">Overdue (90+ days)</p>
                      <p className="text-red-400 text-2xl font-bold">
                        ₹{receivablesData.age_analysis?.['90+']?.toLocaleString() || 0}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Age Analysis */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Clock className="w-5 h-5 mr-2" />
                      Age Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      {Object.entries(receivablesData.age_analysis || {}).map(([bucket, amount]) => (
                        <div key={bucket} className="p-4 bg-slate-700/50 rounded-lg text-center">
                          <p className="text-slate-400 text-sm">{bucket} days</p>
                          <p className={`text-xl font-bold ${
                            bucket === '90+' ? 'text-red-400' : 
                            bucket === '61-90' ? 'text-orange-400' : 
                            bucket === '31-60' ? 'text-yellow-400' : 'text-green-400'
                          }`}>
                            ₹{amount.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Party-wise Table */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Party-wise Outstanding</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">Party Name</TableHead>
                          <TableHead className="text-slate-300 text-center">Invoices</TableHead>
                          <TableHead className="text-slate-300 text-right">Outstanding</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receivablesData.by_party?.map((party) => (
                          <TableRow key={party.party_id} className="border-slate-700">
                            <TableCell className="text-white font-medium">{party.party_name}</TableCell>
                            <TableCell className="text-slate-300 text-center">{party.invoices.length}</TableCell>
                            <TableCell className="text-green-400 text-right font-bold">
                              ₹{party.total_outstanding.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Payables Tab */}
          <TabsContent value="payables" className="mt-4">
            {payablesData && !loading && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <p className="text-slate-400 text-sm">Total Payable</p>
                      <p className="text-orange-400 text-2xl font-bold">
                        ₹{payablesData.total_payable?.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <p className="text-slate-400 text-sm">Purchase Count</p>
                      <p className="text-white text-2xl font-bold">{payablesData.purchase_count}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <p className="text-slate-400 text-sm">Suppliers</p>
                      <p className="text-white text-2xl font-bold">{payablesData.supplier_count}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Supplier-wise Outstanding</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {payablesData.by_supplier?.length === 0 ? (
                      <p className="text-center text-slate-400 py-8">No outstanding payables</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700">
                            <TableHead className="text-slate-300">Supplier</TableHead>
                            <TableHead className="text-slate-300">GSTIN</TableHead>
                            <TableHead className="text-slate-300 text-center">Purchases</TableHead>
                            <TableHead className="text-slate-300 text-right">Outstanding</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payablesData.by_supplier?.map((supplier, idx) => (
                            <TableRow key={idx} className="border-slate-700">
                              <TableCell className="text-white font-medium">{supplier.supplier_name}</TableCell>
                              <TableCell className="text-slate-400 font-mono">{supplier.supplier_gstin || '-'}</TableCell>
                              <TableCell className="text-slate-300 text-center">{supplier.purchases.length}</TableCell>
                              <TableCell className="text-orange-400 text-right font-bold">
                                ₹{supplier.total_outstanding.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Profit Summary Tab */}
          <TabsContent value="profit" className="mt-4">
            {profitData && !loading && (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <p className="text-slate-400 text-sm">Net Sales</p>
                      <p className="text-green-400 text-2xl font-bold">
                        ₹{profitData.summary?.net_sales?.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500">
                        After ₹{profitData.summary?.total_credit_notes?.toLocaleString()} credit notes
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <p className="text-slate-400 text-sm">Total Purchases</p>
                      <p className="text-orange-400 text-2xl font-bold">
                        ₹{profitData.summary?.total_purchases?.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <p className="text-slate-400 text-sm">Gross Profit</p>
                      <p className={`text-2xl font-bold ${
                        profitData.summary?.gross_profit >= 0 ? 'text-cyan-400' : 'text-red-400'
                      }`}>
                        ₹{profitData.summary?.gross_profit?.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500">
                        {profitData.summary?.gross_margin_percent}% margin
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <p className="text-slate-400 text-sm">GST Liability</p>
                      <p className={`text-2xl font-bold ${
                        profitData.summary?.gst_liability >= 0 ? 'text-purple-400' : 'text-green-400'
                      }`}>
                        ₹{Math.abs(profitData.summary?.gst_liability || 0).toLocaleString()}
                        <span className="text-sm ml-1">
                          {profitData.summary?.gst_liability >= 0 ? 'payable' : 'credit'}
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Counts */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4 text-center">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-green-400" />
                      <p className="text-2xl font-bold text-white">{profitData.counts?.sales_invoices}</p>
                      <p className="text-slate-400 text-sm">Sales Invoices</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4 text-center">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-orange-400" />
                      <p className="text-2xl font-bold text-white">{profitData.counts?.purchases}</p>
                      <p className="text-slate-400 text-sm">Purchases</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4 text-center">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-red-400" />
                      <p className="text-2xl font-bold text-white">{profitData.counts?.credit_notes}</p>
                      <p className="text-slate-400 text-sm">Credit Notes</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Monthly Breakdown */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      Monthly Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(profitData.monthly_breakdown || {}).length === 0 ? (
                      <p className="text-center text-slate-400 py-8">No data for selected period</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700">
                            <TableHead className="text-slate-300">Month</TableHead>
                            <TableHead className="text-slate-300 text-right">Sales</TableHead>
                            <TableHead className="text-slate-300 text-right">Purchases</TableHead>
                            <TableHead className="text-slate-300 text-right">Credit Notes</TableHead>
                            <TableHead className="text-slate-300 text-right">Net</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(profitData.monthly_breakdown || {}).map(([month, data]) => (
                            <TableRow key={month} className="border-slate-700">
                              <TableCell className="text-white font-medium">{month}</TableCell>
                              <TableCell className="text-green-400 text-right">
                                ₹{data.sales.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-orange-400 text-right">
                                ₹{data.purchases.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-red-400 text-right">
                                ₹{data.credit_notes.toLocaleString()}
                              </TableCell>
                              <TableCell className={`text-right font-bold ${
                                (data.sales - data.credit_notes - data.purchases) >= 0 ? 'text-cyan-400' : 'text-red-400'
                              }`}>
                                ₹{(data.sales - data.credit_notes - data.purchases).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

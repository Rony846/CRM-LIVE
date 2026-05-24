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
        <Card className="mg-card border border-border bg-card">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Firm</Label>
                <Select value={selectedFirm} onValueChange={setSelectedFirm}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All Firms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Firms</SelectItem>
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">From Date</Label>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">To Date</Label>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                  className="mt-1"
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
                  className="border-border text-muted-foreground hover:text-foreground w-full"
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
          <TabsList className="bg-muted border border-border">
            <TabsTrigger
              value="receivables"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide"
            >
              <ArrowUpRight className="w-4 h-4 mr-1" />
              Receivables
            </TabsTrigger>
            <TabsTrigger
              value="payables"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide"
            >
              <ArrowDownRight className="w-4 h-4 mr-1" />
              Payables
            </TabsTrigger>
            <TabsTrigger
              value="profit"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide"
            >
              <PieChart className="w-4 h-4 mr-1" />
              Profit Summary
            </TabsTrigger>
          </TabsList>

          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Receivables Tab */}
          <TabsContent value="receivables" className="mt-4">
            {receivablesData && !loading && (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total Receivable</p>
                    <p className="font-mono text-2xl font-bold tabular-nums text-emerald-500 mt-1">
                      ₹{receivablesData.total_receivable?.toLocaleString()}
                    </p>
                  </div>
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Invoice Count</p>
                    <p className="font-mono text-2xl font-bold tabular-nums text-foreground mt-1">{receivablesData.invoice_count}</p>
                  </div>
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Parties with Due</p>
                    <p className="font-mono text-2xl font-bold tabular-nums text-foreground mt-1">{receivablesData.party_count}</p>
                  </div>
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Overdue (90+ days)</p>
                    <p className="font-mono text-2xl font-bold tabular-nums text-rose-400 mt-1">
                      ₹{receivablesData.age_analysis?.['90+']?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>

                {/* Age Analysis */}
                <Card className="mg-card border border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-foreground flex items-center gap-2 font-mono text-sm uppercase tracking-wide">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      Age Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      {Object.entries(receivablesData.age_analysis || {}).map(([bucket, amount]) => (
                        <div key={bucket} className="p-4 bg-muted/40 border border-border rounded-lg text-center">
                          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{bucket} days</p>
                          <p className={`font-mono text-xl font-bold tabular-nums mt-1 ${
                            bucket === '90+' ? 'text-rose-400' :
                            bucket === '61-90' ? 'text-orange-400' :
                            bucket === '31-60' ? 'text-amber-400' : 'text-emerald-500'
                          }`}>
                            ₹{amount.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Party-wise Table */}
                <Card className="mg-card border border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-foreground font-mono text-sm uppercase tracking-wide">Party-wise Outstanding</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Party Name</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-center">Invoices</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Outstanding</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receivablesData.by_party?.map((party) => (
                          <TableRow key={party.party_id} className="border-border hover:bg-muted/30">
                            <TableCell className="text-foreground font-medium">{party.party_name}</TableCell>
                            <TableCell className="font-mono tabular-nums text-muted-foreground text-center">{party.invoices.length}</TableCell>
                            <TableCell className="font-mono tabular-nums text-emerald-500 text-right font-semibold">
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
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total Payable</p>
                    <p className="font-mono text-2xl font-bold tabular-nums text-orange-400 mt-1">
                      ₹{payablesData.total_payable?.toLocaleString()}
                    </p>
                  </div>
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Purchase Count</p>
                    <p className="font-mono text-2xl font-bold tabular-nums text-foreground mt-1">{payablesData.purchase_count}</p>
                  </div>
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Suppliers</p>
                    <p className="font-mono text-2xl font-bold tabular-nums text-foreground mt-1">{payablesData.supplier_count}</p>
                  </div>
                </div>

                <Card className="mg-card border border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-foreground font-mono text-sm uppercase tracking-wide">Supplier-wise Outstanding</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {payablesData.by_supplier?.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8 font-mono text-[11px]">No outstanding payables</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Supplier</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">GSTIN</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-center">Purchases</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Outstanding</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payablesData.by_supplier?.map((supplier, idx) => (
                            <TableRow key={idx} className="border-border hover:bg-muted/30">
                              <TableCell className="text-foreground font-medium">{supplier.supplier_name}</TableCell>
                              <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">{supplier.supplier_gstin || '-'}</TableCell>
                              <TableCell className="font-mono tabular-nums text-muted-foreground text-center">{supplier.purchases.length}</TableCell>
                              <TableCell className="font-mono tabular-nums text-orange-400 text-right font-semibold">
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
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Net Sales</p>
                    <p className="font-mono text-2xl font-bold tabular-nums text-emerald-500 mt-1">
                      ₹{profitData.summary?.net_sales?.toLocaleString()}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground mt-1">
                      After ₹{profitData.summary?.total_credit_notes?.toLocaleString()} credit notes
                    </p>
                  </div>
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total Purchases</p>
                    <p className="font-mono text-2xl font-bold tabular-nums text-orange-400 mt-1">
                      ₹{profitData.summary?.total_purchases?.toLocaleString()}
                    </p>
                  </div>
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Gross Profit</p>
                    <p className={`font-mono text-2xl font-bold tabular-nums mt-1 ${
                      profitData.summary?.gross_profit >= 0 ? 'text-sky-400' : 'text-rose-400'
                    }`}>
                      ₹{profitData.summary?.gross_profit?.toLocaleString()}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground mt-1">
                      {profitData.summary?.gross_margin_percent}% margin
                    </p>
                  </div>
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">GST Liability</p>
                    <p className={`font-mono text-2xl font-bold tabular-nums mt-1 ${
                      profitData.summary?.gst_liability >= 0 ? 'text-violet-400' : 'text-emerald-500'
                    }`}>
                      ₹{Math.abs(profitData.summary?.gst_liability || 0).toLocaleString()}
                      <span className="text-sm ml-1 font-normal">
                        {profitData.summary?.gst_liability >= 0 ? 'payable' : 'credit'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Counts */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="mg-card border border-border bg-card">
                    <CardContent className="p-4 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-emerald-500/15 text-emerald-500 mx-auto mb-3">
                        <FileText className="w-5 h-5" />
                      </div>
                      <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{profitData.counts?.sales_invoices}</p>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mt-1">Sales Invoices</p>
                    </CardContent>
                  </Card>
                  <Card className="mg-card border border-border bg-card">
                    <CardContent className="p-4 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-orange-400/15 text-orange-400 mx-auto mb-3">
                        <FileText className="w-5 h-5" />
                      </div>
                      <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{profitData.counts?.purchases}</p>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mt-1">Purchases</p>
                    </CardContent>
                  </Card>
                  <Card className="mg-card border border-border bg-card">
                    <CardContent className="p-4 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-rose-500/15 text-rose-400 mx-auto mb-3">
                        <FileText className="w-5 h-5" />
                      </div>
                      <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{profitData.counts?.credit_notes}</p>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mt-1">Credit Notes</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Monthly Breakdown */}
                <Card className="mg-card border border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-foreground flex items-center gap-2 font-mono text-sm uppercase tracking-wide">
                      <BarChart3 className="w-4 h-4 text-muted-foreground" />
                      Monthly Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {Object.keys(profitData.monthly_breakdown || {}).length === 0 ? (
                      <p className="text-center text-muted-foreground py-8 font-mono text-[11px]">No data for selected period</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Month</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Sales</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Purchases</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Credit Notes</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Net</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(profitData.monthly_breakdown || {}).map(([month, data]) => (
                            <TableRow key={month} className="border-border hover:bg-muted/30">
                              <TableCell className="text-foreground font-medium">{month}</TableCell>
                              <TableCell className="font-mono tabular-nums text-emerald-500 text-right">
                                ₹{data.sales.toLocaleString()}
                              </TableCell>
                              <TableCell className="font-mono tabular-nums text-orange-400 text-right">
                                ₹{data.purchases.toLocaleString()}
                              </TableCell>
                              <TableCell className="font-mono tabular-nums text-rose-400 text-right">
                                ₹{data.credit_notes.toLocaleString()}
                              </TableCell>
                              <TableCell className={`font-mono tabular-nums text-right font-bold ${
                                (data.sales - data.credit_notes - data.purchases) >= 0 ? 'text-sky-400' : 'text-rose-400'
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

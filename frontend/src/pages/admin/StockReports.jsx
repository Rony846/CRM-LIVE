import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
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
  FileText, Loader2, Download, Filter, BarChart3, Package, 
  ArrowRightLeft, TrendingUp, TrendingDown, AlertTriangle, Building2, Wrench
} from 'lucide-react';

const ENTRY_TYPE_LABELS = {
  purchase: 'Purchase',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  adjustment_in: 'Adjustment (+)',
  adjustment_out: 'Adjustment (-)',
  dispatch_out: 'Dispatch (Sale)',
  return_in: 'Return Received',
  repair_yard_in: 'Repair Yard In'
};

const ENTRY_TYPE_COLORS = {
  purchase: 'bg-green-600',
  transfer_in: 'bg-blue-600',
  transfer_out: 'bg-orange-600',
  adjustment_in: 'bg-cyan-600',
  adjustment_out: 'bg-red-600',
  dispatch_out: 'bg-purple-600',
  return_in: 'bg-teal-600',
  repair_yard_in: 'bg-yellow-600'
};

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
  }, [token]);

  useEffect(() => {
    if (activeTab) {
      fetchReportData();
    }
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

  return (
    <DashboardLayout title="Stock Movement Reports">
      <div className="space-y-6">
        {/* Filter Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label className="text-slate-300 text-sm">Firm</Label>
                <Select
                  value={filters.firm_id}
                  onValueChange={(v) => setFilters({...filters, firm_id: v === 'all' ? '' : v})}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                    <SelectValue placeholder="All Firms" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all" className="text-white">All Firms</SelectItem>
                    {firms.map(firm => (
                      <SelectItem key={firm.id} value={firm.id} className="text-white">
                        {firm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {activeTab === 'ledger' && (
                <div>
                  <Label className="text-slate-300 text-sm">Entry Type</Label>
                  <Select
                    value={filters.entry_type}
                    onValueChange={(v) => setFilters({...filters, entry_type: v === 'all' ? '' : v})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="all" className="text-white">All Types</SelectItem>
                      {Object.entries(ENTRY_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key} className="text-white">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {activeTab === 'stock' && (
                <div>
                  <Label className="text-slate-300 text-sm">Item Type</Label>
                  <Select
                    value={filters.item_type}
                    onValueChange={(v) => setFilters({...filters, item_type: v === 'all' ? '' : v})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="All Items" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="all" className="text-white">All Items</SelectItem>
                      <SelectItem value="raw_material" className="text-white">Raw Materials</SelectItem>
                      <SelectItem value="finished_good" className="text-white">Finished Goods</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div>
                <Label className="text-slate-300 text-sm">From Date</Label>
                <Input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({...filters, date_from: e.target.value})}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              
              <div>
                <Label className="text-slate-300 text-sm">To Date</Label>
                <Input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({...filters, date_to: e.target.value})}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              
              <div className="flex items-end gap-2">
                <Button onClick={clearFilters} variant="outline" className="flex-1">
                  Clear
                </Button>
                <Button 
                  onClick={() => handleExportCSV(activeTab === 'dispatch_return' ? 'ledger' : activeTab)}
                  disabled={exporting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-slate-800 border-slate-700 flex-wrap">
            <TabsTrigger value="ledger" className="data-[state=active]:bg-cyan-600">
              <FileText className="w-4 h-4 mr-2" />
              Stock Ledger
            </TabsTrigger>
            <TabsTrigger value="stock" className="data-[state=active]:bg-cyan-600">
              <Package className="w-4 h-4 mr-2" />
              Current Stock
            </TabsTrigger>
            <TabsTrigger value="transfers" className="data-[state=active]:bg-cyan-600">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Transfers
            </TabsTrigger>
            <TabsTrigger value="dispatch_return" className="data-[state=active]:bg-cyan-600">
              <TrendingDown className="w-4 h-4 mr-2" />
              Dispatch & Returns
            </TabsTrigger>
            <TabsTrigger value="adjustments" className="data-[state=active]:bg-cyan-600">
              <Wrench className="w-4 h-4 mr-2" />
              Adjustments
            </TabsTrigger>
          </TabsList>

          {/* Stock Ledger Tab */}
          <TabsContent value="ledger">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Stock Ledger Report</CardTitle>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-400">In: {ledgerData.totals?.total_in || 0}</span>
                    <span className="text-red-400">Out: {ledgerData.totals?.total_out || 0}</span>
                    <span className="text-slate-300">Entries: {ledgerData.totals?.total_entries || 0}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
                ) : ledgerData.entries?.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">No ledger entries found</div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-800">
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">Entry #</TableHead>
                          <TableHead className="text-slate-300">Date</TableHead>
                          <TableHead className="text-slate-300">Type</TableHead>
                          <TableHead className="text-slate-300">Item</TableHead>
                          <TableHead className="text-slate-300">Firm</TableHead>
                          <TableHead className="text-slate-300 text-right">Qty</TableHead>
                          <TableHead className="text-slate-300 text-right">Balance</TableHead>
                          <TableHead className="text-slate-300">Invoice/Ref</TableHead>
                          <TableHead className="text-slate-300">Reason</TableHead>
                          <TableHead className="text-slate-300">By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerData.entries.map((entry) => (
                          <TableRow key={entry.id} className="border-slate-700">
                            <TableCell className="text-white font-mono text-xs">{entry.entry_number}</TableCell>
                            <TableCell className="text-slate-400 text-sm">{entry.created_at?.slice(0, 10)}</TableCell>
                            <TableCell>
                              <Badge className={ENTRY_TYPE_COLORS[entry.entry_type] || 'bg-slate-600'}>
                                {ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-white">
                              <div>{entry.item_name}</div>
                              <div className="text-xs text-slate-400">{entry.item_sku}</div>
                            </TableCell>
                            <TableCell className="text-slate-300">{entry.firm_name}</TableCell>
                            <TableCell className={`text-right font-medium ${
                              ['purchase', 'transfer_in', 'adjustment_in', 'return_in', 'repair_yard_in'].includes(entry.entry_type)
                                ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {['purchase', 'transfer_in', 'adjustment_in', 'return_in', 'repair_yard_in'].includes(entry.entry_type) ? '+' : '-'}
                              {entry.quantity}
                            </TableCell>
                            <TableCell className="text-white text-right">{entry.running_balance}</TableCell>
                            <TableCell className="text-slate-400 text-sm">{entry.invoice_number || '-'}</TableCell>
                            <TableCell className="text-slate-400 text-sm max-w-[150px] truncate">{entry.reason || '-'}</TableCell>
                            <TableCell className="text-slate-400 text-sm">{entry.created_by_name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Current Stock Tab */}
          <TabsContent value="stock">
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard 
                  title="Raw Materials" 
                  value={stockData.totals?.total_raw_materials || 0}
                  icon={Package}
                  color="cyan"
                />
                <StatCard 
                  title="Finished Goods" 
                  value={stockData.totals?.total_finished_goods || 0}
                  icon={Package}
                  color="blue"
                />
                <StatCard 
                  title="Low Stock Items" 
                  value={stockData.totals?.low_stock_count || 0}
                  icon={AlertTriangle}
                  color={stockData.totals?.low_stock_count > 0 ? 'orange' : 'green'}
                />
                <StatCard 
                  title="Negative Stock" 
                  value={stockData.totals?.negative_stock_count || 0}
                  icon={AlertTriangle}
                  color={stockData.totals?.negative_stock_count > 0 ? 'red' : 'green'}
                />
              </div>

              {/* Firm Summary */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Stock by Firm</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700">
                            <TableHead className="text-slate-300">Firm</TableHead>
                            <TableHead className="text-slate-300">GSTIN</TableHead>
                            <TableHead className="text-slate-300 text-right">Raw Materials</TableHead>
                            <TableHead className="text-slate-300 text-right">RM Qty</TableHead>
                            <TableHead className="text-slate-300 text-right">Finished Goods</TableHead>
                            <TableHead className="text-slate-300 text-right">FG Qty</TableHead>
                            <TableHead className="text-slate-300">Low Stock Items</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stockData.firms_summary?.map((firm) => (
                            <TableRow key={firm.firm_id} className="border-slate-700">
                              <TableCell className="text-white font-medium">{firm.firm_name}</TableCell>
                              <TableCell className="text-slate-400 font-mono text-sm">{firm.gstin}</TableCell>
                              <TableCell className="text-slate-300 text-right">{firm.raw_materials_count}</TableCell>
                              <TableCell className="text-cyan-400 text-right font-medium">{firm.raw_materials_qty}</TableCell>
                              <TableCell className="text-slate-300 text-right">{firm.finished_goods_count}</TableCell>
                              <TableCell className="text-blue-400 text-right font-medium">{firm.finished_goods_qty}</TableCell>
                              <TableCell>
                                {firm.low_stock_items?.length > 0 ? (
                                  <span className="text-orange-400 text-sm">{firm.low_stock_items.slice(0, 3).join(', ')}{firm.low_stock_items.length > 3 ? '...' : ''}</span>
                                ) : (
                                  <span className="text-green-400 text-sm">None</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Transfers Tab */}
          <TabsContent value="transfers">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Transfer Report</CardTitle>
                  <div className="flex gap-4 text-sm">
                    <span className="text-slate-300">Total Transfers: {transferData.totals?.total_transfers || 0}</span>
                    <span className="text-cyan-400">Total Qty: {transferData.totals?.total_quantity || 0}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
                ) : transferData.transfers?.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">No transfers found</div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-800">
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">Transfer #</TableHead>
                          <TableHead className="text-slate-300">Date</TableHead>
                          <TableHead className="text-slate-300">Item</TableHead>
                          <TableHead className="text-slate-300">From</TableHead>
                          <TableHead className="text-slate-300">To</TableHead>
                          <TableHead className="text-slate-300 text-right">Qty</TableHead>
                          <TableHead className="text-slate-300">Invoice</TableHead>
                          <TableHead className="text-slate-300">By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transferData.transfers.map((t) => (
                          <TableRow key={t.id} className="border-slate-700">
                            <TableCell className="text-white font-mono text-sm">{t.transfer_number}</TableCell>
                            <TableCell className="text-slate-400 text-sm">{t.created_at?.slice(0, 10)}</TableCell>
                            <TableCell className="text-white">
                              <div>{t.item_name}</div>
                              <div className="text-xs text-slate-400">{t.item_sku}</div>
                            </TableCell>
                            <TableCell className="text-orange-400">{t.from_firm_name}</TableCell>
                            <TableCell className="text-green-400">{t.to_firm_name}</TableCell>
                            <TableCell className="text-white text-right font-medium">{t.quantity}</TableCell>
                            <TableCell className="text-cyan-400 font-mono">{t.invoice_number}</TableCell>
                            <TableCell className="text-slate-400 text-sm">{t.created_by_name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dispatch & Returns Tab */}
          <TabsContent value="dispatch_return">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Dispatch & Return Report</CardTitle>
                  <div className="flex gap-4 text-sm">
                    <span className="text-purple-400">Dispatched: {dispatchReturnData.totals?.total_dispatched || 0}</span>
                    <span className="text-teal-400">Returned: {dispatchReturnData.totals?.total_returned || 0}</span>
                    <span className="text-white">Net Out: {dispatchReturnData.totals?.net_out || 0}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Dispatches */}
                    <div>
                      <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-purple-400" />
                        Dispatches ({dispatchReturnData.totals?.dispatch_count || 0})
                      </h3>
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-slate-800">
                            <TableRow className="border-slate-700">
                              <TableHead className="text-slate-300">Entry</TableHead>
                              <TableHead className="text-slate-300">Item</TableHead>
                              <TableHead className="text-slate-300 text-right">Qty</TableHead>
                              <TableHead className="text-slate-300">Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dispatchReturnData.dispatches?.map((e) => (
                              <TableRow key={e.id} className="border-slate-700">
                                <TableCell className="text-white font-mono text-xs">{e.entry_number}</TableCell>
                                <TableCell className="text-slate-300">{e.item_sku}</TableCell>
                                <TableCell className="text-red-400 text-right">-{e.quantity}</TableCell>
                                <TableCell className="text-slate-400 text-sm">{e.created_at?.slice(0, 10)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    
                    {/* Returns */}
                    <div>
                      <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-teal-400" />
                        Returns ({dispatchReturnData.totals?.return_count || 0})
                      </h3>
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-slate-800">
                            <TableRow className="border-slate-700">
                              <TableHead className="text-slate-300">Entry</TableHead>
                              <TableHead className="text-slate-300">Item</TableHead>
                              <TableHead className="text-slate-300 text-right">Qty</TableHead>
                              <TableHead className="text-slate-300">Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dispatchReturnData.returns?.map((e) => (
                              <TableRow key={e.id} className="border-slate-700">
                                <TableCell className="text-white font-mono text-xs">{e.entry_number}</TableCell>
                                <TableCell className="text-slate-300">{e.item_sku}</TableCell>
                                <TableCell className="text-green-400 text-right">+{e.quantity}</TableCell>
                                <TableCell className="text-slate-400 text-sm">{e.created_at?.slice(0, 10)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Adjustments Tab */}
          <TabsContent value="adjustments">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Adjustments & Repair Yard Report</CardTitle>
                  <div className="flex gap-4 text-sm">
                    <span className="text-cyan-400">Adj In: {adjustmentData.totals?.adjustment_in_qty || 0}</span>
                    <span className="text-red-400">Adj Out: {adjustmentData.totals?.adjustment_out_qty || 0}</span>
                    <span className="text-yellow-400">Repair Yard: {adjustmentData.totals?.repair_yard_qty || 0}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
                ) : adjustmentData.all_entries?.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">No adjustments found</div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-800">
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">Entry #</TableHead>
                          <TableHead className="text-slate-300">Date</TableHead>
                          <TableHead className="text-slate-300">Type</TableHead>
                          <TableHead className="text-slate-300">Item</TableHead>
                          <TableHead className="text-slate-300">Firm</TableHead>
                          <TableHead className="text-slate-300 text-right">Qty</TableHead>
                          <TableHead className="text-slate-300">Reason</TableHead>
                          <TableHead className="text-slate-300">By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adjustmentData.all_entries.map((e) => (
                          <TableRow key={e.id} className="border-slate-700">
                            <TableCell className="text-white font-mono text-xs">{e.entry_number}</TableCell>
                            <TableCell className="text-slate-400 text-sm">{e.created_at?.slice(0, 10)}</TableCell>
                            <TableCell>
                              <Badge className={ENTRY_TYPE_COLORS[e.entry_type]}>
                                {ENTRY_TYPE_LABELS[e.entry_type]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-white">
                              <div>{e.item_name}</div>
                              <div className="text-xs text-slate-400">{e.item_sku}</div>
                            </TableCell>
                            <TableCell className="text-slate-300">{e.firm_name}</TableCell>
                            <TableCell className={`text-right font-medium ${
                              e.entry_type === 'adjustment_out' ? 'text-red-400' : 'text-green-400'
                            }`}>
                              {e.entry_type === 'adjustment_out' ? '-' : '+'}{e.quantity}
                            </TableCell>
                            <TableCell className="text-slate-300 max-w-[200px]">
                              <div className="truncate" title={e.reason}>{e.reason || '-'}</div>
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">{e.created_by_name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

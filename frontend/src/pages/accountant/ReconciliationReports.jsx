import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  RefreshCw, Loader2, AlertTriangle, CheckCircle, IndianRupee,
  FileText, Package, Truck, Wallet, Calendar, ChevronLeft, Scale
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ReconciliationReports() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchFirms();
  }, [token]);

  useEffect(() => {
    if (token) fetchData();
  }, [token, selectedFirm, selectedMonth]);

  const fetchFirms = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/firms`, { headers });
      setFirms(res.data || []);
    } catch (error) {
      console.error('Failed to fetch firms:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = { month: selectedMonth };
      if (selectedFirm !== 'all') params.firm_id = selectedFirm;
      
      const res = await axios.get(`${API}/compliance/reconciliation`, { headers, params });
      setData(res.data);
    } catch (error) {
      console.error('Failed to fetch reconciliation data:', error);
      toast.error('Failed to load reconciliation report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Generate month options (last 12 months)
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'important': return 'bg-orange-600';
      case 'minor': return 'bg-yellow-600';
      default: return 'bg-slate-600';
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Monthly Reconciliation">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Monthly Reconciliation">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Scale className="w-7 h-7 text-cyan-400" />
                Monthly Reconciliation Report
              </h1>
              <p className="text-slate-400">Cross-verify registers, ledgers, and transactions</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={fetchData}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-48">
                <label className="text-slate-400 text-xs block mb-1">Month</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {getMonthOptions().map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-56">
                <label className="text-slate-400 text-xs block mb-1">Firm</label>
                <Select value={selectedFirm} onValueChange={setSelectedFirm}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue placeholder="All Firms" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="all">All Firms</SelectItem>
                    {firms.map(firm => (
                      <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1" />
              
              <div className="text-right">
                <p className="text-slate-500 text-xs">Generated at</p>
                <p className="text-white text-sm">
                  {data?.generated_at ? new Date(data.generated_at).toLocaleString('en-IN') : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discrepancies Alert */}
        {data?.discrepancy_count > 0 && (
          <Card className="bg-red-900/30 border-red-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <div>
                  <p className="text-red-300 font-medium">
                    {data.discrepancy_count} Discrepanc{data.discrepancy_count === 1 ? 'y' : 'ies'} Found
                  </p>
                  <p className="text-red-400 text-sm">Review the details below and take corrective action</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reconciliation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Purchase Reconciliation */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-400" />
                Purchase vs Stock Inward
                {data?.purchase_reconciliation?.match ? (
                  <Badge className="bg-green-600 ml-auto"><CheckCircle className="w-3 h-3 mr-1" />Match</Badge>
                ) : (
                  <Badge className="bg-red-600 ml-auto"><AlertTriangle className="w-3 h-3 mr-1" />Mismatch</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow className="border-slate-700">
                    <TableCell className="text-slate-400">Purchase Register Entries</TableCell>
                    <TableCell className="text-right text-white font-semibold">
                      {data?.purchase_reconciliation?.purchase_register_count || 0}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-slate-700">
                    <TableCell className="text-slate-400">Purchase Register Value</TableCell>
                    <TableCell className="text-right text-white">
                      {formatCurrency(data?.purchase_reconciliation?.purchase_register_value)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-slate-700">
                    <TableCell className="text-slate-400">Stock Inward Entries</TableCell>
                    <TableCell className="text-right text-white font-semibold">
                      {data?.purchase_reconciliation?.stock_inward_count || 0}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sales Reconciliation */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-400" />
                Sales vs Dispatch
                {data?.sales_reconciliation?.match ? (
                  <Badge className="bg-green-600 ml-auto"><CheckCircle className="w-3 h-3 mr-1" />Match</Badge>
                ) : (
                  <Badge className="bg-red-600 ml-auto"><AlertTriangle className="w-3 h-3 mr-1" />Mismatch</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow className="border-slate-700">
                    <TableCell className="text-slate-400">Sales Register Entries</TableCell>
                    <TableCell className="text-right text-white font-semibold">
                      {data?.sales_reconciliation?.sales_register_count || 0}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-slate-700">
                    <TableCell className="text-slate-400">Sales Register Value</TableCell>
                    <TableCell className="text-right text-white">
                      {formatCurrency(data?.sales_reconciliation?.sales_register_value)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-slate-700">
                    <TableCell className="text-slate-400">Dispatches</TableCell>
                    <TableCell className="text-right text-white font-semibold">
                      {data?.sales_reconciliation?.dispatch_count || 0}
                    </TableCell>
                  </TableRow>
                  {data?.sales_reconciliation?.dispatches_without_invoice > 0 && (
                    <TableRow className="border-slate-700 bg-red-900/20">
                      <TableCell className="text-red-400">Dispatches Without Invoice</TableCell>
                      <TableCell className="text-right text-red-400 font-semibold">
                        {data.sales_reconciliation.dispatches_without_invoice}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment Reconciliation */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-purple-400" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow className="border-slate-700">
                    <TableCell className="text-slate-400">Payments Received</TableCell>
                    <TableCell className="text-right text-green-400 font-semibold">
                      +{formatCurrency(data?.payment_reconciliation?.payments_received_value)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-slate-700">
                    <TableCell className="text-slate-500 text-sm pl-6">Count</TableCell>
                    <TableCell className="text-right text-slate-400">
                      {data?.payment_reconciliation?.payments_received_count || 0} transactions
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-slate-700">
                    <TableCell className="text-slate-400">Payments Made</TableCell>
                    <TableCell className="text-right text-red-400 font-semibold">
                      -{formatCurrency(data?.payment_reconciliation?.payments_made_value)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-slate-700">
                    <TableCell className="text-slate-500 text-sm pl-6">Count</TableCell>
                    <TableCell className="text-right text-slate-400">
                      {data?.payment_reconciliation?.payments_made_count || 0} transactions
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-slate-700 bg-orange-900/20">
                    <TableCell className="text-orange-400">Outstanding Receivable</TableCell>
                    <TableCell className="text-right text-orange-400 font-semibold">
                      {formatCurrency(data?.payment_reconciliation?.outstanding_receivable)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-slate-700 bg-red-900/20">
                    <TableCell className="text-red-400">Outstanding Payable</TableCell>
                    <TableCell className="text-right text-red-400 font-semibold">
                      {formatCurrency(data?.payment_reconciliation?.outstanding_payable)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* GST Reconciliation */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-cyan-400" />
                GST Reconciliation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow className="border-slate-700">
                    <TableCell className="text-slate-400">Output GST (Sales)</TableCell>
                    <TableCell className="text-right text-white">
                      {formatCurrency(data?.gst_reconciliation?.sales_gst)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-slate-700">
                    <TableCell className="text-slate-400">Input Tax Credit (Purchases)</TableCell>
                    <TableCell className="text-right text-green-400">
                      -{formatCurrency(data?.gst_reconciliation?.purchase_gst_itc)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-slate-700 bg-cyan-900/30">
                    <TableCell className="text-cyan-300 font-medium">Net GST Liability</TableCell>
                    <TableCell className={`text-right font-bold ${(data?.gst_reconciliation?.net_gst_liability || 0) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatCurrency(data?.gst_reconciliation?.net_gst_liability)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-slate-500 text-xs mt-3 italic">
                {data?.gst_reconciliation?.note}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Discrepancies Table */}
        {data?.discrepancies?.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Discrepancies Found
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Type</TableHead>
                    <TableHead className="text-slate-400">Description</TableHead>
                    <TableHead className="text-slate-400">Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.discrepancies.map((d, idx) => (
                    <TableRow key={idx} className="border-slate-700">
                      <TableCell className="text-white font-mono text-sm">
                        {d.type.replace(/_/g, ' ').toUpperCase()}
                      </TableCell>
                      <TableCell className="text-slate-300">{d.description}</TableCell>
                      <TableCell>
                        <Badge className={`${getSeverityColor(d.severity)} text-white`}>
                          {d.severity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* No Discrepancies Message */}
        {data?.discrepancy_count === 0 && (
          <Card className="bg-green-900/30 border-green-700">
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-green-300 font-medium text-lg">All Clear!</p>
              <p className="text-green-400 text-sm">No discrepancies found for {selectedMonth}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

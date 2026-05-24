import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  RefreshCw, Loader2, AlertTriangle, CheckCircle, IndianRupee,
  FileText, Package, Truck, Wallet, Calendar, ChevronLeft, Scale
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SeverityBadge = ({ severity }) => {
  const tones = {
    critical:  'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25',
    important: 'bg-orange-400/15 text-orange-400 ring-1 ring-orange-400/25',
    minor:     'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25',
  };
  const tone = tones[severity] || 'bg-muted text-muted-foreground ring-1 ring-border';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ${tone}`}>
      {severity}
    </span>
  );
};

const MatchBadge = ({ match }) => (
  match ? (
    <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25 flex items-center gap-1">
      <CheckCircle className="w-3 h-3" /> Match
    </span>
  ) : (
    <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25 flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" /> Mismatch
    </span>
  )
);

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

  if (loading) {
    return (
      <DashboardLayout title="Monthly Reconciliation">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Scale className="w-6 h-6 text-sky-400" />
                Monthly Reconciliation Report
              </h1>
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                Cross-verify registers, ledgers, and transactions
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={fetchData}
            className="border-border text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card className="mg-card border border-border bg-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-48">
                <label className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">Month</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getMonthOptions().map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-56">
                <label className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">Firm</label>
                <Select value={selectedFirm} onValueChange={setSelectedFirm}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Firms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Firms</SelectItem>
                    {firms.map(firm => (
                      <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1" />

              <div className="text-right">
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Generated at</p>
                <p className="font-mono text-sm tabular-nums text-foreground mt-0.5">
                  {data?.generated_at ? new Date(data.generated_at).toLocaleString('en-IN') : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discrepancies Alert */}
        {data?.discrepancy_count > 0 && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/25">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-rose-400">
                  {data.discrepancy_count} Discrepanc{data.discrepancy_count === 1 ? 'y' : 'ies'} Found
                </p>
                <p className="font-mono text-[11px] text-rose-400/70 mt-0.5">
                  Review the details below and take corrective action
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reconciliation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Purchase Reconciliation */}
          <Card className="mg-card border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground flex items-center gap-2 font-mono text-sm uppercase tracking-wide">
                <Package className="w-4 h-4 text-sky-400" />
                Purchase vs Stock Inward
                <MatchBadge match={data?.purchase_reconciliation?.match} />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="text-muted-foreground">Purchase Register Entries</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground font-semibold">
                      {data?.purchase_reconciliation?.purchase_register_count || 0}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="text-muted-foreground">Purchase Register Value</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground">
                      {formatCurrency(data?.purchase_reconciliation?.purchase_register_value)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="text-muted-foreground">Stock Inward Entries</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground font-semibold">
                      {data?.purchase_reconciliation?.stock_inward_count || 0}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sales Reconciliation */}
          <Card className="mg-card border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground flex items-center gap-2 font-mono text-sm uppercase tracking-wide">
                <FileText className="w-4 h-4 text-emerald-500" />
                Sales vs Dispatch
                <MatchBadge match={data?.sales_reconciliation?.match} />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="text-muted-foreground">Sales Register Entries</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground font-semibold">
                      {data?.sales_reconciliation?.sales_register_count || 0}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="text-muted-foreground">Sales Register Value</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground">
                      {formatCurrency(data?.sales_reconciliation?.sales_register_value)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="text-muted-foreground">Dispatches</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground font-semibold">
                      {data?.sales_reconciliation?.dispatch_count || 0}
                    </TableCell>
                  </TableRow>
                  {data?.sales_reconciliation?.dispatches_without_invoice > 0 && (
                    <TableRow className="border-border bg-rose-500/10">
                      <TableCell className="text-rose-400">Dispatches Without Invoice</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-rose-400 font-semibold">
                        {data.sales_reconciliation.dispatches_without_invoice}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment Reconciliation */}
          <Card className="mg-card border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground flex items-center gap-2 font-mono text-sm uppercase tracking-wide">
                <Wallet className="w-4 h-4 text-violet-400" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="text-muted-foreground">Payments Received</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-emerald-500 font-semibold">
                      +{formatCurrency(data?.payment_reconciliation?.payments_received_value)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="text-muted-foreground text-sm pl-6">Count</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {data?.payment_reconciliation?.payments_received_count || 0} transactions
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="text-muted-foreground">Payments Made</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-rose-400 font-semibold">
                      -{formatCurrency(data?.payment_reconciliation?.payments_made_value)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="text-muted-foreground text-sm pl-6">Count</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {data?.payment_reconciliation?.payments_made_count || 0} transactions
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-border bg-orange-400/[0.06]">
                    <TableCell className="text-orange-400">Outstanding Receivable</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-orange-400 font-semibold">
                      {formatCurrency(data?.payment_reconciliation?.outstanding_receivable)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-border bg-rose-500/[0.06]">
                    <TableCell className="text-rose-400">Outstanding Payable</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-rose-400 font-semibold">
                      {formatCurrency(data?.payment_reconciliation?.outstanding_payable)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* GST Reconciliation */}
          <Card className="mg-card border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground flex items-center gap-2 font-mono text-sm uppercase tracking-wide">
                <IndianRupee className="w-4 h-4 text-sky-400" />
                GST Reconciliation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="text-muted-foreground">Output GST (Sales)</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground">
                      {formatCurrency(data?.gst_reconciliation?.sales_gst)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-border hover:bg-muted/20">
                    <TableCell className="text-muted-foreground">Input Tax Credit (Purchases)</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-emerald-500">
                      -{formatCurrency(data?.gst_reconciliation?.purchase_gst_itc)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-border bg-muted/40">
                    <TableCell className="text-sky-400 font-medium">Net GST Liability</TableCell>
                    <TableCell className={`text-right font-mono tabular-nums font-bold ${(data?.gst_reconciliation?.net_gst_liability || 0) >= 0 ? 'text-rose-400' : 'text-emerald-500'}`}>
                      {formatCurrency(data?.gst_reconciliation?.net_gst_liability)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              {data?.gst_reconciliation?.note && (
                <p className="font-mono text-[10px] text-muted-foreground italic p-4 pt-3">
                  {data.gst_reconciliation.note}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Discrepancies Table */}
        {data?.discrepancies?.length > 0 && (
          <Card className="mg-card border border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2 font-mono text-sm uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Discrepancies Found
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Type</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Description</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.discrepancies.map((d, idx) => (
                    <TableRow key={idx} className="border-border hover:bg-muted/30">
                      <TableCell className="font-mono text-sm text-foreground">
                        {d.type.replace(/_/g, ' ').toUpperCase()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.description}</TableCell>
                      <TableCell>
                        <SeverityBadge severity={d.severity} />
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
          <div className="p-6 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="font-semibold text-emerald-500 text-lg">All Clear!</p>
            <p className="font-mono text-[11px] uppercase tracking-wide text-emerald-500/70 mt-1">
              No discrepancies found for {selectedMonth}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

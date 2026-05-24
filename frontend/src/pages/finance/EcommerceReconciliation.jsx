import React, { useState, useEffect, useCallback } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle,
  IndianRupee, Package, RefreshCw, Loader2, Search, Filter, Link2,
  ShoppingCart, Building2, Calendar, Clock, TrendingUp, TrendingDown,
  ExternalLink, ChevronRight, Eye, AlertCircle, Banknote, ReceiptText,
  Trash2, CheckCheck, CreditCard
} from 'lucide-react';

const formatCurrency = (amount, decimals = 0) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const PLATFORMS = [
  { value: 'amazon', label: 'Amazon', color: 'bg-orange-500' },
  { value: 'flipkart', label: 'Flipkart', color: 'bg-yellow-500' }
];

export default function EcommerceReconciliation() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('statements');
  
  // Data states
  const [firms, setFirms] = useState([]);
  const [statements, setStatements] = useState([]);
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [statementDetails, setStatementDetails] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  
  // Filter states
  const [firmFilter, setFirmFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [matchFilter, setMatchFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Upload states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadPlatform, setUploadPlatform] = useState('amazon');
  const [uploadFirmId, setUploadFirmId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // MTR Upload states
  const [mtrUploadDialogOpen, setMtrUploadDialogOpen] = useState(false);
  const [mtrType, setMtrType] = useState('b2c');
  const [mtrPlatform, setMtrPlatform] = useState('amazon'); // 'amazon', 'flipkart', or 'vyapar'
  const [mtrFirmId, setMtrFirmId] = useState('');
  const [mtrFile, setMtrFile] = useState(null);
  const [mtrUploading, setMtrUploading] = useState(false);
  const [mtrReports, setMtrReports] = useState([]);
  const [mtrPeriodMonth, setMtrPeriodMonth] = useState(new Date().getMonth() + 1);
  const [mtrPeriodYear, setMtrPeriodYear] = useState(new Date().getFullYear());
  
  // Consolidated report states
  const [consolidatedDialogOpen, setConsolidatedDialogOpen] = useState(false);
  const [consolidatedFirmId, setConsolidatedFirmId] = useState('');
  const [consolidatedMonth, setConsolidatedMonth] = useState(new Date().getMonth() + 1);
  const [consolidatedYear, setConsolidatedYear] = useState(new Date().getFullYear());
  const [consolidatedType, setConsolidatedType] = useState('gstr1');
  const [consolidatedPreview, setConsolidatedPreview] = useState(null);
  const [consolidatedLoading, setConsolidatedLoading] = useState(false);
  
  // Link dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkTransaction, setLinkTransaction] = useState(null);
  const [linkDispatchId, setLinkDispatchId] = useState('');
  const [dispatchSearch, setDispatchSearch] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [manualOrderId, setManualOrderId] = useState('');
  const [linkMode, setLinkMode] = useState('search'); // 'search' or 'manual'

  const headers = { Authorization: `Bearer ${token}` };

  const fetchFirms = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/firms`, { headers });
      setFirms(res.data || []);
    } catch (error) {
      console.error('Failed to fetch firms:', error);
    }
  }, [token]);

  const fetchStatements = useCallback(async () => {
    try {
      const params = {};
      if (platformFilter && platformFilter !== 'all') params.platform = platformFilter;
      if (firmFilter && firmFilter !== 'all') params.firm_id = firmFilter;
      const res = await axios.get(`${API}/ecommerce/statements`, { headers, params });
      setStatements(res.data);
    } catch (error) {
      toast.error('Failed to fetch statements');
    }
  }, [token, platformFilter, firmFilter]);

  const fetchAlerts = useCallback(async (statementId = null) => {
    try {
      const params = statementId ? { statement_id: statementId } : {};
      const res = await axios.get(`${API}/ecommerce/alerts`, { headers, params });
      setAlerts(res.data);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  }, [token]);

  const fetchStatementDetails = async (statementId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/ecommerce/statements/${statementId}`, { headers });
      setStatementDetails(res.data);
      setSelectedStatement(res.data.statement);
      await fetchAlerts(statementId);
    } catch (error) {
      toast.error('Failed to fetch statement details');
    } finally {
      setLoading(false);
    }
  };

  const fetchDispatches = async (search = '') => {
    try {
      const params = { limit: 50 };
      if (search) params.search = search;
      const res = await axios.get(`${API}/dispatches`, { headers, params });
      setDispatches(res.data?.dispatches || res.data || []);
    } catch (error) {
      console.error('Failed to fetch dispatches:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchFirms();
      await fetchStatements();
      await fetchAlerts();
      await fetchMtrReports();
      setLoading(false);
    };
    loadData();
  }, [fetchStatements, fetchAlerts, fetchFirms]);

  const fetchMtrReports = async () => {
    try {
      const res = await axios.get(`${API}/ecommerce/mtr-reports`, { headers });
      setMtrReports(res.data || []);
    } catch (error) {
      console.error('Failed to fetch MTR reports:', error);
    }
  };

  const handleMtrUpload = async (e) => {
    e.preventDefault();
    if (!mtrFile) {
      toast.error('Please select a file');
      return;
    }
    if (!mtrFirmId) {
      toast.error('Please select a firm');
      return;
    }

    setMtrUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', mtrFile);

      let url;
      if (mtrPlatform === 'flipkart') {
        url = `${API}/ecommerce/upload-flipkart-sales?report_type=${mtrType}&firm_id=${mtrFirmId}`;
      } else if (mtrPlatform === 'vyapar') {
        url = `${API}/ecommerce/upload-vyapar-gstr?report_type=${mtrType}&firm_id=${mtrFirmId}&period_month=${mtrPeriodMonth}&period_year=${mtrPeriodYear}`;
      } else {
        url = `${API}/ecommerce/upload-mtr?mtr_type=${mtrType}&firm_id=${mtrFirmId}`;
      }

      const res = await axios.post(url, formData, { 
        headers: { ...headers, 'Content-Type': 'multipart/form-data' } 
      });

      toast.success(res.data.message || 'Report uploaded successfully');
      setMtrUploadDialogOpen(false);
      setMtrFile(null);
      setMtrFirmId('');
      setMtrPlatform('amazon');
      setMtrType('b2c');
      await fetchMtrReports();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setMtrUploading(false);
    }
  };

  const fetchConsolidatedPreview = async () => {
    if (!consolidatedFirmId) {
      toast.error('Please select a firm');
      return;
    }
    
    setConsolidatedLoading(true);
    try {
      const res = await axios.get(
        `${API}/gst/consolidated-report?firm_id=${consolidatedFirmId}&period_month=${consolidatedMonth}&period_year=${consolidatedYear}&report_type=${consolidatedType}`,
        { headers }
      );
      setConsolidatedPreview(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to fetch preview');
    } finally {
      setConsolidatedLoading(false);
    }
  };

  const downloadConsolidatedReport = async () => {
    if (!consolidatedFirmId) {
      toast.error('Please select a firm');
      return;
    }
    
    setConsolidatedLoading(true);
    try {
      const response = await axios.get(
        `${API}/gst/download-consolidated?firm_id=${consolidatedFirmId}&period_month=${consolidatedMonth}&period_year=${consolidatedYear}&report_type=${consolidatedType}`,
        { headers, responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Consolidated_${consolidatedType.toUpperCase()}_${consolidatedYear}-${consolidatedMonth.toString().padStart(2, '0')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report downloaded!');
    } catch (error) {
      toast.error('Failed to download report');
    } finally {
      setConsolidatedLoading(false);
    }
  };

  const handleDeleteMtrReport = async (reportId) => {
    try {
      await axios.delete(`${API}/ecommerce/mtr-reports/${reportId}`, { headers });
      toast.success('MTR report deleted');
      await fetchMtrReports();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete report');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }
    if (!uploadFirmId) {
      toast.error('Please select a firm');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const res = await axios.post(
        `${API}/ecommerce/upload-payout?platform=${uploadPlatform}&firm_id=${uploadFirmId}`,
        formData,
        { headers: { ...headers, 'Content-Type': 'multipart/form-data' } }
      );

      toast.success(res.data.message || 'Statement uploaded successfully');
      setUploadDialogOpen(false);
      setUploadFile(null);
      setUploadFirmId('');
      await fetchStatements();
      await fetchAlerts();
      
      // Auto-open the uploaded statement
      if (res.data.statement_id) {
        await fetchStatementDetails(res.data.statement_id);
        setActiveTab('details');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleLinkTransaction = async () => {
    if (!linkTransaction) {
      toast.error('No transaction selected');
      return;
    }
    
    // Validate based on mode
    if (linkMode === 'search' && !linkDispatchId) {
      toast.error('Please select a dispatch to link');
      return;
    }
    if (linkMode === 'manual' && !manualOrderId.trim()) {
      toast.error('Please enter an order ID');
      return;
    }

    setLinkLoading(true);
    try {
      const params = new URLSearchParams();
      if (linkMode === 'search') {
        params.append('crm_dispatch_id', linkDispatchId);
      } else {
        params.append('manual_order_id', manualOrderId.trim());
      }
      
      await axios.put(
        `${API}/ecommerce/transactions/${linkTransaction.id}/link-crm?${params.toString()}`,
        {},
        { headers }
      );
      toast.success('Transaction linked successfully');
      setLinkDialogOpen(false);
      setLinkTransaction(null);
      setLinkDispatchId('');
      setManualOrderId('');
      setLinkMode('search');
      
      // Refresh data - both statement details and statements list
      if (selectedStatement) {
        await fetchStatementDetails(selectedStatement.id);
      }
      await fetchStatements(); // Refresh main list to update counts
      await fetchAlerts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to link transaction');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleExport = async (exportType) => {
    if (!selectedStatement) return;
    
    try {
      const res = await axios.get(
        `${API}/ecommerce/export/${selectedStatement.id}?export_type=${exportType}`,
        { headers, responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedStatement.platform}_${exportType}_${selectedStatement.statement_number}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export downloaded');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleDeleteStatement = async (statementId) => {
    try {
      await axios.delete(`${API}/ecommerce/statements/${statementId}`, { headers });
      toast.success('Statement deleted successfully');
      setSelectedStatement(null);
      setStatementDetails(null);
      await fetchStatements();
      await fetchAlerts();
      setActiveTab('statements');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete statement');
    }
  };

  const handleFinalizeStatement = async () => {
    if (!selectedStatement) return;
    
    try {
      const res = await axios.post(
        `${API}/ecommerce/statements/${selectedStatement.id}/finalize`,
        {},
        { headers }
      );
      toast.success(res.data.message || 'Statement finalized successfully');
      await fetchStatementDetails(selectedStatement.id);
      await fetchStatements();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to finalize statement');
    }
  };

  const openLinkDialog = (transaction) => {
    setLinkTransaction(transaction);
    setLinkDispatchId('');
    setDispatchSearch(transaction.marketplace_order_id || '');
    fetchDispatches(transaction.marketplace_order_id);
    setLinkDialogOpen(true);
  };

  // Filter transactions
  const filteredTransactions = statementDetails?.transactions?.filter(t => {
    if (matchFilter && matchFilter !== 'all' && t.crm_match_status !== matchFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.marketplace_order_id?.toLowerCase().includes(q) ||
        t.transaction_type?.toLowerCase().includes(q) ||
        t.product_details?.toLowerCase().includes(q)
      );
    }
    return true;
  }) || [];

  const filteredOrders = statementDetails?.order_summaries?.filter(o => {
    if (matchFilter && matchFilter !== 'all' && o.crm_match_status !== matchFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        o.marketplace_order_id?.toLowerCase().includes(q) ||
        o.product_details?.toLowerCase().includes(q)
      );
    }
    return true;
  }) || [];

  if (loading && statements.length === 0) {
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
      <div className="space-y-6" data-testid="ecommerce-reconciliation">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">Finance</p>
            <h1 className="text-2xl font-bold text-foreground">E-commerce Reconciliation</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Reconcile Amazon/Flipkart payout statements with CRM dispatches
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { fetchStatements(); fetchAlerts(); }}
              data-testid="refresh-btn"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => setUploadDialogOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="upload-statement-btn"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Statement
            </Button>
          </div>
        </div>

        {/* Alert Summary */}
        {alerts.length > 0 && (
          <Card className="mg-card border-orange-500/25 bg-orange-500/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                <div className="flex-1">
                  <p className="font-medium text-orange-400">
                    {alerts.length} Reconciliation Alert{alerts.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-orange-400/80">
                    {alerts.filter(a => a.type === 'unmatched_order').length} unmatched orders,
                    {' '}{alerts.filter(a => a.type === 'unmatched_refund').length} unmatched refunds,
                    {' '}{alerts.filter(a => a.type === 'high_fees').length} high fee alerts
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('alerts')}
                  className="border-orange-500/25 text-orange-400 hover:bg-orange-500/15"
                >
                  View Alerts
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="statements" data-testid="statements-tab">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Statements
            </TabsTrigger>
            <TabsTrigger value="details" disabled={!selectedStatement} data-testid="details-tab">
              <Eye className="w-4 h-4 mr-2" />
              Details
            </TabsTrigger>
            <TabsTrigger value="orders" disabled={!statementDetails} data-testid="orders-tab">
              <Package className="w-4 h-4 mr-2" />
              Orders
            </TabsTrigger>
            {selectedStatement?.platform === 'flipkart' && (
              <>
                <TabsTrigger value="charges" disabled={!statementDetails} data-testid="charges-tab">
                  <ReceiptText className="w-4 h-4 mr-2" />
                  Charges
                </TabsTrigger>
                <TabsTrigger value="taxes" disabled={!statementDetails} data-testid="taxes-tab">
                  <IndianRupee className="w-4 h-4 mr-2" />
                  Tax Breakdown
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="alerts" data-testid="alerts-tab">
              <AlertCircle className="w-4 h-4 mr-2" />
              Alerts ({alerts.length})
            </TabsTrigger>
            <TabsTrigger value="mtr" data-testid="mtr-tab">
              <ReceiptText className="w-4 h-4 mr-2" />
              MTR Reports
            </TabsTrigger>
          </TabsList>

          {/* Statements Tab */}
          <TabsContent value="statements" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle className="text-lg">Uploaded Statements</CardTitle>
                  <div className="flex gap-2">
                    <Select value={firmFilter} onValueChange={setFirmFilter}>
                      <SelectTrigger className="w-44" data-testid="firm-filter">
                        <SelectValue placeholder="All Firms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Firms</SelectItem>
                        {firms.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={platformFilter} onValueChange={setPlatformFilter}>
                      <SelectTrigger className="w-40" data-testid="platform-filter">
                        <SelectValue placeholder="All Platforms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Platforms</SelectItem>
                        {PLATFORMS.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {statements.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No statements uploaded yet</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setUploadDialogOpen(true)}
                    >
                      Upload First Statement
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Statement #</TableHead>
                        <TableHead>Firm</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Net Payout</TableHead>
                        <TableHead className="text-center">Matched</TableHead>
                        <TableHead className="text-center">Unmatched</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statements.map((stmt) => (
                        <TableRow
                          key={stmt.id}
                          className={`cursor-pointer ${selectedStatement?.id === stmt.id ? 'bg-primary/10' : ''}`}
                          onClick={() => fetchStatementDetails(stmt.id)}
                          data-testid={`statement-row-${stmt.id}`}
                        >
                          <TableCell className="font-mono text-sm text-foreground">{stmt.statement_number}</TableCell>
                          <TableCell className="text-sm font-medium text-foreground">{stmt.firm_name || '-'}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                              stmt.platform === 'amazon'
                                ? 'bg-orange-500/15 text-orange-400 ring-orange-500/25'
                                : 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/25'
                            }`}>
                              {stmt.platform?.toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(stmt.statement_period_start)} – {formatDate(stmt.statement_period_end)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-medium text-foreground">
                            {formatCurrency(stmt.summary?.net_payout, 2)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold ring-1 bg-emerald-500/15 text-emerald-400 ring-emerald-500/25">
                              {stmt.matched_count ?? stmt.summary?.matched_orders ?? 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {(stmt.unmatched_count ?? stmt.summary?.unmatched_orders ?? 0) > 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold ring-1 bg-rose-500/15 text-rose-400 ring-rose-500/25">
                                {stmt.unmatched_count ?? stmt.summary?.unmatched_orders}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold ring-1 bg-muted text-muted-foreground ring-border">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                              stmt.status === 'processed'
                                ? 'bg-sky-500/15 text-sky-400 ring-sky-500/25'
                                : 'bg-muted text-muted-foreground ring-border'
                            }`}>
                              {stmt.status}
                            </span>
                            {stmt.finance_status === 'finalized' && (
                              <span className="ml-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 bg-emerald-500/15 text-emerald-400 ring-emerald-500/25">
                                Finalized
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); fetchStatementDetails(stmt.id); setActiveTab('details'); }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/15"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Statement?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete statement {stmt.statement_number} and all related transactions, order summaries, and finance entries. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-red-600 hover:bg-red-700"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteStatement(stmt.id); }}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statement Details Tab */}
          <TabsContent value="details" className="space-y-4">
            {selectedStatement && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Order Payments</p>
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-500/15 text-emerald-400">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="font-mono text-xl font-bold tabular-nums text-emerald-400">
                      {formatCurrency(selectedStatement.summary?.total_order_payments || selectedStatement.summary?.total_sales)}
                    </p>
                  </div>
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Refunds</p>
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-rose-500/15 text-rose-400">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="font-mono text-xl font-bold tabular-nums text-rose-400">
                      {formatCurrency(selectedStatement.summary?.total_refunds)}
                    </p>
                  </div>
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Platform Fees</p>
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-orange-500/15 text-orange-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="font-mono text-xl font-bold tabular-nums text-orange-400">
                      {formatCurrency(selectedStatement.summary?.total_platform_fees || selectedStatement.summary?.total_marketplace_fees)}
                    </p>
                  </div>
                  {selectedStatement.platform === 'flipkart' ? (
                    <>
                      <div className="mg-card rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Ad Spend</p>
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-violet-500/15 text-violet-400">
                            <ShoppingCart className="w-4 h-4" />
                          </div>
                        </div>
                        <p className="font-mono text-xl font-bold tabular-nums text-violet-400">
                          {formatCurrency(selectedStatement.summary?.total_ad_spend)}
                        </p>
                      </div>
                      <div className="mg-card rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Service Charges</p>
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-sky-500/15 text-sky-400">
                            <ReceiptText className="w-4 h-4" />
                          </div>
                        </div>
                        <p className="font-mono text-xl font-bold tabular-nums text-sky-400">
                          {formatCurrency(selectedStatement.summary?.total_service_charges)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mg-card rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Reserve Held</p>
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-500/15 text-amber-400">
                            <Clock className="w-4 h-4" />
                          </div>
                        </div>
                        <p className="font-mono text-xl font-bold tabular-nums text-amber-400">
                          {formatCurrency(selectedStatement.summary?.reserve_held)}
                        </p>
                      </div>
                      <div className="mg-card rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Reserve Released</p>
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-sky-500/15 text-sky-400">
                            <Banknote className="w-4 h-4" />
                          </div>
                        </div>
                        <p className="font-mono text-xl font-bold tabular-nums text-sky-400">
                          {formatCurrency(selectedStatement.summary?.reserve_released)}
                        </p>
                      </div>
                    </>
                  )}
                  <div className="mg-card rounded-lg border border-primary/30 bg-primary/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-primary/70">Net Payout</p>
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/20 text-primary">
                        <IndianRupee className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="font-mono text-xl font-bold tabular-nums text-primary">
                      {formatCurrency(selectedStatement.summary?.net_payout, 2)}
                    </p>
                  </div>
                </div>

                {/* Match Progress */}
                <Card className="mg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Order Matching Progress</span>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm text-muted-foreground tabular-nums">
                          {selectedStatement.matched_count ?? selectedStatement.summary?.matched_orders ?? 0} / {(selectedStatement.matched_count ?? selectedStatement.summary?.matched_orders ?? 0) + (selectedStatement.unmatched_count ?? selectedStatement.summary?.unmatched_orders ?? 0)} matched
                        </span>
                        {selectedStatement.finance_status === 'finalized' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 bg-emerald-500/15 text-emerald-400 ring-emerald-500/25 inline-flex items-center gap-1">
                            <CheckCheck className="w-3 h-3" />
                            Finalized
                          </span>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                <CreditCard className="w-4 h-4 mr-2" />
                                Finalize to Finance
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Finalize Statement to Finance?</AlertDialogTitle>
                                <AlertDialogDescription className="space-y-2">
                                  <p>This will create finance entries for this statement:</p>
                                  <ul className="list-disc list-inside text-sm space-y-1">
                                    <li>Payment Entry: {formatCurrency(selectedStatement.summary?.net_payout, 2)} (Net Payout)</li>
                                    <li>Expense: Platform Fees {formatCurrency(selectedStatement.summary?.total_marketplace_fees || selectedStatement.summary?.total_platform_fees)}</li>
                                    {selectedStatement.summary?.total_ad_spend > 0 && (
                                      <li>Expense: Ads {formatCurrency(selectedStatement.summary?.total_ad_spend)}</li>
                                    )}
                                    {selectedStatement.summary?.total_tcs > 0 && (
                                      <li>Journal: TCS Credit {formatCurrency(selectedStatement.summary?.total_tcs)}</li>
                                    )}
                                    {selectedStatement.summary?.total_tds > 0 && (
                                      <li>Journal: TDS Credit {formatCurrency(selectedStatement.summary?.total_tds)}</li>
                                    )}
                                  </ul>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={handleFinalizeStatement}
                                >
                                  Finalize & Create Entries
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                    <Progress
                      value={(() => {
                        const matched = selectedStatement.matched_count ?? selectedStatement.summary?.matched_orders ?? 0;
                        const unmatched = selectedStatement.unmatched_count ?? selectedStatement.summary?.unmatched_orders ?? 0;
                        const total = matched + unmatched;
                        return total > 0 ? (matched / total) * 100 : 0;
                      })()}
                      className="h-2"
                    />
                  </CardContent>
                </Card>

                {/* Transaction Filters & Export */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <CardTitle className="text-lg">
                        Transactions ({filteredTransactions.length})
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Search order ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 w-48"
                            data-testid="search-input"
                          />
                        </div>
                        <Select value={matchFilter} onValueChange={setMatchFilter}>
                          <SelectTrigger className="w-36" data-testid="match-filter">
                            <SelectValue placeholder="All Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="matched">Matched</SelectItem>
                            <SelectItem value="unmatched">Unmatched</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={() => handleExport('summary')}>
                          <Download className="w-4 h-4 mr-2" />
                          Summary
                        </Button>
                        <Button variant="outline" onClick={() => handleExport('transactions')}>
                          <Download className="w-4 h-4 mr-2" />
                          All Transactions
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Product Charges</TableHead>
                            <TableHead className="text-right">Fees</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Match</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTransactions.slice(0, 100).map((trans) => (
                            <TableRow
                              key={trans.id}
                              className={trans.crm_match_status === 'unmatched' ? 'bg-rose-500/5' : ''}
                              data-testid={`transaction-row-${trans.id}`}
                            >
                              <TableCell className="text-sm text-muted-foreground">{formatDate(trans.date)}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                                  trans.transaction_category === 'order_payment'
                                    ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
                                    : trans.transaction_category === 'refund'
                                    ? 'bg-rose-500/15 text-rose-400 ring-rose-500/25'
                                    : trans.transaction_category === 'reserve_held'
                                    ? 'bg-amber-500/15 text-amber-400 ring-amber-500/25'
                                    : 'bg-muted text-muted-foreground ring-border'
                                }`}>
                                  {trans.transaction_category?.replace('_', ' ')}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-sm text-foreground">{trans.marketplace_order_id || '-'}</TableCell>
                              <TableCell className="text-sm max-w-[200px] truncate text-muted-foreground" title={trans.product_details}>
                                {trans.product_details || '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-sm text-foreground">
                                {formatCurrency(trans.total_product_charges)}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-sm text-orange-400">
                                {trans.platform_fees ? `-${formatCurrency(Math.abs(trans.platform_fees))}` : '-'}
                              </TableCell>
                              <TableCell className={`text-right font-mono tabular-nums font-medium ${trans.total_amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatCurrency(trans.total_amount)}
                              </TableCell>
                              <TableCell>
                                {trans.crm_match_status === 'matched' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 bg-emerald-500/15 text-emerald-400 ring-emerald-500/25 inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Matched
                                  </span>
                                ) : trans.marketplace_order_id ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 bg-rose-500/15 text-rose-400 ring-rose-500/25 inline-flex items-center gap-1">
                                    <XCircle className="w-3 h-3" />
                                    Unmatched
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold ring-1 bg-muted text-muted-foreground ring-border">N/A</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {trans.crm_match_status === 'unmatched' && trans.marketplace_order_id && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openLinkDialog(trans)}
                                    data-testid={`link-btn-${trans.id}`}
                                  >
                                    <Link2 className="w-4 h-4 mr-1" />
                                    Link
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {filteredTransactions.length > 100 && (
                      <p className="font-mono text-[11px] text-muted-foreground mt-4 text-center">
                        Showing first 100 of {filteredTransactions.length} transactions
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            {statementDetails && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Order Summaries ({filteredOrders.length})</CardTitle>
                    <div className="flex gap-2">
                      <Select value={matchFilter} onValueChange={setMatchFilter}>
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="matched">Matched</SelectItem>
                          <SelectItem value="unmatched">Unmatched</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={() => handleExport('orders')}>
                        <Download className="w-4 h-4 mr-2" />
                        Export Orders
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Gross Sale</TableHead>
                          <TableHead className="text-right">Platform Fees</TableHead>
                          <TableHead className="text-right">Promos</TableHead>
                          <TableHead className="text-right">Refunds</TableHead>
                          <TableHead className="text-right">Net Realized</TableHead>
                          <TableHead>Finance Status</TableHead>
                          <TableHead>CRM Match</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => (
                          <TableRow
                            key={order.id}
                            className={order.crm_match_status === 'unmatched' ? 'bg-rose-500/5' : ''}
                          >
                            <TableCell className="font-mono text-sm text-foreground">{order.marketplace_order_id}</TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate text-muted-foreground" title={order.product_details}>
                              {order.product_details || '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-foreground">{formatCurrency(order.gross_sale)}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-orange-400">
                              -{formatCurrency(order.platform_fees)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-violet-400">
                              -{formatCurrency(order.promotional_rebates)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-rose-400">
                              {order.refund_amount > 0 ? `-${formatCurrency(order.refund_amount)}` : '-'}
                            </TableCell>
                            <TableCell className={`text-right font-mono tabular-nums font-bold ${order.net_realized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {formatCurrency(order.net_realized)}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                                order.finance_status === 'paid'
                                  ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
                                  : order.finance_status === 'refunded'
                                  ? 'bg-rose-500/15 text-rose-400 ring-rose-500/25'
                                  : 'bg-amber-500/15 text-amber-400 ring-amber-500/25'
                              }`}>
                                {order.finance_status}
                              </span>
                            </TableCell>
                            <TableCell>
                              {order.crm_match_status === 'matched' ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                              ) : (
                                <XCircle className="w-5 h-5 text-rose-400" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Non-Order Charges Tab (Flipkart only) */}
          <TabsContent value="charges" className="space-y-4">
            {statementDetails && selectedStatement?.platform === 'flipkart' && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Non-Order Charges & Adjustments</CardTitle>
                    <Button variant="outline" onClick={() => handleExport('charges')}>
                      <Download className="w-4 h-4 mr-2" />
                      Export Charges
                    </Button>
                  </div>
                  <CardDescription>
                    Platform fees, ads, services, rebates, and other deductions not tied to specific orders
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(!statementDetails.non_order_charges || statementDetails.non_order_charges.length === 0) ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ReceiptText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p>No non-order charges in this statement</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>SKU / Order</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statementDetails.non_order_charges.map((charge) => (
                            <TableRow key={charge.id}>
                              <TableCell className="text-sm text-muted-foreground">{formatDate(charge.date)}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                                  charge.charge_type === 'ads' || charge.charge_type === 'google_ads'
                                    ? 'bg-violet-500/15 text-violet-400 ring-violet-500/25'
                                    : charge.charge_type === 'mp_fee_rebate'
                                    ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
                                    : charge.charge_type === 'storage_recall'
                                    ? 'bg-sky-500/15 text-sky-400 ring-sky-500/25'
                                    : charge.charge_type === 'protection_fund'
                                    ? 'bg-teal-500/15 text-teal-400 ring-teal-500/25'
                                    : 'bg-muted text-muted-foreground ring-border'
                                }`}>
                                  {charge.charge_type?.replace('_', ' ')}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm capitalize text-muted-foreground">{charge.category}</TableCell>
                              <TableCell className="text-sm max-w-[250px] truncate text-muted-foreground" title={charge.description}>
                                {charge.description || '-'}
                              </TableCell>
                              <TableCell className="text-sm font-mono text-foreground">
                                {charge.sku || charge.order_id || charge.campaign_id || '-'}
                              </TableCell>
                              <TableCell className={`text-right font-mono tabular-nums font-medium ${charge.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatCurrency(charge.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tax Breakdown Tab (Flipkart only) */}
          <TabsContent value="taxes" className="space-y-4">
            {statementDetails && selectedStatement?.platform === 'flipkart' && (
              <>
                {/* Tax Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total TCS</p>
                    </div>
                    <p className="font-mono text-xl font-bold tabular-nums text-orange-400">
                      {formatCurrency(selectedStatement.summary?.total_tcs)}
                    </p>
                  </div>
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total TDS</p>
                    </div>
                    <p className="font-mono text-xl font-bold tabular-nums text-violet-400">
                      {formatCurrency(selectedStatement.summary?.total_tds)}
                    </p>
                  </div>
                  <div className="mg-card rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">GST on Fees</p>
                    </div>
                    <p className="font-mono text-xl font-bold tabular-nums text-sky-400">
                      {formatCurrency(selectedStatement.summary?.total_gst_on_fees)}
                    </p>
                  </div>
                  <div className="mg-card rounded-lg border border-primary/30 bg-primary/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-primary/70">Total Taxes</p>
                    </div>
                    <p className="font-mono text-xl font-bold tabular-nums text-primary">
                      {formatCurrency(
                        (selectedStatement.summary?.total_tcs || 0) +
                        (selectedStatement.summary?.total_tds || 0) +
                        (selectedStatement.summary?.total_gst_on_fees || 0)
                      )}
                    </p>
                  </div>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">Tax Entries Detail</CardTitle>
                      <Button variant="outline" onClick={() => handleExport('taxes')}>
                        <Download className="w-4 h-4 mr-2" />
                        Export Tax Details
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(!statementDetails.tax_entries || statementDetails.tax_entries.length === 0) ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <IndianRupee className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p>No detailed tax entries in this statement</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tax Type</TableHead>
                              <TableHead>Fee Name</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead className="text-right">CGST</TableHead>
                              <TableHead className="text-right">SGST</TableHead>
                              <TableHead className="text-right">IGST</TableHead>
                              <TableHead className="text-right">Total GST</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {statementDetails.tax_entries.map((tax) => (
                              <TableRow key={tax.id}>
                                <TableCell>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                                    tax.tax_type === 'tcs_recovery'
                                      ? 'bg-orange-500/15 text-orange-400 ring-orange-500/25'
                                      : tax.tax_type === 'tds'
                                      ? 'bg-violet-500/15 text-violet-400 ring-violet-500/25'
                                      : 'bg-sky-500/15 text-sky-400 ring-sky-500/25'
                                  }`}>
                                    {tax.tax_type?.replace('_', ' ').toUpperCase()}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{tax.fee_name || '-'}</TableCell>
                                <TableCell className="text-sm font-mono text-foreground">
                                  {tax.order_item_id || tax.transaction_id || tax.claim_id || '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm text-foreground">
                                  {tax.cgst_amount ? formatCurrency(tax.cgst_amount) : '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm text-foreground">
                                  {tax.sgst_amount ? formatCurrency(tax.sgst_amount) : '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-sm text-foreground">
                                  {tax.igst_amount ? formatCurrency(tax.igst_amount) : '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums font-medium text-foreground">
                                  {formatCurrency(tax.amount || tax.total_gst)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Reconciliation Alerts</CardTitle>
                  <Button variant="outline" onClick={() => handleExport('unmatched')} disabled={!selectedStatement}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Unmatched
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400 opacity-70" />
                    <p>No alerts — all orders reconciled!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border ${
                          alert.severity === 'high'
                            ? 'bg-rose-500/10 border-rose-500/25'
                            : alert.severity === 'medium'
                            ? 'bg-orange-500/10 border-orange-500/25'
                            : 'bg-amber-500/10 border-amber-500/25'
                        }`}
                        data-testid={`alert-${idx}`}
                      >
                        <div className="flex items-start gap-3">
                          <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                            alert.severity === 'high' ? 'text-rose-400' :
                            alert.severity === 'medium' ? 'text-orange-400' :
                            'text-amber-400'
                          }`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                                alert.type === 'unmatched_order'
                                  ? 'bg-rose-500/15 text-rose-400 ring-rose-500/25'
                                  : alert.type === 'unmatched_refund'
                                  ? 'bg-violet-500/15 text-violet-400 ring-violet-500/25'
                                  : alert.type === 'high_fees'
                                  ? 'bg-orange-500/15 text-orange-400 ring-orange-500/25'
                                  : 'bg-sky-500/15 text-sky-400 ring-sky-500/25'
                              }`}>
                                {alert.type?.replace('_', ' ')}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold ring-1 bg-muted text-muted-foreground ring-border uppercase">
                                {alert.severity}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm font-medium text-foreground">{alert.message}</p>
                            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                              {alert.order_id && (
                                <span>
                                  <span className="text-muted-foreground/60">Order:</span>{' '}
                                  <span className="font-mono text-foreground">{alert.order_id}</span>
                                </span>
                              )}
                              {alert.amount && (
                                <span>
                                  <span className="text-muted-foreground/60">Amount:</span>{' '}
                                  <span className="font-mono tabular-nums text-foreground">{formatCurrency(alert.amount)}</span>
                                </span>
                              )}
                              {alert.date && (
                                <span>
                                  <span className="text-muted-foreground/60">Date:</span>{' '}
                                  {formatDate(alert.date)}
                                </span>
                              )}
                            </div>
                          </div>
                          {alert.type === 'unmatched_order' && alert.transaction_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const trans = statementDetails?.transactions?.find(t => t.id === alert.transaction_id);
                                if (trans) openLinkDialog(trans);
                              }}
                            >
                              <Link2 className="w-4 h-4 mr-1" />
                              Link to CRM
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MTR Reports Tab */}
          <TabsContent value="mtr" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-lg">GST Data Reports</CardTitle>
                    <CardDescription>
                      Upload Amazon MTR, Flipkart Sales & Vyapar GSTR reports for consolidation
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setConsolidatedDialogOpen(true)}
                      variant="outline"
                      className="border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/15"
                      data-testid="download-consolidated-btn"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Consolidated
                    </Button>
                    <Button
                      onClick={() => setMtrUploadDialogOpen(true)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      data-testid="upload-mtr-btn"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Report
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="mg-card rounded-lg border border-orange-500/25 bg-orange-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-orange-500 text-white font-bold text-sm">A</div>
                      <div>
                        <p className="font-medium text-orange-400">Amazon MTR</p>
                        <p className="text-xs text-orange-400/70 mt-1">
                          Seller Central → Reports → Tax → MTR
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mg-card rounded-lg border border-yellow-500/25 bg-yellow-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-yellow-500 text-white font-bold text-sm">F</div>
                      <div>
                        <p className="font-medium text-yellow-400">Flipkart Sales</p>
                        <p className="text-xs text-yellow-400/70 mt-1">
                          Seller Hub → Reports → Sales Report
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mg-card rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-500 text-white font-bold text-sm">V</div>
                      <div>
                        <p className="font-medium text-emerald-400">Vyapar GSTR</p>
                        <p className="text-xs text-emerald-400/70 mt-1">
                          Vyapar App → GSTR1 / GSTR3B Export
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {mtrReports.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ReceiptText className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p>No reports uploaded yet</p>
                    <p className="text-sm mt-1">Upload Amazon MTR or Flipkart Sales Report to enrich dispatch GST data</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Report Type</TableHead>
                          <TableHead>Filename</TableHead>
                          <TableHead>Firm</TableHead>
                          <TableHead className="text-right">Rows</TableHead>
                          <TableHead className="text-right">Matched</TableHead>
                          <TableHead className="text-right">State Updated</TableHead>
                          <TableHead className="text-right">GST Updated</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mtrReports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                                  report.platform === 'flipkart'
                                    ? 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/25'
                                    : report.platform === 'vyapar'
                                    ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
                                    : report.mtr_type === 'b2b'
                                    ? 'bg-violet-500/15 text-violet-400 ring-violet-500/25'
                                    : 'bg-sky-500/15 text-sky-400 ring-sky-500/25'
                                }`}>
                                  {report.platform === 'flipkart' ? 'Flipkart'
                                    : report.platform === 'vyapar' ? 'Vyapar'
                                    : report.mtr_type?.toUpperCase()}
                                </span>
                                {(report.platform === 'flipkart' || report.platform === 'vyapar') && (
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {report.mtr_type?.replace('flipkart_', '').toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm max-w-48 truncate text-foreground">
                              {report.filename}
                              {report.period_key && (
                                <p className="font-mono text-[10px] text-muted-foreground">{report.period_key}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-foreground">{report.firm_name}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-foreground">
                              {report.platform === 'vyapar'
                                ? (report.stats?.total_invoices || report.stats?.hsn_entries || 0)
                                : (report.stats?.total_rows || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {report.platform === 'vyapar'
                                ? <span className="text-emerald-400 font-medium">{report.stats?.b2b_invoices || 0} B2B</span>
                                : <span className="text-emerald-400 font-medium">{report.stats?.matched_dispatches || 0}</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {report.platform === 'vyapar'
                                ? <span className="text-sky-400">{report.stats?.b2c_invoices || 0} B2C</span>
                                : <span className="text-sky-400">{report.stats?.state_updated || 0}</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {report.platform === 'vyapar'
                                ? <span className="text-orange-400">{report.stats?.hsn_entries || 0} HSN</span>
                                : <span className="text-orange-400">{report.stats?.gst_updated || 0}</span>}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p className="text-foreground">{formatDate(report.created_at)}</p>
                                <p className="text-muted-foreground font-mono text-[10px]">{report.created_by_name}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/15">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Report?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will delete the report record, allowing you to re-upload the same file.
                                      Note: GST data already enriched on dispatches will NOT be removed.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteMtrReport(report.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
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

        {/* Upload Statement Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Payout Statement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label>Select Firm *</Label>
                <Select value={uploadFirmId} onValueChange={setUploadFirmId}>
                  <SelectTrigger data-testid="upload-firm-select">
                    <SelectValue placeholder="Select the firm for this statement" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Each firm has its own reconciliation. Select the firm this statement belongs to.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Platform *</Label>
                <Select value={uploadPlatform} onValueChange={setUploadPlatform}>
                  <SelectTrigger data-testid="upload-platform-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{uploadPlatform === 'flipkart' ? 'Excel File' : 'CSV File'} *</Label>
                <Input
                  type="file"
                  accept={uploadPlatform === 'flipkart' ? '.xlsx,.xls' : '.csv'}
                  onChange={(e) => setUploadFile(e.target.files?.[0])}
                  data-testid="upload-file-input"
                />
                <p className="text-xs text-muted-foreground">
                  {uploadPlatform === 'amazon'
                    ? 'Upload the payout/transaction report CSV from Amazon Seller Central'
                    : 'Upload the settlement Excel workbook from Flipkart Seller Hub (multi-sheet format)'}
                </p>
              </div>

              {uploadPlatform === 'amazon' ? (
                <div className="bg-muted/60 p-3 rounded-lg text-sm border border-border">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Expected columns (Amazon)</p>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    <li>• Date, Transaction type, Order ID</li>
                    <li>• Product Details, Total product charges</li>
                    <li>• Total promotional rebates, Amazon fees</li>
                    <li>• Other, Total (INR)</li>
                  </ul>
                </div>
              ) : (
                <div className="bg-yellow-500/10 p-3 rounded-lg text-sm border border-yellow-500/25">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-yellow-400 mb-2">Expected sheets (Flipkart)</p>
                  <ul className="text-yellow-400/80 space-y-1 text-xs">
                    <li>• Orders, MP Fee Rebate, Non_Order_SPF</li>
                    <li>• Storage_Recall, Value Added Services</li>
                    <li>• Google Ads Services, Ads</li>
                    <li>• TCS_Recovery, TDS, GST_Details</li>
                  </ul>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={uploading || !uploadFile || !uploadFirmId} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload & Process
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Link Transaction Dialog */}
        <Dialog open={linkDialogOpen} onOpenChange={(open) => {
          setLinkDialogOpen(open);
          if (open && linkTransaction) {
            // Auto-populate search with marketplace order ID
            setDispatchSearch(linkTransaction.marketplace_order_id || '');
            fetchDispatches(linkTransaction.marketplace_order_id || '');
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Link Transaction to CRM Dispatch</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {linkTransaction && (
                <div className="bg-muted/60 p-3 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Order ID:</span>{' '}
                    <span className="font-mono text-foreground">{linkTransaction.marketplace_order_id}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">Amount:</span>{' '}
                    {formatCurrency(linkTransaction.total_amount)}
                  </p>
                </div>
              )}

              {/* Link Mode Tabs */}
              <Tabs value={linkMode} onValueChange={setLinkMode} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="search">Search Dispatch</TabsTrigger>
                  <TabsTrigger value="manual">Manual Order ID</TabsTrigger>
                </TabsList>
                
                <TabsContent value="search" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Search CRM Dispatch</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search by dispatch #, order ID, or customer"
                        value={dispatchSearch}
                        onChange={(e) => setDispatchSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchDispatches(dispatchSearch)}
                        data-testid="dispatch-search-input"
                      />
                      <Button type="button" variant="outline" onClick={() => fetchDispatches(dispatchSearch)}>
                        <Search className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Select Dispatch</Label>
                    <Select value={linkDispatchId} onValueChange={setLinkDispatchId}>
                      <SelectTrigger data-testid="dispatch-select">
                        <SelectValue placeholder="Select a dispatch to link" />
                      </SelectTrigger>
                      <SelectContent>
                        {dispatches.length === 0 ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">
                            No dispatches found. Try searching with a different term.
                          </div>
                        ) : (
                          dispatches.map(d => (
                            <SelectItem key={d.id} value={d.id}>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">{d.dispatch_number}</span>
                                <span className="text-muted-foreground">|</span>
                                <span className="text-sm">{d.customer_name}</span>
                                <span className="text-muted-foreground">|</span>
                                <span className="font-mono text-xs text-muted-foreground">{d.order_id || d.marketplace_order_id || '-'}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
                
                <TabsContent value="manual" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Enter CRM Order ID</Label>
                    <Input
                      placeholder="Enter the order ID from your CRM dispatch (e.g., 909-909)"
                      value={manualOrderId}
                      onChange={(e) => setManualOrderId(e.target.value)}
                      data-testid="manual-order-id-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      This will search dispatches by order_id or marketplace_order_id and link automatically.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setLinkDialogOpen(false);
                  setLinkMode('search');
                  setManualOrderId('');
                  setDispatchSearch('');
                  setLinkDispatchId('');
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleLinkTransaction}
                  disabled={linkLoading || (linkMode === 'search' && !linkDispatchId) || (linkMode === 'manual' && !manualOrderId.trim())}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {linkLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-2" />
                      Link Transaction
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* MTR Upload Dialog */}
        <Dialog open={mtrUploadDialogOpen} onOpenChange={setMtrUploadDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ReceiptText className={`w-5 h-5 ${mtrPlatform === 'vyapar' ? 'text-emerald-400' : mtrPlatform === 'flipkart' ? 'text-yellow-400' : 'text-orange-400'}`} />
                Upload {mtrPlatform === 'vyapar' ? 'Vyapar GSTR' : mtrPlatform === 'flipkart' ? 'Flipkart Sales' : 'Amazon MTR'} Report
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleMtrUpload} className="space-y-4">
              <div className="space-y-2">
                <Label>Select Firm *</Label>
                <Select value={mtrFirmId} onValueChange={setMtrFirmId}>
                  <SelectTrigger data-testid="mtr-firm-select">
                    <SelectValue placeholder="Select the firm for this report" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Platform *</Label>
                <Select value={mtrPlatform} onValueChange={(v) => {
                  setMtrPlatform(v);
                  if (v === 'amazon') setMtrType('b2c');
                  else if (v === 'flipkart') setMtrType('sales');
                  else setMtrType('gstr1');
                }}>
                  <SelectTrigger data-testid="mtr-platform-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amazon">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        Amazon MTR
                      </span>
                    </SelectItem>
                    <SelectItem value="flipkart">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        Flipkart Sales Report
                      </span>
                    </SelectItem>
                    <SelectItem value="vyapar">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Vyapar GSTR Report
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Report Type *</Label>
                <Select value={mtrType} onValueChange={setMtrType}>
                  <SelectTrigger data-testid="mtr-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mtrPlatform === 'amazon' ? (
                      <>
                        <SelectItem value="b2c">B2C (Business to Consumer)</SelectItem>
                        <SelectItem value="b2b">B2B (Business to Business)</SelectItem>
                      </>
                    ) : mtrPlatform === 'flipkart' ? (
                      <>
                        <SelectItem value="sales">Sales Report</SelectItem>
                        <SelectItem value="gst">GST Report</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="gstr1">GSTR1 (Outward Supplies)</SelectItem>
                        <SelectItem value="gstr3b">GSTR3B (Summary Return)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {mtrPlatform === 'amazon'
                    ? 'Download from Amazon Seller Central → Reports → Tax → MTR'
                    : mtrPlatform === 'flipkart'
                      ? 'Download from Flipkart Seller Hub → Reports → Sales Report'
                      : 'Export from Vyapar App → GSTR Reports'}
                </p>
              </div>

              {mtrPlatform === 'vyapar' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Period Month *</Label>
                    <Select value={mtrPeriodMonth.toString()} onValueChange={(v) => setMtrPeriodMonth(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                          <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Period Year *</Label>
                    <Select value={mtrPeriodYear.toString()} onValueChange={(v) => setMtrPeriodYear(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026, 2027].map(y => (
                          <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>{mtrPlatform === 'amazon' ? 'MTR CSV File' : mtrPlatform === 'flipkart' ? 'Sales Report Excel File' : 'Vyapar GSTR Excel File'} *</Label>
                <Input
                  type="file"
                  accept={mtrPlatform === 'amazon' ? '.csv' : '.xlsx,.xls'}
                  onChange={(e) => setMtrFile(e.target.files?.[0])}
                  data-testid="mtr-file-input"
                />
              </div>

              <div className={`border rounded-lg p-3 text-sm ${
                mtrPlatform === 'amazon'
                  ? 'bg-orange-500/10 border-orange-500/25'
                  : mtrPlatform === 'flipkart'
                  ? 'bg-yellow-500/10 border-yellow-500/25'
                  : 'bg-emerald-500/10 border-emerald-500/25'
              }`}>
                <p className={`font-mono text-[11px] font-semibold uppercase tracking-wide mb-2 ${
                  mtrPlatform === 'amazon' ? 'text-orange-400' : mtrPlatform === 'flipkart' ? 'text-yellow-400' : 'text-emerald-400'
                }`}>
                  {mtrPlatform === 'vyapar' ? 'What gets stored:' : 'What happens on upload:'}
                </p>
                <ul className={`space-y-1 text-xs ${
                  mtrPlatform === 'amazon' ? 'text-orange-400/80' : mtrPlatform === 'flipkart' ? 'text-yellow-400/80' : 'text-emerald-400/80'
                }`}>
                  {mtrPlatform === 'vyapar' ? (
                    <>
                      <li>• Stores B2B invoices with GSTIN, amounts, taxes</li>
                      <li>• Stores B2C supplies by state</li>
                      <li>• Stores HSN-wise summary</li>
                      <li>• Used for consolidated GSTR1/3B generation</li>
                    </>
                  ) : (
                    <>
                      <li>• Matches orders with existing CRM dispatches</li>
                      <li>• Updates dispatch records with state info</li>
                      <li>• Adds CGST/SGST/IGST breakdowns</li>
                      <li>• Does NOT create duplicate entries</li>
                    </>
                  )}
                </ul>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setMtrUploadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={mtrUploading || !mtrFile || !mtrFirmId}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {mtrUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload {mtrPlatform === 'amazon' ? 'MTR' : mtrPlatform === 'flipkart' ? 'Sales Report' : 'GSTR'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Consolidated Report Download Dialog */}
        <Dialog open={consolidatedDialogOpen} onOpenChange={setConsolidatedDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-400" />
                Download Consolidated GST Report
              </DialogTitle>
              <DialogDescription>
                Combines data from Amazon MTR, Flipkart Sales, and Vyapar GSTR reports
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Firm *</Label>
                <Select value={consolidatedFirmId} onValueChange={setConsolidatedFirmId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Period Month *</Label>
                  <Select value={consolidatedMonth.toString()} onValueChange={(v) => setConsolidatedMonth(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                        <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Period Year *</Label>
                  <Select value={consolidatedYear.toString()} onValueChange={(v) => setConsolidatedYear(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map(y => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Report Type *</Label>
                <Select value={consolidatedType} onValueChange={setConsolidatedType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gstr1">GSTR1 (Outward Supplies)</SelectItem>
                    <SelectItem value="gstr3b">GSTR3B (Summary Return)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                variant="outline" 
                onClick={fetchConsolidatedPreview}
                disabled={consolidatedLoading || !consolidatedFirmId}
                className="w-full"
              >
                {consolidatedLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                Preview Consolidated Data
              </Button>

              {consolidatedPreview && (
                <div className="mg-card bg-muted/40 border border-border rounded-lg p-4 space-y-3">
                  <h4 className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Data Summary</h4>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-orange-500/10 border border-orange-500/25 rounded p-2">
                      <p className="text-orange-400 font-medium">Amazon</p>
                      <p className="text-orange-400/80 font-mono tabular-nums">{consolidatedPreview.sources?.amazon?.dispatches || 0} entries</p>
                      <p className="text-orange-400/70 font-mono tabular-nums text-xs">₹{(consolidatedPreview.sources?.amazon?.total_taxable || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/25 rounded p-2">
                      <p className="text-yellow-400 font-medium">Flipkart</p>
                      <p className="text-yellow-400/80 font-mono tabular-nums">{consolidatedPreview.sources?.flipkart?.dispatches || 0} entries</p>
                      <p className="text-yellow-400/70 font-mono tabular-nums text-xs">₹{(consolidatedPreview.sources?.flipkart?.total_taxable || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/25 rounded p-2">
                      <p className="text-emerald-400 font-medium">Vyapar</p>
                      <p className="text-emerald-400/80 font-mono tabular-nums">{consolidatedPreview.sources?.vyapar?.invoices || 0} invoices</p>
                      <p className="text-emerald-400/70 font-mono tabular-nums text-xs">₹{(consolidatedPreview.sources?.vyapar?.total_taxable || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="bg-primary/10 border border-primary/30 rounded p-3 mt-2">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-primary/70 mb-2">Consolidated Total</p>
                    <div className="grid grid-cols-2 gap-2 text-sm mt-1">
                      <p className="font-mono tabular-nums text-primary">Taxable: ₹{(consolidatedPreview.consolidated?.total_taxable || 0).toLocaleString()}</p>
                      <p className="font-mono tabular-nums text-primary">Total GST: ₹{(consolidatedPreview.consolidated?.total_gst || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConsolidatedDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={downloadConsolidatedReport}
                disabled={consolidatedLoading || !consolidatedFirmId}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {consolidatedLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download Excel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

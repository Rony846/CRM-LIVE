import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Factory, Plus, Loader2, Eye, CheckCircle, Clock, Play,
  Package, AlertTriangle, FileText, DollarSign, RefreshCw, Search,
  Barcode, ListChecks, Download, User
} from 'lucide-react';

const STATUS_COLORS = {
  requested: 'bg-yellow-500',
  accepted: 'bg-blue-500',
  in_progress: 'bg-purple-500',
  completed: 'bg-green-500',
  received_into_inventory: 'bg-emerald-600',
  cancelled: 'bg-red-500'
};

const STATUS_LABELS = {
  requested: 'Requested',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  completed: 'Completed',
  received_into_inventory: 'Received',
  cancelled: 'Cancelled'
};

// Status badge helper — dark themed
const StatusChip = ({ status }) => {
  const map = {
    requested:               'bg-amber-400/15 text-amber-400 ring-amber-400/25',
    accepted:                'bg-sky-500/15 text-sky-400 ring-sky-500/25',
    in_progress:             'bg-violet-500/15 text-violet-400 ring-violet-500/25',
    completed:               'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25',
    received_into_inventory: 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25',
    cancelled:               'bg-rose-500/15 text-rose-400 ring-rose-500/25',
  };
  const cls = map[status] || 'bg-muted text-muted-foreground ring-border';
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${cls}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
};

export default function ProductionRequests() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [masterSKUs, setMasterSKUs] = useState([]);
  const [firms, setFirms] = useState([]);
  const [payables, setPayables] = useState({ payables: [], summary: {} });
  const [completedSerials, setCompletedSerials] = useState([]);

  const [activeTab, setActiveTab] = useState('requests');
  const [filterStatus, setFilterStatus] = useState('all');
  const [serialSearchQuery, setSerialSearchQuery] = useState('');

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncingDispatch, setSyncingDispatch] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    firm_id: '', master_sku_id: '', quantity_requested: 1,
    production_date: '', remarks: ''
  });
  const [paymentForm, setPaymentForm] = useState({
    amount_paid: '', payment_reference: '', remarks: ''
  });

  const [scrapReport, setScrapReport] = useState(null);
  const [scrapDays, setScrapDays] = useState(90);
  const [scrapLoading, setScrapLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchScrapReport = async (days) => {
    setScrapLoading(true);
    try {
      const r = await axios.get(`${API}/production/scrap-report`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { days },
      });
      setScrapReport(r.data);
    } catch (e) {
      toast.error('Failed to load scrap report');
    } finally {
      setScrapLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'scrap') fetchScrapReport(scrapDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, scrapDays]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [requestsRes, skusRes, firmsRes, payablesRes, serialsRes] = await Promise.all([
        axios.get(`${API}/production-requests`, { headers }),
        axios.get(`${API}/master-skus`, { headers }),
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        axios.get(`${API}/supervisor-payables`, { headers }),
        axios.get(`${API}/finished-good-serials`, { headers, params: { limit: 2000 } })
      ]);
      setRequests(requestsRes.data || []);
      // Only show manufactured SKUs
      setMasterSKUs((skusRes.data || []).filter(s => s.product_type === 'manufactured'));
      setFirms(firmsRes.data || []);
      setPayables(payablesRes.data || { payables: [], summary: {} });
      setCompletedSerials(serialsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Filtered serials with search
  const filteredSerials = useMemo(() => {
    if (!serialSearchQuery.trim()) return completedSerials;
    const query = serialSearchQuery.toLowerCase();
    return completedSerials.filter(s =>
      s.serial_number?.toLowerCase().includes(query) ||
      s.master_sku_name?.toLowerCase().includes(query) ||
      s.master_sku_code?.toLowerCase().includes(query) ||
      s.customer_name?.toLowerCase().includes(query) ||
      s.order_id?.toLowerCase().includes(query) ||
      s.condition?.toLowerCase().includes(query)
    );
  }, [completedSerials, serialSearchQuery]);

  const handleCreateRequest = async () => {
    if (!createForm.firm_id || !createForm.master_sku_id || createForm.quantity_requested < 1) {
      toast.error('Please fill in all required fields');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/production-requests`, createForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Production request created');
      setCreateDialogOpen(false);
      setCreateForm({ firm_id: '', master_sku_id: '', quantity_requested: 1, production_date: '', remarks: '', customer_name: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create request');
    } finally {
      setActionLoading(false);
    }
  };

  // Sync dispatch data to serial numbers
  const handleSyncDispatchData = async () => {
    setSyncingDispatch(true);
    try {
      const res = await axios.post(`${API}/finished-good-serials/sync-dispatch-data`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      toast.success(`Synced ${data.updated} serials with dispatch data`);
      if (data.no_dispatch_found > 0) {
        toast.info(`${data.no_dispatch_found} dispatched serials have no matching dispatch record`);
      }
      fetchData(); // Refresh to show updated data
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error.response?.data?.detail || 'Failed to sync dispatch data');
    } finally {
      setSyncingDispatch(false);
    }
  };

  const handleReceiveIntoInventory = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
    try {
      await axios.put(`${API}/production-requests/${selectedRequest.id}/receive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Production received into inventory');
      setReceiveDialogOpen(false);
      setSelectedRequest(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to receive into inventory');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!confirm('Are you sure you want to cancel this production request?')) return;

    try {
      await axios.put(`${API}/production-requests/${requestId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Request cancelled');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel request');
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedPayable || !paymentForm.amount_paid) {
      toast.error('Please enter payment amount');
      return;
    }

    setActionLoading(true);
    try {
      await axios.put(`${API}/supervisor-payables/${selectedPayable.id}/payment`, {
        status: 'part_paid',
        amount_paid: parseFloat(paymentForm.amount_paid),
        payment_reference: paymentForm.payment_reference,
        remarks: paymentForm.remarks
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Payment recorded');
      setPaymentDialogOpen(false);
      setPaymentForm({ amount_paid: '', payment_reference: '', remarks: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    } finally {
      setActionLoading(false);
    }
  };

  const openViewDialog = (request) => {
    setSelectedRequest(request);
    setViewDialogOpen(true);
  };

  const openReceiveDialog = (request) => {
    setSelectedRequest(request);
    setReceiveDialogOpen(true);
  };

  const openPaymentDialog = (payable) => {
    setSelectedPayable(payable);
    setPaymentForm({ amount_paid: '', payment_reference: '', remarks: '' });
    setPaymentDialogOpen(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const filteredRequests = filterStatus === 'all'
    ? requests
    : requests.filter(r => r.status === filterStatus);

  // Stats
  const pendingRequests = requests.filter(r => ['requested', 'accepted', 'in_progress'].includes(r.status)).length;
  const completedRequests = requests.filter(r => r.status === 'completed').length;
  const receivedRequests = requests.filter(r => r.status === 'received_into_inventory').length;

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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Production Requests</h1>
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
              Manufacturing requests · completed production · supervisor payables
            </p>
          </div>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[11px] uppercase tracking-wide"
            data-testid="create-production-request"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Request
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Pending */}
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-amber-400/15 text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Pending</p>
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{pendingRequests}</p>
              </div>
            </div>
          </div>
          {/* Awaiting Receipt */}
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-emerald-500/15 text-emerald-500">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Awaiting Receipt</p>
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{completedRequests}</p>
              </div>
            </div>
          </div>
          {/* Total Serials */}
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-sky-500/15 text-sky-400">
                <Barcode className="w-5 h-5" />
              </div>
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total Serials</p>
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{completedSerials.length}</p>
              </div>
            </div>
          </div>
          {/* Received */}
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-emerald-500/15 text-emerald-500">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Received</p>
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{receivedRequests}</p>
              </div>
            </div>
          </div>
          {/* Pending Payables */}
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-orange-500/15 text-orange-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Pending Payables</p>
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{formatCurrency(payables.summary?.total_pending)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Card className="mg-card border border-border bg-card">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="pb-0">
              <TabsList className="bg-muted">
                <TabsTrigger value="requests" data-testid="requests-tab" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
                  <Factory className="w-4 h-4 mr-2" />
                  Production Requests
                </TabsTrigger>
                <TabsTrigger value="completed" data-testid="completed-tab" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
                  <ListChecks className="w-4 h-4 mr-2" />
                  Production Completed
                </TabsTrigger>
                <TabsTrigger value="payables" data-testid="payables-tab" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Supervisor Payables
                </TabsTrigger>
                <TabsTrigger value="scrap" data-testid="scrap-tab" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Scrap Report
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Production Requests Tab */}
              <TabsContent value="requests" className="mt-0">
                <div className="flex justify-between items-center mb-4">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-48 border-border">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="requested">Requested</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="received_into_inventory">Received</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={fetchData} className="border-border text-muted-foreground font-mono text-[11px]">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Request #</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Firm</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Product</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Qty</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Assigned To</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Status</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Created</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((req) => (
                      <TableRow key={req.id} className="border-border hover:bg-muted/40">
                        <TableCell className="font-mono text-sm text-primary tabular-nums">{req.request_number}</TableCell>
                        <TableCell className="text-foreground">{req.firm_name}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{req.master_sku_name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{req.master_sku_code}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums font-medium text-foreground">{req.quantity_requested}</TableCell>
                        <TableCell>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                            req.manufacturing_role === 'supervisor'
                              ? 'bg-violet-500/15 text-violet-400 ring-violet-500/25'
                              : 'bg-sky-500/15 text-sky-400 ring-sky-500/25'
                          }`}>
                            {req.manufacturing_role === 'supervisor' ? 'Supervisor' : 'Technician'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusChip status={req.status} />
                        </TableCell>
                        <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">{formatDate(req.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openViewDialog(req)}
                              className="text-muted-foreground hover:text-foreground"
                              data-testid={`view-request-${req.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {req.status === 'completed' && (
                              <Button
                                size="sm"
                                className="bg-emerald-500/80 hover:bg-emerald-500 text-white font-mono text-[10px] uppercase tracking-wide"
                                onClick={() => openReceiveDialog(req)}
                                data-testid={`receive-request-${req.id}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Receive
                              </Button>
                            )}
                            {['requested', 'accepted'].includes(req.status) && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="font-mono text-[10px] uppercase tracking-wide"
                                onClick={() => handleCancelRequest(req.id)}
                                data-testid={`cancel-request-${req.id}`}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredRequests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground font-mono text-[11px] uppercase tracking-wide">
                          No production requests found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Production Completed Tab - Serial Numbers */}
              <TabsContent value="completed" className="mt-0">
                <div className="mb-4 flex justify-between items-center gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by serial number, product, customer..."
                      value={serialSearchQuery}
                      onChange={(e) => setSerialSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="serial-search-input"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleSyncDispatchData}
                      disabled={syncingDispatch}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[11px] uppercase tracking-wide gap-2"
                      data-testid="sync-dispatch-btn"
                    >
                      {syncingDispatch ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Fetch Dispatch Data
                    </Button>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {filteredSerials.length} / {completedSerials.length} records
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10">
                      <TableRow className="border-border">
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Serial Number</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Product</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Condition</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Status</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Customer</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Phone</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Order ID</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Production Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSerials.slice(0, 200).map((serial) => (
                        <TableRow key={serial.id} className="border-border hover:bg-muted/40">
                          <TableCell>
                            <span className="font-mono text-primary font-bold" data-testid={`serial-${serial.serial_number}`}>
                              {serial.serial_number}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold text-foreground text-sm">{serial.master_sku_name || '-'}</p>
                              <p className="font-mono text-[11px] text-emerald-500">{serial.master_sku_code || ''}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                              serial.condition === 'New'
                                ? 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25'
                                : serial.condition === 'Repaired'
                                ? 'bg-amber-400/15 text-amber-400 ring-amber-400/25'
                                : 'bg-muted text-muted-foreground ring-border'
                            }`}>
                              {serial.condition || 'Unknown'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                              serial.status === 'in_stock'
                                ? 'bg-sky-500/15 text-sky-400 ring-sky-500/25'
                                : serial.status === 'dispatched'
                                ? 'bg-violet-500/15 text-violet-400 ring-violet-500/25'
                                : serial.status === 'returned'
                                ? 'bg-orange-500/15 text-orange-400 ring-orange-500/25'
                                : 'bg-muted text-muted-foreground ring-border'
                            }`}>
                              {serial.status || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {serial.customer_name ? (
                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-primary" />
                                <span className="text-foreground font-medium text-sm">{serial.customer_name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm italic">
                                {serial.status === 'dispatched' ? 'Click Fetch' : '-'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums text-amber-400 font-medium text-sm">
                            {serial.phone || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground text-xs max-w-[120px] truncate tabular-nums">
                            {serial.order_id || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                            {serial.production_date ? formatDate(serial.production_date) :
                             serial.created_at ? formatDate(serial.created_at) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredSerials.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground font-mono text-[11px] uppercase tracking-wide">
                            {serialSearchQuery ? 'No serials matching your search' : 'No production completed records found'}
                          </TableCell>
                        </TableRow>
                      )}
                      {filteredSerials.length > 200 && (
                        <TableRow className="bg-muted/40">
                          <TableCell colSpan={8} className="text-center py-4 text-muted-foreground font-mono text-[11px]">
                            Showing first 200 of {filteredSerials.length} records · Use search to filter
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Supervisor Payables Tab */}
              <TabsContent value="payables" className="mt-0">
                {/* Duplicate Serial Alert */}
                {payables.has_duplicates && payables.duplicate_serials?.length > 0 && (
                  <div className="mb-4 p-4 bg-rose-500/10 border border-rose-500/25 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-rose-400">Duplicate Serial Numbers Detected!</p>
                        <p className="font-mono text-[11px] text-rose-400/70 mt-1">
                          The following serial numbers appear in multiple payables:
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {payables.duplicate_serials.map((sn, idx) => (
                            <span key={idx} className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25">
                              {sn}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary bar */}
                <div className="mb-4 p-4 bg-muted rounded-lg border border-border">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Total Payable</p>
                      <p className="font-mono text-xl font-bold tabular-nums text-foreground">{formatCurrency(payables.summary?.total_payable)}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Total Paid</p>
                      <p className="font-mono text-xl font-bold tabular-nums text-emerald-500">{formatCurrency(payables.summary?.total_paid)}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Pending</p>
                      <p className="font-mono text-xl font-bold tabular-nums text-orange-400">{formatCurrency(payables.summary?.total_pending)}</p>
                    </div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Payable #</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Production</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Product</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Serial Numbers</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Qty</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Rate</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Total</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Paid</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Status</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payables.payables?.map((pay) => (
                      <TableRow key={pay.id} className="border-border hover:bg-muted/40">
                        <TableCell className="font-mono text-sm tabular-nums text-foreground">{pay.payable_number}</TableCell>
                        <TableCell className="font-mono text-[11px] text-primary">{pay.production_request_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm text-foreground truncate max-w-[200px]" title={pay.master_sku_name}>{pay.master_sku_name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{pay.firm_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {pay.serial_numbers?.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {pay.serial_numbers.slice(0, 3).map((sn, idx) => (
                                <span
                                  key={idx}
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-mono ring-1 ${
                                    payables.duplicate_serials?.includes(sn)
                                      ? 'bg-rose-500/15 text-rose-400 ring-rose-500/25'
                                      : 'bg-muted text-muted-foreground ring-border'
                                  }`}
                                  title={payables.duplicate_serials?.includes(sn) ? 'DUPLICATE!' : ''}
                                >
                                  {sn}
                                </span>
                              ))}
                              {pay.serial_numbers.length > 3 && (
                                <span className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground ring-1 ring-border">
                                  +{pay.serial_numbers.length - 3} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground font-mono text-[11px]">No serials</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums text-foreground">{pay.quantity_produced}</TableCell>
                        <TableCell className="font-mono tabular-nums text-foreground">{formatCurrency(pay.rate_per_unit)}</TableCell>
                        <TableCell className="font-mono tabular-nums font-medium text-foreground">{formatCurrency(pay.total_payable)}</TableCell>
                        <TableCell className="font-mono tabular-nums text-emerald-500 font-medium">{formatCurrency(pay.amount_paid)}</TableCell>
                        <TableCell>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                            pay.status === 'paid'
                              ? 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25'
                              : pay.status === 'part_paid'
                              ? 'bg-amber-400/15 text-amber-400 ring-amber-400/25'
                              : 'bg-rose-500/15 text-rose-400 ring-rose-500/25'
                          }`}>
                            {pay.status === 'paid' ? 'Paid' : pay.status === 'part_paid' ? 'Partial' : 'Unpaid'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {pay.status !== 'paid' && (
                            <Button
                              size="sm"
                              className="bg-emerald-500/80 hover:bg-emerald-500 text-white font-mono text-[10px] uppercase tracking-wide"
                              onClick={() => openPaymentDialog(pay)}
                              data-testid={`record-payment-${pay.id}`}
                            >
                              <DollarSign className="w-4 h-4 mr-1" />
                              Pay
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!payables.payables || payables.payables.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground font-mono text-[11px] uppercase tracking-wide">
                          No supervisor payables found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Scrap Report Tab */}
              <TabsContent value="scrap" className="mt-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scrap / Yield Report</h3>
                  <Select value={String(scrapDays)} onValueChange={(v) => setScrapDays(Number(v))}>
                    <SelectTrigger className="w-[150px] border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                      <SelectItem value="365">Last 12 months</SelectItem>
                      <SelectItem value="0">All time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scrapLoading ? (
                  <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : !scrapReport ? (
                  <p className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide py-8 text-center">No data.</p>
                ) : (
                  <div className="space-y-5">
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Scrap rate', value: `${scrapReport.summary.scrap_rate}%`, tone: scrapReport.summary.scrap_rate > 5 ? 'text-rose-400' : scrapReport.summary.scrap_rate > 0 ? 'text-amber-400' : 'text-emerald-500' },
                        { label: 'Good units', value: scrapReport.summary.total_good, tone: 'text-emerald-500' },
                        { label: 'Scrapped units', value: scrapReport.summary.total_scrap, tone: 'text-amber-400' },
                        { label: 'Jobs', value: scrapReport.summary.jobs, tone: 'text-foreground' },
                      ].map((c) => (
                        <div key={c.label} className="mg-card rounded-lg border border-border bg-muted p-3">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
                          <p className={`font-mono text-2xl font-bold tabular-nums ${c.tone}`}>{c.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* By reason */}
                    <div>
                      <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Scrap by reason</h4>
                      {scrapReport.by_reason.length === 0 ? (
                        <p className="font-mono text-[11px] text-muted-foreground">No scrap recorded in this period.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {scrapReport.by_reason.map((r) => {
                            const max = scrapReport.by_reason[0].quantity || 1;
                            return (
                              <div key={r.reason} className="flex items-center gap-3">
                                <span className="font-mono text-sm text-foreground w-44 shrink-0">{r.reason}</span>
                                <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden border border-border">
                                  <div className="bg-amber-400/70 h-full rounded-full" style={{ width: `${(r.quantity / max) * 100}%` }} />
                                </div>
                                <span className="font-mono tabular-nums text-sm text-foreground w-10 text-right">{r.quantity}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* By SKU */}
                    <div>
                      <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">By product</h4>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Product</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Good</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Scrap</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Jobs</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Scrap rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scrapReport.by_sku.map((s) => (
                            <TableRow key={s.master_sku_id} className="border-border hover:bg-muted/40">
                              <TableCell className="text-foreground">{s.master_sku_name}</TableCell>
                              <TableCell className="font-mono tabular-nums text-emerald-500 text-right">{s.good}</TableCell>
                              <TableCell className="font-mono tabular-nums text-amber-400 text-right">{s.scrap}</TableCell>
                              <TableCell className="font-mono tabular-nums text-muted-foreground text-right">{s.jobs}</TableCell>
                              <TableCell className={`font-mono tabular-nums text-right font-medium ${s.scrap_rate > 5 ? 'text-rose-400' : s.scrap_rate > 0 ? 'text-amber-400' : 'text-emerald-500'}`}>
                                {s.scrap_rate}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* By worker */}
                    <div>
                      <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">By worker</h4>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Worker</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Role</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Good</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Scrap</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Jobs</TableHead>
                            <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Scrap rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scrapReport.by_worker.map((w, i) => (
                            <TableRow key={i} className="border-border hover:bg-muted/40">
                              <TableCell className="text-foreground">{w.worker}</TableCell>
                              <TableCell className="text-muted-foreground capitalize">{w.role}</TableCell>
                              <TableCell className="font-mono tabular-nums text-emerald-500 text-right">{w.good}</TableCell>
                              <TableCell className="font-mono tabular-nums text-amber-400 text-right">{w.scrap}</TableCell>
                              <TableCell className="font-mono tabular-nums text-muted-foreground text-right">{w.jobs}</TableCell>
                              <TableCell className={`font-mono tabular-nums text-right font-medium ${w.scrap_rate > 5 ? 'text-rose-400' : w.scrap_rate > 0 ? 'text-amber-400' : 'text-emerald-500'}`}>
                                {w.scrap_rate}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Create Production Request Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="bg-popover border border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create Production Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Firm *</Label>
                <Select
                  value={createForm.firm_id}
                  onValueChange={(v) => setCreateForm({...createForm, firm_id: v})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Product (Master SKU) *</Label>
                <Select
                  value={createForm.master_sku_id}
                  onValueChange={(v) => setCreateForm({...createForm, master_sku_id: v})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select product">
                      {createForm.master_sku_id && masterSKUs.find(s => s.id === createForm.master_sku_id) && (
                        <span className="truncate block max-w-[250px]">
                          {masterSKUs.find(s => s.id === createForm.master_sku_id)?.name} ({masterSKUs.find(s => s.id === createForm.master_sku_id)?.sku_code})
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {masterSKUs.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex flex-col">
                          <span className="truncate max-w-[300px]">{s.name}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{s.sku_code} - {s.manufacturing_role === 'supervisor' ? 'Supervisor' : 'Technician'}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {masterSKUs.length === 0 && (
                  <p className="font-mono text-[11px] text-amber-400 mt-1">
                    No manufactured products found. Configure product_type = "manufactured" in Master SKUs.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={createForm.quantity_requested}
                    onChange={(e) => setCreateForm({...createForm, quantity_requested: parseInt(e.target.value) || 1})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Target Date</Label>
                  <Input
                    type="date"
                    value={createForm.production_date}
                    onChange={(e) => setCreateForm({...createForm, production_date: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Customer Name (optional)</Label>
                <Input
                  value={createForm.customer_name}
                  onChange={(e) => setCreateForm({...createForm, customer_name: e.target.value})}
                  placeholder="e.g. Acme Corp · who this batch is being produced for"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Remarks</Label>
                <Textarea
                  value={createForm.remarks}
                  onChange={(e) => setCreateForm({...createForm, remarks: e.target.value})}
                  placeholder="Any special instructions..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateDialogOpen(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button
                onClick={handleCreateRequest}
                disabled={actionLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[11px] uppercase tracking-wide"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Production Request Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="bg-popover border border-border max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Production Request Details</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-lg text-primary tabular-nums">{selectedRequest.request_number}</p>
                    <StatusChip status={selectedRequest.status} />
                  </div>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                    selectedRequest.manufacturing_role === 'supervisor'
                      ? 'bg-violet-500/15 text-violet-400 ring-violet-500/25'
                      : 'bg-sky-500/15 text-sky-400 ring-sky-500/25'
                  }`}>
                    {selectedRequest.manufacturing_role === 'supervisor' ? 'Supervisor Job' : 'Technician Job'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg border border-border">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Firm</p>
                    <p className="font-medium text-foreground">{selectedRequest.firm_name}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Product</p>
                    <p className="font-medium text-foreground">{selectedRequest.master_sku_name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{selectedRequest.master_sku_code}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Quantity Requested</p>
                    <p className="font-mono text-xl font-bold tabular-nums text-foreground">{selectedRequest.quantity_requested}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Quantity Produced</p>
                    <p className="font-mono text-xl font-bold tabular-nums text-emerald-500">{selectedRequest.quantity_produced}</p>
                  </div>
                </div>

                {selectedRequest.production_charge_per_unit && (
                  <div className="p-3 bg-violet-500/[0.07] border border-violet-500/25 rounded-lg">
                    <p className="font-mono text-[11px] uppercase tracking-wide text-violet-400">Production Charge</p>
                    <p className="font-mono tabular-nums font-bold text-lg text-foreground mt-1">
                      {formatCurrency(selectedRequest.production_charge_per_unit)} × {selectedRequest.quantity_produced || selectedRequest.quantity_requested} =
                      <span className="text-violet-400 ml-2">
                        {formatCurrency((selectedRequest.production_charge_per_unit || 0) * (selectedRequest.quantity_produced || selectedRequest.quantity_requested))}
                      </span>
                    </p>
                  </div>
                )}

                {/* Raw Material Requirements */}
                {selectedRequest.raw_material_requirements?.length > 0 && (
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Raw Material Requirements</p>
                    <div className="space-y-2">
                      {selectedRequest.raw_material_requirements.map((rm, idx) => (
                        <div key={idx} className={`flex justify-between p-2 rounded-lg border ${rm.sufficient ? 'bg-emerald-500/[0.07] border-emerald-500/25' : 'bg-rose-500/[0.07] border-rose-500/25'}`}>
                          <span className="text-foreground">{rm.raw_material_name} ({rm.raw_material_sku})</span>
                          <span className="font-mono text-sm tabular-nums text-muted-foreground">
                            {rm.total_required} req / {rm.current_stock} stock
                            {!rm.sufficient && <AlertTriangle className="w-4 h-4 inline ml-2 text-rose-400" />}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Serial Numbers */}
                {selectedRequest.serial_numbers?.length > 0 && (
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Serial Numbers</p>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {selectedRequest.serial_numbers.map((sn, idx) => (
                        <div key={idx} className="p-2 bg-muted rounded-lg border border-border font-mono text-sm text-foreground tabular-nums">
                          {sn.serial_number}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="space-y-2">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Timeline</p>
                  <div className="font-mono text-sm space-y-1 tabular-nums">
                    <p><span className="text-muted-foreground">Created:</span> <span className="text-foreground">{formatDate(selectedRequest.created_at)}</span> <span className="text-muted-foreground">by</span> <span className="text-foreground">{selectedRequest.created_by_name}</span></p>
                    {selectedRequest.accepted_at && <p><span className="text-muted-foreground">Accepted:</span> <span className="text-foreground">{formatDate(selectedRequest.accepted_at)}</span> <span className="text-muted-foreground">by</span> <span className="text-foreground">{selectedRequest.accepted_by_name}</span></p>}
                    {selectedRequest.started_at && <p><span className="text-muted-foreground">Started:</span> <span className="text-foreground">{formatDate(selectedRequest.started_at)}</span></p>}
                    {selectedRequest.completed_at && <p><span className="text-muted-foreground">Completed:</span> <span className="text-foreground">{formatDate(selectedRequest.completed_at)}</span> <span className="text-muted-foreground">by</span> <span className="text-foreground">{selectedRequest.completed_by_name}</span></p>}
                    {selectedRequest.received_at && <p><span className="text-muted-foreground">Received:</span> <span className="text-foreground">{formatDate(selectedRequest.received_at)}</span> <span className="text-muted-foreground">by</span> <span className="text-foreground">{selectedRequest.received_by_name}</span></p>}
                  </div>
                </div>

                {selectedRequest.remarks && (
                  <div className="p-3 bg-muted rounded-lg border border-border">
                    <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Remarks</p>
                    <p className="text-foreground mt-1">{selectedRequest.remarks}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Receive Into Inventory Dialog */}
        <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
          <DialogContent className="bg-popover border border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Confirm Receipt Into Inventory</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/[0.08] border border-emerald-500/25 rounded-lg">
                  <p className="font-mono text-sm text-emerald-400 tabular-nums">{selectedRequest.request_number}</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-foreground mt-1">{selectedRequest.quantity_produced} units of {selectedRequest.master_sku_name}</p>
                  {(selectedRequest.scrap_quantity || 0) > 0 && (
                    <p className="font-mono text-[11px] text-amber-400 mt-2">
                      {selectedRequest.scrap_quantity} unit(s) scrapped at QC — not stocked
                    </p>
                  )}
                </div>

                {/* QC scrap detail */}
                {(selectedRequest.scrap || []).length > 0 && (
                  <div className="p-3 bg-amber-400/[0.07] border border-amber-400/25 rounded-lg">
                    <p className="font-mono text-[11px] uppercase tracking-wide text-amber-400 mb-1">Scrapped at QC</p>
                    <ul className="font-mono text-sm space-y-0.5 text-muted-foreground">
                      {selectedRequest.scrap.map((s, i) => (
                        <li key={i}>• {s.quantity} × {s.reason}{s.notes ? ` — ${s.notes}` : ''}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-4 bg-muted rounded-lg border border-border">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-2">This action will:</p>
                  <ul className="font-mono text-sm space-y-1 text-muted-foreground">
                    <li>• Deduct raw materials for {(selectedRequest.quantity_produced || 0) + (selectedRequest.scrap_quantity || 0)} units {(selectedRequest.scrap_quantity || 0) > 0 ? '(good + scrapped — material was used on both)' : ''}</li>
                    <li>• Add {selectedRequest.quantity_produced} finished goods to inventory</li>
                    <li>• Register {selectedRequest.quantity_produced} serial numbers</li>
                    {selectedRequest.manufacturing_role === 'supervisor' && (
                      <li>• Create supervisor payable of {formatCurrency((selectedRequest.production_charge_per_unit || 0) * selectedRequest.quantity_produced)} (good units only)</li>
                    )}
                  </ul>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setReceiveDialogOpen(false)} className="text-muted-foreground">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReceiveIntoInventory}
                    disabled={actionLoading}
                    className="bg-emerald-500/80 hover:bg-emerald-500 text-white font-mono text-[11px] uppercase tracking-wide"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Receipt'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Record Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="bg-popover border border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Record Payment</DialogTitle>
            </DialogHeader>
            {selectedPayable && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg border border-border">
                  <p className="font-mono text-[11px] text-muted-foreground">Payable: {selectedPayable.payable_number}</p>
                  <p className="font-medium text-foreground mt-1">{selectedPayable.master_sku_name}</p>
                  <div className="flex justify-between mt-2 font-mono text-sm tabular-nums">
                    <span className="text-muted-foreground">Total: <span className="text-foreground">{formatCurrency(selectedPayable.total_payable)}</span></span>
                    <span className="text-muted-foreground">Paid: <span className="text-emerald-500">{formatCurrency(selectedPayable.amount_paid)}</span></span>
                    <span className="text-orange-400">Pending: {formatCurrency(selectedPayable.total_payable - selectedPayable.amount_paid)}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Payment Amount *</Label>
                  <Input
                    type="number"
                    value={paymentForm.amount_paid}
                    onChange={(e) => setPaymentForm({...paymentForm, amount_paid: e.target.value})}
                    placeholder="Enter amount"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Payment Reference</Label>
                  <Input
                    value={paymentForm.payment_reference}
                    onChange={(e) => setPaymentForm({...paymentForm, payment_reference: e.target.value})}
                    placeholder="Transaction ID, Cheque #, etc."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Remarks</Label>
                  <Textarea
                    value={paymentForm.remarks}
                    onChange={(e) => setPaymentForm({...paymentForm, remarks: e.target.value})}
                    className="mt-1"
                    rows={2}
                  />
                </div>

                <DialogFooter>
                  <Button variant="ghost" onClick={() => setPaymentDialogOpen(false)} className="text-muted-foreground">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRecordPayment}
                    disabled={actionLoading}
                    className="bg-emerald-500/80 hover:bg-emerald-500 text-white font-mono text-[11px] uppercase tracking-wide"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Payment'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

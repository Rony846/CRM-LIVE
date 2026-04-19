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

  useEffect(() => {
    fetchData();
  }, [token]);

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
      setCreateForm({ firm_id: '', master_sku_id: '', quantity_requested: 1, production_date: '', remarks: '' });
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
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
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
            <h1 className="text-2xl font-bold text-white">Production Requests</h1>
            <p className="text-slate-400">Manage manufacturing requests, completed production and supervisor payables</p>
          </div>
          <Button 
            onClick={() => setCreateDialogOpen(true)} 
            className="bg-cyan-600 hover:bg-cyan-700"
            data-testid="create-production-request"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Request
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/20 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Pending</p>
                  <p className="text-2xl font-bold text-white">{pendingRequests}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Awaiting Receipt</p>
                  <p className="text-2xl font-bold text-white">{completedRequests}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-cyan-500/20 rounded-lg">
                  <Barcode className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Serials</p>
                  <p className="text-2xl font-bold text-white">{completedSerials.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 rounded-lg">
                  <Package className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Received</p>
                  <p className="text-2xl font-bold text-white">{receivedRequests}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Pending Payables</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(payables.summary?.total_pending)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Card className="bg-slate-800 border-slate-700">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader>
              <TabsList className="bg-slate-700">
                <TabsTrigger value="requests" data-testid="requests-tab">
                  <Factory className="w-4 h-4 mr-2" />
                  Production Requests
                </TabsTrigger>
                <TabsTrigger value="completed" data-testid="completed-tab">
                  <ListChecks className="w-4 h-4 mr-2" />
                  Production Completed
                </TabsTrigger>
                <TabsTrigger value="payables" data-testid="payables-tab">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Supervisor Payables
                </TabsTrigger>
                <TabsTrigger value="payables" data-testid="payables-tab">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Supervisor Payables
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              {/* Production Requests Tab */}
              <TabsContent value="requests" className="mt-0">
                <div className="flex justify-between items-center mb-4">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="all" className="text-white">All Statuses</SelectItem>
                      <SelectItem value="requested" className="text-white">Requested</SelectItem>
                      <SelectItem value="accepted" className="text-white">Accepted</SelectItem>
                      <SelectItem value="in_progress" className="text-white">In Progress</SelectItem>
                      <SelectItem value="completed" className="text-white">Completed</SelectItem>
                      <SelectItem value="received_into_inventory" className="text-white">Received</SelectItem>
                      <SelectItem value="cancelled" className="text-white">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={fetchData} className="text-slate-300 border-slate-600">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Request #</TableHead>
                      <TableHead className="text-slate-300">Firm</TableHead>
                      <TableHead className="text-slate-300">Product</TableHead>
                      <TableHead className="text-slate-300">Qty</TableHead>
                      <TableHead className="text-slate-300">Assigned To</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300">Created</TableHead>
                      <TableHead className="text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((req) => (
                      <TableRow key={req.id} className="border-slate-700 hover:bg-slate-700/50">
                        <TableCell className="font-mono text-sm text-cyan-400">{req.request_number}</TableCell>
                        <TableCell className="text-white">{req.firm_name}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">{req.master_sku_name}</p>
                            <p className="text-xs text-slate-400">{req.master_sku_code}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-white">{req.quantity_requested}</TableCell>
                        <TableCell>
                          <Badge className={`${req.manufacturing_role === 'supervisor' ? 'bg-purple-600' : 'bg-blue-600'} text-white`}>
                            {req.manufacturing_role === 'supervisor' ? 'Supervisor' : 'Technician'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${STATUS_COLORS[req.status]} text-white`}>
                            {STATUS_LABELS[req.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-300">{formatDate(req.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openViewDialog(req)}
                              data-testid={`view-request-${req.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {req.status === 'completed' && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
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
                        <TableCell colSpan={8} className="text-center py-8 text-slate-400">
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search by serial number, product, customer..."
                      value={serialSearchQuery}
                      onChange={(e) => setSerialSearchQuery(e.target.value)}
                      className="pl-10 bg-slate-700 border-slate-600 text-white"
                      data-testid="serial-search-input"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleSyncDispatchData}
                      disabled={syncingDispatch}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2"
                      data-testid="sync-dispatch-btn"
                    >
                      {syncingDispatch ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Fetch Dispatch Data
                    </Button>
                    <div className="text-sm text-slate-400">
                      Showing {filteredSerials.length} of {completedSerials.length} records
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-700/90 backdrop-blur-sm z-10">
                      <TableRow className="border-slate-600">
                        <TableHead className="text-cyan-300 font-bold">Serial Number</TableHead>
                        <TableHead className="text-cyan-300 font-bold">Product</TableHead>
                        <TableHead className="text-cyan-300 font-bold">Condition</TableHead>
                        <TableHead className="text-cyan-300 font-bold">Status</TableHead>
                        <TableHead className="text-cyan-300 font-bold">Customer</TableHead>
                        <TableHead className="text-cyan-300 font-bold">Phone</TableHead>
                        <TableHead className="text-cyan-300 font-bold">Order ID</TableHead>
                        <TableHead className="text-cyan-300 font-bold">Production Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSerials.slice(0, 200).map((serial) => (
                        <TableRow key={serial.id} className="border-slate-600 hover:bg-slate-700/50">
                          <TableCell>
                            <span className="font-mono text-cyan-400 font-bold" data-testid={`serial-${serial.serial_number}`}>
                              {serial.serial_number}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold text-white text-sm">{serial.master_sku_name || '-'}</p>
                              <p className="text-xs text-emerald-400 font-medium">{serial.master_sku_code || ''}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-white ${
                              serial.condition === 'New' ? 'bg-green-600' : 
                              serial.condition === 'Repaired' ? 'bg-yellow-600' : 'bg-slate-600'
                            }`}>
                              {serial.condition || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-white ${
                              serial.status === 'in_stock' ? 'bg-blue-600' :
                              serial.status === 'dispatched' ? 'bg-purple-600' :
                              serial.status === 'returned' ? 'bg-orange-600' : 'bg-slate-600'
                            }`}>
                              {serial.status || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {serial.customer_name ? (
                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="text-white font-medium text-sm">{serial.customer_name}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-sm italic">
                                {serial.status === 'dispatched' ? 'Click Fetch' : '-'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-amber-300 font-medium text-sm">
                            {serial.phone || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-slate-200 text-xs max-w-[120px] truncate">
                            {serial.order_id || '-'}
                          </TableCell>
                          <TableCell className="text-slate-300 text-sm">
                            {serial.production_date ? formatDate(serial.production_date) : 
                             serial.created_at ? formatDate(serial.created_at) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredSerials.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                            {serialSearchQuery ? 'No serials matching your search' : 'No production completed records found'}
                          </TableCell>
                        </TableRow>
                      )}
                      {filteredSerials.length > 200 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-4 text-slate-400 text-sm">
                            Showing first 200 of {filteredSerials.length} records. Use search to filter.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Supervisor Payables Tab */}
              <TabsContent value="payables" className="mt-0">
                <div className="mb-4 p-4 bg-slate-700/50 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-slate-400">Total Payable</p>
                      <p className="text-xl font-bold text-white">{formatCurrency(payables.summary?.total_payable)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Total Paid</p>
                      <p className="text-xl font-bold text-green-400">{formatCurrency(payables.summary?.total_paid)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Pending</p>
                      <p className="text-xl font-bold text-orange-400">{formatCurrency(payables.summary?.total_pending)}</p>
                    </div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Payable #</TableHead>
                      <TableHead className="text-slate-300">Production</TableHead>
                      <TableHead className="text-slate-300">Product</TableHead>
                      <TableHead className="text-slate-300">Qty</TableHead>
                      <TableHead className="text-slate-300">Rate</TableHead>
                      <TableHead className="text-slate-300">Total</TableHead>
                      <TableHead className="text-slate-300">Paid</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payables.payables?.map((pay) => (
                      <TableRow key={pay.id} className="border-slate-700 hover:bg-slate-700/50">
                        <TableCell className="font-mono text-sm text-white">{pay.payable_number}</TableCell>
                        <TableCell className="text-xs text-cyan-400">{pay.production_request_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm text-white">{pay.master_sku_name}</p>
                            <p className="text-xs text-slate-400">{pay.firm_name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-white">{pay.quantity_produced}</TableCell>
                        <TableCell className="text-white">{formatCurrency(pay.rate_per_unit)}</TableCell>
                        <TableCell className="font-medium text-white">{formatCurrency(pay.total_payable)}</TableCell>
                        <TableCell className="text-green-400 font-medium">{formatCurrency(pay.amount_paid)}</TableCell>
                        <TableCell>
                          <Badge className={`text-white ${
                            pay.status === 'paid' ? 'bg-green-600' :
                            pay.status === 'part_paid' ? 'bg-yellow-600' : 'bg-red-600'
                          }`}>
                            {pay.status === 'paid' ? 'Paid' : pay.status === 'part_paid' ? 'Partial' : 'Unpaid'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {pay.status !== 'paid' && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
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
                        <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                          No supervisor payables found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Create Production Request Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Production Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Firm *</Label>
                <Select
                  value={createForm.firm_id}
                  onValueChange={(v) => setCreateForm({...createForm, firm_id: v})}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                    <SelectValue placeholder="Select firm" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id} className="text-white">{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Product (Master SKU) *</Label>
                <Select
                  value={createForm.master_sku_id}
                  onValueChange={(v) => setCreateForm({...createForm, master_sku_id: v})}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                    <SelectValue placeholder="Select product">
                      {createForm.master_sku_id && masterSKUs.find(s => s.id === createForm.master_sku_id) && (
                        <span className="truncate block max-w-[250px]">
                          {masterSKUs.find(s => s.id === createForm.master_sku_id)?.name} ({masterSKUs.find(s => s.id === createForm.master_sku_id)?.sku_code})
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                    {masterSKUs.map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-white">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[300px]">{s.name}</span>
                          <span className="text-xs text-slate-400">{s.sku_code} - {s.manufacturing_role === 'supervisor' ? 'Supervisor' : 'Technician'}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {masterSKUs.length === 0 && (
                  <p className="text-xs text-yellow-400 mt-1">
                    No manufactured products found. Configure product_type = "manufactured" in Master SKUs.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={createForm.quantity_requested}
                    onChange={(e) => setCreateForm({...createForm, quantity_requested: parseInt(e.target.value) || 1})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Target Date</Label>
                  <Input
                    type="date"
                    value={createForm.production_date}
                    onChange={(e) => setCreateForm({...createForm, production_date: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-300">Remarks</Label>
                <Textarea
                  value={createForm.remarks}
                  onChange={(e) => setCreateForm({...createForm, remarks: e.target.value})}
                  placeholder="Any special instructions..."
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateDialogOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={handleCreateRequest}
                disabled={actionLoading}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Production Request Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Production Request Details</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-lg text-cyan-400">{selectedRequest.request_number}</p>
                    <Badge className={STATUS_COLORS[selectedRequest.status]}>
                      {STATUS_LABELS[selectedRequest.status]}
                    </Badge>
                  </div>
                  <Badge className={selectedRequest.manufacturing_role === 'supervisor' ? 'bg-purple-600' : 'bg-blue-600'}>
                    {selectedRequest.manufacturing_role === 'supervisor' ? 'Supervisor Job' : 'Technician Job'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-700/50 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-400">Firm</p>
                    <p className="font-medium">{selectedRequest.firm_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Product</p>
                    <p className="font-medium">{selectedRequest.master_sku_name}</p>
                    <p className="text-xs text-slate-400">{selectedRequest.master_sku_code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Quantity Requested</p>
                    <p className="font-bold text-xl">{selectedRequest.quantity_requested}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Quantity Produced</p>
                    <p className="font-bold text-xl text-green-400">{selectedRequest.quantity_produced}</p>
                  </div>
                </div>

                {selectedRequest.production_charge_per_unit && (
                  <div className="p-3 bg-purple-900/30 border border-purple-700 rounded-lg">
                    <p className="text-sm text-purple-300">Production Charge</p>
                    <p className="font-bold text-lg">
                      {formatCurrency(selectedRequest.production_charge_per_unit)} × {selectedRequest.quantity_produced || selectedRequest.quantity_requested} = 
                      <span className="text-purple-400 ml-2">
                        {formatCurrency((selectedRequest.production_charge_per_unit || 0) * (selectedRequest.quantity_produced || selectedRequest.quantity_requested))}
                      </span>
                    </p>
                  </div>
                )}

                {/* Raw Material Requirements */}
                {selectedRequest.raw_material_requirements?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-300 mb-2">Raw Material Requirements</p>
                    <div className="space-y-2">
                      {selectedRequest.raw_material_requirements.map((rm, idx) => (
                        <div key={idx} className={`flex justify-between p-2 rounded ${rm.sufficient ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                          <span>{rm.raw_material_name} ({rm.raw_material_sku})</span>
                          <span>
                            {rm.total_required} required / {rm.current_stock} in stock
                            {!rm.sufficient && <AlertTriangle className="w-4 h-4 inline ml-2 text-red-400" />}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Serial Numbers */}
                {selectedRequest.serial_numbers?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-300 mb-2">Serial Numbers</p>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {selectedRequest.serial_numbers.map((sn, idx) => (
                        <div key={idx} className="p-2 bg-slate-700 rounded font-mono text-sm">
                          {sn.serial_number}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-300">Timeline</p>
                  <div className="text-sm space-y-1">
                    <p><span className="text-slate-400">Created:</span> {formatDate(selectedRequest.created_at)} by {selectedRequest.created_by_name}</p>
                    {selectedRequest.accepted_at && <p><span className="text-slate-400">Accepted:</span> {formatDate(selectedRequest.accepted_at)} by {selectedRequest.accepted_by_name}</p>}
                    {selectedRequest.started_at && <p><span className="text-slate-400">Started:</span> {formatDate(selectedRequest.started_at)}</p>}
                    {selectedRequest.completed_at && <p><span className="text-slate-400">Completed:</span> {formatDate(selectedRequest.completed_at)} by {selectedRequest.completed_by_name}</p>}
                    {selectedRequest.received_at && <p><span className="text-slate-400">Received:</span> {formatDate(selectedRequest.received_at)} by {selectedRequest.received_by_name}</p>}
                  </div>
                </div>

                {selectedRequest.remarks && (
                  <div className="p-3 bg-slate-700/50 rounded-lg">
                    <p className="text-xs text-slate-400">Remarks</p>
                    <p>{selectedRequest.remarks}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Receive Into Inventory Dialog */}
        <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Confirm Receipt Into Inventory</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg">
                  <p className="font-medium">{selectedRequest.request_number}</p>
                  <p className="text-2xl font-bold">{selectedRequest.quantity_produced} units of {selectedRequest.master_sku_name}</p>
                </div>

                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-300 mb-2">This action will:</p>
                  <ul className="text-sm space-y-1 text-slate-400">
                    <li>• Deduct raw materials from inventory</li>
                    <li>• Add finished goods to inventory</li>
                    <li>• Register {selectedRequest.quantity_produced} serial numbers</li>
                    {selectedRequest.manufacturing_role === 'supervisor' && (
                      <li>• Create supervisor payable of {formatCurrency((selectedRequest.production_charge_per_unit || 0) * selectedRequest.quantity_produced)}</li>
                    )}
                  </ul>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setReceiveDialogOpen(false)} className="text-slate-300">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReceiveIntoInventory}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-700"
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
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            {selectedPayable && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400">Payable: {selectedPayable.payable_number}</p>
                  <p className="font-medium">{selectedPayable.master_sku_name}</p>
                  <div className="flex justify-between mt-2">
                    <span>Total: {formatCurrency(selectedPayable.total_payable)}</span>
                    <span>Paid: {formatCurrency(selectedPayable.amount_paid)}</span>
                    <span className="text-orange-400">Pending: {formatCurrency(selectedPayable.total_payable - selectedPayable.amount_paid)}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-300">Payment Amount *</Label>
                  <Input
                    type="number"
                    value={paymentForm.amount_paid}
                    onChange={(e) => setPaymentForm({...paymentForm, amount_paid: e.target.value})}
                    placeholder="Enter amount"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Payment Reference</Label>
                  <Input
                    value={paymentForm.payment_reference}
                    onChange={(e) => setPaymentForm({...paymentForm, payment_reference: e.target.value})}
                    placeholder="Transaction ID, Cheque #, etc."
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Remarks</Label>
                  <Textarea
                    value={paymentForm.remarks}
                    onChange={(e) => setPaymentForm({...paymentForm, remarks: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    rows={2}
                  />
                </div>

                <DialogFooter>
                  <Button variant="ghost" onClick={() => setPaymentDialogOpen(false)} className="text-slate-300">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRecordPayment}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-700"
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

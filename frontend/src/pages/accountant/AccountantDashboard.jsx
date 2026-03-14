import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
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
import { toast } from 'sonner';
import { 
  Package, Truck, FileText, Wrench, Loader2, Upload, 
  Eye, CheckCircle, Send, ArrowDownToLine, ArrowUpFromLine
} from 'lucide-react';

// Helper to extract error message from API responses
const getErrorMessage = (error, defaultMsg) => {
  const detail = error.response?.data?.detail;
  if (!detail) return defaultMsg;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    // Pydantic validation error format
    return detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
  }
  if (typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return defaultMsg;
};

export default function AccountantDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [dispatches, setDispatches] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hardware');
  
  // Dialog states
  const [createDispatchOpen, setCreateDispatchOpen] = useState(false);
  const [uploadLabelOpen, setUploadLabelOpen] = useState(false);
  const [pickupLabelOpen, setPickupLabelOpen] = useState(false);
  const [spareDispatchOpen, setSpareDispatchOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [dispatchForm, setDispatchForm] = useState({
    sku: '', customer_name: '', phone: '', address: '', reason: '', note: '',
    order_id: '', payment_reference: '', invoice_file: null,
    dispatch_type: 'new_order'
  });
  const [labelForm, setLabelForm] = useState({
    courier: '', tracking_id: '', label_file: null
  });
  const [pickupForm, setPickupForm] = useState({
    courier: '', tracking_id: '', label_file: null
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [dispatchRes, ticketsRes, skusRes] = await Promise.all([
        axios.get(`${API}/dispatches`, { headers }),
        axios.get(`${API}/tickets`, { headers }),
        axios.get(`${API}/admin/skus`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      const dispatchData = Array.isArray(dispatchRes.data) ? dispatchRes.data : [];
      const ticketData = Array.isArray(ticketsRes.data) ? ticketsRes.data : [];
      const skuData = Array.isArray(skusRes.data) ? skusRes.data : [];
      
      setDispatches(dispatchData);
      setTickets(ticketData);
      setSkus(skuData.filter(s => s && s.active && s.stock_quantity > 0));
      
      // Compute stats
      const pendingLabels = dispatchData.filter(d => d.status === 'pending_label').length;
      const readyToDispatch = dispatchData.filter(d => 
        d.status === 'ready_to_dispatch' || d.status === 'ready_for_dispatch'
      ).length;
      
      setStats({
        pending_labels: pendingLabels,
        ready_to_dispatch: readyToDispatch
      });
    } catch (error) {
      console.error('Fetch data error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ===========================================
  // FILTERED TICKET LISTS
  // ===========================================
  
  // Hardware Tab: Tickets needing accountant action
  // 1. From Supervisor: supervisor_action = "reverse_pickup" or "spare_dispatch"
  // 2. Direct from Support: status = "hardware_service" with NO supervisor_action (needs reverse pickup)
  const hardwareTickets = tickets.filter(t => 
    (t.status === 'hardware_service' || t.status === 'awaiting_label') &&
    (t.supervisor_action || t.support_type === 'hardware')
  );
  
  // Reverse Pickup: Tickets needing pickup label
  // Includes: supervisor decided reverse_pickup OR direct hardware route from support
  const reversePickupTickets = hardwareTickets.filter(t => 
    (t.supervisor_action === 'reverse_pickup' || (!t.supervisor_action && t.status === 'hardware_service')) && 
    !t.pickup_label
  );
  
  // Spare Dispatch: Tickets needing spare part sent (supervisor decided spare_dispatch)
  const spareDispatchTickets = hardwareTickets.filter(t => 
    t.supervisor_action === 'spare_dispatch'
  );

  // Repaired items ready for return dispatch (from technician)
  const repairedTickets = tickets.filter(t => 
    t.status === 'repair_completed' || t.status === 'service_invoice_added'
  );
  
  // Outbound dispatches pending labels
  const pendingLabelDispatches = dispatches.filter(d => d.status === 'pending_label');

  // ===========================================
  // HANDLERS
  // ===========================================

  // Create Outbound Dispatch (New Order or Spare Part - NOT from ticket)
  const handleCreateDispatch = async (e) => {
    e.preventDefault();
    
    if (!dispatchForm.order_id) {
      toast.error('Order ID is mandatory');
      return;
    }
    if (!dispatchForm.payment_reference) {
      toast.error('Payment Reference is mandatory');
      return;
    }
    if (!dispatchForm.invoice_file) {
      toast.error('Invoice/Delivery Challan is mandatory');
      return;
    }
    if (!dispatchForm.sku) {
      toast.error('Please select a SKU');
      return;
    }
    
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('dispatch_type', dispatchForm.dispatch_type);
      formData.append('sku', dispatchForm.sku);
      formData.append('customer_name', dispatchForm.customer_name);
      formData.append('phone', dispatchForm.phone);
      formData.append('address', dispatchForm.address);
      formData.append('reason', dispatchForm.reason);
      formData.append('note', dispatchForm.note || '');
      formData.append('order_id', dispatchForm.order_id);
      formData.append('payment_reference', dispatchForm.payment_reference);
      formData.append('invoice_file', dispatchForm.invoice_file);
      
      await axios.post(`${API}/dispatches`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Outbound dispatch created');
      setCreateDispatchOpen(false);
      setDispatchForm({ 
        sku: '', customer_name: '', phone: '', address: '', reason: '', note: '',
        order_id: '', payment_reference: '', invoice_file: null, dispatch_type: 'new_order'
      });
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create dispatch'));
    } finally {
      setActionLoading(false);
    }
  };

  // Upload shipping label for outbound dispatch
  const handleUploadLabel = async (e) => {
    e.preventDefault();
    if (!labelForm.label_file) {
      toast.error('Please select a label file');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('courier', labelForm.courier);
      formData.append('tracking_id', labelForm.tracking_id);
      formData.append('label_file', labelForm.label_file);

      await axios.patch(`${API}/dispatches/${selectedItem.id}/label`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Label uploaded - Ready for dispatch');
      setUploadLabelOpen(false);
      setLabelForm({ courier: '', tracking_id: '', label_file: null });
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to upload label'));
    } finally {
      setActionLoading(false);
    }
  };

  // Upload PICKUP label for customer (Reverse Pickup flow)
  const handleUploadPickupLabel = async (e) => {
    e.preventDefault();
    if (!pickupForm.label_file) {
      toast.error('Please select a label file');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('courier', pickupForm.courier);
      formData.append('tracking_id', pickupForm.tracking_id);
      formData.append('label_file', pickupForm.label_file);

      await axios.post(`${API}/tickets/${selectedItem.id}/upload-pickup-label`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Pickup label uploaded - Customer can now download and print it');
      setPickupLabelOpen(false);
      setPickupForm({ courier: '', tracking_id: '', label_file: null });
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to upload pickup label'));
    } finally {
      setActionLoading(false);
    }
  };

  // Create Spare Part Dispatch from ticket
  const handleCreateSpareDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchForm.sku) {
      toast.error('Please select a SKU');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('dispatch_type', 'spare_dispatch');
      formData.append('sku', dispatchForm.sku);
      formData.append('ticket_id', selectedItem.id);

      await axios.post(`${API}/dispatches/from-ticket/${selectedItem.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Spare part dispatch created');
      setSpareDispatchOpen(false);
      setDispatchForm({ ...dispatchForm, sku: '' });
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create spare dispatch'));
    } finally {
      setActionLoading(false);
    }
  };

  // Create Return Dispatch for repaired item
  const handleCreateReturnDispatch = async (ticket) => {
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('dispatch_type', 'return');
      formData.append('ticket_id', ticket.id);

      await axios.post(`${API}/dispatches/from-ticket/${ticket.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Return dispatch created for repaired item');
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create return dispatch'));
    } finally {
      setActionLoading(false);
    }
  };

  const openPickupLabelDialog = (ticket) => {
    setSelectedItem(ticket);
    setPickupForm({ courier: '', tracking_id: '', label_file: null });
    setPickupLabelOpen(true);
  };

  const openSpareDispatchDialog = (ticket) => {
    setSelectedItem(ticket);
    setDispatchForm({ ...dispatchForm, sku: ticket.supervisor_sku || '' });
    setSpareDispatchOpen(true);
  };

  const openUploadLabelDialog = (dispatch) => {
    setSelectedItem(dispatch);
    setLabelForm({ courier: '', tracking_id: '', label_file: null });
    setUploadLabelOpen(true);
  };

  if (loading) {
    return (
      <DashboardLayout title="Accountant Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Accountant Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6" data-testid="accountant-stats">
        <StatCard title="Reverse Pickup" value={reversePickupTickets.length} icon={ArrowDownToLine} color="orange" />
        <StatCard title="Spare Dispatch" value={spareDispatchTickets.length} icon={Package} color="blue" />
        <StatCard title="Repaired Items" value={repairedTickets.length} icon={Wrench} color="green" />
        <StatCard title="Pending Labels" value={stats?.pending_labels || 0} icon={FileText} color="purple" />
        <StatCard title="Ready to Ship" value={stats?.ready_to_dispatch || 0} icon={Truck} />
      </div>

      {/* Tabs */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-0">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="hardware" data-testid="hardware-tab">
                <Wrench className="w-4 h-4 mr-2" />
                Hardware Queue ({hardwareTickets.length})
              </TabsTrigger>
              <TabsTrigger value="repaired" data-testid="repaired-tab">
                <CheckCircle className="w-4 h-4 mr-2" />
                Repaired ({repairedTickets.length})
              </TabsTrigger>
              <TabsTrigger value="outbound" data-testid="outbound-tab">
                <ArrowUpFromLine className="w-4 h-4 mr-2" />
                Outbound
              </TabsTrigger>
              <TabsTrigger value="labels" data-testid="labels-tab">
                <FileText className="w-4 h-4 mr-2" />
                Upload Labels ({pendingLabelDispatches.length})
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="pt-6">
            {/* ===========================================
                HARDWARE TAB - From Supervisor Decisions
            =========================================== */}
            <TabsContent value="hardware" className="mt-0">
              <div className="mb-4">
                <p className="text-sm text-slate-500">Hardware tickets requiring your action (from Support Agent or Supervisor)</p>
              </div>

              {hardwareTickets.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>No pending hardware tickets!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {hardwareTickets.map((ticket) => (
                    <Card key={ticket.id} className={`border-l-4 ${
                      ticket.supervisor_action === 'spare_dispatch' ? 'border-l-blue-500 bg-blue-50/30' :
                      ticket.supervisor_action === 'reverse_pickup' ? 'border-l-orange-500 bg-orange-50/30' :
                      'border-l-slate-300'
                    }`}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            {/* Header with ticket number and action badge */}
                            <div className="flex items-center gap-3 mb-3">
                              <span className="font-mono text-sm font-bold">{ticket.ticket_number}</span>
                              <StatusBadge status={ticket.status} />
                              {ticket.supervisor_action ? (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                  ticket.supervisor_action === 'spare_dispatch' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-orange-600 text-white'
                                }`}>
                                  {ticket.supervisor_action === 'spare_dispatch' ? 'SEND SPARE PART' : 'REVERSE PICKUP'}
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-orange-600 text-white">
                                  REVERSE PICKUP (DIRECT)
                                </span>
                              )}
                              {ticket.pickup_label && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                  PICKUP LABEL UPLOADED
                                </span>
                              )}
                            </div>
                            
                            {/* Customer Info Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                              <div>
                                <p className="text-xs text-slate-500">Customer</p>
                                <p className="font-medium">{ticket.customer_name}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Phone</p>
                                <p className="font-mono text-sm">{ticket.customer_phone}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Device</p>
                                <p className="font-medium">{ticket.device_type}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">City</p>
                                <p className="font-medium">{ticket.customer_city || '-'}</p>
                              </div>
                            </div>

                            {/* Issue */}
                            <div className="bg-slate-100 p-3 rounded-lg mb-3">
                              <p className="text-xs text-slate-500 font-medium mb-1">ISSUE</p>
                              <p className="text-sm">{ticket.issue_description}</p>
                            </div>

                            {/* Notes Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {ticket.agent_notes && (
                                <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                                  <p className="text-xs text-purple-600 font-bold mb-1">SUPPORT AGENT NOTES</p>
                                  <p className="text-sm text-purple-800">{ticket.agent_notes}</p>
                                </div>
                              )}
                              {ticket.escalation_notes && (
                                <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                                  <p className="text-xs text-orange-600 font-bold mb-1">ESCALATION NOTES</p>
                                  <p className="text-sm text-orange-800">{ticket.escalation_notes}</p>
                                  {ticket.escalated_by_name && (
                                    <p className="text-xs text-orange-500 mt-1">By: {ticket.escalated_by_name}</p>
                                  )}
                                </div>
                              )}
                              {ticket.supervisor_notes && (
                                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg md:col-span-2">
                                  <p className="text-xs text-blue-600 font-bold mb-1">SUPERVISOR DECISION</p>
                                  <p className="text-sm text-blue-800">{ticket.supervisor_notes}</p>
                                  {ticket.supervisor_sku && (
                                    <p className="text-xs text-blue-600 mt-2 font-medium">Recommended SKU: {ticket.supervisor_sku}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="ml-4 flex flex-col items-end gap-2">
                            {/* Show pickup label button for reverse_pickup OR direct hardware tickets */}
                            {(ticket.supervisor_action === 'reverse_pickup' || (!ticket.supervisor_action && ticket.status === 'hardware_service')) && !ticket.pickup_label && (
                              <Button 
                                className="bg-orange-600 hover:bg-orange-700"
                                onClick={() => openPickupLabelDialog(ticket)}
                                data-testid={`upload-pickup-${ticket.id}`}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Pickup Label
                              </Button>
                            )}
                            {ticket.supervisor_action === 'spare_dispatch' && (
                              <Button 
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => openSpareDispatchDialog(ticket)}
                                data-testid={`create-spare-${ticket.id}`}
                              >
                                <Package className="w-4 h-4 mr-2" />
                                Create Spare Dispatch
                              </Button>
                            )}
                            {ticket.pickup_label && (
                              <span className="text-sm text-green-600">Pickup label sent to customer</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ===========================================
                REPAIRED TAB - Items from Technician
            =========================================== */}
            <TabsContent value="repaired" className="mt-0">
              <div className="mb-4">
                <p className="text-sm text-slate-500">Repaired items ready to be dispatched back to customer</p>
              </div>

              {repairedTickets.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>No repaired items pending</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Repair Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repairedTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="data-row">
                        <TableCell className="font-mono text-sm font-medium">{ticket.ticket_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{ticket.customer_name}</p>
                            <p className="text-xs text-slate-500">{ticket.customer_phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>{ticket.device_type}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="bg-green-50 p-2 rounded text-sm text-green-800">
                            {ticket.repair_notes || 'Repair completed'}
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge status={ticket.status} /></TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleCreateReturnDispatch(ticket)}
                            disabled={actionLoading}
                            data-testid={`return-dispatch-${ticket.id}`}
                          >
                            <Truck className="w-4 h-4 mr-2" />
                            Create Return Dispatch
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* ===========================================
                OUTBOUND TAB - New Orders / Spare Parts
            =========================================== */}
            <TabsContent value="outbound" className="mt-0">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-slate-500">Create new outbound dispatch (New Order or Spare Part)</p>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setCreateDispatchOpen(true)}
                  data-testid="create-dispatch-btn"
                >
                  <Send className="w-4 h-4 mr-2" />
                  New Outbound Dispatch
                </Button>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="font-medium text-slate-700 mb-2">What is Outbound?</h4>
                <p className="text-sm text-slate-600">
                  Items going OUT from service center to customer:
                </p>
                <ul className="text-sm text-slate-600 mt-2 list-disc list-inside">
                  <li><strong>New Order</strong> - New product being shipped</li>
                  <li><strong>Spare Part</strong> - Replacement part being sent</li>
                  <li><strong>Repaired Item</strong> - Use the "Repaired" tab for this</li>
                </ul>
              </div>
            </TabsContent>

            {/* ===========================================
                LABELS TAB - Upload Shipping Labels
            =========================================== */}
            <TabsContent value="labels" className="mt-0">
              <p className="text-sm text-slate-500 mb-4">Upload shipping labels for outbound dispatches</p>
              {pendingLabelDispatches.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>No dispatches pending labels</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispatch #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Ticket #</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLabelDispatches.map((dispatch) => (
                      <TableRow key={dispatch.id} className="data-row">
                        <TableCell className="font-mono text-sm">{dispatch.dispatch_number}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            dispatch.dispatch_type === 'new_order' ? 'bg-blue-100 text-blue-700' :
                            dispatch.dispatch_type === 'spare_dispatch' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {dispatch.dispatch_type?.replace('_', ' ').toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>{dispatch.customer_name}</TableCell>
                        <TableCell className="font-mono text-sm">{dispatch.sku || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{dispatch.ticket_number || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            onClick={() => openUploadLabelDialog(dispatch)}
                            data-testid={`upload-label-${dispatch.id}`}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Label
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* ===========================================
          DIALOGS
      =========================================== */}

      {/* Create Outbound Dispatch Dialog */}
      <Dialog open={createDispatchOpen} onOpenChange={setCreateDispatchOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Outbound Dispatch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDispatch} className="space-y-4">
            <div className="space-y-2">
              <Label>Dispatch Type *</Label>
              <Select 
                value={dispatchForm.dispatch_type} 
                onValueChange={(v) => setDispatchForm({...dispatchForm, dispatch_type: v})}
              >
                <SelectTrigger data-testid="dispatch-type-select">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_order">New Order</SelectItem>
                  <SelectItem value="spare_dispatch">Spare Part</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select SKU *</Label>
              <Select value={dispatchForm.sku} onValueChange={(v) => setDispatchForm({...dispatchForm, sku: v})}>
                <SelectTrigger data-testid="sku-select">
                  <SelectValue placeholder="Choose product" />
                </SelectTrigger>
                <SelectContent>
                  {skus.map(sku => (
                    <SelectItem key={sku.id} value={sku.sku_code}>
                      {sku.model_name} ({sku.sku_code}) - Stock: {sku.stock_quantity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Order ID *</Label>
                <Input 
                  placeholder="e.g., AMZ-123456"
                  value={dispatchForm.order_id}
                  onChange={(e) => setDispatchForm({...dispatchForm, order_id: e.target.value})}
                  required
                  data-testid="order-id-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Reference *</Label>
                <Input 
                  placeholder="e.g., TXN-789012"
                  value={dispatchForm.payment_reference}
                  onChange={(e) => setDispatchForm({...dispatchForm, payment_reference: e.target.value})}
                  required
                  data-testid="payment-ref-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Invoice / Delivery Challan *</Label>
              <Input 
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setDispatchForm({...dispatchForm, invoice_file: e.target.files[0]})}
                required
                data-testid="invoice-file-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input 
                  value={dispatchForm.customer_name}
                  onChange={(e) => setDispatchForm({...dispatchForm, customer_name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input 
                  value={dispatchForm.phone}
                  onChange={(e) => setDispatchForm({...dispatchForm, phone: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address *</Label>
              <Textarea 
                value={dispatchForm.address}
                onChange={(e) => setDispatchForm({...dispatchForm, address: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Input 
                placeholder="e.g., New sale, Replacement"
                value={dispatchForm.reason}
                onChange={(e) => setDispatchForm({...dispatchForm, reason: e.target.value})}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDispatchOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Create Dispatch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Shipping Label Dialog (for outbound dispatches) */}
      <Dialog open={uploadLabelOpen} onOpenChange={setUploadLabelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Shipping Label - {selectedItem?.dispatch_number}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUploadLabel} className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm"><strong>Customer:</strong> {selectedItem?.customer_name}</p>
              <p className="text-sm"><strong>SKU:</strong> {selectedItem?.sku || 'N/A'}</p>
              <p className="text-sm"><strong>Type:</strong> {selectedItem?.dispatch_type}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Courier *</Label>
                <Input 
                  placeholder="e.g., Delhivery"
                  value={labelForm.courier}
                  onChange={(e) => setLabelForm({...labelForm, courier: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tracking ID *</Label>
                <Input 
                  placeholder="e.g., DEL123456"
                  value={labelForm.tracking_id}
                  onChange={(e) => setLabelForm({...labelForm, tracking_id: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Label File *</Label>
              <Input 
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setLabelForm({...labelForm, label_file: e.target.files[0]})}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadLabelOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload Label
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload PICKUP Label Dialog (for customer to print - Reverse Pickup) */}
      <Dialog open={pickupLabelOpen} onOpenChange={setPickupLabelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Pickup Label for Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUploadPickupLabel} className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Ticket:</strong> {selectedItem?.ticket_number}
              </p>
              <p className="text-sm text-orange-800">
                <strong>Customer:</strong> {selectedItem?.customer_name}
              </p>
              <p className="text-sm text-orange-700 mt-2">
                This label will be available for the customer to download and print.
                Customer will paste it on their package for pickup.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Courier *</Label>
                <Input 
                  placeholder="e.g., Delhivery"
                  value={pickupForm.courier}
                  onChange={(e) => setPickupForm({...pickupForm, courier: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tracking ID *</Label>
                <Input 
                  placeholder="e.g., DEL123456"
                  value={pickupForm.tracking_id}
                  onChange={(e) => setPickupForm({...pickupForm, tracking_id: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Label File (PDF/Image) *</Label>
              <Input 
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setPickupForm({...pickupForm, label_file: e.target.files[0]})}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPickupLabelOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload Pickup Label
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Spare Dispatch Dialog */}
      <Dialog open={spareDispatchOpen} onOpenChange={setSpareDispatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Spare Part Dispatch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSpareDispatch} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Ticket:</strong> {selectedItem?.ticket_number}
              </p>
              <p className="text-sm text-blue-800">
                <strong>Customer:</strong> {selectedItem?.customer_name}
              </p>
              {selectedItem?.supervisor_sku && (
                <p className="text-sm text-blue-600 mt-2">
                  <strong>Supervisor recommended:</strong> {selectedItem?.supervisor_sku}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Select SKU *</Label>
              <Select value={dispatchForm.sku} onValueChange={(v) => setDispatchForm({...dispatchForm, sku: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose spare part" />
                </SelectTrigger>
                <SelectContent>
                  {skus.map(sku => (
                    <SelectItem key={sku.id} value={sku.sku_code}>
                      {sku.model_name} ({sku.sku_code}) - Stock: {sku.stock_quantity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSpareDispatchOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Package className="w-4 h-4 mr-2" />}
                Create Dispatch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

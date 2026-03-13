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
  Eye, CheckCircle, Send 
} from 'lucide-react';

export default function AccountantDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [dispatches, setDispatches] = useState([]);
  const [hardwareTickets, setHardwareTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('outbound');
  
  // Dialog states
  const [createDispatchOpen, setCreateDispatchOpen] = useState(false);
  const [uploadLabelOpen, setUploadLabelOpen] = useState(false);
  const [hardwareActionOpen, setHardwareActionOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states - Updated with mandatory fields
  const [dispatchForm, setDispatchForm] = useState({
    sku: '', customer_name: '', phone: '', address: '', reason: '', note: '',
    order_id: '', payment_reference: '', invoice_file: null,
    dispatch_type: 'new_order' // new_order, part_dispatch, other
  });
  const [labelForm, setLabelForm] = useState({
    courier: '', tracking_id: '', label_file: null
  });
  const [hardwareForm, setHardwareForm] = useState({
    dispatch_type: '', sku: ''
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [dispatchRes, ticketsRes] = await Promise.all([
        axios.get(`${API}/dispatches`, { headers }),
        axios.get(`${API}/tickets`, { headers })
      ]);
      setDispatches(dispatchRes.data);
      
      // Filter hardware tickets
      const hwTickets = ticketsRes.data.filter(t => t.status === 'hardware_service' || t.status === 'awaiting_label');
      setHardwareTickets(hwTickets);
      
      // Compute stats locally
      const pendingLabels = dispatchRes.data.filter(d => d.status === 'pending_label').length;
      const readyToDispatch = dispatchRes.data.filter(d => d.status === 'ready_to_dispatch' || d.status === 'ready_for_dispatch').length;
      
      setStats({
        pending_labels: pendingLabels,
        hardware_tickets: hwTickets.length,
        ready_to_dispatch: readyToDispatch
      });
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDispatch = async (e) => {
    e.preventDefault();
    
    // Validate mandatory fields
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
      toast.success('Dispatch request created');
      setCreateDispatchOpen(false);
      setDispatchForm({ 
        sku: '', customer_name: '', phone: '', address: '', reason: '', note: '',
        order_id: '', payment_reference: '', invoice_file: null, dispatch_type: 'new_order'
      });
      fetchData();
    } catch (error) {
      console.error('Create dispatch error:', error);
      toast.error('Failed to create dispatch: ' + (error.response?.data?.detail || error.message));
    } finally {
      setActionLoading(false);
    }
  };

  const openLabelDialog = (dispatch) => {
    setSelectedItem(dispatch);
    setLabelForm({ courier: '', tracking_id: '', label_file: null });
    setUploadLabelOpen(true);
  };

  const handleUploadLabel = async (e) => {
    e.preventDefault();
    if (!labelForm.label_file) {
      toast.error('Please upload a label file');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('courier', labelForm.courier);
      formData.append('tracking_id', labelForm.tracking_id);
      formData.append('label_file', labelForm.label_file);

      await axios.patch(`${API}/dispatches/${selectedItem.id}/label`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Label uploaded successfully');
      setUploadLabelOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to upload label');
    } finally {
      setActionLoading(false);
    }
  };

  const openHardwareAction = (ticket) => {
    setSelectedItem(ticket);
    // Pre-populate based on supervisor's decision
    const defaultDispatchType = ticket.supervisor_action || '';
    const defaultSku = ticket.supervisor_sku || '';
    setHardwareForm({ dispatch_type: defaultDispatchType, sku: defaultSku });
    setHardwareActionOpen(true);
  };

  const handleHardwareAction = async () => {
    if (!hardwareForm.dispatch_type) {
      toast.error('Please select an action');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('dispatch_type', hardwareForm.dispatch_type);
      if (hardwareForm.sku) formData.append('sku', hardwareForm.sku);

      await axios.post(`${API}/dispatches/from-ticket/${selectedItem.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${hardwareForm.dispatch_type === 'reverse_pickup' ? 'Reverse pickup' : 'Part dispatch'} created`);
      setHardwareActionOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to create dispatch');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingLabelDispatches = dispatches.filter(d => d.status === 'pending_label');
  const readyDispatches = dispatches.filter(d => d.status === 'ready_for_dispatch' || d.status === 'ready_to_dispatch');

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6" data-testid="accountant-stats">
        <StatCard title="Pending Labels" value={stats?.pending_labels || 0} icon={FileText} />
        <StatCard title="Hardware Tickets" value={stats?.hardware_tickets || 0} icon={Wrench} />
        <StatCard title="Ready to Dispatch" value={stats?.ready_to_dispatch || 0} icon={Truck} />
        <StatCard title="Total Dispatches" value={dispatches.length} icon={Package} />
      </div>

      {/* Tabs */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-0">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="outbound" data-testid="outbound-tab">
                <Package className="w-4 h-4 mr-2" />
                Outbound ({pendingLabelDispatches.length})
              </TabsTrigger>
              <TabsTrigger value="labels" data-testid="labels-tab">
                <FileText className="w-4 h-4 mr-2" />
                Upload Labels
              </TabsTrigger>
              <TabsTrigger value="hardware" data-testid="hardware-tab">
                <Wrench className="w-4 h-4 mr-2" />
                Hardware ({hardwareTickets.length})
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Outbound Dashboard */}
            <TabsContent value="outbound" className="mt-0">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-slate-500">Manage outbound dispatch requests</p>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setCreateDispatchOpen(true)}
                  data-testid="create-dispatch-btn"
                >
                  <Package className="w-4 h-4 mr-2" />
                  New Request
                </Button>
              </div>
              
              {pendingLabelDispatches.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>All dispatches have labels</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispatch #</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLabelDispatches.map((dispatch) => (
                      <TableRow key={dispatch.id} className="data-row">
                        <TableCell className="font-mono text-sm">{dispatch.dispatch_number}</TableCell>
                        <TableCell>{dispatch.sku}</TableCell>
                        <TableCell>{dispatch.customer_name}</TableCell>
                        <TableCell className="font-mono text-sm">{dispatch.phone}</TableCell>
                        <TableCell className="max-w-xs truncate">{dispatch.reason}</TableCell>
                        <TableCell><StatusBadge status={dispatch.status} /></TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => openLabelDialog(dispatch)}
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            Add Label
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Labels Tab */}
            <TabsContent value="labels" className="mt-0">
              <p className="text-sm text-slate-500 mb-4">Dispatches ready for shipping</p>
              {readyDispatches.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No dispatches ready</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispatch #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Courier</TableHead>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readyDispatches.map((dispatch) => (
                      <TableRow key={dispatch.id} className="data-row">
                        <TableCell className="font-mono text-sm">{dispatch.dispatch_number}</TableCell>
                        <TableCell className="capitalize">{dispatch.dispatch_type?.replace('_', ' ')}</TableCell>
                        <TableCell>{dispatch.customer_name}</TableCell>
                        <TableCell>{dispatch.courier}</TableCell>
                        <TableCell className="font-mono text-sm">{dispatch.tracking_id}</TableCell>
                        <TableCell><StatusBadge status={dispatch.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Hardware Tickets Tab - Improved with clear action guidance */}
            <TabsContent value="hardware" className="mt-0">
              <div className="mb-4">
                <p className="text-sm text-slate-500">Tickets requiring hardware service action</p>
              </div>
              {hardwareTickets.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>No hardware tickets pending</p>
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
                          {/* Ticket Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-mono text-sm font-bold">{ticket.ticket_number}</span>
                              <StatusBadge status={ticket.status} />
                              {ticket.supervisor_action && (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                  ticket.supervisor_action === 'spare_dispatch' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-orange-600 text-white'
                                }`}>
                                  {ticket.supervisor_action === 'spare_dispatch' ? 'SEND SPARE PART' : 'REVERSE PICKUP'}
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
                              <p className="text-xs text-slate-500 font-medium mb-1">ISSUE DESCRIPTION</p>
                              <p className="text-sm">{ticket.issue_description}</p>
                            </div>

                            {/* All Notes Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Agent Notes */}
                              {ticket.agent_notes && (
                                <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                                  <p className="text-xs text-purple-600 font-bold mb-1">SUPPORT AGENT NOTES</p>
                                  <p className="text-sm text-purple-800">{ticket.agent_notes}</p>
                                </div>
                              )}
                              
                              {/* Escalation Notes (when agent escalated to supervisor) */}
                              {ticket.escalation_notes && (
                                <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                                  <p className="text-xs text-orange-600 font-bold mb-1">ESCALATION NOTES (Agent to Supervisor)</p>
                                  <p className="text-sm text-orange-800">{ticket.escalation_notes}</p>
                                  {ticket.escalated_by_name && (
                                    <p className="text-xs text-orange-500 mt-1">By: {ticket.escalated_by_name}</p>
                                  )}
                                </div>
                              )}
                              
                              {/* Supervisor Notes */}
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

                          {/* Action Button */}
                          <div className="ml-4 flex flex-col items-end gap-2">
                            <Button 
                              size="default"
                              className={`${
                                ticket.supervisor_action === 'spare_dispatch' 
                                  ? 'bg-blue-600 hover:bg-blue-700' 
                                  : 'bg-orange-600 hover:bg-orange-700'
                              }`}
                              onClick={() => openHardwareAction(ticket)}
                              data-testid={`process-hardware-${ticket.id}`}
                            >
                              <Package className="w-4 h-4 mr-2" />
                              {ticket.supervisor_action === 'spare_dispatch' 
                                ? 'Create Spare Dispatch' 
                                : ticket.supervisor_action === 'reverse_pickup'
                                  ? 'Create Pickup Label'
                                  : 'Process Ticket'}
                            </Button>
                            {!ticket.supervisor_action && !ticket.supervisor_notes && (
                              <p className="text-xs text-red-500 text-right max-w-[150px]">
                                No supervisor decision yet
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Create Dispatch Dialog - Enhanced with mandatory fields */}
      <Dialog open={createDispatchOpen} onOpenChange={setCreateDispatchOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Outbound Dispatch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDispatch} className="space-y-4">
            {/* Dispatch Type */}
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
                  <SelectItem value="part_dispatch">Part Dispatch</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
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
              <p className="text-xs text-slate-500">Upload invoice or delivery challan (PDF, JPG, PNG)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU *</Label>
                <Input 
                  placeholder="e.g., MG-INV-6200"
                  value={dispatchForm.sku}
                  onChange={(e) => setDispatchForm({...dispatchForm, sku: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input 
                  value={dispatchForm.customer_name}
                  onChange={(e) => setDispatchForm({...dispatchForm, customer_name: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input 
                  value={dispatchForm.phone}
                  onChange={(e) => setDispatchForm({...dispatchForm, phone: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Input 
                  placeholder="e.g., Replacement, New Sale"
                  value={dispatchForm.reason}
                  onChange={(e) => setDispatchForm({...dispatchForm, reason: e.target.value})}
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
              <Label>Note</Label>
              <Textarea 
                placeholder="Additional notes..."
                value={dispatchForm.note}
                onChange={(e) => setDispatchForm({...dispatchForm, note: e.target.value})}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDispatchOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Label Dialog */}
      <Dialog open={uploadLabelOpen} onOpenChange={setUploadLabelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Shipping Label - {selectedItem?.dispatch_number}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUploadLabel} className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg text-sm">
              <p><strong>Customer:</strong> {selectedItem?.customer_name}</p>
              <p><strong>Address:</strong> {selectedItem?.address}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Courier *</Label>
                <Select value={labelForm.courier} onValueChange={(v) => setLabelForm({...labelForm, courier: v})}>
                  <SelectTrigger><SelectValue placeholder="Select courier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BlueDart">BlueDart</SelectItem>
                    <SelectItem value="DTDC">DTDC</SelectItem>
                    <SelectItem value="Delhivery">Delhivery</SelectItem>
                    <SelectItem value="FedEx">FedEx</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tracking ID *</Label>
                <Input 
                  value={labelForm.tracking_id}
                  onChange={(e) => setLabelForm({...labelForm, tracking_id: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Upload Label *</Label>
              <Input 
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setLabelForm({...labelForm, label_file: e.target.files[0]})}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadLabelOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hardware Action Dialog - Enhanced with all notes */}
      <Dialog open={hardwareActionOpen} onOpenChange={setHardwareActionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Process Hardware Ticket - {selectedItem?.ticket_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Customer & Device Info */}
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm"><strong>Customer:</strong> {selectedItem?.customer_name}</p>
              <p className="text-sm"><strong>Phone:</strong> {selectedItem?.customer_phone}</p>
              <p className="text-sm"><strong>Device:</strong> {selectedItem?.device_type}</p>
              <p className="text-sm"><strong>City:</strong> {selectedItem?.customer_city || '-'}</p>
            </div>

            {/* Issue */}
            <div className="bg-slate-100 p-3 rounded-lg">
              <p className="text-xs text-slate-500 font-medium mb-1">ISSUE</p>
              <p className="text-sm">{selectedItem?.issue_description}</p>
            </div>

            {/* Supervisor Recommendation - Most Important */}
            {selectedItem?.supervisor_action && (
              <div className={`p-4 rounded-lg border-2 ${
                selectedItem.supervisor_action === 'spare_dispatch' 
                  ? 'bg-blue-50 border-blue-500' 
                  : 'bg-orange-50 border-orange-500'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Package className={`w-5 h-5 ${
                    selectedItem.supervisor_action === 'spare_dispatch' ? 'text-blue-600' : 'text-orange-600'
                  }`} />
                  <span className={`font-bold uppercase text-sm ${
                    selectedItem.supervisor_action === 'spare_dispatch' ? 'text-blue-700' : 'text-orange-700'
                  }`}>
                    SUPERVISOR RECOMMENDS: {selectedItem.supervisor_action === 'spare_dispatch' ? 'SEND SPARE PART' : 'REVERSE PICKUP'}
                  </span>
                </div>
                {selectedItem.supervisor_notes && (
                  <p className="text-sm mb-2">{selectedItem.supervisor_notes}</p>
                )}
                {selectedItem.supervisor_sku && (
                  <p className="text-sm font-medium">Suggested SKU: {selectedItem.supervisor_sku}</p>
                )}
              </div>
            )}

            {/* Agent Notes */}
            {selectedItem?.agent_notes && (
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <p className="text-xs text-purple-600 font-bold mb-1">SUPPORT AGENT NOTES</p>
                <p className="text-sm text-purple-800">{selectedItem.agent_notes}</p>
              </div>
            )}

            {/* Escalation Notes */}
            {selectedItem?.escalation_notes && (
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                <p className="text-xs text-orange-600 font-bold mb-1">ESCALATION NOTES</p>
                <p className="text-sm text-orange-800">{selectedItem.escalation_notes}</p>
                {selectedItem.escalated_by_name && (
                  <p className="text-xs text-orange-500 mt-1">By: {selectedItem.escalated_by_name}</p>
                )}
              </div>
            )}

            {/* Action Selection */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="font-medium">Select Action *</Label>
              <Select value={hardwareForm.dispatch_type} onValueChange={(v) => setHardwareForm({...hardwareForm, dispatch_type: v})}>
                <SelectTrigger className={hardwareForm.dispatch_type ? 'border-green-500' : ''}>
                  <SelectValue placeholder="Choose action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reverse_pickup">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-orange-600" />
                      Reverse Pickup (Pick up from customer)
                    </div>
                  </SelectItem>
                  <SelectItem value="spare_dispatch">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      Spare Part Dispatch (Send part to customer)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* SKU Input for spare dispatch */}
            {(hardwareForm.dispatch_type === 'spare_dispatch' || hardwareForm.dispatch_type === 'part_dispatch') && (
              <div className="space-y-2">
                <Label>Part SKU</Label>
                <Input 
                  placeholder="e.g., MG-SP-FAN01"
                  value={hardwareForm.sku}
                  onChange={(e) => setHardwareForm({...hardwareForm, sku: e.target.value})}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHardwareActionOpen(false)}>Cancel</Button>
            <Button 
              className={`${
                hardwareForm.dispatch_type === 'spare_dispatch' 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
              onClick={handleHardwareAction}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

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

  // Form states
  const [dispatchForm, setDispatchForm] = useState({
    sku: '', customer_name: '', phone: '', address: '', reason: '', note: ''
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
    setActionLoading(true);
    try {
      const payload = {
        dispatch_type: 'outbound',
        ...dispatchForm
      };
      await axios.post(`${API}/dispatches`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Dispatch request created');
      setCreateDispatchOpen(false);
      setDispatchForm({ sku: '', customer_name: '', phone: '', address: '', reason: '', note: '' });
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
    setHardwareForm({ dispatch_type: '', sku: '' });
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

            {/* Hardware Tickets Tab */}
            <TabsContent value="hardware" className="mt-0">
              <p className="text-sm text-slate-500 mb-4">Tickets requiring hardware service</p>
              {hardwareTickets.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>No hardware tickets pending</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Agent Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hardwareTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="data-row">
                        <TableCell className="font-mono text-sm">{ticket.ticket_number}</TableCell>
                        <TableCell>{ticket.customer_name}</TableCell>
                        <TableCell className="font-mono text-sm">{ticket.customer_phone}</TableCell>
                        <TableCell>{ticket.device_type}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="bg-orange-50 p-2 rounded text-sm text-orange-800">
                            {ticket.agent_notes || 'No notes'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            className="bg-orange-600 hover:bg-orange-700"
                            onClick={() => openHardwareAction(ticket)}
                            data-testid={`process-hardware-${ticket.id}`}
                          >
                            Process
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

      {/* Create Dispatch Dialog */}
      <Dialog open={createDispatchOpen} onOpenChange={setCreateDispatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Outbound Dispatch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDispatch} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU *</Label>
                <Input 
                  placeholder="e.g., INV-1000"
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
                  placeholder="e.g., Replacement"
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

      {/* Hardware Action Dialog */}
      <Dialog open={hardwareActionOpen} onOpenChange={setHardwareActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Hardware Ticket - {selectedItem?.ticket_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm"><strong>Customer:</strong> {selectedItem?.customer_name}</p>
              <p className="text-sm"><strong>Device:</strong> {selectedItem?.device_type}</p>
              <p className="text-sm"><strong>Issue:</strong> {selectedItem?.issue_description}</p>
            </div>
            {selectedItem?.agent_notes && (
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                <p className="text-sm font-medium text-orange-800">Agent Notes:</p>
                <p className="text-sm text-orange-700">{selectedItem.agent_notes}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Select Action *</Label>
              <Select value={hardwareForm.dispatch_type} onValueChange={(v) => setHardwareForm({...hardwareForm, dispatch_type: v})}>
                <SelectTrigger><SelectValue placeholder="Choose action" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reverse_pickup">Reverse Pickup (Pick up from customer)</SelectItem>
                  <SelectItem value="part_dispatch">Part Dispatch (Send spare part)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hardwareForm.dispatch_type === 'part_dispatch' && (
              <div className="space-y-2">
                <Label>Part SKU</Label>
                <Input 
                  placeholder="e.g., BAT-SPARE-001"
                  value={hardwareForm.sku}
                  onChange={(e) => setHardwareForm({...hardwareForm, sku: e.target.value})}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHardwareActionOpen(false)}>Cancel</Button>
            <Button 
              className="bg-orange-600 hover:bg-orange-700" 
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

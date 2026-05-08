import React, { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Factory, Loader2, Eye, CheckCircle, Clock, Play, 
  Package, Plus, Trash2, DollarSign
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

export default function SupervisorProduction() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [payables, setPayables] = useState({ payables: [], summary: {} });
  
  const [activeTab, setActiveTab] = useState('queue');
  
  // Dialogs
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Serial number entry form
  const [serialNumbers, setSerialNumbers] = useState([{ serial_number: '', notes: '' }]);
  const [completionNotes, setCompletionNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [requestsRes, payablesRes] = await Promise.all([
        axios.get(`${API}/production-requests`, { headers }),
        axios.get(`${API}/supervisor-payables`, { headers })
      ]);
      setRequests(requestsRes.data || []);
      setPayables(payablesRes.data || { payables: [], summary: {} });
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    setActionLoading(true);
    try {
      await axios.put(`${API}/production-requests/${requestId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Production request accepted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async (requestId) => {
    setActionLoading(true);
    try {
      await axios.put(`${API}/production-requests/${requestId}/start`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Production started');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start');
    } finally {
      setActionLoading(false);
    }
  };

  const openCompleteDialog = (request) => {
    setSelectedRequest(request);
    // Pre-populate serial number fields based on quantity
    const qty = request.quantity_requested;
    setSerialNumbers(Array(qty).fill(null).map(() => ({ serial_number: '', notes: '' })));
    setCompletionNotes('');
    setCompleteDialogOpen(true);
  };

  const handleComplete = async () => {
    if (!selectedRequest) return;

    // Validate all serial numbers are filled
    const emptySerials = serialNumbers.filter(sn => !sn.serial_number.trim());
    if (emptySerials.length > 0) {
      toast.error('Please fill in all serial numbers');
      return;
    }

    // Check for duplicates
    const serialList = serialNumbers.map(sn => sn.serial_number.trim());
    if (new Set(serialList).size !== serialList.length) {
      toast.error('Duplicate serial numbers found');
      return;
    }

    setActionLoading(true);
    try {
      await axios.put(`${API}/production-requests/${selectedRequest.id}/complete`, {
        serial_numbers: serialNumbers.map(sn => ({
          serial_number: sn.serial_number.trim(),
          notes: sn.notes
        })),
        completion_notes: completionNotes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Production completed! Awaiting accountant confirmation.');
      setCompleteDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete');
    } finally {
      setActionLoading(false);
    }
  };

  const updateSerial = (index, field, value) => {
    setSerialNumbers(serialNumbers.map((sn, i) => 
      i === index ? { ...sn, [field]: value } : sn
    ));
  };

  const openViewDialog = (request) => {
    setSelectedRequest(request);
    setViewDialogOpen(true);
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

  // Filter requests
  const pendingQueue = requests.filter(r => r.status === 'requested');
  const inProgressQueue = requests.filter(r => ['accepted', 'in_progress'].includes(r.status));
  const completedQueue = requests.filter(r => ['completed', 'received_into_inventory'].includes(r.status));

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
        <div>
          <h1 className="text-2xl font-bold text-white">Production Queue</h1>
          <p className="text-slate-400">Manage your assigned battery production jobs</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/20 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Pending Jobs</p>
                  <p className="text-2xl font-bold text-white">{pendingQueue.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <Play className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">In Progress</p>
                  <p className="text-2xl font-bold text-white">{inProgressQueue.length}</p>
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
                  <p className="text-sm text-slate-400">Completed</p>
                  <p className="text-2xl font-bold text-white">{completedQueue.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Earnings</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(payables.summary?.total_payable)}</p>
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
                <TabsTrigger value="queue" data-testid="queue-tab">
                  <Factory className="w-4 h-4 mr-2" />
                  Production Queue ({pendingQueue.length + inProgressQueue.length})
                </TabsTrigger>
                <TabsTrigger value="history" data-testid="history-tab">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Completed ({completedQueue.length})
                </TabsTrigger>
                <TabsTrigger value="earnings" data-testid="earnings-tab">
                  <DollarSign className="w-4 h-4 mr-2" />
                  My Earnings
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              {/* Production Queue Tab */}
              <TabsContent value="queue" className="mt-0">
                {pendingQueue.length === 0 && inProgressQueue.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Factory className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No pending production jobs</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Pending Jobs */}
                    {pendingQueue.map((req) => (
                      <Card key={req.id} className="bg-yellow-900/20 border-yellow-700">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-mono text-cyan-400">{req.request_number}</span>
                                <Badge className={STATUS_COLORS[req.status]}>{STATUS_LABELS[req.status]}</Badge>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                                <div>
                                  <p className="text-xs text-slate-400">Product</p>
                                  <p className="font-medium text-white">{req.master_sku_name}</p>
                                  <p className="text-xs text-slate-400">{req.master_sku_code}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400">Firm</p>
                                  <p className="font-medium text-white">{req.firm_name}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400">Quantity</p>
                                  <p className="font-bold text-xl text-white">{req.quantity_requested}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400">Earnings</p>
                                  <p className="font-bold text-green-400">{formatCurrency((req.production_charge_per_unit || 0) * req.quantity_requested)}</p>
                                </div>
                              </div>
                              {req.remarks && (
                                <div className="p-2 bg-slate-700/50 rounded text-sm text-slate-300">
                                  <span className="text-slate-400">Remarks:</span> {req.remarks}
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <Button
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleAccept(req.id)}
                                disabled={actionLoading}
                                data-testid={`accept-${req.id}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Accept Job
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* In Progress Jobs */}
                    {inProgressQueue.map((req) => (
                      <Card key={req.id} className="bg-purple-900/20 border-purple-700">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-mono text-cyan-400">{req.request_number}</span>
                                <Badge className={STATUS_COLORS[req.status]}>{STATUS_LABELS[req.status]}</Badge>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                                <div>
                                  <p className="text-xs text-slate-400">Product</p>
                                  <p className="font-medium text-white">{req.master_sku_name}</p>
                                  <p className="text-xs text-slate-400">{req.master_sku_code}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400">Firm</p>
                                  <p className="font-medium text-white">{req.firm_name}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400">Quantity</p>
                                  <p className="font-bold text-xl text-white">{req.quantity_requested}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400">Earnings</p>
                                  <p className="font-bold text-green-400">{formatCurrency((req.production_charge_per_unit || 0) * req.quantity_requested)}</p>
                                </div>
                              </div>
                            </div>
                            <div className="ml-4 flex flex-col gap-2">
                              {req.status === 'accepted' && (
                                <Button
                                  className="bg-purple-600 hover:bg-purple-700"
                                  onClick={() => handleStart(req.id)}
                                  disabled={actionLoading}
                                  data-testid={`start-${req.id}`}
                                >
                                  <Play className="w-4 h-4 mr-2" />
                                  Start Production
                                </Button>
                              )}
                              {req.status === 'in_progress' && (
                                <Button
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => openCompleteDialog(req)}
                                  disabled={actionLoading}
                                  data-testid={`complete-${req.id}`}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Complete & Enter Serials
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Completed History Tab */}
              <TabsContent value="history" className="mt-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Request #</TableHead>
                      <TableHead className="text-slate-300">Product</TableHead>
                      <TableHead className="text-slate-300">Qty</TableHead>
                      <TableHead className="text-slate-300">Earnings</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300">Completed</TableHead>
                      <TableHead className="text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedQueue.map((req) => (
                      <TableRow key={req.id} className="border-slate-700">
                        <TableCell className="font-mono text-cyan-400">{req.request_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{req.master_sku_name}</p>
                            <p className="text-xs text-slate-400">{req.firm_name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold">{req.quantity_produced}</TableCell>
                        <TableCell className="text-green-400 font-medium">
                          {formatCurrency((req.production_charge_per_unit || 0) * req.quantity_produced)}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[req.status]}>{STATUS_LABELS[req.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(req.completed_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => openViewDialog(req)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {completedQueue.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                          No completed production jobs
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Earnings Tab */}
              <TabsContent value="earnings" className="mt-0">
                <div className="mb-4 p-4 bg-slate-700/50 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-slate-400">Total Earned</p>
                      <p className="text-xl font-bold text-white">{formatCurrency(payables.summary?.total_payable)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Received</p>
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
                      <TableHead className="text-slate-300">Production</TableHead>
                      <TableHead className="text-slate-300">Product</TableHead>
                      <TableHead className="text-slate-300">Qty</TableHead>
                      <TableHead className="text-slate-300">Rate</TableHead>
                      <TableHead className="text-slate-300">Total</TableHead>
                      <TableHead className="text-slate-300">Received</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payables.payables?.map((pay) => (
                      <TableRow key={pay.id} className="border-slate-700">
                        <TableCell className="font-mono text-xs text-cyan-400">{pay.production_request_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{pay.master_sku_name}</p>
                            <p className="text-xs text-slate-400">{pay.firm_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>{pay.quantity_produced}</TableCell>
                        <TableCell>{formatCurrency(pay.rate_per_unit)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(pay.total_payable)}</TableCell>
                        <TableCell className="text-green-400">{formatCurrency(pay.amount_paid)}</TableCell>
                        <TableCell>
                          <Badge className={
                            pay.status === 'paid' ? 'bg-green-600' :
                            pay.status === 'part_paid' ? 'bg-yellow-600' : 'bg-red-600'
                          }>
                            {pay.status === 'paid' ? 'Paid' : pay.status === 'part_paid' ? 'Partial' : 'Pending'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!payables.payables || payables.payables.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                          No earnings records yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Complete Production Dialog */}
        <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Complete Production - Enter Serial Numbers</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="font-mono text-cyan-400">{selectedRequest.request_number}</p>
                  <p className="font-medium">{selectedRequest.master_sku_name} ({selectedRequest.master_sku_code})</p>
                  <p className="text-sm text-slate-400">Quantity: {selectedRequest.quantity_requested} units</p>
                </div>

                <div>
                  <Label className="text-slate-300 mb-2 block">Serial Numbers ({serialNumbers.length} required)</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {serialNumbers.map((sn, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <span className="text-slate-400 w-8">{idx + 1}.</span>
                        <Input
                          value={sn.serial_number}
                          onChange={(e) => updateSerial(idx, 'serial_number', e.target.value)}
                          placeholder="Enter serial number"
                          className="bg-slate-700 border-slate-600 text-white font-mono flex-1"
                          data-testid={`serial-${idx}`}
                        />
                        <Input
                          value={sn.notes}
                          onChange={(e) => updateSerial(idx, 'notes', e.target.value)}
                          placeholder="Notes (optional)"
                          className="bg-slate-700 border-slate-600 text-white w-40"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-slate-300">Completion Notes</Label>
                  <Textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Any notes about this production batch..."
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    rows={2}
                  />
                </div>

                <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg">
                  <p className="text-sm text-green-300">
                    Earnings for this job: <span className="font-bold">{formatCurrency((selectedRequest.production_charge_per_unit || 0) * selectedRequest.quantity_requested)}</span>
                  </p>
                </div>

                <DialogFooter>
                  <Button variant="ghost" onClick={() => setCompleteDialogOpen(false)} className="text-slate-300">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Completion'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* View Details Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Production Details</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="font-mono text-cyan-400">{selectedRequest.request_number}</p>
                  <p className="font-medium">{selectedRequest.master_sku_name}</p>
                  <Badge className={STATUS_COLORS[selectedRequest.status]}>{STATUS_LABELS[selectedRequest.status]}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Firm</p>
                    <p>{selectedRequest.firm_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Quantity</p>
                    <p className="font-bold">{selectedRequest.quantity_produced}</p>
                  </div>
                </div>

                {selectedRequest.serial_numbers?.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Serial Numbers</p>
                    <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                      {selectedRequest.serial_numbers.map((sn, idx) => (
                        <div key={idx} className="p-1 bg-slate-700 rounded font-mono text-xs">
                          {sn.serial_number}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-sm space-y-1">
                  <p><span className="text-slate-400">Completed:</span> {formatDate(selectedRequest.completed_at)}</p>
                  {selectedRequest.received_at && (
                    <p><span className="text-slate-400">Received by Accountant:</span> {formatDate(selectedRequest.received_at)}</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

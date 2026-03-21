import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Loader2, Wrench, Clock, AlertTriangle, CheckCircle,
  Package, Play, Check, Timer, Eye, UserPlus, FileText,
  MessageSquare, User, Phone, Mail, MapPin
} from 'lucide-react';

const DEVICE_TYPES = ['Inverter', 'Battery', 'Stabilizer', 'Others'];

export default function TechnicianDashboard() {
  const { token, user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [myRepairs, setMyRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('queue');
  
  // Dialog states
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Complete repair form
  const [repairForm, setRepairForm] = useState({
    repair_notes: '',
    board_serial_number: '',
    device_serial_number: ''
  });
  
  // Walk-in customer form
  const [walkinForm, setWalkinForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    device_type: '',
    issue_description: '',
    serial_number: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [queueRes, myRepairsRes] = await Promise.all([
        axios.get(`${API}/technician/queue`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/technician/my-repairs`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setQueue(queueRes.data);
      setMyRepairs(myRepairsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const startRepair = async (ticketId) => {
    try {
      await axios.post(`${API}/tickets/${ticketId}/start-repair`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Repair started');
      fetchData();
    } catch (error) {
      toast.error('Failed to start repair');
    }
  };

  const handleCompleteRepair = async () => {
    if (!repairForm.board_serial_number || !repairForm.device_serial_number) {
      toast.error('Board serial number and device serial number are required');
      return;
    }
    
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('repair_notes', repairForm.repair_notes || 'Repair completed successfully');
      formData.append('board_serial_number', repairForm.board_serial_number);
      formData.append('device_serial_number', repairForm.device_serial_number);
      
      await axios.post(`${API}/tickets/${selectedTicket.id}/complete-repair`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(selectedTicket.is_walkin 
        ? 'Repair completed! Ticket sent to dispatcher (skipped accountant)'
        : 'Repair marked as completed');
      setCompleteOpen(false);
      setRepairForm({ repair_notes: '', board_serial_number: '', device_serial_number: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete repair');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateWalkin = async () => {
    if (!walkinForm.customer_name || !walkinForm.customer_phone || !walkinForm.device_type || !walkinForm.issue_description) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setActionLoading(true);
    try {
      const formData = new FormData();
      Object.entries(walkinForm).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });
      
      const res = await axios.post(`${API}/technician/walkin-ticket`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Walk-in ticket created: ${res.data.ticket_number}`);
      setWalkinOpen(false);
      setWalkinForm({
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        device_type: '',
        issue_description: '',
        serial_number: '',
        address: '',
        city: '',
        state: '',
        pincode: ''
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create walk-in ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN');
  };

  const openDetails = (ticket) => {
    setSelectedTicket(ticket);
    setDetailsOpen(true);
  };

  const openCompleteDialog = (ticket) => {
    setSelectedTicket(ticket);
    setRepairForm({ repair_notes: '', board_serial_number: '', device_serial_number: '' });
    setCompleteOpen(true);
  };

  if (loading) {
    return (
      <DashboardLayout title="Technician Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      </DashboardLayout>
    );
  }

  const awaitingRepair = queue.filter(t => t.status === 'received_at_factory');
  const inProgress = queue.filter(t => t.status === 'in_repair');

  return (
    <DashboardLayout title="Technician Dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Repair Workshop</h2>
          <p className="text-slate-400">
            Hardware repairs, test results and <span className="text-yellow-400">72-hour SLA</span> management.
          </p>
        </div>
        <Button 
          className="bg-green-600 hover:bg-green-700"
          onClick={() => setWalkinOpen(true)}
          data-testid="walkin-btn"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Walk-in Customer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-600/20 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Awaiting Repair</p>
                <p className="text-xl font-bold text-white">{awaitingRepair.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-600/20 rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">In Progress</p>
                <p className="text-xl font-bold text-white">{inProgress.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">My Completed</p>
                <p className="text-xl font-bold text-white">
                  {myRepairs.filter(t => t.status === 'repair_completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Walk-ins</p>
                <p className="text-xl font-bold text-white">
                  {queue.filter(t => t.is_walkin).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">SLA Breached</p>
                <p className="text-xl font-bold text-white">
                  {queue.filter(t => t.repair_sla_breached).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Repair Queue */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-yellow-400" />
            Repair Queue
            <span className="text-sm font-normal text-slate-400 ml-2">(72-hour SLA from receipt)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {queue.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p>No items in repair queue</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left p-4 font-medium">Ticket</th>
                    <th className="text-left p-4 font-medium">Customer</th>
                    <th className="text-left p-4 font-medium">Product</th>
                    <th className="text-left p-4 font-medium">Notes</th>
                    <th className="text-left p-4 font-medium">72hr SLA</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-4">
                        <p className="font-mono text-cyan-400">{ticket.ticket_number}</p>
                        {ticket.is_walkin ? (
                          <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded mt-1 inline-block">
                            Walk-in
                          </span>
                        ) : (
                          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded mt-1 inline-block">
                            CRM
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <p className="text-white">{ticket.customer_name}</p>
                        <p className="text-slate-500 text-xs">{ticket.customer_phone}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-white">{ticket.product_name || ticket.device_type}</p>
                        <p className="text-slate-500 text-xs">S/N: {ticket.serial_number || '-'}</p>
                      </td>
                      <td className="p-4">
                        {ticket.all_notes && ticket.all_notes.length > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                            onClick={() => openDetails(ticket)}
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            {ticket.all_notes.length} Notes
                          </Button>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className={`flex items-center gap-2 ${ticket.repair_sla_breached ? 'text-red-400' : 'text-green-400'}`}>
                          <Timer className="w-4 h-4" />
                          <span className="font-mono">
                            {ticket.repair_hours_remaining}h
                          </span>
                        </div>
                        {ticket.repair_sla_breached && (
                          <span className="text-xs text-red-400 flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            BREACHED
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          ticket.status === 'in_repair' ? 'bg-cyan-600' : 'bg-yellow-600'
                        } text-white`}>
                          {ticket.status === 'in_repair' ? 'In Repair' : 'Awaiting'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="border-slate-600"
                            onClick={() => openDetails(ticket)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {ticket.status === 'received_at_factory' ? (
                            <Button 
                              size="sm" 
                              className="bg-cyan-600 hover:bg-cyan-700"
                              onClick={() => startRepair(ticket.id)}
                              data-testid={`start-repair-${ticket.id}`}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Start
                            </Button>
                          ) : ticket.status === 'in_repair' ? (
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => openCompleteDialog(ticket)}
                              data-testid={`complete-repair-${ticket.id}`}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Complete
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Repairs */}
      {myRepairs.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              My Recent Repairs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myRepairs.slice(0, 5).map((ticket) => (
                <div key={ticket.id} className="p-4 bg-slate-900 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-cyan-400 font-mono">{ticket.ticket_number}</p>
                      {ticket.is_walkin ? (
                        <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded">Walk-in</span>
                      ) : (
                        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">CRM</span>
                      )}
                    </div>
                    <p className="text-white">{ticket.product_name || ticket.device_type}</p>
                    <p className="text-slate-500 text-sm mt-1">{ticket.repair_notes}</p>
                    {ticket.board_serial_number && (
                      <p className="text-slate-400 text-xs mt-1">
                        Board: {ticket.board_serial_number} | Device: {ticket.device_serial_number}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs ${
                      ticket.status === 'repair_completed' ? 'bg-green-600' : 
                      ticket.status === 'ready_for_dispatch' ? 'bg-blue-600' : 'bg-cyan-600'
                    } text-white`}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                    <p className="text-slate-500 text-xs mt-2">
                      Repaired: {formatDate(ticket.repaired_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ticket Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ticket Details - {selectedTicket?.ticket_number}</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Customer Info */}
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Name:</strong> {selectedTicket.customer_name}</p>
                  <p><strong>Phone:</strong> {selectedTicket.customer_phone}</p>
                  <p><strong>Device:</strong> {selectedTicket.device_type}</p>
                  <p><strong>Serial:</strong> {selectedTicket.serial_number || '-'}</p>
                </div>
              </div>

              {/* All Notes Section */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Notes & Information
                </h4>
                
                {selectedTicket.all_notes && selectedTicket.all_notes.length > 0 ? (
                  selectedTicket.all_notes.map((note, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg border ${
                        note.source === 'Customer' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' :
                        note.source === 'Call Support' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                        'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          note.source === 'Customer' ? 'bg-blue-600 text-white' :
                          note.source === 'Call Support' ? 'bg-green-600 text-white' :
                          'bg-purple-600 text-white'
                        }`}>
                          {note.source}
                        </span>
                        <span className="text-xs text-slate-500 capitalize">{note.type}</span>
                        {note.timestamp && (
                          <span className="text-xs text-slate-400 ml-auto">
                            {formatDate(note.timestamp)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{note.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No notes available</p>
                )}
              </div>

              {/* Ticket Details */}
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Status Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Status:</strong> {selectedTicket.status.replace(/_/g, ' ')}</p>
                  <p><strong>Received:</strong> {formatDate(selectedTicket.received_at)}</p>
                  <p><strong>SLA Hours:</strong> {selectedTicket.repair_hours_remaining}h remaining</p>
                  <p><strong>Source:</strong> {selectedTicket.is_walkin ? 'Walk-in' : 'CRM'}</p>
                </div>
              </div>

              {/* Invoice Document */}
              {selectedTicket.invoice_file && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Customer Invoice
                  </h4>
                  <a 
                    href={`${API.replace('/api', '')}${selectedTicket.invoice_file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    <FileText className="w-4 h-4" />
                    View Invoice Document
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Complete Repair Dialog */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Repair - {selectedTicket?.ticket_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTicket?.is_walkin && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-3 rounded-lg">
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  <strong>Walk-in Ticket:</strong> After completion, this ticket will go directly to Dispatcher (skipping Accountant).
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Board Serial Number *</Label>
              <Input
                placeholder="Enter board serial number"
                value={repairForm.board_serial_number}
                onChange={(e) => setRepairForm({...repairForm, board_serial_number: e.target.value})}
                data-testid="board-serial-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Inverter/Battery Serial Number *</Label>
              <Input
                placeholder="Enter device serial number"
                value={repairForm.device_serial_number}
                onChange={(e) => setRepairForm({...repairForm, device_serial_number: e.target.value})}
                data-testid="device-serial-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Repair Notes</Label>
              <Textarea
                placeholder="Describe the repair work done..."
                value={repairForm.repair_notes}
                onChange={(e) => setRepairForm({...repairForm, repair_notes: e.target.value})}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleCompleteRepair}
              disabled={actionLoading}
              data-testid="submit-repair-btn"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Complete Repair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Walk-in Customer Dialog */}
      <Dialog open={walkinOpen} onOpenChange={setWalkinOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register Walk-in Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input
                  placeholder="Full name"
                  value={walkinForm.customer_name}
                  onChange={(e) => setWalkinForm({...walkinForm, customer_name: e.target.value})}
                  data-testid="walkin-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input
                  placeholder="10-digit mobile"
                  value={walkinForm.customer_phone}
                  onChange={(e) => setWalkinForm({...walkinForm, customer_phone: e.target.value})}
                  data-testid="walkin-phone"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Email (Optional)</Label>
              <Input
                type="email"
                placeholder="customer@email.com"
                value={walkinForm.customer_email}
                onChange={(e) => setWalkinForm({...walkinForm, customer_email: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Device Type *</Label>
                <Select 
                  value={walkinForm.device_type} 
                  onValueChange={(v) => setWalkinForm({...walkinForm, device_type: v})}
                >
                  <SelectTrigger data-testid="walkin-device">
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input
                  placeholder="Device serial"
                  value={walkinForm.serial_number}
                  onChange={(e) => setWalkinForm({...walkinForm, serial_number: e.target.value})}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Issue Description *</Label>
              <Textarea
                placeholder="Describe the problem..."
                value={walkinForm.issue_description}
                onChange={(e) => setWalkinForm({...walkinForm, issue_description: e.target.value})}
                rows={3}
                data-testid="walkin-issue"
              />
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Address (for return shipping)
              </h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    placeholder="Street address"
                    value={walkinForm.address}
                    onChange={(e) => setWalkinForm({...walkinForm, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      placeholder="City"
                      value={walkinForm.city}
                      onChange={(e) => setWalkinForm({...walkinForm, city: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      placeholder="State"
                      value={walkinForm.state}
                      onChange={(e) => setWalkinForm({...walkinForm, state: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pincode</Label>
                    <Input
                      placeholder="Pincode"
                      value={walkinForm.pincode}
                      onChange={(e) => setWalkinForm({...walkinForm, pincode: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalkinOpen(false)}>Cancel</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleCreateWalkin}
              disabled={actionLoading}
              data-testid="submit-walkin-btn"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Create Walk-in Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  AlertTriangle, Users, Clock, CheckCircle, Loader2, Eye, 
  Wrench, Package, Phone, ArrowUpCircle
} from 'lucide-react';

export default function SupervisorDashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Action form state
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedSku, setSelectedSku] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, queueRes, skusRes] = await Promise.all([
        axios.get(`${API}/supervisor/stats`, { headers }),
        axios.get(`${API}/supervisor/queue`, { headers }),
        axios.get(`${API}/admin/skus`, { headers }).catch(() => ({ data: [] }))
      ]);
      setStats(statsRes.data);
      setQueue(queueRes.data);
      setSkus(skusRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const viewTicketDetails = async (ticketId) => {
    try {
      const response = await axios.get(`${API}/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedTicket(response.data);
      setDetailsOpen(true);
    } catch (error) {
      toast.error('Failed to load ticket');
    }
  };

  const openActionDialog = (ticket) => {
    setSelectedTicket(ticket);
    setAction('');
    setNotes('');
    setSelectedSku('');
    setActionOpen(true);
  };

  const handleSupervisorAction = async () => {
    if (!action) {
      toast.error('Please select an action');
      return;
    }
    if (notes.length < 100) {
      toast.error('Notes must be at least 100 characters');
      return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', action);
      formData.append('notes', notes);
      if (selectedSku) formData.append('sku', selectedSku);

      await axios.post(`${API}/tickets/${selectedTicket.id}/supervisor-action`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Action completed successfully');
      setActionOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to perform action');
    } finally {
      setActionLoading(false);
    }
  };

  const formatTimeRemaining = (hours) => {
    if (hours <= 0) return 'OVERDUE';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${Math.round(hours)}h`;
  };

  const urgentTickets = queue.filter(t => t.is_urgent || t.status === 'customer_escalated');
  const escalatedTickets = queue.filter(t => t.status === 'escalated_to_supervisor' || t.status === 'supervisor_followup');

  if (loading) {
    return (
      <DashboardLayout title="Supervisor Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Supervisor Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6" data-testid="supervisor-stats">
        <StatCard 
          title="Escalated Tickets" 
          value={stats?.escalated_tickets || 0} 
          icon={ArrowUpCircle}
          color="blue" 
        />
        <StatCard 
          title="Customer Escalated" 
          value={stats?.customer_escalated || 0} 
          icon={AlertTriangle}
          color="red"
        />
        <StatCard 
          title="Urgent (SLA Breach)" 
          value={stats?.urgent_tickets || 0} 
          icon={Clock}
          color="orange"
        />
        <StatCard 
          title="Resolved Today" 
          value={stats?.resolved_today || 0} 
          icon={CheckCircle}
          color="green"
        />
      </div>

      {/* Urgent Tickets - Customer Escalated */}
      {urgentTickets.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="font-['Barlow_Condensed'] flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              URGENT - Customer Escalated ({urgentTickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Escalated At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {urgentTickets.map((ticket) => (
                  <TableRow key={ticket.id} className="bg-red-50 hover:bg-red-100">
                    <TableCell className="font-mono text-sm font-medium text-red-800">
                      {ticket.ticket_number}
                    </TableCell>
                    <TableCell className="font-medium">{ticket.customer_name}</TableCell>
                    <TableCell className="font-mono text-sm">{ticket.customer_phone}</TableCell>
                    <TableCell className="max-w-xs truncate">{ticket.issue_description}</TableCell>
                    <TableCell className="text-sm">
                      {ticket.customer_escalated_at ? new Date(ticket.customer_escalated_at).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => viewTicketDetails(ticket.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => openActionDialog(ticket)}
                          data-testid={`action-${ticket.id}`}
                        >
                          Take Action
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Escalated Tickets Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="font-['Barlow_Condensed'] flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5 text-blue-600" />
            Escalated by Support ({escalatedTickets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {escalatedTickets.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p>No escalated tickets!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Escalated By</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escalatedTickets.map((ticket) => (
                  <TableRow 
                    key={ticket.id} 
                    className={`data-row ${ticket.supervisor_sla_breached ? 'bg-orange-50' : ''}`}
                  >
                    <TableCell className="font-mono text-sm font-medium">
                      {ticket.ticket_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{ticket.customer_name}</p>
                        <p className="text-xs text-slate-500">{ticket.customer_phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>{ticket.device_type}</TableCell>
                    <TableCell className="max-w-xs truncate">{ticket.issue_description}</TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium">{ticket.escalated_by_name || '-'}</p>
                      <p className="text-xs text-slate-500">
                        {ticket.escalated_at ? new Date(ticket.escalated_at).toLocaleString() : ''}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        ticket.supervisor_sla_breached 
                          ? 'bg-red-100 text-red-700' 
                          : ticket.supervisor_hours_remaining < 12 
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                      }`}>
                        {formatTimeRemaining(ticket.supervisor_hours_remaining)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => viewTicketDetails(ticket.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => openActionDialog(ticket)}
                          data-testid={`action-${ticket.id}`}
                        >
                          Take Action
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ticket Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket Details - {selectedTicket?.ticket_number}</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-slate-500">Status</p><StatusBadge status={selectedTicket.status} /></div>
                <div><p className="text-sm text-slate-500">Device</p><p className="font-medium">{selectedTicket.device_type}</p></div>
                <div><p className="text-sm text-slate-500">Customer</p><p className="font-medium">{selectedTicket.customer_name}</p></div>
                <div><p className="text-sm text-slate-500">Phone</p><p className="font-mono">{selectedTicket.customer_phone}</p></div>
                <div><p className="text-sm text-slate-500">Email</p><p className="font-mono text-sm">{selectedTicket.customer_email}</p></div>
                <div><p className="text-sm text-slate-500">City</p><p className="font-medium">{selectedTicket.customer_city || '-'}</p></div>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Issue</p>
                <div className="bg-slate-50 p-3 rounded-lg">{selectedTicket.issue_description}</div>
              </div>
              {selectedTicket.escalation_notes && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Escalation Notes (from Support)</p>
                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">{selectedTicket.escalation_notes}</div>
                </div>
              )}
              {selectedTicket.agent_notes && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Agent Notes</p>
                  <div className="bg-blue-50 p-3 rounded-lg">{selectedTicket.agent_notes}</div>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-500 mb-2">History</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedTicket.history?.map((entry, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-600 shrink-0" />
                      <div>
                        <p>{entry.action}</p>
                        <p className="text-xs text-slate-500">{entry.by} • {new Date(entry.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Supervisor Action Dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Take Action - {selectedTicket?.ticket_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm text-slate-500">Customer: {selectedTicket?.customer_name}</p>
              <p className="text-sm font-medium mt-1">{selectedTicket?.issue_description}</p>
            </div>

            {selectedTicket?.escalation_notes && (
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                <p className="text-xs text-orange-600 font-medium mb-1">Agent's Escalation Notes:</p>
                <p className="text-sm">{selectedTicket.escalation_notes}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Action *</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger data-testid="action-select">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resolve">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-green-600" />
                      Resolve on Call
                    </div>
                  </SelectItem>
                  <SelectItem value="spare_dispatch">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      Send Spare Part
                    </div>
                  </SelectItem>
                  <SelectItem value="reverse_pickup">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-orange-600" />
                      Arrange Reverse Pickup
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(action === 'spare_dispatch') && skus.length > 0 && (
              <div className="space-y-2">
                <Label>Select SKU</Label>
                <Select value={selectedSku} onValueChange={setSelectedSku}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select spare part" />
                  </SelectTrigger>
                  <SelectContent>
                    {skus.filter(s => s.active && s.stock_quantity > 0).map(sku => (
                      <SelectItem key={sku.id} value={sku.sku_code}>
                        {sku.model_name} ({sku.sku_code}) - Stock: {sku.stock_quantity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes * (min 100 characters)</Label>
              <Textarea 
                placeholder="Enter detailed notes about your decision and next steps..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                data-testid="notes-input"
              />
              <p className={`text-xs ${notes.length < 100 ? 'text-red-500' : 'text-green-600'}`}>
                {notes.length}/100 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700" 
              onClick={handleSupervisorAction}
              disabled={actionLoading || notes.length < 100 || !action}
              data-testid="confirm-action-btn"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

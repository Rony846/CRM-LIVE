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
import { Wrench, Clock, CheckCircle, Loader2, Eye, AlertTriangle } from 'lucide-react';

export default function ServiceAgentDashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [allTickets, setAllTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionData, setActionData] = useState({ status: '', diagnosis: '', agent_notes: '' });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, ticketsRes] = await Promise.all([
        axios.get(`${API}/stats`, { headers }),
        axios.get(`${API}/tickets`, { headers })
      ]);
      setStats(statsRes.data);
      // Filter assigned tickets
      const assigned = ticketsRes.data.filter(t => t.assigned_to === user.id);
      setTickets(assigned);
      setAllTickets(ticketsRes.data);
    } catch (error) {
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
    setActionData({ status: '', diagnosis: '', agent_notes: '' });
    setActionOpen(true);
  };

  const handleUpdateTicket = async () => {
    setActionLoading(true);
    try {
      const updates = {};
      if (actionData.status) updates.status = actionData.status;
      if (actionData.diagnosis) updates.diagnosis = actionData.diagnosis;
      if (actionData.agent_notes) updates.agent_notes = actionData.agent_notes;

      await axios.patch(`${API}/tickets/${selectedTicket.id}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Ticket updated');
      setActionOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRouteToHardware = async () => {
    if (!actionData.agent_notes) {
      toast.error('Please add notes for the accountant');
      return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('agent_notes', actionData.agent_notes);

      await axios.post(`${API}/tickets/${selectedTicket.id}/route-to-hardware`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Ticket routed to hardware service');
      setActionOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to route ticket');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Service Agent Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Service Agent Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6" data-testid="service-stats">
        <StatCard title="Assigned Tickets" value={stats?.assigned_tickets || 0} icon={Wrench} />
        <StatCard title="Pending Service" value={stats?.pending_service || 0} icon={Clock} />
        <StatCard title="Completed" value={(stats?.assigned_tickets || 0) - (stats?.pending_service || 0)} icon={CheckCircle} />
      </div>

      {/* Assigned Tickets */}
      <Card>
        <CardHeader>
          <CardTitle className="font-['Barlow_Condensed']">My Assigned Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Wrench className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No tickets assigned to you</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id} className="data-row">
                    <TableCell className="font-mono text-sm font-medium">{ticket.ticket_number}</TableCell>
                    <TableCell>{ticket.customer_name}</TableCell>
                    <TableCell>{ticket.device_type}</TableCell>
                    <TableCell className="max-w-xs truncate">{ticket.issue_description}</TableCell>
                    <TableCell><StatusBadge status={ticket.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => viewTicketDetails(ticket.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openActionDialog(ticket)}
                        >
                          Update
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
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Issue</p>
                <div className="bg-slate-50 p-3 rounded-lg">{selectedTicket.issue_description}</div>
              </div>
              {selectedTicket.diagnosis && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Diagnosis</p>
                  <div className="bg-blue-50 p-3 rounded-lg">{selectedTicket.diagnosis}</div>
                </div>
              )}
              {selectedTicket.agent_notes && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Agent Notes</p>
                  <div className="bg-orange-50 p-3 rounded-lg">{selectedTicket.agent_notes}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Ticket - {selectedTicket?.ticket_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm font-medium">{selectedTicket?.customer_name}</p>
              <p className="text-sm text-slate-600">{selectedTicket?.issue_description}</p>
            </div>

            <div className="space-y-2">
              <Label>Update Status</Label>
              <Select value={actionData.status} onValueChange={(v) => setActionData({...actionData, status: v})}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="diagnosed">Diagnosed</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service Notes</Label>
              <Textarea 
                placeholder="Add service notes..."
                value={actionData.diagnosis}
                onChange={(e) => setActionData({...actionData, diagnosis: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes for Accountant (if hardware needed)</Label>
              <Textarea 
                placeholder="e.g., Battery faulty. Send replacement."
                value={actionData.agent_notes}
                onChange={(e) => setActionData({...actionData, agent_notes: e.target.value})}
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-orange-600 mb-3">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Need Hardware Support?</span>
              </div>
              <Button 
                variant="outline" 
                className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                onClick={handleRouteToHardware}
                disabled={actionLoading || !actionData.agent_notes}
              >
                <Wrench className="w-4 h-4 mr-2" />
                Request Hardware/Part
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700" 
              onClick={handleUpdateTicket}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

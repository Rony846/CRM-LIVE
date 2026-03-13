import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Eye, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerTickets() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [escalateLoading, setEscalateLoading] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [token]);

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API}/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(response.data);
    } catch (error) {
      toast.error('Failed to load tickets');
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
      toast.error('Failed to load ticket details');
    }
  };

  const handleCustomerEscalate = async (ticketId) => {
    setEscalateLoading(true);
    try {
      await axios.post(`${API}/tickets/${ticketId}/customer-escalate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Ticket escalated for immediate attention');
      fetchTickets();
      setDetailsOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Cannot escalate yet');
    } finally {
      setEscalateLoading(false);
    }
  };

  const canEscalate = (ticket) => {
    if (!ticket) return false;
    // Can escalate if ticket is open and last update was 48+ hours ago
    const closedStatuses = ['closed', 'closed_by_agent', 'resolved_on_call', 'delivered', 'customer_escalated'];
    if (closedStatuses.includes(ticket.status)) return false;
    const lastUpdate = new Date(ticket.updated_at);
    const hoursSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    return hoursSince >= 48;
  };

  if (loading) {
    return (
      <DashboardLayout title="My Tickets">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Tickets">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-500">View and track all your support tickets</p>
        </div>
        <Link to="/customer/tickets/new">
          <Button className="bg-blue-600 hover:bg-blue-700" data-testid="new-ticket-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {tickets.length === 0 ? (
            <div className="text-center py-16">
              <Clock className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">No tickets yet</h3>
              <p className="text-slate-500 mb-4">Create your first support ticket to get help</p>
              <Link to="/customer/tickets/new">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Ticket
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Device Type</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id} className="data-row" data-testid={`ticket-row-${ticket.id}`}>
                    <TableCell className="font-mono text-sm font-medium">
                      {ticket.ticket_number}
                    </TableCell>
                    <TableCell>{ticket.device_type}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {ticket.issue_description}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewTicketDetails(ticket.id)}
                        data-testid={`view-ticket-${ticket.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
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
            <DialogTitle className="font-['Barlow_Condensed'] text-xl">
              Ticket Details - {selectedTicket?.ticket_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="space-y-6">
              {/* Status & Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <StatusBadge status={selectedTicket.status} className="mt-1" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Device Type</p>
                  <p className="font-medium">{selectedTicket.device_type}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Created</p>
                  <p className="font-medium">{new Date(selectedTicket.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Last Updated</p>
                  <p className="font-medium">{new Date(selectedTicket.updated_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Issue Description */}
              <div>
                <p className="text-sm text-slate-500 mb-2">Issue Description</p>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p>{selectedTicket.issue_description}</p>
                </div>
              </div>

              {/* Diagnosis */}
              {selectedTicket.diagnosis && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Diagnosis</p>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <p>{selectedTicket.diagnosis}</p>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <p className="text-sm text-slate-500 mb-3">Ticket History</p>
                <div className="space-y-3">
                  {selectedTicket.history?.map((entry, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="w-2 h-2 mt-2 rounded-full bg-blue-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{entry.action}</p>
                        <p className="text-xs text-slate-500">
                          {entry.by} ({entry.by_role}) • {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Escalate Button */}
              {canEscalate(selectedTicket) && (
                <div className="border-t pt-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-orange-700 mb-2">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-medium">No update for 48+ hours?</span>
                    </div>
                    <p className="text-sm text-orange-600 mb-3">
                      If you haven't received any update, you can escalate this ticket for immediate attention.
                    </p>
                    <Button 
                      className="bg-orange-600 hover:bg-orange-700 w-full"
                      onClick={() => handleCustomerEscalate(selectedTicket.id)}
                      disabled={escalateLoading}
                      data-testid="customer-escalate-btn"
                    >
                      {escalateLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                      Escalate Ticket
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

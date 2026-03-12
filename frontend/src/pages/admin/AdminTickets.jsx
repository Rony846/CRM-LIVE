import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Ticket, Eye, Loader2 } from 'lucide-react';

export default function AdminTickets() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  const filteredTickets = statusFilter === 'all' 
    ? tickets 
    : tickets.filter(t => t.status === statusFilter);

  if (loading) {
    return (
      <DashboardLayout title="All Tickets">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="All Tickets">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-['Barlow_Condensed'] flex items-center gap-2">
              <Ticket className="w-5 h-5 text-blue-600" />
              All Tickets ({filteredTickets.length})
            </CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="diagnosed">Diagnosed</SelectItem>
                <SelectItem value="hardware_required">Hardware Required</SelectItem>
                <SelectItem value="pending_pickup">Pending Pickup</SelectItem>
                <SelectItem value="pending_dispatch">Pending Dispatch</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Ticket className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No tickets found</p>
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
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id} className="data-row">
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
                    <TableCell><StatusBadge status={ticket.status} /></TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewTicketDetails(ticket.id)}
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
                  <p className="text-sm text-slate-500">Customer</p>
                  <p className="font-medium">{selectedTicket.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Phone</p>
                  <p className="font-mono">{selectedTicket.customer_phone}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p>{selectedTicket.customer_email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Issue Type</p>
                  <p className="font-medium capitalize">{selectedTicket.issue_type || 'Not determined'}</p>
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

              {/* Agent Notes */}
              {selectedTicket.agent_notes && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Agent Notes</p>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                    <p>{selectedTicket.agent_notes}</p>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

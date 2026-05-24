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
import { Plus, Eye, Clock, Loader2, AlertTriangle, Download, Star } from 'lucide-react';
import { toast } from 'sonner';
import FeedbackSurvey from '@/components/feedback/FeedbackSurvey';

const badgeCls = 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap';

export default function CustomerTickets() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTicket, setFeedbackTicket] = useState(null);
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

  const canProvideFeedback = (ticket) => {
    if (!ticket) return false;
    // Can provide feedback if ticket is resolved/closed and no feedback given yet
    const closedStatuses = ['closed', 'closed_by_agent', 'resolved_on_call', 'delivered'];
    return closedStatuses.includes(ticket.status) && !ticket.feedback_submitted;
  };

  const openFeedbackDialog = (ticket) => {
    setFeedbackTicket(ticket);
    setFeedbackOpen(true);
  };

  if (loading) {
    return (
      <DashboardLayout title="My Tickets">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const thCls = 'px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground';
  const labelCls = 'font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground';

  return (
    <DashboardLayout title="My Tickets">

      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Support queue · Live
            </span>
          </div>
          <h2 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">My Tickets</h2>
          <p className="mt-1 text-sm text-muted-foreground">View and track all your support tickets</p>
        </div>
        <Link to="/customer/tickets/new">
          <Button className="bg-primary text-primary-foreground hover:opacity-90" data-testid="new-ticket-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        </Link>
      </div>

      {/* Tickets table */}
      <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Clock className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">No tickets yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first support ticket to get help</p>
            <Link to="/customer/tickets/new" className="mt-4">
              <Button className="bg-primary text-primary-foreground hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" />
                Create Ticket
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className={thCls}>Ticket #</th>
                  <th className={thCls}>Device Type</th>
                  <th className={thCls}>Issue</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Created</th>
                  <th className={`${thCls} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="border-b border-border/50 transition-colors hover:bg-accent/40"
                    data-testid={`ticket-row-${ticket.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px] font-semibold text-foreground">{ticket.ticket_number}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground">{ticket.device_type}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-[13px] text-muted-foreground">
                      {ticket.issue_description}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => viewTicketDetails(ticket.id)}
                        className="inline-flex items-center gap-1.5 rounded bg-secondary px-2.5 py-1.5 text-[12px] font-medium text-foreground hover:bg-accent transition-colors"
                        data-testid={`view-ticket-${ticket.id}`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-popover border border-border rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold tracking-tight text-foreground">
              Ticket Details
              {selectedTicket?.ticket_number && (
                <span className="ml-2 font-mono text-[13px] font-medium text-muted-foreground">
                  · {selectedTicket.ticket_number}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-5">
              {/* Status & Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`${labelCls} mb-1`}>Status</p>
                  <StatusBadge status={selectedTicket.status} />
                </div>
                <div>
                  <p className={`${labelCls} mb-1`}>Device Type</p>
                  <p className="text-[13px] font-medium text-foreground">{selectedTicket.device_type}</p>
                </div>
                <div>
                  <p className={`${labelCls} mb-1`}>Created</p>
                  <p className="font-mono text-[12px] text-foreground">{new Date(selectedTicket.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className={`${labelCls} mb-1`}>Last Updated</p>
                  <p className="font-mono text-[12px] text-foreground">{new Date(selectedTicket.updated_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Issue Description */}
              <div>
                <p className={`${labelCls} mb-2`}>Issue Description</p>
                <div className="rounded-md bg-muted/40 border border-border/60 p-4">
                  <p className="text-[13px] text-foreground">{selectedTicket.issue_description}</p>
                </div>
              </div>

              {/* Diagnosis */}
              {selectedTicket.diagnosis && (
                <div>
                  <p className={`${labelCls} mb-2`}>Diagnosis</p>
                  <div className="rounded-md bg-primary/5 border border-primary/20 p-4">
                    <p className="text-[13px] text-foreground">{selectedTicket.diagnosis}</p>
                  </div>
                </div>
              )}

              {/* Repair Notes */}
              {selectedTicket.repair_notes && (
                <div className="rounded-md border border-emerald-500/25 bg-emerald-500/5 p-4">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-emerald-400 mb-1">Repair Completed</p>
                  <p className="text-[13px] text-foreground">{selectedTicket.repair_notes}</p>
                  {selectedTicket.repaired_at && (
                    <p className="mt-2 font-mono text-[10px] text-emerald-400/70">
                      Repaired on: {new Date(selectedTicket.repaired_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* Pickup Label */}
              {selectedTicket.pickup_label && (
                <div className="rounded-md border border-orange-500/25 bg-orange-500/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-orange-400 mb-1">Pickup Label Ready</p>
                      <p className="text-[13px] text-muted-foreground">
                        Print this label and paste it on your package for pickup.
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-1">
                        {selectedTicket.pickup_courier && <span>Courier: <strong className="text-foreground">{selectedTicket.pickup_courier}</strong></span>}
                        {selectedTicket.pickup_tracking && <span> · Tracking: <strong className="text-foreground">{selectedTicket.pickup_tracking}</strong></span>}
                      </p>
                    </div>
                    <a
                      href={`${process.env.REACT_APP_BACKEND_URL}${selectedTicket.pickup_label}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 inline-flex items-center gap-1.5 rounded bg-orange-500/15 border border-orange-500/25 px-3 py-2 text-[12px] font-medium text-orange-400 hover:bg-orange-500/25 transition-colors"
                      data-testid="download-pickup-label"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Label
                    </a>
                  </div>
                </div>
              )}

              {/* Return Tracking */}
              {selectedTicket.return_tracking && (
                <div className="rounded-md border border-sky-400/25 bg-sky-400/5 p-4">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sky-400 mb-1">Return Shipment</p>
                  <p className="text-[13px] text-muted-foreground">
                    Courier: {selectedTicket.return_courier} · Tracking: {selectedTicket.return_tracking}
                  </p>
                </div>
              )}

              {/* Timeline */}
              <div>
                <p className={`${labelCls} mb-3`}>Ticket History</p>
                <div className="space-y-3">
                  {selectedTicket.history?.map((entry, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{entry.action}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {entry.by} ({entry.by_role}) · {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Escalate */}
              {canEscalate(selectedTicket) && (
                <div className="border-t border-border pt-4">
                  <div className="rounded-md border border-orange-500/25 bg-orange-500/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-orange-400">No update for 48+ hours?</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground mb-3">
                      If you haven't received any update, you can escalate this ticket for immediate attention.
                    </p>
                    <Button
                      className="w-full bg-orange-500/15 border border-orange-500/25 text-orange-400 hover:bg-orange-500/25"
                      onClick={() => handleCustomerEscalate(selectedTicket.id)}
                      disabled={escalateLoading}
                      data-testid="customer-escalate-btn"
                    >
                      {escalateLoading
                        ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        : <AlertTriangle className="w-4 h-4 mr-2" />}
                      Escalate Ticket
                    </Button>
                  </div>
                </div>
              )}

              {/* Feedback */}
              {canProvideFeedback(selectedTicket) && (
                <div className="border-t border-border pt-4">
                  <div className="rounded-md border border-amber-400/25 bg-amber-400/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-amber-400">How was your experience?</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground mb-3">
                      Your feedback helps us improve our service. Please take a moment to rate your experience.
                    </p>
                    <Button
                      className="w-full bg-amber-400/15 border border-amber-400/25 text-amber-400 hover:bg-amber-400/25"
                      onClick={() => {
                        setDetailsOpen(false);
                        openFeedbackDialog(selectedTicket);
                      }}
                      data-testid="provide-feedback-btn"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Provide Feedback
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Feedback Survey Modal */}
      <FeedbackSurvey
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        ticketId={feedbackTicket?.id}
        ticketNumber={feedbackTicket?.ticket_number}
        onSuccess={() => {
          fetchTickets();
          setFeedbackTicket(null);
        }}
      />
    </DashboardLayout>
  );
}

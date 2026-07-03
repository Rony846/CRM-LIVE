import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Wrench, Clock, CheckCircle, Loader2, Eye, AlertTriangle } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, ticketPill } from '@/components/iron/IronKit';

const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '6px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };

const StatTile = ({ label, value, icon: Icon, tone }) => (
  <IronCard pad={0} style={{ flex: 1, minWidth: 180 }}>
    <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}`, display: 'grid', placeItems: 'center', color: tone || T.orange }}>
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div>
        <Caps size={8.5} color={T.iron400}>{label}</Caps>
        <div style={{ ...mono, fontSize: 26, fontWeight: 700, color: T.iron900, lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  </IronCard>
);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const completedCount = (stats?.assigned_tickets || 0) - (stats?.pending_service || 0);

  const H = ['Ticket #', 'Customer', 'Device', 'Issue', 'Status', 'Actions'];

  return (
    <IronShell title="Technician Dashboard" subtitle="SERVICE / ASSIGNED TICKETS" onRefresh={fetchData}>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
          <Loader2 className="animate-spin" style={{ width: 32, height: 32, color: T.orange }} />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }} data-testid="service-stats">
            <StatTile label="Assigned Tickets" value={stats?.assigned_tickets || 0} icon={Wrench} tone={T.orange} />
            <StatTile label="Pending Service" value={stats?.pending_service || 0} icon={Clock} tone={T.blue} />
            <StatTile label="Completed" value={completedCount} icon={CheckCircle} tone={T.green} />
          </div>

          {/* Assigned Tickets */}
          <IronCard pad={0}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
              <Caps size={11} color={T.iron700}>My Assigned Tickets</Caps>
            </div>
            {tickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 12px', color: T.iron500 }}>
                <Wrench size={44} style={{ margin: '0 auto 12px', color: T.iron200 }} />
                <p style={{ fontFamily: T.body, fontSize: 13 }}>No tickets assigned to you</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {H.map((h, i) => (
                      <th key={h} style={{ ...thCell, textAlign: i === H.length - 1 ? 'right' : 'left' }}>
                        <Caps size={8.5}>{h}</Caps>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => {
                    const pill = ticketPill(ticket.status);
                    return (
                      <tr key={ticket.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={{ ...tdCell, ...mono, fontWeight: 600, color: T.iron900 }}>{ticket.ticket_number}</td>
                        <td style={tdCell}>{ticket.customer_name}</td>
                        <td style={tdCell}>{ticket.device_type}</td>
                        <td style={{ ...tdCell, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.issue_description}</td>
                        <td style={tdCell}><span style={pill.style}>{pill.label}</span></td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button title="View" onClick={() => viewTicketDetails(ticket.id)} style={{ ...btnOutline, padding: '6px 8px' }}>
                              <Eye size={15} strokeWidth={1.75} />
                            </button>
                            <button onClick={() => openActionDialog(ticket)} style={btnOutline}>Update</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </IronCard>
        </>
      )}

      {/* Ticket Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket Details - {selectedTicket?.ticket_number}</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <span style={ticketPill(selectedTicket.status).style}>{ticketPill(selectedTicket.status).label}</span>
                </div>
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
    </IronShell>
  );
}

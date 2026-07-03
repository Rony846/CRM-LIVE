import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Eye, Clock, Loader2, AlertTriangle, Download, Star } from 'lucide-react';
import { toast } from 'sonner';
import FeedbackSurvey from '@/components/feedback/FeedbackSurvey';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, ticketPill, fmtDateTime } from '@/components/iron/IronKit';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const labelStyle = { fontFamily: T.headline, fontWeight: 700, fontSize: 9, letterSpacing: '.05em', textTransform: 'uppercase', color: T.iron400 };

  const newTicketBtn = (
    <Link to="/customer/tickets/new" style={{ textDecoration: 'none' }} data-testid="new-ticket-btn">
      <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
        <Plus size={15} /> New Ticket
      </button>
    </Link>
  );

  const headers = ['TICKET #', 'DEVICE TYPE', 'ISSUE', 'STATUS', 'CREATED', ''];

  return (
    <IronShell
      title="My Tickets"
      subtitle="SUPPORT QUEUE · LIVE"
      onRefresh={fetchTickets}
      headerRight={newTicketBtn}
    >
      {/* Page intro */}
      <div style={{ marginBottom: 16 }}>
        <Caps size={10} color={T.iron400} ls=".14em">Support Queue · Live</Caps>
        <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900, marginTop: 4 }}>My Tickets</div>
        <div style={{ fontSize: 12.5, color: T.iron500, marginTop: 2 }}>View and track all your support tickets</div>
      </div>

      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}>
            <Loader2 className="animate-spin" size={28} color={T.iron400} />
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <div style={{ margin: '0 auto 12px', height: 56, width: 56, borderRadius: 999, background: T.iron100, display: 'grid', placeItems: 'center' }}>
              <Clock size={26} color={T.iron400} />
            </div>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>No tickets yet</div>
            <div style={{ fontSize: 12.5, marginTop: 3, color: T.iron500 }}>Create your first support ticket to get help</div>
            <Link to="/customer/tickets/new" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 16 }}>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                <Plus size={15} /> Create Ticket
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {headers.map((h, i) => (
                    <th key={i} style={{ ...thCell, textAlign: i === headers.length - 1 ? 'right' : 'left' }}>
                      <Caps size={8.5}>{h}</Caps>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => {
                  const pill = ticketPill(ticket.status);
                  return (
                    <tr
                      key={ticket.id}
                      className="iron-row"
                      style={{ borderBottom: `1px solid ${T.iron200}` }}
                      data-testid={`ticket-row-${ticket.id}`}
                    >
                      <td style={tdCell}>
                        <span style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{ticket.ticket_number}</span>
                      </td>
                      <td style={{ ...tdCell, color: T.iron700 }}>{ticket.device_type}</td>
                      <td style={{ ...tdCell, maxWidth: 280, color: T.iron500 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                          {ticket.issue_description}
                        </div>
                      </td>
                      <td style={tdCell}>
                        <span style={pill.style}>{pill.label}</span>
                      </td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        <button
                          onClick={() => viewTicketDetails(ticket.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}
                          data-testid={`view-ticket-${ticket.id}`}
                        >
                          <Eye size={13} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </IronCard>

      {/* Ticket Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 17, color: T.iron900 }}>
              Ticket Details
              {selectedTicket?.ticket_number && (
                <span style={{ ...mono, marginLeft: 8, fontSize: 13, fontWeight: 500, color: T.iron500 }}>
                  · {selectedTicket.ticket_number}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Status & Basic Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                <div>
                  <div style={{ ...labelStyle, marginBottom: 4 }}>Status</div>
                  {(() => { const p = ticketPill(selectedTicket.status); return <span style={p.style}>{p.label}</span>; })()}
                </div>
                <div>
                  <div style={{ ...labelStyle, marginBottom: 4 }}>Device Type</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900 }}>{selectedTicket.device_type}</div>
                </div>
                <div>
                  <div style={{ ...labelStyle, marginBottom: 4 }}>Created</div>
                  <div style={{ ...mono, fontSize: 12, color: T.iron900 }}>{new Date(selectedTicket.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ ...labelStyle, marginBottom: 4 }}>Last Updated</div>
                  <div style={{ ...mono, fontSize: 12, color: T.iron900 }}>{new Date(selectedTicket.updated_at).toLocaleString()}</div>
                </div>
              </div>

              {/* Issue Description */}
              <div>
                <div style={{ ...labelStyle, marginBottom: 8 }}>Issue Description</div>
                <div style={{ borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}`, padding: 14 }}>
                  <div style={{ fontSize: 13, color: T.iron900 }}>{selectedTicket.issue_description}</div>
                </div>
              </div>

              {/* Diagnosis */}
              {selectedTicket.diagnosis && (
                <div>
                  <div style={{ ...labelStyle, marginBottom: 8 }}>Diagnosis</div>
                  <div style={{ borderRadius: 8, background: '#FDF3E9', border: `1px solid #F6D8BA`, padding: 14 }}>
                    <div style={{ fontSize: 13, color: T.iron900 }}>{selectedTicket.diagnosis}</div>
                  </div>
                </div>
              )}

              {/* Repair Notes */}
              {selectedTicket.repair_notes && (
                <div style={{ borderRadius: 8, border: `1px solid #CBE5D6`, background: T.greenTint, padding: 14 }}>
                  <div style={{ ...labelStyle, color: T.green, marginBottom: 4 }}>Repair Completed</div>
                  <div style={{ fontSize: 13, color: T.iron900 }}>{selectedTicket.repair_notes}</div>
                  {selectedTicket.repaired_at && (
                    <div style={{ ...mono, marginTop: 8, fontSize: 10, color: T.green }}>
                      Repaired on: {new Date(selectedTicket.repaired_at).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {/* Pickup Label */}
              {selectedTicket.pickup_label && (
                <div style={{ borderRadius: 8, border: `1px solid #F6D8BA`, background: '#FDEEE6', padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div style={{ ...labelStyle, color: T.orangeDeep, marginBottom: 4 }}>Pickup Label Ready</div>
                      <div style={{ fontSize: 13, color: T.iron500 }}>
                        Print this label and paste it on your package for pickup.
                      </div>
                      <div style={{ fontSize: 12, color: T.iron500, marginTop: 4 }}>
                        {selectedTicket.pickup_courier && <span>Courier: <strong style={{ color: T.iron900 }}>{selectedTicket.pickup_courier}</strong></span>}
                        {selectedTicket.pickup_tracking && <span> · Tracking: <strong style={{ color: T.iron900 }}>{selectedTicket.pickup_tracking}</strong></span>}
                      </div>
                    </div>
                    <a
                      href={`${process.env.REACT_APP_BACKEND_URL}${selectedTicket.pickup_label}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6, background: T.white, border: `1px solid ${T.orange}`, padding: '8px 12px', fontSize: 12, fontWeight: 700, fontFamily: T.headline, color: T.orangeDeep, textDecoration: 'none' }}
                      data-testid="download-pickup-label"
                    >
                      <Download size={14} /> Download Label
                    </a>
                  </div>
                </div>
              )}

              {/* Return Tracking */}
              {selectedTicket.return_tracking && (
                <div style={{ borderRadius: 8, border: `1px solid #CBE0F0`, background: T.blueTint, padding: 14 }}>
                  <div style={{ ...labelStyle, color: T.blue, marginBottom: 4 }}>Return Shipment</div>
                  <div style={{ fontSize: 13, color: T.iron500 }}>
                    Courier: {selectedTicket.return_courier} · Tracking: {selectedTicket.return_tracking}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <div style={{ ...labelStyle, marginBottom: 12 }}>Ticket History</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedTicket.history?.map((entry, index) => (
                    <div key={index} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ marginTop: 6, height: 8, width: 8, flexShrink: 0, borderRadius: 999, background: T.orange }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900 }}>{entry.action}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.iron500 }}>
                          {entry.by} ({entry.by_role}) · {new Date(entry.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Escalate */}
              {canEscalate(selectedTicket) && (
                <div style={{ borderTop: `1px solid ${T.iron200}`, paddingTop: 16 }}>
                  <div style={{ borderRadius: 8, border: `1px solid #F6D8BA`, background: '#FDEEE6', padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <AlertTriangle size={16} color={T.orangeDeep} />
                      <span style={{ ...labelStyle, color: T.orangeDeep }}>No update for 48+ hours?</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.iron500, marginBottom: 12 }}>
                      If you haven't received any update, you can escalate this ticket for immediate attention.
                    </div>
                    <button
                      style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 6, border: 'none', background: T.orange, color: '#fff', padding: '9px 14px', cursor: escalateLoading ? 'default' : 'pointer', opacity: escalateLoading ? 0.7 : 1, fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}
                      onClick={() => handleCustomerEscalate(selectedTicket.id)}
                      disabled={escalateLoading}
                      data-testid="customer-escalate-btn"
                    >
                      {escalateLoading
                        ? <Loader2 className="animate-spin" size={15} />
                        : <AlertTriangle size={15} />}
                      Escalate Ticket
                    </button>
                  </div>
                </div>
              )}

              {/* Feedback */}
              {canProvideFeedback(selectedTicket) && (
                <div style={{ borderTop: `1px solid ${T.iron200}`, paddingTop: 16 }}>
                  <div style={{ borderRadius: 8, border: `1px solid #EDDFA6`, background: T.voltageTint, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Star size={16} color={T.voltageText} fill={T.voltageText} />
                      <span style={{ ...labelStyle, color: T.voltageText }}>How was your experience?</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.iron500, marginBottom: 12 }}>
                      Your feedback helps us improve our service. Please take a moment to rate your experience.
                    </div>
                    <button
                      style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 6, border: `1px solid ${T.voltageText}`, background: T.white, color: T.voltageText, padding: '9px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}
                      onClick={() => {
                        setDetailsOpen(false);
                        openFeedbackDialog(selectedTicket);
                      }}
                      data-testid="provide-feedback-btn"
                    >
                      <Star size={15} /> Provide Feedback
                    </button>
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
    </IronShell>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { openAuthedFile } from '@/lib/openFile';
import AuthedImage from '@/components/ui/AuthedImage';
import CustomerHistoryBadge from '@/components/customer/CustomerHistoryBadge';
import {
  ArrowLeft, Loader2, User, Phone, Mail, MapPin, Package, FileText, Clock,
  AlertTriangle, Wrench, Truck, History, MessageSquare, Edit, XCircle, RefreshCw, CheckCircle,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, LIGHT_VARS, mono, ticketPill, fmtDateTime } from '@/components/iron/IronKit';

const SectionTitle = ({ icon: Icon, children, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon size={15} color={T.orange} /><Caps size={11} color={T.iron900} ls=".1em">{children}</Caps>
    </div>
    {right}
  </div>
);
const Row = ({ label, children }) => (
  <div style={{ display: 'flex', gap: 8, fontSize: 12.5, marginBottom: 6 }}>
    <span style={{ color: T.iron400, minWidth: 92, flexShrink: 0 }}>{label}</span>
    <span style={{ color: T.iron900 }}>{children}</span>
  </div>
);

const tlColor = (a = '') => {
  const s = a.toLowerCase();
  if (s.includes('created')) return T.blue;
  if (s.includes('escalat')) return T.orange;
  if (s.includes('completed') || s.includes('closed') || s.includes('resolved')) return T.green;
  if (s.includes('dispatch')) return T.blue;
  if (s.includes('repair')) return T.voltageText;
  return T.iron500;
};

export default function AdminTicketDetail1a() {
  const { ticketId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editData, setEditData] = useState({ first_name: '', last_name: '', email: '', address: '', city: '', state: '', pincode: '' });
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusOptions, setStatusOptions] = useState({});

  const fetchTicket = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/tickets/${ticketId}`, { headers: { Authorization: `Bearer ${token}` } });
      setTicket(r.data);
    } catch (e) { toast.error('Failed to load ticket details'); }
    finally { setLoading(false); }
  }, [ticketId, token]);

  useEffect(() => {
    fetchTicket();
    axios.get(`${API}/admin/tickets/status-options`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setStatusOptions(r.data.all_statuses || {})).catch(() => {});
  }, [fetchTicket, token]);

  const changeStatus = async () => {
    if (!newStatus) { toast.error('Please select a new status'); return; }
    if (!statusNotes || statusNotes.trim().length < 10) { toast.error('Please enter notes (minimum 10 characters)'); return; }
    setStatusLoading(true);
    try {
      const r = await axios.post(`${API}/admin/tickets/${ticketId}/change-status`, { new_status: newStatus, notes: statusNotes }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(r.data.message); setStatusOpen(false); setNewStatus(''); setStatusNotes(''); fetchTicket();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to change status'); }
    finally { setStatusLoading(false); }
  };
  const closeTicket = async () => {
    if (!closeNotes.trim()) { toast.error('Please enter closing notes'); return; }
    setCloseLoading(true);
    try {
      await axios.post(`${API}/admin/tickets/${ticketId}/close`, { notes: closeNotes }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Ticket closed'); setCloseOpen(false); setCloseNotes(''); fetchTicket();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to close ticket'); }
    finally { setCloseLoading(false); }
  };
  const openEdit = () => {
    if (!ticket?.customer_id) { toast.error('No customer ID for this ticket'); return; }
    const parts = (ticket.customer_name || '').split(' ');
    setEditData({ first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '', email: ticket.customer_email || '', address: ticket.customer_address || '', city: ticket.customer_city || '', state: '', pincode: '' });
    setEditOpen(true);
  };
  const saveCustomer = async () => {
    if (!ticket?.customer_id) return;
    setEditLoading(true);
    try {
      await axios.patch(`${API}/admin/customers/${ticket.customer_id}`, editData, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Customer updated'); setEditOpen(false); fetchTicket();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update customer'); }
    finally { setEditLoading(false); }
  };

  const actions = ticket && (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => { setNewStatus(''); setStatusNotes(''); setStatusOpen(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.voltage}`, background: T.voltageTint, color: T.voltageText, borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}><RefreshCw size={14} /> Change Status</button>
      {ticket.status !== 'closed' && (
        <button onClick={() => setCloseOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}><XCircle size={14} /> Close Ticket</button>
      )}
    </div>
  );

  if (loading) return <IronShell title="Ticket Details" showSearch={false}><div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div></IronShell>;
  if (!ticket) return (
    <IronShell title="Ticket Details" showSearch={false}>
      <div style={{ textAlign: 'center', padding: 60, color: T.iron500 }}>
        <AlertTriangle size={44} style={{ margin: '0 auto 12px' }} color={T.orangeDeep} />
        <div>Ticket not found</div>
        <button onClick={() => navigate('/admin/tickets')} style={{ marginTop: 14, border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600 }}>← Back to Tickets</button>
      </div>
    </IronShell>
  );

  const pill = ticketPill(ticket.status);

  return (
    <IronShell title={`Ticket ${ticket.ticket_number}`} subtitle={ticket.customer_name || ''} headerRight={actions} showSearch={false}>
      <button onClick={() => navigate('/admin/tickets')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12, color: T.iron700, marginBottom: 16 }}><ArrowLeft size={14} /> Back to All Tickets</button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <IronCard>
            <SectionTitle icon={Clock}>Current Status</SectionTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={pill.style}>{pill.label}</span>
              {ticket.sla_breached && <span style={{ ...mono, fontSize: 9.5, fontWeight: 700, color: T.orangeDeep }}>SLA BREACHED</span>}
              {ticket.source === 'voltdoctor' && <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: '#6D4AB0' }}>VOLTDOCTOR</span>}
            </div>
            <Row label="Support">{ticket.support_type || 'Phone'}</Row>
            <Row label="Created">{fmtDateTime(ticket.created_at)}</Row>
            {ticket.sla_due && <Row label="SLA Due">{fmtDateTime(ticket.sla_due)}</Row>}
            {ticket.closed_at && <Row label="Closed">{fmtDateTime(ticket.closed_at)}</Row>}
          </IronCard>

          <IronCard>
            <SectionTitle icon={User} right={<button onClick={openEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 10.5 }}><Edit size={11} /> Edit</button>}>Customer Information</SectionTitle>
            <div style={LIGHT_VARS}><CustomerHistoryBadge phone={ticket.customer_phone} /></div>
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginBottom: 7 }}><User size={14} color={T.iron400} /><span>{ticket.customer_name || '-'}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginBottom: 7 }}><Phone size={14} color={T.iron400} /><span style={mono}>{ticket.customer_phone || '-'}</span><span style={{ fontSize: 9.5, color: T.iron400 }}>(unique ID)</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 7 }}><Mail size={14} color={T.iron400} /><span>{ticket.customer_email || '-'}</span></div>
              {ticket.customer_address && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}><MapPin size={14} color={T.iron400} style={{ marginTop: 2 }} /><span>{ticket.customer_address}{ticket.customer_city ? `, ${ticket.customer_city}` : ''}</span></div>}
            </div>
          </IronCard>

          <IronCard>
            <SectionTitle icon={Package}>Product Details</SectionTitle>
            <Row label="Device Type">{ticket.device_type || '-'}</Row>
            {ticket.product_name && <Row label="Product">{ticket.product_name}</Row>}
            {ticket.serial_number && <Row label="Serial"><span style={mono}>{ticket.serial_number}</span></Row>}
            {ticket.invoice_number && <Row label="Invoice #"><span style={mono}>{ticket.invoice_number}</span></Row>}
            {ticket.order_id && <Row label="Order ID"><span style={mono}>{ticket.order_id}</span></Row>}
            {ticket.category && <Row label="Category">{ticket.category}</Row>}
            {ticket.invoice_file && <button onClick={async () => { if (!(await openAuthedFile(ticket.invoice_file, token, API))) toast.error('Could not open the invoice'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', color: T.orange, cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12, marginTop: 6 }}><FileText size={14} /> View Invoice</button>}
            {ticket.issue_photo && (
              <div style={{ marginTop: 10 }}>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Issue Photo</Caps>
                <button onClick={async () => { if (!(await openAuthedFile(ticket.issue_photo, token, API))) toast.error('Could not open the photo'); }} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                  <AuthedImage path={ticket.issue_photo} token={token} apiBase={API} alt="Issue photo" style={{ width: 240, height: 160, objectFit: 'cover', borderRadius: 8, border: `1px solid ${T.iron200}` }} />
                </button>
              </div>
            )}
          </IronCard>

          <IronCard>
            <SectionTitle icon={MessageSquare}>Issue Description</SectionTitle>
            <p style={{ fontSize: 12.5, color: T.iron700, lineHeight: 1.55, margin: 0 }}>{ticket.issue_description || 'No description provided'}</p>
          </IronCard>

          {(ticket.assigned_to_name || ticket.repair_notes || ticket.service_charges || ticket.pickup_courier || ticket.return_courier) && (
            <IronCard>
              <SectionTitle icon={Wrench}>Service Details</SectionTitle>
              {ticket.assigned_to_name && <Row label="Assigned To">{ticket.assigned_to_name}</Row>}
              {ticket.repair_notes && <div style={{ marginBottom: 6 }}><Caps size={8.5} style={{ display: 'block', marginBottom: 4 }}>Repair Notes</Caps><div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: 8, fontSize: 12, color: T.iron700 }}>{ticket.repair_notes}</div></div>}
              {ticket.service_charges != null && <Row label="Service Charges"><span style={mono}>₹{Number(ticket.service_charges).toLocaleString('en-IN')}</span></Row>}
              {ticket.pickup_courier && <Row label="Pickup"><span style={mono}>{ticket.pickup_courier} ({ticket.pickup_tracking})</span></Row>}
              {ticket.return_courier && <Row label="Return"><span style={mono}>{ticket.return_courier} ({ticket.return_tracking})</span></Row>}
            </IronCard>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <IronCard>
            <SectionTitle icon={History}>Ticket Journey Timeline</SectionTitle>
            {ticket.history && ticket.history.length > 0 ? (
              <div>
                {ticket.history.map((e, i) => {
                  const c = tlColor(e.action); const last = i === ticket.history.length - 1;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 10, height: 10, borderRadius: 999, background: c, flexShrink: 0, marginTop: 5 }} />
                        {!last && <div style={{ width: 2, flex: 1, background: T.iron200, margin: '4px 0' }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: last ? 0 : 16 }}>
                        <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, color: T.iron900 }}>{e.action}</span>
                            <span style={{ ...mono, fontSize: 10, color: T.iron400, whiteSpace: 'nowrap' }}>{fmtDateTime(e.timestamp)}</span>
                          </div>
                          <div style={{ fontSize: 11, color: T.iron500 }}>By: {e.by}{e.by_role ? ` (${e.by_role})` : ''}</div>
                          {e.details && Object.keys(e.details).length > 0 && (
                            <div style={{ marginTop: 8, background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: 8, fontSize: 11.5, color: T.iron700, lineHeight: 1.6 }}>
                              {e.details.notes && <div><b>Notes:</b> {e.details.notes}</div>}
                              {e.details.old_status && e.details.new_status && <div><b>Status:</b> <span style={{ color: T.orangeDeep }}>{e.details.old_status}</span> → <span style={{ color: T.green }}>{e.details.new_status}</span></div>}
                              {e.details.repair_notes && <div><b>Repair Notes:</b> {e.details.repair_notes}</div>}
                              {e.details.courier && <div><b>Courier:</b> {e.details.courier}</div>}
                              {e.details.tracking_id && <div><b>Tracking:</b> {e.details.tracking_id}</div>}
                              {e.details.charges && <div><b>Service Charges:</b> ₹{e.details.charges}</div>}
                              {e.details.sku && <div><b>SKU:</b> {e.details.sku}</div>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ textAlign: 'center', padding: 30, color: T.iron400 }}><History size={40} style={{ margin: '0 auto 8px', opacity: 0.4 }} /><div>No history available</div></div>}
          </IronCard>

          {(ticket.agent_notes || ticket.escalation_notes || ticket.supervisor_notes) && (
            <IronCard>
              <SectionTitle icon={MessageSquare}>Agent Notes</SectionTitle>
              {ticket.agent_notes && <div style={{ background: '#EEE9F7', border: '1px solid #DDD3EF', borderRadius: 8, padding: 10, marginBottom: 10 }}><Caps size={8.5} color="#6D4AB0" style={{ display: 'block', marginBottom: 3 }}>Support Agent Notes</Caps><div style={{ fontSize: 12, color: T.iron700 }}>{ticket.agent_notes}</div></div>}
              {ticket.escalation_notes && <div style={{ background: '#FDEEE6', border: '1px solid #F6D8BA', borderRadius: 8, padding: 10, marginBottom: 10 }}><Caps size={8.5} color={T.orangeDeep} style={{ display: 'block', marginBottom: 3 }}>Escalation Notes {ticket.escalated_by_name ? `(by ${ticket.escalated_by_name})` : ''}</Caps><div style={{ fontSize: 12, color: T.iron700 }}>{ticket.escalation_notes}</div></div>}
              {ticket.supervisor_notes && <div style={{ background: T.blueTint, border: '1px solid #CBE0F0', borderRadius: 8, padding: 10 }}><Caps size={8.5} color={T.blue} style={{ display: 'block', marginBottom: 3 }}>Supervisor Decision: {ticket.supervisor_action?.replace('_', ' ')}{ticket.supervisor_sku ? ` (SKU: ${ticket.supervisor_sku})` : ''}</Caps><div style={{ fontSize: 12, color: T.iron700 }}>{ticket.supervisor_notes}</div></div>}
            </IronCard>
          )}
        </div>
      </div>

      {/* Edit customer dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5 text-orange-500" /> Edit Customer Information</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>First Name</Label><Input value={editData.first_name} onChange={(e) => setEditData({ ...editData, first_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Last Name</Label><Input value={editData.last_name} onChange={(e) => setEditData({ ...editData, last_name: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Phone (Read Only — Unique ID)</Label><Input value={ticket?.customer_phone || ''} disabled /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={editData.address} onChange={(e) => setEditData({ ...editData, address: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>City</Label><Input value={editData.city} onChange={(e) => setEditData({ ...editData, city: e.target.value })} /></div>
              <div className="space-y-2"><Label>State</Label><Input value={editData.state} onChange={(e) => setEditData({ ...editData, state: e.target.value })} /></div>
              <div className="space-y-2"><Label>Pincode</Label><Input value={editData.pincode} onChange={(e) => setEditData({ ...editData, pincode: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveCustomer} disabled={editLoading}>{editLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close dialog */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-orange-600"><XCircle className="w-5 h-5" /> Close Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 border border-border p-3 rounded-lg text-sm space-y-1">
              <p><strong>Ticket:</strong> {ticket?.ticket_number}</p>
              <p><strong>Customer:</strong> {ticket?.customer_name || '-'}</p>
              <p><strong>Current Status:</strong> {ticket?.status?.replace(/_/g, ' ')}</p>
            </div>
            <div className="space-y-2"><Label>Closing Notes *</Label><Textarea placeholder="Enter reason for closing this ticket..." value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} rows={4} /><p className="text-xs text-muted-foreground">This note will be added to the ticket history.</p></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancel</Button>
            <Button onClick={closeTicket} disabled={closeLoading || !closeNotes.trim()} className="bg-orange-500 hover:bg-orange-600">{closeLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Close Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change status dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-yellow-600"><RefreshCw className="w-5 h-5" /> Change Ticket Status</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 border border-border p-3 rounded-lg text-sm space-y-1">
              <p><strong>Ticket:</strong> {ticket?.ticket_number}</p>
              <p><strong>Customer:</strong> {ticket?.customer_name || '-'}</p>
              <p><strong>Current Status:</strong> <span className="font-semibold text-primary">{ticket?.status?.replace(/_/g, ' ')}</span></p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg text-sm text-yellow-700">
              <AlertTriangle className="w-4 h-4 inline mr-1" /><strong>Admin Override:</strong> Changing the status moves this ticket to a different queue (e.g. roll back to the Supervisor queue).
            </div>
            <div className="space-y-2"><Label>New Status *</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue placeholder="Select new status" /></SelectTrigger>
                <SelectContent className="max-h-60">{Object.entries(statusOptions).filter(([k]) => k !== ticket?.status).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Reason for Status Change *</Label><Textarea placeholder="Explain why this status is being changed... (minimum 10 characters)" value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} rows={4} /><p className="text-xs text-muted-foreground">Recorded in the ticket audit trail.</p></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button onClick={changeStatus} disabled={statusLoading || !newStatus || statusNotes.length < 10} className="bg-yellow-600 hover:bg-yellow-700">{statusLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Change Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

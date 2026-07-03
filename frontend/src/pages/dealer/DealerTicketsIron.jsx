import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Ticket, Plus, Loader2, Clock, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

// Status chip config: tone maps to badgeStyle, icon preserved from original.
const STATUS_TONES = {
  open:        { tone: 'warn', icon: Clock },
  in_progress: { tone: 'info', icon: MessageSquare },
  resolved:    { tone: 'ok', icon: CheckCircle },
  closed:      { tone: 'slate', icon: AlertCircle },
};

const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

export default function DealerTickets() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [products, setProducts] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    product_id: '',
    issue_type: 'product_issue',
    subject: '',
    description: ''
  });

  useEffect(() => {
    if (token) {
      fetchTickets();
      fetchProducts();
    }
  }, [token]);

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API}/dealer/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(response.data || []);
    } catch (error) {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/dealer/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(response.data || []);
    } catch (error) {
      console.error('Failed to load products');
    }
  };

  const handleCreate = async () => {
    if (!form.subject || !form.description) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // Backend expects multipart form-data with a required `issue_description` field —
      // posting the raw object as JSON was being rejected (422). Combine subject + description.
      const fd = new FormData();
      fd.append('issue_description', `${form.subject}\n\n${form.description}`.trim());
      if (form.product_id) fd.append('product_id', form.product_id);
      if (form.subject) fd.append('subject', form.subject);
      if (form.issue_type) fd.append('issue_type', form.issue_type);
      await axios.post(`${API}/dealer/tickets`, fd, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Ticket created successfully');
      setShowCreateDialog(false);
      setForm({ product_id: '', issue_type: 'product_issue', subject: '', description: '' });
      fetchTickets();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusChip = (status) => {
    const cfg = STATUS_TONES[status] || STATUS_TONES.open;
    const Icon = cfg.icon;
    return (
      <span style={{ ...badgeStyle(cfg.tone), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon style={{ width: 11, height: 11 }} />
        {(status || 'open').replace('_', ' ')}
      </span>
    );
  };

  const newTicketBtn = (
    <button onClick={() => setShowCreateDialog(true)} style={primaryBtn}>
      <Plus style={{ width: 14, height: 14 }} /> New Ticket
    </button>
  );

  if (loading) {
    return (
      <IronShell title="Support Tickets" subtitle="DEALER PORTAL" onRefresh={fetchTickets}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
          <Loader2 style={{ width: 32, height: 32, color: T.orange }} className="animate-spin" />
        </div>
      </IronShell>
    );
  }

  return (
    <IronShell title="Support Tickets" subtitle="DEALER PORTAL" onRefresh={fetchTickets} headerRight={newTicketBtn}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <Caps size={10} color={T.iron400}>Dealer Portal</Caps>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900, marginTop: 4 }}>Support Tickets</div>
            <div style={{ color: T.iron500, fontSize: 13, marginTop: 2 }}>Get help with product issues or queries</div>
          </div>
          <button onClick={() => setShowCreateDialog(true)} style={primaryBtn}>
            <Plus style={{ width: 14, height: 14 }} /> New Ticket
          </button>
        </div>

        {/* Tickets List */}
        <IronCard pad={0}>
          {tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px' }}>
              <Ticket style={{ width: 40, height: 40, margin: '0 auto 12px', color: T.iron200 }} />
              <div style={{ color: T.iron900, fontWeight: 600, fontFamily: T.headline }}>No tickets yet</div>
              <div style={{ color: T.iron500, fontSize: 13, marginTop: 4 }}>Create a ticket if you need assistance</div>
            </div>
          ) : (
            <div>
              {tickets.map((ticket, idx) => (
                <div
                  key={ticket.id}
                  className="iron-row"
                  style={{ padding: 16, borderTop: idx === 0 ? 'none' : `1px solid ${T.iron200}` }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span style={{ ...mono, fontSize: 11, color: T.iron500, letterSpacing: '.02em' }}>
                          {ticket.ticket_number}
                        </span>
                        {getStatusChip(ticket.status)}
                      </div>
                      <div style={{ color: T.iron900, fontWeight: 600, fontSize: 13.5, fontFamily: T.headline }}>{ticket.subject}</div>
                      <div style={{ color: T.iron500, fontSize: 13, marginTop: 4, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {ticket.description}
                      </div>
                      {ticket.product_name && (
                        <div style={{ ...mono, color: T.orangeDeep, fontSize: 11.5, marginTop: 8 }}>
                          Product: {ticket.product_name}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ ...mono, fontSize: 11, color: T.iron400 }}>
                        {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '-'}
                      </span>
                    </div>
                  </div>
                  {ticket.admin_response && (
                    <div style={{ marginTop: 12, padding: 12, background: T.iron50, borderRadius: 6, border: `1px solid ${T.iron200}` }}>
                      <div style={{ fontSize: 13, color: T.iron700 }}>
                        <span style={{ color: T.orangeDeep, fontWeight: 700 }}>Response: </span>
                        {ticket.admin_response}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </IronCard>
      </div>

      {/* Create Ticket Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-popover border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Support Ticket</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Describe your issue and we'll get back to you soon
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Issue Type</Label>
              <Select value={form.issue_type} onValueChange={(v) => setForm({ ...form, issue_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product_issue">Product Issue</SelectItem>
                  <SelectItem value="order_issue">Order Issue</SelectItem>
                  <SelectItem value="payment_issue">Payment Issue</SelectItem>
                  <SelectItem value="delivery_issue">Delivery Issue</SelectItem>
                  <SelectItem value="general">General Query</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Related Product (Optional)</Label>
              <Select value={form.product_id || 'none'} onValueChange={(v) => setForm({ ...form, product_id: v === 'none' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief summary of your issue"
              />
            </div>

            <div>
              <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Description *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Provide details about your issue..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

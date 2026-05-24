import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Ticket, Plus, Loader2, Clock, CheckCircle, AlertCircle, MessageSquare
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Obsidian status chip tones
const STATUS_TONES = {
  open:        { cls: 'bg-amber-400/15 text-amber-400 ring-amber-400/25',     icon: Clock },
  in_progress: { cls: 'bg-primary/15 text-primary ring-primary/25',           icon: MessageSquare },
  resolved:    { cls: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25', icon: CheckCircle },
  closed:      { cls: 'bg-muted text-muted-foreground ring-border',            icon: AlertCircle },
};

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
      await axios.post(`${API}/dealer/tickets`, form, {
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
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${cfg.cls}`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLayout title="Support Tickets">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Support Tickets">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
              Dealer Portal
            </p>
            <h2 className="text-2xl font-bold text-foreground">Support Tickets</h2>
            <p className="text-muted-foreground text-sm mt-1">Get help with product issues or queries</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        </div>

        {/* Tickets List */}
        <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
          {tickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-foreground font-medium">No tickets yet</p>
              <p className="text-muted-foreground text-sm mt-1">Create a ticket if you need assistance</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-mono text-[11px] text-muted-foreground tracking-wide">
                          {ticket.ticket_number}
                        </span>
                        {getStatusChip(ticket.status)}
                      </div>
                      <h4 className="text-foreground font-medium text-sm">{ticket.subject}</h4>
                      <p className="text-muted-foreground text-sm mt-1 line-clamp-2 leading-relaxed">
                        {ticket.description}
                      </p>
                      {ticket.product_name && (
                        <p className="text-primary text-xs mt-2 font-mono">
                          Product: {ticket.product_name}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {ticket.admin_response && (
                    <div className="mt-3 p-3 bg-muted rounded border border-border">
                      <p className="text-sm text-foreground">
                        <span className="text-primary font-semibold">Response: </span>
                        {ticket.admin_response}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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
    </DashboardLayout>
  );
}

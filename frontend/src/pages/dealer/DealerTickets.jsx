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

  const getStatusBadge = (status) => {
    const styles = {
      open: { bg: 'bg-yellow-600', icon: Clock },
      in_progress: { bg: 'bg-blue-600', icon: MessageSquare },
      resolved: { bg: 'bg-green-600', icon: CheckCircle },
      closed: { bg: 'bg-slate-600', icon: AlertCircle }
    };
    const style = styles[status] || styles.open;
    const Icon = style.icon;
    return (
      <Badge className={style.bg}>
        <Icon className="w-3 h-3 mr-1" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (loading) {
    return (
      <DashboardLayout title="Support Tickets">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Support Tickets">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">Support Tickets</h2>
            <p className="text-slate-400 text-sm">Get help with product issues or queries</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        </div>

        {/* Tickets List */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-0">
            {tickets.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tickets yet</p>
                <p className="text-sm mt-2">Create a ticket if you need assistance</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-slate-400 text-sm font-mono">{ticket.ticket_number}</span>
                          {getStatusBadge(ticket.status)}
                        </div>
                        <h4 className="text-white font-medium">{ticket.subject}</h4>
                        <p className="text-slate-400 text-sm mt-1 line-clamp-2">{ticket.description}</p>
                        {ticket.product_name && (
                          <p className="text-cyan-400 text-sm mt-2">Product: {ticket.product_name}</p>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-slate-400">{new Date(ticket.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {ticket.admin_response && (
                      <div className="mt-3 p-3 bg-slate-900 rounded-lg">
                        <p className="text-slate-300 text-sm">
                          <span className="text-cyan-400 font-medium">Response:</span> {ticket.admin_response}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Ticket Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Create Support Ticket</DialogTitle>
            <DialogDescription className="text-slate-400">
              Describe your issue and we'll get back to you soon
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Issue Type</Label>
              <Select value={form.issue_type} onValueChange={(v) => setForm({ ...form, issue_type: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="product_issue">Product Issue</SelectItem>
                  <SelectItem value="order_issue">Order Issue</SelectItem>
                  <SelectItem value="payment_issue">Payment Issue</SelectItem>
                  <SelectItem value="delivery_issue">Delivery Issue</SelectItem>
                  <SelectItem value="general">General Query</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Related Product (Optional)</Label>
              <Select value={form.product_id || 'none'} onValueChange={(v) => setForm({ ...form, product_id: v === 'none' ? '' : v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="none">None</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief summary of your issue"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <Label className="text-slate-300">Description *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Provide details about your issue..."
                rows={4}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting} className="bg-cyan-600 hover:bg-cyan-700">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

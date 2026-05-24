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
  Gift, Plus, Loader2, Clock, CheckCircle, X, TrendingUp, Megaphone
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Status chip tones
const STATUS_TONES = {
  pending:   { cls: 'bg-amber-400/15 text-amber-400 ring-amber-400/25',   icon: Clock },
  approved:  { cls: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25', icon: CheckCircle },
  rejected:  { cls: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',      icon: X },
  completed: { cls: 'bg-primary/15 text-primary ring-primary/25',         icon: CheckCircle },
};

// Quick-action card tiles
const TYPE_TILES = [
  {
    key: 'promotional_material',
    label: 'Promotional Material',
    sub: 'Banners, posters, standees',
    icon: Megaphone,
    tile: 'bg-violet-400/15 text-violet-400',
  },
  {
    key: 'scheme_request',
    label: 'Special Schemes',
    sub: 'Discounts & offers',
    icon: Gift,
    tile: 'bg-emerald-500/15 text-emerald-400',
  },
  {
    key: 'pricing_query',
    label: 'Pricing Query',
    sub: 'Bulk pricing, margins',
    icon: TrendingUp,
    tile: 'bg-amber-400/15 text-amber-400',
  },
];

const TYPE_ICON_TONE = {
  promotional_material: 'bg-violet-400/15 text-violet-400',
  scheme_request:       'bg-emerald-500/15 text-emerald-400',
  pricing_query:        'bg-amber-400/15 text-amber-400',
};

export default function DealerPromotions() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    request_type: 'promotional_material',
    subject: '',
    details: ''
  });

  useEffect(() => {
    if (token) {
      fetchRequests();
    }
  }, [token]);

  const fetchRequests = async () => {
    try {
      const response = await axios.get(`${API}/dealer/promo-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(response.data || []);
    } catch (error) {
      toast.error('Failed to load promo requests');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.subject || !form.details) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/dealer/promo-requests`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Request submitted successfully');
      setShowCreateDialog(false);
      setForm({ request_type: 'promotional_material', subject: '', details: '' });
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusChip = (status) => {
    const cfg = STATUS_TONES[status] || STATUS_TONES.pending;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${cfg.cls}`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  const getTypeIcon = (type) => {
    const icons = {
      promotional_material: Megaphone,
      scheme_request: Gift,
      pricing_query: TrendingUp
    };
    const Icon = icons[type] || Megaphone;
    const tone = TYPE_ICON_TONE[type] || TYPE_ICON_TONE.promotional_material;
    return (
      <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${tone}`}>
        <Icon className="w-4 h-4" />
      </div>
    );
  };

  const getTypeLabel = (type) => {
    const labels = {
      promotional_material: 'Promotional Material',
      scheme_request: 'Scheme Request',
      pricing_query: 'Pricing Query'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <DashboardLayout title="Promotions & Schemes">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Promotions & Schemes">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
              Dealer Portal
            </p>
            <h2 className="text-2xl font-bold text-foreground">Promotions & Schemes</h2>
            <p className="text-muted-foreground text-sm mt-1">Request promotional materials and special schemes</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TYPE_TILES.map(({ key, label, sub, icon: Icon, tile }) => (
            <button
              key={key}
              onClick={() => { setForm({ ...form, request_type: key }); setShowCreateDialog(true); }}
              className="mg-card rounded-lg border border-border bg-card p-4 flex items-center gap-4 text-left transition-colors hover:border-primary/40 cursor-pointer"
            >
              <div className={`w-11 h-11 rounded flex items-center justify-center flex-shrink-0 ${tile}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-foreground font-semibold text-sm">{label}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Requests List */}
        <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Your Requests
            </h3>
          </div>
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-foreground font-medium">No requests yet</p>
              <p className="text-muted-foreground text-sm mt-1">Request promotional materials or schemes</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {requests.map((request) => (
                <div key={request.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      {getTypeIcon(request.request_type)}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="text-foreground font-medium text-sm">{request.subject}</h4>
                          {getStatusChip(request.status)}
                        </div>
                        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          {getTypeLabel(request.request_type)}
                        </p>
                        <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{request.details}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {request.admin_response && (
                    <div className="mt-3 ml-11 p-3 bg-muted rounded border border-border">
                      <p className="text-sm text-foreground">
                        <span className="text-primary font-semibold">Response: </span>
                        {request.admin_response}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Request Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-popover border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">New Promo Request</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Submit a request for promotional materials or schemes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Request Type</Label>
              <Select value={form.request_type} onValueChange={(v) => setForm({ ...form, request_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="promotional_material">Promotional Material</SelectItem>
                  <SelectItem value="scheme_request">Scheme Request</SelectItem>
                  <SelectItem value="pricing_query">Pricing Query</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g., Need standees for store"
              />
            </div>

            <div>
              <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Details *</Label>
              <Textarea
                value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
                placeholder="Describe what you need..."
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
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

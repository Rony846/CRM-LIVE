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

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'bg-yellow-600', icon: Clock },
      approved: { bg: 'bg-green-600', icon: CheckCircle },
      rejected: { bg: 'bg-red-600', icon: X },
      completed: { bg: 'bg-blue-600', icon: CheckCircle }
    };
    const style = styles[status] || styles.pending;
    const Icon = style.icon;
    return (
      <Badge className={style.bg}>
        <Icon className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const getTypeIcon = (type) => {
    const icons = {
      promotional_material: Megaphone,
      scheme_request: Gift,
      pricing_query: TrendingUp
    };
    const Icon = icons[type] || Megaphone;
    return <Icon className="w-5 h-5 text-cyan-400" />;
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
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Promotions & Schemes">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">Promotions & Schemes</h2>
            <p className="text-slate-400 text-sm">Request promotional materials and special schemes</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800 border-slate-700 cursor-pointer hover:border-cyan-500 transition-colors"
                onClick={() => { setForm({ ...form, request_type: 'promotional_material' }); setShowCreateDialog(true); }}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <Megaphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">Promotional Material</p>
                <p className="text-slate-400 text-sm">Banners, posters, standees</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700 cursor-pointer hover:border-cyan-500 transition-colors"
                onClick={() => { setForm({ ...form, request_type: 'scheme_request' }); setShowCreateDialog(true); }}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">Special Schemes</p>
                <p className="text-slate-400 text-sm">Discounts & offers</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700 cursor-pointer hover:border-cyan-500 transition-colors"
                onClick={() => { setForm({ ...form, request_type: 'pricing_query' }); setShowCreateDialog(true); }}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">Pricing Query</p>
                <p className="text-slate-400 text-sm">Bulk pricing, margins</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Requests List */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Your Requests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {requests.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No requests yet</p>
                <p className="text-sm mt-2">Request promotional materials or schemes</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {requests.map((request) => (
                  <div key={request.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getTypeIcon(request.request_type)}
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="text-white font-medium">{request.subject}</h4>
                            {getStatusBadge(request.status)}
                          </div>
                          <p className="text-slate-400 text-sm">{getTypeLabel(request.request_type)}</p>
                          <p className="text-slate-300 text-sm mt-2">{request.details}</p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-slate-400">{new Date(request.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {request.admin_response && (
                      <div className="mt-3 ml-8 p-3 bg-slate-900 rounded-lg">
                        <p className="text-slate-300 text-sm">
                          <span className="text-cyan-400 font-medium">Response:</span> {request.admin_response}
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

      {/* Create Request Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">New Promo Request</DialogTitle>
            <DialogDescription className="text-slate-400">
              Submit a request for promotional materials or schemes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Request Type</Label>
              <Select value={form.request_type} onValueChange={(v) => setForm({ ...form, request_type: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="promotional_material">Promotional Material</SelectItem>
                  <SelectItem value="scheme_request">Scheme Request</SelectItem>
                  <SelectItem value="pricing_query">Pricing Query</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g., Need standees for store"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <Label className="text-slate-300">Details *</Label>
              <Textarea
                value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
                placeholder="Describe what you need..."
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
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

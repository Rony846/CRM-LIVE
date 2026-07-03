import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
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
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };

// Status -> Iron pill tone + icon
const STATUS_TONES = {
  pending:   { tone: 'warn',   icon: Clock },
  approved:  { tone: 'ok',     icon: CheckCircle },
  rejected:  { tone: 'bad',    icon: X },
  completed: { tone: 'info',   icon: CheckCircle },
};

// Quick-action tiles
const TYPE_TILES = [
  { key: 'promotional_material', label: 'Promotional Material', sub: 'Banners, posters, standees', icon: Megaphone, tone: 'violet' },
  { key: 'scheme_request',       label: 'Special Schemes',      sub: 'Discounts & offers',        icon: Gift,      tone: 'ok' },
  { key: 'pricing_query',        label: 'Pricing Query',        sub: 'Bulk pricing, margins',     icon: TrendingUp, tone: 'warn' },
];

const TYPE_TONE = {
  promotional_material: 'violet',
  scheme_request:       'ok',
  pricing_query:        'warn',
};

const TYPE_ICON = {
  promotional_material: Megaphone,
  scheme_request:       Gift,
  pricing_query:        TrendingUp,
};

const tileColors = {
  violet: { bg: '#EEE9F7', fg: '#6D4AB0' },
  ok:     { bg: T.greenTint, fg: T.green },
  warn:   { bg: T.voltageTint, fg: T.voltageText },
  info:   { bg: T.blueTint, fg: T.blue },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <span style={{ ...badgeStyle(cfg.tone), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon style={{ width: 11, height: 11 }} />
        {status}
      </span>
    );
  };

  const getTypeIcon = (type) => {
    const Icon = TYPE_ICON[type] || Megaphone;
    const c = tileColors[TYPE_TONE[type] || 'violet'];
    return (
      <div style={{ width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: c.bg, color: c.fg }}>
        <Icon style={{ width: 16, height: 16 }} />
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

  const headerRight = (
    <button onClick={() => setShowCreateDialog(true)} style={btnPrimary}>
      <Plus style={{ width: 14, height: 14 }} />
      New Request
    </button>
  );

  const content = loading ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
      <Loader2 className="animate-spin" style={{ width: 32, height: 32, color: T.orange }} />
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>

      {/* Intro */}
      <div>
        <Caps size={10} color={T.iron400}>Dealer Portal</Caps>
        <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900, marginTop: 2 }}>Promotions &amp; Schemes</div>
        <div style={{ fontSize: 13, color: T.iron500, marginTop: 2 }}>Request promotional materials and special schemes</div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {TYPE_TILES.map(({ key, label, sub, icon: Icon, tone }) => {
          const c = tileColors[tone];
          return (
            <button
              key={key}
              onClick={() => { setForm({ ...form, request_type: key }); setShowCreateDialog(true); }}
              style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, boxShadow: '0 1px 2px rgba(15,15,15,.06)', padding: 14, display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: c.bg, color: c.fg }}>
                <Icon style={{ width: 20, height: 20 }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: T.iron900, fontWeight: 700, fontSize: 13, fontFamily: T.headline }}>{label}</div>
                <div style={{ color: T.iron500, fontSize: 12, marginTop: 2 }}>{sub}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Requests List */}
      <IronCard pad={0}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          <Caps size={9}>Your Requests</Caps>
        </div>
        {requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Gift style={{ width: 40, height: 40, margin: '0 auto 12px', color: T.iron200 }} />
            <div style={{ color: T.iron900, fontWeight: 600, fontSize: 14 }}>No requests yet</div>
            <div style={{ color: T.iron500, fontSize: 13, marginTop: 2 }}>Request promotional materials or schemes</div>
          </div>
        ) : (
          <div>
            {requests.map((request) => (
              <div key={request.id} className="iron-row" style={{ padding: 14, borderBottom: `1px solid ${T.iron200}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                    {getTypeIcon(request.request_type)}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ color: T.iron900, fontWeight: 600, fontSize: 13 }}>{request.subject}</span>
                        {getStatusChip(request.status)}
                      </div>
                      <Caps size={9} color={T.iron400}>{getTypeLabel(request.request_type)}</Caps>
                      <div style={{ color: T.iron500, fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{request.details}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ ...mono, fontSize: 11, color: T.iron500 }}>
                      {request.created_at ? new Date(request.created_at).toLocaleDateString() : '-'}
                    </span>
                  </div>
                </div>
                {request.admin_response && (
                  <div style={{ marginTop: 12, marginLeft: 44, padding: 12, background: T.iron50, borderRadius: 6, border: `1px solid ${T.iron200}` }}>
                    <div style={{ fontSize: 13, color: T.iron900 }}>
                      <span style={{ color: T.orange, fontWeight: 700 }}>Response: </span>
                      {request.admin_response}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </IronCard>
    </div>
  );

  return (
    <IronShell
      title="Promotions"
      subtitle="DEALER PORTAL / PROMOTIONS & SCHEMES"
      onRefresh={fetchRequests}
      headerRight={headerRight}
    >
      {content}

      {/* Create Request Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Promo Request</DialogTitle>
            <DialogDescription>
              Submit a request for promotional materials or schemes
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Label style={{ color: T.iron500, fontFamily: T.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Request Type</Label>
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
              <Label style={{ color: T.iron500, fontFamily: T.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g., Need standees for store"
              />
            </div>

            <div>
              <Label style={{ color: T.iron500, fontFamily: T.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Details *</Label>
              <Textarea
                value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
                placeholder="Describe what you need..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <button style={btnOutline} onClick={() => setShowCreateDialog(false)}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.7 : 1 }}>
              {submitting && <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />}
              Submit Request
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

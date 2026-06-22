import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Scale, Gavel, Loader2, RefreshCw, LogOut, MapPin, Phone, Mail, FileText,
  IndianRupee, CheckCircle2, Clock, Copy, User,
} from 'lucide-react';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (s) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
};

export default function LawyerDashboard() {
  const { token, user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | pending | sent
  const [noticeFor, setNoticeFor] = useState(null);
  const [noticeRef, setNoticeRef] = useState('');
  const [noticeNote, setNoticeNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/lawyer/legal-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load legal cases');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const copyServeBlock = (o) => {
    const block = [
      o.customer_name,
      o.address,
      [o.city, o.state, o.pincode].filter(Boolean).join(', '),
      o.phone && `Phone: ${o.phone}`,
      o.email && `Email: ${o.email}`,
      o.gstin && `GSTIN: ${o.gstin}`,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(block).then(
      () => toast.success('Address copied'),
      () => toast.error('Copy failed'),
    );
  };

  const submitNoticeSent = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/lawyer/legal-orders/${noticeFor.id}/notice-sent`,
        { notice_ref: noticeRef, note: noticeNote },
        { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Notice marked as sent');
      setNoticeFor(null); setNoticeRef(''); setNoticeNote('');
      load();
    } catch (e) {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const orders = (data?.orders || []).filter((o) =>
    filter === 'all' ? true : o.notice_status === filter);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Scale className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <div className="text-lg font-bold font-['Barlow_Condensed'] leading-tight text-foreground">
                MuscleGrid — Legal Portal
              </div>
              <div className="text-xs text-muted-foreground">Orders flagged for legal notice · read-only</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading legal cases…
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold font-['Barlow_Condensed'] text-foreground">Legal Notices</h1>
                <p className="text-sm text-muted-foreground">
                  {data?.summary?.total || 0} order(s) flagged · total claim{' '}
                  <span className="font-semibold text-foreground">{inr(data?.summary?.total_claim)}</span>
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="w-4 h-4 mr-1" /> Refresh
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard icon={<Gavel className="w-4 h-4" />} label="Total flagged" value={data?.summary?.total || 0} />
              <StatCard icon={<Clock className="w-4 h-4" />} label="Notice pending" value={data?.summary?.pending || 0} accent="text-amber-400" />
              <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Notice sent" value={data?.summary?.sent || 0} accent="text-emerald-400" />
            </div>

            {/* Filter */}
            <div className="flex gap-2 mb-4">
              {['all', 'pending', 'sent'].map((f) => (
                <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'}
                        onClick={() => setFilter(f)} className="capitalize">
                  {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Sent'}
                </Button>
              ))}
            </div>

            {/* Cases */}
            {orders.length === 0 ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">
                <Scale className="w-10 h-10 mx-auto mb-3 opacity-40" />
                No orders in this view. Staff flag orders for legal notice from the CRM Orders page.
              </CardContent></Card>
            ) : (
              <div className="space-y-4">
                {orders.map((o) => (
                  <Card key={o.id} className="overflow-hidden">
                    <CardContent className="py-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        {/* Serve-to block */}
                        <div className="min-w-[260px]">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-bold text-foreground">{o.customer_name || '—'}</span>
                            {o.notice_status === 'sent'
                              ? <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/15">Notice sent</Badge>
                              : <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/15">Pending</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-0.5">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>{[o.address, o.city, o.state, o.pincode].filter(Boolean).join(', ') || '— no address —'}</span>
                            </div>
                            {o.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {o.phone}</div>}
                            {o.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {o.email}</div>}
                            {o.gstin && <div className="flex items-center gap-2 font-mono text-xs">GSTIN: {o.gstin}</div>}
                          </div>
                          <Button variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs text-muted-foreground"
                                  onClick={() => copyServeBlock(o)}>
                            <Copy className="w-3 h-3 mr-1" /> Copy address
                          </Button>
                        </div>

                        {/* Claim block */}
                        <div className="min-w-[200px]">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Claim amount</div>
                          <div className="text-2xl font-bold text-primary flex items-center">
                            <IndianRupee className="w-5 h-5" />{Number(o.claim_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Order <span className="font-mono text-foreground">{o.order_number}</span> · {fmtDate(o.order_date)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {o.product || '—'} · {o.firm_name || '—'} · payment: {o.payment_status || '—'}
                          </div>
                          <div className="mt-2 text-sm">
                            <span className="text-muted-foreground">Reason: </span>
                            <span className="text-foreground font-medium">{o.reason || '—'}</span>
                          </div>
                          {o.note && <div className="text-xs text-muted-foreground mt-0.5">{o.note}</div>}
                          <div className="text-[11px] text-muted-foreground mt-1">
                            Flagged by {o.marked_by || '—'} · {fmtDate(o.marked_at)}
                          </div>
                        </div>

                        {/* Action */}
                        <div className="flex flex-col items-end gap-2">
                          {o.notice_status === 'sent' ? (
                            <div className="text-right text-xs text-muted-foreground">
                              <div className="text-emerald-400 font-medium flex items-center gap-1 justify-end">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Sent {fmtDate(o.notice_sent_at)}
                              </div>
                              {o.notice_ref && <div>Ref: <span className="font-mono text-foreground">{o.notice_ref}</span></div>}
                            </div>
                          ) : (
                            <Button size="sm" onClick={() => { setNoticeFor(o); setNoticeRef(''); setNoticeNote(''); }}>
                              <Gavel className="w-4 h-4 mr-1" /> Mark notice sent
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Mark-notice-sent dialog */}
      <Dialog open={!!noticeFor} onOpenChange={(v) => !v && setNoticeFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record legal notice sent</DialogTitle>
          </DialogHeader>
          {noticeFor && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {noticeFor.customer_name} · order <span className="font-mono">{noticeFor.order_number}</span> · claim {inr(noticeFor.claim_amount)}
              </p>
              <div>
                <label className="text-xs text-muted-foreground">Notice reference (optional)</label>
                <Input value={noticeRef} onChange={(e) => setNoticeRef(e.target.value)} placeholder="e.g. LN/2026/0142" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Note (optional)</label>
                <Textarea value={noticeNote} onChange={(e) => setNoticeNote(e.target.value)} rows={3}
                          placeholder="Mode of service, date, courier/RPAD no., etc." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoticeFor(null)}>Cancel</Button>
            <Button onClick={submitNoticeSent} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm sent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon}{label}</div>
        <div className={`text-2xl font-bold ${accent || 'text-foreground'}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

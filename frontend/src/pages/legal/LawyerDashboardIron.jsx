import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Scale, Gavel, Loader2, RefreshCw, LogOut, MapPin, Phone, Mail,
  IndianRupee, CheckCircle2, Clock, Copy, User,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (s) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
};

const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const ghostBtn = { border: 'none', background: 'transparent', color: T.iron500, borderRadius: 6, padding: '4px 6px', fontFamily: T.headline, fontWeight: 600, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };

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

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {user?.email && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.iron400 }}>{user.email}</span>}
      <button onClick={logout} style={outlineBtn}><LogOut size={14} /> Sign out</button>
    </div>
  );

  return (
    <IronShell
      title="Legal Portal"
      subtitle="ORDERS FLAGGED FOR LEGAL NOTICE · READ-ONLY"
      onRefresh={load}
      headerRight={headerRight}
    >
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 0', color: T.iron400, fontFamily: T.body }}>
          <Loader2 className="animate-spin" style={{ width: 20, height: 20, marginRight: 8 }} /> Loading legal cases…
        </div>
      ) : (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* Summary */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Scale size={20} color={T.orange} />
                <h1 style={{ fontFamily: T.display, fontWeight: 800, fontSize: 26, color: T.iron900, margin: 0, letterSpacing: '.01em' }}>Legal Notices</h1>
              </div>
              <p style={{ fontSize: 13, color: T.iron500, margin: '4px 0 0', fontFamily: T.body }}>
                {data?.summary?.total || 0} order(s) flagged · total claim{' '}
                <span style={{ fontWeight: 700, color: T.iron900, ...mono }}>{inr(data?.summary?.total_claim)}</span>
              </p>
            </div>
            <button onClick={load} style={outlineBtn}><RefreshCw size={14} /> Refresh</button>
          </div>

          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
            <StatTile icon={<Gavel size={14} />} label="Total flagged" value={data?.summary?.total || 0} color={T.iron900} />
            <StatTile icon={<Clock size={14} />} label="Notice pending" value={data?.summary?.pending || 0} color={T.voltageText} />
            <StatTile icon={<CheckCircle2 size={14} />} label="Notice sent" value={data?.summary?.sent || 0} color={T.green} />
          </div>

          {/* Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {['all', 'pending', 'sent'].map((f) => {
              const active = filter === f;
              return (
                <button key={f} onClick={() => setFilter(f)}
                  style={{
                    border: `1px solid ${active ? T.orange : T.iron200}`,
                    background: active ? T.orange : T.white,
                    color: active ? '#fff' : T.iron700,
                    borderRadius: 6, padding: '6px 14px', fontFamily: T.headline, fontWeight: 700,
                    fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer',
                  }}>
                  {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Sent'}
                </button>
              );
            })}
          </div>

          {/* Cases */}
          {orders.length === 0 ? (
            <IronCard style={{ padding: '64px 0', textAlign: 'center' }}>
              <Scale size={40} style={{ margin: '0 auto 12px', opacity: 0.35, color: T.iron400 }} />
              <div style={{ color: T.iron500, fontFamily: T.body, fontSize: 13 }}>
                No orders in this view. Staff flag orders for legal notice from the CRM Orders page.
              </div>
            </IronCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {orders.map((o) => (
                <IronCard key={o.id} pad={0}>
                  <div style={{ padding: 18, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
                    {/* Serve-to block */}
                    <div style={{ minWidth: 260, flex: '1 1 260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <User size={15} color={T.iron400} />
                        <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>{o.customer_name || '—'}</span>
                        {o.notice_status === 'sent'
                          ? <span style={badgeStyle('ok')}>Notice sent</span>
                          : <span style={badgeStyle('warn')}>Pending</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: T.iron500, fontFamily: T.body, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <MapPin size={13} style={{ marginTop: 2, flexShrink: 0 }} />
                          <span>{[o.address, o.city, o.state, o.pincode].filter(Boolean).join(', ') || '— no address —'}</span>
                        </div>
                        {o.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={13} /> {o.phone}</div>}
                        {o.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={13} /> {o.email}</div>}
                        {o.gstin && <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...mono, fontSize: 11.5 }}>GSTIN: {o.gstin}</div>}
                      </div>
                      <button onClick={() => copyServeBlock(o)} style={{ ...ghostBtn, marginTop: 6 }}>
                        <Copy size={12} /> Copy address
                      </button>
                    </div>

                    {/* Claim block */}
                    <div style={{ minWidth: 200, flex: '1 1 200px' }}>
                      <Caps size={9}>Claim amount</Caps>
                      <div style={{ display: 'flex', alignItems: 'center', fontFamily: T.display, fontWeight: 800, fontSize: 26, color: T.orange, ...mono }}>
                        <IndianRupee size={20} />{Number(o.claim_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 4, fontFamily: T.body }}>
                        Order <span style={{ ...mono, color: T.iron900 }}>{o.order_number}</span> · {fmtDate(o.order_date)}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.iron500, fontFamily: T.body }}>
                        {o.product || '—'} · {o.firm_name || '—'} · payment: {o.payment_status || '—'}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12.5, fontFamily: T.body }}>
                        <span style={{ color: T.iron500 }}>Reason: </span>
                        <span style={{ color: T.iron900, fontWeight: 600 }}>{o.reason || '—'}</span>
                      </div>
                      {o.note && <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 2, fontFamily: T.body }}>{o.note}</div>}
                      <div style={{ fontSize: 11, color: T.iron400, marginTop: 4, fontFamily: T.body }}>
                        Flagged by {o.marked_by || '—'} · {fmtDate(o.marked_at)}
                      </div>
                    </div>

                    {/* Action */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      {o.notice_status === 'sent' ? (
                        <div style={{ textAlign: 'right', fontSize: 11.5, color: T.iron500, fontFamily: T.body }}>
                          <div style={{ color: T.green, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            <CheckCircle2 size={13} /> Sent {fmtDate(o.notice_sent_at)}
                          </div>
                          {o.notice_ref && <div>Ref: <span style={{ ...mono, color: T.iron900 }}>{o.notice_ref}</span></div>}
                        </div>
                      ) : (
                        <button onClick={() => { setNoticeFor(o); setNoticeRef(''); setNoticeNote(''); }} style={primaryBtn}>
                          <Gavel size={14} /> Mark notice sent
                        </button>
                      )}
                    </div>
                  </div>
                </IronCard>
              ))}
            </div>
          )}
        </div>
      )}

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
    </IronShell>
  );
}

function StatTile({ icon, label, value, color }) {
  return (
    <IronCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.iron400, marginBottom: 6 }}>
        {icon}<Caps size={9}>{label}</Caps>
      </div>
      <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 26, color: color || T.iron900, ...mono }}>{value}</div>
    </IronCard>
  );
}

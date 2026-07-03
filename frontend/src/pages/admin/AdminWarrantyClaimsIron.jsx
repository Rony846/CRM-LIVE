import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ShieldAlert, Loader2, Search, Clock, CheckCircle2, AlertTriangle,
  XCircle, Truck, FileText, ChevronRight, MessageSquare, Paperclip,
  ExternalLink, Package, Send, X, Eye,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, LIGHT_VARS, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

/* Iron Console conversion of AdminWarrantyClaims — drop-in replacement.
   Preserves every endpoint, filter, search, action, dialog and empty/loading state
   from the original; only the presentation moves to the Iron Console kit. */

const STATUS_META = {
  submitted:              { label: 'Submitted',              tone: 'info' },
  under_review:           { label: 'Under Review',           tone: 'violet' },
  info_requested:         { label: 'Info Requested',         tone: 'warn' },
  approved:               { label: 'Approved',               tone: 'ok' },
  replacement_dispatched: { label: 'Replacement Dispatched', tone: 'bad' },
  closed:                 { label: 'Closed',                 tone: 'slate' },
  rejected:               { label: 'Rejected',               tone: 'bad' },
};

const STATUS_FILTERS = [
  { id: 'all',                    label: 'All' },
  { id: 'open',                   label: 'Open' },
  { id: 'submitted',              label: 'New' },
  { id: 'under_review',           label: 'In Review' },
  { id: 'info_requested',         label: 'Info Pending' },
  { id: 'approved',               label: 'Approved' },
  { id: 'replacement_dispatched', label: 'Dispatched' },
  { id: 'closed',                 label: 'Closed' },
  { id: 'rejected',               label: 'Rejected' },
];

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };

const statusBadge = (status) => {
  const meta = STATUS_META[status] || STATUS_META.submitted;
  return <span style={badgeStyle(meta.tone)}>{meta.label}</span>;
};

function SlaBadge({ claim }) {
  if (!claim) return null;
  if (claim.sla_breached) return (
    <span style={{ ...badgeStyle('bad'), display: 'inline-flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={10} /> Breached</span>
  );
  if (!claim.created_at) return null;
  const ageDays = Math.floor((Date.now() - new Date(claim.created_at).getTime()) / 86400000);
  if (ageDays >= 5) return <span style={badgeStyle('warn')}>Urgent · {ageDays}d</span>;
  if (ageDays >= 3) return <span style={badgeStyle('warn')}>{ageDays}d</span>;
  return <span style={badgeStyle('ok')}>Fresh · {ageDays}d</span>;
}

export default function AdminWarrantyClaims() {
  const { token } = useAuth();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('open');
  const [sla, setSla] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchClaims = useCallback(async () => {
    try {
      setLoading(true);
      const query = {};
      if (filter !== 'all') query.status = filter;
      if (sla) query.sla = sla;
      const resp = await axios.get(`${API}/admin/warranty-claims`, {
        headers: { Authorization: `Bearer ${token}` },
        params: query,
      });
      setClaims(resp.data.claims || []);
      setStats(resp.data.stats || {});
    } catch (err) {
      console.error(err);
      toast.error('Failed to load warranty claims');
    } finally {
      setLoading(false);
    }
  }, [token, filter, sla]);

  useEffect(() => { if (token) fetchClaims(); }, [token, fetchClaims]);

  useEffect(() => {
    const id = params.get('id');
    if (id && claims.length > 0 && !selected) {
      const found = claims.find(c => c.id === id);
      if (found) setSelected(found);
    }
  }, [params, claims, selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return claims;
    const q = search.trim().toLowerCase();
    return claims.filter(c =>
      (c.claim_number || '').toLowerCase().includes(q) ||
      (c.dealer_name || '').toLowerCase().includes(q) ||
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.customer_phone || '').toLowerCase().includes(q) ||
      (c.serial_number || '').toLowerCase().includes(q) ||
      (c.product_name || '').toLowerCase().includes(q)
    );
  }, [claims, search]);

  const headers = ['SLA', 'CLAIM', 'STATUS', 'DEALER', 'CUSTOMER / PRODUCT', 'ISSUE', ''];

  const filterBtn = (active) => ({
    padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: T.mono, fontSize: 11,
    letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 500,
    border: `1px solid ${active ? T.orange : T.iron200}`,
    background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700,
  });

  return (
    <IronShell title="Warranty Claims" subtitle={`${(stats.total || 0).toLocaleString('en-IN')} CLAIMS · DEALER PORTAL`} onRefresh={fetchClaims}>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard icon={ShieldAlert}   label="Total"           value={stats.total}                  color={T.orange} />
        <StatCard icon={Clock}         label="Open"            value={stats.open}                   color={T.blue} />
        <StatCard icon={FileText}      label="New (submitted)" value={stats.submitted}              color="#6D4AB0" />
        <StatCard icon={Truck}         label="Dispatched"      value={stats.replacement_dispatched} color={T.orangeDeep} />
        <StatCard icon={AlertTriangle} label="SLA Breached"    value={stats.breached}               color={T.rose} />
      </div>

      {/* Filters + search */}
      <IronCard style={{ marginBottom: 16 }} pad={14}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 440 }}>
            <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 10, top: 9 }} />
            <input
              placeholder="Search claim no., dealer, customer, S/N, product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 30 }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {STATUS_FILTERS.map(f => (
            <button key={f.id}
              onClick={() => { setFilter(f.id); setSla(null); }}
              style={filterBtn(filter === f.id && !sla)}>
              {f.label}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: T.iron200, margin: '0 6px' }} />
          <button
            onClick={() => { setSla(sla === 'breached' ? null : 'breached'); setFilter('all'); }}
            style={{
              padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: T.mono, fontSize: 11,
              letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 5,
              border: `1px solid ${sla === 'breached' ? T.rose : '#F6D8BA'}`,
              background: sla === 'breached' ? T.rose : '#FDEEE6', color: sla === 'breached' ? '#fff' : T.rose,
            }}>
            <AlertTriangle size={12} /> SLA Breached Only
          </button>
        </div>
      </IronCard>

      {/* Claims table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          <ShieldAlert size={15} color={T.orange} />
          <Caps size={10} color={T.iron700}>
            {loading ? 'Loading…' : (filtered.length === 0 ? 'No claims found' : `${filtered.length} ${filtered.length === 1 ? 'claim' : 'claims'}`)}
          </Caps>
        </div>

        {loading && claims.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 240 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {headers.map((h, i) => <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
              </tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>No claims match this filter.</td></tr>
                )}
                {filtered.map(c => (
                  <tr key={c.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer', background: c.sla_breached ? '#FEF6F1' : 'transparent' }} onClick={() => setSelected(c)}>
                    <td style={tdCell}><SlaBadge claim={c} /></td>
                    <td style={tdCell}>
                      <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{c.claim_number}</div>
                      <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{c.created_at?.slice(0, 10)}</div>
                      {c.out_of_warranty && <span style={{ ...badgeStyle('warn'), marginTop: 4 }}>OOW</span>}
                    </td>
                    <td style={tdCell}>{statusBadge(c.status)}</td>
                    <td style={tdCell}>
                      <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{c.dealer_name}</div>
                    </td>
                    <td style={{ ...tdCell, maxWidth: 240 }}>
                      <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{c.customer_name}</div>
                      <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{c.customer_phone} · {c.customer_city || '—'}</div>
                      <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{c.product_name} · S/N <span style={mono}>{c.serial_number}</span></div>
                    </td>
                    <td style={{ ...tdCell, maxWidth: 300 }}>
                      <span style={{ ...badgeStyle('bad'), marginBottom: 4 }}>{(c.issue_category || '').replace('_', ' ')}</span>
                      <div style={{ fontSize: 11, color: T.iron500, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', maxWidth: 280 }}>{c.issue_description}</div>
                    </td>
                    <td style={{ ...tdCell, textAlign: 'right' }}>
                      <ChevronRight size={16} color={T.iron400} style={{ display: 'inline' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </IronCard>

      {/* Detail drawer with admin actions */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0" style={{ background: T.white, color: T.iron900, borderLeft: `1px solid ${T.iron200}` }}>
          <div style={LIGHT_VARS}>
            {selected && (
              <AdminClaimDetail
                claim={selected}
                token={token}
                onClose={() => setSelected(null)}
                onAction={() => { fetchClaims(); setSelected(null); }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </IronShell>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <IronCard style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: color + '1A', color }}><Icon size={18} /></div>
      <div>
        <Caps size={8.5} style={{ display: 'block' }}>{label}</Caps>
        <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.iron900 }}>{value || 0}</div>
      </div>
    </IronCard>
  );
}

function AdminClaimDetail({ claim, token, onClose, onAction }) {
  const [actionDialog, setActionDialog] = useState(null);   // 'review' | 'request-info' | 'approve' | 'reject' | 'dispatch' | 'reverse-pickup'

  const tbBtn = (bg, outline) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6, padding: '7px 12px', cursor: 'pointer',
    fontFamily: T.headline, fontWeight: 700, fontSize: 12,
    border: outline ? `1px solid ${T.iron200}` : 'none',
    background: outline ? T.white : bg, color: outline ? T.iron700 : '#fff',
  });

  return (
    <div>
      <SheetHeader className="p-0">
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <SheetTitle asChild>
            <div>
              <div style={{ ...mono, fontSize: 15, fontWeight: 700, color: T.iron900 }}>{claim.claim_number}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                {statusBadge(claim.status)}
                {claim.sla_breached && <span style={{ ...badgeStyle('bad'), display: 'inline-flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={10} /> SLA Breached</span>}
              </div>
            </div>
          </SheetTitle>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.iron500, padding: 4 }}><X size={16} /></button>
        </div>
      </SheetHeader>

      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Action toolbar — varies by status */}
        <IronCard style={{ background: '#FEF8F2', borderColor: '#F6D8BA', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {claim.status === 'submitted' && (
            <button onClick={() => setActionDialog('review')} style={tbBtn('#6D4AB0')}><Eye size={14} /> Start Review</button>
          )}
          {(claim.status === 'submitted' || claim.status === 'under_review') && (
            <>
              <button onClick={() => setActionDialog('request-info')} style={tbBtn('#B45309')}><MessageSquare size={14} /> Request Info</button>
              <button onClick={() => setActionDialog('approve')} style={tbBtn(T.green)}><CheckCircle2 size={14} /> Approve</button>
              <button onClick={() => setActionDialog('reject')} style={tbBtn(T.rose)}><XCircle size={14} /> Reject</button>
            </>
          )}
          {claim.status === 'approved' && (
            <button onClick={() => setActionDialog('dispatch')} style={tbBtn(T.orange)}><Truck size={14} /> Record Dispatch</button>
          )}
          {!claim.reverse_pickup_initiated && claim.status !== 'closed' && claim.status !== 'rejected' && (
            <button onClick={() => setActionDialog('reverse-pickup')} style={tbBtn(null, true)}><Package size={14} /> Init Reverse Pickup</button>
          )}
          {['closed', 'rejected'].includes(claim.status) && (
            <span style={{ fontSize: 12.5, color: T.iron500, fontStyle: 'italic' }}>Claim is closed — no further actions available.</span>
          )}
        </IronCard>

        {/* Product/Customer + issue */}
        <Section title="Product & Customer">
          <Row label="Product"        value={claim.product_name} />
          <Row label="Serial No."     value={claim.serial_number} mono />
          <Row label="Purchase"       value={claim.purchase_date?.slice(0, 10)} mono />
          <Row label="Warranty until" value={claim.warranty_expires?.slice(0, 10)} mono />
          <Row label="Dealer"         value={claim.dealer_name} />
          <Row label="Customer"       value={claim.customer_name} />
          <Row label="Phone"          value={claim.customer_phone} mono />
          <Row label="Email"          value={claim.customer_email || '—'} mono />
          <Row label="Address"        value={[claim.customer_address, claim.customer_city, claim.customer_state, claim.customer_pincode].filter(Boolean).join(', ') || '—'} />
        </Section>

        <Section title="Issue Reported">
          <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 12 }}>
            <span style={{ ...badgeStyle('bad'), marginBottom: 8 }}>{(claim.issue_category || '').replace('_', ' ')}</span>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: T.iron700, lineHeight: 1.55, marginTop: 6 }}>{claim.issue_description}</div>
          </div>
          {(claim.attachments || []).length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {claim.attachments.map((a, i) => (
                <a key={i} href={a} target="_blank" rel="noreferrer"
                   style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, background: T.white, border: `1px solid ${T.iron200}`, color: T.iron700, fontSize: 11, textDecoration: 'none' }}>
                  <Paperclip size={12} /> Photo {i + 1} <ExternalLink size={12} color={T.iron400} />
                </a>
              ))}
            </div>
          )}
        </Section>

        {(claim.replacement_serial || claim.replacement_tracking_id) && (
          <Section title="Replacement Dispatch">
            <Row label="Replacement S/N" value={claim.replacement_serial || '—'} mono />
            <Row label="Tracking ID"     value={claim.replacement_tracking_id || '—'} mono />
            <Row label="Dispatched on"   value={claim.replacement_dispatched_at?.slice(0, 10) || '—'} mono />
          </Section>
        )}
        {claim.reverse_pickup_initiated && (
          <Section title="Reverse Pickup">
            <Row label="Tracking" value={claim.reverse_pickup_tracking_id || 'Pending'} mono />
          </Section>
        )}
        {claim.rejection_reason && (
          <Section title="Rejection Reason">
            <div style={{ fontSize: 12.5, color: T.iron700, background: '#FDEEE6', border: '1px solid #F6D8BA', borderRadius: 8, padding: 12 }}>
              {claim.rejection_reason}
            </div>
          </Section>
        )}

        <Section title={`Status History (${(claim.status_history || []).length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(claim.status_history || []).map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <div style={{ width: 8, height: 8, borderRadius: 999, marginTop: 5, flexShrink: 0, background: T.orange }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {statusBadge(h.status)}
                    <span style={{ ...mono, fontSize: 10.5, color: T.iron400 }}>{h.at?.slice(0, 19).replace('T', ' ')}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.iron500, marginTop: 3 }}>by {h.by_name || h.by_role || 'system'} ({h.by_role || 'system'})</div>
                  {h.notes && <div style={{ fontSize: 12, color: T.iron700, marginTop: 6, whiteSpace: 'pre-wrap' }}>{h.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <AdminActionDialog
        action={actionDialog}
        claim={claim}
        token={token}
        onClose={() => setActionDialog(null)}
        onDone={() => { setActionDialog(null); onAction(); }}
      />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <Caps size={9} style={{ display: 'block', marginBottom: 8 }}>{title}</Caps>
      {children}
    </div>
  );
}

function Row({ label, value, mono: isMono }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12.5, marginBottom: 6 }}>
      <span style={{ color: T.iron400, minWidth: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ color: T.iron900, flex: 1, ...(isMono ? mono : {}) }}>{value || '—'}</span>
    </div>
  );
}

function AdminActionDialog({ action, claim, token, onClose, onDone }) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [extra, setExtra] = useState({});  // dispatch fields, reject reason, etc.

  useEffect(() => { setNotes(''); setExtra({}); }, [action]);

  if (!action) return null;

  const config = {
    'review':         { title: 'Start Review',            endpoint: 'review',               tone: 'bg-violet-500',  cta: 'Move to Under Review' },
    'request-info':   { title: 'Request Information',      endpoint: 'request-info',         tone: 'bg-amber-500',   cta: 'Send Info Request' },
    'approve':        { title: 'Approve Claim',            endpoint: 'approve',              tone: 'bg-emerald-500', cta: 'Approve Claim' },
    'reject':         { title: 'Reject Claim',             endpoint: 'reject',               tone: 'bg-rose-500',    cta: 'Reject Claim' },
    'dispatch':       { title: 'Record Dispatch',          endpoint: 'dispatch-replacement', tone: 'bg-primary',     cta: 'Record Dispatch' },
    'reverse-pickup': { title: 'Initiate Reverse Pickup',  endpoint: 'init-reverse-pickup',  tone: 'bg-primary',     cta: 'Confirm' },
  }[action];

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = { notes: notes.trim() || null, ...extra };
      // Required field validation
      if (action === 'request-info' && (!notes || notes.trim().length < 5)) {
        toast.error('Please describe what information you need'); setSubmitting(false); return;
      }
      if (action === 'reject' && (!extra.rejection_reason || extra.rejection_reason.trim().length < 5)) {
        toast.error('Rejection reason is required'); setSubmitting(false); return;
      }
      await axios.post(
        `${API}/admin/warranty-claims/${claim.id}/${config.endpoint}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(`${config.title} — done`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">{config.title} — {claim.claim_number}</DialogTitle>
        </DialogHeader>

        {action === 'approve' && (
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Resolution Type *</label>
            <Select value={extra.resolution_type || 'replacement'} onValueChange={(v) => setExtra(e => ({ ...e, resolution_type: v }))}>
              <SelectTrigger className="mt-1 bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="replacement" className="text-foreground">Replacement</SelectItem>
                <SelectItem value="repair" className="text-foreground">Repair</SelectItem>
                <SelectItem value="credit_note" className="text-foreground">Credit Note</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {action === 'reject' && (
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Rejection Reason * (customer will see this)</label>
            <Textarea
              value={extra.rejection_reason || ''}
              onChange={(e) => setExtra(ex => ({ ...ex, rejection_reason: e.target.value }))}
              placeholder="Physical damage from mishandling — outside warranty terms."
              className="mt-1 bg-background border-border text-foreground min-h-[70px]"
            />
          </div>
        )}

        {action === 'dispatch' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Replacement S/N</label>
              <Input value={extra.replacement_serial || ''} onChange={(e) => setExtra(ex => ({ ...ex, replacement_serial: e.target.value }))}
                     className="mt-1 bg-background border-border text-foreground font-mono" placeholder="MG2604128" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Dispatch / AWB ID</label>
              <Input value={extra.replacement_dispatch_id || ''} onChange={(e) => setExtra(ex => ({ ...ex, replacement_dispatch_id: e.target.value }))}
                     className="mt-1 bg-background border-border text-foreground font-mono" placeholder="MG-D-20260524-00001" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Tracking ID</label>
              <Input value={extra.replacement_tracking_id || ''} onChange={(e) => setExtra(ex => ({ ...ex, replacement_tracking_id: e.target.value }))}
                     className="mt-1 bg-background border-border text-foreground font-mono" placeholder="Bigship/Delhivery tracking" />
            </div>
          </div>
        )}

        {action === 'reverse-pickup' && (
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Reverse Pickup Tracking ID</label>
            <Input value={extra.reverse_pickup_tracking_id || ''} onChange={(e) => setExtra(ex => ({ ...ex, reverse_pickup_tracking_id: e.target.value }))}
                   className="mt-1 bg-background border-border text-foreground font-mono" placeholder="Optional — leave blank if pending" />
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Notes {action === 'request-info' && '* (this is what the dealer will see)'}
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={action === 'request-info' ? 'Please share clearer photos of the front panel and the bottom of the unit.' : 'Internal notes (optional)'}
            className="mt-1 bg-background border-border text-foreground min-h-[80px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className={`${config.tone} hover:opacity-90 text-white`}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" /> {config.cta}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

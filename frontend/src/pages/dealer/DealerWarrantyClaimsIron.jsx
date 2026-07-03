import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ShieldAlert, Loader2, Plus, Search, Filter, Clock, CheckCircle2,
  AlertTriangle, XCircle, Truck, FileText, ChevronRight, Paperclip,
  Send, X, ExternalLink, ShieldCheck,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

// One source of truth for status display (icon + Iron badge tone).
const STATUS_META = {
  submitted:              { label: 'Submitted',               icon: FileText,      tone: 'info',   order: 1 },
  under_review:           { label: 'Under Review',            icon: Loader2,       tone: 'violet', order: 2 },
  info_requested:         { label: 'Info Requested',          icon: AlertTriangle, tone: 'warn',   order: 3, needsAction: true },
  approved:               { label: 'Approved',                icon: CheckCircle2,  tone: 'ok',     order: 4 },
  replacement_dispatched: { label: 'Replacement Dispatched',  icon: Truck,         tone: 'bad',    order: 5, needsAction: true },
  closed:                 { label: 'Closed',                  icon: CheckCircle2,  tone: 'slate',  order: 6 },
  rejected:               { label: 'Rejected',                icon: XCircle,       tone: 'bad',    order: 6 },
};

const ISSUE_CATEGORIES = [
  { id: 'dead_unit',       label: 'Dead Unit — no power / not turning on' },
  { id: 'reduced_backup',  label: 'Reduced Backup — battery not lasting as before' },
  { id: 'physical_damage', label: 'Physical Damage — case crack, bulging, leak' },
  { id: 'firmware',        label: 'Firmware / Display Issue' },
  { id: 'noise',           label: 'Abnormal Noise / Vibration' },
  { id: 'leak',            label: 'Acid Leak / Corrosion' },
  { id: 'other',           label: 'Other (describe below)' },
];

const FILTERS = [
  { id: 'all',    label: 'All' },
  { id: 'open',   label: 'Open' },
  { id: 'closed', label: 'Closed' },
  { id: 'info_requested', label: 'Needs Response' },
];

const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none' };

export default function DealerWarrantyClaims() {
  const { token } = useAuth();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [fileOpen, setFileOpen] = useState(false);

  const fetchClaims = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await axios.get(`${API}/dealer/warranty-claims`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filter === 'all' ? {} : { status: filter },
      });
      setClaims(resp.data.claims || []);
      setStats(resp.data.stats || {});
    } catch (err) {
      console.error(err);
      toast.error('Failed to load warranty claims');
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => { if (token) fetchClaims(); }, [token, fetchClaims]);

  // Deep-link support: ?id=<claim_id> opens detail; ?warranty_id=<id> opens File-New modal pre-filled
  useEffect(() => {
    const id = params.get('id');
    if (id && claims.length > 0 && !selected) {
      const found = claims.find(c => c.id === id);
      if (found) setSelected(found);
    }
    if (params.get('warranty_id') && !fileOpen) {
      setFileOpen(true);
    }
  }, [params, claims, selected, fileOpen]);

  const filtered = (claims || []).filter(c => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (c.claim_number || '').toLowerCase().includes(q) ||
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.customer_phone || '').toLowerCase().includes(q) ||
      (c.product_name || '').toLowerCase().includes(q) ||
      (c.serial_number || '').toLowerCase().includes(q)
    );
  });

  const headerRight = (
    <button onClick={() => setFileOpen(true)} style={primaryBtn}>
      <Plus size={14} /> File New Claim
    </button>
  );

  return (
    <IronShell title="Warranty Claims" subtitle="DEALER · WARRANTY CLAIMS" onRefresh={fetchClaims} headerRight={headerRight}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* KPI tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <StatCard icon={ShieldAlert}   label="Total Claims" value={stats.total}      tone="bad" />
          <StatCard icon={Clock}         label="Open"         value={stats.open}       tone="info" />
          <StatCard icon={AlertTriangle} label="SLA Breached" value={stats.breached}   tone="warn" />
          <StatCard icon={CheckCircle2}  label="Closed (30d)" value={stats.closed_30d} tone="ok" />
        </div>

        {/* Filter + search */}
        <IronCard pad={14}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', flex: 1 }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 380 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.iron400 }} />
                <input
                  placeholder="Search claim no., customer, phone, S/N…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ ...inputStyle, width: '100%', paddingLeft: 30 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={13} color={T.iron400} />
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    style={{
                      padding: '6px 11px', fontSize: 10.5, borderRadius: 6, cursor: 'pointer',
                      fontFamily: T.mono, letterSpacing: '.06em', textTransform: 'uppercase',
                      border: `1px solid ${filter === f.id ? T.orange : T.iron200}`,
                      background: filter === f.id ? T.orange : T.white,
                      color: filter === f.id ? '#fff' : T.iron700,
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </IronCard>

        {/* Claims list */}
        <IronCard pad={0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
            <ShieldAlert size={15} color={T.orange} />
            <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>
              {loading ? 'Loading…' : (filtered.length === 0 ? 'No claims found' : `${filtered.length} ${filtered.length === 1 ? 'claim' : 'claims'}`)}
            </span>
          </div>

          {loading && claims.length === 0 ? (
            <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
              <Loader2 size={28} className="animate-spin" color={T.orange} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '56px 20px', textAlign: 'center', color: T.iron500 }}>
              <ShieldCheck size={44} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ color: T.iron900, marginBottom: 4, fontFamily: T.headline, fontWeight: 600 }}>No warranty claims yet</p>
              <p style={{ fontSize: 13 }}>When a customer's product fails, file a claim here and we'll process it within 7 working days.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {['Claim #', 'Product / Serial', 'Customer', 'Status', 'Age', ''].map((h, i) => (
                    <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <ClaimRow key={c.id} c={c} onClick={() => setSelected(c)} />
                ))}
              </tbody>
            </table>
          )}
        </IronCard>
      </div>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-popover border-l border-border overflow-y-auto p-0">
          {selected && (
            <ClaimDetailDealer
              claim={selected}
              token={token}
              onClose={() => setSelected(null)}
              onAction={() => { fetchClaims(); setSelected(null); }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* File new claim modal */}
      <FileClaimDialog
        open={fileOpen}
        onClose={() => setFileOpen(false)}
        token={token}
        onCreated={() => { setFileOpen(false); fetchClaims(); }}
      />
    </IronShell>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  const bg = badgeStyle(tone).background;
  const fg = badgeStyle(tone).color;
  return (
    <IronCard pad={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ padding: 9, borderRadius: 8, background: bg, color: fg, display: 'grid', placeItems: 'center' }}>
          <Icon size={18} />
        </div>
        <div>
          <Caps size={9} color={T.iron400}>{label}</Caps>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.iron900, ...mono }}>{value || 0}</div>
        </div>
      </div>
    </IronCard>
  );
}

function ClaimRow({ c, onClick }) {
  const meta = STATUS_META[c.status] || STATUS_META.submitted;
  const Icon = meta.icon;
  const ageDays = c.created_at ? Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000) : 0;
  const tBadge = badgeStyle(meta.tone);
  return (
    <tr className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }} onClick={onClick}>
      <td style={tdCell}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: 7, borderRadius: 8, background: tBadge.background, color: tBadge.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon size={16} className={c.status === 'under_review' ? 'animate-spin' : ''} />
          </div>
          <span style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{c.claim_number}</span>
        </div>
      </td>
      <td style={tdCell}>
        <div style={{ color: T.iron900 }}>{c.product_name}</div>
        <div style={{ ...mono, fontSize: 11, color: T.iron500 }}>S/N {c.serial_number}</div>
      </td>
      <td style={tdCell}>
        <div style={{ color: T.iron900 }}>{c.customer_name}</div>
        <div style={{ ...mono, fontSize: 11, color: T.iron500 }}>{c.customer_phone}</div>
      </td>
      <td style={tdCell}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <span style={tBadge}>{meta.label}</span>
          {c.sla_breached && <span style={badgeStyle('bad')}>SLA Breached</span>}
          {c.out_of_warranty && <span style={badgeStyle('warn')}>Out of warranty</span>}
        </div>
      </td>
      <td style={{ ...tdCell, ...mono, whiteSpace: 'nowrap' }}>{ageDays === 0 ? 'Today' : `${ageDays}d ago`}</td>
      <td style={{ ...tdCell, textAlign: 'right' }}><ChevronRight size={15} color={T.iron400} /></td>
    </tr>
  );
}

function ClaimDetailDealer({ claim, token, onClose, onAction }) {
  const meta = STATUS_META[claim.status] || STATUS_META.submitted;
  const [response, setResponse] = useState('');
  const [posting, setPosting] = useState(false);

  const submitResponse = async () => {
    if (response.trim().length < 5) {
      toast.error('Response too short');
      return;
    }
    setPosting(true);
    try {
      await axios.post(`${API}/dealer/warranty-claims/${claim.id}/respond`, { response: response.trim() }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Response sent to support');
      onAction();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send response');
    } finally {
      setPosting(false);
    }
  };

  const confirmReplacement = async () => {
    if (!window.confirm('Confirm that the replacement has been received and delivered to the customer?')) return;
    setPosting(true);
    try {
      await axios.post(`${API}/dealer/warranty-claims/${claim.id}/confirm-replacement`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Claim closed — thank you!');
      onAction();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to confirm');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      <SheetHeader className="px-6 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <SheetTitle className="text-foreground flex items-center gap-3">
            <div className={`p-2 rounded-lg ring-1 ${statusRing(claim.status)}`}>
              <meta.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-mono text-base">{claim.claim_number}</div>
              <Badge className={`${statusRing(claim.status)} font-mono text-[10px] uppercase tracking-wide mt-1`}>{meta.label}</Badge>
            </div>
          </SheetTitle>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
      </SheetHeader>

      <div className="px-6 py-5 space-y-5">
        {/* Action banners */}
        {claim.status === 'info_requested' && (
          <div className="border border-amber-400/30 bg-amber-400/[0.06] rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-foreground">Additional Information Requested</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Our team has asked for more details before processing. Please respond below.
                </div>
              </div>
            </div>
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Provide the requested information…"
              className="bg-background border-border text-foreground min-h-[80px] mb-2"
            />
            <Button onClick={submitResponse} disabled={posting} className="bg-primary text-primary-foreground">
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" /> Send Response</>}
            </Button>
          </div>
        )}

        {claim.status === 'replacement_dispatched' && (
          <div className="border border-primary/30 bg-primary/[0.06] rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <Truck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-foreground">Replacement Dispatched</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Confirm once you've received the replacement and handed it to the customer.
                </div>
              </div>
            </div>
            <Button onClick={confirmReplacement} disabled={posting} className="bg-emerald-500 hover:bg-emerald-600 text-white">
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm Replacement Received</>}
            </Button>
          </div>
        )}

        {claim.status === 'rejected' && claim.rejection_reason && (
          <div className="border border-rose-500/30 bg-rose-500/[0.06] rounded-lg p-4">
            <div className="font-medium text-foreground mb-1">Rejection Reason</div>
            <div className="text-sm text-foreground/85">{claim.rejection_reason}</div>
          </div>
        )}

        {/* Identity */}
        <Section title="Product & Customer">
          <Row label="Product" value={claim.product_name} />
          <Row label="Serial No." value={claim.serial_number} mono />
          <Row label="Purchase" value={claim.purchase_date?.slice(0, 10)} mono />
          <Row label="Warranty until" value={claim.warranty_expires?.slice(0, 10)} mono />
          <Row label="Customer" value={claim.customer_name} />
          <Row label="Phone" value={claim.customer_phone} mono />
          <Row label="Address" value={[claim.customer_address, claim.customer_city, claim.customer_state, claim.customer_pincode].filter(Boolean).join(', ') || '—'} />
        </Section>

        {/* Issue */}
        <Section title="Issue Reported">
          <div className="text-sm text-foreground/90 bg-muted/30 rounded-md p-3 border border-border">
            <Badge className="bg-primary/15 text-primary ring-1 ring-primary/25 mb-2 font-mono text-[10px] uppercase">
              {(claim.issue_category || '').replace('_', ' ')}
            </Badge>
            <div className="whitespace-pre-wrap">{claim.issue_description}</div>
          </div>
          {(claim.attachments || []).length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Attachments</div>
              <div className="flex flex-wrap gap-2">
                {claim.attachments.map((a, i) => (
                  <a key={i} href={a} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-foreground hover:bg-accent text-xs border border-border">
                    <Paperclip className="w-3 h-3" /> Photo {i + 1} <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Replacement info if dispatched */}
        {(claim.replacement_serial || claim.replacement_tracking_id) && (
          <Section title="Replacement Details">
            <Row label="Replacement S/N" value={claim.replacement_serial || '—'} mono />
            <Row label="Tracking ID"       value={claim.replacement_tracking_id || '—'} mono />
            <Row label="Dispatched on"     value={claim.replacement_dispatched_at?.slice(0, 10) || '—'} mono />
          </Section>
        )}

        {/* Reverse pickup info */}
        {claim.reverse_pickup_initiated && (
          <Section title="Reverse Pickup (Defective Unit)">
            <Row label="Tracking" value={claim.reverse_pickup_tracking_id || 'Pending'} mono />
          </Section>
        )}

        {/* Timeline */}
        <Section title={`Status History (${(claim.status_history || []).length})`}>
          <div className="space-y-2">
            {(claim.status_history || []).map((h, i) => {
              const hMeta = STATUS_META[h.status] || STATUS_META.submitted;
              return (
                <div key={i} className="flex gap-3 p-3 rounded-md bg-muted/20 border border-border/60">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusDot(h.status)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${statusRing(h.status)} font-mono text-[10px] uppercase tracking-wide`}>{hMeta.label}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{h.at?.slice(0, 19).replace('T', ' ')}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      by {h.by_name || h.by_role || 'system'}
                    </div>
                    {h.notes && <div className="text-sm text-foreground/85 mt-2 whitespace-pre-wrap">{h.notes}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}

// Dark-theme ring classes for the (portal-rendered) detail drawer, keyed by status.
function statusRing(status) {
  const map = {
    submitted: 'bg-sky-400/15 text-sky-400 ring-sky-400/25',
    under_review: 'bg-violet-400/15 text-violet-400 ring-violet-400/25',
    info_requested: 'bg-amber-400/15 text-amber-400 ring-amber-400/25',
    approved: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
    replacement_dispatched: 'bg-primary/15 text-primary ring-primary/25',
    closed: 'bg-muted text-muted-foreground',
    rejected: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',
  };
  return map[status] || map.submitted;
}
function statusDot(status) {
  return (statusRing(status).split(' ')[0]);
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground w-32 text-xs">{label}</span>
      <span className={`text-foreground flex-1 ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}

function FileClaimDialog({ open, onClose, token, onCreated }) {
  const [params] = useSearchParams();
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    warranty_registration_id: '',
    issue_category: 'dead_unit',
    issue_description: '',
  });
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm({
      warranty_registration_id: params.get('warranty_id') || '',
      issue_category: 'dead_unit',
      issue_description: '',
    });
    setFiles([]);
    (async () => {
      try {
        setLoading(true);
        // Pull dealer's warranty registrations for the picker
        const resp = await axios.get(`${API}/dealer/warranty-registrations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setWarranties(resp.data.registrations || resp.data || []);
      } catch (err) {
        console.error('Failed to load warranty registrations', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, token]);

  const submit = async () => {
    if (!form.warranty_registration_id) {
      toast.error('Pick a warranty registration to claim against');
      return;
    }
    if (form.issue_description.trim().length < 10) {
      toast.error('Please describe the issue (min 10 chars)');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('warranty_registration_id', form.warranty_registration_id);
      fd.append('issue_category', form.issue_category);
      fd.append('issue_description', form.issue_description.trim());
      files.forEach(f => fd.append('attachments', f));
      await axios.post(`${API}/dealer/warranty-claims`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Claim filed. Our team will review within 7 working days.');
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to file claim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border border-border max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" /> File a Warranty Claim
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Product (from your warranty registrations) *</label>
            {loading ? (
              <div className="mt-1 text-sm text-muted-foreground py-2">Loading…</div>
            ) : warranties.length === 0 ? (
              <div className="mt-1 text-sm text-muted-foreground py-2 px-3 bg-muted/30 rounded-md border border-border">
                You have no warranty registrations yet. Please register the warranty first under <a href="/dealer/warranty" className="text-primary underline">Warranty Registration</a>.
              </div>
            ) : (
              <Select value={form.warranty_registration_id} onValueChange={(v) => setForm(f => ({ ...f, warranty_registration_id: v }))}>
                <SelectTrigger className="mt-1 bg-background border-border text-foreground">
                  <SelectValue placeholder="Pick a registered product…" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border max-h-60 overflow-y-auto">
                  {warranties.map(w => (
                    <SelectItem key={w.id} value={w.id} className="text-foreground">
                      <div className="flex flex-col">
                        <span>{w.product_name} — {w.customer_name}</span>
                        <span className="text-xs text-muted-foreground font-mono">S/N {w.serial_number} · {w.customer_phone}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Issue Category *</label>
            <Select value={form.issue_category} onValueChange={(v) => setForm(f => ({ ...f, issue_category: v }))}>
              <SelectTrigger className="mt-1 bg-background border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {ISSUE_CATEGORIES.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-foreground">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">What's wrong? *</label>
            <Textarea
              value={form.issue_description}
              onChange={(e) => setForm(f => ({ ...f, issue_description: e.target.value }))}
              placeholder="Customer says inverter trips after 5 minutes of load. Display shows F-02. Already swapped battery — same issue…"
              className="mt-1 bg-background border-border text-foreground min-h-[100px]"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Photos / Videos (recommended)</label>
            <Input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="mt-1 bg-background border-border text-foreground file:text-primary file:bg-primary/10 file:border-0 file:mr-3 file:rounded-md file:px-3 file:py-1.5"
            />
            {files.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">{files.length} file(s) selected</div>
            )}
          </div>

          <div className="bg-muted/30 border border-border rounded-md p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">What happens next:</strong> Our team reviews within 7 working days.
            You'll be notified at every step. If approved, we'll dispatch a replacement and initiate reverse pickup
            of the defective unit.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="bg-primary text-primary-foreground">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" /> File Claim</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

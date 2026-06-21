import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  ArrowLeft, FilePlus2, Phone, Mail, MapPin, Loader2, Download,
  Award, FileText, BadgeCheck,
} from 'lucide-react';

const TIER_THRESHOLDS = { silver: 0, gold: 500000, platinum: 1500000 };
const TIER_TONE = {
  platinum: 'bg-primary/15 text-primary ring-primary/25',
  gold: 'bg-amber-400/15 text-amber-400 ring-amber-400/25',
  silver: 'bg-slate-400/15 text-slate-300 ring-slate-400/25',
};
const STATUS_TONE = {
  approved: 'bg-[#a4d64c]/15 text-[#a4d64c] ring-[#a4d64c]/25',
  active: 'bg-sky-400/15 text-sky-400 ring-sky-400/25',
  pending: 'bg-amber-400/15 text-amber-400 ring-amber-400/25',
  delivered: 'bg-[#a4d64c]/15 text-[#a4d64c] ring-[#a4d64c]/25',
  dispatched: 'bg-sky-400/15 text-sky-400 ring-sky-400/25',
  confirmed: 'bg-primary/15 text-primary ring-primary/25',
  cancelled: 'bg-rose-400/15 text-rose-400 ring-rose-400/25',
};

const inr = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n) || 0);
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—'
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const computeTier = (total) =>
  total >= TIER_THRESHOLDS.platinum ? 'platinum' : total >= TIER_THRESHOLDS.gold ? 'gold' : 'silver';
// Some legacy dealers stored contact_person/address as an object, array, or a
// JSON *string* — render them as readable text instead of raw JSON.
const tryParse = (v) => {
  if (typeof v === 'string') {
    const t = v.trim();
    if (t.startsWith('{') || t.startsWith('[')) { try { return JSON.parse(t); } catch { /* keep */ } }
  }
  return v;
};
const safeText = (v) => {
  v = tryParse(v);
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((x) => (x && (x.name || x.contact_person)) || '').filter(Boolean).join(', ') || '—';
  if (v && typeof v === 'object') return v.name || v.contact_person || '—';
  return '—';
};
const formatAddress = (d) => {
  const a = tryParse(d.address);
  if (a && typeof a === 'object' && !Array.isArray(a)) {
    const parts = [a.line1, a.address_line1, a.line2, a.address_line2, a.city, a.district, a.state, a.pincode]
      .filter((x) => x && typeof x === 'string');
    return parts.length ? [...new Set(parts)].join(', ') : '—';
  }
  const parts = [typeof a === 'string' ? a : null, d.city, d.state, d.pincode].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
};

function Pill({ tone, children }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap ${tone || 'bg-muted text-muted-foreground ring-border'}`}>
      {children}
    </span>
  );
}

export default function DealerProfile() {
  const { dealerId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/admin/dealers/${dealerId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setData(r.data))
      .catch(() => toast.error('Failed to load dealer'))
      .finally(() => setLoading(false));
  }, [dealerId, token]);

  const dealer = data?.dealer || {};
  const party = data?.party || null;
  const ledger = useMemo(() => (Array.isArray(data?.ledger) ? data.ledger : []), [data]);
  const orders = useMemo(() => (Array.isArray(data?.orders) ? data.orders : []), [data]);

  const lifetimeValue = useMemo(
    () => orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (o.total_amount || 0), 0),
    [orders]
  );
  const tier = dealer.tier || computeTier(lifetimeValue);
  const creditLimit = Number(dealer.credit_limit) || 0;
  const outstanding = party?.current_balance ?? (ledger[0]?.running_balance ?? 0);
  const unlimited = creditLimit <= 0;
  const available = unlimited ? null : creditLimit - outstanding;
  const utilization = unlimited || creditLimit === 0 ? 0 : Math.round((outstanding / creditLimit) * 100);
  const overdue = useMemo(() => {
    const now = Date.now();
    return orders
      .filter((o) => o.status !== 'cancelled'
        && !['received', 'verified'].includes(o.payment_status)
        && o.dispatch_due_date && new Date(o.dispatch_due_date).getTime() < now)
      .reduce((s, o) => s + (o.total_amount || 0), 0);
  }, [orders]);

  const createPI = () => {
    if (!party?.id) {
      toast.error('This dealer has no linked party/account yet — cannot pre-fill a PI.');
      return;
    }
    navigate('/quotations/new', {
      state: {
        prefillPartyId: party.id,
        // Dealer's contracted discount (if set) drives dealer-discounted PI line pricing;
        // null falls back to each product's dealer_discount_percent in the form.
        dealerDiscount: (dealer.discount_percent ?? null),
        prefillParty: {
          id: party.id, name: dealer.firm_name, phone: dealer.phone, email: dealer.email,
          gstin: dealer.gst_number, city: dealer.city, state: dealer.state, pincode: dealer.pincode,
        },
      },
    });
  };

  const exportLedgerCsv = () => {
    const rows = [['Date', 'Entry', 'Type', 'Description', 'Debit', 'Credit', 'Balance']];
    ledger.forEach((e) => rows.push([
      e.created_at || '', e.entry_number || '', e.entry_type || '',
      (e.narration || '').replace(/[\n,]/g, ' '),
      e.debit || 0, e.credit || 0, e.running_balance ?? '',
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c)}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${dealer.firm_name || 'dealer'}_ledger.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <DashboardLayout title="Dealer Profile">
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  const initials = (dealer.firm_name || '?').replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'DL';

  return (
    <DashboardLayout title="Dealer Profile">
      <div className="p-6 space-y-4" data-testid="dealer-profile-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => navigate('/admin/dealers')} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dealer Management
          </button>
          <Button onClick={createPI} data-testid="create-pi">
            <FilePlus2 className="h-4 w-4 mr-1" /> Create Proforma Invoice (PI)
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column */}
          <div className="space-y-4">
            {/* Entity Profile */}
            <div className="mg-card rounded-lg border border-border bg-card p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-3">Entity Profile</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">{initials}</div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground leading-tight flex items-center gap-1">
                    {dealer.firm_name || '—'}
                    {dealer.status === 'approved' && <BadgeCheck className="h-4 w-4 text-[#a4d64c]" />}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">{dealer.dealer_code || dealer.id?.slice(0, 8)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={TIER_TONE[tier]}><Award className="h-3 w-3 mr-1 inline" />{tier} Tier</Pill>
                <Pill tone={STATUS_TONE[dealer.status]}>{dealer.status}</Pill>
              </div>
              <div className="mt-3 border-t border-border/60 pt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">GST</span>
                <span className="text-sm font-medium">{dealer.gst_number || '—'}</span>
              </div>
            </div>

            {/* Credit Standing */}
            <div className="mg-card rounded-lg border border-border bg-card p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-2">Credit Standing</p>
              <p className="text-xs text-muted-foreground">Available Credit Limit</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-foreground tabular-nums">{unlimited ? 'Unlimited' : inr(available)}</p>
                {!unlimited && <span className="text-xs text-muted-foreground mb-1">{utilization}% Utilized</span>}
              </div>
              {!unlimited && (
                <div className="mt-2 h-1.5 w-full rounded bg-muted overflow-hidden">
                  <div className={`h-full ${utilization >= 90 ? 'bg-rose-400' : utilization >= 70 ? 'bg-amber-400' : 'bg-[#a4d64c]'}`}
                    style={{ width: `${Math.min(100, Math.max(0, utilization))}%` }} />
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Outstanding</p>
                  <p className="text-sm font-semibold">{inr(outstanding)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Overdue</p>
                  <p className={`text-sm font-semibold ${overdue > 0 ? 'text-rose-400' : 'text-[#a4d64c]'}`}>{inr(overdue)}</p>
                </div>
              </div>
              {!unlimited && <p className="mt-2 text-[11px] text-muted-foreground">Credit limit {inr(creditLimit)}</p>}
            </div>

            {/* Logistics & Contact */}
            <div className="mg-card rounded-lg border border-border bg-card p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-2">Logistics &amp; Contact</p>
              <div className="space-y-1.5 text-sm">
                <p className="font-medium">{safeText(dealer.contact_person)}</p>
                <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {dealer.phone || '—'}</p>
                <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {dealer.email || '—'}</p>
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 mt-0.5" />
                  <span>{formatAddress(dealer)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:col-span-2">
            <h1 className="text-2xl font-bold tracking-tight">Ledger &amp; Operations</h1>
            <p className="text-sm text-muted-foreground mb-4">Comprehensive operational view for {dealer.firm_name}.</p>

            <div className="mg-card rounded-lg border border-border bg-card p-4">
              <Tabs defaultValue="ledger">
                <TabsList>
                  <TabsTrigger value="ledger">Ledger &amp; Payments</TabsTrigger>
                  <TabsTrigger value="orders">Order History</TabsTrigger>
                  <TabsTrigger value="docs">Documents &amp; Contracts</TabsTrigger>
                </TabsList>

                <TabsContent value="ledger" className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Transaction Ledger</p>
                    <Button variant="outline" size="sm" onClick={exportLedgerCsv} disabled={!ledger.length}>
                      <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
                    </Button>
                  </div>
                  {ledger.length === 0 ? (
                    <p className="text-center py-8 text-sm text-muted-foreground">No ledger entries.</p>
                  ) : (
                    <div className="overflow-x-auto"><table className="w-full">
                      <thead><tr className="border-b border-border">
                        {['Date', 'Ref / Type', 'Description', 'Debit (DR)', 'Credit (CR)', 'Balance'].map((h, i) => (
                          <th key={i} className={`py-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {ledger.map((e, i) => (
                          <tr key={e.id || i} className="border-b border-border/60">
                            <td className="py-2.5 text-sm whitespace-nowrap">{fmtDate(e.created_at)}</td>
                            <td className="py-2.5">
                              <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] ring-1 ${e.credit ? 'bg-[#a4d64c]/10 text-[#a4d64c] ring-[#a4d64c]/20' : 'bg-primary/10 text-primary ring-primary/20'}`}>
                                {e.entry_number || (e.entry_type || '').replace(/_/g, ' ') || '—'}
                              </span>
                              <span className="block text-[10px] text-muted-foreground mt-0.5">{(e.entry_type || '').replace(/_/g, ' ')}</span>
                            </td>
                            <td className="py-2.5 text-sm max-w-[240px] truncate">{e.narration || '—'}</td>
                            <td className="py-2.5 text-right font-mono text-sm text-rose-300">{e.debit ? inr(e.debit) : '—'}</td>
                            <td className="py-2.5 text-right font-mono text-sm text-[#a4d64c]">{e.credit ? inr(e.credit) : '—'}</td>
                            <td className="py-2.5 text-right font-mono text-sm">{e.running_balance != null ? inr(e.running_balance) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  )}
                  {ledger.length > 0 && (
                    <p className="mt-3 text-[11px] text-muted-foreground">Showing {ledger.length} most recent entries</p>
                  )}
                </TabsContent>

                <TabsContent value="orders" className="mt-4">
                  {orders.length === 0 ? (
                    <p className="text-center py-8 text-sm text-muted-foreground">No orders yet.</p>
                  ) : (
                    <div className="overflow-x-auto"><table className="w-full">
                      <thead><tr className="border-b border-border">
                        {['Order #', 'Date', 'Items', 'Total', 'Status', 'Payment'].map((h, i) => (
                          <th key={i} className={`py-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {orders.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).map((o, i) => (
                          <tr key={o.id || i} className="border-b border-border/60">
                            <td className="py-2.5 font-mono text-xs">{o.order_number || '—'}</td>
                            <td className="py-2.5 text-sm whitespace-nowrap">{fmtDate(o.created_at)}</td>
                            <td className="py-2.5 text-sm">{(o.items || []).length}</td>
                            <td className="py-2.5 text-right font-mono text-sm">{inr(o.total_amount)}</td>
                            <td className="py-2.5"><Pill tone={STATUS_TONE[o.status]}>{o.status}</Pill></td>
                            <td className="py-2.5 text-xs text-muted-foreground">{(o.payment_status || '').replace(/_/g, ' ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  )}
                </TabsContent>

                <TabsContent value="docs" className="mt-4">
                  <div className="space-y-2">
                    {dealer.status === 'approved' && (
                      <DocRow icon={Award} title="Authorized Dealer Certificate" subtitle="Official MuscleGrid dealer certificate" />
                    )}
                    {orders.filter((o) => o.proforma_number || o.final_invoice_number).map((o) => (
                      <DocRow key={o.id} icon={FileText}
                        title={o.final_invoice_number ? `Invoice ${o.final_invoice_number}` : `Proforma ${o.proforma_number}`}
                        subtitle={`Order ${o.order_number} · ${inr(o.total_amount)}`} />
                    ))}
                    {dealer.status !== 'approved'
                      && orders.filter((o) => o.proforma_number || o.final_invoice_number).length === 0 && (
                        <p className="text-center py-8 text-sm text-muted-foreground">No documents on file yet.</p>
                      )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function DocRow({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 rounded border border-border/60 p-3">
      <div className="h-8 w-8 rounded bg-primary/15 text-primary flex items-center justify-center"><Icon className="h-4 w-4" /></div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

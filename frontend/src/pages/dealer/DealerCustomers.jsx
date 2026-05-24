import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Users, Search, Loader2, Phone, Mail, MapPin, Plus, ShieldCheck,
  AlertTriangle, Ticket as TicketIcon, MessageSquare, Tag, Clock,
  Package, FileText, ChevronRight, Filter, UserPlus, X, Save,
} from 'lucide-react';

const FILTERS = [
  { id: 'all',              label: 'All' },
  { id: 'in_warranty',      label: 'In Warranty' },
  { id: 'has_open_tickets', label: 'Open Tickets' },
  { id: 'recent',           label: 'Recent 30d' },
];

export default function DealerCustomers() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({ total: 0, in_warranty: 0, has_open_tickets: 0, recent: 0 });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);   // customer object opened in drawer
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (search.trim()) params.q = search.trim();
      if (filter !== 'all') params.filter = filter;
      const resp = await axios.get(`${API}/dealer/customers`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setCustomers(resp.data.customers || []);
      setStats(resp.data.stats || {});
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customer book');
    } finally {
      setLoading(false);
    }
  }, [token, search, filter]);

  useEffect(() => {
    if (token) fetchList();
  }, [token, fetchList]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(fetchList, 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  const openDetail = async (c) => {
    setSelected(c);
    setDetail(null);
    setDetailLoading(true);
    try {
      const resp = await axios.get(`${API}/dealer/customers/${c.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDetail(resp.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customer details');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading && customers.length === 0) {
    return (
      <DashboardLayout title="Customer Book">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Customer Book">
      <div className="space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Users}        label="Total Customers" value={stats.total}              tone="text-primary bg-primary/15" />
          <StatCard icon={ShieldCheck}  label="In Warranty"     value={stats.in_warranty}        tone="text-emerald-400 bg-emerald-500/15" />
          <StatCard icon={AlertTriangle} label="Open Tickets"    value={stats.has_open_tickets}   tone="text-amber-400 bg-amber-400/15" />
          <StatCard icon={Clock}        label="Recent (30d)"    value={stats.recent}             tone="text-sky-400 bg-sky-400/15" />
        </div>

        {/* Filter + search bar */}
        <Card className="mg-card border-border">
          <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex flex-col md:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-background border-border text-foreground"
                />
              </div>
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors font-mono uppercase tracking-wide
                      ${filter === f.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <UserPlus className="w-4 h-4 mr-1.5" /> Add Customer
            </Button>
          </CardContent>
        </Card>

        {/* Customer list */}
        <Card className="mg-card border-border">
          <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {customers.length === 0 ? 'No customers yet' : `${customers.length} ${customers.length === 1 ? 'customer' : 'customers'}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {customers.length === 0 ? (
              <EmptyState onAdd={() => setAddOpen(true)} />
            ) : (
              <div className="divide-y divide-border/40">
                {customers.map(c => (
                  <CustomerRow key={c.id} c={c} onClick={() => openDetail(c)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-popover border-l border-border overflow-y-auto p-0">
          {selected && (
            <CustomerDetail
              customer={selected}
              detail={detail}
              loading={detailLoading}
              token={token}
              onClose={() => setSelected(null)}
              onUpdated={async () => { await fetchList(); if (selected) await openDetail(selected); }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Add customer modal */}
      <AddCustomerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        token={token}
        onCreated={() => { setAddOpen(false); fetchList(); }}
      />
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <Card className="mg-card border-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${tone}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold text-foreground">{value || 0}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="py-16 text-center text-muted-foreground">
      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="text-foreground mb-1">Your customer book is empty</p>
      <p className="text-sm">Customers are added automatically when you register a warranty or raise a service ticket.</p>
      <p className="text-sm mb-4">You can also add prospects manually.</p>
      <Button onClick={onAdd} className="bg-primary text-primary-foreground">
        <UserPlus className="w-4 h-4 mr-1.5" /> Add First Customer
      </Button>
    </div>
  );
}

function CustomerRow({ c, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 hover:bg-accent/40 transition-colors flex items-center gap-4 group"
    >
      <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold flex-shrink-0">
        {(c.name || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">{c.name || 'Unnamed'}</span>
          {c.in_warranty_count > 0 && (
            <Badge className="bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25 font-mono text-[9px] uppercase">
              {c.in_warranty_count} in warranty
            </Badge>
          )}
          {c.open_tickets > 0 && (
            <Badge className="bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25 font-mono text-[9px] uppercase">
              {c.open_tickets} open
            </Badge>
          )}
          {(c.tags || []).map(t => (
            <Badge key={t} className="bg-violet-400/15 text-violet-400 ring-1 ring-violet-400/25 font-mono text-[9px] uppercase">{t}</Badge>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1 font-mono"><Phone className="w-3 h-3" />{c.phone}</span>
          {c.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.city}</span>}
          {c.last_contact_at && <span>Last: {c.last_contact_at?.slice(0, 10)}</span>}
        </div>
      </div>
      <div className="text-right text-xs text-muted-foreground flex flex-col items-end gap-1">
        <div className="font-mono"><Package className="w-3 h-3 inline mr-1" />{c.total_products || 0} products</div>
        <ChevronRight className="w-4 h-4 group-hover:text-primary transition-colors" />
      </div>
    </button>
  );
}

function CustomerDetail({ customer, detail, loading, token, onClose, onUpdated }) {
  const [newNote, setNewNote] = useState('');
  const [posting, setPosting] = useState(false);

  const c = detail?.customer || customer;
  const products = detail?.products || [];
  const tickets = detail?.tickets || [];

  const addNote = async () => {
    if (!newNote.trim()) return;
    setPosting(true);
    try {
      await axios.post(`${API}/dealer/customers/${customer.id}/note`, { text: newNote.trim() }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNewNote('');
      toast.success('Note added');
      onUpdated();
    } catch (err) {
      toast.error('Failed to add note');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      <SheetHeader className="px-6 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <SheetTitle className="text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold">
              {(c.name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-lg">{c.name || 'Unnamed'}</div>
              <div className="text-xs text-muted-foreground font-mono">{c.phone}</div>
            </div>
          </SheetTitle>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </SheetHeader>

      <div className="px-6 py-4 space-y-5">
        {/* Identity */}
        <Section title="Identity & Contact">
          <DetailRow icon={Phone} label="Phone" value={c.phone} mono />
          <DetailRow icon={Mail}  label="Email" value={c.email || '—'} />
          <DetailRow icon={MapPin} label="Address" value={[c.address, c.city, c.state, c.pincode].filter(Boolean).join(', ') || '—'} />
          <DetailRow icon={Tag}   label="Tags" value={(c.tags || []).length ? c.tags.join(', ') : '—'} />
          <DetailRow icon={Clock} label="First seen" value={c.first_seen_at?.slice(0, 10) || '—'} mono />
          <DetailRow icon={Clock} label="Last contact" value={c.last_contact_at?.slice(0, 10) || '—'} mono />
        </Section>

        {/* Products */}
        <Section title={`Products Owned (${products.length})`}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto my-4" /> :
            products.length === 0 ? (
              <div className="text-sm text-muted-foreground py-3 text-center">
                No warranty registrations yet. Use the Warranty Registration page to add one.
              </div>
            ) : (
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="border border-border/60 rounded-md p-3 bg-muted/20">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground text-sm">{p.product_name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          S/N {p.serial_number}
                        </div>
                      </div>
                      <Badge className={p.warranty_status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25 font-mono text-[10px] uppercase'
                        : 'bg-muted text-muted-foreground font-mono text-[10px] uppercase'}>
                        {p.warranty_status === 'active' ? 'In Warranty' : 'Expired'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                      <div>Purchased <span className="font-mono text-foreground">{p.purchase_date?.slice(0, 10)}</span></div>
                      <div>Expires <span className="font-mono text-foreground">{p.warranty_expires?.slice(0, 10)}</span></div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/40">
                      <a
                        href={`/dealer/warranty-claims?warranty_id=${p.id}`}
                        className="text-xs text-primary hover:text-primary/80 inline-flex items-center gap-1"
                      >
                        <TicketIcon className="w-3.5 h-3.5" /> File a warranty claim for this product →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </Section>

        {/* Tickets */}
        <Section title={`Service Tickets (${tickets.length})`}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto my-4" /> :
            tickets.length === 0 ? (
              <div className="text-sm text-muted-foreground py-3 text-center">No tickets raised yet.</div>
            ) : (
              <div className="space-y-2">
                {tickets.map(t => (
                  <div key={t.id} className="border border-border/60 rounded-md p-3 bg-muted/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm text-foreground">{t.issue_description}</div>
                      <Badge className={t.status === 'open'
                        ? 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25 font-mono text-[10px] uppercase'
                        : 'bg-muted text-muted-foreground font-mono text-[10px] uppercase'}>
                        {t.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <span className="font-mono">{t.ticket_number}</span>
                      <span>·</span>
                      <span>{t.created_at?.slice(0, 10)}</span>
                      {t.product_name && (<><span>·</span><span>{t.product_name}</span></>)}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </Section>

        {/* Notes */}
        <Section title={`Notes (${(c.notes || []).length})`}>
          <div className="space-y-2 mb-3">
            {(c.notes || []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-3 text-center">No notes yet.</div>
            ) : (
              c.notes.slice().reverse().map(n => (
                <div key={n.id} className="border-l-2 border-primary/40 pl-3 py-1 bg-muted/20 rounded-r-md">
                  <div className="text-sm text-foreground">{n.text}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {n.created_by_name} · {n.created_at?.slice(0, 19).replace('T', ' ')}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note (e.g. customer prefers evening visits)…"
              className="flex-1 bg-background border-border text-foreground min-h-[60px] text-sm"
            />
            <Button onClick={addNote} disabled={posting || !newNote.trim()} className="bg-primary text-primary-foreground self-end">
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </Button>
          </div>
        </Section>

        {/* Quick CTAs */}
        <div className="border-t border-border pt-4 flex gap-2 flex-wrap">
          <Button asChild variant="outline" className="border-border text-foreground">
            <a href={`/dealer/warranty?phone=${c.phone}&name=${encodeURIComponent(c.name || '')}`}>
              <ShieldCheck className="w-4 h-4 mr-1.5" /> Register Warranty
            </a>
          </Button>
          <Button asChild variant="outline" className="border-border text-foreground">
            <a href={`/dealer/tickets?action=new&phone=${c.phone}&name=${encodeURIComponent(c.name || '')}`}>
              <TicketIcon className="w-4 h-4 mr-1.5" /> Raise Ticket
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {children}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-muted-foreground w-24 text-xs">{label}</span>
      <span className={`text-foreground ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function AddCustomerDialog({ open, onClose, token, onCreated }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', note: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', note: '' });
  }, [open]);

  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Name and phone are required');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/dealer/customers`, form, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Customer added');
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" /> Add Customer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Name *"  value={form.name}   onChange={v => setForm(f => ({ ...f, name: v }))} />
          <Field label="Phone *" value={form.phone}  onChange={v => setForm(f => ({ ...f, phone: v }))} mono />
          <Field label="Email"   value={form.email}  onChange={v => setForm(f => ({ ...f, email: v }))} />
          <Field label="Address" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} />
          <div className="grid grid-cols-3 gap-2">
            <Field label="City"    value={form.city}    onChange={v => setForm(f => ({ ...f, city: v }))} />
            <Field label="State"   value={form.state}   onChange={v => setForm(f => ({ ...f, state: v }))} />
            <Field label="Pincode" value={form.pincode} onChange={v => setForm(f => ({ ...f, pincode: v }))} mono />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Initial Note</label>
            <Textarea
              value={form.note}
              onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Walked into shop on 24-May, interested in 1100VA inverter…"
              className="mt-1 bg-background border-border text-foreground min-h-[60px] text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" /> Save</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, mono }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 bg-background border-border text-foreground ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

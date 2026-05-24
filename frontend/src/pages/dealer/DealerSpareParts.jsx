import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Wrench, Loader2, Search, Filter, Package, IndianRupee, ShoppingCart,
  Plus, Minus, X, Trash2, ImageIcon, ShieldAlert, Ticket, AlertTriangle,
  Send, History, ChevronRight,
} from 'lucide-react';

const CATEGORY_LABELS = {
  pcb: 'PCB', battery_post: 'Battery Post', fan: 'Fan', fuse: 'Fuse', mosfet: 'MOSFET',
  transformer: 'Transformer', capacitor: 'Capacitor', relay: 'Relay', display: 'Display',
  cable: 'Cable', casing: 'Casing', accessory: 'Accessory', other: 'Other',
};

const REASON_OPTIONS = [
  { id: 'claim',   label: 'Against a Warranty Claim', icon: ShieldAlert, tone: 'text-rose-400', detail: 'Free freight — for processing an approved customer claim' },
  { id: 'service', label: 'For a Service Ticket',     icon: Ticket,       tone: 'text-amber-400', detail: 'Free freight if linked product is still in warranty' },
  { id: 'buffer',  label: 'Buffer Stock',             icon: Package,      tone: 'text-violet-400', detail: 'For my shop stock — dealer pays freight' },
];

export default function DealerSpareParts() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cart, setCart] = useState({});  // { spare_id: { spare, qty } }
  const [cartOpen, setCartOpen] = useState(false);

  const fetchParts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (search.trim()) params.q = search.trim();
      const resp = await axios.get(`${API}/dealer/spare-parts`, {
        headers: { Authorization: `Bearer ${token}` }, params,
      });
      setParts(resp.data.parts || []);
      setCategories(resp.data.categories || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load spare parts catalog');
    } finally {
      setLoading(false);
    }
  }, [token, categoryFilter, search]);

  useEffect(() => { if (token) fetchParts(); }, [token, fetchParts]);
  useEffect(() => { const t = setTimeout(fetchParts, 300); return () => clearTimeout(t); }, [search]); // eslint-disable-line

  const addToCart = (spare) => {
    setCart(c => {
      const cur = c[spare.id]?.qty || 0;
      return { ...c, [spare.id]: { spare, qty: cur + 1 } };
    });
    toast.success(`${spare.name} added to cart`);
  };
  const updateQty = (id, qty) => {
    setCart(c => {
      const nc = { ...c };
      if (qty <= 0) delete nc[id];
      else nc[id] = { ...nc[id], qty };
      return nc;
    });
  };
  const removeFromCart = (id) => setCart(c => { const nc = { ...c }; delete nc[id]; return nc; });
  const clearCart = () => setCart({});

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((sum, it) => sum + (it.spare.dealer_price * it.qty), 0);
  const cartCount = cartItems.reduce((sum, it) => sum + it.qty, 0);

  return (
    <DashboardLayout title="Spare Parts Catalog">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Service Spare Parts</h2>
            <p className="text-sm text-muted-foreground mt-1">
              PCBs, fans, fuses, MOSFETs — at dealer net prices. Free freight for claim/service orders.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/dealer/spare-orders')} className="border-border">
              <History className="w-4 h-4 mr-1.5" /> My Orders
            </Button>
            {cartCount > 0 && (
              <Button onClick={() => setCartOpen(true)} className="bg-primary text-primary-foreground">
                <ShoppingCart className="w-4 h-4 mr-1.5" />
                Cart ({cartCount})
                <Badge className="ml-2 bg-primary-foreground text-primary font-mono">₹{cartTotal.toLocaleString()}</Badge>
              </Button>
            )}
          </div>
        </div>

        <Card className="mg-card border-border">
          <CardContent className="p-4 space-y-3">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name or part code…" value={search} onChange={(e) => setSearch(e.target.value)}
                     className="pl-9 bg-background border-border text-foreground" />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
              <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>All</FilterChip>
              {categories.map(c => (
                <FilterChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>
                  {CATEGORY_LABELS[c] || c}
                </FilterChip>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mg-card border-border">
          <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              {loading ? 'Loading…' : `${parts.length} ${parts.length === 1 ? 'part' : 'parts'}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading && parts.length === 0 ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : parts.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-foreground mb-1">No spare parts in catalog</p>
                <p className="text-sm">Once MuscleGrid adds spares, they'll appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {parts.map(p => (
                  <PartCard key={p.id} part={p} inCart={cart[p.id]?.qty || 0}
                            onAdd={() => addToCart(p)} onMinus={() => updateQty(p.id, (cart[p.id]?.qty || 1) - 1)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CartDialog
        open={cartOpen}
        items={cartItems}
        total={cartTotal}
        onClose={() => setCartOpen(false)}
        onUpdate={updateQty}
        onRemove={removeFromCart}
        onClear={clearCart}
        token={token}
        onPlaced={() => { clearCart(); setCartOpen(false); navigate('/dealer/spare-orders'); }}
      />
    </DashboardLayout>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-md transition-colors font-mono uppercase tracking-wide
        ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
      {children}
    </button>
  );
}

function PartCard({ part, inCart, onAdd, onMinus }) {
  const outOfStock = (part.stock_qty || 0) === 0;
  const lowStock = (part.stock_qty || 0) <= (part.low_stock_threshold || 5);
  return (
    <div className="border border-border rounded-lg bg-muted/20 p-3 hover:bg-muted/30 transition-colors">
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {part.image_url ? <img src={part.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-muted-foreground/50" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground text-sm truncate">{part.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{part.part_code}</div>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge className="bg-primary/15 text-primary ring-1 ring-primary/25 font-mono text-[10px] uppercase">
              {CATEGORY_LABELS[part.category] || part.category}
            </Badge>
            <span className="text-sm font-semibold text-foreground inline-flex items-center">
              <IndianRupee className="w-3 h-3" />{Number(part.dealer_price || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      {part.description && <div className="text-xs text-muted-foreground mt-2 line-clamp-2">{part.description}</div>}
      <div className="mt-3 flex items-center justify-between">
        <Badge className={outOfStock
          ? 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25 font-mono text-[10px] uppercase'
          : lowStock
            ? 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25 font-mono text-[10px] uppercase'
            : 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25 font-mono text-[10px] uppercase'}>
          {outOfStock ? 'Out of Stock' : `${part.stock_qty} in stock`}
        </Badge>
        {inCart > 0 ? (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={onMinus} className="border-border h-7 w-7 p-0">
              <Minus className="w-3 h-3" />
            </Button>
            <span className="font-mono text-foreground text-sm min-w-[24px] text-center">{inCart}</span>
            <Button size="sm" onClick={onAdd} disabled={outOfStock} className="bg-primary text-primary-foreground h-7 w-7 p-0">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={onAdd} disabled={outOfStock} className="bg-primary text-primary-foreground">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        )}
      </div>
    </div>
  );
}

function CartDialog({ open, items, total, onClose, onUpdate, onRemove, onClear, token, onPlaced }) {
  const [reason, setReason] = useState('buffer');
  const [claimId, setClaimId] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [notes, setNotes] = useState('');
  const [claims, setClaims] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('buffer'); setClaimId(''); setTicketId(''); setNotes('');
    // Pre-fetch dealer's open claims (for picker)
    (async () => {
      try {
        const resp = await axios.get(`${API}/dealer/warranty-claims`, {
          headers: { Authorization: `Bearer ${token}` }, params: { status: 'open' },
        });
        setClaims(resp.data.claims || []);
      } catch (err) { /* ignore */ }
    })();
  }, [open, token]);

  const place = async () => {
    if (items.length === 0) { toast.error('Cart is empty'); return; }
    if (reason === 'claim' && !claimId) { toast.error('Pick a warranty claim'); return; }
    if (reason === 'service' && !ticketId.trim()) { toast.error('Enter a ticket reference'); return; }
    setSubmitting(true);
    try {
      const payload = {
        items: items.map(it => ({ spare_id: it.spare.id, qty: it.qty })),
        reason_type: reason,
        claim_id: reason === 'claim' ? claimId : null,
        ticket_id: reason === 'service' ? ticketId.trim() : null,
        notes: notes.trim() || null,
      };
      await axios.post(`${API}/dealer/spare-orders`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Spare parts order placed — MG will process within 5 working days');
      onPlaced();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" /> Place Spare Parts Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Cart is empty.</div>
          ) : (
            <div className="space-y-2">
              {items.map(it => (
                <div key={it.spare.id} className="flex items-center gap-3 border border-border/60 rounded-md p-2 bg-muted/20">
                  <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {it.spare.image_url ? <img src={it.spare.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground font-medium text-sm truncate">{it.spare.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{it.spare.part_code}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => onUpdate(it.spare.id, it.qty - 1)} className="border-border h-7 w-7 p-0"><Minus className="w-3 h-3" /></Button>
                    <span className="font-mono text-foreground text-sm min-w-[24px] text-center">{it.qty}</span>
                    <Button size="sm" variant="outline" onClick={() => onUpdate(it.spare.id, it.qty + 1)} className="border-border h-7 w-7 p-0"><Plus className="w-3 h-3" /></Button>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <div className="text-sm font-mono text-foreground">₹{(it.spare.dealer_price * it.qty).toLocaleString()}</div>
                  </div>
                  <button onClick={() => onRemove(it.spare.id)} className="p-1 text-muted-foreground hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <div className="flex justify-between pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-lg font-semibold font-mono text-foreground">₹{total.toLocaleString()}</span>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <>
              <div>
                <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Order Reason *</label>
                <div className="grid grid-cols-1 gap-2 mt-1">
                  {REASON_OPTIONS.map(r => {
                    const Icon = r.icon;
                    return (
                      <button key={r.id} onClick={() => setReason(r.id)}
                        className={`flex items-start gap-3 p-3 rounded-md border text-left transition-colors
                          ${reason === r.id ? 'border-primary bg-primary/[0.08]' : 'border-border bg-muted/20 hover:bg-muted/30'}`}>
                        <Icon className={`w-5 h-5 ${r.tone} flex-shrink-0 mt-0.5`} />
                        <div>
                          <div className="font-medium text-foreground text-sm">{r.label}</div>
                          <div className="text-xs text-muted-foreground">{r.detail}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {reason === 'claim' && (
                <div>
                  <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Warranty Claim *</label>
                  {claims.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2 px-3 bg-muted/30 rounded-md border border-border mt-1">
                      You have no open warranty claims. File one first under <a href="/dealer/warranty-claims" className="text-primary underline">Warranty Claims</a>.
                    </div>
                  ) : (
                    <Select value={claimId} onValueChange={setClaimId}>
                      <SelectTrigger className="mt-1 bg-background border-border text-foreground"><SelectValue placeholder="Pick a claim…" /></SelectTrigger>
                      <SelectContent className="bg-popover border-border max-h-60">
                        {claims.map(c => (
                          <SelectItem key={c.id} value={c.id} className="text-foreground">
                            <div className="flex flex-col">
                              <span className="font-mono">{c.claim_number}</span>
                              <span className="text-xs text-muted-foreground">{c.product_name} · {c.customer_name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {reason === 'service' && (
                <div>
                  <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Ticket / Reference *</label>
                  <Input value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="MG-DT-… or a free-form reference"
                         className="mt-1 bg-background border-border text-foreground font-mono" />
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Notes (optional)</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                          placeholder="Any context, urgency, or special requests…"
                          className="mt-1 bg-background border-border text-foreground min-h-[60px]" />
              </div>

              <div className={`text-xs px-3 py-2 rounded-md border ${reason === 'buffer' ? 'bg-amber-400/[0.06] border-amber-400/30' : 'bg-emerald-500/[0.06] border-emerald-500/30'}`}>
                <strong className="text-foreground">Freight: </strong>
                <span className={reason === 'buffer' ? 'text-amber-400' : 'text-emerald-400'}>
                  {reason === 'buffer' ? "Dealer's account (buffer stock orders)" : 'Free — MuscleGrid pays (service / claim orders)'}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-between gap-2 pt-2">
          <Button variant="outline" onClick={onClear} disabled={items.length === 0} className="border-border text-rose-400">
            <Trash2 className="w-4 h-4 mr-1.5" /> Clear Cart
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
            <Button onClick={place} disabled={submitting || items.length === 0} className="bg-primary text-primary-foreground">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" /> Place Order</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

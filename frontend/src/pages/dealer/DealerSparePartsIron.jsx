import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Wrench, Loader2, Search, Package, IndianRupee, ShoppingCart,
  Plus, Minus, Trash2, ImageIcon, ShieldAlert, Ticket,
  Send, History,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';

const CATEGORY_LABELS = {
  pcb: 'PCB', battery_post: 'Battery Post', fan: 'Fan', fuse: 'Fuse', mosfet: 'MOSFET',
  transformer: 'Transformer', capacitor: 'Capacitor', relay: 'Relay', display: 'Display',
  cable: 'Cable', casing: 'Casing', accessory: 'Accessory', other: 'Other',
};

const REASON_OPTIONS = [
  { id: 'claim',   label: 'Against a Warranty Claim', icon: ShieldAlert, tone: T.orangeDeep, detail: 'Free freight — for processing an approved customer claim' },
  { id: 'service', label: 'For a Service Ticket',     icon: Ticket,       tone: T.voltageText, detail: 'Free freight if linked product is still in warranty' },
  { id: 'buffer',  label: 'Buffer Stock',             icon: Package,      tone: '#6D4AB0',    detail: 'For my shop stock — dealer pays freight' },
];

const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none' };

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

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button style={btnOutline} onClick={() => navigate('/dealer/spare-orders')}>
        <History size={14} /> My Orders
      </button>
      {cartCount > 0 && (
        <button style={btnPrimary} onClick={() => setCartOpen(true)}>
          <ShoppingCart size={14} /> Cart ({cartCount})
          <span style={{ ...mono, marginLeft: 6, background: '#fff', color: T.orangeDeep, borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
            ₹{cartTotal.toLocaleString('en-IN')}
          </span>
        </button>
      )}
    </div>
  );

  return (
    <IronShell title="Spare Parts" subtitle="DEALER · SERVICE SPARES" roleLabel="Dealer Portal" onRefresh={fetchParts} headerRight={headerRight}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.iron900 }}>Service Spare Parts</div>
          <div style={{ fontSize: 12.5, color: T.iron500, marginTop: 3 }}>
            PCBs, fans, fuses, MOSFETs — at dealer net prices. Free freight for claim/service orders.
          </div>
        </div>

        <IronCard pad={14}>
          <div style={{ position: 'relative', maxWidth: 380 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.iron400 }} />
            <input
              placeholder="Search by name or part code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, width: '100%', paddingLeft: 32 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            <Caps size={8.5} color={T.iron400} style={{ marginRight: 2 }}>Category</Caps>
            <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>All</FilterChip>
            {categories.map(c => (
              <FilterChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>
                {CATEGORY_LABELS[c] || c}
              </FilterChip>
            ))}
          </div>
        </IronCard>

        <IronCard pad={0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.iron200}`, background: T.iron50, padding: '11px 16px' }}>
            <Wrench size={15} color={T.orange} />
            <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>
              {loading ? 'Loading…' : `${parts.length} ${parts.length === 1 ? 'part' : 'parts'}`}
            </span>
          </div>
          <div style={{ padding: 14 }}>
            {loading && parts.length === 0 ? (
              <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
                <Loader2 size={30} className="animate-spin" color={T.orange} />
              </div>
            ) : parts.length === 0 ? (
              <div style={{ padding: '64px 0', textAlign: 'center', color: T.iron400 }}>
                <Wrench size={44} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                <div style={{ color: T.iron700, marginBottom: 4, fontSize: 14, fontWeight: 600 }}>No spare parts in catalog</div>
                <div style={{ fontSize: 12.5 }}>Once MuscleGrid adds spares, they'll appear here.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {parts.map(p => (
                  <PartCard key={p.id} part={p} inCart={cart[p.id]?.qty || 0}
                            onAdd={() => addToCart(p)} onMinus={() => updateQty(p.id, (cart[p.id]?.qty || 1) - 1)} />
                ))}
              </div>
            )}
          </div>
        </IronCard>
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
    </IronShell>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '5px 11px', fontSize: 10.5, borderRadius: 6, cursor: 'pointer',
        fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '.05em',
        border: `1px solid ${active ? T.orange : T.iron200}`,
        background: active ? T.orange : T.white,
        color: active ? '#fff' : T.iron700,
        fontWeight: active ? 700 : 500,
      }}>
      {children}
    </button>
  );
}

function PartCard({ part, inCart, onAdd, onMinus }) {
  const outOfStock = (part.stock_qty || 0) === 0;
  const lowStock = (part.stock_qty || 0) <= (part.low_stock_threshold || 5);
  const stockChip = outOfStock
    ? { bg: '#FDEEE6', fg: T.orangeDeep, bd: '#F6D8BA' }
    : lowStock
      ? { bg: T.voltageTint, fg: T.voltageText, bd: '#EDDFA6' }
      : { bg: T.greenTint, fg: T.green, bd: '#CBE5D6' };
  return (
    <div style={{ border: `1px solid ${T.iron200}`, borderRadius: 8, background: T.white, padding: 12 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 64, height: 64, borderRadius: 6, background: T.iron100, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {part.image_url ? <img src={part.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={24} color={T.iron400} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: T.iron900, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{part.name}</div>
          <div style={{ ...mono, fontSize: 11, color: T.iron500 }}>{part.part_code}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ ...mono, background: '#FDEEE6', color: T.orangeDeep, border: '1px solid #F6D8BA', borderRadius: 999, padding: '1px 7px', fontSize: 9.5, textTransform: 'uppercase', fontWeight: 700 }}>
              {CATEGORY_LABELS[part.category] || part.category}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.iron900, display: 'inline-flex', alignItems: 'center', ...mono }}>
              <IndianRupee size={12} />{Number(part.dealer_price || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>
      {part.description && <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{part.description}</div>}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...mono, background: stockChip.bg, color: stockChip.fg, border: `1px solid ${stockChip.bd}`, borderRadius: 999, padding: '2px 8px', fontSize: 9.5, textTransform: 'uppercase', fontWeight: 700 }}>
          {outOfStock ? 'Out of Stock' : `${part.stock_qty} in stock`}
        </span>
        {inCart > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={onMinus} style={{ ...btnOutline, padding: 0, height: 28, width: 28, justifyContent: 'center' }}><Minus size={13} /></button>
            <span style={{ ...mono, color: T.iron900, fontSize: 13, minWidth: 24, textAlign: 'center' }}>{inCart}</span>
            <button onClick={onAdd} disabled={outOfStock} style={{ ...btnPrimary, padding: 0, height: 28, width: 28, justifyContent: 'center', opacity: outOfStock ? 0.5 : 1 }}><Plus size={13} /></button>
          </div>
        ) : (
          <button onClick={onAdd} disabled={outOfStock} style={{ ...btnPrimary, opacity: outOfStock ? 0.5 : 1 }}>
            <Plus size={14} /> Add
          </button>
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

  const labelStyle = { fontFamily: T.mono, fontSize: 10, color: T.iron500, textTransform: 'uppercase', letterSpacing: '.08em' };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: T.white, border: `1px solid ${T.iron200}`, color: T.iron900 }}>
        <DialogHeader>
          <DialogTitle style={{ color: T.iron900, display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.headline }}>
            <ShoppingCart size={16} color={T.orange} /> Place Spare Parts Order
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {items.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: T.iron400 }}>Cart is empty.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(it => (
                <div key={it.spare.id} style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: 8, background: T.iron50 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 6, background: T.iron100, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {it.spare.image_url ? <img src={it.spare.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={20} color={T.iron400} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: T.iron900, fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.spare.name}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.iron500 }}>{it.spare.part_code}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => onUpdate(it.spare.id, it.qty - 1)} style={{ ...btnOutline, padding: 0, height: 28, width: 28, justifyContent: 'center' }}><Minus size={13} /></button>
                    <span style={{ ...mono, color: T.iron900, fontSize: 13, minWidth: 24, textAlign: 'center' }}>{it.qty}</span>
                    <button onClick={() => onUpdate(it.spare.id, it.qty + 1)} style={{ ...btnOutline, padding: 0, height: 28, width: 28, justifyContent: 'center' }}><Plus size={13} /></button>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 80 }}>
                    <div style={{ ...mono, fontSize: 13, color: T.iron900 }}>₹{(it.spare.dealer_price * it.qty).toLocaleString('en-IN')}</div>
                  </div>
                  <button onClick={() => onRemove(it.spare.id)} style={{ padding: 4, color: T.iron400, background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: `1px solid ${T.iron200}` }}>
                <span style={{ fontSize: 12.5, color: T.iron500 }}>Subtotal</span>
                <span style={{ ...mono, fontSize: 17, fontWeight: 700, color: T.iron900 }}>₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <>
              <div>
                <label style={labelStyle}>Order Reason *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 6 }}>
                  {REASON_OPTIONS.map(r => {
                    const Icon = r.icon;
                    const on = reason === r.id;
                    return (
                      <button key={r.id} onClick={() => setReason(r.id)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 6, textAlign: 'left', cursor: 'pointer',
                          border: `1px solid ${on ? T.orange : T.iron200}`,
                          background: on ? '#FDEEE6' : T.white,
                        }}>
                        <Icon size={20} color={r.tone} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <div style={{ fontWeight: 600, color: T.iron900, fontSize: 13 }}>{r.label}</div>
                          <div style={{ fontSize: 11.5, color: T.iron500 }}>{r.detail}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {reason === 'claim' && (
                <div>
                  <label style={labelStyle}>Warranty Claim *</label>
                  {claims.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: T.iron500, padding: '8px 12px', background: T.iron50, borderRadius: 6, border: `1px solid ${T.iron200}`, marginTop: 6 }}>
                      You have no open warranty claims. File one first under <a href="/dealer/warranty-claims" style={{ color: T.orange, textDecoration: 'underline' }}>Warranty Claims</a>.
                    </div>
                  ) : (
                    <Select value={claimId} onValueChange={setClaimId}>
                      <SelectTrigger style={{ ...inputStyle, marginTop: 6 }}><SelectValue placeholder="Pick a claim…" /></SelectTrigger>
                      <SelectContent style={{ maxHeight: 240 }}>
                        {claims.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={mono}>{c.claim_number}</span>
                              <span style={{ fontSize: 11, color: T.iron500 }}>{c.product_name} · {c.customer_name}</span>
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
                  <label style={labelStyle}>Ticket / Reference *</label>
                  <input value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="MG-DT-… or a free-form reference"
                         style={{ ...inputStyle, ...mono, width: '100%', marginTop: 6 }} />
                </div>
              )}

              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                          placeholder="Any context, urgency, or special requests…"
                          style={{ ...inputStyle, width: '100%', marginTop: 6, minHeight: 60, resize: 'vertical' }} />
              </div>

              <div style={{ fontSize: 11.5, padding: '8px 12px', borderRadius: 6, border: `1px solid ${reason === 'buffer' ? '#EDDFA6' : '#CBE5D6'}`, background: reason === 'buffer' ? T.voltageTint : T.greenTint }}>
                <strong style={{ color: T.iron900 }}>Freight: </strong>
                <span style={{ color: reason === 'buffer' ? T.voltageText : T.green }}>
                  {reason === 'buffer' ? "Dealer's account (buffer stock orders)" : 'Free — MuscleGrid pays (service / claim orders)'}
                </span>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 8 }}>
          <button onClick={onClear} disabled={items.length === 0} style={{ ...btnOutline, color: T.orangeDeep, opacity: items.length === 0 ? 0.5 : 1 }}>
            <Trash2 size={14} /> Clear Cart
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btnOutline}>Cancel</button>
            <button onClick={place} disabled={submitting || items.length === 0} style={{ ...btnPrimary, opacity: (submitting || items.length === 0) ? 0.6 : 1 }}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <><Send size={14} /> Place Order</>}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { ShoppingCart, Search, ChevronLeft, Plus, Minus, Trash2, Loader2, ShieldCheck, Truck, BadgeCheck, X, MapPin, Check, PackageSearch } from 'lucide-react';

/* MuscleGrid Storefront MVP — public, guest checkout, wired to the existing /shop APIs.
   Server computes all prices from master_skus; the client only sends product ids + quantities.
   Razorpay (live) + COD. Cart persists in localStorage. Served at store.musclegrid.in. */

const O = '#F58220', OD = '#D96A0A', INK = '#1A1A1A', SUB = '#6B6B6B', MUT = '#9A9A9A', LINE = '#E6E6E6', PAPER = '#FAFAF8', GREEN = '#1F8A4C';
const F = "'Inter', system-ui, sans-serif", FH = "'Inter Tight', system-ui, sans-serif", FM = "'JetBrains Mono', ui-monospace, monospace", FD = "'Saira Condensed', system-ui, sans-serif";
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const CART_KEY = 'mg_store_cart';

const Fonts = () => (<style>{`
  @import url("https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@700;800&family=Inter+Tight:wght@600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap");
  .mgs *{box-sizing:border-box} .mgs-card{transition:box-shadow .15s,transform .15s} .mgs-card:hover{box-shadow:0 8px 24px rgba(15,15,15,.10);transform:translateY(-2px)}
  .mgs-btn:hover{filter:brightness(.94)} .mgs-qty:hover{background:${PAPER}}
`}</style>);

const loadRzp = () => new Promise((res) => {
  if (window.Razorpay) return res(true);
  const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = () => res(true); s.onerror = () => res(false); document.body.appendChild(s);
});

export default function StoreFront() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('catalog');       // catalog | product | cart | checkout | success
  const [sel, setSel] = useState(null);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } });
  const [placing, setPlacing] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', city: '', pincode: '', gstin: '' });
  const [pay, setPay] = useState('razorpay');
  const [svc, setSvc] = useState(null);            // checkout serviceability {serviceable, cod, rate_from}
  const [svcLoading, setSvcLoading] = useState(false);
  const [pin, setPin] = useState({ v: '', res: null, loading: false });   // product-page delivery checker
  const [track, setTrack] = useState({ order: '', phone: '', res: null, loading: false, err: '' });

  const checkPincode = useCallback(async (raw) => {
    const p = (raw || '').replace(/\D/g, '');
    if (p.length !== 6) return null;
    const { data } = await axios.get(`${API}/shop/serviceability`, { params: { pincode: p } });
    return data;
  }, []);

  // Debounced serviceability check on the checkout pincode field.
  useEffect(() => {
    const p = (form.pincode || '').replace(/\D/g, '');
    if (p.length !== 6) { setSvc(null); return; }
    setSvcLoading(true);
    const t = setTimeout(() => {
      checkPincode(p).then((d) => setSvc(d)).catch(() => setSvc(null)).finally(() => setSvcLoading(false));
    }, 450);
    return () => clearTimeout(t);
  }, [form.pincode, checkPincode]);

  const runTrack = async () => {
    const onum = track.order.trim(); const ph = track.phone.replace(/\D/g, '');
    if (!onum) return setTrack((s) => ({ ...s, err: 'Enter your order number' }));
    setTrack((s) => ({ ...s, loading: true, err: '', res: null }));
    try {
      const { data } = await axios.get(`${API}/shop/track`, { params: { order: onum, phone: ph } });
      setTrack((s) => ({ ...s, res: data, loading: false }));
    } catch (e) {
      setTrack((s) => ({ ...s, loading: false, err: e.response?.data?.detail || 'Could not find that order.' }));
    }
  };

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/shop/products`, { params: { limit: 300 } });
        setProducts(r.data.products || []); setCats(r.data.categories || []);
      } catch (e) { /* */ } finally { setLoading(false); }
    })();
  }, []);

  const cartCount = cart.reduce((a, c) => a + c.qty, 0);
  const byId = useCallback((id) => products.find((p) => p.id === id), [products]);
  const cartLines = cart.map((c) => ({ ...c, p: byId(c.id) })).filter((c) => c.p);
  const subtotal = cartLines.reduce((a, c) => a + (c.p.price || 0) * c.qty, 0);

  const addToCart = (id, qty = 1) => setCart((prev) => {
    const ex = prev.find((c) => c.id === id);
    return ex ? prev.map((c) => c.id === id ? { ...c, qty: c.qty + qty } : c) : [...prev, { id, qty }];
  });
  const setQty = (id, qty) => setCart((prev) => qty <= 0 ? prev.filter((c) => c.id !== id) : prev.map((c) => c.id === id ? { ...c, qty } : c));
  const goTop = () => window.scrollTo({ top: 0 });
  const open = (p) => { setSel(p); setView('product'); goTop(); };

  const filtered = products.filter((p) =>
    (!cat || (p.category || '').toLowerCase() === cat.toLowerCase()) &&
    (!q || (p.title || '').toLowerCase().includes(q.toLowerCase())));

  const placeOrder = async () => {
    const phone = (form.phone || '').replace(/\D/g, '').slice(-10);
    if (!form.name.trim()) return alert('Please enter your name');
    if (phone.length !== 10) return alert('Please enter a valid 10-digit phone number');
    if (!form.address.trim() || !form.city.trim() || form.pincode.replace(/\D/g, '').length !== 6) return alert('Please enter a full delivery address with a 6-digit pincode');
    setPlacing(true);
    try {
      const items = cart.map((c) => ({ id: c.id, qty: c.qty }));
      const body = { items, name: form.name.trim(), phone, email: form.email || undefined, address: form.address, city: form.city, pincode: form.pincode, gstin: form.gstin || undefined, payment_method: pay, store: 'in' };
      const { data } = await axios.post(`${API}/shop/checkout/create`, body);
      if (data.cod) { setLastOrder(data.order_number); setCart([]); setView('success'); goTop(); return; }
      const ok = await loadRzp();
      if (!ok) { alert('Could not load the payment gateway. Please try again.'); return; }
      const rzp = new window.Razorpay({
        key: data.key_id, order_id: data.razorpay_order_id, amount: data.amount, currency: data.currency || 'INR',
        name: 'MuscleGrid', description: data.order_number, image: '/redesign/mg-monogram.png',
        prefill: data.prefill, theme: { color: O },
        handler: async (resp) => {
          try {
            await axios.post(`${API}/shop/checkout/verify`, { order_id: data.order_id, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature });
            setLastOrder(data.order_number); setCart([]); setView('success'); goTop();
          } catch (e) { alert('Payment captured but verification failed — our team will confirm your order shortly.'); }
        },
        modal: { ondismiss: () => setPlacing(false) },
      });
      rzp.on('payment.failed', () => { alert('Payment failed or was cancelled. You can try again.'); setPlacing(false); });
      rzp.open();
    } catch (e) {
      alert(e.response?.data?.detail || 'Could not place the order. Please try again.');
    } finally { setPlacing(false); }
  };

  const Header = () => (
    <header style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', borderBottom: `1px solid ${LINE}`, height: 62, display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => { setView('catalog'); goTop(); }}>
        <img src="/redesign/mg-monogram.png" alt="MG" style={{ width: 34, height: 34 }} />
        <div>
          <div style={{ fontFamily: FD, fontWeight: 800, fontSize: 19, letterSpacing: '.02em', color: INK, lineHeight: 1 }}>MUSCLEGRID</div>
          <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 8.5, letterSpacing: '.24em', color: O }}>OFFICIAL STORE</div>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ position: 'relative', maxWidth: 360, flex: 1, display: view === 'catalog' ? 'block' : 'none' }}>
        <Search size={16} color={MUT} style={{ position: 'absolute', left: 11, top: 10 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search inverters, batteries, stabilizers…" style={{ width: '100%', height: 38, border: `1px solid ${LINE}`, borderRadius: 8, padding: '0 12px 0 34px', fontFamily: F, fontSize: 13.5, outline: 'none', background: '#fff' }} />
      </div>
      <button className="mgs-btn" onClick={() => { setView('track'); goTop(); }} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: FH, fontWeight: 700, fontSize: 13, color: SUB }}>
        <PackageSearch size={17} /> Track Order
      </button>
      <button className="mgs-btn" onClick={() => { setView('cart'); goTop(); }} style={{ position: 'relative', border: `1px solid ${LINE}`, background: '#fff', borderRadius: 8, height: 40, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: FH, fontWeight: 700, fontSize: 13, color: INK }}>
        <ShoppingCart size={17} /> Cart
        {cartCount > 0 && <span style={{ position: 'absolute', top: -7, right: -7, background: O, color: '#fff', fontFamily: FM, fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18, display: 'grid', placeItems: 'center', padding: '0 4px' }}>{cartCount}</span>}
      </button>
    </header>
  );

  const Price = ({ p, big }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontFamily: FM, fontWeight: 700, fontSize: big ? 26 : 15, color: INK }}>{inr(p.price)}</span>
      {p.compare_at > p.price && <span style={{ fontFamily: FM, fontSize: big ? 14 : 11.5, color: MUT, textDecoration: 'line-through' }}>{inr(p.compare_at)}</span>}
      {p.compare_at > p.price && <span style={{ fontFamily: FH, fontWeight: 700, fontSize: big ? 12 : 10, color: GREEN }}>{Math.round((1 - p.price / p.compare_at) * 100)}% OFF</span>}
    </div>
  );

  return (
    <div className="mgs" style={{ minHeight: '100vh', background: PAPER, fontFamily: F, color: INK,
      // Force native inputs light — the app ships a global `input{...!important}` rule that reads these.
      colorScheme: 'light', '--input-bg': '0 0% 100%', '--input-text': '222 47% 11%', '--input-border': '30 8% 88%', '--input-placeholder': '220 9% 56%' }}>
      <Fonts />
      <Header />

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 400 }}><Loader2 className="animate-spin" size={30} color={MUT} /></div>
      ) : view === 'catalog' ? (
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 20px 60px' }}>
          {/* Hero */}
          <div style={{ background: `linear-gradient(100deg,#161616,#2a2a2a)`, borderRadius: 14, padding: '30px 32px', margin: '22px 0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 26, lineHeight: 1.15 }}>Power that pays for itself.</div>
              <div style={{ color: '#c9c9c9', fontSize: 14, marginTop: 6 }}>Inverters · Lithium batteries · Stabilizers · Solar — direct from the maker.</div>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[[ShieldCheck, 'Genuine warranty'], [Truck, 'Pan-India delivery'], [BadgeCheck, 'Secure payments']].map(([Ic, t]) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#eaeaea', fontSize: 12.5 }}><Ic size={16} color={O} /> {t}</div>
              ))}
            </div>
          </div>
          {/* Category chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {['', ...cats].map((c) => (
              <button key={c || 'all'} onClick={() => setCat(c)} style={{ border: `1px solid ${cat === c ? INK : LINE}`, background: cat === c ? INK : '#fff', color: cat === c ? '#fff' : SUB, borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontFamily: FH, fontWeight: 600, fontSize: 12.5 }}>{c || 'All Products'}</button>
            ))}
          </div>
          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 18 }}>
            {filtered.map((p) => (
              <div key={p.id} className="mgs-card" onClick={() => open(p)} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                <div style={{ aspectRatio: '1', background: PAPER, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                  {p.image ? <img src={p.image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ color: MUT, fontSize: 12 }}>No image</span>}
                </div>
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <div style={{ fontFamily: FH, fontWeight: 600, fontSize: 13, lineHeight: 1.35, color: INK, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 36 }}>{p.title}</div>
                  <div style={{ marginTop: 'auto' }}><Price p={p} /></div>
                  <button className="mgs-btn" onClick={(e) => { e.stopPropagation(); addToCart(p.id); }} style={{ border: 'none', background: O, color: '#fff', borderRadius: 8, padding: '9px 0', cursor: 'pointer', fontFamily: FH, fontWeight: 700, fontSize: 13 }}>Add to Cart</button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 50, color: MUT }}>No products match your search.</div>}
          </div>
        </div>
      ) : view === 'product' && sel ? (
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '18px 20px 60px' }}>
          <button className="mgs-qty" onClick={() => { setView('catalog'); goTop(); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${LINE}`, background: '#fff', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontFamily: FH, fontWeight: 600, fontSize: 12.5, color: SUB, marginBottom: 18 }}><ChevronLeft size={15} /> Back to store</button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, aspectRatio: '1', display: 'grid', placeItems: 'center', overflow: 'hidden', position: 'sticky', top: 78 }}>
              {sel.image ? <img src={sel.image} alt={sel.title} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 20 }} /> : <span style={{ color: MUT }}>No image</span>}
            </div>
            <div>
              <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 24, lineHeight: 1.25 }}>{sel.title}</div>
              <div style={{ margin: '14px 0' }}><Price p={sel} big /></div>
              <div style={{ fontSize: 12, color: SUB }}>Inclusive of {sel.gst || 0}% GST · Free standard delivery</div>
              {sel.description && <p style={{ fontSize: 13.5, color: SUB, lineHeight: 1.6, marginTop: 16 }}>{sel.description}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
                <button className="mgs-btn" onClick={() => addToCart(sel.id)} style={{ flex: 1, border: `1px solid ${O}`, background: '#fff', color: OD, borderRadius: 10, padding: '13px 0', cursor: 'pointer', fontFamily: FH, fontWeight: 700, fontSize: 14 }}>Add to Cart</button>
                <button className="mgs-btn" onClick={() => { addToCart(sel.id); setView('cart'); goTop(); }} style={{ flex: 1, border: 'none', background: O, color: '#fff', borderRadius: 10, padding: '13px 0', cursor: 'pointer', fontFamily: FH, fontWeight: 700, fontSize: 14 }}>Buy Now</button>
              </div>
              <div style={{ marginTop: 20, border: `1px solid ${LINE}`, borderRadius: 10, padding: 14, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}><MapPin size={15} color={O} /><span style={{ fontFamily: FH, fontWeight: 700, fontSize: 12.5 }}>Check delivery to your pincode</span></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={pin.v} onChange={(e) => setPin({ v: e.target.value.replace(/\D/g, '').slice(0, 6), res: null, loading: false })} placeholder="6-digit pincode" maxLength={6}
                    style={{ flex: 1, height: 38, border: `1px solid ${LINE}`, borderRadius: 8, padding: '0 12px', fontFamily: FM, fontSize: 13, outline: 'none' }} />
                  <button className="mgs-btn" onClick={async () => { if (pin.v.length !== 6) return; setPin((s) => ({ ...s, loading: true })); try { const d = await checkPincode(pin.v); setPin((s) => ({ ...s, res: d, loading: false })); } catch { setPin((s) => ({ ...s, res: { serviceable: true, cod: true }, loading: false })); } }}
                    style={{ border: 'none', background: INK, color: '#fff', borderRadius: 8, padding: '0 16px', cursor: 'pointer', fontFamily: FH, fontWeight: 700, fontSize: 12.5 }}>{pin.loading ? '…' : 'Check'}</button>
                </div>
                {pin.res && (pin.res.serviceable
                  ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: GREEN, fontSize: 12 }}><Check size={14} /> Delivers to {pin.v} · Free delivery{pin.res.cod ? ' · COD available' : ''}</div>
                  : <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: OD, fontSize: 12 }}><X size={14} /> Sorry, we don't deliver to {pin.v} yet.</div>)}
              </div>
              <div style={{ display: 'flex', gap: 18, marginTop: 16, flexWrap: 'wrap' }}>
                {[[ShieldCheck, 'Genuine warranty'], [Truck, 'Pan-India delivery'], [BadgeCheck, 'Secure Razorpay payment']].map(([Ic, t]) => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 7, color: SUB, fontSize: 12 }}><Ic size={15} color={GREEN} /> {t}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : view === 'cart' ? (
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '22px 20px 60px' }}>
          <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 22, marginBottom: 16 }}>Your Cart</div>
          {cartLines.length === 0 ? (
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 50, textAlign: 'center', color: MUT }}>
              Your cart is empty. <span onClick={() => setView('catalog')} style={{ color: O, cursor: 'pointer', fontWeight: 700 }}>Browse products →</span>
            </div>
          ) : (
            <>
              {cartLines.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <div style={{ width: 66, height: 66, background: PAPER, borderRadius: 8, display: 'grid', placeItems: 'center', overflow: 'hidden', flex: 'none' }}>{c.p.image && <img src={c.p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FH, fontWeight: 600, fontSize: 13, lineHeight: 1.35 }}>{c.p.title}</div>
                    <div style={{ fontFamily: FM, fontSize: 13, color: INK, marginTop: 3 }}>{inr(c.p.price)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${LINE}`, borderRadius: 8 }}>
                    <button className="mgs-qty" onClick={() => setQty(c.id, c.qty - 1)} style={{ border: 'none', background: 'none', padding: 8, cursor: 'pointer', color: SUB }}><Minus size={14} /></button>
                    <span style={{ fontFamily: FM, fontWeight: 700, fontSize: 13, minWidth: 22, textAlign: 'center' }}>{c.qty}</span>
                    <button className="mgs-qty" onClick={() => setQty(c.id, c.qty + 1)} style={{ border: 'none', background: 'none', padding: 8, cursor: 'pointer', color: SUB }}><Plus size={14} /></button>
                  </div>
                  <button className="mgs-qty" onClick={() => setQty(c.id, 0)} style={{ border: 'none', background: 'none', padding: 8, cursor: 'pointer', color: MUT }}><Trash2 size={15} /></button>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '16px 18px' }}>
                <div><div style={{ fontSize: 12, color: SUB }}>Subtotal (incl. GST)</div><div style={{ fontFamily: FM, fontWeight: 700, fontSize: 22 }}>{inr(subtotal)}</div></div>
                <button className="mgs-btn" onClick={() => { setView('checkout'); goTop(); }} style={{ border: 'none', background: O, color: '#fff', borderRadius: 10, padding: '13px 26px', cursor: 'pointer', fontFamily: FH, fontWeight: 700, fontSize: 14 }}>Proceed to Checkout</button>
              </div>
            </>
          )}
        </div>
      ) : view === 'checkout' ? (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '22px 20px 60px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
          <div>
            <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 22, marginBottom: 16 }}>Delivery Details</div>
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 18, display: 'grid', gap: 12 }}>
              {[['name', 'Full Name *', 'text'], ['phone', 'Phone (10-digit) *', 'tel'], ['email', 'Email (for order updates)', 'email'], ['address', 'Full Address *', 'text']].map(([k, l, t]) => (
                <div key={k}><label style={{ fontFamily: FH, fontWeight: 700, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: SUB, display: 'block', marginBottom: 5 }}>{l}</label>
                  <input type={t} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={{ width: '100%', height: 40, border: `1px solid ${LINE}`, borderRadius: 8, padding: '0 12px', fontFamily: F, fontSize: 13.5, outline: 'none' }} /></div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[['city', 'City *'], ['pincode', 'Pincode *']].map(([k, l]) => (
                  <div key={k}><label style={{ fontFamily: FH, fontWeight: 700, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: SUB, display: 'block', marginBottom: 5 }}>{l}</label>
                    <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={{ width: '100%', height: 40, border: `1px solid ${LINE}`, borderRadius: 8, padding: '0 12px', fontFamily: F, fontSize: 13.5, outline: 'none' }} /></div>
                ))}
              </div>
              {form.pincode.replace(/\D/g, '').length === 6 && (
                <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: svcLoading ? MUT : (svc && !svc.serviceable ? OD : GREEN) }}>
                  {svcLoading ? <><Loader2 size={13} className="animate-spin" /> Checking delivery…</>
                    : svc && !svc.serviceable ? <><X size={13} /> We don't deliver to {form.pincode} yet — please contact us to arrange it.</>
                    : svc ? <><Check size={13} /> Delivers to {form.pincode} · Free delivery{svc.cod ? ' · COD available' : ''}</> : null}
                </div>
              )}
              <div><label style={{ fontFamily: FH, fontWeight: 700, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: SUB, display: 'block', marginBottom: 5 }}>GSTIN (optional — for GST invoice)</label>
                <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} style={{ width: '100%', height: 40, border: `1px solid ${LINE}`, borderRadius: 8, padding: '0 12px', fontFamily: FM, fontSize: 13, outline: 'none' }} /></div>
              <div style={{ marginTop: 4 }}>
                <label style={{ fontFamily: FH, fontWeight: 700, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: SUB, display: 'block', marginBottom: 6 }}>Payment</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[['razorpay', 'Pay Online (UPI / Card)'], ['cod', 'Cash on Delivery']].map(([v, l]) => (
                    <button key={v} onClick={() => setPay(v)} style={{ flex: 1, border: `1px solid ${pay === v ? O : LINE}`, background: pay === v ? '#FFF1E3' : '#fff', color: pay === v ? OD : SUB, borderRadius: 8, padding: '10px', cursor: 'pointer', fontFamily: FH, fontWeight: 700, fontSize: 12.5 }}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 18, position: 'sticky', top: 78 }}>
            <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Order Summary</div>
            {cartLines.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, marginBottom: 8, color: SUB }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.p.title} × {c.qty}</span>
                <span style={{ fontFamily: FM, color: INK }}>{inr(c.p.price * c.qty)}</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 10, paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: FH, fontWeight: 700 }}>Total</span><span style={{ fontFamily: FM, fontWeight: 700, fontSize: 18 }}>{inr(subtotal)}</span>
            </div>
            <button className="mgs-btn" disabled={placing || cartLines.length === 0} onClick={placeOrder} style={{ width: '100%', marginTop: 14, border: 'none', background: O, color: '#fff', borderRadius: 10, padding: '13px 0', cursor: placing ? 'default' : 'pointer', opacity: placing ? .7 : 1, fontFamily: FH, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {placing && <Loader2 size={16} className="animate-spin" />}{pay === 'cod' ? 'Place Order (COD)' : `Pay ${inr(subtotal)}`}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 10, color: MUT, fontSize: 11 }}><ShieldCheck size={13} /> Secured by Razorpay</div>
          </div>
        </div>
      ) : view === 'track' ? (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '22px 20px 60px' }}>
          <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 22, marginBottom: 16 }}>Track Your Order</div>
          <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={{ fontFamily: FH, fontWeight: 700, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: SUB, display: 'block', marginBottom: 5 }}>Order Number</label>
                <input value={track.order} onChange={(e) => setTrack((s) => ({ ...s, order: e.target.value }))} placeholder="MGW-XXXXXXXX" style={{ width: '100%', height: 40, border: `1px solid ${LINE}`, borderRadius: 8, padding: '0 12px', fontFamily: FM, fontSize: 13, outline: 'none' }} /></div>
              <div><label style={{ fontFamily: FH, fontWeight: 700, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: SUB, display: 'block', marginBottom: 5 }}>Phone (on the order)</label>
                <input value={track.phone} onChange={(e) => setTrack((s) => ({ ...s, phone: e.target.value }))} placeholder="10-digit phone" style={{ width: '100%', height: 40, border: `1px solid ${LINE}`, borderRadius: 8, padding: '0 12px', fontFamily: F, fontSize: 13.5, outline: 'none' }} /></div>
            </div>
            <button className="mgs-btn" onClick={runTrack} disabled={track.loading} style={{ border: 'none', background: O, color: '#fff', borderRadius: 10, padding: '12px 0', cursor: 'pointer', fontFamily: FH, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{track.loading && <Loader2 size={15} className="animate-spin" />}Track Order</button>
            {track.err && <div style={{ color: OD, fontSize: 12.5 }}>{track.err}</div>}
          </div>
          {track.res && (
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: 18, marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div><div style={{ fontFamily: FM, fontWeight: 700, fontSize: 16, color: OD }}>{track.res.order_number}</div><div style={{ fontSize: 11.5, color: SUB }}>Placed {track.res.placed_at ? new Date(track.res.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div></div>
                <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 16 }}>{inr(track.res.total)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', margin: '4px 0 18px' }}>
                {track.res.steps.map((s, i) => {
                  const done = (i + 1) <= track.res.stage; const isLast = i === track.res.steps.length - 1;
                  return (
                    <React.Fragment key={s}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 60 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 999, background: done ? GREEN : '#ECECEC', color: '#fff', display: 'grid', placeItems: 'center' }}>{done ? <Check size={15} /> : <span style={{ fontFamily: FM, fontSize: 11, color: MUT }}>{i + 1}</span>}</div>
                        <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 9, color: done ? INK : MUT, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'center' }}>{s}</span>
                      </div>
                      {!isLast && <div style={{ flex: 1, height: 2, background: (i + 1) < track.res.stage ? GREEN : '#ECECEC', marginTop: 13 }} />}
                    </React.Fragment>
                  );
                })}
              </div>
              {track.res.tracking_id
                ? <div style={{ fontSize: 12.5, color: SUB, marginBottom: 12 }}>Courier: <b style={{ color: INK }}>{track.res.courier || '—'}</b> · AWB <span style={{ fontFamily: FM }}>{track.res.tracking_id}</span>{track.res.courier_status ? ` · ${track.res.courier_status}` : ''}</div>
                : <div style={{ fontSize: 12.5, color: MUT, marginBottom: 12 }}>{track.res.stage >= 3 ? 'Being packed — tracking will appear here once it ships.' : track.res.payment_method === 'cod' ? 'Order confirmed (Cash on Delivery). We’ll pack and ship it shortly.' : 'Order confirmed. We’ll pack and ship it shortly.'}</div>}
              <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
                {track.res.items.map((it, i) => (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: SUB, marginBottom: 6 }}><span>{it.title} × {it.quantity}</span><span style={{ fontFamily: FM, color: INK }}>{inr(it.line_total)}</span></div>))}
              </div>
            </div>
          )}
        </div>
      ) : view === 'success' ? (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: 999, background: '#E9F4EE', color: GREEN, display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}><BadgeCheck size={30} /></div>
          <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 24 }}>Order confirmed!</div>
          <div style={{ color: SUB, marginTop: 8, fontSize: 14 }}>Thank you for your order. Your order number is</div>
          <div style={{ fontFamily: FM, fontWeight: 700, fontSize: 20, color: OD, margin: '8px 0 4px' }}>{lastOrder}</div>
          <div style={{ color: MUT, fontSize: 12.5 }}>We've recorded it and our team will process the dispatch. You'll get updates on your phone/email.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
            <button className="mgs-btn" onClick={() => { setTrack({ order: lastOrder || '', phone: form.phone || '', res: null, loading: false, err: '' }); setView('track'); goTop(); }} style={{ border: `1px solid ${LINE}`, background: '#fff', color: INK, borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontFamily: FH, fontWeight: 700, fontSize: 14 }}>Track Order</button>
            <button className="mgs-btn" onClick={() => { setView('catalog'); goTop(); }} style={{ border: 'none', background: O, color: '#fff', borderRadius: 10, padding: '12px 28px', cursor: 'pointer', fontFamily: FH, fontWeight: 700, fontSize: 14 }}>Continue Shopping</button>
          </div>
        </div>
      ) : null}

      <footer style={{ borderTop: `1px solid ${LINE}`, background: '#fff', padding: '22px 20px', textAlign: 'center', color: MUT, fontSize: 12 }}>
        © MuscleGrid · Official Store · <span style={{ fontFamily: FM }}>store.musclegrid.in</span> — secure payments by Razorpay
      </footer>
    </div>
  );
}

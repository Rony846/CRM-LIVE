import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import {
  Loader2, ShoppingCart, IndianRupee, Truck, Package, ChevronDown, Search, History,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

const STATUSES = ['confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const CUR_SYM = { INR: '₹', HKD: 'HK$', USD: '$', GBP: '£', EUR: '€', AUD: 'A$', CAD: 'C$', SGD: 'S$' };
const cfmt = (n, cur) => (CUR_SYM[cur] || (cur ? cur + ' ' : '₹')) + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const STORE_NAMES = { in: 'India', hk: 'Hong Kong' };
const storeLabel = (s) => `${STORE_NAMES[s.store] || (s.store || 'in').toUpperCase()} · ${CUR_SYM[s.currency] || s.currency || '₹'}`;
const when = (s) => (s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const gstRates = (o) => [...new Set((o.items || []).map((it) => it.gst_rate).filter(Boolean))].sort((a, b) => a - b).map((r) => r + '%').join(' / ');
const SHOP_PAGE = 50;

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };

// Chip helper for tab / filter / store selectors.
const chip = (active) => ({
  border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white,
  color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
  fontFamily: T.headline, fontWeight: 700, fontSize: 12, textTransform: 'capitalize',
});

// KPI tile.
const Kpi = ({ label, value, sub, icon: Icon, tone }) => (
  <IronCard pad={14}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.iron400 }}>
      {Icon && <Icon size={14} color={tone || T.iron500} strokeWidth={1.9} />}
      <Caps size={9} color={T.iron400}>{label}</Caps>
    </div>
    <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.iron900, marginTop: 6, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 4 }}>{sub}</div>}
  </IronCard>
);

export default function AdminOnlineOrders() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  // Deep-link support: the Shopify nav tab opens ?tab=shopify straight to the history view.
  const _initTab = searchParams.get('tab');
  const [tab, setTab] = useState(_initTab === 'shopify' ? 'shopify' : _initTab === 'products' ? 'products' : 'live'); // 'live' | 'shopify' | 'products'

  // ── live storefront orders ──────────────────────────────────────────────
  const [data, setData] = useState({ orders: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/online-orders${filter ? `?status=${filter}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (e) {
      toast.error('Failed to load online orders');
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => { if (tab === 'live') load(); }, [load, tab]);

  // ── historical Shopify orders ───────────────────────────────────────────
  const [shop, setShop] = useState({ orders: [], summary: {} });
  const [shopLoading, setShopLoading] = useState(false);
  const [shopQuery, setShopQuery] = useState('');   // committed search term
  const [shopInput, setShopInput] = useState('');   // text box value
  const [shopPage, setShopPage] = useState(0);
  const [shopOpen, setShopOpen] = useState(null);
  const [shopStore, setShopStore] = useState('in');

  const loadShop = useCallback(async () => {
    setShopLoading(true);
    try {
      const params = new URLSearchParams({ store: shopStore, limit: SHOP_PAGE, skip: shopPage * SHOP_PAGE });
      if (shopQuery) params.set('q', shopQuery);
      const res = await axios.get(`${API}/admin/shopify-orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShop(res.data);
    } catch (e) {
      toast.error('Failed to load Shopify history');
    } finally {
      setShopLoading(false);
    }
  }, [token, shopQuery, shopPage, shopStore]);

  useEffect(() => { if (tab === 'shopify') loadShop(); }, [loadShop, tab]);

  // ── products sold on Shopify (aggregated from order line-items) ──────────
  const [prods, setProds] = useState({ products: [], totals: {} });
  const [prodLoading, setProdLoading] = useState(false);
  const [prodStore, setProdStore] = useState('in');
  const [prodQuery, setProdQuery] = useState('');
  const [prodInput, setProdInput] = useState('');

  const loadProds = useCallback(async () => {
    setProdLoading(true);
    try {
      const params = new URLSearchParams({ store: prodStore });
      if (prodQuery) params.set('q', prodQuery);
      const res = await axios.get(`${API}/admin/shopify-products?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProds(res.data);
    } catch (e) {
      toast.error('Failed to load Shopify products');
    } finally {
      setProdLoading(false);
    }
  }, [token, prodStore, prodQuery]);

  useEffect(() => { if (tab === 'products') loadProds(); }, [loadProds, tab]);

  const runShopSearch = () => { setShopPage(0); setShopQuery(shopInput.trim()); };

  const refreshCurrent = () => {
    if (tab === 'live') load();
    else if (tab === 'shopify') loadShop();
    else loadProds();
  };

  const s = data.summary || {};
  // Live payment-status pill.
  const payBadge = (o) => {
    if (o.payment_status === 'paid') return <span style={badgeStyle('ok')}>Paid · online</span>;
    if (o.payment_status === 'cod_pending') return <span style={badgeStyle('warn')}>COD pending</span>;
    return <span style={badgeStyle('slate')}>{o.payment_status}</span>;
  };

  const setStatus = async (oid, status) => {
    try {
      await axios.patch(`${API}/admin/online-orders/${oid}`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Marked ${status}`);
      load();
    } catch (e) { toast.error('Update failed'); }
  };
  const markCodCollected = async (oid) => {
    try {
      await axios.patch(`${API}/admin/online-orders/${oid}`, { payment_status: 'paid' }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('COD marked collected');
      load();
    } catch (e) { toast.error('Update failed'); }
  };

  // ── Shopify financial-status pill ───────────────────────────────────────
  const shopBadge = (o) => {
    if (o.cancelled_at) return <span style={badgeStyle('bad')}>Cancelled</span>;
    const f = (o.financial_status || '').toLowerCase();
    if (f === 'paid') return <span style={badgeStyle('ok')}>Paid</span>;
    if (f === 'refunded' || f === 'partially_refunded') return <span style={{ ...badgeStyle('bad'), textTransform: 'capitalize' }}>{f.replace('_', ' ')}</span>;
    if (f === 'pending') return <span style={badgeStyle('warn')}>Pending</span>;
    return <span style={{ ...badgeStyle('slate'), textTransform: 'capitalize' }}>{o.financial_status || 'unknown'}</span>;
  };
  const fulfBadge = (o) => {
    const f = (o.fulfillment_status || '').toLowerCase();
    if (f === 'fulfilled') return <span style={badgeStyle('info')}>Fulfilled</span>;
    if (f === 'partial') return <span style={badgeStyle('warn')}>Partial</span>;
    return <span style={badgeStyle('slate')}>Unfulfilled</span>;
  };
  const ss = shop.summary || {};
  const totalPages = Math.max(1, Math.ceil((ss.matching || 0) / SHOP_PAGE));

  const tabs = [
    { id: 'live', label: 'Live storefront', icon: ShoppingCart },
    { id: 'shopify', label: 'Shopify history', icon: History },
    { id: 'products', label: 'Products', icon: Package },
  ];

  const thStyle = { textAlign: 'left', padding: '8px 12px' };
  const cardHead = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', cursor: 'pointer' };
  const detailLabel = { fontFamily: T.headline, fontWeight: 700, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: T.iron400, marginBottom: 6 };
  const lineRow = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2px 0', fontSize: 12.5, color: T.iron700 };

  return (
    <IronShell title="Online Orders" subtitle="STOREFRONT · SHOPIFY IMPORTS" onRefresh={refreshCurrent}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 18, color: T.iron900 }}>Online Orders</div>
        <div style={{ fontSize: 12.5, color: T.iron500, marginTop: 2 }}>Storefront orders (musclegrid.in) and historical Shopify imports</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {tabs.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.id;
          return (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...chip(active), textTransform: 'none' }}>
              <Icon size={14} strokeWidth={2} /> {tb.label}
            </button>
          );
        })}
      </div>

      {/* ════════════════════ LIVE STOREFRONT ════════════════════ */}
      {tab === 'live' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
            <Kpi label="Orders" value={(s.count || 0).toLocaleString('en-IN')} icon={ShoppingCart} tone={T.blue} />
            <Kpi label="To fulfil" value={(s.to_fulfil || 0).toLocaleString('en-IN')} icon={Package} tone={T.voltageText} />
            <Kpi label="Paid revenue" value={fmt(s.revenue_paid)} icon={IndianRupee} tone={T.green} />
            <Kpi label="COD pending" value={fmt(s.cod_pending_value)} icon={Truck} tone={T.orange} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <button onClick={() => setFilter('')} style={{ ...chip(!filter), textTransform: 'none' }}>All</button>
            {STATUSES.map((st) => (
              <button key={st} onClick={() => setFilter(st)} style={chip(filter === st)}>{st}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
          ) : data.orders.length === 0 ? (
            <IronCard style={{ textAlign: 'center', padding: 48, color: T.iron400 }}>No online orders yet.</IronCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.orders.map((o) => (
                <IronCard key={o.id} pad={14}>
                  <div style={cardHead} onClick={() => setOpen(open === o.id ? null : o.id)}>
                    <ChevronDown size={15} color={T.iron400} style={{ transition: 'transform .15s', transform: open === o.id ? 'rotate(180deg)' : 'none' }} />
                    <span style={{ ...mono, fontWeight: 700, color: T.orangeDeep }}>{o.order_number}</span>
                    <span style={{ ...mono, fontSize: 11, color: T.iron400 }}>{when(o.created_at)}</span>
                    <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900 }}>{o.customer_name}</span>
                    <span style={{ ...mono, fontSize: 11, color: T.iron500 }}>{o.customer_phone}</span>
                    <span style={{ fontSize: 11.5, color: T.iron400 }}>· {(o.items || []).length} item(s)</span>
                    <span style={{ flex: 1 }} />
                    {o.gstin && <span style={badgeStyle('warn')} title={`GSTIN ${o.gstin}`}>GST invoice</span>}
                    {payBadge(o)}
                    <span style={{ ...badgeStyle('slate'), textTransform: 'capitalize' }}>{o.status}</span>
                    <span style={{ ...mono, fontWeight: 700, color: T.green }}>{fmt(o.total)}</span>
                  </div>

                  {open === o.id && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.iron200}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <div>
                        <div style={detailLabel}>Items</div>
                        {(o.items || []).map((it, i) => (
                          <div key={i} style={lineRow}>
                            <span>{it.quantity}× {it.title}{it.gst_rate ? <span style={{ color: T.iron400 }}> ({it.gst_rate}% GST)</span> : null}</span>
                            <span style={mono}>{fmt(it.line_total)}</span>
                          </div>
                        ))}
                        {o.gst_included > 0 && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.iron100}` }}>
                            <div style={{ ...lineRow, color: T.iron500 }}><span>Taxable value</span><span style={mono}>{fmt(o.taxable_value)}</span></div>
                            <div style={{ ...lineRow, color: T.iron500 }}><span>GST {gstRates(o)}</span><span style={mono}>{fmt(o.gst_included)}</span></div>
                            <div style={{ ...lineRow, fontWeight: 700, color: T.iron900 }}><span>Total (incl. GST)</span><span style={mono}>{fmt(o.total)}</span></div>
                            {o.gstin && <div style={{ marginTop: 8, fontSize: 11, color: T.voltageText }}>🧾 GST invoice → GSTIN <b>{o.gstin}</b></div>}
                          </div>
                        )}
                        <div style={{ ...detailLabel, marginTop: 14 }}>Ship to</div>
                        <div style={{ fontSize: 12.5, color: T.iron700 }}>
                          {o.shipping?.name} · {o.shipping?.phone}<br />
                          {o.shipping?.address}, {o.shipping?.city} {o.shipping?.pincode}
                        </div>
                        {o.customer_email && <div style={{ fontSize: 12, color: T.iron500, marginTop: 4 }}>{o.customer_email}</div>}
                      </div>
                      <div>
                        <div style={detailLabel}>Update status</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {STATUSES.map((st) => (
                            <button key={st} onClick={() => setStatus(o.id, st)} style={chip(o.status === st)}>{st}</button>
                          ))}
                        </div>
                        {o.payment_status === 'cod_pending' && (
                          <button onClick={() => markCodCollected(o.id)} style={{ ...btnPrimary, background: T.green, marginTop: 12 }}>Mark COD collected</button>
                        )}
                      </div>
                    </div>
                  )}
                </IronCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* ════════════════════ SHOPIFY HISTORY ════════════════════ */}
      {tab === 'shopify' && (
        <>
          {(shop.stores || []).length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <Caps size={9} color={T.iron400}>Store</Caps>
              {(shop.stores || []).map((st) => (
                <button key={st.store} onClick={() => { setShopStore(st.store); setShopPage(0); setShopOpen(null); }}
                  style={{ ...chip(shopStore === st.store), textTransform: 'none' }}>
                  {storeLabel(st)} <span style={{ opacity: 0.7 }}>({st.count.toLocaleString('en-IN')})</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
            <Kpi label="Imported orders" value={(ss.store_orders || 0).toLocaleString('en-IN')} sub={ss.cancelled_count ? `${ss.cancelled_count} cancelled` : null} icon={History} tone={T.blue} />
            <Kpi label="Paid revenue" value={cfmt(ss.paid_revenue, ss.currency)} sub="paid, excl. cancelled" icon={IndianRupee} tone={T.green} />
            <Kpi label="Pending payment" value={cfmt(ss.pending_value, ss.currency)} sub="placed, not captured" icon={Truck} tone={T.voltageText} />
            <Kpi label={shopQuery ? `Matching “${shopQuery}”` : 'Showing'} value={(ss.matching ?? 0).toLocaleString('en-IN')} icon={Search} tone={T.iron500} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
              <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 10, top: 9 }} />
              <input
                value={shopInput}
                onChange={(e) => setShopInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runShopSearch()}
                placeholder="Search order #, customer, phone or email…"
                style={{ ...inputStyle, width: '100%', paddingLeft: 32 }}
              />
            </div>
            <button onClick={runShopSearch} style={btnPrimary}>Search</button>
            {shopQuery && (
              <button onClick={() => { setShopInput(''); setShopQuery(''); setShopPage(0); }} style={btnOutline}>Clear</button>
            )}
          </div>

          {shopLoading ? (
            <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
          ) : shop.orders.length === 0 ? (
            <IronCard style={{ textAlign: 'center', padding: 48, color: T.iron400 }}>{shopQuery ? 'No orders match your search.' : 'No Shopify orders imported.'}</IronCard>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {shop.orders.map((o) => (
                  <IronCard key={o.id} pad={14}>
                    <div style={cardHead} onClick={() => setShopOpen(shopOpen === o.id ? null : o.id)}>
                      <ChevronDown size={15} color={T.iron400} style={{ transition: 'transform .15s', transform: shopOpen === o.id ? 'rotate(180deg)' : 'none' }} />
                      <span style={{ ...mono, fontWeight: 700, color: T.orangeDeep }}>{o.order_number}</span>
                      <span style={{ ...mono, fontSize: 11, color: T.iron400 }}>{when(o.shopify_created_at || o.created_at)}</span>
                      <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900 }}>{o.customer_name || '—'}</span>
                      <span style={{ ...mono, fontSize: 11, color: T.iron500 }}>{o.phone}</span>
                      <span style={{ fontSize: 11.5, color: T.iron400 }}>· {(o.line_items || []).length} item(s)</span>
                      <span style={{ flex: 1 }} />
                      {shopBadge(o)}
                      {fulfBadge(o)}
                      <span style={{ ...mono, fontWeight: 700, color: T.green }}>{cfmt(o.total_price, o.currency)}</span>
                    </div>

                    {shopOpen === o.id && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.iron200}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        <div>
                          <div style={detailLabel}>Items</div>
                          {(o.line_items || []).map((it, i) => (
                            <div key={i} style={lineRow}>
                              <span>{it.quantity}× {it.title}{it.variant ? <span style={{ color: T.iron400 }}> · {it.variant}</span> : null}{it.resolved_sku ? <span style={{ color: T.iron400 }}> [{it.resolved_sku}]</span> : null}</span>
                              <span style={{ ...mono, whiteSpace: 'nowrap' }}>{cfmt((it.price || 0) * (it.quantity || 1), o.currency)}</span>
                            </div>
                          ))}
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.iron100}` }}>
                            <div style={{ ...lineRow, color: T.iron500 }}><span>Subtotal</span><span style={mono}>{cfmt(o.subtotal_price, o.currency)}</span></div>
                            {o.total_tax > 0 && <div style={{ ...lineRow, color: T.iron500 }}><span>Tax {o.price_tax_inclusive ? '(incl.)' : ''}</span><span style={mono}>{cfmt(o.total_tax, o.currency)}</span></div>}
                            <div style={{ ...lineRow, fontWeight: 700, color: T.iron900 }}><span>Total</span><span style={mono}>{cfmt(o.total_price, o.currency)}</span></div>
                          </div>
                        </div>
                        <div>
                          <div style={detailLabel}>Ship to</div>
                          <div style={{ fontSize: 12.5, color: T.iron700 }}>
                            {[o.shipping_address?.address1, o.shipping_address?.address2].filter(Boolean).join(', ') || '—'}<br />
                            {[o.shipping_address?.city, o.shipping_address?.province, o.shipping_address?.zip].filter(Boolean).join(', ')}
                            {o.shipping_address?.phone ? <><br />{o.shipping_address.phone}</> : null}
                          </div>
                          {o.email && <div style={{ fontSize: 12, color: T.iron500, marginTop: 8 }}>{o.email}</div>}
                          {o.tags && <div style={{ fontSize: 11, color: T.iron400, marginTop: 8 }}>Tags: {o.tags}</div>}
                          <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 8 }}>Imported from Shopify · read-only</div>
                        </div>
                      </div>
                    )}
                  </IronCard>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <Caps size={9} color={T.iron400}>Page {shopPage + 1} of {totalPages} · {(ss.matching || 0).toLocaleString('en-IN')} orders</Caps>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={shopPage === 0} onClick={() => setShopPage((p) => Math.max(0, p - 1))}
                    style={{ ...btnOutline, opacity: shopPage === 0 ? 0.4 : 1, cursor: shopPage === 0 ? 'default' : 'pointer' }}>Prev</button>
                  <button disabled={shopPage + 1 >= totalPages} onClick={() => setShopPage((p) => p + 1)}
                    style={{ ...btnOutline, opacity: shopPage + 1 >= totalPages ? 0.4 : 1, cursor: shopPage + 1 >= totalPages ? 'default' : 'pointer' }}>Next</button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ════════════════════ PRODUCTS ════════════════════ */}
      {tab === 'products' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Caps size={9} color={T.iron400}>Store</Caps>
            {['in', 'hk'].map((st) => (
              <button key={st} onClick={() => setProdStore(st)} style={{ ...chip(prodStore === st), textTransform: 'none' }}>
                {STORE_NAMES[st]}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <Kpi label="Products sold" value={prods.totals?.products || 0} icon={Package} tone={T.blue} />
            <Kpi label="Units sold" value={(prods.totals?.units || 0).toLocaleString('en-IN')} icon={ShoppingCart} tone={T.iron700} />
            <Kpi label="Revenue (non-cancelled)" value={cfmt(prods.totals?.revenue, prods.totals?.currency)} icon={IndianRupee} tone={T.green} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={prodInput} onChange={(e) => setProdInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setProdQuery(prodInput)}
              placeholder="Search product or SKU…"
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => setProdQuery(prodInput)} style={btnPrimary}>Search</button>
          </div>

          {prodLoading ? (
            <div style={{ display: 'grid', placeItems: 'center', height: 200 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
          ) : (prods.products || []).length === 0 ? (
            <IronCard style={{ textAlign: 'center', padding: 40, color: T.iron400 }}>No products found.</IronCard>
          ) : (
            <IronCard pad={0} style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      <th style={thStyle}><Caps size={8.5}>Product</Caps></th>
                      <th style={thStyle}><Caps size={8.5}>SKU</Caps></th>
                      <th style={{ ...thStyle, textAlign: 'right' }}><Caps size={8.5}>Units</Caps></th>
                      <th style={{ ...thStyle, textAlign: 'right' }}><Caps size={8.5}>Revenue</Caps></th>
                      <th style={{ ...thStyle, textAlign: 'right' }}><Caps size={8.5}>Orders</Caps></th>
                      <th style={thStyle}><Caps size={8.5}>Last sold</Caps></th>
                    </tr>
                  </thead>
                  <tbody>
                    {prods.products.map((p, i) => (
                      <tr key={i} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={{ padding: '10px 12px', fontSize: 12.5, color: T.iron900 }}>
                          {p.name}
                          {(p.variants || []).filter(Boolean).length > 0 && (
                            <span style={{ fontSize: 11, color: T.iron400, marginLeft: 4 }}>({p.variants.filter(Boolean).join(', ')})</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', ...mono, fontSize: 11, color: T.iron500 }}>{p.sku || '—'}</td>
                        <td style={{ padding: '10px 12px', ...mono, fontSize: 12.5, fontWeight: 700, color: T.iron900, textAlign: 'right' }}>{p.units}</td>
                        <td style={{ padding: '10px 12px', ...mono, fontSize: 12.5, color: T.green, textAlign: 'right' }}>{cfmt(p.revenue, prods.totals?.currency)}</td>
                        <td style={{ padding: '10px 12px', ...mono, fontSize: 12.5, color: T.iron700, textAlign: 'right' }}>{p.order_count}</td>
                        <td style={{ padding: '10px 12px', ...mono, fontSize: 11, color: T.iron500 }}>{p.last_sold ? new Date(p.last_sold).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IronCard>
          )}
        </div>
      )}
    </IronShell>
  );
}

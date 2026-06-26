import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShoppingCart, IndianRupee, Truck, Package, ChevronDown, RefreshCw, Search, History } from 'lucide-react';

const STATUSES = ['confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const CUR_SYM = { INR: '₹', HKD: 'HK$', USD: '$', GBP: '£', EUR: '€', AUD: 'A$', CAD: 'C$', SGD: 'S$' };
const cfmt = (n, cur) => (CUR_SYM[cur] || (cur ? cur + ' ' : '₹')) + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const STORE_NAMES = { in: 'India', hk: 'Hong Kong' };
const storeLabel = (s) => `${STORE_NAMES[s.store] || (s.store || 'in').toUpperCase()} · ${CUR_SYM[s.currency] || s.currency || '₹'}`;
const when = (s) => (s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const gstRates = (o) => [...new Set((o.items || []).map((it) => it.gst_rate).filter(Boolean))].sort((a, b) => a - b).map((r) => r + '%').join(' / ');
const SHOP_PAGE = 50;

export default function AdminOnlineOrders() {
  const { token } = useAuth();
  const [tab, setTab] = useState('live'); // 'live' | 'shopify'

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

  const runShopSearch = () => { setShopPage(0); setShopQuery(shopInput.trim()); };

  const s = data.summary || {};
  const payBadge = (o) => {
    if (o.payment_status === 'paid') return <Badge className="bg-green-600">Paid · online</Badge>;
    if (o.payment_status === 'cod_pending') return <Badge className="bg-amber-600">COD pending</Badge>;
    return <Badge className="bg-slate-600">{o.payment_status}</Badge>;
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

  // ── Shopify financial-status badge ──────────────────────────────────────
  const shopBadge = (o) => {
    if (o.cancelled_at) return <Badge className="bg-red-700">Cancelled</Badge>;
    const f = (o.financial_status || '').toLowerCase();
    if (f === 'paid') return <Badge className="bg-green-600">Paid</Badge>;
    if (f === 'refunded' || f === 'partially_refunded') return <Badge className="bg-orange-600 capitalize">{f.replace('_', ' ')}</Badge>;
    if (f === 'pending') return <Badge className="bg-amber-600">Pending</Badge>;
    return <Badge className="bg-slate-600 capitalize">{o.financial_status || 'unknown'}</Badge>;
  };
  const fulfBadge = (o) => {
    const f = (o.fulfillment_status || '').toLowerCase();
    if (f === 'fulfilled') return <Badge className="bg-cyan-700">Fulfilled</Badge>;
    if (f === 'partial') return <Badge className="bg-amber-700">Partial</Badge>;
    return <Badge className="bg-slate-700">Unfulfilled</Badge>;
  };
  const ss = shop.summary || {};
  const totalPages = Math.max(1, Math.ceil((ss.matching || 0) / SHOP_PAGE));

  const TabBtn = ({ id, label, icon: Icon }) => (
    <button onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition ${
        tab === id ? 'border-cyan-500 text-white bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  return (
    <DashboardLayout title="Online Orders">
      <div className="mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-white">Online Orders</h2>
        <p className="text-sm text-slate-400">Storefront orders (musclegrid.in) and historical Shopify imports</p>
      </div>

      <div className="flex gap-1 border-b border-slate-700 mb-5">
        <TabBtn id="live" label="Live storefront" icon={ShoppingCart} />
        <TabBtn id="shopify" label="Shopify history" icon={History} />
      </div>

      {/* ════════════════════ LIVE STOREFRONT ════════════════════ */}
      {tab === 'live' && (
        <>
          <div className="mb-3 flex justify-end">
            <button onClick={load} className="flex items-center gap-2 text-cyan-400 border border-cyan-700 rounded px-3 py-1.5 text-sm hover:bg-cyan-600/20">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Orders', val: s.count || 0, icon: ShoppingCart, c: 'text-cyan-400' },
              { label: 'To fulfil', val: s.to_fulfil || 0, icon: Package, c: 'text-amber-400' },
              { label: 'Paid revenue', val: fmt(s.revenue_paid), icon: IndianRupee, c: 'text-green-400' },
              { label: 'COD pending', val: fmt(s.cod_pending_value), icon: Truck, c: 'text-orange-400' },
            ].map((k) => (
              <Card key={k.label} className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-xs"><k.icon className={`w-4 h-4 ${k.c}`} />{k.label}</div>
                  <div className={`text-xl font-bold mt-1 ${k.c}`}>{k.val}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 mb-3 flex-wrap">
            <button onClick={() => setFilter('')} className={`px-3 py-1 rounded text-sm ${!filter ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'}`}>All</button>
            {STATUSES.map((st) => (
              <button key={st} onClick={() => setFilter(st)} className={`px-3 py-1 rounded text-sm capitalize ${filter === st ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'}`}>{st}</button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>
          ) : data.orders.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700"><CardContent className="p-12 text-center text-slate-400">No online orders yet.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {data.orders.map((o) => (
                <Card key={o.id} className="bg-slate-800 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 flex-wrap cursor-pointer" onClick={() => setOpen(open === o.id ? null : o.id)}>
                      <ChevronDown className={`w-4 h-4 text-slate-500 transition ${open === o.id ? 'rotate-180' : ''}`} />
                      <span className="font-mono font-bold text-white">{o.order_number}</span>
                      <span className="text-slate-400 text-sm">{when(o.created_at)}</span>
                      <span className="text-white">{o.customer_name}</span>
                      <span className="text-slate-400 text-sm">{o.customer_phone}</span>
                      <span className="text-slate-400 text-sm">· {(o.items || []).length} item(s)</span>
                      <span className="flex-1" />
                      {o.gstin && <Badge className="bg-amber-600" title={`GSTIN ${o.gstin}`}>GST invoice</Badge>}
                      {payBadge(o)}
                      <Badge className="bg-slate-700 capitalize">{o.status}</Badge>
                      <span className="font-bold text-green-400">{fmt(o.total)}</span>
                    </div>

                    {open === o.id && (
                      <div className="mt-4 pt-4 border-t border-slate-700 grid md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">ITEMS</div>
                          {(o.items || []).map((it, i) => (
                            <div key={i} className="text-sm text-slate-300 flex justify-between py-0.5">
                              <span>{it.quantity}× {it.title}{it.gst_rate ? <span className="text-slate-500"> ({it.gst_rate}% GST)</span> : null}</span><span>{fmt(it.line_total)}</span>
                            </div>
                          ))}
                          {o.gst_included > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-700/50 text-sm">
                              <div className="flex justify-between py-0.5 text-slate-400"><span>Taxable value</span><span>{fmt(o.taxable_value)}</span></div>
                              <div className="flex justify-between py-0.5 text-slate-400"><span>GST {gstRates(o)}</span><span>{fmt(o.gst_included)}</span></div>
                              <div className="flex justify-between py-0.5 font-bold text-white"><span>Total (incl. GST)</span><span>{fmt(o.total)}</span></div>
                              {o.gstin && <div className="mt-2 text-amber-400 text-xs">🧾 GST invoice → GSTIN <b>{o.gstin}</b></div>}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 mt-3 mb-1">SHIP TO</div>
                          <div className="text-sm text-slate-300">
                            {o.shipping?.name} · {o.shipping?.phone}<br />
                            {o.shipping?.address}, {o.shipping?.city} {o.shipping?.pincode}
                          </div>
                          {o.customer_email && <div className="text-sm text-slate-400 mt-1">{o.customer_email}</div>}
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-2">UPDATE STATUS</div>
                          <div className="flex flex-wrap gap-2">
                            {STATUSES.map((st) => (
                              <button key={st} onClick={() => setStatus(o.id, st)}
                                className={`px-3 py-1.5 rounded text-sm capitalize ${o.status === st ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{st}</button>
                            ))}
                          </div>
                          {o.payment_status === 'cod_pending' && (
                            <button onClick={() => markCodCollected(o.id)} className="mt-3 px-3 py-1.5 rounded text-sm bg-green-700 text-white hover:bg-green-600">Mark COD collected</button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ════════════════════ SHOPIFY HISTORY ════════════════════ */}
      {tab === 'shopify' && (
        <>
          {(shop.stores || []).length > 1 && (
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <span className="text-xs text-slate-500 uppercase tracking-wide">Store</span>
              {(shop.stores || []).map((st) => (
                <button key={st.store} onClick={() => { setShopStore(st.store); setShopPage(0); setShopOpen(null); }}
                  className={`px-3 py-1.5 rounded text-sm ${shopStore === st.store ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                  {storeLabel(st)} <span className="opacity-70">({st.count.toLocaleString('en-IN')})</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Imported orders', val: (ss.store_orders || 0).toLocaleString('en-IN'), icon: History, c: 'text-cyan-400' },
              { label: 'Lifetime revenue', val: cfmt(ss.store_revenue, ss.currency), icon: IndianRupee, c: 'text-green-400' },
              { label: shopQuery ? `Matching “${shopQuery}”` : 'Showing', val: (ss.matching ?? 0).toLocaleString('en-IN'), icon: Search, c: 'text-amber-400' },
            ].map((k) => (
              <Card key={k.label} className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-xs"><k.icon className={`w-4 h-4 ${k.c}`} />{k.label}</div>
                  <div className={`text-xl font-bold mt-1 ${k.c}`}>{k.val}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 mb-4 flex-wrap items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={shopInput}
                onChange={(e) => setShopInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runShopSearch()}
                placeholder="Search order #, customer, phone or email…"
                className="w-full bg-slate-800 border border-slate-700 rounded pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-600"
              />
            </div>
            <button onClick={runShopSearch} className="px-4 py-2 rounded text-sm bg-cyan-600 text-white hover:bg-cyan-500">Search</button>
            {shopQuery && (
              <button onClick={() => { setShopInput(''); setShopQuery(''); setShopPage(0); }} className="px-3 py-2 rounded text-sm bg-slate-700 text-slate-300 hover:bg-slate-600">Clear</button>
            )}
          </div>

          {shopLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>
          ) : shop.orders.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700"><CardContent className="p-12 text-center text-slate-400">{shopQuery ? 'No orders match your search.' : 'No Shopify orders imported.'}</CardContent></Card>
          ) : (
            <>
              <div className="space-y-2">
                {shop.orders.map((o) => (
                  <Card key={o.id} className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 flex-wrap cursor-pointer" onClick={() => setShopOpen(shopOpen === o.id ? null : o.id)}>
                        <ChevronDown className={`w-4 h-4 text-slate-500 transition ${shopOpen === o.id ? 'rotate-180' : ''}`} />
                        <span className="font-mono font-bold text-white">{o.order_number}</span>
                        <span className="text-slate-400 text-sm">{when(o.shopify_created_at || o.created_at)}</span>
                        <span className="text-white">{o.customer_name || '—'}</span>
                        <span className="text-slate-400 text-sm">{o.phone}</span>
                        <span className="text-slate-400 text-sm">· {(o.line_items || []).length} item(s)</span>
                        <span className="flex-1" />
                        {shopBadge(o)}
                        {fulfBadge(o)}
                        <span className="font-bold text-green-400">{cfmt(o.total_price, o.currency)}</span>
                      </div>

                      {shopOpen === o.id && (
                        <div className="mt-4 pt-4 border-t border-slate-700 grid md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">ITEMS</div>
                            {(o.line_items || []).map((it, i) => (
                              <div key={i} className="text-sm text-slate-300 flex justify-between py-0.5 gap-3">
                                <span>{it.quantity}× {it.title}{it.variant ? <span className="text-slate-500"> · {it.variant}</span> : null}{it.resolved_sku ? <span className="text-slate-500"> [{it.resolved_sku}]</span> : null}</span>
                                <span className="whitespace-nowrap">{cfmt((it.price || 0) * (it.quantity || 1), o.currency)}</span>
                              </div>
                            ))}
                            <div className="mt-2 pt-2 border-t border-slate-700/50 text-sm">
                              <div className="flex justify-between py-0.5 text-slate-400"><span>Subtotal</span><span>{cfmt(o.subtotal_price, o.currency)}</span></div>
                              {o.total_tax > 0 && <div className="flex justify-between py-0.5 text-slate-400"><span>Tax {o.price_tax_inclusive ? '(incl.)' : ''}</span><span>{cfmt(o.total_tax, o.currency)}</span></div>}
                              <div className="flex justify-between py-0.5 font-bold text-white"><span>Total</span><span>{cfmt(o.total_price, o.currency)}</span></div>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">SHIP TO</div>
                            <div className="text-sm text-slate-300">
                              {[o.shipping_address?.address1, o.shipping_address?.address2].filter(Boolean).join(', ') || '—'}<br />
                              {[o.shipping_address?.city, o.shipping_address?.province, o.shipping_address?.zip].filter(Boolean).join(', ')}
                              {o.shipping_address?.phone ? <><br />{o.shipping_address.phone}</> : null}
                            </div>
                            {o.email && <div className="text-sm text-slate-400 mt-2">{o.email}</div>}
                            {o.tags && <div className="text-xs text-slate-500 mt-2">Tags: {o.tags}</div>}
                            <div className="text-xs text-slate-600 mt-2">Imported from Shopify · read-only</div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
                <span>Page {shopPage + 1} of {totalPages} · {(ss.matching || 0).toLocaleString('en-IN')} orders</span>
                <div className="flex gap-2">
                  <button disabled={shopPage === 0} onClick={() => setShopPage((p) => Math.max(0, p - 1))}
                    className="px-3 py-1.5 rounded bg-slate-700 text-slate-200 disabled:opacity-40 hover:bg-slate-600">Prev</button>
                  <button disabled={shopPage + 1 >= totalPages} onClick={() => setShopPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded bg-slate-700 text-slate-200 disabled:opacity-40 hover:bg-slate-600">Next</button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Plus, Minus, Trash2, Loader2, Package, ArrowRight,
  AlertTriangle, IndianRupee
} from 'lucide-react';

export default function DealerPlaceOrder() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [canOrder, setCanOrder] = useState(false);
  const [notes, setNotes] = useState('');
  const [credit, setCredit] = useState({ limit: 0, outstanding: 0 });

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    try {
      const [productsRes, dashboardRes] = await Promise.all([
        axios.get(`${API}/dealer/products`, { headers: { Authorization: `Bearer ${token}` }}),
        axios.get(`${API}/dealer/dashboard`, { headers: { Authorization: `Bearer ${token}` }})
      ]);
      setProducts(productsRes.data || []);
      setCanOrder(dashboardRes.data.can_place_orders);
      setCredit({
        limit: Number(dashboardRes.data?.dealer?.credit_limit || 0),
        outstanding: Number(dashboardRes.data?.stats?.outstanding_balance || 0),
      });
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        unit_price: product.dealer_price,
        gst_rate: product.gst_rate,
        quantity: 1
      }]);
    }
    toast.success(`${product.name} added to cart`);
  };

  const updateQuantity = (productId, delta) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const subtotal = item.unit_price * item.quantity;
      const gst = subtotal * (item.gst_rate / 100);
      return sum + subtotal + gst;
    }, 0);
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`${API}/dealer/orders`, {
        items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity })),
        notes: notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`Order ${response.data.order_number} created successfully`);
      navigate(`/dealer/orders/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <DashboardLayout title="Place Order">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canOrder) {
    return (
      <DashboardLayout title="Place Order">
        <div className="mg-card mx-auto max-w-lg rounded-lg border border-amber-400/25 bg-amber-400/10 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15">
            <AlertTriangle className="h-7 w-7 text-amber-400" />
          </div>
          <h3 className="text-lg font-bold text-amber-400 mb-2">Cannot Place Orders</h3>
          <p className="text-[13px] text-amber-400/80 mb-5">
            Your dealer account must be approved before you can place orders.
            Please contact admin if you believe this is an error.
          </p>
          <Link to="/dealer/deposit">
            <button className="inline-flex items-center gap-2 rounded bg-amber-400/20 border border-amber-400/30 px-4 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-400/30 transition-colors">
              Check Account Status
            </button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Place Order">
      {/* Page header */}
      <div className="mb-5">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Order desk · Live
          </span>
        </div>
        <h2 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">Place Order</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono font-semibold text-primary tabular-nums">{products.length}</span> products available
        </p>
      </div>

      {/* Credit / balance snapshot */}
      {(() => {
        const limit = credit.limit || 0;
        const outstanding = credit.outstanding || 0;
        const cartTotal = calculateTotal();
        const available = limit > 0 ? limit - outstanding : null;
        const over = limit > 0 && (outstanding + cartTotal) > limit;
        const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
        return (
          <div className={`mb-5 rounded-lg border p-4 flex flex-wrap items-center gap-x-8 gap-y-2 ${over ? 'border-rose-500/40 bg-rose-500/[0.06]' : 'border-border bg-card'}`}>
            <div><div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Credit Limit</div>
              <div className="font-mono font-semibold text-foreground">{limit > 0 ? inr(limit) : 'Unlimited'}</div></div>
            <div><div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Outstanding</div>
              <div className={`font-mono font-semibold ${outstanding < 0 ? 'text-rose-400' : 'text-foreground'}`}>{inr(Math.abs(outstanding))}{outstanding < 0 ? ' Dr' : ''}</div></div>
            {available != null && (
              <div><div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Available Credit</div>
                <div className={`font-mono font-semibold ${available <= 0 ? 'text-rose-400' : 'text-emerald-500'}`}>{inr(available)}</div></div>
            )}
            {over && <div className="ml-auto text-xs font-semibold text-rose-400">This order exceeds your available credit — clear dues or contact us to proceed.</div>}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Catalog */}
        <div className="lg:col-span-2">
          <div className="mg-card rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Package className="h-4 w-4 text-primary" />
              <h3 className="text-[15px] font-semibold text-foreground">Product Catalog</h3>
            </div>
            <div className="p-4">
              {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Package className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No products available</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">Check back later or contact your account manager.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {products.map((product) => {
                    const inCart = cart.find(i => i.product_id === product.id);
                    return (
                      <div
                        key={product.id}
                        className={`mg-card rounded-lg border bg-muted/30 p-4 transition-all ${
                          inCart ? 'border-primary/40' : 'border-border hover:border-border/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-foreground truncate">{product.name}</h4>
                            <p className="font-mono text-[11px] text-muted-foreground">{product.sku}</p>
                          </div>
                          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 bg-muted text-muted-foreground ring-border">
                            {product.category}
                          </span>
                        </div>

                        <div className="flex items-end justify-between">
                          <div>
                            <p className="font-mono text-[10px] text-muted-foreground line-through">
                              MRP {formatCurrency(product.mrp)}
                            </p>
                            <p className="font-mono text-lg font-bold tabular-nums text-primary">
                              {formatCurrency(product.dealer_price)}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground/70">
                              +{product.gst_rate}% GST
                            </p>
                          </div>

                          {inCart ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(product.id, -1)}
                                className="flex h-7 w-7 items-center justify-center rounded bg-secondary text-foreground hover:bg-accent transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="font-mono text-sm font-bold tabular-nums text-foreground w-6 text-center">
                                {inCart.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(product.id, 1)}
                                className="flex h-7 w-7 items-center justify-center rounded bg-secondary text-foreground hover:bg-accent transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(product)}
                              className="inline-flex items-center gap-1.5 rounded bg-primary/15 border border-primary/25 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25 transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cart */}
        <div>
          <div className="mg-card sticky top-20 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <h3 className="text-[15px] font-semibold text-foreground">Your Cart</h3>
              </div>
              {cart.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground px-1">
                  {cart.length}
                </span>
              )}
            </div>

            <div className="p-4">
              {cart.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <ShoppingCart className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">Cart is empty</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/60">Add products from the catalog</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {cart.map((item) => (
                      <div key={item.product_id} className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{item.product_name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{item.sku}</p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.product_id)}
                            className="flex-shrink-0 p-1 rounded text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => updateQuantity(item.product_id, -1)}
                              className="flex h-6 w-6 items-center justify-center rounded bg-secondary text-foreground hover:bg-accent transition-colors"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="font-mono text-sm font-bold tabular-nums text-foreground w-7 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.product_id, 1)}
                              className="flex h-6 w-6 items-center justify-center rounded bg-secondary text-foreground hover:bg-accent transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="font-mono text-sm font-bold tabular-nums text-primary">
                            {formatCurrency(item.unit_price * item.quantity * (1 + item.gst_rate / 100))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order total + submit */}
                  <div className="border-t border-border pt-4 space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Total (incl. GST)
                      </span>
                      <span className="font-mono text-xl font-bold tabular-nums text-foreground flex items-center gap-0.5">
                        <IndianRupee className="h-4 w-4" />
                        {calculateTotal().toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>

                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Order notes (optional)"
                    />

                    <button
                      onClick={handleSubmitOrder}
                      disabled={submitting || cart.length === 0}
                      className="w-full inline-flex items-center justify-center gap-2 rounded bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      Place Order
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Plus, Minus, Trash2, Loader2, Package, ArrowRight,
  AlertTriangle, IndianRupee
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';

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

  const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '8px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
  const iconBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 28, width: 28, borderRadius: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, cursor: 'pointer' };
  const iconBtnSm = { ...iconBtn, height: 24, width: 24 };

  if (loading) {
    return (
      <IronShell title="Place Order" subtitle="ORDER DESK">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
          <Loader2 className="w-8 h-8 animate-spin" color={T.orange} />
        </div>
      </IronShell>
    );
  }

  if (!canOrder) {
    return (
      <IronShell title="Place Order" subtitle="ORDER DESK">
        <IronCard pad={0} style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', borderColor: '#F6D8BA', background: '#FDEEE6' }}>
          <div style={{ padding: 32 }}>
            <div style={{ margin: '0 auto 16px', display: 'flex', height: 56, width: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: '#F6D8BA' }}>
              <AlertTriangle style={{ height: 28, width: 28 }} color={T.orangeDeep} />
            </div>
            <h3 style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 17, color: T.orangeDeep, marginBottom: 8 }}>Cannot Place Orders</h3>
            <p style={{ fontSize: 13, color: T.iron700, marginBottom: 20 }}>
              Your dealer account must be approved before you can place orders.
              Please contact admin if you believe this is an error.
            </p>
            <Link to="/dealer/deposit">
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 6, border: 'none', background: T.orange, color: '#fff', padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                Check Account Status
              </button>
            </Link>
          </div>
        </IronCard>
      </IronShell>
    );
  }

  const limit = credit.limit || 0;
  const outstanding = credit.outstanding || 0;
  const cartTotal = calculateTotal();
  const available = limit > 0 ? limit - outstanding : null;
  const over = limit > 0 && (outstanding + cartTotal) > limit;
  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <IronShell
      title="Place Order"
      subtitle={`${products.length} PRODUCTS AVAILABLE`}
      onRefresh={fetchData}
    >
      {/* Live pill header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8 }}>
            <span style={{ position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: 999, background: T.green, opacity: 0.5 }} className="animate-ping" />
            <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8, borderRadius: 999, background: T.green }} />
          </span>
          <Caps size={10} color={T.iron500} ls=".14em">Order Desk · Live</Caps>
        </div>
        <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 30, lineHeight: 1.05, color: T.iron900 }}>Place Order</div>
        <div style={{ marginTop: 4, fontSize: 13, color: T.iron500 }}>
          <span style={{ ...mono, fontWeight: 700, color: T.orange }}>{products.length}</span> products available
        </div>
      </div>

      {/* Credit / balance snapshot */}
      <IronCard pad={0} style={{ marginBottom: 18, ...(over ? { borderColor: '#F6D8BA', background: '#FDEEE6' } : {}) }}>
        <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 32, rowGap: 8 }}>
          <div>
            <Caps size={9} color={T.iron400}>Credit Limit</Caps>
            <div style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{limit > 0 ? inr(limit) : 'Unlimited'}</div>
          </div>
          <div>
            <Caps size={9} color={T.iron400}>Outstanding</Caps>
            <div style={{ ...mono, fontWeight: 700, color: outstanding < 0 ? T.orangeDeep : T.iron900 }}>{inr(Math.abs(outstanding))}{outstanding < 0 ? ' Dr' : ''}</div>
          </div>
          {available != null && (
            <div>
              <Caps size={9} color={T.iron400}>Available Credit</Caps>
              <div style={{ ...mono, fontWeight: 700, color: available <= 0 ? T.orangeDeep : T.green }}>{inr(available)}</div>
            </div>
          )}
          {over && <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: T.orangeDeep }}>This order exceeds your available credit — clear dues or contact us to proceed.</div>}
        </div>
      </IronCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        {/* Product Catalog */}
        <div>
          <IronCard pad={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.iron200}`, padding: '14px 18px' }}>
              <Package style={{ height: 16, width: 16 }} color={T.orange} />
              <h3 style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14.5, color: T.iron900 }}>Product Catalog</h3>
            </div>
            <div style={{ padding: 16 }}>
              {products.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', textAlign: 'center' }}>
                  <div style={{ marginBottom: 12, display: 'flex', height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: T.iron100 }}>
                    <Package style={{ height: 24, width: 24 }} color={T.iron400} />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.iron900 }}>No products available</p>
                  <p style={{ marginTop: 4, fontSize: 12, color: T.iron500 }}>Check back later or contact your account manager.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {products.map((product) => {
                    const inCart = cart.find(i => i.product_id === product.id);
                    return (
                      <div
                        key={product.id}
                        style={{ borderRadius: 8, border: `1px solid ${inCart ? T.orange : T.iron200}`, background: inCart ? '#FDEEE6' : T.iron50, padding: 16 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                          <div style={{ minWidth: 0 }}>
                            <h4 style={{ fontSize: 13.5, fontWeight: 700, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</h4>
                            <p style={{ ...mono, fontSize: 11, color: T.iron500 }}>{product.sku}</p>
                          </div>
                          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, ...mono, fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', background: T.iron100, color: T.iron700, border: `1px solid ${T.iron200}` }}>
                            {product.category}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                          <div>
                            <p style={{ ...mono, fontSize: 10, color: T.iron400, textDecoration: 'line-through' }}>
                              MRP {formatCurrency(product.mrp)}
                            </p>
                            <p style={{ ...mono, fontSize: 18, fontWeight: 800, color: T.orange }}>
                              {formatCurrency(product.dealer_price)}
                            </p>
                            <p style={{ ...mono, fontSize: 10, color: T.iron400 }}>
                              +{product.gst_rate}% GST
                            </p>
                          </div>

                          {inCart ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button onClick={() => updateQuantity(product.id, -1)} style={iconBtn}>
                                <Minus style={{ height: 12, width: 12 }} />
                              </button>
                              <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: T.iron900, width: 24, textAlign: 'center' }}>
                                {inCart.quantity}
                              </span>
                              <button onClick={() => updateQuantity(product.id, 1)} style={iconBtn}>
                                <Plus style={{ height: 12, width: 12 }} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(product)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6, border: 'none', background: T.orange, color: '#fff', padding: '7px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                            >
                              <Plus style={{ height: 12, width: 12 }} />
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
          </IronCard>
        </div>

        {/* Cart */}
        <div>
          <IronCard pad={0} style={{ position: 'sticky', top: 80 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.iron200}`, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCart style={{ height: 16, width: 16 }} color={T.orange} />
                <h3 style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14.5, color: T.iron900 }}>Your Cart</h3>
              </div>
              {cart.length > 0 && (
                <span style={{ display: 'flex', height: 20, minWidth: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: T.orange, ...mono, fontSize: 10, fontWeight: 700, color: '#fff', padding: '0 4px' }}>
                  {cart.length}
                </span>
              )}
            </div>

            <div style={{ padding: 16 }}>
              {cart.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center' }}>
                  <div style={{ margin: '0 auto 12px', display: 'flex', height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: T.iron100 }}>
                    <ShoppingCart style={{ height: 20, width: 20 }} color={T.iron400} />
                  </div>
                  <p style={{ fontSize: 13.5, color: T.iron500 }}>Cart is empty</p>
                  <p style={{ marginTop: 4, fontSize: 11, color: T.iron400 }}>Add products from the catalog</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {cart.map((item) => (
                      <div key={item.product_id} style={{ borderRadius: 8, border: `1px solid ${T.iron200}`, background: T.iron50, padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13.5, fontWeight: 700, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</p>
                            <p style={{ ...mono, fontSize: 11, color: T.iron500 }}>{item.sku}</p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.product_id)}
                            style={{ flexShrink: 0, padding: 4, borderRadius: 6, border: 'none', background: 'transparent', color: T.orangeDeep, cursor: 'pointer' }}
                          >
                            <Trash2 style={{ height: 14, width: 14 }} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button onClick={() => updateQuantity(item.product_id, -1)} style={iconBtnSm}>
                              <Minus style={{ height: 12, width: 12 }} />
                            </button>
                            <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: T.iron900, width: 28, textAlign: 'center' }}>
                              {item.quantity}
                            </span>
                            <button onClick={() => updateQuantity(item.product_id, 1)} style={iconBtnSm}>
                              <Plus style={{ height: 12, width: 12 }} />
                            </button>
                          </div>
                          <p style={{ ...mono, fontSize: 13.5, fontWeight: 700, color: T.orange }}>
                            {formatCurrency(item.unit_price * item.quantity * (1 + item.gst_rate / 100))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order total + submit */}
                  <div style={{ borderTop: `1px solid ${T.iron200}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, border: `1px solid ${T.iron200}`, background: T.iron50, padding: '12px 16px' }}>
                      <Caps size={10} color={T.iron500} ls=".08em">Total (incl. GST)</Caps>
                      <span style={{ ...mono, fontSize: 20, fontWeight: 800, color: T.iron900, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IndianRupee style={{ height: 16, width: 16 }} />
                        {calculateTotal().toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>

                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Order notes (optional)"
                      style={inputStyle}
                    />

                    <button
                      onClick={handleSubmitOrder}
                      disabled={submitting || cart.length === 0}
                      style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 6, border: 'none', background: T.orange, color: '#fff', padding: '11px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, cursor: submitting || cart.length === 0 ? 'not-allowed' : 'pointer', opacity: submitting || cart.length === 0 ? 0.5 : 1 }}
                    >
                      {submitting ? (
                        <Loader2 style={{ height: 16, width: 16 }} className="animate-spin" />
                      ) : (
                        <ArrowRight style={{ height: 16, width: 16 }} />
                      )}
                      Place Order
                    </button>
                  </div>
                </>
              )}
            </div>
          </IronCard>
        </div>
      </div>
    </IronShell>
  );
}

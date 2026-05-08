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
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canOrder) {
    return (
      <DashboardLayout title="Place Order">
        <Card className="bg-yellow-900/30 border-yellow-600 max-w-lg mx-auto">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-yellow-400 mb-2">Cannot Place Orders</h3>
            <p className="text-yellow-200 mb-4">
              Your dealer account must be approved before you can place orders.
              Please contact admin if you believe this is an error.
            </p>
            <Link to="/dealer/deposit">
              <Button className="bg-yellow-600 hover:bg-yellow-700">
                Check Account Status
              </Button>
            </Link>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Place Order">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-cyan-400" />
                Product Catalog
              </CardTitle>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No products available</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {products.map((product) => (
                    <div key={product.id} className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="text-white font-medium">{product.name}</h4>
                          <p className="text-slate-400 text-sm">{product.sku}</p>
                        </div>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {product.category}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div>
                          <p className="text-slate-400 text-xs line-through">MRP: {formatCurrency(product.mrp)}</p>
                          <p className="text-cyan-400 font-bold text-lg">{formatCurrency(product.dealer_price)}</p>
                          <p className="text-slate-500 text-xs">+{product.gst_rate}% GST</p>
                        </div>
                        <Button
                          onClick={() => addToCart(product)}
                          className="bg-cyan-600 hover:bg-cyan-700"
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cart */}
        <div className="space-y-4">
          <Card className="bg-slate-800 border-slate-700 sticky top-20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-cyan-400" />
                Your Cart ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-slate-400 text-center py-4">Cart is empty</p>
              ) : (
                <>
                  {cart.map((item) => (
                    <div key={item.product_id} className="p-3 bg-slate-900 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-white font-medium text-sm">{item.product_name}</p>
                          <p className="text-slate-400 text-xs">{item.sku}</p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product_id, -1)}
                            className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center text-white hover:bg-slate-600"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-white w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product_id, 1)}
                            className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center text-white hover:bg-slate-600"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-cyan-400 font-medium">
                          {formatCurrency(item.unit_price * item.quantity * (1 + item.gst_rate / 100))}
                        </p>
                      </div>
                    </div>
                  ))}

                  <div className="border-t border-slate-700 pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-slate-400">Total (incl. GST)</span>
                      <span className="text-2xl font-bold text-white flex items-center">
                        <IndianRupee className="w-5 h-5" />
                        {calculateTotal().toLocaleString()}
                      </span>
                    </div>

                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Order notes (optional)"
                      className="bg-slate-900 border-slate-700 text-white mb-4"
                    />

                    <Button
                      onClick={handleSubmitOrder}
                      disabled={submitting || cart.length === 0}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4 mr-2" />
                      )}
                      Place Order
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

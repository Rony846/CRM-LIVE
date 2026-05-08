import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Package, Loader2, Eye, Upload, Clock, CheckCircle, Truck,
  IndianRupee, FileText, ArrowLeft, AlertCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function DealerOrders() {
  const { token } = useAuth();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', reference: '', file: null });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      fetchOrders();
    }
  }, [token]);

  useEffect(() => {
    if (orderId && orders.length > 0) {
      const order = orders.find(o => o.id === orderId);
      if (order) setSelectedOrder(order);
    }
  }, [orderId, orders]);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/dealer/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data || []);
      
      if (orderId) {
        const order = response.data.find(o => o.id === orderId);
        if (order) setSelectedOrder(order);
      }
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPayment = async () => {
    if (!paymentForm.file || !paymentForm.amount) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('amount', paymentForm.amount);
      formData.append('payment_reference', paymentForm.reference);
      formData.append('proof_file', paymentForm.file);
      
      await axios.post(`${API}/dealer/orders/${selectedOrder.id}/upload-payment`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      toast.success('Payment proof uploaded');
      setShowPaymentDialog(false);
      setPaymentForm({ amount: '', reference: '', file: null });
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload payment');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-600',
      confirmed: 'bg-cyan-600',
      dispatched: 'bg-blue-600',
      delivered: 'bg-green-600',
      cancelled: 'bg-red-600'
    };
    return <Badge className={colors[status] || 'bg-slate-600'}>{status}</Badge>;
  };

  const getPaymentBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-600',
      received: 'bg-green-600',
      rejected: 'bg-red-600'
    };
    return <Badge className={colors[status] || 'bg-slate-600'}>{status}</Badge>;
  };

  const filteredOrders = activeTab === 'all' 
    ? orders 
    : orders.filter(o => o.status === activeTab);

  if (loading) {
    return (
      <DashboardLayout title="My Orders">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  // Order Detail View
  if (selectedOrder) {
    return (
      <DashboardLayout title={`Order ${selectedOrder.order_number}`}>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => { setSelectedOrder(null); navigate('/dealer/orders'); }} className="text-slate-400">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Order Info */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">{selectedOrder.order_number}</CardTitle>
                    <div className="flex gap-2">
                      {getStatusBadge(selectedOrder.status)}
                      {getPaymentBadge(selectedOrder.payment_status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-slate-400 text-sm">Order Date</p>
                      <p className="text-white">{new Date(selectedOrder.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Total Amount</p>
                      <p className="text-white font-bold text-lg">{formatCurrency(selectedOrder.total_amount)}</p>
                    </div>
                    {selectedOrder.dispatch_date && (
                      <div>
                        <p className="text-slate-400 text-sm">Dispatch Date</p>
                        <p className="text-white">{selectedOrder.dispatch_date}</p>
                      </div>
                    )}
                    {selectedOrder.dispatch_awb && (
                      <div>
                        <p className="text-slate-400 text-sm">Tracking Number</p>
                        <p className="text-cyan-400">{selectedOrder.dispatch_awb}</p>
                      </div>
                    )}
                  </div>

                  <h4 className="text-white font-medium mb-3">Order Items</h4>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                        <div>
                          <p className="text-white">{item.product_name}</p>
                          <p className="text-slate-400 text-sm">{item.sku} × {item.quantity}</p>
                        </div>
                        <p className="text-white font-medium">{formatCurrency(item.line_total)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payment Section */}
            <div className="space-y-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Payment Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-slate-900 rounded-lg text-center">
                    <p className="text-slate-400 text-sm">Amount Due</p>
                    <p className="text-2xl font-bold text-white flex items-center justify-center gap-1">
                      <IndianRupee className="w-5 h-5" />
                      {selectedOrder.total_amount?.toLocaleString()}
                    </p>
                  </div>

                  {selectedOrder.payment_status === 'pending' && (
                    <>
                      {selectedOrder.payment_proof_path ? (
                        <div className="p-3 bg-yellow-900/30 border border-yellow-600 rounded-lg">
                          <div className="flex items-center gap-2 text-yellow-400 mb-2">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">Payment Under Review</span>
                          </div>
                          <p className="text-yellow-200 text-sm">
                            Your payment proof is being verified.
                          </p>
                        </div>
                      ) : (
                        <Button
                          onClick={() => {
                            setPaymentForm({ ...paymentForm, amount: selectedOrder.total_amount.toString() });
                            setShowPaymentDialog(true);
                          }}
                          className="w-full bg-cyan-600 hover:bg-cyan-700"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Payment Proof
                        </Button>
                      )}
                    </>
                  )}

                  {selectedOrder.payment_status === 'received' && (
                    <div className="p-3 bg-green-900/30 border border-green-600 rounded-lg">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-medium">Payment Confirmed</span>
                      </div>
                    </div>
                  )}

                  {selectedOrder.payment_proof_path && (
                    <a 
                      href={`${API.replace('/api', '')}${selectedOrder.payment_proof_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
                    >
                      <FileText className="w-4 h-4" />
                      View Payment Proof
                    </a>
                  )}
                </CardContent>
              </Card>

              {/* Dispatch Info */}
              {selectedOrder.status === 'dispatched' && (
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Truck className="w-5 h-5 text-cyan-400" />
                      Dispatch Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedOrder.dispatch_courier && (
                      <div>
                        <p className="text-slate-400 text-sm">Courier</p>
                        <p className="text-white">{selectedOrder.dispatch_courier}</p>
                      </div>
                    )}
                    {selectedOrder.dispatch_awb && (
                      <div>
                        <p className="text-slate-400 text-sm">AWB / Tracking</p>
                        <p className="text-cyan-400 font-mono">{selectedOrder.dispatch_awb}</p>
                      </div>
                    )}
                    {selectedOrder.dispatch_date && (
                      <div>
                        <p className="text-slate-400 text-sm">Dispatched On</p>
                        <p className="text-white">{selectedOrder.dispatch_date}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Payment Upload Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Upload Payment Proof</DialogTitle>
              <DialogDescription className="text-slate-400">
                Upload your payment receipt or transaction screenshot
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-slate-300 text-sm">Amount Paid *</label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 text-sm">Reference / UTR</label>
                <Input
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 text-sm">Upload Proof *</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setPaymentForm({ ...paymentForm, file: e.target.files[0] })}
                  className="w-full text-slate-300 mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowPaymentDialog(false)} className="text-slate-400">
                Cancel
              </Button>
              <Button onClick={handleUploadPayment} disabled={submitting} className="bg-cyan-600 hover:bg-cyan-700">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  // Orders List View
  return (
    <DashboardLayout title="My Orders">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-800">
              <TabsTrigger value="all" className="data-[state=active]:bg-cyan-600">All</TabsTrigger>
              <TabsTrigger value="pending" className="data-[state=active]:bg-cyan-600">Pending</TabsTrigger>
              <TabsTrigger value="confirmed" className="data-[state=active]:bg-cyan-600">Confirmed</TabsTrigger>
              <TabsTrigger value="dispatched" className="data-[state=active]:bg-cyan-600">Dispatched</TabsTrigger>
              <TabsTrigger value="delivered" className="data-[state=active]:bg-cyan-600">Delivered</TabsTrigger>
            </TabsList>
          </Tabs>
          <Link to="/dealer/orders/new">
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              New Order
            </Button>
          </Link>
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-0">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No orders found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {filteredOrders.map((order) => (
                  <div 
                    key={order.id}
                    onClick={() => { setSelectedOrder(order); navigate(`/dealer/orders/${order.id}`); }}
                    className="p-4 hover:bg-slate-700/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <p className="text-white font-medium">{order.order_number}</p>
                          {getStatusBadge(order.status)}
                          {getPaymentBadge(order.payment_status)}
                        </div>
                        <p className="text-slate-400 text-sm">
                          {order.items?.length || 0} items • {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">{formatCurrency(order.total_amount)}</p>
                        <Eye className="w-4 h-4 text-slate-400 ml-auto mt-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

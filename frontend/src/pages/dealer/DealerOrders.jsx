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

// Obsidian status chips
const ORDER_STATUS_TONES = {
  pending:   'bg-amber-400/15 text-amber-400 ring-amber-400/25',
  confirmed: 'bg-sky-400/15 text-sky-400 ring-sky-400/25',
  dispatched:'bg-primary/15 text-primary ring-primary/25',
  delivered: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
  cancelled: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',
};
const PAYMENT_STATUS_TONES = {
  pending:  'bg-amber-400/15 text-amber-400 ring-amber-400/25',
  received: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
  rejected: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',
};

const StatusChip = ({ status, toneMap }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap ${(toneMap || ORDER_STATUS_TONES)[status] || 'bg-muted text-muted-foreground ring-border'}`}>
    {status}
  </span>
);

const labelCls = 'font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-1.5 block';

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

  const filteredOrders = activeTab === 'all'
    ? orders
    : orders.filter(o => o.status === activeTab);

  if (loading) {
    return (
      <DashboardLayout title="My Orders">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // ── Order Detail View ────────────────────────────────────────────────────────
  if (selectedOrder) {
    return (
      <DashboardLayout title={`Order ${selectedOrder.order_number}`}>
        <div className="space-y-5">

          {/* Back nav */}
          <button
            onClick={() => { setSelectedOrder(null); navigate('/dealer/orders'); }}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Orders
          </button>

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">Order Detail</p>
              <h2 className="text-[22px] font-bold tracking-tight text-foreground">{selectedOrder.order_number}</h2>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip status={selectedOrder.status} toneMap={ORDER_STATUS_TONES} />
              <StatusChip status={selectedOrder.payment_status} toneMap={PAYMENT_STATUS_TONES} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Order Info */}
            <div className="lg:col-span-2 space-y-4">
              <div className="mg-card rounded-lg border border-border bg-card">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-px border-b border-border">
                  <div className="p-4">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Order Date</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {new Date(selectedOrder.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="p-4">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total Amount</p>
                    <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
                      {formatCurrency(selectedOrder.total_amount)}
                    </p>
                  </div>
                  {selectedOrder.dispatch_date && (
                    <div className="p-4">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dispatch Date</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{selectedOrder.dispatch_date}</p>
                    </div>
                  )}
                  {selectedOrder.dispatch_awb && (
                    <div className="p-4">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tracking Number</p>
                      <p className="mt-1 font-mono text-sm font-bold text-primary">{selectedOrder.dispatch_awb}</p>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="p-4">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-3">Order Items</p>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="mg-card flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.product_name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{item.sku} × {item.quantity}</p>
                        </div>
                        <p className="font-mono text-sm font-bold tabular-nums text-foreground">{formatCurrency(item.line_total)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Payment Status */}
              <div className="mg-card rounded-lg border border-border bg-card p-4">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-3">Payment Status</p>

                <div className="rounded-lg border border-border bg-muted/30 p-4 text-center mb-4">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Amount Due</p>
                  <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground flex items-center justify-center gap-1">
                    <IndianRupee className="h-5 w-5" />
                    {selectedOrder.total_amount?.toLocaleString('en-IN')}
                  </p>
                </div>

                {selectedOrder.payment_status === 'pending' && (
                  <>
                    {selectedOrder.payment_proof_path ? (
                      <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-3">
                        <div className="flex items-center gap-2 text-amber-400 mb-1">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm font-semibold">Payment Under Review</span>
                        </div>
                        <p className="text-[12px] text-amber-400/80">Your payment proof is being verified.</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setPaymentForm({ ...paymentForm, amount: selectedOrder.total_amount.toString() });
                          setShowPaymentDialog(true);
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 rounded bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Payment Proof
                      </button>
                    )}
                  </>
                )}

                {selectedOrder.payment_status === 'received' && (
                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-semibold">Payment Confirmed</span>
                    </div>
                  </div>
                )}

                {selectedOrder.payment_proof_path && (
                  <a
                    href={`${API.replace('/api', '')}${selectedOrder.payment_proof_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-2 font-mono text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    View Payment Proof
                  </a>
                )}
              </div>

              {/* Dispatch Info */}
              {selectedOrder.status === 'dispatched' && (
                <div className="mg-card rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Truck className="h-4 w-4 text-primary" />
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Dispatch Info</p>
                  </div>
                  <div className="space-y-3">
                    {selectedOrder.dispatch_courier && (
                      <div>
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Courier</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">{selectedOrder.dispatch_courier}</p>
                      </div>
                    )}
                    {selectedOrder.dispatch_awb && (
                      <div>
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AWB / Tracking</p>
                        <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-primary">{selectedOrder.dispatch_awb}</p>
                      </div>
                    )}
                    {selectedOrder.dispatch_date && (
                      <div>
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dispatched On</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">{selectedOrder.dispatch_date}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Upload Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="bg-popover border border-border rounded-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Upload Payment Proof</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Upload your payment receipt or transaction screenshot
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Amount Paid *</label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Reference / UTR</label>
                <Input
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Upload Proof *</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setPaymentForm({ ...paymentForm, file: e.target.files[0] })}
                  className="w-full text-sm text-muted-foreground mt-1 file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
                />
              </div>
            </div>
            <DialogFooter>
              <button
                onClick={() => setShowPaymentDialog(false)}
                className="px-4 py-2 rounded bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadPayment}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Upload
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  // ── Orders List View ─────────────────────────────────────────────────────────
  return (
    <DashboardLayout title="My Orders">
      <div className="space-y-5">

        {/* Page header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Orders · Live
              </span>
            </div>
            <h2 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">My Orders</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono font-semibold text-primary tabular-nums">{orders.length}</span> total orders
            </p>
          </div>
          <Link to="/dealer/orders/new">
            <button className="inline-flex items-center gap-2 rounded bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity">
              New Order
            </button>
          </Link>
        </div>

        {/* Tab filter bar */}
        <div className="flex">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-card border border-border">
              {['all', 'pending', 'confirmed', 'dispatched', 'delivered'].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="font-mono text-[11px] uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Orders table */}
        <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Package className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-semibold text-foreground">No orders found</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {activeTab === 'all' ? 'Place your first order to get started.' : `No ${activeTab} orders.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Table header */}
              <div className="hidden md:grid grid-cols-12 px-5 py-3 bg-muted/30">
                <div className="col-span-4">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Order</span>
                </div>
                <div className="col-span-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Status</span>
                </div>
                <div className="col-span-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Payment</span>
                </div>
                <div className="col-span-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Items</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Amount</span>
                </div>
              </div>
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => { setSelectedOrder(order); navigate(`/dealer/orders/${order.id}`); }}
                  className="group grid grid-cols-1 md:grid-cols-12 items-center px-5 py-4 hover:bg-accent/40 cursor-pointer transition-colors gap-2 md:gap-0"
                >
                  <div className="md:col-span-4">
                    <p className="font-mono text-sm font-semibold text-foreground">{order.order_number}</p>
                    <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                      {new Date(order.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <StatusChip status={order.status} toneMap={ORDER_STATUS_TONES} />
                  </div>
                  <div className="md:col-span-2">
                    <StatusChip status={order.payment_status} toneMap={PAYMENT_STATUS_TONES} />
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-mono text-[12px] text-muted-foreground">{order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="md:col-span-2 flex items-center justify-between md:justify-end gap-2">
                    <p className="font-mono text-sm font-bold tabular-nums text-foreground">{formatCurrency(order.total_amount)}</p>
                    <Eye className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

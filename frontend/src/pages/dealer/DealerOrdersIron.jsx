import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Package, Loader2, Eye, Upload, Clock, CheckCircle, Truck,
  IndianRupee, FileText, ArrowLeft
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

// Order/payment status -> Iron pill tone (mirrors the original Obsidian chips).
const ORDER_TONE = { pending: 'warn', confirmed: 'info', dispatched: 'info', delivered: 'ok', cancelled: 'bad' };
const PAYMENT_TONE = { pending: 'warn', received: 'ok', rejected: 'bad' };
const orderPill = (s) => ({ label: (s || '-'), style: badgeStyle(ORDER_TONE[s] || 'slate') });
const paymentPill = (s) => ({ label: (s || '-'), style: badgeStyle(PAYMENT_TONE[s] || 'slate') });

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

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
  const [purchases, setPurchases] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/dealer/purchases`, { headers: { Authorization: `Bearer ${token}` } });
        setPurchases(r.data);
      } catch (e) { setPurchases(null); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <IronShell title="My Orders" subtitle="DEALER · ORDERS">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
          <Loader2 className="animate-spin" size={30} color={T.orange} />
        </div>
      </IronShell>
    );
  }

  // ── Order Detail View ────────────────────────────────────────────────────────
  if (selectedOrder) {
    const op = orderPill(selectedOrder.status);
    const pp = paymentPill(selectedOrder.payment_status);
    return (
      <IronShell title={`Order ${selectedOrder.order_number || ''}`} subtitle="DEALER · ORDER DETAIL" onRefresh={fetchOrders}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>

          {/* Back nav */}
          <button
            onClick={() => { setSelectedOrder(null); navigate('/dealer/orders'); }}
            style={{ ...btnOutline, alignSelf: 'flex-start' }}
          >
            <ArrowLeft size={14} /> Back to Orders
          </button>

          {/* Header */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <Caps size={9} color={T.iron400}>Order Detail</Caps>
              <div style={{ ...mono, fontFamily: T.mono, fontSize: 22, fontWeight: 700, color: T.iron900, marginTop: 4 }}>{selectedOrder.order_number}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={op.style}>{op.label}</span>
              <span style={pp.style}>{pp.label}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
            {/* Order Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <IronCard pad={0}>
                {/* Meta */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${T.iron200}` }}>
                  <div style={{ padding: 16, borderRight: `1px solid ${T.iron200}` }}>
                    <Caps size={9} color={T.iron400}>Order Date</Caps>
                    <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: T.iron900 }}>
                      {new Date(selectedOrder.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div style={{ padding: 16 }}>
                    <Caps size={9} color={T.iron400}>Total Amount</Caps>
                    <div style={{ ...mono, marginTop: 4, fontSize: 18, fontWeight: 700, color: T.iron900 }}>
                      {formatCurrency(selectedOrder.total_amount)}
                    </div>
                  </div>
                  {selectedOrder.dispatch_date && (
                    <div style={{ padding: 16, borderTop: `1px solid ${T.iron200}`, borderRight: `1px solid ${T.iron200}` }}>
                      <Caps size={9} color={T.iron400}>Dispatch Date</Caps>
                      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: T.iron900 }}>{selectedOrder.dispatch_date}</div>
                    </div>
                  )}
                  {selectedOrder.dispatch_awb && (
                    <div style={{ padding: 16, borderTop: `1px solid ${T.iron200}` }}>
                      <Caps size={9} color={T.iron400}>Tracking Number</Caps>
                      <div style={{ ...mono, marginTop: 4, fontSize: 13, fontWeight: 700, color: T.orange }}>{selectedOrder.dispatch_awb}</div>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div style={{ padding: 16 }}>
                  <Caps size={9.5} color={T.iron500}>Order Items</Caps>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${T.iron200}`, background: T.iron50, borderRadius: 8, padding: '12px 14px' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900 }}>{item.product_name}</div>
                          <div style={{ ...mono, fontSize: 11, color: T.iron500, marginTop: 2 }}>{item.sku} × {item.quantity}</div>
                        </div>
                        <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: T.iron900 }}>{formatCurrency(item.line_total)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </IronCard>
            </div>

            {/* Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Payment Status */}
              <IronCard pad={16}>
                <Caps size={9.5} color={T.iron500}>Payment Status</Caps>

                <div style={{ border: `1px solid ${T.iron200}`, background: T.iron50, borderRadius: 8, padding: 16, textAlign: 'center', marginTop: 12, marginBottom: 16 }}>
                  <Caps size={9} color={T.iron400}>Amount Due</Caps>
                  <div style={{ ...mono, marginTop: 4, fontSize: 24, fontWeight: 700, color: T.iron900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <IndianRupee size={18} />
                    {selectedOrder.total_amount?.toLocaleString('en-IN')}
                  </div>
                </div>

                {selectedOrder.payment_status === 'pending' && (
                  <>
                    {selectedOrder.payment_proof_path ? (
                      <div style={{ border: `1px solid ${T.voltageTint}`, background: T.voltageTint, borderRadius: 8, padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.voltageText, marginBottom: 4 }}>
                          <Clock size={16} />
                          <span style={{ fontSize: 13, fontWeight: 700 }}>Payment Under Review</span>
                        </div>
                        <div style={{ fontSize: 12, color: T.voltageText }}>Your payment proof is being verified.</div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setPaymentForm({ ...paymentForm, amount: selectedOrder.total_amount.toString() });
                          setShowPaymentDialog(true);
                        }}
                        style={{ ...btnPrimary, width: '100%', justifyContent: 'center', padding: '10px 14px' }}
                      >
                        <Upload size={15} />
                        Upload Payment Proof
                      </button>
                    )}
                  </>
                )}

                {selectedOrder.payment_status === 'received' && (
                  <div style={{ border: `1px solid ${T.greenTint}`, background: T.greenTint, borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.green }}>
                      <CheckCircle size={16} />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Payment Confirmed</span>
                    </div>
                  </div>
                )}

                {selectedOrder.payment_proof_path && (
                  <a
                    href={`${API.replace('/api', '')}${selectedOrder.payment_proof_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, ...mono, fontSize: 11, fontWeight: 700, color: T.orange, textDecoration: 'none' }}
                  >
                    <FileText size={15} />
                    View Payment Proof
                  </a>
                )}
              </IronCard>

              {/* Dispatch Info */}
              {selectedOrder.status === 'dispatched' && (
                <IronCard pad={16}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Truck size={15} color={T.orange} />
                    <Caps size={9.5} color={T.iron500}>Dispatch Info</Caps>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {selectedOrder.dispatch_courier && (
                      <div>
                        <Caps size={9} color={T.iron400}>Courier</Caps>
                        <div style={{ marginTop: 2, fontSize: 13, fontWeight: 600, color: T.iron900 }}>{selectedOrder.dispatch_courier}</div>
                      </div>
                    )}
                    {selectedOrder.dispatch_awb && (
                      <div>
                        <Caps size={9} color={T.iron400}>AWB / Tracking</Caps>
                        <div style={{ ...mono, marginTop: 2, fontSize: 13, fontWeight: 700, color: T.orange }}>{selectedOrder.dispatch_awb}</div>
                      </div>
                    )}
                    {selectedOrder.dispatch_date && (
                      <div>
                        <Caps size={9} color={T.iron400}>Dispatched On</Caps>
                        <div style={{ marginTop: 2, fontSize: 13, fontWeight: 600, color: T.iron900 }}>{selectedOrder.dispatch_date}</div>
                      </div>
                    )}
                  </div>
                </IronCard>
              )}
            </div>
          </div>
        </div>

        {/* Payment Upload Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Payment Proof</DialogTitle>
              <DialogDescription>
                Upload your payment receipt or transaction screenshot
              </DialogDescription>
            </DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <Caps size={9.5} color={T.iron500} style={{ display: 'block', marginBottom: 6 }}>Amount Paid *</Caps>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </div>
              <div>
                <Caps size={9.5} color={T.iron500} style={{ display: 'block', marginBottom: 6 }}>Reference / UTR</Caps>
                <Input
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                />
              </div>
              <div>
                <Caps size={9.5} color={T.iron500} style={{ display: 'block', marginBottom: 6 }}>Upload Proof *</Caps>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setPaymentForm({ ...paymentForm, file: e.target.files[0] })}
                  style={{ width: '100%', fontSize: 12.5, color: T.iron700, marginTop: 2 }}
                />
              </div>
            </div>
            <DialogFooter>
              <button onClick={() => setShowPaymentDialog(false)} style={btnOutline}>
                Cancel
              </button>
              <button onClick={handleUploadPayment} disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.5 : 1 }}>
                {submitting && <Loader2 className="animate-spin" size={14} />}
                Upload
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </IronShell>
    );
  }

  // ── Orders List View ─────────────────────────────────────────────────────────
  return (
    <IronShell
      title="My Orders"
      subtitle="DEALER · ORDERS"
      onRefresh={fetchOrders}
      headerRight={
        <Link to="/dealer/orders/new" style={{ textDecoration: 'none' }}>
          <button style={btnPrimary}>New Order</button>
        </Link>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Page header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: T.green, display: 'inline-block' }} />
              <Caps size={9.5} color={T.iron400}>Orders · Live</Caps>
            </div>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 24, color: T.iron900, lineHeight: 1.1 }}>My Orders</div>
            <div style={{ marginTop: 4, fontSize: 13, color: T.iron500 }}>
              <span style={{ ...mono, fontWeight: 700, color: T.orange }}>{orders.length}</span> total orders
            </div>
          </div>
        </div>

        {/* Purchase history — the dealer's actual MuscleGrid invoices (not just portal orders) */}
        {purchases?.linked && purchases.count > 0 && (
          <IronCard pad={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: `1px solid ${T.iron200}` }}>
              <FileText size={15} color={T.orange} />
              <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>Purchase History — MuscleGrid Invoices</span>
              <span style={{ ...mono, marginLeft: 'auto', fontSize: 12, color: T.iron500 }}>
                {purchases.count} invoices · ₹{Number(purchases.total_purchased).toLocaleString('en-IN')}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    <th style={thCell}><Caps size={8.5}>Invoice</Caps></th>
                    <th style={thCell}><Caps size={8.5}>Date</Caps></th>
                    <th style={thCell}><Caps size={8.5}>Item</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Amount</Caps></th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.purchases.map((p) => (
                    <tr key={p.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, ...mono, color: T.orange }}>{p.invoice_number || '—'}</td>
                      <td style={{ ...tdCell, ...mono, color: T.iron500 }}>{p.date}</td>
                      <td style={{ ...tdCell, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.iron500 }}>{p.items_summary}</td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900 }}>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </IronCard>
        )}

        {/* Tab filter bar */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', 'pending', 'confirmed', 'dispatched', 'delivered'].map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  ...mono, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
                  border: `1px solid ${active ? T.orange : T.iron200}`,
                  background: active ? T.orange : T.white,
                  color: active ? '#fff' : T.iron700,
                  borderRadius: 6, padding: '7px 14px', cursor: 'pointer',
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Orders table */}
        <IronCard pad={0}>
          {filteredOrders.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', textAlign: 'center' }}>
              <div style={{ marginBottom: 12, width: 48, height: 48, borderRadius: 999, background: T.iron100, display: 'grid', placeItems: 'center' }}>
                <Package size={24} color={T.iron400} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.iron900 }}>No orders found</div>
              <div style={{ marginTop: 4, fontSize: 12, color: T.iron500 }}>
                {activeTab === 'all' ? 'Place your first order to get started.' : `No ${activeTab} orders.`}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    <th style={thCell}><Caps size={8.5}>Order</Caps></th>
                    <th style={thCell}><Caps size={8.5}>Status</Caps></th>
                    <th style={thCell}><Caps size={8.5}>Payment</Caps></th>
                    <th style={thCell}><Caps size={8.5}>Items</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Amount</Caps></th>
                    <th style={{ ...thCell, width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const op = orderPill(order.status);
                    const pp = paymentPill(order.payment_status);
                    return (
                      <tr
                        key={order.id}
                        className="iron-row"
                        onClick={() => { setSelectedOrder(order); navigate(`/dealer/orders/${order.id}`); }}
                        style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }}
                      >
                        <td style={tdCell}>
                          <div style={{ ...mono, fontSize: 12.5, fontWeight: 700, color: T.iron900 }}>{order.order_number}</div>
                          <div style={{ ...mono, fontSize: 11, color: T.iron500, marginTop: 2 }}>
                            {new Date(order.created_at).toLocaleDateString('en-IN')}
                          </div>
                        </td>
                        <td style={tdCell}><span style={op.style}>{op.label}</span></td>
                        <td style={tdCell}><span style={pp.style}>{pp.label}</span></td>
                        <td style={{ ...tdCell, ...mono, color: T.iron500 }}>
                          {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}
                        </td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.iron900 }}>{formatCurrency(order.total_amount)}</td>
                        <td style={{ ...tdCell, textAlign: 'right' }}><Eye size={15} color={T.iron400} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </IronCard>
      </div>
    </IronShell>
  );
}

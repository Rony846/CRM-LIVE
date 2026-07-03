import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Users, Loader2, CheckCircle, XCircle, Eye, Clock, Shield,
  FileText, IndianRupee, AlertTriangle, ShoppingCart, Edit, Trash2, Plus, Save
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

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const rowActionStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };

// Iron pill renderers for tables (dialogs keep their own shadcn badges below).
const ironStatusPill = (status) => {
  const map = { new: 'info', review: 'warn', approved: 'ok', rejected: 'bad', pending: 'warn', suspended: 'bad' };
  return <span style={badgeStyle(map[status] || 'slate')}>{status}</span>;
};
const ironDepositPill = (status) => {
  const map = {
    approved: ['₹1L Paid', 'ok'], pending_review: ['Review Pending', 'warn'],
    not_paid: ['Not Paid', 'bad'], rejected: ['Rejected', 'bad'],
  };
  const [label, tone] = map[status] || map.not_paid;
  return <span style={badgeStyle(tone)}>{label}</span>;
};
const ironOrderPill = (status) => {
  const map = { pending: 'warn', confirmed: 'info', dispatched: 'violet', delivered: 'ok', cancelled: 'bad' };
  return <span style={badgeStyle(map[status] || 'slate')}>{status}</span>;
};

export default function AdminDealerApplications() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [dealerOrders, setDealerOrders] = useState([]);
  const [dealerProducts, setDealerProducts] = useState([]);
  const [masterSkus, setMasterSkus] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [depositAmount, setDepositAmount] = useState('100000');

  // Edit forms
  const [editDealerForm, setEditDealerForm] = useState({});
  const [editOrderForm, setEditOrderForm] = useState({});
  const [editProductForm, setEditProductForm] = useState({});
  const [showEditDealer, setShowEditDealer] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(false);
  const [showEditProduct, setShowEditProduct] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showCreateDealer, setShowCreateDealer] = useState(false);
  const [createDealerForm, setCreateDealerForm] = useState({
    firm_name: '',
    contact_person: '',
    email: '',
    phone: '',
    gst_number: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    tier: 'silver',
    password: ''
  });
  const [createDealerLoading, setCreateDealerLoading] = useState(false);

  // Stats
  const [depositStats, setDepositStats] = useState({ approved: 0, pending: 0 });

  // Dealer ledger panel
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerDealer, setLedgerDealer] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', kind: 'payment_received', narration: '', date: '' });
  const [paymentSaving, setPaymentSaving] = useState(false);

  // Get tab from URL params
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'applications');

  // Update tab when URL changes
  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [appsRes, depositsRes, dealersRes, ordersRes, productsRes, skusRes] = await Promise.all([
        axios.get(`${API}/admin/dealer-applications`, { headers }),
        axios.get(`${API}/admin/dealer-deposits?status=pending`, { headers }),
        axios.get(`${API}/admin/dealers`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/dealer-orders`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/dealer-products`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/master-skus`, { headers }).catch(() => ({ data: { master_skus: [] } }))
      ]);
      setApplications(appsRes.data || []);
      setDeposits(depositsRes.data || []);
      setDealers(dealersRes.data || []);
      setDealerOrders(ordersRes.data || []);
      setDealerProducts(productsRes.data || []);
      setMasterSkus(skusRes.data?.master_skus || skusRes.data || []);

      // Calculate deposit stats
      const allDealers = dealersRes.data || [];
      const approved = allDealers.filter(d =>
        d.security_deposit?.status === 'approved' || d.security_deposit_status === 'approved'
      ).length;
      const pending = allDealers.length - approved;
      setDepositStats({ approved, pending });
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Create dealer handler
  const handleCreateDealer = async () => {
    if (!createDealerForm.firm_name || !createDealerForm.email || !createDealerForm.phone) {
      toast.error('Please fill in all required fields');
      return;
    }
    setCreateDealerLoading(true);
    try {
      const response = await axios.post(`${API}/admin/dealers/create`, createDealerForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Dealer created successfully! Code: ${response.data.dealer_code}`);
      setShowCreateDealer(false);
      setCreateDealerForm({
        firm_name: '',
        contact_person: '',
        email: '',
        phone: '',
        gst_number: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        tier: 'silver',
        password: ''
      });
      fetchData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to create dealer';
      toast.error(message);
    } finally {
      setCreateDealerLoading(false);
    }
  };

  // Edit handlers
  const openEditDealer = (dealer) => {
    setEditDealerForm({
      firm_name: dealer.firm_name || '',
      contact_person: dealer.contact_person || '',
      phone: dealer.phone || '',
      email: dealer.email || '',
      gst_number: dealer.gst_number || '',
      address_line1: dealer.address?.line1 || dealer.address_line1 || '',
      city: dealer.address?.city || dealer.city || '',
      state: dealer.address?.state || dealer.state || '',
      pincode: dealer.address?.pincode || dealer.pincode || '',
      status: dealer.status || 'pending',
      security_deposit_status: dealer.security_deposit_status || dealer.security_deposit?.status || 'not_paid',
      security_deposit_amount: dealer.security_deposit_amount || dealer.security_deposit?.amount || 100000,
      admin_notes: dealer.admin_notes || ''
    });
    setSelectedDealer(dealer);
    setShowEditDealer(true);
  };

  // ---- Dealer ledger / manual payments ----
  const openLedger = async (dealer) => {
    setLedgerDealer(dealer);
    setLedgerOpen(true);
    setLedgerData(null);
    setPaymentForm({ amount: '', kind: 'payment_received', narration: '', date: '' });
    setLedgerLoading(true);
    try {
      const r = await axios.get(`${API}/admin/dealers/${dealer.id}/ledger`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLedgerData(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const reloadLedger = async () => {
    if (!ledgerDealer) return;
    try {
      const r = await axios.get(`${API}/admin/dealers/${ledgerDealer.id}/ledger`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLedgerData(r.data);
    } catch (e) {
      /* ignore */
    }
  };

  const addLedgerPayment = async () => {
    if (!ledgerDealer) return;
    const amt = parseFloat(paymentForm.amount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setPaymentSaving(true);
    try {
      await axios.post(
        `${API}/admin/dealers/${ledgerDealer.id}/payments`,
        {
          amount: amt,
          kind: paymentForm.kind,
          narration: paymentForm.narration,
          date: paymentForm.date || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Ledger entry added');
      setPaymentForm({ amount: '', kind: 'payment_received', narration: '', date: '' });
      await reloadLedger();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add entry');
    } finally {
      setPaymentSaving(false);
    }
  };

  const deleteLedgerEntry = async (entryId) => {
    if (!ledgerDealer) return;
    if (!window.confirm('Delete this ledger entry? It will be archived and the balance recalculated.')) return;
    try {
      await axios.delete(`${API}/admin/dealers/${ledgerDealer.id}/payments/${entryId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Entry deleted');
      await reloadLedger();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete entry');
    }
  };

  const handleSaveDealer = async () => {
    if (!selectedDealer) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      Object.entries(editDealerForm).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          formData.append(key, value);
        }
      });

      await axios.patch(`${API}/admin/dealers/${selectedDealer.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Dealer updated successfully');
      setShowEditDealer(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update dealer');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditOrder = (order) => {
    setEditOrderForm({
      status: order.status || 'pending',
      payment_status: order.payment_status || 'pending',
      total_amount: order.total_amount || 0,
      items: order.items || [],
      admin_notes: order.admin_notes || ''
    });
    setSelectedOrder(order);
    setShowEditOrder(true);
  };

  const handleSaveOrder = async () => {
    if (!selectedOrder) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('status', editOrderForm.status);
      formData.append('payment_status', editOrderForm.payment_status);
      formData.append('total_amount', editOrderForm.total_amount);
      formData.append('items', JSON.stringify(editOrderForm.items));
      formData.append('admin_notes', editOrderForm.admin_notes || '');

      await axios.patch(`${API}/admin/dealer-orders/${selectedOrder.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Order updated successfully');
      setShowEditOrder(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update order');
    } finally {
      setActionLoading(false);
    }
  };

  const addItemToOrder = () => {
    setEditOrderForm({
      ...editOrderForm,
      items: [...editOrderForm.items, { product_id: '', product_name: '', quantity: 1, unit_price: 0, line_total: 0 }]
    });
  };

  const updateOrderItem = (index, field, value) => {
    const newItems = [...editOrderForm.items];
    newItems[index][field] = value;

    // Recalculate line_total
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].line_total = (newItems[index].quantity || 0) * (newItems[index].unit_price || 0);
    }

    // If product_id changed, fill in name and price from dealer products
    if (field === 'product_id') {
      const product = dealerProducts.find(p => p.id === value);
      if (product) {
        newItems[index].product_name = product.name;
        newItems[index].unit_price = product.dealer_price;
        newItems[index].line_total = newItems[index].quantity * product.dealer_price;
      }
    }

    setEditOrderForm({
      ...editOrderForm,
      items: newItems,
      total_amount: newItems.reduce((sum, item) => sum + (item.line_total || 0), 0)
    });
  };

  const removeOrderItem = (index) => {
    const newItems = editOrderForm.items.filter((_, i) => i !== index);
    setEditOrderForm({
      ...editOrderForm,
      items: newItems,
      total_amount: newItems.reduce((sum, item) => sum + (item.line_total || 0), 0)
    });
  };

  const openEditProduct = (product) => {
    setEditProductForm({
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      mrp: product.mrp || 0,
      dealer_price: product.dealer_price || 0,
      gst_rate: product.gst_rate || 18,
      warranty_months: product.warranty_months || 12,
      master_sku_id: product.master_sku_id || '',
      is_active: product.is_active !== false
    });
    setSelectedProduct(product);
    setShowEditProduct(true);
  };

  const handleSaveProduct = async () => {
    setActionLoading(true);
    try {
      const formData = new FormData();
      Object.entries(editProductForm).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });

      if (selectedProduct) {
        await axios.patch(`${API}/admin/dealer-products/${selectedProduct.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Product updated successfully');
      } else {
        await axios.post(`${API}/admin/dealer-products`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Product created successfully');
      }
      setShowEditProduct(false);
      setShowAddProduct(false);
      setSelectedProduct(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save product');
    } finally {
      setActionLoading(false);
    }
  };

  const openAddProduct = () => {
    setEditProductForm({
      name: '',
      sku: '',
      category: 'Inverter',
      mrp: 0,
      dealer_price: 0,
      gst_rate: 18,
      warranty_months: 12,
      master_sku_id: '',
      is_active: true
    });
    setSelectedProduct(null);
    setShowAddProduct(true);
  };

  const handleApproveApplication = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('admin_notes', notes);
      formData.append('security_deposit_amount', depositAmount);

      const response = await axios.post(
        `${API}/admin/dealer-applications/${selectedApp.id}/approve`,
        formData,
        { headers: { Authorization: `Bearer ${token}` }}
      );

      toast.success(`Dealer approved. Temp password: ${response.data.temp_password}`);
      setSelectedApp(null);
      setNotes('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectApplication = async () => {
    if (!selectedApp || !notes) {
      toast.error('Please provide rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('admin_notes', notes);

      await axios.post(
        `${API}/admin/dealer-applications/${selectedApp.id}/reject`,
        formData,
        { headers: { Authorization: `Bearer ${token}` }}
      );

      toast.success('Application rejected');
      setSelectedApp(null);
      setNotes('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveDeposit = async () => {
    if (!selectedDeposit) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('remarks', notes);

      await axios.post(
        `${API}/admin/dealer-deposits/${selectedDeposit.id}/approve`,
        formData,
        { headers: { Authorization: `Bearer ${token}` }}
      );

      toast.success('Deposit approved, dealer portal activated');
      setSelectedDeposit(null);
      setNotes('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDeposit = async () => {
    if (!selectedDeposit || !notes) {
      toast.error('Please provide rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('remarks', notes);

      await axios.post(
        `${API}/admin/dealer-deposits/${selectedDeposit.id}/reject`,
        formData,
        { headers: { Authorization: `Bearer ${token}` }}
      );

      toast.success('Deposit rejected');
      setSelectedDeposit(null);
      setNotes('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  // Badge helpers kept for the shadcn dialogs (rendered inside dark portals).
  const getStatusBadge = (status) => {
    const colors = {
      new: 'bg-blue-600',
      review: 'bg-yellow-600',
      approved: 'bg-green-600',
      rejected: 'bg-red-600',
      pending: 'bg-yellow-600',
      suspended: 'bg-red-600'
    };
    return <Badge className={colors[status] || 'bg-slate-600'}>{status}</Badge>;
  };

  const getOrderStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-600',
      confirmed: 'bg-blue-600',
      dispatched: 'bg-purple-600',
      delivered: 'bg-green-600',
      cancelled: 'bg-red-600'
    };
    return <Badge className={colors[status] || 'bg-slate-600'}>{status}</Badge>;
  };

  const pendingApps = applications.filter(a => a.status === 'new' || a.status === 'review');

  const statCards = [
    { label: 'Pending Apps', value: pendingApps.length, icon: Clock, tone: T.voltageText },
    { label: 'Pending Deposits', value: deposits.length, icon: Shield, tone: T.blue },
    { label: '₹1L Deposit Paid', value: depositStats.approved, icon: IndianRupee, tone: T.green },
    { label: 'Deposit Pending', value: depositStats.pending, icon: AlertTriangle, tone: T.orangeDeep },
    { label: 'Total Dealers', value: dealers.length, icon: Users, tone: T.blue },
    { label: 'Total Orders', value: dealerOrders.length, icon: ShoppingCart, tone: '#6D4AB0' },
  ];

  const tabs = [
    { key: 'applications', label: 'Applications', count: pendingApps.length },
    { key: 'deposits', label: 'Deposits', count: deposits.length },
    { key: 'dealers', label: 'All Dealers', count: dealers.length },
    { key: 'orders', label: 'Orders', count: dealerOrders.length },
    { key: 'products', label: 'Products', count: dealerProducts.length },
  ];

  const fileBase = API.replace('/api', '');

  return (
    <IronShell
      title="Dealer Applications"
      subtitle="DEALER PORTAL · APPLICATIONS · DEPOSITS · ORDERS"
      onRefresh={fetchData}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{Number(s.value).toLocaleString('en-IN')}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tabs.map((tb) => {
                  const active = activeTab === tb.key;
                  return (
                    <button key={tb.key} onClick={() => setActiveTab(tb.key)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                      {tb.label}
                      <span style={{ ...mono, fontSize: 11, opacity: 0.85 }}>({tb.count})</span>
                    </button>
                  );
                })}
              </div>
              {activeTab === 'dealers' && (
                <button onClick={() => setShowCreateDealer(true)} style={primaryBtn}>
                  <Plus size={14} strokeWidth={2.2} /> Add Dealer
                </button>
              )}
              {activeTab === 'products' && (
                <button onClick={openAddProduct} style={primaryBtn}>
                  <Plus size={14} strokeWidth={2.2} /> Add Product
                </button>
              )}
            </div>

            {/* Applications Tab */}
            {activeTab === 'applications' && (
              <div style={{ overflowX: 'auto' }}>
                {applications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                    <Users size={40} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No applications found</div>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {['Firm / Contact', 'Location', 'Contact', 'Status', 'Applied', ''].map((h, i) => (
                        <th key={i} style={{ ...thCell, textAlign: i === 5 ? 'right' : (i === 3 ? 'center' : 'left') }}><Caps size={8.5}>{h}</Caps></th>
                      ))}
                    </tr></thead>
                    <tbody>{applications.map((app) => (
                      <tr key={app.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={tdCell}>
                          <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{app.firm_name}</div>
                          <div style={{ fontSize: 11, color: T.iron500, marginTop: 2 }}>{app.contact_person}</div>
                        </td>
                        <td style={tdCell}>{app.city}, {app.state}</td>
                        <td style={tdCell}>
                          <div style={{ ...mono, fontSize: 11.5, color: T.iron900 }}>{app.mobile || app.phone}</div>
                          <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{app.email}</div>
                        </td>
                        <td style={{ ...tdCell, textAlign: 'center' }}>{ironStatusPill(app.status)}</td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{new Date(app.created_at).toLocaleDateString()}</td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <button onClick={() => setSelectedApp(app)} style={rowActionStyle}><Eye size={13} /> Review</button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}

            {/* Deposits Tab */}
            {activeTab === 'deposits' && (
              <div style={{ padding: 14 }}>
                {deposits.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '46px 0', color: T.iron400 }}>No pending deposits</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {deposits.map((dealer) => (
                      <div key={dealer.id} style={{ border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 14, background: T.white }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900 }}>{dealer.firm_name}</div>
                            <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 2 }}>{dealer.contact_person}</div>
                            <div style={{ ...mono, fontSize: 11.5, color: T.iron500 }}>{dealer.phone}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <Caps size={8.5} color={T.iron400}>Amount</Caps>
                            <div style={{ ...mono, fontWeight: 700, fontSize: 16, color: T.iron900 }}>
                              ₹{(dealer.security_deposit?.amount || dealer.security_deposit_amount || 100000).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.iron200}` }}>
                          <div>
                            {(dealer.security_deposit?.proof_path || dealer.security_deposit_proof_path) && (
                              <a href={`${fileBase}${dealer.security_deposit?.proof_path || dealer.security_deposit_proof_path}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.blue, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                                <FileText size={14} /> View Proof
                              </a>
                            )}
                          </div>
                          <button onClick={() => setSelectedDeposit(dealer)} style={rowActionStyle}>Review</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* All Dealers Tab */}
            {activeTab === 'dealers' && (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ padding: '10px 14px', fontSize: 11.5, color: T.iron500, borderBottom: `1px solid ${T.iron200}` }}>
                  {depositStats.approved} dealers paid ₹1L deposit, {depositStats.pending} pending
                </div>
                {dealers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>No dealers found</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {['Firm Name', 'Contact', 'Location', 'Status', '₹1L Deposit', 'GST', ''].map((h, i) => (
                        <th key={i} style={{ ...thCell, textAlign: i === 6 ? 'right' : (i === 3 || i === 4 ? 'center' : 'left') }}><Caps size={8.5}>{h}</Caps></th>
                      ))}
                    </tr></thead>
                    <tbody>{dealers.map((dealer) => (
                      <tr key={dealer.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={tdCell}>
                          <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{dealer.firm_name}</div>
                          <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{dealer.email}</div>
                        </td>
                        <td style={tdCell}>
                          <div style={{ fontSize: 12, color: T.iron900 }}>{dealer.contact_person}</div>
                          <div style={{ ...mono, fontSize: 11, color: T.iron500, marginTop: 2 }}>{dealer.phone}</div>
                        </td>
                        <td style={tdCell}>{dealer.address?.city || dealer.city}, {dealer.address?.state || dealer.state}</td>
                        <td style={{ ...tdCell, textAlign: 'center' }}>{ironStatusPill(dealer.status)}</td>
                        <td style={{ ...tdCell, textAlign: 'center' }}>{ironDepositPill(dealer.security_deposit?.status || dealer.security_deposit_status || 'not_paid')}</td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{dealer.gst_number || dealer.gstin || '-'}</td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => openLedger(dealer)} title="Ledger & payments" style={{ ...rowActionStyle, border: `1px solid ${T.green}`, color: T.green }}><IndianRupee size={13} /></button>
                            <button onClick={() => openEditDealer(dealer)} title="Edit dealer" style={rowActionStyle}><Edit size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}

            {/* Dealer Orders Tab */}
            {activeTab === 'orders' && (
              <div style={{ overflowX: 'auto' }}>
                {dealerOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>No orders found</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {['Order #', 'Dealer', 'Amount', 'Status', 'Payment', 'Date', ''].map((h, i) => (
                        <th key={i} style={{ ...thCell, textAlign: (i === 2 || i === 6) ? 'right' : (i === 3 || i === 4 ? 'center' : 'left') }}><Caps size={8.5}>{h}</Caps></th>
                      ))}
                    </tr></thead>
                    <tbody>{dealerOrders.map((order) => (
                      <tr key={order.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={tdCell}>
                          <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{order.order_number}</div>
                          {order.is_historical && <span style={{ ...badgeStyle('slate'), marginTop: 3 }}>Historical</span>}
                        </td>
                        <td style={tdCell}>{order.dealer_name || order.dealer_id}</td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.iron900 }}>₹{order.total_amount?.toLocaleString('en-IN')}</td>
                        <td style={{ ...tdCell, textAlign: 'center' }}>{ironOrderPill(order.status)}</td>
                        <td style={{ ...tdCell, textAlign: 'center' }}>
                          <span style={badgeStyle(order.payment_status === 'received' ? 'ok' : 'warn')}>{order.payment_status}</span>
                        </td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{new Date(order.created_at).toLocaleDateString()}</td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <button onClick={() => openEditOrder(order)} title="Edit Order" style={rowActionStyle}><Edit size={13} /></button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}

            {/* Dealer Products Tab */}
            {activeTab === 'products' && (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ padding: '10px 14px', fontSize: 11.5, color: T.iron500, borderBottom: `1px solid ${T.iron200}` }}>
                  Products available for dealer ordering. Map to Master SKU for accounting.
                </div>
                {dealerProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                    No products found. Link product datasheets to Master SKUs and set selling prices.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {['Product', 'SKU', 'Category', 'Customer Price', 'Dealer Price', 'Discount', 'GST', 'Source', 'Status'].map((h, i) => (
                        <th key={i} style={{ ...thCell, textAlign: (i === 3 || i === 4) ? 'right' : (i === 5 || i === 6 || i === 8 ? 'center' : 'left') }}><Caps size={8.5}>{h}</Caps></th>
                      ))}
                    </tr></thead>
                    <tbody>{dealerProducts.map((product) => (
                      <tr key={product.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }} onClick={() => openEditProduct(product)}>
                        <td style={tdCell}>
                          <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{product.name}</div>
                        </td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{product.sku}</td>
                        <td style={tdCell}>{product.category}</td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron500 }}>₹{(product.selling_price || product.mrp)?.toLocaleString('en-IN')}</td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.green }}>₹{product.dealer_price?.toLocaleString('en-IN')}</td>
                        <td style={{ ...tdCell, textAlign: 'center' }}><span style={badgeStyle('info')}>{product.dealer_discount_percent || 15}% OFF</span></td>
                        <td style={{ ...tdCell, textAlign: 'center' }}>{product.gst_rate}%</td>
                        <td style={tdCell}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: product.source === 'datasheet' ? T.blue : product.source === 'master_sku' ? T.voltageText : T.iron400 }}>
                            {product.source === 'datasheet' ? 'Catalogue' : product.source === 'master_sku' ? 'Master SKU' : 'Legacy'}
                          </span>
                        </td>
                        <td style={{ ...tdCell, textAlign: 'center' }}>
                          <span style={badgeStyle(product.is_active !== false ? 'ok' : 'bad')}>{product.is_active !== false ? 'Active' : 'Inactive'}</span>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}
          </IronCard>
        </>
      )}

      {/* Application Review Dialog */}
      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Review Application: {selectedApp?.firm_name}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Application #{selectedApp?.application_number || selectedApp?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Firm Name</p>
                  <p className="text-white">{selectedApp.firm_name}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Contact Person</p>
                  <p className="text-white">{selectedApp.contact_person}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Email</p>
                  <p className="text-white">{selectedApp.email}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Mobile</p>
                  <p className="text-white">{selectedApp.mobile || selectedApp.phone}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg col-span-2">
                  <p className="text-slate-400 text-xs">Address</p>
                  <p className="text-white">
                    {selectedApp.address_line1 || selectedApp.address?.line1} {selectedApp.address_line2 || selectedApp.address?.line2}<br />
                    {selectedApp.city || selectedApp.address?.city}, {selectedApp.district || selectedApp.address?.district}, {selectedApp.state || selectedApp.address?.state} - {selectedApp.pincode || selectedApp.address?.pincode}
                  </p>
                </div>
                {(selectedApp.gstin || selectedApp.gst_number) && (
                  <div className="p-3 bg-slate-800 rounded-lg">
                    <p className="text-slate-400 text-xs">GSTIN</p>
                    <p className="text-white">{selectedApp.gstin || selectedApp.gst_number}</p>
                  </div>
                )}
                {selectedApp.business_type && (
                  <div className="p-3 bg-slate-800 rounded-lg">
                    <p className="text-slate-400 text-xs">Business Type</p>
                    <p className="text-white">{selectedApp.business_type}</p>
                  </div>
                )}
              </div>

              {selectedApp.status === 'new' || selectedApp.status === 'review' ? (
                <>
                  <div>
                    <label className="text-slate-300 text-sm">Security Deposit Amount</label>
                    <Input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm">Admin Notes</label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add notes (required for rejection)"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </>
              ) : (
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Admin Notes</p>
                  <p className="text-white">{selectedApp.admin_notes || 'None'}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelectedApp(null)} className="text-slate-400">
              Close
            </Button>
            {(selectedApp?.status === 'new' || selectedApp?.status === 'review') && (
              <>
                <Button
                  onClick={handleRejectApplication}
                  disabled={actionLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
                <Button
                  onClick={handleApproveApplication}
                  disabled={actionLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit Review Dialog */}
      <Dialog open={!!selectedDeposit} onOpenChange={() => setSelectedDeposit(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Review Deposit: {selectedDeposit?.firm_name}</DialogTitle>
          </DialogHeader>

          {selectedDeposit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Dealer</p>
                  <p className="text-white">{selectedDeposit.firm_name}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Amount</p>
                  <p className="text-white font-bold">
                    ₹{(selectedDeposit.security_deposit?.amount || selectedDeposit.security_deposit_amount || 100000).toLocaleString()}
                  </p>
                </div>
              </div>

              {(selectedDeposit.security_deposit?.proof_path || selectedDeposit.security_deposit_proof_path) && (
                <div className="p-4 bg-slate-800 rounded-lg">
                  <a
                    href={`${API.replace('/api', '')}${selectedDeposit.security_deposit?.proof_path || selectedDeposit.security_deposit_proof_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
                  >
                    <FileText className="w-5 h-5" />
                    View Deposit Proof Document
                  </a>
                </div>
              )}

              <div>
                <label className="text-slate-300 text-sm">Remarks</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add remarks (required for rejection)"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelectedDeposit(null)} className="text-slate-400">
              Close
            </Button>
            <Button
              onClick={handleRejectDeposit}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Reject
            </Button>
            <Button
              onClick={handleApproveDeposit}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Approve & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Order: {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Dealer</p>
                  <p className="text-white">{selectedOrder.dealer_name || selectedOrder.dealer_id}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Total Amount</p>
                  <p className="text-white font-bold">₹{selectedOrder.total_amount?.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Status</p>
                  {getOrderStatusBadge(selectedOrder.status)}
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Payment</p>
                  <Badge className={selectedOrder.payment_status === 'received' ? 'bg-green-600' : 'bg-yellow-600'}>
                    {selectedOrder.payment_status}
                  </Badge>
                </div>
              </div>

              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs mb-2">Items</p>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-white">{item.product_name || `Product ${item.product_id}`} x {item.quantity}</span>
                        <span className="text-slate-300">₹{item.line_total?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedOrder(null)} className="text-slate-400">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dealer Dialog */}
      <Dialog open={showEditDealer} onOpenChange={setShowEditDealer}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Dealer: {selectedDealer?.firm_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Firm Name</Label>
                <Input
                  value={editDealerForm.firm_name || ''}
                  onChange={(e) => setEditDealerForm({...editDealerForm, firm_name: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Contact Person</Label>
                <Input
                  value={editDealerForm.contact_person || ''}
                  onChange={(e) => setEditDealerForm({...editDealerForm, contact_person: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Phone</Label>
                <Input
                  value={editDealerForm.phone || ''}
                  onChange={(e) => setEditDealerForm({...editDealerForm, phone: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  data-testid="edit-dealer-phone"
                />
              </div>
              <div>
                <Label className="text-slate-300">Email</Label>
                <Input
                  type="email"
                  value={editDealerForm.email || ''}
                  onChange={(e) => setEditDealerForm({...editDealerForm, email: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="dealer@example.com"
                  data-testid="edit-dealer-email"
                />
              </div>
              <div>
                <Label className="text-slate-300">GST Number</Label>
                <Input
                  value={editDealerForm.gst_number || ''}
                  onChange={(e) => setEditDealerForm({...editDealerForm, gst_number: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">City</Label>
                <Input
                  value={editDealerForm.city || ''}
                  onChange={(e) => setEditDealerForm({...editDealerForm, city: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">State</Label>
                <Input
                  value={editDealerForm.state || ''}
                  onChange={(e) => setEditDealerForm({...editDealerForm, state: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Pincode</Label>
                <Input
                  value={editDealerForm.pincode || ''}
                  onChange={(e) => setEditDealerForm({...editDealerForm, pincode: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  maxLength={6}
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <Label className="text-slate-300">Address Line 1</Label>
              <Input
                value={editDealerForm.address_line1 || ''}
                onChange={(e) => setEditDealerForm({...editDealerForm, address_line1: e.target.value})}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Street address, building name"
              />
            </div>

            <div className="border-t border-slate-700 pt-4">
              <h4 className="text-white font-medium mb-3">Status & Deposit</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-slate-300">Dealer Status</Label>
                  <Select value={editDealerForm.status} onValueChange={(v) => setEditDealerForm({...editDealerForm, status: v})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Deposit Status</Label>
                  <Select value={editDealerForm.security_deposit_status} onValueChange={(v) => setEditDealerForm({...editDealerForm, security_deposit_status: v})}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="not_paid">Not Paid</SelectItem>
                      <SelectItem value="pending_review">Pending Review</SelectItem>
                      <SelectItem value="approved">Approved (₹1L Paid)</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Deposit Amount</Label>
                  <Input
                    type="number"
                    value={editDealerForm.security_deposit_amount || 100000}
                    onChange={(e) => setEditDealerForm({...editDealerForm, security_deposit_amount: parseFloat(e.target.value)})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Admin Notes</Label>
              <Textarea
                value={editDealerForm.admin_notes || ''}
                onChange={(e) => setEditDealerForm({...editDealerForm, admin_notes: e.target.value})}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditDealer(false)} className="text-slate-400">Cancel</Button>
            <Button onClick={handleSaveDealer} disabled={actionLoading} className="bg-cyan-600 hover:bg-cyan-700">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-1" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={showEditOrder} onOpenChange={setShowEditOrder}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Order: {selectedOrder?.order_number}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Modify order details and add/remove products
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-300">Status</Label>
                <Select value={editOrderForm.status} onValueChange={(v) => setEditOrderForm({...editOrderForm, status: v})}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="dispatched">Dispatched</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Payment Status</Label>
                <Select value={editOrderForm.payment_status} onValueChange={(v) => setEditOrderForm({...editOrderForm, payment_status: v})}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Total Amount</Label>
                <Input
                  type="number"
                  value={editOrderForm.total_amount || 0}
                  onChange={(e) => setEditOrderForm({...editOrderForm, total_amount: parseFloat(e.target.value)})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-medium">Order Items</h4>
                <Button size="sm" onClick={addItemToOrder} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {editOrderForm.items?.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-800 rounded-lg">
                    <div className="grid grid-cols-5 gap-3">
                      <div className="col-span-2">
                        <Label className="text-slate-400 text-xs">Product</Label>
                        <Select
                          value={item.product_id || ''}
                          onValueChange={(v) => updateOrderItem(idx, 'product_id', v)}
                        >
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-sm">
                            <SelectValue placeholder="Select product">
                              {item.product_name ||
                               dealerProducts.find(p => p.id === item.product_id)?.name ||
                               (item.product_id ? `Product (${item.product_id.slice(-8)})` : 'Select product')}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            {dealerProducts.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name} (₹{p.dealer_price})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs">Qty</Label>
                        <Input
                          type="number"
                          value={item.quantity || 1}
                          onChange={(e) => updateOrderItem(idx, 'quantity', parseInt(e.target.value))}
                          className="bg-slate-700 border-slate-600 text-white text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs">Unit Price</Label>
                        <Input
                          type="number"
                          value={item.unit_price || 0}
                          onChange={(e) => updateOrderItem(idx, 'unit_price', parseFloat(e.target.value))}
                          className="bg-slate-700 border-slate-600 text-white text-sm"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-slate-400 text-xs">Total</Label>
                          <Input
                            value={`₹${(item.line_total || 0).toLocaleString()}`}
                            disabled
                            className="bg-slate-900 border-slate-600 text-green-400 text-sm"
                          />
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeOrderItem(idx)} className="text-red-400 hover:text-red-300 mb-0.5">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {(!editOrderForm.items || editOrderForm.items.length === 0) && (
                  <p className="text-slate-500 text-center py-4">No items. Click "Add Item" to add products.</p>
                )}
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Admin Notes</Label>
              <Textarea
                value={editOrderForm.admin_notes || ''}
                onChange={(e) => setEditOrderForm({...editOrderForm, admin_notes: e.target.value})}
                placeholder="Add notes about this order..."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditOrder(false)} className="text-slate-400">Cancel</Button>
            <Button onClick={handleSaveOrder} disabled={actionLoading} className="bg-cyan-600 hover:bg-cyan-700">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-1" />
              Save Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Add Product Dialog */}
      <Dialog open={showEditProduct || showAddProduct} onOpenChange={(open) => { setShowEditProduct(open); setShowAddProduct(open); }}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">{selectedProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Configure dealer product with pricing and Master SKU mapping
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Product Name</Label>
                <Input
                  value={editProductForm.name || ''}
                  onChange={(e) => setEditProductForm({...editProductForm, name: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">SKU Code</Label>
                <Input
                  value={editProductForm.sku || ''}
                  onChange={(e) => setEditProductForm({...editProductForm, sku: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Category</Label>
                <Select value={editProductForm.category} onValueChange={(v) => setEditProductForm({...editProductForm, category: v})}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="Inverter">Inverter</SelectItem>
                    <SelectItem value="Battery">Battery</SelectItem>
                    <SelectItem value="Solar Inverter">Solar Inverter</SelectItem>
                    <SelectItem value="Solar Panel">Solar Panel</SelectItem>
                    <SelectItem value="Accessories">Accessories</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Map to Master SKU (for Accounting)</Label>
                <Select value={editProductForm.master_sku_id || 'none'} onValueChange={(v) => setEditProductForm({...editProductForm, master_sku_id: v === 'none' ? '' : v})}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select master SKU" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                    <SelectItem value="none">Not mapped</SelectItem>
                    {masterSkus.map(sku => (
                      <SelectItem key={sku.id} value={sku.id}>{sku.sku_code} - {sku.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-slate-300">MRP (₹)</Label>
                <Input
                  type="number"
                  value={editProductForm.mrp || 0}
                  onChange={(e) => setEditProductForm({...editProductForm, mrp: parseFloat(e.target.value)})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Dealer Price (₹)</Label>
                <Input
                  type="number"
                  value={editProductForm.dealer_price || 0}
                  onChange={(e) => setEditProductForm({...editProductForm, dealer_price: parseFloat(e.target.value)})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">GST Rate (%)</Label>
                <Select value={String(editProductForm.gst_rate || 18)} onValueChange={(v) => setEditProductForm({...editProductForm, gst_rate: parseInt(v)})}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="18">18%</SelectItem>
                    <SelectItem value="28">28%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Warranty (months)</Label>
                <Input
                  type="number"
                  value={editProductForm.warranty_months || 12}
                  onChange={(e) => setEditProductForm({...editProductForm, warranty_months: parseInt(e.target.value)})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowEditProduct(false); setShowAddProduct(false); }} className="text-slate-400">Cancel</Button>
            <Button onClick={handleSaveProduct} disabled={actionLoading} className="bg-cyan-600 hover:bg-cyan-700">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-1" />
              {selectedProduct ? 'Save Changes' : 'Create Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dealer Dialog */}
      <Dialog open={showCreateDealer} onOpenChange={setShowCreateDealer}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Dealer</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a new dealer account. The dealer can login via OTP or password.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Firm Name *</Label>
              <Input
                value={createDealerForm.firm_name}
                onChange={(e) => setCreateDealerForm({...createDealerForm, firm_name: e.target.value})}
                placeholder="ABC Electronics"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Contact Person *</Label>
              <Input
                value={createDealerForm.contact_person}
                onChange={(e) => setCreateDealerForm({...createDealerForm, contact_person: e.target.value})}
                placeholder="John Doe"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Email *</Label>
              <Input
                type="email"
                value={createDealerForm.email}
                onChange={(e) => setCreateDealerForm({...createDealerForm, email: e.target.value})}
                placeholder="dealer@example.com"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Phone *</Label>
              <Input
                value={createDealerForm.phone}
                onChange={(e) => setCreateDealerForm({...createDealerForm, phone: e.target.value})}
                placeholder="9876543210"
                maxLength={10}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">GST Number</Label>
              <Input
                value={createDealerForm.gst_number}
                onChange={(e) => setCreateDealerForm({...createDealerForm, gst_number: e.target.value})}
                placeholder="22AAAAA0000A1Z5"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Tier</Label>
              <select
                value={createDealerForm.tier}
                onChange={(e) => setCreateDealerForm({...createDealerForm, tier: e.target.value})}
                className="w-full h-10 px-3 rounded-md bg-slate-700 border border-slate-600 text-white"
              >
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="platinum">Platinum</option>
              </select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label className="text-slate-300">Address *</Label>
              <Input
                value={createDealerForm.address}
                onChange={(e) => setCreateDealerForm({...createDealerForm, address: e.target.value})}
                placeholder="Shop No, Street, Area"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">City *</Label>
              <Input
                value={createDealerForm.city}
                onChange={(e) => setCreateDealerForm({...createDealerForm, city: e.target.value})}
                placeholder="City"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">State</Label>
              <Input
                value={createDealerForm.state}
                onChange={(e) => setCreateDealerForm({...createDealerForm, state: e.target.value})}
                placeholder="State"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Pincode *</Label>
              <Input
                value={createDealerForm.pincode}
                onChange={(e) => setCreateDealerForm({...createDealerForm, pincode: e.target.value})}
                placeholder="110001"
                maxLength={6}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Password (Optional)</Label>
              <Input
                type="password"
                value={createDealerForm.password}
                onChange={(e) => setCreateDealerForm({...createDealerForm, password: e.target.value})}
                placeholder="Leave empty for OTP-only login"
                className="bg-slate-700 border-slate-600 text-white"
              />
              <p className="text-xs text-slate-500">If empty, dealer will use OTP to login</p>
            </div>
          </div>
          <div className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg text-sm text-green-400">
            Note: Admin-created dealers skip the ₹1L deposit requirement.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDealer(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleCreateDealer}
              disabled={createDealerLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {createDealerLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Plus className="w-4 h-4 mr-1" />
              Create Dealer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dealer Ledger & Manual Payments (admin only) */}
      <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-emerald-400" />
              Ledger — {ledgerDealer?.firm_name}
            </DialogTitle>
            <DialogDescription>
              Add or delete payments and adjustments. Positive balance = dealer owes us;
              negative = we owe the dealer (e.g. their security deposit).
            </DialogDescription>
          </DialogHeader>

          {ledgerLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : ledgerData ? (
            <div className="space-y-4">
              {/* Current balance */}
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 flex items-center justify-between">
                <span className="text-slate-400 text-sm">Current balance</span>
                <span className={`text-xl font-semibold tabular-nums ${
                  (ledgerData.current_balance || 0) > 0 ? 'text-amber-400'
                  : (ledgerData.current_balance || 0) < 0 ? 'text-emerald-400' : 'text-slate-300'
                }`}>
                  ₹{Math.abs(ledgerData.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  <span className="text-xs ml-2 text-slate-500">
                    {(ledgerData.current_balance || 0) > 0 ? 'dealer owes us'
                      : (ledgerData.current_balance || 0) < 0 ? 'we owe dealer' : 'settled'}
                  </span>
                </span>
              </div>

              {/* Add payment form */}
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3">
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add entry
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-400">Type</Label>
                    <Select
                      value={paymentForm.kind}
                      onValueChange={(v) => setPaymentForm({ ...paymentForm, kind: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payment_received">Payment received (credit)</SelectItem>
                        <SelectItem value="security_deposit">Security deposit (credit)</SelectItem>
                        <SelectItem value="refund_to_dealer">Refund to dealer (debit)</SelectItem>
                        <SelectItem value="invoice">Invoice / charge (debit)</SelectItem>
                        <SelectItem value="adjustment_credit">Adjustment — credit</SelectItem>
                        <SelectItem value="adjustment_debit">Adjustment — debit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Amount (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Date (optional)</Label>
                    <Input
                      type="date"
                      value={paymentForm.date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Narration (optional)</Label>
                    <Input
                      value={paymentForm.narration}
                      onChange={(e) => setPaymentForm({ ...paymentForm, narration: e.target.value })}
                      placeholder="e.g. NEFT ref 12345"
                    />
                  </div>
                </div>
                <Button
                  onClick={addLedgerPayment}
                  disabled={paymentSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 w-full"
                >
                  {paymentSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                  Add entry
                </Button>
              </div>

              {/* Entries */}
              <div>
                <p className="text-sm font-medium text-white mb-2">
                  Entries ({ledgerData.entries?.length || 0})
                </p>
                {(!ledgerData.entries || ledgerData.entries.length === 0) ? (
                  <p className="text-slate-500 text-sm py-6 text-center">No ledger entries yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {ledgerData.entries.map((e) => (
                      <div key={e.id} className="flex items-center gap-3 rounded-md border border-slate-700/60 bg-slate-900 px-3 py-2 text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate">{e.narration || e.entry_type}</p>
                          <p className="text-slate-500 text-xs">
                            {(e.created_at || '').slice(0, 10)} · {e.entry_type}
                            {e.manual && <span className="ml-1 text-emerald-500">· manual</span>}
                          </p>
                        </div>
                        <div className="text-right tabular-nums">
                          {(e.debit || 0) > 0 && <span className="text-amber-400">+₹{(e.debit).toLocaleString('en-IN')}</span>}
                          {(e.credit || 0) > 0 && <span className="text-emerald-400">−₹{(e.credit).toLocaleString('en-IN')}</span>}
                          <p className="text-slate-500 text-xs">bal ₹{(e.running_balance || 0).toLocaleString('en-IN')}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteLedgerEntry(e.id)}
                          className="text-rose-400 hover:text-rose-300 h-7 w-7 p-0"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm py-6 text-center">Could not load ledger.</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setLedgerOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

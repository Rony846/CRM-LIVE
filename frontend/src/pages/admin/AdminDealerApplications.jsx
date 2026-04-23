import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Users, Loader2, CheckCircle, XCircle, Eye, Clock, Building2,
  Phone, Mail, MapPin, FileText, Shield, IndianRupee, AlertTriangle,
  Package, ShoppingCart, Edit, Trash2, Plus, Save, Link
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
      security_deposit_status: dealer.security_deposit?.status || dealer.security_deposit_status || 'not_paid',
      security_deposit_amount: dealer.security_deposit?.amount || dealer.security_deposit_amount || 100000,
      admin_notes: dealer.admin_notes || ''
    });
    setSelectedDealer(dealer);
    setShowEditDealer(true);
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

  const getDepositBadge = (status) => {
    const styles = {
      approved: { bg: 'bg-green-600', text: '₹1L Paid' },
      pending_review: { bg: 'bg-yellow-600', text: 'Review Pending' },
      not_paid: { bg: 'bg-red-600', text: 'Not Paid' },
      rejected: { bg: 'bg-red-600', text: 'Rejected' }
    };
    const style = styles[status] || styles.not_paid;
    return <Badge className={style.bg}>{style.text}</Badge>;
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

  if (loading) {
    return (
      <DashboardLayout title="Dealer Management">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dealer Management">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending Apps</p>
                  <p className="text-2xl font-bold text-yellow-400">{pendingApps.length}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending Deposits</p>
                  <p className="text-2xl font-bold text-cyan-400">{deposits.length}</p>
                </div>
                <Shield className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700 border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">₹1L Deposit Paid</p>
                  <p className="text-2xl font-bold text-green-400">{depositStats.approved}</p>
                </div>
                <IndianRupee className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700 border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Deposit Pending</p>
                  <p className="text-2xl font-bold text-red-400">{depositStats.pending}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Dealers</p>
                  <p className="text-2xl font-bold text-white">{dealers.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Orders</p>
                  <p className="text-2xl font-bold text-purple-400">{dealerOrders.length}</p>
                </div>
                <ShoppingCart className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800">
            <TabsTrigger value="applications" className="data-[state=active]:bg-cyan-600">
              Applications ({pendingApps.length})
            </TabsTrigger>
            <TabsTrigger value="deposits" className="data-[state=active]:bg-cyan-600">
              Deposits ({deposits.length})
            </TabsTrigger>
            <TabsTrigger value="dealers" className="data-[state=active]:bg-cyan-600">
              All Dealers ({dealers.length})
            </TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-cyan-600">
              Orders ({dealerOrders.length})
            </TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-cyan-600">
              Products ({dealerProducts.length})
            </TabsTrigger>
          </TabsList>

          {/* Applications Tab */}
          <TabsContent value="applications">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Dealer Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-400 text-sm">Firm / Contact</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Location</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Contact</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Status</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Applied</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app) => (
                        <tr key={app.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="p-3">
                            <p className="text-white font-medium">{app.firm_name}</p>
                            <p className="text-slate-400 text-sm">{app.contact_person}</p>
                          </td>
                          <td className="p-3 text-slate-300">
                            {app.city}, {app.state}
                          </td>
                          <td className="p-3">
                            <p className="text-slate-300">{app.mobile || app.phone}</p>
                            <p className="text-slate-400 text-xs">{app.email}</p>
                          </td>
                          <td className="p-3 text-center">{getStatusBadge(app.status)}</td>
                          <td className="p-3 text-slate-400 text-sm">
                            {new Date(app.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              onClick={() => setSelectedApp(app)}
                              className="bg-cyan-600 hover:bg-cyan-700"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Review
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {applications.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            No applications found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deposits Tab */}
          <TabsContent value="deposits">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Pending Deposit Approvals</CardTitle>
              </CardHeader>
              <CardContent>
                {deposits.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No pending deposits</p>
                ) : (
                  <div className="space-y-4">
                    {deposits.map((dealer) => (
                      <div key={dealer.id} className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-white font-medium">{dealer.firm_name}</h4>
                            <p className="text-slate-400 text-sm">{dealer.contact_person}</p>
                            <p className="text-slate-400 text-sm">{dealer.phone}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-400 text-sm">Amount</p>
                            <p className="text-white font-bold">
                              ₹{(dealer.security_deposit?.amount || dealer.security_deposit_amount || 100000).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
                          <div className="flex items-center gap-4">
                            {(dealer.security_deposit?.proof_path || dealer.security_deposit_proof_path) && (
                              <a
                                href={`${API.replace('/api', '')}${dealer.security_deposit?.proof_path || dealer.security_deposit_proof_path}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                              >
                                <FileText className="w-4 h-4" />
                                View Proof
                              </a>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => setSelectedDeposit(dealer)}
                            className="bg-cyan-600 hover:bg-cyan-700"
                          >
                            Review
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Dealers Tab */}
          <TabsContent value="dealers">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">All Dealers</CardTitle>
                  <CardDescription className="text-slate-400">
                    {depositStats.approved} dealers paid ₹1L deposit, {depositStats.pending} pending
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setShowCreateDealer(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Dealer
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-400 text-sm">Firm Name</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Contact</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Location</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Status</th>
                        <th className="text-center p-3 text-slate-400 text-sm">₹1L Deposit</th>
                        <th className="text-left p-3 text-slate-400 text-sm">GST</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dealers.map((dealer) => (
                        <tr key={dealer.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="p-3">
                            <p className="text-white font-medium">{dealer.firm_name}</p>
                            <p className="text-slate-400 text-xs">{dealer.email}</p>
                          </td>
                          <td className="p-3">
                            <p className="text-slate-300">{dealer.contact_person}</p>
                            <p className="text-slate-400 text-sm">{dealer.phone}</p>
                          </td>
                          <td className="p-3 text-slate-300">
                            {dealer.address?.city || dealer.city}, {dealer.address?.state || dealer.state}
                          </td>
                          <td className="p-3 text-center">{getStatusBadge(dealer.status)}</td>
                          <td className="p-3 text-center">
                            {getDepositBadge(dealer.security_deposit?.status || dealer.security_deposit_status || 'not_paid')}
                          </td>
                          <td className="p-3 text-slate-400 text-sm">
                            {dealer.gst_number || dealer.gstin || '-'}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDealer(dealer)}
                              className="text-cyan-400 hover:text-cyan-300"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {dealers.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No dealers found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dealer Orders Tab */}
          <TabsContent value="orders">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Dealer Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-400 text-sm">Order #</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Dealer</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Amount</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Status</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Payment</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Date</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dealerOrders.map((order) => (
                        <tr key={order.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="p-3">
                            <p className="text-white font-mono">{order.order_number}</p>
                            {order.is_historical && (
                              <Badge className="bg-slate-600 text-xs">Historical</Badge>
                            )}
                          </td>
                          <td className="p-3 text-slate-300">{order.dealer_name || order.dealer_id}</td>
                          <td className="p-3 text-right text-white font-medium">
                            ₹{order.total_amount?.toLocaleString()}
                          </td>
                          <td className="p-3 text-center">{getOrderStatusBadge(order.status)}</td>
                          <td className="p-3 text-center">
                            <Badge className={order.payment_status === 'received' ? 'bg-green-600' : 'bg-yellow-600'}>
                              {order.payment_status}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-400 text-sm">
                            {new Date(order.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditOrder(order)}
                              className="text-cyan-400 hover:text-cyan-300"
                              title="Edit Order"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {dealerOrders.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No orders found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dealer Products Tab */}
          <TabsContent value="products">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">Dealer Products</CardTitle>
                  <CardDescription className="text-slate-400">Products available for dealer ordering. Map to Master SKU for accounting.</CardDescription>
                </div>
                <Button onClick={openAddProduct} className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-400 text-sm">Product</th>
                        <th className="text-left p-3 text-slate-400 text-sm">SKU</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Category</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Customer Price</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Dealer Price</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Discount</th>
                        <th className="text-center p-3 text-slate-400 text-sm">GST</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Source</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dealerProducts.map((product) => {
                        return (
                        <tr key={product.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="p-3">
                            <p className="text-white font-medium">{product.name}</p>
                          </td>
                          <td className="p-3 text-slate-400 font-mono text-sm">{product.sku}</td>
                          <td className="p-3 text-slate-300">{product.category}</td>
                          <td className="p-3 text-right text-slate-400">₹{(product.selling_price || product.mrp)?.toLocaleString()}</td>
                          <td className="p-3 text-right text-green-400 font-medium">₹{product.dealer_price?.toLocaleString()}</td>
                          <td className="p-3 text-center">
                            <Badge className="bg-cyan-600">{product.dealer_discount_percent || 15}% OFF</Badge>
                          </td>
                          <td className="p-3 text-center text-slate-300">{product.gst_rate}%</td>
                          <td className="p-3">
                            <span className={`text-sm ${product.source === 'datasheet' ? 'text-cyan-400' : product.source === 'master_sku' ? 'text-yellow-400' : 'text-slate-400'}`}>
                              {product.source === 'datasheet' ? 'Catalogue' : product.source === 'master_sku' ? 'Master SKU' : 'Legacy'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <Badge className={product.is_active !== false ? 'bg-green-600' : 'bg-red-600'}>
                              {product.is_active !== false ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                        </tr>
                      )})}
                      {dealerProducts.length === 0 && (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400">
                            No products found. Link product datasheets to Master SKUs and set selling prices.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

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
                        <Select value={item.product_id || ''} onValueChange={(v) => updateOrderItem(idx, 'product_id', v)}>
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-sm">
                            <SelectValue placeholder="Select product" />
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
    </DashboardLayout>
  );
}

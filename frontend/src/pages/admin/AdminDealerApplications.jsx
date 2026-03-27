import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Users, Loader2, CheckCircle, XCircle, Eye, Clock, Building2,
  Phone, Mail, MapPin, FileText, Shield, IndianRupee, AlertTriangle,
  Package, ShoppingCart, Edit, Trash2, Plus
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
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [dealerOrders, setDealerOrders] = useState([]);
  const [dealerProducts, setDealerProducts] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('applications');
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [depositAmount, setDepositAmount] = useState('100000');
  
  // Stats
  const [depositStats, setDepositStats] = useState({ approved: 0, pending: 0 });

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [appsRes, depositsRes, dealersRes, ordersRes, productsRes] = await Promise.all([
        axios.get(`${API}/admin/dealer-applications`, { headers }),
        axios.get(`${API}/admin/dealer-deposits?status=pending`, { headers }),
        axios.get(`${API}/admin/dealers`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/dealer-orders`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/dealer/products`, { headers }).catch(() => ({ data: [] }))
      ]);
      setApplications(appsRes.data || []);
      setDeposits(depositsRes.data || []);
      setDealers(dealersRes.data || []);
      setDealerOrders(ordersRes.data || []);
      setDealerProducts(productsRes.data || []);
      
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
              <CardHeader>
                <CardTitle className="text-white">All Dealers</CardTitle>
                <CardDescription className="text-slate-400">
                  {depositStats.approved} dealers paid ₹1L deposit, {depositStats.pending} pending
                </CardDescription>
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
                        </tr>
                      ))}
                      {dealers.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
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
                              onClick={() => setSelectedOrder(order)}
                              className="text-cyan-400 hover:text-cyan-300"
                            >
                              <Eye className="w-4 h-4" />
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
                  <CardDescription className="text-slate-400">Products available for dealer ordering</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-400 text-sm">Product</th>
                        <th className="text-left p-3 text-slate-400 text-sm">SKU</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Category</th>
                        <th className="text-right p-3 text-slate-400 text-sm">MRP</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Dealer Price</th>
                        <th className="text-center p-3 text-slate-400 text-sm">GST</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Warranty</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dealerProducts.map((product) => (
                        <tr key={product.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="p-3">
                            <p className="text-white font-medium">{product.name}</p>
                          </td>
                          <td className="p-3 text-slate-400 font-mono text-sm">{product.sku}</td>
                          <td className="p-3 text-slate-300">{product.category}</td>
                          <td className="p-3 text-right text-slate-400">₹{product.mrp?.toLocaleString()}</td>
                          <td className="p-3 text-right text-green-400 font-medium">₹{product.dealer_price?.toLocaleString()}</td>
                          <td className="p-3 text-center text-slate-300">{product.gst_rate}%</td>
                          <td className="p-3 text-center text-slate-300">{product.warranty_months} mo</td>
                          <td className="p-3 text-center">
                            <Badge className={product.is_active ? 'bg-green-600' : 'bg-red-600'}>
                              {product.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {dealerProducts.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            No products found
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
    </DashboardLayout>
  );
}

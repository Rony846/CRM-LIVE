import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, Package, Wallet, Ticket, TrendingUp, AlertTriangle,
  CheckCircle, Clock, ArrowRight, Loader2, Building2, Phone, Mail,
  FileText, Upload, Shield
} from 'lucide-react';

export default function DealerDashboard() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (token) {
      fetchDashboard();
    }
  }, [token]);

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${API}/dealer/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <DashboardLayout title="Dealer Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  const dealer = data?.dealer || {};
  const stats = data?.stats || {};
  const canOrder = data?.can_place_orders;
  const depositPending = dealer.security_deposit_status !== 'approved';

  return (
    <DashboardLayout title="Dealer Dashboard">
      <div className="space-y-6">
        {/* Deposit Warning Banner */}
        {depositPending && (
          <Card className="bg-yellow-900/30 border-yellow-600">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-yellow-400 font-semibold">Security Deposit Required</h3>
                  <p className="text-yellow-200 text-sm mt-1">
                    {dealer.security_deposit_status === 'not_paid' && 
                      `Please upload your security deposit proof of ₹${dealer.security_deposit_amount?.toLocaleString()} to activate your dealer account and start placing orders.`}
                    {dealer.security_deposit_status === 'pending' && 
                      'Your security deposit proof is under review. We will notify you once approved.'}
                    {dealer.security_deposit_status === 'rejected' && 
                      `Your deposit proof was rejected: ${dealer.security_deposit_remarks}. Please upload again.`}
                  </p>
                  {(dealer.security_deposit_status === 'not_paid' || dealer.security_deposit_status === 'rejected') && (
                    <Link to="/dealer/deposit">
                      <Button className="mt-3 bg-yellow-600 hover:bg-yellow-700">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Deposit Proof
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Welcome Card */}
        <Card className="bg-gradient-to-r from-cyan-900 to-blue-900 border-cyan-700">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{dealer.firm_name}</h2>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-slate-300">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" /> {dealer.city}, {dealer.state}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4" /> {dealer.phone}
                  </span>
                  {dealer.gst_number && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" /> {dealer.gst_number}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={dealer.status === 'approved' ? 'bg-green-600' : 'bg-yellow-600'}>
                  {dealer.status === 'approved' ? (
                    <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                  ) : (
                    <><Clock className="w-3 h-3 mr-1" /> {dealer.status}</>
                  )}
                </Badge>
                <Badge className={dealer.security_deposit_status === 'approved' ? 'bg-green-600' : 'bg-yellow-600'}>
                  <Shield className="w-3 h-3 mr-1" /> 
                  Deposit: {dealer.security_deposit_status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Orders</p>
                  <p className="text-2xl font-bold text-white">{stats.total_orders || 0}</p>
                </div>
                <ShoppingCart className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending Orders</p>
                  <p className="text-2xl font-bold text-yellow-400">{stats.pending_orders || 0}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Open Tickets</p>
                  <p className="text-2xl font-bold text-white">{stats.open_tickets || 0}</p>
                </div>
                <Ticket className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Outstanding</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.outstanding_balance)}</p>
                </div>
                <Wallet className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/dealer/orders/new">
            <Card className={`border-slate-700 transition-all hover:border-cyan-500 ${!canOrder ? 'opacity-50' : 'bg-slate-800 cursor-pointer'}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-cyan-600 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Place Order</p>
                  <p className="text-slate-400 text-sm">{canOrder ? 'Browse products' : 'Deposit required'}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>

          <Link to="/dealer/orders">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">My Orders</p>
                  <p className="text-slate-400 text-sm">View order history</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>

          <Link to="/dealer/tickets">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Ticket className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Support</p>
                  <p className="text-slate-400 text-sm">Get help</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>

          <Link to="/dealer/promotions">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Promotions</p>
                  <p className="text-slate-400 text-sm">Schemes & requests</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Orders */}
        {data?.recent_orders?.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.recent_orders.map((order) => (
                  <Link key={order.id} to={`/dealer/orders/${order.id}`}>
                    <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors">
                      <div>
                        <p className="text-white font-medium">{order.order_number}</p>
                        <p className="text-slate-400 text-sm">{new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-medium">{formatCurrency(order.total_amount)}</p>
                        <Badge className={
                          order.status === 'delivered' ? 'bg-green-600' :
                          order.status === 'dispatched' ? 'bg-blue-600' :
                          order.status === 'confirmed' ? 'bg-cyan-600' :
                          order.status === 'cancelled' ? 'bg-red-600' :
                          'bg-yellow-600'
                        }>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, Package, Wallet, Ticket, TrendingUp, AlertTriangle,
  CheckCircle, Clock, ArrowRight, Loader2, Building2, Phone, Mail,
  FileText, Upload, Shield, Award, Crown, Star, Download, Truck,
  BarChart3, FileCheck, IndianRupee
} from 'lucide-react';

// Tier configuration
const TIER_CONFIG = {
  silver: { 
    label: 'Silver', 
    color: 'from-slate-400 to-slate-500', 
    textColor: 'text-slate-300',
    bgColor: 'bg-gradient-to-r from-slate-600 to-slate-700',
    icon: Star 
  },
  gold: { 
    label: 'Gold', 
    color: 'from-yellow-400 to-amber-500', 
    textColor: 'text-yellow-400',
    bgColor: 'bg-gradient-to-r from-yellow-600 to-amber-600',
    icon: Award 
  },
  platinum: { 
    label: 'Platinum', 
    color: 'from-purple-400 to-indigo-400', 
    textColor: 'text-purple-300',
    bgColor: 'bg-gradient-to-r from-purple-600 to-indigo-600',
    icon: Crown 
  }
};

export default function DealerDashboard() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [tierData, setTierData] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);

  useEffect(() => {
    if (token) {
      fetchDashboard();
    }
  }, [token]);

  const fetchDashboard = async () => {
    try {
      const [dashboardRes, tierRes, performanceRes] = await Promise.all([
        axios.get(`${API}/dealer/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/dealer/tier`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/dealer/performance?period=month`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setData(dashboardRes.data);
      setTierData(tierRes.data);
      setPerformanceData(performanceRes.data);
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
  const depositStatus = dealer.security_deposit_status || dealer.security_deposit?.status;
  const depositPending = depositStatus !== 'approved';
  
  const tier = tierData?.current_tier || 'silver';
  const tierConfig = TIER_CONFIG[tier];
  const TierIcon = tierConfig?.icon || Star;

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
                    {depositStatus === 'not_paid' && 
                      `Please upload your security deposit proof of ₹${(dealer.security_deposit_amount || dealer.security_deposit?.amount || 100000)?.toLocaleString()} to activate your dealer account and start placing orders.`}
                    {(depositStatus === 'pending' || depositStatus === 'pending_review') && 
                      'Your security deposit proof is under review. We will notify you once approved.'}
                    {depositStatus === 'rejected' && 
                      `Your deposit proof was rejected: ${dealer.security_deposit_remarks || dealer.security_deposit?.remarks}. Please upload again.`}
                  </p>
                  {(depositStatus === 'not_paid' || depositStatus === 'rejected') && (
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

        {/* Welcome Card with Tier Badge */}
        <Card className={`border-0 ${tierConfig?.bgColor || 'bg-gradient-to-r from-cyan-900 to-blue-900'}`}>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-white">{dealer.firm_name}</h2>
                  <Badge className={`${tierConfig?.bgColor} border border-white/20 text-white font-bold`}>
                    <TierIcon className="w-3 h-3 mr-1" />
                    {tierConfig?.label} Partner
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-slate-200">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" /> {dealer.city || dealer.address?.city}, {dealer.state || dealer.address?.state}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4" /> {dealer.phone}
                  </span>
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
                <Badge className={depositStatus === 'approved' ? 'bg-green-600' : 'bg-yellow-600'}>
                  <Shield className="w-3 h-3 mr-1" /> 
                  Deposit: {depositStatus}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tier Progress Card */}
        {tierData && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${tierConfig?.color} flex items-center justify-center`}>
                    <TierIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Current Tier</p>
                    <p className={`text-lg font-bold ${tierConfig?.textColor}`}>{tierConfig?.label} Partner</p>
                  </div>
                </div>
                
                <div className="flex-1 px-4">
                  {tierData.next_tier ? (
                    <>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-400">Progress to {TIER_CONFIG[tierData.next_tier]?.label}</span>
                        <span className="text-white">{tierData.progress_to_next}%</span>
                      </div>
                      <Progress value={tierData.progress_to_next} className="h-2" />
                      <p className="text-xs text-slate-500 mt-1">
                        {formatCurrency(tierData.remaining_to_next)} more to reach {TIER_CONFIG[tierData.next_tier]?.label}
                      </p>
                    </>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-purple-300 font-medium">You've reached the highest tier!</p>
                      <p className="text-slate-400 text-sm">Thank you for your partnership</p>
                    </div>
                  )}
                </div>
                
                <div className="text-right">
                  <p className="text-sm text-slate-400">Lifetime Purchases</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(tierData.total_purchase_value)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Monthly Performance Summary */}
        {performanceData && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  This Month's Performance
                </CardTitle>
                <Link to="/dealer/performance">
                  <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300">
                    View Details <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-900 rounded-lg text-center">
                  <p className="text-2xl font-bold text-white">{performanceData.total_orders}</p>
                  <p className="text-slate-400 text-sm">Orders</p>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(performanceData.total_value)}</p>
                  <p className="text-slate-400 text-sm">Total Value</p>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-center">
                  <p className="text-2xl font-bold text-cyan-400">{performanceData.orders_by_status?.delivered || 0}</p>
                  <p className="text-slate-400 text-sm">Delivered</p>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-400">{formatCurrency(performanceData.avg_order_value)}</p>
                  <p className="text-slate-400 text-sm">Avg. Order Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

          <Link to="/dealer/dispatches">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Track Dispatches</p>
                  <p className="text-slate-400 text-sm">AWB & delivery status</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>

          <Link to="/dealer/ledger">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <IndianRupee className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Ledger</p>
                  <p className="text-slate-400 text-sm">Payments & balance</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>

          <Link to="/dealer/documents">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Download className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Downloads</p>
                  <p className="text-slate-400 text-sm">Invoices & documents</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Second Row Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/dealer/catalogue">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Product Catalogue</p>
                  <p className="text-slate-400 text-sm">Browse & check stock</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>

          <Link to="/dealer/targets">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Sales Targets</p>
                  <p className="text-slate-400 text-sm">Track & earn incentives</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>

          <Link to="/dealer/warranty">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Warranty</p>
                  <p className="text-slate-400 text-sm">Register warranties</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>

          <Link to="/dealer/announcements">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-teal-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Announcements</p>
                  <p className="text-slate-400 text-sm">Latest updates</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Third Row Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/dealer/orders">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-violet-600 rounded-lg flex items-center justify-center">
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

          <Link to="/dealer/reorder-suggestions">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-pink-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Reorder Suggestions</p>
                  <p className="text-slate-400 text-sm">Smart recommendations</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 ml-auto" />
              </CardContent>
            </Card>
          </Link>

          <Link to="/dealer/tickets">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
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

          <Link to="/dealer/certificate">
            <Card className="bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-cyan-500">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-lime-600 rounded-lg flex items-center justify-center">
                  <FileCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Certificate</p>
                  <p className="text-slate-400 text-sm">Dealer authorization</p>
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Recent Orders</CardTitle>
                <Link to="/dealer/orders">
                  <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
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

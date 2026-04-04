import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Package, ShoppingCart, Wrench, Store, Search, RefreshCw, Loader2,
  IndianRupee, CheckCircle2, Clock, XCircle, ExternalLink, Eye,
  TrendingUp, AlertCircle, Filter
} from 'lucide-react';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export default function SalesOrders() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [firms, setFirms] = useState([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [firmFilter, setFirmFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  
  const headers = { Authorization: `Bearer ${token}` };

  const fetchOrders = useCallback(async () => {
    try {
      const params = { limit: 200 };
      
      // Apply category filter based on active tab
      if (activeTab !== 'all') {
        params.category = activeTab;
      }
      if (firmFilter && firmFilter !== 'all') {
        params.firm_id = firmFilter;
      }
      if (sourceFilter && sourceFilter !== 'all') {
        params.order_source = sourceFilter;
      }
      if (paymentFilter && paymentFilter !== 'all') {
        params.payment_status = paymentFilter;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      
      const res = await axios.get(`${API}/sales-orders`, { headers, params });
      setOrders(res.data.orders || []);
    } catch (error) {
      toast.error('Failed to fetch orders');
    }
  }, [token, activeTab, firmFilter, sourceFilter, paymentFilter, searchQuery]);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/sales-orders/stats`, { headers });
      setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchFirms = async () => {
    try {
      const res = await axios.get(`${API}/firms`, { headers });
      setFirms(res.data || []);
    } catch (error) {
      console.error('Failed to fetch firms:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchOrders(), fetchStats(), fetchFirms()]);
      setLoading(false);
    };
    loadData();
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrders();
  }, [activeTab, firmFilter, sourceFilter, paymentFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  const getPaymentStatusBadge = (status, marketplaceStatus) => {
    if (marketplaceStatus === 'paid_via_marketplace') {
      return <Badge className="bg-green-100 text-green-800">Paid via Marketplace</Badge>;
    }
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case 'unpaid':
        return <Badge className="bg-red-100 text-red-800">Unpaid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'partial':
        return <Badge className="bg-orange-100 text-orange-800">Partial</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const getSourceBadge = (source) => {
    const colors = {
      amazon: 'bg-orange-100 text-orange-800',
      flipkart: 'bg-yellow-100 text-yellow-800',
      website: 'bg-blue-100 text-blue-800',
      walkin: 'bg-purple-100 text-purple-800',
      direct: 'bg-slate-100 text-slate-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return (
      <Badge className={colors[source] || colors.other}>
        {source?.toUpperCase() || 'DIRECT'}
      </Badge>
    );
  };

  if (loading && orders.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="sales-orders-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Sales Orders</h1>
            <p className="text-slate-500 text-sm mt-1">
              All outbound dispatches tracked as sales orders
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => { fetchOrders(); fetchStats(); }}
            data-testid="refresh-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <ShoppingCart className="w-4 h-4" />
                  New Orders
                </div>
                <p className="text-2xl font-bold text-blue-600">{stats.by_category?.new_orders || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <Wrench className="w-4 h-4" />
                  Repairs
                </div>
                <p className="text-2xl font-bold text-orange-600">{stats.by_category?.repairs || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <Store className="w-4 h-4" />
                  Walk-in
                </div>
                <p className="text-2xl font-bold text-purple-600">{stats.by_category?.walkins || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Paid
                </div>
                <p className="text-2xl font-bold text-green-600">{stats.by_payment_status?.paid || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <Clock className="w-4 h-4" />
                  Pending
                </div>
                <p className="text-2xl font-bold text-yellow-600">{stats.by_payment_status?.pending || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-red-600 mb-1">
                  <XCircle className="w-4 h-4" />
                  Unpaid
                </div>
                <p className="text-2xl font-bold text-red-600">{stats.by_payment_status?.unpaid || 0}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Source Stats */}
        {stats && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <span className="text-sm font-medium text-slate-600">By Source:</span>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-orange-50">
                    Amazon: {stats.by_source?.amazon || 0}
                  </Badge>
                  <Badge variant="outline" className="bg-yellow-50">
                    Flipkart: {stats.by_source?.flipkart || 0}
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50">
                    Website: {stats.by_source?.website || 0}
                  </Badge>
                  <Badge variant="outline" className="bg-purple-50">
                    Walk-in: {stats.by_source?.walkin || 0}
                  </Badge>
                  <Badge variant="outline" className="bg-slate-50">
                    Direct: {stats.by_source?.direct || 0}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs and Filters */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="all" data-testid="all-tab">
                <Package className="w-4 h-4 mr-2" />
                All Orders
              </TabsTrigger>
              <TabsTrigger value="new_order" data-testid="new-order-tab">
                <ShoppingCart className="w-4 h-4 mr-2" />
                New Orders
              </TabsTrigger>
              <TabsTrigger value="repair" data-testid="repair-tab">
                <Wrench className="w-4 h-4 mr-2" />
                Repairs
              </TabsTrigger>
              <TabsTrigger value="walkin" data-testid="walkin-tab">
                <Store className="w-4 h-4 mr-2" />
                Walk-in
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-wrap gap-2">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search order, customer, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-56"
                  data-testid="search-input"
                />
              </form>
              <Select value={firmFilter} onValueChange={setFirmFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Firms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Firms</SelectItem>
                  {firms.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="amazon">Amazon</SelectItem>
                  <SelectItem value="flipkart">Flipkart</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="walkin">Walk-in</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Payments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No orders found</p>
                  <p className="text-sm mt-1">Orders are created when dispatches are made</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Dispatch #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Marketplace ID</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Firm</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                          <TableCell className="font-mono text-sm font-medium">
                            {order.order_number}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-slate-600">
                            {order.dispatch_number}
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(order.created_at)}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{order.customer_name}</p>
                              <p className="text-xs text-slate-500">{order.phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getSourceBadge(order.order_source)}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-600 max-w-[120px] truncate">
                            {order.marketplace_order_id || '-'}
                          </TableCell>
                          <TableCell className="text-sm">{order.sku || order.master_sku_name || '-'}</TableCell>
                          <TableCell className="text-sm text-slate-600">{order.firm_name || '-'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(order.total_amount)}
                          </TableCell>
                          <TableCell>
                            {getPaymentStatusBadge(order.payment_status, order.marketplace_payment_status)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              order.dispatch_status === 'dispatched' ? 'bg-green-50 text-green-700' :
                              order.dispatch_status === 'ready_for_dispatch' ? 'bg-blue-50 text-blue-700' :
                              'bg-slate-50 text-slate-600'
                            }>
                              {order.dispatch_status?.replace('_', ' ') || 'pending'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

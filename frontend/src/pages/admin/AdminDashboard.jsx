import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ComplianceAlertBanner from '@/components/compliance/ComplianceAlertBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Users, Ticket, Shield, Package, ArrowRight, 
  Loader2, AlertTriangle, Clock, CheckCircle, Phone,
  Wrench, TrendingUp, BarChart3, Scan, Calendar, Boxes, ArrowUpCircle,
  RefreshCw, Zap, ExternalLink, Factory, DollarSign, IndianRupee
} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, subtitle, color = "blue", trend }) => (
  <Card className="bg-slate-800 border-slate-700">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 bg-${color}-600/20 rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 text-${color}-400`} />
        </div>
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
          <TrendingUp className="w-3 h-3" />
          <span>{trend}</span>
        </div>
      )}
    </CardContent>
  </Card>
);

const QuickAccessCard = ({ title, description, icon: Icon, to, color, badge }) => (
  <Link to={to}>
    <Card className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-all cursor-pointer h-full">
      <CardContent className="p-5">
        <div className={`w-10 h-10 bg-${color}-600/20 rounded-lg flex items-center justify-center mb-3`}>
          <Icon className={`w-5 h-5 text-${color}-400`} />
        </div>
        <h3 className="text-white font-semibold mb-1">{title}</h3>
        <p className="text-slate-400 text-sm mb-3">{description}</p>
        {badge && (
          <span className={`inline-block px-2 py-1 text-xs rounded-full bg-${color}-600/20 text-${color}-400`}>
            {badge}
          </span>
        )}
        <div className={`flex items-center text-${color}-400 text-sm font-medium mt-2`}>
          View <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      </CardContent>
    </Card>
  </Link>
);

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  
  // Production & Inventory states
  const [activeAdminTab, setActiveAdminTab] = useState('overview');
  const [productionRequests, setProductionRequests] = useState([]);
  const [supervisorPayables, setSupervisorPayables] = useState({ payables: [], summary: {} });
  const [inventoryStock, setInventoryStock] = useState({ raw_materials: [], master_skus: [], summary: {} });
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_reference: '', notes: '' });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchSyncStatus();
  }, [token]);
  
  useEffect(() => {
    if (activeAdminTab === 'production') {
      fetchProductionData();
    } else if (activeAdminTab === 'inventory') {
      fetchInventoryData();
    } else if (activeAdminTab === 'payables') {
      fetchPayablesData();
    }
  }, [activeAdminTab, token]);

  const fetchProductionData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/production-requests`, { headers });
      setProductionRequests(res.data || []);
    } catch (error) {
      console.error('Failed to fetch production data:', error);
    }
  };

  const fetchPayablesData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/supervisor-payables`, { headers });
      setSupervisorPayables(res.data || { payables: [], summary: {} });
    } catch (error) {
      console.error('Failed to fetch payables:', error);
    }
  };

  const fetchInventoryData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/inventory/stock`, { headers });
      setInventoryStock(res.data || { raw_materials: [], master_skus: [], summary: {} });
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    if (!paymentForm.payment_date) {
      toast.error('Please select a payment date');
      return;
    }
    
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API}/supervisor-payables/${selectedPayable.id}/payment`, {
        amount: parseFloat(paymentForm.amount),
        payment_date: paymentForm.payment_date,
        payment_reference: paymentForm.payment_reference || undefined,
        notes: paymentForm.notes || undefined
      }, { headers });
      
      toast.success('Payment recorded successfully');
      setPaymentDialogOpen(false);
      setPaymentForm({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_reference: '', notes: '' });
      fetchPayablesData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const response = await axios.get(`${API}/voltdoctor/sync/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSyncStatus(response.data);
    } catch (error) {
      console.log('VoltDoctor sync status not available');
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await axios.post(`${API}/voltdoctor/sync/trigger`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('VoltDoctor sync triggered!');
      // Wait and refresh status
      setTimeout(() => {
        fetchSyncStatus();
        fetchStats();
        setSyncing(false);
      }, 5000);
    } catch (error) {
      toast.error('Failed to trigger sync');
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Admin Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Admin Dashboard">
      {/* Stats Grid - 6 Cards like the original */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6" data-testid="admin-stats">
        <StatCard 
          title="Total tickets (lifetime)" 
          value={stats?.total_tickets || 0} 
          icon={Ticket}
          subtitle="All complaints ever logged"
          color="blue"
        />
        <StatCard 
          title="Open tickets" 
          value={stats?.open_tickets || 0} 
          icon={Clock}
          subtitle="Anything not Closed/Cancelled"
          color="yellow"
        />
        <StatCard 
          title="Today's new tickets" 
          value={stats?.today_tickets || 0} 
          icon={Calendar}
          subtitle={`Created today (${new Date().toLocaleDateString()})`}
          color="green"
        />
        <StatCard 
          title="Hardware service" 
          value={stats?.hardware_tickets || 0} 
          icon={Wrench}
          subtitle="Tickets marked as hardware support"
          color="purple"
        />
        <StatCard 
          title="Phone support" 
          value={stats?.phone_tickets || 0} 
          icon={Phone}
          subtitle="Tickets handled via phone only"
          color="cyan"
        />
        <StatCard 
          title="SLA breaches" 
          value={stats?.sla_breaches || 0} 
          icon={AlertTriangle}
          subtitle="Beyond SLA but still not closed"
          color="red"
        />
      </div>

      {/* Admin Tabs - Overview, Production, Inventory, Payables */}
      <Tabs value={activeAdminTab} onValueChange={setActiveAdminTab} className="mb-6">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="production" className="data-[state=active]:bg-emerald-600">
            <Factory className="w-4 h-4 mr-2" />
            Production
          </TabsTrigger>
          <TabsTrigger value="inventory" className="data-[state=active]:bg-cyan-600">
            <Boxes className="w-4 h-4 mr-2" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="payables" className="data-[state=active]:bg-orange-600">
            <IndianRupee className="w-4 h-4 mr-2" />
            Supervisor Payables
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
      {/* Compliance Alert Banner */}
      <ComplianceAlertBanner />
      
      {/* Tickets & Monitoring Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Tickets & Monitoring</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickAccessCard
            title="All Tickets (Lifetime)"
            description="View and search every ticket ever created. No extra login - uses current admin session."
            icon={Ticket}
            to="/admin/tickets"
            color="blue"
            badge="Historical Log"
          />
          <QuickAccessCard
            title="Agent Performance"
            description="SLA, closures and per-user performance across the whole workflow."
            icon={BarChart3}
            to="/admin/analytics"
            color="green"
            badge="Analytics"
          />
          <QuickAccessCard
            title="Gate Logs (In & Out)"
            description="Track parcels entering and leaving the factory, including non-repair inward claimables."
            icon={Scan}
            to="/admin/gate-logs"
            color="orange"
            badge="Gate Activity"
          />
          <QuickAccessCard
            title="Warranty Approvals"
            description="Review warranty registrations submitted by customers. Approve or reject and set warranty end date."
            icon={Shield}
            to="/admin/warranties"
            color="purple"
            badge="CRM"
          />
        </div>
      </div>

      {/* Internal Dashboards Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Internal Dashboards (Single Sign-On as Admin)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickAccessCard
            title="Supervisor Dashboard"
            description="Escalated tickets requiring supervisor decision. Handle complex cases and customer escalations."
            icon={ArrowUpCircle}
            to="/supervisor"
            color="red"
            badge="Escalations"
          />
          <QuickAccessCard
            title="Agent Dashboard"
            description="First-line team logging tickets and routing to phone or hardware support."
            icon={Users}
            to="/support"
            color="blue"
            badge="Frontline"
          />
          <QuickAccessCard
            title="Call Support Dashboard"
            description="Phone-based resolution queue; agents can mark resolved or escalate to hardware."
            icon={Phone}
            to="/support/tickets"
            color="cyan"
            badge="Phone Support"
          />
          <QuickAccessCard
            title="Technician Dashboard"
            description="Hardware repairs, test results and 72-hour SLA management."
            icon={Wrench}
            to="/technician"
            color="yellow"
            badge="Workshop"
          />
          <QuickAccessCard
            title="Accountant Dashboard"
            description="Pickup labels, return labels and outbound direct orders for marketplaces."
            icon={Package}
            to="/accountant"
            color="purple"
            badge="Labels & Finance"
          />
          <QuickAccessCard
            title="Dispatcher Dashboard"
            description="Print labels, prepare physical dispatch and coordinate with gate scans."
            icon={Package}
            to="/dispatcher"
            color="orange"
            badge="Dispatch Queue"
          />
          <QuickAccessCard
            title="Gate Dashboard"
            description="Inward & outward scans with barcode support; feeds technician and logs."
            icon={Scan}
            to="/gate"
            color="green"
            badge="Gate Control"
          />
          <QuickAccessCard
            title="SKU / Inventory"
            description="Manage product SKUs, stock levels and low-stock alerts."
            icon={Boxes}
            to="/admin/skus"
            color="teal"
            badge="Inventory"
          />
        </div>
      </div>

      {/* Customer-Facing Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Customer-Facing</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickAccessCard
            title="Customer CRM"
            description="View all customers, their tickets, warranties and complete history."
            icon={Users}
            to="/admin/customers"
            color="blue"
            badge="CRM"
          />
          <QuickAccessCard
            title="Create Request Form"
            description="Customer-facing ticket creation form with product and issue details."
            icon={Ticket}
            to="/customer/tickets/new"
            color="green"
            badge="Public Form"
          />
          <QuickAccessCard
            title="User Management"
            description="Create and manage internal staff accounts and roles."
            icon={Users}
            to="/admin/users"
            color="purple"
            badge="Staff"
          />
        </div>
      </div>

      {/* Alerts Section */}
      {(stats?.sla_breaches > 0 || stats?.pending_warranties > 0 || stats?.pending_extensions > 0) && (
        <Card className="bg-red-900/20 border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-400 flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.sla_breaches > 0 && (
                <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-red-400" />
                    <span className="text-white">{stats.sla_breaches} tickets have breached SLA</span>
                  </div>
                  <Link to="/admin/tickets?sla_breached=true">
                    <Button size="sm" variant="outline" className="border-red-600 text-red-400 hover:bg-red-600/20">
                      View Now
                    </Button>
                  </Link>
                </div>
              )}
              {stats?.pending_warranties > 0 && (
                <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-yellow-400" />
                    <span className="text-white">{stats.pending_warranties} warranty registrations awaiting approval</span>
                  </div>
                  <Link to="/admin/warranties?status=pending">
                    <Button size="sm" variant="outline" className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/20">
                      Review Now
                    </Button>
                  </Link>
                </div>
              )}
              {stats?.pending_extensions > 0 && (
                <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-orange-400" />
                    <span className="text-white">{stats.pending_extensions} warranty extension requests awaiting review</span>
                  </div>
                  <Link to="/admin/warranties">
                    <Button size="sm" variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
                      Review Now
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* VoltDoctor Integration Section */}
      <Card className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-700/50 mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-purple-300 flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5" />
            VoltDoctor App Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Sync Status */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Sync Status</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  syncStatus?.sync_running 
                    ? 'bg-yellow-600/20 text-yellow-400' 
                    : 'bg-green-600/20 text-green-400'
                }`}>
                  {syncStatus?.sync_running ? 'Running' : 'Idle'}
                </span>
              </div>
              <p className="text-white text-lg font-semibold">
                Every {syncStatus?.sync_interval_minutes || 5} minutes
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Auto-syncs warranties & tickets from VoltDoctor app
              </p>
            </div>

            {/* Last Sync Results */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <span className="text-slate-400 text-sm">Last Sync</span>
              <div className="mt-2 space-y-1">
                <p className="text-white text-sm">
                  <span className="text-purple-400">{syncStatus?.last_sync?.warranties_synced || 0}</span> warranties synced
                </p>
                <p className="text-white text-sm">
                  <span className="text-blue-400">{syncStatus?.last_sync?.tickets_synced || 0}</span> tickets synced
                </p>
                <p className="text-white text-sm">
                  <span className="text-green-400">{syncStatus?.last_sync?.statuses_updated || 0}</span> statuses updated
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <span className="text-slate-400 text-sm">Quick Actions</span>
              <div className="mt-2 space-y-2">
                <Button 
                  size="sm" 
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  onClick={triggerSync}
                  disabled={syncing || syncStatus?.sync_running}
                >
                  {syncing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
                <a 
                  href="https://admin-voltdoctor.preview.emergentagent.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="outline" className="w-full border-purple-600 text-purple-300 hover:bg-purple-600/20">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open VoltDoctor Admin
                  </Button>
                </a>
              </div>
            </div>
          </div>

          {/* Sync Errors */}
          {syncStatus?.last_sync?.errors?.length > 0 && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 mt-2">
              <p className="text-red-400 text-sm font-medium mb-1">Sync Errors:</p>
              {syncStatus.last_sync.errors.slice(0, 3).map((err, i) => (
                <p key={i} className="text-red-300 text-xs">{err}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* Production Tab */}
        <TabsContent value="production">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Factory className="w-5 h-5 text-emerald-400" />
                Production Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productionRequests.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Factory className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No production requests found</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">Request #</TableHead>
                        <TableHead className="text-slate-300">Product</TableHead>
                        <TableHead className="text-slate-300">Firm</TableHead>
                        <TableHead className="text-slate-300 text-right">Qty</TableHead>
                        <TableHead className="text-slate-300">Status</TableHead>
                        <TableHead className="text-slate-300">Role</TableHead>
                        <TableHead className="text-slate-300">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionRequests.slice(0, 50).map((req) => (
                        <TableRow key={req.id} className="border-slate-700">
                          <TableCell className="text-white font-mono text-sm">{req.request_number}</TableCell>
                          <TableCell className="text-white">{req.master_sku_name}</TableCell>
                          <TableCell className="text-slate-300">{req.firm_name}</TableCell>
                          <TableCell className="text-white text-right">{req.quantity_requested}</TableCell>
                          <TableCell>
                            <Badge className={
                              req.status === 'received_into_inventory' ? 'bg-green-600' :
                              req.status === 'completed' ? 'bg-blue-600' :
                              req.status === 'in_progress' ? 'bg-yellow-600' :
                              req.status === 'accepted' ? 'bg-purple-600' :
                              'bg-slate-600'
                            }>
                              {req.status?.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300 capitalize">{req.manufacturing_role}</TableCell>
                          <TableCell className="text-slate-400 text-sm">
                            {new Date(req.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-slate-500 text-sm mt-4">Showing latest 50 of {productionRequests.length} requests</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard 
              title="Master SKUs" 
              value={inventoryStock.summary?.total_master_skus || 0} 
              icon={Package}
              color="cyan"
            />
            <StatCard 
              title="Raw Materials" 
              value={inventoryStock.summary?.total_raw_materials || 0} 
              icon={Boxes}
              color="pink"
            />
            <StatCard 
              title="Low Stock Alerts" 
              value={inventoryStock.summary?.low_stock_alerts || 0} 
              icon={AlertTriangle}
              color="yellow"
            />
            <StatCard 
              title="Negative Stock" 
              value={inventoryStock.summary?.negative_stock_alerts || 0} 
              icon={AlertTriangle}
              color="red"
            />
          </div>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-cyan-400" />
                Current Stock (Master SKUs)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">SKU</TableHead>
                      <TableHead className="text-slate-300">Name</TableHead>
                      <TableHead className="text-slate-300">Firm</TableHead>
                      <TableHead className="text-slate-300">Type</TableHead>
                      <TableHead className="text-slate-300 text-right">Stock</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(inventoryStock.master_skus || []).filter(s => s.current_stock > 0).slice(0, 30).map((item, idx) => (
                      <TableRow key={`${item.id}-${item.firm_id}-${idx}`} className="border-slate-700">
                        <TableCell className="text-white font-mono text-sm">{item.sku_code}</TableCell>
                        <TableCell className="text-white">{item.name}</TableCell>
                        <TableCell className="text-slate-300">{item.firm_name}</TableCell>
                        <TableCell>
                          <Badge className={item.product_type === 'manufactured' ? 'bg-purple-600' : 'bg-slate-600'}>
                            {item.product_type || 'traded'}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${item.is_negative ? 'text-red-400' : item.is_low_stock ? 'text-orange-400' : 'text-green-400'}`}>
                          {item.current_stock}
                        </TableCell>
                        <TableCell>
                          {item.is_negative ? (
                            <Badge className="bg-red-600">Negative</Badge>
                          ) : item.is_low_stock ? (
                            <Badge className="bg-orange-600">Low</Badge>
                          ) : (
                            <Badge className="bg-green-600">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Supervisor Payables Tab */}
        <TabsContent value="payables">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard 
              title="Total Payable" 
              value={`₹${(supervisorPayables.summary?.total_payable || 0).toLocaleString()}`} 
              icon={IndianRupee}
              color="blue"
            />
            <StatCard 
              title="Total Paid" 
              value={`₹${(supervisorPayables.summary?.total_paid || 0).toLocaleString()}`} 
              icon={CheckCircle}
              color="green"
            />
            <StatCard 
              title="Pending Balance" 
              value={`₹${(supervisorPayables.summary?.total_pending || 0).toLocaleString()}`} 
              icon={Clock}
              color="orange"
            />
            <StatCard 
              title="Total Records" 
              value={supervisorPayables.summary?.count || 0} 
              icon={Factory}
              color="cyan"
            />
          </div>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-orange-400" />
                Supervisor Manufacturing Payables
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(supervisorPayables.payables || []).length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <IndianRupee className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No supervisor payables found</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">Request #</TableHead>
                        <TableHead className="text-slate-300">Product</TableHead>
                        <TableHead className="text-slate-300 text-right">Qty</TableHead>
                        <TableHead className="text-slate-300 text-right">Rate</TableHead>
                        <TableHead className="text-slate-300 text-right">Total</TableHead>
                        <TableHead className="text-slate-300 text-right">Paid</TableHead>
                        <TableHead className="text-slate-300 text-right">Balance</TableHead>
                        <TableHead className="text-slate-300">Status</TableHead>
                        <TableHead className="text-slate-300">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(supervisorPayables.payables || []).filter(p => p.payment_status !== 'paid').slice(0, 50).map((payable) => (
                        <TableRow key={payable.id} className="border-slate-700">
                          <TableCell className="text-white font-mono text-sm">{payable.production_request_number}</TableCell>
                          <TableCell className="text-white">{payable.master_sku_name}</TableCell>
                          <TableCell className="text-white text-right">{payable.quantity}</TableCell>
                          <TableCell className="text-slate-300 text-right">₹{payable.rate_per_unit?.toLocaleString()}</TableCell>
                          <TableCell className="text-blue-400 text-right font-medium">₹{payable.total_payable?.toLocaleString()}</TableCell>
                          <TableCell className="text-green-400 text-right">₹{(payable.amount_paid || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-orange-400 text-right font-medium">
                            ₹{((payable.total_payable || 0) - (payable.amount_paid || 0)).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              payable.payment_status === 'paid' ? 'bg-green-600' :
                              payable.payment_status === 'part_paid' ? 'bg-yellow-600' :
                              'bg-red-600'
                            }>
                              {payable.payment_status?.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {payable.payment_status !== 'paid' && (
                              <Button
                                size="sm"
                                className="bg-orange-600 hover:bg-orange-700"
                                onClick={() => {
                                  setSelectedPayable(payable);
                                  setPaymentForm({
                                    amount: '',
                                    payment_date: new Date().toISOString().split('T')[0],
                                    payment_reference: '',
                                    notes: ''
                                  });
                                  setPaymentDialogOpen(true);
                                }}
                                data-testid={`pay-btn-${payable.id}`}
                              >
                                <IndianRupee className="w-3 h-3 mr-1" />
                                Pay
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-slate-500 text-sm mt-4">
                Showing unpaid/part-paid records. Total: {(supervisorPayables.payables || []).filter(p => p.payment_status !== 'paid').length} pending
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-orange-400" />
              Record Payment to Supervisor
            </DialogTitle>
          </DialogHeader>
          {selectedPayable && (
            <div className="space-y-4">
              <div className="bg-slate-700/50 p-3 rounded-lg">
                <p className="text-slate-400 text-sm">Request: <span className="text-white font-mono">{selectedPayable.production_request_number}</span></p>
                <p className="text-slate-400 text-sm">Product: <span className="text-white">{selectedPayable.master_sku_name}</span></p>
                <p className="text-slate-400 text-sm">
                  Balance Due: <span className="text-orange-400 font-bold">
                    ₹{((selectedPayable.total_payable || 0) - (selectedPayable.amount_paid || 0)).toLocaleString()}
                  </span>
                </p>
              </div>
              
              <div>
                <Label className="text-slate-300">Payment Amount (₹) *</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                  placeholder="Enter amount"
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  max={(selectedPayable.total_payable || 0) - (selectedPayable.amount_paid || 0)}
                  data-testid="payment-amount-input"
                />
              </div>
              
              <div>
                <Label className="text-slate-300">Payment Date *</Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  data-testid="payment-date-input"
                />
              </div>
              
              <div>
                <Label className="text-slate-300">Payment Reference</Label>
                <Input
                  value={paymentForm.payment_reference}
                  onChange={(e) => setPaymentForm({...paymentForm, payment_reference: e.target.value})}
                  placeholder="e.g., Bank Transfer #12345"
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  data-testid="payment-ref-input"
                />
              </div>
              
              <div>
                <Label className="text-slate-300">Notes</Label>
                <Input
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                  placeholder="Optional notes"
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setPaymentDialogOpen(false)} className="text-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={handleRecordPayment} 
              disabled={actionLoading}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="confirm-payment-btn"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

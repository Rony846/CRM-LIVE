import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Users, Ticket, Shield, Package, ArrowRight, 
  Loader2, AlertTriangle, Clock, CheckCircle, Phone,
  Wrench, TrendingUp, BarChart3, Scan, Calendar
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

  useEffect(() => {
    fetchStats();
  }, [token]);

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
      {(stats?.sla_breaches > 0 || stats?.pending_warranties > 0) && (
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
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}

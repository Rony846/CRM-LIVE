import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Users, Ticket, Shield, Package, ArrowRight, 
  Loader2, AlertTriangle, Clock, CheckCircle 
} from 'lucide-react';

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
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Admin Dashboard">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white mb-6">
        <h2 className="text-2xl font-bold font-['Barlow_Condensed'] mb-2">
          Welcome, {user?.first_name}!
        </h2>
        <p className="text-slate-300">
          Manage your CRM system, customers, warranties, and team from here.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8" data-testid="admin-stats">
        <StatCard 
          title="Total Customers" 
          value={stats?.total_customers || 0} 
          icon={Users} 
        />
        <StatCard 
          title="Total Tickets" 
          value={stats?.total_tickets || 0} 
          icon={Ticket} 
        />
        <StatCard 
          title="Open Tickets" 
          value={stats?.open_tickets || 0} 
          icon={Clock} 
        />
        <StatCard 
          title="Pending Warranties" 
          value={stats?.pending_warranties || 0} 
          icon={Shield} 
        />
        <StatCard 
          title="Pending Dispatches" 
          value={stats?.pending_dispatches || 0} 
          icon={Package} 
        />
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link to="/admin/customers">
          <Card className="card-hover cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold font-['Barlow_Condensed'] mb-1">Customer CRM</h3>
              <p className="text-sm text-slate-500 mb-3">View and manage all customers</p>
              <div className="flex items-center text-blue-600 text-sm font-medium">
                View Customers <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/warranties">
          <Card className="card-hover cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold font-['Barlow_Condensed'] mb-1">Warranty Approvals</h3>
              <p className="text-sm text-slate-500 mb-3">
                {stats?.pending_warranties > 0 ? (
                  <span className="text-orange-600 font-medium">{stats.pending_warranties} pending approval</span>
                ) : (
                  'All warranties reviewed'
                )}
              </p>
              <div className="flex items-center text-green-600 text-sm font-medium">
                Manage Warranties <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/users">
          <Card className="card-hover cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold font-['Barlow_Condensed'] mb-1">User Management</h3>
              <p className="text-sm text-slate-500 mb-3">Manage staff accounts and roles</p>
              <div className="flex items-center text-purple-600 text-sm font-medium">
                Manage Users <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/tickets">
          <Card className="card-hover cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Ticket className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold font-['Barlow_Condensed'] mb-1">All Tickets</h3>
              <p className="text-sm text-slate-500 mb-3">
                {stats?.open_tickets > 0 ? (
                  <span className="text-orange-600 font-medium">{stats.open_tickets} open tickets</span>
                ) : (
                  'View ticket history'
                )}
              </p>
              <div className="flex items-center text-orange-600 text-sm font-medium">
                View Tickets <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Alerts Section */}
      {(stats?.pending_warranties > 0 || stats?.open_tickets > 5) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="font-['Barlow_Condensed'] flex items-center gap-2 text-orange-700">
              <AlertTriangle className="w-5 h-5" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.pending_warranties > 0 && (
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-orange-600" />
                    <span>{stats.pending_warranties} warranty registrations awaiting approval</span>
                  </div>
                  <Link to="/admin/warranties">
                    <Button size="sm" variant="outline" className="border-orange-300 text-orange-700">
                      Review Now
                    </Button>
                  </Link>
                </div>
              )}
              {stats?.open_tickets > 5 && (
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                  <div className="flex items-center gap-3">
                    <Ticket className="w-5 h-5 text-orange-600" />
                    <span>{stats.open_tickets} open tickets need attention</span>
                  </div>
                  <Link to="/admin/tickets">
                    <Button size="sm" variant="outline" className="border-orange-300 text-orange-700">
                      View Tickets
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-['Barlow_Condensed']">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/dispatcher/tv">
              <Button variant="outline" className="w-full justify-start">
                <Package className="w-4 h-4 mr-2" />
                Dispatcher TV
              </Button>
            </Link>
            <Link to="/admin/users">
              <Button variant="outline" className="w-full justify-start">
                <Users className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </Link>
            <Link to="/admin/warranties">
              <Button variant="outline" className="w-full justify-start">
                <Shield className="w-4 h-4 mr-2" />
                Review Warranty
              </Button>
            </Link>
            <Link to="/admin/customers">
              <Button variant="outline" className="w-full justify-start">
                <Users className="w-4 h-4 mr-2" />
                Search Customer
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

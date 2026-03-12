import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Ticket, Shield, Clock, CheckCircle, Plus, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerDashboard() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        
        const [statsRes, ticketsRes, warrantiesRes] = await Promise.all([
          axios.get(`${API}/stats`, { headers }),
          axios.get(`${API}/tickets`, { headers }),
          axios.get(`${API}/warranties`, { headers })
        ]);

        setStats(statsRes.data);
        setRecentTickets(ticketsRes.data.slice(0, 5));
        setWarranties(warrantiesRes.data);
      } catch (error) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 skeleton rounded-lg" />
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white mb-6">
        <h2 className="text-2xl font-bold font-['Barlow_Condensed'] mb-2">
          Welcome back, {user?.first_name}!
        </h2>
        <p className="text-blue-100">
          Manage your warranties and support tickets from your personal dashboard.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" data-testid="customer-stats">
        <StatCard
          title="Total Tickets"
          value={stats?.my_tickets || 0}
          icon={Ticket}
        />
        <StatCard
          title="Open Tickets"
          value={stats?.open_tickets || 0}
          icon={Clock}
        />
        <StatCard
          title="Registered Warranties"
          value={stats?.my_warranties || 0}
          icon={Shield}
        />
        <StatCard
          title="Approved Warranties"
          value={stats?.approved_warranties || 0}
          icon={CheckCircle}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold font-['Barlow_Condensed'] mb-1">Need Help?</h3>
                <p className="text-sm text-slate-500">Create a support ticket for your product</p>
              </div>
              <Link to="/customer/tickets/new">
                <Button className="bg-blue-600 hover:bg-blue-700" data-testid="create-ticket-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Ticket
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold font-['Barlow_Condensed'] mb-1">New Product?</h3>
                <p className="text-sm text-slate-500">Register your warranty for protection</p>
              </div>
              <Link to="/customer/warranty/register">
                <Button className="bg-blue-600 hover:bg-blue-700" data-testid="register-warranty-btn">
                  <Shield className="w-4 h-4 mr-2" />
                  Register Warranty
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tickets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-['Barlow_Condensed']">Recent Tickets</CardTitle>
            <Link to="/customer/tickets" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentTickets.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Ticket className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No tickets yet</p>
                <Link to="/customer/tickets/new" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
                  Create your first ticket
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm font-mono">{ticket.ticket_number}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{ticket.device_type}</p>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Warranties */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-['Barlow_Condensed']">My Warranties</CardTitle>
            <Link to="/customer/warranties" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {warranties.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Shield className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No warranties registered</p>
                <Link to="/customer/warranty/register" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
                  Register a warranty
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {warranties.slice(0, 5).map((warranty) => (
                  <div key={warranty.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{warranty.device_type}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {warranty.status === 'approved' && warranty.warranty_end_date
                          ? `Expires: ${new Date(warranty.warranty_end_date).toLocaleDateString()}`
                          : `Order: ${warranty.order_id}`
                        }
                      </p>
                    </div>
                    <StatusBadge status={warranty.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

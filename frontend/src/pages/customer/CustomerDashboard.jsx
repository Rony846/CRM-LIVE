import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ticket, Shield, Clock, CheckCircle, Plus, ArrowRight, CalendarDays, FileText, Eye, IndianRupee, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const PI_STATUS_TONES = {
  draft:     'bg-muted text-muted-foreground ring-border',
  sent:      'bg-sky-400/15 text-sky-400 ring-sky-400/25',
  viewed:    'bg-violet-400/15 text-violet-400 ring-violet-400/25',
  approved:  'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
  rejected:  'bg-rose-500/15 text-rose-400 ring-rose-500/25',
  converted: 'bg-primary/15 text-primary ring-primary/25',
  expired:   'bg-orange-400/15 text-orange-400 ring-orange-400/25',
  cancelled: 'bg-muted text-muted-foreground ring-border',
};

const PI_STATUS_LABELS = {
  draft: 'Draft', sent: 'Pending Review', viewed: 'Awaiting Response',
  approved: 'Approved', rejected: 'Rejected', converted: 'Order Placed',
  expired: 'Expired', cancelled: 'Cancelled',
};

const badgeCls = 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap';

export default function CustomerDashboard() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [statsRes, ticketsRes, warrantiesRes, quotationsRes] = await Promise.all([
          axios.get(`${API}/stats`, { headers }),
          axios.get(`${API}/tickets`, { headers }),
          axios.get(`${API}/warranties`, { headers }),
          axios.get(`${API}/customer/quotations`, { headers }).catch(() => ({ data: [] }))
        ]);

        setStats(statsRes.data);
        setRecentTickets(ticketsRes.data.slice(0, 5));
        setWarranties(warrantiesRes.data);
        setQuotations(quotationsRes.data || []);
      } catch (error) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Count quotations needing action
  const pendingQuotations = quotations.filter(q => ['sent', 'viewed'].includes(q.status)).length;

  if (loading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-secondary/40 rounded-lg animate-pulse" />
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard">

      {/* Page header — pulsing live-dot style */}
      <div className="mb-6">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Customer Portal · Live
          </span>
        </div>
        <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
          Welcome back, {user?.first_name}!
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your warranties and support tickets from your personal dashboard.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-8" data-testid="customer-stats">
        <StatCard
          title="Total Tickets"
          value={stats?.my_tickets || 0}
          icon={Ticket}
          tone="indigo"
        />
        <StatCard
          title="Open Tickets"
          value={stats?.open_tickets || 0}
          icon={Clock}
          tone="amber"
        />
        <StatCard
          title="Warranties"
          value={stats?.my_warranties || 0}
          icon={Shield}
          tone="sky"
        />
        <StatCard
          title="Approved"
          value={stats?.approved_warranties || 0}
          icon={CheckCircle}
          tone="emerald"
        />
        <StatCard
          title="Quotations"
          value={quotations.length}
          icon={FileText}
          tone={pendingQuotations > 0 ? 'amber' : 'indigo'}
          trendValue={pendingQuotations > 0 ? `${pendingQuotations} need response` : null}
          trend={pendingQuotations > 0 ? 'down' : undefined}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {/* Need Help */}
        <div className="mg-card rounded-lg border border-border bg-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">Support</p>
            <h3 className="text-sm font-semibold text-foreground mb-0.5">Need Help?</h3>
            <p className="text-xs text-muted-foreground">Create a support ticket for your product</p>
          </div>
          <Link to="/customer/tickets/new" className="flex-shrink-0">
            <Button size="sm" className="bg-primary text-primary-foreground hover:opacity-90" data-testid="create-ticket-btn">
              <Plus className="w-4 h-4 mr-1" />
              Create Ticket
            </Button>
          </Link>
        </div>

        {/* Register Warranty */}
        <div className="mg-card rounded-lg border border-border bg-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">Warranty</p>
            <h3 className="text-sm font-semibold text-foreground mb-0.5">New Product?</h3>
            <p className="text-xs text-muted-foreground">Register your warranty for protection</p>
          </div>
          <Link to="/customer/warranty/register" className="flex-shrink-0">
            <Button size="sm" className="bg-primary text-primary-foreground hover:opacity-90" data-testid="register-warranty-btn">
              <Shield className="w-4 h-4 mr-1" />
              Register
            </Button>
          </Link>
        </div>

        {/* Book Appointment */}
        <div className="mg-card rounded-lg border border-violet-500/25 bg-violet-500/5 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-violet-400/80 mb-1">Consultation</p>
            <h3 className="text-sm font-semibold text-foreground mb-0.5">Expert Advice?</h3>
            <p className="text-xs text-muted-foreground">Book a 30-min consultation with our supervisor</p>
          </div>
          <Link to="/customer/appointments" className="flex-shrink-0">
            <Button size="sm" className="bg-violet-500/15 text-violet-400 border border-violet-500/25 hover:bg-violet-500/25" data-testid="book-appointment-btn">
              <CalendarDays className="w-4 h-4 mr-1" />
              Book
            </Button>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Tickets */}
        <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Recent Tickets</h3>
            <Link to="/customer/tickets" className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary hover:text-primary/80 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4">
            {recentTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Ticket className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">No tickets yet</p>
                <Link to="/customer/tickets/new" className="mt-1.5 font-mono text-[11px] text-primary hover:underline">
                  Create your first ticket
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2.5 hover:bg-muted/70 transition-colors">
                    <div>
                      <p className="font-mono text-[12px] font-semibold text-foreground">{ticket.ticket_number}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{ticket.device_type}</p>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Warranties */}
        <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">My Warranties</h3>
            <Link to="/customer/warranties" className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary hover:text-primary/80 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4">
            {warranties.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Shield className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">No warranties registered</p>
                <Link to="/customer/warranty/register" className="mt-1.5 font-mono text-[11px] text-primary hover:underline">
                  Register a warranty
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {warranties.slice(0, 5).map((warranty) => (
                  <div key={warranty.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2.5 hover:bg-muted/70 transition-colors">
                    <div>
                      <p className="text-[13px] font-medium text-foreground">{warranty.device_type}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
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
          </div>
        </div>
      </div>

      {/* Quotations Section */}
      {quotations.length > 0 && (
        <div className="mg-card mt-5 rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/15">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground">My Quotations</h3>
              {pendingQuotations > 0 && (
                <span className={`${badgeCls} bg-orange-400/15 text-orange-400 ring-orange-400/25`}>
                  {pendingQuotations} need response
                </span>
              )}
            </div>
          </div>
          <div className="p-4 space-y-2">
            {quotations.slice(0, 5).map((quotation) => {
              const tone = PI_STATUS_TONES[quotation.status] || PI_STATUS_TONES.draft;
              const label = PI_STATUS_LABELS[quotation.status] || quotation.status;
              const needsAction = ['sent', 'viewed'].includes(quotation.status);

              return (
                <div
                  key={quotation.id}
                  className={`flex items-center justify-between rounded-md px-3 py-3 border transition-colors ${
                    needsAction
                      ? 'bg-orange-500/5 border-orange-500/20'
                      : 'bg-muted/30 border-border/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <p className="font-mono text-[12px] font-semibold text-foreground">{quotation.quotation_number}</p>
                      <span className={`${badgeCls} ${tone}`}>{label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 font-mono text-[11px] text-muted-foreground flex-wrap">
                      <span>{quotation.firm_name}</span>
                      <span className="flex items-center gap-0.5">
                        <IndianRupee className="w-3 h-3" />
                        {formatCurrency(quotation.grand_total)}
                      </span>
                      <span>Valid till: {formatDate(quotation.validity_date)}</span>
                    </div>
                  </div>
                  {needsAction && quotation.access_token && (
                    <Link to={`/pi/${quotation.access_token}`} className="ml-4 flex-shrink-0">
                      <Button size="sm" className="bg-primary text-primary-foreground hover:opacity-90">
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Review
                      </Button>
                    </Link>
                  )}
                  {!needsAction && quotation.access_token && (
                    <Link to={`/pi/${quotation.access_token}`} className="ml-4 flex-shrink-0">
                      <Button size="sm" variant="outline" className="border-border text-muted-foreground hover:text-foreground hover:bg-accent">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        View
                      </Button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

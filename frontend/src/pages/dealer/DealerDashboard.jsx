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
import CustomerQuickLookup from '@/components/dealer/CustomerQuickLookup';
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
    textColor: 'text-muted-foreground',
    iconTone: 'bg-muted text-muted-foreground',
    icon: Star
  },
  gold: {
    label: 'Gold',
    color: 'from-amber-400 to-amber-500',
    textColor: 'text-amber-400',
    iconTone: 'bg-amber-400/15 text-amber-400',
    icon: Award
  },
  platinum: {
    label: 'Platinum',
    color: 'from-violet-400 to-indigo-400',
    textColor: 'text-violet-400',
    iconTone: 'bg-violet-400/15 text-violet-400',
    icon: Crown
  }
};

const STAT_TONES = {
  sky:     'bg-sky-400/15 text-sky-400',
  amber:   'bg-amber-400/15 text-amber-400',
  blue:    'bg-primary/15 text-primary',
  emerald: 'bg-emerald-500/15 text-emerald-500',
};

// Obsidian status chip
const STATUS_TONES = {
  pending:   'bg-amber-400/15 text-amber-400 ring-amber-400/25',
  confirmed: 'bg-sky-400/15 text-sky-400 ring-sky-400/25',
  dispatched:'bg-primary/15 text-primary ring-primary/25',
  delivered: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
  cancelled: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',
};

const StatusChip = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap ${STATUS_TONES[status] || 'bg-muted text-muted-foreground ring-border'}`}>
    {status}
  </span>
);

// Glass KPI stat tile
const StatTile = ({ icon: Icon, label, value, tone = 'blue' }) => (
  <div className="mg-card rounded-lg border border-border bg-card p-4">
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{label}</p>
        <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">{value}</p>
      </div>
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${STAT_TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

// Quick action nav card
const NavCard = ({ to, iconBg, icon: Icon, title, subtitle, disabled }) => (
  <Link to={to} className={disabled ? 'pointer-events-none' : ''}>
    <div className={`mg-card group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded ${iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[12px] text-muted-foreground">{subtitle}</p>
      </div>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </div>
  </Link>
);

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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

        {/* Page header with live dot */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Dealer Portal · Live
              </span>
            </div>
            <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
              {dealer.firm_name || 'Dealer Dashboard'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {dealer.city || dealer.address?.city}{dealer.state || dealer.address?.state ? `, ${dealer.state || dealer.address?.state}` : ''}{dealer.phone ? ` · ${dealer.phone}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
              dealer.status === 'approved'
                ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
                : 'bg-amber-400/15 text-amber-400 ring-amber-400/25'
            }`}>
              {dealer.status === 'approved' ? <><CheckCircle className="w-3 h-3 mr-1" />Active</> : <><Clock className="w-3 h-3 mr-1" />{dealer.status}</>}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
              depositStatus === 'approved'
                ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
                : 'bg-amber-400/15 text-amber-400 ring-amber-400/25'
            }`}>
              <Shield className="w-3 h-3 mr-1" />Deposit: {depositStatus}
            </span>
          </div>
        </div>

        {/* Customer Quick Lookup — "who's calling me?" */}
        <CustomerQuickLookup />

        {/* Deposit Warning Banner */}
        {depositPending && (
          <div className="mg-card rounded-lg border border-amber-400/25 bg-amber-400/10 p-4">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-400">Security Deposit Required</h3>
                <p className="text-[13px] text-amber-400/80 mt-1">
                  {depositStatus === 'not_paid' &&
                    `Please upload your security deposit proof of ₹${(dealer.security_deposit_amount || dealer.security_deposit?.amount || 100000)?.toLocaleString()} to activate your dealer account and start placing orders.`}
                  {(depositStatus === 'pending' || depositStatus === 'pending_review') &&
                    'Your security deposit proof is under review. We will notify you once approved.'}
                  {depositStatus === 'rejected' &&
                    `Your deposit proof was rejected: ${dealer.security_deposit_remarks || dealer.security_deposit?.remarks}. Please upload again.`}
                </p>
                {(depositStatus === 'not_paid' || depositStatus === 'rejected') && (
                  <Link to="/dealer/deposit">
                    <button className="mt-3 inline-flex items-center gap-2 rounded bg-amber-400/20 border border-amber-400/30 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-400/30 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      Upload Deposit Proof
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tier Progress Card */}
        {tierData && (
          <div className="mg-card rounded-lg border border-border bg-card p-5">
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded ${tierConfig?.iconTone || 'bg-muted text-muted-foreground'}`}>
                  <TierIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current Tier</p>
                  <p className={`text-lg font-bold ${tierConfig?.textColor || 'text-foreground'}`}>{tierConfig?.label} Partner</p>
                </div>
              </div>

              <div className="flex-1 px-2">
                {tierData.next_tier ? (
                  <>
                    <div className="flex justify-between text-[12px] mb-1.5">
                      <span className="text-muted-foreground font-mono uppercase tracking-wide text-[10px]">Progress to {TIER_CONFIG[tierData.next_tier]?.label}</span>
                      <span className="font-mono font-bold text-foreground tabular-nums">{tierData.progress_to_next}%</span>
                    </div>
                    <Progress value={tierData.progress_to_next} className="h-1.5" />
                    <p className="font-mono text-[10px] text-muted-foreground mt-1.5">
                      {formatCurrency(tierData.remaining_to_next)} more to reach {TIER_CONFIG[tierData.next_tier]?.label}
                    </p>
                  </>
                ) : (
                  <div className="py-2">
                    <p className="text-sm font-semibold text-violet-400">You've reached the highest tier!</p>
                    <p className="text-[12px] text-muted-foreground">Thank you for your partnership</p>
                  </div>
                )}
              </div>

              <div className="text-right">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Lifetime Purchases</p>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums text-foreground">{formatCurrency(tierData.total_purchase_value)}</p>
              </div>
            </div>
          </div>
        )}

        {/* KPI Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile icon={ShoppingCart} label="Total Orders" value={stats.total_orders || 0} tone="sky" />
          <StatTile icon={Clock} label="Pending Orders" value={stats.pending_orders || 0} tone="amber" />
          <StatTile icon={Ticket} label="Open Tickets" value={stats.open_tickets || 0} tone="blue" />
          <StatTile icon={Wallet} label="Outstanding" value={formatCurrency(stats.outstanding_balance)} tone="emerald" />
        </div>

        {/* Monthly Performance Summary */}
        {performanceData && (
          <div className="mg-card rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="text-[15px] font-semibold text-foreground">This Month's Performance</h3>
              </div>
              <Link to="/dealer/performance">
                <button className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary hover:text-primary/80 transition-colors">
                  View Details <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
              {[
                { label: 'Orders', value: performanceData.total_orders, color: 'text-foreground' },
                { label: 'Total Value', value: formatCurrency(performanceData.total_value), color: 'text-emerald-400' },
                { label: 'Delivered', value: performanceData.orders_by_status?.delivered || 0, color: 'text-sky-400' },
                { label: 'Avg. Order', value: formatCurrency(performanceData.avg_order_value), color: 'text-primary' },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-4 text-center">
                  <p className={`font-mono text-xl font-bold tabular-nums ${color}`}>{value}</p>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions — Row 1 */}
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-3">Quick Actions</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <NavCard to="/dealer/orders/new" iconBg="bg-primary/15 text-primary" icon={ShoppingCart}
              title="Place Order" subtitle={canOrder ? 'Browse products' : 'Deposit required'} disabled={!canOrder} />
            <NavCard to="/dealer/dispatches" iconBg="bg-sky-400/15 text-sky-400" icon={Truck}
              title="Track Dispatches" subtitle="AWB & delivery status" />
            <NavCard to="/dealer/ledger" iconBg="bg-emerald-500/15 text-emerald-400" icon={IndianRupee}
              title="Ledger" subtitle="Payments & balance" />
            <NavCard to="/dealer/documents" iconBg="bg-violet-400/15 text-violet-400" icon={Download}
              title="Downloads" subtitle="Invoices & documents" />
          </div>
        </div>

        {/* Quick Actions — Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <NavCard to="/dealer/catalogue" iconBg="bg-primary/15 text-primary" icon={Package}
            title="Product Catalogue" subtitle="Browse & check stock" />
          <NavCard to="/dealer/targets" iconBg="bg-amber-400/15 text-amber-400" icon={TrendingUp}
            title="Sales Targets" subtitle="Track & earn incentives" />
          <NavCard to="/dealer/warranty" iconBg="bg-rose-500/15 text-rose-400" icon={Shield}
            title="Warranty" subtitle="Register warranties" />
          <NavCard to="/dealer/announcements" iconBg="bg-teal-400/15 text-teal-400" icon={FileText}
            title="Announcements" subtitle="Latest updates" />
        </div>

        {/* Quick Actions — Row 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <NavCard to="/dealer/orders" iconBg="bg-violet-400/15 text-violet-400" icon={Package}
            title="My Orders" subtitle="View order history" />
          <NavCard to="/dealer/reorder-suggestions" iconBg="bg-pink-400/15 text-pink-400" icon={BarChart3}
            title="Reorder Suggestions" subtitle="Smart recommendations" />
          <NavCard to="/dealer/tickets" iconBg="bg-orange-400/15 text-orange-400" icon={Ticket}
            title="Support" subtitle="Get help" />
          <NavCard to="/dealer/certificate" iconBg="bg-emerald-500/15 text-emerald-400" icon={FileCheck}
            title="Certificate" subtitle="Dealer authorization" />
        </div>

        {/* Recent Orders */}
        {data?.recent_orders?.length > 0 && (
          <div className="mg-card rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-[15px] font-semibold text-foreground">Recent Orders</h3>
              <Link to="/dealer/orders">
                <button className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary hover:text-primary/80 transition-colors">
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {data.recent_orders.map((order) => (
                <Link key={order.id} to={`/dealer/orders/${order.id}`}>
                  <div className="flex items-center justify-between px-5 py-3.5 hover:bg-accent/40 transition-colors">
                    <div>
                      <p className="font-mono text-sm font-semibold text-foreground">{order.order_number}</p>
                      <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-mono text-sm font-bold tabular-nums text-foreground">{formatCurrency(order.total_amount)}</p>
                      <StatusChip status={order.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

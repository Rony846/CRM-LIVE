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
  Wrench, TrendingUp, TrendingDown, BarChart3, Scan, Calendar, Boxes, ArrowUpCircle,
  RefreshCw, Zap, ExternalLink, Factory, DollarSign, IndianRupee, Headphones, Boxes as BoxesIcon
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RTooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useChartPalette } from '@/lib/themePalette';

// Indian-format money: Cr / L / plain
const fmtINR = (n) => {
  n = Number(n) || 0;
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(2)} L`;
  return `${sign}₹${a.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const STAT_TONES = {
  blue:    'bg-primary/15 text-primary',
  yellow:  'bg-amber-400/15 text-amber-400',
  green:   'bg-emerald-500/15 text-emerald-500',
  emerald: 'bg-emerald-500/15 text-emerald-500',
  purple:  'bg-violet-400/15 text-violet-400',
  cyan:    'bg-sky-400/15 text-sky-400',
  orange:  'bg-orange-400/15 text-orange-400',
  red:     'bg-rose-500/15 text-rose-400',
  teal:    'bg-teal-400/15 text-teal-400',
  pink:    'bg-pink-400/15 text-pink-400',
};

const SOFT_BADGE_TONES = {
  emerald: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
  indigo:  'bg-primary/15 text-primary ring-primary/25',
  amber:   'bg-amber-400/15 text-amber-400 ring-amber-400/25',
  violet:  'bg-violet-400/15 text-violet-400 ring-violet-400/25',
  rose:    'bg-rose-500/15 text-rose-400 ring-rose-500/25',
  sky:     'bg-sky-400/15 text-sky-400 ring-sky-400/25',
  slate:   'bg-muted text-muted-foreground ring-border',
};
const SoftBadge = ({ tone = 'slate', children }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap ${SOFT_BADGE_TONES[tone] || SOFT_BADGE_TONES.slate}`}>
    {children}
  </span>
);

const StatCard = ({ title, value, icon: Icon, subtitle, color = "blue", trend }) => (
  <div className="mg-card rounded-lg border border-border bg-card p-4">
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{title}</p>
        <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">{value}</p>
        {subtitle && <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${STAT_TONES[color] || STAT_TONES.blue}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
    {trend && (
      <div className="mt-2 flex items-center gap-1 text-xs text-emerald-500">
        <TrendingUp className="h-3 w-3" />
        <span>{trend}</span>
      </div>
    )}
  </div>
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

// ===================== Executive Overview =====================
const fmtCount = (n) => (Number(n) || 0).toLocaleString('en-IN');

// Compact axis formatter — 12k / 3.4L / 1.2Cr
const fmtK = (v) => {
  v = Number(v) || 0;
  if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}k`;
  return `${v}`;
};

const RevTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border border-border rounded-md shadow-soft-md px-2.5 py-1.5 text-xs">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground tabular-nums">{fmtINR(payload[0].value)}</p>
    </div>
  );
};

// KPI card — Obsidian "hero metric": label-caps header, big mono value, trend.
const KpiCard = ({ label, value, delta, deltaTone = 'neutral', sub, icon: Icon }) => {
  const accent = {
    up: 'text-emerald-500',
    down: 'text-rose-400',
    warn: 'text-amber-400',
    neutral: 'text-primary',
  }[deltaTone];
  return (
    <div className="mg-card group relative overflow-hidden rounded-lg border border-border bg-card p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/[0.07] blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex items-start justify-between">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        {Icon && <Icon className={cn('h-[18px] w-[18px]', accent)} />}
      </div>
      <div className="relative mt-4 font-mono text-[32px] font-bold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      <div className="relative mt-3 flex items-center gap-2">
        {delta != null && delta !== '' && (
          <span className={cn('font-mono text-[11px] font-bold', accent)}>{delta}</span>
        )}
        {sub && (
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground/70">{sub}</span>
        )}
      </div>
    </div>
  );
};

// One row in the Tactical Alerts feed.
const AttentionRow = ({ icon: Icon, tone, code, codeColor, title, meta, to, count }) => (
  <Link to={to} className="group -mx-3 flex gap-3 rounded-md p-3 transition-colors hover:bg-accent/60">
    <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full', tone)}>
      <Icon className="h-[18px] w-[18px]" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        {count != null && <span className="font-mono text-sm font-bold tabular-nums text-foreground">{count}</span>}
      </div>
      <p className="truncate text-[12px] text-muted-foreground">{meta}</p>
      {code && <p className={cn('mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.06em]', codeColor)}>{code}</p>}
    </div>
    <ArrowRight className="w-4 h-4 self-center text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
  </Link>
);

function ExecutiveOverview({ data, onRefresh }) {
  const palette = useChartPalette();
  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-72 bg-secondary/50 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 bg-secondary/40 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-8 h-80 bg-secondary/40 rounded-xl animate-pulse" />
          <div className="col-span-12 lg:col-span-4 h-80 bg-secondary/40 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const rev = data.revenue || {};
  const sup = data.support || {};
  const sal = data.sales || {};
  const stk = data.stock || {};
  const ai = data.action_items || {};

  const delta = rev.delta_pct;
  const slaPct = sup.sla_pct ?? 0;
  const lowCount = stk.low_count ?? 0;

  const trend = (rev.trend_30d || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    value: d.value || 0,
  }));

  const attention = [];
  if ((ai.sla_breaches || 0) > 0)
    attention.push({ icon: AlertTriangle, tone: 'bg-rose-500/15 text-rose-400',
      code: 'SLA_DEADLINE_EXCEEDED', codeColor: 'text-rose-400', title: 'SLA breaches',
      meta: 'Tickets past their resolution deadline', to: '/admin/tickets?sla_breached=true', count: ai.sla_breaches });
  if ((ai.pending_warranties || 0) > 0)
    attention.push({ icon: Shield, tone: 'bg-amber-400/15 text-amber-400',
      code: 'APPROVAL_REQUIRED', codeColor: 'text-amber-400', title: 'Warranty approvals',
      meta: 'Claims waiting for a decision', to: '/admin/warranties?status=pending', count: ai.pending_warranties });
  if ((ai.pending_dispatches || 0) > 0)
    attention.push({ icon: Package, tone: 'bg-sky-400/15 text-sky-400',
      code: 'AWAITING_DISPATCH', codeColor: 'text-sky-400', title: 'Pending dispatches',
      meta: 'Orders ready to leave the warehouse', to: '/dispatcher', count: ai.pending_dispatches });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Live · All firms
            </span>
          </div>
          <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">Executive Overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time performance across all firms · {data.month_label}
          </p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Last 30 days
          </span>
          <button onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent active:scale-[0.98]">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Revenue this month"
          value={fmtINR(rev.this_month)}
          delta={delta != null ? `${delta >= 0 ? '+' : ''}${delta}%` : null}
          deltaTone={delta == null ? 'neutral' : delta >= 0 ? 'up' : 'down'}
          sub={rev.last_month != null ? `vs ${fmtINR(rev.last_month)} last mo` : 'No baseline'}
          icon={TrendingUp}
        />
        <KpiCard
          label="Orders this month"
          value={fmtCount(sal.orders_month)}
          sub={`${fmtINR(sal.today_revenue)} billed today`}
          icon={Package}
        />
        <KpiCard
          label="Open tickets"
          value={fmtCount(sup.open)}
          delta={`${slaPct}% SLA`}
          deltaTone={slaPct >= 90 ? 'up' : slaPct >= 60 ? 'warn' : 'down'}
          sub="Support queue · all channels"
          icon={Headphones}
        />
        <KpiCard
          label="Active SKUs"
          value={fmtCount(stk.active_skus)}
          delta={lowCount > 0 ? `${lowCount} low` : 'In stock'}
          deltaTone={lowCount > 0 ? 'warn' : 'up'}
          sub={`${fmtCount(stk.total_units)} units in stock`}
          icon={Boxes}
        />
      </div>

      {/* Revenue chart + Tactical alerts */}
      <div className="grid grid-cols-12 gap-5">
        {/* Revenue Velocity */}
        <div className="mg-card col-span-12 rounded-lg border border-border bg-card p-6 lg:col-span-8">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h3 className="text-[17px] font-semibold tracking-tight text-foreground">Revenue Velocity</h3>
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Daily revenue · last 30 days</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xl font-bold tabular-nums text-foreground">{fmtINR(rev.this_month)}</p>
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">this month</p>
            </div>
          </div>
          {trend.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="execArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette.line} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={palette.line} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={palette.grid} strokeOpacity={palette.gridOpacity} />
                <XAxis dataKey="date" tickLine={false} axisLine={false}
                  tick={{ fontSize: 10, fill: palette.axis }} interval="preserveStartEnd" minTickGap={26} />
                <YAxis tickLine={false} axisLine={false} width={46}
                  tick={{ fontSize: 10, fill: palette.axis }} tickFormatter={fmtK} />
                <RTooltip content={<RevTooltip />} cursor={{ stroke: palette.line, strokeOpacity: 0.3, strokeWidth: 1 }} />
                <Area type="monotone" dataKey="value" stroke={palette.line} strokeWidth={2.5}
                  fill="url(#execArea)" dot={false}
                  activeDot={{ r: 4, fill: palette.line, stroke: palette.activeDotStroke, strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              No revenue data for this period
            </div>
          )}
        </div>

        {/* Tactical Alerts */}
        <div className="mg-card col-span-12 flex flex-col rounded-lg border border-border bg-card lg:col-span-4">
          <div className="border-b border-border p-6">
            <h3 className="text-[17px] font-semibold tracking-tight text-foreground">Tactical Alerts</h3>
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Items waiting on a decision</p>
          </div>
          <div className="flex-1 p-4">
            {attention.length ? (
              <div className="space-y-1">
                {attention.map((a, i) => <AttentionRow key={i} {...a} />)}
              </div>
            ) : (
              <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                  <CheckCircle className="h-6 w-6 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">All clear</p>
                <p className="mt-1 text-[12px] text-muted-foreground">No SLA breaches, approvals or dispatches pending.</p>
              </div>
            )}
          </div>
          <Link to="/admin/tickets"
            className="border-t border-border p-4 text-center font-mono text-[11px] font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-accent">
            View all tickets →
          </Link>
        </div>
      </div>
    </div>
  );
}


export default function AdminDashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [execData, setExecData] = useState(null);
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
    fetchExecutive();
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

  const fetchExecutive = async () => {
    try {
      const response = await axios.get(`${API}/admin/dashboard/executive`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExecData(response.data);
    } catch (error) {
      console.error('Failed to load executive dashboard', error);
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
      {/* Admin Tabs - Overview, Production, Inventory, Payables */}
      <Tabs value={activeAdminTab} onValueChange={setActiveAdminTab} className="mb-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="production">
            <Factory className="w-4 h-4 mr-2" />
            Production
          </TabsTrigger>
          <TabsTrigger value="inventory">
            <Boxes className="w-4 h-4 mr-2" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="payables">
            <IndianRupee className="w-4 h-4 mr-2" />
            Supervisor Payables
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <ComplianceAlertBanner />
          <div className="mt-4">
            <ExecutiveOverview data={execData} onRefresh={() => { fetchStats(); fetchExecutive(); }} />
          </div>
        </TabsContent>

        {/* Production Tab */}
        <TabsContent value="production">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-emerald-500" />
                Production Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productionRequests.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Factory className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No production requests found</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request #</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Firm</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionRequests.slice(0, 50).map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-mono text-sm text-foreground">{req.request_number}</TableCell>
                          <TableCell className="text-foreground">{req.master_sku_name}</TableCell>
                          <TableCell className="text-muted-foreground">{req.firm_name}</TableCell>
                          <TableCell className="text-foreground text-right tabular-nums">{req.quantity_requested}</TableCell>
                          <TableCell>
                            <SoftBadge tone={
                              req.status === 'received_into_inventory' ? 'emerald' :
                              req.status === 'completed' ? 'indigo' :
                              req.status === 'in_progress' ? 'amber' :
                              req.status === 'accepted' ? 'violet' : 'slate'
                            }>
                              {req.status?.replace(/_/g, ' ')}
                            </SoftBadge>
                          </TableCell>
                          <TableCell className="text-muted-foreground capitalize">{req.manufacturing_role}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(req.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-muted-foreground text-xs mt-3">Showing latest 50 of {productionRequests.length} requests</p>
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
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-sky-500" />
                Current Stock (Master SKUs)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[400px] rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Firm</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(inventoryStock.master_skus || []).filter(s => s.current_stock > 0).slice(0, 30).map((item, idx) => (
                      <TableRow key={`${item.id}-${item.firm_id}-${idx}`}>
                        <TableCell className="font-mono text-sm text-foreground">{item.sku_code}</TableCell>
                        <TableCell className="text-foreground">{item.name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.firm_name}</TableCell>
                        <TableCell>
                          <SoftBadge tone={item.product_type === 'manufactured' ? 'violet' : 'slate'}>
                            {item.product_type || 'traded'}
                          </SoftBadge>
                        </TableCell>
                        <TableCell className={`text-right font-medium tabular-nums ${item.is_negative ? 'text-rose-600' : item.is_low_stock ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {item.current_stock}
                        </TableCell>
                        <TableCell>
                          {item.is_negative ? (
                            <SoftBadge tone="rose">Negative</SoftBadge>
                          ) : item.is_low_stock ? (
                            <SoftBadge tone="amber">Low</SoftBadge>
                          ) : (
                            <SoftBadge tone="emerald">OK</SoftBadge>
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
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-orange-500" />
                Supervisor Manufacturing Payables
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(supervisorPayables.payables || []).length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <IndianRupee className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No supervisor payables found</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request #</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(supervisorPayables.payables || []).filter(p => p.payment_status !== 'paid').slice(0, 50).map((payable) => (
                        <TableRow key={payable.id}>
                          <TableCell className="font-mono text-sm text-foreground">{payable.production_request_number}</TableCell>
                          <TableCell className="text-foreground">{payable.master_sku_name}</TableCell>
                          <TableCell className="text-foreground text-right tabular-nums">{payable.quantity}</TableCell>
                          <TableCell className="text-muted-foreground text-right tabular-nums">₹{payable.rate_per_unit?.toLocaleString()}</TableCell>
                          <TableCell className="text-foreground text-right font-medium tabular-nums">₹{payable.total_payable?.toLocaleString()}</TableCell>
                          <TableCell className="text-emerald-600 text-right tabular-nums">₹{(payable.amount_paid || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-amber-600 text-right font-medium tabular-nums">
                            ₹{((payable.total_payable || 0) - (payable.amount_paid || 0)).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <SoftBadge tone={
                              payable.payment_status === 'paid' ? 'emerald' :
                              payable.payment_status === 'part_paid' ? 'amber' : 'rose'
                            }>
                              {payable.payment_status?.replace('_', ' ')}
                            </SoftBadge>
                          </TableCell>
                          <TableCell>
                            {payable.payment_status !== 'paid' && (
                              <Button
                                size="sm"
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
              <p className="text-muted-foreground text-xs mt-3">
                Showing unpaid/part-paid records. Total: {(supervisorPayables.payables || []).filter(p => p.payment_status !== 'paid').length} pending
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-orange-500" />
              Record Payment to Supervisor
            </DialogTitle>
          </DialogHeader>
          {selectedPayable && (
            <div className="space-y-4">
              <div className="bg-secondary/50 border border-border p-3 rounded-lg space-y-0.5">
                <p className="text-muted-foreground text-sm">Request: <span className="text-foreground font-mono">{selectedPayable.production_request_number}</span></p>
                <p className="text-muted-foreground text-sm">Product: <span className="text-foreground">{selectedPayable.master_sku_name}</span></p>
                <p className="text-muted-foreground text-sm">
                  Balance Due: <span className="text-amber-600 font-semibold">
                    ₹{((selectedPayable.total_payable || 0) - (selectedPayable.amount_paid || 0)).toLocaleString()}
                  </span>
                </p>
              </div>

              <div>
                <Label>Payment Amount (₹) *</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                  placeholder="Enter amount"
                  className="mt-1"
                  max={(selectedPayable.total_payable || 0) - (selectedPayable.amount_paid || 0)}
                  data-testid="payment-amount-input"
                />
              </div>

              <div>
                <Label>Payment Date *</Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                  className="mt-1"
                  data-testid="payment-date-input"
                />
              </div>

              <div>
                <Label>Payment Reference</Label>
                <Input
                  value={paymentForm.payment_reference}
                  onChange={(e) => setPaymentForm({...paymentForm, payment_reference: e.target.value})}
                  placeholder="e.g., Bank Transfer #12345"
                  className="mt-1"
                  data-testid="payment-ref-input"
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Input
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                  placeholder="Optional notes"
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={actionLoading}
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

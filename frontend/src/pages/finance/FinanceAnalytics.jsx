import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3,
  ArrowUpRight, ArrowDownRight, Calendar, Building2, RefreshCw,
  FileText, Download, CreditCard, Wallet, Receipt, Calculator,
  AlertTriangle, CheckCircle, Clock, Users, Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { useChartPalette } from '@/lib/themePalette';

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const formatCompact = (amount) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
};

// Obsidian Elite palette for charts/pie
const COLORS = ['#4f46e5', '#c3c0ff', '#a4d64c', '#ffb695', '#ffb4ab', '#8a8794', '#06B6D4', '#F97316'];

// Obsidian Elite tone map
const STAT_TONES = {
  blue:    'bg-primary/15 text-primary',
  green:   'bg-emerald-500/15 text-emerald-500',
  orange:  'bg-orange-400/15 text-orange-400',
  red:     'bg-rose-500/15 text-rose-400',
  purple:  'bg-violet-400/15 text-violet-400',
  cyan:    'bg-sky-400/15 text-sky-400',
};

// Stat Card Component
const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = "blue", onClick }) => {
  const toneClass = STAT_TONES[color] || STAT_TONES.blue;
  return (
    <div
      className="mg-card rounded-lg border border-border bg-card p-5 cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onClick}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
          <p className="font-mono text-[28px] font-bold tabular-nums leading-none text-foreground">{value}</p>
          {subtitle && (
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-3 text-xs">
          {trend >= 0 ? (
            <>
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500 font-mono font-bold">+{trend}%</span>
            </>
          ) : (
            <>
              <ArrowDownRight className="w-4 h-4 text-rose-400" />
              <span className="text-rose-400 font-mono font-bold">{trend}%</span>
            </>
          )}
          <span className="text-muted-foreground ml-1">vs last period</span>
        </div>
      )}
    </div>
  );
};

export default function FinanceAnalytics() {
  const palette = useChartPalette();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('6months');

  // Data states
  const [revenueTrends, setRevenueTrends] = useState(null);
  const [expenseBreakdown, setExpenseBreakdown] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [topCustomers, setTopCustomers] = useState(null);
  const [agingReceivables, setAgingReceivables] = useState(null);
  const [agingPayables, setAgingPayables] = useState(null);
  const [trialBalance, setTrialBalance] = useState(null);
  const [gstSummary, setGstSummary] = useState(null);
  const [bankRecon, setBankRecon] = useState(null);

  const fetchAllData = async () => {
    setLoading(true);
    const token = localStorage.getItem('mg_token');
    const headers = { Authorization: `Bearer ${token}` };
    const firmParam = selectedFirm !== 'all' ? `&firm_id=${selectedFirm}` : '';

    try {
      const [
        firmsRes,
        revenueRes,
        expenseRes,
        plRes,
        cashRes,
        customersRes,
        agingRecRes,
        agingPayRes,
        trialRes,
        gstRes
      ] = await Promise.all([
        axios.get(`${API}/firms`, { headers }),
        axios.get(`${API}/finance/analytics/revenue-trends?period=${selectedPeriod}${firmParam}`, { headers }),
        axios.get(`${API}/finance/analytics/expense-breakdown?period=current_month${firmParam}`, { headers }),
        axios.get(`${API}/finance/analytics/profit-loss?period=ytd${firmParam}`, { headers }),
        axios.get(`${API}/finance/analytics/cash-flow?period=${selectedPeriod}${firmParam}`, { headers }),
        axios.get(`${API}/finance/analytics/top-customers?limit=10&period=ytd${firmParam}`, { headers }),
        axios.get(`${API}/finance/analytics/aging-report?report_type=receivables${firmParam}`, { headers }),
        axios.get(`${API}/finance/analytics/aging-report?report_type=payables${firmParam}`, { headers }),
        axios.get(`${API}/finance/analytics/trial-balance${firmParam}`, { headers }),
        axios.get(`${API}/finance/analytics/gst-summary?period=current_month${firmParam}`, { headers })
      ]);

      setFirms(firmsRes.data || []);
      setRevenueTrends(revenueRes.data);
      setExpenseBreakdown(expenseRes.data);
      setProfitLoss(plRes.data);
      setCashFlow(cashRes.data);
      setTopCustomers(customersRes.data);
      setAgingReceivables(agingRecRes.data);
      setAgingPayables(agingPayRes.data);
      setTrialBalance(trialRes.data);
      setGstSummary(gstRes.data);
    } catch (error) {
      console.error('Error fetching finance data:', error);
      toast.error('Failed to load finance analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [selectedFirm, selectedPeriod]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-card border border-border rounded-md shadow-lg px-3 py-2 text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="font-mono tabular-nums">
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6" data-testid="finance-analytics-page">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Live Analytics
              </span>
            </div>
            <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">Finance Analytics</h2>
            <p className="mt-1 text-sm text-muted-foreground">Comprehensive financial insights and reporting</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedFirm} onValueChange={setSelectedFirm}>
              <SelectTrigger className="w-[180px]" data-testid="firm-select">
                <Building2 className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Firms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Firms</SelectItem>
                {firms.map(firm => (
                  <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[140px]" data-testid="period-select">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">3 Months</SelectItem>
                <SelectItem value="6months">6 Months</SelectItem>
                <SelectItem value="12months">12 Months</SelectItem>
                <SelectItem value="ytd">Year to Date</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={fetchAllData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="aging" data-testid="tab-aging">Aging Reports</TabsTrigger>
            <TabsTrigger value="statements" data-testid="tab-statements">Statements</TabsTrigger>
            <TabsTrigger value="gst" data-testid="tab-gst">GST</TabsTrigger>
            <TabsTrigger value="reconciliation" data-testid="tab-reconciliation">Bank Recon</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Revenue"
                value={formatCompact(revenueTrends?.summary?.total_revenue || 0)}
                subtitle={`${revenueTrends?.summary?.total_orders || 0} orders`}
                icon={TrendingUp}
                trend={revenueTrends?.summary?.growth_percentage}
                color="blue"
              />
              <StatCard
                title="Gross Profit"
                value={formatCompact(profitLoss?.gross_profit || 0)}
                subtitle={`${profitLoss?.gross_margin_percentage || 0}% margin`}
                icon={DollarSign}
                color={profitLoss?.gross_profit >= 0 ? "green" : "red"}
              />
              <StatCard
                title="Net Profit"
                value={formatCompact(profitLoss?.net_profit || 0)}
                subtitle={`${profitLoss?.net_margin_percentage || 0}% margin`}
                icon={Wallet}
                color={profitLoss?.net_profit >= 0 ? "green" : "red"}
              />
              <StatCard
                title="Cash Flow"
                value={formatCompact(cashFlow?.summary?.net_cash_flow || 0)}
                subtitle="Net flow"
                icon={CreditCard}
                color={cashFlow?.summary?.net_cash_flow >= 0 ? "cyan" : "orange"}
              />
            </div>

            {/* Revenue Trend Chart */}
            <div className="mg-card rounded-lg border border-border bg-card p-6">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h3 className="text-[17px] font-semibold tracking-tight text-foreground flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Revenue Trend
                  </h3>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Period revenue velocity</p>
                </div>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrends?.data || []}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={palette.line} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={palette.line} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={palette.grid} strokeOpacity={palette.gridOpacity} />
                    <XAxis dataKey="_id" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: palette.axis }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: palette.axis }} tickFormatter={formatCompact} width={52} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: palette.line, strokeOpacity: 0.3, strokeWidth: 1 }} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={palette.line}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      name="Revenue"
                      dot={false}
                      activeDot={{ r: 4, fill: palette.line, stroke: palette.activeDotStroke, strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Expense Breakdown Pie Chart */}
              <div className="mg-card rounded-lg border border-border bg-card p-6">
                <div className="mb-4">
                  <h3 className="text-[17px] font-semibold tracking-tight text-foreground flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-violet-400" />
                    Expense Breakdown
                  </h3>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">This month by category</p>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={expenseBreakdown?.data || []}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="amount"
                        nameKey="category"
                        label={({ category, percentage }) => `${percentage}%`}
                      >
                        {(expenseBreakdown?.data || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={palette.pie[index % palette.pie.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Cash Flow Chart */}
              <div className="mg-card rounded-lg border border-border bg-card p-6">
                <div className="mb-4">
                  <h3 className="text-[17px] font-semibold tracking-tight text-foreground flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    Cash Flow
                  </h3>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Money in vs money out</p>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashFlow?.data || []}>
                      <CartesianGrid vertical={false} stroke={palette.grid} strokeOpacity={palette.gridOpacity} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: palette.axis }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: palette.axis }} tickFormatter={formatCompact} width={52} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="inflow" name="Inflow" fill={palette.success} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="outflow" name="Outflow" fill={palette.danger} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top Customers Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Top 10 Customers by Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Avg Order</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(topCustomers?.data || []).map((customer) => (
                        <TableRow key={customer.rank}>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                              customer.rank <= 3
                                ? 'bg-amber-400/15 text-amber-400 ring-amber-400/25'
                                : 'bg-muted text-muted-foreground ring-border'
                            }`}>
                              #{customer.rank}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{customer.customer_name}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-emerald-500">{formatCurrency(customer.total_revenue)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{customer.order_count}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{formatCurrency(customer.average_order_value)}</TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wide bg-muted text-muted-foreground ring-1 ring-border">
                              {customer.percentage_of_total}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AGING REPORTS TAB */}
          <TabsContent value="aging" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Receivables"
                value={formatCurrency(agingReceivables?.total_outstanding || 0)}
                subtitle="Amount owed to you"
                icon={TrendingUp}
                color="blue"
              />
              <StatCard
                title="Total Payables"
                value={formatCurrency(agingPayables?.total_outstanding || 0)}
                subtitle="Amount you owe"
                icon={TrendingDown}
                color="orange"
              />
              <StatCard
                title="Overdue (90+ days)"
                value={formatCurrency(agingReceivables?.buckets?.["90+"]?.amount || 0)}
                subtitle={`${agingReceivables?.buckets?.["90+"]?.count || 0} invoices`}
                icon={AlertTriangle}
                color="red"
              />
              <StatCard
                title="Collection Rate"
                value={`${agingReceivables?.total_outstanding > 0 ? Math.round((1 - (agingReceivables?.buckets?.["90+"]?.amount || 0) / agingReceivables?.total_outstanding) * 100) : 100}%`}
                subtitle="Within 90 days"
                icon={CheckCircle}
                color="green"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Receivables Aging */}
              <div className="mg-card rounded-lg border border-border bg-card p-6">
                <div className="mb-4">
                  <h3 className="text-[17px] font-semibold tracking-tight text-foreground flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Accounts Receivable Aging
                  </h3>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Money owed to you by customers</p>
                </div>
                <div className="h-[250px] mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingReceivables?.summary || []}>
                      <CartesianGrid vertical={false} stroke={palette.grid} strokeOpacity={palette.gridOpacity} />
                      <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: palette.axis }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: palette.axis }} tickFormatter={formatCompact} width={52} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="amount" fill={palette.bar} radius={[3, 3, 0, 0]} name="Amount" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bucket</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(agingReceivables?.summary || []).map((item) => (
                        <TableRow key={item.bucket}>
                          <TableCell className="text-foreground">{item.bucket}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-emerald-500">{formatCurrency(item.amount)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{item.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Payables Aging */}
              <div className="mg-card rounded-lg border border-border bg-card p-6">
                <div className="mb-4">
                  <h3 className="text-[17px] font-semibold tracking-tight text-foreground flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-orange-400" />
                    Accounts Payable Aging
                  </h3>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Money you owe to suppliers</p>
                </div>
                <div className="h-[250px] mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingPayables?.summary || []}>
                      <CartesianGrid vertical={false} stroke={palette.grid} strokeOpacity={palette.gridOpacity} />
                      <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: palette.axis }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: palette.axis }} tickFormatter={formatCompact} width={52} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="amount" fill={palette.warning} radius={[3, 3, 0, 0]} name="Amount" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bucket</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(agingPayables?.summary || []).map((item) => (
                        <TableRow key={item.bucket}>
                          <TableCell className="text-foreground">{item.bucket}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-orange-400">{formatCurrency(item.amount)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{item.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* FINANCIAL STATEMENTS TAB */}
          <TabsContent value="statements" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Profit & Loss Statement */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Profit & Loss Statement
                  </CardTitle>
                  <CardDescription>{profitLoss?.period_label || 'Current Period'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 border border-border">
                    <span className="font-medium text-foreground">Sales Revenue</span>
                    <span className="text-emerald-500 font-mono font-bold tabular-nums">{formatCurrency(profitLoss?.income?.sales_revenue)}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 border border-border">
                    <span className="font-medium text-foreground">Cost of Goods Sold</span>
                    <span className="text-rose-400 font-mono font-bold tabular-nums">({formatCurrency(profitLoss?.cost_of_goods_sold?.total_cogs)})</span>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-lg border-2 border-dashed border-primary/40">
                    <span className="font-bold text-foreground">Gross Profit</span>
                    <span className={`font-mono font-bold tabular-nums ${profitLoss?.gross_profit >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                      {formatCurrency(profitLoss?.gross_profit)} ({profitLoss?.gross_margin_percentage}%)
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 border border-border">
                    <span className="font-medium text-foreground">Operating Expenses</span>
                    <span className="text-rose-400 font-mono font-bold tabular-nums">({formatCurrency(profitLoss?.operating_expenses?.total)})</span>
                  </div>

                  <div className={`flex justify-between items-center p-4 rounded-lg border ${profitLoss?.net_profit >= 0 ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-rose-500/10 border-rose-500/25'}`}>
                    <span className="font-bold text-lg text-foreground">Net Profit</span>
                    <span className={`font-mono font-bold tabular-nums text-lg ${profitLoss?.net_profit >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                      {formatCurrency(profitLoss?.net_profit)} ({profitLoss?.net_margin_percentage}%)
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Trial Balance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-primary" />
                    Trial Balance
                  </CardTitle>
                  <CardDescription>As of {trialBalance?.as_of_date?.slice(0, 10)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="bg-muted/40">
                          <TableCell colSpan={3} className="font-semibold text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Assets</TableCell>
                        </TableRow>
                        {(trialBalance?.trial_balance?.assets || []).map((acc, idx) => (
                          <TableRow key={`asset-${idx}`}>
                            <TableCell className="pl-6 text-foreground">{acc.account}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-emerald-500">{acc.debit > 0 ? formatCurrency(acc.debit) : '-'}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{acc.credit > 0 ? formatCurrency(acc.credit) : '-'}</TableCell>
                          </TableRow>
                        ))}

                        <TableRow className="bg-muted/40">
                          <TableCell colSpan={3} className="font-semibold text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Liabilities</TableCell>
                        </TableRow>
                        {(trialBalance?.trial_balance?.liabilities || []).map((acc, idx) => (
                          <TableRow key={`liability-${idx}`}>
                            <TableCell className="pl-6 text-foreground">{acc.account}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{acc.debit > 0 ? formatCurrency(acc.debit) : '-'}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-rose-400">{acc.credit > 0 ? formatCurrency(acc.credit) : '-'}</TableCell>
                          </TableRow>
                        ))}

                        <TableRow className="bg-muted/40">
                          <TableCell colSpan={3} className="font-semibold text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Income</TableCell>
                        </TableRow>
                        {(trialBalance?.trial_balance?.income || []).map((acc, idx) => (
                          <TableRow key={`income-${idx}`}>
                            <TableCell className="pl-6 text-foreground">{acc.account}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{acc.debit > 0 ? formatCurrency(acc.debit) : '-'}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-emerald-500">{acc.credit > 0 ? formatCurrency(acc.credit) : '-'}</TableCell>
                          </TableRow>
                        ))}

                        <TableRow className="bg-muted/40">
                          <TableCell className="font-bold text-foreground">Totals</TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-bold text-foreground">{formatCurrency(trialBalance?.totals?.total_debits)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-bold text-foreground">{formatCurrency(trialBalance?.totals?.total_credits)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* GST TAB */}
          <TabsContent value="gst" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Output GST"
                value={formatCurrency(gstSummary?.gstr3b?.output_tax?.total || 0)}
                subtitle="Tax collected on sales"
                icon={TrendingUp}
                color="blue"
              />
              <StatCard
                title="Input Tax Credit"
                value={formatCurrency(gstSummary?.gstr3b?.input_tax_credit?.total || 0)}
                subtitle="From purchases"
                icon={Receipt}
                color="green"
              />
              <StatCard
                title="Net GST Liability"
                value={formatCurrency(gstSummary?.gstr3b?.net_liability?.total || 0)}
                subtitle="To be paid"
                icon={Calculator}
                color={(gstSummary?.gstr3b?.net_liability?.total || 0) > 0 ? "orange" : "green"}
              />
              <StatCard
                title="B2B Invoices"
                value={gstSummary?.gstr1?.b2b?.invoice_count || 0}
                subtitle={formatCurrency(gstSummary?.gstr1?.b2b?.taxable_value)}
                icon={FileText}
                color="purple"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* GSTR-1 Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>GSTR-1 Summary (Outward Supplies)</CardTitle>
                  <CardDescription>Month: {gstSummary?.month}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Taxable</TableHead>
                          <TableHead className="text-right">IGST</TableHead>
                          <TableHead className="text-right">CGST</TableHead>
                          <TableHead className="text-right">SGST</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium text-foreground">B2B (With GSTIN)</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{formatCurrency(gstSummary?.gstr1?.b2b?.taxable_value)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-violet-400">{formatCurrency(gstSummary?.gstr1?.b2b?.igst)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-emerald-500">{formatCurrency(gstSummary?.gstr1?.b2b?.cgst)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-emerald-500">{formatCurrency(gstSummary?.gstr1?.b2b?.sgst)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-foreground">B2C (Without GSTIN)</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{formatCurrency(gstSummary?.gstr1?.b2c?.taxable_value)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-violet-400">{formatCurrency(gstSummary?.gstr1?.b2c?.igst)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-emerald-500">{formatCurrency(gstSummary?.gstr1?.b2c?.cgst)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-emerald-500">{formatCurrency(gstSummary?.gstr1?.b2c?.sgst)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/40">
                          <TableCell className="font-bold text-foreground">Total Outward</TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-bold text-foreground">{formatCurrency(gstSummary?.gstr1?.total_outward?.taxable_value)}</TableCell>
                          <TableCell colSpan={3} className="text-right font-mono tabular-nums font-bold text-foreground">
                            Total GST: {formatCurrency(gstSummary?.gstr1?.total_outward?.total_gst)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* GSTR-3B Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>GSTR-3B Preview (Tax Liability)</CardTitle>
                  <CardDescription>Net tax payable calculation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/25">
                      <p className="font-mono text-[11px] uppercase tracking-wide text-primary mb-3">Output Tax (Sales)</p>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">IGST</p>
                          <p className="font-mono font-bold tabular-nums text-foreground mt-1">{formatCurrency(gstSummary?.gstr3b?.output_tax?.igst)}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">CGST</p>
                          <p className="font-mono font-bold tabular-nums text-foreground mt-1">{formatCurrency(gstSummary?.gstr3b?.output_tax?.cgst)}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">SGST</p>
                          <p className="font-mono font-bold tabular-nums text-foreground mt-1">{formatCurrency(gstSummary?.gstr3b?.output_tax?.sgst)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                      <p className="font-mono text-[11px] uppercase tracking-wide text-emerald-500 mb-3">Input Tax Credit (Purchases)</p>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">IGST</p>
                          <p className="font-mono font-bold tabular-nums text-emerald-500 mt-1">({formatCurrency(gstSummary?.gstr3b?.input_tax_credit?.igst)})</p>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">CGST</p>
                          <p className="font-mono font-bold tabular-nums text-emerald-500 mt-1">({formatCurrency(gstSummary?.gstr3b?.input_tax_credit?.cgst)})</p>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">SGST</p>
                          <p className="font-mono font-bold tabular-nums text-emerald-500 mt-1">({formatCurrency(gstSummary?.gstr3b?.input_tax_credit?.sgst)})</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-orange-400/10 border border-orange-400/25">
                      <div className="flex justify-between mb-3">
                        <span className="font-mono text-[11px] uppercase tracking-wide text-orange-400 font-semibold">Net Tax Payable</span>
                        <span className="font-mono font-bold tabular-nums text-orange-400">
                          {formatCurrency(gstSummary?.gstr3b?.net_liability?.total)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">IGST</p>
                          <p className="font-mono font-bold tabular-nums text-foreground mt-1">{formatCurrency(gstSummary?.gstr3b?.net_liability?.igst)}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">CGST</p>
                          <p className="font-mono font-bold tabular-nums text-foreground mt-1">{formatCurrency(gstSummary?.gstr3b?.net_liability?.cgst)}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">SGST</p>
                          <p className="font-mono font-bold tabular-nums text-foreground mt-1">{formatCurrency(gstSummary?.gstr3b?.net_liability?.sgst)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* BANK RECONCILIATION TAB */}
          <TabsContent value="reconciliation" className="space-y-6">
            <div className="mg-card rounded-lg border border-border bg-card p-6">
              <div className="mb-4">
                <h3 className="text-[17px] font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Bank Reconciliation
                </h3>
                <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Match CRM payment records with bank transactions</p>
              </div>
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium text-foreground mb-2">Upload Bank Statement</h3>
                <p className="mb-4 text-sm">Upload your bank statement (CSV/Excel) to start reconciliation</p>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Upload Bank Statement
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

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

const COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

// Stat Card Component
const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = "blue", onClick }) => {
  const colorMap = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
    green: { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/20' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20' },
    red: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'border-cyan-500/20' }
  };
  const colors = colorMap[color] || colorMap.blue;

  return (
    <Card 
      className={`${colors.border} border hover:shadow-lg transition-all cursor-pointer`}
      onClick={onClick}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>{title}</p>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--foreground))' }}>{value}</p>
            {subtitle && (
              <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${colors.bg}`}>
            <Icon className={`w-5 h-5 ${colors.text}`} />
          </div>
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-3 text-sm">
            {trend >= 0 ? (
              <>
                <ArrowUpRight className="w-4 h-4 text-green-500" />
                <span className="text-green-500 font-medium">+{trend}%</span>
              </>
            ) : (
              <>
                <ArrowDownRight className="w-4 h-4 text-red-500" />
                <span className="text-red-500 font-medium">{trend}%</span>
              </>
            )}
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function FinanceAnalytics() {
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
    const token = localStorage.getItem('token');
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
        axios.get(`${API}/api/firms`, { headers }),
        axios.get(`${API}/api/finance/analytics/revenue-trends?period=${selectedPeriod}${firmParam}`, { headers }),
        axios.get(`${API}/api/finance/analytics/expense-breakdown?period=current_month${firmParam}`, { headers }),
        axios.get(`${API}/api/finance/analytics/profit-loss?period=ytd${firmParam}`, { headers }),
        axios.get(`${API}/api/finance/analytics/cash-flow?period=${selectedPeriod}${firmParam}`, { headers }),
        axios.get(`${API}/api/finance/analytics/top-customers?limit=10&period=ytd${firmParam}`, { headers }),
        axios.get(`${API}/api/finance/analytics/aging-report?report_type=receivables${firmParam}`, { headers }),
        axios.get(`${API}/api/finance/analytics/aging-report?report_type=payables${firmParam}`, { headers }),
        axios.get(`${API}/api/finance/analytics/trial-balance${firmParam}`, { headers }),
        axios.get(`${API}/api/finance/analytics/gst-summary?period=current_month${firmParam}`, { headers })
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
      <div className="p-3 rounded-lg shadow-lg" style={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}>
        <p className="font-medium mb-1" style={{ color: 'hsl(var(--foreground))' }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'hsl(var(--foreground))' }}>
              Finance Analytics
            </h1>
            <p style={{ color: 'hsl(var(--muted-foreground))' }}>
              Comprehensive financial insights and reporting
            </p>
          </div>
          
          <div className="flex items-center gap-3">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Revenue Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrends?.data || []}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="_id" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={formatCompact} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#3B82F6" 
                        fillOpacity={1} 
                        fill="url(#colorRevenue)"
                        name="Revenue"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Expense Breakdown Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Expense Breakdown
                  </CardTitle>
                  <CardDescription>This month by category</CardDescription>
                </CardHeader>
                <CardContent>
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
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Cash Flow Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Cash Flow
                  </CardTitle>
                  <CardDescription>Money in vs money out</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cashFlow?.data || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={formatCompact} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="inflow" name="Inflow" fill="#22C55E" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="outflow" name="Outflow" fill="#EF4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Customers Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Top 10 Customers by Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                          <Badge variant={customer.rank <= 3 ? "default" : "secondary"}>
                            #{customer.rank}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{customer.customer_name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(customer.total_revenue)}</TableCell>
                        <TableCell className="text-right">{customer.order_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(customer.average_order_value)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{customer.percentage_of_total}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-500">
                    <TrendingUp className="w-5 h-5" />
                    Accounts Receivable Aging
                  </CardTitle>
                  <CardDescription>Money owed to you by customers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={agingReceivables?.summary || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={formatCompact} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
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
                          <TableCell>{item.bucket}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                          <TableCell className="text-right">{item.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Payables Aging */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-500">
                    <TrendingDown className="w-5 h-5" />
                    Accounts Payable Aging
                  </CardTitle>
                  <CardDescription>Money you owe to suppliers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={agingPayables?.summary || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={formatCompact} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="amount" fill="#F97316" radius={[4, 4, 0, 0]} name="Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
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
                          <TableCell>{item.bucket}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                          <TableCell className="text-right">{item.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* FINANCIAL STATEMENTS TAB */}
          <TabsContent value="statements" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Profit & Loss Statement */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Profit & Loss Statement
                  </CardTitle>
                  <CardDescription>{profitLoss?.period_label || 'Current Period'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'hsl(var(--muted))' }}>
                      <span className="font-medium">Sales Revenue</span>
                      <span className="text-green-500 font-bold">{formatCurrency(profitLoss?.income?.sales_revenue)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'hsl(var(--muted))' }}>
                      <span className="font-medium">Cost of Goods Sold</span>
                      <span className="text-red-500 font-bold">({formatCurrency(profitLoss?.cost_of_goods_sold?.total_cogs)})</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 rounded-lg border-2 border-dashed" style={{ borderColor: 'hsl(var(--primary))' }}>
                      <span className="font-bold">Gross Profit</span>
                      <span className={`font-bold ${profitLoss?.gross_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatCurrency(profitLoss?.gross_profit)} ({profitLoss?.gross_margin_percentage}%)
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'hsl(var(--muted))' }}>
                      <span className="font-medium">Operating Expenses</span>
                      <span className="text-red-500 font-bold">({formatCurrency(profitLoss?.operating_expenses?.total)})</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-4 rounded-lg" style={{ backgroundColor: profitLoss?.net_profit >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                      <span className="font-bold text-lg">Net Profit</span>
                      <span className={`font-bold text-lg ${profitLoss?.net_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatCurrency(profitLoss?.net_profit)} ({profitLoss?.net_margin_percentage}%)
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trial Balance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Trial Balance
                  </CardTitle>
                  <CardDescription>As of {trialBalance?.as_of_date?.slice(0, 10)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="font-semibold" style={{ backgroundColor: 'hsl(var(--muted))' }}>
                        <TableCell colSpan={3}>Assets</TableCell>
                      </TableRow>
                      {(trialBalance?.trial_balance?.assets || []).map((acc, idx) => (
                        <TableRow key={`asset-${idx}`}>
                          <TableCell className="pl-6">{acc.account}</TableCell>
                          <TableCell className="text-right">{acc.debit > 0 ? formatCurrency(acc.debit) : '-'}</TableCell>
                          <TableCell className="text-right">{acc.credit > 0 ? formatCurrency(acc.credit) : '-'}</TableCell>
                        </TableRow>
                      ))}
                      
                      <TableRow className="font-semibold" style={{ backgroundColor: 'hsl(var(--muted))' }}>
                        <TableCell colSpan={3}>Liabilities</TableCell>
                      </TableRow>
                      {(trialBalance?.trial_balance?.liabilities || []).map((acc, idx) => (
                        <TableRow key={`liability-${idx}`}>
                          <TableCell className="pl-6">{acc.account}</TableCell>
                          <TableCell className="text-right">{acc.debit > 0 ? formatCurrency(acc.debit) : '-'}</TableCell>
                          <TableCell className="text-right">{acc.credit > 0 ? formatCurrency(acc.credit) : '-'}</TableCell>
                        </TableRow>
                      ))}
                      
                      <TableRow className="font-semibold" style={{ backgroundColor: 'hsl(var(--muted))' }}>
                        <TableCell colSpan={3}>Income</TableCell>
                      </TableRow>
                      {(trialBalance?.trial_balance?.income || []).map((acc, idx) => (
                        <TableRow key={`income-${idx}`}>
                          <TableCell className="pl-6">{acc.account}</TableCell>
                          <TableCell className="text-right">{acc.debit > 0 ? formatCurrency(acc.debit) : '-'}</TableCell>
                          <TableCell className="text-right">{acc.credit > 0 ? formatCurrency(acc.credit) : '-'}</TableCell>
                        </TableRow>
                      ))}
                      
                      <TableRow className="font-bold border-t-2">
                        <TableCell>Totals</TableCell>
                        <TableCell className="text-right">{formatCurrency(trialBalance?.totals?.total_debits)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(trialBalance?.totals?.total_credits)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
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
                        <TableCell className="font-medium">B2B (With GSTIN)</TableCell>
                        <TableCell className="text-right">{formatCurrency(gstSummary?.gstr1?.b2b?.taxable_value)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gstSummary?.gstr1?.b2b?.igst)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gstSummary?.gstr1?.b2b?.cgst)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gstSummary?.gstr1?.b2b?.sgst)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">B2C (Without GSTIN)</TableCell>
                        <TableCell className="text-right">{formatCurrency(gstSummary?.gstr1?.b2c?.taxable_value)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gstSummary?.gstr1?.b2c?.igst)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gstSummary?.gstr1?.b2c?.cgst)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gstSummary?.gstr1?.b2c?.sgst)}</TableCell>
                      </TableRow>
                      <TableRow className="font-bold border-t">
                        <TableCell>Total Outward</TableCell>
                        <TableCell className="text-right">{formatCurrency(gstSummary?.gstr1?.total_outward?.taxable_value)}</TableCell>
                        <TableCell colSpan={3} className="text-right">
                          Total GST: {formatCurrency(gstSummary?.gstr1?.total_outward?.total_gst)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* GSTR-3B Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>GSTR-3B Preview (Tax Liability)</CardTitle>
                  <CardDescription>Net tax payable calculation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">Output Tax (Sales)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>IGST</p>
                          <p className="font-bold">{formatCurrency(gstSummary?.gstr3b?.output_tax?.igst)}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>CGST</p>
                          <p className="font-bold">{formatCurrency(gstSummary?.gstr3b?.output_tax?.cgst)}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>SGST</p>
                          <p className="font-bold">{formatCurrency(gstSummary?.gstr3b?.output_tax?.sgst)}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">Input Tax Credit (Purchases)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>IGST</p>
                          <p className="font-bold text-green-500">({formatCurrency(gstSummary?.gstr3b?.input_tax_credit?.igst)})</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>CGST</p>
                          <p className="font-bold text-green-500">({formatCurrency(gstSummary?.gstr3b?.input_tax_credit?.cgst)})</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>SGST</p>
                          <p className="font-bold text-green-500">({formatCurrency(gstSummary?.gstr3b?.input_tax_credit?.sgst)})</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)' }}>
                      <div className="flex justify-between mb-2">
                        <span className="font-semibold">Net Tax Payable</span>
                        <span className="font-bold text-orange-500">
                          {formatCurrency(gstSummary?.gstr3b?.net_liability?.total)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>IGST</p>
                          <p className="font-bold">{formatCurrency(gstSummary?.gstr3b?.net_liability?.igst)}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>CGST</p>
                          <p className="font-bold">{formatCurrency(gstSummary?.gstr3b?.net_liability?.cgst)}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>SGST</p>
                          <p className="font-bold">{formatCurrency(gstSummary?.gstr3b?.net_liability?.sgst)}</p>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Bank Reconciliation
                </CardTitle>
                <CardDescription>
                  Match CRM payment records with bank transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Upload Bank Statement</h3>
                  <p className="mb-4">Upload your bank statement (CSV/Excel) to start reconciliation</p>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Upload Bank Statement
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

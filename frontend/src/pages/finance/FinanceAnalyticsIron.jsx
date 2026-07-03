import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';
import {
  TrendingUp, TrendingDown, DollarSign, PieChart as PieIcon, BarChart3,
  Calendar, Building2, FileText, Download, CreditCard, Wallet, Receipt, Calculator,
  AlertTriangle, CheckCircle, Users, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
} from 'recharts';

/* Finance Analytics — MuscleGrid "Iron Console" redesign.
   Faithful drop-in port of FinanceAnalytics.jsx: same endpoints, filters, tabs,
   charts, tables and empty states — restyled to the light Iron-Console palette. */

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatCompact = (amount) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
};

// Iron-Console chart palette (orange-led, iron accents).
const PIE_COLORS = [T.orange, T.blue, T.green, T.voltageText, '#6D4AB0', T.iron500, '#0891B2', T.orangeDeep];

const inputStyle = {
  border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5,
  color: T.iron900, background: T.white, outline: 'none', fontFamily: T.body,
};

const table = { width: '100%', borderCollapse: 'collapse' };
const theadRow = { borderBottom: `1px solid ${T.iron200}`, background: T.iron50 };
const th8 = { ...thCell };
const tdR = { ...tdCell, textAlign: 'right', ...mono };

// KPI tile
const Kpi = ({ label, value, sub, icon: Icon, accent = T.iron900, trend }) => (
  <IronCard pad="13px 14px">
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <Caps size={8.5} color={T.iron400}>{label}</Caps>
        <div style={{ ...mono, fontWeight: 700, fontSize: 26, color: accent, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ marginTop: 4 }}><Caps size={8.5} color={T.iron500} ls=".05em">{sub}</Caps></div>}
        {trend !== undefined && trend !== null && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 10, padding: '1px 6px', borderRadius: 4,
              background: trend >= 0 ? T.greenTint : '#FDEEE6', color: trend >= 0 ? T.green : T.orangeDeep }}>
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
            <Caps size={8} color={T.iron400} ls=".04em">vs last period</Caps>
          </div>
        )}
      </div>
      {Icon && (
        <div style={{ width: 36, height: 36, borderRadius: 8, background: T.iron100, color: accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon size={17} />
        </div>
      )}
    </div>
  </IronCard>
);

const SectionHead = ({ icon: Icon, iconColor = T.orange, title, sub }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {Icon && <Icon size={17} color={iconColor} />}
      <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>{title}</span>
    </div>
    {sub && <div style={{ marginTop: 3 }}><Caps size={9} color={T.iron400} ls=".05em">{sub}</Caps></div>}
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '6px 10px', boxShadow: '0 2px 8px rgba(15,15,15,.1)' }}>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.iron400, marginBottom: 2 }}>{label}</div>
      {payload.map((entry, index) => (
        <div key={index} style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: entry.color || T.iron900 }}>
          {entry.name}: {formatCurrency(entry.value)}
        </div>
      ))}
    </div>
  );
};

const TABS = [
  ['overview', 'Overview', BarChart3],
  ['aging', 'Aging Reports', TrendingDown],
  ['statements', 'Statements', FileText],
  ['gst', 'GST', Receipt],
  ['reconciliation', 'Bank Recon', CreditCard],
];

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
        gstRes,
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
        axios.get(`${API}/finance/analytics/gst-summary?period=current_month${firmParam}`, { headers }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFirm, selectedPeriod]);

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Building2 size={14} color={T.iron400} />
        <select value={selectedFirm} onChange={(e) => setSelectedFirm(e.target.value)} style={{ ...inputStyle, minWidth: 150 }} data-testid="firm-select">
          <option value="all">All Firms</option>
          {firms.map((firm) => (
            <option key={firm.id} value={firm.id}>{firm.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Calendar size={14} color={T.iron400} />
        <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} style={{ ...inputStyle, minWidth: 120 }} data-testid="period-select">
          <option value="3months">3 Months</option>
          <option value="6months">6 Months</option>
          <option value="12months">12 Months</option>
          <option value="ytd">Year to Date</option>
        </select>
      </div>
    </div>
  );

  const receivables = agingReceivables || {};
  const collectionRate = receivables.total_outstanding > 0
    ? Math.round((1 - (receivables.buckets?.['90+']?.amount || 0) / receivables.total_outstanding) * 100)
    : 100;

  return (
    <IronShell title="Finance Analytics" subtitle="LIVE ANALYTICS · FINANCIAL INSIGHTS" onRefresh={fetchAllData} headerRight={headerRight}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(([id, label, Icon]) => {
          const on = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)} data-testid={`tab-${id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${on ? T.iron900 : T.iron200}`,
                background: on ? T.iron900 : T.white, color: on ? '#fff' : T.iron700, borderRadius: 999,
                padding: '6px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12 }}>
              <Icon size={14} />{label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : activeTab === 'overview' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <Kpi label="Total Revenue" value={formatCompact(revenueTrends?.summary?.total_revenue || 0)}
              sub={`${revenueTrends?.summary?.total_orders || 0} orders`} icon={TrendingUp} accent={T.orange}
              trend={revenueTrends?.summary?.growth_percentage} />
            <Kpi label="Gross Profit" value={formatCompact(profitLoss?.gross_profit || 0)}
              sub={`${profitLoss?.gross_margin_percentage || 0}% margin`} icon={DollarSign}
              accent={profitLoss?.gross_profit >= 0 ? T.green : T.orangeDeep} />
            <Kpi label="Net Profit" value={formatCompact(profitLoss?.net_profit || 0)}
              sub={`${profitLoss?.net_margin_percentage || 0}% margin`} icon={Wallet}
              accent={profitLoss?.net_profit >= 0 ? T.green : T.orangeDeep} />
            <Kpi label="Cash Flow" value={formatCompact(cashFlow?.summary?.net_cash_flow || 0)}
              sub="Net flow" icon={CreditCard}
              accent={cashFlow?.summary?.net_cash_flow >= 0 ? T.blue : T.voltageText} />
          </div>

          {/* Revenue Trend */}
          <IronCard pad={18}>
            <SectionHead icon={BarChart3} title="Revenue Trend" sub="Period revenue velocity" />
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrends?.data || []}>
                  <defs>
                    <linearGradient id="ironRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={T.orange} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={T.orange} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={T.iron200} />
                  <XAxis dataKey="_id" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.iron400, fontFamily: T.mono }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.iron400, fontFamily: T.mono }} tickFormatter={formatCompact} width={52} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: T.orange, strokeOpacity: 0.3, strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="revenue" stroke={T.orange} strokeWidth={2.5} fillOpacity={1}
                    fill="url(#ironRevenue)" name="Revenue" dot={false}
                    activeDot={{ r: 4, fill: T.white, stroke: T.orange, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </IronCard>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Expense Breakdown */}
            <IronCard pad={18}>
              <SectionHead icon={PieIcon} iconColor="#6D4AB0" title="Expense Breakdown" sub="This month by category" />
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie data={expenseBreakdown?.data || []} cx="50%" cy="50%" outerRadius={100}
                      dataKey="amount" nameKey="category"
                      label={({ percentage }) => `${percentage}%`}>
                      {(expenseBreakdown?.data || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)}
                      contentStyle={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 6, fontFamily: T.mono, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontFamily: T.body, fontSize: 11, color: T.iron700 }} />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </IronCard>

            {/* Cash Flow */}
            <IronCard pad={18}>
              <SectionHead icon={TrendingUp} iconColor={T.green} title="Cash Flow" sub="Money in vs money out" />
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlow?.data || []}>
                    <CartesianGrid vertical={false} stroke={T.iron200} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.iron400, fontFamily: T.mono }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.iron400, fontFamily: T.mono }} tickFormatter={formatCompact} width={52} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontFamily: T.body, fontSize: 11, color: T.iron700 }} />
                    <Bar dataKey="inflow" name="Inflow" fill={T.green} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="outflow" name="Outflow" fill={T.orangeDeep} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </IronCard>
          </div>

          {/* Top Customers */}
          <IronCard pad={0}>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={17} color={T.orange} />
              <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>Top 10 Customers by Revenue</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={table}>
                <thead>
                  <tr style={theadRow}>
                    <th style={th8}><Caps size={8.5}>Rank</Caps></th>
                    <th style={th8}><Caps size={8.5}>Customer</Caps></th>
                    <th style={{ ...th8, textAlign: 'right' }}><Caps size={8.5}>Revenue</Caps></th>
                    <th style={{ ...th8, textAlign: 'right' }}><Caps size={8.5}>Orders</Caps></th>
                    <th style={{ ...th8, textAlign: 'right' }}><Caps size={8.5}>Avg Order</Caps></th>
                    <th style={{ ...th8, textAlign: 'right' }}><Caps size={8.5}>% of Total</Caps></th>
                  </tr>
                </thead>
                <tbody>
                  {(topCustomers?.data || []).map((customer) => (
                    <tr key={customer.rank} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={tdCell}><span style={badgeStyle(customer.rank <= 3 ? 'warn' : 'slate')}>#{customer.rank}</span></td>
                      <td style={{ ...tdCell, fontWeight: 600, color: T.iron900 }}>{customer.customer_name}</td>
                      <td style={{ ...tdR, color: T.green, fontWeight: 700 }}>{formatCurrency(customer.total_revenue)}</td>
                      <td style={tdR}>{customer.order_count}</td>
                      <td style={{ ...tdR, color: T.iron400 }}>{formatCurrency(customer.average_order_value)}</td>
                      <td style={{ ...tdCell, textAlign: 'right' }}><span style={badgeStyle('slate')}>{customer.percentage_of_total}%</span></td>
                    </tr>
                  ))}
                  {(topCustomers?.data || []).length === 0 && (
                    <tr><td colSpan={6} style={{ ...tdCell, textAlign: 'center', color: T.iron400, padding: 40 }}>No customer data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </IronCard>
        </div>
      ) : activeTab === 'aging' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <Kpi label="Total Receivables" value={formatCurrency(receivables.total_outstanding || 0)} sub="Amount owed to you" icon={TrendingUp} accent={T.blue} />
            <Kpi label="Total Payables" value={formatCurrency(agingPayables?.total_outstanding || 0)} sub="Amount you owe" icon={TrendingDown} accent={T.voltageText} />
            <Kpi label="Overdue (90+ days)" value={formatCurrency(receivables.buckets?.['90+']?.amount || 0)} sub={`${receivables.buckets?.['90+']?.count || 0} invoices`} icon={AlertTriangle} accent={T.orangeDeep} />
            <Kpi label="Collection Rate" value={`${collectionRate}%`} sub="Within 90 days" icon={CheckCircle} accent={T.green} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Receivables */}
            <IronCard pad={18}>
              <SectionHead icon={TrendingUp} title="Accounts Receivable Aging" sub="Money owed to you by customers" />
              <div style={{ height: 250, marginBottom: 14 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingReceivables?.summary || []}>
                    <CartesianGrid vertical={false} stroke={T.iron200} />
                    <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.iron400, fontFamily: T.mono }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.iron400, fontFamily: T.mono }} tickFormatter={formatCompact} width={52} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="amount" fill={T.orange} radius={[3, 3, 0, 0]} name="Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ overflowX: 'auto', border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                <table style={table}>
                  <thead>
                    <tr style={theadRow}>
                      <th style={th8}><Caps size={8.5}>Bucket</Caps></th>
                      <th style={{ ...th8, textAlign: 'right' }}><Caps size={8.5}>Amount</Caps></th>
                      <th style={{ ...th8, textAlign: 'right' }}><Caps size={8.5}>Count</Caps></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(agingReceivables?.summary || []).map((item) => (
                      <tr key={item.bucket} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={{ ...tdCell, color: T.iron900 }}>{item.bucket}</td>
                        <td style={{ ...tdR, color: T.green }}>{formatCurrency(item.amount)}</td>
                        <td style={tdR}>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IronCard>

            {/* Payables */}
            <IronCard pad={18}>
              <SectionHead icon={TrendingDown} iconColor={T.voltageText} title="Accounts Payable Aging" sub="Money you owe to suppliers" />
              <div style={{ height: 250, marginBottom: 14 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingPayables?.summary || []}>
                    <CartesianGrid vertical={false} stroke={T.iron200} />
                    <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.iron400, fontFamily: T.mono }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: T.iron400, fontFamily: T.mono }} tickFormatter={formatCompact} width={52} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="amount" fill={T.voltage} radius={[3, 3, 0, 0]} name="Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ overflowX: 'auto', border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                <table style={table}>
                  <thead>
                    <tr style={theadRow}>
                      <th style={th8}><Caps size={8.5}>Bucket</Caps></th>
                      <th style={{ ...th8, textAlign: 'right' }}><Caps size={8.5}>Amount</Caps></th>
                      <th style={{ ...th8, textAlign: 'right' }}><Caps size={8.5}>Count</Caps></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(agingPayables?.summary || []).map((item) => (
                      <tr key={item.bucket} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={{ ...tdCell, color: T.iron900 }}>{item.bucket}</td>
                        <td style={{ ...tdR, color: T.voltageText }}>{formatCurrency(item.amount)}</td>
                        <td style={tdR}>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IronCard>
          </div>
        </div>
      ) : activeTab === 'statements' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Profit & Loss */}
          <IronCard pad={18}>
            <SectionHead icon={FileText} title="Profit & Loss Statement" sub={profitLoss?.period_label || 'Current Period'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <span style={{ fontWeight: 600, color: T.iron900, fontSize: 13 }}>Sales Revenue</span>
                <span style={{ ...mono, color: T.green, fontWeight: 700 }}>{formatCurrency(profitLoss?.income?.sales_revenue)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <span style={{ fontWeight: 600, color: T.iron900, fontSize: 13 }}>Cost of Goods Sold</span>
                <span style={{ ...mono, color: T.orangeDeep, fontWeight: 700 }}>({formatCurrency(profitLoss?.cost_of_goods_sold?.total_cogs)})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, border: `2px dashed ${T.orange}` }}>
                <span style={{ fontWeight: 700, color: T.iron900, fontSize: 13 }}>Gross Profit</span>
                <span style={{ ...mono, fontWeight: 700, color: profitLoss?.gross_profit >= 0 ? T.green : T.orangeDeep }}>
                  {formatCurrency(profitLoss?.gross_profit)} ({profitLoss?.gross_margin_percentage}%)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <span style={{ fontWeight: 600, color: T.iron900, fontSize: 13 }}>Operating Expenses</span>
                <span style={{ ...mono, color: T.orangeDeep, fontWeight: 700 }}>({formatCurrency(profitLoss?.operating_expenses?.total)})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 8,
                background: profitLoss?.net_profit >= 0 ? T.greenTint : '#FDEEE6', border: `1px solid ${profitLoss?.net_profit >= 0 ? '#CBE5D6' : '#F6D8BA'}` }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: T.iron900 }}>Net Profit</span>
                <span style={{ ...mono, fontWeight: 700, fontSize: 16, color: profitLoss?.net_profit >= 0 ? T.green : T.orangeDeep }}>
                  {formatCurrency(profitLoss?.net_profit)} ({profitLoss?.net_margin_percentage}%)
                </span>
              </div>
            </div>
          </IronCard>

          {/* Trial Balance */}
          <IronCard pad={0}>
            <div style={{ padding: '16px 16px 12px' }}>
              <SectionHead icon={Calculator} title="Trial Balance" sub={`As of ${trialBalance?.as_of_date?.slice(0, 10) || '-'}`} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={table}>
                <thead>
                  <tr style={theadRow}>
                    <th style={th8}><Caps size={8.5}>Account</Caps></th>
                    <th style={{ ...th8, textAlign: 'right' }}><Caps size={8.5}>Debit</Caps></th>
                    <th style={{ ...th8, textAlign: 'right' }}><Caps size={8.5}>Credit</Caps></th>
                  </tr>
                </thead>
                <tbody>
                  {[['Assets', 'assets', 'debit'], ['Liabilities', 'liabilities', 'credit'], ['Income', 'income', 'credit']].map(([label, key]) => (
                    <React.Fragment key={key}>
                      <tr style={{ background: T.iron50 }}>
                        <td colSpan={3} style={{ ...tdCell }}><Caps size={9} color={T.iron500}>{label}</Caps></td>
                      </tr>
                      {(trialBalance?.trial_balance?.[key] || []).map((acc, idx) => (
                        <tr key={`${key}-${idx}`} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                          <td style={{ ...tdCell, paddingLeft: 24, color: T.iron900 }}>{acc.account}</td>
                          <td style={{ ...tdR, color: key === 'assets' ? T.green : T.iron400 }}>{acc.debit > 0 ? formatCurrency(acc.debit) : '-'}</td>
                          <td style={{ ...tdR, color: key === 'liabilities' ? T.orangeDeep : key === 'income' ? T.green : T.iron400 }}>{acc.credit > 0 ? formatCurrency(acc.credit) : '-'}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  <tr style={{ background: T.iron50, borderTop: `2px solid ${T.iron200}` }}>
                    <td style={{ ...tdCell, fontWeight: 700, color: T.iron900 }}>Totals</td>
                    <td style={{ ...tdR, fontWeight: 700, color: T.iron900 }}>{formatCurrency(trialBalance?.totals?.total_debits)}</td>
                    <td style={{ ...tdR, fontWeight: 700, color: T.iron900 }}>{formatCurrency(trialBalance?.totals?.total_credits)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </IronCard>
        </div>
      ) : activeTab === 'gst' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <Kpi label="Output GST" value={formatCurrency(gstSummary?.gstr3b?.output_tax?.total || 0)} sub="Tax collected on sales" icon={TrendingUp} accent={T.blue} />
            <Kpi label="Input Tax Credit" value={formatCurrency(gstSummary?.gstr3b?.input_tax_credit?.total || 0)} sub="From purchases" icon={Receipt} accent={T.green} />
            <Kpi label="Net GST Liability" value={formatCurrency(gstSummary?.gstr3b?.net_liability?.total || 0)} sub="To be paid" icon={Calculator}
              accent={(gstSummary?.gstr3b?.net_liability?.total || 0) > 0 ? T.voltageText : T.green} />
            <Kpi label="B2B Invoices" value={gstSummary?.gstr1?.b2b?.invoice_count || 0} sub={formatCurrency(gstSummary?.gstr1?.b2b?.taxable_value)} icon={FileText} accent="#6D4AB0" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* GSTR-1 */}
            <IronCard pad={0}>
              <div style={{ padding: '16px 16px 12px' }}>
                <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>GSTR-1 Summary (Outward Supplies)</span>
                <div style={{ marginTop: 3 }}><Caps size={9} color={T.iron400}>Month: {gstSummary?.month || '-'}</Caps></div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={table}>
                  <thead>
                    <tr style={theadRow}>
                      {['Category', 'Taxable', 'IGST', 'CGST', 'SGST'].map((h, i) => (
                        <th key={h} style={i === 0 ? th8 : { ...th8, textAlign: 'right' }}><Caps size={8.5}>{h}</Caps></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, fontWeight: 600, color: T.iron900 }}>B2B (With GSTIN)</td>
                      <td style={tdR}>{formatCurrency(gstSummary?.gstr1?.b2b?.taxable_value)}</td>
                      <td style={{ ...tdR, color: '#6D4AB0' }}>{formatCurrency(gstSummary?.gstr1?.b2b?.igst)}</td>
                      <td style={{ ...tdR, color: T.green }}>{formatCurrency(gstSummary?.gstr1?.b2b?.cgst)}</td>
                      <td style={{ ...tdR, color: T.green }}>{formatCurrency(gstSummary?.gstr1?.b2b?.sgst)}</td>
                    </tr>
                    <tr className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, fontWeight: 600, color: T.iron900 }}>B2C (Without GSTIN)</td>
                      <td style={tdR}>{formatCurrency(gstSummary?.gstr1?.b2c?.taxable_value)}</td>
                      <td style={{ ...tdR, color: '#6D4AB0' }}>{formatCurrency(gstSummary?.gstr1?.b2c?.igst)}</td>
                      <td style={{ ...tdR, color: T.green }}>{formatCurrency(gstSummary?.gstr1?.b2c?.cgst)}</td>
                      <td style={{ ...tdR, color: T.green }}>{formatCurrency(gstSummary?.gstr1?.b2c?.sgst)}</td>
                    </tr>
                    <tr style={{ background: T.iron50 }}>
                      <td style={{ ...tdCell, fontWeight: 700, color: T.iron900 }}>Total Outward</td>
                      <td style={{ ...tdR, fontWeight: 700, color: T.iron900 }}>{formatCurrency(gstSummary?.gstr1?.total_outward?.taxable_value)}</td>
                      <td colSpan={3} style={{ ...tdR, fontWeight: 700, color: T.iron900 }}>
                        Total GST: {formatCurrency(gstSummary?.gstr1?.total_outward?.total_gst)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </IronCard>

            {/* GSTR-3B */}
            <IronCard pad={18}>
              <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>GSTR-3B Preview (Tax Liability)</span>
              <div style={{ marginTop: 3, marginBottom: 12 }}><Caps size={9} color={T.iron400}>Net tax payable calculation</Caps></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: 14, borderRadius: 8, background: T.blueTint, border: `1px solid #CBE0F0` }}>
                  <Caps size={9.5} color={T.blue}>Output Tax (Sales)</Caps>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 10, textAlign: 'center' }}>
                    {[['IGST', gstSummary?.gstr3b?.output_tax?.igst], ['CGST', gstSummary?.gstr3b?.output_tax?.cgst], ['SGST', gstSummary?.gstr3b?.output_tax?.sgst]].map(([l, v]) => (
                      <div key={l}>
                        <Caps size={8.5} color={T.iron500}>{l}</Caps>
                        <div style={{ ...mono, fontWeight: 700, color: T.iron900, marginTop: 4 }}>{formatCurrency(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: 14, borderRadius: 8, background: T.greenTint, border: `1px solid #CBE5D6` }}>
                  <Caps size={9.5} color={T.green}>Input Tax Credit (Purchases)</Caps>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 10, textAlign: 'center' }}>
                    {[['IGST', gstSummary?.gstr3b?.input_tax_credit?.igst], ['CGST', gstSummary?.gstr3b?.input_tax_credit?.cgst], ['SGST', gstSummary?.gstr3b?.input_tax_credit?.sgst]].map(([l, v]) => (
                      <div key={l}>
                        <Caps size={8.5} color={T.iron500}>{l}</Caps>
                        <div style={{ ...mono, fontWeight: 700, color: T.green, marginTop: 4 }}>({formatCurrency(v)})</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: 14, borderRadius: 8, background: T.voltageTint, border: `1px solid #EDDFA6` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Caps size={9.5} color={T.voltageText}>Net Tax Payable</Caps>
                    <span style={{ ...mono, fontWeight: 700, color: T.voltageText }}>{formatCurrency(gstSummary?.gstr3b?.net_liability?.total)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, textAlign: 'center' }}>
                    {[['IGST', gstSummary?.gstr3b?.net_liability?.igst], ['CGST', gstSummary?.gstr3b?.net_liability?.cgst], ['SGST', gstSummary?.gstr3b?.net_liability?.sgst]].map(([l, v]) => (
                      <div key={l}>
                        <Caps size={8.5} color={T.iron500}>{l}</Caps>
                        <div style={{ ...mono, fontWeight: 700, color: T.iron900, marginTop: 4 }}>{formatCurrency(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </IronCard>
          </div>
        </div>
      ) : (
        // BANK RECONCILIATION
        <IronCard pad={18}>
          <SectionHead icon={CreditCard} title="Bank Reconciliation" sub="Match CRM payment records with bank transactions" />
          <div style={{ textAlign: 'center', padding: '48px 20px', color: T.iron400 }}>
            <CreditCard size={64} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 17, color: T.iron900, marginBottom: 8 }}>Upload Bank Statement</div>
            <div style={{ fontSize: 13, marginBottom: 16 }}>Upload your bank statement (CSV/Excel) to start reconciliation</div>
            <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, background: T.white,
              color: T.iron700, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
              <Download size={14} /> Upload Bank Statement
            </button>
          </div>
        </IronCard>
      )}
    </IronShell>
  );
}

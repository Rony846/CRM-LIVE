import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  BarChart3, TrendingUp, Package, IndianRupee, Calendar,
  Loader2, Award, Crown, Star, ArrowUp, ArrowDown, Minus
} from 'lucide-react';

// ── Tier config ───────────────────────────────────────────────────────────────
const TIER_CONFIG = {
  silver:   { label: 'Silver',   iconTile: 'bg-muted text-muted-foreground',        Icon: Star },
  gold:     { label: 'Gold',     iconTile: 'bg-amber-400/15 text-amber-400',        Icon: Award },
  platinum: { label: 'Platinum', iconTile: 'bg-violet-400/15 text-violet-400',      Icon: Crown },
};

// ── Stat tile ─────────────────────────────────────────────────────────────────
const STAT_TONES = {
  sky:    'bg-sky-400/15     text-sky-400',
  emerald:'bg-emerald-500/15 text-emerald-400',
  indigo: 'bg-primary/15     text-primary',
  violet: 'bg-violet-400/15  text-violet-400',
};

function StatTile({ Icon, label, value, tone = 'indigo' }) {
  return (
    <div className="mg-card rounded-lg border border-border bg-card p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded mb-3 ${STAT_TONES[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="font-mono text-2xl font-bold tabular-nums text-foreground leading-none">{value}</p>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function TierProgress({ value }) {
  const pct = Math.min(value, 100);
  return (
    <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
      <div
        className="h-3 rounded-full bg-primary transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Change badge ──────────────────────────────────────────────────────────────
function ChangeBadge({ change }) {
  if (!change || change === 0) return null;
  const up = Number(change) > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
      up
        ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
        : 'bg-rose-500/15 text-rose-400 ring-rose-500/25'
    }`}>
      {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(change)}%
    </span>
  );
}

// ── Order status tile ─────────────────────────────────────────────────────────
const ORDER_STATUS_TILES = [
  { key: 'pending',   label: 'Pending',   tone: 'bg-amber-400/10  text-amber-400',  num: 'text-amber-400' },
  { key: 'confirmed', label: 'Confirmed', tone: 'bg-sky-400/10     text-sky-400',   num: 'text-sky-400' },
  { key: 'dispatched',label: 'Dispatched',tone: 'bg-primary/10     text-primary',   num: 'text-primary' },
  { key: 'delivered', label: 'Delivered', tone: 'bg-emerald-500/10 text-emerald-400',num:'text-emerald-400' },
  { key: 'cancelled', label: 'Cancelled', tone: 'bg-rose-500/10    text-rose-400',  num: 'text-rose-400' },
];

export default function DealerPerformance() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (token) {
      fetchPerformance();
    }
  }, [token, period]);

  const fetchPerformance = async () => {
    try {
      const response = await axios.get(`${API}/dealer/performance?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load performance data');
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
      <DashboardLayout title="Performance Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const tier       = data?.tier?.current_tier || 'silver';
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.silver;
  const TierIcon   = tierConfig.Icon;

  return (
    <DashboardLayout title="Performance Dashboard">
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
              Dealer Portal
            </p>
            <h1 className="text-2xl font-bold text-foreground">Performance Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Track your business growth and achievements</p>
          </div>

          {/* Tier badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${tierConfig.iconTile}`}>
            <TierIcon className="w-5 h-5" />
            <span className="font-semibold text-sm">{tierConfig.label} Partner</span>
          </div>
        </div>

        {/* ── Period tabs ──────────────────────────────────────────── */}
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="year">This Year</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ── Tier progress panel ──────────────────────────────────── */}
        {data?.tier && (
          <div className="mg-card rounded-lg border border-border bg-card p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tier badge column */}
              <div className="flex flex-col items-center justify-center gap-2">
                <div className={`flex h-20 w-20 items-center justify-center rounded-full ${tierConfig.iconTile}`}>
                  <TierIcon className="w-10 h-10" />
                </div>
                <p className="text-foreground font-bold text-lg">{tierConfig.label} Tier</p>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Current Status
                </p>
              </div>

              {/* Progress column */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Lifetime Purchase Value
                    </span>
                    <span className="font-mono font-bold tabular-nums text-foreground">
                      {formatCurrency(data.tier.total_purchase_value)}
                    </span>
                  </div>
                  <TierProgress value={data.tier.progress_to_next} />
                </div>

                {data.tier.next_tier ? (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-sm">
                      <span className="text-foreground font-semibold">
                        {formatCurrency(data.tier.remaining_to_next)}
                      </span>{' '}
                      more to reach{' '}
                      <span className={TIER_CONFIG[data.tier.next_tier]?.iconTile.split(' ')[1] || 'text-foreground'}>
                        {TIER_CONFIG[data.tier.next_tier]?.label}
                      </span>{' '}
                      tier
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground mt-1">
                      Gold: ₹5L+ | Platinum: ₹15L+
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-violet-400/10 rounded-lg border border-violet-400/25">
                    <p className="text-violet-400 font-semibold text-sm">Congratulations! You're a Platinum Partner!</p>
                    <p className="text-muted-foreground text-xs mt-0.5">You've achieved the highest tier level.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── KPI tiles ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile Icon={Package}     label="Total Orders"   value={data?.total_orders || 0}        tone="sky" />
          <StatTile Icon={IndianRupee} label="Total Value"    value={formatCurrency(data?.total_value)} tone="emerald" />
          <StatTile Icon={TrendingUp}  label="Avg Order Value"value={formatCurrency(data?.avg_order_value)} tone="indigo" />
          <StatTile Icon={Calendar}    label="Delivered"      value={data?.orders_by_status?.delivered || 0} tone="violet" />
        </div>

        {/* ── Order status breakdown ───────────────────────────────── */}
        <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-foreground font-semibold">Order Status Breakdown</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-border">
            {ORDER_STATUS_TILES.map(({ key, label, tone, num }) => (
              <div key={key} className={`p-4 text-center ${tone}`}>
                <p className={`font-mono text-2xl font-bold tabular-nums ${num}`}>
                  {data?.orders_by_status?.[key] || 0}
                </p>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-1">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Monthly trend ────────────────────────────────────────── */}
        {data?.monthly_trend?.length > 0 && (
          <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-foreground font-semibold">Monthly Trend — Last 6 Months</p>
            </div>
            <div className="p-5 space-y-4">
              {data.monthly_trend.map((month, idx) => {
                const prevMonth = data.monthly_trend[idx - 1];
                const change = prevMonth
                  ? ((month.value - prevMonth.value) / prevMonth.value * 100).toFixed(1)
                  : 0;
                const maxVal = Math.max(...data.monthly_trend.map(m => m.value));
                const barPct = maxVal > 0 ? Math.min(100, (month.value / maxVal) * 100) : 0;

                return (
                  <div key={month._id} className="flex items-center gap-4">
                    <div className="w-16 font-mono text-[11px] font-semibold text-muted-foreground flex-shrink-0">
                      {month._id}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-foreground font-medium text-sm">{month.count} orders</span>
                        <span className="text-muted-foreground text-xs">·</span>
                        <span className="font-mono font-semibold text-emerald-400 text-sm tabular-nums">
                          {formatCurrency(month.value)}
                        </span>
                        {prevMonth && change !== 0 && <ChangeBadge change={change} />}
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Lifetime stats banner ────────────────────────────────── */}
        <div className="mg-card rounded-lg border border-primary/25 bg-primary/5 p-6">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-4">
            Lifetime Statistics
          </p>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-muted-foreground text-sm">Total Orders</p>
              <p className="font-mono text-3xl font-bold tabular-nums text-foreground mt-1">
                {data?.lifetime?.total_orders || 0}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Total Business Value</p>
              <p className="font-mono text-3xl font-bold tabular-nums text-foreground mt-1">
                {formatCurrency(data?.lifetime?.total_value)}
              </p>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}

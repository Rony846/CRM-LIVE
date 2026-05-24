import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Target, Loader2, TrendingUp, TrendingDown, Calendar, Award,
  IndianRupee, Package, CheckCircle2, AlertCircle, ArrowRight,
  Trophy, Star, Flame, ChevronRight
} from 'lucide-react';

// ── Status tones ─────────────────────────────────────────────────────────────
const BADGE_BASE = 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap';

function getStatusCfg(pct) {
  if (pct >= 100) return { label: 'Achieved!',        badge: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25', Icon: Trophy };
  if (pct >= 75)  return { label: 'On Track',         badge: 'bg-sky-400/15     text-sky-400     ring-sky-400/25',     Icon: TrendingUp };
  if (pct >= 50)  return { label: 'Needs Attention',  badge: 'bg-amber-400/15   text-amber-400   ring-amber-400/25',   Icon: AlertCircle };
  return            { label: 'Behind Target',        badge: 'bg-rose-500/15    text-rose-400    ring-rose-500/25',    Icon: TrendingDown };
}

function StatusBadge({ pct }) {
  const { label, badge, Icon } = getStatusCfg(pct);
  return (
    <span className={`${BADGE_BASE} ${badge}`}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </span>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function TargetProgress({ value, size = 'md' }) {
  const pct = Math.min(value, 100);
  const filled = pct >= 100 ? 'bg-emerald-400' : 'bg-primary';
  const h = size === 'lg' ? 'h-3' : 'h-2';
  return (
    <div className={`w-full ${h} rounded-full bg-muted overflow-hidden`}>
      <div
        className={`${h} rounded-full ${filled} transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function DealerTargets() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (token) {
      fetchTargets();
    }
  }, [token]);

  const fetchTargets = async () => {
    try {
      const response = await axios.get(`${API}/dealer/targets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch targets:', error);
      toast.error('Failed to load targets');
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
      <DashboardLayout title="Sales Targets">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const currentTarget  = data?.current_target;
  const quarterlyTarget = data?.quarterly_target;
  const yearlyTarget   = data?.yearly_target;
  const achievements   = data?.achievements || [];
  const incentives     = data?.incentives || [];

  return (
    <DashboardLayout title="Sales Targets">
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
              Dealer Portal
            </p>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" />
              Sales Targets
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Track your performance and unlock incentives</p>
          </div>
        </div>

        {/* ── Current Month Target ─────────────────────────────────── */}
        {currentTarget && (
          <div className="mg-card rounded-lg border border-border bg-card p-6">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-foreground font-bold text-lg">{currentTarget.month} Target</span>
                  <StatusBadge pct={currentTarget.percentage} />
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Progress
                    </span>
                    <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                      {currentTarget.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <TargetProgress value={currentTarget.percentage} size="lg" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Target',    value: formatCurrency(currentTarget.target_amount),   cls: 'text-foreground' },
                    { label: 'Achieved',  value: formatCurrency(currentTarget.achieved_amount),  cls: 'text-emerald-400' },
                    { label: 'Remaining', value: formatCurrency(currentTarget.remaining),        cls: 'text-amber-400' },
                  ].map(({ label, value, cls }) => (
                    <div key={label}>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className={`font-mono text-base font-bold tabular-nums mt-0.5 ${cls}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:border-l lg:border-border lg:pl-6 flex-shrink-0">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Days Remaining
                </p>
                <div className="font-mono text-5xl font-bold tabular-nums text-primary">{currentTarget.days_remaining}</div>
                <p className="text-muted-foreground text-sm">days left</p>

                {currentTarget.daily_required > 0 && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Daily target to hit goal
                    </p>
                    <p className="text-foreground font-bold font-mono tabular-nums mt-0.5">
                      {formatCurrency(currentTarget.daily_required)}/day
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Quarterly & Yearly ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {quarterlyTarget && (
            <div className="mg-card rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-orange-400/15 text-orange-400">
                  <Flame className="w-4 h-4" />
                </div>
                <span className="text-foreground font-semibold">{quarterlyTarget.quarter} Target</span>
              </div>

              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Target</p>
                  <p className="font-mono text-xl font-bold tabular-nums text-foreground mt-0.5">
                    {formatCurrency(quarterlyTarget.target_amount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Achieved</p>
                  <p className="font-mono text-xl font-bold tabular-nums text-emerald-400 mt-0.5">
                    {formatCurrency(quarterlyTarget.achieved_amount)}
                  </p>
                </div>
              </div>

              <div className="mb-2 flex justify-between text-xs">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Progress</span>
                <span className={`font-mono font-bold tabular-nums ${quarterlyTarget.percentage >= 100 ? 'text-emerald-400' : 'text-foreground'}`}>
                  {quarterlyTarget.percentage.toFixed(1)}%
                </span>
              </div>
              <TargetProgress value={quarterlyTarget.percentage} />

              {quarterlyTarget.incentive_earned > 0 && (
                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-lg">
                  <p className="text-emerald-400 text-sm flex items-center gap-1">
                    <Award className="w-4 h-4" />
                    Incentive Earned: {formatCurrency(quarterlyTarget.incentive_earned)}
                  </p>
                </div>
              )}
            </div>
          )}

          {yearlyTarget && (
            <div className="mg-card rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-400/15 text-amber-400">
                  <Trophy className="w-4 h-4" />
                </div>
                <span className="text-foreground font-semibold">FY {yearlyTarget.year} Target</span>
              </div>

              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Target</p>
                  <p className="font-mono text-xl font-bold tabular-nums text-foreground mt-0.5">
                    {formatCurrency(yearlyTarget.target_amount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Achieved</p>
                  <p className="font-mono text-xl font-bold tabular-nums text-emerald-400 mt-0.5">
                    {formatCurrency(yearlyTarget.achieved_amount)}
                  </p>
                </div>
              </div>

              <div className="mb-2 flex justify-between text-xs">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Progress</span>
                <span className={`font-mono font-bold tabular-nums ${yearlyTarget.percentage >= 100 ? 'text-emerald-400' : 'text-foreground'}`}>
                  {yearlyTarget.percentage.toFixed(1)}%
                </span>
              </div>
              <TargetProgress value={yearlyTarget.percentage} />

              <p className="text-muted-foreground text-sm mt-3">
                {yearlyTarget.months_remaining} months remaining
              </p>
            </div>
          )}
        </div>

        {/* ── Incentive Slabs ──────────────────────────────────────── */}
        {incentives.length > 0 && (
          <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-400/15 text-amber-400">
                <Star className="w-4 h-4" />
              </div>
              <span className="text-foreground font-semibold">Incentive Slabs</span>
            </div>
            <div className="divide-y divide-border">
              {incentives.map((slab, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-4 ${
                    slab.achieved ? 'bg-emerald-500/[0.06]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {slab.achieved ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-border flex-shrink-0" />
                    )}
                    <div>
                      <p className={`font-medium text-sm ${slab.achieved ? 'text-emerald-400' : 'text-foreground'}`}>
                        {slab.name}
                      </p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        Achieve {formatCurrency(slab.threshold)} in {slab.period}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-mono font-bold tabular-nums text-sm ${slab.achieved ? 'text-emerald-400' : 'text-primary'}`}>
                      {slab.type === 'percentage' ? `${slab.value}% bonus` : formatCurrency(slab.value)}
                    </p>
                    {slab.achieved && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 bg-emerald-500/15 text-emerald-400 ring-emerald-500/25 mt-1">
                        Unlocked
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent Achievements ──────────────────────────────────── */}
        {achievements.length > 0 && (
          <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-violet-400/15 text-violet-400">
                <Award className="w-4 h-4" />
              </div>
              <span className="text-foreground font-semibold">Recent Achievements</span>
            </div>
            <div className="divide-y divide-border">
              {achievements.map((achievement, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-violet-400/15 text-violet-400">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium text-sm">{achievement.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{achievement.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono font-bold tabular-nums text-emerald-400 text-sm">
                      {formatCurrency(achievement.reward)}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                      {new Date(achievement.achieved_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── No Targets State ─────────────────────────────────────── */}
        {!currentTarget && !quarterlyTarget && !yearlyTarget && (
          <div className="mg-card rounded-lg border border-border bg-card p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded bg-muted mx-auto mb-4">
              <Target className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Targets Set</h3>
            <p className="text-muted-foreground text-sm">
              Your sales targets will appear here once they are assigned by the admin.
            </p>
          </div>
        )}

        {/* ── CTA banner ───────────────────────────────────────────── */}
        <div className="mg-card rounded-lg border border-primary/25 bg-primary/5 p-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-foreground font-semibold">Ready to achieve your targets?</p>
              <p className="text-muted-foreground text-sm">Browse our catalogue and place your orders now</p>
            </div>
            <Link to="/dealer/orders/new">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Package className="w-4 h-4 mr-2" />
                Place Order
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}

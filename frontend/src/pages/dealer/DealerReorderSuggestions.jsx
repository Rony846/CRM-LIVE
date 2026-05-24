import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  RefreshCw, Loader2, ShoppingCart, TrendingUp, Package, Calendar,
  AlertCircle, Clock, ChevronRight, Sparkles, ArrowRight, BarChart3
} from 'lucide-react';

// ── Priority chip map ─────────────────────────────────────────────────────────
const PRIORITY_CFG = {
  high:   { label: 'Restock Soon', badge: 'bg-rose-500/15   text-rose-400   ring-rose-500/25',   border: 'border-rose-500/25',   Icon: AlertCircle },
  medium: { label: 'Consider',     badge: 'bg-amber-400/15  text-amber-400  ring-amber-400/25',  border: 'border-amber-400/25',  Icon: Clock },
  low:    { label: 'Suggested',    badge: 'bg-primary/15    text-primary    ring-primary/25',     border: 'border-border',        Icon: Sparkles },
};

const BADGE_BASE = 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap';

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.low;
  const { Icon } = cfg;
  return (
    <span className={`${BADGE_BASE} ${cfg.badge}`}>
      <Icon className="w-3 h-3 mr-1" />
      {cfg.label}
    </span>
  );
}

// ── Stat tiles ────────────────────────────────────────────────────────────────
const STAT_TONES = {
  sky:    'bg-sky-400/15     text-sky-400',
  rose:   'bg-rose-500/15    text-rose-400',
  indigo: 'bg-primary/15     text-primary',
  emerald:'bg-emerald-500/15 text-emerald-400',
};

function StatTile({ label, value, tone, Icon }) {
  return (
    <div className="mg-card rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{label}</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">{value}</p>
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${STAT_TONES[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function DealerReorderSuggestions() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (token) {
      fetchSuggestions();
    }
  }, [token]);

  const fetchSuggestions = async () => {
    try {
      const response = await axios.get(`${API}/dealer/reorder-suggestions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuggestions(response.data.suggestions || []);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      toast.error('Failed to load reorder suggestions');
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
      <DashboardLayout title="Reorder Suggestions">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const highPriority  = suggestions.filter(s => s.priority === 'high');
  const otherSuggestions = suggestions.filter(s => s.priority !== 'high');

  return (
    <DashboardLayout title="Reorder Suggestions">
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
              Dealer Portal
            </p>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Smart Reorder Suggestions
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              AI-powered recommendations based on your purchase history
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchSuggestions}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* ── Stats ───────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Total Suggestions"     value={stats.total_suggestions}       tone="sky"     Icon={Sparkles} />
            <StatTile label="High Priority"         value={stats.high_priority}            tone="rose"    Icon={AlertCircle} />
            <StatTile label="Products Ordered"      value={stats.unique_products_ordered}  tone="indigo"  Icon={Package} />
            <StatTile label="Suggested Value"       value={formatCurrency(stats.suggested_order_value)} tone="emerald" Icon={BarChart3} />
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────── */}
        {suggestions.length === 0 ? (
          <div className="mg-card rounded-lg border border-border bg-card p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded bg-muted mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Suggestions Yet</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
              Place a few orders and we'll analyze your purchase patterns to provide smart reorder suggestions
            </p>
            <Link to="/dealer/orders/new">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Place Your First Order
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* High priority section */}
            {highPriority.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Restock Soon
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {highPriority.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Regular suggestions section */}
            {otherSuggestions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Recommended for You
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {otherSuggestions.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CTA banner ───────────────────────────────────────────── */}
        {suggestions.length > 0 && (
          <div className="mg-card rounded-lg border border-primary/25 bg-primary/5 p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-foreground font-semibold">Ready to restock?</p>
                <p className="text-muted-foreground text-sm">
                  Total suggested order value: {formatCurrency(stats?.suggested_order_value || 0)}
                </p>
              </div>
              <Link to="/dealer/orders/new">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Place Order Now
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

// ── Suggestion card (sub-component) ──────────────────────────────────────────
function SuggestionCard({ suggestion, formatCurrency }) {
  const cfg = PRIORITY_CFG[suggestion.priority] || PRIORITY_CFG.low;

  return (
    <div className={`mg-card rounded-lg border bg-card p-4 hover:border-primary/40 transition-colors ${cfg.border}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-foreground font-semibold text-sm line-clamp-1">{suggestion.product_name}</h3>
          <p className="font-mono text-[11px] text-muted-foreground mt-0.5">{suggestion.sku}</p>
        </div>
        <PriorityBadge priority={suggestion.priority} />
      </div>

      <div className="space-y-2">
        {[
          { label: 'Last Ordered',     value: suggestion.last_order_date,                       valCls: 'text-foreground' },
          { label: 'Typical Qty',      value: `${suggestion.typical_quantity} units`,            valCls: 'text-foreground' },
          { label: 'Order Frequency',  value: `Every ${suggestion.avg_days_between_orders} days`,valCls: 'text-foreground' },
          { label: 'Suggested Qty',    value: `${suggestion.suggested_quantity} units`,          valCls: 'text-primary font-bold' },
        ].map(({ label, value, valCls }) => (
          <div key={label} className="flex justify-between items-baseline gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex-shrink-0">
              {label}
            </span>
            <span className={`font-mono text-xs tabular-nums text-right ${valCls}`}>{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Suggested Value
        </span>
        <span className="font-mono font-bold tabular-nums text-emerald-400 text-sm">
          {formatCurrency(suggestion.suggested_value)}
        </span>
      </div>

      {suggestion.reason && (
        <p className="text-muted-foreground text-[11px] mt-2 italic leading-snug">
          "{suggestion.reason}"
        </p>
      )}
    </div>
  );
}

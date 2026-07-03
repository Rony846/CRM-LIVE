import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Link } from 'react-router-dom';
import { Loader2, ShoppingCart, Package, AlertCircle, Clock, Sparkles, ArrowRight, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

// ── Priority chip map ─────────────────────────────────────────────────────────
const PRIORITY_CFG = {
  high:   { label: 'Restock Soon', tone: 'bad',    border: T.orange,  Icon: AlertCircle },
  medium: { label: 'Consider',     tone: 'warn',   border: '#EDDFA6', Icon: Clock },
  low:    { label: 'Suggested',    tone: 'info',   border: T.iron200, Icon: Sparkles },
};

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.low;
  const { Icon } = cfg;
  return (
    <span style={{ ...badgeStyle(cfg.tone), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
const STAT_TONES = {
  sky:     { bg: T.blueTint,    fg: T.blue },
  rose:    { bg: '#FDEEE6',     fg: T.orangeDeep },
  indigo:  { bg: '#EEE9F7',     fg: '#6D4AB0' },
  emerald: { bg: T.greenTint,   fg: T.green },
};

function StatTile({ label, value, tone, Icon }) {
  const c = STAT_TONES[tone] || STAT_TONES.sky;
  return (
    <IronCard pad={14}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <Caps size={9.5} color={T.iron400}>{label}</Caps>
          <div style={{ ...mono, marginTop: 6, fontSize: 24, fontWeight: 800, color: T.iron900 }}>{value}</div>
        </div>
        <div style={{ height: 40, width: 40, flex: 'none', borderRadius: 8, background: c.bg, color: c.fg, display: 'grid', placeItems: 'center' }}>
          <Icon size={20} />
        </div>
      </div>
    </IronCard>
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

  const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none' };

  if (loading) {
    return (
      <IronShell title="Reorder Suggestions" subtitle="DEALER PORTAL" onRefresh={fetchSuggestions}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
          <Loader2 size={32} className="animate-spin" color={T.orange} />
        </div>
      </IronShell>
    );
  }

  const highPriority = suggestions.filter(s => s.priority === 'high');
  const otherSuggestions = suggestions.filter(s => s.priority !== 'high');

  return (
    <IronShell
      title="Reorder Suggestions"
      subtitle="SMART REORDER · PURCHASE HISTORY"
      onRefresh={fetchSuggestions}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <Caps size={9.5} color={T.iron400}>Dealer Portal</Caps>
            <h1 style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900, display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 2px' }}>
              <Sparkles size={22} color={T.orange} />
              Smart Reorder Suggestions
            </h1>
            <div style={{ fontSize: 13, color: T.iron500 }}>
              AI-powered recommendations based on your purchase history
            </div>
          </div>
        </div>

        {/* ── Stats ───────────────────────────────────────────────── */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <StatTile label="Total Suggestions"  value={stats.total_suggestions}                     tone="sky"     Icon={Sparkles} />
            <StatTile label="High Priority"      value={stats.high_priority}                         tone="rose"    Icon={AlertCircle} />
            <StatTile label="Products Ordered"   value={stats.unique_products_ordered}               tone="indigo"  Icon={Package} />
            <StatTile label="Suggested Value"    value={formatCurrency(stats.suggested_order_value)} tone="emerald" Icon={BarChart3} />
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────── */}
        {suggestions.length === 0 ? (
          <IronCard pad={0} style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ height: 64, width: 64, borderRadius: 10, background: T.iron100, margin: '0 auto 16px', display: 'grid', placeItems: 'center' }}>
              <Sparkles size={32} color={T.iron400} />
            </div>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 18, color: T.iron900, marginBottom: 8 }}>No Suggestions Yet</div>
            <div style={{ fontSize: 13, color: T.iron500, marginBottom: 16, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
              Place a few orders and we'll analyze your purchase patterns to provide smart reorder suggestions
            </div>
            <Link to="/dealer/orders/new" style={primaryBtn}>
              <ShoppingCart size={16} />
              Place Your First Order
            </Link>
          </IronCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* High priority section */}
            {highPriority.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <AlertCircle size={15} color={T.orangeDeep} />
                  <Caps size={10} color={T.iron500}>Restock Soon</Caps>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {highPriority.map((suggestion) => (
                    <SuggestionCard key={suggestion.id} suggestion={suggestion} formatCurrency={formatCurrency} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular suggestions section */}
            {otherSuggestions.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Sparkles size={15} color={T.orange} />
                  <Caps size={10} color={T.iron500}>Recommended for You</Caps>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {otherSuggestions.map((suggestion) => (
                    <SuggestionCard key={suggestion.id} suggestion={suggestion} formatCurrency={formatCurrency} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CTA banner ───────────────────────────────────────────── */}
        {suggestions.length > 0 && (
          <IronCard pad={16} style={{ border: `1px solid ${T.orange}`, background: '#FEF6EE' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>Ready to restock?</div>
                <div style={{ fontSize: 13, color: T.iron500 }}>
                  Total suggested order value: <span style={mono}>{formatCurrency(stats?.suggested_order_value || 0)}</span>
                </div>
              </div>
              <Link to="/dealer/orders/new" style={primaryBtn}>
                <ShoppingCart size={16} />
                Place Order Now
                <ArrowRight size={16} />
              </Link>
            </div>
          </IronCard>
        )}

      </div>
    </IronShell>
  );
}

// ── Suggestion card (sub-component) ──────────────────────────────────────────
function SuggestionCard({ suggestion, formatCurrency }) {
  const cfg = PRIORITY_CFG[suggestion.priority] || PRIORITY_CFG.low;

  const rows = [
    { label: 'Last Ordered',    value: suggestion.last_order_date,                          strong: false },
    { label: 'Typical Qty',     value: `${suggestion.typical_quantity} units`,              strong: false },
    { label: 'Order Frequency', value: `Every ${suggestion.avg_days_between_orders} days`,  strong: false },
    { label: 'Suggested Qty',   value: `${suggestion.suggested_quantity} units`,            strong: true },
  ];

  return (
    <IronCard pad={14} style={{ borderColor: cfg.border }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{suggestion.product_name}</div>
          <div style={{ ...mono, fontSize: 11, color: T.iron400, marginTop: 2 }}>{suggestion.sku}</div>
        </div>
        <PriorityBadge priority={suggestion.priority} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rows.map(({ label, value, strong }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <Caps size={9} color={T.iron400}>{label}</Caps>
            <span style={{ ...mono, fontSize: 12, textAlign: 'right', color: strong ? T.orange : T.iron700, fontWeight: strong ? 800 : 500 }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Caps size={9} color={T.iron400}>Suggested Value</Caps>
        <span style={{ ...mono, fontWeight: 800, fontSize: 13, color: T.green }}>{formatCurrency(suggestion.suggested_value)}</span>
      </div>

      {suggestion.reason && (
        <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 8, fontStyle: 'italic', lineHeight: 1.4 }}>
          "{suggestion.reason}"
        </div>
      )}
    </IronCard>
  );
}

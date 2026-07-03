import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';
import {
  TrendingUp, Package, IndianRupee, Calendar,
  Loader2, Award, Crown, Star, ArrowUp, ArrowDown,
} from 'lucide-react';

/* Dealer Performance — Iron Console redesign.
   Preserves 100% behaviour: single GET /dealer/performance?period=<period> (Bearer),
   period tabs (month/year/all), tier progress, KPI tiles, order-status breakdown,
   monthly-trend bars w/ change badges, lifetime banner. */

// Tier config -> icon + Iron tones (tint bg / fg / label)
const TIER_CONFIG = {
  silver:   { label: 'Silver',   Icon: Star,  bg: T.iron100,    fg: T.iron700,      border: T.iron200 },
  gold:     { label: 'Gold',     Icon: Award, bg: T.voltageTint, fg: T.voltageText, border: '#EDDFA6' },
  platinum: { label: 'Platinum', Icon: Crown, bg: '#EEE9F7',    fg: '#6D4AB0',      border: '#DDD3EF' },
};

const STAT_TONES = {
  sky:     { bg: T.blueTint,    fg: T.blue },
  emerald: { bg: T.greenTint,   fg: T.green },
  indigo:  { bg: '#FDEEE6',     fg: T.orangeDeep },
  violet:  { bg: '#EEE9F7',     fg: '#6D4AB0' },
};

const ORDER_STATUS_TILES = [
  { key: 'pending',    label: 'Pending',    fg: T.voltageText },
  { key: 'confirmed',  label: 'Confirmed',  fg: T.blue },
  { key: 'dispatched', label: 'Dispatched', fg: T.orange },
  { key: 'delivered',  label: 'Delivered',  fg: T.green },
  { key: 'cancelled',  label: 'Cancelled',  fg: T.orangeDeep },
];

const PERIODS = [['month', 'This Month'], ['year', 'This Year'], ['all', 'All Time']];

function StatTile({ Icon, label, value, tone = 'indigo' }) {
  const c = STAT_TONES[tone] || STAT_TONES.indigo;
  return (
    <IronCard pad={14}>
      <div style={{ width: 40, height: 40, borderRadius: 8, display: 'grid', placeItems: 'center', background: c.bg, color: c.fg, marginBottom: 12 }}>
        <Icon size={20} strokeWidth={1.9} />
      </div>
      <div style={{ ...mono, fontWeight: 700, fontSize: 24, color: T.iron900, lineHeight: 1 }}>{value}</div>
      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 6 }}>{label}</Caps>
    </IronCard>
  );
}

function ChangeBadge({ change }) {
  if (!change || Number(change) === 0) return null;
  const up = Number(change) > 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', borderRadius: 999,
      background: up ? T.greenTint : '#FDEEE6', color: up ? T.green : T.orangeDeep, border: `1px solid ${up ? '#CBE5D6' : '#F6D8BA'}`,
      fontFamily: T.headline, fontWeight: 700, fontSize: 9.5, letterSpacing: '.04em' }}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {Math.abs(change)}%
    </span>
  );
}

export default function DealerPerformance() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);

  const fetchPerformance = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/dealer/performance?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    if (token) fetchPerformance();
  }, [token, period, fetchPerformance]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

  const tier = data?.tier?.current_tier || 'silver';
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.silver;
  const TierIcon = tierConfig.Icon;

  const headerRight = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999,
      background: tierConfig.bg, color: tierConfig.fg, border: `1px solid ${tierConfig.border}` }}>
      <TierIcon size={16} strokeWidth={1.9} />
      <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>{tierConfig.label} Partner</span>
    </div>
  );

  return (
    <IronShell title="Performance" subtitle="DEALER PORTAL · BUSINESS GROWTH" onRefresh={fetchPerformance} headerRight={headerRight}>
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Period tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PERIODS.map(([id, label]) => {
              const on = period === id;
              return (
                <button key={id} onClick={() => setPeriod(id)}
                  style={{ border: `1px solid ${on ? T.iron900 : T.iron200}`, background: on ? T.iron900 : T.white,
                    color: on ? '#fff' : T.iron700, borderRadius: 999, padding: '6px 16px', cursor: 'pointer',
                    fontFamily: T.headline, fontWeight: 600, fontSize: 12 }}>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tier progress panel */}
          {data?.tier && (
            <IronCard pad={22}>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'center' }}>
                {/* Tier badge column */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 80, height: 80, borderRadius: 999, display: 'grid', placeItems: 'center',
                    background: tierConfig.bg, color: tierConfig.fg, border: `1px solid ${tierConfig.border}` }}>
                    <TierIcon size={40} strokeWidth={1.6} />
                  </div>
                  <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 18, color: T.iron900 }}>{tierConfig.label} Tier</div>
                  <Caps size={9} color={T.iron400}>Current Status</Caps>
                </div>

                {/* Progress column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                      <Caps size={9.5} color={T.iron500}>Lifetime Purchase Value</Caps>
                      <span style={{ ...mono, fontWeight: 700, fontSize: 14, color: T.iron900 }}>{formatCurrency(data.tier.total_purchase_value)}</span>
                    </div>
                    <div style={{ width: '100%', height: 10, borderRadius: 999, background: T.iron100, overflow: 'hidden' }}>
                      <div style={{ height: 10, borderRadius: 999, background: T.orange, transition: 'width .5s',
                        width: `${Math.min(data.tier.progress_to_next || 0, 100)}%` }} />
                    </div>
                  </div>

                  {data.tier.next_tier ? (
                    <div style={{ padding: 14, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 13, color: T.iron500 }}>
                        <span style={{ color: T.iron900, fontWeight: 700 }}>{formatCurrency(data.tier.remaining_to_next)}</span>{' '}
                        more to reach{' '}
                        <span style={{ color: (TIER_CONFIG[data.tier.next_tier]?.fg) || T.iron900, fontWeight: 700 }}>
                          {TIER_CONFIG[data.tier.next_tier]?.label}
                        </span>{' '}
                        tier
                      </p>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 6 }}>Gold: ₹5L+ · Platinum: ₹15L+</Caps>
                    </div>
                  ) : (
                    <div style={{ padding: 14, background: '#EEE9F7', border: '1px solid #DDD3EF', borderRadius: 8 }}>
                      <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: '#6D4AB0' }}>Congratulations! You're a Platinum Partner!</div>
                      <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 3 }}>You've achieved the highest tier level.</div>
                    </div>
                  )}
                </div>
              </div>
            </IronCard>
          )}

          {/* KPI tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <StatTile Icon={Package}     label="Total Orders"    value={data?.total_orders || 0}                 tone="sky" />
            <StatTile Icon={IndianRupee} label="Total Value"     value={formatCurrency(data?.total_value)}       tone="emerald" />
            <StatTile Icon={TrendingUp}  label="Avg Order Value" value={formatCurrency(data?.avg_order_value)}   tone="indigo" />
            <StatTile Icon={Calendar}    label="Delivered"       value={data?.orders_by_status?.delivered || 0}  tone="violet" />
          </div>

          {/* Order status breakdown */}
          <IronCard pad={0}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
              <Caps size={11} color={T.iron900} ls=".1em">Order Status Breakdown</Caps>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }}>
              {ORDER_STATUS_TILES.map(({ key, label, fg }, i) => (
                <div key={key} style={{ padding: 18, textAlign: 'center', borderLeft: i === 0 ? 'none' : `1px solid ${T.iron200}` }}>
                  <div style={{ ...mono, fontWeight: 700, fontSize: 24, color: fg }}>{data?.orders_by_status?.[key] || 0}</div>
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 6 }}>{label}</Caps>
                </div>
              ))}
            </div>
          </IronCard>

          {/* Monthly trend */}
          {data?.monthly_trend?.length > 0 && (
            <IronCard pad={0}>
              <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
                <Caps size={11} color={T.iron900} ls=".1em">Monthly Trend — Last 6 Months</Caps>
              </div>
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {data.monthly_trend.map((month, idx) => {
                  const prevMonth = data.monthly_trend[idx - 1];
                  const change = prevMonth ? ((month.value - prevMonth.value) / prevMonth.value * 100).toFixed(1) : 0;
                  const maxVal = Math.max(...data.monthly_trend.map((m) => m.value));
                  const barPct = maxVal > 0 ? Math.min(100, (month.value / maxVal) * 100) : 0;
                  return (
                    <div key={month._id} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 64, flexShrink: 0, ...mono, fontSize: 11, fontWeight: 600, color: T.iron500 }}>{month._id}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: T.iron900 }}>{month.count} orders</span>
                          <span style={{ color: T.iron400, fontSize: 12 }}>·</span>
                          <span style={{ ...mono, fontWeight: 700, fontSize: 13, color: T.green }}>{formatCurrency(month.value)}</span>
                          {prevMonth && change !== 0 && <ChangeBadge change={change} />}
                        </div>
                        <div style={{ height: 6, background: T.iron100, borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: T.orange, borderRadius: 999, transition: 'width .5s', width: `${barPct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </IronCard>
          )}

          {/* Lifetime statistics banner */}
          <IronCard pad={22} style={{ background: '#FDEEE6', border: '1px solid #F6D8BA' }}>
            <Caps size={10} color={T.orangeDeep} ls=".07em" style={{ display: 'block', marginBottom: 16 }}>Lifetime Statistics</Caps>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 24 }}>
              <div>
                <div style={{ fontSize: 13, color: T.iron500 }}>Total Orders</div>
                <div style={{ ...mono, fontWeight: 700, fontSize: 30, color: T.iron900, marginTop: 4 }}>{data?.lifetime?.total_orders || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: T.iron500 }}>Total Business Value</div>
                <div style={{ ...mono, fontWeight: 700, fontSize: 30, color: T.iron900, marginTop: 4 }}>{formatCurrency(data?.lifetime?.total_value)}</div>
              </div>
            </div>
          </IronCard>

        </div>
      )}
    </IronShell>
  );
}

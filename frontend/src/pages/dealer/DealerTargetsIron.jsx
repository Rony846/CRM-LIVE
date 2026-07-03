import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';
import {
  Target, Loader2, TrendingUp, TrendingDown, Calendar, Award,
  Package, CheckCircle2, AlertCircle, Trophy, Star, Flame, ChevronRight,
} from 'lucide-react';

// ── Status tone (mirrors legacy getStatusCfg thresholds) ──────────────────────
function getStatusCfg(pct) {
  if (pct >= 100) return { label: 'Achieved!',       tone: 'ok',    Icon: Trophy };
  if (pct >= 75)  return { label: 'On Track',        tone: 'info',  Icon: TrendingUp };
  if (pct >= 50)  return { label: 'Needs Attention', tone: 'warn',  Icon: AlertCircle };
  return           { label: 'Behind Target',       tone: 'bad',   Icon: TrendingDown };
}

function StatusBadge({ pct }) {
  const { label, tone, Icon } = getStatusCfg(pct);
  return (
    <span style={{ ...badgeStyle(tone), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon size={11} />
      {label}
    </span>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function TargetProgress({ value, size = 'md' }) {
  const pct = Math.min(value, 100);
  const h = size === 'lg' ? 10 : 7;
  return (
    <div style={{ width: '100%', height: h, borderRadius: 999, background: T.iron100, overflow: 'hidden', border: `1px solid ${T.iron200}` }}>
      <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: pct >= 100 ? T.green : T.orange, transition: 'width .5s' }} />
    </div>
  );
}

const labelStyle = { fontFamily: T.headline, fontWeight: 700, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: T.iron400 };

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
        headers: { Authorization: `Bearer ${token}` },
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
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <IronShell title="Sales Targets" subtitle="DEALER / TARGETS">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
          <Loader2 className="animate-spin" style={{ width: 30, height: 30, color: T.orange }} />
        </div>
      </IronShell>
    );
  }

  const currentTarget   = data?.current_target;
  const quarterlyTarget = data?.quarterly_target;
  const yearlyTarget    = data?.yearly_target;
  const achievements    = data?.achievements || [];
  const incentives      = data?.incentives || [];

  return (
    <IronShell title="Sales Targets" subtitle="DEALER / TARGETS" onRefresh={fetchTargets}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1200 }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div>
          <Caps size={10} color={T.iron400}>Dealer Portal</Caps>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Target size={22} color={T.orange} />
            <h1 style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 24, color: T.iron900, margin: 0 }}>Sales Targets</h1>
          </div>
          <p style={{ color: T.iron500, fontSize: 13, margin: '4px 0 0' }}>Track your performance and unlock incentives</p>
        </div>

        {/* ── Current Month Target ─────────────────────────────────── */}
        {currentTarget && (
          <IronCard pad={22}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
              <div style={{ flex: '1 1 340px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <Calendar size={16} color={T.orange} />
                  <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 17, color: T.iron900 }}>{currentTarget.month} Target</span>
                  <StatusBadge pct={currentTarget.percentage} />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={labelStyle}>Progress</span>
                    <span style={{ ...mono, fontSize: 14, fontWeight: 700, color: T.iron900 }}>{currentTarget.percentage.toFixed(1)}%</span>
                  </div>
                  <TargetProgress value={currentTarget.percentage} size="lg" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {[
                    { label: 'Target',    value: formatCurrency(currentTarget.target_amount),   color: T.iron900 },
                    { label: 'Achieved',  value: formatCurrency(currentTarget.achieved_amount), color: T.green },
                    { label: 'Remaining', value: formatCurrency(currentTarget.remaining),       color: T.voltageText },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div style={labelStyle}>{label}</div>
                      <div style={{ ...mono, fontSize: 15, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flexShrink: 0, borderLeft: `1px solid ${T.iron200}`, paddingLeft: 24 }}>
                <div style={labelStyle}>Days Remaining</div>
                <div style={{ ...mono, fontSize: 46, fontWeight: 800, color: T.orange, lineHeight: 1.05 }}>{currentTarget.days_remaining}</div>
                <p style={{ color: T.iron500, fontSize: 13, margin: 0 }}>days left</p>

                {currentTarget.daily_required > 0 && (
                  <div style={{ marginTop: 16, padding: 12, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                    <div style={labelStyle}>Daily target to hit goal</div>
                    <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: T.iron900, marginTop: 2 }}>{formatCurrency(currentTarget.daily_required)}/day</div>
                  </div>
                )}
              </div>
            </div>
          </IronCard>
        )}

        {/* ── Quarterly & Yearly ───────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {quarterlyTarget && (
            <IronCard pad={20}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: '#FDEEE6', color: T.orangeDeep }}>
                  <Flame size={16} />
                </div>
                <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>{quarterlyTarget.quarter} Target</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                <div>
                  <div style={labelStyle}>Target</div>
                  <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.iron900, marginTop: 2 }}>{formatCurrency(quarterlyTarget.target_amount)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={labelStyle}>Achieved</div>
                  <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.green, marginTop: 2 }}>{formatCurrency(quarterlyTarget.achieved_amount)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={labelStyle}>Progress</span>
                <span style={{ ...mono, fontSize: 12.5, fontWeight: 700, color: quarterlyTarget.percentage >= 100 ? T.green : T.iron900 }}>{quarterlyTarget.percentage.toFixed(1)}%</span>
              </div>
              <TargetProgress value={quarterlyTarget.percentage} />

              {quarterlyTarget.incentive_earned > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: T.greenTint, border: `1px solid #CBE5D6`, borderRadius: 8 }}>
                  <span style={{ color: T.green, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Award size={15} />
                    Incentive Earned: {formatCurrency(quarterlyTarget.incentive_earned)}
                  </span>
                </div>
              )}
            </IronCard>
          )}

          {yearlyTarget && (
            <IronCard pad={20}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: T.voltageTint, color: T.voltageText }}>
                  <Trophy size={16} />
                </div>
                <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>FY {yearlyTarget.year} Target</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                <div>
                  <div style={labelStyle}>Target</div>
                  <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.iron900, marginTop: 2 }}>{formatCurrency(yearlyTarget.target_amount)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={labelStyle}>Achieved</div>
                  <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.green, marginTop: 2 }}>{formatCurrency(yearlyTarget.achieved_amount)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={labelStyle}>Progress</span>
                <span style={{ ...mono, fontSize: 12.5, fontWeight: 700, color: yearlyTarget.percentage >= 100 ? T.green : T.iron900 }}>{yearlyTarget.percentage.toFixed(1)}%</span>
              </div>
              <TargetProgress value={yearlyTarget.percentage} />

              <p style={{ color: T.iron500, fontSize: 13, marginTop: 12, marginBottom: 0 }}>{yearlyTarget.months_remaining} months remaining</p>
            </IronCard>
          )}
        </div>

        {/* ── Incentive Slabs ──────────────────────────────────────── */}
        {incentives.length > 0 && (
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <div style={{ display: 'flex', height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: T.voltageTint, color: T.voltageText }}>
                <Star size={16} />
              </div>
              <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>Incentive Slabs</span>
            </div>
            <div>
              {incentives.map((slab, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16,
                    borderTop: idx === 0 ? 'none' : `1px solid ${T.iron200}`,
                    background: slab.achieved ? T.greenTint : T.white,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {slab.achieved ? (
                      <CheckCircle2 size={20} color={T.green} style={{ flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${T.iron200}`, flexShrink: 0 }} />
                    )}
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 13, color: slab.achieved ? T.green : T.iron900, margin: 0 }}>{slab.name}</p>
                      <p style={{ color: T.iron500, fontSize: 12, margin: '2px 0 0' }}>Achieve {formatCurrency(slab.threshold)} in {slab.period}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ ...mono, fontWeight: 700, fontSize: 13, color: slab.achieved ? T.green : T.orange, margin: 0 }}>
                      {slab.type === 'percentage' ? `${slab.value}% bonus` : formatCurrency(slab.value)}
                    </p>
                    {slab.achieved && (
                      <span style={{ ...badgeStyle('ok'), marginTop: 4 }}>Unlocked</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </IronCard>
        )}

        {/* ── Recent Achievements ──────────────────────────────────── */}
        {achievements.length > 0 && (
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <div style={{ display: 'flex', height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: '#EEE9F7', color: '#6D4AB0' }}>
                <Award size={16} />
              </div>
              <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>Recent Achievements</span>
            </div>
            <div>
              {achievements.map((achievement, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderTop: idx === 0 ? 'none' : `1px solid ${T.iron200}` }}>
                  <div style={{ display: 'flex', height: 40, width: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: '#EEE9F7', color: '#6D4AB0' }}>
                    <Trophy size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: T.iron900, fontWeight: 600, fontSize: 13, margin: 0 }}>{achievement.title}</p>
                    <p style={{ color: T.iron500, fontSize: 12, margin: '2px 0 0' }}>{achievement.description}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ ...mono, fontWeight: 700, color: T.green, fontSize: 13, margin: 0 }}>{formatCurrency(achievement.reward)}</p>
                    <p style={{ ...mono, fontSize: 10.5, color: T.iron400, margin: '2px 0 0' }}>{new Date(achievement.achieved_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </IronCard>
        )}

        {/* ── No Targets State ─────────────────────────────────────── */}
        {!currentTarget && !quarterlyTarget && !yearlyTarget && (
          <IronCard pad={48} style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', height: 64, width: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: T.iron100, margin: '0 auto 16px' }}>
              <Target size={32} color={T.iron400} />
            </div>
            <h3 style={{ fontFamily: T.headline, fontSize: 18, fontWeight: 700, color: T.iron900, margin: '0 0 8px' }}>No Targets Set</h3>
            <p style={{ color: T.iron500, fontSize: 13, margin: 0 }}>Your sales targets will appear here once they are assigned by the admin.</p>
          </IronCard>
        )}

        {/* ── CTA banner ───────────────────────────────────────────── */}
        <div style={{ border: `1px solid #F6D8BA`, background: '#FDEEE6', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ color: T.iron900, fontWeight: 700, fontSize: 14, margin: 0 }}>Ready to achieve your targets?</p>
              <p style={{ color: T.iron500, fontSize: 13, margin: '2px 0 0' }}>Browse our catalogue and place your orders now</p>
            </div>
            <Link to="/dealer/orders/new" style={{ textDecoration: 'none' }}>
              <button style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Package size={15} />
                Place Order
                <ChevronRight size={15} />
              </button>
            </Link>
          </div>
        </div>

      </div>
    </IronShell>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle, LIGHT_VARS } from '@/components/iron/IronKit';
import CustomerQuickLookup from '@/components/dealer/CustomerQuickLookup';
import {
  ShoppingCart, Package, Wallet, Ticket, TrendingUp, AlertTriangle,
  CheckCircle, Clock, ArrowRight, Loader2, Shield, Award, Crown, Star,
  Download, Truck, BarChart3, FileCheck, IndianRupee, FileText,
} from 'lucide-react';

/* Dealer Dashboard — MuscleGrid "Iron Console" redesign.
   Preserves the live /dealer/dashboard + /dealer/tier + /dealer/performance data,
   all quick-action nav, deposit banner, tier progress and recent orders. */

const TIER_CONFIG = {
  silver:   { label: 'Silver',   icon: Star,  accent: T.iron500,  tint: T.iron100,     border: T.iron200 },
  gold:     { label: 'Gold',     icon: Award, accent: T.voltageText, tint: T.voltageTint, border: '#EDDFA6' },
  platinum: { label: 'Platinum', icon: Crown, accent: '#6D4AB0',  tint: '#EEE9F7',     border: '#DDD3EF' },
};

// order status -> Iron pill tone
const STATUS_TONE = {
  pending: 'warn', confirmed: 'info', dispatched: 'bad', delivered: 'ok', cancelled: 'slate',
};

const fmtINR = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

const StatTile = ({ icon: Icon, label, value, accent }) => (
  <IronCard pad="13px 14px">
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <Caps size={8.5} color={T.iron400}>{label}</Caps>
        <div style={{ ...mono, fontWeight: 700, fontSize: 24, color: T.iron900, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
      </div>
      <div style={{ width: 38, height: 38, borderRadius: 8, background: (accent || T.orange) + '18', color: accent || T.orange, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon size={18} />
      </div>
    </div>
  </IronCard>
);

const NavCard = ({ to, icon: Icon, title, subtitle, accent, disabled }) => {
  const inner = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 14, boxShadow: '0 1px 2px rgba(15,15,15,.06)', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer', height: '100%' }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: (accent || T.orange) + '18', color: accent || T.orange, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon size={18} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 1 }}>{subtitle}</div>
      </div>
      <ArrowRight size={15} color={T.iron400} style={{ flexShrink: 0 }} />
    </div>
  );
  if (disabled) return <div>{inner}</div>;
  return <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link>;
};

const SectionHead = ({ title, to, linkLabel = 'View All', icon: Icon }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.iron200}`, padding: '13px 16px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {Icon && <Icon size={15} color={T.orange} />}
      <Caps size={11} color={T.iron900} ls=".1em">{title}</Caps>
    </div>
    {to && (
      <Link to={to} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Caps size={9} color={T.orange}>{linkLabel}</Caps>
        <ArrowRight size={13} color={T.orange} />
      </Link>
    )}
  </div>
);

export default function DealerDashboard() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [tierData, setTierData] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);

  const fetchDashboard = async () => {
    try {
      const [dashboardRes, tierRes, performanceRes] = await Promise.all([
        axios.get(`${API}/dealer/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/dealer/tier`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/dealer/performance?period=month`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setData(dashboardRes.data);
      setTierData(tierRes.data);
      setPerformanceData(performanceRes.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <IronShell title="Dealer Dashboard" subtitle="DEALER PORTAL">
        <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      </IronShell>
    );
  }

  const dealer = data?.dealer || {};
  const stats = data?.stats || {};
  const canOrder = data?.can_place_orders;
  const depositStatus = dealer.security_deposit_status || dealer.security_deposit?.status;
  const depositPending = depositStatus !== 'approved';

  const tier = tierData?.current_tier || 'silver';
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.silver;
  const TierIcon = tierConfig.icon;

  const statusApproved = dealer.status === 'approved';
  const depApproved = depositStatus === 'approved';

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ ...badgeStyle(statusApproved ? 'ok' : 'warn'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {statusApproved ? <CheckCircle size={11} /> : <Clock size={11} />}
        {statusApproved ? 'Active' : (dealer.status || 'Pending')}
      </span>
      <span style={{ ...badgeStyle(depApproved ? 'ok' : 'warn'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Shield size={11} /> Deposit: {depositStatus || '—'}
      </span>
    </div>
  );

  const subtitleParts = [dealer.city || dealer.address?.city, dealer.state || dealer.address?.state].filter(Boolean).join(', ');

  return (
    <IronShell title="Dealer Dashboard" subtitle="DEALER PORTAL · LIVE" onRefresh={fetchDashboard} headerRight={headerRight}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Firm identity */}
        <div>
          <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 28, lineHeight: 1.05, color: T.iron900 }}>
            {dealer.firm_name || 'Dealer Dashboard'}
          </div>
          {(subtitleParts || dealer.phone) && (
            <div style={{ fontSize: 13, color: T.iron500, marginTop: 4 }}>
              {subtitleParts}{dealer.phone ? `${subtitleParts ? ' · ' : ''}${dealer.phone}` : ''}
            </div>
          )}
        </div>

        {/* Customer Quick Lookup — "who's calling me?" (own /dealer/customers/lookup call) */}
        <div style={LIGHT_VARS}>
          <CustomerQuickLookup />
        </div>

        {/* Deposit Warning Banner */}
        {depositPending && (
          <div style={{ background: T.voltageTint, border: '1px solid #EDDFA6', borderLeft: `4px solid ${T.orange}`, borderRadius: 8, padding: '13px 16px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <AlertTriangle size={18} color={T.orangeDeep} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900 }}>Security Deposit Required</div>
                <div style={{ fontSize: 12.5, color: T.iron700, marginTop: 4 }}>
                  {depositStatus === 'not_paid' &&
                    `Please upload your security deposit proof of ₹${(dealer.security_deposit_amount || dealer.security_deposit?.amount || 100000)?.toLocaleString()} to activate your dealer account and start placing orders.`}
                  {(depositStatus === 'pending' || depositStatus === 'pending_review') &&
                    'Your security deposit proof is under review. We will notify you once approved.'}
                  {depositStatus === 'rejected' &&
                    `Your deposit proof was rejected: ${dealer.security_deposit_remarks || dealer.security_deposit?.remarks}. Please upload again.`}
                </div>
                {(depositStatus === 'not_paid' || depositStatus === 'rejected') && (
                  <Link to="/dealer/deposit" style={{ textDecoration: 'none' }}>
                    <button style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                      <Download size={13} style={{ transform: 'rotate(180deg)' }} /> Upload Deposit Proof
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tier Progress Card */}
        {tierData && (
          <IronCard pad="18px 18px">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: tierConfig.tint, border: `1px solid ${tierConfig.border}`, color: tierConfig.accent, display: 'grid', placeItems: 'center' }}>
                  <TierIcon size={22} />
                </div>
                <div>
                  <Caps size={9} color={T.iron400}>Current Tier</Caps>
                  <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 18, color: tierConfig.accent, marginTop: 2 }}>{tierConfig.label} Partner</div>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 220, padding: '0 4px' }}>
                {tierData.next_tier ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <Caps size={9} color={T.iron400}>Progress to {(TIER_CONFIG[tierData.next_tier] || {}).label}</Caps>
                      <span style={{ ...mono, fontWeight: 700, fontSize: 13, color: T.iron900 }}>{tierData.progress_to_next}%</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: T.iron100, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, tierData.progress_to_next || 0))}%`, background: T.orange, borderRadius: 999 }} />
                    </div>
                    <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 6 }}>
                      {fmtINR(tierData.remaining_to_next)} more to reach {(TIER_CONFIG[tierData.next_tier] || {}).label}
                    </div>
                  </>
                ) : (
                  <div>
                    <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: '#6D4AB0' }}>You've reached the highest tier!</div>
                    <div style={{ fontSize: 12, color: T.iron500, marginTop: 2 }}>Thank you for your partnership</div>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <Caps size={9} color={T.iron400}>Lifetime Purchases</Caps>
                <div style={{ ...mono, fontWeight: 700, fontSize: 20, color: T.iron900, marginTop: 4 }}>{fmtINR(tierData.total_purchase_value)}</div>
              </div>
            </div>
          </IronCard>
        )}

        {/* KPI Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatTile icon={ShoppingCart} label="Total Orders" value={stats.total_orders || 0} accent={T.blue} />
          <StatTile icon={Clock} label="Pending Orders" value={stats.pending_orders || 0} accent={T.voltageText} />
          <StatTile icon={Ticket} label="Open Tickets" value={stats.open_tickets || 0} accent={T.orange} />
          <StatTile icon={Wallet} label="Outstanding" value={fmtINR(stats.outstanding_balance)} accent={T.green} />
        </div>

        {/* Monthly Performance Summary */}
        {performanceData && (
          <IronCard pad={0}>
            <SectionHead title="This Month's Performance" to="/dealer/performance" linkLabel="View Details" icon={BarChart3} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {[
                { label: 'Orders', value: performanceData.total_orders, color: T.iron900 },
                { label: 'Total Value', value: fmtINR(performanceData.total_value), color: T.green },
                { label: 'Delivered', value: performanceData.orders_by_status?.delivered || 0, color: T.blue },
                { label: 'Avg. Order', value: fmtINR(performanceData.avg_order_value), color: T.orange },
              ].map(({ label, value, color }, i) => (
                <div key={label} style={{ padding: 16, textAlign: 'center', borderLeft: i === 0 ? 'none' : `1px solid ${T.iron200}` }}>
                  <div style={{ ...mono, fontWeight: 700, fontSize: 20, color }}>{value}</div>
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{label}</Caps>
                </div>
              ))}
            </div>
          </IronCard>
        )}

        {/* Quick Actions */}
        <div>
          <Caps size={11} color={T.iron400} ls=".1em" style={{ display: 'block', marginBottom: 10 }}>Quick Actions</Caps>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <NavCard to="/dealer/orders/new" icon={ShoppingCart} accent={T.orange} title="Place Order" subtitle={canOrder ? 'Browse products' : 'Deposit required'} disabled={!canOrder} />
            <NavCard to="/dealer/dispatches" icon={Truck} accent={T.blue} title="Track Dispatches" subtitle="AWB & delivery status" />
            <NavCard to="/dealer/ledger" icon={IndianRupee} accent={T.green} title="Ledger" subtitle="Payments & balance" />
            <NavCard to="/dealer/documents" icon={Download} accent="#6D4AB0" title="Downloads" subtitle="Invoices & documents" />

            <NavCard to="/dealer/catalogue" icon={Package} accent={T.orange} title="Product Catalogue" subtitle="Browse & check stock" />
            <NavCard to="/dealer/targets" icon={TrendingUp} accent={T.voltageText} title="Sales Targets" subtitle="Track & earn incentives" />
            <NavCard to="/dealer/warranty" icon={Shield} accent={T.orangeDeep} title="Warranty" subtitle="Register warranties" />
            <NavCard to="/dealer/announcements" icon={FileText} accent={T.blue} title="Announcements" subtitle="Latest updates" />

            <NavCard to="/dealer/orders" icon={Package} accent="#6D4AB0" title="My Orders" subtitle="View order history" />
            <NavCard to="/dealer/reorder-suggestions" icon={BarChart3} accent={T.orange} title="Reorder Suggestions" subtitle="Smart recommendations" />
            <NavCard to="/dealer/tickets" icon={Ticket} accent={T.orangeDeep} title="Support" subtitle="Get help" />
            <NavCard to="/dealer/certificate" icon={FileCheck} accent={T.green} title="Certificate" subtitle="Dealer authorization" />
          </div>
        </div>

        {/* Recent Orders */}
        {data?.recent_orders?.length > 0 && (
          <IronCard pad={0}>
            <SectionHead title="Recent Orders" to="/dealer/orders" linkLabel="View All" />
            <div>
              {data.recent_orders.map((order) => (
                <Link key={order.id} to={`/dealer/orders/${order.id}`} className="iron-row" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
                  <div>
                    <div style={{ ...mono, fontWeight: 700, fontSize: 13, color: T.iron900 }}>{order.order_number}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.iron400, marginTop: 2 }}>{new Date(order.created_at).toLocaleDateString('en-IN')}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ ...mono, fontWeight: 700, fontSize: 13, color: T.iron900 }}>{fmtINR(order.total_amount)}</span>
                    <span style={badgeStyle(STATUS_TONE[order.status] || 'slate')}>{order.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </IronCard>
        )}
      </div>
    </IronShell>
  );
}

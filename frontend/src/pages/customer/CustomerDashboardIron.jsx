import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';
import { Ticket, Shield, Clock, CheckCircle, Plus, ArrowRight, CalendarDays, FileText, Eye, IndianRupee, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

/* Customer Dashboard — Iron Console restyle. Same endpoints, links and features as the
   legacy DashboardLayout version; only the presentation changed. */

const PI_STATUS_TONES = {
  draft: 'slate', sent: 'info', viewed: 'violet', approved: 'ok',
  rejected: 'bad', converted: 'bad', expired: 'warn', cancelled: 'slate',
};
const PI_STATUS_LABELS = {
  draft: 'Draft', sent: 'Pending Review', viewed: 'Awaiting Response',
  approved: 'Approved', rejected: 'Rejected', converted: 'Order Placed',
  expired: 'Expired', cancelled: 'Cancelled',
};

// Ticket / warranty status -> pill tone (light Iron chips).
const GEN_STATUS_TONE = (s) => {
  const v = (s || '').toLowerCase();
  if (['approved', 'resolved', 'closed', 'completed', 'active', 'dispatched'].some((k) => v.includes(k))) return 'ok';
  if (['rejected', 'cancelled', 'expired', 'breach'].some((k) => v.includes(k))) return 'bad';
  if (['pending', 'awaiting', 'followup', 'progress', 'repair'].some((k) => v.includes(k))) return 'warn';
  if (['new', 'open'].some((k) => v.includes(k))) return 'info';
  return 'slate';
};
const StatusPill = ({ status }) => (
  <span style={badgeStyle(GEN_STATUS_TONE(status))}>{(status || 'unknown').replace(/_/g, ' ')}</span>
);

const StatCard = ({ label, value, Icon, accent, sub, subTone }) => (
  <IronCard pad="13px 14px">
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <Caps size={8.5} color={T.iron400}>{label}</Caps>
      <Icon size={15} color={accent} strokeWidth={1.9} />
    </div>
    <div style={{ ...mono, fontWeight: 700, fontSize: 26, color: accent, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
    {sub && (
      <div style={{ marginTop: 5 }}>
        <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 9.5, letterSpacing: '.04em', padding: '1px 6px', borderRadius: 4,
          background: subTone === 'warn' ? T.voltageTint : T.iron100, color: subTone === 'warn' ? T.voltageText : T.iron500 }}>{sub}</span>
      </div>
    )}
  </IronCard>
);

export default function CustomerDashboard() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, ticketsRes, warrantiesRes, quotationsRes] = await Promise.all([
        axios.get(`${API}/stats`, { headers }),
        axios.get(`${API}/tickets`, { headers }),
        axios.get(`${API}/warranties`, { headers }),
        axios.get(`${API}/customer/quotations`, { headers }).catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      setRecentTickets(ticketsRes.data.slice(0, 5));
      setWarranties(warrantiesRes.data);
      setQuotations(quotationsRes.data || []);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Count quotations needing action
  const pendingQuotations = quotations.filter((q) => ['sent', 'viewed'].includes(q.status)).length;

  const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'none' };
  const outlineBtn = { display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'none' };
  const violetBtn = { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #DDD3EF', background: '#EEE9F7', color: '#6D4AB0', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'none' };
  const viewAllLink = { display: 'inline-flex', alignItems: 'center', gap: 4, color: T.orange, textDecoration: 'none', fontFamily: T.headline, fontWeight: 700, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase' };

  const subtitle = `CUSTOMER PORTAL · ${(user?.first_name || 'Welcome').toUpperCase()}`;

  if (loading) {
    return (
      <IronShell title="Dashboard" subtitle={subtitle} onRefresh={fetchData}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 108, background: T.iron100, border: `1px solid ${T.iron200}`, borderRadius: 8 }} />
          ))}
        </div>
      </IronShell>
    );
  }

  const headerRight = (
    <Link to="/customer/tickets/new" style={primaryBtn} data-testid="create-ticket-btn">
      <Plus size={14} /> Create Ticket
    </Link>
  );

  return (
    <IronShell title="Dashboard" subtitle={subtitle} onRefresh={fetchData} headerRight={headerRight}>
      {/* Welcome banner */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ display: 'inline-flex', width: 8, height: 8, borderRadius: 999, background: T.orange }} />
          <Caps size={9.5} color={T.iron400} ls=".14em">Customer Portal · Live</Caps>
        </div>
        <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 26, color: T.iron900, lineHeight: 1.15 }}>
          Welcome back, {user?.first_name}!
        </div>
        <div style={{ fontSize: 13, color: T.iron500, marginTop: 3 }}>
          Manage your warranties and support tickets from your personal dashboard.
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }} data-testid="customer-stats">
        <StatCard label="Total Tickets" value={stats?.my_tickets || 0} Icon={Ticket} accent={T.iron900} />
        <StatCard label="Open Tickets" value={stats?.open_tickets || 0} Icon={Clock} accent={T.voltageText} />
        <StatCard label="Warranties" value={stats?.my_warranties || 0} Icon={Shield} accent={T.blue} />
        <StatCard label="Approved" value={stats?.approved_warranties || 0} Icon={CheckCircle} accent={T.green} />
        <StatCard label="Quotations" value={quotations.length} Icon={FileText}
          accent={pendingQuotations > 0 ? T.orangeDeep : T.iron900}
          sub={pendingQuotations > 0 ? `${pendingQuotations} need response` : null}
          subTone={pendingQuotations > 0 ? 'warn' : 'neutral'} />
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <IronCard pad="16px 18px" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <Caps size={9} color={T.iron400}>Support</Caps>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900, marginTop: 4 }}>Need Help?</div>
            <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 2 }}>Create a support ticket for your product</div>
          </div>
          <Link to="/customer/tickets/new" style={primaryBtn}><Plus size={14} /> Create Ticket</Link>
        </IronCard>

        <IronCard pad="16px 18px" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <Caps size={9} color={T.iron400}>Warranty</Caps>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900, marginTop: 4 }}>New Product?</div>
            <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 2 }}>Register your warranty for protection</div>
          </div>
          <Link to="/customer/warranty/register" style={primaryBtn} data-testid="register-warranty-btn"><Shield size={14} /> Register</Link>
        </IronCard>

        <IronCard pad="16px 18px" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#F7F4FC', borderColor: '#DDD3EF' }}>
          <div>
            <Caps size={9} color="#6D4AB0">Consultation</Caps>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900, marginTop: 4 }}>Expert Advice?</div>
            <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 2 }}>Book a 30-min consultation with our supervisor</div>
          </div>
          <Link to="/customer/appointments" style={violetBtn} data-testid="book-appointment-btn"><CalendarDays size={14} /> Book</Link>
        </IronCard>
      </div>

      {/* Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Recent Tickets */}
        <IronCard pad={0}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${T.iron200}` }}>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>Recent Tickets</div>
            <Link to="/customer/tickets" style={viewAllLink}>View all <ArrowRight size={12} /></Link>
          </div>
          <div style={{ padding: 12 }}>
            {recentTickets.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 999, background: T.iron100, display: 'grid', placeItems: 'center', marginBottom: 10 }}><Ticket size={22} color={T.iron400} /></div>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>No tickets yet</div>
                <Link to="/customer/tickets/new" style={{ ...mono, fontSize: 11, color: T.orange, marginTop: 5, textDecoration: 'none' }}>Create your first ticket</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recentTickets.map((ticket) => (
                  <div key={ticket.id} className="iron-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 7, padding: '9px 12px' }}>
                    <div>
                      <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.iron900 }}>{ticket.ticket_number}</div>
                      <div style={{ fontSize: 11, color: T.iron500, marginTop: 2 }}>{ticket.device_type}</div>
                    </div>
                    <StatusPill status={ticket.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </IronCard>

        {/* Warranties */}
        <IronCard pad={0}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${T.iron200}` }}>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>My Warranties</div>
            <Link to="/customer/warranties" style={viewAllLink}>View all <ArrowRight size={12} /></Link>
          </div>
          <div style={{ padding: 12 }}>
            {warranties.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 999, background: T.iron100, display: 'grid', placeItems: 'center', marginBottom: 10 }}><Shield size={22} color={T.iron400} /></div>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>No warranties registered</div>
                <Link to="/customer/warranty/register" style={{ ...mono, fontSize: 11, color: T.orange, marginTop: 5, textDecoration: 'none' }}>Register a warranty</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {warranties.slice(0, 5).map((warranty) => (
                  <div key={warranty.id} className="iron-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 7, padding: '9px 12px' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900 }}>{warranty.device_type}</div>
                      <div style={{ fontSize: 11, color: T.iron500, marginTop: 2 }}>
                        {warranty.status === 'approved' && warranty.warranty_end_date
                          ? `Expires: ${new Date(warranty.warranty_end_date).toLocaleDateString()}`
                          : `Order: ${warranty.order_id}`}
                      </div>
                    </div>
                    <StatusPill status={warranty.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </IronCard>
      </div>

      {/* Quotations Section */}
      {quotations.length > 0 && (
        <IronCard pad={0} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${T.iron200}` }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: '#FDEEE6', display: 'grid', placeItems: 'center' }}><FileText size={15} color={T.orangeDeep} /></div>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>My Quotations</div>
            {pendingQuotations > 0 && <span style={badgeStyle('warn')}>{pendingQuotations} need response</span>}
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {quotations.slice(0, 5).map((quotation) => {
              const tone = PI_STATUS_TONES[quotation.status] || 'slate';
              const label = PI_STATUS_LABELS[quotation.status] || quotation.status;
              const needsAction = ['sent', 'viewed'].includes(quotation.status);
              return (
                <div key={quotation.id} className="iron-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  background: needsAction ? '#FDF6F0' : T.iron50, border: `1px solid ${needsAction ? '#F6D8BA' : T.iron200}`, borderRadius: 7, padding: '11px 12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.iron900 }}>{quotation.quotation_number}</span>
                      <span style={badgeStyle(tone)}>{label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, flexWrap: 'wrap', ...mono, fontSize: 11, color: T.iron500 }}>
                      <span>{quotation.firm_name}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><IndianRupee size={11} />{formatCurrency(quotation.grand_total)}</span>
                      <span>Valid till: {formatDate(quotation.validity_date)}</span>
                    </div>
                  </div>
                  {needsAction && quotation.access_token && (
                    <Link to={`/pi/${quotation.access_token}`} style={primaryBtn}><Eye size={13} /> Review</Link>
                  )}
                  {!needsAction && quotation.access_token && (
                    <Link to={`/pi/${quotation.access_token}`} style={outlineBtn}><ExternalLink size={13} /> View</Link>
                  )}
                </div>
              );
            })}
          </div>
        </IronCard>
      )}
    </IronShell>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

/* My Incentives — Iron Console. Track earnings from PI conversions.
   Behavior preserved 1:1 from the legacy MyIncentives page:
     GET /my-incentives         (params: month when a specific month is selected)
     GET /my-incentives/stats
   Same summary cards, performance overview, monthly trend, month filter and history table. */

const STATUS_TONE = {
  pending: ['Pending', 'warn'],
  approved: ['Approved', 'info'],
  paid: ['Paid', 'ok'],
  cancelled: ['Cancelled', 'bad'],
};

export default function MyIncentives() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ incentives: [], summary: {} });
  const [stats, setStats] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('all');

  useEffect(() => {
    if (token) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = {};
      if (selectedMonth !== 'all') params.month = selectedMonth;

      const [incentivesRes, statsRes] = await Promise.all([
        axios.get(`${API}/my-incentives`, { headers, params }),
        axios.get(`${API}/my-incentives/stats`, { headers }),
      ]);

      setData(incentivesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load incentives');
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Generate month options for filter
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  const summary = data.summary || {};

  const SUMMARY_TILES = [
    { label: 'This Month', value: formatCurrency(summary?.this_month?.total || 0), accent: T.green, sub: `${summary?.this_month?.conversions || 0} conversions` },
    { label: 'Total Earned', value: formatCurrency(summary?.total_earned || 0), accent: T.blue, sub: 'Lifetime incentives' },
    { label: 'Pending', value: formatCurrency(summary?.pending_amount || 0), accent: T.voltageText, sub: 'Awaiting payout' },
    { label: 'Paid Out', value: formatCurrency(summary?.paid_amount || 0), accent: '#6D4AB0', sub: 'Settled' },
  ];

  const selectStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none' };

  const content = loading ? (
    <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
      <Loader2 className="animate-spin" size={30} color={T.iron400} />
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 18, color: T.iron900 }}>My Incentives</div>
        <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 3 }}>Track your earnings from PI conversions</Caps>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {SUMMARY_TILES.map((t) => (
          <IronCard key={t.label} pad="13px 14px">
            <Caps size={8.5} color={T.iron400}>{t.label}</Caps>
            <div style={{ ...mono, fontWeight: 700, fontSize: 24, color: t.accent, marginTop: 6, lineHeight: 1.1 }}>{t.value}</div>
            <Caps size={8.5} color={T.iron500} ls=".05em" style={{ display: 'block', marginTop: 4 }}>{t.sub}</Caps>
          </IronCard>
        ))}
      </div>

      {/* Performance overview */}
      {stats && (
        <IronCard pad={0}>
          <div style={{ padding: '13px 16px' }}><Caps size={11} color={T.iron900} ls=".1em">Performance Overview</Caps></div>
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[
                { v: stats.total_quotations || 0, l: 'Total PIs Created', c: T.iron900 },
                { v: stats.converted_quotations || 0, l: 'Converted to Sale', c: T.green },
                { v: `${stats.conversion_rate || 0}%`, l: 'Conversion Rate', c: T.blue },
                { v: stats.monthly_breakdown?.[0]?.conversions || 0, l: 'This Month Conversions', c: T.voltageText },
              ].map((s, i) => (
                <div key={i} style={{ padding: 14, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ ...mono, fontWeight: 700, fontSize: 28, color: s.c }}>{s.v}</div>
                  <Caps size={8.5} color={T.iron500} ls=".05em" style={{ display: 'block', marginTop: 4 }}>{s.l}</Caps>
                </div>
              ))}
            </div>

            {/* Monthly trend */}
            <div style={{ marginTop: 18 }}>
              <Caps size={9.5} color={T.iron700} ls=".1em" style={{ display: 'block', marginBottom: 10 }}>Monthly Trend (Last 6 Months)</Caps>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
                {(stats.monthly_breakdown || []).slice(0, 6).reverse().map((month, idx) => (
                  <div key={idx} style={{ padding: 12, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, textAlign: 'center' }}>
                    <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 4 }}>
                      {new Date(month.month + '-01').toLocaleDateString('en-IN', { month: 'short' })}
                    </Caps>
                    <div style={{ ...mono, fontWeight: 700, fontSize: 15, color: T.blue }}>{formatCurrency(month.total_incentive)}</div>
                    <Caps size={8} color={T.iron500} style={{ display: 'block', marginTop: 2 }}>{month.conversions} sales</Caps>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </IronCard>
      )}

      {/* Filter */}
      <IronCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Caps size={9} color={T.iron400}>Month</Caps>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ ...selectStyle, minWidth: 200 }}>
            <option value="all">All Time</option>
            {getMonthOptions().map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </IronCard>

      {/* Incentive history */}
      <IronCard pad={0}>
        <div style={{ padding: '13px 16px' }}><Caps size={11} color={T.iron900} ls=".1em">Incentive History</Caps></div>
        {(data.incentives || []).length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No incentives yet</div>
            <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 6 }}>Convert PIs to sales to earn incentives!</Caps>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderTop: `1px solid ${T.iron200}`, borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {['DATE', 'PI NUMBER', 'CUSTOMER', 'SALE VALUE', 'INCENTIVE', 'STATUS'].map((h, i) => (
                  <th key={h} style={{ ...thCell, textAlign: i === 3 || i === 4 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.incentives || []).map((inc) => {
                const [label, tone] = STATUS_TONE[inc.status] || [(inc.status || 'Unknown'), 'slate'];
                return (
                  <tr key={inc.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={{ ...tdCell, ...mono, color: T.iron500 }}>{formatDate(inc.created_at)}</td>
                    <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{inc.quotation_number}</td>
                    <td style={tdCell}>{inc.customer_name}</td>
                    <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900 }}>{formatCurrency(inc.sale_value)}</td>
                    <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.green, fontWeight: 700 }}>+{formatCurrency(inc.incentive_amount)}</td>
                    <td style={tdCell}><span style={badgeStyle(tone)}>{label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </IronCard>
    </div>
  );

  return (
    <IronShell title="My Incentives" subtitle="PI CONVERSION EARNINGS" onRefresh={fetchData}>
      {content}
    </IronShell>
  );
}

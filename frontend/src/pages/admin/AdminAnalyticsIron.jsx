import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  Loader2, Users, TrendingUp, Clock, AlertTriangle,
  CheckCircle, Phone, Wrench, BarChart3, PieChart, Trophy, Star, Award, Medal,
  ExternalLink,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

/* Agent Performance Analytics — Iron Console restyle. Behaviour preserved 1:1:
   /admin/agent-performance, /admin/stats, /admin/feedback-call-performance,
   /admin/performance-metrics, /admin/feedback. */

// Simple Pie Chart Component (light Iron restyle)
const SimplePieChart = ({ data, colors, title }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;

  let cumulativePercent = 0;
  const segments = data.map((item, index) => {
    const percent = (item.value / total) * 100;
    cumulativePercent += percent;
    return { ...item, percent, color: colors[index % colors.length] };
  });

  let gradientStops = [];
  let currentPercent = 0;
  segments.forEach((seg) => {
    gradientStops.push(`${seg.color} ${currentPercent}%`);
    currentPercent += seg.percent;
    gradientStops.push(`${seg.color} ${currentPercent}%`);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 168, height: 168, borderRadius: '50%', marginBottom: 16, background: `conic-gradient(${gradientStops.join(', ')})`, boxShadow: '0 1px 3px rgba(15,15,15,.12)' }} />
      <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, color: T.iron900, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
        {segments.filter((s) => s.value > 0).map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 11, height: 11, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
            <span style={{ color: T.iron500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
            <span style={{ ...mono, color: T.iron900, fontWeight: 700, marginLeft: 'auto' }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Horizontal Bar Chart Component (light Iron restyle)
const HorizontalBarChart = ({ data, maxValue, color = T.orange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {data.map((item, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: T.iron500, fontSize: 12, width: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
        <div style={{ flex: 1, background: T.iron100, borderRadius: 999, height: 14, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, transition: 'width .5s', width: `${Math.min((item.value / maxValue) * 100, 100)}%`, background: color }} />
        </div>
        <span style={{ ...mono, color: T.iron900, fontWeight: 700, width: 48, textAlign: 'right' }}>{item.value}</span>
      </div>
    ))}
  </div>
);

const KpiTile = ({ label, value, accent }) => (
  <IronCard pad="13px 14px">
    <Caps size={8.5} color={T.iron400}>{label}</Caps>
    <div style={{ ...mono, fontWeight: 700, fontSize: 26, color: accent, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
  </IronCard>
);

const roleTone = (role) => {
  const map = { admin: 'violet', supervisor: 'info', call_support: 'ok', service_technician: 'bad', accountant: 'info', dispatcher: 'warn' };
  return map[role] || 'slate';
};
const getRoleBadge = (role) => {
  const labels = {
    admin: 'Admin', supervisor: 'Supervisor', call_support: 'Call Support',
    service_technician: 'Technician', accountant: 'Accountant', dispatcher: 'Dispatcher',
  };
  return labels[role] || role;
};

const SectionHead = ({ icon: Icon, iconColor, title, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
    {Icon && <Icon size={16} color={iconColor || T.orange} />}
    <Caps size={11} color={T.iron900} ls=".1em">{title}</Caps>
    {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
  </div>
);

export default function AdminAnalytics() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [performance, setPerformance] = useState([]);
  const [stats, setStats] = useState(null);
  const [feedbackCallPerf, setFeedbackCallPerf] = useState({ agents: [], totals: {} });
  const [performanceMetrics, setPerformanceMetrics] = useState({ staff_metrics: [], company_stats: {} });
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [perfRes, statsRes, feedbackRes, metricsRes, feedbackListRes] = await Promise.all([
        axios.get(`${API}/admin/agent-performance`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/admin/feedback-call-performance`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: { agents: [], totals: {} } })),
        axios.get(`${API}/admin/performance-metrics`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: { staff_metrics: [], company_stats: {} } })),
        axios.get(`${API}/admin/feedback`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: [] })),
      ]);
      setPerformance(perfRes.data);
      setStats(statsRes.data);
      setFeedbackCallPerf(feedbackRes.data);
      setPerformanceMetrics(metricsRes.data);
      setFeedbackList(feedbackListRes.data || []);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const totalClosed = performance.reduce((sum, p) => sum + p.closed_tickets, 0);
  const totalBreaches = performance.reduce((sum, p) => sum + p.sla_breaches, 0);
  const avgCompliance = performance.length > 0
    ? Math.round(performance.reduce((sum, p) => sum + p.sla_compliance_rate, 0) / performance.length)
    : 100;

  if (loading) {
    return (
      <IronShell title="Analytics" subtitle="AGENT PERFORMANCE" onRefresh={fetchData}>
        <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      </IronShell>
    );
  }

  return (
    <IronShell title="Analytics" subtitle="AGENT PERFORMANCE · ALL FIRMS" onRefresh={fetchData}>
      {/* Intro */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.iron900 }}>Agent Performance Analytics</div>
        <div style={{ fontSize: 12.5, color: T.iron500, marginTop: 4 }}>
          SLA compliance, closures and per-user performance across the whole workflow.
        </div>
      </div>

      {/* Company Stats Row */}
      {performanceMetrics.company_stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
          <IronCard pad="13px 14px">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: T.voltageTint, display: 'grid', placeItems: 'center' }}><Star size={22} color={T.voltageText} /></div>
              <div>
                <Caps size={8.5} color={T.iron400}>Company Avg Rating</Caps>
                <div style={{ ...mono, fontWeight: 700, fontSize: 24, color: T.voltageText, marginTop: 2 }}>{performanceMetrics.company_stats.company_average_score || 0}/10</div>
              </div>
            </div>
          </IronCard>
          <IronCard pad="13px 14px">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: T.greenTint, display: 'grid', placeItems: 'center' }}><CheckCircle size={22} color={T.green} /></div>
              <div>
                <Caps size={8.5} color={T.iron400}>Total Feedback Received</Caps>
                <div style={{ ...mono, fontWeight: 700, fontSize: 24, color: T.green, marginTop: 2 }}>{performanceMetrics.company_stats.total_feedback_received || 0}</div>
              </div>
            </div>
          </IronCard>
          <IronCard pad="13px 14px">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: T.blueTint, display: 'grid', placeItems: 'center' }}><Users size={22} color={T.blue} /></div>
              <div>
                <Caps size={8.5} color={T.iron400}>Total Staff Tracked</Caps>
                <div style={{ ...mono, fontWeight: 700, fontSize: 24, color: T.blue, marginTop: 2 }}>{performanceMetrics.company_stats.total_staff || 0}</div>
              </div>
            </div>
          </IronCard>
        </div>
      )}

      {/* Top Performers Leaderboard */}
      <IronCard pad={0} style={{ marginBottom: 16, overflow: 'hidden' }}>
        <SectionHead icon={Trophy} iconColor={T.voltageText} title="Top Performers Leaderboard"
          right={<Caps size={8.5} color={T.iron400} ls=".04em">Score = Calls (20%) + Tickets (20%) + Resolution (15%) + Feedback Calls (15%) + Rating (30%)</Caps>} />
        <div>
          {performanceMetrics.staff_metrics?.slice(0, 10).map((staff, index) => (
            <div key={staff.staff_id} className="iron-row" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: index < 3 ? T.iron50 : 'transparent' }}>
              {/* Rank */}
              <div style={{ width: 40, flexShrink: 0 }}>
                {index === 0 && <div style={{ width: 38, height: 38, borderRadius: 999, background: 'linear-gradient(135deg,#F4C518,#D9A200)', display: 'grid', placeItems: 'center', color: '#fff' }}><Trophy size={18} /></div>}
                {index === 1 && <div style={{ width: 38, height: 38, borderRadius: 999, background: 'linear-gradient(135deg,#C7CDD6,#9AA2AE)', display: 'grid', placeItems: 'center', color: '#fff' }}><Medal size={18} /></div>}
                {index === 2 && <div style={{ width: 38, height: 38, borderRadius: 999, background: 'linear-gradient(135deg,#C2410C,#9A3208)', display: 'grid', placeItems: 'center', color: '#fff' }}><Award size={18} /></div>}
                {index > 2 && <div style={{ width: 38, height: 38, borderRadius: 999, background: T.iron100, display: 'grid', placeItems: 'center', color: T.iron500, fontFamily: T.mono, fontWeight: 700, fontSize: 13 }}>#{index + 1}</div>}
              </div>

              {/* Name & Role */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.staff_name}</div>
                <span style={{ ...badgeStyle(roleTone(staff.role)), marginTop: 4 }}>{getRoleBadge(staff.role)}</span>
              </div>

              {/* Metrics */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 26 }} className="lb-metrics">
                <div style={{ textAlign: 'center' }}>
                  <Caps size={8} color={T.iron400}>Calls Answered</Caps>
                  <div style={{ ...mono, fontWeight: 700, fontSize: 13, color: T.blue, marginTop: 3 }}>{staff.calls_answered || 0}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Caps size={8} color={T.iron400}>Tickets Closed</Caps>
                  <div style={{ ...mono, fontWeight: 700, fontSize: 13, color: T.iron900, marginTop: 3 }}>{staff.tickets_closed}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Caps size={8} color={T.iron400}>Avg Resolution</Caps>
                  <div style={{ ...mono, fontWeight: 700, fontSize: 13, marginTop: 3, color: staff.avg_resolution_hours < 24 ? T.green : staff.avg_resolution_hours < 48 ? T.voltageText : T.orangeDeep }}>
                    {staff.avg_resolution_hours > 0 ? `${staff.avg_resolution_hours}h` : '-'}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Caps size={8} color={T.iron400}>Feedback Calls</Caps>
                  <div style={{ ...mono, fontWeight: 700, fontSize: 13, color: '#6D4AB0', marginTop: 3 }}>{staff.feedback_calls_completed || 0}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Caps size={8} color={T.iron400}>Customer Rating</Caps>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 3 }}>
                    <Star size={12} color={staff.avg_overall > 0 ? T.voltageText : T.iron400} fill={staff.avg_overall > 0 ? T.voltage : 'none'} />
                    <span style={{ ...mono, fontWeight: 700, fontSize: 13, color: staff.avg_overall > 0 ? T.voltageText : T.iron400 }}>{staff.avg_overall > 0 ? staff.avg_overall.toFixed(1) : '-'}</span>
                  </div>
                </div>
              </div>

              {/* Performance Score */}
              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 54 }}>
                <Caps size={8.5} color={T.iron400}>Score</Caps>
                <div style={{ ...mono, fontWeight: 700, fontSize: 20, marginTop: 2, color: staff.performance_score >= 50 ? T.green : staff.performance_score >= 25 ? T.voltageText : T.iron500 }}>{staff.performance_score}</div>
              </div>
            </div>
          ))}
          {(!performanceMetrics.staff_metrics || performanceMetrics.staff_metrics.length === 0) && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: T.iron400, fontSize: 12.5 }}>No performance data available yet</div>
          )}
        </div>
      </IronCard>

      {/* Overall Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <KpiTile label="Total Agents" value={performance.length} accent={T.iron900} />
        <KpiTile label="Total Closed" value={totalClosed} accent={T.green} />
        <KpiTile label="Total SLA Breaches" value={totalBreaches} accent={T.orangeDeep} />
        <KpiTile label="Avg SLA Compliance" value={`${avgCompliance}%`} accent={T.blue} />
      </div>

      {/* Agent Performance Table */}
      <IronCard pad={0} style={{ marginBottom: 16, overflow: 'hidden' }}>
        <SectionHead icon={BarChart3} iconColor={T.blue} title="Per-Agent Performance" />
        {performance.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
            <Users size={44} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontSize: 12.5 }}>No agent data available</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {['AGENT', 'TOTAL TICKETS', 'CLOSED', 'PHONE', 'HARDWARE', 'SLA BREACHES', 'AVG RESOLUTION (HRS)', 'SLA COMPLIANCE'].map((h, i) => (
                  <th key={i} style={{ ...thCell, textAlign: i === 0 ? 'left' : 'center' }}><Caps size={8.5}>{h}</Caps></th>
                ))}
              </tr></thead>
              <tbody>{performance.map((agent) => (
                <tr key={agent.agent_id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                  <td style={tdCell}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 999, background: T.blue, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                        {agent.agent_name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{agent.agent_name}</span>
                    </div>
                  </td>
                  <td style={{ ...tdCell, ...mono, textAlign: 'center', color: T.iron900 }}>{agent.total_tickets}</td>
                  <td style={{ ...tdCell, ...mono, textAlign: 'center', color: T.green, fontWeight: 700 }}>{agent.closed_tickets}</td>
                  <td style={{ ...tdCell, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...mono, color: T.blue }}><Phone size={12} />{agent.phone_tickets}</span>
                  </td>
                  <td style={{ ...tdCell, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...mono, color: T.orange }}><Wrench size={12} />{agent.hardware_tickets}</span>
                  </td>
                  <td style={{ ...tdCell, ...mono, textAlign: 'center', fontWeight: agent.sla_breaches > 0 ? 700 : 400, color: agent.sla_breaches > 0 ? T.orangeDeep : T.iron400 }}>{agent.sla_breaches}</td>
                  <td style={{ ...tdCell, ...mono, textAlign: 'center', color: T.iron500 }}>{agent.avg_resolution_hours > 0 ? `${agent.avg_resolution_hours}h` : '-'}</td>
                  <td style={{ ...tdCell, ...mono, textAlign: 'center', fontWeight: 700, color: agent.sla_compliance_rate >= 90 ? T.green : agent.sla_compliance_rate >= 70 ? T.voltageText : T.orangeDeep }}>{agent.sla_compliance_rate}%</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </IronCard>

      {/* Ticket Distribution */}
      {stats?.tickets_by_status && (
        <IronCard pad={0} style={{ marginBottom: 16, overflow: 'hidden' }}>
          <SectionHead title="Ticket Distribution by Status" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, padding: 16 }}>
            {Object.entries(stats.tickets_by_status).map(([status, count]) => (
              <div key={status} style={{ padding: 12, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ ...mono, fontWeight: 700, fontSize: 24, color: T.iron900 }}>{count}</div>
                <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{status.replace(/_/g, ' ')}</Caps>
              </div>
            ))}
          </div>
        </IronCard>
      )}

      {/* Charts Section — pies */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <SectionHead icon={PieChart} iconColor={T.blue} title="Support Type Distribution" />
          <div style={{ padding: 16 }}>
            <SimplePieChart
              data={[
                { label: 'Phone Support', value: performance.reduce((s, p) => s + p.phone_tickets, 0) },
                { label: 'Hardware', value: performance.reduce((s, p) => s + p.hardware_tickets, 0) },
                { label: 'Escalated', value: stats?.escalated_tickets || 0 },
              ]}
              colors={['#0B6FB8', '#F58220', '#C2410C']}
              title="By Support Type"
            />
          </div>
        </IronCard>

        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <SectionHead icon={PieChart} iconColor={T.green} title="SLA Performance" />
          <div style={{ padding: 16 }}>
            <SimplePieChart
              data={[
                { label: 'Within SLA', value: performance.reduce((s, p) => s + (p.total_tickets - p.sla_breaches), 0) },
                { label: 'SLA Breached', value: performance.reduce((s, p) => s + p.sla_breaches, 0) },
              ]}
              colors={['#1F8A4C', '#C2410C']}
              title="SLA Compliance"
            />
          </div>
        </IronCard>

        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <SectionHead icon={PieChart} iconColor="#6D4AB0" title="Team Workload" />
          <div style={{ padding: 16 }}>
            <SimplePieChart
              data={performance.slice(0, 6).map((p) => ({ label: p.agent_name.split(' ')[0], value: p.total_tickets }))}
              colors={['#0B6FB8', '#6D4AB0', '#D9A200', '#C2410C', '#1F8A4C', '#F58220']}
              title="Tickets per Agent"
            />
          </div>
        </IronCard>
      </div>

      {/* Bar Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <SectionHead icon={BarChart3} iconColor={T.blue} title="Tickets Handled by Agent" />
          <div style={{ padding: 16 }}>
            <HorizontalBarChart
              data={performance.slice(0, 8).map((p) => ({ label: p.agent_name.split(' ')[0], value: p.total_tickets }))}
              maxValue={Math.max(...performance.map((p) => p.total_tickets), 1)}
              color={T.blue}
            />
          </div>
        </IronCard>

        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <SectionHead icon={Clock} iconColor={T.orange} title="Avg Resolution Time (hrs)" />
          <div style={{ padding: 16 }}>
            <HorizontalBarChart
              data={performance.filter((p) => p.avg_resolution_hours > 0).slice(0, 8).map((p) => ({ label: p.agent_name.split(' ')[0], value: p.avg_resolution_hours }))}
              maxValue={Math.max(...performance.map((p) => p.avg_resolution_hours), 48)}
              color={T.orange}
            />
          </div>
        </IronCard>
      </div>

      {/* Feedback Call Performance */}
      {feedbackCallPerf.agents?.length > 0 && (
        <IronCard pad={0} style={{ marginBottom: 16, overflow: 'hidden' }}>
          <SectionHead icon={Phone} iconColor={T.green} title="Amazon Feedback Call Performance"
            right={<span style={{ fontSize: 11, fontFamily: T.mono }}><span style={{ color: T.orange }}>{feedbackCallPerf.totals?.pending || 0} pending</span>{' • '}<span style={{ color: T.green }}>{feedbackCallPerf.totals?.completed || 0} completed</span></span>} />
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: T.iron500, marginBottom: 14 }}>Call support agents completing customer feedback calls after Amazon order delivery</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {feedbackCallPerf.agents.map((agent, i) => (
                <div key={agent.agent_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 999, background: T.green, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>{agent.agent_name}</div>
                    <Caps size={8.5} color={T.iron400}>Call Support Agent</Caps>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...mono, fontWeight: 700, fontSize: 22, color: T.green }}>{agent.completed_feedback_calls}</div>
                    <Caps size={8.5} color={T.iron400}>Completed Calls</Caps>
                  </div>
                </div>
              ))}
              {feedbackCallPerf.agents.length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px 0', color: T.iron400, fontSize: 12.5 }}>No feedback call data yet</div>
              )}
            </div>
          </div>
        </IronCard>
      )}

      {/* Customer Feedback Surveys */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <SectionHead icon={Star} iconColor={T.voltageText} title="Customer Feedback Surveys"
          right={<Caps size={8.5} color={T.iron400}>{feedbackList.length} total responses</Caps>} />
        {feedbackList.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {['CUSTOMER', 'TICKET', 'HANDLED BY', 'COMMUNICATION', 'RESOLUTION', 'PROFESSIONALISM', 'OVERALL', 'COMMENTS', 'DATE'].map((h, i) => (
                  <th key={i} style={{ ...thCell, textAlign: (i >= 3 && i <= 6) ? 'center' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                ))}
              </tr></thead>
              <tbody>{feedbackList.map((feedback) => (
                <tr key={feedback.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                  <td style={tdCell}><span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{feedback.customer_name}</span></td>
                  <td style={tdCell}>
                    {feedback.ticket_id ? (
                      <button onClick={() => navigate(`/admin/tickets/${feedback.ticket_id}`)} data-testid={`view-ticket-${feedback.ticket_number}`}
                        style={{ ...mono, fontSize: 11, fontWeight: 700, color: T.orangeDeep, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {feedback.ticket_number}
                        <ExternalLink size={11} />
                      </button>
                    ) : (
                      <span style={{ ...mono, fontSize: 11, color: T.orangeDeep }}>{feedback.ticket_number || '-'}</span>
                    )}
                  </td>
                  <td style={tdCell}>
                    <span style={{ color: T.iron900 }}>{feedback.staff_name}</span>
                    <span style={{ ...badgeStyle(roleTone(feedback.staff_role)), marginLeft: 6 }}>{getRoleBadge(feedback.staff_role)}</span>
                  </td>
                  <td style={{ ...tdCell, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Star size={12} color={T.voltageText} fill={T.voltage} /><span style={{ ...mono, color: T.voltageText, fontWeight: 700 }}>{feedback.communication}</span>
                    </span>
                  </td>
                  <td style={{ ...tdCell, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Star size={12} color={T.blue} fill={T.blue} /><span style={{ ...mono, color: T.blue, fontWeight: 700 }}>{feedback.resolution_speed}</span>
                    </span>
                  </td>
                  <td style={{ ...tdCell, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Star size={12} color={T.green} fill={T.green} /><span style={{ ...mono, color: T.green, fontWeight: 700 }}>{feedback.professionalism}</span>
                    </span>
                  </td>
                  <td style={{ ...tdCell, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Star size={14} color={T.orange} fill={T.orange} /><span style={{ ...mono, color: T.orange, fontWeight: 700, fontSize: 15 }}>{feedback.overall}</span>
                    </span>
                  </td>
                  <td style={tdCell}>
                    <span title={feedback.comments} style={{ fontSize: 11, color: T.iron600 || T.iron700, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{feedback.comments || '-'}</span>
                  </td>
                  <td style={{ ...tdCell, ...mono, fontSize: 10.5, color: T.iron400 }}>{new Date(feedback.created_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
            <Star size={44} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontSize: 13, color: T.iron700 }}>No customer feedback surveys received yet</div>
            <div style={{ fontSize: 12, color: T.iron400, marginTop: 6 }}>Feedback will appear here after customers rate closed tickets</div>
          </div>
        )}
      </IronCard>
    </IronShell>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Loader2, Users, TrendingUp, Clock, AlertTriangle,
  CheckCircle, Phone, Wrench, BarChart3, PieChart, Trophy, Star, Award, Medal
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// Simple Pie Chart Component
const SimplePieChart = ({ data, colors, title }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;
  
  let cumulativePercent = 0;
  const segments = data.map((item, index) => {
    const percent = (item.value / total) * 100;
    const startAngle = cumulativePercent * 3.6; // degrees
    cumulativePercent += percent;
    return {
      ...item,
      percent,
      color: colors[index % colors.length]
    };
  });

  // Create conic gradient for pie chart
  let gradientStops = [];
  let currentPercent = 0;
  segments.forEach((seg, i) => {
    gradientStops.push(`${seg.color} ${currentPercent}%`);
    currentPercent += seg.percent;
    gradientStops.push(`${seg.color} ${currentPercent}%`);
  });

  return (
    <div className="flex flex-col items-center">
      <div 
        className="w-48 h-48 rounded-full mb-4"
        style={{
          background: `conic-gradient(${gradientStops.join(', ')})`
        }}
      />
      <h4 className="text-white font-medium mb-3">{title}</h4>
      <div className="grid grid-cols-2 gap-2 w-full">
        {segments.filter(s => s.value > 0).map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-sm" style={{ background: seg.color }} />
            <span className="text-slate-400 truncate">{seg.label}</span>
            <span className="text-white font-medium ml-auto">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Horizontal Bar Chart Component
const HorizontalBarChart = ({ data, maxValue, color = '#06b6d4' }) => {
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-slate-400 text-sm w-24 truncate">{item.label}</span>
          <div className="flex-1 bg-slate-700 rounded-full h-4 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${Math.min((item.value / maxValue) * 100, 100)}%`,
                background: color
              }}
            />
          </div>
          <span className="text-white font-medium w-12 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function AdminAnalytics() {
  const { token } = useAuth();
  const [performance, setPerformance] = useState([]);
  const [stats, setStats] = useState(null);
  const [feedbackCallPerf, setFeedbackCallPerf] = useState({ agents: [], totals: {} });
  const [performanceMetrics, setPerformanceMetrics] = useState({ staff_metrics: [], company_stats: {} });
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('leaderboard');

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [perfRes, statsRes, feedbackRes, metricsRes, feedbackListRes] = await Promise.all([
        axios.get(`${API}/admin/agent-performance`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/admin/feedback-call-performance`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { agents: [], totals: {} } })),
        axios.get(`${API}/admin/performance-metrics`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { staff_metrics: [], company_stats: {} } })),
        axios.get(`${API}/admin/feedback`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] }))
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

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-purple-500',
      supervisor: 'bg-blue-500',
      call_support: 'bg-green-500',
      service_technician: 'bg-orange-500',
      accountant: 'bg-cyan-500',
      dispatcher: 'bg-pink-500'
    };
    return colors[role] || 'bg-slate-500';
  };

  const getRoleBadge = (role) => {
    const labels = {
      admin: 'Admin',
      supervisor: 'Supervisor',
      call_support: 'Call Support',
      service_technician: 'Technician',
      accountant: 'Accountant',
      dispatcher: 'Dispatcher'
    };
    return labels[role] || role;
  };

  if (loading) {
    return (
      <DashboardLayout title="Agent Performance">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Agent Performance">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Agent Performance Analytics</h2>
        <p className="text-slate-400">
          SLA compliance, closures and per-user performance across the whole workflow.
        </p>
      </div>

      {/* Company Stats Row */}
      {performanceMetrics.company_stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border-yellow-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-600/30 rounded-lg flex items-center justify-center">
                  <Star className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-yellow-200/70 text-sm">Company Avg Rating</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {performanceMetrics.company_stats.company_average_score || 0}/10
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-600/30 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-green-200/70 text-sm">Total Feedback Received</p>
                  <p className="text-2xl font-bold text-green-400">
                    {performanceMetrics.company_stats.total_feedback_received || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border-blue-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600/30 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-blue-200/70 text-sm">Total Staff Tracked</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {performanceMetrics.company_stats.total_staff || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Performers Leaderboard */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 mb-6">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Top Performers Leaderboard
            <span className="ml-auto text-sm font-normal text-slate-400">
              Ranked by Performance Score
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-700/50">
            {performanceMetrics.staff_metrics?.slice(0, 10).map((staff, index) => (
              <div 
                key={staff.staff_id} 
                className={`flex items-center gap-4 p-4 ${index < 3 ? 'bg-slate-800/50' : ''} hover:bg-slate-700/30`}
              >
                {/* Rank */}
                <div className="w-10 flex-shrink-0">
                  {index === 0 && (
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                  )}
                  {index === 1 && (
                    <div className="w-10 h-10 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center shadow-lg">
                      <Medal className="w-5 h-5 text-white" />
                    </div>
                  )}
                  {index === 2 && (
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-amber-700 rounded-full flex items-center justify-center shadow-lg">
                      <Award className="w-5 h-5 text-white" />
                    </div>
                  )}
                  {index > 2 && (
                    <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-slate-400 font-bold">
                      #{index + 1}
                    </div>
                  )}
                </div>

                {/* Name & Role */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{staff.staff_name}</p>
                  <Badge variant="outline" className={`${getRoleColor(staff.role)} text-white text-xs border-0`}>
                    {getRoleBadge(staff.role)}
                  </Badge>
                </div>

                {/* Metrics */}
                <div className="hidden md:flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-slate-400 text-xs">Tickets Closed</p>
                    <p className="text-white font-medium">{staff.tickets_closed}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 text-xs">Avg Resolution</p>
                    <p className={`font-medium ${staff.avg_resolution_hours < 24 ? 'text-green-400' : staff.avg_resolution_hours < 48 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {staff.avg_resolution_hours > 0 ? `${staff.avg_resolution_hours}h` : '-'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 text-xs">Feedback Calls</p>
                    <p className="text-cyan-400 font-medium">{staff.feedback_calls_completed || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 text-xs">Customer Rating</p>
                    <div className="flex items-center gap-1">
                      <Star className={`w-3 h-3 ${staff.avg_overall > 0 ? 'text-yellow-400 fill-yellow-400' : 'text-slate-500'}`} />
                      <span className={`font-medium ${staff.avg_overall > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>
                        {staff.avg_overall > 0 ? staff.avg_overall.toFixed(1) : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Performance Score */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-400 mb-1">Score</p>
                  <p className={`text-xl font-bold ${
                    staff.performance_score >= 50 ? 'text-green-400' :
                    staff.performance_score >= 25 ? 'text-yellow-400' :
                    'text-slate-400'
                  }`}>
                    {staff.performance_score}
                  </p>
                </div>
              </div>
            ))}
            {(!performanceMetrics.staff_metrics || performanceMetrics.staff_metrics.length === 0) && (
              <div className="text-center py-8 text-slate-500">
                No performance data available yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Agents</p>
                <p className="text-xl font-bold text-white">{performance.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Closed</p>
                <p className="text-xl font-bold text-white">
                  {performance.reduce((sum, p) => sum + p.closed_tickets, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total SLA Breaches</p>
                <p className="text-xl font-bold text-white">
                  {performance.reduce((sum, p) => sum + p.sla_breaches, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-600/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Avg SLA Compliance</p>
                <p className="text-xl font-bold text-white">
                  {performance.length > 0 
                    ? Math.round(performance.reduce((sum, p) => sum + p.sla_compliance_rate, 0) / performance.length)
                    : 100}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Table */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Per-Agent Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left p-4 font-medium">Agent</th>
                  <th className="text-center p-4 font-medium">Total Tickets</th>
                  <th className="text-center p-4 font-medium">Closed</th>
                  <th className="text-center p-4 font-medium">Phone</th>
                  <th className="text-center p-4 font-medium">Hardware</th>
                  <th className="text-center p-4 font-medium">SLA Breaches</th>
                  <th className="text-center p-4 font-medium">Avg Resolution (hrs)</th>
                  <th className="text-center p-4 font-medium">SLA Compliance</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((agent) => (
                  <tr key={agent.agent_id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {agent.agent_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-white font-medium">{agent.agent_name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center text-white">{agent.total_tickets}</td>
                    <td className="p-4 text-center">
                      <span className="text-green-400 font-medium">{agent.closed_tickets}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center gap-1 text-blue-400">
                        <Phone className="w-3 h-3" />
                        {agent.phone_tickets}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center gap-1 text-orange-400">
                        <Wrench className="w-3 h-3" />
                        {agent.hardware_tickets}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={agent.sla_breaches > 0 ? 'text-red-400 font-medium' : 'text-slate-400'}>
                        {agent.sla_breaches}
                      </span>
                    </td>
                    <td className="p-4 text-center text-slate-400">
                      {agent.avg_resolution_hours > 0 ? `${agent.avg_resolution_hours}h` : '-'}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`font-medium ${
                        agent.sla_compliance_rate >= 90 ? 'text-green-400' :
                        agent.sla_compliance_rate >= 70 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {agent.sla_compliance_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {performance.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p>No agent data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Distribution */}
      {stats?.tickets_by_status && (
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Ticket Distribution by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Object.entries(stats.tickets_by_status).map(([status, count]) => (
                <div key={status} className="p-3 bg-slate-900 rounded-lg text-center">
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-xs text-slate-400 mt-1">{status.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Support Type Distribution Pie */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-cyan-400" />
              Support Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimplePieChart 
              data={[
                { label: 'Phone Support', value: performance.reduce((s, p) => s + p.phone_tickets, 0) },
                { label: 'Hardware', value: performance.reduce((s, p) => s + p.hardware_tickets, 0) },
                { label: 'Escalated', value: stats?.escalated_tickets || 0 }
              ]}
              colors={['#3b82f6', '#f97316', '#ef4444']}
              title="By Support Type"
            />
          </CardContent>
        </Card>

        {/* SLA Compliance Pie */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-green-400" />
              SLA Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimplePieChart 
              data={[
                { label: 'Within SLA', value: performance.reduce((s, p) => s + (p.total_tickets - p.sla_breaches), 0) },
                { label: 'SLA Breached', value: performance.reduce((s, p) => s + p.sla_breaches, 0) }
              ]}
              colors={['#22c55e', '#ef4444']}
              title="SLA Compliance"
            />
          </CardContent>
        </Card>

        {/* Team Workload Pie */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-400" />
              Team Workload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimplePieChart 
              data={performance.slice(0, 6).map(p => ({ label: p.agent_name.split(' ')[0], value: p.total_tickets }))}
              colors={['#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#6366f1']}
              title="Tickets per Agent"
            />
          </CardContent>
        </Card>
      </div>

      {/* Bar Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tickets Handled Bar Chart */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Tickets Handled by Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart 
              data={performance.slice(0, 8).map(p => ({ label: p.agent_name.split(' ')[0], value: p.total_tickets }))}
              maxValue={Math.max(...performance.map(p => p.total_tickets), 1)}
              color="#3b82f6"
            />
          </CardContent>
        </Card>

        {/* Resolution Time Bar Chart */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-400" />
              Avg Resolution Time (hrs)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart 
              data={performance.filter(p => p.avg_resolution_hours > 0).slice(0, 8).map(p => ({ 
                label: p.agent_name.split(' ')[0], 
                value: p.avg_resolution_hours 
              }))}
              maxValue={Math.max(...performance.map(p => p.avg_resolution_hours), 48)}
              color="#f97316"
            />
          </CardContent>
        </Card>
      </div>

      {/* Feedback Call Performance */}
      {feedbackCallPerf.agents?.length > 0 && (
        <Card className="bg-slate-800 border-slate-700 mt-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Phone className="w-5 h-5 text-green-400" />
              Amazon Feedback Call Performance
              <span className="ml-auto text-sm font-normal">
                <span className="text-orange-400">{feedbackCallPerf.totals?.pending || 0} pending</span>
                {' • '}
                <span className="text-green-400">{feedbackCallPerf.totals?.completed || 0} completed</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-slate-400 mb-4">
                Call support agents completing customer feedback calls after Amazon order delivery
              </p>
              {feedbackCallPerf.agents.map((agent, i) => (
                <div key={agent.agent_id} className="flex items-center gap-4 p-3 bg-slate-900 rounded-lg">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{agent.agent_name}</p>
                    <p className="text-xs text-slate-400">Call Support Agent</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-400">{agent.completed_feedback_calls}</p>
                    <p className="text-xs text-slate-400">Completed Calls</p>
                  </div>
                </div>
              ))}
              {feedbackCallPerf.agents.length === 0 && (
                <p className="text-slate-500 text-center py-4">No feedback call data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Feedback Survey Details - Individual Reviews */}
      <Card className="bg-slate-800 border-slate-700 mt-6">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            Customer Feedback Surveys
            <span className="ml-auto text-sm font-normal text-slate-400">
              {feedbackList.length} total responses
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {feedbackList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left p-4 font-medium">Customer</th>
                    <th className="text-left p-4 font-medium">Ticket</th>
                    <th className="text-left p-4 font-medium">Handled By</th>
                    <th className="text-center p-4 font-medium">Communication</th>
                    <th className="text-center p-4 font-medium">Resolution</th>
                    <th className="text-center p-4 font-medium">Professionalism</th>
                    <th className="text-center p-4 font-medium">Overall</th>
                    <th className="text-left p-4 font-medium">Comments</th>
                    <th className="text-left p-4 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackList.map((feedback) => (
                    <tr key={feedback.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-4">
                        <span className="text-white font-medium">{feedback.customer_name}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-cyan-400 text-xs">{feedback.ticket_number}</span>
                      </td>
                      <td className="p-4">
                        <div>
                          <span className="text-white">{feedback.staff_name}</span>
                          <Badge variant="outline" className={`${getRoleColor(feedback.staff_role)} text-white text-xs border-0 ml-2`}>
                            {getRoleBadge(feedback.staff_role)}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="flex items-center justify-center gap-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-yellow-400">{feedback.communication}</span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="flex items-center justify-center gap-1">
                          <Star className="w-3 h-3 text-blue-400 fill-blue-400" />
                          <span className="text-blue-400">{feedback.resolution_speed}</span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="flex items-center justify-center gap-1">
                          <Star className="w-3 h-3 text-green-400 fill-green-400" />
                          <span className="text-green-400">{feedback.professionalism}</span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="flex items-center justify-center gap-1 text-lg font-bold">
                          <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
                          <span className="text-orange-400">{feedback.overall}</span>
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-300 text-xs max-w-[150px] truncate block" title={feedback.comments}>
                          {feedback.comments || '-'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 text-xs">
                        {new Date(feedback.created_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Star className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p>No customer feedback surveys received yet</p>
              <p className="text-sm text-slate-500 mt-2">Feedback will appear here after customers rate closed tickets</p>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

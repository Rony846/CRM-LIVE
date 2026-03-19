import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Loader2, Users, TrendingUp, Clock, AlertTriangle,
  CheckCircle, Phone, Wrench, BarChart3, PieChart
} from 'lucide-react';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [perfRes, statsRes, feedbackRes] = await Promise.all([
        axios.get(`${API}/admin/agent-performance`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/admin/feedback-call-performance`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { agents: [], totals: {} } }))
      ]);
      setPerformance(perfRes.data);
      setStats(statsRes.data);
      setFeedbackCallPerf(feedbackRes.data);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
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
    </DashboardLayout>
  );
}

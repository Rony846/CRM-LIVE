import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Loader2, Users, TrendingUp, Clock, AlertTriangle,
  CheckCircle, Phone, Wrench, BarChart3
} from 'lucide-react';

export default function AdminAnalytics() {
  const { token } = useAuth();
  const [performance, setPerformance] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [perfRes, statsRes] = await Promise.all([
        axios.get(`${API}/admin/agent-performance`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setPerformance(perfRes.data);
      setStats(statsRes.data);
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
        <Card className="bg-slate-800 border-slate-700">
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
    </DashboardLayout>
  );
}

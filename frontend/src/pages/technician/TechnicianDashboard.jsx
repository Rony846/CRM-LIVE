import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Loader2, Wrench, Clock, AlertTriangle, CheckCircle,
  Package, Play, Check, Timer
} from 'lucide-react';

export default function TechnicianDashboard() {
  const { token, user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [myRepairs, setMyRepairs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [queueRes, myRepairsRes] = await Promise.all([
        axios.get(`${API}/technician/queue`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/technician/my-repairs`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setQueue(queueRes.data);
      setMyRepairs(myRepairsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const startRepair = async (ticketId) => {
    try {
      await axios.post(`${API}/tickets/${ticketId}/start-repair`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Repair started');
      fetchData();
    } catch (error) {
      toast.error('Failed to start repair');
    }
  };

  const completeRepair = async (ticketId, notes) => {
    try {
      const formData = new FormData();
      formData.append('repair_notes', notes || 'Repair completed successfully');
      
      await axios.post(`${API}/tickets/${ticketId}/complete-repair`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Repair marked as completed');
      fetchData();
    } catch (error) {
      toast.error('Failed to complete repair');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN');
  };

  if (loading) {
    return (
      <DashboardLayout title="Technician Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      </DashboardLayout>
    );
  }

  const awaitingRepair = queue.filter(t => t.status === 'received_at_factory');
  const inProgress = queue.filter(t => t.status === 'in_repair');

  return (
    <DashboardLayout title="Technician Dashboard">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Repair Workshop</h2>
        <p className="text-slate-400">
          Hardware repairs, test results and <span className="text-yellow-400">72-hour SLA</span> management.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-600/20 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Awaiting Repair</p>
                <p className="text-xl font-bold text-white">{awaitingRepair.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-600/20 rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">In Progress</p>
                <p className="text-xl font-bold text-white">{inProgress.length}</p>
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
                <p className="text-slate-400 text-sm">My Completed</p>
                <p className="text-xl font-bold text-white">
                  {myRepairs.filter(t => t.status === 'repair_completed').length}
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
                <p className="text-slate-400 text-sm">SLA Breached</p>
                <p className="text-xl font-bold text-white">
                  {queue.filter(t => t.repair_sla_breached).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Repair Queue */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-yellow-400" />
            Repair Queue
            <span className="text-sm font-normal text-slate-400 ml-2">(72-hour SLA from receipt)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {queue.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p>No items in repair queue</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left p-4 font-medium">Ticket</th>
                    <th className="text-left p-4 font-medium">Customer</th>
                    <th className="text-left p-4 font-medium">Product</th>
                    <th className="text-left p-4 font-medium">Issue</th>
                    <th className="text-left p-4 font-medium">Received</th>
                    <th className="text-left p-4 font-medium">72hr SLA</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-4">
                        <p className="font-mono text-cyan-400">{ticket.ticket_number}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-white">{ticket.customer_name}</p>
                        <p className="text-slate-500 text-xs">{ticket.customer_phone}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-white">{ticket.product_name || ticket.device_type}</p>
                        <p className="text-slate-500 text-xs">S/N: {ticket.serial_number || '-'}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-slate-300 max-w-[200px] truncate">{ticket.issue_description}</p>
                      </td>
                      <td className="p-4 text-slate-400 text-xs">
                        {formatDate(ticket.received_at)}
                      </td>
                      <td className="p-4">
                        <div className={`flex items-center gap-2 ${ticket.repair_sla_breached ? 'text-red-400' : 'text-green-400'}`}>
                          <Timer className="w-4 h-4" />
                          <span className="font-mono">
                            {ticket.repair_hours_remaining}h remaining
                          </span>
                        </div>
                        {ticket.repair_sla_breached && (
                          <span className="text-xs text-red-400 flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            SLA BREACHED
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          ticket.status === 'in_repair' ? 'bg-cyan-600' : 'bg-yellow-600'
                        } text-white`}>
                          {ticket.status === 'in_repair' ? 'In Repair' : 'Awaiting'}
                        </span>
                      </td>
                      <td className="p-4">
                        {ticket.status === 'received_at_factory' ? (
                          <Button 
                            size="sm" 
                            className="bg-cyan-600 hover:bg-cyan-700"
                            onClick={() => startRepair(ticket.id)}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Start
                          </Button>
                        ) : ticket.status === 'in_repair' ? (
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              const notes = prompt('Enter repair notes:');
                              if (notes !== null) completeRepair(ticket.id, notes);
                            }}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Complete
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Repairs */}
      {myRepairs.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              My Recent Repairs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myRepairs.slice(0, 5).map((ticket) => (
                <div key={ticket.id} className="p-4 bg-slate-900 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-cyan-400 font-mono">{ticket.ticket_number}</p>
                    <p className="text-white">{ticket.product_name || ticket.device_type}</p>
                    <p className="text-slate-500 text-sm mt-1">{ticket.repair_notes}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs ${
                      ticket.status === 'repair_completed' ? 'bg-green-600' : 'bg-cyan-600'
                    } text-white`}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                    <p className="text-slate-500 text-xs mt-2">
                      Repaired: {formatDate(ticket.repaired_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}

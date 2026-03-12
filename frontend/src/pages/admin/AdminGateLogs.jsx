import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Search, Loader2, ArrowDownLeft, ArrowUpRight, 
  Package, Truck, Clock, Filter
} from 'lucide-react';

export default function AdminGateLogs() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [scheduled, setScheduled] = useState({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    scan_type: '',
    search: '',
    from_date: '',
    to_date: ''
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.scan_type && filters.scan_type !== 'all') params.append('scan_type', filters.scan_type);
      if (filters.search) params.append('search', filters.search);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      
      const [logsRes, scheduledRes] = await Promise.all([
        axios.get(`${API}/gate/logs?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/gate/scheduled`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setLogs(logsRes.data);
      setScheduled({
        incoming: scheduledRes.data.scheduled_incoming || [],
        outgoing: scheduledRes.data.scheduled_outgoing || []
      });
    } catch (error) {
      toast.error('Failed to load gate logs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN');
  };

  return (
    <DashboardLayout title="Gate Logs (In & Out)">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Gate Activity Logs</h2>
        <p className="text-slate-400">
          Track all parcels entering and leaving the factory, including repair items and non-repair inward claimables.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Inward Today</p>
                <p className="text-xl font-bold text-white">
                  {logs.filter(l => l.scan_type === 'inward' && new Date(l.scanned_at).toDateString() === new Date().toDateString()).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Outward Today</p>
                <p className="text-xl font-bold text-white">
                  {logs.filter(l => l.scan_type === 'outward' && new Date(l.scanned_at).toDateString() === new Date().toDateString()).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-600/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Scheduled Incoming</p>
                <p className="text-xl font-bold text-white">{scheduled.incoming.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Pending Dispatch</p>
                <p className="text-xl font-bold text-white">{scheduled.outgoing.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Scheduled Incoming */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-green-400" />
              Scheduled Incoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduled.incoming.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No scheduled incoming parcels</p>
            ) : (
              <div className="space-y-2">
                {scheduled.incoming.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-900 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{item.ticket_number}</p>
                      <p className="text-slate-400 text-sm">{item.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-400 text-sm">{item.pickup_courier}</p>
                      <p className="text-slate-500 text-xs font-mono">{item.pickup_tracking}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scheduled Outgoing */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-blue-400" />
              Scheduled Outgoing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduled.outgoing.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No scheduled outgoing parcels</p>
            ) : (
              <div className="space-y-2">
                {scheduled.outgoing.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-900 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{item.ticket_number || item.dispatch_number}</p>
                      <p className="text-slate-400 text-sm">{item.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-400 text-sm">{item.return_courier || item.courier}</p>
                      <p className="text-slate-500 text-xs font-mono">{item.return_tracking || item.tracking_id}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-slate-400 mb-1 block">Search</label>
              <Input
                placeholder="tracking ID / ticket / customer"
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
            
            <div className="w-40">
              <label className="text-sm text-slate-400 mb-1 block">Type</label>
              <Select value={filters.scan_type} onValueChange={(v) => setFilters(f => ({ ...f, scan_type: v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="inward">Inward</SelectItem>
                  <SelectItem value="outward">Outward</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-36">
              <label className="text-sm text-slate-400 mb-1 block">From</label>
              <Input
                type="date"
                value={filters.from_date}
                onChange={(e) => setFilters(f => ({ ...f, from_date: e.target.value }))}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
            
            <div className="w-36">
              <label className="text-sm text-slate-400 mb-1 block">To</label>
              <Input
                type="date"
                value={filters.to_date}
                onChange={(e) => setFilters(f => ({ ...f, to_date: e.target.value }))}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
            
            <Button onClick={fetchData} className="bg-cyan-600 hover:bg-cyan-700">
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gate Logs Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Gate Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p>No gate logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left p-4 font-medium">Type</th>
                    <th className="text-left p-4 font-medium">Tracking ID</th>
                    <th className="text-left p-4 font-medium">Courier</th>
                    <th className="text-left p-4 font-medium">Ticket</th>
                    <th className="text-left p-4 font-medium">Customer</th>
                    <th className="text-left p-4 font-medium">Scanned By</th>
                    <th className="text-left p-4 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                          log.scan_type === 'inward' ? 'bg-green-600/20 text-green-400' : 'bg-blue-600/20 text-blue-400'
                        }`}>
                          {log.scan_type === 'inward' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {log.scan_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-cyan-400">{log.tracking_id}</td>
                      <td className="p-4 text-white">{log.courier || '-'}</td>
                      <td className="p-4 text-slate-400">{log.ticket_number || '-'}</td>
                      <td className="p-4 text-white">{log.customer_name || '-'}</td>
                      <td className="p-4 text-slate-400">{log.scanned_by_name}</td>
                      <td className="p-4 text-slate-500 text-xs">{formatDate(log.scanned_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

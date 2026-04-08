import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Truck, Clock, Search, RefreshCw, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ViewDispatchQueue() {
  const { token } = useAuth();
  const [queue, setQueue] = useState([]);
  const [recentDispatches, setRecentDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('queue');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every 60 seconds
    return () => clearInterval(interval);
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [queueRes, recentRes] = await Promise.all([
        axios.get(`${API}/dispatcher/queue`, { headers }),
        axios.get(`${API}/dispatcher/recent`, { headers }).catch(() => ({ data: [] }))
      ]);
      setQueue(queueRes.data || []);
      setRecentDispatches(recentRes.data || []);
    } catch (error) {
      console.error('Failed to fetch dispatch queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'ready_for_dispatch': { label: 'Ready', className: 'bg-green-500/20 text-green-400' },
      'ready_to_dispatch': { label: 'Ready', className: 'bg-green-500/20 text-green-400' },
      'pending_dispatch': { label: 'Pending', className: 'bg-yellow-500/20 text-yellow-400' },
      'dispatched': { label: 'Dispatched', className: 'bg-blue-500/20 text-blue-400' },
    };
    const config = statusConfig[status] || { label: status, className: 'bg-slate-500/20 text-slate-400' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const filteredQueue = queue.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.order_id?.toLowerCase().includes(search) ||
      item.tracking_id?.toLowerCase().includes(search) ||
      item.customer_name?.toLowerCase().includes(search)
    );
  });

  const filteredRecent = recentDispatches.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.order_id?.toLowerCase().includes(search) ||
      item.tracking_id?.toLowerCase().includes(search) ||
      item.customer_name?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Eye className="w-6 h-6 text-cyan-400" />
              Dispatch Queue
              <Badge className="bg-cyan-500/20 text-cyan-400 text-xs ml-2">View Only</Badge>
            </h1>
            <p className="text-slate-400 mt-1">Monitor dispatch status in real-time</p>
          </div>
          <Button onClick={fetchData} variant="outline" className="border-slate-600 text-slate-300">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Ready to Dispatch</p>
                  <p className="text-2xl font-bold text-green-400">
                    {queue.filter(d => d.status === 'ready_for_dispatch' || d.status === 'ready_to_dispatch').length}
                  </p>
                </div>
                <Package className="w-8 h-8 text-green-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Pending Dispatch</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {queue.filter(d => d.status === 'pending_dispatch').length}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Dispatched Today</p>
                  <p className="text-2xl font-bold text-blue-400">{recentDispatches.length}</p>
                </div>
                <Truck className="w-8 h-8 text-blue-400/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search order/tracking..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-700 border-slate-600 text-white"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800">
            <TabsTrigger value="queue">
              Queue ({filteredQueue.length})
            </TabsTrigger>
            <TabsTrigger value="recent">
              Recently Dispatched ({filteredRecent.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Order ID</TableHead>
                      <TableHead className="text-slate-300">Customer</TableHead>
                      <TableHead className="text-slate-300">Tracking ID</TableHead>
                      <TableHead className="text-slate-300">SKU</TableHead>
                      <TableHead className="text-slate-300">Firm</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQueue.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                          No items in dispatch queue
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredQueue.map((item) => (
                        <TableRow key={item.id} className="border-slate-700">
                          <TableCell className="text-white font-mono">{item.order_id || '-'}</TableCell>
                          <TableCell className="text-white">{item.customer_name || '-'}</TableCell>
                          <TableCell className="text-cyan-400 font-mono">{item.tracking_id || '-'}</TableCell>
                          <TableCell className="text-slate-300">{item.sku_code || item.master_sku_name || '-'}</TableCell>
                          <TableCell className="text-slate-300">{item.firm_name || '-'}</TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell className="text-slate-400">
                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent" className="mt-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Order ID</TableHead>
                      <TableHead className="text-slate-300">Customer</TableHead>
                      <TableHead className="text-slate-300">Tracking ID</TableHead>
                      <TableHead className="text-slate-300">Courier</TableHead>
                      <TableHead className="text-slate-300">Dispatched By</TableHead>
                      <TableHead className="text-slate-300">Dispatched At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecent.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                          No recent dispatches
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecent.map((item) => (
                        <TableRow key={item.id} className="border-slate-700">
                          <TableCell className="text-white font-mono">{item.order_id || item.invoice_number || '-'}</TableCell>
                          <TableCell className="text-white">{item.customer_name || '-'}</TableCell>
                          <TableCell className="text-cyan-400 font-mono">{item.tracking_id || '-'}</TableCell>
                          <TableCell className="text-slate-300">{item.courier || '-'}</TableCell>
                          <TableCell className="text-slate-300">{item.dispatched_by_name || '-'}</TableCell>
                          <TableCell className="text-slate-400">
                            {item.dispatched_at ? new Date(item.dispatched_at).toLocaleString() : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

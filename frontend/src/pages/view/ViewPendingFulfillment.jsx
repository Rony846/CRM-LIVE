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
import { Package, Clock, Search, RefreshCw, Eye, Loader2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ViewPendingFulfillment() {
  const { token } = useAuth();
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('awaiting');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every 60 seconds
    return () => clearInterval(interval);
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/pending-fulfillment?include_expired=true`, { headers });
      setEntries(res.data?.entries || []);
      setSummary(res.data?.summary || {});
    } catch (error) {
      console.error('Failed to fetch pending fulfillment:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (entry) => {
    if (entry.is_label_expired) {
      return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
    }
    if (entry.status === 'ready_to_dispatch') {
      return <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Ready</Badge>;
    }
    if (entry.status === 'awaiting_stock' || entry.status === 'awaiting_procurement') {
      return <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1" />Awaiting Stock</Badge>;
    }
    if (entry.status === 'pending_dispatch') {
      return <Badge className="bg-orange-500/20 text-orange-400"><Package className="w-3 h-3 mr-1" />Pending Dispatch</Badge>;
    }
    if (entry.status === 'dispatched') {
      return <Badge className="bg-blue-500/20 text-blue-400"><CheckCircle className="w-3 h-3 mr-1" />Dispatched</Badge>;
    }
    if (entry.status === 'cancelled') {
      return <Badge className="bg-slate-500/20 text-slate-400">Cancelled</Badge>;
    }
    return <Badge className="bg-slate-500/20 text-slate-400">{entry.status}</Badge>;
  };

  const filteredEntries = entries.filter(entry => {
    // Filter by tab
    if (activeTab === 'awaiting' && !['awaiting_stock', 'awaiting_procurement', 'pending_dispatch'].includes(entry.status)) return false;
    if (activeTab === 'ready' && entry.status !== 'ready_to_dispatch') return false;
    if (activeTab === 'dispatched' && entry.status !== 'dispatched') return false;
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        entry.order_id?.toLowerCase().includes(search) ||
        entry.tracking_id?.toLowerCase().includes(search) ||
        entry.customer_name?.toLowerCase().includes(search) ||
        entry.sku_code?.toLowerCase().includes(search)
      );
    }
    return true;
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
              Pending Fulfillment Queue
              <Badge className="bg-cyan-500/20 text-cyan-400 text-xs ml-2">View Only</Badge>
            </h1>
            <p className="text-slate-400 mt-1">Monitor fulfillment status in real-time</p>
          </div>
          <Button onClick={fetchData} variant="outline" className="border-slate-600 text-slate-300">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Entries</p>
                  <p className="text-2xl font-bold text-white">{summary.total || 0}</p>
                </div>
                <Package className="w-8 h-8 text-slate-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Awaiting Stock</p>
                  <p className="text-2xl font-bold text-yellow-400">{(summary.awaiting_stock || 0) + (summary.awaiting_procurement || 0)}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Ready to Dispatch</p>
                  <p className="text-2xl font-bold text-green-400">{summary.ready_to_dispatch || 0}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Expiring Soon</p>
                  <p className="text-2xl font-bold text-orange-400">{summary.expiring_soon || 0}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Expired Labels</p>
                  <p className="text-2xl font-bold text-red-400">{summary.expired_labels || 0}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-400/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search order/tracking/SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-700 border-slate-600 text-white"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800">
            <TabsTrigger value="awaiting" className="data-[state=active]:bg-yellow-600">
              Pending ({(summary.awaiting_stock || 0) + (summary.awaiting_procurement || 0) + (summary.pending_dispatch || 0)})
            </TabsTrigger>
            <TabsTrigger value="ready" className="data-[state=active]:bg-green-600">
              Ready to Dispatch ({summary.ready_to_dispatch || 0})
            </TabsTrigger>
            <TabsTrigger value="dispatched" className="data-[state=active]:bg-blue-600">
              Dispatched
            </TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-cyan-600">
              All
            </TabsTrigger>
          </TabsList>

          <Card className="bg-slate-800 border-slate-700 mt-4">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-300">Order/PI</TableHead>
                    <TableHead className="text-slate-300">Customer</TableHead>
                    <TableHead className="text-slate-300">SKU</TableHead>
                    <TableHead className="text-slate-300">Firm</TableHead>
                    <TableHead className="text-slate-300 text-right">Qty</TableHead>
                    <TableHead className="text-slate-300 text-right">Stock</TableHead>
                    <TableHead className="text-slate-300">Status</TableHead>
                    <TableHead className="text-slate-300">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                        No entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => (
                      <TableRow key={entry.id} className="border-slate-700">
                        <TableCell>
                          <div className="text-white font-mono">{entry.order_id || entry.quotation_number || '-'}</div>
                          {entry.tracking_id && <div className="text-xs text-cyan-400 font-mono">{entry.tracking_id}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="text-white">{entry.customer_name || '-'}</div>
                          {entry.customer_phone && <div className="text-xs text-slate-400">{entry.customer_phone}</div>}
                        </TableCell>
                        <TableCell>
                          {entry.items && entry.items.length > 0 ? (
                            <div className="space-y-1">
                              {entry.items.map((item, idx) => (
                                <div key={idx} className={idx > 0 ? 'pt-1 border-t border-slate-700' : ''}>
                                  <div className="text-white text-sm">{item.master_sku_name || item.sku_name || 'Unknown'}</div>
                                  <div className="text-xs text-slate-400">{item.sku_code} x{item.quantity}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
                              <div className="text-white">{entry.master_sku_name || entry.sku_name || '-'}</div>
                              <div className="text-xs text-slate-400">{entry.sku_code}</div>
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300">{entry.firm_name || '-'}</TableCell>
                        <TableCell className="text-white text-right">{entry.quantity}</TableCell>
                        <TableCell className={`text-right font-medium ${entry.current_stock >= entry.quantity ? 'text-green-400' : 'text-red-400'}`}>
                          {entry.current_stock}
                        </TableCell>
                        <TableCell>{getStatusBadge(entry)}</TableCell>
                        <TableCell className="text-slate-400">
                          {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

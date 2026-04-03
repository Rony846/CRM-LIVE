import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Package, Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Plus, History, Loader2, Search, ArrowRight, PackageCheck
} from 'lucide-react';

export default function PendingFulfillment() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({});
  const [firms, setFirms] = useState([]);
  const [skus, setSkus] = useState([]);
  
  const [createOpen, setCreateOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [activeTab, setActiveTab] = useState('awaiting');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [createForm, setCreateForm] = useState({
    order_id: '', tracking_id: '', firm_id: '', master_sku_id: '', quantity: 1, notes: ''
  });
  const [regenerateForm, setRegenerateForm] = useState({ new_tracking_id: '', expiry_days: 5 });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [entriesRes, firmsRes, skusRes] = await Promise.all([
        axios.get(`${API}/pending-fulfillment?include_expired=true`, { headers }),
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        axios.get(`${API}/master-skus`, { headers, params: { is_active: true } })
      ]);
      
      setEntries(entriesRes.data?.entries || []);
      setSummary(entriesRes.data?.summary || {});
      setFirms(firmsRes.data || []);
      setSkus(skusRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.order_id || !createForm.tracking_id || !createForm.firm_id || !createForm.master_sku_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setActionLoading(true);
    try {
      await axios.post(`${API}/pending-fulfillment`, createForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Pending fulfillment created');
      setCreateOpen(false);
      setCreateForm({ order_id: '', tracking_id: '', firm_id: '', master_sku_id: '', quantity: 1, notes: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create entry');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!regenerateForm.new_tracking_id) {
      toast.error('Please enter new tracking ID');
      return;
    }
    
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('new_tracking_id', regenerateForm.new_tracking_id);
      formData.append('expiry_days', regenerateForm.expiry_days.toString());
      
      await axios.put(`${API}/pending-fulfillment/${selectedEntry.id}/regenerate-tracking`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Tracking ID regenerated');
      setRegenerateOpen(false);
      setRegenerateForm({ new_tracking_id: '', expiry_days: 5 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to regenerate tracking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (entry) => {
    const reason = window.prompt('Enter cancellation reason:');
    if (!reason) return;
    
    try {
      const formData = new FormData();
      formData.append('reason', reason);
      
      await axios.put(`${API}/pending-fulfillment/${entry.id}/cancel`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Order cancelled');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel');
    }
  };

  const handleMarkReady = async (entry) => {
    // Check if stock is sufficient
    if (entry.current_stock < entry.quantity) {
      toast.error(`Insufficient stock. Required: ${entry.quantity}, Available: ${entry.current_stock}`);
      return;
    }
    
    try {
      await axios.put(`${API}/pending-fulfillment/${entry.id}/mark-ready`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Order marked as Ready to Dispatch!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark as ready');
    }
  };

  const handleBulkMarkReady = async () => {
    // Find all awaiting orders with sufficient stock
    const eligibleEntries = entries.filter(e => 
      ['awaiting_stock', 'awaiting_procurement', 'pending_dispatch'].includes(e.status) &&
      e.current_stock >= e.quantity &&
      !e.is_label_expired
    );
    
    if (eligibleEntries.length === 0) {
      toast.info('No orders with sufficient stock to process');
      return;
    }
    
    const confirm = window.confirm(`Mark ${eligibleEntries.length} orders as "Ready to Dispatch"?`);
    if (!confirm) return;
    
    setActionLoading(true);
    let successCount = 0;
    
    for (const entry of eligibleEntries) {
      try {
        await axios.put(`${API}/pending-fulfillment/${entry.id}/mark-ready`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to mark ${entry.order_id}:`, error);
      }
    }
    
    setActionLoading(false);
    toast.success(`${successCount} orders moved to Ready to Dispatch!`);
    fetchData();
  };

  const getStatusBadge = (entry) => {
    if (entry.is_label_expired) {
      return <Badge className="bg-red-600">Label Expired</Badge>;
    }
    if (entry.is_label_expiring_soon) {
      return <Badge className="bg-orange-500">Expiring Soon</Badge>;
    }
    
    switch (entry.status) {
      case 'awaiting_stock':
        return <Badge className="bg-yellow-600">Awaiting Stock</Badge>;
      case 'awaiting_procurement':
        return <Badge className="bg-blue-600">Awaiting Procurement</Badge>;
      case 'pending_dispatch':
        return <Badge className="bg-purple-600">Pending Dispatch</Badge>;
      case 'ready_to_dispatch':
        return <Badge className="bg-green-600">Ready to Dispatch</Badge>;
      case 'dispatched':
        return <Badge className="bg-cyan-600">Dispatched</Badge>;
      case 'cancelled':
        return <Badge className="bg-slate-600">Cancelled</Badge>;
      case 'expired':
        return <Badge className="bg-red-600">Expired</Badge>;
      default:
        return <Badge>{entry.status}</Badge>;
    }
  };

  const filteredEntries = entries.filter(e => {
    const matchesSearch = !searchTerm || 
      e.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.tracking_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.sku_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // "Awaiting" tab includes awaiting_stock, awaiting_procurement, and pending_dispatch
    if (activeTab === 'awaiting') return matchesSearch && ['awaiting_stock', 'awaiting_procurement', 'pending_dispatch'].includes(e.status);
    if (activeTab === 'ready') return matchesSearch && e.status === 'ready_to_dispatch';
    if (activeTab === 'dispatched') return matchesSearch && e.status === 'dispatched';
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch;
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Pending Fulfillment Queue</h1>
            <p className="text-slate-400">Amazon orders awaiting stock</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleBulkMarkReady} 
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700" 
              data-testid="bulk-ready-btn"
            >
              <PackageCheck className="w-4 h-4 mr-2" />
              Fill All In-Stock
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="bg-cyan-600 hover:bg-cyan-700" data-testid="create-fulfillment-btn">
              <Plus className="w-4 h-4 mr-2" />
              Create Label Entry
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-cyan-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{summary.total || 0}</p>
                  <p className="text-sm text-slate-400">Total Entries</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-yellow-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{summary.awaiting_stock || 0}</p>
                  <p className="text-sm text-slate-400">Awaiting Stock</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{summary.ready_to_dispatch || 0}</p>
                  <p className="text-sm text-slate-400">Ready to Dispatch</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-orange-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{summary.expiring_soon || 0}</p>
                  <p className="text-sm text-slate-400">Expiring Soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <XCircle className="w-8 h-8 text-red-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{summary.expired_labels || 0}</p>
                  <p className="text-sm text-slate-400">Expired Labels</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs and Table */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center mb-4">
            <TabsList className="bg-slate-800 border-slate-700">
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
            
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search order/tracking/SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-700 border-slate-600 text-white"
              />
            </div>
          </div>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
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
                      <TableHead className="text-slate-300">Actions</TableHead>
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
                            <div className="text-white">{entry.master_sku_name || entry.sku_name}</div>
                            <div className="text-xs text-slate-400">{entry.sku_code}</div>
                          </TableCell>
                          <TableCell className="text-slate-300">{entry.firm_name}</TableCell>
                          <TableCell className="text-white text-right">{entry.quantity}</TableCell>
                          <TableCell className={`text-right font-medium ${entry.current_stock >= entry.quantity ? 'text-green-400' : 'text-red-400'}`}>
                            {entry.current_stock}
                          </TableCell>
                          <TableCell>{getStatusBadge(entry)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {entry.status !== 'dispatched' && entry.status !== 'cancelled' && (
                                <>
                                  {/* Show "Mark Ready" button if awaiting and has stock */}
                                  {['awaiting_stock', 'awaiting_procurement', 'pending_dispatch'].includes(entry.status) && 
                                   entry.current_stock >= entry.quantity && 
                                   !entry.is_label_expired && (
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                      onClick={() => handleMarkReady(entry)}
                                      data-testid={`mark-ready-btn-${entry.id}`}
                                    >
                                      <PackageCheck className="w-3 h-3 mr-1" />
                                      Ready
                                    </Button>
                                  )}
                                  {entry.status === 'ready_to_dispatch' && !entry.is_label_expired && (
                                    <Badge className="bg-green-600 text-white flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      Ready
                                    </Badge>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-cyan-400 border-cyan-600"
                                    onClick={() => { setSelectedEntry(entry); setRegenerateOpen(true); }}
                                    data-testid={`regenerate-btn-${entry.id}`}
                                  >
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Regenerate
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-400 border-red-600"
                                    onClick={() => handleCancel(entry)}
                                  >
                                    <XCircle className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-slate-400"
                                onClick={() => { setSelectedEntry(entry); setHistoryOpen(true); }}
                              >
                                <History className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </Tabs>

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-cyan-400" />
                Create Pending Fulfillment Entry
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Order ID *</Label>
                  <Input
                    value={createForm.order_id}
                    onChange={(e) => setCreateForm({...createForm, order_id: e.target.value})}
                    placeholder="e.g., 123-4567890-1234567"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    data-testid="order-id-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Tracking ID *</Label>
                  <Input
                    value={createForm.tracking_id}
                    onChange={(e) => setCreateForm({...createForm, tracking_id: e.target.value})}
                    placeholder="e.g., TRK123456789"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    data-testid="tracking-id-input"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-slate-300">Firm *</Label>
                <Select value={createForm.firm_id} onValueChange={(v) => setCreateForm({...createForm, firm_id: v})}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1" data-testid="firm-select">
                    <SelectValue placeholder="Select firm" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id} className="text-white">{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-slate-300">Master SKU *</Label>
                <Select value={createForm.master_sku_id} onValueChange={(v) => setCreateForm({...createForm, master_sku_id: v})}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1 [&>span]:truncate [&>span]:max-w-[90%]" data-testid="sku-select">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600 max-h-[200px] max-w-[450px]">
                    {skus.map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-white [&>span]:truncate" title={`${s.name} (${s.sku_code})`}>
                        <span className="truncate block max-w-[400px]">{s.name} ({s.sku_code})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={createForm.quantity}
                    onChange={(e) => setCreateForm({...createForm, quantity: parseInt(e.target.value) || 1})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Notes</Label>
                  <Input
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({...createForm, notes: e.target.value})}
                    placeholder="Optional notes"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>
              
              <div className="p-3 bg-slate-700/50 rounded-lg text-sm text-slate-300">
                <p><span className="text-cyan-400">●</span> Label will expire in 5 days from creation</p>
                <p><span className="text-yellow-400">●</span> Stock will NOT be deducted until actual dispatch</p>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setCreateOpen(false)} className="text-slate-300">Cancel</Button>
              <Button onClick={handleCreate} disabled={actionLoading} className="bg-cyan-600 hover:bg-cyan-700" data-testid="submit-create-btn">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Entry'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Regenerate Dialog */}
        <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-cyan-400" />
                Regenerate Tracking ID
              </DialogTitle>
            </DialogHeader>
            {selectedEntry && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-slate-400 text-sm">Order: <span className="text-white font-mono">{selectedEntry.order_id}</span></p>
                  <p className="text-slate-400 text-sm">Current Tracking: <span className="text-cyan-400 font-mono">{selectedEntry.tracking_id}</span></p>
                </div>
                
                <div>
                  <Label className="text-slate-300">New Tracking ID *</Label>
                  <Input
                    value={regenerateForm.new_tracking_id}
                    onChange={(e) => setRegenerateForm({...regenerateForm, new_tracking_id: e.target.value})}
                    placeholder="Enter new tracking ID"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    data-testid="new-tracking-input"
                  />
                </div>
                
                <div>
                  <Label className="text-slate-300">Expiry Days</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={regenerateForm.expiry_days}
                    onChange={(e) => setRegenerateForm({...regenerateForm, expiry_days: parseInt(e.target.value) || 5})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                
                <div className="p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-lg text-sm text-yellow-300">
                  <p>Previous tracking ID will be preserved in history</p>
                </div>
              </div>
            )}
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setRegenerateOpen(false)} className="text-slate-300">Cancel</Button>
              <Button onClick={handleRegenerate} disabled={actionLoading} className="bg-cyan-600 hover:bg-cyan-700" data-testid="submit-regenerate-btn">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Regenerate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" />
                Tracking History
              </DialogTitle>
            </DialogHeader>
            {selectedEntry && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-slate-400 text-sm">Order: <span className="text-white font-mono">{selectedEntry.order_id}</span></p>
                </div>
                
                <div className="space-y-2">
                  {(selectedEntry.tracking_history || []).map((th, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${th.status === 'active' ? 'bg-green-900/20 border-green-600/50' : 'bg-slate-700/50 border-slate-600'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-mono">{th.tracking_id}</p>
                          <p className="text-xs text-slate-400">Created: {new Date(th.created_at).toLocaleString()}</p>
                          {th.expired_at && (
                            <p className="text-xs text-red-400">Replaced: {new Date(th.expired_at).toLocaleString()}</p>
                          )}
                        </div>
                        <Badge className={th.status === 'active' ? 'bg-green-600' : 'bg-slate-600'}>
                          {th.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setHistoryOpen(false)} className="text-slate-300">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Info Banner - How to dispatch */}
        <Card className="bg-slate-800/50 border-cyan-700/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-cyan-400 mt-0.5" />
              <div>
                <p className="text-cyan-300 font-medium">Workflow: Pending → Ready → Dispatch</p>
                <p className="text-slate-400 text-sm mt-1">
                  <strong className="text-green-400">1.</strong> Click <strong className="text-green-300">"Fill All In-Stock"</strong> or individual <strong className="text-green-300">"Ready"</strong> buttons to move orders with available stock to Ready to Dispatch queue.
                  <br />
                  <strong className="text-cyan-400">2.</strong> Go to <strong className="text-white">Create Outbound Dispatch</strong> → select <strong className="text-cyan-300">"Pending Fulfillment"</strong> as source → select the order to dispatch.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

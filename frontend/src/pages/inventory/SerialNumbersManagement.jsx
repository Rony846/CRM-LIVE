import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth, API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Package, Search, AlertTriangle, CheckCircle2, ArrowLeftRight, Edit2, 
  RefreshCw, ChevronLeft, Filter, Download, User, Phone, MapPin, Hash
} from 'lucide-react';

export default function SerialNumbersManagement() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [serials, setSerials] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, in_stock: 0, dispatched: 0, returned: 0, alerts_count: 0 });
  
  // Filters
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedFirm, setSelectedFirm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Master data
  const [manufacturedSkus, setManufacturedSkus] = useState([]);
  const [firms, setFirms] = useState([]);
  
  // Dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [selectedSerial, setSelectedSerial] = useState(null);
  const [swapSerial1, setSwapSerial1] = useState(null);
  const [swapSerial2Id, setSwapSerial2Id] = useState('');
  const [dispatchesForSwap, setDispatchesForSwap] = useState([]);
  
  // Edit form
  const [editForm, setEditForm] = useState({
    status: '',
    dispatch_id: '',
    notes: ''
  });

  const headers = { Authorization: `Bearer ${token}` };

  // Fetch manufactured SKUs
  const fetchManufacturedSkus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/master-skus`, { 
        headers, 
        params: { product_type: 'manufactured', is_active: true } 
      });
      const skus = Array.isArray(res.data) ? res.data : res.data.master_skus || [];
      setManufacturedSkus(skus.filter(s => s.product_type === 'manufactured'));
    } catch (err) {
      console.error('Failed to fetch SKUs:', err);
    }
  }, [token]);

  // Fetch firms
  const fetchFirms = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/firms`, { headers });
      setFirms(res.data || []);
    } catch (err) {
      console.error('Failed to fetch firms:', err);
    }
  }, [token]);

  // Fetch serial numbers
  const fetchSerials = useCallback(async () => {
    if (!selectedSku) {
      setSerials([]);
      setAlerts([]);
      setSummary({ total: 0, in_stock: 0, dispatched: 0, returned: 0, alerts_count: 0 });
      return;
    }
    
    setLoading(true);
    try {
      const params = {
        master_sku_id: selectedSku,
        include_dispatch_info: true
      };
      if (selectedFirm) params.firm_id = selectedFirm;
      if (selectedStatus) params.status = selectedStatus;
      if (searchQuery) params.search = searchQuery;
      
      const res = await axios.get(`${API}/serial-numbers/management`, { headers, params });
      setSerials(res.data.serials || []);
      setAlerts(res.data.alerts || []);
      setSummary(res.data.summary || { total: 0, in_stock: 0, dispatched: 0, returned: 0, alerts_count: 0 });
    } catch (err) {
      toast.error('Failed to fetch serial numbers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedSku, selectedFirm, selectedStatus, searchQuery]);

  useEffect(() => {
    fetchManufacturedSkus();
    fetchFirms();
  }, [fetchManufacturedSkus, fetchFirms]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchSerials();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchSerials]);

  // Open edit dialog
  const openEditDialog = (serial) => {
    setSelectedSerial(serial);
    setEditForm({
      status: serial.status || '',
      dispatch_id: serial.dispatch_id || '',
      notes: serial.notes || ''
    });
    setEditDialogOpen(true);
  };

  // Open swap dialog
  const openSwapDialog = async (serial) => {
    setSwapSerial1(serial);
    setSwapSerial2Id('');
    
    // Fetch other dispatched serials for this SKU
    try {
      const params = {
        master_sku_id: serial.master_sku_id,
        status: 'dispatched',
        include_dispatch_info: true
      };
      if (serial.firm_id) params.firm_id = serial.firm_id;
      
      const res = await axios.get(`${API}/serial-numbers/management`, { headers, params });
      // Filter out the current serial
      const otherSerials = (res.data.serials || []).filter(s => s.id !== serial.id);
      setDispatchesForSwap(otherSerials);
    } catch (err) {
      toast.error('Failed to fetch serials for swap');
    }
    
    setSwapDialogOpen(true);
  };

  // Handle edit save
  const handleEditSave = async () => {
    if (!selectedSerial) return;
    
    try {
      const params = new URLSearchParams();
      if (editForm.status) params.append('status', editForm.status);
      if (editForm.dispatch_id !== selectedSerial.dispatch_id) {
        params.append('dispatch_id', editForm.dispatch_id || '');
      }
      if (editForm.notes !== selectedSerial.notes) {
        params.append('notes', editForm.notes);
      }
      
      await axios.put(`${API}/serial-numbers/${selectedSerial.id}/update?${params.toString()}`, {}, { headers });
      toast.success('Serial number updated successfully');
      setEditDialogOpen(false);
      fetchSerials();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update serial number');
    }
  };

  // Handle swap
  const handleSwap = async () => {
    if (!swapSerial1 || !swapSerial2Id) {
      toast.error('Please select a serial number to swap with');
      return;
    }
    
    try {
      await axios.post(`${API}/serial-numbers/swap?serial_id_1=${swapSerial1.id}&serial_id_2=${swapSerial2Id}`, {}, { headers });
      toast.success('Serial numbers swapped successfully');
      setSwapDialogOpen(false);
      fetchSerials();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to swap serial numbers');
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'in_stock':
        return <Badge className="bg-green-600 text-white">In Stock</Badge>;
      case 'dispatched':
        return <Badge className="bg-blue-600 text-white">Dispatched</Badge>;
      case 'returned':
        return <Badge className="bg-orange-600 text-white">Returned</Badge>;
      default:
        return <Badge className="bg-slate-600 text-white">{status || 'Unknown'}</Badge>;
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const selectedSkuInfo = manufacturedSkus.find(s => s.id === selectedSku);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => window.history.back()} className="text-slate-400 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-7 h-7 text-cyan-400" />
              Serial Numbers Management
            </h1>
            <p className="text-slate-400 text-sm">View, edit, and swap serial numbers for manufactured items</p>
          </div>
        </div>
        <Button onClick={fetchSerials} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-slate-300 mb-2 block">Manufactured Item *</Label>
              <Select value={selectedSku} onValueChange={setSelectedSku}>
                <SelectTrigger className="bg-slate-700 border-slate-600" data-testid="sku-filter">
                  <SelectValue placeholder="Select a manufactured SKU" />
                </SelectTrigger>
                <SelectContent>
                  {manufacturedSkus.map(sku => (
                    <SelectItem key={sku.id} value={sku.id}>
                      {sku.name} ({sku.sku_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-slate-300 mb-2 block">Firm</Label>
              <Select value={selectedFirm || "all"} onValueChange={(v) => setSelectedFirm(v === "all" ? "" : v)}>
                <SelectTrigger className="bg-slate-700 border-slate-600">
                  <SelectValue placeholder="All Firms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Firms</SelectItem>
                  {firms.map(firm => (
                    <SelectItem key={firm.id} value={firm.id}>
                      {firm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-slate-300 mb-2 block">Status</Label>
              <Select value={selectedStatus || "all"} onValueChange={(v) => setSelectedStatus(v === "all" ? "" : v)}>
                <SelectTrigger className="bg-slate-700 border-slate-600">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-slate-300 mb-2 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Serial #, Customer, Order ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {selectedSku && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-white">{summary.total}</p>
              <p className="text-sm text-slate-400">Total Serials</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-green-700 border-2">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{summary.in_stock}</p>
              <p className="text-sm text-slate-400">In Stock</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-blue-700 border-2">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{summary.dispatched}</p>
              <p className="text-sm text-slate-400">Dispatched</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-orange-700 border-2">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-orange-400">{summary.returned}</p>
              <p className="text-sm text-slate-400">Returned</p>
            </CardContent>
          </Card>
          <Card className={`bg-slate-800 ${summary.alerts_count > 0 ? 'border-red-700 border-2' : 'border-slate-700'}`}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${summary.alerts_count > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {summary.alerts_count}
              </p>
              <p className="text-sm text-slate-400">Alerts</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs: All Serials / Alerts */}
      <Tabs defaultValue="serials" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="serials" className="data-[state=active]:bg-cyan-600">
            All Serials ({summary.total})
          </TabsTrigger>
          <TabsTrigger value="alerts" className="data-[state=active]:bg-red-600">
            <AlertTriangle className="w-4 h-4 mr-1" />
            Alerts ({summary.alerts_count})
          </TabsTrigger>
        </TabsList>

        {/* All Serials Tab */}
        <TabsContent value="serials">
          {!selectedSku ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center">
                <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Select a manufactured item to view serial numbers</p>
              </CardContent>
            </Card>
          ) : loading ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                <p className="text-slate-400">Loading serial numbers...</p>
              </CardContent>
            </Card>
          ) : serials.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center">
                <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No serial numbers found for this item</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{selectedSkuInfo?.name} - Serial Numbers</span>
                  <Badge className="bg-cyan-600">{serials.length} records</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-slate-800">
                        <TableHead className="text-cyan-300 font-bold">#</TableHead>
                        <TableHead className="text-cyan-300 font-bold">Serial Number</TableHead>
                        <TableHead className="text-cyan-300">Status</TableHead>
                        <TableHead className="text-cyan-300">Dispatch #</TableHead>
                        <TableHead className="text-cyan-300">Customer</TableHead>
                        <TableHead className="text-cyan-300">Phone</TableHead>
                        <TableHead className="text-cyan-300">Order ID</TableHead>
                        <TableHead className="text-cyan-300">Dispatch Date</TableHead>
                        <TableHead className="text-cyan-300 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serials.map((serial, idx) => (
                        <TableRow key={serial.id} className="border-slate-700 hover:bg-slate-750">
                          <TableCell className="text-slate-400">{idx + 1}</TableCell>
                          <TableCell className="font-mono font-bold text-white">{serial.serial_number}</TableCell>
                          <TableCell>{getStatusBadge(serial.status)}</TableCell>
                          <TableCell className="font-mono text-cyan-400">
                            {serial.dispatch_info?.dispatch_number || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-500" />
                              <span>{serial.dispatch_info?.customer_name || serial.customer_name || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span>{serial.dispatch_info?.phone || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {serial.dispatch_info?.order_id || serial.order_id || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(serial.dispatch_info?.dispatch_date || serial.dispatch_date)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openEditDialog(serial)}
                                className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {serial.status === 'dispatched' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => openSwapDialog(serial)}
                                  className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/20"
                                  title="Swap with another serial"
                                >
                                  <ArrowLeftRight className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          {alerts.length === 0 ? (
            <Card className="bg-slate-800 border-green-700">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-green-400 font-medium">No alerts! All serial numbers are properly linked.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800 border-red-700">
              <CardHeader>
                <CardTitle className="text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Serial Number Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.map((alert, idx) => (
                  <div key={idx} className="p-3 bg-red-900/20 border border-red-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono font-bold text-white">{alert.serial_number}</p>
                        <p className="text-sm text-red-300">{alert.message}</p>
                      </div>
                      <Badge className="bg-red-700">{alert.issue}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-yellow-400" />
              Edit Serial Number
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Update serial number: <span className="font-mono font-bold text-white">{selectedSerial?.serial_number}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-300">Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({...editForm, status: v})}>
                <SelectTrigger className="bg-slate-700 border-slate-600 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-slate-300">Notes</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                placeholder="Add notes about this correction..."
                className="bg-slate-700 border-slate-600 mt-1"
              />
            </div>
            
            {selectedSerial?.dispatch_info && (
              <div className="p-3 bg-slate-700 rounded-lg">
                <p className="text-sm text-slate-400 mb-2">Currently linked to:</p>
                <p className="font-medium">{selectedSerial.dispatch_info.customer_name}</p>
                <p className="text-sm text-cyan-400">{selectedSerial.dispatch_info.dispatch_number}</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} className="bg-yellow-600 hover:bg-yellow-700">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swap Dialog */}
      <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-purple-400" />
              Swap Serial Numbers
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Swap serial number assignments between two dispatches
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {/* Serial 1 Info */}
            <div className="p-4 bg-purple-900/30 border border-purple-700 rounded-lg mb-4">
              <p className="text-sm text-purple-300 mb-2">Serial Number 1:</p>
              <p className="font-mono text-2xl font-bold text-white">{swapSerial1?.serial_number}</p>
              {swapSerial1?.dispatch_info && (
                <div className="mt-2 text-sm">
                  <p>Customer: <span className="text-white">{swapSerial1.dispatch_info.customer_name}</span></p>
                  <p>Dispatch: <span className="text-cyan-400">{swapSerial1.dispatch_info.dispatch_number}</span></p>
                </div>
              )}
            </div>
            
            <div className="text-center mb-4">
              <ArrowLeftRight className="w-8 h-8 text-purple-400 mx-auto" />
              <p className="text-sm text-slate-400 mt-1">will swap with</p>
            </div>
            
            {/* Serial 2 Selection */}
            <div className="p-4 bg-slate-700 border border-slate-600 rounded-lg">
              <Label className="text-slate-300 mb-2 block">Select Serial Number 2:</Label>
              <Select value={swapSerial2Id} onValueChange={setSwapSerial2Id}>
                <SelectTrigger className="bg-slate-600 border-slate-500">
                  <SelectValue placeholder="Select a serial to swap with" />
                </SelectTrigger>
                <SelectContent>
                  {dispatchesForSwap.map(serial => (
                    <SelectItem key={serial.id} value={serial.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">{serial.serial_number}</span>
                        <span className="text-slate-400">→</span>
                        <span>{serial.dispatch_info?.customer_name || 'Unknown'}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {swapSerial2Id && (
                <div className="mt-3 p-2 bg-slate-600 rounded">
                  {(() => {
                    const serial2 = dispatchesForSwap.find(s => s.id === swapSerial2Id);
                    return serial2 ? (
                      <>
                        <p className="font-mono text-lg font-bold text-white">{serial2.serial_number}</p>
                        <p className="text-sm">Customer: {serial2.dispatch_info?.customer_name}</p>
                        <p className="text-sm text-cyan-400">Dispatch: {serial2.dispatch_info?.dispatch_number}</p>
                      </>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSwap} 
              disabled={!swapSerial2Id}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Swap Serial Numbers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

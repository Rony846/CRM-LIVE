import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth, API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Package, Search, AlertTriangle, CheckCircle2, ArrowLeftRight, Edit2, 
  RefreshCw, ChevronLeft, User, Phone, Link2, Trash2, AlertCircle
} from 'lucide-react';

export default function SerialNumbersManagement() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [serials, setSerials] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, in_stock: 0, dispatched: 0, returned: 0, alerts_count: 0, unmapped_count: 0 });
  
  // Filters
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedFirm, setSelectedFirm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
  
  // Master data
  const [allSkus, setAllSkus] = useState([]);
  const [manufacturedSkus, setManufacturedSkus] = useState([]);
  const [firms, setFirms] = useState([]);
  
  // Dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [mapSkuDialogOpen, setMapSkuDialogOpen] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSerial, setSelectedSerial] = useState(null);
  const [swapSerial1, setSwapSerial1] = useState(null);
  const [swapSerial2Id, setSwapSerial2Id] = useState('');
  const [dispatchesForSwap, setDispatchesForSwap] = useState([]);
  
  // Edit/Map form
  const [editForm, setEditForm] = useState({ status: '', notes: '' });
  const [mapSkuId, setMapSkuId] = useState('');
  const [bulkMapSerials, setBulkMapSerials] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  // Fetch all SKUs (not just manufactured)
  const fetchAllSkus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/master-skus`, { headers });
      const skus = Array.isArray(res.data) ? res.data : res.data.master_skus || [];
      setAllSkus(skus);
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

  // Fetch serial numbers - now with unmapped filter option
  const fetchSerials = useCallback(async () => {
    setLoading(true);
    try {
      const params = { include_dispatch_info: true };
      if (selectedSku) params.master_sku_id = selectedSku;
      if (selectedFirm) params.firm_id = selectedFirm;
      if (selectedStatus) params.status = selectedStatus;
      if (searchQuery) params.search = searchQuery;
      if (showUnmappedOnly) params.unmapped_only = true;
      
      const res = await axios.get(`${API}/serial-numbers/management`, { headers, params });
      setSerials(res.data.serials || []);
      setAlerts(res.data.alerts || []);
      setSummary(res.data.summary || { total: 0, in_stock: 0, dispatched: 0, returned: 0, alerts_count: 0, unmapped_count: 0 });
    } catch (err) {
      toast.error('Failed to fetch serial numbers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedSku, selectedFirm, selectedStatus, searchQuery, showUnmappedOnly]);

  useEffect(() => {
    fetchAllSkus();
    fetchFirms();
  }, [fetchAllSkus, fetchFirms]);

  useEffect(() => {
    const debounce = setTimeout(() => { fetchSerials(); }, 300);
    return () => clearTimeout(debounce);
  }, [fetchSerials]);

  // Open edit dialog
  const openEditDialog = (serial) => {
    setSelectedSerial(serial);
    setEditForm({ status: serial.status || '', notes: serial.notes || '' });
    setEditDialogOpen(true);
  };

  // Open SKU mapping dialog
  const openMapSkuDialog = (serial) => {
    setSelectedSerial(serial);
    setMapSkuId(serial.master_sku_id || '');
    setMapSkuDialogOpen(true);
  };

  // Open bulk SKU mapping
  const openBulkMapDialog = () => {
    const unmapped = serials.filter(s => !s.master_sku_id);
    setBulkMapSerials(unmapped);
    setMapSkuId('');
    setMapSkuDialogOpen(true);
    setSelectedSerial(null);
  };

  // Open swap dialog
  const openSwapDialog = async (serial) => {
    setSwapSerial1(serial);
    setSwapSerial2Id('');
    try {
      const params = { status: 'dispatched', include_dispatch_info: true };
      if (serial.master_sku_id) params.master_sku_id = serial.master_sku_id;
      if (serial.firm_id) params.firm_id = serial.firm_id;
      const res = await axios.get(`${API}/serial-numbers/management`, { headers, params });
      setDispatchesForSwap((res.data.serials || []).filter(s => s.id !== serial.id));
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
      if (editForm.notes !== selectedSerial.notes) params.append('notes', editForm.notes);
      await axios.put(`${API}/serial-numbers/${selectedSerial.id}/update?${params.toString()}`, {}, { headers });
      toast.success('Serial number updated');
      setEditDialogOpen(false);
      fetchSerials();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    }
  };

  // Handle SKU mapping
  const handleMapSku = async () => {
    if (!mapSkuId) {
      toast.error('Please select a SKU');
      return;
    }
    try {
      if (selectedSerial) {
        // Single serial mapping
        await axios.put(`${API}/serial-numbers/${selectedSerial.id}/map-sku?master_sku_id=${mapSkuId}`, {}, { headers });
        toast.success('SKU mapped successfully');
      } else {
        // Bulk mapping
        const ids = bulkMapSerials.map(s => s.id);
        await axios.post(`${API}/serial-numbers/bulk-map-sku`, { serial_ids: ids, master_sku_id: mapSkuId }, { headers });
        toast.success(`${ids.length} serials mapped to SKU`);
      }
      setMapSkuDialogOpen(false);
      fetchSerials();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to map SKU');
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
      toast.error(err.response?.data?.detail || 'Failed to swap');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedSerial) return;
    try {
      await axios.delete(`${API}/serial-numbers/${selectedSerial.id}`, { headers });
      toast.success('Serial number deleted');
      setDeleteDialogOpen(false);
      fetchSerials();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'in_stock': return <Badge className="bg-green-600 text-white text-xs">In Stock</Badge>;
      case 'dispatched': return <Badge className="bg-blue-600 text-white text-xs">Dispatched</Badge>;
      case 'returned': return <Badge className="bg-orange-600 text-white text-xs">Returned</Badge>;
      default: return <Badge className="bg-slate-600 text-white text-xs">{status || 'Unknown'}</Badge>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const selectedSkuInfo = manufacturedSkus.find(s => s.id === selectedSku);
  const unmappedCount = serials.filter(s => !s.master_sku_id).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => window.history.back()} className="text-slate-400 hover:text-white p-1">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-cyan-400" />
              Serial Numbers Management
            </h1>
            <p className="text-slate-400 text-sm">View, edit, map SKUs, and swap serial numbers</p>
          </div>
        </div>
        <Button onClick={fetchSerials} variant="outline" size="sm" className="gap-1">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Filters Row */}
      <Card className="bg-slate-800 border-slate-700 mb-4">
        <CardContent className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-slate-400 text-xs mb-1 block">Manufactured SKU</Label>
              <Select value={selectedSku} onValueChange={setSelectedSku}>
                <SelectTrigger className="bg-slate-700 border-slate-600 h-9 text-sm">
                  <SelectValue placeholder="All SKUs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All SKUs</SelectItem>
                  {manufacturedSkus.map(sku => (
                    <SelectItem key={sku.id} value={sku.id}>{sku.sku_code} - {sku.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400 text-xs mb-1 block">Firm</Label>
              <Select value={selectedFirm || "all"} onValueChange={(v) => setSelectedFirm(v === "all" ? "" : v)}>
                <SelectTrigger className="bg-slate-700 border-slate-600 h-9 text-sm">
                  <SelectValue placeholder="All Firms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Firms</SelectItem>
                  {firms.map(firm => (<SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400 text-xs mb-1 block">Status</Label>
              <Select value={selectedStatus || "all"} onValueChange={(v) => setSelectedStatus(v === "all" ? "" : v)}>
                <SelectTrigger className="bg-slate-700 border-slate-600 h-9 text-sm">
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
              <Label className="text-slate-400 text-xs mb-1 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Serial, Customer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 bg-slate-700 border-slate-600 h-9 text-sm" />
              </div>
            </div>
            <div className="flex items-end">
              <Button
                variant={showUnmappedOnly ? "default" : "outline"}
                size="sm"
                className={`w-full h-9 ${showUnmappedOnly ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                onClick={() => setShowUnmappedOnly(!showUnmappedOnly)}
              >
                <AlertCircle className="w-4 h-4 mr-1" />
                Unmapped Only
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-white">{summary.total}</p>
            <p className="text-xs text-slate-400">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-green-700 border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{summary.in_stock}</p>
            <p className="text-xs text-slate-400">In Stock</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-blue-700 border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{summary.dispatched}</p>
            <p className="text-xs text-slate-400">Dispatched</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-orange-700 border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-orange-400">{summary.returned}</p>
            <p className="text-xs text-slate-400">Returned</p>
          </CardContent>
        </Card>
        <Card className={`bg-slate-800 ${summary.unmapped_count > 0 ? 'border-red-700 border-2' : 'border-slate-700'}`}>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${summary.unmapped_count > 0 ? 'text-red-400' : 'text-slate-400'}`}>{summary.unmapped_count}</p>
            <p className="text-xs text-slate-400">No SKU</p>
          </CardContent>
        </Card>
        <Card className={`bg-slate-800 ${summary.alerts_count > 0 ? 'border-yellow-700 border' : 'border-slate-700'}`}>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${summary.alerts_count > 0 ? 'text-yellow-400' : 'text-slate-400'}`}>{summary.alerts_count}</p>
            <p className="text-xs text-slate-400">Alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Unmapped SKU Alert Banner */}
      {summary.unmapped_count > 0 && !showUnmappedOnly && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-200">
              <strong>{summary.unmapped_count} serial numbers</strong> are missing SKU mapping. 
              They won't appear in inventory reports.
            </span>
          </div>
          <Button size="sm" variant="outline" className="border-red-600 text-red-400 hover:bg-red-900/50"
            onClick={() => setShowUnmappedOnly(true)}>
            View & Fix
          </Button>
        </div>
      )}

      {/* Bulk Map Button for Unmapped */}
      {showUnmappedOnly && unmappedCount > 0 && (
        <div className="mb-4 flex justify-end">
          <Button onClick={openBulkMapDialog} className="bg-purple-600 hover:bg-purple-700">
            <Link2 className="w-4 h-4 mr-2" />
            Bulk Map {unmappedCount} Serials to SKU
          </Button>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
            <p className="text-slate-400">Loading...</p>
          </CardContent>
        </Card>
      ) : serials.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No serial numbers found</p>
            <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or search query</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="py-3 px-4 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {selectedSkuInfo ? `${selectedSkuInfo.name}` : 'All Serial Numbers'}
              </CardTitle>
              <Badge className="bg-cyan-600">{serials.length} records</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-800 z-10">
                  <TableRow className="border-slate-700">
                    <TableHead className="text-cyan-400 w-10">#</TableHead>
                    <TableHead className="text-cyan-400">Serial Number</TableHead>
                    <TableHead className="text-cyan-400">SKU</TableHead>
                    <TableHead className="text-cyan-400">Status</TableHead>
                    <TableHead className="text-cyan-400">Customer</TableHead>
                    <TableHead className="text-cyan-400">Phone</TableHead>
                    <TableHead className="text-cyan-400">Order ID</TableHead>
                    <TableHead className="text-cyan-400">Date</TableHead>
                    <TableHead className="text-cyan-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serials.map((serial, idx) => (
                    <TableRow key={serial.id} className={`border-slate-700 hover:bg-slate-750 ${!serial.master_sku_id ? 'bg-red-900/10' : ''}`}>
                      <TableCell className="text-slate-500 text-sm">{idx + 1}</TableCell>
                      <TableCell className="font-mono font-semibold text-white">{serial.serial_number}</TableCell>
                      <TableCell>
                        {serial.master_sku_id ? (
                          <span className="text-sm text-slate-300">{serial.sku_code || '-'}</span>
                        ) : (
                          <Badge className="bg-red-800 text-red-200 text-xs cursor-pointer" onClick={() => openMapSkuDialog(serial)}>
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Map SKU
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(serial.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <User className="w-3 h-3 text-slate-500" />
                          <span className="max-w-[120px] truncate">{serial.dispatch_info?.customer_name || serial.customer_name || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {serial.dispatch_info?.phone || serial.phone || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-400 max-w-[100px] truncate">
                        {serial.dispatch_info?.order_id || serial.order_id || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-400">
                        {formatDate(serial.dispatch_info?.dispatch_date || serial.dispatch_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(serial)}
                            className="h-7 w-7 p-0 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          {!serial.master_sku_id && (
                            <Button variant="ghost" size="sm" onClick={() => openMapSkuDialog(serial)}
                              className="h-7 w-7 p-0 text-purple-400 hover:text-purple-300 hover:bg-purple-900/20" title="Map SKU">
                              <Link2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {serial.status === 'dispatched' && serial.master_sku_id && (
                            <Button variant="ghost" size="sm" onClick={() => openSwapDialog(serial)}
                              className="h-7 w-7 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20" title="Swap">
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedSerial(serial); setDeleteDialogOpen(true); }}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-yellow-400" />
              Edit Serial Number
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Serial: <span className="font-mono font-bold text-white">{selectedSerial?.serial_number}</span>
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
              <Input value={editForm.notes} onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                placeholder="Add notes..." className="bg-slate-700 border-slate-600 mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} className="bg-yellow-600 hover:bg-yellow-700">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Map SKU Dialog */}
      <Dialog open={mapSkuDialogOpen} onOpenChange={setMapSkuDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-purple-400" />
              {selectedSerial ? 'Map Serial to SKU' : `Bulk Map ${bulkMapSerials.length} Serials`}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedSerial ? (
                <>Serial: <span className="font-mono font-bold text-white">{selectedSerial.serial_number}</span></>
              ) : (
                <>Map all {bulkMapSerials.length} unmapped serials to a Master SKU</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-300">Select Master SKU *</Label>
              <Select value={mapSkuId} onValueChange={setMapSkuId}>
                <SelectTrigger className="bg-slate-700 border-slate-600 mt-1">
                  <SelectValue placeholder="Select a SKU" />
                </SelectTrigger>
                <SelectContent>
                  {allSkus.map(sku => (
                    <SelectItem key={sku.id} value={sku.id}>
                      {sku.sku_code} - {sku.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!selectedSerial && bulkMapSerials.length > 0 && (
              <div className="max-h-40 overflow-y-auto p-2 bg-slate-700 rounded text-xs">
                <p className="text-slate-400 mb-2">Serials to map:</p>
                {bulkMapSerials.slice(0, 10).map(s => (
                  <p key={s.id} className="font-mono">{s.serial_number}</p>
                ))}
                {bulkMapSerials.length > 10 && <p className="text-slate-500">...and {bulkMapSerials.length - 10} more</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapSkuDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMapSku} className="bg-purple-600 hover:bg-purple-700">Map SKU</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swap Dialog */}
      <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
              Swap Serial Numbers
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="p-3 bg-cyan-900/30 border border-cyan-700 rounded-lg mb-4">
              <p className="text-xs text-cyan-300 mb-1">Serial 1:</p>
              <p className="font-mono font-bold">{swapSerial1?.serial_number}</p>
              <p className="text-sm text-slate-300">{swapSerial1?.dispatch_info?.customer_name || swapSerial1?.customer_name}</p>
            </div>
            <div className="text-center mb-4">
              <ArrowLeftRight className="w-6 h-6 text-cyan-400 mx-auto" />
            </div>
            <div>
              <Label className="text-slate-300">Select Serial 2 to swap with:</Label>
              <Select value={swapSerial2Id} onValueChange={setSwapSerial2Id}>
                <SelectTrigger className="bg-slate-700 border-slate-600 mt-1">
                  <SelectValue placeholder="Select a serial" />
                </SelectTrigger>
                <SelectContent>
                  {dispatchesForSwap.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.serial_number} → {s.dispatch_info?.customer_name || s.customer_name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSwap} disabled={!swapSerial2Id} className="bg-cyan-600 hover:bg-cyan-700">Swap</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              Delete Serial Number
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete serial <span className="font-mono font-bold text-white">{selectedSerial?.serial_number}</span>? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

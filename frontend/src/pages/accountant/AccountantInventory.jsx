import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Package, Plus, Loader2, Edit2, Eye, Boxes, ArrowRightLeft,
  AlertTriangle, TrendingUp, TrendingDown, Building2, FileText, ClipboardList
} from 'lucide-react';

const UNITS = ['pcs', 'kg', 'litre', 'meter', 'set', 'box', 'pack'];

const ENTRY_TYPE_LABELS = {
  purchase: 'Purchase',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  adjustment_in: 'Adjustment (+)',
  adjustment_out: 'Adjustment (-)',
  dispatch_out: 'Dispatch (Sale)',
  return_in: 'Return Received',
  repair_yard_in: 'Repair Yard In'
};

const ENTRY_TYPE_COLORS = {
  purchase: 'bg-green-600',
  transfer_in: 'bg-blue-600',
  transfer_out: 'bg-orange-600',
  adjustment_in: 'bg-cyan-600',
  adjustment_out: 'bg-red-600',
  dispatch_out: 'bg-purple-600',
  return_in: 'bg-teal-600',
  repair_yard_in: 'bg-yellow-600'
};

export default function AccountantInventory() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('stock');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [firms, setFirms] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [stockData, setStockData] = useState({ raw_materials: [], finished_goods: [], summary: {} });
  
  // Filter states
  const [selectedFirm, setSelectedFirm] = useState('all');
  
  // Dialog states
  const [createMaterialOpen, setCreateMaterialOpen] = useState(false);
  const [createLedgerOpen, setCreateLedgerOpen] = useState(false);
  const [createTransferOpen, setCreateTransferOpen] = useState(false);
  const [viewLedgerOpen, setViewLedgerOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [materialForm, setMaterialForm] = useState({
    name: '', sku_code: '', unit: '', hsn_code: '', reorder_level: 10, firm_id: ''
  });
  
  const [ledgerForm, setLedgerForm] = useState({
    entry_type: '', item_type: 'raw_material', item_id: '', firm_id: '',
    quantity: '', unit_price: '', invoice_number: '', reason: '', notes: ''
  });
  
  const [transferForm, setTransferForm] = useState({
    item_type: 'raw_material', item_id: '', from_firm_id: '', to_firm_id: '',
    quantity: '', invoice_number: '', notes: ''
  });

  useEffect(() => {
    fetchAllData();
  }, [token]);

  const fetchAllData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [firmsRes, rawMaterialsRes, ledgerRes, transfersRes, stockRes] = await Promise.all([
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        axios.get(`${API}/raw-materials`, { headers }),
        axios.get(`${API}/inventory/ledger`, { headers, params: { limit: 200 } }),
        axios.get(`${API}/inventory/transfers`, { headers, params: { limit: 100 } }),
        axios.get(`${API}/inventory/stock`, { headers })
      ]);
      
      setFirms(firmsRes.data || []);
      setRawMaterials(rawMaterialsRes.data || []);
      setLedgerEntries(ledgerRes.data || []);
      setTransfers(transfersRes.data || []);
      setStockData(stockRes.data || { raw_materials: [], finished_goods: [], summary: {} });
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const resetMaterialForm = () => {
    setMaterialForm({ name: '', sku_code: '', unit: '', hsn_code: '', reorder_level: 10, firm_id: '' });
  };

  const resetLedgerForm = () => {
    setLedgerForm({
      entry_type: '', item_type: 'raw_material', item_id: '', firm_id: '',
      quantity: '', unit_price: '', invoice_number: '', reason: '', notes: ''
    });
  };

  const resetTransferForm = () => {
    setTransferForm({
      item_type: 'raw_material', item_id: '', from_firm_id: '', to_firm_id: '',
      quantity: '', invoice_number: '', notes: ''
    });
  };

  const handleCreateMaterial = async () => {
    if (!materialForm.name || !materialForm.sku_code || !materialForm.unit || !materialForm.firm_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/raw-materials`, materialForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Raw material created successfully');
      setCreateMaterialOpen(false);
      resetMaterialForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create raw material');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateLedgerEntry = async () => {
    if (!ledgerForm.entry_type || !ledgerForm.item_id || !ledgerForm.firm_id || !ledgerForm.quantity) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Mandatory reason for adjustments
    if (['adjustment_in', 'adjustment_out'].includes(ledgerForm.entry_type)) {
      if (!ledgerForm.reason || !ledgerForm.reason.trim()) {
        toast.error('Reason is MANDATORY for stock adjustments');
        return;
      }
    }

    const quantity = parseInt(ledgerForm.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Quantity must be a positive number');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        ...ledgerForm,
        quantity,
        unit_price: ledgerForm.unit_price ? parseFloat(ledgerForm.unit_price) : null
      };
      
      await axios.post(`${API}/inventory/ledger`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Ledger entry created successfully');
      setCreateLedgerOpen(false);
      resetLedgerForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create ledger entry');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTransfer = async () => {
    if (!transferForm.item_id || !transferForm.from_firm_id || !transferForm.to_firm_id || !transferForm.quantity || !transferForm.invoice_number) {
      toast.error('Please fill in all required fields including Invoice Number');
      return;
    }

    if (transferForm.from_firm_id === transferForm.to_firm_id) {
      toast.error('Source and destination firm cannot be the same');
      return;
    }

    const quantity = parseInt(transferForm.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Quantity must be a positive number');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/inventory/transfer`, {
        ...transferForm,
        quantity
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Stock transfer completed successfully');
      setCreateTransferOpen(false);
      resetTransferForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create transfer');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter raw materials by selected firm
  const filteredMaterials = selectedFirm === 'all' 
    ? rawMaterials 
    : rawMaterials.filter(m => m.firm_id === selectedFirm);

  const filteredStock = selectedFirm === 'all'
    ? stockData.raw_materials
    : stockData.raw_materials.filter(s => s.firm_id === selectedFirm);

  const filteredLedger = selectedFirm === 'all'
    ? ledgerEntries
    : ledgerEntries.filter(e => e.firm_id === selectedFirm);

  // Get materials for selected firm in ledger form
  const materialsForLedger = ledgerForm.firm_id 
    ? rawMaterials.filter(m => m.firm_id === ledgerForm.firm_id)
    : [];

  // Get materials for source firm in transfer form
  const materialsForTransfer = transferForm.from_firm_id
    ? rawMaterials.filter(m => m.firm_id === transferForm.from_firm_id)
    : [];

  if (loading) {
    return (
      <DashboardLayout title="Inventory Management">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Inventory Management">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            title="Total Raw Materials" 
            value={stockData.summary.total_raw_materials || 0}
            icon={Package}
            color="cyan"
          />
          <StatCard 
            title="Active Firms" 
            value={firms.length}
            icon={Building2}
            color="blue"
          />
          <StatCard 
            title="Low Stock Alerts" 
            value={stockData.summary.low_stock_alerts || 0}
            icon={AlertTriangle}
            color={stockData.summary.low_stock_alerts > 0 ? 'orange' : 'green'}
          />
          <StatCard 
            title="Recent Transfers" 
            value={transfers.length}
            icon={ArrowRightLeft}
            color="purple"
          />
        </div>

        {/* Firm Filter */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <Label className="text-slate-300">Filter by Firm:</Label>
                <Select value={selectedFirm} onValueChange={setSelectedFirm}>
                  <SelectTrigger className="w-[200px] bg-slate-700 border-slate-600 text-white" data-testid="firm-filter">
                    <SelectValue placeholder="All Firms" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all" className="text-white">All Firms</SelectItem>
                    {firms.map(firm => (
                      <SelectItem key={firm.id} value={firm.id} className="text-white">
                        {firm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => { resetMaterialForm(); setCreateMaterialOpen(true); }}
                  className="bg-cyan-600 hover:bg-cyan-700"
                  data-testid="add-material-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Raw Material
                </Button>
                <Button 
                  onClick={() => { resetLedgerForm(); setCreateLedgerOpen(true); }}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="add-ledger-btn"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Add Stock Entry
                </Button>
                <Button 
                  onClick={() => { resetTransferForm(); setCreateTransferOpen(true); }}
                  className="bg-orange-600 hover:bg-orange-700"
                  data-testid="transfer-stock-btn"
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Transfer Stock
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="stock" className="data-[state=active]:bg-cyan-600">
              <Boxes className="w-4 h-4 mr-2" />
              Current Stock
            </TabsTrigger>
            <TabsTrigger value="materials" className="data-[state=active]:bg-cyan-600">
              <Package className="w-4 h-4 mr-2" />
              Raw Materials
            </TabsTrigger>
            <TabsTrigger value="ledger" className="data-[state=active]:bg-cyan-600">
              <ClipboardList className="w-4 h-4 mr-2" />
              Ledger
            </TabsTrigger>
            <TabsTrigger value="transfers" className="data-[state=active]:bg-cyan-600">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Transfers
            </TabsTrigger>
          </TabsList>

          {/* Current Stock Tab */}
          <TabsContent value="stock">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Current Stock Levels</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredStock.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Boxes className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No stock data available</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">SKU Code</TableHead>
                          <TableHead className="text-slate-300">Name</TableHead>
                          <TableHead className="text-slate-300">Firm</TableHead>
                          <TableHead className="text-slate-300">Unit</TableHead>
                          <TableHead className="text-slate-300 text-right">Stock</TableHead>
                          <TableHead className="text-slate-300 text-right">Reorder Level</TableHead>
                          <TableHead className="text-slate-300">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStock.map((item) => (
                          <TableRow key={item.id} className="border-slate-700">
                            <TableCell className="text-white font-mono">{item.sku_code}</TableCell>
                            <TableCell className="text-white">{item.name}</TableCell>
                            <TableCell className="text-slate-300">{item.firm_name}</TableCell>
                            <TableCell className="text-slate-300">{item.unit}</TableCell>
                            <TableCell className={`text-right font-medium ${item.is_negative ? 'text-red-400' : item.is_low_stock ? 'text-orange-400' : 'text-green-400'}`}>
                              {item.current_stock}
                            </TableCell>
                            <TableCell className="text-slate-300 text-right">{item.reorder_level}</TableCell>
                            <TableCell>
                              {item.is_negative ? (
                                <Badge className="bg-red-600">Negative Stock</Badge>
                              ) : item.is_low_stock ? (
                                <Badge className="bg-orange-600">Low Stock</Badge>
                              ) : (
                                <Badge className="bg-green-600">OK</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Raw Materials Tab */}
          <TabsContent value="materials">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Raw Materials Master</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredMaterials.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No raw materials found</p>
                    <p className="text-sm mt-2">Click "Add Raw Material" to create one</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">SKU Code</TableHead>
                          <TableHead className="text-slate-300">Name</TableHead>
                          <TableHead className="text-slate-300">Firm</TableHead>
                          <TableHead className="text-slate-300">Unit</TableHead>
                          <TableHead className="text-slate-300">HSN Code</TableHead>
                          <TableHead className="text-slate-300 text-right">Current Stock</TableHead>
                          <TableHead className="text-slate-300 text-right">Reorder Level</TableHead>
                          <TableHead className="text-slate-300">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMaterials.map((material) => (
                          <TableRow key={material.id} className="border-slate-700">
                            <TableCell className="text-white font-mono">{material.sku_code}</TableCell>
                            <TableCell className="text-white">{material.name}</TableCell>
                            <TableCell className="text-slate-300">{material.firm_name}</TableCell>
                            <TableCell className="text-slate-300">{material.unit}</TableCell>
                            <TableCell className="text-slate-400">{material.hsn_code || '-'}</TableCell>
                            <TableCell className="text-white text-right font-medium">{material.current_stock}</TableCell>
                            <TableCell className="text-slate-300 text-right">{material.reorder_level}</TableCell>
                            <TableCell>
                              <Badge className={material.is_active ? 'bg-green-600' : 'bg-red-600'}>
                                {material.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ledger Tab */}
          <TabsContent value="ledger">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Inventory Ledger</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredLedger.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No ledger entries found</p>
                    <p className="text-sm mt-2">Stock changes will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">Entry #</TableHead>
                          <TableHead className="text-slate-300">Type</TableHead>
                          <TableHead className="text-slate-300">Item</TableHead>
                          <TableHead className="text-slate-300">Firm</TableHead>
                          <TableHead className="text-slate-300 text-right">Qty</TableHead>
                          <TableHead className="text-slate-300 text-right">Balance</TableHead>
                          <TableHead className="text-slate-300">Invoice</TableHead>
                          <TableHead className="text-slate-300">Date</TableHead>
                          <TableHead className="text-slate-300">By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLedger.map((entry) => (
                          <TableRow 
                            key={entry.id} 
                            className="border-slate-700 cursor-pointer hover:bg-slate-700/50"
                            onClick={() => { setSelectedEntry(entry); setViewLedgerOpen(true); }}
                          >
                            <TableCell className="text-white font-mono text-sm">{entry.entry_number}</TableCell>
                            <TableCell>
                              <Badge className={ENTRY_TYPE_COLORS[entry.entry_type]}>
                                {ENTRY_TYPE_LABELS[entry.entry_type]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-white">
                              <div>{entry.item_name}</div>
                              <div className="text-xs text-slate-400">{entry.item_sku}</div>
                            </TableCell>
                            <TableCell className="text-slate-300">{entry.firm_name}</TableCell>
                            <TableCell className={`text-right font-medium ${
                              ['purchase', 'transfer_in', 'adjustment_in'].includes(entry.entry_type) 
                                ? 'text-green-400' 
                                : 'text-red-400'
                            }`}>
                              {['purchase', 'transfer_in', 'adjustment_in'].includes(entry.entry_type) ? '+' : '-'}
                              {entry.quantity}
                            </TableCell>
                            <TableCell className="text-white text-right">{entry.running_balance}</TableCell>
                            <TableCell className="text-slate-400 text-sm">{entry.invoice_number || '-'}</TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {new Date(entry.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">{entry.created_by_name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transfers Tab */}
          <TabsContent value="transfers">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Stock Transfers</CardTitle>
              </CardHeader>
              <CardContent>
                {transfers.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No stock transfers yet</p>
                    <p className="text-sm mt-2">Inter-firm transfers will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">Transfer #</TableHead>
                          <TableHead className="text-slate-300">Item</TableHead>
                          <TableHead className="text-slate-300">From</TableHead>
                          <TableHead className="text-slate-300">To</TableHead>
                          <TableHead className="text-slate-300 text-right">Quantity</TableHead>
                          <TableHead className="text-slate-300">Invoice #</TableHead>
                          <TableHead className="text-slate-300">Date</TableHead>
                          <TableHead className="text-slate-300">By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transfers.map((transfer) => (
                          <TableRow key={transfer.id} className="border-slate-700">
                            <TableCell className="text-white font-mono text-sm">{transfer.transfer_number}</TableCell>
                            <TableCell className="text-white">
                              <div>{transfer.item_name}</div>
                              <div className="text-xs text-slate-400">{transfer.item_sku}</div>
                            </TableCell>
                            <TableCell className="text-orange-400">{transfer.from_firm_name}</TableCell>
                            <TableCell className="text-green-400">{transfer.to_firm_name}</TableCell>
                            <TableCell className="text-white text-right font-medium">{transfer.quantity}</TableCell>
                            <TableCell className="text-cyan-400 font-mono">{transfer.invoice_number}</TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {new Date(transfer.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">{transfer.created_by_name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Raw Material Dialog */}
        <Dialog open={createMaterialOpen} onOpenChange={setCreateMaterialOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Raw Material</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Firm *</Label>
                <Select
                  value={materialForm.firm_id}
                  onValueChange={(value) => setMaterialForm({...materialForm, firm_id: value})}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1" data-testid="material-firm-select">
                    <SelectValue placeholder="Select firm" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {firms.map(firm => (
                      <SelectItem key={firm.id} value={firm.id} className="text-white">
                        {firm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Name *</Label>
                  <Input
                    value={materialForm.name}
                    onChange={(e) => setMaterialForm({...materialForm, name: e.target.value})}
                    placeholder="e.g., Copper Wire"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    data-testid="material-name-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">SKU Code *</Label>
                  <Input
                    value={materialForm.sku_code}
                    onChange={(e) => setMaterialForm({...materialForm, sku_code: e.target.value.toUpperCase()})}
                    placeholder="e.g., RM-CU-001"
                    className="bg-slate-700 border-slate-600 text-white mt-1 font-mono"
                    data-testid="material-sku-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Unit *</Label>
                  <Select
                    value={materialForm.unit}
                    onValueChange={(value) => setMaterialForm({...materialForm, unit: value})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1" data-testid="material-unit-select">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {UNITS.map(unit => (
                        <SelectItem key={unit} value={unit} className="text-white">
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">HSN Code</Label>
                  <Input
                    value={materialForm.hsn_code}
                    onChange={(e) => setMaterialForm({...materialForm, hsn_code: e.target.value})}
                    placeholder="e.g., 7408"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    data-testid="material-hsn-input"
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-300">Reorder Level</Label>
                <Input
                  type="number"
                  value={materialForm.reorder_level}
                  onChange={(e) => setMaterialForm({...materialForm, reorder_level: parseInt(e.target.value) || 0})}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  data-testid="material-reorder-input"
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setCreateMaterialOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleCreateMaterial} 
                disabled={actionLoading}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="save-material-btn"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Material
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Ledger Entry Dialog */}
        <Dialog open={createLedgerOpen} onOpenChange={setCreateLedgerOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Stock Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Entry Type *</Label>
                  <Select
                    value={ledgerForm.entry_type}
                    onValueChange={(value) => setLedgerForm({...ledgerForm, entry_type: value})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1" data-testid="ledger-type-select">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="purchase" className="text-white">Purchase (Inward)</SelectItem>
                      <SelectItem value="adjustment_in" className="text-white">Adjustment (+)</SelectItem>
                      <SelectItem value="adjustment_out" className="text-white">Adjustment (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Firm *</Label>
                  <Select
                    value={ledgerForm.firm_id}
                    onValueChange={(value) => setLedgerForm({...ledgerForm, firm_id: value, item_id: ''})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1" data-testid="ledger-firm-select">
                      <SelectValue placeholder="Select firm" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {firms.map(firm => (
                        <SelectItem key={firm.id} value={firm.id} className="text-white">
                          {firm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-slate-300">Raw Material *</Label>
                <Select
                  value={ledgerForm.item_id}
                  onValueChange={(value) => setLedgerForm({...ledgerForm, item_id: value})}
                  disabled={!ledgerForm.firm_id}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1" data-testid="ledger-item-select">
                    <SelectValue placeholder={ledgerForm.firm_id ? "Select item" : "Select firm first"} />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {materialsForLedger.map(material => (
                      <SelectItem key={material.id} value={material.id} className="text-white">
                        {material.name} ({material.sku_code}) - Stock: {material.current_stock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Quantity *</Label>
                  <Input
                    type="number"
                    value={ledgerForm.quantity}
                    onChange={(e) => setLedgerForm({...ledgerForm, quantity: e.target.value})}
                    placeholder="Enter quantity"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    min="1"
                    data-testid="ledger-qty-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Unit Price</Label>
                  <Input
                    type="number"
                    value={ledgerForm.unit_price}
                    onChange={(e) => setLedgerForm({...ledgerForm, unit_price: e.target.value})}
                    placeholder="Optional"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    step="0.01"
                    data-testid="ledger-price-input"
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-300">Invoice / Reference Number</Label>
                <Input
                  value={ledgerForm.invoice_number}
                  onChange={(e) => setLedgerForm({...ledgerForm, invoice_number: e.target.value})}
                  placeholder="e.g., INV-2024-001"
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  data-testid="ledger-invoice-input"
                />
              </div>
              <div>
                <Label className="text-slate-300">
                  Reason / Notes 
                  {['adjustment_in', 'adjustment_out'].includes(ledgerForm.entry_type) && (
                    <span className="text-orange-400 ml-1">* (Mandatory for adjustments)</span>
                  )}
                </Label>
                <Textarea
                  value={ledgerForm.reason}
                  onChange={(e) => setLedgerForm({...ledgerForm, reason: e.target.value})}
                  placeholder={['adjustment_in', 'adjustment_out'].includes(ledgerForm.entry_type) 
                    ? "MANDATORY: Enter reason for this adjustment" 
                    : "Enter reason for this entry"}
                  className={`bg-slate-700 border-slate-600 text-white mt-1 ${
                    ['adjustment_in', 'adjustment_out'].includes(ledgerForm.entry_type) && !ledgerForm.reason 
                      ? 'border-orange-500' 
                      : ''
                  }`}
                  rows={2}
                  data-testid="ledger-reason-input"
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setCreateLedgerOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleCreateLedgerEntry} 
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700"
                data-testid="save-ledger-btn"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Transfer Dialog */}
        <Dialog open={createTransferOpen} onOpenChange={setCreateTransferOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Transfer Stock Between Firms</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-orange-900/30 border border-orange-700 rounded-lg">
                <p className="text-orange-300 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Invoice number is <strong>mandatory</strong> for GST compliance
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">From Firm *</Label>
                  <Select
                    value={transferForm.from_firm_id}
                    onValueChange={(value) => setTransferForm({...transferForm, from_firm_id: value, item_id: ''})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1" data-testid="transfer-from-select">
                      <SelectValue placeholder="Source firm" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {firms.map(firm => (
                        <SelectItem key={firm.id} value={firm.id} className="text-white">
                          {firm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">To Firm *</Label>
                  <Select
                    value={transferForm.to_firm_id}
                    onValueChange={(value) => setTransferForm({...transferForm, to_firm_id: value})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1" data-testid="transfer-to-select">
                      <SelectValue placeholder="Destination firm" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {firms.filter(f => f.id !== transferForm.from_firm_id).map(firm => (
                        <SelectItem key={firm.id} value={firm.id} className="text-white">
                          {firm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-slate-300">Raw Material *</Label>
                <Select
                  value={transferForm.item_id}
                  onValueChange={(value) => setTransferForm({...transferForm, item_id: value})}
                  disabled={!transferForm.from_firm_id}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1" data-testid="transfer-item-select">
                    <SelectValue placeholder={transferForm.from_firm_id ? "Select item to transfer" : "Select source firm first"} />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {materialsForTransfer.map(material => (
                      <SelectItem key={material.id} value={material.id} className="text-white">
                        {material.name} ({material.sku_code}) - Available: {material.current_stock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Quantity *</Label>
                  <Input
                    type="number"
                    value={transferForm.quantity}
                    onChange={(e) => setTransferForm({...transferForm, quantity: e.target.value})}
                    placeholder="Enter quantity"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    min="1"
                    data-testid="transfer-qty-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Invoice Number * (GST)</Label>
                  <Input
                    value={transferForm.invoice_number}
                    onChange={(e) => setTransferForm({...transferForm, invoice_number: e.target.value})}
                    placeholder="e.g., GST/TRF/2024/001"
                    className="bg-slate-700 border-slate-600 text-white mt-1 border-orange-500"
                    data-testid="transfer-invoice-input"
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-300">Notes</Label>
                <Textarea
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({...transferForm, notes: e.target.value})}
                  placeholder="Additional notes for this transfer"
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  rows={2}
                  data-testid="transfer-notes-input"
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setCreateTransferOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTransfer} 
                disabled={actionLoading || !transferForm.invoice_number}
                className="bg-orange-600 hover:bg-orange-700"
                data-testid="execute-transfer-btn"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Execute Transfer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Ledger Entry Dialog */}
        <Dialog open={viewLedgerOpen} onOpenChange={setViewLedgerOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-cyan-500" />
                Ledger Entry Details
              </DialogTitle>
            </DialogHeader>
            {selectedEntry && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">Entry Number</Label>
                    <p className="text-white font-mono">{selectedEntry.entry_number}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Type</Label>
                    <Badge className={ENTRY_TYPE_COLORS[selectedEntry.entry_type]}>
                      {ENTRY_TYPE_LABELS[selectedEntry.entry_type]}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Item</Label>
                    <p className="text-white">{selectedEntry.item_name}</p>
                    <p className="text-slate-400 text-xs">{selectedEntry.item_sku}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Firm</Label>
                    <p className="text-white">{selectedEntry.firm_name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Quantity</Label>
                    <p className={`font-medium ${
                      ['purchase', 'transfer_in', 'adjustment_in'].includes(selectedEntry.entry_type) 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {['purchase', 'transfer_in', 'adjustment_in'].includes(selectedEntry.entry_type) ? '+' : '-'}
                      {selectedEntry.quantity}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Running Balance</Label>
                    <p className="text-white font-medium">{selectedEntry.running_balance}</p>
                  </div>
                  {selectedEntry.unit_price && (
                    <>
                      <div>
                        <Label className="text-slate-400 text-xs">Unit Price</Label>
                        <p className="text-white">₹{selectedEntry.unit_price}</p>
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs">Total Value</Label>
                        <p className="text-white">₹{selectedEntry.total_value}</p>
                      </div>
                    </>
                  )}
                  {selectedEntry.invoice_number && (
                    <div className="col-span-2">
                      <Label className="text-slate-400 text-xs">Invoice Number</Label>
                      <p className="text-cyan-400 font-mono">{selectedEntry.invoice_number}</p>
                    </div>
                  )}
                  {selectedEntry.reason && (
                    <div className="col-span-2">
                      <Label className="text-slate-400 text-xs">Reason</Label>
                      <p className="text-white">{selectedEntry.reason}</p>
                    </div>
                  )}
                  <div className="col-span-2 pt-2 border-t border-slate-700">
                    <Label className="text-slate-400 text-xs">Created By</Label>
                    <p className="text-white">{selectedEntry.created_by_name}</p>
                    <p className="text-slate-400 text-xs">{new Date(selectedEntry.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setViewLedgerOpen(false)} className="text-slate-300">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

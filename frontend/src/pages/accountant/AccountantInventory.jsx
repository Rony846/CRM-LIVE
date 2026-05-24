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
  AlertTriangle, TrendingUp, TrendingDown, Building2, FileText, ClipboardList, Factory, Edit
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
  repair_yard_in: 'Repair Yard In',
  production_consume: 'Production (Consumed)',
  production_output: 'Production (Output)'
};

const ENTRY_TYPE_COLORS = {
  purchase:           'rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25',
  transfer_in:        'rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-primary/15 text-primary ring-1 ring-primary/25',
  transfer_out:       'rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25',
  adjustment_in:      'rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/25',
  adjustment_out:     'rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25',
  dispatch_out:       'rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-violet-400/15 text-violet-400 ring-1 ring-violet-400/25',
  return_in:          'rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-teal-400/15 text-teal-400 ring-1 ring-teal-400/25',
  repair_yard_in:     'rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25',
  production_consume: 'rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-pink-400/15 text-pink-400 ring-1 ring-pink-400/25',
  production_output:  'rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25',
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
  const [skus, setSkus] = useState([]);
  const [stockData, setStockData] = useState({ raw_materials: [], finished_goods: [], master_skus: [], summary: {} });
  const [productions, setProductions] = useState([]);
  
  // Filter states
  const [selectedFirm, setSelectedFirm] = useState('all');
  
  // Dialog states
  const [createMaterialOpen, setCreateMaterialOpen] = useState(false);
  const [editMaterialOpen, setEditMaterialOpen] = useState(false);
  const [createLedgerOpen, setCreateLedgerOpen] = useState(false);
  const [createTransferOpen, setCreateTransferOpen] = useState(false);
  const [viewLedgerOpen, setViewLedgerOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [materialForm, setMaterialForm] = useState({
    name: '', sku_code: '', unit: '', hsn_code: '', gst_rate: '', cost_price: '', reorder_level: 10, description: ''
  });
  
  const [ledgerForm, setLedgerForm] = useState({
    entry_type: '', item_type: 'raw_material', item_id: '', firm_id: '',
    quantity: '', unit_price: '', invoice_number: '', reason: '', notes: ''
  });
  
  const [transferForm, setTransferForm] = useState({
    item_type: 'master_sku', item_id: '', from_firm_id: '', to_firm_id: '',
    quantity: '', invoice_number: '', notes: '', serial_numbers: [],
    unit_price: '', margin_percentage: 15, auto_create_entries: true
  });
  
  // Pricing info state
  const [pricingInfo, setPricingInfo] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, [token]);

  const fetchAllData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [firmsRes, rawMaterialsRes, ledgerRes, transfersRes, stockRes, skusRes, productionsRes] = await Promise.all([
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        axios.get(`${API}/raw-materials`, { headers }),
        axios.get(`${API}/inventory/ledger`, { headers, params: { limit: 200 } }),
        axios.get(`${API}/inventory/transfers`, { headers, params: { limit: 100 } }),
        axios.get(`${API}/inventory/stock`, { headers }),
        axios.get(`${API}/master-skus`, { headers, params: { is_active: true } }),
        axios.get(`${API}/production-requests`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setFirms(firmsRes.data || []);
      setRawMaterials(rawMaterialsRes.data || []);
      setLedgerEntries(ledgerRes.data || []);
      setTransfers(transfersRes.data || []);
      setStockData(stockRes.data || { raw_materials: [], finished_goods: [], master_skus: [], summary: {} });
      setSkus(skusRes.data || []);
      setProductions(productionsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const resetMaterialForm = () => {
    setMaterialForm({ name: '', sku_code: '', unit: '', hsn_code: '', gst_rate: '', cost_price: '', reorder_level: 10, description: '' });
  };

  const resetLedgerForm = () => {
    setLedgerForm({
      entry_type: '', item_type: 'raw_material', item_id: '', firm_id: '',
      quantity: '', unit_price: '', invoice_number: '', reason: '', notes: ''
    });
  };

  const resetTransferForm = () => {
    setTransferForm({
      item_type: 'master_sku', item_id: '', from_firm_id: '', to_firm_id: '',
      quantity: '', invoice_number: '', notes: '', serial_numbers: [],
      unit_price: '', margin_percentage: 15, auto_create_entries: true
    });
    setPricingInfo(null);
  };

  const handleCreateMaterial = async () => {
    if (!materialForm.name || !materialForm.sku_code || !materialForm.unit) {
      toast.error('Please fill in all required fields (Name, SKU Code, Unit)');
      return;
    }
    
    // Validate mandatory financial fields
    if (!materialForm.hsn_code || !materialForm.hsn_code.trim()) {
      toast.error('HSN Code is mandatory');
      return;
    }
    if (materialForm.gst_rate === '' || materialForm.gst_rate === null || materialForm.gst_rate === undefined) {
      toast.error('GST Rate is mandatory');
      return;
    }
    if (materialForm.cost_price === '' || materialForm.cost_price === null || materialForm.cost_price === undefined) {
      toast.error('Cost Price is mandatory');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        ...materialForm,
        gst_rate: parseFloat(materialForm.gst_rate),
        cost_price: parseFloat(materialForm.cost_price)
      };
      await axios.post(`${API}/raw-materials`, payload, {
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

  const handleEditMaterial = async () => {
    if (!selectedMaterial || !materialForm.name || !materialForm.sku_code || !materialForm.unit) {
      toast.error('Please fill in all required fields (Name, SKU Code, Unit)');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        ...materialForm,
        gst_rate: materialForm.gst_rate !== '' ? parseFloat(materialForm.gst_rate) : null,
        cost_price: materialForm.cost_price !== '' ? parseFloat(materialForm.cost_price) : null
      };
      await axios.patch(`${API}/raw-materials/${selectedMaterial.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Raw material updated successfully');
      setEditMaterialOpen(false);
      setSelectedMaterial(null);
      resetMaterialForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update raw material');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditMaterialDialog = (material) => {
    setSelectedMaterial(material);
    setMaterialForm({
      name: material.name || '',
      sku_code: material.sku_code || '',
      unit: material.unit || '',
      hsn_code: material.hsn_code || '',
      gst_rate: material.gst_rate !== null && material.gst_rate !== undefined ? material.gst_rate : '',
      cost_price: material.cost_price !== null && material.cost_price !== undefined ? material.cost_price : '',
      reorder_level: material.reorder_level || 10,
      description: material.description || ''
    });
    setEditMaterialOpen(true);
  };

  const handleCreateLedgerEntry = async () => {
    if (!ledgerForm.entry_type || !ledgerForm.item_id || !ledgerForm.firm_id || !ledgerForm.quantity) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check if this is a manufactured item being added to stock
    if (ledgerForm.item_type === 'master_sku' && ['purchase', 'transfer_in', 'adjustment_in', 'return_in'].includes(ledgerForm.entry_type)) {
      const selectedSku = skus.find(s => s.id === ledgerForm.item_id);
      if (selectedSku && selectedSku.product_type === 'manufactured') {
        toast.error('Manufactured items cannot be added via stock entry. Use Production Request workflow to produce items with serial numbers.');
        return;
      }
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
    
    // Check if manufactured item requires serial numbers
    if (transferForm.item_type === 'master_sku') {
      const selectedSku = skus.find(s => s.id === transferForm.item_id);
      if (selectedSku?.product_type === 'manufactured') {
        if (transferForm.serial_numbers.length === 0) {
          toast.error('Please select serial numbers for manufactured item transfer');
          return;
        }
        if (transferForm.serial_numbers.length !== quantity) {
          toast.error(`Selected ${transferForm.serial_numbers.length} serials but quantity is ${quantity}. They must match.`);
          return;
        }
      }
    }

    setActionLoading(true);
    try {
      // Custom unit price wins over suggested price calculated from margin
      const customPrice = parseFloat(transferForm.unit_price);
      const effectiveUnitPrice = (customPrice && customPrice > 0)
        ? customPrice
        : (pricingInfo?.suggested_unit_price || null);
      
      const payload = {
        ...transferForm,
        quantity,
        unit_price: effectiveUnitPrice,
        margin_percentage: parseFloat(transferForm.margin_percentage) || 15
      };
      
      await axios.post(`${API}/inventory/transfer`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const message = transferForm.auto_create_entries && pricingInfo?.suggested_unit_price
        ? 'Stock transfer completed! Sales Invoice and Purchase Entry created automatically.'
        : 'Stock transfer completed successfully';
      toast.success(message);
      setCreateTransferOpen(false);
      resetTransferForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create transfer');
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch pricing info for transfer
  const fetchPricingInfo = async (itemType, itemId, fromFirmId, qty, margin) => {
    if (!itemType || !itemId || !fromFirmId || !qty) {
      setPricingInfo(null);
      return;
    }
    
    setPricingLoading(true);
    try {
      const response = await axios.get(
        `${API}/inventory/transfer-pricing/${itemType}/${itemId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            from_firm_id: fromFirmId,
            quantity: parseInt(qty) || 1,
            margin_percentage: parseFloat(margin) || 15
          }
        }
      );
      setPricingInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch pricing info:', error);
      setPricingInfo(null);
    } finally {
      setPricingLoading(false);
    }
  };

  // Effect to fetch pricing when relevant fields change
  useEffect(() => {
    if (transferForm.item_id && transferForm.from_firm_id && transferForm.quantity) {
      const debounceTimer = setTimeout(() => {
        fetchPricingInfo(
          transferForm.item_type,
          transferForm.item_id,
          transferForm.from_firm_id,
          transferForm.quantity,
          transferForm.margin_percentage
        );
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setPricingInfo(null);
    }
  }, [transferForm.item_id, transferForm.from_firm_id, transferForm.quantity, transferForm.margin_percentage, transferForm.item_type]);

  // Filter raw materials by selected firm
  // Master SKUs stock - show all SKUs for all firms
  const filteredMasterSKUStock = selectedFirm === 'all'
    ? stockData.master_skus || []
    : (stockData.master_skus || []).filter(s => s.firm_id === selectedFirm);

  // For backward compatibility - raw materials stock
  const filteredRawMaterialStock = selectedFirm === 'all'
    ? stockData.raw_materials || []
    : (stockData.raw_materials || []).filter(s => s.firm_id === selectedFirm);

  const filteredLedger = selectedFirm === 'all'
    ? ledgerEntries
    : ledgerEntries.filter(e => e.firm_id === selectedFirm);

  // Raw materials for ledger form (now global, so show all active)
  const materialsForLedger = rawMaterials.filter(m => m.is_active);

  // Raw materials for transfer form (global, show all for the selected firm)
  const materialsForTransfer = rawMaterials.filter(m => m.is_active).map(m => {
    // Find stock for this material at the source firm - match by id or item_id
    const stockInfo = stockData.raw_materials?.find(s => 
      (s.item_id === m.id || s.id === m.id) && s.firm_id === transferForm.from_firm_id
    );
    return { ...m, current_stock: stockInfo?.current_stock || 0 };
  });

  // Master SKUs for transfer form - show ALL active SKUs (not just those with stock)
  const skusForTransfer = skus.filter(s => s.is_active).map(s => {
    // Find stock for this SKU at the source firm - match by id or item_id
    const stockInfo = stockData.master_skus?.find(st => 
      (st.item_id === s.id || st.id === s.id) && st.firm_id === transferForm.from_firm_id
    );
    return { ...s, current_stock: stockInfo?.current_stock || 0 };
  });

  if (loading) {
    return (
      <DashboardLayout title="Inventory Management">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Inventory Management">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <StatCard 
            title="Master SKUs" 
            value={stockData.summary?.total_master_skus || skus.length}
            icon={Package}
            color="cyan"
          />
          <StatCard 
            title="Raw Materials" 
            value={stockData.summary?.total_raw_materials || 0}
            icon={Boxes}
            color="pink"
          />
          <StatCard 
            title="Active Firms" 
            value={firms.length}
            icon={Building2}
            color="blue"
          />
          <StatCard 
            title="Low Stock Alerts" 
            value={stockData.summary?.low_stock_alerts || 0}
            icon={AlertTriangle}
            color={stockData.summary?.low_stock_alerts > 0 ? 'orange' : 'green'}
          />
          <StatCard 
            title="Recent Transfers" 
            value={transfers.length}
            icon={ArrowRightLeft}
            color="purple"
          />
          <StatCard 
            title="Productions" 
            value={productions.length}
            icon={Factory}
            color="emerald"
          />
        </div>

        {/* Firm Filter */}
        <div className="mg-card rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Firm:</span>
              <Select value={selectedFirm} onValueChange={setSelectedFirm}>
                <SelectTrigger className="w-[200px]" data-testid="firm-filter">
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
            <div className="flex gap-2">
              <Button
                onClick={() => { resetMaterialForm(); setCreateMaterialOpen(true); }}
                className="bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/25 font-mono text-[11px] uppercase tracking-wide"
                variant="ghost"
                data-testid="add-material-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Raw Material
              </Button>
              <Button
                onClick={() => { resetLedgerForm(); setCreateLedgerOpen(true); }}
                className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-500 border border-emerald-500/25 font-mono text-[11px] uppercase tracking-wide"
                variant="ghost"
                data-testid="add-ledger-btn"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Add Stock Entry
              </Button>
              <Button
                onClick={() => { resetTransferForm(); setCreateTransferOpen(true); }}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-[11px] uppercase tracking-wide"
                data-testid="transfer-stock-btn"
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Transfer Stock
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted">
            <TabsTrigger value="stock" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
              <Boxes className="w-4 h-4 mr-2" />
              Current Stock
            </TabsTrigger>
            <TabsTrigger value="materials" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
              <Package className="w-4 h-4 mr-2" />
              Raw Materials
            </TabsTrigger>
            <TabsTrigger value="ledger" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
              <ClipboardList className="w-4 h-4 mr-2" />
              Ledger
            </TabsTrigger>
            <TabsTrigger value="transfers" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Transfers
            </TabsTrigger>
          </TabsList>

          {/* Current Stock Tab */}
          <TabsContent value="stock">
            <Card className="mg-card border border-border bg-card">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-foreground">Current Stock Levels</CardTitle>
                  <div className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    SKUs: {stockData.summary?.total_master_skus || 0} &nbsp;·&nbsp;
                    Raw Mats: {stockData.summary?.total_raw_materials || 0}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Master SKUs Stock Section */}
                <div className="mb-8">
                  <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-emerald-500 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Master SKUs — Finished Goods
                  </h3>
                  {filteredMasterSKUStock.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/40 rounded-lg border border-border">
                      <Boxes className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p className="font-mono text-[11px] uppercase tracking-wide">No Master SKUs defined yet</p>
                      <p className="text-xs mt-1">Go to Master SKUs page to create products</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-muted-foreground">SKU Code</TableHead>
                            <TableHead className="text-muted-foreground">Product Name</TableHead>
                            <TableHead className="text-muted-foreground">Category</TableHead>
                            <TableHead className="text-muted-foreground">Firm</TableHead>
                            <TableHead className="text-muted-foreground">Type</TableHead>
                            <TableHead className="text-muted-foreground text-right">Stock</TableHead>
                            <TableHead className="text-muted-foreground">Serial Numbers</TableHead>
                            <TableHead className="text-muted-foreground">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredMasterSKUStock.map((item, idx) => (
                            <TableRow key={`${item.id}-${item.firm_id}-${idx}`} className="border-border">
                              <TableCell className="font-mono text-sky-400 tabular-nums">{item.sku_code}</TableCell>
                              <TableCell className="text-foreground">{item.name}</TableCell>
                              <TableCell>
                                <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-muted text-muted-foreground ring-1 ring-border">{item.category}</span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{item.firm_name}</TableCell>
                              <TableCell>
                                {item.product_type === 'manufactured' || item.is_manufactured ? (
                                  <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-violet-400/15 text-violet-400 ring-1 ring-violet-400/25">Manufactured</span>
                                ) : (
                                  <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-muted text-muted-foreground ring-1 ring-border">Traded</span>
                                )}
                              </TableCell>
                              <TableCell className={`text-right font-mono tabular-nums font-semibold ${
                                item.is_negative ? 'text-rose-400' :
                                item.is_low_stock ? 'text-amber-400' :
                                item.current_stock > 0 ? 'text-emerald-500' : 'text-muted-foreground'
                              }`}>
                                {item.current_stock}
                              </TableCell>
                              <TableCell>
                                {item.product_type === 'manufactured' && item.serial_numbers?.length > 0 ? (
                                  <div className="max-w-xs">
                                    <div className="flex flex-wrap gap-1">
                                      {item.serial_numbers.slice(0, 3).map((sn, i) => (
                                        <span key={i} className="text-[10px] bg-violet-400/10 text-violet-400 px-2 py-0.5 rounded font-mono ring-1 ring-violet-400/20">
                                          {sn}
                                        </span>
                                      ))}
                                      {item.serial_numbers.length > 3 && (
                                        <span className="text-[10px] text-muted-foreground">+{item.serial_numbers.length - 3} more</span>
                                      )}
                                    </div>
                                  </div>
                                ) : item.product_type === 'manufactured' ? (
                                  <span className="text-[11px] text-muted-foreground">No serials in stock</span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">N/A (Traded)</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.is_negative ? (
                                  <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25">Negative</span>
                                ) : item.is_low_stock ? (
                                  <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25">Low Stock</span>
                                ) : item.current_stock > 0 ? (
                                  <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25">OK</span>
                                ) : (
                                  <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-muted text-muted-foreground ring-1 ring-border">No Stock</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Raw Materials Stock Section */}
                <div>
                  <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-pink-400 mb-3 flex items-center gap-2">
                    <Boxes className="w-4 h-4" />
                    Raw Materials Stock
                  </h3>
                  {filteredRawMaterialStock.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/40 rounded-lg border border-border">
                      <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p className="font-mono text-[11px] uppercase tracking-wide">No raw materials with stock data</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-muted-foreground">SKU Code</TableHead>
                            <TableHead className="text-muted-foreground">Name</TableHead>
                            <TableHead className="text-muted-foreground">Firm</TableHead>
                            <TableHead className="text-muted-foreground">Unit</TableHead>
                            <TableHead className="text-muted-foreground text-right">Stock</TableHead>
                            <TableHead className="text-muted-foreground text-right">Reorder Level</TableHead>
                            <TableHead className="text-muted-foreground">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRawMaterialStock.map((item, index) => (
                            <TableRow key={`${item.id}-${item.firm_id}-${index}`} className="border-border">
                              <TableCell className="font-mono text-foreground tabular-nums">{item.sku_code}</TableCell>
                              <TableCell className="text-foreground">{item.name}</TableCell>
                              <TableCell className="text-muted-foreground">{item.firm_name}</TableCell>
                              <TableCell className="text-muted-foreground font-mono text-[11px] uppercase">{item.unit}</TableCell>
                              <TableCell className={`text-right font-mono tabular-nums font-semibold ${item.is_negative ? 'text-rose-400' : item.is_low_stock ? 'text-amber-400' : 'text-emerald-500'}`}>
                                {item.current_stock}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-right font-mono tabular-nums">{item.reorder_level}</TableCell>
                              <TableCell>
                                {item.is_negative ? (
                                  <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25">Negative</span>
                                ) : item.is_low_stock ? (
                                  <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25">Low Stock</span>
                                ) : (
                                  <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25">OK</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Raw Materials Tab */}
          <TabsContent value="materials">
            <Card className="mg-card border border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Raw Materials Master (Global)</CardTitle>
                <p className="text-muted-foreground text-sm">Raw materials are defined globally. Stock tracked per firm via ledger.</p>
              </CardHeader>
              <CardContent>
                {rawMaterials.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/40 rounded-lg border border-border">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p className="font-mono text-[11px] uppercase tracking-wide">No raw materials found</p>
                    <p className="text-xs mt-2">Click "Add Raw Material" to create one</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">SKU Code</TableHead>
                          <TableHead className="text-muted-foreground">Name</TableHead>
                          <TableHead className="text-muted-foreground">Unit</TableHead>
                          <TableHead className="text-muted-foreground">HSN Code</TableHead>
                          <TableHead className="text-muted-foreground text-right">Total Stock</TableHead>
                          <TableHead className="text-muted-foreground text-right">Reorder Level</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                          <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rawMaterials.map((material) => (
                          <TableRow key={material.id} className="border-border">
                            <TableCell className="font-mono text-foreground tabular-nums">{material.sku_code}</TableCell>
                            <TableCell className="text-foreground">{material.name}</TableCell>
                            <TableCell className="text-muted-foreground font-mono text-[11px] uppercase">{material.unit}</TableCell>
                            <TableCell className="text-muted-foreground font-mono tabular-nums">{material.hsn_code || '-'}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums font-semibold text-foreground">
                              {material.total_stock || 0}
                              {material.stock_by_firm && material.stock_by_firm.length > 0 && (
                                <div className="font-mono text-[10px] text-muted-foreground mt-1">
                                  {material.stock_by_firm.filter(s => s.stock > 0).map((s, i) => (
                                    <span key={s.firm_id}>
                                      {i > 0 && ' · '}{s.firm_name}: {s.stock}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-right font-mono tabular-nums">{material.reorder_level}</TableCell>
                            <TableCell>
                              {material.is_active ? (
                                <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25">Active</span>
                              ) : (
                                <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25">Inactive</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-sky-400 hover:text-sky-300 hover:bg-sky-400/10"
                                onClick={() => openEditMaterialDialog(material)}
                                data-testid={`edit-material-${material.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
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
            <Card className="mg-card border border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Inventory Ledger</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredLedger.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/40 rounded-lg border border-border">
                    <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p className="font-mono text-[11px] uppercase tracking-wide">No ledger entries found</p>
                    <p className="text-xs mt-2">Stock changes will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">Entry #</TableHead>
                          <TableHead className="text-muted-foreground">Type</TableHead>
                          <TableHead className="text-muted-foreground">Item</TableHead>
                          <TableHead className="text-muted-foreground">Firm</TableHead>
                          <TableHead className="text-muted-foreground text-right">Qty</TableHead>
                          <TableHead className="text-muted-foreground text-right">Balance</TableHead>
                          <TableHead className="text-muted-foreground">Invoice</TableHead>
                          <TableHead className="text-muted-foreground">Date</TableHead>
                          <TableHead className="text-muted-foreground">By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLedger.map((entry) => (
                          <TableRow
                            key={entry.id}
                            className="border-border cursor-pointer"
                            onClick={() => { setSelectedEntry(entry); setViewLedgerOpen(true); }}
                          >
                            <TableCell className="font-mono text-foreground tabular-nums text-sm">{entry.entry_number}</TableCell>
                            <TableCell>
                              <span className={ENTRY_TYPE_COLORS[entry.entry_type] || 'rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-muted text-muted-foreground ring-1 ring-border'}>
                                {ENTRY_TYPE_LABELS[entry.entry_type]}
                              </span>
                            </TableCell>
                            <TableCell className="text-foreground">
                              <div>{entry.item_name}</div>
                              <div className="font-mono text-[10px] text-muted-foreground">{entry.item_sku}</div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{entry.firm_name}</TableCell>
                            <TableCell className={`text-right font-mono tabular-nums font-semibold ${
                              ['purchase', 'transfer_in', 'adjustment_in', 'return_in', 'repair_yard_in', 'production_output'].includes(entry.entry_type)
                                ? 'text-emerald-500'
                                : 'text-rose-400'
                            }`}>
                              {['purchase', 'transfer_in', 'adjustment_in', 'return_in', 'repair_yard_in', 'production_output'].includes(entry.entry_type) ? '+' : '-'}
                              {Math.abs(entry.quantity)}
                            </TableCell>
                            <TableCell className="text-foreground text-right font-mono tabular-nums">{entry.running_balance}</TableCell>
                            <TableCell className="text-muted-foreground font-mono text-[11px]">{entry.invoice_number || '-'}</TableCell>
                            <TableCell className="text-muted-foreground font-mono text-[11px] tabular-nums">
                              {new Date(entry.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-[11px]">{entry.created_by_name}</TableCell>
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
            <Card className="mg-card border border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Stock Transfers</CardTitle>
              </CardHeader>
              <CardContent>
                {transfers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/40 rounded-lg border border-border">
                    <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p className="font-mono text-[11px] uppercase tracking-wide">No stock transfers yet</p>
                    <p className="text-xs mt-2">Inter-firm transfers will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">Transfer #</TableHead>
                          <TableHead className="text-muted-foreground">Item</TableHead>
                          <TableHead className="text-muted-foreground">From</TableHead>
                          <TableHead className="text-muted-foreground">To</TableHead>
                          <TableHead className="text-muted-foreground text-right">Quantity</TableHead>
                          <TableHead className="text-muted-foreground">Invoice #</TableHead>
                          <TableHead className="text-muted-foreground">Date</TableHead>
                          <TableHead className="text-muted-foreground">By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transfers.map((transfer) => (
                          <TableRow key={transfer.id} className="border-border">
                            <TableCell className="font-mono text-foreground tabular-nums text-sm">{transfer.transfer_number}</TableCell>
                            <TableCell className="text-foreground">
                              <div>{transfer.item_name}</div>
                              <div className="font-mono text-[10px] text-muted-foreground">{transfer.item_sku}</div>
                            </TableCell>
                            <TableCell className="text-amber-400">{transfer.from_firm_name}</TableCell>
                            <TableCell className="text-emerald-500">{transfer.to_firm_name}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums font-semibold text-foreground">{transfer.quantity}</TableCell>
                            <TableCell className="text-sky-400 font-mono text-[11px]">{transfer.invoice_number}</TableCell>
                            <TableCell className="text-muted-foreground font-mono text-[11px] tabular-nums">
                              {new Date(transfer.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-[11px]">{transfer.created_by_name}</TableCell>
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
          <DialogContent className="bg-popover border border-border rounded-lg max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Add Raw Material (Global)</DialogTitle>
              <p className="text-muted-foreground text-sm mt-1">Raw materials are defined globally. Stock is tracked per firm via ledger entries.</p>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={materialForm.name}
                    onChange={(e) => setMaterialForm({...materialForm, name: e.target.value})}
                    placeholder="e.g., Copper Wire"
                    className="mt-1"
                    data-testid="material-name-input"
                  />
                </div>
                <div>
                  <Label>SKU Code *</Label>
                  <Input
                    value={materialForm.sku_code}
                    onChange={(e) => setMaterialForm({...materialForm, sku_code: e.target.value.toUpperCase()})}
                    placeholder="e.g., RM-CU-001"
                    className="mt-1 font-mono"
                    data-testid="material-sku-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Unit *</Label>
                  <Select
                    value={materialForm.unit}
                    onValueChange={(value) => setMaterialForm({...materialForm, unit: value})}
                  >
                    <SelectTrigger className="mt-1" data-testid="material-unit-select">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>HSN Code *</Label>
                  <Input
                    value={materialForm.hsn_code}
                    onChange={(e) => setMaterialForm({...materialForm, hsn_code: e.target.value})}
                    placeholder="e.g., 7408"
                    className="mt-1"
                    data-testid="material-hsn-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>GST Rate (%) *</Label>
                  <Select
                    value={materialForm.gst_rate?.toString() || ''}
                    onValueChange={(value) => setMaterialForm({...materialForm, gst_rate: value})}
                  >
                    <SelectTrigger className="mt-1" data-testid="material-gst-select">
                      <SelectValue placeholder="Select GST rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="18">18%</SelectItem>
                      <SelectItem value="28">28%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cost Price (₹) *</Label>
                  <Input
                    type="number"
                    value={materialForm.cost_price}
                    onChange={(e) => setMaterialForm({...materialForm, cost_price: e.target.value})}
                    placeholder="e.g., 100"
                    className="mt-1"
                    min="0"
                    step="0.01"
                    data-testid="material-cost-input"
                  />
                </div>
              </div>
              <div>
                <Label>Reorder Level</Label>
                <Input
                  type="number"
                  value={materialForm.reorder_level}
                  onChange={(e) => setMaterialForm({...materialForm, reorder_level: parseInt(e.target.value) || 0})}
                  className="mt-1"
                  data-testid="material-reorder-input"
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setCreateMaterialOpen(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button
                onClick={handleCreateMaterial}
                disabled={actionLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="save-material-btn"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Material
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Raw Material Dialog */}
        <Dialog open={editMaterialOpen} onOpenChange={(open) => {
          setEditMaterialOpen(open);
          if (!open) {
            setSelectedMaterial(null);
            resetMaterialForm();
          }
        }}>
          <DialogContent className="bg-popover border border-border rounded-lg max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Edit Raw Material</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Material Name *</Label>
                  <Input
                    value={materialForm.name}
                    onChange={(e) => setMaterialForm({...materialForm, name: e.target.value})}
                    placeholder="e.g., Copper Wire"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>SKU Code *</Label>
                  <Input
                    value={materialForm.sku_code}
                    onChange={(e) => setMaterialForm({...materialForm, sku_code: e.target.value.toUpperCase()})}
                    placeholder="e.g., RM-CW-001"
                    className="mt-1 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Unit *</Label>
                  <Select
                    value={materialForm.unit}
                    onValueChange={(value) => setMaterialForm({...materialForm, unit: value})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>HSN Code</Label>
                  <Input
                    value={materialForm.hsn_code}
                    onChange={(e) => setMaterialForm({...materialForm, hsn_code: e.target.value})}
                    placeholder="e.g., 7408"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>GST Rate (%)</Label>
                  <Select
                    value={materialForm.gst_rate?.toString() || ''}
                    onValueChange={(value) => setMaterialForm({...materialForm, gst_rate: value})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select GST rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="18">18%</SelectItem>
                      <SelectItem value="28">28%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cost Price (₹)</Label>
                  <Input
                    type="number"
                    value={materialForm.cost_price}
                    onChange={(e) => setMaterialForm({...materialForm, cost_price: e.target.value})}
                    placeholder="e.g., 100"
                    className="mt-1"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <Label>Reorder Level</Label>
                <Input
                  type="number"
                  value={materialForm.reorder_level}
                  onChange={(e) => setMaterialForm({...materialForm, reorder_level: parseInt(e.target.value) || 0})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={materialForm.description}
                  onChange={(e) => setMaterialForm({...materialForm, description: e.target.value})}
                  placeholder="Optional description"
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setEditMaterialOpen(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button
                onClick={handleEditMaterial}
                disabled={actionLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Ledger Entry Dialog */}
        <Dialog open={createLedgerOpen} onOpenChange={setCreateLedgerOpen}>
          <DialogContent className="bg-popover border border-border rounded-lg max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Add Stock Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Entry Type *</Label>
                  <Select
                    value={ledgerForm.entry_type}
                    onValueChange={(value) => setLedgerForm({...ledgerForm, entry_type: value})}
                  >
                    <SelectTrigger className="mt-1" data-testid="ledger-type-select">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchase">Purchase (Inward)</SelectItem>
                      <SelectItem value="adjustment_in">Adjustment (+)</SelectItem>
                      <SelectItem value="adjustment_out">Adjustment (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Item Type *</Label>
                  <Select
                    value={ledgerForm.item_type}
                    onValueChange={(value) => setLedgerForm({...ledgerForm, item_type: value, item_id: ''})}
                  >
                    <SelectTrigger className="mt-1" data-testid="ledger-item-type-select">
                      <SelectValue placeholder="Select item type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw_material">Raw Material</SelectItem>
                      <SelectItem value="master_sku">Master SKU (Finished Good)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Firm *</Label>
                <Select
                  value={ledgerForm.firm_id}
                  onValueChange={(value) => setLedgerForm({...ledgerForm, firm_id: value, item_id: ''})}
                >
                  <SelectTrigger className="mt-1" data-testid="ledger-firm-select">
                    <SelectValue placeholder="Select firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.map(firm => (
                      <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  {ledgerForm.item_type === 'master_sku' ? 'Master SKU' : 'Raw Material'} *
                </Label>
                <Select
                  value={ledgerForm.item_id}
                  onValueChange={(value) => setLedgerForm({...ledgerForm, item_id: value})}
                  disabled={ledgerForm.item_type === 'master_sku' ? !ledgerForm.firm_id : false}
                >
                  <SelectTrigger className="mt-1" data-testid="ledger-item-select">
                    <SelectValue placeholder={ledgerForm.item_type === 'master_sku' && !ledgerForm.firm_id ? "Select firm first" : "Select item"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {ledgerForm.item_type === 'master_sku' ? (
                      // For adjustments, show ALL SKUs. For other types, filter based on product type
                      (() => {
                        const isAdjustment = ['adjustment_in', 'adjustment_out'].includes(ledgerForm.entry_type);
                        const filteredSkus = isAdjustment
                          ? skus  // Show ALL SKUs for adjustments
                          : skus.filter(sku => sku.product_type !== 'manufactured'); // Filter for other entry types

                        return filteredSkus.length > 0 ? (
                          filteredSkus.map(sku => (
                            <SelectItem key={sku.id} value={sku.id}>
                              <span className="truncate block max-w-[350px]">{sku.name} ({sku.sku_code})</span>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-muted-foreground text-sm">
                            {isAdjustment
                              ? 'No Master SKUs available.'
                              : 'No traded items available. Manufactured items require Production Request workflow.'}
                          </div>
                        );
                      })()
                    ) : (
                      // Show Raw Materials (global, no firm filter needed)
                      materialsForLedger.map(material => (
                        <SelectItem key={material.id} value={material.id}>
                          {material.name} ({material.sku_code}) - Total: {material.total_stock || 0}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    value={ledgerForm.quantity}
                    onChange={(e) => setLedgerForm({...ledgerForm, quantity: e.target.value})}
                    placeholder="Enter quantity"
                    className="mt-1"
                    min="1"
                    data-testid="ledger-qty-input"
                  />
                </div>
                <div>
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    value={ledgerForm.unit_price}
                    onChange={(e) => setLedgerForm({...ledgerForm, unit_price: e.target.value})}
                    placeholder="Optional"
                    className="mt-1"
                    step="0.01"
                    data-testid="ledger-price-input"
                  />
                </div>
              </div>
              <div>
                <Label>Invoice / Reference Number</Label>
                <Input
                  value={ledgerForm.invoice_number}
                  onChange={(e) => setLedgerForm({...ledgerForm, invoice_number: e.target.value})}
                  placeholder="e.g., INV-2024-001"
                  className="mt-1"
                  data-testid="ledger-invoice-input"
                />
              </div>
              <div>
                <Label>
                  Reason / Notes
                  {['adjustment_in', 'adjustment_out'].includes(ledgerForm.entry_type) && (
                    <span className="text-amber-400 ml-1 font-mono text-[10px]">* Mandatory for adjustments</span>
                  )}
                </Label>
                <Textarea
                  value={ledgerForm.reason}
                  onChange={(e) => setLedgerForm({...ledgerForm, reason: e.target.value})}
                  placeholder={['adjustment_in', 'adjustment_out'].includes(ledgerForm.entry_type)
                    ? "MANDATORY: Enter reason for this adjustment"
                    : "Enter reason for this entry"}
                  className={`mt-1 ${
                    ['adjustment_in', 'adjustment_out'].includes(ledgerForm.entry_type) && !ledgerForm.reason
                      ? 'border-amber-400/60'
                      : ''
                  }`}
                  rows={2}
                  data-testid="ledger-reason-input"
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setCreateLedgerOpen(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button
                onClick={handleCreateLedgerEntry}
                disabled={actionLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
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
          <DialogContent className="bg-popover border border-border rounded-lg max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Transfer Stock Between Firms</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-amber-400/10 border border-amber-400/25 rounded-lg">
                <p className="text-amber-400 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Invoice number is <strong>mandatory</strong> for GST compliance
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>From Firm *</Label>
                  <Select
                    value={transferForm.from_firm_id}
                    onValueChange={(value) => setTransferForm({...transferForm, from_firm_id: value, item_id: ''})}
                  >
                    <SelectTrigger className="mt-1" data-testid="transfer-from-select">
                      <SelectValue placeholder="Source firm" />
                    </SelectTrigger>
                    <SelectContent>
                      {firms.map(firm => (
                        <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>To Firm *</Label>
                  <Select
                    value={transferForm.to_firm_id}
                    onValueChange={(value) => setTransferForm({...transferForm, to_firm_id: value})}
                  >
                    <SelectTrigger className="mt-1" data-testid="transfer-to-select">
                      <SelectValue placeholder="Destination firm" />
                    </SelectTrigger>
                    <SelectContent>
                      {firms.filter(f => f.id !== transferForm.from_firm_id).map(firm => (
                        <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Item Type *</Label>
                <Select
                  value={transferForm.item_type}
                  onValueChange={(value) => setTransferForm({...transferForm, item_type: value, item_id: ''})}
                >
                  <SelectTrigger className="mt-1" data-testid="transfer-item-type-select">
                    <SelectValue placeholder="Select item type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw_material">Raw Material</SelectItem>
                    <SelectItem value="master_sku">Master SKU (Finished Good)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{transferForm.item_type === 'master_sku' ? 'Master SKU' : 'Raw Material'} *</Label>
                <Select
                  value={transferForm.item_id}
                  onValueChange={(value) => setTransferForm({...transferForm, item_id: value, serial_numbers: [], quantity: ''})}
                  disabled={!transferForm.from_firm_id}
                >
                  <SelectTrigger className="mt-1 w-full" data-testid="transfer-item-select">
                    <SelectValue placeholder={transferForm.from_firm_id ? "Select item to transfer" : "Select source firm first"}>
                      {transferForm.item_id && (() => {
                        if (transferForm.item_type === 'master_sku') {
                          const sku = skusForTransfer.find(s => s.id === transferForm.item_id);
                          return sku ? (
                            <span className="truncate block max-w-[300px]" title={`${sku.name} (${sku.sku_code})`}>
                              {sku.name.length > 25 ? sku.name.substring(0, 25) + '...' : sku.name} ({sku.sku_code})
                            </span>
                          ) : null;
                        } else {
                          const mat = materialsForTransfer.find(m => m.id === transferForm.item_id);
                          return mat ? (
                            <span className="truncate block max-w-[300px]" title={`${mat.name} (${mat.sku_code})`}>
                              {mat.name.length > 25 ? mat.name.substring(0, 25) + '...' : mat.name} ({mat.sku_code})
                            </span>
                          ) : null;
                        }
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-w-md">
                    {transferForm.item_type === 'master_sku' ? (
                      skusForTransfer.map(sku => (
                        <SelectItem key={sku.id} value={sku.id}>
                          <div className="flex flex-col">
                            <span className="truncate max-w-[350px]" title={sku.name}>{sku.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {sku.sku_code} · Avail: {sku.current_stock} {sku.product_type === 'manufactured' ? '· Manufactured' : ''}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      materialsForTransfer.map(material => (
                        <SelectItem key={material.id} value={material.id}>
                          <div className="flex flex-col">
                            <span className="truncate max-w-[350px]" title={material.name}>{material.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {material.sku_code} · Avail: {material.current_stock}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {/* Show selected item details */}
                {transferForm.item_id && (() => {
                  const item = transferForm.item_type === 'master_sku'
                    ? skusForTransfer.find(s => s.id === transferForm.item_id)
                    : materialsForTransfer.find(m => m.id === transferForm.item_id);
                  return item ? (
                    <div className="mt-2 p-2 bg-muted/40 rounded border border-border text-xs">
                      <p className="text-foreground"><strong>Selected:</strong> {item.name}</p>
                      <p className="font-mono text-sky-400 tabular-nums">Available: {item.current_stock} units at source firm</p>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Serial Number Selection for Manufactured Items */}
              {transferForm.item_type === 'master_sku' && transferForm.item_id && (() => {
                const selectedSku = skus.find(s => s.id === transferForm.item_id);
                const isManufactured = selectedSku?.product_type === 'manufactured';
                const stockInfo = stockData.master_skus?.find(st =>
                  (st.item_id === transferForm.item_id || st.id === transferForm.item_id) &&
                  st.firm_id === transferForm.from_firm_id
                );
                const availableSerials = stockInfo?.serial_numbers || [];

                if (isManufactured && availableSerials.length > 0) {
                  return (
                    <div className="p-3 bg-primary/10 border border-primary/25 rounded-lg">
                      <Label className="text-primary mb-2 block">Select Serial Numbers to Transfer *</Label>
                      <p className="font-mono text-[10px] text-primary/70 mb-2">This is a manufactured item. Select which serial numbers to transfer.</p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {availableSerials.map(serial => (
                          <label key={serial} className="flex items-center gap-2 p-2 bg-muted/40 rounded cursor-pointer hover:bg-muted border border-border">
                            <input
                              type="checkbox"
                              checked={transferForm.serial_numbers.includes(serial)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTransferForm({
                                    ...transferForm,
                                    serial_numbers: [...transferForm.serial_numbers, serial],
                                    quantity: (transferForm.serial_numbers.length + 1).toString()
                                  });
                                } else {
                                  const newSerials = transferForm.serial_numbers.filter(s => s !== serial);
                                  setTransferForm({
                                    ...transferForm,
                                    serial_numbers: newSerials,
                                    quantity: newSerials.length.toString()
                                  });
                                }
                              }}
                              className="rounded"
                            />
                            <span className="font-mono text-sm text-foreground">{serial}</span>
                          </label>
                        ))}
                      </div>
                      <p className="font-mono text-[10px] text-primary mt-2">Selected: {transferForm.serial_numbers.length} serial(s)</p>
                    </div>
                  );
                } else if (isManufactured && availableSerials.length === 0) {
                  return (
                    <div className="p-3 bg-amber-400/10 border border-amber-400/25 rounded-lg">
                      <p className="text-amber-400 text-sm">No serial numbers available for this manufactured item at the source firm.</p>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    value={transferForm.quantity}
                    onChange={(e) => setTransferForm({...transferForm, quantity: e.target.value})}
                    placeholder="Enter quantity"
                    className="mt-1"
                    min="1"
                    data-testid="transfer-qty-input"
                  />
                </div>
                <div>
                  <Label>Invoice Number * (GST)</Label>
                  <Input
                    value={transferForm.invoice_number}
                    onChange={(e) => setTransferForm({...transferForm, invoice_number: e.target.value})}
                    placeholder="e.g., GST/TRF/2024/001"
                    className="mt-1 border-amber-400/40"
                    data-testid="transfer-invoice-input"
                  />
                </div>
              </div>

              {/* Pricing & Margin Section */}
              <div className="p-4 bg-emerald-500/[0.06] border border-emerald-500/25 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-emerald-500 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Transfer Pricing & Auto-Entry
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transferForm.auto_create_entries}
                      onChange={(e) => setTransferForm({...transferForm, auto_create_entries: e.target.checked})}
                      className="rounded"
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">Auto-create Sales &amp; Purchase</span>
                  </label>
                </div>

                {transferForm.auto_create_entries && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground text-xs">Margin % (Profit for selling firm)</Label>
                        <Input
                          type="number"
                          value={transferForm.margin_percentage}
                          onChange={(e) => setTransferForm({...transferForm, margin_percentage: e.target.value})}
                          placeholder="15"
                          className="mt-1"
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Custom Unit Price (optional)</Label>
                        <Input
                          type="number"
                          value={transferForm.unit_price}
                          onChange={(e) => setTransferForm({...transferForm, unit_price: e.target.value})}
                          placeholder="Auto-calculated"
                          className="mt-1"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>

                    {/* Pricing Summary */}
                    {pricingLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        Calculating pricing...
                      </div>
                    ) : pricingInfo && (
                      <div className="bg-card/60 border border-border p-3 rounded-lg space-y-2 text-sm">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="font-mono text-[10px] uppercase text-muted-foreground">Cost/Base Price</p>
                            <p className="font-mono tabular-nums text-foreground font-medium">₹{pricingInfo.base_price?.toLocaleString() || '0'}</p>
                          </div>
                          <div>
                            {(() => {
                              const customPrice = parseFloat(transferForm.unit_price);
                              const basePrice = pricingInfo.base_price || 0;
                              const useCustom = customPrice && customPrice > 0;
                              const effectivePrice = useCustom ? customPrice : pricingInfo.suggested_unit_price;
                              const effectiveMargin = (useCustom && basePrice > 0)
                                ? (((customPrice - basePrice) / basePrice) * 100).toFixed(1)
                                : pricingInfo.margin_percentage;
                              return (
                                <>
                                  <p className="font-mono text-[10px] uppercase text-muted-foreground">
                                    {useCustom ? `Custom (+${effectiveMargin}%)` : `Suggested (+${effectiveMargin}%)`}
                                  </p>
                                  <p className="font-mono tabular-nums text-emerald-500 font-medium">₹{effectivePrice?.toLocaleString() || '0'}</p>
                                </>
                              );
                            })()}
                          </div>
                          <div>
                            <p className="font-mono text-[10px] uppercase text-muted-foreground">Avail Stock</p>
                            <p className="font-mono tabular-nums text-sky-400 font-medium">{pricingInfo.current_stock} units</p>
                          </div>
                        </div>
                        <div className="border-t border-border pt-2 mt-2">
                          {(() => {
                            const customPrice = parseFloat(transferForm.unit_price);
                            const useCustom = customPrice && customPrice > 0;
                            const qty = parseInt(transferForm.quantity) || 1;
                            const basePrice = pricingInfo.base_price || 0;
                            const effectivePrice = useCustom ? customPrice : pricingInfo.suggested_unit_price;
                            const subtotal = useCustom ? Math.round(customPrice * qty * 100) / 100 : pricingInfo.total_transfer_value;
                            const gstAmt = useCustom ? Math.round(subtotal * (pricingInfo.gst_rate / 100) * 100) / 100 : pricingInfo.gst_amount;
                            const grand = useCustom ? Math.round((subtotal + gstAmt) * 100) / 100 : pricingInfo.grand_total;
                            const marginAmt = useCustom ? Math.round((customPrice - basePrice) * qty * 100) / 100 : pricingInfo.margin_amount;
                            return (
                              <>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <p className="font-mono text-[10px] uppercase text-muted-foreground">Subtotal</p>
                                    <p className="font-mono tabular-nums text-foreground">₹{subtotal?.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="font-mono text-[10px] uppercase text-muted-foreground">GST ({pricingInfo.gst_rate}%)</p>
                                    <p className="font-mono tabular-nums text-foreground">₹{gstAmt?.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="font-mono text-[10px] uppercase text-muted-foreground">Grand Total</p>
                                    <p className="font-mono tabular-nums text-emerald-500 font-bold">₹{grand?.toLocaleString()}</p>
                                  </div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-border">
                                  <p className="font-mono text-[10px] text-emerald-500">
                                    Margin earned by selling firm: ₹{marginAmt?.toLocaleString()}
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    <p className="font-mono text-[10px] text-muted-foreground">
                      When enabled, this will auto-create a <strong className="text-sky-400">Sales Invoice</strong> for the selling firm and a <strong className="text-amber-400">Purchase Entry</strong> for the receiving firm.
                    </p>
                  </>
                )}
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({...transferForm, notes: e.target.value})}
                  placeholder="Additional notes for this transfer"
                  className="mt-1"
                  rows={2}
                  data-testid="transfer-notes-input"
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setCreateTransferOpen(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button
                onClick={handleCreateTransfer}
                disabled={actionLoading || !transferForm.invoice_number}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="execute-transfer-btn"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {transferForm.auto_create_entries ? 'Transfer & Create Entries' : 'Execute Transfer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Ledger Entry Dialog */}
        <Dialog open={viewLedgerOpen} onOpenChange={setViewLedgerOpen}>
          <DialogContent className="bg-popover border border-border rounded-lg max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <ClipboardList className="w-5 h-5 text-sky-400" />
                Ledger Entry Details
              </DialogTitle>
            </DialogHeader>
            {selectedEntry && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Entry Number</p>
                    <p className="font-mono tabular-nums text-foreground">{selectedEntry.entry_number}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Type</p>
                    <span className={ENTRY_TYPE_COLORS[selectedEntry.entry_type] || 'rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-muted text-muted-foreground ring-1 ring-border'}>
                      {ENTRY_TYPE_LABELS[selectedEntry.entry_type]}
                    </span>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Item</p>
                    <p className="text-foreground">{selectedEntry.item_name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{selectedEntry.item_sku}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Firm</p>
                    <p className="text-foreground">{selectedEntry.firm_name}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Quantity</p>
                    <p className={`font-mono tabular-nums font-semibold ${
                      ['purchase', 'transfer_in', 'adjustment_in', 'return_in', 'repair_yard_in', 'production_output'].includes(selectedEntry.entry_type)
                        ? 'text-emerald-500'
                        : 'text-rose-400'
                    }`}>
                      {['purchase', 'transfer_in', 'adjustment_in', 'return_in', 'repair_yard_in', 'production_output'].includes(selectedEntry.entry_type) ? '+' : '-'}
                      {Math.abs(selectedEntry.quantity)}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Running Balance</p>
                    <p className="font-mono tabular-nums font-semibold text-foreground">{selectedEntry.running_balance}</p>
                  </div>
                  {selectedEntry.unit_price && (
                    <>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Unit Price</p>
                        <p className="font-mono tabular-nums text-foreground">₹{selectedEntry.unit_price}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Total Value</p>
                        <p className="font-mono tabular-nums text-foreground">₹{selectedEntry.total_value}</p>
                      </div>
                    </>
                  )}
                  {selectedEntry.invoice_number && (
                    <div className="col-span-2">
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Invoice Number</p>
                      <p className="font-mono text-sky-400">{selectedEntry.invoice_number}</p>
                    </div>
                  )}
                  {selectedEntry.reason && (
                    <div className="col-span-2">
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Reason</p>
                      <p className="text-foreground">{selectedEntry.reason}</p>
                    </div>
                  )}
                  <div className="col-span-2 pt-3 border-t border-border">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Created By</p>
                    <p className="text-foreground">{selectedEntry.created_by_name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground tabular-nums">{new Date(selectedEntry.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setViewLedgerOpen(false)} className="text-muted-foreground">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

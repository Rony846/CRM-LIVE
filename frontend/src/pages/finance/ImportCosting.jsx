import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Ship, Plus, Trash2, Calculator, Package, DollarSign, 
  IndianRupee, FileText, Eye, CheckCircle, Loader2, X,
  TrendingUp, Receipt, Percent, Building2
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const formatCurrency = (amount, currency = 'INR') => {
  if (amount === null || amount === undefined) return currency === 'USD' ? '$0.00' : '₹0';
  const num = Number(amount);
  if (isNaN(num)) return currency === 'USD' ? '$0.00' : '₹0';
  return currency === 'USD' 
    ? `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const EXPENSE_TYPES = [
  { value: 'handling_fees', label: 'Handling/Broker Fees (All-inclusive)' },
  { value: 'shipping', label: 'Shipping Cost' },
  { value: 'bank_charges', label: 'Bank & Other Charges' },
  { value: 'other', label: 'Other Expenses' }
];

// Helper to get fresh headers with current token
const getHeaders = () => {
  const token = localStorage.getItem('mg_token');
  return { Authorization: `Bearer ${token}` };
};

export default function ImportCosting() {
  const [loading, setLoading] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [firms, setFirms] = useState([]);
  const [masterSkus, setMasterSkus] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Form state
  const [formData, setFormData] = useState({
    firm_id: '',
    tracking_id: '',
    supplier_name: '',
    supplier_country: 'China',
    proforma_invoice_number: '',
    proforma_invoice_date: '',
    proforma_amount_usd: '',
    bank_debit_inr: '',
    boe_number: '',
    boe_date: '',
    notes: '',
    items: [{ item_type: 'raw_material', item_id: '', hsn_code: '', quantity: 1, unit_price_usd: '', assessable_value_inr: '', bcd_rate: '' }],
    expenses: []
  });

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('mg_token');
    if (!token) {
      // Not logged in yet, skip fetch
      return;
    }
    
    setLoading(true);
    try {
      const headers = getHeaders();
      const params = selectedFirm !== 'all' ? { firm_id: selectedFirm } : {};
      const [shipmentsRes, firmsRes] = await Promise.all([
        axios.get(`${API}/api/import-shipments`, { headers, params }),
        axios.get(`${API}/api/firms`, { headers })
      ]);
      setShipments(shipmentsRes.data?.shipments || []);
      setFirms(firmsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // Only show toast if it's not an auth error
      if (error.response?.status !== 401) {
        toast.error('Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedFirm]);

  const fetchMasterSkus = async (firmId) => {
    if (!firmId) return;
    try {
      const headers = getHeaders();
      const [skusRes, materialsRes] = await Promise.all([
        axios.get(`${API}/api/master-skus`, { headers, params: { firm_id: firmId } }),
        axios.get(`${API}/api/raw-materials`, { headers })
      ]);
      setMasterSkus(skusRes.data || []);
      setRawMaterials(materialsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (formData.firm_id) {
      fetchMasterSkus(formData.firm_id);
    }
  }, [formData.firm_id]);

  const calculatedExchangeRate = formData.proforma_amount_usd && formData.bank_debit_inr
    ? (parseFloat(formData.bank_debit_inr) / parseFloat(formData.proforma_amount_usd)).toFixed(4)
    : '0.0000';

  const resetForm = () => {
    setFormData({
      firm_id: '',
      tracking_id: '',
      supplier_name: '',
      supplier_country: 'China',
      proforma_invoice_number: '',
      proforma_invoice_date: '',
      proforma_amount_usd: '',
      bank_debit_inr: '',
      boe_number: '',
      boe_date: '',
      notes: '',
      items: [{ item_type: 'raw_material', item_id: '', hsn_code: '', quantity: 1, unit_price_usd: '', assessable_value_inr: '', bcd_rate: '' }],
      expenses: []
    });
    setCurrentStep(1);
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { item_type: 'raw_material', item_id: '', hsn_code: '', quantity: 1, unit_price_usd: '', assessable_value_inr: '', bcd_rate: '' }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }));
  };

  const addExpense = () => {
    setFormData(prev => ({
      ...prev,
      expenses: [...prev.expenses, { expense_type: 'handling_fees', description: '', base_amount: '', gst_rate: 18 }]
    }));
  };

  const removeExpense = (index) => {
    setFormData(prev => ({
      ...prev,
      expenses: prev.expenses.filter((_, i) => i !== index)
    }));
  };

  const updateExpense = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      expenses: prev.expenses.map((exp, i) => i === index ? { ...exp, [field]: value } : exp)
    }));
  };

  const handleCreate = async () => {
    try {
      // Validate required fields
      if (!formData.firm_id || !formData.tracking_id || !formData.supplier_name) {
        toast.error('Please fill all required fields');
        return;
      }
      if (!formData.proforma_amount_usd || !formData.bank_debit_inr) {
        toast.error('Please enter USD and INR amounts');
        return;
      }
      if (formData.items.some(item => !item.item_id || !item.hsn_code || !item.assessable_value_inr || !item.bcd_rate)) {
        toast.error('Please fill all item fields including BOE Assessable Value');
        return;
      }

      const payload = {
        ...formData,
        proforma_amount_usd: parseFloat(formData.proforma_amount_usd) || 0,
        bank_debit_inr: parseFloat(formData.bank_debit_inr) || 0,
        items: formData.items.map(item => ({
          ...item,
          quantity: parseInt(item.quantity) || 1,
          unit_price_usd: parseFloat(item.unit_price_usd) || 0,
          assessable_value_inr: parseFloat(item.assessable_value_inr),
          bcd_rate: parseFloat(item.bcd_rate)
        })),
        expenses: formData.expenses.map(exp => ({
          ...exp,
          base_amount: parseFloat(exp.base_amount),
          gst_rate: parseFloat(exp.gst_rate)
        })).filter(exp => exp.base_amount > 0)
      };

      const headers = getHeaders();
      const res = await axios.post(`${API}/api/import-shipments`, payload, { headers });
      toast.success('Import shipment created!');
      setShowCreateDialog(false);
      resetForm();
      fetchData();
      
      // Show the created shipment
      setSelectedShipment(res.data.shipment);
      setShowViewDialog(true);
    } catch (error) {
      console.error('Failed to create shipment:', error);
      toast.error(error.response?.data?.detail || 'Failed to create shipment');
    }
  };

  const handleFinalize = async (shipmentId) => {
    try {
      const headers = getHeaders();
      const res = await axios.post(`${API}/api/import-shipments/${shipmentId}/finalize`, {}, { headers });
      toast.success('Import shipment finalized! Purchase entry created.');
      fetchData();
      setSelectedShipment(res.data.shipment);
    } catch (error) {
      console.error('Failed to finalize:', error);
      toast.error(error.response?.data?.detail || 'Failed to finalize shipment');
    }
  };

  const handleDelete = async (shipmentId) => {
    if (!window.confirm('Are you sure you want to delete this draft shipment?')) return;
    try {
      const headers = getHeaders();
      await axios.delete(`${API}/api/import-shipments/${shipmentId}`, { headers });
      toast.success('Shipment deleted');
      fetchData();
      setShowViewDialog(false);
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete shipment');
    }
  };

  const viewShipment = (shipment) => {
    setSelectedShipment(shipment);
    setShowViewDialog(true);
  };

  // Calculate totals stats
  const stats = {
    total: shipments.length,
    draft: shipments.filter(s => s.status === 'draft').length,
    finalized: shipments.filter(s => s.status === 'finalized').length,
    totalLandedCost: shipments.reduce((sum, s) => sum + (s.totals?.grand_total_landed_cost || 0), 0),
    totalGstClaimable: shipments.reduce((sum, s) => sum + (s.totals?.total_gst_claimable || 0), 0)
  };

  return (
    <DashboardLayout title="Import Costing Engine">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Shipments</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <Ship className="w-8 h-8 text-cyan-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Draft</p>
                  <p className="text-2xl font-bold text-yellow-400">{stats.draft}</p>
                </div>
                <FileText className="w-8 h-8 text-yellow-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Finalized</p>
                  <p className="text-2xl font-bold text-green-400">{stats.finalized}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Landed Cost</p>
                  <p className="text-2xl font-bold text-cyan-400">{formatCurrency(stats.totalLandedCost)}</p>
                </div>
                <IndianRupee className="w-8 h-8 text-cyan-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">GST Claimable (ITC)</p>
                  <p className="text-2xl font-bold text-purple-400">{formatCurrency(stats.totalGstClaimable)}</p>
                </div>
                <Receipt className="w-8 h-8 text-purple-400/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between">
          <Select value={selectedFirm} onValueChange={setSelectedFirm}>
            <SelectTrigger className="w-[200px] bg-slate-800 border-slate-700">
              <SelectValue placeholder="All Firms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Firms</SelectItem>
              {firms.map(firm => (
                <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button onClick={() => setShowCreateDialog(true)} className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="w-4 h-4 mr-2" /> New Import Shipment
          </Button>
        </div>

        {/* Shipments List */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Ship className="w-5 h-5 text-cyan-400" />
              Import Shipments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Shipment #</TableHead>
                    <TableHead className="text-slate-400">Tracking ID</TableHead>
                    <TableHead className="text-slate-400">Firm</TableHead>
                    <TableHead className="text-slate-400">Supplier</TableHead>
                    <TableHead className="text-slate-400">Items</TableHead>
                    <TableHead className="text-slate-400">USD Rate</TableHead>
                    <TableHead className="text-slate-400 text-right">Landed Cost</TableHead>
                    <TableHead className="text-slate-400 text-right">GST (ITC)</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map(shipment => (
                    <TableRow key={shipment.id} className="border-slate-700 hover:bg-slate-700/50">
                      <TableCell className="text-cyan-400 font-mono">{shipment.shipment_number}</TableCell>
                      <TableCell className="text-white font-mono">{shipment.tracking_id}</TableCell>
                      <TableCell className="text-slate-300">{shipment.firm_name}</TableCell>
                      <TableCell className="text-slate-300">{shipment.supplier_name}</TableCell>
                      <TableCell>
                        <Badge className="bg-slate-600">{shipment.items?.length || 0} items</Badge>
                      </TableCell>
                      <TableCell className="text-green-400">₹{shipment.exchange_rate}</TableCell>
                      <TableCell className="text-right text-white font-medium">
                        {formatCurrency(shipment.totals?.grand_total_landed_cost)}
                      </TableCell>
                      <TableCell className="text-right text-purple-400">
                        {formatCurrency(shipment.totals?.total_gst_claimable)}
                      </TableCell>
                      <TableCell>
                        <Badge className={shipment.status === 'finalized' ? 'bg-green-600' : 'bg-yellow-600'}>
                          {shipment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => viewShipment(shipment)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {shipments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                        No import shipments found. Click "New Import Shipment" to add one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowCreateDialog(open); }}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ship className="w-5 h-5 text-cyan-400" />
              New Import Shipment - Step {currentStep} of 3
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {currentStep === 1 && "Enter basic shipment and invoice details"}
              {currentStep === 2 && "Add items with HSN codes and duty rates"}
              {currentStep === 3 && "Add expenses (optional)"}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={`step${currentStep}`} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-700">
              <TabsTrigger value="step1" onClick={() => setCurrentStep(1)} className="data-[state=active]:bg-cyan-600">
                1. Basic Info
              </TabsTrigger>
              <TabsTrigger value="step2" onClick={() => setCurrentStep(2)} className="data-[state=active]:bg-cyan-600">
                2. Items
              </TabsTrigger>
              <TabsTrigger value="step3" onClick={() => setCurrentStep(3)} className="data-[state=active]:bg-cyan-600">
                3. Expenses
              </TabsTrigger>
            </TabsList>

            {/* Step 1: Basic Info */}
            <TabsContent value="step1" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Firm *</Label>
                  <Select value={formData.firm_id} onValueChange={v => setFormData(p => ({ ...p, firm_id: v }))}>
                    <SelectTrigger className="bg-slate-700 border-slate-600">
                      <SelectValue placeholder="Select firm" />
                    </SelectTrigger>
                    <SelectContent>
                      {firms.map(firm => (
                        <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tracking ID (FedEx/DHL) *</Label>
                  <Input
                    value={formData.tracking_id}
                    onChange={e => setFormData(p => ({ ...p, tracking_id: e.target.value }))}
                    placeholder="e.g., 789123456789"
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier Name *</Label>
                  <Input
                    value={formData.supplier_name}
                    onChange={e => setFormData(p => ({ ...p, supplier_name: e.target.value }))}
                    placeholder="e.g., Shenzhen Electronics Co."
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Supplier Country</Label>
                  <Input
                    value={formData.supplier_country}
                    onChange={e => setFormData(p => ({ ...p, supplier_country: e.target.value }))}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proforma Invoice Number *</Label>
                  <Input
                    value={formData.proforma_invoice_number}
                    onChange={e => setFormData(p => ({ ...p, proforma_invoice_number: e.target.value }))}
                    placeholder="e.g., PI-2026-001"
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Proforma Invoice Date *</Label>
                  <Input
                    type="date"
                    value={formData.proforma_invoice_date}
                    onChange={e => setFormData(p => ({ ...p, proforma_invoice_date: e.target.value }))}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-700/50 rounded-lg space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-cyan-400" />
                  Exchange Rate Calculation
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Proforma Amount (USD) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.proforma_amount_usd}
                        onChange={e => setFormData(p => ({ ...p, proforma_amount_usd: e.target.value }))}
                        className="bg-slate-700 border-slate-600 pl-9"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Debit (INR) *</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.bank_debit_inr}
                        onChange={e => setFormData(p => ({ ...p, bank_debit_inr: e.target.value }))}
                        className="bg-slate-700 border-slate-600 pl-9"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Calculated Rate</Label>
                    <div className="bg-cyan-600/20 border border-cyan-500 rounded-md p-3 text-center">
                      <span className="text-xl font-bold text-cyan-400">₹{calculatedExchangeRate}</span>
                      <span className="text-sm text-slate-400 ml-1">per USD</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>BOE Number (Optional - required for finalization)</Label>
                  <Input
                    value={formData.boe_number}
                    onChange={e => setFormData(p => ({ ...p, boe_number: e.target.value }))}
                    placeholder="e.g., 1234567"
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>BOE Date</Label>
                  <Input
                    type="date"
                    value={formData.boe_date}
                    onChange={e => setFormData(p => ({ ...p, boe_date: e.target.value }))}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Step 2: Items */}
            <TabsContent value="step2" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Package className="w-4 h-4 text-cyan-400" />
                  Import Items ({formData.items.length})
                </h4>
                <Button size="sm" onClick={addItem} className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="p-4 bg-slate-700/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-cyan-400">Item {index + 1}</span>
                      {formData.items.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-6 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Item Type *</Label>
                        <Select value={item.item_type} onValueChange={v => {
                          updateItem(index, 'item_type', v);
                          updateItem(index, 'item_id', '');
                          updateItem(index, 'hsn_code', '');
                        }}>
                          <SelectTrigger className="bg-slate-700 border-slate-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="raw_material">Raw Material</SelectItem>
                            <SelectItem value="master_sku">Finished SKU</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">{item.item_type === 'raw_material' ? 'Raw Material' : 'Master SKU'} *</Label>
                        <Select value={item.item_id} onValueChange={v => {
                          const itemList = item.item_type === 'raw_material' ? rawMaterials : masterSkus;
                          const selectedItem = itemList.find(s => s.id === v);
                          updateItem(index, 'item_id', v);
                          if (selectedItem?.hsn_code) updateItem(index, 'hsn_code', selectedItem.hsn_code);
                        }}>
                          <SelectTrigger className="bg-slate-700 border-slate-600">
                            <SelectValue placeholder={`Select ${item.item_type === 'raw_material' ? 'material' : 'SKU'}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {(item.item_type === 'raw_material' ? rawMaterials : masterSkus).map(itm => (
                              <SelectItem key={itm.id} value={itm.id}>
                                {itm.name} ({itm.sku_code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">HSN Code *</Label>
                        <Input
                          value={item.hsn_code}
                          onChange={e => updateItem(index, 'hsn_code', e.target.value)}
                          placeholder="e.g., 850790"
                          className="bg-slate-700 border-slate-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Quantity *</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateItem(index, 'quantity', e.target.value)}
                          className="bg-slate-700 border-slate-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit Price (USD)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_price_usd}
                          onChange={e => updateItem(index, 'unit_price_usd', e.target.value)}
                          placeholder="0.00"
                          className="bg-slate-700 border-slate-600"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mt-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-cyan-400 font-medium">BOE Assessable Value (INR) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.assessable_value_inr || ''}
                          onChange={e => updateItem(index, 'assessable_value_inr', e.target.value)}
                          placeholder="From BOE (incl. insurance, freight)"
                          className="bg-slate-700 border-cyan-600 text-cyan-300"
                        />
                        <p className="text-xs text-slate-500">Enter exact value from Bill of Entry</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">BCD Rate (%) *</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.1"
                            value={item.bcd_rate}
                            onChange={e => updateItem(index, 'bcd_rate', e.target.value)}
                            placeholder="e.g., 10"
                            className="bg-slate-700 border-slate-600 pr-8"
                          />
                          <Percent className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center bg-slate-700/50 rounded-md p-2">
                        <div className="text-xs text-slate-300">
                          <span className="text-cyan-400 font-medium">Duty Calculation:</span><br/>
                          BCD = Assessable × BCD%<br/>
                          SWS = BCD × 10%<br/>
                          IGST = (Assessable + BCD + SWS) × 18%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Step 3: Expenses */}
            <TabsContent value="step3" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-cyan-400" />
                  Import Expenses ({formData.expenses.length})
                </h4>
                <Button size="sm" onClick={addExpense} className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="w-4 h-4 mr-1" /> Add Expense
                </Button>
              </div>

              {formData.expenses.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-700/30 rounded-lg">
                  <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No expenses added yet. Click "Add Expense" to add shipping, handling, or other costs.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.expenses.map((expense, index) => (
                    <div key={index} className="p-4 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-cyan-400">Expense {index + 1}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeExpense(index)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Type *</Label>
                          <Select value={expense.expense_type} onValueChange={v => updateExpense(index, 'expense_type', v)}>
                            <SelectTrigger className="bg-slate-700 border-slate-600">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {EXPENSE_TYPES.map(type => (
                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={expense.description}
                            onChange={e => updateExpense(index, 'description', e.target.value)}
                            placeholder="Optional details"
                            className="bg-slate-700 border-slate-600"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Base Amount (INR) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={expense.base_amount}
                            onChange={e => updateExpense(index, 'base_amount', e.target.value)}
                            placeholder="0.00"
                            className="bg-slate-700 border-slate-600"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">GST Rate (%)</Label>
                          <Input
                            type="number"
                            value={expense.gst_rate}
                            onChange={e => updateExpense(index, 'gst_rate', e.target.value)}
                            className="bg-slate-700 border-slate-600"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  className="bg-slate-700 border-slate-600"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex justify-between">
            <div>
              {currentStep > 1 && (
                <Button variant="outline" onClick={() => setCurrentStep(p => p - 1)}>
                  Previous
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              {currentStep < 3 ? (
                <Button onClick={() => setCurrentStep(p => p + 1)} className="bg-cyan-600 hover:bg-cyan-700">
                  Next
                </Button>
              ) : (
                <Button onClick={handleCreate} className="bg-green-600 hover:bg-green-700">
                  <Calculator className="w-4 h-4 mr-2" /> Create & Calculate
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ship className="w-5 h-5 text-cyan-400" />
              Import Shipment: {selectedShipment?.shipment_number}
              <Badge className={selectedShipment?.status === 'finalized' ? 'bg-green-600 ml-2' : 'bg-yellow-600 ml-2'}>
                {selectedShipment?.status}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedShipment && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-900 border border-slate-600 rounded-lg">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Tracking ID</p>
                  <p className="font-mono text-lg font-bold text-cyan-400">{selectedShipment.tracking_id}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Firm</p>
                  <p className="text-lg font-semibold text-white">{selectedShipment.firm_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Supplier</p>
                  <p className="text-lg font-semibold text-white">{selectedShipment.supplier_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Exchange Rate</p>
                  <p className="text-lg font-bold text-green-400">₹{selectedShipment.exchange_rate} / USD</p>
                </div>
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Proforma Invoice</p>
                  <p className="font-medium text-white">{selectedShipment.proforma_invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Proforma Amount</p>
                  <p className="font-bold text-green-400">{formatCurrency(selectedShipment.proforma_amount_usd, 'USD')}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Bank Debit</p>
                  <p className="font-bold text-white">{formatCurrency(selectedShipment.bank_debit_inr)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">BOE Number</p>
                  <p className="font-bold text-yellow-400">{selectedShipment.boe_number || '-'}</p>
                </div>
              </div>

              {/* Item Costs - Main Output */}
              <Card className="bg-gradient-to-br from-cyan-900/40 to-slate-900 border-2 border-cyan-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl flex items-center gap-2 text-cyan-300">
                    <TrendingUp className="w-6 h-6 text-cyan-400" />
                    LANDED COST PER ITEM
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-600 bg-slate-800">
                        <TableHead className="text-white font-bold">Item</TableHead>
                        <TableHead className="text-white font-bold text-right">Qty</TableHead>
                        <TableHead className="text-white font-bold text-right">Prorated Expenses</TableHead>
                        <TableHead className="text-white font-bold text-right">Total Landed Cost</TableHead>
                        <TableHead className="text-white font-bold text-right">Cost/Unit</TableHead>
                        <TableHead className="text-yellow-300 font-bold text-right">Cost/Unit (w/o GST)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedShipment.item_costs?.map((item, i) => (
                        <TableRow key={i} className="border-slate-600 hover:bg-slate-700/50">
                          <TableCell>
                            <div>
                              <p className="font-semibold text-white text-base">{item.item_name || item.master_sku_name}</p>
                              <p className="text-sm text-cyan-400 font-mono">{item.sku_code}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-lg font-bold text-white">{item.quantity}</TableCell>
                          <TableCell className="text-right text-base text-orange-400">{formatCurrency(item.prorated_expenses)}</TableCell>
                          <TableCell className="text-right text-lg font-bold text-cyan-300">{formatCurrency(item.landed_cost_total)}</TableCell>
                          <TableCell className="text-right text-base font-semibold text-white">{formatCurrency(item.cost_per_unit)}</TableCell>
                          <TableCell className="text-right text-lg font-bold text-yellow-400">{formatCurrency(item.cost_per_unit_without_gst)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Items Detail */}
              <Card className="bg-slate-900 border border-slate-600">
                <CardHeader className="pb-3 bg-slate-800/50">
                  <CardTitle className="text-base flex items-center gap-2 text-white">
                    <Package className="w-5 h-5 text-cyan-400" />
                    ITEM-WISE DUTY BREAKDOWN (from BOE)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-600 bg-slate-800">
                        <TableHead className="text-white">Item</TableHead>
                        <TableHead className="text-white">HSN</TableHead>
                        <TableHead className="text-cyan-300 text-right">BOE Assessable Value</TableHead>
                        <TableHead className="text-white text-right">BCD</TableHead>
                        <TableHead className="text-white text-right">SWS (10%)</TableHead>
                        <TableHead className="text-purple-300 text-right">IGST (18%)</TableHead>
                        <TableHead className="text-orange-300 text-right">Total Duty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedShipment.items?.map((item, i) => (
                        <TableRow key={i} className="border-slate-700 hover:bg-slate-800/50">
                          <TableCell>
                            <p className="font-medium text-white">{item.item_name || item.master_sku_name}</p>
                            <p className="text-sm text-slate-400">Qty: {item.quantity}</p>
                          </TableCell>
                          <TableCell className="font-mono text-cyan-400">{item.hsn_code}</TableCell>
                          <TableCell className="text-right font-bold text-cyan-300">{formatCurrency(item.assessable_value)}</TableCell>
                          <TableCell className="text-right text-white">
                            {formatCurrency(item.bcd_amount)}
                            <span className="text-xs text-slate-400 ml-1">({item.bcd_rate}%)</span>
                          </TableCell>
                          <TableCell className="text-right text-white">{formatCurrency(item.sws_amount)}</TableCell>
                          <TableCell className="text-right font-semibold text-purple-400">{formatCurrency(item.igst_amount)}</TableCell>
                          <TableCell className="text-right font-bold text-orange-400">{formatCurrency(item.total_duty)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Expenses */}
              {selectedShipment.expenses?.length > 0 && (
                <Card className="bg-slate-900 border border-slate-600">
                  <CardHeader className="pb-3 bg-slate-800/50">
                    <CardTitle className="text-base flex items-center gap-2 text-white">
                      <Receipt className="w-5 h-5 text-orange-400" />
                      EXPENSES (GST Claimable as ITC)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-600 bg-slate-800">
                          <TableHead className="text-white">Type</TableHead>
                          <TableHead className="text-white">Description</TableHead>
                          <TableHead className="text-white text-right">Base Amount</TableHead>
                          <TableHead className="text-purple-300 text-right">GST (ITC)</TableHead>
                          <TableHead className="text-orange-300 text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedShipment.expenses.map((exp, i) => (
                          <TableRow key={i} className="border-slate-700 hover:bg-slate-800/50">
                            <TableCell className="capitalize font-medium text-white">{exp.expense_type?.replace('_', ' ')}</TableCell>
                            <TableCell className="text-slate-300">{exp.description || '-'}</TableCell>
                            <TableCell className="text-right text-white">{formatCurrency(exp.base_amount)}</TableCell>
                            <TableCell className="text-right font-semibold text-purple-400">{formatCurrency(exp.gst_amount)}</TableCell>
                            <TableCell className="text-right font-bold text-orange-400">{formatCurrency(exp.total_amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Summary Totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-900 border-2 border-slate-500">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-slate-400 mb-2">Total BOE Assessable</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(selectedShipment.totals?.total_assessable_value)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-900 border-2 border-orange-500">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-slate-400 mb-2">Total Duties</p>
                    <p className="text-2xl font-bold text-orange-400">{formatCurrency(selectedShipment.totals?.total_duties)}</p>
                    <p className="text-xs text-orange-300 mt-1">BCD + SWS + IGST</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-900 border-2 border-cyan-500">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-slate-400 mb-2">Grand Total Landed</p>
                    <p className="text-2xl font-bold text-cyan-400">{formatCurrency(selectedShipment.totals?.grand_total_landed_cost)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-900 border-2 border-purple-500">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-slate-400 mb-2">Total GST (ITC)</p>
                    <p className="text-2xl font-bold text-purple-400">{formatCurrency(selectedShipment.totals?.total_gst_claimable)}</p>
                    <p className="text-xs text-purple-300 mt-1">Claimable Input Credit</p>
                  </CardContent>
                </Card>
              </div>

              {/* Effective Cost */}
              <div className="p-6 bg-gradient-to-r from-green-900/40 to-slate-900 border-2 border-green-500 rounded-lg text-center">
                <p className="text-base text-slate-300 mb-2">EFFECTIVE COST AFTER ITC CLAIM</p>
                <p className="text-4xl font-bold text-green-400">{formatCurrency(selectedShipment.totals?.effective_cost_after_itc)}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedShipment?.status === 'draft' && (
              <>
                <Button variant="destructive" onClick={() => handleDelete(selectedShipment.id)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
                <Button 
                  onClick={() => handleFinalize(selectedShipment.id)} 
                  className="bg-green-600 hover:bg-green-700"
                  disabled={!selectedShipment.boe_number}
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Finalize & Create Purchase Entry
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

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
  Ship, Plus, Trash2, Calculator, Package, DollarSign, Download, Edit2, Pencil,
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
  const [editingShipment, setEditingShipment] = useState(null); // For editing existing shipments
  
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
    customs_exchange_rate: '', // Custom rate for assessable value calculation
    boe_number: '',
    boe_date: '',
    notes: '',
    items: [{ 
      item_type: 'raw_material', 
      item_id: '', 
      hsn_code: '', 
      quantity: 1, 
      unit_price_usd: '', 
      // Freight & Insurance calculation
      freight_mode: 'percentage', // 'percentage' or 'manual'
      freight_percent: 20, // default 20%
      freight_usd: '',
      insurance_mode: 'percentage', // 'percentage' or 'manual'
      insurance_percent: 1.125, // default 1.125%
      insurance_usd: '',
      bcd_rate: '' 
    }],
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

  // Use custom exchange rate for assessable value if provided, otherwise use bank rate
  const effectiveCustomsRate = formData.customs_exchange_rate 
    ? parseFloat(formData.customs_exchange_rate) 
    : parseFloat(calculatedExchangeRate) || 0;

  // Calculate assessable value for an item (Invoice + Freight + Insurance) in USD, then convert to INR
  const calculateItemAssessableValue = (item) => {
    const unitPrice = parseFloat(item.unit_price_usd) || 0;
    const quantity = parseInt(item.quantity) || 1;
    const invoiceValue = unitPrice * quantity;
    
    // Calculate freight
    let freightUsd = 0;
    if (item.freight_mode === 'percentage') {
      freightUsd = invoiceValue * (parseFloat(item.freight_percent) || 20) / 100;
    } else {
      freightUsd = parseFloat(item.freight_usd) || 0;
    }
    
    // Calculate insurance
    let insuranceUsd = 0;
    if (item.insurance_mode === 'percentage') {
      insuranceUsd = invoiceValue * (parseFloat(item.insurance_percent) || 1.125) / 100;
    } else {
      insuranceUsd = parseFloat(item.insurance_usd) || 0;
    }
    
    const totalUsd = invoiceValue + freightUsd + insuranceUsd;
    // Use customs rate (if provided) for assessable value calculation
    const exchangeRate = effectiveCustomsRate;
    const totalInr = totalUsd * exchangeRate;
    
    return {
      invoiceValue,
      freightUsd,
      insuranceUsd,
      totalUsd,
      totalInr: Math.round(totalInr * 100) / 100
    };
  };

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
      customs_exchange_rate: '',
      boe_number: '',
      boe_date: '',
      notes: '',
      items: [{ 
        item_type: 'raw_material', 
        item_id: '', 
        hsn_code: '', 
        quantity: 1, 
        unit_price_usd: '', 
        freight_mode: 'percentage',
        freight_percent: 20,
        freight_usd: '',
        insurance_mode: 'percentage',
        insurance_percent: 1.125,
        insurance_usd: '',
        bcd_rate: '' 
      }],
      expenses: []
    });
    setCurrentStep(1);
    setEditingShipment(null);
  };

  // Edit existing shipment (draft only)
  const editShipment = (shipment) => {
    // Populate form with existing shipment data
    setFormData({
      firm_id: shipment.firm_id || '',
      tracking_id: shipment.tracking_id || '',
      supplier_name: shipment.supplier_name || '',
      supplier_country: shipment.supplier_country || 'China',
      proforma_invoice_number: shipment.proforma_invoice_number || '',
      proforma_invoice_date: shipment.proforma_invoice_date || '',
      proforma_amount_usd: shipment.proforma_amount_usd || '',
      bank_debit_inr: shipment.bank_debit_inr || '',
      customs_exchange_rate: shipment.customs_exchange_rate || '',
      boe_number: shipment.boe_number || '',
      boe_date: shipment.boe_date || '',
      notes: shipment.notes || '',
      items: shipment.items?.map(item => ({
        item_type: item.item_type || 'raw_material',
        item_id: item.item_id || '',
        hsn_code: item.hsn_code || '',
        quantity: item.quantity || 1,
        unit_price_usd: item.unit_price_usd || '',
        freight_mode: item.freight_mode || 'percentage',
        freight_percent: item.freight_percent || 20,
        freight_usd: item.freight_usd || '',
        insurance_mode: item.insurance_mode || 'percentage',
        insurance_percent: item.insurance_percent || 1.125,
        insurance_usd: item.insurance_usd || '',
        bcd_rate: item.bcd_rate || ''
      })) || [{ item_type: 'raw_material', item_id: '', hsn_code: '', quantity: 1, unit_price_usd: '', freight_mode: 'percentage', freight_percent: 20, freight_usd: '', insurance_mode: 'percentage', insurance_percent: 1.125, insurance_usd: '', bcd_rate: '' }],
      expenses: shipment.expenses?.map(exp => ({
        expense_type: exp.expense_type || '',
        description: exp.description || '',
        base_amount: exp.base_amount || '',
        gst_rate: exp.gst_rate || 18
      })) || []
    });
    setEditingShipment(shipment);
    setCurrentStep(1);
    setShowCreateDialog(true);
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { 
        item_type: 'raw_material', 
        item_id: '', 
        hsn_code: '', 
        quantity: 1, 
        unit_price_usd: '', 
        freight_mode: 'percentage',
        freight_percent: 20,
        freight_usd: '',
        insurance_mode: 'percentage',
        insurance_percent: 1.125,
        insurance_usd: '',
        bcd_rate: '' 
      }]
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
      // Validate items - now check unit_price_usd instead of assessable_value_inr
      if (formData.items.some(item => !item.item_id || !item.hsn_code || !item.unit_price_usd || !item.bcd_rate)) {
        toast.error('Please fill all item fields including Unit Price and BCD Rate');
        return;
      }

      // Calculate assessable value for each item
      const itemsWithCalculatedValues = formData.items.map(item => {
        const calc = calculateItemAssessableValue(item);
        return {
          ...item,
          quantity: parseInt(item.quantity) || 1,
          unit_price_usd: parseFloat(item.unit_price_usd) || 0,
          freight_mode: item.freight_mode,
          freight_percent: parseFloat(item.freight_percent) || 20,
          freight_usd: parseFloat(item.freight_usd) || 0,
          insurance_mode: item.insurance_mode,
          insurance_percent: parseFloat(item.insurance_percent) || 1.125,
          insurance_usd: parseFloat(item.insurance_usd) || 0,
          // Calculated values
          invoice_value_usd: calc.invoiceValue,
          freight_value_usd: calc.freightUsd,
          insurance_value_usd: calc.insuranceUsd,
          assessable_value_usd: calc.totalUsd,
          assessable_value_inr: calc.totalInr,
          bcd_rate: parseFloat(item.bcd_rate)
        };
      });

      const payload = {
        ...formData,
        proforma_amount_usd: parseFloat(formData.proforma_amount_usd) || 0,
        bank_debit_inr: parseFloat(formData.bank_debit_inr) || 0,
        customs_exchange_rate: formData.customs_exchange_rate ? parseFloat(formData.customs_exchange_rate) : null,
        items: itemsWithCalculatedValues,
        expenses: formData.expenses.map(exp => ({
          ...exp,
          base_amount: parseFloat(exp.base_amount),
          gst_rate: parseFloat(exp.gst_rate)
        })).filter(exp => exp.base_amount > 0)
      };

      const headers = getHeaders();
      
      // Check if editing or creating
      if (editingShipment) {
        // Update existing shipment
        const res = await axios.put(`${API}/api/import-shipments/${editingShipment.id}`, payload, { headers });
        toast.success('Import shipment updated!');
        setShowCreateDialog(false);
        resetForm();
        fetchData();
        // Show the updated shipment
        setSelectedShipment(res.data.shipment || res.data);
        setShowViewDialog(true);
      } else {
        // Create new shipment
        const res = await axios.post(`${API}/api/import-shipments`, payload, { headers });
        toast.success('Import shipment created!');
        setShowCreateDialog(false);
        resetForm();
        fetchData();
        // Show the created shipment
        setSelectedShipment(res.data.shipment);
        setShowViewDialog(true);
      }
    } catch (error) {
      console.error('Failed to save shipment:', error);
      toast.error(error.response?.data?.detail || 'Failed to save shipment');
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

  // Export to CSV
  const handleExportCSV = async () => {
    try {
      let url = `${API}/api/import-shipments/export/csv`;
      const params = new URLSearchParams();
      if (selectedFirm !== 'all') params.append('firm_id', selectedFirm);
      if (params.toString()) url += `?${params.toString()}`;
      
      const headers = getHeaders();
      const response = await axios.get(url, {
        headers,
        responseType: 'blob'
      });
      
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `import_shipments_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      toast.success('Export successful');
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  return (
    <DashboardLayout title="Import Costing Engine">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total Shipments</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">{stats.total}</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-sky-400/15 text-sky-400">
                <Ship className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Draft</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-amber-400">{stats.draft}</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-amber-400/15 text-amber-400">
                <FileText className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Finalized</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-emerald-400">{stats.finalized}</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-emerald-500/15 text-emerald-400">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total Landed Cost</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-primary">{formatCurrency(stats.totalLandedCost)}</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-primary/15 text-primary">
                <IndianRupee className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">GST Claimable (ITC)</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-violet-400">{formatCurrency(stats.totalGstClaimable)}</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-violet-400/15 text-violet-400">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between">
          <Select value={selectedFirm} onValueChange={setSelectedFirm}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Firms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Firms</SelectItem>
              {firms.map(firm => (
                <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              data-testid="export-csv-btn"
            >
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> New Import Shipment
            </Button>
          </div>
        </div>

        {/* Shipments List */}
        <Card className="mg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Ship className="w-5 h-5 text-primary" />
              Import Shipments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Tracking / Shipment #</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Firm</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Supplier</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Proforma</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Items</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">USD Rate</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Landed Cost</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">GST (ITC)</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Status</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map(shipment => (
                    <TableRow key={shipment.id} className="border-border">
                      <TableCell className="font-mono font-semibold text-primary tabular-nums">{shipment.tracking_id}</TableCell>
                      <TableCell className="text-foreground">{shipment.firm_name}</TableCell>
                      <TableCell className="text-foreground">{shipment.supplier_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">{shipment.proforma_invoice_number}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 bg-muted text-muted-foreground ring-border">
                          {shipment.items?.length || 0} items
                        </span>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums text-emerald-400">₹{shipment.exchange_rate}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-semibold text-foreground">
                        {formatCurrency(shipment.totals?.grand_total_landed_cost)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-violet-400">
                        {formatCurrency(shipment.totals?.total_gst_claimable)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                          shipment.status === 'finalized'
                            ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
                            : 'bg-amber-400/15 text-amber-400 ring-amber-400/25'
                        }`}>
                          {shipment.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => viewShipment(shipment)} title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {shipment.status === 'draft' && (
                            <Button variant="ghost" size="sm" onClick={() => editShipment(shipment)} title="Edit" className="text-amber-400 hover:text-amber-300">
                              <FileText className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {shipments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
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

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowCreateDialog(open); }}>
        <DialogContent className="bg-popover border border-border text-foreground max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Ship className="w-5 h-5 text-primary" />
              {editingShipment ? 'Edit' : 'New'} Import Shipment — Step {currentStep} of 3
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {currentStep === 1 && "Enter basic shipment and invoice details"}
              {currentStep === 2 && "Add items with HSN codes and duty rates"}
              {currentStep === 3 && "Add expenses (optional)"}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={`step${currentStep}`} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted">
              <TabsTrigger value="step1" onClick={() => setCurrentStep(1)} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                1. Basic Info
              </TabsTrigger>
              <TabsTrigger value="step2" onClick={() => setCurrentStep(2)} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                2. Items
              </TabsTrigger>
              <TabsTrigger value="step3" onClick={() => setCurrentStep(3)} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                3. Expenses
              </TabsTrigger>
            </TabsList>

            {/* Step 1: Basic Info */}
            <TabsContent value="step1" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Firm *</Label>
                  <Select value={formData.firm_id} onValueChange={v => setFormData(p => ({ ...p, firm_id: v }))}>
                    <SelectTrigger>
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
                  <Label className="text-muted-foreground">Tracking ID (FedEx/DHL) *</Label>
                  <Input
                    value={formData.tracking_id}
                    onChange={e => setFormData(p => ({ ...p, tracking_id: e.target.value }))}
                    placeholder="e.g., 789123456789"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Supplier Name *</Label>
                  <Input
                    value={formData.supplier_name}
                    onChange={e => setFormData(p => ({ ...p, supplier_name: e.target.value }))}
                    placeholder="e.g., Shenzhen Electronics Co."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Supplier Country</Label>
                  <Input
                    value={formData.supplier_country}
                    onChange={e => setFormData(p => ({ ...p, supplier_country: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Proforma Invoice Number *</Label>
                  <Input
                    value={formData.proforma_invoice_number}
                    onChange={e => setFormData(p => ({ ...p, proforma_invoice_number: e.target.value }))}
                    placeholder="e.g., PI-2026-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Proforma Invoice Date *</Label>
                  <Input
                    type="date"
                    value={formData.proforma_invoice_date}
                    onChange={e => setFormData(p => ({ ...p, proforma_invoice_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="p-4 bg-muted/40 rounded-lg border border-border space-y-4">
                <h4 className="font-medium flex items-center gap-2 text-foreground">
                  <Calculator className="w-4 h-4 text-primary" />
                  Exchange Rate Calculation
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Proforma Amount (USD) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.proforma_amount_usd}
                        onChange={e => setFormData(p => ({ ...p, proforma_amount_usd: e.target.value }))}
                        className="pl-9"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Bank Debit (INR) *</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.bank_debit_inr}
                        onChange={e => setFormData(p => ({ ...p, bank_debit_inr: e.target.value }))}
                        className="pl-9"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Calculated Bank Rate</Label>
                    <div className="bg-card border border-border rounded-md p-3 text-center">
                      <span className="font-mono text-lg font-bold tabular-nums text-foreground">₹{calculatedExchangeRate}</span>
                      <span className="text-xs text-muted-foreground ml-1">per USD (Bank)</span>
                    </div>
                  </div>
                </div>

                {/* Customs Exchange Rate */}
                <div className="p-3 bg-orange-500/10 border border-orange-500/25 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-orange-400">Customs Exchange Rate (for Assessable Value)</Label>
                    <span className="text-xs text-muted-foreground">Leave blank to use bank rate</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-3 w-4 h-4 text-orange-400" />
                      <Input
                        type="number"
                        step="0.0001"
                        value={formData.customs_exchange_rate}
                        onChange={e => setFormData(p => ({ ...p, customs_exchange_rate: e.target.value }))}
                        placeholder={calculatedExchangeRate || "e.g., 84.5000"}
                        className="pl-9 text-orange-300"
                      />
                    </div>
                    <div className="bg-orange-500/15 border border-orange-500/25 rounded-md p-3 text-center">
                      <span className="font-mono text-lg font-bold tabular-nums text-orange-400">₹{effectiveCustomsRate.toFixed(4)}</span>
                      <span className="text-xs text-muted-foreground ml-1">per USD (Customs)</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">RBI rate on BOE date may differ from your bank's remittance rate</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">BOE Number (Optional - required for finalization)</Label>
                  <Input
                    value={formData.boe_number}
                    onChange={e => setFormData(p => ({ ...p, boe_number: e.target.value }))}
                    placeholder="e.g., 1234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">BOE Date</Label>
                  <Input
                    type="date"
                    value={formData.boe_date}
                    onChange={e => setFormData(p => ({ ...p, boe_date: e.target.value }))}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Step 2: Items */}
            <TabsContent value="step2" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2 text-foreground">
                  <Package className="w-4 h-4 text-primary" />
                  Import Items ({formData.items.length})
                </h4>
                <Button size="sm" onClick={addItem} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary">Item {index + 1}</span>
                      {formData.items.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeItem(index)} className="text-rose-400 hover:text-rose-300">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-6 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Item Type *</Label>
                        <Select value={item.item_type} onValueChange={v => {
                          updateItem(index, 'item_type', v);
                          updateItem(index, 'item_id', '');
                          updateItem(index, 'hsn_code', '');
                        }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="raw_material">Raw Material</SelectItem>
                            <SelectItem value="master_sku">Finished SKU</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">{item.item_type === 'raw_material' ? 'Raw Material' : 'Master SKU'} *</Label>
                        <Select value={item.item_id} onValueChange={v => {
                          const itemList = item.item_type === 'raw_material' ? rawMaterials : masterSkus;
                          const selectedItem = itemList.find(s => s.id === v);
                          updateItem(index, 'item_id', v);
                          if (selectedItem?.hsn_code) updateItem(index, 'hsn_code', selectedItem.hsn_code);
                        }}>
                          <SelectTrigger>
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
                        <Label className="text-[11px] text-muted-foreground">HSN Code *</Label>
                        <Input
                          value={item.hsn_code}
                          onChange={e => updateItem(index, 'hsn_code', e.target.value)}
                          placeholder="e.g., 850790"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Quantity *</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateItem(index, 'quantity', e.target.value)}
                          className="font-mono tabular-nums"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Unit Price (USD)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_price_usd}
                          onChange={e => updateItem(index, 'unit_price_usd', e.target.value)}
                          placeholder="0.00"
                          className="font-mono tabular-nums"
                        />
                      </div>
                    </div>

                    {/* Freight & Insurance Calculation */}
                    <div className="p-3 bg-muted/40 rounded-lg border border-border mt-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-orange-400">Assessable Value Calculation (Invoice + Freight + Insurance)</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Freight Section */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px] text-muted-foreground">Freight</Label>
                            <Select value={item.freight_mode} onValueChange={v => updateItem(index, 'freight_mode', v)}>
                              <SelectTrigger className="w-28 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">% of Invoice</SelectItem>
                                <SelectItem value="manual">Manual USD</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {item.freight_mode === 'percentage' ? (
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.1"
                                value={item.freight_percent}
                                onChange={e => updateItem(index, 'freight_percent', e.target.value)}
                                placeholder="20"
                                className="pr-8 font-mono tabular-nums"
                              />
                              <Percent className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                            </div>
                          ) : (
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                              <Input
                                type="number"
                                step="0.01"
                                value={item.freight_usd}
                                onChange={e => updateItem(index, 'freight_usd', e.target.value)}
                                placeholder="0.00"
                                className="pl-9 font-mono tabular-nums"
                              />
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">Default: 20% of invoice</p>
                        </div>

                        {/* Insurance Section */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-[11px] text-muted-foreground">Insurance</Label>
                            <Select value={item.insurance_mode} onValueChange={v => updateItem(index, 'insurance_mode', v)}>
                              <SelectTrigger className="w-28 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">% of Invoice</SelectItem>
                                <SelectItem value="manual">Manual USD</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {item.insurance_mode === 'percentage' ? (
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.001"
                                value={item.insurance_percent}
                                onChange={e => updateItem(index, 'insurance_percent', e.target.value)}
                                placeholder="1.125"
                                className="pr-8 font-mono tabular-nums"
                              />
                              <Percent className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                            </div>
                          ) : (
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                              <Input
                                type="number"
                                step="0.01"
                                value={item.insurance_usd}
                                onChange={e => updateItem(index, 'insurance_usd', e.target.value)}
                                placeholder="0.00"
                                className="pl-9 font-mono tabular-nums"
                              />
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">Default: 1.125% of invoice</p>
                        </div>
                      </div>

                      {/* Calculated Assessable Value Display */}
                      {(() => {
                        const calc = calculateItemAssessableValue(item);
                        return (
                          <div className="mt-3 p-3 bg-primary/10 rounded border border-primary/25">
                            <div className="grid grid-cols-5 gap-2 text-xs">
                              <div className="text-center">
                                <p className="text-muted-foreground">Invoice (USD)</p>
                                <p className="font-mono font-bold tabular-nums text-foreground">${calc.invoiceValue.toFixed(2)}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground">+ Freight (USD)</p>
                                <p className="font-mono font-bold tabular-nums text-orange-400">${calc.freightUsd.toFixed(2)}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground">+ Insurance (USD)</p>
                                <p className="font-mono font-bold tabular-nums text-orange-400">${calc.insuranceUsd.toFixed(2)}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground">= Total (USD)</p>
                                <p className="font-mono font-bold tabular-nums text-emerald-400">${calc.totalUsd.toFixed(2)}</p>
                              </div>
                              <div className="text-center bg-primary/15 rounded p-1">
                                <p className="text-muted-foreground">Assessable (INR)</p>
                                <p className="font-mono font-bold tabular-nums text-primary text-sm">₹{calc.totalInr.toLocaleString('en-IN')}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* BCD Rate */}
                    <div className="grid grid-cols-4 gap-3 mt-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">BCD Rate (%) *</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.1"
                            value={item.bcd_rate}
                            onChange={e => updateItem(index, 'bcd_rate', e.target.value)}
                            placeholder="e.g., 10"
                            className="pr-8 font-mono tabular-nums"
                          />
                          <Percent className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="col-span-3 flex items-center bg-muted/40 rounded-md p-2 border border-border">
                        <div className="text-xs text-muted-foreground font-mono">
                          <span className="text-primary font-semibold">Duty Calculation:</span> &nbsp;
                          BCD = Assessable × BCD% &nbsp;|&nbsp;
                          SWS = BCD × 10% &nbsp;|&nbsp;
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
                <h4 className="font-medium flex items-center gap-2 text-foreground">
                  <Receipt className="w-4 h-4 text-primary" />
                  Import Expenses ({formData.expenses.length})
                </h4>
                <Button size="sm" onClick={addExpense} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-1" /> Add Expense
                </Button>
              </div>

              {formData.expenses.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-lg border border-border">
                  <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No expenses added yet. Click "Add Expense" to add shipping, handling, or other costs.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.expenses.map((expense, index) => (
                    <div key={index} className="p-4 bg-muted/30 rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary">Expense {index + 1}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeExpense(index)} className="text-rose-400 hover:text-rose-300">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Type *</Label>
                          <Select value={expense.expense_type} onValueChange={v => updateExpense(index, 'expense_type', v)}>
                            <SelectTrigger>
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
                          <Label className="text-[11px] text-muted-foreground">Description</Label>
                          <Input
                            value={expense.description}
                            onChange={e => updateExpense(index, 'description', e.target.value)}
                            placeholder="Optional details"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Amount (INR) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={expense.base_amount}
                            onChange={e => updateExpense(index, 'base_amount', e.target.value)}
                            placeholder="0.00"
                            className="font-mono tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Amount Type</Label>
                          <Select value={expense.amount_type || 'exclusive'} onValueChange={v => updateExpense(index, 'amount_type', v)}>
                            <SelectTrigger className="text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="exclusive">+ GST (Exclusive)</SelectItem>
                              <SelectItem value="inclusive">GST Inclusive</SelectItem>
                              <SelectItem value="no_gst">No GST (0%)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {expense.amount_type !== 'no_gst' && (
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">GST Rate (%)</Label>
                            <Input
                              type="number"
                              value={expense.gst_rate}
                              onChange={e => updateExpense(index, 'gst_rate', e.target.value)}
                              className="font-mono tabular-nums"
                            />
                          </div>
                        )}
                      </div>
                      {/* Show calculated breakdown */}
                      {expense.base_amount > 0 && (
                        <div className="mt-2 p-2 bg-muted/40 rounded border border-border text-xs flex items-center gap-4 font-mono tabular-nums">
                          {(() => {
                            const amt = parseFloat(expense.base_amount) || 0;
                            const rate = expense.amount_type === 'no_gst' ? 0 : (parseFloat(expense.gst_rate) || 18);
                            let baseAmt, gstAmt, totalAmt;
                            if (expense.amount_type === 'inclusive') {
                              totalAmt = amt;
                              baseAmt = amt / (1 + rate/100);
                              gstAmt = totalAmt - baseAmt;
                            } else if (expense.amount_type === 'no_gst') {
                              baseAmt = amt;
                              gstAmt = 0;
                              totalAmt = amt;
                            } else {
                              baseAmt = amt;
                              gstAmt = amt * rate / 100;
                              totalAmt = amt + gstAmt;
                            }
                            return (
                              <>
                                <span className="text-muted-foreground">Base: <span className="text-foreground">₹{baseAmt.toFixed(2)}</span></span>
                                <span className="text-muted-foreground">GST ({rate}%): <span className="text-primary">₹{gstAmt.toFixed(2)}</span></span>
                                <span className="text-muted-foreground">Total: <span className="text-emerald-400 font-semibold">₹{totalAmt.toFixed(2)}</span></span>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-muted-foreground">Notes</Label>
                <Input
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional notes..."
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
                <Button onClick={() => setCurrentStep(p => p + 1)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Next
                </Button>
              ) : (
                <Button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Calculator className="w-4 h-4 mr-2" /> {editingShipment ? 'Update & Recalculate' : 'Create & Calculate'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="bg-popover border border-border text-foreground max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Ship className="w-5 h-5 text-primary" />
              Import Shipment: {selectedShipment?.shipment_number}
              <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                selectedShipment?.status === 'finalized'
                  ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
                  : 'bg-amber-400/15 text-amber-400 ring-amber-400/25'
              }`}>
                {selectedShipment?.status}
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedShipment && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-card border border-border rounded-lg">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Tracking ID</p>
                  <p className="font-mono text-lg font-bold tabular-nums text-primary">{selectedShipment.tracking_id}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Firm</p>
                  <p className="text-lg font-semibold text-foreground">{selectedShipment.firm_name}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Supplier</p>
                  <p className="text-lg font-semibold text-foreground">{selectedShipment.supplier_name}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Exchange Rate</p>
                  <p className="font-mono text-lg font-bold tabular-nums text-emerald-400">₹{selectedShipment.exchange_rate} / USD</p>
                </div>
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 border border-border rounded-lg">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Proforma Invoice</p>
                  <p className="font-mono font-medium text-foreground">{selectedShipment.proforma_invoice_number}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Proforma Amount</p>
                  <p className="font-mono font-bold tabular-nums text-emerald-400">{formatCurrency(selectedShipment.proforma_amount_usd, 'USD')}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Bank Debit</p>
                  <p className="font-mono font-bold tabular-nums text-foreground">{formatCurrency(selectedShipment.bank_debit_inr)}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1">BOE Number</p>
                  <p className="font-mono font-bold tabular-nums text-amber-400">{selectedShipment.boe_number || '-'}</p>
                </div>
              </div>

              {/* Item Costs - Main Output */}
              <Card className="mg-card border-2 border-primary/40 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-foreground font-mono uppercase tracking-wide">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Landed Cost Per Item
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Item</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Qty</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Prorated Expenses</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Total Landed Cost</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Cost/Unit</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-amber-400 text-right">Cost/Unit (w/o GST)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedShipment.item_costs?.map((item, i) => (
                        <TableRow key={i} className="border-border">
                          <TableCell>
                            <div>
                              <p className="font-semibold text-foreground">{item.item_name || item.master_sku_name}</p>
                              <p className="text-xs font-mono text-primary">{item.sku_code}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold tabular-nums text-foreground">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-orange-400">{formatCurrency(item.prorated_expenses)}</TableCell>
                          <TableCell className="text-right font-mono font-bold tabular-nums text-primary">{formatCurrency(item.landed_cost_total)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-semibold text-foreground">{formatCurrency(item.cost_per_unit)}</TableCell>
                          <TableCell className="text-right font-mono font-bold tabular-nums text-amber-400">{formatCurrency(item.cost_per_unit_without_gst)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Items Detail */}
              <Card className="mg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-foreground font-mono uppercase tracking-wide">
                    <Package className="w-4 h-4 text-primary" />
                    Item-wise Assessable Value &amp; Duty Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Item</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">HSN</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-emerald-400 text-right">Invoice (USD)</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-orange-400 text-right">Freight (USD)</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-orange-400 text-right">Insurance (USD)</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-primary text-right">Assessable (INR)</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">BCD</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-violet-400 text-right">IGST</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-amber-400 text-right">Total Duty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedShipment.items?.map((item, i) => (
                        <TableRow key={i} className="border-border">
                          <TableCell>
                            <p className="font-medium text-foreground">{item.item_name || item.master_sku_name}</p>
                            <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                          </TableCell>
                          <TableCell className="font-mono text-primary tabular-nums">{item.hsn_code}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-emerald-400">
                            ${(item.invoice_value_usd || (item.unit_price_usd * item.quantity) || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-orange-400">
                            ${(item.freight_value_usd || 0).toFixed(2)}
                            {item.freight_mode === 'percentage' && <span className="text-[10px] text-muted-foreground ml-1">({item.freight_percent || 20}%)</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-orange-400">
                            ${(item.insurance_value_usd || 0).toFixed(2)}
                            {item.insurance_mode === 'percentage' && <span className="text-[10px] text-muted-foreground ml-1">({item.insurance_percent || 1.125}%)</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold tabular-nums text-primary">{formatCurrency(item.assessable_value)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-foreground">
                            {formatCurrency(item.bcd_amount)}
                            <span className="text-[10px] text-muted-foreground ml-1">({item.bcd_rate}%)</span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold tabular-nums text-violet-400">{formatCurrency(item.igst_amount)}</TableCell>
                          <TableCell className="text-right font-mono font-bold tabular-nums text-amber-400">{formatCurrency(item.total_duty)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Expenses */}
              {selectedShipment.expenses?.length > 0 && (
                <Card className="mg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-foreground font-mono uppercase tracking-wide">
                      <Receipt className="w-4 h-4 text-orange-400" />
                      Expenses (GST Claimable as ITC)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Type</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Description</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Base Amount</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-violet-400 text-right">GST (ITC)</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-orange-400 text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedShipment.expenses.map((exp, i) => (
                          <TableRow key={i} className="border-border">
                            <TableCell className="capitalize font-medium text-foreground">{exp.expense_type?.replace('_', ' ')}</TableCell>
                            <TableCell className="text-muted-foreground">{exp.description || '-'}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-foreground">{formatCurrency(exp.base_amount)}</TableCell>
                            <TableCell className="text-right font-mono font-semibold tabular-nums text-violet-400">{formatCurrency(exp.gst_amount)}</TableCell>
                            <TableCell className="text-right font-mono font-bold tabular-nums text-orange-400">{formatCurrency(exp.total_amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Summary Totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="mg-card rounded-lg border border-border bg-card p-4 text-center">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Total BOE Assessable</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{formatCurrency(selectedShipment.totals?.total_assessable_value)}</p>
                </div>
                <div className="mg-card rounded-lg border border-orange-500/25 bg-orange-500/10 p-4 text-center">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Total Duties</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-orange-400">{formatCurrency(selectedShipment.totals?.total_duties)}</p>
                  <p className="text-[10px] font-mono text-orange-400/70 mt-1">BCD + SWS + IGST</p>
                </div>
                <div className="mg-card rounded-lg border border-primary/40 bg-primary/10 p-4 text-center">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Grand Total Landed</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-primary">{formatCurrency(selectedShipment.totals?.grand_total_landed_cost)}</p>
                </div>
                <div className="mg-card rounded-lg border border-violet-400/25 bg-violet-400/10 p-4 text-center">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Total GST (ITC)</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-violet-400">{formatCurrency(selectedShipment.totals?.total_gst_claimable)}</p>
                  <p className="text-[10px] font-mono text-violet-400/70 mt-1">Claimable Input Credit</p>
                </div>
              </div>

              {/* Effective Cost */}
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-center">
                <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Effective Cost After ITC Claim</p>
                <p className="font-mono text-4xl font-bold tabular-nums text-emerald-400">{formatCurrency(selectedShipment.totals?.effective_cost_after_itc)}</p>
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
                  variant="outline"
                  onClick={() => {
                    setShowViewDialog(false);
                    editShipment(selectedShipment);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </Button>
                <Button
                  onClick={() => handleFinalize(selectedShipment.id)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!selectedShipment.boe_number}
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Finalize &amp; Create Purchase Entry
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

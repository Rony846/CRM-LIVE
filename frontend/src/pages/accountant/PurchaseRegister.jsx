import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  ShoppingCart, Plus, Building2, FileText, Download, Search,
  IndianRupee, Calendar, Package, Loader2, Eye, Upload, X,
  CheckCircle, AlertTriangle, ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount || 0);
};

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry", "Chandigarh",
  "Andaman & Nicobar", "Dadra & Nagar Haveli", "Daman & Diu", "Lakshadweep"
];

const GST_RATES = [0, 5, 12, 18, 28];

export default function PurchaseRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState([]);
  const [summary, setSummary] = useState(null);
  const [firms, setFirms] = useState([]);
  const [suppliers, setSuppliers] = useState([]); // Suppliers from Party Master
  const [rawMaterials, setRawMaterials] = useState([]);
  const [masterSkus, setMasterSkus] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  
  // Purchase form state
  const [purchaseForm, setPurchaseForm] = useState({
    firm_id: '',
    supplier_id: '',
    supplier_name: '',
    supplier_gstin: '',
    supplier_state: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    items: [{ item_type: 'raw_material', item_id: '', quantity: '', rate: '', gst_rate: '' }],
    notes: '',
    save_as_draft: false,
    supplier_invoice_file_url: null
  });
  
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      fetchPurchases();
      fetchFirms();
      fetchItems();
      fetchSuppliers();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchPurchases();
    }
  }, [selectedFirm, fromDate, toDate]);

  const fetchPurchases = async () => {
    try {
      let url = `${API}/purchases?limit=100`;
      if (selectedFirm && selectedFirm !== 'all') url += `&firm_id=${selectedFirm}`;
      if (fromDate) url += `&from_date=${fromDate}`;
      if (toDate) url += `&to_date=${toDate}`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPurchases(response.data.purchases || []);
      setSummary(response.data.summary);
    } catch (error) {
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  const fetchFirms = async () => {
    try {
      const response = await axios.get(`${API}/firms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFirms(response.data || []);
    } catch (error) {
      console.error('Failed to load firms');
    }
  };

  const fetchItems = async () => {
    try {
      const [rmRes, skuRes] = await Promise.all([
        axios.get(`${API}/raw-materials`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/master-skus`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setRawMaterials(rmRes.data || []);
      setMasterSkus(skuRes.data || []);
    } catch (error) {
      console.error('Failed to load items');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await axios.get(`${API}/parties`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter only suppliers
      const supplierParties = (res.data || []).filter(p => 
        p.party_types && p.party_types.includes('supplier')
      );
      setSuppliers(supplierParties);
    } catch (error) {
      console.error('Failed to load suppliers');
    }
  };

  const handleSupplierSelect = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
      setPurchaseForm({
        ...purchaseForm,
        supplier_id: supplierId,
        supplier_name: supplier.name,
        supplier_gstin: supplier.gstin || '',
        supplier_state: supplier.state || ''
      });
      setSupplierSearch('');
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (s.gstin && s.gstin.toLowerCase().includes(supplierSearch.toLowerCase()))
  );

  const validateGSTIN = (gstin) => {
    if (!gstin) return true; // Optional field
    const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return pattern.test(gstin.toUpperCase());
  };

  const handleAddItem = () => {
    setPurchaseForm({
      ...purchaseForm,
      items: [...purchaseForm.items, { item_type: 'raw_material', item_id: '', quantity: '', rate: '', gst_rate: '' }]
    });
  };

  const handleRemoveItem = (index) => {
    if (purchaseForm.items.length === 1) return;
    const newItems = purchaseForm.items.filter((_, i) => i !== index);
    setPurchaseForm({ ...purchaseForm, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...purchaseForm.items];
    newItems[index][field] = value;
    
    // Auto-populate GST rate when item is selected
    if (field === 'item_id' && value) {
      const itemType = newItems[index].item_type;
      let item;
      if (itemType === 'raw_material') {
        item = rawMaterials.find(r => r.id === value);
      } else {
        item = masterSkus.find(s => s.id === value);
      }
      if (item && item.gst_rate !== undefined) {
        newItems[index].gst_rate = item.gst_rate;
      }
    }
    
    // Clear item_id when item_type changes
    if (field === 'item_type') {
      newItems[index].item_id = '';
      newItems[index].gst_rate = '';
    }
    
    setPurchaseForm({ ...purchaseForm, items: newItems });
  };

  const calculateItemTotal = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const gstRate = parseFloat(item.gst_rate) || 0;
    const taxable = qty * rate;
    const gst = taxable * (gstRate / 100);
    return { taxable, gst, total: taxable + gst };
  };

  const calculateGrandTotal = () => {
    let totalTaxable = 0;
    let totalGst = 0;
    
    purchaseForm.items.forEach(item => {
      const { taxable, gst } = calculateItemTotal(item);
      totalTaxable += taxable;
      totalGst += gst;
    });
    
    return { totalTaxable, totalGst, grandTotal: totalTaxable + totalGst };
  };

  const getGstType = () => {
    if (!purchaseForm.firm_id || !purchaseForm.supplier_state) return null;
    const firm = firms.find(f => f.id === purchaseForm.firm_id);
    if (!firm) return null;
    const firmState = (firm.state || '').toLowerCase().trim();
    const supplierState = purchaseForm.supplier_state.toLowerCase().trim();
    return firmState === supplierState ? 'CGST + SGST' : 'IGST';
  };

  const handleSubmit = async () => {
    // Validation
    if (!purchaseForm.firm_id) {
      toast.error('Please select a firm');
      return;
    }
    if (!purchaseForm.supplier_id) {
      toast.error('Please select a supplier from the dropdown. If supplier is not in the list, add them in Party Master first.');
      return;
    }
    if (!purchaseForm.supplier_state) {
      toast.error('Supplier state is required');
      return;
    }
    if (!purchaseForm.invoice_number) {
      toast.error('Please enter invoice number');
      return;
    }
    if (purchaseForm.supplier_gstin && !validateGSTIN(purchaseForm.supplier_gstin)) {
      toast.error('Invalid GSTIN format');
      return;
    }
    
    // Validate items
    for (let i = 0; i < purchaseForm.items.length; i++) {
      const item = purchaseForm.items[i];
      if (!item.item_id) {
        toast.error(`Please select item for row ${i + 1}`);
        return;
      }
      if (!item.quantity || parseFloat(item.quantity) <= 0) {
        toast.error(`Please enter valid quantity for row ${i + 1}`);
        return;
      }
      if (!item.rate || parseFloat(item.rate) <= 0) {
        toast.error(`Please enter valid rate for row ${i + 1}`);
        return;
      }
    }
    
    setSubmitting(true);
    try {
      const payload = {
        ...purchaseForm,
        items: purchaseForm.items.map(item => ({
          item_type: item.item_type,
          item_id: item.item_id,
          quantity: parseFloat(item.quantity),
          rate: parseFloat(item.rate),
          gst_rate: item.gst_rate ? parseFloat(item.gst_rate) : null
        }))
      };
      
      const response = await axios.post(`${API}/purchases`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Show compliance warnings if any
      if (response.data.compliance_soft_blocks?.length > 0 || response.data.compliance_warnings?.length > 0) {
        toast.warning(`Purchase ${response.data.status === 'draft' ? 'saved as draft' : 'created'} with compliance warnings`, {
          description: response.data.compliance_soft_blocks?.[0] || response.data.compliance_warnings?.[0]
        });
      } else {
        toast.success(`Purchase ${response.data.status === 'draft' ? 'saved as draft' : 'finalized'}: ${response.data.purchase_number}`);
      }
      
      setCreateDialogOpen(false);
      resetForm();
      fetchPurchases();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (typeof detail === 'object' && detail.hard_blocks) {
        toast.error(detail.message || 'Compliance validation failed', {
          description: detail.hard_blocks[0]
        });
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Failed to create purchase');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setPurchaseForm({
      firm_id: '',
      supplier_id: '',
      supplier_name: '',
      supplier_gstin: '',
      supplier_state: '',
      invoice_number: '',
      invoice_date: new Date().toISOString().split('T')[0],
      items: [{ item_type: 'raw_material', item_id: '', quantity: '', rate: '', gst_rate: '' }],
      notes: '',
      save_as_draft: false,
      supplier_invoice_file_url: null
    });
    setSupplierSearch('');
  };

  const handleExport = async () => {
    try {
      let url = `${API}/purchases/export/csv`;
      const params = [];
      if (selectedFirm && selectedFirm !== 'all') params.push(`firm_id=${selectedFirm}`);
      if (fromDate) params.push(`from_date=${fromDate}`);
      if (toDate) params.push(`to_date=${toDate}`);
      if (params.length) url += `?${params.join('&')}`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `purchase_register_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      toast.success('Export successful');
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  const viewPurchase = async (purchase) => {
    setSelectedPurchase(purchase);
    setViewDialogOpen(true);
  };

  const { totalTaxable, totalGst, grandTotal } = calculateGrandTotal();
  const gstType = getGstType();

  if (loading) {
    return (
      <DashboardLayout title="Purchase Register">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Purchase Register">
      <div className="space-y-6" data-testid="purchase-register">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="text-slate-400 hover:text-white"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">Purchase Register</h1>
              <p className="text-slate-400">Manage purchases with GST tracking and inventory updates</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="new-purchase-btn" className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="w-4 h-4 mr-2" />
              New Purchase
            </Button>
          </div>
        </div>

        {/* Summary Cards - Dark Theme */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <p className="text-sm text-slate-400">Total Purchases</p>
                <p className="text-2xl font-bold text-white">{summary.count || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <p className="text-sm text-slate-400">Taxable Value</p>
                <p className="text-xl font-bold text-green-400">{formatCurrency(summary.total_taxable)}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <p className="text-sm text-slate-400">IGST</p>
                <p className="text-xl font-bold text-orange-400">{formatCurrency(summary.total_igst)}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <p className="text-sm text-slate-400">CGST + SGST</p>
                <p className="text-xl font-bold text-purple-400">{formatCurrency((summary.total_cgst || 0) + (summary.total_sgst || 0))}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <p className="text-sm text-slate-400">Total Amount</p>
                <p className="text-xl font-bold text-cyan-400">{formatCurrency(summary.total_amount)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700 mb-4">
          <CardContent className="p-4">
            <div className="flex gap-4 flex-wrap items-end">
            <div className="w-48">
              <Label>Firm</Label>
              <Select value={selectedFirm} onValueChange={setSelectedFirm}>
                <SelectTrigger>
                  <SelectValue placeholder="All Firms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Firms</SelectItem>
                  {firms.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From Date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <Label>To Date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => { setFromDate(''); setToDate(''); setSelectedFirm('all'); }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Purchases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Register</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purchase #</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Firm</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>GST Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell className="font-mono text-sm">{purchase.purchase_number}</TableCell>
                  <TableCell>{purchase.invoice_date}</TableCell>
                  <TableCell className="font-mono text-sm">{purchase.invoice_number}</TableCell>
                  <TableCell>{purchase.firm_name}</TableCell>
                  <TableCell>
                    <div>
                      <p>{purchase.supplier_name}</p>
                      {purchase.supplier_gstin && (
                        <p className="text-xs text-slate-500 font-mono">{purchase.supplier_gstin}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={purchase.is_inter_state ? 'default' : 'secondary'}>
                      {purchase.is_inter_state ? 'IGST' : 'CGST+SGST'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge className={purchase.status === 'draft' ? 'bg-yellow-600' : 'bg-green-600'}>
                        {purchase.status || 'final'}
                      </Badge>
                      {purchase.doc_status && purchase.doc_status !== 'complete' && (
                        <Badge className={purchase.doc_status === 'pending' ? 'bg-orange-600' : 'bg-purple-600'}>
                          {purchase.doc_status}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(purchase.total_taxable)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(purchase.total_gst)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(purchase.total_amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => viewPurchase(purchase)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {purchases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-slate-500">
                    No purchases found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Purchase Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Purchase Entry</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Firm *</Label>
                <Select 
                  value={purchaseForm.firm_id} 
                  onValueChange={(v) => setPurchaseForm({...purchaseForm, firm_id: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name} ({f.state})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Invoice Date *</Label>
                <Input 
                  type="date" 
                  value={purchaseForm.invoice_date}
                  onChange={(e) => setPurchaseForm({...purchaseForm, invoice_date: e.target.value})}
                />
              </div>
            </div>

            {/* Supplier Info */}
            <div className="p-4 bg-slate-50 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Supplier Details</h4>
                <p className="text-xs text-slate-500">
                  Supplier not in list? <a href="/admin/party-master" target="_blank" className="text-cyan-600 hover:underline">Add in Party Master</a>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Select Supplier *</Label>
                  <Select 
                    value={purchaseForm.supplier_id}
                    onValueChange={handleSupplierSelect}
                  >
                    <SelectTrigger className="mt-1" data-testid="supplier-select">
                      <SelectValue placeholder="Select supplier from Party Master" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <div className="p-2 sticky top-0 bg-white border-b">
                        <Input
                          placeholder="Search suppliers..."
                          value={supplierSearch}
                          onChange={(e) => setSupplierSearch(e.target.value)}
                          className="h-8"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      {filteredSuppliers.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-sm">
                          No suppliers found. <br />
                          <a href="/admin/party-master" target="_blank" className="text-cyan-600 hover:underline">
                            Add supplier in Party Master
                          </a>
                        </div>
                      ) : (
                        filteredSuppliers.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{s.name}</span>
                              <span className="text-xs text-slate-500">
                                {s.gstin || 'No GSTIN'} | {s.state}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Invoice Number *</Label>
                  <Input 
                    value={purchaseForm.invoice_number}
                    onChange={(e) => setPurchaseForm({...purchaseForm, invoice_number: e.target.value})}
                    placeholder="Enter invoice number"
                    className="mt-1"
                  />
                </div>
              </div>
              
              {/* Display selected supplier info */}
              {purchaseForm.supplier_id && (
                <div className="grid grid-cols-3 gap-4 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                  <div>
                    <Label className="text-xs text-slate-500">Supplier Name</Label>
                    <p className="font-medium">{purchaseForm.supplier_name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">GSTIN</Label>
                    <p className="font-mono text-sm">{purchaseForm.supplier_gstin || 'Not provided'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">State</Label>
                    <p>{purchaseForm.supplier_state}</p>
                  </div>
                </div>
              )}
              
              {gstType && (
                <div className={`p-3 rounded-lg ${gstType === 'IGST' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">GST Type: {gstType}</span>
                    <span className="text-sm opacity-80">
                      ({gstType === 'IGST' ? 'Inter-state transaction' : 'Intra-state transaction'})
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Items</h4>
                <Button variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-28">Rate</TableHead>
                    <TableHead className="w-24">GST %</TableHead>
                    <TableHead className="w-28 text-right">Taxable</TableHead>
                    <TableHead className="w-24 text-right">GST</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseForm.items.map((item, index) => {
                    const { taxable, gst, total } = calculateItemTotal(item);
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <Select 
                            value={item.item_type}
                            onValueChange={(v) => handleItemChange(index, 'item_type', v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="raw_material">Raw Material</SelectItem>
                              <SelectItem value="master_sku">Master SKU</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={item.item_id}
                            onValueChange={(v) => handleItemChange(index, 'item_id', v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                              {(item.item_type === 'raw_material' ? rawMaterials : masterSkus).map(i => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.sku_code} - {i.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={item.gst_rate?.toString() || ''}
                            onValueChange={(v) => handleItemChange(index, 'gst_rate', v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="%" />
                            </SelectTrigger>
                            <SelectContent>
                              {GST_RATES.map(rate => (
                                <SelectItem key={rate} value={rate.toString()}>{rate}%</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(taxable)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(gst)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
                        <TableCell>
                          {purchaseForm.items.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(index)}>
                              <X className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {/* Totals */}
              <div className="mt-4 flex justify-end">
                <div className="w-72 space-y-2">
                  <div className="flex justify-between">
                    <span>Taxable Value:</span>
                    <span className="font-semibold">{formatCurrency(totalTaxable)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total GST:</span>
                    <span className="font-semibold">{formatCurrency(totalGst)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-lg">
                    <span className="font-semibold">Grand Total:</span>
                    <span className="font-bold text-blue-600">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea 
                value={purchaseForm.notes}
                onChange={(e) => setPurchaseForm({...purchaseForm, notes: e.target.value})}
                placeholder="Any additional notes..."
              />
            </div>
            
            {/* Compliance Notice */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <strong>Compliance Note:</strong> Supplier invoice copy is MANDATORY. 
                Without it, you can only save as draft.
              </p>
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center">
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="checkbox"
                checked={purchaseForm.save_as_draft}
                onChange={(e) => setPurchaseForm({...purchaseForm, save_as_draft: e.target.checked})}
                className="rounded"
              />
              <span className="text-slate-600">Save as Draft (skip compliance check)</span>
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
                {purchaseForm.save_as_draft ? 'Save Draft' : 'Create Purchase'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Purchase Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Details - {selectedPurchase?.purchase_number}</DialogTitle>
          </DialogHeader>
          
          {selectedPurchase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Firm</p>
                  <p className="font-medium">{selectedPurchase.firm_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Invoice Date</p>
                  <p className="font-medium">{selectedPurchase.invoice_date}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Invoice Number</p>
                  <p className="font-mono">{selectedPurchase.invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">GST Type</p>
                  <Badge variant={selectedPurchase.is_inter_state ? 'default' : 'secondary'}>
                    {selectedPurchase.is_inter_state ? 'IGST (Inter-state)' : 'CGST+SGST (Intra-state)'}
                  </Badge>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold mb-2">Supplier</h4>
                <p>{selectedPurchase.supplier_name}</p>
                {selectedPurchase.supplier_gstin && (
                  <p className="text-sm font-mono text-slate-600">{selectedPurchase.supplier_gstin}</p>
                )}
                <p className="text-sm text-slate-500">{selectedPurchase.supplier_state}</p>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Items</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>HSN</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">GST %</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPurchase.items?.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <p className="font-mono text-sm">{item.sku_code}</p>
                          <p className="text-sm text-slate-500">{item.item_name}</p>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.hsn_code || '-'}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                        <TableCell className="text-right">{item.gst_rate}%</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-end">
                <div className="w-72 space-y-2 p-4 bg-slate-50 rounded-lg">
                  <div className="flex justify-between">
                    <span>Taxable Value:</span>
                    <span>{formatCurrency(selectedPurchase.total_taxable)}</span>
                  </div>
                  {selectedPurchase.is_inter_state ? (
                    <div className="flex justify-between">
                      <span>IGST:</span>
                      <span>{formatCurrency(selectedPurchase.total_igst)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>CGST:</span>
                        <span>{formatCurrency(selectedPurchase.total_cgst)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST:</span>
                        <span>{formatCurrency(selectedPurchase.total_sgst)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between border-t pt-2 text-lg">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold text-blue-600">{formatCurrency(selectedPurchase.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </DashboardLayout>
  );
}

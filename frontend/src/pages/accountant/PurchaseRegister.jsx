import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  ShoppingCart, Plus, Building2, FileText, Download, Search,
  IndianRupee, Calendar, Package, Loader2, Eye, Upload, X,
  CheckCircle, AlertTriangle, ArrowLeft, Pencil, Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
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
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canDelete = ['admin', 'accountant'].includes(user?.role);
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadingDraftInvoice, setUploadingDraftInvoice] = useState(false);

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

  // Edit form state (admin only)
  const [editForm, setEditForm] = useState({
    items: [],
    party_state: '',
    notes: '',
    payment_status: ''
  });

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

  const handleInvoiceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload PDF or image files only');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size should be less than 10MB');
      return;
    }

    setUploadingInvoice(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'purchase_invoices');
      formData.append('supplier_name', purchaseForm.supplier_name || '');
      formData.append('purchase_date', purchaseForm.invoice_date || '');

      const response = await axios.post(`${API}/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setPurchaseForm({
        ...purchaseForm,
        supplier_invoice_file_url: response.data.file_url || response.data.url
      });
      toast.success('Invoice uploaded successfully');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload invoice. Please try again.');
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleDraftInvoiceUpload = async (e, purchaseId) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload PDF or image files only');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size should be less than 10MB');
      return;
    }

    setUploadingDraftInvoice(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'purchase_invoices');
      formData.append('supplier_name', selectedPurchase?.supplier_name || '');
      formData.append('purchase_date', selectedPurchase?.invoice_date || '');

      const uploadResponse = await axios.post(`${API}/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const fileUrl = uploadResponse.data.file_url || uploadResponse.data.url;

      // Update the purchase with the invoice URL
      await axios.patch(`${API}/purchases/${purchaseId}`, {
        supplier_invoice_file_url: fileUrl
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update local state
      setSelectedPurchase({
        ...selectedPurchase,
        supplier_invoice_file_url: fileUrl
      });

      toast.success('Invoice uploaded and attached to purchase');
      fetchPurchases(); // Refresh the list
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload invoice. Please try again.');
    } finally {
      setUploadingDraftInvoice(false);
    }
  };

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

  // Finalize an agent-created draft. Pops a confirm; on success reloads.
  const handleFinalize = async (purchase) => {
    if (!window.confirm(
      `Mark purchase ${purchase.purchase_number} (₹${purchase.total_amount?.toLocaleString()}) as final?\n\n` +
      `Please verify supplier GSTIN, item HSN codes, and totals are correct first.`
    )) return;
    try {
      await axios.post(`${API}/purchases/${purchase.id}/finalize`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`${purchase.purchase_number} finalized`);
      // Reload list
      await fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not finalize — open the entry, fill missing fields, and try again.');
    }
  };

  // Delete a draft/pending purchase. Backend refuses complete/posted ones with 409.
  const handleDelete = async (purchase) => {
    if (!window.confirm(
      `Delete purchase ${purchase.purchase_number} from ${purchase.supplier_name || 'unknown supplier'}?\n\n` +
      `Invoice: ${purchase.invoice_number || '(none)'}  •  ₹${(purchase.total_amount || 0).toLocaleString()}\n\n` +
      `This is permanent. Only drafts / pending entries can be deleted; posted purchases need a credit note instead.`
    )) return;
    try {
      await axios.delete(`${API}/purchases/${purchase.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`${purchase.purchase_number} deleted`);
      await fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not delete this purchase.');
    }
  };

  // Open edit dialog (admin only)
  const handleOpenEdit = (purchase) => {
    setSelectedPurchase(purchase);
    setEditForm({
      items: purchase.items?.map(item => ({
        ...item,
        hsn_code: item.hsn_code || '',
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        gst_rate: item.gst_rate || 18,
        discount: item.discount || 0
      })) || [],
      party_state: purchase.party_state || '',
      notes: purchase.notes || '',
      payment_status: purchase.payment_status || 'unpaid'
    });
    setEditDialogOpen(true);
  };

  // Update edit form item
  const updateEditItem = (index, field, value) => {
    setEditForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }));
  };

  // Save edited purchase (admin only)
  const handleSaveEdit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        items: editForm.items.map(item => ({
          ...item,
          quantity: parseInt(item.quantity) || 1,
          rate: parseFloat(item.rate) || 0,
          gst_rate: parseFloat(item.gst_rate) || 18,
          discount: parseFloat(item.discount) || 0
        })),
        party_state: editForm.party_state,
        notes: editForm.notes,
        payment_status: editForm.payment_status
      };

      await axios.patch(`${API}/purchases/${selectedPurchase.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Purchase updated successfully');
      setEditDialogOpen(false);
      setSelectedPurchase(null);
      fetchPurchases();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update purchase');
    } finally {
      setSubmitting(false);
    }
  };

  const { totalTaxable, totalGst, grandTotal } = calculateGrandTotal();
  const gstType = getGstType();

  if (loading) {
    return (
      <DashboardLayout title="Purchase Register">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Purchase Register">
      <div className="space-y-6" data-testid="purchase-register">

        {/* ── Page Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-muted-foreground hover:text-foreground"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Purchase Register</h1>
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                Manage purchases with GST tracking and inventory updates
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              data-testid="new-purchase-btn"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Purchase
            </Button>
          </div>
        </div>

        {/* ── AI-Drafts Banner ─────────────────────────────────── */}
        {(() => {
          const drafts = (purchases || []).filter(p => p.source === 'whatsapp_agent' && p.doc_status !== 'complete');
          if (drafts.length === 0) return null;
          return (
            <div className="mg-card rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-4 flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-amber-400/15 text-amber-400 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-400 mb-0.5">
                  {drafts.length} purchase{drafts.length === 1 ? '' : 's'} created by WhatsApp agent — pending your review
                </p>
                <p className="text-xs text-muted-foreground">
                  These were auto-extracted from invoice files sent to the AI assistant. Please verify supplier GSTIN, item HSN codes, and totals, then click <strong className="text-foreground">Finalize</strong> on each row.
                </p>
              </div>
            </div>
          );
        })()}

        {/* ── Summary Stat Cards ───────────────────────────────── */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Total Purchases */}
            <div className="mg-card rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  Total Purchases
                </p>
                <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/15 text-primary">
                  <ShoppingCart className="w-5 h-5" />
                </div>
              </div>
              <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
                {summary.count || 0}
              </p>
            </div>

            {/* Taxable Value */}
            <div className="mg-card rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  Taxable Value
                </p>
                <div className="flex h-10 w-10 items-center justify-center rounded bg-emerald-500/15 text-emerald-500">
                  <IndianRupee className="w-5 h-5" />
                </div>
              </div>
              <p className="font-mono text-xl font-bold tabular-nums text-emerald-500">
                {formatCurrency(summary.total_taxable)}
              </p>
            </div>

            {/* IGST */}
            <div className="mg-card rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  IGST
                </p>
                <div className="flex h-10 w-10 items-center justify-center rounded bg-orange-400/15 text-orange-400">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <p className="font-mono text-xl font-bold tabular-nums text-orange-400">
                {formatCurrency(summary.total_igst)}
              </p>
            </div>

            {/* CGST + SGST */}
            <div className="mg-card rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  CGST + SGST
                </p>
                <div className="flex h-10 w-10 items-center justify-center rounded bg-violet-400/15 text-violet-400">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <p className="font-mono text-xl font-bold tabular-nums text-violet-400">
                {formatCurrency((summary.total_cgst || 0) + (summary.total_sgst || 0))}
              </p>
            </div>

            {/* Total Amount */}
            <div className="mg-card rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  Total Amount
                </p>
                <div className="flex h-10 w-10 items-center justify-center rounded bg-sky-400/15 text-sky-400">
                  <IndianRupee className="w-5 h-5" />
                </div>
              </div>
              <p className="font-mono text-xl font-bold tabular-nums text-sky-400">
                {formatCurrency(summary.total_amount)}
              </p>
            </div>
          </div>
        )}

        {/* ── Filter Bar ───────────────────────────────────────── */}
        <div className="mg-card rounded-lg border border-border bg-card p-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="w-48">
              <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Firm</Label>
              <Select value={selectedFirm} onValueChange={setSelectedFirm}>
                <SelectTrigger className="mt-1">
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
              <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
            <div>
              <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">To Date</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => { setFromDate(''); setToDate(''); setSelectedFirm('all'); }}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Clear Filters
            </Button>
          </div>
        </div>

        {/* ── Purchase Register Table ──────────────────────────── */}
        <Card className="mg-card border border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground tracking-tight">
              Purchase Register
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
                    <TableCell className="font-mono text-sm tabular-nums text-foreground">
                      {purchase.purchase_number}
                    </TableCell>
                    <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                      {purchase.invoice_date}
                    </TableCell>
                    <TableCell className="font-mono text-sm tabular-nums text-foreground">
                      {purchase.invoice_number}
                    </TableCell>
                    <TableCell className="text-foreground">{purchase.firm_name}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-foreground flex items-center gap-2">
                          {purchase.supplier_name}
                          {purchase.source === 'whatsapp_agent' && (
                            <span title="Created by WhatsApp AI agent — please review"
                                  className="rounded px-1.5 py-0 text-[9px] font-mono font-semibold uppercase tracking-wider ring-1 bg-violet-400/15 text-violet-400 ring-violet-400/30">
                              AI
                            </span>
                          )}
                        </p>
                        {purchase.supplier_gstin && (
                          <p className="font-mono text-[11px] tabular-nums text-muted-foreground mt-0.5">
                            {purchase.supplier_gstin}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                        purchase.is_inter_state
                          ? 'bg-sky-400/15 text-sky-400 ring-sky-400/25'
                          : 'bg-violet-400/15 text-violet-400 ring-violet-400/25'
                      }`}>
                        {purchase.is_inter_state ? 'IGST' : 'CGST+SGST'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                          purchase.status === 'draft'
                            ? 'bg-amber-400/15 text-amber-400 ring-amber-400/25'
                            : 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25'
                        }`}>
                          {purchase.status || 'final'}
                        </span>
                        {purchase.doc_status && purchase.doc_status !== 'complete' && (
                          <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                            purchase.doc_status === 'pending'
                              ? 'bg-orange-400/15 text-orange-400 ring-orange-400/25'
                              : 'bg-violet-400/15 text-violet-400 ring-violet-400/25'
                          }`}>
                            {purchase.doc_status}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {formatCurrency(purchase.total_taxable || purchase.totals?.taxable_value || purchase.totals?.subtotal || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {formatCurrency(purchase.total_gst || purchase.totals?.total_gst || purchase.totals?.gst_amount || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold text-foreground">
                      {formatCurrency(purchase.total_amount || purchase.totals?.grand_total || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {purchase.source === 'whatsapp_agent' && purchase.doc_status !== 'complete' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFinalize(purchase)}
                          className="text-emerald-400 hover:text-emerald-300"
                          title="Finalize agent draft"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewPurchase(purchase)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(purchase)}
                          className="text-orange-400 hover:text-orange-300"
                          title="Edit Purchase (Admin)"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {canDelete && ['draft', 'pending'].includes(purchase.doc_status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(purchase)}
                          className="text-rose-400 hover:text-rose-300"
                          title="Delete draft purchase"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {purchases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                      <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-mono text-[11px] uppercase tracking-wide">No purchases found</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ── Create Purchase Dialog ───────────────────────────── */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto bg-popover border border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground text-xl tracking-tight">
                Create Purchase Entry
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Firm *</Label>
                  <Select
                    value={purchaseForm.firm_id}
                    onValueChange={(v) => setPurchaseForm({...purchaseForm, firm_id: v})}
                  >
                    <SelectTrigger className="mt-1">
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
                  <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Invoice Date *</Label>
                  <Input
                    type="date"
                    value={purchaseForm.invoice_date}
                    onChange={(e) => setPurchaseForm({...purchaseForm, invoice_date: e.target.value})}
                    className="mt-1 [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
              </div>

              {/* Supplier Info */}
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-foreground">Supplier Details</h4>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    Not in list?{' '}
                    <a href="/admin/party-master" target="_blank" className="text-primary hover:underline">
                      Add in Party Master
                    </a>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      Select Supplier *
                    </Label>
                    <Select
                      value={purchaseForm.supplier_id}
                      onValueChange={handleSupplierSelect}
                    >
                      <SelectTrigger className="mt-1" data-testid="supplier-select">
                        <SelectValue placeholder="Select supplier from Party Master" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <div className="p-2 sticky top-0 bg-popover border-b border-border">
                          <Input
                            placeholder="Search suppliers..."
                            value={supplierSearch}
                            onChange={(e) => setSupplierSearch(e.target.value)}
                            className="h-8"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        {filteredSuppliers.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground font-mono text-[11px]">
                            No suppliers found.<br />
                            <a href="/admin/party-master" target="_blank" className="text-primary hover:underline">
                              Add supplier in Party Master
                            </a>
                          </div>
                        ) : (
                          filteredSuppliers.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">{s.name}</span>
                                <span className="font-mono text-[11px] text-muted-foreground">
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
                    <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      Invoice Number *
                    </Label>
                    <Input
                      value={purchaseForm.invoice_number}
                      onChange={(e) => setPurchaseForm({...purchaseForm, invoice_number: e.target.value})}
                      placeholder="Enter invoice number"
                      className="mt-1 font-mono"
                    />
                  </div>
                </div>

                {/* Selected supplier info */}
                {purchaseForm.supplier_id && (
                  <div className="grid grid-cols-3 gap-4 p-3 rounded-lg border border-primary/25 bg-primary/[0.06]">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Supplier Name
                      </p>
                      <p className="font-medium text-foreground">{purchaseForm.supplier_name}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        GSTIN
                      </p>
                      <p className="font-mono text-sm tabular-nums text-foreground">
                        {purchaseForm.supplier_gstin || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        State
                      </p>
                      <p className="text-foreground">{purchaseForm.supplier_state}</p>
                    </div>
                  </div>
                )}

                {gstType && (
                  <div className={`p-3 rounded-lg border flex items-center gap-2 ${
                    gstType === 'IGST'
                      ? 'bg-sky-400/10 border-sky-400/25 text-sky-400'
                      : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
                  }`}>
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wide">
                      GST Type: {gstType}
                    </span>
                    <span className="font-mono text-[11px] opacity-70">
                      ({gstType === 'IGST' ? 'Inter-state transaction' : 'Intra-state transaction'})
                    </span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                  <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Items
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                    className="border-border text-muted-foreground hover:text-foreground hover:bg-muted h-7 font-mono text-[11px]"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Item
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Type</TableHead>
                        <TableHead className="min-w-[220px]">Item</TableHead>
                        <TableHead className="w-32 text-center">Quantity</TableHead>
                        <TableHead className="w-36 text-center">Rate (₹)</TableHead>
                        <TableHead className="w-24 text-center">GST %</TableHead>
                        <TableHead className="w-32 text-right">Taxable</TableHead>
                        <TableHead className="w-28 text-right">GST</TableHead>
                        <TableHead className="w-32 text-right">Total</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseForm.items.map((item, index) => {
                        const { taxable, gst, total } = calculateItemTotal(item);
                        return (
                          <TableRow key={index}>
                            <TableCell className="p-2">
                              <Select
                                value={item.item_type}
                                onValueChange={(v) => handleItemChange(index, 'item_type', v)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="raw_material">Raw Material</SelectItem>
                                  <SelectItem value="master_sku">Master SKU</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-2">
                              <Select
                                value={item.item_id}
                                onValueChange={(v) => handleItemChange(index, 'item_id', v)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select item" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(item.item_type === 'raw_material' ? rawMaterials : masterSkus).map(i => (
                                    <SelectItem key={i.id} value={i.id}>
                                      <span className="font-mono text-[11px]">{i.sku_code}</span>
                                      {' — '}{i.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="0"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                className="h-9 text-center font-mono tabular-nums w-full"
                                data-testid={`qty-input-${index}`}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={item.rate}
                                onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                                className="h-9 text-right font-mono tabular-nums w-full"
                                data-testid={`rate-input-${index}`}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Select
                                value={item.gst_rate?.toString() || ''}
                                onValueChange={(v) => handleItemChange(index, 'gst_rate', v)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="%" />
                                </SelectTrigger>
                                <SelectContent>
                                  {GST_RATES.map(rate => (
                                    <SelectItem key={rate} value={rate.toString()}>
                                      <span className="font-mono">{rate}%</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right p-2 font-mono tabular-nums text-muted-foreground">
                              {formatCurrency(taxable)}
                            </TableCell>
                            <TableCell className="text-right p-2 font-mono tabular-nums text-muted-foreground">
                              {formatCurrency(gst)}
                            </TableCell>
                            <TableCell className="text-right p-2 font-mono tabular-nums font-semibold text-foreground">
                              {formatCurrency(total)}
                            </TableCell>
                            <TableCell className="p-1">
                              {purchaseForm.items.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveItem(index)}
                                  className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-400/10"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals footer */}
                <div className="flex justify-end p-4 border-t border-border">
                  <div className="w-80 rounded-lg border border-border bg-muted/40 p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                        Taxable Value
                      </span>
                      <span className="font-mono tabular-nums text-foreground font-semibold">
                        {formatCurrency(totalTaxable)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                        Total GST
                      </span>
                      <span className="font-mono tabular-nums text-foreground font-semibold">
                        {formatCurrency(totalGst)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-border">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-foreground font-semibold">
                        Grand Total
                      </span>
                      <span className="font-mono tabular-nums text-xl font-bold text-primary">
                        {formatCurrency(grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Supplier Invoice Upload */}
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-semibold text-foreground">Supplier Invoice *</Label>
                    <p className="font-mono text-[11px] text-muted-foreground mt-1">
                      Upload PDF or image of supplier invoice
                    </p>
                  </div>
                  {purchaseForm.supplier_invoice_file_url && (
                    <a
                      href={purchaseForm.supplier_invoice_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 text-sm flex items-center gap-1"
                    >
                      <FileText className="w-4 h-4" />
                      View Uploaded
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleInvoiceUpload}
                    className="flex-1"
                    data-testid="invoice-upload-input"
                  />
                  {uploadingInvoice && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="font-mono text-[11px]">Uploading...</span>
                    </div>
                  )}
                </div>
                {purchaseForm.supplier_invoice_file_url && (
                  <div className="flex items-center gap-2 text-emerald-500 font-mono text-[11px]">
                    <CheckCircle className="w-4 h-4" />
                    Invoice uploaded successfully
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  Notes (Optional)
                </Label>
                <Textarea
                  value={purchaseForm.notes}
                  onChange={(e) => setPurchaseForm({...purchaseForm, notes: e.target.value})}
                  placeholder="Any additional notes..."
                  className="mt-1"
                />
              </div>

              {/* Compliance Notice */}
              {!purchaseForm.supplier_invoice_file_url && (
                <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4">
                  <p className="font-mono text-[11px] text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      <strong>Compliance Note:</strong> Supplier invoice copy is MANDATORY.
                      Without it, you can only save as draft.
                    </span>
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-between items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={purchaseForm.save_as_draft}
                  onChange={(e) => setPurchaseForm({...purchaseForm, save_as_draft: e.target.checked})}
                  className="rounded"
                />
                <span className="font-mono text-[11px] text-muted-foreground">
                  Save as Draft (skip compliance check)
                </span>
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  className="border-border text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {submitting
                    ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    : <ShoppingCart className="w-4 h-4 mr-2" />
                  }
                  {purchaseForm.save_as_draft ? 'Save Draft' : 'Create Purchase'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── View Purchase Dialog ─────────────────────────────── */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-popover border border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-foreground tracking-tight">
                <span className="font-mono tabular-nums">
                  Purchase Details — {selectedPurchase?.purchase_number}
                </span>
                {(selectedPurchase?.is_draft || selectedPurchase?.status === 'draft') && (
                  <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 bg-amber-400/15 text-amber-400 ring-amber-400/25">
                    Draft
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            {selectedPurchase && (
              <div className="space-y-4">
                {/* Invoice Upload for Drafts */}
                {(selectedPurchase.is_draft || selectedPurchase.status === 'draft') && (
                  <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-amber-400 flex items-center gap-2">
                          <Upload className="w-4 h-4" />
                          Upload Supplier Invoice
                        </h4>
                        <p className="font-mono text-[11px] text-amber-400/70 mt-1">
                          This purchase is saved as draft. Upload invoice to finalize.
                        </p>
                      </div>
                      {selectedPurchase.supplier_invoice_file_url && (
                        <a
                          href={selectedPurchase.supplier_invoice_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 text-sm flex items-center gap-1"
                        >
                          <FileText className="w-4 h-4" />
                          View Invoice
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleDraftInvoiceUpload(e, selectedPurchase.id)}
                        className="flex-1"
                        disabled={uploadingDraftInvoice}
                      />
                      {uploadingDraftInvoice && (
                        <div className="flex items-center gap-2 text-amber-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="font-mono text-[11px]">Uploading...</span>
                        </div>
                      )}
                    </div>
                    {selectedPurchase.supplier_invoice_file_url && (
                      <div className="flex items-center gap-2 text-emerald-500 font-mono text-[11px]">
                        <CheckCircle className="w-4 h-4" />
                        Invoice attached
                      </div>
                    )}
                  </div>
                )}

                {/* Existing Invoice Link for Finalized Purchases */}
                {!(selectedPurchase.is_draft || selectedPurchase.status === 'draft') && selectedPurchase.supplier_invoice_file_url && (
                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
                    <a
                      href={selectedPurchase.supplier_invoice_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-500 hover:text-emerald-400 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide"
                    >
                      <FileText className="w-4 h-4" />
                      View Supplier Invoice
                    </a>
                  </div>
                )}

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Firm</p>
                    <p className="font-medium text-foreground">{selectedPurchase.firm_name}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Invoice Date</p>
                    <p className="font-mono tabular-nums text-foreground">{selectedPurchase.invoice_date}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Invoice Number</p>
                    <p className="font-mono tabular-nums text-foreground">{selectedPurchase.invoice_number}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">GST Type</p>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                      selectedPurchase.is_inter_state
                        ? 'bg-sky-400/15 text-sky-400 ring-sky-400/25'
                        : 'bg-violet-400/15 text-violet-400 ring-violet-400/25'
                    }`}>
                      {selectedPurchase.is_inter_state ? 'IGST (Inter-state)' : 'CGST+SGST (Intra-state)'}
                    </span>
                  </div>
                </div>

                {/* Supplier Box */}
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <h4 className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Supplier</h4>
                  <p className="font-medium text-foreground">{selectedPurchase.supplier_name}</p>
                  {selectedPurchase.supplier_gstin && (
                    <p className="font-mono text-[11px] tabular-nums text-muted-foreground mt-0.5">
                      {selectedPurchase.supplier_gstin}
                    </p>
                  )}
                  <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                    {selectedPurchase.supplier_state}
                  </p>
                </div>

                {/* Items Table */}
                <div>
                  <h4 className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Items</h4>
                  <div className="rounded-lg border border-border overflow-hidden">
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
                              <p className="font-mono text-[11px] tabular-nums text-foreground">
                                {item.sku_code || '-'}
                              </p>
                              <p className="font-mono text-[11px] text-muted-foreground">
                                {item.item_name || item.name || item.description || '-'}
                              </p>
                            </TableCell>
                            <TableCell className="font-mono text-[11px] tabular-nums text-muted-foreground">
                              {item.hsn_code || '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-foreground">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-foreground">
                              {formatCurrency(item.rate || item.unit_price || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                              {item.gst_rate}%
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums font-semibold text-foreground">
                              {formatCurrency(item.total || item.taxable_value || item.amount || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Totals summary */}
                <div className="flex justify-end">
                  <div className="w-72 rounded-lg border border-border bg-muted/40 p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                        Taxable Value
                      </span>
                      <span className="font-mono tabular-nums text-foreground">
                        {formatCurrency(selectedPurchase.total_taxable)}
                      </span>
                    </div>
                    {selectedPurchase.is_inter_state ? (
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                          IGST
                        </span>
                        <span className="font-mono tabular-nums text-foreground">
                          {formatCurrency(selectedPurchase.total_igst)}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                            CGST
                          </span>
                          <span className="font-mono tabular-nums text-foreground">
                            {formatCurrency(selectedPurchase.total_cgst)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                            SGST
                          </span>
                          <span className="font-mono tabular-nums text-foreground">
                            {formatCurrency(selectedPurchase.total_sgst)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-border">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-foreground font-semibold">
                        Total
                      </span>
                      <span className="font-mono tabular-nums text-xl font-bold text-primary">
                        {formatCurrency(selectedPurchase.total_amount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Edit Purchase Dialog (Admin Only) ───────────────── */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-popover border border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-400 tracking-tight">
                <Pencil className="w-5 h-5" />
                Edit Purchase (Admin)
              </DialogTitle>
              <DialogDescription className="font-mono text-[11px] text-muted-foreground">
                Correct invoice values. Changes will be tracked.
              </DialogDescription>
            </DialogHeader>

            {selectedPurchase && (
              <div className="space-y-4">
                {/* Purchase Info */}
                <div className="flex justify-between items-start p-3 rounded-lg border border-border bg-muted/40">
                  <div>
                    <p className="font-mono tabular-nums text-primary text-lg font-semibold">
                      {selectedPurchase.purchase_number}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                      {selectedPurchase.party_name}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {selectedPurchase.firm_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Date: {selectedPurchase.invoice_date
                        ? new Date(selectedPurchase.invoice_date).toLocaleDateString('en-IN')
                        : '-'}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                      Original Total: {formatCurrency(selectedPurchase.total_amount)}
                    </p>
                  </div>
                </div>

                {/* Supplier State + Payment Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      Supplier State
                    </Label>
                    <Select
                      value={editForm.party_state}
                      onValueChange={v => setEditForm(prev => ({ ...prev, party_state: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {INDIAN_STATES.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      Payment Status
                    </Label>
                    <Select
                      value={editForm.payment_status}
                      onValueChange={v => setEditForm(prev => ({ ...prev, payment_status: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unpaid">
                          <span className="font-mono text-rose-400">Unpaid</span>
                        </SelectItem>
                        <SelectItem value="partial">
                          <span className="font-mono text-amber-400">Partial</span>
                        </SelectItem>
                        <SelectItem value="paid">
                          <span className="font-mono text-emerald-500">Paid</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Items Edit Table */}
                <div>
                  <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    Purchase Items
                  </Label>
                  <div className="mt-2 rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="w-20">HSN</TableHead>
                          <TableHead className="w-16">Qty</TableHead>
                          <TableHead className="w-24">Rate</TableHead>
                          <TableHead className="w-20">GST %</TableHead>
                          <TableHead className="w-24 text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editForm.items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-foreground">
                              {item.item_name || item.sku_name || item.description}
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.hsn_code || ''}
                                onChange={(e) => updateEditItem(index, 'hsn_code', e.target.value)}
                                className="h-8 w-20 font-mono text-[11px]"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateEditItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                className="h-8 w-16 font-mono tabular-nums"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.rate}
                                onChange={(e) => updateEditItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                className="h-8 w-24 font-mono tabular-nums"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={String(item.gst_rate || 18)}
                                onValueChange={(v) => updateEditItem(index, 'gst_rate', parseFloat(v))}
                              >
                                <SelectTrigger className="h-8 w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {GST_RATES.map(rate => (
                                    <SelectItem key={rate} value={String(rate)}>
                                      <span className="font-mono">{rate}%</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-primary font-medium">
                              {formatCurrency((item.quantity || 1) * (item.rate || 0))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    Notes
                  </Label>
                  <Textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="mt-1"
                    rows={2}
                  />
                </div>

                {/* Calculated Totals Preview */}
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-3">
                    New Totals (Preview)
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Taxable
                      </p>
                      <p className="font-mono tabular-nums text-foreground font-medium">
                        {formatCurrency(editForm.items.reduce((sum, item) => sum + (item.quantity || 1) * (item.rate || 0), 0))}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        GST
                      </p>
                      <p className="font-mono tabular-nums text-foreground font-medium">
                        {formatCurrency(editForm.items.reduce((sum, item) => {
                          const taxable = (item.quantity || 1) * (item.rate || 0);
                          return sum + taxable * ((item.gst_rate || 18) / 100);
                        }, 0))}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Grand Total
                      </p>
                      <p className="font-mono tabular-nums text-primary font-bold text-lg">
                        {formatCurrency(editForm.items.reduce((sum, item) => {
                          const taxable = (item.quantity || 1) * (item.rate || 0);
                          return sum + taxable + taxable * ((item.gst_rate || 18) / 100);
                        }, 0))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                className="border-border text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={submitting}
                className="bg-orange-500/90 hover:bg-orange-500 text-white"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}

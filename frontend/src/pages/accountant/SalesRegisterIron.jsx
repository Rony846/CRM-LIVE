import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  FileText, Plus, Loader2, Eye, Download, Search, IndianRupee,
  Building2, Clock, AlertCircle, CheckCircle, Trash2, RefreshCw, Pencil
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';
import { CustomerName } from '@/components/Customer360';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

const PAYMENT_STATUS_CONFIG = {
  unpaid: { label: 'Unpaid', color: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25', icon: AlertCircle },
  partial: { label: 'Partial', color: 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25', icon: Clock },
  paid: { label: 'Paid', color: 'bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25', icon: CheckCircle }
};

// Payment status -> Iron pill tone.
const PAYMENT_PILL_TONE = { unpaid: 'bad', partial: 'warn', paid: 'ok' };
const paymentPill = (status) => {
  const tone = PAYMENT_PILL_TONE[status] || 'slate';
  const label = { unpaid: 'Unpaid', partial: 'Partial', paid: 'Paid' }[status] || (status || '-');
  return { label, style: badgeStyle(tone) };
};

const GST_RATES = [0, 5, 12, 18, 28];

const fmtINR = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

export default function SalesRegister() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [firms, setFirms] = useState([]);
  const [parties, setParties] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [skus, setSkus] = useState([]);
  const [dispatchesMissingData, setDispatchesMissingData] = useState([]); // Dispatches with missing invoice data

  // Filters
  const [filterFirm, setFilterFirm] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [fixDispatchOpen, setFixDispatchOpen] = useState(false);
  const [dispatchToFix, setDispatchToFix] = useState(null); // For fixing missing data

  // Form state
  const [form, setForm] = useState({
    firm_id: '',
    party_id: '',
    dispatch_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    items: [],
    shipping_charges: 0,
    other_charges: 0,
    discount: 0,
    notes: '',
    gst_override: false,
    override_igst: 0,
    override_cgst: 0,
    override_sgst: 0
  });

  // Edit form state (for admin editing)
  const [editForm, setEditForm] = useState({
    items: [],
    party_state: '',
    notes: '',
    payment_status: ''
  });

  // Selected dispatch details (for invoice creation)
  const [selectedDispatch, setSelectedDispatch] = useState(null);

  useEffect(() => {
    fetchAllData();
    fetchDispatchesWithoutInvoice(null); // Fetch dispatches with missing data on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchAllData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [invoicesRes, firmsRes, partiesRes, skusRes] = await Promise.all([
        axios.get(`${API}/sales-invoices`, { headers }),
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        axios.get(`${API}/parties`, { headers, params: { party_type: 'customer' } }),
        axios.get(`${API}/master-skus`, { headers, params: { is_active: true } })
      ]);

      setInvoices(invoicesRes.data || []);
      setFirms(firmsRes.data || []);
      setParties(partiesRes.data || []);
      setSkus(skusRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDispatchesWithoutInvoice = async (firmId) => {
    try {
      const res = await axios.get(`${API}/dispatches-without-invoice`, {
        headers: { Authorization: `Bearer ${token}` },
        params: firmId ? { firm_id: firmId } : {}
      });
      const allDispatches = res.data || [];
      // Separate dispatches that can generate invoices vs those with missing data
      const canGenerate = allDispatches.filter(d => d.can_generate_invoice);
      const missingData = allDispatches.filter(d => !d.can_generate_invoice);
      setDispatches(canGenerate);
      setDispatchesMissingData(missingData);
    } catch (error) {
      console.error('Failed to fetch dispatches:', error);
    }
  };

  const resetForm = () => {
    setForm({
      firm_id: '', party_id: '', dispatch_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      items: [], shipping_charges: 0, other_charges: 0, discount: 0, notes: '',
      gst_override: false, override_igst: 0, override_cgst: 0, override_sgst: 0
    });
    setSelectedDispatch(null);
    setDispatches([]);
  };

  const handleFirmChange = (firmId) => {
    setForm({ ...form, firm_id: firmId, dispatch_id: '' });
    setSelectedDispatch(null);
    fetchDispatchesWithoutInvoice(firmId);
  };

  const handleDispatchSelect = async (dispatchId) => {
    const dispatch = dispatches.find(d => d.id === dispatchId);
    if (!dispatch) return;

    setSelectedDispatch(dispatch);
    setForm(prev => ({ ...prev, dispatch_id: dispatchId }));

    const headers = { Authorization: `Bearer ${token}` };

    // Try to find party by phone or email
    let partyId = '';
    let existingParty = parties.find(p =>
      p.phone === dispatch.phone ||
      (dispatch.customer_email && p.email === dispatch.customer_email.toLowerCase())
    );

    if (existingParty) {
      partyId = existingParty.id;
    } else if (dispatch.customer_name && dispatch.phone) {
      // Auto-create party from dispatch customer info
      try {
        // Determine party name - for marketplace orders, use marketplace as party
        const isMarketplaceOrder = ['amazon', 'flipkart', 'website'].includes(dispatch.order_source) ||
                                   ['amazon_order', 'flipkart_order', 'website_order'].includes(dispatch.dispatch_type);

        const partyName = isMarketplaceOrder
          ? (dispatch.order_source === 'flipkart' || dispatch.dispatch_type === 'flipkart_order' ? 'Flipkart Marketplace' : 'Amazon Marketplace')
          : dispatch.customer_name;

        // Check if marketplace party already exists
        if (isMarketplaceOrder) {
          existingParty = parties.find(p => p.name === partyName);
          if (existingParty) {
            partyId = existingParty.id;
          }
        }

        // Create new party if still not found
        if (!partyId) {
          const newPartyData = {
            name: partyName,
            party_types: ['customer'],
            phone: isMarketplaceOrder ? null : dispatch.phone,
            email: isMarketplaceOrder ? null : (dispatch.customer_email || null),
            address: dispatch.address || '',
            city: dispatch.city || '',
            state: dispatch.state || 'Delhi', // Default state for GST
            pincode: dispatch.pincode || '',
            gstin: null,
            pan: null,
            credit_limit: 0,
            opening_balance: 0
          };

          const createRes = await axios.post(`${API}/parties`, newPartyData, { headers });
          if (createRes.data?.id) {
            partyId = createRes.data.id;
            // Refresh parties list
            const partiesRes = await axios.get(`${API}/parties`, { headers, params: { party_type: 'customer' } });
            setParties(partiesRes.data || []);
            toast.success(`Auto-created party: ${partyName}`);
          }
        }
      } catch (error) {
        console.error('Failed to auto-create party:', error);
        // Continue without auto-creating party
      }
    }

    // Auto-populate items from dispatch
    let items = [];

    // Helper function to back-calculate taxable value from GST-inclusive amount
    const getBaseRate = (gstInclusiveAmount, gstRate) => {
      const rate = gstRate || 18;
      // Back-calculate: taxable = inclusive / (1 + rate/100)
      return Math.round((gstInclusiveAmount / (1 + rate / 100)) * 100) / 100;
    };

    // First try by master_sku_id
    if (dispatch.master_sku_id) {
      const sku = skus.find(s => s.id === dispatch.master_sku_id);
      if (sku) {
        const gstRate = sku.gst_rate || 18;
        const invoiceValue = dispatch.selling_price || dispatch.invoice_value || sku.cost_price || 0;
        // Dispatch invoice_value is GST-inclusive, so back-calculate the base rate
        const baseRate = getBaseRate(invoiceValue, gstRate);

        items.push({
          master_sku_id: sku.id,
          sku_code: sku.sku_code,
          name: sku.name,
          hsn_code: sku.hsn_code || '',
          quantity: dispatch.quantity || 1,
          rate: baseRate,
          gst_rate: gstRate,
          discount: 0
        });
      }
    }
    // Try to find SKU by sku code
    else if (dispatch.sku) {
      const sku = skus.find(s =>
        s.sku_code?.toLowerCase() === dispatch.sku?.toLowerCase() ||
        s.name?.toLowerCase().includes(dispatch.sku?.toLowerCase())
      );
      if (sku) {
        const gstRate = sku.gst_rate || 18;
        const invoiceValue = dispatch.selling_price || dispatch.invoice_value || sku.cost_price || 0;
        // Dispatch invoice_value is GST-inclusive, so back-calculate the base rate
        const baseRate = getBaseRate(invoiceValue, gstRate);

        items.push({
          master_sku_id: sku.id,
          sku_code: sku.sku_code,
          name: sku.name,
          hsn_code: sku.hsn_code || '',
          quantity: dispatch.quantity || 1,
          rate: baseRate,
          gst_rate: gstRate,
          discount: 0
        });
      } else {
        // Create a manual item entry with dispatch data even without SKU match
        const gstRate = 18;
        const invoiceValue = dispatch.selling_price || dispatch.invoice_value || 0;
        // Dispatch invoice_value is GST-inclusive, so back-calculate the base rate
        const baseRate = getBaseRate(invoiceValue, gstRate);

        items.push({
          master_sku_id: '',
          sku_code: dispatch.sku || '',
          name: dispatch.sku_name || dispatch.sku || dispatch.reason || 'Product',
          hsn_code: '',
          quantity: dispatch.quantity || 1,
          rate: baseRate,
          gst_rate: gstRate,
          discount: 0
        });
      }
    }

    // Update form with party and items
    setForm(prev => ({
      ...prev,
      dispatch_id: dispatchId,
      party_id: partyId,
      items: items.length > 0 ? items : prev.items
    }));
  };

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        master_sku_id: '',
        sku_code: '',
        name: '',
        hsn_code: '',
        quantity: 1,
        rate: 0,
        gst_rate: 18,
        discount: 0
      }]
    }));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index][field] = value;

    // If SKU selected, populate details
    if (field === 'master_sku_id' && value) {
      const sku = skus.find(s => s.id === value);
      if (sku) {
        newItems[index].sku_code = sku.sku_code;
        newItems[index].name = sku.name;
        newItems[index].hsn_code = sku.hsn_code || '';
        newItems[index].gst_rate = sku.gst_rate || 18;
        newItems[index].rate = sku.cost_price || 0;
      }
    }

    setForm(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0;
    let totalGst = 0;

    form.items.forEach(item => {
      const taxable = (item.quantity * item.rate) - item.discount;
      const gst = taxable * (item.gst_rate / 100);
      subtotal += taxable;
      totalGst += gst;
    });

    const taxableValue = subtotal + form.shipping_charges + form.other_charges - form.discount;
    const grandTotal = taxableValue + (form.gst_override
      ? (form.override_igst + form.override_cgst + form.override_sgst)
      : totalGst);

    return { subtotal, taxableValue, totalGst, grandTotal };
  };

  const handleCreate = async () => {
    if (!form.firm_id || !form.party_id || !form.dispatch_id) {
      toast.error('Please select firm, party, and dispatch');
      return;
    }
    if (form.items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/sales-invoices`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Sales invoice created successfully');
      setCreateOpen(false);
      resetForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create invoice');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    if (filterFirm !== 'all' && inv.firm_id !== filterFirm) return false;
    if (filterStatus !== 'all' && inv.payment_status !== filterStatus) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        inv.invoice_number?.toLowerCase().includes(search) ||
        inv.party_name?.toLowerCase().includes(search) ||
        inv.dispatch_number?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: invoices.length,
    totalValue: invoices.reduce((sum, i) => sum + (i.grand_total || i.total_amount || 0), 0),
    unpaid: invoices.filter(i => i.payment_status === 'unpaid').length,
    totalOutstanding: invoices.reduce((sum, i) => sum + (i.balance_due || 0), 0),
    totalGst: invoices.reduce((sum, i) => sum + (i.total_gst || i.gst_amount || 0), 0)
  };

  const totals = calculateTotals();

  // Export to CSV
  const handleExportCSV = async () => {
    try {
      let url = `${API}/sales-invoices/export/csv`;
      const params = new URLSearchParams();
      if (filterFirm !== 'all') params.append('firm_id', filterFirm);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `sales_register_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      toast.success('Export successful');
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  // Backfill sales invoices from dispatches
  const handleBackfillInvoices = async () => {
    try {
      toast.info('Generating invoices from dispatches...');
      const response = await axios.post(`${API}/sales-invoices/backfill`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data;

      if (data.missing_data_count > 0) {
        toast.warning(
          `Created ${data.created} invoices. ${data.missing_data_count} dispatches have missing data - see below to fix.`,
          { duration: 8000 }
        );
        console.log('Dispatches with missing data:', data.missing_data);

        // Populate the missing data state to show the orange alert card with Fix buttons
        // Transform the response data to match the expected format
        const formattedMissingData = data.missing_data.map(d => ({
          id: d.dispatch_id,
          dispatch_number: d.dispatch_number || d.dispatch_id,
          customer_name: d.customer_name || '',
          sku: d.sku || '',
          sku_name: d.sku_name || d.sku || '',
          missing_fields: d.missing_fields || [],
          can_generate_invoice: false,
          state: d.state || '',
          firm_id: d.firm_id || ''
        }));
        setDispatchesMissingData(formattedMissingData);
      } else {
        toast.success(`Created ${data.created} invoices, ${data.skipped} already had invoices`);
        setDispatchesMissingData([]); // Clear any previous missing data
      }

      // Refresh invoices data
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate invoices');
    }
  };

  // Update dispatch with missing data and create invoice
  const handleUpdateDispatch = async (dispatchId, updates) => {
    try {
      // Step 1: Update the dispatch with fixed data
      await axios.patch(`${API}/admin/dispatches/${dispatchId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Step 2: Try to create invoice for this specific dispatch
      try {
        const invoiceResponse = await axios.post(`${API}/sales-invoices/from-dispatch/${dispatchId}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (invoiceResponse.data?.invoice) {
          const inv = invoiceResponse.data.invoice;
          toast.success(
            `Dispatch fixed & invoice ${inv.invoice_number} created! (₹${inv.grand_total?.toLocaleString() || 0})`,
            { duration: 5000 }
          );
        } else {
          toast.success('Dispatch updated. Click "Generate from Dispatches" to create invoice.');
        }
      } catch (invoiceError) {
        // Invoice creation failed but dispatch was updated
        const errMsg = invoiceError.response?.data?.detail || '';
        if (errMsg.includes('already has invoice')) {
          toast.info('Dispatch already has an invoice');
        } else {
          toast.warning(`Dispatch updated but invoice not created: ${errMsg || 'Try generating manually'}`);
        }
      }

      setFixDispatchOpen(false);
      setDispatchToFix(null);

      // Refresh all data
      fetchAllData();
      fetchDispatchesWithoutInvoice(filterFirm !== 'all' ? filterFirm : null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update dispatch');
    }
  };

  // Open edit dialog (admin only)
  const handleOpenEdit = (invoice) => {
    setSelectedInvoice(invoice);
    setEditForm({
      items: invoice.items?.map(item => ({
        ...item,
        master_sku_id: item.master_sku_id || '',
        hsn_code: item.hsn_code || '',
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        gst_rate: item.gst_rate || 18,
        discount: item.discount || 0
      })) || [],
      party_state: invoice.party_state || '',
      notes: invoice.notes || '',
      payment_status: invoice.payment_status || 'unpaid'
    });
    setEditOpen(true);
  };

  // Update edit form item
  const updateEditItem = (index, field, value) => {
    setEditForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }));
  };

  // Save edited invoice (admin only)
  const handleSaveEdit = async () => {
    setActionLoading(true);
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

      await axios.put(`${API}/sales-invoices/${selectedInvoice.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Invoice updated successfully');
      setEditOpen(false);
      setSelectedInvoice(null);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update invoice');
    } finally {
      setActionLoading(false);
    }
  };

  // Recalculate invoice with zero values from dispatch data (admin only)
  const handleRecalculateInvoice = async (invoiceId) => {
    if (!confirm('This will recalculate the invoice values from the dispatch data. Continue?')) return;

    setActionLoading(true);
    try {
      const response = await axios.post(`${API}/sales-invoices/${invoiceId}/recalculate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message || 'Invoice recalculated!');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to recalculate invoice');
    } finally {
      setActionLoading(false);
    }
  };

  // Indian states for dropdown
  const indianStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh",
    "Andaman and Nicobar Islands", "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep"
  ];

  const statCards = [
    { label: 'Total Invoices', value: stats.total.toLocaleString('en-IN'), icon: FileText, tone: T.blue },
    { label: 'Total Sales', value: fmtINR(stats.totalValue), icon: IndianRupee, tone: T.green },
    { label: 'Unpaid', value: stats.unpaid.toLocaleString('en-IN'), icon: AlertCircle, tone: T.orange },
    { label: 'Outstanding', value: fmtINR(stats.totalOutstanding), icon: Clock, tone: T.voltageText },
    { label: 'Total GST', value: fmtINR(stats.totalGst), icon: Building2, tone: '#6D4AB0' },
  ];

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={handleBackfillInvoices} data-testid="backfill-invoices-btn"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.voltageText}`, background: T.white, color: T.voltageText, borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5 }}>
        <RefreshCw size={14} /> Generate from Dispatches
      </button>
      <button onClick={handleExportCSV} data-testid="export-csv-btn"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5 }}>
        <Download size={14} /> Export CSV
      </button>
      <button onClick={() => { resetForm(); setCreateOpen(true); }} data-testid="create-invoice-btn"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5 }}>
        <Plus size={14} /> New Invoice
      </button>
    </div>
  );

  const invHeaders = ['Invoice #', 'Date', 'Firm', 'Party', 'Dispatch', 'Taxable', 'GST', 'Total', 'Status', 'Balance', 'Actions'];
  const rightCols = new Set([5, 6, 7, 9]);

  const rowActionStyle = { display: 'inline-flex', alignItems: 'center', border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '5px 8px', cursor: 'pointer' };

  return (
    <IronShell
      title="Sales Register"
      subtitle={`${stats.total.toLocaleString('en-IN')} INVOICES · GST OUTWARD SUPPLY`}
      onRefresh={fetchAllData}
      headerRight={headerRight}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.iron900, lineHeight: 1, whiteSpace: 'nowrap' }}>{s.value}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Filters */}
          <IronCard pad={12} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search invoices…"
                  style={{ ...inputStyle, paddingLeft: 30, width: 260 }} />
              </div>
              <select value={filterFirm} onChange={(e) => setFilterFirm(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', minWidth: 190 }}>
                <option value="all">All Firms</option>
                {firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', minWidth: 150 }}>
                <option value="all">All Status</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </IronCard>

          {/* Dispatches with Missing Data - Alert Section */}
          {dispatchesMissingData.length > 0 && (
            <IronCard pad={0} style={{ marginBottom: 16, border: `1px solid ${T.voltageText}`, background: T.voltageTint }}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={15} color={T.voltageText} />
                <Caps size={11} color={T.voltageText}>Dispatches Missing Invoice Data ({dispatchesMissingData.length})</Caps>
              </div>
              <div style={{ padding: 14 }}>
                <p style={{ fontSize: 12.5, color: T.iron700, marginBottom: 12 }}>
                  These dispatches cannot generate invoices until the missing information is filled. Click "Fix" to update.
                </p>
                <div style={{ overflowX: 'auto', background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {['Dispatch #', 'Customer', 'SKU', 'Missing Fields', 'Actions'].map((h, i) => (
                        <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {dispatchesMissingData.slice(0, 10).map(d => (
                        <tr key={d.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                          <td style={{ ...tdCell, ...mono, color: T.iron900 }}>{d.dispatch_number || d.id?.slice(0, 8)}</td>
                          <td style={tdCell}><CustomerName name={d.customer_name} phone={d.phone || d.customer_phone} /></td>
                          <td style={tdCell}>{d.sku_name || d.sku || '-'}</td>
                          <td style={tdCell}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {d.missing_fields?.map(field => (
                                <span key={field} style={badgeStyle('bad')}>{field}</span>
                              ))}
                            </div>
                          </td>
                          <td style={tdCell}>
                            <button onClick={() => { setDispatchToFix(d); setFixDispatchOpen(true); }}
                              style={{ border: 'none', background: T.voltageText, color: '#fff', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}>
                              Fix
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dispatchesMissingData.length > 10 && (
                    <p style={{ ...mono, fontSize: 11.5, color: T.iron500, margin: 0, padding: '8px 0', textAlign: 'center' }}>
                      ...and {dispatchesMissingData.length - 10} more dispatches with missing data
                    </p>
                  )}
                </div>
              </div>
            </IronCard>
          )}

          {/* Invoices Table */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={15} color={T.iron500} />
              <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>Sales Invoices</span>
              <span style={{ ...mono, fontSize: 11.5, color: T.iron400 }}>({filteredInvoices.length})</span>
            </div>
            {filteredInvoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                <FileText size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No invoices found</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {invHeaders.map((h, i) => (
                      <th key={i} style={{ ...thCell, textAlign: rightCols.has(i) ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filteredInvoices.map((inv) => {
                      const pp = paymentPill(inv.payment_status);
                      return (
                        <tr key={inv.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                          <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{inv.invoice_number}</td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron500 }}>{new Date(inv.invoice_date).toLocaleDateString('en-IN')}</td>
                          <td style={{ ...tdCell, color: T.iron900 }}>{inv.firm_name}</td>
                          <td style={{ ...tdCell, color: T.iron900 }}><CustomerName name={inv.party_name} phone={inv.party_phone || inv.customer_phone} /></td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron500 }}>{inv.dispatch_number}</td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900 }}>{fmtINR(inv.taxable_value || inv.subtotal || 0)}</td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', color: '#6D4AB0' }}>{fmtINR(inv.total_gst || inv.gst_amount || 0)}</td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.green }}>{fmtINR(inv.grand_total || inv.total_amount || 0)}</td>
                          <td style={tdCell}><span style={pp.style}>{pp.label}</span></td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 600, color: inv.balance_due > 0 ? T.rose : T.green }}>{fmtINR(inv.balance_due)}</td>
                          <td style={tdCell}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button onClick={() => { setSelectedInvoice(inv); setViewOpen(true); }} title="View" style={rowActionStyle}><Eye size={13} /></button>
                              {isAdmin && (
                                <button onClick={() => handleOpenEdit(inv)} title="Edit Invoice (Admin)" style={{ ...rowActionStyle, color: T.voltageText, borderColor: T.voltageText }}><Pencil size={13} /></button>
                              )}
                              {isAdmin && inv.grand_total === 0 && inv.dispatch_id && (
                                <button onClick={() => handleRecalculateInvoice(inv.id)} title="Recalculate from Dispatch" style={{ ...rowActionStyle, color: T.blue, borderColor: T.blue }}><RefreshCw size={13} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </IronCard>
        </>
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-popover border border-border max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Sales Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Header Fields */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Firm *</Label>
                <Select value={form.firm_id} onValueChange={handleFirmChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dispatch *</Label>
                <Select
                  value={form.dispatch_id}
                  onValueChange={handleDispatchSelect}
                  disabled={!form.firm_id}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={form.firm_id ? "Select dispatch" : "Select firm first"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {dispatches.length === 0 ? (
                      <div className="p-2 text-muted-foreground text-sm">No dispatches without invoice</div>
                    ) : dispatches.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.dispatch_number} - {d.customer_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Party/Customer *</Label>
                <Select value={form.party_id} onValueChange={(v) => setForm({...form, party_id: v})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select party" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {parties.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.gstin ? `(${p.gstin})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Invoice Date *</Label>
                <Input
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => setForm({...form, invoice_date: e.target.value})}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Dispatch Info */}
            {selectedDispatch && (
              <div className="p-3 bg-primary/[0.08] border border-primary/25 rounded-lg">
                <p className="text-primary text-sm font-mono">
                  <strong>Dispatch:</strong> {selectedDispatch.dispatch_number} |{' '}
                  <strong>Customer:</strong> <CustomerName name={selectedDispatch.customer_name} phone={selectedDispatch.phone} /> |{' '}
                  <strong>Phone:</strong> {selectedDispatch.phone}
                </p>
              </div>
            )}

            {/* Items */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Line Items</span>
                <Button size="sm" onClick={addItem} variant="outline" className="border-border font-mono text-[11px]">
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              </div>

              {form.items.length === 0 ? (
                <p className="text-muted-foreground text-center py-4 font-mono text-sm">No items added</p>
              ) : (
                <div className="space-y-3">
                  {form.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end bg-muted/40 p-3 rounded-lg border border-border">
                      <div className="col-span-3">
                        <Label className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">SKU</Label>
                        <Select
                          value={item.master_sku_id}
                          onValueChange={(v) => updateItem(index, 'master_sku_id', v)}
                        >
                          <SelectTrigger className="mt-1 text-sm">
                            <SelectValue placeholder="Select SKU" />
                          </SelectTrigger>
                          <SelectContent className="max-h-40">
                            {skus.map(s => (
                              <SelectItem key={s.id} value={s.id} className="text-sm">
                                {s.sku_code} - {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">HSN</Label>
                        <Input
                          value={item.hsn_code}
                          onChange={(e) => updateItem(index, 'hsn_code', e.target.value)}
                          className="mt-1 text-sm font-mono"
                        />
                      </div>
                      <div className="col-span-1">
                        <Label className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">Qty</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="mt-1 text-sm font-mono"
                          min="1"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">Rate</Label>
                        <Input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                          className="mt-1 text-sm font-mono"
                        />
                      </div>
                      <div className="col-span-1">
                        <Label className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">GST %</Label>
                        <Select
                          value={item.gst_rate.toString()}
                          onValueChange={(v) => updateItem(index, 'gst_rate', parseFloat(v))}
                        >
                          <SelectTrigger className="mt-1 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GST_RATES.map(r => (
                              <SelectItem key={r} value={r.toString()}>{r}%</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">Total</Label>
                        <div className="bg-muted/60 border border-border text-emerald-500 font-mono p-2 rounded text-sm mt-1 tabular-nums">
                          ₹{((item.quantity * item.rate) - item.discount).toLocaleString()}
                        </div>
                      </div>
                      <div className="col-span-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeItem(index)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Other Charges */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Shipping</Label>
                <Input
                  type="number"
                  value={form.shipping_charges}
                  onChange={(e) => setForm({...form, shipping_charges: parseFloat(e.target.value) || 0})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Other Charges</Label>
                <Input
                  type="number"
                  value={form.other_charges}
                  onChange={(e) => setForm({...form, other_charges: parseFloat(e.target.value) || 0})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Discount</Label>
                <Input
                  type="number"
                  value={form.discount}
                  onChange={(e) => setForm({...form, discount: parseFloat(e.target.value) || 0})}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={form.gst_override}
                  onCheckedChange={(v) => setForm({...form, gst_override: v})}
                />
                <Label>Override GST</Label>
              </div>
            </div>

            {/* GST Override */}
            {form.gst_override && (
              <div className="grid grid-cols-3 gap-4 p-3 bg-amber-400/[0.07] border border-amber-400/25 rounded-lg">
                <div>
                  <Label className="text-amber-400">IGST Override</Label>
                  <Input
                    type="number"
                    value={form.override_igst}
                    onChange={(e) => setForm({...form, override_igst: parseFloat(e.target.value) || 0})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-amber-400">CGST Override</Label>
                  <Input
                    type="number"
                    value={form.override_cgst}
                    onChange={(e) => setForm({...form, override_cgst: parseFloat(e.target.value) || 0})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-amber-400">SGST Override</Label>
                  <Input
                    type="number"
                    value={form.override_sgst}
                    onChange={(e) => setForm({...form, override_sgst: parseFloat(e.target.value) || 0})}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-muted/40 border border-border rounded-lg">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                <p className="text-foreground font-mono tabular-nums text-xl font-semibold">₹{totals.subtotal.toLocaleString()}</p>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Taxable Value</p>
                <p className="text-foreground font-mono tabular-nums text-xl font-semibold">₹{totals.taxableValue.toLocaleString()}</p>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">GST</p>
                <p className="text-indigo-400 font-mono tabular-nums text-xl font-semibold">₹{(form.gst_override
                  ? (form.override_igst + form.override_cgst + form.override_sgst)
                  : totals.totalGst).toLocaleString()}</p>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Grand Total</p>
                <p className="text-emerald-500 font-mono tabular-nums text-2xl font-bold">₹{totals.grandTotal.toLocaleString()}</p>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setCreateOpen(false)} className="text-muted-foreground">Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={actionLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="bg-popover border border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Invoice Details</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Invoice Number</p>
                  <p className="text-primary font-mono text-lg tabular-nums">{selectedInvoice.invoice_number}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Date</p>
                  <p className="text-foreground font-mono tabular-nums">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Firm</p>
                  <p className="text-foreground">{selectedInvoice.firm_name}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Party</p>
                  <p className="text-foreground"><CustomerName name={selectedInvoice.party_name} phone={selectedInvoice.party_phone || selectedInvoice.customer_phone} /></p>
                  {selectedInvoice.party_gstin && (
                    <p className="text-muted-foreground text-sm font-mono tabular-nums">{selectedInvoice.party_gstin}</p>
                  )}
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-muted/40">
                      <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Item</TableHead>
                      <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">HSN</TableHead>
                      <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide text-right">Qty</TableHead>
                      <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide text-right">Rate</TableHead>
                      <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide text-right">GST%</TableHead>
                      <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.items?.map((item, i) => (
                      <TableRow key={i} className="border-border hover:bg-muted/30">
                        <TableCell className="text-foreground">{item.name || item.description || item.master_sku_name || '-'}</TableCell>
                        <TableCell className="text-muted-foreground font-mono tabular-nums">{item.hsn_code || '-'}</TableCell>
                        <TableCell className="text-foreground font-mono tabular-nums text-right">{item.quantity}</TableCell>
                        <TableCell className="text-foreground font-mono tabular-nums text-right">₹{(item.rate || item.unit_price || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-foreground font-mono text-right">{item.gst_rate}%</TableCell>
                        <TableCell className="text-emerald-500 font-mono tabular-nums text-right">₹{(item.taxable_value || item.amount || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/40 border border-border rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-mono text-sm">Subtotal:</span>
                    <span className="text-foreground font-mono tabular-nums text-sm">₹{(selectedInvoice.subtotal || selectedInvoice.taxable_value || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-mono text-sm">Shipping:</span>
                    <span className="text-foreground font-mono tabular-nums text-sm">₹{(selectedInvoice.shipping_charges || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-mono text-sm">Discount:</span>
                    <span className="text-rose-400 font-mono tabular-nums text-sm">-₹{(selectedInvoice.discount || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-mono text-sm">Taxable:</span>
                    <span className="text-foreground font-mono tabular-nums text-sm">₹{(selectedInvoice.taxable_value || selectedInvoice.subtotal || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-mono text-sm">{selectedInvoice.is_igst ? 'IGST' : 'CGST+SGST'}:</span>
                    <span className="text-indigo-400 font-mono tabular-nums text-sm">₹{(selectedInvoice.total_gst || selectedInvoice.gst_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-border pt-2">
                    <span className="text-foreground font-mono text-base">Grand Total:</span>
                    <span className="text-emerald-500 font-mono tabular-nums text-base">₹{(selectedInvoice.grand_total || selectedInvoice.total_amount || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-muted/40 border border-border rounded-lg">
                <div>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ${PAYMENT_STATUS_CONFIG[selectedInvoice.payment_status]?.color}`}>
                    {PAYMENT_STATUS_CONFIG[selectedInvoice.payment_status]?.label}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground font-mono tabular-nums text-sm">Amount Paid: ₹{selectedInvoice.amount_paid?.toLocaleString()}</p>
                  <p className={`font-mono tabular-nums font-bold ${selectedInvoice.balance_due > 0 ? 'text-rose-400' : 'text-emerald-500'}`}>
                    Balance: ₹{selectedInvoice.balance_due?.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setViewOpen(false)} className="text-muted-foreground">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog (Admin Only) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-popover border border-border max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <FileText className="w-5 h-5" />
              Edit Sales Invoice (Admin)
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Correct invoice values. Changes will be tracked.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              {/* Invoice Info */}
              <div className="flex justify-between items-start p-3 bg-muted/40 border border-border rounded-lg">
                <div>
                  <p className="text-primary font-mono tabular-nums text-lg">{selectedInvoice.invoice_number}</p>
                  <p className="text-sm text-muted-foreground"><CustomerName name={selectedInvoice.party_name} phone={selectedInvoice.party_phone || selectedInvoice.customer_phone} /></p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.firm_name}</p>
                </div>
                <div className="text-right text-sm font-mono tabular-nums">
                  <p className="text-muted-foreground">Date: {new Date(selectedInvoice.invoice_date).toLocaleDateString('en-IN')}</p>
                  <p className="text-muted-foreground">Original Total: <span className="text-foreground">₹{selectedInvoice.grand_total?.toLocaleString()}</span></p>
                </div>
              </div>

              {/* Party State */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Party State</Label>
                  <Select
                    value={editForm.party_state}
                    onValueChange={v => setEditForm(prev => ({ ...prev, party_state: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {indianStates.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Status</Label>
                  <Select
                    value={editForm.payment_status}
                    onValueChange={v => setEditForm(prev => ({ ...prev, payment_status: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items */}
              <div>
                <Label>Invoice Items</Label>
                <div className="mt-2 border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 border-border">
                        <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Item</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide w-20">HSN</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide w-16">Qty</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide w-24">Rate</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide w-20">GST %</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide w-24">Discount</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide w-24">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editForm.items.map((item, index) => (
                        <TableRow key={index} className="border-border hover:bg-muted/20">
                          <TableCell className="text-foreground">{item.sku_name || item.master_sku_name}</TableCell>
                          <TableCell>
                            <Input
                              value={item.hsn_code || ''}
                              onChange={(e) => updateEditItem(index, 'hsn_code', e.target.value)}
                              className="h-8 w-20 font-mono"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateEditItem(index, 'quantity', parseInt(e.target.value) || 1)}
                              className="h-8 w-16 font-mono"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.rate}
                              onChange={(e) => updateEditItem(index, 'rate', parseFloat(e.target.value) || 0)}
                              className="h-8 w-24 font-mono"
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
                                  <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.discount || 0}
                              onChange={(e) => updateEditItem(index, 'discount', parseFloat(e.target.value) || 0)}
                              className="h-8 w-24 font-mono"
                            />
                          </TableCell>
                          <TableCell className="text-emerald-500 font-mono tabular-nums">
                            ₹{((item.quantity || 1) * (item.rate || 0)).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="mt-1"
                  rows={2}
                />
              </div>

              {/* Calculated Totals Preview */}
              <div className="p-3 bg-muted/40 border border-border rounded-lg">
                <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-3">New Totals (Preview)</p>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                    <p className="text-foreground font-mono tabular-nums font-semibold">
                      ₹{editForm.items.reduce((sum, item) => sum + (item.quantity || 1) * (item.rate || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Discount</p>
                    <p className="text-rose-400 font-mono tabular-nums font-semibold">
                      ₹{editForm.items.reduce((sum, item) => sum + (item.discount || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">GST</p>
                    <p className="text-indigo-400 font-mono tabular-nums font-semibold">
                      ₹{editForm.items.reduce((sum, item) => {
                        const taxable = (item.quantity || 1) * (item.rate || 0) - (item.discount || 0);
                        return sum + taxable * ((item.gst_rate || 18) / 100);
                      }, 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Grand Total</p>
                    <p className="text-emerald-500 font-mono tabular-nums font-bold text-lg">
                      ₹{editForm.items.reduce((sum, item) => {
                        const taxable = (item.quantity || 1) * (item.rate || 0) - (item.discount || 0);
                        return sum + taxable + taxable * ((item.gst_rate || 18) / 100);
                      }, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="text-muted-foreground">Cancel</Button>
            <Button
              onClick={handleSaveEdit}
              disabled={actionLoading}
              className="bg-amber-400/80 hover:bg-amber-400 text-black font-mono text-[11px] uppercase tracking-wide"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fix Dispatch Missing Data Dialog */}
      <Dialog open={fixDispatchOpen} onOpenChange={setFixDispatchOpen}>
        <DialogContent className="bg-popover border border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-5 h-5" />
              Fix Missing Invoice Data
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update the missing information to enable invoice generation for this dispatch.
            </DialogDescription>
          </DialogHeader>

          {dispatchToFix && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/40 border border-border rounded-lg">
                <p className="text-sm text-muted-foreground">Dispatch: <span className="text-foreground font-mono tabular-nums">{dispatchToFix.dispatch_number}</span></p>
                <p className="text-sm text-muted-foreground">Customer: <span className="text-foreground">{dispatchToFix.customer_name || 'Unknown'}</span></p>
                <p className="text-sm text-muted-foreground">Current SKU: <span className="text-primary font-mono">{dispatchToFix.sku_name || dispatchToFix.sku || 'Unknown'}</span></p>
              </div>

              <div className="p-3 bg-rose-500/[0.08] border border-rose-500/25 rounded-lg">
                <p className="font-mono text-[11px] uppercase tracking-wide text-rose-400 mb-2">Missing Fields</p>
                <div className="flex flex-wrap gap-1">
                  {dispatchToFix.missing_fields?.map(field => (
                    <span key={field} className="rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25">{field}</span>
                  ))}
                </div>
              </div>

              {/* State field */}
              {dispatchToFix.missing_fields?.includes('state') && (
                <div className="space-y-2">
                  <Label>Customer State *</Label>
                  <Select
                    value={dispatchToFix.state || ''}
                    onValueChange={v => setDispatchToFix(prev => ({ ...prev, state: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {indianStates.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Customer Name field */}
              {dispatchToFix.missing_fields?.includes('customer_name') && (
                <div className="space-y-2">
                  <Label>Customer Name *</Label>
                  <Input
                    value={dispatchToFix.customer_name || ''}
                    onChange={e => setDispatchToFix(prev => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="Enter customer name"
                  />
                </div>
              )}

              {/* Invalid SKU or SKU without price */}
              {(dispatchToFix.missing_fields?.includes('valid_sku') || dispatchToFix.missing_fields?.includes('sku_price')) && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-400/[0.07] border border-amber-400/25 rounded-lg">
                    <p className="text-sm text-amber-400 mb-2">
                      <strong>Note:</strong> If this dispatch already has an invoice value from the original order,
                      you can set it directly below. Otherwise, select a valid SKU.
                    </p>
                  </div>

                  {/* Option 1: Set invoice value directly */}
                  <div className="space-y-2">
                    <Label className="text-primary">Option 1: Set Invoice Value Directly (₹)</Label>
                    <Input
                      type="number"
                      value={dispatchToFix.invoice_value || ''}
                      onChange={e => setDispatchToFix(prev => ({
                        ...prev,
                        invoice_value: parseFloat(e.target.value) || 0,
                        master_sku_id: prev.master_sku_id
                      }))}
                      placeholder="Enter total invoice value (including GST)"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground font-mono">Enter the GST-inclusive total from the original invoice/order</p>
                  </div>

                  {/* Option 2: Select SKU */}
                  <div className="space-y-2">
                    <Label className="text-amber-400">
                      Option 2: {dispatchToFix.missing_fields?.includes('valid_sku')
                        ? 'Select Valid SKU (SKU not found)'
                        : 'Select SKU with Price'}
                    </Label>
                    <Select
                      value={dispatchToFix.master_sku_id || ''}
                      onValueChange={v => {
                        const selectedSku = skus.find(s => s.id === v);
                        setDispatchToFix(prev => ({
                          ...prev,
                          master_sku_id: v,
                          selected_sku_name: selectedSku?.name,
                          selling_price: selectedSku?.selling_price || selectedSku?.mrp || selectedSku?.cost_price || prev.selling_price
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a valid SKU from master list" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {skus.filter(s => s.selling_price > 0 || s.mrp > 0 || s.cost_price > 0).map(sku => (
                          <SelectItem key={sku.id} value={sku.id}>
                            {sku.sku_code} - {sku.name} (₹{(sku.selling_price || sku.mrp || sku.cost_price)?.toLocaleString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Selling price override if SKU selected */}
              {dispatchToFix.master_sku_id && (
                <div className="space-y-2">
                  <Label>Selling Price (optional override)</Label>
                  <Input
                    type="number"
                    value={dispatchToFix.selling_price || ''}
                    onChange={e => setDispatchToFix(prev => ({ ...prev, selling_price: parseFloat(e.target.value) || 0 }))}
                    placeholder="Leave empty to use SKU default price"
                    className="font-mono"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setFixDispatchOpen(false); setDispatchToFix(null); }} className="border-border text-muted-foreground">
              Cancel
            </Button>
            <Button
              onClick={() => {
                const updates = {};
                if (dispatchToFix?.state) updates.state = dispatchToFix.state;
                if (dispatchToFix?.customer_name) updates.customer_name = dispatchToFix.customer_name;
                if (dispatchToFix?.master_sku_id) updates.master_sku_id = dispatchToFix.master_sku_id;
                if (dispatchToFix?.selling_price) updates.selling_price = dispatchToFix.selling_price;
                if (dispatchToFix?.invoice_value) updates.invoice_value = dispatchToFix.invoice_value;

                const hasMissingFields = dispatchToFix?.missing_fields || [];
                const canSave = (
                  (!hasMissingFields.includes('state') || dispatchToFix?.state) &&
                  (!hasMissingFields.includes('customer_name') || dispatchToFix?.customer_name) &&
                  (!(hasMissingFields.includes('valid_sku') || hasMissingFields.includes('sku_price')) || dispatchToFix?.master_sku_id)
                );

                if (canSave && Object.keys(updates).length > 0) {
                  handleUpdateDispatch(dispatchToFix.id, updates);
                } else {
                  toast.error('Please fill in all required missing fields');
                }
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-[11px] uppercase tracking-wide"
            >
              Save & Retry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

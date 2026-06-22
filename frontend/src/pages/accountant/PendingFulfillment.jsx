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
  Plus, History, Loader2, Search, ArrowRight, PackageCheck, AlertCircle, Phone, Trash2, Pencil, FileUp, IndianRupee, Truck
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
  const [bigshipLoadingId, setBigshipLoadingId] = useState(null);
  const [activeTab, setActiveTab] = useState('awaiting');
  const [searchTerm, setSearchTerm] = useState('');

  const [createForm, setCreateForm] = useState({
    order_id: '', tracking_id: '', firm_id: '', notes: '', customer_name: '', customer_phone: '',
    invoice_value: '',  // GST inclusive value
    items: [{ master_sku_id: '', quantity: 1 }]  // Array of items
  });
  const [regenerateForm, setRegenerateForm] = useState({ new_tracking_id: '', expiry_days: 5 });

  // E-way bill dialog state
  const [ewayBillOpen, setEwayBillOpen] = useState(false);
  const [ewayBillForm, setEwayBillForm] = useState({ number: '', file: null });
  const [uploadingEwayBill, setUploadingEwayBill] = useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [editForm, setEditForm] = useState({
    customer_name: '',
    customer_phone: '',
    tracking_id: '',
    notes: '',
    invoice_value: '',
    items: [{ master_sku_id: '', quantity: 1 }]
  });

  // Validation states
  const [orderIdError, setOrderIdError] = useState('');
  const [trackingIdError, setTrackingIdError] = useState('');
  const [phoneHistory, setPhoneHistory] = useState([]);
  const [checkingOrderId, setCheckingOrderId] = useState(false);
  const [checkingTrackingId, setCheckingTrackingId] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);

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

  // Check if Order ID already exists
  const checkOrderIdUnique = async (orderId) => {
    if (!orderId || orderId.length < 3) {
      setOrderIdError('');
      return;
    }
    setCheckingOrderId(true);
    try {
      const res = await axios.get(`${API}/pending-fulfillment/check-unique`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { order_id: orderId }
      });
      if (res.data.exists) {
        const source = res.data.source ? ` in ${res.data.source}` : '';
        setOrderIdError(`Order ID already exists${source} (${res.data.status})`);
      } else {
        setOrderIdError('');
      }
    } catch (error) {
      console.error('Check order ID failed:', error);
    } finally {
      setCheckingOrderId(false);
    }
  };

  // Check if Tracking ID already exists
  const checkTrackingIdUnique = async (trackingId) => {
    if (!trackingId || trackingId.length < 3) {
      setTrackingIdError('');
      return;
    }
    setCheckingTrackingId(true);
    try {
      const res = await axios.get(`${API}/pending-fulfillment/check-unique`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { tracking_id: trackingId }
      });
      if (res.data.exists) {
        const source = res.data.source ? ` in ${res.data.source}` : '';
        setTrackingIdError(`Tracking ID already exists${source} (${res.data.status})`);
      } else {
        setTrackingIdError('');
      }
    } catch (error) {
      console.error('Check tracking ID failed:', error);
    } finally {
      setCheckingTrackingId(false);
    }
  };

  // Lookup previous orders by phone number
  const lookupPhoneHistory = async (phone) => {
    if (!phone || phone.length < 10) {
      setPhoneHistory([]);
      return;
    }
    setCheckingPhone(true);
    try {
      const res = await axios.get(`${API}/pending-fulfillment/phone-history`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { phone }
      });
      setPhoneHistory(res.data || []);
    } catch (error) {
      console.error('Phone lookup failed:', error);
      setPhoneHistory([]);
    } finally {
      setCheckingPhone(false);
    }
  };

  // Debounced input handlers
  const handleOrderIdChange = (value) => {
    setCreateForm({...createForm, order_id: value});
    // Debounce the check
    clearTimeout(window.orderIdTimeout);
    window.orderIdTimeout = setTimeout(() => checkOrderIdUnique(value), 500);
  };

  const handleTrackingIdChange = (value) => {
    setCreateForm({...createForm, tracking_id: value});
    clearTimeout(window.trackingIdTimeout);
    window.trackingIdTimeout = setTimeout(() => checkTrackingIdUnique(value), 500);
  };

  const handlePhoneChange = (value) => {
    setCreateForm({...createForm, customer_phone: value});
    clearTimeout(window.phoneTimeout);
    window.phoneTimeout = setTimeout(() => lookupPhoneHistory(value), 500);
  };

  const handleCreate = async () => {
    // Validate required fields
    if (!createForm.order_id || !createForm.tracking_id || !createForm.firm_id) {
      toast.error('Please fill in Order ID, Tracking ID, and select a Firm');
      return;
    }

    // Validate items
    const validItems = createForm.items.filter(item => item.master_sku_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    // Check for validation errors
    if (orderIdError) {
      toast.error('Order ID already exists in the system');
      return;
    }
    if (trackingIdError) {
      toast.error('Tracking ID already exists in the system');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        ...createForm,
        items: validItems,
        invoice_value: createForm.invoice_value ? parseFloat(createForm.invoice_value) : null
      };
      await axios.post(`${API}/pending-fulfillment`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Pending fulfillment created');
      setCreateOpen(false);
      setCreateForm({ order_id: '', tracking_id: '', firm_id: '', notes: '', customer_name: '', customer_phone: '', invoice_value: '', items: [{ master_sku_id: '', quantity: 1 }] });
      setOrderIdError('');
      setTrackingIdError('');
      setPhoneHistory([]);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create entry');
    } finally {
      setActionLoading(false);
    }
  };

  // E-way bill upload
  const openEwayBillDialog = (entry) => {
    setSelectedEntry(entry);
    setEwayBillForm({ number: '', file: null });
    setEwayBillOpen(true);
  };

  const handleUploadEwayBill = async () => {
    if (!ewayBillForm.number || !ewayBillForm.file) {
      toast.error('Please enter e-way bill number and select a file');
      return;
    }

    setUploadingEwayBill(true);
    try {
      const formData = new FormData();
      formData.append('eway_bill_number', ewayBillForm.number);
      formData.append('eway_bill_file', ewayBillForm.file);

      await axios.put(`${API}/pending-fulfillment/${selectedEntry.id}/upload-eway-bill`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('E-way bill uploaded successfully');
      setEwayBillOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload e-way bill');
    } finally {
      setUploadingEwayBill(false);
    }
  };

  // Add a new item to the create form
  const addItem = () => {
    setCreateForm({
      ...createForm,
      items: [...createForm.items, { master_sku_id: '', quantity: 1 }]
    });
  };

  // Remove an item from the create form
  const removeItem = (index) => {
    if (createForm.items.length === 1) {
      toast.error('At least one product is required');
      return;
    }
    const newItems = createForm.items.filter((_, i) => i !== index);
    setCreateForm({ ...createForm, items: newItems });
  };

  // Update item at specific index
  const updateItem = (index, field, value) => {
    const newItems = [...createForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setCreateForm({ ...createForm, items: newItems });
  };

  // Edit functions
  const openEditDialog = (entry) => {
    setEditEntry(entry);
    setEditForm({
      customer_name: entry.customer_name || '',
      customer_phone: entry.customer_phone || '',
      tracking_id: entry.tracking_id || '',
      notes: entry.notes || '',
      items: entry.items?.length > 0
        ? entry.items.map(i => ({ master_sku_id: i.master_sku_id, quantity: i.quantity }))
        : [{ master_sku_id: entry.master_sku_id || '', quantity: entry.quantity || 1 }]
    });
    setEditOpen(true);
  };

  const addEditItem = () => {
    setEditForm({
      ...editForm,
      items: [...editForm.items, { master_sku_id: '', quantity: 1 }]
    });
  };

  const removeEditItem = (index) => {
    if (editForm.items.length === 1) {
      toast.error('At least one product is required');
      return;
    }
    const newItems = editForm.items.filter((_, i) => i !== index);
    setEditForm({ ...editForm, items: newItems });
  };

  const updateEditItem = (index, field, value) => {
    const newItems = [...editForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditForm({ ...editForm, items: newItems });
  };

  const handleEditSave = async () => {
    setActionLoading(true);
    try {
      const validItems = editForm.items.filter(item => item.master_sku_id && item.quantity > 0);

      const payload = {
        customer_name: editForm.customer_name || null,
        customer_phone: editForm.customer_phone || null,
        tracking_id: editForm.tracking_id || null,
        notes: editForm.notes || null,
        items: validItems.length > 0 ? validItems : null
      };

      await axios.put(`${API}/pending-fulfillment/${editEntry.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Entry updated successfully');
      setEditOpen(false);
      setEditEntry(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update entry');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDuplicate = async (entry) => {
    if (!window.confirm(`Are you sure you want to delete this duplicate entry for order ${entry.order_id}?`)) {
      return;
    }

    try {
      await axios.delete(`${API}/pending-fulfillment/${entry.id}/duplicate`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Duplicate entry deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete duplicate');
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
    // Check if stock is sufficient for all items
    if (entry.items && entry.items.length > 0) {
      const outOfStock = entry.items.filter(item => (item.current_stock || 0) < item.quantity);
      if (outOfStock.length > 0) {
        const details = outOfStock.map(i => `${i.sku_code}: Need ${i.quantity}, Have ${i.current_stock || 0}`).join('; ');
        toast.error(`Insufficient stock for: ${details}`);
        return;
      }
    } else if (entry.current_stock < entry.quantity) {
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

  // One-click Bigship: create the Delhivery shipment from this record's data + get the AWB.
  // Duplicate-safe on the backend (idempotent + dedup guard); a re-click never re-books.
  const handleBigshipLabel = async (entry) => {
    if (entry.awb_number) {
      toast.info(`Already booked — AWB ${entry.awb_number}`);
      return;
    }
    const ok = window.confirm(
      `Book a Delhivery shipment via Bigship for order ${entry.order_id}?\n\n` +
      `This creates a REAL parcel and generates the AWB using the customer/address/invoice ` +
      `already on this record. Re-clicking is safe — it will not re-book.`
    );
    if (!ok) return;
    setBigshipLoadingId(entry.id);
    try {
      const res = await axios.post(`${API}/pending-fulfillment/${entry.id}/bigship-label`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = res.data || {};
      if (d.already_booked) {
        toast.success(`Already booked — AWB ${d.awb_number}`);
      } else {
        toast.success(`${d.courier || 'Delhivery'} booked — AWB ${d.awb_number}. Tracking set; proceed with dispatch.`);
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to book Bigship shipment');
    } finally {
      setBigshipLoadingId(null);
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
    const base = 'rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 px-2 py-0.5 inline-flex items-center gap-1';
    if (entry.is_label_expired) {
      return <span className={`${base} bg-rose-500/15 text-rose-400 ring-rose-500/25`}>Label Expired</span>;
    }
    if (entry.is_label_expiring_soon) {
      return <span className={`${base} bg-orange-400/15 text-orange-400 ring-orange-400/25`}>Expiring Soon</span>;
    }

    switch (entry.status) {
      case 'awaiting_stock':
        return <span className={`${base} bg-amber-400/15 text-amber-400 ring-amber-400/25`}>Awaiting Stock</span>;
      case 'awaiting_procurement':
        return <span className={`${base} bg-sky-400/15 text-sky-400 ring-sky-400/25`}>Awaiting Procurement</span>;
      case 'pending_dispatch':
        return <span className={`${base} bg-violet-400/15 text-violet-400 ring-violet-400/25`}>Pending Dispatch</span>;
      case 'ready_to_dispatch':
        return <span className={`${base} bg-emerald-500/15 text-emerald-500 ring-emerald-500/25`}>Ready to Dispatch</span>;
      case 'dispatched':
        return <span className={`${base} bg-sky-400/15 text-sky-400 ring-sky-400/25`}>Dispatched</span>;
      case 'cancelled':
        return <span className={`${base} bg-muted text-muted-foreground ring-border`}>Cancelled</span>;
      case 'expired':
        return <span className={`${base} bg-rose-500/15 text-rose-400 ring-rose-500/25`}>Expired</span>;
      default:
        return <span className={`${base} bg-muted text-muted-foreground ring-border`}>{entry.status}</span>;
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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">Accountant · Fulfillment</p>
            <h1 className="text-2xl font-bold text-foreground">Pending Fulfillment Queue</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Amazon orders awaiting stock</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleBulkMarkReady}
              disabled={actionLoading}
              className="bg-emerald-500/80 hover:bg-emerald-500 text-white font-mono text-[11px] uppercase tracking-wide"
              data-testid="bulk-ready-btn"
            >
              <PackageCheck className="w-4 h-4 mr-2" />
              Fill All In-Stock
            </Button>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[11px] uppercase tracking-wide"
              data-testid="create-fulfillment-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Label Entry
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-sky-400/15">
                <Package className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{summary.total || 0}</p>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </div>
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-amber-400/15">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{summary.awaiting_stock || 0}</p>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Awaiting Stock</p>
              </div>
            </div>
          </div>
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-emerald-500/15">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{summary.ready_to_dispatch || 0}</p>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Ready to Dispatch</p>
              </div>
            </div>
          </div>
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-orange-400/15">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{summary.expiring_soon || 0}</p>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </div>
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-rose-500/15">
                <XCircle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{summary.expired_labels || 0}</p>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Expired Labels</p>
              </div>
            </div>
          </div>
        </div>

        {/* Missing Information Alerts Banner */}
        {(() => {
          // Calculate entries with missing critical information
          const entriesWithIssues = entries.filter(e =>
            e.status !== 'dispatched' && (
              !e.tracking_id ||
              !e.customer_name ||
              !e.customer_phone ||
              !e.items || e.items.length === 0 || e.items.some(i => !i.master_sku_id) ||
              !e.invoice_value
            )
          );

          const missingTrackingCount = entries.filter(e => e.status !== 'dispatched' && !e.tracking_id).length;
          const missingCustomerNameCount = entries.filter(e => e.status !== 'dispatched' && !e.customer_name).length;
          const missingPhoneCount = entries.filter(e => e.status !== 'dispatched' && !e.customer_phone).length;
          const missingSKUCount = entries.filter(e => e.status !== 'dispatched' && (!e.items || e.items.length === 0 || e.items.some(i => !i.master_sku_id))).length;
          const missingInvoiceCount = entries.filter(e => e.status !== 'dispatched' && !e.invoice_value).length;
          const ewayBillRequired = entries.filter(e => e.status !== 'dispatched' && e.invoice_value > 50000 && !e.eway_bill_url).length;

          if (entriesWithIssues.length === 0 && ewayBillRequired === 0) return null;

          return (
            <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.07] p-4" data-testid="missing-info-alerts">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-400 mb-2">
                    {entriesWithIssues.length} order{entriesWithIssues.length !== 1 ? 's' : ''} have missing dispatch information
                  </h3>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {missingTrackingCount > 0 && (
                      <span className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25">
                        <XCircle className="w-3 h-3" /> {missingTrackingCount} missing Tracking ID
                      </span>
                    )}
                    {missingSKUCount > 0 && (
                      <span className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-orange-400/15 text-orange-400 ring-1 ring-orange-400/25">
                        <Package className="w-3 h-3" /> {missingSKUCount} missing Master SKU
                      </span>
                    )}
                    {missingCustomerNameCount > 0 && (
                      <span className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25">
                        <AlertCircle className="w-3 h-3" /> {missingCustomerNameCount} missing Customer Name
                      </span>
                    )}
                    {missingPhoneCount > 0 && (
                      <span className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-violet-400/15 text-violet-400 ring-1 ring-violet-400/25">
                        <Phone className="w-3 h-3" /> {missingPhoneCount} missing Phone Number
                      </span>
                    )}
                    {missingInvoiceCount > 0 && (
                      <span className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/25">
                        <IndianRupee className="w-3 h-3" /> {missingInvoiceCount} missing Invoice Value
                      </span>
                    )}
                    {ewayBillRequired > 0 && (
                      <span className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25">
                        <FileUp className="w-3 h-3" /> {ewayBillRequired} need E-Way Bill (₹50K+)
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-amber-400/70 mt-2">
                    Click Edit (pencil icon) on any entry to complete missing information before dispatch.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Tabs and Table */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center mb-4">
            <TabsList className="bg-muted border border-border">
              <TabsTrigger value="awaiting" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
                Pending ({(summary.awaiting_stock || 0) + (summary.awaiting_procurement || 0) + (summary.pending_dispatch || 0)})
              </TabsTrigger>
              <TabsTrigger value="ready" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
                Ready to Dispatch ({summary.ready_to_dispatch || 0})
              </TabsTrigger>
              <TabsTrigger value="dispatched" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
                Dispatched
              </TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
                All
              </TabsTrigger>
            </TabsList>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search order/tracking/SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Card className="mg-card border border-border bg-card rounded-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Order/PI</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Customer</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">SKU</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Firm</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Qty</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Stock</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Status</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                          <p className="font-mono text-[11px] uppercase tracking-wide">No entries found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEntries.map((entry) => {
                        // Calculate missing fields for this entry
                        const hasMissingInfo = entry.status !== 'dispatched' && (
                          !entry.tracking_id ||
                          !entry.customer_name ||
                          !entry.customer_phone ||
                          !entry.items || entry.items.length === 0 || entry.items.some(i => !i.master_sku_id) ||
                          !entry.invoice_value ||
                          (entry.invoice_value > 50000 && !entry.eway_bill_url)
                        );

                        return (
                        <TableRow key={entry.id} className={`border-border ${hasMissingInfo ? 'bg-amber-400/[0.04]' : ''}`}>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              {hasMissingInfo && entry.status !== 'dispatched' && (
                                <div className="group relative">
                                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5 cursor-help" />
                                  <div className="absolute left-0 top-5 z-50 hidden group-hover:block bg-popover border border-border rounded-lg p-2 shadow-lg min-w-[180px]">
                                    <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-400 mb-1">Missing:</p>
                                    <ul className="font-mono text-[10px] text-muted-foreground space-y-0.5">
                                      {!entry.tracking_id && <li>• Tracking ID</li>}
                                      {!entry.customer_name && <li>• Customer Name</li>}
                                      {!entry.customer_phone && <li>• Phone Number</li>}
                                      {(!entry.items || entry.items.length === 0 || entry.items.some(i => !i.master_sku_id)) && <li>• Master SKU</li>}
                                      {!entry.invoice_value && <li>• Invoice Value</li>}
                                      {entry.invoice_value > 50000 && !entry.eway_bill_url && <li>• E-Way Bill</li>}
                                    </ul>
                                  </div>
                                </div>
                              )}
                              <div>
                                <div className="font-mono text-sm text-foreground tabular-nums">{entry.order_id || entry.quotation_number || '-'}</div>
                                {entry.tracking_id ? (
                                  <div className="font-mono text-[10px] text-sky-400 tabular-nums">{entry.tracking_id}</div>
                                ) : entry.status !== 'dispatched' && (
                                  <div className="font-mono text-[10px] text-rose-400">No tracking ID</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className={entry.customer_name ? 'text-foreground text-sm' : 'font-mono text-[11px] text-rose-400 uppercase'}>{entry.customer_name || 'Missing'}</div>
                            {entry.customer_phone ? (
                              <div className="font-mono text-[10px] text-muted-foreground tabular-nums">{entry.customer_phone}</div>
                            ) : entry.status !== 'dispatched' && (
                              <div className="font-mono text-[10px] text-rose-400">No phone</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.items && entry.items.length > 0 ? (
                              <div className="space-y-1">
                                {entry.items.map((item, idx) => (
                                  <div key={idx} className={idx > 0 ? 'pt-1 border-t border-border' : ''}>
                                    <div className="text-foreground text-sm">{item.master_sku_name || item.sku_name || 'Unknown'}</div>
                                    <div className="font-mono text-[10px] text-muted-foreground tabular-nums">{item.sku_code} x{item.quantity}</div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <>
                                <div className="text-foreground text-sm">{entry.master_sku_name || entry.product_title || entry.sku_name || 'Unknown'}</div>
                                <div className="font-mono text-[10px] text-muted-foreground tabular-nums">{entry.sku_code || entry.amazon_sku || 'No SKU'} x{entry.quantity}</div>
                              </>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{entry.firm_name}</TableCell>
                          <TableCell className="font-mono tabular-nums text-foreground text-right">{entry.quantity}</TableCell>
                          <TableCell>
                            {entry.items && entry.items.length > 0 ? (
                              <div className="space-y-1 text-right">
                                {entry.items.map((item, idx) => (
                                  <div key={idx} className={`font-mono text-sm tabular-nums font-medium ${(item.current_stock || 0) >= item.quantity ? 'text-emerald-500' : 'text-rose-400'}`}>
                                    {item.current_stock || 0}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className={`font-mono tabular-nums text-right font-medium ${entry.current_stock >= entry.quantity ? 'text-emerald-500' : 'text-rose-400'}`}>
                                {entry.current_stock}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(entry)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1.5 flex-wrap">
                              {entry.status !== 'dispatched' && entry.status !== 'cancelled' && (
                                <>
                                  {/* Show "Mark Ready" button if awaiting and has stock */}
                                  {['awaiting_stock', 'awaiting_procurement', 'pending_dispatch'].includes(entry.status) &&
                                   (entry.all_items_in_stock || (entry.current_stock >= entry.quantity)) &&
                                   !entry.is_label_expired && (
                                    <Button
                                      size="sm"
                                      className="bg-emerald-500/80 hover:bg-emerald-500 text-white font-mono text-[10px] uppercase tracking-wide"
                                      onClick={() => handleMarkReady(entry)}
                                      data-testid={`mark-ready-btn-${entry.id}`}
                                    >
                                      <PackageCheck className="w-3 h-3 mr-1" />
                                      Ready
                                    </Button>
                                  )}
                                  {entry.status === 'ready_to_dispatch' && !entry.is_label_expired && (
                                    <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25 inline-flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      Ready
                                    </span>
                                  )}
                                  {/* One-click Bigship: generate the Delhivery AWB + label from this record */}
                                  {!entry.awb_number ? (
                                    <Button
                                      size="sm"
                                      className="bg-sky-600/80 hover:bg-sky-600 text-white font-mono text-[10px] uppercase tracking-wide"
                                      onClick={() => handleBigshipLabel(entry)}
                                      disabled={bigshipLoadingId === entry.id}
                                      data-testid={`bigship-label-btn-${entry.id}`}
                                      title="Create Delhivery label + AWB via Bigship (no Bigship-panel detour)"
                                    >
                                      {bigshipLoadingId === entry.id
                                        ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                        : <Truck className="w-3 h-3 mr-1" />}
                                      Label
                                    </Button>
                                  ) : (
                                    <span
                                      className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25 inline-flex items-center gap-1"
                                      title={`Bigship AWB ${entry.awb_number}`}
                                    >
                                      <Truck className="w-3 h-3" />
                                      {entry.awb_number}
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-amber-400/40 text-amber-400 hover:bg-amber-400/10 font-mono text-[10px]"
                                    onClick={() => openEditDialog(entry)}
                                    data-testid={`edit-btn-${entry.id}`}
                                    title="Edit entry"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-sky-400/40 text-sky-400 hover:bg-sky-400/10 font-mono text-[10px]"
                                    onClick={() => { setSelectedEntry(entry); setRegenerateOpen(true); }}
                                    data-testid={`regenerate-btn-${entry.id}`}
                                  >
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Regen
                                  </Button>
                                  {/* E-way bill button for orders > 50K */}
                                  {entry.invoice_value > 50000 && !entry.eway_bill_url && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-orange-400/40 text-orange-400 hover:bg-orange-400/10 font-mono text-[10px]"
                                      onClick={() => openEwayBillDialog(entry)}
                                      title="Upload E-way Bill (Required for >₹50K)"
                                    >
                                      <FileUp className="w-3 h-3 mr-1" />
                                      E-way
                                    </Button>
                                  )}
                                  {entry.eway_bill_url && (
                                    <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25">
                                      E-way ✓
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 font-mono text-[10px]"
                                    onClick={() => handleCancel(entry)}
                                  >
                                    <XCircle className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-foreground font-mono text-[10px]"
                                onClick={() => { setSelectedEntry(entry); setHistoryOpen(true); }}
                              >
                                <History className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </Tabs>

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setOrderIdError('');
            setTrackingIdError('');
            setPhoneHistory([]);
          }
        }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Create Pending Fulfillment Entry
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Order ID *</Label>
                  <div className="relative">
                    <Input
                      value={createForm.order_id}
                      onChange={(e) => handleOrderIdChange(e.target.value)}
                      placeholder="e.g., 123-4567890-1234567"
                      className={`mt-1 font-mono ${orderIdError ? 'border-rose-500/60' : ''}`}
                      data-testid="order-id-input"
                    />
                    {checkingOrderId && (
                      <Loader2 className="w-4 h-4 absolute right-3 top-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {orderIdError && (
                    <p className="font-mono text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {orderIdError}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Tracking ID *</Label>
                  <div className="relative">
                    <Input
                      value={createForm.tracking_id}
                      onChange={(e) => handleTrackingIdChange(e.target.value)}
                      placeholder="e.g., TRK123456789"
                      className={`mt-1 font-mono ${trackingIdError ? 'border-rose-500/60' : ''}`}
                      data-testid="tracking-id-input"
                    />
                    {checkingTrackingId && (
                      <Loader2 className="w-4 h-4 absolute right-3 top-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {trackingIdError && (
                    <p className="font-mono text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {trackingIdError}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label>Firm *</Label>
                <Select value={createForm.firm_id} onValueChange={(v) => setCreateForm({...createForm, firm_id: v})}>
                  <SelectTrigger className="mt-1" data-testid="firm-select">
                    <SelectValue placeholder="Select firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Multiple Products Section */}
              <div className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Products *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addItem}
                    className="text-primary hover:bg-primary/10 font-mono text-[10px]"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Product
                  </Button>
                </div>
                <div className="space-y-3">
                  {createForm.items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="font-mono text-[10px] text-muted-foreground">Product {index + 1}</Label>
                        <Select
                          value={item.master_sku_id}
                          onValueChange={(v) => updateItem(index, 'master_sku_id', v)}
                        >
                          <SelectTrigger className="mt-1 [&>span]:truncate [&>span]:max-w-[90%]" data-testid={`sku-select-${index}`}>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px] max-w-[450px]">
                            {skus.map(s => (
                              <SelectItem key={s.id} value={s.id} title={`${s.name} (${s.sku_code})`}>
                                <span className="truncate block max-w-[400px]">{s.name} ({s.sku_code})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24">
                        <Label className="font-mono text-[10px] text-muted-foreground">Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="mt-1 font-mono"
                          data-testid={`qty-input-${index}`}
                        />
                      </div>
                      {createForm.items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="text-rose-400 hover:bg-rose-500/10 h-9"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer Name</Label>
                  <Input
                    value={createForm.customer_name}
                    onChange={(e) => setCreateForm({...createForm, customer_name: e.target.value})}
                    placeholder="Customer name"
                    className="mt-1"
                    data-testid="customer-name-input"
                  />
                </div>
                <div>
                  <Label>Customer Phone</Label>
                  <div className="relative">
                    <Input
                      value={createForm.customer_phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="Phone number"
                      className={`mt-1 font-mono ${phoneHistory.length > 0 ? 'border-amber-400/60' : ''}`}
                      data-testid="customer-phone-input"
                    />
                    {checkingPhone && (
                      <Loader2 className="w-4 h-4 absolute right-3 top-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              {/* Phone History Alert */}
              {phoneHistory.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-400/[0.07] border border-amber-400/25">
                  <div className="flex items-center gap-2 text-amber-400 font-mono text-[11px] font-semibold uppercase tracking-wide mb-2">
                    <Phone className="w-4 h-4" />
                    <span>Previous orders found for this phone number!</span>
                  </div>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto">
                    {phoneHistory.map((item, idx) => (
                      <div key={idx} className="font-mono text-[10px] text-foreground flex items-center justify-between gap-2 p-1.5 bg-muted/40 rounded">
                        <span className="tabular-nums truncate max-w-[100px]">{item.order_id}</span>
                        <span className="text-muted-foreground truncate max-w-[80px]">{item.customer_name || 'N/A'}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase ring-1 ${item.status === 'dispatched' || item.source === 'dispatch' ? 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25' : item.status === 'cancelled' ? 'bg-rose-500/15 text-rose-400 ring-rose-500/25' : 'bg-orange-400/15 text-orange-400 ring-orange-400/25'}`}>
                          {item.status}
                        </span>
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase ring-1 bg-muted text-muted-foreground ring-border">
                          {item.source || 'pending'}
                        </span>
                        <span className="text-muted-foreground whitespace-nowrap">{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                  <p className="font-mono text-[10px] text-amber-400/70 mt-2">
                    Be cautious — same phone may indicate repeat customer or duplicate entry
                  </p>
                </div>
              )}

              <div>
                <Label>Notes</Label>
                <Input
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({...createForm, notes: e.target.value})}
                  placeholder="Optional notes"
                  className="mt-1"
                />
              </div>

              {/* Invoice Value Field */}
              <div className="border border-border rounded-lg p-3">
                <Label className="flex items-center gap-2 mb-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  <IndianRupee className="w-4 h-4 text-emerald-500" />
                  Invoice Value (GST Inclusive)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={createForm.invoice_value}
                  onChange={(e) => setCreateForm({...createForm, invoice_value: e.target.value})}
                  placeholder="Total invoice amount including GST"
                  className="font-mono"
                  data-testid="invoice-value-input"
                />
                <p className="font-mono text-[10px] text-muted-foreground mt-1">
                  Enter total value including GST. System will calculate taxable value automatically.
                </p>
                {parseFloat(createForm.invoice_value) > 50000 && (
                  <div className="mt-2 p-2 rounded border border-orange-400/25 bg-orange-400/[0.07]">
                    <p className="font-mono text-[10px] text-orange-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      E-way bill required for orders &gt; ₹50,000
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 bg-muted/40 rounded-lg font-mono text-[10px] text-muted-foreground space-y-1">
                <p><span className="text-sky-400">●</span> Label will expire in 5 days from creation</p>
                <p><span className="text-amber-400">●</span> Stock will NOT be deducted until actual dispatch</p>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setCreateOpen(false)} className="text-muted-foreground font-mono text-[11px]">Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={actionLoading || !!orderIdError || !!trackingIdError}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[11px] uppercase tracking-wide"
                data-testid="submit-create-btn"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Entry'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Regenerate Dialog */}
        <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-sky-400" />
                Regenerate Tracking ID
              </DialogTitle>
            </DialogHeader>
            {selectedEntry && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/40 rounded-lg font-mono text-[11px]">
                  <p className="text-muted-foreground">Order: <span className="text-foreground tabular-nums">{selectedEntry.order_id}</span></p>
                  <p className="text-muted-foreground mt-1">Current Tracking: <span className="text-sky-400 tabular-nums">{selectedEntry.tracking_id}</span></p>
                </div>

                <div>
                  <Label>New Tracking ID *</Label>
                  <Input
                    value={regenerateForm.new_tracking_id}
                    onChange={(e) => setRegenerateForm({...regenerateForm, new_tracking_id: e.target.value})}
                    placeholder="Enter new tracking ID"
                    className="mt-1 font-mono"
                    data-testid="new-tracking-input"
                  />
                </div>

                <div>
                  <Label>Expiry Days</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={regenerateForm.expiry_days}
                    onChange={(e) => setRegenerateForm({...regenerateForm, expiry_days: parseInt(e.target.value) || 5})}
                    className="mt-1 font-mono"
                  />
                </div>

                <div className="p-3 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] font-mono text-[10px] text-amber-400">
                  Previous tracking ID will be preserved in history
                </div>
              </div>
            )}
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setRegenerateOpen(false)} className="text-muted-foreground font-mono text-[11px]">Cancel</Button>
              <Button onClick={handleRegenerate} disabled={actionLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[11px] uppercase tracking-wide" data-testid="submit-regenerate-btn">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Regenerate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-sky-400" />
                Tracking History
              </DialogTitle>
            </DialogHeader>
            {selectedEntry && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/40 rounded-lg font-mono text-[11px]">
                  <p className="text-muted-foreground">Order: <span className="text-foreground tabular-nums">{selectedEntry.order_id}</span></p>
                </div>

                <div className="space-y-2">
                  {(selectedEntry.tracking_history || []).map((th, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${th.status === 'active' ? 'bg-emerald-500/[0.07] border-emerald-500/25' : 'bg-muted/40 border-border'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-mono text-sm text-foreground tabular-nums">{th.tracking_id}</p>
                          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">Created: {new Date(th.created_at).toLocaleString()}</p>
                          {th.expired_at && (
                            <p className="font-mono text-[10px] text-rose-400">Replaced: {new Date(th.expired_at).toLocaleString()}</p>
                          )}
                        </div>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${th.status === 'active' ? 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25' : 'bg-muted text-muted-foreground ring-border'}`}>
                          {th.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setHistoryOpen(false)} className="text-muted-foreground font-mono text-[11px]">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Entry Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-400" />
                Edit Pending Fulfillment Entry
              </DialogTitle>
            </DialogHeader>
            {editEntry && (
              <div className="space-y-4">
                {/* Order Info */}
                <div className="bg-muted/40 rounded-lg p-3 font-mono text-[11px]">
                  <p className="text-muted-foreground">Order ID</p>
                  <p className="text-foreground tabular-nums mt-0.5">{editEntry.order_id}</p>
                </div>

                {/* Tracking ID */}
                <div>
                  <Label>Tracking ID</Label>
                  <Input
                    value={editForm.tracking_id}
                    onChange={(e) => setEditForm({...editForm, tracking_id: e.target.value})}
                    placeholder="Tracking ID"
                    className="mt-1 font-mono"
                  />
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer Name</Label>
                    <Input
                      value={editForm.customer_name}
                      onChange={(e) => setEditForm({...editForm, customer_name: e.target.value})}
                      placeholder="Customer name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Customer Phone</Label>
                    <Input
                      value={editForm.customer_phone}
                      onChange={(e) => setEditForm({...editForm, customer_phone: e.target.value})}
                      placeholder="Phone number"
                      className="mt-1 font-mono"
                    />
                  </div>
                </div>

                {/* Products Section */}
                <div className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Products</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addEditItem}
                      className="text-primary hover:bg-primary/10 font-mono text-[10px]"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Product
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {editForm.items.map((item, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="font-mono text-[10px] text-muted-foreground">Product {index + 1}</Label>
                          <Select
                            value={item.master_sku_id}
                            onValueChange={(v) => updateEditItem(index, 'master_sku_id', v)}
                          >
                            <SelectTrigger className="mt-1 [&>span]:truncate [&>span]:max-w-[90%]">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px] max-w-[400px]">
                              {skus.map(s => (
                                <SelectItem key={s.id} value={s.id} title={`${s.name} (${s.sku_code})`}>
                                  <span className="truncate block max-w-[350px]">{s.name} ({s.sku_code})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-20">
                          <Label className="font-mono text-[10px] text-muted-foreground">Qty</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateEditItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="mt-1 font-mono"
                          />
                        </div>
                        {editForm.items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEditItem(index)}
                            className="text-rose-400 hover:bg-rose-500/10 h-9"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={editForm.notes}
                    onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                    placeholder="Optional notes"
                    className="mt-1"
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)} className="text-muted-foreground border-border font-mono text-[11px]">
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                className="bg-amber-400/80 hover:bg-amber-400 text-black font-mono text-[11px] uppercase tracking-wide"
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Pencil className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* E-way Bill Upload Dialog */}
        <Dialog open={ewayBillOpen} onOpenChange={setEwayBillOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-400">
                <FileUp className="w-5 h-5" />
                Upload E-way Bill
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-orange-400/25 bg-orange-400/[0.07] p-3">
                <p className="font-mono text-[11px] text-orange-400">
                  <span className="text-muted-foreground">Order ID:</span> {selectedEntry?.order_id}
                </p>
                <p className="font-mono text-[11px] text-orange-400 mt-1">
                  <span className="text-muted-foreground">Invoice Value:</span> ₹{selectedEntry?.invoice_value?.toLocaleString()}
                </p>
                <p className="font-mono text-[10px] text-orange-400/70 mt-2">
                  E-way bill is mandatory for inter-state movement of goods exceeding ₹50,000
                </p>
              </div>

              <div>
                <Label>E-way Bill Number *</Label>
                <Input
                  value={ewayBillForm.number}
                  onChange={(e) => setEwayBillForm({...ewayBillForm, number: e.target.value})}
                  placeholder="e.g., 12345678901234"
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label>E-way Bill Document *</Label>
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setEwayBillForm({...ewayBillForm, file: e.target.files?.[0]})}
                  className="mt-1"
                />
                <p className="font-mono text-[10px] text-muted-foreground mt-1">Upload PDF or image of e-way bill</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEwayBillOpen(false)} className="text-muted-foreground font-mono text-[11px]">Cancel</Button>
              <Button
                onClick={handleUploadEwayBill}
                className="bg-orange-400/80 hover:bg-orange-400 text-black font-mono text-[11px] uppercase tracking-wide"
                disabled={uploadingEwayBill || !ewayBillForm.number || !ewayBillForm.file}
              >
                {uploadingEwayBill ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileUp className="w-4 h-4 mr-2" />
                )}
                Upload E-way Bill
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Info Banner - How to dispatch */}
        <div className="rounded-lg border border-sky-400/25 bg-sky-400/[0.07] p-4">
          <div className="flex items-start gap-3">
            <ArrowRight className="w-5 h-5 text-sky-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sky-400 mb-1">Workflow: Pending → Ready → Dispatch</p>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="text-emerald-500 font-semibold">1.</span> Click <span className="text-emerald-500 font-semibold">"Fill All In-Stock"</span> or individual <span className="text-emerald-500 font-semibold">"Ready"</span> buttons to move orders with available stock to Ready to Dispatch queue.
                <br />
                <span className="text-sky-400 font-semibold">2.</span> Go to <span className="text-foreground font-semibold">Create Outbound Dispatch</span> → select <span className="text-sky-400 font-semibold">"Pending Fulfillment"</span> as source → select the order to dispatch.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Package, Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Plus, History, Loader2, Search, ArrowRight, PackageCheck, AlertCircle, Phone, Trash2, Pencil, FileUp, IndianRupee, Truck
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const greenBtn = { ...primaryBtn, background: T.green };

// Pending-fulfillment status/label state -> Iron pill {label, style}
const statusPill = (entry) => {
  if (entry.is_label_expired) return { label: 'Label Expired', style: badgeStyle('bad') };
  if (entry.is_label_expiring_soon) return { label: 'Expiring Soon', style: badgeStyle('warn') };
  switch (entry.status) {
    case 'awaiting_stock': return { label: 'Awaiting Stock', style: badgeStyle('warn') };
    case 'awaiting_procurement': return { label: 'Awaiting Procurement', style: badgeStyle('info') };
    case 'pending_dispatch': return { label: 'Pending Dispatch', style: badgeStyle('violet') };
    case 'ready_to_dispatch': return { label: 'Ready to Dispatch', style: badgeStyle('ok') };
    case 'dispatched': return { label: 'Dispatched', style: badgeStyle('info') };
    case 'cancelled': return { label: 'Cancelled', style: badgeStyle('slate') };
    case 'expired': return { label: 'Expired', style: badgeStyle('bad') };
    default: return { label: (entry.status || '-').replace(/_/g, ' '), style: badgeStyle('slate') };
  }
};

export default function PendingFulfillment() {
  const { token } = useAuth();
  const [v2Retired, setV2Retired] = useState(false);
  useEffect(() => {
    axios.get(`${API}/config/flags`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setV2Retired(!!data.fulfillment_v2)).catch(() => {});
  }, [token]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Summary tiles
  const summaryTiles = [
    { key: 'total', label: 'Total Entries', value: summary.total || 0, icon: Package, tone: T.blue },
    { key: 'awaiting_stock', label: 'Awaiting Stock', value: summary.awaiting_stock || 0, icon: Clock, tone: T.voltageText },
    { key: 'ready', label: 'Ready to Dispatch', value: summary.ready_to_dispatch || 0, icon: CheckCircle, tone: T.green },
    { key: 'expiring', label: 'Expiring Soon', value: summary.expiring_soon || 0, icon: AlertTriangle, tone: T.orange },
    { key: 'expired', label: 'Expired Labels', value: summary.expired_labels || 0, icon: XCircle, tone: T.rose },
  ];

  const tabs = [
    { key: 'awaiting', label: `Pending (${(summary.awaiting_stock || 0) + (summary.awaiting_procurement || 0) + (summary.pending_dispatch || 0)})` },
    { key: 'ready', label: `Ready to Dispatch (${summary.ready_to_dispatch || 0})` },
    { key: 'dispatched', label: 'Dispatched' },
    { key: 'all', label: 'All' },
  ];

  const H = ['Order/PI', 'Customer', 'SKU', 'Firm', 'Qty', 'Stock', 'Status', 'Actions'];

  const outlineBtn = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 10.5 };
  const chip = (tone) => ({ ...badgeStyle(tone), display: 'inline-flex', alignItems: 'center', gap: 4 });

  const headerRight = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={handleBulkMarkReady} disabled={actionLoading} style={{ ...greenBtn, opacity: actionLoading ? 0.6 : 1 }} data-testid="bulk-ready-btn">
        <PackageCheck size={14} /> Fill All In-Stock
      </button>
      <button onClick={() => setCreateOpen(true)} style={primaryBtn} data-testid="create-fulfillment-btn">
        <Plus size={14} /> Create Label Entry
      </button>
    </div>
  );

  return (
    <IronShell title="Pending Fulfillment" subtitle="ACCOUNTANT · FULFILLMENT QUEUE" onRefresh={fetchData} headerRight={headerRight}>
      {v2Retired && (
        <div style={{ marginBottom: 16, border: `1px solid ${T.orange}`, background: 'rgba(245,130,32,.08)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>This queue is retired.</span>
          <span style={{ fontSize: 12.5, color: T.iron500 }}>Fulfilment now runs through <strong>Ship Desk</strong> — upload the label, pick the category, and it routes to the maker automatically.</span>
          <a href="/accountant/ship-desk" style={{ marginLeft: 'auto', border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, textDecoration: 'none' }}>Go to Ship Desk →</a>
        </div>
      )}
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* Summary tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            {summaryTiles.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.key} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{(s.value || 0).toLocaleString('en-IN')}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Missing Information Alerts Banner */}
          {(() => {
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
              <div style={{ border: `1px solid #EDDFA6`, background: T.voltageTint, borderRadius: 8, padding: 14, marginBottom: 16 }} data-testid="missing-info-alerts">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <AlertTriangle size={18} color={T.voltageText} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.voltageText, marginBottom: 8 }}>
                      {entriesWithIssues.length} order{entriesWithIssues.length !== 1 ? 's' : ''} have missing dispatch information
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {missingTrackingCount > 0 && <span style={chip('bad')}><XCircle size={11} /> {missingTrackingCount} missing Tracking ID</span>}
                      {missingSKUCount > 0 && <span style={chip('warn')}><Package size={11} /> {missingSKUCount} missing Master SKU</span>}
                      {missingCustomerNameCount > 0 && <span style={chip('warn')}><AlertCircle size={11} /> {missingCustomerNameCount} missing Customer Name</span>}
                      {missingPhoneCount > 0 && <span style={chip('violet')}><Phone size={11} /> {missingPhoneCount} missing Phone Number</span>}
                      {missingInvoiceCount > 0 && <span style={chip('info')}><IndianRupee size={11} /> {missingInvoiceCount} missing Invoice Value</span>}
                      {ewayBillRequired > 0 && <span style={chip('bad')}><FileUp size={11} /> {ewayBillRequired} need E-Way Bill (₹50K+)</span>}
                    </div>
                    <Caps size={9} color={T.voltageText} style={{ display: 'block', marginTop: 8, opacity: 0.85, letterSpacing: '.06em' }}>
                      Click Edit (pencil icon) on any entry to complete missing information before dispatch.
                    </Caps>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Tabs + search + table */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tabs.map((tb) => {
                  const active = activeTab === tb.key;
                  return (
                    <button key={tb.key} onClick={() => setActiveTab(tb.key)}
                      style={{ border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                      {tb.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search order/tracking/SKU…"
                  style={{ ...inputStyle, paddingLeft: 30, width: 250 }} />
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                <Package size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No entries found</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {H.map((h, i) => <th key={i} style={{ ...thCell, textAlign: (h === 'Qty' || h === 'Stock') ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>)}
                  </tr></thead>
                  <tbody>{filteredEntries.map((entry) => {
                    const hasMissingInfo = entry.status !== 'dispatched' && (
                      !entry.tracking_id ||
                      !entry.customer_name ||
                      !entry.customer_phone ||
                      !entry.items || entry.items.length === 0 || entry.items.some(i => !i.master_sku_id) ||
                      !entry.invoice_value ||
                      (entry.invoice_value > 50000 && !entry.eway_bill_url)
                    );
                    const sp = statusPill(entry);
                    return (
                      <tr key={entry.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, background: hasMissingInfo ? T.voltageTint : undefined }}>
                        {/* Order / PI */}
                        <td style={tdCell}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            {hasMissingInfo && entry.status !== 'dispatched' && (
                              <span className="group" style={{ position: 'relative' }}>
                                <AlertTriangle size={14} color={T.orange} style={{ flexShrink: 0, marginTop: 2, cursor: 'help' }} />
                                <span className="hidden group-hover:block" style={{ position: 'absolute', left: 0, top: 20, zIndex: 50, background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 8, boxShadow: '0 4px 14px rgba(0,0,0,.12)', minWidth: 180 }}>
                                  <Caps size={9} color={T.orangeDeep} style={{ display: 'block', marginBottom: 4 }}>Missing:</Caps>
                                  <ul style={{ ...mono, fontSize: 10, color: T.iron500, margin: 0, paddingLeft: 12 }}>
                                    {!entry.tracking_id && <li>Tracking ID</li>}
                                    {!entry.customer_name && <li>Customer Name</li>}
                                    {!entry.customer_phone && <li>Phone Number</li>}
                                    {(!entry.items || entry.items.length === 0 || entry.items.some(i => !i.master_sku_id)) && <li>Master SKU</li>}
                                    {!entry.invoice_value && <li>Invoice Value</li>}
                                    {entry.invoice_value > 50000 && !entry.eway_bill_url && <li>E-Way Bill</li>}
                                  </ul>
                                </span>
                              </span>
                            )}
                            <div>
                              <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{entry.order_id || entry.quotation_number || '-'}</div>
                              {entry.tracking_id ? (
                                <div style={{ ...mono, fontSize: 10, color: T.blue, marginTop: 2 }}>{entry.tracking_id}</div>
                              ) : entry.status !== 'dispatched' && (
                                <div style={{ ...mono, fontSize: 10, color: T.rose, marginTop: 2 }}>No tracking ID</div>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Customer */}
                        <td style={tdCell}>
                          <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: entry.customer_name ? T.iron900 : T.rose }}>{entry.customer_name || 'Missing'}</div>
                          {entry.customer_phone ? (
                            <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{entry.customer_phone}</div>
                          ) : entry.status !== 'dispatched' && (
                            <div style={{ ...mono, fontSize: 10, color: T.rose, marginTop: 2 }}>No phone</div>
                          )}
                        </td>
                        {/* SKU */}
                        <td style={{ ...tdCell, maxWidth: 240 }}>
                          {entry.items && entry.items.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {entry.items.map((item, idx) => (
                                <div key={idx} style={idx > 0 ? { paddingTop: 4, borderTop: `1px solid ${T.iron200}` } : undefined}>
                                  <div style={{ fontSize: 12, color: T.iron900 }}>{item.master_sku_name || item.sku_name || 'Unknown'}</div>
                                  <div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{item.sku_code} x{item.quantity}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
                              <div style={{ fontSize: 12, color: T.iron900 }}>{entry.master_sku_name || entry.product_title || entry.sku_name || 'Unknown'}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{entry.sku_code || entry.amazon_sku || 'No SKU'} x{entry.quantity}</div>
                            </>
                          )}
                        </td>
                        {/* Firm */}
                        <td style={{ ...tdCell, fontSize: 12, color: T.iron500 }}>{entry.firm_name}</td>
                        {/* Qty */}
                        <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900 }}>{entry.quantity}</td>
                        {/* Stock */}
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          {entry.items && entry.items.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {entry.items.map((item, idx) => (
                                <div key={idx} style={{ ...mono, fontSize: 12, fontWeight: 600, color: (item.current_stock || 0) >= item.quantity ? T.green : T.rose }}>
                                  {item.current_stock || 0}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ ...mono, fontSize: 12, fontWeight: 600, color: entry.current_stock >= entry.quantity ? T.green : T.rose }}>
                              {entry.current_stock}
                            </div>
                          )}
                        </td>
                        {/* Status */}
                        <td style={tdCell}><span style={sp.style}>{sp.label}</span></td>
                        {/* Actions */}
                        <td style={tdCell}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {entry.status !== 'dispatched' && entry.status !== 'cancelled' && (
                              <>
                                {['awaiting_stock', 'awaiting_procurement', 'pending_dispatch'].includes(entry.status) &&
                                 (entry.all_items_in_stock || (entry.current_stock >= entry.quantity)) &&
                                 !entry.is_label_expired && (
                                  <button style={{ ...greenBtn, padding: '5px 9px', fontSize: 10.5 }} onClick={() => handleMarkReady(entry)} data-testid={`mark-ready-btn-${entry.id}`}>
                                    <PackageCheck size={12} /> Ready
                                  </button>
                                )}
                                {entry.status === 'ready_to_dispatch' && !entry.is_label_expired && (
                                  <span style={chip('ok')}><CheckCircle size={11} /> Ready</span>
                                )}
                                {!entry.awb_number ? (
                                  <button
                                    style={{ ...primaryBtn, background: T.blue, padding: '5px 9px', fontSize: 10.5, opacity: bigshipLoadingId === entry.id ? 0.6 : 1 }}
                                    onClick={() => handleBigshipLabel(entry)}
                                    disabled={bigshipLoadingId === entry.id}
                                    data-testid={`bigship-label-btn-${entry.id}`}
                                    title="Create Delhivery label + AWB via Bigship (no Bigship-panel detour)"
                                  >
                                    {bigshipLoadingId === entry.id
                                      ? <Loader2 className="animate-spin" size={12} />
                                      : <Truck size={12} />}
                                    Label
                                  </button>
                                ) : (
                                  <span style={chip('info')} title={`Bigship AWB ${entry.awb_number}`}>
                                    <Truck size={11} /> {entry.awb_number}
                                  </span>
                                )}
                                <button style={outlineBtn} onClick={() => openEditDialog(entry)} data-testid={`edit-btn-${entry.id}`} title="Edit entry">
                                  <Pencil size={12} />
                                </button>
                                <button style={outlineBtn} onClick={() => { setSelectedEntry(entry); setRegenerateOpen(true); }} data-testid={`regenerate-btn-${entry.id}`} title="Regenerate tracking">
                                  <RefreshCw size={12} /> Regen
                                </button>
                                {entry.invoice_value > 50000 && !entry.eway_bill_url && (
                                  <button style={{ ...outlineBtn, color: T.orangeDeep, borderColor: T.orange }} onClick={() => openEwayBillDialog(entry)} title="Upload E-way Bill (Required for >₹50K)">
                                    <FileUp size={12} /> E-way
                                  </button>
                                )}
                                {entry.eway_bill_url && (
                                  <span style={chip('ok')}>E-way ✓</span>
                                )}
                                <button style={{ ...outlineBtn, color: T.rose, borderColor: '#F6D8BA' }} onClick={() => handleCancel(entry)} title="Cancel">
                                  <XCircle size={12} />
                                </button>
                              </>
                            )}
                            <button style={{ ...outlineBtn, color: T.iron500 }} onClick={() => { setSelectedEntry(entry); setHistoryOpen(true); }} title="History">
                              <History size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </IronCard>

          {/* Info Banner - How to dispatch */}
          <div style={{ border: `1px solid #CBE0F0`, background: T.blueTint, borderRadius: 8, padding: 14, marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <ArrowRight size={18} color={T.blue} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <Caps size={9} color={T.blue} style={{ display: 'block', marginBottom: 4 }}>Workflow: Pending → Ready → Dispatch</Caps>
                <div style={{ fontSize: 12.5, color: T.iron700, lineHeight: 1.6 }}>
                  <span style={{ color: T.green, fontWeight: 700 }}>1.</span> Click <b>"Fill All In-Stock"</b> or individual <b>"Ready"</b> buttons to move orders with available stock to the Ready to Dispatch queue.
                  <br />
                  <span style={{ color: T.blue, fontWeight: 700 }}>2.</span> Go to <b>Create Outbound Dispatch</b> → select <b>"Pending Fulfillment"</b> as source → select the order to dispatch.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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
                <div className="flex items-center gap-2 text-amber-500 font-mono text-[11px] font-semibold uppercase tracking-wide mb-2">
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
                <p className="font-mono text-[10px] text-amber-500 mt-2">
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
                  <p className="font-mono text-[10px] text-orange-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    E-way bill required for orders &gt; ₹50,000
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-muted/40 rounded-lg font-mono text-[10px] text-muted-foreground space-y-1">
              <p><span className="text-sky-500">●</span> Label will expire in 5 days from creation</p>
              <p><span className="text-amber-500">●</span> Stock will NOT be deducted until actual dispatch</p>
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
              <RefreshCw className="w-5 h-5 text-sky-500" />
              Regenerate Tracking ID
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/40 rounded-lg font-mono text-[11px]">
                <p className="text-muted-foreground">Order: <span className="text-foreground tabular-nums">{selectedEntry.order_id}</span></p>
                <p className="text-muted-foreground mt-1">Current Tracking: <span className="text-sky-500 tabular-nums">{selectedEntry.tracking_id}</span></p>
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

              <div className="p-3 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] font-mono text-[10px] text-amber-500">
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
              <History className="w-5 h-5 text-sky-500" />
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
              <Pencil className="w-5 h-5 text-amber-500" />
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
              className="bg-amber-500 hover:bg-amber-500/90 text-white font-mono text-[11px] uppercase tracking-wide"
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
            <DialogTitle className="flex items-center gap-2 text-orange-500">
              <FileUp className="w-5 h-5" />
              Upload E-way Bill
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-orange-400/25 bg-orange-400/[0.07] p-3">
              <p className="font-mono text-[11px] text-orange-500">
                <span className="text-muted-foreground">Order ID:</span> {selectedEntry?.order_id}
              </p>
              <p className="font-mono text-[11px] text-orange-500 mt-1">
                <span className="text-muted-foreground">Invoice Value:</span> ₹{selectedEntry?.invoice_value?.toLocaleString()}
              </p>
              <p className="font-mono text-[10px] text-orange-500/80 mt-2">
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
              className="bg-orange-500 hover:bg-orange-500/90 text-white font-mono text-[11px] uppercase tracking-wide"
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
    </IronShell>
  );
}

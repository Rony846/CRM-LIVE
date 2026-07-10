import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import ComplianceAlertBanner from '@/components/compliance/ComplianceAlertBanner';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Package, Truck, FileText, Wrench, Loader2, Upload,
  Eye, CheckCircle, Send, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Building2,
  Search, AlertTriangle, CheckCircle2, XCircle, Clock, AlertCircle, Filter, Zap,
  Receipt, ShoppingCart
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, LIGHT_VARS } from '@/components/iron/IronKit';
import { CustomerName } from '@/components/Customer360';

// Helper to extract error message from API responses
const getErrorMessage = (error, defaultMsg) => {
  const detail = error.response?.data?.detail;
  if (!detail) return defaultMsg;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    // Pydantic validation error format
    return detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
  }
  if (typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return defaultMsg;
};

// Indian states for GST compliance
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh",
  "Andaman and Nicobar Islands", "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep"
];

const fmtMoney = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

// SLA / age visual colours for the Iron surface.
const RED = '#DC2626', AMBER = '#B45309', YELLOW = T.voltageText, GREEN = T.green, INDIGO = '#4F46E5';

// Small mono chip used across the hardware queue.
const chip = (bg, fg, border) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color: fg,
  border: `1px solid ${border || bg}`, borderRadius: 5, padding: '2px 7px',
  fontFamily: T.mono, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '.04em', whiteSpace: 'nowrap',
});

// Iron KPI tile (clickable).
function IronStat({ label, value, icon: Icon, tone, onClick }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => { if (onClick && e.key === 'Enter') onClick(); }}
      style={{
        background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8,
        boxShadow: '0 1px 2px rgba(15,15,15,.06)', padding: 14,
        cursor: onClick ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}`, flexShrink: 0 }}>
        {Icon && <Icon size={18} color={tone} strokeWidth={1.9} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{value}</div>
        <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginTop: 5 }}>{label}</Caps>
      </div>
    </div>
  );
}

export default function AccountantDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [finance, setFinance] = useState(null);
  const [waDraftCount, setWaDraftCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [dispatches, setDispatches] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [skus, setSkus] = useState([]);
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hardware');

  // Dialog states
  const [createDispatchOpen, setCreateDispatchOpen] = useState(false);
  const [uploadLabelOpen, setUploadLabelOpen] = useState(false);
  const [pickupLabelOpen, setPickupLabelOpen] = useState(false);
  const [spareDispatchOpen, setSpareDispatchOpen] = useState(false);
  const [hardwareDecisionOpen, setHardwareDecisionOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Hardware Queue State
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [hardwareAgeFilter, setHardwareAgeFilter] = useState('all'); // all, today, yesterday, week, older
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Form states
  const [dispatchForm, setDispatchForm] = useState({
    sku: '', sku_code_input: '', customer_name: '', phone: '', address: '', state: '', reason: '', note: '',
    order_id: '', payment_reference: '', invoice_file: null,
    dispatch_type: 'new_order', firm_id: '',
    item_type: '', master_sku_id: '', raw_material_id: '', master_sku_name: '',
    serial_number: '', is_manufactured: false,
    dispatch_source: 'ready_in_stock', // 'ready_in_stock' or 'pending_fulfillment'
    pending_fulfillment_id: '', // ID of selected pending fulfillment entry
    tracking_id: '', // For pending fulfillment - pre-filled
    order_source: '', // amazon, flipkart, website, walkin, easyship, other
    marketplace_order_id: '' // External marketplace order ID for reconciliation
  });
  const [availableSerials, setAvailableSerials] = useState([]);
  const [itemSerials, setItemSerials] = useState({}); // { item_index: { serials: [], selected: '' } } for multi-item orders
  const [skuLookupResult, setSkuLookupResult] = useState(null);
  const [skuLookupLoading, setSkuLookupLoading] = useState(false);
  const [pendingFulfillmentEntries, setPendingFulfillmentEntries] = useState([]);
  const [labelForm, setLabelForm] = useState({
    courier: '', tracking_id: '', label_file: null
  });
  const [pickupForm, setPickupForm] = useState({
    courier: '', tracking_id: '', label_file: null, reason: ''
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  // Financial cockpit data — receivables / payables / GST / WhatsApp purchase drafts,
  // scoped to the accountant's firm. Loads once firms are known.
  const fetchFinance = async (fid) => {
    if (!fid) return;
    const h = { headers: { Authorization: `Bearer ${token}` } };
    try {
      const [rec, pay, gst, wa] = await Promise.all([
        axios.get(`${API}/reports/receivables?firm_id=${fid}`, h).catch(() => ({ data: {} })),
        axios.get(`${API}/reports/payables?firm_id=${fid}`, h).catch(() => ({ data: {} })),
        axios.get(`${API}/finance/analytics/gst-summary?firm_id=${fid}`, h).catch(() => ({ data: {} })),
        axios.get(`${API}/purchases/wa-drafts`, h).catch(() => ({ data: { count: 0 } })),
      ]);
      setFinance({
        receivable: rec.data.total_receivable || 0,
        payable: pay.data.total_payable ?? pay.data.total_outstanding ?? 0,
        gst: gst.data?.output_tax?.total ?? gst.data?.total_outward?.total_gst ?? 0,
      });
      setWaDraftCount(wa.data.count ?? (wa.data.drafts || []).length ?? 0);
    } catch (e) { /* non-fatal — cockpit just shows blanks */ }
  };

  useEffect(() => {
    if (firms && firms.length) fetchFinance(firms[0].id);
  }, [firms]);

  // Fetch pending fulfillment entries ready for dispatch
  const fetchPendingFulfillmentEntries = async (firmId) => {
    if (!firmId) {
      setPendingFulfillmentEntries([]);
      return;
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API}/pending-fulfillment`, {
        headers,
        params: { firm_id: firmId, status: 'ready_to_dispatch' }
      });
      // Filter entries that are ready to dispatch and not expired
      const readyEntries = (response.data?.entries || []).filter(e =>
        e.status === 'ready_to_dispatch' && !e.is_label_expired && e.firm_id === firmId
      );
      setPendingFulfillmentEntries(readyEntries);
    } catch (error) {
      console.error('Failed to fetch pending fulfillment entries:', error);
      setPendingFulfillmentEntries([]);
    }
  };

  // Fetch SKUs filtered by selected firm (using new Master SKU endpoint)
  const fetchSkusByFirm = async (firmId) => {
    if (!firmId) {
      setSkus([]);
      return;
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API}/master-skus/search-for-dispatch`, {
        headers,
        params: { firm_id: firmId, in_stock_only: true }
      });
      setSkus(response.data?.skus || []);
    } catch (error) {
      console.error('Failed to fetch SKUs:', error);
      setSkus([]);
    }
  };

  // Lookup a specific SKU code or alias (searches both Master SKUs and Raw Materials)
  const lookupSKUCode = async (code, firmId) => {
    if (!code || !firmId) {
      setSkuLookupResult(null);
      setAvailableSerials([]);
      return;
    }

    setSkuLookupLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API}/master-skus/lookup`, {
        headers,
        params: { code: code.trim(), firm_id: firmId }
      });
      setSkuLookupResult(response.data);

      if (response.data.found && response.data.can_dispatch) {
        // Auto-fill the form with found item
        if (response.data.item_type === 'master_sku') {
          const isManufactured = response.data.master_sku?.product_type === 'manufactured';
          setDispatchForm(prev => ({
            ...prev,
            sku: response.data.master_sku.sku_code,
            item_type: 'master_sku',
            master_sku_id: response.data.master_sku.id,
            raw_material_id: '',
            master_sku_name: response.data.master_sku.name,
            is_manufactured: isManufactured,
            serial_number: ''
          }));

          // If manufactured, fetch available serial numbers
          if (isManufactured) {
            try {
              const serialsRes = await axios.get(
                `${API}/finished-good-serials/available/${response.data.master_sku.id}`,
                { headers, params: { firm_id: firmId } }
              );
              setAvailableSerials(serialsRes.data || []);
            } catch (err) {
              console.error('Failed to fetch serials:', err);
              setAvailableSerials([]);
            }
          } else {
            setAvailableSerials([]);
          }
        } else if (response.data.item_type === 'raw_material') {
          setDispatchForm(prev => ({
            ...prev,
            sku: response.data.raw_material.sku_code,
            item_type: 'raw_material',
            master_sku_id: '',
            raw_material_id: response.data.raw_material.id,
            master_sku_name: response.data.raw_material.name,
            is_manufactured: false,
            serial_number: ''
          }));
          setAvailableSerials([]);
        }
      } else {
        setDispatchForm(prev => ({
          ...prev,
          sku: '',
          item_type: '',
          master_sku_id: '',
          raw_material_id: '',
          master_sku_name: '',
          is_manufactured: false,
          serial_number: ''
        }));
        setAvailableSerials([]);
      }
    } catch (error) {
      console.error('SKU lookup failed:', error);
      setSkuLookupResult({
        found: false,
        message: 'Failed to lookup SKU. Please try again.'
      });
      setAvailableSerials([]);
    } finally {
      setSkuLookupLoading(false);
    }
  };

  // Lookup Amazon order details by order ID (auto-fill customer info and state)
  const lookupAmazonOrder = async (orderId, firmId) => {
    if (!orderId || orderId.length < 3) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = { order_id: orderId };
      if (firmId) params.firm_id = firmId;

      const response = await axios.get(`${API}/amazon/order-lookup`, { headers, params });

      if (response.data.found) {
        const order = response.data.order;
        const fullAddress = [order.address_line1, order.address_line2, order.city, order.postal_code]
          .filter(Boolean).join(', ');

        // Auto-fill form fields from Amazon order
        setDispatchForm(prev => ({
          ...prev,
          customer_name: order.buyer_name || prev.customer_name,
          phone: order.phone || prev.phone,
          address: fullAddress || prev.address,
          state: order.state || prev.state,
          marketplace_order_id: order.amazon_order_id || prev.marketplace_order_id,
          // Auto-detect if it's an EasyShip order
          order_source: order.is_easy_ship ? 'easyship' : 'amazon'
        }));

        toast.success(`Amazon order found: ${order.buyer_name || 'Customer'} - ${order.state || 'State not available'}`);
      }
    } catch (error) {
      // Silently fail - order might not be synced yet
      console.log('Amazon order lookup:', error.response?.data?.message || 'Not found');
    }
  };

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [dispatchRes, ticketsRes, firmsRes] = await Promise.all([
        axios.get(`${API}/dispatches`, { headers }),
        // Use view_as=accountant so admin sees same data as accountant.
        // limit=1000: the hardware queue is a work backlog (100s of open tickets);
        // the default limit=100 silently truncated the oldest, most SLA-overdue
        // reverse-pickup tickets off the queue so the accountant never saw them.
        axios.get(`${API}/tickets?view_as=accountant&limit=1000`, { headers }),
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }).catch(() => ({ data: [] }))
      ]);

      const dispatchData = Array.isArray(dispatchRes.data) ? dispatchRes.data : [];
      const ticketData = Array.isArray(ticketsRes.data) ? ticketsRes.data : [];
      const firmData = Array.isArray(firmsRes.data) ? firmsRes.data : [];

      setDispatches(dispatchData);
      setTickets(ticketData);
      setFirms(firmData);

      // Compute stats
      const pendingLabels = dispatchData.filter(d => d.status === 'pending_label').length;
      const readyToDispatch = dispatchData.filter(d =>
        d.status === 'ready_to_dispatch' || d.status === 'ready_for_dispatch'
      ).length;

      setStats({
        pending_labels: pendingLabels,
        ready_to_dispatch: readyToDispatch
      });
    } catch (error) {
      console.error('Fetch data error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ===========================================
  // FILTERED TICKET LISTS
  // ===========================================

  // Helper: Calculate ticket age in hours
  const getTicketAgeHours = (ticket) => {
    const created = new Date(ticket.created_at);
    return (Date.now() - created.getTime()) / (1000 * 60 * 60);
  };

  // Helper: Get SLA status
  const getSlaStatus = (ticket) => {
    if (!ticket.sla_due) return { status: 'unknown', hoursLeft: null };
    const slaDue = new Date(ticket.sla_due);
    const hoursLeft = (slaDue.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursLeft < 0) return { status: 'breached', hoursLeft: Math.abs(hoursLeft) };
    if (hoursLeft < 2) return { status: 'critical', hoursLeft };
    if (hoursLeft < 6) return { status: 'warning', hoursLeft };
    return { status: 'ok', hoursLeft };
  };

  // Helper: Get age category
  const getAgeCategory = (ticket) => {
    const hours = getTicketAgeHours(ticket);
    if (hours < 24) return 'today';
    if (hours < 48) return 'yesterday';
    if (hours < 168) return 'week'; // 7 days
    return 'older';
  };

  // Hardware Tab: Tickets needing accountant action - FIXED FILTER
  // Include ALL hardware-related tickets regardless of decision state
  const allHardwareTickets = tickets.filter(t =>
    t.status === 'hardware_service' ||
    t.status === 'awaiting_label' ||
    t.status === 'label_uploaded' ||
    t.supervisor_action === 'reverse_pickup' ||
    t.supervisor_action === 'spare_dispatch' ||
    t.accountant_decision === 'reverse_pickup' ||
    t.accountant_decision === 'spare_dispatch' ||
    t.support_type === 'hardware'
  );

  // Apply age filter
  const hardwareTickets = useMemo(() => {
    let filtered = allHardwareTickets;

    if (hardwareAgeFilter !== 'all') {
      filtered = filtered.filter(t => getAgeCategory(t) === hardwareAgeFilter);
    }

    // Sort by SLA (most urgent first)
    return filtered.sort((a, b) => {
      const slaA = a.sla_due ? new Date(a.sla_due).getTime() : Infinity;
      const slaB = b.sla_due ? new Date(b.sla_due).getTime() : Infinity;
      return slaA - slaB;
    });
  }, [allHardwareTickets, hardwareAgeFilter]);

  // Needs Decision: Direct hardware tickets without supervisor_action AND without accountant_decision
  const needsDecisionTickets = hardwareTickets.filter(t =>
    !t.supervisor_action && !t.accountant_decision && t.status === 'hardware_service'
  );

  // Reverse Pickup: Tickets needing pickup label OR with uploaded label (for re-upload)
  // Includes: supervisor decided reverse_pickup OR accountant decided reverse_pickup
  const reversePickupTickets = hardwareTickets.filter(t =>
    (t.supervisor_action === 'reverse_pickup' || t.accountant_decision === 'reverse_pickup')
  );

  // Spare Dispatch: Tickets needing spare part sent
  // Includes: supervisor decided spare_dispatch OR accountant decided spare_dispatch
  const spareDispatchTickets = hardwareTickets.filter(t =>
    t.supervisor_action === 'spare_dispatch' || t.accountant_decision === 'spare_dispatch'
  );

  // SLA Stats
  const slaStats = useMemo(() => {
    const breached = hardwareTickets.filter(t => getSlaStatus(t).status === 'breached').length;
    const critical = hardwareTickets.filter(t => getSlaStatus(t).status === 'critical').length;
    const warning = hardwareTickets.filter(t => getSlaStatus(t).status === 'warning').length;
    return { breached, critical, warning };
  }, [hardwareTickets]);

  // Age Stats
  const ageStats = useMemo(() => ({
    today: allHardwareTickets.filter(t => getAgeCategory(t) === 'today').length,
    yesterday: allHardwareTickets.filter(t => getAgeCategory(t) === 'yesterday').length,
    week: allHardwareTickets.filter(t => getAgeCategory(t) === 'week').length,
    older: allHardwareTickets.filter(t => getAgeCategory(t) === 'older').length,
  }), [allHardwareTickets]);

  // Repaired items ready for return dispatch (from technician)
  const repairedTickets = tickets.filter(t =>
    t.status === 'repair_completed' || t.status === 'service_invoice_added'
  );

  // Outbound dispatches pending labels
  const pendingLabelDispatches = dispatches.filter(d => d.status === 'pending_label');

  // ===========================================
  // HANDLERS
  // ===========================================

  // Create Outbound Dispatch (New Order or Spare Part - NOT from ticket)
  const handleCreateDispatch = async (e) => {
    e.preventDefault();

    if (!dispatchForm.firm_id) {
      toast.error('Please select a Firm first');
      return;
    }
    if (!dispatchForm.order_id) {
      toast.error('Order ID is mandatory');
      return;
    }
    // Payment reference is only required for non-marketplace orders AND non-pending-fulfillment orders
    const isMarketplaceOrder = ['amazon', 'flipkart', 'easyship'].includes(dispatchForm.order_source);
    const isEasyshipOrder = dispatchForm.order_source === 'easyship';
    const isPendingFulfillmentDispatch = dispatchForm.dispatch_source === 'pending_fulfillment';

    // Skip payment reference check if it's a marketplace order OR pending fulfillment dispatch
    if (!isMarketplaceOrder && !isPendingFulfillmentDispatch && !dispatchForm.payment_reference) {
      toast.error('Payment Reference is mandatory');
      return;
    }
    if (!dispatchForm.invoice_file) {
      toast.error('Invoice/Delivery Challan is mandatory');
      return;
    }
    if (!dispatchForm.sku || (!dispatchForm.master_sku_id && !dispatchForm.raw_material_id)) {
      toast.error('Please lookup and select a valid SKU/Material with stock');
      return;
    }

    // State is mandatory for GST compliance
    if (!dispatchForm.state) {
      toast.error('Customer State is mandatory for GST compliance');
      return;
    }

    // Phone validation: mandatory 10 digits for non-Easyship orders
    if (!isEasyshipOrder) {
      const phoneDigits = dispatchForm.phone?.replace(/\D/g, '') || '';
      if (phoneDigits.length !== 10) {
        toast.error('Phone number must be exactly 10 digits');
        return;
      }
    }

    // Validate stock availability (not for pending fulfillment since already validated)
    if (dispatchForm.dispatch_source === 'ready_in_stock' && skuLookupResult && !skuLookupResult.can_dispatch) {
      toast.error('Cannot dispatch: No stock available. Transfer, produce, or purchase first.');
      return;
    }

    // For single manufactured items from ready_in_stock, serial number is mandatory
    if (dispatchForm.dispatch_source === 'ready_in_stock' && dispatchForm.is_manufactured && !dispatchForm.serial_number) {
      toast.error('Serial number is mandatory for manufactured items');
      return;
    }

    // For pending fulfillment with manufactured items, validate all serial slots are selected
    if (dispatchForm.dispatch_source === 'pending_fulfillment' && dispatchForm.has_manufactured_items && Object.keys(itemSerials).length > 0) {
      const totalSlots = Object.keys(itemSerials).length;
      const selectedCount = Object.values(itemSerials).filter(s => s.selected).length;

      if (selectedCount < totalSlots) {
        toast.error(`Please select serial numbers for all ${totalSlots} units (${selectedCount} selected)`);
        return;
      }
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('dispatch_type', dispatchForm.dispatch_type);
      formData.append('sku', dispatchForm.sku);
      formData.append('item_type', dispatchForm.item_type || 'master_sku');
      formData.append('item_id', dispatchForm.master_sku_id || dispatchForm.raw_material_id);
      formData.append('firm_id', dispatchForm.firm_id);
      formData.append('customer_name', dispatchForm.customer_name);
      formData.append('phone', dispatchForm.phone);
      formData.append('address', dispatchForm.address);
      formData.append('state', dispatchForm.state);
      formData.append('reason', dispatchForm.reason);
      formData.append('note', dispatchForm.note || '');
      formData.append('order_id', dispatchForm.order_id);
      formData.append('payment_reference', dispatchForm.payment_reference);
      formData.append('invoice_file', dispatchForm.invoice_file);

      // Add serial number for single manufactured items from ready_in_stock
      if (dispatchForm.dispatch_source === 'ready_in_stock' && dispatchForm.is_manufactured && dispatchForm.serial_number) {
        formData.append('serial_number', dispatchForm.serial_number);
      }

      // Add item serial numbers for pending_fulfillment with manufactured items
      if (dispatchForm.dispatch_source === 'pending_fulfillment' && dispatchForm.has_manufactured_items && Object.keys(itemSerials).length > 0) {
        const itemSerialsData = [];
        Object.entries(itemSerials).forEach(([slotIndex, slotData]) => {
          if (slotData.selected) {
            itemSerialsData.push({
              slot_index: parseInt(slotIndex),
              item_index: slotData.itemIndex,
              unit_index: slotData.unitIndex,
              master_sku_id: slotData.master_sku_id,
              serial_number: slotData.selected
            });
          }
        });
        if (itemSerialsData.length > 0) {
          formData.append('item_serials', JSON.stringify(itemSerialsData));
        }
      }

      // Add pending fulfillment info if dispatching from queue
      if (dispatchForm.dispatch_source === 'pending_fulfillment' && dispatchForm.pending_fulfillment_id) {
        formData.append('pending_fulfillment_id', dispatchForm.pending_fulfillment_id);
        formData.append('tracking_id', dispatchForm.tracking_id);
      }

      // Add order source and marketplace order ID for e-commerce reconciliation
      if (dispatchForm.order_source) {
        formData.append('order_source', dispatchForm.order_source);
      }
      if (dispatchForm.marketplace_order_id) {
        formData.append('marketplace_order_id', dispatchForm.marketplace_order_id);
      }

      await axios.post(`${API}/dispatches`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Outbound dispatch created');
      setCreateDispatchOpen(false);
      setDispatchForm({
        sku: '', sku_code_input: '', customer_name: '', phone: '', address: '', state: '', reason: '', note: '',
        order_id: '', payment_reference: '', invoice_file: null, dispatch_type: 'new_order',
        firm_id: '', item_type: '', master_sku_id: '', raw_material_id: '', master_sku_name: '',
        serial_number: '', is_manufactured: false,
        dispatch_source: 'ready_in_stock', pending_fulfillment_id: '', tracking_id: '',
        order_source: '', marketplace_order_id: ''
      });
      setSkus([]); // Reset SKUs
      setSkuLookupResult(null);
      setPendingFulfillmentEntries([]);
      setItemSerials({}); // Reset item serials
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create dispatch'));
    } finally {
      setActionLoading(false);
    }
  };

  // Upload shipping label for outbound dispatch
  const handleUploadLabel = async (e) => {
    e.preventDefault();
    if (!labelForm.label_file) {
      toast.error('Please select a label file');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('courier', labelForm.courier);
      formData.append('tracking_id', labelForm.tracking_id);
      formData.append('label_file', labelForm.label_file);

      await axios.patch(`${API}/dispatches/${selectedItem.id}/label`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Label uploaded - Ready for dispatch');
      setUploadLabelOpen(false);
      setLabelForm({ courier: '', tracking_id: '', label_file: null });
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to upload label'));
    } finally {
      setActionLoading(false);
    }
  };

  // Upload PICKUP label for customer (Reverse Pickup flow)
  const handleUploadPickupLabel = async (e) => {
    e.preventDefault();
    if (!pickupForm.label_file) {
      toast.error('Please select a label file');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('courier', pickupForm.courier);
      formData.append('tracking_id', pickupForm.tracking_id);
      formData.append('label_file', pickupForm.label_file);
      if (pickupForm.reason) {
        formData.append('reason', pickupForm.reason);
      }

      const response = await axios.post(`${API}/tickets/${selectedItem.id}/upload-pickup-label`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const attempt = response.data.attempt || 1;
      toast.success(attempt > 1
        ? `Pickup label re-uploaded (Attempt #${attempt}) - Customer can download the new label`
        : 'Pickup label uploaded - Customer can now download and print it'
      );
      setPickupLabelOpen(false);
      setPickupForm({ courier: '', tracking_id: '', label_file: null, reason: '' });
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to upload pickup label'));
    } finally {
      setActionLoading(false);
    }
  };

  // Attach / replace the customer invoice on a ticket (e.g. to restore a lost one)
  const [attachingInvoiceId, setAttachingInvoiceId] = useState(null);
  const handleAttachInvoice = async (ticketId, file) => {
    if (!file) return;
    setAttachingInvoiceId(ticketId);
    try {
      const formData = new FormData();
      formData.append('invoice_file', file);
      await axios.post(`${API}/tickets/${ticketId}/attach-invoice`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Invoice attached');
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to attach invoice'));
    } finally {
      setAttachingInvoiceId(null);
    }
  };

  // Create Spare Part Dispatch from ticket
  const handleCreateSpareDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchForm.firm_id) {
      toast.error('Please select a firm');
      return;
    }
    if (!dispatchForm.sku) {
      toast.error('Please select a spare part');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('dispatch_type', 'spare_dispatch');
      formData.append('sku', dispatchForm.sku);
      formData.append('firm_id', dispatchForm.firm_id);
      formData.append('ticket_id', selectedItem.id);

      await axios.post(`${API}/dispatches/from-ticket/${selectedItem.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Spare part dispatch created');
      setSpareDispatchOpen(false);
      setDispatchForm({ ...dispatchForm, sku: '', firm_id: '' });
      setSkus([]);
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create spare dispatch'));
    } finally {
      setActionLoading(false);
    }
  };

  // Create Return Dispatch for repaired item
  const handleCreateReturnDispatch = async (ticket) => {
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('dispatch_type', 'return');
      formData.append('ticket_id', ticket.id);

      await axios.post(`${API}/dispatches/from-ticket/${ticket.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Return dispatch created for repaired item');
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create return dispatch'));
    } finally {
      setActionLoading(false);
    }
  };

  const openPickupLabelDialog = (ticket) => {
    setSelectedItem(ticket);
    setPickupForm({ courier: '', tracking_id: '', label_file: null });
    setPickupLabelOpen(true);
  };

  const openSpareDispatchDialog = async (ticket) => {
    setSelectedItem(ticket);
    setDispatchForm({ ...dispatchForm, sku: ticket.supervisor_sku || '', firm_id: '' });
    setSkus([]); // Reset SKUs until firm is selected
    setSpareDispatchOpen(true);
  };

  // Fetch spare parts for a specific firm (for spare dispatch)
  const fetchSparePartsForFirm = async (firmId) => {
    if (!firmId) {
      setSkus([]);
      return;
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      // Get Master SKUs that have stock at this firm (any category - spares can be any item)
      const response = await axios.get(`${API}/master-skus/search-for-dispatch`, {
        headers,
        params: { firm_id: firmId, in_stock_only: true }
      });
      setSkus(response.data?.skus || []);
    } catch (error) {
      console.error('Failed to fetch spare parts:', error);
      setSkus([]);
    }
  };

  const openHardwareDecisionDialog = (ticket) => {
    setSelectedItem(ticket);
    setHardwareDecisionOpen(true);
  };

  // Toggle ticket selection for bulk actions
  const toggleTicketSelection = (ticketId) => {
    setSelectedTickets(prev => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  };

  // Select all visible tickets needing decision
  const selectAllNeedsDecision = () => {
    const ids = needsDecisionTickets.map(t => t.id);
    setSelectedTickets(new Set(ids));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTickets(new Set());
  };

  // Bulk decision handler
  const handleBulkDecision = async (decision) => {
    if (selectedTickets.size === 0) {
      toast.error('No tickets selected');
      return;
    }

    setBulkActionLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    let successCount = 0;
    let failCount = 0;

    for (const ticketId of selectedTickets) {
      try {
        await axios.patch(`${API}/tickets/${ticketId}/accountant-decision`,
          { decision },
          { headers }
        );
        successCount++;
      } catch (error) {
        console.error(`Failed to update ticket ${ticketId}:`, error);
        failCount++;
      }
    }

    setBulkActionLoading(false);
    clearSelection();
    fetchData();

    if (failCount === 0) {
      toast.success(`${successCount} tickets marked as ${decision === 'reverse_pickup' ? 'Reverse Pickup' : 'Spare Dispatch'}`);
    } else {
      toast.warning(`${successCount} succeeded, ${failCount} failed`);
    }
  };

  const handleHardwareDecision = async (decision) => {
    // Update ticket with accountant's decision
    setActionLoading(true);
    try {
      await axios.patch(`${API}/tickets/${selectedItem.id}/accountant-decision`,
        { decision },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success(`Marked for ${decision === 'spare_dispatch' ? 'Spare Dispatch' : 'Reverse Pickup'}`);
      setHardwareDecisionOpen(false);
      fetchData();

      // Open appropriate follow-up dialog
      if (decision === 'spare_dispatch') {
        setTimeout(() => openSpareDispatchDialog(selectedItem), 500);
      } else {
        setTimeout(() => openPickupLabelDialog(selectedItem), 500);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update decision'));
    } finally {
      setActionLoading(false);
    }
  };

  const openUploadLabelDialog = (dispatch) => {
    setSelectedItem(dispatch);
    setLabelForm({ courier: '', tracking_id: '', label_file: null });
    setUploadLabelOpen(true);
  };

  // ---- Iron button styles ----
  const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, background: T.orange, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 13px', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.03em' };
  const btnOutline = { display: 'inline-flex', alignItems: 'center', gap: 6, background: T.white, color: T.iron700, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '8px 13px', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5, cursor: 'pointer' };
  const btnAmber = { display: 'inline-flex', alignItems: 'center', gap: 6, background: T.voltage, color: '#5C4A00', border: 'none', borderRadius: 6, padding: '8px 13px', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.03em' };
  const btnGreen = { display: 'inline-flex', alignItems: 'center', gap: 6, background: T.green, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 13px', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.03em' };

  const infoLink = { display: 'inline-flex', alignItems: 'center', gap: 5, color: T.blue, fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, textDecoration: 'none', cursor: 'pointer' };

  const registers = [
    ['Sales', '/accountant/sales'], ['Purchases', '/accountant/purchases'], ['Party Ledger', '/accountant/ledger'],
    ['Payments', '/accountant/payments'], ['Reconciliation', '/accountant/reconciliation'], ['Reports & GST', '/accountant/reports'],
    ['Credit Notes', '/accountant/credit-notes'], ['Expenses', '/accountant/expenses']
  ];

  const tabDefs = [
    { key: 'hardware', label: `Hardware Queue (${hardwareTickets.length})`, icon: Wrench, badge: slaStats.breached > 0 ? slaStats.breached : null, testid: 'hardware-tab' },
    { key: 'repaired', label: `Repaired (${repairedTickets.length})`, icon: CheckCircle, testid: 'repaired-tab' },
    { key: 'outbound', label: 'Outbound', icon: ArrowUpFromLine, testid: 'outbound-tab' },
    { key: 'labels', label: `Upload Labels (${pendingLabelDispatches.length})`, icon: FileText, testid: 'labels-tab' },
  ];

  const ageFilters = [
    ['all', `All (${allHardwareTickets.length})`],
    ['today', `Today (${ageStats.today})`],
    ['yesterday', `Yesterday (${ageStats.yesterday})`],
    ['week', `This Week (${ageStats.week})`],
    ['older', `Older (${ageStats.older})`],
  ];

  const emptyState = (msg) => (
    <div style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
      <CheckCircle size={44} color={T.green} style={{ margin: '0 auto 10px' }} />
      <Caps size={10} color={T.iron500} style={{ display: 'block' }}>{msg}</Caps>
    </div>
  );

  return (
    <IronShell
      title="Accountant Dashboard"
      subtitle={firms?.[0]?.name ? firms[0].name.toUpperCase() : 'ACCOUNTS · GST · PAYMENTS'}
      onRefresh={() => { fetchData(); if (firms?.[0]?.id) fetchFinance(firms[0].id); }}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <>
          {/* Compliance Alert Banner */}
          <div style={{ ...LIGHT_VARS, marginBottom: 14 }}><ComplianceAlertBanner /></div>

          {/* Financial KPIs */}
          <div data-testid="accountant-financials" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
            <IronStat label="Receivables (owed to us)" value={fmtMoney(finance?.receivable)} icon={ArrowDownToLine} tone={GREEN} onClick={() => navigate('/accountant/reports')} />
            <IronStat label="Payables (we owe)" value={fmtMoney(finance?.payable)} icon={ArrowUpFromLine} tone={RED} onClick={() => navigate('/accountant/reports')} />
            <IronStat label="Output GST (this month)" value={fmtMoney(finance?.gst)} icon={Receipt} tone={T.orange} onClick={() => navigate('/accountant/reports')} />
            <IronStat label="WhatsApp purchase drafts" value={waDraftCount} icon={ShoppingCart} tone={T.blue} onClick={() => navigate('/accountant/purchases')} />
          </div>

          {/* Needs me today */}
          <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>Needs Me Today</Caps>
          <div data-testid="accountant-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <IronStat label="Reverse Pickups to arrange" value={reversePickupTickets.length} icon={ArrowDownToLine} tone={AMBER} onClick={() => setActiveTab('hardware')} />
            <IronStat label="Payments to confirm" value={pendingFulfillmentEntries.length} icon={CheckCircle} tone={INDIGO} onClick={() => navigate('/accountant/pending-fulfillment')} />
            <IronStat label="Spare Dispatch" value={spareDispatchTickets.length} icon={Package} tone={INDIGO} onClick={() => setActiveTab('hardware')} />
            <IronStat label="Incoming to verify" value="›" icon={Package} tone={T.blue} onClick={() => navigate('/accountant/incoming-queue')} />
          </div>

          {/* Registers */}
          <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>Open a Register</Caps>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {registers.map(([n, p]) => (
              <button key={p} onClick={() => navigate(p)} style={btnOutline}>{n}</button>
            ))}
          </div>

          {/* Tabs card */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 6, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, flexWrap: 'wrap' }}>
              {tabDefs.map((tb) => {
                const Icon = tb.icon;
                const active = activeTab === tb.key;
                return (
                  <button
                    key={tb.key}
                    data-testid={tb.testid}
                    onClick={() => setActiveTab(tb.key)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}
                  >
                    <Icon size={14} strokeWidth={2} />{tb.label}
                    {tb.badge != null && (
                      <span style={{ ...mono, fontSize: 10, fontWeight: 700, background: RED, color: '#fff', borderRadius: 4, padding: '1px 5px' }}>{tb.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: 16 }}>
              {/* ===================== HARDWARE TAB ===================== */}
              {activeTab === 'hardware' && (
                <>
                  {/* SLA Alert Banner */}
                  {(slaStats.breached > 0 || slaStats.critical > 0) && (
                    <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, background: '#FDEAEA', border: `1px solid #F6C9C9` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <AlertCircle size={20} color={RED} />
                        <div>
                          <div style={{ fontFamily: T.headline, fontWeight: 700, color: RED, fontSize: 13 }}>
                            SLA Alert: {slaStats.breached > 0 && `${slaStats.breached} breached`}
                            {slaStats.breached > 0 && slaStats.critical > 0 && ', '}
                            {slaStats.critical > 0 && `${slaStats.critical} critical (<2hrs)`}
                          </div>
                          <div style={{ fontSize: 12, color: '#B04A4A' }}>These tickets need immediate attention</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Filters and Bulk Actions Bar */}
                  <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
                      {/* Age Quick Filters */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Filter size={14} color={T.iron400} />
                        <Caps size={9} color={T.iron500}>Filter:</Caps>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {ageFilters.map(([key, lbl]) => {
                            const active = hardwareAgeFilter === key;
                            return (
                              <button
                                key={key}
                                onClick={() => setHardwareAgeFilter(key)}
                                style={{ border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: T.mono, fontSize: 11, fontWeight: 600 }}
                              >
                                {lbl}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bulk Actions */}
                      {needsDecisionTickets.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                          <span style={{ ...mono, fontSize: 11, color: T.iron500 }}>
                            {selectedTickets.size > 0 ? `${selectedTickets.size} selected` : 'Bulk Actions:'}
                          </span>
                          {selectedTickets.size === 0 ? (
                            <button onClick={selectAllNeedsDecision} style={{ ...btnOutline, padding: '6px 11px', fontSize: 11 }}>
                              Select All Pending ({needsDecisionTickets.length})
                            </button>
                          ) : (
                            <>
                              <button onClick={() => handleBulkDecision('reverse_pickup')} disabled={bulkActionLoading} style={{ ...btnAmber, padding: '6px 11px', opacity: bulkActionLoading ? 0.6 : 1 }}>
                                {bulkActionLoading ? <Loader2 className="animate-spin" size={14} /> : <ArrowDownToLine size={14} />}
                                Reverse Pickup
                              </button>
                              <button onClick={() => handleBulkDecision('spare_dispatch')} disabled={bulkActionLoading} style={{ ...btnPrimary, padding: '6px 11px', opacity: bulkActionLoading ? 0.6 : 1 }}>
                                {bulkActionLoading ? <Loader2 className="animate-spin" size={14} /> : <Package size={14} />}
                                Spare Dispatch
                              </button>
                              <button onClick={clearSelection} style={{ ...btnOutline, border: 'none', background: 'transparent', color: T.iron500, padding: '6px 8px', fontSize: 11 }}>Clear</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 14 }}>
                    Sorted by SLA urgency · Red = Breached · Amber = Critical (&lt;2hrs) · Yellow = Warning (&lt;6hrs)
                  </Caps>

                  {hardwareTickets.length === 0 ? emptyState('No pending hardware tickets') : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {hardwareTickets.map((ticket) => {
                        const slaInfo = getSlaStatus(ticket);
                        const ageHours = getTicketAgeHours(ticket);
                        const isSelected = selectedTickets.has(ticket.id);
                        const needsDecision = !ticket.supervisor_action && !ticket.accountant_decision && ticket.status === 'hardware_service';

                        const slaBorderColor = slaInfo.status === 'breached' ? RED :
                          slaInfo.status === 'critical' ? T.orange :
                          slaInfo.status === 'warning' ? T.voltage : GREEN;

                        const slaChip = slaInfo.status === 'breached' ? chip('#FDEAEA', RED) :
                          slaInfo.status === 'critical' ? chip('#FDEEE6', T.orangeDeep) :
                          slaInfo.status === 'warning' ? chip(T.voltageTint, YELLOW) : chip(T.greenTint, GREEN);

                        const ageChip = ageHours > 168 ? chip('#FDEAEA', RED) :
                          ageHours > 48 ? chip('#FDEEE6', T.orangeDeep) :
                          ageHours > 24 ? chip(T.voltageTint, YELLOW) : chip(T.iron100, T.iron500);

                        const action = ticket.supervisor_action || ticket.accountant_decision;
                        const actionChip = action === 'spare_dispatch' ? chip('#FDEEE6', T.orangeDeep) : chip(T.voltageTint, YELLOW);

                        return (
                          <div key={ticket.id} style={{ background: T.white, border: `1px solid ${isSelected ? T.orange : T.iron200}`, borderLeft: `4px solid ${slaBorderColor}`, borderRadius: 8, boxShadow: isSelected ? `0 0 0 2px ${T.orange}22` : '0 1px 2px rgba(15,15,15,.05)', padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                              {/* Checkbox for bulk selection */}
                              {needsDecision && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleTicketSelection(ticket.id)}
                                  style={{ width: 16, height: 16, marginTop: 4, accentColor: T.orange, cursor: 'pointer' }}
                                />
                              )}

                              <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Header */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                  <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: T.iron900 }}>{ticket.ticket_number}</span>
                                  <span style={slaChip}>
                                    <Clock size={11} />
                                    {slaInfo.status === 'breached' ? `Breached ${Math.round(slaInfo.hoursLeft)}h ago` :
                                     slaInfo.status === 'unknown' ? 'No SLA' :
                                     `${Math.round(slaInfo.hoursLeft)}h left`}
                                  </span>
                                  <span style={ageChip}>{Math.round(ageHours)}h old</span>
                                  <StatusBadge status={ticket.status} />
                                  {action ? (
                                    <span style={actionChip}>{action === 'spare_dispatch' ? 'Send Spare' : 'Rev. Pickup'}</span>
                                  ) : (
                                    <span style={chip(T.voltageTint, YELLOW)}>Needs Decision</span>
                                  )}
                                  {ticket.pickup_label && <span style={chip(T.greenTint, GREEN)}>Label Uploaded</span>}
                                </div>

                                {/* Customer Info Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 12 }}>
                                  <div>
                                    <Caps size={8.5} color={T.iron400} style={{ display: 'block' }}>Customer</Caps>
                                    <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900 }}><CustomerName name={ticket.customer_name} phone={ticket.customer_phone} /></div>
                                  </div>
                                  <div>
                                    <Caps size={8.5} color={T.iron400} style={{ display: 'block' }}>Phone</Caps>
                                    <div style={{ ...mono, fontSize: 12.5, color: T.iron900 }}>{ticket.customer_phone}</div>
                                  </div>
                                  <div>
                                    <Caps size={8.5} color={T.iron400} style={{ display: 'block' }}>Device</Caps>
                                    <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900 }}>{ticket.device_type}</div>
                                  </div>
                                  <div>
                                    <Caps size={8.5} color={T.iron400} style={{ display: 'block' }}>City</Caps>
                                    <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900 }}>{ticket.customer_city || '-'}</div>
                                  </div>
                                </div>

                                {/* Issue */}
                                <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, padding: 12, borderRadius: 8, marginBottom: 12 }}>
                                  <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 4 }}>Issue</Caps>
                                  <div style={{ fontSize: 12.5, color: T.iron900 }}>{ticket.issue_description}</div>
                                </div>

                                {/* Notes Section */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                  {ticket.agent_notes && (
                                    <div style={{ background: '#F4F0FB', border: '1px solid #DDD3EF', padding: 12, borderRadius: 8 }}>
                                      <Caps size={8.5} color="#6D4AB0" style={{ display: 'block', marginBottom: 4 }}>Support Agent Notes</Caps>
                                      <div style={{ fontSize: 12.5, color: T.iron900 }}>{ticket.agent_notes}</div>
                                    </div>
                                  )}
                                  {ticket.escalation_notes && (
                                    <div style={{ background: T.voltageTint, border: '1px solid #EDDFA6', padding: 12, borderRadius: 8 }}>
                                      <Caps size={8.5} color={YELLOW} style={{ display: 'block', marginBottom: 4 }}>Escalation Notes</Caps>
                                      <div style={{ fontSize: 12.5, color: T.iron900 }}>{ticket.escalation_notes}</div>
                                      {ticket.escalated_by_name && <div style={{ ...mono, fontSize: 10.5, color: YELLOW, marginTop: 4 }}>By: {ticket.escalated_by_name}</div>}
                                    </div>
                                  )}
                                  {ticket.supervisor_notes && (
                                    <div style={{ gridColumn: '1 / -1', background: '#FDEEE6', border: '1px solid #F6D8BA', padding: 12, borderRadius: 8 }}>
                                      <Caps size={8.5} color={T.orangeDeep} style={{ display: 'block', marginBottom: 4 }}>Supervisor Decision</Caps>
                                      <div style={{ fontSize: 12.5, color: T.iron900 }}>{ticket.supervisor_notes}</div>
                                      {ticket.supervisor_sku && <div style={{ ...mono, fontSize: 10.5, color: T.orangeDeep, marginTop: 6 }}>Recommended SKU: {ticket.supervisor_sku}</div>}
                                    </div>
                                  )}
                                </div>

                                {/* Customer Invoice */}
                                <div style={{ background: T.blueTint, border: '1px solid #CBE0F0', padding: 12, borderRadius: 8, marginTop: 12 }}>
                                  <Caps size={8.5} color={T.blue} style={{ display: 'block', marginBottom: 4 }}>Customer Invoice</Caps>
                                  {ticket.invoice_file ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                      <a
                                        href={`${API.replace('/api', '')}${ticket.invoice_file}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={infoLink}
                                        data-testid={`view-invoice-${ticket.id}`}
                                      >
                                        <FileText size={14} />
                                        View Invoice Document
                                      </a>
                                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.iron500, cursor: 'pointer' }}>
                                        <Upload size={12} />
                                        {attachingInvoiceId === ticket.id ? 'Uploading…' : 'Replace'}
                                        <input type="file" style={{ display: 'none' }} accept="image/*,.pdf"
                                          disabled={attachingInvoiceId === ticket.id}
                                          onChange={(e) => handleAttachInvoice(ticket.id, e.target.files[0])} />
                                      </label>
                                    </div>
                                  ) : (
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: AMBER, fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}
                                      data-testid={`attach-invoice-${ticket.id}`}>
                                      <Upload size={14} />
                                      {attachingInvoiceId === ticket.id ? 'Uploading…' : 'Attach Invoice (missing)'}
                                      <input type="file" style={{ display: 'none' }} accept="image/*,.pdf"
                                        disabled={attachingInvoiceId === ticket.id}
                                        onChange={(e) => handleAttachInvoice(ticket.id, e.target.files[0])} />
                                    </label>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                                {!ticket.supervisor_action && !ticket.accountant_decision && ticket.status === 'hardware_service' && (
                                  <button style={btnAmber} onClick={() => openHardwareDecisionDialog(ticket)} data-testid={`make-decision-${ticket.id}`}>
                                    <Eye size={14} /> Make Decision
                                  </button>
                                )}
                                {(ticket.supervisor_action === 'reverse_pickup' || ticket.accountant_decision === 'reverse_pickup') && !ticket.pickup_label && (
                                  <button style={btnAmber} onClick={() => openPickupLabelDialog(ticket)} data-testid={`upload-pickup-${ticket.id}`}>
                                    <Upload size={14} /> Upload Pickup Label
                                  </button>
                                )}
                                {(ticket.supervisor_action === 'spare_dispatch' || ticket.accountant_decision === 'spare_dispatch') && (
                                  <button style={btnPrimary} onClick={() => openSpareDispatchDialog(ticket)} data-testid={`create-spare-${ticket.id}`}>
                                    <Package size={14} /> Create Spare Dispatch
                                  </button>
                                )}
                                {ticket.pickup_label && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ ...mono, fontSize: 11, color: GREEN }}>Label sent (#{ticket.pickup_attempt || 1})</span>
                                    <button style={{ ...btnOutline, border: `1px solid ${T.voltage}`, color: YELLOW, padding: '6px 10px', fontSize: 11 }} onClick={() => openPickupLabelDialog(ticket)} data-testid={`reupload-pickup-${ticket.id}`}>
                                      <RefreshCw size={12} /> Re-upload
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* ===================== REPAIRED TAB ===================== */}
              {activeTab === 'repaired' && (
                <>
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 14 }}>Repaired items ready to be dispatched back to customer</Caps>
                  {repairedTickets.length === 0 ? emptyState('No repaired items pending') : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                          {['Ticket #', 'Customer', 'Device', 'Invoice', 'Repair Notes', 'Status', ''].map((h, i) => (
                            <th key={i} style={{ ...thCell, textAlign: i === 6 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {repairedTickets.map((ticket) => (
                            <tr key={ticket.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                              <td style={tdCell}>
                                <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: T.iron900 }}>
                                  {ticket.ticket_number}
                                  {ticket.is_walkin ? (
                                    <span style={{ ...chip('#F4F0FB', '#6D4AB0'), marginLeft: 6 }}>Walk-in</span>
                                  ) : (
                                    <span style={{ ...chip('#FDEEE6', T.orangeDeep), marginLeft: 6 }}>CRM</span>
                                  )}
                                </div>
                              </td>
                              <td style={tdCell}>
                                <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}><CustomerName name={ticket.customer_name} phone={ticket.customer_phone} /></div>
                                <div style={{ ...mono, fontSize: 10.5, color: T.iron500 }}>{ticket.customer_phone}</div>
                              </td>
                              <td style={tdCell}>{ticket.device_type}</td>
                              <td style={tdCell}>
                                {ticket.invoice_file ? (
                                  <a href={`${API.replace('/api', '')}${ticket.invoice_file}`} target="_blank" rel="noopener noreferrer"
                                    style={{ ...infoLink, color: T.orangeDeep, fontSize: 11.5 }} data-testid={`view-invoice-${ticket.id}`}>
                                    <FileText size={12} /> View
                                  </a>
                                ) : <span style={{ color: T.iron400 }}>-</span>}
                              </td>
                              <td style={{ ...tdCell, maxWidth: 240 }}>
                                <div style={{ background: T.greenTint, border: '1px solid #CBE5D6', padding: 8, borderRadius: 6, fontSize: 12, color: T.green }}>
                                  {ticket.repair_notes || 'Repair completed'}
                                </div>
                              </td>
                              <td style={tdCell}><StatusBadge status={ticket.status} /></td>
                              <td style={{ ...tdCell, textAlign: 'right' }}>
                                <button style={{ ...btnGreen, opacity: actionLoading ? 0.6 : 1 }} onClick={() => handleCreateReturnDispatch(ticket)} disabled={actionLoading} data-testid={`return-dispatch-${ticket.id}`}>
                                  <Truck size={14} /> Create Return Dispatch
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* ===================== OUTBOUND TAB ===================== */}
              {activeTab === 'outbound' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
                    <Caps size={9} color={T.iron400}>Create new outbound dispatch (New Order or Spare Part)</Caps>
                    <button style={btnPrimary} onClick={() => setCreateDispatchOpen(true)} data-testid="create-dispatch-btn">
                      <Send size={14} /> New Outbound Dispatch
                    </button>
                  </div>
                  <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, padding: 14, borderRadius: 8 }}>
                    <Caps size={10} color={T.iron700} style={{ display: 'block', marginBottom: 8 }}>What is Outbound?</Caps>
                    <div style={{ fontSize: 12.5, color: T.iron500 }}>Items going OUT from service center to customer:</div>
                    <ul style={{ fontSize: 12.5, color: T.iron500, marginTop: 8, paddingLeft: 18, lineHeight: 1.7 }}>
                      <li><span style={{ fontWeight: 700, color: T.iron900 }}>New Order</span> — New product being shipped</li>
                      <li><span style={{ fontWeight: 700, color: T.iron900 }}>Spare Part</span> — Replacement part being sent</li>
                      <li><span style={{ fontWeight: 700, color: T.iron900 }}>Repaired Item</span> — Use the Repaired tab for this</li>
                    </ul>
                  </div>
                </>
              )}

              {/* ===================== LABELS TAB ===================== */}
              {activeTab === 'labels' && (
                <>
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 14 }}>Upload shipping labels for outbound dispatches</Caps>
                  {pendingLabelDispatches.length === 0 ? emptyState('No dispatches pending labels') : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                          {['Dispatch #', 'Type', 'Customer', 'SKU', 'Ticket #', ''].map((h, i) => (
                            <th key={i} style={{ ...thCell, textAlign: i === 5 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {pendingLabelDispatches.map((dispatch) => (
                            <tr key={dispatch.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                              <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.iron900 }}>{dispatch.dispatch_number}</td>
                              <td style={tdCell}>
                                <span style={
                                  dispatch.dispatch_type === 'new_order' ? chip('#FDEEE6', T.orangeDeep) :
                                  dispatch.dispatch_type === 'spare_dispatch' ? chip('#F4F0FB', '#6D4AB0') :
                                  chip(T.greenTint, GREEN)
                                }>
                                  {dispatch.dispatch_type?.replace('_', ' ')}
                                </span>
                              </td>
                              <td style={tdCell}><CustomerName name={dispatch.customer_name} phone={dispatch.phone || dispatch.customer_phone} /></td>
                              <td style={{ ...tdCell, ...mono }}>{dispatch.sku || '-'}</td>
                              <td style={{ ...tdCell, ...mono }}>{dispatch.ticket_number || '-'}</td>
                              <td style={{ ...tdCell, textAlign: 'right' }}>
                                <button style={btnPrimary} onClick={() => openUploadLabelDialog(dispatch)} data-testid={`upload-label-${dispatch.id}`}>
                                  <Upload size={14} /> Upload Label
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </IronCard>
        </>
      )}

      {/* ===========================================
          DIALOGS (shadcn preserved verbatim)
      =========================================== */}

      {/* Create Outbound Dispatch Dialog */}
      <Dialog open={createDispatchOpen} onOpenChange={(open) => {
        setCreateDispatchOpen(open);
        if (!open) {
          setSkus([]); // Reset SKUs when dialog closes
          setSkuLookupResult(null);
          setPendingFulfillmentEntries([]);
          setItemSerials({}); // Reset item serials
          setDispatchForm({
            sku: '', sku_code_input: '', customer_name: '', phone: '', address: '', state: '', reason: '', note: '',
            order_id: '', payment_reference: '', invoice_file: null, dispatch_type: 'new_order',
            firm_id: '', item_type: '', master_sku_id: '', raw_material_id: '', master_sku_name: '',
            serial_number: '', is_manufactured: false,
            dispatch_source: 'ready_in_stock', pending_fulfillment_id: '', tracking_id: '',
            order_source: '', marketplace_order_id: ''
          });
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Outbound Dispatch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDispatch} className="space-y-4">
            {/* Firm Selection - MANDATORY */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Select Firm *
                <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold bg-amber-400/15 text-amber-400">Required for inventory tracking</span>
              </Label>
              <Select
                value={dispatchForm.firm_id}
                onValueChange={(v) => {
                  setDispatchForm({...dispatchForm, firm_id: v, sku: '', sku_code_input: '', master_sku_id: '', master_sku_name: '', pending_fulfillment_id: '', tracking_id: '', order_id: ''});
                  setSkuLookupResult(null);
                  fetchSkusByFirm(v);
                  fetchPendingFulfillmentEntries(v);
                }}
              >
                <SelectTrigger data-testid="firm-select" className={!dispatchForm.firm_id ? 'border-orange-400' : ''}>
                  <SelectValue placeholder="Select a firm first" />
                </SelectTrigger>
                <SelectContent>
                  {firms.map(firm => (
                    <SelectItem key={firm.id} value={firm.id}>
                      {firm.name} ({firm.gstin})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dispatch Source Selection - Ready in Stock or Pending Fulfillment */}
            {dispatchForm.firm_id && (
              <div className="space-y-2">
                <Label>Dispatch Source *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={dispatchForm.dispatch_source === 'ready_in_stock' ? 'default' : 'outline'}
                    className={dispatchForm.dispatch_source === 'ready_in_stock' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'border-border'}
                    onClick={() => {
                      setDispatchForm({...dispatchForm,
                        dispatch_source: 'ready_in_stock',
                        pending_fulfillment_id: '',
                        tracking_id: '',
                        order_id: '',
                        sku: '', sku_code_input: '', master_sku_id: '', master_sku_name: '', is_manufactured: false, serial_number: ''
                      });
                      setSkuLookupResult(null);
                      setAvailableSerials([]);
                    }}
                    data-testid="source-ready-in-stock"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Ready in Stock
                  </Button>
                  <Button
                    type="button"
                    variant={dispatchForm.dispatch_source === 'pending_fulfillment' ? 'default' : 'outline'}
                    className={dispatchForm.dispatch_source === 'pending_fulfillment' ? 'bg-sky-400/80 hover:bg-sky-400 text-black' : 'border-border'}
                    onClick={() => {
                      setDispatchForm({...dispatchForm,
                        dispatch_source: 'pending_fulfillment',
                        // Don't reset dispatch_type - keep user's selection, just default if not set
                        dispatch_type: dispatchForm.dispatch_type || 'amazon_order',
                        sku: '', sku_code_input: '', master_sku_id: '', master_sku_name: '', is_manufactured: false, serial_number: ''
                      });
                      setSkuLookupResult(null);
                      setAvailableSerials([]);
                    }}
                    data-testid="source-pending-fulfillment"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Pending Fulfillment ({pendingFulfillmentEntries.length})
                  </Button>
                </div>
                {dispatchForm.dispatch_source === 'pending_fulfillment' && pendingFulfillmentEntries.length === 0 && (
                  <p className="font-mono text-[11px] text-muted-foreground bg-muted border border-border p-2 rounded">
                    No pending fulfillment orders ready for dispatch at this firm. Create entries in the Pending Fulfillment Queue first.
                  </p>
                )}
              </div>
            )}

            {/* Dispatch Type - Show for BOTH sources */}
            {dispatchForm.firm_id && (
              <div className="space-y-2">
                <Label>Dispatch Type *</Label>
                <Select
                  value={dispatchForm.dispatch_type}
                  onValueChange={(v) => setDispatchForm({...dispatchForm, dispatch_type: v})}
                >
                  <SelectTrigger data-testid="dispatch-type-select">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_order">New Order (Non-Amazon)</SelectItem>
                    <SelectItem value="amazon_order">Amazon Order</SelectItem>
                    <SelectItem value="spare_dispatch">Spare Part</SelectItem>
                  </SelectContent>
                </Select>
                {dispatchForm.dispatch_type === 'amazon_order' && (
                  <p className="font-mono text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/25 p-2 rounded">
                    Amazon orders require a feedback call from Call Support after delivery
                  </p>
                )}
              </div>
            )}

            {/* Order Source Selection - For E-commerce Reconciliation */}
            {dispatchForm.firm_id && (
              <div className="space-y-2">
                <Label>Order Source *</Label>
                <Select
                  value={dispatchForm.order_source}
                  onValueChange={(v) => {
                    setDispatchForm({
                      ...dispatchForm,
                      order_source: v,
                      // Auto-set marketplace_order_id to order_id for e-commerce platforms
                      marketplace_order_id: ['amazon', 'flipkart'].includes(v) ? dispatchForm.order_id : ''
                    });
                  }}
                >
                  <SelectTrigger data-testid="order-source-select">
                    <SelectValue placeholder="Select order source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amazon">Amazon</SelectItem>
                    <SelectItem value="flipkart">Flipkart</SelectItem>
                    <SelectItem value="easyship">Easyship</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="walkin">Walk-in</SelectItem>
                    <SelectItem value="direct">Direct Sale</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <p className="font-mono text-[11px] text-muted-foreground">
                  Used for reconciliation with e-commerce payout statements
                </p>
              </div>
            )}

            {/* Marketplace Order ID - Show for Amazon/Flipkart */}
            {dispatchForm.firm_id && ['amazon', 'flipkart'].includes(dispatchForm.order_source) && (
              <div className="space-y-2">
                <Label>Marketplace Order ID</Label>
                <Input
                  placeholder="External order ID from Amazon/Flipkart (for reconciliation)"
                  value={dispatchForm.marketplace_order_id}
                  onChange={(e) => setDispatchForm({...dispatchForm, marketplace_order_id: e.target.value.trim()})}
                  className="font-mono"
                  data-testid="marketplace-order-id-input"
                />
                <p className="font-mono text-[11px] text-muted-foreground">
                  This ID will be used to match with payout statements. Leave blank to use Order ID.
                </p>
              </div>
            )}

            {/* Pending Fulfillment Entry Selection */}
            {dispatchForm.dispatch_source === 'pending_fulfillment' && pendingFulfillmentEntries.length > 0 && (
              <div className="space-y-2">
                <Label>Select Pending Fulfillment Order *</Label>
                <Select
                  value={dispatchForm.pending_fulfillment_id}
                  onValueChange={async (v) => {
                    const entry = pendingFulfillmentEntries.find(e => e.id === v);
                    if (entry) {
                      // Get items from entry - support both multi-item and single-item
                      const items = entry.items || [];
                      const hasMultipleItems = items.length > 1;

                      // For backward compatibility with single-item entries
                      const firstItem = items[0] || {
                        master_sku_id: entry.master_sku_id,
                        master_sku_name: entry.master_sku_name,
                        sku_code: entry.sku_code,
                        quantity: entry.quantity
                      };

                      // Check if any item is manufactured and calculate total serial numbers needed
                      const manufacturedItems = items.filter(item => item.is_manufactured);
                      const hasManufacturedItems = manufacturedItems.length > 0;

                      // Calculate total serial numbers needed (sum of quantities for manufactured items)
                      let totalSerialsNeeded = 0;
                      manufacturedItems.forEach(item => {
                        totalSerialsNeeded += item.quantity || 1;
                      });

                      // Detect order source based on order_id pattern
                      let detectedOrderSource = '';
                      const orderId = entry.order_id || '';
                      if (orderId.match(/^\d{3}-\d{7}-\d{7}$/)) {
                        detectedOrderSource = 'amazon';  // Amazon order format
                      } else if (orderId.toLowerCase().includes('flipkart') || orderId.match(/^OD\d+$/)) {
                        detectedOrderSource = 'flipkart';
                      } else if (orderId.toLowerCase().includes('easyship')) {
                        detectedOrderSource = 'easyship';
                      }

                      setDispatchForm({
                        ...dispatchForm,
                        pending_fulfillment_id: v,
                        order_id: entry.order_id,
                        tracking_id: entry.tracking_id,
                        customer_name: entry.customer_name || '',
                        phone: entry.customer_phone || '',
                        order_source: detectedOrderSource,
                        sku: firstItem.sku_code,
                        sku_code_input: firstItem.sku_code,
                        master_sku_id: firstItem.master_sku_id,
                        master_sku_name: firstItem.master_sku_name,
                        item_type: 'master_sku',
                        is_manufactured: false, // Will handle via itemSerials
                        serial_number: '',
                        items: items,
                        has_multiple_items: hasMultipleItems,
                        has_manufactured_items: hasManufacturedItems,
                        total_serials_needed: totalSerialsNeeded
                      });

                      // Fetch serial numbers for each manufactured item
                      // Create serial slots based on quantity (e.g., qty 3 = 3 serial slots)
                      if (hasManufacturedItems) {
                        const newItemSerials = {};
                        const headers = { Authorization: `Bearer ${token}` };

                        let serialSlotIndex = 0;
                        for (let i = 0; i < items.length; i++) {
                          const item = items[i];
                          if (item.is_manufactured) {
                            const itemQty = item.quantity || 1;
                            try {
                              const serialsRes = await axios.get(
                                `${API}/finished-good-serials`,
                                { headers, params: { master_sku_id: item.master_sku_id, firm_id: dispatchForm.firm_id, status: 'in_stock' } }
                              );
                              const availableSerials = serialsRes.data || [];

                              // Create a serial slot for each unit of this item
                              for (let q = 0; q < itemQty; q++) {
                                newItemSerials[serialSlotIndex] = {
                                  serials: availableSerials,
                                  selected: '',
                                  itemIndex: i,
                                  unitIndex: q + 1, // 1-based for display
                                  master_sku_id: item.master_sku_id,
                                  master_sku_name: item.master_sku_name,
                                  sku_code: item.sku_code
                                };
                                serialSlotIndex++;
                              }
                            } catch (err) {
                              console.error(`Failed to fetch serials for item ${i}:`, err);
                              for (let q = 0; q < itemQty; q++) {
                                newItemSerials[serialSlotIndex] = {
                                  serials: [],
                                  selected: '',
                                  itemIndex: i,
                                  unitIndex: q + 1,
                                  master_sku_id: item.master_sku_id,
                                  master_sku_name: item.master_sku_name,
                                  sku_code: item.sku_code
                                };
                                serialSlotIndex++;
                              }
                            }
                          }
                        }
                        setItemSerials(newItemSerials);
                        setAvailableSerials([]); // Clear old single-item serials
                      } else {
                        setItemSerials({});
                        setAvailableSerials([]);
                      }

                      setSkuLookupResult({
                        found: true,
                        can_dispatch: true,
                        item_type: 'master_sku',
                        master_sku: { id: firstItem.master_sku_id, name: firstItem.master_sku_name, sku_code: firstItem.sku_code },
                        current_stock: entry.current_stock || firstItem.current_stock,
                        stock_message: hasMultipleItems
                          ? `✓ ${items.length} items ready for dispatch`
                          : `✓ Stock available: ${entry.current_stock || firstItem.current_stock} units`
                      });
                    }
                  }}
                >
                  <SelectTrigger data-testid="pending-fulfillment-select" className={!dispatchForm.pending_fulfillment_id ? 'border-cyan-400' : ''}>
                    <SelectValue placeholder="Select an order from the queue" />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingFulfillmentEntries.map(entry => {
                      const items = entry.items || [];
                      const itemCount = items.length || 1;
                      const itemsDisplay = items.length > 0
                        ? items.map(i => `${i.sku_code || i.master_sku_name} x${i.quantity}`).join(', ')
                        : entry.master_sku_name;
                      return (
                        <SelectItem key={entry.id} value={entry.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{entry.order_id}</span>
                            <span className="text-muted-foreground">|</span>
                            <span className="text-sky-400 font-mono text-xs">{entry.tracking_id}</span>
                            {itemCount > 1 && (
                              <Badge className="bg-violet-400/15 text-violet-400 text-xs">{itemCount} items</Badge>
                            )}
                            <span className="text-muted-foreground">|</span>
                            <span className="text-muted-foreground text-xs truncate max-w-[200px]">{itemsDisplay}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {dispatchForm.pending_fulfillment_id && (
                  <div className="p-3 bg-sky-400/[0.07] border border-sky-400/25 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Order ID:</span>{' '}
                        <span className="font-mono font-medium text-foreground">{dispatchForm.order_id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tracking ID:</span>{' '}
                        <span className="font-mono text-sky-400 font-medium">{dispatchForm.tracking_id}</span>
                      </div>
                    </div>

                    {/* Display all items for multi-item entries */}
                    {dispatchForm.items && dispatchForm.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-sky-400/20">
                        <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                          Items to Dispatch ({dispatchForm.items.length}):
                        </p>
                        <div className="space-y-2">
                          {dispatchForm.items.map((item, idx) => (
                            <div key={idx} className={`text-sm bg-card p-3 rounded border ${item.is_manufactured ? 'border-violet-400/25' : 'border-sky-400/20'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-foreground">{item.master_sku_name}</span>
                                  <span className="text-muted-foreground">|</span>
                                  <span className="font-mono text-xs text-muted-foreground">{item.sku_code}</span>
                                  {item.is_manufactured && (
                                    <Badge className="bg-violet-400/15 text-violet-400 text-xs">
                                      <Package className="w-3 h-3 mr-1" />
                                      Manufactured
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-muted text-muted-foreground">Qty: {item.quantity}</Badge>
                                  {item.current_stock !== undefined && (
                                    <span className="font-mono text-xs text-emerald-500">Stock: {item.current_stock}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Serial Number Selection Section - Shows all slots based on quantity */}
                        {dispatchForm.has_manufactured_items && Object.keys(itemSerials).length > 0 && (
                          <div className="mt-3 p-3 bg-violet-400/[0.07] border border-violet-400/25 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-violet-400 font-medium flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                Serial Number Selection (Required for Manufactured Items)
                              </Label>
                              <Badge className={`text-[10px] font-mono ${Object.values(itemSerials).filter(s => s.selected).length === Object.keys(itemSerials).length ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-400/15 text-amber-400'}`}>
                                {Object.values(itemSerials).filter(s => s.selected).length} of {Object.keys(itemSerials).length} selected
                              </Badge>
                            </div>

                            <div className="space-y-2">
                              {Object.entries(itemSerials).map(([slotIndex, slotData]) => {
                                // Get already selected serials in other slots to filter them out
                                const selectedInOtherSlots = Object.entries(itemSerials)
                                  .filter(([idx]) => idx !== slotIndex)
                                  .map(([, data]) => data.selected)
                                  .filter(Boolean);

                                const availableForThisSlot = slotData.serials.filter(
                                  s => !selectedInOtherSlots.includes(s.serial_number)
                                );

                                return (
                                  <div key={slotIndex} className="p-2 bg-card border border-violet-400/20 rounded">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-mono text-[11px] text-violet-400">
                                        Unit {slotData.unitIndex} — {slotData.sku_code || slotData.master_sku_name}
                                      </span>
                                      {slotData.selected && (
                                        <span className="font-mono text-[11px] text-emerald-500 flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3" />
                                          {slotData.selected}
                                        </span>
                                      )}
                                    </div>
                                    <Select
                                      value={slotData.selected}
                                      onValueChange={(v) => {
                                        setItemSerials(prev => ({
                                          ...prev,
                                          [slotIndex]: { ...prev[slotIndex], selected: v }
                                        }));
                                      }}
                                    >
                                      <SelectTrigger
                                        className={`h-9 ${!slotData.selected ? 'border-amber-400/50' : 'border-emerald-500/50'}`}
                                        data-testid={`serial-select-slot-${slotIndex}`}
                                      >
                                        <SelectValue placeholder={`Select serial for Unit ${slotData.unitIndex}`} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableForThisSlot.length > 0 ? (
                                          availableForThisSlot.map(serial => (
                                            <SelectItem key={serial.id || serial.serial_number} value={serial.serial_number}>
                                              {serial.serial_number} {serial.notes && `(${serial.notes})`}
                                            </SelectItem>
                                          ))
                                        ) : (
                                          <SelectItem value="_none" disabled>No more serials available</SelectItem>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                );
                              })}
                            </div>

                            {Object.values(itemSerials).filter(s => s.selected).length < Object.keys(itemSerials).length && (
                              <p className="mt-2 font-mono text-[11px] text-amber-400">
                                Please select serial numbers for all {Object.keys(itemSerials).length} units before dispatching
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Single item display for backward compatibility */}
                    {(!dispatchForm.items || dispatchForm.items.length === 0) && (
                      <>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Product:</span>{' '}
                            <span className="font-medium text-foreground">{dispatchForm.master_sku_name}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">SKU:</span>{' '}
                            <span className="font-mono text-foreground">{dispatchForm.sku}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SKU Lookup - Only for ready in stock dispatch */}
            {dispatchForm.dispatch_source === 'ready_in_stock' && (
            <div className="space-y-2">
              <Label>Product SKU Code * {!dispatchForm.firm_id && <span className="font-mono text-[10px] text-muted-foreground">(Select firm first)</span>}</Label>

              {/* Manual SKU Code Input with Lookup */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Enter SKU code or alias (e.g., MG-INV-1000, AMZ-INV-001)"
                    value={dispatchForm.sku_code_input}
                    onChange={(e) => setDispatchForm({...dispatchForm, sku_code_input: e.target.value.toUpperCase()})}
                    disabled={!dispatchForm.firm_id}
                    className="font-mono"
                    data-testid="sku-code-input"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => lookupSKUCode(dispatchForm.sku_code_input, dispatchForm.firm_id)}
                  disabled={!dispatchForm.firm_id || !dispatchForm.sku_code_input || skuLookupLoading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {skuLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {/* SKU Lookup Result */}
              {skuLookupResult && (
                <div className={`p-3 rounded-lg border ${
                  skuLookupResult.found && skuLookupResult.can_dispatch
                    ? 'bg-emerald-500/10 border-emerald-500/25'
                    : skuLookupResult.found && !skuLookupResult.can_dispatch
                    ? 'bg-amber-400/10 border-amber-400/25'
                    : 'bg-rose-500/10 border-rose-500/25'
                }`}>
                  <div className="flex items-start gap-2">
                    {skuLookupResult.found && skuLookupResult.can_dispatch ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                    ) : skuLookupResult.found ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 mt-0.5" />
                    )}
                    <div className="flex-1">
                      {skuLookupResult.found ? (
                        <>
                          <div className="font-medium text-foreground flex items-center flex-wrap gap-2">
                            <span>
                              {skuLookupResult.item_type === 'master_sku'
                                ? skuLookupResult.master_sku?.name
                                : skuLookupResult.raw_material?.name}
                            </span>
                            {skuLookupResult.matched_by === 'alias' && (
                              <Badge className="bg-violet-400/15 text-violet-400 text-[10px] font-mono">
                                Alias: {skuLookupResult.matched_alias?.alias_code}
                              </Badge>
                            )}
                            <Badge className={skuLookupResult.item_type === 'raw_material' ? 'bg-rose-500/15 text-rose-400 text-[10px] font-mono' : 'bg-sky-400/15 text-sky-400 text-[10px] font-mono'}>
                              {skuLookupResult.item_type === 'raw_material' ? 'Raw Material' : 'Master SKU'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground font-mono tabular-nums">
                            SKU: {skuLookupResult.item_type === 'master_sku'
                              ? skuLookupResult.master_sku?.sku_code
                              : skuLookupResult.raw_material?.sku_code}
                          </p>
                          <p className={`text-sm mt-1 font-mono ${skuLookupResult.can_dispatch ? 'text-emerald-500' : 'text-amber-400'}`}>
                            {skuLookupResult.stock_message}
                          </p>
                          {!skuLookupResult.can_dispatch && (
                            <p className="font-mono text-[11px] text-amber-400 mt-1">
                              Go to Inventory page to Transfer, Produce, or Purchase stock
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-rose-400 font-mono text-sm">{skuLookupResult.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Or select from available SKUs with stock */}
              {dispatchForm.firm_id && skus.length > 0 && !skuLookupResult?.found && (
                <div className="mt-3">
                  <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1 block">Or select from available Master SKUs with stock:</Label>
                  <Select
                    value={dispatchForm.master_sku_id}
                    onValueChange={async (v) => {
                      const selected = skus.find(s => s.id === v);
                      if (selected) {
                        const isManufactured = selected.product_type === 'manufactured';
                        setDispatchForm({
                          ...dispatchForm,
                          sku: selected.sku_code,
                          item_type: 'master_sku',
                          master_sku_id: selected.id,
                          raw_material_id: '',
                          master_sku_name: selected.name,
                          sku_code_input: selected.sku_code,
                          is_manufactured: isManufactured,
                          serial_number: ''
                        });
                        setSkuLookupResult({
                          found: true,
                          can_dispatch: true,
                          item_type: 'master_sku',
                          master_sku: selected,
                          current_stock: selected.current_stock,
                          stock_message: `✓ Stock available: ${selected.current_stock} units`
                        });

                        // If manufactured, fetch available serial numbers
                        if (isManufactured) {
                          try {
                            const headers = { Authorization: `Bearer ${token}` };
                            const serialsRes = await axios.get(
                              `${API}/finished-good-serials`,
                              { headers, params: { master_sku_id: selected.id, firm_id: dispatchForm.firm_id, status: 'in_stock' } }
                            );
                            setAvailableSerials(serialsRes.data || []);
                          } catch (err) {
                            console.error('Failed to fetch serials:', err);
                            setAvailableSerials([]);
                          }
                        } else {
                          setAvailableSerials([]);
                        }
                      }
                    }}
                  >
                    <SelectTrigger data-testid="sku-dropdown">
                      <SelectValue placeholder="Choose from available products" />
                    </SelectTrigger>
                    <SelectContent>
                      {skus.map(sku => (
                        <SelectItem key={sku.id} value={sku.id}>
                          {sku.name} ({sku.sku_code}) - Stock: {sku.current_stock}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {dispatchForm.firm_id && skus.length === 0 && !skuLookupResult && (
                <div className="bg-amber-400/10 border border-amber-400/25 p-3 rounded-lg mt-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <p className="font-mono text-[11px] text-amber-400">No SKUs with stock at this firm. Enter a SKU code above to check, or go to Inventory to add stock.</p>
                  </div>
                </div>
              )}

              {/* Serial Number Selection for Manufactured Items - Only for ready_in_stock single item dispatch */}
              {dispatchForm.dispatch_source === 'ready_in_stock' && dispatchForm.is_manufactured && (
                <div className="mt-4 p-3 bg-violet-400/[0.07] border border-violet-400/25 rounded-lg">
                  <Label className="text-violet-400 font-medium flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Serial Number Selection (Required for Manufactured Items)
                  </Label>
                  {availableSerials.length > 0 ? (
                    <>
                      {availableSerials.length <= 5 ? (
                        // Simple dropdown for small list
                        <Select
                          value={dispatchForm.serial_number}
                          onValueChange={(v) => setDispatchForm({...dispatchForm, serial_number: v})}
                        >
                          <SelectTrigger className={`mt-2 ${!dispatchForm.serial_number ? 'border-amber-400/50' : 'border-emerald-500/50'}`} data-testid="serial-select">
                            <SelectValue placeholder="Select a serial number" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSerials.map(serial => (
                              <SelectItem key={serial.id} value={serial.serial_number}>
                                {serial.serial_number} {serial.notes && `(${serial.notes})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        // Table-based selection for larger lists
                        <div className="mt-2 border border-violet-400/25 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                          <div className="overflow-x-auto"><table className="w-full text-sm">
                            <thead className="bg-violet-400/[0.07] sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wide text-violet-400">Select</th>
                                <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wide text-violet-400">Serial Number</th>
                                <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wide text-violet-400">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {availableSerials.map(serial => (
                                <tr
                                  key={serial.id}
                                  className={`cursor-pointer hover:bg-accent/40 ${dispatchForm.serial_number === serial.serial_number ? 'bg-violet-400/10' : ''}`}
                                  onClick={() => setDispatchForm({...dispatchForm, serial_number: serial.serial_number})}
                                  data-testid={`serial-row-${serial.serial_number}`}
                                >
                                  <td className="px-3 py-2">
                                    <input
                                      type="radio"
                                      checked={dispatchForm.serial_number === serial.serial_number}
                                      onChange={() => setDispatchForm({...dispatchForm, serial_number: serial.serial_number})}
                                      className="w-4 h-4 accent-violet-400"
                                    />
                                  </td>
                                  <td className="px-3 py-2 font-mono text-sm tabular-nums text-foreground">{serial.serial_number}</td>
                                  <td className="px-3 py-2 text-muted-foreground text-xs">{serial.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table></div>
                        </div>
                      )}
                      {dispatchForm.serial_number && (
                        <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/25 rounded flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="font-mono text-[11px] text-emerald-500">Selected: {dispatchForm.serial_number}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-2 p-2 bg-rose-500/10 border border-rose-500/25 rounded text-rose-400 text-sm">
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      No serial numbers available in stock. Complete a production request first to get serial numbers.
                    </div>
                  )}
                  <p className="font-mono text-[11px] text-violet-400 mt-2">
                    Available: {availableSerials.length} serial number(s) in stock
                  </p>
                </div>
              )}
            </div>
            )}

            {/* Serial Number Selection for Pending Fulfillment with Manufactured Items */}
            {dispatchForm.dispatch_source === 'pending_fulfillment' && dispatchForm.is_manufactured && (
              <div className="p-3 bg-violet-400/[0.07] border border-violet-400/25 rounded-lg">
                <Label className="text-violet-400 font-medium flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Serial Number Selection (Required for Manufactured Items)
                </Label>
                {availableSerials.length > 0 ? (
                  <Select
                    value={dispatchForm.serial_number}
                    onValueChange={(v) => setDispatchForm({...dispatchForm, serial_number: v})}
                  >
                    <SelectTrigger className={`mt-2 ${!dispatchForm.serial_number ? 'border-amber-400/50' : 'border-emerald-500/50'}`} data-testid="pf-serial-select">
                      <SelectValue placeholder="Select a serial number" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSerials.map(serial => (
                        <SelectItem key={serial.id} value={serial.serial_number}>
                          {serial.serial_number} {serial.notes && `(${serial.notes})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-2 p-2 bg-rose-500/10 border border-rose-500/25 rounded text-rose-400 text-sm">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    No serial numbers available in stock.
                  </div>
                )}
                {dispatchForm.serial_number && (
                  <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/25 rounded flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="font-mono text-[11px] text-emerald-500">Selected: {dispatchForm.serial_number}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Order ID *
                  {dispatchForm.order_source === 'amazon' && <span className="font-mono text-[10px] text-sky-400">(Auto-fills customer info)</span>}
                  {dispatchForm.dispatch_source === 'pending_fulfillment' && dispatchForm.order_id && (
                    <span className="font-mono text-[10px] text-emerald-500 ml-1">(Auto-filled)</span>
                  )}
                </Label>
                <Input
                  placeholder="e.g., AMZ-123456"
                  value={dispatchForm.order_id}
                  onChange={(e) => setDispatchForm({...dispatchForm, order_id: e.target.value})}
                  onBlur={() => {
                    // Auto-lookup Amazon order when order_id is entered and source is Amazon
                    if (dispatchForm.order_source === 'amazon' && dispatchForm.order_id) {
                      lookupAmazonOrder(dispatchForm.order_id, dispatchForm.firm_id);
                    }
                  }}
                  required
                  disabled={dispatchForm.dispatch_source === 'pending_fulfillment'}
                  data-testid="order-id-input"
                />
                {dispatchForm.order_source === 'amazon' && dispatchForm.dispatch_source !== 'pending_fulfillment' && (
                  <p className="font-mono text-[11px] text-sky-400">Amazon order data will be auto-filled when available</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  Tracking ID
                  {dispatchForm.dispatch_source === 'pending_fulfillment' && dispatchForm.tracking_id ? (
                    <span className="font-mono text-[10px] text-emerald-500 ml-1">(Auto-filled)</span>
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground ml-1">(Optional)</span>
                  )}
                </Label>
                <Input
                  placeholder="e.g., TRK-123456789"
                  value={dispatchForm.tracking_id || ''}
                  onChange={(e) => setDispatchForm({...dispatchForm, tracking_id: e.target.value})}
                  disabled={dispatchForm.dispatch_source === 'pending_fulfillment'}
                  className="font-mono"
                  data-testid="tracking-id-input"
                />
                {dispatchForm.dispatch_source === 'ready_in_stock' && (
                  <p className="font-mono text-[11px] text-muted-foreground">Enter if you already have a tracking ID, otherwise leave blank and upload label later</p>
                )}
              </div>
            </div>

            {/* Auto-filled info banner for pending fulfillment */}
            {dispatchForm.dispatch_source === 'pending_fulfillment' && dispatchForm.pending_fulfillment_id && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-500 font-mono text-[11px] font-semibold uppercase tracking-wide mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Fields auto-filled from Pending Fulfillment Queue
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-emerald-500/80">
                  {dispatchForm.order_id && <span>Order ID: {dispatchForm.order_id}</span>}
                  {dispatchForm.tracking_id && <span>Tracking ID: {dispatchForm.tracking_id}</span>}
                  {dispatchForm.customer_name && <span>Customer: {dispatchForm.customer_name}</span>}
                  {dispatchForm.phone && <span>Phone: {dispatchForm.phone}</span>}
                </div>
                {dispatchForm.order_source === 'amazon' && (
                  <div className="mt-2 font-mono text-[11px] text-sky-400">
                    Amazon order detected — Payment reference not required
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Payment Reference - only show for non-marketplace orders */}
              {!['amazon', 'flipkart', 'easyship'].includes(dispatchForm.order_source) && dispatchForm.dispatch_source !== 'pending_fulfillment' ? (
                <div className="space-y-2">
                  <Label>Payment Reference *</Label>
                  <Input
                    placeholder="e.g., TXN-789012"
                    value={dispatchForm.payment_reference}
                    onChange={(e) => setDispatchForm({...dispatchForm, payment_reference: e.target.value})}
                    required
                    data-testid="payment-ref-input"
                  />
                </div>
              ) : dispatchForm.dispatch_source === 'pending_fulfillment' ? (
                <div className="space-y-2">
                  <Label className="text-emerald-500 font-mono text-[11px] uppercase tracking-wide">Payment Status</Label>
                  <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/25 rounded-md">
                    <span className="font-mono text-[11px] text-emerald-500">
                      Payment handled via Pending Fulfillment Queue
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-amber-400 font-mono text-[11px] uppercase tracking-wide">Payment Status</Label>
                  <div className="flex items-center gap-2 p-2 bg-amber-400/10 border border-amber-400/25 rounded-md">
                    <span className="font-mono text-[11px] text-amber-400">
                      Marketplace orders are marked as <strong>Unpaid</strong> until reconciled with statement.
                    </span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Invoice / Delivery Challan *</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDispatchForm({...dispatchForm, invoice_file: e.target.files[0]})}
                  required
                  data-testid="invoice-file-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Customer Name *
                  {dispatchForm.dispatch_source === 'pending_fulfillment' && dispatchForm.customer_name && (
                    <span className="font-mono text-[10px] text-emerald-500 ml-1">(Auto-filled)</span>
                  )}
                </Label>
                <Input
                  value={dispatchForm.customer_name}
                  onChange={(e) => setDispatchForm({...dispatchForm, customer_name: e.target.value})}
                  required
                  placeholder="Customer name"
                  data-testid="customer-name-input"
                />
              </div>
              {/* Phone field - Hidden for Easyship orders */}
              {dispatchForm.order_source !== 'easyship' ? (
                <div className="space-y-2">
                  <Label>
                    Phone * <span className="font-mono text-[10px] text-muted-foreground">(10 digits)</span>
                    {dispatchForm.dispatch_source === 'pending_fulfillment' && dispatchForm.phone && (
                      <span className="font-mono text-[10px] text-emerald-500 ml-1">(Auto-filled)</span>
                    )}
                  </Label>
                  <Input
                    value={dispatchForm.phone}
                    onChange={(e) => {
                      // Allow only digits
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setDispatchForm({...dispatchForm, phone: value});
                    }}
                    placeholder="10 digit mobile number"
                    maxLength={10}
                    required
                    className={dispatchForm.phone && dispatchForm.phone.length !== 10 ? 'border-orange-400' : ''}
                    data-testid="phone-input"
                  />
                  {dispatchForm.phone && dispatchForm.phone.length !== 10 && (
                    <p className="font-mono text-[11px] text-amber-400">Phone must be exactly 10 digits ({dispatchForm.phone.length}/10)</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Phone</Label>
                  <div className="flex items-center gap-2 p-2 bg-muted border border-border rounded-md font-mono text-[11px] text-muted-foreground">
                    Phone not required for Easyship orders
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Address *</Label>
                <Textarea
                  value={dispatchForm.address}
                  onChange={(e) => setDispatchForm({...dispatchForm, address: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Customer State * <span className="font-mono text-[10px] text-amber-400">(Required for GST)</span></Label>
                <Select
                  value={dispatchForm.state}
                  onValueChange={(v) => setDispatchForm({...dispatchForm, state: v})}
                >
                  <SelectTrigger
                    data-testid="state-select"
                    className={!dispatchForm.state ? 'border-orange-400' : ''}
                  >
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {INDIAN_STATES.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                placeholder="e.g., New sale, Replacement"
                value={dispatchForm.reason}
                onChange={(e) => setDispatchForm({...dispatchForm, reason: e.target.value})}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDispatchOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[11px] uppercase tracking-wide"
                disabled={actionLoading || (!dispatchForm.master_sku_id && !dispatchForm.raw_material_id) || (skuLookupResult && !skuLookupResult.can_dispatch)}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Create Dispatch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Shipping Label Dialog (for outbound dispatches) */}
      <Dialog open={uploadLabelOpen} onOpenChange={setUploadLabelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Shipping Label - {selectedItem?.dispatch_number}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUploadLabel} className="space-y-4">
            <div className="bg-muted border border-border p-3 rounded-lg space-y-1">
              <p className="font-mono text-[11px] text-foreground"><span className="text-muted-foreground">Customer:</span> <CustomerName name={selectedItem?.customer_name} phone={selectedItem?.phone || selectedItem?.customer_phone} /></p>
              <p className="font-mono text-[11px] text-foreground"><span className="text-muted-foreground">SKU:</span> {selectedItem?.sku || 'N/A'}</p>
              <p className="font-mono text-[11px] text-foreground"><span className="text-muted-foreground">Type:</span> {selectedItem?.dispatch_type}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Courier *</Label>
                <Input
                  placeholder="e.g., Delhivery"
                  value={labelForm.courier}
                  onChange={(e) => setLabelForm({...labelForm, courier: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tracking ID *</Label>
                <Input
                  placeholder="e.g., DEL123456"
                  value={labelForm.tracking_id}
                  onChange={(e) => setLabelForm({...labelForm, tracking_id: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Label File *</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setLabelForm({...labelForm, label_file: e.target.files[0]})}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadLabelOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[11px] uppercase tracking-wide" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload Label
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload PICKUP Label Dialog (for customer to print - Reverse Pickup) */}
      <Dialog open={pickupLabelOpen} onOpenChange={setPickupLabelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedItem?.pickup_label ? 'Re-upload Pickup Label' : 'Upload Pickup Label for Customer'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUploadPickupLabel} className="space-y-4">
            <div className="bg-amber-400/[0.07] border border-amber-400/25 p-3 rounded-lg space-y-1">
              <p className="font-mono text-[11px] text-foreground"><span className="text-amber-400">Ticket:</span> {selectedItem?.ticket_number}</p>
              <p className="font-mono text-[11px] text-foreground"><span className="text-amber-400">Customer:</span> <CustomerName name={selectedItem?.customer_name} phone={selectedItem?.customer_phone || selectedItem?.phone} /></p>
              {selectedItem?.pickup_label ? (
                <div className="mt-2 p-2 bg-amber-400/10 border border-amber-400/30 rounded">
                  <p className="font-mono text-[11px] text-amber-400">
                    Previous label exists (Attempt #{selectedItem?.pickup_attempt || 1})
                  </p>
                  <p className="font-mono text-[10px] text-amber-400/70">
                    Previous: {selectedItem?.pickup_courier} — {selectedItem?.pickup_tracking}
                  </p>
                </div>
              ) : (
                <p className="font-mono text-[11px] text-muted-foreground mt-2">
                  This label will be available for the customer to download and print.
                  Customer will paste it on their package for pickup.
                </p>
              )}
            </div>

            {/* Reason for re-upload - only show if previous label exists */}
            {selectedItem?.pickup_label && (
              <div className="space-y-2">
                <Label>Reason for Re-upload *</Label>
                <Input
                  placeholder="e.g., Courier didn't arrive, label expired, wrong address..."
                  value={pickupForm.reason}
                  onChange={(e) => setPickupForm({...pickupForm, reason: e.target.value})}
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Courier *</Label>
                <Input
                  placeholder="e.g., Delhivery"
                  value={pickupForm.courier}
                  onChange={(e) => setPickupForm({...pickupForm, courier: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tracking ID *</Label>
                <Input
                  placeholder="e.g., DEL123456"
                  value={pickupForm.tracking_id}
                  onChange={(e) => setPickupForm({...pickupForm, tracking_id: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Label File (PDF/Image) *</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setPickupForm({...pickupForm, label_file: e.target.files[0]})}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPickupLabelOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-amber-400/80 hover:bg-amber-400 text-black font-mono text-[11px] uppercase tracking-wide" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {selectedItem?.pickup_label ? 'Re-upload New Label' : 'Upload Pickup Label'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Spare Dispatch Dialog */}
      <Dialog open={spareDispatchOpen} onOpenChange={(open) => {
        setSpareDispatchOpen(open);
        if (!open) {
          setSkus([]);
          setDispatchForm({ ...dispatchForm, sku: '', firm_id: '' });
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Spare Part Dispatch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSpareDispatch} className="space-y-4">
            <div className="bg-primary/[0.07] border border-primary/25 p-3 rounded-lg space-y-1">
              <p className="font-mono text-[11px] text-foreground"><span className="text-primary">Ticket:</span> {selectedItem?.ticket_number}</p>
              <p className="font-mono text-[11px] text-foreground"><span className="text-primary">Customer:</span> <CustomerName name={selectedItem?.customer_name} phone={selectedItem?.customer_phone || selectedItem?.phone} /></p>
              <p className="font-mono text-[11px] text-foreground"><span className="text-primary">Address:</span> {selectedItem?.customer_address}, {selectedItem?.customer_city}</p>
              {selectedItem?.supervisor_sku && (
                <p className="font-mono text-[11px] text-primary mt-1">
                  Supervisor recommended: {selectedItem?.supervisor_sku}
                </p>
              )}
            </div>

            {/* Firm Selection - REQUIRED FIRST */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Select Firm *
                <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold bg-amber-400/15 text-amber-400">Select firm to see available spare parts</span>
              </Label>
              <Select
                value={dispatchForm.firm_id}
                onValueChange={(v) => {
                  setDispatchForm({...dispatchForm, firm_id: v, sku: ''});
                  fetchSparePartsForFirm(v);
                }}
              >
                <SelectTrigger className={!dispatchForm.firm_id ? 'border-orange-400' : ''} data-testid="spare-firm-select">
                  <SelectValue placeholder="Select a firm first" />
                </SelectTrigger>
                <SelectContent>
                  {firms.map(firm => (
                    <SelectItem key={firm.id} value={firm.id}>
                      {firm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SKU Selection - Only after firm is selected */}
            <div className="space-y-2">
              <Label>Select Spare Part *</Label>
              <Select
                value={dispatchForm.sku}
                onValueChange={(v) => setDispatchForm({...dispatchForm, sku: v})}
                disabled={!dispatchForm.firm_id}
              >
                <SelectTrigger data-testid="spare-sku-select">
                  <SelectValue placeholder={dispatchForm.firm_id ? "Choose spare part" : "Select firm first"} />
                </SelectTrigger>
                <SelectContent>
                  {skus.length === 0 && dispatchForm.firm_id ? (
                    <div className="p-3 text-center text-muted-foreground text-sm font-mono">
                      No spare parts in stock at this firm
                    </div>
                  ) : (
                    skus.map(sku => (
                      <SelectItem key={sku.id} value={sku.sku_code}>
                        {sku.name} ({sku.sku_code}) - Stock: {sku.current_stock || 0}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {dispatchForm.firm_id && skus.length === 0 && (
                <p className="font-mono text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/25 p-2 rounded">
                  No spare parts available at this firm. Try a different firm or add stock first.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSpareDispatchOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[11px] uppercase tracking-wide"
                disabled={actionLoading || !dispatchForm.firm_id || !dispatchForm.sku}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Package className="w-4 h-4 mr-2" />}
                Create Dispatch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hardware Decision Dialog - For direct hardware tickets */}
      <Dialog open={hardwareDecisionOpen} onOpenChange={setHardwareDecisionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm font-bold uppercase tracking-wide">
              Make Decision for Hardware Ticket
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              {/* Ticket Info */}
              <div className="bg-amber-400/[0.07] border border-amber-400/25 p-4 rounded-lg">
                <p className="font-mono text-[11px] font-bold text-amber-400 mb-2">Ticket: {selectedItem.ticket_number}</p>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <p><span className="text-amber-400">Customer:</span> <span className="text-foreground"><CustomerName name={selectedItem.customer_name} phone={selectedItem.customer_phone || selectedItem.phone} /></span></p>
                  <p><span className="text-amber-400">Phone:</span> <span className="text-foreground tabular-nums">{selectedItem.customer_phone}</span></p>
                  <p><span className="text-amber-400">Device:</span> <span className="text-foreground">{selectedItem.device_type}</span></p>
                  <p><span className="text-amber-400">City:</span> <span className="text-foreground">{selectedItem.customer_city || '-'}</span></p>
                </div>
              </div>

              {/* Issue Description */}
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Issue</p>
                <p className="text-sm text-foreground">{selectedItem.issue_description}</p>
              </div>

              {/* Support Agent Notes */}
              {selectedItem.agent_notes && (
                <div className="bg-violet-400/[0.07] border border-violet-400/25 p-3 rounded-lg">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-violet-400 mb-1">Support Agent Notes</p>
                  <p className="text-sm text-foreground">{selectedItem.agent_notes}</p>
                </div>
              )}

              {/* Decision Buttons */}
              <div className="border-t border-border pt-4">
                <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-3">Based on the issue, what action should be taken?</p>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    className="h-auto py-4 bg-amber-400/80 hover:bg-amber-400 text-black flex flex-col items-center gap-2"
                    onClick={() => handleHardwareDecision('reverse_pickup')}
                    disabled={actionLoading}
                    data-testid="decision-reverse-pickup"
                  >
                    <ArrowDownToLine className="w-8 h-8" />
                    <span className="font-mono font-bold text-[11px] uppercase tracking-wide">Reverse Pickup</span>
                    <span className="font-mono text-[10px] opacity-70">Get device from customer</span>
                  </Button>
                  <Button
                    className="h-auto py-4 bg-primary hover:bg-primary/90 text-primary-foreground flex flex-col items-center gap-2"
                    onClick={() => handleHardwareDecision('spare_dispatch')}
                    disabled={actionLoading}
                    data-testid="decision-spare-dispatch"
                  >
                    <Package className="w-8 h-8" />
                    <span className="font-mono font-bold text-[11px] uppercase tracking-wide">Spare Dispatch</span>
                    <span className="font-mono text-[10px] opacity-70">Send spare part to customer</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

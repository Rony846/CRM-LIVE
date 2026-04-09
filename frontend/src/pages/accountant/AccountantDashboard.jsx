import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ComplianceAlertBanner from '@/components/compliance/ComplianceAlertBanner';
import StatCard from '@/components/dashboard/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { 
  Package, Truck, FileText, Wrench, Loader2, Upload, 
  Eye, CheckCircle, Send, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Building2,
  Search, AlertTriangle, CheckCircle2, XCircle
} from 'lucide-react';

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

export default function AccountantDashboard() {
  const { token } = useAuth();
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

  // Form states
  const [dispatchForm, setDispatchForm] = useState({
    sku: '', sku_code_input: '', customer_name: '', phone: '', address: '', reason: '', note: '',
    order_id: '', payment_reference: '', invoice_file: null,
    dispatch_type: 'new_order', firm_id: '',
    item_type: '', master_sku_id: '', raw_material_id: '', master_sku_name: '',
    serial_number: '', is_manufactured: false,
    dispatch_source: 'ready_in_stock', // 'ready_in_stock' or 'pending_fulfillment'
    pending_fulfillment_id: '', // ID of selected pending fulfillment entry
    tracking_id: '', // For pending fulfillment - pre-filled
    order_source: '', // amazon, flipkart, website, walkin, other
    marketplace_order_id: '' // External marketplace order ID for reconciliation
  });
  const [availableSerials, setAvailableSerials] = useState([]);
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

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [dispatchRes, ticketsRes, firmsRes] = await Promise.all([
        axios.get(`${API}/dispatches`, { headers }),
        // Use view_as=accountant so admin sees same data as accountant
        axios.get(`${API}/tickets?view_as=accountant`, { headers }),
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
  
  // Hardware Tab: Tickets needing accountant action
  // 1. From Supervisor: supervisor_action = "reverse_pickup" or "spare_dispatch"
  // 2. Direct from Support: status = "hardware_service" with NO supervisor_action (needs decision)
  const hardwareTickets = tickets.filter(t => 
    (t.status === 'hardware_service' || t.status === 'awaiting_label' || t.status === 'label_uploaded') &&
    (t.supervisor_action || t.accountant_decision || t.support_type === 'hardware')
  );
  
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
    // Payment reference is only required for non-marketplace orders
    const isMarketplaceOrder = ['amazon', 'flipkart'].includes(dispatchForm.order_source);
    if (!isMarketplaceOrder && !dispatchForm.payment_reference) {
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
    
    // Validate stock availability (not for pending fulfillment since already validated)
    if (dispatchForm.dispatch_source === 'ready_in_stock' && skuLookupResult && !skuLookupResult.can_dispatch) {
      toast.error('Cannot dispatch: No stock available. Transfer, produce, or purchase first.');
      return;
    }
    
    // For manufactured items, serial number is mandatory
    if (dispatchForm.is_manufactured && !dispatchForm.serial_number) {
      toast.error('Serial number is mandatory for manufactured items');
      return;
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
      formData.append('reason', dispatchForm.reason);
      formData.append('note', dispatchForm.note || '');
      formData.append('order_id', dispatchForm.order_id);
      formData.append('payment_reference', dispatchForm.payment_reference);
      formData.append('invoice_file', dispatchForm.invoice_file);
      
      // Add serial number for manufactured items
      if (dispatchForm.is_manufactured && dispatchForm.serial_number) {
        formData.append('serial_number', dispatchForm.serial_number);
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
        sku: '', sku_code_input: '', customer_name: '', phone: '', address: '', reason: '', note: '',
        order_id: '', payment_reference: '', invoice_file: null, dispatch_type: 'new_order',
        firm_id: '', item_type: '', master_sku_id: '', raw_material_id: '', master_sku_name: '',
        serial_number: '', is_manufactured: false,
        dispatch_source: 'ready_in_stock', pending_fulfillment_id: '', tracking_id: '',
        order_source: '', marketplace_order_id: ''
      });
      setSkus([]); // Reset SKUs
      setSkuLookupResult(null);
      setPendingFulfillmentEntries([]);
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

  if (loading) {
    return (
      <DashboardLayout title="Accountant Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Accountant Dashboard">
      {/* Compliance Alert Banner */}
      <ComplianceAlertBanner />
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6" data-testid="accountant-stats">
        <StatCard title="Reverse Pickup" value={reversePickupTickets.length} icon={ArrowDownToLine} color="orange" />
        <StatCard title="Spare Dispatch" value={spareDispatchTickets.length} icon={Package} color="blue" />
        <StatCard title="Repaired Items" value={repairedTickets.length} icon={Wrench} color="green" />
        <StatCard title="Pending Labels" value={stats?.pending_labels || 0} icon={FileText} color="purple" />
        <StatCard title="Ready to Ship" value={stats?.ready_to_dispatch || 0} icon={Truck} />
      </div>

      {/* Tabs */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-0">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="hardware" data-testid="hardware-tab">
                <Wrench className="w-4 h-4 mr-2" />
                Hardware Queue ({hardwareTickets.length})
              </TabsTrigger>
              <TabsTrigger value="repaired" data-testid="repaired-tab">
                <CheckCircle className="w-4 h-4 mr-2" />
                Repaired ({repairedTickets.length})
              </TabsTrigger>
              <TabsTrigger value="outbound" data-testid="outbound-tab">
                <ArrowUpFromLine className="w-4 h-4 mr-2" />
                Outbound
              </TabsTrigger>
              <TabsTrigger value="labels" data-testid="labels-tab">
                <FileText className="w-4 h-4 mr-2" />
                Upload Labels ({pendingLabelDispatches.length})
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="pt-6">
            {/* ===========================================
                HARDWARE TAB - From Supervisor Decisions
            =========================================== */}
            <TabsContent value="hardware" className="mt-0">
              <div className="mb-4">
                <p className="text-sm text-slate-500">Hardware tickets requiring your action (from Support Agent or Supervisor)</p>
              </div>

              {hardwareTickets.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>No pending hardware tickets!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {hardwareTickets.map((ticket) => (
                    <Card key={ticket.id} className={`border-l-4 ${
                      ticket.supervisor_action === 'spare_dispatch' || ticket.accountant_decision === 'spare_dispatch' ? 'border-l-blue-500 bg-blue-50/30' :
                      ticket.supervisor_action === 'reverse_pickup' || ticket.accountant_decision === 'reverse_pickup' ? 'border-l-orange-500 bg-orange-50/30' :
                      !ticket.supervisor_action && !ticket.accountant_decision ? 'border-l-yellow-500 bg-yellow-50/30' :
                      'border-l-slate-300'
                    }`}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            {/* Header with ticket number and action badge */}
                            <div className="flex items-center gap-3 mb-3">
                              <span className="font-mono text-sm font-bold">{ticket.ticket_number}</span>
                              <StatusBadge status={ticket.status} />
                              {ticket.supervisor_action ? (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                  ticket.supervisor_action === 'spare_dispatch' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-orange-600 text-white'
                                }`}>
                                  {ticket.supervisor_action === 'spare_dispatch' ? 'SEND SPARE PART' : 'REVERSE PICKUP'}
                                </span>
                              ) : ticket.accountant_decision ? (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                  ticket.accountant_decision === 'spare_dispatch' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-orange-600 text-white'
                                }`}>
                                  {ticket.accountant_decision === 'spare_dispatch' ? 'SEND SPARE PART' : 'REVERSE PICKUP'}
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-yellow-500 text-white animate-pulse">
                                  NEEDS DECISION
                                </span>
                              )}
                              {ticket.pickup_label && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                  PICKUP LABEL UPLOADED
                                </span>
                              )}
                            </div>
                            
                            {/* Customer Info Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                              <div>
                                <p className="text-xs text-slate-500">Customer</p>
                                <p className="font-medium">{ticket.customer_name}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Phone</p>
                                <p className="font-mono text-sm">{ticket.customer_phone}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Device</p>
                                <p className="font-medium">{ticket.device_type}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">City</p>
                                <p className="font-medium">{ticket.customer_city || '-'}</p>
                              </div>
                            </div>

                            {/* Issue */}
                            <div className="bg-slate-100 p-3 rounded-lg mb-3">
                              <p className="text-xs text-slate-500 font-medium mb-1">ISSUE</p>
                              <p className="text-sm">{ticket.issue_description}</p>
                            </div>

                            {/* Notes Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {ticket.agent_notes && (
                                <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                                  <p className="text-xs text-purple-600 font-bold mb-1">SUPPORT AGENT NOTES</p>
                                  <p className="text-sm text-purple-800">{ticket.agent_notes}</p>
                                </div>
                              )}
                              {ticket.escalation_notes && (
                                <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                                  <p className="text-xs text-orange-600 font-bold mb-1">ESCALATION NOTES</p>
                                  <p className="text-sm text-orange-800">{ticket.escalation_notes}</p>
                                  {ticket.escalated_by_name && (
                                    <p className="text-xs text-orange-500 mt-1">By: {ticket.escalated_by_name}</p>
                                  )}
                                </div>
                              )}
                              {ticket.supervisor_notes && (
                                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg md:col-span-2">
                                  <p className="text-xs text-blue-600 font-bold mb-1">SUPERVISOR DECISION</p>
                                  <p className="text-sm text-blue-800">{ticket.supervisor_notes}</p>
                                  {ticket.supervisor_sku && (
                                    <p className="text-xs text-blue-600 mt-2 font-medium">Recommended SKU: {ticket.supervisor_sku}</p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Customer Invoice - Important for verification before uploading pickup label */}
                            {ticket.invoice_file && (
                              <div className="bg-cyan-50 border border-cyan-300 p-3 rounded-lg mt-3">
                                <p className="text-xs text-cyan-700 font-bold mb-1">CUSTOMER INVOICE</p>
                                <a 
                                  href={`${API.replace('/api', '')}${ticket.invoice_file}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-cyan-700 hover:text-cyan-900 font-medium text-sm"
                                  data-testid={`view-invoice-${ticket.id}`}
                                >
                                  <FileText className="w-4 h-4" />
                                  View Invoice Document
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="ml-4 flex flex-col items-end gap-2">
                            {/* Show decision buttons for direct hardware tickets without decision */}
                            {!ticket.supervisor_action && !ticket.accountant_decision && ticket.status === 'hardware_service' && (
                              <Button 
                                className="bg-yellow-500 hover:bg-yellow-600"
                                onClick={() => openHardwareDecisionDialog(ticket)}
                                data-testid={`make-decision-${ticket.id}`}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Make Decision
                              </Button>
                            )}
                            {/* Show pickup label button for reverse_pickup decision */}
                            {(ticket.supervisor_action === 'reverse_pickup' || ticket.accountant_decision === 'reverse_pickup') && !ticket.pickup_label && (
                              <Button 
                                className="bg-orange-600 hover:bg-orange-700"
                                onClick={() => openPickupLabelDialog(ticket)}
                                data-testid={`upload-pickup-${ticket.id}`}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Pickup Label
                              </Button>
                            )}
                            {/* Show spare dispatch button */}
                            {(ticket.supervisor_action === 'spare_dispatch' || ticket.accountant_decision === 'spare_dispatch') && (
                              <Button 
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => openSpareDispatchDialog(ticket)}
                                data-testid={`create-spare-${ticket.id}`}
                              >
                                <Package className="w-4 h-4 mr-2" />
                                Create Spare Dispatch
                              </Button>
                            )}
                            {ticket.pickup_label && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-green-600">
                                  ✓ Label sent (Attempt #{ticket.pickup_attempt || 1})
                                </span>
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                  onClick={() => openPickupLabelDialog(ticket)}
                                  data-testid={`reupload-pickup-${ticket.id}`}
                                >
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  Re-upload
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ===========================================
                REPAIRED TAB - Items from Technician
            =========================================== */}
            <TabsContent value="repaired" className="mt-0">
              <div className="mb-4">
                <p className="text-sm text-slate-500">Repaired items ready to be dispatched back to customer</p>
              </div>

              {repairedTickets.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>No repaired items pending</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Repair Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repairedTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="data-row">
                        <TableCell className="font-mono text-sm font-medium">
                          <div>
                            {ticket.ticket_number}
                            {ticket.is_walkin ? (
                              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded ml-2">Walk-in</span>
                            ) : (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-2">CRM</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{ticket.customer_name}</p>
                            <p className="text-xs text-slate-500">{ticket.customer_phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>{ticket.device_type}</TableCell>
                        <TableCell>
                          {ticket.invoice_file ? (
                            <a 
                              href={`${API.replace('/api', '')}${ticket.invoice_file}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                              data-testid={`view-invoice-${ticket.id}`}
                            >
                              <FileText className="w-3 h-3" />
                              View
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="bg-green-50 p-2 rounded text-sm text-green-800">
                            {ticket.repair_notes || 'Repair completed'}
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge status={ticket.status} /></TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleCreateReturnDispatch(ticket)}
                            disabled={actionLoading}
                            data-testid={`return-dispatch-${ticket.id}`}
                          >
                            <Truck className="w-4 h-4 mr-2" />
                            Create Return Dispatch
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* ===========================================
                OUTBOUND TAB - New Orders / Spare Parts
            =========================================== */}
            <TabsContent value="outbound" className="mt-0">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-slate-500">Create new outbound dispatch (New Order or Spare Part)</p>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setCreateDispatchOpen(true)}
                  data-testid="create-dispatch-btn"
                >
                  <Send className="w-4 h-4 mr-2" />
                  New Outbound Dispatch
                </Button>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="font-medium text-slate-700 mb-2">What is Outbound?</h4>
                <p className="text-sm text-slate-600">
                  Items going OUT from service center to customer:
                </p>
                <ul className="text-sm text-slate-600 mt-2 list-disc list-inside">
                  <li><strong>New Order</strong> - New product being shipped</li>
                  <li><strong>Spare Part</strong> - Replacement part being sent</li>
                  <li><strong>Repaired Item</strong> - Use the "Repaired" tab for this</li>
                </ul>
              </div>
            </TabsContent>

            {/* ===========================================
                LABELS TAB - Upload Shipping Labels
            =========================================== */}
            <TabsContent value="labels" className="mt-0">
              <p className="text-sm text-slate-500 mb-4">Upload shipping labels for outbound dispatches</p>
              {pendingLabelDispatches.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>No dispatches pending labels</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispatch #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Ticket #</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLabelDispatches.map((dispatch) => (
                      <TableRow key={dispatch.id} className="data-row">
                        <TableCell className="font-mono text-sm">{dispatch.dispatch_number}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            dispatch.dispatch_type === 'new_order' ? 'bg-blue-100 text-blue-700' :
                            dispatch.dispatch_type === 'spare_dispatch' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {dispatch.dispatch_type?.replace('_', ' ').toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>{dispatch.customer_name}</TableCell>
                        <TableCell className="font-mono text-sm">{dispatch.sku || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{dispatch.ticket_number || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            onClick={() => openUploadLabelDialog(dispatch)}
                            data-testid={`upload-label-${dispatch.id}`}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Label
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* ===========================================
          DIALOGS
      =========================================== */}

      {/* Create Outbound Dispatch Dialog */}
      <Dialog open={createDispatchOpen} onOpenChange={(open) => {
        setCreateDispatchOpen(open);
        if (!open) {
          setSkus([]); // Reset SKUs when dialog closes
          setSkuLookupResult(null);
          setPendingFulfillmentEntries([]);
          setDispatchForm({
            sku: '', sku_code_input: '', customer_name: '', phone: '', address: '', reason: '', note: '',
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
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Required for inventory tracking</span>
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
                    className={dispatchForm.dispatch_source === 'ready_in_stock' ? 'bg-blue-600 hover:bg-blue-700' : ''}
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
                    className={dispatchForm.dispatch_source === 'pending_fulfillment' ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
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
                  <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
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
                  <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
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
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="walkin">Walk-in</SelectItem>
                    <SelectItem value="direct">Direct Sale</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
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
                <p className="text-xs text-slate-500">
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
                      
                      setDispatchForm({
                        ...dispatchForm,
                        pending_fulfillment_id: v,
                        order_id: entry.order_id,
                        tracking_id: entry.tracking_id,
                        sku: firstItem.sku_code,
                        sku_code_input: firstItem.sku_code,
                        master_sku_id: firstItem.master_sku_id,
                        master_sku_name: firstItem.master_sku_name,
                        item_type: 'master_sku',
                        is_manufactured: false,
                        serial_number: '',
                        items: items,
                        has_multiple_items: hasMultipleItems
                      });
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
                            <span className="text-slate-500">|</span>
                            <span className="text-cyan-600 font-mono text-xs">{entry.tracking_id}</span>
                            {itemCount > 1 && (
                              <Badge className="bg-purple-600 text-xs">{itemCount} items</Badge>
                            )}
                            <span className="text-slate-500">|</span>
                            <span className="text-slate-600 text-xs truncate max-w-[200px]">{itemsDisplay}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                
                {dispatchForm.pending_fulfillment_id && (
                  <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">Order ID:</span>{' '}
                        <span className="font-mono font-medium">{dispatchForm.order_id}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Tracking ID:</span>{' '}
                        <span className="font-mono text-cyan-600 font-medium">{dispatchForm.tracking_id}</span>
                      </div>
                    </div>
                    
                    {/* Display all items for multi-item entries */}
                    {dispatchForm.items && dispatchForm.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-cyan-200">
                        <p className="text-sm font-medium text-slate-600 mb-2">
                          Items to Dispatch ({dispatchForm.items.length}):
                        </p>
                        <div className="space-y-1">
                          {dispatchForm.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm bg-white p-2 rounded border border-cyan-100">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.master_sku_name}</span>
                                <span className="text-slate-400">|</span>
                                <span className="font-mono text-xs text-slate-500">{item.sku_code}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-slate-100 text-slate-700">Qty: {item.quantity}</Badge>
                                {item.current_stock !== undefined && (
                                  <span className="text-xs text-green-600">Stock: {item.current_stock}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Single item display for backward compatibility */}
                    {(!dispatchForm.items || dispatchForm.items.length === 0) && (
                      <>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-slate-500">Product:</span>{' '}
                            <span className="font-medium">{dispatchForm.master_sku_name}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">SKU:</span>{' '}
                            <span className="font-mono">{dispatchForm.sku}</span>
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
              <Label>Product SKU Code * {!dispatchForm.firm_id && <span className="text-xs text-slate-500">(Select firm first)</span>}</Label>
              
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
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {skuLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              
              {/* SKU Lookup Result */}
              {skuLookupResult && (
                <div className={`p-3 rounded-lg border ${
                  skuLookupResult.found && skuLookupResult.can_dispatch 
                    ? 'bg-green-50 border-green-200' 
                    : skuLookupResult.found && !skuLookupResult.can_dispatch
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-2">
                    {skuLookupResult.found && skuLookupResult.can_dispatch ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : skuLookupResult.found ? (
                      <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      {skuLookupResult.found ? (
                        <>
                          <div className="font-medium text-slate-800 flex items-center flex-wrap gap-2">
                            <span>
                              {skuLookupResult.item_type === 'master_sku' 
                                ? skuLookupResult.master_sku?.name 
                                : skuLookupResult.raw_material?.name}
                            </span>
                            {skuLookupResult.matched_by === 'alias' && (
                              <Badge className="bg-purple-100 text-purple-700">
                                Alias: {skuLookupResult.matched_alias?.alias_code}
                              </Badge>
                            )}
                            <Badge className={skuLookupResult.item_type === 'raw_material' ? 'bg-pink-100 text-pink-700' : 'bg-cyan-100 text-cyan-700'}>
                              {skuLookupResult.item_type === 'raw_material' ? 'Raw Material' : 'Master SKU'}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 font-mono">
                            SKU: {skuLookupResult.item_type === 'master_sku' 
                              ? skuLookupResult.master_sku?.sku_code 
                              : skuLookupResult.raw_material?.sku_code}
                          </p>
                          <p className={`text-sm mt-1 ${skuLookupResult.can_dispatch ? 'text-green-700' : 'text-orange-700'}`}>
                            {skuLookupResult.stock_message}
                          </p>
                          {!skuLookupResult.can_dispatch && (
                            <p className="text-xs text-orange-600 mt-1">
                              → Go to Inventory page to Transfer, Produce, or Purchase stock
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-red-700">{skuLookupResult.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Or select from available SKUs with stock */}
              {dispatchForm.firm_id && skus.length > 0 && !skuLookupResult?.found && (
                <div className="mt-3">
                  <Label className="text-slate-500 text-xs mb-1 block">Or select from available Master SKUs with stock:</Label>
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
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg mt-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <p className="text-sm text-yellow-700">No SKUs with stock at this firm. Enter a SKU code above to check, or go to Inventory to add stock.</p>
                  </div>
                </div>
              )}
              
              {/* Serial Number Selection for Manufactured Items */}
              {dispatchForm.is_manufactured && (
                <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <Label className="text-purple-700 font-medium flex items-center gap-2">
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
                          <SelectTrigger className={`mt-2 ${!dispatchForm.serial_number ? 'border-orange-400' : ''}`} data-testid="serial-select">
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
                        <div className="mt-2 border border-purple-300 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-purple-100 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-purple-700 font-medium">Select</th>
                                <th className="px-3 py-2 text-left text-purple-700 font-medium">Serial Number</th>
                                <th className="px-3 py-2 text-left text-purple-700 font-medium">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {availableSerials.map(serial => (
                                <tr 
                                  key={serial.id}
                                  className={`cursor-pointer hover:bg-purple-50 ${dispatchForm.serial_number === serial.serial_number ? 'bg-purple-100' : ''}`}
                                  onClick={() => setDispatchForm({...dispatchForm, serial_number: serial.serial_number})}
                                  data-testid={`serial-row-${serial.serial_number}`}
                                >
                                  <td className="px-3 py-2">
                                    <input 
                                      type="radio" 
                                      checked={dispatchForm.serial_number === serial.serial_number}
                                      onChange={() => setDispatchForm({...dispatchForm, serial_number: serial.serial_number})}
                                      className="w-4 h-4 text-purple-600"
                                    />
                                  </td>
                                  <td className="px-3 py-2 font-mono text-purple-800">{serial.serial_number}</td>
                                  <td className="px-3 py-2 text-slate-600 text-xs">{serial.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {dispatchForm.serial_number && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-green-700 text-sm font-medium">Selected: {dispatchForm.serial_number}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      No serial numbers available in stock. Complete a production request first to get serial numbers.
                    </div>
                  )}
                  <p className="text-xs text-purple-600 mt-2">
                    Available: {availableSerials.length} serial number(s) in stock
                  </p>
                </div>
              )}
            </div>
            )}

            {/* Serial Number Selection for Pending Fulfillment with Manufactured Items */}
            {dispatchForm.dispatch_source === 'pending_fulfillment' && dispatchForm.is_manufactured && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <Label className="text-purple-700 font-medium flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Serial Number Selection (Required for Manufactured Items)
                </Label>
                {availableSerials.length > 0 ? (
                  <Select
                    value={dispatchForm.serial_number}
                    onValueChange={(v) => setDispatchForm({...dispatchForm, serial_number: v})}
                  >
                    <SelectTrigger className={`mt-2 ${!dispatchForm.serial_number ? 'border-orange-400' : ''}`} data-testid="pf-serial-select">
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
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    No serial numbers available in stock.
                  </div>
                )}
                {dispatchForm.serial_number && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-green-700 text-sm font-medium">Selected: {dispatchForm.serial_number}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Order ID *</Label>
                <Input 
                  placeholder="e.g., AMZ-123456"
                  value={dispatchForm.order_id}
                  onChange={(e) => setDispatchForm({...dispatchForm, order_id: e.target.value})}
                  required
                  disabled={dispatchForm.dispatch_source === 'pending_fulfillment'}
                  data-testid="order-id-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Tracking ID {dispatchForm.dispatch_source === 'pending_fulfillment' ? '(Auto-filled)' : '(Optional)'}</Label>
                <Input 
                  placeholder="e.g., TRK-123456789"
                  value={dispatchForm.tracking_id || ''}
                  onChange={(e) => setDispatchForm({...dispatchForm, tracking_id: e.target.value})}
                  disabled={dispatchForm.dispatch_source === 'pending_fulfillment'}
                  className="font-mono"
                  data-testid="tracking-id-input"
                />
                {dispatchForm.dispatch_source === 'ready_in_stock' && (
                  <p className="text-xs text-slate-500">Enter if you already have a tracking ID, otherwise leave blank and upload label later</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Payment Reference - only show for non-marketplace orders */}
              {!['amazon', 'flipkart'].includes(dispatchForm.order_source) ? (
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
              ) : (
                <div className="space-y-2">
                  <Label className="text-orange-600">Payment Status</Label>
                  <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
                    <span className="text-sm text-orange-700">
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
                <Label>Customer Name *</Label>
                <Input 
                  value={dispatchForm.customer_name}
                  onChange={(e) => setDispatchForm({...dispatchForm, customer_name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input 
                  value={dispatchForm.phone}
                  onChange={(e) => setDispatchForm({...dispatchForm, phone: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address *</Label>
              <Textarea 
                value={dispatchForm.address}
                onChange={(e) => setDispatchForm({...dispatchForm, address: e.target.value})}
                required
              />
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
                className="bg-blue-600 hover:bg-blue-700" 
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
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm"><strong>Customer:</strong> {selectedItem?.customer_name}</p>
              <p className="text-sm"><strong>SKU:</strong> {selectedItem?.sku || 'N/A'}</p>
              <p className="text-sm"><strong>Type:</strong> {selectedItem?.dispatch_type}</p>
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
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={actionLoading}>
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
            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Ticket:</strong> {selectedItem?.ticket_number}
              </p>
              <p className="text-sm text-orange-800">
                <strong>Customer:</strong> {selectedItem?.customer_name}
              </p>
              {selectedItem?.pickup_label ? (
                <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded">
                  <p className="text-sm text-yellow-800 font-medium">
                    ⚠️ Previous label exists (Attempt #{selectedItem?.pickup_attempt || 1})
                  </p>
                  <p className="text-xs text-yellow-700">
                    Previous: {selectedItem?.pickup_courier} - {selectedItem?.pickup_tracking}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-orange-700 mt-2">
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
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={actionLoading}>
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
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Ticket:</strong> {selectedItem?.ticket_number}
              </p>
              <p className="text-sm text-blue-800">
                <strong>Customer:</strong> {selectedItem?.customer_name}
              </p>
              <p className="text-sm text-blue-800">
                <strong>Address:</strong> {selectedItem?.customer_address}, {selectedItem?.customer_city}
              </p>
              {selectedItem?.supervisor_sku && (
                <p className="text-sm text-blue-600 mt-2">
                  <strong>Supervisor recommended:</strong> {selectedItem?.supervisor_sku}
                </p>
              )}
            </div>
            
            {/* Firm Selection - REQUIRED FIRST */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Select Firm *
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Select firm to see available spare parts</span>
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
                    <div className="p-3 text-center text-slate-500 text-sm">
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
                <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                  No spare parts available at this firm. Try a different firm or add stock first.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSpareDispatchOpen(false)}>Cancel</Button>
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700" 
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
            <DialogTitle className="text-xl font-['Barlow_Condensed']">
              Make Decision for Hardware Ticket
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              {/* Ticket Info */}
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm font-bold text-yellow-800 mb-2">Ticket: {selectedItem.ticket_number}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><span className="text-yellow-600">Customer:</span> {selectedItem.customer_name}</p>
                  <p><span className="text-yellow-600">Phone:</span> {selectedItem.customer_phone}</p>
                  <p><span className="text-yellow-600">Device:</span> {selectedItem.device_type}</p>
                  <p><span className="text-yellow-600">City:</span> {selectedItem.customer_city || '-'}</p>
                </div>
              </div>

              {/* Issue Description */}
              <div className="bg-slate-100 p-3 rounded-lg">
                <p className="text-xs text-slate-500 font-bold mb-1">ISSUE</p>
                <p className="text-sm">{selectedItem.issue_description}</p>
              </div>

              {/* Support Agent Notes */}
              {selectedItem.agent_notes && (
                <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                  <p className="text-xs text-purple-600 font-bold mb-1">SUPPORT AGENT NOTES</p>
                  <p className="text-sm text-purple-800">{selectedItem.agent_notes}</p>
                </div>
              )}

              {/* Decision Buttons */}
              <div className="border-t pt-4">
                <p className="text-sm text-slate-600 mb-3 font-medium">Based on the issue, what action should be taken?</p>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    className="h-auto py-4 bg-orange-600 hover:bg-orange-700 flex flex-col items-center gap-2"
                    onClick={() => handleHardwareDecision('reverse_pickup')}
                    disabled={actionLoading}
                    data-testid="decision-reverse-pickup"
                  >
                    <ArrowDownToLine className="w-8 h-8" />
                    <span className="font-bold">Reverse Pickup</span>
                    <span className="text-xs opacity-80">Get device from customer</span>
                  </Button>
                  <Button
                    className="h-auto py-4 bg-blue-600 hover:bg-blue-700 flex flex-col items-center gap-2"
                    onClick={() => handleHardwareDecision('spare_dispatch')}
                    disabled={actionLoading}
                    data-testid="decision-spare-dispatch"
                  >
                    <Package className="w-8 h-8" />
                    <span className="font-bold">Spare Dispatch</span>
                    <span className="text-xs opacity-80">Send spare part to customer</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

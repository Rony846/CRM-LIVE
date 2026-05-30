import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import {
  Package, Loader2, Search, RefreshCw, Truck, MapPin, Phone,
  AlertTriangle, CheckCircle, Clock, Settings, Link2, ShoppingBag,
  Building2, ArrowRight, History, Calendar, XCircle, RotateCcw, UserPlus
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';

const CARRIERS = [
  { value: 'bluedart', label: 'Blue Dart' },
  { value: 'delhivery', label: 'Delhivery' },
  { value: 'dtdc', label: 'DTDC' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'xpressbees', label: 'XpressBees' },
  { value: 'ecom_express', label: 'Ecom Express' },
  { value: 'shadowfax', label: 'Shadowfax' },
  { value: 'professional_couriers', label: 'Professional Couriers' },
  { value: 'gati', label: 'Gati' },
  { value: 'amazon', label: 'Amazon Logistics' },
  { value: 'other', label: 'Other' }
];

// Indian States with GST codes for proper state matching
const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' }
];

export default function AmazonOrders() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [skuGaps, setSkuGaps] = useState(0); // SKUs missing a shipping weight (admin)
  const [loading, setLoading] = useState(false);
  const [fetchingOrders, setFetchingOrders] = useState(false);
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('');
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [activeTab, setActiveTab] = useState('mfn_pending');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Credentials dialog
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [credentialsConfigured, setCredentialsConfigured] = useState(false);
  const [credentials, setCredentials] = useState({
    lwa_client_id: '',
    lwa_client_secret: '',
    refresh_token: '',
    aws_access_key: '',
    aws_secret_key: '',
    seller_id: '',
    marketplace_id: 'A21TJRUUN4KGV'
  });
  
  // Tracking dialog
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [trackingForm, setTrackingForm] = useState({
    tracking_number: '',
    carrier_code: '',
    // MFN-specific fields (mandatory for MFN, optional for Easy Ship)
    customer_name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });
  
  // Customer details (PII) dialog — Step 1 of the two-step Amazon flow
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [savingCustomerDetails, setSavingCustomerDetails] = useState(false);
  const [scrapingPreview, setScrapingPreview] = useState(false);
  const [lastScrapeMeta, setLastScrapeMeta] = useState(null); // { phone_found_in, needs_review, seller_notes }
  const [customerForm, setCustomerForm] = useState({
    customer_first_name: '',
    customer_last_name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });

  // SKU mapping dialog
  const [skuMappingDialogOpen, setSkuMappingDialogOpen] = useState(false);
  const [unmappedSkus, setUnmappedSkus] = useState([]);
  const [masterSkus, setMasterSkus] = useState([]);
  const [selectedUnmappedSku, setSelectedUnmappedSku] = useState(null);
  const [selectedMasterSku, setSelectedMasterSku] = useState('');
  const [syncing, setSyncing] = useState(false);
  
  // History sync date filter (default to April 1, 2026)
  const [historyStartDate, setHistoryStartDate] = useState(new Date('2026-04-01'));
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [refreshingOrder, setRefreshingOrder] = useState(null);

  // Bulk PII auto-fill (driven by the server-side Browser Agent)
  const [bulkScrapeJob, setBulkScrapeJob] = useState(null); // {state, total, succeeded, failed, needs_review, current_order_id}
  const [startingBulkScrape, setStartingBulkScrape] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchFirms();
  }, []);

  // Count of SKUs missing a shipping weight (these orders get held by the bot).
  useEffect(() => {
    if (user?.role !== 'admin') return;
    axios.get(`${API}/admin/sku-weights/gaps`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setSkuGaps(r.data?.unresolved || 0))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  useEffect(() => {
    if (selectedFirm) {
      checkCredentials();
      fetchOrders();
      fetchMasterSkus();
    }
  }, [selectedFirm]);

  const fetchFirms = async () => {
    try {
      const res = await axios.get(`${API}/firms`, { headers });
      setFirms(res.data || []);
    } catch (error) {
      console.error('Failed to fetch firms:', error);
    }
  };

  const fetchMasterSkus = async () => {
    try {
      const res = await axios.get(`${API}/master-skus`, { headers });
      setMasterSkus(res.data || []);
    } catch (error) {
      console.error('Failed to fetch master SKUs:', error);
    }
  };

  const checkCredentials = async () => {
    try {
      const res = await axios.get(`${API}/amazon/credentials/${selectedFirm}`, { headers });
      setCredentialsConfigured(res.data.configured);
    } catch (error) {
      setCredentialsConfigured(false);
    }
  };

  const fetchOrders = async () => {
    if (!selectedFirm) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/amazon/orders/${selectedFirm}`, { headers });
      setOrders(res.data.orders || []);
      setStats(res.data.stats || {});
      
      // Fetch unmapped SKUs
      const unmappedRes = await axios.get(`${API}/amazon/unmapped-skus/${selectedFirm}`, { headers });
      setUnmappedSkus(unmappedRes.data || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchFromAmazon = async () => {
    if (!selectedFirm) {
      toast.error('Please select a firm first');
      return;
    }
    if (!credentialsConfigured) {
      toast.error('Please configure Amazon credentials first');
      setCredentialsDialogOpen(true);
      return;
    }
    
    setFetchingOrders(true);
    try {
      // Include all relevant order statuses for Easy Ship and MFN
      // PendingAvailability = Easy Ship orders waiting for pickup
      // Pending = Orders pending payment/processing
      const orderStatuses = 'Unshipped,PartiallyShipped,PendingAvailability,Pending';
      const res = await axios.post(
        `${API}/amazon/fetch-orders/${selectedFirm}?order_status=${orderStatuses}&days_back=30`, 
        {}, 
        { headers }
      );
      toast.success(res.data.message);
      
      if (res.data.sku_mapping_required?.length > 0) {
        toast.warning(`${res.data.sku_mapping_required.length} SKUs need mapping`);
      }
      
      await fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to fetch orders from Amazon');
    } finally {
      setFetchingOrders(false);
    }
  };

  const handleSaveCredentials = async () => {
    try {
      await axios.post(`${API}/amazon/credentials?firm_id=${selectedFirm}`, credentials, { headers });
      toast.success('Amazon credentials saved successfully');
      setCredentialsDialogOpen(false);
      setCredentialsConfigured(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save credentials');
    }
  };

  const handleSyncAliases = async () => {
    if (!selectedFirm) return;
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/amazon/sync-alias-mappings?firm_id=${selectedFirm}`, {}, { headers });
      if (res.data.mapped_count > 0) {
        toast.success(`Synced ${res.data.mapped_count} SKU mappings from aliases`);
        await fetchOrders();
        await fetchUnmappedSkus();
      } else {
        toast.info('No new alias mappings found. Add aliases in Master SKU Management.');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sync alias mappings');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncDispatchedStatus = async () => {
    if (!selectedFirm) return;
    setSyncing(true);
    try {
      const res = await axios.put(`${API}/amazon/sync-dispatched-status?firm_id=${selectedFirm}`, {}, { headers });
      if (res.data.updated_count > 0) {
        toast.success(`Synced ${res.data.updated_count} orders to dispatched status`);
        await fetchOrders();
      } else {
        toast.info('All dispatched orders are already synced.');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sync dispatched status');
    } finally {
      setSyncing(false);
    }
  };

  // Sync from Dispatches - finds orders in dispatch queue and auto-adds tracking to Amazon orders
  const handleSyncFromDispatches = async () => {
    if (!selectedFirm) return;
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/amazon/sync-from-dispatches?firm_id=${selectedFirm}`, {}, { headers });
      if (res.data.synced_count > 0) {
        toast.success(`Synced ${res.data.synced_count} orders from dispatches! Tracking IDs auto-added.`);
        await fetchOrders();
      } else {
        toast.info('No matching dispatches found to sync.');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sync from dispatches');
    } finally {
      setSyncing(false);
    }
  };

  // Fetch historical shipped orders from Amazon (orders shipped on Amazon but not in CRM)
  const handleFetchHistoryFromAmazon = async () => {
    if (!selectedFirm) {
      toast.error('Please select a firm first');
      return;
    }
    if (!credentialsConfigured) {
      toast.error('Please configure Amazon credentials first');
      setCredentialsDialogOpen(true);
      return;
    }
    
    setFetchingHistory(true);
    try {
      const dateStr = format(historyStartDate, 'yyyy-MM-dd');
      // Fetch only Shipped orders for history reconciliation
      const res = await axios.post(
        `${API}/amazon/fetch-orders/${selectedFirm}?order_status=Shipped&created_after_date=${dateStr}`, 
        {}, 
        { headers }
      );
      toast.success(res.data.message);
      
      if (res.data.sku_mapping_required?.length > 0) {
        toast.warning(`${res.data.sku_mapping_required.length} SKUs need mapping`);
      }
      
      await fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to fetch historical orders from Amazon');
    } finally {
      setFetchingHistory(false);
    }
  };

  // Refresh order items from Amazon API
  const handleRefreshOrderItems = async (amazonOrderId) => {
    if (!selectedFirm) return;
    setRefreshingOrder(amazonOrderId);
    try {
      const res = await axios.post(
        `${API}/amazon/refresh-order-items/${amazonOrderId}?firm_id=${selectedFirm}`,
        {},
        { headers }
      );
      if (res.data.items_count > 0) {
        toast.success(`Loaded ${res.data.items_count} items for order ${amazonOrderId.substring(0, 15)}...`);
        if (res.data.sku_mapping_required?.length > 0) {
          toast.warning(`${res.data.sku_mapping_required.length} SKU(s) need mapping`);
        }
        await fetchOrders();
      } else {
        toast.info('No items found for this order in Amazon.');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to refresh order items');
    } finally {
      setRefreshingOrder(null);
    }
  };

  const [pushingToAmazon, setPushingToAmazon] = useState(false);

  // Open the PII dialog for an order. Pre-fills from any data we already have:
  //   - saved manual fields (customer_first_name_manual, etc.) if the order was previously captured
  //   - Easy Ship / History orders: pre-fill from Amazon's buyer + shipping_address fields
  const openCustomerDialog = (order) => {
    const shipping = order.shipping_address || {};
    const fullBuyer = (order.customer_name_manual || order.buyer_name || shipping.name || '').trim();
    const nameParts = fullBuyer.split(/\s+/);
    const presetFirst = order.customer_first_name_manual || nameParts[0] || '';
    const presetLast =
      order.customer_last_name_manual ||
      (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');

    setSelectedOrder(order);
    setLastScrapeMeta(null);
    setCustomerForm({
      customer_first_name: presetFirst,
      customer_last_name: presetLast,
      phone: order.phone_manual || order.buyer_phone || shipping.phone || order.phone || '',
      address:
        order.address_manual ||
        shipping.address_line1 ||
        [order.address_line1, order.address_line2].filter(Boolean).join(' ') ||
        '',
      city: order.city_manual || shipping.city || order.city || '',
      state: order.state_manual || shipping.state || order.state || '',
      pincode: order.pincode_manual || shipping.postal_code || order.pincode || '',
    });
    setCustomerDialogOpen(true);
  };

  // Test scrape (dry-run): fetches PII from Seller Central via the browser agent,
  // populates the form fields, but does NOT save. User reviews then clicks Save.
  const handleAutoFillFromAmazon = async () => {
    if (!selectedOrder || !selectedFirm) return;
    setScrapingPreview(true);
    try {
      const res = await axios.post(
        `${API}/amazon/scrape-and-save-pii/${encodeURIComponent(selectedOrder.amazon_order_id)}?firm_id=${selectedFirm}&dry_run=true`,
        {},
        { headers }
      );
      const preview = res.data?.preview || {};
      const scraped = res.data?.scraped || {};
      setCustomerForm({
        customer_first_name: preview.customer_first_name_manual || '',
        customer_last_name: preview.customer_last_name_manual || '',
        phone: preview.needs_phone_review ? '' : (preview.phone_manual || ''),
        address: preview.address_manual || '',
        city: preview.city_manual === 'Unknown' ? '' : (preview.city_manual || ''),
        state: preview.state_manual === 'Unknown' ? '' : (preview.state_manual || ''),
        pincode: preview.pincode_manual === '000000' ? '' : (preview.pincode_manual || ''),
      });
      setLastScrapeMeta({
        phone_found_in: scraped.phone_found_in || 'none',
        needs_review: !!preview.needs_phone_review,
        seller_notes: scraped.seller_notes || '',
        raw_ship_to: scraped.raw_ship_to || '',
      });
      toast.success(
        preview.needs_phone_review
          ? 'Scraped — phone not found, please enter manually'
          : `Scraped — phone found in ${scraped.phone_found_in}`
      );
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Auto-fill failed');
    } finally {
      setScrapingPreview(false);
    }
  };

  const handleSaveCustomerDetails = async () => {
    if (!customerForm.customer_first_name.trim()) {
      toast.error('Customer first name is required');
      return;
    }
    if (!/^\d{10}$/.test(customerForm.phone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    if (!customerForm.city.trim() || !customerForm.state.trim() || !customerForm.pincode.trim()) {
      toast.error('City, State, and Pincode are required');
      return;
    }

    setSavingCustomerDetails(true);
    try {
      await axios.post(
        `${API}/amazon/save-customer-details?firm_id=${selectedFirm}`,
        {
          amazon_order_id: selectedOrder.amazon_order_id,
          customer_first_name: customerForm.customer_first_name.trim(),
          customer_last_name: customerForm.customer_last_name.trim(),
          phone: customerForm.phone,
          address: customerForm.address.trim(),
          city: customerForm.city.trim(),
          state: customerForm.state.trim(),
          pincode: customerForm.pincode.trim(),
        },
        { headers }
      );
      toast.success('Customer details saved. Order moved to Awaiting Tracking.');
      setCustomerDialogOpen(false);
      setSelectedOrder(null);
      await fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save customer details');
    } finally {
      setSavingCustomerDetails(false);
    }
  };

  const handleAddTracking = async (pushToAmazon = false) => {
    const isMFN = selectedOrder && !selectedOrder.is_easy_ship;
    const isHistoryOrder = selectedOrder?.is_history_order;
    // If PII was already captured via the new Step-1 dialog, the backend will reuse it.
    const detailsAlreadyCaptured =
      selectedOrder?.crm_status === 'details_captured' ||
      Boolean(selectedOrder?.phone_manual && selectedOrder?.city_manual);
    const requiresCustomerDetails = (isMFN || isHistoryOrder) && !detailsAlreadyCaptured;

    // Basic validation
    if (!trackingForm.tracking_number || !trackingForm.carrier_code) {
      toast.error('Please fill tracking number and carrier');
      return;
    }

    // MFN and History orders require customer details (unless already captured upstream)
    if (requiresCustomerDetails) {
      if (!trackingForm.customer_name?.trim()) {
        toast.error('Customer Name is required');
        return;
      }
      if (!trackingForm.phone || !/^\d{10}$/.test(trackingForm.phone)) {
        toast.error('Please enter a valid 10-digit phone number');
        return;
      }
      if (!trackingForm.city?.trim() || !trackingForm.state?.trim() || !trackingForm.pincode?.trim()) {
        toast.error('City, State, and Pincode are required');
        return;
      }
    }
    
    try {
      const payload = {
        amazon_order_id: selectedOrder.amazon_order_id,
        tracking_number: trackingForm.tracking_number,
        carrier_code: trackingForm.carrier_code,
        is_history_order: isHistoryOrder || false
      };
      
      // Add customer details for MFN and history orders (only when collected in this dialog)
      if (requiresCustomerDetails) {
        payload.customer_name = trackingForm.customer_name;
        payload.phone = trackingForm.phone;
        payload.address = trackingForm.address;
        payload.city = trackingForm.city;
        payload.state = trackingForm.state;
        payload.pincode = trackingForm.pincode;
      }
      // Note: when PII was previously captured via /amazon/save-customer-details,
      // backend pulls it from the order document automatically.
      
      // Step 1: Save tracking locally
      await axios.post(`${API}/amazon/update-tracking?firm_id=${selectedFirm}`, payload, { headers });
      
      // Step 2: Optionally push to Amazon (but NOT for history orders - already shipped there)
      if (pushToAmazon && !isHistoryOrder) {
        setPushingToAmazon(true);
        try {
          await axios.post(`${API}/amazon/push-tracking?amazon_order_id=${selectedOrder.amazon_order_id}&firm_id=${selectedFirm}`, {}, { headers });
          toast.success('Tracking pushed to Amazon successfully!');
        } catch (pushError) {
          toast.warning(`Tracking saved locally, but push to Amazon failed: ${pushError.response?.data?.detail || 'Unknown error'}`);
        }
        setPushingToAmazon(false);
      }
      
      if (isHistoryOrder) {
        toast.success('Historical order processed! Moved to Pending Dispatch queue.');
      } else {
        toast.success('Tracking added! Order moved to Pending Dispatch queue.');
      }
      setTrackingDialogOpen(false);
      setSelectedOrder(null);
      setTrackingForm({ 
        tracking_number: '', 
        carrier_code: '',
        customer_name: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: ''
      });
      await fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update tracking');
    }
  };
  
  const handlePushToAmazon = async (orderId) => {
    setPushingToAmazon(true);
    try {
      await axios.post(`${API}/amazon/push-tracking?amazon_order_id=${orderId}&firm_id=${selectedFirm}`, {}, { headers });
      toast.success('Tracking pushed to Amazon successfully!');
      await fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to push tracking to Amazon');
    } finally {
      setPushingToAmazon(false);
    }
  };

  const handleMapSku = async () => {
    if (!selectedUnmappedSku || !selectedMasterSku) {
      toast.error('Please select both SKUs');
      return;
    }
    
    try {
      await axios.post(`${API}/amazon/sku-mapping?firm_id=${selectedFirm}`, {
        amazon_sku: selectedUnmappedSku.amazon_sku,
        master_sku_id: selectedMasterSku
      }, { headers });
      
      toast.success(`Mapped ${selectedUnmappedSku.amazon_sku} successfully`);
      setSelectedUnmappedSku(null);
      setSelectedMasterSku('');
      await fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to map SKU');
    }
  };

  const handleMarkCancelled = async (amazonOrderId) => {
    if (!confirm(`Are you sure you want to mark order ${amazonOrderId} as cancelled?`)) {
      return;
    }
    
    try {
      await axios.post(`${API}/amazon/orders/${amazonOrderId}/mark-cancelled`, {
        reason: "Manually cancelled"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Order marked as cancelled');
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel order');
    }
  };

  const handleRestoreOrder = async (amazonOrderId) => {
    try {
      await axios.post(`${API}/amazon/orders/${amazonOrderId}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Order restored to pending');
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to restore order');
    }
  };

  // --- Bulk auto-fill from Amazon Seller Central (via Browser Agent) ---
  const fetchBulkScrapeStatus = async () => {
    if (!selectedFirm) return null;
    try {
      const res = await axios.get(`${API}/amazon/bulk-scrape-status?firm_id=${selectedFirm}`, { headers });
      const job = res.data;
      setBulkScrapeJob(job?.state === 'idle' ? null : job);
      return job;
    } catch (_e) {
      return null;
    }
  };

  // Poll job status while it's running
  useEffect(() => {
    if (!bulkScrapeJob || bulkScrapeJob.state !== 'running') return;
    const id = setInterval(async () => {
      const j = await fetchBulkScrapeStatus();
      if (j && j.state !== 'running') {
        clearInterval(id);
        await fetchOrders();
        if (j.state === 'done') {
          toast.success(
            `Bulk scrape complete: ${j.succeeded} saved, ${j.failed} failed, ${j.needs_review} need phone review.`
          );
        } else if (j.state === 'cancelled') {
          toast.info(`Bulk scrape cancelled after ${j.succeeded + j.failed} orders.`);
        }
      }
    }, 2000);
    return () => clearInterval(id);
  }, [bulkScrapeJob?.state, selectedFirm]);

  // Resume polling if the page is loaded while a job is already running
  useEffect(() => {
    if (selectedFirm) fetchBulkScrapeStatus();
  }, [selectedFirm]);

  const handleStartBulkScrape = async () => {
    if (!selectedFirm) {
      toast.error('Select a firm first');
      return;
    }
    setStartingBulkScrape(true);
    try {
      // Pre-flight: is browser agent started + logged in?
      const statusRes = await axios.get(`${API}/browser-agent/status`, { headers });
      const agentState = statusRes.data?.state;
      if (!agentState || agentState === 'not_initialized' || agentState === 'stopped' || agentState === 'idle') {
        toast.error('Browser Agent is not running. Open Admin → Browser Agent and start it, then sign in to Seller Central.');
        return;
      }
      if (agentState !== 'logged_in' && agentState !== 'processing') {
        // Try one live check before giving up
        const ck = await axios.post(`${API}/browser-agent/check-login`, {}, { headers });
        if (!ck.data?.logged_in) {
          toast.error('Browser Agent is not logged in to Seller Central. Sign in via Admin → Browser Agent first.');
          return;
        }
      }
      const res = await axios.post(
        `${API}/amazon/bulk-scrape-mfn-pending?firm_id=${selectedFirm}`,
        {},
        { headers }
      );
      toast.success(res.data.message || 'Bulk scrape started');
      await fetchBulkScrapeStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start bulk scrape');
    } finally {
      setStartingBulkScrape(false);
    }
  };

  const handleRescanAwaitingTracking = async () => {
    if (!selectedFirm) {
      toast.error('Select a firm first');
      return;
    }
    setStartingBulkScrape(true);
    try {
      // Same pre-flight as bulk scrape — agent must be live + logged in.
      const statusRes = await axios.get(`${API}/browser-agent/status`, { headers });
      const agentState = statusRes.data?.state;
      if (!agentState || agentState === 'not_initialized' || agentState === 'stopped' || agentState === 'idle') {
        toast.error('Browser Agent is not running. Open Admin → Browser Agent and start it, then sign in to Seller Central.');
        return;
      }
      if (agentState !== 'logged_in' && agentState !== 'processing') {
        const ck = await axios.post(`${API}/browser-agent/check-login`, {}, { headers });
        if (!ck.data?.logged_in) {
          toast.error('Browser Agent is not logged in to Seller Central. Sign in via Admin → Browser Agent first.');
          return;
        }
      }
      const res = await axios.post(
        `${API}/amazon/bulk-rescan-awaiting-tracking?firm_id=${selectedFirm}`,
        {},
        { headers }
      );
      toast.success(res.data.message || 'Re-scan started');
      await fetchBulkScrapeStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start re-scan');
    } finally {
      setStartingBulkScrape(false);
    }
  };

  const handleCancelBulkScrape = async () => {
    if (!selectedFirm) return;
    try {
      await axios.post(`${API}/amazon/bulk-scrape-cancel?firm_id=${selectedFirm}`, {}, { headers });
      toast.info('Cancellation requested');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const filteredOrders = orders.filter(order => {
    // Filter by tab
    if (activeTab === 'mfn_pending' && (order.is_easy_ship || order.crm_status !== 'pending')) return false;
    if (activeTab === 'easy_ship' && (!order.is_easy_ship || order.crm_status !== 'pending')) return false;
    if (activeTab === 'awaiting_tracking' && order.crm_status !== 'details_captured') return false;
    if (activeTab === 'tracking_added' && order.crm_status !== 'tracking_added') return false;
    if (activeTab === 'dispatched' && order.crm_status !== 'dispatched') return false;
    if (activeTab === 'amazon_history' && order.crm_status !== 'amazon_shipped') return false;
    if (activeTab === 'cancelled' && order.crm_status !== 'cancelled') return false;
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        order.amazon_order_id?.toLowerCase().includes(search) ||
        order.buyer_name?.toLowerCase().includes(search) ||
        order.city?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="shrink-0">
            <h1 className="text-2xl font-bold text-white">Amazon Orders</h1>
            <p className="text-slate-400">Sync and process orders from Amazon Seller Central</p>
            {user?.role === 'admin' && skuGaps > 0 && (
              <button
                onClick={() => navigate('/admin/sku-weights')}
                title="These SKUs have no shipping weight, so the bot holds their orders. Click to fill them."
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {skuGaps} SKU{skuGaps === 1 ? '' : 's'} need a weight — orders held
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <Select value={selectedFirm} onValueChange={setSelectedFirm}>
              <SelectTrigger className="w-64 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Select Firm" />
              </SelectTrigger>
              <SelectContent>
                {firms.map(firm => (
                  <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              onClick={() => setCredentialsDialogOpen(true)}
              disabled={!selectedFirm}
            >
              <Settings className="w-4 h-4 mr-2" />
              {credentialsConfigured ? 'Credentials' : 'Setup API'}
            </Button>
            
            <Button
              onClick={handleFetchFromAmazon}
              disabled={!selectedFirm || fetchingOrders}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {fetchingOrders ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Fetch from Amazon
            </Button>

            <Button
              onClick={handleStartBulkScrape}
              disabled={!selectedFirm || startingBulkScrape || (bulkScrapeJob?.state === 'running')}
              className="bg-cyan-600 hover:bg-cyan-700"
              title="Drive the server-side Browser Agent to auto-fill PII for every MFN Pending order. Sign in to Seller Central first via Admin → Browser Agent."
            >
              {startingBulkScrape ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Auto-fill All from Amazon
            </Button>

            <Button
              onClick={handleRescanAwaitingTracking}
              disabled={!selectedFirm || startingBulkScrape || (bulkScrapeJob?.state === 'running')}
              variant="outline"
              className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
              title="Re-scrape every order stuck in Awaiting Tracking and promote it to Amazon Shipped if Amazon now shows tracking on the order page."
            >
              {startingBulkScrape ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Rescan Awaiting Tracking
            </Button>
          </div>
        </div>

        {/* Bulk scrape progress card */}
        {bulkScrapeJob && (
          <Card className={`border ${bulkScrapeJob.state === 'running' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-800 border-slate-700'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {bulkScrapeJob.state === 'running' ? (
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  ) : bulkScrapeJob.state === 'done' ? (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  )}
                  <div>
                    <p className="text-white font-medium">
                      {bulkScrapeJob.state === 'running'
                        ? `Auto-filling from Amazon… ${bulkScrapeJob.succeeded + bulkScrapeJob.failed}/${bulkScrapeJob.total}`
                        : bulkScrapeJob.state === 'done'
                        ? `Auto-fill complete — ${bulkScrapeJob.succeeded}/${bulkScrapeJob.total} saved`
                        : `Auto-fill ${bulkScrapeJob.state} (${bulkScrapeJob.succeeded + bulkScrapeJob.failed}/${bulkScrapeJob.total})`}
                    </p>
                    <p className="text-xs text-slate-400">
                      Saved: <span className="text-green-400">{bulkScrapeJob.succeeded}</span> ·
                      Failed: <span className="text-red-400">{bulkScrapeJob.failed}</span> ·
                      Need phone review: <span className="text-yellow-400">{bulkScrapeJob.needs_review}</span>
                      {bulkScrapeJob.current_order_id && (
                        <> · Current: <span className="font-mono text-cyan-400">{bulkScrapeJob.current_order_id}</span></>
                      )}
                    </p>
                    {bulkScrapeJob.last_error && (
                      <p className="text-xs text-red-400 mt-1">Last error: {bulkScrapeJob.last_error}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {bulkScrapeJob.state === 'running' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelBulkScrape}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                  {bulkScrapeJob.state !== 'running' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBulkScrapeJob(null)}
                      className="border-slate-500/50 text-slate-300"
                    >
                      Dismiss
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unmapped SKUs Alert */}
        {unmappedSkus.length > 0 && (
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  <div>
                    <p className="text-yellow-400 font-medium">
                      {unmappedSkus.length} Amazon SKU(s) need mapping
                    </p>
                    <p className="text-yellow-400/70 text-sm">
                      Map these SKUs to Master SKUs before processing orders
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSyncAliases}
                    className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                    disabled={syncing}
                  >
                    {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Sync Aliases
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSkuMappingDialogOpen(true)}
                    className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    Map SKUs
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Orders</p>
                  <p className="text-2xl font-bold text-white">{stats.total || 0}</p>
                </div>
                <ShoppingBag className="w-8 h-8 text-slate-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">MFN Pending</p>
                  <p className="text-2xl font-bold text-orange-400">{stats.mfn_pending || 0}</p>
                </div>
                <Package className="w-8 h-8 text-orange-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Easy Ship</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.easy_ship_pending || 0}</p>
                </div>
                <Truck className="w-8 h-8 text-blue-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Tracking Added</p>
                  <p className="text-2xl font-bold text-yellow-400">{stats.tracking_added || 0}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Dispatched</p>
                  <p className="text-2xl font-bold text-green-400">{stats.dispatched || 0}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSyncDispatchedStatus}
                    className="text-green-400 hover:bg-green-500/10"
                    disabled={syncing}
                    title="Sync dispatched orders"
                  >
                    {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                  <CheckCircle className="w-8 h-8 text-green-400/30" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700 border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Amazon History</p>
                  <p className="text-2xl font-bold text-purple-400">{stats.amazon_shipped || 0}</p>
                </div>
                <History className="w-8 h-8 text-purple-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700 border-red-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Cancelled</p>
                  <p className="text-2xl font-bold text-red-400">{stats.cancelled || 0}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-400/30" />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Amazon History Sync - for historical reconciliation */}
        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="w-6 h-6 text-purple-400" />
                <div>
                  <p className="text-purple-400 font-medium">
                    Fetch Amazon History (Shipped Orders Not in CRM)
                  </p>
                  <p className="text-purple-400/70 text-sm">
                    Pull orders already shipped on Amazon since a specific date for CRM reconciliation
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      {format(historyStartDate, 'dd MMM yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarComponent
                      mode="single"
                      selected={historyStartDate}
                      onSelect={(date) => date && setHistoryStartDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  onClick={handleFetchHistoryFromAmazon}
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={fetchingHistory || !selectedFirm}
                >
                  {fetchingHistory ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Fetch History
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Sync from Dispatches - for orders manually dispatched */}
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="w-6 h-6 text-blue-400" />
                <div>
                  <p className="text-blue-400 font-medium">
                    Sync from Dispatcher Queue
                  </p>
                  <p className="text-blue-400/70 text-sm">
                    Auto-add tracking to Amazon orders that were manually dispatched
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleSyncFromDispatches}
                className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                disabled={syncing || !selectedFirm}
              >
                {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Sync from Dispatches
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info about multiple seller accounts */}
        {stats.total === 0 && credentialsConfigured && (
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
                <div>
                  <p className="text-amber-400 font-medium">No orders found?</p>
                  <p className="text-amber-400/70 text-sm">
                    If you have orders in Amazon Seller Central but they're not syncing, check:
                  </p>
                  <ul className="text-amber-400/70 text-sm mt-1 ml-4 list-disc">
                    <li>Are the Amazon credentials for the correct seller account? (Check account name in Seller Central)</li>
                    <li>Click "Fetch from Amazon" to sync recent orders (last 30 days)</li>
                    <li>Easy Ship orders with "Waiting for pick-up" status are included in the sync</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by order ID, customer, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </div>

        {/* Tabs & Orders Table */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800">
            <TabsTrigger value="mfn_pending">
              MFN Pending ({stats.mfn_pending || 0})
            </TabsTrigger>
            <TabsTrigger value="easy_ship">
              Easy Ship ({stats.easy_ship_pending || 0})
            </TabsTrigger>
            <TabsTrigger value="awaiting_tracking" className="text-cyan-400 data-[state=active]:text-cyan-400">
              Awaiting Tracking ({stats.details_captured || 0})
            </TabsTrigger>
            <TabsTrigger value="tracking_added">
              Tracking Added ({stats.tracking_added || 0})
            </TabsTrigger>
            <TabsTrigger value="dispatched">
              Dispatched ({stats.dispatched || 0})
            </TabsTrigger>
            <TabsTrigger value="amazon_history" className="text-purple-400 data-[state=active]:text-purple-400">
              Amazon History ({stats.amazon_shipped || 0})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="text-red-400 data-[state=active]:text-red-400">
              Cancelled ({stats.cancelled || 0})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="mt-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    {selectedFirm ? (
                      <>
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No orders in this category</p>
                        <p className="text-sm">Click "Fetch from Amazon" to sync orders</p>
                      </>
                    ) : (
                      <>
                        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Select a firm to view Amazon orders</p>
                      </>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">Order ID</TableHead>
                        <TableHead className="text-slate-400">Date</TableHead>
                        <TableHead className="text-slate-400">Customer</TableHead>
                        <TableHead className="text-slate-400">Items</TableHead>
                        <TableHead className="text-slate-400">Amount</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-slate-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => {
                        const hasUnmappedSkus = order.items?.some(item => !item.master_sku_id);
                        const canCaptureDetails =
                          (order.crm_status === 'pending' || order.crm_status === 'details_captured') &&
                          !hasUnmappedSkus;
                        return (
                        <TableRow key={order.id} className="border-slate-700 hover:bg-slate-700/30">
                          <TableCell>
                            {canCaptureDetails ? (
                              <button
                                type="button"
                                onClick={() => openCustomerDialog(order)}
                                title="Capture customer details for this order"
                                className="font-mono text-cyan-400 text-sm hover:text-cyan-300 hover:underline focus:outline-none"
                              >
                                {order.amazon_order_id}
                              </button>
                            ) : (
                              <span className="font-mono text-cyan-400 text-sm">
                                {order.amazon_order_id}
                              </span>
                            )}
                            {order.is_easy_ship && (
                              <Badge className="ml-2 bg-blue-500/20 text-blue-400">Easy Ship</Badge>
                            )}
                            {order.crm_status === 'details_captured' && (
                              <Badge className="ml-2 bg-cyan-500/20 text-cyan-400">PII Saved</Badge>
                            )}
                            {order.needs_phone_review && (
                              <Badge className="ml-2 bg-red-500/20 text-red-400">
                                <Phone className="w-3 h-3 mr-1" />
                                Phone Needs Review
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-300">
                            {order.purchase_date ? new Date(order.purchase_date).toLocaleDateString('en-IN') : '-'}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-white">
                                {order.customer_name_manual || order.buyer_name || '—'}
                              </p>
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {(order.city_manual || order.city || '—')},{' '}
                                {order.state_manual || order.state || ''}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {order.items && order.items.length > 0 ? (
                              order.items.map((item, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="text-white">
                                    {item.title ? item.title.substring(0, 30) + '...' : item.amazon_sku || item.asin || 'Unknown Item'}
                                  </span>
                                  {item.quantity && item.quantity > 1 && (
                                    <span className="text-slate-400 ml-1">x{item.quantity}</span>
                                  )}
                                  {!item.master_sku_id && (
                                    <Badge className="ml-1 bg-red-500/20 text-red-400 text-xs">Unmapped</Badge>
                                  )}
                                  {item.master_sku_id && (
                                    <Badge className="ml-1 bg-green-500/20 text-green-400 text-xs">{item.sku_code || item.master_sku_code || 'Mapped'}</Badge>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm italic">No items</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRefreshOrderItems(order.amazon_order_id)}
                                  disabled={refreshingOrder === order.amazon_order_id}
                                  className="text-cyan-400 hover:bg-cyan-500/10 h-6 px-2"
                                >
                                  {refreshingOrder === order.amazon_order_id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  <span className="ml-1 text-xs">Sync</span>
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-green-400">
                            {formatCurrency(order.order_total)}
                          </TableCell>
                          <TableCell>
                            {order.crm_status === 'pending' && (
                              <Badge className="bg-orange-500/20 text-orange-400">Pending</Badge>
                            )}
                            {order.crm_status === 'details_captured' && (
                              <Badge className="bg-cyan-500/20 text-cyan-400">
                                <UserPlus className="w-3 h-3 mr-1" />
                                Awaiting Tracking
                              </Badge>
                            )}
                            {order.crm_status === 'tracking_added' && (
                              <Badge className="bg-yellow-500/20 text-yellow-400">
                                Tracking: {order.tracking_number}
                              </Badge>
                            )}
                            {order.crm_status === 'dispatched' && (
                              <Badge className="bg-green-500/20 text-green-400">Dispatched</Badge>
                            )}
                            {order.crm_status === 'amazon_shipped' && (
                              <Badge className="bg-purple-500/20 text-purple-400">
                                <History className="w-3 h-3 mr-1" />
                                Amazon Shipped
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {order.crm_status === 'pending' && !order.is_easy_ship && (
                              order.items?.some(item => !item.master_sku_id) ? (
                                <Badge className="bg-red-500/20 text-red-400">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Map SKUs First
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setTrackingDialogOpen(true);
                                  }}
                                  className="bg-orange-600 hover:bg-orange-700"
                                >
                                  <Truck className="w-4 h-4 mr-1" />
                                  Add Tracking
                                </Button>
                              )
                            )}
                            {order.crm_status === 'pending' && order.is_easy_ship && (
                              order.items?.some(item => !item.master_sku_id) ? (
                                <Badge className="bg-red-500/20 text-red-400">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Map SKUs First
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setTrackingDialogOpen(true);
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  <Truck className="w-4 h-4 mr-1" />
                                  Add Tracking
                                </Button>
                              )
                            )}
                            {/* Mark as Cancelled button for pending orders */}
                            {order.crm_status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkCancelled(order.amazon_order_id)}
                                className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            )}
                            {/* Restore button for cancelled orders */}
                            {order.crm_status === 'cancelled' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRestoreOrder(order.amazon_order_id)}
                                className="border-green-500/50 text-green-400 hover:bg-green-500/20"
                              >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Restore
                              </Button>
                            )}
                            {order.crm_status === 'amazon_shipped' && (
                              order.items?.some(item => !item.master_sku_id) ? (
                                <Badge className="bg-red-500/20 text-red-400">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Map SKUs First
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOrder({...order, is_history_order: true});
                                    setTrackingDialogOpen(true);
                                  }}
                                  className="bg-purple-600 hover:bg-purple-700"
                                >
                                  <Package className="w-4 h-4 mr-1" />
                                  Process in CRM
                                </Button>
                              )
                            )}
                            {order.crm_status === 'tracking_added' && (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-yellow-500/20 text-yellow-400">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pending Dispatch
                                </Badge>
                                {!order.amazon_tracking_pushed && (
                                  <Button
                                    size="sm"
                                    onClick={() => handlePushToAmazon(order.amazon_order_id)}
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={pushingToAmazon}
                                  >
                                    {pushingToAmazon ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <ArrowRight className="w-3 h-3" />
                                    )}
                                    <span className="ml-1">Push to Amazon</span>
                                  </Button>
                                )}
                                {order.amazon_tracking_pushed && (
                                  <Badge className="bg-green-500/20 text-green-400">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Pushed
                                  </Badge>
                                )}
                              </div>
                            )}
                            {order.crm_status === 'details_captured' && (
                              <div className="flex items-center gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openCustomerDialog(order)}
                                  className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                                  title="Edit captured customer details"
                                >
                                  <UserPlus className="w-4 h-4 mr-1" />
                                  Edit Details
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setTrackingDialogOpen(true);
                                  }}
                                  className="bg-orange-600 hover:bg-orange-700"
                                >
                                  <Truck className="w-4 h-4 mr-1" />
                                  Add Tracking
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Credentials Dialog */}
        <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Amazon SP-API Credentials</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>LWA Client ID</Label>
                <Input
                  placeholder="amzn1.application-oa2-client.xxx"
                  value={credentials.lwa_client_id}
                  onChange={(e) => setCredentials({ ...credentials, lwa_client_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>LWA Client Secret</Label>
                <Input
                  type="password"
                  placeholder="amzn1.oa2-cs.v1.xxx"
                  value={credentials.lwa_client_secret}
                  onChange={(e) => setCredentials({ ...credentials, lwa_client_secret: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Refresh Token</Label>
                <Input
                  type="password"
                  placeholder="Atzr|xxx"
                  value={credentials.refresh_token}
                  onChange={(e) => setCredentials({ ...credentials, refresh_token: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>AWS Access Key</Label>
                  <Input
                    placeholder="AKIAXXXXXXXXXX"
                    value={credentials.aws_access_key}
                    onChange={(e) => setCredentials({ ...credentials, aws_access_key: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>AWS Secret Key</Label>
                  <Input
                    type="password"
                    placeholder="xxx"
                    value={credentials.aws_secret_key}
                    onChange={(e) => setCredentials({ ...credentials, aws_secret_key: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Seller ID</Label>
                <Input
                  placeholder="A16JRBPBSP6AZT"
                  value={credentials.seller_id}
                  onChange={(e) => setCredentials({ ...credentials, seller_id: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCredentialsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCredentials} className="bg-orange-600 hover:bg-orange-700">
                Save Credentials
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tracking Dialog */}
        <Dialog open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedOrder?.is_history_order ? 'Process Historical Order in CRM' : 'Add Tracking Information'}
                {selectedOrder && !selectedOrder.is_easy_ship && !selectedOrder.is_history_order && (
                  <Badge className="ml-2 bg-orange-500/20 text-orange-400">MFN</Badge>
                )}
                {selectedOrder?.is_easy_ship && !selectedOrder.is_history_order && (
                  <Badge className="ml-2 bg-blue-500/20 text-blue-400">Easy Ship</Badge>
                )}
                {selectedOrder?.is_history_order && (
                  <Badge className="ml-2 bg-purple-500/20 text-purple-400">Amazon History</Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                {selectedOrder.is_history_order && (
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <p className="text-purple-700 text-sm font-medium">Historical Order Reconciliation</p>
                    <p className="text-purple-600 text-xs mt-1">
                      This order was already shipped on Amazon. Enter tracking details to process through CRM dispatch flow for proper reconciliation.
                    </p>
                  </div>
                )}
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">Order:</span>{' '}
                    <span className="font-mono">{selectedOrder.amazon_order_id}</span>
                  </p>
                  {selectedOrder.buyer_name && (
                    <p className="text-sm">
                      <span className="font-medium">Amazon Buyer:</span>{' '}
                      {selectedOrder.buyer_name}
                    </p>
                  )}
                  {selectedOrder.city && (
                    <p className="text-sm">
                      <span className="font-medium">City:</span>{' '}
                      {selectedOrder.city}, {selectedOrder.state}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Carrier *</Label>
                  <Select
                    value={trackingForm.carrier_code}
                    onValueChange={(v) => setTrackingForm({ ...trackingForm, carrier_code: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select carrier" />
                    </SelectTrigger>
                    <SelectContent>
                      {CARRIERS.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Tracking Number *</Label>
                  <Input
                    placeholder="Enter tracking/AWB number"
                    value={trackingForm.tracking_number}
                    onChange={(e) => setTrackingForm({ ...trackingForm, tracking_number: e.target.value })}
                  />
                </div>
                
                {/* If PII was already captured via the Order ID dialog, show a read-only summary instead of the form */}
                {selectedOrder.crm_status === 'details_captured' && (
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-medium text-cyan-600 mb-2 flex items-center gap-1">
                      <UserPlus className="w-4 h-4" /> Customer details already saved
                    </p>
                    <div className="bg-cyan-50 p-3 rounded-lg text-sm space-y-1">
                      <p><span className="font-medium">Name:</span> {selectedOrder.customer_name_manual}</p>
                      <p><span className="font-medium">Phone:</span> {selectedOrder.phone_manual}</p>
                      <p><span className="font-medium">Address:</span> {selectedOrder.address_manual || '—'}</p>
                      <p>
                        <span className="font-medium">City/State:</span>{' '}
                        {selectedOrder.city_manual}, {selectedOrder.state_manual} {selectedOrder.pincode_manual}
                      </p>
                      <p className="text-xs text-cyan-700 pt-1">
                        To change them, close this dialog and click "Edit Details" on the order row.
                      </p>
                    </div>
                  </div>
                )}

                {/* MFN-specific fields - mandatory for MFN orders and History orders, unless already captured */}
                {selectedOrder.crm_status !== 'details_captured' &&
                  (!selectedOrder.is_easy_ship || selectedOrder.is_history_order) && (
                  <>
                    <div className="border-t pt-4 mt-4">
                      <p className="text-sm font-medium text-orange-600 mb-3">
                        {selectedOrder.is_history_order ? 'Customer Details for CRM Dispatch' : 'MFN Order - Customer Details Required'}
                      </p>
                      <p className="text-xs text-slate-500 mb-3">
                        {selectedOrder.is_history_order 
                          ? 'Enter customer details to complete the dispatch flow in CRM.'
                          : 'Amazon restricts PII. Please enter customer details manually.'}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Customer Name *</Label>
                      <Input
                        placeholder="Enter customer name"
                        value={trackingForm.customer_name}
                        onChange={(e) => setTrackingForm({ ...trackingForm, customer_name: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Phone Number * (10 digits)</Label>
                      <Input
                        placeholder="Enter 10-digit phone"
                        value={trackingForm.phone}
                        maxLength={10}
                        onChange={(e) => setTrackingForm({ ...trackingForm, phone: e.target.value.replace(/\D/g, '') })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Shipping Address</Label>
                      <Input
                        placeholder="Street address, landmark"
                        value={trackingForm.address}
                        onChange={(e) => setTrackingForm({ ...trackingForm, address: e.target.value })}
                      />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-2">
                        <Label>City *</Label>
                        <Input
                          placeholder="City"
                          value={trackingForm.city}
                          onChange={(e) => setTrackingForm({ ...trackingForm, city: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State *</Label>
                        <Select
                          value={trackingForm.state}
                          onValueChange={(v) => setTrackingForm({ ...trackingForm, state: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {INDIAN_STATES.map(s => (
                              <SelectItem key={s.code} value={s.name}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Pincode *</Label>
                        <Input
                          placeholder="Pincode"
                          value={trackingForm.pincode}
                          maxLength={6}
                          onChange={(e) => setTrackingForm({ ...trackingForm, pincode: e.target.value.replace(/\D/g, '') })}
                        />
                      </div>
                    </div>
                  </>
                )}
                
                <p className="text-sm text-slate-500">
                  {selectedOrder.is_history_order 
                    ? 'This order will be added to "Pending Dispatch" queue for CRM processing.'
                    : 'After adding tracking, this order will move to "Pending Dispatch" queue.'}
                </p>
              </div>
            )}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setTrackingDialogOpen(false)}>
                Cancel
              </Button>
              {selectedOrder?.is_history_order ? (
                <Button 
                  onClick={() => handleAddTracking(false)} 
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={pushingToAmazon}
                >
                  <Package className="w-4 h-4 mr-2" />
                  Process in CRM
                </Button>
              ) : (
                <>
                  <Button 
                    onClick={() => handleAddTracking(false)} 
                    className="bg-slate-600 hover:bg-slate-700"
                    disabled={pushingToAmazon}
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Save & Queue Only
                  </Button>
                  <Button 
                    onClick={() => handleAddTracking(true)} 
                    className="bg-orange-600 hover:bg-orange-700"
                    disabled={pushingToAmazon}
                  >
                    {pushingToAmazon ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4 mr-2" />
                    )}
                    Save & Push to Amazon
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Customer Details (PII) Dialog — Step 1 of two-step Amazon flow */}
        <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-500" />
                Capture Customer Details
                {selectedOrder?.is_easy_ship && (
                  <Badge className="bg-blue-500/20 text-blue-400">Easy Ship</Badge>
                )}
                {selectedOrder && !selectedOrder.is_easy_ship && (
                  <Badge className="bg-orange-500/20 text-orange-400">MFN</Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-lg text-sm">
                  <p>
                    <span className="font-medium">Order:</span>{' '}
                    <span className="font-mono">{selectedOrder.amazon_order_id}</span>
                  </p>
                  {selectedOrder.order_total != null && (
                    <p>
                      <span className="font-medium">Amount:</span>{' '}
                      {formatCurrency(selectedOrder.order_total)}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    After saving, this order moves to the <span className="font-medium text-cyan-600">Awaiting Tracking</span> tab.
                    Add a tracking ID later to push it into the Pending Fulfillment queue.
                  </p>
                </div>

                {/* Auto-fill from Amazon (dry-run preview) */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-cyan-300 bg-cyan-50">
                  <div className="text-xs text-cyan-900">
                    <p className="font-medium">Auto-fill from Seller Central</p>
                    <p className="text-cyan-700 mt-0.5">
                      Drives the browser agent to scrape buyer name, address, and phone
                      from this order's Seller Central page. <strong>Doesn't save</strong> — you
                      review then click Save.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAutoFillFromAmazon}
                    disabled={scrapingPreview}
                    className="bg-cyan-600 hover:bg-cyan-700 shrink-0"
                    size="sm"
                  >
                    {scrapingPreview ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-1" />
                    )}
                    Auto-fill
                  </Button>
                </div>

                {lastScrapeMeta && (
                  <div className="text-xs p-2 rounded bg-slate-100 border border-slate-200 space-y-1">
                    <p>
                      <span className="font-medium">Phone source:</span>{' '}
                      {lastScrapeMeta.phone_found_in === 'shipping' && <span className="text-green-700">Shipping address ✓</span>}
                      {lastScrapeMeta.phone_found_in === 'seller_notes' && <span className="text-cyan-700">Seller Notes ✓</span>}
                      {lastScrapeMeta.phone_found_in === 'page' && <span className="text-yellow-700">Page text (lower confidence)</span>}
                      {lastScrapeMeta.phone_found_in === 'none' && <span className="text-red-700">NOT FOUND — enter manually</span>}
                    </p>
                    {lastScrapeMeta.seller_notes && (
                      <p className="text-slate-600">
                        <span className="font-medium">Seller notes:</span>{' '}
                        <span className="italic">"{lastScrapeMeta.seller_notes.substring(0, 200)}{lastScrapeMeta.seller_notes.length > 200 ? '…' : ''}"</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input
                      placeholder="First name"
                      value={customerForm.customer_first_name}
                      onChange={(e) => setCustomerForm({ ...customerForm, customer_first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      placeholder="Last name"
                      value={customerForm.customer_last_name}
                      onChange={(e) => setCustomerForm({ ...customerForm, customer_last_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Phone Number * (10 digits)</Label>
                  <Input
                    placeholder="Enter 10-digit phone"
                    value={customerForm.phone}
                    maxLength={10}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value.replace(/\D/g, '') })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Shipping Address</Label>
                  <Input
                    placeholder="Street address, landmark"
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label>City *</Label>
                    <Input
                      placeholder="City"
                      value={customerForm.city}
                      onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State *</Label>
                    <Select
                      value={customerForm.state}
                      onValueChange={(v) => setCustomerForm({ ...customerForm, state: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {INDIAN_STATES.map(s => (
                          <SelectItem key={s.code} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pincode *</Label>
                    <Input
                      placeholder="Pincode"
                      value={customerForm.pincode}
                      maxLength={6}
                      onChange={(e) => setCustomerForm({ ...customerForm, pincode: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCustomerDialogOpen(false)} disabled={savingCustomerDetails}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveCustomerDetails}
                className="bg-cyan-600 hover:bg-cyan-700"
                disabled={savingCustomerDetails}
              >
                {savingCustomerDetails ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                Save Customer Details
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* SKU Mapping Dialog */}
        <Dialog open={skuMappingDialogOpen} onOpenChange={setSkuMappingDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Map Amazon SKUs to Master SKUs</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {unmappedSkus.map((sku) => (
                <div key={sku.amazon_sku} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-mono text-sm text-orange-600">{sku.amazon_sku}</p>
                    <p className="text-xs text-slate-500">{sku.title?.substring(0, 60)}...</p>
                    <p className="text-xs text-slate-400">Used in {sku.order_count} orders</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                  <div className="w-48">
                    <Select
                      value={selectedUnmappedSku?.amazon_sku === sku.amazon_sku ? selectedMasterSku : ''}
                      onValueChange={(v) => {
                        setSelectedUnmappedSku(sku);
                        setSelectedMasterSku(v);
                      }}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select Master SKU" />
                      </SelectTrigger>
                      <SelectContent>
                        {masterSkus.map(ms => (
                          <SelectItem key={ms.id} value={ms.id}>
                            {ms.sku_code} - {ms.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleMapSku}
                    disabled={selectedUnmappedSku?.amazon_sku !== sku.amazon_sku || !selectedMasterSku}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Map
                  </Button>
                </div>
              ))}
              
              {unmappedSkus.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>All SKUs are mapped!</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSkuMappingDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

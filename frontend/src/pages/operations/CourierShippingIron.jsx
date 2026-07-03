import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import {
  Package, Loader2, Search, Truck, MapPin,
  CheckCircle, Clock, Building2, ArrowRight, FileText,
  Download, RefreshCw, IndianRupee, User,
  AlertTriangle, Box, History
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const fieldLabel = { fontFamily: T.headline, fontWeight: 600, fontSize: 11, color: T.iron500, display: 'block', marginBottom: 4 };

// Status -> Iron pill tone. Keyed by UPPERCASED status so mixed-case Bigship values resolve to one style.
const STATUS_TONE = {
  'CREATED': 'warn',
  'MANIFESTED': 'ok',
  'IN-TRANSIT': 'info',
  'IN TRANSIT': 'info',
  'PICKUP SCHEDULED': 'violet',
  'NOT PICKED': 'bad',
  'DELIVERED': 'ok',
  'RTO DELIVERED': 'bad',
  'RTO IN TRANSIT': 'bad',
  'UNDELIVERED': 'warn',
  'CANCELLED': 'slate',
};

export default function CourierShipping() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('create');

  // Warehouse data
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);

  // Form state
  const [shipmentCategory, setShipmentCategory] = useState('b2c');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    company_name: '',
    phone: '',
    alt_phone: '',
    address_line1: '',
    address_line2: '',
    landmark: '',
    pincode: '',
    invoice_number: '',
    invoice_amount: '',
    weight: '',
    length: '',
    width: '',
    height: '',
    product_name: '',
    product_category: 'Electronics',
    hsn: '',
    payment_type: 'Prepaid',
    cod_amount: '',
    ewaybill_number: '',
  });

  // File uploads
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoiceBase64, setInvoiceBase64] = useState('');
  const [ewaybillFile, setEwaybillFile] = useState(null);
  const [ewaybillBase64, setEwaybillBase64] = useState('');

  // Rates
  const [rates, setRates] = useState([]);
  const [selectedRate, setSelectedRate] = useState(null);
  const [calculatingRates, setCalculatingRates] = useState(false);

  // Created shipment
  const [createdShipment, setCreatedShipment] = useState(null);
  const [manifestingShipment, setManifestingShipment] = useState(false);
  const [manifestedShipment, setManifestedShipment] = useState(null);

  // Shipment history
  const [shipments, setShipments] = useState([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');   // '' = all; e.g. 'NOT PICKED'
  const [notPicked, setNotPicked] = useState({ total: 0, stale: 0, recent: 0 });

  // Label dialog
  const [labelDialog, setLabelDialog] = useState(false);
  const [labelData, setLabelData] = useState(null);
  const [downloadingLabel, setDownloadingLabel] = useState(false);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchShipments();
      fetchStatusSummary();
    }
  }, [activeTab, statusFilter]);

  // Live board: while viewing shipments, auto-refresh so new Bigship bookings appear and rows turn
  // green as the tracking poller marks them picked-up — no manual refresh needed.
  useEffect(() => {
    if (activeTab !== 'history') return;
    const id = setInterval(() => { fetchShipments(); fetchStatusSummary(); }, 60000);
    return () => clearInterval(id);
  }, [activeTab, statusFilter]);

  const fetchStatusSummary = async () => {
    try {
      const res = await axios.get(`${API}/courier/shipments/status-summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success && res.data.not_picked) setNotPicked(res.data.not_picked);
    } catch (e) { /* non-fatal */ }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await axios.get(`${API}/courier/warehouses?page_size=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setWarehouses(response.data.warehouses);
        // Select first warehouse by default
        if (response.data.warehouses.length > 0) {
          setSelectedWarehouse(response.data.warehouses[0]);
        }
      }
    } catch (error) {
      toast.error('Failed to load warehouses');
    }
  };

  const fetchShipments = async () => {
    setShipmentsLoading(true);
    try {
      // Bump page size when filtering so all matches of a small bucket (e.g. the
      // ~66 NOT PICKED) land on one page rather than being cut off at 50.
      const params = new URLSearchParams({ page_size: statusFilter ? '100' : '50' });
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);

      const response = await axios.get(`${API}/courier/shipments?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setShipments(response.data.shipments);
      }
    } catch (error) {
      toast.error('Failed to load shipments');
    } finally {
      setShipmentsLoading(false);
    }
  };

  const handleFileChange = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      toast.error('Only PDF or image files are allowed');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      if (type === 'invoice') {
        setInvoiceFile(file);
        setInvoiceBase64(base64);
      } else {
        setEwaybillFile(file);
        setEwaybillBase64(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const calculateRates = async () => {
    if (!selectedWarehouse) {
      toast.error('Please select a pickup warehouse');
      return;
    }
    if (!formData.pincode || formData.pincode.length !== 6) {
      toast.error('Please enter a valid 6-digit destination pincode');
      return;
    }
    if (!formData.weight || parseFloat(formData.weight) <= 0) {
      toast.error('Please enter package weight');
      return;
    }

    setCalculatingRates(true);
    setRates([]);
    setSelectedRate(null);

    try {
      const response = await axios.post(`${API}/courier/calculate-rates`, {
        shipment_category: shipmentCategory.toUpperCase(),
        payment_type: formData.payment_type,
        pickup_pincode: selectedWarehouse.address_pincode,
        destination_pincode: formData.pincode,
        invoice_amount: parseFloat(formData.invoice_amount) || 0,
        weight: parseFloat(formData.weight),
        length: parseInt(formData.length) || 10,
        width: parseInt(formData.width) || 10,
        height: parseInt(formData.height) || 10,
        risk_type: shipmentCategory === 'b2b' ? 'OwnerRisk' : ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setRates(response.data.rates);
        if (response.data.rates.length === 0) {
          toast.warning('No courier services available for this route');
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to calculate rates');
    } finally {
      setCalculatingRates(false);
    }
  };

  const createShipment = async () => {
    // Validation
    if (!selectedWarehouse) {
      toast.error('Please select a pickup warehouse');
      return;
    }
    if (!formData.first_name) {
      toast.error('Customer first name is required');
      return;
    }
    if (!formData.phone || formData.phone.length < 10) {
      toast.error('Valid phone number is required');
      return;
    }
    if (!formData.address_line1) {
      toast.error('Address is required');
      return;
    }
    if (!formData.pincode || formData.pincode.length !== 6) {
      toast.error('Valid 6-digit pincode is required');
      return;
    }
    if (!formData.weight) {
      toast.error('Package weight is required');
      return;
    }

    // B2B validation for invoice > 50000
    const invoiceAmount = parseFloat(formData.invoice_amount) || 0;
    if (shipmentCategory === 'b2b' && invoiceAmount > 50000) {
      if (!formData.ewaybill_number) {
        toast.error('E-way bill number is required for B2B shipments over Rs. 50,000');
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        shipment_category: shipmentCategory,
        warehouse_id: selectedWarehouse.warehouse_id,
        invoice_amount: invoiceAmount,
        weight: parseFloat(formData.weight),
        length: parseInt(formData.length) || 10,
        width: parseInt(formData.width) || 10,
        height: parseInt(formData.height) || 10,
      };

      // Add invoice document if uploaded
      if (invoiceBase64) {
        payload.invoice_document = invoiceBase64;
      }

      // Add e-way bill document if uploaded
      if (ewaybillBase64) {
        payload.ewaybill_document = ewaybillBase64;
      }

      const response = await axios.post(`${API}/courier/create-shipment`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setCreatedShipment(response.data);
        toast.success('Shipment created successfully!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create shipment');
    } finally {
      setLoading(false);
    }
  };

  const manifestShipment = async () => {
    if (!selectedRate) {
      toast.error('Please select a courier');
      return;
    }

    setManifestingShipment(true);

    try {
      const response = await axios.post(`${API}/courier/manifest`, {
        system_order_id: createdShipment.system_order_id,
        courier_id: selectedRate.courier_id,
        shipment_category: shipmentCategory,
        risk_type: shipmentCategory === 'b2b' ? 'OwnerRisk' : ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setManifestedShipment(response.data);
        toast.success(`AWB Generated: ${response.data.awb_number}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to manifest shipment');
    } finally {
      setManifestingShipment(false);
    }
  };

  const downloadLabel = async (systemOrderId) => {
    setDownloadingLabel(true);

    try {
      const response = await axios.get(`${API}/courier/label/${systemOrderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Convert base64 to blob and download
        const byteCharacters = atob(response.data.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: response.data.media_type });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${response.data.filename}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success('Label downloaded successfully');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to download label');
    } finally {
      setDownloadingLabel(false);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      company_name: '',
      phone: '',
      alt_phone: '',
      address_line1: '',
      address_line2: '',
      landmark: '',
      pincode: '',
      invoice_number: '',
      invoice_amount: '',
      weight: '',
      length: '',
      width: '',
      height: '',
      product_name: '',
      product_category: 'Electronics',
      hsn: '',
      payment_type: 'Prepaid',
      cod_amount: '',
      ewaybill_number: '',
    });
    setInvoiceFile(null);
    setInvoiceBase64('');
    setEwaybillFile(null);
    setEwaybillBase64('');
    setRates([]);
    setSelectedRate(null);
    setCreatedShipment(null);
    setManifestedShipment(null);
  };

  const daysSince = (iso) => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
  };

  const getStatusBadge = (status) => {
    const key = (status || '').toUpperCase();
    const tone = STATUS_TONE[key] || 'slate';
    return (
      <span style={badgeStyle(tone)}>{status ? status.toUpperCase() : 'UNKNOWN'}</span>
    );
  };

  const isNotPicked = (status) => (status || '').toUpperCase() === 'NOT PICKED';
  // Picked up = courier has collected it and it's moving forward (not pre-pickup, not RTO/cancelled).
  const isPickedUp = (status) => {
    const s = (status || '').toUpperCase();
    if (!s || s === 'NOT PICKED' || s.includes('PICKUP SCHEDULED') || s === 'MANIFESTED' || s.includes('CANCEL') || s.includes('RTO')) return false;
    return s.includes('TRANSIT') || s.includes('OUT FOR DELIVERY') || s.includes('DELIVERED');
  };

  const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
  const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

  // Step indicator dot
  const stepDot = (active, done) => ({
    width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center',
    fontFamily: T.mono, fontWeight: 700, fontSize: 13, color: '#fff',
    background: done ? T.green : (active ? T.orange : T.iron200),
  });

  const HISTORY_COLS = ['Order ID', 'Customer', 'Destination', 'Product', 'AWB', 'Courier', 'Status', 'Actions'];

  const quickFilters = [
    ['', 'All'],
    ['NOT PICKED', `Not picked${notPicked.total ? ` (${notPicked.total})` : ''}`],
    ['PICKUP SCHEDULED', 'Pickup scheduled'],
    ['IN-TRANSIT', 'In transit'],
    ['DELIVERED', 'Delivered'],
  ];

  const onRefresh = () => {
    fetchWarehouses();
    if (activeTab === 'history') { fetchShipments(); fetchStatusSummary(); }
  };

  return (
    <IronShell
      title="Courier Shipping"
      subtitle="BIGSHIP · CREATE + TRACK"
      onRefresh={onRefresh}
    >
      <div data-testid="courier-shipping-page" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${T.iron200}`, paddingBottom: 0 }}>
          {[
            ['create', 'Create Shipment', Package],
            ['history', 'Shipment History', History],
          ].map(([val, label, Icon]) => (
            <button
              key={val}
              data-testid={`tab-${val}`}
              onClick={() => setActiveTab(val)}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: T.headline, fontWeight: 700, fontSize: 12.5,
                padding: '8px 12px', marginBottom: -1,
                color: activeTab === val ? T.iron900 : T.iron500,
                borderBottom: `2px solid ${activeTab === val ? T.orange : 'transparent'}`,
              }}
            >
              <Icon size={15} strokeWidth={1.9} />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Step indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '4px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={stepDot(!createdShipment, !!createdShipment)}>
                  {createdShipment ? <CheckCircle size={16} /> : '1'}
                </div>
                <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: !createdShipment ? T.iron900 : T.iron500 }}>Enter Details</span>
              </div>
              <ArrowRight size={16} color={T.iron400} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={stepDot(createdShipment && !manifestedShipment, !!manifestedShipment)}>
                  {manifestedShipment ? <CheckCircle size={16} /> : '2'}
                </div>
                <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: createdShipment && !manifestedShipment ? T.iron900 : T.iron500 }}>Select Courier</span>
              </div>
              <ArrowRight size={16} color={T.iron400} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={stepDot(false, !!manifestedShipment)}>
                  {manifestedShipment ? <CheckCircle size={16} /> : '3'}
                </div>
                <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: manifestedShipment ? T.iron900 : T.iron500 }}>Download Label</span>
              </div>
            </div>

            {/* Success state - show label download */}
            {manifestedShipment ? (
              <IronCard style={{ background: T.greenTint, border: `1px solid #CBE5D6` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <CheckCircle size={18} color={T.green} />
                  <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.green }}>Shipment Created Successfully!</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                  <div>
                    <Caps size={9}>Order ID</Caps>
                    <p style={{ ...mono, fontWeight: 700, fontSize: 13, marginTop: 2 }}>{createdShipment.system_order_id}</p>
                  </div>
                  <div>
                    <Caps size={9}>AWB Number</Caps>
                    <p style={{ ...mono, fontWeight: 700, fontSize: 13, marginTop: 2, color: T.orange }}>{manifestedShipment.awb_number}</p>
                  </div>
                  <div>
                    <Caps size={9}>Courier</Caps>
                    <p style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>{manifestedShipment.courier_name}</p>
                  </div>
                  <div>
                    <Caps size={9}>LR Number</Caps>
                    <p style={{ ...mono, fontSize: 13, marginTop: 2 }}>{manifestedShipment.lr_number}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, paddingTop: 16 }}>
                  <button
                    onClick={() => downloadLabel(createdShipment.system_order_id)}
                    disabled={downloadingLabel}
                    data-testid="download-label-btn"
                    style={{ ...primaryBtn, opacity: downloadingLabel ? 0.6 : 1 }}
                  >
                    {downloadingLabel ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    Download Shipping Label
                  </button>
                  <button style={outlineBtn} onClick={resetForm} data-testid="new-shipment-btn">
                    Create New Shipment
                  </button>
                </div>
              </IronCard>
            ) : createdShipment ? (
              /* Step 2: Select Courier */
              <IronCard>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15 }}>Select Courier Service</div>
                  <div style={{ fontSize: 12, color: T.iron500, marginTop: 3 }}>
                    Order ID: <span style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{createdShipment.system_order_id}</span>
                  </div>
                </div>
                {rates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <p style={{ color: T.iron500, marginBottom: 16, fontSize: 13 }}>Calculate rates to see available courier options</p>
                    <button style={{ ...primaryBtn, margin: '0 auto' }} onClick={calculateRates} disabled={calculatingRates}>
                      {calculatingRates ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                      Calculate Rates
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gap: 10, maxHeight: 384, overflowY: 'auto' }}>
                      {rates.map((rate) => {
                        const sel = selectedRate?.courier_id === rate.courier_id;
                        return (
                          <div
                            key={rate.courier_id}
                            onClick={() => setSelectedRate(rate)}
                            data-testid={`rate-option-${rate.courier_id}`}
                            style={{
                              padding: 14, borderRadius: 8, cursor: 'pointer',
                              border: `1px solid ${sel ? T.orange : T.iron200}`,
                              background: sel ? '#FDF3EA' : T.white,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                              <div>
                                <p style={{ fontWeight: 600, fontSize: 13 }}>{rate.courier_name}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: T.iron500, marginTop: 4 }}>
                                  <span style={badgeStyle('slate')}>{rate.courier_type}</span>
                                  <span>Zone: {rate.zone}</span>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={12} />
                                    {rate.tat} days
                                  </span>
                                  <span>Weight: {rate.billable_weight} kg</span>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ ...mono, fontSize: 18, fontWeight: 700, color: T.orange }}>Rs. {rate.total_shipping_charges}</p>
                                {rate.other_additional_charges && (
                                  <p style={{ fontSize: 11, color: T.iron500 }}>Base: Rs. {rate.courier_charge}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 12, paddingTop: 16, marginTop: 12, borderTop: `1px solid ${T.iron200}` }}>
                      <button
                        onClick={manifestShipment}
                        disabled={!selectedRate || manifestingShipment}
                        data-testid="manifest-btn"
                        style={{ ...primaryBtn, flex: 1, justifyContent: 'center', opacity: (!selectedRate || manifestingShipment) ? 0.6 : 1 }}
                      >
                        {manifestingShipment ? <Loader2 size={15} className="animate-spin" /> : <Truck size={15} />}
                        Book {selectedRate?.courier_name || 'Courier'} - Rs. {selectedRate?.total_shipping_charges || 0}
                      </button>
                      <button style={outlineBtn} onClick={resetForm}>Cancel</button>
                    </div>
                  </>
                )}
              </IronCard>
            ) : (
              /* Step 1: Enter Details */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                {/* Shipment Type Selection */}
                <IronCard style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Shipment Type</div>
                  <RadioGroup
                    value={shipmentCategory}
                    onValueChange={setShipmentCategory}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="b2c" id="b2c" data-testid="radio-b2c" />
                      <Label htmlFor="b2c" className="cursor-pointer">
                        <span style={{ fontWeight: 600 }}>B2C - Single/Surface</span>
                        <span style={{ color: T.iron500, marginLeft: 8 }}>(Standard courier delivery)</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="b2b" id="b2b" data-testid="radio-b2b" />
                      <Label htmlFor="b2b" className="cursor-pointer">
                        <span style={{ fontWeight: 600 }}>B2B - Heavy Shipment</span>
                        <span style={{ color: T.iron500, marginLeft: 8 }}>(LTL/PTL freight)</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </IronCard>

                {/* Pickup Warehouse */}
                <IronCard>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontFamily: T.headline, fontWeight: 700, fontSize: 14 }}>
                    <Building2 size={16} color={T.orange} /> Pickup Location
                  </div>
                  <Select
                    value={selectedWarehouse?.warehouse_id?.toString()}
                    onValueChange={(val) => {
                      const wh = warehouses.find(w => w.warehouse_id.toString() === val);
                      setSelectedWarehouse(wh);
                    }}
                  >
                    <SelectTrigger data-testid="warehouse-select" style={inputStyle}>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.warehouse_id} value={wh.warehouse_id.toString()}>
                          {wh.warehouse_name} - {wh.address_city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedWarehouse && (
                    <div style={{ marginTop: 12, padding: 12, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, fontSize: 12.5 }}>
                      <p style={{ fontWeight: 600 }}>{selectedWarehouse.warehouse_name}</p>
                      <p style={{ color: T.iron500 }}>{selectedWarehouse.address_line1}</p>
                      <p style={{ color: T.iron500 }}>{selectedWarehouse.address_city}, {selectedWarehouse.address_state}</p>
                      <p style={{ ...mono, marginTop: 4 }}>PIN: {selectedWarehouse.address_pincode}</p>
                    </div>
                  )}
                </IronCard>

                {/* Customer Details */}
                <IronCard>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontFamily: T.headline, fontWeight: 700, fontSize: 14 }}>
                    <User size={16} color={T.orange} /> Customer Details
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={fieldLabel}>First Name *</label>
                        <input
                          style={inputStyle}
                          placeholder="First name"
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          data-testid="input-first-name"
                        />
                      </div>
                      <div>
                        <label style={fieldLabel}>Last Name</label>
                        <input
                          style={inputStyle}
                          placeholder="Last name"
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          data-testid="input-last-name"
                        />
                      </div>
                    </div>
                    {shipmentCategory === 'b2b' && (
                      <div>
                        <label style={fieldLabel}>Company Name</label>
                        <input
                          style={inputStyle}
                          placeholder="Company name"
                          value={formData.company_name}
                          onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                          data-testid="input-company"
                        />
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={fieldLabel}>Phone *</label>
                        <input
                          style={inputStyle}
                          placeholder="10-digit phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                          data-testid="input-phone"
                        />
                      </div>
                      <div>
                        <label style={fieldLabel}>Alt Phone</label>
                        <input
                          style={inputStyle}
                          placeholder="Alternate phone"
                          value={formData.alt_phone}
                          onChange={(e) => setFormData({ ...formData, alt_phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        />
                      </div>
                    </div>
                  </div>
                </IronCard>

                {/* Delivery Address */}
                <IronCard>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontFamily: T.headline, fontWeight: 700, fontSize: 14 }}>
                    <MapPin size={16} color={T.orange} /> Delivery Address
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={fieldLabel}>Address Line 1 *</label>
                      <input
                        style={inputStyle}
                        placeholder="House/Building, Street"
                        value={formData.address_line1}
                        onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                        data-testid="input-address1"
                      />
                    </div>
                    <div>
                      <label style={fieldLabel}>Address Line 2</label>
                      <input
                        style={inputStyle}
                        placeholder="Area, Colony"
                        value={formData.address_line2}
                        onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={fieldLabel}>Landmark</label>
                        <input
                          style={inputStyle}
                          placeholder="Near..."
                          value={formData.landmark}
                          onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={fieldLabel}>Pincode *</label>
                        <input
                          style={inputStyle}
                          placeholder="6-digit PIN"
                          value={formData.pincode}
                          onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                          data-testid="input-pincode"
                        />
                      </div>
                    </div>
                  </div>
                </IronCard>

                {/* Package Details */}
                <IronCard>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontFamily: T.headline, fontWeight: 700, fontSize: 14 }}>
                    <Box size={16} color={T.orange} /> Package Details
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={fieldLabel}>Product Name *</label>
                      <input
                        style={inputStyle}
                        placeholder="e.g., Solar Inverter 5KW"
                        value={formData.product_name}
                        onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                        data-testid="input-product"
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={fieldLabel}>Category</label>
                        <Select
                          value={formData.product_category}
                          onValueChange={(val) => setFormData({ ...formData, product_category: val })}
                        >
                          <SelectTrigger style={inputStyle}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Electronics">Electronics</SelectItem>
                            <SelectItem value="Machinery">Machinery</SelectItem>
                            <SelectItem value="Auto Parts">Auto Parts</SelectItem>
                            <SelectItem value="Others">Others</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label style={fieldLabel}>HSN Code</label>
                        <input
                          style={inputStyle}
                          placeholder="HSN code"
                          value={formData.hsn}
                          onChange={(e) => setFormData({ ...formData, hsn: e.target.value })}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      <div>
                        <label style={fieldLabel}>Weight (kg) *</label>
                        <input
                          type="number"
                          style={inputStyle}
                          placeholder="KG"
                          value={formData.weight}
                          onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                          data-testid="input-weight"
                        />
                      </div>
                      <div>
                        <label style={fieldLabel}>L (cm)</label>
                        <input
                          type="number"
                          style={inputStyle}
                          placeholder="cm"
                          value={formData.length}
                          onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={fieldLabel}>W (cm)</label>
                        <input
                          type="number"
                          style={inputStyle}
                          placeholder="cm"
                          value={formData.width}
                          onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={fieldLabel}>H (cm)</label>
                        <input
                          type="number"
                          style={inputStyle}
                          placeholder="cm"
                          value={formData.height}
                          onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </IronCard>

                {/* Invoice & Payment */}
                <IronCard>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontFamily: T.headline, fontWeight: 700, fontSize: 14 }}>
                    <IndianRupee size={16} color={T.orange} /> Invoice & Payment
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={fieldLabel}>Invoice Number</label>
                        <input
                          style={inputStyle}
                          placeholder="INV-XXXX"
                          value={formData.invoice_number}
                          onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                          data-testid="input-invoice-no"
                        />
                      </div>
                      <div>
                        <label style={fieldLabel}>Invoice Amount (Rs.)</label>
                        <input
                          type="number"
                          style={inputStyle}
                          placeholder="Amount"
                          value={formData.invoice_amount}
                          onChange={(e) => setFormData({ ...formData, invoice_amount: e.target.value })}
                          data-testid="input-invoice-amount"
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={fieldLabel}>Payment Type</label>
                        <Select
                          value={formData.payment_type}
                          onValueChange={(val) => setFormData({ ...formData, payment_type: val })}
                        >
                          <SelectTrigger style={inputStyle}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Prepaid">Prepaid</SelectItem>
                            <SelectItem value="COD">Cash on Delivery</SelectItem>
                            {shipmentCategory === 'b2b' && (
                              <SelectItem value="ToPay">To Pay</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.payment_type === 'COD' && (
                        <div>
                          <label style={fieldLabel}>COD Amount</label>
                          <input
                            type="number"
                            style={inputStyle}
                            placeholder="Amount to collect"
                            value={formData.cod_amount}
                            onChange={(e) => setFormData({ ...formData, cod_amount: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                    {/* Invoice upload */}
                    <div>
                      <label style={fieldLabel}>Upload Invoice (PDF/Image)</label>
                      <Input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => handleFileChange(e, 'invoice')}
                        className="cursor-pointer"
                      />
                      {invoiceFile && (
                        <p style={{ fontSize: 12, color: T.green, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle size={12} /> {invoiceFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </IronCard>

                {/* E-way Bill (B2B with invoice > 50000) */}
                {shipmentCategory === 'b2b' && (
                  <IronCard style={parseFloat(formData.invoice_amount) > 50000 ? { border: `1px solid ${T.orange}` } : undefined}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontFamily: T.headline, fontWeight: 700, fontSize: 14 }}>
                      <FileText size={16} color={T.orange} /> E-Way Bill
                      {parseFloat(formData.invoice_amount) > 50000 && (
                        <span style={badgeStyle('bad')}>Required</span>
                      )}
                    </div>
                    {parseFloat(formData.invoice_amount) > 50000 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.orangeDeep, fontSize: 12, marginBottom: 8 }}>
                        <AlertTriangle size={14} /> E-way bill is mandatory for B2B shipments over Rs. 50,000
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label style={fieldLabel}>E-Way Bill Number {parseFloat(formData.invoice_amount) > 50000 && '*'}</label>
                        <input
                          style={inputStyle}
                          placeholder="12-digit e-way bill number"
                          value={formData.ewaybill_number}
                          onChange={(e) => setFormData({ ...formData, ewaybill_number: e.target.value })}
                          data-testid="input-ewaybill"
                        />
                      </div>
                      <div>
                        <label style={fieldLabel}>Upload E-Way Bill (PDF/Image)</label>
                        <Input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={(e) => handleFileChange(e, 'ewaybill')}
                          className="cursor-pointer"
                        />
                        {ewaybillFile && (
                          <p style={{ fontSize: 12, color: T.green, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} /> {ewaybillFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </IronCard>
                )}

                {/* Action Buttons */}
                <IronCard style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button
                      style={{ ...outlineBtn, opacity: calculatingRates ? 0.6 : 1 }}
                      onClick={calculateRates}
                      disabled={calculatingRates}
                      data-testid="calculate-rates-btn"
                    >
                      {calculatingRates ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                      Calculate Rates
                    </button>
                    <button
                      style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }}
                      onClick={createShipment}
                      disabled={loading}
                      data-testid="create-shipment-btn"
                    >
                      {loading ? <Loader2 size={15} className="animate-spin" /> : <Package size={15} />}
                      Create Shipment
                    </button>
                  </div>
                  {/* Rate preview */}
                  {rates.length > 0 && !createdShipment && (
                    <div style={{ marginTop: 16, padding: 14, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                      <p style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 8 }}>Available Rates ({rates.length} options)</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {rates.slice(0, 5).map((rate) => (
                          <span key={rate.courier_id} style={badgeStyle('slate')}>
                            {rate.courier_name}: Rs.{rate.total_shipping_charges}
                          </span>
                        ))}
                        {rates.length > 5 && (
                          <span style={badgeStyle('info')}>+{rates.length - 5} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </IronCard>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <IronCard pad={0}>
            {/* Header + search */}
            <div style={{ padding: 14, borderBottom: `1px solid ${T.iron200}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15 }}>Shipment History</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={15} color={T.iron400} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      placeholder="Search by name, phone, AWB..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ ...inputStyle, paddingLeft: 30, width: 256 }}
                      onKeyDown={(e) => e.key === 'Enter' && fetchShipments()}
                    />
                  </div>
                  <button style={{ ...outlineBtn, padding: '7px 10px' }} onClick={fetchShipments} disabled={shipmentsLoading}>
                    <RefreshCw size={15} className={shipmentsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
              {/* Quick filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }}>
                {quickFilters.map(([val, label]) => {
                  const active = statusFilter === val;
                  const isNP = val === 'NOT PICKED';
                  let style = {
                    padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontFamily: T.headline, fontWeight: 700,
                    cursor: 'pointer', border: `1px solid ${T.iron200}`, background: T.white, color: T.iron500,
                  };
                  if (active) {
                    style = isNP
                      ? { ...style, background: T.orangeDeep, color: '#fff', border: `1px solid ${T.orangeDeep}` }
                      : { ...style, background: T.orange, color: '#fff', border: `1px solid ${T.orange}` };
                  } else if (isNP && notPicked.total) {
                    style = { ...style, border: '1px solid #F6D8BA', color: T.orangeDeep };
                  }
                  return (
                    <button key={val || 'all'} onClick={() => setStatusFilter(val)} style={style}>
                      {label}
                    </button>
                  );
                })}
              </div>
              {statusFilter === 'NOT PICKED' && notPicked.total > 0 && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 8, borderRadius: 6, border: '1px solid #F6D8BA', background: '#FDEEE6', padding: 12, fontSize: 12.5 }}>
                  <AlertTriangle size={15} color={T.orangeDeep} style={{ marginTop: 1, flexShrink: 0 }} />
                  <p style={{ color: T.orangeDeep }}>
                    <strong>{notPicked.recent}</strong> parcels booked but not yet collected by the courier
                    {notPicked.stale > 0 && (
                      <> · <strong>{notPicked.stale}</strong> are stale (&gt;30 days old — likely dead bookings, not real pending pickups)</>
                    )}. Rows older than 30 days are dimmed.
                  </p>
                </div>
              )}
            </div>

            {/* Table body */}
            {shipmentsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                <Loader2 size={30} className="animate-spin" color={T.iron400} />
              </div>
            ) : shipments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: T.iron500 }}>
                <Package size={44} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p>No shipments found</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {HISTORY_COLS.map((h) => (
                        <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((shipment) => {
                      const np = isNotPicked(shipment.status);
                      const pickedUp = isPickedUp(shipment.status);
                      const age = daysSince(shipment.created_at);
                      const stale = np && age != null && age > 30;
                      let rowStyle = { borderBottom: `1px solid ${T.iron200}` };
                      if (np) {
                        rowStyle = stale
                          ? { ...rowStyle, background: '#FDF6F1', opacity: 0.6 }
                          : { ...rowStyle, background: '#FDEEE6', borderLeft: `2px solid ${T.orangeDeep}` };
                      } else if (pickedUp) {
                        rowStyle = { ...rowStyle, background: T.greenTint, borderLeft: `2px solid ${T.green}` };
                      }
                      return (
                        <tr key={shipment.id} className="iron-row" style={rowStyle}>
                          <td style={{ ...tdCell, ...mono }}>{shipment.bigship_order_id}</td>
                          <td style={tdCell}>
                            <p style={{ fontWeight: 600, color: T.iron900 }}>{shipment.customer_name}</p>
                            <p style={{ ...mono, fontSize: 11, color: T.iron500 }}>{shipment.phone}</p>
                          </td>
                          <td style={{ ...tdCell, ...mono }}>{shipment.pincode}</td>
                          <td style={tdCell}>
                            <p>{shipment.product_name}</p>
                            <p style={{ fontSize: 11, color: T.iron500 }}>{shipment.weight} kg</p>
                          </td>
                          <td style={{ ...tdCell, ...mono }}>{shipment.awb_number || '-'}</td>
                          <td style={tdCell}>{shipment.courier_name || '-'}</td>
                          <td style={tdCell}>
                            {getStatusBadge(shipment.status)}
                            {np && age != null && (
                              <span style={{ display: 'block', fontSize: 11, marginTop: 2, color: stale ? T.iron500 : T.orangeDeep, fontWeight: stale ? 400 : 600 }}>
                                {age}d {stale ? '· stale' : 'waiting'}
                              </span>
                            )}
                            {pickedUp && (
                              <span style={{ display: 'block', fontSize: 11, marginTop: 2, color: T.green, fontWeight: 600 }}>✓ picked up</span>
                            )}
                          </td>
                          <td style={tdCell}>
                            {shipment.status === 'manifested' && shipment.bigship_order_id && (
                              <button
                                style={{ ...outlineBtn, padding: '4px 8px', fontSize: 11 }}
                                onClick={() => downloadLabel(shipment.bigship_order_id)}
                              >
                                <Download size={12} /> Label
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </IronCard>
        )}
      </div>
    </IronShell>
  );
}

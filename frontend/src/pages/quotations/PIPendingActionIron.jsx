import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Package, Truck, Factory, ShoppingCart, Clock,
  CheckCircle, ArrowRight, Loader2, Eye,
  Upload, FileText, X, User, MapPin, Hash
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };

const BUCKET_CONFIG = {
  stock_available: { label: 'Stock Available', tone: T.green, badge: 'ok', icon: CheckCircle },
  pending_production: { label: 'Pending Production', tone: '#6D4AB0', badge: 'violet', icon: Factory },
  pending_procurement: { label: 'Pending Procurement', tone: T.blue, badge: 'info', icon: ShoppingCart },
  pending_dispatch: { label: 'Pending Dispatch', tone: T.blue, badge: 'info', icon: Truck },
  expired: { label: 'Expired', tone: T.orangeDeep, badge: 'bad', icon: Clock }
};

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
  'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Lakshadweep'
];

export default function PIPendingAction() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ buckets: {}, counts: {}, total: 0 });
  const [selectedBucket, setSelectedBucket] = useState('stock_available');
  const [actionLoading, setActionLoading] = useState(null);

  // Selection state for bulk operations
  const [selectedPIs, setSelectedPIs] = useState(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkConvertLoading, setBulkConvertLoading] = useState(false);
  const [bulkConvertIndex, setBulkConvertIndex] = useState(0);
  const [bulkForms, setBulkForms] = useState([]);

  // Conversion modal state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertForm, setConvertForm] = useState({
    customer_first_name: '',
    customer_last_name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    tracking_id: '',
    invoice_number: '',
    carrier_name: '',
    notes: ''
  });
  const [shippingLabelFile, setShippingLabelFile] = useState(null);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [paymentReceived, setPaymentReceived] = useState(false);

  const shippingLabelRef = useRef(null);
  const invoiceRef = useRef(null);
  const bulkShippingRef = useRef(null);
  const bulkInvoiceRef = useRef(null);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API}/quotations/pending-action`, { headers });
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load pending quotations');
    } finally {
      setLoading(false);
    }
  };

  const openConvertModal = (quotation) => {
    setSelectedQuotation(quotation);
    // Pre-fill form with existing customer data
    const nameParts = (quotation.customer_name || '').split(' ');
    setConvertForm({
      customer_first_name: nameParts[0] || '',
      customer_last_name: nameParts.slice(1).join(' ') || '',
      phone: quotation.customer_phone || '',
      address: quotation.customer_address || '',
      city: quotation.customer_city || '',
      state: quotation.customer_state || '',
      pincode: quotation.customer_pincode || '',
      tracking_id: '',
      invoice_number: '',
      carrier_name: '',
      notes: ''
    });
    setShippingLabelFile(null);
    setInvoiceFile(null);
    setShowConvertModal(true);
  };

  const closeConvertModal = () => {
    setShowConvertModal(false);
    setSelectedQuotation(null);
    setConvertForm({
      customer_first_name: '',
      customer_last_name: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      tracking_id: '',
      invoice_number: '',
      carrier_name: '',
      notes: ''
    });
    setShippingLabelFile(null);
    setInvoiceFile(null);
    setPaymentReceived(false);
  };

  const validateConvertForm = () => {
    if (!convertForm.customer_first_name.trim()) return 'Customer first name is required';
    if (!convertForm.customer_last_name.trim()) return 'Customer last name is required';
    if (!convertForm.address.trim()) return 'Full address is required';
    if (!convertForm.city.trim()) return 'City is required';
    if (!convertForm.state.trim()) return 'State is required';
    if (!convertForm.pincode.trim() || convertForm.pincode.trim().length !== 6) return 'Valid 6-digit pincode is required';
    if (!convertForm.tracking_id.trim()) return 'Tracking ID is required';
    if (!convertForm.invoice_number.trim()) return 'Invoice number is required';
    if (!shippingLabelFile) return 'Shipping label PDF is required';
    if (!invoiceFile) return 'Invoice PDF is required';
    return null;
  };

  const handleConvertToFulfillment = async () => {
    const validationError = validateConvertForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setConvertLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const formData = new FormData();

      formData.append('customer_first_name', convertForm.customer_first_name.trim());
      formData.append('customer_last_name', convertForm.customer_last_name.trim());
      formData.append('phone', convertForm.phone.trim());
      formData.append('address', convertForm.address.trim());
      formData.append('city', convertForm.city.trim());
      formData.append('state', convertForm.state.trim());
      formData.append('pincode', convertForm.pincode.trim());
      formData.append('tracking_id', convertForm.tracking_id.trim());
      formData.append('invoice_number', convertForm.invoice_number.trim());
      formData.append('carrier_name', convertForm.carrier_name.trim());
      formData.append('notes', convertForm.notes.trim());
      formData.append('shipping_label_pdf', shippingLabelFile);
      formData.append('invoice_pdf', invoiceFile);
      formData.append('payment_received', paymentReceived ? 'true' : 'false');

      await axios.post(
        `${API}/quotations/${selectedQuotation.id}/convert-to-fulfillment`,
        formData,
        { headers }
      );

      toast.success('PI converted to dispatch queue successfully!');
      closeConvertModal();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Conversion failed');
    } finally {
      setConvertLoading(false);
    }
  };

  const handleLegacyConvert = async (quotationId, conversionType) => {
    setActionLoading(quotationId);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/quotations/${quotationId}/convert`, null, {
        headers,
        params: { conversion_type: conversionType }
      });

      toast.success(`Quotation converted to ${conversionType}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Conversion failed');
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short'
    });
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only PDF and image files are allowed');
        return;
      }
      if (type === 'shipping') {
        setShippingLabelFile(file);
      } else {
        setInvoiceFile(file);
      }
    }
  };

  // Bulk selection handlers
  const togglePISelection = (piId) => {
    const newSelected = new Set(selectedPIs);
    if (newSelected.has(piId)) {
      newSelected.delete(piId);
    } else {
      newSelected.add(piId);
    }
    setSelectedPIs(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedPIs.size === currentQuotations.length) {
      setSelectedPIs(new Set());
    } else {
      setSelectedPIs(new Set(currentQuotations.map(q => q.id)));
    }
  };

  const openBulkConvertModal = () => {
    const selectedQuotations = currentQuotations.filter(q => selectedPIs.has(q.id));
    if (selectedQuotations.length === 0) {
      toast.error('Please select at least one PI to convert');
      return;
    }

    // Initialize bulk forms with pre-filled customer data
    const forms = selectedQuotations.map(q => {
      const nameParts = (q.customer_name || '').split(' ');
      return {
        quotation: q,
        form: {
          customer_first_name: nameParts[0] || '',
          customer_last_name: nameParts.slice(1).join(' ') || '',
          phone: q.customer_phone || '',
          address: q.customer_address || '',
          city: q.customer_city || '',
          state: q.customer_state || '',
          pincode: q.customer_pincode || '',
          tracking_id: '',
          invoice_number: '',
          carrier_name: '',
          notes: ''
        },
        shippingLabel: null,
        invoice: null
      };
    });

    setBulkForms(forms);
    setBulkConvertIndex(0);
    setShowBulkModal(true);
  };

  const updateBulkForm = (index, field, value) => {
    setBulkForms(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        form: { ...updated[index].form, [field]: value }
      };
      return updated;
    });
  };

  const handleBulkFileChange = (e, type, index) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only PDF and image files are allowed');
        return;
      }
      setBulkForms(prev => {
        const updated = [...prev];
        if (type === 'shipping') {
          updated[index] = { ...updated[index], shippingLabel: file };
        } else {
          updated[index] = { ...updated[index], invoice: file };
        }
        return updated;
      });
    }
  };

  const validateBulkForm = (index) => {
    const item = bulkForms[index];
    const form = item.form;
    if (!form.customer_first_name.trim()) return 'Customer first name is required';
    if (!form.customer_last_name.trim()) return 'Customer last name is required';
    if (!form.address.trim()) return 'Full address is required';
    if (!form.city.trim()) return 'City is required';
    if (!form.state.trim()) return 'State is required';
    if (!form.pincode.trim() || form.pincode.trim().length !== 6) return 'Valid 6-digit pincode is required';
    if (!form.tracking_id.trim()) return 'Tracking ID is required';
    if (!form.invoice_number.trim()) return 'Invoice number is required';
    if (!item.shippingLabel) return 'Shipping label PDF is required';
    if (!item.invoice) return 'Invoice PDF is required';
    return null;
  };

  const submitCurrentBulkItem = async () => {
    const validationError = validateBulkForm(bulkConvertIndex);
    if (validationError) {
      toast.error(validationError);
      return false;
    }

    const item = bulkForms[bulkConvertIndex];
    setBulkConvertLoading(true);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const formData = new FormData();

      Object.entries(item.form).forEach(([key, value]) => {
        formData.append(key, (value || '').trim());
      });
      formData.append('shipping_label_pdf', item.shippingLabel);
      formData.append('invoice_pdf', item.invoice);

      await axios.post(
        `${API}/quotations/${item.quotation.id}/convert-to-fulfillment`,
        formData,
        { headers }
      );

      toast.success(`PI ${item.quotation.quotation_number} converted successfully!`);
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to convert ${item.quotation.quotation_number}`);
      return false;
    } finally {
      setBulkConvertLoading(false);
    }
  };

  const handleBulkNext = async () => {
    const success = await submitCurrentBulkItem();
    if (success) {
      if (bulkConvertIndex < bulkForms.length - 1) {
        setBulkConvertIndex(bulkConvertIndex + 1);
      } else {
        // All done
        setShowBulkModal(false);
        setSelectedPIs(new Set());
        fetchData();
        toast.success(`All ${bulkForms.length} PIs converted successfully!`);
      }
    }
  };

  const skipCurrentBulkItem = () => {
    if (bulkConvertIndex < bulkForms.length - 1) {
      setBulkConvertIndex(bulkConvertIndex + 1);
    } else {
      setShowBulkModal(false);
      setSelectedPIs(new Set());
      fetchData();
    }
  };

  const currentQuotations = data.buckets?.[selectedBucket] || [];

  const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
  const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
  const greenBtn = { ...primaryBtn, background: T.green };
  const sectionTitle = { fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900, display: 'flex', alignItems: 'center', gap: 6, margin: 0 };

  const headerRight = (
    <div style={{ display: 'flex', gap: 8 }}>
      {selectedPIs.size > 0 && (
        <button onClick={openBulkConvertModal} style={greenBtn} data-testid="bulk-convert-btn">
          <Truck size={14} /> Quick Convert ({selectedPIs.size})
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <IronShell title="PI Pending Action" subtitle="APPROVED PI · PENDING ACTION" onRefresh={fetchData}>
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      </IronShell>
    );
  }

  const CurBucketIcon = BUCKET_CONFIG[selectedBucket]?.icon || Package;

  return (
    <IronShell title="PI Pending Action" subtitle="CONVERT APPROVED QUOTATIONS INTO DISPATCH QUEUE" onRefresh={fetchData} headerRight={headerRight}>

      {/* Summary / bucket selector cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
        {Object.entries(BUCKET_CONFIG).map(([key, config]) => {
          const BucketIcon = config.icon;
          const count = data.counts?.[key] || 0;
          const active = selectedBucket === key;
          return (
            <IronCard key={key} pad={14} style={{ cursor: 'pointer', border: `1px solid ${active ? T.orange : T.iron200}`, boxShadow: active ? '0 0 0 2px rgba(245,130,32,.18)' : '0 1px 2px rgba(15,15,15,.06)' }}>
              <div onClick={() => setSelectedBucket(key)} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                  <BucketIcon size={18} color={config.tone} strokeWidth={1.9} />
                </div>
                <div>
                  <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{count}</div>
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{config.label}</Caps>
                </div>
              </div>
            </IronCard>
          );
        })}
      </div>

      {/* Current bucket table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          <CurBucketIcon size={16} color={T.orangeDeep} strokeWidth={2} />
          <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>
            {BUCKET_CONFIG[selectedBucket]?.label} ({currentQuotations.length})
          </span>
          {currentQuotations.length > 0 && (
            <span style={{ ...mono, fontSize: 11, color: T.iron400 }}>Select items for bulk conversion</span>
          )}
        </div>

        {currentQuotations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Package size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No quotations in this bucket</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  <th style={{ ...thCell, width: 36 }}>
                    <input
                      type="checkbox"
                      checked={selectedPIs.size === currentQuotations.length && currentQuotations.length > 0}
                      onChange={toggleSelectAll}
                      style={{ width: 15, height: 15, accentColor: T.orange, cursor: 'pointer' }}
                    />
                  </th>
                  <th style={thCell}><Caps size={8.5}>PI Number</Caps></th>
                  <th style={thCell}><Caps size={8.5}>Customer</Caps></th>
                  <th style={thCell}><Caps size={8.5}>Items</Caps></th>
                  <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Value</Caps></th>
                  <th style={thCell}><Caps size={8.5}>Approved</Caps></th>
                  <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Actions</Caps></th>
                </tr>
              </thead>
              <tbody>
                {currentQuotations.map((q) => {
                  const selected = selectedPIs.has(q.id);
                  return (
                    <tr key={q.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, background: selected ? '#FDF3EA' : undefined }}>
                      <td style={{ ...tdCell }}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => togglePISelection(q.id)}
                          style={{ width: 15, height: 15, accentColor: T.orange, cursor: 'pointer' }}
                          data-testid={`select-pi-${q.id}`}
                        />
                      </td>
                      <td style={tdCell}>
                        <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{q.quotation_number}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.iron400, marginTop: 2 }}>{q.firm_name}</div>
                      </td>
                      <td style={tdCell}>
                        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{q.customer_name}</div>
                        <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{q.customer_phone}</div>
                      </td>
                      <td style={{ ...tdCell, maxWidth: 260 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {q.items?.slice(0, 2).map((item, idx) => (
                            <div key={idx} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ color: T.iron700 }}>{item.name}</span>
                              <span style={{ ...mono, color: T.iron400 }}>x{item.quantity}</span>
                              {item.current_stock !== undefined && (
                                <span style={badgeStyle(item.current_stock >= item.quantity ? 'ok' : 'bad')}>Stock: {item.current_stock}</span>
                              )}
                            </div>
                          ))}
                          {q.items?.length > 2 && (
                            <div style={{ ...mono, fontSize: 10.5, color: T.iron400 }}>+{q.items.length - 2} more</div>
                          )}
                        </div>
                      </td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        <span style={{ ...mono, fontWeight: 700, fontSize: 12.5, color: T.iron900 }}>{formatCurrency(q.grand_total)}</span>
                      </td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{formatDate(q.approved_at)}</td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            onClick={() => navigate(`/quotations?view=${q.id}`)}
                            title="View"
                            style={outlineBtn}
                            data-testid={`view-pi-${q.id}`}
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => openConvertModal(q)}
                            disabled={actionLoading === q.id}
                            style={{ ...primaryBtn, opacity: actionLoading === q.id ? 0.6 : 1 }}
                            data-testid={`convert-pi-${q.id}`}
                          >
                            {actionLoading === q.id ? <Loader2 className="animate-spin" size={14} /> : <><Truck size={13} /> To Dispatch Queue</>}
                          </button>
                          <Select
                            onValueChange={(v) => handleLegacyConvert(q.id, v)}
                            disabled={actionLoading === q.id}
                          >
                            <SelectTrigger style={{ width: 40, height: 32, padding: 0, justifyContent: 'center', border: `1px solid ${T.iron200}`, background: T.white, color: T.iron500 }}>
                              <span style={{ fontWeight: 700, fontSize: 16, lineHeight: 1 }}>…</span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="production">Send to Production</SelectItem>
                              <SelectItem value="procurement">Send to Procurement</SelectItem>
                            </SelectContent>
                          </Select>
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

      {/* Convert to Fulfillment Modal */}
      <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-orange-500" />
              Convert to Dispatch Queue
            </DialogTitle>
            <DialogDescription>
              Fill all mandatory fields to add PI to dispatch queue
            </DialogDescription>
          </DialogHeader>

          {selectedQuotation && (
            <div className="space-y-6 mt-2">
              {/* PI Summary */}
              <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ ...mono, fontWeight: 700, fontSize: 12.5, color: T.orangeDeep }}>{selectedQuotation.quotation_number}</div>
                    <div style={{ ...mono, fontWeight: 700, fontSize: 15, color: T.iron900, marginTop: 4 }}>{formatCurrency(selectedQuotation.grand_total)}</div>
                  </div>
                  <span style={badgeStyle('ok')}>Approved</span>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: T.iron500 }}>
                  {selectedQuotation.items?.length || 0} item(s): {selectedQuotation.items?.map(i => i.name).join(', ')}
                </div>
              </div>

              {/* Customer Details */}
              <div className="space-y-4">
                <h3 style={sectionTitle}><User size={15} color={T.orangeDeep} /> Customer Details <span style={{ color: T.orange }}>*</span></h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name *</Label>
                    <Input value={convertForm.customer_first_name} onChange={(e) => setConvertForm({ ...convertForm, customer_first_name: e.target.value })} className="mt-1" placeholder="First name" data-testid="convert-first-name" />
                  </div>
                  <div>
                    <Label>Last Name *</Label>
                    <Input value={convertForm.customer_last_name} onChange={(e) => setConvertForm({ ...convertForm, customer_last_name: e.target.value })} className="mt-1" placeholder="Last name" data-testid="convert-last-name" />
                  </div>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={convertForm.phone} onChange={(e) => setConvertForm({ ...convertForm, phone: e.target.value })} className="mt-1" placeholder="10-digit phone number" data-testid="convert-phone" />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h3 style={sectionTitle}><MapPin size={15} color={T.orangeDeep} /> Shipping Address <span style={{ color: T.orange }}>*</span></h3>
                <div>
                  <Label>Full Address *</Label>
                  <Textarea value={convertForm.address} onChange={(e) => setConvertForm({ ...convertForm, address: e.target.value })} className="mt-1" placeholder="House/Flat No, Street, Landmark" rows={2} data-testid="convert-address" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>City *</Label>
                    <Input value={convertForm.city} onChange={(e) => setConvertForm({ ...convertForm, city: e.target.value })} className="mt-1" placeholder="City" data-testid="convert-city" />
                  </div>
                  <div>
                    <Label>State *</Label>
                    <Select value={convertForm.state} onValueChange={(v) => setConvertForm({ ...convertForm, state: v })}>
                      <SelectTrigger className="mt-1" data-testid="convert-state">
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
                    <Label>Pincode *</Label>
                    <Input value={convertForm.pincode} onChange={(e) => setConvertForm({ ...convertForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} className="mt-1" placeholder="6-digit" maxLength={6} data-testid="convert-pincode" />
                  </div>
                </div>
              </div>

              {/* Tracking & Invoice */}
              <div className="space-y-4">
                <h3 style={sectionTitle}><Hash size={15} color={T.orangeDeep} /> Tracking &amp; Invoice <span style={{ color: T.orange }}>*</span></h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tracking ID *</Label>
                    <Input value={convertForm.tracking_id} onChange={(e) => setConvertForm({ ...convertForm, tracking_id: e.target.value })} className="mt-1" placeholder="AWB / Tracking number" data-testid="convert-tracking-id" />
                  </div>
                  <div>
                    <Label>Carrier / Courier</Label>
                    <Input value={convertForm.carrier_name} onChange={(e) => setConvertForm({ ...convertForm, carrier_name: e.target.value })} className="mt-1" placeholder="e.g., BlueDart, DTDC" data-testid="convert-carrier" />
                  </div>
                </div>
                <div>
                  <Label>Invoice Number / Order ID *</Label>
                  <Input value={convertForm.invoice_number} onChange={(e) => setConvertForm({ ...convertForm, invoice_number: e.target.value })} className="mt-1" placeholder="Invoice number or Order ID" data-testid="convert-invoice-number" />
                </div>
              </div>

              {/* File Uploads */}
              <div className="space-y-4">
                <h3 style={sectionTitle}><FileText size={15} color={T.orangeDeep} /> Required Documents <span style={{ color: T.orange }}>*</span></h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Shipping Label PDF *</Label>
                    <input type="file" ref={shippingLabelRef} accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileChange(e, 'shipping')} className="hidden" data-testid="convert-shipping-label-input" />
                    <div
                      onClick={() => shippingLabelRef.current?.click()}
                      data-testid="convert-shipping-label-drop"
                      style={{ marginTop: 4, border: `2px dashed ${shippingLabelFile ? T.green : T.iron200}`, background: shippingLabelFile ? T.greenTint : T.white, borderRadius: 8, padding: 16, textAlign: 'center', cursor: 'pointer' }}
                    >
                      {shippingLabelFile ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: T.green }}>
                          <CheckCircle size={18} />
                          <span style={{ fontSize: 12, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shippingLabelFile.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); setShippingLabelFile(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.orangeDeep }}><X size={15} /></button>
                        </div>
                      ) : (
                        <div style={{ color: T.iron400 }}>
                          <Upload size={22} style={{ margin: '0 auto 4px' }} />
                          <div style={{ fontSize: 11 }}>Click to upload</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Invoice PDF *</Label>
                    <input type="file" ref={invoiceRef} accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileChange(e, 'invoice')} className="hidden" data-testid="convert-invoice-pdf-input" />
                    <div
                      onClick={() => invoiceRef.current?.click()}
                      data-testid="convert-invoice-pdf-drop"
                      style={{ marginTop: 4, border: `2px dashed ${invoiceFile ? T.green : T.iron200}`, background: invoiceFile ? T.greenTint : T.white, borderRadius: 8, padding: 16, textAlign: 'center', cursor: 'pointer' }}
                    >
                      {invoiceFile ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: T.green }}>
                          <CheckCircle size={18} />
                          <span style={{ fontSize: 12, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invoiceFile.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); setInvoiceFile(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.orangeDeep }}><X size={15} /></button>
                        </div>
                      ) : (
                        <div style={{ color: T.iron400 }}>
                          <Upload size={22} style={{ margin: '0 auto 4px' }} />
                          <div style={{ fontSize: 11 }}>Click to upload</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label>Notes (Optional)</Label>
                <Textarea value={convertForm.notes} onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })} className="mt-1" placeholder="Any additional notes..." rows={2} data-testid="convert-notes" />
              </div>

              {/* Payment confirmation — required when this PI has no admin-approved / Razorpay payment on file */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: paymentReceived ? '#f0fdf4' : '#fffbeb', border: `1px solid ${paymentReceived ? '#bbf7d0' : '#f5d9b0'}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={paymentReceived} onChange={(e) => setPaymentReceived(e.target.checked)} style={{ marginTop: 2 }} data-testid="convert-payment-received" />
                <span style={{ fontSize: 12.5, color: T.iron700 }}>
                  <b>I confirm payment has been received</b> for this PI.
                  <span style={{ display: 'block', color: T.iron500, fontSize: 11.5, marginTop: 2 }}>Required only if payment wasn't already approved (PI Payment Approvals) or paid via the Razorpay link. Your confirmation is logged.</span>
                </span>
              </label>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTop: `1px solid ${T.iron200}` }}>
                <button onClick={closeConvertModal} style={outlineBtn} data-testid="convert-cancel-btn">Cancel</button>
                <button onClick={handleConvertToFulfillment} disabled={convertLoading} style={{ ...primaryBtn, opacity: convertLoading ? 0.6 : 1 }} data-testid="convert-submit-btn">
                  {convertLoading ? <><Loader2 className="animate-spin" size={14} /> Converting...</> : <><Truck size={14} /> Add to Dispatch Queue</>}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Quick Convert Modal */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-green-600" />
              Quick Convert - {bulkConvertIndex + 1} of {bulkForms.length}
            </DialogTitle>
            <DialogDescription>
              Converting multiple PIs to dispatch queue. Fill tracking &amp; invoice for each.
            </DialogDescription>
          </DialogHeader>

          {bulkForms.length > 0 && bulkForms[bulkConvertIndex] && (
            <div className="space-y-4 mt-2">
              {/* Progress Bar */}
              <div style={{ width: '100%', background: T.iron200, borderRadius: 999, height: 8 }}>
                <div style={{ background: T.green, height: 8, borderRadius: 999, transition: 'all .2s', width: `${((bulkConvertIndex + 1) / bulkForms.length) * 100}%` }} />
              </div>

              {/* PI Summary */}
              <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ ...mono, fontWeight: 700, fontSize: 12.5, color: T.orangeDeep }}>{bulkForms[bulkConvertIndex].quotation.quotation_number}</div>
                    <div style={{ ...mono, fontWeight: 700, fontSize: 15, color: T.iron900, marginTop: 4 }}>{formatCurrency(bulkForms[bulkConvertIndex].quotation.grand_total)}</div>
                    <div style={{ fontSize: 12, color: T.iron500, marginTop: 4 }}>{bulkForms[bulkConvertIndex].quotation.customer_name}</div>
                  </div>
                  <span style={badgeStyle('ok')}>{bulkConvertIndex + 1}/{bulkForms.length}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: T.iron500 }}>
                  {bulkForms[bulkConvertIndex].quotation.items?.map(i => i.name).join(', ')}
                </div>
              </div>

              {/* Quick Form - Tracking & Invoice */}
              <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 14 }} className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <span style={{ ...sectionTitle, color: T.green }}><Hash size={14} /> Tracking &amp; Invoice (Required)</span>
                </div>
                <div>
                  <Label>Tracking ID *</Label>
                  <Input value={bulkForms[bulkConvertIndex].form.tracking_id} onChange={(e) => updateBulkForm(bulkConvertIndex, 'tracking_id', e.target.value)} className="mt-1" placeholder="AWB / Tracking number" data-testid="bulk-tracking-id" />
                </div>
                <div>
                  <Label>Carrier / Courier</Label>
                  <Input value={bulkForms[bulkConvertIndex].form.carrier_name} onChange={(e) => updateBulkForm(bulkConvertIndex, 'carrier_name', e.target.value)} className="mt-1" placeholder="e.g., Bluedart, DTDC" data-testid="bulk-carrier" />
                </div>
                <div className="col-span-2">
                  <Label>Invoice Number / Order ID *</Label>
                  <Input value={bulkForms[bulkConvertIndex].form.invoice_number} onChange={(e) => updateBulkForm(bulkConvertIndex, 'invoice_number', e.target.value)} className="mt-1" placeholder="Invoice number or Order ID" data-testid="bulk-invoice-number" />
                </div>
              </div>

              {/* File Uploads */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Shipping Label PDF *</Label>
                  <input type="file" ref={bulkShippingRef} accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleBulkFileChange(e, 'shipping', bulkConvertIndex)} className="hidden" />
                  <div
                    onClick={() => bulkShippingRef.current?.click()}
                    style={{ marginTop: 4, border: `2px dashed ${bulkForms[bulkConvertIndex].shippingLabel ? T.green : T.iron200}`, background: bulkForms[bulkConvertIndex].shippingLabel ? T.greenTint : T.white, borderRadius: 8, padding: 16, textAlign: 'center', cursor: 'pointer' }}
                  >
                    {bulkForms[bulkConvertIndex].shippingLabel ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: T.green }}>
                        <CheckCircle size={18} />
                        <span style={{ fontSize: 12, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bulkForms[bulkConvertIndex].shippingLabel.name}</span>
                      </div>
                    ) : (
                      <div style={{ color: T.iron400 }}>
                        <Upload size={22} style={{ margin: '0 auto 4px' }} />
                        <div style={{ fontSize: 11 }}>Shipping Label</div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Invoice PDF *</Label>
                  <input type="file" ref={bulkInvoiceRef} accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleBulkFileChange(e, 'invoice', bulkConvertIndex)} className="hidden" />
                  <div
                    onClick={() => bulkInvoiceRef.current?.click()}
                    style={{ marginTop: 4, border: `2px dashed ${bulkForms[bulkConvertIndex].invoice ? T.green : T.iron200}`, background: bulkForms[bulkConvertIndex].invoice ? T.greenTint : T.white, borderRadius: 8, padding: 16, textAlign: 'center', cursor: 'pointer' }}
                  >
                    {bulkForms[bulkConvertIndex].invoice ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: T.green }}>
                        <CheckCircle size={18} />
                        <span style={{ fontSize: 12, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bulkForms[bulkConvertIndex].invoice.name}</span>
                      </div>
                    ) : (
                      <div style={{ color: T.iron400 }}>
                        <Upload size={22} style={{ margin: '0 auto 4px' }} />
                        <div style={{ fontSize: 11 }}>Invoice PDF</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Collapsible Customer Details */}
              <details style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                <summary style={{ cursor: 'pointer', padding: 12, color: T.iron500, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={14} /> Customer Details (pre-filled, click to edit)
                </summary>
                <div className="grid grid-cols-2 gap-4" style={{ padding: 14, paddingTop: 0 }}>
                  <div>
                    <Label>First Name *</Label>
                    <Input value={bulkForms[bulkConvertIndex].form.customer_first_name} onChange={(e) => updateBulkForm(bulkConvertIndex, 'customer_first_name', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Last Name *</Label>
                    <Input value={bulkForms[bulkConvertIndex].form.customer_last_name} onChange={(e) => updateBulkForm(bulkConvertIndex, 'customer_last_name', e.target.value)} className="mt-1" />
                  </div>
                  <div className="col-span-2">
                    <Label>Full Address *</Label>
                    <Textarea value={bulkForms[bulkConvertIndex].form.address} onChange={(e) => updateBulkForm(bulkConvertIndex, 'address', e.target.value)} className="mt-1" rows={2} />
                  </div>
                  <div>
                    <Label>City *</Label>
                    <Input value={bulkForms[bulkConvertIndex].form.city} onChange={(e) => updateBulkForm(bulkConvertIndex, 'city', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>State *</Label>
                    <Select value={bulkForms[bulkConvertIndex].form.state} onValueChange={(v) => updateBulkForm(bulkConvertIndex, 'state', v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {INDIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Pincode *</Label>
                    <Input value={bulkForms[bulkConvertIndex].form.pincode} onChange={(e) => updateBulkForm(bulkConvertIndex, 'pincode', e.target.value)} className="mt-1" placeholder="6-digit pincode" maxLength={6} />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={bulkForms[bulkConvertIndex].form.phone} onChange={(e) => updateBulkForm(bulkConvertIndex, 'phone', e.target.value)} className="mt-1" />
                  </div>
                </div>
              </details>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingTop: 14, borderTop: `1px solid ${T.iron200}` }}>
                <button onClick={skipCurrentBulkItem} style={outlineBtn}>Skip This</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setShowBulkModal(false); setSelectedPIs(new Set()); }} style={outlineBtn}>Cancel All</button>
                  <button onClick={handleBulkNext} disabled={bulkConvertLoading} style={{ ...greenBtn, opacity: bulkConvertLoading ? 0.6 : 1 }} data-testid="bulk-convert-next">
                    {bulkConvertLoading ? <><Loader2 className="animate-spin" size={14} /> Converting...</> : <><ArrowRight size={14} /> {bulkConvertIndex < bulkForms.length - 1 ? 'Convert & Next' : 'Convert & Finish'}</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

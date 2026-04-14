import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Package, Truck, Factory, ShoppingCart, Clock, AlertTriangle,
  CheckCircle, ArrowRight, Loader2, RefreshCw, Eye, IndianRupee,
  Upload, FileText, X, User, MapPin, Hash, Receipt
} from 'lucide-react';

const BUCKET_CONFIG = {
  stock_available: { label: 'Stock Available', color: 'bg-green-600', icon: CheckCircle },
  pending_production: { label: 'Pending Production', color: 'bg-purple-600', icon: Factory },
  pending_procurement: { label: 'Pending Procurement', color: 'bg-blue-600', icon: ShoppingCart },
  pending_dispatch: { label: 'Pending Dispatch', color: 'bg-cyan-600', icon: Truck },
  expired: { label: 'Expired', color: 'bg-orange-600', icon: Clock }
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
  
  const shippingLabelRef = useRef(null);
  const invoiceRef = useRef(null);

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

  const currentQuotations = data.buckets?.[selectedBucket] || [];

  if (loading) {
    return (
      <DashboardLayout title="Approved PI - Pending Action">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Approved PI - Pending Action">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Approved PI - Pending Action</h1>
            <p className="text-slate-400">Convert approved quotations into dispatch queue</p>
          </div>
          <Button 
            variant="outline" 
            onClick={fetchData}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(BUCKET_CONFIG).map(([key, config]) => {
            const BucketIcon = config.icon;
            const count = data.counts?.[key] || 0;
            
            return (
              <Card 
                key={key}
                className={`bg-slate-800 border-slate-700 cursor-pointer transition-all ${
                  selectedBucket === key ? 'ring-2 ring-cyan-500' : 'hover:border-slate-600'
                }`}
                onClick={() => setSelectedBucket(key)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color}/20`}>
                      <BucketIcon className={`w-5 h-5 ${config.color.replace('bg-', 'text-').replace('-600', '-400')}`} />
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">{config.label}</p>
                      <p className="text-2xl font-bold text-white">{count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Current Bucket */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {React.createElement(BUCKET_CONFIG[selectedBucket]?.icon || Package, { className: 'w-5 h-5 text-cyan-400' })}
              {BUCKET_CONFIG[selectedBucket]?.label} ({currentQuotations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-400">PI Number</TableHead>
                  <TableHead className="text-slate-400">Customer</TableHead>
                  <TableHead className="text-slate-400">Items</TableHead>
                  <TableHead className="text-slate-400 text-right">Value</TableHead>
                  <TableHead className="text-slate-400">Approved</TableHead>
                  <TableHead className="text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentQuotations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                      <Package className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                      <p>No quotations in this bucket</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentQuotations.map((q) => (
                    <TableRow key={q.id} className="border-slate-700">
                      <TableCell>
                        <p className="text-white font-mono text-sm">{q.quotation_number}</p>
                        <p className="text-slate-500 text-xs">{q.firm_name}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-white">{q.customer_name}</p>
                        <p className="text-slate-400 text-sm">{q.customer_phone}</p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {q.items?.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="text-slate-300">{item.name}</span>
                              <span className="text-slate-500 ml-2">x{item.quantity}</span>
                              {item.current_stock !== undefined && (
                                <Badge 
                                  variant="outline" 
                                  className={`ml-2 text-xs ${
                                    item.current_stock >= item.quantity 
                                      ? 'border-green-600 text-green-400' 
                                      : 'border-red-600 text-red-400'
                                  }`}
                                >
                                  Stock: {item.current_stock}
                                </Badge>
                              )}
                            </div>
                          ))}
                          {q.items?.length > 2 && (
                            <p className="text-slate-500 text-xs">+{q.items.length - 2} more</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-white font-semibold">{formatCurrency(q.grand_total)}</p>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {formatDate(q.approved_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => navigate(`/quotations?view=${q.id}`)}
                            className="text-slate-400 hover:text-white"
                            data-testid={`view-pi-${q.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {/* Main action: Convert to Dispatch Queue */}
                          <Button
                            size="sm"
                            onClick={() => openConvertModal(q)}
                            disabled={actionLoading === q.id}
                            className="bg-cyan-600 hover:bg-cyan-700"
                            data-testid={`convert-pi-${q.id}`}
                          >
                            {actionLoading === q.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Truck className="w-4 h-4 mr-1" />
                                To Dispatch Queue
                              </>
                            )}
                          </Button>
                          
                          {/* Alternative actions dropdown */}
                          <Select 
                            onValueChange={(v) => handleLegacyConvert(q.id, v)}
                            disabled={actionLoading === q.id}
                          >
                            <SelectTrigger className="w-10 h-8 bg-slate-900 border-slate-700 p-0">
                              <span className="text-slate-400">...</span>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700">
                              <SelectItem value="production">Send to Production</SelectItem>
                              <SelectItem value="procurement">Send to Procurement</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Convert to Fulfillment Modal */}
        <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-cyan-400" />
                Convert to Dispatch Queue
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Fill all mandatory fields to add PI to dispatch queue
              </DialogDescription>
            </DialogHeader>

            {selectedQuotation && (
              <div className="space-y-6 mt-4">
                {/* PI Summary */}
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-cyan-400 font-mono text-sm">{selectedQuotation.quotation_number}</p>
                      <p className="text-white font-semibold mt-1">{formatCurrency(selectedQuotation.grand_total)}</p>
                    </div>
                    <Badge className="bg-green-600/20 text-green-400 border-green-600">
                      Approved
                    </Badge>
                  </div>
                  <div className="mt-3 text-sm text-slate-400">
                    <p>{selectedQuotation.items?.length || 0} item(s): {selectedQuotation.items?.map(i => i.name).join(', ')}</p>
                  </div>
                </div>

                {/* Customer Details Section */}
                <div className="space-y-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-400" />
                    Customer Details <span className="text-red-400">*</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">First Name *</Label>
                      <Input
                        value={convertForm.customer_first_name}
                        onChange={(e) => setConvertForm({...convertForm, customer_first_name: e.target.value})}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                        placeholder="First name"
                        data-testid="convert-first-name"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Last Name *</Label>
                      <Input
                        value={convertForm.customer_last_name}
                        onChange={(e) => setConvertForm({...convertForm, customer_last_name: e.target.value})}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                        placeholder="Last name"
                        data-testid="convert-last-name"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-300">Phone</Label>
                    <Input
                      value={convertForm.phone}
                      onChange={(e) => setConvertForm({...convertForm, phone: e.target.value})}
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                      placeholder="10-digit phone number"
                      data-testid="convert-phone"
                    />
                  </div>
                </div>

                {/* Address Section */}
                <div className="space-y-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    Shipping Address <span className="text-red-400">*</span>
                  </h3>
                  
                  <div>
                    <Label className="text-slate-300">Full Address *</Label>
                    <Textarea
                      value={convertForm.address}
                      onChange={(e) => setConvertForm({...convertForm, address: e.target.value})}
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                      placeholder="House/Flat No, Street, Landmark"
                      rows={2}
                      data-testid="convert-address"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-slate-300">City *</Label>
                      <Input
                        value={convertForm.city}
                        onChange={(e) => setConvertForm({...convertForm, city: e.target.value})}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                        placeholder="City"
                        data-testid="convert-city"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">State *</Label>
                      <Select 
                        value={convertForm.state} 
                        onValueChange={(v) => setConvertForm({...convertForm, state: v})}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-600 text-white mt-1" data-testid="convert-state">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                          {INDIAN_STATES.map(state => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300">Pincode *</Label>
                      <Input
                        value={convertForm.pincode}
                        onChange={(e) => setConvertForm({...convertForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                        placeholder="6-digit"
                        maxLength={6}
                        data-testid="convert-pincode"
                      />
                    </div>
                  </div>
                </div>

                {/* Tracking & Invoice Section */}
                <div className="space-y-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Hash className="w-4 h-4 text-cyan-400" />
                    Tracking & Invoice <span className="text-red-400">*</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Tracking ID *</Label>
                      <Input
                        value={convertForm.tracking_id}
                        onChange={(e) => setConvertForm({...convertForm, tracking_id: e.target.value})}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                        placeholder="AWB / Tracking number"
                        data-testid="convert-tracking-id"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Carrier / Courier</Label>
                      <Input
                        value={convertForm.carrier_name}
                        onChange={(e) => setConvertForm({...convertForm, carrier_name: e.target.value})}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                        placeholder="e.g., BlueDart, DTDC"
                        data-testid="convert-carrier"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-300">Invoice Number / Order ID *</Label>
                    <Input
                      value={convertForm.invoice_number}
                      onChange={(e) => setConvertForm({...convertForm, invoice_number: e.target.value})}
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                      placeholder="Invoice number or Order ID"
                      data-testid="convert-invoice-number"
                    />
                  </div>
                </div>

                {/* File Uploads Section */}
                <div className="space-y-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    Required Documents <span className="text-red-400">*</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Shipping Label Upload */}
                    <div>
                      <Label className="text-slate-300">Shipping Label PDF *</Label>
                      <input
                        type="file"
                        ref={shippingLabelRef}
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange(e, 'shipping')}
                        className="hidden"
                        data-testid="convert-shipping-label-input"
                      />
                      <div
                        onClick={() => shippingLabelRef.current?.click()}
                        className={`mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                          shippingLabelFile 
                            ? 'border-green-600 bg-green-600/10' 
                            : 'border-slate-600 hover:border-cyan-500 hover:bg-slate-800'
                        }`}
                        data-testid="convert-shipping-label-drop"
                      >
                        {shippingLabelFile ? (
                          <div className="flex items-center justify-center gap-2 text-green-400">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-sm truncate max-w-32">{shippingLabelFile.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShippingLabelFile(null);
                              }}
                              className="text-red-400 hover:text-red-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-slate-400">
                            <Upload className="w-6 h-6 mx-auto mb-1" />
                            <p className="text-xs">Click to upload</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Invoice Upload */}
                    <div>
                      <Label className="text-slate-300">Invoice PDF *</Label>
                      <input
                        type="file"
                        ref={invoiceRef}
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange(e, 'invoice')}
                        className="hidden"
                        data-testid="convert-invoice-pdf-input"
                      />
                      <div
                        onClick={() => invoiceRef.current?.click()}
                        className={`mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                          invoiceFile 
                            ? 'border-green-600 bg-green-600/10' 
                            : 'border-slate-600 hover:border-cyan-500 hover:bg-slate-800'
                        }`}
                        data-testid="convert-invoice-pdf-drop"
                      >
                        {invoiceFile ? (
                          <div className="flex items-center justify-center gap-2 text-green-400">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-sm truncate max-w-32">{invoiceFile.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInvoiceFile(null);
                              }}
                              className="text-red-400 hover:text-red-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-slate-400">
                            <Upload className="w-6 h-6 mx-auto mb-1" />
                            <p className="text-xs">Click to upload</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label className="text-slate-300">Notes (Optional)</Label>
                  <Textarea
                    value={convertForm.notes}
                    onChange={(e) => setConvertForm({...convertForm, notes: e.target.value})}
                    className="bg-slate-800 border-slate-600 text-white mt-1"
                    placeholder="Any additional notes..."
                    rows={2}
                    data-testid="convert-notes"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <Button
                    variant="outline"
                    onClick={closeConvertModal}
                    className="border-slate-600 text-slate-300"
                    data-testid="convert-cancel-btn"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConvertToFulfillment}
                    disabled={convertLoading}
                    className="bg-cyan-600 hover:bg-cyan-700"
                    data-testid="convert-submit-btn"
                  >
                    {convertLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <Truck className="w-4 h-4 mr-2" />
                        Add to Dispatch Queue
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

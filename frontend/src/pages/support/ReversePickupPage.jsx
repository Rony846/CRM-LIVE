import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Truck, RotateCcw, Package, Loader2, RefreshCw, Download, Phone, MapPin, 
  FileText, IndianRupee, Calculator, CheckCircle, AlertCircle
} from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
  'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Lakshadweep'
];

export default function ReversePickupPage() {
  const { token } = useAuth();
  const [reversePickups, setReversePickups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [manifestingId, setManifestingId] = useState(null);
  const [gettingQuote, setGettingQuote] = useState(false);
  
  // Quote dialog state
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  
  // Form state
  const [form, setForm] = useState({
    customer_name: '',
    ticket_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    landmark: '',
    product_name: '',
    weight_kg: '',
    invoice_value: '',
    reason: ''
  });

  useEffect(() => {
    fetchReversePickups();
  }, [token]);

  const fetchReversePickups = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API}/courier/reverse-pickups?page_size=50`, { headers });
      setReversePickups(response.data.pickups || []);
    } catch (error) {
      toast.error('Failed to load reverse pickups');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!form.customer_name || !form.ticket_number || !form.address_line1 || 
        !form.city || !form.state || !form.pincode || !form.phone || 
        !form.weight_kg || !form.invoice_value) {
      toast.error('Please fill all required fields');
      return false;
    }
    
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return false;
    }
    
    if (!/^\d{6}$/.test(form.pincode)) {
      toast.error('Please enter a valid 6-digit pincode');
      return false;
    }
    
    return true;
  };

  const handleGetQuote = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setGettingQuote(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(`${API}/courier/reverse-pickup/rate`, {
        pincode: form.pincode,
        weight_kg: parseFloat(form.weight_kg) || 1,
        invoice_value: parseFloat(form.invoice_value) || 0
      }, { headers });
      
      setQuoteData({
        ...response.data,
        form_data: { ...form }
      });
      setShowQuoteDialog(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to get rate quote');
    } finally {
      setGettingQuote(false);
    }
  };

  const handleConfirmPickup = async () => {
    if (!quoteData) return;
    
    setSubmitting(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        ...quoteData.form_data,
        weight_kg: parseFloat(quoteData.form_data.weight_kg) || 1,
        invoice_value: parseFloat(quoteData.form_data.invoice_value) || 0
      };
      
      const response = await axios.post(`${API}/courier/reverse-pickup`, payload, { headers });
      
      const shipmentType = quoteData.shipment_category === 'B2B' ? 'B2B (Heavy)' : 'B2C';
      toast.success(`Reverse pickup created: ${response.data.rp_number} (${shipmentType})`);
      
      // Auto-manifest with Delhivery
      if (response.data.id && quoteData.courier_id) {
        try {
          const manifestResponse = await axios.post(
            `${API}/courier/reverse-pickups/${response.data.id}/manifest?courier_id=${quoteData.courier_id}`,
            {},
            { headers }
          );
          toast.success(`AWB Generated: ${manifestResponse.data.awb_number} (${manifestResponse.data.courier_name})`);
        } catch (manifestError) {
          toast.warning('Pickup created but AWB generation failed. Please manifest manually.');
        }
      }
      
      // Reset form
      setForm({
        customer_name: '',
        ticket_number: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        pincode: '',
        phone: '',
        landmark: '',
        product_name: '',
        weight_kg: '',
        invoice_value: '',
        reason: ''
      });
      
      setShowQuoteDialog(false);
      setQuoteData(null);
      fetchReversePickups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create reverse pickup');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadLabel = async (pickup) => {
    if (!pickup.bigship_order_id) {
      toast.error('No order ID found');
      return;
    }
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const weightKg = pickup.weight_kg || 1;
      const shipmentType = weightKg > 20 ? 'b2b' : 'b2c';
      
      const response = await axios.get(
        `${API}/courier/label/${pickup.bigship_order_id}?shipment_type=${shipmentType}`,
        { headers }
      );
      
      if (response.data.success && response.data.content) {
        const byteCharacters = atob(response.data.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${pickup.rp_number}_label.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('Label downloaded');
      } else {
        toast.error('Label not available yet. Please try after manifesting.');
      }
    } catch (error) {
      toast.error('Failed to download label');
    }
  };

  const downloadManifest = async (pickup) => {
    if (!pickup.bigship_order_id) {
      toast.error('No order ID found');
      return;
    }
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const weightKg = pickup.weight_kg || 1;
      const shipmentType = weightKg > 20 ? 'b2b' : 'b2c';
      
      const response = await axios.get(
        `${API}/courier/manifest/${pickup.bigship_order_id}?shipment_type=${shipmentType}`,
        { headers }
      );
      
      if (response.data.success && response.data.content) {
        const byteCharacters = atob(response.data.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${pickup.rp_number}_manifest.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('Manifest downloaded');
      } else {
        toast.error(response.data.detail || 'Manifest not available');
      }
    } catch (error) {
      toast.error('Failed to download manifest');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <RotateCcw className="w-6 h-6 text-orange-600" />
              Reverse Pickup
            </h1>
            <p className="text-slate-500">Schedule product returns from customers via Delhivery</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Create Form */}
          <Card className="border-2 border-orange-200">
            <CardHeader className="bg-orange-50 border-b border-orange-100">
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <Truck className="w-5 h-5" />
                Schedule New Pickup
              </CardTitle>
              <p className="text-sm text-orange-600">
                Pickup from customer → Deliver to warehouse (Sudarshan, Meerut - 250002)
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleGetQuote} className="space-y-4">
                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customer_name" className="flex items-center gap-1">
                      Customer Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="customer_name"
                      data-testid="rp-customer-name"
                      placeholder="Enter customer name"
                      value={form.customer_name}
                      onChange={(e) => setForm({...form, customer_name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="ticket_number" className="flex items-center gap-1">
                      Ticket Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="ticket_number"
                      data-testid="rp-ticket-number"
                      placeholder="TKT-XXXX or reference"
                      value={form.ticket_number}
                      onChange={(e) => setForm({...form, ticket_number: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="phone" className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    data-testid="rp-phone"
                    placeholder="10-digit mobile number"
                    value={form.phone}
                    onChange={(e) => setForm({...form, phone: e.target.value})}
                    maxLength={10}
                    required
                  />
                </div>

                {/* Address */}
                <div className="border-t pt-4">
                  <Label className="flex items-center gap-1 mb-2 text-slate-700">
                    <MapPin className="w-3 h-3" /> Pickup Address
                  </Label>
                  <div className="space-y-3">
                    <Input
                      data-testid="rp-address1"
                      placeholder="Address Line 1 (House/Flat No., Street) *"
                      value={form.address_line1}
                      onChange={(e) => setForm({...form, address_line1: e.target.value})}
                      required
                    />
                    <Input
                      data-testid="rp-address2"
                      placeholder="Address Line 2 (Area, Colony)"
                      value={form.address_line2}
                      onChange={(e) => setForm({...form, address_line2: e.target.value})}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        data-testid="rp-city"
                        placeholder="City *"
                        value={form.city}
                        onChange={(e) => setForm({...form, city: e.target.value})}
                        required
                      />
                      <Select
                        value={form.state}
                        onValueChange={(val) => setForm({...form, state: val})}
                      >
                        <SelectTrigger data-testid="rp-state">
                          <SelectValue placeholder="Select State *" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDIAN_STATES.map(state => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        data-testid="rp-pincode"
                        placeholder="Pincode (6 digits) *"
                        value={form.pincode}
                        onChange={(e) => setForm({...form, pincode: e.target.value})}
                        maxLength={6}
                        required
                      />
                      <Input
                        data-testid="rp-landmark"
                        placeholder="Landmark (optional)"
                        value={form.landmark}
                        onChange={(e) => setForm({...form, landmark: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Product & Invoice */}
                <div className="border-t pt-4">
                  <Label className="flex items-center gap-1 mb-2 text-slate-700">
                    <Package className="w-3 h-3" /> Product & Invoice Details
                  </Label>
                  <div className="space-y-3">
                    <Input
                      data-testid="rp-product"
                      placeholder="Product Name *"
                      value={form.product_name}
                      onChange={(e) => setForm({...form, product_name: e.target.value})}
                      required
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="weight_kg" className="text-xs text-slate-500">
                          Weight (kg) * <span className="text-orange-600">(≤20kg: B2C, &gt;20kg: B2B)</span>
                        </Label>
                        <Input
                          id="weight_kg"
                          data-testid="rp-weight"
                          type="number"
                          step="0.1"
                          placeholder="Weight in kg"
                          value={form.weight_kg}
                          onChange={(e) => setForm({...form, weight_kg: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="invoice_value" className="text-xs text-slate-500 flex items-center gap-1">
                          <IndianRupee className="w-3 h-3" /> Invoice Value (₹) *
                        </Label>
                        <Input
                          id="invoice_value"
                          data-testid="rp-invoice-value"
                          type="number"
                          placeholder="e.g., 10000"
                          value={form.invoice_value}
                          onChange={(e) => setForm({...form, invoice_value: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="reason">Return Reason</Label>
                  <Textarea
                    id="reason"
                    data-testid="rp-reason"
                    placeholder="Why is the product being returned?"
                    value={form.reason}
                    onChange={(e) => setForm({...form, reason: e.target.value})}
                    rows={2}
                  />
                </div>

                {/* Shipment Type Indicator */}
                {form.weight_kg && (
                  <div className={`p-3 rounded-lg ${parseFloat(form.weight_kg) > 20 ? 'bg-purple-50 border border-purple-200' : 'bg-green-50 border border-green-200'}`}>
                    <p className="text-sm font-medium">
                      Shipment Type: <span className={parseFloat(form.weight_kg) > 20 ? 'text-purple-700' : 'text-green-700'}>
                        {parseFloat(form.weight_kg) > 20 ? 'B2B (Heavy Shipment)' : 'B2C (Standard)'}
                      </span>
                    </p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={gettingQuote}
                  data-testid="get-quote-btn"
                >
                  {gettingQuote ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Getting Quote...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4 mr-2" />
                      Get Price Quote (Delhivery)
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Pickups List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Recent Reverse Pickups
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchReversePickups} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : reversePickups.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <RotateCcw className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg">No reverse pickups yet</p>
                  <p className="text-sm">Create your first pickup using the form</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pickup #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>AWB</TableHead>
                        <TableHead>Downloads</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reversePickups.map((pickup) => (
                        <TableRow key={pickup.id}>
                          <TableCell>
                            <div>
                              <p className="font-mono text-sm font-medium">{pickup.rp_number}</p>
                              <p className="text-xs text-slate-500">{pickup.ticket_number}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{pickup.customer_name}</p>
                              <p className="text-xs text-slate-500">{pickup.customer_phone}</p>
                              <p className="text-xs text-slate-400">
                                {pickup.pickup_address?.city}, {pickup.pickup_address?.pincode}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">{pickup.product_name || '-'}</p>
                              <p className="text-xs text-slate-500">{pickup.weight_kg || 1} kg</p>
                              {pickup.invoice_value && (
                                <p className="text-xs text-green-600">₹{pickup.invoice_value?.toLocaleString()}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              pickup.status === 'manifested' ? 'default' :
                              pickup.status === 'created' ? 'secondary' : 'outline'
                            }>
                              {pickup.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {pickup.awb_number ? (
                              <div>
                                <p className="font-mono text-sm text-green-600">{pickup.awb_number}</p>
                                <p className="text-xs text-slate-500">{pickup.courier_name}</p>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">Pending</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {pickup.awb_number ? (
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadLabel(pickup)}
                                  className="text-blue-600 h-7 text-xs"
                                  data-testid={`download-label-${pickup.id}`}
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  Label
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadManifest(pickup)}
                                  className="text-purple-600 h-7 text-xs"
                                  data-testid={`download-manifest-${pickup.id}`}
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  Manifest
                                </Button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">Awaiting AWB</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quote Confirmation Dialog */}
      <Dialog open={showQuoteDialog} onOpenChange={setShowQuoteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-green-600" />
              Confirm Reverse Pickup
            </DialogTitle>
            <DialogDescription>
              Review the shipping cost before creating the pickup
            </DialogDescription>
          </DialogHeader>
          
          {quoteData && (
            <div className="space-y-4">
              {/* Customer Info Summary */}
              <div className="bg-slate-50 p-3 rounded-lg text-sm">
                <p className="font-medium">{quoteData.form_data?.customer_name}</p>
                <p className="text-slate-600">{quoteData.form_data?.address_line1}</p>
                <p className="text-slate-600">
                  {quoteData.form_data?.city}, {quoteData.form_data?.state} - {quoteData.form_data?.pincode}
                </p>
              </div>
              
              {/* Rate Details */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-blue-50 px-4 py-2 border-b">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-blue-800">
                      {quoteData.courier_name || 'Delhivery'}
                    </span>
                    {quoteData.is_delhivery ? (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Preferred
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-orange-600">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Alternative
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Shipment Type:</span>
                    <span className={quoteData.shipment_category === 'B2B' ? 'text-purple-600 font-medium' : 'text-green-600 font-medium'}>
                      {quoteData.shipment_category === 'B2B' ? 'B2B (Heavy)' : 'B2C (Standard)'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Weight:</span>
                    <span>{quoteData.form_data?.weight_kg} kg</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Base Charges:</span>
                    <span>₹{quoteData.base_charges?.toFixed(2)}</span>
                  </div>
                  {quoteData.gst > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">GST:</span>
                      <span>₹{quoteData.gst?.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm border-t pt-2 mt-2">
                    <span className="font-semibold">Total Cost:</span>
                    <span className="font-bold text-lg text-green-600">
                      ₹{quoteData.total_charges?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Expected Delivery:</span>
                    <span>{quoteData.expected_delivery_days || '3-5'} days</span>
                  </div>
                </div>
              </div>
              
              {!quoteData.is_delhivery && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Delhivery is not available for this pincode. Please verify the pincode.
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowQuoteDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmPickup} 
              disabled={submitting}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="confirm-pickup-btn"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Create Pickup & Generate AWB
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

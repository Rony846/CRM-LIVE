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
import { toast } from 'sonner';
import { 
  Truck, RotateCcw, Package, Loader2, RefreshCw, Download, Phone, MapPin, FileText, IndianRupee
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

const COURIERS = [
  { id: '1', name: 'Delhivery' },
  { id: '2', name: 'BlueDart' },
  { id: '4', name: 'DTDC' },
  { id: '5', name: 'Ecom Express' },
  { id: '6', name: 'Xpressbees' },
  { id: '7', name: 'Shadowfax' },
];

export default function ReversePickupPage() {
  const { token } = useAuth();
  const [reversePickups, setReversePickups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [manifestingId, setManifestingId] = useState(null);
  const [selectedCourier, setSelectedCourier] = useState('');
  
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!form.customer_name || !form.ticket_number || !form.address_line1 || 
        !form.pincode || !form.phone || !form.weight_kg || !form.invoice_value) {
      toast.error('Please fill all required fields');
      return;
    }
    
    // Validate phone
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    
    // Validate pincode
    if (!/^\d{6}$/.test(form.pincode)) {
      toast.error('Please enter a valid 6-digit pincode');
      return;
    }
    
    setSubmitting(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        ...form,
        weight_kg: parseFloat(form.weight_kg) || 1,
        invoice_value: parseFloat(form.invoice_value) || 0
      };
      
      const response = await axios.post(`${API}/courier/reverse-pickup`, payload, { headers });
      
      const weightKg = parseFloat(form.weight_kg);
      const shipmentType = weightKg > 20 ? 'B2B (Heavy)' : 'B2C';
      
      toast.success(`Reverse pickup created: ${response.data.rp_number} (${shipmentType})`);
      
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
      
      fetchReversePickups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create reverse pickup');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManifest = async (pickupId) => {
    if (!selectedCourier) {
      toast.error('Please select a courier first');
      return;
    }
    
    setManifestingId(pickupId);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(
        `${API}/courier/reverse-pickups/${pickupId}/manifest?courier_id=${selectedCourier}`,
        {},
        { headers }
      );
      
      toast.success(`AWB Generated: ${response.data.awb_number} (${response.data.courier_name})`);
      setSelectedCourier('');
      fetchReversePickups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate AWB');
    } finally {
      setManifestingId(null);
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
        // Convert base64 to blob and download
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
            <p className="text-slate-500">Schedule product returns from customers</p>
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
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  disabled={submitting}
                  data-testid="create-reverse-pickup-btn"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Pickup...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Create Reverse Pickup
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
                        <TableHead>Actions</TableHead>
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
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {!pickup.awb_number ? (
                                <>
                                  <Select
                                    value={manifestingId === pickup.id ? selectedCourier : ''}
                                    onValueChange={(val) => {
                                      setSelectedCourier(val);
                                      setManifestingId(pickup.id);
                                    }}
                                  >
                                    <SelectTrigger className="w-[100px] h-8 text-xs">
                                      <SelectValue placeholder="Courier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {COURIERS.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleManifest(pickup.id)}
                                    disabled={manifestingId === pickup.id && !selectedCourier}
                                  >
                                    {manifestingId === pickup.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      'AWB'
                                    )}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadLabel(pickup)}
                                  className="text-blue-600"
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  Label
                                </Button>
                              )}
                            </div>
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
    </DashboardLayout>
  );
}

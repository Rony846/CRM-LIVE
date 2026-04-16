import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  FileText, ArrowLeft, Plus, Trash2, Loader2, Building2, Package,
  Search, User, Phone, Mail, MapPin, IndianRupee, Save, Send,
  AlertTriangle, CheckCircle, ExternalLink
} from 'lucide-react';

const GST_RATES = [0, 5, 12, 18, 28];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
  'Andaman and Nicobar', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Lakshadweep'
];

export default function QuotationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { token, user } = useAuth();
  const isEdit = Boolean(id);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [firms, setFirms] = useState([]);
  const [masterSkus, setMasterSkus] = useState([]);
  const [parties, setParties] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [linkedDatasheets, setLinkedDatasheets] = useState({}); // { master_sku_id: datasheet_id }
  
  const [form, setForm] = useState({
    firm_id: '',
    party_id: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    customer_city: '',
    customer_state: '',
    customer_pincode: '',
    customer_gstin: '',
    items: [{ master_sku_id: '', name: '', sku_code: '', quantity: 1, rate: 0, gst_rate: 18, discount_percent: 0, discount_amount: 0, current_stock: 0 }],
    validity_days: 15,
    remarks: '',
    terms_and_conditions: "1. Prices are subject to change without notice.\n2. Delivery within 7-10 working days.\n3. Payment terms: 100% advance.\n4. GST extra as applicable.\n5. Warranty as per product terms.",
    save_as_draft: true
  });

  useEffect(() => {
    if (token) {
      fetchInitialData();
    }
  }, [token]);

  useEffect(() => {
    if (isEdit && token) {
      fetchQuotation();
    }
  }, [id, token]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [firmsRes, skusRes, partiesRes] = await Promise.all([
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        axios.get(`${API}/master-skus`, { headers }),
        axios.get(`${API}/parties`, { headers })
      ]);
      
      setFirms(firmsRes.data || []);
      setMasterSkus(skusRes.data || []);
      setParties(partiesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotation = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API}/quotations/${id}`, { headers });
      const q = response.data;
      
      if (q.status !== 'draft') {
        toast.error('Only draft quotations can be edited');
        navigate('/quotations');
        return;
      }
      
      setForm({
        ...form,
        firm_id: q.firm_id,
        party_id: q.party_id,
        customer_name: q.customer_name,
        customer_phone: q.customer_phone,
        customer_email: q.customer_email || '',
        customer_address: q.customer_address || '',
        customer_city: q.customer_city || '',
        customer_state: q.customer_state || '',
        customer_pincode: q.customer_pincode || '',
        customer_gstin: q.customer_gstin || '',
        items: q.items.map(item => ({
          master_sku_id: item.master_sku_id,
          name: item.name,
          sku_code: item.sku_code,
          quantity: item.quantity,
          rate: item.rate,
          gst_rate: item.gst_rate,
          discount_percent: item.discount_percent || 0,
          discount_amount: item.discount_amount || 0,
          current_stock: item.stock_at_creation || 0
        })),
        validity_days: q.validity_days,
        remarks: q.remarks || '',
        terms_and_conditions: q.terms_and_conditions || ''
      });
    } catch (error) {
      toast.error('Failed to load quotation');
      navigate('/quotations');
    }
  };

  const handleCustomerSelect = (party) => {
    setForm({
      ...form,
      party_id: party.id,
      customer_name: party.name,
      customer_phone: party.phone || '',
      customer_email: party.email || '',
      customer_address: party.address || '',
      customer_city: party.city || '',
      customer_state: party.state || '',
      customer_pincode: party.pincode || '',
      customer_gstin: party.gstin || ''
    });
    setShowCustomerSearch(false);
    setCustomerSearch('');
  };

  const handleSkuSelect = async (index, skuId) => {
    const sku = masterSkus.find(s => s.id === skuId);
    if (!sku) return;
    
    // Get stock for selected firm
    const newItems = [...form.items];
    newItems[index] = {
      ...newItems[index],
      master_sku_id: skuId,
      name: sku.name,
      sku_code: sku.sku_code,
      rate: sku.mrp || sku.cost_price || 0,
      gst_rate: sku.gst_rate || 18,
      current_stock: sku.stock_quantity || 0
    };
    setForm({ ...form, items: newItems });
    
    // Check if this SKU has a linked datasheet
    if (!linkedDatasheets[skuId]) {
      try {
        const res = await axios.get(`${API}/product-datasheets/by-sku/${skuId}`, { headers });
        if (res.data.found && res.data.datasheet) {
          setLinkedDatasheets(prev => ({ ...prev, [skuId]: res.data.datasheet.id }));
        }
      } catch (err) {
        // Silently ignore - just means no linked datasheet
      }
    }
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { master_sku_id: '', name: '', sku_code: '', quantity: 1, rate: 0, gst_rate: 18, discount_percent: 0, discount_amount: 0, current_stock: 0 }]
    });
  };

  const removeItem = (index) => {
    if (form.items.length === 1) {
      toast.error('At least one item is required');
      return;
    }
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setForm({ ...form, items: newItems });
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalGst = 0;
    
    form.items.forEach(item => {
      const lineTotal = item.quantity * item.rate;
      const lineDiscount = item.discount_amount > 0 ? item.discount_amount : (lineTotal * item.discount_percent / 100);
      const taxableValue = lineTotal - lineDiscount;
      const gst = taxableValue * item.gst_rate / 100;
      
      subtotal += lineTotal;
      totalDiscount += lineDiscount;
      totalGst += gst;
    });
    
    const taxableValue = subtotal - totalDiscount;
    const grandTotal = taxableValue + totalGst;
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      taxableValue: Math.round(taxableValue * 100) / 100,
      totalGst: Math.round(totalGst * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100
    };
  };

  const handleSubmit = async (sendImmediately = false) => {
    // Validation
    if (!form.firm_id) {
      toast.error('Please select a firm');
      return;
    }
    if (!form.customer_name || !form.customer_phone) {
      toast.error('Customer name and phone are required');
      return;
    }
    if (form.items.some(item => !item.master_sku_id || !item.quantity || !item.rate)) {
      toast.error('Please fill all item details');
      return;
    }
    
    setSubmitting(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        ...form,
        save_as_draft: !sendImmediately
      };
      
      let response;
      if (isEdit) {
        response = await axios.put(`${API}/quotations/${id}`, payload, { headers });
        toast.success('Quotation updated');
      } else {
        response = await axios.post(`${API}/quotations`, payload, { headers });
        toast.success(`Quotation ${sendImmediately ? 'created and sent' : 'saved as draft'}`);
      }
      
      if (sendImmediately && response.data?.id) {
        // Send the quotation
        const sendRes = await axios.post(`${API}/quotations/${response.data.id}/send`, {}, { headers });
        if (sendRes.data.share_link) {
          navigator.clipboard.writeText(sendRes.data.share_link);
          toast.success('Share link copied to clipboard!');
        }
      }
      
      navigate('/quotations');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save quotation');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const totals = calculateTotals();
  const filteredParties = parties.filter(p => 
    p.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    p.phone?.includes(customerSearch)
  ).slice(0, 10);

  if (loading) {
    return (
      <DashboardLayout title={isEdit ? 'Edit Quotation' : 'New Quotation'}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isEdit ? 'Edit Quotation' : 'New Quotation'}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/quotations')}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isEdit ? 'Edit Quotation' : 'Create New Quotation'}
            </h1>
            <p className="text-slate-400">Fill in the details to create a proforma invoice</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Firm Selection */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-cyan-400" />
                  Firm Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label className="text-slate-300">Select Firm *</Label>
                  <Select value={form.firm_id} onValueChange={(v) => setForm({ ...form, firm_id: v })}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                      <SelectValue placeholder="Select firm" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                      {firms.map(firm => (
                        <SelectItem key={firm.id} value={firm.id} className="text-white hover:bg-slate-800 focus:bg-slate-800 focus:text-white">
                          {firm.name} {firm.gstin && `(${firm.gstin})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Customer Details */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-cyan-400" />
                  Customer Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer Search */}
                <div className="relative">
                  <Label className="text-slate-300">Search Existing Customer</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search by name or phone..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerSearch(true);
                      }}
                      onFocus={() => setShowCustomerSearch(true)}
                      className="pl-10 bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                  
                  {showCustomerSearch && customerSearch && filteredParties.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredParties.map(party => (
                        <div
                          key={party.id}
                          className="p-3 hover:bg-slate-800 cursor-pointer"
                          onClick={() => handleCustomerSelect(party)}
                        >
                          <p className="text-white">{party.name}</p>
                          <p className="text-slate-400 text-sm">{party.phone}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Customer Name *</Label>
                    <Input
                      value={form.customer_name}
                      onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                      placeholder="Enter customer name"
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Phone *</Label>
                    <Input
                      value={form.customer_phone}
                      onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                      placeholder="Enter phone number"
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Email</Label>
                    <Input
                      type="email"
                      value={form.customer_email}
                      onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                      placeholder="Enter email"
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">GSTIN</Label>
                    <Input
                      value={form.customer_gstin}
                      onChange={(e) => setForm({ ...form, customer_gstin: e.target.value.toUpperCase() })}
                      placeholder="Enter GSTIN"
                      className="bg-slate-900 border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-slate-300">Address</Label>
                    <Input
                      value={form.customer_address}
                      onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
                      placeholder="Enter address"
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">City</Label>
                    <Input
                      value={form.customer_city}
                      onChange={(e) => setForm({ ...form, customer_city: e.target.value })}
                      placeholder="Enter city"
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">State</Label>
                    <Select value={form.customer_state} onValueChange={(v) => setForm({ ...form, customer_state: v })}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-white max-h-60">
                        {INDIAN_STATES.map(state => (
                          <SelectItem key={state} value={state} className="text-white hover:bg-slate-800 focus:bg-slate-800 focus:text-white">{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-300">Pincode</Label>
                    <Input
                      value={form.customer_pincode}
                      onChange={(e) => setForm({ ...form, customer_pincode: e.target.value })}
                      placeholder="Enter pincode"
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-cyan-400" />
                  Items
                </CardTitle>
                <Button onClick={addItem} size="sm" className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.items.map((item, index) => (
                  <div key={index} className="p-4 bg-slate-900 rounded-lg space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-slate-400 text-sm">Item #{index + 1}</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <Label className="text-slate-400 text-xs">Select Product *</Label>
                        <div className="flex gap-2">
                          <Select value={item.master_sku_id} onValueChange={(v) => handleSkuSelect(index, v)}>
                            <SelectTrigger className="bg-slate-800 border-slate-700 text-white flex-1">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700 text-white max-h-60">
                              {masterSkus.map(sku => (
                                <SelectItem key={sku.id} value={sku.id} className="text-white hover:bg-slate-800 focus:bg-slate-800 focus:text-white">
                                  {sku.name} ({sku.sku_code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* View Catalogue Link */}
                          {item.master_sku_id && linkedDatasheets[item.master_sku_id] && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-cyan-600 text-cyan-400 hover:bg-cyan-600/10"
                              onClick={() => window.open(`/datasheet/${linkedDatasheets[item.master_sku_id]}`, '_blank')}
                              title="View product catalogue"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-slate-400 text-xs">Quantity *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                        {item.current_stock > 0 && (
                          <p className={`text-xs mt-1 ${item.quantity > item.current_stock ? 'text-red-400' : 'text-green-400'}`}>
                            Stock: {item.current_stock}
                            {item.quantity > item.current_stock && ' (Insufficient)'}
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <Label className="text-slate-400 text-xs">Rate (per unit) *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-slate-400 text-xs">GST Rate %</Label>
                        <Select 
                          value={item.gst_rate.toString()} 
                          onValueChange={(v) => updateItem(index, 'gst_rate', parseFloat(v))}
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700 text-white">
                            {GST_RATES.map(rate => (
                              <SelectItem key={rate} value={rate.toString()} className="text-white hover:bg-slate-800 focus:bg-slate-800 focus:text-white">{rate}%</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-slate-400 text-xs">Discount %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discount_percent}
                          onChange={(e) => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                    </div>
                    
                    {/* Line Total */}
                    <div className="flex justify-end pt-2 border-t border-slate-700">
                      <div className="text-right">
                        <p className="text-slate-400 text-xs">Line Total</p>
                        <p className="text-white font-semibold">
                          {formatCurrency(item.quantity * item.rate * (1 - item.discount_percent/100) * (1 + item.gst_rate/100))}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Terms & Remarks */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Additional Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-300">Validity (Days)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={form.validity_days}
                    onChange={(e) => setForm({ ...form, validity_days: parseInt(e.target.value) || 15 })}
                    className="bg-slate-900 border-slate-700 text-white w-32"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Remarks</Label>
                  <Textarea
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    placeholder="Any special remarks..."
                    className="bg-slate-900 border-slate-700 text-white"
                    rows={2}
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Terms & Conditions</Label>
                  <Textarea
                    value={form.terms_and_conditions}
                    onChange={(e) => setForm({ ...form, terms_and_conditions: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-white"
                    rows={5}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-800 border-slate-700 sticky top-4">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <IndianRupee className="w-5 h-5 text-cyan-400" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-slate-300">
                    <span>Subtotal</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {totals.totalDiscount > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Discount</span>
                      <span>-{formatCurrency(totals.totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-300">
                    <span>Taxable Value</span>
                    <span>{formatCurrency(totals.taxableValue)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>GST</span>
                    <span>{formatCurrency(totals.totalGst)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-white pt-4 border-t border-slate-700">
                    <span>Grand Total</span>
                    <span>{formatCurrency(totals.grandTotal)}</span>
                  </div>
                </div>

                {/* Stock Warnings */}
                {form.items.some(item => item.master_sku_id && item.quantity > item.current_stock) && (
                  <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                    <p className="text-yellow-400 text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Some items have insufficient stock
                    </p>
                  </div>
                )}

                <div className="space-y-2 pt-4">
                  <Button 
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="w-full bg-slate-700 hover:bg-slate-600"
                    data-testid="save-draft-btn"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save as Draft
                  </Button>
                  <Button 
                    onClick={() => handleSubmit(true)}
                    disabled={submitting}
                    className="w-full bg-green-600 hover:bg-green-700"
                    data-testid="send-btn"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Save & Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

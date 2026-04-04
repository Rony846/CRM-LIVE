import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  FileText, Plus, Loader2, Eye, Download, Search, IndianRupee,
  Building2, Calendar, Truck, CheckCircle, Clock, AlertCircle, Trash2
} from 'lucide-react';

const PAYMENT_STATUS_CONFIG = {
  unpaid: { label: 'Unpaid', color: 'bg-red-600', icon: AlertCircle },
  partial: { label: 'Partial', color: 'bg-yellow-600', icon: Clock },
  paid: { label: 'Paid', color: 'bg-green-600', icon: CheckCircle }
};

const GST_RATES = [0, 5, 12, 18, 28];

export default function SalesRegister() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [firms, setFirms] = useState([]);
  const [parties, setParties] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [skus, setSkus] = useState([]);
  
  // Filters
  const [filterFirm, setFilterFirm] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Form state
  const [form, setForm] = useState({
    firm_id: '',
    party_id: '',
    dispatch_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    items: [],
    shipping_charges: 0,
    other_charges: 0,
    discount: 0,
    notes: '',
    gst_override: false,
    override_igst: 0,
    override_cgst: 0,
    override_sgst: 0
  });
  
  // Selected dispatch details
  const [selectedDispatch, setSelectedDispatch] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, [token]);

  const fetchAllData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [invoicesRes, firmsRes, partiesRes, skusRes] = await Promise.all([
        axios.get(`${API}/sales-invoices`, { headers }),
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        axios.get(`${API}/parties`, { headers, params: { party_type: 'customer' } }),
        axios.get(`${API}/master-skus`, { headers, params: { is_active: true } })
      ]);
      
      setInvoices(invoicesRes.data || []);
      setFirms(firmsRes.data || []);
      setParties(partiesRes.data || []);
      setSkus(skusRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDispatchesWithoutInvoice = async (firmId) => {
    try {
      const res = await axios.get(`${API}/dispatches-without-invoice`, {
        headers: { Authorization: `Bearer ${token}` },
        params: firmId ? { firm_id: firmId } : {}
      });
      setDispatches(res.data || []);
    } catch (error) {
      console.error('Failed to fetch dispatches:', error);
    }
  };

  const resetForm = () => {
    setForm({
      firm_id: '', party_id: '', dispatch_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      items: [], shipping_charges: 0, other_charges: 0, discount: 0, notes: '',
      gst_override: false, override_igst: 0, override_cgst: 0, override_sgst: 0
    });
    setSelectedDispatch(null);
    setDispatches([]);
  };

  const handleFirmChange = (firmId) => {
    setForm({ ...form, firm_id: firmId, dispatch_id: '' });
    setSelectedDispatch(null);
    fetchDispatchesWithoutInvoice(firmId);
  };

  const handleDispatchSelect = async (dispatchId) => {
    const dispatch = dispatches.find(d => d.id === dispatchId);
    if (!dispatch) return;
    
    setSelectedDispatch(dispatch);
    setForm(prev => ({ ...prev, dispatch_id: dispatchId }));
    
    const headers = { Authorization: `Bearer ${token}` };
    
    // Try to find party by phone or email
    let partyId = '';
    let existingParty = parties.find(p => 
      p.phone === dispatch.phone || 
      (dispatch.customer_email && p.email === dispatch.customer_email.toLowerCase())
    );
    
    if (existingParty) {
      partyId = existingParty.id;
    } else if (dispatch.customer_name && dispatch.phone) {
      // Auto-create party from dispatch customer info
      try {
        // Determine party name - for marketplace orders, use marketplace as party
        const isMarketplaceOrder = ['amazon', 'flipkart', 'website'].includes(dispatch.order_source) ||
                                   ['amazon_order', 'flipkart_order', 'website_order'].includes(dispatch.dispatch_type);
        
        const partyName = isMarketplaceOrder 
          ? (dispatch.order_source === 'flipkart' || dispatch.dispatch_type === 'flipkart_order' ? 'Flipkart Marketplace' : 'Amazon Marketplace')
          : dispatch.customer_name;
        
        // Check if marketplace party already exists
        if (isMarketplaceOrder) {
          existingParty = parties.find(p => p.name === partyName);
          if (existingParty) {
            partyId = existingParty.id;
          }
        }
        
        // Create new party if still not found
        if (!partyId) {
          const newPartyData = {
            name: partyName,
            party_types: ['customer'],
            phone: isMarketplaceOrder ? null : dispatch.phone,
            email: isMarketplaceOrder ? null : (dispatch.customer_email || null),
            address: dispatch.address || '',
            city: dispatch.city || '',
            state: dispatch.state || 'Delhi', // Default state for GST
            pincode: dispatch.pincode || '',
            gstin: null,
            pan: null,
            credit_limit: 0,
            opening_balance: 0
          };
          
          const createRes = await axios.post(`${API}/parties`, newPartyData, { headers });
          if (createRes.data?.id) {
            partyId = createRes.data.id;
            // Refresh parties list
            const partiesRes = await axios.get(`${API}/parties`, { headers, params: { party_type: 'customer' } });
            setParties(partiesRes.data || []);
            toast.success(`Auto-created party: ${partyName}`);
          }
        }
      } catch (error) {
        console.error('Failed to auto-create party:', error);
        // Continue without auto-creating party
      }
    }
    
    // Auto-populate items from dispatch
    let items = [];
    
    // First try by master_sku_id
    if (dispatch.master_sku_id) {
      const sku = skus.find(s => s.id === dispatch.master_sku_id);
      if (sku) {
        items.push({
          master_sku_id: sku.id,
          sku_code: sku.sku_code,
          name: sku.name,
          hsn_code: sku.hsn_code || '',
          quantity: dispatch.quantity || 1,
          rate: dispatch.selling_price || dispatch.invoice_value || sku.cost_price || 0,
          gst_rate: sku.gst_rate || 18,
          discount: 0
        });
      }
    } 
    // Try to find SKU by sku code
    else if (dispatch.sku) {
      const sku = skus.find(s => 
        s.sku_code?.toLowerCase() === dispatch.sku?.toLowerCase() ||
        s.name?.toLowerCase().includes(dispatch.sku?.toLowerCase())
      );
      if (sku) {
        items.push({
          master_sku_id: sku.id,
          sku_code: sku.sku_code,
          name: sku.name,
          hsn_code: sku.hsn_code || '',
          quantity: dispatch.quantity || 1,
          rate: dispatch.selling_price || dispatch.invoice_value || sku.cost_price || 0,
          gst_rate: sku.gst_rate || 18,
          discount: 0
        });
      } else {
        // Create a manual item entry with dispatch data even without SKU match
        items.push({
          master_sku_id: '',
          sku_code: dispatch.sku || '',
          name: dispatch.sku_name || dispatch.sku || dispatch.reason || 'Product',
          hsn_code: '',
          quantity: dispatch.quantity || 1,
          rate: dispatch.selling_price || dispatch.invoice_value || 0,
          gst_rate: 18,
          discount: 0
        });
      }
    }
    
    // Update form with party and items
    setForm(prev => ({ 
      ...prev, 
      dispatch_id: dispatchId,
      party_id: partyId,
      items: items.length > 0 ? items : prev.items
    }));
  };

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        master_sku_id: '',
        sku_code: '',
        name: '',
        hsn_code: '',
        quantity: 1,
        rate: 0,
        gst_rate: 18,
        discount: 0
      }]
    }));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index][field] = value;
    
    // If SKU selected, populate details
    if (field === 'master_sku_id' && value) {
      const sku = skus.find(s => s.id === value);
      if (sku) {
        newItems[index].sku_code = sku.sku_code;
        newItems[index].name = sku.name;
        newItems[index].hsn_code = sku.hsn_code || '';
        newItems[index].gst_rate = sku.gst_rate || 18;
        newItems[index].rate = sku.cost_price || 0;
      }
    }
    
    setForm(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0;
    let totalGst = 0;
    
    form.items.forEach(item => {
      const taxable = (item.quantity * item.rate) - item.discount;
      const gst = taxable * (item.gst_rate / 100);
      subtotal += taxable;
      totalGst += gst;
    });
    
    const taxableValue = subtotal + form.shipping_charges + form.other_charges - form.discount;
    const grandTotal = taxableValue + (form.gst_override 
      ? (form.override_igst + form.override_cgst + form.override_sgst) 
      : totalGst);
    
    return { subtotal, taxableValue, totalGst, grandTotal };
  };

  const handleCreate = async () => {
    if (!form.firm_id || !form.party_id || !form.dispatch_id) {
      toast.error('Please select firm, party, and dispatch');
      return;
    }
    if (form.items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/sales-invoices`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Sales invoice created successfully');
      setCreateOpen(false);
      resetForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create invoice');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    if (filterFirm !== 'all' && inv.firm_id !== filterFirm) return false;
    if (filterStatus !== 'all' && inv.payment_status !== filterStatus) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        inv.invoice_number?.toLowerCase().includes(search) ||
        inv.party_name?.toLowerCase().includes(search) ||
        inv.dispatch_number?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: invoices.length,
    totalValue: invoices.reduce((sum, i) => sum + i.grand_total, 0),
    unpaid: invoices.filter(i => i.payment_status === 'unpaid').length,
    totalOutstanding: invoices.reduce((sum, i) => sum + i.balance_due, 0),
    totalGst: invoices.reduce((sum, i) => sum + i.total_gst, 0)
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <DashboardLayout title="Sales Register">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Sales Register">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard title="Total Invoices" value={stats.total} icon={FileText} color="cyan" />
          <StatCard 
            title="Total Sales" 
            value={`₹${stats.totalValue.toLocaleString()}`} 
            icon={IndianRupee} 
            color="green" 
          />
          <StatCard title="Unpaid" value={stats.unpaid} icon={AlertCircle} color="red" />
          <StatCard 
            title="Outstanding" 
            value={`₹${stats.totalOutstanding.toLocaleString()}`} 
            icon={Clock} 
            color="orange" 
          />
          <StatCard 
            title="Total GST" 
            value={`₹${stats.totalGst.toLocaleString()}`} 
            icon={Building2} 
            color="purple" 
          />
        </div>

        {/* Filters & Actions */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search invoices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64 pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <Select value={filterFirm} onValueChange={setFilterFirm}>
                  <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Filter by Firm" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all" className="text-white">All Firms</SelectItem>
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id} className="text-white">{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all" className="text-white">All Status</SelectItem>
                    <SelectItem value="unpaid" className="text-white">Unpaid</SelectItem>
                    <SelectItem value="partial" className="text-white">Partial</SelectItem>
                    <SelectItem value="paid" className="text-white">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => { resetForm(); setCreateOpen(true); }}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="create-invoice-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Invoice
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Sales Invoices ({filteredInvoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No invoices found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Invoice #</TableHead>
                      <TableHead className="text-slate-300">Date</TableHead>
                      <TableHead className="text-slate-300">Firm</TableHead>
                      <TableHead className="text-slate-300">Party</TableHead>
                      <TableHead className="text-slate-300">Dispatch</TableHead>
                      <TableHead className="text-slate-300 text-right">Taxable</TableHead>
                      <TableHead className="text-slate-300 text-right">GST</TableHead>
                      <TableHead className="text-slate-300 text-right">Total</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300 text-right">Balance</TableHead>
                      <TableHead className="text-slate-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((inv) => (
                      <TableRow key={inv.id} className="border-slate-700">
                        <TableCell className="text-cyan-400 font-mono">{inv.invoice_number}</TableCell>
                        <TableCell className="text-slate-300">
                          {new Date(inv.invoice_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-white">{inv.firm_name}</TableCell>
                        <TableCell className="text-white">{inv.party_name}</TableCell>
                        <TableCell className="text-slate-400 font-mono text-sm">
                          {inv.dispatch_number}
                        </TableCell>
                        <TableCell className="text-white text-right">
                          ₹{inv.taxable_value?.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-purple-400 text-right">
                          ₹{inv.total_gst?.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-green-400 text-right font-medium">
                          ₹{inv.grand_total?.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={PAYMENT_STATUS_CONFIG[inv.payment_status]?.color}>
                            {PAYMENT_STATUS_CONFIG[inv.payment_status]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${
                          inv.balance_due > 0 ? 'text-red-400' : 'text-green-400'
                        }`}>
                          ₹{inv.balance_due?.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setSelectedInvoice(inv); setViewOpen(true); }}
                            className="text-slate-400 hover:text-white"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Invoice Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Sales Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Header Fields */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label className="text-slate-300">Firm *</Label>
                  <Select value={form.firm_id} onValueChange={handleFirmChange}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select firm" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {firms.map(f => (
                        <SelectItem key={f.id} value={f.id} className="text-white">{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Dispatch *</Label>
                  <Select 
                    value={form.dispatch_id} 
                    onValueChange={handleDispatchSelect}
                    disabled={!form.firm_id}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder={form.firm_id ? "Select dispatch" : "Select firm first"} />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                      {dispatches.length === 0 ? (
                        <div className="p-2 text-slate-400 text-sm">No dispatches without invoice</div>
                      ) : dispatches.map(d => (
                        <SelectItem key={d.id} value={d.id} className="text-white">
                          {d.dispatch_number} - {d.customer_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Party/Customer *</Label>
                  <Select value={form.party_id} onValueChange={(v) => setForm({...form, party_id: v})}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select party" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                      {parties.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-white">
                          {p.name} {p.gstin ? `(${p.gstin})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Invoice Date *</Label>
                  <Input
                    type="date"
                    value={form.invoice_date}
                    onChange={(e) => setForm({...form, invoice_date: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              {/* Dispatch Info */}
              {selectedDispatch && (
                <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
                  <p className="text-blue-300 text-sm">
                    <strong>Dispatch:</strong> {selectedDispatch.dispatch_number} | 
                    <strong> Customer:</strong> {selectedDispatch.customer_name} | 
                    <strong> Phone:</strong> {selectedDispatch.phone}
                  </p>
                </div>
              )}

              {/* Items */}
              <div className="border border-slate-600 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-cyan-400 font-medium">Line Items</Label>
                  <Button size="sm" onClick={addItem} className="bg-slate-600 hover:bg-slate-500">
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>
                
                {form.items.length === 0 ? (
                  <p className="text-slate-400 text-center py-4">No items added</p>
                ) : (
                  <div className="space-y-3">
                    {form.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end bg-slate-700/50 p-3 rounded">
                        <div className="col-span-3">
                          <Label className="text-slate-400 text-xs">SKU</Label>
                          <Select
                            value={item.master_sku_id}
                            onValueChange={(v) => updateItem(index, 'master_sku_id', v)}
                          >
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1 text-sm">
                              <SelectValue placeholder="Select SKU" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-700 border-slate-600 max-h-40">
                              {skus.map(s => (
                                <SelectItem key={s.id} value={s.id} className="text-white text-sm">
                                  {s.sku_code} - {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-slate-400 text-xs">HSN</Label>
                          <Input
                            value={item.hsn_code}
                            onChange={(e) => updateItem(index, 'hsn_code', e.target.value)}
                            className="bg-slate-700 border-slate-600 text-white mt-1 text-sm"
                          />
                        </div>
                        <div className="col-span-1">
                          <Label className="text-slate-400 text-xs">Qty</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="bg-slate-700 border-slate-600 text-white mt-1 text-sm"
                            min="1"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-slate-400 text-xs">Rate</Label>
                          <Input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                            className="bg-slate-700 border-slate-600 text-white mt-1 text-sm"
                          />
                        </div>
                        <div className="col-span-1">
                          <Label className="text-slate-400 text-xs">GST %</Label>
                          <Select
                            value={item.gst_rate.toString()}
                            onValueChange={(v) => updateItem(index, 'gst_rate', parseFloat(v))}
                          >
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-700 border-slate-600">
                              {GST_RATES.map(r => (
                                <SelectItem key={r} value={r.toString()} className="text-white">{r}%</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-slate-400 text-xs">Total</Label>
                          <div className="bg-slate-600 text-white p-2 rounded text-sm mt-1">
                            ₹{((item.quantity * item.rate) - item.discount).toLocaleString()}
                          </div>
                        </div>
                        <div className="col-span-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeItem(index)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Other Charges */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label className="text-slate-300">Shipping</Label>
                  <Input
                    type="number"
                    value={form.shipping_charges}
                    onChange={(e) => setForm({...form, shipping_charges: parseFloat(e.target.value) || 0})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Other Charges</Label>
                  <Input
                    type="number"
                    value={form.other_charges}
                    onChange={(e) => setForm({...form, other_charges: parseFloat(e.target.value) || 0})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Discount</Label>
                  <Input
                    type="number"
                    value={form.discount}
                    onChange={(e) => setForm({...form, discount: parseFloat(e.target.value) || 0})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={form.gst_override}
                    onCheckedChange={(v) => setForm({...form, gst_override: v})}
                  />
                  <Label className="text-slate-300">Override GST</Label>
                </div>
              </div>

              {/* GST Override */}
              {form.gst_override && (
                <div className="grid grid-cols-3 gap-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                  <div>
                    <Label className="text-yellow-300">IGST Override</Label>
                    <Input
                      type="number"
                      value={form.override_igst}
                      onChange={(e) => setForm({...form, override_igst: parseFloat(e.target.value) || 0})}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-yellow-300">CGST Override</Label>
                    <Input
                      type="number"
                      value={form.override_cgst}
                      onChange={(e) => setForm({...form, override_cgst: parseFloat(e.target.value) || 0})}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-yellow-300">SGST Override</Label>
                    <Input
                      type="number"
                      value={form.override_sgst}
                      onChange={(e) => setForm({...form, override_sgst: parseFloat(e.target.value) || 0})}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-slate-700/50 rounded-lg">
                <div>
                  <p className="text-slate-400 text-sm">Subtotal</p>
                  <p className="text-white text-xl">₹{totals.subtotal.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Taxable Value</p>
                  <p className="text-white text-xl">₹{totals.taxableValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">GST</p>
                  <p className="text-purple-400 text-xl">₹{(form.gst_override 
                    ? (form.override_igst + form.override_cgst + form.override_sgst) 
                    : totals.totalGst).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Grand Total</p>
                  <p className="text-green-400 text-2xl font-bold">₹{totals.grandTotal.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <Label className="text-slate-300">Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({...form, notes: e.target.value})}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={actionLoading}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Invoice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Invoice Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invoice Details</DialogTitle>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">Invoice Number</Label>
                    <p className="text-cyan-400 font-mono text-lg">{selectedInvoice.invoice_number}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Date</Label>
                    <p className="text-white">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">Firm</Label>
                    <p className="text-white">{selectedInvoice.firm_name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Party</Label>
                    <p className="text-white">{selectedInvoice.party_name}</p>
                    {selectedInvoice.party_gstin && (
                      <p className="text-slate-400 text-sm font-mono">{selectedInvoice.party_gstin}</p>
                    )}
                  </div>
                </div>

                <div className="border border-slate-600 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 bg-slate-700/50">
                        <TableHead className="text-slate-300">Item</TableHead>
                        <TableHead className="text-slate-300">HSN</TableHead>
                        <TableHead className="text-slate-300 text-right">Qty</TableHead>
                        <TableHead className="text-slate-300 text-right">Rate</TableHead>
                        <TableHead className="text-slate-300 text-right">GST%</TableHead>
                        <TableHead className="text-slate-300 text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.items?.map((item, i) => (
                        <TableRow key={i} className="border-slate-700">
                          <TableCell className="text-white">{item.name}</TableCell>
                          <TableCell className="text-slate-400">{item.hsn_code}</TableCell>
                          <TableCell className="text-white text-right">{item.quantity}</TableCell>
                          <TableCell className="text-white text-right">₹{item.rate}</TableCell>
                          <TableCell className="text-white text-right">{item.gst_rate}%</TableCell>
                          <TableCell className="text-white text-right">₹{item.taxable_value?.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-700/50 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Subtotal:</span>
                      <span className="text-white">₹{selectedInvoice.subtotal?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Shipping:</span>
                      <span className="text-white">₹{selectedInvoice.shipping_charges?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Discount:</span>
                      <span className="text-white">-₹{selectedInvoice.discount?.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Taxable:</span>
                      <span className="text-white">₹{selectedInvoice.taxable_value?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{selectedInvoice.is_igst ? 'IGST' : 'CGST+SGST'}:</span>
                      <span className="text-purple-400">₹{selectedInvoice.total_gst?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t border-slate-600 pt-2">
                      <span className="text-white">Grand Total:</span>
                      <span className="text-green-400">₹{selectedInvoice.grand_total?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                  <div>
                    <Badge className={PAYMENT_STATUS_CONFIG[selectedInvoice.payment_status]?.color}>
                      {PAYMENT_STATUS_CONFIG[selectedInvoice.payment_status]?.label}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-sm">Amount Paid: ₹{selectedInvoice.amount_paid?.toLocaleString()}</p>
                    <p className={`font-bold ${selectedInvoice.balance_due > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      Balance: ₹{selectedInvoice.balance_due?.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setViewOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

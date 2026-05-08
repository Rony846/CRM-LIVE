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
import { toast } from 'sonner';
import { 
  ReceiptText, Plus, Loader2, Eye, Search, IndianRupee, Trash2, Building2
} from 'lucide-react';

const REASON_CONFIG = {
  sales_return: { label: 'Sales Return', color: 'bg-blue-600' },
  discount: { label: 'Discount', color: 'bg-green-600' },
  price_difference: { label: 'Price Difference', color: 'bg-yellow-600' },
  damaged_goods: { label: 'Damaged Goods', color: 'bg-red-600' },
  other: { label: 'Other', color: 'bg-slate-600' }
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-600' },
  adjusted: { label: 'Adjusted', color: 'bg-green-600' },
  refunded: { label: 'Refunded', color: 'bg-blue-600' }
};

const GST_RATES = [0, 5, 12, 18, 28];

export default function CreditNotes() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creditNotes, setCreditNotes] = useState([]);
  const [firms, setFirms] = useState([]);
  const [parties, setParties] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [skus, setSkus] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [form, setForm] = useState({
    firm_id: '',
    party_id: '',
    original_invoice_id: '',
    credit_note_date: new Date().toISOString().split('T')[0],
    items: [],
    reason: 'sales_return',
    notes: ''
  });

  useEffect(() => {
    fetchAllData();
  }, [token]);

  const fetchAllData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [notesRes, firmsRes, partiesRes, skusRes] = await Promise.all([
        axios.get(`${API}/credit-notes`, { headers }),
        axios.get(`${API}/firms`, { headers }),
        axios.get(`${API}/parties`, { headers, params: { party_type: 'customer' } }),
        axios.get(`${API}/master-skus`, { headers })
      ]);
      
      setCreditNotes(notesRes.data || []);
      setFirms(firmsRes.data || []);
      setParties(partiesRes.data || []);
      setSkus(skusRes.data || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPartyInvoices = async (partyId) => {
    if (!partyId) {
      setInvoices([]);
      return;
    }
    
    try {
      const res = await axios.get(`${API}/sales-invoices`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { party_id: partyId }
      });
      setInvoices(res.data || []);
    } catch (error) {
      console.error('Failed to fetch invoices');
    }
  };

  const resetForm = () => {
    setForm({
      firm_id: '', party_id: '', original_invoice_id: '',
      credit_note_date: new Date().toISOString().split('T')[0],
      items: [], reason: 'sales_return', notes: ''
    });
    setInvoices([]);
  };

  const handlePartyChange = (partyId) => {
    setForm({ ...form, party_id: partyId, original_invoice_id: '' });
    fetchPartyInvoices(partyId);
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
        reason: ''
      }]
    }));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index][field] = value;
    
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

  const calculateTotals = () => {
    let subtotal = 0;
    let totalGst = 0;
    
    form.items.forEach(item => {
      const taxable = item.quantity * item.rate;
      const gst = taxable * (item.gst_rate / 100);
      subtotal += taxable;
      totalGst += gst;
    });
    
    return { subtotal, totalGst, grandTotal: subtotal + totalGst };
  };

  const handleCreate = async () => {
    if (!form.firm_id || !form.party_id || form.items.length === 0) {
      toast.error('Firm, Party and at least one item are required');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/credit-notes`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Credit note created successfully');
      setCreateOpen(false);
      resetForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create credit note');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter credit notes
  const filteredNotes = creditNotes.filter(cn => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      cn.credit_note_number?.toLowerCase().includes(search) ||
      cn.party_name?.toLowerCase().includes(search)
    );
  });

  // Stats
  const stats = {
    total: creditNotes.length,
    totalValue: creditNotes.reduce((sum, cn) => sum + cn.grand_total, 0),
    pending: creditNotes.filter(cn => cn.status === 'pending').length,
    pendingValue: creditNotes.filter(cn => cn.status === 'pending').reduce((sum, cn) => sum + cn.grand_total, 0)
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <DashboardLayout title="Credit Notes">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Credit Notes">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Notes" value={stats.total} icon={ReceiptText} color="cyan" />
          <StatCard 
            title="Total Value" 
            value={`₹${stats.totalValue.toLocaleString()}`} 
            icon={IndianRupee} 
            color="red" 
          />
          <StatCard title="Pending" value={stats.pending} icon={ReceiptText} color="yellow" />
          <StatCard 
            title="Pending Value" 
            value={`₹${stats.pendingValue.toLocaleString()}`} 
            icon={IndianRupee} 
            color="orange" 
          />
        </div>

        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search credit notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-80 pl-10 bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <Button
                onClick={() => { resetForm(); setCreateOpen(true); }}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="create-credit-note-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Credit Note
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Credit Notes Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Credit Notes ({filteredNotes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredNotes.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <ReceiptText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No credit notes found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">CN Number</TableHead>
                      <TableHead className="text-slate-300">Date</TableHead>
                      <TableHead className="text-slate-300">Firm</TableHead>
                      <TableHead className="text-slate-300">Party</TableHead>
                      <TableHead className="text-slate-300">Reason</TableHead>
                      <TableHead className="text-slate-300 text-right">Amount</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotes.map((cn) => (
                      <TableRow key={cn.id} className="border-slate-700">
                        <TableCell className="text-cyan-400 font-mono">{cn.credit_note_number}</TableCell>
                        <TableCell className="text-slate-300">
                          {new Date(cn.credit_note_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-white">{cn.firm_name}</TableCell>
                        <TableCell className="text-white">{cn.party_name}</TableCell>
                        <TableCell>
                          <Badge className={REASON_CONFIG[cn.reason]?.color || 'bg-slate-600'}>
                            {REASON_CONFIG[cn.reason]?.label || cn.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-red-400 text-right font-bold">
                          ₹{cn.grand_total?.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_CONFIG[cn.status]?.color}>
                            {STATUS_CONFIG[cn.status]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setSelectedNote(cn); setViewOpen(true); }}
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

        {/* Create Credit Note Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Credit Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-slate-300">Firm *</Label>
                  <Select value={form.firm_id} onValueChange={(v) => setForm({...form, firm_id: v})}>
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
                  <Label className="text-slate-300">Party *</Label>
                  <Select value={form.party_id} onValueChange={handlePartyChange}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select party" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                      {parties.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-white">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Date *</Label>
                  <Input
                    type="date"
                    value={form.credit_note_date}
                    onChange={(e) => setForm({...form, credit_note_date: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Original Invoice (Optional)</Label>
                  <Select value={form.original_invoice_id} onValueChange={(v) => setForm({...form, original_invoice_id: v})}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select invoice" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600 max-h-40">
                      <SelectItem value="" className="text-white">No specific invoice</SelectItem>
                      {invoices.map(inv => (
                        <SelectItem key={inv.id} value={inv.id} className="text-white">
                          {inv.invoice_number} - ₹{inv.grand_total?.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Reason *</Label>
                  <Select value={form.reason} onValueChange={(v) => setForm({...form, reason: v})}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {Object.entries(REASON_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key} className="text-white">{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
                          <Label className="text-slate-400 text-xs">GST%</Label>
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
                            ₹{(item.quantity * item.rate).toLocaleString()}
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

              {/* Totals */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-700/50 rounded-lg">
                <div>
                  <p className="text-slate-400 text-sm">Subtotal</p>
                  <p className="text-white text-xl">₹{totals.subtotal.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">GST</p>
                  <p className="text-purple-400 text-xl">₹{totals.totalGst.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Total</p>
                  <p className="text-red-400 text-2xl font-bold">₹{totals.grandTotal.toLocaleString()}</p>
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
                className="bg-red-600 hover:bg-red-700"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Credit Note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Credit Note Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Credit Note Details</DialogTitle>
            </DialogHeader>
            {selectedNote && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">CN Number</Label>
                    <p className="text-cyan-400 font-mono text-lg">{selectedNote.credit_note_number}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Date</Label>
                    <p className="text-white">{new Date(selectedNote.credit_note_date).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">Firm</Label>
                    <p className="text-white">{selectedNote.firm_name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Party</Label>
                    <p className="text-white">{selectedNote.party_name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">Reason</Label>
                    <Badge className={REASON_CONFIG[selectedNote.reason]?.color}>
                      {REASON_CONFIG[selectedNote.reason]?.label}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Status</Label>
                    <Badge className={STATUS_CONFIG[selectedNote.status]?.color}>
                      {STATUS_CONFIG[selectedNote.status]?.label}
                    </Badge>
                  </div>
                </div>

                {selectedNote.original_invoice_number && (
                  <div>
                    <Label className="text-slate-400 text-xs">Original Invoice</Label>
                    <p className="text-cyan-400">{selectedNote.original_invoice_number}</p>
                  </div>
                )}

                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm">Subtotal</p>
                      <p className="text-white">₹{selectedNote.subtotal?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">{selectedNote.is_igst ? 'IGST' : 'CGST+SGST'}</p>
                      <p className="text-purple-400">₹{selectedNote.total_gst?.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-600">
                    <p className="text-slate-400 text-sm">Total</p>
                    <p className="text-red-400 text-2xl font-bold">₹{selectedNote.grand_total?.toLocaleString()}</p>
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

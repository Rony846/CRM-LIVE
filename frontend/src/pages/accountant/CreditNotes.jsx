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
import { toast } from 'sonner';
import {
  ReceiptText, Plus, Loader2, Eye, Search, IndianRupee, Trash2, Building2
} from 'lucide-react';

const REASON_CONFIG = {
  sales_return:      { label: 'Sales Return',      tone: 'bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/25' },
  discount:          { label: 'Discount',           tone: 'bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25' },
  price_difference:  { label: 'Price Difference',   tone: 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25' },
  damaged_goods:     { label: 'Damaged Goods',      tone: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25' },
  other:             { label: 'Other',              tone: 'bg-muted text-muted-foreground ring-1 ring-border' }
};

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  tone: 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25' },
  adjusted: { label: 'Adjusted', tone: 'bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25' },
  refunded: { label: 'Refunded', tone: 'bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/25' }
};

const GST_RATES = [0, 5, 12, 18, 28];

const ReasonBadge = ({ reason }) => {
  const cfg = REASON_CONFIG[reason] || REASON_CONFIG.other;
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ${cfg.tone}`}>
      {cfg.label}
    </span>
  );
};

const StatusBadgeLocal = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, tone: 'bg-muted text-muted-foreground ring-1 ring-border' };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ${cfg.tone}`}>
      {cfg.label}
    </span>
  );
};

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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Credit Notes">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Notes" value={stats.total} icon={ReceiptText} tone="sky" />
          <StatCard
            title="Total Value"
            value={`₹${stats.totalValue.toLocaleString()}`}
            icon={IndianRupee}
            tone="rose"
          />
          <StatCard title="Pending" value={stats.pending} icon={ReceiptText} tone="amber" />
          <StatCard
            title="Pending Value"
            value={`₹${stats.pendingValue.toLocaleString()}`}
            icon={IndianRupee}
            tone="amber"
          />
        </div>

        {/* Filters */}
        <Card className="mg-card border border-border bg-card">
          <CardContent className="p-4">
            <div className="flex justify-between items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search credit notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-80 pl-10"
                />
              </div>
              <Button
                onClick={() => { resetForm(); setCreateOpen(true); }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="create-credit-note-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Credit Note
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Credit Notes Table */}
        <Card className="mg-card border border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground font-mono text-sm uppercase tracking-wide">
              Credit Notes ({filteredNotes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredNotes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ReceiptText className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p className="font-mono text-[11px] uppercase tracking-wide">No credit notes found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">CN Number</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Date</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Firm</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Party</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Reason</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Amount</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Status</TableHead>
                      <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotes.map((cn) => (
                      <TableRow key={cn.id} className="border-border hover:bg-muted/30">
                        <TableCell className="font-mono text-sm tabular-nums text-sky-400">{cn.credit_note_number}</TableCell>
                        <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                          {new Date(cn.credit_note_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-foreground">{cn.firm_name}</TableCell>
                        <TableCell className="text-foreground">{cn.party_name}</TableCell>
                        <TableCell>
                          <ReasonBadge reason={cn.reason} />
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-rose-400 font-semibold">
                          ₹{cn.grand_total?.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <StatusBadgeLocal status={cn.status} />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setSelectedNote(cn); setViewOpen(true); }}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted"
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
          <DialogContent className="bg-popover border border-border text-foreground max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create Credit Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Firm *</Label>
                  <Select value={form.firm_id} onValueChange={(v) => setForm({...form, firm_id: v})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select firm" />
                    </SelectTrigger>
                    <SelectContent>
                      {firms.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Party *</Label>
                  <Select value={form.party_id} onValueChange={handlePartyChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select party" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {parties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Date *</Label>
                  <Input
                    type="date"
                    value={form.credit_note_date}
                    onChange={(e) => setForm({...form, credit_note_date: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Original Invoice (Optional)</Label>
                  <Select value={form.original_invoice_id} onValueChange={(v) => setForm({...form, original_invoice_id: v})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select invoice" />
                    </SelectTrigger>
                    <SelectContent className="max-h-40">
                      <SelectItem value="">No specific invoice</SelectItem>
                      {invoices.map(inv => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.invoice_number} - ₹{inv.grand_total?.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Reason *</Label>
                  <Select value={form.reason} onValueChange={(v) => setForm({...form, reason: v})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REASON_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items */}
              <div className="border border-border rounded-lg p-4 bg-muted/20">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-mono text-[11px] uppercase tracking-wide text-sky-400 font-semibold">Line Items</span>
                  <Button size="sm" onClick={addItem} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>

                {form.items.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 font-mono text-[11px]">No items added</p>
                ) : (
                  <div className="space-y-3">
                    {form.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end bg-muted/40 p-3 rounded-lg border border-border">
                        <div className="col-span-3">
                          <Label className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">SKU</Label>
                          <Select
                            value={item.master_sku_id}
                            onValueChange={(v) => updateItem(index, 'master_sku_id', v)}
                          >
                            <SelectTrigger className="mt-1 text-sm">
                              <SelectValue placeholder="Select SKU" />
                            </SelectTrigger>
                            <SelectContent className="max-h-40">
                              {skus.map(s => (
                                <SelectItem key={s.id} value={s.id} className="text-sm">
                                  {s.sku_code} - {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">HSN</Label>
                          <Input
                            value={item.hsn_code}
                            onChange={(e) => updateItem(index, 'hsn_code', e.target.value)}
                            className="mt-1 text-sm"
                          />
                        </div>
                        <div className="col-span-1">
                          <Label className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Qty</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="mt-1 text-sm font-mono tabular-nums"
                            min="1"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Rate</Label>
                          <Input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                            className="mt-1 text-sm font-mono tabular-nums"
                          />
                        </div>
                        <div className="col-span-1">
                          <Label className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">GST%</Label>
                          <Select
                            value={item.gst_rate.toString()}
                            onValueChange={(v) => updateItem(index, 'gst_rate', parseFloat(v))}
                          >
                            <SelectTrigger className="mt-1 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GST_RATES.map(r => (
                                <SelectItem key={r} value={r.toString()}>{r}%</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Total</Label>
                          <div className="bg-muted border border-border text-foreground p-2 rounded text-sm mt-1 font-mono tabular-nums">
                            ₹{(item.quantity * item.rate).toLocaleString()}
                          </div>
                        </div>
                        <div className="col-span-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeItem(index)}
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
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
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/40 rounded-lg border border-border">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                  <p className="font-mono text-xl tabular-nums text-foreground">₹{totals.subtotal.toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">GST</p>
                  <p className="font-mono text-xl tabular-nums text-violet-400">₹{totals.totalGst.toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                  <p className="font-mono text-2xl tabular-nums font-bold text-rose-400">₹{totals.grandTotal.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({...form, notes: e.target.value})}
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setCreateOpen(false)} className="text-muted-foreground">Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={actionLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Credit Note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Credit Note Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="bg-popover border border-border text-foreground max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Credit Note Details</DialogTitle>
            </DialogHeader>
            {selectedNote && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">CN Number</p>
                    <p className="font-mono tabular-nums text-sky-400 text-lg mt-0.5">{selectedNote.credit_note_number}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Date</p>
                    <p className="text-foreground mt-0.5">{new Date(selectedNote.credit_note_date).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Firm</p>
                    <p className="text-foreground mt-0.5">{selectedNote.firm_name}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Party</p>
                    <p className="text-foreground mt-0.5">{selectedNote.party_name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Reason</p>
                    <ReasonBadge reason={selectedNote.reason} />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Status</p>
                    <StatusBadgeLocal status={selectedNote.status} />
                  </div>
                </div>

                {selectedNote.original_invoice_number && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Original Invoice</p>
                    <p className="font-mono tabular-nums text-sky-400 mt-0.5">{selectedNote.original_invoice_number}</p>
                  </div>
                )}

                <div className="p-4 bg-muted/40 rounded-lg border border-border">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                      <p className="font-mono tabular-nums text-foreground mt-0.5">₹{selectedNote.subtotal?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{selectedNote.is_igst ? 'IGST' : 'CGST+SGST'}</p>
                      <p className="font-mono tabular-nums text-violet-400 mt-0.5">₹{selectedNote.total_gst?.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                    <p className="font-mono tabular-nums text-rose-400 text-2xl font-bold mt-0.5">₹{selectedNote.grand_total?.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setViewOpen(false)} className="text-muted-foreground">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

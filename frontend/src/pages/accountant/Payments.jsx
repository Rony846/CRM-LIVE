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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Wallet, Plus, Loader2, Eye, Search, IndianRupee, ArrowDownLeft,
  ArrowUpRight, CreditCard, Building2, Banknote, Smartphone, ArrowLeftRight,
  CheckCircle, AlertCircle
} from 'lucide-react';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'cheque', label: 'Cheque', icon: CreditCard },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'adjustment', label: 'Adjustment', icon: ArrowLeftRight },
  { value: 'other', label: 'Other', icon: Wallet }
];

const PAYMENT_TYPE_CONFIG = {
  received: { label: 'Received', color: 'bg-green-600', icon: ArrowDownLeft },
  made: { label: 'Made', color: 'bg-orange-600', icon: ArrowUpRight }
};

export default function Payments() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [parties, setParties] = useState([]);
  const [firms, setFirms] = useState([]);
  const [outstandingData, setOutstandingData] = useState(null);
  
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Inter-company adjustment state
  const [icaOpen, setIcaOpen] = useState(false);
  const [icaLoading, setIcaLoading] = useState(false);
  const [icaOutstanding, setIcaOutstanding] = useState(null);
  const [icaForm, setIcaForm] = useState({
    from_firm_id: '',
    to_firm_id: '',
    amount: '',
    adjustment_date: new Date().toISOString().split('T')[0],
    sales_invoice_ids: [],
    purchase_entry_ids: [],
    notes: ''
  });
  
  const [form, setForm] = useState({
    party_id: '',
    payment_type: 'received',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'bank_transfer',
    reference_number: '',
    invoice_id: '',
    firm_id: '',
    bank_name: '',
    notes: ''
  });

  useEffect(() => {
    fetchAllData();
  }, [token]);

  const fetchAllData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [paymentsRes, partiesRes, firmsRes] = await Promise.all([
        axios.get(`${API}/payments`, { headers }),
        axios.get(`${API}/parties`, { headers }),
        axios.get(`${API}/firms`, { headers })
      ]);
      
      setPayments(paymentsRes.data || []);
      setParties(partiesRes.data || []);
      setFirms(firmsRes.data || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchOutstanding = async (partyId, firmId = null) => {
    if (!partyId) {
      setOutstandingData(null);
      return;
    }
    
    try {
      const params = firmId ? `?firm_id=${firmId}` : '';
      const res = await axios.get(`${API}/party-outstanding/${partyId}${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOutstandingData(res.data);
    } catch (error) {
      console.error('Failed to fetch outstanding:', error);
      setOutstandingData(null);
    }
  };

  const resetForm = () => {
    setForm({
      party_id: '', payment_type: 'received', amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'bank_transfer', reference_number: '',
      invoice_id: '', firm_id: '', bank_name: '', notes: ''
    });
    setOutstandingData(null);
  };

  const handlePartyChange = (partyId) => {
    setForm({ ...form, party_id: partyId, invoice_id: '' });
    fetchOutstanding(partyId, form.firm_id);
  };

  const handleFirmChange = (firmId) => {
    setForm({ ...form, firm_id: firmId, invoice_id: '' });
    if (form.party_id) {
      fetchOutstanding(form.party_id, firmId);
    }
  };

  // Inter-company adjustment functions
  const fetchIcaOutstanding = async (fromFirmId, toFirmId) => {
    if (!fromFirmId || !toFirmId || fromFirmId === toFirmId) {
      setIcaOutstanding(null);
      return;
    }
    
    setIcaLoading(true);
    try {
      const response = await axios.get(
        `${API}/payments/inter-company-outstanding`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { from_firm_id: fromFirmId, to_firm_id: toFirmId }
        }
      );
      setIcaOutstanding(response.data);
      // Auto-set suggested adjustment amount
      if (response.data.suggested_adjustment > 0) {
        setIcaForm(prev => ({ ...prev, amount: response.data.suggested_adjustment.toString() }));
      }
    } catch (error) {
      console.error('Failed to fetch ICA outstanding:', error);
      setIcaOutstanding(null);
    } finally {
      setIcaLoading(false);
    }
  };

  const handleIcaFirmChange = (field, value) => {
    const newForm = { ...icaForm, [field]: value, sales_invoice_ids: [], purchase_entry_ids: [] };
    setIcaForm(newForm);
    
    if (field === 'from_firm_id' && newForm.to_firm_id) {
      fetchIcaOutstanding(value, newForm.to_firm_id);
    } else if (field === 'to_firm_id' && newForm.from_firm_id) {
      fetchIcaOutstanding(newForm.from_firm_id, value);
    }
  };

  const handleIcaCreate = async () => {
    if (!icaForm.from_firm_id || !icaForm.to_firm_id) {
      toast.error('Please select both firms');
      return;
    }
    if (!icaForm.amount || parseFloat(icaForm.amount) <= 0) {
      toast.error('Please enter a valid adjustment amount');
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await axios.post(
        `${API}/payments/inter-company-adjustment`,
        {
          ...icaForm,
          amount: parseFloat(icaForm.amount)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message);
      setIcaOpen(false);
      resetIcaForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create adjustment');
    } finally {
      setActionLoading(false);
    }
  };

  const resetIcaForm = () => {
    setIcaForm({
      from_firm_id: '',
      to_firm_id: '',
      amount: '',
      adjustment_date: new Date().toISOString().split('T')[0],
      sales_invoice_ids: [],
      purchase_entry_ids: [],
      notes: ''
    });
    setIcaOutstanding(null);
  };

  const toggleInvoiceSelection = (id, type) => {
    if (type === 'receivable') {
      setIcaForm(prev => ({
        ...prev,
        sales_invoice_ids: prev.sales_invoice_ids.includes(id)
          ? prev.sales_invoice_ids.filter(i => i !== id)
          : [...prev.sales_invoice_ids, id]
      }));
    } else {
      setIcaForm(prev => ({
        ...prev,
        purchase_entry_ids: prev.purchase_entry_ids.includes(id)
          ? prev.purchase_entry_ids.filter(i => i !== id)
          : [...prev.purchase_entry_ids, id]
      }));
    }
  };

  const handleCreate = async () => {
    if (!form.firm_id) {
      toast.error('Please select a firm/account');
      return;
    }
    if (!form.party_id || !form.amount || !form.payment_date) {
      toast.error('Party, Amount and Date are required');
      return;
    }

    if (parseFloat(form.amount) <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        invoice_id: form.invoice_id || null
      };
      
      await axios.post(`${API}/payments`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Payment recorded successfully');
      setCreateOpen(false);
      resetForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter payments
  const filteredPayments = payments.filter(p => {
    if (activeTab === 'received' && p.payment_type !== 'received') return false;
    if (activeTab === 'made' && p.payment_type !== 'made') return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        p.payment_number?.toLowerCase().includes(search) ||
        p.party_name?.toLowerCase().includes(search) ||
        p.reference_number?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: payments.length,
    totalReceived: payments.filter(p => p.payment_type === 'received').reduce((sum, p) => sum + p.amount, 0),
    totalMade: payments.filter(p => p.payment_type === 'made').reduce((sum, p) => sum + p.amount, 0),
    receivedCount: payments.filter(p => p.payment_type === 'received').length,
    madeCount: payments.filter(p => p.payment_type === 'made').length
  };

  if (loading) {
    return (
      <DashboardLayout title="Payment Tracking">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Payment Tracking">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard title="Total Payments" value={stats.total} icon={Wallet} color="cyan" />
          <StatCard title="Received" value={stats.receivedCount} icon={ArrowDownLeft} color="green" />
          <StatCard 
            title="Total Received" 
            value={`₹${stats.totalReceived.toLocaleString()}`} 
            icon={IndianRupee} 
            color="emerald" 
          />
          <StatCard title="Payments Made" value={stats.madeCount} icon={ArrowUpRight} color="orange" />
          <StatCard 
            title="Total Made" 
            value={`₹${stats.totalMade.toLocaleString()}`} 
            icon={IndianRupee} 
            color="red" 
          />
        </div>

        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search payments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-80 pl-10 bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => { resetIcaForm(); setIcaOpen(true); }}
                  variant="outline"
                  className="border-purple-500 text-purple-400 hover:bg-purple-900/30"
                  data-testid="inter-company-adj-btn"
                >
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Inter-Company Adjustment
                </Button>
                <Button
                  onClick={() => { resetForm(); setCreateOpen(true); }}
                  className="bg-cyan-600 hover:bg-cyan-700"
                  data-testid="record-payment-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Record Payment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="all" className="data-[state=active]:bg-cyan-600">
              All ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="received" className="data-[state=active]:bg-green-600">
              <ArrowDownLeft className="w-4 h-4 mr-1" />
              Received ({stats.receivedCount})
            </TabsTrigger>
            <TabsTrigger value="made" className="data-[state=active]:bg-orange-600">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              Made ({stats.madeCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Payments ({filteredPayments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredPayments.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No payments found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">Payment #</TableHead>
                          <TableHead className="text-slate-300">Date</TableHead>
                          <TableHead className="text-slate-300">Type</TableHead>
                          <TableHead className="text-slate-300">Party</TableHead>
                          <TableHead className="text-slate-300">Mode</TableHead>
                          <TableHead className="text-slate-300">Reference</TableHead>
                          <TableHead className="text-slate-300 text-right">Amount</TableHead>
                          <TableHead className="text-slate-300">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPayments.map((payment) => (
                          <TableRow key={payment.id} className="border-slate-700">
                            <TableCell className="text-cyan-400 font-mono">{payment.payment_number}</TableCell>
                            <TableCell className="text-slate-300">
                              {new Date(payment.payment_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={PAYMENT_TYPE_CONFIG[payment.payment_type]?.color}>
                                {PAYMENT_TYPE_CONFIG[payment.payment_type]?.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-white">{payment.party_name}</TableCell>
                            <TableCell className="text-slate-300 capitalize">
                              {payment.payment_mode?.replace('_', ' ')}
                            </TableCell>
                            <TableCell className="text-slate-400 font-mono text-sm">
                              {payment.reference_number || '-'}
                            </TableCell>
                            <TableCell className={`text-right font-bold ${
                              payment.payment_type === 'received' ? 'text-green-400' : 'text-orange-400'
                            }`}>
                              ₹{payment.amount?.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setSelectedPayment(payment); setViewOpen(true); }}
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
          </TabsContent>
        </Tabs>

        {/* Create Payment Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-xl">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Payment Type */}
              <div>
                <Label className="text-slate-300">Payment Type *</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setForm({...form, payment_type: 'received'})}
                    className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all ${
                      form.payment_type === 'received' 
                        ? 'border-green-500 bg-green-900/30' 
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <ArrowDownLeft className="w-5 h-5 text-green-400" />
                    <span className="text-white">Payment Received</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({...form, payment_type: 'made'})}
                    className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all ${
                      form.payment_type === 'made' 
                        ? 'border-orange-500 bg-orange-900/30' 
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <ArrowUpRight className="w-5 h-5 text-orange-400" />
                    <span className="text-white">Payment Made</span>
                  </button>
                </div>
              </div>

              {/* Firm Selector - Required */}
              <div>
                <Label className="text-slate-300">Firm / Account *</Label>
                <Select value={form.firm_id} onValueChange={handleFirmChange}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1" data-testid="firm-select">
                    <SelectValue placeholder="Select firm account" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id} className="text-white">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-cyan-400" />
                          {f.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  {form.payment_type === 'received' 
                    ? 'Payment will be credited to this firm account' 
                    : 'Payment will be debited from this firm account'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Party *</Label>
                  <Select value={form.party_id} onValueChange={handlePartyChange}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select party" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                      {parties.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-white">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Amount (₹) *</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({...form, amount: e.target.value})}
                    placeholder="Enter amount"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    min="0.01"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Outstanding Info */}
              {form.party_id && (
                <div className={`p-3 rounded-lg border ${
                  outstandingData?.total_receivable > 0 || outstandingData?.total_payable > 0
                    ? 'bg-blue-900/30 border-blue-700' 
                    : 'bg-slate-700 border-slate-600'
                }`}>
                  {outstandingData ? (
                    <div className="space-y-2">
                      <p className="text-slate-300 text-sm font-medium">Outstanding Balance:</p>
                      <div className="flex flex-wrap gap-4">
                        {outstandingData.total_receivable > 0 && (
                          <span className="text-green-400">
                            <strong>Receivable:</strong> ₹{outstandingData.total_receivable.toLocaleString()}
                            <span className="text-xs text-slate-400 ml-1">
                              ({outstandingData.sales_outstanding?.length || 0} invoices)
                            </span>
                          </span>
                        )}
                        {outstandingData.total_payable > 0 && (
                          <span className="text-orange-400">
                            <strong>Payable:</strong> ₹{outstandingData.total_payable.toLocaleString()}
                            <span className="text-xs text-slate-400 ml-1">
                              ({outstandingData.purchase_outstanding?.length || 0} purchases)
                            </span>
                          </span>
                        )}
                        {outstandingData.total_receivable === 0 && outstandingData.total_payable === 0 && (
                          <span className="text-slate-400">No outstanding balance for this party</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">Loading outstanding balance...</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Payment Date *</Label>
                  <Input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setForm({...form, payment_date: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Payment Mode *</Label>
                  <Select value={form.payment_mode} onValueChange={(v) => setForm({...form, payment_mode: v})}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {PAYMENT_MODES.map(mode => (
                        <SelectItem key={mode.value} value={mode.value} className="text-white">
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Reference # (UTR/Cheque No)</Label>
                  <Input
                    value={form.reference_number}
                    onChange={(e) => setForm({...form, reference_number: e.target.value})}
                    placeholder="e.g., UTR123456789"
                    className="bg-slate-700 border-slate-600 text-white mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Bank Name</Label>
                  <Input
                    value={form.bank_name}
                    onChange={(e) => setForm({...form, bank_name: e.target.value})}
                    placeholder="e.g., HDFC Bank"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              {/* Link to Invoice */}
              {outstandingData && (form.payment_type === 'received' 
                ? outstandingData.sales_outstanding?.length > 0 
                : outstandingData.purchase_outstanding?.length > 0) && (
                <div>
                  <Label className="text-slate-300">Link to Invoice (Optional)</Label>
                  <Select value={form.invoice_id} onValueChange={(v) => setForm({...form, invoice_id: v})}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select invoice to settle" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600 max-h-40">
                      <SelectItem value="" className="text-white">No specific invoice</SelectItem>
                      {(form.payment_type === 'received' 
                        ? outstandingData.sales_outstanding 
                        : outstandingData.purchase_outstanding
                      )?.map(inv => (
                        <SelectItem key={inv.id} value={inv.id} className="text-white">
                          {inv.invoice_number} - ₹{inv.balance_due?.toLocaleString()} due
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label className="text-slate-300">Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({...form, notes: e.target.value})}
                  placeholder="Additional notes..."
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
                className={form.payment_type === 'received' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Record {form.payment_type === 'received' ? 'Receipt' : 'Payment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Payment Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Payment Details</DialogTitle>
            </DialogHeader>
            {selectedPayment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">Payment Number</Label>
                    <p className="text-cyan-400 font-mono">{selectedPayment.payment_number}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Type</Label>
                    <Badge className={PAYMENT_TYPE_CONFIG[selectedPayment.payment_type]?.color}>
                      {PAYMENT_TYPE_CONFIG[selectedPayment.payment_type]?.label}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">Party</Label>
                    <p className="text-white">{selectedPayment.party_name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Amount</Label>
                    <p className={`text-2xl font-bold ${
                      selectedPayment.payment_type === 'received' ? 'text-green-400' : 'text-orange-400'
                    }`}>
                      ₹{selectedPayment.amount?.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">Date</Label>
                    <p className="text-white">{new Date(selectedPayment.payment_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Mode</Label>
                    <p className="text-white capitalize">{selectedPayment.payment_mode?.replace('_', ' ')}</p>
                  </div>
                </div>

                {selectedPayment.reference_number && (
                  <div>
                    <Label className="text-slate-400 text-xs">Reference Number</Label>
                    <p className="text-white font-mono">{selectedPayment.reference_number}</p>
                  </div>
                )}

                {selectedPayment.invoice_number && (
                  <div>
                    <Label className="text-slate-400 text-xs">Linked Invoice</Label>
                    <p className="text-cyan-400">{selectedPayment.invoice_number}</p>
                  </div>
                )}

                {selectedPayment.notes && (
                  <div>
                    <Label className="text-slate-400 text-xs">Notes</Label>
                    <p className="text-slate-300">{selectedPayment.notes}</p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-700">
                  <p className="text-slate-400 text-xs">
                    Recorded by {selectedPayment.created_by_name} on {new Date(selectedPayment.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setViewOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Inter-Company Adjustment Dialog */}
        <Dialog open={icaOpen} onOpenChange={setIcaOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-purple-400" />
                Inter-Company Payment Adjustment
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Explanation */}
              <div className="p-3 bg-purple-900/30 border border-purple-700 rounded-lg text-sm">
                <p className="text-purple-300">
                  <strong>What is this?</strong> When Firm A sells to Firm B internally, Firm A has a receivable 
                  and Firm B has a payable. This adjustment knocks off both without actual cash transfer.
                </p>
              </div>

              {/* Firm Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Selling Firm (Has Receivable) *</Label>
                  <Select value={icaForm.from_firm_id} onValueChange={(v) => handleIcaFirmChange('from_firm_id', v)}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select selling firm" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {firms.filter(f => f.id !== icaForm.to_firm_id).map(firm => (
                        <SelectItem key={firm.id} value={firm.id} className="text-white">
                          {firm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Buying Firm (Has Payable) *</Label>
                  <Select value={icaForm.to_firm_id} onValueChange={(v) => handleIcaFirmChange('to_firm_id', v)}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select buying firm" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {firms.filter(f => f.id !== icaForm.from_firm_id).map(firm => (
                        <SelectItem key={firm.id} value={firm.id} className="text-white">
                          {firm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Loading state */}
              {icaLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  <span className="ml-2 text-slate-400">Loading outstanding amounts...</span>
                </div>
              )}

              {/* Outstanding Summary */}
              {icaOutstanding && !icaLoading && (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg">
                      <p className="text-xs text-green-400">Receivable ({icaOutstanding.from_firm?.name})</p>
                      <p className="text-xl font-bold text-green-400">
                        ₹{icaOutstanding.total_receivable?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-slate-500">{icaOutstanding.receivables?.length || 0} invoices</p>
                    </div>
                    <div className="p-3 bg-orange-900/30 border border-orange-700 rounded-lg">
                      <p className="text-xs text-orange-400">Payable ({icaOutstanding.to_firm?.name})</p>
                      <p className="text-xl font-bold text-orange-400">
                        ₹{icaOutstanding.total_payable?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-slate-500">{icaOutstanding.payables?.length || 0} purchases</p>
                    </div>
                    <div className="p-3 bg-purple-900/30 border border-purple-700 rounded-lg">
                      <p className="text-xs text-purple-400">Suggested Adjustment</p>
                      <p className="text-xl font-bold text-purple-400">
                        ₹{icaOutstanding.suggested_adjustment?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-slate-500">
                        Net: {icaOutstanding.net_position >= 0 ? '+' : ''}₹{icaOutstanding.net_position?.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Receivables list */}
                  {icaOutstanding.receivables?.length > 0 && (
                    <div>
                      <Label className="text-green-400 text-sm">Receivables to Knock Off</Label>
                      <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                        {icaOutstanding.receivables.map(inv => (
                          <div 
                            key={inv.id}
                            className={`flex items-center justify-between p-2 rounded text-sm cursor-pointer ${
                              icaForm.sales_invoice_ids.includes(inv.id) 
                                ? 'bg-green-900/50 border border-green-600' 
                                : 'bg-slate-700/50 border border-slate-600'
                            }`}
                            onClick={() => toggleInvoiceSelection(inv.id, 'receivable')}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox 
                                checked={icaForm.sales_invoice_ids.includes(inv.id)}
                                className="border-green-500"
                              />
                              <span className="text-white">{inv.invoice_number}</span>
                              <span className="text-slate-400 text-xs">{inv.invoice_date}</span>
                            </div>
                            <span className="text-green-400">₹{inv.balance_due?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payables list */}
                  {icaOutstanding.payables?.length > 0 && (
                    <div>
                      <Label className="text-orange-400 text-sm">Payables to Knock Off</Label>
                      <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                        {icaOutstanding.payables.map(pur => (
                          <div 
                            key={pur.id}
                            className={`flex items-center justify-between p-2 rounded text-sm cursor-pointer ${
                              icaForm.purchase_entry_ids.includes(pur.id) 
                                ? 'bg-orange-900/50 border border-orange-600' 
                                : 'bg-slate-700/50 border border-slate-600'
                            }`}
                            onClick={() => toggleInvoiceSelection(pur.id, 'payable')}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox 
                                checked={icaForm.purchase_entry_ids.includes(pur.id)}
                                className="border-orange-500"
                              />
                              <span className="text-white">{pur.invoice_number || pur.purchase_number}</span>
                              <span className="text-slate-400 text-xs">{pur.invoice_date}</span>
                            </div>
                            <span className="text-orange-400">₹{pur.balance_due?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No outstanding */}
                  {icaOutstanding.total_receivable === 0 && icaOutstanding.total_payable === 0 && (
                    <div className="text-center py-4 text-slate-400">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                      <p>No outstanding inter-company balances between these firms</p>
                    </div>
                  )}
                </div>
              )}

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Adjustment Amount *</Label>
                  <Input
                    type="number"
                    value={icaForm.amount}
                    onChange={(e) => setIcaForm({ ...icaForm, amount: e.target.value })}
                    placeholder="Enter amount to adjust"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Adjustment Date *</Label>
                  <Input
                    type="date"
                    value={icaForm.adjustment_date}
                    onChange={(e) => setIcaForm({ ...icaForm, adjustment_date: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-slate-300">Notes</Label>
                <Textarea
                  value={icaForm.notes}
                  onChange={(e) => setIcaForm({ ...icaForm, notes: e.target.value })}
                  placeholder="Reason for adjustment..."
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  rows={2}
                />
              </div>

              {/* What will happen */}
              {icaForm.amount && parseFloat(icaForm.amount) > 0 && icaForm.from_firm_id && icaForm.to_firm_id && (
                <div className="p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-sm">
                  <p className="text-slate-300 font-medium mb-2">This adjustment will create:</p>
                  <ul className="space-y-1 text-slate-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      Payment Received (₹{parseFloat(icaForm.amount).toLocaleString()}) in {firms.find(f => f.id === icaForm.from_firm_id)?.name}'s books
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-400" />
                      Payment Made (₹{parseFloat(icaForm.amount).toLocaleString()}) in {firms.find(f => f.id === icaForm.to_firm_id)?.name}'s books
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIcaOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleIcaCreate}
                disabled={actionLoading || !icaForm.from_firm_id || !icaForm.to_firm_id || !icaForm.amount}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Adjustment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

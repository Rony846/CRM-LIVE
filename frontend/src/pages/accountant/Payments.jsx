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
import { toast } from 'sonner';
import { 
  Wallet, Plus, Loader2, Eye, Search, IndianRupee, ArrowDownLeft,
  ArrowUpRight, CreditCard, Building2, Banknote, Smartphone
} from 'lucide-react';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'cheque', label: 'Cheque', icon: CreditCard },
  { value: 'card', label: 'Card', icon: CreditCard },
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

  const fetchOutstanding = async (partyId) => {
    if (!partyId) {
      setOutstandingData(null);
      return;
    }
    
    try {
      const res = await axios.get(`${API}/party-outstanding/${partyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOutstandingData(res.data);
    } catch (error) {
      console.error('Failed to fetch outstanding:', error);
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
    fetchOutstanding(partyId);
  };

  const handleCreate = async () => {
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
        invoice_id: form.invoice_id || null,
        firm_id: form.firm_id || null
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
              <Button
                onClick={() => { resetForm(); setCreateOpen(true); }}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="record-payment-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
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
              {outstandingData && (
                <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
                  <p className="text-blue-300 text-sm">
                    <strong>Outstanding:</strong> 
                    {outstandingData.total_receivable > 0 && (
                      <span className="ml-2 text-green-400">
                        Receivable: ₹{outstandingData.total_receivable.toLocaleString()}
                      </span>
                    )}
                    {outstandingData.total_payable > 0 && (
                      <span className="ml-2 text-orange-400">
                        Payable: ₹{outstandingData.total_payable.toLocaleString()}
                      </span>
                    )}
                  </p>
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
      </div>
    </DashboardLayout>
  );
}

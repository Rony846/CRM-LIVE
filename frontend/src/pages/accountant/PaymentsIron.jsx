import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Wallet, Plus, Loader2, Eye, Search, IndianRupee, ArrowDownLeft,
  ArrowUpRight, CreditCard, Building2, Banknote, Smartphone, ArrowLeftRight,
  CheckCircle
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

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
  received: { label: 'Received', tone: 'ok', icon: ArrowDownLeft },
  made: { label: 'Made', tone: 'warn', icon: ArrowUpRight }
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const statCards = [
    { label: 'Total Payments', value: stats.total.toLocaleString('en-IN'), icon: Wallet, tone: T.blue },
    { label: 'Received', value: stats.receivedCount.toLocaleString('en-IN'), icon: ArrowDownLeft, tone: T.green },
    { label: 'Total Received', value: inr(stats.totalReceived), icon: IndianRupee, tone: T.green },
    { label: 'Payments Made', value: stats.madeCount.toLocaleString('en-IN'), icon: ArrowUpRight, tone: T.orange },
    { label: 'Total Made', value: inr(stats.totalMade), icon: IndianRupee, tone: T.orangeDeep },
  ];

  const tabs = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'received', label: 'Received', count: stats.receivedCount, icon: ArrowDownLeft },
    { key: 'made', label: 'Made', count: stats.madeCount, icon: ArrowUpRight },
  ];

  const tableHeaders = ['Payment #', 'Date', 'Type', 'Party', 'Mode', 'Reference', 'Amount', ''];

  const headerButtons = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={() => { resetIcaForm(); setIcaOpen(true); }}
        data-testid="inter-company-adj-btn"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid #DDD3EF`, background: T.white, color: '#6D4AB0', borderRadius: 6, padding: '8px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}
      >
        <ArrowLeftRight size={14} strokeWidth={2} />
        Inter-Company Adjustment
      </button>
      <button
        onClick={() => { resetForm(); setCreateOpen(true); }}
        data-testid="record-payment-btn"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}
      >
        <Plus size={14} strokeWidth={2.4} />
        Record Payment
      </button>
    </div>
  );

  return (
    <IronShell title="Payments" subtitle={`${stats.total.toLocaleString('en-IN')} PAYMENTS · RECEIPTS + MADE`} onRefresh={fetchAllData} headerRight={headerButtons}>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...mono, fontSize: 19, fontWeight: 700, color: T.iron900, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Tabs + search */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {tabs.map((tb) => {
                  const Icon = tb.icon;
                  const active = activeTab === tb.key;
                  return (
                    <button key={tb.key} onClick={() => setActiveTab(tb.key)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                      {Icon && <Icon size={13} strokeWidth={2} />}{tb.label}
                      <span style={{ ...mono, fontSize: 11, opacity: 0.85 }}>({tb.count})</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search payments…"
                  style={{ border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px 7px 30px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none', width: 260 }} />
              </div>
            </div>

            {/* Table */}
            {filteredPayments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                <Wallet size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No payments found</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>Try adjusting your search or tab.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {tableHeaders.map((h, i) => (
                      <th key={i} style={{ ...thCell, textAlign: (i === 6 || i === 7) ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr></thead>
                  <tbody>{filteredPayments.map((payment) => {
                    const cfg = PAYMENT_TYPE_CONFIG[payment.payment_type];
                    const isReceived = payment.payment_type === 'received';
                    return (
                      <tr key={payment.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={tdCell}>
                          <span style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{payment.payment_number}</span>
                        </td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>
                          {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td style={tdCell}>
                          <span style={badgeStyle(cfg?.tone || 'slate')}>{cfg?.label || payment.payment_type}</span>
                        </td>
                        <td style={{ ...tdCell }}>
                          <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{payment.party_name}</span>
                        </td>
                        <td style={{ ...tdCell, fontSize: 12, color: T.iron700, textTransform: 'capitalize' }}>
                          {payment.payment_mode?.replace('_', ' ') || '-'}
                        </td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>
                          {payment.reference_number || '-'}
                        </td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, fontSize: 12.5, color: isReceived ? T.green : T.voltageText }}>
                          {inr(payment.amount)}
                        </td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <button onClick={() => { setSelectedPayment(payment); setViewOpen(true); }} title="View"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 9px', cursor: 'pointer' }}>
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </IronCard>
        </>
      )}

      {/* Create Payment Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-popover border border-border rounded-lg max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Payment Type */}
            <div>
              <Label>Payment Type *</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setForm({...form, payment_type: 'received'})}
                  className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all font-mono text-[11px] uppercase tracking-wide ${
                    form.payment_type === 'received'
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-500'
                      : 'border-border text-muted-foreground hover:border-border/60'
                  }`}
                >
                  <ArrowDownLeft className="w-5 h-5" />
                  Payment Received
                </button>
                <button
                  type="button"
                  onClick={() => setForm({...form, payment_type: 'made'})}
                  className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all font-mono text-[11px] uppercase tracking-wide ${
                    form.payment_type === 'made'
                      ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                      : 'border-border text-muted-foreground hover:border-border/60'
                  }`}
                >
                  <ArrowUpRight className="w-5 h-5" />
                  Payment Made
                </button>
              </div>
            </div>

            {/* Firm Selector */}
            <div>
              <Label>Firm / Account *</Label>
              <Select value={form.firm_id} onValueChange={handleFirmChange}>
                <SelectTrigger className="mt-1" data-testid="firm-select">
                  <SelectValue placeholder="Select firm account" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {firms.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        {f.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="font-mono text-[11px] text-muted-foreground mt-1">
                {form.payment_type === 'received'
                  ? 'Payment will be credited to this firm account'
                  : 'Payment will be debited from this firm account'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Party *</Label>
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
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({...form, amount: e.target.value})}
                  placeholder="Enter amount"
                  className="mt-1"
                  min="0.01"
                  step="0.01"
                />
              </div>
            </div>

            {/* Outstanding Info */}
            {form.party_id && (
              <div className={`p-3 rounded-lg border ${
                outstandingData?.total_receivable > 0 || outstandingData?.total_payable > 0
                  ? 'bg-primary/[0.07] border-primary/25'
                  : 'bg-muted border-border'
              }`}>
                {outstandingData ? (
                  <div className="space-y-2">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Outstanding Balance:</p>
                    <div className="flex flex-wrap gap-4">
                      {outstandingData.total_receivable > 0 && (
                        <span className="font-mono text-sm tabular-nums text-emerald-500">
                          <strong>Receivable:</strong> ₹{outstandingData.total_receivable.toLocaleString()}
                          <span className="font-mono text-[11px] text-muted-foreground ml-1">
                            ({outstandingData.sales_outstanding?.length || 0} invoices)
                          </span>
                        </span>
                      )}
                      {outstandingData.total_payable > 0 && (
                        <span className="font-mono text-sm tabular-nums text-amber-400">
                          <strong>Payable:</strong> ₹{outstandingData.total_payable.toLocaleString()}
                          <span className="font-mono text-[11px] text-muted-foreground ml-1">
                            ({outstandingData.purchase_outstanding?.length || 0} purchases)
                          </span>
                        </span>
                      )}
                      {outstandingData.total_receivable === 0 && outstandingData.total_payable === 0 && (
                        <span className="font-mono text-[11px] text-muted-foreground">No outstanding balance for this party</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="font-mono text-[11px] text-muted-foreground">Loading outstanding balance...</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Date *</Label>
                <Input
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => setForm({...form, payment_date: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Payment Mode *</Label>
                <Select value={form.payment_mode} onValueChange={(v) => setForm({...form, payment_mode: v})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map(mode => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Reference # (UTR/Cheque No)</Label>
                <Input
                  value={form.reference_number}
                  onChange={(e) => setForm({...form, reference_number: e.target.value})}
                  placeholder="e.g., UTR123456789"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label>Bank Name</Label>
                <Input
                  value={form.bank_name}
                  onChange={(e) => setForm({...form, bank_name: e.target.value})}
                  placeholder="e.g., HDFC Bank"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Link to Invoice */}
            {outstandingData && (form.payment_type === 'received'
              ? outstandingData.sales_outstanding?.length > 0
              : outstandingData.purchase_outstanding?.length > 0) && (
              <div>
                <Label>Link to Invoice (Optional)</Label>
                <Select value={form.invoice_id} onValueChange={(v) => setForm({...form, invoice_id: v})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select invoice to settle" />
                  </SelectTrigger>
                  <SelectContent className="max-h-40">
                    <SelectItem value="">No specific invoice</SelectItem>
                    {(form.payment_type === 'received'
                      ? outstandingData.sales_outstanding
                      : outstandingData.purchase_outstanding
                    )?.map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>
                        <span className="font-mono">{inv.invoice_number}</span> &mdash; ₹{inv.balance_due?.toLocaleString()} due
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                placeholder="Additional notes..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={actionLoading}
              className={form.payment_type === 'received'
                ? 'bg-emerald-500/80 hover:bg-emerald-500 text-white font-mono text-[11px] uppercase tracking-wide'
                : 'bg-amber-400/80 hover:bg-amber-400 text-black font-mono text-[11px] uppercase tracking-wide'
              }
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Record {form.payment_type === 'received' ? 'Receipt' : 'Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Payment Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="bg-popover border border-border rounded-lg max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Payment Details</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Payment Number</p>
                  <p className="font-mono tabular-nums text-primary">{selectedPayment.payment_number}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Type</p>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ${
                    selectedPayment.payment_type === 'received'
                      ? 'bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25'
                      : 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25'
                  }`}>
                    {PAYMENT_TYPE_CONFIG[selectedPayment.payment_type]?.label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Party</p>
                  <p className="text-foreground font-medium">{selectedPayment.party_name}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Amount</p>
                  <p className={`font-mono text-2xl font-bold tabular-nums ${
                    selectedPayment.payment_type === 'received' ? 'text-emerald-500' : 'text-amber-400'
                  }`}>
                    ₹{selectedPayment.amount?.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Date</p>
                  <p className="font-mono tabular-nums text-foreground">{new Date(selectedPayment.payment_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Mode</p>
                  <p className="text-foreground capitalize">{selectedPayment.payment_mode?.replace('_', ' ')}</p>
                </div>
              </div>

              {selectedPayment.reference_number && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Reference Number</p>
                  <p className="font-mono tabular-nums text-foreground">{selectedPayment.reference_number}</p>
                </div>
              )}

              {selectedPayment.invoice_number && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Linked Invoice</p>
                  <p className="font-mono tabular-nums text-primary">{selectedPayment.invoice_number}</p>
                </div>
              )}

              {selectedPayment.notes && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
                  <p className="text-muted-foreground text-sm">{selectedPayment.notes}</p>
                </div>
              )}

              <div className="pt-2 border-t border-border">
                <p className="font-mono text-[11px] text-muted-foreground">
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
        <DialogContent className="bg-popover border border-border rounded-lg max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-violet-400" />
              Inter-Company Payment Adjustment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Explanation */}
            <div className="p-3 bg-violet-400/[0.07] border border-violet-400/25 rounded-lg">
              <p className="font-mono text-[11px] text-violet-400">
                <strong>What is this?</strong> When Firm A sells to Firm B internally, Firm A has a receivable
                and Firm B has a payable. This adjustment knocks off both without actual cash transfer.
              </p>
            </div>

            {/* Firm Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Selling Firm (Has Receivable) *</Label>
                <Select value={icaForm.from_firm_id} onValueChange={(v) => handleIcaFirmChange('from_firm_id', v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select selling firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.filter(f => f.id !== icaForm.to_firm_id).map(firm => (
                      <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Buying Firm (Has Payable) *</Label>
                <Select value={icaForm.to_firm_id} onValueChange={(v) => handleIcaFirmChange('to_firm_id', v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select buying firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.filter(f => f.id !== icaForm.from_firm_id).map(firm => (
                      <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Loading state */}
            {icaLoading && (
              <div className="flex items-center justify-center py-4 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                <span className="font-mono text-[11px] text-muted-foreground">Loading outstanding amounts...</span>
              </div>
            )}

            {/* Outstanding Summary */}
            {icaOutstanding && !icaLoading && (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07]">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-emerald-500">Receivable ({icaOutstanding.from_firm?.name})</p>
                    <p className="font-mono text-xl font-bold tabular-nums text-emerald-500 mt-1">
                      ₹{icaOutstanding.total_receivable?.toLocaleString() || 0}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">{icaOutstanding.receivables?.length || 0} invoices</p>
                  </div>
                  <div className="p-3 rounded-lg border border-amber-400/25 bg-amber-400/[0.07]">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-amber-400">Payable ({icaOutstanding.to_firm?.name})</p>
                    <p className="font-mono text-xl font-bold tabular-nums text-amber-400 mt-1">
                      ₹{icaOutstanding.total_payable?.toLocaleString() || 0}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">{icaOutstanding.payables?.length || 0} purchases</p>
                  </div>
                  <div className="p-3 rounded-lg border border-violet-400/25 bg-violet-400/[0.07]">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-violet-400">Suggested Adjustment</p>
                    <p className="font-mono text-xl font-bold tabular-nums text-violet-400 mt-1">
                      ₹{icaOutstanding.suggested_adjustment?.toLocaleString() || 0}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Net: {icaOutstanding.net_position >= 0 ? '+' : ''}₹{icaOutstanding.net_position?.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Receivables list */}
                {icaOutstanding.receivables?.length > 0 && (
                  <div>
                    <Label className="text-emerald-500">Receivables to Knock Off</Label>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {icaOutstanding.receivables.map(inv => (
                        <div
                          key={inv.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                            icaForm.sales_invoice_ids.includes(inv.id)
                              ? 'bg-emerald-500/[0.10] border-emerald-500/40'
                              : 'bg-muted border-border hover:border-border/60'
                          }`}
                          onClick={() => toggleInvoiceSelection(inv.id, 'receivable')}
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={icaForm.sales_invoice_ids.includes(inv.id)}
                              className="border-emerald-500/50"
                            />
                            <span className="font-mono text-sm text-foreground">{inv.invoice_number}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">{inv.invoice_date}</span>
                          </div>
                          <span className="font-mono tabular-nums text-emerald-500">₹{inv.balance_due?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payables list */}
                {icaOutstanding.payables?.length > 0 && (
                  <div>
                    <Label className="text-amber-400">Payables to Knock Off</Label>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {icaOutstanding.payables.map(pur => (
                        <div
                          key={pur.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                            icaForm.purchase_entry_ids.includes(pur.id)
                              ? 'bg-amber-400/[0.10] border-amber-400/40'
                              : 'bg-muted border-border hover:border-border/60'
                          }`}
                          onClick={() => toggleInvoiceSelection(pur.id, 'payable')}
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={icaForm.purchase_entry_ids.includes(pur.id)}
                              className="border-amber-400/50"
                            />
                            <span className="font-mono text-sm text-foreground">{pur.invoice_number || pur.purchase_number}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">{pur.invoice_date}</span>
                          </div>
                          <span className="font-mono tabular-nums text-amber-400">₹{pur.balance_due?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No outstanding */}
                {icaOutstanding.total_receivable === 0 && icaOutstanding.total_payable === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                    <p className="font-mono text-[11px] uppercase tracking-wide">No outstanding inter-company balances between these firms</p>
                  </div>
                )}
              </div>
            )}

            {/* Amount & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Adjustment Amount *</Label>
                <Input
                  type="number"
                  value={icaForm.amount}
                  onChange={(e) => setIcaForm({ ...icaForm, amount: e.target.value })}
                  placeholder="Enter amount to adjust"
                  className="mt-1"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label>Adjustment Date *</Label>
                <Input
                  type="date"
                  value={icaForm.adjustment_date}
                  onChange={(e) => setIcaForm({ ...icaForm, adjustment_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes</Label>
              <Textarea
                value={icaForm.notes}
                onChange={(e) => setIcaForm({ ...icaForm, notes: e.target.value })}
                placeholder="Reason for adjustment..."
                className="mt-1"
                rows={2}
              />
            </div>

            {/* What will happen */}
            {icaForm.amount && parseFloat(icaForm.amount) > 0 && icaForm.from_firm_id && icaForm.to_firm_id && (
              <div className="p-3 bg-muted/40 border border-border rounded-lg">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">This adjustment will create:</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    Payment Received (₹{parseFloat(icaForm.amount).toLocaleString()}) in {firms.find(f => f.id === icaForm.from_firm_id)?.name}'s books
                  </li>
                  <li className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    Payment Made (₹{parseFloat(icaForm.amount).toLocaleString()}) in {firms.find(f => f.id === icaForm.to_firm_id)?.name}'s books
                  </li>
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIcaOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleIcaCreate}
              disabled={actionLoading || !icaForm.from_firm_id || !icaForm.to_firm_id || !icaForm.amount}
              className="bg-violet-400/80 hover:bg-violet-400 text-white font-mono text-[11px] uppercase tracking-wide"
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

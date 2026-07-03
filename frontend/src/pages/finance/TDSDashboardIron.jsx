import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calculator, IndianRupee, Download, CheckCircle2, Clock,
  RefreshCw, Loader2, AlertTriangle, Receipt, Search, Plus
} from 'lucide-react';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnGreen = { border: 'none', background: T.green, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

export default function TDSDashboard() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  // Data states
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [sections, setSections] = useState([]);
  const [parties, setParties] = useState([]);
  const [firms, setFirms] = useState([]);

  // Filter states
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedFirm, setSelectedFirm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [financialYear, setFinancialYear] = useState('');

  // Dialog states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    challan_number: '',
    challan_date: '',
    payment_date: '',
    remarks: ''
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Expense dialog
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    party_id: '',
    expense_type: 'contractor',
    description: '',
    gross_amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    firm_id: '',
    invoice_number: '',
    invoice_date: '',
    rent_type: '',
    notes: '',
    apply_tds: true
  });
  const [tdsPreview, setTdsPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, entriesRes, sectionsRes, partiesRes, firmsRes] = await Promise.all([
        axios.get(`${API}/tds/summary`, { headers }),
        axios.get(`${API}/tds/entries`, { headers, params: { status: activeTab === 'pending' ? 'pending' : 'paid', limit: 500 } }),
        axios.get(`${API}/tds/sections`, { headers }),
        axios.get(`${API}/parties`, { headers }),
        axios.get(`${API}/firms`, { headers })
      ]);

      setSummary(summaryRes.data);
      setEntries(entriesRes.data);
      setSections(sectionsRes.data);
      setParties(partiesRes.data);
      setFirms(firmsRes.data);
      setFinancialYear(summaryRes.data.financial_year);
    } catch (error) {
      console.error('Error fetching TDS data:', error);
      toast.error('Failed to load TDS data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Refetch entries when tab changes
    const fetchEntries = async () => {
      try {
        const params = {
          status: activeTab === 'pending' ? 'pending' : 'paid',
          limit: 500
        };
        if (selectedQuarter) params.quarter = selectedQuarter;
        if (selectedSection) params.tds_section = selectedSection;
        if (selectedFirm) params.firm_id = selectedFirm;

        const res = await axios.get(`${API}/tds/entries`, { headers, params });
        setEntries(res.data);
      } catch (error) {
        console.error('Error fetching entries:', error);
      }
    };

    if (!loading) {
      fetchEntries();
    }
  }, [activeTab, selectedQuarter, selectedSection, selectedFirm]);

  const filteredEntries = entries.filter(entry => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        entry.party_name?.toLowerCase().includes(query) ||
        entry.entry_number?.toLowerCase().includes(query) ||
        entry.reference_number?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleSelectEntry = (entryId) => {
    setSelectedEntries(prev =>
      prev.includes(entryId)
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEntries.length === filteredEntries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(filteredEntries.map(e => e.id));
    }
  };

  const handleMarkPaid = async () => {
    if (!paymentForm.challan_number || !paymentForm.challan_date) {
      toast.error('Please enter challan number and date');
      return;
    }

    setActionLoading(true);
    try {
      if (selectedEntries.length === 1) {
        await axios.put(
          `${API}/tds/entries/${selectedEntries[0]}/mark-paid`,
          paymentForm,
          { headers }
        );
      } else {
        await axios.put(
          `${API}/tds/entries/bulk-mark-paid`,
          paymentForm,
          { headers, params: { entry_ids: selectedEntries } }
        );
      }

      toast.success(`${selectedEntries.length} TDS entries marked as paid`);
      setPaymentDialogOpen(false);
      setSelectedEntries([]);
      setPaymentForm({ challan_number: '', challan_date: '', payment_date: '', remarks: '' });
      fetchData();
    } catch (error) {
      console.error('Error marking TDS paid:', error);
      toast.error(error.response?.data?.detail || 'Failed to mark TDS as paid');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreviewTDS = async () => {
    if (!expenseForm.party_id || !expenseForm.gross_amount) {
      setTdsPreview(null);
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await axios.post(`${API}/tds/calculate`, null, {
        headers,
        params: {
          party_id: expenseForm.party_id,
          gross_amount: parseFloat(expenseForm.gross_amount),
          expense_type: expenseForm.expense_type,
          rent_type: expenseForm.rent_type || undefined
        }
      });
      setTdsPreview(res.data);
    } catch (error) {
      console.error('Error calculating TDS:', error);
      setTdsPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (expenseDialogOpen && expenseForm.party_id && expenseForm.gross_amount) {
      const timer = setTimeout(handlePreviewTDS, 500);
      return () => clearTimeout(timer);
    }
  }, [expenseForm.party_id, expenseForm.gross_amount, expenseForm.expense_type, expenseForm.rent_type]);

  const handleCreateExpense = async () => {
    if (!expenseForm.party_id || !expenseForm.gross_amount || !expenseForm.description) {
      toast.error('Please fill required fields');
      return;
    }

    setActionLoading(true);
    try {
      const res = await axios.post(`${API}/expenses`, {
        ...expenseForm,
        gross_amount: parseFloat(expenseForm.gross_amount)
      }, { headers });

      toast.success(`Expense ${res.data.expense.expense_number} created`);
      setExpenseDialogOpen(false);
      setExpenseForm({
        party_id: '',
        expense_type: 'contractor',
        description: '',
        gross_amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        firm_id: '',
        invoice_number: '',
        invoice_date: '',
        rent_type: '',
        notes: '',
        apply_tds: true
      });
      setTdsPreview(null);
      fetchData();
    } catch (error) {
      console.error('Error creating expense:', error);
      toast.error(error.response?.data?.detail || 'Failed to create expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const params = { format, financial_year: financialYear };
      if (selectedQuarter) params.quarter = selectedQuarter;
      if (activeTab !== 'all') params.status = activeTab;
      if (selectedFirm) params.firm_id = selectedFirm;

      const res = await axios.get(`${API}/tds/export`, {
        headers,
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TDS_${financialYear}_${selectedQuarter || 'All'}.${format === 'excel' ? 'xlsx' : 'csv'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export downloaded');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Failed to export TDS data');
    }
  };

  // Calculate totals
  const pendingTotal = summary?.totals?.pending?.total_tds || 0;
  const paidTotal = summary?.totals?.paid?.total_tds || 0;
  const selectedTotal = filteredEntries
    .filter(e => selectedEntries.includes(e.id))
    .reduce((sum, e) => sum + (e.tds_amount || 0), 0);

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => handleExport('csv')} style={btnOutline}>
        <Download size={14} /> CSV
      </button>
      <button onClick={() => handleExport('excel')} style={btnOutline}>
        <Download size={14} /> Excel
      </button>
      <button onClick={() => setExpenseDialogOpen(true)} style={btnPrimary}>
        <Plus size={14} /> New Expense
      </button>
    </div>
  );

  const kpi = (label, value, sub, color, Icon, iconBg) => (
    <IronCard pad={14}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <Caps size={9} color={T.iron400}>{label}</Caps>
          <div style={{ ...mono, fontSize: 24, fontWeight: 800, color, marginTop: 6 }}>{value}</div>
          <div style={{ fontSize: 11, color: T.iron400, marginTop: 3 }}>{sub}</div>
        </div>
        <div style={{ height: 40, width: 40, flexShrink: 0, borderRadius: 6, display: 'grid', placeItems: 'center', background: iconBg, color }}>
          <Icon size={18} />
        </div>
      </div>
    </IronCard>
  );

  if (loading) {
    return (
      <IronShell title="TDS Management" subtitle="FINANCE / TDS" onRefresh={fetchData} headerRight={headerRight}>
        <div style={{ display: 'grid', placeItems: 'center', height: 384 }}>
          <Loader2 className="animate-spin" size={30} color={T.orange} />
        </div>
      </IronShell>
    );
  }

  const colSpan = activeTab === 'pending' ? 9 : 10;

  return (
    <IronShell title="TDS Management" subtitle="FINANCE / TDS" onRefresh={fetchData} headerRight={headerRight}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Summary KPI tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          {kpi('Pending TDS', formatCurrency(pendingTotal), `${summary?.totals?.pending?.count || 0} entries`, T.voltageText, Clock, T.voltageTint)}
          {kpi('Paid TDS', formatCurrency(paidTotal), `${summary?.totals?.paid?.count || 0} entries`, T.green, CheckCircle2, T.greenTint)}
          {kpi('Total TDS (FY)', formatCurrency(pendingTotal + paidTotal), `FY ${financialYear}`, T.iron900, IndianRupee, T.iron100)}
          {kpi('Active Sections', String(sections.filter(s => s.is_active).length), `${sections.length} total`, '#6D4AB0', Calculator, '#EEE9F7')}
        </div>

        {/* Section-wise Summary */}
        <IronCard pad={14}>
          <Caps size={10} color={T.iron700}>Section-wise Summary</Caps>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
            {(summary?.section_summary || []).filter(s => s._id?.section).slice(0, 5).map((sec, idx) => (
              <div key={idx} style={{ borderRadius: 8, border: `1px solid ${T.iron200}`, background: T.iron50, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={badgeStyle('bad')}>{sec._id?.section}</span>
                  <span style={badgeStyle(sec._id?.status === 'pending' ? 'warn' : 'ok')}>{sec._id?.status}</span>
                </div>
                <div style={{ ...mono, fontSize: 18, fontWeight: 800, color: T.iron900 }}>{formatCurrency(sec.total_tds)}</div>
                <div style={{ ...mono, fontSize: 11, color: T.iron400 }}>{sec.count} transactions</div>
              </div>
            ))}
          </div>
        </IronCard>

        {/* Entries Table */}
        <IronCard pad={0}>
          {/* Header + filters */}
          <div style={{ padding: 14, borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <Caps size={10} color={T.iron700}>TDS Entries</Caps>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Select value={selectedQuarter || 'all'} onValueChange={(val) => setSelectedQuarter(val === 'all' ? '' : val)}>
                <SelectTrigger className="w-28"><SelectValue placeholder="Quarter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quarters</SelectItem>
                  {QUARTERS.map(q => (<SelectItem key={q} value={q}>{q}</SelectItem>))}
                </SelectContent>
              </Select>

              <Select value={selectedSection || 'all'} onValueChange={(val) => setSelectedSection(val === 'all' ? '' : val)}>
                <SelectTrigger className="w-28"><SelectValue placeholder="Section" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map(s => (<SelectItem key={s.id} value={s.section}>{s.section}</SelectItem>))}
                </SelectContent>
              </Select>

              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.iron400 }} />
                <input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 30, width: 200 }}
                />
              </div>
            </div>
          </div>

          {/* Tabs + bulk action */}
          <div style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'inline-flex', border: `1px solid ${T.iron200}`, borderRadius: 8, overflow: 'hidden' }}>
              {[['pending', `Pending (${summary?.totals?.pending?.count || 0})`], ['paid', `Paid (${summary?.totals?.paid?.count || 0})`]].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setActiveTab(val)}
                  style={{
                    border: 'none', cursor: 'pointer', padding: '7px 16px',
                    fontFamily: T.headline, fontWeight: 700, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase',
                    background: activeTab === val ? T.orange : T.white,
                    color: activeTab === val ? '#fff' : T.iron700
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === 'pending' && selectedEntries.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ ...mono, fontSize: 11, color: T.iron500 }}>
                  {selectedEntries.length} selected &bull; {formatCurrency(selectedTotal)}
                </span>
                <button onClick={() => setPaymentDialogOpen(true)} style={btnGreen}>
                  <CheckCircle2 size={14} /> Mark as Paid
                </button>
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {activeTab === 'pending' && (
                    <th style={{ ...thCell, width: 34 }}>
                      <Checkbox
                        checked={selectedEntries.length === filteredEntries.length && filteredEntries.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                  )}
                  <th style={thCell}><Caps size={8.5}>Entry #</Caps></th>
                  <th style={thCell}><Caps size={8.5}>Date</Caps></th>
                  <th style={thCell}><Caps size={8.5}>Party</Caps></th>
                  <th style={thCell}><Caps size={8.5}>Section</Caps></th>
                  <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Gross</Caps></th>
                  <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>TDS %</Caps></th>
                  <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>TDS Amount</Caps></th>
                  <th style={thCell}><Caps size={8.5}>Quarter</Caps></th>
                  {activeTab === 'paid' && (<th style={thCell}><Caps size={8.5}>Challan</Caps></th>)}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} style={{ textAlign: 'center', padding: '32px 12px' }}>
                      <Caps size={10} color={T.iron400}>No TDS entries found</Caps>
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      {activeTab === 'pending' && (
                        <td style={tdCell}>
                          <Checkbox
                            checked={selectedEntries.includes(entry.id)}
                            onCheckedChange={() => handleSelectEntry(entry.id)}
                          />
                        </td>
                      )}
                      <td style={{ ...tdCell, ...mono, color: T.orangeDeep, fontWeight: 700 }}>{entry.entry_number}</td>
                      <td style={{ ...tdCell, ...mono, color: T.iron500 }}>{new Date(entry.date).toLocaleDateString()}</td>
                      <td style={tdCell}>
                        <div style={{ fontWeight: 600, color: T.iron900 }}>{entry.party_name}</div>
                        {entry.party_pan && (<div style={{ ...mono, fontSize: 11, color: T.iron400 }}>{entry.party_pan}</div>)}
                      </td>
                      <td style={tdCell}><span style={badgeStyle('bad')}>{entry.tds_section}</span></td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900 }}>{formatCurrency(entry.gross_amount)}</td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron500 }}>{entry.tds_rate}%</td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.voltageText }}>{formatCurrency(entry.tds_amount)}</td>
                      <td style={tdCell}><span style={badgeStyle('slate')}>{entry.quarter}</span></td>
                      {activeTab === 'paid' && (
                        <td style={{ ...tdCell, ...mono, color: T.iron500 }}>
                          <div>{entry.challan_number}</div>
                          <div style={{ fontSize: 11, color: T.iron400 }}>
                            {entry.challan_date && new Date(entry.challan_date).toLocaleDateString()}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </IronCard>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" style={{ color: T.green }} />
              Mark TDS as Paid
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div style={{ borderRadius: 8, border: `1px solid ${T.iron200}`, background: T.iron50, padding: 16 }}>
              <Caps size={9} color={T.iron400}>Selected Entries</Caps>
              <div style={{ ...mono, fontSize: 20, fontWeight: 800, color: T.iron900, marginTop: 4 }}>{selectedEntries.length} entries</div>
              <div style={{ ...mono, fontSize: 16, color: T.voltageText }}>{formatCurrency(selectedTotal)}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Challan Number *</Label>
                <Input
                  value={paymentForm.challan_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, challan_number: e.target.value })}
                  placeholder="Enter challan number"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Challan Date *</Label>
                <Input
                  type="date"
                  value={paymentForm.challan_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, challan_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentForm.payment_date}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Remarks</Label>
              <Textarea
                value={paymentForm.remarks}
                onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                placeholder="Optional remarks"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={actionLoading} style={btnGreen}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Expense Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" style={{ color: T.orange }} />
              Create Expense Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Party / Vendor *</Label>
                <Select
                  value={expenseForm.party_id}
                  onValueChange={(val) => setExpenseForm({ ...expenseForm, party_id: val })}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select party" /></SelectTrigger>
                  <SelectContent>
                    {parties.filter(p => p.party_types?.includes('supplier')).map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.tds_applicable && (<span style={badgeStyle('warn')}>TDS</span>)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Expense Type *</Label>
                <Select
                  value={expenseForm.expense_type}
                  onValueChange={(val) => setExpenseForm({ ...expenseForm, expense_type: val })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contractor">Contractor Payment</SelectItem>
                    <SelectItem value="job_work">Job Work</SelectItem>
                    <SelectItem value="professional_fees">Professional Fees</SelectItem>
                    <SelectItem value="legal_fees">Legal Fees</SelectItem>
                    <SelectItem value="consultancy">Consultancy</SelectItem>
                    <SelectItem value="technical_services">Technical Services</SelectItem>
                    <SelectItem value="commission">Commission</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                    <SelectItem value="interest">Interest</SelectItem>
                    <SelectItem value="transport">Transport</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {expenseForm.expense_type === 'rent' && (
              <div>
                <Label>Rent Type</Label>
                <Select
                  value={expenseForm.rent_type}
                  onValueChange={(val) => setExpenseForm({ ...expenseForm, rent_type: val })}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select rent type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="land_building">Land / Building (10%)</SelectItem>
                    <SelectItem value="plant_machinery">Plant / Machinery (2%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Description *</Label>
              <Input
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="e.g., 50 Laptops @ ₹10,000 each"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Gross Amount *</Label>
                <Input
                  type="number"
                  value={expenseForm.gross_amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, gross_amount: e.target.value })}
                  placeholder="Enter amount"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Expense Date *</Label>
                <Input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice Number</Label>
                <Input
                  value={expenseForm.invoice_number}
                  onChange={(e) => setExpenseForm({ ...expenseForm, invoice_number: e.target.value })}
                  placeholder="Vendor invoice no"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Firm</Label>
                <Select
                  value={expenseForm.firm_id}
                  onValueChange={(val) => setExpenseForm({ ...expenseForm, firm_id: val })}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select firm" /></SelectTrigger>
                  <SelectContent>
                    {firms.map(f => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="apply_tds"
                checked={expenseForm.apply_tds}
                onCheckedChange={(checked) => setExpenseForm({ ...expenseForm, apply_tds: checked })}
              />
              <Label htmlFor="apply_tds" className="cursor-pointer">Apply TDS (if applicable)</Label>
            </div>

            {/* TDS Preview */}
            {expenseForm.apply_tds && tdsPreview && (
              <div style={{ borderRadius: 8, padding: 16, border: `1px solid ${tdsPreview.tds_applicable ? '#EDDFA6' : T.iron200}`, background: tdsPreview.tds_applicable ? T.voltageTint : T.iron50 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Calculator className="w-5 h-5" style={{ color: T.voltageText }} />
                  <Caps size={9} color={T.iron700}>TDS Calculation</Caps>
                  {previewLoading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: T.orange }} />}
                </div>

                {tdsPreview.tds_applicable ? (
                  <div className="space-y-2">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Caps size={9} color={T.iron400}>Section:</Caps>
                      <span style={badgeStyle('bad')}>{tdsPreview.tds_section}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Caps size={9} color={T.iron400}>Party Type:</Caps>
                      <span style={{ ...mono, fontSize: 13, color: T.iron900, textTransform: 'capitalize' }}>{tdsPreview.party_type}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Caps size={9} color={T.iron400}>PAN Available:</Caps>
                      <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: tdsPreview.has_pan ? T.green : T.orangeDeep }}>
                        {tdsPreview.has_pan ? 'Yes' : 'No (Higher Rate)'}
                      </span>
                    </div>
                    <div style={{ borderTop: `1px solid ${T.iron200}`, margin: '8px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Caps size={9} color={T.iron400}>Gross Amount:</Caps>
                      <span style={{ ...mono, color: T.iron900 }}>{formatCurrency(parseFloat(expenseForm.gross_amount))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Caps size={9} color={T.iron400}>TDS @ {tdsPreview.tds_rate}%:</Caps>
                      <span style={{ ...mono, fontWeight: 800, color: T.voltageText }}>- {formatCurrency(tdsPreview.tds_amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <Caps size={9} color={T.iron700}>Net Payable:</Caps>
                      <span style={{ ...mono, fontSize: 15, fontWeight: 800, color: T.green }}>{formatCurrency(tdsPreview.net_payable)}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...mono, fontSize: 13, color: T.iron500 }}>
                    <AlertTriangle className="w-4 h-4" style={{ color: T.voltageText, flexShrink: 0 }} />
                    {tdsPreview.reason}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                placeholder="Optional notes"
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setExpenseDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateExpense} disabled={actionLoading} style={btnPrimary}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

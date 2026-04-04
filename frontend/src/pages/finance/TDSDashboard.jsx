import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calculator, IndianRupee, FileText, Download, CheckCircle2, Clock,
  Building2, User, Calendar, Filter, RefreshCw, Loader2, AlertTriangle,
  Receipt, ChevronRight, Search, Plus
} from 'lucide-react';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">TDS Management</h1>
            <p className="text-slate-400">Track and manage Tax Deducted at Source</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              className="text-slate-300 border-slate-600"
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('excel')}
              className="text-slate-300 border-slate-600"
            >
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button
              onClick={() => setExpenseDialogOpen(true)}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Expense
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Pending TDS</p>
                  <p className="text-2xl font-bold text-orange-400">{formatCurrency(pendingTotal)}</p>
                  <p className="text-xs text-slate-500">{summary?.totals?.pending?.count || 0} entries</p>
                </div>
                <Clock className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Paid TDS</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(paidTotal)}</p>
                  <p className="text-xs text-slate-500">{summary?.totals?.paid?.count || 0} entries</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total TDS (FY)</p>
                  <p className="text-2xl font-bold text-cyan-400">{formatCurrency(pendingTotal + paidTotal)}</p>
                  <p className="text-xs text-slate-500">FY {financialYear}</p>
                </div>
                <IndianRupee className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Active Sections</p>
                  <p className="text-2xl font-bold text-purple-400">{sections.filter(s => s.is_active).length}</p>
                  <p className="text-xs text-slate-500">{sections.length} total</p>
                </div>
                <Calculator className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section-wise Summary */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Section-wise Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {summary?.section_summary?.filter(s => s._id?.section).slice(0, 5).map((sec, idx) => (
                <div key={idx} className="bg-slate-900 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-cyan-400 border-cyan-400">
                      {sec._id?.section}
                    </Badge>
                    <Badge className={sec._id?.status === 'pending' ? 'bg-orange-600' : 'bg-green-600'}>
                      {sec._id?.status}
                    </Badge>
                  </div>
                  <p className="text-xl font-bold text-white">{formatCurrency(sec.total_tds)}</p>
                  <p className="text-xs text-slate-400">{sec.count} transactions</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Entries Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">TDS Entries</CardTitle>
              <div className="flex items-center gap-3">
                {/* Filters */}
                <Select value={selectedQuarter || 'all'} onValueChange={(val) => setSelectedQuarter(val === 'all' ? '' : val)}>
                  <SelectTrigger className="w-28 bg-slate-900 border-slate-600 text-white">
                    <SelectValue placeholder="Quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Quarters</SelectItem>
                    {QUARTERS.map(q => (
                      <SelectItem key={q} value={q}>{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedSection || 'all'} onValueChange={(val) => setSelectedSection(val === 'all' ? '' : val)}>
                  <SelectTrigger className="w-28 bg-slate-900 border-slate-600 text-white">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {sections.map(s => (
                      <SelectItem key={s.id} value={s.section}>{s.section}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-48 bg-slate-900 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-slate-900">
                  <TabsTrigger value="pending" className="data-[state=active]:bg-orange-600">
                    Pending ({summary?.totals?.pending?.count || 0})
                  </TabsTrigger>
                  <TabsTrigger value="paid" className="data-[state=active]:bg-green-600">
                    Paid ({summary?.totals?.paid?.count || 0})
                  </TabsTrigger>
                </TabsList>

                {activeTab === 'pending' && selectedEntries.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400">
                      {selectedEntries.length} selected • {formatCurrency(selectedTotal)}
                    </span>
                    <Button
                      onClick={() => setPaymentDialogOpen(true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Mark as Paid
                    </Button>
                  </div>
                )}
              </div>

              <TabsContent value={activeTab} className="mt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        {activeTab === 'pending' && (
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectedEntries.length === filteredEntries.length && filteredEntries.length > 0}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                        )}
                        <TableHead className="text-slate-300">Entry #</TableHead>
                        <TableHead className="text-slate-300">Date</TableHead>
                        <TableHead className="text-slate-300">Party</TableHead>
                        <TableHead className="text-slate-300">Section</TableHead>
                        <TableHead className="text-slate-300 text-right">Gross</TableHead>
                        <TableHead className="text-slate-300 text-right">TDS %</TableHead>
                        <TableHead className="text-slate-300 text-right">TDS Amount</TableHead>
                        <TableHead className="text-slate-300">Quarter</TableHead>
                        {activeTab === 'paid' && (
                          <TableHead className="text-slate-300">Challan</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={activeTab === 'pending' ? 9 : 10} className="text-center py-8 text-slate-400">
                            No TDS entries found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEntries.map((entry) => (
                          <TableRow key={entry.id} className="border-slate-700 hover:bg-slate-700/50">
                            {activeTab === 'pending' && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedEntries.includes(entry.id)}
                                  onCheckedChange={() => handleSelectEntry(entry.id)}
                                />
                              </TableCell>
                            )}
                            <TableCell className="text-cyan-400 font-mono text-sm">{entry.entry_number}</TableCell>
                            <TableCell className="text-slate-300">{new Date(entry.date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-white">
                              <div>{entry.party_name}</div>
                              {entry.party_pan && (
                                <div className="text-xs text-slate-400">{entry.party_pan}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-cyan-400 border-cyan-400">
                                {entry.tds_section}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-white">{formatCurrency(entry.gross_amount)}</TableCell>
                            <TableCell className="text-right text-slate-300">{entry.tds_rate}%</TableCell>
                            <TableCell className="text-right font-semibold text-orange-400">
                              {formatCurrency(entry.tds_amount)}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-slate-700">{entry.quarter}</Badge>
                            </TableCell>
                            {activeTab === 'paid' && (
                              <TableCell className="text-slate-300 text-sm">
                                <div>{entry.challan_number}</div>
                                <div className="text-xs text-slate-500">
                                  {entry.challan_date && new Date(entry.challan_date).toLocaleDateString()}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Mark TDS as Paid
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-slate-900 rounded-lg p-4">
                <p className="text-sm text-slate-400">Selected Entries</p>
                <p className="text-xl font-bold text-white">{selectedEntries.length} entries</p>
                <p className="text-lg text-orange-400">{formatCurrency(selectedTotal)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Challan Number *</Label>
                  <Input
                    value={paymentForm.challan_number}
                    onChange={(e) => setPaymentForm({ ...paymentForm, challan_number: e.target.value })}
                    placeholder="Enter challan number"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Challan Date *</Label>
                  <Input
                    type="date"
                    value={paymentForm.challan_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, challan_date: e.target.value })}
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-slate-300">Payment Date</Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                />
              </div>

              <div>
                <Label className="text-slate-300">Remarks</Label>
                <Textarea
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                  placeholder="Optional remarks"
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setPaymentDialogOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={handleMarkPaid}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Expense Dialog */}
        <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-cyan-500" />
                Create Expense Entry
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Party / Vendor *</Label>
                  <Select 
                    value={expenseForm.party_id} 
                    onValueChange={(val) => setExpenseForm({ ...expenseForm, party_id: val })}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select party" />
                    </SelectTrigger>
                    <SelectContent>
                      {parties.filter(p => p.party_types?.includes('supplier')).map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <div>
                            <span>{p.name}</span>
                            {p.tds_applicable && (
                              <Badge className="ml-2 bg-orange-600 text-xs">TDS</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-300">Expense Type *</Label>
                  <Select 
                    value={expenseForm.expense_type} 
                    onValueChange={(val) => setExpenseForm({ ...expenseForm, expense_type: val })}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
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
                  <Label className="text-slate-300">Rent Type</Label>
                  <Select 
                    value={expenseForm.rent_type} 
                    onValueChange={(val) => setExpenseForm({ ...expenseForm, rent_type: val })}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select rent type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="land_building">Land / Building (10%)</SelectItem>
                      <SelectItem value="plant_machinery">Plant / Machinery (2%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label className="text-slate-300">Description *</Label>
                <Input
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="e.g., 50 Laptops @ ₹10,000 each"
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Gross Amount *</Label>
                  <Input
                    type="number"
                    value={expenseForm.gross_amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, gross_amount: e.target.value })}
                    placeholder="Enter amount"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Expense Date *</Label>
                  <Input
                    type="date"
                    value={expenseForm.expense_date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Invoice Number</Label>
                  <Input
                    value={expenseForm.invoice_number}
                    onChange={(e) => setExpenseForm({ ...expenseForm, invoice_number: e.target.value })}
                    placeholder="Vendor invoice no"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Firm</Label>
                  <Select 
                    value={expenseForm.firm_id} 
                    onValueChange={(val) => setExpenseForm({ ...expenseForm, firm_id: val })}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select firm" />
                    </SelectTrigger>
                    <SelectContent>
                      {firms.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
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
                <Label htmlFor="apply_tds" className="text-slate-300 cursor-pointer">
                  Apply TDS (if applicable)
                </Label>
              </div>

              {/* TDS Preview */}
              {expenseForm.apply_tds && tdsPreview && (
                <div className={`rounded-lg p-4 ${tdsPreview.tds_applicable ? 'bg-orange-900/30 border border-orange-600' : 'bg-slate-900'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="w-5 h-5 text-orange-400" />
                    <span className="font-semibold text-white">TDS Calculation</span>
                    {previewLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  </div>
                  
                  {tdsPreview.tds_applicable ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Section:</span>
                        <Badge className="bg-cyan-600">{tdsPreview.tds_section}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Party Type:</span>
                        <span className="text-white capitalize">{tdsPreview.party_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">PAN Available:</span>
                        <span className={tdsPreview.has_pan ? 'text-green-400' : 'text-red-400'}>
                          {tdsPreview.has_pan ? 'Yes' : 'No (Higher Rate)'}
                        </span>
                      </div>
                      <div className="border-t border-slate-600 my-2"></div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Gross Amount:</span>
                        <span className="text-white">{formatCurrency(parseFloat(expenseForm.gross_amount))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">TDS @ {tdsPreview.tds_rate}%:</span>
                        <span className="text-orange-400 font-bold">- {formatCurrency(tdsPreview.tds_amount)}</span>
                      </div>
                      <div className="flex justify-between text-lg">
                        <span className="text-white font-semibold">Net Payable:</span>
                        <span className="text-green-400 font-bold">{formatCurrency(tdsPreview.net_payable)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400">
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      {tdsPreview.reason}
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label className="text-slate-300">Notes</Label>
                <Textarea
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  placeholder="Optional notes"
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setExpenseDialogOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={handleCreateExpense}
                disabled={actionLoading}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Expense
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

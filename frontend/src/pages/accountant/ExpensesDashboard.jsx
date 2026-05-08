import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  DollarSign, Loader2, Search, Calendar, FileText, Download,
  TrendingDown, CreditCard, Megaphone, Building2, Eye, Users
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const EXPENSE_CATEGORIES = {
  'selling_expenses': { label: 'Platform/Commission Fees', color: 'bg-orange-500/20 text-orange-400', icon: Building2 },
  'marketing_expenses': { label: 'Advertising/Ads', color: 'bg-purple-500/20 text-purple-400', icon: Megaphone },
  'operating_expenses': { label: 'Operating Expenses', color: 'bg-blue-500/20 text-blue-400', icon: TrendingDown },
  'salary': { label: 'Salary Payments', color: 'bg-cyan-500/20 text-cyan-400', icon: Users },
  'other': { label: 'Other', color: 'bg-slate-500/20 text-slate-400', icon: FileText }
};

export default function ExpensesDashboard() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('expenses');
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [stats, setStats] = useState({
    totalExpenses: 0,
    platformFees: 0,
    adSpend: 0,
    salaryExpenses: 0,
    totalTCS: 0,
    totalTDS: 0
  });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchFirms();
  }, []);

  const fetchFirms = async () => {
    try {
      const res = await axios.get(`${API}/firms`, { headers });
      setFirms(res.data || []);
    } catch (error) {
      console.error('Failed to fetch firms:', error);
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = selectedFirm !== 'all' ? { firm_id: selectedFirm } : {};
      
      // Fetch regular expenses
      const res = await axios.get(`${API}/expenses`, { headers, params });
      const regularExpenses = Array.isArray(res.data) ? res.data : (res.data.expenses || []);
      
      // Also fetch salary/payroll expenses from admin/expenses (expense_ledger)
      let salaryExpenses = [];
      try {
        const salaryRes = await axios.get(`${API}/admin/expenses`, { headers, params: { ...params, category: 'salary' } });
        salaryExpenses = salaryRes.data?.expenses || [];
        // Mark these as salary type for display
        salaryExpenses = salaryExpenses.map(e => ({ ...e, source: 'payroll' }));
      } catch (err) {
        console.log('Could not fetch salary expenses:', err);
      }
      
      // Combine both lists
      const allExpenses = [...regularExpenses, ...salaryExpenses];
      setExpenses(allExpenses);
      
      // Calculate stats - use gross_amount from manual expenses, amount from marketplace expenses
      const getExpenseAmount = (e) => e.gross_amount || e.amount || 0;
      const platformFees = allExpenses.filter(e => e.category === 'selling_expenses').reduce((sum, e) => sum + getExpenseAmount(e), 0);
      const adSpend = allExpenses.filter(e => e.category === 'marketing_expenses').reduce((sum, e) => sum + getExpenseAmount(e), 0);
      const salaryTotal = allExpenses.filter(e => e.category === 'salary').reduce((sum, e) => sum + getExpenseAmount(e), 0);
      
      setStats(prev => ({
        ...prev,
        totalExpenses: allExpenses.reduce((sum, e) => sum + getExpenseAmount(e), 0),
        platformFees,
        adSpend,
        salaryExpenses: salaryTotal
      }));
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchJournalEntries = async () => {
    try {
      const params = selectedFirm !== 'all' ? { firm_id: selectedFirm } : {};
      const res = await axios.get(`${API}/journal-entries`, { headers, params });
      const entries = Array.isArray(res.data) ? res.data : (res.data.entries || []);
      setJournalEntries(entries);
      
      // Calculate TCS/TDS totals
      const tcsTotal = entries.filter(e => e.description?.includes('TCS')).reduce((sum, e) => sum + (e.amount || 0), 0);
      const tdsTotal = entries.filter(e => e.description?.includes('TDS')).reduce((sum, e) => sum + (e.amount || 0), 0);
      
      setStats(prev => ({
        ...prev,
        totalTCS: tcsTotal,
        totalTDS: tdsTotal
      }));
    } catch (error) {
      console.error('Failed to fetch journal entries:', error);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchJournalEntries();
  }, [selectedFirm]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const filteredExpenses = expenses.filter(e => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      e.description?.toLowerCase().includes(search) ||
      e.category?.toLowerCase().includes(search) ||
      e.reference_number?.toLowerCase().includes(search)
    );
  });

  const filteredJournals = journalEntries.filter(j => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      j.description?.toLowerCase().includes(search) ||
      j.journal_number?.toLowerCase().includes(search) ||
      j.reference_number?.toLowerCase().includes(search)
    );
  });

  // Export to CSV
  const handleExportCSV = async () => {
    try {
      let url = `${API}/expenses/export/csv`;
      const params = new URLSearchParams();
      if (selectedFirm !== 'all') params.append('firm_id', selectedFirm);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await axios.get(url, {
        headers,
        responseType: 'blob'
      });
      
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `expenses_report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      toast.success('Export successful');
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Expenses & Tax Credits</h1>
            <p className="text-slate-400">Track marketplace fees, expenses and TCS/TDS credits</p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={handleExportCSV}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              data-testid="export-csv-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Select value={selectedFirm} onValueChange={setSelectedFirm}>
              <SelectTrigger className="w-64 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Select Firm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Firms</SelectItem>
                {firms.map(firm => (
                  <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-400">{formatCurrency(stats.totalExpenses)}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Salary Payments</p>
                  <p className="text-2xl font-bold text-cyan-400">{formatCurrency(stats.salaryExpenses)}</p>
                </div>
                <Users className="w-8 h-8 text-cyan-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Platform Fees</p>
                  <p className="text-2xl font-bold text-orange-400">{formatCurrency(stats.platformFees)}</p>
                </div>
                <Building2 className="w-8 h-8 text-orange-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Ad Spend</p>
                  <p className="text-2xl font-bold text-purple-400">{formatCurrency(stats.adSpend)}</p>
                </div>
                <Megaphone className="w-8 h-8 text-purple-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">TCS Credit</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(stats.totalTCS)}</p>
                </div>
                <CreditCard className="w-8 h-8 text-green-400/30" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">TDS Credit</p>
                  <p className="text-2xl font-bold text-teal-400">{formatCurrency(stats.totalTDS)}</p>
                </div>
                <CreditCard className="w-8 h-8 text-teal-400/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800">
            <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>
            <TabsTrigger value="tax_credits">TCS/TDS Credits ({journalEntries.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="expenses" className="mt-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    No expenses found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">Date</TableHead>
                        <TableHead className="text-slate-400">Description</TableHead>
                        <TableHead className="text-slate-400">Category</TableHead>
                        <TableHead className="text-slate-400">Reference</TableHead>
                        <TableHead className="text-slate-400">Firm</TableHead>
                        <TableHead className="text-slate-400 text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.map((expense) => {
                        const category = EXPENSE_CATEGORIES[expense.category] || EXPENSE_CATEGORIES['other'];
                        const Icon = category.icon;
                        return (
                          <TableRow key={expense.id} className="border-slate-700 hover:bg-slate-700/30">
                            <TableCell className="text-slate-300">
                              {expense.expense_date ? new Date(expense.expense_date).toLocaleDateString('en-IN') : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-slate-400" />
                                <span className="text-white">{expense.description}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={category.color}>
                                {category.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-400">
                              {expense.ecommerce_statement_id ? expense.ecommerce_statement_id.slice(0, 8) : '-'}
                            </TableCell>
                            <TableCell className="text-slate-300">
                              {expense.firm_name || '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-red-400">
                              {formatCurrency(expense.gross_amount || expense.amount)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="tax_credits" className="mt-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-0">
                {journalEntries.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    No TCS/TDS credit entries found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">Journal #</TableHead>
                        <TableHead className="text-slate-400">Date</TableHead>
                        <TableHead className="text-slate-400">Description</TableHead>
                        <TableHead className="text-slate-400">Type</TableHead>
                        <TableHead className="text-slate-400">Party</TableHead>
                        <TableHead className="text-slate-400">Reference</TableHead>
                        <TableHead className="text-slate-400 text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredJournals.map((journal) => {
                        const isTCS = journal.description?.includes('TCS');
                        const isTDS = journal.description?.includes('TDS');
                        return (
                          <TableRow key={journal.id} className="border-slate-700 hover:bg-slate-700/30">
                            <TableCell className="font-mono text-cyan-400">
                              {journal.journal_number}
                            </TableCell>
                            <TableCell className="text-slate-300">
                              {journal.journal_date || '-'}
                            </TableCell>
                            <TableCell className="text-white">
                              {journal.description}
                            </TableCell>
                            <TableCell>
                              <Badge className={isTCS ? 'bg-green-500/20 text-green-400' : 'bg-cyan-500/20 text-cyan-400'}>
                                {isTCS ? 'TCS Credit' : isTDS ? 'TDS Credit' : 'Journal'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-300">
                              {journal.party_name || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-400">
                              {journal.reference_number || '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-400">
                              {formatCurrency(journal.amount)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

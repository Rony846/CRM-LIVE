import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  'selling_expenses':   { label: 'Platform/Commission Fees', tone: 'bg-orange-400/15 text-orange-400 ring-1 ring-orange-400/25', icon: Building2 },
  'marketing_expenses': { label: 'Advertising/Ads',          tone: 'bg-violet-400/15 text-violet-400 ring-1 ring-violet-400/25', icon: Megaphone },
  'operating_expenses': { label: 'Operating Expenses',       tone: 'bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/25',         icon: TrendingDown },
  'salary':             { label: 'Salary Payments',          tone: 'bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/25',         icon: Users },
  'other':              { label: 'Other',                    tone: 'bg-muted text-muted-foreground ring-1 ring-border',          icon: FileText }
};

const CategoryBadge = ({ category }) => {
  const cfg = EXPENSE_CATEGORIES[category] || EXPENSE_CATEGORIES['other'];
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ${cfg.tone}`}>
      {cfg.label}
    </span>
  );
};

const TaxBadge = ({ isTCS, isTDS }) => {
  const tone = isTCS
    ? 'bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25'
    : 'bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/25';
  const label = isTCS ? 'TCS Credit' : isTDS ? 'TDS Credit' : 'Journal';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  );
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

  const statItems = [
    { label: 'Total Expenses',   value: formatCurrency(stats.totalExpenses),   color: 'text-rose-400',    iconColor: 'bg-rose-500/15 text-rose-400',    Icon: TrendingDown },
    { label: 'Salary Payments',  value: formatCurrency(stats.salaryExpenses),  color: 'text-sky-400',     iconColor: 'bg-sky-400/15 text-sky-400',      Icon: Users },
    { label: 'Platform Fees',    value: formatCurrency(stats.platformFees),    color: 'text-orange-400',  iconColor: 'bg-orange-400/15 text-orange-400', Icon: Building2 },
    { label: 'Ad Spend',         value: formatCurrency(stats.adSpend),         color: 'text-violet-400',  iconColor: 'bg-violet-400/15 text-violet-400', Icon: Megaphone },
    { label: 'TCS Credit',       value: formatCurrency(stats.totalTCS),        color: 'text-emerald-500', iconColor: 'bg-emerald-500/15 text-emerald-500', Icon: CreditCard },
    { label: 'TDS Credit',       value: formatCurrency(stats.totalTDS),        color: 'text-teal-400',    iconColor: 'bg-teal-400/15 text-teal-400',    Icon: CreditCard },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Expenses &amp; Tax Credits</h1>
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
              Track marketplace fees, expenses and TCS/TDS credits
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="border-border text-muted-foreground hover:text-foreground"
              data-testid="export-csv-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Select value={selectedFirm} onValueChange={setSelectedFirm}>
              <SelectTrigger className="w-56">
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
          {statItems.map(({ label, value, color, iconColor, Icon }) => (
            <div key={label} className="mg-card rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground truncate">{label}</p>
                  <p className={`font-mono text-lg font-bold tabular-nums mt-1 ${color}`}>{value}</p>
                </div>
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${iconColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted border border-border">
            <TabsTrigger
              value="expenses"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide"
            >
              Expenses ({expenses.length})
            </TabsTrigger>
            <TabsTrigger
              value="tax_credits"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide"
            >
              TCS/TDS Credits ({journalEntries.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="mt-4">
            <Card className="mg-card border border-border bg-card">
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="font-mono text-[11px] uppercase tracking-wide">No expenses found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Date</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Description</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Category</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Reference</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Firm</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.map((expense) => {
                        const category = EXPENSE_CATEGORIES[expense.category] || EXPENSE_CATEGORIES['other'];
                        const Icon = category.icon;
                        return (
                          <TableRow key={expense.id} className="border-border hover:bg-muted/30">
                            <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                              {expense.expense_date ? new Date(expense.expense_date).toLocaleDateString('en-IN') : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-foreground">{expense.description}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <CategoryBadge category={expense.category} />
                            </TableCell>
                            <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                              {expense.ecommerce_statement_id ? expense.ecommerce_statement_id.slice(0, 8) : '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {expense.firm_name || '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums font-medium text-rose-400">
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
            <Card className="mg-card border border-border bg-card">
              <CardContent className="p-0">
                {journalEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="font-mono text-[11px] uppercase tracking-wide">No TCS/TDS credit entries found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Journal #</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Date</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Description</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Type</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Party</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Reference</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredJournals.map((journal) => {
                        const isTCS = journal.description?.includes('TCS');
                        const isTDS = journal.description?.includes('TDS');
                        return (
                          <TableRow key={journal.id} className="border-border hover:bg-muted/30">
                            <TableCell className="font-mono tabular-nums text-sky-400">
                              {journal.journal_number}
                            </TableCell>
                            <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                              {journal.journal_date || '-'}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {journal.description}
                            </TableCell>
                            <TableCell>
                              <TaxBadge isTCS={isTCS} isTDS={isTDS} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {journal.party_name || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                              {journal.reference_number || '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums font-medium text-emerald-500">
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

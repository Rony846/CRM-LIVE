import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  Loader2, Search, Download, TrendingDown, CreditCard,
  Megaphone, Building2, Users, IndianRupee, FileText
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

// Expense category -> label + Iron pill tone + row icon.
const EXPENSE_CATEGORIES = {
  selling_expenses:   { label: 'Platform/Commission Fees', tone: 'bad',    icon: Building2 },
  marketing_expenses: { label: 'Advertising/Ads',          tone: 'violet', icon: Megaphone },
  operating_expenses: { label: 'Operating Expenses',       tone: 'info',   icon: TrendingDown },
  salary:             { label: 'Salary Payments',          tone: 'info',   icon: Users },
  other:              { label: 'Other',                    tone: 'slate',  icon: FileText },
};

const CategoryBadge = ({ category }) => {
  const cfg = EXPENSE_CATEGORIES[category] || EXPENSE_CATEGORIES.other;
  return <span style={badgeStyle(cfg.tone)}>{cfg.label}</span>;
};

const TaxBadge = ({ isTCS, isTDS }) => {
  const tone = isTCS ? 'ok' : 'info';
  const label = isTCS ? 'TCS Credit' : isTDS ? 'TDS Credit' : 'Journal';
  return <span style={badgeStyle(tone)}>{label}</span>;
};

const paymentStatusPill = (raw) => {
  const status = (raw || 'unpaid').toLowerCase();
  const tone = status === 'paid' ? 'ok' : status === 'partial' ? 'warn' : 'bad';
  return { label: status, tone };
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
    totalTDS: 0,
  });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchFirms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        salaryExpenses: salaryTotal,
      }));
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  // Mark an expense paid via the new /expenses/{id}/pay endpoint. Idempotent;
  // backend refuses if already fully paid. Re-fetches on success.
  const handlePay = async (expense) => {
    const net = expense.net_payable || expense.gross_amount || 0;
    const alreadyPaid = expense.paid_amount || 0;
    const outstanding = net - alreadyPaid;
    if (outstanding <= 0) {
      toast.info('Expense is already fully paid.');
      return;
    }
    if (!window.confirm(
      `Record payment for ${expense.expense_number || 'this expense'}?\n\n` +
      `Party: ${expense.party_name || '(unknown)'}\n` +
      `Amount: ₹${outstanding.toLocaleString('en-IN')}  (full outstanding)\n` +
      `Mode: bank transfer\n\n` +
      `This creates a payment row and flips the expense to paid.`
    )) return;
    try {
      const res = await axios.post(
        `${API}/expenses/${expense.id}/pay`,
        { payment_mode: 'bank_transfer' },
        { headers }
      );
      toast.success(`Paid via ${res.data.payment_number} — status: ${res.data.payment_status}`);
      await fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not record payment.');
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
        totalTDS: tdsTotal,
      }));
    } catch (error) {
      console.error('Failed to fetch journal entries:', error);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchJournalEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFirm]);

  const refreshAll = () => {
    fetchExpenses();
    fetchJournalEntries();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
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
        responseType: 'blob',
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
    { label: 'Total Expenses',  value: formatCurrency(stats.totalExpenses),  tone: T.rose,        Icon: TrendingDown },
    { label: 'Salary Payments', value: formatCurrency(stats.salaryExpenses),  tone: T.blue,        Icon: Users },
    { label: 'Platform Fees',   value: formatCurrency(stats.platformFees),    tone: T.orange,      Icon: Building2 },
    { label: 'Ad Spend',        value: formatCurrency(stats.adSpend),         tone: '#6D4AB0',     Icon: Megaphone },
    { label: 'TCS Credit',      value: formatCurrency(stats.totalTCS),        tone: T.green,       Icon: CreditCard },
    { label: 'TDS Credit',      value: formatCurrency(stats.totalTDS),        tone: T.green,       Icon: CreditCard },
  ];

  const tabs = [
    { key: 'expenses', label: 'Expenses', count: expenses.length },
    { key: 'tax_credits', label: 'TCS/TDS Credits', count: journalEntries.length },
  ];

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={handleExportCSV}
        data-testid="export-csv-btn"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}
      >
        <Download size={14} strokeWidth={2} />Export CSV
      </button>
      <select value={selectedFirm} onChange={(e) => setSelectedFirm(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', width: 200 }}>
        <option value="all">All Firms</option>
        {firms.map(firm => (
          <option key={firm.id} value={firm.id}>{firm.name}</option>
        ))}
      </select>
    </div>
  );

  const expenseHeaders = ['Date', 'Description', 'Category', 'Reference', 'Firm', 'Amount', 'Status', 'Actions'];
  const journalHeaders = ['Journal #', 'Date', 'Description', 'Type', 'Party', 'Reference', 'Amount'];

  return (
    <IronShell
      title="Expenses & Tax Credits"
      subtitle="MARKETPLACE FEES · EXPENSES · TCS/TDS CREDITS"
      onRefresh={refreshAll}
      headerRight={headerRight}
    >
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
        {statItems.map(({ label, value, tone, Icon }) => (
          <IronCard key={label} pad={14}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <Caps size={9} color={T.iron400} style={{ display: 'block' }}>{label}</Caps>
                <div style={{ ...mono, fontSize: 15, fontWeight: 700, color: T.iron900, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
              </div>
              <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <Icon size={16} color={tone} strokeWidth={1.9} />
              </div>
            </div>
          </IronCard>
        ))}
      </div>

      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        {/* Tabs + search */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {tabs.map((tb) => {
              const active = activeTab === tb.key;
              return (
                <button key={tb.key} onClick={() => setActiveTab(tb.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                  {tb.label}
                  <span style={{ ...mono, fontSize: 11, opacity: 0.85 }}>({tb.count})</span>
                </button>
              );
            })}
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search expenses…"
              style={{ ...inputStyle, paddingLeft: 30, width: 260 }} />
          </div>
        </div>

        {/* Expenses tab */}
        {activeTab === 'expenses' && (
          loading ? (
            <div style={{ display: 'grid', placeItems: 'center', padding: '60px 0' }}>
              <Loader2 className="animate-spin" size={26} color={T.iron400} />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
              <TrendingDown size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No expenses found</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {expenseHeaders.map((h, i) => (
                    <th key={i} style={{ ...thCell, textAlign: (h === 'Amount' || h === 'Actions') ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr></thead>
                <tbody>{filteredExpenses.map((expense) => {
                  const category = EXPENSE_CATEGORIES[expense.category] || EXPENSE_CATEGORIES.other;
                  const Icon = category.icon;
                  const ps = paymentStatusPill(expense.payment_status);
                  return (
                    <tr key={expense.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron500, whiteSpace: 'nowrap' }}>
                        {expense.expense_date ? new Date(expense.expense_date).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td style={tdCell}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Icon size={14} color={T.iron400} strokeWidth={1.9} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5, color: T.iron900 }}>{expense.description}</span>
                        </div>
                      </td>
                      <td style={tdCell}><CategoryBadge category={expense.category} /></td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>
                        {expense.ecommerce_statement_id ? expense.ecommerce_statement_id.slice(0, 8) : '-'}
                      </td>
                      <td style={{ ...tdCell, fontSize: 12, color: T.iron700 }}>{expense.firm_name || '-'}</td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.rose }}>
                        {formatCurrency(expense.gross_amount || expense.amount)}
                      </td>
                      <td style={tdCell}><span style={badgeStyle(ps.tone)}>{ps.label}</span></td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        {(expense.payment_status || 'unpaid').toLowerCase() !== 'paid' && (
                          <button
                            onClick={() => handlePay(expense)}
                            title="Mark paid (full outstanding via bank transfer)"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.green}`, background: T.white, color: T.green, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}
                          >
                            <IndianRupee size={13} />Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )
        )}

        {/* TCS/TDS Credits tab */}
        {activeTab === 'tax_credits' && (
          journalEntries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
              <CreditCard size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No TCS/TDS credit entries found</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {journalHeaders.map((h, i) => (
                    <th key={i} style={{ ...thCell, textAlign: h === 'Amount' ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr></thead>
                <tbody>{filteredJournals.map((journal) => {
                  const isTCS = journal.description?.includes('TCS');
                  const isTDS = journal.description?.includes('TDS');
                  return (
                    <tr key={journal.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, ...mono, fontSize: 12, fontWeight: 700, color: T.blue }}>{journal.journal_number}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron500, whiteSpace: 'nowrap' }}>{journal.journal_date || '-'}</td>
                      <td style={{ ...tdCell, fontSize: 12.5, color: T.iron900 }}>{journal.description}</td>
                      <td style={tdCell}><TaxBadge isTCS={isTCS} isTDS={isTDS} /></td>
                      <td style={{ ...tdCell, fontSize: 12, color: T.iron700 }}>{journal.party_name || '-'}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{journal.reference_number || '-'}</td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.green }}>{formatCurrency(journal.amount)}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )
        )}
      </IronCard>
    </IronShell>
  );
}

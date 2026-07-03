import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Users, Wallet, TrendingUp, Plus, Loader2,
  CheckCircle, IndianRupee, FileText,
  Download, Edit, AlertTriangle, CreditCard, Gift, MinusCircle, Award, Trash2, Pencil, Undo2
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const iconBtn = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };

export default function AdminPayroll() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salaries, setSalaries] = useState([]);
  const [payroll, setPayroll] = useState({ payroll: [], summary: {} });
  const [firms, setFirms] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('payroll');

  const [showSalaryDialog, setShowSalaryDialog] = useState(false);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState(null);

  // Edit salary state
  const [showEditSalaryDialog, setShowEditSalaryDialog] = useState(false);
  const [editingSalary, setEditingSalary] = useState(null);

  // Incentives state
  const [incentives, setIncentives] = useState([]);
  const [showEditIncentiveDialog, setShowEditIncentiveDialog] = useState(false);
  const [editingIncentive, setEditingIncentive] = useState(null);
  const [showAddIncentiveDialog, setShowAddIncentiveDialog] = useState(false);
  const [incentiveForm, setIncentiveForm] = useState({
    user_id: '',
    amount: '',
    reason: '',
    month: ''
  });

  const [salaryForm, setSalaryForm] = useState({
    user_id: '',
    firm_id: '',
    fixed_salary: '',
    salary_type: 'monthly',
    incentive_eligible: true,
    bank_account: '',
    bank_name: '',
    ifsc_code: '',
    pan_number: ''
  });
  const [adjustmentForm, setAdjustmentForm] = useState({
    adjustment_type: 'bonus',
    amount: '',
    reason: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedMonth, selectedYear, selectedFirm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const incentiveMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

      const [firmsRes, usersRes, salariesRes, payrollRes, incentivesRes] = await Promise.all([
        axios.get(`${API}/firms`, { headers }),
        axios.get(`${API}/admin/users`, { headers }),
        axios.get(`${API}/admin/salaries`, { headers }),
        axios.get(`${API}/admin/payroll`, {
          headers,
          params: {
            month: selectedMonth,
            year: selectedYear,
            firm_id: selectedFirm !== 'all' ? selectedFirm : undefined
          }
        }),
        axios.get(`${API}/admin/incentives`, { headers, params: { month: incentiveMonth } }).catch(() => ({ data: { incentives: [] } }))
      ]);

      setFirms(firmsRes.data || []);
      setUsers(usersRes.data?.filter(u => u.role !== 'customer') || []);
      setSalaries(salariesRes.data || []);
      setPayroll(payrollRes.data || { payroll: [], summary: {} });
      setIncentives(incentivesRes.data?.incentives || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Edit Salary Handler
  const openEditSalaryDialog = (salary) => {
    setEditingSalary(salary);
    setSalaryForm({
      user_id: salary.user_id,
      firm_id: salary.firm_id,
      fixed_salary: salary.fixed_salary?.toString() || '',
      salary_type: salary.salary_type || 'monthly',
      incentive_eligible: salary.incentive_eligible !== false,
      bank_account: salary.bank_account || '',
      bank_name: salary.bank_name || '',
      ifsc_code: salary.ifsc_code || '',
      pan_number: salary.pan_number || '',
      transfer_to_firm: '',  // For firm transfer
      effective_from: ''     // Month from which transfer is effective (YYYY-MM)
    });
    setShowEditSalaryDialog(true);
  };

  const handleUpdateSalary = async () => {
    if (!salaryForm.fixed_salary) {
      toast.error('Please enter fixed salary');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fixed_salary: parseFloat(salaryForm.fixed_salary),
        salary_type: salaryForm.salary_type,
        incentive_eligible: salaryForm.incentive_eligible,
        bank_account: salaryForm.bank_account || null,
        bank_name: salaryForm.bank_name || null,
        ifsc_code: salaryForm.ifsc_code || null,
        pan_number: salaryForm.pan_number || null
      };

      // If transferring to another firm
      if (salaryForm.transfer_to_firm && salaryForm.transfer_to_firm !== editingSalary.firm_id) {
        if (!salaryForm.effective_from) {
          toast.error('Please select effective month for firm transfer');
          setSubmitting(false);
          return;
        }
        payload.transfer_to_firm = salaryForm.transfer_to_firm;
        payload.effective_from = salaryForm.effective_from;
      }

      await axios.patch(`${API}/admin/salaries/${editingSalary.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (salaryForm.transfer_to_firm && salaryForm.transfer_to_firm !== editingSalary.firm_id) {
        toast.success(`Employee transferred to new firm from ${salaryForm.effective_from}`);
      } else {
        toast.success('Salary configuration updated');
      }
      setShowEditSalaryDialog(false);
      setEditingSalary(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update salary');
    } finally {
      setSubmitting(false);
    }
  };

  // Incentive Handlers
  const openAddIncentiveDialog = () => {
    const incentiveMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    setIncentiveForm({ user_id: '', amount: '', reason: '', month: incentiveMonth });
    setShowAddIncentiveDialog(true);
  };

  const handleAddIncentive = async () => {
    if (!incentiveForm.user_id || !incentiveForm.amount || !incentiveForm.reason) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/admin/incentives/manual`, {
        user_id: incentiveForm.user_id,
        amount: parseFloat(incentiveForm.amount),
        reason: incentiveForm.reason,
        month: incentiveForm.month
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Manual incentive added');
      setShowAddIncentiveDialog(false);
      setIncentiveForm({ user_id: '', amount: '', reason: '', month: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add incentive');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditIncentiveDialog = (incentive) => {
    setEditingIncentive(incentive);
    setIncentiveForm({
      user_id: incentive.agent_id,
      amount: incentive.incentive_amount?.toString() || '',
      reason: incentive.reason || '',
      month: incentive.month || ''
    });
    setShowEditIncentiveDialog(true);
  };

  const handleUpdateIncentive = async () => {
    if (!incentiveForm.amount || !incentiveForm.reason) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await axios.put(`${API}/admin/incentives/${editingIncentive.id}`, {
        amount: parseFloat(incentiveForm.amount),
        reason: incentiveForm.reason,
        month: incentiveForm.month
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Incentive updated');
      setShowEditIncentiveDialog(false);
      setEditingIncentive(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update incentive');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteIncentive = async (incentive) => {
    if (!window.confirm(`Delete incentive of ₹${incentive.incentive_amount} for ${incentive.agent_name}?`)) {
      return;
    }

    try {
      await axios.delete(`${API}/admin/incentives/${incentive.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Incentive deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete incentive');
    }
  };

  const handleRevertIncentive = async (incentive) => {
    if (!window.confirm(`Revert this PAID incentive of ₹${incentive.incentive_amount} for ${incentive.agent_name} back to PENDING?\n\nNote: This will allow you to edit or delete it, but the expense record may need to be adjusted separately.`)) {
      return;
    }

    try {
      await axios.put(`${API}/admin/incentives/${incentive.id}/revert`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Incentive reverted to pending. You can now edit or delete it.');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to revert incentive');
    }
  };

  const handleCreateSalary = async () => {
    if (!salaryForm.user_id || !salaryForm.firm_id || !salaryForm.fixed_salary) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/admin/salaries`, {
        ...salaryForm,
        fixed_salary: parseFloat(salaryForm.fixed_salary)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Salary configuration created');
      setShowSalaryDialog(false);
      setSalaryForm({
        user_id: '',
        firm_id: '',
        fixed_salary: '',
        salary_type: 'monthly',
        incentive_eligible: true,
        bank_account: '',
        bank_name: '',
        ifsc_code: '',
        pan_number: ''
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create salary config');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAdjustment = async () => {
    if (!adjustmentForm.amount || !adjustmentForm.reason) {
      toast.error('Please fill all fields');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/admin/payroll/${selectedPayroll.id}/adjustment`, {
        ...adjustmentForm,
        amount: parseFloat(adjustmentForm.amount)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Adjustment added');
      setShowAdjustmentDialog(false);
      setAdjustmentForm({ adjustment_type: 'bonus', amount: '', reason: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePayroll = async () => {
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/admin/payroll/generate`, null, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          month: selectedMonth,
          year: selectedYear,
          firm_id: selectedFirm !== 'all' ? selectedFirm : undefined
        }
      });
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate payroll');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPayslip = async (payrollId) => {
    try {
      const response = await axios.get(`${API}/admin/payroll/${payrollId}/payslip`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip_${payrollId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Payslip downloaded');
    } catch (error) {
      toast.error('Failed to download payslip');
    }
  };

  const handleMarkPaid = async (payrollId) => {
    try {
      await axios.post(`${API}/admin/payroll/${payrollId}/mark-paid`, null, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Marked as paid');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark as paid');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const statusPill = (status) => {
    const map = { paid: 'ok', pending: 'warn', approved: 'info' };
    return <span style={badgeStyle(map[status] || 'slate')}>{status}</span>;
  };

  const summary = payroll.summary || {};
  const statCards = [
    { label: 'Total Employees', value: (summary.total_employees || 0).toLocaleString('en-IN'), icon: Users, tone: T.blue },
    { label: 'Fixed Salary', value: formatCurrency(summary.total_fixed_salary), icon: Wallet, tone: T.iron700 },
    { label: 'Incentives', value: formatCurrency(summary.total_incentives), icon: TrendingUp, tone: T.green },
    { label: 'Total Payable', value: formatCurrency(summary.total_payable), icon: IndianRupee, tone: T.orange },
  ];

  const tabs = [
    { key: 'payroll', label: 'Monthly Payroll' },
    { key: 'incentives', label: `Incentives (${incentives.length})` },
    { key: 'salaries', label: 'Salary Master' },
  ];

  const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label;

  const headerRight = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={handleGeneratePayroll} disabled={submitting} style={outlineBtn}>
        <FileText size={14} /> Generate Payroll
      </button>
      <button onClick={() => setShowSalaryDialog(true)} style={primaryBtn}>
        <Plus size={14} /> Add Salary Config
      </button>
    </div>
  );

  return (
    <IronShell
      title="Salary & Payroll"
      subtitle={`${(monthLabel || '').toUpperCase()} ${selectedYear} · HR & PAYROLL`}
      onRefresh={fetchData}
      headerRight={headerRight}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{s.value}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Unapproved-incentive warning */}
          {summary.unapproved_incentives_count > 0 && (
            <div style={{ marginBottom: 16, borderRadius: 8, border: `1px solid ${T.voltage}`, background: T.voltageTint, padding: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <AlertTriangle size={18} color={T.voltageText} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 12.5, color: T.voltageText }}>
                <strong>{summary.unapproved_incentives_count} incentives ({formatCurrency(summary.unapproved_incentives_total)}) are still pending approval for this month.</strong>{' '}
                They are <strong>not</strong> included in the payroll below and will be dropped if you generate or pay now — approve them in the Incentives tab first.
              </div>
            </div>
          )}

          {/* Filters */}
          <IronCard pad={14} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 4 }}>Month</Caps>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} style={{ ...inputStyle, cursor: 'pointer', width: 150 }}>
                  {MONTHS.map(m => (<option key={m.value} value={m.value}>{m.label}</option>))}
                </select>
              </div>
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 4 }}>Year</Caps>
                <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} style={{ ...inputStyle, cursor: 'pointer', width: 110 }}>
                  {[2024, 2025, 2026, 2027].map(y => (<option key={y} value={y}>{y}</option>))}
                </select>
              </div>
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 4 }}>Firm</Caps>
                <select value={selectedFirm} onChange={(e) => setSelectedFirm(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', width: 190 }}>
                  <option value="all">All Firms</option>
                  {firms.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button onClick={handleGeneratePayroll} disabled={submitting} style={outlineBtn}>
                  <FileText size={14} /> Generate Payroll
                </button>
                <button onClick={() => setShowSalaryDialog(true)} style={primaryBtn}>
                  <Plus size={14} /> Add Salary Config
                </button>
              </div>
            </div>
          </IronCard>

          {/* Tabs */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {tabs.map((tb) => {
                  const active = activeTab === tb.key;
                  return (
                    <button key={tb.key} onClick={() => setActiveTab(tb.key)}
                      style={{ border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                      {tb.label}
                    </button>
                  );
                })}
              </div>
              {activeTab === 'incentives' && (
                <button onClick={openAddIncentiveDialog} style={primaryBtn}>
                  <Plus size={14} /> Add Manual Incentive
                </button>
              )}
            </div>

            {/* Monthly Payroll Tab */}
            {activeTab === 'payroll' && (
              <div>
                <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
                  <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900 }}>Payroll — {monthLabel} {selectedYear}</div>
                  <div style={{ ...mono, fontSize: 11, color: T.iron400, marginTop: 2 }}>{summary.pending_count || 0} pending · {summary.paid_count || 0} paid</div>
                </div>
                {payroll.payroll?.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                    <FileText size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No payroll data</div>
                    <div style={{ fontSize: 12, marginTop: 3 }}>Click "Generate Payroll" to create records.</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                        {['Employee', 'Firm'].map((h) => <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
                        {['Fixed', 'Incentives', 'Pending Inc.', 'Bonus', 'Deductions', 'Total'].map((h) => <th key={h} style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>{h}</Caps></th>)}
                        {['Days', 'Status'].map((h) => <th key={h} style={{ ...thCell, textAlign: 'center' }}><Caps size={8.5}>{h}</Caps></th>)}
                        <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Actions</Caps></th>
                      </tr></thead>
                      <tbody>
                        {payroll.payroll?.map((p) => (
                          <tr key={p.id || p.user_id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                            <td style={tdCell}>
                              <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{p.user_name}</div>
                              <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{p.user_role}</div>
                            </td>
                            <td style={tdCell}>{p.firm_name}</td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900 }}>{formatCurrency(p.fixed_salary)}</td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.green }}>{formatCurrency(p.total_incentives)}</td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>
                              {p.pending_incentives > 0 ? (
                                <span style={{ color: T.voltageText, display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                                  <Award size={11} />{formatCurrency(p.pending_incentives)}
                                </span>
                              ) : (<span style={{ color: T.iron400 }}>-</span>)}
                            </td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.blue }}>{formatCurrency(p.bonus)}</td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.orangeDeep }}>-{formatCurrency(p.deductions)}</td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.iron900 }}>{formatCurrency(p.total_payable)}</td>
                            <td style={{ ...tdCell, textAlign: 'center' }}>{p.days_present}</td>
                            <td style={{ ...tdCell, textAlign: 'center' }}>{statusPill(p.status)}</td>
                            <td style={{ ...tdCell, textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                {p.id && (
                                  <button onClick={() => handleDownloadPayslip(p.id)} title="Download Payslip" style={{ ...iconBtn, color: T.blue }}><Download size={13} /></button>
                                )}
                                {p.id && p.status !== 'paid' && (
                                  <>
                                    <button onClick={() => { setSelectedPayroll(p); setShowAdjustmentDialog(true); }} title="Add Adjustment" style={{ ...iconBtn, color: T.iron700 }}><Edit size={13} /></button>
                                    <button onClick={() => handleMarkPaid(p.id)} title="Mark as Paid" style={{ ...iconBtn, color: T.green }}><CheckCircle size={13} /></button>
                                  </>
                                )}
                                {p.is_draft && (<span style={badgeStyle('bad')}>Draft</span>)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Incentives Tab */}
            {activeTab === 'incentives' && (
              <div>
                <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
                  <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900 }}>Incentives — {monthLabel} {selectedYear}</div>
                  <div style={{ fontSize: 11.5, color: T.iron400, marginTop: 2 }}>Manage manual incentives and view all incentives for the selected month</div>
                </div>
                {incentives.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                    <Award size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No incentives found for this month.</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                        {['Employee', 'Source', 'Reason / Order'].map((h) => <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
                        <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Amount</Caps></th>
                        {['Status', 'Actions'].map((h) => <th key={h} style={{ ...thCell, textAlign: 'center' }}><Caps size={8.5}>{h}</Caps></th>)}
                      </tr></thead>
                      <tbody>
                        {incentives.map((inc) => (
                          <tr key={inc.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                            <td style={tdCell}>
                              <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{inc.agent_name}</span>
                            </td>
                            <td style={tdCell}>
                              <span style={badgeStyle(inc.source === 'manual' ? 'violet' : 'info')}>{inc.source || 'sales'}</span>
                            </td>
                            <td style={{ ...tdCell, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {inc.reason || inc.order_id || '-'}
                            </td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.green, fontWeight: 700 }}>{formatCurrency(inc.incentive_amount)}</td>
                            <td style={{ ...tdCell, textAlign: 'center' }}>
                              <span style={badgeStyle(inc.status === 'paid' ? 'ok' : inc.status === 'approved' ? 'info' : 'warn')}>{inc.status}</span>
                            </td>
                            <td style={{ ...tdCell, textAlign: 'center' }}>
                              {inc.status !== 'paid' && (
                                <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'center' }}>
                                  <button onClick={() => openEditIncentiveDialog(inc)} title="Edit" style={{ ...iconBtn, color: T.voltageText }}><Pencil size={12} /></button>
                                  <button onClick={() => handleDeleteIncentive(inc)} title="Delete" style={{ ...iconBtn, color: T.orangeDeep }}><Trash2 size={12} /></button>
                                </div>
                              )}
                              {inc.status === 'paid' && (
                                <button onClick={() => handleRevertIncentive(inc)} title="Revert to Pending (allows editing)" style={{ ...iconBtn, color: T.orangeDeep }}>
                                  <Undo2 size={12} /><span style={{ fontSize: 11 }}>Revert</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Salary Master Tab */}
            {activeTab === 'salaries' && (
              <div>
                <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
                  <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900 }}>Employee Salary Master</div>
                  <div style={{ fontSize: 11.5, color: T.iron400, marginTop: 2 }}>Configure fixed salary and incentive eligibility for each employee</div>
                </div>
                {salaries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                    <Wallet size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No salary configurations found.</div>
                    <div style={{ fontSize: 12, marginTop: 3 }}>Add one to get started.</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                        {['Employee', 'Role', 'Firm'].map((h) => <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
                        <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Fixed Salary</Caps></th>
                        {['Type', 'Incentive', 'Status', 'Actions'].map((h) => <th key={h} style={{ ...thCell, textAlign: 'center' }}><Caps size={8.5}>{h}</Caps></th>)}
                      </tr></thead>
                      <tbody>
                        {salaries.map((s) => (
                          <tr key={s.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                            <td style={tdCell}>
                              <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{s.user_name}</div>
                              <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{s.user_email}</div>
                            </td>
                            <td style={{ ...tdCell, textTransform: 'capitalize' }}>{s.user_role?.replace('_', ' ')}</td>
                            <td style={tdCell}>{s.firm_name}</td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.iron900 }}>{formatCurrency(s.fixed_salary)}</td>
                            <td style={{ ...tdCell, textAlign: 'center' }}>
                              <span style={{ ...badgeStyle('slate'), textTransform: 'capitalize' }}>{s.salary_type}</span>
                            </td>
                            <td style={{ ...tdCell, textAlign: 'center' }}>
                              <span style={badgeStyle(s.incentive_eligible ? 'ok' : 'slate')}>{s.incentive_eligible ? 'Yes' : 'No'}</span>
                            </td>
                            <td style={{ ...tdCell, textAlign: 'center' }}>
                              <span style={badgeStyle(s.is_active ? 'ok' : 'bad')}>{s.is_active ? 'Active' : 'Inactive'}</span>
                            </td>
                            <td style={{ ...tdCell, textAlign: 'center' }}>
                              <button onClick={() => openEditSalaryDialog(s)} title="Edit" style={{ ...iconBtn, color: T.voltageText }}><Pencil size={13} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </IronCard>
        </>
      )}

      {/* Add Salary Config Dialog */}
      <Dialog open={showSalaryDialog} onOpenChange={setShowSalaryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Salary Configuration</DialogTitle>
            <DialogDescription>Set up salary details for an employee</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Employee *</Label>
              <Select value={salaryForm.user_id} onValueChange={(v) => setSalaryForm({ ...salaryForm, user_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Firm *</Label>
              <Select value={salaryForm.firm_id} onValueChange={(v) => setSalaryForm({ ...salaryForm, firm_id: v })}>
                <SelectTrigger>
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
              <Label>Fixed Salary (Monthly) *</Label>
              <Input
                type="number"
                value={salaryForm.fixed_salary}
                onChange={(e) => setSalaryForm({ ...salaryForm, fixed_salary: e.target.value })}
                placeholder="Enter monthly salary"
              />
            </div>

            <div>
              <Label>Salary Type</Label>
              <Select value={salaryForm.salary_type} onValueChange={(v) => setSalaryForm({ ...salaryForm, salary_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="incentive_eligible"
                checked={salaryForm.incentive_eligible}
                onChange={(e) => setSalaryForm({ ...salaryForm, incentive_eligible: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="incentive_eligible" className="cursor-pointer">
                Eligible for Incentives
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bank Account</Label>
                <Input
                  value={salaryForm.bank_account}
                  onChange={(e) => setSalaryForm({ ...salaryForm, bank_account: e.target.value })}
                  placeholder="Account number"
                />
              </div>
              <div>
                <Label>IFSC Code</Label>
                <Input
                  value={salaryForm.ifsc_code}
                  onChange={(e) => setSalaryForm({ ...salaryForm, ifsc_code: e.target.value.toUpperCase() })}
                  placeholder="IFSC"
                />
              </div>
            </div>

            <div>
              <Label>PAN Number</Label>
              <Input
                value={salaryForm.pan_number}
                onChange={(e) => setSalaryForm({ ...salaryForm, pan_number: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSalaryDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSalary} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Adjustment Dialog */}
      <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payroll Adjustment</DialogTitle>
            <DialogDescription>
              Add bonus, penalty, or reimbursement for {selectedPayroll?.user_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={adjustmentForm.adjustment_type} onValueChange={(v) => setAdjustmentForm({ ...adjustmentForm, adjustment_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-green-600" /> Bonus
                    </div>
                  </SelectItem>
                  <SelectItem value="penalty">
                    <div className="flex items-center gap-2">
                      <MinusCircle className="w-4 h-4 text-red-600" /> Penalty
                    </div>
                  </SelectItem>
                  <SelectItem value="reimbursement">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-600" /> Reimbursement
                    </div>
                  </SelectItem>
                  <SelectItem value="deduction">
                    <div className="flex items-center gap-2">
                      <MinusCircle className="w-4 h-4 text-orange-600" /> Other Deduction
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={adjustmentForm.amount}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                placeholder="Enter amount"
              />
            </div>

            <div>
              <Label>Reason *</Label>
              <Input
                value={adjustmentForm.reason}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                placeholder="Enter reason for adjustment"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustmentDialog(false)}>Cancel</Button>
            <Button onClick={handleAddAdjustment} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Salary Dialog */}
      <Dialog open={showEditSalaryDialog} onOpenChange={setShowEditSalaryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Salary Configuration</DialogTitle>
            <DialogDescription>
              Update salary details for {editingSalary?.user_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Fixed Salary (₹/month) *</Label>
              <Input
                type="number"
                value={salaryForm.fixed_salary}
                onChange={(e) => setSalaryForm({ ...salaryForm, fixed_salary: e.target.value })}
                placeholder="e.g., 25000"
              />
            </div>

            <div>
              <Label>Salary Type</Label>
              <Select value={salaryForm.salary_type} onValueChange={(v) => setSalaryForm({ ...salaryForm, salary_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit_incentive_eligible"
                checked={salaryForm.incentive_eligible}
                onChange={(e) => setSalaryForm({ ...salaryForm, incentive_eligible: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <Label htmlFor="edit_incentive_eligible">Eligible for Incentives</Label>
            </div>

            <div className="border-t pt-4">
              <p className="text-slate-500 text-sm mb-3">Bank Details (Optional)</p>
              <div className="space-y-3">
                <Input
                  value={salaryForm.bank_account}
                  onChange={(e) => setSalaryForm({ ...salaryForm, bank_account: e.target.value })}
                  placeholder="Bank Account Number"
                />
                <Input
                  value={salaryForm.bank_name}
                  onChange={(e) => setSalaryForm({ ...salaryForm, bank_name: e.target.value })}
                  placeholder="Bank Name"
                />
                <Input
                  value={salaryForm.ifsc_code}
                  onChange={(e) => setSalaryForm({ ...salaryForm, ifsc_code: e.target.value })}
                  placeholder="IFSC Code"
                />
                <Input
                  value={salaryForm.pan_number}
                  onChange={(e) => setSalaryForm({ ...salaryForm, pan_number: e.target.value })}
                  placeholder="PAN Number"
                />
              </div>
            </div>

            {/* Firm Transfer Section */}
            <div className="border-t pt-4" style={{ borderColor: T.orange, background: T.voltageTint, margin: '0 -24px', padding: '16px 24px' }}>
              <p style={{ color: T.orangeDeep, fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Transfer to Another Firm</p>
              <p className="text-slate-500 text-xs mb-3">
                Transfer this employee to a different firm. This will end their current salary configuration and create a new one for the selected firm.
              </p>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">New Firm</Label>
                  <Select
                    value={salaryForm.transfer_to_firm}
                    onValueChange={(v) => setSalaryForm({ ...salaryForm, transfer_to_firm: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select firm to transfer to" />
                    </SelectTrigger>
                    <SelectContent>
                      {firms.filter(f => f.id !== editingSalary?.firm_id).map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {salaryForm.transfer_to_firm && (
                  <div>
                    <Label className="text-sm">Effective From (Month) *</Label>
                    <Input
                      type="month"
                      value={salaryForm.effective_from}
                      onChange={(e) => setSalaryForm({ ...salaryForm, effective_from: e.target.value })}
                      className="mt-1"
                      min="2024-01"
                    />
                    <p style={{ color: T.orangeDeep, fontSize: 11, marginTop: 4 }}>
                      Employee will be under the new firm from this month onwards
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSalaryDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateSalary} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {salaryForm.transfer_to_firm && salaryForm.transfer_to_firm !== editingSalary?.firm_id ? 'Transfer & Save' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Incentive Dialog */}
      <Dialog open={showAddIncentiveDialog} onOpenChange={setShowAddIncentiveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Manual Incentive</DialogTitle>
            <DialogDescription>Add a manual incentive for an employee</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Employee *</Label>
              <Select value={incentiveForm.user_id} onValueChange={(v) => setIncentiveForm({ ...incentiveForm, user_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                value={incentiveForm.amount}
                onChange={(e) => setIncentiveForm({ ...incentiveForm, amount: e.target.value })}
                placeholder="e.g., 5000"
              />
            </div>

            <div>
              <Label>Reason *</Label>
              <Input
                value={incentiveForm.reason}
                onChange={(e) => setIncentiveForm({ ...incentiveForm, reason: e.target.value })}
                placeholder="Reason for incentive"
              />
            </div>

            <div>
              <Label>Month</Label>
              <Input
                value={incentiveForm.month}
                onChange={(e) => setIncentiveForm({ ...incentiveForm, month: e.target.value })}
                placeholder="YYYY-MM"
              />
              <p className="text-slate-500 text-xs mt-1">Format: YYYY-MM (e.g., 2026-03 for March 2026)</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddIncentiveDialog(false)}>Cancel</Button>
            <Button onClick={handleAddIncentive} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Incentive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Incentive Dialog */}
      <Dialog open={showEditIncentiveDialog} onOpenChange={setShowEditIncentiveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Incentive</DialogTitle>
            <DialogDescription>
              Update incentive for {editingIncentive?.agent_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                value={incentiveForm.amount}
                onChange={(e) => setIncentiveForm({ ...incentiveForm, amount: e.target.value })}
                placeholder="e.g., 5000"
              />
            </div>

            <div>
              <Label>Reason *</Label>
              <Input
                value={incentiveForm.reason}
                onChange={(e) => setIncentiveForm({ ...incentiveForm, reason: e.target.value })}
                placeholder="Reason for incentive"
              />
            </div>

            <div>
              <Label>Month</Label>
              <Input
                value={incentiveForm.month}
                onChange={(e) => setIncentiveForm({ ...incentiveForm, month: e.target.value })}
                placeholder="YYYY-MM"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditIncentiveDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateIncentive} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

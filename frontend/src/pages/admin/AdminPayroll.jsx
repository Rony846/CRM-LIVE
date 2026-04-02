import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  DollarSign, Users, Wallet, TrendingUp, Plus, Loader2,
  Building2, CheckCircle, Clock, IndianRupee, FileText,
  Download, Eye, Edit, AlertTriangle, CreditCard, Gift, MinusCircle, Award
} from 'lucide-react';

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
  
  const [showSalaryDialog, setShowSalaryDialog] = useState(false);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
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
  }, [token, selectedMonth, selectedYear, selectedFirm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [firmsRes, usersRes, salariesRes, payrollRes] = await Promise.all([
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
        })
      ]);
      
      setFirms(firmsRes.data || []);
      setUsers(usersRes.data?.filter(u => u.role !== 'customer') || []);
      setSalaries(salariesRes.data || []);
      setPayroll(payrollRes.data || { payroll: [], summary: {} });
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-600">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-600">Pending</Badge>;
      default:
        return <Badge className="bg-slate-600">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Salary & Payroll">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Salary & Payroll">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Employees</p>
                  <p className="text-2xl font-bold text-white">{payroll.summary.total_employees || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Fixed Salary</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(payroll.summary.total_fixed_salary)}</p>
                </div>
                <Wallet className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Incentives</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(payroll.summary.total_incentives)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Payable</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(payroll.summary.total_payable)}</p>
                </div>
                <IndianRupee className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-40">
                <Label className="text-slate-300">Month</Label>
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={m.value.toString()} className="text-white hover:bg-slate-800">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-32">
                <Label className="text-slate-300">Year</Label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {[2024, 2025, 2026, 2027].map(y => (
                      <SelectItem key={y} value={y.toString()} className="text-white hover:bg-slate-800">
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-48">
                <Label className="text-slate-300">Firm</Label>
                <Select value={selectedFirm} onValueChange={setSelectedFirm}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue placeholder="All Firms" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="all" className="text-white hover:bg-slate-800">All Firms</SelectItem>
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id} className="text-white hover:bg-slate-800">
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 ml-auto">
                <Button onClick={handleGeneratePayroll} disabled={submitting} className="bg-cyan-600 hover:bg-cyan-700">
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Payroll
                </Button>
                <Button onClick={() => setShowSalaryDialog(true)} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Salary Config
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="payroll" className="space-y-4">
          <TabsList className="bg-slate-800">
            <TabsTrigger value="payroll" className="data-[state=active]:bg-cyan-600">
              Monthly Payroll
            </TabsTrigger>
            <TabsTrigger value="salaries" className="data-[state=active]:bg-cyan-600">
              Salary Master
            </TabsTrigger>
          </TabsList>

          {/* Monthly Payroll Tab */}
          <TabsContent value="payroll">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">
                  Payroll - {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {payroll.summary.pending_count || 0} pending, {payroll.summary.paid_count || 0} paid
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-400 text-sm">Employee</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Firm</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Fixed</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Incentives</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Pending Inc.</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Bonus</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Deductions</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Total</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Days</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Status</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payroll.payroll?.map((p) => (
                        <tr key={p.id || p.user_id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="p-3">
                            <div>
                              <p className="text-white font-medium">{p.user_name}</p>
                              <p className="text-slate-400 text-xs">{p.user_role}</p>
                            </div>
                          </td>
                          <td className="p-3 text-slate-300">{p.firm_name}</td>
                          <td className="p-3 text-right text-white">{formatCurrency(p.fixed_salary)}</td>
                          <td className="p-3 text-right text-green-400">{formatCurrency(p.total_incentives)}</td>
                          <td className="p-3 text-right">
                            {p.pending_incentives > 0 ? (
                              <span className="text-yellow-400 flex items-center justify-end gap-1">
                                <Award className="w-3 h-3" />
                                {formatCurrency(p.pending_incentives)}
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right text-cyan-400">{formatCurrency(p.bonus)}</td>
                          <td className="p-3 text-right text-red-400">-{formatCurrency(p.deductions)}</td>
                          <td className="p-3 text-right text-white font-bold">{formatCurrency(p.total_payable)}</td>
                          <td className="p-3 text-center text-slate-300">{p.days_present}</td>
                          <td className="p-3 text-center">{getStatusBadge(p.status)}</td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1">
                              {p.id && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDownloadPayslip(p.id)}
                                  className="text-blue-400 hover:text-blue-300"
                                  title="Download Payslip"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              )}
                              {p.id && p.status !== 'paid' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedPayroll(p);
                                      setShowAdjustmentDialog(true);
                                    }}
                                    className="text-cyan-400 hover:text-cyan-300"
                                    title="Add Adjustment"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleMarkPaid(p.id)}
                                    className="text-green-400 hover:text-green-300"
                                    title="Mark as Paid"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              {p.is_draft && (
                                <Badge className="bg-orange-600 text-xs">Draft</Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {payroll.payroll?.length === 0 && (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-slate-400">
                            No payroll data. Click "Generate Payroll" to create records.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Salary Master Tab */}
          <TabsContent value="salaries">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Employee Salary Master</CardTitle>
                <CardDescription className="text-slate-400">
                  Configure fixed salary and incentive eligibility for each employee
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-400 text-sm">Employee</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Role</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Firm</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Fixed Salary</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Type</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Incentive</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaries.map((s) => (
                        <tr key={s.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="p-3">
                            <div>
                              <p className="text-white font-medium">{s.user_name}</p>
                              <p className="text-slate-400 text-xs">{s.user_email}</p>
                            </div>
                          </td>
                          <td className="p-3 text-slate-300 capitalize">{s.user_role?.replace('_', ' ')}</td>
                          <td className="p-3 text-slate-300">{s.firm_name}</td>
                          <td className="p-3 text-right text-white font-medium">{formatCurrency(s.fixed_salary)}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className="border-slate-600 text-slate-300 capitalize">
                              {s.salary_type}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            {s.incentive_eligible ? (
                              <Badge className="bg-green-600">Yes</Badge>
                            ) : (
                              <Badge className="bg-slate-600">No</Badge>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {s.is_active ? (
                              <Badge className="bg-green-600">Active</Badge>
                            ) : (
                              <Badge className="bg-red-600">Inactive</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                      {salaries.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No salary configurations found. Add one to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Salary Config Dialog */}
      <Dialog open={showSalaryDialog} onOpenChange={setShowSalaryDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Add Salary Configuration</DialogTitle>
            <DialogDescription className="text-slate-400">
              Set up salary details for an employee
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Employee *</Label>
              <Select value={salaryForm.user_id} onValueChange={(v) => setSalaryForm({ ...salaryForm, user_id: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id} className="text-white hover:bg-slate-800">
                      {u.first_name} {u.last_name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Firm *</Label>
              <Select value={salaryForm.firm_id} onValueChange={(v) => setSalaryForm({ ...salaryForm, firm_id: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select firm" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {firms.map(f => (
                    <SelectItem key={f.id} value={f.id} className="text-white hover:bg-slate-800">
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Fixed Salary (Monthly) *</Label>
              <Input
                type="number"
                value={salaryForm.fixed_salary}
                onChange={(e) => setSalaryForm({ ...salaryForm, fixed_salary: e.target.value })}
                placeholder="Enter monthly salary"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <Label className="text-slate-300">Salary Type</Label>
              <Select value={salaryForm.salary_type} onValueChange={(v) => setSalaryForm({ ...salaryForm, salary_type: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="monthly" className="text-white hover:bg-slate-800">Monthly</SelectItem>
                  <SelectItem value="daily" className="text-white hover:bg-slate-800">Daily</SelectItem>
                  <SelectItem value="hourly" className="text-white hover:bg-slate-800">Hourly</SelectItem>
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
              <Label htmlFor="incentive_eligible" className="text-slate-300 cursor-pointer">
                Eligible for Incentives
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Bank Account</Label>
                <Input
                  value={salaryForm.bank_account}
                  onChange={(e) => setSalaryForm({ ...salaryForm, bank_account: e.target.value })}
                  placeholder="Account number"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">IFSC Code</Label>
                <Input
                  value={salaryForm.ifsc_code}
                  onChange={(e) => setSalaryForm({ ...salaryForm, ifsc_code: e.target.value.toUpperCase() })}
                  placeholder="IFSC"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">PAN Number</Label>
              <Input
                value={salaryForm.pan_number}
                onChange={(e) => setSalaryForm({ ...salaryForm, pan_number: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSalaryDialog(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleCreateSalary} disabled={submitting} className="bg-cyan-600 hover:bg-cyan-700">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Adjustment Dialog */}
      <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Add Payroll Adjustment</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add bonus, penalty, or reimbursement for {selectedPayroll?.user_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Type</Label>
              <Select value={adjustmentForm.adjustment_type} onValueChange={(v) => setAdjustmentForm({ ...adjustmentForm, adjustment_type: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="bonus" className="text-white hover:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-green-400" /> Bonus
                    </div>
                  </SelectItem>
                  <SelectItem value="penalty" className="text-white hover:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <MinusCircle className="w-4 h-4 text-red-400" /> Penalty
                    </div>
                  </SelectItem>
                  <SelectItem value="reimbursement" className="text-white hover:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-cyan-400" /> Reimbursement
                    </div>
                  </SelectItem>
                  <SelectItem value="deduction" className="text-white hover:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <MinusCircle className="w-4 h-4 text-orange-400" /> Other Deduction
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Amount (₹)</Label>
              <Input
                type="number"
                value={adjustmentForm.amount}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                placeholder="Enter amount"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <Label className="text-slate-300">Reason *</Label>
              <Input
                value={adjustmentForm.reason}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                placeholder="Enter reason for adjustment"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdjustmentDialog(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button onClick={handleAddAdjustment} disabled={submitting} className="bg-cyan-600 hover:bg-cyan-700">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

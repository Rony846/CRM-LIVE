import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, Clock, CheckCircle, Loader2, RefreshCw,
  Calendar, Users, IndianRupee, Settings, Wallet, Award, Plus, Save, Pencil, Trash2, Undo2
} from 'lucide-react';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-600' },
  approved: { label: 'Approved', color: 'bg-blue-600' },
  paid: { label: 'Paid', color: 'bg-green-600' },
  cancelled: { label: 'Cancelled', color: 'bg-red-600' }
};

export default function AdminIncentives() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [incentives, setIncentives] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [manualIncentiveOpen, setManualIncentiveOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [newConfig, setNewConfig] = useState({
    month: new Date().toISOString().slice(0, 7),
    incentive_type: 'fixed',
    fixed_amount: 500,
    percentage: 1,
    min_sale_value: 1000,
    max_incentive: 5000,
    notes: ''
  });

  const [manualIncentive, setManualIncentive] = useState({
    user_id: '',
    amount: '',
    reason: '',
    month: new Date().toISOString().slice(0, 7)
  });

  // Edit incentive state
  const [editIncentiveOpen, setEditIncentiveOpen] = useState(false);
  const [editingIncentive, setEditingIncentive] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    reason: ''
  });

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, selectedMonth, selectedAgent]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [summaryRes, configsRes, usersRes] = await Promise.all([
        axios.get(`${API}/admin/incentives/summary`, { headers, params: { month: selectedMonth } }),
        axios.get(`${API}/admin/incentive-config`, { headers }),
        axios.get(`${API}/admin/users`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setSummary(summaryRes.data);
      setConfigs(configsRes.data || []);
      // Filter users who can receive incentives (supervisors, call support, technicians, etc.)
      const eligibleRoles = ['supervisor', 'call_support', 'technician', 'accountant', 'production'];
      setUsers((usersRes.data || []).filter(u => eligibleRoles.includes(u.role) || u.role));
      
      // Fetch detailed incentives if needed
      const params = { month: selectedMonth };
      if (selectedAgent !== 'all') params.agent_id = selectedAgent;
      
      const incentivesRes = await axios.get(`${API}/admin/incentives`, { headers, params });
      setIncentives(incentivesRes.data?.incentives || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load incentives data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/admin/incentive-config`, newConfig, { headers });
      toast.success('Configuration saved');
      setConfigDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkApprove = async (agentId = null) => {
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = { month: selectedMonth };
      if (agentId) params.agent_id = agentId;
      
      await axios.post(`${API}/admin/incentives/bulk-approve`, null, { headers, params });
      toast.success('Incentives approved');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkPaid = async (agentId = null) => {
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = { month: selectedMonth };
      if (agentId) params.agent_id = agentId;
      
      await axios.post(`${API}/admin/incentives/bulk-paid`, null, { headers, params });
      toast.success('Incentives marked as paid');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark as paid');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddManualIncentive = async () => {
    if (!manualIncentive.user_id || !manualIncentive.amount || !manualIncentive.reason) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/admin/incentives/manual`, {
        user_id: manualIncentive.user_id,
        amount: parseFloat(manualIncentive.amount),
        reason: manualIncentive.reason,
        month: manualIncentive.month
      }, { headers });
      
      toast.success('Manual incentive added successfully');
      setManualIncentiveOpen(false);
      setManualIncentive({
        user_id: '',
        amount: '',
        reason: '',
        month: new Date().toISOString().slice(0, 7)
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add incentive');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit Incentive Handler
  const openEditIncentive = (incentive) => {
    setEditingIncentive(incentive);
    setEditForm({
      amount: incentive.incentive_amount?.toString() || '',
      reason: incentive.reason || incentive.quotation_number || ''
    });
    setEditIncentiveOpen(true);
  };

  const handleUpdateIncentive = async () => {
    if (!editForm.amount) {
      toast.error('Please enter an amount');
      return;
    }
    
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API}/admin/incentives/${editingIncentive.id}`, {
        amount: parseFloat(editForm.amount),
        reason: editForm.reason
      }, { headers });
      
      toast.success('Incentive updated successfully');
      setEditIncentiveOpen(false);
      setEditingIncentive(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update incentive');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteIncentive = async (incentive) => {
    if (!window.confirm(`Delete this incentive of ${formatCurrency(incentive.incentive_amount)} for ${incentive.agent_name}?`)) {
      return;
    }
    
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API}/admin/incentives/${incentive.id}`, { headers });
      
      toast.success('Incentive deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete incentive');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevertIncentive = async (incentive) => {
    if (!window.confirm(`Revert this PAID incentive of ${formatCurrency(incentive.incentive_amount)} for ${incentive.agent_name} back to PENDING?\n\nNote: This will allow you to edit or delete it.`)) {
      return;
    }
    
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API}/admin/incentives/${incentive.id}/revert`, {}, { headers });
      
      toast.success('Incentive reverted to pending. You can now edit or delete it.');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to revert incentive');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Generate month options
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  if (loading) {
    return (
      <DashboardLayout title="Salary & Incentives">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Salary & Incentives">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <DollarSign className="w-7 h-7 text-green-400" />
              Salary & Incentives Management
            </h1>
            <p className="text-slate-400">Track and manage team incentives</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setManualIncentiveOpen(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Manual Incentive
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setConfigDialogOpen(true)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </Button>
            <Button 
              variant="outline" 
              onClick={fetchData}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-cyan-900/50 to-cyan-800/30 border-cyan-700">
            <CardContent className="p-4">
              <p className="text-cyan-300 text-sm">Total Incentives</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(summary?.totals?.total_incentive || 0)}
              </p>
              <p className="text-cyan-400 text-xs">{summary?.totals?.total_conversions || 0} conversions</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 border-yellow-700">
            <CardContent className="p-4">
              <p className="text-yellow-300 text-sm">Pending Approval</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(summary?.totals?.pending_incentive || 0)}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700">
            <CardContent className="p-4">
              <p className="text-green-300 text-sm">Paid Out</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(summary?.totals?.paid_incentive || 0)}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700">
            <CardContent className="p-4">
              <p className="text-purple-300 text-sm">Active Agents</p>
              <p className="text-2xl font-bold text-white">{summary?.agents?.length || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-48">
                <Label className="text-slate-400 text-xs">Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {getMonthOptions().map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-48">
                <Label className="text-slate-400 text-xs">Agent</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue placeholder="All Agents" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="all">All Agents</SelectItem>
                    {summary?.agents?.map(agent => (
                      <SelectItem key={agent.agent_id} value={agent.agent_id}>
                        {agent.agent_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1" />
              
              <Button
                onClick={() => handleBulkApprove()}
                disabled={actionLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve All Pending
              </Button>
              
              <Button
                onClick={() => handleBulkPaid()}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Mark All Paid
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="summary" className="data-[state=active]:bg-cyan-600">
              Agent Summary
            </TabsTrigger>
            <TabsTrigger value="details" className="data-[state=active]:bg-cyan-600">
              All Transactions
            </TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-cyan-600">
              Configuration
            </TabsTrigger>
          </TabsList>

          {/* Agent Summary Tab */}
          <TabsContent value="summary">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Agent Performance - {summary?.month}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">Agent</TableHead>
                      <TableHead className="text-slate-400 text-right">Conversions</TableHead>
                      <TableHead className="text-slate-400 text-right">Total Sales</TableHead>
                      <TableHead className="text-slate-400 text-right">Total Incentive</TableHead>
                      <TableHead className="text-slate-400 text-right">Pending</TableHead>
                      <TableHead className="text-slate-400 text-right">Paid</TableHead>
                      <TableHead className="text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary?.agents?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                          No incentives for this month
                        </TableCell>
                      </TableRow>
                    ) : (
                      summary?.agents?.map((agent) => (
                        <TableRow key={agent.agent_id} className="border-slate-700">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white text-sm font-medium">
                                {agent.agent_name?.charAt(0) || '?'}
                              </div>
                              <span className="text-white">{agent.agent_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-white font-semibold">
                            {agent.conversions}
                          </TableCell>
                          <TableCell className="text-right text-white">
                            {formatCurrency(agent.total_sales)}
                          </TableCell>
                          <TableCell className="text-right text-cyan-400 font-semibold">
                            {formatCurrency(agent.total_incentive)}
                          </TableCell>
                          <TableCell className="text-right text-yellow-400">
                            {formatCurrency(agent.pending_incentive)}
                          </TableCell>
                          <TableCell className="text-right text-green-400">
                            {formatCurrency(agent.paid_incentive)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {agent.pending_incentive > 0 && (
                                <Button
                                  size="sm"
                                  onClick={() => handleBulkApprove(agent.agent_id)}
                                  disabled={actionLoading}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  Approve
                                </Button>
                              )}
                              {(agent.pending_incentive > 0 || agent.total_incentive - agent.paid_incentive > 0) && (
                                <Button
                                  size="sm"
                                  onClick={() => handleBulkPaid(agent.agent_id)}
                                  disabled={actionLoading}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Pay
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">All Incentive Transactions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">Date</TableHead>
                      <TableHead className="text-slate-400">Agent</TableHead>
                      <TableHead className="text-slate-400">Source / PI</TableHead>
                      <TableHead className="text-slate-400">Reason / Customer</TableHead>
                      <TableHead className="text-slate-400 text-right">Sale Value</TableHead>
                      <TableHead className="text-slate-400 text-right">Incentive</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incentives.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      incentives.map((inc) => (
                        <TableRow key={inc.id} className="border-slate-700">
                          <TableCell className="text-slate-300">{formatDate(inc.created_at)}</TableCell>
                          <TableCell className="text-white">{inc.agent_name}</TableCell>
                          <TableCell>
                            {inc.source === 'manual' ? (
                              <Badge className="bg-purple-600">Manual</Badge>
                            ) : (
                              <span className="text-white font-mono text-sm">{inc.quotation_number || '-'}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-300 max-w-[200px] truncate">
                            {inc.reason || inc.customer_name || '-'}
                          </TableCell>
                          <TableCell className="text-right text-white">
                            {inc.sale_value ? formatCurrency(inc.sale_value) : '-'}
                          </TableCell>
                          <TableCell className="text-right text-green-400 font-semibold">
                            +{formatCurrency(inc.incentive_amount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${STATUS_CONFIG[inc.status]?.color || 'bg-slate-600'} text-white`}>
                              {STATUS_CONFIG[inc.status]?.label || inc.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {inc.status !== 'paid' ? (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-yellow-400 hover:bg-yellow-500/10 h-7 w-7 p-0"
                                  onClick={() => openEditIncentive(inc)}
                                  disabled={actionLoading}
                                  title="Edit"
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-400 hover:bg-red-500/10 h-7 w-7 p-0"
                                  onClick={() => handleDeleteIncentive(inc)}
                                  disabled={actionLoading}
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-orange-400 hover:bg-orange-500/10 h-7"
                                onClick={() => handleRevertIncentive(inc)}
                                disabled={actionLoading}
                                title="Revert to Pending"
                              >
                                <Undo2 className="w-3 h-3 mr-1" />
                                <span className="text-xs">Revert</span>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Incentive Configuration</CardTitle>
                <Button onClick={() => setConfigDialogOpen(true)} className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Configuration
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">Month</TableHead>
                      <TableHead className="text-slate-400">Type</TableHead>
                      <TableHead className="text-slate-400 text-right">Fixed Amount</TableHead>
                      <TableHead className="text-slate-400 text-right">Percentage</TableHead>
                      <TableHead className="text-slate-400 text-right">Min Sale Value</TableHead>
                      <TableHead className="text-slate-400 text-right">Max Incentive</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                          <Settings className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                          <p>No configuration found</p>
                          <p className="text-sm">Add a configuration to enable incentives</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      configs.map((config) => (
                        <TableRow key={config.id} className="border-slate-700">
                          <TableCell className="text-white font-medium">
                            {config.month === 'default' ? 'Default' : 
                              new Date(config.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                          </TableCell>
                          <TableCell>
                            <Badge className={config.incentive_type === 'fixed' ? 'bg-blue-600' : 'bg-purple-600'}>
                              {config.incentive_type === 'fixed' ? 'Fixed' : 'Percentage'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-white">
                            {config.incentive_type === 'fixed' ? formatCurrency(config.fixed_amount) : '-'}
                          </TableCell>
                          <TableCell className="text-right text-white">
                            {config.incentive_type === 'percentage' ? `${config.percentage}%` : '-'}
                          </TableCell>
                          <TableCell className="text-right text-slate-300">
                            {formatCurrency(config.min_sale_value)}
                          </TableCell>
                          <TableCell className="text-right text-slate-300">
                            {config.max_incentive ? formatCurrency(config.max_incentive) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={config.is_active ? 'bg-green-600' : 'bg-slate-600'}>
                              {config.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md" aria-describedby="config-dialog-description">
          <DialogHeader>
            <DialogTitle className="text-white">Incentive Configuration</DialogTitle>
          </DialogHeader>
          <p id="config-dialog-description" className="sr-only">Configure incentive settings for the selected month</p>
          
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Month</Label>
              <Select 
                value={newConfig.month} 
                onValueChange={(v) => setNewConfig({...newConfig, month: v})}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="default">Default (All Months)</SelectItem>
                  {getMonthOptions().map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-slate-300">Incentive Type</Label>
              <Select 
                value={newConfig.incentive_type} 
                onValueChange={(v) => setNewConfig({...newConfig, incentive_type: v})}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="fixed">Fixed Amount per Conversion</SelectItem>
                  <SelectItem value="percentage">Percentage of Sale Value</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {newConfig.incentive_type === 'fixed' && (
              <div>
                <Label className="text-slate-300">Fixed Amount (Rs.)</Label>
                <Input
                  type="number"
                  value={newConfig.fixed_amount}
                  onChange={(e) => setNewConfig({...newConfig, fixed_amount: parseFloat(e.target.value) || 0})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            )}
            
            {newConfig.incentive_type === 'percentage' && (
              <>
                <div>
                  <Label className="text-slate-300">Percentage (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={newConfig.percentage}
                    onChange={(e) => setNewConfig({...newConfig, percentage: parseFloat(e.target.value) || 0})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Maximum Incentive Cap (Rs.)</Label>
                  <Input
                    type="number"
                    value={newConfig.max_incentive || ''}
                    onChange={(e) => setNewConfig({...newConfig, max_incentive: parseFloat(e.target.value) || null})}
                    placeholder="No cap"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </>
            )}
            
            <div>
              <Label className="text-slate-300">Minimum Sale Value (Rs.)</Label>
              <Input
                type="number"
                value={newConfig.min_sale_value}
                onChange={(e) => setNewConfig({...newConfig, min_sale_value: parseFloat(e.target.value) || 0})}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-slate-500 text-xs mt-1">Only conversions above this value will earn incentives</p>
            </div>
            
            <div>
              <Label className="text-slate-300">Notes</Label>
              <Input
                value={newConfig.notes}
                onChange={(e) => setNewConfig({...newConfig, notes: e.target.value})}
                placeholder="Optional notes..."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConfigDialogOpen(false)}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveConfig}
              disabled={actionLoading}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Incentive Dialog */}
      <Dialog open={manualIncentiveOpen} onOpenChange={setManualIncentiveOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-green-400" />
              Add Manual Incentive
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Select Employee *</Label>
              <Select
                value={manualIncentive.user_id}
                onValueChange={(v) => setManualIncentive({...manualIncentive, user_id: v})}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id} className="text-white">
                      {u.first_name} {u.last_name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-slate-300">Incentive Amount (₹) *</Label>
              <Input
                type="number"
                value={manualIncentive.amount}
                onChange={(e) => setManualIncentive({...manualIncentive, amount: e.target.value})}
                placeholder="Enter amount"
                className="bg-slate-700 border-slate-600 text-white mt-1"
                min={0}
              />
            </div>
            
            <div>
              <Label className="text-slate-300">Month *</Label>
              <Select
                value={manualIncentive.month}
                onValueChange={(v) => setManualIncentive({...manualIncentive, month: v})}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  {getMonthOptions().map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-white">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-slate-300">Reason / Notes *</Label>
              <Input
                value={manualIncentive.reason}
                onChange={(e) => setManualIncentive({...manualIncentive, reason: e.target.value})}
                placeholder="e.g., Performance bonus, Special achievement, etc."
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-700">
              <p className="text-slate-400 text-sm">
                <strong className="text-white">Note:</strong> Manual incentives are added on top of auto-calculated incentives. They will appear in the employee's incentive summary and can be approved/paid like regular incentives.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManualIncentiveOpen(false)} className="text-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={handleAddManualIncentive}
              disabled={actionLoading || !manualIncentive.user_id || !manualIncentive.amount || !manualIncentive.reason}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Incentive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Incentive Dialog */}
      <Dialog open={editIncentiveOpen} onOpenChange={setEditIncentiveOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Incentive</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update incentive for {editingIncentive?.agent_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {editingIncentive && (
              <div className="bg-slate-800 p-3 rounded-lg">
                <p className="text-slate-400 text-sm">Current Amount</p>
                <p className="text-green-400 text-lg font-bold">{formatCurrency(editingIncentive.incentive_amount)}</p>
                {editingIncentive.source === 'manual' && (
                  <Badge className="mt-2 bg-purple-600">Manual Incentive</Badge>
                )}
              </div>
            )}
            
            <div>
              <Label className="text-slate-300">New Amount (₹) *</Label>
              <Input
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
                placeholder="Enter new amount"
                className="bg-slate-700 border-slate-600 text-white mt-1"
                min={0}
              />
            </div>
            
            <div>
              <Label className="text-slate-300">Reason / Notes</Label>
              <Input
                value={editForm.reason}
                onChange={(e) => setEditForm({...editForm, reason: e.target.value})}
                placeholder="Reason for incentive"
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditIncentiveOpen(false)} className="text-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateIncentive}
              disabled={actionLoading || !editForm.amount}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

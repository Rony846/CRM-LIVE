import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { 
  FileWarning, AlertTriangle, CheckCircle, Clock, Search, Building2,
  FileText, ShoppingCart, Truck, Package, Eye, Shield, AlertCircle,
  RotateCcw, Filter, X, Loader2, ExternalLink
} from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-600', icon: AlertCircle },
  important: { label: 'Important', color: 'bg-yellow-600', icon: AlertTriangle },
  minor: { label: 'Minor', color: 'bg-blue-600', icon: FileWarning }
};

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-red-600' },
  resolved: { label: 'Resolved', color: 'bg-green-600' },
  overridden: { label: 'Overridden', color: 'bg-purple-600' }
};

const TRANSACTION_TYPE_CONFIG = {
  purchase_entry: { label: 'Purchase', icon: ShoppingCart, color: 'bg-blue-600' },
  sales_invoice: { label: 'Sales Invoice', icon: FileText, color: 'bg-emerald-600' },
  dispatch: { label: 'Dispatch', icon: Truck, color: 'bg-orange-600' },
  stock_adjustment: { label: 'Stock Adjustment', icon: Package, color: 'bg-purple-600' },
  payment_received: { label: 'Payment Received', icon: FileText, color: 'bg-green-600' },
  payment_made: { label: 'Payment Made', icon: FileText, color: 'bg-amber-600' }
};

const AGE_BRACKETS = [
  { value: '0-3', label: '0-3 days', color: 'bg-green-600' },
  { value: '4-7', label: '4-7 days', color: 'bg-yellow-600' },
  { value: '8-15', label: '8-15 days', color: 'bg-orange-600' },
  { value: '15+', label: '15+ days', color: 'bg-red-600' }
];

export default function ComplianceDashboard() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exceptions, setExceptions] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [complianceScores, setComplianceScores] = useState([]);
  const [firms, setFirms] = useState([]);
  const [drafts, setDrafts] = useState([]);
  
  // Filters
  const [filterFirm, setFilterFirm] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('open');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterAge, setFilterAge] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog states
  const [selectedItem, setSelectedItem] = useState(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchAllData();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchExceptions();
    }
  }, [filterFirm, filterType, filterStatus, filterSeverity, filterAge]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [exceptionsRes, dashboardRes, scoresRes, firmsRes, draftsRes] = await Promise.all([
        axios.get(`${API}/compliance/exceptions`, { headers, params: { status: filterStatus } }),
        axios.get(`${API}/compliance/dashboard`, { headers }),
        axios.get(`${API}/compliance/score`, { headers }),
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        axios.get(`${API}/drafts`, { headers })
      ]);
      
      setExceptions(exceptionsRes.data || []);
      setDashboard(dashboardRes.data);
      setComplianceScores(scoresRes.data || []);
      setFirms(firmsRes.data || []);
      setDrafts(draftsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch compliance data:', error);
      toast.error('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchExceptions = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = {};
      if (filterFirm !== 'all') params.firm_id = filterFirm;
      if (filterType !== 'all') params.transaction_type = filterType;
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterSeverity !== 'all') params.severity = filterSeverity;
      if (filterAge !== 'all') params.age_bracket = filterAge;
      
      const response = await axios.get(`${API}/compliance/exceptions`, { headers, params });
      setExceptions(response.data || []);
    } catch (error) {
      console.error('Failed to fetch exceptions:', error);
    }
  };

  const handleOverride = async () => {
    if (!overrideReason.trim() || overrideReason.length < 20) {
      toast.error('Override reason must be at least 20 characters');
      return;
    }
    
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(
        `${API}/compliance/exceptions/${selectedItem.id}/override`,
        { reason: overrideReason },
        { headers, params: { override_reason: overrideReason } }
      );
      
      toast.success('Exception overridden successfully');
      setOverrideDialogOpen(false);
      setOverrideReason('');
      setSelectedItem(null);
      fetchExceptions();
      fetchAllData();
    } catch (error) {
      console.error('Override failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to override exception');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async (exceptionId) => {
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/compliance/exceptions/${exceptionId}/resolve`, {}, { headers });
      toast.success('Exception resolved');
      fetchExceptions();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resolve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalizeDraft = async (draft) => {
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(
        `${API}/drafts/${draft.transaction_type}/${draft.id}/finalize`,
        {},
        { headers }
      );
      toast.success(response.data.message || 'Draft finalized successfully');
      fetchAllData();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (typeof detail === 'object') {
        toast.error(detail.message || 'Finalization failed');
      } else {
        toast.error(detail || 'Failed to finalize draft');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const getTransactionLink = (type, id) => {
    const links = {
      purchase_entry: `/accountant/purchases`,
      sales_invoice: `/accountant/sales`,
      dispatch: `/accountant`,
      payment_received: `/accountant/payments`,
      payment_made: `/accountant/payments`
    };
    return links[type] || '/accountant';
  };

  const filteredExceptions = exceptions.filter(exc => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        exc.transaction_ref?.toLowerCase().includes(search) ||
        exc.issues?.some(i => i.toLowerCase().includes(search))
      );
    }
    return true;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <DashboardLayout title="Compliance Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Document Compliance Dashboard">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Open Exceptions</p>
                  <p className="text-3xl font-bold text-white">{dashboard?.total_open || 0}</p>
                </div>
                <div className="p-3 rounded-full bg-red-600/20">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Critical Issues</p>
                  <p className="text-3xl font-bold text-white">{dashboard?.by_severity?.critical || 0}</p>
                </div>
                <div className="p-3 rounded-full bg-red-600/20">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending Drafts</p>
                  <p className="text-3xl font-bold text-white">{drafts.length}</p>
                </div>
                <div className="p-3 rounded-full bg-yellow-600/20">
                  <Clock className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Overridden</p>
                  <p className="text-3xl font-bold text-white">{dashboard?.overridden_count || 0}</p>
                </div>
                <div className="p-3 rounded-full bg-purple-600/20">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Resolved Today</p>
                  <p className="text-3xl font-bold text-white">{dashboard?.resolved_today || 0}</p>
                </div>
                <div className="p-3 rounded-full bg-green-600/20">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compliance Score by Firm */}
        {complianceScores.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                Compliance Score by Firm
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {complianceScores.map((firm) => (
                  <div key={firm.firm_id} className="p-4 rounded-lg bg-slate-900 border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-300 font-medium">{firm.firm_name}</span>
                      <span className={`text-lg font-bold ${
                        firm.compliance_score >= 90 ? 'text-green-400' :
                        firm.compliance_score >= 70 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {firm.compliance_score}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          firm.compliance_score >= 90 ? 'bg-green-500' :
                          firm.compliance_score >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${firm.compliance_score}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      {firm.total_transactions} transactions, {firm.pending_count} pending
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="exceptions" className="space-y-4">
          <TabsList className="bg-slate-800">
            <TabsTrigger value="exceptions" data-testid="exceptions-tab">
              Exceptions ({filteredExceptions.length})
            </TabsTrigger>
            <TabsTrigger value="drafts" data-testid="drafts-tab">
              Pending Drafts ({drafts.length})
            </TabsTrigger>
            <TabsTrigger value="matrix" data-testid="matrix-tab">
              Compliance Matrix
            </TabsTrigger>
          </TabsList>

          {/* Exceptions Tab */}
          <TabsContent value="exceptions" className="space-y-4">
            {/* Filters */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">Firm</Label>
                    <Select value={filterFirm} onValueChange={setFilterFirm}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                        <SelectValue placeholder="All Firms" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="all">All Firms</SelectItem>
                        {firms.map(firm => (
                          <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-slate-400 text-xs">Type</Label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="all">All Types</SelectItem>
                        {Object.entries(TRANSACTION_TYPE_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-slate-400 text-xs">Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="overridden">Overridden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-slate-400 text-xs">Severity</Label>
                    <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                        <SelectValue placeholder="Severity" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="important">Important</SelectItem>
                        <SelectItem value="minor">Minor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-slate-400 text-xs">Age</Label>
                    <Select value={filterAge} onValueChange={setFilterAge}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                        <SelectValue placeholder="Age" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="all">All</SelectItem>
                        {AGE_BRACKETS.map(bracket => (
                          <SelectItem key={bracket.value} value={bracket.value}>{bracket.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-slate-400 text-xs">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Exceptions Table */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">Reference</TableHead>
                      <TableHead className="text-slate-400">Type</TableHead>
                      <TableHead className="text-slate-400">Firm</TableHead>
                      <TableHead className="text-slate-400">Issues</TableHead>
                      <TableHead className="text-slate-400">Severity</TableHead>
                      <TableHead className="text-slate-400">Age</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExceptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                          {filterStatus === 'open' ? 'No open exceptions - Great job!' : 'No exceptions found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredExceptions.map((exc) => {
                        const typeConfig = TRANSACTION_TYPE_CONFIG[exc.transaction_type] || {};
                        const TypeIcon = typeConfig.icon || FileText;
                        const severityConfig = SEVERITY_CONFIG[exc.severity] || {};
                        const SeverityIcon = severityConfig.icon || AlertTriangle;
                        const statusConfig = STATUS_CONFIG[exc.status] || {};
                        const ageBracket = AGE_BRACKETS.find(b => b.value === exc.age_bracket);
                        const firmName = firms.find(f => f.id === exc.firm_id)?.name || exc.firm_id;
                        
                        return (
                          <TableRow key={exc.id} className="border-slate-700" data-testid={`exception-row-${exc.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium">{exc.transaction_ref}</span>
                                <a 
                                  href={getTransactionLink(exc.transaction_type, exc.transaction_id)}
                                  className="text-cyan-400 hover:text-cyan-300"
                                  data-testid={`view-transaction-${exc.id}`}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${typeConfig.color} text-white`}>
                                <TypeIcon className="w-3 h-3 mr-1" />
                                {typeConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-300">{firmName}</TableCell>
                            <TableCell>
                              <div className="max-w-xs">
                                {exc.issues?.slice(0, 2).map((issue, i) => (
                                  <p key={i} className="text-sm text-slate-400 truncate">{issue}</p>
                                ))}
                                {exc.issues?.length > 2 && (
                                  <p className="text-xs text-slate-500">+{exc.issues.length - 2} more</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${severityConfig.color} text-white`}>
                                <SeverityIcon className="w-3 h-3 mr-1" />
                                {severityConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${ageBracket?.color || 'bg-slate-600'} text-white`}>
                                {ageBracket?.label || exc.age_bracket}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${statusConfig.color} text-white`}>
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {exc.status === 'open' && (
                                  <>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                      onClick={() => handleResolve(exc.id)}
                                      data-testid={`resolve-${exc.id}`}
                                    >
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      Resolve
                                    </Button>
                                    {user?.role === 'admin' && (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="border-purple-600 text-purple-400 hover:bg-purple-600/20"
                                        onClick={() => {
                                          setSelectedItem(exc);
                                          setOverrideDialogOpen(true);
                                        }}
                                        data-testid={`override-${exc.id}`}
                                      >
                                        <Shield className="w-4 h-4 mr-1" />
                                        Override
                                      </Button>
                                    )}
                                  </>
                                )}
                                {exc.status === 'overridden' && exc.override_reason && (
                                  <span className="text-xs text-purple-400" title={exc.override_reason}>
                                    By: {exc.override_by_name}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Drafts Tab */}
          <TabsContent value="drafts" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  Pending Draft Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {drafts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    No pending drafts
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">Reference</TableHead>
                        <TableHead className="text-slate-400">Type</TableHead>
                        <TableHead className="text-slate-400">Firm</TableHead>
                        <TableHead className="text-slate-400">Value</TableHead>
                        <TableHead className="text-slate-400">Doc Status</TableHead>
                        <TableHead className="text-slate-400">Compliance Score</TableHead>
                        <TableHead className="text-slate-400">Created</TableHead>
                        <TableHead className="text-slate-400">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drafts.map((draft) => {
                        const typeConfig = TRANSACTION_TYPE_CONFIG[draft.transaction_type] || {};
                        const TypeIcon = typeConfig.icon || FileText;
                        
                        return (
                          <TableRow key={draft.id} className="border-slate-700" data-testid={`draft-row-${draft.id}`}>
                            <TableCell className="text-white font-medium">
                              {draft.reference_number}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${typeConfig.color} text-white`}>
                                <TypeIcon className="w-3 h-3 mr-1" />
                                {typeConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-300">{draft.firm_name}</TableCell>
                            <TableCell className="text-white">{formatCurrency(draft.value)}</TableCell>
                            <TableCell>
                              <Badge className={draft.doc_status === 'complete' ? 'bg-green-600' : 'bg-yellow-600'}>
                                {draft.doc_status || 'pending'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={`font-medium ${
                                draft.compliance_score >= 90 ? 'text-green-400' :
                                draft.compliance_score >= 70 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {draft.compliance_score || 0}%
                              </span>
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {new Date(draft.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="sm"
                                className="bg-cyan-600 hover:bg-cyan-700"
                                onClick={() => handleFinalizeDraft(draft)}
                                disabled={actionLoading}
                                data-testid={`finalize-${draft.id}`}
                              >
                                {actionLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Finalize
                                  </>
                                )}
                              </Button>
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

          {/* Matrix Tab */}
          <TabsContent value="matrix" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Document Compliance Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-red-600" />
                      <span className="text-slate-400">Hard Block (Required)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-yellow-600" />
                      <span className="text-slate-400">Soft Block (Creates Exception)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-blue-600" />
                      <span className="text-slate-400">Warning (Optional)</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.entries(TRANSACTION_TYPE_CONFIG).map(([key, config]) => (
                      <div key={key} className="p-4 rounded-lg bg-slate-900 border border-slate-700">
                        <div className="flex items-center gap-2 mb-3">
                          <config.icon className={`w-5 h-5 text-cyan-400`} />
                          <h3 className="text-white font-medium">{config.label}</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p className="text-slate-400">Required fields with hard/soft blocking rules:</p>
                          <ul className="list-disc list-inside text-slate-300 space-y-1">
                            {key === 'purchase_entry' && (
                              <>
                                <li><span className="text-red-400">Supplier Invoice Copy</span> (Hard)</li>
                                <li><span className="text-red-400">Supplier Name, GSTIN, Invoice #</span> (Hard)</li>
                                <li><span className="text-red-400">Item Lines with GST</span> (Hard)</li>
                              </>
                            )}
                            {key === 'sales_invoice' && (
                              <>
                                <li><span className="text-red-400">Linked Dispatch</span> (Hard)</li>
                                <li><span className="text-red-400">Party, Invoice #, Date</span> (Hard)</li>
                                <li><span className="text-red-400">Taxable Value, GST Breakup</span> (Hard)</li>
                              </>
                            )}
                            {key === 'dispatch' && (
                              <>
                                <li><span className="text-red-400">Firm, Item, Quantity</span> (Hard)</li>
                                <li><span className="text-yellow-400">Tracking ID / Label</span> (Soft)</li>
                                <li><span className="text-blue-400">Packing Slip</span> (Optional)</li>
                              </>
                            )}
                            {key === 'stock_adjustment' && (
                              <>
                                <li><span className="text-red-400">Reason (Mandatory)</span> (Hard)</li>
                                <li><span className="text-red-400">Firm, Item, Quantity, User</span> (Hard)</li>
                                <li><span className="text-yellow-400">Document (if &gt; 50K)</span> (Threshold)</li>
                              </>
                            )}
                            {key === 'payment_received' && (
                              <>
                                <li><span className="text-red-400">Party, Amount, Date, Mode</span> (Hard)</li>
                                <li><span className="text-yellow-400">Reference #, Linked Invoice</span> (Soft)</li>
                                <li><span className="text-blue-400">Bank Proof</span> (Optional)</li>
                              </>
                            )}
                            {key === 'payment_made' && (
                              <>
                                <li><span className="text-red-400">Party, Amount, Date, Mode</span> (Hard)</li>
                                <li><span className="text-yellow-400">Reference #, Linked Invoice</span> (Soft)</li>
                                <li><span className="text-blue-400">Payment Proof</span> (Optional)</li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              Override Compliance Exception
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedItem && (
              <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                <p className="text-slate-400 text-sm">Transaction Reference</p>
                <p className="text-white font-medium">{selectedItem.transaction_ref}</p>
                
                <p className="text-slate-400 text-sm mt-3">Issues</p>
                <ul className="list-disc list-inside text-red-400 text-sm">
                  {selectedItem.issues?.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div>
              <Label className="text-slate-300">Override Reason (min 20 characters)</Label>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why this exception is being overridden..."
                className="bg-slate-800 border-slate-700 text-white mt-1"
                rows={4}
              />
              <p className="text-xs text-slate-500 mt-1">{overrideReason.length}/20 characters</p>
            </div>
            
            <div className="p-3 rounded bg-yellow-900/30 border border-yellow-700">
              <p className="text-yellow-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                This action will be logged in the audit trail. Override should only be used when there is a valid business reason.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setOverrideDialogOpen(false);
                setOverrideReason('');
              }}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleOverride}
              disabled={actionLoading || overrideReason.length < 20}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              Confirm Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

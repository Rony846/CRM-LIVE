import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import { 
  Upload, FileSpreadsheet, Building2, Calendar, Loader2, Download,
  CheckCircle, XCircle, AlertCircle, Link, Plus, Eye, RefreshCw
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function BankReconciliation() {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statements, setStatements] = useState([]);
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  
  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    firmId: '',
    bankName: 'IDFC',
    file: null
  });

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('mg_token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getHeaders();
      
      const [stmtRes, firmsRes] = await Promise.all([
        axios.get(`${API}/api/bank-statements${selectedFirm !== 'all' ? `?firm_id=${selectedFirm}` : ''}`, { headers }),
        axios.get(`${API}/api/firms`, { headers })
      ]);
      
      setStatements(stmtRes.data || []);
      setFirms(firmsRes.data || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, selectedFirm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileUpload = async () => {
    if (!uploadForm.file || !uploadForm.firmId || !uploadForm.bankName) {
      toast.error('Please fill all fields and select a file');
      return;
    }

    try {
      setUploading(true);
      const headers = getHeaders();
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('firm_id', uploadForm.firmId);
      formData.append('bank_name', uploadForm.bankName);

      const res = await axios.post(`${API}/api/bank-statements/upload`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });

      toast.success(`Statement uploaded! Found ${res.data.total_transactions} transactions`);
      setShowUploadDialog(false);
      setUploadForm({ firmId: '', bankName: 'IDFC', file: null });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAutoMatch = async (statementId) => {
    try {
      const headers = getHeaders();
      const res = await axios.post(`${API}/api/bank-statements/${statementId}/auto-match`, {}, { headers });
      toast.success(`Auto-matched ${res.data.matched} transactions`);
      fetchData();
      // Refresh selected statement if viewing
      if (selectedStatement?.id === statementId) {
        const stmtRes = await axios.get(`${API}/api/bank-statements/${statementId}`, { headers });
        setSelectedStatement(stmtRes.data);
      }
    } catch (error) {
      toast.error('Auto-match failed');
    }
  };

  const viewStatement = async (statement) => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`${API}/api/bank-statements/${statement.id}`, { headers });
      setSelectedStatement(res.data);
      setShowDetailDialog(true);
    } catch (error) {
      toast.error('Failed to load statement details');
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      'export_payment': 'bg-purple-600',
      'customs_duty': 'bg-red-600',
      'courier': 'bg-orange-600',
      'marketplace_settlement': 'bg-green-600',
      'salary': 'bg-blue-600',
      'bank_charges': 'bg-slate-600',
      'gst_payment': 'bg-amber-600',
      'supplier_payment': 'bg-cyan-600',
      'sales_receipt': 'bg-emerald-600',
      'other': 'bg-gray-600'
    };
    return colors[category] || 'bg-gray-600';
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Bank Statement Reconciliation</h1>
            <p className="text-slate-400">Upload IDFC/HDFC statements and reconcile with CRM entries</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={selectedFirm} onValueChange={setSelectedFirm}>
              <SelectTrigger className="w-[200px] bg-slate-800 border-slate-700">
                <SelectValue placeholder="All Firms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Firms</SelectItem>
                {firms.map(firm => (
                  <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowUploadDialog(true)} className="bg-cyan-600 hover:bg-cyan-700">
              <Upload className="w-4 h-4 mr-2" /> Upload Statement
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Statements</p>
                  <p className="text-2xl font-bold text-white">{statements.length}</p>
                </div>
                <FileSpreadsheet className="w-8 h-8 text-cyan-400/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Transactions</p>
                  <p className="text-2xl font-bold text-cyan-400">
                    {statements.reduce((sum, s) => sum + (s.total_transactions || 0), 0)}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-cyan-400/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Matched</p>
                  <p className="text-2xl font-bold text-green-400">
                    {statements.reduce((sum, s) => sum + (s.reconciliation_summary?.matched || 0), 0)}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Unmatched</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {statements.reduce((sum, s) => sum + (s.reconciliation_summary?.unmatched || 0), 0)}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-400/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statements List */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
              Uploaded Statements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Bank</TableHead>
                    <TableHead className="text-slate-400">Firm</TableHead>
                    <TableHead className="text-slate-400">Period</TableHead>
                    <TableHead className="text-slate-400 text-right">Transactions</TableHead>
                    <TableHead className="text-slate-400 text-right">Debits</TableHead>
                    <TableHead className="text-slate-400 text-right">Credits</TableHead>
                    <TableHead className="text-slate-400">Reconciliation</TableHead>
                    <TableHead className="text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statements.map(stmt => (
                    <TableRow key={stmt.id} className="border-slate-700 hover:bg-slate-700/50">
                      <TableCell>
                        <Badge className={stmt.bank_name === 'IDFC' ? 'bg-purple-600' : 'bg-red-600'}>
                          {stmt.bank_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white">{stmt.firm_name}</TableCell>
                      <TableCell className="text-slate-300 text-sm">
                        {stmt.period_from} to {stmt.period_to}
                      </TableCell>
                      <TableCell className="text-right text-cyan-400 font-medium">
                        {stmt.total_transactions}
                      </TableCell>
                      <TableCell className="text-right text-red-400">
                        {formatCurrency(stmt.total_debits)}
                      </TableCell>
                      <TableCell className="text-right text-green-400">
                        {formatCurrency(stmt.total_credits)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600">{stmt.reconciliation_summary?.matched || 0} ✓</Badge>
                          <Badge className="bg-yellow-600">{stmt.reconciliation_summary?.unmatched || 0} ?</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => viewStatement(stmt)} title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleAutoMatch(stmt.id)} title="Auto Match" className="text-cyan-400">
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {statements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                        No statements uploaded yet. Click "Upload Statement" to add one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-cyan-400" />
              Upload Bank Statement
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Upload an Excel statement from IDFC or HDFC bank
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Firm *</Label>
              <Select value={uploadForm.firmId} onValueChange={v => setUploadForm(p => ({ ...p, firmId: v }))}>
                <SelectTrigger className="bg-slate-700 border-slate-600">
                  <SelectValue placeholder="Select firm" />
                </SelectTrigger>
                <SelectContent>
                  {firms.map(firm => (
                    <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bank *</Label>
              <Select value={uploadForm.bankName} onValueChange={v => setUploadForm(p => ({ ...p, bankName: v }))}>
                <SelectTrigger className="bg-slate-700 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDFC">IDFC First Bank</SelectItem>
                  <SelectItem value="HDFC">HDFC Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Statement File (Excel) *</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={e => setUploadForm(p => ({ ...p, file: e.target.files[0] }))}
                className="bg-slate-700 border-slate-600"
              />
              <p className="text-xs text-slate-500">Supports .xlsx and .xls files</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={handleFileUpload} disabled={uploading} className="bg-cyan-600 hover:bg-cyan-700">
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload & Parse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Statement Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
              {selectedStatement?.bank_name} Statement - {selectedStatement?.firm_name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Period: {selectedStatement?.period_from} to {selectedStatement?.period_to} | 
              {selectedStatement?.total_transactions} transactions
            </DialogDescription>
          </DialogHeader>

          {selectedStatement && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-5 gap-2">
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-400">Total Debits</p>
                    <p className="font-bold text-red-400">{formatCurrency(selectedStatement.total_debits)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-400">Total Credits</p>
                    <p className="font-bold text-green-400">{formatCurrency(selectedStatement.total_credits)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-400">Matched</p>
                    <p className="font-bold text-green-400">{selectedStatement.reconciliation_summary?.matched || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-400">Created</p>
                    <p className="font-bold text-blue-400">{selectedStatement.reconciliation_summary?.created || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-400">Unmatched</p>
                    <p className="font-bold text-yellow-400">{selectedStatement.reconciliation_summary?.unmatched || 0}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Transactions Table */}
              <div className="max-h-[50vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-600 bg-slate-700">
                      <TableHead className="text-white">Date</TableHead>
                      <TableHead className="text-white">Description</TableHead>
                      <TableHead className="text-white">Category</TableHead>
                      <TableHead className="text-white text-right">Debit</TableHead>
                      <TableHead className="text-white text-right">Credit</TableHead>
                      <TableHead className="text-white text-right">Balance</TableHead>
                      <TableHead className="text-white">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedStatement.transactions?.slice(0, 100).map((txn, idx) => (
                      <TableRow key={idx} className="border-slate-700 hover:bg-slate-700/50">
                        <TableCell className="text-slate-300 whitespace-nowrap">{txn.transaction_date}</TableCell>
                        <TableCell className="text-white max-w-xs truncate" title={txn.description}>
                          {txn.description?.substring(0, 50)}...
                        </TableCell>
                        <TableCell>
                          <Badge className={getCategoryColor(txn.category)} data-testid={`category-${idx}`}>
                            {txn.category?.replace('_', ' ') || 'other'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-red-400">
                          {txn.debit > 0 ? formatCurrency(txn.debit) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-green-400">
                          {txn.credit > 0 ? formatCurrency(txn.credit) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-slate-300">
                          {txn.balance ? formatCurrency(txn.balance) : '-'}
                        </TableCell>
                        <TableCell>
                          {txn.status === 'matched' && (
                            <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Matched</Badge>
                          )}
                          {txn.status === 'created' && (
                            <Badge className="bg-blue-600"><Plus className="w-3 h-3 mr-1" />Created</Badge>
                          )}
                          {txn.status === 'unmatched' && (
                            <Badge className="bg-yellow-600"><AlertCircle className="w-3 h-3 mr-1" />Unmatched</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {selectedStatement.transactions?.length > 100 && (
                  <p className="text-center text-slate-400 py-2">
                    Showing first 100 of {selectedStatement.transactions.length} transactions
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => handleAutoMatch(selectedStatement?.id)} className="bg-cyan-600 hover:bg-cyan-700">
              <RefreshCw className="w-4 h-4 mr-2" /> Auto Match
            </Button>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)} className="border-slate-600">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

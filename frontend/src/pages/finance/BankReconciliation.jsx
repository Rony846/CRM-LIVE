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

// Category badge color map using theme tokens
const getCategoryTone = (category) => {
  const map = {
    'export_payment':        'bg-violet-400/15 text-violet-400 ring-violet-400/25',
    'customs_duty':          'bg-rose-500/15 text-rose-400 ring-rose-500/25',
    'courier':               'bg-amber-400/15 text-amber-400 ring-amber-400/25',
    'marketplace_settlement':'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25',
    'salary':                'bg-primary/15 text-primary ring-primary/25',
    'bank_charges':          'bg-muted text-muted-foreground ring-border',
    'gst_payment':           'bg-yellow-400/15 text-yellow-400 ring-yellow-400/25',
    'supplier_payment':      'bg-sky-400/15 text-sky-400 ring-sky-400/25',
    'sales_receipt':         'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25',
    'other':                 'bg-muted text-muted-foreground ring-border',
  };
  return map[category] || 'bg-muted text-muted-foreground ring-border';
};

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
};

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

  // Aggregate stats
  const totalMatched = statements.reduce((sum, s) => sum + (s.reconciliation_summary?.matched || 0), 0);
  const totalUnmatched = statements.reduce((sum, s) => sum + (s.reconciliation_summary?.unmatched || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
              Finance / Bank Recon
            </p>
            <h1 className="text-2xl font-bold text-foreground">Bank Statement Reconciliation</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Upload IDFC/HDFC statements and reconcile with CRM entries</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={selectedFirm} onValueChange={setSelectedFirm}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Firms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Firms</SelectItem>
                {firms.map(firm => (
                  <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => setShowUploadDialog(true)}
              className="bg-primary text-primary-foreground font-mono text-[11px] uppercase tracking-wide"
            >
              <Upload className="w-4 h-4 mr-2" /> Upload Statement
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total Statements</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">{statements.length}</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-primary/15 text-primary">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total Transactions</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">
                  {statements.reduce((sum, s) => sum + (s.total_transactions || 0), 0)}
                </p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-sky-400/15 text-sky-400">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Matched</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-emerald-500">{totalMatched}</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-emerald-500/15 text-emerald-500">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Unmatched</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-amber-400">{totalUnmatched}</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-amber-400/15 text-amber-400">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Statements List */}
        <Card className="mg-card border border-border bg-card rounded-lg">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2 font-mono uppercase tracking-wide text-[13px]">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Uploaded Statements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table cards>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Bank</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Firm</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Period</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide text-right">Transactions</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide text-right">Debits</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide text-right">Credits</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Reconciliation</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statements.map(stmt => (
                    <TableRow key={stmt.id} className="border-border hover:bg-muted/40">
                      <TableCell>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${
                          stmt.bank_name === 'IDFC'
                            ? 'bg-violet-400/15 text-violet-400 ring-violet-400/25'
                            : 'bg-rose-500/15 text-rose-400 ring-rose-500/25'
                        }`}>
                          {stmt.bank_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-foreground font-medium">{stmt.firm_name}</TableCell>
                      <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                        {stmt.period_from} to {stmt.period_to}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-foreground font-medium">
                        {stmt.total_transactions}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-rose-400">
                        {formatCurrency(stmt.total_debits)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-emerald-500">
                        {formatCurrency(stmt.total_credits)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25">
                            {stmt.reconciliation_summary?.matched || 0} matched
                          </span>
                          <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25">
                            {stmt.reconciliation_summary?.unmatched || 0} ?
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewStatement(stmt)}
                            title="View Details"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAutoMatch(stmt.id)}
                            title="Auto Match"
                            className="text-primary hover:text-primary/80"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {statements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground font-mono text-[11px] uppercase tracking-wide">
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
        <DialogContent className="bg-popover border border-border rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Upload className="w-5 h-5 text-primary" />
              Upload Bank Statement
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Upload an Excel statement from IDFC or HDFC bank
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Firm *</Label>
              <Select value={uploadForm.firmId} onValueChange={v => setUploadForm(p => ({ ...p, firmId: v }))}>
                <SelectTrigger>
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
                <SelectTrigger>
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
              />
              <p className="font-mono text-[11px] text-muted-foreground">Supports .xlsx and .xls files</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} className="border-border">
              Cancel
            </Button>
            <Button
              onClick={handleFileUpload}
              disabled={uploading}
              className="bg-primary text-primary-foreground font-mono text-[11px] uppercase tracking-wide"
            >
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload &amp; Parse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Statement Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="bg-popover border border-border rounded-lg max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              {selectedStatement?.bank_name} Statement &mdash; {selectedStatement?.firm_name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-mono text-[11px]">
              Period: {selectedStatement?.period_from} to {selectedStatement?.period_to} &bull;{' '}
              {selectedStatement?.total_transactions} transactions
            </DialogDescription>
          </DialogHeader>

          {selectedStatement && (
            <div className="space-y-4">
              {/* Summary mini-cards */}
              <div className="grid grid-cols-5 gap-2">
                <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.07] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Total Debits</p>
                  <p className="font-mono font-bold tabular-nums text-rose-400 mt-1">{formatCurrency(selectedStatement.total_debits)}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Total Credits</p>
                  <p className="font-mono font-bold tabular-nums text-emerald-500 mt-1">{formatCurrency(selectedStatement.total_credits)}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Matched</p>
                  <p className="font-mono font-bold tabular-nums text-emerald-500 mt-1">{selectedStatement.reconciliation_summary?.matched || 0}</p>
                </div>
                <div className="rounded-lg border border-primary/25 bg-primary/[0.07] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Created</p>
                  <p className="font-mono font-bold tabular-nums text-primary mt-1">{selectedStatement.reconciliation_summary?.created || 0}</p>
                </div>
                <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.07] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Unmatched</p>
                  <p className="font-mono font-bold tabular-nums text-amber-400 mt-1">{selectedStatement.reconciliation_summary?.unmatched || 0}</p>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border">
                <Table cards>
                  <TableHeader>
                    <TableRow className="border-border bg-muted">
                      <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Date</TableHead>
                      <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Description</TableHead>
                      <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Category</TableHead>
                      <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide text-right">Debit</TableHead>
                      <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide text-right">Credit</TableHead>
                      <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide text-right">Balance</TableHead>
                      <TableHead className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedStatement.transactions?.slice(0, 100).map((txn, idx) => (
                      <TableRow key={idx} className="border-border hover:bg-muted/40">
                        <TableCell className="font-mono text-sm tabular-nums text-muted-foreground whitespace-nowrap">{txn.transaction_date}</TableCell>
                        <TableCell className="text-foreground max-w-xs truncate text-sm" title={txn.description}>
                          {txn.description?.substring(0, 50)}...
                        </TableCell>
                        <TableCell>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${getCategoryTone(txn.category)}`}
                            data-testid={`category-${idx}`}
                          >
                            {txn.category?.replace('_', ' ') || 'other'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-rose-400">
                          {txn.debit > 0 ? formatCurrency(txn.debit) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-emerald-500">
                          {txn.credit > 0 ? formatCurrency(txn.credit) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {txn.balance ? formatCurrency(txn.balance) : '-'}
                        </TableCell>
                        <TableCell>
                          {txn.status === 'matched' && (
                            <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25 inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />Matched
                            </span>
                          )}
                          {txn.status === 'created' && (
                            <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-primary/15 text-primary ring-1 ring-primary/25 inline-flex items-center gap-1">
                              <Plus className="w-3 h-3" />Created
                            </span>
                          )}
                          {txn.status === 'unmatched' && (
                            <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25 inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />Unmatched
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {selectedStatement.transactions?.length > 100 && (
                  <p className="text-center font-mono text-[11px] text-muted-foreground py-3 border-t border-border">
                    Showing first 100 of {selectedStatement.transactions.length} transactions
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => handleAutoMatch(selectedStatement?.id)}
              className="bg-primary text-primary-foreground font-mono text-[11px] uppercase tracking-wide"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Auto Match
            </Button>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)} className="border-border font-mono text-[11px] uppercase tracking-wide">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

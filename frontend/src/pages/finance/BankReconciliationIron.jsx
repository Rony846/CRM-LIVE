import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, Calendar, Loader2,
  CheckCircle, AlertCircle, Plus, Eye, RefreshCw
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const API = process.env.REACT_APP_BACKEND_URL;

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

// Category -> Iron pill tone (mirror of legacy color map, collapsed to Iron tones).
const categoryTone = (category) => {
  const map = {
    export_payment: 'violet',
    customs_duty: 'bad',
    courier: 'warn',
    marketplace_settlement: 'ok',
    salary: 'bad',
    bank_charges: 'slate',
    gst_payment: 'warn',
    supplier_payment: 'info',
    sales_receipt: 'ok',
    other: 'slate',
  };
  return map[category] || 'slate';
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
  const totalTransactions = statements.reduce((sum, s) => sum + (s.total_transactions || 0), 0);

  const statCards = [
    { label: 'Total Statements', value: statements.length, icon: FileSpreadsheet, tone: T.orange, color: T.iron900 },
    { label: 'Total Transactions', value: totalTransactions, icon: Calendar, tone: T.blue, color: T.iron900 },
    { label: 'Matched', value: totalMatched, icon: CheckCircle, tone: T.green, color: T.green },
    { label: 'Unmatched', value: totalUnmatched, icon: AlertCircle, tone: T.voltageText, color: T.voltageText },
  ];

  const headerRight = (
    <>
      <Select value={selectedFirm} onValueChange={setSelectedFirm}>
        <SelectTrigger className="w-[180px] h-[34px] text-xs">
          <SelectValue placeholder="All Firms" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Firms</SelectItem>
          {firms.map(firm => (
            <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        onClick={() => setShowUploadDialog(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
      >
        <Upload size={14} strokeWidth={2} /> Upload Statement
      </button>
    </>
  );

  const tableHeaders = ['BANK', 'FIRM', 'PERIOD', 'TRANSACTIONS', 'DEBITS', 'CREDITS', 'RECONCILIATION', ''];

  const rowActionStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };
  const rowMatchStyle = { ...rowActionStyle, border: `1px solid ${T.orange}`, color: T.orangeDeep };

  return (
    <IronShell
      title="Bank Reconciliation"
      subtitle="FINANCE / BANK RECON · IDFC + HDFC"
      onRefresh={fetchData}
      headerRight={headerRight}
    >
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <IronCard key={s.label} pad={14}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0 }}>
                  <Caps size={9} color={T.iron400}>{s.label}</Caps>
                  <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1, marginTop: 8 }}>{s.value.toLocaleString('en-IN')}</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                  <Icon size={19} color={s.tone} strokeWidth={1.9} />
                </div>
              </div>
            </IronCard>
          );
        })}
      </div>

      {/* Statements list */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          <FileSpreadsheet size={16} color={T.orange} strokeWidth={2} />
          <Caps size={10.5} color={T.iron700}>Uploaded Statements</Caps>
        </div>

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '60px 0' }}>
            <Loader2 className="animate-spin" size={30} color={T.iron400} />
          </div>
        ) : statements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <FileSpreadsheet size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No statements uploaded yet</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Click "Upload Statement" to add one.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {tableHeaders.map((h, i) => (
                    <th key={i} style={{ ...thCell, textAlign: (i >= 3 && i <= 5) ? 'right' : (i === tableHeaders.length - 1 ? 'right' : 'left') }}>
                      <Caps size={8.5}>{h}</Caps>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statements.map((stmt) => (
                  <tr key={stmt.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={tdCell}>
                      <span style={badgeStyle(stmt.bank_name === 'IDFC' ? 'violet' : 'bad')}>{stmt.bank_name}</span>
                    </td>
                    <td style={{ ...tdCell, fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{stmt.firm_name}</td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron500 }}>
                      {stmt.period_from} to {stmt.period_to}
                    </td>
                    <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.iron900 }}>
                      {stmt.total_transactions}
                    </td>
                    <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.rose }}>
                      {formatCurrency(stmt.total_debits)}
                    </td>
                    <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.green }}>
                      {formatCurrency(stmt.total_credits)}
                    </td>
                    <td style={tdCell}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={badgeStyle('ok')}>{stmt.reconciliation_summary?.matched || 0} matched</span>
                        <span style={badgeStyle('warn')}>{stmt.reconciliation_summary?.unmatched || 0} ?</span>
                      </div>
                    </td>
                    <td style={{ ...tdCell, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => viewStatement(stmt)} title="View Details" style={rowActionStyle}><Eye size={13} /></button>
                        <button onClick={() => handleAutoMatch(stmt.id)} title="Auto Match" style={rowMatchStyle}><RefreshCw size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </IronCard>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" style={{ color: T.orange }} />
              Upload Bank Statement
            </DialogTitle>
            <DialogDescription>
              Upload an Excel statement from IDFC or HDFC bank
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
              <p style={{ ...mono, fontSize: 11, color: T.iron400 }}>Supports .xlsx and .xls files</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleFileUpload} disabled={uploading} style={{ background: T.orange, color: '#fff' }}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload &amp; Parse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Statement Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" style={{ color: T.orange }} />
              {selectedStatement?.bank_name} Statement &mdash; {selectedStatement?.firm_name}
            </DialogTitle>
            <DialogDescription style={{ fontFamily: T.mono, fontSize: 11 }}>
              Period: {selectedStatement?.period_from} to {selectedStatement?.period_to} &bull;{' '}
              {selectedStatement?.total_transactions} transactions
            </DialogDescription>
          </DialogHeader>

          {selectedStatement && (
            <div className="space-y-4">
              {/* Summary mini-cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                <div style={{ borderRadius: 8, border: `1px solid ${T.iron200}`, background: T.iron50, padding: 12 }}>
                  <Caps size={9} color={T.iron400}>Total Debits</Caps>
                  <div style={{ ...mono, fontWeight: 700, color: T.rose, marginTop: 4 }}>{formatCurrency(selectedStatement.total_debits)}</div>
                </div>
                <div style={{ borderRadius: 8, border: `1px solid ${T.iron200}`, background: T.iron50, padding: 12 }}>
                  <Caps size={9} color={T.iron400}>Total Credits</Caps>
                  <div style={{ ...mono, fontWeight: 700, color: T.green, marginTop: 4 }}>{formatCurrency(selectedStatement.total_credits)}</div>
                </div>
                <div style={{ borderRadius: 8, border: `1px solid ${T.iron200}`, background: T.iron50, padding: 12 }}>
                  <Caps size={9} color={T.iron400}>Matched</Caps>
                  <div style={{ ...mono, fontWeight: 700, color: T.green, marginTop: 4 }}>{selectedStatement.reconciliation_summary?.matched || 0}</div>
                </div>
                <div style={{ borderRadius: 8, border: `1px solid ${T.iron200}`, background: T.iron50, padding: 12 }}>
                  <Caps size={9} color={T.iron400}>Created</Caps>
                  <div style={{ ...mono, fontWeight: 700, color: T.orangeDeep, marginTop: 4 }}>{selectedStatement.reconciliation_summary?.created || 0}</div>
                </div>
                <div style={{ borderRadius: 8, border: `1px solid ${T.iron200}`, background: T.iron50, padding: 12 }}>
                  <Caps size={9} color={T.iron400}>Unmatched</Caps>
                  <div style={{ ...mono, fontWeight: 700, color: T.voltageText, marginTop: 4 }}>{selectedStatement.reconciliation_summary?.unmatched || 0}</div>
                </div>
              </div>

              {/* Transactions Table */}
              <div style={{ maxHeight: '50vh', overflowY: 'auto', borderRadius: 8, border: `1px solid ${T.iron200}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50, position: 'sticky', top: 0 }}>
                      <th style={thCell}><Caps size={8.5}>Date</Caps></th>
                      <th style={thCell}><Caps size={8.5}>Description</Caps></th>
                      <th style={thCell}><Caps size={8.5}>Category</Caps></th>
                      <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Debit</Caps></th>
                      <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Credit</Caps></th>
                      <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Balance</Caps></th>
                      <th style={thCell}><Caps size={8.5}>Status</Caps></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStatement.transactions?.slice(0, 100).map((txn, idx) => (
                      <tr key={idx} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron500, whiteSpace: 'nowrap' }}>{txn.transaction_date}</td>
                        <td style={{ ...tdCell, maxWidth: 260, fontSize: 12, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis' }} title={txn.description}>
                          {txn.description?.substring(0, 50)}...
                        </td>
                        <td style={tdCell}>
                          <span style={badgeStyle(categoryTone(txn.category))} data-testid={`category-${idx}`}>
                            {txn.category?.replace('_', ' ') || 'other'}
                          </span>
                        </td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.rose }}>
                          {txn.debit > 0 ? formatCurrency(txn.debit) : '-'}
                        </td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.green }}>
                          {txn.credit > 0 ? formatCurrency(txn.credit) : '-'}
                        </td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron500 }}>
                          {txn.balance ? formatCurrency(txn.balance) : '-'}
                        </td>
                        <td style={tdCell}>
                          {txn.status === 'matched' && (
                            <span style={{ ...badgeStyle('ok'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle size={11} />Matched
                            </span>
                          )}
                          {txn.status === 'created' && (
                            <span style={{ ...badgeStyle('bad'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Plus size={11} />Created
                            </span>
                          )}
                          {txn.status === 'unmatched' && (
                            <span style={{ ...badgeStyle('warn'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <AlertCircle size={11} />Unmatched
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedStatement.transactions?.length > 100 && (
                  <p style={{ textAlign: 'center', fontFamily: T.mono, fontSize: 11, color: T.iron400, padding: 12, borderTop: `1px solid ${T.iron200}` }}>
                    Showing first 100 of {selectedStatement.transactions.length} transactions
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => handleAutoMatch(selectedStatement?.id)} style={{ background: T.orange, color: '#fff' }}>
              <RefreshCw className="w-4 h-4 mr-2" /> Auto Match
            </Button>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

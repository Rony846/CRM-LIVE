import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  FileWarning, AlertTriangle, CheckCircle, Clock, Search, Building2,
  FileText, ShoppingCart, Truck, Package, Shield, AlertCircle,
  Loader2, ExternalLink
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

// Maps mirrored from the legacy dashboard -> Iron pill tones.
const SEVERITY_CONFIG = {
  critical: { label: 'Critical', tone: 'bad', icon: AlertCircle },
  important: { label: 'Important', tone: 'warn', icon: AlertTriangle },
  minor: { label: 'Minor', tone: 'info', icon: FileWarning }
};

const STATUS_CONFIG = {
  open: { label: 'Open', tone: 'bad' },
  resolved: { label: 'Resolved', tone: 'ok' },
  overridden: { label: 'Overridden', tone: 'violet' }
};

const TRANSACTION_TYPE_CONFIG = {
  purchase_entry: { label: 'Purchase', icon: ShoppingCart, tone: 'info' },
  sales_invoice: { label: 'Sales Invoice', icon: FileText, tone: 'ok' },
  dispatch: { label: 'Dispatch', icon: Truck, tone: 'bad' },
  stock_adjustment: { label: 'Stock Adjustment', icon: Package, tone: 'violet' },
  payment_received: { label: 'Payment Received', icon: FileText, tone: 'ok' },
  payment_made: { label: 'Payment Made', icon: FileText, tone: 'warn' }
};

const AGE_BRACKETS = [
  { value: '0-3', label: '0-3 days', tone: 'ok' },
  { value: '4-7', label: '4-7 days', tone: 'warn' },
  { value: '8-15', label: '8-15 days', tone: 'bad' },
  { value: '15+', label: '15+ days', tone: 'bad' }
];

const scoreColor = (s) => (s >= 90 ? T.green : s >= 70 ? T.voltageText : T.orangeDeep);

export default function ComplianceDashboard() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exceptions, setExceptions] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [complianceScores, setComplianceScores] = useState([]);
  const [firms, setFirms] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [allEntries, setAllEntries] = useState({ entries: [], summary: {} });

  const [activeTab, setActiveTab] = useState('all-entries');

  // Filters
  const [filterFirm, setFilterFirm] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('open');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterAge, setFilterAge] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // All entries filter
  const [entriesFilterFirm, setEntriesFilterFirm] = useState('all');
  const [entriesFilterType, setEntriesFilterType] = useState('all');
  const [entriesFilterDocStatus, setEntriesFilterDocStatus] = useState('all');

  // Dialog states
  const [selectedItem, setSelectedItem] = useState(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchExceptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFirm, filterType, filterStatus, filterSeverity, filterAge]);

  useEffect(() => {
    if (token) {
      fetchAllEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesFilterFirm, entriesFilterType, entriesFilterDocStatus]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [exceptionsRes, dashboardRes, scoresRes, firmsRes, draftsRes, entriesRes] = await Promise.all([
        axios.get(`${API}/compliance/exceptions`, { headers, params: { status: filterStatus } }),
        axios.get(`${API}/compliance/dashboard`, { headers }),
        axios.get(`${API}/compliance/score`, { headers }),
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        axios.get(`${API}/drafts`, { headers }),
        axios.get(`${API}/compliance/all-entries`, { headers, params: { limit: 100 } })
      ]);

      setExceptions(exceptionsRes.data || []);
      setDashboard(dashboardRes.data);
      setComplianceScores(scoresRes.data || []);
      setFirms(firmsRes.data || []);
      setDrafts(draftsRes.data || []);
      setAllEntries(entriesRes.data || { entries: [], summary: {} });
    } catch (error) {
      console.error('Failed to fetch compliance data:', error);
      toast.error('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllEntries = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = { limit: 100 };
      if (entriesFilterFirm !== 'all') params.firm_id = entriesFilterFirm;
      if (entriesFilterType !== 'all') params.entry_type = entriesFilterType;
      if (entriesFilterDocStatus !== 'all') params.doc_status = entriesFilterDocStatus;

      const response = await axios.get(`${API}/compliance/all-entries`, { headers, params });
      setAllEntries(response.data || { entries: [], summary: {} });
    } catch (error) {
      console.error('Failed to fetch entries:', error);
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

  const statCards = [
    { label: 'Open Exceptions', value: dashboard?.total_open || 0, icon: AlertTriangle, tone: T.orangeDeep },
    { label: 'Critical Issues', value: dashboard?.by_severity?.critical || 0, icon: AlertCircle, tone: T.orangeDeep },
    { label: 'Pending Drafts', value: drafts.length, icon: Clock, tone: T.voltageText },
    { label: 'Overridden', value: dashboard?.overridden_count || 0, icon: Shield, tone: '#6D4AB0' },
    { label: 'Resolved Today', value: dashboard?.resolved_today || 0, icon: CheckCircle, tone: T.green },
  ];

  const tabs = [
    { key: 'all-entries', label: `All Entries (${allEntries.entries?.length || 0})`, testid: 'all-entries-tab' },
    { key: 'exceptions', label: `Exceptions (${filteredExceptions.length})`, testid: 'exceptions-tab' },
    { key: 'drafts', label: `Pending Drafts (${drafts.length})`, testid: 'drafts-tab' },
    { key: 'matrix', label: 'Compliance Matrix', testid: 'matrix-tab' },
  ];

  const sectionTitle = (Icon, text) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
      <Icon size={16} color={T.orange} strokeWidth={2} />
      <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>{text}</span>
    </div>
  );

  return (
    <IronShell title="Compliance" subtitle="DOCUMENT COMPLIANCE DASHBOARD" onRefresh={fetchAllData}>
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{(s.value || 0).toLocaleString('en-IN')}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Compliance Score by Firm */}
          {complianceScores.length > 0 && (
            <IronCard pad={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
              {sectionTitle(Building2, 'Compliance Score by Firm')}
              <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {complianceScores.map((firm) => (
                  <div key={firm.firm_id} style={{ padding: 14, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{firm.firm_name}</span>
                      <span style={{ ...mono, fontSize: 16, fontWeight: 700, color: scoreColor(firm.compliance_score) }}>{firm.compliance_score}%</span>
                    </div>
                    <div style={{ width: '100%', background: T.iron200, borderRadius: 999, height: 6, overflow: 'hidden' }}>
                      <div style={{ height: 6, borderRadius: 999, background: scoreColor(firm.compliance_score), width: `${firm.compliance_score}%` }} />
                    </div>
                    <div style={{ ...mono, marginTop: 8, fontSize: 10.5, color: T.iron500 }}>
                      {firm.total_transactions} transactions, {firm.pending_count} pending
                    </div>
                  </div>
                ))}
              </div>
            </IronCard>
          )}

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {tabs.map((tb) => {
              const active = activeTab === tb.key;
              return (
                <button key={tb.key} data-testid={tb.testid} onClick={() => setActiveTab(tb.key)}
                  style={{ border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                  {tb.label}
                </button>
              );
            })}
          </div>

          {/* All Entries Tab */}
          {activeTab === 'all-entries' && (
            <>
              <IronCard pad={14} style={{ marginBottom: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div>
                    <Caps size={9} style={{ display: 'block', marginBottom: 4 }}>Firm</Caps>
                    <select value={entriesFilterFirm} onChange={(e) => setEntriesFilterFirm(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                      <option value="all">All Firms</option>
                      {firms.map(firm => (<option key={firm.id} value={firm.id}>{firm.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <Caps size={9} style={{ display: 'block', marginBottom: 4 }}>Entry Type</Caps>
                    <select value={entriesFilterType} onChange={(e) => setEntriesFilterType(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                      <option value="all">All Types</option>
                      <option value="purchase">Purchases</option>
                      <option value="sales">Sales Invoices</option>
                      <option value="dispatch">Dispatches</option>
                    </select>
                  </div>
                  <div>
                    <Caps size={9} style={{ display: 'block', marginBottom: 4 }}>Document Status</Caps>
                    <select value={entriesFilterDocStatus} onChange={(e) => setEntriesFilterDocStatus(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                      <option value="all">All Statuses</option>
                      <option value="complete">Complete</option>
                      <option value="pending">Pending Issues</option>
                      <option value="overridden">Overridden</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: 12, color: T.iron500 }}>
                      <span style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{allEntries.summary?.with_issues || 0}</span> entries with issues
                    </div>
                  </div>
                </div>
              </IronCard>

              <IronCard pad={0} style={{ overflow: 'hidden' }}>
                {sectionTitle(FileText, 'All Financial Entries with Compliance Status')}
                {allEntries.entries?.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
                    <FileText size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <div style={{ fontSize: 12 }}>No entries found</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                        {['Type', 'Entry #', 'Firm', 'Party', 'Date', 'Amount', 'Score', 'Issues / Remarks', 'Status'].map((h, i) => (
                          <th key={i} style={{ ...thCell, textAlign: (h === 'Amount' || h === 'Score') ? (h === 'Score' ? 'center' : 'right') : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                        ))}
                      </tr></thead>
                      <tbody>{allEntries.entries?.map((entry) => {
                        const et = entry.entry_type === 'purchase' ? { label: 'Purchase', tone: 'info' } : entry.entry_type === 'sales' ? { label: 'Sales', tone: 'ok' } : { label: 'Dispatch', tone: 'bad' };
                        const docTone = entry.doc_status === 'complete' ? 'ok' : entry.doc_status === 'overridden' ? 'violet' : 'warn';
                        return (
                          <tr key={entry.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                            <td style={tdCell}><span style={badgeStyle(et.tone)}>{et.label}</span></td>
                            <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron900 }}>{entry.entry_number}</td>
                            <td style={{ ...tdCell, fontSize: 11.5 }}>{entry.firm_name}</td>
                            <td style={tdCell}>
                              <div style={{ fontSize: 12, color: T.iron900 }}>{entry.party_name}</div>
                              {entry.party_gstin && <div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{entry.party_gstin}</div>}
                            </td>
                            <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{entry.date}</td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900, fontWeight: 600 }}>₹{entry.total_amount?.toLocaleString('en-IN')}</td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'center', fontWeight: 700, color: scoreColor(entry.compliance_score || 0) }}>{entry.compliance_score || 0}%</td>
                            <td style={{ ...tdCell, maxWidth: 280 }}>
                              {entry.compliance_issues?.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  {entry.compliance_issues.map((issue, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                                      <AlertTriangle size={12} color={T.voltageText} style={{ marginTop: 1, flexShrink: 0 }} />
                                      <span style={{ fontSize: 11, color: T.voltageText }}>{issue}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: 11, color: T.green, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <CheckCircle size={12} /> No issues
                                </span>
                              )}
                              {!entry.has_invoice_file && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 4 }}>
                                  <AlertTriangle size={12} color={T.orangeDeep} style={{ marginTop: 1, flexShrink: 0 }} />
                                  <span style={{ fontSize: 11, color: T.orangeDeep }}>Missing invoice file</span>
                                </div>
                              )}
                            </td>
                            <td style={tdCell}><span style={badgeStyle(docTone)}>{entry.doc_status || 'pending'}</span></td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                )}
              </IronCard>
            </>
          )}

          {/* Exceptions Tab */}
          {activeTab === 'exceptions' && (
            <>
              <IronCard pad={14} style={{ marginBottom: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                  <div>
                    <Caps size={9} style={{ display: 'block', marginBottom: 4 }}>Firm</Caps>
                    <select value={filterFirm} onChange={(e) => setFilterFirm(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                      <option value="all">All Firms</option>
                      {firms.map(firm => (<option key={firm.id} value={firm.id}>{firm.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <Caps size={9} style={{ display: 'block', marginBottom: 4 }}>Type</Caps>
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                      <option value="all">All Types</option>
                      {Object.entries(TRANSACTION_TYPE_CONFIG).map(([key, config]) => (<option key={key} value={key}>{config.label}</option>))}
                    </select>
                  </div>
                  <div>
                    <Caps size={9} style={{ display: 'block', marginBottom: 4 }}>Status</Caps>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                      <option value="all">All</option>
                      <option value="open">Open</option>
                      <option value="resolved">Resolved</option>
                      <option value="overridden">Overridden</option>
                    </select>
                  </div>
                  <div>
                    <Caps size={9} style={{ display: 'block', marginBottom: 4 }}>Severity</Caps>
                    <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                      <option value="all">All</option>
                      <option value="critical">Critical</option>
                      <option value="important">Important</option>
                      <option value="minor">Minor</option>
                    </select>
                  </div>
                  <div>
                    <Caps size={9} style={{ display: 'block', marginBottom: 4 }}>Age</Caps>
                    <select value={filterAge} onChange={(e) => setFilterAge(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                      <option value="all">All</option>
                      {AGE_BRACKETS.map(bracket => (<option key={bracket.value} value={bracket.value}>{bracket.label}</option>))}
                    </select>
                  </div>
                  <div>
                    <Caps size={9} style={{ display: 'block', marginBottom: 4 }}>Search</Caps>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                      <input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ ...inputStyle, width: '100%', paddingLeft: 30 }} />
                    </div>
                  </div>
                </div>
              </IronCard>

              <IronCard pad={0} style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {['Reference', 'Type', 'Firm', 'Issues', 'Severity', 'Age', 'Status', 'Actions'].map((h, i) => (
                        <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filteredExceptions.length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', color: T.iron400, padding: '40px 0', fontSize: 12 }}>
                          {filterStatus === 'open' ? 'No open exceptions - Great job!' : 'No exceptions found'}
                        </td></tr>
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
                            <tr key={exc.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }} data-testid={`exception-row-${exc.id}`}>
                              <td style={tdCell}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{exc.transaction_ref}</span>
                                  <a href={getTransactionLink(exc.transaction_type, exc.transaction_id)} style={{ color: T.blue, display: 'inline-flex' }} data-testid={`view-transaction-${exc.id}`}>
                                    <ExternalLink size={14} />
                                  </a>
                                </div>
                              </td>
                              <td style={tdCell}>
                                <span style={{ ...badgeStyle(typeConfig.tone || 'slate'), display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <TypeIcon size={11} />{typeConfig.label}
                                </span>
                              </td>
                              <td style={{ ...tdCell, fontSize: 11.5 }}>{firmName}</td>
                              <td style={{ ...tdCell, maxWidth: 260 }}>
                                {exc.issues?.slice(0, 2).map((issue, i) => (
                                  <div key={i} style={{ fontSize: 11.5, color: T.iron500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{issue}</div>
                                ))}
                                {exc.issues?.length > 2 && (<div style={{ fontSize: 10.5, color: T.iron400 }}>+{exc.issues.length - 2} more</div>)}
                              </td>
                              <td style={tdCell}>
                                <span style={{ ...badgeStyle(severityConfig.tone || 'slate'), display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <SeverityIcon size={11} />{severityConfig.label}
                                </span>
                              </td>
                              <td style={tdCell}><span style={badgeStyle(ageBracket?.tone || 'slate')}>{ageBracket?.label || exc.age_bracket}</span></td>
                              <td style={tdCell}><span style={badgeStyle(statusConfig.tone || 'slate')}>{statusConfig.label}</span></td>
                              <td style={tdCell}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {exc.status === 'open' && (
                                    <>
                                      <button onClick={() => handleResolve(exc.id)} data-testid={`resolve-${exc.id}`}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}>
                                        <CheckCircle size={13} />Resolve
                                      </button>
                                      {user?.role === 'admin' && (
                                        <button onClick={() => { setSelectedItem(exc); setOverrideDialogOpen(true); }} data-testid={`override-${exc.id}`}
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #DDD3EF', background: T.white, color: '#6D4AB0', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}>
                                          <Shield size={13} />Override
                                        </button>
                                      )}
                                    </>
                                  )}
                                  {exc.status === 'overridden' && exc.override_reason && (
                                    <span style={{ fontSize: 10.5, color: '#6D4AB0' }} title={exc.override_reason}>By: {exc.override_by_name}</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </IronCard>
            </>
          )}

          {/* Drafts Tab */}
          {activeTab === 'drafts' && (
            <IronCard pad={0} style={{ overflow: 'hidden' }}>
              {sectionTitle(Clock, 'Pending Draft Transactions')}
              {drafts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: T.iron400, fontSize: 12 }}>No pending drafts</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {['Reference', 'Type', 'Firm', 'Value', 'Doc Status', 'Compliance Score', 'Created', 'Actions'].map((h, i) => (
                        <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                      ))}
                    </tr></thead>
                    <tbody>{drafts.map((draft) => {
                      const typeConfig = TRANSACTION_TYPE_CONFIG[draft.transaction_type] || {};
                      const TypeIcon = typeConfig.icon || FileText;
                      return (
                        <tr key={draft.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }} data-testid={`draft-row-${draft.id}`}>
                          <td style={{ ...tdCell, fontFamily: T.headline, fontWeight: 700, fontSize: 12, color: T.iron900 }}>{draft.reference_number}</td>
                          <td style={tdCell}>
                            <span style={{ ...badgeStyle(typeConfig.tone || 'slate'), display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <TypeIcon size={11} />{typeConfig.label}
                            </span>
                          </td>
                          <td style={{ ...tdCell, fontSize: 11.5 }}>{draft.firm_name}</td>
                          <td style={{ ...tdCell, ...mono, color: T.iron900 }}>{formatCurrency(draft.value)}</td>
                          <td style={tdCell}><span style={badgeStyle(draft.doc_status === 'complete' ? 'ok' : 'warn')}>{draft.doc_status || 'pending'}</span></td>
                          <td style={{ ...tdCell, ...mono, fontWeight: 700, color: scoreColor(draft.compliance_score || 0) }}>{draft.compliance_score || 0}%</td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{new Date(draft.created_at).toLocaleDateString('en-IN')}</td>
                          <td style={tdCell}>
                            {user?.role === 'admin' ? (
                              <button onClick={() => handleFinalizeDraft(draft)} disabled={actionLoading} data-testid={`finalize-${draft.id}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: actionLoading ? 'default' : 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11, opacity: actionLoading ? 0.7 : 1 }}>
                                {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <><CheckCircle size={13} />Finalize</>}
                              </button>
                            ) : (
                              <span style={{ fontSize: 10.5, color: T.iron400, fontStyle: 'italic' }}>Admin only</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              )}
            </IronCard>
          )}

          {/* Matrix Tab */}
          {activeTab === 'matrix' && (
            <IronCard pad={0} style={{ overflow: 'hidden' }}>
              {sectionTitle(Shield, 'Document Compliance Matrix')}
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: T.orangeDeep }} />
                    <span style={{ color: T.iron500 }}>Hard Block (Required)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: T.voltage }} />
                    <span style={{ color: T.iron500 }}>Soft Block (Creates Exception)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: T.blue }} />
                    <span style={{ color: T.iron500 }}>Warning (Optional)</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                  {Object.entries(TRANSACTION_TYPE_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <div key={key} style={{ padding: 14, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <Icon size={18} color={T.orange} strokeWidth={1.9} />
                          <h3 style={{ margin: 0, fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>{config.label}</h3>
                        </div>
                        <p style={{ fontSize: 11.5, color: T.iron500, margin: '0 0 8px' }}>Required fields with hard/soft blocking rules:</p>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: T.iron700, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {key === 'purchase_entry' && (
                            <>
                              <li><span style={{ color: T.orangeDeep }}>Supplier Invoice Copy</span> (Hard)</li>
                              <li><span style={{ color: T.orangeDeep }}>Supplier Name, GSTIN, Invoice #</span> (Hard)</li>
                              <li><span style={{ color: T.orangeDeep }}>Item Lines with GST</span> (Hard)</li>
                            </>
                          )}
                          {key === 'sales_invoice' && (
                            <>
                              <li><span style={{ color: T.orangeDeep }}>Linked Dispatch</span> (Hard)</li>
                              <li><span style={{ color: T.orangeDeep }}>Party, Invoice #, Date</span> (Hard)</li>
                              <li><span style={{ color: T.orangeDeep }}>Taxable Value, GST Breakup</span> (Hard)</li>
                            </>
                          )}
                          {key === 'dispatch' && (
                            <>
                              <li><span style={{ color: T.orangeDeep }}>Firm, Item, Quantity</span> (Hard)</li>
                              <li><span style={{ color: T.voltageText }}>Tracking ID / Label</span> (Soft)</li>
                              <li><span style={{ color: T.blue }}>Packing Slip</span> (Optional)</li>
                            </>
                          )}
                          {key === 'stock_adjustment' && (
                            <>
                              <li><span style={{ color: T.orangeDeep }}>Reason (Mandatory)</span> (Hard)</li>
                              <li><span style={{ color: T.orangeDeep }}>Firm, Item, Quantity, User</span> (Hard)</li>
                              <li><span style={{ color: T.voltageText }}>Document (if &gt; 50K)</span> (Threshold)</li>
                            </>
                          )}
                          {key === 'payment_received' && (
                            <>
                              <li><span style={{ color: T.orangeDeep }}>Party, Amount, Date, Mode</span> (Hard)</li>
                              <li><span style={{ color: T.voltageText }}>Reference #, Linked Invoice</span> (Soft)</li>
                              <li><span style={{ color: T.blue }}>Bank Proof</span> (Optional)</li>
                            </>
                          )}
                          {key === 'payment_made' && (
                            <>
                              <li><span style={{ color: T.orangeDeep }}>Party, Amount, Date, Mode</span> (Hard)</li>
                              <li><span style={{ color: T.voltageText }}>Reference #, Linked Invoice</span> (Soft)</li>
                              <li><span style={{ color: T.blue }}>Payment Proof</span> (Optional)</li>
                            </>
                          )}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </IronCard>
          )}
        </>
      )}

      {/* Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Override Compliance Exception
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selectedItem && (
              <div className="p-4 rounded-lg bg-slate-50 border">
                <p className="text-slate-500 text-sm">Transaction Reference</p>
                <p className="font-medium">{selectedItem.transaction_ref}</p>

                <p className="text-slate-500 text-sm mt-3">Issues</p>
                <ul className="list-disc list-inside text-red-600 text-sm">
                  {selectedItem.issues?.map((issue, i) => (<li key={i}>{issue}</li>))}
                </ul>
              </div>
            )}

            <div>
              <Label>Override Reason (min 20 characters)</Label>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why this exception is being overridden..."
                className="mt-1"
                rows={4}
              />
              <p className="text-xs text-slate-500 mt-1">{overrideReason.length}/20 characters</p>
            </div>

            <div className="p-3 rounded bg-yellow-50 border border-yellow-300">
              <p className="text-yellow-700 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                This action will be logged in the audit trail. Override should only be used when there is a valid business reason.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOverrideDialogOpen(false); setOverrideReason(''); }}>Cancel</Button>
            <Button onClick={handleOverride} disabled={actionLoading || overrideReason.length < 20} className="bg-purple-600 hover:bg-purple-700">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
              Confirm Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

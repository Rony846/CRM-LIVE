import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Factory, Plus, Loader2, Eye, CheckCircle, Clock,
  Package, AlertTriangle, DollarSign, RefreshCw, Search,
  Barcode, ListChecks, Download, User
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const STATUS_LABELS = {
  requested: 'Requested',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  completed: 'Completed',
  received_into_inventory: 'Received',
  cancelled: 'Cancelled'
};

const STATUS_TONE = {
  requested: 'warn',
  accepted: 'info',
  in_progress: 'violet',
  completed: 'ok',
  received_into_inventory: 'ok',
  cancelled: 'bad',
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const okBtn = { border: 'none', background: T.green, color: '#fff', borderRadius: 6, padding: '6px 11px', fontFamily: T.headline, fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 };
const dangerBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '6px 11px', fontFamily: T.headline, fontWeight: 700, fontSize: 11, cursor: 'pointer' };
const ghostIconBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '6px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' };

const StatusChip = ({ status }) => (
  <span style={badgeStyle(STATUS_TONE[status] || 'slate')}>{STATUS_LABELS[status] || status}</span>
);

export default function ProductionRequests() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [masterSKUs, setMasterSKUs] = useState([]);
  const [firms, setFirms] = useState([]);
  const [payables, setPayables] = useState({ payables: [], summary: {} });
  const [completedSerials, setCompletedSerials] = useState([]);

  const [activeTab, setActiveTab] = useState('requests');
  const [filterStatus, setFilterStatus] = useState('all');
  const [serialSearchQuery, setSerialSearchQuery] = useState('');

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncingDispatch, setSyncingDispatch] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    firm_id: '', master_sku_id: '', quantity_requested: 1,
    production_date: '', remarks: ''
  });
  const [paymentForm, setPaymentForm] = useState({
    amount_paid: '', payment_reference: '', remarks: ''
  });

  const [scrapReport, setScrapReport] = useState(null);
  const [scrapDays, setScrapDays] = useState(90);
  const [scrapLoading, setScrapLoading] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchScrapReport = async (days) => {
    setScrapLoading(true);
    try {
      const r = await axios.get(`${API}/production/scrap-report`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { days },
      });
      setScrapReport(r.data);
    } catch (e) {
      toast.error('Failed to load scrap report');
    } finally {
      setScrapLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'scrap') fetchScrapReport(scrapDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, scrapDays]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [requestsRes, skusRes, firmsRes, payablesRes, serialsRes] = await Promise.all([
        axios.get(`${API}/production-requests`, { headers }),
        axios.get(`${API}/master-skus`, { headers }),
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        axios.get(`${API}/supervisor-payables`, { headers }),
        axios.get(`${API}/finished-good-serials`, { headers, params: { limit: 2000 } })
      ]);
      setRequests(requestsRes.data || []);
      // Only show manufactured SKUs
      setMasterSKUs((skusRes.data || []).filter(s => s.product_type === 'manufactured'));
      setFirms(firmsRes.data || []);
      setPayables(payablesRes.data || { payables: [], summary: {} });
      setCompletedSerials(serialsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Filtered serials with search
  const filteredSerials = useMemo(() => {
    if (!serialSearchQuery.trim()) return completedSerials;
    const query = serialSearchQuery.toLowerCase();
    return completedSerials.filter(s =>
      s.serial_number?.toLowerCase().includes(query) ||
      s.master_sku_name?.toLowerCase().includes(query) ||
      s.master_sku_code?.toLowerCase().includes(query) ||
      s.customer_name?.toLowerCase().includes(query) ||
      s.order_id?.toLowerCase().includes(query) ||
      s.condition?.toLowerCase().includes(query)
    );
  }, [completedSerials, serialSearchQuery]);

  const handleCreateRequest = async () => {
    if (!createForm.firm_id || !createForm.master_sku_id || createForm.quantity_requested < 1) {
      toast.error('Please fill in all required fields');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/production-requests`, createForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Production request created');
      setCreateDialogOpen(false);
      setCreateForm({ firm_id: '', master_sku_id: '', quantity_requested: 1, production_date: '', remarks: '', customer_name: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create request');
    } finally {
      setActionLoading(false);
    }
  };

  // Sync dispatch data to serial numbers
  const handleSyncDispatchData = async () => {
    setSyncingDispatch(true);
    try {
      const res = await axios.post(`${API}/finished-good-serials/sync-dispatch-data`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      toast.success(`Synced ${data.updated} serials with dispatch data`);
      if (data.no_dispatch_found > 0) {
        toast.info(`${data.no_dispatch_found} dispatched serials have no matching dispatch record`);
      }
      fetchData(); // Refresh to show updated data
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error.response?.data?.detail || 'Failed to sync dispatch data');
    } finally {
      setSyncingDispatch(false);
    }
  };

  const handleReceiveIntoInventory = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
    try {
      await axios.put(`${API}/production-requests/${selectedRequest.id}/receive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Production received into inventory');
      setReceiveDialogOpen(false);
      setSelectedRequest(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to receive into inventory');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this production request?')) return;

    try {
      await axios.put(`${API}/production-requests/${requestId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Request cancelled');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel request');
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedPayable || !paymentForm.amount_paid) {
      toast.error('Please enter payment amount');
      return;
    }

    setActionLoading(true);
    try {
      await axios.put(`${API}/supervisor-payables/${selectedPayable.id}/payment`, {
        status: 'part_paid',
        amount_paid: parseFloat(paymentForm.amount_paid),
        payment_reference: paymentForm.payment_reference,
        remarks: paymentForm.remarks
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Payment recorded');
      setPaymentDialogOpen(false);
      setPaymentForm({ amount_paid: '', payment_reference: '', remarks: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    } finally {
      setActionLoading(false);
    }
  };

  const openViewDialog = (request) => {
    setSelectedRequest(request);
    setViewDialogOpen(true);
  };

  const openReceiveDialog = (request) => {
    setSelectedRequest(request);
    setReceiveDialogOpen(true);
  };

  const openPaymentDialog = (payable) => {
    setSelectedPayable(payable);
    setPaymentForm({ amount_paid: '', payment_reference: '', remarks: '' });
    setPaymentDialogOpen(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const filteredRequests = filterStatus === 'all'
    ? requests
    : requests.filter(r => r.status === filterStatus);

  // Stats
  const pendingRequests = requests.filter(r => ['requested', 'accepted', 'in_progress'].includes(r.status)).length;
  const completedRequests = requests.filter(r => r.status === 'completed').length;
  const receivedRequests = requests.filter(r => r.status === 'received_into_inventory').length;

  const statCards = [
    { label: 'Pending', value: pendingRequests, icon: Clock, tone: T.voltageText },
    { label: 'Awaiting Receipt', value: completedRequests, icon: CheckCircle, tone: T.green },
    { label: 'Total Serials', value: completedSerials.length, icon: Barcode, tone: T.blue },
    { label: 'Received', value: receivedRequests, icon: Package, tone: T.green },
    { label: 'Pending Payables', value: formatCurrency(payables.summary?.total_pending), icon: DollarSign, tone: T.orange, isMoney: true },
  ];

  const tabs = [
    { key: 'requests', label: 'Production Requests', icon: Factory },
    { key: 'completed', label: 'Production Completed', icon: ListChecks },
    { key: 'payables', label: 'Supervisor Payables', icon: DollarSign },
    { key: 'scrap', label: 'Scrap Report', icon: AlertTriangle },
  ];

  const condTone = (c) => (c === 'New' ? 'ok' : c === 'Repaired' ? 'warn' : 'slate');
  const serialStatusTone = (s) => (s === 'in_stock' ? 'info' : s === 'dispatched' ? 'violet' : s === 'returned' ? 'bad' : 'slate');
  const payStatusInfo = (s) => (s === 'paid' ? ['Paid', 'ok'] : s === 'part_paid' ? ['Partial', 'warn'] : ['Unpaid', 'bad']);
  const rateTone = (r) => (r > 5 ? T.orangeDeep : r > 0 ? T.voltageText : T.green);

  const headerRight = (
    <button onClick={() => setCreateDialogOpen(true)} data-testid="create-production-request" style={primaryBtn}>
      <Plus size={14} strokeWidth={2.2} /> Create Request
    </button>
  );

  return (
    <IronShell
      title="Production Requests"
      subtitle="MANUFACTURING · COMPLETED PRODUCTION · SUPERVISOR PAYABLES"
      onRefresh={fetchData}
      headerRight={headerRight}
    >
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
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...mono, fontSize: s.isMoney ? 17 : 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{s.value}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Tabs */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 6, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, flexWrap: 'wrap' }}>
              {tabs.map((tb) => {
                const Icon = tb.icon;
                const active = activeTab === tb.key;
                return (
                  <button key={tb.key} data-testid={`${tb.key}-tab`} onClick={() => setActiveTab(tb.key)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                    <Icon size={14} strokeWidth={2} />{tb.label}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: 14 }}>
              {/* Production Requests Tab */}
              {activeTab === 'requests' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 }}>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', width: 200 }}>
                      <option value="all">All Statuses</option>
                      <option value="requested">Requested</option>
                      <option value="accepted">Accepted</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="received_into_inventory">Received</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button onClick={fetchData} style={outlineBtn}><RefreshCw size={14} /> Refresh</button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                        {['Request #', 'Firm', 'Product', 'Qty', 'Assigned To', 'Status', 'Created', ''].map((h, i) => (
                          <th key={i} style={{ ...thCell, textAlign: i === 7 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {filteredRequests.map((req) => (
                          <tr key={req.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                            <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{req.request_number}</td>
                            <td style={{ ...tdCell, color: T.iron900 }}>{req.firm_name}</td>
                            <td style={tdCell}>
                              <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{req.master_sku_name}</div>
                              <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{req.master_sku_code}</div>
                            </td>
                            <td style={{ ...tdCell, ...mono, fontWeight: 600, color: T.iron900 }}>{req.quantity_requested}</td>
                            <td style={tdCell}>
                              <span style={badgeStyle(req.manufacturing_role === 'supervisor' ? 'violet' : 'info')}>
                                {req.manufacturing_role === 'supervisor' ? 'Supervisor' : 'Technician'}
                              </span>
                            </td>
                            <td style={tdCell}><StatusChip status={req.status} /></td>
                            <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{formatDate(req.created_at)}</td>
                            <td style={{ ...tdCell, textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button onClick={() => openViewDialog(req)} title="View" data-testid={`view-request-${req.id}`} style={ghostIconBtn}><Eye size={14} /></button>
                                {req.status === 'completed' && (
                                  <button onClick={() => openReceiveDialog(req)} data-testid={`receive-request-${req.id}`} style={okBtn}>
                                    <CheckCircle size={13} /> Receive
                                  </button>
                                )}
                                {['requested', 'accepted'].includes(req.status) && (
                                  <button onClick={() => handleCancelRequest(req.id)} data-testid={`cancel-request-${req.id}`} style={dangerBtn}>Cancel</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredRequests.length === 0 && (
                          <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px 0', color: T.iron400, ...mono, fontSize: 11 }}>No production requests found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Production Completed Tab - Serial Numbers */}
              {activeTab === 'completed' && (
                <>
                  <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
                      <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 10, top: 9 }} />
                      <input
                        placeholder="Search by serial number, product, customer..."
                        value={serialSearchQuery}
                        onChange={(e) => setSerialSearchQuery(e.target.value)}
                        data-testid="serial-search-input"
                        style={{ ...inputStyle, paddingLeft: 32, width: '100%' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button onClick={handleSyncDispatchData} disabled={syncingDispatch} data-testid="sync-dispatch-btn" style={{ ...primaryBtn, opacity: syncingDispatch ? 0.6 : 1 }}>
                        {syncingDispatch ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                        Fetch Dispatch Data
                      </button>
                      <span style={{ ...mono, fontSize: 11, color: T.iron500 }}>{filteredSerials.length} / {completedSerials.length} records</span>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron100 }}>
                        {['Serial Number', 'Product', 'Condition', 'Status', 'Customer', 'Phone', 'Order ID', 'Production Date'].map((h, i) => (
                          <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {filteredSerials.slice(0, 200).map((serial) => (
                          <tr key={serial.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                            <td style={tdCell}>
                              <span style={{ ...mono, fontWeight: 700, color: T.orangeDeep }} data-testid={`serial-${serial.serial_number}`}>{serial.serial_number}</span>
                            </td>
                            <td style={tdCell}>
                              <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{serial.master_sku_name || '-'}</div>
                              <div style={{ ...mono, fontSize: 10.5, color: T.green, marginTop: 2 }}>{serial.master_sku_code || ''}</div>
                            </td>
                            <td style={tdCell}><span style={badgeStyle(condTone(serial.condition))}>{serial.condition || 'Unknown'}</span></td>
                            <td style={tdCell}><span style={badgeStyle(serialStatusTone(serial.status))}>{serial.status || '-'}</span></td>
                            <td style={tdCell}>
                              {serial.customer_name ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: T.iron900 }}>
                                  <User size={13} color={T.orange} />{serial.customer_name}
                                </span>
                              ) : (
                                <span style={{ fontSize: 12, fontStyle: 'italic', color: T.iron400 }}>{serial.status === 'dispatched' ? 'Click Fetch' : '-'}</span>
                              )}
                            </td>
                            <td style={{ ...tdCell, ...mono, color: T.voltageText, fontWeight: 600 }}>{serial.phone || '-'}</td>
                            <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{serial.order_id || '-'}</td>
                            <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>
                              {serial.production_date ? formatDate(serial.production_date) : serial.created_at ? formatDate(serial.created_at) : '-'}
                            </td>
                          </tr>
                        ))}
                        {filteredSerials.length === 0 && (
                          <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px 0', color: T.iron400, ...mono, fontSize: 11 }}>
                            {serialSearchQuery ? 'No serials matching your search' : 'No production completed records found'}
                          </td></tr>
                        )}
                        {filteredSerials.length > 200 && (
                          <tr style={{ background: T.iron50 }}>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '14px 0', color: T.iron500, ...mono, fontSize: 11 }}>
                              Showing first 200 of {filteredSerials.length} records · Use search to filter
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Supervisor Payables Tab */}
              {activeTab === 'payables' && (
                <>
                  {/* Duplicate Serial Alert */}
                  {payables.has_duplicates && payables.duplicate_serials?.length > 0 && (
                    <div style={{ marginBottom: 14, padding: 14, background: '#FDEEE6', border: `1px solid #F6D8BA`, borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <AlertTriangle size={22} color={T.orangeDeep} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <div style={{ fontFamily: T.headline, fontWeight: 700, color: T.orangeDeep }}>Duplicate Serial Numbers Detected!</div>
                          <div style={{ ...mono, fontSize: 11, color: T.orangeDeep, marginTop: 4, opacity: 0.8 }}>The following serial numbers appear in multiple payables:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                            {payables.duplicate_serials.map((sn, idx) => (
                              <span key={idx} style={badgeStyle('bad')}>{sn}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary bar */}
                  <div style={{ marginBottom: 14, padding: 14, background: T.iron50, borderRadius: 8, border: `1px solid ${T.iron200}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, textAlign: 'center' }}>
                      <div>
                        <Caps size={9} color={T.iron400}>Total Payable</Caps>
                        <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.iron900, marginTop: 4 }}>{formatCurrency(payables.summary?.total_payable)}</div>
                      </div>
                      <div>
                        <Caps size={9} color={T.iron400}>Total Paid</Caps>
                        <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.green, marginTop: 4 }}>{formatCurrency(payables.summary?.total_paid)}</div>
                      </div>
                      <div>
                        <Caps size={9} color={T.iron400}>Pending</Caps>
                        <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.orange, marginTop: 4 }}>{formatCurrency(payables.summary?.total_pending)}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                        {['Payable #', 'Production', 'Product', 'Serial Numbers', 'Qty', 'Rate', 'Total', 'Paid', 'Status', ''].map((h, i) => (
                          <th key={i} style={{ ...thCell, textAlign: i === 9 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {payables.payables?.map((pay) => {
                          const [plabel, ptone] = payStatusInfo(pay.status);
                          return (
                            <tr key={pay.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                              <td style={{ ...tdCell, ...mono, color: T.iron900 }}>{pay.payable_number}</td>
                              <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.orangeDeep }}>{pay.production_request_number}</td>
                              <td style={tdCell}>
                                <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pay.master_sku_name}>{pay.master_sku_name}</div>
                                <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{pay.firm_name}</div>
                              </td>
                              <td style={tdCell}>
                                {pay.serial_numbers?.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 200 }}>
                                    {pay.serial_numbers.slice(0, 3).map((sn, idx) => (
                                      <span key={idx} title={payables.duplicate_serials?.includes(sn) ? 'DUPLICATE!' : ''} style={badgeStyle(payables.duplicate_serials?.includes(sn) ? 'bad' : 'slate')}>{sn}</span>
                                    ))}
                                    {pay.serial_numbers.length > 3 && (
                                      <span style={badgeStyle('slate')}>+{pay.serial_numbers.length - 3} more</span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ ...mono, fontSize: 11, color: T.iron400 }}>No serials</span>
                                )}
                              </td>
                              <td style={{ ...tdCell, ...mono, color: T.iron900 }}>{pay.quantity_produced}</td>
                              <td style={{ ...tdCell, ...mono, color: T.iron900 }}>{formatCurrency(pay.rate_per_unit)}</td>
                              <td style={{ ...tdCell, ...mono, fontWeight: 600, color: T.iron900 }}>{formatCurrency(pay.total_payable)}</td>
                              <td style={{ ...tdCell, ...mono, fontWeight: 600, color: T.green }}>{formatCurrency(pay.amount_paid)}</td>
                              <td style={tdCell}><span style={badgeStyle(ptone)}>{plabel}</span></td>
                              <td style={{ ...tdCell, textAlign: 'right' }}>
                                {pay.status !== 'paid' && (
                                  <button onClick={() => openPaymentDialog(pay)} data-testid={`record-payment-${pay.id}`} style={okBtn}>
                                    <DollarSign size={13} /> Pay
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {(!payables.payables || payables.payables.length === 0) && (
                          <tr><td colSpan={10} style={{ textAlign: 'center', padding: '32px 0', color: T.iron400, ...mono, fontSize: 11 }}>No supervisor payables found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Scrap Report Tab */}
              {activeTab === 'scrap' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <Caps size={10} color={T.iron500}>Scrap / Yield Report</Caps>
                    <select value={String(scrapDays)} onChange={(e) => setScrapDays(Number(e.target.value))} style={{ ...inputStyle, cursor: 'pointer', width: 160 }}>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                      <option value="365">Last 12 months</option>
                      <option value="0">All time</option>
                    </select>
                  </div>

                  {scrapLoading ? (
                    <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" size={24} color={T.iron400} /></div>
                  ) : !scrapReport ? (
                    <div style={{ padding: '32px 0', textAlign: 'center', ...mono, fontSize: 11, color: T.iron400 }}>No data.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {/* Summary cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                        {[
                          { label: 'Scrap rate', value: `${scrapReport.summary.scrap_rate}%`, color: scrapReport.summary.scrap_rate > 5 ? T.orangeDeep : scrapReport.summary.scrap_rate > 0 ? T.voltageText : T.green },
                          { label: 'Good units', value: scrapReport.summary.total_good, color: T.green },
                          { label: 'Scrapped units', value: scrapReport.summary.total_scrap, color: T.voltageText },
                          { label: 'Jobs', value: scrapReport.summary.jobs, color: T.iron900 },
                        ].map((c) => (
                          <IronCard key={c.label} pad={12}>
                            <Caps size={9} color={T.iron400}>{c.label}</Caps>
                            <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
                          </IronCard>
                        ))}
                      </div>

                      {/* By reason */}
                      <div>
                        <Caps size={10} color={T.iron500} style={{ display: 'block', marginBottom: 10 }}>Scrap by reason</Caps>
                        {scrapReport.by_reason.length === 0 ? (
                          <div style={{ ...mono, fontSize: 11, color: T.iron400 }}>No scrap recorded in this period.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {scrapReport.by_reason.map((r) => {
                              const max = scrapReport.by_reason[0].quantity || 1;
                              return (
                                <div key={r.reason} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <span style={{ fontSize: 12.5, color: T.iron900, width: 176, flexShrink: 0 }}>{r.reason}</span>
                                  <div style={{ flex: 1, background: T.iron100, borderRadius: 999, height: 16, overflow: 'hidden', border: `1px solid ${T.iron200}` }}>
                                    <div style={{ background: T.orange, height: '100%', borderRadius: 999, width: `${(r.quantity / max) * 100}%` }} />
                                  </div>
                                  <span style={{ ...mono, fontSize: 12.5, color: T.iron900, width: 40, textAlign: 'right' }}>{r.quantity}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* By SKU */}
                      <div>
                        <Caps size={10} color={T.iron500} style={{ display: 'block', marginBottom: 10 }}>By product</Caps>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                            {['Product', 'Good', 'Scrap', 'Jobs', 'Scrap rate'].map((h, i) => (
                              <th key={i} style={{ ...thCell, textAlign: i === 0 ? 'left' : 'right' }}><Caps size={8.5}>{h}</Caps></th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {scrapReport.by_sku.map((s) => (
                              <tr key={s.master_sku_id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                                <td style={{ ...tdCell, color: T.iron900 }}>{s.master_sku_name}</td>
                                <td style={{ ...tdCell, ...mono, color: T.green, textAlign: 'right' }}>{s.good}</td>
                                <td style={{ ...tdCell, ...mono, color: T.voltageText, textAlign: 'right' }}>{s.scrap}</td>
                                <td style={{ ...tdCell, ...mono, color: T.iron500, textAlign: 'right' }}>{s.jobs}</td>
                                <td style={{ ...tdCell, ...mono, fontWeight: 600, textAlign: 'right', color: rateTone(s.scrap_rate) }}>{s.scrap_rate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* By worker */}
                      <div>
                        <Caps size={10} color={T.iron500} style={{ display: 'block', marginBottom: 10 }}>By worker</Caps>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                            {['Worker', 'Role', 'Good', 'Scrap', 'Jobs', 'Scrap rate'].map((h, i) => (
                              <th key={i} style={{ ...thCell, textAlign: i < 2 ? 'left' : 'right' }}><Caps size={8.5}>{h}</Caps></th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {scrapReport.by_worker.map((w, i) => (
                              <tr key={i} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                                <td style={{ ...tdCell, color: T.iron900 }}>{w.worker}</td>
                                <td style={{ ...tdCell, color: T.iron500, textTransform: 'capitalize' }}>{w.role}</td>
                                <td style={{ ...tdCell, ...mono, color: T.green, textAlign: 'right' }}>{w.good}</td>
                                <td style={{ ...tdCell, ...mono, color: T.voltageText, textAlign: 'right' }}>{w.scrap}</td>
                                <td style={{ ...tdCell, ...mono, color: T.iron500, textAlign: 'right' }}>{w.jobs}</td>
                                <td style={{ ...tdCell, ...mono, fontWeight: 600, textAlign: 'right', color: rateTone(w.scrap_rate) }}>{w.scrap_rate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </IronCard>
        </>
      )}

      {/* Create Production Request Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Production Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-mono text-[11px] uppercase tracking-wide">Firm *</Label>
              <Select value={createForm.firm_id} onValueChange={(v) => setCreateForm({ ...createForm, firm_id: v })}>
                <SelectTrigger className="mt-1">
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
              <Label className="font-mono text-[11px] uppercase tracking-wide">Product (Master SKU) *</Label>
              <Select value={createForm.master_sku_id} onValueChange={(v) => setCreateForm({ ...createForm, master_sku_id: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select product">
                    {createForm.master_sku_id && masterSKUs.find(s => s.id === createForm.master_sku_id) && (
                      <span className="truncate block max-w-[250px]">
                        {masterSKUs.find(s => s.id === createForm.master_sku_id)?.name} ({masterSKUs.find(s => s.id === createForm.master_sku_id)?.sku_code})
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {masterSKUs.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex flex-col">
                        <span className="truncate max-w-[300px]">{s.name}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{s.sku_code} - {s.manufacturing_role === 'supervisor' ? 'Supervisor' : 'Technician'}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {masterSKUs.length === 0 && (
                <p className="font-mono text-[11px] text-amber-500 mt-1">
                  No manufactured products found. Configure product_type = "manufactured" in Master SKUs.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wide">Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={createForm.quantity_requested}
                  onChange={(e) => setCreateForm({ ...createForm, quantity_requested: parseInt(e.target.value) || 1 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wide">Target Date</Label>
                <Input
                  type="date"
                  value={createForm.production_date}
                  onChange={(e) => setCreateForm({ ...createForm, production_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="font-mono text-[11px] uppercase tracking-wide">Customer Name (optional)</Label>
              <Input
                value={createForm.customer_name || ''}
                onChange={(e) => setCreateForm({ ...createForm, customer_name: e.target.value })}
                placeholder="e.g. Acme Corp · who this batch is being produced for"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-mono text-[11px] uppercase tracking-wide">Remarks</Label>
              <Textarea
                value={createForm.remarks}
                onChange={(e) => setCreateForm({ ...createForm, remarks: e.target.value })}
                placeholder="Any special instructions..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRequest} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Production Request Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Production Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-mono text-lg tabular-nums" style={{ color: T.orangeDeep }}>{selectedRequest.request_number}</p>
                  <StatusChip status={selectedRequest.status} />
                </div>
                <span style={badgeStyle(selectedRequest.manufacturing_role === 'supervisor' ? 'violet' : 'info')}>
                  {selectedRequest.manufacturing_role === 'supervisor' ? 'Supervisor Job' : 'Technician Job'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border" style={{ background: T.iron50, borderColor: T.iron200 }}>
                <div>
                  <Caps size={9} color={T.iron400}>Firm</Caps>
                  <p className="font-medium">{selectedRequest.firm_name}</p>
                </div>
                <div>
                  <Caps size={9} color={T.iron400}>Product</Caps>
                  <p className="font-medium">{selectedRequest.master_sku_name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{selectedRequest.master_sku_code}</p>
                </div>
                <div>
                  <Caps size={9} color={T.iron400}>Quantity Requested</Caps>
                  <p className="font-mono text-xl font-bold tabular-nums">{selectedRequest.quantity_requested}</p>
                </div>
                <div>
                  <Caps size={9} color={T.iron400}>Quantity Produced</Caps>
                  <p className="font-mono text-xl font-bold tabular-nums" style={{ color: T.green }}>{selectedRequest.quantity_produced}</p>
                </div>
              </div>

              {selectedRequest.production_charge_per_unit && (
                <div className="p-3 rounded-lg border" style={{ background: '#EEE9F7', borderColor: '#DDD3EF' }}>
                  <Caps size={9} color="#6D4AB0">Production Charge</Caps>
                  <p className="font-mono tabular-nums font-bold text-lg mt-1">
                    {formatCurrency(selectedRequest.production_charge_per_unit)} × {selectedRequest.quantity_produced || selectedRequest.quantity_requested} =
                    <span className="ml-2" style={{ color: '#6D4AB0' }}>
                      {formatCurrency((selectedRequest.production_charge_per_unit || 0) * (selectedRequest.quantity_produced || selectedRequest.quantity_requested))}
                    </span>
                  </p>
                </div>
              )}

              {/* Raw Material Requirements */}
              {selectedRequest.raw_material_requirements?.length > 0 && (
                <div>
                  <Caps size={10} color={T.iron500} style={{ display: 'block', marginBottom: 8 }}>Raw Material Requirements</Caps>
                  <div className="space-y-2">
                    {selectedRequest.raw_material_requirements.map((rm, idx) => (
                      <div key={idx} className="flex justify-between p-2 rounded-lg border" style={rm.sufficient ? { background: T.greenTint, borderColor: '#CBE5D6' } : { background: '#FDEEE6', borderColor: '#F6D8BA' }}>
                        <span>{rm.raw_material_name} ({rm.raw_material_sku})</span>
                        <span className="font-mono text-sm tabular-nums text-muted-foreground">
                          {rm.total_required} req / {rm.current_stock} stock
                          {!rm.sufficient && <AlertTriangle className="w-4 h-4 inline ml-2" style={{ color: T.orangeDeep }} />}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Serial Numbers */}
              {selectedRequest.serial_numbers?.length > 0 && (
                <div>
                  <Caps size={10} color={T.iron500} style={{ display: 'block', marginBottom: 8 }}>Serial Numbers</Caps>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {selectedRequest.serial_numbers.map((sn, idx) => (
                      <div key={idx} className="p-2 rounded-lg border font-mono text-sm tabular-nums" style={{ background: T.iron50, borderColor: T.iron200 }}>
                        {sn.serial_number}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="space-y-2">
                <Caps size={10} color={T.iron500}>Timeline</Caps>
                <div className="font-mono text-sm space-y-1 tabular-nums">
                  <p><span className="text-muted-foreground">Created:</span> {formatDate(selectedRequest.created_at)} <span className="text-muted-foreground">by</span> {selectedRequest.created_by_name}</p>
                  {selectedRequest.accepted_at && <p><span className="text-muted-foreground">Accepted:</span> {formatDate(selectedRequest.accepted_at)} <span className="text-muted-foreground">by</span> {selectedRequest.accepted_by_name}</p>}
                  {selectedRequest.started_at && <p><span className="text-muted-foreground">Started:</span> {formatDate(selectedRequest.started_at)}</p>}
                  {selectedRequest.completed_at && <p><span className="text-muted-foreground">Completed:</span> {formatDate(selectedRequest.completed_at)} <span className="text-muted-foreground">by</span> {selectedRequest.completed_by_name}</p>}
                  {selectedRequest.received_at && <p><span className="text-muted-foreground">Received:</span> {formatDate(selectedRequest.received_at)} <span className="text-muted-foreground">by</span> {selectedRequest.received_by_name}</p>}
                </div>
              </div>

              {selectedRequest.remarks && (
                <div className="p-3 rounded-lg border" style={{ background: T.iron50, borderColor: T.iron200 }}>
                  <Caps size={9} color={T.iron400}>Remarks</Caps>
                  <p className="mt-1">{selectedRequest.remarks}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receive Into Inventory Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Receipt Into Inventory</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border" style={{ background: T.greenTint, borderColor: '#CBE5D6' }}>
                <p className="font-mono text-sm tabular-nums" style={{ color: T.green }}>{selectedRequest.request_number}</p>
                <p className="font-mono text-2xl font-bold tabular-nums mt-1">{selectedRequest.quantity_produced} units of {selectedRequest.master_sku_name}</p>
                {(selectedRequest.scrap_quantity || 0) > 0 && (
                  <p className="font-mono text-[11px] mt-2" style={{ color: T.voltageText }}>
                    {selectedRequest.scrap_quantity} unit(s) scrapped at QC — not stocked
                  </p>
                )}
              </div>

              {/* QC scrap detail */}
              {(selectedRequest.scrap || []).length > 0 && (
                <div className="p-3 rounded-lg border" style={{ background: T.voltageTint, borderColor: '#EDDFA6' }}>
                  <Caps size={9} color={T.voltageText} style={{ display: 'block', marginBottom: 4 }}>Scrapped at QC</Caps>
                  <ul className="font-mono text-sm space-y-0.5 text-muted-foreground">
                    {selectedRequest.scrap.map((s, i) => (
                      <li key={i}>• {s.quantity} × {s.reason}{s.notes ? ` — ${s.notes}` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-4 rounded-lg border" style={{ background: T.iron50, borderColor: T.iron200 }}>
                <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>This action will:</Caps>
                <ul className="font-mono text-sm space-y-1 text-muted-foreground">
                  <li>• Deduct raw materials for {(selectedRequest.quantity_produced || 0) + (selectedRequest.scrap_quantity || 0)} units {(selectedRequest.scrap_quantity || 0) > 0 ? '(good + scrapped — material was used on both)' : ''}</li>
                  <li>• Add {selectedRequest.quantity_produced} finished goods to inventory</li>
                  <li>• Register {selectedRequest.quantity_produced} serial numbers</li>
                  {selectedRequest.manufacturing_role === 'supervisor' && (
                    <li>• Create supervisor payable of {formatCurrency((selectedRequest.production_charge_per_unit || 0) * selectedRequest.quantity_produced)} (good units only)</li>
                  )}
                </ul>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleReceiveIntoInventory} disabled={actionLoading} style={{ background: T.green, color: '#fff' }}>
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Receipt'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {selectedPayable && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg border" style={{ background: T.iron50, borderColor: T.iron200 }}>
                <p className="font-mono text-[11px] text-muted-foreground">Payable: {selectedPayable.payable_number}</p>
                <p className="font-medium mt-1">{selectedPayable.master_sku_name}</p>
                <div className="flex justify-between mt-2 font-mono text-sm tabular-nums">
                  <span className="text-muted-foreground">Total: {formatCurrency(selectedPayable.total_payable)}</span>
                  <span className="text-muted-foreground">Paid: <span style={{ color: T.green }}>{formatCurrency(selectedPayable.amount_paid)}</span></span>
                  <span style={{ color: T.orange }}>Pending: {formatCurrency(selectedPayable.total_payable - selectedPayable.amount_paid)}</span>
                </div>
              </div>

              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wide">Payment Amount *</Label>
                <Input
                  type="number"
                  value={paymentForm.amount_paid}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })}
                  placeholder="Enter amount"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wide">Payment Reference</Label>
                <Input
                  value={paymentForm.payment_reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_reference: e.target.value })}
                  placeholder="Transaction ID, Cheque #, etc."
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wide">Remarks</Label>
                <Textarea
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                  className="mt-1"
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleRecordPayment} disabled={actionLoading} style={{ background: T.green, color: '#fff' }}>
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Payment'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

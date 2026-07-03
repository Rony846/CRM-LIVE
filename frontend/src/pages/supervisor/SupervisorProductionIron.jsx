import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import SerialSheet from '@/components/production/SerialSheet';
import {
  Factory, Loader2, Eye, CheckCircle, Clock, Play,
  Plus, Trash2, DollarSign
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle, fmtDateTime } from '@/components/iron/IronKit';

const SCRAP_REASONS = [
  'Cell leak', 'Casing crack', 'Failed load test', 'Cosmetic defect',
  'Wrong assembly', 'Material defect', 'Damaged in handling', 'Other',
];

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
  cancelled: 'bad'
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

export default function SupervisorProduction() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [payables, setPayables] = useState({ payables: [], summary: {} });

  const [activeTab, setActiveTab] = useState('queue');

  // Dialogs
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Serial number entry form
  const [serialNumbers, setSerialNumbers] = useState([{ serial_number: '', notes: '' }]);
  const [completionNotes, setCompletionNotes] = useState('');
  const [scrapEntries, setScrapEntries] = useState([]);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [requestsRes, payablesRes] = await Promise.all([
        axios.get(`${API}/production-requests`, { headers }),
        axios.get(`${API}/supervisor-payables`, { headers })
      ]);
      setRequests(requestsRes.data || []);
      setPayables(payablesRes.data || { payables: [], summary: {} });
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    setActionLoading(true);
    try {
      await axios.put(`${API}/production-requests/${requestId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Production request accepted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async (requestId) => {
    setActionLoading(true);
    try {
      await axios.put(`${API}/production-requests/${requestId}/start`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Production started');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start');
    } finally {
      setActionLoading(false);
    }
  };

  const openCompleteDialog = (request) => {
    setSelectedRequest(request);
    // Pre-populate serial number fields based on quantity
    const qty = request.quantity_requested;
    setSerialNumbers(Array(qty).fill(null).map(() => ({ serial_number: '', notes: '' })));
    setCompletionNotes('');
    setScrapEntries([]);
    setCompleteDialogOpen(true);
  };

  const scrapTotal = scrapEntries.reduce((s, e) => s + (parseInt(e.quantity, 10) || 0), 0);

  const handleComplete = async () => {
    if (!selectedRequest) return;
    const requested = selectedRequest.quantity_requested || 0;

    // Validate all serial numbers are filled
    const emptySerials = serialNumbers.filter(sn => !sn.serial_number.trim());
    if (emptySerials.length > 0) {
      toast.error('Please fill in all serial numbers');
      return;
    }

    // Check for duplicates
    const serialList = serialNumbers.map(sn => sn.serial_number.trim());
    if (new Set(serialList).size !== serialList.length) {
      toast.error('Duplicate serial numbers found');
      return;
    }

    // QC reconciliation: good + scrap must equal requested
    if (serialNumbers.length + scrapTotal !== requested) {
      toast.error(`Good (${serialNumbers.length}) + scrap (${scrapTotal}) must equal requested (${requested})`);
      return;
    }
    // Every scrap entry needs a reason
    if (scrapEntries.some(e => !(e.reason || '').trim() || (parseInt(e.quantity, 10) || 0) <= 0)) {
      toast.error('Each scrap entry needs a positive quantity and a reason');
      return;
    }

    setActionLoading(true);
    try {
      await axios.put(`${API}/production-requests/${selectedRequest.id}/complete`, {
        serial_numbers: serialNumbers.map(sn => ({
          serial_number: sn.serial_number.trim(),
          notes: sn.notes
        })),
        completion_notes: completionNotes,
        scrap: scrapEntries.map(e => ({
          quantity: parseInt(e.quantity, 10) || 0,
          reason: e.reason,
          notes: e.notes || null,
        })),
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(
        scrapTotal > 0
          ? `Completed — ${serialNumbers.length} good, ${scrapTotal} scrapped.`
          : 'Production completed! Awaiting accountant confirmation.'
      );
      setCompleteDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete');
    } finally {
      setActionLoading(false);
    }
  };

  const addScrapEntry = () => setScrapEntries([...scrapEntries, { quantity: 1, reason: '', notes: '' }]);
  const updateScrap = (index, field, value) =>
    setScrapEntries(scrapEntries.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  const removeScrapEntry = (index) => setScrapEntries(scrapEntries.filter((_, i) => i !== index));

  const openViewDialog = (request) => {
    setSelectedRequest(request);
    setViewDialogOpen(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  // Filter requests
  const pendingQueue = requests.filter(r => r.status === 'requested');
  const inProgressQueue = requests.filter(r => ['accepted', 'in_progress'].includes(r.status));
  const completedQueue = requests.filter(r => ['completed', 'received_into_inventory'].includes(r.status));

  const statusPill = (status) => (
    <span style={badgeStyle(STATUS_TONE[status] || 'slate')}>{STATUS_LABELS[status] || status}</span>
  );

  // KPI tile
  const Kpi = ({ icon: Icon, label, value, color = T.iron900 }) => (
    <IronCard pad={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon size={18} color={T.orange} strokeWidth={1.9} />
        </div>
        <div style={{ minWidth: 0 }}>
          <Caps size={8.5}>{label}</Caps>
          <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 22, color, ...(typeof value === 'string' && value.includes('₹') ? mono : {}), lineHeight: 1.1 }}>{value}</div>
        </div>
      </div>
    </IronCard>
  );

  // Queue job card
  const JobCard = ({ req, actions }) => (
    <IronCard pad={14} style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ ...mono, fontSize: 12.5, fontWeight: 700, color: T.iron900 }}>{req.request_number}</span>
            {statusPill(req.status)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
            <div>
              <Caps size={8.5}>Product</Caps>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                {req.master_sku_image && (
                  <img src={req.master_sku_image} alt="" style={{ height: 40, width: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: `1px solid ${T.iron200}` }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: T.iron900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.master_sku_name}</div>
                  <div style={{ ...mono, fontSize: 11, color: T.iron500 }}>{req.master_sku_code}</div>
                </div>
              </div>
              {req.customer_name && (
                <div style={{ fontSize: 11, color: T.blue, marginTop: 4 }}>For: {req.customer_name}</div>
              )}
            </div>
            <div>
              <Caps size={8.5}>Firm</Caps>
              <div style={{ fontWeight: 600, fontSize: 13, color: T.iron900, marginTop: 3 }}>{req.firm_name}</div>
            </div>
            <div>
              <Caps size={8.5}>Quantity</Caps>
              <div style={{ ...mono, fontWeight: 800, fontSize: 20, color: T.iron900, marginTop: 1 }}>{req.quantity_requested}</div>
            </div>
            <div>
              <Caps size={8.5}>Earnings</Caps>
              <div style={{ ...mono, fontWeight: 700, fontSize: 15, color: T.green, marginTop: 3 }}>{formatCurrency((req.production_charge_per_unit || 0) * req.quantity_requested)}</div>
            </div>
          </div>
          {req.remarks && (
            <div style={{ marginTop: 10, padding: 8, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 6, fontSize: 12, color: T.iron700 }}>
              <span style={{ color: T.iron400 }}>Remarks:</span> {req.remarks}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {actions}
        </div>
      </div>
    </IronCard>
  );

  const content = loading ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 384 }}>
      <Loader2 className="animate-spin" size={30} color={T.orange} />
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <Kpi icon={Clock} label="Pending Jobs" value={pendingQueue.length} />
        <Kpi icon={Play} label="In Progress" value={inProgressQueue.length} />
        <Kpi icon={CheckCircle} label="Completed" value={completedQueue.length} />
        <Kpi icon={DollarSign} label="Total Earnings" value={formatCurrency(payables.summary?.total_payable)} color={T.green} />
      </div>

      {/* Tabs */}
      <IronCard pad={0}>
        <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${T.iron200}`, padding: '10px 12px 0', background: T.iron50, borderRadius: '8px 8px 0 0' }}>
          {[
            { id: 'queue', label: `Production Queue (${pendingQueue.length + inProgressQueue.length})`, icon: Factory, testid: 'queue-tab' },
            { id: 'history', label: `Completed (${completedQueue.length})`, icon: CheckCircle, testid: 'history-tab' },
            { id: 'earnings', label: 'My Earnings', icon: DollarSign, testid: 'earnings-tab' },
          ].map(t => {
            const active = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                data-testid={t.testid}
                onClick={() => setActiveTab(t.id)}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  padding: '10px 14px', display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: T.headline, fontWeight: 700, fontSize: 12,
                  color: active ? T.orange : T.iron500,
                  borderBottom: `2px solid ${active ? T.orange : 'transparent'}`,
                  marginBottom: -1,
                }}
              >
                <Icon size={14} strokeWidth={1.9} />{t.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 14 }}>
          {/* Production Queue Tab */}
          {activeTab === 'queue' && (
            (pendingQueue.length === 0 && inProgressQueue.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
                <Factory size={44} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p>No pending production jobs</p>
              </div>
            ) : (
              <div>
                {/* Pending Jobs */}
                {pendingQueue.map((req) => (
                  <JobCard
                    key={req.id}
                    req={req}
                    actions={
                      <button
                        style={{ ...btnPrimary, background: T.green, opacity: actionLoading ? 0.6 : 1 }}
                        onClick={() => handleAccept(req.id)}
                        disabled={actionLoading}
                        data-testid={`accept-${req.id}`}
                      >
                        <CheckCircle size={15} />Accept Job
                      </button>
                    }
                  />
                ))}

                {/* In Progress Jobs */}
                {inProgressQueue.map((req) => (
                  <JobCard
                    key={req.id}
                    req={req}
                    actions={
                      <>
                        {req.status === 'accepted' && (
                          <button
                            style={{ ...btnPrimary, opacity: actionLoading ? 0.6 : 1 }}
                            onClick={() => handleStart(req.id)}
                            disabled={actionLoading}
                            data-testid={`start-${req.id}`}
                          >
                            <Play size={15} />Start Production
                          </button>
                        )}
                        {req.status === 'in_progress' && (
                          <button
                            style={{ ...btnPrimary, background: T.green, opacity: actionLoading ? 0.6 : 1 }}
                            onClick={() => openCompleteDialog(req)}
                            disabled={actionLoading}
                            data-testid={`complete-${req.id}`}
                          >
                            <CheckCircle size={15} />Complete &amp; Enter Serials
                          </button>
                        )}
                      </>
                    }
                  />
                ))}
              </div>
            )
          )}

          {/* Completed History Tab */}
          {activeTab === 'history' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {['Request #', 'Product', 'Qty', 'Earnings', 'Status', 'Completed', ''].map((h, i) => (
                    <th key={i} style={{ ...thCell, textAlign: i === 6 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completedQueue.map((req) => (
                  <tr key={req.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={{ ...tdCell, ...mono, color: T.iron900, fontWeight: 600 }}>{req.request_number}</td>
                    <td style={tdCell}>
                      <div style={{ fontWeight: 600, color: T.iron900 }}>{req.master_sku_name}</div>
                      <div style={{ fontSize: 11, color: T.iron500 }}>{req.firm_name}</div>
                    </td>
                    <td style={{ ...tdCell, ...mono, fontWeight: 700 }}>{req.quantity_produced}</td>
                    <td style={{ ...tdCell, ...mono, color: T.green, fontWeight: 600 }}>{formatCurrency((req.production_charge_per_unit || 0) * req.quantity_produced)}</td>
                    <td style={tdCell}>{statusPill(req.status)}</td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11 }}>{fmtDateTime(req.completed_at)}</td>
                    <td style={{ ...tdCell, textAlign: 'right' }}>
                      <button style={{ ...btnOutline, padding: '5px 8px' }} onClick={() => openViewDialog(req)}>
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {completedQueue.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ ...tdCell, textAlign: 'center', padding: '32px 0', color: T.iron400 }}>
                      No completed production jobs
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* Earnings Tab */}
          {activeTab === 'earnings' && (
            <div>
              <div style={{ marginBottom: 14, padding: 14, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, textAlign: 'center' }}>
                  <div>
                    <Caps size={8.5}>Total Earned</Caps>
                    <div style={{ ...mono, fontWeight: 800, fontSize: 20, color: T.iron900 }}>{formatCurrency(payables.summary?.total_payable)}</div>
                  </div>
                  <div>
                    <Caps size={8.5}>Received</Caps>
                    <div style={{ ...mono, fontWeight: 800, fontSize: 20, color: T.green }}>{formatCurrency(payables.summary?.total_paid)}</div>
                  </div>
                  <div>
                    <Caps size={8.5}>Pending</Caps>
                    <div style={{ ...mono, fontWeight: 800, fontSize: 20, color: T.orange }}>{formatCurrency(payables.summary?.total_pending)}</div>
                  </div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {['Production', 'Product', 'Qty', 'Rate', 'Total', 'Received', 'Status'].map((h, i) => (
                      <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payables.payables?.map((pay) => (
                    <tr key={pay.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron900, fontWeight: 600 }}>{pay.production_request_number}</td>
                      <td style={tdCell}>
                        <div style={{ fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{pay.master_sku_name}</div>
                        <div style={{ fontSize: 11, color: T.iron500 }}>{pay.firm_name}</div>
                      </td>
                      <td style={{ ...tdCell, ...mono }}>{pay.quantity_produced}</td>
                      <td style={{ ...tdCell, ...mono }}>{formatCurrency(pay.rate_per_unit)}</td>
                      <td style={{ ...tdCell, ...mono, fontWeight: 600 }}>{formatCurrency(pay.total_payable)}</td>
                      <td style={{ ...tdCell, ...mono, color: T.green }}>{formatCurrency(pay.amount_paid)}</td>
                      <td style={tdCell}>
                        <span style={badgeStyle(pay.status === 'paid' ? 'ok' : pay.status === 'part_paid' ? 'warn' : 'bad')}>
                          {pay.status === 'paid' ? 'Paid' : pay.status === 'part_paid' ? 'Partial' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!payables.payables || payables.payables.length === 0) && (
                    <tr>
                      <td colSpan={7} style={{ ...tdCell, textAlign: 'center', padding: '32px 0', color: T.iron400 }}>
                        No earnings records yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </IronCard>

      {/* Complete Production Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Production - Enter Serial Numbers</DialogTitle>
          </DialogHeader>
          {selectedRequest && (() => {
            const requested = selectedRequest.quantity_requested || 0;
            const good = serialNumbers.length;
            const reconciled = good + scrapTotal === requested;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: 12, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {selectedRequest.master_sku_image && (
                    <img src={selectedRequest.master_sku_image} alt="" style={{ height: 64, width: 64, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: `1px solid ${T.iron200}` }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{selectedRequest.request_number}</div>
                    <div style={{ fontWeight: 600 }}>{selectedRequest.master_sku_name} ({selectedRequest.master_sku_code})</div>
                    {selectedRequest.customer_name && (
                      <div style={{ fontSize: 12, color: T.blue, marginTop: 2 }}>For: <span style={{ color: T.iron900 }}>{selectedRequest.customer_name}</span></div>
                    )}
                    <div style={{ fontSize: 12, color: T.iron500 }}>Requested: {requested} units</div>
                  </div>
                </div>

                {/* QC reconciliation banner */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 12, borderRadius: 8,
                  border: `1px solid ${reconciled ? '#CBE5D6' : '#EDDFA6'}`,
                  background: reconciled ? T.greenTint : T.voltageTint,
                }}>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12.5 }}>
                    <span style={{ color: T.green }}>Good <b>{good}</b></span>
                    <span style={{ color: T.voltageText }}>Scrap <b>{scrapTotal}</b></span>
                    <span style={{ color: T.iron700 }}>Requested <b>{requested}</b></span>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: reconciled ? T.green : T.voltageText }}>
                    {reconciled ? '✓ reconciled' : `${good + scrapTotal} / ${requested}`}
                  </span>
                </div>

                <div>
                  <Label style={{ marginBottom: 8, display: 'block' }}>Good units — serial numbers ({good})</Label>
                  <SerialSheet
                    value={serialNumbers}
                    onChange={setSerialNumbers}
                    expectedQty={requested}
                    scrapTotal={scrapTotal}
                  />
                </div>

                {/* Scrap / rejected units */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Label>Scrapped / rejected units ({scrapTotal})</Label>
                    <button type="button" onClick={addScrapEntry} style={{ ...btnOutline, padding: '5px 10px', color: T.voltageText, borderColor: '#EDDFA6' }}>
                      <Plus size={14} />Add scrap
                    </button>
                  </div>
                  {scrapEntries.length === 0 ? (
                    <p style={{ fontSize: 12, color: T.iron400 }}>No scrap — all {requested} units passed QC.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {scrapEntries.map((e, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            value={e.quantity}
                            onChange={(ev) => updateScrap(idx, 'quantity', ev.target.value)}
                            style={{ ...inputStyle, width: 64 }}
                            title="Quantity"
                          />
                          <select
                            value={e.reason}
                            onChange={(ev) => updateScrap(idx, 'reason', ev.target.value)}
                            style={{ ...inputStyle, width: 176 }}
                          >
                            <option value="">Reason…</option>
                            {SCRAP_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <input
                            value={e.notes}
                            onChange={(ev) => updateScrap(idx, 'notes', ev.target.value)}
                            placeholder="Notes (optional)"
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={() => removeScrapEntry(idx)}
                            style={{ border: 'none', background: 'transparent', color: T.iron400, cursor: 'pointer', padding: 4 }}
                            title="Remove"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Completion Notes</Label>
                  <Textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Any notes about this production batch..."
                    style={{ marginTop: 4 }}
                    rows={2}
                  />
                </div>

                <div style={{ padding: 12, background: T.greenTint, border: `1px solid #CBE5D6`, borderRadius: 8 }}>
                  <p style={{ fontSize: 12.5, color: T.green }}>
                    Earnings for this job: <span style={{ fontWeight: 700 }}>{formatCurrency((selectedRequest.production_charge_per_unit || 0) * good)}</span>
                    {scrapTotal > 0 && <span style={{ color: T.iron500 }}> (paid on {good} good units)</span>}
                  </p>
                </div>

                <DialogFooter>
                  <button style={btnOutline} onClick={() => setCompleteDialogOpen(false)}>
                    Cancel
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={actionLoading}
                    style={{ ...btnPrimary, background: T.green, opacity: actionLoading ? 0.6 : 1 }}
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={15} /> : 'Submit Completion'}
                  </button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Production Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 12, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                <div style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{selectedRequest.request_number}</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{selectedRequest.master_sku_name}</div>
                {statusPill(selectedRequest.status)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <Caps size={8.5}>Firm</Caps>
                  <div style={{ marginTop: 3 }}>{selectedRequest.firm_name}</div>
                </div>
                <div>
                  <Caps size={8.5}>Quantity</Caps>
                  <div style={{ ...mono, fontWeight: 700, marginTop: 3 }}>{selectedRequest.quantity_produced}</div>
                </div>
              </div>

              {selectedRequest.serial_numbers?.length > 0 && (
                <div>
                  <Caps size={8.5}>Serial Numbers</Caps>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, maxHeight: 160, overflowY: 'auto', marginTop: 6 }}>
                    {selectedRequest.serial_numbers.map((sn, idx) => (
                      <div key={idx} style={{ padding: 4, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 4, ...mono, fontSize: 11 }}>
                        {sn.serial_number}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p><span style={{ color: T.iron400 }}>Completed:</span> {fmtDateTime(selectedRequest.completed_at)}</p>
                {selectedRequest.received_at && (
                  <p><span style={{ color: T.iron400 }}>Received by Accountant:</span> {fmtDateTime(selectedRequest.received_at)}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <IronShell
      title="Production"
      subtitle="BATTERY PRODUCTION QUEUE"
      onRefresh={fetchData}
    >
      {content}
    </IronShell>
  );
}

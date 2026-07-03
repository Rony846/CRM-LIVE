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
  Factory, Loader2, Eye, CheckCircle, Clock, Play, Plus, Trash2
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle, fmtDateTime } from '@/components/iron/IronKit';

const SCRAP_REASONS = [
  'Cell leak', 'Casing crack', 'Failed load test', 'Cosmetic defect',
  'Wrong assembly', 'Material defect', 'Damaged in handling', 'Other',
];

const STATUS_META = {
  requested: ['Requested', 'warn'],
  accepted: ['Accepted', 'info'],
  in_progress: ['In Progress', 'violet'],
  completed: ['Completed', 'ok'],
  received_into_inventory: ['Received', 'ok'],
  cancelled: ['Cancelled', 'bad'],
};
const statusPill = (status) => {
  const [label, tone] = STATUS_META[status] || [(status || '-').replace(/_/g, ' '), 'slate'];
  return { label, style: badgeStyle(tone) };
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

export default function TechnicianProduction() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const requestsRes = await axios.get(`${API}/production-requests`, { headers });
      setRequests(requestsRes.data || []);
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

    const emptySerials = serialNumbers.filter(sn => !sn.serial_number.trim());
    if (emptySerials.length > 0) {
      toast.error('Please fill in all serial numbers');
      return;
    }

    const serialList = serialNumbers.map(sn => sn.serial_number.trim());
    if (new Set(serialList).size !== serialList.length) {
      toast.error('Duplicate serial numbers found');
      return;
    }

    if (serialNumbers.length + scrapTotal !== requested) {
      toast.error(`Good (${serialNumbers.length}) + scrap (${scrapTotal}) must equal requested (${requested})`);
      return;
    }
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

  // Filter requests
  const pendingQueue = requests.filter(r => r.status === 'requested');
  const inProgressQueue = requests.filter(r => ['accepted', 'in_progress'].includes(r.status));
  const completedQueue = requests.filter(r => ['completed', 'received_into_inventory'].includes(r.status));

  const statCards = [
    { label: 'Pending Jobs', value: pendingQueue.length, icon: Clock, tone: T.voltageText },
    { label: 'In Progress', value: inProgressQueue.length, icon: Play, tone: '#6D4AB0' },
    { label: 'Completed', value: completedQueue.length, icon: CheckCircle, tone: T.green },
  ];

  const tabs = [
    { key: 'queue', label: 'Production Queue', count: pendingQueue.length + inProgressQueue.length, icon: Factory },
    { key: 'history', label: 'Completed', count: completedQueue.length, icon: CheckCircle },
  ];

  const historyHeaders = ['REQUEST #', 'PRODUCT', 'QTY', 'STATUS', 'COMPLETED', ''];

  // Reusable job card (pending + in-progress share layout, differ in action)
  const JobCard = ({ req, accent, action }) => {
    const sp = statusPill(req.status);
    return (
      <IronCard pad={14} style={{ borderLeft: `3px solid ${accent}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ ...mono, fontWeight: 700, fontSize: 12.5, color: T.orangeDeep }}>{req.request_number}</span>
              <span style={sp.style}>{sp.label}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 8 }}>
              <div>
                <Caps size={8.5} color={T.iron400}>Product</Caps>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {req.master_sku_image && (
                    <img src={req.master_sku_image} alt="" style={{ height: 40, width: 40, borderRadius: 6, objectFit: 'cover', background: T.iron100, flexShrink: 0, border: `1px solid ${T.iron200}` }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.master_sku_name}</div>
                    <div style={{ ...mono, fontSize: 10.5, color: T.iron400 }}>{req.master_sku_code}</div>
                  </div>
                </div>
                {req.customer_name && (
                  <div style={{ fontSize: 11, color: T.blue, marginTop: 4 }}>For: {req.customer_name}</div>
                )}
              </div>
              <div>
                <Caps size={8.5} color={T.iron400}>Firm</Caps>
                <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900, marginTop: 4 }}>{req.firm_name}</div>
              </div>
              <div>
                <Caps size={8.5} color={T.iron400}>Quantity</Caps>
                <div style={{ ...mono, fontWeight: 700, fontSize: 22, color: T.iron900, marginTop: 2, lineHeight: 1 }}>{req.quantity_requested}</div>
              </div>
            </div>
            {req.remarks && (
              <div style={{ padding: 8, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 6, fontSize: 12, color: T.iron700 }}>
                <span style={{ color: T.iron400 }}>Remarks:</span> {req.remarks}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            {action}
          </div>
        </div>
      </IronCard>
    );
  };

  const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
  const greenBtn = { ...primaryBtn, background: T.green };
  const violetBtn = { ...primaryBtn, background: '#6D4AB0' };

  return (
    <IronShell title="Production" subtitle="PRODUCTION QUEUE · INVERTER JOBS" onRefresh={fetchData}>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{s.value.toLocaleString('en-IN')}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Tabs */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              {tabs.map((tb) => {
                const Icon = tb.icon;
                const active = activeTab === tb.key;
                return (
                  <button key={tb.key} data-testid={`${tb.key}-tab`} onClick={() => setActiveTab(tb.key)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                    <Icon size={14} strokeWidth={2} />{tb.label}
                    <span style={{ ...mono, fontSize: 11, opacity: 0.85 }}>({tb.count})</span>
                  </button>
                );
              })}
            </div>

            <div style={{ padding: 14 }}>
              {/* Production Queue Tab */}
              {activeTab === 'queue' && (
                pendingQueue.length === 0 && inProgressQueue.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                    <Factory size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No pending production jobs</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {pendingQueue.map((req) => (
                      <JobCard key={req.id} req={req} accent={T.voltage} action={
                        <button style={greenBtn} onClick={() => handleAccept(req.id)} disabled={actionLoading} data-testid={`accept-${req.id}`}>
                          <CheckCircle size={15} /> Accept Job
                        </button>
                      } />
                    ))}
                    {inProgressQueue.map((req) => (
                      <JobCard key={req.id} req={req} accent="#6D4AB0" action={
                        <>
                          {req.status === 'accepted' && (
                            <button style={violetBtn} onClick={() => handleStart(req.id)} disabled={actionLoading} data-testid={`start-${req.id}`}>
                              <Play size={15} /> Start Production
                            </button>
                          )}
                          {req.status === 'in_progress' && (
                            <button style={greenBtn} onClick={() => openCompleteDialog(req)} disabled={actionLoading} data-testid={`complete-${req.id}`}>
                              <CheckCircle size={15} /> Complete &amp; Enter Serials
                            </button>
                          )}
                        </>
                      } />
                    ))}
                  </div>
                )
              )}

              {/* Completed History Tab */}
              {activeTab === 'history' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {historyHeaders.map((h, i) => <th key={i} style={{ ...thCell, textAlign: i === historyHeaders.length - 1 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>)}
                    </tr></thead>
                    <tbody>
                      {completedQueue.map((req) => {
                        const sp = statusPill(req.status);
                        return (
                          <tr key={req.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                            <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{req.request_number}</td>
                            <td style={tdCell}>
                              <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{req.master_sku_name}</div>
                              <div style={{ fontSize: 11, color: T.iron400, marginTop: 2 }}>{req.firm_name}</div>
                            </td>
                            <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.iron900 }}>{req.quantity_produced}</td>
                            <td style={tdCell}><span style={sp.style}>{sp.label}</span></td>
                            <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{fmtDateTime(req.completed_at)}</td>
                            <td style={{ ...tdCell, textAlign: 'right' }}>
                              <button onClick={() => openViewDialog(req)} title="View"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}>
                                <Eye size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {completedQueue.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: T.iron400, fontSize: 12.5 }}>
                            No completed production jobs
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </IronCard>
        </>
      )}

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
              <div className="space-y-4 py-2">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                  {selectedRequest.master_sku_image && (
                    <img src={selectedRequest.master_sku_image} alt="" style={{ height: 64, width: 64, borderRadius: 6, objectFit: 'cover', background: T.iron100, flexShrink: 0, border: `1px solid ${T.iron200}` }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ ...mono, fontWeight: 700, color: T.orangeDeep }}>{selectedRequest.request_number}</div>
                    <div style={{ fontFamily: T.headline, fontWeight: 600, color: T.iron900 }}>{selectedRequest.master_sku_name} ({selectedRequest.master_sku_code})</div>
                    {selectedRequest.customer_name && (
                      <div style={{ fontSize: 12.5, color: T.blue, marginTop: 2 }}>For: <span style={{ color: T.iron900 }}>{selectedRequest.customer_name}</span></div>
                    )}
                    <div style={{ fontSize: 12.5, color: T.iron500 }}>Requested: {requested} units</div>
                  </div>
                </div>

                {/* QC reconciliation banner */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, border: `1px solid ${reconciled ? '#CBE5D6' : '#EDDFA6'}`, background: reconciled ? T.greenTint : T.voltageTint }}>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12.5 }}>
                    <span style={{ color: T.green }}>Good <b>{good}</b></span>
                    <span style={{ color: T.voltageText }}>Scrap <b>{scrapTotal}</b></span>
                    <span style={{ color: T.iron700 }}>Requested <b>{requested}</b></span>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: reconciled ? T.green : T.voltageText }}>
                    {reconciled ? '✓ reconciled' : `${good + scrapTotal} / ${requested}`}
                  </span>
                </div>

                <div>
                  <Label className="mb-2 block">Good units — serial numbers ({good})</Label>
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
                    <Button size="sm" variant="ghost" onClick={addScrapEntry} className="h-7 text-amber-600">
                      <Plus className="w-3.5 h-3.5 mr-1" />Add scrap
                    </Button>
                  </div>
                  {scrapEntries.length === 0 ? (
                    <p style={{ fontSize: 12, color: T.iron400 }}>No scrap — all {requested} units passed QC.</p>
                  ) : (
                    <div className="space-y-2">
                      {scrapEntries.map((e, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Input
                            type="number"
                            min="1"
                            value={e.quantity}
                            onChange={(ev) => updateScrap(idx, 'quantity', ev.target.value)}
                            className="w-16"
                            title="Quantity"
                          />
                          <select
                            value={e.reason}
                            onChange={(ev) => updateScrap(idx, 'reason', ev.target.value)}
                            style={{ ...inputStyle, height: 36, width: 176, cursor: 'pointer' }}
                          >
                            <option value="">Reason…</option>
                            {SCRAP_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <Input
                            value={e.notes}
                            onChange={(ev) => updateScrap(idx, 'notes', ev.target.value)}
                            placeholder="Notes (optional)"
                            className="flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => removeScrapEntry(idx)}
                            style={{ color: T.iron400, padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
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
                    className="mt-1"
                    rows={2}
                  />
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleComplete} disabled={actionLoading}>
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Completion'}
                  </Button>
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
            <div className="space-y-4 py-2">
              <div style={{ padding: 12, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                <div style={{ ...mono, fontWeight: 700, color: T.orangeDeep }}>{selectedRequest.request_number}</div>
                <div style={{ fontFamily: T.headline, fontWeight: 600, color: T.iron900, marginBottom: 6 }}>{selectedRequest.master_sku_name}</div>
                <span style={statusPill(selectedRequest.status).style}>{statusPill(selectedRequest.status).label}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <Caps size={8.5} color={T.iron400}>Firm</Caps>
                  <div style={{ fontSize: 13, color: T.iron900, marginTop: 3 }}>{selectedRequest.firm_name}</div>
                </div>
                <div>
                  <Caps size={8.5} color={T.iron400}>Quantity</Caps>
                  <div style={{ ...mono, fontWeight: 700, fontSize: 13, color: T.iron900, marginTop: 3 }}>{selectedRequest.quantity_produced}</div>
                </div>
              </div>

              {selectedRequest.serial_numbers?.length > 0 && (
                <div>
                  <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>Serial Numbers</Caps>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                    {selectedRequest.serial_numbers.map((sn, idx) => (
                      <div key={idx} style={{ padding: 4, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 4, ...mono, fontSize: 11 }}>
                        {sn.serial_number}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 12.5, color: T.iron700 }}>
                <p><span style={{ color: T.iron400 }}>Completed:</span> {fmtDateTime(selectedRequest.completed_at)}</p>
                {selectedRequest.received_at && (
                  <p style={{ marginTop: 4 }}><span style={{ color: T.iron400 }}>Received by Accountant:</span> {fmtDateTime(selectedRequest.received_at)}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

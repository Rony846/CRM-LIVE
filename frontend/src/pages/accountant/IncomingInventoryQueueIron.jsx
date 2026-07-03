import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Inbox, Loader2, CheckCircle, Package, Wrench, Trash2,
  AlertTriangle, Eye, ClipboardList, Box,
  Image as ImageIcon, Video, Play
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

const CLASSIFICATION_TYPES = {
  repair_item:      { label: 'Repair Item',         icon: Wrench,        color: 'bg-blue-600',   description: 'Send to technician queue for repair' },
  return_inventory: { label: 'Return to Inventory', icon: Package,       color: 'bg-green-600',  description: 'Add stock back (return/refund)' },
  repair_yard:      { label: 'Repair Yard Stock',   icon: Box,           color: 'bg-yellow-600', description: 'Recovered/refurbished item' },
  scrap:            { label: 'Scrap / Dead Stock',  icon: Trash2,        color: 'bg-red-600',    description: 'Unusable item, no inventory impact' }
};

// Iron pill tone per classification type.
const CLASSIFY_TONE = {
  repair_item:      'info',
  return_inventory: 'ok',
  repair_yard:      'warn',
  scrap:            'bad',
};

// Iron queue-status chip.
const QUEUE_TONE = { pending: 'warn', classified: 'info', processed: 'ok' };
const QueueStatusChip = ({ status }) => (
  <span style={badgeStyle(QUEUE_TONE[status] || 'slate')}>
    {status ? status.charAt(0).toUpperCase() + status.slice(1) : '-'}
  </span>
);

export default function IncomingInventoryQueue() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  // Data states
  const [queueEntries, setQueueEntries] = useState([]);
  const [firms, setFirms] = useState([]);
  const [skus, setSkus] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [dispatches, setDispatches] = useState([]);

  // Dialog states
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [ticketSearchTerm, setTicketSearchTerm] = useState('');

  // Media viewer state
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [mediaList, setMediaList] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  // New ticket form
  const [newTicketForm, setNewTicketForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    device_type: '',
    brand: '',
    model: '',
    serial_number: '',
    problem_description: ''
  });

  // Classification form
  const [classifyForm, setClassifyForm] = useState({
    classification_type: '',
    ticket_id: '',
    firm_id: '',
    item_type: 'finished_good',
    item_id: '',
    quantity: 1,
    original_dispatch_id: '',
    reason: '',
    reference_number: '',
    scrap_reason: '',
    remarks: ''
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [queueRes, firmsRes, ticketsRes, dispatchesRes, allSkusRes] = await Promise.all([
        axios.get(`${API}/incoming-queue`, { headers }),
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        // Fetch tickets with multiple statuses that might need repair item linking
        axios.get(`${API}/tickets`, { headers, params: { limit: 500 } }).catch(() => ({ data: [] })),
        axios.get(`${API}/dispatches`, { headers }).catch(() => ({ data: [] })),
        // Also fetch all SKUs upfront
        axios.get(`${API}/admin/skus`, { headers, params: { active_only: true } }).catch(() => ({ data: [] }))
      ]);

      setQueueEntries(queueRes.data || []);
      setFirms(firmsRes.data || []);
      // Filter tickets that are relevant for repair linking
      const relevantStatuses = ['received_at_factory', 'in_progress', 'pending_parts', 'diagnosed', 'new', 'pickup_scheduled', 'picked_up'];
      setTickets((ticketsRes.data || []).filter(t => relevantStatuses.includes(t.status)));
      setDispatches((dispatchesRes.data || []).filter(d => d.status === 'dispatched' && d.firm_id));
      // Store all SKUs for easy access
      setSkus(allSkusRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load queue data');
    } finally {
      setLoading(false);
    }
  };

  const fetchItemsByFirm = async (firmId, itemType) => {
    if (!firmId) {
      // If no firm selected, show all items
      if (itemType === 'raw_material') {
        try {
          const headers = { Authorization: `Bearer ${token}` };
          const res = await axios.get(`${API}/raw-materials`, { headers });
          setRawMaterials(res.data || []);
        } catch (error) {
          console.error('Failed to fetch raw materials:', error);
        }
      }
      // SKUs already loaded in fetchData
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      if (itemType === 'raw_material') {
        const res = await axios.get(`${API}/raw-materials`, { headers, params: { firm_id: firmId } });
        setRawMaterials(res.data || []);
      } else {
        // Filter from already loaded SKUs or fetch specifically
        const res = await axios.get(`${API}/admin/skus`, { headers, params: { firm_id: firmId, active_only: true } });
        const firmSkus = res.data || [];
        // If no SKUs found with firm_id filter, show all SKUs
        if (firmSkus.length === 0) {
          const allRes = await axios.get(`${API}/admin/skus`, { headers, params: { active_only: true } });
          setSkus(allRes.data || []);
        } else {
          setSkus(firmSkus);
        }
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    }
  };

  const resetClassifyForm = () => {
    setClassifyForm({
      classification_type: '',
      ticket_id: '',
      firm_id: '',
      item_type: 'finished_good',
      item_id: '',
      quantity: 1,
      original_dispatch_id: '',
      reason: '',
      reference_number: '',
      scrap_reason: '',
      remarks: ''
    });
    setSkus([]);
    setRawMaterials([]);
  };

  const openClassifyDialog = (entry) => {
    setSelectedEntry(entry);
    resetClassifyForm();

    // Pre-fill from linked dispatch if available
    if (entry.linked_dispatch_id) {
      const linkedDispatch = dispatches.find(d => d.id === entry.linked_dispatch_id);
      if (linkedDispatch && linkedDispatch.firm_id) {
        setClassifyForm(prev => ({
          ...prev,
          classification_type: 'return_inventory',
          firm_id: linkedDispatch.firm_id,
          original_dispatch_id: entry.linked_dispatch_id
        }));
        fetchItemsByFirm(linkedDispatch.firm_id, 'finished_good');
      }
    }

    // Pre-fill from linked ticket if available
    if (entry.linked_ticket_id) {
      setClassifyForm(prev => ({
        ...prev,
        classification_type: 'repair_item',
        ticket_id: entry.linked_ticket_id
      }));
    }

    setClassifyOpen(true);
  };

  const handleClassify = async () => {
    const { classification_type } = classifyForm;

    // Validation based on classification type
    if (!classification_type) {
      toast.error('Please select a classification type');
      return;
    }

    if (classification_type === 'repair_item' && !classifyForm.ticket_id) {
      toast.error('Please select a ticket for repair items');
      return;
    }

    if (classification_type === 'return_inventory') {
      if (!classifyForm.firm_id || !classifyForm.item_id) {
        toast.error('Please select firm and item for return inventory');
        return;
      }
    }

    if (classification_type === 'repair_yard') {
      if (!classifyForm.firm_id || !classifyForm.item_id || !classifyForm.reason) {
        toast.error('Firm, item, and reason are MANDATORY for repair yard stock');
        return;
      }
    }

    if (classification_type === 'scrap' && !classifyForm.scrap_reason) {
      toast.error('Please provide a reason for marking as scrap');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/incoming-queue/${selectedEntry.id}/classify`, classifyForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Entry classified successfully');
      setClassifyOpen(false);
      resetClassifyForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to classify entry');
    } finally {
      setActionLoading(false);
    }
  };

  // Create new ticket for repair item
  const handleCreateNewTicket = async () => {
    if (!newTicketForm.customer_name || !newTicketForm.customer_phone || !newTicketForm.device_type) {
      toast.error('Please fill required fields: Customer Name, Phone, and Device Type');
      return;
    }

    setActionLoading(true);
    try {
      const response = await axios.post(`${API}/tickets`, {
        customer_name: newTicketForm.customer_name,
        customer_phone: newTicketForm.customer_phone,
        customer_email: newTicketForm.customer_email || null,
        device_type: newTicketForm.device_type,
        brand: newTicketForm.brand || null,
        model: newTicketForm.model || null,
        serial_number: newTicketForm.serial_number || null,
        problem_description: newTicketForm.problem_description || 'Incoming item for repair',
        status: 'received_at_factory',
        source: 'incoming_queue'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const newTicket = response.data;
      toast.success(`Ticket ${newTicket.ticket_number} created successfully`);

      // Add to tickets list and select it
      setTickets(prev => [newTicket, ...prev]);
      setClassifyForm(prev => ({ ...prev, ticket_id: newTicket.id }));

      // Close new ticket dialog
      setNewTicketOpen(false);
      setNewTicketForm({
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        device_type: '',
        brand: '',
        model: '',
        serial_number: '',
        problem_description: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create ticket');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter tickets by search term
  const filteredTickets = tickets.filter(t => {
    if (!ticketSearchTerm) return true;
    const term = ticketSearchTerm.toLowerCase();
    return (
      (t.ticket_number || '').toLowerCase().includes(term) ||
      (t.customer_name || '').toLowerCase().includes(term) ||
      (t.customer_phone || '').includes(term) ||
      (t.device_type || '').toLowerCase().includes(term) ||
      (t.brand || '').toLowerCase().includes(term)
    );
  });

  const openViewDialog = (entry) => {
    setSelectedEntry(entry);
    setViewOpen(true);
  };

  // Open media viewer for an entry
  const openMediaViewer = async (entry) => {
    if (!entry.tracking_id && !entry.gate_log_id) {
      toast.error('No tracking ID available for this entry');
      return;
    }

    setSelectedEntry(entry);
    setLoadingMedia(true);
    setMediaViewerOpen(true);

    try {
      // Try to get media by gate_log_id first, then by tracking_id
      let res;
      if (entry.gate_log_id) {
        res = await axios.get(`${API}/gate/media/${entry.gate_log_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        res = await axios.get(`${API}/gate/media/by-tracking/${entry.tracking_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setMediaList(res.data.media || []);
      setSelectedMediaIndex(0);
    } catch (error) {
      console.error('Failed to load media:', error);
      toast.error('Failed to load media');
      setMediaList([]);
    } finally {
      setLoadingMedia(false);
    }
  };

  // Filter entries by status
  const pendingEntries = queueEntries.filter(e => e.status === 'pending');
  const processedEntries = queueEntries.filter(e => e.status === 'processed');

  // Stats
  const stats = {
    pending: pendingEntries.length,
    processed: processedEntries.length,
    returnInventory: processedEntries.filter(e => e.classification_type === 'return_inventory').length,
    repairYard: processedEntries.filter(e => e.classification_type === 'repair_yard').length
  };

  // Get items for selected firm
  const availableItems = classifyForm.item_type === 'raw_material' ? rawMaterials : skus;

  const statCards = [
    { label: 'Pending Classification', value: stats.pending, icon: Inbox, tone: stats.pending > 0 ? T.voltageText : T.green },
    { label: 'Processed', value: stats.processed, icon: CheckCircle, tone: T.green },
    { label: 'Returns Added', value: stats.returnInventory, icon: Package, tone: T.blue },
    { label: 'Repair Yard Added', value: stats.repairYard, icon: Box, tone: T.orange },
  ];

  const tabs = [
    { key: 'pending', label: 'Pending', count: stats.pending, icon: Inbox },
    { key: 'processed', label: 'Processed', count: stats.processed, icon: CheckCircle },
  ];

  const pendingHeaders = ['Queue #', 'Tracking', 'Linked To', 'Customer', 'Media', 'Received', 'Status', 'Actions'];
  const processedHeaders = ['Queue #', 'Classification', 'Item', 'Firm', 'Qty', 'Ledger Entry', 'Classified By', 'Date', 'View'];

  const mediaBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };
  const classifyBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };
  const viewBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '5px 9px', cursor: 'pointer' };

  return (
    <IronShell
      title="Incoming Queue"
      subtitle={`${stats.pending} PENDING · ${stats.processed} PROCESSED`}
      onRefresh={fetchData}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
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

          {/* Alert for pending items */}
          {stats.pending > 0 && (
            <div style={{ padding: 14, background: T.voltageTint, border: `1px solid #EDDFA6`, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertTriangle size={18} color={T.voltageText} style={{ flexShrink: 0 }} />
              <p style={{ color: T.voltageText, fontSize: 12.5, margin: 0 }}>
                <strong style={{ fontWeight: 700 }}>{stats.pending} item(s)</strong> pending classification.
                Stock will NOT be updated until classification is complete.
              </p>
            </div>
          )}

          {/* Tabs + tables */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 6, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              {tabs.map((tb) => {
                const Icon = tb.icon;
                const active = activeTab === tb.key;
                return (
                  <button key={tb.key} onClick={() => setActiveTab(tb.key)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                    <Icon size={14} strokeWidth={2} />{tb.label}
                    <span style={{ ...mono, fontSize: 11, opacity: 0.85 }}>({tb.count})</span>
                  </button>
                );
              })}
            </div>

            {/* Pending Tab */}
            {activeTab === 'pending' && (
              pendingEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                  <CheckCircle size={44} color={T.green} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                  <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>All caught up! No pending items.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {pendingHeaders.map((h, i) => <th key={i} style={{ ...thCell, textAlign: i === pendingHeaders.length - 1 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>)}
                    </tr></thead>
                    <tbody>{pendingEntries.map((entry) => (
                      <tr key={entry.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }} data-testid={`queue-row-${entry.id}`}>
                        <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.iron900 }}>{entry.queue_number}</td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{entry.tracking_id || '-'}</td>
                        <td style={tdCell}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {entry.linked_ticket_number && (
                              <span style={badgeStyle('info')}>Ticket: {entry.linked_ticket_number}</span>
                            )}
                            {entry.linked_dispatch_number && (
                              <span style={badgeStyle('violet')}>Dispatch: {entry.linked_dispatch_number}</span>
                            )}
                            {!entry.linked_ticket_number && !entry.linked_dispatch_number && (
                              <span style={{ ...mono, fontSize: 11, color: T.iron400 }}>Manual Entry</span>
                            )}
                          </div>
                        </td>
                        <td style={{ ...tdCell, color: T.iron900 }}>{entry.customer_name || '-'}</td>
                        <td style={tdCell}>
                          {entry.media_attached || entry.images_count > 0 ? (
                            <button onClick={() => openMediaViewer(entry)} style={mediaBtnStyle}>
                              <ImageIcon size={13} />
                              {entry.images_count || 0}
                              {entry.videos_count > 0 && (
                                <>
                                  <Video size={13} style={{ marginLeft: 4 }} />
                                  {entry.videos_count}
                                </>
                              )}
                            </button>
                          ) : entry.gate_log_id ? (
                            <button onClick={() => openMediaViewer(entry)} style={{ ...mediaBtnStyle, color: T.iron700 }}>
                              <Eye size={13} /> View
                            </button>
                          ) : (
                            <span style={{ ...mono, fontSize: 11, color: T.iron400 }}>-</span>
                          )}
                        </td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>
                          {new Date(entry.scanned_at || entry.created_at).toLocaleString()}
                        </td>
                        <td style={tdCell}><QueueStatusChip status={entry.status} /></td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <button onClick={() => openClassifyDialog(entry)} style={classifyBtnStyle} data-testid={`classify-btn-${entry.id}`}>
                            <ClipboardList size={13} /> Classify
                          </button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )
            )}

            {/* Processed Tab */}
            {activeTab === 'processed' && (
              processedEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                  <Inbox size={44} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                  <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No processed items yet</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {processedHeaders.map((h, i) => <th key={i} style={{ ...thCell, textAlign: i === processedHeaders.length - 1 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>)}
                    </tr></thead>
                    <tbody>{processedEntries.map((entry) => {
                      const classType = CLASSIFICATION_TYPES[entry.classification_type];
                      return (
                        <tr key={entry.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                          <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.iron900 }}>{entry.queue_number}</td>
                          <td style={tdCell}>
                            <span style={badgeStyle(CLASSIFY_TONE[entry.classification_type] || 'slate')}>
                              {classType?.label || entry.classification_type}
                            </span>
                          </td>
                          <td style={{ ...tdCell, color: T.iron900 }}>
                            {entry.classified_item_name && (
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 12.5 }}>{entry.classified_item_name}</div>
                                <div style={{ ...mono, fontSize: 10.5, color: T.iron400 }}>{entry.classified_item_sku}</div>
                              </div>
                            )}
                            {entry.classification_type === 'repair_item' && entry.classified_ticket_id && (
                              <span style={{ ...mono, fontSize: 10.5, color: T.blue }}>→ Ticket Queue</span>
                            )}
                            {entry.classification_type === 'scrap' && (
                              <span style={{ ...mono, fontSize: 10.5, color: T.rose }}>Scrapped</span>
                            )}
                          </td>
                          <td style={{ ...tdCell, color: T.iron500 }}>{entry.classified_firm_name || '-'}</td>
                          <td style={{ ...tdCell, ...mono, color: T.iron900, textAlign: 'center' }}>{entry.classified_quantity || '-'}</td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.orangeDeep }}>{entry.ledger_entry_number || '-'}</td>
                          <td style={{ ...tdCell, fontSize: 12, color: T.iron500 }}>{entry.classified_by_name}</td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>
                            {entry.classified_at && new Date(entry.classified_at).toLocaleDateString()}
                          </td>
                          <td style={{ ...tdCell, textAlign: 'right' }}>
                            <button onClick={() => openViewDialog(entry)} title="View" style={viewBtnStyle}><Eye size={14} /></button>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              )
            )}
          </IronCard>
        </>
      )}

      {/* ── Classify Dialog ── */}
      <Dialog open={classifyOpen} onOpenChange={setClassifyOpen}>
        <DialogContent className="bg-white border border-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Classify Incoming Item</DialogTitle>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              {/* Entry Info */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  <div><span className="text-slate-500">Queue #: </span><span className="text-slate-900 tabular-nums">{selectedEntry.queue_number}</span></div>
                  <div><span className="text-slate-500">Tracking: </span><span className="text-slate-900">{selectedEntry.tracking_id || 'N/A'}</span></div>
                  {selectedEntry.linked_ticket_number && (
                    <div><span className="text-slate-500">Linked Ticket: </span><span className="text-sky-600">{selectedEntry.linked_ticket_number}</span></div>
                  )}
                  {selectedEntry.linked_dispatch_number && (
                    <div><span className="text-slate-500">Linked Dispatch: </span><span className="text-violet-600">{selectedEntry.linked_dispatch_number}</span></div>
                  )}
                  {selectedEntry.customer_name && (
                    <div><span className="text-slate-500">Customer: </span><span className="text-slate-900">{selectedEntry.customer_name}</span></div>
                  )}
                </div>
              </div>

              {/* Classification Type Selection */}
              <div>
                <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Classification Type *</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(CLASSIFICATION_TYPES).map(([key, type]) => {
                    const Icon = type.icon;
                    const active = classifyForm.classification_type === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setClassifyForm(prev => ({ ...prev, classification_type: key }));
                          if (key !== 'return_inventory' && key !== 'repair_yard') {
                            setSkus([]);
                            setRawMaterials([]);
                          } else {
                            // Pre-fetch items for Return/Repair Yard
                            fetchItemsByFirm(classifyForm.firm_id || null, classifyForm.item_type);
                          }
                        }}
                        className="p-3 rounded-lg border text-left transition-all"
                        style={{ borderColor: active ? T.orange : T.iron200, background: active ? '#FDEEE6' : T.white }}
                        data-testid={`classify-type-${key}`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color: active ? T.orangeDeep : T.iron500 }} />
                          <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-900">{type.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{type.description}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Info boxes explaining where items go */}
                {classifyForm.classification_type && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    {classifyForm.classification_type === 'repair_item' && (
                      <div className="font-mono text-sm">
                        <p className="text-sky-600 font-semibold mb-1">→ Where it goes:</p>
                        <p className="text-slate-500">Item will be linked to a service ticket and tracked in the <strong className="text-slate-900">Tickets</strong> section. The customer's device will go through the repair workflow until completion.</p>
                      </div>
                    )}
                    {classifyForm.classification_type === 'return_inventory' && (
                      <div className="font-mono text-sm">
                        <p className="text-emerald-600 font-semibold mb-1">→ Where it goes:</p>
                        <p className="text-slate-500">Stock will be added back to <strong className="text-slate-900">Inventory → Stock Reports</strong> for the selected Firm/SKU. The quantity will increase in your available stock for sales/dispatch.</p>
                      </div>
                    )}
                    {classifyForm.classification_type === 'repair_yard' && (
                      <div className="font-mono text-sm">
                        <p className="text-amber-600 font-semibold mb-1">→ Where it goes:</p>
                        <p className="text-slate-500">Item goes to <strong className="text-slate-900">Repair/Stock Yard</strong> — a holding area for items that need repair before being added to sellable inventory.</p>
                      </div>
                    )}
                    {classifyForm.classification_type === 'scrap' && (
                      <div className="font-mono text-sm">
                        <p className="text-rose-600 font-semibold mb-1">→ Where it goes:</p>
                        <p className="text-slate-500">Item is marked as <strong className="text-slate-900">Scrap/Write-off</strong> and removed from active inventory. Recorded for audit purposes but not added to stock.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Repair Item Fields */}
              {classifyForm.classification_type === 'repair_item' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Link to Ticket *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewTicketOpen(true)}
                      className="text-orange-600 border-orange-300 hover:bg-orange-50 font-mono text-[10px] uppercase tracking-wide"
                    >
                      + Create New Ticket
                    </Button>
                  </div>

                  {/* Ticket Search */}
                  <Input
                    placeholder="Search tickets by number, customer, phone, device..."
                    value={ticketSearchTerm}
                    onChange={(e) => setTicketSearchTerm(e.target.value)}
                  />

                  <Select
                    value={classifyForm.ticket_id}
                    onValueChange={(v) => setClassifyForm({...classifyForm, ticket_id: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ticket" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {selectedEntry?.linked_ticket_id && (
                        <SelectItem value={selectedEntry.linked_ticket_id}>
                          <div className="py-1">
                            <div className="font-mono font-semibold text-sm">{selectedEntry.linked_ticket_number} (Auto-linked)</div>
                            <div className="font-mono text-[11px] text-slate-500">{selectedEntry.customer_name}</div>
                          </div>
                        </SelectItem>
                      )}
                      {filteredTickets.filter(t => t.id !== selectedEntry?.linked_ticket_id).map(ticket => (
                        <SelectItem key={ticket.id} value={ticket.id}>
                          <div className="py-1">
                            <div className="font-mono font-semibold text-sm">{ticket.ticket_number}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {ticket.customer_name} | {ticket.customer_phone} | {ticket.device_type} {ticket.brand || ''}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              Status: {ticket.status} | Created: {new Date(ticket.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                      {filteredTickets.length === 0 && (
                        <div className="p-3 text-center text-slate-500 font-mono text-[11px]">
                          No tickets found. Create a new ticket above.
                        </div>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Show selected ticket details */}
                  {classifyForm.ticket_id && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      {(() => {
                        const selectedTicket = tickets.find(t => t.id === classifyForm.ticket_id);
                        if (!selectedTicket) return null;
                        return (
                          <div className="space-y-1 font-mono text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Ticket:</span>
                              <span className="text-slate-900 font-semibold">{selectedTicket.ticket_number}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Customer:</span>
                              <span className="text-slate-900">{selectedTicket.customer_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Phone:</span>
                              <span className="text-slate-900 tabular-nums">{selectedTicket.customer_phone}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Device:</span>
                              <span className="text-slate-900">{selectedTicket.device_type} {selectedTicket.brand} {selectedTicket.model}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Problem:</span>
                              <span className="text-slate-900 truncate max-w-[200px]">{selectedTicket.problem_description}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Return Inventory / Repair Yard Fields */}
              {(classifyForm.classification_type === 'return_inventory' || classifyForm.classification_type === 'repair_yard') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Firm *</Label>
                      <Select
                        value={classifyForm.firm_id}
                        onValueChange={(v) => {
                          setClassifyForm({...classifyForm, firm_id: v, item_id: ''});
                          fetchItemsByFirm(v, classifyForm.item_type);
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select firm" />
                        </SelectTrigger>
                        <SelectContent>
                          {firms.map(firm => (
                            <SelectItem key={firm.id} value={firm.id}>
                              {firm.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Item Type *</Label>
                      <Select
                        value={classifyForm.item_type}
                        onValueChange={(v) => {
                          setClassifyForm({...classifyForm, item_type: v, item_id: ''});
                          if (classifyForm.firm_id) {
                            fetchItemsByFirm(classifyForm.firm_id, v);
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="finished_good">Finished Good (SKU)</SelectItem>
                          <SelectItem value="raw_material">Raw Material</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Item *</Label>
                    <Select
                      value={classifyForm.item_id}
                      onValueChange={(v) => setClassifyForm({...classifyForm, item_id: v})}
                      disabled={!classifyForm.firm_id}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={classifyForm.firm_id ? "Select item" : "Select firm first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableItems.map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.model_name || item.name} ({item.sku_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Quantity</Label>
                      <Input
                        type="number"
                        value={classifyForm.quantity}
                        onChange={(e) => setClassifyForm({...classifyForm, quantity: parseInt(e.target.value) || 1})}
                        min="1"
                        className="mt-1"
                      />
                    </div>
                    {classifyForm.classification_type === 'return_inventory' && (
                      <div>
                        <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Original Dispatch</Label>
                        <Select
                          value={classifyForm.original_dispatch_id || 'none'}
                          onValueChange={(v) => setClassifyForm({...classifyForm, original_dispatch_id: v === 'none' ? '' : v})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Optional - link to dispatch" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {selectedEntry.linked_dispatch_id && (
                              <SelectItem value={selectedEntry.linked_dispatch_id}>
                                {selectedEntry.linked_dispatch_number} (Auto-linked)
                              </SelectItem>
                            )}
                            {dispatches.filter(d => d.firm_id === classifyForm.firm_id && d.id !== selectedEntry.linked_dispatch_id).map(d => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.dispatch_number} - {d.customer_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {classifyForm.classification_type === 'repair_yard' && (
                    <>
                      <div>
                        <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">
                          Reason * <span className="text-amber-600">(Mandatory)</span>
                        </Label>
                        <Textarea
                          value={classifyForm.reason}
                          onChange={(e) => setClassifyForm({...classifyForm, reason: e.target.value})}
                          placeholder="Why is this item being added to inventory from repair yard?"
                          className="mt-1"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Reference Number</Label>
                        <Input
                          value={classifyForm.reference_number}
                          onChange={(e) => setClassifyForm({...classifyForm, reference_number: e.target.value})}
                          placeholder="Internal reference or document number"
                          className="mt-1"
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Scrap Fields */}
              {classifyForm.classification_type === 'scrap' && (
                <div>
                  <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Scrap Reason *</Label>
                  <Textarea
                    value={classifyForm.scrap_reason}
                    onChange={(e) => setClassifyForm({...classifyForm, scrap_reason: e.target.value})}
                    placeholder="Why is this item being marked as scrap?"
                    className="mt-1"
                    rows={2}
                  />
                </div>
              )}

              {/* Remarks */}
              <div>
                <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Additional Remarks</Label>
                <Textarea
                  value={classifyForm.remarks}
                  onChange={(e) => setClassifyForm({...classifyForm, remarks: e.target.value})}
                  placeholder="Any additional notes..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setClassifyOpen(false)} className="text-slate-500">
              Cancel
            </Button>
            <Button
              onClick={handleClassify}
              disabled={actionLoading || !classifyForm.classification_type}
              className="bg-orange-500 hover:bg-orange-600 text-white font-mono text-[11px] uppercase tracking-wide"
              data-testid="submit-classify-btn"
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Classify & Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Dialog ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="bg-white border border-slate-200 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Queue Entry Details</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Queue Number</Label>
                  <p className="text-slate-900 font-mono tabular-nums mt-0.5">{selectedEntry.queue_number}</p>
                </div>
                <div>
                  <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Status</Label>
                  <div className="mt-0.5">
                    <QueueStatusChip status={selectedEntry.status} />
                  </div>
                </div>
                {selectedEntry.classification_type && (
                  <div className="col-span-2">
                    <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Classification</Label>
                    <div className="mt-0.5">
                      <span style={badgeStyle(CLASSIFY_TONE[selectedEntry.classification_type] || 'slate')}>
                        {CLASSIFICATION_TYPES[selectedEntry.classification_type]?.label}
                      </span>
                    </div>
                  </div>
                )}
                {selectedEntry.classified_item_name && (
                  <>
                    <div>
                      <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Item</Label>
                      <p className="text-slate-900 mt-0.5">{selectedEntry.classified_item_name}</p>
                      <p className="font-mono text-[11px] text-slate-500">{selectedEntry.classified_item_sku}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Quantity</Label>
                      <p className="font-mono tabular-nums text-slate-900 mt-0.5">{selectedEntry.classified_quantity}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Firm</Label>
                      <p className="text-slate-900 mt-0.5">{selectedEntry.classified_firm_name}</p>
                    </div>
                  </>
                )}
                {selectedEntry.ledger_entry_number && (
                  <div>
                    <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Ledger Entry</Label>
                    <p className="font-mono tabular-nums text-orange-600 mt-0.5">{selectedEntry.ledger_entry_number}</p>
                  </div>
                )}
                {selectedEntry.reason && (
                  <div className="col-span-2">
                    <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Reason</Label>
                    <p className="text-slate-900 mt-0.5">{selectedEntry.reason}</p>
                  </div>
                )}
                {selectedEntry.scrap_reason && (
                  <div className="col-span-2">
                    <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Scrap Reason</Label>
                    <p className="text-rose-600 mt-0.5">{selectedEntry.scrap_reason}</p>
                  </div>
                )}
                <div className="col-span-2 pt-3 border-t border-slate-200">
                  <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Classified By</Label>
                  <p className="text-slate-900 mt-0.5">{selectedEntry.classified_by_name || '-'}</p>
                  <p className="font-mono text-[11px] tabular-nums text-slate-500">
                    {selectedEntry.classified_at && new Date(selectedEntry.classified_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setViewOpen(false)} className="text-slate-500">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Ticket Dialog ── */}
      <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
        <DialogContent className="bg-white border border-slate-200 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Create New Ticket for Repair Item</DialogTitle>
            <DialogDescription className="text-slate-500 font-mono text-[11px]">
              Enter customer details to create a new service ticket and link it to this incoming item.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Customer Name *</Label>
                <Input
                  value={newTicketForm.customer_name}
                  onChange={(e) => setNewTicketForm({...newTicketForm, customer_name: e.target.value})}
                  placeholder="Full name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Phone Number *</Label>
                <Input
                  value={newTicketForm.customer_phone}
                  onChange={(e) => setNewTicketForm({...newTicketForm, customer_phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                  placeholder="10-digit mobile"
                  className="mt-1"
                  maxLength={10}
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Email (Optional)</Label>
              <Input
                type="email"
                value={newTicketForm.customer_email}
                onChange={(e) => setNewTicketForm({...newTicketForm, customer_email: e.target.value})}
                placeholder="customer@example.com"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Device Type *</Label>
                <Select
                  value={newTicketForm.device_type}
                  onValueChange={(v) => setNewTicketForm({...newTicketForm, device_type: v})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inverter">Inverter</SelectItem>
                    <SelectItem value="Battery">Battery</SelectItem>
                    <SelectItem value="Stabilizer">Stabilizer</SelectItem>
                    <SelectItem value="Solar Inverter">Solar Inverter</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Brand</Label>
                <Input
                  value={newTicketForm.brand}
                  onChange={(e) => setNewTicketForm({...newTicketForm, brand: e.target.value})}
                  placeholder="e.g., MuscleGrid"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Model</Label>
                <Input
                  value={newTicketForm.model}
                  onChange={(e) => setNewTicketForm({...newTicketForm, model: e.target.value})}
                  placeholder="Model number"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Serial Number</Label>
              <Input
                value={newTicketForm.serial_number}
                onChange={(e) => setNewTicketForm({...newTicketForm, serial_number: e.target.value})}
                placeholder="Device serial number"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-500 font-mono text-[11px] uppercase tracking-wide">Problem Description</Label>
              <Textarea
                value={newTicketForm.problem_description}
                onChange={(e) => setNewTicketForm({...newTicketForm, problem_description: e.target.value})}
                placeholder="Describe the issue..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewTicketOpen(false)} className="text-slate-500">
              Cancel
            </Button>
            <Button
              onClick={handleCreateNewTicket}
              disabled={actionLoading || !newTicketForm.customer_name || !newTicketForm.customer_phone || !newTicketForm.device_type}
              className="bg-orange-500 hover:bg-orange-600 text-white font-mono text-[11px] uppercase tracking-wide"
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Ticket & Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Media Viewer Dialog ── */}
      <Dialog open={mediaViewerOpen} onOpenChange={setMediaViewerOpen}>
        <DialogContent className="bg-white border border-slate-200 max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <ImageIcon className="w-5 h-5 text-orange-600" />
              Inward Media — {selectedEntry?.tracking_id || selectedEntry?.queue_number}
            </DialogTitle>
          </DialogHeader>

          {loadingMedia ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : mediaList.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-mono text-[11px] uppercase tracking-wide">No media available for this entry</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Main Media Viewer */}
              <div className="relative bg-black/80 rounded-lg overflow-hidden aspect-video border border-slate-200">
                {mediaList[selectedMediaIndex]?.media_type === 'image' ? (
                  <img
                    src={`${API}/gate/media/download/${mediaList[selectedMediaIndex]?.id}?token=${token}`}
                    alt={mediaList[selectedMediaIndex]?.filename}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><p class="mt-2 text-sm">Image not available</p><p class="text-xs text-slate-500">File may have been moved or deleted from storage</p></div>';
                    }}
                  />
                ) : (
                  <video
                    src={`${API}/gate/media/download/${mediaList[selectedMediaIndex]?.id}?token=${token}`}
                    controls
                    className="w-full h-full"
                  />
                )}

                {/* Navigation arrows */}
                {mediaList.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedMediaIndex(prev => Math.max(0, prev - 1))}
                      disabled={selectedMediaIndex === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white disabled:opacity-30 hover:bg-black/80 transition-colors"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => setSelectedMediaIndex(prev => Math.min(mediaList.length - 1, prev + 1))}
                      disabled={selectedMediaIndex === mediaList.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white disabled:opacity-30 hover:bg-black/80 transition-colors"
                    >
                      ›
                    </button>
                  </>
                )}

                {/* Media counter */}
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white font-mono text-sm tabular-nums">
                  {selectedMediaIndex + 1} / {mediaList.length}
                </div>
              </div>

              {/* Thumbnails */}
              {mediaList.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {mediaList.map((m, idx) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMediaIndex(idx)}
                      className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors"
                      style={{ borderColor: idx === selectedMediaIndex ? T.orange : T.iron200 }}
                    >
                      {m.media_type === 'image' ? (
                        <img
                          src={`${API}/gate/media/download/${m.id}`}
                          alt={m.filename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23334155" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%2394a3b8" font-size="12">N/A</text></svg>';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                          <Play className="w-6 h-6 text-slate-500" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Media Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-sm">
                <div>
                  <p className="text-slate-500 text-[11px] uppercase tracking-wide">Filename</p>
                  <p className="text-slate-900">{mediaList[selectedMediaIndex]?.filename}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[11px] uppercase tracking-wide">Type</p>
                  <p className="text-slate-900">{mediaList[selectedMediaIndex]?.media_type}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[11px] uppercase tracking-wide">Captured</p>
                  <p className="text-slate-900 tabular-nums">
                    {mediaList[selectedMediaIndex]?.uploaded_at &&
                      new Date(mediaList[selectedMediaIndex].uploaded_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-[11px] uppercase tracking-wide">Source</p>
                  <p className="text-slate-900">{mediaList[selectedMediaIndex]?.capture_source || 'camera'}</p>
                </div>
              </div>

              {/* Summary */}
              <div className="flex gap-3 pt-2 border-t border-slate-200">
                <span style={badgeStyle('bad')} className="flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  {mediaList.filter(m => m.media_type === 'image').length} Images
                </span>
                {mediaList.filter(m => m.media_type === 'video').length > 0 && (
                  <span style={badgeStyle('violet')} className="flex items-center gap-1">
                    <Video className="w-3 h-3" />
                    {mediaList.filter(m => m.media_type === 'video').length} Videos
                  </span>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setMediaViewerOpen(false)} className="text-slate-500">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

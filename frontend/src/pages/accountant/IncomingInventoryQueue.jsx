import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Inbox, Loader2, CheckCircle, Package, Wrench, Trash2,
  ArrowLeftRight, AlertTriangle, Eye, ClipboardList, Building2, Box,
  Image as ImageIcon, Video, Play, X
} from 'lucide-react';

const CLASSIFICATION_TYPES = {
  repair_item:      { label: 'Repair Item',         icon: Wrench,        color: 'bg-blue-600',   description: 'Send to technician queue for repair' },
  return_inventory: { label: 'Return to Inventory', icon: Package,       color: 'bg-green-600',  description: 'Add stock back (return/refund)' },
  repair_yard:      { label: 'Repair Yard Stock',   icon: Box,           color: 'bg-yellow-600', description: 'Recovered/refurbished item' },
  scrap:            { label: 'Scrap / Dead Stock',  icon: Trash2,        color: 'bg-red-600',    description: 'Unusable item, no inventory impact' }
};

// Dark-themed classification chip colours
const CLASSIFY_CHIP = {
  repair_item:      'bg-sky-500/15 text-sky-400 ring-sky-500/25',
  return_inventory: 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25',
  repair_yard:      'bg-amber-400/15 text-amber-400 ring-amber-400/25',
  scrap:            'bg-rose-500/15 text-rose-400 ring-rose-500/25',
};

const STATUS_COLORS = {
  pending:    'bg-orange-600',
  classified: 'bg-blue-600',
  processed:  'bg-green-600'
};

// Dark queue-status chip
const QueueStatusChip = ({ status }) => {
  const map = {
    pending:    'bg-amber-400/15 text-amber-400 ring-amber-400/25',
    classified: 'bg-sky-500/15 text-sky-400 ring-sky-500/25',
    processed:  'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25',
  };
  const cls = map[status] || 'bg-muted text-muted-foreground ring-border';
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

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

  if (loading) {
    return (
      <DashboardLayout title="Incoming Inventory Queue">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Incoming Inventory Queue">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Pending Classification"
            value={stats.pending}
            icon={Inbox}
            tone={stats.pending > 0 ? 'amber' : 'emerald'}
          />
          <StatCard
            title="Processed Today"
            value={stats.processed}
            icon={CheckCircle}
            tone="emerald"
          />
          <StatCard
            title="Returns Added"
            value={stats.returnInventory}
            icon={Package}
            tone="sky"
          />
          <StatCard
            title="Repair Yard Added"
            value={stats.repairYard}
            icon={Box}
            tone="amber"
          />
        </div>

        {/* Alert for pending items */}
        {stats.pending > 0 && (
          <div className="p-4 bg-amber-400/[0.08] border border-amber-400/25 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <p className="text-amber-400 text-sm">
                <strong className="font-semibold">{stats.pending} item(s)</strong> pending classification.
                Stock will NOT be updated until classification is complete.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Card className="mg-card border border-border bg-card">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <CardHeader className="pb-0">
              <TabsList className="bg-muted">
                <TabsTrigger value="pending" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
                  <Inbox className="w-4 h-4 mr-2" />
                  Pending ({stats.pending})
                </TabsTrigger>
                <TabsTrigger value="processed" className="data-[state=active]:bg-card data-[state=active]:text-foreground font-mono text-[11px] uppercase tracking-wide">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Processed ({stats.processed})
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Pending Tab */}
              <TabsContent value="pending" className="mt-0">
                {pendingEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-500 opacity-50" />
                    <p className="font-mono text-[11px] uppercase tracking-wide">All caught up! No pending items.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Queue #</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Tracking</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Linked To</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Customer</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Media</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Received</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Status</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingEntries.map((entry) => (
                          <TableRow key={entry.id} className="border-border hover:bg-muted/40" data-testid={`queue-row-${entry.id}`}>
                            <TableCell className="font-mono tabular-nums text-foreground font-semibold">{entry.queue_number}</TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">{entry.tracking_id || '-'}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {entry.linked_ticket_number && (
                                  <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25">
                                    Ticket: {entry.linked_ticket_number}
                                  </span>
                                )}
                                {entry.linked_dispatch_number && (
                                  <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25">
                                    Dispatch: {entry.linked_dispatch_number}
                                  </span>
                                )}
                                {!entry.linked_ticket_number && !entry.linked_dispatch_number && (
                                  <span className="text-muted-foreground font-mono text-[11px]">Manual Entry</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-foreground">{entry.customer_name || '-'}</TableCell>
                            <TableCell>
                              {entry.media_attached || entry.images_count > 0 ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openMediaViewer(entry)}
                                  className="text-primary hover:text-primary/80 hover:bg-primary/10 font-mono text-[11px]"
                                >
                                  <ImageIcon className="w-4 h-4 mr-1" />
                                  {entry.images_count || 0}
                                  {entry.videos_count > 0 && (
                                    <>
                                      <Video className="w-4 h-4 ml-2 mr-1" />
                                      {entry.videos_count}
                                    </>
                                  )}
                                </Button>
                              ) : entry.gate_log_id ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openMediaViewer(entry)}
                                  className="text-muted-foreground hover:text-foreground font-mono text-[11px]"
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                              ) : (
                                <span className="text-muted-foreground font-mono text-[11px]">-</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                              {new Date(entry.scanned_at || entry.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <QueueStatusChip status={entry.status} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => openClassifyDialog(entry)}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[10px] uppercase tracking-wide"
                                data-testid={`classify-btn-${entry.id}`}
                              >
                                <ClipboardList className="w-4 h-4 mr-1" />
                                Classify
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* Processed Tab */}
              <TabsContent value="processed" className="mt-0">
                {processedEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Inbox className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="font-mono text-[11px] uppercase tracking-wide">No processed items yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Queue #</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Classification</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Item</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Firm</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Qty</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Ledger Entry</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Classified By</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Date</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">View</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedEntries.map((entry) => {
                          const classType = CLASSIFICATION_TYPES[entry.classification_type];
                          const chipCls = CLASSIFY_CHIP[entry.classification_type] || 'bg-muted text-muted-foreground ring-border';
                          return (
                            <TableRow key={entry.id} className="border-border hover:bg-muted/40">
                              <TableCell className="font-mono tabular-nums text-foreground font-semibold">{entry.queue_number}</TableCell>
                              <TableCell>
                                <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${chipCls}`}>
                                  {classType?.label || entry.classification_type}
                                </span>
                              </TableCell>
                              <TableCell className="text-foreground">
                                {entry.classified_item_name && (
                                  <div>
                                    <div className="font-medium">{entry.classified_item_name}</div>
                                    <div className="font-mono text-[11px] text-muted-foreground">{entry.classified_item_sku}</div>
                                  </div>
                                )}
                                {entry.classification_type === 'repair_item' && entry.classified_ticket_id && (
                                  <span className="font-mono text-[11px] text-sky-400">→ Ticket Queue</span>
                                )}
                                {entry.classification_type === 'scrap' && (
                                  <span className="font-mono text-[11px] text-rose-400">Scrapped</span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{entry.classified_firm_name || '-'}</TableCell>
                              <TableCell className="font-mono tabular-nums text-foreground text-center">{entry.classified_quantity || '-'}</TableCell>
                              <TableCell className="font-mono tabular-nums text-primary text-sm">
                                {entry.ledger_entry_number || '-'}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">{entry.classified_by_name}</TableCell>
                              <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                                {entry.classified_at && new Date(entry.classified_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openViewDialog(entry)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* ── Classify Dialog ── */}
        <Dialog open={classifyOpen} onOpenChange={setClassifyOpen}>
          <DialogContent className="bg-popover border border-border max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Classify Incoming Item</DialogTitle>
            </DialogHeader>

            {selectedEntry && (
              <div className="space-y-4">
                {/* Entry Info */}
                <div className="p-3 bg-muted rounded-lg border border-border">
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                    <div><span className="text-muted-foreground">Queue #: </span><span className="text-foreground tabular-nums">{selectedEntry.queue_number}</span></div>
                    <div><span className="text-muted-foreground">Tracking: </span><span className="text-foreground">{selectedEntry.tracking_id || 'N/A'}</span></div>
                    {selectedEntry.linked_ticket_number && (
                      <div><span className="text-muted-foreground">Linked Ticket: </span><span className="text-sky-400">{selectedEntry.linked_ticket_number}</span></div>
                    )}
                    {selectedEntry.linked_dispatch_number && (
                      <div><span className="text-muted-foreground">Linked Dispatch: </span><span className="text-violet-400">{selectedEntry.linked_dispatch_number}</span></div>
                    )}
                    {selectedEntry.customer_name && (
                      <div><span className="text-muted-foreground">Customer: </span><span className="text-foreground">{selectedEntry.customer_name}</span></div>
                    )}
                  </div>
                </div>

                {/* Classification Type Selection */}
                <div>
                  <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Classification Type *</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {Object.entries(CLASSIFICATION_TYPES).map(([key, type]) => {
                      const Icon = type.icon;
                      const active = classifyForm.classification_type === key;
                      const chipCls = CLASSIFY_CHIP[key] || '';
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
                          className={`p-3 rounded-lg border text-left transition-all ${
                            active
                              ? `ring-1 ${chipCls} border-transparent`
                              : 'bg-muted border-border hover:border-muted-foreground/40'
                          }`}
                          data-testid={`classify-type-${key}`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${active ? '' : 'text-muted-foreground'}`} />
                            <span className={`font-mono text-[11px] font-semibold uppercase tracking-wide ${active ? '' : 'text-foreground'}`}>{type.label}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">{type.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Info boxes explaining where items go */}
                  {classifyForm.classification_type && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/60 border border-border">
                      {classifyForm.classification_type === 'repair_item' && (
                        <div className="font-mono text-sm">
                          <p className="text-sky-400 font-semibold mb-1">→ Where it goes:</p>
                          <p className="text-muted-foreground">Item will be linked to a service ticket and tracked in the <strong className="text-foreground">Tickets</strong> section. The customer's device will go through the repair workflow until completion.</p>
                        </div>
                      )}
                      {classifyForm.classification_type === 'return_inventory' && (
                        <div className="font-mono text-sm">
                          <p className="text-emerald-500 font-semibold mb-1">→ Where it goes:</p>
                          <p className="text-muted-foreground">Stock will be added back to <strong className="text-foreground">Inventory → Stock Reports</strong> for the selected Firm/SKU. The quantity will increase in your available stock for sales/dispatch.</p>
                        </div>
                      )}
                      {classifyForm.classification_type === 'repair_yard' && (
                        <div className="font-mono text-sm">
                          <p className="text-amber-400 font-semibold mb-1">→ Where it goes:</p>
                          <p className="text-muted-foreground">Item goes to <strong className="text-foreground">Repair/Stock Yard</strong> — a holding area for items that need repair before being added to sellable inventory.</p>
                        </div>
                      )}
                      {classifyForm.classification_type === 'scrap' && (
                        <div className="font-mono text-sm">
                          <p className="text-rose-400 font-semibold mb-1">→ Where it goes:</p>
                          <p className="text-muted-foreground">Item is marked as <strong className="text-foreground">Scrap/Write-off</strong> and removed from active inventory. Recorded for audit purposes but not added to stock.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Repair Item Fields */}
                {classifyForm.classification_type === 'repair_item' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Link to Ticket *</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setNewTicketOpen(true)}
                        className="text-primary border-primary/40 hover:bg-primary/10 font-mono text-[10px] uppercase tracking-wide"
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
                              <div className="font-mono text-[11px] text-muted-foreground">{selectedEntry.customer_name}</div>
                            </div>
                          </SelectItem>
                        )}
                        {filteredTickets.filter(t => t.id !== selectedEntry?.linked_ticket_id).map(ticket => (
                          <SelectItem key={ticket.id} value={ticket.id}>
                            <div className="py-1">
                              <div className="font-mono font-semibold text-sm">{ticket.ticket_number}</div>
                              <div className="font-mono text-[11px] text-muted-foreground">
                                {ticket.customer_name} | {ticket.customer_phone} | {ticket.device_type} {ticket.brand || ''}
                              </div>
                              <div className="font-mono text-[11px] text-muted-foreground/70">
                                Status: {ticket.status} | Created: {new Date(ticket.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                        {filteredTickets.length === 0 && (
                          <div className="p-3 text-center text-muted-foreground font-mono text-[11px]">
                            No tickets found. Create a new ticket above.
                          </div>
                        )}
                      </SelectContent>
                    </Select>

                    {/* Show selected ticket details */}
                    {classifyForm.ticket_id && (
                      <div className="p-3 bg-muted rounded-lg border border-border">
                        {(() => {
                          const selectedTicket = tickets.find(t => t.id === classifyForm.ticket_id);
                          if (!selectedTicket) return null;
                          return (
                            <div className="space-y-1 font-mono text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Ticket:</span>
                                <span className="text-foreground font-semibold">{selectedTicket.ticket_number}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Customer:</span>
                                <span className="text-foreground">{selectedTicket.customer_name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Phone:</span>
                                <span className="text-foreground tabular-nums">{selectedTicket.customer_phone}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Device:</span>
                                <span className="text-foreground">{selectedTicket.device_type} {selectedTicket.brand} {selectedTicket.model}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Problem:</span>
                                <span className="text-foreground truncate max-w-[200px]">{selectedTicket.problem_description}</span>
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
                        <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Firm *</Label>
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
                        <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Item Type *</Label>
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
                      <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Item *</Label>
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
                        <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Quantity</Label>
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
                          <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Original Dispatch</Label>
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
                          <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">
                            Reason * <span className="text-amber-400">(Mandatory)</span>
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
                          <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Reference Number</Label>
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
                    <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Scrap Reason *</Label>
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
                  <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Additional Remarks</Label>
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
              <Button variant="ghost" onClick={() => setClassifyOpen(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button
                onClick={handleClassify}
                disabled={actionLoading || !classifyForm.classification_type}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[11px] uppercase tracking-wide"
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
          <DialogContent className="bg-popover border border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Queue Entry Details</DialogTitle>
            </DialogHeader>
            {selectedEntry && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Queue Number</Label>
                    <p className="text-foreground font-mono tabular-nums mt-0.5">{selectedEntry.queue_number}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Status</Label>
                    <div className="mt-0.5">
                      <QueueStatusChip status={selectedEntry.status} />
                    </div>
                  </div>
                  {selectedEntry.classification_type && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Classification</Label>
                      <div className="mt-0.5">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${CLASSIFY_CHIP[selectedEntry.classification_type] || 'bg-muted text-muted-foreground ring-border'}`}>
                          {CLASSIFICATION_TYPES[selectedEntry.classification_type]?.label}
                        </span>
                      </div>
                    </div>
                  )}
                  {selectedEntry.classified_item_name && (
                    <>
                      <div>
                        <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Item</Label>
                        <p className="text-foreground mt-0.5">{selectedEntry.classified_item_name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{selectedEntry.classified_item_sku}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Quantity</Label>
                        <p className="font-mono tabular-nums text-foreground mt-0.5">{selectedEntry.classified_quantity}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Firm</Label>
                        <p className="text-foreground mt-0.5">{selectedEntry.classified_firm_name}</p>
                      </div>
                    </>
                  )}
                  {selectedEntry.ledger_entry_number && (
                    <div>
                      <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Ledger Entry</Label>
                      <p className="font-mono tabular-nums text-primary mt-0.5">{selectedEntry.ledger_entry_number}</p>
                    </div>
                  )}
                  {selectedEntry.reason && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Reason</Label>
                      <p className="text-foreground mt-0.5">{selectedEntry.reason}</p>
                    </div>
                  )}
                  {selectedEntry.scrap_reason && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Scrap Reason</Label>
                      <p className="text-rose-400 mt-0.5">{selectedEntry.scrap_reason}</p>
                    </div>
                  )}
                  <div className="col-span-2 pt-3 border-t border-border">
                    <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Classified By</Label>
                    <p className="text-foreground mt-0.5">{selectedEntry.classified_by_name || '-'}</p>
                    <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {selectedEntry.classified_at && new Date(selectedEntry.classified_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setViewOpen(false)} className="text-muted-foreground">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── New Ticket Dialog ── */}
        <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
          <DialogContent className="bg-popover border border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create New Ticket for Repair Item</DialogTitle>
              <DialogDescription className="text-muted-foreground font-mono text-[11px]">
                Enter customer details to create a new service ticket and link it to this incoming item.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Customer Name *</Label>
                  <Input
                    value={newTicketForm.customer_name}
                    onChange={(e) => setNewTicketForm({...newTicketForm, customer_name: e.target.value})}
                    placeholder="Full name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Phone Number *</Label>
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
                <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Email (Optional)</Label>
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
                  <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Device Type *</Label>
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
                  <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Brand</Label>
                  <Input
                    value={newTicketForm.brand}
                    onChange={(e) => setNewTicketForm({...newTicketForm, brand: e.target.value})}
                    placeholder="e.g., MuscleGrid"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Model</Label>
                  <Input
                    value={newTicketForm.model}
                    onChange={(e) => setNewTicketForm({...newTicketForm, model: e.target.value})}
                    placeholder="Model number"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Serial Number</Label>
                <Input
                  value={newTicketForm.serial_number}
                  onChange={(e) => setNewTicketForm({...newTicketForm, serial_number: e.target.value})}
                  placeholder="Device serial number"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">Problem Description</Label>
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
              <Button variant="ghost" onClick={() => setNewTicketOpen(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button
                onClick={handleCreateNewTicket}
                disabled={actionLoading || !newTicketForm.customer_name || !newTicketForm.customer_phone || !newTicketForm.device_type}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[11px] uppercase tracking-wide"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Ticket & Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Media Viewer Dialog ── */}
        <Dialog open={mediaViewerOpen} onOpenChange={setMediaViewerOpen}>
          <DialogContent className="bg-popover border border-border max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <ImageIcon className="w-5 h-5 text-primary" />
                Inward Media — {selectedEntry?.tracking_id || selectedEntry?.queue_number}
              </DialogTitle>
            </DialogHeader>

            {loadingMedia ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : mediaList.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="font-mono text-[11px] uppercase tracking-wide">No media available for this entry</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Main Media Viewer */}
                <div className="relative bg-black/60 rounded-lg overflow-hidden aspect-video border border-border">
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
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-foreground disabled:opacity-30 hover:bg-black/80 transition-colors"
                      >
                        ‹
                      </button>
                      <button
                        onClick={() => setSelectedMediaIndex(prev => Math.min(mediaList.length - 1, prev + 1))}
                        disabled={selectedMediaIndex === mediaList.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-foreground disabled:opacity-30 hover:bg-black/80 transition-colors"
                      >
                        ›
                      </button>
                    </>
                  )}

                  {/* Media counter */}
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-foreground font-mono text-sm tabular-nums">
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
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                          idx === selectedMediaIndex ? 'border-primary' : 'border-border hover:border-muted-foreground'
                        }`}
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
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Play className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Media Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-sm">
                  <div>
                    <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Filename</p>
                    <p className="text-foreground">{mediaList[selectedMediaIndex]?.filename}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Type</p>
                    <p className="text-foreground">{mediaList[selectedMediaIndex]?.media_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Captured</p>
                    <p className="text-foreground tabular-nums">
                      {mediaList[selectedMediaIndex]?.uploaded_at &&
                        new Date(mediaList[selectedMediaIndex].uploaded_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Source</p>
                    <p className="text-foreground">{mediaList[selectedMediaIndex]?.capture_source || 'camera'}</p>
                  </div>
                </div>

                {/* Summary */}
                <div className="flex gap-3 pt-2 border-t border-border">
                  <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 bg-primary/15 text-primary ring-primary/25 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    {mediaList.filter(m => m.media_type === 'image').length} Images
                  </span>
                  {mediaList.filter(m => m.media_type === 'video').length > 0 && (
                    <span className="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 bg-violet-500/15 text-violet-400 ring-violet-500/25 flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      {mediaList.filter(m => m.media_type === 'video').length} Videos
                    </span>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setMediaViewerOpen(false)} className="text-muted-foreground">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

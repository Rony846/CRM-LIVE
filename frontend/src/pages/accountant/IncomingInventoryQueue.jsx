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
  repair_item: { label: 'Repair Item', icon: Wrench, color: 'bg-blue-600', description: 'Send to technician queue for repair' },
  return_inventory: { label: 'Return to Inventory', icon: Package, color: 'bg-green-600', description: 'Add stock back (return/refund)' },
  repair_yard: { label: 'Repair Yard Stock', icon: Box, color: 'bg-yellow-600', description: 'Recovered/refurbished item' },
  scrap: { label: 'Scrap / Dead Stock', icon: Trash2, color: 'bg-red-600', description: 'Unusable item, no inventory impact' }
};

const STATUS_COLORS = {
  pending: 'bg-orange-600',
  classified: 'bg-blue-600',
  processed: 'bg-green-600'
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
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
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
            color={stats.pending > 0 ? 'orange' : 'green'}
          />
          <StatCard 
            title="Processed Today" 
            value={stats.processed}
            icon={CheckCircle}
            color="green"
          />
          <StatCard 
            title="Returns Added" 
            value={stats.returnInventory}
            icon={Package}
            color="teal"
          />
          <StatCard 
            title="Repair Yard Added" 
            value={stats.repairYard}
            icon={Box}
            color="yellow"
          />
        </div>

        {/* Alert for pending items */}
        {stats.pending > 0 && (
          <Card className="bg-orange-900/30 border-orange-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                <span className="text-orange-300">
                  <strong>{stats.pending} item(s)</strong> pending classification. 
                  Stock will NOT be updated until classification is complete.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="pending" className="data-[state=active]:bg-orange-600">
              <Inbox className="w-4 h-4 mr-2" />
              Pending ({stats.pending})
            </TabsTrigger>
            <TabsTrigger value="processed" className="data-[state=active]:bg-green-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              Processed ({stats.processed})
            </TabsTrigger>
          </TabsList>

          {/* Pending Tab */}
          <TabsContent value="pending">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Items Awaiting Classification</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingEntries.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
                    <p>All caught up! No pending items.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">Queue #</TableHead>
                          <TableHead className="text-slate-300">Tracking</TableHead>
                          <TableHead className="text-slate-300">Linked To</TableHead>
                          <TableHead className="text-slate-300">Customer</TableHead>
                          <TableHead className="text-slate-300">Media</TableHead>
                          <TableHead className="text-slate-300">Received</TableHead>
                          <TableHead className="text-slate-300">Status</TableHead>
                          <TableHead className="text-slate-300 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingEntries.map((entry) => (
                          <TableRow key={entry.id} className="border-slate-700" data-testid={`queue-row-${entry.id}`}>
                            <TableCell className="text-white font-mono">{entry.queue_number}</TableCell>
                            <TableCell className="text-slate-300">{entry.tracking_id || '-'}</TableCell>
                            <TableCell>
                              {entry.linked_ticket_number && (
                                <Badge className="bg-blue-600 mr-1">Ticket: {entry.linked_ticket_number}</Badge>
                              )}
                              {entry.linked_dispatch_number && (
                                <Badge className="bg-purple-600">Dispatch: {entry.linked_dispatch_number}</Badge>
                              )}
                              {!entry.linked_ticket_number && !entry.linked_dispatch_number && (
                                <span className="text-slate-500">Manual Entry</span>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-300">{entry.customer_name || '-'}</TableCell>
                            <TableCell>
                              {entry.media_attached || entry.images_count > 0 ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openMediaViewer(entry)}
                                  className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-600/20"
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
                                  className="text-slate-400 hover:text-slate-300"
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                              ) : (
                                <span className="text-slate-500 text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {new Date(entry.scanned_at || entry.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={STATUS_COLORS[entry.status]}>
                                {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => openClassifyDialog(entry)}
                                className="bg-cyan-600 hover:bg-cyan-700"
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Processed Tab */}
          <TabsContent value="processed">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Processed Items</CardTitle>
              </CardHeader>
              <CardContent>
                {processedEntries.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No processed items yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">Queue #</TableHead>
                          <TableHead className="text-slate-300">Classification</TableHead>
                          <TableHead className="text-slate-300">Item</TableHead>
                          <TableHead className="text-slate-300">Firm</TableHead>
                          <TableHead className="text-slate-300">Qty</TableHead>
                          <TableHead className="text-slate-300">Ledger Entry</TableHead>
                          <TableHead className="text-slate-300">Classified By</TableHead>
                          <TableHead className="text-slate-300">Date</TableHead>
                          <TableHead className="text-slate-300 text-right">View</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedEntries.map((entry) => {
                          const classType = CLASSIFICATION_TYPES[entry.classification_type];
                          return (
                            <TableRow key={entry.id} className="border-slate-700">
                              <TableCell className="text-white font-mono">{entry.queue_number}</TableCell>
                              <TableCell>
                                <Badge className={classType?.color || 'bg-slate-600'}>
                                  {classType?.label || entry.classification_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-white">
                                {entry.classified_item_name && (
                                  <div>
                                    <div>{entry.classified_item_name}</div>
                                    <div className="text-xs text-slate-400">{entry.classified_item_sku}</div>
                                  </div>
                                )}
                                {entry.classification_type === 'repair_item' && entry.classified_ticket_id && (
                                  <span className="text-blue-400">→ Ticket Queue</span>
                                )}
                                {entry.classification_type === 'scrap' && (
                                  <span className="text-red-400">Scrapped</span>
                                )}
                              </TableCell>
                              <TableCell className="text-slate-300">{entry.classified_firm_name || '-'}</TableCell>
                              <TableCell className="text-white text-center">{entry.classified_quantity || '-'}</TableCell>
                              <TableCell className="text-cyan-400 font-mono text-sm">
                                {entry.ledger_entry_number || '-'}
                              </TableCell>
                              <TableCell className="text-slate-400 text-sm">{entry.classified_by_name}</TableCell>
                              <TableCell className="text-slate-400 text-sm">
                                {entry.classified_at && new Date(entry.classified_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openViewDialog(entry)}
                                  className="text-slate-400 hover:text-white"
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Classify Dialog */}
        <Dialog open={classifyOpen} onOpenChange={setClassifyOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Classify Incoming Item</DialogTitle>
            </DialogHeader>
            
            {selectedEntry && (
              <div className="space-y-4">
                {/* Entry Info */}
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-400">Queue #:</span> <span className="text-white font-mono">{selectedEntry.queue_number}</span></div>
                    <div><span className="text-slate-400">Tracking:</span> <span className="text-white">{selectedEntry.tracking_id || 'N/A'}</span></div>
                    {selectedEntry.linked_ticket_number && (
                      <div><span className="text-slate-400">Linked Ticket:</span> <span className="text-blue-400">{selectedEntry.linked_ticket_number}</span></div>
                    )}
                    {selectedEntry.linked_dispatch_number && (
                      <div><span className="text-slate-400">Linked Dispatch:</span> <span className="text-purple-400">{selectedEntry.linked_dispatch_number}</span></div>
                    )}
                    {selectedEntry.customer_name && (
                      <div><span className="text-slate-400">Customer:</span> <span className="text-white">{selectedEntry.customer_name}</span></div>
                    )}
                  </div>
                </div>

                {/* Classification Type Selection */}
                <div>
                  <Label className="text-slate-300">Classification Type *</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {Object.entries(CLASSIFICATION_TYPES).map(([key, type]) => {
                      const Icon = type.icon;
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
                            classifyForm.classification_type === key
                              ? `${type.color} border-transparent`
                              : 'bg-slate-700 border-slate-600 hover:border-slate-500'
                          }`}
                          data-testid={`classify-type-${key}`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span className="font-medium">{type.label}</span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{type.description}</p>
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Info boxes explaining where items go */}
                  {classifyForm.classification_type && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-700">
                      {classifyForm.classification_type === 'repair_item' && (
                        <div className="text-sm">
                          <p className="text-cyan-400 font-medium mb-1">→ Where it goes:</p>
                          <p className="text-slate-300">Item will be linked to a service ticket and tracked in the <strong>Tickets</strong> section. The customer's device will go through the repair workflow until completion.</p>
                        </div>
                      )}
                      {classifyForm.classification_type === 'return_inventory' && (
                        <div className="text-sm">
                          <p className="text-green-400 font-medium mb-1">→ Where it goes:</p>
                          <p className="text-slate-300">Stock will be added back to <strong>Inventory → Stock Reports</strong> for the selected Firm/SKU. The quantity will increase in your available stock for sales/dispatch.</p>
                        </div>
                      )}
                      {classifyForm.classification_type === 'repair_yard' && (
                        <div className="text-sm">
                          <p className="text-amber-400 font-medium mb-1">→ Where it goes:</p>
                          <p className="text-slate-300">Item goes to <strong>Repair/Stock Yard</strong> - a holding area for items that need repair before being added to sellable inventory. View in <strong>Inventory → Repair Yard</strong> (coming soon) or track via remarks.</p>
                        </div>
                      )}
                      {classifyForm.classification_type === 'scrap' && (
                        <div className="text-sm">
                          <p className="text-red-400 font-medium mb-1">→ Where it goes:</p>
                          <p className="text-slate-300">Item is marked as <strong>Scrap/Write-off</strong> and removed from active inventory. Recorded for audit purposes but not added to stock.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Repair Item Fields */}
                {classifyForm.classification_type === 'repair_item' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-300">Link to Ticket *</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setNewTicketOpen(true)}
                        className="text-cyan-400 border-cyan-600 hover:bg-cyan-600/20"
                      >
                        + Create New Ticket
                      </Button>
                    </div>
                    
                    {/* Ticket Search */}
                    <Input
                      placeholder="Search tickets by number, customer, phone, device..."
                      value={ticketSearchTerm}
                      onChange={(e) => setTicketSearchTerm(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    
                    <Select
                      value={classifyForm.ticket_id}
                      onValueChange={(v) => setClassifyForm({...classifyForm, ticket_id: v})}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select ticket" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                        {selectedEntry?.linked_ticket_id && (
                          <SelectItem value={selectedEntry.linked_ticket_id} className="text-white">
                            <div className="py-1">
                              <div className="font-medium">{selectedEntry.linked_ticket_number} (Auto-linked)</div>
                              <div className="text-xs text-slate-400">{selectedEntry.customer_name}</div>
                            </div>
                          </SelectItem>
                        )}
                        {filteredTickets.filter(t => t.id !== selectedEntry?.linked_ticket_id).map(ticket => (
                          <SelectItem key={ticket.id} value={ticket.id} className="text-white">
                            <div className="py-1">
                              <div className="font-medium">{ticket.ticket_number}</div>
                              <div className="text-xs text-slate-400">
                                {ticket.customer_name} | {ticket.customer_phone} | {ticket.device_type} {ticket.brand || ''}
                              </div>
                              <div className="text-xs text-slate-500">
                                Status: {ticket.status} | Created: {new Date(ticket.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                        {filteredTickets.length === 0 && (
                          <div className="p-3 text-center text-slate-400 text-sm">
                            No tickets found. Create a new ticket above.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    
                    {/* Show selected ticket details */}
                    {classifyForm.ticket_id && (
                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-700">
                        {(() => {
                          const selectedTicket = tickets.find(t => t.id === classifyForm.ticket_id);
                          if (!selectedTicket) return null;
                          return (
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Ticket:</span>
                                <span className="text-white font-medium">{selectedTicket.ticket_number}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Customer:</span>
                                <span className="text-white">{selectedTicket.customer_name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Phone:</span>
                                <span className="text-white">{selectedTicket.customer_phone}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Device:</span>
                                <span className="text-white">{selectedTicket.device_type} {selectedTicket.brand} {selectedTicket.model}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Problem:</span>
                                <span className="text-white truncate max-w-[200px]">{selectedTicket.problem_description}</span>
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
                        <Label className="text-slate-300">Firm *</Label>
                        <Select
                          value={classifyForm.firm_id}
                          onValueChange={(v) => {
                            setClassifyForm({...classifyForm, firm_id: v, item_id: ''});
                            fetchItemsByFirm(v, classifyForm.item_type);
                          }}
                        >
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                            <SelectValue placeholder="Select firm" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-700 border-slate-600">
                            {firms.map(firm => (
                              <SelectItem key={firm.id} value={firm.id} className="text-white">
                                {firm.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-slate-300">Item Type *</Label>
                        <Select
                          value={classifyForm.item_type}
                          onValueChange={(v) => {
                            setClassifyForm({...classifyForm, item_type: v, item_id: ''});
                            if (classifyForm.firm_id) {
                              fetchItemsByFirm(classifyForm.firm_id, v);
                            }
                          }}
                        >
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-700 border-slate-600">
                            <SelectItem value="finished_good" className="text-white">Finished Good (SKU)</SelectItem>
                            <SelectItem value="raw_material" className="text-white">Raw Material</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-slate-300">Item *</Label>
                      <Select
                        value={classifyForm.item_id}
                        onValueChange={(v) => setClassifyForm({...classifyForm, item_id: v})}
                        disabled={!classifyForm.firm_id}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                          <SelectValue placeholder={classifyForm.firm_id ? "Select item" : "Select firm first"} />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          {availableItems.map(item => (
                            <SelectItem key={item.id} value={item.id} className="text-white">
                              {item.model_name || item.name} ({item.sku_code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-300">Quantity</Label>
                        <Input
                          type="number"
                          value={classifyForm.quantity}
                          onChange={(e) => setClassifyForm({...classifyForm, quantity: parseInt(e.target.value) || 1})}
                          min="1"
                          className="bg-slate-700 border-slate-600 text-white mt-1"
                        />
                      </div>
                      {classifyForm.classification_type === 'return_inventory' && (
                        <div>
                          <Label className="text-slate-300">Original Dispatch</Label>
                          <Select
                            value={classifyForm.original_dispatch_id || 'none'}
                            onValueChange={(v) => setClassifyForm({...classifyForm, original_dispatch_id: v === 'none' ? '' : v})}
                          >
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                              <SelectValue placeholder="Optional - link to dispatch" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-700 border-slate-600">
                              <SelectItem value="none" className="text-slate-400">None</SelectItem>
                              {selectedEntry.linked_dispatch_id && (
                                <SelectItem value={selectedEntry.linked_dispatch_id} className="text-white">
                                  {selectedEntry.linked_dispatch_number} (Auto-linked)
                                </SelectItem>
                              )}
                              {dispatches.filter(d => d.firm_id === classifyForm.firm_id && d.id !== selectedEntry.linked_dispatch_id).map(d => (
                                <SelectItem key={d.id} value={d.id} className="text-white">
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
                          <Label className="text-slate-300">Reason * <span className="text-orange-400">(Mandatory)</span></Label>
                          <Textarea
                            value={classifyForm.reason}
                            onChange={(e) => setClassifyForm({...classifyForm, reason: e.target.value})}
                            placeholder="Why is this item being added to inventory from repair yard?"
                            className="bg-slate-700 border-slate-600 text-white mt-1"
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label className="text-slate-300">Reference Number</Label>
                          <Input
                            value={classifyForm.reference_number}
                            onChange={(e) => setClassifyForm({...classifyForm, reference_number: e.target.value})}
                            placeholder="Internal reference or document number"
                            className="bg-slate-700 border-slate-600 text-white mt-1"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Scrap Fields */}
                {classifyForm.classification_type === 'scrap' && (
                  <div>
                    <Label className="text-slate-300">Scrap Reason *</Label>
                    <Textarea
                      value={classifyForm.scrap_reason}
                      onChange={(e) => setClassifyForm({...classifyForm, scrap_reason: e.target.value})}
                      placeholder="Why is this item being marked as scrap?"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                      rows={2}
                    />
                  </div>
                )}

                {/* Remarks */}
                <div>
                  <Label className="text-slate-300">Additional Remarks</Label>
                  <Textarea
                    value={classifyForm.remarks}
                    onChange={(e) => setClassifyForm({...classifyForm, remarks: e.target.value})}
                    placeholder="Any additional notes..."
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    rows={2}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setClassifyOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleClassify} 
                disabled={actionLoading || !classifyForm.classification_type}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="submit-classify-btn"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Classify & Process
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Queue Entry Details</DialogTitle>
            </DialogHeader>
            {selectedEntry && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">Queue Number</Label>
                    <p className="text-white font-mono">{selectedEntry.queue_number}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Status</Label>
                    <Badge className={STATUS_COLORS[selectedEntry.status]}>
                      {selectedEntry.status}
                    </Badge>
                  </div>
                  {selectedEntry.classification_type && (
                    <div className="col-span-2">
                      <Label className="text-slate-400 text-xs">Classification</Label>
                      <Badge className={CLASSIFICATION_TYPES[selectedEntry.classification_type]?.color}>
                        {CLASSIFICATION_TYPES[selectedEntry.classification_type]?.label}
                      </Badge>
                    </div>
                  )}
                  {selectedEntry.classified_item_name && (
                    <>
                      <div>
                        <Label className="text-slate-400 text-xs">Item</Label>
                        <p className="text-white">{selectedEntry.classified_item_name}</p>
                        <p className="text-slate-400 text-xs">{selectedEntry.classified_item_sku}</p>
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs">Quantity</Label>
                        <p className="text-white">{selectedEntry.classified_quantity}</p>
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs">Firm</Label>
                        <p className="text-white">{selectedEntry.classified_firm_name}</p>
                      </div>
                    </>
                  )}
                  {selectedEntry.ledger_entry_number && (
                    <div>
                      <Label className="text-slate-400 text-xs">Ledger Entry</Label>
                      <p className="text-cyan-400 font-mono">{selectedEntry.ledger_entry_number}</p>
                    </div>
                  )}
                  {selectedEntry.reason && (
                    <div className="col-span-2">
                      <Label className="text-slate-400 text-xs">Reason</Label>
                      <p className="text-white">{selectedEntry.reason}</p>
                    </div>
                  )}
                  {selectedEntry.scrap_reason && (
                    <div className="col-span-2">
                      <Label className="text-slate-400 text-xs">Scrap Reason</Label>
                      <p className="text-red-400">{selectedEntry.scrap_reason}</p>
                    </div>
                  )}
                  <div className="col-span-2 pt-2 border-t border-slate-700">
                    <Label className="text-slate-400 text-xs">Classified By</Label>
                    <p className="text-white">{selectedEntry.classified_by_name || '-'}</p>
                    <p className="text-slate-400 text-xs">
                      {selectedEntry.classified_at && new Date(selectedEntry.classified_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setViewOpen(false)} className="text-slate-300">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Ticket Dialog */}
        <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Ticket for Repair Item</DialogTitle>
              <DialogDescription className="text-slate-400">
                Enter customer details to create a new service ticket and link it to this incoming item.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Customer Name *</Label>
                  <Input
                    value={newTicketForm.customer_name}
                    onChange={(e) => setNewTicketForm({...newTicketForm, customer_name: e.target.value})}
                    placeholder="Full name"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Phone Number *</Label>
                  <Input
                    value={newTicketForm.customer_phone}
                    onChange={(e) => setNewTicketForm({...newTicketForm, customer_phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                    placeholder="10-digit mobile"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    maxLength={10}
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-slate-300">Email (Optional)</Label>
                <Input
                  type="email"
                  value={newTicketForm.customer_email}
                  onChange={(e) => setNewTicketForm({...newTicketForm, customer_email: e.target.value})}
                  placeholder="customer@example.com"
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-slate-300">Device Type *</Label>
                  <Select
                    value={newTicketForm.device_type}
                    onValueChange={(v) => setNewTicketForm({...newTicketForm, device_type: v})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="Inverter" className="text-white">Inverter</SelectItem>
                      <SelectItem value="Battery" className="text-white">Battery</SelectItem>
                      <SelectItem value="Stabilizer" className="text-white">Stabilizer</SelectItem>
                      <SelectItem value="Solar Inverter" className="text-white">Solar Inverter</SelectItem>
                      <SelectItem value="Other" className="text-white">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Brand</Label>
                  <Input
                    value={newTicketForm.brand}
                    onChange={(e) => setNewTicketForm({...newTicketForm, brand: e.target.value})}
                    placeholder="e.g., MuscleGrid"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Model</Label>
                  <Input
                    value={newTicketForm.model}
                    onChange={(e) => setNewTicketForm({...newTicketForm, model: e.target.value})}
                    placeholder="Model number"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-slate-300">Serial Number</Label>
                <Input
                  value={newTicketForm.serial_number}
                  onChange={(e) => setNewTicketForm({...newTicketForm, serial_number: e.target.value})}
                  placeholder="Device serial number"
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              
              <div>
                <Label className="text-slate-300">Problem Description</Label>
                <Textarea
                  value={newTicketForm.problem_description}
                  onChange={(e) => setNewTicketForm({...newTicketForm, problem_description: e.target.value})}
                  placeholder="Describe the issue..."
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  rows={2}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNewTicketOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleCreateNewTicket}
                disabled={actionLoading || !newTicketForm.customer_name || !newTicketForm.customer_phone || !newTicketForm.device_type}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Ticket & Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Media Viewer Dialog */}
        <Dialog open={mediaViewerOpen} onOpenChange={setMediaViewerOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-cyan-400" />
                Inward Media - {selectedEntry?.tracking_id || selectedEntry?.queue_number}
              </DialogTitle>
            </DialogHeader>
            
            {loadingMedia ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              </div>
            ) : mediaList.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No media available for this entry</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Main Media Viewer */}
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
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
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white disabled:opacity-30"
                      >
                        ‹
                      </button>
                      <button
                        onClick={() => setSelectedMediaIndex(prev => Math.min(mediaList.length - 1, prev + 1))}
                        disabled={selectedMediaIndex === mediaList.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white disabled:opacity-30"
                      >
                        ›
                      </button>
                    </>
                  )}
                  
                  {/* Media counter */}
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-sm">
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
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                          idx === selectedMediaIndex ? 'border-cyan-500' : 'border-transparent'
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
                          <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                            <Play className="w-6 h-6 text-slate-400" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Media Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">Filename</p>
                    <p className="text-white font-mono">{mediaList[selectedMediaIndex]?.filename}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Type</p>
                    <p className="text-white">{mediaList[selectedMediaIndex]?.media_type}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Captured</p>
                    <p className="text-white">
                      {mediaList[selectedMediaIndex]?.uploaded_at && 
                        new Date(mediaList[selectedMediaIndex].uploaded_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Source</p>
                    <p className="text-white">{mediaList[selectedMediaIndex]?.capture_source || 'camera'}</p>
                  </div>
                </div>
                
                {/* Summary */}
                <div className="flex gap-4 pt-2 border-t border-slate-700">
                  <Badge className="bg-cyan-600">
                    <ImageIcon className="w-3 h-3 mr-1" />
                    {mediaList.filter(m => m.media_type === 'image').length} Images
                  </Badge>
                  {mediaList.filter(m => m.media_type === 'video').length > 0 && (
                    <Badge className="bg-purple-600">
                      <Video className="w-3 h-3 mr-1" />
                      {mediaList.filter(m => m.media_type === 'video').length} Videos
                    </Badge>
                  )}
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="ghost" onClick={() => setMediaViewerOpen(false)} className="text-slate-300">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Inbox, Loader2, CheckCircle, Package, Wrench, Trash2, 
  ArrowLeftRight, AlertTriangle, Eye, ClipboardList, Building2, Box
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
      const [queueRes, firmsRes, ticketsRes, dispatchesRes] = await Promise.all([
        axios.get(`${API}/incoming-queue`, { headers }),
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        axios.get(`${API}/tickets?status=received_at_factory`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/dispatches`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setQueueEntries(queueRes.data || []);
      setFirms(firmsRes.data || []);
      setTickets(ticketsRes.data || []);
      setDispatches((dispatchesRes.data || []).filter(d => d.status === 'dispatched' && d.firm_id));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load queue data');
    } finally {
      setLoading(false);
    }
  };

  const fetchItemsByFirm = async (firmId, itemType) => {
    if (!firmId) {
      setSkus([]);
      setRawMaterials([]);
      return;
    }
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      if (itemType === 'raw_material') {
        const res = await axios.get(`${API}/raw-materials`, { headers, params: { firm_id: firmId } });
        setRawMaterials(res.data || []);
      } else {
        const res = await axios.get(`${API}/admin/skus`, { headers, params: { firm_id: firmId } });
        setSkus(res.data || []);
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

  const openViewDialog = (entry) => {
    setSelectedEntry(entry);
    setViewOpen(true);
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
                </div>

                {/* Repair Item Fields */}
                {classifyForm.classification_type === 'repair_item' && (
                  <div>
                    <Label className="text-slate-300">Link to Ticket *</Label>
                    <Select
                      value={classifyForm.ticket_id}
                      onValueChange={(v) => setClassifyForm({...classifyForm, ticket_id: v})}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue placeholder="Select ticket" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        {selectedEntry.linked_ticket_id && (
                          <SelectItem value={selectedEntry.linked_ticket_id} className="text-white">
                            {selectedEntry.linked_ticket_number} - {selectedEntry.customer_name} (Auto-linked)
                          </SelectItem>
                        )}
                        {tickets.filter(t => t.id !== selectedEntry.linked_ticket_id).map(ticket => (
                          <SelectItem key={ticket.id} value={ticket.id} className="text-white">
                            {ticket.ticket_number} - {ticket.customer_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
      </div>
    </DashboardLayout>
  );
}

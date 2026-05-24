import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Loader2, Wrench, Clock, AlertTriangle, CheckCircle,
  Package, Play, Check, Timer, Eye, UserPlus, FileText,
  MessageSquare, User, Phone, Mail, MapPin
} from 'lucide-react';

const DEVICE_TYPES = ['Inverter', 'Battery', 'Stabilizer', 'Others'];

// ── Shared tone map (mirrors AdminDashboard STAT_TONES) ──────────────────────
const STAT_TONES = {
  amber:   'bg-amber-400/15 text-amber-400',
  sky:     'bg-sky-400/15 text-sky-400',
  emerald: 'bg-emerald-500/15 text-emerald-500',
  violet:  'bg-violet-400/15 text-violet-400',
  rose:    'bg-rose-500/15 text-rose-400',
};

// ── Mini KPI card ────────────────────────────────────────────────────────────
const StatTile = ({ label, value, icon: Icon, tone = 'sky', span = '' }) => (
  <div className={`mg-card rounded-lg border border-border bg-card p-3 md:p-4 ${span}`}>
    <div className="flex items-center gap-2 md:gap-3">
      <div className={`flex h-8 w-8 md:h-10 md:w-10 flex-shrink-0 items-center justify-center rounded ${STAT_TONES[tone]}`}>
        <Icon className="h-4 w-4 md:h-5 md:w-5" />
      </div>
      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{label}</p>
        <p className="font-mono text-lg md:text-xl font-bold tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  </div>
);

// ── Soft badge (status pill) ─────────────────────────────────────────────────
const BADGE_TONES = {
  cyan:    'bg-sky-400/15 text-sky-400 ring-sky-400/25',
  amber:   'bg-amber-400/15 text-amber-400 ring-amber-400/25',
  emerald: 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25',
  blue:    'bg-primary/15 text-primary ring-primary/25',
  violet:  'bg-violet-400/15 text-violet-400 ring-violet-400/25',
  rose:    'bg-rose-500/15 text-rose-400 ring-rose-500/25',
  slate:   'bg-muted text-muted-foreground ring-border',
};
const SoftBadge = ({ tone = 'slate', children }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap ${BADGE_TONES[tone] || BADGE_TONES.slate}`}>
    {children}
  </span>
);

export default function TechnicianDashboard() {
  const { token, user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [myRepairs, setMyRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('queue');

  // Dialog states
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Complete repair form
  const [repairForm, setRepairForm] = useState({
    repair_notes: '',
    board_serial_number: '',
    device_serial_number: ''
  });

  // Walk-in customer form
  const [walkinForm, setWalkinForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    device_type: '',
    issue_description: '',
    serial_number: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [queueRes, myRepairsRes] = await Promise.all([
        axios.get(`${API}/technician/queue`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/technician/my-repairs`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setQueue(queueRes.data);
      setMyRepairs(myRepairsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const startRepair = async (ticketId) => {
    try {
      await axios.post(`${API}/tickets/${ticketId}/start-repair`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Repair started');
      fetchData();
    } catch (error) {
      toast.error('Failed to start repair');
    }
  };

  const handleCompleteRepair = async () => {
    if (!repairForm.board_serial_number || !repairForm.device_serial_number) {
      toast.error('Board serial number and device serial number are required');
      return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('repair_notes', repairForm.repair_notes || 'Repair completed successfully');
      formData.append('board_serial_number', repairForm.board_serial_number);
      formData.append('device_serial_number', repairForm.device_serial_number);

      await axios.post(`${API}/tickets/${selectedTicket.id}/complete-repair`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(selectedTicket.is_walkin
        ? 'Repair completed! Ticket sent to dispatcher (skipped accountant)'
        : 'Repair marked as completed');
      setCompleteOpen(false);
      setRepairForm({ repair_notes: '', board_serial_number: '', device_serial_number: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete repair');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateWalkin = async () => {
    if (!walkinForm.customer_name || !walkinForm.customer_phone || !walkinForm.device_type || !walkinForm.issue_description) {
      toast.error('Please fill all required fields');
      return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      Object.entries(walkinForm).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      const res = await axios.post(`${API}/technician/walkin-ticket`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`Walk-in ticket created: ${res.data.ticket_number}`);
      setWalkinOpen(false);
      setWalkinForm({
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        device_type: '',
        issue_description: '',
        serial_number: '',
        address: '',
        city: '',
        state: '',
        pincode: ''
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create walk-in ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN');
  };

  const openDetails = (ticket) => {
    setSelectedTicket(ticket);
    setDetailsOpen(true);
  };

  const openCompleteDialog = (ticket) => {
    setSelectedTicket(ticket);
    setRepairForm({ repair_notes: '', board_serial_number: '', device_serial_number: '' });
    setCompleteOpen(true);
  };

  if (loading) {
    return (
      <DashboardLayout title="Technician Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const awaitingRepair = queue.filter(t => t.status === 'received_at_factory' || t.status === 'in_repair_queue');
  const inProgress = queue.filter(t => t.status === 'in_repair');

  return (
    <DashboardLayout title="Technician Dashboard">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-4 md:mb-6 gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Live · Workshop
            </span>
          </div>
          <h2 className="text-[22px] md:text-[28px] font-bold leading-tight tracking-tight text-foreground">
            Repair Workshop
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hardware repairs and{' '}
            <span className="font-mono font-semibold text-amber-400">72-hour SLA</span> tracking
          </p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white w-full md:w-auto h-12 md:h-10"
          onClick={() => setWalkinOpen(true)}
          data-testid="walkin-btn"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Walk-in Customer
        </Button>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-4 md:mb-6">
        <StatTile label="Awaiting"    value={awaitingRepair.length}                                    icon={Package}       tone="amber" />
        <StatTile label="In Progress" value={inProgress.length}                                        icon={Wrench}        tone="sky" />
        <StatTile label="Completed"   value={myRepairs.filter(t => t.status === 'repair_completed').length} icon={CheckCircle} tone="emerald" />
        <StatTile label="Walk-ins"    value={queue.filter(t => t.is_walkin).length}                    icon={UserPlus}      tone="violet" />
        <StatTile label="SLA Breached" value={queue.filter(t => t.repair_sla_breached).length}         icon={AlertTriangle} tone="rose" span="col-span-2 md:col-span-1" />
      </div>

      {/* ── Repair Queue ─────────────────────────────────────────────────── */}
      <div className="mg-card rounded-lg border border-border bg-card mb-6">
        {/* Panel header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-400/15 text-amber-400">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-foreground leading-none">Repair Queue</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground mt-0.5">
              72-hour SLA from receipt
            </p>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <Package className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-mono text-sm uppercase tracking-wide">No items in repair queue</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Ticket</th>
                  <th className="text-left px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Product</th>
                  <th className="text-left px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Notes</th>
                  <th className="text-left px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">72hr SLA</th>
                  <th className="text-left px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono text-[13px] font-semibold text-primary">{ticket.ticket_number}</p>
                      <div className="mt-1">
                        {ticket.is_walkin ? (
                          <SoftBadge tone="violet">Walk-in</SoftBadge>
                        ) : (
                          <SoftBadge tone="blue">CRM</SoftBadge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground font-medium">{ticket.customer_name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground mt-0.5">{ticket.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{ticket.product_name || ticket.device_type}</p>
                      <p className="font-mono text-[11px] text-muted-foreground mt-0.5">S/N: {ticket.serial_number || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      {ticket.all_notes && ticket.all_notes.length > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border text-muted-foreground hover:bg-accent hover:text-foreground text-xs"
                          onClick={() => openDetails(ticket)}
                        >
                          <MessageSquare className="w-3 h-3 mr-1" />
                          {ticket.all_notes.length} Notes
                        </Button>
                      ) : (
                        <span className="text-muted-foreground/50 font-mono text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1.5 font-mono text-[12px] font-semibold ${ticket.repair_sla_breached ? 'text-rose-400' : 'text-emerald-500'}`}>
                        <Timer className="w-3.5 h-3.5" />
                        {ticket.repair_hours_remaining}h
                      </div>
                      {ticket.repair_sla_breached && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-rose-400">Breached</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ticket.status === 'in_repair' ? (
                        <SoftBadge tone="cyan">In Repair</SoftBadge>
                      ) : (
                        <SoftBadge tone="amber">Awaiting</SoftBadge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                          onClick={() => openDetails(ticket)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {ticket.status === 'received_at_factory' ? (
                          <Button
                            size="sm"
                            className="bg-sky-500/15 text-sky-400 border border-sky-500/25 hover:bg-sky-500/25"
                            onClick={() => startRepair(ticket.id)}
                            data-testid={`start-repair-${ticket.id}`}
                          >
                            <Play className="w-3.5 h-3.5 mr-1" />
                            Start
                          </Button>
                        ) : ticket.status === 'in_repair' ? (
                          <Button
                            size="sm"
                            className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-500/25"
                            onClick={() => openCompleteDialog(ticket)}
                            data-testid={`complete-repair-${ticket.id}`}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Complete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── My Recent Repairs ─────────────────────────────────────────────── */}
      {myRepairs.length > 0 && (
        <div className="mg-card rounded-lg border border-border bg-card">
          {/* Panel header */}
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-500/15 text-emerald-500">
              <CheckCircle className="w-4 h-4" />
            </div>
            <p className="font-semibold text-foreground">My Recent Repairs</p>
          </div>
          <div className="p-4 space-y-3">
            {myRepairs.slice(0, 5).map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-[13px] font-semibold text-primary">{ticket.ticket_number}</span>
                    {ticket.is_walkin ? (
                      <SoftBadge tone="violet">Walk-in</SoftBadge>
                    ) : (
                      <SoftBadge tone="blue">CRM</SoftBadge>
                    )}
                  </div>
                  <p className="text-foreground text-sm">{ticket.product_name || ticket.device_type}</p>
                  {ticket.repair_notes && (
                    <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{ticket.repair_notes}</p>
                  )}
                  {ticket.board_serial_number && (
                    <p className="font-mono text-[11px] text-muted-foreground/70 mt-0.5">
                      Board: {ticket.board_serial_number} · Device: {ticket.device_serial_number}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  {ticket.status === 'repair_completed' ? (
                    <SoftBadge tone="emerald">{ticket.status.replace(/_/g, ' ')}</SoftBadge>
                  ) : ticket.status === 'ready_for_dispatch' ? (
                    <SoftBadge tone="blue">{ticket.status.replace(/_/g, ' ')}</SoftBadge>
                  ) : (
                    <SoftBadge tone="cyan">{ticket.status.replace(/_/g, ' ')}</SoftBadge>
                  )}
                  <p className="font-mono text-[11px] text-muted-foreground mt-1.5">
                    {formatDate(ticket.repaired_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Ticket Details Dialog ─────────────────────────────────────────── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono">
              Ticket Details —{' '}
              <span className="text-primary">{selectedTicket?.ticket_number}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Customer Info */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-primary" />
                  Customer Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-muted-foreground"><span className="text-foreground font-medium">Name:</span> {selectedTicket.customer_name}</p>
                  <p className="text-muted-foreground"><span className="text-foreground font-medium">Phone:</span> {selectedTicket.customer_phone}</p>
                  <p className="text-muted-foreground"><span className="text-foreground font-medium">Device:</span> {selectedTicket.device_type}</p>
                  <p className="text-muted-foreground"><span className="text-foreground font-medium">Serial:</span> {selectedTicket.serial_number || '—'}</p>
                </div>
              </div>

              {/* All Notes Section */}
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-primary" />
                  Notes &amp; Information
                </h4>
                {selectedTicket.all_notes && selectedTicket.all_notes.length > 0 ? (
                  selectedTicket.all_notes.map((note, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-3 ${
                        note.source === 'Customer'
                          ? 'bg-primary/[0.06] border-primary/20'
                          : note.source === 'Call Support'
                          ? 'bg-emerald-500/[0.06] border-emerald-500/20'
                          : 'bg-violet-400/[0.06] border-violet-400/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <SoftBadge
                          tone={
                            note.source === 'Customer' ? 'blue' :
                            note.source === 'Call Support' ? 'emerald' : 'violet'
                          }
                        >
                          {note.source}
                        </SoftBadge>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground capitalize">{note.type}</span>
                        {note.timestamp && (
                          <span className="font-mono text-[10px] text-muted-foreground/70 ml-auto">
                            {formatDate(note.timestamp)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground">{note.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">No notes available</p>
                )}
              </div>

              {/* Status Information */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="font-semibold text-foreground mb-2 text-sm">Status Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-muted-foreground"><span className="text-foreground font-medium">Status:</span> {selectedTicket.status.replace(/_/g, ' ')}</p>
                  <p className="text-muted-foreground"><span className="text-foreground font-medium">Received:</span> {formatDate(selectedTicket.received_at)}</p>
                  <p className="text-muted-foreground"><span className="text-foreground font-medium">SLA Hours:</span> {selectedTicket.repair_hours_remaining}h remaining</p>
                  <p className="text-muted-foreground"><span className="text-foreground font-medium">Source:</span> {selectedTicket.is_walkin ? 'Walk-in' : 'CRM'}</p>
                </div>
              </div>

              {/* Invoice Document */}
              {selectedTicket.invoice_file && (
                <div className="rounded-lg border border-primary/20 bg-primary/[0.06] p-4">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-primary" />
                    Customer Invoice
                  </h4>
                  <a
                    href={`${API.replace('/api', '')}${selectedTicket.invoice_file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:text-primary/80 text-sm font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    View Invoice Document
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Complete Repair Dialog ────────────────────────────────────────── */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono">
              Complete Repair —{' '}
              <span className="text-primary">{selectedTicket?.ticket_number}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTicket?.is_walkin && (
              <div className="rounded-lg border border-violet-400/25 bg-violet-400/[0.06] p-3">
                <p className="text-sm text-violet-400">
                  <span className="font-semibold">Walk-in Ticket:</span> After completion, this ticket will go directly to Dispatcher (skipping Accountant).
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Board Serial Number *</Label>
              <Input
                placeholder="Enter board serial number"
                value={repairForm.board_serial_number}
                onChange={(e) => setRepairForm({...repairForm, board_serial_number: e.target.value})}
                data-testid="board-serial-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Inverter/Battery Serial Number *</Label>
              <Input
                placeholder="Enter device serial number"
                value={repairForm.device_serial_number}
                onChange={(e) => setRepairForm({...repairForm, device_serial_number: e.target.value})}
                data-testid="device-serial-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Repair Notes</Label>
              <Textarea
                placeholder="Describe the repair work done..."
                value={repairForm.repair_notes}
                onChange={(e) => setRepairForm({...repairForm, repair_notes: e.target.value})}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCompleteRepair}
              disabled={actionLoading}
              data-testid="submit-repair-btn"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Complete Repair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Walk-in Customer Dialog ───────────────────────────────────────── */}
      <Dialog open={walkinOpen} onOpenChange={setWalkinOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register Walk-in Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input
                  placeholder="Full name"
                  value={walkinForm.customer_name}
                  onChange={(e) => setWalkinForm({...walkinForm, customer_name: e.target.value})}
                  data-testid="walkin-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input
                  placeholder="10-digit mobile"
                  value={walkinForm.customer_phone}
                  onChange={(e) => setWalkinForm({...walkinForm, customer_phone: e.target.value})}
                  data-testid="walkin-phone"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email (Optional)</Label>
              <Input
                type="email"
                placeholder="customer@email.com"
                value={walkinForm.customer_email}
                onChange={(e) => setWalkinForm({...walkinForm, customer_email: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Device Type *</Label>
                <Select
                  value={walkinForm.device_type}
                  onValueChange={(v) => setWalkinForm({...walkinForm, device_type: v})}
                >
                  <SelectTrigger data-testid="walkin-device">
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input
                  placeholder="Device serial"
                  value={walkinForm.serial_number}
                  onChange={(e) => setWalkinForm({...walkinForm, serial_number: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Issue Description *</Label>
              <Textarea
                placeholder="Describe the problem..."
                value={walkinForm.issue_description}
                onChange={(e) => setWalkinForm({...walkinForm, issue_description: e.target.value})}
                rows={3}
                data-testid="walkin-issue"
              />
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="font-medium text-foreground mb-3 flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                Address (for return shipping)
              </h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    placeholder="Street address"
                    value={walkinForm.address}
                    onChange={(e) => setWalkinForm({...walkinForm, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      placeholder="City"
                      value={walkinForm.city}
                      onChange={(e) => setWalkinForm({...walkinForm, city: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      placeholder="State"
                      value={walkinForm.state}
                      onChange={(e) => setWalkinForm({...walkinForm, state: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pincode</Label>
                    <Input
                      placeholder="Pincode"
                      value={walkinForm.pincode}
                      onChange={(e) => setWalkinForm({...walkinForm, pincode: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalkinOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCreateWalkin}
              disabled={actionLoading}
              data-testid="submit-walkin-btn"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Create Walk-in Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}

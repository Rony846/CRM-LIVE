import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, useReducedMotion } from 'framer-motion';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shimmer } from '@/components/ui/motion';
import { openAuthedFile } from '@/lib/openFile';
import { toast } from 'sonner';
import {
  AlertTriangle, Clock, CheckCircle, Loader2, Eye, ArrowRight,
  Wrench, Package, Phone, ArrowUpCircle, Shield, FileText,
  History, RefreshCw, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Tone map: icon-tile bg + text (opacity-based, works on any dark surface)
const STAT_TONES = {
  violet:  'bg-violet-400/15 text-violet-400',
  orange:  'bg-orange-400/15 text-orange-400',
  rose:    'bg-rose-500/15 text-rose-400',
  emerald: 'bg-emerald-500/15 text-emerald-500',
};

// KPI card — glass panel, mono numerals, tinted icon tile
const SupKpi = ({ icon: Icon, tone, label, value }) => (
  <div className="mg-card rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40">
    <div className={cn('flex h-10 w-10 items-center justify-center rounded', tone)}>
      <Icon className="h-5 w-5" />
    </div>
    <p className="mt-4 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
    <p className="mt-1 font-mono text-[30px] leading-none font-semibold tabular-nums text-foreground">{value}</p>
  </div>
);

export default function SupervisorDashboard() {
  const { token } = useAuth();
  const reduce = useReducedMotion();
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [customerWarranties, setCustomerWarranties] = useState([]);
  const [customerTickets, setCustomerTickets] = useState([]);
  const [loadingCustomerData, setLoadingCustomerData] = useState(false);

  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedSku, setSelectedSku] = useState('');

  const tap = reduce ? {} : { scale: 0.96 };
  const hover = reduce ? {} : { scale: 1.03 };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, queueRes, skusRes] = await Promise.all([
        axios.get(`${API}/supervisor/stats`, { headers }),
        axios.get(`${API}/supervisor/queue`, { headers }),
        axios.get(`${API}/admin/skus`, { headers }).catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      setQueue(queueRes.data);
      setSkus(skusRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const viewTicketDetails = async (ticketId) => {
    try {
      const response = await axios.get(`${API}/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedTicket(response.data);
      setDetailsOpen(true);
      if (response.data.customer_id || response.data.customer_phone) {
        fetchCustomerData(response.data.customer_id, response.data.customer_phone);
      }
    } catch (error) {
      toast.error('Failed to load ticket');
    }
  };

  const fetchCustomerData = async (customerId, customerPhone) => {
    setLoadingCustomerData(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const warrantiesRes = await axios.get(`${API}/supervisor/customer-warranties`, {
        headers, params: { customer_id: customerId, phone: customerPhone },
      }).catch(() => ({ data: [] }));
      const ticketsRes = await axios.get(`${API}/supervisor/customer-tickets`, {
        headers, params: { customer_id: customerId, phone: customerPhone },
      }).catch(() => ({ data: [] }));
      setCustomerWarranties(warrantiesRes.data);
      setCustomerTickets(ticketsRes.data);
    } catch (error) {
      console.error('Failed to fetch customer data:', error);
    } finally {
      setLoadingCustomerData(false);
    }
  };

  const openActionDialog = (ticket) => {
    setSelectedTicket(ticket);
    setAction('');
    setNotes('');
    setSelectedSku('');
    setActionOpen(true);
  };

  const handleSupervisorAction = async () => {
    if (!action) { toast.error('Please select an action'); return; }
    if (notes.length < 100) { toast.error('Notes must be at least 100 characters'); return; }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', action);
      formData.append('notes', notes);
      if (selectedSku) formData.append('sku', selectedSku);
      await axios.post(`${API}/tickets/${selectedTicket.id}/supervisor-action`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Action completed successfully');
      setActionOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to perform action');
    } finally {
      setActionLoading(false);
    }
  };

  const formatTimeRemaining = (hours) => {
    if (hours <= 0) return 'OVERDUE';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${Math.round(hours)}h`;
  };

  const urgentTickets = queue.filter((t) => t.is_urgent || t.status === 'customer_escalated');
  const escalatedTickets = queue.filter((t) => t.status === 'escalated_to_supervisor' || t.status === 'supervisor_followup');

  const rowAnim = (i) => (reduce ? {} : {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, delay: Math.min(i, 12) * 0.03, ease: [0.16, 1, 0.3, 1] },
  });

  // Mono uppercase table header cell
  const thCls = 'px-5 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground';

  if (loading) {
    return (
      <DashboardLayout title="Supervisor Dashboard">
        <div className="space-y-6">
          <Shimmer className="h-10 w-72" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <Shimmer key={i} className="h-32" />)}
          </div>
          <Shimmer className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Supervisor Dashboard">
      <div className="space-y-6">

        {/* ── Page header ── */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Live · 30 s refresh
              </span>
            </div>
            <h2 className="text-[26px] leading-tight font-semibold text-foreground tracking-tight">Supervisor Dashboard</h2>
            <p className="mt-1 text-sm text-muted-foreground">Escalations and urgent tickets that need a decision</p>
          </div>
          <motion.button
            whileHover={hover} whileTap={tap} onClick={fetchData}
            className="inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </motion.button>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="supervisor-stats">
          <SupKpi icon={ArrowUpCircle} tone={STAT_TONES.violet} label="Escalated Tickets" value={stats?.escalated_tickets || 0} />
          <SupKpi icon={AlertTriangle} tone={STAT_TONES.orange} label="Customer Escalations" value={stats?.customer_escalated || 0} />
          <SupKpi icon={Clock} tone={STAT_TONES.rose} label="Urgent (SLA)" value={stats?.urgent_tickets || 0} />
          <SupKpi icon={CheckCircle} tone={STAT_TONES.emerald} label="Resolved Today" value={stats?.resolved_today || 0} />
        </div>

        {/* ── Urgent banner ── */}
        {urgentTickets.length > 0 && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rose-500/20">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
              </div>
              <span className="font-semibold text-rose-400">
                URGENT — {urgentTickets.length} customer escalation{urgentTickets.length === 1 ? '' : 's'} require immediate action
              </span>
            </div>
            <motion.button
              whileHover={hover} whileTap={tap}
              onClick={() => document.getElementById('urgent-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="rounded-md bg-rose-500/20 px-4 py-1.5 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/30"
            >
              Review now
            </motion.button>
          </motion.div>
        )}

        {/* ── Customer-escalated table ── */}
        {urgentTickets.length > 0 && (
          <div id="urgent-table" className="mg-card overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/15">
                <AlertTriangle className="h-[15px] w-[15px] text-rose-400" />
              </div>
              <h3 className="text-[15px] font-semibold text-foreground">Customer Escalated</h3>
              <span className="rounded font-mono text-[10px] font-semibold uppercase tracking-wide bg-rose-500/15 text-rose-400 px-2 py-0.5 ring-1 ring-rose-500/25">
                {urgentTickets.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className={thCls}>Ticket #</th>
                    <th className={thCls}>Customer</th>
                    <th className={thCls}>Issue</th>
                    <th className={thCls}>Escalated At</th>
                    <th className={cn(thCls, 'text-right')}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {urgentTickets.map((ticket, i) => (
                    <motion.tr key={ticket.id} {...rowAnim(i)} className="transition-colors hover:bg-rose-500/[0.06]">
                      <td className="px-5 py-4 align-top font-mono text-[13px] font-semibold text-rose-400">{ticket.ticket_number}</td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-sm font-semibold text-foreground">{ticket.customer_name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{ticket.customer_phone}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="max-w-md text-sm text-foreground">{ticket.issue_description}</p>
                      </td>
                      <td className="px-5 py-4 align-top font-mono text-xs text-muted-foreground">
                        {ticket.customer_escalated_at ? new Date(ticket.customer_escalated_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <motion.button
                            whileHover={hover} whileTap={tap} onClick={() => viewTicketDetails(ticket.id)}
                            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <Eye className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            whileHover={hover} whileTap={tap} onClick={() => openActionDialog(ticket)}
                            data-testid={`action-${ticket.id}`}
                            className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-rose-400 ring-1 ring-rose-500/25 transition-colors hover:bg-rose-500/25"
                          >
                            Take Action <ArrowRight className="h-3.5 w-3.5" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Escalated by support ── */}
        <div className="mg-card overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
              <ArrowUpCircle className="h-[15px] w-[15px] text-primary" />
            </div>
            <h3 className="text-[15px] font-semibold text-foreground">Escalated by Support</h3>
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-border">
              {escalatedTickets.length}
            </span>
          </div>
          {escalatedTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-foreground">No escalated tickets</p>
              <p className="mt-1 text-xs text-muted-foreground">The support queue is all clear.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className={thCls}>Ticket #</th>
                    <th className={thCls}>Customer</th>
                    <th className={thCls}>Device</th>
                    <th className={thCls}>Status / Notes</th>
                    <th className={thCls}>Escalated By</th>
                    <th className={thCls}>SLA</th>
                    <th className={cn(thCls, 'text-right')}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {escalatedTickets.map((ticket, i) => (
                    <motion.tr
                      key={ticket.id} {...rowAnim(i)}
                      className={cn(
                        'transition-colors hover:bg-accent/40',
                        ticket.supervisor_sla_breached && 'bg-rose-500/[0.04]',
                        !ticket.supervisor_sla_breached && ticket.status === 'supervisor_followup' && 'bg-amber-400/[0.04]',
                      )}
                    >
                      <td className="px-5 py-4 align-top">
                        <p className="font-mono text-[13px] font-semibold text-primary">{ticket.ticket_number}</p>
                        {ticket.status === 'supervisor_followup' && (
                          <span className="mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25">
                            Followup
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-sm font-semibold text-foreground">{ticket.customer_name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{ticket.customer_phone}</p>
                      </td>
                      <td className="px-5 py-4 align-top text-sm text-foreground">{ticket.device_type || '-'}</td>
                      <td className="px-5 py-4 align-top max-w-md">
                        <p className="line-clamp-2 text-sm text-foreground">{ticket.issue_description}</p>
                        {ticket.supervisor_notes && (
                          <div className="mt-2 rounded border border-violet-400/20 bg-violet-400/10 p-2 text-xs text-violet-300">
                            <span className="font-semibold">Supervisor: </span>
                            <span className="whitespace-pre-wrap">{ticket.supervisor_notes}</span>
                          </div>
                        )}
                        {ticket.escalation_notes && (
                          <div className="mt-1 rounded border border-orange-400/20 bg-orange-400/10 p-2 text-xs text-orange-300">
                            <span className="font-semibold">Escalation: </span>
                            <span className="whitespace-pre-wrap">{ticket.escalation_notes}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-sm text-foreground">{ticket.escalated_by_name || '-'}</p>
                        <p className="text-xs text-muted-foreground">
                          {ticket.escalated_at ? new Date(ticket.escalated_at).toLocaleString() : ''}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span className={cn(
                          'rounded font-mono text-[10px] font-semibold uppercase tracking-wide px-2 py-1 ring-1',
                          ticket.supervisor_sla_breached
                            ? 'bg-rose-500/15 text-rose-400 ring-rose-500/25'
                            : ticket.supervisor_hours_remaining < 12
                              ? 'bg-amber-400/15 text-amber-400 ring-amber-400/25'
                              : 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25',
                        )}>
                          {formatTimeRemaining(ticket.supervisor_hours_remaining)}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <motion.button
                            whileHover={hover} whileTap={tap} onClick={() => viewTicketDetails(ticket.id)}
                            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <Eye className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            whileHover={hover} whileTap={tap} onClick={() => openActionDialog(ticket)}
                            data-testid={`action-${ticket.id}`}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/25 transition-colors hover:bg-primary/25"
                          >
                            Take Action <ArrowRight className="h-3.5 w-3.5" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Ticket Details Dialog ── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Ticket Details — {selectedTicket?.ticket_number}
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Ticket Info</TabsTrigger>
                <TabsTrigger value="warranties">
                  <Shield className="h-4 w-4 mr-1" /> Warranties ({customerWarranties.length})
                </TabsTrigger>
                <TabsTrigger value="history">
                  <History className="h-4 w-4 mr-1" /> All Tickets ({customerTickets.length})
                </TabsTrigger>
                <TabsTrigger value="timeline">
                  <Clock className="h-4 w-4 mr-1" /> Audit Trail
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-muted-foreground">Status</p><StatusBadge status={selectedTicket.status} /></div>
                  <div><p className="text-sm text-muted-foreground">Device</p><p className="font-medium text-foreground">{selectedTicket.device_type}</p></div>
                  <div><p className="text-sm text-muted-foreground">Customer</p><p className="font-medium text-foreground">{selectedTicket.customer_name}</p></div>
                  <div><p className="text-sm text-muted-foreground">Phone</p><p className="font-mono text-foreground">{selectedTicket.customer_phone}</p></div>
                  <div><p className="text-sm text-muted-foreground">Email</p><p className="font-mono text-sm text-foreground">{selectedTicket.customer_email}</p></div>
                  <div><p className="text-sm text-muted-foreground">City</p><p className="font-medium text-foreground">{selectedTicket.customer_city || '-'}</p></div>
                  {selectedTicket.serial_number && (
                    <div><p className="text-sm text-muted-foreground">Serial Number</p><p className="font-mono text-foreground">{selectedTicket.serial_number}</p></div>
                  )}
                  {selectedTicket.invoice_number && (
                    <div><p className="text-sm text-muted-foreground">Invoice Number</p><p className="font-mono text-foreground">{selectedTicket.invoice_number}</p></div>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Issue</p>
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-foreground">{selectedTicket.issue_description}</div>
                </div>

                {selectedTicket.escalation_notes && (
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Escalation Notes (from Support)</p>
                    <div className="rounded-lg border border-orange-400/20 bg-orange-400/10 p-3 text-orange-300">{selectedTicket.escalation_notes}</div>
                  </div>
                )}

                {selectedTicket.supervisor_notes && (
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">
                      Supervisor Notes
                      {selectedTicket.status === 'supervisor_followup' && (
                        <span className="ml-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-400">(In Followup)</span>
                      )}
                    </p>
                    <div className="rounded-lg border border-violet-400/20 bg-violet-400/10 p-3 text-violet-300">{selectedTicket.supervisor_notes}</div>
                  </div>
                )}

                {selectedTicket.agent_notes && (
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Agent Notes</p>
                    <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-3 text-sky-300">{selectedTicket.agent_notes}</div>
                  </div>
                )}

                {selectedTicket.invoice_file && (
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Invoice Document</p>
                    <button
                      onClick={async () => {
                        if (!(await openAuthedFile(selectedTicket.invoice_file, token, API)))
                          toast.error('Could not open the invoice');
                      }}
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4" /> View Invoice
                    </button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="warranties" className="mt-4">
                {loadingCustomerData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : customerWarranties.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <Shield className="mb-2 h-12 w-12 opacity-30" />
                    <p>No warranties found for this customer</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerWarranties.map((warranty, i) => (
                      <div key={i} className="rounded-lg border border-border bg-muted/40 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-foreground">{warranty.device_type || warranty.product_type || 'Product'}</p>
                            <p className="text-sm text-muted-foreground">Order: {warranty.order_id || warranty.serial_number || '-'}</p>
                          </div>
                          <StatusBadge status={warranty.status} />
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-foreground">
                          <div><span className="text-muted-foreground">Start:</span>{' '}
                            {warranty.warranty_start_date ? new Date(warranty.warranty_start_date).toLocaleDateString() : '-'}</div>
                          <div><span className="text-muted-foreground">Expires:</span>{' '}
                            {warranty.warranty_end_date ? new Date(warranty.warranty_end_date).toLocaleDateString() : '-'}</div>
                        </div>
                        {warranty.admin_invoice_file && (
                          <button
                            onClick={async () => {
                              if (!(await openAuthedFile(warranty.admin_invoice_file, token, API)))
                                toast.error('Could not open the invoice');
                            }}
                            className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <FileText className="h-3 w-3" /> View Invoice
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {loadingCustomerData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : customerTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <History className="mb-2 h-12 w-12 opacity-30" />
                    <p>No previous tickets found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerTickets.map((ticket, i) => (
                      <div key={i}
                        className={cn(
                          'rounded-lg border p-3',
                          ticket.id === selectedTicket.id
                            ? 'border-primary/40 bg-primary/10'
                            : 'border-border bg-muted/40',
                        )}>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-mono text-sm text-primary">{ticket.ticket_number}</p>
                            <p className="text-sm text-foreground">{ticket.issue_description?.substring(0, 80)}...</p>
                          </div>
                          <StatusBadge status={ticket.status} />
                        </div>
                        <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                          <span>{ticket.device_type}</span>
                          <span>{ticket.support_type}</span>
                          <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <div className="max-h-80 space-y-3 overflow-y-auto">
                  <h4 className="border-b border-border pb-2 text-sm font-medium text-foreground">Complete Audit Trail</h4>
                  {selectedTicket.history?.length > 0 ? (
                    selectedTicket.history.map((entry, i) => (
                      <div key={i} className="flex gap-3 border-l-2 border-primary/30 pl-3 text-sm">
                        <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-foreground">{entry.action}</p>
                            <span className="font-mono text-xs text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">By: {entry.by || 'System'}</p>
                          {entry.notes && (
                            <div className="mt-1 rounded bg-muted/60 p-2 text-xs text-foreground">{entry.notes}</div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No history entries yet</p>
                  )}
                  <div className="mt-4 border-t border-border pt-3">
                    <h5 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Key Dates</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-border bg-muted/40 p-2">
                        <span className="text-muted-foreground">Created:</span>
                        <p className="font-medium text-foreground">{selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString() : '-'}</p>
                      </div>
                      {selectedTicket.escalated_at && (
                        <div className="rounded-md border border-orange-400/20 bg-orange-400/10 p-2">
                          <span className="text-orange-400">Escalated:</span>
                          <p className="font-medium text-orange-300">{new Date(selectedTicket.escalated_at).toLocaleString()}</p>
                        </div>
                      )}
                      {selectedTicket.closed_at && (
                        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2">
                          <span className="text-emerald-500">Closed:</span>
                          <p className="font-medium text-emerald-400">{new Date(selectedTicket.closed_at).toLocaleString()}</p>
                        </div>
                      )}
                      {selectedTicket.sla_due && (
                        <div className={cn(
                          'rounded-md border p-2',
                          selectedTicket.sla_breached
                            ? 'border-rose-500/20 bg-rose-500/10'
                            : 'border-sky-400/20 bg-sky-400/10',
                        )}>
                          <span className={selectedTicket.sla_breached ? 'text-rose-400' : 'text-sky-400'}>SLA Due:</span>
                          <p className={cn('font-medium', selectedTicket.sla_breached ? 'text-rose-300' : 'text-sky-300')}>
                            {new Date(selectedTicket.sla_due).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Supervisor Action Dialog ── */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Take Action — {selectedTicket?.ticket_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">Customer: {selectedTicket?.customer_name}</p>
              <p className="mt-1 text-sm font-medium text-foreground">{selectedTicket?.issue_description}</p>
            </div>

            {selectedTicket?.escalation_notes && (
              <div className="rounded-lg border border-orange-400/20 bg-orange-400/10 p-3">
                <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-orange-400">Agent's Escalation Notes:</p>
                <p className="text-sm text-orange-300">{selectedTicket.escalation_notes}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Action *</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger data-testid="action-select"><SelectValue placeholder="Select action" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_process">
                    <div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-amber-400" />In Process (Followup Required)</div>
                  </SelectItem>
                  <SelectItem value="resolve">
                    <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-500" />Resolve on Call</div>
                  </SelectItem>
                  <SelectItem value="spare_dispatch">
                    <div className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" />Send Spare Part</div>
                  </SelectItem>
                  <SelectItem value="reverse_pickup">
                    <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-400" />Arrange Reverse Pickup</div>
                  </SelectItem>
                  <SelectItem value="close_ticket">
                    <div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-rose-400" />Close Ticket</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {action === 'spare_dispatch' && skus.length > 0 && (
              <div className="space-y-2">
                <Label>Select SKU</Label>
                <Select value={selectedSku} onValueChange={setSelectedSku}>
                  <SelectTrigger><SelectValue placeholder="Select spare part" /></SelectTrigger>
                  <SelectContent>
                    {skus.filter((s) => s.active && s.stock_quantity > 0).map((sku) => (
                      <SelectItem key={sku.id} value={sku.sku_code}>
                        {sku.model_name} ({sku.sku_code}) - Stock: {sku.stock_quantity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes * (min 100 characters)</Label>
              <Textarea
                placeholder="Enter detailed notes about your decision and next steps..."
                value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
                data-testid="notes-input"
              />
              <p className={cn('font-mono text-xs', notes.length < 100 ? 'text-rose-400' : 'text-emerald-500')}>
                {notes.length}/100 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSupervisorAction}
              disabled={actionLoading || notes.length < 100 || !action}
              data-testid="confirm-action-btn"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

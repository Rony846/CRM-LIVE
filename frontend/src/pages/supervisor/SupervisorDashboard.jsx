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

// KPI card — tinted icon tile, label-caps, big mono number.
const SupKpi = ({ icon: Icon, tone, label, value }) => (
  <div className="bg-card border border-border rounded-xl p-5 shadow-soft transition-colors hover:border-primary/40">
    <span className={`inline-flex w-10 h-10 rounded-lg items-center justify-center ${tone}`}>
      <Icon className="w-5 h-5" />
    </span>
    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mt-4">{label}</p>
    <p className="font-mono text-[30px] leading-none font-semibold text-foreground mt-1 tabular-nums">{value}</p>
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
  const thCls = 'px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground';

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
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[26px] leading-tight font-semibold text-foreground tracking-tight">Supervisor Dashboard</h2>
            <p className="text-sm text-muted-foreground mt-1">Escalations and urgent tickets that need a decision</p>
          </div>
          <motion.button
            whileHover={hover} whileTap={tap} onClick={fetchData}
            className="inline-flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-[13px] font-medium text-foreground hover:bg-secondary/60 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </motion.button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="supervisor-stats">
          <SupKpi icon={ArrowUpCircle} tone="bg-violet-50 text-violet-600" label="Escalated Tickets" value={stats?.escalated_tickets || 0} />
          <SupKpi icon={AlertTriangle} tone="bg-orange-50 text-orange-600" label="Customer Escalations" value={stats?.customer_escalated || 0} />
          <SupKpi icon={Clock} tone="bg-rose-50 text-rose-600" label="Urgent (SLA)" value={stats?.urgent_tickets || 0} />
          <SupKpi icon={CheckCircle} tone="bg-emerald-50 text-emerald-600" label="Resolved Today" value={stats?.resolved_today || 0} />
        </div>

        {/* Urgent banner */}
        {urgentTickets.length > 0 && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-rose-600 text-white rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-soft-md"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <span className="font-semibold">
                URGENT — {urgentTickets.length} customer escalation{urgentTickets.length === 1 ? '' : 's'} require immediate action
              </span>
            </div>
            <motion.button
              whileHover={hover} whileTap={tap}
              onClick={() => document.getElementById('urgent-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-lg font-semibold text-sm transition-colors"
            >
              Review now
            </motion.button>
          </motion.div>
        )}

        {/* Urgent — customer escalated */}
        {urgentTickets.length > 0 && (
          <div id="urgent-table" className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="text-[15px] font-semibold text-foreground">Customer Escalated</h3>
              <span className="text-xs font-semibold text-rose-600 bg-rose-50 rounded-full px-2 py-0.5">{urgentTickets.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-secondary/50 border-b border-border">
                    <th className={thCls}>Ticket #</th>
                    <th className={thCls}>Customer</th>
                    <th className={thCls}>Issue</th>
                    <th className={thCls}>Escalated At</th>
                    <th className={`${thCls} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {urgentTickets.map((ticket, i) => (
                    <motion.tr key={ticket.id} {...rowAnim(i)} className="bg-rose-50/40 transition-colors hover:bg-rose-50/70">
                      <td className="px-5 py-4 align-top font-mono text-[13px] font-semibold text-rose-700">{ticket.ticket_number}</td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-sm font-semibold text-foreground">{ticket.customer_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{ticket.customer_phone}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-sm text-foreground max-w-md">{ticket.issue_description}</p>
                      </td>
                      <td className="px-5 py-4 align-top text-xs font-mono text-muted-foreground">
                        {ticket.customer_escalated_at ? new Date(ticket.customer_escalated_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex gap-2 justify-end">
                          <motion.button
                            whileHover={hover} whileTap={tap} onClick={() => viewTicketDetails(ticket.id)}
                            className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={hover} whileTap={tap} onClick={() => openActionDialog(ticket)}
                            data-testid={`action-${ticket.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors"
                          >
                            Take Action <ArrowRight className="w-3.5 h-3.5" />
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

        {/* Escalated by support */}
        <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 text-primary" />
            <h3 className="text-[15px] font-semibold text-foreground">Escalated by Support</h3>
            <span className="text-xs font-semibold text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{escalatedTickets.length}</span>
          </div>
          {escalatedTickets.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500/60" />
              <p className="text-sm font-medium text-foreground">No escalated tickets</p>
              <p className="text-xs mt-1">The support queue is all clear.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-secondary/50 border-b border-border">
                    <th className={thCls}>Ticket #</th>
                    <th className={thCls}>Customer</th>
                    <th className={thCls}>Device</th>
                    <th className={thCls}>Status / Notes</th>
                    <th className={thCls}>Escalated By</th>
                    <th className={thCls}>SLA</th>
                    <th className={`${thCls} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {escalatedTickets.map((ticket, i) => (
                    <motion.tr
                      key={ticket.id} {...rowAnim(i)}
                      className={`transition-colors hover:bg-secondary/40 ${ticket.supervisor_sla_breached ? 'bg-rose-50/40' : ticket.status === 'supervisor_followup' ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="px-5 py-4 align-top">
                        <p className="font-mono text-[13px] font-semibold text-primary">{ticket.ticket_number}</p>
                        {ticket.status === 'supervisor_followup' && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded">Followup</span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-sm font-semibold text-foreground">{ticket.customer_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{ticket.customer_phone}</p>
                      </td>
                      <td className="px-5 py-4 align-top text-sm text-foreground">{ticket.device_type || '-'}</td>
                      <td className="px-5 py-4 align-top max-w-md">
                        <p className="text-sm text-foreground line-clamp-2">{ticket.issue_description}</p>
                        {ticket.supervisor_notes && (
                          <div className="bg-violet-50 text-violet-800 p-2 rounded mt-2 text-xs">
                            <span className="font-semibold">Supervisor: </span>
                            <span className="whitespace-pre-wrap">{ticket.supervisor_notes}</span>
                          </div>
                        )}
                        {ticket.escalation_notes && (
                          <div className="bg-orange-50 text-orange-800 p-2 rounded mt-1 text-xs">
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
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          ticket.supervisor_sla_breached ? 'bg-rose-50 text-rose-700'
                            : ticket.supervisor_hours_remaining < 12 ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {formatTimeRemaining(ticket.supervisor_hours_remaining)}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex gap-2 justify-end">
                          <motion.button
                            whileHover={hover} whileTap={tap} onClick={() => viewTicketDetails(ticket.id)}
                            className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={hover} whileTap={tap} onClick={() => openActionDialog(ticket)}
                            data-testid={`action-${ticket.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                          >
                            Take Action <ArrowRight className="w-3.5 h-3.5" />
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

      {/* Ticket Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Ticket Details — {selectedTicket?.ticket_number}
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Ticket Info</TabsTrigger>
                <TabsTrigger value="warranties">
                  <Shield className="w-4 h-4 mr-1" /> Warranties ({customerWarranties.length})
                </TabsTrigger>
                <TabsTrigger value="history">
                  <History className="w-4 h-4 mr-1" /> All Tickets ({customerTickets.length})
                </TabsTrigger>
                <TabsTrigger value="timeline">
                  <Clock className="w-4 h-4 mr-1" /> Audit Trail
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
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
                  <p className="text-sm text-muted-foreground mb-1">Issue</p>
                  <div className="bg-secondary/50 p-3 rounded-lg text-foreground">{selectedTicket.issue_description}</div>
                </div>

                {selectedTicket.escalation_notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Escalation Notes (from Support)</p>
                    <div className="bg-orange-50 text-orange-900 p-3 rounded-lg border border-orange-200">{selectedTicket.escalation_notes}</div>
                  </div>
                )}

                {selectedTicket.supervisor_notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Supervisor Notes
                      {selectedTicket.status === 'supervisor_followup' && (
                        <span className="ml-2 text-amber-600 text-xs font-medium">(In Followup)</span>
                      )}
                    </p>
                    <div className="bg-violet-50 text-violet-900 p-3 rounded-lg border border-violet-200">{selectedTicket.supervisor_notes}</div>
                  </div>
                )}

                {selectedTicket.agent_notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Agent Notes</p>
                    <div className="bg-blue-50 text-blue-900 p-3 rounded-lg">{selectedTicket.agent_notes}</div>
                  </div>
                )}

                {selectedTicket.invoice_file && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Invoice Document</p>
                    <button
                      onClick={async () => {
                        if (!(await openAuthedFile(selectedTicket.invoice_file, token, API)))
                          toast.error('Could not open the invoice');
                      }}
                      className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium"
                    >
                      <FileText className="w-4 h-4" /> View Invoice
                    </button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="warranties" className="mt-4">
                {loadingCustomerData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : customerWarranties.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No warranties found for this customer</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerWarranties.map((warranty, i) => (
                      <div key={i} className="bg-secondary/50 p-4 rounded-lg border border-border">
                        <div className="flex justify-between items-start">
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
                            className="inline-flex items-center gap-1 text-primary text-sm mt-2 hover:underline"
                          >
                            <FileText className="w-3 h-3" /> View Invoice
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
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : customerTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No previous tickets found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerTickets.map((ticket, i) => (
                      <div key={i}
                        className={`p-3 rounded-lg border ${ticket.id === selectedTicket.id ? 'bg-primary/10 border-primary/40' : 'bg-secondary/50 border-border'}`}>
                        <div className="flex justify-between items-start">
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
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  <h4 className="text-sm font-medium text-foreground border-b border-border pb-2">Complete Audit Trail</h4>
                  {selectedTicket.history?.length > 0 ? (
                    selectedTicket.history.map((entry, i) => (
                      <div key={i} className="flex gap-3 text-sm border-l-2 border-primary/30 pl-3">
                        <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-primary" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-foreground">{entry.action}</p>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">By: {entry.by || 'System'}</p>
                          {entry.notes && (
                            <div className="mt-1 bg-secondary/50 p-2 rounded text-xs text-foreground">{entry.notes}</div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No history entries yet</p>
                  )}
                  <div className="border-t border-border pt-3 mt-4">
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Key Dates</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-secondary/50 p-2 rounded">
                        <span className="text-muted-foreground">Created:</span>
                        <p className="font-medium text-foreground">{selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString() : '-'}</p>
                      </div>
                      {selectedTicket.escalated_at && (
                        <div className="bg-orange-50 p-2 rounded">
                          <span className="text-orange-700">Escalated:</span>
                          <p className="font-medium text-orange-900">{new Date(selectedTicket.escalated_at).toLocaleString()}</p>
                        </div>
                      )}
                      {selectedTicket.closed_at && (
                        <div className="bg-emerald-50 p-2 rounded">
                          <span className="text-emerald-700">Closed:</span>
                          <p className="font-medium text-emerald-900">{new Date(selectedTicket.closed_at).toLocaleString()}</p>
                        </div>
                      )}
                      {selectedTicket.sla_due && (
                        <div className={`p-2 rounded ${selectedTicket.sla_breached ? 'bg-rose-50' : 'bg-blue-50'}`}>
                          <span className={selectedTicket.sla_breached ? 'text-rose-700' : 'text-blue-700'}>SLA Due:</span>
                          <p className={`font-medium ${selectedTicket.sla_breached ? 'text-rose-900' : 'text-blue-900'}`}>
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

      {/* Supervisor Action Dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Take Action — {selectedTicket?.ticket_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-secondary/50 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Customer: {selectedTicket?.customer_name}</p>
              <p className="text-sm font-medium text-foreground mt-1">{selectedTicket?.issue_description}</p>
            </div>

            {selectedTicket?.escalation_notes && (
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                <p className="text-xs text-orange-700 font-medium mb-1">Agent's Escalation Notes:</p>
                <p className="text-sm text-orange-900">{selectedTicket.escalation_notes}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Action *</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger data-testid="action-select"><SelectValue placeholder="Select action" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_process">
                    <div className="flex items-center gap-2"><RefreshCw className="w-4 h-4 text-amber-600" />In Process (Followup Required)</div>
                  </SelectItem>
                  <SelectItem value="resolve">
                    <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-600" />Resolve on Call</div>
                  </SelectItem>
                  <SelectItem value="spare_dispatch">
                    <div className="flex items-center gap-2"><Package className="w-4 h-4 text-blue-600" />Send Spare Part</div>
                  </SelectItem>
                  <SelectItem value="reverse_pickup">
                    <div className="flex items-center gap-2"><Wrench className="w-4 h-4 text-orange-600" />Arrange Reverse Pickup</div>
                  </SelectItem>
                  <SelectItem value="close_ticket">
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-rose-600" />Close Ticket</div>
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
              <p className={`text-xs ${notes.length < 100 ? 'text-rose-500' : 'text-emerald-600'}`}>
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
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion, useReducedMotion } from 'framer-motion';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Shimmer } from '@/components/ui/motion';
import { openAuthedFile } from '@/lib/openFile';
import { toast } from 'sonner';
import {
  Search, Eye, AlertTriangle, FileText, Inbox,
  ChevronLeft, ChevronRight, Download, FilterX,
} from 'lucide-react';

// Obsidian status chip tones — opacity tints that read on the dark canvas.
const STATUS_TONES = {
  slate:  'bg-muted text-muted-foreground ring-border',
  blue:   'bg-sky-400/15 text-sky-400 ring-sky-400/25',
  green:  'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
  amber:  'bg-amber-400/15 text-amber-400 ring-amber-400/25',
  violet: 'bg-violet-400/15 text-violet-400 ring-violet-400/25',
  cyan:   'bg-cyan-400/15 text-cyan-400 ring-cyan-400/25',
  teal:   'bg-teal-400/15 text-teal-400 ring-teal-400/25',
  orange: 'bg-orange-400/15 text-orange-400 ring-orange-400/25',
};

const STATUS_MAP = {
  new_request:           { tone: 'slate',  text: 'New Request' },
  call_support_followup: { tone: 'blue',   text: 'Call Support Followup' },
  resolved_on_call:      { tone: 'green',  text: 'Resolved on Call' },
  closed_by_agent:       { tone: 'green',  text: 'Closed by Agent' },
  closed:                { tone: 'slate',  text: 'Closed' },
  hardware_service:      { tone: 'orange', text: 'Hardware Service' },
  awaiting_label:        { tone: 'amber',  text: 'Awaiting Label' },
  label_uploaded:        { tone: 'blue',   text: 'Label Uploaded' },
  received_at_factory:   { tone: 'violet', text: 'Received at Factory' },
  in_repair:             { tone: 'cyan',   text: 'In Repair' },
  repair_completed:      { tone: 'teal',   text: 'Repair Completed' },
  ready_for_dispatch:    { tone: 'green',  text: 'Ready for Dispatch' },
  dispatched:            { tone: 'green',  text: 'Dispatched' },
};

const StatusCell = ({ status, supportType }) => {
  const cfg = STATUS_MAP[status] || { tone: 'slate', text: (status || 'Unknown').replace(/_/g, ' ') };
  const badge = 'px-2 py-0.5 text-[10px] font-mono font-semibold rounded uppercase tracking-wide ring-1';
  return (
    <div className="flex flex-col gap-1 items-start">
      {supportType && (
        <span className={`${badge} ${
          supportType === 'hardware'
            ? 'bg-orange-400/15 text-orange-400 ring-orange-400/25'
            : 'bg-muted text-muted-foreground ring-border'
        }`}>
          {supportType === 'hardware' ? 'Hardware' : 'Phone'}
        </span>
      )}
      <span className={`${badge} ${STATUS_TONES[cfg.tone]}`}>
        {cfg.text}
      </span>
    </div>
  );
};

// SLA countdown — a tactical progress bar from ticket creation → SLA due.
const SlaBar = ({ ticket }) => {
  if (ticket.closed_at) {
    return ticket.sla_breached ? (
      <span className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase text-rose-400">
        <AlertTriangle className="w-3 h-3" /> Breached
      </span>
    ) : null;
  }
  if (!ticket.sla_due || !ticket.created_at) return null;
  const start = new Date(ticket.created_at).getTime();
  const due = new Date(ticket.sla_due).getTime();
  if (!start || !due || due <= start) return null;
  const pct = Math.max(0, Math.min(100, ((Date.now() - start) / (due - start)) * 100));
  const breached = ticket.sla_breached || pct >= 100;
  const tone = breached ? 'bg-rose-400' : pct > 75 ? 'bg-amber-400' : 'bg-emerald-400';
  const labelColor = breached ? 'text-rose-400' : pct > 75 ? 'text-amber-400' : 'text-muted-foreground';
  return (
    <div className="mt-2 w-[120px]">
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${breached ? 100 : pct}%` }} />
      </div>
      <p className={`mt-1 font-mono text-[9px] uppercase tracking-wide ${labelColor}`}>
        {breached ? 'SLA breached' : `${Math.round(pct)}% elapsed`}
      </p>
    </div>
  );
};

const STORAGE_KEY = 'admin_tickets_filters';
const EMPTY_FILTERS = { search: '', status: '', support_type: '', sla_breached: '', from_date: '', to_date: '' };

export default function AdminTickets() {
  const { token } = useAuth();
  const reduce = useReducedMotion();

  const savedFilters = sessionStorage.getItem(STORAGE_KEY);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(savedFilters ? JSON.parse(savedFilters) : { ...EMPTY_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // Button animation presets (disabled under prefers-reduced-motion).
  const hover = reduce ? {} : { scale: 1.03 };
  const tap = reduce ? {} : { scale: 0.96 };
  const iconHover = reduce ? {} : { scale: 1.12 };
  const iconTap = reduce ? {} : { scale: 0.88 };

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentPage]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.support_type && filters.support_type !== 'all') params.append('support_type', filters.support_type);
      if (filters.sla_breached && filters.sla_breached !== 'all') {
        params.append('sla_breached', filters.sla_breached === 'true');
      }
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      params.append('page', currentPage);
      params.append('limit', pageSize);

      const response = await axios.get(`${API}/admin/tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.tickets) {
        setTickets(response.data.tickets);
        setTotalCount(response.data.total);
        setTotalPages(response.data.total_pages);
      } else {
        setTickets(response.data);
        setTotalCount(response.data.length);
        setTotalPages(1);
      }
    } catch (error) {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const applyFilters = () => {
    if (currentPage !== 1) setCurrentPage(1);
    else fetchTickets();
  };

  const clearFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(EMPTY_FILTERS));
    if (currentPage !== 1) setCurrentPage(1);
    else setTimeout(fetchTickets, 50);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) setCurrentPage(newPage);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  };

  const getPaginationRange = () => {
    const range = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  };

  const exportCsv = () => {
    if (!tickets.length) { toast.error('No tickets on this page to export'); return; }
    const cols = ['ticket_number', 'customer_name', 'customer_phone', 'customer_email',
      'product_name', 'serial_number', 'status', 'support_type', 'assigned_to_name',
      'created_at', 'sla_due', 'closed_at'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...tickets.map((t) => cols.map((c) => esc(t[c])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets_page${currentPage}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${tickets.length} tickets`);
  };

  // The /uploads route needs a JWT — a plain link can't send one; fetch with auth.
  const openInvoice = async (ticket) => {
    const ok = await openAuthedFile(ticket.invoice_file, token, API);
    if (!ok) toast.error('Could not open the invoice — file missing or access denied');
  };

  const labelCls = 'font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-1.5 block';
  const thCls = 'px-5 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground';

  return (
    <DashboardLayout title="Ticket Pipeline">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Service queue · Live
            </span>
          </div>
          <h2 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">Ticket Pipeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono font-semibold text-primary tabular-nums">{totalCount.toLocaleString('en-IN')}</span>
            {' '}tickets across all channels and statuses
          </p>
        </div>
        <motion.button
          whileHover={hover} whileTap={tap} onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border rounded text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent"
        >
          <Download className="w-4 h-4" /> Export CSV
        </motion.button>
      </div>

      {/* Filter bar */}
      <div className="mg-card rounded-lg border border-border bg-card p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className={labelCls}>Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Ticket / Customer / Phone / Product"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="pl-9"
                data-testid="ticket-search"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Support Type</label>
            <Select value={filters.support_type || 'all'} onValueChange={(v) => handleFilterChange('support_type', v)}>
              <SelectTrigger data-testid="support-type-filter"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="hardware">Hardware</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className={labelCls}>Status</label>
            <Select value={filters.status || 'all'} onValueChange={(v) => handleFilterChange('status', v)}>
              <SelectTrigger data-testid="status-filter"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new_request">New Request</SelectItem>
                <SelectItem value="call_support_followup">Call Support Followup</SelectItem>
                <SelectItem value="resolved_on_call">Resolved on Call</SelectItem>
                <SelectItem value="closed_by_agent">Closed by Agent</SelectItem>
                <SelectItem value="hardware_service">Hardware Service</SelectItem>
                <SelectItem value="awaiting_label">Awaiting Label</SelectItem>
                <SelectItem value="received_at_factory">Received at Factory</SelectItem>
                <SelectItem value="in_repair">In Repair</SelectItem>
                <SelectItem value="repair_completed">Repair Completed</SelectItem>
                <SelectItem value="ready_for_dispatch">Ready for Dispatch</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className={labelCls}>SLA Status</label>
            <Select value={filters.sla_breached || 'all'} onValueChange={(v) => handleFilterChange('sla_breached', v)}>
              <SelectTrigger data-testid="sla-filter"><SelectValue placeholder="All SLA" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All SLA</SelectItem>
                <SelectItem value="false">Within SLA</SelectItem>
                <SelectItem value="true">SLA Breached</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <motion.button
              whileHover={hover} whileTap={tap} onClick={applyFilters}
              data-testid="apply-filters-btn"
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Apply
            </motion.button>
            <motion.button
              whileHover={iconHover} whileTap={iconTap} onClick={clearFilters}
              title="Clear filters"
              className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
            >
              <FilterX className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-3">
          <div>
            <label className={labelCls}>From Date</label>
            <Input type="date" value={filters.from_date}
              onChange={(e) => handleFilterChange('from_date', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>To Date</label>
            <Input type="date" value={filters.to_date}
              onChange={(e) => handleFilterChange('to_date', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Tickets table */}
      <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Shimmer key={i} className="h-14 w-full" />)}
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Inbox className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No tickets found</p>
            <p className="text-xs mt-1">Try adjusting or clearing your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-secondary/50 border-b border-border">
                  <th className={thCls}>Ticket</th>
                  <th className={thCls}>Customer</th>
                  <th className={thCls}>Product / Issue</th>
                  <th className={thCls}>Support / Status</th>
                  <th className={`${thCls} text-center`}>Invoice</th>
                  <th className={thCls}>Assigned To</th>
                  <th className={thCls}>Dates</th>
                  <th className={`${thCls} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.map((ticket, idx) => (
                  <motion.tr
                    key={ticket.id}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(idx, 14) * 0.025, ease: [0.16, 1, 0.3, 1] }}
                    className={`group transition-colors hover:bg-secondary/40 ${ticket.sla_breached ? 'bg-rose-500/[0.06]' : ''}`}
                    data-testid={`ticket-row-${ticket.id}`}
                  >
                    {/* Ticket */}
                    <td className="px-5 py-4 align-top">
                      <p className="font-mono text-[13px] font-semibold text-primary">{ticket.ticket_number}</p>
                      {ticket.source === 'voltdoctor' && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-violet-400/15 text-violet-400 ring-1 ring-violet-400/25 rounded text-[10px] font-mono font-semibold uppercase tracking-wide">VoltDoctor</span>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{ticket.customer_city || '-'}</p>
                    </td>

                    {/* Customer */}
                    <td className="px-5 py-4 align-top">
                      <p className="text-sm font-semibold text-foreground">{ticket.customer_name || '-'}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{ticket.customer_phone || '-'}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[170px]">{ticket.customer_email || '-'}</p>
                    </td>

                    {/* Product / Issue */}
                    <td className="px-5 py-4 align-top">
                      <p className="text-sm font-semibold text-foreground">{ticket.product_name || ticket.device_type || '-'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">S/N: {ticket.serial_number || '-'}</p>
                      {ticket.issue_description && (
                        <p className="text-xs text-muted-foreground italic truncate max-w-[200px] mt-0.5">
                          "{ticket.issue_description}"
                        </p>
                      )}
                    </td>

                    {/* Support / Status */}
                    <td className="px-5 py-4 align-top">
                      <StatusCell status={ticket.status} supportType={ticket.support_type} />
                    </td>

                    {/* Invoice */}
                    <td className="px-5 py-4 align-top text-center">
                      {ticket.invoice_file ? (
                        <motion.button
                          whileHover={hover} whileTap={tap}
                          onClick={() => openInvoice(ticket)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" /> View
                        </motion.button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No invoice</span>
                      )}
                    </td>

                    {/* Assigned To */}
                    <td className="px-5 py-4 align-top">
                      {ticket.assigned_to_name ? (
                        <p className="text-sm font-medium text-foreground">{ticket.assigned_to_name}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Unassigned</p>
                      )}
                    </td>

                    {/* Dates */}
                    <td className="px-5 py-4 align-top">
                      <div className="font-mono text-[10px] leading-relaxed">
                        <p><span className="text-muted-foreground uppercase">Created:</span> {formatDate(ticket.created_at)}</p>
                        <p>
                          <span className={`uppercase ${ticket.sla_breached ? 'text-rose-400' : 'text-muted-foreground'}`}>SLA Due:</span>{' '}
                          <span className={ticket.sla_breached ? 'text-rose-400 font-semibold' : ''}>{formatDate(ticket.sla_due)}</span>
                        </p>
                        <p><span className="text-muted-foreground uppercase">Closed:</span> {ticket.closed_at ? formatDate(ticket.closed_at) : '-'}</p>
                      </div>
                      <SlaBar ticket={ticket} />
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 align-top text-right">
                      <Link to={`/admin/tickets/${ticket.id}`} data-testid={`view-ticket-${ticket.id}`}>
                        <motion.span
                          whileHover={iconHover} whileTap={iconTap}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </motion.span>
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && tickets.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-muted/30 border-t border-border">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString('en-IN')}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <motion.button
                  whileHover={currentPage === 1 ? {} : iconHover} whileTap={currentPage === 1 ? {} : iconTap}
                  onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
                  data-testid="prev-page-btn"
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-card disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </motion.button>
                {getPaginationRange().map((page) => (
                  <motion.button
                    key={page}
                    whileHover={page === currentPage ? {} : hover} whileTap={tap}
                    onClick={() => handlePageChange(page)}
                    data-testid={`page-${page}-btn`}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                      page === currentPage
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-card'
                    }`}
                  >
                    {page}
                  </motion.button>
                ))}
                <motion.button
                  whileHover={currentPage === totalPages ? {} : iconHover} whileTap={currentPage === totalPages ? {} : iconTap}
                  onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
                  data-testid="next-page-btn"
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-card disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

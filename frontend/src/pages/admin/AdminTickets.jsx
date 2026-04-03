import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Search, Eye, Loader2, AlertTriangle, Phone, Wrench,
  Filter, Calendar, Clock, FileText, ExternalLink, ChevronLeft, ChevronRight
} from 'lucide-react';

const StatusBadge = ({ status, supportType }) => {
  const getStatusConfig = () => {
    if (supportType === 'hardware') {
      switch (status) {
        case 'hardware_service': return { bg: 'bg-orange-600', text: 'Hardware Service' };
        case 'awaiting_label': return { bg: 'bg-yellow-600', text: 'Hardware Service - Awaiting Label' };
        case 'label_uploaded': return { bg: 'bg-blue-600', text: 'Label Uploaded' };
        case 'received_at_factory': return { bg: 'bg-purple-600', text: 'Received at Factory' };
        case 'in_repair': return { bg: 'bg-cyan-600', text: 'In Repair' };
        case 'repair_completed': return { bg: 'bg-teal-600', text: 'Repair Completed' };
        case 'ready_for_dispatch': return { bg: 'bg-green-600', text: 'Ready for Dispatch' };
        case 'dispatched': return { bg: 'bg-green-700', text: 'Dispatched' };
        default: return { bg: 'bg-orange-600', text: 'Hardware' };
      }
    } else {
      switch (status) {
        case 'new_request': return { bg: 'bg-gray-600', text: 'New Request' };
        case 'call_support_followup': return { bg: 'bg-blue-600', text: 'Call Support - Followup' };
        case 'resolved_on_call': return { bg: 'bg-green-600', text: 'Resolved on Call' };
        case 'closed_by_agent': return { bg: 'bg-green-700', text: 'Closed by Agent' };
        case 'closed': return { bg: 'bg-gray-700', text: 'Closed' };
        default: return { bg: 'bg-blue-600', text: 'Phone' };
      }
    }
  };

  const config = getStatusConfig();
  
  return (
    <div className="space-y-1">
      {supportType && (
        <span className={`inline-block px-2 py-0.5 text-xs rounded ${supportType === 'hardware' ? 'bg-orange-600' : 'bg-blue-600'} text-white`}>
          {supportType === 'hardware' ? 'Hardware' : 'Phone'}
        </span>
      )}
      <span className={`block px-2 py-1 text-xs rounded ${config.bg} text-white`}>
        {config.text}
      </span>
    </div>
  );
};

// Key for sessionStorage
const STORAGE_KEY = 'admin_tickets_filters';

export default function AdminTickets() {
  const { token } = useAuth();
  const navigate = useNavigate();
  
  // Initialize filters from sessionStorage
  const savedFilters = sessionStorage.getItem(STORAGE_KEY);
  const initialFilters = savedFilters ? JSON.parse(savedFilters) : {
    search: '',
    status: '',
    support_type: '',
    sla_breached: '',
    from_date: '',
    to_date: ''
  };
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(initialFilters);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    fetchTickets();
  }, [token, currentPage]);

  // Save filters to sessionStorage whenever they change
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
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Handle paginated response
      if (response.data.tickets) {
        setTickets(response.data.tickets);
        setTotalCount(response.data.total);
        setTotalPages(response.data.total_pages);
      } else {
        // Fallback for old API format (array)
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

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setCurrentPage(1); // Reset to page 1 on filter change
    fetchTickets();
  };

  const clearFilters = () => {
    const clearedFilters = {
      search: '',
      status: '',
      support_type: '',
      sla_breached: '',
      from_date: '',
      to_date: ''
    };
    setFilters(clearedFilters);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(clearedFilters));
    setCurrentPage(1);
    setTimeout(fetchTickets, 100);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate pagination range
  const getPaginationRange = () => {
    const range = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  };

  return (
    <DashboardLayout title="Admin - All Tickets">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">All Repair Tickets</h2>
        <p className="text-slate-400">
          This view shows all repair tickets (phone and hardware). Admin can see the{' '}
          <span className="text-cyan-400">invoice uploaded by the customer</span>{' '}
          while raising the ticket under the column Customer Invoice.
        </p>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-slate-400 mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="ticket / customer / phone / product"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-700 text-white"
                  data-testid="ticket-search"
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                />
              </div>
            </div>
            
            <div className="w-40">
              <label className="text-sm text-slate-400 mb-1 block">Support type</label>
              <Select value={filters.support_type || 'all'} onValueChange={(v) => handleFilterChange('support_type', v)}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white" data-testid="support-type-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 z-50">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="hardware">Hardware</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-48">
              <label className="text-sm text-slate-400 mb-1 block">Status</label>
              <Select value={filters.status || 'all'} onValueChange={(v) => handleFilterChange('status', v)}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white" data-testid="status-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 z-50">
                  <SelectItem value="all">All</SelectItem>
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
            
            <div className="w-40">
              <label className="text-sm text-slate-400 mb-1 block">SLA Status</label>
              <Select value={filters.sla_breached || 'all'} onValueChange={(v) => handleFilterChange('sla_breached', v)}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white" data-testid="sla-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 z-50">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">
                    <span className="flex items-center gap-1 text-red-400">
                      <AlertTriangle className="w-3 h-3" /> SLA Breached
                    </span>
                  </SelectItem>
                  <SelectItem value="false">Within SLA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-36">
              <label className="text-sm text-slate-400 mb-1 block">From</label>
              <Input
                type="date"
                value={filters.from_date}
                onChange={(e) => handleFilterChange('from_date', e.target.value)}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
            
            <div className="w-36">
              <label className="text-sm text-slate-400 mb-1 block">To</label>
              <Input
                type="date"
                value={filters.to_date}
                onChange={(e) => handleFilterChange('to_date', e.target.value)}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
            
            <Button onClick={applyFilters} className="bg-cyan-600 hover:bg-cyan-700" data-testid="apply-filters-btn">
              Apply Filters
            </Button>
            <Button onClick={clearFilters} variant="outline" className="border-slate-600 text-slate-300">
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">
              Tickets ({totalCount})
            </CardTitle>
            <div className="text-sm text-slate-400">
              Showing {tickets.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p>No tickets found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left p-4 font-medium">Ticket</th>
                    <th className="text-left p-4 font-medium">Customer</th>
                    <th className="text-left p-4 font-medium">Product / Issue</th>
                    <th className="text-left p-4 font-medium">Support / Status</th>
                    <th className="text-left p-4 font-medium">Customer Invoice</th>
                    <th className="text-left p-4 font-medium">Assigned To</th>
                    <th className="text-left p-4 font-medium">Dates</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr 
                      key={ticket.id} 
                      className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${ticket.sla_breached ? 'bg-red-900/10' : ''}`}
                      data-testid={`ticket-row-${ticket.id}`}
                    >
                      {/* Ticket Info */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <p className="font-mono font-medium text-cyan-400">{ticket.ticket_number}</p>
                          {ticket.source === 'voltdoctor' && (
                            <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded text-xs">VoltDoctor</span>
                          )}
                          <p className="text-slate-500 text-xs">City: {ticket.customer_city || '-'}</p>
                        </div>
                      </td>
                      
                      {/* Customer Info */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <p className="text-white font-medium">{ticket.customer_name || '-'}</p>
                          <p className="text-slate-400 font-mono text-xs">{ticket.customer_phone || '-'}</p>
                          <p className="text-slate-500 text-xs truncate max-w-[150px]">{ticket.customer_email || '-'}</p>
                        </div>
                      </td>
                      
                      {/* Product / Issue */}
                      <td className="p-4">
                        <div className="space-y-1 max-w-[200px]">
                          <p className="text-white">{ticket.product_name || ticket.device_type || '-'}</p>
                          <p className="text-slate-400 text-xs">Serial: {ticket.serial_number || '-'}</p>
                          <p className="text-slate-400 text-xs">Invoice#: {ticket.invoice_number || '-'}</p>
                          <p className="text-slate-500 text-xs truncate">Issue: {ticket.issue_description?.substring(0, 50) || '-'}...</p>
                        </div>
                      </td>
                      
                      {/* Support / Status */}
                      <td className="p-4">
                        <StatusBadge status={ticket.status} supportType={ticket.support_type} />
                      </td>
                      
                      {/* Customer Invoice */}
                      <td className="p-4">
                        {ticket.invoice_file ? (
                          <a 
                            href={ticket.invoice_file} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                          >
                            <FileText className="w-4 h-4" />
                            View invoice
                          </a>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      
                      {/* Assigned To */}
                      <td className="p-4">
                        {ticket.assigned_to_name ? (
                          <div>
                            <p className="text-white">{ticket.assigned_to_name}</p>
                            <p className="text-slate-500 text-xs">User ID: {ticket.assigned_to?.substring(0, 8)}...</p>
                          </div>
                        ) : (
                          <div>
                            <span className="text-slate-500">-</span>
                            <p className="text-slate-500 text-xs">User ID: 0</p>
                          </div>
                        )}
                      </td>
                      
                      {/* Dates */}
                      <td className="p-4">
                        <div className="space-y-1 text-xs">
                          <p className="text-slate-400">Created: {formatDate(ticket.created_at)}</p>
                          <p className={`${ticket.sla_breached ? 'text-red-400' : 'text-slate-400'}`}>
                            SLA due: {formatDate(ticket.sla_due)}
                          </p>
                          <p className="text-slate-400">Closed: {ticket.closed_at ? formatDate(ticket.closed_at) : '-'}</p>
                          {ticket.sla_breached && (
                            <span className="inline-flex items-center gap-1 text-red-400">
                              <AlertTriangle className="w-3 h-3" />
                              SLA Breached
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Actions */}
                      <td className="p-4">
                        <Link to={`/admin/tickets/${ticket.id}`}>
                          <Button size="sm" variant="ghost" className="text-cyan-400 hover:text-cyan-300 hover:bg-slate-700" data-testid={`view-ticket-${ticket.id}`}>
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-700">
              <div className="text-sm text-slate-400">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="border-slate-600 text-slate-300 disabled:opacity-50"
                  data-testid="first-page-btn"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="border-slate-600 text-slate-300 disabled:opacity-50"
                  data-testid="prev-page-btn"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                {getPaginationRange().map((page) => (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className={page === currentPage 
                      ? "bg-cyan-600 text-white" 
                      : "border-slate-600 text-slate-300"
                    }
                    data-testid={`page-${page}-btn`}
                  >
                    {page}
                  </Button>
                ))}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="border-slate-600 text-slate-300 disabled:opacity-50"
                  data-testid="next-page-btn"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="border-slate-600 text-slate-300 disabled:opacity-50"
                  data-testid="last-page-btn"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

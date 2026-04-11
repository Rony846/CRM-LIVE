import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { 
  Ticket, Phone, Clock, Wrench, AlertTriangle, CheckCircle, 
  Loader2, Eye, Play, Send, ArrowUpCircle, Camera, PhoneCall, FileText,
  Search, History, Shield, User, Package, List, ChevronLeft, ChevronRight
} from 'lucide-react';
import ClickToCallButton from '@/components/calls/ClickToCallButton';

const DEVICE_TYPES = ['Inverter', 'Battery', 'Stabilizer', 'Others'];

export default function CallSupportDashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [feedbackCalls, setFeedbackCalls] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState({ pending: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [feedbackCallOpen, setFeedbackCallOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('queue');
  const [feedbackFile, setFeedbackFile] = useState(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  
  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Customer history state
  const [customerHistory, setCustomerHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // All tickets state
  const [allTickets, setAllTickets] = useState([]);
  const [ticketFilter, setTicketFilter] = useState('all');
  
  // Pagination state for All Tickets
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);
  const [allTicketsLoading, setAllTicketsLoading] = useState(false);
  const ticketsPerPage = 100;

  // Action form state
  const [actionData, setActionData] = useState({
    status: '',
    diagnosis: '',
    issue_type: '',
    agent_notes: ''
  });

  // Create ticket form state
  const [newTicket, setNewTicket] = useState({
    device_type: '',
    order_id: '',
    issue_description: '',
    customer_id: ''
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [ticketsRes, feedbackRes] = await Promise.all([
        axios.get(`${API}/tickets`, { headers }),
        axios.get(`${API}/feedback-calls`, { headers }).catch(() => ({ data: { calls: [], stats: {} } }))
      ]);
      const ticketData = ticketsRes.data;
      setTickets(ticketData);
      setFeedbackCalls(feedbackRes.data.calls || []);
      setFeedbackStats(feedbackRes.data.stats || { pending: 0, completed: 0 });
      
      // Compute stats from tickets locally
      const openTickets = ticketData.filter(t => 
        t.status === 'open' || t.status === 'new_request' ||
        (t.support_type === 'phone' && t.status === 'call_support_followup')
      ).length;
      const inProgress = ticketData.filter(t => 
        t.status === 'in_progress' || t.status === 'call_support_followup'
      ).length;
      const diagnosedToday = ticketData.filter(t => t.status === 'diagnosed').length;
      const hardwareRouted = ticketData.filter(t => t.support_type === 'hardware').length;
      
      setStats({
        open_tickets: openTickets,
        in_progress: inProgress,
        diagnosed_today: diagnosedToday,
        hardware_routed: hardwareRouted,
        pending_feedback_calls: feedbackRes.data.stats?.pending || 0
      });
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch paginated all tickets
  const fetchAllTickets = async (page = 1, statusFilter = 'all') => {
    setAllTicketsLoading(true);
    try {
      // Fetch all tickets with high limit (API already gives call_support full access)
      let url = `${API}/tickets?limit=10000`;
      
      // Apply status filter server-side for single status
      if (statusFilter !== 'all' && statusFilter !== 'open') {
        url = `${API}/tickets?limit=10000&status=${statusFilter}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let ticketData = response.data;
      
      // Client-side filter for "open" which includes multiple statuses
      if (statusFilter === 'open') {
        ticketData = ticketData.filter(t => 
          ['new_request', 'open', 'call_support_followup'].includes(t.status)
        );
      }
      
      setTotalTickets(ticketData.length);
      
      // Apply client-side pagination
      const startIndex = (page - 1) * ticketsPerPage;
      const paginatedData = ticketData.slice(startIndex, startIndex + ticketsPerPage);
      setAllTickets(paginatedData);
    } catch (error) {
      toast.error('Failed to load tickets');
    } finally {
      setAllTicketsLoading(false);
    }
  };

  // Fetch all tickets when tab changes or filter changes
  useEffect(() => {
    if (activeTab === 'all-tickets') {
      fetchAllTickets(currentPage, ticketFilter);
    }
  }, [activeTab, currentPage, ticketFilter]);

  const viewTicketDetails = async (ticketId) => {
    try {
      const response = await axios.get(`${API}/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedTicket(response.data);
      setDetailsOpen(true);
    } catch (error) {
      toast.error('Failed to load ticket');
    }
  };

  const openActionDialog = (ticket) => {
    setSelectedTicket(ticket);
    setActionData({
      status: '',
      diagnosis: '',
      issue_type: '',
      agent_notes: ''
    });
    setActionOpen(true);
  };

  const handleUpdateTicket = async () => {
    if (!actionData.status && !actionData.diagnosis && !actionData.agent_notes) {
      toast.error('Please enter at least one update');
      return;
    }

    setActionLoading(true);
    try {
      const updates = {};
      if (actionData.status) updates.status = actionData.status;
      if (actionData.diagnosis) updates.diagnosis = actionData.diagnosis;
      if (actionData.issue_type) updates.issue_type = actionData.issue_type;
      if (actionData.agent_notes) updates.agent_notes = actionData.agent_notes;

      await axios.patch(`${API}/tickets/${selectedTicket.id}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Ticket updated successfully');
      setActionOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRouteToHardware = async () => {
    if (!actionData.agent_notes || actionData.agent_notes.length < 100) {
      toast.error('Notes must be at least 100 characters');
      return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('notes', actionData.agent_notes);

      await axios.post(`${API}/tickets/${selectedTicket.id}/route-to-hardware`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Ticket routed to hardware service');
      setActionOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to route ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalateToSupervisor = async () => {
    if (!actionData.agent_notes || actionData.agent_notes.length < 100) {
      toast.error('Notes must be at least 100 characters to escalate');
      return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('notes', actionData.agent_notes);

      await axios.post(`${API}/tickets/${selectedTicket.id}/escalate-to-supervisor`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Ticket escalated to supervisor');
      setActionOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to escalate ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicket.device_type || !newTicket.issue_description) {
      toast.error('Please fill in device type and issue description');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('device_type', newTicket.device_type);
      formData.append('issue_description', newTicket.issue_description);
      if (newTicket.order_id) formData.append('order_id', newTicket.order_id);
      if (newTicket.customer_id) formData.append('customer_id', newTicket.customer_id);
      
      await axios.post(`${API}/tickets`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Ticket created successfully');
      setCreateOpen(false);
      setNewTicket({ device_type: '', order_id: '', issue_description: '', customer_id: '' });
      fetchData();
    } catch (error) {
      console.error('Create ticket error:', error);
      toast.error('Failed to create ticket: ' + (error.response?.data?.detail || error.message));
    } finally {
      setActionLoading(false);
    }
  };

  const openTickets = tickets.filter(t => 
    t.status === 'open' || t.status === 'new_request' || 
    (t.support_type === 'phone' && t.status === 'call_support_followup')
  );
  const inProgressTickets = tickets.filter(t => 
    t.status === 'in_progress' || t.status === 'diagnosed' ||
    t.status === 'call_support_followup'
  );

  // Global search function
  const handleGlobalSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) {
      toast.error('Please enter a search term');
      return;
    }
    
    setSearchLoading(true);
    try {
      // Determine search type based on input
      const params = {};
      if (searchQuery.includes('@')) {
        params.email = searchQuery;
      } else if (/^\d{10,}$/.test(searchQuery.replace(/[^0-9]/g, ''))) {
        params.phone = searchQuery.replace(/[^0-9]/g, '');
      } else if (searchQuery.toUpperCase().startsWith('MG')) {
        params.serial_number = searchQuery;
      } else {
        params.order_id = searchQuery;
      }
      
      const response = await axios.get(`${API}/customers/search`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setSearchResults(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };
  
  // Fetch customer history for a ticket
  const fetchCustomerHistory = async (ticketId) => {
    setHistoryLoading(true);
    try {
      const response = await axios.get(`${API}/tickets/${ticketId}/customer-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomerHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch customer history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };
  
  // Enhanced view ticket that also fetches history
  const viewTicketWithHistory = async (ticketId) => {
    try {
      const response = await axios.get(`${API}/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedTicket(response.data);
      setDetailsOpen(true);
      // Also fetch customer history
      fetchCustomerHistory(ticketId);
    } catch (error) {
      toast.error('Failed to load ticket');
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Call Support Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Call Support Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6" data-testid="support-stats">
        <StatCard title="Open Tickets" value={stats?.open_tickets || 0} icon={Ticket} />
        <StatCard title="In Progress" value={stats?.in_progress || 0} icon={Clock} />
        <StatCard title="Diagnosed" value={stats?.diagnosed_today || 0} icon={CheckCircle} />
        <StatCard title="Hardware Routed" value={stats?.hardware_routed || 0} icon={Wrench} />
        <StatCard 
          title="Pending Feedback Calls" 
          value={stats?.pending_feedback_calls || 0} 
          icon={PhoneCall}
          className={stats?.pending_feedback_calls > 0 ? 'ring-2 ring-orange-400' : ''}
        />
      </div>

      {/* Tabs */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <TabsList className="flex-wrap">
                <TabsTrigger value="queue" data-testid="queue-tab">
                  <Phone className="w-4 h-4 mr-2" />
                  Ticket Queue ({openTickets.length})
                </TabsTrigger>
                <TabsTrigger value="working" data-testid="working-tab">
                  <Clock className="w-4 h-4 mr-2" />
                  Working ({inProgressTickets.length})
                </TabsTrigger>
                <TabsTrigger value="all-tickets" data-testid="all-tickets-tab">
                  <List className="w-4 h-4 mr-2" />
                  All Tickets
                </TabsTrigger>
                <TabsTrigger value="search" data-testid="search-tab">
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </TabsTrigger>
                <TabsTrigger 
                  value="feedback" 
                  data-testid="feedback-tab"
                  className={feedbackCalls.filter(c => c.status === 'pending').length > 0 ? 'text-orange-500' : ''}
                >
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Feedback Calls ({feedbackCalls.filter(c => c.status === 'pending').length})
                </TabsTrigger>
              </TabsList>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setCreateOpen(true)}
                data-testid="create-ticket-btn"
              >
                <Phone className="w-4 h-4 mr-2" />
                New Ticket
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <TabsContent value="queue" className="mt-0">
              {openTickets.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>All tickets handled! Queue is empty.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="data-row">
                        <TableCell className="font-mono text-sm font-medium">
                          {ticket.ticket_number}
                        </TableCell>
                        <TableCell>{ticket.customer_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{ticket.customer_phone}</span>
                            {ticket.customer_phone && (
                              <ClickToCallButton 
                                phone={ticket.customer_phone}
                                customerName={ticket.customer_name}
                                showLabel={false}
                                size="sm"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{ticket.device_type}</TableCell>
                        <TableCell className="max-w-xs truncate">{ticket.issue_description}</TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {new Date(ticket.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => viewTicketDetails(ticket.id)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              className="bg-blue-600 hover:bg-blue-700"
                              onClick={() => openActionDialog(ticket)}
                              data-testid={`work-ticket-${ticket.id}`}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Work
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="working" className="mt-0">
              {inProgressTickets.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p>No tickets in progress</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Diagnosis</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inProgressTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="data-row">
                        <TableCell className="font-mono text-sm font-medium">
                          {ticket.ticket_number}
                        </TableCell>
                        <TableCell>{ticket.customer_name}</TableCell>
                        <TableCell>{ticket.device_type}</TableCell>
                        <TableCell><StatusBadge status={ticket.status} /></TableCell>
                        <TableCell className="max-w-xs truncate">{ticket.diagnosis || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openActionDialog(ticket)}
                          >
                            Update
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* All Tickets Tab */}
            <TabsContent value="all-tickets" className="mt-0">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-1 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  All Tickets View
                </h4>
                <p className="text-sm text-blue-700">
                  View all tickets across all departments. Click on any ticket to see customer history and details.
                </p>
              </div>
              
              <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
                <div className="flex gap-4 items-center">
                  <Select value={ticketFilter} onValueChange={(v) => { setTicketFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="hardware_service">Hardware Service</SelectItem>
                      <SelectItem value="repair_completed">Repair Completed</SelectItem>
                      <SelectItem value="received_at_factory">At Factory</SelectItem>
                      <SelectItem value="in_repair">In Repair</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className="bg-white">
                    {totalTickets} total tickets
                  </Badge>
                </div>
                
                {/* Pagination Controls */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">
                    Page {currentPage} of {Math.max(1, Math.ceil(totalTickets / ticketsPerPage))}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || allTicketsLoading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage >= Math.ceil(totalTickets / ticketsPerPage) || allTicketsLoading}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {allTicketsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="data-row">
                        <TableCell className="font-mono text-sm font-medium">
                          {ticket.ticket_number}
                        </TableCell>
                        <TableCell>{ticket.customer_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{ticket.customer_phone}</span>
                            {ticket.customer_phone && (
                              <ClickToCallButton 
                                phone={ticket.customer_phone}
                                customerName={ticket.customer_name}
                                showLabel={false}
                                size="sm"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{ticket.device_type}</TableCell>
                        <TableCell><StatusBadge status={ticket.status} /></TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => viewTicketWithHistory(ticket.id)}
                              data-testid={`view-ticket-${ticket.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedTicket(ticket);
                                fetchCustomerHistory(ticket.id);
                                setDetailsOpen(true);
                              }}
                              data-testid={`history-ticket-${ticket.id}`}
                            >
                              <History className="w-4 h-4 mr-1" />
                              History
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              
              {/* Bottom Pagination */}
              {allTickets.length > 0 && (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <span className="text-sm text-slate-600">
                    Showing {Math.min(ticketsPerPage, allTickets.length)} of {totalTickets} tickets
                  </span>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || allTicketsLoading}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm px-3">
                      Page {currentPage}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={currentPage >= Math.ceil(totalTickets / ticketsPerPage) || allTicketsLoading}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Global Search Tab */}
            <TabsContent value="search" className="mt-0">
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-1 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Customer Search
                </h4>
                <p className="text-sm text-green-700">
                  Search for any customer by phone number, email, serial number, or order ID to find their complete history.
                </p>
              </div>

              <form onSubmit={handleGlobalSearch} className="mb-6">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Enter phone number, email, serial number (MG...), or order ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="global-search-input"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="bg-green-600 hover:bg-green-700"
                    disabled={searchLoading}
                    data-testid="global-search-btn"
                  >
                    {searchLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Search
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Tip: Enter phone (10 digits), email, serial number starting with MG, or order ID
                </p>
              </form>

              {searchResults && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-blue-700">{searchResults.total_tickets || 0}</p>
                        <p className="text-sm text-blue-600">Tickets Found</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-green-700">{searchResults.total_warranties || 0}</p>
                        <p className="text-sm text-green-600">Warranties</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50 border-purple-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-purple-700">{searchResults.total_dispatches || 0}</p>
                        <p className="text-sm text-purple-600">Dispatches</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tickets Results */}
                  {searchResults.tickets?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Ticket className="w-4 h-4" />
                        Tickets ({searchResults.tickets.length})
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ticket #</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Device</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchResults.tickets.map((ticket) => (
                            <TableRow key={ticket.id} className="data-row">
                              <TableCell className="font-mono text-sm font-medium">
                                {ticket.ticket_number}
                              </TableCell>
                              <TableCell>{ticket.customer_name}</TableCell>
                              <TableCell className="font-mono text-sm">{ticket.customer_phone}</TableCell>
                              <TableCell>{ticket.device_type}</TableCell>
                              <TableCell><StatusBadge status={ticket.status} /></TableCell>
                              <TableCell className="text-slate-500 text-sm">
                                {new Date(ticket.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => viewTicketWithHistory(ticket.id)}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Warranties Results */}
                  {searchResults.warranties?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Warranties ({searchResults.warranties.length})
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Warranty #</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Device</TableHead>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Expires</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchResults.warranties.map((warranty) => (
                            <TableRow key={warranty.id} className="data-row">
                              <TableCell className="font-mono text-sm font-medium">
                                {warranty.warranty_number}
                              </TableCell>
                              <TableCell>{warranty.customer_name}</TableCell>
                              <TableCell>{warranty.device_type}</TableCell>
                              <TableCell>{warranty.order_id || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={warranty.status === 'approved' ? 'default' : 'secondary'}>
                                  {warranty.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-slate-500 text-sm">
                                {warranty.warranty_end_date ? new Date(warranty.warranty_end_date).toLocaleDateString() : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Dispatches Results */}
                  {searchResults.dispatches?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Dispatches ({searchResults.dispatches.length})
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Dispatch #</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Tracking ID</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchResults.dispatches.map((dispatch) => (
                            <TableRow key={dispatch.id} className="data-row">
                              <TableCell className="font-mono text-sm font-medium">
                                {dispatch.dispatch_number}
                              </TableCell>
                              <TableCell>{dispatch.product_name || '-'}</TableCell>
                              <TableCell><StatusBadge status={dispatch.status} /></TableCell>
                              <TableCell className="font-mono text-sm">{dispatch.tracking_id || '-'}</TableCell>
                              <TableCell className="text-slate-500 text-sm">
                                {new Date(dispatch.created_at).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* No Results */}
                  {searchResults.total_tickets === 0 && searchResults.total_warranties === 0 && searchResults.total_dispatches === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <Search className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>No results found for "{searchQuery}"</p>
                      <p className="text-sm mt-2">Try searching with a different term</p>
                    </div>
                  )}
                </div>
              )}

              {!searchResults && (
                <div className="text-center py-12 text-slate-500">
                  <User className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Enter a search term to find customer records</p>
                </div>
              )}
            </TabsContent>

            {/* Feedback Calls Tab */}
            <TabsContent value="feedback" className="mt-0">
              <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h4 className="font-medium text-orange-800 mb-1">Amazon Order Feedback Calls</h4>
                <p className="text-sm text-orange-700">
                  These customers received Amazon orders. Call them to collect feedback and upload a screenshot of the completed call.
                </p>
              </div>
              
              {feedbackCalls.filter(c => c.status === 'pending').length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>No pending feedback calls!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedbackCalls.filter(c => c.status === 'pending').map((call) => (
                      <TableRow key={call.id} className="data-row">
                        <TableCell className="font-mono text-sm font-medium">
                          {call.order_id || call.dispatch_number}
                        </TableCell>
                        <TableCell>{call.customer_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{call.phone}</span>
                            {call.phone && (
                              <ClickToCallButton 
                                phone={call.phone}
                                customerName={call.customer_name}
                                showLabel={false}
                                size="sm"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{call.sku || '-'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            call.call_attempts > 2 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {call.call_attempts} attempts
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {new Date(call.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            className="bg-orange-600 hover:bg-orange-700"
                            onClick={() => {
                              setSelectedCall(call);
                              setFeedbackFile(null);
                              setFeedbackNotes('');
                              setFeedbackCallOpen(true);
                            }}
                            data-testid={`feedback-call-${call.id}`}
                          >
                            <PhoneCall className="w-4 h-4 mr-1" />
                            Complete Call
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Ticket Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={(open) => {
        setDetailsOpen(open);
        if (!open) setCustomerHistory(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Ticket Details - {selectedTicket?.ticket_number}
              {customerHistory && (
                <Badge variant="outline" className="ml-2">
                  {customerHistory.total_tickets} total tickets
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Ticket Info - 2 columns */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-slate-500">Status</p><StatusBadge status={selectedTicket.status} /></div>
                  <div><p className="text-sm text-slate-500">Device</p><p className="font-medium">{selectedTicket.device_type}</p></div>
                  <div><p className="text-sm text-slate-500">Customer</p><p className="font-medium">{selectedTicket.customer_name}</p></div>
                  <div><p className="text-sm text-slate-500">Phone</p><p className="font-mono">{selectedTicket.customer_phone}</p></div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Issue</p>
                  <div className="bg-slate-50 p-3 rounded-lg">{selectedTicket.issue_description}</div>
                </div>
                {selectedTicket.diagnosis && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Diagnosis</p>
                    <div className="bg-blue-50 p-3 rounded-lg">{selectedTicket.diagnosis}</div>
                  </div>
                )}
                {selectedTicket.invoice_file && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Customer Invoice</p>
                    <a 
                      href={`${API.replace('/api', '')}${selectedTicket.invoice_file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 bg-blue-50 p-3 rounded-lg"
                    >
                      <FileText className="w-4 h-4" />
                      View Invoice Document
                    </a>
                  </div>
                )}
                <div>
                  <p className="text-sm text-slate-500 mb-2">Ticket History</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedTicket.history?.map((entry, i) => (
                      <div key={i} className="flex gap-2 text-sm">
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                        <div>
                          <p>{entry.action}</p>
                          <p className="text-xs text-slate-500">{entry.by} • {new Date(entry.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Customer History Panel - 1 column */}
              <div className="lg:col-span-1 border-l pl-4">
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-4 h-4 text-purple-600" />
                  <h4 className="font-medium text-purple-800">Customer History</h4>
                </div>
                
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  </div>
                ) : customerHistory ? (
                  <div className="space-y-4">
                    {/* Customer Info */}
                    <div className="bg-purple-50 p-3 rounded-lg text-sm">
                      <p className="font-medium">{customerHistory.customer_name}</p>
                      <p className="text-slate-600">{customerHistory.customer_phone}</p>
                      {customerHistory.customer_email && (
                        <p className="text-slate-600">{customerHistory.customer_email}</p>
                      )}
                    </div>

                    {/* Related Tickets */}
                    {customerHistory.related_tickets?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-1">
                          <Ticket className="w-3 h-3" />
                          Previous Tickets ({customerHistory.related_tickets.length})
                        </p>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {customerHistory.related_tickets.map((ticket) => (
                            <div key={ticket.id} className="bg-slate-50 p-2 rounded text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-medium">{ticket.ticket_number}</span>
                                <StatusBadge status={ticket.status} />
                              </div>
                              <p className="text-slate-500 mt-1 truncate">{ticket.issue_description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warranties */}
                    {customerHistory.warranties?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          Warranties ({customerHistory.warranties.length})
                        </p>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {customerHistory.warranties.map((warranty) => (
                            <div key={warranty.id} className="bg-green-50 p-2 rounded text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-mono">{warranty.warranty_number}</span>
                                <Badge variant={warranty.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                                  {warranty.status}
                                </Badge>
                              </div>
                              <p className="text-slate-600">{warranty.device_type}</p>
                              {warranty.warranty_end_date && (
                                <p className="text-slate-500">Expires: {new Date(warranty.warranty_end_date).toLocaleDateString()}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dispatches */}
                    {customerHistory.dispatches?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          Dispatches ({customerHistory.dispatches.length})
                        </p>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {customerHistory.dispatches.map((dispatch) => (
                            <div key={dispatch.id} className="bg-orange-50 p-2 rounded text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-mono">{dispatch.dispatch_number}</span>
                                <StatusBadge status={dispatch.status} />
                              </div>
                              {dispatch.product_name && (
                                <p className="text-slate-600">{dispatch.product_name}</p>
                              )}
                              {dispatch.tracking_id && (
                                <p className="text-slate-500">Tracking: {dispatch.tracking_id}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No History */}
                    {customerHistory.related_tickets?.length === 0 && 
                     customerHistory.warranties?.length === 0 && 
                     customerHistory.dispatches?.length === 0 && (
                      <div className="text-center py-4 text-slate-500 text-sm">
                        <p>No previous history found</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-500 text-sm">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fetchCustomerHistory(selectedTicket.id)}
                    >
                      <History className="w-4 h-4 mr-1" />
                      Load History
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Ticket - {selectedTicket?.ticket_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm text-slate-500">Customer: {selectedTicket?.customer_name}</p>
              <p className="text-sm mt-1">{selectedTicket?.issue_description}</p>
            </div>

            <div className="space-y-2">
              <Label>Update Status</Label>
              <Select value={actionData.status} onValueChange={(v) => setActionData({...actionData, status: v})}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="diagnosed">Diagnosed</SelectItem>
                  <SelectItem value="software_issue">Software Issue (Resolved)</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <Textarea 
                placeholder="Enter diagnosis details..."
                value={actionData.diagnosis}
                onChange={(e) => setActionData({...actionData, diagnosis: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Agent Notes (min 100 chars for escalation/routing)</Label>
              <Textarea 
                placeholder="Notes for internal reference or for accountant if routing to hardware..."
                value={actionData.agent_notes}
                onChange={(e) => setActionData({...actionData, agent_notes: e.target.value})}
              />
              <p className={`text-xs ${actionData.agent_notes.length < 100 ? 'text-slate-500' : 'text-green-600'}`}>
                {actionData.agent_notes.length}/100 characters
              </p>
            </div>

            {/* Escalate to Supervisor */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-purple-600 mb-3">
                <ArrowUpCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Need Supervisor Help?</span>
              </div>
              <Button 
                variant="outline" 
                className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={handleEscalateToSupervisor}
                disabled={actionLoading || actionData.agent_notes.length < 100}
                data-testid="escalate-supervisor-btn"
              >
                <ArrowUpCircle className="w-4 h-4 mr-2" />
                Escalate to Supervisor
              </Button>
              <p className="text-xs text-slate-500 mt-2">Add detailed notes (100+ chars) before escalating</p>
            </div>

            {/* Route to Hardware */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-orange-600 mb-3">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Hardware Issue?</span>
              </div>
              <Button 
                variant="outline" 
                className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                onClick={handleRouteToHardware}
                disabled={actionLoading || actionData.agent_notes.length < 100}
                data-testid="route-hardware-btn"
              >
                <Wrench className="w-4 h-4 mr-2" />
                Route to Hardware Service
              </Button>
              <p className="text-xs text-slate-500 mt-2">Add notes (100+ chars) before routing to hardware</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700" 
              onClick={handleUpdateTicket}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Ticket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="space-y-2">
              <Label>Device Type *</Label>
              <Select value={newTicket.device_type} onValueChange={(v) => setNewTicket({...newTicket, device_type: v})}>
                <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Order ID</Label>
              <Input 
                placeholder="e.g., AMZ-123456"
                value={newTicket.order_id}
                onChange={(e) => setNewTicket({...newTicket, order_id: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Issue Description *</Label>
              <Textarea 
                placeholder="Describe the customer's issue..."
                value={newTicket.issue_description}
                onChange={(e) => setNewTicket({...newTicket, issue_description: e.target.value})}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Create Ticket
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Feedback Call Dialog */}
      <Dialog open={feedbackCallOpen} onOpenChange={setFeedbackCallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Feedback Call</DialogTitle>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Customer:</strong> {selectedCall.customer_name}</p>
                  <p><strong>Phone:</strong> <span className="font-mono">{selectedCall.phone}</span></p>
                  <p><strong>Order:</strong> {selectedCall.order_id || selectedCall.dispatch_number}</p>
                  <p><strong>Product:</strong> {selectedCall.sku || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Call Notes</Label>
                <Textarea
                  placeholder="Notes from the feedback call..."
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Feedback Screenshot *</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFeedbackFile(e.target.files[0])}
                  data-testid="feedback-screenshot-input"
                />
                <p className="text-xs text-slate-500">Upload a screenshot of the customer feedback or completed call</p>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      const formData = new FormData();
                      formData.append('status', 'no_answer');
                      formData.append('notes', feedbackNotes || 'Customer did not answer');
                      await axios.patch(`${API}/feedback-calls/${selectedCall.id}`, formData, {
                        headers: { 
                          Authorization: `Bearer ${token}`,
                          'Content-Type': 'multipart/form-data'
                        }
                      });
                      toast.info('Marked as no answer - will retry later');
                      setFeedbackCallOpen(false);
                      fetchData();
                    } catch (error) {
                      toast.error('Failed to update');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                >
                  No Answer
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={async () => {
                    if (!feedbackFile) {
                      toast.error('Please upload a feedback screenshot');
                      return;
                    }
                    setActionLoading(true);
                    try {
                      const formData = new FormData();
                      formData.append('status', 'completed');
                      formData.append('notes', feedbackNotes);
                      formData.append('screenshot', feedbackFile);
                      await axios.patch(`${API}/feedback-calls/${selectedCall.id}`, formData, {
                        headers: { 
                          Authorization: `Bearer ${token}`,
                          'Content-Type': 'multipart/form-data'
                        }
                      });
                      toast.success('Feedback call completed!');
                      setFeedbackCallOpen(false);
                      fetchData();
                    } catch (error) {
                      toast.error(error.response?.data?.detail || 'Failed to complete');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading || !feedbackFile}
                  data-testid="complete-feedback-call"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
                  Complete with Screenshot
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

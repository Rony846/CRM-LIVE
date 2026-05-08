import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Loader2, Search, RefreshCw, Activity, Filter, Clock, User,
  Package, Ticket, FileText, Truck, Factory, DollarSign, ScanLine,
  Bell, Settings, ChevronDown, ChevronUp
} from 'lucide-react';

const ACTION_ICONS = {
  // Tickets
  ticket_created: Ticket,
  ticket_updated: Ticket,
  ticket_escalated: Ticket,
  ticket_closed: Ticket,
  
  // Dispatch
  dispatch_created: Truck,
  dispatch_stock_deducted: Truck,
  dispatch_status_updated: Truck,
  pending_fulfillment_dispatched: Truck,
  
  // Production
  production_request_created: Factory,
  production_request_accepted: Factory,
  production_request_started: Factory,
  production_request_completed: Factory,
  production_received_into_inventory: Factory,
  production_request_cancelled: Factory,
  
  // Inventory
  inventory_ledger_entry: Package,
  stock_transfer: Package,
  stock_adjustment: Package,
  incoming_queue_classified: Package,
  
  // Payments
  supervisor_payment_recorded: DollarSign,
  
  // Gate
  gate_scan_inward: ScanLine,
  gate_scan_outward: ScanLine,
  
  // Notifications
  notification_created: Bell,
  
  // Default
  default: Activity
};

const ACTION_COLORS = {
  // Created actions - green
  ticket_created: 'bg-green-600',
  dispatch_created: 'bg-green-600',
  production_request_created: 'bg-green-600',
  
  // Updated actions - blue
  ticket_updated: 'bg-blue-600',
  dispatch_status_updated: 'bg-blue-600',
  production_request_accepted: 'bg-blue-600',
  production_request_started: 'bg-blue-600',
  
  // Completed actions - emerald
  ticket_closed: 'bg-emerald-600',
  production_request_completed: 'bg-emerald-600',
  production_received_into_inventory: 'bg-emerald-600',
  pending_fulfillment_dispatched: 'bg-emerald-600',
  
  // Financial actions - yellow
  dispatch_stock_deducted: 'bg-yellow-600',
  supervisor_payment_recorded: 'bg-yellow-600',
  stock_transfer: 'bg-yellow-600',
  
  // Gate actions - purple
  gate_scan_inward: 'bg-purple-600',
  gate_scan_outward: 'bg-purple-600',
  
  // Cancelled/Error actions - red
  production_request_cancelled: 'bg-red-600',
  
  // Default
  default: 'bg-slate-600'
};

export default function AdminActivityLogs() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    actionType: 'all',
    userId: 'all',
    entityType: 'all',
    search: '',
    dateFrom: '',
    dateTo: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    actionTypes: [],
    entityTypes: [],
    performers: []
  });
  const [expandedLogs, setExpandedLogs] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [token]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.actionType !== 'all') params.action_type = filters.actionType;
      if (filters.userId !== 'all') params.user_id = filters.userId;
      if (filters.entityType !== 'all') params.entity_type = filters.entityType;
      if (filters.search) params.search = filters.search;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;
      
      const response = await axios.get(`${API}/admin/activity-logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      setLogs(response.data.logs || []);
      setFilterOptions({
        actionTypes: response.data.action_types || [],
        entityTypes: response.data.entity_types || [],
        performers: response.data.performers || []
      });
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (logId) => {
    setExpandedLogs(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatAction = (action) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getActionIcon = (action) => {
    const IconComponent = ACTION_ICONS[action] || ACTION_ICONS.default;
    return IconComponent;
  };

  const getActionColor = (action) => {
    return ACTION_COLORS[action] || ACTION_COLORS.default;
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const clearFilters = () => {
    setFilters({
      actionType: 'all',
      userId: 'all',
      entityType: 'all',
      search: '',
      dateFrom: '',
      dateTo: ''
    });
    setTimeout(fetchLogs, 100);
  };

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    
    return {
      total: logs.length,
      today: logs.filter(l => new Date(l.timestamp) >= today).length,
      thisWeek: logs.filter(l => new Date(l.timestamp) >= thisWeek).length,
      uniqueUsers: new Set(logs.map(l => l.performed_by)).size
    };
  }, [logs]);

  if (loading && logs.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Activity Logs</h1>
            <p className="text-slate-400">Comprehensive audit trail of all organization actions</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="text-slate-300 border-slate-600"
            >
              <Filter className="w-4 h-4 mr-2" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
            <Button
              variant="outline"
              onClick={fetchLogs}
              className="text-slate-300 border-slate-600"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Activity className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Logs</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Clock className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Today</p>
                  <p className="text-2xl font-bold text-white">{stats.today}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <FileText className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">This Week</p>
                  <p className="text-2xl font-bold text-white">{stats.thisWeek}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-cyan-500/20 rounded-lg">
                  <User className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Active Users</p>
                  <p className="text-2xl font-bold text-white">{stats.uniqueUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <Label className="text-slate-300 text-xs">Search</Label>
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Search logs..."
                        value={filters.search}
                        onChange={(e) => setFilters({...filters, search: e.target.value})}
                        className="pl-10 bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs">Action Type</Label>
                    <Select
                      value={filters.actionType}
                      onValueChange={(v) => setFilters({...filters, actionType: v})}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue placeholder="All Actions" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                        <SelectItem value="all" className="text-white">All Actions</SelectItem>
                        {filterOptions.actionTypes.map(a => (
                          <SelectItem key={a} value={a} className="text-white">
                            {formatAction(a)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs">Entity Type</Label>
                    <Select
                      value={filters.entityType}
                      onValueChange={(v) => setFilters({...filters, entityType: v})}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue placeholder="All Entities" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="all" className="text-white">All Entities</SelectItem>
                        {filterOptions.entityTypes.map(e => (
                          <SelectItem key={e} value={e} className="text-white">
                            {e.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs">Performed By</Label>
                    <Select
                      value={filters.userId}
                      onValueChange={(v) => setFilters({...filters, userId: v})}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue placeholder="All Users" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="all" className="text-white">All Users</SelectItem>
                        {filterOptions.performers.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-white">
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs">Date From</Label>
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs">Date To</Label>
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={clearFilters} className="text-slate-400">
                    Clear Filters
                  </Button>
                  <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">
                    Apply Filters
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Logs Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Recent Activity
              <span className="ml-auto text-sm font-normal text-slate-400">
                {logs.length} records
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-300 w-12"></TableHead>
                    <TableHead className="text-slate-300">Action</TableHead>
                    <TableHead className="text-slate-300">Entity</TableHead>
                    <TableHead className="text-slate-300">Performed By</TableHead>
                    <TableHead className="text-slate-300">Timestamp</TableHead>
                    <TableHead className="text-slate-300 w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const ActionIcon = getActionIcon(log.action);
                    const isExpanded = expandedLogs[log.id];
                    
                    return (
                      <React.Fragment key={log.id}>
                        <TableRow className="border-slate-700 hover:bg-slate-700/50">
                          <TableCell>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getActionColor(log.action)}`}>
                              <ActionIcon className="w-4 h-4 text-white" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getActionColor(log.action)} text-white`}>
                              {formatAction(log.action)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-white font-medium text-sm">
                                {log.entity_name || log.entity_id || '-'}
                              </p>
                              <p className="text-xs text-slate-400">
                                {log.entity_type?.replace(/_/g, ' ')}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-white text-sm">{log.performed_by_name || 'System'}</p>
                              <p className="text-xs text-slate-400">{log.performed_by_role || ''}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-300 text-sm">
                            {formatDate(log.timestamp)}
                          </TableCell>
                          <TableCell>
                            {log.details && Object.keys(log.details).length > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleExpanded(log.id)}
                                className="text-slate-400"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && log.details && (
                          <TableRow className="border-slate-700 bg-slate-900/50">
                            <TableCell colSpan={6}>
                              <div className="p-4">
                                <p className="text-xs text-slate-400 mb-2">Details:</p>
                                <pre className="text-xs text-slate-300 bg-slate-800 p-3 rounded overflow-x-auto">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                        <Activity className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                        <p>No activity logs found</p>
                        <p className="text-sm text-slate-500 mt-2">
                          Activity will appear here as users perform actions
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

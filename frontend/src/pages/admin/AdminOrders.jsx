import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Package, Loader2, Eye, Search, Calendar, Phone, MapPin,
  FileText, Trash2, Edit, ShoppingCart, Truck, Wrench, UserPlus
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [repairDispatches, setRepairDispatches] = useState([]);
  const [walkinDispatches, setWalkinDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('new_orders');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: '',
    phone: '',
    address: '',
    reason: '',
    order_id: '',
    payment_reference: '',
    status: ''
  });

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const fetchOrders = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch all dispatch types
      const [newOrdersRes, allDispatchesRes, repairTicketsRes] = await Promise.all([
        axios.get(`${API}/dispatches?dispatch_type=new_order`, { headers }),
        axios.get(`${API}/dispatches`, { headers }),
        axios.get(`${API}/admin/all-repairs`, { headers }).catch(() => ({ data: { tickets: [] } }))
      ]);
      
      setOrders(newOrdersRes.data);
      
      // Filter repair-related dispatches (return_dispatch, walkin_return)
      const repairs = allDispatchesRes.data.filter(d => 
        d.dispatch_type === 'return_dispatch' || d.dispatch_type === 'walkin_return'
      );
      
      // Also include tickets that are ready for dispatch or dispatched
      const repairTickets = repairTicketsRes.data.tickets?.filter(t => 
        t.status === 'ready_for_dispatch' || t.status === 'dispatched'
      ) || [];
      
      // Combine and dedupe by ID
      const allRepairs = [...repairs];
      repairTickets.forEach(ticket => {
        if (!allRepairs.some(r => r.id === ticket.id)) {
          allRepairs.push({
            id: ticket.id,
            dispatch_number: ticket.ticket_number,
            dispatch_type: ticket.is_walkin ? 'walkin_return' : 'return_dispatch',
            customer_name: ticket.customer_name,
            phone: ticket.customer_phone,
            address: ticket.address,
            city: ticket.city,
            status: ticket.status,
            is_walkin: ticket.is_walkin,
            board_serial_number: ticket.board_serial_number,
            device_serial_number: ticket.device_serial_number,
            repair_notes: ticket.repair_notes,
            courier: ticket.return_courier,
            tracking_id: ticket.return_tracking,
            created_at: ticket.created_at,
            updated_at: ticket.updated_at
          });
        }
      });
      
      // Separate walk-ins and regular repairs
      setRepairDispatches(allRepairs.filter(r => !r.is_walkin));
      setWalkinDispatches(allRepairs.filter(r => r.is_walkin));
      
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const openViewDialog = (order) => {
    setSelectedOrder(order);
    setViewOpen(true);
  };

  const openEditDialog = (order) => {
    setSelectedOrder(order);
    setEditForm({
      customer_name: order.customer_name || '',
      phone: order.phone || '',
      address: order.address || '',
      reason: order.reason || '',
      order_id: order.order_id || '',
      payment_reference: order.payment_reference || '',
      status: order.status || 'pending'
    });
    setEditOpen(true);
  };

  const openDeleteDialog = (order) => {
    setSelectedOrder(order);
    setDeleteOpen(true);
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;
    setActionLoading(true);
    try {
      await axios.patch(`${API}/admin/dispatches/${selectedOrder.id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Order updated successfully');
      setEditOpen(false);
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    setActionLoading(true);
    try {
      await axios.delete(`${API}/admin/dispatches/${selectedOrder.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Order deleted successfully');
      setDeleteOpen(false);
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete order');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter orders based on current tab
  const getCurrentItems = () => {
    switch(activeTab) {
      case 'new_orders': return orders;
      case 'repairs': return repairDispatches;
      case 'walkins': return walkinDispatches;
      default: return orders;
    }
  };

  const currentItems = getCurrentItems();
  
  const filteredOrders = currentItems.filter(order => {
    const matchesSearch = !search || 
      order.dispatch_number?.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      order.phone?.includes(search) ||
      order.order_id?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: orders.length + repairDispatches.length + walkinDispatches.length,
    new_orders: orders.length,
    repairs: repairDispatches.length,
    walkins: walkinDispatches.length,
    pending: [...orders, ...repairDispatches, ...walkinDispatches].filter(o => 
      o.status === 'pending' || o.status === 'ready_for_dispatch'
    ).length,
    shipped: [...orders, ...repairDispatches, ...walkinDispatches].filter(o => 
      o.status === 'shipped' || o.status === 'dispatched'
    ).length
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Orders & Dispatches</h1>
            <p className="text-slate-400">View and manage all orders, repairs, and walk-in dispatches</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                  <p className="text-sm text-slate-400">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-600/20 rounded-lg">
                  <Package className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.new_orders}</p>
                  <p className="text-sm text-slate-400">New Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-600/20 rounded-lg">
                  <Wrench className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.repairs}</p>
                  <p className="text-sm text-slate-400">Repairs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600/20 rounded-lg">
                  <UserPlus className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.walkins}</p>
                  <p className="text-sm text-slate-400">Walk-ins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-600/20 rounded-lg">
                  <Truck className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.shipped}</p>
                  <p className="text-sm text-slate-400">Shipped</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different order types */}
        <Card className="bg-slate-800 border-slate-700">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <TabsList className="bg-slate-700">
                  <TabsTrigger value="new_orders" data-testid="new-orders-tab">
                    <Package className="w-4 h-4 mr-2" />
                    New Orders ({orders.length})
                  </TabsTrigger>
                  <TabsTrigger value="repairs" data-testid="repairs-tab">
                    <Wrench className="w-4 h-4 mr-2" />
                    Repairs ({repairDispatches.length})
                  </TabsTrigger>
                  <TabsTrigger value="walkins" data-testid="walkins-tab">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Walk-ins ({walkinDispatches.length})
                  </TabsTrigger>
                </TabsList>
                
                {/* Search */}
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 bg-slate-900 border-slate-600"
                  />
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-4">
              {/* Shared Table Content */}
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Package className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                  <p>No {activeTab.replace('_', ' ')} found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">ID</TableHead>
                      <TableHead className="text-slate-400">Customer</TableHead>
                      <TableHead className="text-slate-400">
                        {activeTab === 'new_orders' ? 'Product/SKU' : 'Serial Numbers'}
                      </TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Courier</TableHead>
                      <TableHead className="text-slate-400">Date</TableHead>
                      <TableHead className="text-slate-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} className="border-slate-700 hover:bg-slate-700/30">
                        <TableCell>
                          <span className="font-mono text-cyan-400">{order.dispatch_number}</span>
                          {order.order_id && (
                            <p className="text-xs text-slate-500">{order.order_id}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-white">{order.customer_name}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {order.phone}
                          </p>
                        </TableCell>
                        <TableCell>
                          {activeTab === 'new_orders' ? (
                            <span className="text-white">{order.sku || order.reason || '-'}</span>
                          ) : (
                            <div className="text-sm">
                              {order.board_serial_number && (
                                <p className="text-slate-300">Board: {order.board_serial_number}</p>
                              )}
                              {order.device_serial_number && (
                                <p className="text-slate-300">Device: {order.device_serial_number}</p>
                              )}
                              {!order.board_serial_number && !order.device_serial_number && (
                                <span className="text-slate-500">-</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell>
                          {order.courier ? (
                            <div className="text-sm">
                              <p className="text-white">{order.courier}</p>
                              <p className="text-xs text-slate-500 font-mono">{order.tracking_id}</p>
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {new Date(order.created_at).toLocaleDateString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-slate-600"
                              onClick={() => openViewDialog(order)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {activeTab === 'new_orders' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-600"
                                  onClick={() => openEditDialog(order)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-600 text-red-400"
                                  onClick={() => openDeleteDialog(order)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Tabs>
        </Card>
      </div>


      {/* View Order Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Order Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Order Number</span>
                  <span className="font-mono font-medium">{selectedOrder.dispatch_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <StatusBadge status={selectedOrder.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Created</span>
                  <span>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : '-'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Customer
                </h4>
                <div className="bg-slate-50 p-3 rounded-lg text-sm">
                  <p><strong>Name:</strong> {selectedOrder.customer_name || '-'}</p>
                  <p><strong>Phone:</strong> {selectedOrder.phone || '-'}</p>
                  <p><strong>Address:</strong> {selectedOrder.address || '-'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Order Info
                </h4>
                <div className="bg-slate-50 p-3 rounded-lg text-sm">
                  <p><strong>SKU:</strong> {selectedOrder.sku || '-'}</p>
                  <p><strong>Order ID:</strong> {selectedOrder.order_id || '-'}</p>
                  <p><strong>Payment Ref:</strong> {selectedOrder.payment_reference || '-'}</p>
                  <p><strong>Reason:</strong> {selectedOrder.reason || '-'}</p>
                </div>
              </div>

              {(selectedOrder.courier || selectedOrder.tracking_id) && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Shipping
                  </h4>
                  <div className="bg-slate-50 p-3 rounded-lg text-sm">
                    <p><strong>Courier:</strong> {selectedOrder.courier || '-'}</p>
                    <p><strong>Tracking ID:</strong> {selectedOrder.tracking_id || '-'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-yellow-600" />
              Edit Order
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={editForm.customer_name}
                  onChange={(e) => setEditForm({...editForm, customer_name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm({...editForm, address: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Order ID</Label>
                <Input
                  value={editForm.order_id}
                  onChange={(e) => setEditForm({...editForm, order_id: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Reference</Label>
                <Input
                  value={editForm.payment_reference}
                  onChange={(e) => setEditForm({...editForm, payment_reference: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({...editForm, status: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="label_uploaded">Label Uploaded</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason/Notes</Label>
              <Input
                value={editForm.reason}
                onChange={(e) => setEditForm({...editForm, reason: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateOrder} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Order
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-slate-600">
              Are you sure you want to delete order <strong>{selectedOrder?.dispatch_number}</strong>?
            </p>
            <p className="text-sm text-slate-500 mt-2">This action cannot be undone.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteOrder} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

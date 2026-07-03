import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Package, Loader2, Eye, Search, Phone,
  FileText, Trash2, Edit, ShoppingCart, Truck, Wrench, UserPlus
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

// Order/dispatch status -> label + Iron pill tone.
const orderStatusPill = (status) => {
  const map = {
    pending: ['Pending', 'warn'], label_uploaded: ['Label Uploaded', 'info'],
    shipped: ['Shipped', 'ok'], dispatched: ['Dispatched', 'ok'],
    delivered: ['Delivered', 'ok'], cancelled: ['Cancelled', 'bad'],
    ready_for_dispatch: ['Ready for Dispatch', 'info'], awaiting_label: ['Awaiting Label', 'warn'],
    in_repair: ['In Repair', 'slate'], repair_completed: ['Repair Completed', 'ok'],
    received_at_factory: ['Received at Factory', 'violet'],
  };
  const [label, tone] = map[status] || [(status || '-').replace(/_/g, ' '), 'slate'];
  return { label, style: badgeStyle(tone) };
};

// Marketplace source -> pill.
const sourcePill = (order) => {
  const src = order.order_source;
  if (src === 'amazon' || order.dispatch_type === 'amazon_order') return { label: 'Amazon', tone: 'bad' };
  if (src === 'flipkart' || order.dispatch_type === 'flipkart_order') return { label: 'Flipkart', tone: 'warn' };
  if (src === 'website') return { label: 'Website', tone: 'info' };
  return { label: 'Direct', tone: 'slate' };
};

// Payment reconciliation state -> pill.
const paymentPill = (order) => {
  if (order.marketplace_payment_status === 'paid_via_marketplace') return { label: 'Reconciled', tone: 'ok' };
  if (['amazon', 'flipkart'].includes(order.order_source) || ['amazon_order', 'flipkart_order'].includes(order.dispatch_type)) return { label: 'Unpaid', tone: 'bad' };
  if (order.payment_reference) return { label: 'Paid', tone: 'ok' };
  return { label: '-', tone: 'slate' };
};

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchOrders = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch all dispatch types
      const [allDispatchesRes, repairTicketsRes] = await Promise.all([
        axios.get(`${API}/dispatches`, { headers }),
        axios.get(`${API}/admin/all-repairs`, { headers }).catch(() => ({ data: { tickets: [] } }))
      ]);

      // Filter new orders (includes new_order, amazon_order, flipkart_order, website_order)
      const newOrderTypes = ['new_order', 'amazon_order', 'flipkart_order', 'website_order'];
      const newOrders = allDispatchesRes.data.filter(d =>
        newOrderTypes.includes(d.dispatch_type)
      );
      setOrders(newOrders);

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
            dispatched_at: ticket.dispatched_at,
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
    switch (activeTab) {
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

  const statCards = [
    { label: 'Total', value: stats.total, icon: ShoppingCart, tone: T.blue },
    { label: 'New Orders', value: stats.new_orders, icon: Package, tone: T.green },
    { label: 'Repairs', value: stats.repairs, icon: Wrench, tone: T.orange },
    { label: 'Walk-ins', value: stats.walkins, icon: UserPlus, tone: '#6D4AB0' },
    { label: 'Shipped', value: stats.shipped, icon: Truck, tone: T.blue },
  ];

  const tabs = [
    { key: 'new_orders', label: 'New Orders', count: orders.length, icon: Package },
    { key: 'repairs', label: 'Repairs', count: repairDispatches.length, icon: Wrench },
    { key: 'walkins', label: 'Walk-ins', count: walkinDispatches.length, icon: UserPlus },
  ];

  const headers = ['ID', 'CUSTOMER', activeTab === 'new_orders' ? 'PRODUCT / SKU' : 'SERIAL NUMBERS', 'SOURCE', 'PAYMENT', 'STATUS', 'COURIER', 'DATE', ''];

  const rowActionStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };
  const rowDangerStyle = { ...rowActionStyle, border: `1px solid ${T.iron200}`, color: T.orangeDeep };

  return (
    <IronShell title="Orders" subtitle={`${stats.total.toLocaleString('en-IN')} DISPATCHES · ORDERS + REPAIRS + WALK-INS`} onRefresh={fetchOrders}>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{s.value.toLocaleString('en-IN')}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Tabs + search */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {tabs.map((tb) => {
                  const Icon = tb.icon;
                  const active = activeTab === tb.key;
                  return (
                    <button key={tb.key} data-testid={`${tb.key.replace('_', '-')}-tab`} onClick={() => setActiveTab(tb.key)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                      <Icon size={14} strokeWidth={2} />{tb.label}
                      <span style={{ ...mono, fontSize: 11, opacity: 0.85 }}>({tb.count})</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                    style={{ ...inputStyle, paddingLeft: 30, width: 230 }} />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="label_uploaded">Label Uploaded</option>
                  <option value="shipped">Shipped</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="ready_for_dispatch">Ready for Dispatch</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Table */}
            {filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                <Package size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No {activeTab.replace('_', ' ')} found</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>Try adjusting your search or filters.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {headers.map((h, i) => <th key={i} style={{ ...thCell, textAlign: i === headers.length - 1 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>)}
                  </tr></thead>
                  <tbody>{filteredOrders.map((order) => {
                    const sp = sourcePill(order);
                    const pp = paymentPill(order);
                    const stp = orderStatusPill(order.status);
                    return (
                      <tr key={order.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={tdCell}>
                          <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{order.dispatch_number}</div>
                          {order.order_id && <div style={{ ...mono, fontSize: 10, color: T.iron400, marginTop: 2 }}>{order.order_id}</div>}
                        </td>
                        <td style={{ ...tdCell, maxWidth: 180 }}>
                          <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{order.customer_name || '-'}</div>
                          <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Phone size={10} />{order.phone || '-'}</div>
                        </td>
                        <td style={{ ...tdCell, maxWidth: 200 }}>
                          {activeTab === 'new_orders' ? (
                            <span style={{ fontSize: 12, color: T.iron900 }}>{order.sku || order.reason || '-'}</span>
                          ) : (
                            <div style={{ ...mono, fontSize: 10.5, color: T.iron700, lineHeight: 1.6 }}>
                              {order.board_serial_number && <div><span style={{ color: T.iron400 }}>Board: </span>{order.board_serial_number}</div>}
                              {order.device_serial_number && <div><span style={{ color: T.iron400 }}>Device: </span>{order.device_serial_number}</div>}
                              {!order.board_serial_number && !order.device_serial_number && <span style={{ color: T.iron400 }}>-</span>}
                            </div>
                          )}
                        </td>
                        <td style={tdCell}><span style={badgeStyle(sp.tone)}>{sp.label}</span></td>
                        <td style={tdCell}><span style={badgeStyle(pp.tone)}>{pp.label}</span></td>
                        <td style={tdCell}><span style={stp.style}>{stp.label}</span></td>
                        <td style={tdCell}>
                          {order.courier ? (
                            <div>
                              <div style={{ fontSize: 12, color: T.iron900 }}>{order.courier}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{order.tracking_id}</div>
                            </div>
                          ) : <span style={{ color: T.iron400 }}>-</span>}
                        </td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>
                          {order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => openViewDialog(order)} title="View" style={rowActionStyle}><Eye size={13} /></button>
                            {activeTab === 'new_orders' && (
                              <>
                                <button onClick={() => openEditDialog(order)} title="Edit" style={rowDangerStyle}><Edit size={13} /></button>
                                <button onClick={() => openDeleteDialog(order)} title="Delete" style={{ ...rowDangerStyle }}><Trash2 size={13} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </IronCard>
        </>
      )}

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
                  <span style={orderStatusPill(selectedOrder.status).style}>{orderStatusPill(selectedOrder.status).label}</span>
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
                  onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Order ID</Label>
                <Input
                  value={editForm.order_id}
                  onChange={(e) => setEditForm({ ...editForm, order_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Reference</Label>
                <Input
                  value={editForm.payment_reference}
                  onChange={(e) => setEditForm({ ...editForm, payment_reference: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
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
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
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
    </IronShell>
  );
}

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
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
import { toast } from 'sonner';
import { Truck, Package, Monitor, Loader2, CheckCircle, Clock, Edit, Upload, RefreshCw, FileText } from 'lucide-react';

export default function DispatcherDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [recentDispatches, setRecentDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [updateCourierOpen, setUpdateCourierOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [courierForm, setCourierForm] = useState({
    courier: '',
    tracking_id: '',
    label_file: null,
    reason: ''
  });

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [queueRes, recentRes] = await Promise.all([
        axios.get(`${API}/dispatcher/queue`, { headers }),
        axios.get(`${API}/dispatcher/recent`, { headers }).catch(() => ({ data: [] }))
      ]);
      setQueue(queueRes.data);
      setRecentDispatches(recentRes.data || []);
      
      // Compute stats locally
      const readyToDispatch = queueRes.data.filter(d => d.status === 'ready_for_dispatch' || d.status === 'ready_to_dispatch').length;
      const dispatchedCount = recentRes.data?.length || 0;
      
      setStats({
        ready_to_dispatch: readyToDispatch,
        dispatched_today: dispatchedCount
      });
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const openConfirmDialog = (dispatch) => {
    setSelectedItem(dispatch);
    setConfirmOpen(true);
  };

  const openUpdateCourierDialog = (dispatch) => {
    setSelectedItem(dispatch);
    setCourierForm({
      courier: dispatch.courier || '',
      tracking_id: dispatch.tracking_id || '',
      label_file: null,
      reason: ''
    });
    setUpdateCourierOpen(true);
  };

  const handleUpdateCourier = async (e) => {
    e.preventDefault();
    if (!courierForm.courier || !courierForm.tracking_id) {
      toast.error('Please fill courier and tracking ID');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('courier', courierForm.courier);
      formData.append('tracking_id', courierForm.tracking_id);
      if (courierForm.label_file) {
        formData.append('label_file', courierForm.label_file);
      }
      if (courierForm.reason) {
        formData.append('reason', courierForm.reason);
      }

      await axios.patch(`${API}/dispatcher/dispatches/${selectedItem.id}/update-courier`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Courier details updated successfully');
      setUpdateCourierOpen(false);
      setCourierForm({ courier: '', tracking_id: '', label_file: null, reason: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update courier details');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkDispatched = async () => {
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('status', 'dispatched');

      await axios.patch(`${API}/dispatches/${selectedItem.id}/status`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Marked as dispatched');
      setConfirmOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const readyToDispatch = queue.filter(d => d.status === 'ready_for_dispatch' || d.status === 'ready_to_dispatch');
  const dispatched = queue.filter(d => d.status === 'dispatched');

  if (loading) {
    return (
      <DashboardLayout title="Dispatcher Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dispatcher Dashboard">
      {/* Stats & TV Mode Link */}
      <div className="flex items-center justify-between mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 mr-6" data-testid="dispatcher-stats">
          <StatCard title="Ready to Dispatch" value={stats?.ready_to_dispatch || 0} icon={Package} />
          <StatCard title="Dispatched Today" value={stats?.dispatched_today || 0} icon={Truck} />
          <StatCard title="Total in Queue" value={queue.length} icon={Clock} />
        </div>
        <Link to="/dispatcher/tv">
          <Button className="bg-slate-900 hover:bg-slate-800" data-testid="tv-mode-btn">
            <Monitor className="w-4 h-4 mr-2" />
            TV Mode
          </Button>
        </Link>
      </div>

      {/* Dispatch Queue */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-['Barlow_Condensed'] flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Ready to Dispatch ({readyToDispatch.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {readyToDispatch.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p>All items dispatched!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispatch #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readyToDispatch.map((dispatch) => (
                  <TableRow key={dispatch.id} className="data-row">
                    <TableCell className="font-mono text-sm font-medium">
                      <div>
                        {dispatch.dispatch_number}
                        {dispatch.original_ticket_info?.is_walkin ? (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded ml-2">Walk-in</span>
                        ) : dispatch.original_ticket_info ? (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-2">CRM</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{dispatch.dispatch_type?.replace('_', ' ')}</TableCell>
                    <TableCell>{dispatch.customer_name}</TableCell>
                    <TableCell className="font-mono text-sm">{dispatch.phone}</TableCell>
                    <TableCell>{dispatch.sku || '-'}</TableCell>
                    <TableCell>
                      {(dispatch.invoice_url || dispatch.original_ticket_info?.invoice_file) ? (
                        <a 
                          href={`${API.replace('/api', '')}${dispatch.invoice_url || dispatch.original_ticket_info?.invoice_file}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                          data-testid={`view-invoice-${dispatch.id}`}
                        >
                          <FileText className="w-3 h-3" />
                          View
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {dispatch.courier}
                        {dispatch.courier_update_count > 0 && (
                          <span className="text-xs text-orange-600">(#{dispatch.courier_update_count + 1})</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{dispatch.tracking_id}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                          onClick={() => openUpdateCourierDialog(dispatch)}
                          data-testid={`update-courier-${dispatch.id}`}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Update
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => openConfirmDialog(dispatch)}
                          data-testid={`dispatch-${dispatch.id}`}
                        >
                          <Truck className="w-4 h-4 mr-1" />
                          Dispatch
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recently Dispatched */}
      <Card>
        <CardHeader>
          <CardTitle className="font-['Barlow_Condensed'] flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Recently Dispatched ({dispatched.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dispatched.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No dispatched items yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispatch #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatched.slice(0, 10).map((dispatch) => (
                  <TableRow key={dispatch.id} className="data-row">
                    <TableCell className="font-mono text-sm">{dispatch.dispatch_number}</TableCell>
                    <TableCell>{dispatch.customer_name}</TableCell>
                    <TableCell>{dispatch.courier}</TableCell>
                    <TableCell className="font-mono text-sm">{dispatch.tracking_id}</TableCell>
                    <TableCell><StatusBadge status={dispatch.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Dispatches */}
      {recentDispatches.length > 0 && (
        <Card className="bg-slate-800 border-slate-700 mt-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Recent Dispatches ({recentDispatches.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-300">Dispatch #</TableHead>
                  <TableHead className="text-slate-300">Type</TableHead>
                  <TableHead className="text-slate-300">Customer</TableHead>
                  <TableHead className="text-slate-300">Courier</TableHead>
                  <TableHead className="text-slate-300">Tracking</TableHead>
                  <TableHead className="text-slate-300">Dispatched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDispatches.slice(0, 10).map((dispatch) => (
                  <TableRow key={dispatch.id} className="border-slate-700 hover:bg-slate-700/50">
                    <TableCell className="font-mono text-cyan-400">
                      {dispatch.dispatch_number}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        dispatch.dispatch_type === 'walkin_return' ? 'bg-purple-600' :
                        dispatch.dispatch_type === 'return_dispatch' ? 'bg-orange-600' :
                        'bg-blue-600'
                      } text-white`}>
                        {dispatch.dispatch_type === 'walkin_return' ? 'Walk-in' :
                         dispatch.dispatch_type === 'return_dispatch' ? 'Repair' :
                         dispatch.dispatch_type?.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-white">{dispatch.customer_name}</TableCell>
                    <TableCell className="text-white">{dispatch.courier || '-'}</TableCell>
                    <TableCell className="font-mono text-sm text-slate-400">
                      {dispatch.tracking_id || '-'}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {dispatch.scanned_out_at ? new Date(dispatch.scanned_out_at).toLocaleString('en-IN') :
                       dispatch.dispatched_at ? new Date(dispatch.dispatched_at).toLocaleString('en-IN') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Dispatch</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-4">Mark this item as dispatched?</p>
            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <p><strong>Dispatch #:</strong> {selectedItem?.dispatch_number}</p>
              <p><strong>Customer:</strong> {selectedItem?.customer_name}</p>
              <p><strong>Courier:</strong> {selectedItem?.courier}</p>
              <p><strong>Tracking:</strong> {selectedItem?.tracking_id}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleMarkDispatched}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Truck className="w-4 h-4 mr-2" />}
              Confirm Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Courier Dialog */}
      <Dialog open={updateCourierOpen} onOpenChange={setUpdateCourierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-orange-600" />
              Update Courier Details
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateCourier} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Dispatch #:</strong> {selectedItem?.dispatch_number}
              </p>
              <p className="text-sm text-blue-800">
                <strong>Customer:</strong> {selectedItem?.customer_name}
              </p>
              {selectedItem?.courier && (
                <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded">
                  <p className="text-sm text-yellow-800 font-medium">
                    Current: {selectedItem?.courier} - {selectedItem?.tracking_id}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Reason for Update</Label>
              <Input 
                placeholder="e.g., Courier didn't arrive, wrong tracking ID..."
                value={courierForm.reason}
                onChange={(e) => setCourierForm({...courierForm, reason: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Courier *</Label>
                <Input 
                  placeholder="e.g., Delhivery, BlueDart"
                  value={courierForm.courier}
                  onChange={(e) => setCourierForm({...courierForm, courier: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>New Tracking ID *</Label>
                <Input 
                  placeholder="e.g., DEL123456"
                  value={courierForm.tracking_id}
                  onChange={(e) => setCourierForm({...courierForm, tracking_id: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>New Shipping Label (Optional)</Label>
              <Input 
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setCourierForm({...courierForm, label_file: e.target.files?.[0] || null})}
              />
              <p className="text-xs text-slate-500">Upload new label if available</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUpdateCourierOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Update Courier
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

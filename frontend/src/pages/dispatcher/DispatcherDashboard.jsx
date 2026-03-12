import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Truck, Package, Monitor, Loader2, CheckCircle, Clock } from 'lucide-react';

export default function DispatcherDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const queueRes = await axios.get(`${API}/dispatcher/queue`, { headers });
      setQueue(queueRes.data);
      
      // Compute stats locally
      const readyToDispatch = queueRes.data.filter(d => d.status === 'ready_for_dispatch' || d.status === 'ready_to_dispatch').length;
      const dispatchedToday = queueRes.data.filter(d => d.status === 'dispatched').length;
      
      setStats({
        ready_to_dispatch: readyToDispatch,
        dispatched_today: dispatchedToday
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
                  <TableHead>Courier</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readyToDispatch.map((dispatch) => (
                  <TableRow key={dispatch.id} className="data-row">
                    <TableCell className="font-mono text-sm font-medium">{dispatch.dispatch_number}</TableCell>
                    <TableCell className="capitalize">{dispatch.dispatch_type?.replace('_', ' ')}</TableCell>
                    <TableCell>{dispatch.customer_name}</TableCell>
                    <TableCell className="font-mono text-sm">{dispatch.phone}</TableCell>
                    <TableCell>{dispatch.sku || '-'}</TableCell>
                    <TableCell>{dispatch.courier}</TableCell>
                    <TableCell className="font-mono text-sm">{dispatch.tracking_id}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => openConfirmDialog(dispatch)}
                        data-testid={`dispatch-${dispatch.id}`}
                      >
                        <Truck className="w-4 h-4 mr-1" />
                        Dispatch
                      </Button>
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
    </DashboardLayout>
  );
}

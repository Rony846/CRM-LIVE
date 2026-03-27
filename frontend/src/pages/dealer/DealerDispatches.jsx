import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Truck, Package, ExternalLink, Loader2, Search, MapPin, Calendar,
  Clock, CheckCircle, ArrowRight, Box, IndianRupee
} from 'lucide-react';

const STATUS_CONFIG = {
  pending: { color: 'bg-yellow-600', icon: Clock, label: 'Pending' },
  confirmed: { color: 'bg-cyan-600', icon: CheckCircle, label: 'Confirmed' },
  dispatched: { color: 'bg-blue-600', icon: Truck, label: 'In Transit' },
  delivered: { color: 'bg-green-600', icon: CheckCircle, label: 'Delivered' },
  cancelled: { color: 'bg-red-600', icon: Package, label: 'Cancelled' }
};

export default function DealerDispatches() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dispatches, setDispatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (token) {
      fetchDispatches();
    }
  }, [token]);

  const fetchDispatches = async () => {
    try {
      const response = await axios.get(`${API}/dealer/dispatches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDispatches(response.data);
    } catch (error) {
      toast.error('Failed to load dispatch information');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const filteredDispatches = dispatches.filter(dispatch => {
    if (statusFilter && dispatch.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (dispatch.order_number || '').toLowerCase().includes(term) ||
      (dispatch.awb || '').toLowerCase().includes(term) ||
      (dispatch.courier || '').toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <DashboardLayout title="Dispatch Tracking">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  const dispatchedCount = dispatches.filter(d => d.status === 'dispatched').length;
  const deliveredCount = dispatches.filter(d => d.status === 'delivered').length;

  return (
    <DashboardLayout title="Dispatch Tracking">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Dispatch Tracking</h1>
          <p className="text-slate-400">Track your shipments and delivery status</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">In Transit</p>
                  <p className="text-2xl font-bold text-blue-400">{dispatchedCount}</p>
                </div>
                <Truck className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Delivered</p>
                  <p className="text-2xl font-bold text-green-400">{deliveredCount}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Shipments</p>
                  <p className="text-2xl font-bold text-white">{dispatches.length}</p>
                </div>
                <Package className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by order number, AWB, or courier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-slate-900 border-slate-700"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={!statusFilter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('')}
                  className={!statusFilter ? 'bg-cyan-600' : ''}
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === 'dispatched' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('dispatched')}
                  className={statusFilter === 'dispatched' ? 'bg-blue-600' : ''}
                >
                  In Transit
                </Button>
                <Button
                  variant={statusFilter === 'delivered' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('delivered')}
                  className={statusFilter === 'delivered' ? 'bg-green-600' : ''}
                >
                  Delivered
                </Button>
                <Button
                  variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('confirmed')}
                  className={statusFilter === 'confirmed' ? 'bg-cyan-600' : ''}
                >
                  Confirmed
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dispatch List */}
        {filteredDispatches.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-12 text-center">
              <Truck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Dispatches Found</h3>
              <p className="text-slate-400 mb-4">
                {searchTerm || statusFilter 
                  ? 'No dispatches match your search criteria'
                  : 'Your dispatches will appear here once orders are shipped'}
              </p>
              <Link to="/dealer/orders/new">
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  Place New Order
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredDispatches.map((dispatch) => {
              const statusConfig = STATUS_CONFIG[dispatch.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusConfig.icon;
              
              return (
                <Card key={dispatch.order_id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Order Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-white font-semibold">{dispatch.order_number}</h3>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(dispatch.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Box className="w-4 h-4" />
                            {dispatch.items_count} items
                          </span>
                          <span className="flex items-center gap-1">
                            <IndianRupee className="w-4 h-4" />
                            {formatCurrency(dispatch.total_amount)}
                          </span>
                        </div>
                      </div>

                      {/* AWB & Courier Info */}
                      {dispatch.awb ? (
                        <div className="flex items-center gap-4 p-3 bg-slate-900 rounded-lg">
                          <div>
                            <p className="text-slate-400 text-xs">Courier</p>
                            <p className="text-white font-medium">{dispatch.courier || 'N/A'}</p>
                          </div>
                          <div className="w-px h-8 bg-slate-700" />
                          <div>
                            <p className="text-slate-400 text-xs">AWB Number</p>
                            <p className="text-cyan-400 font-mono font-medium">{dispatch.awb}</p>
                          </div>
                          {dispatch.tracking_url && (
                            <>
                              <div className="w-px h-8 bg-slate-700" />
                              <a 
                                href={dispatch.tracking_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                  <ExternalLink className="w-4 h-4 mr-1" />
                                  Track
                                </Button>
                              </a>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg">
                          <Clock className="w-5 h-5 text-yellow-400" />
                          <div>
                            <p className="text-slate-400 text-xs">Status</p>
                            <p className="text-yellow-400 font-medium">Awaiting Dispatch</p>
                          </div>
                        </div>
                      )}

                      {/* Dispatch Date */}
                      {dispatch.dispatch_date && (
                        <div className="text-right">
                          <p className="text-slate-400 text-xs">Dispatched On</p>
                          <p className="text-white font-medium">{formatDate(dispatch.dispatch_date)}</p>
                        </div>
                      )}

                      {/* View Order Link */}
                      <Link to={`/dealer/orders/${dispatch.order_id}`}>
                        <Button variant="ghost" size="sm" className="text-cyan-400">
                          View <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info Card */}
        <Card className="bg-blue-900/20 border-blue-600">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-300 font-medium">Tracking Information</p>
                <p className="text-blue-200 text-sm mt-1">
                  Click the "Track" button to open the courier's tracking page in a new window. 
                  AWB numbers are provided once your order is dispatched from our warehouse. 
                  For any delivery issues, please raise a support ticket.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

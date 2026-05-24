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

// Obsidian-Elite status chip tones
const STATUS_CONFIG = {
  pending:   { badge: 'bg-amber-400/15 text-amber-400 ring-amber-400/25',   icon: Clock,        label: 'Pending' },
  confirmed: { badge: 'bg-sky-400/15 text-sky-400 ring-sky-400/25',         icon: CheckCircle,  label: 'Confirmed' },
  dispatched:{ badge: 'bg-primary/15 text-primary ring-primary/25',          icon: Truck,        label: 'In Transit' },
  delivered: { badge: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25', icon: CheckCircle, label: 'Delivered' },
  cancelled: { badge: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',      icon: Package,      label: 'Cancelled' }
};

const badgeBase = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap';

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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
            Dealer Portal
          </p>
          <h1 className="text-2xl font-bold text-foreground">Dispatch Tracking</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track your shipments and delivery status</p>
        </div>

        {/* Summary KPI tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* In Transit */}
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">In Transit</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">{dispatchedCount}</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-primary/15 text-primary">
                <Truck className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Delivered */}
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Delivered</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">{deliveredCount}</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-emerald-500/15 text-emerald-400">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="mg-card rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total Shipments</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">{dispatches.length}</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-violet-400/15 text-violet-400">
                <Package className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mg-card rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by order number, AWB, or courier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={!statusFilter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('')}
                className={!statusFilter ? 'bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'dispatched' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('dispatched')}
                className={statusFilter === 'dispatched' ? 'bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}
              >
                In Transit
              </Button>
              <Button
                variant={statusFilter === 'delivered' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('delivered')}
                className={statusFilter === 'delivered' ? 'bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}
              >
                Delivered
              </Button>
              <Button
                variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('confirmed')}
                className={statusFilter === 'confirmed' ? 'bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}
              >
                Confirmed
              </Button>
            </div>
          </div>
        </div>

        {/* Dispatch List */}
        {filteredDispatches.length === 0 ? (
          <div className="mg-card rounded-lg border border-border bg-card p-12 text-center">
            <Truck className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Dispatches Found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchTerm || statusFilter
                ? 'No dispatches match your search criteria'
                : 'Your dispatches will appear here once orders are shipped'}
            </p>
            <Link to="/dealer/orders/new">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Place New Order
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDispatches.map((dispatch) => {
              const statusCfg = STATUS_CONFIG[dispatch.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusCfg.icon;

              return (
                <div
                  key={dispatch.order_id}
                  className="mg-card rounded-lg border border-border bg-card hover:border-border/80 transition-colors p-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Order Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-foreground font-semibold font-mono">{dispatch.order_number}</h3>
                        <span className={`${badgeBase} ${statusCfg.badge}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(dispatch.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Box className="w-3.5 h-3.5" />
                          {dispatch.items_count} items
                        </span>
                        <span className="flex items-center gap-1 tabular-nums">
                          <IndianRupee className="w-3.5 h-3.5" />
                          {formatCurrency(dispatch.total_amount)}
                        </span>
                      </div>
                    </div>

                    {/* AWB & Courier Info */}
                    {dispatch.awb ? (
                      <div className="flex items-center gap-4 px-4 py-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Courier</p>
                          <p className="text-foreground font-medium text-sm mt-0.5">{dispatch.courier || 'N/A'}</p>
                        </div>
                        <div className="w-px h-8 bg-border" />
                        <div>
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AWB</p>
                          <p className="font-mono text-primary font-medium text-sm mt-0.5">{dispatch.awb}</p>
                        </div>
                        {dispatch.tracking_url && (
                          <>
                            <div className="w-px h-8 bg-border" />
                            <a
                              href={dispatch.tracking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                                <ExternalLink className="w-4 h-4 mr-1" />
                                Track
                              </Button>
                            </a>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 bg-muted rounded-lg">
                        <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                        <div>
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                          <p className="text-amber-400 font-medium text-sm mt-0.5">Awaiting Dispatch</p>
                        </div>
                      </div>
                    )}

                    {/* Dispatch Date */}
                    {dispatch.dispatch_date && (
                      <div className="text-right">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dispatched On</p>
                        <p className="text-foreground font-mono text-sm mt-0.5">{formatDate(dispatch.dispatch_date)}</p>
                      </div>
                    )}

                    {/* View Order Link */}
                    <Link to={`/dealer/orders/${dispatch.order_id}`}>
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                        View <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Banner */}
        <div className="mg-card rounded-lg border border-sky-400/25 bg-sky-400/5 p-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sky-400 font-semibold text-sm">Tracking Information</p>
              <p className="text-muted-foreground text-sm mt-1">
                Click the "Track" button to open the courier's tracking page in a new window.
                AWB numbers are provided once your order is dispatched from our warehouse.
                For any delivery issues, please raise a support ticket.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

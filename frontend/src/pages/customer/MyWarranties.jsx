import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { Shield, Eye, Plus, Loader2, Calendar, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function MyWarranties() {
  const { token } = useAuth();
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchWarranties();
  }, [token]);

  const fetchWarranties = async () => {
    try {
      const response = await axios.get(`${API}/warranties`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarranties(response.data);
    } catch (error) {
      toast.error('Failed to load warranties');
    } finally {
      setLoading(false);
    }
  };

  const viewWarrantyDetails = (warranty) => {
    setSelectedWarranty(warranty);
    setDetailsOpen(true);
  };

  const isWarrantyActive = (warranty) => {
    if (warranty.status !== 'approved' || !warranty.warranty_end_date) return false;
    return new Date(warranty.warranty_end_date) > new Date();
  };

  if (loading) {
    return (
      <DashboardLayout title="My Warranties">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Warranties">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-500">View all your registered product warranties</p>
        </div>
        <Link to="/customer/warranty/register">
          <Button className="bg-blue-600 hover:bg-blue-700" data-testid="new-warranty-btn">
            <Plus className="w-4 h-4 mr-2" />
            Register New
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {warranties.length === 0 ? (
            <div className="text-center py-16">
              <Shield className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">No warranties registered</h3>
              <p className="text-slate-500 mb-4">Register your product warranty for protection</p>
              <Link to="/customer/warranty/register">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Register Warranty
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device Type</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Warranty Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warranties.map((warranty) => (
                  <TableRow key={warranty.id} className="data-row" data-testid={`warranty-row-${warranty.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{warranty.device_type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{warranty.order_id}</TableCell>
                    <TableCell>{new Date(warranty.invoice_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {warranty.warranty_end_date ? (
                        <div className={`flex items-center gap-1 ${isWarrantyActive(warranty) ? 'text-green-600' : 'text-red-600'}`}>
                          <Calendar className="w-4 h-4" />
                          {new Date(warranty.warranty_end_date).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-slate-400">Pending approval</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={warranty.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewWarrantyDetails(warranty)}
                        data-testid={`view-warranty-${warranty.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Warranty Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-['Barlow_Condensed'] text-xl flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Warranty Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedWarranty && (
            <div className="space-y-6">
              {/* Status Banner */}
              <div className={`p-4 rounded-lg ${
                selectedWarranty.status === 'approved' && isWarrantyActive(selectedWarranty)
                  ? 'bg-green-50 border border-green-200'
                  : selectedWarranty.status === 'pending'
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-slate-50 border border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <StatusBadge status={selectedWarranty.status} />
                </div>
                {selectedWarranty.status === 'approved' && selectedWarranty.warranty_end_date && (
                  <div className="mt-2 text-sm">
                    <span className="text-slate-600">Expires: </span>
                    <span className={isWarrantyActive(selectedWarranty) ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                      {new Date(selectedWarranty.warranty_end_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Device Type</p>
                  <p className="font-medium">{selectedWarranty.device_type}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Order ID</p>
                  <p className="font-mono text-sm font-medium">{selectedWarranty.order_id}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Invoice Date</p>
                  <p className="font-medium">{new Date(selectedWarranty.invoice_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Invoice Amount</p>
                  <p className="font-medium">₹{selectedWarranty.invoice_amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Registered On</p>
                  <p className="font-medium">{new Date(selectedWarranty.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Admin Notes */}
              {selectedWarranty.admin_notes && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium mb-1">Admin Notes</p>
                  <p className="text-sm text-blue-600">{selectedWarranty.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

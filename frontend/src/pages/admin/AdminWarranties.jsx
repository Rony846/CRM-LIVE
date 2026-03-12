import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, Clock, CheckCircle, XCircle, Loader2, Eye, Calendar } from 'lucide-react';

export default function AdminWarranties() {
  const { token } = useAuth();
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalData, setApprovalData] = useState({
    warranty_end_date: '',
    notes: ''
  });

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

  const openActionDialog = (warranty) => {
    setSelectedWarranty(warranty);
    // Set default warranty end date to 1 year from invoice date
    const invoiceDate = new Date(warranty.invoice_date);
    invoiceDate.setFullYear(invoiceDate.getFullYear() + 1);
    setApprovalData({
      warranty_end_date: invoiceDate.toISOString().split('T')[0],
      notes: ''
    });
    setActionOpen(true);
  };

  const handleApprove = async () => {
    if (!approvalData.warranty_end_date) {
      toast.error('Please set warranty end date');
      return;
    }
    setActionLoading(true);
    try {
      await axios.patch(`${API}/warranties/${selectedWarranty.id}/approve`, approvalData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Warranty approved');
      setActionOpen(false);
      fetchWarranties();
    } catch (error) {
      toast.error('Failed to approve warranty');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!approvalData.notes) {
      toast.error('Please provide rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('notes', approvalData.notes);
      await axios.patch(`${API}/warranties/${selectedWarranty.id}/reject`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Warranty rejected');
      setActionOpen(false);
      fetchWarranties();
    } catch (error) {
      toast.error('Failed to reject warranty');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingWarranties = warranties.filter(w => w.status === 'pending');
  const approvedWarranties = warranties.filter(w => w.status === 'approved');
  const rejectedWarranties = warranties.filter(w => w.status === 'rejected');

  if (loading) {
    return (
      <DashboardLayout title="Warranty Management">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Warranty Management">
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-0">
            <TabsList>
              <TabsTrigger value="pending" data-testid="pending-tab">
                <Clock className="w-4 h-4 mr-2" />
                Pending ({pendingWarranties.length})
              </TabsTrigger>
              <TabsTrigger value="approved" data-testid="approved-tab">
                <CheckCircle className="w-4 h-4 mr-2" />
                Approved ({approvedWarranties.length})
              </TabsTrigger>
              <TabsTrigger value="rejected" data-testid="rejected-tab">
                <XCircle className="w-4 h-4 mr-2" />
                Rejected ({rejectedWarranties.length})
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Pending Tab */}
            <TabsContent value="pending" className="mt-0">
              {pendingWarranties.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>All warranties reviewed!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingWarranties.map((warranty) => (
                      <TableRow key={warranty.id} className="data-row">
                        <TableCell>
                          <div>
                            <p className="font-medium">{warranty.first_name} {warranty.last_name}</p>
                            <p className="text-sm text-slate-500">{warranty.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{warranty.device_type}</TableCell>
                        <TableCell className="font-mono text-sm">{warranty.order_id}</TableCell>
                        <TableCell>{new Date(warranty.invoice_date).toLocaleDateString()}</TableCell>
                        <TableCell>₹{warranty.invoice_amount?.toLocaleString()}</TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {new Date(warranty.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => openActionDialog(warranty)}
                            data-testid={`review-warranty-${warranty.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Approved Tab */}
            <TabsContent value="approved" className="mt-0">
              {approvedWarranties.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p>No approved warranties</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Warranty Expires</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedWarranties.map((warranty) => (
                      <TableRow key={warranty.id} className="data-row">
                        <TableCell className="font-medium">
                          {warranty.first_name} {warranty.last_name}
                        </TableCell>
                        <TableCell>{warranty.device_type}</TableCell>
                        <TableCell className="font-mono text-sm">{warranty.order_id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-green-600" />
                            {new Date(warranty.warranty_end_date).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge status="approved" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Rejected Tab */}
            <TabsContent value="rejected" className="mt-0">
              {rejectedWarranties.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p>No rejected warranties</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Rejection Reason</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rejectedWarranties.map((warranty) => (
                      <TableRow key={warranty.id} className="data-row">
                        <TableCell className="font-medium">
                          {warranty.first_name} {warranty.last_name}
                        </TableCell>
                        <TableCell>{warranty.device_type}</TableCell>
                        <TableCell className="font-mono text-sm">{warranty.order_id}</TableCell>
                        <TableCell className="max-w-xs truncate">{warranty.admin_notes}</TableCell>
                        <TableCell><StatusBadge status="rejected" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Review Dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-['Barlow_Condensed'] text-xl flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Review Warranty
            </DialogTitle>
          </DialogHeader>
          
          {selectedWarranty && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Customer</p>
                    <p className="font-medium">{selectedWarranty.first_name} {selectedWarranty.last_name}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Phone</p>
                    <p className="font-mono">{selectedWarranty.phone}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p>{selectedWarranty.email}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Device</p>
                    <p className="font-medium">{selectedWarranty.device_type}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Order ID</p>
                    <p className="font-mono">{selectedWarranty.order_id}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Invoice Amount</p>
                    <p className="font-medium">₹{selectedWarranty.invoice_amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Invoice Date</p>
                    <p>{new Date(selectedWarranty.invoice_date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Approval Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Warranty End Date *</Label>
                  <Input
                    type="date"
                    value={approvalData.warranty_end_date}
                    onChange={(e) => setApprovalData({...approvalData, warranty_end_date: e.target.value})}
                    data-testid="warranty-end-date-input"
                  />
                  <p className="text-xs text-slate-500">Set the warranty expiration date</p>
                </div>

                <div className="space-y-2">
                  <Label>Notes (required for rejection)</Label>
                  <Textarea
                    placeholder="Add notes or rejection reason..."
                    value={approvalData.notes}
                    onChange={(e) => setApprovalData({...approvalData, notes: e.target.value})}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading}
              data-testid="reject-warranty-btn"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Reject
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={actionLoading}
              data-testid="approve-warranty-btn"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

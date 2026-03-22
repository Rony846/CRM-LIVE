import React, { useState, useEffect, useRef } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, Clock, CheckCircle, XCircle, Loader2, Eye, Calendar, Star, ExternalLink, Upload, FileText } from 'lucide-react';

export default function AdminWarranties() {
  const { token } = useAuth();
  const [warranties, setWarranties] = useState([]);
  const [extensionRequests, setExtensionRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [extensionOpen, setExtensionOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const invoiceFileRef = useRef(null);
  const [approvalData, setApprovalData] = useState({
    warranty_end_date: '',
    notes: ''
  });
  const [extensionData, setExtensionData] = useState({
    extension_months: '3',
    notes: ''
  });

  useEffect(() => {
    fetchWarranties();
    fetchExtensionRequests();
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

  const fetchExtensionRequests = async () => {
    try {
      const response = await axios.get(`${API}/admin/warranty-extensions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExtensionRequests(response.data);
    } catch (error) {
      console.error('Failed to load extension requests');
    }
  };

  const openActionDialog = (warranty) => {
    setSelectedWarranty(warranty);
    // Set default warranty end date to 1 year from invoice/purchase date
    let defaultEndDate;
    const dateSource = warranty.invoice_date || warranty.purchase_date;
    
    if (dateSource) {
      try {
        const startDate = new Date(dateSource);
        if (!isNaN(startDate.getTime())) {
          startDate.setFullYear(startDate.getFullYear() + 1);
          defaultEndDate = startDate.toISOString().split('T')[0];
        }
      } catch (e) {
        // Invalid date, use default
      }
    }
    
    // Fallback to 1 year from today if no valid date
    if (!defaultEndDate) {
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      defaultEndDate = oneYearFromNow.toISOString().split('T')[0];
    }
    
    setApprovalData({
      warranty_end_date: defaultEndDate,
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

  // Extension request handlers
  const openExtensionDialog = (warranty) => {
    setSelectedWarranty(warranty);
    setExtensionData({ extension_months: '3', notes: '' });
    setExtensionOpen(true);
  };

  const handleExtensionApprove = async () => {
    setActionLoading(true);
    try {
      await axios.patch(`${API}/admin/warranties/${selectedWarranty.id}/review-extension`, {
        action: 'approve',
        extension_months: parseInt(extensionData.extension_months),
        notes: extensionData.notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Extension approved - ${extensionData.extension_months} months added!`);
      setExtensionOpen(false);
      fetchWarranties();
      fetchExtensionRequests();
    } catch (error) {
      toast.error('Failed to approve extension');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExtensionReject = async () => {
    if (!extensionData.notes) {
      toast.error('Please provide rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      await axios.patch(`${API}/admin/warranties/${selectedWarranty.id}/review-extension`, {
        action: 'reject',
        notes: extensionData.notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Extension request rejected');
      setExtensionOpen(false);
      fetchWarranties();
      fetchExtensionRequests();
    } catch (error) {
      toast.error('Failed to reject extension');
    } finally {
      setActionLoading(false);
    }
  };

  // Invoice management handlers
  const openInvoiceDialog = (warranty) => {
    setSelectedWarranty(warranty);
    setInvoiceOpen(true);
  };

  const handleInvoiceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWarranty) return;
    
    setUploadingInvoice(true);
    try {
      const formData = new FormData();
      formData.append('invoice_file', file);
      
      await axios.post(`${API}/warranties/${selectedWarranty.id}/upload-invoice`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      toast.success('Invoice uploaded successfully');
      setInvoiceOpen(false);
      fetchWarranties();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload invoice');
    } finally {
      setUploadingInvoice(false);
      if (invoiceFileRef.current) {
        invoiceFileRef.current.value = '';
      }
    }
  };

  const pendingWarranties = warranties.filter(w => w.status === 'pending');
  const approvedWarranties = warranties.filter(w => w.status === 'approved');
  const rejectedWarranties = warranties.filter(w => w.status === 'rejected');
  const pendingExtensions = extensionRequests.filter(w => w.extension_status === 'pending');

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
              <TabsTrigger value="extensions" data-testid="extensions-tab">
                <Star className="w-4 h-4 mr-2" />
                Extension Requests ({pendingExtensions.length})
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
                      <TableHead>Purchase Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingWarranties.map((warranty) => (
                      <TableRow key={warranty.id} className="data-row">
                        <TableCell>
                          <div>
                            <p className="font-medium">{warranty.first_name || warranty.customer_name || ''} {warranty.last_name || ''}</p>
                            <p className="text-sm text-slate-500">{warranty.email || warranty.customer_email || ''}</p>
                          </div>
                        </TableCell>
                        <TableCell>{warranty.device_type || warranty.product_type || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{warranty.order_id || warranty.invoice_number || '-'}</TableCell>
                        <TableCell>
                          {warranty.invoice_date || warranty.purchase_date 
                            ? new Date(warranty.invoice_date || warranty.purchase_date).toLocaleDateString() 
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {warranty.source === 'voltdoctor' ? (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">VoltDoctor</span>
                          ) : (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">CRM</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {warranty.created_at ? new Date(warranty.created_at).toLocaleDateString() : '-'}
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

            {/* Extension Requests Tab */}
            <TabsContent value="extensions" className="mt-0">
              {pendingExtensions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Star className="w-12 h-12 mx-auto mb-3 text-yellow-400" />
                  <p>No pending extension requests</p>
                  <p className="text-sm mt-1">Extension requests from customers with Amazon reviews will appear here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Current Expiry</TableHead>
                      <TableHead>Review Screenshot</TableHead>
                      <TableHead>Requested On</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingExtensions.map((warranty) => (
                      <TableRow key={warranty.id} className="data-row bg-yellow-50/50" data-testid={`extension-row-${warranty.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{warranty.first_name} {warranty.last_name}</p>
                            <p className="text-sm text-slate-500">{warranty.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{warranty.device_type}</TableCell>
                        <TableCell className="font-mono text-sm">{warranty.order_id}</TableCell>
                        <TableCell>
                          {warranty.warranty_end_date ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <Calendar className="w-4 h-4" />
                              {new Date(warranty.warranty_end_date).toLocaleDateString()}
                            </div>
                          ) : (
                            <span className="text-slate-400">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {warranty.extension_review_file && (
                            <a 
                              href={`${API.replace('/api', '')}${warranty.extension_review_file}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="w-4 h-4" />
                              View
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {new Date(warranty.updated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            className="bg-yellow-500 hover:bg-yellow-600"
                            onClick={() => openExtensionDialog(warranty)}
                            data-testid={`review-extension-${warranty.id}`}
                          >
                            <Star className="w-4 h-4 mr-1" />
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
                      <TableHead>Invoice</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedWarranties.map((warranty) => (
                      <TableRow key={warranty.id} className="data-row">
                        <TableCell className="font-medium">
                          {warranty.first_name || warranty.customer_name || '-'} {warranty.last_name || ''}
                        </TableCell>
                        <TableCell>{warranty.device_type || warranty.product_type || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{warranty.order_id || warranty.serial_number || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-green-600" />
                            {warranty.warranty_end_date 
                              ? new Date(warranty.warranty_end_date).toLocaleDateString() 
                              : '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(warranty.admin_invoice_file || warranty.invoice_file) ? (
                            <a 
                              href={`${API.replace('/api', '')}${warranty.admin_invoice_file || warranty.invoice_file}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                              data-testid={`view-invoice-${warranty.id}`}
                            >
                              <FileText className="w-4 h-4" />
                              View
                            </a>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openInvoiceDialog(warranty)}
                              data-testid={`upload-invoice-${warranty.id}`}
                            >
                              <Upload className="w-3 h-3 mr-1" />
                              Upload
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          {warranty.source === 'voltdoctor' ? (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">VoltDoctor</span>
                          ) : (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">CRM</span>
                          )}
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
                          {warranty.first_name || warranty.customer_name || '-'} {warranty.last_name || ''}
                        </TableCell>
                        <TableCell>{warranty.device_type || warranty.product_type || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{warranty.order_id || warranty.serial_number || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{warranty.admin_notes || warranty.notes || '-'}</TableCell>
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
              {selectedWarranty?.source === 'voltdoctor' && (
                <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">VoltDoctor</span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedWarranty && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Customer</p>
                    <p className="font-medium">{selectedWarranty.first_name || selectedWarranty.customer_name || '-'} {selectedWarranty.last_name || ''}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Phone</p>
                    <p className="font-mono">{selectedWarranty.phone || selectedWarranty.customer_phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p>{selectedWarranty.email || selectedWarranty.customer_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Device</p>
                    <p className="font-medium">{selectedWarranty.device_type || selectedWarranty.product_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Order ID / Serial</p>
                    <p className="font-mono">{selectedWarranty.order_id || selectedWarranty.serial_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Purchase Date</p>
                    <p>{(() => {
                      const dateStr = selectedWarranty.invoice_date || selectedWarranty.purchase_date;
                      if (!dateStr) return '-';
                      try {
                        const d = new Date(dateStr);
                        return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
                      } catch {
                        return dateStr;
                      }
                    })()}</p>
                  </div>
                </div>
                
                {/* Customer Invoice File */}
                {selectedWarranty.invoice_file && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-slate-500 text-sm mb-2">Customer Uploaded Invoice</p>
                    <a 
                      href={`${API.replace('/api', '')}${selectedWarranty.invoice_file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      View Invoice
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
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

      {/* Extension Review Dialog */}
      <Dialog open={extensionOpen} onOpenChange={setExtensionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-['Barlow_Condensed'] text-xl flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Review Extension Request
            </DialogTitle>
          </DialogHeader>
          
          {selectedWarranty && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Customer</p>
                    <p className="font-medium">{selectedWarranty.first_name || selectedWarranty.customer_name || '-'} {selectedWarranty.last_name || ''}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Device</p>
                    <p className="font-medium">{selectedWarranty.device_type || selectedWarranty.product_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Order ID</p>
                    <p className="font-mono">{selectedWarranty.order_id || selectedWarranty.serial_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Current Expiry</p>
                    <p className="font-medium">
                      {selectedWarranty.warranty_end_date 
                        ? new Date(selectedWarranty.warranty_end_date).toLocaleDateString()
                        : 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Review Screenshot */}
              {selectedWarranty.extension_review_file && (
                <div className="space-y-2">
                  <Label>Customer's Amazon Review Screenshot</Label>
                  <div className="border rounded-lg p-2 bg-slate-50">
                    <a 
                      href={`${API.replace('/api', '')}${selectedWarranty.extension_review_file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Screenshot in New Tab
                    </a>
                  </div>
                </div>
              )}

              {/* Extension Options */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Extension Period *</Label>
                  <Select 
                    value={extensionData.extension_months} 
                    onValueChange={(value) => setExtensionData({...extensionData, extension_months: value})}
                  >
                    <SelectTrigger data-testid="extension-months-select">
                      <SelectValue placeholder="Select extension period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Month</SelectItem>
                      <SelectItem value="2">2 Months</SelectItem>
                      <SelectItem value="3">3 Months (Default)</SelectItem>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="12">12 Months</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Choose how many months to extend the warranty</p>
                </div>

                <div className="space-y-2">
                  <Label>Notes (required for rejection)</Label>
                  <Textarea
                    placeholder="Add notes or rejection reason..."
                    value={extensionData.notes}
                    onChange={(e) => setExtensionData({...extensionData, notes: e.target.value})}
                    data-testid="extension-notes-input"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExtensionOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={handleExtensionReject}
              disabled={actionLoading}
              data-testid="reject-extension-btn"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Reject
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleExtensionApprove}
              disabled={actionLoading}
              data-testid="approve-extension-btn"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Approve Extension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Upload Dialog */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Upload Warranty Invoice
            </DialogTitle>
          </DialogHeader>
          
          {selectedWarranty && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Customer</p>
                    <p className="font-medium">{selectedWarranty.first_name || selectedWarranty.customer_name || '-'} {selectedWarranty.last_name || ''}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Order ID</p>
                    <p className="font-mono">{selectedWarranty.order_id || selectedWarranty.serial_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Device</p>
                    <p>{selectedWarranty.device_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Warranty Expires</p>
                    <p>{selectedWarranty.warranty_end_date ? new Date(selectedWarranty.warranty_end_date).toLocaleDateString() : '-'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Upload Invoice PDF</Label>
                <Input
                  ref={invoiceFileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleInvoiceUpload}
                  disabled={uploadingInvoice}
                  data-testid="invoice-file-input"
                />
                <p className="text-xs text-slate-500">Accepted formats: PDF, JPG, PNG</p>
              </div>

              {uploadingInvoice && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading...</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

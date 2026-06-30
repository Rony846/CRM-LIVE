import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  FileText, Plus, Search, Eye, Send, Copy, Loader2, Building2,
  Clock, CheckCircle, XCircle, ArrowRight, RefreshCw, Trash2,
  Package, AlertTriangle, Calendar, IndianRupee, ExternalLink, Download,
  Factory, ShoppingCart, Truck, Mail
} from 'lucide-react';
import ClickToCallButton from '@/components/calls/ClickToCallButton';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-muted', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-600', icon: Send },
  viewed: { label: 'Viewed', color: 'bg-purple-600', icon: Eye },
  approved: { label: 'Approved', color: 'bg-green-600', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-600', icon: XCircle },
  converted: { label: 'Converted', color: 'bg-cyan-600', icon: ArrowRight },
  expired: { label: 'Expired', color: 'bg-orange-600', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'bg-gray-600', icon: Trash2 }
};

const CONVERSION_TYPES = [
  { value: 'pending_fulfillment', label: 'Add to Dispatch Queue', icon: Truck, color: 'bg-cyan-600', description: 'Adds to pending fulfillment queue - requires invoice & label upload via PI Pending Action page' },
  { value: 'production', label: 'Send to Production', icon: Factory, color: 'bg-purple-600', description: 'Item needs to be manufactured - creates production request for supervisor' },
  { value: 'procurement', label: 'Needs Procurement', icon: ShoppingCart, color: 'bg-blue-600', description: 'Item needs to be purchased first - adds to Pending Fulfillment queue' }
];

export default function QuotationList() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [firms, setFirms] = useState([]);
  const [stats, setStats] = useState({});
  
  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFirm, setFilterFirm] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialogs
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertType, setConvertType] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchQuotations();
    }
  }, [filterStatus, filterFirm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [quotationsRes, firmsRes, reportsRes] = await Promise.all([
        axios.get(`${API}/quotations`, { headers }),
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        axios.get(`${API}/quotations/reports`, { headers })
      ]);
      
      setQuotations(quotationsRes.data || []);
      setFirms(firmsRes.data || []);
      setStats(reportsRes.data || {});
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotations = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterFirm !== 'all') params.firm_id = filterFirm;
      
      const response = await axios.get(`${API}/quotations`, { headers, params });
      setQuotations(response.data || []);
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
    }
  };

  const handleSend = async (quotation) => {
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(`${API}/quotations/${quotation.id}/send`, {}, { headers });
      
      toast.success('Quotation sent!', {
        description: `Share link copied to clipboard`
      });
      
      // Copy share link to clipboard
      if (response.data.share_link) {
        navigator.clipboard.writeText(response.data.share_link);
      }
      
      fetchQuotations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send quotation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyLink = async (quotation) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API}/quotations/${quotation.id}`, { headers });
      
      const baseUrl = window.location.origin;
      const shareLink = `${baseUrl}/pi/${response.data.access_token}`;
      
      navigator.clipboard.writeText(shareLink);
      toast.success('Link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleEmailQuotation = async (quotation) => {
    const customerEmail = quotation.email || quotation.customer_email || quotation.party_email;
    if (!customerEmail) {
      toast.error('No customer email address found', {
        description: 'Please add customer email to the quotation first'
      });
      return;
    }
    
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/email/send/quotation/${quotation.id}`, {}, { headers });
      toast.success('Quotation emailed successfully!', {
        description: `Sent to ${customerEmail}`
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send email');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = async (quotation) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API}/quotations/${quotation.id}/pdf`, {
        headers,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${quotation.quotation_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded!');
    } catch (error) {
      toast.error('Failed to download PDF');
    }
  };

  const handleCancel = async (quotation, reason) => {
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/quotations/${quotation.id}/cancel`, {}, { 
        headers,
        params: { reason: reason || 'Cancelled by user' }
      });
      
      toast.success('Quotation cancelled');
      fetchQuotations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenConvertDialog = (quotation) => {
    setSelectedQuotation(quotation);
    setConvertType('');
    setConvertDialogOpen(true);
  };

  const handleConvert = async () => {
    if (!convertType) {
      toast.error('Please select a conversion type');
      return;
    }
    
    // For dispatch queue conversion, redirect to PI Pending Action page where mandatory fields are collected
    if (convertType === 'pending_fulfillment') {
      toast.info('Redirecting to PI Pending Action page for mandatory field collection...');
      setConvertDialogOpen(false);
      navigate('/quotations/pending-action');
      return;
    }
    
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(
        `${API}/quotations/${selectedQuotation.id}/convert`,
        null,
        { headers, params: { conversion_type: convertType } }
      );
      
      toast.success(`Quotation converted to ${convertType}!`);
      setConvertDialogOpen(false);
      setSelectedQuotation(null);
      fetchQuotations();
      
      // Show additional info about incentive if created
      if (response.data.incentive_created) {
        toast.success(`Incentive of ₹${response.data.incentive_amount} created for the agent!`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to convert quotation');
    } finally {
      setActionLoading(false);
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
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const filteredQuotations = quotations.filter(q => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        q.quotation_number?.toLowerCase().includes(search) ||
        q.customer_name?.toLowerCase().includes(search) ||
        q.customer_phone?.includes(search)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <DashboardLayout title="PI / Quotations">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="PI / Quotations">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Proforma Invoices / Quotations</h1>
            <p className="text-muted-foreground">Create, send, and manage quotations</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={fetchData}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={() => navigate('/quotations/new')}
              className="bg-cyan-600 hover:bg-cyan-700"
              data-testid="new-quotation-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Quotation
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">Total Quotations</p>
              <p className="text-2xl font-bold text-foreground">{stats.total_quotations || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.pending_approval || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">Approved</p>
              <p className="text-2xl font-bold text-green-400">{stats.by_status?.approved || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">Conversion Rate</p>
              <p className="text-2xl font-bold text-cyan-400">{stats.conversion_rate || 0}%</p>
            </CardContent>
          </Card>
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">Total Value</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(stats.total_value)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-muted border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="w-full md:w-48">
                <Label className="text-muted-foreground text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="bg-card border-border text-foreground">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="viewed">Viewed</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-full md:w-48">
                <Label className="text-muted-foreground text-xs">Firm</Label>
                <Select value={filterFirm} onValueChange={setFilterFirm}>
                  <SelectTrigger className="bg-card border-border text-foreground">
                    <SelectValue placeholder="All Firms" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Firms</SelectItem>
                    {firms.map(firm => (
                      <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1 min-w-48">
                <Label className="text-muted-foreground text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by PI#, customer, phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-card border-border text-foreground"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quotations Table */}
        <Card className="bg-muted border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">PI Number</TableHead>
                  <TableHead className="text-muted-foreground">Customer</TableHead>
                  <TableHead className="text-muted-foreground">Firm</TableHead>
                  <TableHead className="text-muted-foreground">Items</TableHead>
                  <TableHead className="text-muted-foreground text-right">Value</TableHead>
                  <TableHead className="text-muted-foreground">Valid Till</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p>No quotations found</p>
                      <Button 
                        variant="link" 
                        className="text-cyan-400"
                        onClick={() => navigate('/quotations/new')}
                      >
                        Create your first quotation
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuotations.map((q) => {
                    const statusConfig = STATUS_CONFIG[q.status] || {};
                    const StatusIcon = statusConfig.icon || FileText;
                    const isExpired = q.is_expired || q.status === 'expired';
                    
                    return (
                      <TableRow key={q.id} className="border-border" data-testid={`quotation-row-${q.id}`}>
                        <TableCell>
                          <div>
                            <p className="text-foreground font-mono text-sm">{q.quotation_number}</p>
                            {q.version > 1 && (
                              <p className="text-muted-foreground text-xs">v{q.version}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-foreground">{q.customer_name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-muted-foreground text-sm">{q.customer_phone}</p>
                              {q.customer_phone && (
                                <ClickToCallButton 
                                  phone={q.customer_phone}
                                  customerName={q.customer_name}
                                  showLabel={false}
                                  size="sm"
                                />
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{q.firm_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-border text-muted-foreground">
                            {q.items?.length || 0} items
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="text-foreground font-semibold">{formatCurrency(q.grand_total)}</p>
                        </TableCell>
                        <TableCell>
                          <div className={isExpired ? 'text-red-400' : 'text-muted-foreground'}>
                            {formatDate(q.validity_date)}
                            {isExpired && <span className="text-xs block">Expired</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusConfig.color} text-foreground`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setSelectedQuotation(q);
                                setViewDialogOpen(true);
                              }}
                              className="text-muted-foreground hover:text-foreground"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleDownloadPDF(q)}
                              className="text-muted-foreground hover:text-foreground"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            
                            {q.status === 'draft' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => navigate(`/quotations/edit/${q.id}`)}
                                  className="text-cyan-400 hover:text-cyan-300"
                                >
                                  Edit
                                </Button>
                                <Button 
                                  size="sm"
                                  onClick={() => handleSend(q)}
                                  disabled={actionLoading}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Send className="w-4 h-4 mr-1" />
                                  Send
                                </Button>
                              </>
                            )}
                            
                            {['sent', 'viewed'].includes(q.status) && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleCopyLink(q)}
                                  className="text-cyan-400 hover:text-cyan-300"
                                >
                                  <Copy className="w-4 h-4 mr-1" />
                                  Copy Link
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleEmailQuotation(q)}
                                  disabled={actionLoading}
                                  className="text-blue-400 hover:text-blue-300"
                                  title={q.email || q.customer_email ? `Email to ${q.email || q.customer_email}` : 'No email address'}
                                >
                                  <Mail className="w-4 h-4 mr-1" />
                                  Email
                                </Button>
                              </>
                            )}
                            
                            {q.status === 'approved' && !q.converted_at && ['admin', 'accountant'].includes(user?.role) && (
                              <Button 
                                size="sm"
                                onClick={() => handleOpenConvertDialog(q)}
                                className="bg-cyan-600 hover:bg-cyan-700"
                                data-testid="convert-btn"
                              >
                                <ArrowRight className="w-4 h-4 mr-1" />
                                Convert
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Quotation Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedQuotation && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-muted-foreground text-sm">Quotation Number</p>
                  <p className="text-foreground font-mono text-lg">{selectedQuotation.quotation_number}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-muted-foreground text-sm">Status</p>
                  <Badge className={`${STATUS_CONFIG[selectedQuotation.status]?.color} text-foreground mt-1`}>
                    {STATUS_CONFIG[selectedQuotation.status]?.label}
                  </Badge>
                </div>
              </div>

              {/* Customer Details */}
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="text-foreground font-medium mb-3">Customer Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="text-foreground">{selectedQuotation.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <div className="flex items-center gap-2">
                      <p className="text-foreground">{selectedQuotation.customer_phone}</p>
                      {selectedQuotation.customer_phone && (
                        <ClickToCallButton 
                          phone={selectedQuotation.customer_phone}
                          customerName={selectedQuotation.customer_name}
                          showLabel={true}
                          size="sm"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="text-foreground">{selectedQuotation.customer_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">GSTIN</p>
                    <p className="text-foreground font-mono">{selectedQuotation.customer_gstin || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Address</p>
                    <p className="text-foreground">
                      {[selectedQuotation.customer_address, selectedQuotation.customer_city, 
                        selectedQuotation.customer_state, selectedQuotation.customer_pincode]
                        .filter(Boolean).join(', ') || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="text-foreground font-medium mb-3">Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Item</TableHead>
                      <TableHead className="text-muted-foreground text-right">Qty</TableHead>
                      <TableHead className="text-muted-foreground text-right">Rate</TableHead>
                      <TableHead className="text-muted-foreground text-right">GST</TableHead>
                      <TableHead className="text-muted-foreground text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedQuotation.items?.map((item, idx) => (
                      <TableRow key={idx} className="border-border">
                        <TableCell>
                          <p className="text-foreground">{item.name}</p>
                          <p className="text-muted-foreground text-xs">{item.sku_code}</p>
                        </TableCell>
                        <TableCell className="text-right text-foreground">{item.quantity}</TableCell>
                        <TableCell className="text-right text-foreground">{formatCurrency(item.rate)}</TableCell>
                        <TableCell className="text-right text-foreground">{item.gst_rate}%</TableCell>
                        <TableCell className="text-right text-foreground font-semibold">{formatCurrency(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Totals */}
                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedQuotation.subtotal)}</span>
                  </div>
                  {selectedQuotation.total_discount > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedQuotation.total_discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxable Value</span>
                    <span>{formatCurrency(selectedQuotation.taxable_value)}</span>
                  </div>
                  {selectedQuotation.is_inter_state ? (
                    <div className="flex justify-between text-muted-foreground">
                      <span>IGST</span>
                      <span>{formatCurrency(selectedQuotation.igst)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>CGST</span>
                        <span>{formatCurrency(selectedQuotation.cgst)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>SGST</span>
                        <span>{formatCurrency(selectedQuotation.sgst)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-xl font-bold text-foreground pt-2 border-t border-border">
                    <span>Grand Total</span>
                    <span>{formatCurrency(selectedQuotation.grand_total)}</span>
                  </div>
                </div>
              </div>

              {/* Audit Info */}
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="text-foreground font-medium mb-3">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Created</span>
                    <span>{formatDate(selectedQuotation.created_at)} by {selectedQuotation.created_by_name}</span>
                  </div>
                  {selectedQuotation.sent_at && (
                    <div className="flex justify-between text-blue-400">
                      <span>Sent</span>
                      <span>{formatDate(selectedQuotation.sent_at)}</span>
                    </div>
                  )}
                  {selectedQuotation.viewed_at && (
                    <div className="flex justify-between text-purple-400">
                      <span>First Viewed</span>
                      <span>{formatDate(selectedQuotation.viewed_at)} ({selectedQuotation.view_count} views)</span>
                    </div>
                  )}
                  {selectedQuotation.approved_at && (
                    <div className="flex justify-between text-green-400">
                      <span>Approved</span>
                      <span>{formatDate(selectedQuotation.approved_at)}</span>
                    </div>
                  )}
                  {selectedQuotation.rejected_at && (
                    <div className="flex justify-between text-red-400">
                      <span>Rejected</span>
                      <span>{formatDate(selectedQuotation.rejected_at)}</span>
                    </div>
                  )}
                  {selectedQuotation.converted_at && (
                    <div className="flex justify-between text-cyan-400">
                      <span>Converted ({selectedQuotation.conversion_type})</span>
                      <span>{formatDate(selectedQuotation.converted_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)} className="border-border text-muted-foreground">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-cyan-400" />
              Convert Quotation
            </DialogTitle>
          </DialogHeader>
          
          {selectedQuotation && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-muted-foreground text-sm">Quotation</p>
                <p className="text-foreground font-mono">{selectedQuotation.quotation_number}</p>
                <p className="text-muted-foreground text-sm mt-1">{selectedQuotation.customer_name}</p>
                <p className="text-cyan-400 font-semibold mt-1">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(selectedQuotation.grand_total || 0)}
                </p>
              </div>
              
              <div>
                <Label className="text-muted-foreground mb-3 block">Select Conversion Type</Label>
                <div className="space-y-2">
                  {CONVERSION_TYPES.map((type) => {
                    const TypeIcon = type.icon;
                    return (
                      <div
                        key={type.value}
                        onClick={() => setConvertType(type.value)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          convertType === type.value 
                            ? 'border-cyan-500 bg-cyan-900/30' 
                            : 'border-border bg-muted hover:border-border'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${type.color} flex items-center justify-center`}>
                            <TypeIcon className="w-5 h-5 text-foreground" />
                          </div>
                          <div className="flex-1">
                            <p className="text-foreground font-medium">{type.label}</p>
                            <p className="text-muted-foreground text-xs">{type.description}</p>
                          </div>
                          {convertType === type.value && (
                            <CheckCircle className="w-5 h-5 text-cyan-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {convertType === 'pending_fulfillment' && (
                <div className="p-3 bg-cyan-900/30 border border-cyan-700 rounded-lg">
                  <p className="text-cyan-300 text-sm">
                    <Package className="w-4 h-4 inline mr-1" />
                    <strong>Mandatory fields required:</strong> Invoice Number, Tracking ID, Shipping Label (PDF), Invoice (PDF). You'll be redirected to PI Pending Action page to complete the conversion.
                  </p>
                </div>
              )}
              
              <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                <p className="text-yellow-300 text-sm">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  This action will convert the quotation and cannot be undone. An incentive will be created for the agent who created this PI.
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConvertDialogOpen(false)} 
              className="border-border text-muted-foreground"
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConvert}
              disabled={actionLoading || !convertType}
              className="bg-cyan-600 hover:bg-cyan-700"
              data-testid="confirm-convert-btn"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              {convertType === 'pending_fulfillment' ? 'Go to PI Pending Action' : `Convert to ${convertType ? CONVERSION_TYPES.find(t => t.value === convertType)?.label.split(' ')[0] : '...'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

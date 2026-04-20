import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Mail, Inbox, RefreshCw, Eye, Ticket, Loader2, User, 
  Phone, MapPin, Package, Shield, Search, Plus, Check, X,
  Clock, AlertCircle, ArrowLeft, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';

const DEVICE_TYPES = ['Inverter', 'Battery', 'Stabilizer', 'Solar Panel', 'Servo', 'Others'];

export default function EmailTicketInbox() {
  const { token } = useAuth();
  
  // Email inbox state
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Selected email state
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailContent, setEmailContent] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  
  // AI suggestions state
  const [suggestions, setSuggestions] = useState(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  
  // Create ticket dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  
  // Customer search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [createNewCustomer, setCreateNewCustomer] = useState(false);
  
  // Product search state
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Warranty search state
  const [warrantySearch, setWarrantySearch] = useState('');
  const [warrantyResults, setWarrantyResults] = useState([]);
  const [warrantySearchLoading, setWarrantySearchLoading] = useState(false);
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [createNewWarranty, setCreateNewWarranty] = useState(false);
  
  // New customer form state
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });
  
  // Ticket form state
  const [ticketForm, setTicketForm] = useState({
    device_type: '',
    problem_description: '',
    order_id: ''
  });
  
  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    customer: true,
    product: false,
    warranty: false
  });

  // Auto-reply state
  const [autoReplyLoading, setAutoReplyLoading] = useState(false);
  const [showAutoReplyDialog, setShowAutoReplyDialog] = useState(false);
  const [missingFieldsSelection, setMissingFieldsSelection] = useState({
    phone: true,
    invoice: true,
    serial_number: false,
    order_id: false,
    address: false
  });

  // Fetch pending emails on mount
  useEffect(() => {
    fetchEmails();
  }, [token]);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/email/ticket-inbox`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 50 }
      });
      setEmails(response.data.emails || []);
    } catch (error) {
      console.error('Failed to fetch emails:', error);
      toast.error('Failed to load email inbox');
    } finally {
      setLoading(false);
    }
  };

  const refreshEmails = async () => {
    setRefreshing(true);
    await fetchEmails();
    setRefreshing(false);
    toast.success('Inbox refreshed');
  };

  const selectEmail = async (email) => {
    setSelectedEmail(email);
    setEmailContent(null);
    setSuggestions(null);
    setContentLoading(true);
    
    try {
      // Try to fetch full email content - include folder_id for proper API call
      let emailData = null;
      try {
        const params = email.folder_id ? `?folder_id=${email.folder_id}` : '';
        const contentRes = await axios.get(`${API}/email/inbox/${email.message_id}${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        emailData = contentRes.data;
        
        // Merge metadata from list response since content endpoint only returns body
        emailData = {
          ...emailData,
          from_address: emailData.from_address || email.from_address,
          subject: emailData.subject || email.subject,
          received_at: emailData.received_at || email.received_at,
        };
      } catch (contentError) {
        // If full content fails, use the summary we already have
        console.log('Full content not available, using summary');
        emailData = {
          message_id: email.message_id,
          from_address: email.from_address,
          subject: email.subject,
          body_text: email.summary || 'Email body not available - check the full email in Zoho Mail',
          received_at: email.received_at,
          content_limited: true
        };
      }
      setEmailContent(emailData);
      
      // Pre-fill form from email data
      setTicketForm(prev => ({
        ...prev,
        problem_description: emailData.subject || email.subject || '',
      }));
      
      // Pre-fill customer email
      setNewCustomerForm(prev => ({
        ...prev,
        email: email.from_address || '',
        name: email.from_name || ''
      }));
      setCreateNewCustomer(true);
      
      // Try to fetch AI suggestions
      setSuggestionsLoading(true);
      try {
        const suggestionsRes = await axios.get(`${API}/email/inbox/${email.message_id}/suggestions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuggestions(suggestionsRes.data);
        
        // Pre-fill form with suggestions
        if (suggestionsRes.data) {
          const s = suggestionsRes.data;
          setTicketForm({
            device_type: s.device_type || '',
            problem_description: s.parsed?.issue_description || emailData.subject || '',
            order_id: s.parsed?.order_id || ''
          });
          
          // Pre-fill customer if matched
          if (s.customer?.matched) {
            setSelectedCustomer(s.customer);
            setCreateNewCustomer(false);
          } else {
            setNewCustomerForm({
              name: s.customer?.name || email.from_name || '',
              phone: s.customer?.phone || s.parsed?.phone || '',
              email: email.from_address || '',
              address: ''
            });
            setCreateNewCustomer(true);
          }
          
          // Pre-select warranty if suggested
          if (s.suggested_warranties?.length > 0) {
            setWarrantyResults(s.suggested_warranties);
          }
        }
      } catch (suggestError) {
        console.log('Suggestions not available');
      }
    } catch (error) {
      console.error('Failed to load email:', error);
      // Still show the email with limited info
      setEmailContent({
        message_id: email.message_id,
        from_address: email.from_address,
        subject: email.subject,
        body_text: email.summary || 'Email content not available',
        received_at: email.received_at,
        content_limited: true
      });
    } finally {
      setContentLoading(false);
      setSuggestionsLoading(false);
    }
  };

  // Customer search
  const searchCustomers = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setCustomerResults([]);
      return;
    }
    
    setCustomerSearchLoading(true);
    try {
      // Use parties endpoint with search parameter
      const response = await axios.get(`${API}/parties`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { search: query, is_active: true }
      });
      // Parties API returns array directly
      const parties = response.data || [];
      setCustomerResults(parties.slice(0, 10));
    } catch (error) {
      console.error('Customer search failed:', error);
    } finally {
      setCustomerSearchLoading(false);
    }
  }, [token]);

  // Product search
  const searchProducts = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setProductResults([]);
      return;
    }
    
    setProductSearchLoading(true);
    try {
      const response = await axios.get(`${API}/master-skus`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { search: query }
      });
      const skus = response.data.skus || response.data || [];
      setProductResults(skus.slice(0, 10));
    } catch (error) {
      console.error('Product search failed:', error);
    } finally {
      setProductSearchLoading(false);
    }
  }, [token]);

  // Warranty search
  const searchWarranties = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setWarrantyResults([]);
      return;
    }
    
    setWarrantySearchLoading(true);
    try {
      const response = await axios.get(`${API}/warranties`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { search: query }
      });
      const warranties = response.data || [];
      setWarrantyResults(warranties.slice(0, 10));
    } catch (error) {
      console.error('Warranty search failed:', error);
    } finally {
      setWarrantySearchLoading(false);
    }
  }, [token]);

  // Create ticket from email
  const handleCreateTicket = async () => {
    if (!ticketForm.device_type) {
      toast.error('Please select a device type');
      return;
    }
    if (!ticketForm.problem_description) {
      toast.error('Please enter a problem description');
      return;
    }
    if (!selectedCustomer && !createNewCustomer) {
      toast.error('Please select or create a customer');
      return;
    }
    if (createNewCustomer && (!newCustomerForm.name || !newCustomerForm.phone)) {
      toast.error('Customer name and phone are required');
      return;
    }

    setCreateLoading(true);
    try {
      const formData = new FormData();
      formData.append('device_type', ticketForm.device_type);
      formData.append('problem_description', ticketForm.problem_description);
      
      if (ticketForm.order_id) {
        formData.append('order_id', ticketForm.order_id);
      }
      
      if (selectedCustomer) {
        formData.append('customer_id', selectedCustomer.id);
        formData.append('customer_name', selectedCustomer.name);
        formData.append('customer_phone', selectedCustomer.phone);
        formData.append('customer_email', selectedCustomer.email || '');
      } else if (createNewCustomer) {
        formData.append('customer_name', newCustomerForm.name);
        formData.append('customer_phone', newCustomerForm.phone);
        formData.append('customer_email', newCustomerForm.email);
        formData.append('customer_address', newCustomerForm.address);
      }
      
      if (selectedProduct) {
        formData.append('product_id', selectedProduct.id);
        formData.append('product_name', selectedProduct.name || selectedProduct.sku_name);
      }
      
      if (selectedWarranty) {
        formData.append('warranty_id', selectedWarranty.id);
        formData.append('warranty_number', selectedWarranty.warranty_number);
      }

      const response = await axios.post(
        `${API}/email/inbox/${selectedEmail.message_id}/create-ticket`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`Ticket ${response.data.ticket_number} created successfully!`);
      
      // Remove email from list
      setEmails(prev => prev.filter(e => e.message_id !== selectedEmail.message_id));
      
      // Reset state
      setSelectedEmail(null);
      setEmailContent(null);
      setSuggestions(null);
      setCreateDialogOpen(false);
      resetForm();
      
    } catch (error) {
      console.error('Failed to create ticket:', error);
      toast.error(error.response?.data?.detail || 'Failed to create ticket');
    } finally {
      setCreateLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setCreateNewCustomer(false);
    setSelectedProduct(null);
    setSelectedWarranty(null);
    setCreateNewWarranty(false);
    setCustomerSearch('');
    setProductSearch('');
    setWarrantySearch('');
    setCustomerResults([]);
    setProductResults([]);
    setWarrantyResults([]);
    setNewCustomerForm({ name: '', phone: '', email: '', address: '' });
    setTicketForm({ device_type: '', problem_description: '', order_id: '' });
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const sendAutoReply = async () => {
    if (!selectedEmail) return;
    
    // Get selected missing fields
    const selectedFields = Object.entries(missingFieldsSelection)
      .filter(([_, selected]) => selected)
      .map(([field]) => field);
    
    if (selectedFields.length === 0) {
      toast.error('Please select at least one missing field');
      return;
    }
    
    setAutoReplyLoading(true);
    try {
      const formData = new FormData();
      selectedFields.forEach(field => formData.append('missing_fields', field));
      
      const response = await axios.post(
        `${API}/email/inbox/${selectedEmail.message_id}/auto-reply`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success(`Auto-reply sent to ${selectedEmail.from_address}`);
        setShowAutoReplyDialog(false);
        // Optionally mark as read or move to another state
      } else {
        toast.error(response.data.error || 'Failed to send auto-reply');
      }
    } catch (error) {
      console.error('Auto-reply error:', error);
      toast.error(error.response?.data?.detail || 'Failed to send auto-reply');
    } finally {
      setAutoReplyLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    // Handle Unix timestamp in milliseconds
    let date;
    if (typeof dateStr === 'string' && dateStr.length > 10 && !dateStr.includes('-')) {
      // It's a Unix timestamp in milliseconds
      date = new Date(parseInt(dateStr, 10));
    } else if (typeof dateStr === 'number') {
      date = new Date(dateStr);
    } else {
      date = new Date(dateStr);
    }
    
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerSearch) searchCustomers(customerSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, searchCustomers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearch) searchProducts(productSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, searchProducts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (warrantySearch) searchWarranties(warrantySearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [warrantySearch, searchWarranties]);

  if (loading) {
    return (
      <DashboardLayout title="Email Ticket Inbox">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Email Ticket Inbox">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email List Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-blue-600" />
                  Pending Emails
                  <Badge variant="secondary">{emails.length}</Badge>
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={refreshEmails}
                  disabled={refreshing}
                  data-testid="refresh-inbox-btn"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Emails from service@musclegrid.in not yet converted to tickets
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {emails.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Mail className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No pending emails</p>
                  <p className="text-sm mt-1">All emails have been processed</p>
                </div>
              ) : (
                <div className="divide-y max-h-[calc(100vh-300px)] overflow-y-auto">
                  {emails.map((email) => (
                    <div
                      key={email.message_id}
                      className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 ${
                        selectedEmail?.message_id === email.message_id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                      onClick={() => selectEmail(email)}
                      data-testid={`email-item-${email.message_id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {email.from_name || email.from_address}
                          </p>
                          <p className="text-sm text-slate-600 truncate mt-0.5">
                            {email.subject || '(No Subject)'}
                          </p>
                          <p className="text-xs text-slate-400 mt-1 truncate">
                            {email.summary}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs text-slate-500">
                            {formatDate(email.received_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Email Content & Ticket Creation Panel */}
        <div className="lg:col-span-2">
          {!selectedEmail ? (
            <Card>
              <CardContent className="py-16 text-center text-slate-500">
                <Mail className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-medium">Select an email to review</p>
                <p className="text-sm mt-2">
                  Click on an email from the left panel to view its contents and create a support ticket
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Email Content Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Mail className="w-5 h-5 text-blue-600" />
                      Email Details
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedEmail(null)}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {contentLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  ) : emailContent ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">From</p>
                          <p className="font-medium">{emailContent.from_address}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Received</p>
                          <p className="font-medium">{formatDate(emailContent.received_at || selectedEmail.received_at)}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-500 text-sm">Subject</p>
                        <p className="font-medium">{emailContent.subject}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-sm mb-2">Email Body</p>
                        {emailContent.content_limited && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3 text-sm text-yellow-800">
                            <p className="font-medium">Limited content available</p>
                            <p className="text-xs mt-1">Full email body requires extended API access. Using email summary.</p>
                          </div>
                        )}
                        <div 
                          className="bg-slate-50 p-4 rounded-lg text-sm max-h-64 overflow-y-auto"
                          style={{ color: '#334155' }}
                        >
                          {emailContent.body_html ? (
                            <div 
                              dangerouslySetInnerHTML={{ __html: emailContent.body_html }}
                              className="email-content"
                              style={{ 
                                color: '#334155', 
                                fontSize: '14px',
                                lineHeight: '1.6'
                              }}
                            />
                          ) : emailContent.body_text ? (
                            <p className="whitespace-pre-wrap">{emailContent.body_text}</p>
                          ) : emailContent.content ? (
                            <div 
                              dangerouslySetInnerHTML={{ __html: emailContent.content }}
                              style={{ color: '#334155' }}
                            />
                          ) : (
                            <p className="text-slate-500 italic">No content available</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Request More Info Button */}
                      <div className="pt-4 border-t mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-amber-600 border-amber-300 hover:bg-amber-50"
                          onClick={() => setShowAutoReplyDialog(true)}
                          data-testid="request-more-info-btn"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Request Missing Info
                        </Button>
                        <p className="text-xs text-slate-500 mt-1">
                          Send auto-reply asking for phone number, invoice copy, etc.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-4">Failed to load email content</p>
                  )}
                </CardContent>
              </Card>

              {/* AI Suggestions Card */}
              {suggestionsLoading ? (
                <Card>
                  <CardContent className="py-6">
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Analyzing email...</span>
                    </div>
                  </CardContent>
                </Card>
              ) : suggestions && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-blue-800">
                      <AlertCircle className="w-4 h-4" />
                      AI Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {suggestions.device_type && (
                        <div>
                          <p className="text-blue-600 text-xs">Detected Device</p>
                          <p className="font-medium">{suggestions.device_type}</p>
                        </div>
                      )}
                      {suggestions.customer?.matched && (
                        <div>
                          <p className="text-blue-600 text-xs">Customer Found</p>
                          <p className="font-medium text-green-700">{suggestions.customer.name}</p>
                        </div>
                      )}
                      {suggestions.parsed?.order_id && (
                        <div>
                          <p className="text-blue-600 text-xs">Order ID</p>
                          <p className="font-medium font-mono">{suggestions.parsed.order_id}</p>
                        </div>
                      )}
                      {suggestions.suggested_warranties?.length > 0 && (
                        <div>
                          <p className="text-blue-600 text-xs">Warranties Found</p>
                          <p className="font-medium text-green-700">{suggestions.suggested_warranties.length} match(es)</p>
                        </div>
                      )}
                    </div>
                    {suggestions.existing_ticket && (
                      <div className="mt-3 p-2 bg-yellow-100 rounded-lg text-yellow-800">
                        <p className="font-medium">Ticket already exists from this email!</p>
                        <p className="text-xs">Ticket: {suggestions.existing_ticket.ticket_number}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Create Ticket Form */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-green-600" />
                    Create Support Ticket
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Basic Ticket Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Device Type *</Label>
                      <Select 
                        value={ticketForm.device_type} 
                        onValueChange={(v) => setTicketForm(prev => ({ ...prev, device_type: v }))}
                      >
                        <SelectTrigger data-testid="device-type-select">
                          <SelectValue placeholder="Select device type" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEVICE_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Order ID (optional)</Label>
                      <Input
                        placeholder="e.g., AMZ-123456"
                        value={ticketForm.order_id}
                        onChange={(e) => setTicketForm(prev => ({ ...prev, order_id: e.target.value }))}
                        data-testid="order-id-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Problem Description *</Label>
                    <Textarea
                      placeholder="Describe the customer's issue..."
                      value={ticketForm.problem_description}
                      onChange={(e) => setTicketForm(prev => ({ ...prev, problem_description: e.target.value }))}
                      rows={3}
                      data-testid="problem-description-input"
                    />
                  </div>

                  {/* Customer Section */}
                  <div className="border rounded-lg">
                    <button
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50"
                      onClick={() => toggleSection('customer')}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-purple-600" />
                        <span className="font-medium">Customer Information *</span>
                        {selectedCustomer && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 ml-2">
                            <Check className="w-3 h-3 mr-1" />
                            {selectedCustomer.name || selectedCustomer.party_name}
                          </Badge>
                        )}
                        {createNewCustomer && newCustomerForm.name && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 ml-2">
                            <Plus className="w-3 h-3 mr-1" />
                            New: {newCustomerForm.name}
                          </Badge>
                        )}
                      </div>
                      {expandedSections.customer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    
                    {expandedSections.customer && (
                      <div className="p-4 pt-0 space-y-4 border-t">
                        <Tabs 
                          value={createNewCustomer ? 'new' : 'existing'} 
                          onValueChange={(v) => {
                            setCreateNewCustomer(v === 'new');
                            if (v === 'new') setSelectedCustomer(null);
                          }}
                        >
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="existing">Find Existing</TabsTrigger>
                            <TabsTrigger value="new">Create New</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="existing" className="mt-4 space-y-3">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input
                                placeholder="Search by name, phone, or email..."
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                className="pl-10"
                                data-testid="customer-search-input"
                              />
                            </div>
                            
                            {customerSearchLoading && (
                              <div className="flex items-center gap-2 text-slate-500 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Searching...
                              </div>
                            )}
                            
                            {customerResults.length > 0 && (
                              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                                {customerResults.map((customer) => (
                                  <div
                                    key={customer.id}
                                    className={`p-3 cursor-pointer hover:bg-slate-50 ${
                                      selectedCustomer?.id === customer.id ? 'bg-green-50 border-l-4 border-green-600' : ''
                                    }`}
                                    onClick={() => {
                                      setSelectedCustomer(customer);
                                      setCustomerResults([]);
                                      setCustomerSearch('');
                                    }}
                                    data-testid={`customer-result-${customer.id}`}
                                  >
                                    <p className="font-medium text-sm">{customer.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {customer.phone} | {customer.email || 'No email'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {selectedCustomer && (
                              <div className="bg-green-50 p-3 rounded-lg flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{selectedCustomer.name}</p>
                                  <p className="text-xs text-slate-600">
                                    {selectedCustomer.phone} | {selectedCustomer.email || 'No email'}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedCustomer(null)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="new" className="mt-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Name *</Label>
                                <Input
                                  placeholder="Customer name"
                                  value={newCustomerForm.name}
                                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, name: e.target.value }))}
                                  data-testid="new-customer-name"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Phone *</Label>
                                <Input
                                  placeholder="10-digit phone"
                                  value={newCustomerForm.phone}
                                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, phone: e.target.value }))}
                                  data-testid="new-customer-phone"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Email</Label>
                                <Input
                                  placeholder="Email address"
                                  value={newCustomerForm.email}
                                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, email: e.target.value }))}
                                  data-testid="new-customer-email"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Address</Label>
                                <Input
                                  placeholder="Address"
                                  value={newCustomerForm.address}
                                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, address: e.target.value }))}
                                  data-testid="new-customer-address"
                                />
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                  </div>

                  {/* Product Section */}
                  <div className="border rounded-lg">
                    <button
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50"
                      onClick={() => toggleSection('product')}
                    >
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-orange-600" />
                        <span className="font-medium">Product (Optional)</span>
                        {selectedProduct && (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 ml-2">
                            <Check className="w-3 h-3 mr-1" />
                            {selectedProduct.name || selectedProduct.sku_name}
                          </Badge>
                        )}
                      </div>
                      {expandedSections.product ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    
                    {expandedSections.product && (
                      <div className="p-4 pt-0 space-y-3 border-t">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            placeholder="Search products by name or SKU..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="pl-10"
                            data-testid="product-search-input"
                          />
                        </div>
                        
                        {productSearchLoading && (
                          <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Searching...
                          </div>
                        )}
                        
                        {productResults.length > 0 && (
                          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                            {productResults.map((product) => (
                              <div
                                key={product.id}
                                className={`p-3 cursor-pointer hover:bg-slate-50 ${
                                  selectedProduct?.id === product.id ? 'bg-orange-50 border-l-4 border-orange-600' : ''
                                }`}
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setProductResults([]);
                                  setProductSearch('');
                                }}
                                data-testid={`product-result-${product.id}`}
                              >
                                <p className="font-medium text-sm">{product.name || product.sku_name}</p>
                                <p className="text-xs text-slate-500">{product.sku_code || product.code}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {selectedProduct && (
                          <div className="bg-orange-50 p-3 rounded-lg flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{selectedProduct.name || selectedProduct.sku_name}</p>
                              <p className="text-xs text-slate-600">{selectedProduct.sku_code || selectedProduct.code}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedProduct(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Warranty Section */}
                  <div className="border rounded-lg">
                    <button
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50"
                      onClick={() => toggleSection('warranty')}
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-green-600" />
                        <span className="font-medium">Warranty (Optional)</span>
                        {selectedWarranty && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 ml-2">
                            <Check className="w-3 h-3 mr-1" />
                            {selectedWarranty.warranty_number}
                          </Badge>
                        )}
                        {suggestions?.suggested_warranties?.length > 0 && !selectedWarranty && (
                          <Badge variant="secondary" className="ml-2">
                            {suggestions.suggested_warranties.length} suggested
                          </Badge>
                        )}
                      </div>
                      {expandedSections.warranty ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    
                    {expandedSections.warranty && (
                      <div className="p-4 pt-0 space-y-3 border-t">
                        {/* Auto-suggested warranties */}
                        {suggestions?.suggested_warranties?.length > 0 && !selectedWarranty && (
                          <div className="mb-3">
                            <p className="text-xs text-green-700 mb-2 font-medium">Suggested Warranties (based on customer email):</p>
                            <div className="border rounded-lg divide-y">
                              {suggestions.suggested_warranties.map((warranty) => (
                                <div
                                  key={warranty.id}
                                  className="p-3 cursor-pointer hover:bg-green-50"
                                  onClick={() => setSelectedWarranty(warranty)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium text-sm">{warranty.warranty_number}</p>
                                      <p className="text-xs text-slate-500">
                                        {warranty.device_type} | Expires: {warranty.warranty_end_date ? new Date(warranty.warranty_end_date).toLocaleDateString() : 'N/A'}
                                      </p>
                                    </div>
                                    <Badge variant={warranty.status === 'approved' ? 'default' : 'secondary'}>
                                      {warranty.status}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            placeholder="Search warranty by number or serial..."
                            value={warrantySearch}
                            onChange={(e) => setWarrantySearch(e.target.value)}
                            className="pl-10"
                            data-testid="warranty-search-input"
                          />
                        </div>
                        
                        {warrantySearchLoading && (
                          <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Searching...
                          </div>
                        )}
                        
                        {warrantyResults.length > 0 && warrantySearch && (
                          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                            {warrantyResults.map((warranty) => (
                              <div
                                key={warranty.id}
                                className={`p-3 cursor-pointer hover:bg-slate-50 ${
                                  selectedWarranty?.id === warranty.id ? 'bg-green-50 border-l-4 border-green-600' : ''
                                }`}
                                onClick={() => {
                                  setSelectedWarranty(warranty);
                                  setWarrantyResults([]);
                                  setWarrantySearch('');
                                }}
                                data-testid={`warranty-result-${warranty.id}`}
                              >
                                <p className="font-medium text-sm">{warranty.warranty_number}</p>
                                <p className="text-xs text-slate-500">
                                  {warranty.device_type} | {warranty.customer_name}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {selectedWarranty && (
                          <div className="bg-green-50 p-3 rounded-lg flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{selectedWarranty.warranty_number}</p>
                              <p className="text-xs text-slate-600">
                                {selectedWarranty.device_type} | Expires: {selectedWarranty.warranty_end_date ? new Date(selectedWarranty.warranty_end_date).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedWarranty(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedEmail(null);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleCreateTicket}
                      disabled={createLoading}
                      data-testid="create-ticket-btn"
                    >
                      {createLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Ticket className="w-4 h-4 mr-2" />
                      )}
                      Create Ticket
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Auto-Reply Dialog */}
      <Dialog open={showAutoReplyDialog} onOpenChange={setShowAutoReplyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-600" />
              Request Missing Information
            </DialogTitle>
            <DialogDescription>
              Send an automated reply to the customer requesting the information needed to create a support ticket.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">
              To: <strong>{selectedEmail?.from_address}</strong>
            </p>
            
            <div className="space-y-3">
              <p className="text-sm font-medium">Select information to request:</p>
              
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={missingFieldsSelection.phone}
                  onChange={(e) => setMissingFieldsSelection(prev => ({ ...prev, phone: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <div>
                  <p className="font-medium text-sm">Phone Number</p>
                  <p className="text-xs text-slate-500">10-digit contact number</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={missingFieldsSelection.invoice}
                  onChange={(e) => setMissingFieldsSelection(prev => ({ ...prev, invoice: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <div>
                  <p className="font-medium text-sm">Invoice/Bill Copy</p>
                  <p className="text-xs text-slate-500">PDF or image of purchase invoice</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={missingFieldsSelection.serial_number}
                  onChange={(e) => setMissingFieldsSelection(prev => ({ ...prev, serial_number: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <div>
                  <p className="font-medium text-sm">Serial Number</p>
                  <p className="text-xs text-slate-500">Product serial from label</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={missingFieldsSelection.order_id}
                  onChange={(e) => setMissingFieldsSelection(prev => ({ ...prev, order_id: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <div>
                  <p className="font-medium text-sm">Order ID</p>
                  <p className="text-xs text-slate-500">Amazon/Flipkart order number</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={missingFieldsSelection.address}
                  onChange={(e) => setMissingFieldsSelection(prev => ({ ...prev, address: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <div>
                  <p className="font-medium text-sm">Complete Address</p>
                  <p className="text-xs text-slate-500">For pickup/delivery</p>
                </div>
              </label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoReplyDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={sendAutoReply}
              disabled={autoReplyLoading || !Object.values(missingFieldsSelection).some(v => v)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {autoReplyLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Send Auto-Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

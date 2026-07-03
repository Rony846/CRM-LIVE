import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import {
  Mail, Inbox, RefreshCw, Ticket, Loader2, User,
  Package, Shield, Search, Plus, Check, X,
  AlertCircle, ArrowLeft, ChevronDown, ChevronUp
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

// Sanitize email HTML before rendering. Inbound email is attacker-controllable
// and was previously injected into the support agent's admin session via
// dangerouslySetInnerHTML — XSS in a privileged context.
const sanitizeEmailHtml = (html) =>
  DOMPurify.sanitize(html || '', {
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'meta', 'base', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus',
                  'onmouseenter', 'onmouseleave', 'onsubmit', 'srcdoc'],
    ALLOW_DATA_ATTR: false,
  });

const DEVICE_TYPES = ['Inverter', 'Battery', 'Stabilizer', 'Solar Panel', 'Servo', 'Others'];

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

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

  const sectionShell = { border: `1px solid ${T.iron200}`, borderRadius: 8, overflow: 'hidden', background: T.white };
  const sectionBtn = { width: '100%', padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: T.iron900, fontFamily: T.body };

  if (loading) {
    return (
      <IronShell title="Email Inbox" subtitle="SERVICE@MUSCLEGRID.IN" onRefresh={refreshEmails}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: T.orange }} />
        </div>
      </IronShell>
    );
  }

  return (
    <IronShell
      title="Email Inbox"
      subtitle="SERVICE@MUSCLEGRID.IN"
      onRefresh={refreshEmails}
      headerRight={
        <button onClick={refreshEmails} disabled={refreshing} style={outlineBtn}>
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18, alignItems: 'start' }}>
        {/* Email List Panel */}
        <IronCard pad={0}>
          <div style={{ padding: 14, borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Inbox size={16} style={{ color: T.orange }} />
                <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>Pending Emails</span>
                <span style={{ ...badgeStyle('slate'), ...mono }}>{emails.length}</span>
              </div>
              <button
                onClick={refreshEmails}
                disabled={refreshing}
                data-testid="refresh-inbox-btn"
                style={{ ...outlineBtn, padding: 7 }}
                title="Refresh"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: T.iron500, marginTop: 6 }}>
              Emails from service@musclegrid.in not yet converted to tickets
            </p>
          </div>

          {emails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: T.iron500 }}>
              <Mail className="w-12 h-12 mx-auto mb-3" style={{ color: T.iron200 }} />
              <p style={{ fontSize: 13 }}>No pending emails</p>
              <p style={{ fontSize: 11.5, marginTop: 4, color: T.iron400 }}>All emails have been processed</p>
            </div>
          ) : (
            <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
              {emails.map((email) => {
                const active = selectedEmail?.message_id === email.message_id;
                return (
                  <div
                    key={email.message_id}
                    className="iron-row"
                    style={{
                      padding: 14, cursor: 'pointer', borderBottom: `1px solid ${T.iron200}`,
                      borderLeft: active ? `4px solid ${T.orange}` : '4px solid transparent',
                      background: active ? '#FDEEE6' : T.white,
                    }}
                    onClick={() => selectEmail(email)}
                    data-testid={`email-item-${email.message_id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, color: T.iron900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {email.from_name || email.from_address}
                        </p>
                        <p style={{ fontSize: 12, color: T.iron700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {email.subject || '(No Subject)'}
                        </p>
                        <p style={{ fontSize: 11, color: T.iron400, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {email.summary}
                        </p>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <p style={{ ...mono, fontSize: 10.5, color: T.iron500 }}>
                          {formatDate(email.received_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </IronCard>

        {/* Email Content & Ticket Creation Panel */}
        <div>
          {!selectedEmail ? (
            <IronCard>
              <div style={{ padding: '64px 16px', textAlign: 'center', color: T.iron500 }}>
                <Mail className="w-16 h-16 mx-auto mb-4" style={{ color: T.iron200 }} />
                <p style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 17, color: T.iron700 }}>Select an email to review</p>
                <p style={{ fontSize: 12.5, marginTop: 8 }}>
                  Click on an email from the left panel to view its contents and create a support ticket
                </p>
              </div>
            </IronCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Email Content Card */}
              <IronCard pad={0}>
                <div style={{ padding: 14, borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mail size={17} style={{ color: T.orange }} />
                    <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>Email Details</span>
                  </div>
                  <button onClick={() => setSelectedEmail(null)} style={outlineBtn}>
                    <ArrowLeft size={14} /> Back
                  </button>
                </div>
                <div style={{ padding: 16 }}>
                  {contentLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: T.orange }} />
                    </div>
                  ) : emailContent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                          <Caps size={9}>From</Caps>
                          <p style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900, marginTop: 3 }}>{emailContent.from_address}</p>
                        </div>
                        <div>
                          <Caps size={9}>Received</Caps>
                          <p style={{ ...mono, fontSize: 12.5, color: T.iron900, marginTop: 3 }}>{formatDate(emailContent.received_at || selectedEmail.received_at)}</p>
                        </div>
                      </div>
                      <div>
                        <Caps size={9}>Subject</Caps>
                        <p style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13.5, color: T.iron900, marginTop: 3 }}>{emailContent.subject}</p>
                      </div>
                      <div>
                        <Caps size={9} style={{ display: 'block', marginBottom: 8 }}>Email Body</Caps>
                        {emailContent.content_limited && (
                          <div style={{ background: T.voltageTint, border: `1px solid #EDDFA6`, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12.5, color: T.voltageText }}>
                            <p style={{ fontWeight: 700 }}>Limited content available</p>
                            <p style={{ fontSize: 11, marginTop: 4 }}>Full email body requires extended API access. Using email summary.</p>
                          </div>
                        )}
                        <div
                          style={{ background: T.iron50, border: `1px solid ${T.iron200}`, padding: 16, borderRadius: 8, fontSize: 13, maxHeight: 256, overflowY: 'auto', color: '#334155' }}
                        >
                          {emailContent.body_html ? (
                            <div
                              dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(emailContent.body_html) }}
                              className="email-content"
                              style={{ color: '#334155', fontSize: '14px', lineHeight: '1.6' }}
                            />
                          ) : emailContent.body_text ? (
                            <p style={{ whiteSpace: 'pre-wrap' }}>{emailContent.body_text}</p>
                          ) : emailContent.content ? (
                            <div
                              dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(emailContent.content) }}
                              style={{ color: '#334155' }}
                            />
                          ) : (
                            <p style={{ color: T.iron400, fontStyle: 'italic' }}>No content available</p>
                          )}
                        </div>
                      </div>

                      {/* Request More Info Button */}
                      <div style={{ paddingTop: 16, borderTop: `1px solid ${T.iron200}`, marginTop: 4 }}>
                        <button
                          onClick={() => setShowAutoReplyDialog(true)}
                          data-testid="request-more-info-btn"
                          style={{ ...outlineBtn, color: T.voltageText, borderColor: '#EDDFA6' }}
                        >
                          <Mail size={14} /> Request Missing Info
                        </button>
                        <p style={{ fontSize: 11, color: T.iron500, marginTop: 6 }}>
                          Send auto-reply asking for phone number, invoice copy, etc.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: T.iron500, textAlign: 'center', padding: 16 }}>Failed to load email content</p>
                  )}
                </div>
              </IronCard>

              {/* AI Suggestions Card */}
              {suggestionsLoading ? (
                <IronCard>
                  <div style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: T.orange }}>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span style={{ fontSize: 13 }}>Analyzing email...</span>
                  </div>
                </IronCard>
              ) : suggestions && (
                <IronCard style={{ borderColor: '#F6D8BA', background: '#FDEEE6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <AlertCircle size={15} style={{ color: T.orangeDeep }} />
                    <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.orangeDeep }}>AI Analysis</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14, fontSize: 13 }}>
                    {suggestions.device_type && (
                      <div>
                        <Caps size={8.5} color={T.orangeDeep}>Detected Device</Caps>
                        <p style={{ fontWeight: 600, marginTop: 3 }}>{suggestions.device_type}</p>
                      </div>
                    )}
                    {suggestions.customer?.matched && (
                      <div>
                        <Caps size={8.5} color={T.orangeDeep}>Customer Found</Caps>
                        <p style={{ fontWeight: 600, color: T.green, marginTop: 3 }}>{suggestions.customer.name}</p>
                      </div>
                    )}
                    {suggestions.parsed?.order_id && (
                      <div>
                        <Caps size={8.5} color={T.orangeDeep}>Order ID</Caps>
                        <p style={{ ...mono, fontWeight: 600, marginTop: 3 }}>{suggestions.parsed.order_id}</p>
                      </div>
                    )}
                    {suggestions.suggested_warranties?.length > 0 && (
                      <div>
                        <Caps size={8.5} color={T.orangeDeep}>Warranties Found</Caps>
                        <p style={{ fontWeight: 600, color: T.green, marginTop: 3 }}>{suggestions.suggested_warranties.length} match(es)</p>
                      </div>
                    )}
                  </div>
                  {suggestions.existing_ticket && (
                    <div style={{ marginTop: 12, padding: 8, background: T.voltageTint, borderRadius: 8, color: T.voltageText }}>
                      <p style={{ fontWeight: 700 }}>Ticket already exists from this email!</p>
                      <p style={{ ...mono, fontSize: 11 }}>Ticket: {suggestions.existing_ticket.ticket_number}</p>
                    </div>
                  )}
                </IronCard>
              )}

              {/* Create Ticket Form */}
              <IronCard pad={0}>
                <div style={{ padding: 14, borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Ticket size={17} style={{ color: T.green }} />
                  <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>Create Support Ticket</span>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Basic Ticket Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Label>Order ID (optional)</Label>
                      <Input
                        placeholder="e.g., AMZ-123456"
                        value={ticketForm.order_id}
                        onChange={(e) => setTicketForm(prev => ({ ...prev, order_id: e.target.value }))}
                        data-testid="order-id-input"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                  <div style={sectionShell}>
                    <button style={sectionBtn} onClick={() => toggleSection('customer')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <User size={17} style={{ color: '#6D4AB0' }} />
                        <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13 }}>Customer Information *</span>
                        {selectedCustomer && (
                          <span style={{ ...badgeStyle('ok'), marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Check className="w-3 h-3" />
                            {selectedCustomer.name || selectedCustomer.party_name}
                          </span>
                        )}
                        {createNewCustomer && newCustomerForm.name && (
                          <span style={{ ...badgeStyle('info'), marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Plus className="w-3 h-3" />
                            New: {newCustomerForm.name}
                          </span>
                        )}
                      </div>
                      {expandedSections.customer ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {expandedSections.customer && (
                      <div style={{ padding: 14, paddingTop: 0, borderTop: `1px solid ${T.iron200}` }}>
                        <Tabs
                          value={createNewCustomer ? 'new' : 'existing'}
                          onValueChange={(v) => {
                            setCreateNewCustomer(v === 'new');
                            if (v === 'new') setSelectedCustomer(null);
                          }}
                        >
                          <TabsList className="grid w-full grid-cols-2" style={{ marginTop: 14 }}>
                            <TabsTrigger value="existing">Find Existing</TabsTrigger>
                            <TabsTrigger value="new">Create New</TabsTrigger>
                          </TabsList>

                          <TabsContent value="existing" className="mt-4 space-y-3">
                            <div style={{ position: 'relative' }}>
                              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.iron400 }} />
                              <input
                                placeholder="Search by name, phone, or email..."
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                style={{ ...inputStyle, paddingLeft: 32 }}
                                data-testid="customer-search-input"
                              />
                            </div>

                            {customerSearchLoading && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.iron500, fontSize: 12.5 }}>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Searching...
                              </div>
                            )}

                            {customerResults.length > 0 && (
                              <div style={{ border: `1px solid ${T.iron200}`, borderRadius: 8, maxHeight: 192, overflowY: 'auto' }}>
                                {customerResults.map((customer) => (
                                  <div
                                    key={customer.id}
                                    className="iron-row"
                                    style={{
                                      padding: 12, cursor: 'pointer', borderBottom: `1px solid ${T.iron200}`,
                                      borderLeft: selectedCustomer?.id === customer.id ? `4px solid ${T.green}` : '4px solid transparent',
                                      background: selectedCustomer?.id === customer.id ? T.greenTint : T.white,
                                    }}
                                    onClick={() => {
                                      setSelectedCustomer(customer);
                                      setCustomerResults([]);
                                      setCustomerSearch('');
                                    }}
                                    data-testid={`customer-result-${customer.id}`}
                                  >
                                    <p style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12.5 }}>{customer.name}</p>
                                    <p style={{ ...mono, fontSize: 11, color: T.iron500 }}>
                                      {customer.phone} | {customer.email || 'No email'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {selectedCustomer && (
                              <div style={{ background: T.greenTint, padding: 12, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                  <p style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12.5 }}>{selectedCustomer.name}</p>
                                  <p style={{ ...mono, fontSize: 11, color: T.iron700 }}>
                                    {selectedCustomer.phone} | {selectedCustomer.email || 'No email'}
                                  </p>
                                </div>
                                <button onClick={() => setSelectedCustomer(null)} style={{ ...outlineBtn, padding: 6, background: 'transparent', border: 'none' }}>
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="new" className="mt-4 space-y-3">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <Label className="text-xs">Name *</Label>
                                <Input
                                  placeholder="Customer name"
                                  value={newCustomerForm.name}
                                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, name: e.target.value }))}
                                  data-testid="new-customer-name"
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <Label className="text-xs">Phone *</Label>
                                <Input
                                  placeholder="10-digit phone"
                                  value={newCustomerForm.phone}
                                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, phone: e.target.value }))}
                                  data-testid="new-customer-phone"
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <Label className="text-xs">Email</Label>
                                <Input
                                  placeholder="Email address"
                                  value={newCustomerForm.email}
                                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, email: e.target.value }))}
                                  data-testid="new-customer-email"
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                  <div style={sectionShell}>
                    <button style={sectionBtn} onClick={() => toggleSection('product')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Package size={17} style={{ color: T.orange }} />
                        <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13 }}>Product (Optional)</span>
                        {selectedProduct && (
                          <span style={{ ...badgeStyle('bad'), marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Check className="w-3 h-3" />
                            {selectedProduct.name || selectedProduct.sku_name}
                          </span>
                        )}
                      </div>
                      {expandedSections.product ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {expandedSections.product && (
                      <div style={{ padding: 14, paddingTop: 14, borderTop: `1px solid ${T.iron200}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ position: 'relative' }}>
                          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.iron400 }} />
                          <input
                            placeholder="Search products by name or SKU..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: 32 }}
                            data-testid="product-search-input"
                          />
                        </div>

                        {productSearchLoading && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.iron500, fontSize: 12.5 }}>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Searching...
                          </div>
                        )}

                        {productResults.length > 0 && (
                          <div style={{ border: `1px solid ${T.iron200}`, borderRadius: 8, maxHeight: 192, overflowY: 'auto' }}>
                            {productResults.map((product) => (
                              <div
                                key={product.id}
                                className="iron-row"
                                style={{
                                  padding: 12, cursor: 'pointer', borderBottom: `1px solid ${T.iron200}`,
                                  borderLeft: selectedProduct?.id === product.id ? `4px solid ${T.orange}` : '4px solid transparent',
                                  background: selectedProduct?.id === product.id ? '#FDEEE6' : T.white,
                                }}
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setProductResults([]);
                                  setProductSearch('');
                                }}
                                data-testid={`product-result-${product.id}`}
                              >
                                <p style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12.5 }}>{product.name || product.sku_name}</p>
                                <p style={{ ...mono, fontSize: 11, color: T.iron500 }}>{product.sku_code || product.code}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {selectedProduct && (
                          <div style={{ background: '#FDEEE6', padding: 12, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <p style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12.5 }}>{selectedProduct.name || selectedProduct.sku_name}</p>
                              <p style={{ ...mono, fontSize: 11, color: T.iron700 }}>{selectedProduct.sku_code || selectedProduct.code}</p>
                            </div>
                            <button onClick={() => setSelectedProduct(null)} style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: T.iron700 }}>
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Warranty Section */}
                  <div style={sectionShell}>
                    <button style={sectionBtn} onClick={() => toggleSection('warranty')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Shield size={17} style={{ color: T.green }} />
                        <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13 }}>Warranty (Optional)</span>
                        {selectedWarranty && (
                          <span style={{ ...badgeStyle('ok'), marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Check className="w-3 h-3" />
                            {selectedWarranty.warranty_number}
                          </span>
                        )}
                        {suggestions?.suggested_warranties?.length > 0 && !selectedWarranty && (
                          <span style={{ ...badgeStyle('slate'), marginLeft: 8 }}>
                            {suggestions.suggested_warranties.length} suggested
                          </span>
                        )}
                      </div>
                      {expandedSections.warranty ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {expandedSections.warranty && (
                      <div style={{ padding: 14, paddingTop: 14, borderTop: `1px solid ${T.iron200}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Auto-suggested warranties */}
                        {suggestions?.suggested_warranties?.length > 0 && !selectedWarranty && (
                          <div>
                            <p style={{ fontSize: 11, color: T.green, marginBottom: 8, fontWeight: 700 }}>Suggested Warranties (based on customer email):</p>
                            <div style={{ border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                              {suggestions.suggested_warranties.map((warranty) => (
                                <div
                                  key={warranty.id}
                                  className="iron-row"
                                  style={{ padding: 12, cursor: 'pointer', borderBottom: `1px solid ${T.iron200}` }}
                                  onClick={() => setSelectedWarranty(warranty)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                      <p style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12.5 }}>{warranty.warranty_number}</p>
                                      <p style={{ fontSize: 11, color: T.iron500 }}>
                                        {warranty.device_type} | Expires: {warranty.warranty_end_date ? new Date(warranty.warranty_end_date).toLocaleDateString() : 'N/A'}
                                      </p>
                                    </div>
                                    <span style={badgeStyle(warranty.status === 'approved' ? 'ok' : 'slate')}>
                                      {warranty.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{ position: 'relative' }}>
                          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.iron400 }} />
                          <input
                            placeholder="Search warranty by number or serial..."
                            value={warrantySearch}
                            onChange={(e) => setWarrantySearch(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: 32 }}
                            data-testid="warranty-search-input"
                          />
                        </div>

                        {warrantySearchLoading && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.iron500, fontSize: 12.5 }}>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Searching...
                          </div>
                        )}

                        {warrantyResults.length > 0 && warrantySearch && (
                          <div style={{ border: `1px solid ${T.iron200}`, borderRadius: 8, maxHeight: 192, overflowY: 'auto' }}>
                            {warrantyResults.map((warranty) => (
                              <div
                                key={warranty.id}
                                className="iron-row"
                                style={{
                                  padding: 12, cursor: 'pointer', borderBottom: `1px solid ${T.iron200}`,
                                  borderLeft: selectedWarranty?.id === warranty.id ? `4px solid ${T.green}` : '4px solid transparent',
                                  background: selectedWarranty?.id === warranty.id ? T.greenTint : T.white,
                                }}
                                onClick={() => {
                                  setSelectedWarranty(warranty);
                                  setWarrantyResults([]);
                                  setWarrantySearch('');
                                }}
                                data-testid={`warranty-result-${warranty.id}`}
                              >
                                <p style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12.5 }}>{warranty.warranty_number}</p>
                                <p style={{ fontSize: 11, color: T.iron500 }}>
                                  {warranty.device_type} | {warranty.customer_name}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {selectedWarranty && (
                          <div style={{ background: T.greenTint, padding: 12, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <p style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12.5 }}>{selectedWarranty.warranty_number}</p>
                              <p style={{ fontSize: 11, color: T.iron700 }}>
                                {selectedWarranty.device_type} | Expires: {selectedWarranty.warranty_end_date ? new Date(selectedWarranty.warranty_end_date).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                            <button onClick={() => setSelectedWarranty(null)} style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: T.iron700 }}>
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 16, borderTop: `1px solid ${T.iron200}` }}>
                    <button
                      style={outlineBtn}
                      onClick={() => {
                        setSelectedEmail(null);
                        resetForm();
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      style={{ ...primaryBtn, background: T.green, opacity: createLoading ? 0.7 : 1 }}
                      onClick={handleCreateTicket}
                      disabled={createLoading}
                      data-testid="create-ticket-btn"
                    >
                      {createLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Ticket className="w-4 h-4" />
                      )}
                      Create Ticket
                    </button>
                  </div>
                </div>
              </IronCard>
            </div>
          )}
        </div>
      </div>

      {/* Auto-Reply Dialog */}
      <Dialog open={showAutoReplyDialog} onOpenChange={setShowAutoReplyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" style={{ color: T.voltageText }} />
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
              style={{ background: T.orange, color: '#fff' }}
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
    </IronShell>
  );
}

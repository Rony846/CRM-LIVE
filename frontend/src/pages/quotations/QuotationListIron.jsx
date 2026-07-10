import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  FileText, Plus, Search, Eye, Send, Copy, Loader2,
  CheckCircle, ArrowRight, Trash2,
  Package, AlertTriangle, Download,
  Factory, ShoppingCart, Truck, Mail
} from 'lucide-react';
import ClickToCallButton from '@/components/calls/ClickToCallButton';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

const STATUS_CONFIG = {
  draft: { label: 'Draft', tone: 'slate', icon: FileText },
  sent: { label: 'Sent', tone: 'info', icon: Send },
  viewed: { label: 'Viewed', tone: 'violet', icon: Eye },
  approved: { label: 'Approved', tone: 'ok', icon: CheckCircle },
  rejected: { label: 'Rejected', tone: 'bad', icon: AlertTriangle },
  converted: { label: 'Converted', tone: 'info', icon: ArrowRight },
  expired: { label: 'Expired', tone: 'warn', icon: FileText },
  cancelled: { label: 'Cancelled', tone: 'slate', icon: Trash2 }
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
  // Send-to-Ship-Desk (attach payment proof)
  const [shipDlgOpen, setShipDlgOpen] = useState(false);
  const [shipQ, setShipQ] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [payRef, setPayRef] = useState('');
  const [payAmt, setPayAmt] = useState('');
  const canShipDesk = ['call_support', 'admin', 'accountant', 'supervisor', 'service_agent'].includes(user?.role);
  const openShipDlg = (q) => { setShipQ(q); setProofFile(null); setPayRef(''); setPayAmt(q.grand_total ? Math.round(q.grand_total) : ''); setShipDlgOpen(true); };
  const handleSendToShipDesk = async () => {
    if (!proofFile) { toast.error('Attach the payment proof'); return; }
    setActionLoading(true);
    try {
      const fd = new FormData();
      fd.append('payment_proof', proofFile);
      if (payRef.trim()) fd.append('payment_ref', payRef.trim());
      if (payAmt) fd.append('payment_amount', String(payAmt));
      const { data } = await axios.post(`${API}/quotations/${encodeURIComponent(shipQ.quotation_number)}/to-ship-desk`, fd,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      toast.success(`Sent to Ship Desk (${data.order_id}) — accountant will review payment & upload invoice/label`);
      setShipDlgOpen(false); fetchQuotations();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not send to Ship Desk'); }
    finally { setActionLoading(false); }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchQuotations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // eslint-disable-next-line no-unused-vars
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

  const statCards = [
    { label: 'Total Quotations', value: (stats.total_quotations || 0).toLocaleString('en-IN'), tone: T.iron900 },
    { label: 'Pending Approval', value: (stats.pending_approval || 0).toLocaleString('en-IN'), tone: T.voltageText },
    { label: 'Approved', value: (stats.by_status?.approved || 0).toLocaleString('en-IN'), tone: T.green },
    { label: 'Conversion Rate', value: `${stats.conversion_rate || 0}%`, tone: T.orangeDeep },
    { label: 'Total Value', value: formatCurrency(stats.total_value), tone: T.iron900 },
  ];

  const tableHeaders = ['PI Number', 'Customer', 'Firm', 'Items', 'Value', 'Valid Till', 'Status', 'Actions'];

  const rowActionStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };
  const rowPrimaryStyle = { ...rowActionStyle, border: `1px solid ${T.orange}`, background: T.orange, color: '#fff' };
  const rowOutlineOrange = { ...rowActionStyle, border: `1px solid ${T.orange}`, color: T.orangeDeep };

  const newBtn = (
    <button onClick={() => navigate('/quotations/new')} data-testid="new-quotation-btn"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
      <Plus size={15} /> New Quotation
    </button>
  );

  return (
    <IronShell title="Quotations" subtitle="PROFORMA INVOICES · CREATE · SEND · CONVERT" onRefresh={fetchData} headerRight={newBtn}>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => (
              <IronCard key={s.label} pad={14}>
                <Caps size={9} color={T.iron400} style={{ display: 'block' }}>{s.label}</Caps>
                <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: s.tone, lineHeight: 1.1, marginTop: 8 }}>{s.value}</div>
              </IronCard>
            ))}
          </div>

          {/* Filters + table card */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Status</Caps>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...selectStyle, width: 170 }}>
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="viewed">Viewed</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="converted">Converted</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Firm</Caps>
                <select value={filterFirm} onChange={(e) => setFilterFirm(e.target.value)} style={{ ...selectStyle, width: 190 }}>
                  <option value="all">All Firms</option>
                  {firms.map(firm => (
                    <option key={firm.id} value={firm.id}>{firm.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Search</Caps>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                  <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by PI#, customer, phone..." style={{ ...inputStyle, paddingLeft: 30, width: '100%' }} />
                </div>
              </div>
            </div>

            {/* Table */}
            {filteredQuotations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                <FileText size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No quotations found</div>
                <button onClick={() => navigate('/quotations/new')}
                  style={{ marginTop: 8, border: 'none', background: 'transparent', color: T.orangeDeep, cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                  Create your first quotation
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {tableHeaders.map((h, i) => (
                      <th key={i} style={{ ...thCell, textAlign: h === 'Value' ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr></thead>
                  <tbody>{filteredQuotations.map((q) => {
                    const cfg = STATUS_CONFIG[q.status] || { label: q.status, tone: 'slate' };
                    const isExpired = q.is_expired || q.status === 'expired';
                    return (
                      <tr key={q.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }} data-testid={`quotation-row-${q.id}`}>
                        <td style={tdCell}>
                          <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{q.quotation_number}</div>
                          {q.version > 1 && <div style={{ ...mono, fontSize: 10, color: T.iron400, marginTop: 2 }}>v{q.version}</div>}
                        </td>
                        <td style={{ ...tdCell, maxWidth: 200 }}>
                          <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{q.customer_name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span style={{ ...mono, fontSize: 10.5, color: T.iron500 }}>{q.customer_phone}</span>
                            {q.customer_phone && (
                              <ClickToCallButton phone={q.customer_phone} customerName={q.customer_name} showLabel={false} size="sm" />
                            )}
                          </div>
                        </td>
                        <td style={{ ...tdCell, fontSize: 12, color: T.iron700 }}>{q.firm_name}</td>
                        <td style={tdCell}><span style={badgeStyle('slate')}>{q.items?.length || 0} items</span></td>
                        <td style={{ ...tdCell, textAlign: 'right', ...mono, fontWeight: 700, fontSize: 12.5, color: T.iron900 }}>{formatCurrency(q.grand_total)}</td>
                        <td style={tdCell}>
                          <div style={{ ...mono, fontSize: 11, color: isExpired ? T.orangeDeep : T.iron500 }}>{formatDate(q.validity_date)}</div>
                          {isExpired && <Caps size={8.5} color={T.orangeDeep} style={{ display: 'block', marginTop: 2 }}>Expired</Caps>}
                        </td>
                        <td style={tdCell}><span style={badgeStyle(cfg.tone)}>{cfg.label}</span></td>
                        <td style={tdCell}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => { setSelectedQuotation(q); setViewDialogOpen(true); }} title="View Details" style={rowActionStyle}><Eye size={13} /></button>
                            <button onClick={() => handleDownloadPDF(q)} title="Download PDF" style={rowActionStyle}><Download size={13} /></button>

                            {q.status === 'draft' && (
                              <>
                                <button onClick={() => navigate(`/quotations/edit/${q.id}`)} style={rowOutlineOrange}>Edit</button>
                                <button onClick={() => handleSend(q)} disabled={actionLoading} style={{ ...rowPrimaryStyle, opacity: actionLoading ? 0.6 : 1 }}><Send size={13} /> Send</button>
                              </>
                            )}

                            {['sent', 'viewed'].includes(q.status) && (
                              <>
                                <button onClick={() => handleCopyLink(q)} style={rowOutlineOrange}><Copy size={13} /> Copy Link</button>
                                <button onClick={() => handleEmailQuotation(q)} disabled={actionLoading}
                                  title={q.email || q.customer_email ? `Email to ${q.email || q.customer_email}` : 'No email address'}
                                  style={{ ...rowActionStyle, border: `1px solid ${T.blue}`, color: T.blue, opacity: actionLoading ? 0.6 : 1 }}><Mail size={13} /> Email</button>
                              </>
                            )}

                            {q.status === 'approved' && !q.converted_at && ['admin', 'accountant'].includes(user?.role) && (
                              <button onClick={() => handleOpenConvertDialog(q)} data-testid="convert-btn" style={rowPrimaryStyle}><ArrowRight size={13} /> Convert</button>
                            )}

                            {['approved', 'sent', 'viewed'].includes(q.status) && !q.ship_desk_order_id && !q.converted_at && canShipDesk && (
                              <>
                                <button onClick={() => navigate(`/quotations/edit/${q.id}`)} title="Edit the PI before sending" style={rowOutlineOrange}>Edit PI</button>
                                <button onClick={() => openShipDlg(q)} title="Attach payment proof & send to Ship Desk" style={rowPrimaryStyle}><Truck size={13} /> To Ship Desk</button>
                              </>
                            )}
                            {q.ship_desk_order_id && (
                              <span style={{ fontSize: 11, color: T.green, fontWeight: 700, display: 'inline-flex', gap: 3, alignItems: 'center' }}><Truck size={12} /> On Ship Desk</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </IronCard>
        </>
      )}

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" style={{ color: T.orange }} />
              Quotation Details
            </DialogTitle>
          </DialogHeader>

          {selectedQuotation && (
            <div className="space-y-6 py-2">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg" style={{ background: T.iron50, border: `1px solid ${T.iron200}` }}>
                  <p className="text-sm" style={{ color: T.iron500 }}>Quotation Number</p>
                  <p className="text-lg" style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{selectedQuotation.quotation_number}</p>
                </div>
                <div className="p-4 rounded-lg" style={{ background: T.iron50, border: `1px solid ${T.iron200}` }}>
                  <p className="text-sm" style={{ color: T.iron500 }}>Status</p>
                  <span style={{ ...badgeStyle((STATUS_CONFIG[selectedQuotation.status] || {}).tone || 'slate'), marginTop: 4, display: 'inline-block' }}>
                    {(STATUS_CONFIG[selectedQuotation.status] || {}).label || selectedQuotation.status}
                  </span>
                </div>
              </div>

              {/* Customer Details */}
              <div className="p-4 rounded-lg" style={{ background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <h3 className="font-medium mb-3" style={{ color: T.iron900 }}>Customer Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p style={{ color: T.iron500 }}>Name</p>
                    <p style={{ color: T.iron900 }}>{selectedQuotation.customer_name}</p>
                  </div>
                  <div>
                    <p style={{ color: T.iron500 }}>Phone</p>
                    <div className="flex items-center gap-2">
                      <p style={{ color: T.iron900 }}>{selectedQuotation.customer_phone}</p>
                      {selectedQuotation.customer_phone && (
                        <ClickToCallButton phone={selectedQuotation.customer_phone} customerName={selectedQuotation.customer_name} showLabel={true} size="sm" />
                      )}
                    </div>
                  </div>
                  <div>
                    <p style={{ color: T.iron500 }}>Email</p>
                    <p style={{ color: T.iron900 }}>{selectedQuotation.customer_email || '-'}</p>
                  </div>
                  <div>
                    <p style={{ color: T.iron500 }}>GSTIN</p>
                    <p style={{ ...mono, color: T.iron900 }}>{selectedQuotation.customer_gstin || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p style={{ color: T.iron500 }}>Address</p>
                    <p style={{ color: T.iron900 }}>
                      {[selectedQuotation.customer_address, selectedQuotation.customer_city,
                        selectedQuotation.customer_state, selectedQuotation.customer_pincode]
                        .filter(Boolean).join(', ') || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="p-4 rounded-lg" style={{ background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <h3 className="font-medium mb-3" style={{ color: T.iron900 }}>Items</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <th style={thCell}><Caps size={8.5}>Item</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Qty</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Rate</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>GST</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Total</Caps></th>
                  </tr></thead>
                  <tbody>
                    {selectedQuotation.items?.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={tdCell}>
                          <div style={{ color: T.iron900 }}>{item.name}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.iron400 }}>{item.sku_code}</div>
                        </td>
                        <td style={{ ...tdCell, textAlign: 'right', ...mono, color: T.iron900 }}>{item.quantity}</td>
                        <td style={{ ...tdCell, textAlign: 'right', ...mono, color: T.iron900 }}>{formatCurrency(item.rate)}</td>
                        <td style={{ ...tdCell, textAlign: 'right', ...mono, color: T.iron900 }}>{item.gst_rate}%</td>
                        <td style={{ ...tdCell, textAlign: 'right', ...mono, fontWeight: 700, color: T.iron900 }}>{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="mt-4 pt-4 space-y-2" style={{ borderTop: `1px solid ${T.iron200}` }}>
                  <div className="flex justify-between" style={{ color: T.iron500 }}>
                    <span>Subtotal</span>
                    <span style={mono}>{formatCurrency(selectedQuotation.subtotal)}</span>
                  </div>
                  {selectedQuotation.total_discount > 0 && (
                    <div className="flex justify-between" style={{ color: T.green }}>
                      <span>Discount</span>
                      <span style={mono}>-{formatCurrency(selectedQuotation.total_discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between" style={{ color: T.iron500 }}>
                    <span>Taxable Value</span>
                    <span style={mono}>{formatCurrency(selectedQuotation.taxable_value)}</span>
                  </div>
                  {selectedQuotation.is_inter_state ? (
                    <div className="flex justify-between" style={{ color: T.iron500 }}>
                      <span>IGST</span>
                      <span style={mono}>{formatCurrency(selectedQuotation.igst)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between" style={{ color: T.iron500 }}>
                        <span>CGST</span>
                        <span style={mono}>{formatCurrency(selectedQuotation.cgst)}</span>
                      </div>
                      <div className="flex justify-between" style={{ color: T.iron500 }}>
                        <span>SGST</span>
                        <span style={mono}>{formatCurrency(selectedQuotation.sgst)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-xl font-bold pt-2" style={{ color: T.iron900, borderTop: `1px solid ${T.iron200}` }}>
                    <span>Grand Total</span>
                    <span style={mono}>{formatCurrency(selectedQuotation.grand_total)}</span>
                  </div>
                </div>
              </div>

              {/* Audit Info */}
              <div className="p-4 rounded-lg" style={{ background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <h3 className="font-medium mb-3" style={{ color: T.iron900 }}>Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between" style={{ color: T.iron500 }}>
                    <span>Created</span>
                    <span>{formatDate(selectedQuotation.created_at)} by {selectedQuotation.created_by_name}</span>
                  </div>
                  {selectedQuotation.sent_at && (
                    <div className="flex justify-between" style={{ color: T.blue }}>
                      <span>Sent</span>
                      <span>{formatDate(selectedQuotation.sent_at)}</span>
                    </div>
                  )}
                  {selectedQuotation.viewed_at && (
                    <div className="flex justify-between" style={{ color: '#6D4AB0' }}>
                      <span>First Viewed</span>
                      <span>{formatDate(selectedQuotation.viewed_at)} ({selectedQuotation.view_count} views)</span>
                    </div>
                  )}
                  {selectedQuotation.approved_at && (
                    <div className="flex justify-between" style={{ color: T.green }}>
                      <span>Approved</span>
                      <span>{formatDate(selectedQuotation.approved_at)}</span>
                    </div>
                  )}
                  {selectedQuotation.rejected_at && (
                    <div className="flex justify-between" style={{ color: T.orangeDeep }}>
                      <span>Rejected</span>
                      <span>{formatDate(selectedQuotation.rejected_at)}</span>
                    </div>
                  )}
                  {selectedQuotation.converted_at && (
                    <div className="flex justify-between" style={{ color: T.orange }}>
                      <span>Converted ({selectedQuotation.conversion_type})</span>
                      <span>{formatDate(selectedQuotation.converted_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5" style={{ color: T.orange }} />
              Convert Quotation
            </DialogTitle>
          </DialogHeader>

          {selectedQuotation && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg" style={{ background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <p className="text-sm" style={{ color: T.iron500 }}>Quotation</p>
                <p style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{selectedQuotation.quotation_number}</p>
                <p className="text-sm mt-1" style={{ color: T.iron500 }}>{selectedQuotation.customer_name}</p>
                <p className="font-semibold mt-1" style={{ ...mono, color: T.orangeDeep }}>
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(selectedQuotation.grand_total || 0)}
                </p>
              </div>

              <div>
                <Label className="mb-3 block" style={{ color: T.iron700 }}>Select Conversion Type</Label>
                <div className="space-y-2">
                  {CONVERSION_TYPES.map((type) => {
                    const TypeIcon = type.icon;
                    const active = convertType === type.value;
                    return (
                      <div key={type.value} onClick={() => setConvertType(type.value)}
                        className="p-4 rounded-lg cursor-pointer transition-all"
                        style={{ border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? '#FDEEE6' : T.white }}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${type.color} flex items-center justify-center`}>
                            <TypeIcon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium" style={{ color: T.iron900 }}>{type.label}</p>
                            <p className="text-xs" style={{ color: T.iron500 }}>{type.description}</p>
                          </div>
                          {active && <CheckCircle className="w-5 h-5" style={{ color: T.orange }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {convertType === 'pending_fulfillment' && (
                <div className="p-3 rounded-lg" style={{ background: T.blueTint, border: `1px solid #CBE0F0` }}>
                  <p className="text-sm" style={{ color: T.blue }}>
                    <Package className="w-4 h-4 inline mr-1" />
                    <strong>Mandatory fields required:</strong> Invoice Number, Tracking ID, Shipping Label (PDF), Invoice (PDF). You'll be redirected to PI Pending Action page to complete the conversion.
                  </p>
                </div>
              )}

              <div className="p-3 rounded-lg" style={{ background: T.voltageTint, border: `1px solid #EDDFA6` }}>
                <p className="text-sm" style={{ color: T.voltageText }}>
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  This action will convert the quotation and cannot be undone. An incentive will be created for the agent who created this PI.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button onClick={handleConvert} disabled={actionLoading || !convertType} data-testid="confirm-convert-btn"
              style={{ background: T.orange, color: '#fff' }}>
              {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              {convertType === 'pending_fulfillment' ? 'Go to PI Pending Action' : `Convert to ${convertType ? CONVERSION_TYPES.find(t => t.value === convertType)?.label.split(' ')[0] : '...'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Ship Desk — attach payment proof */}
      <Dialog open={shipDlgOpen} onOpenChange={setShipDlgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Truck className="w-5 h-5" style={{ color: T.orange }} /> Send to Ship Desk</DialogTitle>
          </DialogHeader>
          <div style={{ fontSize: 13, color: T.iron600, marginBottom: 8 }}>
            {shipQ && <>PI <b>{shipQ.quotation_number}</b> — {shipQ.customer_name}{shipQ.grand_total ? ` · ₹${Math.round(shipQ.grand_total).toLocaleString('en-IN')}` : ''}.</>}
            <div style={{ marginTop: 4 }}>Attach the customer's payment proof. The accountant then reviews it and uploads the invoice + shipping label to release the order.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <Label style={{ fontSize: 11, color: T.iron500 }}>Payment proof (PDF / image) *</Label>
              <input type="file" accept="application/pdf,image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} style={{ fontSize: 13, marginTop: 4 }} />
              {proofFile && <div style={{ fontSize: 11, color: T.iron500, marginTop: 3 }}>{proofFile.name}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}><Label style={{ fontSize: 11, color: T.iron500 }}>UTR / payment ref</Label>
                <input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="optional" style={{ width: '100%', border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 9px', fontSize: 13, marginTop: 4 }} /></div>
              <div style={{ width: 130 }}><Label style={{ fontSize: 11, color: T.iron500 }}>Amount ₹</Label>
                <input type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} style={{ width: '100%', border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 9px', fontSize: 13, marginTop: 4 }} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipDlgOpen(false)}>Cancel</Button>
            <Button onClick={handleSendToShipDesk} disabled={actionLoading || !proofFile} style={{ background: T.orange, color: '#fff' }}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />} Send to Ship Desk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

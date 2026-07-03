import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import TicketSearchBar from '@/components/TicketSearchBar';
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { openAuthedFile } from '@/lib/openFile';
import { Shield, Clock, CheckCircle, XCircle, Loader2, Eye, Calendar, Star, ExternalLink, Upload, FileText } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const fmtDate = (d) => {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN');
  } catch { return d; }
};

const sourceBadge = (source) => (
  source === 'voltdoctor'
    ? <span style={badgeStyle('violet')}>VoltDoctor</span>
    : <span style={badgeStyle('info')}>CRM</span>
);

const linkBtn = { display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: T.blue, cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12, padding: 0 };

export default function SupervisorWarranties() {
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
      const response = await axios.get(`${API}/supervisor/warranty-extensions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExtensionRequests(response.data);
    } catch (error) {
      console.error('Failed to load extension requests');
    }
  };

  const refreshAll = () => {
    fetchWarranties();
    fetchExtensionRequests();
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

  const tabs = [
    { key: 'pending', label: 'Pending', count: pendingWarranties.length, icon: Clock },
    { key: 'extensions', label: 'Extension Requests', count: pendingExtensions.length, icon: Star },
    { key: 'approved', label: 'Approved', count: approvedWarranties.length, icon: CheckCircle },
    { key: 'rejected', label: 'Rejected', count: rejectedWarranties.length, icon: XCircle },
  ];

  const emptyState = (Icon, iconColor, title, sub) => (
    <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
      <Icon size={44} style={{ margin: '0 auto 10px' }} color={iconColor} />
      <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, marginTop: 3 }}>{sub}</div>}
    </div>
  );

  const renderHeader = (cols) => (
    <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
      {cols.map((h, i) => <th key={i} style={{ ...thCell, textAlign: h.right ? 'right' : 'left' }}><Caps size={8.5}>{h.label}</Caps></th>)}
    </tr></thead>
  );

  return (
    <IronShell
      title="Warranties"
      subtitle={`${pendingWarranties.length} PENDING · ${pendingExtensions.length} EXTENSIONS · ${approvedWarranties.length} APPROVED`}
      onRefresh={refreshAll}
    >
      <div style={{ marginBottom: 14 }}><TicketSearchBar /></div>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, flexWrap: 'wrap' }}>
            {tabs.map((tb) => {
              const Icon = tb.icon;
              const active = activeTab === tb.key;
              return (
                <button key={tb.key} data-testid={`${tb.key}-tab`} onClick={() => setActiveTab(tb.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                  <Icon size={14} strokeWidth={2} />{tb.label}
                  <span style={{ ...mono, fontSize: 11, opacity: 0.85 }}>({tb.count})</span>
                </button>
              );
            })}
          </div>

          {/* Pending Tab */}
          {activeTab === 'pending' && (
            pendingWarranties.length === 0 ? (
              emptyState(CheckCircle, T.green, 'All warranties reviewed!')
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  {renderHeader([
                    { label: 'Customer' }, { label: 'Device' }, { label: 'Order ID' },
                    { label: 'Purchase Date' }, { label: 'Source' }, { label: 'Submitted' }, { label: 'Actions', right: true },
                  ])}
                  <tbody>{pendingWarranties.map((warranty) => (
                    <tr key={warranty.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={tdCell}>
                        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{warranty.first_name || warranty.customer_name || ''} {warranty.last_name || ''}</div>
                        <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{warranty.email || warranty.customer_email || ''}</div>
                      </td>
                      <td style={tdCell}>{warranty.device_type || warranty.product_type || '-'}</td>
                      <td style={{ ...tdCell, ...mono }}>{warranty.order_id || warranty.invoice_number || '-'}</td>
                      <td style={{ ...tdCell, ...mono }}>{fmtDate(warranty.invoice_date || warranty.purchase_date)}</td>
                      <td style={tdCell}>{sourceBadge(warranty.source)}</td>
                      <td style={{ ...tdCell, ...mono, color: T.iron500 }}>{fmtDate(warranty.created_at)}</td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        <button onClick={() => openActionDialog(warranty)} data-testid={`review-warranty-${warranty.id}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5 }}>
                          <Eye size={13} /> Review
                        </button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )
          )}

          {/* Extension Requests Tab */}
          {activeTab === 'extensions' && (
            pendingExtensions.length === 0 ? (
              emptyState(Star, T.voltage, 'No pending extension requests', 'Extension requests from customers with Amazon reviews will appear here')
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  {renderHeader([
                    { label: 'Customer' }, { label: 'Device' }, { label: 'Order ID' },
                    { label: 'Current Expiry' }, { label: 'Review Screenshot' }, { label: 'Requested On' }, { label: 'Actions', right: true },
                  ])}
                  <tbody>{pendingExtensions.map((warranty) => (
                    <tr key={warranty.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, background: T.voltageTint }} data-testid={`extension-row-${warranty.id}`}>
                      <td style={tdCell}>
                        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{warranty.first_name} {warranty.last_name}</div>
                        <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{warranty.email}</div>
                      </td>
                      <td style={tdCell}>{warranty.device_type}</td>
                      <td style={{ ...tdCell, ...mono }}>{warranty.order_id}</td>
                      <td style={tdCell}>
                        {warranty.warranty_end_date ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.green, ...mono }}>
                            <Calendar size={13} />{fmtDate(warranty.warranty_end_date)}
                          </span>
                        ) : (
                          <span style={{ color: T.iron400 }}>Not set</span>
                        )}
                      </td>
                      <td style={tdCell}>
                        {warranty.extension_review_file && (
                          <button style={linkBtn}
                            onClick={async () => {
                              if (!(await openAuthedFile(warranty.extension_review_file, token, API)))
                                toast.error('Could not open the file');
                            }}>
                            <ExternalLink size={13} /> View
                          </button>
                        )}
                      </td>
                      <td style={{ ...tdCell, ...mono, color: T.iron500 }}>{fmtDate(warranty.updated_at)}</td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        <button onClick={() => openExtensionDialog(warranty)} data-testid={`review-extension-${warranty.id}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: T.voltageText, color: '#fff', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5 }}>
                          <Star size={13} /> Review
                        </button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )
          )}

          {/* Approved Tab */}
          {activeTab === 'approved' && (
            approvedWarranties.length === 0 ? (
              emptyState(CheckCircle, T.iron400, 'No approved warranties')
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  {renderHeader([
                    { label: 'Customer' }, { label: 'Device' }, { label: 'Order ID' },
                    { label: 'Warranty Expires' }, { label: 'Invoice' }, { label: 'Source' }, { label: 'Status' },
                  ])}
                  <tbody>{approvedWarranties.map((warranty) => (
                    <tr key={warranty.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>
                        {warranty.first_name || warranty.customer_name || '-'} {warranty.last_name || ''}
                      </td>
                      <td style={tdCell}>{warranty.device_type || warranty.product_type || '-'}</td>
                      <td style={{ ...tdCell, ...mono }}>{warranty.order_id || warranty.serial_number || '-'}</td>
                      <td style={tdCell}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...mono }}>
                          <Calendar size={13} color={T.green} />
                          {warranty.warranty_end_date ? fmtDate(warranty.warranty_end_date) : '-'}
                        </span>
                      </td>
                      <td style={tdCell}>
                        {(warranty.admin_invoice_file || warranty.invoice_file) ? (
                          <button style={linkBtn} data-testid={`view-invoice-${warranty.id}`}
                            onClick={async () => {
                              if (!(await openAuthedFile(warranty.admin_invoice_file || warranty.invoice_file, token, API)))
                                toast.error('Could not open the invoice');
                            }}>
                            <FileText size={13} /> View
                          </button>
                        ) : (
                          <button onClick={() => openInvoiceDialog(warranty)} data-testid={`upload-invoice-${warranty.id}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}>
                            <Upload size={12} /> Upload
                          </button>
                        )}
                      </td>
                      <td style={tdCell}>{sourceBadge(warranty.source)}</td>
                      <td style={tdCell}><span style={badgeStyle('ok')}>Approved</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )
          )}

          {/* Rejected Tab */}
          {activeTab === 'rejected' && (
            rejectedWarranties.length === 0 ? (
              emptyState(XCircle, T.iron400, 'No rejected warranties')
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  {renderHeader([
                    { label: 'Customer' }, { label: 'Device' }, { label: 'Order ID' },
                    { label: 'Rejection Reason' }, { label: 'Status' },
                  ])}
                  <tbody>{rejectedWarranties.map((warranty) => (
                    <tr key={warranty.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>
                        {warranty.first_name || warranty.customer_name || '-'} {warranty.last_name || ''}
                      </td>
                      <td style={tdCell}>{warranty.device_type || warranty.product_type || '-'}</td>
                      <td style={{ ...tdCell, ...mono }}>{warranty.order_id || warranty.serial_number || '-'}</td>
                      <td style={{ ...tdCell, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{warranty.admin_notes || warranty.notes || '-'}</td>
                      <td style={tdCell}><span style={badgeStyle('bad')}>Rejected</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )
          )}
        </IronCard>
      )}

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
              </div>

              {/* Invoice Document - Prominently Displayed */}
              {(selectedWarranty.invoice_file || selectedWarranty.admin_invoice_file) && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2 text-blue-800">
                    <FileText className="w-5 h-5" />
                    Customer Invoice (Review Before Approving)
                  </h4>
                  <button
                    onClick={async () => {
                      if (!(await openAuthedFile(selectedWarranty.admin_invoice_file || selectedWarranty.invoice_file, token, API)))
                        toast.error('Could not open the invoice');
                    }}
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                    data-testid="view-warranty-invoice"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Invoice Document
                  </button>
                </div>
              )}

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
                    <button
                      onClick={async () => {
                        if (!(await openAuthedFile(selectedWarranty.extension_review_file, token, API)))
                          toast.error('Could not open the file');
                      }}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Screenshot in New Tab
                    </button>
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
    </IronShell>
  );
}

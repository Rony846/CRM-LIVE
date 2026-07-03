import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
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
import {
  Shield, Clock, CheckCircle, XCircle, Loader2, Eye, Calendar, Star,
  ExternalLink, Upload, FileText, Inbox,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const fmtDate = (d) => {
  if (!d) return '-';
  try {
    const x = new Date(d);
    return isNaN(x.getTime()) ? String(d) : x.toLocaleDateString();
  } catch { return String(d); }
};

const sourcePill = (src) => (
  <span style={badgeStyle(src === 'voltdoctor' ? 'violet' : 'info')}>
    {src === 'voltdoctor' ? 'VoltDoctor' : 'CRM'}
  </span>
);

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
  const [warrantyYears, setWarrantyYears] = useState('1');
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
    setWarrantyYears('1');
    setActionOpen(true);
  };

  // End date = purchase/invoice date (or today) + N years. Drives the
  // "Warranty Period" dropdown in the approval dialog.
  const computeEndDate = (years) => {
    const src = selectedWarranty?.invoice_date || selectedWarranty?.purchase_date;
    let start = src ? new Date(src) : new Date();
    if (isNaN(start.getTime())) start = new Date();
    start.setFullYear(start.getFullYear() + Number(years));
    return start.toISOString().split('T')[0];
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

  const TABS = [
    { key: 'pending', label: 'Pending', icon: Clock, count: pendingWarranties.length },
    { key: 'extensions', label: 'Extension Requests', icon: Star, count: pendingExtensions.length },
    { key: 'approved', label: 'Approved', icon: CheckCircle, count: approvedWarranties.length },
    { key: 'rejected', label: 'Rejected', icon: XCircle, count: rejectedWarranties.length },
  ];

  const linkBtn = (label, icon, onClick, color = T.orange, deep = T.orangeDeep) => {
    const Icon = icon;
    return (
      <button
        onClick={onClick}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: deep, cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}
      >
        <Icon size={13} /> {label}
      </button>
    );
  };

  const rowActionBtn = (label, icon, onClick) => {
    const Icon = icon;
    return (
      <button
        onClick={onClick}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}
      >
        <Icon size={13} /> {label}
      </button>
    );
  };

  const EmptyState = ({ icon, title, sub }) => {
    const Icon = icon || Inbox;
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
        <Icon size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, marginTop: 3 }}>{sub}</div>}
      </div>
    );
  };

  const TableWrap = ({ headers, children }) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
            {headers.map((h, i) => (
              <th key={i} style={{ ...thCell, textAlign: h.right ? 'right' : 'left' }}>
                <Caps size={8.5}>{h.label ?? h}</Caps>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );

  const custName = (w) => `${w.first_name || w.customer_name || '-'} ${w.last_name || ''}`.trim();

  return (
    <IronShell
      title="Warranties"
      subtitle={`${pendingWarranties.length} PENDING · ${pendingExtensions.length} EXTENSIONS · ${approvedWarranties.length} APPROVED`}
      onRefresh={refreshAll}
    >
      {loading ? (
        <IronCard pad={0}>
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}>
            <Loader2 className="animate-spin" size={28} color={T.iron400} />
          </div>
        </IronCard>
      ) : (
        <>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  data-testid={`${tab.key}-tab`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    border: `1px solid ${active ? T.orange : T.iron200}`,
                    background: active ? T.orange : T.white,
                    color: active ? '#fff' : T.iron700,
                    borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                    fontFamily: T.headline, fontWeight: 700, fontSize: 12,
                  }}
                >
                  <Icon size={14} />
                  {tab.label}
                  <span style={{
                    ...mono, fontWeight: 700, fontSize: 11,
                    background: active ? 'rgba(255,255,255,.25)' : T.iron100,
                    color: active ? '#fff' : T.iron700,
                    borderRadius: 999, padding: '1px 7px',
                  }}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            {/* Pending Tab */}
            {activeTab === 'pending' && (
              pendingWarranties.length === 0 ? (
                <EmptyState icon={CheckCircle} title="All warranties reviewed!" />
              ) : (
                <TableWrap headers={['Customer', 'Device', 'Order ID', 'Purchase Date', 'Source', 'Submitted', { label: 'Actions', right: true }]}>
                  {pendingWarranties.map((warranty) => (
                    <tr key={warranty.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={tdCell}>
                        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{custName(warranty)}</div>
                        <div style={{ fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{warranty.email || warranty.customer_email || ''}</div>
                      </td>
                      <td style={tdCell}>{warranty.device_type || warranty.product_type || '-'}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron900 }}>{warranty.order_id || warranty.invoice_number || '-'}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11.5 }}>{fmtDate(warranty.invoice_date || warranty.purchase_date)}</td>
                      <td style={tdCell}>{sourcePill(warranty.source)}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{warranty.created_at ? fmtDate(warranty.created_at) : '-'}</td>
                      <td style={{ ...tdCell, textAlign: 'right' }} data-testid={`review-warranty-${warranty.id}`}>
                        {rowActionBtn('Review', Eye, () => openActionDialog(warranty))}
                      </td>
                    </tr>
                  ))}
                </TableWrap>
              )
            )}

            {/* Extension Requests Tab */}
            {activeTab === 'extensions' && (
              pendingExtensions.length === 0 ? (
                <EmptyState
                  icon={Star}
                  title="No pending extension requests"
                  sub="Extension requests from customers with Amazon reviews will appear here"
                />
              ) : (
                <TableWrap headers={['Customer', 'Device', 'Order ID', 'Current Expiry', 'Review Screenshot', 'Requested On', { label: 'Actions', right: true }]}>
                  {pendingExtensions.map((warranty) => (
                    <tr key={warranty.id} className="iron-row" data-testid={`extension-row-${warranty.id}`} style={{ borderBottom: `1px solid ${T.iron200}`, background: T.voltageTint }}>
                      <td style={tdCell}>
                        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{warranty.first_name} {warranty.last_name}</div>
                        <div style={{ fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{warranty.email}</div>
                      </td>
                      <td style={tdCell}>{warranty.device_type}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron900 }}>{warranty.order_id}</td>
                      <td style={tdCell}>
                        {warranty.warranty_end_date ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.green, ...mono, fontSize: 11.5 }}>
                            <Calendar size={13} />{fmtDate(warranty.warranty_end_date)}
                          </span>
                        ) : (
                          <span style={{ color: T.iron400 }}>Not set</span>
                        )}
                      </td>
                      <td style={tdCell}>
                        {warranty.extension_review_file && linkBtn('View', ExternalLink, async () => {
                          if (!(await openAuthedFile(warranty.extension_review_file, token, API)))
                            toast.error('Could not open the file');
                        })}
                      </td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{fmtDate(warranty.updated_at)}</td>
                      <td style={{ ...tdCell, textAlign: 'right' }} data-testid={`review-extension-${warranty.id}`}>
                        {rowActionBtn('Review', Star, () => openExtensionDialog(warranty))}
                      </td>
                    </tr>
                  ))}
                </TableWrap>
              )
            )}

            {/* Approved Tab */}
            {activeTab === 'approved' && (
              approvedWarranties.length === 0 ? (
                <EmptyState icon={CheckCircle} title="No approved warranties" />
              ) : (
                <TableWrap headers={['Customer', 'Device', 'Order ID', 'Warranty Expires', 'Invoice', 'Source', 'Status']}>
                  {approvedWarranties.map((warranty) => (
                    <tr key={warranty.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{custName(warranty)}</td>
                      <td style={tdCell}>{warranty.device_type || warranty.product_type || '-'}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron900 }}>{warranty.order_id || warranty.serial_number || '-'}</td>
                      <td style={tdCell}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...mono, fontSize: 11.5 }}>
                          <Calendar size={13} color={T.green} />
                          {warranty.warranty_end_date ? fmtDate(warranty.warranty_end_date) : '-'}
                        </span>
                      </td>
                      <td style={tdCell}>
                        {(warranty.admin_invoice_file || warranty.invoice_file) ? (
                          <span data-testid={`view-invoice-${warranty.id}`}>
                            {linkBtn('View', FileText, async () => {
                              if (!(await openAuthedFile(warranty.admin_invoice_file || warranty.invoice_file, token, API)))
                                toast.error('Could not open the invoice');
                            })}
                          </span>
                        ) : (
                          <span data-testid={`upload-invoice-${warranty.id}`}>
                            {rowActionBtn('Upload', Upload, () => openInvoiceDialog(warranty))}
                          </span>
                        )}
                      </td>
                      <td style={tdCell}>{sourcePill(warranty.source)}</td>
                      <td style={tdCell}><span style={badgeStyle('ok')}>Approved</span></td>
                    </tr>
                  ))}
                </TableWrap>
              )
            )}

            {/* Rejected Tab */}
            {activeTab === 'rejected' && (
              rejectedWarranties.length === 0 ? (
                <EmptyState icon={XCircle} title="No rejected warranties" />
              ) : (
                <TableWrap headers={['Customer', 'Device', 'Order ID', 'Rejection Reason', 'Status']}>
                  {rejectedWarranties.map((warranty) => (
                    <tr key={warranty.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{custName(warranty)}</td>
                      <td style={tdCell}>{warranty.device_type || warranty.product_type || '-'}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron900 }}>{warranty.order_id || warranty.serial_number || '-'}</td>
                      <td style={{ ...tdCell, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{warranty.admin_notes || warranty.notes || '-'}</td>
                      <td style={tdCell}><span style={badgeStyle('bad')}>Rejected</span></td>
                    </tr>
                  ))}
                </TableWrap>
              )
            )}
          </IronCard>
        </>
      )}

      {/* Review Dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-600" />
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
                    <button
                      onClick={async () => {
                        if (!(await openAuthedFile(selectedWarranty.invoice_file, token, API)))
                          toast.error('Could not open the invoice');
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      View Invoice
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Approval Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Warranty Period</Label>
                  <Select
                    value={warrantyYears}
                    onValueChange={(v) => {
                      setWarrantyYears(v);
                      setApprovalData((prev) => ({ ...prev, warranty_end_date: computeEndDate(v) }));
                    }}
                  >
                    <SelectTrigger data-testid="warranty-years-select">
                      <SelectValue placeholder="Select years" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 10].map((y) => (
                        <SelectItem key={y} value={String(y)}>{y} year{y > 1 ? 's' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Auto-fills the end date from the purchase / invoice date.</p>
                </div>

                <div className="space-y-2">
                  <Label>Warranty End Date *</Label>
                  <Input
                    type="date"
                    value={approvalData.warranty_end_date}
                    onChange={(e) => setApprovalData({ ...approvalData, warranty_end_date: e.target.value })}
                    data-testid="warranty-end-date-input"
                  />
                  <p className="text-xs text-slate-500">Set from the dropdown above, or adjust manually.</p>
                </div>

                <div className="space-y-2">
                  <Label>Notes (required for rejection)</Label>
                  <Textarea
                    placeholder="Add notes or rejection reason..."
                    value={approvalData.notes}
                    onChange={(e) => setApprovalData({ ...approvalData, notes: e.target.value })}
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
            <DialogTitle className="text-xl flex items-center gap-2">
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
                      className="flex items-center gap-2 text-orange-600 hover:text-orange-800"
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
                    onValueChange={(value) => setExtensionData({ ...extensionData, extension_months: value })}
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
                    onChange={(e) => setExtensionData({ ...extensionData, notes: e.target.value })}
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
              <FileText className="w-5 h-5 text-orange-600" />
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
                <div className="flex items-center gap-2 text-orange-600">
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

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { Shield, Eye, Plus, Loader2, Calendar, Package, Upload, Star, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

// Warranty status -> Iron pill.
const warrantyPill = (status) => {
  const map = {
    approved: ['Approved', 'ok'],
    rejected: ['Rejected', 'bad'],
    pending: ['Pending', 'warn'],
  };
  const [label, tone] = map[status] || [(status || '-').replace(/_/g, ' '), 'slate'];
  return { label, style: badgeStyle(tone) };
};

// Extension status -> Iron pill.
const extPill = (status) => {
  const map = {
    approved: ['ok'],
    rejected: ['bad'],
  };
  const tone = (map[status] || ['warn'])[0];
  return badgeStyle(tone);
};

const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '7px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

export default function MyWarranties() {
  const { token } = useAuth();
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [extensionOpen, setExtensionOpen] = useState(false);
  const [extensionFile, setExtensionFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchWarranties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const openExtensionDialog = (warranty) => {
    setSelectedWarranty(warranty);
    setExtensionFile(null);
    setExtensionOpen(true);
  };

  const handleExtensionRequest = async () => {
    if (!extensionFile) {
      toast.error('Please upload your Amazon review screenshot');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('review_file', extensionFile);

      await axios.post(`${API}/warranties/${selectedWarranty.id}/request-extension`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Extension request submitted! Admin will review shortly.');
      setExtensionOpen(false);
      fetchWarranties();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to submit extension request';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const isWarrantyActive = (warranty) => {
    if (warranty.status !== 'approved' || !warranty.warranty_end_date) return false;
    return new Date(warranty.warranty_end_date) > new Date();
  };

  const canRequestExtension = (warranty) => {
    return warranty.status === 'approved' && !warranty.extension_requested;
  };

  const HEADERS = ['Device Type', 'Order ID', 'Invoice Date', 'Warranty Expires', 'Status', 'Actions'];

  const headerRight = (
    <Link to="/customer/warranty/register">
      <button style={primaryBtn} data-testid="new-warranty-btn">
        <Plus size={14} strokeWidth={2.25} />
        Register New
      </button>
    </Link>
  );

  const bodyContent = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
          <Loader2 className="animate-spin" size={30} color={T.orange} />
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Extension Promo Banner */}
        <IronCard pad={0} style={{ background: T.voltageTint, border: `1px solid #EDDFA6` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}>
            <div style={{ height: 44, width: 44, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 6, background: '#FBF3D9', border: `1px solid #EDDFA6` }}>
              <Star size={20} color={T.voltageText} />
            </div>
            <div>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.voltageText }}>Get +3 Months Free Warranty!</div>
              <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 2 }}>Leave a review on Amazon and upload a screenshot to extend your warranty.</div>
            </div>
          </div>
        </IronCard>

        {/* Warranties table card */}
        <IronCard pad={0}>
          {warranties.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 16px' }}>
              <div style={{ height: 64, width: 64, display: 'grid', placeItems: 'center', borderRadius: 8, background: T.iron100, margin: '0 auto 16px' }}>
                <Shield size={30} color={T.iron400} />
              </div>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900, marginBottom: 6 }}>No warranties registered</div>
              <div style={{ fontSize: 12.5, color: T.iron500, marginBottom: 18 }}>Register your product warranty for protection</div>
              <Link to="/customer/warranty/register">
                <button style={{ ...primaryBtn, margin: '0 auto' }}>
                  <Plus size={14} strokeWidth={2.25} />
                  Register Warranty
                </button>
              </Link>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {HEADERS.map((h, i) => (
                    <th key={h} style={{ ...thCell, textAlign: i === HEADERS.length - 1 ? 'right' : 'left' }}>
                      <Caps size={8.5}>{h}</Caps>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {warranties.map((warranty) => {
                  const pill = warrantyPill(warranty.status);
                  return (
                    <tr key={warranty.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }} data-testid={`warranty-row-${warranty.id}`}>
                      <td style={tdCell}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Package size={15} color={T.iron400} />
                          <span style={{ fontWeight: 600, color: T.iron900 }}>{warranty.device_type}</span>
                        </div>
                      </td>
                      <td style={{ ...tdCell, ...mono, color: T.iron900 }}>{warranty.order_id}</td>
                      <td style={{ ...tdCell, ...mono }}>{new Date(warranty.invoice_date).toLocaleDateString()}</td>
                      <td style={tdCell}>
                        {warranty.warranty_end_date ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...mono, color: isWarrantyActive(warranty) ? T.green : T.rose }}>
                            <Calendar size={13} />
                            {new Date(warranty.warranty_end_date).toLocaleDateString()}
                          </div>
                        ) : (
                          <span style={{ color: T.iron400 }}>Pending approval</span>
                        )}
                      </td>
                      <td style={tdCell}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          <span style={pill.style}>{pill.label}</span>
                          {warranty.extension_requested && (
                            <span style={extPill(warranty.extension_status)}>
                              Ext: {warranty.extension_status || 'pending'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            style={outlineBtn}
                            onClick={() => viewWarrantyDetails(warranty)}
                            data-testid={`view-warranty-${warranty.id}`}
                          >
                            <Eye size={14} />
                            View
                          </button>
                          {canRequestExtension(warranty) && (
                            <button
                              style={{ ...outlineBtn, border: `1px solid #EDDFA6`, color: T.voltageText, background: T.voltageTint }}
                              onClick={() => openExtensionDialog(warranty)}
                            >
                              <Star size={13} />
                              +3 Months
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </IronCard>
      </div>
    );
  };

  return (
    <IronShell title="My Warranties" subtitle="REGISTERED PRODUCT WARRANTIES" onRefresh={fetchWarranties} headerRight={headerRight}>
      {bodyContent()}

      {/* Warranty Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ height: 28, width: 28, display: 'grid', placeItems: 'center', borderRadius: 6, background: '#FDEEE6' }}>
                <Shield size={15} color={T.orangeDeep} />
              </div>
              Warranty Details
            </DialogTitle>
          </DialogHeader>

          {selectedWarranty && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Status Banner */}
              <div style={(() => {
                const active = selectedWarranty.status === 'approved' && isWarrantyActive(selectedWarranty);
                const tone = active
                  ? { border: '#CBE5D6', bg: T.greenTint }
                  : selectedWarranty.status === 'pending'
                  ? { border: '#EDDFA6', bg: T.voltageTint }
                  : { border: T.iron200, bg: T.iron50 };
                return { padding: 14, borderRadius: 8, border: `1px solid ${tone.border}`, background: tone.bg };
              })()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Caps size={9}>Status</Caps>
                  <span style={warrantyPill(selectedWarranty.status).style}>{warrantyPill(selectedWarranty.status).label}</span>
                </div>
                {selectedWarranty.status === 'approved' && selectedWarranty.warranty_end_date && (
                  <div style={{ marginTop: 8, fontSize: 13, ...mono }}>
                    <span style={{ color: T.iron500 }}>Expires: </span>
                    <span style={{ color: isWarrantyActive(selectedWarranty) ? T.green : T.rose, fontWeight: 700 }}>
                      {new Date(selectedWarranty.warranty_end_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                <div>
                  <Caps size={9} style={{ display: 'block', marginBottom: 3 }}>Device Type</Caps>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900 }}>{selectedWarranty.device_type}</div>
                </div>
                <div>
                  <Caps size={9} style={{ display: 'block', marginBottom: 3 }}>Order ID</Caps>
                  <div style={{ fontSize: 13, ...mono, color: T.iron900 }}>{selectedWarranty.order_id}</div>
                </div>
                <div>
                  <Caps size={9} style={{ display: 'block', marginBottom: 3 }}>Invoice Date</Caps>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900 }}>{new Date(selectedWarranty.invoice_date).toLocaleDateString()}</div>
                </div>
                <div>
                  <Caps size={9} style={{ display: 'block', marginBottom: 3 }}>Invoice Amount</Caps>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900, ...mono }}>₹{selectedWarranty.invoice_amount?.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <Caps size={9} style={{ display: 'block', marginBottom: 3 }}>Registered On</Caps>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900 }}>{new Date(selectedWarranty.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Admin Notes */}
              {selectedWarranty.admin_notes && (
                <div style={{ borderRadius: 8, border: `1px solid #F6D8BA`, background: '#FDEEE6', padding: 14 }}>
                  <Caps size={9} color={T.orangeDeep} style={{ display: 'block', marginBottom: 3 }}>Admin Notes</Caps>
                  <div style={{ fontSize: 13, color: T.iron900 }}>{selectedWarranty.admin_notes}</div>
                </div>
              )}

              {/* Extension Status */}
              {selectedWarranty.extension_requested && (
                <div style={(() => {
                  const tone = selectedWarranty.extension_status === 'approved'
                    ? { border: '#CBE5D6', bg: T.greenTint }
                    : selectedWarranty.extension_status === 'rejected'
                    ? { border: '#F6D8BA', bg: '#FDEEE6' }
                    : { border: '#EDDFA6', bg: T.voltageTint };
                  return { padding: 14, borderRadius: 8, border: `1px solid ${tone.border}`, background: tone.bg };
                })()}>
                  <Caps size={9} style={{ display: 'block', marginBottom: 3 }}>Warranty Extension</Caps>
                  <div style={{ fontSize: 13, color: T.iron900 }}>
                    Status:{' '}
                    <span style={{
                      fontWeight: 700,
                      textTransform: 'capitalize',
                      color: selectedWarranty.extension_status === 'approved' ? T.green :
                        selectedWarranty.extension_status === 'rejected' ? T.rose : T.voltageText,
                    }}>
                      {selectedWarranty.extension_status || 'pending'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Extension Request Dialog */}
      <Dialog open={extensionOpen} onOpenChange={setExtensionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ height: 28, width: 28, display: 'grid', placeItems: 'center', borderRadius: 6, background: T.voltageTint }}>
                <Star size={15} color={T.voltageText} />
              </div>
              Get +3 Months Warranty
            </DialogTitle>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ borderRadius: 8, border: `1px solid #EDDFA6`, background: T.voltageTint, padding: 14 }}>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.voltageText, marginBottom: 8 }}>How it works:</div>
              <ol style={{ listStyle: 'decimal', marginLeft: 18, fontSize: 12, color: T.iron700, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>Leave a review for your MuscleGrid product on Amazon</li>
                <li>Take a screenshot of your review</li>
                <li>Upload the screenshot below</li>
                <li>Our team will verify and extend your warranty by 3 months!</li>
              </ol>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Caps size={9}>Upload Review Screenshot</Caps>
              <div style={{ borderRadius: 8, border: `2px dashed ${T.iron200}`, background: T.iron50, padding: 24, textAlign: 'center' }}>
                <input
                  id="review_file"
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => setExtensionFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                <label htmlFor="review_file" style={{ cursor: 'pointer' }}>
                  {extensionFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: T.green }}>
                      <CheckCircle size={20} />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{extensionFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload size={28} style={{ margin: '0 auto 8px' }} color={T.iron400} />
                      <div style={{ fontSize: 13, color: T.iron500 }}>Click to upload screenshot</div>
                      <div style={{ fontSize: 11, color: T.iron400, marginTop: 4 }}>JPG, PNG (max 10MB)</div>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <button style={outlineBtn} onClick={() => setExtensionOpen(false)}>Cancel</button>
            <button
              style={{ ...primaryBtn, background: T.voltageText, opacity: (uploading || !extensionFile) ? 0.6 : 1, cursor: (uploading || !extensionFile) ? 'not-allowed' : 'pointer' }}
              onClick={handleExtensionRequest}
              disabled={uploading || !extensionFile}
            >
              {uploading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Star size={14} />
              )}
              Submit Request
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}

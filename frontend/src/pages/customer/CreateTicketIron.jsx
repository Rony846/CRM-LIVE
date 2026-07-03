import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Send, ArrowLeft, Shield, AlertTriangle, FileText, Upload } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';

export default function CreateTicket() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [warranties, setWarranties] = useState([]);
  const [loadingWarranties, setLoadingWarranties] = useState(true);
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [issueDescription, setIssueDescription] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [invoiceFile, setInvoiceFile] = useState(null);

  useEffect(() => {
    fetchApprovedWarranties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchApprovedWarranties = async () => {
    try {
      const response = await axios.get(`${API}/warranties?status=approved`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarranties(response.data);
    } catch (error) {
      console.error('Failed to fetch warranties:', error);
      toast.error('Failed to load your products');
    } finally {
      setLoadingWarranties(false);
    }
  };

  const checkForDuplicate = async (warranty) => {
    try {
      const params = new URLSearchParams();
      if (warranty.serial_number) params.append('serial_number', warranty.serial_number);
      if (warranty.order_id) params.append('order_id', warranty.order_id);

      const response = await axios.get(`${API}/tickets/check-duplicate?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.has_duplicate) {
        setDuplicateWarning(response.data);
        return true;
      }
      setDuplicateWarning(null);
      return false;
    } catch (error) {
      console.error('Duplicate check failed:', error);
      return false;
    }
  };

  const handleWarrantySelect = async (warrantyId) => {
    const warranty = warranties.find(w => w.id === warrantyId);
    setSelectedWarranty(warranty);
    if (warranty) {
      await checkForDuplicate(warranty);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedWarranty) {
      toast.error('Please select a registered product');
      return;
    }

    if (!issueDescription.trim()) {
      toast.error('Please describe your issue');
      return;
    }

    if (!invoiceFile) {
      toast.error('Please upload your purchase invoice');
      return;
    }

    // Block submission if duplicate exists
    if (duplicateWarning) {
      toast.error(`Cannot create ticket: ${duplicateWarning.message}`);
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('device_type', selectedWarranty.device_type);
      formData.append('product_name', selectedWarranty.product_name || selectedWarranty.device_type);
      formData.append('serial_number', selectedWarranty.serial_number || '');
      formData.append('order_id', selectedWarranty.order_id || '');
      formData.append('issue_description', issueDescription);
      formData.append('invoice_file', invoiceFile);

      await axios.post(`${API}/tickets`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Ticket created successfully!');
      navigate('/customer/tickets');
    } catch (error) {
      console.error('Create ticket error:', error);
      const message = error.response?.data?.detail || 'Failed to create ticket';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const isWarrantyValid = (warranty) => {
    if (!warranty.warranty_end_date) return false;
    const endDate = new Date(warranty.warranty_end_date);
    return endDate > new Date();
  };

  const labelCaps = { display: 'block', marginBottom: 6 };
  const fieldLabel = (txt) => <Caps size={10} color={T.iron500} style={labelCaps}>{txt}</Caps>;

  const btnOutline = {
    border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6,
    padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  };
  const btnPrimary = (disabled) => ({
    border: 'none', background: disabled ? T.iron400 : T.orange, color: '#fff', borderRadius: 6,
    padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12,
    cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: 6, flex: 1,
  });

  return (
    <IronShell
      title="Create Ticket"
      subtitle="SUPPORT / NEW REQUEST"
      onRefresh={fetchApprovedWarranties}
      headerRight={
        <button onClick={() => navigate('/customer/tickets')} style={btnOutline}>
          <ArrowLeft size={14} strokeWidth={2} /> Back to Tickets
        </button>
      }
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Page header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900 }}>Create Support Ticket</div>
          <div style={{ marginTop: 4, fontSize: 13, color: T.iron500 }}>
            Select your registered product and describe your issue
          </div>
        </div>

        <IronCard pad={0}>
          <div style={{ padding: 22 }}>
            {loadingWarranties ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
                <Loader2 className="animate-spin" style={{ width: 32, height: 32, color: T.orange }} />
              </div>
            ) : warranties.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0' }}>
                <div style={{ height: 64, width: 64, display: 'grid', placeItems: 'center', borderRadius: 8, background: T.iron100, margin: '0 auto 16px' }}>
                  <Shield style={{ width: 32, height: 32, color: T.iron400 }} />
                </div>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 18, color: T.iron900, marginBottom: 8 }}>No Registered Products</div>
                <div style={{ color: T.iron500, marginBottom: 24, fontSize: 13, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                  You can only create support tickets for products with approved warranty registration.
                </div>
                <button
                  onClick={() => navigate('/customer/warranty/register')}
                  style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '9px 18px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  Register a Product
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {/* Product Selection */}
                <div>
                  {fieldLabel('Select Product *')}
                  <Select onValueChange={handleWarrantySelect}>
                    <SelectTrigger data-testid="product-select">
                      <SelectValue placeholder="Choose a registered product" />
                    </SelectTrigger>
                    <SelectContent>
                      {warranties.map((warranty) => (
                        <SelectItem
                          key={warranty.id}
                          value={warranty.id}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{warranty.product_name || warranty.device_type}</span>
                            {!isWarrantyValid(warranty) && (
                              <span style={{ fontSize: 11, color: T.orangeDeep }}>(Expired)</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Selected Product Details */}
                {selectedWarranty && (
                  <>
                    {/* Duplicate Warning */}
                    {duplicateWarning && (
                      <div style={{ borderRadius: 8, border: `1px solid #F6D8BA`, background: '#FDEEE6', padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <AlertTriangle style={{ width: 20, height: 20, color: T.orangeDeep, marginTop: 2, flexShrink: 0 }} />
                          <div>
                            <div style={{ color: T.orangeDeep, fontFamily: T.headline, fontWeight: 700, fontSize: 13 }}>Cannot Create Ticket</div>
                            <div style={{ color: T.orangeDeep, fontSize: 13, marginTop: 4 }}>{duplicateWarning.message}</div>
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', color: T.orangeDeep, padding: 0, marginTop: 8, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                              onClick={() => navigate('/customer/tickets')}
                            >
                              View existing ticket →
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ borderRadius: 8, border: `1px solid ${T.iron200}`, background: T.iron50, padding: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        <div>
                          <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 3 }}>Product</Caps>
                          <div style={{ color: T.iron900, fontWeight: 600, fontSize: 13 }}>{selectedWarranty.product_name || selectedWarranty.device_type}</div>
                        </div>
                        <div>
                          <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 3 }}>Serial Number</Caps>
                          <div style={{ color: T.iron900, fontSize: 13, ...mono }}>{selectedWarranty.serial_number || 'N/A'}</div>
                        </div>
                        <div>
                          <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 3 }}>Order ID</Caps>
                          <div style={{ color: T.iron900, fontSize: 13, ...mono }}>{selectedWarranty.order_id || 'N/A'}</div>
                        </div>
                        <div>
                          <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 3 }}>Warranty Valid Until</Caps>
                          <div style={{ fontWeight: 600, fontSize: 13, ...mono, color: isWarrantyValid(selectedWarranty) ? T.green : T.orangeDeep }}>
                            {selectedWarranty.warranty_end_date
                              ? new Date(selectedWarranty.warranty_end_date).toLocaleDateString('en-IN')
                              : 'N/A'}
                          </div>
                        </div>
                      </div>

                      {!isWarrantyValid(selectedWarranty) && (
                        <div style={{ marginTop: 16, padding: 12, borderRadius: 6, border: `1px solid #F6D8BA`, background: '#FDEEE6', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <AlertTriangle style={{ width: 16, height: 16, color: T.orangeDeep, flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <div style={{ color: T.orangeDeep, fontFamily: T.headline, fontWeight: 700, fontSize: 13 }}>Warranty Expired</div>
                            <div style={{ color: T.orangeDeep, fontSize: 12, marginTop: 2 }}>
                              This product's warranty has expired. Service charges may apply.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Issue Description */}
                <div>
                  {fieldLabel('Issue Description *')}
                  <textarea
                    placeholder="Please describe your issue in detail. Include any error messages, symptoms, or steps to reproduce the problem."
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    rows={6}
                    data-testid="issue-description-input"
                    style={{ width: '100%', border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '9px 12px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none', resize: 'vertical', fontFamily: T.body }}
                  />
                </div>

                {/* Invoice Upload */}
                <div>
                  <Caps size={10} color={T.iron500} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <FileText style={{ width: 13, height: 13 }} />
                    Purchase Invoice *
                  </Caps>
                  <div style={{ borderRadius: 6, border: `2px dashed ${T.iron200}`, background: T.iron50, padding: 16 }}>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp"
                      onChange={(e) => setInvoiceFile(e.target.files[0])}
                      style={{ display: 'none' }}
                      id="invoice-upload"
                      data-testid="invoice-upload-input"
                    />
                    <label
                      htmlFor="invoice-upload"
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                    >
                      {invoiceFile ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.green }}>
                          <FileText style={{ width: 20, height: 20 }} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{invoiceFile.name}</span>
                        </div>
                      ) : (
                        <>
                          <Upload style={{ width: 28, height: 28, color: T.iron400, marginBottom: 8 }} />
                          <span style={{ color: T.iron500, fontSize: 13 }}>Click to upload invoice</span>
                          <span style={{ color: T.iron400, fontSize: 11, marginTop: 4 }}>PDF, JPG, PNG, HEIC (iPhone photos supported)</span>
                        </>
                      )}
                    </label>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 6 }}>
                    Upload your purchase invoice to help us verify your product and expedite service
                  </div>
                </div>

                {/* Submit */}
                <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
                  <button
                    type="button"
                    style={btnOutline}
                    onClick={() => navigate('/customer/tickets')}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={btnPrimary(loading || !selectedWarranty || !!duplicateWarning || !invoiceFile)}
                    disabled={loading || !selectedWarranty || !!duplicateWarning || !invoiceFile}
                    data-testid="submit-ticket-btn"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Send style={{ width: 16, height: 16 }} />
                        Submit Ticket
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </IronCard>
      </div>
    </IronShell>
  );
}

import React, { useState } from 'react';
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
import { Loader2, Shield, Upload, ArrowLeft, CheckCircle } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';

const DEVICE_TYPES = ['Inverter', 'Battery', 'Stabilizer', 'Others'];

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '8px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const fieldLabel = { fontFamily: T.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: T.iron500, display: 'block', marginBottom: 6 };

const SectionLabel = ({ children }) => (
  <div style={{ borderBottom: `1px solid ${T.iron200}`, paddingBottom: 6, marginBottom: 4 }}>
    <Caps size={9.5} color={T.iron700}>{children}</Caps>
  </div>
);

export default function WarrantyRegistration() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    device_type: '',
    invoice_date: '',
    invoice_amount: '',
    order_id: ''
  });
  const [invoiceFile, setInvoiceFile] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setInvoiceFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!invoiceFile) {
      toast.error('Please upload your invoice');
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        formDataToSend.append(key, value);
      });
      formDataToSend.append('invoice_file', invoiceFile);

      await axios.post(`${API}/warranties`, formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccess(true);
      toast.success('Warranty registration submitted!');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to submit warranty registration';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <IronShell title="Register Warranty" subtitle="WARRANTY / REGISTRATION">
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '56px 0' }}>
          <div style={{ height: 80, width: 80, display: 'grid', placeItems: 'center', borderRadius: 12, background: T.greenTint, margin: '0 auto 24px' }}>
            <CheckCircle style={{ width: 40, height: 40, color: T.green }} />
          </div>
          <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 24, color: T.iron900, marginBottom: 12 }}>Registration Submitted!</div>
          <p style={{ color: T.iron500, marginBottom: 32, fontSize: 13.5, lineHeight: 1.6 }}>
            Your warranty registration has been submitted for review. Our admin team will approve it within 1-2 business days.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/customer')}
              style={{ border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate('/customer/warranties')}
              style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              View My Warranties
            </button>
          </div>
        </div>
      </IronShell>
    );
  }

  return (
    <IronShell title="Register Warranty" subtitle="WARRANTY / REGISTRATION">
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button
          onClick={() => navigate('/customer')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, border: 'none', background: 'transparent', color: T.iron500, fontFamily: T.headline, fontWeight: 600, fontSize: 12, cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft style={{ width: 15, height: 15 }} />
          Back to Dashboard
        </button>

        {/* Page heading */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ height: 42, width: 42, display: 'grid', placeItems: 'center', borderRadius: 8, background: '#FDEEE6' }}>
            <Shield style={{ width: 20, height: 20, color: T.orange }} />
          </div>
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900 }}>Register Your Warranty</div>
            <p style={{ fontSize: 12.5, color: T.iron500, marginTop: 2 }}>Fill in your product details to activate warranty protection</p>
          </div>
        </div>

        <IronCard pad={0}>
          <form onSubmit={handleSubmit} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 28 }}>
            {/* Personal Information */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SectionLabel>Personal Information</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label htmlFor="first_name" style={fieldLabel}>First Name *</label>
                  <input
                    id="first_name"
                    name="first_name"
                    style={inputStyle}
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    data-testid="warranty-firstname-input"
                  />
                </div>
                <div>
                  <label htmlFor="last_name" style={fieldLabel}>Last Name *</label>
                  <input
                    id="last_name"
                    name="last_name"
                    style={inputStyle}
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                    data-testid="warranty-lastname-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label htmlFor="phone" style={fieldLabel}>Phone *</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    style={{ ...inputStyle, ...mono }}
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    data-testid="warranty-phone-input"
                  />
                </div>
                <div>
                  <label htmlFor="email" style={fieldLabel}>Email *</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    style={inputStyle}
                    value={formData.email}
                    onChange={handleChange}
                    required
                    data-testid="warranty-email-input"
                  />
                </div>
              </div>
            </div>

            {/* Product Information */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SectionLabel>Product Information</SectionLabel>

              <div>
                <label htmlFor="device_type" style={fieldLabel}>Device Type *</label>
                <Select
                  value={formData.device_type}
                  onValueChange={(value) => setFormData({ ...formData, device_type: value })}
                >
                  <SelectTrigger data-testid="warranty-device-select">
                    <SelectValue placeholder="Select device type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label htmlFor="invoice_date" style={fieldLabel}>Invoice Date *</label>
                  <input
                    id="invoice_date"
                    name="invoice_date"
                    type="date"
                    style={{ ...inputStyle, ...mono }}
                    value={formData.invoice_date}
                    onChange={handleChange}
                    required
                    data-testid="warranty-invoice-date-input"
                  />
                </div>
                <div>
                  <label htmlFor="invoice_amount" style={fieldLabel}>Invoice Amount (₹) *</label>
                  <input
                    id="invoice_amount"
                    name="invoice_amount"
                    type="number"
                    placeholder="e.g., 15000"
                    style={{ ...inputStyle, ...mono }}
                    value={formData.invoice_amount}
                    onChange={handleChange}
                    required
                    data-testid="warranty-invoice-amount-input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="order_id" style={fieldLabel}>Order ID *</label>
                <input
                  id="order_id"
                  name="order_id"
                  placeholder="e.g., AMZ-123456789"
                  style={{ ...inputStyle, ...mono }}
                  value={formData.order_id}
                  onChange={handleChange}
                  required
                  data-testid="warranty-order-id-input"
                />
              </div>
            </div>

            {/* Invoice Upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SectionLabel>Invoice Upload</SectionLabel>

              <div>
                <label htmlFor="invoice_file" style={fieldLabel}>Upload Invoice *</label>
                <div style={{ border: `2px dashed ${T.iron200}`, borderRadius: 8, background: T.iron50, padding: 24, textAlign: 'center' }}>
                  <input
                    id="invoice_file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    data-testid="warranty-invoice-file-input"
                  />
                  <label htmlFor="invoice_file" style={{ cursor: 'pointer', display: 'block' }}>
                    {invoiceFile ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: T.green }}>
                        <CheckCircle style={{ width: 20, height: 20 }} />
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{invoiceFile.name}</span>
                      </div>
                    ) : (
                      <>
                        <Upload style={{ width: 28, height: 28, margin: '0 auto 8px', color: T.iron400, display: 'block' }} />
                        <p style={{ fontSize: 13, color: T.iron500 }}>Click to upload invoice</p>
                        <p style={{ fontSize: 11, color: T.iron400, marginTop: 4 }}>PDF, JPG, PNG, HEIC (iPhone photos supported)</p>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, paddingTop: 2 }}>
              <button
                type="button"
                onClick={() => navigate('/customer')}
                style={{ border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '10px 18px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                data-testid="submit-warranty-btn"
                style={{ flex: 1, border: 'none', background: loading ? T.orangeDeep : T.orange, color: '#fff', borderRadius: 6, padding: '10px 18px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: loading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {loading ? (
                  <>
                    <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Shield style={{ width: 16, height: 16 }} />
                    Submit Registration
                  </>
                )}
              </button>
            </div>
          </form>
        </IronCard>
      </div>
    </IronShell>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Shield, Upload, ArrowLeft, CheckCircle } from 'lucide-react';

const DEVICE_TYPES = ['Inverter', 'Battery', 'Stabilizer', 'Others'];

// Section divider label
const SectionLabel = ({ children }) => (
  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground pb-1 border-b border-border">
    {children}
  </p>
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
      <DashboardLayout title="Warranty Registration">
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="flex h-20 w-20 items-center justify-center rounded bg-emerald-500/15 mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Registration Submitted!</h2>
          <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
            Your warranty registration has been submitted for review. Our admin team will approve it within 1–2 business days.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate('/customer')}>
              Back to Dashboard
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate('/customer/warranties')}
            >
              View My Warranties
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Register Warranty">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => navigate('/customer')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Page heading */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/15">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Register Your Warranty</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Fill in your product details to activate warranty protection</p>
          </div>
        </div>

        <div className="mg-card rounded-lg border border-border bg-card">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Information */}
              <div className="space-y-4">
                <SectionLabel>Personal Information</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      First Name *
                    </Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      required
                      data-testid="warranty-firstname-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Last Name *
                    </Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      required
                      data-testid="warranty-lastname-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Phone *
                    </Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      data-testid="warranty-phone-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Email *
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      data-testid="warranty-email-input"
                    />
                  </div>
                </div>
              </div>

              {/* Product Information */}
              <div className="space-y-4">
                <SectionLabel>Product Information</SectionLabel>

                <div className="space-y-2">
                  <Label htmlFor="device_type" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Device Type *
                  </Label>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoice_date" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Invoice Date *
                    </Label>
                    <Input
                      id="invoice_date"
                      name="invoice_date"
                      type="date"
                      value={formData.invoice_date}
                      onChange={handleChange}
                      required
                      data-testid="warranty-invoice-date-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice_amount" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Invoice Amount (₹) *
                    </Label>
                    <Input
                      id="invoice_amount"
                      name="invoice_amount"
                      type="number"
                      placeholder="e.g., 15000"
                      value={formData.invoice_amount}
                      onChange={handleChange}
                      required
                      data-testid="warranty-invoice-amount-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="order_id" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Order ID *
                  </Label>
                  <Input
                    id="order_id"
                    name="order_id"
                    placeholder="e.g., AMZ-123456789"
                    value={formData.order_id}
                    onChange={handleChange}
                    required
                    data-testid="warranty-order-id-input"
                  />
                </div>
              </div>

              {/* Invoice Upload */}
              <div className="space-y-4">
                <SectionLabel>Invoice Upload</SectionLabel>

                <div className="space-y-2">
                  <Label htmlFor="invoice_file" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Upload Invoice *
                  </Label>
                  <div className="rounded border-2 border-dashed border-border hover:border-primary/40 transition-colors bg-muted/30 p-6 text-center">
                    <input
                      id="invoice_file"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp"
                      onChange={handleFileChange}
                      className="hidden"
                      data-testid="warranty-invoice-file-input"
                    />
                    <label htmlFor="invoice_file" className="cursor-pointer">
                      {invoiceFile ? (
                        <div className="flex items-center justify-center gap-2 text-emerald-400">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium text-sm">{invoiceFile.name}</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to upload invoice</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">PDF, JPG, PNG, HEIC (iPhone photos supported)</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/customer')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
                  disabled={loading}
                  data-testid="submit-warranty-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Submit Registration
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

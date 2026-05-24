import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Upload, Loader2, CheckCircle, Clock, AlertTriangle,
  IndianRupee, Calendar, FileText, Eye
} from 'lucide-react';

const BADGE_BASE = 'px-2 py-0.5 text-[10px] font-mono font-semibold rounded uppercase tracking-wide ring-1';

export default function DealerDeposit() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dealer, setDealer] = useState(null);
  const [form, setForm] = useState({
    amount: '',
    payment_reference: '',
    payment_date: new Date().toISOString().split('T')[0],
    proof_file: null
  });

  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API}/dealer/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDealer(response.data);
      setForm(prev => ({ ...prev, amount: response.data.security_deposit_amount || '' }));
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.proof_file) {
      toast.error('Please upload deposit proof');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('amount', form.amount);
      formData.append('payment_reference', form.payment_reference);
      formData.append('payment_date', form.payment_date);
      formData.append('proof_file', form.proof_file);

      await axios.post(`${API}/dealer/deposit/upload-proof`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Deposit proof uploaded successfully');
      navigate('/dealer');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload proof');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'pending':  return <Clock className="w-5 h-5 text-amber-400" />;
      case 'rejected': return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      default:         return <Shield className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status) => {
    const tones = {
      approved: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
      pending:  'bg-amber-400/15 text-amber-400 ring-amber-400/25',
      rejected: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',
    };
    const tone = tones[status] || 'bg-muted text-muted-foreground ring-border';
    return <span className={`${BADGE_BASE} ${tone}`}>{(status || 'not paid').replace(/_/g, ' ')}</span>;
  };

  if (loading) {
    return (
      <DashboardLayout title="Security Deposit">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const depositStatus = dealer?.security_deposit_status || 'not_paid';
  const canUpload = depositStatus === 'not_paid' || depositStatus === 'rejected';

  return (
    <DashboardLayout title="Security Deposit">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
            Account · Onboarding
          </p>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">Security Deposit</h1>
        </div>

        {/* Status Card */}
        <div className="mg-card rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 px-5 pt-5 pb-3 border-b border-border">
            <Shield className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-foreground">Security Deposit Status</h2>
          </div>
          <div className="p-5 space-y-4">
            {/* Status row */}
            <div className="flex items-center justify-between p-4 rounded-md bg-muted/40">
              <div className="flex items-center gap-3">
                {getStatusIcon(depositStatus)}
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {depositStatus.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {depositStatus === 'approved' &&
                      `Approved on ${new Date(dealer.security_deposit_approved_at).toLocaleDateString()}`}
                    {depositStatus === 'pending' && 'Under review by admin'}
                    {depositStatus === 'rejected' && dealer.security_deposit_remarks}
                    {depositStatus === 'not_paid' && 'Please upload deposit proof to activate your account'}
                  </p>
                </div>
              </div>
              {getStatusBadge(depositStatus)}
            </div>

            {/* Amount & date grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-md bg-muted/40">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  Required Amount
                </p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-foreground flex items-center gap-1">
                  <IndianRupee className="w-4 h-4" />
                  {(dealer?.security_deposit_amount || 100000).toLocaleString('en-IN')}
                </p>
              </div>
              {dealer?.security_deposit_uploaded_at && (
                <div className="p-4 rounded-md bg-muted/40">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                    Uploaded On
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {new Date(dealer.security_deposit_uploaded_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {/* Proof file link */}
            {dealer?.security_deposit_proof_path && (
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/40">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm">Deposit Proof Uploaded</span>
                </div>
                <a
                  href={`${API.replace('/api', '')}${dealer.security_deposit_proof_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:text-primary/80 text-sm font-medium"
                >
                  <Eye className="w-4 h-4" />
                  View
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Upload Form */}
        {canUpload && (
          <div className="mg-card rounded-lg border border-border bg-card">
            <div className="px-5 pt-5 pb-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Upload Deposit Proof</h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Upload your payment proof (bank receipt, transaction screenshot, etc.)
              </p>
            </div>
            <div className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Amount Paid *
                  </Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="Enter amount"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Payment Reference / UTR
                  </Label>
                  <Input
                    value={form.payment_reference}
                    onChange={(e) => setForm({ ...form, payment_reference: e.target.value })}
                    placeholder="Transaction reference number"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Payment Date
                  </Label>
                  <Input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Upload Proof *
                  </Label>
                  <div className="border-2 border-dashed border-border rounded-md p-6 text-center hover:border-primary/50 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
                      onChange={(e) => setForm({ ...form, proof_file: e.target.files[0] })}
                      className="hidden"
                      id="proof-upload"
                    />
                    <label htmlFor="proof-upload" className="cursor-pointer">
                      {form.proof_file ? (
                        <div className="flex items-center justify-center gap-2 text-emerald-400">
                          <CheckCircle className="w-6 h-6" />
                          <span className="text-sm font-medium">{form.proof_file.name}</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-foreground">Click to upload</p>
                          <p className="text-[12px] text-muted-foreground mt-1">PDF, JPG, PNG (max 10MB)</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Deposit Proof
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Payment Instructions */}
        <div className="mg-card rounded-lg border border-border bg-card">
          <div className="px-5 pt-5 pb-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Payment Instructions</h2>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-muted-foreground">Please transfer the security deposit amount to:</p>
            <div className="p-4 rounded-md bg-muted/40 space-y-2 font-mono text-[13px]">
              <p className="text-foreground">
                <span className="text-muted-foreground">Company Name: </span>MuscleGrid Industries Pvt Ltd
              </p>
              <p className="text-foreground">
                <span className="text-muted-foreground">Account No: </span>84684684600
              </p>
              <p className="text-foreground">
                <span className="text-muted-foreground">IFSC: </span>IDFB0021525
              </p>
              <p className="text-foreground">
                <span className="text-muted-foreground">Bank: </span>IDFC First Bank
              </p>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Note: Your dealer account will be activated once the deposit is verified by our team.
              Security deposit amount: ₹1,00,000 (One Lakh Rupees)
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

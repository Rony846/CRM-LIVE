import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Upload, Loader2, CheckCircle, Clock, AlertTriangle,
  IndianRupee, Calendar, FileText, Eye
} from 'lucide-react';

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-600';
      case 'pending': return 'bg-yellow-600';
      case 'rejected': return 'bg-red-600';
      default: return 'bg-slate-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-5 h-5" />;
      case 'pending': return <Clock className="w-5 h-5" />;
      case 'rejected': return <AlertTriangle className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Security Deposit">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  const depositStatus = dealer?.security_deposit_status || 'not_paid';
  const canUpload = depositStatus === 'not_paid' || depositStatus === 'rejected';

  return (
    <DashboardLayout title="Security Deposit">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Status Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              Security Deposit Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(depositStatus)}
                <div>
                  <p className="text-white font-medium capitalize">{depositStatus.replace('_', ' ')}</p>
                  <p className="text-slate-400 text-sm">
                    {depositStatus === 'approved' && `Approved on ${new Date(dealer.security_deposit_approved_at).toLocaleDateString()}`}
                    {depositStatus === 'pending' && 'Under review by admin'}
                    {depositStatus === 'rejected' && dealer.security_deposit_remarks}
                    {depositStatus === 'not_paid' && 'Please upload deposit proof to activate your account'}
                  </p>
                </div>
              </div>
              <Badge className={getStatusColor(depositStatus)}>
                {depositStatus.replace('_', ' ')}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-900 rounded-lg">
                <p className="text-slate-400 text-sm">Required Amount</p>
                <p className="text-2xl font-bold text-white flex items-center gap-1">
                  <IndianRupee className="w-5 h-5" />
                  {dealer?.security_deposit_amount?.toLocaleString() || 'N/A'}
                </p>
              </div>
              {dealer?.security_deposit_uploaded_at && (
                <div className="p-4 bg-slate-900 rounded-lg">
                  <p className="text-slate-400 text-sm">Uploaded On</p>
                  <p className="text-lg font-medium text-white flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(dealer.security_deposit_uploaded_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {dealer?.security_deposit_proof_path && (
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <div className="flex items-center gap-2 text-slate-300">
                  <FileText className="w-4 h-4" />
                  <span>Deposit Proof Uploaded</span>
                </div>
                <a 
                  href={`${API.replace('/api', '')}${dealer.security_deposit_proof_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                >
                  <Eye className="w-4 h-4" />
                  View
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Form */}
        {canUpload && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Upload Deposit Proof</CardTitle>
              <CardDescription className="text-slate-400">
                Upload your payment proof (bank receipt, transaction screenshot, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-slate-300">Amount Paid *</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="Enter amount"
                    required
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Payment Reference / UTR</Label>
                  <Input
                    value={form.payment_reference}
                    onChange={(e) => setForm({ ...form, payment_reference: e.target.value })}
                    placeholder="Transaction reference number"
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Payment Date</Label>
                  <Input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Upload Proof *</Label>
                  <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-cyan-500 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
                      onChange={(e) => setForm({ ...form, proof_file: e.target.files[0] })}
                      className="hidden"
                      id="proof-upload"
                    />
                    <label htmlFor="proof-upload" className="cursor-pointer">
                      {form.proof_file ? (
                        <div className="flex items-center justify-center gap-2 text-green-400">
                          <CheckCircle className="w-6 h-6" />
                          <span>{form.proof_file.name}</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                          <p className="text-slate-300">Click to upload</p>
                          <p className="text-slate-500 text-sm mt-1">PDF, JPG, PNG (max 10MB)</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <Button type="submit" disabled={submitting} className="w-full bg-cyan-600 hover:bg-cyan-700">
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Deposit Proof
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Payment Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-300 space-y-3">
            <p>Please transfer the security deposit amount to:</p>
            <div className="p-4 bg-slate-900 rounded-lg space-y-2">
              <p><strong>Bank:</strong> MuscleGrid Energy Solutions</p>
              <p><strong>Account No:</strong> XXXXXXXXXX</p>
              <p><strong>IFSC:</strong> XXXXXXXXX</p>
              <p><strong>UPI:</strong> dealer@musclegrid</p>
            </div>
            <p className="text-slate-400 text-sm">
              Note: Your dealer account will be activated once the deposit is verified by our team.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

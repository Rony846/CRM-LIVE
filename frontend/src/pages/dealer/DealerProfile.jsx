import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { User, Phone, Mail, MapPin, Building2, FileText, Shield, Loader2, Save, Eye, EyeOff } from 'lucide-react';

export default function DealerProfile() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dealer, setDealer] = useState(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (token) {
      fetchDealerProfile();
    }
  }, [token]);

  const fetchDealerProfile = async () => {
    try {
      const response = await axios.get(`${API}/dealer/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDealer(response.data.dealer);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.new.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setSaving(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: passwordForm.current,
        new_password: passwordForm.new
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Password changed successfully');
      setPasswordForm({ current: '', new: '', confirm: '' });
      setShowPasswordChange(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="My Profile">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  const depositStatus = dealer?.security_deposit_status || dealer?.security_deposit?.status;

  return (
    <DashboardLayout title="My Profile">
      <div className="space-y-6 max-w-4xl">
        {/* Profile Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5 text-cyan-400" />
              Dealer Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Firm Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-400 text-sm">Firm Name</Label>
                  <p className="text-white text-lg font-medium">{dealer?.firm_name}</p>
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">Contact Person</Label>
                  <p className="text-white">{dealer?.contact_person}</p>
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">Phone</Label>
                  <p className="text-white flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {dealer?.phone}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">Email</Label>
                  <p className="text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {user?.email}
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-400 text-sm">GST Number</Label>
                  <p className="text-white">{dealer?.gst_number || 'Not provided'}</p>
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">Address</Label>
                  <p className="text-white flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                    <span>
                      {dealer?.address?.line1 || dealer?.address_line1}<br />
                      {dealer?.address?.city || dealer?.city}, {dealer?.address?.state || dealer?.state} - {dealer?.address?.pincode || dealer?.pincode}
                    </span>
                  </p>
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">Account Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={dealer?.status === 'approved' ? 'bg-green-600' : 'bg-yellow-600'}>
                      {dealer?.status}
                    </Badge>
                    <Badge className={depositStatus === 'approved' ? 'bg-green-600' : 'bg-yellow-600'}>
                      <Shield className="w-3 h-3 mr-1" />
                      Deposit: {depositStatus}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Deposit Info */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              Security Deposit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-900 rounded-lg">
                <p className="text-slate-400 text-sm">Amount</p>
                <p className="text-white text-xl font-bold">
                  ₹{(dealer?.security_deposit?.amount || dealer?.security_deposit_amount || 100000).toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-slate-900 rounded-lg">
                <p className="text-slate-400 text-sm">Status</p>
                <Badge className={depositStatus === 'approved' ? 'bg-green-600' : depositStatus === 'pending_review' ? 'bg-yellow-600' : 'bg-red-600'}>
                  {depositStatus === 'approved' ? 'Paid & Verified' : depositStatus === 'pending_review' ? 'Under Review' : 'Pending'}
                </Badge>
              </div>
              <div className="p-4 bg-slate-900 rounded-lg">
                <p className="text-slate-400 text-sm">Portal Access</p>
                <p className="text-white">
                  {depositStatus === 'approved' ? (
                    <span className="text-green-400">✓ Full Access</span>
                  ) : (
                    <span className="text-yellow-400">Limited (Deposit Required)</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Security
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                className="border-slate-600 text-slate-300"
              >
                {showPasswordChange ? 'Cancel' : 'Change Password'}
              </Button>
            </CardTitle>
          </CardHeader>
          {showPasswordChange && (
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-300">Current Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-white pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-slate-300">New Password</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Confirm New Password</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>
              <Button 
                onClick={handlePasswordChange} 
                disabled={saving}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Save className="w-4 h-4 mr-2" />
                Update Password
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

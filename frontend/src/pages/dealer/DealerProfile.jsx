import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User, Phone, Mail, MapPin, Building2, FileText, Shield, Loader2, Save, Eye, EyeOff } from 'lucide-react';

const BADGE_BASE = 'px-2 py-0.5 text-[10px] font-mono font-semibold rounded uppercase tracking-wide ring-1';

const StatusBadge = ({ status, fallback = 'unknown' }) => {
  const tones = {
    approved:       'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
    pending:        'bg-amber-400/15 text-amber-400 ring-amber-400/25',
    pending_review: 'bg-amber-400/15 text-amber-400 ring-amber-400/25',
    rejected:       'bg-rose-500/15 text-rose-400 ring-rose-500/25',
  };
  const tone = tones[status] || 'bg-muted text-muted-foreground ring-border';
  return <span className={`${BADGE_BASE} ${tone}`}>{(status || fallback).replace(/_/g, ' ')}</span>;
};

const FieldRow = ({ icon: Icon, label, value }) => (
  <div>
    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">{label}</p>
    <p className="text-sm text-foreground flex items-center gap-2">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      {value}
    </p>
  </div>
);

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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const depositStatus = dealer?.security_deposit_status || dealer?.security_deposit?.status;

  return (
    <DashboardLayout title="My Profile">
      <div className="space-y-6 max-w-4xl">
        {/* Page header */}
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
            Account · Settings
          </p>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">My Profile</h1>
        </div>

        {/* Profile details */}
        <div className="mg-card rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 px-5 pt-5 pb-3 border-b border-border">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/15 text-primary">
              <User className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Dealer Profile</h2>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Column 1 */}
              <div className="space-y-5">
                <FieldRow label="Firm Name" value={<span className="text-base font-semibold">{dealer?.firm_name}</span>} />
                <FieldRow label="Contact Person" value={dealer?.contact_person} />
                <FieldRow icon={Phone} label="Phone" value={dealer?.phone} />
                <FieldRow icon={Mail} label="Email" value={user?.email} />
              </div>

              {/* Column 2 */}
              <div className="space-y-5">
                <FieldRow label="GST Number" value={dealer?.gst_number || 'Not provided'} />
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
                    Address
                  </p>
                  <p className="text-sm text-foreground flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span>
                      {dealer?.address?.line1 || dealer?.address_line1}<br />
                      {dealer?.address?.city || dealer?.city},{' '}
                      {dealer?.address?.state || dealer?.state} &mdash; {dealer?.address?.pincode || dealer?.pincode}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-2">
                    Account Status
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={dealer?.status} />
                    <span className={`${BADGE_BASE} ${
                      depositStatus === 'approved'
                        ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
                        : 'bg-amber-400/15 text-amber-400 ring-amber-400/25'
                    } flex items-center gap-1`}>
                      <Shield className="w-2.5 h-2.5" />
                      Deposit: {depositStatus?.replace(/_/g, ' ') || 'pending'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Deposit */}
        <div className="mg-card rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 px-5 pt-5 pb-3 border-b border-border">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-sky-400/15 text-sky-400">
              <Shield className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Security Deposit</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-md bg-muted/40">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Amount</p>
                <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-foreground">
                  ₹{(dealer?.security_deposit?.amount || dealer?.security_deposit_amount || 100000).toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-md bg-muted/40">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-2">Status</p>
                <StatusBadge status={depositStatus} fallback="pending" />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {depositStatus === 'approved' ? 'Paid & Verified' : depositStatus === 'pending_review' ? 'Under Review' : 'Pending'}
                </p>
              </div>
              <div className="p-4 rounded-md bg-muted/40">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Portal Access</p>
                <p className="mt-1.5 text-sm font-medium">
                  {depositStatus === 'approved' ? (
                    <span className="text-emerald-400">Full Access</span>
                  ) : (
                    <span className="text-amber-400">Limited (Deposit Required)</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="mg-card rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-violet-400/15 text-violet-400">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Security</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPasswordChange(!showPasswordChange)}
            >
              {showPasswordChange ? 'Cancel' : 'Change Password'}
            </Button>
          </div>

          {showPasswordChange && (
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Current Password
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  New Password
                </Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Confirm New Password
                </Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                />
              </div>

              <Button onClick={handlePasswordChange} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Save className="w-4 h-4 mr-2" />
                Update Password
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

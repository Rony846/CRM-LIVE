import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';
import { toast } from 'sonner';
import { User, Phone, Mail, MapPin, FileText, Shield, Loader2, Save, Eye, EyeOff } from 'lucide-react';

// Map a raw status string to an Iron badge tone.
const statusTone = (s) => {
  const t = {
    approved: 'ok', pending: 'warn', pending_review: 'warn', rejected: 'bad',
  };
  return t[s] || 'slate';
};

const StatusPill = ({ status, fallback = 'unknown' }) => {
  const label = (status || fallback).replace(/_/g, ' ');
  return <span style={badgeStyle(statusTone(status))}>{label}</span>;
};

const FieldRow = ({ icon: Icon, label, value }) => (
  <div>
    <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 4 }}>{label}</Caps>
    <div style={{ fontSize: 13, color: T.iron900, display: 'flex', alignItems: 'center', gap: 8 }}>
      {Icon && <Icon size={15} strokeWidth={1.75} color={T.iron400} style={{ flexShrink: 0 }} />}
      <span>{value}</span>
    </div>
  </div>
);

const SectionHead = ({ icon: Icon, title, tint, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${T.iron200}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, display: 'grid', placeItems: 'center', background: tint || T.iron100, color: T.orangeDeep }}>
        <Icon size={15} strokeWidth={1.9} />
      </div>
      <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900 }}>{title}</span>
    </div>
    {right}
  </div>
);

const inputStyle = {
  border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '8px 10px', fontSize: 12.5,
  color: T.iron900, background: T.white, outline: 'none', width: '100%',
};

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

  const depositStatus = dealer?.security_deposit_status || dealer?.security_deposit?.status;

  if (loading) {
    return (
      <IronShell title="My Profile" subtitle="ACCOUNT · SETTINGS">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
          <Loader2 className="w-8 h-8 animate-spin" color={T.orange} />
        </div>
      </IronShell>
    );
  }

  return (
    <IronShell title="My Profile" subtitle="ACCOUNT · SETTINGS" onRefresh={fetchDealerProfile}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 920 }}>

        {/* Dealer Profile */}
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <SectionHead icon={User} title="Dealer Profile" tint="#FDEEE6" />
          <div style={{ padding: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22 }}>
              {/* Column 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <FieldRow label="Firm Name" value={<span style={{ fontSize: 15, fontWeight: 700 }}>{dealer?.firm_name}</span>} />
                <FieldRow label="Contact Person" value={dealer?.contact_person} />
                <FieldRow icon={Phone} label="Phone" value={<span style={mono}>{dealer?.phone}</span>} />
                <FieldRow icon={Mail} label="Email" value={user?.email} />
              </div>

              {/* Column 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <FieldRow label="GST Number" value={<span style={mono}>{dealer?.gst_number || 'Not provided'}</span>} />
                <div>
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 4 }}>Address</Caps>
                  <div style={{ fontSize: 13, color: T.iron900, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <MapPin size={15} strokeWidth={1.75} color={T.iron400} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      {dealer?.address?.line1 || dealer?.address_line1}<br />
                      {dealer?.address?.city || dealer?.city},{' '}
                      {dealer?.address?.state || dealer?.state} &mdash; {dealer?.address?.pincode || dealer?.pincode}
                    </span>
                  </div>
                </div>
                <div>
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>Account Status</Caps>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <StatusPill status={dealer?.status} />
                    <span style={{ ...badgeStyle(depositStatus === 'approved' ? 'ok' : 'warn'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Shield size={10} strokeWidth={2.2} />
                      Deposit: {depositStatus?.replace(/_/g, ' ') || 'pending'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </IronCard>

        {/* Security Deposit */}
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <SectionHead icon={Shield} title="Security Deposit" tint={T.blueTint} />
          <div style={{ padding: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div style={{ padding: 14, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <Caps size={9} color={T.iron400}>Amount</Caps>
                <div style={{ ...mono, marginTop: 6, fontSize: 21, fontWeight: 700, color: T.iron900 }}>
                  ₹{(dealer?.security_deposit?.amount || dealer?.security_deposit_amount || 100000).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ padding: 14, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>Status</Caps>
                <StatusPill status={depositStatus} fallback="pending" />
                <div style={{ marginTop: 6, fontSize: 11, color: T.iron500 }}>
                  {depositStatus === 'approved' ? 'Paid & Verified' : depositStatus === 'pending_review' ? 'Under Review' : 'Pending'}
                </div>
              </div>
              <div style={{ padding: 14, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <Caps size={9} color={T.iron400}>Portal Access</Caps>
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>
                  {depositStatus === 'approved' ? (
                    <span style={{ color: T.green }}>Full Access</span>
                  ) : (
                    <span style={{ color: T.voltageText }}>Limited (Deposit Required)</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </IronCard>

        {/* Change Password */}
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <SectionHead
            icon={FileText}
            title="Security"
            tint="#EEE9F7"
            right={
              <button
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                style={{ border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '7px 13px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                {showPasswordChange ? 'Cancel' : 'Change Password'}
              </button>
            }
          />

          {showPasswordChange && (
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Caps size={9} color={T.iron400}>Current Password</Caps>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    style={{ ...inputStyle, paddingRight: 38 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: T.iron400, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Caps size={9} color={T.iron400}>New Password</Caps>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Caps size={9} color={T.iron400}>Confirm New Password</Caps>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <button
                onClick={handlePasswordChange}
                disabled={saving}
                style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Update Password
              </button>
            </div>
          )}
        </IronCard>
      </div>
    </IronShell>
  );
}

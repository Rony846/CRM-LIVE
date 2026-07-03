import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/App';
import { toast } from 'sonner';
import { Loader2, User, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { T, Fonts } from '@/components/iron/IronKit';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CompleteProfilePage() {
  const { user, token, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const missingFields = location.state?.missingFields || [];

  const [formData, setFormData] = useState({
    first_name: user?.first_name === 'Customer' ? '' : user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email?.endsWith('@temp.musclegrid.in') ? '' : user?.email || '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    pincode: user?.pincode || ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      navigate('/login');
    }
  }, [user, token, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/auth/complete-profile`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local user state
      const updatedUser = response.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      toast.success('Profile completed successfully!');

      // Redirect to customer dashboard
      navigate('/customer');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to update profile. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const isFieldMissing = (field) => missingFields.includes(field);

  // --- Iron Console styling primitives ---
  const canvas = {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: 'radial-gradient(1200px 600px at 50% -10%, #23262B, #141517)',
    fontFamily: T.body,
  };
  const card = {
    width: 'min(520px, 100%)',
    background: T.white,
    borderRadius: 14,
    padding: '32px 30px',
    boxShadow: '0 30px 80px rgba(0,0,0,.45)',
    border: `1px solid ${T.iron200}`,
  };
  const labelStyle = (missing) => ({
    display: 'block',
    fontFamily: T.mono,
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    color: missing ? T.orangeDeep : T.iron400,
    marginBottom: 6,
  });
  const inputStyle = (missing) => ({
    width: '100%',
    border: `1px solid ${missing ? T.orange : T.iron200}`,
    borderRadius: 8,
    padding: '11px 13px',
    fontSize: 14,
    color: T.iron900,
    background: T.white,
    outline: 'none',
    fontFamily: T.body,
  });
  const primaryBtn = {
    width: '100%',
    border: 'none',
    background: loading ? T.orangeDeep : T.orange,
    color: '#fff',
    borderRadius: 9,
    padding: '12px 0',
    fontFamily: T.headline,
    fontWeight: 700,
    fontSize: 14.5,
    cursor: loading ? 'default' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  };

  return (
    <div style={canvas}>
      <Fonts />
      <div style={card}>
        {/* Brand / header */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#FDEEE6',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              border: `1px solid ${T.iron200}`,
            }}
          >
            <User style={{ width: 28, height: 28, color: T.orange }} />
          </div>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 800,
              fontSize: 30,
              letterSpacing: '.01em',
              color: T.iron900,
              lineHeight: 1.05,
            }}
          >
            Muscle<span style={{ color: T.orange }}>Grid</span>
          </div>
          <div
            style={{
              fontFamily: T.headline,
              fontWeight: 700,
              fontSize: 18,
              color: T.iron900,
              marginTop: 12,
            }}
          >
            Complete Your Profile
          </div>
          <div style={{ fontFamily: T.body, fontSize: 13, color: T.iron500, marginTop: 4 }}>
            Please fill in the missing details to continue
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label htmlFor="first_name" style={labelStyle(isFieldMissing('first_name'))}>
                First Name {isFieldMissing('first_name') && <span style={{ color: T.orange }}>*</span>}
              </label>
              <input
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="Your first name"
                required={isFieldMissing('first_name')}
                style={inputStyle(isFieldMissing('first_name'))}
              />
            </div>
            <div>
              <label htmlFor="last_name" style={labelStyle(false)}>Last Name</label>
              <input
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Your last name"
                style={inputStyle(false)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" style={labelStyle(isFieldMissing('email'))}>
              Email Address {isFieldMissing('email') && <span style={{ color: T.orange }}>*</span>}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your.email@example.com"
              required={isFieldMissing('email')}
              style={inputStyle(isFieldMissing('email'))}
            />
          </div>

          <div>
            <label htmlFor="address" style={labelStyle(isFieldMissing('address'))}>
              Address {isFieldMissing('address') && <span style={{ color: T.orange }}>*</span>}
            </label>
            <input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="House/Flat No., Street, Locality"
              required={isFieldMissing('address')}
              style={inputStyle(isFieldMissing('address'))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label htmlFor="city" style={labelStyle(isFieldMissing('city'))}>
                City {isFieldMissing('city') && <span style={{ color: T.orange }}>*</span>}
              </label>
              <input
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
                required={isFieldMissing('city')}
                style={inputStyle(isFieldMissing('city'))}
              />
            </div>
            <div>
              <label htmlFor="state" style={labelStyle(false)}>State</label>
              <input
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="State"
                style={inputStyle(false)}
              />
            </div>
            <div>
              <label htmlFor="pincode" style={labelStyle(isFieldMissing('pincode'))}>
                Pincode {isFieldMissing('pincode') && <span style={{ color: T.orange }}>*</span>}
              </label>
              <input
                id="pincode"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                placeholder="Pincode"
                maxLength={6}
                required={isFieldMissing('pincode')}
                style={inputStyle(isFieldMissing('pincode'))}
              />
            </div>
          </div>

          {missingFields.length > 0 && (
            <div
              style={{
                padding: '12px 13px',
                background: '#FDEEE6',
                border: `1px solid #F6D8BA`,
                borderRadius: 8,
                fontSize: 13,
                color: T.orangeDeep,
              }}
            >
              <span style={{ fontWeight: 600 }}>Please fill in the highlighted fields to continue.</span>
            </div>
          )}

          <button type="submit" style={primaryBtn} disabled={loading}>
            {loading ? (
              <>
                <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 style={{ width: 16, height: 16 }} />
                Complete Profile
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

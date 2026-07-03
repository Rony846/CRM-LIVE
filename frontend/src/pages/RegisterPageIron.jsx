import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/App';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { T, Fonts } from '@/components/iron/IronKit';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const userData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: 'customer'
      };

      await register(userData);
      toast.success('Account created successfully!');
      navigate('/customer');
    } catch (error) {
      const message = error.response?.data?.detail || 'Registration failed. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = {
    display: 'block',
    fontFamily: T.mono,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    color: T.iron400,
    marginBottom: 6,
  };

  const inputStyle = {
    width: '100%',
    border: `1px solid ${T.iron200}`,
    borderRadius: 8,
    padding: '11px 13px',
    fontSize: 14,
    color: T.iron900,
    background: T.white,
    outline: 'none',
    fontFamily: T.body,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        background: 'radial-gradient(1200px 600px at 50% -10%, #23262B, #141517)',
      }}
    >
      <Fonts />
      <div
        style={{
          width: 'min(420px, 100%)',
          background: T.white,
          borderRadius: 14,
          padding: '32px 30px',
          boxShadow: '0 30px 80px rgba(0,0,0,.45)',
          border: `1px solid ${T.iron200}`,
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 800,
              fontSize: 30,
              letterSpacing: '.02em',
              color: T.iron900,
              lineHeight: 1,
            }}
          >
            Muscle<span style={{ color: T.orange }}>Grid</span>
          </div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.22em',
              textTransform: 'uppercase',
              color: T.iron400,
              marginTop: 8,
            }}
          >
            Iron Console
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 20, color: T.iron900 }}>
            Create Account
          </div>
          <div style={{ fontFamily: T.body, fontSize: 13, color: T.iron500, marginTop: 4 }}>
            Register as a customer to get started
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label htmlFor="first_name" style={labelStyle}>First Name</label>
              <input
                id="first_name"
                name="first_name"
                placeholder="John"
                value={formData.first_name}
                onChange={handleChange}
                required
                style={inputStyle}
                data-testid="register-firstname-input"
              />
            </div>
            <div>
              <label htmlFor="last_name" style={labelStyle}>Last Name</label>
              <input
                id="last_name"
                name="last_name"
                placeholder="Doe"
                value={formData.last_name}
                onChange={handleChange}
                required
                style={inputStyle}
                data-testid="register-lastname-input"
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="email" style={labelStyle}>Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              style={inputStyle}
              data-testid="register-email-input"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="phone" style={labelStyle}>Phone Number</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={handleChange}
              required
              style={inputStyle}
              data-testid="register-phone-input"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="password" style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
                style={{ ...inputStyle, paddingRight: 40 }}
                data-testid="register-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: T.iron500,
                  display: 'flex',
                  padding: 0,
                }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <label htmlFor="confirmPassword" style={labelStyle}>Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Re-enter password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              style={inputStyle}
              data-testid="register-confirm-password-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            data-testid="register-submit-btn"
            style={{
              width: '100%',
              border: 'none',
              background: loading ? T.orangeDeep : T.orange,
              color: '#fff',
              borderRadius: 9,
              padding: '12px 0',
              fontFamily: T.headline,
              fontWeight: 700,
              fontSize: 14.5,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <span style={{ fontFamily: T.body, fontSize: 13, color: T.iron500 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: T.orange, fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}

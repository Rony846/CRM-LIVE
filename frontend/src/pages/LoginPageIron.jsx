import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/App';
import { toast } from 'sonner';
import { Eye, EyeOff, Zap, Loader2, Users, Smartphone, Mail, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { T, Fonts } from '@/components/iron/IronKit';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function LoginPage() {
  const [loginMode, setLoginMode] = useState('email'); // 'email' or 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { login, setUser, setToken } = useAuth();
  const navigate = useNavigate();

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.first_name}!`);
      redirectUser(user);
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/auth/otp/send`, { phone });
      toast.success(response.data.message);
      setOtpSent(true);
      setCountdown(30); // 30 second cooldown for resend
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to send OTP. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/auth/otp/verify`, { phone, otp });
      const { access_token, user } = response.data;

      // Store token and user (using mg_token to match App.js AuthContext)
      localStorage.setItem('mg_token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      setToken(access_token);
      setUser(user);

      // Check if profile is incomplete
      if (user.profile_incomplete || user.missing_fields?.length > 0) {
        toast.info('Please complete your profile to continue');
        navigate('/complete-profile', { state: { missingFields: user.missing_fields } });
      } else {
        toast.success(`Welcome back, ${user.first_name}!`);
        redirectUser(user);
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Invalid OTP. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/auth/otp/resend`, { phone });
      toast.success(response.data.message);
      setCountdown(30);
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to resend OTP.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const redirectUser = (user) => {
    const routes = {
      customer: '/customer',
      call_support: '/support',
      supervisor: '/supervisor',
      service_agent: '/service',
      technician: '/technician',
      accountant: '/accountant',
      dispatcher: '/dispatcher',
      gate: '/gate',
      admin: '/admin',
      dealer: '/dealer',
      ca: '/ca',
      importer: '/importer',
      lawyer: '/legal'
    };
    navigate(routes[user.role] || '/');
  };

  const resetOTPFlow = () => {
    setOtpSent(false);
    setOtp('');
    setPhone('');
  };

  // ---- Iron Console styles ----
  const labelStyle = {
    display: 'block', fontFamily: T.mono, fontWeight: 500, fontSize: 10,
    letterSpacing: '.12em', textTransform: 'uppercase', color: T.iron400, marginBottom: 6,
  };
  const inputStyle = {
    width: '100%', border: `1px solid ${T.iron200}`, borderRadius: 8, padding: '11px 13px',
    fontSize: 14, color: T.iron900, background: T.white, outline: 'none', fontFamily: T.body,
  };
  const primaryBtn = (disabled) => ({
    width: '100%', border: 'none', background: disabled ? T.iron400 : T.orange, color: '#fff',
    borderRadius: 9, padding: '12px 0', fontFamily: T.headline, fontWeight: 700, fontSize: 14.5,
    cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: 8, transition: 'background .15s',
  });
  const toggleBtn = (active) => ({
    flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? '#FDEEE6' : T.white,
    color: active ? T.orangeDeep : T.iron500, borderRadius: 8, padding: '9px 0',
    fontFamily: T.headline, fontWeight: 700, fontSize: 13, cursor: 'pointer',
  });

  return (
    <div
      style={{
        minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: T.body,
        background: 'radial-gradient(1200px 600px at 50% -10%, #23262B, #141517)',
      }}
    >
      <Fonts />
      <div
        style={{
          width: 'min(420px, 100%)', background: T.white, borderRadius: 14, padding: '32px 30px',
          boxShadow: '0 30px 80px rgba(0,0,0,.45)', border: `1px solid ${T.iron200}`,
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
          <div
            style={{
              width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg, ${T.orange}, ${T.orangeDeep})`, marginBottom: 12,
            }}
          >
            <Zap style={{ width: 26, height: 26, color: '#fff' }} fill="#fff" />
          </div>
          <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 30, letterSpacing: '.01em', color: T.iron900, lineHeight: 1 }}>
            Muscle<span style={{ color: T.orange }}>Grid</span>
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: T.iron400, marginTop: 8 }}>
            Iron Console · Sign In
          </div>
        </div>

        {/* Login Mode Toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          <button
            type="button"
            style={toggleBtn(loginMode === 'email')}
            onClick={() => { setLoginMode('email'); resetOTPFlow(); }}
          >
            <Mail style={{ width: 15, height: 15 }} />
            Email
          </button>
          <button
            type="button"
            style={toggleBtn(loginMode === 'otp')}
            onClick={() => setLoginMode('otp')}
          >
            <Smartphone style={{ width: 15, height: 15 }} />
            OTP
          </button>
        </div>

        {/* Email/Password Login */}
        {loginMode === 'email' && (
          <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="email" style={labelStyle}>Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="password" style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="login-password-input"
                  style={{ ...inputStyle, paddingRight: 40 }}
                />
                <button
                  type="button"
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: T.iron500, padding: 0,
                    display: 'flex', alignItems: 'center',
                  }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: -4 }}>
              <Link to="/forgot-password" style={{ fontSize: 13, color: T.orange, textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              style={primaryBtn(loading)}
              disabled={loading}
              data-testid="login-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        )}

        {/* OTP Login */}
        {loginMode === 'otp' && !otpSent && (
          <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="phone" style={labelStyle}>Mobile Number</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{
                    width: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: T.iron100, border: `1px solid ${T.iron200}`, borderRadius: 8,
                    fontSize: 14, color: T.iron500,
                  }}
                >
                  +91
                </div>
                <input
                  id="phone"
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  required
                  data-testid="login-phone-input"
                  style={inputStyle}
                />
              </div>
              <p style={{ fontSize: 12, color: T.iron400, marginTop: 8, marginBottom: 0 }}>
                Enter the mobile number registered with your previous complaint or account
              </p>
            </div>

            <button
              type="submit"
              style={primaryBtn(loading || phone.length !== 10)}
              disabled={loading || phone.length !== 10}
              data-testid="send-otp-btn"
            >
              {loading ? (
                <>
                  <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                  Sending OTP...
                </>
              ) : (
                <>
                  <Smartphone style={{ width: 16, height: 16 }} />
                  Send OTP
                </>
              )}
            </button>
          </form>
        )}

        {/* OTP Verification */}
        {loginMode === 'otp' && otpSent && (
          <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button
              type="button"
              onClick={resetOTPFlow}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 13, color: T.iron500, padding: 0, alignSelf: 'flex-start',
              }}
            >
              <ArrowLeft style={{ width: 15, height: 15 }} />
              Change number
            </button>

            <div
              style={{
                padding: 12, background: T.blueTint, border: `1px solid #CBE0F0`, borderRadius: 8,
                fontSize: 13, color: T.blue,
              }}
            >
              OTP sent to <span style={{ fontWeight: 700 }}>+91 ******{phone.slice(-4)}</span>
            </div>

            <div>
              <label htmlFor="otp" style={labelStyle}>Enter OTP</label>
              <input
                id="otp"
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                autoFocus
                data-testid="otp-input"
                style={{ ...inputStyle, textAlign: 'center', fontSize: 24, letterSpacing: '.4em', fontFamily: T.mono }}
              />
            </div>

            <button
              type="submit"
              style={primaryBtn(loading || otp.length !== 6)}
              disabled={loading || otp.length !== 6}
              data-testid="verify-otp-btn"
            >
              {loading ? (
                <>
                  <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Login'
              )}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={countdown > 0 || loading}
                style={{
                  background: 'none', border: 'none', fontSize: 13, padding: 0,
                  color: countdown > 0 ? T.iron400 : T.orange,
                  cursor: countdown > 0 || loading ? 'not-allowed' : 'pointer',
                }}
              >
                {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: T.iron500, margin: 0 }}>
            New customer?{' '}
            <Link to="/register" style={{ color: T.orange, textDecoration: 'none', fontWeight: 600 }}>
              Create an account
            </Link>
          </p>
        </div>

        {/* Dealer Portal Button */}
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${T.iron200}` }}>
          <Link to="/partners" style={{ textDecoration: 'none' }}>
            <button
              type="button"
              style={{
                width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 9,
                padding: '11px 0', fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
              }}
            >
              <Users style={{ width: 16, height: 16 }} />
              Dealer / Partner Portal
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

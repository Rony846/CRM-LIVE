import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/App';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Phone, Mail, Smartphone, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { T, Fonts } from '@/components/iron/IronKit';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DealerLogin() {
  const [loginMode, setLoginMode] = useState('password'); // 'password' or 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { login, user, setUser, setToken } = useAuth();
  const navigate = useNavigate();

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // If already logged in as dealer, redirect to dealer dashboard
  useEffect(() => {
    if (user && user.role === 'dealer') {
      navigate('/dealer');
    }
  }, [user, navigate]);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const loggedInUser = await login(email, password);

      if (loggedInUser.role !== 'dealer') {
        toast.error('This portal is only for authorized dealers. Please use the main CRM login.');
        return;
      }

      toast.success(`Welcome back, ${loggedInUser.first_name}!`);
      navigate('/dealer');
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed. Please check your credentials.';
      // OTP-only dealer (no password set) — flip them straight to the OTP tab.
      if (error.response?.status === 400 && /OTP/i.test(message)) {
        setLoginMode('otp');
        resetOTPFlow();
        toast.info('This account uses OTP login — enter your registered mobile number.');
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/dealer/auth/otp/send`, { phone });
      toast.success(response.data.message);
      setOtpSent(true);
      setCountdown(30);
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
      const response = await axios.post(`${API_URL}/api/dealer/auth/otp/verify`, { phone, otp });
      const { access_token, user: userData, dealer } = response.data;

      // Store token and user (using mg_token to match App.js AuthContext)
      localStorage.setItem('mg_token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setToken(access_token);
      setUser(userData);

      toast.success(`Welcome back, ${dealer?.firm_name || userData.first_name}!`);
      navigate('/dealer');
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
      const response = await axios.post(`${API_URL}/api/dealer/auth/otp/send`, { phone });
      toast.success('OTP resent successfully');
      setCountdown(30);
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to resend OTP.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const resetOTPFlow = () => {
    setOtpSent(false);
    setOtp('');
  };

  // ---- Iron Console styles ----
  const labelStyle = {
    display: 'block',
    fontFamily: T.mono,
    fontSize: 10.5,
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
  const primaryBtn = {
    width: '100%',
    border: 'none',
    background: T.orange,
    color: '#fff',
    borderRadius: 9,
    padding: '12px 0',
    fontFamily: T.headline,
    fontWeight: 700,
    fontSize: 14.5,
    cursor: loading ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: loading ? 0.85 : 1,
  };
  const tabBtn = (active) => ({
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '9px 0',
    borderRadius: 7,
    border: 'none',
    cursor: 'pointer',
    fontFamily: T.headline,
    fontWeight: 700,
    fontSize: 13,
    background: active ? T.orange : 'transparent',
    color: active ? '#fff' : T.iron500,
  });

  return (
    <div
      className="iron"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        background: 'radial-gradient(1200px 600px at 50% -10%, #23262B, #141517)',
        fontFamily: T.body,
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
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 800,
              fontSize: 30,
              letterSpacing: '.01em',
              color: T.iron900,
              lineHeight: 1,
            }}
          >
            Muscle<span style={{ color: T.orange }}>Grid</span>
          </div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '.18em',
              textTransform: 'uppercase',
              color: T.orange,
              marginTop: 8,
            }}
          >
            Partner Portal
          </div>
          <div
            style={{
              fontFamily: T.headline,
              fontSize: 18,
              fontWeight: 700,
              color: T.iron900,
              marginTop: 16,
            }}
          >
            Dealer Login
          </div>
          <div style={{ fontSize: 13, color: T.iron500, marginTop: 4 }}>
            Sign in to access your dealer dashboard
          </div>
        </div>

        {/* Login Mode Toggle */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 22,
            padding: 4,
            background: T.iron100,
            borderRadius: 9,
          }}
        >
          <button
            type="button"
            onClick={() => { setLoginMode('password'); resetOTPFlow(); }}
            style={tabBtn(loginMode === 'password')}
          >
            <Mail style={{ width: 15, height: 15 }} />
            Password
          </button>
          <button
            type="button"
            onClick={() => setLoginMode('otp')}
            style={tabBtn(loginMode === 'otp')}
          >
            <Smartphone style={{ width: 15, height: 15 }} />
            OTP
          </button>
        </div>

        {/* Password Login */}
        {loginMode === 'password' && (
          <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="email" style={labelStyle}>Email</label>
              <input
                id="email"
                type="email"
                placeholder="dealer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
                data-testid="dealer-login-email"
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
                  style={{ ...inputStyle, paddingRight: 40 }}
                  data-testid="dealer-login-password"
                />
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: T.iron400,
                    display: 'flex',
                  }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: -6 }}>
              <Link
                to="/forgot-password"
                style={{ fontSize: 12, color: T.orange, textDecoration: 'none', fontWeight: 600 }}
              >
                Forgot password?
              </Link>
            </div>

            <button type="submit" style={primaryBtn} disabled={loading} data-testid="dealer-login-submit">
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

        {/* OTP Login - Phone Entry */}
        {loginMode === 'otp' && !otpSent && (
          <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="phone" style={labelStyle}>Registered Mobile Number</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{
                    width: 58,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: T.iron100,
                    border: `1px solid ${T.iron200}`,
                    borderRadius: 8,
                    fontSize: 14,
                    color: T.iron500,
                    fontFamily: T.mono,
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
                  style={inputStyle}
                  data-testid="dealer-otp-phone"
                />
              </div>
              <p style={{ fontSize: 12, color: T.iron400, marginTop: 8 }}>
                Enter the mobile number registered with your dealer account
              </p>
            </div>

            <button
              type="submit"
              style={primaryBtn}
              disabled={loading || phone.length !== 10}
              data-testid="dealer-send-otp"
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

        {/* OTP Login - OTP Entry */}
        {loginMode === 'otp' && otpSent && (
          <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button
              type="button"
              onClick={resetOTPFlow}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: T.iron500,
                padding: 0,
                alignSelf: 'flex-start',
              }}
            >
              <ArrowLeft style={{ width: 15, height: 15 }} />
              Change number
            </button>

            <div
              style={{
                padding: '10px 12px',
                background: T.greenTint,
                border: `1px solid #CBE5D6`,
                borderRadius: 8,
                fontSize: 13,
                color: T.green,
              }}
            >
              OTP sent to{' '}
              <span style={{ fontFamily: T.mono, fontWeight: 700 }}>+91 ******{phone.slice(-4)}</span>
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
                style={{
                  ...inputStyle,
                  textAlign: 'center',
                  fontSize: 24,
                  letterSpacing: '.4em',
                  fontFamily: T.mono,
                }}
                data-testid="dealer-otp-input"
              />
            </div>

            <button
              type="submit"
              style={primaryBtn}
              disabled={loading || otp.length !== 6}
              data-testid="dealer-verify-otp"
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
                  background: 'none',
                  border: 'none',
                  cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  color: countdown > 0 ? T.iron400 : T.orange,
                }}
              >
                {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}

        {/* Footer / Register + Contact */}
        <div style={{ marginTop: 24, paddingTop: 22, borderTop: `1px solid ${T.iron200}` }}>
          <p style={{ fontSize: 13, color: T.iron500, textAlign: 'center', marginBottom: 14 }}>
            Not a registered dealer yet?
          </p>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Link to="/partners/register" style={{ textDecoration: 'none' }}>
              <span
                style={{
                  display: 'block',
                  width: '100%',
                  border: `1px solid ${T.orange}`,
                  color: T.orange,
                  borderRadius: 9,
                  padding: '11px 0',
                  fontFamily: T.headline,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Apply for Dealership
              </span>
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <a
              href="tel:+919999036254"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: T.orange,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              <Phone style={{ width: 15, height: 15 }} />
              Call: +91 98000 06416
            </a>
            <a
              href="mailto:service@musclegrid.in"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: T.orange,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              <Mail style={{ width: 15, height: 15 }} />
              service@musclegrid.in
            </a>
          </div>
        </div>
      </div>

      {/* Legal footer */}
      <div
        style={{
          marginTop: 22,
          textAlign: 'center',
          fontFamily: T.mono,
          fontSize: 11,
          color: 'rgba(255,255,255,.45)',
          lineHeight: 1.7,
        }}
      >
        <div>MuscleGrid Industries Private Limited | GST: 07AATCM1213F1ZM</div>
        <div>© {new Date().getFullYear()} MuscleGrid. All rights reserved.</div>
      </div>
    </div>
  );
}

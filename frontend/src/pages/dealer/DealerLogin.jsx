import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Users, Loader2, Phone, Mail, MapPin, Smartphone, ArrowLeft } from 'lucide-react';
import axios from 'axios';

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

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{
      background: 'radial-gradient(ellipse 80% 60% at 50% -10%, hsl(243 75% 62% / 0.12) 0%, transparent 60%), hsl(var(--background))'
    }}>
      {/* Header */}
      <header className="py-4 px-6 border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/15 border border-primary/30 rounded flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-lg font-bold text-foreground tracking-tight">MuscleGrid</span>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary ml-2">
                Partner Portal
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left side - Features */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 py-8">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-3">
            Dealer Network
          </p>
          <h1 className="text-4xl font-bold text-foreground leading-tight mb-4">
            Welcome to the<br />
            <span className="text-primary">Partner Portal</span>
          </h1>
          <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
            Your one-stop platform for managing orders, tracking dispatches, and growing your business with MuscleGrid.
          </p>

          <div className="space-y-3">
            <FeatureItem
              icon="📦"
              title="Easy Ordering"
              description="Place orders 24/7 with real-time inventory visibility"
            />
            <FeatureItem
              icon="🚚"
              title="Track Dispatches"
              description="Live updates on your order status and delivery"
            />
            <FeatureItem
              icon="💰"
              title="Dealer Pricing"
              description="Access exclusive dealer rates and special offers"
            />
            <FeatureItem
              icon="📄"
              title="Invoice Management"
              description="Download invoices and track payment history"
            />
          </div>
        </div>

        {/* Right side - Login form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="mg-card w-full max-w-md rounded-lg border border-border bg-card">
            <div className="p-6 border-b border-border text-center">
              <div className="flex items-center justify-center gap-2 mb-4 lg:hidden">
                <div className="w-9 h-9 bg-primary/15 border border-primary/30 rounded flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <span className="text-lg font-bold text-foreground">MuscleGrid Partners</span>
              </div>
              <h2 className="text-xl font-bold text-foreground">Dealer Login</h2>
              <p className="text-muted-foreground text-sm mt-1">Sign in to access your dealer dashboard</p>
            </div>

            <div className="p-6">
              {/* Login Mode Toggle */}
              <div className="flex gap-2 mb-6 p-1 bg-muted rounded">
                <button
                  type="button"
                  onClick={() => { setLoginMode('password'); resetOTPFlow(); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm font-semibold transition-colors ${
                    loginMode === 'password'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode('otp')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm font-semibold transition-colors ${
                    loginMode === 'otp'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  OTP
                </button>
              </div>

              {/* Password Login */}
              {loginMode === 'password' && (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="dealer@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      data-testid="dealer-login-email"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        data-testid="dealer-login-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-right -mt-1">
                    <Link to="/forgot-password" className="text-xs text-primary hover:text-primary/80 hover:underline transition-colors">
                      Forgot password?
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={loading}
                    data-testid="dealer-login-submit"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              )}

              {/* OTP Login - Phone Entry */}
              {loginMode === 'otp' && !otpSent && (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Registered Mobile Number
                    </Label>
                    <div className="flex gap-2">
                      <div className="w-16 flex items-center justify-center bg-muted border border-border rounded text-sm text-muted-foreground font-mono">
                        +91
                      </div>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="10-digit mobile number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        maxLength={10}
                        required
                        data-testid="dealer-otp-phone"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter the mobile number registered with your dealer account
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={loading || phone.length !== 10}
                    data-testid="dealer-send-otp"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-4 h-4 mr-2" />
                        Send OTP
                      </>
                    )}
                  </Button>
                </form>
              )}

              {/* OTP Login - OTP Entry */}
              {loginMode === 'otp' && otpSent && (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <button
                    type="button"
                    onClick={resetOTPFlow}
                    className="flex items-center text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Change number
                  </button>

                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded text-sm text-emerald-400">
                    OTP sent to <span className="font-mono font-semibold">+91 ******{phone.slice(-4)}</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="otp" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Enter OTP
                    </Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      className="text-center text-2xl tracking-widest font-mono"
                      required
                      autoFocus
                      data-testid="dealer-otp-input"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={loading || otp.length !== 6}
                    data-testid="dealer-verify-otp"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify & Login'
                    )}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={countdown > 0 || loading}
                      className={`text-sm transition-colors ${
                        countdown > 0
                          ? 'text-muted-foreground cursor-not-allowed'
                          : 'text-primary hover:text-primary/80 hover:underline'
                      }`}
                    >
                      {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                    </button>
                  </div>
                </form>
              )}

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Not a registered dealer yet?
                </p>
                <div className="text-center mb-4">
                  <Link to="/partners/register">
                    <Button variant="outline" className="w-full border-primary/40 text-primary hover:bg-primary/10">
                      Apply for Dealership
                    </Button>
                  </Link>
                </div>
                <div className="text-center space-y-2">
                  <a
                    href="tel:+919999036254"
                    className="flex items-center justify-center gap-2 text-primary hover:text-primary/80 text-sm transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    Call: +91 98000 06416
                  </a>
                  <a
                    href="mailto:service@musclegrid.in"
                    className="flex items-center justify-center gap-2 text-primary hover:text-primary/80 text-sm transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    service@musclegrid.in
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 px-6 border-t border-border/50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>MuscleGrid Industries Private Limited | GST: 07AATCM1213F1ZM</span>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} MuscleGrid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureItem({ icon, title, description }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded border border-border bg-card/50">
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div>
        <h3 className="text-foreground font-medium text-sm">{title}</h3>
        <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
      </div>
    </div>
  );
}

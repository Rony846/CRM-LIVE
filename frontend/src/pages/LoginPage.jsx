import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Zap, Loader2, Users, Smartphone, Mail, ArrowLeft } from 'lucide-react';
import axios from 'axios';

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

  return (
    <div className="min-h-screen flex">
      {/* Left side - brand hero (intense electric-blue energy) */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #050B16 0%, #0A1729 38%, #0B1C30 68%, #102843 100%)' }}
      >
        <style>{`
          @keyframes mgGlow { 0%,100%{opacity:.7} 50%{opacity:1} }
          @keyframes mgBolt { 0%,100%{transform:translateY(0) rotate(8deg);opacity:.08} 50%{transform:translateY(-14px) rotate(8deg);opacity:.16} }
          @keyframes mgFlicker { 0%,100%{text-shadow:0 0 22px rgba(56,189,248,.55)} 50%{text-shadow:0 0 40px rgba(56,189,248,.95)} }
          @keyframes mgPulse { 0%,100%{box-shadow:0 0 22px rgba(56,189,248,.5)} 50%{box-shadow:0 0 46px rgba(56,189,248,.95)} }
          @keyframes mgSweep { 0%{transform:translateX(-30%)} 100%{transform:translateX(30%)} }
          .mg-glow{animation:mgGlow 4s ease-in-out infinite}
          .mg-bolt{animation:mgBolt 6s ease-in-out infinite}
          .mg-flicker{animation:mgFlicker 3.5s ease-in-out infinite}
          .mg-pulse{animation:mgPulse 3s ease-in-out infinite}
          .mg-sweep{animation:mgSweep 9s ease-in-out infinite alternate}
        `}</style>
        {/* pulsing energy glows */}
        <div
          className="absolute inset-0 mg-glow"
          style={{ background: 'radial-gradient(circle at 22% 18%, rgba(56,189,248,0.30), transparent 42%), radial-gradient(circle at 85% 88%, rgba(37,99,235,0.34), transparent 50%)' }}
        />
        {/* diagonal energy streaks */}
        <div
          className="absolute inset-0 mg-sweep"
          style={{ opacity: 0.16, backgroundImage: 'repeating-linear-gradient(115deg, transparent 0px, transparent 40px, rgba(56,189,248,0.5) 41px, transparent 43px)' }}
        />
        {/* giant glowing bolt watermark */}
        <Zap className="absolute mg-bolt" style={{ right: -40, top: '6%', width: 340, height: 340, color: '#38BDF8' }} fill="currentColor" />
        <div className="relative z-10 flex flex-col justify-center px-14 text-white w-full">
          <div className="flex items-center gap-3 mb-12">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mg-pulse"
              style={{ background: 'linear-gradient(135deg, #38BDF8, #2563EB)' }}
            >
              <Zap className="w-7 h-7 text-white" fill="white" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-white">MuscleGrid</span>
          </div>
          <h1 className="text-white text-5xl font-extrabold font-['Barlow_Condensed'] leading-[1.05] tracking-tight mb-5">
            <span className="text-white">Industrial Power.</span><br />
            <span className="mg-flicker" style={{ color: '#38BDF8' }}>Engineered for India.</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-md mb-9">
            Solar · Lithium · Stabilizer · Backup — warranties, support and dispatch, all in one command center.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            {['BIS Certified', 'ISO 9001:2015', 'CE Marked'].map((b) => (
              <span key={b} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-[#38BDF8]/25 text-slate-100 bg-[#38BDF8]/5">
                {b}
              </span>
            ))}
          </div>
          <p className="mt-12 text-sm tracking-[0.15em] text-slate-400 font-medium uppercase">Consistency Through You</p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4 lg:hidden">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #38BDF8, #2563EB)' }}>
                <Zap className="w-6 h-6 text-white" fill="white" />
              </div>
              <span className="text-xl font-bold font-['Barlow_Condensed']">MuscleGrid</span>
            </div>
            <CardTitle className="text-2xl font-['Barlow_Condensed']">Welcome Back</CardTitle>
            <CardDescription>Sign in to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Login Mode Toggle */}
            <div className="flex gap-2 mb-6">
              <Button
                type="button"
                variant={loginMode === 'email' ? 'default' : 'outline'}
                className={`flex-1 ${loginMode === 'email' ? 'bg-[#0B1C30] hover:bg-[#16304f]' : ''}`}
                onClick={() => { setLoginMode('email'); resetOTPFlow(); }}
              >
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
              <Button
                type="button"
                variant={loginMode === 'otp' ? 'default' : 'outline'}
                className={`flex-1 ${loginMode === 'otp' ? 'bg-[#0B1C30] hover:bg-[#16304f]' : ''}`}
                onClick={() => setLoginMode('otp')}
              >
                <Smartphone className="w-4 h-4 mr-2" />
                OTP
              </Button>
            </div>

            {/* Email/Password Login */}
            {loginMode === 'email' && (
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="login-email-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      data-testid="login-password-input"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-right -mt-1">
                  <Link to="/forgot-password" className="text-sm text-[#2563EB] hover:underline">
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#0B1C30] hover:bg-[#16304f]"
                  disabled={loading}
                  data-testid="login-submit-btn"
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

            {/* OTP Login */}
            {loginMode === 'otp' && !otpSent && (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile Number</Label>
                  <div className="flex gap-2">
                    <div className="w-16 flex items-center justify-center bg-slate-100 border rounded-md text-sm text-slate-600">
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
                      data-testid="login-phone-input"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Enter the mobile number registered with your previous complaint or account
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-[#0B1C30] hover:bg-[#16304f]" 
                  disabled={loading || phone.length !== 10}
                  data-testid="send-otp-btn"
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

            {/* OTP Verification */}
            {loginMode === 'otp' && otpSent && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <button
                  type="button"
                  onClick={resetOTPFlow}
                  className="flex items-center text-sm text-slate-600 hover:text-slate-800 mb-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Change number
                </button>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  OTP sent to <span className="font-semibold">+91 ******{phone.slice(-4)}</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otp">Enter OTP</Label>
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
                    data-testid="otp-input"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-[#0B1C30] hover:bg-[#16304f]" 
                  disabled={loading || otp.length !== 6}
                  data-testid="verify-otp-btn"
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
                    className={`text-sm ${countdown > 0 ? 'text-slate-400' : 'text-[#2563EB] hover:underline'}`}
                  >
                    {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                New customer?{' '}
                <Link to="/register" className="text-[#2563EB] hover:underline font-medium">
                  Create an account
                </Link>
              </p>
            </div>

            {/* Dealer Portal Button */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <Link to="/partners">
                <Button 
                  variant="outline" 
                  className="w-full border-[#0B1C30]/25 text-[#0B1C30] hover:bg-slate-50 hover:text-[#0B1C30]"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Dealer / Partner Portal
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

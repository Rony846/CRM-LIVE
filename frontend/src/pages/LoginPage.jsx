import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Warehouse, Loader2, Users, Smartphone, Mail, ArrowLeft } from 'lucide-react';
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
      service_agent: '/service',
      accountant: '/accountant',
      dispatcher: '/dispatcher',
      admin: '/admin'
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
      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-1/2 login-bg relative">
        <div className="absolute inset-0 bg-slate-900/70" />
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Warehouse className="w-7 h-7" />
            </div>
            <span className="text-3xl font-bold font-['Barlow_Condensed']">MuscleGrid CRM</span>
          </div>
          <h1 className="text-4xl font-bold font-['Barlow_Condensed'] mb-4">
            Customer Service & Logistics Platform
          </h1>
          <p className="text-lg text-slate-300 max-w-md">
            Manage warranties, support tickets, and dispatch operations for your inverter, battery, and stabilizer products.
          </p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4 lg:hidden">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Warehouse className="w-6 h-6 text-white" />
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
                className={`flex-1 ${loginMode === 'email' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                onClick={() => { setLoginMode('email'); resetOTPFlow(); }}
              >
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
              <Button
                type="button"
                variant={loginMode === 'otp' ? 'default' : 'outline'}
                className={`flex-1 ${loginMode === 'otp' ? 'bg-green-600 hover:bg-green-700' : ''}`}
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

                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700" 
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
                  className="w-full bg-green-600 hover:bg-green-700" 
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

                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
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
                  className="w-full bg-green-600 hover:bg-green-700" 
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
                    className={`text-sm ${countdown > 0 ? 'text-slate-400' : 'text-green-600 hover:underline'}`}
                  >
                    {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                New customer?{' '}
                <Link to="/register" className="text-blue-600 hover:underline font-medium">
                  Create an account
                </Link>
              </p>
            </div>

            {/* Dealer Portal Button */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <Link to="/partners">
                <Button 
                  variant="outline" 
                  className="w-full border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
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

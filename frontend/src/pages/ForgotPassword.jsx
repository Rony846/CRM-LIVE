import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('request'); // 'request' | 'reset'
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentInfo, setSentInfo] = useState('');

  const requestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await axios.post(`${API}/auth/forgot-password`, { identifier: identifier.trim() });
      setSentInfo(r.data.sent_to || 'your account');
      setStep('reset');
      toast.success(r.data.message || 'Reset code sent');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send the reset code');
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, {
        identifier: identifier.trim(), code, new_password: newPassword,
      });
      toast.success('Password reset — please sign in with your new password');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not reset the password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            {step === 'request'
              ? 'Enter your email or registered phone number — we will send a 6-digit code.'
              : `Enter the code sent to ${sentInfo} and choose a new password.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'request' ? (
            <form onSubmit={requestCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Email or phone</Label>
                <Input
                  id="identifier"
                  placeholder="you@example.com or 10-digit mobile"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !identifier.trim()}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Send reset code
              </Button>
            </form>
          ) : (
            <form onSubmit={submitReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">6-digit code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-xl tracking-[0.4em] font-mono"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newpw">New password</Label>
                <div className="relative">
                  <Input
                    id="newpw"
                    type={showPw ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Reset password
              </Button>
              <button
                type="button"
                onClick={() => { setStep('request'); setCode(''); }}
                className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
              >
                Use a different email / phone
              </button>
            </form>
          )}
          <div className="mt-6 pt-4 border-t border-border text-center">
            <Link to="/login" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

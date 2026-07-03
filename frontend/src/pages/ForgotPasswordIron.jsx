import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, KeyRound, Eye, EyeOff } from 'lucide-react';
import { T, Fonts } from '@/components/iron/IronKit';

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

  const canvas = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: 'radial-gradient(1200px 600px at 50% -10%, #23262B, #141517)',
    fontFamily: T.body,
  };
  const card = {
    width: 'min(420px, 100%)',
    background: T.white,
    borderRadius: 14,
    padding: '32px 30px',
    boxShadow: '0 30px 80px rgba(0,0,0,.45)',
    border: `1px solid ${T.iron200}`,
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
  const primaryBtn = (disabled) => ({
    width: '100%',
    border: 'none',
    background: disabled ? T.iron400 : T.orange,
    color: '#fff',
    borderRadius: 9,
    padding: '12px 0',
    fontFamily: T.headline,
    fontWeight: 700,
    fontSize: 14.5,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  });
  const linkBtn = {
    background: 'none',
    border: 'none',
    color: T.iron500,
    fontFamily: T.body,
    fontSize: 13,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center',
    padding: 0,
  };

  return (
    <div style={canvas}>
      <Fonts />
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'rgba(245,130,32,.12)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <KeyRound style={{ width: 26, height: 26, color: T.orange }} />
          </div>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 800,
              fontSize: 26,
              letterSpacing: '.01em',
              color: T.iron900,
              lineHeight: 1,
            }}
          >
            Muscle<span style={{ color: T.orange }}>Grid</span>
          </div>
          <h1
            style={{
              fontFamily: T.headline,
              fontWeight: 700,
              fontSize: 18,
              color: T.iron900,
              margin: '14px 0 6px',
            }}
          >
            Reset your password
          </h1>
          <p style={{ fontFamily: T.body, fontSize: 13, color: T.iron500, margin: 0, lineHeight: 1.5 }}>
            {step === 'request'
              ? 'Enter your email or registered phone number — we will send a 6-digit code.'
              : `Enter the code sent to ${sentInfo} and choose a new password.`}
          </p>
        </div>

        {step === 'request' ? (
          <form onSubmit={requestCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="identifier" style={labelStyle}>Email or phone</label>
              <input
                id="identifier"
                style={inputStyle}
                placeholder="you@example.com or 10-digit mobile"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <button type="submit" style={primaryBtn(loading || !identifier.trim())} disabled={loading || !identifier.trim()}>
              {loading ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : null}
              Send reset code
            </button>
          </form>
        ) : (
          <form onSubmit={submitReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="code" style={labelStyle}>6-digit code</label>
              <input
                id="code"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{
                  ...inputStyle,
                  textAlign: 'center',
                  fontSize: 22,
                  letterSpacing: '0.4em',
                  fontFamily: T.mono,
                }}
                required
              />
            </div>
            <div>
              <label htmlFor="newpw" style={labelStyle}>New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="newpw"
                  type={showPw ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 40 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: T.iron400,
                    display: 'inline-flex',
                    padding: 0,
                  }}
                >
                  {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm" style={labelStyle}>Confirm new password</label>
              <input
                id="confirm"
                type={showPw ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            <button type="submit" style={primaryBtn(loading || code.length !== 6)} disabled={loading || code.length !== 6}>
              {loading ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : null}
              Reset password
            </button>
            <button
              type="button"
              onClick={() => { setStep('request'); setCode(''); }}
              style={linkBtn}
            >
              Use a different email / phone
            </button>
          </form>
        )}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.iron200}`, textAlign: 'center' }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 13,
              color: T.orange,
              textDecoration: 'none',
              fontFamily: T.headline,
              fontWeight: 600,
            }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

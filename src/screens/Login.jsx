import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import Icon from '../lib/icon';
import { useAuth, roleHome } from '../auth';

// Faithful port of stitch unified_login/code.html, wired to POST /api/auth/login.
export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={roleHome(user.role)} replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const me = await login(email.trim(), password);
      navigate(roleHome(me.role), { replace: true });
    } catch (err) {
      setError(err.status === 401 ? 'Invalid credentials' : (err.message || 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-margin-mobile bg-surface-container-lowest">
      <header className="mb-stack-lg flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 bg-primary-container rounded flex items-center justify-center">
            <Icon name="bolt" className="text-on-primary-container" fill />
          </div>
          <h1 className="font-headline-nav text-headline-nav font-bold text-primary">MuscleGrid CRM</h1>
        </div>
        <p className="font-body-base text-body-base text-on-surface-variant">Enterprise Resource Management</p>
      </header>

      <main className="w-full max-w-[400px] bg-surface-card border border-border-subtle rounded-xl p-stack-lg">
        <div className="mb-stack-lg">
          <h2 className="font-headline-card text-headline-card text-text-primary mb-1">Welcome Back</h2>
          <p className="font-body-base text-body-base text-on-surface-variant">Enter your credentials to access the console</p>
        </div>
        <form className="flex flex-col gap-stack-md" onSubmit={onSubmit}>
          <div className="flex flex-col gap-unit">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="email">Username or Email</label>
            <div className="relative">
              <Icon name="person" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                id="email" type="text" autoComplete="username" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com"
                className="w-full h-touch-target pl-12 pr-4 bg-surface-container border border-border-subtle rounded text-on-surface font-body-base focus:ring-4 focus:ring-primary/15 focus:border-primary transition-all outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-unit">
            <div className="flex justify-between items-center">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="password">Password</label>
              <a className="font-label-caps text-label-caps text-primary hover:underline transition-all" href="#">Forgot Password?</a>
            </div>
            <div className="relative">
              <Icon name="lock" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                id="password" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full h-touch-target pl-12 pr-4 bg-surface-container border border-border-subtle rounded text-on-surface font-body-base focus:ring-4 focus:ring-primary/15 focus:border-primary transition-all outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-error font-mono-data text-mono-data">
              <Icon name="error" style={{ fontSize: 16 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit" disabled={busy}
            className="w-full h-touch-target bg-primary-container text-on-primary-container font-body-bold rounded flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            <span>{busy ? 'Signing in…' : 'Login'}</span>
            {!busy && <Icon name="arrow_forward" />}
          </button>
        </form>
        <div className="mt-stack-lg pt-stack-md border-t border-border-subtle">
          <div className="flex items-center justify-center gap-stack-sm">
            <span className="w-2 h-2 rounded-full bg-success"></span>
            <span className="font-mono-data text-mono-data text-text-secondary">SYSTEMS OPERATIONAL</span>
          </div>
        </div>
      </main>

      <footer className="mt-stack-lg max-w-[400px] text-center">
        <p className="font-mono-data-sm text-mono-data-sm text-outline/50">© 2026 MuscleGrid CRM. Staff console.</p>
      </footer>

      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] bg-tertiary-container/5 blur-[120px] rounded-full"></div>
      </div>
    </div>
  );
}

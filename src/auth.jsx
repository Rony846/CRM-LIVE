import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, getToken, setToken } from './lib/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Where each role lands after login (per integration_strategy_map.md). Screens
// not yet ported fall back to the shared /home hub so nothing dead-ends.
export function roleHome(role) {
  switch (role) {
    case 'technician':
    case 'service_agent':
      return '/technician/queue';
    case 'gate':
      return '/gate/scan';
    case 'accountant':
      return '/accountant/inventory';
    case 'supervisor':
      return '/supervisor/dashboard';
    default:
      return '/home';
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) { setLoading(false); return; }
      try {
        const me = await api('/auth/me');
        if (!cancelled) setUser(me);
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async (email, password) => {
    const res = await api('/auth/login', { method: 'POST', auth: false, body: { email, password } });
    const token = res.access_token || res.token;
    setToken(token);
    const me = res.user || (await api('/auth/me'));
    setUser(me);
    return me;
  };

  const logout = () => { setToken(null); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-on-surface-variant font-mono-data text-mono-data">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

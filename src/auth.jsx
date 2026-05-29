import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, getToken, setToken } from './lib/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Each role's own landing screen. Admin lands on the hub (the only role that
// can reach every dashboard); every other role lands on — and is confined to —
// its own dashboard.
const ROLE_HOME = {
  admin: '/home',
  supervisor: '/supervisor/dashboard',
  service_agent: '/technician/queue',
  technician: '/technician/queue',
  accountant: '/accountant/inventory',
  gate: '/gate/scan',
  dispatcher: '/dispatch',
  call_support: '/support',
  dealer: '/dealer/home',
};
export function roleHome(role) {
  return ROLE_HOME[role] || '/profile';
}

// Route guard: admin sees everything; every other role may only open routes
// whose `roles` include it — otherwise it's bounced to its own dashboard.
export function RoleRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin' || (roles || []).includes(user.role)) return children;
  return <Navigate to={roleHome(user.role)} replace />;
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

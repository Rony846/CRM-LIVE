import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from 'sonner';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CustomerTickets from './pages/customer/CustomerTickets';
import CreateTicket from './pages/customer/CreateTicket';
import WarrantyRegistration from './pages/customer/WarrantyRegistration';
import MyWarranties from './pages/customer/MyWarranties';
import CallSupportDashboard from './pages/support/CallSupportDashboard';
import ServiceAgentDashboard from './pages/service/ServiceAgentDashboard';
import AccountantDashboard from './pages/accountant/AccountantDashboard';
import DispatcherDashboard from './pages/dispatcher/DispatcherDashboard';
import DispatcherTVMode from './pages/dispatcher/DispatcherTVMode';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminWarranties from './pages/admin/AdminWarranties';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTickets from './pages/admin/AdminTickets';
import AdminCampaigns from './pages/admin/AdminCampaigns';
import AdminGateLogs from './pages/admin/AdminGateLogs';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import TechnicianDashboard from './pages/technician/TechnicianDashboard';
import GateDashboard from './pages/gate/GateDashboard';
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';
import AdminSKUManagement from './pages/admin/AdminSKUManagement';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('mg_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data);
        } catch (error) {
          console.error('Auth error:', error);
          localStorage.removeItem('mg_token');
          setToken(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('mg_token', access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const register = async (userData) => {
    const response = await axios.post(`${API}/auth/register`, userData);
    const { access_token, user: newUser } = response.data;
    localStorage.setItem('mg_token', access_token);
    setToken(access_token);
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('mg_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    const dashboardRoutes = {
      customer: '/customer',
      call_support: '/support',
      service_agent: '/technician',
      accountant: '/accountant',
      dispatcher: '/dispatcher',
      gate: '/gate',
      admin: '/admin'
    };
    return <Navigate to={dashboardRoutes[user.role] || '/login'} replace />;
  }

  return children;
};

// Role-based redirect
const RoleRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const dashboardRoutes = {
    customer: '/customer',
    call_support: '/support',
    supervisor: '/supervisor',
    service_agent: '/technician',
    accountant: '/accountant',
    dispatcher: '/dispatcher',
    gate: '/gate',
    admin: '/admin'
  };

  return <Navigate to={dashboardRoutes[user.role] || '/login'} replace />;
};

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Root redirect */}
          <Route path="/" element={<RoleRedirect />} />
          
          {/* Customer Routes */}
          <Route path="/customer" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/customer/tickets" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerTickets />
            </ProtectedRoute>
          } />
          <Route path="/customer/tickets/new" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CreateTicket />
            </ProtectedRoute>
          } />
          <Route path="/customer/warranty/register" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <WarrantyRegistration />
            </ProtectedRoute>
          } />
          <Route path="/customer/warranties" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <MyWarranties />
            </ProtectedRoute>
          } />
          
          {/* Call Support Routes */}
          <Route path="/support" element={
            <ProtectedRoute allowedRoles={['call_support']}>
              <CallSupportDashboard />
            </ProtectedRoute>
          } />
          <Route path="/support/*" element={
            <ProtectedRoute allowedRoles={['call_support']}>
              <CallSupportDashboard />
            </ProtectedRoute>
          } />
          
          {/* Supervisor Routes */}
          <Route path="/supervisor" element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <SupervisorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/supervisor/*" element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <SupervisorDashboard />
            </ProtectedRoute>
          } />
          
          {/* Service Agent / Technician Routes */}
          <Route path="/technician" element={
            <ProtectedRoute allowedRoles={['service_agent', 'admin']}>
              <TechnicianDashboard />
            </ProtectedRoute>
          } />
          <Route path="/technician/*" element={
            <ProtectedRoute allowedRoles={['service_agent', 'admin']}>
              <TechnicianDashboard />
            </ProtectedRoute>
          } />
          <Route path="/service" element={
            <ProtectedRoute allowedRoles={['service_agent']}>
              <TechnicianDashboard />
            </ProtectedRoute>
          } />
          <Route path="/service/*" element={
            <ProtectedRoute allowedRoles={['service_agent']}>
              <TechnicianDashboard />
            </ProtectedRoute>
          } />
          
          {/* Accountant Routes */}
          <Route path="/accountant" element={
            <ProtectedRoute allowedRoles={['accountant']}>
              <AccountantDashboard />
            </ProtectedRoute>
          } />
          <Route path="/accountant/*" element={
            <ProtectedRoute allowedRoles={['accountant']}>
              <AccountantDashboard />
            </ProtectedRoute>
          } />
          
          {/* Dispatcher Routes */}
          <Route path="/dispatcher" element={
            <ProtectedRoute allowedRoles={['dispatcher']}>
              <DispatcherDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dispatcher/tv" element={
            <ProtectedRoute allowedRoles={['dispatcher', 'admin']}>
              <DispatcherTVMode />
            </ProtectedRoute>
          } />
          
          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/customers" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminCustomers />
            </ProtectedRoute>
          } />
          <Route path="/admin/warranties" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminWarranties />
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminUsers />
            </ProtectedRoute>
          } />
          <Route path="/admin/tickets" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminTickets />
            </ProtectedRoute>
          } />
          <Route path="/admin/campaigns" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminCampaigns />
            </ProtectedRoute>
          } />
          <Route path="/admin/gate-logs" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminGateLogs />
            </ProtectedRoute>
          } />
          <Route path="/admin/analytics" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminAnalytics />
            </ProtectedRoute>
          } />
          <Route path="/admin/skus" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminSKUManagement />
            </ProtectedRoute>
          } />
          
          {/* Gate Control Routes */}
          <Route path="/gate" element={
            <ProtectedRoute allowedRoles={['gate', 'dispatcher', 'admin']}>
              <GateDashboard />
            </ProtectedRoute>
          } />
          <Route path="/gate/*" element={
            <ProtectedRoute allowedRoles={['gate', 'dispatcher', 'admin']}>
              <GateDashboard />
            </ProtectedRoute>
          } />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

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
import AdminOrders from './pages/admin/AdminOrders';
import AdminRepairs from './pages/admin/AdminRepairs';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTickets from './pages/admin/AdminTickets';
import AdminTicketDetail from './pages/admin/AdminTicketDetail';
import AdminCampaigns from './pages/admin/AdminCampaigns';
import AdminGateLogs from './pages/admin/AdminGateLogs';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminActivityLogs from './pages/admin/AdminActivityLogs';
import AdminDataManagement from './pages/admin/AdminDataManagement';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import TechnicianDashboard from './pages/technician/TechnicianDashboard';
import GateDashboard from './pages/gate/GateDashboard';
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';
import SupervisorWarranties from './pages/supervisor/SupervisorWarranties';
import SupervisorCalendar from './pages/supervisor/SupervisorCalendar';
import AdminSKUManagement from './pages/admin/AdminSKUManagement';
import AdminFirms from './pages/admin/AdminFirms';
import AdminMasterSKU from './pages/admin/AdminMasterSKU';
import StockReports from './pages/admin/StockReports';
import CustomerAppointments from './pages/customer/CustomerAppointments';
import AccountantInventory from './pages/accountant/AccountantInventory';
import IncomingInventoryQueue from './pages/accountant/IncomingInventoryQueue';
import ProductionRequests from './pages/accountant/ProductionRequests';
import PendingFulfillment from './pages/accountant/PendingFulfillment';
import PurchaseRegister from './pages/accountant/PurchaseRegister';
import SalesRegister from './pages/accountant/SalesRegister';
import PartyMaster from './pages/admin/PartyMaster';
import ComplianceDashboard from './pages/admin/ComplianceDashboard';
import PartyLedger from './pages/accountant/PartyLedger';
import Payments from './pages/accountant/Payments';
import AccountingReports from './pages/accountant/AccountingReports';
import CreditNotes from './pages/accountant/CreditNotes';
import ReconciliationReports from './pages/accountant/ReconciliationReports';
import SupervisorProduction from './pages/supervisor/SupervisorProduction';
import TechnicianProduction from './pages/technician/TechnicianProduction';

// Quotation Pages
import QuotationList from './pages/quotations/QuotationList';
import QuotationForm from './pages/quotations/QuotationForm';
import PublicQuotationView from './pages/quotations/PublicQuotationView';
import PIPendingAction from './pages/quotations/PIPendingAction';

// Incentive Pages
import MyIncentives from './pages/incentives/MyIncentives';
import AdminIncentives from './pages/incentives/AdminIncentives';

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
      technician: '/technician',
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
    technician: '/technician',
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
          <Route path="/customer/appointments" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerAppointments />
            </ProtectedRoute>
          } />
          
          {/* Call Support Routes */}
          <Route path="/support" element={
            <ProtectedRoute allowedRoles={['call_support', 'admin']}>
              <CallSupportDashboard />
            </ProtectedRoute>
          } />
          <Route path="/support/*" element={
            <ProtectedRoute allowedRoles={['call_support', 'admin']}>
              <CallSupportDashboard />
            </ProtectedRoute>
          } />
          
          {/* Supervisor Routes */}
          <Route path="/supervisor" element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <SupervisorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/supervisor/warranties" element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <SupervisorWarranties />
            </ProtectedRoute>
          } />
          <Route path="/supervisor/calendar" element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <SupervisorCalendar />
            </ProtectedRoute>
          } />
          <Route path="/supervisor/*" element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <SupervisorDashboard />
            </ProtectedRoute>
          } />
          
          {/* Service Agent / Technician Routes */}
          <Route path="/technician" element={
            <ProtectedRoute allowedRoles={['service_agent', 'technician', 'admin']}>
              <TechnicianDashboard />
            </ProtectedRoute>
          } />
          <Route path="/technician/*" element={
            <ProtectedRoute allowedRoles={['service_agent', 'technician', 'admin']}>
              <TechnicianDashboard />
            </ProtectedRoute>
          } />
          <Route path="/service" element={
            <ProtectedRoute allowedRoles={['service_agent', 'technician', 'admin']}>
              <TechnicianDashboard />
            </ProtectedRoute>
          } />
          <Route path="/service/*" element={
            <ProtectedRoute allowedRoles={['service_agent', 'technician', 'admin']}>
              <TechnicianDashboard />
            </ProtectedRoute>
          } />
          
          {/* Accountant Routes */}
          <Route path="/accountant" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <AccountantDashboard />
            </ProtectedRoute>
          } />
          <Route path="/accountant/*" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <AccountantDashboard />
            </ProtectedRoute>
          } />
          
          {/* Dispatcher Routes */}
          <Route path="/dispatcher" element={
            <ProtectedRoute allowedRoles={['dispatcher', 'admin']}>
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
          <Route path="/admin/orders" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminOrders />
            </ProtectedRoute>
          } />
          <Route path="/admin/repairs" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminRepairs />
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
          <Route path="/admin/tickets/:ticketId" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminTicketDetail />
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
          <Route path="/admin/activity-logs" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminActivityLogs />
            </ProtectedRoute>
          } />
          <Route path="/admin/data-management" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDataManagement />
            </ProtectedRoute>
          } />
          <Route path="/finance" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <FinanceDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/skus" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminSKUManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/firms" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminFirms />
            </ProtectedRoute>
          } />
          <Route path="/admin/reports" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <StockReports />
            </ProtectedRoute>
          } />
          <Route path="/admin/master-sku" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <AdminMasterSKU />
            </ProtectedRoute>
          } />
          
          {/* Accountant Inventory Route */}
          <Route path="/accountant/inventory" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <AccountantInventory />
            </ProtectedRoute>
          } />
          
          {/* Incoming Inventory Queue Route */}
          <Route path="/accountant/incoming-queue" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <IncomingInventoryQueue />
            </ProtectedRoute>
          } />
          <Route path="/accountant/production" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <ProductionRequests />
            </ProtectedRoute>
          } />
          <Route path="/accountant/pending-fulfillment" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <PendingFulfillment />
            </ProtectedRoute>
          } />
          <Route path="/accountant/purchases" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <PurchaseRegister />
            </ProtectedRoute>
          } />
          <Route path="/accountant/sales" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <SalesRegister />
            </ProtectedRoute>
          } />
          
          {/* Party Master Route */}
          <Route path="/admin/parties" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <PartyMaster />
            </ProtectedRoute>
          } />
          
          {/* Compliance Dashboard Route */}
          <Route path="/admin/compliance" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <ComplianceDashboard />
            </ProtectedRoute>
          } />
          
          {/* Party Ledger Route */}
          <Route path="/accountant/ledger" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <PartyLedger />
            </ProtectedRoute>
          } />
          
          {/* Payments Route */}
          <Route path="/accountant/payments" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <Payments />
            </ProtectedRoute>
          } />
          
          {/* Accounting Reports Route */}
          <Route path="/accountant/reports" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <AccountingReports />
            </ProtectedRoute>
          } />
          
          {/* Credit Notes Route */}
          <Route path="/accountant/credit-notes" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <CreditNotes />
            </ProtectedRoute>
          } />
          
          {/* Reconciliation Reports Route */}
          <Route path="/accountant/reconciliation" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <ReconciliationReports />
            </ProtectedRoute>
          } />
          
          {/* Supervisor Production Routes */}
          <Route path="/supervisor/production" element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <SupervisorProduction />
            </ProtectedRoute>
          } />
          
          {/* Technician Production Routes */}
          <Route path="/technician/production" element={
            <ProtectedRoute allowedRoles={['service_agent', 'technician', 'admin']}>
              <TechnicianProduction />
            </ProtectedRoute>
          } />
          
          {/* Gate Control Routes */}
          <Route path="/gate" element={
            <ProtectedRoute allowedRoles={['gate', 'dispatcher', 'admin', 'accountant']}>
              <GateDashboard />
            </ProtectedRoute>
          } />
          <Route path="/gate/*" element={
            <ProtectedRoute allowedRoles={['gate', 'dispatcher', 'admin', 'accountant']}>
              <GateDashboard />
            </ProtectedRoute>
          } />
          
          {/* Quotation Routes */}
          <Route path="/quotations" element={
            <ProtectedRoute allowedRoles={['call_support', 'admin', 'accountant']}>
              <QuotationList />
            </ProtectedRoute>
          } />
          <Route path="/quotations/new" element={
            <ProtectedRoute allowedRoles={['call_support', 'admin', 'accountant']}>
              <QuotationForm />
            </ProtectedRoute>
          } />
          <Route path="/quotations/edit/:id" element={
            <ProtectedRoute allowedRoles={['call_support', 'admin', 'accountant']}>
              <QuotationForm />
            </ProtectedRoute>
          } />
          <Route path="/quotations/pending-action" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <PIPendingAction />
            </ProtectedRoute>
          } />
          
          {/* Public Quotation View (no auth required) */}
          <Route path="/pi/:token" element={<PublicQuotationView />} />
          
          {/* Incentive Routes */}
          <Route path="/my-incentives" element={
            <ProtectedRoute allowedRoles={['call_support', 'admin']}>
              <MyIncentives />
            </ProtectedRoute>
          } />
          <Route path="/admin/incentives" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminIncentives />
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

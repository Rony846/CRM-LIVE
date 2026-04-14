import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from 'sonner';

// Components
import OrderBotWidget from './components/orderbot/OrderBotWidget';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CustomerTickets from './pages/customer/CustomerTickets';
import CreateTicket from './pages/customer/CreateTicket';
import WarrantyRegistration from './pages/customer/WarrantyRegistration';
import MyWarranties from './pages/customer/MyWarranties';
import CustomerQuotations from './pages/customer/CustomerQuotations';
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
import SmartfloAgents from './pages/admin/SmartfloAgents';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import TDSDashboard from './pages/finance/TDSDashboard';
import GSTHSNDashboard from './pages/finance/GSTHSNDashboard';
import EcommerceReconciliation from './pages/finance/EcommerceReconciliation';
import ImportCosting from './pages/finance/ImportCosting';
import BankReconciliation from './pages/finance/BankReconciliation';
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
import ExpensesDashboard from './pages/accountant/ExpensesDashboard';
import SerialNumbersManagement from './pages/inventory/SerialNumbersManagement';
import SupervisorProduction from './pages/supervisor/SupervisorProduction';
import TechnicianProduction from './pages/technician/TechnicianProduction';
import AmazonOrders from './pages/operations/AmazonOrders';
import CourierShipping from './pages/operations/CourierShipping';
import ProductDatasheets from './pages/admin/ProductDatasheets';
import PublicDatasheetView from './pages/public/PublicDatasheetView';
import CatalogueHome from './pages/public/CatalogueHome';
import BatteryShowcase from './pages/public/BatteryShowcase';
import StabilizerShowcase from './pages/public/StabilizerShowcase';
import ServoShowcase from './pages/public/ServoShowcase';
import SolarPanelShowcase from './pages/public/SolarPanelShowcase';
import AccessoriesListing from './pages/public/AccessoriesListing';
import CategoryListing from './pages/public/CategoryListing';

// Call Center Pages
import CallsDashboard from './pages/calls/CallsDashboard';

// View-Only Pages (for employees)
import ViewDispatchQueue from './pages/view/ViewDispatchQueue';
import ViewPendingFulfillment from './pages/view/ViewPendingFulfillment';

// Quotation Pages
import QuotationList from './pages/quotations/QuotationList';
import QuotationForm from './pages/quotations/QuotationForm';
import PublicQuotationView from './pages/quotations/PublicQuotationView';
import PIPendingAction from './pages/quotations/PIPendingAction';

// Incentive Pages
import MyIncentives from './pages/incentives/MyIncentives';
import AdminIncentives from './pages/incentives/AdminIncentives';

// Payroll & Attendance Pages
import AdminPayroll from './pages/admin/AdminPayroll';
import AdminAttendance from './pages/admin/AdminAttendance';
import MyAttendance from './pages/employee/MyAttendance';

// Dealer Portal Pages
import DealerLogin from './pages/dealer/DealerLogin';
import DealerRegister from './pages/dealer/DealerRegister';
import DealerDashboard from './pages/dealer/DealerDashboard';
import DealerDeposit from './pages/dealer/DealerDeposit';
import DealerPlaceOrder from './pages/dealer/DealerPlaceOrder';
import DealerOrders from './pages/dealer/DealerOrders';
import DealerProducts from './pages/dealer/DealerProducts';
import DealerTickets from './pages/dealer/DealerTickets';
import DealerPromotions from './pages/dealer/DealerPromotions';
import DealerProfile from './pages/dealer/DealerProfile';
import DealerPerformance from './pages/dealer/DealerPerformance';
import DealerCertificate from './pages/dealer/DealerCertificate';
import DealerLedger from './pages/dealer/DealerLedger';
import DealerDispatches from './pages/dealer/DealerDispatches';
import DealerDocuments from './pages/dealer/DealerDocuments';
import AdminDealerApplications from './pages/admin/AdminDealerApplications';

// Public Pages
import VerifyDealer from './pages/public/VerifyDealer';

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
    <AuthContext.Provider value={{ user, setUser, token, setToken, loading, login, register, logout }}>
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
      admin: '/admin',
      dealer: '/dealer'
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
    admin: '/admin',
    dealer: '/dealer'
  };

  return <Navigate to={dashboardRoutes[user.role] || '/login'} replace />;
};

function App() {
  // Initialize theme from localStorage on app mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('mg-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/complete-profile" element={<CompleteProfilePage />} />
          
          {/* Public Catalogue Pages */}
          <Route path="/catalogue" element={<CatalogueHome />} />
          <Route path="/catalogue/accessories" element={<AccessoriesListing />} />
          <Route path="/catalogue/:category" element={<CategoryListing />} />
          
          {/* Public Datasheet View - shareable link for customers */}
          <Route path="/datasheet/:id" element={<PublicDatasheetView />} />
          
          {/* Interactive Showcase Pages */}
          <Route path="/showcase/battery/:id" element={<BatteryShowcase />} />
          <Route path="/showcase/stabilizer/:id" element={<StabilizerShowcase />} />
          <Route path="/showcase/servo/:id" element={<ServoShowcase />} />
          <Route path="/showcase/solar/:id" element={<SolarPanelShowcase />} />
          
          {/* Dealer Partner Portal - Public Login (partners.musclegrid.in → /partners) */}
          <Route path="/partners" element={<DealerLogin />} />
          <Route path="/partners/login" element={<DealerLogin />} />
          <Route path="/partners/register" element={<DealerRegister />} />
          
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
          <Route path="/customer/quotations" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerQuotations />
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
          <Route path="/admin/smartflo-agents" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SmartfloAgents />
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
          <Route path="/finance/tds" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <TDSDashboard />
            </ProtectedRoute>
          } />
          <Route path="/finance/gst-hsn" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <GSTHSNDashboard />
            </ProtectedRoute>
          } />
          <Route path="/finance/ecommerce-reconciliation" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <EcommerceReconciliation />
            </ProtectedRoute>
          } />
          <Route path="/finance/import-costing" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <ImportCosting />
            </ProtectedRoute>
          } />
          <Route path="/finance/bank-reconciliation" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <BankReconciliation />
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
          <Route path="/admin/product-datasheets" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <ProductDatasheets />
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
          
          {/* Serial Numbers Management - Under Inventory */}
          <Route path="/inventory/serial-numbers" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin', 'dispatcher']}>
              <SerialNumbersManagement />
            </ProtectedRoute>
          } />
          
          {/* Call Center Dashboard */}
          <Route path="/calls" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'support_agent', 'call_support']}>
              <CallsDashboard />
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
          
          {/* Expenses Dashboard Route */}
          <Route path="/accountant/expenses" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <ExpensesDashboard />
            </ProtectedRoute>
          } />
          
          {/* Amazon Orders Route */}
          <Route path="/operations/amazon-orders" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin', 'dispatcher']}>
              <AmazonOrders />
            </ProtectedRoute>
          } />
          
          {/* Courier Shipping Route */}
          <Route path="/operations/courier-shipping" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin', 'dispatcher']}>
              <CourierShipping />
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
          
          {/* Payroll & Attendance Routes */}
          <Route path="/admin/payroll" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPayroll />
            </ProtectedRoute>
          } />
          <Route path="/admin/attendance" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminAttendance />
            </ProtectedRoute>
          } />
          <Route path="/my-attendance" element={
            <ProtectedRoute allowedRoles={['call_support', 'supervisor', 'technician', 'service_agent', 'accountant', 'dispatcher', 'gate', 'admin']}>
              <MyAttendance />
            </ProtectedRoute>
          } />
          
          {/* View-Only Routes (for all employees except customers/dealers) */}
          <Route path="/view/dispatch-queue" element={
            <ProtectedRoute allowedRoles={['call_support', 'supervisor', 'technician', 'service_agent', 'accountant', 'dispatcher', 'gate', 'admin']}>
              <ViewDispatchQueue />
            </ProtectedRoute>
          } />
          <Route path="/view/pending-fulfillment" element={
            <ProtectedRoute allowedRoles={['call_support', 'supervisor', 'technician', 'service_agent', 'accountant', 'dispatcher', 'gate', 'admin']}>
              <ViewPendingFulfillment />
            </ProtectedRoute>
          } />
          
          {/* Dealer Portal Routes */}
          <Route path="/dealer" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dealer/deposit" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerDeposit />
            </ProtectedRoute>
          } />
          <Route path="/dealer/orders/new" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerPlaceOrder />
            </ProtectedRoute>
          } />
          <Route path="/dealer/orders" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerOrders />
            </ProtectedRoute>
          } />
          <Route path="/dealer/orders/:orderId" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerOrders />
            </ProtectedRoute>
          } />
          <Route path="/dealer/products" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerProducts />
            </ProtectedRoute>
          } />
          <Route path="/dealer/tickets" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerTickets />
            </ProtectedRoute>
          } />
          <Route path="/dealer/promotions" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerPromotions />
            </ProtectedRoute>
          } />
          <Route path="/dealer/profile" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerProfile />
            </ProtectedRoute>
          } />
          <Route path="/dealer/performance" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerPerformance />
            </ProtectedRoute>
          } />
          <Route path="/dealer/certificate" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerCertificate />
            </ProtectedRoute>
          } />
          <Route path="/dealer/ledger" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerLedger />
            </ProtectedRoute>
          } />
          <Route path="/dealer/dispatches" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerDispatches />
            </ProtectedRoute>
          } />
          <Route path="/dealer/documents" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerDocuments />
            </ProtectedRoute>
          } />
          
          {/* Public Dealer Verification */}
          <Route path="/verify-dealer/:token" element={<VerifyDealer />} />
          
          {/* Admin Dealer Management */}
          <Route path="/admin/dealer-applications" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDealerApplications />
            </ProtectedRoute>
          } />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <RoleBasedOrderBot />
      </BrowserRouter>
    </AuthProvider>
  );
}

// Component to conditionally render OrderBot based on user role
function RoleBasedOrderBot() {
  const { user } = useAuth();
  const location = useLocation();
  
  // Don't show bot on public catalogue pages
  if (location.pathname.startsWith('/catalogue')) {
    return null;
  }
  
  // Only show bot for admin, accountant, and supervisor roles
  const allowedRoles = ['admin', 'accountant', 'supervisor'];
  
  if (!user || !allowedRoles.includes(user.role)) {
    return null;
  }
  
  return <OrderBotWidget />;
}

export default App;

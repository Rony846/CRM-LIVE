import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from 'sonner';

// Components
import OrderBotWidget from './components/orderbot/OrderBotWidget';

// Pages
import LoginPage from './pages/LoginPage';
import ForgotPassword from './pages/ForgotPassword';
import RegisterPage from './pages/RegisterPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CustomerTickets from './pages/customer/CustomerTickets';
import CreateTicket from './pages/customer/CreateTicket';
import WarrantyRegistration from './pages/customer/WarrantyRegistration';
import MyWarranties from './pages/customer/MyWarranties';
import CustomerQuotations from './pages/customer/CustomerQuotations';
import CallSupportDashboard from './pages/support/CallSupportDashboard';
import CallSupportInbox from './pages/support/CallSupportInbox';
import EmailTicketInbox from './pages/support/EmailTicketInbox';
import ServiceAgentDashboard from './pages/service/ServiceAgentDashboard';
import AccountantDashboard from './pages/accountant/AccountantDashboard';
import CADashboard from './pages/ca/CADashboard';
import ImporterPortal from './pages/importer/ImporterPortal';
import ImporterReconciliation from './pages/admin/ImporterReconciliation';
import DispatcherDashboard from './pages/dispatcher/DispatcherDashboard';
import DispatcherTVMode from './pages/dispatcher/DispatcherTVMode';
import AdminDashboard from './pages/admin/AdminDashboard';
import ClaudeFiles from './pages/admin/ClaudeFiles';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminWarranties from './pages/admin/AdminWarranties';
import AdminOrders from './pages/admin/AdminOrders';
import AdminRepairs from './pages/admin/AdminRepairs';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTickets from './pages/admin/AdminTickets';
import AdminTicketDetail from './pages/admin/AdminTicketDetail';
import AdminCampaigns from './pages/admin/AdminCampaigns';
import AdminGateLogs from './pages/admin/AdminGateLogs';
import MissedLeads from './pages/admin/MissedLeads';
import ReviewRewards from './pages/admin/ReviewRewards';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminActivityLogs from './pages/admin/AdminActivityLogs';
import AdminDataManagement from './pages/admin/AdminDataManagement';
import SmartfloAgents from './pages/admin/SmartfloAgents';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import FinanceAnalytics from './pages/finance/FinanceAnalytics';
import TDSDashboard from './pages/finance/TDSDashboard';
import GSTHSNDashboard from './pages/finance/GSTHSNDashboard';
import EcommerceReconciliation from './pages/finance/EcommerceReconciliation';
import ImportCosting from './pages/finance/ImportCosting';
import BankReconciliation from './pages/finance/BankReconciliation';
import UnbookedReceipts from './pages/finance/UnbookedReceipts';
import FinanceAgent from './pages/agents/FinanceAgent';
import FinanceAgentWatch from './pages/agents/FinanceAgentWatch';
import FinanceAgentInbox from './pages/agents/FinanceAgentInbox';
import TechnicianDashboard from './pages/technician/TechnicianDashboard';
import GateDashboard from './pages/gate/GateDashboard';
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';
import SupervisorWarranties from './pages/supervisor/SupervisorWarranties';
import SupervisorCalendar from './pages/supervisor/SupervisorCalendar';
import AdminSKUManagement from './pages/admin/AdminSKUManagement';
import AdminFirms from './pages/admin/AdminFirms';
import AdminMasterSKU from './pages/admin/AdminMasterSKU';
import AdminZohoTickets from './pages/admin/AdminZohoTickets';
import AdminZohoForms from './pages/admin/AdminZohoForms';
import AdminSupervisorProduction from './pages/admin/AdminSupervisorProduction';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminSolarSamrat from './pages/admin/AdminSolarSamrat';
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
import GSTAudit from './pages/finance/GSTAudit';
import UnmappedAmazonSkus from './pages/admin/UnmappedAmazonSkus';
import ReconciliationMatch from './pages/finance/ReconciliationMatch';
import CreditNotes from './pages/accountant/CreditNotes';
import ReconciliationReports from './pages/accountant/ReconciliationReports';
import ExpensesDashboard from './pages/accountant/ExpensesDashboard';
import SerialNumbersManagement from './pages/inventory/SerialNumbersManagement';
import SupervisorProduction from './pages/supervisor/SupervisorProduction';
import TechnicianProduction from './pages/technician/TechnicianProduction';
import DispatchTasks from './pages/dispatch/DispatchTasks';
import AmazonOrders from './pages/operations/AmazonOrders';
import SkuWeights from './pages/admin/SkuWeights';
import EmailAgent from './pages/admin/EmailAgent';
import AmazonRefunds from './pages/admin/AmazonRefunds';
import CronRuns from './pages/admin/CronRuns';
import KnowledgeBase from './pages/admin/KnowledgeBase';
import QAScorecards from './pages/supervisor/QAScorecards';
import CourierShipping from './pages/operations/CourierShipping';
import CourierTracking from './pages/operations/CourierTracking';
import ProductDatasheets from './pages/admin/ProductDatasheets';
import AmazonSettings from './pages/admin/AmazonSettings';

// Browser Agent Pages
import BrowserAgentPage from './pages/admin/browser-agent/BrowserAgentPage';
import FileRepositoryPage from './pages/admin/browser-agent/FileRepositoryPage';
import OrdersFoldersPage from './pages/admin/OrdersFoldersPage';
import WhatsAppAgentPage from './pages/admin/whatsapp/WhatsAppAgentPage';
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
import AdminOmnidimCalls from './pages/admin/AdminOmnidimCalls';
import AdminWhatsAppChats from './pages/admin/AdminWhatsAppChats';
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
import DealerCatalogue from './pages/dealer/DealerCatalogue';
import DealerAnnouncements from './pages/dealer/DealerAnnouncements';
import DealerTargets from './pages/dealer/DealerTargets';
import DealerWarrantyRegistration from './pages/dealer/DealerWarrantyRegistration';
import DealerTerms from './pages/dealer/DealerTerms';
import DealerCustomers from './pages/dealer/DealerCustomers';
import DealerWarrantyClaims from './pages/dealer/DealerWarrantyClaims';
import DealerSpareParts from './pages/dealer/DealerSpareParts';
import DealerSpareOrders from './pages/dealer/DealerSpareOrders';
import DealerReorderSuggestions from './pages/dealer/DealerReorderSuggestions';
import AdminDealerApplications from './pages/admin/AdminDealerApplications';
import DealerManagement from './pages/admin/DealerManagement';
import AdminDealerProfile from './pages/admin/DealerProfile';
import { ChatProvider } from '@/components/chat/ChatProvider';
import ChatDock from '@/components/chat/ChatDock';
import ChatErrorBoundary from '@/components/chat/ChatErrorBoundary';
import ChatPage from './pages/chat/ChatPage';
import AdminDealerTerms from './pages/admin/AdminDealerTerms';
import AdminWarrantyClaims from './pages/admin/AdminWarrantyClaims';
import AdminSpareParts from './pages/admin/AdminSpareParts';
import AdminSpareOrders from './pages/admin/AdminSpareOrders';
import AmazonRefundLosses from './pages/admin/AmazonRefundLosses';
import AdminOnlineOrders from './pages/admin/AdminOnlineOrders';
import RedesignPreview from './pages/admin/RedesignPreview';
import LegalCases from './pages/admin/LegalCases';
import AZClaims from './pages/admin/AZClaims';
import AdminReviewRescue from './pages/admin/AdminReviewRescue';
import AdminWhatsAppAgent from './pages/admin/AdminWhatsAppAgent';

// Leads Pages
import LeadsPage from './pages/leads/LeadsPage';

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
    // Clear every persisted auth artefact so a logged-out session does not
    // leave stale PII in localStorage for the next user of the device.
    localStorage.removeItem('mg_token');
    localStorage.removeItem('user');
    localStorage.removeItem('dealer_user');
    sessionStorage.clear();
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
    // Redirect to the role's home dashboard. Mirror the RoleRedirect table
    // below — they previously diverged (supervisor was missing here, so
    // supervisors were bounced to /login on access-denied).
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
      dealer: '/dealer',
      ca: '/ca',
      importer: '/importer',
      lawyer: '/admin/legal-cases'
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
    dealer: '/dealer',
    ca: '/ca',
    importer: '/importer',
    lawyer: '/admin/legal-cases'
  };

  return <Navigate to={dashboardRoutes[user.role] || '/login'} replace />;
};

function App() {
  // Initialize theme from localStorage — Obsidian Elite is the default.
  useEffect(() => {
    // One-time migration: roll everyone onto Obsidian Elite as the new default.
    if (!localStorage.getItem('mg-theme-v2')) {
      localStorage.setItem('mg-theme', 'obsidian');
      localStorage.setItem('mg-theme-v2', '1');
    }
    const savedTheme = localStorage.getItem('mg-theme') || 'obsidian';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Handle dark/light mode class
    const darkThemes = ['obsidian', 'pro-dark', 'mono-dark'];
    if (darkThemes.includes(savedTheme)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <ChatProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
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
              <CallSupportInbox />
            </ProtectedRoute>
          } />
          <Route path="/support/legacy" element={
            <ProtectedRoute allowedRoles={['call_support', 'admin']}>
              <CallSupportDashboard />
            </ProtectedRoute>
          } />
          <Route path="/support/email-inbox" element={
            <ProtectedRoute allowedRoles={['call_support', 'admin']}>
              <EmailTicketInbox />
            </ProtectedRoute>
          } />
          <Route path="/support/*" element={
            <ProtectedRoute allowedRoles={['call_support', 'admin']}>
              <CallSupportDashboard />
            </ProtectedRoute>
          } />
          
          {/* Leads Routes - Sales leads management */}
          <Route path="/leads" element={
            <ProtectedRoute allowedRoles={['call_support', 'admin']}>
              <LeadsPage />
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
          <Route path="/supervisor/dispatch-tasks" element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <DispatchTasks />
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
          <Route path="/technician/dispatch-tasks" element={
            <ProtectedRoute allowedRoles={['service_agent', 'technician', 'admin']}>
              <DispatchTasks />
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
          
          {/* CA Portal (read-only GST filing view for external chartered accountant) */}
          <Route path="/ca" element={
            <ProtectedRoute allowedRoles={['ca', 'admin']}>
              <CADashboard />
            </ProtectedRoute>
          } />

          {/* Importer Portal (importers like KNB enter landed-cost + commission, bill MGIPL) */}
          <Route path="/importer" element={
            <ProtectedRoute allowedRoles={['importer', 'admin']}>
              <ImporterPortal />
            </ProtectedRoute>
          } />

          {/* Admin: importer reconciliation — you-vs-them across all importers */}
          <Route path="/admin/importer-reconciliation" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <ImporterReconciliation />
            </ProtectedRoute>
          } />

          {/* Legal Portal — the lawyer's cases live in the legal_cases system, so
              /legal redirects to the populated case page (was an empty parallel view). */}
          <Route path="/legal" element={
            <ProtectedRoute allowedRoles={['lawyer', 'admin']}>
              <Navigate to="/admin/legal-cases" replace />
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
          <Route path="/admin/missed-leads" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <MissedLeads />
            </ProtectedRoute>
          } />
          <Route path="/admin/review-rewards" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <ReviewRewards />
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
          <Route path="/finance/analytics" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <FinanceAnalytics />
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
          <Route path="/finance/gst-audit" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <GSTAudit />
            </ProtectedRoute>
          } />
          <Route path="/finance/reconciliation" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <ReconciliationMatch />
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
          <Route path="/finance/unbooked-receipts" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <UnbookedReceipts />
            </ProtectedRoute>
          } />
          <Route path="/agents/finance" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <FinanceAgent />
            </ProtectedRoute>
          } />
          <Route path="/agents/finance/watch" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <FinanceAgentWatch />
            </ProtectedRoute>
          } />
          <Route path="/agents/finance/inbox" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <FinanceAgentInbox />
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
          <Route path="/admin/files-for-claude" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ClaudeFiles />
            </ProtectedRoute>
          } />
          <Route path="/admin/reports" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <StockReports />
            </ProtectedRoute>
          } />
          <Route path="/admin/refunds" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <AmazonRefunds />
            </ProtectedRoute>
          } />
          <Route path="/admin/cron-runs" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CronRuns />
            </ProtectedRoute>
          } />
          <Route path="/admin/knowledge-base" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <KnowledgeBase />
            </ProtectedRoute>
          } />
          <Route path="/supervisor/qa-scorecards" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <QAScorecards />
            </ProtectedRoute>
          } />
          <Route path="/admin/master-sku" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <AdminMasterSKU />
            </ProtectedRoute>
          } />
          <Route path="/admin/omnidim-calls" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminOmnidimCalls />
            </ProtectedRoute>
          } />
          <Route path="/admin/whatsapp-chats" element={
            <ProtectedRoute allowedRoles={['admin', 'call_support']}>
              <AdminWhatsAppChats />
            </ProtectedRoute>
          } />
          <Route path="/admin/zoho-tickets" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'call_support']}>
              <AdminZohoTickets />
            </ProtectedRoute>
          } />
          <Route path="/admin/zoho-forms" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'call_support']}>
              <AdminZohoForms />
            </ProtectedRoute>
          } />
          <Route path="/admin/supervisor-production" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'accountant']}>
              <AdminSupervisorProduction />
            </ProtectedRoute>
          } />
          <Route path="/admin/employees" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <AdminEmployees />
            </ProtectedRoute>
          } />
          <Route path="/admin/solar-samrat" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminSolarSamrat />
            </ProtectedRoute>
          } />
          <Route path="/admin/product-datasheets" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <ProductDatasheets />
            </ProtectedRoute>
          } />
          <Route path="/admin/amazon-settings" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AmazonSettings />
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
          <Route path="/admin/sku-weights" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SkuWeights />
            </ProtectedRoute>
          } />
          <Route path="/admin/email-agent" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <EmailAgent />
            </ProtectedRoute>
          } />

          {/* Courier Shipping Route */}
          <Route path="/operations/courier-shipping" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin', 'dispatcher']}>
              <CourierShipping />
            </ProtectedRoute>
          } />

          {/* Courier Tracking Route */}
          <Route path="/operations/courier-tracking" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin', 'dispatcher']}>
              <CourierTracking />
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
          <Route path="/dealer/catalogue" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerCatalogue />
            </ProtectedRoute>
          } />
          <Route path="/dealer/announcements" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerAnnouncements />
            </ProtectedRoute>
          } />
          <Route path="/dealer/targets" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerTargets />
            </ProtectedRoute>
          } />
          <Route path="/dealer/warranty" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerWarrantyRegistration />
            </ProtectedRoute>
          } />
          <Route path="/dealer/reorder-suggestions" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerReorderSuggestions />
            </ProtectedRoute>
          } />
          <Route path="/dealer/terms" element={
            <ProtectedRoute allowedRoles={['dealer', 'admin']}>
              <DealerTerms />
            </ProtectedRoute>
          } />
          <Route path="/dealer/customers" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerCustomers />
            </ProtectedRoute>
          } />
          <Route path="/dealer/warranty-claims" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerWarrantyClaims />
            </ProtectedRoute>
          } />
          <Route path="/dealer/spare-parts" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerSpareParts />
            </ProtectedRoute>
          } />
          <Route path="/dealer/spare-orders" element={
            <ProtectedRoute allowedRoles={['dealer']}>
              <DealerSpareOrders />
            </ProtectedRoute>
          } />

          {/* Public Dealer Verification */}
          <Route path="/verify-dealer/:token" element={<VerifyDealer />} />
          
          {/* Admin Dealer Management */}
          <Route path="/admin/amazon-unmapped" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <UnmappedAmazonSkus />
            </ProtectedRoute>
          } />
          <Route path="/admin/dealers" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DealerManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/dealers/:dealerId" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDealerProfile />
            </ProtectedRoute>
          } />
          <Route path="/admin/dealer-applications" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDealerApplications />
            </ProtectedRoute>
          } />
          <Route path="/admin/dealer-terms" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDealerTerms />
            </ProtectedRoute>
          } />
          <Route path="/admin/warranty-claims" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminWarrantyClaims />
            </ProtectedRoute>
          } />
          <Route path="/admin/spare-parts" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminSpareParts />
            </ProtectedRoute>
          } />
          <Route path="/admin/spare-orders" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminSpareOrders />
            </ProtectedRoute>
          } />
          <Route path="/admin/refund-losses" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <AmazonRefundLosses />
            </ProtectedRoute>
          } />
          <Route path="/admin/online-orders" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <AdminOnlineOrders />
            </ProtectedRoute>
          } />
          <Route path="/admin/redesign-preview" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <RedesignPreview />
            </ProtectedRoute>
          } />
          <Route path="/admin/legal-cases" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant', 'lawyer']}>
              <LegalCases />
            </ProtectedRoute>
          } />
          <Route path="/admin/az-claims" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <AZClaims />
            </ProtectedRoute>
          } />
          <Route path="/admin/review-rescue" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminReviewRescue />
            </ProtectedRoute>
          } />
          <Route path="/admin/whatsapp-agent" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminWhatsAppAgent />
            </ProtectedRoute>
          } />
          
          {/* Browser Agent - Amazon / Bigship per-firm browsers */}
          <Route path="/admin/browser-agent" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <BrowserAgentPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/browser-agent/:firmId" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <BrowserAgentPage />
            </ProtectedRoute>
          } />
          {/* Order Folders — Year → Firm → Month → Date → Order */}
          <Route path="/admin/orders-folders" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <OrdersFoldersPage />
            </ProtectedRoute>
          } />
          
          {/* WhatsApp AI Agent */}
          <Route path="/admin/whatsapp-agent" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <WhatsAppAgentPage />
            </ProtectedRoute>
          } />
          
          {/* File Repository */}
          <Route path="/admin/file-repository" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant']}>
              <FileRepositoryPage />
            </ProtectedRoute>
          } />
          
          {/* Internal team chat (full screen) */}
          <Route path="/chat" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'call_support', 'service_agent', 'technician', 'accountant', 'dispatcher', 'gate']}>
              <ChatPage />
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <RoleBasedOrderBot />
        <ChatErrorBoundary><ChatDock /></ChatErrorBoundary>
        </ChatProvider>
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

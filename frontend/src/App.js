import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from 'sonner';

// Components
import OrderBotWidget from './components/orderbot/OrderBotWidget';

// Pages
import LoginPage from './pages/LoginPageIron';
import ForgotPassword from './pages/ForgotPasswordIron';
import RegisterPage from './pages/RegisterPageIron';
import CompleteProfilePage from './pages/CompleteProfilePageIron';
import CustomerDashboard from './pages/customer/CustomerDashboardIron';
import CustomerTickets from './pages/customer/CustomerTicketsIron';
import CreateTicket from './pages/customer/CreateTicketIron';
import WarrantyRegistration from './pages/customer/WarrantyRegistrationIron';
import MyWarranties from './pages/customer/MyWarrantiesIron';
import CustomerQuotations from './pages/customer/CustomerQuotationsIron';
import CallSupportDashboard from './pages/support/CallSupportDashboardIron';
import CallSupportInbox from './pages/support/CallSupportInboxIron';
import CustomerThreeSixty from './pages/support/CustomerThreeSixty';
import EmailTicketInbox from './pages/support/EmailTicketInboxIron';
import ServiceAgentDashboard from './pages/service/ServiceAgentDashboardIron';
import AccountantDashboard from './pages/accountant/AccountantDashboardIron';
import CADashboard from './pages/ca/CADashboardIron';
import ImporterPortal from './pages/importer/ImporterPortalIron';
import ImporterReconciliation from './pages/admin/ImporterReconciliationIron';
import DispatcherDashboard from './pages/dispatcher/DispatcherDashboardIron';
import DispatcherTVMode from './pages/dispatcher/DispatcherTVModeIron';
import AdminDashboard1a from './pages/admin/AdminDashboard1a';
import ClaudeFiles from './pages/admin/ClaudeFilesIron';
import AdminCustomers from './pages/admin/AdminCustomersIron';
import AdminWarranties from './pages/admin/AdminWarrantiesIron';
import AdminOrders from './pages/admin/AdminOrdersIron';
import AdminRepairs from './pages/admin/AdminRepairsIron';
import AdminUsers from './pages/admin/AdminUsersIron';
import AdminTickets1a from './pages/admin/AdminTickets1a';
import AdminTicketDetail1a from './pages/admin/AdminTicketDetail1a';
import AdminCampaigns from './pages/admin/AdminCampaignsIron';
import AdminGateLogs from './pages/admin/AdminGateLogsIron';
import MissedLeads from './pages/admin/MissedLeadsIron';
import ReviewRewards from './pages/admin/ReviewRewardsIron';
import AdminAnalytics from './pages/admin/AdminAnalyticsIron';
import AdminActivityLogs from './pages/admin/AdminActivityLogsIron';
import AdminDataManagement from './pages/admin/AdminDataManagementIron';
import SmartfloAgents from './pages/admin/SmartfloAgentsIron';
import FinanceDashboard from './pages/finance/FinanceDashboardIron';
import FinanceAnalytics from './pages/finance/FinanceAnalyticsIron';
import TDSDashboard from './pages/finance/TDSDashboardIron';
import GSTHSNDashboard from './pages/finance/GSTHSNDashboardIron';
import EcommerceReconciliation from './pages/finance/EcommerceReconciliationIron';
import ImportCosting from './pages/finance/ImportCostingIron';
import BankReconciliation from './pages/finance/BankReconciliationIron';
import UnbookedReceipts from './pages/finance/UnbookedReceiptsIron';
import FinanceAgent from './pages/agents/FinanceAgentIron';
import FinanceAgentWatch from './pages/agents/FinanceAgentWatchIron';
import FinanceAgentInbox from './pages/agents/FinanceAgentInboxIron';
import TechnicianDashboard from './pages/technician/TechnicianDashboardIron';
import GateDashboard from './pages/gate/GateDashboardIron';
import SupervisorDashboard1a from './pages/supervisor/SupervisorDashboard1a';
import SupervisorWarranties from './pages/supervisor/SupervisorWarrantiesIron';
import SupervisorCalendar from './pages/supervisor/SupervisorCalendarIron';
import AdminSKUManagement from './pages/admin/AdminSKUManagementIron';
import AdminFirms from './pages/admin/AdminFirmsIron';
import AdminMasterSKU from './pages/admin/AdminMasterSKUIron';
import AdminStoreProducts from './pages/admin/AdminStoreProducts';
import AdminZohoTickets from './pages/admin/AdminZohoTicketsIron';
import AdminZohoForms from './pages/admin/AdminZohoFormsIron';
import AdminSupervisorProduction from './pages/admin/AdminSupervisorProductionIron';
import AdminEmployees from './pages/admin/AdminEmployeesIron';
import AdminSolarSamrat from './pages/admin/AdminSolarSamratIron';
import StockReports from './pages/admin/StockReportsIron';
import CustomerAppointments from './pages/customer/CustomerAppointmentsIron';
import AccountantInventory from './pages/accountant/AccountantInventoryIron';
import IncomingInventoryQueue from './pages/accountant/IncomingInventoryQueueIron';
import ProductionRequests from './pages/accountant/ProductionRequestsIron';
import PendingFulfillment from './pages/accountant/PendingFulfillmentIron';
import ShipDesk from './pages/accountant/ShipDeskIron';
import ShipDeskHome from './pages/ShipDeskHome';
import ShipDeskBoard from './pages/ShipDeskBoard';
import ProductionBuild from './pages/production/ProductionBuild';
import ReturnDeskBoard from './pages/ReturnDeskBoard';
import MyPickups from './pages/customer/MyPickups';
import DispatcherShipDesk from './pages/dispatcher/DispatcherShipDesk';
import ManualBooking from './pages/accountant/ManualBooking';
import PurchaseRegister from './pages/accountant/PurchaseRegisterIron';
import SalesRegister from './pages/accountant/SalesRegisterIron';
import PartyMaster from './pages/admin/PartyMasterIron';
import ComplianceDashboard from './pages/admin/ComplianceDashboardIron';
import PartyLedger from './pages/accountant/PartyLedgerIron';
import Payments from './pages/accountant/PaymentsIron';
import AccountingReports from './pages/accountant/AccountingReportsIron';
import GSTAudit from './pages/finance/GSTAuditIron';
import UnmappedAmazonSkus from './pages/admin/UnmappedAmazonSkusIron';
import ReconciliationMatch from './pages/finance/ReconciliationMatchIron';
import CreditNotes from './pages/accountant/CreditNotesIron';
import ReconciliationReports from './pages/accountant/ReconciliationReportsIron';
import ExpensesDashboard from './pages/accountant/ExpensesDashboardIron';
import SerialNumbersManagement from './pages/inventory/SerialNumbersManagementIron';
import StabilizerStockScan from './pages/inventory/StabilizerStockScan';
import InventoryInward from './pages/inventory/InventoryInward';
import SupervisorProduction from './pages/supervisor/SupervisorProductionIron';
import TechnicianProduction from './pages/technician/TechnicianProductionIron';
import DispatchTasks from './pages/dispatch/DispatchTasksIron';
import AmazonOrders from './pages/operations/AmazonOrdersIron';
import SkuWeights from './pages/admin/SkuWeightsIron';
import EmailAgent from './pages/admin/EmailAgentIron';
import AmazonRefunds from './pages/admin/AmazonRefundsIron';
import CronRuns from './pages/admin/CronRunsIron';
import KnowledgeBase from './pages/admin/KnowledgeBaseIron';
import QAScorecards from './pages/supervisor/QAScorecardsIron';
import CourierShipping from './pages/operations/CourierShippingIron';
import CourierTracking from './pages/operations/CourierTrackingIron';
import ProductDatasheets from './pages/admin/ProductDatasheetsIron';
import AmazonSettings from './pages/admin/AmazonSettingsIron';

// Browser Agent Pages
import BrowserAgentPage from './pages/admin/browser-agent/BrowserAgentPageIron';
import FileRepositoryPage from './pages/admin/browser-agent/FileRepositoryPageIron';
import OrdersFoldersPage from './pages/admin/OrdersFoldersPageIron';
import WhatsAppAgentPage from './pages/admin/whatsapp/WhatsAppAgentPageIron';
import PublicDatasheetView from './pages/public/PublicDatasheetView';
import VerifySerial from './pages/public/VerifySerial';
import StoreFront from './pages/store/StoreFront';
import CatalogueHome from './pages/public/CatalogueHome';
import BatteryShowcase from './pages/public/BatteryShowcase';
import StabilizerShowcase from './pages/public/StabilizerShowcase';
import ServoShowcase from './pages/public/ServoShowcase';
import SolarPanelShowcase from './pages/public/SolarPanelShowcase';
import AccessoriesListing from './pages/public/AccessoriesListing';
import CategoryListing from './pages/public/CategoryListing';

// Call Center Pages
import CallsDashboard from './pages/calls/CallsDashboardIron';

// View-Only Pages (for employees)
import ViewDispatchQueue from './pages/view/ViewDispatchQueueIron';
import ViewPendingFulfillment from './pages/view/ViewPendingFulfillmentIron';

// Quotation Pages
import QuotationList from './pages/quotations/QuotationListIron';
import QuotationForm from './pages/quotations/QuotationFormIron';
import PublicQuotationView from './pages/quotations/PublicQuotationView';
import PIPendingAction from './pages/quotations/PIPendingActionIron';

// Incentive Pages
import MyIncentives from './pages/incentives/MyIncentivesIron';
import AdminIncentives from './pages/incentives/AdminIncentivesIron';

// Payroll & Attendance Pages
import AdminPayroll from './pages/admin/AdminPayrollIron';
import AdminOmnidimCalls from './pages/admin/AdminOmnidimCallsIron';
import KommoBackupBrowse from './pages/admin/KommoBackupBrowse';
import RTOReturns from './pages/RTOReturns';
import AdminWhatsAppChats from './pages/admin/AdminWhatsAppChatsIron';
import AdminAttendance from './pages/admin/AdminAttendanceIron';
import MyAttendance from './pages/employee/MyAttendanceIron';

// Dealer Portal Pages
import DealerLogin from './pages/dealer/DealerLoginIron';
import DealerRegister from './pages/dealer/DealerRegisterIron';
import DealerDashboard from './pages/dealer/DealerDashboardIron';
import DealerDeposit from './pages/dealer/DealerDepositIron';
import DealerPlaceOrder from './pages/dealer/DealerPlaceOrderIron';
import DealerOrders from './pages/dealer/DealerOrdersIron';
import DealerProducts from './pages/dealer/DealerProductsIron';
import DealerTickets from './pages/dealer/DealerTicketsIron';
import DealerPromotions from './pages/dealer/DealerPromotionsIron';
import DealerProfile from './pages/dealer/DealerProfileIron';
import DealerPerformance from './pages/dealer/DealerPerformanceIron';
import DealerCertificate from './pages/dealer/DealerCertificateIron';
import DealerLedger from './pages/dealer/DealerLedgerIron';
import DealerDispatches from './pages/dealer/DealerDispatchesIron';
import DealerDocuments from './pages/dealer/DealerDocumentsIron';
import DealerCatalogue from './pages/dealer/DealerCatalogueIron';
import DealerAnnouncements from './pages/dealer/DealerAnnouncementsIron';
import DealerTargets from './pages/dealer/DealerTargetsIron';
import DealerWarrantyRegistration from './pages/dealer/DealerWarrantyRegistrationIron';
import DealerTerms from './pages/dealer/DealerTermsIron';
import DealerCustomers from './pages/dealer/DealerCustomersIron';
import DealerWarrantyClaims from './pages/dealer/DealerWarrantyClaimsIron';
import DealerSpareParts from './pages/dealer/DealerSparePartsIron';
import DealerSpareOrders from './pages/dealer/DealerSpareOrdersIron';
import DealerReorderSuggestions from './pages/dealer/DealerReorderSuggestionsIron';
import AdminDealerApplications from './pages/admin/AdminDealerApplicationsIron';
import DealerManagement from './pages/admin/DealerManagementIron';
import AdminDealerProfile from './pages/admin/DealerProfileIron';
import { ChatProvider } from '@/components/chat/ChatProvider';
import ChatDock from '@/components/chat/ChatDock';
import ChatErrorBoundary from '@/components/chat/ChatErrorBoundary';
import ChatPage from './pages/chat/ChatPageIron';
import AdminDealerTerms from './pages/admin/AdminDealerTermsIron';
import AdminWarrantyClaims from './pages/admin/AdminWarrantyClaimsIron';
import AdminSpareParts from './pages/admin/AdminSparePartsIron';
import AdminSpareOrders from './pages/admin/AdminSpareOrdersIron';
import AmazonRefundLosses from './pages/admin/AmazonRefundLossesIron';
import AdminOnlineOrders from './pages/admin/AdminOnlineOrdersIron';
import RedesignPreview from './pages/admin/RedesignPreview';
import LegalCases from './pages/admin/LegalCasesIron';
import LegalDiary from './pages/admin/LegalDiary';
import AZClaims from './pages/admin/AZClaimsIron';
import AdminReviewRescue from './pages/admin/AdminReviewRescueIron';
import ReviewMatcher from './pages/admin/ReviewMatcher';
import AdminWhatsAppAgent from './pages/admin/AdminWhatsAppAgentIron';

// Leads Pages
import LeadsPage from './pages/leads/LeadsPageIron';

// Public Pages
import VerifyDealer from './pages/public/VerifyDealerIron';

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
      accountant: '/accountant/manual-bookings',
      dispatcher: '/dispatcher',
      gate: '/gate',
      admin: '/accountant/manual-bookings',
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
    accountant: '/accountant/manual-bookings',
    dispatcher: '/dispatcher',
    gate: '/gate',
    admin: '/accountant/manual-bookings',
    dealer: '/dealer',
    ca: '/ca',
    importer: '/importer',
    lawyer: '/admin/legal-cases'
  };

  return <Navigate to={dashboardRoutes[user.role] || '/login'} replace />;
};

function App() {
  // The public storefront runs on its own host (store.musclegrid.in) — serve it standalone,
  // outside the CRM auth/router/theme shell.
  const isStoreHost = typeof window !== 'undefined' && window.location.hostname.startsWith('store.');

  // Initialize theme from localStorage — Obsidian Elite is the default.
  useEffect(() => {
    if (isStoreHost) return;
    // One-time migration: Platinum is now the CRM default so text stays dark/legible on the light Iron
    // UI. (Bumped to v5 — the old Obsidian dark default left users with WHITE text on the new theme.)
    if (!localStorage.getItem('mg-theme-v5')) {
      localStorage.setItem('mg-theme', 'hud-platinum');
      localStorage.setItem('mg-theme-v5', '1');
    }
    const savedTheme = localStorage.getItem('mg-theme') || 'hud-platinum';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Handle dark/light mode class
    const darkThemes = ['obsidian', 'pro-dark', 'mono-dark', 'hud-dark'];
    if (darkThemes.includes(savedTheme)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  if (isStoreHost) return <StoreFront />;

  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <ChatProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/store" element={<StoreFront />} />
          <Route path="/store-preview" element={<StoreFront />} />
          <Route path="/customer-360" element={
            <ProtectedRoute allowedRoles={['call_support', 'supervisor', 'admin', 'service_agent', 'technician']}>
              <CustomerThreeSixty />
            </ProtectedRoute>
          } />
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
          <Route path="/verify/:serial" element={<VerifySerial />} />
          
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
          
          {/* Supervisor Routes — 1a "Iron Console" is the live dashboard */}
          <Route path="/supervisor" element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <SupervisorDashboard1a />
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
          <Route path="/ship-desk" element={
            <ProtectedRoute allowedRoles={['call_support', 'accountant', 'admin', 'supervisor', 'technician', 'service_agent', 'dispatcher', 'gate']}>
              <ShipDeskBoard />
            </ProtectedRoute>
          } />
          <Route path="/ship-desk/board" element={
            <ProtectedRoute allowedRoles={['call_support', 'accountant', 'admin', 'supervisor', 'technician', 'service_agent', 'dispatcher', 'gate']}>
              <ShipDeskBoard />
            </ProtectedRoute>
          } />
          <Route path="/production/build" element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'service_agent', 'technician', 'call_support']}>
              <ProductionBuild />
            </ProtectedRoute>
          } />
          <Route path="/return-desk" element={
            <ProtectedRoute allowedRoles={['call_support', 'accountant', 'admin', 'supervisor', 'technician', 'service_agent', 'dispatcher', 'gate']}>
              <ReturnDeskBoard />
            </ProtectedRoute>
          } />
          <Route path="/customer/pickups" element={
            <ProtectedRoute allowedRoles={['customer', 'admin']}>
              <MyPickups />
            </ProtectedRoute>
          } />
          <Route path="/ship-desk/legacy" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin', 'supervisor', 'technician', 'service_agent', 'dispatcher']}>
              <ShipDeskHome />
            </ProtectedRoute>
          } />
          <Route path="/supervisor/dispatch-tasks" element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <DispatchTasks />
            </ProtectedRoute>
          } />
          <Route path="/supervisor/*" element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <SupervisorDashboard1a />
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
          
          {/* Admin Routes — 1a "Iron Console" is the live admin home */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard1a />
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
              <AdminTickets1a />
            </ProtectedRoute>
          } />
          <Route path="/admin/tickets/:ticketId" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminTicketDetail1a />
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
          <Route path="/admin/store-products" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminStoreProducts />
            </ProtectedRoute>
          } />
          <Route path="/admin/omnidim-calls" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminOmnidimCalls />
            </ProtectedRoute>
          } />
          <Route path="/admin/kommo-backup" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <KommoBackupBrowse />
            </ProtectedRoute>
          } />
          <Route path="/rto-returns" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant', 'dispatcher', 'supervisor', 'service_agent', 'gate']}>
              <RTOReturns />
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
          <Route path="/accountant/ship-desk" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <ShipDesk />
            </ProtectedRoute>
          } />

          {/* Dispatcher's own Ship Desk — routed by category (inverter→Gaurav, battery/stabilizer→Angad) */}
          <Route path="/dispatcher/ship-desk" element={
            <ProtectedRoute allowedRoles={['service_agent', 'supervisor', 'dispatcher', 'admin']}>
              <DispatcherShipDesk />
            </ProtectedRoute>
          } />

          {/* Accountant manual-booking worklist (accountant/admin landing page) */}
          <Route path="/accountant/manual-bookings" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin']}>
              <ManualBooking />
            </ProtectedRoute>
          } />
          
          {/* Serial Numbers Management - Under Inventory */}
          <Route path="/inventory/serial-numbers" element={
            <ProtectedRoute allowedRoles={['accountant', 'admin', 'dispatcher']}>
              <SerialNumbersManagement />
            </ProtectedRoute>
          } />
          <Route path="/inventory/stabilizer-scan" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant', 'supervisor', 'service_agent', 'technician', 'call_support', 'dispatcher']}>
              <StabilizerStockScan />
            </ProtectedRoute>
          } />
          <Route path="/inventory/inward" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant', 'supervisor', 'service_agent', 'technician', 'gate', 'dispatcher']}>
              <InventoryInward />
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
          <Route path="/admin/legal-diary" element={
            <ProtectedRoute allowedRoles={['admin', 'accountant', 'lawyer']}>
              <LegalDiary />
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
          <Route path="/admin/review-matcher" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ReviewMatcher />
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

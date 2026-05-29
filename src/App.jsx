import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, RoleRoute, useAuth, roleHome } from './auth';
import AppShell from './components/AppShell';
import Login from './screens/Login';
import TechnicianQueue from './screens/TechnicianQueue';
import AdminDashboard from './screens/AdminDashboard';
import GateDashboard from './screens/GateDashboard';
import SupervisorDashboard from './screens/SupervisorDashboard';
import DealerNetwork from './screens/DealerNetwork';
import AccountantPortal from './screens/AccountantPortal';
import IncomingClassification from './screens/IncomingClassification';
import FinanceLedger from './screens/FinanceLedger';
import CallSupport from './screens/CallSupport';
import ComingSoon from './screens/ComingSoon';
import DealerDashboard from './screens/dealer/DealerDashboard';
import DealerCatalogue from './screens/dealer/DealerCatalogue';
import DealerOrders from './screens/dealer/DealerOrders';
import DealerLedger from './screens/dealer/DealerLedger';
import DealerWarranty from './screens/dealer/DealerWarranty';
import Home from './screens/Home';
import Profile from './screens/Profile';

// Sends an authenticated user to their role's landing screen; unauth -> login.
function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? roleHome(user.role) : '/login'} replace />;
}

// role group helpers
const R = (roles, el) => <RoleRoute roles={roles}>{el}</RoleRoute>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        {/* admin-only hub — the only place any dashboard can be opened */}
        <Route path="/home" element={R(['admin'], <Home />)} />
        <Route path="/admin/dashboard" element={R(['admin'], <AdminDashboard />)} />
        <Route path="/dealers" element={R(['admin'], <DealerNetwork />)} />

        {/* per-role dashboards (admin also allowed by RoleRoute) */}
        <Route path="/supervisor/dashboard" element={R(['supervisor'], <SupervisorDashboard />)} />
        <Route path="/technician/queue" element={R(['service_agent', 'technician'], <TechnicianQueue />)} />
        <Route path="/gate/scan" element={R(['gate', 'dispatcher'], <GateDashboard />)} />
        <Route path="/support" element={R(['call_support'], <CallSupport />)} />
        <Route path="/dispatch" element={R(['dispatcher'], <ComingSoon title="Dispatch" />)} />

        {/* accountant */}
        <Route path="/accountant/inventory" element={R(['accountant'], <AccountantPortal />)} />
        <Route path="/accountant/classify" element={R(['accountant'], <IncomingClassification />)} />
        <Route path="/accountant/classify/:id" element={R(['accountant'], <IncomingClassification />)} />
        <Route path="/accountant/ledger" element={R(['accountant'], <FinanceLedger />)} />

        {/* dealer self-service */}
        <Route path="/dealer/home" element={R(['dealer'], <DealerDashboard />)} />
        <Route path="/dealer/catalogue" element={R(['dealer'], <DealerCatalogue />)} />
        <Route path="/dealer/orders" element={R(['dealer'], <DealerOrders />)} />
        <Route path="/dealer/ledger" element={R(['dealer'], <DealerLedger />)} />
        <Route path="/dealer/warranty" element={R(['dealer'], <DealerWarranty />)} />

        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

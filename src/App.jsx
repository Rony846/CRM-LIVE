import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, useAuth, roleHome } from './auth';
import AppShell from './components/AppShell';
import Login from './screens/Login';
import TechnicianQueue from './screens/TechnicianQueue';
import AdminDashboard from './screens/AdminDashboard';
import GateDashboard from './screens/GateDashboard';
import SupervisorDashboard from './screens/SupervisorDashboard';
import AccountantPortal from './screens/AccountantPortal';
import IncomingClassification from './screens/IncomingClassification';
import FinanceLedger from './screens/FinanceLedger';
import Home from './screens/Home';
import Profile from './screens/Profile';

// Sends an authenticated user to their role's landing screen; unauth -> login.
function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? roleHome(user.role) : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/home" element={<Home />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/gate/scan" element={<GateDashboard />} />
        <Route path="/supervisor/dashboard" element={<SupervisorDashboard />} />
        <Route path="/technician/queue" element={<TechnicianQueue />} />
        <Route path="/accountant/inventory" element={<AccountantPortal />} />
        <Route path="/accountant/classify" element={<IncomingClassification />} />
        <Route path="/accountant/classify/:id" element={<IncomingClassification />} />
        <Route path="/accountant/ledger" element={<FinanceLedger />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

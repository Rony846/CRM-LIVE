import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/App';
import NotificationBell from '@/components/notifications/NotificationBell';
import { 
  LayoutDashboard, 
  Ticket, 
  Shield, 
  Users, 
  Truck, 
  Package, 
  Settings, 
  LogOut,
  Menu,
  X,
  ChevronDown,
  FileText,
  UserPlus,
  ClipboardList,
  Warehouse,
  Monitor,
  Phone,
  Wrench,
  Scan,
  BarChart3,
  Clock,
  History,
  Inbox,
  FileSpreadsheet,
  Box,
  Factory,
  Activity,
  Database,
  IndianRupee,
  ShoppingCart,
  Building2,
  BookOpen,
  Wallet,
  ReceiptText,
  FileWarning
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileEdit, DollarSign, TrendingUp } from 'lucide-react';

const roleNavItems = {
  customer: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/customer' },
    { label: 'My Tickets', icon: Ticket, path: '/customer/tickets' },
    { label: 'Create Ticket', icon: FileText, path: '/customer/tickets/new' },
    { label: 'Book Appointment', icon: Clock, path: '/customer/appointments' },
    { label: 'Register Warranty', icon: Shield, path: '/customer/warranty/register' },
    { label: 'My Warranties', icon: ClipboardList, path: '/customer/warranties' },
  ],
  call_support: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/support' },
    { label: 'Ticket Queue', icon: Ticket, path: '/support/tickets' },
    { label: 'Create Ticket', icon: FileText, path: '/support/create' },
    { label: 'Quotations', icon: FileEdit, path: '/quotations', section: 'Sales Pipeline' },
    { label: 'Create Quotation', icon: FileText, path: '/quotations/new' },
    { label: 'My Incentives', icon: DollarSign, path: '/my-incentives', section: 'Earnings' },
  ],
  supervisor: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/supervisor' },
    { label: 'Warranties', icon: Shield, path: '/supervisor/warranties' },
    { label: 'Production', icon: Factory, path: '/supervisor/production' },
    { label: 'Calendar', icon: Clock, path: '/supervisor/calendar' },
  ],
  service_agent: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/technician' },
    { label: 'Repair Queue', icon: Wrench, path: '/technician/queue' },
    { label: 'Production', icon: Factory, path: '/technician/production' },
    { label: 'My Repairs', icon: ClipboardList, path: '/technician/my-repairs' },
  ],
  technician: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/technician' },
    { label: 'Repair Queue', icon: Wrench, path: '/technician/queue' },
    { label: 'Production', icon: Factory, path: '/technician/production' },
    { label: 'My Repairs', icon: ClipboardList, path: '/technician/my-repairs' },
  ],
  accountant: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/accountant' },
    { label: 'Compliance', icon: FileWarning, path: '/admin/compliance' },
    { label: 'Finance & GST', icon: IndianRupee, path: '/finance' },
    { label: 'Sales Register', icon: FileText, path: '/accountant/sales' },
    { label: 'Purchase Register', icon: ShoppingCart, path: '/accountant/purchases' },
    { label: 'Party Master', icon: Users, path: '/admin/parties' },
    { label: 'Party Ledger', icon: BookOpen, path: '/accountant/ledger' },
    { label: 'Payments', icon: Wallet, path: '/accountant/payments' },
    { label: 'Credit Notes', icon: ReceiptText, path: '/accountant/credit-notes' },
    { label: 'Reports', icon: BarChart3, path: '/accountant/reports' },
    { label: 'Quotations', icon: FileEdit, path: '/quotations', section: 'Sales Pipeline' },
    { label: 'PI Pending Action', icon: Clock, path: '/quotations/pending-action' },
    { label: 'Incoming Queue', icon: Inbox, path: '/accountant/incoming-queue' },
    { label: 'Inventory', icon: Package, path: '/accountant/inventory' },
    { label: 'Production', icon: Factory, path: '/accountant/production' },
    { label: 'Pending Fulfillment', icon: Clock, path: '/accountant/pending-fulfillment' },
    { label: 'Master SKUs', icon: Box, path: '/admin/master-sku' },
    { label: 'Hardware Tickets', icon: Wrench, path: '/accountant/hardware' },
    { label: 'Upload Labels', icon: FileText, path: '/accountant/labels' },
    { label: 'Outbound Dispatch', icon: Truck, path: '/accountant/outbound' },
    { label: 'Gate Control', icon: Scan, path: '/gate' },
  ],
  dispatcher: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dispatcher' },
    { label: 'Dispatch Queue', icon: Package, path: '/dispatcher/queue' },
    { label: 'TV Mode', icon: Monitor, path: '/dispatcher/tv' },
  ],
  gate: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/gate' },
    { label: 'Scan Parcel', icon: Scan, path: '/gate/scan' },
    { label: 'Gate Logs', icon: History, path: '/gate/logs' },
    { label: 'Scheduled', icon: Clock, path: '/gate/scheduled' },
  ],
  admin: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { label: 'Compliance', icon: FileWarning, path: '/admin/compliance' },
    { label: 'All Tickets', icon: Ticket, path: '/admin/tickets' },
    { label: 'Repairs', icon: Wrench, path: '/admin/repairs' },
    { label: 'Customers', icon: Users, path: '/admin/customers' },
    { label: 'Party Master', icon: Building2, path: '/admin/parties' },
    { label: 'Warranties', icon: Shield, path: '/admin/warranties' },
    { label: 'Orders', icon: Package, path: '/admin/orders' },
    { label: 'Master SKUs', icon: Box, path: '/admin/master-sku' },
    { label: 'Firms', icon: Warehouse, path: '/admin/firms' },
    { label: 'Quotations', icon: FileEdit, path: '/quotations', section: 'Sales Pipeline' },
    { label: 'PI Pending Action', icon: Clock, path: '/quotations/pending-action' },
    { label: 'Incentives', icon: DollarSign, path: '/admin/incentives', section: 'HR & Payroll' },
    { label: 'Stock Reports', icon: FileSpreadsheet, path: '/admin/reports' },
    { label: 'Finance & GST', icon: IndianRupee, path: '/finance' },
    { label: 'Sales Register', icon: FileText, path: '/accountant/sales' },
    { label: 'Purchase Register', icon: ShoppingCart, path: '/accountant/purchases' },
    { label: 'Party Ledger', icon: BookOpen, path: '/accountant/ledger' },
    { label: 'Payments', icon: Wallet, path: '/accountant/payments' },
    { label: 'Credit Notes', icon: ReceiptText, path: '/accountant/credit-notes' },
    { label: 'Accounting Reports', icon: BarChart3, path: '/accountant/reports' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    { label: 'Activity Logs', icon: Activity, path: '/admin/activity-logs' },
    { label: 'Data Management', icon: Database, path: '/admin/data-management' },
    { label: 'Gate Logs', icon: Scan, path: '/admin/gate-logs' },
    { label: 'Users', icon: UserPlus, path: '/admin/users' },
  ],
};

const roleLabels = {
  customer: 'Customer Portal',
  call_support: 'Call Support',
  service_agent: 'Technician',
  accountant: 'Accountant',
  dispatcher: 'Dispatcher',
  gate: 'Gate Control',
  admin: 'Admin Panel'
};

const roleIcons = {
  customer: Users,
  call_support: Phone,
  service_agent: Wrench,
  accountant: FileText,
  dispatcher: Truck,
  gate: Scan,
  admin: Settings
};

export default function DashboardLayout({ children, title }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  
  // Determine which role's navigation to show based on current path
  // Admin should see the relevant role's sidebar when on that role's pages
  const getActiveRole = () => {
    const path = location.pathname;
    if (user?.role === 'admin') {
      if (path.startsWith('/accountant')) return 'accountant';
      if (path.startsWith('/support')) return 'call_support';
      if (path.startsWith('/supervisor')) return 'supervisor';
      if (path.startsWith('/technician')) return 'service_agent';
      if (path.startsWith('/dispatcher')) return 'dispatcher';
      if (path.startsWith('/gate')) return 'gate';
      if (path.startsWith('/customer')) return 'customer';
    }
    return user?.role;
  };
  
  const activeRole = getActiveRole();
  const navItems = roleNavItems[activeRole] || [];
  const RoleIcon = roleIcons[activeRole] || Users;
  const displayRoleLabel = user?.role === 'admin' && activeRole !== 'admin' 
    ? `${roleLabels[activeRole]} (Admin View)` 
    : roleLabels[user?.role];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-slate-950 text-white transform transition-transform duration-200
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center font-bold text-lg">
              MG
            </div>
            <div>
              <span className="font-semibold text-lg">MuscleGrid</span>
              <p className="text-xs text-slate-400 uppercase tracking-wider">{displayRoleLabel}</p>
            </div>
          </Link>
          <button 
            className="lg:hidden p-1 hover:bg-slate-800 rounded"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div>
              <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto pb-20">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-cyan-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
                `}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
          
          {/* Quick Links for Admin - Moved inside nav */}
          {user?.role === 'admin' && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-3">Quick Access</p>
              <Link to="/dispatcher/tv" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white">
                <Monitor className="w-4 h-4" />
                Dispatcher TV
              </Link>
              <Link to="/gate" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white">
                <Scan className="w-4 h-4" />
                Gate Control
              </Link>
            </div>
          )}
        </nav>

        {/* Bottom section - Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 bg-slate-900">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-600/10 w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="h-16 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 hover:bg-slate-800 rounded-lg text-white"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-white">
              {title || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <NotificationBell />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 text-white hover:bg-slate-800">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </div>
                  <span className="hidden sm:block text-sm font-medium">
                    {user?.first_name}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-700">
                <DropdownMenuLabel className="text-white">
                  <div className="font-normal">
                    <p className="font-medium">{user?.first_name} {user?.last_name}</p>
                    <p className="text-sm text-slate-400">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem onClick={handleLogout} className="text-red-400 cursor-pointer hover:bg-slate-800">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

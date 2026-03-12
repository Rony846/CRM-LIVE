import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/App';
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
  Bell,
  ChevronDown,
  FileText,
  UserPlus,
  ClipboardList,
  Warehouse,
  Monitor,
  Phone,
  Wrench
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

const roleNavItems = {
  customer: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/customer' },
    { label: 'My Tickets', icon: Ticket, path: '/customer/tickets' },
    { label: 'Create Ticket', icon: FileText, path: '/customer/tickets/new' },
    { label: 'Register Warranty', icon: Shield, path: '/customer/warranty/register' },
    { label: 'My Warranties', icon: ClipboardList, path: '/customer/warranties' },
  ],
  call_support: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/support' },
    { label: 'Ticket Queue', icon: Ticket, path: '/support/tickets' },
    { label: 'Create Ticket', icon: FileText, path: '/support/create' },
  ],
  service_agent: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/service' },
    { label: 'My Tickets', icon: Ticket, path: '/service/tickets' },
  ],
  accountant: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/accountant' },
    { label: 'Outbound Dispatch', icon: Package, path: '/accountant/outbound' },
    { label: 'Upload Labels', icon: FileText, path: '/accountant/labels' },
    { label: 'Hardware Tickets', icon: Wrench, path: '/accountant/hardware' },
  ],
  dispatcher: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dispatcher' },
    { label: 'TV Mode', icon: Monitor, path: '/dispatcher/tv' },
  ],
  admin: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { label: 'Customers', icon: Users, path: '/admin/customers' },
    { label: 'Warranties', icon: Shield, path: '/admin/warranties' },
    { label: 'Campaigns', icon: FileText, path: '/admin/campaigns' },
    { label: 'Users', icon: UserPlus, path: '/admin/users' },
    { label: 'All Tickets', icon: Ticket, path: '/admin/tickets' },
  ],
};

const roleLabels = {
  customer: 'Customer Portal',
  call_support: 'Call Support',
  service_agent: 'Service Agent',
  accountant: 'Accountant',
  dispatcher: 'Dispatcher',
  admin: 'Admin Panel'
};

const roleIcons = {
  customer: Users,
  call_support: Phone,
  service_agent: Wrench,
  accountant: FileText,
  dispatcher: Truck,
  admin: Settings
};

export default function DashboardLayout({ children, title }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  
  const navItems = roleNavItems[user?.role] || [];
  const RoleIcon = roleIcons[user?.role] || Users;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white transform transition-transform duration-200
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
              <Warehouse className="w-5 h-5" />
            </div>
            <span className="font-semibold text-lg font-['Barlow_Condensed']">MuscleGrid</span>
          </Link>
          <button 
            className="lg:hidden p-1 hover:bg-slate-700 rounded"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Badge */}
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <RoleIcon className="w-4 h-4" />
            <span>{roleLabels[user?.role]}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
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
                  flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
                `}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 hover:bg-slate-100 rounded-md"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold font-['Barlow_Condensed'] text-slate-900">
              {title || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="p-2 hover:bg-slate-100 rounded-md relative">
              <Bell className="w-5 h-5 text-slate-600" />
            </button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </div>
                  <span className="hidden sm:block text-sm font-medium">
                    {user?.first_name} {user?.last_name}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-normal">
                    <p className="font-medium">{user?.first_name} {user?.last_name}</p>
                    <p className="text-sm text-slate-500">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
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

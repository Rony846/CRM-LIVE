import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import NotificationBell from '@/components/notifications/NotificationBell';
import ThemeSwitcher from '@/components/ui/ThemeSwitcher';
import axios from 'axios';
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
  ChevronRight,
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
  ShoppingBag,
  Building2,
  BookOpen,
  Wallet,
  ReceiptText,
  FileWarning,
  FileEdit,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Scale,
  PlayCircle,
  PauseCircle,
  Coffee,
  Timer,
  UserCog,
  CalendarDays,
  Key,
  Award,
  Calculator,
  Ship,
  CreditCard,
  Hash,
  Target,
  Megaphone,
  RefreshCw,
  FolderOpen
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
import { toast } from 'sonner';

// Grouped navigation for Admin
const adminNavGroups = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { label: 'Overview', icon: LayoutDashboard, path: '/admin' },
      { label: 'Compliance', icon: FileWarning, path: '/admin/compliance' },
    ]
  },
  {
    label: 'CRM',
    icon: Ticket,
    items: [
      { label: 'All Tickets', icon: Ticket, path: '/admin/tickets' },
      { label: 'Call Center', icon: Phone, path: '/calls' },
      { label: 'Sales Leads', icon: Users, path: '/leads' },
      { label: 'Repairs', icon: Wrench, path: '/admin/repairs' },
      { label: 'Customers', icon: Users, path: '/admin/customers' },
      { label: 'Warranties', icon: Shield, path: '/admin/warranties' },
    ]
  },
  {
    label: 'Sales',
    icon: ShoppingCart,
    items: [
      { label: 'Orders', icon: Package, path: '/admin/orders' },
      { label: 'Quotations', icon: FileEdit, path: '/quotations' },
      { label: 'PI Pending Action', icon: Clock, path: '/quotations/pending-action' },
    ]
  },
  {
    label: 'Inventory',
    icon: Package,
    items: [
      { label: 'Master SKUs', icon: Box, path: '/admin/master-sku' },
      { label: 'Firms', icon: Warehouse, path: '/admin/firms' },
      { label: 'Serial Numbers', icon: Hash, path: '/inventory/serial-numbers' },
      { label: 'Stock Reports', icon: FileSpreadsheet, path: '/admin/reports' },
      { label: 'Product Datasheets', icon: FileText, path: '/admin/product-datasheets' },
    ]
  },
  {
    label: 'Operations',
    icon: Factory,
    items: [
      { label: 'Amazon Orders', icon: ShoppingBag, path: '/operations/amazon-orders' },
      { label: 'Browser Agent', icon: Monitor, path: '/admin/browser-agent' },
      { label: 'File Repository', icon: FolderOpen, path: '/admin/file-repository' },
      { label: 'Courier Shipping', icon: Truck, path: '/operations/courier-shipping' },
      { label: 'Incoming Queue', icon: Inbox, path: '/accountant/incoming-queue' },
      { label: 'Inventory', icon: Package, path: '/accountant/inventory' },
      { label: 'Production', icon: Factory, path: '/accountant/production' },
      { label: 'Pending Fulfillment', icon: Clock, path: '/accountant/pending-fulfillment' },
      { label: 'Dispatch Queue', icon: Truck, path: '/view/dispatch-queue', viewOnly: true },
    ]
  },
  {
    label: 'Finance',
    icon: IndianRupee,
    items: [
      { label: 'Finance & GST', icon: IndianRupee, path: '/finance' },
      { label: 'TDS Management', icon: Calculator, path: '/finance/tds' },
      { label: 'GST / HSN', icon: FileText, path: '/finance/gst-hsn' },
      { label: 'E-commerce Recon', icon: ShoppingCart, path: '/finance/ecommerce-reconciliation' },
      { label: 'Import Costing', icon: Ship, path: '/finance/import-costing' },
      { label: 'Bank Reconciliation', icon: CreditCard, path: '/finance/bank-reconciliation' },
      { label: 'Sales Register', icon: FileText, path: '/accountant/sales' },
      { label: 'Purchase Register', icon: ShoppingCart, path: '/accountant/purchases' },
      { label: 'Party Master', icon: Building2, path: '/admin/parties' },
      { label: 'Party Ledger', icon: BookOpen, path: '/accountant/ledger' },
      { label: 'Payments', icon: Wallet, path: '/accountant/payments' },
      { label: 'Expenses & Tax Credits', icon: TrendingDown, path: '/accountant/expenses' },
      { label: 'Credit Notes', icon: ReceiptText, path: '/accountant/credit-notes' },
      { label: 'Accounting Reports', icon: BarChart3, path: '/accountant/reports' },
      { label: 'Reconciliation', icon: Scale, path: '/accountant/reconciliation' },
    ]
  },
  {
    label: 'HR & Payroll',
    icon: UserCog,
    items: [
      { label: 'Salary & Payroll', icon: DollarSign, path: '/admin/payroll' },
      { label: 'Attendance', icon: CalendarDays, path: '/admin/attendance' },
      { label: 'Incentives', icon: TrendingUp, path: '/admin/incentives' },
      { label: 'Users', icon: UserPlus, path: '/admin/users' },
    ]
  },
  {
    label: 'Dealer Portal',
    icon: Building2,
    items: [
      { label: 'Applications', icon: FileText, path: '/admin/dealer-applications' },
      { label: 'All Dealers', icon: Users, path: '/admin/dealer-applications?tab=dealers' },
      { label: 'Dealer Orders', icon: ShoppingCart, path: '/admin/dealer-applications?tab=orders' },
      { label: 'Dealer Products', icon: Package, path: '/admin/dealer-applications?tab=products' },
    ]
  },
  {
    label: 'System',
    icon: Settings,
    items: [
      { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
      { label: 'Activity Logs', icon: Activity, path: '/admin/activity-logs' },
      { label: 'Smartflo Agents', icon: Phone, path: '/admin/smartflo-agents' },
      { label: 'Amazon Settings', icon: Key, path: '/admin/amazon-settings' },
      { label: 'Data Management', icon: Database, path: '/admin/data-management' },
      { label: 'Gate Logs', icon: Scan, path: '/admin/gate-logs' },
    ]
  },
];

// Grouped navigation for Accountant
const accountantNavGroups = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { label: 'Overview', icon: LayoutDashboard, path: '/accountant' },
      { label: 'Compliance', icon: FileWarning, path: '/admin/compliance' },
    ]
  },
  {
    label: 'Marketplace',
    icon: ShoppingBag,
    items: [
      { label: 'Amazon Orders', icon: ShoppingBag, path: '/operations/amazon-orders' },
      { label: 'Courier Shipping', icon: Truck, path: '/operations/courier-shipping' },
      { label: 'E-commerce Recon', icon: Scale, path: '/finance/ecommerce-reconciliation' },
      { label: 'Expenses & Tax Credits', icon: TrendingDown, path: '/accountant/expenses' },
    ]
  },
  {
    label: 'Finance',
    icon: IndianRupee,
    items: [
      { label: 'Finance & GST', icon: IndianRupee, path: '/finance' },
      { label: 'TDS Management', icon: Calculator, path: '/finance/tds' },
      { label: 'GST / HSN', icon: FileText, path: '/finance/gst-hsn' },
      { label: 'Sales Register', icon: FileText, path: '/accountant/sales' },
      { label: 'Purchase Register', icon: ShoppingCart, path: '/accountant/purchases' },
      { label: 'Party Master', icon: Users, path: '/admin/parties' },
      { label: 'Party Ledger', icon: BookOpen, path: '/accountant/ledger' },
      { label: 'Payments', icon: Wallet, path: '/accountant/payments' },
      { label: 'Credit Notes', icon: ReceiptText, path: '/accountant/credit-notes' },
      { label: 'Reports', icon: BarChart3, path: '/accountant/reports' },
      { label: 'Reconciliation', icon: Scale, path: '/accountant/reconciliation' },
    ]
  },
  {
    label: 'Sales',
    icon: FileEdit,
    items: [
      { label: 'Quotations', icon: FileEdit, path: '/quotations' },
      { label: 'PI Pending Action', icon: Clock, path: '/quotations/pending-action' },
    ]
  },
  {
    label: 'Operations',
    icon: Factory,
    items: [
      { label: 'Incoming Queue', icon: Inbox, path: '/accountant/incoming-queue' },
      { label: 'Inventory', icon: Package, path: '/accountant/inventory' },
      { label: 'Serial Numbers', icon: Hash, path: '/inventory/serial-numbers' },
      { label: 'Production', icon: Factory, path: '/accountant/production' },
      { label: 'Pending Fulfillment', icon: Clock, path: '/accountant/pending-fulfillment' },
      { label: 'Master SKUs', icon: Box, path: '/admin/master-sku' },
      { label: 'Product Datasheets', icon: FileText, path: '/admin/product-datasheets' },
    ]
  },
  {
    label: 'Dispatch',
    icon: Truck,
    items: [
      { label: 'Dispatch Queue', icon: Package, path: '/view/dispatch-queue', viewOnly: true },
      { label: 'Hardware Tickets', icon: Wrench, path: '/accountant/hardware' },
      { label: 'Upload Labels', icon: FileText, path: '/accountant/labels' },
      { label: 'Outbound Dispatch', icon: Truck, path: '/accountant/outbound' },
      { label: 'Gate Control', icon: Scan, path: '/gate' },
    ]
  },
];

// Flat navigation for other roles
const roleNavItems = {
  customer: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/customer' },
    { label: 'My Quotations', icon: FileEdit, path: '/customer/quotations' },
    { label: 'My Tickets', icon: Ticket, path: '/customer/tickets' },
    { label: 'Create Ticket', icon: FileText, path: '/customer/tickets/new' },
    { label: 'Book Appointment', icon: Clock, path: '/customer/appointments' },
    { label: 'Register Warranty', icon: Shield, path: '/customer/warranty/register' },
    { label: 'My Warranties', icon: ClipboardList, path: '/customer/warranties' },
  ],
  call_support: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/support' },
    { label: 'My Calls', icon: Phone, path: '/calls' },
    { label: 'Ticket Queue', icon: Ticket, path: '/support/tickets' },
    { label: 'Create Ticket', icon: FileText, path: '/support/create' },
    { label: 'Sales Leads', icon: Users, path: '/leads' },
    { label: 'Quotations', icon: FileEdit, path: '/quotations' },
    { label: 'Create Quotation', icon: FileText, path: '/quotations/new' },
    { label: 'Dispatch Queue', icon: Package, path: '/view/dispatch-queue', viewOnly: true },
    { label: 'Pending Fulfillment', icon: Clock, path: '/view/pending-fulfillment', viewOnly: true },
    { label: 'My Incentives', icon: DollarSign, path: '/my-incentives' },
    { label: 'My Attendance', icon: CalendarDays, path: '/my-attendance' },
  ],
  supervisor: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/supervisor' },
    { label: 'Call Center', icon: Phone, path: '/calls' },
    { label: 'Warranties', icon: Shield, path: '/supervisor/warranties' },
    { label: 'Production', icon: Factory, path: '/supervisor/production' },
    { label: 'Calendar', icon: Clock, path: '/supervisor/calendar' },
    { label: 'Dispatch Queue', icon: Package, path: '/view/dispatch-queue', viewOnly: true },
    { label: 'Pending Fulfillment', icon: Clock, path: '/view/pending-fulfillment', viewOnly: true },
    { label: 'My Attendance', icon: CalendarDays, path: '/my-attendance' },
  ],
  service_agent: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/technician' },
    { label: 'Repair Queue', icon: Wrench, path: '/technician/queue' },
    { label: 'Production', icon: Factory, path: '/technician/production' },
    { label: 'My Repairs', icon: ClipboardList, path: '/technician/my-repairs' },
    { label: 'Dispatch Queue', icon: Package, path: '/view/dispatch-queue', viewOnly: true },
    { label: 'Pending Fulfillment', icon: Clock, path: '/view/pending-fulfillment', viewOnly: true },
    { label: 'My Attendance', icon: CalendarDays, path: '/my-attendance' },
  ],
  technician: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/technician' },
    { label: 'Repair Queue', icon: Wrench, path: '/technician/queue' },
    { label: 'Production', icon: Factory, path: '/technician/production' },
    { label: 'My Repairs', icon: ClipboardList, path: '/technician/my-repairs' },
    { label: 'Dispatch Queue', icon: Package, path: '/view/dispatch-queue', viewOnly: true },
    { label: 'Pending Fulfillment', icon: Clock, path: '/view/pending-fulfillment', viewOnly: true },
    { label: 'My Attendance', icon: CalendarDays, path: '/my-attendance' },
  ],
  dispatcher: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dispatcher' },
    { label: 'Dispatch Queue', icon: Package, path: '/dispatcher/queue' },
    { label: 'Courier Shipping', icon: Truck, path: '/operations/courier-shipping' },
    { label: 'Pending Fulfillment', icon: Clock, path: '/view/pending-fulfillment', viewOnly: true },
    { label: 'TV Mode', icon: Monitor, path: '/dispatcher/tv' },
    { label: 'My Attendance', icon: CalendarDays, path: '/my-attendance' },
  ],
  gate: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/gate' },
    { label: 'Scan Parcel', icon: Scan, path: '/gate/scan' },
    { label: 'Gate Logs', icon: History, path: '/gate/logs' },
    { label: 'Scheduled', icon: Clock, path: '/gate/scheduled' },
    { label: 'Dispatch Queue', icon: Package, path: '/view/dispatch-queue', viewOnly: true },
    { label: 'Pending Fulfillment', icon: Clock, path: '/view/pending-fulfillment', viewOnly: true },
    { label: 'My Attendance', icon: CalendarDays, path: '/my-attendance' },
  ],
  dealer: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dealer' },
    { label: 'Product Catalogue', icon: Package, path: '/dealer/catalogue' },
    { label: 'Place Order', icon: ShoppingCart, path: '/dealer/orders/new' },
    { label: 'My Orders', icon: Package, path: '/dealer/orders' },
    { label: 'Track Dispatches', icon: Truck, path: '/dealer/dispatches' },
    { label: 'Reorder Suggestions', icon: RefreshCw, path: '/dealer/reorder-suggestions' },
    { label: 'Sales Targets', icon: Target, path: '/dealer/targets' },
    { label: 'Warranty Registration', icon: Shield, path: '/dealer/warranty' },
    { label: 'Announcements', icon: Megaphone, path: '/dealer/announcements' },
    { label: 'Ledger', icon: Wallet, path: '/dealer/ledger' },
    { label: 'Performance', icon: BarChart3, path: '/dealer/performance' },
    { label: 'Certificate', icon: Award, path: '/dealer/certificate' },
    { label: 'Downloads', icon: FileText, path: '/dealer/documents' },
    { label: 'My Profile', icon: Building2, path: '/dealer/profile' },
    { label: 'Deposit Status', icon: CreditCard, path: '/dealer/deposit' },
    { label: 'Support Tickets', icon: Ticket, path: '/dealer/tickets' },
    { label: 'Promotions', icon: TrendingUp, path: '/dealer/promotions' },
  ],
};

const roleLabels = {
  customer: 'Customer Portal',
  call_support: 'Call Support',
  service_agent: 'Technician',
  technician: 'Technician',
  accountant: 'Accountant',
  dispatcher: 'Dispatcher',
  gate: 'Gate Control',
  admin: 'Admin Panel',
  dealer: 'Dealer Portal'
};

// Collapsible Menu Group Component
function MenuGroup({ group, isOpen, onToggle, location, onLinkClick }) {
  const GroupIcon = group.icon;
  const hasActiveItem = group.items.some(item => 
    location.pathname === item.path || 
    (item.path !== '/' && location.pathname.startsWith(item.path))
  );

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
        style={{
          backgroundColor: hasActiveItem ? 'hsl(var(--theme-accent) / 0.2)' : 'transparent',
          color: hasActiveItem ? 'hsl(var(--theme-sidebar-foreground))' : 'hsl(var(--theme-sidebar-muted))'
        }}
      >
        <div className="flex items-center gap-3">
          <GroupIcon className="w-5 h-5" />
          {group.label}
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4" style={{ color: 'hsl(var(--theme-sidebar-muted))' }} />
        ) : (
          <ChevronRight className="w-4 h-4" style={{ color: 'hsl(var(--theme-sidebar-muted))' }} />
        )}
      </button>
      
      {isOpen && (
        <div className="ml-4 mt-1 space-y-0.5 pl-3" style={{ borderLeft: '1px solid hsl(var(--theme-sidebar-muted) / 0.3)' }}>
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onLinkClick}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-90"
                style={{
                  backgroundColor: isActive ? 'hsl(var(--theme-accent))' : 'transparent',
                  color: isActive ? 'white' : 'hsl(var(--theme-sidebar-muted))'
                }}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Shift Timer Component
function ShiftTimer({ token, user }) {
  const [shiftStatus, setShiftStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  const fetchShiftStatus = async () => {
    try {
      const response = await axios.get(`${API}/attendance/today`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShiftStatus(response.data);
    } catch (error) {
      // No shift today yet
      setShiftStatus(null);
    }
  };

  useEffect(() => {
    if (token && user?.role !== 'customer') {
      fetchShiftStatus();
    }
  }, [token, user]);

  // Update elapsed time every second when shift is active
  useEffect(() => {
    if (!shiftStatus?.login_time || shiftStatus?.logout_time) return;

    const updateTimer = () => {
      const loginTime = new Date(shiftStatus.login_time);
      const now = new Date();
      let totalMs = now - loginTime;
      
      // Subtract break time if on break or completed breaks
      if (shiftStatus.total_break_minutes) {
        totalMs -= shiftStatus.total_break_minutes * 60 * 1000;
      }
      if (shiftStatus.break_start && !shiftStatus.break_end_last) {
        const breakStart = new Date(shiftStatus.break_start);
        totalMs -= (now - breakStart);
      }

      const hours = Math.floor(totalMs / (1000 * 60 * 60));
      const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);
      
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [shiftStatus]);

  const handleAction = async (action) => {
    setLoading(true);
    try {
      await axios.post(`${API}/attendance/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchShiftStatus();
      
      const messages = {
        login: 'Shift started! Have a productive day.',
        logout: 'Shift ended. Great work today!',
        'break-start': 'Break started. Enjoy!',
        'break-end': 'Welcome back! Break ended.'
      };
      toast.success(messages[action]);
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setLoading(false);
    }
  };

  // Don't show for customers
  if (user?.role === 'customer') return null;

  const isLoggedIn = shiftStatus?.login_time && !shiftStatus?.logout_time;
  const isOnBreak = shiftStatus?.is_on_break;

  return (
    <div className="flex items-center gap-2">
      {isLoggedIn && (
        <div 
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: 'hsl(var(--accent))' }}
        >
          <Timer className="w-4 h-4" style={{ color: 'hsl(var(--theme-accent))' }} />
          <span 
            className="text-sm font-mono"
            style={{ color: 'hsl(var(--theme-header-foreground))' }}
          >
            {elapsedTime}
          </span>
          {isOnBreak && (
            <span className="text-xs text-yellow-400 ml-1">(Break)</span>
          )}
        </div>
      )}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className={`flex items-center gap-2 ${isLoggedIn ? 'text-green-400 hover:text-green-300' : ''}`}
            style={{ color: isLoggedIn ? undefined : 'hsl(var(--muted-foreground))' }}
            disabled={loading}
          >
            {isLoggedIn ? (
              <PlayCircle className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
            <span className="hidden sm:block text-sm">
              {isLoggedIn ? 'On Shift' : 'Start Shift'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-48"
          style={{ 
            backgroundColor: 'hsl(var(--theme-sidebar))',
            borderColor: 'hsl(var(--border))'
          }}
        >
          <DropdownMenuLabel 
            className="text-xs"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            Shift Controls
          </DropdownMenuLabel>
          <DropdownMenuSeparator style={{ backgroundColor: 'hsl(var(--border))' }} />
          
          {!isLoggedIn ? (
            <DropdownMenuItem 
              onClick={() => handleAction('login')}
              className="text-green-400 cursor-pointer"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Start Shift
            </DropdownMenuItem>
          ) : (
            <>
              {!isOnBreak ? (
                <DropdownMenuItem 
                  onClick={() => handleAction('break-start')}
                  className="text-yellow-400 cursor-pointer"
                >
                  <Coffee className="w-4 h-4 mr-2" />
                  Start Break
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem 
                  onClick={() => handleAction('break-end')}
                  className="cursor-pointer"
                  style={{ color: 'hsl(var(--theme-accent))' }}
                >
                  <PlayCircle className="w-4 h-4 mr-2" />
                  End Break
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={() => handleAction('logout')}
                className="text-red-400 cursor-pointer"
              >
                <PauseCircle className="w-4 h-4 mr-2" />
                End Shift
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function DashboardLayout({ children, title }) {
  const { user, logout, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});

  // Initialize open groups based on current path
  useEffect(() => {
    const groups = user?.role === 'admin' ? adminNavGroups : 
                   user?.role === 'accountant' ? accountantNavGroups : [];
    
    const newOpenGroups = {};
    groups.forEach(group => {
      const hasActiveItem = group.items.some(item => 
        location.pathname === item.path || 
        (item.path !== '/' && location.pathname.startsWith(item.path))
      );
      if (hasActiveItem) {
        newOpenGroups[group.label] = true;
      }
    });
    setOpenGroups(newOpenGroups);
  }, [location.pathname, user?.role]);

  const toggleGroup = (label) => {
    setOpenGroups(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  // Determine which role's navigation to show based on current path
  const getActiveRole = () => {
    const path = location.pathname;
    if (user?.role === 'admin') {
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
  const useGroupedNav = activeRole === 'admin' || activeRole === 'accountant';
  const navGroups = activeRole === 'admin' ? adminNavGroups : 
                    activeRole === 'accountant' ? accountantNavGroups : [];
  const navItems = roleNavItems[activeRole] || [];
  
  const displayRoleLabel = user?.role === 'admin' && activeRole !== 'admin' 
    ? `${roleLabels[activeRole]} (Admin View)` 
    : roleLabels[user?.role];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 left-0 z-50 h-full w-64 transform transition-transform duration-200
          lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ backgroundColor: 'hsl(var(--theme-sidebar))', color: 'hsl(var(--theme-sidebar-foreground))' }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <Link to="/" className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg text-white"
              style={{ backgroundColor: 'hsl(var(--theme-accent))' }}
            >
              MG
            </div>
            <div>
              <span className="font-semibold text-lg" style={{ color: 'hsl(var(--theme-sidebar-foreground))' }}>MuscleGrid</span>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>{displayRoleLabel}</p>
            </div>
          </Link>
          <button 
            className="lg:hidden p-1 rounded hover:opacity-80"
            onClick={() => setSidebarOpen(false)}
            style={{ color: 'hsl(var(--theme-sidebar-foreground))' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
              style={{ backgroundColor: 'hsl(var(--primary))' }}
            >
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'hsl(var(--theme-sidebar-foreground))' }}>{user?.first_name} {user?.last_name}</p>
              <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto pb-20 max-h-[calc(100vh-180px)]">
          {useGroupedNav ? (
            // Grouped navigation for Admin & Accountant
            navGroups.map((group) => (
              <MenuGroup
                key={group.label}
                group={group}
                isOpen={openGroups[group.label]}
                onToggle={() => toggleGroup(group.label)}
                location={location}
                onLinkClick={() => setSidebarOpen(false)}
              />
            ))
          ) : (
            // Flat navigation for other roles
            navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || 
                (item.path !== '/' && location.pathname.startsWith(item.path));
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                  style={{
                    backgroundColor: isActive ? 'hsl(var(--theme-accent))' : 'transparent',
                    color: isActive ? 'white' : 'hsl(var(--theme-sidebar-muted))'
                  }}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })
          )}
          
          {/* Quick Links for Admin */}
          {user?.role === 'admin' && activeRole === 'admin' && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid hsl(var(--theme-sidebar-muted) / 0.3)' }}>
              <p className="text-xs uppercase tracking-wider mb-2 px-3" style={{ color: 'hsl(var(--theme-sidebar-muted))' }}>Quick Access</p>
              <Link 
                to="/dispatcher/tv" 
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
                style={{ color: 'hsl(var(--theme-sidebar-muted))' }}
              >
                <Monitor className="w-4 h-4" />
                Dispatcher TV
              </Link>
              <Link 
                to="/gate" 
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
                style={{ color: 'hsl(var(--theme-sidebar-muted))' }}
              >
                <Scan className="w-4 h-4" />
                Gate Control
              </Link>
            </div>
          )}
        </nav>

        {/* Bottom section - Logout */}
        <div 
          className="absolute bottom-0 left-0 right-0 p-4"
          style={{ 
            borderTop: '1px solid hsl(var(--theme-sidebar-muted) / 0.3)',
            backgroundColor: 'hsl(var(--theme-sidebar))'
          }}
        >
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
        <header 
          className="h-16 flex items-center justify-between px-4 sticky top-0 z-30"
          style={{ 
            backgroundColor: 'hsl(var(--theme-header))',
            borderBottom: '1px solid hsl(var(--border))'
          }}
        >
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded-lg"
              onClick={() => setSidebarOpen(true)}
              style={{ color: 'hsl(var(--theme-header-foreground))' }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 
              className="text-xl font-semibold"
              style={{ color: 'hsl(var(--theme-header-foreground))' }}
            >
              {title || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Shift Timer & Controls - Only for employees, not customers or dealers */}
            {user?.role && !['customer', 'dealer'].includes(user.role) && (
              <ShiftTimer token={token} user={user} />
            )}

            {/* Theme Switcher */}
            <ThemeSwitcher />

            {/* Notifications */}
            <NotificationBell />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="flex items-center gap-2 px-2 hover:opacity-80"
                  style={{ color: 'hsl(var(--theme-header-foreground))' }}
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
                    style={{ backgroundColor: 'hsl(var(--primary))' }}
                  >
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </div>
                  <span className="hidden sm:block text-sm font-medium">
                    {user?.first_name}
                  </span>
                  <ChevronDown className="w-4 h-4" style={{ color: 'hsl(var(--muted-foreground))' }} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56"
                style={{ 
                  backgroundColor: 'hsl(var(--theme-sidebar))',
                  borderColor: 'hsl(var(--border))'
                }}
              >
                <DropdownMenuLabel style={{ color: 'hsl(var(--theme-sidebar-foreground))' }}>
                  <div className="font-normal">
                    <p className="font-medium">{user?.first_name} {user?.last_name}</p>
                    <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator style={{ backgroundColor: 'hsl(var(--border))' }} />
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="text-red-400 cursor-pointer"
                >
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

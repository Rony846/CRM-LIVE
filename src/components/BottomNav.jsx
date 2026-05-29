import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Ticket, Boxes, Wallet, ShieldCheck, ShoppingCart, ScanLine, Store, User, Headset, BadgeCheck } from 'lucide-react';
import { useAuth } from '../auth';

// Role-aware tabs — each role only ever sees destinations it can actually open.
const PROFILE = { id: 'profile', label: 'Profile', icon: User, to: '/profile' };
const NAV = {
  admin: [
    { id: 'home', label: 'Home', icon: Home, to: '/home' },
    { id: 'dealers', label: 'Dealers', icon: Store, to: '/dealers' },
    PROFILE,
  ],
  supervisor: [{ id: 'esc', label: 'Escalations', icon: ShieldCheck, to: '/supervisor/dashboard' }, PROFILE],
  service_agent: [{ id: 'q', label: 'Repairs', icon: Ticket, to: '/technician/queue' }, PROFILE],
  technician: [{ id: 'q', label: 'Repairs', icon: Ticket, to: '/technician/queue' }, PROFILE],
  gate: [{ id: 'g', label: 'Gate', icon: ScanLine, to: '/gate/scan' }, PROFILE],
  dispatcher: [{ id: 'g', label: 'Gate', icon: ScanLine, to: '/gate/scan' }, PROFILE],
  call_support: [{ id: 's', label: 'Queue', icon: Headset, to: '/support' }, PROFILE],
  accountant: [
    { id: 'a', label: 'Queue', icon: Boxes, to: '/accountant/inventory' },
    { id: 'l', label: 'Ledger', icon: Wallet, to: '/accountant/ledger' },
    PROFILE,
  ],
  dealer: [
    { id: 'd', label: 'Home', icon: Home, to: '/dealer/home' },
    { id: 'cat', label: 'Catalogue', icon: ShoppingCart, to: '/dealer/catalogue' },
    { id: 'ord', label: 'Orders', icon: Ticket, to: '/dealer/orders' },
    { id: 'led', label: 'Ledger', icon: Wallet, to: '/dealer/ledger' },
  ],
};

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const items = NAV[user?.role] || [PROFILE];
  return (
    <nav className="fixed bottom-0 w-full z-50 h-20 bg-surface-container-low border-t border-surface-bright flex justify-around items-center px-2">
      {items.map((item) => {
        const Ico = item.icon;
        const active = pathname === item.to;
        return (
          <button key={item.id} onClick={() => navigate(item.to)}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
            <div className={`p-1 px-4 rounded-xl transition-colors ${active ? 'bg-primary/10' : 'hover:bg-white/5'}`}>
              <Ico size={22} strokeWidth={active ? 2.5 : 2} />
            </div>
            <span className={`text-[10px] uppercase tracking-widest leading-none ${active ? 'font-bold' : 'opacity-70'}`}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

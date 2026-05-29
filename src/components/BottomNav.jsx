import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Ticket, Boxes, Wallet } from 'lucide-react';

// Ported from the Stitch export's src_components_bottomnavbar.jsx, wired to the
// router. Inventory/Finance are scaffolded (route to the hub) until built.
const ITEMS = [
  { id: 'home', label: 'Home', icon: Home, to: '/home' },
  { id: 'tickets', label: 'Tickets', icon: Ticket, to: '/technician/queue' },
  { id: 'inventory', label: 'Inventory', icon: Boxes, to: '/home' },
  { id: 'finance', label: 'Finance', icon: Wallet, to: '/home' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 w-full z-50 h-20 bg-surface-container-low border-t border-surface-bright flex justify-around items-center px-4">
      {ITEMS.map((item) => {
        const Ico = item.icon;
        const active = pathname === item.to;
        return (
          <button
            key={item.id}
            onClick={() => navigate(item.to)}
            className={`flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
              active ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            <div className={`p-1 px-4 rounded-xl transition-colors ${active ? 'bg-primary/10' : 'hover:bg-white/5'}`}>
              <Ico size={24} strokeWidth={active ? 2.5 : 2} />
            </div>
            <span className={`text-[10px] uppercase tracking-widest leading-none ${active ? 'font-bold' : 'opacity-70'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

import { useNavigate } from 'react-router-dom';
import Icon from '../lib/icon';
import { useAuth } from '../auth';

// Shared hub. Lists the modules that are live in this slice; the rest of the
// 28 Stitch screens get wired in here as they're built.
const MODULES = [
  { label: 'Admin Control', desc: 'System, staff & security', icon: 'shield_person', to: '/admin/dashboard', ready: true },
  { label: 'Call Support', desc: 'Tickets & feedback calls', icon: 'support_agent', to: '/support', ready: true },
  { label: 'Repair Queue', desc: 'Technician work queue', icon: 'build', to: '/technician/queue', ready: true },
  { label: 'Accountant Portal', desc: 'Incoming queue & registers', icon: 'account_balance_wallet', to: '/accountant/inventory', ready: true },
  { label: 'Incoming Classification', desc: 'Classify gate-scanned stock', icon: 'inventory_2', to: '/accountant/inventory', ready: true },
  { label: 'Finance Ledger', desc: 'Party ledger & GST', icon: 'account_balance', to: '/accountant/ledger', ready: true },
  { label: 'Gate Scan', desc: 'Inward / outward scanning', icon: 'qr_code_scanner', to: '/gate/scan', ready: true },
  { label: 'Supervisor Portal', desc: 'Escalations & actions', icon: 'supervisor_account', to: '/supervisor/dashboard', ready: true },
  { label: 'Dealer Network', desc: 'Partners, tiers & balances', icon: 'store', to: '/dealers', ready: true },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const name = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || 'there';

  return (
    <div className="p-margin-mobile flex flex-col gap-stack-lg">
      <section>
        <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">Welcome back</p>
        <h2 className="font-headline-nav text-headline-nav text-text-primary">{name}</h2>
        <span className="inline-flex items-center gap-1 mt-1 font-mono-data text-mono-data text-primary bg-primary/10 px-2 py-0.5 rounded capitalize">
          <Icon name="badge" style={{ fontSize: 14 }} />{(user?.role || 'staff').replace('_', ' ')}
        </span>
      </section>

      <section className="grid grid-cols-2 gap-stack-md">
        {MODULES.map((m) => (
          <button
            key={m.label}
            onClick={() => navigate(m.to)}
            className="text-left bg-surface-card border border-border-subtle p-stack-md rounded-xl flex flex-col gap-stack-sm active:scale-[0.98] transition-transform relative"
          >
            <div className="w-10 h-10 rounded-lg bg-primary-container/30 flex items-center justify-center">
              <Icon name={m.icon} className="text-primary" />
            </div>
            <div>
              <p className="font-body-bold text-body-bold text-text-primary leading-tight">{m.label}</p>
              <p className="font-mono-data-sm text-mono-data-sm text-on-surface-variant">{m.desc}</p>
            </div>
            {!m.ready && (
              <span className="absolute top-2 right-2 font-mono-data-sm text-mono-data-sm text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">soon</span>
            )}
          </button>
        ))}
      </section>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import Icon from '../lib/icon';
import { useAuth } from '../auth';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || 'User';
  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'U';

  const onLogout = () => { logout(); navigate('/login', { replace: true }); };

  const Row = ({ icon, label, value }) => (
    <div className="flex items-center gap-stack-md p-stack-md border-b border-border-subtle last:border-0">
      <Icon name={icon} className="text-on-surface-variant" />
      <div className="flex flex-col">
        <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{label}</span>
        <span className="font-body-bold text-body-bold text-text-primary break-all">{value || '—'}</span>
      </div>
    </div>
  );

  return (
    <div className="p-margin-mobile flex flex-col gap-stack-lg">
      <section className="flex flex-col items-center gap-stack-sm pt-stack-md">
        <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-display-kpi text-[28px]">
          {initials}
        </div>
        <h2 className="font-headline-card text-headline-card text-text-primary">{name}</h2>
        <span className="font-mono-data text-mono-data text-primary bg-primary/10 px-2 py-0.5 rounded capitalize">
          {(user?.role || 'staff').replace('_', ' ')}
        </span>
      </section>

      <section className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden">
        <Row icon="mail" label="Email" value={user?.email} />
        <Row icon="badge" label="Role" value={(user?.role || '').replace('_', ' ')} />
        <Row icon="fingerprint" label="User ID" value={user?.id} />
      </section>

      <button
        onClick={onLogout}
        className="w-full h-touch-target bg-error/15 text-error font-body-bold rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <Icon name="logout" />
        Sign Out
      </button>
    </div>
  );
}

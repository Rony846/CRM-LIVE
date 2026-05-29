import { useNavigate } from 'react-router-dom';
import Icon from '../lib/icon';
import { useAuth } from '../auth';

// Ported from the technician_repair_queue header. Avatar -> profile.
export default function TopAppBar({ title = 'MuscleGrid' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'U';
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center h-[64px] px-margin-mobile bg-surface border-b border-border-subtle">
      <div className="flex items-center gap-stack-sm">
        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
          <Icon name="bolt" className="text-on-primary-container" style={{ fontSize: 20 }} fill />
        </div>
        <h1 className="font-headline-nav text-headline-nav font-bold text-primary">{title}</h1>
      </div>
      <div className="flex items-center gap-stack-md">
        <Icon name="notifications" className="text-on-surface-variant hover:bg-surface-container-high p-2 rounded-full transition-colors active:scale-95 cursor-pointer" />
        <button
          onClick={() => navigate('/profile')}
          className="w-8 h-8 rounded-full bg-surface-container-high border border-border-subtle flex items-center justify-center text-text-primary font-body-bold text-[12px] active:scale-95 transition-transform"
          title="Profile"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}

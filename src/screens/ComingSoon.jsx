import Icon from '../lib/icon';
import { GradientHeader } from '../components/Glass';
import { useAuth } from '../auth';

export default function ComingSoon({ title }) {
  const { user } = useAuth();
  return (
    <div className="relative px-margin-mobile space-y-stack-lg">
      <GradientHeader title={title || 'Dashboard'} subtitle={(user?.role || '').replace('_', ' ')} />
      <div className="relative z-10 glass-panel rounded-2xl p-stack-lg flex flex-col items-center gap-stack-md text-center mt-stack-lg">
        <div className="w-16 h-16 rounded-full bg-primary-container/20 border border-primary-container/30 flex items-center justify-center">
          <Icon name="construction" className="text-primary" style={{ fontSize: 30 }} />
        </div>
        <div>
          <h3 className="font-headline-card text-text-primary text-xl mb-1">Dashboard coming soon</h3>
          <p className="font-body-base text-text-secondary">Your role-specific screen is being built. You only have access to this view.</p>
        </div>
      </div>
    </div>
  );
}

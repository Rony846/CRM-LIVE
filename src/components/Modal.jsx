import Icon from '../lib/icon';

// Lightweight glass modal used to confirm production-mutating actions.
export default function Modal({ open, onClose, title, icon, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md glass-panel rounded-t-2xl sm:rounded-2xl border border-border-subtle max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-stack-sm px-stack-md py-stack-md border-b border-border-subtle/50 sticky top-0 bg-surface-card/80 backdrop-blur">
          {icon && <Icon name={icon} className="text-primary" />}
          <h3 className="font-headline-card text-headline-card text-text-primary flex-1">{title}</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-text-primary"><Icon name="close" /></button>
        </div>
        <div className="p-stack-md space-y-stack-md">{children}</div>
        {footer && <div className="px-stack-md py-stack-md border-t border-border-subtle/50 flex gap-stack-sm">{footer}</div>}
      </div>
    </div>
  );
}

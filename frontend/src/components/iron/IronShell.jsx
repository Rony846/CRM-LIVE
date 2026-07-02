import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/App';
import PowerSearch from '@/components/PowerSearch';
import {
  LayoutDashboard, Ticket, Package, Users, ShieldCheck, Boxes, Store, UserCog,
  IndianRupee, BarChart3, FileText, Megaphone, Bell, LogOut, RefreshCw,
} from 'lucide-react';
import { T, Fonts, Caps, LIGHT_VARS, initials } from './IronKit';

/* Reusable Iron Console shell: dark sidebar (curated admin nav) + light header
   (title, subtitle, ⌘K PowerSearch, optional refresh + custom actions) + main. */

export const ADMIN_NAV = [
  ['Dashboard', LayoutDashboard, '/admin'],
  ['Tickets', Ticket, '/admin/tickets'],
  ['Orders', Package, '/admin/orders'],
  ['Customers', Users, '/admin/customers'],
  ['Warranties', ShieldCheck, '/admin/warranties'],
  ['Master SKU', Boxes, '/admin/master-sku'],
  ['Dealers', Store, '/admin/dealers'],
  ['Employees', UserCog, '/admin/employees'],
  ['Payroll', IndianRupee, '/admin/payroll'],
  ['Analytics', BarChart3, '/admin/analytics'],
  ['Campaigns', Megaphone, '/admin/campaigns'],
  ['Reports', FileText, '/admin/reports'],
];

export default function IronShell({ title, subtitle, nav = ADMIN_NAV, roleLabel = 'Admin Console', onRefresh, headerRight, showSearch = true, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (p) => location.pathname === p || (p !== '/admin' && location.pathname.startsWith(p + '/'));

  return (
    <div className="iron" style={{ display: 'grid', gridTemplateColumns: '226px 1fr', minHeight: '100vh', background: T.iron50, fontFamily: T.body, color: T.iron900,
      // The global `input/select { ...!important }` rule reads these vars — force them light
      // so native form controls render on-theme instead of inheriting the dark app theme.
      colorScheme: 'light', '--input-bg': '0 0% 100%', '--input-text': '222 47% 11%',
      '--input-border': '30 8% 88%', '--input-placeholder': '220 9% 56%' }}>
      <Fonts />
      <aside style={{ background: T.sidebar, color: '#fff', display: 'flex', flexDirection: 'column', padding: '18px 14px', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 6px 20px', cursor: 'pointer' }} onClick={() => navigate('/admin')}>
          <img src="/redesign/mg-monogram.png" alt="MG" style={{ width: 34, height: 34 }} />
          <div>
            <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 17, letterSpacing: '.02em' }}>MUSCLEGRID</div>
            <Caps size={8} color={T.orange} ls=".22em">{roleLabel}</Caps>
          </div>
        </div>
        <Caps size={8.5} color="#6f6f6f" style={{ padding: '6px 8px' }}>Workspace</Caps>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {nav.map(([label, Icon, path]) => {
            const active = isActive(path);
            return (
              <div key={label} className="iron-nav" onClick={() => navigate(path)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px', borderRadius: 8, marginBottom: 2, cursor: 'pointer',
                background: active ? 'rgba(245,130,32,.16)' : 'transparent', color: active ? '#fff' : '#c9c9c9' }}>
                <Icon size={15} color={active ? T.orange : '#9a9a9a'} strokeWidth={1.75} />
                <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5 }}>{label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: 10, margin: '8px 0', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: T.orange, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 800, fontSize: 11 }}>{initials(`${user?.first_name || ''} ${user?.last_name || ''}`) || 'AD'}</div>
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>{`${user?.first_name || 'Admin'} ${user?.last_name || ''}`.trim()}</div>
            <Caps size={8} color="#8a8a8a" ls=".1em">{user?.role || 'admin'}</Caps>
          </div>
        </div>
        <div className="iron-nav" onClick={() => { logout?.(); navigate('/login'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', color: '#9a9a9a', cursor: 'pointer', borderRadius: 8 }}>
          <LogOut size={14} strokeWidth={1.75} /><Caps size={10} color="#9a9a9a">Sign Out</Caps>
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ minHeight: 58, background: T.white, borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 22px', position: 'sticky', top: 0, zIndex: 5 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 16 }}>{title}</div>
          {subtitle && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.iron400 }}>{subtitle}</span>}
          <div style={{ flex: 1 }} />
          {headerRight}
          {showSearch && <div style={LIGHT_VARS}><PowerSearch /></div>}
          {onRefresh && (
            <button onClick={onRefresh} title="Refresh" style={{ border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, height: 34, width: 34, display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.iron700 }}>
              <RefreshCw size={15} strokeWidth={1.75} />
            </button>
          )}
          <Bell size={18} strokeWidth={1.75} color={T.iron700} />
        </header>
        <main style={{ padding: 22, overflow: 'auto' }}>{children}</main>
      </div>
    </div>
  );
}

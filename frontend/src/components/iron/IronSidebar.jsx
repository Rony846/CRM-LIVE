import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/App';
import {
  LayoutDashboard, Users, Ticket, Crown, ShoppingCart, Package, Factory,
  FolderOpen, ShoppingBag, Monitor, IndianRupee, Bot, UserCog, Building2,
  Settings, ChevronDown, ChevronRight, LogOut,
} from 'lucide-react';
import { T, Caps, initials, IRON_ADMIN_NAV, NAV_BY_ROLE, ROLE_LABEL } from './IronKit';

const GROUP_ICON = {
  Dashboard: LayoutDashboard, 'Team Dashboards': Users, CRM: Ticket, 'Solar Samrat': Crown,
  Sales: ShoppingCart, Inventory: Package, Operations: Factory, Folders: FolderOpen,
  Shopify: ShoppingBag, 'Browser Agents': Monitor, Finance: IndianRupee, Agents: Bot,
  'HR & Payroll': UserCog, 'Dealer Portal': Building2, System: Settings, Workspace: LayoutDashboard,
};

/* Reusable Iron Console dark sidebar with the COMPLETE grouped nav (nothing dropped vs the
   legacy menu). Collapsible groups; the group holding the active route auto-expands. */
export default function IronSidebar({ nav, roleLabel }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role || 'admin';
  nav = nav || NAV_BY_ROLE[role] || IRON_ADMIN_NAV;         // auto-pick the viewer's menu
  roleLabel = roleLabel || ROLE_LABEL[role] || 'Console';
  const home = role === 'admin' ? '/admin' : (nav[0] && nav[0][1] && nav[0][1][0] && nav[0][1][0][1]) || '/';
  const cur = location.pathname + location.search;
  const isActive = (p) => (p.includes('?') ? cur === p : location.pathname === p);
  const groupHasActive = (items) => items.some(([, p]) => isActive(p));

  const [open, setOpen] = useState(() => {
    const o = {};
    nav.forEach(([g, items]) => { if (groupHasActive(items) || items.length === 1 || g === 'Dashboard' || g === 'Workspace') o[g] = true; });
    return o;
  });
  // keep the active group expanded on navigation
  useEffect(() => {
    nav.forEach(([g, items]) => { if (groupHasActive(items)) setOpen((s) => ({ ...s, [g]: true })); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  return (
    <aside style={{ width: 226, flex: 'none', background: T.sidebar, color: '#fff', display: 'flex', flexDirection: 'column', padding: '18px 12px 14px', position: 'sticky', top: 0, height: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px 16px', cursor: 'pointer', flex: 'none' }} onClick={() => navigate(home)}>
        <img src="/redesign/mg-monogram.png" alt="MG" style={{ width: 34, height: 34 }} />
        <div>
          <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 17, letterSpacing: '.02em', lineHeight: 1 }}>MUSCLEGRID</div>
          <Caps size={8} color={T.orange} ls=".22em" style={{ marginTop: 3, display: 'block' }}>{roleLabel}</Caps>
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '0 0 10px', flex: 'none' }} />

      <div style={{ overflowY: 'auto', flex: 1, marginRight: -4, paddingRight: 4 }}>
        {nav.map(([group, items]) => {
          const Icon = GROUP_ICON[group] || LayoutDashboard;
          const expanded = !!open[group];
          const activeIn = groupHasActive(items);
          return (
            <div key={group} style={{ marginBottom: 2 }}>
              <div onClick={() => setOpen((s) => ({ ...s, [group]: !s[group] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  color: activeIn ? '#fff' : '#c9c9c9', background: activeIn && !expanded ? 'rgba(245,130,32,.10)' : 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = expanded ? 'transparent' : 'rgba(255,255,255,.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = activeIn && !expanded ? 'rgba(245,130,32,.10)' : 'transparent'; }}>
                <Icon size={15} color={activeIn ? T.orange : '#9a9a9a'} strokeWidth={1.75} />
                <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12, letterSpacing: '.02em' }}>{group}</span>
                <span style={{ marginLeft: 'auto', color: '#7a7a7a' }}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
              </div>
              {expanded && (
                <div style={{ margin: '2px 0 4px', paddingLeft: 8 }}>
                  {items.map(([label, path]) => {
                    const on = isActive(path);
                    return (
                      <div key={label + path} onClick={() => navigate(path)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 20px', borderRadius: 7, cursor: 'pointer', marginBottom: 1,
                          background: on ? 'rgba(245,130,32,.16)' : 'transparent', color: on ? '#fff' : '#b0b0b0',
                          borderLeft: `2px solid ${on ? T.orange : 'rgba(255,255,255,.07)'}` }}
                        onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,.05)'; }}
                        onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                        <span style={{ fontFamily: T.body, fontWeight: on ? 600 : 500, fontSize: 12 }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ flex: 'none', paddingTop: 12 }}>
        <div style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: T.orange, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 800, fontSize: 11 }}>{initials(`${user?.first_name || ''} ${user?.last_name || ''}`) || 'AD'}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{`${user?.first_name || 'Admin'} ${user?.last_name || ''}`.trim()}</div>
            <Caps size={8} color="#8a8a8a" ls=".1em">{user?.role || 'admin'}</Caps>
          </div>
        </div>
        <div onClick={() => { logout?.(); navigate('/login'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', color: '#9a9a9a', cursor: 'pointer', borderRadius: 8 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          <LogOut size={14} strokeWidth={1.75} /><Caps size={10} color="#9a9a9a">Sign Out</Caps>
        </div>
      </div>
    </aside>
  );
}

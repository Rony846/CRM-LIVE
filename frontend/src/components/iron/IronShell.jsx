import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PowerSearch from '@/components/PowerSearch';
import { Bell, RefreshCw, Menu } from 'lucide-react';
import { T, Fonts, LIGHT_VARS } from './IronKit';
import IronSidebar from './IronSidebar';

/* Reusable Iron Console shell: complete dark sidebar (IronSidebar) + light header
   (title, subtitle, ⌘K PowerSearch, optional refresh + custom actions) + main.
   Responsive: below 820px the sidebar collapses into a hamburger-toggled drawer and the
   content goes full-width. */

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 820);
  useEffect(() => {
    const on = () => setM(window.innerWidth < 820);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return m;
}

export default function IronShell({ title, subtitle, nav, roleLabel = 'Admin Console', onRefresh, headerRight, showSearch = true, children }) {
  const isMobile = useIsMobile();
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();
  useEffect(() => { setDrawer(false); }, [loc.pathname, loc.search]); // close drawer on navigate

  return (
    <div className="iron" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '226px 1fr', minHeight: '100vh', background: T.iron50, fontFamily: T.body, color: T.iron900,
      colorScheme: 'light', '--input-bg': '0 0% 100%', '--input-text': '222 47% 11%',
      '--input-border': '30 8% 88%', '--input-placeholder': '220 9% 56%' }}>
      <Fonts />

      {isMobile ? (
        <>
          <div onClick={() => setDrawer(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.5)',
            opacity: drawer ? 1 : 0, pointerEvents: drawer ? 'auto' : 'none', transition: 'opacity .2s' }} />
          <div style={{ position: 'fixed', top: 0, left: 0, width: 226, height: '100vh', overflow: 'hidden', zIndex: 61, boxShadow: drawer ? '4px 0 24px rgba(0,0,0,.4)' : 'none',
            transform: drawer ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .22s ease', willChange: 'transform' }}>
            <IronSidebar nav={nav} roleLabel={roleLabel} mobile />
          </div>
        </>
      ) : (
        <IronSidebar nav={nav} roleLabel={roleLabel} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ minHeight: 56, background: T.white, borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center',
          gap: isMobile ? 10 : 16, padding: isMobile ? '0 12px' : '0 22px', position: 'sticky', top: 0, zIndex: 5 }}>
          {isMobile && (
            <button onClick={() => setDrawer(true)} aria-label="Menu" style={{ border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 8, height: 38, width: 38, display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.iron800, flex: 'none' }}>
              <Menu size={20} strokeWidth={2} />
            </button>
          )}
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: isMobile ? 14.5 : 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          {subtitle && !isMobile && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.iron400 }}>{subtitle}</span>}
          <div style={{ flex: 1 }} />
          {headerRight}
          {showSearch && !isMobile && <div style={LIGHT_VARS}><PowerSearch /></div>}
          {onRefresh && (
            <button onClick={onRefresh} title="Refresh" style={{ border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, height: 38, width: 38, display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.iron700, flex: 'none' }}>
              <RefreshCw size={16} strokeWidth={1.75} />
            </button>
          )}
          {!isMobile && <Bell size={18} strokeWidth={1.75} color={T.iron700} />}
        </header>
        <main style={{ padding: isMobile ? 12 : 22, overflow: 'auto' }}>{children}</main>
      </div>
    </div>
  );
}

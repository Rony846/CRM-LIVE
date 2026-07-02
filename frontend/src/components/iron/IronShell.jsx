import React from 'react';
import PowerSearch from '@/components/PowerSearch';
import { Bell, RefreshCw } from 'lucide-react';
import { T, Fonts, LIGHT_VARS } from './IronKit';
import IronSidebar from './IronSidebar';

/* Reusable Iron Console shell: complete dark sidebar (IronSidebar) + light header
   (title, subtitle, ⌘K PowerSearch, optional refresh + custom actions) + main. */

export default function IronShell({ title, subtitle, nav, roleLabel = 'Admin Console', onRefresh, headerRight, showSearch = true, children }) {
  return (
    <div className="iron" style={{ display: 'grid', gridTemplateColumns: '226px 1fr', minHeight: '100vh', background: T.iron50, fontFamily: T.body, color: T.iron900,
      // The global `input/select { ...!important }` rule reads these vars — force them light
      // so native form controls render on-theme instead of inheriting the dark app theme.
      colorScheme: 'light', '--input-bg': '0 0% 100%', '--input-text': '222 47% 11%',
      '--input-border': '30 8% 88%', '--input-placeholder': '220 9% 56%' }}>
      <Fonts />
      <IronSidebar nav={nav} roleLabel={roleLabel} />

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

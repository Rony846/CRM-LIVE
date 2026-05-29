// Feature flags. WRITE_ENABLED gates every action that mutates the CRM
// (gate scan, supervisor action, classify). It's OFF unless VITE_WRITE_ACTIONS
// is exactly "true" — so a fresh build / missing env is fail-safe read-only.
// To enable: set VITE_WRITE_ACTIONS=true in .env, then `npm run build`.
export const WRITE_ENABLED = import.meta.env.VITE_WRITE_ACTIONS === 'true';
export const READONLY_MSG = 'Read-only mode — writes are disabled (set VITE_WRITE_ACTIONS=true and rebuild to enable).';

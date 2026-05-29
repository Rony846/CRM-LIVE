// Minimal API client for the MuscleGrid CRM backend. Base is /api (proxied to
// the FastAPI in dev — see vite.config.js). JWT is kept in localStorage, the
// pattern the Stitch integration docs assume.
const TOKEN_KEY = 'mg.staff.token';

// In the PWA (served under /staff/ by the CRM nginx) /api is same-origin and
// proxied. In the native Capacitor app the bundle is served from the WebView
// root (no proxy), so calls must hit the CRM backend by absolute URL — set via
// VITE_NATIVE_API_BASE. The backend must allow the WebView origin in CORS.
const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
const API_BASE = isNative ? (import.meta.env.VITE_NATIVE_API_BASE || '').replace(/\/$/, '') : '';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(path, { method = 'GET', body, form, auth = true } = {}) {
  // `form` sends application/x-www-form-urlencoded (some CRM endpoints use
  // FastAPI Form(...) params, e.g. supervisor-action); `body` sends JSON.
  const headers = {};
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  let payload;
  if (form !== undefined) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}/api${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = (data && data.detail) || res.statusText || 'Request failed';
    throw Object.assign(new Error(detail), { status: res.status, data });
  }
  return data;
}

// Minimal API client for the MuscleGrid CRM backend. Base is /api (proxied to
// the FastAPI in dev — see vite.config.js). JWT is kept in localStorage, the
// pattern the Stitch integration docs assume.
const TOKEN_KEY = 'mg.staff.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = (data && data.detail) || res.statusText || 'Request failed';
    throw Object.assign(new Error(detail), { status: res.status, data });
  }
  return data;
}

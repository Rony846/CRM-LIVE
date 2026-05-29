/**
 * MuscleGrid storefront lead proxy — Cloudflare Worker.
 *
 * The Shopify storefront form POSTs here WITHOUT any key. This worker holds the
 * CRM key as a server-side secret, enforces CORS for your domains, and forwards
 * the lead to the CRM. The key is never exposed to the browser.
 *
 * Bindings (set via wrangler / dashboard):
 *   LEAD_INTAKE_API_KEY  (secret) — must match the CRM backend .env value
 *   CRM_LEADS_URL        (var)    — https://newcrm.musclegrid.in/api/public/leads
 *   ALLOWED_ORIGINS      (var)    — comma list, e.g.
 *                                   https://musclegrid.in,https://www.musclegrid.in
 *   (any *.myshopify.com origin is allowed automatically, for theme previews)
 */

const DEFAULT_ALLOWED = ['https://musclegrid.in', 'https://www.musclegrid.in'];

function allowOrigin(origin, env) {
  if (!origin) return null;
  const list = (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED.join(','))
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (list.includes(origin)) return origin;
  try {
    if (new URL(origin).host.endsWith('.myshopify.com')) return origin;
  } catch (_) { /* ignore */ }
  return null;
}

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

const json = (obj, status, origin) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...(origin ? cors(origin) : {}) },
  });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = allowOrigin(origin, env);

    if (request.method === 'OPTIONS') {
      return allowed ? new Response(null, { status: 204, headers: cors(allowed) })
                     : new Response(null, { status: 403 });
    }
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    if (!allowed) return json({ success: false, error: 'Origin not allowed' }, 403, null);

    let body;
    try { body = await request.json(); }
    catch (_) { return json({ success: false, error: 'Invalid JSON' }, 400, allowed); }

    // Honeypot: bots fill hidden fields. Silently accept + drop.
    if (body.company || body.website || body._gotcha) return json({ success: true }, 200, allowed);

    const payload = {
      name: body.name,
      phone: body.phone,
      email: body.email,
      state: body.state,
      // `requirement` is the storefront's preferred key; product_interest is the
      // legacy alias. Forward both — the CRM uses whichever is present.
      requirement: body.requirement,
      product_interest: body.product_interest,
      notes: body.notes || body.message,
      source: body.source || 'shopify',
      page_url: body.page_url || request.headers.get('Referer') || origin,
    };

    try {
      const res = await fetch(env.CRM_LEADS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.LEAD_INTAKE_API_KEY,
          // forward the real visitor IP so the CRM rate-limits per-visitor
          'x-forwarded-for': request.headers.get('CF-Connecting-IP') || '',
        },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      return new Response(text, {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...cors(allowed) },
      });
    } catch (_) {
      return json({ success: false, error: 'CRM unreachable, please try again' }, 502, allowed);
    }
  },
};

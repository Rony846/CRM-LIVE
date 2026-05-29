# Storefront → CRM lead proxy (Cloudflare Worker)

Lets your Shopify storefront capture leads into the CRM's **Sales Leads** without
ever exposing the CRM key in browser JS.

```
Shopify form ──POST (no key)──▶ Cloudflare Worker ──POST (x-api-key)──▶ CRM /api/public/leads
                                  • holds LEAD_INTAKE_API_KEY (secret)
                                  • CORS for musclegrid.in + *.myshopify.com
```

The CRM side is already deployed: `POST /api/public/leads` (x-api-key auth,
rate-limited, dedupes a phone's open lead within 24h, creates a `status:new`
lead with `source:"shopify"` and notifies Call Support).

## Deploy the worker (one time)
```bash
npm i -g wrangler           # if you don't have it
cd storefront-proxy
wrangler login              # opens browser, authorise your Cloudflare account
wrangler secret put LEAD_INTAKE_API_KEY    # paste the key from the CRM backend .env
wrangler deploy
```
`wrangler deploy` prints your worker URL, e.g.
`https://musclegrid-lead-proxy.<your-subdomain>.workers.dev`. Copy it.

If your live storefront domain isn't musclegrid.in, edit `ALLOWED_ORIGINS` in
`wrangler.toml` and redeploy.

## Add the form to your Shopify theme
Create a page/section and paste this (set `PROXY_URL` to your worker URL):

```html
<form id="mg-lead-form" novalidate>
  <input name="name" placeholder="Your name" required>
  <input name="phone" placeholder="Mobile number" inputmode="tel" required>
  <input name="email" type="email" placeholder="Email (optional)">
  <input name="product_interest" placeholder="Product you're interested in">
  <textarea name="notes" placeholder="How can we help? (optional)"></textarea>
  <!-- honeypot: leave hidden; bots fill it and get dropped -->
  <input name="company" tabindex="-1" autocomplete="off" aria-hidden="true"
         style="position:absolute!important;left:-9999px;height:0;width:0;opacity:0">
  <button type="submit">Request a callback</button>
  <p id="mg-lead-msg" role="status"></p>
</form>

<script>
(function () {
  var PROXY_URL = "https://musclegrid-lead-proxy.YOUR-SUBDOMAIN.workers.dev"; // <-- set this
  var form = document.getElementById("mg-lead-form");
  var msg  = document.getElementById("mg-lead-msg");
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var data = Object.fromEntries(new FormData(form).entries());
    data.source = "shopify";
    data.page_url = location.href;
    msg.textContent = "Sending…";
    try {
      var res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      var out = await res.json();
      if (res.ok && out.success) { form.reset(); msg.textContent = "Thanks! Our team will call you shortly."; }
      else { msg.textContent = out.error || "Please check your details and try again."; }
    } catch (_) { msg.textContent = "Network error — please try again."; }
  });
})();
</script>
```

## Test
```bash
curl -i -X POST "https://musclegrid-lead-proxy.YOUR-SUBDOMAIN.workers.dev" \
  -H "Origin: https://musclegrid.in" -H "Content-Type: application/json" \
  -d '{"name":"Test","phone":"9876500000","product_interest":"Inverter"}'
```
Expect `{"success":true,"lead_id":"..."}` and a new card in the CRM at `/leads`.

## Rotate the key
Set a new `LEAD_INTAKE_API_KEY` in the CRM backend `.env` (restart backend), then
`wrangler secret put LEAD_INTAKE_API_KEY` with the same value + `wrangler deploy`.

## Notes
- CORS lives here on the proxy; the CRM endpoint is key-gated server-to-server.
- Rate limit: CRM caps 20 submissions/min per source IP (the worker forwards the
  visitor IP via `x-forwarded-for`). Honeypot + dedupe reduce spam/dupes.
- Want email/Shopify-webhook intake too? The same CRM endpoint accepts any JSON
  with at least `phone`.

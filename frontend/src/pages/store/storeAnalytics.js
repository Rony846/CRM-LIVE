/* Storefront marketing analytics — GA4 + Google Ads ("Google pixel") + Meta Pixel.
   IDs come from GET /api/shop/config (backend .env), so nothing is hardcoded and pixels stay off
   until the founder adds IDs. All calls are guarded — if a pixel isn't configured, they no-op. */

let CFG = { ga4_id: '', google_ads_id: '', google_ads_purchase_label: '', meta_pixel_id: '', currency: 'INR' };
let started = false;

function loadScript(src) {
  const s = document.createElement('script');
  s.async = true; s.src = src; document.head.appendChild(s);
}

function initGoogle() {
  const ids = [CFG.ga4_id, CFG.google_ads_id].filter(Boolean);
  if (!ids.length) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  loadScript('https://www.googletagmanager.com/gtag/js?id=' + ids[0]);
  window.gtag('js', new Date());
  ids.forEach((id) => window.gtag('config', id));
}

function initMeta() {
  if (!CFG.meta_pixel_id || window.fbq) return;
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', CFG.meta_pixel_id);
  window.fbq('track', 'PageView');
}

const g = (...a) => { if (window.gtag) try { window.gtag(...a); } catch (e) {} };
const fb = (...a) => { if (window.fbq) try { window.fbq(...a); } catch (e) {} };
const cur = () => CFG.currency || 'INR';

export function initAnalytics(config) {
  if (started) return; started = true;
  CFG = { ...CFG, ...(config || {}) };
  initGoogle();
  initMeta();
}

export function trackViewItem(p) {
  if (!p) return;
  const v = Number(p.price) || 0;
  g('event', 'view_item', { currency: cur(), value: v, items: [{ item_id: p.sku || p.id, item_name: p.title, price: v }] });
  fb('track', 'ViewContent', { currency: cur(), value: v, content_ids: [p.sku || p.id], content_type: 'product', content_name: p.title });
}

export function trackAddToCart(p, qty = 1) {
  if (!p) return;
  const v = (Number(p.price) || 0) * qty;
  g('event', 'add_to_cart', { currency: cur(), value: v, items: [{ item_id: p.sku || p.id, item_name: p.title, price: Number(p.price) || 0, quantity: qty }] });
  fb('track', 'AddToCart', { currency: cur(), value: v, content_ids: [p.sku || p.id], content_type: 'product', contents: [{ id: p.sku || p.id, quantity: qty }] });
}

export function trackBeginCheckout(cart, total) {
  const items = (cart || []).map((c) => ({ item_id: c.sku || c.id, item_name: c.title, price: Number(c.price) || 0, quantity: c.qty || 1 }));
  g('event', 'begin_checkout', { currency: cur(), value: Number(total) || 0, items });
  fb('track', 'InitiateCheckout', { currency: cur(), value: Number(total) || 0, num_items: items.reduce((s, i) => s + (i.quantity || 1), 0), content_ids: items.map((i) => i.item_id) });
}

export function trackPurchase({ orderNumber, total, cart }) {
  const items = (cart || []).map((c) => ({ item_id: c.sku || c.id, item_name: c.title, price: Number(c.price) || 0, quantity: c.qty || 1 }));
  const value = Number(total) || 0;
  g('event', 'purchase', { transaction_id: orderNumber, currency: cur(), value, items });
  // Google Ads conversion (the "Google pixel" conversion action)
  if (CFG.google_ads_id && CFG.google_ads_purchase_label) {
    g('event', 'conversion', { send_to: `${CFG.google_ads_id}/${CFG.google_ads_purchase_label}`, value, currency: cur(), transaction_id: orderNumber });
  }
  fb('track', 'Purchase', { currency: cur(), value, content_ids: items.map((i) => i.item_id), content_type: 'product', num_items: items.reduce((s, i) => s + (i.quantity || 1), 0) });
}

/* Runtime SEO helpers for the storefront SPA — per-product title/meta/canonical + Product JSON-LD.
   The prerender bakes the same for crawlers; this keeps things correct during client-side nav. */

const SITE = 'https://store.musclegrid.in';

function meta(name, content, attr = 'name') {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
  el.setAttribute('content', content || '');
}
function canonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el); }
  el.setAttribute('href', href);
}

export function productUrl(p) {
  return `${SITE}/product/${p.slug || p.handle || p.id}/`;
}

export function setProductSeo(p) {
  if (!p) return;
  const title = (p.seo_title || `${p.title} | MuscleGrid`).slice(0, 65);
  const desc = (p.seo_description || (p.description || '').replace(/\s+/g, ' ').trim() || `Buy ${p.title} online from MuscleGrid. Secure payment, warranty & pickup-repair-return service across India.`).slice(0, 300);
  const url = productUrl(p);
  document.title = title;
  meta('description', desc);
  meta('og:title', title, 'property'); meta('og:description', desc, 'property');
  meta('og:type', 'product', 'property'); if (p.image) meta('og:image', p.image, 'property');
  canonical(url);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.title,
    image: p.gallery && p.gallery.length ? p.gallery : (p.image ? [p.image] : []),
    description: desc, sku: p.sku, brand: { '@type': 'Brand', name: 'MuscleGrid' },
    offers: { '@type': 'Offer', url, priceCurrency: 'INR', price: String(Math.round(Number(p.price) || 0)), availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition' },
  };
  clearProductLd();
  const s = document.createElement('script');
  s.type = 'application/ld+json'; s.setAttribute('data-product-ld', '1'); s.text = JSON.stringify(ld);
  document.head.appendChild(s);
}

export function clearProductLd() {
  if (typeof document === 'undefined') return;
  document.head.querySelectorAll('script[data-product-ld="1"]').forEach((n) => n.remove());
}

const BASE_TITLE = 'MuscleGrid — Solar Inverters, Lithium & Inverter Batteries, Voltage Stabilizers';
const BASE_DESC = 'Buy MuscleGrid solar inverters, hybrid inverters, lithium & inverter batteries and voltage stabilizers online in India. Hassle-free pickup, repair & return warranty service. Secure payments.';
export function setBaseSeo() {
  document.title = BASE_TITLE;
  meta('description', BASE_DESC);
  canonical(SITE + '/');
  clearProductLd();
}

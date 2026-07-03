/* Post-build prerender for the storefront's static legal/policy pages.
   The store is a client-rendered SPA, so crawlers otherwise see an empty shell. This script bakes
   the full policy text + SEO meta + Organization JSON-LD into real static HTML at
   build/policies/<slug>/index.html (nginx serves these directly; the SPA still hydrates on top for
   humans). Runs automatically via the "postbuild" npm script. Product pages stay client-rendered. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const INDEX = path.join(BUILD, 'index.html');
const LEGAL_SRC = path.join(ROOT, 'src', 'pages', 'store', 'legalContent.js');

if (!fs.existsSync(INDEX)) { console.error('[prerender] build/index.html not found — run yarn build first'); process.exit(0); }

// legalContent.js is ESM with no relative imports → import it via a data: URL (ESM regardless of ext).
const srcText = fs.readFileSync(LEGAL_SRC, 'utf8');
const { LEGAL_DOCS, LEGAL_ORDER, COMPANY } = await import('data:text/javascript,' + encodeURIComponent(srcText));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderDoc(doc) {
  let h = '<main style="max-width:860px;margin:0 auto;padding:28px 20px 56px;font-family:Inter,system-ui,sans-serif;color:#1A1A1A;line-height:1.7">';
  h += `<h1 style="font-size:30px;margin:0 0 6px">${esc(doc.title)}</h1>`;
  h += `<div style="font-size:12px;color:#9A9A9A;margin-bottom:20px">${esc(COMPANY.legalName)} &middot; Last updated ${esc(doc.updated)}</div>`;
  if (doc.intro) h += `<p style="color:#4B4B4B;margin:0 0 22px">${esc(doc.intro)}</p>`;
  for (const s of doc.sections) {
    h += `<section style="margin-bottom:24px"><h2 style="font-size:17px;margin:0 0 10px">${esc(s.h)}</h2>`;
    for (const b of s.body) {
      if (typeof b === 'string') h += `<p style="color:#4B4B4B;margin:0 0 12px">${esc(b)}</p>`;
      else if (b && b.list) h += '<ul style="color:#4B4B4B;padding-left:20px;margin:0 0 12px">' + b.list.map((li) => `<li style="margin-bottom:6px">${esc(li)}</li>`).join('') + '</ul>';
    }
    h += '</section>';
  }
  h += '<nav style="border-top:1px solid #E6E6E6;margin-top:28px;padding-top:18px"><strong>More policies</strong><ul style="padding-left:20px">'
    + LEGAL_ORDER.filter((x) => x !== doc.slug).map((x) => `<li><a href="/policies/${x}/">${esc(LEGAL_DOCS[x].nav)}</a></li>`).join('')
    + '</ul></nav></main>';
  return h;
}

const orgLd = JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Organization',
  name: COMPANY.legalName, alternateName: COMPANY.brand, url: COMPANY.site,
  email: COMPANY.email, telephone: COMPANY.phone,
  address: { '@type': 'PostalAddress', streetAddress: COMPANY.address, addressCountry: 'IN' },
});

const baseHtml = fs.readFileSync(INDEX, 'utf8');

function build(doc) {
  let html = baseHtml;
  html = html.replace(/<title>.*?<\/title>/, `<title>${esc(doc.seoTitle)}</title>`);
  if (/<meta name="description"[^>]*>/.test(html)) html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(doc.seoDescription)}"/>`);
  else html = html.replace('</head>', `<meta name="description" content="${esc(doc.seoDescription)}"/></head>`);
  const head = `<link rel="canonical" href="${COMPANY.site}/policies/${doc.slug}/"/>`
    + `<meta property="og:title" content="${esc(doc.seoTitle)}"/>`
    + `<meta property="og:description" content="${esc(doc.seoDescription)}"/>`
    + `<meta property="og:type" content="website"/>`
    + `<script type="application/ld+json">${orgLd}</script>`;
  html = html.replace('</head>', head + '</head>');
  html = html.replace('<div id="root"></div>', `<div id="root">${renderDoc(doc)}</div>`);
  return html;
}

let n = 0;
for (const slug of LEGAL_ORDER) {
  const doc = LEGAL_DOCS[slug];
  const dir = path.join(BUILD, 'policies', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), build(doc));
  n++;
}

// Also bake a sensible base title/description into the home shell for crawlers.
{
  const homeTitle = 'MuscleGrid — Solar Inverters, Lithium & Inverter Batteries, Voltage Stabilizers';
  const homeDesc = 'Buy MuscleGrid solar inverters, hybrid inverters, lithium & inverter batteries and voltage stabilizers online in India. Hassle-free pickup, repair & return warranty service. Secure payments.';
  let html = baseHtml.replace(/<title>.*?<\/title>/, `<title>${esc(homeTitle)}</title>`);
  if (/<meta name="description"[^>]*>/.test(html)) html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(homeDesc)}"/>`);
  else html = html.replace('</head>', `<meta name="description" content="${esc(homeDesc)}"/></head>`);
  html = html.replace('</head>', `<script type="application/ld+json">${orgLd}</script></head>`);
  fs.writeFileSync(INDEX, html);
}

// ---- Product pages: fetch the live catalogue and bake a static page + Product schema each ----
let products = [];
try {
  const res = await fetch('http://127.0.0.1:8001/api/shop/products?limit=500');
  products = (await res.json()).products || [];
} catch (e) {
  console.log('[prerender] could not fetch products (backend down?) — skipping product pages:', e.message);
}

function renderProduct(p) {
  const price = Math.round(Number(p.price) || 0);
  let h = '<main style="max-width:900px;margin:0 auto;padding:28px 20px 56px;font-family:Inter,system-ui,sans-serif;color:#1A1A1A">';
  h += `<h1 style="font-size:26px;margin:0 0 12px">${esc(p.title)}</h1>`;
  if (p.image) h += `<img src="${esc(p.image)}" alt="${esc(p.title)}" style="max-width:360px;width:100%;border:1px solid #E6E6E6;border-radius:10px"/>`;
  h += `<div style="font-size:22px;font-weight:700;color:#D96A0A;margin:14px 0">₹${price.toLocaleString('en-IN')}</div>`;
  const desc = (p.description || '').trim();
  if (desc) h += `<div style="color:#4B4B4B;line-height:1.7;white-space:pre-wrap">${esc(desc)}</div>`;
  h += '<p style="margin-top:20px"><a href="/">&larr; All products</a></p></main>';
  return h;
}

let pn = 0;
for (const p of products) {
  const slug = p.slug || p.handle || p.id;
  if (!slug) continue;
  const url = `${COMPANY.site}/product/${slug}/`;
  const title = (p.seo_title || `${p.title} | MuscleGrid`).slice(0, 65);
  const desc = (p.seo_description || (p.description || '').replace(/\s+/g, ' ').trim() || `Buy ${p.title} online from MuscleGrid. Secure payment, warranty & pickup-repair-return service across India.`).slice(0, 300);
  const ld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Product', name: p.title,
    image: (p.gallery && p.gallery.length ? p.gallery : (p.image ? [p.image] : [])),
    description: desc, sku: p.sku, brand: { '@type': 'Brand', name: 'MuscleGrid' },
    offers: { '@type': 'Offer', url, priceCurrency: 'INR', price: String(Math.round(Number(p.price) || 0)), availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition' },
  });
  let html = baseHtml.replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`);
  if (/<meta name="description"[^>]*>/.test(html)) html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}"/>`);
  else html = html.replace('</head>', `<meta name="description" content="${esc(desc)}"/></head>`);
  const head = `<link rel="canonical" href="${url}"/><meta property="og:title" content="${esc(title)}"/>`
    + `<meta property="og:description" content="${esc(desc)}"/><meta property="og:type" content="product"/>`
    + (p.image ? `<meta property="og:image" content="${esc(p.image)}"/>` : '')
    + `<script type="application/ld+json">${ld}</script>`;
  html = html.replace('</head>', head + '</head>');
  html = html.replace('<div id="root"></div>', `<div id="root">${renderProduct(p)}</div>`);
  const dir = path.join(BUILD, 'product', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  pn++;
}

// ---- Sitemap: home + policies + every product ----
const urls = [`${COMPANY.site}/`]
  .concat(LEGAL_ORDER.map((s) => `${COMPANY.site}/policies/${s}/`))
  .concat(products.map((p) => `${COMPANY.site}/product/${p.slug || p.handle || p.id}/`));
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n') + '\n</urlset>\n';
fs.writeFileSync(path.join(BUILD, 'sitemap.xml'), sitemap);

console.log(`[prerender] wrote ${n} policy pages + ${pn} product pages + home shell + sitemap (${urls.length} urls)`);

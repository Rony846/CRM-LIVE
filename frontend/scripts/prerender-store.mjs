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

console.log(`[prerender] wrote ${n} policy pages + home shell`);

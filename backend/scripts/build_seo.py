"""Build the storefront's SEO layer:
  - /store/p/{slug}/index.html  : crawlable per-product page (title, meta, og, canonical,
       Product + Breadcrumb JSON-LD, visible content baked in, window.__MGPRODUCT for hydration)
  - /store/product/index.html   : legacy ?id= page (now uses the shared /shop/product.js)
  - sitemap.xml + robots.txt
Re-run anytime (e.g. after price/catalogue changes). Reads active sellable master_skus.
"""
import os, re, json, html, pathlib
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
BASE = os.environ.get("SEO_BASE", "https://musclegrid.in").rstrip("/")
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "store"
PDP_BODY = (pathlib.Path(__file__).resolve().parent / "_pdp_body.html").read_text()
SHOPQ = {"is_active": {"$ne": False}, "selling_price": {"$gt": 0}, "image_url": {"$nin": [None, ""]}}

MOBILE_CSS = """<style>
@media(max-width:768px){#pdpGrid{grid-template-columns:1fr!important;gap:22px!important}.mg-pdp{padding:16px 16px 40px!important}.mg-pdp-qty-row{flex-wrap:wrap}.mg-pdp-qty-row .mg-btn{flex:1 1 100%!important;min-width:0!important}.mg-pdp-trust{grid-template-columns:1fr 1fr!important}#pTitle{font-size:26px!important}#pPrice{font-size:30px!important}}
</style>"""

CARD = lambda m: {
    "id": m.get("id"), "slug": m.get("web_slug") or m.get("id"), "title": m.get("name"),
    "type": m.get("category") or m.get("product_type"), "price": m.get("selling_price"),
    "compare_at": m.get("mrp") if (m.get("mrp") or 0) > (m.get("selling_price") or 0) else None,
    "image": m.get("image_url"), "sku": m.get("sku_code"),
    "gallery": m.get("image_gallery") or ([m.get("image_url")] if m.get("image_url") else []),
    "description": m.get("description"),
}


def esc(s):
    return html.escape(str(s or ""), quote=True)


def head(title, desc, canonical, og_image, jsonld, og_type="product"):
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{esc(title)}</title><meta name="description" content="{esc(desc)}">'
            f'<link rel="canonical" href="{canonical}">'
            f'<meta property="og:type" content="{og_type}"><meta property="og:title" content="{esc(title)}">'
            f'<meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{canonical}">'
            f'<meta property="og:image" content="{og_image}"><meta property="og:site_name" content="MuscleGrid">'
            f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(title)}">'
            f'<meta name="twitter:image" content="{og_image}">'
            f'<link rel="icon" href="/shop/favicon.png">'
            f'<link rel="stylesheet" href="/shop/tokens.css"><link rel="stylesheet" href="/shop/theme.css">{MOBILE_CSS}'
            + "".join(f'<script type="application/ld+json">{j}</script>' for j in jsonld)
            + '<script src="/shop/store.js" defer></script></head>')


def bake(body, p, canonical):
    """Inject visible content into the empty PDP ids so crawlers see it without JS."""
    def put(b, _id, text):
        return re.sub(r'(id="' + _id + r'"[^>]*>)', lambda mm: mm.group(1) + esc(text), b, count=1)
    b = body
    b = put(b, "pTitle", p["title"])
    b = put(b, "pType", p.get("type") or "")
    b = put(b, "pDesc", (p.get("description") or "Premium MuscleGrid product."))
    b = put(b, "pPrice", "₹" + format(int(p["price"]), ",d"))
    img = BASE + p["image"] if (p.get("image") or "").startswith("/") else (p.get("image") or "")
    b = b.replace('id="mainImg" class="is-active" src=""', f'id="mainImg" class="is-active" src="{img}"')
    return b


def product_jsonld(p, canonical):
    imgs = [BASE + g if g.startswith("/") else g for g in (p.get("gallery") or [])][:6]
    prod = {"@context": "https://schema.org/", "@type": "Product", "name": p["title"],
            "image": imgs, "description": (p.get("description") or p["title"])[:400],
            "sku": p.get("sku") or "", "brand": {"@type": "Brand", "name": "MuscleGrid"},
            "offers": {"@type": "Offer", "url": canonical, "priceCurrency": "INR",
                       "price": str(int(p["price"])), "availability": "https://schema.org/InStock",
                       "itemCondition": "https://schema.org/NewCondition",
                       "seller": {"@type": "Organization", "name": "MuscleGrid"}}}
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/store/"},
        {"@type": "ListItem", "position": 2, "name": "Shop", "item": BASE + "/store/products/"},
        {"@type": "ListItem", "position": 3, "name": p["title"], "item": canonical}]}
    return [json.dumps(prod, separators=(",", ":")), json.dumps(crumb, separators=(",", ":"))]


def main():
    prods = [CARD(m) for m in db.master_skus.find(SHOPQ).sort("mrp", -1)]
    # 1) per-product SEO pages
    for p in prods:
        slug = p["slug"]
        canonical = f"{BASE}/store/p/{slug}/"
        ogimg = BASE + p["image"] if (p.get("image") or "").startswith("/") else (p.get("image") or "")
        desc = (re.sub(r"\s+", " ", p.get("description") or "").strip()
                or f"{p['title']} — buy online from MuscleGrid. Warranty-backed, free shipping, EMI available.")[:300]
        h = head(f"{p['title']} · MuscleGrid", desc, canonical, ogimg, product_jsonld(p, canonical))
        body = bake(PDP_BODY, p, canonical)
        page = (h + '<body class="template-product">' + body
                + f'<script>window.__MGPRODUCT={json.dumps(p, separators=(",", ":"))};</script>'
                + '<script src="/shop/product.js" defer></script></body></html>')
        d = ROOT / "p" / slug
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(page)
    # 2) legacy /store/product/ (fetches by ?id) using shared product.js
    legacy_head = (f'<!doctype html><html lang="en"><head><meta charset="utf-8">'
                   f'<meta name="viewport" content="width=device-width,initial-scale=1">'
                   f'<title>Product · MuscleGrid</title><meta name="robots" content="noindex">'
                   f'<link rel="icon" href="/shop/favicon.png">'
                   f'<link rel="stylesheet" href="/shop/tokens.css"><link rel="stylesheet" href="/shop/theme.css">{MOBILE_CSS}'
                   f'<script src="/shop/store.js" defer></script></head>')
    (ROOT / "product" / "index.html").write_text(
        legacy_head + '<body class="template-product">' + PDP_BODY
        + '<script src="/shop/product.js" defer></script></body></html>')
    # 3) sitemap + robots
    urls = [f"{BASE}/store/", f"{BASE}/store/products/", f"{BASE}/store/about/", f"{BASE}/store/contact/",
            f"{BASE}/store/dealers/", f"{BASE}/store/support/",
            f"{BASE}/store/policies/privacy/", f"{BASE}/store/policies/terms/",
            f"{BASE}/store/policies/refund/", f"{BASE}/store/policies/shipping/"]
    urls += [f"{BASE}/store/p/{p['slug']}/" for p in prods]
    sm = ('<?xml version="1.0" encoding="UTF-8"?>\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n")
    pub = ROOT.parent  # frontend/public
    (pub / "sitemap.xml").write_text(sm)
    (pub / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n")
    print(f"generated {len(prods)} product pages, sitemap ({len(urls)} urls), robots.txt; base={BASE}")


if __name__ == "__main__":
    main()

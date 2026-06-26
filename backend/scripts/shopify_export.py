"""Full, platform-agnostic export of a Shopify store via the Admin REST API.

Pulls EVERYTHING worth keeping for an off-Shopify migration and writes it as JSON (+ optional image
download) under backend/exports/shopify/. Safe + read-only on Shopify's side. Paginates with the
Link/page_info cursor so it captures full history, not just the first page.

Setup (one custom app in Shopify Admin → Apps → Develop apps → create app → Admin API access token,
with read scopes: products, orders, customers, content, discounts, and "read_themes" optional):
  add to backend/.env →
    SHOPIFY_STORE=yourstore.myshopify.com
    SHOPIFY_ADMIN_TOKEN=shpat_xxx
    SHOPIFY_API_VERSION=2024-10

Run:
  cd backend && venv/bin/python scripts/shopify_export.py            # data only
  cd backend && venv/bin/python scripts/shopify_export.py --images   # also download product images
"""
import os, sys, json, time, urllib.request, urllib.error, pathlib, re
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def _arg(flag):
    """Return the value following `flag` in argv (e.g. --store hk), or None."""
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1].strip()
    return None


# Multi-store: `--store hk` reads SHOPIFY_HK_* and writes to exports/shopify_hk/.
# No flag → the original single-store behaviour (SHOPIFY_* → exports/shopify/).
STORE_KEY = (_arg("--store") or "").strip().lower()
PREFIX = f"SHOPIFY_{STORE_KEY.upper()}_" if STORE_KEY else "SHOPIFY_"

STORE = os.environ.get(f"{PREFIX}STORE", "").strip().replace("https://", "").rstrip("/")
TOKEN = os.environ.get(f"{PREFIX}ADMIN_TOKEN", "").strip()
CLIENT_ID = os.environ.get(f"{PREFIX}CLIENT_ID", "").strip()
CLIENT_SECRET = os.environ.get(f"{PREFIX}CLIENT_SECRET", "").strip()
VER = os.environ.get(f"{PREFIX}API_VERSION", "2024-10").strip()


def _fetch_client_credentials_token():
    """New (2026) custom-app flow: exchange client_id + client_secret for an Admin API access token."""
    import urllib.parse
    url = f"https://{STORE}/admin/oauth/access_token"
    data = urllib.parse.urlencode({
        "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
        "grant_type": "client_credentials"}).encode()
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    body = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
    return body.get("access_token")
_OUT_DIR = "shopify_" + STORE_KEY if STORE_KEY else "shopify"
OUT = pathlib.Path(__file__).resolve().parent.parent / "exports" / _OUT_DIR
WANT_IMAGES = "--images" in sys.argv

# resource -> (endpoint, top-level json key). 250 = Shopify's max page size.
RESOURCES = [
    ("products", "products.json", "products"),
    ("custom_collections", "custom_collections.json", "custom_collections"),
    ("smart_collections", "smart_collections.json", "smart_collections"),
    ("customers", "customers.json", "customers"),
    ("orders", "orders.json?status=any", "orders"),
    ("draft_orders", "draft_orders.json", "draft_orders"),
    ("pages", "pages.json", "pages"),
    ("blogs", "blogs.json", "blogs"),
    ("price_rules", "price_rules.json", "price_rules"),
    ("redirects", "redirects.json", "redirects"),
    ("shipping_zones", "shipping_zones.json", "shipping_zones"),
]


def _req(url):
    req = urllib.request.Request(url, headers={
        "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json"})
    for attempt in range(5):
        try:
            r = urllib.request.urlopen(req, timeout=40)
            body = json.loads(r.read().decode("utf-8"))
            link = r.headers.get("Link", "")
            nxt = None
            m = re.search(r'<([^>]+)>;\s*rel="next"', link)
            if m:
                nxt = m.group(1)
            return body, nxt
        except urllib.error.HTTPError as e:
            if e.code == 429:                      # rate limited → back off
                time.sleep(2 * (attempt + 1)); continue
            raise
    raise RuntimeError(f"giving up on {url}")


def paginate(endpoint, key):
    base = f"https://{STORE}/admin/api/{VER}/"
    sep = "&" if "?" in endpoint else "?"
    url = base + endpoint + f"{sep}limit=250"
    rows = []
    while url:
        body, url = _req(url)
        rows.extend(body.get(key, []))
        time.sleep(0.4)                            # stay under 2 req/s
    return rows


def count(resource):
    ep = resource.split("?")[0].replace(".json", "")
    try:
        body, _ = _req(f"https://{STORE}/admin/api/{VER}/{ep}/count.json"
                       + ("?status=any" if "orders" in ep else ""))
        return body.get("count")
    except Exception:
        return "?"


def download_images(products):
    imgdir = OUT / "images"
    imgdir.mkdir(parents=True, exist_ok=True)
    n = 0
    for p in products:
        for img in p.get("images", []):
            src = img.get("src")
            if not src:
                continue
            fn = imgdir / f"{p['id']}_{img['id']}{pathlib.Path(src.split('?')[0]).suffix or '.jpg'}"
            if fn.exists():
                continue
            try:
                urllib.request.urlretrieve(src, fn); n += 1; time.sleep(0.1)
            except Exception as e:
                print(f"   img fail {src}: {e}")
    print(f"   downloaded {n} images")


def main():
    global TOKEN
    if STORE_KEY:
        print(f"• Store: {STORE_KEY}  (env {PREFIX}* → exports/{_OUT_DIR}/)\n")
    if not STORE:
        print(f"✗ Missing {PREFIX}STORE in backend/.env (e.g. yourstore.myshopify.com).")
        sys.exit(1)
    if not TOKEN:
        if CLIENT_ID and CLIENT_SECRET:
            print("• No SHOPIFY_ADMIN_TOKEN — exchanging client_id/secret via client-credentials grant…")
            TOKEN = _fetch_client_credentials_token()
            if not TOKEN:
                print("✗ client-credentials grant returned no token (check scopes / app install).")
                sys.exit(1)
            print("  ✓ got access token\n")
        else:
            print(f"✗ Need {PREFIX}ADMIN_TOKEN, or {PREFIX}CLIENT_ID + {PREFIX}CLIENT_SECRET, in backend/.env.")
            sys.exit(1)
    OUT.mkdir(parents=True, exist_ok=True)
    # sanity: shop.json
    shop, _ = _req(f"https://{STORE}/admin/api/{VER}/shop.json")
    s = shop["shop"]
    print(f"✓ Connected: {s.get('name')} ({s.get('myshopify_domain')}) plan={s.get('plan_name')} currency={s.get('currency')}\n")
    manifest = {"store": s.get("name"), "domain": s.get("myshopify_domain"),
                "exported_at": datetime.now(timezone.utc).isoformat(), "counts": {}}
    for name, endpoint, key in RESOURCES:
        try:
            rows = paginate(endpoint, key)
            (OUT / f"{name}.json").write_text(json.dumps(rows, indent=1, default=str))
            manifest["counts"][name] = len(rows)
            print(f"  {name:20} {len(rows):>6}  → exports/shopify/{name}.json")
            if name == "products" and WANT_IMAGES:
                download_images(rows)
        except Exception as e:
            print(f"  {name:20} ERROR: {e}")
            manifest["counts"][name] = f"error: {e}"
    (OUT / "_manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"\n✓ Done. Manifest → exports/shopify/_manifest.json")


if __name__ == "__main__":
    main()

"""Rehost Shopify product images off cdn.shopify.com onto our own VPS (public /uploads route).

The export already downloaded every image to exports/shopify/images/ named {product_id}_{image_id}.ext.
This copies them into uploads/shopify_products/ (served publicly by nginx at /uploads/shopify_products/)
and repoints each master_sku.image_url (+ a local gallery) to the local copy, so nothing breaks when
Shopify is cancelled. Idempotent. Mapping uses products.json so image[0] stays the main image.
"""
import os, json, shutil, pathlib
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "exports" / "shopify" / "images"
DST = ROOT / "uploads" / "shopify_products"
DST.mkdir(parents=True, exist_ok=True)
PUB = "/uploads/shopify_products"
NOW = datetime.now(timezone.utc).isoformat()

# index downloaded files by product_id (filename = {product_id}_{image_id}{ext})
local = {}
for f in SRC.glob("*"):
    if f.is_file():
        local.setdefault(f.name.split("_", 1)[0], []).append(f)

# product_id -> ordered image filenames (image[0] first), from products.json
prods = json.loads((ROOT / "exports" / "shopify" / "products.json").read_text())
order = {}
for p in prods:
    pid = str(p.get("id"))
    files = []
    for img in (p.get("images") or []):
        suf = pathlib.Path((img.get("src") or "").split("?")[0]).suffix or ".jpg"
        fn = f"{pid}_{img.get('id')}{suf}"
        if (SRC / fn).exists():
            files.append(fn)
    if files:
        order[pid] = files

copied = updated = 0
for f in SRC.glob("*"):                          # copy everything once (idempotent)
    d = DST / f.name
    if not d.exists():
        shutil.copy2(f, d); copied += 1

for m in db.master_skus.find({"shopify_product_id": {"$exists": True}}, {"id": 1, "shopify_product_id": 1}):
    pid = str(m["shopify_product_id"])
    files = order.get(pid) or [x.name for x in local.get(pid, [])]
    if not files:
        continue
    gallery = [f"{PUB}/{fn}" for fn in files]
    db.master_skus.update_one({"id": m["id"]}, {"$set": {
        "image_url": gallery[0], "image_gallery": gallery,
        "image_rehosted": True, "updated_at": NOW}})
    updated += 1

print(f"copied {copied} files into uploads/shopify_products/ ({len(list(DST.glob('*')))} total)")
print(f"repointed image_url on {updated} master_skus → {PUB}/...")

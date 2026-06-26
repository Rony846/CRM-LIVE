"""Phase 1 — import the exported Shopify store into the CRM (records only; Shopify keeps running).

Reads backend/exports/shopify/*.json and loads:
  • products  → master_skus   (dedup vs existing by sku_code / name; new ones tagged source=shopify)
  • customers → parties       (dedup by phone last-10 then email; new ones source=shopify)
  • orders    → shopify_orders (normalised via shopify_service; party-linked; items resolved to SKUs)

SAFE: idempotent (re-runnable) + reversible — everything created carries import_batch="shopify_phase1"
and source/ingest_source markers, so a rollback is a single delete by that tag. Never overwrites an
existing CRM record's own fields (only fills in shopify_* links + missing image).

  cd backend && venv/bin/python scripts/shopify_import_phase1.py --dry-run   # preview counts
  cd backend && venv/bin/python scripts/shopify_import_phase1.py             # write
  cd backend && venv/bin/python scripts/shopify_import_phase1.py --rollback  # undo this batch
"""
import os, sys, json, re, uuid, pathlib
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
from utils import shopify_service          # reuse the SAME normaliser the live webhook uses

def _arg(flag):
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1].strip()
    return None


# Multi-store: `--store hk` → batch shopify_hk_phase1, reads exports/shopify_hk/, tags store="hk".
# No flag → original India store: batch shopify_phase1, exports/shopify/, store="in".
STORE_KEY = (_arg("--store") or "").strip().lower()
STORE_TAG = STORE_KEY or "in"
BATCH = f"shopify_{STORE_KEY}_phase1" if STORE_KEY else "shopify_phase1"
ENV_PREFIX = f"SHOPIFY_{STORE_KEY.upper()}_" if STORE_KEY else "SHOPIFY_"
_IN_DIR = "shopify_" + STORE_KEY if STORE_KEY else "shopify"
P = pathlib.Path(__file__).resolve().parent.parent / "exports" / _IN_DIR
DRY = "--dry-run" in sys.argv
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
NOW = datetime.now(timezone.utc).isoformat()
# Named stores use only their own firm var (never inherit the India default).
FIRM_ID = (os.environ.get(f"{ENV_PREFIX}DEFAULT_FIRM_ID") or None) if STORE_KEY \
    else (os.environ.get("SHOPIFY_DEFAULT_FIRM_ID") or None)


def _phone10(s):
    d = re.sub(r"\D", "", str(s or ""))
    return d[-10:] if len(d) >= 10 else ""


def _html2text(h):
    t = re.sub(r"(?is)<(script|style).*?</\1>", " ", h or "")
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", t).strip()[:1000]


def _load(name):
    f = P / f"{name}.json"
    return json.loads(f.read_text()) if f.exists() else []


# ----------------------------------------------------------------- products
def import_products():
    prods = _load("products")
    existing = list(db.master_skus.find({}, {"id": 1, "sku_code": 1, "name": 1, "image_url": 1, "shopify_product_id": 1}))
    by_sku = {(m.get("sku_code") or "").strip().lower(): m for m in existing if m.get("sku_code")}
    by_name = {(m.get("name") or "").strip().lower(): m for m in existing}
    by_shop = {str(m.get("shopify_product_id")): m for m in existing if m.get("shopify_product_id")}
    stat = {"new": 0, "linked": 0, "skipped": 0}
    for p in prods:
        pid = str(p.get("id"))
        title = (p.get("title") or "").strip()
        v0 = (p.get("variants") or [{}])[0]
        sku = (v0.get("sku") or "").strip()
        img = (p.get("images") or [{}])[0].get("src")
        # match: shopify_product_id → sku_code → exact name → name-prefix
        match = by_shop.get(pid) or (by_sku.get(sku.lower()) if sku else None) or by_name.get(title.lower())
        if not match:
            tl = title.lower()
            for nm, m in by_name.items():
                if nm and (tl.startswith(nm[:40]) or nm.startswith(tl[:40])):
                    match = m; break
        if match:
            upd = {}
            if not match.get("shopify_product_id"):
                upd["shopify_product_id"] = pid
            if img and not match.get("image_url"):
                upd["image_url"] = img
            if upd and not DRY:
                upd["updated_at"] = NOW
                db.master_skus.update_one({"id": match["id"]}, {"$set": upd})
            stat["linked"] += 1
            continue
        # create new SKU from the Shopify product (so the storefront has it)
        doc = {
            "id": str(uuid.uuid4()),
            "name": title,
            "sku_code": sku or f"SHOP-{pid}",
            "category": p.get("product_type") or None,
            "description": _html2text(p.get("body_html")),
            "selling_price": float(v0.get("price") or 0) or None,
            "mrp": float(v0.get("compare_at_price") or 0) or None,
            "gst_rate": 18, "unit": "PCS", "is_manufactured": False,
            "product_type": "traded",
            "weight_kg": float(v0.get("weight") or 0) or None,
            "image_url": img,
            # Foreign-currency stores: keep their products OFF the India storefront (recorded only).
            "is_active": (p.get("status") == "active") if not STORE_KEY else False,
            "source": "shopify", "import_batch": BATCH, "store": STORE_TAG,
            "shopify_product_id": pid, "shopify_handle": p.get("handle"),
            "shopify_variants": [{"sku": v.get("sku"), "title": v.get("title"),
                                  "price": v.get("price"), "compare_at_price": v.get("compare_at_price")}
                                 for v in (p.get("variants") or [])],
            "shopify_images": [im.get("src") for im in (p.get("images") or [])],
            "created_at": NOW, "updated_at": NOW,
        }
        if not DRY:
            db.master_skus.insert_one(doc)
        by_name[title.lower()] = doc          # so later items can match it
        stat["new"] += 1
    return stat


# ----------------------------------------------------------------- customers
def import_customers():
    custs = _load("customers")
    parties = list(db.parties.find({}, {"id": 1, "phone": 1, "email": 1, "shopify_customer_id": 1}))
    by_phone = {_phone10(p.get("phone")): p["id"] for p in parties if _phone10(p.get("phone"))}
    by_email = {(p.get("email") or "").strip().lower(): p["id"] for p in parties if p.get("email")}
    seen_shop = {str(p.get("shopify_customer_id")) for p in parties if p.get("shopify_customer_id")}
    stat = {"new": 0, "matched": 0}
    fresh = []
    for c in custs:
        cid = str(c.get("id"))
        if cid in seen_shop:
            stat["matched"] += 1; continue
        ph = _phone10(c.get("phone"))
        em = (c.get("email") or "").strip().lower()
        if (ph and ph in by_phone) or (em and em in by_email):
            stat["matched"] += 1
            continue
        name = " ".join(x for x in [c.get("first_name"), c.get("last_name")] if x).strip()
        addr = (c.get("addresses") or [{}])[0] if c.get("addresses") else {}
        doc = {
            "id": str(uuid.uuid4()),
            "name": name or em or ph or "Shopify Customer",
            "phone": ph or None, "email": (c.get("email") or None),
            "city": addr.get("city"), "state": addr.get("province"),
            "address": addr.get("address1"), "pincode": addr.get("zip"),
            "party_type": "customer", "party_types": ["customer"],
            "source": "shopify", "import_batch": BATCH, "store": STORE_TAG, "shopify_customer_id": cid,
            "shopify_orders_count": c.get("orders_count"), "shopify_total_spent": c.get("total_spent"),
            "is_active": True, "created_at": NOW, "updated_at": NOW,
        }
        fresh.append(doc)
        if ph:
            by_phone[ph] = doc["id"]
        if em:
            by_email[em] = doc["id"]
        stat["new"] += 1
    if fresh and not DRY:
        for i in range(0, len(fresh), 1000):
            db.parties.insert_many(fresh[i:i + 1000])
    return stat


# ----------------------------------------------------------------- orders
def _resolve_party(norm):
    ph = _phone10(norm.get("phone"))
    if ph:
        p = db.parties.find_one({"phone": {"$regex": ph + "$"}}, {"id": 1})
        if p:
            return p["id"]
    em = (norm.get("email") or "").strip()
    if em:
        p = db.parties.find_one({"email": {"$regex": f"^{re.escape(em)}$", "$options": "i"}}, {"id": 1})
        if p:
            return p["id"]
    return None


def import_orders():
    orders = _load("orders")
    sku_names = list(db.master_skus.find({}, {"sku_code": 1, "name": 1}))
    stat = {"upserted": 0, "items_resolved": 0, "items_total": 0}
    for o in orders:
        norm = shopify_service.normalize_order(o)
        if not norm.get("shopify_order_id"):
            continue
        norm["price_tax_inclusive"] = True
        for li in norm.get("line_items", []) or []:
            stat["items_total"] += 1
            t = (li.get("title") or "").lower()
            hit = None
            for m in sku_names:
                nm = (m.get("name") or "").lower()
                if nm and (t.startswith(nm[:40]) or nm[:40] in t):
                    hit = m; break
            if hit:
                li["resolved_sku"] = hit.get("sku_code"); li["resolved_name"] = hit.get("name")
                stat["items_resolved"] += 1
        party_id = _resolve_party(norm)
        doc = {**norm, "party_id": party_id, "ingest_source": "phase1_import",
               "import_batch": BATCH, "store": STORE_TAG, "firm_id": FIRM_ID,
               "updated_at": NOW, "raw": o}
        if not DRY:
            db.shopify_orders.update_one(
                {"shopify_order_id": norm["shopify_order_id"]},
                {"$set": doc, "$setOnInsert": {"id": str(uuid.uuid4()), "crm_status": "ingested", "created_at": NOW}},
                upsert=True)
        stat["upserted"] += 1
    return stat


def rollback():
    r1 = db.master_skus.delete_many({"import_batch": BATCH})
    r2 = db.parties.delete_many({"import_batch": BATCH})
    r3 = db.shopify_orders.delete_many({"import_batch": BATCH})
    # Only the default (India) store unsets links added onto pre-existing records — doing this for a
    # named store would clobber another store's links (they share the master_skus collection).
    if not STORE_KEY:
        db.master_skus.update_many({"shopify_product_id": {"$exists": True}, "import_batch": {"$ne": BATCH}},
                                   {"$unset": {"shopify_product_id": ""}})
    print(f"rollback[{STORE_TAG}]: removed {r1.deleted_count} SKUs, {r2.deleted_count} parties, {r3.deleted_count} orders")


def main():
    if "--rollback" in sys.argv:
        rollback(); return
    print(f"{'DRY-RUN — no writes' if DRY else 'WRITING'} · store={STORE_TAG} · batch={BATCH} · src=exports/{_IN_DIR}/ · firm={FIRM_ID or '(unassigned)'}\n")
    if not P.exists():
        print(f"✗ Export folder not found: {P}\n  Run: venv/bin/python scripts/shopify_export.py{f' --store {STORE_KEY}' if STORE_KEY else ''} --images")
        return
    ps = import_products();  print(f"products  → {ps}")
    cs = import_customers(); print(f"customers → {cs}")
    os_ = import_orders();   print(f"orders    → {os_}")
    print(f"\n{'(dry run — nothing written)' if DRY else '✓ imported. Rollback anytime: scripts/shopify_import_phase1.py --rollback'}")


if __name__ == "__main__":
    main()

"""De-duplicate the 52 Shopify-imported master_skus against the existing CRM catalogue.

Most Shopify products are the SAME item as an existing CRM SKU under a marketing name. This matches
them by a product SIGNATURE (class + capacity tokens: kW / kVA / V / Ah / type) and proposes merges.

Merge = keep the EXISTING CRM SKU as the canonical one, move the Shopify storefront data (image,
variants, shopify_product_id/handle) onto it, then mark the duplicate inactive with merged_into
(reversible — nothing deleted). Junk (Test Product / Shipping Protection) is deactivated.

  --dry-run   show the proposed mapping, write nothing   (default is dry)
  --apply     apply merges + deactivate junk
  --undo      reverse: reactivate merged dups, clear merged_into
"""
import os, sys, re, json
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
NOW = datetime.now(timezone.utc).isoformat()
APPLY = "--apply" in sys.argv
UNDO = "--undo" in sys.argv

JUNK = re.compile(r"\b(test product|shipping protection|atlas)\b", re.I)


def cls_of(n):
    has_ah = re.search(r"\d+\s*ah", n) is not None
    has_kw = "kw" in n.replace("kwh", "")          # "6.2kw"/"6.2KW"; exclude battery "15kWh"
    if "combo" in n:                               # only an explicit combo, not "inverter…batteryless"
        return "combo"
    if "ac set" in n or "air cond" in n or (re.search(r"\bton\b", n) and "inverter ac" in n):
        return "acunit"
    if "stabilizer" in n or "servo" in n:
        return "stabilizer"
    if ("lifepo4" in n or "lithium" in n or has_ah or " cell" in n) and "inverter" not in n:
        return "battery"                           # a battery/cell, not an inverter+battery combo
    if "inverter" in n or "pcu" in n or "mppt" in n or has_kw:
        return "inverter"
    if has_ah or "lifepo4" in n:
        return "battery"
    return "accessory"


def tok(n):
    kw = re.search(r"(\d+(?:\.\d+)?)\s*k\s*w", n)
    kva = re.search(r"(\d+(?:\.\d+)?)\s*kva", n)
    ah = re.search(r"(\d+)\s*ah", n)
    sysv = re.search(r"\b(51\.2|48|25\.6|25|24|12)\s*v", n)
    lead = re.search(r"\b(50|70|90|100|130|150|170)\s*v", n)   # stabilizer input-range start
    return {
        "kw": kw.group(1) if kw else None,
        "kva": kva.group(1) if kva else None,
        "ah": ah.group(1) if ah else None,
        "sysv": sysv.group(1) if sysv else None,
        "lead": lead.group(1) if lead else None,
        "ac": bool(re.search(r"\bac\b|air cool|for .*ton", n)),
        "ml": "mainline" in n or re.search(r"\bml\b", n) is not None,
        "servo": "servo" in n,
    }


SERIES = ["titan", "focus", "solar star", "solarstar", "gootu", "misterwatt", "thunder",
          "sensation", "legend", "legendary", "pro+", "sci-bot", "offgrid", "off-grid", "off grid",
          "servo", "daly", "jk bms", "tangent", "spgs", "ip65", "temp cont", "1100va", "1.2kva"]


def series_of(n):
    return set(s for s in SERIES if s in n)


def feat(name):
    """Structured features of a product name for candidate matching."""
    n = (name or "").lower()
    t = tok(n)
    return {"name": n, "cls": cls_of(n), "kw": t["kw"], "kva": t["kva"], "ah": t["ah"],
            "sysv": t["sysv"], "lead": t["lead"], "ac": t["ac"], "ml": t["ml"], "servo": t["servo"],
            "series": series_of(n)}


def stab_type(f):
    return "servo" if f["servo"] else ("ac" if f["ac"] and not f["ml"] else "ml")


def candidates(sp, pool):
    """Existing SKUs that plausibly match Shopify item sp, narrowed by primary capacity + series."""
    c = sp["cls"]
    if c == "battery" and sp["ah"]:
        cand = [e for e in pool if e["cls"] == "battery" and e["ah"] == sp["ah"]]
        if sp["sysv"]:
            sv = [e for e in cand if e["sysv"] == sp["sysv"]]
            cand = sv or cand
    elif c == "inverter" and sp["kw"]:
        cand = [e for e in pool if e["cls"] == "inverter" and e["kw"] == sp["kw"]]
    elif c == "stabilizer" and sp["kva"]:
        cand = [e for e in pool if e["cls"] == "stabilizer" and e["kva"] == sp["kva"]
                and stab_type(e) == stab_type(sp)]
        if sp["lead"]:
            lv = [e for e in cand if e["lead"] == sp["lead"]]
            cand = lv or cand
    else:
        return []
    if len(cand) > 1 and sp["series"]:                 # narrow by model/series keyword
        nar = [e for e in cand if e["series"] & sp["series"]]
        if nar:
            cand = nar
    if len(cand) > 1 and c == "inverter" and sp["sysv"]:
        nar = [e for e in cand if e["sysv"] == sp["sysv"]]
        if nar:
            cand = nar
    return cand


def undo():
    dups = list(db.master_skus.find({"merged_into": {"$exists": True}}))
    for d in dups:
        db.master_skus.update_one({"id": d["id"]},
            {"$set": {"is_active": True}, "$unset": {"merged_into": "", "merged_at": ""}})
    print(f"undo: reactivated {len(dups)} merged SKUs")


def main():
    if UNDO:
        undo(); return
    existing = list(db.master_skus.find(
        {"import_batch": {"$ne": "shopify_phase1"}, "is_active": {"$ne": False}},
        {"id": 1, "name": 1, "sku_code": 1, "selling_price": 1, "image_url": 1, "shopify_product_id": 1}))
    pool = [{**feat(m.get("name")), "id": m["id"], "sku_code": m.get("sku_code"),
             "image_url": m.get("image_url"), "shopify_product_id": m.get("shopify_product_id"),
             "_name": m.get("name")} for m in existing]

    shop = list(db.master_skus.find({"import_batch": "shopify_phase1", "merged_into": {"$exists": False}}))
    merges, news, junk, ambig = [], [], [], []
    for sp in shop:
        nm = sp.get("name") or ""
        if JUNK.search(nm) or (sp.get("selling_price") or 0) < 10:
            junk.append(sp); continue
        cands = candidates(feat(nm), pool)
        if len(cands) == 1:
            merges.append((sp, cands[0]))
        elif len(cands) > 1:
            ambig.append((sp, cands))
        else:
            news.append(sp)

    print(f"{'APPLYING' if APPLY else 'DRY-RUN'} — {len(merges)} merge, {len(news)} keep-new, "
          f"{len(ambig)} ambiguous, {len(junk)} junk\n")
    print("== MERGE (Shopify dup → existing canonical) ==")
    for sp, ex in merges:
        print(f"  ✓ {sp['name'][:46]:46} → [{(ex.get('sku_code') or '')[:13]:13}] {ex['_name'][:40]}")
    if ambig:
        print("\n== AMBIGUOUS (multiple matches — left as-is, review) ==")
        for sp, cs in ambig:
            print(f"  ? {sp['name'][:44]:44} → {[c.get('sku_code') for c in cs]}")
    print("\n== KEEP AS NEW (no CRM equivalent) ==")
    for sp in news:
        print(f"  + {sp['name'][:60]}")
    print("\n== JUNK (deactivate) ==")
    for sp in junk:
        print(f"  ✗ {sp['name'][:50]}  ₹{sp.get('selling_price')}")

    if APPLY:
        for sp, ex in merges:
            upd = {}
            if sp.get("image_url") and not ex.get("image_url"):
                upd["image_url"] = sp["image_url"]
            if not ex.get("shopify_product_id"):
                upd["shopify_product_id"] = sp.get("shopify_product_id")
                upd["shopify_handle"] = sp.get("shopify_handle")
                upd["shopify_variants"] = sp.get("shopify_variants")
                upd["shopify_images"] = sp.get("shopify_images")
            if upd:
                upd["updated_at"] = NOW
                db.master_skus.update_one({"id": ex["id"]}, {"$set": upd})
            db.master_skus.update_one({"id": sp["id"]},
                {"$set": {"is_active": False, "merged_into": ex["id"],
                          "merged_into_sku": ex.get("sku_code"), "merged_at": NOW}})
        for sp in junk:
            db.master_skus.update_one({"id": sp["id"]},
                {"$set": {"is_active": False, "category": "non-product", "updated_at": NOW}})
        print(f"\n✓ merged {len(merges)}, deactivated {len(junk)} junk. Undo: --undo")
    else:
        print("\n(dry run — nothing changed. Re-run with --apply)")


if __name__ == "__main__":
    main()

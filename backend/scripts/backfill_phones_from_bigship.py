#!/usr/bin/env python3
"""Backfill real customer phone numbers onto orders from Bigship courier_shipments (the only place
Amazon's masked numbers are replaced by the real delivery phone). Matches by Amazon order-id first,
then exact order_id / invoice_number. Only fills orders that are MISSING a valid phone — never
overwrites an existing good number. Writes provenance (phone_source=bigship, phone_backfilled_at).

Usage: backfill_phones_from_bigship.py            # dry-run report
       backfill_phones_from_bigship.py --commit   # write the phones
"""
import sys, re
from datetime import datetime, timezone
from pymongo import MongoClient, UpdateOne
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
COMMIT = "--commit" in sys.argv
NOW = datetime.now(timezone.utc).isoformat()
AMZ = re.compile(r"\d{3}-\d{7}-\d{7}")


def norm(p):
    d = re.sub(r"\D", "", str(p or ""))[-10:]
    return d if (len(d) == 10 and d[0] in "6789" and d != "9560377363" and len(set(d)) > 2) else ""


# ---- build phone lookups from Bigship shipments ----
by_amz, by_key = {}, {}
for r in db.courier_shipments.find({}, {"order_id": 1, "invoice_number": 1, "amazon_order_id": 1, "phone": 1}):
    ph = norm(r.get("phone"))
    if not ph:
        continue
    for key in (r.get("order_id"), r.get("amazon_order_id"), r.get("invoice_number")):
        if not key:
            continue
        ks = str(key).strip()
        m = AMZ.search(ks)
        if m:
            by_amz.setdefault(m.group(0), ph)
        by_key.setdefault(ks, ph)
print(f"Bigship phone lookup: {len(by_amz)} Amazon-id keys, {len(by_key)} order/invoice keys")


def find_phone(order, key_fields):
    for kf in key_fields:
        ks = str(order.get(kf) or "").strip()
        if not ks:
            continue
        m = AMZ.search(ks)
        if m and m.group(0) in by_amz:
            return by_amz[m.group(0)], "amazon_id"
        if ks in by_key:
            return by_key[ks], "exact_key"
    return None, None


def backfill(coll, key_fields, phone_fields):
    total = matched = already = 0
    ops = []
    for o in db[coll].find({}, {**{k: 1 for k in key_fields}, **{p: 1 for p in phone_fields}}):
        total += 1
        if any(norm(o.get(p)) for p in phone_fields):
            already += 1
            continue
        ph, via = find_phone(o, key_fields)
        if ph:
            matched += 1
            ops.append(UpdateOne({"_id": o["_id"]}, {"$set": {
                "phone": ph, "phone_source": "bigship", "phone_match": via, "phone_backfilled_at": NOW}}))
    if COMMIT and ops:
        for i in range(0, len(ops), 1000):
            db[coll].bulk_write(ops[i:i + 1000], ordered=False)
    print(f"\n{coll}: {total} total | {already} already had phone | "
          f"{matched} {'FILLED' if COMMIT else 'fillable'} from Bigship")
    return matched


m1 = backfill("amazon_orders", ["amazon_order_id", "order_id", "id"], ["phone", "phone_manual"])
m2 = backfill("sales_orders", ["amazon_order_id", "order_number", "order_id", "invoice_number"],
              ["phone", "customer_phone"])
print(f"\n{'COMMITTED' if COMMIT else 'DRY-RUN'} — total phones {'filled' if COMMIT else 'fillable'}: {m1 + m2}")
if not COMMIT:
    print("Re-run with --commit to write.")

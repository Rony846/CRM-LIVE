#!/usr/bin/env python3
"""Backfill customer NAME + ADDRESS (and phone) onto orders from Bigship courier_shipments.
Bigship holds the real delivery details that Amazon masks. Matches by Amazon order-id first, then
exact order_id/invoice. Fills each field ONLY when the order is missing it — never overwrites
existing data. Idempotent + re-runnable; writes provenance (*_source=bigship).

Usage: backfill_orders_from_bigship.py            # dry-run
       backfill_orders_from_bigship.py --commit
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


def nph(p):
    d = re.sub(r"\D", "", str(p or ""))[-10:]
    return d if (len(d) == 10 and d[0] in "6789" and d != "9560377363" and len(set(d)) > 2) else ""


def has(v):
    return bool(str(v or "").strip())


# ---- Bigship lookups: key -> {name, address, city, state, pincode, phone} ----
by_amz, by_key = {}, {}
for r in db.courier_shipments.find({}, {"order_id": 1, "invoice_number": 1, "amazon_order_id": 1,
                                        "phone": 1, "customer_name": 1, "address": 1,
                                        "consignee_city": 1, "consignee_state": 1, "consignee_pincode": 1, "pincode": 1}):
    rec = {"name": (r.get("customer_name") or "").strip(), "address": (r.get("address") or "").strip(),
           "city": (r.get("consignee_city") or "").strip(), "state": (r.get("consignee_state") or "").strip(),
           "pincode": str(r.get("consignee_pincode") or r.get("pincode") or "").strip(), "phone": nph(r.get("phone"))}
    if not (rec["name"] or rec["address"] or rec["phone"]):
        continue
    for key in (r.get("order_id"), r.get("amazon_order_id"), r.get("invoice_number")):
        if not key:
            continue
        ks = str(key).strip()
        m = AMZ.search(ks)
        if m:
            by_amz.setdefault(m.group(0), rec)
        by_key.setdefault(ks, rec)
print(f"Bigship lookup: {len(by_amz)} Amazon-id keys, {len(by_key)} order/invoice keys")


def match(order, key_fields):
    for kf in key_fields:
        ks = str(order.get(kf) or "").strip()
        if not ks:
            continue
        m = AMZ.search(ks)
        if m and m.group(0) in by_amz:
            return by_amz[m.group(0)]
        if ks in by_key:
            return by_key[ks]
    return None


def run(coll, key_fields, plan):
    """plan: list of (order_present_fields[list], bigship_attr, write_field)."""
    counts = {wf: 0 for _, _, wf in plan}
    ops = []
    for o in db[coll].find({}):
        rec = match(o, key_fields)
        if not rec:
            continue
        sets = {}
        for present_fields, attr, wf in plan:
            if any(has(o.get(f)) for f in present_fields):
                continue
            val = rec.get(attr)
            if has(val):
                sets[wf] = val
                counts[wf] += 1
        if sets:
            sets["bigship_backfilled_at"] = NOW
            ops.append(UpdateOne({"_id": o["_id"]}, {"$set": sets}))
    if COMMIT and ops:
        for i in range(0, len(ops), 1000):
            db[coll].bulk_write(ops[i:i + 1000], ordered=False)
    print(f"\n{coll}: {len(ops)} orders {'updated' if COMMIT else 'to update'}")
    for wf, n in counts.items():
        print(f"    {wf:14} {'filled' if COMMIT else 'fillable'}: {n}")
    return len(ops)


# amazon_orders: name -> buyer_name, address -> address_line1, + city/state/postal_code, + phone
run("amazon_orders", ["amazon_order_id", "order_id", "id"], [
    (["phone", "phone_manual"], "phone", "phone"),
    (["buyer_name", "customer_name_manual"], "name", "buyer_name"),
    (["address_line1", "address_manual"], "address", "address_line1"),
    (["city", "city_manual"], "city", "city"),
    (["state", "state_manual"], "state", "state"),
    (["postal_code", "pincode_manual"], "pincode", "postal_code"),
])

# sales_orders: name -> customer_name, address -> address, + city/state/pincode, + phone
run("sales_orders", ["amazon_order_id", "order_number", "order_id", "invoice_number"], [
    (["phone", "customer_phone"], "phone", "phone"),
    (["customer_name", "name"], "name", "customer_name"),
    (["address", "address_line1"], "address", "address"),
    (["city"], "city", "city"),
    (["state"], "state", "state"),
    (["pincode"], "pincode", "pincode"),
])

print(f"\n{'COMMITTED' if COMMIT else 'DRY-RUN — re-run with --commit'}")

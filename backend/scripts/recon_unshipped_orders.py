#!/usr/bin/env python3
"""Reconcile orders against Bigship shipments → flag orders that should have shipped but have
NO shipment booked at all (a true backlog, distinct from booked-but-stuck which the pickup chase
handles). Writes a snapshot to db.unshipped_recon, stamps each order (unshipped_flagged_at),
clears the flag when resolved, and reports a separate "data gap" count (marked-shipped-but-unlinked).

Scope (deliberately tight to avoid false alarms):
  • amazon_orders: fulfillment MFN, status Unshipped/Pending, NOT cancelled, no shipment, no tracking.
  • sales_orders:  status == pending_fulfillment, no shipment, no tracking.
The 'data gap' (orders marked Shipped on Amazon but with no linked Bigship shipment) is reported
for visibility but NOT chased — it's a matching/off-platform issue, not an operational backlog.

Usage: recon_unshipped_orders.py [--commit]   (dry-run prints; --commit writes snapshot + flags)
"""
import sys, re
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
COMMIT = "--commit" in sys.argv
NOW = datetime.now(timezone.utc)
AMZ = re.compile(r"\d{3}-\d{7}-\d{7}")
CANCEL = {"cancelled", "canceled"}
UNSHIPPED = {"unshipped", "pending", "partiallyshipped"}
SHIPPED_CRM = {"dispatched", "amazon_shipped", "tracking_added"}


def has(v):
    return bool(str(v or "").strip())


def age_days(ts):
    try:
        d = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return (NOW - d).days
    except Exception:
        return None


# Bigship shipment keys (order_id / amazon-id / invoice)
keys = set()
for r in db.courier_shipments.find({}, {"order_id": 1, "amazon_order_id": 1, "invoice_number": 1}):
    for k in (r.get("order_id"), r.get("amazon_order_id"), r.get("invoice_number")):
        if k:
            ks = str(k).strip()
            keys.add(ks)
            m = AMZ.search(ks)
            if m:
                keys.add(m.group(0))


def linked(*vals, tracking=None):
    if has(tracking):
        return True
    for v in vals:
        ks = str(v or "").strip()
        if not ks:
            continue
        if ks in keys:
            return True
        m = AMZ.search(ks)
        if m and m.group(0) in keys:
            return True
    return False


backlog, data_gap = [], 0

# ---- amazon_orders ----
for o in db.amazon_orders.find({}, {"amazon_order_id": 1, "fulfillment_channel": 1, "order_status": 1,
                                    "amazon_status": 1, "crm_status": 1, "tracking_number": 1,
                                    "dispatched_at": 1, "purchase_date": 1, "buyer_name": 1,
                                    "customer_name_manual": 1, "phone": 1, "phone_manual": 1, "firm_name": 1}):
    if str(o.get("fulfillment_channel") or "").upper() == "AFN":
        continue
    osl = str(o.get("order_status") or "").lower()
    asl = str(o.get("amazon_status") or "").lower()
    crm = str(o.get("crm_status") or "").lower()
    if osl in CANCEL or asl in CANCEL or crm == "cancelled":
        continue
    is_shipped = linked(o.get("amazon_order_id"), tracking=o.get("tracking_number")) \
        or crm in SHIPPED_CRM or has(o.get("dispatched_at"))
    if is_shipped:
        continue
    # Amazon itself marks it Shipped (seller marked it) but we have no linked shipment → data gap, NOT backlog
    if osl == "shipped" or asl == "shipped":
        data_gap += 1
        continue
    if (osl in UNSHIPPED) or (asl in UNSHIPPED) or (crm in ("pending", "details_captured")):
        backlog.append({
            "table": "amazon_orders", "order_id": o.get("amazon_order_id"),
            "customer": o.get("buyer_name") or o.get("customer_name_manual") or "",
            "phone": o.get("phone") or o.get("phone_manual") or "",
            "firm": o.get("firm_name") or "", "status": o.get("amazon_status") or o.get("order_status"),
            "age_days": age_days(o.get("purchase_date")), "purchase_date": str(o.get("purchase_date") or "")[:10]})

# ---- sales_orders (only explicit pending_fulfillment) ----
for s in db.sales_orders.find({"status": "pending_fulfillment"},
                              {"order_number": 1, "amazon_order_id": 1, "invoice_number": 1,
                               "tracking_number": 1, "customer_name": 1, "phone": 1, "created_at": 1}):
    if linked(s.get("order_number"), s.get("amazon_order_id"), s.get("invoice_number"), tracking=s.get("tracking_number")):
        continue
    backlog.append({
        "table": "sales_orders", "order_id": s.get("order_number"),
        "customer": s.get("customer_name") or "", "phone": s.get("phone") or "",
        "firm": "", "status": "pending_fulfillment",
        "age_days": age_days(s.get("created_at")), "purchase_date": str(s.get("created_at") or "")[:10]})

backlog.sort(key=lambda x: -(x["age_days"] or 0))
aged = [b for b in backlog if (b["age_days"] or 0) >= 3]

print(f"REAL un-shipped backlog (no shipment booked): {len(backlog)}  | aged ≥3d: {len(aged)}")
print(f"DATA GAP (marked shipped on Amazon, no linked shipment — not chased): {data_gap}")
print("\nOldest 12:")
for b in backlog[:12]:
    print(f"  {b['order_id']:22} {b['age_days']}d  {b['status']:10} {b['customer'][:22]:22} {b['firm']}")

if COMMIT:
    db.unshipped_recon.update_one({"key": "latest"}, {"$set": {
        "key": "latest", "run_at": NOW.isoformat(), "backlog_count": len(backlog),
        "aged_count": len(aged), "data_gap": data_gap, "items": backlog[:500]}}, upsert=True)
    # stamp current backlog; clear stale flags
    cur_ids = {b["order_id"] for b in backlog}
    for b in backlog:
        coll = b["table"]
        idf = "amazon_order_id" if coll == "amazon_orders" else "order_number"
        db[coll].update_one({idf: b["order_id"]},
                            {"$set": {"unshipped_flagged_at": NOW.isoformat(), "unshipped_flagged": True}})
    for coll, idf in (("amazon_orders", "amazon_order_id"), ("sales_orders", "order_number")):
        for o in db[coll].find({"unshipped_flagged": True}, {idf: 1}):
            if o.get(idf) not in cur_ids:
                db[coll].update_one({"_id": o["_id"]}, {"$set": {"unshipped_flagged": False},
                                                        "$unset": {"unshipped_flagged_at": ""}})
    print(f"\nCOMMITTED — snapshot db.unshipped_recon (latest) + {len(backlog)} orders flagged.")
else:
    print("\nDRY-RUN — re-run with --commit to write snapshot + flags.")

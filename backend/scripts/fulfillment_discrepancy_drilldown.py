#!/usr/bin/env python3
"""Drill-down on the 'amazon_shipped_no_record' discrepancies (Amazon says Shipped but we hold no
tracking/dispatch/Bigship record). Exports a CSV, stores the list in db.fulfillment_discrepancies,
prints breakdowns that explain WHY (Easy Ship vs genuine gap), and WhatsApps the CSV to the founder.

Usage: fulfillment_discrepancy_drilldown.py [--no-wa]
"""
import sys, csv, io, json, base64, urllib.request
from datetime import datetime, timezone
from collections import Counter
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
NOW = datetime.now(timezone.utc)
IST = timezone.utc
NO_WA = "--no-wa" in sys.argv
FOUNDER = "919560377363@c.us"
BRIDGE = "http://127.0.0.1:3011/send"
OUT = f"/var/www/crm/backend/exports/fulfillment_discrepancies_{NOW:%Y%m%d}.csv"


def age_days(ts):
    try:
        d = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return (NOW - d).days
    except Exception:
        return ""


def sku_of(o):
    items = o.get("items") or []
    if isinstance(items, list) and items:
        it = items[0]
        return str(it.get("seller_sku") or it.get("sku") or it.get("SellerSKU") or it.get("ASIN") or "")[:30]
    return ""


rows = []
for o in db.amazon_orders.find({"fulfillment_truth": "amazon_shipped_no_record"}):
    rows.append({
        "amazon_order_id": o.get("amazon_order_id"),
        "firm": o.get("firm_name") or "",
        "customer": o.get("buyer_name") or o.get("customer_name_manual") or "",
        "phone": o.get("phone") or o.get("phone_manual") or "",
        "purchase_date": str(o.get("purchase_date") or "")[:10],
        "age_days": age_days(o.get("purchase_date")),
        "order_total": (o.get("order_total") or {}).get("Amount") if isinstance(o.get("order_total"), dict) else o.get("order_total"),
        "amazon_status": o.get("amazon_status") or o.get("order_status"),
        "crm_status": o.get("crm_status") or "",
        "easy_ship_status": o.get("easy_ship_status") or "",
        "fulfillment_channel": o.get("fulfillment_channel") or "",
        "tracking_number": o.get("tracking_number") or "",
        "sku": sku_of(o),
    })
rows.sort(key=lambda r: (r["firm"], -(r["age_days"] if isinstance(r["age_days"], int) else 0)))

# ---- CSV ----
import os
os.makedirs("/var/www/crm/backend/exports", exist_ok=True)
cols = ["amazon_order_id", "firm", "customer", "phone", "purchase_date", "age_days", "order_total",
        "amazon_status", "crm_status", "easy_ship_status", "fulfillment_channel", "tracking_number", "sku"]
buf = io.StringIO()
w = csv.DictWriter(buf, fieldnames=cols)
w.writeheader()
for r in rows:
    w.writerow(r)
csv_text = buf.getvalue()
with open(OUT, "w") as f:
    f.write(csv_text)

# ---- store in DB (queryable / UI-ready) ----
db.fulfillment_discrepancies.delete_many({})
if rows:
    db.fulfillment_discrepancies.insert_many([{**r, "snapshot_at": NOW.isoformat()} for r in rows])

# ---- breakdowns (WHY) ----
by_firm = Counter(r["firm"] or "(no firm)" for r in rows)
by_easy = Counter(str(r["easy_ship_status"] or "(none)") for r in rows)
by_crm = Counter(str(r["crm_status"] or "(none)") for r in rows)
by_chan = Counter(str(r["fulfillment_channel"] or "(none)") for r in rows)

print(f"=== {len(rows)} 'shipped but no record' orders → {OUT} ===")
print("\nBy firm:        ", dict(by_firm.most_common()))
print("By Easy-Ship:   ", dict(by_easy.most_common()))
print("By crm_status:  ", dict(by_crm.most_common()))
print("By fulfilment:  ", dict(by_chan.most_common()))
print("\nOldest 15:")
for r in rows[:15]:
    print(f"  {r['amazon_order_id']:22} {str(r['age_days']):>3}d {r['firm'][:20]:20} {str(r['easy_ship_status'])[:14]:14} {r['customer'][:18]}")

# ---- WhatsApp the CSV to founder ----
if not NO_WA and rows:
    caption = (f"📋 Amazon 'shipped but NO record' drill-down — *{len(rows)}* orders\n"
               f"By firm: " + ", ".join(f"{k}:{v}" for k, v in by_firm.most_common(5)) +
               f"\nBy Easy-Ship status: " + ", ".join(f"{k}:{v}" for k, v in by_easy.most_common(4)))
    payload = {"to": FOUNDER, "message": caption,
               "media": {"mimetype": "text/csv", "data": base64.b64encode(csv_text.encode()).decode(),
                         "filename": f"amazon_no_record_{NOW:%Y%m%d}.csv"}}
    try:
        r = urllib.request.urlopen(urllib.request.Request(
            BRIDGE, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}), timeout=40)
        print("\nWhatsApp CSV ->", r.status, r.read()[:100])
    except Exception as e:
        print("\nWhatsApp send error:", e)

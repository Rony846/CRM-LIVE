#!/usr/bin/env python3
"""Refund-leak audit: cross-check every refund against the real shipment outcome, classify each,
flag OUR controllable mistakes, and export a full CSV (+ optional WhatsApp to founder).

Categories per refunded order:
  RECALL_NOW      refunded but parcel still not-picked / in-transit -> can still cancel (preventable)
  LOSS_DELIVERED  refunded AND delivered, product NOT returned     -> money lost (customer kept both)
  OK_RETURNED     refunded AND RTO/returned                        -> product back, correct
  OK_CANCELLED    refunded AND shipment cancelled                  -> nothing sent, correct
  NO_RECORD       refunded, no courier record                      -> FBA / cancelled-pre-ship, review

our_mistake flag:
  Yes/RECALL   – about to double-pay; cancel now
  Yes/SHIPPED_AFTER_REFUND – shipment booked AFTER the refund date (clearest ops error)
  Yes/DELIVERED_NOT_RECOVERED – delivered + refunded + not returned, not contested/recovered
  No           – correct outcome (returned / cancelled)
  Review       – no record

Usage: refund_leak_report.py [--since 2026-06-01] [--wa]
"""
import sys, re, csv, io, os, json, base64, urllib.request
from datetime import datetime, timezone
from collections import Counter, defaultdict
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
NOW = datetime.now(timezone.utc)
SINCE = (sys.argv[sys.argv.index("--since") + 1] if "--since" in sys.argv else "2026-06-01")
WA = "--wa" in sys.argv
FOUNDER = "919560377363@c.us"
BRIDGE = "http://127.0.0.1:3011/send"
AMZ = re.compile(r"\d{3}-\d{7}-\d{7}")


def cstat(s):
    s = str(s or "")
    if re.search(r"rto|returned to|returning", s, re.I): return "rto"
    if re.search(r"delivered", s, re.I): return "delivered"
    if re.search(r"cancel", s, re.I): return "cancelled"
    if re.search(r"transit|out for|picked|dispatch|manifest", s, re.I): return "in_transit"
    if re.search(r"not picked|pickup sched|pending|booked", s, re.I): return "not_picked"
    return "other"


RANK = {"delivered": 5, "in_transit": 4, "not_picked": 3, "rto": 2, "cancelled": 1, "other": 0}

ship = defaultdict(list)
for r in db.courier_shipments.find({}, {"amazon_order_id": 1, "order_id": 1, "awb_number": 1, "status": 1,
        "created_at": 1, "courier_name": 1, "bigship_order_id": 1, "bigship_panel_order_id": 1,
        "source": 1, "customer_name": 1, "consignee_city": 1}):
    for k in (r.get("amazon_order_id"), r.get("order_id")):
        m = AMZ.search(str(k or ""))
        if m:
            ship[m.group(0)].append(r)

rows = []
for r in db.amazon_refunds.find({}):
    rdate = str(r.get("refund_date") or "")[:10]
    if rdate < SINCE:
        continue
    oid = r.get("amazon_order_id")
    amt = float(r.get("refund_amount") or 0)
    pr = str(r.get("product_returned"))
    ao = db.amazon_orders.find_one({"amazon_order_id": oid}, {"firm_name": 1, "easy_ship_status": 1}) or {}
    ess = str(ao.get("easy_ship_status") or "")
    ss = ship.get(oid, [])
    best = max(ss, key=lambda x: RANK[cstat(x.get("status"))]) if ss else None
    st = cstat(best.get("status")) if best else "no_record"
    booked = str((best or {}).get("created_at") or "")[:10]
    shipped_after = bool(booked and rdate and booked > rdate and st in ("delivered", "in_transit", "not_picked"))

    # No Bigship/Delhivery record? It's likely an Amazon Easy-Ship order (Amazon's own logistics).
    # Use easy_ship_status as the real outcome so these aren't all dumped into "no record".
    if st == "no_record" and ess:
        if re.search(r"returnedtoseller|returningtoseller|rejected", ess, re.I):
            st = "rto"
        elif re.search(r"delivered|pickedup|outfordelivery", ess, re.I):
            st = "delivered"
        if st != "no_record":
            best = {"status": f"EasyShip:{ess}", "source": "amazon_easy_ship"}

    if st == "rto":
        cat, mistake = "OK_RETURNED", "No"
    elif st == "cancelled":
        cat, mistake = "OK_CANCELLED", "No"
    elif st == "delivered":
        if pr == "True":
            cat, mistake = "OK_RETURNED", "No"
        else:
            cat = "LOSS_DELIVERED"
            mistake = "Yes/SHIPPED_AFTER_REFUND" if shipped_after else "Yes/DELIVERED_NOT_RECOVERED"
    elif st in ("not_picked", "in_transit"):
        cat = "RECALL_NOW"
        mistake = "Yes/SHIPPED_AFTER_REFUND" if shipped_after else "Yes/RECALL"
    else:
        cat, mistake = "NO_RECORD", "Review"

    rows.append({
        "amazon_order_id": oid, "firm": ao.get("firm_name") or r.get("firm_id") or "",
        "refund_amount": round(amt, 2), "refund_date": rdate, "product_returned": pr,
        "shipment_status": (best or {}).get("status") if best else "(no courier record)",
        "ship_outcome": st, "booked_date": booked,
        "awb": (best or {}).get("awb_number") if best else "",
        "bigship_order_id": (best or {}).get("bigship_order_id") or (best or {}).get("bigship_panel_order_id") if best else "",
        "created_source": (best or {}).get("source") if best else "",
        "customer": (best or {}).get("customer_name") if best else "",
        "city": (best or {}).get("consignee_city") if best else "",
        "category": cat, "our_mistake": mistake,
    })

order = {"RECALL_NOW": 0, "LOSS_DELIVERED": 1, "NO_RECORD": 2, "OK_RETURNED": 3, "OK_CANCELLED": 4}
rows.sort(key=lambda x: (order.get(x["category"], 9), -x["refund_amount"]))

cols = ["amazon_order_id", "firm", "refund_amount", "refund_date", "product_returned", "shipment_status",
        "ship_outcome", "booked_date", "awb", "bigship_order_id", "created_source", "customer", "city",
        "category", "our_mistake"]
buf = io.StringIO(); w = csv.DictWriter(buf, fieldnames=cols); w.writeheader()
for r in rows:
    w.writerow(r)
os.makedirs("/var/www/crm/backend/exports", exist_ok=True)
out = f"/var/www/crm/backend/exports/refund_leak_full_report_{NOW:%Y%m%d}.csv"
open(out, "w").write(buf.getvalue())

cat_n = Counter(r["category"] for r in rows)
cat_v = Counter(); mis_n = Counter(); mis_v = Counter()
for r in rows:
    cat_v[r["category"]] += r["refund_amount"]
    mis_n[r["our_mistake"]] += 1; mis_v[r["our_mistake"]] += r["refund_amount"]
firm_loss = Counter()
for r in rows:
    if r["category"] in ("LOSS_DELIVERED", "RECALL_NOW"):
        firm_loss[r["firm"]] += r["refund_amount"]

print(f"=== REFUND-LEAK REPORT  (refunds since {SINCE}: {len(rows)}, Rs {sum(r['refund_amount'] for r in rows):,.0f}) ===")
print(f"CSV -> {out}\n")
print("BY CATEGORY:")
for c in ["RECALL_NOW", "LOSS_DELIVERED", "NO_RECORD", "OK_RETURNED", "OK_CANCELLED"]:
    print(f"  {c:16} n={cat_n[c]:4}  Rs {cat_v[c]:>12,.0f}")
print("\nOUR MISTAKES:")
for m in ["Yes/RECALL", "Yes/SHIPPED_AFTER_REFUND", "Yes/DELIVERED_NOT_RECOVERED", "Review", "No"]:
    print(f"  {m:28} n={mis_n[m]:4}  Rs {mis_v[m]:>12,.0f}")
print("\nLOSS+RECALL BY FIRM:")
for f, v in firm_loss.most_common():
    print(f"  {str(f)[:30]:30} Rs {v:>12,.0f}")

if WA:
    preventable = mis_v["Yes/RECALL"] + mis_v["Yes/SHIPPED_AFTER_REFUND"]
    cap = (f"\U0001f4cb Refund-leak report — refunds since {SINCE}: *{len(rows)}* (₹{sum(r['refund_amount'] for r in rows):,.0f})\n"
           f"\U0001f534 RECALL now (refunded, not shipped): {cat_n['RECALL_NOW']} · ₹{cat_v['RECALL_NOW']:,.0f}\n"
           f"\U0001f7e0 LOSS delivered+refunded (not returned): {cat_n['LOSS_DELIVERED']} · ₹{cat_v['LOSS_DELIVERED']:,.0f}\n"
           f"✅ Returned/RTO (correct): {cat_n['OK_RETURNED']} · ₹{cat_v['OK_RETURNED']:,.0f}\n"
           f"❔ No courier record (review): {cat_n['NO_RECORD']} · ₹{cat_v['NO_RECORD']:,.0f}")
    payload = {"to": FOUNDER, "message": cap,
               "media": {"mimetype": "text/csv", "data": base64.b64encode(buf.getvalue().encode()).decode(),
                         "filename": f"refund_leak_full_report_{NOW:%Y%m%d}.csv"}}
    try:
        resp = urllib.request.urlopen(urllib.request.Request(BRIDGE, data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"}), timeout=40)
        print("\nWhatsApp ->", resp.status)
    except Exception as e:
        print("\nWhatsApp error:", e)

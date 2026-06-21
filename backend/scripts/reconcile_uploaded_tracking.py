#!/usr/bin/env python3
"""For each Amazon order in an uploaded transactions/refund CSV, resolve the REAL shipment:
  1. direct match on the Amazon order id in courier_shipments
  2. order-id VARIANT (operator added a leading/trailing '-' or '.' when re-booking in Bigship)
  3. PHONE fallback: take the phone from any Bigship record for the order (or amazon_orders) and
     find another parcel shipped to the same phone (different order id / tracking)
  4. Amazon Easy-Ship status (Amazon-fulfilled, no Bigship record)
Then classify Delivered / RTO / In-transit / Booked-not-picked / Never-shipped and write the
tracking id next to every order. Usage: reconcile_uploaded_tracking.py <input.csv> <out.csv>
"""
import sys, re, csv
from collections import defaultdict
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
INP, OUT = sys.argv[1], sys.argv[2]
AMZ = re.compile(r"\d{3}-\d{7}-\d{7}")


def ph10(p):
    d = re.sub(r"\D", "", str(p or ""))[-10:]
    return d if len(d) == 10 and d[0] in "6789" else ""


def cstat(s):
    s = str(s or "")
    if re.search(r"rto|returned to|returning", s, re.I):
        return "rto"                       # back to origin (we got it / getting it back)
    if re.search(r"undeliver", s, re.I):
        return "in_transit"                # NOTE: 'Undelivered' contains 'delivered' — must precede it
    if re.search(r"delivered", s, re.I):
        return "delivered"                 # customer received
    if re.search(r"cancel", s, re.I):
        return "cancelled"
    if re.search(r"not picked|pickup scheduled|manifest|stale", s, re.I):
        return "not_picked"
    if re.search(r"transit|out for delivery|dispatched|picked up|N1|S1|Central|E$", s, re.I):
        return "in_transit"
    return "other"


RANK = {"delivered": 6, "rto": 5, "in_transit": 4, "not_picked": 3, "cancelled": 2, "other": 1, "none": 0}

# ---- index courier_shipments ----
by_oid, by_phone = defaultdict(list), defaultdict(list)
for r in db.courier_shipments.find({}, {"order_id": 1, "amazon_order_id": 1, "awb_number": 1, "status": 1,
        "courier_name": 1, "phone": 1, "customer_name": 1, "created_at": 1}):
    rawoid = str(r.get("order_id") or r.get("amazon_order_id") or "")
    m = AMZ.search(rawoid)
    rec = {"awb": r.get("awb_number"), "status": r.get("status") or "", "courier": r.get("courier_name") or "",
           "phone": ph10(r.get("phone")), "rawoid": rawoid.strip(), "cust": r.get("customer_name") or ""}
    if m:
        by_oid[m.group(0)].append(rec)
    if rec["phone"]:
        by_phone[rec["phone"]].append(rec)


def best(recs):
    return max(recs, key=lambda x: RANK[cstat(x["status"])]) if recs else None


# ---- read input, resolve each order ----
rows = list(csv.DictReader(open(INP, encoding="utf-8-sig", errors="replace")))
seen, results = {}, []
for r in rows:
    oid = (r.get("Order ID") or "").strip()
    if not AMZ.fullmatch(oid) or oid in seen:
        continue
    seen[oid] = True
    ships = by_oid.get(oid, [])
    b = best(ships)
    via = "" if not b else ("direct" if any(s["rawoid"] == oid for s in ships) else "variant")

    # phone fallback when the order itself has no real (non-cancelled) shipment
    if not b or cstat(b["status"]) == "cancelled":
        phone = (b or {}).get("phone") or next((s["phone"] for s in ships if s["phone"]), "")
        if not phone:
            ao = db.amazon_orders.find_one({"amazon_order_id": oid}, {"phone": 1, "phone_manual": 1, "buyer_phone": 1})
            phone = ph10((ao or {}).get("phone") or (ao or {}).get("phone_manual") or (ao or {}).get("buyer_phone"))
        if phone:
            others = [s for s in by_phone.get(phone, []) if oid not in s["rawoid"] and cstat(s["status"]) != "cancelled"]
            pb = best(others)
            if pb and RANK[cstat(pb["status"])] > RANK[cstat((b or {}).get("status"))]:
                b, via = pb, "phone"

    ao = db.amazon_orders.find_one({"amazon_order_id": oid},
                                   {"tracking_number": 1, "easy_ship_status": 1, "firm_name": 1}) or {}
    amz_track = ao.get("tracking_number") or ""
    ess = str(ao.get("easy_ship_status") or "")

    if b:
        st = cstat(b["status"])
        bucket = {"delivered": "Delivered", "rto": "RTO", "in_transit": "In transit / undelivered",
                  "not_picked": "Booked – not picked", "cancelled": "Never shipped (cancelled)",
                  "other": "Unknown"}[st]
        awb, courier, bstat = b["awb"], b["courier"], b["status"]
    elif re.search(r"returnedtoseller|returningtoseller|rejected", ess, re.I):
        bucket, awb, courier, bstat, via = "RTO", "(Amazon Easy-Ship)", "Amazon", f"EasyShip:{ess}", "easy_ship"
    elif re.search(r"delivered|pickedup|outfordelivery", ess, re.I):
        bucket, awb, courier, bstat, via = "Delivered", "(Amazon Easy-Ship)", "Amazon", f"EasyShip:{ess}", "easy_ship"
    else:
        bucket, awb, courier, bstat, via = "Never shipped", "", "", "(no record)", "none"

    results.append({
        "Order ID": oid, "Firm": ao.get("firm_name") or "", "Product": (r.get("Product Details") or "")[:40],
        "Refund Total (INR)": r.get("Total (INR)") or "",
        "Tracking / AWB": awb or "", "Courier": courier, "Bigship Status": bstat,
        "Status": bucket, "Matched via": via,
        "Amazon Tracking": amz_track, "Tracking differs": "Y" if (awb and amz_track and AMZ.sub("", str(awb)) and str(awb) not in str(amz_track) and str(amz_track) not in str(awb)) else "",
    })

# ---- write output ----
cols = ["Order ID", "Firm", "Product", "Refund Total (INR)", "Tracking / AWB", "Courier",
        "Bigship Status", "Status", "Matched via", "Amazon Tracking", "Tracking differs"]
with open(OUT, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    for r in results:
        w.writerow(r)

# ---- summary ----
from collections import Counter
bk = Counter(r["Status"] for r in results)
via = Counter(r["Matched via"] for r in results)
print(f"=== {len(results)} unique orders resolved -> {OUT} ===")
for k in ["Delivered", "RTO", "In transit / undelivered", "Booked – not picked",
          "Never shipped (cancelled)", "Never shipped", "Unknown"]:
    if bk.get(k):
        print(f"  {k:32} {bk[k]}")
print("\nHEADLINE:")
print(f"  Delivered (customer has it): {bk.get('Delivered', 0)}")
print(f"  RTO (came back to us):       {bk.get('RTO', 0)}")
never = bk.get("Never shipped", 0) + bk.get("Never shipped (cancelled)", 0)
print(f"  Never shipped:               {never}")
print(f"  Still out (transit/not-picked): {bk.get('In transit / undelivered',0) + bk.get('Booked – not picked',0)}")
print("\nMatched via:", dict(via))
print("Tracking differs from Amazon:", sum(1 for r in results if r["Tracking differs"] == "Y"))

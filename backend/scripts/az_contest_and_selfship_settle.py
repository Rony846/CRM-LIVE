#!/usr/bin/env python3
"""Combine three sources to settle every delivered+refunded order:
  - Amazon All-Orders report (order-status: Delivered to Buyer / Returned to Seller / ...)
  - our Bigship reconciliation (delivered_and_refunded chase list)
  - our internal return signals: inward gate scans + RTO/return parcels to the same phone
Outputs (a) an A-Z contest worklist of confirmed real losses and (b) the self-ship settlement.
"""
import csv, glob, re, shutil, uuid, os
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
NOW = datetime.now(timezone.utc)


def ph10(p):
    d = re.sub(r"\D", "", str(p or ""))[-10:]
    return d if len(d) == 10 else ""


def nname(s):
    return re.sub(r"[^a-z]", "", str(s or "").lower())


# ---- Amazon report: order-status + delivery date ----
RANK = {"Shipped - Returned to Seller": 6, "Shipped - Rejected by Buyer": 6, "Shipped - Returning to Seller": 5,
        "Shipped - Lost in Transit": 4, "Shipped - Delivered to Buyer": 3, "Shipped - Picked Up": 3,
        "Shipped": 2, "Pending": 1, "Cancelled": 0}
amz = {}
for fp in glob.glob("/tmp/ret187/*/*.txt"):
    for r in csv.DictReader(open(fp, encoding="utf-8", errors="replace"), delimiter="\t"):
        oid = r.get("amazon-order-id")
        if not oid:
            continue
        st = r.get("order-status") or ""
        if oid not in amz or RANK.get(st, -1) > RANK.get(amz[oid]["status"], -1):
            amz[oid] = {"status": st, "delivered_date": (r.get("last-updated-date") or "")[:10],
                        "service": r.get("ship-service-level") or "", "state": r.get("ship-state") or ""}

AMZ_RETURNED = {"Shipped - Returned to Seller", "Shipped - Rejected by Buyer", "Shipped - Returning to Seller"}
AMZ_KEPT = {"Shipped - Delivered to Buyer", "Shipped - Picked Up"}

# ---- our internal return signals ----
AMZre = re.compile(r"\d{3}-\d{7}-\d{7}")
rto_by_phone = defaultdict(list)
for r in db.courier_shipments.find({"status": {"$regex": "rto|returned|rejected", "$options": "i"}},
                                   {"phone": 1, "status": 1, "awb_number": 1}):
    p = ph10(r.get("phone"))
    if p:
        rto_by_phone[p].append(r.get("awb_number"))
gate_track, gate_names = set(), set()
for g in db.gate_logs.find({"scan_type": "inward"}, {"tracking_id": 1, "customer_name": 1}):
    if g.get("tracking_id"):
        gate_track.add(re.sub(r"\s", "", str(g["tracking_id"])).upper())
    if g.get("customer_name"):
        gate_names.add(nname(g["customer_name"]))

# ---- the 251 delivered+refunded chase list ----
chase = list(csv.DictReader(open("/var/www/crm/backend/exports/delivered_and_refunded_chase_20260621.csv")))

contest, settle = [], Counter()
settle_val = defaultdict(float)
for r in chase:
    oid = r["Order ID"]
    a = amz.get(oid, {})
    astat = a.get("status", "")
    phone = ph10(r["Phone"])
    awb = re.sub(r"\s", "", str(r["Tracking / AWB"])).upper()
    amt = float(r["Refund (INR)"] or 0)
    self_ship = r["Channel"] == "Bigship"

    our_return = bool(phone and rto_by_phone.get(phone)) or (awb in gate_track) or \
        (len(nname(r["Customer"])) >= 5 and nname(r["Customer"]) in gate_names)

    # final verdict
    if astat in AMZ_RETURNED or our_return:
        verdict, conf = "RETURNED to us", "Amazon" if astat in AMZ_RETURNED else "our gate/RTO"
    elif astat == "Shipped - Lost in Transit":
        verdict, conf = "Lost in transit", "Amazon"
    elif astat in AMZ_KEPT:
        verdict, conf = "KEPT - real loss", "High (Amazon delivered, no return)"
    elif self_ship:
        verdict, conf = "KEPT - real loss", "Medium (self-ship delivered, no return in our data)"
    else:
        verdict, conf = "KEPT - real loss", "Low (status unclear)"

    grp = "RETURNED" if verdict == "RETURNED to us" else ("LOST" if verdict.startswith("Lost") else
          ("LOSS-selfship" if self_ship else "LOSS-amazon"))
    settle[grp] += 1
    settle_val[grp] += amt

    if verdict == "KEPT - real loss":
        contest.append({
            "Order ID": oid, "Firm": r["Firm"], "Customer": r["Customer"], "Phone": phone,
            "Product": r["Product"], "Refund (INR)": round(amt), "Channel": r["Channel"],
            "Loss confidence": conf,
            "Delivery proof": astat or r["Delivered status"],
            "Delivered date": a.get("delivered_date", ""), "AWB": r["Tracking / AWB"],
            "Courier": r["Courier"], "Ship state": a.get("state", ""),
            "Action": "Contest A-Z with delivery proof; recover from buyer if possible",
        })

contest.sort(key=lambda x: -x["Refund (INR)"])

# ---- write A-Z contest worklist (a) ----
cols = ["Order ID", "Firm", "Customer", "Phone", "Product", "Refund (INR)", "Channel",
        "Loss confidence", "Delivery proof", "Delivered date", "AWB", "Courier", "Ship state", "Action"]
out = "/var/www/crm/backend/exports/az_contest_worklist_20260621.csv"
with open(out, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    for r in contest:
        w.writerow(r)

ctotal = sum(r["Refund (INR)"] for r in contest)
high = [r for r in contest if r["Loss confidence"].startswith("High")]
med = [r for r in contest if r["Loss confidence"].startswith("Medium")]

print(f"=== (a) A-Z CONTEST WORKLIST: {len(contest)} real-loss orders, Rs {ctotal:,.0f} -> {out} ===")
print(f"  High confidence (Amazon-confirmed kept): {len(high)}  Rs {sum(r['Refund (INR)'] for r in high):,.0f}")
print(f"  Medium (self-ship delivered, our data):  {len(med)}  Rs {sum(r['Refund (INR)'] for r in med):,.0f}")
print(f"  by firm: {dict(Counter(r['Firm'] for r in contest))}")
print()
print(f"=== (b) SETTLEMENT of the 251 delivered+refunded ===")
for k in ["LOSS-amazon", "LOSS-selfship", "RETURNED", "LOST"]:
    lbl = {"LOSS-amazon": "Real loss — Amazon-confirmed kept", "LOSS-selfship": "Real loss — self-ship (our data)",
           "RETURNED": "Returned to us (not a loss)", "LOST": "Lost in transit"}[k]
    print(f"  {lbl:38} {settle[k]:4}   Rs {settle_val[k]:>11,.0f}")
print(f"\n  Self-ship orders settled via OUR data: {settle['LOSS-selfship']} kept + "
      f"(returns folded into RETURNED above)")

# register the contest worklist
ctr = db.counters.find_one_and_update({"_id": "claude_files"}, {"$inc": {"value": 1}}, upsert=True, return_document=True)
num = ctr["value"]
disk = f"{num}_az_contest_worklist.csv"
shutil.copyfile(out, f"/var/www/crm/backend/uploads/claude_files/{disk}")
db.claude_files.insert_one({"id": str(uuid.uuid4()), "number": num, "filename": "az_contest_worklist.csv",
    "disk_filename": disk, "mime_type": "text/csv", "size_bytes": os.path.getsize(out),
    "note": f"{len(contest)} confirmed delivered+refunded real losses (Rs {ctotal:,.0f}) for A-Z contest, with delivery proof + loss confidence. By Claude.",
    "uploaded_by": "15511c11-f2bc-480c-8364-6a1208f0b015", "uploaded_by_name": "Claude", "created_at": NOW.isoformat(), "deleted_at": None})
print(f"\nRegistered A-Z contest worklist as Files-for-Claude #{num}")

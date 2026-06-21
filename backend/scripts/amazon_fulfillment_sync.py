#!/usr/bin/env python3
"""Hourly Amazon fulfillment-truth sync. Three stages:
  1. SP-API incremental pull (last 2 days) per firm  -> refreshes amazon_orders + Amazon's claimed status.
  2. Link each order to its Bigship AWB via the panel-scraped courier_shipments (Bigship has NO
     order-id lookup API, so the scrape's order_id->AWB map is the only bridge).
  3. Resolve the REAL status from Bigship's AWB tracking and write the truth back onto each order:
        actually_shipped, bigship_awb, bigship_courier, bigship_status, fulfillment_truth, fulfillment_checked_at

  fulfillment_truth values:
    shipped               – has AWB and Bigship shows movement (in-transit/delivered/picked/rto)
    booked_not_picked     – has AWB but courier hasn't collected (NOT PICKED / PICKUP SCHEDULED / manifested)
    amazon_shipped_no_bigship – Amazon says Shipped but there is NO Bigship shipment (discrepancy)
    unshipped             – Unshipped/Pending and no Bigship shipment (true backlog)

Snapshot in db.amazon_fulfillment_truth (key=latest). Cron: hourly.
Usage: amazon_fulfillment_sync.py [--reconcile-only]   (skip the SP-API pull, just re-link+writeback)
"""
import sys, re
from datetime import datetime, timezone, timedelta
import jwt, httpx
from pymongo import MongoClient, UpdateOne
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
NOW = datetime.now(timezone.utc)
BASE = "http://127.0.0.1:8001"
ADMIN_ID = "15511c11-f2bc-480c-8364-6a1208f0b015"   # founder@ (admin)
AMZ = re.compile(r"\d{3}-\d{7}-\d{7}")
RECON_ONLY = "--reconcile-only" in sys.argv
CANCEL = {"cancelled", "canceled"}
# Bigship statuses that mean it physically moved
MOVED = re.compile(r"transit|delivered|out for delivery|picked|rto|dispatched|shipped|manifest", re.I)
NOT_MOVED = re.compile(r"not picked|pickup scheduled|pending|booked", re.I)


def has(v):
    return bool(str(v or "").strip())


def admin_token():
    return jwt.encode({"user_id": ADMIN_ID, "role": "admin",
                       "exp": NOW + timedelta(hours=2)}, ENV["JWT_SECRET"], algorithm="HS256")


# ---------- Stage 1: SP-API incremental pull ----------
spapi = {}
if not RECON_ONLY:
    H = {"Authorization": f"Bearer {admin_token()}", "Content-Type": "application/json"}
    firms = [c["firm_id"] for c in db.marketplace_credentials.find(
        {"platform": "amazon", "is_active": True}, {"firm_id": 1})]
    for fid in firms:
        try:
            r = httpx.post(f"{BASE}/api/amazon/fetch-orders/{fid}",
                           params={"days_back": 2,
                                   "order_status": "Unshipped,PartiallyShipped,Pending,Shipped"},
                           headers=H, timeout=240)
            spapi[fid] = f"{r.status_code} {str(r.json())[:120] if r.headers.get('content-type','').startswith('application/json') else ''}"
        except Exception as e:
            spapi[fid] = f"ERROR {e}"
        print(f"  SP-API pull firm {fid[:8]}: {spapi[fid][:90]}")

# ---------- Stage 2: Bigship status maps (by AWB, and order_id->all-shipments) ----------
CANCELLED = re.compile(r"cancel", re.I)


def nawb(a):
    return re.sub(r"\s", "", str(a or "")).upper()


def ship_rank(rec):
    """How trustworthy a Bigship shipment is as proof of fulfilment.
    An order rebooked after a cancellation has BOTH a cancelled and a live AWB; always prefer the live one."""
    s = str(rec.get("status") or "")
    if CANCELLED.search(s):
        return 0                                            # cancelled -> useless as proof
    if MOVED.search(s) and not NOT_MOVED.search(s):
        return 3                                            # physically moved
    return 2                                                # booked, awaiting pickup


status_by_awb, ships_by_orderid = {}, {}
for r in db.courier_shipments.find({}, {"order_id": 1, "amazon_order_id": 1, "awb_number": 1,
                                        "status": 1, "courier_name": 1, "last_tracked": 1}):
    awb = r.get("awb_number")
    if not has(awb):
        continue
    rec = {"awb": awb, "status": r.get("status") or "", "courier": r.get("courier_name") or "",
           "last_tracked": r.get("last_tracked")}
    status_by_awb[nawb(awb)] = rec
    for k in (r.get("order_id"), r.get("amazon_order_id")):
        m = AMZ.search(str(k or ""))
        if m:
            ships_by_orderid.setdefault(m.group(0), []).append(rec)

SHIP_CRM = {"dispatched", "amazon_shipped", "tracking_added"}

# ---------- Stage 3: reconcile + writeback ----------
from collections import Counter
truth = Counter()
ops = []
EASY_SHIPPED = {"pickedup", "delivered", "outfordelivery", "returningtoseller",
                "returnedtoseller", "rejectedbybuyer", "deliveryattempted"}
for o in db.amazon_orders.find({}, {"amazon_order_id": 1, "order_status": 1, "amazon_status": 1,
                                    "crm_status": 1, "tracking_number": 1, "dispatched_at": 1,
                                    "easy_ship_status": 1}):
    osl = str(o.get("order_status") or "").lower()
    asl = str(o.get("amazon_status") or "").lower()
    crm = str(o.get("crm_status") or "").lower()
    if osl in CANCEL or asl in CANCEL or crm == "cancelled":
        continue
    aid = str(o.get("amazon_order_id") or "")
    m = AMZ.search(aid)
    tn = o.get("tracking_number")
    # Gather every Bigship shipment we can tie to this order (own tracking number + order-id map),
    # then keep the most trustworthy one — a rebooked order's live AWB must win over its cancelled AWB.
    cands = []
    if has(tn) and status_by_awb.get(nawb(tn)):
        cands.append(status_by_awb[nawb(tn)])
    if m:
        cands += ships_by_orderid.get(m.group(0), [])
    bs = max(cands, key=ship_rank) if cands else None
    bs_rank = ship_rank(bs) if bs else -1
    # A cancelled-only Bigship record is no proof of shipping; the order's own tracking still might be.
    awb = (bs["awb"] if (bs and bs_rank > 0) else (tn if has(tn) else None))
    crm_marker = crm in SHIP_CRM or has(o.get("dispatched_at"))
    easy_shipped = str(o.get("easy_ship_status") or "").lower() in EASY_SHIPPED
    amazon_says_shipped = (osl == "shipped" or asl == "shipped")

    sets = {"fulfillment_checked_at": NOW.isoformat(), "bigship_awb": awb,
            "bigship_status": (bs["status"] if bs else None),
            "bigship_courier": (bs["courier"] if bs else None)}
    if bs_rank == 3:
        cat = "shipped"                      # Bigship confirms movement
    elif bs_rank == 2:
        cat = "booked_not_picked"            # live Bigship AWB exists but not collected yet
    elif crm_marker or easy_shipped:
        cat = "shipped"                      # independent proof: dispatched in CRM / Amazon Easy Ship
    elif bs_rank == 0:
        # only a CANCELLED Bigship shipment and no other proof -> genuine discrepancy / true backlog
        cat = "amazon_shipped_no_record" if amazon_says_shipped else "unshipped"
    elif has(awb):
        cat = "shipped"                      # order carries its own tracking, no Bigship record at all
    elif amazon_says_shipped:
        cat = "amazon_shipped_no_record"     # Amazon says shipped but NO proof anywhere — real discrepancy
    else:
        cat = "unshipped"
    sets["actually_shipped"] = cat in ("shipped",)
    sets["fulfillment_truth"] = cat
    truth[cat] += 1
    ops.append(UpdateOne({"amazon_order_id": aid}, {"$set": sets}))

for i in range(0, len(ops), 1000):
    db.amazon_orders.bulk_write(ops[i:i + 1000], ordered=False)

db.amazon_fulfillment_truth.update_one({"key": "latest"}, {"$set": {
    "key": "latest", "run_at": NOW.isoformat(), "spapi": spapi, "counts": dict(truth),
    "bigship_awbs": len(status_by_awb), "orders_checked": len(ops)}}, upsert=True)

print(f"\n=== AMAZON FULFILLMENT TRUTH ({len(ops)} active orders, {len(status_by_awb)} Bigship AWBs) ===")
for k in ("shipped", "booked_not_picked", "amazon_shipped_no_record", "unshipped"):
    print(f"  {k:26} {truth.get(k, 0)}")
print(f"\n⚠ REAL DISCREPANCY (Amazon says shipped, NO record anywhere): {truth.get('amazon_shipped_no_record', 0)}")
print(f"⚠ Booked but courier hasn't picked up: {truth.get('booked_not_picked', 0)}")
print(f"⚠ Genuinely un-shipped (backlog): {truth.get('unshipped', 0)}")

#!/usr/bin/env python3
"""Triage the 'amazon_shipped_no_record' discrepancies: cross-check each against Bigship
courier_shipments by PHONE and NAME (with pincode/date corroboration to avoid repeat-buyer false
matches) to separate 'likely shipped, just unlinked' from 'truly no record (chase these)'.

Tiers:
  HIGH   – phone match + (pincode match OR shipment within ±10d of order)  → almost certainly shipped
  MEDIUM – phone match only (no corroboration)                            → probably shipped
  NAME   – no phone match, but name + pincode match                       → possible
  NONE   – no match anywhere                                              → truly no record, CHASE

--link writes the matched AWB/status onto HIGH (and optionally MEDIUM) orders to resolve them.
Usage: triage_discrepancies.py [--link] [--no-wa]
"""
import sys, re, csv, io, json, base64, os, urllib.request
from datetime import datetime, timezone
from collections import Counter, defaultdict
from pymongo import MongoClient, UpdateOne
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
NOW = datetime.now(timezone.utc)
LINK = "--link" in sys.argv
NO_WA = "--no-wa" in sys.argv
FOUNDER = "919560377363@c.us"
BRIDGE = "http://127.0.0.1:3011/send"


def nph(p):
    d = re.sub(r"\D", "", str(p or ""))[-10:]
    return d if (len(d) == 10 and d[0] in "6789" and len(set(d)) > 2) else ""


def nname(s):
    s = re.sub(r"\bcustomer\b", "", str(s or ""), flags=re.I)   # Amazon masks some names as "X Customer"
    return re.sub(r"[^a-z]", "", s.lower())


def npin(p):
    d = re.sub(r"\D", "", str(p or ""))
    return d if len(d) == 6 else ""


def dt(x):
    try:
        d = datetime.fromisoformat(str(x).replace("Z", "+00:00"))
        return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
    except Exception:
        return None


# ---- index Bigship shipments by phone + name ----
by_phone, by_name = defaultdict(list), defaultdict(list)
for r in db.courier_shipments.find({}, {"phone": 1, "customer_name": 1, "awb_number": 1, "status": 1,
                                        "consignee_pincode": 1, "pincode": 1, "created_at": 1,
                                        "courier_name": 1, "product_name": 1}):
    if not str(r.get("awb_number") or "").strip():
        continue
    rec = {"awb": r.get("awb_number"), "status": r.get("status") or "", "courier": r.get("courier_name") or "",
           "pin": npin(r.get("consignee_pincode") or r.get("pincode")), "created": dt(r.get("created_at")),
           "product": r.get("product_name") or ""}
    ph = nph(r.get("phone"))
    if ph:
        by_phone[ph].append(rec)
    nm = nname(r.get("customer_name"))
    if len(nm) >= 5:
        by_name[nm].append(rec)

# ---- triage each discrepancy order ----
orders = list(db.amazon_orders.find({"fulfillment_truth": "amazon_shipped_no_record"},
              {"amazon_order_id": 1, "phone": 1, "phone_manual": 1, "buyer_name": 1,
               "customer_name_manual": 1, "postal_code": 1, "pincode_manual": 1, "purchase_date": 1,
               "order_total": 1, "firm_name": 1}))

tiers = Counter()
results, link_ops = [], []
for o in orders:
    ph = nph(o.get("phone") or o.get("phone_manual"))
    nm = nname(o.get("buyer_name") or o.get("customer_name_manual"))
    pin = npin(o.get("postal_code") or o.get("pincode_manual"))
    odt = dt(o.get("purchase_date"))
    tier, match = "NONE", None

    cands = by_phone.get(ph, []) if ph else []
    if cands:
        corrob = None
        for s in cands:
            close = odt and s["created"] and abs((odt - s["created"]).days) <= 10
            if (pin and s["pin"] and pin == s["pin"]) or close:
                corrob = s
                break
        if corrob:
            tier, match = "HIGH", corrob
        else:
            tier, match = "MEDIUM", cands[0]
    elif nm and len(nm) >= 5:
        for s in by_name.get(nm, []):
            if pin and s["pin"] and pin == s["pin"]:
                tier, match = "NAME", s
                break

    tiers[tier] += 1
    val = (o.get("order_total") or {}).get("Amount") if isinstance(o.get("order_total"), dict) else o.get("order_total")
    results.append({"order": o.get("amazon_order_id"), "tier": tier, "firm": o.get("firm_name") or "",
                    "awb": (match["awb"] if match else ""), "bigship_status": (match["status"] if match else ""),
                    "value": val})
    if LINK and tier in ("HIGH",) and match:
        link_ops.append(UpdateOne({"amazon_order_id": o["amazon_order_id"]}, {"$set": {
            "bigship_awb": match["awb"], "bigship_status": match["status"], "bigship_courier": match["courier"],
            "actually_shipped": bool(re.search(r"transit|delivered|picked|out for|rto", match["status"], re.I)),
            "fulfillment_truth": "shipped", "fulfillment_link_via": "phone+corroboration",
            "fulfillment_checked_at": NOW.isoformat()}}))

if LINK and link_ops:
    for i in range(0, len(link_ops), 500):
        db.amazon_orders.bulk_write(link_ops[i:i + 500], ordered=False)

# ---- truly-no-record chase list ----
chase = [r for r in results if r["tier"] == "NONE"]
def fval(v):
    try: return float(v or 0)
    except: return 0.0
chase_val = sum(fval(r["value"]) for r in chase)

print(f"=== TRIAGE of {len(orders)} 'shipped but no record' orders ===")
for t in ("HIGH", "MEDIUM", "NAME", "NONE"):
    print(f"  {t:7} {tiers.get(t,0)}")
print(f"\nLIKELY SHIPPED (HIGH+MEDIUM+NAME): {tiers['HIGH']+tiers['MEDIUM']+tiers['NAME']}")
print(f"TRULY NO RECORD (chase): {len(chase)}  · value ₹{chase_val:,.0f}")
if LINK:
    print(f"\nLINKED {len(link_ops)} HIGH-confidence orders → fulfillment_truth=shipped")

# ---- save chase list + WhatsApp summary ----
os.makedirs("/var/www/crm/backend/exports", exist_ok=True)
out = f"/var/www/crm/backend/exports/truly_no_record_{NOW:%Y%m%d}.csv"
buf = io.StringIO(); w = csv.DictWriter(buf, fieldnames=["order", "firm", "value"])
w.writeheader()
for r in chase:
    w.writerow({"order": r["order"], "firm": r["firm"], "value": r["value"]})
open(out, "w").write(buf.getvalue())
db.fulfillment_discrepancies.update_many({}, {"$set": {"triaged_at": NOW.isoformat()}})

if not NO_WA:
    cap = (f"🔎 Triage of the {len(orders)} 'shipped, no record':\n"
           f"✅ Likely shipped (matched in Bigship by phone/name): *{tiers['HIGH']+tiers['MEDIUM']+tiers['NAME']}*"
           f" (HIGH {tiers['HIGH']} / MED {tiers['MEDIUM']} / name {tiers['NAME']})\n"
           f"🔴 Truly NO record — chase: *{len(chase)}* · ₹{chase_val:,.0f}")
    payload = {"to": FOUNDER, "message": cap,
               "media": {"mimetype": "text/csv", "data": base64.b64encode(buf.getvalue().encode()).decode(),
                         "filename": f"truly_no_record_{NOW:%Y%m%d}.csv"}}
    try:
        r = urllib.request.urlopen(urllib.request.Request(BRIDGE, data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"}), timeout=40)
        print("\nWhatsApp ->", r.status)
    except Exception as e:
        print("\nWhatsApp error:", e)

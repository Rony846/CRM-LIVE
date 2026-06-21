#!/usr/bin/env python3
"""Seed/refresh db.az_claims from the A-Z signals we hold:
  - claim-notification emails in db.email_agent_inbox ("Amazon A-to-z Guarantee Claim …")
  - a_to_z_claim=true rows in an Amazon Returns Report (XML), if a path is given
Enriches each with customer/phone/product/amount-at-risk. Idempotent on order_id; preserves any
manually-set status/notes. When you get the real A-to-z Guarantee Claims export, extend parse_export()
to upsert true outcomes (granted/denied).

Usage: seed_az_claims.py [--returns-xml-dir /path/to/returns/xml]
"""
import sys, re, glob, uuid
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
NOW = datetime.now(timezone.utc).isoformat()
AMZ = re.compile(r"\d{3}-\d{7}-\d{7}")
XMLDIR = sys.argv[sys.argv.index("--returns-xml-dir") + 1] if "--returns-xml-dir" in sys.argv else None


def firmid(name):
    f = db.firms.find_one({"name": name}, {"id": 1})
    return (f or {}).get("id")


claims = {}
for e in db.email_agent_inbox.find({"subject": {"$regex": "a-to-z|a to z guarantee", "$options": "i"}},
                                   {"subject": 1, "created_at": 1}):
    m = AMZ.search(e.get("subject") or "")
    if m:
        c = claims.setdefault(m.group(0), {"sources": set(), "date": str(e.get("created_at"))[:10]})
        c["sources"].add("email")
        c["date"] = min(c["date"], str(e.get("created_at"))[:10])

if XMLDIR:
    import xml.etree.ElementTree as ET
    for fp in glob.glob(f"{XMLDIR}/**/*.xml", recursive=True):
        for rd in ET.parse(fp).getroot().iter("return_details"):
            if (rd.findtext("a_to_z_claim") or "").lower() == "true":
                o = rd.findtext("order_id")
                if o:
                    c = claims.setdefault(o, {"sources": set(), "date": (rd.findtext("return_request_date") or "")[:10]})
                    c["sources"].add("returns_report")

col = db.az_claims
col.create_index("order_id", unique=True)
new = 0
for oid, meta in claims.items():
    ao = db.amazon_orders.find_one({"amazon_order_id": oid},
                                   {"buyer_name": 1, "phone": 1, "phone_manual": 1, "firm_name": 1, "order_total": 1}) or {}
    rf = db.amazon_refunds.find_one({"amazon_order_id": oid}, {"refund_amount": 1}) or {}
    cs = db.courier_shipments.find_one({"$or": [{"amazon_order_id": {"$regex": oid}}, {"order_id": {"$regex": oid}}]},
                                       {"customer_name": 1, "phone": 1, "product_name": 1}) or {}
    ot = ao.get("order_total")
    amt = (ot.get("Amount") if isinstance(ot, dict) else ot) or rf.get("refund_amount") or 0
    base = {
        "order_id": oid, "claim_date": meta["date"], "sources": sorted(meta["sources"]),
        "customer": ao.get("buyer_name") or cs.get("customer_name") or "",
        "phone": re.sub(r"\D", "", str(ao.get("phone") or ao.get("phone_manual") or cs.get("phone") or ""))[-10:],
        "product": (cs.get("product_name") or "")[:60],
        "firm_name": ao.get("firm_name") or "", "firm_id": firmid(ao.get("firm_name") or ""),
        "amount_at_risk": round(float(amt or 0), 2), "updated_at": NOW,
    }
    if col.find_one({"order_id": oid}, {"_id": 1}):
        col.update_one({"order_id": oid}, {"$set": base})   # keep status/notes/outcome
    else:
        base.update({"id": str(uuid.uuid4()), "status": "under_review", "outcome": None,
                     "notes": "", "created_at": NOW, "source_tag": "known_signals_seed"})
        col.insert_one(base)
        new += 1

print(f"az_claims: {new} new, total {col.count_documents({})}, at risk Rs "
      f"{sum(float(c.get('amount_at_risk') or 0) for c in col.find({}, {'amount_at_risk': 1})):,.0f}")

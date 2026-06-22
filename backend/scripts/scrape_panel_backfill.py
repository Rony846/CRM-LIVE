#!/usr/bin/env python3
"""Deep Bigship panel backfill — pulls the full recent panel history (not just the latest ~150 the
30-min scrape sees) and upserts into courier_shipments, recovering shipments missed since the
bigship_excel feed stopped 2026-05-27. Same upsert logic as scheduled_bigship_panel_scrape.

Usage: scrape_panel_backfill.py [--pages N] [--size N]   (default 40 x 100 = up to 4000 most recent)
"""
import os, sys, re, uuid, asyncio
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

sys.path.insert(0, "/var/www/crm/backend")
ENV = dotenv_values("/var/www/crm/backend/.env")
for k, v in ENV.items():
    os.environ.setdefault(k, v or "")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
from utils import bigship_panel

PAGES = int(sys.argv[sys.argv.index("--pages") + 1]) if "--pages" in sys.argv else 40
SIZE = int(sys.argv[sys.argv.index("--size") + 1]) if "--size" in sys.argv else 100
AMZ = re.compile(r"^\d{3}-\d{7}-\d{7}$")
NOW = datetime.now(timezone.utc).isoformat()


def main():
    res = asyncio.run(bigship_panel.scrape_all_shipments(max_pages=PAGES, page_size=SIZE))
    if not res.get("ok"):
        print("SCRAPE FAILED:", res.get("error"))
        return
    ships = res.get("shipments", [])
    print(f"scraped {len(ships)} panel shipments (pages={PAGES} size={SIZE})")
    new = upd = amz = 0
    for s in ships:
        awb = s.get("awb")
        if not awb:
            continue
        ref = (s.get("order_ref") or "").strip()
        set_doc = {
            "status": s.get("status"), "courier_name": s.get("courier"),
            "customer_name": s.get("customer_name"), "phone": s.get("phone"),
            "consignee_city": s.get("city"), "consignee_state": s.get("state"),
            "consignee_pincode": s.get("pincode"),
            "address": " ".join(x for x in [s.get("address1"), s.get("address2"), s.get("landmark")] if x),
            "panel_order_ref": ref, "payment_type": s.get("payment_type"),
            "invoice_amount": s.get("order_value"), "lr_number": s.get("lr_number"),
            "bigship_panel_order_id": s.get("bigship_order_id"),
            "panel_scraped_at": NOW, "updated_at": NOW,
        }
        if s.get("is_amazon_order") or AMZ.match(ref):
            set_doc["amazon_order_id"] = ref
            set_doc["invoice_number"] = ref
            ao = db.amazon_orders.find_one({"amazon_order_id": ref}, {"_id": 0, "id": 1})
            if ao:
                set_doc["amazon_order_ref_id"] = ao["id"]
                amz += 1
        if db.courier_shipments.find_one({"awb_number": awb}, {"_id": 1}):
            db.courier_shipments.update_one({"awb_number": awb}, {"$set": set_doc})
            upd += 1
        else:
            set_doc.update({"id": str(uuid.uuid4()), "awb_number": awb, "tracking_id": awb,
                            "source": "bigship_panel", "created_at": NOW})
            set_doc.setdefault("invoice_number", ref or None)
            db.courier_shipments.insert_one(set_doc)
            new += 1
    print(f"upsert done: {new} new, {upd} updated, {amz} amazon-matched")


main()

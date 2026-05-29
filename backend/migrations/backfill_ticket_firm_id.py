"""One-off: backfill firm_id on existing support tickets where derivable.

A ticket's firm is inferred from the unit that was sold: first via the Amazon
order/invoice reference (amazon_orders.firm_id), then via the unit serial
(finished_good_serials.firm_id). Tickets that can't be attributed are left
untouched (firm_id stays absent → treated as global by the soft-scoped queue).

Idempotent: only fills tickets that don't already have a non-null firm_id.

Run:  cd /var/www/crm/backend && ./venv/bin/python migrations/backfill_ticket_firm_id.py
"""
import asyncio
import os
from collections import Counter

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


async def main():
    # Build firm lookup maps once.
    amz_firm = {}
    async for o in db.amazon_orders.find(
        {"firm_id": {"$ne": None}}, {"_id": 0, "amazon_order_id": 1, "firm_id": 1}
    ):
        if o.get("amazon_order_id"):
            amz_firm[o["amazon_order_id"]] = o["firm_id"]

    serial_firm = {}
    async for s in db.finished_good_serials.find(
        {"firm_id": {"$ne": None}}, {"_id": 0, "serial_number": 1, "firm_id": 1}
    ):
        if s.get("serial_number"):
            serial_firm[s["serial_number"]] = s["firm_id"]

    firm_names = {
        f["id"]: f.get("name")
        async for f in db.firms.find({}, {"_id": 0, "id": 1, "name": 1})
    }

    # Only tickets without an existing firm_id.
    cursor = db.tickets.find(
        {"firm_id": {"$in": [None]}},
        {"_id": 0, "id": 1, "order_id": 1, "invoice_number": 1, "serial_number": 1},
    )

    scanned = updated = 0
    by_source = Counter()
    by_firm = Counter()

    async for t in cursor:
        scanned += 1
        firm_id = None
        source = None
        for ref in (t.get("order_id"), t.get("invoice_number")):
            if ref and ref in amz_firm:
                firm_id, source = amz_firm[ref], "amazon"
                break
        if not firm_id and t.get("serial_number") in serial_firm:
            firm_id, source = serial_firm[t["serial_number"]], "serial"

        if firm_id:
            await db.tickets.update_one({"id": t["id"]}, {"$set": {"firm_id": firm_id}})
            updated += 1
            by_source[source] += 1
            by_firm[firm_names.get(firm_id, firm_id)] += 1

    print(f"scanned (firm_id missing/null): {scanned}")
    print(f"backfilled: {updated}")
    print(f"  by source: {dict(by_source)}")
    print(f"  by firm:   {dict(by_firm)}")


asyncio.run(main())

"""One-off: normalize SP-API dict-shaped money fields on dispatches to plain floats.

Amazon-sourced dispatches sometimes stored money as the SP-API shape
{"Amount": "5410.00", "CurrencyCode": "INR"} instead of a float. That breaks
Pydantic float validation (DispatchResponse) and any direct arithmetic on the
field. This rewrites each such field to float(Amount) (None if unparseable).

Idempotent: only touches fields currently stored as a dict (matched via the
nested ".Amount" key), so re-running is a no-op once clean.

Run:  cd /var/www/crm/backend && ./venv/bin/python migrations/normalize_dispatch_money_fields.py
"""
import asyncio
import os

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

MONEY_FIELDS = [
    "invoice_value", "service_charges", "gst_rate",
    "taxable_value", "gst_amount", "selling_price",
]


async def main():
    total_fixed = 0
    for field in MONEY_FIELDS:
        n = 0
        # Only docs where the field is a dict carrying an Amount key.
        cursor = db.dispatches.find(
            {f"{field}.Amount": {"$exists": True}},
            {"_id": 1, "dispatch_number": 1, field: 1},
        )
        async for d in cursor:
            raw = d.get(field) or {}
            amount = raw.get("Amount")
            try:
                value = float(amount)
            except (TypeError, ValueError):
                value = None
            await db.dispatches.update_one({"_id": d["_id"]}, {"$set": {field: value}})
            n += 1
            print(f"  {field}: {d.get('dispatch_number') or d['_id']}  {raw!r} -> {value}")
        total_fixed += n
        print(f"{field}: fixed {n}")

    # Verify nothing dict-shaped remains.
    remaining = 0
    for field in MONEY_FIELDS:
        remaining += await db.dispatches.count_documents({f"{field}.Amount": {"$exists": True}})
    print(f"\nTOTAL fixed: {total_fixed} | dict-shaped money fields remaining: {remaining}")


asyncio.run(main())

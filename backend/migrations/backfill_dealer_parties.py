#!/usr/bin/env python3
"""
Backfill: create party records for dealers that don't have one.
Safe to run multiple times — skips dealers whose party already exists.
Usage:  python backend/migrations/backfill_dealer_parties.py
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "crm_db")


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    dealers = await db.dealers.find({}).to_list(5000)
    created = 0
    skipped = 0

    for dealer in dealers:
        dealer_id = dealer.get("id")
        if not dealer_id:
            continue

        existing = await db.parties.find_one({"dealer_id": dealer_id})
        if existing:
            skipped += 1
            continue

        now = datetime.now(timezone.utc).isoformat()
        address_parts = [dealer.get("address_line1") or "", dealer.get("address_line2") or ""]
        party_doc = {
            "id": str(uuid.uuid4()),
            "party_type": "dealer",
            "name": dealer.get("firm_name") or dealer.get("contact_person") or f"Dealer {dealer_id}",
            "contact_person": dealer.get("contact_person"),
            "phone": dealer.get("phone"),
            "email": dealer.get("email"),
            "gstin": dealer.get("gst_number"),
            "address": " ".join(p for p in address_parts if p).strip(),
            "city": dealer.get("city"),
            "state": dealer.get("state"),
            "pincode": dealer.get("pincode"),
            "opening_balance": 0,
            "current_balance": 0,
            "is_active": True,
            "dealer_id": dealer_id,
            "created_at": now,
            "updated_at": now,
            "backfilled": True,
        }
        await db.parties.insert_one(party_doc)
        created += 1
        print(f"  + created party for {party_doc['name']}")

    print(f"\nDone. Created: {created}, Skipped (already existed): {skipped}, Total dealers: {len(dealers)}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())

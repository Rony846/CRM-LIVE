"""One-shot: create missing party records for historical dealers."""
import asyncio, os, uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ.get("DB_NAME", "test_database")]

async def main():
    created = skipped = 0
    async for dealer in db.dealers.find({}):
        existing = await db.parties.find_one({"dealer_id": dealer["id"]})
        if existing:
            skipped += 1
            continue
        now = datetime.now(timezone.utc).isoformat()
        party = {
            "id": str(uuid.uuid4()),
            "name": dealer.get("firm_name") or dealer.get("name") or "Unknown Dealer",
            "party_type": "dealer",
            "dealer_id": dealer["id"],
            "phone": dealer.get("phone") or dealer.get("mobile"),
            "email": dealer.get("email"),
            "gst_number": dealer.get("gst_number"),
            "address": dealer.get("address"),
            "current_balance": 0,
            "firm_id": dealer.get("firm_id"),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        await db.parties.insert_one(party)
        created += 1
        print(f"Created party for {party['name']}")
    print(f"\nDone. Created: {created}, Skipped (already had party): {skipped}")

if __name__ == "__main__":
    asyncio.run(main())

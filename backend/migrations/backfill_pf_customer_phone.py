"""
Copy buyer_phone/buyer_name from amazon_orders into pending_fulfillment entries missing them.
Run once to fix existing rows that were created before the phone propagation fix.
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ.get("DB_NAME", "test_database")]


async def main():
    fixed = 0
    skipped = 0
    
    # Find all pending_fulfillment entries missing customer_phone
    query = {
        "$or": [
            {"customer_phone": {"$in": [None, ""]}},
            {"customer_phone": {"$exists": False}}
        ]
    }
    
    cursor = db.pending_fulfillment.find(query)
    
    async for pf in cursor:
        # Get the amazon order id from various fields
        aid = pf.get("amazon_order_id") or pf.get("order_id") or pf.get("marketplace_order_id")
        if not aid:
            skipped += 1
            continue
        
        # Find matching amazon order
        ao = await db.amazon_orders.find_one({
            "$or": [
                {"amazon_order_id": aid},
                {"order_id": aid}
            ]
        })
        
        if not ao:
            skipped += 1
            continue
        
        shipping = ao.get("shipping_address") or {}
        update = {}
        
        # Phone - check multiple sources
        phone = ao.get("buyer_phone") or shipping.get("phone") or pf.get("phone")
        if phone and not pf.get("customer_phone"):
            update["customer_phone"] = phone
            update["phone"] = phone
        
        # Customer name
        if not pf.get("customer_name"):
            name = ao.get("buyer_name") or shipping.get("name")
            if name:
                update["customer_name"] = name
        
        # Address
        if not pf.get("address"):
            addr = shipping.get("address_line1") or ao.get("address_line1")
            if addr:
                update["address"] = addr
        
        # City
        if not pf.get("city"):
            city = shipping.get("city") or ao.get("city")
            if city:
                update["city"] = city
        
        # State
        if not pf.get("state"):
            state = shipping.get("state") or ao.get("state")
            if state:
                update["state"] = state
        
        # Pincode
        if not pf.get("pincode"):
            pincode = shipping.get("postal_code") or ao.get("postal_code")
            if pincode:
                update["pincode"] = pincode
        
        if update:
            await db.pending_fulfillment.update_one(
                {"id": pf["id"]},
                {"$set": update}
            )
            fixed += 1
            print(f"  Fixed: {pf.get('order_id') or pf.get('id')} -> phone={update.get('customer_phone')}")
    
    print(f"\nBackfill complete: {fixed} entries updated, {skipped} skipped (no amazon order found)")


if __name__ == "__main__":
    asyncio.run(main())

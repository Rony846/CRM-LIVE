#!/usr/bin/env python3
"""
Migration script to convert existing SKUs to Master SKUs.
This script:
1. Creates Master SKUs from existing SKUs
2. Preserves existing SKU code as both primary code and first alias
3. Marks all as is_manufactured=false initially (can be updated later)
"""

import asyncio
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "crm_db")

async def migrate_skus_to_master_skus():
    """Migrate existing SKUs to Master SKUs"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 60)
    print("MIGRATING SKUs TO MASTER SKUs")
    print("=" * 60)
    
    # Get all existing SKUs
    skus = await db.skus.find({}).to_list(1000)
    print(f"Found {len(skus)} existing SKUs to migrate")
    
    migrated = 0
    skipped = 0
    
    for sku in skus:
        # Check if already migrated (by checking if master_sku with same sku_code exists)
        existing_master = await db.master_skus.find_one({"sku_code": sku.get("sku_code")})
        if existing_master:
            print(f"  SKIP: {sku.get('sku_code')} - already migrated")
            skipped += 1
            continue
        
        # Create Master SKU
        now = datetime.now(timezone.utc).isoformat()
        master_sku = {
            "id": str(uuid.uuid4()),
            "name": sku.get("model_name") or sku.get("name") or sku.get("sku_code"),
            "sku_code": sku.get("sku_code"),
            "category": sku.get("category", "Unknown"),
            "hsn_code": sku.get("hsn_code"),
            "unit": "pcs",
            "is_manufactured": False,  # Default to not manufactured
            "bill_of_materials": [],
            "aliases": [
                {
                    "alias_code": sku.get("sku_code"),
                    "platform": "Legacy",
                    "notes": f"Migrated from legacy SKU system on {now[:10]}"
                }
            ],
            "reorder_level": sku.get("low_stock_alert", 10),
            "description": sku.get("description"),
            "is_active": sku.get("is_active", True),
            "legacy_sku_id": sku.get("id"),  # Keep reference to old SKU
            "created_at": sku.get("created_at", now),
            "updated_at": now
        }
        
        await db.master_skus.insert_one(master_sku)
        print(f"  MIGRATED: {sku.get('sku_code')} -> Master SKU {master_sku['id'][:8]}...")
        migrated += 1
    
    print("=" * 60)
    print(f"Migration complete: {migrated} migrated, {skipped} skipped")
    print("=" * 60)
    
    # Show all Master SKUs
    master_skus = await db.master_skus.find({}, {"_id": 0}).to_list(1000)
    print(f"\nTotal Master SKUs: {len(master_skus)}")
    for ms in master_skus:
        print(f"  - {ms['sku_code']}: {ms['name']} (manufactured: {ms.get('is_manufactured', False)})")
    
    client.close()


async def main():
    await migrate_skus_to_master_skus()


if __name__ == "__main__":
    asyncio.run(main())

"""
Repair the three-way drift between Amazon SKU mapping sources.

There are three places that record an Amazon SKU → Master SKU mapping:
  1. `amazon_sku_mappings` collection (one doc per firm/sku)
  2. `master_skus.aliases[]`            (list of alias_code+platform per master)
  3. `amazon_orders.items[].master_sku_id` (per-item snapshot)

The /amazon/sync-alias-mappings endpoint propagates (2) -> (1)+(3) but only
when (2) is already populated. If a mapping is created via direct mongo
write or via a different flow that only updates (1), the /amazon/unmapped-skus
UI will keep flagging it (because the UI's check reads (2) and (3), not (1)).

This script reconciles them: for every entry in (1) for a target firm, it
backfills (2) and (3) so the three sources agree. Idempotent — safe to
re-run; rows that already match are no-ops.

Usage:
  python3 backfill_amazon_sku_mappings.py --firm-id <id>      # one firm
  python3 backfill_amazon_sku_mappings.py --all-firms         # every firm
  python3 backfill_amazon_sku_mappings.py --firm-id <id> --dry-run
"""
import argparse
import asyncio
import os
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/var/www/crm/backend/.env")


async def reconcile_firm(db, firm_id: str, firm_name: str, dry_run: bool):
    mappings = {}
    async for m in db.amazon_sku_mappings.find(
        {"firm_id": firm_id},
        {"_id": 0, "amazon_sku": 1, "master_sku_id": 1, "sku_code": 1, "master_sku_name": 1},
    ):
        if m.get("amazon_sku") and m.get("master_sku_id"):
            mappings[m["amazon_sku"]] = m

    if not mappings:
        print(f"  {firm_name}: no amazon_sku_mappings — nothing to reconcile")
        return

    now = datetime.now(timezone.utc).isoformat()

    items_fixed = 0
    orders_touched = 0
    async for o in db.amazon_orders.find({"firm_id": firm_id}):
        new_items = []
        changed = False
        for it in (o.get("items") or []):
            asku = it.get("amazon_sku") or it.get("seller_sku")
            if it.get("master_sku_id") is None and asku and asku in mappings:
                it = dict(it)
                m = mappings[asku]
                it["master_sku_id"] = m["master_sku_id"]
                it["master_sku_code"] = m.get("sku_code")
                it["master_sku_name"] = m.get("master_sku_name")
                it["mapped_via"] = "backfill_from_amazon_sku_mappings"
                it["mapped_at"] = now
                items_fixed += 1
                changed = True
            new_items.append(it)
        if changed:
            orders_touched += 1
            if not dry_run:
                await db.amazon_orders.update_one(
                    {"_id": o["_id"]}, {"$set": {"items": new_items}}
                )

    aliases_added = 0
    for asku, m in mappings.items():
        msid = m["master_sku_id"]
        existing = await db.master_skus.find_one(
            {
                "id": msid,
                "aliases": {
                    "$elemMatch": {
                        "alias_code": asku,
                        "platform": {"$regex": "^amazon$", "$options": "i"},
                    }
                },
            },
            {"_id": 0, "id": 1},
        )
        if existing:
            continue
        if not dry_run:
            r = await db.master_skus.update_one(
                {"id": msid},
                {"$addToSet": {"aliases": {
                    "alias_code": asku,
                    "platform": "amazon",
                    "added_at": now,
                }}},
            )
            if r.modified_count:
                aliases_added += 1
        else:
            aliases_added += 1

    tag = " (dry-run)" if dry_run else ""
    print(f"  {firm_name}: {len(mappings)} mappings · "
          f"items backfilled {items_fixed} across {orders_touched} orders · "
          f"aliases added {aliases_added}{tag}")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--firm-id", type=str, default=None,
                    help="Reconcile a single firm. Omit with --all-firms for every firm.")
    ap.add_argument("--all-firms", action="store_true",
                    help="Reconcile every firm that has any amazon_sku_mappings rows.")
    ap.add_argument("--dry-run", action="store_true",
                    help="Show what would change without writing.")
    args = ap.parse_args()

    if not args.firm_id and not args.all_firms:
        ap.error("specify --firm-id <id> or --all-firms")

    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

    if args.all_firms:
        firm_ids = await db.amazon_sku_mappings.distinct("firm_id")
    else:
        firm_ids = [args.firm_id]

    print(f"Reconciling {len(firm_ids)} firm(s){' [DRY-RUN]' if args.dry_run else ''}")
    for fid in firm_ids:
        firm = await db.firms.find_one({"id": fid}, {"_id": 0, "name": 1})
        name = (firm or {}).get("name") or fid
        await reconcile_firm(db, fid, name, args.dry_run)


if __name__ == "__main__":
    asyncio.run(main())

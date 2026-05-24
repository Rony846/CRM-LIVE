"""
Repair two latent inconsistencies on the `parties` collection:

1. `is_active` missing on rows — older imports and the early WhatsApp-agent
   _create_party never wrote the field. The /api/parties default filter
   excluded them because `{is_active: True}` doesn't match a missing field.
   The API has been loosened to `{$ne: False}`, but we also stamp the field
   on the legacy rows so future code that checks `is_active === true`
   exactly (e.g. on the React side) sees the right thing.

2. `gstin` vs `gst_number` — older parties carry `gst_number`, newer ones
   carry `gstin`. Zero overlap. Mirror each into the other so search,
   purchase-creation, GSTR-3B and dealer flows that look at one of the
   fields stop missing the other half of the population.

Run:
    cd backend && ./venv/bin/python -m migrations.repair_party_identity_fields
    cd backend && ./venv/bin/python -m migrations.repair_party_identity_fields --dry-run
"""

import argparse
import asyncio
import os
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(ROOT / ".env")


async def main(dry_run: bool):
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    counts = Counter()
    sample_active: list[str] = []
    sample_gst: list[dict] = []

    cursor = db.parties.find({}, {"id": 1, "name": 1, "is_active": 1, "gstin": 1, "gst_number": 1, "_id": 0})
    async for doc in cursor:
        updates: dict = {}

        # 1. is_active
        if "is_active" not in doc:
            updates["is_active"] = True
            counts["is_active_set"] += 1
            if len(sample_active) < 5:
                sample_active.append(doc.get("name") or doc.get("id"))

        # 2. mirror gstin / gst_number
        gstin = (doc.get("gstin") or "").strip()
        gst_number = (doc.get("gst_number") or "").strip()
        if gstin and not gst_number:
            updates["gst_number"] = gstin
            counts["gst_number_filled"] += 1
            if len(sample_gst) < 5:
                sample_gst.append({"name": doc.get("name"), "had": "gstin", "value": gstin})
        elif gst_number and not gstin:
            updates["gstin"] = gst_number
            counts["gstin_filled"] += 1
            if len(sample_gst) < 5:
                sample_gst.append({"name": doc.get("name"), "had": "gst_number", "value": gst_number})

        if updates and not dry_run:
            await db.parties.update_one({"id": doc["id"]}, {"$set": updates})
        if updates:
            counts["rows_touched"] += 1

    print("\n=== Summary ===")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    if sample_active:
        print(f"\nSample is_active backfills ({len(sample_active)} shown):")
        for n in sample_active:
            print(f"  - {n}")
    if sample_gst:
        print(f"\nSample GSTIN mirrors ({len(sample_gst)} shown):")
        for s in sample_gst:
            print(f"  - {s['name']}: had {s['had']}={s['value']}")
    print(f"\n{'(dry run — no writes performed)' if dry_run else 'Done.'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.dry_run))

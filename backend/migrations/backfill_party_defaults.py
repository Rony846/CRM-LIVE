"""
Backfill default values on `parties` rows so PartyResponse stops throwing
500s on perfectly-fine documents.

The fields covered all have sensible defaults but were absent on older
imports / WA-agent-created rows:

  credit_limit     → 0.0      (most parties: no credit terms set)
  opening_balance  → 0.0      (no opening adjustment recorded)
  updated_at       → created_at  (fall back to create time)
  state            → ""       (don't invent geography — leave blank)
  party_types      → []       (the 39 typeless rows from
                                converge_party_types stay typeless;
                                we just write an empty list rather
                                than leaving the key missing)

Run:
    cd backend && ./venv/bin/python -m migrations.backfill_party_defaults
    cd backend && ./venv/bin/python -m migrations.backfill_party_defaults --dry-run
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
    cursor = db.parties.find({}, {
        "id": 1, "name": 1, "credit_limit": 1, "opening_balance": 1,
        "updated_at": 1, "created_at": 1, "state": 1, "party_types": 1, "_id": 0,
    })
    async for doc in cursor:
        updates: dict = {}
        if doc.get("credit_limit") is None:
            updates["credit_limit"] = 0.0
            counts["credit_limit"] += 1
        if doc.get("opening_balance") is None:
            updates["opening_balance"] = 0.0
            counts["opening_balance"] += 1
        if doc.get("updated_at") is None:
            updates["updated_at"] = doc.get("created_at") or ""
            counts["updated_at"] += 1
        if doc.get("state") is None:
            updates["state"] = ""
            counts["state"] += 1
        if "party_types" not in doc or doc.get("party_types") is None:
            updates["party_types"] = []
            counts["party_types"] += 1
        if updates:
            counts["rows_touched"] += 1
            if not dry_run:
                await db.parties.update_one({"id": doc["id"]}, {"$set": updates})

    print("=== Summary ===")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    print(f"\n{'(dry run — no writes performed)' if dry_run else 'Done.'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.dry_run))

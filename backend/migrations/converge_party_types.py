"""
Converge the `party_type` (singular string) and `party_types` (plural array)
fields on the `parties` collection.

History: the schema was changed twice without backfilling. Older imports
saved `party_types: ["customer"]` only; newer code (including the WhatsApp
agent's _create_party) saves `party_type: "customer"` only. There is no
overlap — every row uses exactly one of the two. Filters that hit one
field miss everything saved under the other.

This script mirrors each party's type(s) into BOTH fields:
  - `party_type`  (singular string)  ← primary type
  - `party_types` (array of strings) ← all types

For parties that legitimately belong to multiple categories (e.g. both
customer and supplier), the primary is chosen by priority:
    supplier > dealer > customer > {anything else, alphabetical}.
We pick supplier first because suppliers are the rarer / more
compliance-sensitive category and the singular field is the one most
GST-flow code reads.

Run once:
    cd backend && ./venv/bin/python -m migrations.converge_party_types
    cd backend && ./venv/bin/python -m migrations.converge_party_types --dry-run
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

PRIORITY = {"supplier": 0, "dealer": 1, "customer": 2}


def _types_from_doc(doc: dict) -> list[str]:
    """Return the union of types stored across both fields, deduped."""
    out: list[str] = []
    sing = doc.get("party_type")
    plur = doc.get("party_types")
    if isinstance(sing, str) and sing.strip():
        out.append(sing.strip())
    if isinstance(plur, str) and plur.strip():
        out.append(plur.strip())
    elif isinstance(plur, list):
        for v in plur:
            if isinstance(v, str) and v.strip():
                out.append(v.strip())
    # dedupe, preserve order
    seen = set()
    deduped = []
    for t in out:
        if t not in seen:
            seen.add(t)
            deduped.append(t)
    return deduped


def _primary(types: list[str]) -> str:
    """Pick one canonical type for the singular field."""
    return sorted(types, key=lambda t: (PRIORITY.get(t, 99), t))[0]


async def main(dry_run: bool):
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    counts = Counter()
    examples = {"updated": [], "no_type": [], "already_converged": []}

    cursor = db.parties.find({}, {"id": 1, "name": 1, "party_type": 1, "party_types": 1, "_id": 0})
    async for doc in cursor:
        types = _types_from_doc(doc)
        if not types:
            counts["no_type"] += 1
            if len(examples["no_type"]) < 5:
                examples["no_type"].append(doc.get("name") or doc.get("id"))
            continue

        primary = _primary(types)
        canonical_array = sorted(set(types), key=lambda t: (PRIORITY.get(t, 99), t))

        # Already converged? singular == primary AND plural array matches (as set).
        existing_plural = doc.get("party_types")
        existing_plural_set = (
            set(existing_plural) if isinstance(existing_plural, list)
            else {existing_plural} if isinstance(existing_plural, str) and existing_plural
            else set()
        )
        if doc.get("party_type") == primary and existing_plural_set == set(canonical_array):
            counts["already_converged"] += 1
            continue

        counts["needs_update"] += 1
        if len(examples["updated"]) < 5:
            examples["updated"].append({
                "name": doc.get("name"),
                "before": {"party_type": doc.get("party_type"), "party_types": doc.get("party_types")},
                "after":  {"party_type": primary,                 "party_types": canonical_array},
            })

        if not dry_run:
            await db.parties.update_one(
                {"id": doc["id"]},
                {"$set": {"party_type": primary, "party_types": canonical_array}},
            )

    print("\n=== Summary ===")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    if examples["updated"]:
        print("\nSample updates:")
        for ex in examples["updated"]:
            print(f"  {ex['name']}: {ex['before']} → {ex['after']}")
    if examples["no_type"]:
        print(f"\n{counts['no_type']} parties left untouched (no type info on either field). Sample:")
        for n in examples["no_type"]:
            print(f"  - {n}")
    print(f"\n{'(dry run — no writes performed)' if dry_run else 'Done.'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Show what would change without writing")
    args = parser.parse_args()
    asyncio.run(main(args.dry_run))

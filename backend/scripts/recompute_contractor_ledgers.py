#!/usr/bin/env python3
"""
Recompute contractor (production supervisor) party ledgers from the source of
truth: the `supervisor_payables` collection.

Background
----------
Production payables post a CREDIT to the contractor's party ledger when created
("we owe them"). Until the 2026-05-20 fix, recording a payment did NOT post the
matching DEBIT — so a contractor's ledger balance never came down after they
were paid. The application code is now fixed; this script rebuilds the ledger
rows written before the fix so historical balances are correct.

Canonical convention:
    running_balance = previous + debit - credit
    negative balance = payable (we owe the contractor)
    zero            = fully settled

Events rebuilt per contractor party (chronological):
  * payable created  -> CREDIT total_payable
  * each payment     -> DEBIT  payment amount

Safety
------
  * Default mode is DRY RUN — prints a per-contractor old-vs-new table, writes nothing.
  * `--apply` archives every existing row for each contractor party into
    `party_ledger_archive` before deleting, then rewrites — fully reversible.

Usage
-----
    python3 recompute_contractor_ledgers.py            # dry run
    python3 recompute_contractor_ledgers.py --apply    # apply
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
APPLY = "--apply" in sys.argv


def _num(v):
    try:
        return round(float(v or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _ts(*candidates):
    for c in candidates:
        if c:
            return str(c)
    return ""


async def build_events(db, party):
    """Chronological ledger events for one contractor party, from supervisor_payables."""
    events = []
    payables = await db.supervisor_payables.find(
        {"contractor_party_id": party["id"]}
    ).to_list(100000)

    for p in payables:
        num = p.get("payable_number") or p.get("id")
        total = _num(p.get("total_payable"))
        if total > 0:
            events.append({
                "ts": _ts(p.get("created_at")),
                "entry_type": "payable",
                "debit": 0.0,
                "credit": total,
                "narration": f"Production payable {num}",
                "reference_type": "production",
                "reference_id": p.get("production_request_id") or p.get("id"),
            })
        for pmt in (p.get("payments") or []):
            amt = _num(pmt.get("amount"))
            if amt > 0:
                events.append({
                    "ts": _ts(pmt.get("paid_at"), p.get("updated_at"), p.get("created_at")),
                    "entry_type": "payment",
                    "debit": amt,
                    "credit": 0.0,
                    "narration": f"Payment for production payable {num}",
                    "reference_type": "production_payment",
                    "reference_id": p.get("id"),
                })

    events.sort(key=lambda e: e["ts"])
    return events, payables


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    now = datetime.now(timezone.utc).isoformat()

    parties = await db.parties.find({"tags": "contractor"}).to_list(100000)
    print(f"\n{'APPLY' if APPLY else 'DRY RUN'} — {len(parties)} contractor parties\n")
    print(f"{'Contractor':<34}{'Old bal':>14}{'New bal':>14}{'Events':>8}{'OldRows':>9}")
    print("-" * 79)

    total_old = total_new = 0.0
    changed = 0
    rows = []

    for party in parties:
        name = (party.get("name") or party.get("id"))[:32]
        events, _payables = await build_events(db, party)
        new_balance = round(sum(e["debit"] - e["credit"] for e in events), 2)

        old_entries = await db.party_ledger.find({"party_id": party["id"]}).to_list(100000)
        old_rows = len(old_entries)
        last = max(old_entries, key=lambda e: str(e.get("created_at") or ""), default=None)
        old_balance = _num(last.get("running_balance")) if last else 0.0

        total_old += old_balance
        total_new += new_balance
        if abs(old_balance - new_balance) > 0.01 or old_rows != len(events):
            changed += 1

        print(f"{name:<34}{old_balance:>14,.2f}{new_balance:>14,.2f}{len(events):>8}{old_rows:>9}")
        rows.append((party, events, old_entries))

    print("-" * 79)
    print(f"{'TOTALS':<34}{total_old:>14,.2f}{total_new:>14,.2f}")
    print(f"\n{changed} of {len(parties)} contractor parties would change.")

    if not APPLY:
        print("\nDRY RUN — nothing written. Re-run with --apply to commit.\n")
        client.close()
        return

    print("\nApplying — archiving old rows then rewriting...\n")
    archived = posted = 0
    for party, events, old_entries in rows:
        pid = party["id"]
        if old_entries:
            for e in old_entries:
                e.pop("_id", None)
                e["archived_at"] = now
                e["archived_reason"] = "contractor_ledger_recompute"
            await db.party_ledger_archive.insert_many(old_entries)
            await db.party_ledger.delete_many({"party_id": pid})
            archived += len(old_entries)

        running = 0.0
        seq = 0
        for e in events:
            seq += 1
            running = round(running + e["debit"] - e["credit"], 2)
            await db.party_ledger.insert_one({
                "id": str(uuid.uuid4()),
                "entry_number": f"RECOMP-C-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{pid[:6].upper()}-{seq:03d}",
                "party_id": pid,
                "party_name": party.get("name"),
                "entry_type": e["entry_type"],
                "debit": e["debit"],
                "credit": e["credit"],
                "running_balance": running,
                "narration": e["narration"],
                "description": e["narration"],
                "reference_type": e["reference_type"],
                "reference_id": e["reference_id"],
                "firm_id": party.get("firm_id"),
                "created_by": "system",
                "created_by_name": "Contractor ledger recompute",
                "created_at": e["ts"] or now,
                "recomputed": True,
            })
            posted += 1

        await db.party_balance_tracker.update_one(
            {"party_id": pid},
            {"$set": {"running_balance": running, "opening_applied": True},
             "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        await db.parties.update_one(
            {"id": pid}, {"$set": {"current_balance": running, "updated_at": now}}
        )

    print(f"Done. Archived {archived} old rows, posted {posted} canonical rows "
          f"across {len(rows)} contractor parties.")
    print("Old rows are recoverable from the `party_ledger_archive` collection.\n")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python3
"""
Recompute dealer party ledgers from the source of truth (dealer_orders +
genuinely-collected security deposits).

Background
----------
The dealer ledger code historically wrote entries with wrong field names
(`debit_amount`/`credit_amount` instead of `debit`/`credit`), the wrong
running-balance formula (`prev + credit` instead of `prev + debit - credit`),
and never posted a debit for the sale/invoice at all. The application code is
now fixed, but rows written before the fix are inconsistent. This script
rebuilds each dealer party's ledger correctly.

Canonical convention (ACCOUNTING_LOGIC_DOCUMENTATION.md):
    running_balance = previous + debit - credit
    positive balance = receivable (dealer owes us)
    negative balance = payable  (we owe the dealer, e.g. their deposit)

Events posted per dealer:
  * security deposit  -> CREDIT  (only if a real proof was uploaded; phantom
                                  auto-approved deposits with no proof are
                                  intentionally dropped)
  * order payment received -> CREDIT total_amount
  * order dispatched/delivered (invoiced) -> DEBIT total_amount
  cancelled / rejected orders are skipped.

Safety
------
  * Default mode is DRY RUN — prints a per-dealer old-vs-new table, writes nothing.
  * `--apply` performs the rewrite. Before deleting anything it copies every
    existing dealer-party ledger row into `party_ledger_archive`, so the change
    is fully reversible.

Usage
-----
    python3 recompute_dealer_ledgers.py            # dry run
    python3 recompute_dealer_ledgers.py --apply    # apply
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
SKIPPED_STATUSES = {"cancelled", "rejected"}
INVOICED_STATUSES = {"dispatched", "delivered"}


def _ts(*candidates):
    """First non-empty timestamp string, for chronological ordering."""
    for c in candidates:
        if c:
            return str(c)
    return ""


def _num(v):
    try:
        return round(float(v or 0), 2)
    except (TypeError, ValueError):
        return 0.0


async def build_events(db, dealer, dealer_id):
    """Return a chronologically-sorted list of ledger events for one dealer."""
    events = []  # dict: ts, entry_type, debit, credit, narration, reference_type, reference_id

    # --- Security deposit: include if status is approved and not waived. ---
    # An "approved" deposit that is not flagged `security_deposit_exempt`
    # represents money actually collected from the dealer (whether proof was
    # uploaded online or the deposit was taken offline and the admin approved
    # it). Waived deposits (exempt=True) are NOT booked.
    if dealer:
        sd_status = dealer.get("security_deposit_status")
        exempt = bool(dealer.get("security_deposit_exempt"))
        if sd_status == "approved" and not exempt:
            amt = _num(dealer.get("security_deposit_amount"))
            if amt > 0:
                events.append({
                    "ts": _ts(dealer.get("security_deposit_approved_at"),
                              dealer.get("security_deposit_uploaded_at"),
                              dealer.get("created_at")),
                    "entry_type": "security_deposit",
                    "debit": 0.0,
                    "credit": amt,
                    "narration": f"Security deposit from dealer {dealer.get('firm_name')}",
                    "reference_type": "security_deposit",
                    "reference_id": dealer_id,
                })

    # --- Orders ---
    orders = await db.dealer_orders.find({"dealer_id": dealer_id}).to_list(100000)
    for o in orders:
        status = o.get("status")
        if status in SKIPPED_STATUSES:
            continue
        total = _num(o.get("total_amount"))
        order_no = o.get("order_number", o.get("id"))

        # Payment received -> credit
        if o.get("payment_status") == "received" and total > 0:
            events.append({
                "ts": _ts(o.get("payment_received_at"), o.get("updated_at"), o.get("created_at")),
                "entry_type": "dealer_order_payment",
                "debit": 0.0,
                "credit": total,
                "narration": f"Payment received for dealer order {order_no}",
                "reference_type": "dealer_order_payment",
                "reference_id": o.get("id"),
            })

        # Invoiced (dispatched/delivered) -> debit
        if status in INVOICED_STATUSES and total > 0:
            inv_no = o.get("final_invoice_number")
            events.append({
                "ts": _ts(o.get("dispatch_date"), o.get("final_invoice_date"),
                          o.get("updated_at"), o.get("created_at")),
                "entry_type": "sales_invoice",
                "debit": total,
                "credit": 0.0,
                "narration": (f"Invoice {inv_no} for dealer order {order_no}"
                              if inv_no else f"Invoice for dealer order {order_no}"),
                "reference_type": "dealer_order_invoice",
                "reference_id": o.get("id"),
            })

    events.sort(key=lambda e: e["ts"])
    return events


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    now = datetime.now(timezone.utc).isoformat()

    parties = await db.parties.find({"party_type": "dealer"}).to_list(100000)
    print(f"\n{'APPLY' if APPLY else 'DRY RUN'} — {len(parties)} dealer parties\n")
    print(f"{'Dealer':<34}{'Old bal':>14}{'New bal':>14}{'Events':>8}{'OldRows':>9}")
    print("-" * 79)

    total_old = total_new = 0.0
    changed = 0
    rows = []

    for party in parties:
        dealer_id = party.get("dealer_id")
        if not dealer_id:
            continue
        dealer = await db.dealers.find_one({"id": dealer_id})
        name = (party.get("name") or (dealer or {}).get("firm_name") or dealer_id)[:32]

        old_balance = _num(party.get("current_balance"))
        events = await build_events(db, dealer, dealer_id)
        new_balance = round(sum(e["debit"] - e["credit"] for e in events), 2)

        old_rows = await db.party_ledger.count_documents({"party_id": party["id"]})

        total_old += old_balance
        total_new += new_balance
        if abs(old_balance - new_balance) > 0.01 or old_rows != len(events):
            changed += 1

        print(f"{name:<34}{old_balance:>14,.2f}{new_balance:>14,.2f}{len(events):>8}{old_rows:>9}")
        rows.append((party, events, new_balance))

    print("-" * 79)
    print(f"{'TOTALS':<34}{total_old:>14,.2f}{total_new:>14,.2f}")
    print(f"\n{changed} of {len(parties)} dealer parties would change.")

    if not APPLY:
        print("\nDRY RUN — nothing written. Re-run with --apply to commit.\n")
        client.close()
        return

    print("\nApplying — archiving old rows then rewriting...\n")
    archived = posted = 0
    for party, events, new_balance in rows:
        pid = party["id"]

        # Archive + delete existing ledger rows for this party
        old_entries = await db.party_ledger.find({"party_id": pid}).to_list(100000)
        if old_entries:
            for e in old_entries:
                e.pop("_id", None)
                e["archived_at"] = now
                e["archived_reason"] = "dealer_ledger_recompute"
            await db.party_ledger_archive.insert_many(old_entries)
            await db.party_ledger.delete_many({"party_id": pid})
            archived += len(old_entries)

        # Reset the atomic balance tracker
        await db.party_balance_tracker.delete_one({"party_id": pid})

        # Re-post canonical entries in chronological order
        running = 0.0
        seq = 0
        for e in events:
            seq += 1
            running = round(running + e["debit"] - e["credit"], 2)
            await db.party_ledger.insert_one({
                "id": str(uuid.uuid4()),
                "entry_number": f"RECOMP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{pid[:6].upper()}-{seq:03d}",
                "party_id": pid,
                "party_name": party.get("name"),
                "entry_type": e["entry_type"],
                "debit": e["debit"],
                "credit": e["credit"],
                "running_balance": running,
                "narration": e["narration"],
                "reference_type": e["reference_type"],
                "reference_id": e["reference_id"],
                "firm_id": party.get("firm_id"),
                "created_by": "system",
                "created_by_name": "Ledger recompute",
                "created_at": e["ts"] or now,
                "recomputed": True,
            })
            posted += 1

        # Seed the tracker so future create_party_ledger_entry_atomic calls continue correctly
        await db.party_balance_tracker.insert_one({
            "party_id": pid,
            "running_balance": running,
            "opening_applied": True,
            "created_at": now,
        })
        await db.parties.update_one(
            {"id": pid},
            {"$set": {"current_balance": running, "updated_at": now}}
        )

    print(f"Done. Archived {archived} old rows, posted {posted} canonical rows "
          f"across {len(rows)} dealer parties.")
    print("Old rows are recoverable from the `party_ledger_archive` collection.\n")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())

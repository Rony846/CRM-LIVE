"""One-off: clear stale items out of the active dispatch queue.

The dispatcher queue only shows pending_label / ready_for_dispatch, but 32 such
records had been stuck there for weeks/months. We resolve them by their real
signal rather than by status:

  - Has a tracking_id  -> it shipped; mark 'dispatched'  (12 ready_for_dispatch
    + 3 pending_label that carry tracking).
  - pending_label, no tracking_id -> never labelled/shipped, abandoned (incl.
    obvious test rows); mark 'cancelled'.

Safe to run: a prior check confirmed none of these 32 have stock_deducted=true
or a ledger_entry_id, so no inventory/accounting reversal is needed. The single
allocated serial (MG2604048) belongs to a tracked row that becomes 'dispatched',
which matches its already-'dispatched' state in finished_good_serials.

Idempotent: only touches rows still in pending_label / ready_for_dispatch.

Run:  cd /var/www/crm/backend && ./venv/bin/python migrations/cleanup_stale_dispatch_queue.py
"""
import asyncio
import os
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

ACTIVE = {"$in": ["pending_label", "ready_for_dispatch"]}
HAS_TRACKING = {"$nin": [None, ""]}
NOTE = "Stale dispatch-queue cleanup 2026-05-29"


async def main():
    now = datetime.now(timezone.utc).isoformat()

    # Safety re-check: refuse to run if any target deducted stock or hit the ledger.
    risky = await db.dispatches.count_documents(
        {"status": ACTIVE, "$or": [{"stock_deducted": True},
                                   {"ledger_entry_id": {"$nin": [None, ""]}}]}
    )
    if risky:
        print(f"ABORT: {risky} target dispatch(es) have stock/ledger side-effects; "
              f"resolve manually so inventory/accounting stays correct.")
        return

    # Group A: anything with a tracking_id -> shipped -> dispatched.
    shipped = await db.dispatches.update_many(
        {"status": ACTIVE, "tracking_id": HAS_TRACKING},
        {"$set": {"status": "dispatched", "dispatched_at": now,
                  "updated_at": now, "cleanup_note": NOTE}},
    )

    # Group B: pending_label with no tracking -> abandoned -> cancelled.
    cancelled = await db.dispatches.update_many(
        {"status": "pending_label", "tracking_id": {"$in": [None, ""]}},
        {"$set": {"status": "cancelled", "cancelled_at": now, "updated_at": now,
                  "cancel_reason": "Never labelled/shipped; stale >26d",
                  "cleanup_note": NOTE}},
    )

    print(f"marked dispatched (had tracking): {shipped.modified_count}")
    print(f"cancelled (pending_label, no tracking): {cancelled.modified_count}")

    remaining = await db.dispatches.count_documents({"status": ACTIVE})
    print(f"active queue remaining (pending_label + ready_for_dispatch): {remaining}")


asyncio.run(main())

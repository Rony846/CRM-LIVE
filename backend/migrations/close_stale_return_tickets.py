"""One-off: close stale walk-in repair-return tickets stuck in ready_for_dispatch.

Walk-in repaired units awaiting return show in the dispatcher queue as tickets in
status 'ready_for_dispatch'. A few had been sitting there >30 days. We can't prove
the unit was physically returned (no tracking on these), so we mark them 'closed'
with an explicit cleanup note rather than fabricating a delivery — this clears the
queue while keeping the record honest.

Scope: tickets with status='ready_for_dispatch' AND created_at older than 30 days.
A prior check confirmed the targets carry no service_charges / service_invoice, so
closing them strands no billing.

Idempotent: only touches matching ready_for_dispatch tickets.

Run:  cd /var/www/crm/backend && ./venv/bin/python migrations/close_stale_return_tickets.py
"""
import asyncio
import os
from datetime import datetime, timezone, timedelta

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

NOTE = "Closed by stale return-queue cleanup 2026-05-29 (>30d in ready_for_dispatch, no billing pending)"


async def main():
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=30)).isoformat()

    targets = await db.tickets.find(
        {"status": "ready_for_dispatch", "created_at": {"$lt": cutoff}},
        {"_id": 0, "id": 1, "ticket_number": 1, "service_charges": 1, "service_invoice": 1},
    ).to_list(1000)

    # Safety: don't auto-close anything with pending billing.
    billed = [t["ticket_number"] for t in targets
              if t.get("service_charges") or t.get("service_invoice")]
    if billed:
        print(f"ABORT: these have billing attached, close manually: {billed}")
        return

    history_entry = {
        "action": "Closed (stale return-queue cleanup)",
        "by": "System",
        "by_id": "system",
        "by_role": "system",
        "timestamp": now.isoformat(),
        "details": {"note": NOTE},
    }

    closed = 0
    for t in targets:
        await db.tickets.update_one(
            {"id": t["id"]},
            {"$set": {"status": "closed", "closed_at": now.isoformat(),
                      "closed_by_name": "System (cleanup)", "updated_at": now.isoformat(),
                      "cleanup_note": NOTE},
             "$push": {"history": history_entry}},
        )
        closed += 1
        print(f"  closed {t['ticket_number']}")

    remaining = await db.tickets.count_documents({"status": "ready_for_dispatch"})
    print(f"\nclosed: {closed} | ready_for_dispatch tickets remaining: {remaining}")


asyncio.run(main())

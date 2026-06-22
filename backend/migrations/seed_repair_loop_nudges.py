"""
First-enable seeding for the repair-loop agent.

Problem: when REPAIR_LOOP_ENABLED is first switched on, every ticket already
sitting in assigned_to_technician / in_repair / in_progress is "due" for a
follow-up at once. The loop has a self-guard (it seeds a baseline on first
contact instead of nudging), which prevents an *immediate* burst — but without
staggering, that whole backlog would then come due together one cadence later.

This script staggers `repair_loop.last_nudge_at` across a window so the backlog
trickles out (≈1–2 nudges per 30-min cycle) instead of clumping.

Run it RIGHT BEFORE setting REPAIR_LOOP_ENABLED=true (timestamps are relative to
now). Idempotent: only seeds tickets that don't already have a
repair_loop.last_nudge_at, so re-running won't disturb live state.

    python backend/migrations/seed_repair_loop_nudges.py              # dry run (default)
    python backend/migrations/seed_repair_loop_nudges.py --apply      # write
    python backend/migrations/seed_repair_loop_nudges.py --apply --window-hours 12
"""
import argparse
import os
from datetime import datetime, timezone, timedelta

from pymongo import MongoClient

IN_REPAIR_STATUSES = ["assigned_to_technician", "in_repair", "in_progress"]


def _load_env(path: str) -> dict:
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    env = _load_env(os.path.join(here, "..", ".env"))
    nudge_hours = int(env.get("REPAIR_LOOP_NUDGE_HOURS", "24") or 24)

    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--window-hours", type=float, default=float(nudge_hours),
                    help="spread the backlog's first nudges across this many hours (default: NUDGE_HOURS)")
    args = ap.parse_args()

    db = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]
    now = datetime.now(timezone.utc)

    # Backlog tickets that the loop would nudge, not yet seeded.
    q = {
        "status": {"$in": IN_REPAIR_STATUSES},
        "assigned_to": {"$nin": [None, ""]},
        "repair_loop.last_nudge_at": {"$in": [None, ""]},
    }
    tickets = list(
        db.tickets.find(q, {"_id": 0, "id": 1, "ticket_number": 1, "status": 1, "updated_at": 1})
        .sort("updated_at", 1)  # oldest-waiting first → comes due soonest
    )
    n = len(tickets)
    print(f"REPAIR_LOOP_NUDGE_HOURS = {nudge_hours}h | stagger window = {args.window_hours}h")
    print(f"Backlog tickets to seed: {n}")
    if n == 0:
        print("Nothing to seed. (Either already seeded, or no in-repair backlog.)")
        return

    # Spread so ticket i becomes due at now + (i+1)/n * window. A ticket is "due"
    # when last_nudge_at <= run_time - nudge_hours, so set:
    #   last_nudge_at_i = (now + (i+1)/n * window) - nudge_hours
    written = 0
    for i, t in enumerate(tickets):
        next_due = now + timedelta(hours=(i + 1) / n * args.window_hours)
        last_nudge_at = (next_due - timedelta(hours=nudge_hours)).isoformat()
        due_in_min = round((next_due - now).total_seconds() / 60)
        if i < 5 or i >= n - 2:
            print(f"  {t.get('ticket_number','?')} [{t.get('status')}] → first nudge in ~{due_in_min} min")
        elif i == 5:
            print(f"  … ({n - 7} more) …")
        if args.apply:
            db.tickets.update_one(
                {"id": t["id"]},
                {"$set": {"repair_loop.last_nudge_at": last_nudge_at,
                          "repair_loop.nudge_count": 0,
                          "repair_loop.seeded_at": now.isoformat()}},
            )
            written += 1

    if args.apply:
        print(f"\nAPPLIED: seeded {written} tickets. Now set REPAIR_LOOP_ENABLED=true and restart the backend.")
    else:
        print(f"\nDRY RUN — no changes written. Re-run with --apply to seed, then enable the flag.")


if __name__ == "__main__":
    main()

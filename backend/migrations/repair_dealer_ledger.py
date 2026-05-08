"""One-shot: create missing party_ledger entries for already-confirmed
dealer payments and approved security deposits. Safe to re-run.

Scans:
 - dealer_orders with payment_status=received but no ledger entry
 - dealers with security_deposit_status=approved but no ledger entry
Writes the missing entries and updates parties.current_balance.
"""
import asyncio, os, uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ.get("DB_NAME", "test_database")]


def _gen_entry_number(counter):
    return f"LED-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{counter:05d}"


async def _last_running_balance(party_id, party):
    last = await db.party_ledger.find_one({"party_id": party_id}, sort=[("created_at", -1)])
    if last:
        return last.get("running_balance", 0)
    return party.get("current_balance", 0) or party.get("opening_balance", 0) or 0


async def repair_payments():
    repaired = skipped = no_party = 0
    counter = 1
    async for order in db.dealer_orders.find({"payment_status": "received"}):
        order_id = order.get("id") or str(order.get("_id"))
        existing = await db.party_ledger.find_one({
            "reference_type": "dealer_order_payment",
            "reference_id": order_id,
        })
        if existing:
            skipped += 1
            continue
        party = await db.parties.find_one({"dealer_id": order.get("dealer_id")})
        if not party:
            no_party += 1
            print(f"  SKIP: no party for dealer_id={order.get('dealer_id')} (order {order.get('order_number')})")
            continue
        prev = await _last_running_balance(party["id"], party)
        credit = order.get("total_amount", 0)
        now = datetime.now(timezone.utc).isoformat()
        entry = {
            "id": str(uuid.uuid4()),
            "entry_number": _gen_entry_number(counter),
            "party_id": party["id"],
            "party_name": party["name"],
            "date": order.get("payment_received_at") or now[:10],
            "entry_type": "receipt",
            "reference_type": "dealer_order_payment",
            "reference_id": order_id,
            "description": f"[repair] Payment for order {order.get('order_number', order_id)}",
            "credit_amount": credit,
            "debit_amount": 0,
            "running_balance": prev + credit,
            "created_by": "system-repair",
            "created_at": now,
        }
        await db.party_ledger.insert_one(entry)
        await db.parties.update_one({"id": party["id"]}, {"$set": {"current_balance": prev + credit, "updated_at": now}})
        repaired += 1
        counter += 1
        print(f"  REPAIRED: {party['name']} order {order.get('order_number')} credit {credit} -> running {prev + credit}")
    return repaired, skipped, no_party


async def repair_deposits():
    repaired = skipped = no_party = 0
    counter = 10001
    async for dealer in db.dealers.find({"security_deposit_status": "approved"}):
        dealer_id = dealer.get("id") or str(dealer.get("_id"))
        existing = await db.party_ledger.find_one({
            "reference_type": "security_deposit",
            "reference_id": dealer_id,
        })
        if existing:
            skipped += 1
            continue
        party = await db.parties.find_one({"dealer_id": dealer_id})
        if not party:
            no_party += 1
            print(f"  SKIP: no party for dealer_id={dealer_id} ({dealer.get('firm_name')})")
            continue
        prev = await _last_running_balance(party["id"], party)
        credit = dealer.get("security_deposit_amount", 0) or 0
        if credit == 0:
            skipped += 1
            continue
        now = datetime.now(timezone.utc).isoformat()
        entry = {
            "id": str(uuid.uuid4()),
            "entry_number": _gen_entry_number(counter),
            "party_id": party["id"],
            "party_name": party["name"],
            "date": dealer.get("security_deposit_approved_at", now)[:10],
            "entry_type": "receipt",
            "reference_type": "security_deposit",
            "reference_id": dealer_id,
            "description": f"[repair] Security deposit from dealer {dealer.get('firm_name')}",
            "credit_amount": credit,
            "debit_amount": 0,
            "running_balance": prev + credit,
            "created_by": "system-repair",
            "created_at": now,
        }
        await db.party_ledger.insert_one(entry)
        await db.parties.update_one({"id": party["id"]}, {"$set": {"current_balance": prev + credit, "updated_at": now}})
        repaired += 1
        counter += 1
        print(f"  REPAIRED: {party['name']} deposit {credit} -> running {prev + credit}")
    return repaired, skipped, no_party


async def main():
    print("=== Repairing missing dealer payment ledger entries ===")
    p_rep, p_skip, p_no = await repair_payments()
    print(f"\nPayments: repaired={p_rep}, already-had-entry={p_skip}, no-party={p_no}")

    print("\n=== Repairing missing security deposit ledger entries ===")
    d_rep, d_skip, d_no = await repair_deposits()
    print(f"Deposits: repaired={d_rep}, already-had-entry={d_skip}, no-party={d_no}")

    print(f"\nTotal new ledger entries: {p_rep + d_rep}")


if __name__ == "__main__":
    asyncio.run(main())

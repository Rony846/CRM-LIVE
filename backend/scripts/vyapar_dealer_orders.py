#!/usr/bin/env python3
"""Step 2: surface Vyapar offline sales as dealer_orders for LINKED dealers, so they appear
in the dealer portal's "My Orders". Ledger is untouched (founder kept the bank-recon basis).

Only for dealers whose Vyapar party is linked (parties.dealer_id set + vyapar_key). Idempotent
(keyed by vyapar_txn_key; re-run is a no-op), reversible (source=vyapar). order_number is
namespaced "VYP/<txn_id>" to dodge dealer_orders' unique order_number index and Vyapar's
non-unique invoice numbers.

Usage: venv/bin/python scripts/vyapar_dealer_orders.py [--commit]
"""
import sys, uuid
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
COMMIT = "--commit" in sys.argv
NOW = datetime.now(timezone.utc).isoformat()

linked = {p["id"]: p for p in db.parties.find(
    {"dealer_id": {"$nin": [None, ""]}, "vyapar_key": {"$exists": True}},
    {"_id": 0, "id": 1, "dealer_id": 1, "name": 1})}

if COMMIT:
    db.dealer_orders.create_index("vyapar_txn_key", unique=True, sparse=True)

new = skip = 0
for s in db.vyapar_sales.find({"party_id": {"$in": list(linked)}}, {"_id": 0}):
    key = s.get("vyapar_txn_key")
    if not key:
        continue
    if db.dealer_orders.find_one({"vyapar_txn_key": key}, {"_id": 1}):
        skip += 1
        continue
    new += 1
    if COMMIT:
        txn_id = key.split(":")[-1]
        bal = s.get("balance_due") or 0
        paid = s.get("amount_paid") or 0
        pstatus = "paid" if bal <= 0 else ("partial" if paid > 0 else "pending")
        db.dealer_orders.insert_one({
            "id": str(uuid.uuid4()), "dealer_id": linked[s["party_id"]]["dealer_id"],
            "order_number": f"VYP/{txn_id}", "items": s.get("items", []),
            "total_amount": s.get("grand_total") or 0, "balance_due": bal, "amount_paid": paid,
            "payment_status": pstatus, "status": "completed", "channel": "offline",
            "source": "vyapar", "vyapar_txn_key": key, "vyapar_invoice_number": s.get("invoice_number"),
            "created_at": s.get("invoice_date") or NOW, "updated_at": NOW})

print(f"{'COMMITTED' if COMMIT else 'DRY-RUN'} — Vyapar offline sales → dealer_orders")
print(f"  linked dealers:        {len(set(p['dealer_id'] for p in linked.values()))}")
print(f"  orders to surface:     {new}")
print(f"  already surfaced (skip): {skip}")

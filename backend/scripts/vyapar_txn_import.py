#!/usr/bin/env python3
"""Import Vyapar OFFLINE sales (txn_type=1) -> sales_invoices and purchases (txn_type=2)
-> purchases. Source-tagged 'vyapar', keyed by vyapar_txn_key (idempotent, reversible),
party-linked via the vyapar_key stamped on db.parties. Vyapar is authoritative for offline,
and Amazon is NOT in Vyapar (kept additive) so there's no double-count.

Usage: venv/bin/python scripts/vyapar_txn_import.py <path.vyp> [--commit]
"""
import sys, sqlite3, uuid
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
DBP = next((a for a in sys.argv[1:] if a.endswith(".vyp")), None)
COMMIT = "--commit" in sys.argv
FIRM_GSTIN = "07AATCM1213F1ZM"
NOW = datetime.now(timezone.utc).isoformat()

firm = db.firms.find_one({"gstin": FIRM_GSTIN}) or db.firms.find_one({"gstin_number": FIRM_GSTIN}) \
    or db.firms.find_one({"name": {"$regex": "MUSCLEGRID INDUSTRIES PRIVATE", "$options": "i"}})
FIRM_ID = (firm or {}).get("id")
FIRM_NAME = (firm or {}).get("name", "MUSCLEGRID INDUSTRIES PRIVATE LIMITED")

# party lookup: vyapar name_id -> CRM party
party_by_vid = {}
for p in db.parties.find({"vyapar_key": {"$regex": f"^{FIRM_GSTIN}:"}}, {"_id": 0, "id": 1, "name": 1, "vyapar_key": 1, "gstin": 1, "address": 1}):
    try:
        vid = int(p["vyapar_key"].split(":")[1])
        party_by_vid[vid] = p
    except (ValueError, IndexError):
        pass

con = sqlite3.connect(DBP); con.row_factory = sqlite3.Row
cur = con.cursor()
items = {r["item_id"]: r["item_name"] for r in cur.execute("SELECT item_id, item_name FROM kb_items")}


def lineitems(txn_id):
    out = []
    for li in cur.execute("SELECT item_id, quantity, priceperunit, total_amount, lineitem_tax_amount, lineitem_description FROM kb_lineitems WHERE lineitem_txn_id=?", (txn_id,)):
        out.append({"name": items.get(li["item_id"], li["lineitem_description"] or "Item"),
                    "quantity": li["quantity"], "rate": round(li["priceperunit"] or 0, 2),
                    "amount": li["total_amount"], "tax": li["lineitem_tax_amount"]})
    return out


def do(txn_type, coll):
    rows = cur.execute("""SELECT txn_id, txn_name_id, txn_date, txn_ref_number_char, txn_cash_amount,
                          txn_balance_amount, txn_tax_amount, txn_discount_amount, txn_description, txn_date_modified
                          FROM kb_transactions WHERE txn_type=?""", (txn_type,)).fetchall()
    new = upd = noparty = 0
    for t in rows:
        key = f"{FIRM_GSTIN}:txn:{t['txn_id']}"
        party = party_by_vid.get(t["txn_name_id"])
        if not party:
            noparty += 1
        total = round((t["txn_cash_amount"] or 0) + (t["txn_balance_amount"] or 0), 2)
        doc = {
            "vyapar_txn_key": key, "source": "vyapar", "firm_id": FIRM_ID, "firm_name": FIRM_NAME,
            "firm_gstin": FIRM_GSTIN, "party_id": (party or {}).get("id"),
            "party_name": (party or {}).get("name"), "party_gstin": (party or {}).get("gstin"),
            "invoice_number": t["txn_ref_number_char"], "invoice_date": t["txn_date"],
            "items": lineitems(t["txn_id"]), "grand_total": total, "gst_amount": t["txn_tax_amount"] or 0,
            "discount": t["txn_discount_amount"] or 0, "amount_paid": t["txn_cash_amount"] or 0,
            "balance_due": t["txn_balance_amount"] or 0, "notes": t["txn_description"] or "",
            "doc_status": "vyapar_imported", "vyapar_txn_modified": t["txn_date_modified"], "updated_at": NOW,
        }
        if COMMIT:
            existing = db[coll].find_one({"vyapar_txn_key": key}, {"_id": 1, "id": 1})
            if existing:
                db[coll].update_one({"vyapar_txn_key": key}, {"$set": doc}); upd += 1
            else:
                doc["id"] = str(uuid.uuid4()); doc["created_at"] = NOW
                db[coll].insert_one(doc); new += 1
        else:
            if db[coll].find_one({"vyapar_txn_key": key}, {"_id": 1}):
                upd += 1
            else:
                new += 1
    return len(rows), new, upd, noparty


print(f"{'COMMIT' if COMMIT else 'DRY-RUN'} | firm_id={FIRM_ID} | parties linked={len(party_by_vid)}")
if COMMIT:
    # dedicated, source-tagged collections (avoid sales_invoices' unique invoice_number index
    # and keep Vyapar offline data cleanly reconcilable). Unique key = idempotent re-runs.
    db.vyapar_sales.create_index("vyapar_txn_key", unique=True)
    db.vyapar_purchases.create_index("vyapar_txn_key", unique=True)
for tt, coll, label in [(1, "vyapar_sales", "SALES"), (2, "vyapar_purchases", "PURCHASES")]:
    n, new, upd, np = do(tt, coll)
    print(f"  {label:10} ({coll}): {n} txns -> {new} new, {upd} update, {np} with no matched party")
con.close()

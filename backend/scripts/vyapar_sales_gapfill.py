#!/usr/bin/env python3
"""Gap-fill: bridge db.vyapar_sales -> db.sales_invoices ONLY for MGIPL months that have no
other sales_invoices record yet (the current-month Vyapar gap). Safe: never touches months that
already carry an authoritative import (Vyapar bulk / GSTR-1 / Amazon), so it can't double-count.

Self-retiring + idempotent: each run deletes its own prior gap-fill rows, recomputes which months
are still uncovered (by NON-gap-fill sources), and re-inserts current vyapar_sales for those only.
When a month later receives a real import (e.g. GSTR-1), it drops out of the gap set and its
gap-fill rows are removed on the next run.

Full Vyapar source-of-truth reconciliation (GSTR-1 vs Vyapar vs vyapar_import per firm-month) is a
separate Project-X task; see scripts/vyapar_sales_bridge.py (dry-run only, do not commit as-is).

Usage: vyapar_sales_gapfill.py            # DRY RUN
       vyapar_sales_gapfill.py --commit
"""
import sys, uuid
from datetime import datetime, timezone
from collections import defaultdict
from pymongo import MongoClient, ASCENDING
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
COMMIT = "--commit" in sys.argv
NOW = datetime.now(timezone.utc).isoformat()
FIRM = "MGIPL"
SRC = "vyapar_sales_gapfill"


def vmonth(d):
    return str(d.get("invoice_date") or d.get("created_at") or "")[:7]


# Months already covered by a REAL (non-gap-fill) sales_invoices record for MGIPL.
covered = set()
for r in db.sales_invoices.aggregate([
    {"$match": {"firm_name": FIRM, "source": {"$ne": SRC}}},
    {"$addFields": {"_m": {"$substr": [{"$ifNull": ["$invoice_date", "$created_at"]}, 0, 7]}}},
    {"$group": {"_id": "$_m"}},
]):
    if r["_id"]:
        covered.add(r["_id"])

# vyapar_sales rows in uncovered months -> the gap to fill.
used = defaultdict(int)
docs, fill_months = [], defaultdict(lambda: [0, 0.0])
for v in db.vyapar_sales.find({}):
    mo = vmonth(v)
    if not mo or mo in covered:
        continue
    raw = str(v.get("invoice_number") or "").strip() or v.get("vyapar_txn_key")
    inv = f"{v.get('firm_name') or FIRM}/{raw}"
    used[inv] += 1
    if used[inv] > 1:
        inv = f"{inv}-{used[inv]}"
    gt = float(v.get("grand_total") or 0)
    gst = float(v.get("gst_amount") or 0)
    paid = float(v.get("amount_paid") or 0)
    bal = float(v.get("balance_due") or 0)
    fill_months[mo][0] += 1
    fill_months[mo][1] += gt
    docs.append({
        "id": str(uuid.uuid4()), "source": SRC, "source_txn_key": v.get("vyapar_txn_key"),
        "invoice_number": inv, "source_invoice_number": raw,
        "firm_id": v.get("firm_id"), "firm_name": v.get("firm_name"), "firm_gstin": v.get("firm_gstin"),
        "party_id": v.get("party_id"), "party_name": v.get("party_name"), "party_gstin": v.get("party_gstin"),
        "invoice_date": v.get("invoice_date"), "items": v.get("items"),
        "taxable_value": round(gt - gst, 2), "total_gst": gst, "grand_total": gt,
        "amount_paid": paid, "balance_due": bal,
        "payment_status": "paid" if bal <= 0 else ("partial" if paid > 0 else "unpaid"),
        "status": "final", "doc_status": "complete", "order_source": "vyapar",
        "notes": "Provisional gap-fill from db.vyapar_sales (retires when an authoritative import lands).",
        "created_by_name": "Vyapar gap-fill (Claude)", "created_at": NOW, "updated_at": NOW,
    })

# collision check against rows we keep (exclude our own gap-fill rows, which get deleted)
new_invs = [d["invoice_number"] for d in docs]
collide = db.sales_invoices.count_documents({"invoice_number": {"$in": new_invs}, "source": {"$ne": SRC}}) if new_invs else 0

print(f"{'COMMIT' if COMMIT else 'DRY-RUN'}  (Vyapar gap-fill)\n")
print(f"MGIPL months already covered by a real import: {len(covered)} (kept untouched)")
print(f"Gap months to fill from vyapar_sales:")
for mo in sorted(fill_months):
    n, rev = fill_months[mo]
    print(f"   {mo}: {n} invoices  ₹{rev:,.0f}")
print(f"Total to insert: {len(docs)} rows  |  invoice# collisions with kept rows: {collide} {'<-- BLOCKER' if collide else '(clean)'}")

if COMMIT:
    if collide:
        print("\nABORT: collisions with kept rows."); sys.exit(1)
    db.sales_invoices.create_index([("source_txn_key", ASCENDING)], sparse=True)
    d = db.sales_invoices.delete_many({"source": SRC, "firm_name": FIRM})
    ins = db.sales_invoices.insert_many(docs, ordered=False) if docs else None
    print(f"\nCOMMITTED: cleared {d.deleted_count} prior gap-fill rows, inserted {len(ins.inserted_ids) if ins else 0}.")
else:
    print("\n(dry-run — no writes.)")

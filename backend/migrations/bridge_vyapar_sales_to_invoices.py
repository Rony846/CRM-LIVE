#!/usr/bin/env python3
"""Bridge imported Vyapar OFFLINE sales (db.vyapar_sales, written by scripts/vyapar_txn_import.py
from the .vyb backup) into CRM-native db.sales_invoices, so the executive dashboard — which reads
ONLY sales_invoices — reflects book sales raised in Vyapar.

Why this exists: the newer Vyapar pipeline lands in db.vyapar_sales, while the older
convert_vyapar_to_sales_invoices.py reads db.vyapar_vouchers. The dashboard reads neither directly —
it sums sales_invoices.grand_total. This bridges the gap for the vyapar_sales path.

Safe by construction:
  - idempotent + reversible: keyed on source_txn_key = the Vyapar txn key; re-runs update in place.
  - no collisions: invoice_number is namespaced (firm short / original) and checked against the
    GLOBAL unique index on sales_invoices.invoice_number.
  - marked PAID (balance_due=0) like the established vyapar_import convention, so it never creates
    phantom receivables. grand_total is carried VERBATIM from Vyapar (the authoritative figure).

Usage:
  venv/bin/python migrations/bridge_vyapar_sales_to_invoices.py [period] [--commit]
    period  optional 'YYYY-MM' (e.g. 2026-06); omit for ALL months in vyapar_sales.
  Reverse: ...bridge_vyapar_sales_to_invoices.py --reverse [period] --commit
"""
import sys
import uuid
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
NOW = datetime.now(timezone.utc).isoformat()
SOURCE = "vyapar_offline_bridge"

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
PERIOD = ARGS[0] if ARGS else None
COMMIT = "--commit" in sys.argv
REVERSE = "--reverse" in sys.argv


def short(name):
    import re
    return (re.sub(r"[^A-Za-z0-9]", "", str(name or "")).upper()[:5]) or "VYP"


def reverse():
    q = {"source": SOURCE}
    if PERIOD:
        q["invoice_date"] = {"$regex": f"^{PERIOD}"}
    n = db.sales_invoices.count_documents(q)
    print(f"{'COMMIT' if COMMIT else 'DRY-RUN'} reverse: {n} bridged invoices to delete (source={SOURCE}"
          + (f", {PERIOD}" if PERIOD else "") + ")")
    if COMMIT and n:
        db.sales_invoices.delete_many(q)
        print(f"*** DELETED {n} ***")


def run():
    q = {}
    if PERIOD:
        q["invoice_date"] = {"$regex": f"^{PERIOD}"}
    rows = list(db.vyapar_sales.find(q))
    # global unique-number guard
    taken = {(s.get("invoice_number") or "").strip()
             for s in db.sales_invoices.find({}, {"invoice_number": 1})}
    new = upd = 0
    gross = 0.0
    for r in rows:
        key = r.get("vyapar_txn_key")
        if not key:
            continue
        existing = db.sales_invoices.find_one({"source_txn_key": key}, {"_id": 1, "invoice_number": 1})
        gt = round(r.get("grand_total") or 0, 2)
        gst = round(r.get("gst_amount") or 0, 2)
        gross += gt
        if existing:
            inv = existing.get("invoice_number")
            upd += 1
        else:
            orig = (r.get("invoice_number") or "").strip()
            inv = f"{short(r.get('firm_name'))}/{orig}" if orig else f"{short(r.get('firm_name'))}/{uuid.uuid4().hex[:8]}"
            k = 1
            base = inv
            while inv in taken:
                inv = f"{base}#{k}"; k += 1
            taken.add(inv)
            new += 1
        doc = {
            "source": SOURCE, "source_txn_key": key,
            "invoice_number": inv, "source_invoice_number": (r.get("invoice_number") or "").strip(),
            "firm_id": r.get("firm_id"), "firm_name": r.get("firm_name"), "firm_gstin": r.get("firm_gstin"),
            "party_id": r.get("party_id"), "party_name": r.get("party_name"), "party_gstin": r.get("party_gstin"),
            "invoice_date": r.get("invoice_date"), "items": r.get("items") or [],
            "taxable_value": round(gt - gst, 2), "total_gst": gst, "grand_total": gt,
            "payment_status": "paid", "amount_paid": gt, "balance_due": 0,
            "status": "final", "doc_status": "complete", "order_source": "vyapar",
            "notes": "Bridged from Vyapar offline sales (db.vyapar_sales). Marked paid — no AR intent.",
            "created_by_name": "Vyapar offline bridge (Claude)", "updated_at": NOW,
        }
        if COMMIT:
            if existing:
                db.sales_invoices.update_one({"source_txn_key": key}, {"$set": doc})
            else:
                doc["id"] = str(uuid.uuid4()); doc["created_at"] = NOW
                db.sales_invoices.insert_one(doc)
    print(f"{'COMMIT' if COMMIT else 'DRY-RUN'} | {PERIOD or 'all months'}: {len(rows)} vyapar_sales "
          f"-> {new} new, {upd} update | gross Rs {gross:,.0f}")
    if not COMMIT:
        print("(dry-run — add --commit to write)")


if __name__ == "__main__":
    (reverse if REVERSE else run)()

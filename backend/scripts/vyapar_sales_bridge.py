#!/usr/bin/env python3
"""Bridge db.vyapar_sales -> db.sales_invoices as the SOURCE OF TRUTH for MGIPL Vyapar sales.

Why: the executive dashboard + accounting reports read sales_invoices, but the daily Vyapar
drive-sync writes only vyapar_sales. Older MGIPL Vyapar rows in sales_invoices (source
vyapar_import / vyapar_offline_bridge) are a stale, partial snapshot. Per founder decision,
vyapar_sales is authoritative: remove the old MGIPL Vyapar rows and re-insert the full current
vyapar_sales, namespacing invoice_number as {firm}/{raw} to satisfy the unique invoice_number index.

Idempotent: keyed by source_txn_key. Re-running replaces cleanly.
Usage: vyapar_sales_bridge.py            # DRY RUN (no writes) — prints before/after
       vyapar_sales_bridge.py --commit   # apply
"""
import sys, os, uuid
from datetime import datetime, timezone
from collections import defaultdict
from pymongo import MongoClient, ASCENDING
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
COMMIT = "--commit" in sys.argv
NOW = datetime.now(timezone.utc).isoformat()
FIRM = "MGIPL"                                   # vyapar_sales is MGIPL-only
VYAPAR_SRC_RE = {"$regex": "vyapar", "$options": "i"}
NEW_SRC = "vyapar_sales_sot"


def month_sums(coll, match=None):
    """grand_total by YYYY-MM for a collection (optionally filtered)."""
    pipe = []
    if match:
        pipe.append({"$match": match})
    pipe += [
        {"$addFields": {"_m": {"$substr": [{"$ifNull": ["$invoice_date", "$created_at"]}, 0, 7]}}},
        {"$group": {"_id": "$_m", "rev": {"$sum": {"$ifNull": ["$grand_total", 0]}}, "n": {"$sum": 1}}},
    ]
    return {r["_id"]: (round(r["rev"], 0), r["n"]) for r in db[coll].aggregate(pipe)}


def total(coll, match=None):
    pipe = ([{"$match": match}] if match else []) + [{"$group": {"_id": None, "rev": {"$sum": {"$ifNull": ["$grand_total", 0]}}, "n": {"$sum": 1}}}]
    r = list(db[coll].aggregate(pipe))
    return (round(r[0]["rev"], 0), r[0]["n"]) if r else (0, 0)


# ---- removal set: MGIPL Vyapar-origin rows currently in sales_invoices ----
remove_q = {"firm_name": FIRM, "source": VYAPAR_SRC_RE}
rem_rev, rem_n = total("sales_invoices", remove_q)

# ---- build the new docs from vyapar_sales ----
used = defaultdict(int)
docs = []
vs = list(db.vyapar_sales.find({}))
for v in vs:
    raw = str(v.get("invoice_number") or "").strip() or v.get("vyapar_txn_key")
    inv = f"{v.get('firm_name') or FIRM}/{raw}"
    used[inv] += 1
    if used[inv] > 1:                            # guard against duplicate raw numbers
        inv = f"{inv}-{used[inv]}"
    gt = float(v.get("grand_total") or 0)
    gst = float(v.get("gst_amount") or 0)
    paid = float(v.get("amount_paid") or 0)
    bal = float(v.get("balance_due") or 0)
    docs.append({
        "id": str(uuid.uuid4()), "source": NEW_SRC, "source_txn_key": v.get("vyapar_txn_key"),
        "invoice_number": inv, "source_invoice_number": raw,
        "firm_id": v.get("firm_id"), "firm_name": v.get("firm_name"), "firm_gstin": v.get("firm_gstin"),
        "party_id": v.get("party_id"), "party_name": v.get("party_name"), "party_gstin": v.get("party_gstin"),
        "invoice_date": v.get("invoice_date"), "items": v.get("items"),
        "taxable_value": round(gt - gst, 2), "total_gst": gst, "grand_total": gt,
        "amount_paid": paid, "balance_due": bal,
        "payment_status": "paid" if bal <= 0 else ("partial" if paid > 0 else "unpaid"),
        "status": "final", "doc_status": "complete", "order_source": "vyapar",
        "notes": "Bridged from db.vyapar_sales (source of truth).",
        "created_by_name": "Vyapar SoT bridge (Claude)",
        "created_at": NOW, "updated_at": NOW,
    })

new_rev = round(sum(d["grand_total"] for d in docs), 0)

# ---- collision check: do namespaced invoice numbers hit rows we are NOT removing? ----
new_invs = [d["invoice_number"] for d in docs]
keep_ids = set()
collide = 0
existing = db.sales_invoices.find({"invoice_number": {"$in": new_invs}}, {"invoice_number": 1, "firm_name": 1, "source": 1})
for e in existing:
    # rows in the removal set will be deleted first, so they don't count as collisions
    if not (e.get("firm_name") == FIRM and e.get("source") and "vyapar" in str(e["source"]).lower()):
        collide += 1

# ---- report ----
print(f"{'COMMIT' if COMMIT else 'DRY-RUN'}  (Vyapar SoT bridge)\n")
tot_before = total("sales_invoices")
print(f"sales_invoices TOTAL now:      ₹{tot_before[0]:,.0f}  ({tot_before[1]} rows)")
print(f"  REMOVE MGIPL Vyapar-origin:  ₹{rem_rev:,.0f}  ({rem_n} rows)")
print(f"  INSERT from vyapar_sales:    ₹{new_rev:,.0f}  ({len(docs)} rows)")
print(f"  net change:                  ₹{new_rev - rem_rev:+,.0f}  ({len(docs) - rem_n:+d} rows)")
print(f"  invoice# collisions w/ kept rows: {collide}  {'<-- BLOCKER' if collide else '(clean)'}")

print("\nMGIPL monthly grand_total  [current sales_invoices -> after bridge]:")
si_m = month_sums("sales_invoices", {"firm_name": FIRM})
si_keep_m = month_sums("sales_invoices", {"firm_name": FIRM, "source": {"$not": VYAPAR_SRC_RE}})
vs_m = month_sums("vyapar_sales")
for mo in ["2026-04", "2026-05", "2026-06", "2026-07"]:
    before = si_m.get(mo, (0, 0))
    after_rev = si_keep_m.get(mo, (0, 0))[0] + vs_m.get(mo, (0, 0))[0]
    after_n = si_keep_m.get(mo, (0, 0))[1] + vs_m.get(mo, (0, 0))[1]
    print(f"  {mo}: ₹{before[0]:,.0f} ({before[1]}) -> ₹{after_rev:,.0f} ({after_n})")

# dashboard-style all-firm this/last month
def allfirm_month(mo, keep_vyapar_mgipl=False):
    if keep_vyapar_mgipl:
        return total("sales_invoices", {"$expr": {"$eq": [{"$substr": [{"$ifNull": ["$invoice_date", "$created_at"]}, 0, 7]}, mo]}})
si_all = month_sums("sales_invoices")
si_all_keep = month_sums("sales_invoices", {"$or": [{"firm_name": {"$ne": FIRM}}, {"source": {"$not": VYAPAR_SRC_RE}}]})
print("\nALL-FIRM monthly (what the dashboard headline sums)  [now -> after]:")
for mo in ["2026-05", "2026-06", "2026-07"]:
    before = si_all.get(mo, (0, 0))
    after_rev = si_all_keep.get(mo, (0, 0))[0] + vs_m.get(mo, (0, 0))[0]
    after_n = si_all_keep.get(mo, (0, 0))[1] + vs_m.get(mo, (0, 0))[1]
    print(f"  {mo}: ₹{before[0]:,.0f} ({before[1]}) -> ₹{after_rev:,.0f} ({after_n})")

if COMMIT:
    if collide:
        print("\nABORT: invoice# collisions with kept rows — not committing.")
        sys.exit(1)
    db.sales_invoices.create_index([("source_txn_key", ASCENDING)], sparse=True)
    d = db.sales_invoices.delete_many(remove_q)
    # drop any prior SoT rows (idempotent re-run) then insert fresh
    db.sales_invoices.delete_many({"source": NEW_SRC})
    ins = db.sales_invoices.insert_many(docs, ordered=False)
    print(f"\nCOMMITTED: removed {d.deleted_count} old MGIPL Vyapar rows, inserted {len(ins.inserted_ids)} from vyapar_sales.")
else:
    print("\n(dry-run — no writes. Re-run with --commit to apply.)")

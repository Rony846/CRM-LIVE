#!/usr/bin/env python3
"""Sync Vyapar parties/dealers into the CRM (db.parties). Idempotent + reversible.

- Match key order: vyapar_key (prior import) -> GSTIN -> phone -> normalized name.
- Clean match  -> enrich missing fields (gstin/state/address), stamp vyapar_*; NEVER
  overwrite the bank-reconciled current_balance — store Vyapar's balance separately in
  `vyapar_balance` and flag material mismatches.
- Phone conflict (same party, different phone) -> enrich but DO NOT touch phone; record
  `vyapar_conflict` for the founder to decide.
- New -> create, source=vyapar.

Every touched/created doc carries vyapar_key + vyapar_synced_at, so a re-run updates
(never duplicates) and the whole import is findable/undoable.

Usage: venv/bin/python scripts/vyapar_party_sync.py <path_to.vyp>  [--commit]
Default is DRY-RUN (counts only). --commit performs the writes.
"""
import sys, re, sqlite3, uuid
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
DBP = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].endswith(".vyp") else None
COMMIT = "--commit" in sys.argv
FIRM_GSTIN = "07AATCM1213F1ZM"  # MGIPL Delhi (the Vyapar company)
BAL_TOL = 100.0  # ignore sub-₹100 balance diffs (rounding)
NOW = datetime.now(timezone.utc).isoformat()

nname = lambda s: re.sub(r'[^a-z0-9]', '', (s or '').lower())
def nphone(s):
    d = re.sub(r'\D', '', str(s or '')); return d[-10:] if len(d) >= 10 else ''
ngst = lambda s: re.sub(r'\s', '', (s or '').upper())

con = sqlite3.connect(DBP); con.row_factory = sqlite3.Row
vyp = con.execute("""SELECT name_id, full_name, phone_number, email, amount, address, name_gstin_number,
                     name_state, pincode, credit_limit, name_sub_type
                     FROM kb_names WHERE name_type=1 AND name_is_active=1""").fetchall()

# CRM lookups
by_key, by_g, by_p, by_n = {}, {}, {}, {}
for p in db.parties.find({}, {"_id": 0, "id": 1, "name": 1, "phone": 1, "gstin": 1, "gst_number": 1,
                              "current_balance": 1, "vyapar_key": 1, "address": 1, "state": 1}):
    if p.get("vyapar_key"):
        by_key[p["vyapar_key"]] = p
    g = ngst(p.get("gstin") or p.get("gst_number") or "")
    if len(g) == 15:
        by_g.setdefault(g, p)
    ph = nphone(p.get("phone"))
    if ph:
        by_p.setdefault(ph, p)
    nm = nname(p.get("name"))
    if nm:
        by_n.setdefault(nm, p)

created = enriched = conflicts = bal_flags = 0
conflict_list, bal_list = [], []
for v in vyp:
    key = f"{FIRM_GSTIN}:{v['name_id']}"
    g = ngst(v['name_gstin_number'] or ''); ph = nphone(v['phone_number']); nm = nname(v['full_name'])
    bal = float(v['amount'] or 0)
    m = by_key.get(key) or (by_g.get(g) if len(g) == 15 else None) or (by_p.get(ph) if ph else None) or by_n.get(nm)

    base = {"vyapar_key": key, "vyapar_balance": bal, "vyapar_synced_at": NOW,
            "vyapar_sub_type": v['name_sub_type']}
    if m:
        cur_bal = float(m.get("current_balance") or 0)
        enrich = dict(base)
        # fill only-missing identity fields (never clobber)
        if g and not ngst(m.get("gstin") or m.get("gst_number") or ""):
            enrich["gstin"] = v['name_gstin_number']
        if v['name_state'] and not m.get("state"):
            enrich["state"] = v['name_state']
        if v['address'] and not m.get("address"):
            enrich["address"] = v['address']
        # phone conflict?
        cph = nphone(m.get("phone"))
        if ph and cph and ph != cph:
            enrich["vyapar_conflict"] = {"type": "phone", "vyapar": ph, "crm": cph, "at": NOW}
            conflicts += 1; conflict_list.append((v['full_name'], ph, cph))
        # material balance mismatch (don't overwrite current_balance — just flag)
        if abs(bal - cur_bal) > BAL_TOL:
            enrich["vyapar_balance_mismatch"] = {"vyapar": bal, "crm": cur_bal, "diff": round(bal - cur_bal, 2)}
            bal_flags += 1
            if len(bal_list) < 10:
                bal_list.append((v['full_name'], bal, cur_bal))
        if COMMIT:
            db.parties.update_one({"id": m["id"]}, {"$set": enrich, "$addToSet": {"party_types": "vyapar"}})
        enriched += 1
    else:
        created += 1
        if COMMIT:
            doc = {"id": str(uuid.uuid4()), "name": v['full_name'], "phone": nphone(v['phone_number']),
                   "email": v['email'] or "", "gstin": v['name_gstin_number'] or "",
                   "address": v['address'] or "", "state": v['name_state'] or "", "pincode": str(v['pincode'] or ""),
                   "current_balance": bal, "opening_balance": bal, "credit_limit": v['credit_limit'] or 0,
                   "party_type": "customer", "party_types": ["vyapar"], "is_active": True,
                   "source": "vyapar", "created_at": NOW, "updated_at": NOW, **base}
            db.parties.insert_one(doc)

print(f"{'COMMITTED' if COMMIT else 'DRY-RUN'} — Vyapar parties: {len(vyp)}")
print(f"  created new      : {created}")
print(f"  enriched matched : {enriched}")
print(f"  phone conflicts (held, flagged): {conflicts}")
print(f"  balance mismatches flagged     : {bal_flags}")
print("\n  phone conflicts:")
for n, vp, cp in conflict_list:
    print(f"    {n}: vyapar {vp} vs crm {cp}")
print("\n  sample balance mismatches (Vyapar vs CRM):")
for n, vb, cb in bal_list:
    print(f"    {n}: ₹{vb:,.0f} vs ₹{cb:,.0f}")
con.close()

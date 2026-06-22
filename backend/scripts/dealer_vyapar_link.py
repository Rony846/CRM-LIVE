#!/usr/bin/env python3
"""Link dealer accounts (db.dealers) to their Vyapar party (db.parties, vyapar_key set)
so the dealer portal can surface their offline balance/orders/ledger.

High-confidence only: exact GSTIN/phone/normalized-name, OR fuzzy name (token Jaccard ≥ 0.6
after dropping generic words). Weak fuzzy (0.5) and any party already linked to a DIFFERENT
dealer are HELD (reported, never auto-linked). Test/junk dealers excluded.

Sets parties.dealer_id = dealer.id (+ dealer.party_id reverse link). Idempotent + reversible
(vyapar_dealer_linked_at stamp; re-running same input is a no-op).

Usage: venv/bin/python scripts/dealer_vyapar_link.py [--commit]
"""
import sys, re
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
COMMIT = "--commit" in sys.argv
NOW = datetime.now(timezone.utc).isoformat()
FUZZY_MIN = 0.6

def ng(s): return re.sub(r'\s', '', (s or '').upper())
def npn(s):
    d = re.sub(r'\D', '', str(s or '')); return d[-10:] if len(d) >= 10 else ''
def nn(s): return re.sub(r'[^a-z0-9]', '', (s or '').lower())
STOP = {"private", "limited", "pvt", "ltd", "llp", "the", "and", "co", "company", "enterprises",
        "enterprise", "solar", "electricals", "electronics", "energy", "solutions", "solution",
        "industries", "traders", "trading", "power", "distributors", "distributor", "ms"}
def toks(s): return {w for w in re.findall(r'[a-z0-9]+', (s or '').lower()) if len(w) >= 3 and w not in STOP}

vyp = list(db.parties.find({"vyapar_key": {"$exists": True}},
           {"_id": 0, "id": 1, "name": 1, "gstin": 1, "gst_number": 1, "phone": 1, "dealer_id": 1}))
by_g, by_p, by_n, vtok = {}, {}, {}, []
for p in vyp:
    g = ng(p.get("gstin") or p.get("gst_number") or "")
    if len(g) == 15:
        by_g.setdefault(g, p)
    ph = npn(p.get("phone"))
    if ph:
        by_p.setdefault(ph, p)
    by_n.setdefault(nn(p.get("name")), p)
    vtok.append((toks(p.get("name")), p))

def fuzzy(name):
    dt = toks(name)
    if not dt:
        return None, 0
    best, bestsc = None, 0
    for t, p in vtok:
        if not t:
            continue
        inter = dt & t
        if not inter:
            continue
        sc = len(inter) / len(dt | t)
        if sc > bestsc:
            bestsc, best = sc, p
    return (best, round(bestsc, 2)) if bestsc >= FUZZY_MIN else (None, round(bestsc, 2))

dealers = [d for d in db.dealers.find({}, {"_id": 0})
           if d.get("status") != "inactive" and not re.search(r'\btest\b|^abc$', d.get("firm_name") or "", re.I)]

linked = noop = held_conflict = nomatch = 0
held = []
for d in dealers:
    g = ng(d.get("gst_number") or ""); ph = npn(d.get("phone")); nm = nn(d.get("firm_name") or "")
    m, via = None, None
    if len(g) == 15 and g in by_g: m, via = by_g[g], "GSTIN"
    elif ph and ph in by_p: m, via = by_p[ph], "phone"
    elif nm and nm in by_n: m, via = by_n[nm], "name-exact"
    else:
        fm, _ = fuzzy(d.get("firm_name") or d.get("contact_person") or "")
        if fm: m, via = fm, "name-fuzzy"
    if not m:
        nomatch += 1
        continue
    if m.get("dealer_id") and m["dealer_id"] != d["id"]:
        held_conflict += 1
        held.append((d.get("firm_name"), m.get("name")))
        continue
    if m.get("dealer_id") == d["id"]:
        noop += 1
        continue
    linked += 1
    if COMMIT:
        db.parties.update_one({"id": m["id"]}, {"$set": {
            "dealer_id": d["id"], "vyapar_dealer_linked_at": NOW, "vyapar_dealer_link_via": via}})
        db.dealers.update_one({"id": d["id"]}, {"$set": {"party_id": m["id"], "updated_at": NOW}})

print(f"{'COMMITTED' if COMMIT else 'DRY-RUN'} — dealer↔Vyapar high-confidence link")
print(f"  newly linked:            {linked}")
print(f"  already linked (no-op):  {noop}")
print(f"  HELD (conflict — party belongs to a different dealer): {held_conflict}")
print(f"  no match:                {nomatch}")
for dn, pn in held:
    print(f"    HELD: dealer '{dn}' ↔ party '{pn}'")

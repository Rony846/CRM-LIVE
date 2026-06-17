#!/usr/bin/env python3
"""Find dealer payments that hit the bank but are booked in NEITHER the CRM NOR Vyapar,
and flag them onto each dealer's party record as a reconciliation worklist.

Tightened matcher vs the first cut:
- Extracts the actual PAYER name from the bank narration (the alpha field after the ref),
  not every token.
- Excludes intercompany/group entities (MuscleGrid/MGIPL/Kanta/SPV/Electronics Bay/…) and
  own-account transfers.
- Cross-checks Vyapar: drops any receipt whose amount matches a Vyapar payment-in / sale for
  that dealer (so it's only "unbooked" if truly absent from both systems).

Usage: venv/bin/python scripts/flag_unbooked_dealer_receipts.py <path.vyp> [--commit]
Idempotent: re-running recomputes and overwrites each party's flags.
"""
import sys, re, sqlite3
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
DBP = next((a for a in sys.argv[1:] if a.endswith(".vyp")), None)
COMMIT = "--commit" in sys.argv
FIRM_GSTIN = "07AATCM1213F1ZM"
NOW = datetime.now(timezone.utc).isoformat()
AMT_TOL = 1.0

# group/own entities to exclude (these are intercompany, not dealer sales)
GROUP = ["musclegrid", "mgipl", "kanta", "spvindustries", "electronicsbay", "ebay",
         "sapphireecoeart", "vivek", "pawan"]

def fnum(x):
    try: return float(str(x).replace(",", "") or 0)
    except (ValueError, TypeError): return 0.0
def norm(s): return re.sub(r'[^a-z]', '', (s or '').lower())

_COMPANY = re.compile(r'\b(ltd|pvt|llp|inc|corp|enterprise|enterprises|electronic|electronics|electrical|'
                      r'power|solution|solutions|system|systems|technolog|infocom|trader|traders|trading|'
                      r'industries|energy|solar|associate|associates|agenc|distributor|distributors)\b', re.I)
def confidence(dealer_name, exact):
    """high = reliable (company name, or exact multi-word match); medium = 2-word personal name;
    low = single common first name (could match the wrong dealer)."""
    words = len([w for w in (dealer_name or "").split() if len(w) > 1])
    if _COMPANY.search(dealer_name or "") or (exact and words >= 2):
        return "high"
    return "medium" if words >= 2 else "low"

def payer_names(desc):
    """Pull candidate payer name(s) from a bank narration. Formats:
    IMPS/<ref>/<NAME>/<IFSC>..., IFT/<acct>/<NAME>/<ref>..., UPI/CR/<ref>/<NAME>/<BANK>/<vpa>/<note>"""
    out = []
    for p in re.split(r'[\/\-]', desc or ""):
        p = p.strip()
        if re.fullmatch(r'[A-Za-z]{4}0[A-Za-z0-9]{6}', p):  # IFSC
            continue
        letters = re.sub(r'[^A-Za-z ]', '', p).strip()
        u = letters.upper().replace(" ", "")
        if len(letters) >= 5 and u not in ("IMPS", "IFT", "UPI", "NEFT", "RTGS", "CR", "DR", "MR", "MS", "MRS"):
            out.append(letters)
    return out

# Vyapar payment-in / sale amounts per dealer name_id (to drop already-booked ones)
con = sqlite3.connect(DBP)
vyp_amts = {}  # name_id -> set(amounts)
for r in con.execute("SELECT txn_name_id, txn_type, txn_cash_amount, txn_balance_amount FROM kb_transactions WHERE txn_type IN (1,3)"):
    tot = round((r[2] or 0) + (r[3] or 0), 0)
    vyp_amts.setdefault(r[0], set()).add(tot)
con.close()

# dealer index: normalized-name -> party (Vyapar-synced parties), with their vyapar name_id
dealers = {}
for p in db.parties.find({"vyapar_key": {"$regex": f"^{FIRM_GSTIN}:"}}, {"_id": 0, "id": 1, "name": 1, "vyapar_key": 1}):
    n = norm(p.get("name"))
    if len(n) >= 5 and not any(g in n for g in GROUP):
        try: p["_vid"] = int(p["vyapar_key"].split(":")[1])
        except (ValueError, IndexError): p["_vid"] = None
        dealers[n] = p

per_party = {}  # party_id -> {name, receipts:[...], total}
for bs in db.bank_statements.find({}, {"_id": 0, "bank_name": 1, "transactions": 1}):
    for t in bs.get("transactions", []):
        amt = fnum(t.get("credit"))
        if amt <= 0:
            continue
        if str(t.get("recon_status")).lower() not in ("unmatched", "none", "", "unreconciled") and t.get("recon_status") is not None:
            continue
        desc = t.get("description", "") or ""
        if any(g in norm(desc) for g in GROUP):  # own/intercompany narration
            continue
        # match payer name to a dealer
        matched = None; exact = False
        for nm in payer_names(desc):
            pn = norm(nm)
            if len(pn) < 5:
                continue
            for dn, dp in dealers.items():
                if pn == dn or (len(pn) >= 6 and (pn in dn or dn in pn)):
                    matched = dp; exact = (pn == dn); break
            if matched:
                break
        if not matched:
            continue
        conf = confidence(matched["name"], exact)
        # cross-check Vyapar: already booked there?
        vid = matched.get("_vid")
        if vid and any(abs(amt - a) <= AMT_TOL for a in vyp_amts.get(vid, ())):
            continue
        e = per_party.setdefault(matched["id"], {"name": matched["name"], "receipts": [], "total": 0.0, "conf": conf})
        e["receipts"].append({"amount": amt, "date": t.get("transaction_date"), "bank": bs.get("bank_name"),
                              "narration": desc[:80], "confidence": conf})
        e["total"] += amt
        if {"high": 3, "medium": 2, "low": 1}[conf] > {"high": 3, "medium": 2, "low": 1}[e["conf"]]:
            e["conf"] = conf  # party-level = best tier among its receipts

n_parties = len(per_party)
n_rcpts = sum(len(v["receipts"]) for v in per_party.values())
total = sum(v["total"] for v in per_party.values())
print(f"{'COMMIT' if COMMIT else 'DRY-RUN'} — unbooked dealer receipts (not in CRM or Vyapar)")
print(f"  dealers affected: {n_parties} | receipts: {n_rcpts} | total ₹{total:,.0f}")
by_tier = {"high": 0.0, "medium": 0.0, "low": 0.0}
for v in per_party.values():
    by_tier[v["conf"]] += v["total"]
print(f"  by confidence — HIGH ₹{by_tier['high']:,.0f} | MEDIUM ₹{by_tier['medium']:,.0f} | LOW ₹{by_tier['low']:,.0f}\n")
for pid, v in sorted(per_party.items(), key=lambda x: -x[1]["total"])[:15]:
    print(f"  [{v['conf'][:4].upper():4}] ₹{v['total']:>11,.0f}  {len(v['receipts'])}x  {v['name'][:34]}")

if COMMIT:
    # clear stale flags, then set fresh (idempotent)
    db.parties.update_many({"unbooked_bank_receipts": {"$exists": True}},
                           {"$unset": {"unbooked_bank_receipts": "", "unbooked_bank_total": "",
                                       "unbooked_bank_count": "", "unbooked_bank_confidence": ""}})
    for pid, v in per_party.items():
        db.parties.update_one({"id": pid}, {"$set": {
            "unbooked_bank_receipts": v["receipts"], "unbooked_bank_total": round(v["total"], 2),
            "unbooked_bank_count": len(v["receipts"]), "unbooked_bank_confidence": v["conf"],
            "unbooked_bank_flagged_at": NOW}})
    print(f"\nflagged {n_parties} dealer party records (field: unbooked_bank_receipts, with per-receipt confidence).")

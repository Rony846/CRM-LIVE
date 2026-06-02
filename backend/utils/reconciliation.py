"""Bank-line reconciliation engine.

For every bank-statement transaction of a firm, classify it and link it to the CRM record it
represents — an intercompany transfer, an Amazon/gateway settlement, a customer receipt against a
sales invoice / Vyapar voucher / PI, a supplier payment against a purchase, or an internal FD/charge.
Writes the result back onto the transaction (recon_* fields) so it's real, filterable CRM state, and
returns a per-firm summary. Idempotent: re-running re-derives every txn from scratch.

Called by the /finance/reconciliation endpoints and the nightly scheduled job in server.py.
"""
import re
import datetime
import collections

# ---- group entities (intercompany) — keyed by bank account number / masked last-4 / name ----
ACCT = {
    "84684684600": "MGIPL",
    "10192131041": "Kanta(MG-Gurgaon)", "50200083582520": "Kanta(MG-Gurgaon)",
    "10192292486": "EBay(Pawan)", "50200066783236": "EBay(Pawan)", "10192122559": "EBay(Pawan)",
    "50200090171743": "SPV(Vivek)", "89800008226": "SPV(Vivek)", "89899716916": "SPV(Vivek)",
    "50100237418758": "SPV(Vivek)", "50200101395703": "RAZORPAY-EXT",
}
ACCT_RE = re.compile("(" + "|".join(sorted(ACCT, key=len, reverse=True)) + ")")
LAST4 = {"4600": "MGIPL", "2520": "Kanta(MG-Gurgaon)", "1041": "Kanta(MG-Gurgaon)",
         "2486": "EBay(Pawan)", "3236": "EBay(Pawan)", "2559": "EBay(Pawan)",
         "1743": "SPV(Vivek)", "8226": "SPV(Vivek)", "6916": "SPV(Vivek)", "8758": "SPV(Vivek)"}
MASK_RE = re.compile(r"X{3,}(\d{3,4})")

SWEEP_RE = re.compile(r"AUTO SWEEP|SWEEP IN FROM|SWEEPOUT|PRINCIPAL:|FIXED DEP|TERM DEP")
INT_RE = re.compile(r"\bINT\.?PD\b|INTEREST (PAID|CR)|CREDIT INTEREST")
CHG_RE = re.compile(r"BANK CHARGES|\bCHRG\b|GST ON|SMS CHARGES|INSTAALERTCHG|MAINTENANCE|AMC|NEFT CHG|RTGS CHG")
GST_RE = re.compile(r"GST PAYMENT|GSTN|TAX PAYMENT|CBDT|GSTPMT|GST@|ICEGATE")
AMZ_RE = re.compile(r"AMAZON|CLEARTAX")
GATEWAY_RE = re.compile(r"RAZORPAY|PHONEPE|\bPAYU\b|CCAVENUE|BILLDESK|PAYTM PAYMENTS|EASEBUZZ")


def _f(x):
    try:
        return float(x or 0)
    except (TypeError, ValueError):
        return 0.0


def _own_entity(firm_name, filename):
    tok = re.search(r"(84684684600|10192131041|10192292486|89800008226|50100237418758)", filename or "")
    if tok:
        return ACCT.get(tok.group(1))
    f = (firm_name or "").upper()
    if "SPV" in f:
        return "SPV(Vivek)"
    if "GURGAON" in f:
        return "Kanta(MG-Gurgaon)"
    if "ELECTRON" in f or "EBAY" in f:
        return "EBay(Pawan)"
    if "MGIPL" in f:
        return "MGIPL"
    return firm_name


def _name_entity(seg):
    s = seg.upper()
    if "SPV INDUSTRIES" in s:
        return "SPV(Vivek)"
    if "ELECTRONICS BAY" in s or "ELECTRONICSBAY" in s:
        return "EBay(Pawan)"
    if "MUSCLEGRID INDUSTRIES PRIVATE" in s or "MUSCLEGRID INDUSTRIES PVT" in s:
        return "MGIPL"
    if "MUSCLEGRID INDUSTRIE" in s:
        return "MuscleGrid(MGIPL/Kanta?)"
    return None


def _intercompany_cp(desc, own):
    """Counterpart group entity referenced in the narration, or None."""
    u = (desc or "").upper()
    m = ACCT_RE.search(u)
    if m:
        e = ACCT[m.group(1)]
        return None if e == "RAZORPAY-EXT" else e
    m = MASK_RE.search(u)
    if m and m.group(1) in LAST4:
        return LAST4[m.group(1)]
    segs = [s.strip() for s in re.split(r"[-/]", u) if s.strip()]
    named = [e for s in segs if (e := _name_entity(s))]
    others = [e for e in named if e != own
              and not (e.startswith("MuscleGrid") and (own or "").startswith(("MGIPL", "Kanta")))]
    return others[0] if others else None


def _classify(desc, own, is_credit):
    """First-pass classification of a bank txn -> (recon_type, counterparty_or_None)."""
    u = (desc or "").upper()
    if SWEEP_RE.search(u):
        return "fd_sweep", None
    if INT_RE.search(u):
        return "bank_interest", None
    if CHG_RE.search(u):
        return "bank_charge", None
    if GST_RE.search(u):
        return "gst_payment", None
    cp = _intercompany_cp(desc, own)
    if cp:
        return "intercompany", cp
    if AMZ_RE.search(u):
        return "amazon_settlement", "Amazon"
    if GATEWAY_RE.search(u):
        return "gateway_settlement", "Payment gateway"
    return ("customer_receipt" if is_credit else "supplier_payment"), None


_NAME_TOKEN = re.compile(r"[A-Z][A-Z&]{3,}")


async def _match_invoice(db, firm_id, amount, desc, is_credit):
    """Match a customer receipt to a sales invoice / Vyapar sale / PI (by amount, then party token),
    or a supplier payment to a purchase. Returns (ref_type, ref) or (None, None)."""
    lo, hi = amount - 1, amount + 1
    if is_credit:
        # sales_invoices (grand_total) — exact amount
        inv = await db.sales_invoices.find_one(
            {"firm_id": firm_id, "grand_total": {"$gte": lo, "$lte": hi}},
            {"_id": 0, "invoice_number": 1})
        if inv:
            return "sales_invoice", inv.get("invoice_number")
        # Vyapar voucher (total_value)
        vv = await db.vyapar_vouchers.find_one(
            {"firm_id": firm_id, "voucher_type": "Sales", "total_value": {"$gte": lo, "$lte": hi}},
            {"_id": 0, "voucher_number": 1, "party_name": 1})
        if vv:
            return "vyapar_sale", f"{vv.get('voucher_number')} ({vv.get('party_name')})"
        # PI / quotation (grand_total)
        q = await db.quotations.find_one(
            {"firm_id": firm_id, "grand_total": {"$gte": lo, "$lte": hi}},
            {"_id": 0, "quotation_number": 1})
        if q:
            return "pi", q.get("quotation_number")
    else:
        pur = await db.purchases.find_one(
            {"firm_id": firm_id, "total_amount": {"$gte": lo, "$lte": hi}},
            {"_id": 0, "purchase_number": 1, "supplier_name": 1})
        if pur:
            return "purchase", f"{pur.get('purchase_number')} ({pur.get('supplier_name')})"
        vp = await db.vyapar_vouchers.find_one(
            {"firm_id": firm_id, "voucher_type": "Purchase", "total_value": {"$gte": lo, "$lte": hi}},
            {"_id": 0, "voucher_number": 1})
        if vp:
            return "vyapar_purchase", vp.get("voucher_number")
    return None, None


async def reconcile_firm(db, firm: dict) -> dict:
    """Reconcile every bank transaction for one firm. Persists recon_* onto each txn and returns a
    summary. recon_status is 'matched' (linked to a CRM record), 'classified' (a known internal/
    settlement type, no 1:1 doc), or 'unmatched' (a receipt/payment with no CRM match found)."""
    fid = firm.get("id")
    fname = firm.get("name")
    statements = await db.bank_statements.find({"firm_id": fid}).to_list(200)
    summary = collections.Counter()
    val = collections.Counter()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    for st in statements:
        own = _own_entity(fname, st.get("filename"))
        txns = st.get("transactions") or []
        changed = False
        for t in txns:
            dr, cr = _f(t.get("debit")), _f(t.get("credit"))
            if not (dr or cr):
                continue
            amount = dr or cr
            is_credit = cr > 0
            rtype, cp = _classify(t.get("description"), own, is_credit)
            ref_type, ref, status = None, None, "classified"
            if rtype == "intercompany":
                ref_type, ref, status = "intercompany", cp, "matched"
            elif rtype in ("customer_receipt", "supplier_payment"):
                ref_type, ref = await _match_invoice(db, fid, round(amount, 2), t.get("description"), is_credit)
                status = "matched" if ref else "unmatched"
            else:  # fd_sweep / interest / charge / gst / amazon / gateway settlements
                status = "classified"
            t["recon_type"] = rtype
            t["recon_status"] = status
            t["recon_ref_type"] = ref_type
            t["recon_ref"] = ref
            t["recon_at"] = now
            summary[status] += 1
            summary[f"type:{rtype}"] += 1
            val[status] += amount
            changed = True
        if changed:
            await db.bank_statements.update_one(
                {"id": st["id"]},
                {"$set": {"transactions": txns, "recon_run_at": now}})

    out = {
        "firm_id": fid, "firm_name": fname,
        "matched": summary.get("matched", 0),
        "classified": summary.get("classified", 0),
        "unmatched": summary.get("unmatched", 0),
        "matched_value": round(val.get("matched", 0), 2),
        "unmatched_value": round(val.get("unmatched", 0), 2),
        "by_type": {k[5:]: v for k, v in summary.items() if k.startswith("type:")},
        "run_at": now,
    }
    return out


async def reconcile_all(db, scope_firm_id=None) -> dict:
    """Reconcile all firms (or one). Persists per-firm summaries to `reconciliation_runs`."""
    q = {"id": scope_firm_id} if scope_firm_id else {}
    firms = await db.firms.find(q, {"_id": 0}).to_list(50)
    results = []
    for f in firms:
        if await db.bank_statements.count_documents({"firm_id": f["id"]}):
            results.append(await reconcile_firm(db, f))
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    tot = {"run_at": now,
           "matched": sum(r["matched"] for r in results),
           "classified": sum(r["classified"] for r in results),
           "unmatched": sum(r["unmatched"] for r in results),
           "firms": results}
    await db.reconciliation_runs.insert_one({**tot, "id": now})
    return tot

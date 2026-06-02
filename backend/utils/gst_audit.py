"""GST audit engine — "Deloitte-level" firm audit on CRM + filed-return data.

Works on what's already in the CRM (sales_invoices, gst_report_data, purchases, gst_itc_balances)
and clearly flags the gaps that only a live GST-portal (GSP) pull can fill. Pure-ish: takes the db
handle, returns a structured findings dict. No external calls (GSTIN validation is offline checksum).
"""
import re
from collections import defaultdict

_GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
_GST_CODE = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def gstin_valid(gstin: str) -> bool:
    """Offline GSTIN validity: 15-char format + the official mod-36 check-digit. No API needed."""
    g = (gstin or "").strip().upper()
    if not _GSTIN_RE.match(g):
        return False
    factor, total, mod = 2, 0, 36
    for ch in g[:14][::-1]:
        cp = _GST_CODE.index(ch)
        d = factor * cp
        total += (d // mod) + (d % mod)
        factor = 1 if factor == 2 else 2
    check = (mod - (total % mod)) % mod
    return _GST_CODE[check] == g[14]


def _f(x):
    try:
        return float(x or 0)
    except (TypeError, ValueError):
        return 0.0


def _seq_gaps(numbers):
    """Find gaps in invoice numbering — extracts the trailing integer of each number and reports
    missing values within the observed min..max range (per distinct prefix)."""
    by_prefix = defaultdict(list)
    for n in numbers:
        m = re.search(r"(\d+)\s*$", str(n or ""))
        if not m:
            continue
        prefix = str(n)[:m.start()]
        by_prefix[prefix].append(int(m.group(1)))
    gaps = []
    for prefix, nums in by_prefix.items():
        if len(nums) < 3:
            continue
        s = set(nums)
        lo, hi = min(nums), max(nums)
        if hi - lo > 5000:  # avoid pathological ranges from odd numbering
            continue
        missing = [i for i in range(lo, hi + 1) if i not in s]
        if missing:
            gaps.append({"series": prefix or "(numeric)", "range": f"{lo}-{hi}",
                         "missing_count": len(missing), "missing_sample": missing[:15]})
    return gaps


def _norm_inv(n):
    return re.sub(r"[^a-z0-9]", "", str(n or "").lower())


def _match_invoices(invoices, filed_rows):
    """Match CRM invoices to filed GSTR-1 invoice-level rows (b2b/b2cl). Exact by invoice number first,
    then fall back to amount-match for the rest (numbering differs across systems). Returns buckets:
    matched / value_mismatch / only_in_crm (possible unbilled) / only_in_filed (CRM data gap)."""
    filed = {}  # norm number -> aggregated invoice
    for r in filed_rows:
        if (r.get("section") or "") not in ("b2b", "b2cl"):
            continue
        num = r.get("invoice_number")
        if not num:
            continue
        e = filed.setdefault(_norm_inv(num), {"num": num, "taxable": 0.0, "tax": 0.0,
                                              "date": r.get("invoice_date"), "gstin": r.get("gstin")})
        e["taxable"] += _f(r.get("taxable_value"))
        e["tax"] += _f(r.get("igst")) + _f(r.get("cgst")) + _f(r.get("sgst"))
    crm = {}
    for i in invoices:
        num = i.get("invoice_number")
        if not num:
            continue
        crm[_norm_inv(num)] = {"num": num, "taxable": _f(i.get("taxable_value")) or _f(i.get("subtotal")),
                               "tax": _f(i.get("cgst")) + _f(i.get("sgst")) + _f(i.get("igst")),
                               "gstin": (i.get("gstin") or "").upper()}
    matched, mismatch, only_crm, only_filed = [], [], [], []
    used = set()
    # 1) exact invoice-number match
    for k, c in crm.items():
        if k in filed:
            used.add(k)
            f = filed[k]
            if abs(c["taxable"] - f["taxable"]) <= 1:
                matched.append(c["num"])
            else:
                mismatch.append({"invoice": c["num"], "crm_taxable": round(c["taxable"], 2),
                                 "filed_taxable": round(f["taxable"], 2)})
    # 2) GSTIN + amount match — invoice NUMBERS differ between books (Vyapar voucher no.) and the
    # portal (IN-xxx), but a B2B invoice's counterparty GSTIN + taxable value should agree. This is
    # the reliable fuzzy match; it replaces blind amount-only matching for B2B.
    crm_left = [(k, c) for k, c in crm.items() if k not in filed]
    by_gst_amt = defaultdict(list)
    for k, f in filed.items():
        if k not in used and f.get("gstin"):
            by_gst_amt[(f["gstin"].upper(), round(f["taxable"]))].append(k)
    gstin_matched = 0
    rem = []
    for k, c in crm_left:
        key = (c.get("gstin"), round(c["taxable"]))
        if c.get("gstin") and by_gst_amt.get(key):
            used.add(by_gst_amt[key].pop(0))
            gstin_matched += 1
        else:
            rem.append((k, c))
    # 3) amount-only last resort (B2C / no-GSTIN invoices)
    by_amt = defaultdict(list)
    for k, f in filed.items():
        if k not in used:
            by_amt[round(f["taxable"])].append(k)
    fuzzy = 0
    for k, c in rem:
        cands = by_amt.get(round(c["taxable"]))
        if cands:
            used.add(cands.pop(0))
            fuzzy += 1
        else:
            only_crm.append({"invoice": c["num"], "taxable": round(c["taxable"], 2)})
    for k, f in filed.items():
        if k not in used:
            only_filed.append({"invoice": f["num"], "taxable": round(f["taxable"], 2), "gstin": f.get("gstin")})
    return {"matched_count": len(matched) + gstin_matched + fuzzy, "exact": len(matched),
            "by_gstin": gstin_matched, "fuzzy": fuzzy,
            "value_mismatch": mismatch, "only_in_crm": only_crm, "only_in_filed": only_filed}


async def run_firm_audit(db, firm: dict, period_key: str = None) -> dict:
    """Audit one firm. Returns findings + data-gap flags."""
    fid = firm.get("id")
    gstin = firm.get("gstin")
    findings = {"firm": firm.get("name"), "firm_id": fid, "gstin": gstin,
                "gstin_valid": gstin_valid(gstin), "checks": [], "data_gaps": []}

    inv_q = {"firm_id": fid}
    rep_q = {"firm_id": fid}
    if period_key:
        rep_q["period_key"] = period_key
        # Scope CRM invoices to the SAME month (invoice_date 'YYYY-MM-...') so the comparison is
        # like-for-like — otherwise all-period CRM sales get compared to one month's filed return.
        inv_q["invoice_date"] = {"$regex": f"^{re.escape(period_key)}"}

    # Books side: PREFER imported Vyapar vouchers where present — that Tally/Vyapar export is the
    # authoritative accounting and far more complete than partial CRM sales_invoices for the
    # proprietorship firms. Map Vyapar fields onto the names the checks expect so the whole audit
    # (sales recon, sequence gaps, dup numbers, tax anomalies, invoice-level match) works unchanged.
    vq = {"firm_id": fid, "voucher_type": "Sales"}
    if period_key:
        vq["period_key"] = period_key
    vv = await db.vyapar_vouchers.find(vq, {"_id": 0}).to_list(50000)
    if vv:
        findings["books_source"] = "vyapar_vouchers"
        invoices = [{
            "invoice_number": r.get("voucher_number"),
            "invoice_date": r.get("date"),
            "grand_total": r.get("total_value"),
            "taxable_value": r.get("taxable_value"),
            "subtotal": r.get("taxable_value"),
            "cgst": r.get("cgst"), "sgst": r.get("sgst"), "igst": r.get("igst"),
            "gstin": r.get("party_gstin"), "party_name": r.get("party_name"),
            "section": "b2b" if r.get("party_gstin") else "b2cs",
        } for r in vv]
    else:
        findings["books_source"] = "sales_invoices"
        invoices = await db.sales_invoices.find(inv_q, {"_id": 0}).to_list(20000)
    report = await db.gst_report_data.find(rep_q, {"_id": 0}).to_list(50000)
    # Portal-imported returns are authoritative — where they exist for a period, ignore other sources
    # (e.g. vyapar) so filed totals aren't double-counted.
    periods_portal = {r.get("period_key") for r in report if r.get("source") == "portal_import"}
    if periods_portal:
        report = [r for r in report if r.get("source") == "portal_import"
                  or r.get("period_key") not in periods_portal]

    # ---- 1. Sales reconciliation (gross): CRM (invoices + Amazon orders) vs filed GSTR-1 ----
    out_sections = [r for r in report if (r.get("section") or "").lower() in ("b2b", "b2c", "b2cs", "b2cl")]
    filed_tax = sum(_f(r.get("cgst")) + _f(r.get("sgst")) + _f(r.get("igst")) for r in out_sections)
    filed_taxable = sum(_f(r.get("taxable_value")) for r in out_sections)
    filed_gross = round(filed_taxable + filed_tax, 2)
    crm_inv_gross = sum(_f(i.get("grand_total")) for i in invoices)
    # Amazon marketplace orders ARE CRM sales — they live in `amazon_orders` (GST-inclusive order totals),
    # not sales_invoices. For ecommerce firms (e.g. EBAY UP) this is the bulk of sales.
    amz_q = {"firm_id": fid}
    if period_key:
        amz_q["purchase_date"] = {"$regex": f"^{re.escape(period_key)}"}
    amz = await db.amazon_orders.find(amz_q, {"_id": 0, "order_total": 1, "order_status": 1, "amazon_order_id": 1}).to_list(100000)
    amz = [a for a in amz if (a.get("order_status") or "").lower() not in ("cancelled", "canceled")]
    amz_count = len(amz)
    amz_gross = round(sum(_f(a.get("order_total")) for a in amz), 2)
    crm_order_ids = {a.get("amazon_order_id") for a in amz if a.get("amazon_order_id")}
    crm_order_gross = {a.get("amazon_order_id"): _f(a.get("order_total")) for a in amz if a.get("amazon_order_id")}
    crm_total_gross = round(crm_inv_gross + amz_gross, 2)
    has_filed = bool(out_sections)
    if has_filed:
        diff = round(crm_total_gross - filed_gross, 2)
        tol = max(1000.0, 0.02 * filed_gross)
        findings["checks"].append({
            "check": "Sales reconciliation (gross): CRM incl. Amazon vs filed GSTR-1",
            "crm_invoices_gross": round(crm_inv_gross, 2), "crm_amazon_orders": amz_count,
            "crm_amazon_gross": amz_gross, "crm_total_gross": crm_total_gross, "filed_gross": filed_gross,
            "gross_diff": diff,
            "severity": "ok" if abs(diff) <= tol else ("high" if abs(diff) > 50000 else "medium"),
            "note": ("Amazon orders (GST-inclusive) counted from amazon_orders. "
                     + ("Both invoices & Amazon present — verify no double-count. " if crm_inv_gross > 0 and amz_gross > 0 else "")
                     + ("Matched (within tolerance)." if abs(diff) <= tol
                        else f"₹{abs(diff):,.0f} {'more in CRM' if diff > 0 else 'more filed than in CRM'}."))})
    elif amz_count or invoices:
        # No filed GSTR-1 loaded (e.g. portal down) — show the CRM/Amazon total as the FILING BASIS,
        # not a "gap". Reconciliation vs filed runs once the GSTR-1 JSON is uploaded.
        findings["checks"].append({
            "check": "CRM sales total (filed GSTR-1 not loaded)", "severity": "medium",
            "crm_invoices_gross": round(crm_inv_gross, 2), "crm_amazon_orders": amz_count,
            "crm_amazon_gross": amz_gross, "crm_total_gross": crm_total_gross, "filed_gross": 0,
            "gross_diff": None,
            "note": "GST portal return not loaded — this is the Amazon+invoice total that SHOULD be filed. "
                    "Upload the GSTR-1 JSON when the portal is available to reconcile vs filed."})
        findings["data_gaps"].append("Filed GSTR-1 not loaded — vs-filed reconciliation pending (portal/GSP).")
    else:
        findings["data_gaps"].append("No filed GSTR-1 (outward) data on file for this firm — connect GSP or import return JSON.")

    # ---- 2. Invoice sequence gaps (missing invoice numbers) ----
    gaps = _seq_gaps([i.get("invoice_number") for i in invoices])
    if gaps:
        findings["checks"].append({"check": "Invoice sequence gaps (CRM)", "severity": "medium",
                                   "series": gaps[:6], "note": "Missing invoice numbers may mean unrecorded/cancelled invoices."})

    # ---- 3. Duplicate invoice numbers ----
    seen = defaultdict(int)
    for i in invoices:
        seen[(i.get("invoice_number") or "").strip()] += 1
    dups = [n for n, c in seen.items() if n and c > 1]
    if dups:
        findings["checks"].append({"check": "Duplicate invoice numbers (CRM)", "severity": "high",
                                   "count": len(dups), "sample": dups[:15]})

    # ---- 4. Tax-arithmetic anomalies (tax not matching taxable × observed rate) ----
    anomalies = 0
    for i in invoices:
        tv = _f(i.get("taxable_value")) or _f(i.get("subtotal"))
        tax = _f(i.get("cgst")) + _f(i.get("sgst")) + _f(i.get("igst"))
        if tv > 0 and tax > 0:
            rate = round(tax / tv * 100)
            if rate not in (0, 5, 12, 18, 28):  # GST slabs
                anomalies += 1
    if anomalies:
        findings["checks"].append({"check": "Tax-rate anomalies (effective rate off-slab)", "severity": "medium",
                                   "count": anomalies, "note": "Effective GST% not a standard slab (5/12/18/28) — check HSN/tax setup."})

    # ---- 5. GSTIN validity of B2B counterparties in filed data ----
    bad_gstins = sorted({r.get("gstin") for r in report
                         if r.get("gstin") and not gstin_valid(r.get("gstin"))})
    if bad_gstins:
        findings["checks"].append({"check": "Invalid counterparty GSTINs in returns", "severity": "high",
                                   "count": len(bad_gstins), "sample": bad_gstins[:15]})

    # ---- 6. ITC (input credit): filed 4_itc vs CRM purchases ----
    itc_rows = [r for r in report if (r.get("section") or "").lower().endswith("itc")]
    purchases = await db.purchases.count_documents({"firm_id": fid})
    if itc_rows or purchases:
        filed_itc = sum(_f(r.get("cgst")) + _f(r.get("sgst")) + _f(r.get("igst")) for r in itc_rows)
        findings["checks"].append({"check": "ITC: filed input credit vs CRM purchases", "severity": "medium",
                                   "filed_itc": round(filed_itc, 2), "crm_purchase_records": purchases,
                                   "note": "Purchase capture is thin — ITC reconciliation needs GSTR-2B (GSP) + full purchase entry."})
    else:
        findings["data_gaps"].append("No purchase/ITC data — connect GSTR-2B (GSP) and record purchases for input-credit audit.")

    # Fetch Amazon MTR up-front — filed invoices it covers are reconciled via the Amazon match (6c),
    # so the plain CRM↔GSTR-1 match (6b) must EXCLUDE them (else it double-flags as "only in filed").
    mtr_q = {"firm_id": fid}
    if period_key:
        mtr_q["period_key"] = period_key
    mtr_rows = await db.amazon_mtr.find(mtr_q, {"_id": 0}).to_list(100000)
    mtr_nums = {_norm_inv(m.get("invoice_number")) for m in mtr_rows if m.get("invoice_number")}
    # Orders that were returned/refunded — a MTR (gross shipment) vs filed/CRM (net) difference on these
    # is EXPLAINED by the refund, not a filing error.
    refunded_orders = set()
    if mtr_rows:
        async for _r in db.amazon_refunds.find({"firm_id": fid}, {"_id": 0, "amazon_order_id": 1}):
            if _r.get("amazon_order_id"):
                refunded_orders.add(_r["amazon_order_id"])

    # ---- 6b. Invoice-level match: NON-Amazon CRM invoices ↔ filed GSTR-1 (b2b/b2cl) ----
    filed_inv_rows = [r for r in report if (r.get("section") or "") in ("b2b", "b2cl")
                      and _norm_inv(r.get("invoice_number")) not in mtr_nums]
    if filed_inv_rows:
        mr = _match_invoices(invoices, filed_inv_rows)
        sev = "high" if (mr["only_in_filed"] or mr["value_mismatch"]) else ("medium" if mr["only_in_crm"] else "ok")
        findings["checks"].append({
            "check": "Invoice-level match (CRM ↔ GSTR-1, non-Amazon)", "severity": sev,
            "matched": mr["matched_count"], "exact": mr["exact"], "by_gstin": mr.get("by_gstin", 0), "fuzzy": mr["fuzzy"],
            "only_in_crm_count": len(mr["only_in_crm"]), "only_in_filed_count": len(mr["only_in_filed"]),
            "value_mismatch_count": len(mr["value_mismatch"]),
            "only_in_crm": mr["only_in_crm"][:20], "only_in_filed": mr["only_in_filed"][:20],
            "value_mismatch": mr["value_mismatch"][:20],
            "note": "Non-Amazon invoices only (Amazon handled via MTR below). In-CRM-not-filed = possible "
                    "under-reported sale; In-filed-not-CRM = sale missing from CRM."})

    # ---- 6c. Amazon invoice match via MTR: CRM orders ↔ MTR (order→invoice) ↔ filed GSTR-1 ----
    if mtr_rows:
        # filed B2B as number -> aggregated gross (so we compare VALUES per invoice, not just presence)
        filed_b2b_map = defaultdict(float)
        for r in report:
            if (r.get("section") or "") in ("b2b", "b2cl") and r.get("invoice_number"):
                filed_b2b_map[_norm_inv(r["invoice_number"])] += (_f(r.get("taxable_value")) + _f(r.get("igst"))
                                                                  + _f(r.get("cgst")) + _f(r.get("sgst")))
        filed_b2b = set(filed_b2b_map)
        mtr_b2b = [m for m in mtr_rows if m.get("is_b2b") and not m.get("is_refund")]
        matched_filed, order_in_crm = 0, 0
        in_mtr_not_filed, order_not_in_crm, invoice_value_mismatch = [], [], []
        for m in mtr_b2b:
            k = _norm_inv(m.get("invoice_number"))
            if has_filed and k in filed_b2b:
                matched_filed += 1
                m_gross = _f(m.get("taxable")) + _f(m.get("igst")) + _f(m.get("cgst")) + _f(m.get("sgst"))
                if abs(m_gross - filed_b2b_map[k]) > max(5.0, 0.01 * filed_b2b_map[k]):
                    invoice_value_mismatch.append({"invoice": m.get("invoice_number"), "order_id": m.get("order_id"),
                                                   "mtr": round(m_gross, 2), "filed": round(filed_b2b_map[k], 2),
                                                   "ratio": round(m_gross / filed_b2b_map[k], 2) if filed_b2b_map[k] else None,
                                                   "refund_explained": m.get("order_id") in refunded_orders})
            elif has_filed:  # only "not filed" when we actually have a filed return to compare against
                in_mtr_not_filed.append({"invoice": m.get("invoice_number"), "order_id": m.get("order_id"),
                                         "taxable": m.get("taxable")})
            if m.get("order_id") in crm_order_ids:
                order_in_crm += 1
            else:
                order_not_in_crm.append({"invoice": m.get("invoice_number"), "order_id": m.get("order_id")})
        mtr_nums = {_norm_inv(m.get("invoice_number")) for m in mtr_b2b}
        filed_not_in_mtr = sorted({r.get("invoice_number") for r in report
                                   if (r.get("section") or "") in ("b2b", "b2cl") and r.get("invoice_number")
                                   and _norm_inv(r.get("invoice_number")) not in mtr_nums})
        # VALUE reconciliation (not just presence): MTR vs filed, split B2B / B2C.
        def _gross(rows):
            return round(sum(_f(x.get("taxable")) + _f(x.get("igst")) + _f(x.get("cgst")) + _f(x.get("sgst")) for x in rows), 2)
        mtr_b2c = [m for m in mtr_rows if not m.get("is_b2b") and not m.get("is_refund")]
        mtr_b2b_gross, mtr_b2c_gross = _gross(mtr_b2b), _gross(mtr_b2c)
        filed_b2b_gross = round(sum(_f(r.get("taxable_value")) + _f(r.get("igst")) + _f(r.get("cgst")) + _f(r.get("sgst"))
                                    for r in report if (r.get("section") or "") == "b2b"), 2)
        filed_b2c_gross = round(sum(_f(r.get("taxable_value")) + _f(r.get("igst")) + _f(r.get("cgst")) + _f(r.get("sgst"))
                                    for r in report if (r.get("section") or "") in ("b2cs", "b2cl", "b2c")), 2)
        b2b_diff = round(mtr_b2b_gross - filed_b2b_gross, 2)
        b2c_diff = round(mtr_b2c_gross - filed_b2c_gross, 2)
        unfiled = round(b2b_diff + b2c_diff, 2)  # MTR(gross) vs filed — before netting returns
        b2b_unexpl = [x for x in invoice_value_mismatch if not x.get("refund_explained")]
        if has_filed:
            # Only UNEXPLAINED issues are high — refund-explained gaps are expected (gross MTR vs net filed).
            sev = ("high" if (in_mtr_not_filed or order_not_in_crm or b2b_unexpl)
                   else ("medium" if (filed_not_in_mtr or invoice_value_mismatch) else "ok"))
            chk_name = "Amazon invoice match (MTR ↔ GSTR-1 ↔ CRM orders)"
            chk_note = ("Value recon: MTR (Amazon report) vs filed GSTR-1, split B2B/B2C. A positive "
                        "'mtr_invoiced_not_filed' is a DISCREPANCY to review — it can be genuine under-reporting OR "
                        "the MTR carrying un-netted returns / multi-qty rows (verify a sample order vs the final filed "
                        "return & period boundary before concluding).")
        else:
            # No filed GSTR-1 loaded (portal down) — reconcile MTR ↔ CRM only; MTR totals = filing basis.
            sev = "high" if order_not_in_crm else "ok"
            chk_name = "Amazon MTR ↔ CRM orders (filed GSTR-1 not loaded)"
            chk_note = ("GST portal return not loaded — reconciling Amazon MTR to CRM orders only. "
                        "mtr_b2b_gross / mtr_b2c_gross are the amounts that SHOULD be filed. Upload the GSTR-1 "
                        "JSON when the portal is back to reconcile vs filed.")
        findings["checks"].append({
            "check": chk_name, "severity": sev, "filed_loaded": has_filed,
            "mtr_b2b_invoices": len(mtr_b2b), "matched_in_gstr1": (matched_filed if has_filed else None),
            "in_mtr_not_filed_count": len(in_mtr_not_filed), "filed_not_in_mtr_count": len(filed_not_in_mtr),
            "order_traced_to_crm": order_in_crm, "order_not_in_crm_count": len(order_not_in_crm),
            "b2b_mismatch_refund_explained": len(invoice_value_mismatch) - len(b2b_unexpl),
            "b2b_mismatch_unexplained": len(b2b_unexpl),
            "mtr_b2b_gross": mtr_b2b_gross, "filed_b2b_gross": filed_b2b_gross, "b2b_value_diff": b2b_diff,
            "mtr_b2c_gross": mtr_b2c_gross, "filed_b2c_gross": filed_b2c_gross, "b2c_value_diff": b2c_diff,
            "mtr_invoiced_not_filed": unfiled, "b2b_value_mismatch_count": len(invoice_value_mismatch),
            "b2b_value_mismatch": invoice_value_mismatch[:20],
            "in_mtr_not_filed": in_mtr_not_filed[:15], "filed_not_in_mtr": filed_not_in_mtr[:15],
            "order_not_in_crm": order_not_in_crm[:15],
            "note": chk_note})

    # ---- 6d. Amazon B2C drill-down: MTR B2C invoices ↔ CRM orders + rate-wise vs filed b2cs ----
    if mtr_rows:
        mtr_b2c_inv = [m for m in mtr_rows if not m.get("is_b2b") and not m.get("is_refund")]
        if mtr_b2c_inv:
            b2c_in_crm, b2c_not_in_crm, b2c_val_mismatch = 0, [], []
            for m in mtr_b2c_inv:
                oid = m.get("order_id")
                mg = _f(m.get("taxable")) + _f(m.get("igst")) + _f(m.get("cgst")) + _f(m.get("sgst"))
                if oid in crm_order_gross:
                    b2c_in_crm += 1
                    cg = crm_order_gross[oid]
                    if cg and abs(mg - cg) > max(5.0, 0.01 * cg):
                        b2c_val_mismatch.append({"invoice": m.get("invoice_number"), "order_id": oid,
                                                 "mtr": round(mg, 2), "crm": round(cg, 2),
                                                 "ratio": round(mg / cg, 2) if cg else None,
                                                 "refund_explained": oid in refunded_orders})
                else:
                    b2c_not_in_crm.append({"invoice": m.get("invoice_number"), "order_id": oid, "mtr": round(mg, 2)})

            def _rate(m):
                t = _f(m.get("taxable")); tx = _f(m.get("igst")) + _f(m.get("cgst")) + _f(m.get("sgst"))
                return round(tx / t * 100) if t else 0
            mtr_by_rate, filed_by_rate = defaultdict(float), defaultdict(float)
            for m in mtr_b2c_inv:
                mtr_by_rate[_rate(m)] += _f(m.get("taxable"))
            for r in report:
                if (r.get("section") or "") in ("b2cs", "b2c"):
                    filed_by_rate[round(_f(r.get("rate")))] += _f(r.get("taxable_value"))
            rate_recon = [{"rate": rt, "mtr_taxable": round(mtr_by_rate.get(rt, 0), 2),
                           "filed_taxable": round(filed_by_rate.get(rt, 0), 2),
                           "diff": round(mtr_by_rate.get(rt, 0) - filed_by_rate.get(rt, 0), 2)}
                          for rt in sorted(set(mtr_by_rate) | set(filed_by_rate))]
            b2c_unexpl = [x for x in b2c_val_mismatch if not x.get("refund_explained")]
            sev = "high" if (b2c_unexpl or b2c_not_in_crm) else ("medium" if b2c_val_mismatch else "ok")
            findings["checks"].append({
                "check": "Amazon B2C drill-down (MTR ↔ CRM orders, rate-wise vs filed)", "severity": sev,
                "b2c_invoices": len(mtr_b2c_inv), "order_in_crm": b2c_in_crm,
                "order_not_in_crm_count": len(b2c_not_in_crm), "value_mismatch_count": len(b2c_val_mismatch),
                "value_mismatch_refund_explained": len(b2c_val_mismatch) - len(b2c_unexpl),
                "value_mismatch_unexplained": len(b2c_unexpl),
                "value_mismatch": b2c_val_mismatch[:20], "order_not_in_crm": b2c_not_in_crm[:15],
                "rate_recon": rate_recon,
                "note": "B2C is filed consolidated (no invoice numbers) → MTR B2C invoices matched to CRM ORDERS by "
                        "order id, and reconciled to filed b2cs by RATE. value_mismatch (ratio ~2×) = multi-unit "
                        "orders under-counted; rate diff localizes the b2cs shortfall."})

    # ---- 7. GSTR-3B outward tax vs GSTR-1 (when 3B imported) — the classic 3B↔1 mismatch ----
    b3 = [r for r in report if (r.get("section") or "") == "3b_summary"]
    # The Vyapar 3B Excel import stores outward supplies as section "3.1" rows (igst/cgst/sgst per
    # nature-of-supply) rather than a single "3b_summary"/outward_tax row — fold those in (excluding the
    # 3.1(d) RCM-inward line) so the 3B↔1 check also fires for Vyapar-imported firms, not just portal PDFs.
    b31 = [r for r in report if (r.get("section") or "") == "3.1"
           and "reverse charge" not in (r.get("nature_of_supplies") or "").lower()
           and "inward" not in (r.get("nature_of_supplies") or "").lower()]
    if b3 or b31:
        b3_out = (sum(_f(r.get("outward_tax")) for r in b3)
                  + sum(_f(r.get("igst")) + _f(r.get("cgst")) + _f(r.get("sgst")) for r in b31))
        diff3 = round(b3_out - filed_tax, 2)
        findings["checks"].append({
            "check": "GSTR-3B outward tax vs GSTR-1", "gstr3b_tax": round(b3_out, 2),
            "gstr1_tax": round(filed_tax, 2), "tax_diff": diff3,
            "severity": "ok" if abs(diff3) < 1 else ("high" if abs(diff3) > 1000 else "medium"),
            "note": "3B and GSTR-1 match" if abs(diff3) < 1 else f"₹{abs(diff3):,.0f} mismatch between 3B and GSTR-1"})
    else:
        findings["data_gaps"].append("GSTR-3B liability not reconciled — import 3B JSON (Finance → GST Audit) or connect GSP.")

    # ---- ITC ledger balances (input credit) imported from the GST portal Electronic Credit Ledger ----
    itc_q = {"firm_id": fid}
    if period_key:
        itc_q["month"] = period_key
    itc_docs = await db.gst_itc_balances.find(itc_q, {"_id": 0}).sort("month", 1).to_list(24)
    findings["itc_balances"] = [{
        "month": b.get("month"),
        "igst": _f(b.get("igst_balance")), "cgst": _f(b.get("cgst_balance")), "sgst": _f(b.get("sgst_balance")),
        "total": round(_f(b.get("igst_balance")) + _f(b.get("cgst_balance")) + _f(b.get("sgst_balance")), 2),
        "notes": b.get("notes"),
    } for b in itc_docs]

    findings["summary"] = {
        "invoices": len(invoices), "filed_outward_rows": len(out_sections),
        "high": sum(1 for c in findings["checks"] if c.get("severity") == "high"),
        "medium": sum(1 for c in findings["checks"] if c.get("severity") == "medium"),
        "data_gaps": len(findings["data_gaps"]),
    }
    return findings

"""Parse GST-portal return JSON (GSTR-1 / GSTR-2B / GSTR-3B) into normalized rows the audit engine
reads — the free, no-GSP path. Feed it the JSON you download from gst.gov.in.

Output rows match the existing `gst_report_data` shape (source="portal_import"):
  {firm_id, period_key 'YYYY-MM', source, section, gstin, party_name, invoice_number, invoice_date,
   invoice_value, taxable_value, rate, igst, cgst, sgst, place_of_supply}
GSTR-3B returns a summary doc instead of rows (stored under section '3b_summary').
Defensive: tolerates missing keys/sections.
"""
import re


def _num(x):
    try:
        return round(float(x or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _period(mmyyyy):
    """'042026' -> '2026-04'. Returns '' if unparseable."""
    s = re.sub(r"\D", "", str(mmyyyy or ""))
    if len(s) == 6:
        return f"{s[2:]}-{s[:2]}"
    return ""


def detect_return_type(data: dict) -> str:
    if not isinstance(data, dict):
        return ""
    keys = set(data.keys())
    if (data.get("ret_period") or data.get("retperiod")) and (keys & {"sup_details", "itc_elg", "tx_pmt", "inward_sup"}):
        return "gstr3b"
    # GSTR-2B / 2A are commonly wrapped under "data"
    inner = data.get("data") if isinstance(data.get("data"), dict) else {}
    if inner.get("docdata") or inner.get("itcsumm") or data.get("docdata") or data.get("itcsumm"):
        return "gstr2b"
    # GSTR-1: outward sections + a period/turnover marker
    if (keys & {"b2b", "b2cl", "b2cs", "hsn", "cdnr", "exp", "nil", "at", "txpd"}) and \
       (data.get("fp") or data.get("gt") is not None or data.get("cur_gt") is not None):
        return "gstr1"
    # GSTR-2A: inward b2b with no fp (supplier-filed) — treat as ITC source like 2B
    if inner.get("b2b") and not inner.get("fp"):
        return "gstr2b"
    # last-ditch: any outward section present → assume GSTR-1
    if keys & {"b2b", "b2cs", "b2cl"}:
        return "gstr1"
    return ""


def _find_period(data: dict) -> str:
    """Hunt for a return period anywhere obvious: fp / rtnprd / ret_period (top or one level in)."""
    for src in (data, data.get("data") if isinstance(data.get("data"), dict) else {}):
        for k in ("fp", "rtnprd", "ret_period", "retperiod"):
            if src.get(k):
                p = _period(src.get(k))
                if p:
                    return p
    return ""


def _itm_tax(itm_det):
    return (_num(itm_det.get("iamt")), _num(itm_det.get("camt")), _num(itm_det.get("samt")),
            _num(itm_det.get("txval")), _num(itm_det.get("rt")))


def parse_gstr1(data: dict, firm_id: str, period_key: str) -> list:
    rows = []
    # B2B — supplier-wise, invoice-wise
    for sup in data.get("b2b", []) or []:
        ctin = sup.get("ctin")
        for inv in sup.get("inv", []) or []:
            for it in inv.get("itms", []) or []:
                iamt, camt, samt, txval, rt = _itm_tax(it.get("itm_det", {}))
                rows.append({"section": "b2b", "gstin": ctin, "party_name": sup.get("trdnm"),
                             "invoice_number": inv.get("inum"), "invoice_date": inv.get("idt"),
                             "invoice_value": _num(inv.get("val")), "place_of_supply": inv.get("pos"),
                             "taxable_value": txval, "rate": rt, "igst": iamt, "cgst": camt, "sgst": samt})
    # B2C large (inter-state > threshold)
    for pos_blk in data.get("b2cl", []) or []:
        for inv in pos_blk.get("inv", []) or []:
            for it in inv.get("itms", []) or []:
                iamt, camt, samt, txval, rt = _itm_tax(it.get("itm_det", {}))
                rows.append({"section": "b2cl", "gstin": None, "party_name": None,
                             "invoice_number": inv.get("inum"), "invoice_date": inv.get("idt"),
                             "invoice_value": _num(inv.get("val")), "place_of_supply": pos_blk.get("pos"),
                             "taxable_value": txval, "rate": rt, "igst": iamt, "cgst": camt, "sgst": samt})
    # B2C small (rate-wise summary)
    for s in data.get("b2cs", []) or []:
        rows.append({"section": "b2cs", "gstin": None, "party_name": None, "invoice_number": None,
                     "invoice_date": None, "invoice_value": None, "place_of_supply": s.get("pos"),
                     "taxable_value": _num(s.get("txval")), "rate": _num(s.get("rt")),
                     "igst": _num(s.get("iamt")), "cgst": _num(s.get("camt")), "sgst": _num(s.get("samt"))})
    return rows


def parse_gstr2b(data: dict, firm_id: str, period_key: str) -> list:
    rows = []
    d = data.get("data") if isinstance(data.get("data"), dict) else data
    doc = d.get("docdata") or {}
    for sup in doc.get("b2b", []) or []:
        ctin = sup.get("ctin")
        for inv in sup.get("inv", []) or []:
            rows.append({"section": "2b_itc", "gstin": ctin, "party_name": sup.get("trdnm"),
                         "invoice_number": inv.get("inum"), "invoice_date": inv.get("dt") or inv.get("idt"),
                         "invoice_value": _num(inv.get("val")), "place_of_supply": inv.get("pos"),
                         "taxable_value": _num(inv.get("txval")), "rate": _num(inv.get("rt")),
                         "igst": _num(inv.get("igst")), "cgst": _num(inv.get("cgst")), "sgst": _num(inv.get("sgst"))})
    return rows


def parse_gstr3b(data: dict, firm_id: str, period_key: str) -> dict:
    sup = (data.get("sup_details") or {}).get("osup_det") or {}
    itc = (data.get("itc_elg") or {}).get("itc_net") or (data.get("itc_elg") or {}).get("itc_avl") or {}
    if isinstance(itc, list):  # itc_avl is a list of categories
        itc = {"iamt": sum(_num(x.get("iamt")) for x in itc), "camt": sum(_num(x.get("camt")) for x in itc),
               "samt": sum(_num(x.get("samt")) for x in itc)}
    out_tax = _num(sup.get("iamt")) + _num(sup.get("camt")) + _num(sup.get("samt"))
    itc_tax = _num(itc.get("iamt")) + _num(itc.get("camt")) + _num(itc.get("samt"))
    return {"section": "3b_summary", "outward_taxable": _num(sup.get("txval")),
            "outward_tax": round(out_tax, 2), "itc_tax": round(itc_tax, 2),
            "net_liability": round(out_tax - itc_tax, 2)}


def parse(data: dict, firm_id: str, period_override: str = None):
    """Returns (return_type, period_key, rows, summary). rows for 1/2b; summary for 3b."""
    rtype = detect_return_type(data)
    if not rtype:
        raise ValueError("Could not detect return type — expected GSTR-1, GSTR-2B or GSTR-3B portal JSON.")
    d = data.get("data") if (rtype == "gstr2b" and isinstance(data.get("data"), dict)) else data
    period_key = period_override or _find_period(data)
    if rtype == "gstr1":
        return rtype, period_key, parse_gstr1(data, firm_id, period_key), None
    if rtype == "gstr2b":
        return rtype, period_key, parse_gstr2b(d, firm_id, period_key), None
    return rtype, period_key, [], parse_gstr3b(data, firm_id, period_key)

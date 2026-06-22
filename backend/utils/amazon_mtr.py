"""Parse the Amazon GST MTR (Merchant Tax Report) CSV — the bridge that maps each Amazon ORDER ID to
the seller INVOICE NUMBER that ends up in GSTR-1. Without it, CRM amazon_orders (keyed by order id) can't
be matched to filed GSTR-1 invoices (keyed by invoice number). Amazon's column names vary, so headers are
normalized and matched against candidate lists. Aggregates the line-level rows up to one row per invoice.
"""
import csv
import io
import re
from collections import defaultdict


def _norm_hdr(h):
    return re.sub(r"[^a-z0-9]", "", str(h or "").lower())


# candidate normalized headers per field (Amazon varies these across report versions/marketplaces)
_FIELDS = {
    "invoice_number": ["invoicenumber", "invoiceno"],
    "invoice_date": ["invoicedate"],
    "order_id": ["orderid", "amazonorderid"],
    "transaction_type": ["transactiontype"],
    "buyer_gstin": ["customerbilltogstid", "buyergstin", "billtogstid", "customergstin"],
    "ship_state": ["shiptostate", "shipfromstate", "statecode"],
    "taxable": ["taxexclusivegross", "principalamount", "taxablevalue", "taxexclusivegrossamt"],
    "igst": ["igsttax", "igstamount", "igsttaxamount"],
    "cgst": ["cgsttax", "cgstamount", "cgsttaxamount"],
    "sgst": ["sgsttax", "sgstamount", "sgsttaxamount", "utgsttax"],
    "total_tax": ["totaltaxamount", "taxamount"],
    "invoice_value": ["invoiceamount", "totalamount"],
}


def _num(x):
    try:
        return round(float(str(x).replace(",", "").strip() or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _period_from_date(d):
    """Amazon dates vary: 'DD-MM-YYYY', 'DD.MM.YYYY', 'YYYY-MM-DD', 'DD MMM YYYY'. Returns YYYY-MM or ''."""
    s = str(d or "").strip()
    m = re.match(r"(\d{4})-(\d{2})-\d{2}", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    m = re.match(r"(\d{2})[-./](\d{2})[-./](\d{4})", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}"
    return ""


def parse_mtr_csv(raw: bytes):
    """Returns {invoices: {invoice_number: {...aggregated...}}, line_count, period_key}.
    Only SHIPMENT-type rows are treated as outward invoices; refunds/cancels are tagged but not summed
    into the outward invoice (they're credit notes)."""
    text = raw.decode("utf-8-sig", "replace") if isinstance(raw, (bytes, bytearray)) else raw
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("Empty or unreadable CSV.")
    hmap = {_norm_hdr(h): h for h in reader.fieldnames}

    def col(field):
        for cand in _FIELDS[field]:
            if cand in hmap:
                return hmap[cand]
        return None

    cols = {f: col(f) for f in _FIELDS}
    if not cols["invoice_number"] or not cols["order_id"]:
        raise ValueError("This doesn't look like an Amazon MTR — missing 'Invoice Number' / 'Order Id' columns.")

    inv = {}
    line_count = 0
    periods = defaultdict(int)
    for row in reader:
        line_count += 1
        inum = (row.get(cols["invoice_number"]) or "").strip()
        if not inum:
            continue
        ttype = (row.get(cols["transaction_type"]) if cols["transaction_type"] else "") or ""
        is_refund = "refund" in ttype.lower() or "cancel" in ttype.lower()
        e = inv.setdefault(inum, {
            "invoice_number": inum, "order_id": (row.get(cols["order_id"]) or "").strip(),
            "invoice_date": row.get(cols["invoice_date"]) if cols["invoice_date"] else None,
            "transaction_type": ttype, "buyer_gstin": (row.get(cols["buyer_gstin"]) or "").strip() if cols["buyer_gstin"] else "",
            "ship_state": (row.get(cols["ship_state"]) or "").strip() if cols["ship_state"] else "",
            "taxable": 0.0, "igst": 0.0, "cgst": 0.0, "sgst": 0.0, "is_refund": is_refund})
        sign = -1 if is_refund else 1
        for f in ("taxable", "igst", "cgst", "sgst"):
            if cols[f]:
                e[f] = round(e[f] + sign * _num(row.get(cols[f])), 2)
        pk = _period_from_date(e["invoice_date"])
        if pk:
            periods[pk] += 1
    period_key = max(periods, key=periods.get) if periods else ""
    for e in inv.values():
        e["tax"] = round(e["igst"] + e["cgst"] + e["sgst"], 2)
        e["is_b2b"] = bool(e.get("buyer_gstin"))
    return {"invoices": inv, "line_count": line_count, "period_key": period_key}

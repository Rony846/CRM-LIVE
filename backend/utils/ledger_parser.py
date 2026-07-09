"""Parse a supplier party-ledger PDF (Tally/Vyapar export of a group firm's account in a supplier's
books) into a structured {supplier, buyer, period, invoices[]} for GSTR-2A reconciliation.

The ledger's INVOICE rows (the firm's purchases) carry a Vch/invoice number like AT/26-27/105 or
PLE/26-27/0465 — that's the reconciliation anchor matched against the firm's 2A. Receipt/bank rows
have plain numeric voucher numbers and are ignored."""
import re
import subprocess

# Invoice-number formats seen: AT/26-27/105, PLE/26-27/0465, MGIPL/CN/26-27/6 — letters, an FY, digits.
_INV_RE = re.compile(r'\b([A-Z]{2,6}(?:/[A-Z]{1,4})?/\d{2}-\d{2}/\d+)\b')
_AMT_RE = re.compile(r'\b(\d{1,3}(?:,\d{2,3})*\.\d{2})\b')
_DATE_RE = re.compile(r'\b(\d{1,2}-[A-Za-z]{3}-\d{2,4})\b')
_MON = {"jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
        "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12"}


def _iso(d: str) -> str:
    m = re.match(r'(\d{1,2})-([A-Za-z]{3})-(\d{2,4})', d or "")
    if not m:
        return ""
    y = m.group(3)
    y = ("20" + y) if len(y) == 2 else y
    return f"{y}-{_MON.get(m.group(2).lower(), '01')}-{int(m.group(1)):02d}"


def pdf_to_text(path: str) -> str:
    """Extract text with column layout preserved (poppler pdftotext -layout)."""
    return subprocess.run(["pdftotext", "-layout", path, "-"],
                          capture_output=True, text=True, timeout=60).stdout


def parse_supplier_ledger(path: str) -> dict:
    text = pdf_to_text(path)
    lines = [ln.rstrip() for ln in text.splitlines()]
    nonblank = [ln.strip() for ln in lines if ln.strip()]

    supplier = nonblank[0] if nonblank else ""
    # buyer firm = the line immediately before "Ledger Account"
    buyer = ""
    for i, ln in enumerate(nonblank):
        if ln.lower() == "ledger account" and i > 0:
            buyer = nonblank[i - 1]
            break
    period = ""
    for ln in nonblank:
        pm = re.search(r'(\d{1,2}-[A-Za-z]{3}-\d{2,4})\s+to\s+(\d{1,2}-[A-Za-z]{3}-\d{2,4})', ln)
        if pm:
            period = f"{_iso(pm.group(1))} to {_iso(pm.group(2))}"
            break

    invoices = []
    seen = set()
    cur_date = ""   # Tally omits the date on rows sharing the prior row's date — carry it forward.
    for ln in lines:
        dm = _DATE_RE.search(ln)
        if dm:
            cur_date = _iso(dm.group(1))
        m = _INV_RE.search(ln)
        if not m:
            continue
        num = m.group(1)
        amts = [float(a.replace(",", "")) for a in _AMT_RE.findall(ln)]
        # The invoice amount is the first monetary figure at/after the invoice number (before any
        # running-balance column). Fall back to the max on the line.
        after = ln[m.end():]
        amt_after = _AMT_RE.findall(after)
        val = float(amt_after[0].replace(",", "")) if amt_after else (max(amts) if amts else 0.0)
        key = (num, round(val, 2))
        if key in seen:
            continue
        seen.add(key)
        invoices.append({"number": num, "value": round(val, 2),
                         "date": (_iso(dm.group(1)) if dm else cur_date), "raw": ln.strip()})
    return {"supplier": supplier, "buyer": buyer, "period": period, "invoices": invoices,
            "invoice_count": len(invoices)}

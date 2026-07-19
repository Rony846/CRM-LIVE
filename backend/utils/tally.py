"""Read-only TallyPrime connector.

Tally exposes an XML/HTTP API on port 9000; we reach it over Tailscale. This module ONLY sends
`Export` requests (reads) — it NEVER sends `Import` (which would write/modify vouchers in Tally).
Nothing here changes anything in Tally. It mirrors party ledgers + balances into db.tally_ledgers
so the CRM can show real, authoritative outstanding balances.
"""
import os
import re
import logging
import httpx

logger = logging.getLogger(__name__)

# Default host = the laptop running Tally, on Tailscale. Override with TALLY_HOST.
_DEFAULT_HOST = "http://100.80.115.50:9000"


def host() -> str:
    return os.environ.get("TALLY_HOST", _DEFAULT_HOST).rstrip("/")


def enabled() -> bool:
    return os.environ.get("TALLY_SYNC_ENABLED", "1").strip().lower() in ("1", "true", "yes", "on")


async def _post(xml: str, timeout: float = 60.0) -> str | None:
    """POST an XML request to Tally and return the raw XML text (or None if unreachable)."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as c:
            r = await c.post(host(), content=xml.encode("utf-8"),
                             headers={"Content-Type": "text/xml"})
            # Tally's response Content-Type can claim utf-16 while the bytes are utf-8/ascii,
            # which makes httpx's r.text raise "UTF-16 stream does not start with BOM". Decode
            # the raw bytes ourselves: honour a real BOM, else utf-8.
            raw = r.content
            if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
                return raw.decode("utf-16", errors="replace")
            return raw.decode("utf-8", errors="replace")
    except Exception as e:
        logger.warning(f"tally request failed ({host()}): {str(e)[:120]}")
        return None


def _unescape(s: str) -> str:
    if not s:
        return s
    return (s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
             .replace("&quot;", '"').replace("&apos;", "'").replace("&#4;", "").strip())


def _ledgers_request(company: str | None = None) -> str:
    """Export the Ledger collection with the fields we care about. Read-only (ISMODIFY=No)."""
    sv = f"<SVCURRENTCOMPANY>{company}</SVCURRENTCOMPANY>" if company else ""
    return (
        "<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST>"
        "<TYPE>Collection</TYPE><ID>CRMLedgers</ID></HEADER><BODY><DESC><STATICVARIABLES>"
        f"<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>{sv}</STATICVARIABLES>"
        '<TDL><TDLMESSAGE><COLLECTION NAME="CRMLedgers" ISMODIFY="No">'
        "<TYPE>Ledger</TYPE>"
        "<NATIVEMETHOD>Name</NATIVEMETHOD><NATIVEMETHOD>Parent</NATIVEMETHOD>"
        "<NATIVEMETHOD>ClosingBalance</NATIVEMETHOD><NATIVEMETHOD>OpeningBalance</NATIVEMETHOD>"
        "<NATIVEMETHOD>PartyGSTIN</NATIVEMETHOD><NATIVEMETHOD>LedgerMailingName</NATIVEMETHOD>"
        "<NATIVEMETHOD>LedgerPhone</NATIVEMETHOD><NATIVEMETHOD>LedgerContact</NATIVEMETHOD>"
        "</COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>"
    )


def _companies_request() -> str:
    return (
        "<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST>"
        "<TYPE>Collection</TYPE><ID>CRMCmp</ID></HEADER><BODY><DESC><STATICVARIABLES>"
        "<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>"
        '<TDL><TDLMESSAGE><COLLECTION NAME="CRMCmp" ISMODIFY="No"><TYPE>Company</TYPE>'
        "<NATIVEMETHOD>Name</NATIVEMETHOD></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>"
    )


async def loaded_companies() -> list[str]:
    """All companies currently loaded in Tally. If more than one is loaded, a raw Collection
    export MERGES them (Tally quirk) — so we must sync with exactly one loaded to stay accurate."""
    xml = await _post(_companies_request(), timeout=20)
    if not xml:
        return []
    return [_unescape(m) for m in re.findall(r'<COMPANY[^>]*NAME="([^"]+)"', xml)]


async def current_company() -> str | None:
    """Name of the company currently loaded in Tally (first, if several)."""
    names = await loaded_companies()
    return names[0] if names else None


def _num(block: str, tag: str) -> float:
    m = re.search(rf"<{tag}[^>]*>(-?[0-9.]+)</{tag}>", block)
    try:
        return float(m.group(1)) if m else 0.0
    except (ValueError, TypeError):
        return 0.0


def _txt(block: str, tag: str) -> str | None:
    m = re.search(rf"<{tag}[^>]*>([^<]*)</{tag}>", block)
    return _unescape(m.group(1)) if m and m.group(1).strip() else None


def parse_ledgers(xml_text: str) -> list[dict]:
    """Parse a Ledger-collection export into normalized dicts.

    Tally sign convention: ClosingBalance positive = Debit, negative = Credit. So for a supplier
    (Sundry Creditors) a negative balance = we OWE them (payable); for a customer (Sundry Debtors)
    a positive balance = they owe us (receivable). We keep the raw signed value and expose helpers.
    """
    out = []
    for block in re.split(r"<LEDGER ", xml_text or "")[1:]:
        nm = re.search(r'NAME="([^"]+)"', block)
        if not nm:
            continue
        name = _unescape(nm.group(1))
        parent = _txt(block, "PARENT") or ""
        cb = _num(block, "CLOSINGBALANCE")
        low = parent.lower()
        is_creditor = "creditor" in low
        is_debtor = "debtor" in low
        # Tally's ClosingBalance sign (Dr/Cr) is version-dependent and unreliable to interpret, so
        # derive the relationship from the ledger GROUP and use the magnitude: a Sundry Creditor's
        # balance is a payable (we owe the supplier), a Sundry Debtor's is a receivable (customer owes
        # us). Advances (opposite-sign) are rare and the accountant reviews them off the raw balance.
        payable = abs(cb) if is_creditor else 0.0
        receivable = abs(cb) if is_debtor else 0.0
        out.append({
            "ledger_name": name,
            "parent": parent,
            "closing_balance": round(cb, 2),
            "opening_balance": round(_num(block, "OPENINGBALANCE"), 2),
            "gstin": _txt(block, "PARTYGSTIN"),
            "mailing_name": _txt(block, "LEDGERMAILINGNAME"),
            "phone": _txt(block, "LEDGERPHONE") or _txt(block, "LEDGERCONTACT"),
            "is_creditor": is_creditor,
            "is_debtor": is_debtor,
            "payable": round(payable, 2),
            "receivable": round(receivable, 2),
        })
    return out


async def fetch_ledgers(company: str | None = None) -> tuple[str | None, list[dict]]:
    """Return (company_name, ledgers). Reads whatever company is loaded unless one is named."""
    xml = await _post(_ledgers_request(company))
    if xml is None:
        return (None, [])
    cmp_name = company or await current_company() or "loaded"
    return (cmp_name, parse_ledgers(xml))

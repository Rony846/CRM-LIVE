"""Ingest Amazon transactional emails (A-to-z claims + refunds) from the service@ mailbox into the CRM.

Amazon notifies us by email for every A-to-z Guarantee claim and every refund — but the API/MTR imports
lag and miss seller-fulfilled A-to-z events. This module reads those emails directly over IMAP
(read-only PEEK, never marks seen) and keeps two collections live:

  • az_claims        — "Claim received …"  → under_review ;  "Claim decision …" → granted / denied
  • amazon_refunds   — "Refund Initiated for Order …" → a refund row (deduped against settlement rows)

Pure IMAP + regex, no external/LLM/paid API. Idempotent: re-running never duplicates (claims keyed by
order_id, refunds keyed by order_id+source, emails logged by message_id). Behind AMAZON_EMAIL_INGEST_ENABLED.

Public:
  enabled() -> bool
  await ingest(db, write=True, since_days=None, limit=4000) -> dict   # stats
"""
import os, re, imaplib, email, uuid, logging
from datetime import datetime, timezone
from email.header import decode_header

logger = logging.getLogger(__name__)

_AMZ = re.compile(r"\d{3}-\d{7}-\d{7}")
# greeting → firm fallback (order lookup is primary). EBAY/Electronics-Bay left out — too ambiguous.
_GREETING_FIRM = {
    "mgig": "MuscleGrid Industries Gurgaon",
    "mgipl": "MGIPL",
    "spv": "SPV Industries",
}


def enabled() -> bool:
    return os.environ.get("AMAZON_EMAIL_INGEST_ENABLED", "").strip().lower() in ("1", "true", "yes", "on")


# ---------------- IMAP ----------------
def _imap_conn():
    host = os.environ.get("EMAIL_AGENT_IMAP_HOST", "imappro.zoho.in").strip()
    port = int(os.environ.get("EMAIL_AGENT_IMAP_PORT", "993"))
    box = imaplib.IMAP4_SSL(host, port)
    box.login(os.environ["EMAIL_AGENT_EMAIL"], os.environ["EMAIL_AGENT_PASSWORD"])
    box.select("INBOX", readonly=True)
    return box


def _dh(s) -> str:
    try:
        return "".join(p.decode(e or "utf-8", "replace") if isinstance(p, bytes) else p
                       for p, e in decode_header(s or ""))
    except Exception:
        return s or ""


def _clean_html(msg) -> str:
    html = ""
    parts = msg.walk() if msg.is_multipart() else [msg]
    for p in parts:
        if p.get_content_type() == "text/html":
            try:
                html = p.get_payload(decode=True).decode(p.get_content_charset() or "utf-8", "replace")
                break
            except Exception:
                pass
    if not html:
        for p in (msg.walk() if msg.is_multipart() else [msg]):
            if p.get_content_type() == "text/plain":
                try:
                    return p.get_payload(decode=True).decode(p.get_content_charset() or "utf-8", "replace")
                except Exception:
                    pass
        return ""
    html = re.sub(r"(?is)<(style|script|head).*?</\1>", " ", html)
    txt = re.sub(r"(?i)<br\s*/?>", "\n", html)
    txt = re.sub(r"(?i)</(p|div|tr|td|h\d|li)>", "\n", txt)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = txt.replace("&nbsp;", " ").replace("&amp;", "&").replace("&#39;", "'")
    txt = re.sub(r"&#\d+;", " ", txt)
    txt = re.sub(r"[ \t]+", " ", txt)
    return "\n".join(l.strip() for l in txt.splitlines() if l.strip())


def _fetch_blocking(since_days=None, limit=4000) -> list:
    box = _imap_conn()
    out, seen_uids = [], set()
    since = ""
    if since_days:
        d = datetime.now(timezone.utc).timestamp() - since_days * 86400
        since = datetime.utcfromtimestamp(d).strftime("%d-%b-%Y")
    criteria = [
        '(FROM "atoz-guarantee")',          # claim received + claim decision (both .com/.in)
        '(SUBJECT "Refund Initiated")',     # seller-central refund notifications
    ]
    try:
        for crit in criteria:
            full = f'(SINCE "{since}" {crit[1:]}' if since else crit
            typ, data = box.uid("search", None, full)
            uids = (data[0].split() if data and data[0] else [])[-limit:]
            for u in uids:
                if u in seen_uids:
                    continue
                seen_uids.add(u)
                typ, md = box.uid("fetch", u, "(BODY.PEEK[])")
                if not (md and md[0]):
                    continue
                msg = email.message_from_bytes(md[0][1])
                out.append({
                    "uid": u.decode() if isinstance(u, bytes) else str(u),
                    "message_id": (msg.get("Message-ID") or "").strip(),
                    "subject": _dh(msg.get("Subject")),
                    "from": _dh(msg.get("From")),
                    "date": msg.get("Date"),
                    "text": _clean_html(msg),
                })
    finally:
        try:
            box.logout()
        except Exception:
            pass
    return out


# ---------------- parsing ----------------
def _amt(s):
    m = re.search(r"(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d+)?)", s)
    return round(float(m.group(1).replace(",", "")), 2) if m else 0.0


def _date_iso(raw):
    try:
        return email.utils.parsedate_to_datetime(raw).astimezone(timezone.utc).date().isoformat()
    except Exception:
        return datetime.now(timezone.utc).date().isoformat()


def _firm_from_greeting(text):
    m = re.search(r"(?:Hello|Dear)\s+([A-Za-z][\w &().-]{1,40})", text)
    if not m:
        return None
    g = m.group(1).strip().lower()
    for k, firm in _GREETING_FIRM.items():
        if k in g:
            return firm
    return None


def classify(subject):
    s = (subject or "").lower()
    if "refund initiated" in s:
        return "refund"
    if "claim decision" in s:
        return "decision"
    if "claim received" in s or "a-to-z guarantee claim for order" in s:
        return "received"
    return None


# ---------------- ingest ----------------
async def _firm(db, order_id, text):
    ao = await db.amazon_orders.find_one({"amazon_order_id": order_id}, {"firm_id": 1, "firm_name": 1, "buyer_name": 1})
    if ao and ao.get("firm_id"):
        return ao.get("firm_id"), ao.get("firm_name") or "", ao.get("buyer_name") or ""
    for coll in ("amazon_refunds", "az_claims"):
        r = await db[coll].find_one({"$or": [{"amazon_order_id": order_id}, {"order_id": order_id}]},
                                    {"firm_id": 1, "firm_name": 1})
        if r and r.get("firm_id"):
            return r.get("firm_id"), r.get("firm_name") or "", ""
    name = _firm_from_greeting(text)
    if name:
        f = await db.firms.find_one({"name": name}, {"id": 1})
        if f:
            return f.get("id"), name, ""
    return None, name or "", ""


async def ingest(db, write=True, since_days=None, limit=4000) -> dict:
    """Read Amazon claim/refund emails and upsert az_claims + amazon_refunds. Returns stats."""
    st = {"emails": 0, "claims_new": 0, "claims_decided": 0, "refunds_new": 0,
          "refunds_confirmed": 0, "skipped_seen": 0, "unparsed": 0}
    emails = _fetch_blocking(since_days=since_days, limit=limit)
    st["emails"] = len(emails)
    now = datetime.now(timezone.utc).isoformat()

    for e in emails:
        kind = classify(e["subject"])
        oid_m = _AMZ.search(e["subject"]) or _AMZ.search(e["text"])
        if not kind or not oid_m:
            st["unparsed"] += 1
            continue
        oid = oid_m.group(0)
        mid = e["message_id"] or f"{kind}:{oid}:{e['uid']}"
        if write and await db.amazon_email_ingest_seen.find_one({"message_id": mid}, {"_id": 1}):
            st["skipped_seen"] += 1
            continue
        cdate = _date_iso(e["date"])
        amount = _amt(e["text"])
        firm_id, firm_name, buyer = await _firm(db, oid, e["text"])

        if kind in ("received", "decision"):
            existing = await db.az_claims.find_one({"order_id": oid})
            if kind == "received":
                if not existing and write:
                    await db.az_claims.insert_one({
                        "id": str(uuid.uuid4()), "order_id": oid, "claim_date": cdate, "sources": ["email"],
                        "customer": buyer, "phone": "", "product": "", "firm_name": firm_name, "firm_id": firm_id,
                        "amount_at_risk": amount, "status": "under_review", "outcome": None,
                        "notes": "", "source_tag": "amazon_email_ingest", "created_at": now, "updated_at": now})
                    st["claims_new"] += 1
            else:  # decision
                low = e["text"].lower()
                # granted = debited from us = real loss.  closed/denied = no debit, in our favour.
                if re.search(r"we have granted|claim has been granted|granted an a-to-z", low):
                    outcome = "granted"
                elif re.search(r"we have closed|claim remains closed", low):
                    outcome = "closed"
                elif re.search(r"we have denied|we have declined|claim (?:has been|was) denied|not been granted", low):
                    outcome = "denied"
                else:
                    outcome = "decided"
                status = outcome
                reason = ""
                rm = re.search(r"the customer claimed ([^.]+)\.", e["text"], re.I)
                if rm:
                    reason = rm.group(1).strip()[:120]
                if write:
                    sets = {"status": status, "outcome": outcome, "decision_date": cdate, "updated_at": now,
                            "decision_amount": amount or (existing or {}).get("amount_at_risk")}
                    if reason:
                        sets["notes"] = (((existing or {}).get("notes") or "") + f" | decision: {reason}").strip(" |")
                    if existing:
                        await db.az_claims.update_one({"order_id": oid}, {"$set": sets})
                    else:
                        await db.az_claims.insert_one({
                            "id": str(uuid.uuid4()), "order_id": oid, "claim_date": cdate, "sources": ["email"],
                            "customer": buyer, "phone": "", "product": "", "firm_name": firm_name, "firm_id": firm_id,
                            "amount_at_risk": amount, "source_tag": "amazon_email_ingest", "created_at": now, **sets})
                    st["claims_decided"] += 1

        elif kind == "refund":
            cust = ""
            cm = re.search(r"refund of (?:INR|₹|Rs\.?)?\s*[\d,]+(?:\.\d+)?\s+to\s+([A-Za-z][A-Za-z .'-]+?)\s+for",
                           e["text"], re.I)
            if cm:
                cust = cm.group(1).strip()[:60]
            res = ""
            resm = re.search(r"Refund Resolution/Issuer:\s*([^\n]+)", e["text"], re.I)
            if resm:
                res = resm.group(1).strip()[:60]
            reason = ""
            rsm = re.search(r"(Order not received|Item (?:defective|not as described)|"
                            r"Customer (?:return|cancel\w*)|No longer needed|[A-Z][a-z][^\n]{3,40})\s*$",
                            e["text"].strip())
            if rsm:
                reason = rsm.group(1).strip()[:80]
            rtype = "a_to_z_claim" if "a-to-z" in res.lower() else ("return_refund" if "return" in res.lower() else "refund")
            existing = await db.amazon_refunds.find_one({"amazon_order_id": oid})
            if write:
                if existing:
                    await db.amazon_refunds.update_one({"id": existing["id"]}, {"$set": {
                        "email_refund_confirmed": True, "email_refund_amount": amount, "email_refund_date": cdate,
                        "email_refund_reason": reason or res, "email_buyer_name": cust, "updated_at": now,
                        **({"a_to_z_outcome": "granted"} if rtype == "a_to_z_claim"
                           and (existing.get("a_to_z_outcome") in (None, "", "NA", "pending")) else {})}})
                    st["refunds_confirmed"] += 1
                else:
                    await db.amazon_refunds.insert_one({
                        "id": str(uuid.uuid4()), "amazon_order_id": oid, "firm_id": firm_id,
                        "refund_event_id": f"email-{mid[:60]}", "refund_amount": amount, "refund_date": cdate,
                        "currency": "INR", "refund_type": rtype,
                        "refund_reason": reason or res or "Amazon refund (email)",
                        "a_to_z_outcome": "granted" if rtype == "a_to_z_claim" else "NA",
                        "is_fake": False, "is_disputed": False, "dispute_notes": "",
                        "email_buyer_name": cust, "email_refund_confirmed": True,
                        "source": "email_refund_initiated", "source_doc_id": mid,
                        "created_by": "system", "created_by_name": "Amazon Email Ingest",
                        "created_at": now, "updated_at": now})
                    st["refunds_new"] += 1

        if write:
            await db.amazon_email_ingest_seen.update_one(
                {"message_id": mid}, {"$set": {"message_id": mid, "kind": kind, "order_id": oid, "at": now}},
                upsert=True)
    return st

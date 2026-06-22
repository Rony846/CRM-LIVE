"""Amazon return-OTP gate: read the daily "Return Notification for Proof of Delivery" emails and hold
each batch's OTP until every listed parcel is physically scanned inward at the gate.

Amazon mails an OTP per return-delivery trip: "agent is out to return N of your packages, key in OTP
NNNNNN on the handheld device", plus a table of Order ID + Tracking number + Product + Return reason.
We parse that into db.return_otp_batches, keep the OTP hidden, and only release it once all the listed
tracking IDs have matched inward gate scans (gate_logs). Stops staff accepting returns that aren't
physically in hand.

Pure IMAP + regex, free. Public:
  enabled() -> bool
  await ingest_batches(db, since_days=None) -> dict          # parse emails → batches
  await match_inward_scan(db, tracking_id, by=None, by_name=None) -> dict|None   # gate-scan hook
"""
import os, re, email, uuid, logging
from datetime import datetime, timezone

from . import amazon_email_ingest as aei   # reuse IMAP conn + html cleaner + _dh

logger = logging.getLogger(__name__)

_AMZ = re.compile(r"\d{3}-\d{7}-\d{7}")


def enabled() -> bool:
    return os.environ.get("RETURN_OTP_ENABLED", "").strip().lower() in ("1", "true", "yes", "on")


def _fetch_pod_blocking(since_days=None, limit=2000) -> list:
    box = aei._imap_conn()
    out = []
    since = ""
    if since_days:
        ts = datetime.now(timezone.utc).timestamp() - since_days * 86400
        since = datetime.utcfromtimestamp(ts).strftime("%d-%b-%Y")
    crit = '(SUBJECT "Proof of Delivery")'
    if since:
        crit = f'(SINCE "{since}" SUBJECT "Proof of Delivery")'
    try:
        typ, data = box.uid("search", None, crit)
        uids = (data[0].split() if data and data[0] else [])[-limit:]
        for u in uids:
            typ, md = box.uid("fetch", u, "(BODY.PEEK[])")
            if not (md and md[0]):
                continue
            msg = email.message_from_bytes(md[0][1])
            out.append({"message_id": (msg.get("Message-ID") or "").strip(),
                        "subject": aei._dh(msg.get("Subject")), "date": msg.get("Date"),
                        "text": aei._clean_html(msg)})
    finally:
        try:
            box.logout()
        except Exception:
            pass
    return out


def parse_pod(text: str) -> dict | None:
    """Parse a Proof-of-Delivery return email into {otp, agent, valid_through, items[...]}."""
    if "key in the OTP" not in text and "key in OTP" not in text:
        return None
    otp = re.search(r"key in (?:the )?OTP\s+(\d{4,8})", text, re.I)
    valid = re.search(r"valid through (\d{2}-\d{2}-\d{4})", text, re.I)
    agent = re.search(r"agent\s*\(([^/]+?)\s*/\s*PhnNo\.?\s*([+\d]+)", text)
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    items = []
    for i, l in enumerate(lines):
        if _AMZ.fullmatch(l):
            trk = lines[i + 1] if i + 1 < len(lines) else ""
            if len(re.sub(r"\D", "", trk)) < 10:      # next line must look like a tracking number
                continue
            prod = lines[i + 2] if i + 2 < len(lines) else ""
            reason = lines[i + 3] if i + 3 < len(lines) else ""
            items.append({"order_id": l, "tracking_id": re.sub(r"\s", "", trk),
                          "product": prod[:120], "reason": reason[:60]})
    if not items:
        return None
    return {
        "otp": otp.group(1) if otp else "",
        "agent_name": agent.group(1).strip() if agent else "",
        "agent_phone": agent.group(2) if agent else "",
        "valid_through": valid.group(1) if valid else "",
        "items": items,
    }


async def _firm_for(db, order_id):
    ao = await db.amazon_orders.find_one({"amazon_order_id": order_id}, {"firm_id": 1, "firm_name": 1})
    if ao:
        return ao.get("firm_id"), ao.get("firm_name") or ""
    return None, ""


async def ingest_batches(db, since_days=None, limit=2000) -> dict:
    """Parse Proof-of-Delivery emails into db.return_otp_batches (deduped by tracking-set). Never
    overwrites scan progress on an existing batch. Returns stats incl. `new` (the freshly-created
    batches, so the caller can send a heads-up)."""
    st = {"emails": 0, "batches_new": 0, "batches_seen": 0, "parcels": 0, "new": []}
    now = datetime.now(timezone.utc).isoformat()
    for e in _fetch_pod_blocking(since_days=since_days, limit=limit):
        st["emails"] += 1
        p = parse_pod(e["text"])
        if not p:
            continue
        trks = sorted(it["tracking_id"] for it in p["items"])
        batch_key = "|".join(trks)                      # resends share the same tracking-set
        if await db.return_otp_batches.find_one({"batch_key": batch_key}, {"_id": 1}):
            st["batches_seen"] += 1
            await db.return_otp_batches.update_one(
                {"batch_key": batch_key}, {"$addToSet": {"message_ids": e["message_id"]}})
            continue
        items = []
        firm_counts = {}
        for it in p["items"]:
            fid, fname = await _firm_for(db, it["order_id"])
            firm_counts[fname or "?"] = firm_counts.get(fname or "?", 0) + 1
            items.append({**it, "firm_id": fid, "firm_name": fname,
                          "scanned": False, "scanned_at": None, "scanned_by": None})
        firm = max(firm_counts, key=firm_counts.get)    # primary firm — OTP is firm-wise
        doc = {
            "id": str(uuid.uuid4()), "batch_key": batch_key, "otp": p["otp"],
            "firm": firm, "firm_names": sorted(firm_counts),
            "agent_name": p["agent_name"], "agent_phone": p["agent_phone"],
            "valid_through": p["valid_through"], "email_date": aei._date_iso(e["date"]),
            "items": items, "total": len(items), "scanned_count": 0,
            "status": "pending", "otp_released": False, "released_at": None,
            "notified": False, "heads_up_sent": False, "expired_flagged": False,
            "message_ids": [e["message_id"]], "created_at": now, "updated_at": now}
        await db.return_otp_batches.insert_one(doc)
        st["batches_new"] += 1
        st["parcels"] += len(items)
        st["new"].append(doc)
    return st


def _valid_through_date(s):
    """Amazon prints validity as MM-DD-YYYY → date string YYYY-MM-DD (or None)."""
    m = re.match(r"(\d{2})-(\d{2})-(\d{4})", str(s or ""))
    return f"{m.group(3)}-{m.group(1)}-{m.group(2)}" if m else None


async def flag_expired(db):
    """Flag pending batches whose validity date has passed with parcels still un-scanned — a return
    that never physically arrived (or the OTP window lapsed). Returns the newly-flagged batches."""
    today = datetime.now(timezone.utc).date().isoformat()
    now = datetime.now(timezone.utc).isoformat()
    flagged = []
    async for b in db.return_otp_batches.find({"status": "pending", "expired_flagged": {"$ne": True}}):
        vd = _valid_through_date(b.get("valid_through")) or b.get("email_date")
        if vd and vd < today:
            await db.return_otp_batches.update_one(
                {"id": b["id"]}, {"$set": {"status": "expired", "expired_flagged": True, "updated_at": now}})
            flagged.append(b)
    return flagged


async def match_inward_scan(db, tracking_id, by=None, by_name=None) -> dict | None:
    """Gate-scan hook: mark a parcel scanned in its open batch. Returns the batch dict with a
    'just_completed' flag when this scan was the last one (caller releases + notifies)."""
    tid = re.sub(r"\s", "", str(tracking_id or ""))
    if not tid:
        return None
    batch = await db.return_otp_batches.find_one(
        {"status": "pending", "items": {"$elemMatch": {"tracking_id": tid, "scanned": False}}})
    if not batch:
        return None
    now = datetime.now(timezone.utc).isoformat()
    items = batch["items"]
    for it in items:
        if it["tracking_id"] == tid and not it["scanned"]:
            it["scanned"] = True
            it["scanned_at"] = now
            it["scanned_by"] = by_name or by
            break
    scanned_count = sum(1 for it in items if it["scanned"])
    completed = scanned_count >= len(items)
    sets = {"items": items, "scanned_count": scanned_count, "updated_at": now}
    if completed:
        sets.update({"status": "complete", "otp_released": True, "released_at": now})
    await db.return_otp_batches.update_one({"id": batch["id"]}, {"$set": sets})
    batch.update(sets)
    batch["just_completed"] = completed
    return batch

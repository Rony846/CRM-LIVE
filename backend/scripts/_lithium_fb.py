#!/usr/bin/env python3
"""Shared collector: negative feedback from the lithium feedback drive, across WhatsApp + email.
Used by lithium_complaints_email.py (initial) and lithium_followup.py (new-reply pull-in).

collect_negative_feedback(db, since) -> list of:
  {"channel": "whatsapp"|"email", "key": "<channel>:<id>", "id": phone-or-email,
   "name": str, "text": str, "sentiment": "negative", "ts": iso}
Each customer collapses to one item per channel (latest wins for ordering).
"""
import re
from datetime import datetime, timezone

HARD_NEG = re.compile(r"not good|not work|nahi kar|nhi kar|kharab|kharap|scrap|dead|backup nahi|"
                      r"backup kam|backup bahut kam|sahi nahi|no backup|buri|useless|cheat|chuna|"
                      r"not charg|charge nahi|display nahi|display not|refund|defective|tahlate|"
                      r"6 manth|badhi buri|behtar banao|not respond|not holding|worst|fraud|paisa", re.I)
SOFT_NEG = re.compile(r"problem|issue|error|current ch|unattached|technician.*visit|visit.*technician|"
                      r"0 amp|fault|complain|nahi de|nahi mil|kam hai|red error|red light", re.I)
STRONG_POS = re.compile(r"working (fine|well)|no problem|without any problem|everything is working|"
                        r"sab (theek|sahi)|badhiya chal|bahut accha|very good|satisfied", re.I)
JUNK = re.compile(r"^\s*(ok|han|yes|ji teek|ji theek|nahi|ab|🙏|👍|thanks|\[image\]|none)\s*$", re.I)


def _to_dt(ts):
    try:
        return datetime.fromisoformat(str(ts))
    except Exception:
        try:
            return datetime.fromtimestamp(int(float(ts)), tz=timezone.utc)
        except Exception:
            return None


def _is_negative(blob):
    if not blob.strip():
        return False
    if STRONG_POS.search(blob) and not HARD_NEG.search(blob):
        return False
    return bool(HARD_NEG.search(blob)) or bool(SOFT_NEG.search(blob))


def collect_negative_feedback(db, since):
    since_dt = _to_dt(since) or datetime(2026, 6, 18, 11, 0, tzinfo=timezone.utc)
    # cohorts + name maps
    wa, name_by_phone = {}, {}
    for w in db.warranties.find({"feedback_wa_sent_at": {"$exists": True}},
                                {"phone": 1, "first_name": 1, "last_name": 1}):
        p = re.sub(r"\D", "", str(w.get("phone") or ""))[-10:]
        if p:
            wa[p] = True
            name_by_phone[p] = (str(w.get("first_name") or "") + " " + str(w.get("last_name") or "")).strip()
    em, name_by_email = {}, {}
    for w in db.warranties.find({"feedback_email_sent_at": {"$exists": True}},
                                {"email": 1, "first_name": 1, "last_name": 1}):
        e = (w.get("email") or "").strip().lower()
        if e:
            em[e] = True
            name_by_email[e] = (str(w.get("first_name") or "") + " " + str(w.get("last_name") or "")).strip()

    out = {}

    # --- WhatsApp ---
    by_phone = {}
    for m in db.whatsapp_cloud_messages.find({"direction": "incoming"}).sort("ts", -1).limit(800):
        p = re.sub(r"\D", "", str(m.get("phone") or ""))[-10:]
        dt = _to_dt(m.get("ts"))
        if p not in wa or not dt or dt < since_dt:
            continue
        t = str(m.get("text") or "").strip()
        if not t or t.lower() == "none" or t.startswith("[image") or "acrobat.adobe" in t or "Sale Invoice" in t:
            continue
        by_phone.setdefault(p, {"msgs": [], "ts": dt})
        by_phone[p]["msgs"].append(t)
    for p, d in by_phone.items():
        blob = " | ".join(x for x in reversed(d["msgs"]) if not JUNK.match(x))
        if _is_negative(blob):
            out[f"whatsapp:{p}"] = {"channel": "whatsapp", "key": f"whatsapp:{p}", "id": p,
                                    "name": name_by_phone.get(p, ""), "text": blob[:300],
                                    "sentiment": "negative", "ts": d["ts"].isoformat()}

    # --- Email ---
    for m in db.email_agent_inbox.find({}).sort([("_id", -1)]).limit(500):
        frm = (m.get("from_addr") or "").lower().strip()
        frm_m = re.search(r"[\w.\-+]+@[\w.\-]+", frm)
        frm = frm_m.group(0) if frm_m else frm
        subj = (m.get("subject") or "")
        body = (m.get("body") or "")
        dt = _to_dt(m.get("received_date") or m.get("created_at"))
        is_reply = "lithium battery performing" in subj.lower()
        if not ((frm in em and dt and dt >= since_dt) or is_reply):
            continue
        if _is_negative(body) or (is_reply and _is_negative(subj + " " + body)):
            key = f"email:{frm}"
            if key not in out:   # one per address
                out[key] = {"channel": "email", "key": key, "id": frm,
                            "name": name_by_email.get(frm, m.get("from_name") or ""),
                            "text": re.sub(r"\s+", " ", str(body))[:300] or subj[:300],
                            "sentiment": "negative", "ts": (dt or since_dt).isoformat()}
    return list(out.values())

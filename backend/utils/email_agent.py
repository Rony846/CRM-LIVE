"""
Email Agent — an API-free inbound-email assistant.

Receives mail at a dedicated Zoho mailbox (ai@musclegrid.in), reads it via IMAP,
classifies + drafts a reply with a LOCAL LLM (Ollama on 127.0.0.1 — no paid API),
creates the right CRM record, and parks a DRAFT reply for a human to approve/send.

Everything here is gated by env config and degrades to a no-op when unconfigured,
so it is safe to ship dark and switch on by filling backend/.env:

  EMAIL_AGENT_ENABLED=true
  EMAIL_AGENT_EMAIL=ai@musclegrid.in
  EMAIL_AGENT_PASSWORD=<zoho app-specific password>   # IMAP + SMTP, same mailbox
  EMAIL_AGENT_IMAP_HOST=imap.zoho.com
  EMAIL_AGENT_IMAP_PORT=993
  EMAIL_AGENT_SMTP_HOST=smtp.zoho.com
  EMAIL_AGENT_SMTP_PORT=587
  EMAIL_AGENT_WHITELIST=ramesh@x.com,@musclegrid.in    # addresses or @domains
  OLLAMA_URL=http://127.0.0.1:11434
  OLLAMA_MODEL=qwen2.5:3b

No external API is ever called: IMAP/SMTP are mail protocols and the LLM runs
locally. Replies are NEVER auto-sent — they wait in the draft queue for a click.
"""
import os
import re
import json
import asyncio
import imaplib
import smtplib
import logging
from email import message_from_bytes
from email.header import decode_header, make_header
from email.utils import parseaddr, formataddr, make_msgid
from email.mime.text import MIMEText
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)


# ---- config ---------------------------------------------------------------
def cfg() -> dict:
    return {
        "enabled": (os.environ.get("EMAIL_AGENT_ENABLED", "false").lower() == "true"),
        "email": os.environ.get("EMAIL_AGENT_EMAIL", "").strip(),
        "password": os.environ.get("EMAIL_AGENT_PASSWORD", ""),
        "imap_host": os.environ.get("EMAIL_AGENT_IMAP_HOST", "imap.zoho.com").strip(),
        "imap_port": int(os.environ.get("EMAIL_AGENT_IMAP_PORT", "993")),
        "smtp_host": os.environ.get("EMAIL_AGENT_SMTP_HOST", "smtp.zoho.com").strip(),
        "smtp_port": int(os.environ.get("EMAIL_AGENT_SMTP_PORT", "587")),
        "whitelist": [w.strip().lower() for w in os.environ.get("EMAIL_AGENT_WHITELIST", "").split(",") if w.strip()],
        "ollama_url": os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/"),
        "model": os.environ.get("OLLAMA_MODEL", "qwen2.5:3b"),
    }


def is_configured() -> bool:
    c = cfg()
    return bool(c["enabled"] and c["email"] and c["password"])


def is_whitelisted(sender: str, whitelist: list) -> bool:
    """A sender passes if it matches a full address or an @domain entry. Empty
    whitelist = process nothing (fail closed — safest for an untrusted channel)."""
    if not whitelist:
        return False
    s = (sender or "").strip().lower()
    if not s:
        return False
    for w in whitelist:
        if w.startswith("@") and s.endswith(w):
            return True
        if s == w:
            return True
    return False


# ---- the local-LLM brain (no external API) --------------------------------
CATEGORIES = ["sales_lead", "support_complaint", "dealer", "order_query", "spam", "other"]

_BRAIN_PROMPT = """You are the email triage assistant for MuscleGrid CRM (an Indian company selling \
inverters, batteries, stabilizers and solar). Read the email and respond with ONLY compact JSON \
(no markdown, no prose) in EXACTLY this shape:
{{"category":"sales_lead|support_complaint|dealer|order_query|spam|other","urgency":"low|medium|high",\
"order_number":"<MG-... if present else null>","phone":"<10-digit Indian mobile if present else null>",\
"summary":"<one short sentence>","suggested_reply":"<a polite 2-4 sentence reply to the sender, signed 'Team MuscleGrid'>"}}

Rules: never invent an order number or phone. If it's marketing/junk, category=spam and suggested_reply="".

EMAIL FROM: {sender}
SUBJECT: {subject}

{body}"""


def _safe_json(text: str) -> dict:
    """Pull the first {...} block out of the model output and parse it."""
    m = re.search(r"\{.*\}", text or "", re.DOTALL)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        # common model slip: trailing commas
        try:
            return json.loads(re.sub(r",\s*([}\]])", r"\1", m.group(0)))
        except Exception:
            return {}


async def classify(sender: str, subject: str, body: str) -> dict:
    """Run the local model. Returns a normalised dict; falls back to a safe
    'other/needs human' classification if the model is down or unparseable."""
    c = cfg()
    prompt = _BRAIN_PROMPT.format(sender=sender or "?", subject=subject or "(no subject)",
                                  body=(body or "")[:6000])
    fallback = {"category": "other", "urgency": "medium", "order_number": None,
                "phone": None, "summary": (subject or "")[:120],
                "suggested_reply": "", "model_ok": False}
    parsed = {}
    last_err = None
    for attempt in range(2):  # one retry absorbs a cold-model start
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                r = await client.post(f"{c['ollama_url']}/api/generate", json={
                    "model": c["model"], "prompt": prompt, "stream": False,
                    "options": {"temperature": 0.2, "num_predict": 320}, "keep_alive": "60s",
                })
            r.raise_for_status()
            parsed = _safe_json(r.json().get("response", ""))
            if parsed:
                break
        except Exception as e:
            last_err = e
            await asyncio.sleep(1.5)
    if not parsed:
        if last_err:
            logger.error(f"Email brain (Ollama) failed: {last_err}")
        return fallback

    cat = (parsed.get("category") or "other").strip().lower()
    if cat not in CATEGORIES:
        cat = "other"
    urg = (parsed.get("urgency") or "medium").strip().lower()
    if urg not in ("low", "medium", "high"):
        urg = "medium"
    order = parsed.get("order_number")
    if isinstance(order, str) and not re.match(r"^MG-", order.strip(), re.I):
        order = None
    phone = parsed.get("phone")
    if isinstance(phone, str):
        digits = re.sub(r"\D", "", phone)
        phone = digits[-10:] if len(digits) >= 10 else None
    else:
        phone = None
    return {
        "category": cat, "urgency": urg, "order_number": (order or None),
        "phone": phone, "summary": (parsed.get("summary") or "")[:300],
        "suggested_reply": (parsed.get("suggested_reply") or "")[:3000],
        "model_ok": True,
    }


# ---- IMAP read (blocking; run via asyncio.to_thread) ----------------------
def _decode(s) -> str:
    try:
        return str(make_header(decode_header(s or "")))
    except Exception:
        return s or ""


def _plain_body(msg) -> str:
    """Best-effort plain-text body from a message (prefers text/plain)."""
    if msg.is_multipart():
        # prefer text/plain
        for part in msg.walk():
            if part.get_content_type() == "text/plain" and "attachment" not in str(part.get("Content-Disposition", "")):
                try:
                    return part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", "replace")
                except Exception:
                    continue
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                try:
                    html = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", "replace")
                    return re.sub(r"<[^>]+>", " ", html)
                except Exception:
                    continue
        return ""
    try:
        payload = msg.get_payload(decode=True)
        text = payload.decode(msg.get_content_charset() or "utf-8", "replace") if payload else ""
        if msg.get_content_type() == "text/html":
            text = re.sub(r"<[^>]+>", " ", text)
        return text
    except Exception:
        return ""


def _fetch_unseen_blocking(c: dict, limit: int = 20) -> list:
    """Fetch UNSEEN messages and mark them \\Seen so we don't re-process."""
    out = []
    box = imaplib.IMAP4_SSL(c["imap_host"], c["imap_port"])
    try:
        box.login(c["email"], c["password"])
        box.select("INBOX")
        typ, data = box.search(None, "UNSEEN")
        ids = (data[0].split() if data and data[0] else [])[:limit]
        for mid in ids:
            typ, msg_data = box.fetch(mid, "(RFC822)")
            if typ != "OK" or not msg_data or not msg_data[0]:
                continue
            msg = message_from_bytes(msg_data[0][1])
            from_name, from_addr = parseaddr(msg.get("From", ""))
            out.append({
                "uid": mid.decode() if isinstance(mid, bytes) else str(mid),
                "message_id": msg.get("Message-ID", ""),
                "from_name": _decode(from_name), "from_addr": (from_addr or "").lower(),
                "subject": _decode(msg.get("Subject", "")),
                "date": msg.get("Date", ""),
                "body": _plain_body(msg).strip()[:8000],
            })
            box.store(mid, "+FLAGS", "\\Seen")
    finally:
        try:
            box.logout()
        except Exception:
            pass
    return out


async def fetch_unseen(limit: int = 20) -> list:
    c = cfg()
    return await asyncio.to_thread(_fetch_unseen_blocking, c, limit)


# ---- SMTP reply (blocking; run via asyncio.to_thread) ---------------------
def _send_blocking(c: dict, to_addr: str, subject: str, body: str, in_reply_to: str = "") -> None:
    msg = MIMEText(body, "plain", "utf-8")
    msg["From"] = formataddr(("MuscleGrid", c["email"]))
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid()
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to
    s = smtplib.SMTP(c["smtp_host"], c["smtp_port"], timeout=30)
    try:
        s.starttls()
        s.login(c["email"], c["password"])
        s.sendmail(c["email"], [to_addr], msg.as_string())
    finally:
        try:
            s.quit()
        except Exception:
            pass


async def send_reply(to_addr: str, subject: str, body: str, in_reply_to: str = "") -> None:
    c = cfg()
    if not is_configured():
        raise RuntimeError("Email agent mailbox not configured")
    await asyncio.to_thread(_send_blocking, c, to_addr, subject, body, in_reply_to)

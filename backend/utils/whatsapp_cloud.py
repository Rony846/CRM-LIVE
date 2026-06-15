"""WhatsApp Business Platform (Cloud API) client — the OFFICIAL channel for
business-initiated customer messaging (e.g. a missed-call follow-up template).

Inert until WHATSAPP_CLOUD_TOKEN + WHATSAPP_PHONE_NUMBER_ID are set in the env,
so this can ship dark. DB-free (pure HTTP); the server handles persistence/logging.

Env:
  WHATSAPP_CLOUD_TOKEN          permanent System-User access token
  WHATSAPP_PHONE_NUMBER_ID      the Cloud API phone number id (NOT the digits)
  WHATSAPP_WABA_ID              (optional) WhatsApp Business Account id
  WHATSAPP_CLOUD_API_VERSION    graph version, default v21.0
  WHATSAPP_MISSED_CALL_TEMPLATE template name for the missed-call message
  WHATSAPP_TEMPLATE_LANG        template language code, default en
  WHATSAPP_CLOUD_VERIFY_TOKEN   token used to verify the Meta webhook GET
"""
import logging
import os

import httpx

logger = logging.getLogger("whatsapp_cloud")


def _cfg() -> dict:
    return {
        "token": os.environ.get("WHATSAPP_CLOUD_TOKEN", "").strip(),
        "phone_number_id": os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "").strip(),
        "api_version": os.environ.get("WHATSAPP_CLOUD_API_VERSION", "v21.0").strip() or "v21.0",
        "missed_call_template": os.environ.get("WHATSAPP_MISSED_CALL_TEMPLATE", "missed_call_followup").strip(),
        "template_lang": os.environ.get("WHATSAPP_TEMPLATE_LANG", "en").strip() or "en",
        "verify_token": os.environ.get("WHATSAPP_CLOUD_VERIFY_TOKEN", "").strip(),
    }


def enabled() -> bool:
    c = _cfg()
    return bool(c["token"] and c["phone_number_id"])


def verify_token() -> str:
    return _cfg()["verify_token"]


def to_msisdn(phone: str) -> str:
    """Normalize to WhatsApp wa_id form: digits with country code (India default)."""
    d = "".join(ch for ch in str(phone or "") if ch.isdigit())
    if len(d) == 10:
        d = "91" + d
    return d


async def _post(payload: dict) -> dict:
    c = _cfg()
    url = f"https://graph.facebook.com/{c['api_version']}/{c['phone_number_id']}/messages"
    headers = {"Authorization": f"Bearer {c['token']}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(url, json=payload, headers=headers)
        try:
            data = r.json()
        except Exception:
            data = {"text": r.text[:500]}
        if r.status_code >= 400:
            logger.warning(f"WhatsApp Cloud send failed {r.status_code}: {data}")
        wamid = None
        if isinstance(data, dict):
            msgs = data.get("messages") or []
            if msgs and isinstance(msgs, list):
                wamid = msgs[0].get("id")
        return {"ok": r.status_code < 400, "status": r.status_code, "wamid": wamid, "response": data}
    except Exception as e:
        logger.warning(f"WhatsApp Cloud send error: {e}")
        return {"ok": False, "status": 0, "wamid": None, "response": {"error": str(e)}}


async def send_template(to: str, template: str = None, lang: str = None, components: list = None) -> dict:
    """Send an approved template (the only way to INITIATE a conversation outside
    the 24h window — used for the missed-call follow-up)."""
    c = _cfg()
    tmpl = {"name": template or c["missed_call_template"], "language": {"code": lang or c["template_lang"]}}
    if components:
        tmpl["components"] = components
    return await _post({"messaging_product": "whatsapp", "to": to_msisdn(to), "type": "template", "template": tmpl})


async def send_text(to: str, body: str) -> dict:
    """Free-form text — ONLY valid inside the 24h customer-service window
    (i.e. after the customer has messaged us). Use a template otherwise."""
    return await _post({"messaging_product": "whatsapp", "to": to_msisdn(to),
                        "type": "text", "text": {"body": body}})


async def upload_media(file_bytes: bytes, filename: str, mime: str = "application/pdf") -> str:
    """Upload a media file to WhatsApp and return its media_id (needed to send a document/image)."""
    c = _cfg()
    if not (c["token"] and c["phone_number_id"] and file_bytes):
        return None
    url = f"https://graph.facebook.com/{c['api_version']}/{c['phone_number_id']}/media"
    headers = {"Authorization": f"Bearer {c['token']}"}
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(url, headers=headers,
                                  data={"messaging_product": "whatsapp", "type": mime},
                                  files={"file": (filename, file_bytes, mime)})
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code >= 400:
            logger.warning(f"WhatsApp media upload failed {r.status_code}: {r.text[:300]}")
        return (data or {}).get("id")
    except Exception as e:
        logger.warning(f"WhatsApp media upload error: {e}")
        return None


async def send_document(to: str, file_bytes: bytes, filename: str, mime: str = "application/pdf",
                        caption: str = "") -> dict:
    """Send a document (e.g. a user-manual PDF) to a customer — valid inside the 24h window."""
    media_id = await upload_media(file_bytes, filename, mime)
    if not media_id:
        return {"ok": False, "error": "media upload failed"}
    doc = {"id": media_id, "filename": filename}
    if caption:
        doc["caption"] = caption
    return await _post({"messaging_product": "whatsapp", "to": to_msisdn(to), "type": "document", "document": doc})


async def download_media(media_id: str) -> dict:
    """Download a WhatsApp media object (image/doc) by id → {bytes, mime} or None.
    Two hops: GET /{media_id} for the temporary URL, then GET that URL (both bearer-authed)."""
    c = _cfg()
    if not (c["token"] and media_id):
        return None
    headers = {"Authorization": f"Bearer {c['token']}"}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(f"https://graph.facebook.com/{c['api_version']}/{media_id}", headers=headers)
            if r.status_code >= 400:
                return None
            meta = r.json()
            url = meta.get("url")
            mime = meta.get("mime_type") or "image/jpeg"
            if not url:
                return None
            r2 = await client.get(url, headers=headers)
            if r2.status_code >= 400:
                return None
            return {"bytes": r2.content, "mime": mime.split(";")[0].strip()}
    except Exception as e:
        logger.warning(f"WhatsApp media download failed: {e}")
        return None

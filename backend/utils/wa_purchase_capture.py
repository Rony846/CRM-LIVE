"""Read a supplier purchase invoice (PDF or photo) into structured data — free-first.

Used by the MG Brain WhatsApp relay so the founder can send an invoice and *record a
purchase* instead of being offered a shipping label. Pipeline:

  1. Extract raw text for FREE:
       - PDF  -> pdfplumber (digital invoices extract cleanly, no OCR)
       - image-> tesseract OCR
  2. Structure the text into JSON with an LLM:
       - prefer Jasmine (local Qwen-32B) when LOCAL_BRAINS_ENABLED=1  -> ₹0
       - else fall back to Kalpana (Opus) -> a few ₹/invoice
  3. For a photo whose OCR came back thin/garbled, escalate to Opus VISION (reads the
     image directly) when escalation is allowed — the only path that ever costs money,
     and only on a hard invoice.

Returns a dict with the extracted fields + `confidence` + `read_by` (which model/route)
so the caller can decide auto-post vs. accountant-review. Money is never touched here —
this module only READS.
"""
import os
import io
import re
import json
import base64
import logging

logger = logging.getLogger(__name__)

_SCHEMA_HINT = (
    'Return ONLY compact JSON, no prose, with exactly these keys:\n'
    '{"supplier_name": str, "supplier_gstin": str|null, "invoice_number": str, '
    '"invoice_date": "YYYY-MM-DD", "bill_to_gstin": str|null, '
    '"items": [{"description": str, "hsn": str|null, "quantity": number, "rate": number, "gst_rate": number}], '
    '"subtotal": number, "total_gst": number, "grand_total": number, '
    '"confidence": "high"|"medium"|"low"}\n'
    'rate = unit price BEFORE GST. gst_rate = percent (e.g. 18). bill_to_gstin = the '
    'GSTIN of the BUYER (the "Bill To"/"Ship To" party — that is us), distinct from the '
    'supplier. If a field is genuinely absent, use null (or [] for items). Set confidence '
    '"low" if the text looks garbled or key totals are missing.'
)
_SYS = ("You are a precise accounts-payable clerk for an Indian company. You read a single "
        "supplier TAX INVOICE and extract its fields exactly. Never invent numbers — copy "
        "them. Indian GST invoices show CGST+SGST (intra-state) or IGST (inter-state); "
        "gst_rate is the combined percent for the line. " + _SCHEMA_HINT)


def _local_enabled() -> bool:
    return (os.environ.get("LOCAL_BRAINS_ENABLED", "0") or "0").strip() in ("1", "true", "yes", "on")


def extract_text(doc: dict) -> str:
    """Free text extraction. doc = {b64, mime, kind}. Returns raw text ('' on failure)."""
    try:
        raw = base64.b64decode(doc.get("b64", ""))
    except Exception:
        return ""
    if not raw:
        return ""
    kind = doc.get("kind") or ("document" if "pdf" in (doc.get("mime") or "") else "image")
    if kind == "document":
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(raw)) as pdf:
                return "\n".join((p.extract_text() or "") for p in pdf.pages[:6]).strip()
        except Exception as e:
            logger.warning(f"wa_purchase: pdf extract failed: {e}")
            return ""
    # image -> OCR
    try:
        import pytesseract
        from PIL import Image
        return pytesseract.image_to_string(Image.open(io.BytesIO(raw))).strip()
    except Exception as e:
        logger.warning(f"wa_purchase: OCR failed: {e}")
        return ""


def _parse_json(text: str) -> dict | None:
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


async def _structure_text(raw_text: str) -> tuple[dict | None, str]:
    """Structure OCR/PDF text into JSON. Local Jasmine first (free), else Opus (paid)."""
    from utils import brain_registry as br
    prompt = f"INVOICE TEXT:\n{raw_text[:8000]}"
    if _local_enabled() and br.available("jasmine"):
        r = await br.complete("jasmine", system=_SYS, prompt=prompt, max_tokens=900, temperature=0.1)
        data = _parse_json(r.get("text", "")) if r.get("model_ok") else None
        if data:
            return data, "jasmine(local,free)"
    # paid fallback: Opus on the text
    if br.available("kalpana"):
        r = await br.complete("kalpana", system=_SYS, prompt=prompt, max_tokens=900)
        data = _parse_json(r.get("text", "")) if r.get("model_ok") else None
        if data:
            return data, "kalpana(opus,text)"
    return None, "none"


async def _structure_vision(doc: dict) -> tuple[dict | None, str]:
    """Opus vision: read the invoice image/PDF directly. Costs a few ₹ — used only as a
    fallback for a thin/garbled OCR. Reuses pratibha_brain's wrapped client + block builder."""
    from utils import pratibha_brain as pb
    client = pb._client_or_none()
    if client is None:
        return None, "none"
    try:
        blocks = pb._attachment_blocks([{
            "b64": doc.get("b64"), "media_type": doc.get("mime"),
            "kind": doc.get("kind", "image")}])
        resp = await client.messages.create(
            model=pb.ship_model(), max_tokens=900, system=pb._sys(_SYS),
            messages=[{"role": "user", "content": blocks + [
                {"type": "text", "text": "Extract this purchase invoice as the JSON described."}]}])
        data = _parse_json(pb._text(resp))
        return (data, "kalpana(opus,vision)") if data else (None, "none")
    except Exception as e:
        logger.error(f"wa_purchase: vision read failed: {e}")
        return None, "none"


def _looks_thin(raw_text: str, data: dict | None) -> bool:
    if len((raw_text or "").strip()) < 120:
        return True
    if not data:
        return True
    if (data.get("confidence") or "").lower() == "low":
        return True
    if not data.get("grand_total") or not data.get("items"):
        return True
    return False


async def read_invoice(doc: dict, allow_paid: bool = True) -> dict:
    """Top-level: doc = {b64, mime, kind}. Returns the structured dict + meta:
    {..fields.., 'confidence', 'read_by', 'ok': bool}. Never raises."""
    raw = extract_text(doc)
    data, route = await _structure_text(raw)
    # escalate to vision only for images/PDF when the free read looks unreliable
    if allow_paid and _looks_thin(raw, data):
        vdata, vroute = await _structure_vision(doc)
        if vdata:
            data, route = vdata, vroute
    if not data:
        return {"ok": False, "read_by": route, "confidence": "low"}
    data["ok"] = True
    data["read_by"] = route
    data.setdefault("confidence", "medium")
    data.setdefault("items", [])
    return data

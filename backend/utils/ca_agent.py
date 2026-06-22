"""Pratibha's accounting brain — a top-tier Indian Chartered Accountant.

Reads an accounting document (supplier bill, sales invoice, payment/UPI/bank proof, expense
bill, credit note, bank statement), and CLASSIFIES it for entry into the books — applying
Indian GST / TDS / double-entry rules. It does NOT post and does NOT need to recompute totals:
it extracts what's on the document and classifies it; the CRM's deterministic engine computes
GST and posts AFTER a human (accountant) reviews the draft. Accuracy of the books therefore
never depends on the model — only the reading/classification does, and that's reviewed.

Uses Claude (Sonnet via pratibha_brain.model_reply) for classification accuracy. Vision-capable.
Swappable to a local model later by changing the model call here.
"""
import re
import json
import logging

from . import pratibha_brain as pb

logger = logging.getLogger(__name__)

_CA_SYS = """You are Pratibha's accounting brain — a TOP-TIER Indian Chartered Accountant (CA) with deep \
expertise in Indian GST, TDS, and double-entry bookkeeping. The company is MuscleGrid (manufactures/sells \
batteries, inverters, stabilizers, solar) and has MULTIPLE GST-registered firms.

You are given an accounting DOCUMENT (and any email text). Read it PRECISELY and classify it for the books. \
You do NOT post entries and you do NOT need to recompute totals — extract exactly what is on the document and \
classify it; the system's deterministic engine recomputes GST and posts after a human review.

Apply Indian rules:
- GST: intra-state supply = CGST + SGST; inter-state = IGST — determined by PLACE OF SUPPLY vs our firm's state. \
Capture the place of supply, HSN/SAC, GST rate, taxable value, and tax amounts AS PRINTED.
- TDS: flag if an expense attracts TDS (194C contractor, 194J professional/technical, 194I rent, 194H commission, \
etc.) with the section and typical rate.
- Suggest the correct ledger/account head, and for expenses the category (rent / transport / professional_fees / \
contractor / other).
- Raise compliance_flags for: missing/!valid GSTIN, GST arithmetic mismatch, missing invoice number or date, \
likely DUPLICATE, reverse-charge applicability, ITC-eligibility concerns, round-off anomalies.
NEVER invent figures — if a field is not on the document, set it null and list it in "missing".

Respond with ONLY compact JSON:
{"is_accounting_doc": true|false,
 "doc_type": "purchase_bill|sales_invoice|payment_receipt|expense|credit_note|bank_statement|other",
 "confidence": 0.0-1.0,
 "party_name": string|null, "party_gstin": string|null, "firm_hint": string|null,
 "document_number": string|null, "document_date": "YYYY-MM-DD"|null, "place_of_supply_state": string|null,
 "line_items": [{"description": string, "hsn": string|null, "quantity": number|null, "rate": number|null,
   "gst_rate": number|null, "amount": number|null}],
 "totals": {"taxable_value": number|null, "cgst": number|null, "sgst": number|null, "igst": number|null,
   "total_gst": number|null, "grand_total": number|null},
 "payment": {"amount": number, "mode": string, "reference": string|null, "date": "YYYY-MM-DD"|null,
   "direction": "received|made"}|null,
 "tds": {"applicable": true|false, "section": string|null, "rate": number|null, "amount": number|null},
 "suggested_ledger": string, "suggested_expense_type": string|null,
 "compliance_flags": [string], "notes": string, "missing": [string]}"""


async def classify(images=None, text: str = "", today: str = None) -> dict:
    """Classify an accounting document (images + any text) like a senior CA would."""
    client = pb._client_or_none()
    if client is None:
        return {"is_accounting_doc": False, "model_ok": False}
    content = pb._attachment_blocks(images, limit=6)
    hint = f"(Today is {today}.) " if today else ""
    content.append({"type": "text", "text": f"{hint}Document / email text:\n{(text or '')[:5000]}"})
    try:
        resp = await client.messages.create(
            model=pb.model_reply(), max_tokens=1600, system=pb._sys(_CA_SYS),
            messages=[{"role": "user", "content": content}])
        m = re.search(r"\{.*\}", pb._text(resp), re.S)
        j = json.loads(m.group(0)) if m else {}
        j["model_ok"] = True
        return j
    except Exception as e:
        logger.error(f"CA classify failed: {e}")
        return {"is_accounting_doc": False, "model_ok": False}

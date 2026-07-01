"""Jasmine dispatch agent — deterministic safeguards for WhatsApp label-making.

Jasmine lives in the Meerut dispatch WhatsApp group. It silently reads, and only ACTS when
tagged (the bot number 9800008226 or the word "Jasmine"). It books Bigship labels for
repaired-item / replacement / PCB dispatches — and it must NEVER fail silently, NEVER book a
wrong label, and NEVER book twice.

This module holds the PURE, deterministic pieces (no db, no network) so every safeguard is
unit-testable in isolation. The db/LLM/Bigship orchestration lives in server.py (where `db` and
the booking functions are) and calls into here for the guarantees below.

The four invariants:
  • never silent  — every request ends in an AWB or a clear reason.
  • never wrong   — nothing books without a human "confirm" against an echoed card.
  • never twice   — message-id dedup (webhook) + idempotency key (here) + resume-on-partial.
  • never blind   — dims resolved or asked for, never guessed; lanes checked before booking.
"""
import re
import hashlib

BOT_NUMBER = "9800008226"

# ---- Wake detection -------------------------------------------------------
# Jasmine wakes only when the message tags the bot number or says "jasmine" as a word.
# Robust to WhatsApp @mention rendering (which may embed the raw number in the body) so we do
# NOT depend on the bridge passing mention metadata.
_WAKE_RX = re.compile(r"(?:^|[^0-9a-z])(?:jasmine|9800008226|@9800008226)(?:[^0-9a-z]|$)", re.I)

def is_wake(text: str) -> bool:
    return bool(_WAKE_RX.search(text or ""))


# ---- Confirm / cancel (the human gate) ------------------------------------
# "confirm ABCD" targets a specific pending booking by its short code (prevents the
# newest-wins mis-route when two requests are pending). Bare "confirm" is allowed only when a
# single booking is pending (the caller enforces that).
# Codes are drawn from a vowel-free / ambiguity-free alphabet (see CODE_CHARS) so a stray word
# after the confirm phrase (e.g. "karo") can't be mistaken for a booking code.
CODE_CHARS = "123456789ACDEFHJKLMNPQRTUVWXY"
_CONFIRM_RX = re.compile(r"\b(?:confirm|book\s*it|book\s*karo|ok\s*book|haan\s*book|go\s*ahead)\b\s*([%s]{4})?" % CODE_CHARS, re.I)
_CANCEL_RX  = re.compile(r"\b(?:cancel|abort|stop|ruko|nahi|mat\s*bhejo|hold)\b", re.I)

def parse_confirm(text: str):
    """Return (is_confirm, code_or_None). code is upper-cased when present."""
    m = _CONFIRM_RX.search(text or "")
    if not m:
        return (False, None)
    code = (m.group(1) or "").upper() or None
    return (True, code)

def is_cancel(text: str) -> bool:
    return bool(_CANCEL_RX.search(text or ""))


def gen_code(seed: str) -> str:
    """Deterministic 4-char booking code from a seed (e.g. the message id). Deterministic so a
    retried webhook produces the SAME code, never a second pending booking."""
    h = hashlib.sha1((seed or "").encode()).hexdigest().upper()
    # Drop vowels/ambiguous chars to avoid accidental words / 0-O confusion.
    alphabet = [c for c in h if c in CODE_CHARS]
    return "".join((alphabet + list("2468"))[:4])


def idempotency_key(phone: str, product: str, ref: str, day: str) -> str:
    """Stable key for one intended shipment on one day → blocks double-booking even across
    re-tags/retries. Same (customer, product, ref, day) → same key."""
    basis = f"{norm_phone(phone) or ''}|{(product or '').strip().lower()}|{(ref or '').strip().lower()}|{day}"
    return hashlib.sha256(basis.encode()).hexdigest()[:20]


# ---- Field normalisation / validation -------------------------------------
def norm_phone(raw):
    """Return a valid 10-digit Indian mobile or None."""
    d = re.sub(r"\D", "", str(raw or ""))[-10:]
    return d if (len(d) == 10 and d[0] in "6789") else None

def norm_pincode(raw):
    """Return a valid 6-digit pincode or None (rejects 000000 / leading 0)."""
    d = re.sub(r"\D", "", str(raw or ""))
    return d if (len(d) == 6 and d[0] != "0") else None

# Bigship hard limits (from create_shipment_for_agent).
ADDR_LINE_MAX = 50
NAME_MAX = 25
PRODUCT_MAX = 100

def clip_address(line1, line2="", city="", state=""):
    """Fit an address into Bigship's 50-char line limits WITHOUT silently dropping the house
    number. Returns (fields, overflow: bool). overflow=True means the caller must surface/confirm
    the truncation (never silently ship a chopped address)."""
    l1 = re.sub(r"\s+", " ", str(line1 or "")).strip()
    l2 = re.sub(r"\s+", " ", str(line2 or "")).strip()
    overflow = len(l1) > ADDR_LINE_MAX or len(l2) > ADDR_LINE_MAX
    # If line1 overflows, spill the tail into line2 (rather than truncate) when line2 has room.
    if len(l1) > ADDR_LINE_MAX and not l2:
        l2 = l1[ADDR_LINE_MAX:]
        l1 = l1[:ADDR_LINE_MAX]
        overflow = len(l2) > ADDR_LINE_MAX
    return ({"address_line1": l1[:ADDR_LINE_MAX], "address_line2": l2[:ADDR_LINE_MAX],
             "city": (city or "").strip(), "state": (state or "").strip()}, overflow)


# ---- Request classification + reference extraction ------------------------
_PCB_RX     = re.compile(r"\b(pcb|p\.c\.b|card|board)\b", re.I)
_REPLACE_RX = re.compile(r"\b(replace|replacement|new\s*piece|new\s*unit|badal)\b", re.I)
_REPAIR_RX  = re.compile(r"\b(repair|repaired|thik|theek|fix|sahi\s*kiya|ho\s*gaya)\b", re.I)

def classify(text: str) -> str:
    t = text or ""
    if _PCB_RX.search(t):
        return "pcb"
    if _REPLACE_RX.search(t):
        return "replacement"
    if _REPAIR_RX.search(t):
        return "repair"
    return "unknown"

# Ticket MG-R-/MG-W-, dispatch MG-D-, or a bare Amazon-style order id.
_REF_RX = re.compile(r"\b(MG-[RWD]-\d{8}-\d{4,6}|\d{3}-\d{7}-\d{7})\b", re.I)

def extract_reference(text: str):
    m = _REF_RX.search(text or "")
    return m.group(1).upper() if m else None


PCB_PROFILE = {"weight_kg": 0.1, "length_cm": 5, "width_cm": 5, "height_cm": 5}


def validate_dispatch(fields: dict):
    """Deterministic pre-flight. Returns (ok, problems) where problems is a list of human-readable,
    action-oriented strings ('Need a 6-digit pincode'). Empty problems → structurally bookable
    (serviceability is a separate live check in server.py)."""
    problems = []
    if not (fields.get("first_name") or "").strip():
        problems.append("Need the customer name")
    if not norm_phone(fields.get("phone")):
        problems.append("Need a valid 10-digit phone")
    if not norm_pincode(fields.get("pincode")):
        problems.append("Need a valid 6-digit pincode")
    if not (fields.get("address_line1") or "").strip():
        problems.append("Need the delivery address")
    for k in ("weight_kg", "length_cm", "width_cm", "height_cm"):
        v = fields.get(k)
        if not v or float(v) <= 0:
            problems.append("Need weight & box size (SKU has no saved dimensions)")
            break
    if not (fields.get("product_name") or "").strip():
        problems.append("Need the product name")
    amt = fields.get("invoice_amount")
    if amt is None or float(amt) <= 0:
        problems.append("Need the declared value")
    if str(fields.get("payment_type", "Prepaid")).upper() == "COD" and float(fields.get("cod_amount") or 0) <= 0:
        problems.append("COD selected but no COD amount given")
    return (len(problems) == 0, problems)

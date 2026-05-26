"""
Amazon-format packing slip generator.

Produces a 2-page PDF that mirrors the layout Amazon Seller Central serves at
https://sellercentral.amazon.in/orders/packing-slip — used as a fallback when
the Amazon invoice / packing slip itself cannot be downloaded during order
processing. Format taken from the reference sample at
backend/uploads/claude_files/10_PS_Amazon.pdf.

Page 1 sections (top to bottom):
  - "Ship to:" block — name, address lines, phone
  - Horizontal dashed separator
  - "Order ID: ..."  +  "Thank you for buying from {seller_short}."
  - Order Summary table (Delivery address | Order Date | Shipping Service |
    Buyer Name | Seller Name)
  - Items table (Quantity | Quantity Included | Product Details | Unit price
    | Order Totals)
  - Right-aligned "Grand total: ₹X"
  - Marketplace footer (feedback link + contact seller instructions)
  - Horizontal dashed separator
  - Centered "Amazon.in Declaration Letter / To Whomsoever It May Concern"
  - "I, {buyer_name}, have placed the order for"
  - Declaration items table (Quantity | Product Details)
  - "Order ID: ..."  + ship-to address (no phone)

Page 2:
  - Address continuation
  - "I hereby confirm..." legal text

Only field actually required from the caller: `order_doc` (a dict matching
`amazon_order_processing` schema). Missing fields fall back to "—" so the PDF
still renders for partially-scraped orders.
"""

from __future__ import annotations

import io
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple


# Seller short code per firm — Amazon shows this as the "Seller Name" on the
# packing slip ("Thank you for buying from MGIG."). Sourced from the reference
# PDF and from the firm records in Mongo. Add more here as we ship from other
# firms; falls back to the firm's full name if not mapped.
FIRM_SHORT_CODES = {
    "8bf93db6-045f-4aed-988c-352103ed049d": "MGIG",      # MuscleGrid Industries Gurgaon
    "c715c1b7-aca3-4100-8b00-4f711a729829": "SPV",       # SPV Industries
    "76b41510-bb17-42be-887f-abcbfd9f4180": "EB",        # Electronics Bay
    "a9b65de0-ef07-47d7-b778-2a9f63ef52ab": "EBAY UP",   # EBAY UP
    "16abb602-875d-4283-bed9-f8789e688a17": "MGIPL",     # MGIPL
}


_DEJAVU_REGISTERED = False


def _ensure_unicode_font():
    """Register DejaVu Sans with reportlab so the rendered PDF can display
    the ₹ glyph. Reportlab's bundled Helvetica is WinAnsi-only and renders ₹
    as a tofu square. Idempotent — safe to call before every render."""
    global _DEJAVU_REGISTERED
    if _DEJAVU_REGISTERED:
        return
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        candidates = [
            ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
             "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ]
        for reg, bold in candidates:
            if Path(reg).exists() and Path(bold).exists():
                pdfmetrics.registerFont(TTFont("DejaVuSans", reg))
                pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", bold))
                from reportlab.pdfbase.pdfmetrics import registerFontFamily
                registerFontFamily(
                    "DejaVuSans",
                    normal="DejaVuSans",
                    bold="DejaVuSans-Bold",
                )
                _DEJAVU_REGISTERED = True
                return
    except Exception:
        # Fall back to Helvetica; ₹ will render as tofu but the rest is fine.
        pass


def _fmt_inr(amount: Optional[float]) -> str:
    if amount is None:
        return "—"
    try:
        return f"₹{float(amount):,.2f}"
    except (TypeError, ValueError):
        return "—"


def _parse_address_block(raw: str, buyer_name: str) -> Tuple[List[str], Optional[str], Optional[str]]:
    """Turn the raw ship-to text (newline-and-tab-soup scraped from Amazon)
    into (address_lines, contact_buyer, phone_from_block).

    The raw form looks like:
        "Ship to\\n\\n\\nPrem mishra\\nMadhav Auto sales\\nSemti\\n"
        "Sultanpur,\\xa0UTTAR PRADESH\\xa0227812\\n\\n\\n\\n"
        "Contact Buyer:\\tJai\\n\\nPhone:\\t9452644635\\t\\n"

    Returns address_lines stripped of the buyer name (it's added back as the
    first row separately) and free of the Contact/Phone labels.
    """
    if not raw:
        return ([], None, None)
    text = raw.replace("\xa0", " ")
    contact_buyer = None
    phone = None
    lines: List[str] = []
    for raw_line in text.split("\n"):
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        if line.lower().startswith("ship to"):
            continue
        m = re.match(r"Contact Buyer:\s*(.+)", line, re.IGNORECASE)
        if m:
            contact_buyer = m.group(1).strip()
            continue
        m = re.match(r"Phone:\s*(\+?\d[\d\s\-]{7,})", line, re.IGNORECASE)
        if m:
            phone = re.sub(r"\D", "", m.group(1))
            continue
        # Skip the buyer-name line — we add it back as the header.
        if buyer_name and line.lower() == buyer_name.lower():
            continue
        lines.append(line)
    # Dedupe while preserving order
    seen = set()
    deduped = []
    for l in lines:
        key = l.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(l)
    return (deduped, contact_buyer, phone)


def _fmt_order_date(value: Any) -> str:
    """Format various datetime representations as 'Sun, May 24, 2026'."""
    if not value:
        return "—"
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    if isinstance(value, datetime):
        return value.strftime("%a, %b %d, %Y")
    return str(value)


def _seller_short(order_doc: Dict[str, Any]) -> str:
    code = FIRM_SHORT_CODES.get(order_doc.get("firm_id"))
    if code:
        return code
    name = order_doc.get("firm_name") or "Seller"
    # Last-resort: take first letters from each word, max 5 chars
    initials = "".join(w[0] for w in name.split() if w)[:5].upper()
    return initials or "SELLER"


def generate_packing_slip_pdf(order_doc: Dict[str, Any]) -> bytes:
    """Return PDF bytes for an Amazon-format packing slip built from a single
    amazon_order_processing document."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable,
    )

    _ensure_unicode_font()

    buyer_name = order_doc.get("customer_name") or "—"
    address_raw = order_doc.get("customer_address") or ""
    city = order_doc.get("customer_city") or ""
    state = order_doc.get("customer_state") or ""
    pincode = order_doc.get("customer_pincode") or ""
    phone_field = order_doc.get("customer_phone") or ""
    order_id = order_doc.get("amazon_order_id") or order_doc.get("order_id") or "—"
    order_value = order_doc.get("order_value")
    seller_short = _seller_short(order_doc)

    # Parse the soupy address block (handles both the legacy multi-line scrape
    # and the cleaner comma-separated form). Extract contact buyer + phone
    # from the block if present.
    addr_lines, parsed_contact, parsed_phone = _parse_address_block(address_raw, buyer_name)
    if not addr_lines:
        # New-style: customer_address is just the street, city/state/pincode separate
        for chunk in (address_raw or "").split(","):
            chunk = chunk.strip()
            if chunk and chunk.lower() != buyer_name.lower():
                addr_lines.append(chunk)
    loc_line = f"{city}, {state} {pincode}".strip(", ")
    if loc_line:
        # Normalised key for dedupe — strip commas, collapse whitespace, lowercase.
        def _key(s: str) -> str:
            return re.sub(r"[\s,]+", " ", s).strip().lower()
        loc_key = _key(loc_line)
        existing_keys = {_key(l) for l in addr_lines}
        # Also check substring matches (parsed line "Sultanpur, UTTAR PRADESH 227812"
        # vs synthesized "UTTAR PRADESH, 227812" — the state+pin is contained).
        state_pin = _key(f"{state} {pincode}")
        if loc_key not in existing_keys and not any(state_pin and state_pin in ek for ek in existing_keys):
            addr_lines.append(loc_line)

    phone = phone_field or parsed_phone or "—"
    contact_buyer = order_doc.get("contact_buyer") or parsed_contact or (
        buyer_name.split()[0] if buyer_name and buyer_name != "—" else "—"
    )
    # Order date — fall back to processed_at; the seller is what we have.
    order_date = _fmt_order_date(order_doc.get("order_date") or order_doc.get("processed_at"))
    shipping_service = order_doc.get("shipping_service") or "Standard"

    # Product / item info — single-line products only for now (FBM self-ship
    # tends to be one SKU per order in our shop).
    product_title = order_doc.get("product_title") or "Amazon Order Product"
    sku = order_doc.get("product_sku") or "—"
    asin = order_doc.get("asin") or "—"
    order_item_id = order_doc.get("order_item_id") or "—"
    condition = order_doc.get("condition") or "New"

    # Tax breakdown. If we only have a single total, infer GST as 18% of taxable
    # value: total = subtotal * 1.18, so subtotal = total / 1.18, tax = total - subtotal.
    if order_value is not None:
        try:
            total = float(order_value)
            subtotal = round(total / 1.18, 2)
            tax = round(total - subtotal, 2)
        except (TypeError, ValueError):
            total = subtotal = tax = None
    else:
        total = subtotal = tax = None

    # Header has the buyer name on its own line followed by the parsed addr.
    ship_to_lines = [buyer_name] + addr_lines

    # ---- Build document ----
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
        title=f"Packing Slip {order_id}",
    )

    # Pick DejaVu when available (registered above) — needed for ₹. Fallback
    # to Helvetica means the rupee glyph will render as a tofu square.
    from reportlab.pdfbase import pdfmetrics
    if "DejaVuSans" in pdfmetrics.getRegisteredFontNames():
        FONT_REG, FONT_BOLD = "DejaVuSans", "DejaVuSans-Bold"
    else:
        FONT_REG, FONT_BOLD = "Helvetica", "Helvetica-Bold"

    styles = getSampleStyleSheet()
    base = ParagraphStyle("base", parent=styles["Normal"], fontName=FONT_REG, fontSize=10, leading=13)
    bold = ParagraphStyle("bold", parent=base, fontName=FONT_BOLD)
    h2 = ParagraphStyle("h2", parent=bold, fontSize=12, leading=15)
    center_bold = ParagraphStyle("centerbold", parent=bold, alignment=TA_CENTER, fontSize=12, leading=16)
    right_bold = ParagraphStyle("rightbold", parent=bold, alignment=TA_RIGHT, fontSize=11)
    small = ParagraphStyle("small", parent=base, fontSize=9, leading=11)

    flow = []

    # --- Ship to header block ---
    flow.append(Paragraph("Ship to:", base))
    for line in ship_to_lines:
        flow.append(Paragraph(f"<b>{line}</b>", h2))
    flow.append(Paragraph(f"<b>Phone : &nbsp; {phone}</b>", h2))
    flow.append(Spacer(1, 6))
    flow.append(HRFlowable(width="100%", thickness=0.5, dash=(2, 2), color=colors.black))
    flow.append(Spacer(1, 8))

    # --- Order ID + thank you ---
    flow.append(Paragraph(f"<b>Order ID: {order_id}</b>", h2))
    flow.append(Paragraph(f"Thank you for buying from {seller_short}.", base))
    flow.append(Spacer(1, 8))

    # --- Order Summary table (2-column: left key/value pair + right key/value pair) ---
    delivery_addr_lines = [Paragraph("<b>Delivery address:</b>", base)]
    for line in ship_to_lines:
        delivery_addr_lines.append(Paragraph(line, base))

    right_meta = Table(
        [
            [Paragraph("<b>Order Date:</b>", base), Paragraph(order_date, base)],
            [Paragraph("<b>Shipping Service:</b>", base), Paragraph(shipping_service, base)],
            [Paragraph("<b>Buyer Name:</b>", base), Paragraph(contact_buyer, base)],
            [Paragraph("<b>Seller Name:</b>", base), Paragraph(seller_short, base)],
        ],
        colWidths=[45 * mm, 50 * mm],
    )
    right_meta.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))

    summary = Table(
        [[delivery_addr_lines, right_meta]],
        colWidths=[80 * mm, 95 * mm],
    )
    summary.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    flow.append(summary)
    flow.append(Spacer(1, 10))

    # --- Items table ---
    product_cell = [
        Paragraph(f"<b>{product_title}</b>", base),
        Paragraph(f"<b>SKU:</b> {sku}", base),
        Paragraph(f"<b>ASIN:</b> {asin}", base),
        Paragraph(f"<b>Condition:</b> {condition}", base),
        Paragraph(f"<b>Order Item ID:</b> {order_item_id}", base),
    ]
    totals_cell = [
        Paragraph(f"<b>Item subtotal</b> &nbsp;&nbsp; {_fmt_inr(subtotal)}", base),
        Paragraph(f"<b>Tax</b> &nbsp;&nbsp; {_fmt_inr(tax)}", base),
        Paragraph(f"<b>Item total</b> &nbsp;&nbsp; {_fmt_inr(total)}", base),
    ]
    items = Table(
        [
            [
                Paragraph("<b>Quantity</b>", base),
                Paragraph("<b>Quantity Included</b>", base),
                Paragraph("<b>Product Details</b>", base),
                Paragraph("<b>Unit price</b>", base),
                Paragraph("<b>Order Totals</b>", base),
            ],
            [
                Paragraph("1", base),
                Paragraph("1", base),
                product_cell,
                # Wrap in Paragraph so reportlab uses the DejaVu font (₹ glyph)
                # instead of the Table's default Helvetica which renders ₹ as tofu.
                Paragraph(_fmt_inr(total), base),
                totals_cell,
            ],
        ],
        colWidths=[22 * mm, 25 * mm, 66 * mm, 24 * mm, 38 * mm],
    )
    items.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (1, -1), "CENTER"),
        ("ALIGN", (3, 0), (3, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    flow.append(items)
    flow.append(Spacer(1, 6))
    flow.append(Paragraph(f"<b>Grand total: {_fmt_inr(total)}</b>", right_bold))
    flow.append(Spacer(1, 10))

    # --- Marketplace footer ---
    flow.append(Paragraph(
        "<b>Thanks for buying on Amazon Marketplace.</b> To provide feedback for the seller "
        "please visit www.amazon.in/feedback. To contact the seller, go to Your Orders in "
        "Your Account. Click the seller's name under the appropriate product. Then, in the "
        "&quot;Further Information&quot; section, click &quot;Contact the Seller.&quot;",
        small,
    ))
    flow.append(Spacer(1, 8))
    flow.append(HRFlowable(width="100%", thickness=0.5, dash=(2, 2), color=colors.black))
    flow.append(Spacer(1, 10))

    # --- Declaration Letter ---
    flow.append(Paragraph("<b>Amazon.in Declaration Letter</b><br/><b>To Whomsoever It May Concern</b>", center_bold))
    flow.append(Spacer(1, 10))
    flow.append(Paragraph(f"I, {contact_buyer}, have placed the order for", base))
    flow.append(Spacer(1, 6))
    decl_product_cell = [
        Paragraph(product_title, base),
        Paragraph(f"<b>SKU:</b> {sku}", base),
        Paragraph(f"<b>Condition:</b> {condition}", base),
        Paragraph(f"<b>Order Item ID:</b> {order_item_id}", base),
    ]
    decl = Table(
        [
            [Paragraph("<b>Quantity</b>", base), Paragraph("<b>Product Details</b>", base)],
            [Paragraph("1", base), decl_product_cell],
        ],
        colWidths=[25 * mm, 150 * mm],
    )
    decl.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    flow.append(decl)
    flow.append(Spacer(1, 12))

    # --- Order ID + ship-to address (no phone) at end of declaration ---
    flow.append(Paragraph(f"<b>Order ID: {order_id}</b>", h2))
    for line in ship_to_lines:
        flow.append(Paragraph(line, base))

    flow.append(Spacer(1, 16))
    flow.append(Paragraph(
        "I hereby confirm that said above goods are being purchased for my internal or "
        "personal purpose and not for re-sale. I further understand and agree to Amazons "
        "Terms and Conditions of Sale available at www.amazon.in or upon request.",
        base,
    ))

    doc.build(flow)
    return buf.getvalue()

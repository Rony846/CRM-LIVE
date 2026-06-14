"""Pratibha's Claude brain.

The original agent ran a local 3B model (qwen2.5:3b) for intent extraction and
reply drafting — too small to reliably tell the salutation ("Hi Pratibha") from
the query subject ("Amit"), and with no way to answer counts/filters. This module
swaps that brain for Claude (default claude-haiku-4-5, same family the WhatsApp
agent uses) and gives her read-only CRM query tools so "how many customers named
Amit live in UP" becomes a real database query instead of a guess.

Design notes:
- Pure orchestration. The actual DB queries live in server.py (where `db` is) and
  are injected as an async `tool_executor(name, params) -> dict`. This keeps the
  module free of DB coupling and mirrors how the MCP server exposes CRM tools.
- Every entrypoint is fail-safe: on any API/parse error it returns model_ok=False
  so the caller can fall back to the local model or hold the mail for a human.
"""
import os
import re
import json
import logging

import anthropic

logger = logging.getLogger(__name__)

_client = None


def model() -> str:
    """Fast/cheap model for routing, triage, and extraction."""
    return os.environ.get("EMAIL_AGENT_MODEL", "claude-haiku-4-5")


def model_reply() -> str:
    """Stronger model for the reasoning that matters — data answers + customer replies."""
    return os.environ.get("EMAIL_AGENT_REPLY_MODEL", "claude-sonnet-4-6")


def support_model() -> str:
    """The customer-support AGENT runs on the most capable brain (vision + manual reasoning + tools)."""
    return os.environ.get("PRATIBHA_SUPPORT_MODEL", "claude-opus-4-8")


def available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())


# ---- API usage / cost tracking -------------------------------------------- #
# Captured in ONE place by wrapping the client, so every Claude call (Pratibha + CA agent
# + server-side) is logged. Buffer is drained to Mongo by the poll. INR ≈ USD × 83.
_USAGE = []
_PRICE_INR = {                       # (input_per_1M, output_per_1M)
    "claude-haiku-4-5": (83, 415),    # ~$1 / $5
    "claude-sonnet-4-6": (249, 1245), # ~$3 / $15
    "claude-opus-4-8": (1245, 6225),  # ~$15 / $75 — the smart-tier brain; the router keeps it to the hard ~20%
}


def usage_cost_inr(model, tin, tout):
    pin, pout = _PRICE_INR.get(model, (249, 1245))  # default to Sonnet rate if unknown
    return round((tin or 0) / 1e6 * pin + (tout or 0) / 1e6 * pout, 4)


def drain_usage():
    """Return and clear buffered usage events (called by the poll to persist them)."""
    global _USAGE
    u, _USAGE = _USAGE, []
    return u


def _wrap_usage(client):
    orig = client.messages.create

    async def logged(*args, **kwargs):
        resp = await orig(*args, **kwargs)
        try:
            u = resp.usage
            _USAGE.append({"model": kwargs.get("model"),
                           "in": getattr(u, "input_tokens", 0) or 0,
                           "out": getattr(u, "output_tokens", 0) or 0})
        except Exception:
            pass
        return resp
    client.messages.create = logged


def _client_or_none():
    global _client
    if not available():
        return None
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"].strip())
        _wrap_usage(_client)
    return _client


def _text(resp) -> str:
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()


def _sys(text):
    """System prompt as a cached block (5-min prompt cache, cheap on repeat calls)."""
    return [{"type": "text", "text": text, "cache_control": {"type": "ephemeral"}}]


def _attachment_blocks(items, limit: int = 5):
    """Build Anthropic content blocks from captured attachments — an 'image' block for images and a
    'document' block for PDFs (Amazon invoices / supplier bills), so the model can read either."""
    blocks = []
    for it in (items or [])[:limit]:
        mt = it.get("media_type", "image/jpeg")
        src = {"type": "base64", "media_type": mt, "data": it["b64"]}
        if it.get("kind") == "document" or mt == "application/pdf":
            blocks.append({"type": "document", "source": {**src, "media_type": "application/pdf"}})
        else:
            blocks.append({"type": "image", "source": src})
    return blocks


# --------------------------------------------------------------------------- #
# 1) Intent routing — replaces the brittle "extract the name" step.           #
# --------------------------------------------------------------------------- #
_ROUTE_SYS = """You triage an email sent to a CRM assistant named "Pratibha" by an internal MuscleGrid \
staff member (MuscleGrid sells batteries, inverters, stabilizers, solar). Classify the request into ONE kind:
- "data": a question about CRM records — how many / count / find / list / look up a customer, lead, \
phone, address, city, state, etc.
- "action": a request to DO or CHANGE something — create a lead/ticket, add a note, update/close a \
ticket, edit a customer, or anything about money, refunds, payments, invoices, pricing, or shipping.
- "customer": they want you to write a reply to a customer, or it's general / a greeting / unclear.

CRITICAL: "Pratibha" is the assistant's OWN name (and the wake word). Never treat it as a person or \
record to look up. The thing to look up is whatever ELSE the email names.
Respond with ONLY compact JSON: {"kind":"data|action|customer"}"""


async def route(subject: str, body: str, sender: str) -> dict:
    client = _client_or_none()
    if client is None:
        return {"kind": None, "model_ok": False}
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=60, system=_sys(_ROUTE_SYS),
            messages=[{"role": "user",
                       "content": f"From: {sender}\nSubject: {subject or ''}\n\n{(body or '')[:4000]}"}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        kind = (json.loads(m.group(0)).get("kind") if m else None)
        return {"kind": kind if kind in ("data", "action", "customer") else "customer", "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha route failed: {e}")
        return {"kind": None, "model_ok": False}


# --------------------------------------------------------------------------- #
# 2) Data questions — Claude with read-only CRM query tools.                  #
# --------------------------------------------------------------------------- #
_DATE_HINT = "date as YYYY-MM-DD (inclusive)"

QUERY_TOOLS = [
    # --- customers / leads ---
    {
        "name": "count_customers",
        "description": "Count customer (party) or lead records matching filters. Use for 'how many customers'. "
                       "Customers support name+state+city; leads support name only (they have no state/city).",
        "input_schema": {"type": "object", "properties": {
            "name": {"type": "string", "description": "name contains (case-insensitive)"},
            "state": {"type": "string", "description": "Indian state, full or abbreviation (UP, MP, TN...)"},
            "city": {"type": "string"},
            "record": {"type": "string", "enum": ["customers", "leads", "both"], "description": "default customers"},
        }, "required": []},
    },
    {
        "name": "search_customers",
        "description": "List customers/leads matching filters, with name/phone/email/city/state (max 25).",
        "input_schema": {"type": "object", "properties": {
            "name": {"type": "string"}, "state": {"type": "string"}, "city": {"type": "string"},
            "phone": {"type": "string"}, "email": {"type": "string"},
            "record": {"type": "string", "enum": ["customers", "leads", "both"]},
            "limit": {"type": "integer", "description": "<=25"},
        }, "required": []},
    },
    # --- products (catalog / pricing) ---
    {
        "name": "search_products",
        "description": "Search the product/SKU catalog (master SKUs) by name or category. Returns SKU code, "
                       "category, MRP, selling & cost price, GST rate, HSN. Categories include Inverter, Battery, "
                       "Stabilizer, Solar Panel, Combo, Spare Part, Accessory. Does NOT include live stock levels.",
        "input_schema": {"type": "object", "properties": {
            "name": {"type": "string"}, "category": {"type": "string"},
            "active_only": {"type": "boolean", "description": "default true"},
            "limit": {"type": "integer", "description": "<=25"},
        }, "required": []},
    },
    # --- tickets (service / support) ---
    {
        "name": "count_tickets",
        "description": "Count service/support tickets matching filters. Statuses include new_request, in_progress, "
                       "in_repair, dispatched, resolved, closed, escalated_to_supervisor, customer_escalated, etc.",
        "input_schema": {"type": "object", "properties": {
            "status": {"type": "string"}, "customer": {"type": "string", "description": "customer name or phone"},
            "support_type": {"type": "string"}, "sla_breached": {"type": "boolean"},
            "open_only": {"type": "boolean", "description": "true = exclude closed/resolved"},
            "date_from": {"type": "string", "description": _DATE_HINT}, "date_to": {"type": "string", "description": _DATE_HINT},
        }, "required": []},
    },
    {
        "name": "search_tickets",
        "description": "List tickets matching filters with ticket number, status, customer, product, issue, dates (max 25).",
        "input_schema": {"type": "object", "properties": {
            "ticket_number": {"type": "string"}, "status": {"type": "string"},
            "customer": {"type": "string"}, "support_type": {"type": "string"},
            "open_only": {"type": "boolean"},
            "date_from": {"type": "string", "description": _DATE_HINT}, "date_to": {"type": "string", "description": _DATE_HINT},
            "limit": {"type": "integer", "description": "<=25"},
        }, "required": []},
    },
    # --- finance & accounts ---
    {
        "name": "list_firms",
        "description": "List the company's billing firms (id, name, GSTIN, state). Use this to resolve a firm name "
                       "before filtering finance queries, or when asked what firms exist.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "sales_summary",
        "description": "Aggregate SALES INVOICES: total count and summed grand_total, taxable value, GST, and balance "
                       "due. Filter by firm, party (customer), and invoice-date range. Use for revenue / sales totals.",
        "input_schema": {"type": "object", "properties": {
            "firm": {"type": "string", "description": "firm name or id (see list_firms)"},
            "party": {"type": "string", "description": "customer/party name"},
            "date_from": {"type": "string", "description": _DATE_HINT}, "date_to": {"type": "string", "description": _DATE_HINT},
        }, "required": []},
    },
    {
        "name": "search_invoices",
        "description": "List/look up sales invoices with number, party, firm, date, grand total, balance due (max 25).",
        "input_schema": {"type": "object", "properties": {
            "invoice_number": {"type": "string"}, "party": {"type": "string"}, "firm": {"type": "string"},
            "unpaid_only": {"type": "boolean", "description": "true = only invoices with balance due > 0"},
            "date_from": {"type": "string", "description": _DATE_HINT}, "date_to": {"type": "string", "description": _DATE_HINT},
            "limit": {"type": "integer", "description": "<=25"},
        }, "required": []},
    },
    {
        "name": "outstanding_receivables",
        "description": "Money owed to the company: count and total of invoice balance_due (> 0), optionally by firm or "
                       "party, plus the top parties by amount owed. Use for 'how much is outstanding / pending payment'. "
                       "NOTE: invoice payment_status is unreliable here — dues are computed from balance_due.",
        "input_schema": {"type": "object", "properties": {
            "firm": {"type": "string"}, "party": {"type": "string"},
        }, "required": []},
    },
    {
        "name": "payments_summary",
        "description": "Aggregate PAYMENTS: count and total amount. type 'received' = money in, 'made' = money out. "
                       "Filter by firm, party, and payment-date range.",
        "input_schema": {"type": "object", "properties": {
            "type": {"type": "string", "enum": ["received", "made", "both"]},
            "firm": {"type": "string"}, "party": {"type": "string"},
            "date_from": {"type": "string", "description": _DATE_HINT}, "date_to": {"type": "string", "description": _DATE_HINT},
        }, "required": []},
    },
    {
        "name": "expenses_summary",
        "description": "Aggregate recorded EXPENSES: count and total gross & net-payable amount. Filter by firm, "
                       "expense_type, and expense-date range.",
        "input_schema": {"type": "object", "properties": {
            "firm": {"type": "string"}, "expense_type": {"type": "string"},
            "date_from": {"type": "string", "description": _DATE_HINT}, "date_to": {"type": "string", "description": _DATE_HINT},
        }, "required": []},
    },
    {
        "name": "party_balance",
        "description": "A specific party's (customer/dealer/vendor) latest running ledger balance and recent entries. "
                       "Negative running_balance generally means the company owes them / advance; positive means they owe.",
        "input_schema": {"type": "object", "properties": {
            "party": {"type": "string", "description": "party name (required)"},
            "firm": {"type": "string"},
        }, "required": ["party"]},
    },
    # --- operations: shipping, warranty, quotations, dealers, stock ---
    {
        "name": "track_shipment",
        "description": "Dispatch/shipment status. Look up by tracking/AWB, dispatch number, ticket number, or "
                       "customer name/phone. Returns courier, tracking id, status, dispatched date.",
        "input_schema": {"type": "object", "properties": {
            "tracking_id": {"type": "string"}, "dispatch_number": {"type": "string"},
            "ticket_number": {"type": "string"}, "customer": {"type": "string", "description": "name or phone"},
            "limit": {"type": "integer"}}, "required": []},
    },
    {
        "name": "warranty_lookup",
        "description": "Warranty status by serial number, warranty number, order id, or customer phone. Returns "
                       "product, status, warranty_end_date, and whether it's still in warranty.",
        "input_schema": {"type": "object", "properties": {
            "serial_number": {"type": "string"}, "warranty_number": {"type": "string"},
            "order_id": {"type": "string"}, "phone": {"type": "string"}}, "required": []},
    },
    {
        "name": "quotation_lookup",
        "description": "Quotations/PIs by quotation number, customer name/phone, or firm. Returns number, status, "
                       "grand total, validity date, item count.",
        "input_schema": {"type": "object", "properties": {
            "quotation_number": {"type": "string"}, "customer": {"type": "string"}, "firm": {"type": "string"},
            "limit": {"type": "integer"}}, "required": []},
    },
    {
        "name": "dealer_lookup",
        "description": "Dealer records by name, phone, city, or state. Returns contact, city/state, status, and "
                       "security-deposit status.",
        "input_schema": {"type": "object", "properties": {
            "name": {"type": "string"}, "phone": {"type": "string"}, "city": {"type": "string"},
            "state": {"type": "string"}, "limit": {"type": "integer"}}, "required": []},
    },
    {
        "name": "stock_level",
        "description": "Current stock quantity for a product (matched by name or SKU code) across firms, from the "
                       "stock tracker. Use for 'how much stock of X do we have'.",
        "input_schema": {"type": "object", "properties": {
            "product": {"type": "string", "description": "product name or SKU code"}}, "required": ["product"]},
    },
    # --- 360 customer view + knowledge base ---
    {
        "name": "customer_360",
        "description": "A consolidated 360 view of one customer (by name, phone, or email): profile + recent "
                       "tickets, orders, dispatches, warranties, quotations, and call history. Use this when you "
                       "need the full picture of a customer before answering or replying.",
        "input_schema": {"type": "object", "properties": {
            "query": {"type": "string", "description": "customer name, phone, or email"}}, "required": ["query"]},
    },
    {
        "name": "knowledge_lookup",
        "description": "Search MuscleGrid's product knowledge base (datasheets + catalog): specifications, features, "
                       "warranty terms, certifications, by product name/model/category. Use for product, spec, "
                       "warranty-term, or troubleshooting questions. Returns grounded product facts (never guess specs).",
        "input_schema": {"type": "object", "properties": {
            "query": {"type": "string", "description": "product name/model, category, or topic"}}, "required": ["query"]},
    },
    # --- executive / VP view ---
    {
        "name": "business_metrics",
        "description": "Company KPIs for a period vs the previous one: sales (invoiced), collections (payments in), "
                       "tickets created/closed, dispatches. Use for 'how are we doing this week/month', trends, totals.",
        "input_schema": {"type": "object", "properties": {
            "period": {"type": "string", "enum": ["today", "this_week", "last_week", "this_month", "last_month"],
                       "description": "default this_week"}}, "required": []},
    },
    {
        "name": "staff_performance",
        "description": "Team accountability: per-staff open and SLA-breached tickets (and unassigned backlog). Pass a "
                       "name to focus on one person. Use for 'how is X performing', 'who has the most open tickets'.",
        "input_schema": {"type": "object", "properties": {
            "name": {"type": "string", "description": "optional staff name to focus on"}}, "required": []},
    },
    # --- co-founder: financial depth, margins, growth, memory ---
    {
        "name": "pnl_summary",
        "description": "Profit & loss for a period: revenue (ex-GST), COGS, marketplace fees, gross profit & margin %, "
                       "expenses, net profit. Use for 'are we profitable', 'P&L', margins over time.",
        "input_schema": {"type": "object", "properties": {
            "period": {"type": "string", "enum": ["today", "this_week", "last_week", "this_month", "last_month"]}}, "required": []},
    },
    {
        "name": "cash_flow",
        "description": "Indicative cash position: receivables due in vs recent expense outflow / monthly run-rate. "
                       "Use for 'what's our cash position', 'runway', 'cash gap'.",
        "input_schema": {"type": "object", "properties": {
            "days": {"type": "integer", "description": "look-back window for expense run-rate, default 30"}}, "required": []},
    },
    {
        "name": "product_margins",
        "description": "Per-SKU margin (selling vs cost vs MRP, GST): margin amount & %, flags loss-making items. Use for "
                       "pricing/margin questions, 'which products lose money', 'what's the margin on X'.",
        "input_schema": {"type": "object", "properties": {
            "name": {"type": "string"}, "category": {"type": "string"},
            "loss_only": {"type": "boolean", "description": "only items priced below cost"},
            "limit": {"type": "integer"}}, "required": []},
    },
    {
        "name": "channel_performance",
        "description": "Growth view: orders & value by channel (Amazon / direct / offline) for a period, plus the "
                       "lead→converted and quotation→converted funnel. Use for channel strategy and conversion questions.",
        "input_schema": {"type": "object", "properties": {
            "period": {"type": "string", "enum": ["today", "this_week", "last_week", "this_month", "last_month"]}}, "required": []},
    },
    {
        "name": "gate_activity",
        "description": "The day's physical gate scans — outward (shipments leaving) and inward (parcels/returns "
                       "arriving), with counts and a line-list. Use for 'how many gate scans today', 'what shipped/"
                       "came in today' — this is the real movement signal.",
        "input_schema": {"type": "object", "properties": {
            "date": {"type": "string", "description": "YYYY-MM-DD; default today"}}, "required": []},
    },
    {
        "name": "daily_report",
        "description": "Full transactional report for a day: sales invoices (count + ₹), purchases, dispatches done, "
                       "and returns received, each with a line-list. Use for 'today's sales/purchase report', "
                       "'what dispatched and returned today'.",
        "input_schema": {"type": "object", "properties": {
            "date": {"type": "string", "description": "YYYY-MM-DD; default today"}}, "required": []},
    },
    {
        "name": "daily_movement",
        "description": "What's coming IN and going OUT on a day: orders placed, purchases received, returns, new "
                       "tickets (in); dispatched, delivered (out). Use for 'what moved today', daily in/out monitoring.",
        "input_schema": {"type": "object", "properties": {
            "date": {"type": "string", "description": "YYYY-MM-DD; default today"}}, "required": []},
    },
    {
        "name": "stuck_shipments",
        "description": "Bigship shipments that are stuck — not delivered after N days (e.g. NOT PICKED, stalled in "
                       "transit). Use for 'any stuck/delayed shipments', 'which parcels haven't moved'.",
        "input_schema": {"type": "object", "properties": {
            "days": {"type": "integer", "description": "min age in days, default 3"}}, "required": []},
    },
    {
        "name": "api_cost",
        "description": "Pratibha's own AI API spend for a month (total ₹, call count, and breakdown by model). "
                       "Use for 'how much are the agents costing', 'this month's API bill'.",
        "input_schema": {"type": "object", "properties": {
            "month": {"type": "string", "description": "YYYY-MM; default current month"}}, "required": []},
    },
    {
        "name": "recall_decisions",
        "description": "Recall the founder's past decisions, policies, and ongoing initiatives that Pratibha was told to "
                       "remember. Use to apply prior context/judgement, or when asked 'what did we decide about X'.",
        "input_schema": {"type": "object", "properties": {
            "topic": {"type": "string", "description": "optional topic to filter by"}}, "required": []},
    },
]

_DATA_SYS = """You are Pratibha, MuscleGrid's email assistant, answering an INTERNAL staff question about the \
CRM. You can look up: customers/leads, the product catalog & knowledge base, service tickets, shipments/dispatches, \
warranties, quotations, dealers, stock, a full customer-360 view, and finance/accounts (invoices, payments, \
receivables, expenses, ledgers). Use the tools to fetch REAL data — NEVER guess or invent numbers, names, specs, \
amounts, or dates; only state what the tools return, and CITE the record (ticket #, invoice #, AWB, serial) when you do.
- If you don't have enough information or a tool returns nothing, SAY SO plainly and suggest what's needed — do not fabricate.
- For broad questions about one customer, call customer_360 first to get the whole picture.
- For product specs / warranty terms / troubleshooting, use knowledge_lookup (grounded in datasheets).
- Indian state abbreviations expand to full names (UP=Uttar Pradesh, etc.). Leads have no state/city.
- Invoice payment_status is unreliable — for "how much is pending/outstanding" use outstanding_receivables (balance_due).
- Multiple billing firms exist (MGIPL, EBAY UP...). If a finance total could span firms and none was named, say it's across all firms.
- All money is INR (₹). Dates are YYYY-MM-DD.
Answer in a few concise lines, scoped (firm/date) and with record references. Don't reveal more than asked. End with 'Pratibha, MuscleGrid'."""


def _assistant_block(b):
    if getattr(b, "type", "") == "text":
        return {"type": "text", "text": b.text}
    if b.type == "tool_use":
        return {"type": "tool_use", "id": b.id, "name": b.name, "input": b.input}
    return {"type": "text", "text": ""}


_FINANCE_DENY = """\n\nIMPORTANT: This sender is NOT authorised for finance/accounts data. If they ask \
about money, sales, revenue, invoices, payments, receivables/outstanding, expenses, or a party's ledger \
balance, do NOT attempt it — politely reply that finance and accounts queries are restricted to the founder. \
You may still answer non-finance questions (customers, leads, products, tickets) normally."""


async def answer_data(subject: str, body: str, sender: str, tool_executor, allow_finance: bool = True) -> dict:
    """Run the tool-use loop to answer an internal data question. tool_executor is
    an async callable (name, params) -> dict provided by server.py. When allow_finance
    is False the model is told to refuse finance questions (and the executor hard-blocks
    the finance tools regardless, as the real security boundary)."""
    client = _client_or_none()
    if client is None:
        return {"reply": "", "model_ok": False, "tool_calls": 0}
    tools = [dict(t) for t in QUERY_TOOLS]
    tools[-1] = {**tools[-1], "cache_control": {"type": "ephemeral"}}
    system = _sys(_DATA_SYS if allow_finance else _DATA_SYS + _FINANCE_DENY)
    messages = [{"role": "user",
                 "content": f"From: {sender}\nSubject: {subject or ''}\n\n{(body or '')[:6000]}"}]
    calls = 0
    try:
        for _ in range(6):
            resp = await client.messages.create(
                model=model_reply(), max_tokens=1024, system=system, tools=tools, messages=messages)
            if resp.stop_reason != "tool_use":
                return {"reply": _text(resp), "model_ok": True, "tool_calls": calls}
            messages.append({"role": "assistant", "content": [_assistant_block(b) for b in resp.content]})
            results = []
            for b in resp.content:
                if getattr(b, "type", "") == "tool_use":
                    calls += 1
                    try:
                        out = await tool_executor(b.name, b.input or {})
                    except Exception as e:
                        out = {"error": str(e)}
                    results.append({"type": "tool_result", "tool_use_id": b.id,
                                    "content": json.dumps(out, default=str)[:8000]})
            messages.append({"role": "user", "content": results})
        # Exhausted the loop without a final answer — don't guess.
        return {"reply": "", "model_ok": False, "tool_calls": calls}
    except Exception as e:
        logger.error(f"Pratibha answer_data failed: {e}")
        return {"reply": "", "model_ok": False, "tool_calls": calls}


# --------------------------------------------------------------------------- #
# 3) Customer reply drafting.                                                 #
# --------------------------------------------------------------------------- #
_CUSTOMER_SYS = """You are Pratibha, the customer-support email assistant for MuscleGrid (batteries, inverters, \
stabilizers, solar). An internal staff member asked you to reply to a customer. Write a short, warm, professional \
reply, matching the customer's language (Hindi if they wrote Hindi, English if English).
You may be given CRM CONTEXT about this customer (their tickets, orders, warranty, etc.) and grounded product facts. \
USE that context to be specific and helpful — reference their actual ticket/order when relevant. If the context \
includes 'House style' or 'Lessons from past corrections', FOLLOW them — they reflect how the team wants replies \
written. But be accurate: only state facts present in the context; do NOT invent dates, amounts, refunds, specs, or \
replacements — for anything you weren't given, keep it general and say the team will confirm. \
NEVER share any internal email address with the customer — do NOT mention founder@, pratibha@, or any \
@musclegrid.in staff address. The ONLY contact you may give a customer is service@musclegrid.in (or the support \
phone). NEVER guess or invent the customer's name, and NEVER copy a name from the quoted email thread (it may be \
wrong); a correct greeting is added for you, so do NOT write your own 'Dear ...' / 'Hello ...' line — start \
directly with the first sentence of the message. End with 'Pratibha, MuscleGrid'. Output ONLY the reply body."""


def _clean_recipient_name(name: str) -> str:
    """A safe display name for the greeting, or '' if we can't trust one (then we greet neutrally)."""
    n = re.sub(r'["\'<>]', "", (name or "")).strip()
    if not n or "@" in n or len(n) < 2 or len(n) > 40 or not re.search(r"[A-Za-z]", n):
        return ""
    n = re.sub(r"\s+", " ", n)
    return n.title() if (n.isupper() or n.islower()) else n


def _apply_greeting(reply: str, name: str) -> str:
    """Strip any salutation the model wrote (which may carry a wrong/hallucinated name) and prepend the
    correct one built from the VERIFIED recipient name."""
    reply = re.sub(r"\A\s*(dear|hello|hi|hey|namaste|greetings|respected)\b[^\n]*\r?\n+",
                   "", reply or "", count=1, flags=re.I)
    greet = f"Dear {name}," if name else "Hello,"
    return f"{greet}\n\n{reply.lstrip()}"


def _scrub_internal_emails(text: str) -> str:
    """Hard guarantee: no internal @musclegrid.in address ever reaches a customer. Any such address
    (founder@, pratibha@, staff…) is rewritten to service@musclegrid.in — the only public contact."""
    if not text:
        return text
    return re.sub(
        r"\b[\w.+-]+@musclegrid\.in\b",
        lambda m: m.group(0) if m.group(0).lower() == "service@musclegrid.in" else "service@musclegrid.in",
        text, flags=re.I)


# WhatsApp + Hinglish override for customer chat. Customers (and field staff) get
# friendly Hinglish on WhatsApp — short, no email salutation/sign-off, no email address.
_WA_HINGLISH_STYLE = (
    "CHANNEL OVERRIDE — this is a WhatsApp chat, NOT email. Reply in friendly, simple Hinglish "
    "(Hindi written in Roman/English letters, the way people text on WhatsApp in India). Keep it "
    "SHORT — 1 to 3 sentences. Do NOT write 'Dear', do NOT add any sign-off like 'Pratibha, "
    "MuscleGrid', do NOT say 'reply to this email' and do NOT give any email address. Warm, helpful, human.")


_ESCALATION_SYS = """You triage a customer's WhatsApp message to MuscleGrid (inverters, batteries, \
stabilizers, solar) support. Decide if this needs a HUMAN MANAGER'S decision — a REAL ESCALATION.
Escalate = the customer is ANGRY / frustrated, DEMANDING a replacement or refund, threatening (legal / \
consumer court / social media), OR repeatedly/urgently asking for help that clearly isn't getting resolved \
("abhi karo", "I cannot wait", "help!!", "kab tak", repeated complaints). Messages may be in Hindi, Hinglish, \
or English — judge the INTENT, not keywords.
Do NOT escalate normal questions (order status, how-to, product info, a first-time problem report that you can \
still help with, greetings).
Respond with ONLY compact JSON: {"escalate": true|false, "wants": "replacement|refund|repair|callback|none", "reason": "<5-8 words>"}"""


_SUPPORT_PERSONA_PRATIBHA = """You are Pratibha, MuscleGrid's front-line WhatsApp support agent (MuscleGrid sells \
inverters, batteries, stabilizers, solar). You are chatting LIVE with a CUSTOMER on WhatsApp. You are a real, thinking \
agent — decide in the moment what to say and what to do. There is no script."""

_SUPPORT_PERSONA_KALPANA = """You are Kalpana, MuscleGrid's SENIOR customer-support specialist — Pratibha's senior and \
the escalation point. You step in personally when a case is complex, technical, the customer is upset, or a real \
decision is needed. You are calm, expert, thorough, and you OWN the resolution end-to-end. You are a real, thinking \
agent — decide in the moment what to say and what to do. There is no script.{handoff}"""

_SUPPORT_HANDOFF = ("\n- You are TAKING OVER this chat from Pratibha right now. In your FIRST message ONLY, introduce "
                    "yourself warmly in one short line (e.g. \"Main Kalpana, senior support se — ab main khud aapki "
                    "problem dekhungi\"), then get straight to helping. Do NOT introduce yourself again after that.")

_SUPPORT_SYS = """HOW YOU TALK
- PROFESSIONAL, courteous Hinglish (Hindi in Roman letters). Address the customer respectfully using "aap". Do NOT \
use casual words like "bhai", "yaar", "bro", or "dost". Keep it short, clear and polite — like a professional support \
executive. At most one emoji. No "Dear", no sign-off, no email address, never mention any internal email.
- Be empathetic and professional. Safety first: for burning smell / sparks / shock, tell them to switch off and unplug at once.

WHAT YOU CAN DO (tools — use your judgement on when)
- get_customer_info: look up THIS customer's warranty, service tickets, orders. Use it before stating facts; never invent.
- search_knowledge: search MuscleGrid's troubleshooting KB + the Titan/Focus user manuals (incl. wiring diagrams). Use it before technical advice.
- ask_manager: escalate a decision to the manager (Pawan/Shweta). The manager replies later (not instantly).
- arrange_pickup: book a courier pickup of the unit for repair — ONLY after a manager approved repair.
- notify_technician: WhatsApp the technician (Gaurav) in Hinglish.

PHOTOS (you can SEE)
- You can SEE images the customer sends — wiring, damage, the unit, the serial sticker, or their INVOICE. Look carefully.
- For a wiring/connection issue: ask for a clear photo, then check polarity (+/-), terminals and the connection sequence against the manual, and tell them exactly what looks wrong.

TROUBLESHOOTING (use the manuals)
- MuscleGrid has detailed user manuals for the TITAN, FOCUS and HEAVY-DUTY (3.6kW–6.2kW high-capacity) inverter series. To give
  model-specific help, first find the product SERIES: from get_customer_info (their ticket/warranty product name), or ASK the customer
  to send a photo of their INVOICE (you can read it) — the model/series will be on it. Once you know titan, focus or heavy_duty,
  call search_knowledge(query, series) and troubleshoot step-by-step from the manual + KB. If unsure of the series, ask for the invoice.

PRODUCT-SPECIFIC PLAYBOOKS (follow these exactly)
- LITHIUM BATTERY (LFP / BMS): this is an EXPENSIVE product — you must NOT diagnose-to-a-conclusion, promise anything, \
or decide repair/replace yourself. You MAY ask a few smart diagnostic questions (use search_knowledge series 'lithium' \
— the BMS manual — to frame them: charging behaviour, BMS cutoff, voltage, error LEDs, age). But for ANYTHING beyond \
basic info, call ask_manager and clearly recommend ANGAD must decide (your summary must say it's a lithium battery). \
Always route battery decisions to Angad.
- VOLTAGE STABILIZER: first ASK the customer to send clear PHOTOS of the stabilizer (front + the connections) — these \
get attached to the ticket. Our usual fix is to dispatch a replacement PCB first (it resolves most cases). You must \
ALWAYS get manager approval BEFORE dispatching a PCB: call ask_manager with the question "Stabilizer ka PCB dispatch \
karein?". Do NOT tell the customer a PCB is coming until the manager approves. If, after the PCB, the issue is still \
not resolved, then escalate to a reverse pickup of the stabilizer for repair (the normal repair flow).

YOUR JUDGEMENT & HARD RULES
- Try to RESOLVE the issue yourself first using search_knowledge + the customer's photos — step-by-step troubleshooting.
- Handle normal things yourself (order status, how-to, product help, a first problem report — guide them).
- You must NEVER promise or decide a REFUND, REPLACEMENT, or FREE REPAIR yourself. When the customer demands one, \
is angry, threatens, or an issue is clearly unresolved → call ask_manager (ask "repair, replace, or call?") and \
tell the customer you're checking with the team. Do NOT argue or repeat the same line.
- After a manager approves REPAIR → ask the customer for their pickup address (with pincode) + a contact number, \
then call arrange_pickup.
- Only state facts you actually looked up; for anything else, say the team will confirm.

You'll be given the customer's info and the CURRENT SITUATION. Decide your next WhatsApp message and any tool calls. \
Output ONLY the message to send the customer."""


SUPPORT_TOOLS = [
    {"name": "get_customer_info",
     "description": "Look up THIS customer's warranty, service tickets and recent orders so you can answer accurately.",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "search_knowledge",
     "description": ("Search MuscleGrid's troubleshooting knowledge base AND the inverter USER MANUALS for help with "
                     "the customer's issue. If you know the product series ('titan' or 'focus'), pass it to also pull "
                     "from that series' manual (including wiring diagrams / connection steps). Use this before giving "
                     "technical troubleshooting so your advice matches MuscleGrid's own manuals."),
     "input_schema": {"type": "object", "properties": {
         "query": {"type": "string", "description": "the issue/keywords, e.g. 'battery not charging', 'overload fault', 'wiring connection'"},
         "series": {"type": "string", "enum": ["titan", "focus", "heavy_duty", "lithium"],
                    "description": "product manual to also search: inverter series (titan/focus/heavy_duty) or 'lithium' (LFP battery BMS manual)"}},
         "required": ["query"]}},
    {"name": "ask_manager",
     "description": ("Escalate a decision to the manager (Pawan/Shweta). Use for replacement/refund/repair-vs-replace "
                     "decisions, angry customers, or anything you must not decide alone. The manager replies LATER. "
                     "After calling this, tell the customer you're checking with the team — do not promise an outcome."),
     "input_schema": {"type": "object", "properties": {
         "summary": {"type": "string", "description": "one line for the manager, in English: who + the issue"},
         "question": {"type": "string", "description": "the decision you need, e.g. 'repair, replace, ya call karein?'"}},
         "required": ["summary"]}},
    {"name": "arrange_pickup",
     "description": ("Book a courier pickup of the customer's unit for repair. ONLY use after a manager has approved "
                     "repair AND you have collected the customer's full pickup address. Structure the address into the "
                     "fields below from what the customer told you."),
     "input_schema": {"type": "object", "properties": {
         "address_line1": {"type": "string", "description": "house/street/area"},
         "city": {"type": "string"}, "state": {"type": "string"},
         "pincode": {"type": "string", "description": "6-digit PIN code"},
         "contact_phone": {"type": "string", "description": "10-digit pickup contact number"},
         "weight_kg": {"type": "number", "description": "approx package weight in kg"}},
         "required": ["address_line1", "city", "state", "pincode", "contact_phone"]}},
    {"name": "notify_technician",
     "description": "Send a WhatsApp message (in Hinglish) to the technician Gaurav — e.g. a unit has arrived, ask how long the repair will take.",
     "input_schema": {"type": "object", "properties": {"message": {"type": "string"}}, "required": ["message"]}},
]


_SUPPORT_TRIAGE_SYS = """You decide which brain should handle a customer's latest WhatsApp message to MuscleGrid \
support (sells inverters, batteries, stabilizers, solar). Two tiers:
- "easy": greetings, thanks, acknowledgements ("ok", "theek hai"), yes/no confirmations, giving a name / address / \
phone / pincode, simple ORDER or WARRANTY status questions, basic product or how-to questions, small talk. A junior \
agent could answer it in one line.
- "hard": ANY technical troubleshooting (not working, error code, beeping, sparks, burning smell, not charging, \
overload, wiring/connection), an unhappy / angry / impatient customer, a complaint, ANY demand or mention of refund / \
replacement / repair / warranty claim, anything ambiguous, emotional, or that needs multi-step reasoning or the \
product manuals.
When in ANY doubt, choose "hard" — it is far worse to under-serve a real problem than to spend a little more.
Judge the LATEST customer message, using the recent turns as context.
Respond with ONLY compact JSON: {"tier":"easy|hard"}"""


async def support_triage(conversation: list) -> str:
    """Router: pick the cheap brain (easy turns) or the smart brain (hard turns). A tiny Haiku call.
    Fails safe to 'hard' on any doubt or error — we never want to under-serve a real problem to save a rupee."""
    client = _client_or_none()
    if client is None:
        return "hard"
    convo = [m for m in conversation if m.get("content")][-6:]
    lines = []
    for m in convo:
        c = m["content"] if isinstance(m["content"], str) else "[customer sent a photo]"
        lines.append(("CUSTOMER: " if m["role"] == "user" else "PRATIBHA: ") + c)
    if not lines:
        return "hard"
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=20, system=_sys(_SUPPORT_TRIAGE_SYS),
            messages=[{"role": "user", "content": "\n".join(lines)[:3000]}])
        mt = re.search(r"\{.*\}", _text(resp), re.S)
        tier = (json.loads(mt.group(0)).get("tier") if mt else None)
        return "easy" if tier == "easy" else "hard"
    except Exception as e:
        logger.error(f"support_triage failed: {e}")
        return "hard"


async def support_agent(conversation: list, situation: str, tool_executor, brain: str = None, handoff: bool = False) -> dict:
    """The real customer-support agent: Claude decides what to say + which actions (tools) to take,
    turn by turn. `conversation` = [{role:'user'|'assistant', content:str}] (oldest→newest), `situation`
    = a context note (customer info + current state), `tool_executor` = async (name, input)->dict in server.py.
    `brain` = which model to run this turn: the cheap brain answers AS PRATIBHA (front-line), the smart brain
    (support_model, Opus) answers AS KALPANA, the senior who steps in for hard turns. `handoff`=True tells Kalpana
    she is taking over from Pratibha (so she introduces herself once). Returns {reply, model_ok, tool_calls}."""
    client = _client_or_none()
    if client is None:
        return {"reply": "", "model_ok": False, "tool_calls": 0}
    mdl = brain or support_model()
    is_senior = mdl == support_model()
    persona = (_SUPPORT_PERSONA_KALPANA.format(handoff=_SUPPORT_HANDOFF if handoff else "")
               if is_senior else _SUPPORT_PERSONA_PRATIBHA)
    tools = [dict(t) for t in SUPPORT_TOOLS]
    tools[-1] = {**tools[-1], "cache_control": {"type": "ephemeral"}}
    system = _sys(persona + "\n\n" + _SUPPORT_SYS + ("\n\n--- CURRENT SITUATION ---\n" + situation if situation else ""))
    messages = [{"role": m["role"], "content": m["content"]} for m in conversation if m.get("content")]
    if not messages:
        return {"reply": "", "model_ok": False, "tool_calls": 0}
    calls = 0
    try:
        for _ in range(6):
            resp = await client.messages.create(
                model=mdl, max_tokens=1024, system=system, tools=tools, messages=messages)
            if resp.stop_reason != "tool_use":
                return {"reply": _text(resp), "model_ok": True, "tool_calls": calls}
            messages.append({"role": "assistant", "content": [_assistant_block(b) for b in resp.content]})
            results = []
            for b in resp.content:
                if getattr(b, "type", "") == "tool_use":
                    calls += 1
                    try:
                        out = await tool_executor(b.name, b.input or {})
                    except Exception as e:
                        out = {"error": str(e)}
                    results.append({"type": "tool_result", "tool_use_id": b.id,
                                    "content": json.dumps(out, default=str)[:6000]})
            messages.append({"role": "user", "content": results})
        return {"reply": "", "model_ok": False, "tool_calls": calls}
    except Exception as e:
        logger.error(f"Pratibha support_agent failed: {e}")
        return {"reply": "", "model_ok": False, "tool_calls": calls}


_TECH_REPLY_SYS = """Gaurav, a repair technician at MuscleGrid, replied on WhatsApp about a unit he is repairing \
(message may be Hindi/Hinglish/English). Interpret his message.
Respond with ONLY compact JSON: {"kind": "estimate|done|problem|other", "eta": "<his time estimate exactly as said, \
e.g. '2 din', '3 ghante', else empty>", "note": "<short summary in Hinglish/English>"}
- "estimate" = he gives a time to finish (kitne din/ghante).
- "done" = repair finished / ready / ho gaya.
- "problem" = he reports an issue, a part needed, or a delay.
- "other" = greeting/unclear/anything else."""


async def interpret_technician_reply(text: str) -> dict:
    """Interpret the technician's WhatsApp reply about a repair. Fail-safe to 'other'."""
    client = _client_or_none()
    if client is None or not (text or "").strip():
        return {"kind": "other", "eta": "", "note": ""}
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=120, system=_sys(_TECH_REPLY_SYS),
            messages=[{"role": "user", "content": text[:1000]}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        d = json.loads(m.group(0)) if m else {}
        return {"kind": str(d.get("kind") or "other"), "eta": str(d.get("eta") or ""), "note": str(d.get("note") or "")}
    except Exception as e:
        logger.error(f"interpret_technician_reply failed: {e}")
        return {"kind": "other", "eta": "", "note": ""}


async def sense_escalation(text: str, context: str = "") -> dict:
    """LLM judgement (cheap model) on whether a customer WhatsApp message is a real escalation
    needing a manager decision. Language-agnostic (Hindi/Hinglish/English). Fail-closed to no-escalate."""
    client = _client_or_none()
    if client is None or not (text or "").strip():
        return {"escalate": False, "wants": "none", "reason": ""}
    ctx = f"\n\n[Context: {context}]" if context else ""
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=120, system=_sys(_ESCALATION_SYS),
            messages=[{"role": "user", "content": f"Customer message:\n{text[:1500]}{ctx}"}])
        raw = _text(resp)
        m = re.search(r"\{.*\}", raw, re.S)
        data = json.loads(m.group(0)) if m else {}
        return {"escalate": bool(data.get("escalate")),
                "wants": str(data.get("wants") or "none"),
                "reason": str(data.get("reason") or "")}
    except Exception as e:
        logger.error(f"Pratibha sense_escalation failed: {e}")
        return {"escalate": False, "wants": "none", "reason": ""}


async def draft_customer(sender: str, subject: str, body: str, context: str = "",
                         recipient_name: str = "", style_override: str = "") -> dict:
    client = _client_or_none()
    if client is None:
        return {"reply": "", "model_ok": False}
    ctx = f"\n\n--- CRM context about this customer (use it, don't repeat verbatim) ---\n{context}\n" if context else ""
    rn = _clean_recipient_name(recipient_name)
    # With a style override (e.g. WhatsApp Hinglish) the model writes its own greeting — so we
    # don't bolt on the deterministic English salutation.
    if style_override:
        nm = f" The customer's name is {rn}; greet them naturally if appropriate." if rn else ""
        name_note = f"\n\n[Write your own short, natural greeting in the message.{nm}]"
        sys_text = _CUSTOMER_SYS + "\n\n" + style_override
    else:
        name_note = (f"\n\n[The customer's verified name is: {rn}. A greeting is added automatically — do NOT "
                     f"write your own salutation, and never use any other name from the quoted thread.]" if rn else
                     "\n\n[The customer's name is unknown — a neutral greeting is added automatically; do NOT write "
                     "your own salutation or guess a name.]")
        sys_text = _CUSTOMER_SYS
    try:
        resp = await client.messages.create(
            model=model_reply(), max_tokens=700, system=_sys(sys_text),
            messages=[{"role": "user", "content": f"Subject: {subject or ''}\n\n{(body or '')[:6000]}{ctx}{name_note}"}])
        reply = _text(resp)
        # The model occasionally prepends a "Subject: ..." line — strip it so the body is clean.
        reply = re.sub(r"\A\s*subject\s*:.*?(?:\r?\n)+", "", reply, count=1, flags=re.I)
        reply = _scrub_internal_emails(reply)
        if not style_override:
            reply = _apply_greeting(reply, rn)      # deterministic, correct salutation (no wrong names)
        return {"reply": reply.strip(), "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha draft_customer failed: {e}")
        return {"reply": "", "model_ok": False}


# --------------------------------------------------------------------------- #
# 3b) Actionable-item / reminder extraction — time-bound commitments to chase.  #
# --------------------------------------------------------------------------- #
_TASK_SYS = """You read a business email for MuscleGrid (an Indian company selling inverters, batteries, \
stabilizers, solar). Extract any ACTIONABLE ITEMS that have a TIME deadline — something that must be DONE \
within the next few hours or few days (e.g. "ship by tomorrow", "call the customer in 2 hours", "refund by \
Friday", "send the quote today", "pick up the unit on Monday", "reply before EOD").
Only extract items with a real, near-term deadline (hours or a few days). IGNORE vague/no-deadline statements, \
pleasantries, and things already completed.
Today's date+time is given. Resolve relative deadlines ("tomorrow", "EOD", "in 2 hours", "by Friday") into an \
absolute ISO timestamp in UTC (assume IST = UTC+5:30 for the sender; "EOD" = 18:00 IST that day).
Respond with ONLY compact JSON:
{"tasks": [{"task": "<short imperative description>", "due_at": "YYYY-MM-DDTHH:MM:SSZ",
  "owner_hint": "<who should do it, if named, else empty>", "urgency": "high|medium|low"}]}
If there are no time-bound actionable items, return {"tasks": []}."""


_HANDOFF_SYS = """An INTERNAL MuscleGrid staff email was sent from one team member to another — a handoff about a \
customer/ticket. You are Pratibha, coordinating the team. Decide whether the RECIPIENT is being asked to DO \
something for a customer (call the customer, resolve a ticket, arrange service/pickup, share an update) and whether \
the instruction is CLEAR enough to act on right now.
Respond with ONLY compact JSON:
{"is_handoff": true|false,
 "clear": true|false,
 "action": "<one line: exactly what the recipient should do — e.g. 'call the customer back immediately about ticket MG-R-...'>",
 "clarify_question": "<if unclear: a SHORT question to ask the SENDER about what they want the recipient to do>"}
- is_handoff=false for pure FYI/no-action notes, acknowledgements, newsletters, or anything not asking the recipient to act.
- clear=true when there is an actionable ask (even implicit — e.g. forwarding a customer complaint to be handled).
- When clear, fill "action". When NOT clear, fill "clarify_question" (e.g. 'Do you want Angad to call the customer back immediately, or is there a specific note for him?')."""


_PAY_SYS = """You are Pratibha, MuscleGrid's assistant. Shweta (manager) sends you short WhatsApp notes about \
PAYMENTS that customers or dealers have made. Extract the payment details. Examples: \
"Ramesh ne 50000 pay kiye", "Dealer Sharma Electronics paid 1.2 lakh via NEFT", "Got 25k from Anil UPI ref 123". \
Respond with ONLY compact JSON:
{"is_payment": true|false,
 "party_name": "<the customer/dealer name as written, else empty>",
 "party_kind": "customer|dealer|unknown",
 "amount": <number in rupees, e.g. 120000 for '1.2 lakh' / '1.2L'; null if absent>,
 "mode": "<upi|neft|imps|rtgs|cheque|cash|bank|unknown>",
 "reference": "<txn/UTR/cheque ref if any, else empty>"}
- is_payment=true ONLY when the message reports money RECEIVED from a customer/dealer (not a request to pay, not a quote).
- Convert Indian number words: 'lakh'/'lac'/'L' = ×100000, 'k'/'hazaar' = ×1000, 'crore'/'cr' = ×10000000.
- If it's clearly not a payment report, is_payment=false."""


async def extract_payment(text: str) -> dict:
    """Parse a WhatsApp payment note from Shweta → party + amount + mode."""
    client = _client_or_none()
    if client is None:
        return {"is_payment": False, "model_ok": False}
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=250, system=_sys(_PAY_SYS),
            messages=[{"role": "user", "content": (text or "")[:1000]}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        j = json.loads(m.group(0)) if m else {}
        amt = j.get("amount")
        try:
            amt = float(amt) if amt is not None else None
        except (TypeError, ValueError):
            amt = None
        return {"is_payment": bool(j.get("is_payment")), "party_name": (j.get("party_name") or "").strip(),
                "party_kind": (j.get("party_kind") or "unknown").strip().lower(), "amount": amt,
                "mode": (j.get("mode") or "unknown").strip().lower(), "reference": (j.get("reference") or "").strip(),
                "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha extract_payment failed: {e}")
        return {"is_payment": False, "model_ok": False}


_PAY_REPLY_SYS = """Shweta is replying on WhatsApp about a payment you proposed to record against a matched \
customer/dealer. Decide her intent:
- "confirm": she agrees it's the right party / says go ahead (haan, ok, sahi hai, update karo, yes, theek hai, kar do).
- "correct": she says it's a DIFFERENT party (gives another name) → put that name in party_name.
- "cancel": leave it / not now (rehne do, cancel, abhi nahi, chhod do).
- "unrelated": her message is NOT about this payment at all (e.g. a different instruction).
Respond ONLY compact JSON: {"intent":"confirm|correct|cancel|unrelated","party_name":"<corrected name if correct, else empty>"}"""


_PAY_IMG_SYS = """You are reading a screenshot a manager sent on WhatsApp. Decide if it is a PAYMENT \
CONFIRMATION (a UPI / bank-transfer / NEFT / IMPS / cheque-deposit / payment-gateway receipt showing money \
received) — NOT a product photo, an order/invoice page, or a shipping label.
If it IS a payment confirmation, extract:
- the PAYER's name (the customer/dealer who paid — usually 'Paid to'/'From'/'Sender'),
- the amount in rupees,
- the mode (upi/neft/imps/rtgs/cheque/cash/bank),
- any transaction/UTR/reference id.
Respond with ONLY compact JSON:
{"is_payment": true|false,
 "party_name": "<payer name, else empty>",
 "amount": <rupees as number, else null>,
 "mode": "<upi|neft|imps|rtgs|cheque|cash|bank|unknown>",
 "reference": "<txn/UTR/ref, else empty>"}
If it is clearly not a payment confirmation, is_payment=false."""


async def extract_payment_image(images) -> dict:
    """Vision: read a payment-confirmation screenshot (UPI/bank) → payer + amount + mode + ref."""
    client = _client_or_none()
    if client is None or not images:
        return {"is_payment": False, "model_ok": False}
    content = _attachment_blocks(images)
    if not content:
        return {"is_payment": False, "model_ok": False}
    content.append({"type": "text", "text": "Is this a payment confirmation? Extract per the schema."})
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=300, system=_sys(_PAY_IMG_SYS),
            messages=[{"role": "user", "content": content}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        j = json.loads(m.group(0)) if m else {}
        amt = j.get("amount")
        try:
            amt = float(amt) if amt is not None else None
        except (TypeError, ValueError):
            amt = None
        return {"is_payment": bool(j.get("is_payment")), "party_name": (j.get("party_name") or "").strip(),
                "amount": amt, "mode": (j.get("mode") or "unknown").strip().lower(),
                "reference": (j.get("reference") or "").strip(), "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha extract_payment_image failed: {e}")
        return {"is_payment": False, "model_ok": False}


async def payment_reply(proposed: str, shweta_msg: str) -> dict:
    """Interpret Shweta's reply to a proposed payment match."""
    client = _client_or_none()
    if client is None:
        return {"intent": "unrelated", "party_name": "", "model_ok": False}
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=120, system=_sys(_PAY_REPLY_SYS),
            messages=[{"role": "user", "content": f"Proposed: {proposed}\n\nShweta's reply: {shweta_msg}"}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        j = json.loads(m.group(0)) if m else {}
        return {"intent": (j.get("intent") or "unrelated").strip().lower(),
                "party_name": (j.get("party_name") or "").strip(), "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha payment_reply failed: {e}")
        return {"intent": "unrelated", "party_name": "", "model_ok": False}


async def extract_internal_handoff(subject: str, body: str, sender_name: str = "", recipient_name: str = "") -> dict:
    """Classify a staff-to-staff handoff email: is the recipient being asked to act, and is it clear?"""
    client = _client_or_none()
    if client is None:
        return {"is_handoff": False, "model_ok": False}
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=300, system=_sys(_HANDOFF_SYS),
            messages=[{"role": "user", "content":
                       f"From: {sender_name}\nTo: {recipient_name}\nSubject: {subject or ''}\n\n{(body or '')[:3000]}"}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        j = json.loads(m.group(0)) if m else {}
        return {"is_handoff": bool(j.get("is_handoff")), "clear": bool(j.get("clear")),
                "action": (j.get("action") or "").strip(), "clarify_question": (j.get("clarify_question") or "").strip(),
                "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha extract_internal_handoff failed: {e}")
        return {"is_handoff": False, "model_ok": False}


_WA_DIALOG_SYS = """You are Pratibha, MuscleGrid's assistant, chatting with Shweta (your manager — address her \
as "mam") on WhatsApp IN HINGLISH (Hindi written in English letters, warm and natural, e.g. "Theek hai mam, \
abhi bhej deti hu"). You earlier showed Shweta a DRAFT reply to a CUSTOMER's email. Now Shweta has replied on \
WhatsApp. Decide what she means:
- APPROVED (e.g. "haan", "ok", "theek hai", "send", "send kar do", "bhej do", "yes", "👍") → action "send".
- WANTS CHANGES / gave feedback or new content → action "revise": rewrite the CUSTOMER reply (in the customer's \
own language — usually English or Hindi as the customer wrote, NOT Hinglish) incorporating her feedback.
- SKIP / LEAVE IT (e.g. "rehne do", "isko rehne do", "chhod do", "skip", "nahi", "abhi nahi", "baad me", \
"leave it", "don't reply", "ignore") → action "skip".
- UNCLEAR → action "ask".

IMPORTANT — compound messages: if Shweta's message contains an approval/skip command (send / bhej do / rehne do / etc.) \
AND ALSO extra instructions or context (e.g. "send kr do and Jaspreet will email the BIS certificate, copy her as well"), \
STILL classify the command (send/skip/revise) — do NOT downgrade to "ask" just because there is extra text. Put the extra \
instruction/commitment VERBATIM in "extra_note" so it can be tracked as a follow-up. If there is no extra instruction, \
leave extra_note empty. Acknowledge the note in to_shweta (e.g. "...aur Jaspreet wali BIS certificate wali baat note kar li hai").
Respond with ONLY compact JSON:
{"action":"send|revise|skip|ask",
 "revised_draft":"<full updated customer-facing reply if revise, else empty>",
 "extra_note":"<any additional instruction/commitment Shweta added, verbatim; else empty>",
 "to_shweta":"<short Hinglish WhatsApp message back to Shweta>"}
to_shweta examples — send: "Theek hai mam, customer ko abhi bhej deti hu ✅"; revise: "Ji mam, ye update kiya hai, \
ab send kar du?"; skip: "Theek hai mam, ise rehne deti hu 👍"; ask: "Mam thoda clear bataiye — bhej du ya rehne du?". \
Keep it short & polite."""


_WA_ROUTE_SYS = """You are the router for Pratibha, MuscleGrid's WhatsApp assistant. The sender is the \
founder (Pawan) or manager (Shweta). Pick the ONE skill that should handle this message. Skills:
- "payment": reporting a customer/dealer PAYMENT (text like "Ramesh ne 50000 diye" OR a payment/UPI/bank \
screenshot), OR replying to a pending payment question (which party / which PI / "update karo" / "confirm <REF>").
- "dispatch_done": saying a shipment has been dispatched ("dispatched <REF>", "dispatch ho gaya").
- "main_group": asking to make this group the main group.
- "draft_approval": responding to a customer-reply DRAFT Pratibha proposed (send / "send kr do" / revise / "rehne do").
- "shipping": a photo/PDF or request to MAKE a shipping label, OR a document (e.g. a certificate) to forward to a customer.
- "general": anything else — questions, CRM lookups, status checks, tasks, chit-chat, greetings.

You are given CONTEXT listing pending items. USE IT: if a payment is awaiting a party/PI answer and the \
message looks like an answer (a name, phone, PI number, or yes/ok), choose "payment". If a draft is awaiting \
approval and the message is an approval/edit/skip, choose "draft_approval". When unsure, choose "general" \
(it has full CRM tools and is safe). Respond with ONLY: {"skill":"payment|dispatch_done|main_group|draft_approval|shipping|general"}"""


async def route_whatsapp(text: str, context: str = "", has_media: bool = False) -> str:
    """LLM router: pick the skill to handle a WhatsApp message given live pending-state context.
    Returns one of the skill names, or 'general' on any uncertainty/error (safe default)."""
    client = _client_or_none()
    if client is None:
        return "general"
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=60, system=_sys(_WA_ROUTE_SYS),
            messages=[{"role": "user", "content":
                       f"CONTEXT: {context or 'No pending items.'}\nHAS_MEDIA: {has_media}\n\nMESSAGE:\n{(text or '(media only)')[:1500]}"}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        skill = (json.loads(m.group(0)).get("skill") if m else "general") or "general"
        valid = {"payment", "dispatch_done", "main_group", "draft_approval", "shipping", "general"}
        return skill if skill in valid else "general"
    except Exception as e:
        logger.error(f"Pratibha route_whatsapp failed: {e}")
        return "general"


async def wa_dialog(draft: str, shweta_msg: str, context: str = "") -> dict:
    """Interpret Shweta's WhatsApp reply about a drafted customer email → send / revise / ask (Hinglish)."""
    client = _client_or_none()
    if client is None:
        return {"action": "ask", "revised_draft": "", "to_shweta": "Mam thoda rukiye, system issue aa raha hai.", "model_ok": False}
    try:
        resp = await client.messages.create(
            model=model_reply(), max_tokens=900, system=_sys(_WA_DIALOG_SYS),
            messages=[{"role": "user", "content":
                       f"Draft I showed (to the customer):\n{draft}\n\n--- context ---\n{(context or '')[:2000]}\n\n"
                       f"--- Shweta's WhatsApp reply ---\n{shweta_msg}"}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        j = json.loads(m.group(0)) if m else {}
        return {"action": j.get("action", "ask"), "revised_draft": (j.get("revised_draft") or "").strip(),
                "extra_note": (j.get("extra_note") or "").strip(),
                "to_shweta": (j.get("to_shweta") or "").strip(), "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha wa_dialog failed: {e}")
        return {"action": "ask", "revised_draft": "", "to_shweta": "Mam ek baar phir bata dijiye?", "model_ok": False}


async def extract_tasks(subject: str, body: str, today_iso: str = None) -> dict:
    """Pull time-bound actionable items (with absolute due timestamps) from an email."""
    client = _client_or_none()
    if client is None:
        return {"tasks": [], "model_ok": False}
    hint = f"Now (UTC): {today_iso}\n\n" if today_iso else ""
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=500, system=_sys(_TASK_SYS),
            messages=[{"role": "user", "content": f"{hint}Subject: {subject or ''}\n\n{(body or '')[:4000]}"}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        j = json.loads(m.group(0)) if m else {}
        return {"tasks": j.get("tasks") or [], "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha extract_tasks failed: {e}")
        return {"tasks": [], "model_ok": False}


# --------------------------------------------------------------------------- #
# 4) Action extraction (used only when EMAIL_AGENT_ALLOW_ACTIONS=true).        #
# --------------------------------------------------------------------------- #
_ACTION_SYS = """A MuscleGrid staff member emailed the assistant asking it to DO something in the CRM. \
Pick the SINGLE best action and extract parameters. Respond with ONLY compact JSON:
{"action":"create_lead|create_ticket|add_note|update_ticket|edit_customer|financial|other",
"params":{"name":"","phone":"","email":"","details":"","ticket_number":"","status":"","assignee":""}}
- create_lead: add a new sales lead.  - create_ticket: open a support/complaint ticket.
- add_note: add a note about a customer.  - update_ticket: change a ticket's status/assignee/close/escalate.
- edit_customer: change a customer's saved details.
- financial: ANYTHING about money, refunds, payments, invoices, pricing, shipping/dispatch, or deletes.
- other: just a question, a customer reply, or unclear.
Only fill params you can find; leave the rest "".  """

_ACTIONS = {"create_lead", "create_ticket", "add_note", "update_ticket", "edit_customer", "financial", "other"}


_FIN_SYS = """You are Pratibha, MuscleGrid's email assistant, helping the FOUNDER do accounting data entry \
from an email and any attached image (e.g. a UPI/bank payment screenshot, or a photo/scan of a supplier \
invoice). Extract a SINGLE financial action and its fields. Read amounts, dates, and reference numbers from \
the image PRECISELY. If a field is not clearly present, set it null — NEVER invent values.

Respond with ONLY compact JSON:
{"action":"payment|purchase|sales_invoice|none","confidence":0.0-1.0,"params":{...},"missing":["field"...],
 "summary":"one-line summary of what will be recorded"}

action "payment" (money received or paid — screenshots are almost always this):
 params={"payment_type":"received|made","amount":number,"payment_date":"YYYY-MM-DD",
 "payment_mode":"upi|bank_transfer|cash|cheque|card|other","reference_number":string|null,
 "bank_name":string|null,"party_name":string|null,"firm":string|null,"notes":string|null}
 - "received"=money IN to MuscleGrid; "made"=MuscleGrid paid out.
 - party_name=the OTHER party (who paid us / whom we paid), from the email text or the screenshot's payer/payee.
 - REQUIRED: payment_type, amount, payment_date, payment_mode, party_name.

action "purchase" (a supplier bill we received):
 params={"supplier_name":string,"supplier_gstin":string|null,"supplier_state":string|null,
 "invoice_number":string,"invoice_date":"YYYY-MM-DD","firm":string|null,
 "items":[{"description":string,"quantity":number,"rate":number,"gst_rate":number}],"notes":string|null}
 - REQUIRED: supplier_name, invoice_number, invoice_date, items.

action "sales_invoice" (we billed a customer):
 params={"party_name":string,"invoice_date":"YYYY-MM-DD","firm":string|null,
 "items":[{"description":string,"quantity":number,"rate":number,"gst_rate":number}],"notes":string|null}
 - REQUIRED: party_name, items.

If the email is not a financial-entry request, action="none". Resolve relative dates (today/yesterday) against the provided date."""


_TRIAGE_SYS = """You are Pratibha, triaging an email that arrived at MuscleGrid's shared service@ inbox from \
an EXTERNAL sender (MuscleGrid sells batteries, inverters, stabilizers, solar). Decide if it is a genuine \
business matter that needs a HUMAN on the team to follow up — a customer or dealer query, a complaint, an \
order / delivery / service issue, a payment or return question, or a real sales/business request.
It does NOT need an owner if it is automated / no-reply, a newsletter or promotion, spam, a delivery or \
system notification, or pure FYI requiring no action.
Also judge URGENCY. Set "urgent": true ONLY when the matter is genuinely time-sensitive or critical and \
should not wait — e.g. an angry or escalating customer, a complaint, a payment or refund dispute, an order \
not delivered well past its promised date, a product failure causing downtime or a safety hazard, a legal / \
consumer-court notice, or the sender explicitly says urgent / asap / immediately / emergency. Routine \
questions, normal new orders, general enquiries, pricing or info requests and ordinary follow-ups are \
"urgent": false.
Respond with ONLY compact JSON:
{"needs_owner": true|false, "urgent": true|false, "category":"complaint|order|service|payment|sales|dealer|other",
 "summary":"one or two line plain summary of what the sender wants"}"""


async def triage_inbound(subject: str, body: str, sender: str) -> dict:
    """Classify an untriggered external email: does it need a human owner, and what's it about?"""
    client = _client_or_none()
    if client is None:
        return {"needs_owner": False, "model_ok": False}
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=200, system=_sys(_TRIAGE_SYS),
            messages=[{"role": "user", "content": f"From: {sender}\nSubject: {subject or ''}\n\n{(body or '')[:4000]}"}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        j = json.loads(m.group(0)) if m else {}
        return {"needs_owner": bool(j.get("needs_owner")), "urgent": bool(j.get("urgent")),
                "category": j.get("category", "other"), "summary": j.get("summary", ""), "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha triage_inbound failed: {e}")
        return {"needs_owner": False, "model_ok": False}


_SHIP_SYS = """The FOUNDER is asking Pratibha to BOOK A COURIER SHIPMENT. Extract the shipment details from \
the email AND any attached document (an Amazon/marketplace INVOICE, tax invoice, shipping label, or photo). \
Read carefully and precisely — this books a real paid courier.
If an INVOICE is attached, extract EVERYTHING from it: the buyer/ship-to name, full address, phone, the \
product/description, the declared value/total amount, AND the ORDER ID / Order Number (e.g. an Amazon order id \
like 403-1234567-1234567, or a store order number like 2011). The order id is CRITICAL — always capture it.
Respond with ONLY compact JSON:
{"is_shipment": true|false, "confidence": 0.0-1.0,
 "params": {"order_id":"","first_name":"","last_name":"","phone":"","alt_phone":"","email":"",
   "address_line1":"","address_line2":"","city":"","state":"","pincode":"",
   "product_name":"","quantity":1,"invoice_amount":0,"payment_type":"Prepaid|COD","cod_amount":0,
   "shipment_type":"b2c|b2b","is_reverse_pickup":false},
 "missing": ["field", ...]}
- is_reverse_pickup = true ONLY if the email asks to PICK UP / COLLECT / arrange a return pickup of the
  product FROM the customer (reverse logistics). Then the address you extract is the CUSTOMER's pickup
  address (where the courier collects), payment_type is "Prepaid", and cod_amount 0. Otherwise false (a normal outbound shipment TO the customer).
- order_id = the order id / order number / marketplace order id for this shipment (from the email or the invoice).
- quantity = the NUMBER OF UNITS being shipped — READ it from the invoice/order ("Qty: 4", "Quantity 4", "4 x ..."). \
This is CRITICAL for weight & cost. Only default to 1 if no quantity is shown at all.
- payment_type "COD" = cash on delivery; cod_amount = ₹ to collect (0 for Prepaid). "Prepaid" if not stated.
- invoice_amount = declared value of the goods (₹) — read it from the invoice if attached.
- Indian address: full street into address_line1/2, plus city, state, and a 6-digit pincode.
- shipment_type "b2c" unless clearly a bulk/business (b2b) consignment.
- If the email is NOT a request to book a shipment, set is_shipment=false.
REQUIRED: order_id, first_name, phone, address_line1, city, state, pincode (6 digits), product_name, invoice_amount.
List any REQUIRED field you cannot find in "missing"."""


async def extract_shipment(subject: str, body: str, images=None, today: str = None) -> dict:
    """Vision-capable extraction of a courier-booking request from the founder's email."""
    client = _client_or_none()
    if client is None:
        return {"is_shipment": False, "model_ok": False}
    content = _attachment_blocks(images)
    content.append({"type": "text", "text": f"Email from the founder.\nSubject: {subject or ''}\n\n{(body or '')[:5000]}"})
    try:
        resp = await client.messages.create(
            model=model_reply(), max_tokens=900, system=_sys(_SHIP_SYS), messages=[{"role": "user", "content": content}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        j = json.loads(m.group(0)) if m else {}
        return {"is_shipment": bool(j.get("is_shipment")), "confidence": j.get("confidence"),
                "params": j.get("params") or {}, "missing": j.get("missing") or [], "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha extract_shipment failed: {e}")
        return {"is_shipment": False, "model_ok": False}


async def extract_financial(subject: str, body: str, images=None, today: str = None) -> dict:
    """Vision-capable extraction of a payment / purchase / sales-invoice entry from the
    founder's email + attached screenshots. Returns action + params; fail-safe to none."""
    client = _client_or_none()
    if client is None:
        return {"action": "none", "model_ok": False}
    content = _attachment_blocks(images)
    hint = f"(Today is {today}.) " if today else ""
    content.append({"type": "text",
                    "text": f"{hint}Email from the founder.\nSubject: {subject or ''}\n\n{(body or '')[:5000]}"})
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=900, system=_sys(_FIN_SYS), messages=[{"role": "user", "content": content}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        j = json.loads(m.group(0)) if m else {}
        act = j.get("action") if j.get("action") in ("payment", "purchase", "sales_invoice", "none") else "none"
        return {"action": act, "confidence": j.get("confidence"), "params": j.get("params") or {},
                "missing": j.get("missing") or [], "summary": j.get("summary") or "", "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha extract_financial failed: {e}")
        return {"action": "none", "model_ok": False}


async def extract_action(subject: str, body: str) -> dict:
    client = _client_or_none()
    if client is None:
        return {"action": "other", "params": {}, "model_ok": False}
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=300, system=_sys(_ACTION_SYS),
            messages=[{"role": "user", "content": f"SUBJECT: {subject or ''}\nMESSAGE:\n{(body or '')[:5000]}"}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        p = json.loads(m.group(0)) if m else {}
        action = p.get("action") if p.get("action") in _ACTIONS else "other"
        params = p.get("params") if isinstance(p.get("params"), dict) else {}
        return {"action": action, "params": params, "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha extract_action failed: {e}")
        return {"action": "other", "params": {}, "model_ok": False}


# --------------------------------------------------------------------------- #
# Learning: distill a lesson from a human's correction, and mine FAQs from     #
# email history. Both use the cheap model (haiku) — these run in bulk/often.   #
# --------------------------------------------------------------------------- #
_LESSON_SYS = """A human edited Pratibha's drafted customer-support reply before sending it. From the DIFFERENCE \
between her draft and the human's final version, extract ONE concise, GENERAL lesson she should apply next time \
(not specific to this one customer) — e.g. a missing step, a tone fix, a fact she got wrong, info she should always \
include. Also give 2-5 lowercase keywords/topics it applies to.
Respond ONLY JSON: {"lesson":"...", "keywords":["..."], "skip": true|false}
Set skip=true if the change was trivial (typo, whitespace, greeting only) with no real lesson."""


async def extract_lesson(category: str, original: str, corrected: str) -> dict:
    client = _client_or_none()
    if client is None:
        return {"skip": True, "model_ok": False}
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=250, system=_sys(_LESSON_SYS),
            messages=[{"role": "user", "content": f"Category: {category}\n\n--- Pratibha's draft ---\n"
                       f"{(original or '')[:3000]}\n\n--- Human's final version ---\n{(corrected or '')[:3000]}"}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        j = json.loads(m.group(0)) if m else {}
        return {"lesson": (j.get("lesson") or "").strip(), "keywords": [str(k).lower() for k in (j.get("keywords") or [])],
                "skip": bool(j.get("skip")), "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha extract_lesson failed: {e}")
        return {"skip": True, "model_ok": False}


_FAQ_SYS = """You are mining MuscleGrid's support email history to teach its email assistant. From the customer \
emails (and any team replies) below, extract recurring FAQ entries — common questions and the canonical answer the \
team gives. Ignore one-offs, spam, and automated mail. Keep answers GENERIC with no customer PII (no names, phones, \
emails, order numbers).
Respond ONLY JSON: {"faqs":[{"question":"...","answer":"...","keywords":["..."],
"category":"complaint|order|service|payment|sales|dealer|product|other"}], "style":"one short note on the team's tone/format, if evident"}
Return {"faqs":[]} if nothing reusable."""


async def extract_faqs(batch_text: str) -> dict:
    client = _client_or_none()
    if client is None:
        return {"faqs": [], "model_ok": False}
    try:
        resp = await client.messages.create(
            model=model(), max_tokens=1500, system=_sys(_FAQ_SYS),
            messages=[{"role": "user", "content": batch_text[:18000]}])
        m = re.search(r"\{.*\}", _text(resp), re.S)
        j = json.loads(m.group(0)) if m else {}
        return {"faqs": j.get("faqs") or [], "style": (j.get("style") or "").strip(), "model_ok": True}
    except Exception as e:
        logger.error(f"Pratibha extract_faqs failed: {e}")
        return {"faqs": [], "model_ok": False}

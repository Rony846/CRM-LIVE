"""Ms Marvel — the support-operations SUPERVISOR.

She does not answer customers (that's Kalpana/Pratibha). She watches WHETHER support is
actually happening on time, across channels, and escalates to the founder what is *newly
slipping or actively stalling* — deliberately NOT the chronic backlog (hundreds of old
breached tickets the founder already knows about). Value = catch the new slip, not re-dump
the backlog.

Design:
- Detection is deterministic (timestamps vs thresholds) → ~free. A brain (Jasmine local /
  Opus paid API) is only used to phrase the digest; never the Claude Code subscription terminal.
- Recency-windowed: only items created within RECENT_DAYS are candidates (legacy backlog is
  summarised as a single line, not itemised).
- Flag-once with re-escalation: db.ms_marvel_flags records what was already raised; an item is
  re-raised only if it's STILL stuck after RE_ESCALATE_HOURS. So after the first digest the
  founder only hears about genuinely new slippage.

Off unless MS_MARVEL_ENABLED. Autonomous actions (nudging owners, Opus-assisted fixes) are
gated separately by MS_MARVEL_AUTONOMOUS and are Phase 2 — v1 detects + flags the founder.
"""
import os
import re
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

TERMINAL = {"closed", "resolved", "repair_completed", "delivered", "resolved_on_call",
            "collected", "cancelled", "reship_completed", "closed_by_agent"}
# Statuses where a customer is actively waiting mid-pipeline — a stall here is actionable.
IN_FLIGHT = {"awaiting_label", "label_uploaded", "pickup_scheduled", "in_repair",
             "ready_for_dispatch", "reverse_pickup", "spare_dispatch", "received_at_factory",
             "hardware_service"}

RECENT_DAYS = int(os.environ.get("MS_MARVEL_RECENT_DAYS", "21"))
STALL_HOURS = int(os.environ.get("MS_MARVEL_STALL_HOURS", "48"))
ESCAL_QUIET_HOURS = int(os.environ.get("MS_MARVEL_ESCAL_QUIET_HOURS", "24"))
RP_STUCK_DAYS = int(os.environ.get("MS_MARVEL_RP_STUCK_DAYS", "4"))
WA_RESP_MIN = int(os.environ.get("MS_MARVEL_WA_RESP_MIN", "45"))
RE_ESCALATE_HOURS = int(os.environ.get("MS_MARVEL_RE_ESCALATE_HOURS", "72"))
MAX_DIGEST = int(os.environ.get("MS_MARVEL_MAX_DIGEST", "12"))
MAX_ACTIONS = int(os.environ.get("MS_MARVEL_MAX_ACTIONS", "30"))   # cap actions/run (throttle the backlog)


def enabled() -> bool:
    return (os.environ.get("MS_MARVEL_ENABLED", "0") or "").lower() in ("1", "true", "yes", "on")


def autonomous() -> bool:
    return (os.environ.get("MS_MARVEL_AUTONOMOUS", "0") or "").lower() in ("1", "true", "yes", "on")


def _hours_since(iso: str, now: datetime) -> float:
    try:
        return (now - datetime.fromisoformat(str(iso))).total_seconds() / 3600
    except Exception:
        return 0.0


_OID_RE = re.compile(r"\b\d{3}-\d{7}-\d{7}\b")   # Amazon order id
_AWB_RE = re.compile(r"\b\d{11,14}\b")            # Delhivery/Bigship AWB
_INTERNAL_NAMES = {"test", "app reviewer", "demo", "apple review", "appreviewer"}


def _is_internal(t: dict) -> bool:
    """Test / app-review / internal accounts — noise; keep them out of the support watch."""
    em = (t.get("customer_email") or "").lower()
    nm = (t.get("customer_name") or "").strip().lower()
    return ("musclegrid.in" in em) or ("appreview" in em) or (nm in _INTERNAL_NAMES)


def _embedded_ids(t: dict):
    """Pull an Amazon order-id / AWB the customer pasted into the complaint text — lets us link a
    ticket whose contact phone matches no order (the dominant data-gap)."""
    blob = " ".join(str(t.get(k) or "") for k in ("issue_description", "agent_notes", "diagnosis"))
    oid = _OID_RE.search(blob)
    awb = _AWB_RE.search(blob)
    return (oid.group(0) if oid else None, awb.group(0) if awb else None)


def _t(t: dict, kind: str, age_h: float, priority: int) -> dict:
    oid, awb = _embedded_ids(t)
    return {"kind": kind, "ref": t.get("ticket_number") or t.get("id"),
            "status": t.get("status"), "customer": (t.get("customer_name") or "")[:24],
            "product": (t.get("product_name") or t.get("device_type") or "")[:30],
            "phone": re.sub(r"\D", "", str(t.get("customer_phone") or ""))[-10:],
            "email": t.get("customer_email") or "", "oid": oid, "awb": awb,
            "age_h": round(age_h), "priority": priority,
            "owner": t.get("assigned_to_name") or ("UNASSIGNED" if not t.get("assigned_to") else ""),
            "owner_id": t.get("assigned_to")}


def _diagnose(item: dict, enr: dict, cstat: str) -> str:
    """Deterministic 'why is this likely stuck' from the enriched context."""
    st = (item.get("status") or "").lower()
    sig = (enr.get("signals") or "").lower()
    cstat = (cstat or "").lower()
    if item.get("kind") == "reverse_pickup_stuck":
        return "reverse pickup booked but not arrived — chase courier"
    if "refund" in sig:
        return "refund already issued — likely closeable"
    if "a-to-z" in sig:
        return "has an A-to-z claim — defend/resolve"
    if cstat and "deliver" in cstat and st in ("escalated_to_supervisor", "customer_escalated",
                                               "hardware_service", "in_progress", "received_at_factory"):
        return "delivered then faulty — repair/reverse-pickup not started"
    if cstat and "deliver" not in cstat and any(k in cstat for k in ("transit", "pick", "manifest", "not")):
        return f"shipment stuck ({enr.get('_cstat_raw') or cstat}) — chase courier"
    if enr.get("source") == "unknown source" and not cstat:
        return "no order on file — ask customer for order no./invoice (likely offline/direct sale)"
    return "awaiting owner action"


async def enrich(db, item: dict) -> dict:
    """Build a per-item dossier from EXISTING data (free, stored — no live API): purchase source,
    courier/Bigship status, customer signals (refunds/A-to-z/emails), and a likely 'why stuck'.
    Called only on the itemised items in the digest, so it stays fast."""
    ph = item.get("phone") or (item.get("ref") if item.get("kind") == "wa_unanswered" else "")
    ph = re.sub(r"\D", "", str(ph or ""))[-10:]
    email = item.get("email") or ""
    oid, awb = item.get("oid"), item.get("awb")
    out = {}
    rx = ph + "$" if len(ph) == 10 else None

    # --- purchase source: phone → embedded order-id → sales/shopify by phone ---
    ao = None
    if rx:
        ao = await db.amazon_orders.find_one(
            {"$or": [{"phone": {"$regex": rx}}, {"phone_manual": {"$regex": rx}}]},
            {"_id": 0, "amazon_order_id": 1, "firm_name": 1, "order_status": 1})
    if not ao and oid:   # customer pasted their Amazon order id in the complaint
        ao = await db.amazon_orders.find_one({"amazon_order_id": oid},
                                             {"_id": 0, "amazon_order_id": 1, "firm_name": 1, "order_status": 1})
    if ao:
        out["source"] = f"Amazon · {ao.get('firm_name') or '?'} · {ao.get('amazon_order_id')} ({ao.get('order_status') or '?'})"
    elif rx and (so := await db.sales_orders.find_one({"phone": {"$regex": rx}}, {"_id": 0, "order_number": 1})):
        out["source"] = f"Direct/Sales · {so.get('order_number')}"
    elif rx and (sh := await db.shopify_orders.find_one(
            {"$or": [{"phone": {"$regex": rx}}, {"customer_phone": {"$regex": rx}}]},
            {"_id": 0, "order_number": 1, "name": 1})):
        out["source"] = f"Shopify · {sh.get('name') or sh.get('order_number')}"
    else:
        out["source"] = "unknown source"

    # --- courier: phone → embedded AWB ---
    cs = None
    if rx:
        cs = await db.courier_shipments.find_one({"phone": {"$regex": rx}},
                                                 {"_id": 0, "awb_number": 1, "status": 1, "courier_name": 1},
                                                 sort=[("created_at", -1)])
    if not cs and awb:
        cs = await db.courier_shipments.find_one({"awb_number": awb},
                                                 {"_id": 0, "awb_number": 1, "status": 1, "courier_name": 1})
    cstat = ""
    if cs:
        cstat = str(cs.get("status") or "")
        out["courier"] = f"{cstat or '?'} ({cs.get('courier_name') or 'courier'}) AWB {cs.get('awb_number')}"
    if not ph and not oid and not awb:
        out["why"] = _diagnose(item, out, "")
        return out
    sig = []
    rf = await db.amazon_refunds.count_documents({"phone": ph})
    az = await db.az_claims.count_documents({"phone": ph})
    if rf:
        sig.append(f"{rf} refund")
    if az:
        sig.append(f"{az} A-to-z")
    if email:
        em = await db.email_agent_inbox.count_documents({"sender": {"$regex": re.escape(email), "$options": "i"}})
        if em:
            sig.append(f"{em} email")
    if sig:
        out["signals"] = " · ".join(sig)
    out["why"] = _diagnose(item, out, cstat)
    return out


async def scan(db) -> dict:
    """Return categorised, recency-windowed, actionable slippage + a chronic-backlog summary."""
    now = datetime.now(timezone.utc)
    recent = (now - timedelta(days=RECENT_DAYS)).isoformat()
    stall_cut = (now - timedelta(hours=STALL_HOURS)).isoformat()
    quiet_cut = (now - timedelta(hours=ESCAL_QUIET_HOURS)).isoformat()
    items = []

    # 1. Customer ESCALATED but gone quiet — highest priority (customer actively complained).
    async for t in db.tickets.find(
            {"status": {"$in": ["customer_escalated", "escalated_to_supervisor"]},
             "created_at": {"$gt": recent}, "updated_at": {"$lt": quiet_cut}},
            {"_id": 0}).limit(200):
        if _is_internal(t):
            continue
        items.append(_t(t, "escalated_quiet", _hours_since(t.get("updated_at"), now), 1))

    # 2. In-flight (pickup/repair/dispatch) STALLED on a recent ticket — the founder's core ask.
    async for t in db.tickets.find(
            {"status": {"$in": list(IN_FLIGHT)}, "created_at": {"$gt": recent},
             "updated_at": {"$lt": stall_cut}}, {"_id": 0}).limit(200):
        if _is_internal(t):
            continue
        items.append(_t(t, "inflight_stalled", _hours_since(t.get("updated_at"), now), 2))

    # 3. Freshly SLA-breached in the last STALL_HOURS (the new slips, not the chronic pile).
    async for t in db.tickets.find(
            {"status": {"$nin": list(TERMINAL)}, "created_at": {"$gt": recent},
             "sla_due": {"$gt": stall_cut, "$lt": now.isoformat()}}, {"_id": 0}).limit(200):
        if _is_internal(t):
            continue
        items.append(_t(t, "sla_breached", _hours_since(t.get("sla_due"), now), 3))

    # 4. Reverse pickups booked but not arrived at Meerut.
    rp_cut = (now - timedelta(days=RP_STUCK_DAYS)).isoformat()
    async for p in db.repair_pickups.find(
            {"status": "booked", "created_at": {"$lt": rp_cut}}, {"_id": 0}).limit(100):
        items.append({"kind": "reverse_pickup_stuck", "ref": p.get("ticket_number") or p.get("awb"),
                      "status": "booked", "customer": (p.get("customer_name") or "")[:24],
                      "product": ((p.get("address") or {}).get("product_name") or "")[:30],
                      "phone": re.sub(r"\D", "", str(p.get("customer_phone") or ""))[-10:],
                      "age_h": round(_hours_since(p.get("created_at"), now)), "priority": 2, "owner": ""})

    # 5. WhatsApp: customer's latest message is inbound, unanswered past WA_RESP_MIN (business hrs ~IST 9-21).
    ist_hr = (now + timedelta(hours=5, minutes=30)).hour
    if 9 <= ist_hr < 21:
        since = (now - timedelta(hours=8)).isoformat()
        latest = {}
        async for m in db.whatsapp_cloud_messages.find(
                {"received_at": {"$gt": since}}, {"_id": 0, "phone": 1, "direction": 1, "received_at": 1}) \
                .sort("received_at", 1):
            latest[m.get("phone")] = m
        for ph, m in latest.items():
            if m.get("direction") == "incoming" and _hours_since(m.get("received_at"), now) * 60 >= WA_RESP_MIN:
                items.append({"kind": "wa_unanswered", "ref": ph, "status": "unanswered",
                              "customer": ph, "product": "", "owner": "",
                              "age_h": round(_hours_since(m.get("received_at"), now), 1), "priority": 1})

    # Chronic backlog summary (counts only — never itemised).
    active = {"status": {"$nin": list(TERMINAL)}}
    chronic = {
        "active": await db.tickets.count_documents(active),
        "sla_breached": await db.tickets.count_documents({**active, "sla_breached": True}),
        "unassigned": await db.tickets.count_documents({**active, "assigned_to": {"$in": [None]}}),
        "open_az": await db.az_claims.count_documents({"status": {"$nin": ["granted", "denied", "closed"]}}),
    }
    return {"items": items, "chronic": chronic, "scanned_at": now.isoformat()}


def _decide_action(item: dict, enr: dict):
    """Route a stuck item to a MONEY-GATED action + a recommended next step. Ms Marvel only ever
    notifies/posts — she never books, refunds, replaces or cancels. Anything that costs money or
    needs a real decision is escalated to the founder, not done."""
    why = (enr.get("why") or "").lower()
    has_owner = bool(item.get("owner_id")) and item.get("owner") != "UNASSIGNED"
    if item["kind"] == "reverse_pickup_stuck" or "chase courier" in why:
        return "chase_courier", "Shipment/pickup stalled — chase the courier (NOT-PICKED)."
    if "refund already issued" in why:
        return ("nudge_owner" if has_owner else "escalate"), "Refund already issued — verify & CLOSE this ticket."
    if "a-to-z" in why:
        return "escalate", "Open A-to-z — confirm Refund-Defense is contesting it."
    if "delivered then faulty" in why:
        return ("nudge_owner" if has_owner else "escalate"), "Delivered then faulty — book reverse pickup / decide repair-vs-replace."
    if "no order on file" in why:
        return ("nudge_owner" if has_owner else "escalate"), "Ask the customer for their order no./invoice to link & proceed."
    if item["kind"] == "wa_unanswered":
        return "escalate", "Customer waiting on WhatsApp — ensure a reply goes out."
    return ("nudge_owner" if has_owner else "escalate"), "No movement — action this or update the customer."


def _dossier(it: dict, enr: dict) -> str:
    bits = []
    if enr.get("source"):
        bits.append(enr["source"])
    if enr.get("courier"):
        bits.append("courier: " + enr["courier"])
    if enr.get("signals"):
        bits.append(enr["signals"])
    return " · ".join(bits)


async def _nudge_owner(notify_fn, chat_fn, it: dict, enr: dict, rec: str):
    """Internal, reliable nudge to the ticket's owner: an in-app notification + a tagged post in the
    support channel — with the dossier + recommended next step. No customer/courier money action."""
    age = f"{it['age_h']}h" if it["age_h"] < 72 else f"{round(it['age_h']/24)}d"
    msg = f"{rec}\n{it['ref']} · {it.get('customer') or ''} ({it.get('product') or ''}) · stuck {age}\n{_dossier(it, enr)}".strip()
    if notify_fn and it.get("owner_id"):
        try:
            await notify_fn(title=f"Ms Marvel: action {it['ref']}", message=msg, notification_type="support",
                            link="/admin", target_user_ids=[it["owner_id"]], priority="high",
                            created_by_name="Ms Marvel")
        except Exception as e:
            logger.warning(f"Ms Marvel nudge notify failed: {e}")
    if chat_fn:
        try:
            await chat_fn("service", f"🦸‍♀️ *{it.get('owner') or 'owner'}* — *{it['ref']}* "
                          f"({it.get('customer') or ''}): {enr.get('why')}. → {rec}", {"ref": it["ref"]})
        except Exception as e:
            logger.warning(f"Ms Marvel nudge chat failed: {e}")


async def _chase_courier(chat_fn, it: dict, enr: dict, rec: str):
    """Flag a stalled shipment/pickup to the support+dispatch channel to be chased. Free/reversible."""
    if chat_fn:
        try:
            await chat_fn("service", f"🦸‍♀️ *Courier chase* — *{it['ref']}* ({it.get('customer') or ''}): "
                          f"{enr.get('courier') or 'shipment stalled'}. {rec}", {"ref": it["ref"]})
        except Exception as e:
            logger.warning(f"Ms Marvel courier-chase post failed: {e}")


async def run(db, alert_fn, notify_fn=None, chat_fn=None, brain_phrase=None) -> dict:
    """Scan → process items not already flagged (re-escalate after RE_ESCALATE_HOURS). In AUTONOMOUS
    mode (autonomous() + notify_fn + chat_fn) Ms Marvel MONEY-GATED-ACTS: nudges the owner / chases the
    courier herself and escalates to the founder ONLY what needs him (unassigned, money/decision, A-to-z,
    WhatsApp), with a summary of what she handled. Otherwise she just flags the founder a digest of
    everything (Step 1). Money/refund/replace/PCB are NEVER auto-done — only notified/escalated."""
    now = datetime.now(timezone.utc)
    res = await scan(db)
    re_cut = (now - timedelta(hours=RE_ESCALATE_HOURS)).isoformat()
    auto = autonomous() and notify_fn is not None and chat_fn is not None
    c = res["chronic"]
    LABEL = {"escalated_quiet": "⚠️ ESCALATED, no movement", "inflight_stalled": "🔧 stuck in pipeline",
             "sla_breached": "⏰ just breached SLA", "reverse_pickup_stuck": "🔄 pickup not arrived",
             "wa_unanswered": "💬 customer waiting on WhatsApp"}

    cand = []
    for it in res["items"]:
        key = f"{it['kind']}:{it['ref']}"
        prev = await db.ms_marvel_flags.find_one({"key": key})
        if prev and prev.get("last_flagged", "") > re_cut:
            continue
        cand.append((key, it))
    if not cand:
        logger.info("Ms Marvel: nothing newly slipping")
        return {"flagged": 0, "handled": {}, "chronic": c}
    cand.sort(key=lambda ki: (ki[1]["priority"], -ki[1]["age_h"]))

    async def _flag(key, it, action="", rec=""):
        await db.ms_marvel_flags.update_one({"key": key}, {"$set": {
            "key": key, "kind": it["kind"], "ref": it["ref"], "owner": it.get("owner"),
            "action": action, "rec": rec, "last_flagged": now.isoformat()},
            "$setOnInsert": {"first_flagged": now.isoformat()}, "$inc": {"count": 1}}, upsert=True)

    def _line(it, enr, rec=""):
        age = f"{it['age_h']}h" if it["age_h"] < 72 else f"{round(it['age_h']/24)}d"
        who = f" · {it['owner']}" if it.get("owner") else ""
        head = (f"• {LABEL.get(it['kind'], it['kind'])}: {it['ref']} "
                f"({it.get('customer') or '?'}{(' · ' + it['product']) if it.get('product') else ''}) — {age}{who}")
        ctx = [x for x in (f"src: {enr['source']}" if enr.get("source") else None,
                           f"courier: {enr['courier']}" if enr.get("courier") else None,
                           enr.get("signals")) if x]
        detail = (("\n    " + " · ".join(ctx)) if ctx else "") + \
                 (f"\n    ↳ likely: {enr['why']}" if enr.get("why") else "") + (f"\n    → {rec}" if rec else "")
        return head + detail

    if not auto:
        # ---- Step 1: digest EVERYTHING to the founder (no actions) ----
        fresh = [it for _, it in cand]
        for key, it in cand:
            await _flag(key, it)
        by_kind = {}
        for it in fresh:
            by_kind[it["kind"]] = by_kind.get(it["kind"], 0) + 1
        summ = " · ".join(f"{n} {LABEL.get(k, k).split(' ', 1)[-1]}" for k, n in sorted(by_kind.items(), key=lambda kv: -kv[1]))
        lines = []
        for it in fresh[:MAX_DIGEST]:
            try:
                enr = await enrich(db, it)
            except Exception:
                enr = {}
            lines.append(_line(it, enr))
        body = (f"🦸‍♀️ *Ms Marvel — support watch*\n{len(fresh)} item(s) need attention: {summ}.\n\nMost urgent:\n"
                + "\n".join(lines) + (f"\n…+{len(fresh) - MAX_DIGEST} more in these categories" if len(fresh) > MAX_DIGEST else "")
                + f"\n\nChronic backlog (separate cleanup): {c['active']} active · {c['sla_breached']} breached · "
                f"{c['unassigned']} unassigned · {c['open_az']} open A-to-z\n→ /admin")
        if brain_phrase:
            try:
                body = (await brain_phrase(body)) or body
            except Exception:
                pass
        await alert_fn(body)
        logger.info(f"Ms Marvel: flagged {len(fresh)} items (flag-only)")
        return {"flagged": len(fresh), "handled": {}, "chronic": c}

    # ---- Step 2: AUTONOMOUS — act on up to MAX_ACTIONS, escalate only what needs the founder ----
    handled = {"nudge_owner": 0, "chase_courier": 0}
    escalations = []
    for key, it in cand[:MAX_ACTIONS]:
        try:
            enr = await enrich(db, it)
        except Exception:
            enr = {}
        action, rec = _decide_action(it, enr)
        if action == "nudge_owner" and it.get("owner_id"):
            await _nudge_owner(notify_fn, chat_fn, it, enr, rec)
            handled["nudge_owner"] += 1
        elif action == "chase_courier":
            await _chase_courier(chat_fn, it, enr, rec)
            handled["chase_courier"] += 1
        else:
            escalations.append((it, enr, rec))
        await _flag(key, it, action, rec)
    remaining = max(0, len(cand) - MAX_ACTIONS)
    esc_lines = [_line(it, enr, rec) for it, enr, rec in escalations[:MAX_DIGEST]]
    handled_str = ", ".join(f"{v} {k.replace('_', ' ')}" for k, v in handled.items() if v) or "nothing auto-actionable"
    body = (f"🦸‍♀️ *Ms Marvel — support watch (autonomous)*\nI handled: {handled_str}.\n"
            + (f"\n*Needs YOU* ({len(escalations)}):\n" + "\n".join(esc_lines) if escalations else "\nNothing needs your decision right now.")
            + (f"\n…+{len(escalations) - MAX_DIGEST} more for you" if len(escalations) > MAX_DIGEST else "")
            + (f"\n\n({remaining} more queued for next run)" if remaining else "")
            + f"\n\nChronic backlog: {c['active']} active · {c['sla_breached']} breached · "
            f"{c['unassigned']} unassigned · {c['open_az']} open A-to-z\n→ /admin")
    if brain_phrase:
        try:
            body = (await brain_phrase(body)) or body
        except Exception:
            pass
    await alert_fn(body)
    logger.info(f"Ms Marvel autonomous: handled={handled} escalated={len(escalations)} remaining={remaining}")
    return {"handled": handled, "escalated": len(escalations), "remaining": remaining, "chronic": c}

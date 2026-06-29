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


def enabled() -> bool:
    return (os.environ.get("MS_MARVEL_ENABLED", "0") or "").lower() in ("1", "true", "yes", "on")


def autonomous() -> bool:
    return (os.environ.get("MS_MARVEL_AUTONOMOUS", "0") or "").lower() in ("1", "true", "yes", "on")


def _hours_since(iso: str, now: datetime) -> float:
    try:
        return (now - datetime.fromisoformat(str(iso))).total_seconds() / 3600
    except Exception:
        return 0.0


def _t(t: dict, kind: str, age_h: float, priority: int) -> dict:
    return {"kind": kind, "ref": t.get("ticket_number") or t.get("id"),
            "status": t.get("status"), "customer": (t.get("customer_name") or "")[:24],
            "product": (t.get("product_name") or t.get("device_type") or "")[:30],
            "age_h": round(age_h), "priority": priority,
            "owner": t.get("assigned_to_name") or ("UNASSIGNED" if not t.get("assigned_to") else "")}


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
        items.append(_t(t, "escalated_quiet", _hours_since(t.get("updated_at"), now), 1))

    # 2. In-flight (pickup/repair/dispatch) STALLED on a recent ticket — the founder's core ask.
    async for t in db.tickets.find(
            {"status": {"$in": list(IN_FLIGHT)}, "created_at": {"$gt": recent},
             "updated_at": {"$lt": stall_cut}}, {"_id": 0}).limit(200):
        items.append(_t(t, "inflight_stalled", _hours_since(t.get("updated_at"), now), 2))

    # 3. Freshly SLA-breached in the last STALL_HOURS (the new slips, not the chronic pile).
    async for t in db.tickets.find(
            {"status": {"$nin": list(TERMINAL)}, "created_at": {"$gt": recent},
             "sla_due": {"$gt": stall_cut, "$lt": now.isoformat()}}, {"_id": 0}).limit(200):
        items.append(_t(t, "sla_breached", _hours_since(t.get("sla_due"), now), 3))

    # 4. Reverse pickups booked but not arrived at Meerut.
    rp_cut = (now - timedelta(days=RP_STUCK_DAYS)).isoformat()
    async for p in db.repair_pickups.find(
            {"status": "booked", "created_at": {"$lt": rp_cut}}, {"_id": 0}).limit(100):
        items.append({"kind": "reverse_pickup_stuck", "ref": p.get("ticket_number") or p.get("awb"),
                      "status": "booked", "customer": (p.get("customer_name") or "")[:24],
                      "product": ((p.get("address") or {}).get("product_name") or "")[:30],
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


async def run(db, alert_fn, brain_phrase=None) -> dict:
    """Scan → keep only items NOT already flagged (or due for re-escalation) → flag the founder a
    prioritised digest → record flags. `alert_fn(text)` delivers to the founder. `brain_phrase` is an
    optional async (text)->text to polish the digest via a local/paid brain (never the subscription)."""
    now = datetime.now(timezone.utc)
    res = await scan(db)
    re_cut = (now - timedelta(hours=RE_ESCALATE_HOURS)).isoformat()
    fresh = []
    for it in res["items"]:
        key = f"{it['kind']}:{it['ref']}"
        prev = await db.ms_marvel_flags.find_one({"key": key})
        if prev and prev.get("last_flagged", "") > re_cut:
            continue  # already raised recently
        fresh.append(it)
        await db.ms_marvel_flags.update_one({"key": key}, {"$set": {
            "key": key, "kind": it["kind"], "ref": it["ref"], "last_flagged": now.isoformat()},
            "$setOnInsert": {"first_flagged": now.isoformat()}, "$inc": {"count": 1}}, upsert=True)
    if not fresh:
        logger.info("Ms Marvel: nothing newly slipping")
        return {"flagged": 0, "chronic": res["chronic"]}

    fresh.sort(key=lambda x: (x["priority"], -x["age_h"]))
    LABEL = {"escalated_quiet": "⚠️ ESCALATED, no movement", "inflight_stalled": "🔧 stuck in pipeline",
             "sla_breached": "⏰ just breached SLA", "reverse_pickup_stuck": "🔄 pickup not arrived",
             "wa_unanswered": "💬 customer waiting on WhatsApp"}
    # Per-category counts (so a big set reads as a report, not a 200-line dump).
    by_kind = {}
    for it in fresh:
        by_kind[it["kind"]] = by_kind.get(it["kind"], 0) + 1
    summary = " · ".join(f"{n} {LABEL.get(k, k).split(' ', 1)[-1]}" for k, n in
                         sorted(by_kind.items(), key=lambda kv: -kv[1]))
    # Itemise only the most urgent few.
    lines = []
    for it in fresh[:MAX_DIGEST]:
        age = f"{it['age_h']}h" if it["age_h"] < 72 else f"{round(it['age_h']/24)}d"
        who = f" · {it['owner']}" if it.get("owner") else ""
        lines.append(f"• {LABEL.get(it['kind'], it['kind'])}: {it['ref']} "
                     f"({it.get('customer') or '?'}{(' · ' + it['product']) if it.get('product') else ''}) "
                     f"— {age}{who}")
    c = res["chronic"]
    body = (f"🦸‍♀️ *Ms Marvel — support watch*\n{len(fresh)} item(s) need attention: {summary}.\n"
            f"\nMost urgent:\n" + "\n".join(lines)
            + (f"\n…+{len(fresh) - MAX_DIGEST} more in these categories" if len(fresh) > MAX_DIGEST else "")
            + f"\n\nChronic backlog (separate cleanup): {c['active']} active · {c['sla_breached']} breached · "
            f"{c['unassigned']} unassigned · {c['open_az']} open A-to-z\n→ /admin")
    if brain_phrase:
        try:
            body = (await brain_phrase(body)) or body
        except Exception:
            pass
    await alert_fn(body)
    logger.info(f"Ms Marvel: flagged {len(fresh)} newly-slipping items")
    return {"flagged": len(fresh), "chronic": res["chronic"], "items": fresh[:MAX_DIGEST]}

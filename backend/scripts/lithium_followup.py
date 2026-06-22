#!/usr/bin/env python3
"""Follow-up engine for the lithium-complaints escalation (db.lithium_escalation).

Run hourly by cron. Each run:
  • Re-checks which tracked tickets are still unresolved.
  • All resolved  -> sends Angad+founder a closing 'thank you' note; marks campaign resolved.
  • Before deadline, still-open -> nudges Angad (rate-limited ~6h) with count + time left.
  • Deadline passed, still-open & not yet escalated -> ESCALATES to founder (CC Angad).
  • After escalation -> keeps a 6-hourly combined nudge until all resolved (capped).

Idempotent + self-rate-limited; safe to run as often as hourly.
"""
import sys
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from dotenv import dotenv_values

sys.path.insert(0, "/var/www/crm/backend")
sys.path.insert(0, "/var/www/crm/backend/scripts")
from _lithium_fb import collect_negative_feedback
ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
NOW = datetime.now(timezone.utc)
IST = timezone(timedelta(hours=5, minutes=30))
DONE = {"closed", "resolved", "resolved_on_call"}
FOLLOWUP_GAP_H = 5.5     # min hours between Angad nudges
MAX_FOLLOWUPS = 16       # safety cap


def unresolved(tickets):
    if not tickets:
        return []
    out = []
    for tn in tickets:
        t = db.tickets.find_one({"ticket_number": tn}, {"_id": 0, "status": 1, "customer_name": 1})
        if t and t.get("status") not in DONE:
            out.append((tn, t.get("status"), t.get("customer_name")))
    return out


def send(to, subj, html, cc=None):
    from zoho_email_service import zoho_mail
    r = zoho_mail.send_email(to_address=to, subject=subj, content=html, cc_address=cc)
    print(f"  email -> {to} cc={cc}: {'OK' if r.get('success') else 'FAIL ' + str(r.get('error'))}")
    return r.get("success")


def tbl(rows):
    trs = "".join(f"<tr><td style='padding:3px 8px'>{i}</td><td style='padding:3px 8px'>{tn}</td>"
                  f"<td style='padding:3px 8px'>{st}</td><td style='padding:3px 8px'>{nm or ''}</td></tr>"
                  for i, (tn, st, nm) in enumerate(rows, 1))
    return (f"<table style='border-collapse:collapse;font-size:13px'><tr style='background:#f2f2f2'>"
            f"<th style='padding:4px 8px'>#</th><th style='padding:4px 8px'>Ticket</th>"
            f"<th style='padding:4px 8px'>Status</th><th style='padding:4px 8px'>Customer</th></tr>{trs}</table>")


def fb_block(items):
    """HTML for newly-arrived negative feedback (since last nudge)."""
    if not items:
        return ""
    rows = "".join(
        f"<tr><td style='padding:3px 8px'>{i}</td>"
        f"<td style='padding:3px 8px'>{(f.get('name') or '')} ({f.get('id')}) · {f.get('channel')}</td>"
        f"<td style='padding:3px 8px'>“{(f.get('text') or '')}”</td></tr>"
        for i, f in enumerate(items, 1))
    return (f"<h3 style='margin:16px 0 6px'>New negative feedback since my last message ({len(items)})</h3>"
            f"<table style='border-collapse:collapse;font-size:13px;width:100%'><tr style='background:#f2f2f2'>"
            f"<th style='padding:4px 8px'>#</th><th style='padding:4px 8px'>Customer</th>"
            f"<th style='padding:4px 8px'>What they said</th></tr>{rows}</table>")


def pull_new_feedback(camp):
    """Record any NEW negative replies (WhatsApp+email) into the campaign; return the unreported list."""
    fb = camp.get("feedback_replies", []) or []
    # migrate legacy items (initial email batch) → keyed + reported
    for it in fb:
        if "key" not in it:
            it["key"] = f"whatsapp:{it.get('phone')}"
            it["channel"] = it.get("channel", "whatsapp")
            it["id"] = it.get("id", it.get("phone"))
            it["reported"] = True
    seen = {it["key"] for it in fb}
    for c in collect_negative_feedback(db, camp["created_at"]):
        if c["key"] not in seen:
            c["reported"] = False
            fb.append(c)
            seen.add(c["key"])
    db.lithium_escalation.update_one({"id": camp["id"]},
        {"$set": {"feedback_replies": fb, "feedback_count": len(fb)}})
    return fb, [it for it in fb if not it.get("reported")]


def mark_reported(camp, fb):
    for it in fb:
        it["reported"] = True
    db.lithium_escalation.update_one({"id": camp["id"]}, {"$set": {"feedback_replies": fb}})


for camp in db.lithium_escalation.find({"status": {"$in": ["active", "escalated"]}}):
    angad, founder = camp["to"], camp["cc"]
    deadline = datetime.fromisoformat(camp["deadline"])
    dstr = deadline.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")
    open_rows = unresolved(camp.get("ticket_numbers", []))
    all_fb, new_fb = pull_new_feedback(camp)   # record new negatives every run
    last = datetime.fromisoformat(camp.get("last_followup_at"))
    since_h = (NOW - last).total_seconds() / 3600
    fc = camp.get("followup_count", 0)
    if new_fb:
        print(f"campaign {camp['id']}: {len(new_fb)} new negative feedback reply(ies) recorded")

    # 1) all resolved AND no pending feedback -> close out
    if not open_rows and not new_fb:
        send(angad, "✅ Lithium complaints — all resolved, thank you",
             f"<p>Angad,</p><p>All {camp.get('initial_count')} lithium complaints from my list are now marked "
             f"resolved/closed in the CRM. Thank you for clearing them.</p><p>— MuscleGrid Service Desk</p>",
             cc=founder)
        db.lithium_escalation.update_one({"id": camp["id"]},
            {"$set": {"status": "resolved", "resolved_at": NOW.isoformat()}})
        print(f"campaign {camp['id']}: RESOLVED")
        continue

    # 2) deadline passed & still open & not escalated -> escalate to founder
    if NOW >= deadline and open_rows and not camp.get("escalated"):
        send(founder, f"🚨 ESCALATION: {len(open_rows)} lithium complaints unresolved past 24h deadline",
             f"<p>Pawan,</p><p>The 24-hour deadline ({dstr}) has passed and <b>{len(open_rows)} of "
             f"{camp.get('initial_count')}</b> lithium complaints assigned to Angad are still unresolved. "
             f"Escalating to you as promised.</p>{tbl(open_rows)}{fb_block(new_fb)}<p>— MuscleGrid Service Desk</p>", cc=angad)
        mark_reported(camp, all_fb)
        db.lithium_escalation.update_one({"id": camp["id"]},
            {"$set": {"status": "escalated", "escalated": True, "escalated_at": NOW.isoformat(),
                      "last_followup_at": NOW.isoformat()}, "$inc": {"followup_count": 1}})
        print(f"campaign {camp['id']}: ESCALATED ({len(open_rows)} open, {len(new_fb)} new feedback)")
        continue

    # 3) periodic nudge (rate-limited, capped) — fires for open tickets and/or new feedback
    if (open_rows or new_fb) and since_h >= FOLLOWUP_GAP_H and fc < MAX_FOLLOWUPS:
        if NOW < deadline:
            left = (deadline - NOW).total_seconds() / 3600
            send(angad, f"⏰ Reminder: {len(open_rows)} lithium complaints + {len(new_fb)} new feedback — {left:.0f}h to deadline",
                 f"<p>Angad,</p><p><b>{len(open_rows)} of {camp.get('initial_count')}</b> lithium complaints are "
                 f"still unresolved. <b>{left:.0f} hours left</b> before the {dstr} deadline — after which I escalate "
                 f"to Pawan. Please clear these:</p>{tbl(open_rows)}{fb_block(new_fb)}<p>— MuscleGrid Service Desk</p>", cc=founder)
        else:  # already escalated, keep combined nudge
            send(angad, f"🚨 Still open: {len(open_rows)} lithium complaints + {len(new_fb)} new feedback (escalated to Pawan)",
                 f"<p>Angad,</p><p>These {len(open_rows)} lithium complaints remain unresolved and are now escalated "
                 f"to Pawan. Please resolve urgently:</p>{tbl(open_rows)}{fb_block(new_fb)}<p>— MuscleGrid Service Desk</p>", cc=founder)
        mark_reported(camp, all_fb)
        db.lithium_escalation.update_one({"id": camp["id"]},
            {"$set": {"last_followup_at": NOW.isoformat()}, "$inc": {"followup_count": 1}})
        print(f"campaign {camp['id']}: NUDGE #{fc + 1} ({len(open_rows)} open, {len(new_fb)} new feedback)")
    else:
        print(f"campaign {camp['id']}: no action ({len(open_rows)} open, {len(new_fb)} unreported fb, {since_h:.1f}h since last, fc={fc})")

#!/usr/bin/env python3
"""Compile all UNRESOLVED lithium-battery complaints and email them to Angad (lithium@musclegrid.in),
CC the founder (founder@musclegrid.in), with a hard 24-hour resolve-or-escalate deadline.

Also records a tracking doc in db.lithium_escalation so the follow-up job (lithium_followup.py)
can chase Angad and escalate to the founder at the deadline.

Usage:
  venv/bin/python scripts/lithium_complaints_email.py            # preview (no send)
  venv/bin/python scripts/lithium_complaints_email.py --send     # send + create tracking doc
"""
import sys, re, uuid
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from dotenv import dotenv_values

sys.path.insert(0, "/var/www/crm/backend")
ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
SEND = "--send" in sys.argv
NOW = datetime.now(timezone.utc)
ANGAD = "lithium@musclegrid.in"
FOUNDER = "founder@musclegrid.in"
LITH = re.compile(r"lithium|lifepo|lfp|\bbms\b|li-ion|li ion", re.I)
DONE = {"closed", "resolved", "resolved_on_call"}
FOUNDER_PHONE = "9560377363"   # exclude the founder's own test ticket


def age_days(s):
    try:
        return (NOW - datetime.fromisoformat(str(s))).days
    except Exception:
        return None


def collect():
    rows = []
    for d in db.tickets.find({}, {"_id": 0}):
        blob = " ".join(str(d.get(k) or "") for k in ("product_name", "device_type", "issue_description", "master_sku_name"))
        if not LITH.search(blob):
            continue
        if d.get("status") in DONE:
            continue
        if re.sub(r"\D", "", str(d.get("customer_phone") or ""))[-10:] == FOUNDER_PHONE:
            continue
        rows.append(d)
    # SLA-breached first, then oldest first
    rows.sort(key=lambda x: (not x.get("sla_breached"), str(x.get("created_at"))))
    return rows


def safety_cases():
    out = []
    for d in db.repair_decisions.find({"status": {"$ne": "resolved"}}, {"_id": 0}):
        blob = " ".join(str(d.get(k) or "") for k in ("product", "summary"))
        if LITH.search(blob) and re.search(r"smoke|fire|burn|swell|explod|safety", blob, re.I):
            out.append(d)
    return out


NEG = re.compile(r"not good|not work|nahi kar|nhi kar|kharab|kharap|scrap|dead|"
                 r"backup nahi|backup kam|backup bahut kam|sahi nahi|no backup|buri|bura|"
                 r"useless|complain|cheat|chuna|not charg|charge nahi|display nahi|display not|"
                 r"refund|defective|current ch|unattached|behtar banao|badhi buri|problem|issue|"
                 r"error|tahlate|nahi de|nahi mil|6 manth|technician.*visit|visit.*technician|"
                 r"not respond|not holding|0 amp|fault", re.I)
HARD_NEG = re.compile(r"not good|not work|nahi kar|nhi kar|kharab|kharap|scrap|dead|backup nahi|"
                      r"backup kam|backup bahut kam|sahi nahi|no backup|buri|useless|cheat|chuna|"
                      r"not charg|charge nahi|display nahi|display not|refund|defective|tahlate|"
                      r"6 manth|badhi buri|behtar banao|not respond|not holding", re.I)
STRONG_POS = re.compile(r"working (fine|well)|no problem|without any problem|everything is working|"
                        r"sab (theek|sahi)|badhiya chal|bahut accha", re.I)
JUNK = re.compile(r"^\s*(ok|han|yes|ji teek|ji theek|nahi|ab|🙏|👍|thanks|\[image\]|none)\s*$", re.I)


def to_dt(ts):
    try:
        return datetime.fromisoformat(ts)
    except Exception:
        try:
            return datetime.fromtimestamp(int(float(ts)), tz=timezone.utc)
        except Exception:
            return None


def collect_feedback():
    """Group today's WhatsApp replies from the feedback cohort by phone, classify negative."""
    wa_sent, name_by = {}, {}
    for w in db.warranties.find({"feedback_wa_sent_at": {"$exists": True}},
                                {"phone": 1, "first_name": 1, "last_name": 1}):
        p = re.sub(r"\D", "", str(w.get("phone") or ""))[-10:]
        if p:
            wa_sent[p] = True
            name_by[p] = (str(w.get("first_name") or "") + " " + str(w.get("last_name") or "")).strip()
    cut = datetime(2026, 6, 18, 11, 0, tzinfo=timezone.utc)  # campaign window
    by_phone = {}
    for m in db.whatsapp_cloud_messages.find({"direction": "incoming"}).sort("ts", -1).limit(600):
        p = re.sub(r"\D", "", str(m.get("phone") or ""))[-10:]
        dt = to_dt(m.get("ts"))
        if p not in wa_sent or not dt or dt < cut:
            continue
        t = str(m.get("text") or "").strip()
        if not t or t.lower() == "none" or t.startswith("[image") or "acrobat.adobe" in t or "Sale Invoice" in t:
            continue
        by_phone.setdefault(p, []).append(t)
    out = []
    for p, msgs in by_phone.items():
        msgs = list(reversed(msgs))  # chronological
        blob = " | ".join(m for m in msgs if not JUNK.match(m))
        if not blob.strip():
            continue
        # strong-positive (and no hard complaint) → genuinely happy, skip
        if STRONG_POS.search(blob) and not HARD_NEG.search(blob):
            continue
        neg = bool(HARD_NEG.search(blob)) or bool(NEG.search(blob))
        if neg:
            out.append({"phone": p, "name": name_by.get(p) or "", "text": blob[:300], "sentiment": "negative"})
    return out


rows = collect()
safety = safety_cases()
feedback = collect_feedback()
ids = [r.get("ticket_number") for r in rows]

# ---- build email ----
def esc(s): return (str(s or "")).replace("<", "&lt;").replace(">", "&gt;")

trs = []
for i, d in enumerate(rows, 1):
    sla = "🔴 BREACHED" if d.get("sla_breached") else "—"
    trs.append(
        f"<tr style='border-bottom:1px solid #eee'>"
        f"<td style='padding:4px 8px'>{i}</td>"
        f"<td style='padding:4px 8px;white-space:nowrap'>{esc(d.get('ticket_number'))}</td>"
        f"<td style='padding:4px 8px'>{esc(d.get('customer_name'))}<br><small>{esc(d.get('customer_phone'))}</small></td>"
        f"<td style='padding:4px 8px;text-align:center'>{age_days(d.get('created_at'))}d</td>"
        f"<td style='padding:4px 8px;text-align:center'>{sla}</td>"
        f"<td style='padding:4px 8px'>{esc(d.get('status'))}</td>"
        f"<td style='padding:4px 8px'>{esc(str(d.get('issue_description') or '')[:160])}</td></tr>")

safety_html = ""
if safety:
    items = "".join(f"<li><b>{esc(s.get('customer_name'))}</b> — {esc(str(s.get('summary'))[:180])}</li>" for s in safety)
    safety_html = (f"<div style='background:#fff3f3;border:1px solid #f5b5b5;padding:10px 14px;margin:14px 0'>"
                   f"<b>⚠️ SAFETY — handle FIRST:</b><ul style='margin:6px 0'>{items}</ul></div>")

fb_html = ""
if feedback:
    fitems = "".join(
        f"<tr style='border-bottom:1px solid #eee'>"
        f"<td style='padding:4px 8px'>{i}</td>"
        f"<td style='padding:4px 8px'>{esc(f.get('name'))}<br><small>{esc(f.get('phone'))}</small></td>"
        f"<td style='padding:4px 8px'>“{esc(f.get('text'))}”</td></tr>"
        for i, f in enumerate(feedback, 1))
    fb_html = (
        f"<h3 style='margin:18px 0 6px'>Negative customer feedback — from today's feedback drive ({len(feedback)})</h3>"
        f"<p style='margin:0 0 8px'>These customers replied to our WhatsApp feedback message today with complaints "
        f"(some named you directly). Each needs a callback + resolution:</p>"
        f"<table style='border-collapse:collapse;width:100%;font-size:13px'>"
        f"<thead><tr style='background:#f2f2f2;text-align:left'>"
        f"<th style='padding:6px 8px'>#</th><th style='padding:6px 8px'>Customer</th>"
        f"<th style='padding:6px 8px'>What they said</th></tr></thead><tbody>{fitems}</tbody></table>")

deadline = (NOW + timedelta(hours=24)).astimezone(timezone(timedelta(hours=5, minutes=30)))
html = f"""<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.5">
<p>Angad,</p>
<p>Below are <b>all {len(rows)} unresolved lithium-battery complaints</b> currently open in the CRM
(SLA-breached cases listed first), plus <b>{len(feedback)} negative feedback replies</b> received today
from customers we reached out to. Several have been pending for weeks and many have already breached SLA.</p>
{safety_html}
<p><b>Please action and resolve these within 24 hours</b> — update each ticket with the diagnosis/resolution
(or assign a technician + ETA). <b>If these are not resolved within 24 hours (by {deadline:%d %b %Y, %I:%M %p IST}),
I will have to escalate the matter to Pawan.</b></p>
<table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:10px">
<thead><tr style="background:#f2f2f2;text-align:left">
<th style='padding:6px 8px'>#</th><th style='padding:6px 8px'>Ticket</th><th style='padding:6px 8px'>Customer</th>
<th style='padding:6px 8px'>Age</th><th style='padding:6px 8px'>SLA</th><th style='padding:6px 8px'>Status</th>
<th style='padding:6px 8px'>Issue</th></tr></thead>
<tbody>{''.join(trs)}</tbody></table>
{fb_html}
<p style="margin-top:14px">Reply to this email with progress. I'll follow up.</p>
<p>— MuscleGrid Service Desk (on behalf of Pawan)</p>
</div>"""

subject = (f"[ACTION 24h] {len(rows)} unresolved Lithium battery complaints + {len(feedback)} negative "
           f"feedback replies — resolve or escalation to Pawan")

print(f"Unresolved lithium tickets: {len(rows)} | safety: {len(safety)} | negative feedback replies: {len(feedback)}")
for f in feedback:
    print(f"  FB {f['phone']} {f['name'][:18]:18} — {f['text'][:90]}")
print(f"To: {ANGAD}  CC: {FOUNDER}")
print(f"Subject: {subject}")
print(f"Deadline: {deadline:%d %b %Y %I:%M %p IST}")
if not SEND:
    print("\nFirst 10 tickets:")
    for d in rows[:10]:
        print(f"  {d.get('ticket_number')} | {d.get('status')} | {age_days(d.get('created_at'))}d | {d.get('customer_name')}")
    print("\nPREVIEW ONLY — re-run with --send.")
    sys.exit(0)

from zoho_email_service import zoho_mail
r = zoho_mail.send_email(to_address=ANGAD, subject=subject, content=html, cc_address=FOUNDER)
print("send ->", "OK " + str(r.get("message_id")) if r.get("success") else "FAIL " + str(r.get("error")))
if r.get("success"):
    db.lithium_escalation.insert_one({
        "id": str(uuid.uuid4()), "created_at": NOW.isoformat(),
        "deadline": (NOW + timedelta(hours=24)).isoformat(),
        "ticket_numbers": ids, "initial_count": len(rows),
        "feedback_replies": feedback, "feedback_count": len(feedback),
        "to": ANGAD, "cc": FOUNDER, "status": "active",
        "last_followup_at": NOW.isoformat(), "followup_count": 0, "escalated": False})
    print(f"tracking doc created (db.lithium_escalation) — {len(ids)} tickets, deadline +24h")

#!/usr/bin/env python3
"""Feedback outreach to lithium-battery customers on BOTH channels:
  • WhatsApp  -> approved `purchase_feedback` template (Hinglish; {{1}}=name {{2}}=product)
  • Email     -> personalised feedback ask + ₹200 cashback for sharing experience (private feedback)

Cohort = lithium warranty registrations (the only lithium customers with real contact on file).
Each channel is independent + idempotent (stamps feedback_wa_sent_at / feedback_email_sent_at),
so a re-run never double-contacts and a partial failure is safe to re-run.

Usage:
  venv/bin/python scripts/lithium_feedback.py                 # dry-run (counts + preview)
  venv/bin/python scripts/lithium_feedback.py --test          # one of EACH to founder (WA 9560377363 / email pawan846)
  venv/bin/python scripts/lithium_feedback.py --send          # send BOTH channels to all eligible
  venv/bin/python scripts/lithium_feedback.py --send --wa-only
  venv/bin/python scripts/lithium_feedback.py --send --email-only
"""
import os, sys, re, asyncio, uuid
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

sys.path.insert(0, "/var/www/crm/backend")
ENV = dotenv_values("/var/www/crm/backend/.env")
for k, v in ENV.items():
    os.environ.setdefault(k, v or "")
from utils import whatsapp_cloud

db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
SEND = "--send" in sys.argv
TEST = "--test" in sys.argv
WA_ONLY = "--wa-only" in sys.argv
EMAIL_ONLY = "--email-only" in sys.argv
DO_WA = not EMAIL_ONLY
DO_EMAIL = not WA_ONLY

LITH = re.compile(r"lithium|lifepo|lfp", re.I)
NOW = datetime.now(timezone.utc).isoformat()
SUPPORT = "service@musclegrid.in"
FOUNDER_WA = "9560377363"
FOUNDER_EMAIL = "pawan846@outlook.com"
WA_TEMPLATE = "purchase_feedback"
BAD_PHONE = {"0000000000", "9999999999", "1111111111", FOUNDER_WA}
SUBJECT = "How's your MuscleGrid Lithium Battery performing? (₹200 cashback inside)"


def email_body(first, product):
    name = (first or "there").title()
    return f"""<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.6;max-width:560px">
<p>Namaste {name},</p>
<p>Thank you for choosing your <b>MuscleGrid {product}</b>. As a registered owner, your honest
experience matters a lot to us.</p>
<p>Could you share a quick note on how your battery is performing — what's working well, and
anything we could do better?</p>
<p><b>As a thank-you, share your experience (a short note or a photo of your setup) and we'll
send you ₹200 cashback.</b></p>
<p>Just reply to this email, or WhatsApp/contact us at <a href="mailto:{SUPPORT}">{SUPPORT}</a>.</p>
<p>Warm regards,<br/>Team MuscleGrid</p>
</div>"""


def norm_phone(p):
    d = re.sub(r"\D", "", str(p or ""))[-10:]
    return d if len(d) == 10 and d[0] in "6789" and d not in BAD_PHONE else ""


# Build cohort from lithium warranties; dedup so one customer isn't hit twice per channel.
seen_em, seen_ph, rows = set(), set(), []
optout_em = "email_optouts" in db.list_collection_names()
optout_ph = "whatsapp_optouts" in db.list_collection_names()
for w in db.warranties.find({}, {"_id": 0}):
    if not LITH.search(" ".join(str(w.get(k) or "") for k in ("product_name", "device_type"))):
        continue
    product = w.get("product_name") or "Lithium Battery"
    first = w.get("first_name") or ""
    em = (w.get("email") or "").strip().lower()
    ph = norm_phone(w.get("phone"))
    # email eligibility
    use_em = bool(em and "@" in em and not em.endswith("@musclegrid.in")
                  and em not in seen_em and not w.get("feedback_email_sent_at")
                  and not (optout_em and db.email_optouts.count_documents({"email": em})))
    # whatsapp eligibility
    use_ph = bool(ph and ph not in seen_ph and not w.get("feedback_wa_sent_at")
                  and not (optout_ph and db.whatsapp_optouts.count_documents({"phone": ph})))
    if not (use_em or use_ph):
        continue
    if use_em:
        seen_em.add(em)
    if use_ph:
        seen_ph.add(ph)
    rows.append({"id": w["id"], "first": first, "product": product,
                 "email": em if use_em else "", "phone": ph if use_ph else ""})

n_em = sum(1 for r in rows if r["email"])
n_ph = sum(1 for r in rows if r["phone"])
print(f"Lithium feedback cohort: {len(rows)} customers | WhatsApp-eligible: {n_ph} | email-eligible: {n_em}")
print(f"Channels this run: WhatsApp={DO_WA} Email={DO_EMAIL} | template={WA_TEMPLATE}\n")


async def send_wa(phone, first, product):
    comps = [{"type": "body", "parameters": [
        {"type": "text", "text": (first or "ji")[:60]},
        {"type": "text", "text": str(product)[:60]}]}]
    return await whatsapp_cloud.send_template(phone, template=WA_TEMPLATE, components=comps)


async def main():
    from zoho_email_service import zoho_mail

    if TEST:
        if DO_WA:
            r = await send_wa(FOUNDER_WA, "Pawan", "Lithium Battery")
            print(f"WA  test -> {FOUNDER_WA}: {'OK '+r['wamid'] if r.get('wamid') else 'FAIL '+str(r.get('response'))}")
        if DO_EMAIL:
            r = zoho_mail.send_email(to_address=FOUNDER_EMAIL, subject="[TEST] " + SUBJECT,
                                     content=email_body("Pawan", "Thunder Pro 24V LiFePO4 Battery"))
            print(f"Email test -> {FOUNDER_EMAIL}: {'OK' if r.get('success') else 'FAIL '+str(r.get('error'))}")
        return

    if not SEND:
        print("PREVIEW (dry-run) — sample:")
        for r in rows[:8]:
            ch = ("WA " if r["phone"] else "   ") + ("EM" if r["email"] else "  ")
            print(f"  [{ch}] {r['first'][:14]:14} {(r['email'] or '+91-XXXXXX'+r['phone'][-4:]):32} {r['product'][:30]}")
        print("\nRe-run with --test (one each to founder) or --send (all).")
        return

    wa_ok = em_ok = 0
    for r in rows:
        if DO_WA and r["phone"]:
            res = await send_wa(r["phone"], r["first"], r["product"])
            if res.get("wamid"):
                wa_ok += 1
                db.warranties.update_one({"id": r["id"]}, {"$set": {"feedback_wa_sent_at": NOW}})
                db.whatsapp_cloud_messages.insert_one({
                    "id": str(uuid.uuid4()), "direction": "outgoing", "phone": r["phone"],
                    "text": f"[{WA_TEMPLATE} template — lithium feedback]", "msg_type": "template",
                    "wamid": res["wamid"], "ts": NOW, "received_at": NOW,
                    "source": "whatsapp_cloud", "kind": "lithium_feedback"})
            print(f"  WA  +91-XXXXXX{r['phone'][-4:]}: {'OK' if res.get('wamid') else 'FAIL '+str(res.get('response'))}")
            await asyncio.sleep(0.4)
        if DO_EMAIL and r["email"]:
            res = zoho_mail.send_email(to_address=r["email"], subject=SUBJECT,
                                       content=email_body(r["first"], r["product"]))
            if res.get("success"):
                em_ok += 1
                db.warranties.update_one({"id": r["id"]}, {"$set": {"feedback_email_sent_at": NOW}})
            print(f"  EM  {r['email']}: {'OK' if res.get('success') else 'FAIL '+str(res.get('error'))}")
            await asyncio.sleep(0.3)
    print(f"\nDone. WhatsApp: {wa_ok}/{n_ph}  |  Email: {em_ok}/{n_em}")


asyncio.run(main())

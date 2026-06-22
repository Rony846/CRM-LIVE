#!/usr/bin/env python3
"""Review drive for the lithium feedback campaign:
  • Keeps running stats of how many customers were SENT feedback (WhatsApp + email).
  • Finds HAPPY repliers (sentiment-gated) and warmly convinces them to leave a Google review
    (NO incentive — incentivised public reviews breach Google policy; cashback stays private-only).
  • Detects review CONFIRMATIONS ("done / ho gaya / posted") and counts how many have given.
  • Prints a report: sent / positive / review-link-sent / reviews-confirmed.

Idempotent: one review-ask per customer (warranties.review_link_sent). Stats in db.review_campaign.
Usage: review_push.py            # preview + report (no send)
       review_push.py --send     # send review asks to new happy repliers, update stats, report
"""
import os, sys, re, uuid, asyncio
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

sys.path.insert(0, "/var/www/crm/backend")
sys.path.insert(0, "/var/www/crm/backend/scripts")
ENV = dotenv_values("/var/www/crm/backend/.env")
for k, v in ENV.items():
    os.environ.setdefault(k, v or "")
from _lithium_fb import STRONG_POS, HARD_NEG, _to_dt
from utils import whatsapp_cloud

db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
SEND = "--send" in sys.argv
NOW = datetime.now(timezone.utc)
CAMPAIGN = "lithium_2026_06"
LINK = os.environ.get("GOOGLE_REVIEW_LINK", "https://g.page/r/CY0W_g0eEX53EBM/review").strip()
CONFIRM = re.compile(r"\bdone\b|ho gaya|kar diya|kar di|de diya|de di|posted|post kar|review (de|dal|likh)|"
                     r"diya hai|✅|⭐|star|google.*(de|kar)", re.I)
WINDOW = datetime(2026, 6, 18, 11, 0, tzinfo=timezone.utc)   # campaign start

# ---------- cohort + name maps ----------
wa, name_by = {}, {}
for w in db.warranties.find({"feedback_wa_sent_at": {"$exists": True}},
                            {"phone": 1, "first_name": 1, "review_link_sent": 1, "review_link_at": 1, "review_given": 1}):
    p = re.sub(r"\D", "", str(w.get("phone") or ""))[-10:]
    if p:
        wa[p] = w
        name_by[p] = w.get("first_name") or ""

# ---------- group incoming replies by phone ----------
byp = {}
for m in db.whatsapp_cloud_messages.find({"direction": "incoming"}).sort("ts", -1).limit(1000):
    p = re.sub(r"\D", "", str(m.get("phone") or ""))[-10:]
    dt = _to_dt(m.get("ts"))
    if p not in wa or not dt or dt < WINDOW:
        continue
    t = str(m.get("text") or "").strip()
    if not t or t.lower() == "none" or t.startswith("[image"):
        continue
    byp.setdefault(p, []).append((dt, t))

# ---------- classify happy + detect confirmations ----------
happy_new, happy_total, confirmed = [], 0, 0
for p, msgs in byp.items():
    msgs.sort()
    blob = " | ".join(t for _, t in msgs)
    is_happy = bool(STRONG_POS.search(blob)) and not HARD_NEG.search(blob)
    if not is_happy:
        continue
    happy_total += 1
    rec = wa[p]
    # confirmation: any confirm-keyword message AFTER the review link was sent
    rl_at = _to_dt(rec.get("review_link_at")) if rec.get("review_link_sent") else None
    if rec.get("review_link_sent") and not rec.get("review_given"):
        for dt, t in msgs:
            if rl_at and dt > rl_at and CONFIRM.search(t):
                db.warranties.update_one({"phone": rec.get("phone")}, {"$set": {"review_given": True, "review_given_at": NOW.isoformat()}})
                rec["review_given"] = True
                break
    if rec.get("review_given"):
        confirmed += 1
    if not rec.get("review_link_sent"):
        happy_new.append(p)


async def push():
    sent = 0
    for p in happy_new:
        name = (name_by.get(p) or "ji").split(" ")[0]
        msg = (f"Bahut khushi hui {name} ji ki aapko apni MuscleGrid lithium battery pasand aa rahi hai! 🙏\n\n"
               f"Agar aap sirf 1 minute nikaal kar apna experience Google par ⭐ review ke roop mein share kar dein, "
               f"to humein bahut badi help milegi aur naye customers ko sahi choice karne mein aasani hogi:\n{LINK}\n\n"
               f"Review post karne ke baad yahin '*done*' likh dijiyega. Dil se dhanyavaad! — Team MuscleGrid")
        res = await whatsapp_cloud.send_text(p, msg)
        if res.get("wamid"):
            sent += 1
            db.warranties.update_one({"phone": wa[p].get("phone")},
                {"$set": {"review_link_sent": True, "review_link_at": NOW.isoformat()}})
            db.whatsapp_cloud_messages.insert_one({
                "id": str(uuid.uuid4()), "direction": "outgoing", "phone": p, "text": msg,
                "msg_type": "text", "wamid": res["wamid"], "ts": NOW.isoformat(),
                "received_at": NOW.isoformat(), "source": "whatsapp_cloud", "kind": "review_link"})
        print(f"  review-ask {p} {name}: {'OK' if res.get('wamid') else 'FAIL ' + str(res.get('response'))}")
        await asyncio.sleep(0.4)
    return sent


wa_sent = db.warranties.count_documents({"feedback_wa_sent_at": {"$exists": True}})
em_sent = db.warranties.count_documents({"feedback_email_sent_at": {"$exists": True}})
link_sent_before = db.warranties.count_documents({"review_link_sent": {"$exists": True}})

pushed = 0
if SEND and happy_new:
    pushed = asyncio.run(push())

link_sent = db.warranties.count_documents({"review_link_sent": {"$exists": True}})
given = db.warranties.count_documents({"review_given": True})

# persist stats
db.review_campaign.update_one({"campaign": CAMPAIGN}, {"$set": {
    "campaign": CAMPAIGN, "updated_at": NOW.isoformat(),
    "wa_sent": wa_sent, "email_sent": em_sent,
    "happy_repliers": happy_total, "review_links_sent": link_sent, "reviews_given": given}}, upsert=True)

print("\n================ REVIEW DRIVE REPORT ================")
print(f"  Feedback SENT:        {wa_sent} WhatsApp + {em_sent} email")
print(f"  Happy repliers:       {happy_total}")
print(f"  Review asks sent:     {link_sent}" + (f"  (+{pushed} just now)" if pushed else ""))
print(f"  New happy (unasked):  {len(happy_new) - pushed}")
print(f"  REVIEWS GIVEN (confirmed): {given}")
if not SEND and happy_new:
    print(f"\n  {len(happy_new)} happy customer(s) ready for a review ask — run with --send.")

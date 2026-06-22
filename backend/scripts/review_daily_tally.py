#!/usr/bin/env python3
"""Daily WhatsApp tally to the founder: review-drive numbers (sent / happy / asks / reviews given)
plus a one-line lithium-complaint status. Sent via the bridge to the founder. Run once daily by cron.

Usage: review_daily_tally.py            # send the tally now
       review_daily_tally.py --dry      # print only, don't send
"""
import sys, json, urllib.request
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
DRY = "--dry" in sys.argv
NOW = datetime.now(timezone.utc)
IST = timezone(timedelta(hours=5, minutes=30))
FOUNDER = "919560377363@c.us"
BRIDGE = "http://127.0.0.1:3011/send"
DONE = {"closed", "resolved", "resolved_on_call"}

# --- review drive (authoritative from warranties + stats doc) ---
wa_sent = db.warranties.count_documents({"feedback_wa_sent_at": {"$exists": True}})
em_sent = db.warranties.count_documents({"feedback_email_sent_at": {"$exists": True}})
asks = db.warranties.count_documents({"review_link_sent": {"$exists": True}})
given = db.warranties.count_documents({"review_given": True})
stats = db.review_campaign.find_one({"campaign": "lithium_2026_06"}) or {}
happy = stats.get("happy_repliers", "?")

# --- lithium complaint escalation status ---
comp_line = ""
camp = db.lithium_escalation.find_one({"status": {"$in": ["active", "escalated"]}}, sort=[("created_at", -1)])
if camp:
    open_n = sum(1 for tn in camp.get("ticket_numbers", [])
                 if (db.tickets.find_one({"ticket_number": tn}, {"status": 1}) or {}).get("status") not in DONE)
    fb_n = camp.get("feedback_count", 0)
    tag = " · ⚠️ ESCALATED" if camp.get("escalated") else ""
    comp_line = (f"\n\n🔧 *Lithium complaints (Angad):* {open_n}/{camp.get('initial_count')} still open"
                 f" · {fb_n} negative feedback logged{tag}")

# --- un-shipped order reconciliation (orders with NO shipment booked) ---
ship_line = ""
rec = db.unshipped_recon.find_one({"key": "latest"})
if rec:
    ship_line = (f"\n\n📦 *Un-shipped orders (no shipment booked):* {rec.get('backlog_count', 0)}"
                 f" ({rec.get('aged_count', 0)} aged ≥3d)")

# --- Amazon fulfillment truth (hourly SP-API + Bigship) ---
ft = db.amazon_fulfillment_truth.find_one({"key": "latest"})
if ft:
    c = ft.get("counts", {})
    ship_line += (f"\n\n🚚 *Amazon fulfillment (hourly):* {c.get('shipped', 0)} shipped · "
                  f"{c.get('booked_not_picked', 0)} booked-not-picked · "
                  f"⚠️ {c.get('amazon_shipped_no_record', 0)} 'shipped' with NO record · "
                  f"{c.get('unshipped', 0)} unshipped")

# --- Amazon no-warranty feedback campaign progress ---
af_line = ""
if "amazon_feedback_sent" in db.list_collection_names():
    af = db.amazon_feedback_sent.count_documents({})
    if af:
        af_line = f"\n\n📨 *Amazon feedback WA sent:* {af} (of ~2,638 cohort, 500/day)"

msg = (f"📊 *Daily Tally* — {NOW.astimezone(IST):%d %b %Y}\n\n"
       f"Feedback sent: *{wa_sent}* WhatsApp + *{em_sent}* email\n"
       f"Happy repliers: *{happy}*\n"
       f"Review asks sent: *{asks}*\n"
       f"✅ Reviews given (confirmed): *{given}*"
       f"{comp_line}"
       f"{ship_line}"
       f"{af_line}")

print(msg)
if DRY:
    sys.exit(0)
try:
    r = urllib.request.urlopen(urllib.request.Request(
        BRIDGE, data=json.dumps({"to": FOUNDER, "message": msg}).encode(),
        headers={"Content-Type": "application/json"}), timeout=25)
    print("\nsent ->", r.status, r.read()[:120])
except Exception as e:
    print("\nbridge send error:", e)

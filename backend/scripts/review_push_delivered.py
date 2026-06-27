#!/usr/bin/env python3
"""Google-review push to DELIVERED (happy-path) customers — the broad cohort, distinct
from the lithium-warranty drive (scripts/lithium_feedback.py + scripts/review_push.py).

Two-step gated, reusing the live system: sends the APPROVED `purchase_feedback` template
logged with kind="purchase_feedback", so the live _maybe_feedback_to_review handler
auto-sends the Google review link on a HAPPY reply and routes unhappy ones to support.
No new step-2 needed; no incentive on the public review (Google-policy safe).

Targets customers whose parcel was DELIVERED (courier_shipments), excluding RTO/undelivered/
cancelled, opt-outs, and anyone already asked for feedback on ANY prior drive (incl. the
124 lithium asks and warranties.feedback_wa_sent_at). Paced over days to protect quality.

Subcommands:
  scan      Build the queue (db.review_push_delivered), most-recent-delivered first.
  preview   Print the queued cohort.
  status    Check the template is APPROVED.
  send      Send a batch. DRY-RUN unless --confirm. --limit caps per run (default 125).
  report    Asked / replied / sentiment / review-link-sent.

Usage:
  venv/bin/python scripts/review_push_delivered.py scan [--target 500]
  venv/bin/python scripts/review_push_delivered.py preview
  venv/bin/python scripts/review_push_delivered.py send --limit 125            # dry-run
  venv/bin/python scripts/review_push_delivered.py send --limit 125 --confirm   # real
  venv/bin/python scripts/review_push_delivered.py report [--csv out.csv]

Read-only until `send --confirm`. One message per phone, idempotent, opt-outs honoured.
"""
import argparse
import csv
import re
import sys
import time
import uuid
from datetime import datetime, timezone, timedelta

import httpx
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
TOKEN = (ENV.get("WHATSAPP_CLOUD_TOKEN") or "").strip()
PHONE_ID = (ENV.get("WHATSAPP_PHONE_NUMBER_ID") or "").strip()
WABA = (ENV.get("WHATSAPP_WABA_ID") or "").strip()
API_VER = (ENV.get("WHATSAPP_CLOUD_API_VERSION") or "v21.0").strip()
LANG = (ENV.get("WHATSAPP_TEMPLATE_LANG") or "en").strip() or "en"

TEMPLATE = "review_rating_request"      # {{1}}=first name, {{2}}=product, + 3 star-rating buttons
KIND = "review_rating"                  # what the live _maybe_feedback_to_review looks for
COLL = "review_push_delivered"
CAMPAIGN = "google_review_delivered_2026_06"
WAREHOUSE_PHONES = {"9899716917"}
BAD_RX = re.compile(r"rto|undeliver|cancel|reject", re.I)

db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]


def d10(p):
    x = re.sub(r"\D", "", str(p or ""))[-10:]
    return x if len(x) == 10 and x[0] in "6789" and x != "0000000000" else None


def recency(s):
    return str(s.get("delivered_at") or s.get("updated_at") or s.get("status_updated_at")
               or s.get("created_at") or s.get("booked_at") or "")[:19]


def cmd_scan(args):
    # exclusion sets ---------------------------------------------------------
    bad = set()
    for s in db.courier_shipments.find({"status": {"$regex": "rto|undeliver|cancel|reject", "$options": "i"}},
                                       {"phone": 1}):
        p = d10(s.get("phone"))
        if p:
            bad.add(p)
    for x in db.whatsapp_optouts.find({}, {"phone": 1}):
        p = d10(x.get("phone"))
        if p:
            bad.add(p)
    # already asked on ANY feedback drive (incl lithium) → never double-ask
    asked = set()
    for m in db.whatsapp_cloud_messages.find(
            {"direction": "outgoing",
             "kind": {"$in": ["purchase_feedback", "feedback_request", "review_link", "lithium_feedback"]}},
            {"phone": 1}):
        p = d10(m.get("phone"))
        if p:
            asked.add(p)
    for w in db.warranties.find({"feedback_wa_sent_at": {"$exists": True}}, {"phone": 1}):
        p = d10(w.get("phone"))
        if p:
            asked.add(p)

    # delivered-to-buyer shipments, most recent first ------------------------
    rows = list(db.courier_shipments.find(
        {"status": {"$regex": "deliver", "$options": "i"}},
        {"_id": 0, "amazon_order_id": 1, "order_id": 1, "status": 1, "phone": 1,
         "customer_name": 1, "product_name": 1, "delivered_at": 1, "updated_at": 1,
         "status_updated_at": 1, "created_at": 1, "booked_at": 1}))
    rows = [s for s in rows if not BAD_RX.search(str(s.get("status") or ""))]  # drop "RTO Delivered"/"Undelivered"
    rows.sort(key=recency, reverse=True)

    ids = [s.get("amazon_order_id") or s.get("order_id") for s in rows]
    ao = {a["amazon_order_id"]: a for a in db.amazon_orders.find(
        {"amazon_order_id": {"$in": [i for i in ids if i]}},
        {"amazon_order_id": 1, "customer_name_manual": 1, "buyer_name": 1, "phone_manual": 1, "phone": 1})}

    seen, picked, skip = set(), [], {"bad": 0, "asked": 0, "no_phone": 0, "dup": 0}
    for s in rows:
        if len(picked) >= args.target:
            break
        oid = s.get("amazon_order_id") or s.get("order_id")
        a = ao.get(oid, {})
        ph = d10(s.get("phone")) or d10(a.get("phone_manual")) or d10(a.get("phone"))
        if not ph:
            skip["no_phone"] += 1; continue
        if ph in WAREHOUSE_PHONES or ph in bad:
            skip["bad"] += 1; continue
        if ph in asked:
            skip["asked"] += 1; continue
        if ph in seen:
            skip["dup"] += 1; continue
        seen.add(ph)
        picked.append({
            "phone": ph, "order_id": oid, "delivered": recency(s)[:10],
            "name": a.get("customer_name_manual") or s.get("customer_name") or a.get("buyer_name") or "Customer",
            "product": s.get("product_name") or "MuscleGrid product"})

    now = datetime.now(timezone.utc).isoformat()
    new = 0
    for e in picked:
        if db[COLL].find_one({"phone": e["phone"], "campaign": CAMPAIGN}):
            continue
        db[COLL].insert_one({**e, "campaign": CAMPAIGN, "created_at": now, "status": "pending",
                             "whatsapp_status": None, "sent_at": None, "wamid": None})
        new += 1
    total = db[COLL].count_documents({"campaign": CAMPAIGN})
    print(f"scan: picked {len(picked)} delivered customers (target {args.target}); queued new {new}; queue total {total}")
    print(f"  skipped — failed/optout:{skip['bad']} already-asked:{skip['asked']} "
          f"no-phone:{skip['no_phone']} dup-phone:{skip['dup']}")


def cmd_preview(args):
    q = {"campaign": CAMPAIGN}
    if not args.all:
        q["whatsapp_status"] = None
    rows = list(db[COLL].find(q).sort("created_at", 1))
    print(f"{len(rows)} in queue ({'all' if args.all else 'not yet sent'}):\n")
    print(f"{'#':>3}  {'Phone':<11} {'Name':<22} {'Delivered':<11} Product")
    for i, r in enumerate(rows[:40], 1):
        print(f"{i:>3}  {r['phone']:<11} {str(r.get('name'))[:21]:<22} "
              f"{str(r.get('delivered') or '—'):<11} {str(r.get('product'))[:34]}")
    if len(rows) > 40:
        print(f"  …+{len(rows) - 40} more")


def template_status():
    r = httpx.get(f"https://graph.facebook.com/{API_VER}/{WABA}/message_templates",
                  params={"access_token": TOKEN, "limit": 200, "fields": "name,status,category"}, timeout=30)
    r.raise_for_status()
    for t in r.json().get("data", []):
        if t.get("name") == TEMPLATE:
            return t
    return None


def cmd_status(args):
    t = template_status()
    print(f"template {TEMPLATE}: {t.get('status') if t else 'MISSING'} ({t.get('category') if t else '-'})")


def _send(phone10, first, product):
    payload = {"messaging_product": "whatsapp", "to": "91" + phone10, "type": "template",
               "template": {"name": TEMPLATE, "language": {"code": LANG},
                            "components": [{"type": "body", "parameters": [
                                {"type": "text", "text": first}, {"type": "text", "text": product}]}]}}
    try:
        r = httpx.post(f"https://graph.facebook.com/{API_VER}/{PHONE_ID}/messages",
                       params={"access_token": TOKEN}, json=payload, timeout=25)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code >= 400:
            return False, None, str(data.get("error", data))[:200]
        return True, ((data.get("messages") or [{}])[0]).get("id"), "ok"
    except Exception as e:
        return False, None, str(e)[:200]


SEND_START_HOUR = 9    # IST — never message customers before 9am
SEND_END_HOUR = 20     # IST — or at/after 8pm


def _ist_now():
    return datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)  # IST = UTC+5:30, no DST


def cmd_send(args):
    t = template_status()
    if not t or t.get("status") != "APPROVED":
        print(f"REFUSING — template {TEMPLATE} is {t.get('status') if t else 'MISSING'} (need APPROVED).")
        sys.exit(2)
    ist = _ist_now()
    if args.confirm and not (SEND_START_HOUR <= ist.hour < SEND_END_HOUR):
        print(f"OUTSIDE SEND WINDOW — it is {ist:%H:%M} IST; reviews send only "
              f"{SEND_START_HOUR:02d}:00–{SEND_END_HOUR:02d}:00 IST. No messages sent.")
        sys.exit(3)
    pending = list(db[COLL].find({"campaign": CAMPAIGN, "whatsapp_status": None}).sort("created_at", 1))
    batch = pending[:args.limit] if args.limit else pending
    print(f"template APPROVED. {len(pending)} pending; this batch {len(batch)}"
          + (f" (cap {args.limit})" if args.limit else "") + ".")
    if not args.confirm:
        print("\nDRY-RUN (nothing sent). Re-run with --confirm. Sample:")
        for r in batch[:15]:
            print(f"  {r['phone']}  {str(r.get('name'))[:24]:<24} · {str(r.get('product'))[:30]}")
        if len(batch) > 15:
            print(f"  …+{len(batch) - 15} more in this batch")
        return
    sent, failed = 0, 0
    for r in batch:
        first = (str(r.get("name") or "Customer").strip().split() or ["Customer"])[0][:60]
        product = str(r.get("product") or "MuscleGrid product")[:60]
        ok, wamid, detail = _send(r["phone"], first, product)
        now = datetime.now(timezone.utc).isoformat()
        db[COLL].update_one({"_id": r["_id"]}, {"$set": {
            "whatsapp_status": "sent" if ok else "failed", "sent_at": now,
            "wamid": wamid, "send_detail": detail, "status": "sent" if ok else "send_failed"}})
        if ok:
            db.whatsapp_cloud_messages.insert_one({
                "id": str(uuid.uuid4()), "direction": "outgoing", "phone": r["phone"],
                "text": f"[{TEMPLATE} template — google review drive]", "msg_type": "template",
                "wamid": wamid, "ts": now, "received_at": now, "source": "review_push_delivered",
                "kind": KIND, "review_link_sent": False, "campaign": CAMPAIGN})
            sent += 1
        else:
            failed += 1
            print(f"  FAIL {r['phone']} — {detail}")
        time.sleep(args.pace)
    left = db[COLL].count_documents({"campaign": CAMPAIGN, "whatsapp_status": None})
    print(f"\nbatch done: sent={sent} failed={failed} · still pending={left}")


def cmd_report(args):
    rows = list(db[COLL].find({"campaign": CAMPAIGN}).sort("sent_at", 1))
    out = []
    asked = replied = positive = negative = 0
    for r in rows:
        ws = {"sent": "Sent", "failed": "Failed"}.get(r.get("whatsapp_status"), "Not sent")
        sentiment, link = "", ""
        if r.get("whatsapp_status") == "sent":
            asked += 1
            fb = db.whatsapp_cloud_messages.find_one(
                {"phone": r["phone"], "direction": "outgoing", "kind": KIND, "campaign": CAMPAIGN},
                sort=[("ts", -1)])
            if fb:
                sentiment = fb.get("feedback_sentiment") or ""
                if fb.get("feedback_replied_at"):
                    replied += 1
                if fb.get("review_link_sent"):
                    link = "Yes"; positive += 1
                elif sentiment == "negative":
                    negative += 1
        out.append({"Order ID": r.get("order_id") or "—", "Customer Name": r.get("name"),
                    "Phone Number": r["phone"], "WhatsApp Status": ws,
                    "Sentiment": sentiment, "Review Link Sent": link})
    print("=== GOOGLE REVIEW DRIVE (delivered) REPORT ===")
    print(f"{'Phone':<11} {'Name':<22} {'WA':<9} {'Sentiment':<10} Link")
    for o in out:
        print(f"{o['Phone Number']:<11} {str(o['Customer Name'])[:21]:<22} "
              f"{o['WhatsApp Status']:<9} {o['Sentiment']:<10} {o['Review Link Sent']}")
    print(f"\ntotals: queued={len(out)} asked={asked} replied={replied} "
          f"positive(link sent)={positive} negative={negative}")
    if args.csv and out:
        with open(args.csv, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
            w.writeheader(); w.writerows(out)
        print(f"CSV: {args.csv}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("scan"); s.add_argument("--target", type=int, default=500); s.set_defaults(fn=cmd_scan)
    s = sub.add_parser("preview"); s.add_argument("--all", action="store_true"); s.set_defaults(fn=cmd_preview)
    s = sub.add_parser("status"); s.set_defaults(fn=cmd_status)
    s = sub.add_parser("send"); s.add_argument("--confirm", action="store_true")
    s.add_argument("--limit", type=int, default=125); s.add_argument("--pace", type=float, default=1.2)
    s.set_defaults(fn=cmd_send)
    s = sub.add_parser("report"); s.add_argument("--csv", default=""); s.set_defaults(fn=cmd_report)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""COD re-delivery rescue campaign — for prepaid orders refunded because the
courier could not deliver (RTO / Undelivered).

Reaches each affected customer ONCE on WhatsApp with an approved template offering
to re-dispatch on Cash-on-Delivery, captures their reply, and reports who agreed —
so the founder can review before any reship. It NEVER places an order.

Subcommands:
  scan      Build/refresh the outreach queue (db.cod_redelivery_outreach).
  preview   Print the queued cohort (no sending).
  status    Check whether the Meta template is APPROVED yet.
  send      Send the template to queued customers. DRY-RUN unless --confirm.
            Refuses unless the template is APPROVED.
  report    Match replies and print the founder's report + the COD-accepted list.
            Writes a CSV alongside this run.

Usage:
  venv/bin/python scripts/cod_rescue.py scan [--days 60]
  venv/bin/python scripts/cod_rescue.py preview
  venv/bin/python scripts/cod_rescue.py status
  venv/bin/python scripts/cod_rescue.py send            # dry-run
  venv/bin/python scripts/cod_rescue.py send --confirm   # real send (paced)
  venv/bin/python scripts/cod_rescue.py report [--csv /path/out.csv]

Design: read-only until `send --confirm`. One message per phone (deduped),
opt-outs honoured, idempotent (never re-sends a row already sent).
"""
import argparse
import csv
import re
import sys
import time
from datetime import datetime, timezone, timedelta

import httpx
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
MONGO_URL = ENV.get("MONGO_URL")
DB_NAME = ENV.get("DB_NAME")
TOKEN = (ENV.get("WHATSAPP_CLOUD_TOKEN") or "").strip()
PHONE_ID = (ENV.get("WHATSAPP_PHONE_NUMBER_ID") or "").strip()
WABA = (ENV.get("WHATSAPP_WABA_ID") or "").strip()
API_VER = (ENV.get("WHATSAPP_CLOUD_API_VERSION") or "v21.0").strip()
LANG = (ENV.get("WHATSAPP_TEMPLATE_LANG") or "en").strip() or "en"

TEMPLATE = "cod_redelivery_offer"
COLL = "cod_redelivery_outreach"
CAMPAIGN = "cod_rescue_2026_06"
RTO_RX = re.compile(r"rto|undeliver", re.I)
WAREHOUSE_PHONES = {"9899716917"}  # Meerut return warehouse — not a customer
YES_RX = re.compile(r"\b(yes|yess+|haan|haa+n?| haa|ok|okay|chahiye|chaiye|cod|resend|send it|"
                    r"kar do|kardo|theek|ji haan|y)\b|resend on cod", re.I)
NO_RX = re.compile(r"\b(no|nahi+|nai|mat|cancel|nahin|not interested|no thanks|dont|don't)\b", re.I)

db = MongoClient(MONGO_URL)[DB_NAME]


def digits10(p):
    d = re.sub(r"\D", "", str(p or ""))[-10:]
    return d if len(d) == 10 and d != "0000000000" else None


def rdate(s):
    return str(s.get("created_at") or s.get("booked_at") or s.get("shipped_at") or "")[:10]


def oid_of(s):
    return s.get("amazon_order_id") or s.get("order_id")


# ---------------------------------------------------------------- scan
def cmd_scan(args):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=args.days)).date().isoformat()
    optouts = {digits10(x.get("phone")) for x in db.whatsapp_optouts.find({}, {"phone": 1})}
    optouts.discard(None)

    # gather RTO/undelivered shipments, recent, not already NDR-contacted
    rows = list(db.courier_shipments.find(
        {"status": {"$regex": "rto|undeliver", "$options": "i"}, "ndr_contacted": {"$ne": True}},
        {"_id": 0, "amazon_order_id": 1, "order_id": 1, "status": 1, "phone": 1,
         "customer_name": 1, "product_name": 1, "created_at": 1, "booked_at": 1, "shipped_at": 1}))

    # enrich contact from amazon_orders
    ids = [oid_of(s) for s in rows if oid_of(s)]
    ao = {a["amazon_order_id"]: a for a in db.amazon_orders.find(
        {"amazon_order_id": {"$in": ids}},
        {"amazon_order_id": 1, "phone_manual": 1, "phone": 1, "customer_name_manual": 1,
         "buyer_name": 1, "firm_name": 1})}
    refunded = {x["amazon_order_id"] for x in db.amazon_refunds.find(
        {"amazon_order_id": {"$in": ids}}, {"amazon_order_id": 1})}

    def best_phone(s):
        a = ao.get(oid_of(s), {})
        for c in (s.get("phone"), a.get("phone_manual"), a.get("phone")):
            d = digits10(c)
            if d:
                return d
        return None

    def best_name(s):
        a = ao.get(oid_of(s), {})
        return (a.get("customer_name_manual") or s.get("customer_name")
                or a.get("buyer_name") or "Customer")

    # group by phone (one customer = one message), keep all their orders
    by_phone = {}
    skipped = {"old": 0, "no_phone": 0, "warehouse": 0, "optout": 0}
    for s in rows:
        if rdate(s) < cutoff:
            skipped["old"] += 1
            continue
        ph = best_phone(s)
        if not ph:
            skipped["no_phone"] += 1
            continue
        if ph in WAREHOUSE_PHONES:
            skipped["warehouse"] += 1
            continue
        if ph in optouts:
            skipped["optout"] += 1
            continue
        a = ao.get(oid_of(s), {})
        entry = by_phone.setdefault(ph, {
            "phone": ph, "name": best_name(s), "firm": a.get("firm_name"), "orders": []})
        entry["orders"].append({
            "order_id": oid_of(s), "status": s.get("status"),
            "product": s.get("product_name"), "date": rdate(s),
            "refund_posted": oid_of(s) in refunded})

    # upsert into the queue — never clobber rows already sent
    now = datetime.now(timezone.utc).isoformat()
    new, updated = 0, 0
    for ph, e in by_phone.items():
        existing = db[COLL].find_one({"phone": ph, "campaign": CAMPAIGN})
        doc = {
            "campaign": CAMPAIGN, "phone": ph, "name": e["name"], "firm": e["firm"],
            "orders": e["orders"], "order_id": e["orders"][0]["order_id"],
            "order_count": len(e["orders"]),
            "any_refund_posted": any(o["refund_posted"] for o in e["orders"]),
            "updated_at": now,
        }
        if existing:
            if existing.get("whatsapp_status") in ("sent", "failed"):
                continue  # locked once we've attempted a send
            db[COLL].update_one({"_id": existing["_id"]}, {"$set": doc})
            updated += 1
        else:
            doc.update({"created_at": now, "status": "pending", "whatsapp_status": None,
                        "sent_at": None, "wamid": None, "reply_text": None,
                        "reply_at": None, "cod_accepted": None})
            db[COLL].insert_one(doc)
            new += 1

    total = db[COLL].count_documents({"campaign": CAMPAIGN})
    print(f"scan: {len(by_phone)} distinct customers in window (last {args.days}d)")
    print(f"  queued new: {new} | refreshed pending: {updated} | queue total: {total}")
    print(f"  skipped — stale:{skipped['old']} no-phone:{skipped['no_phone']} "
          f"warehouse:{skipped['warehouse']} opt-out:{skipped['optout']}")


# ---------------------------------------------------------------- preview
def cmd_preview(args):
    q = {"campaign": CAMPAIGN}
    if not args.all:
        q["whatsapp_status"] = {"$in": [None]}
    rows = list(db[COLL].find(q).sort("created_at", 1))
    print(f"{len(rows)} customer(s) in queue ({'all' if args.all else 'not yet sent'}):\n")
    print(f"{'#':>3}  {'Phone':<11} {'Name':<24} {'Orders':<6} {'Refund?':<7} Sample order / status")
    for i, r in enumerate(rows, 1):
        o0 = (r.get("orders") or [{}])[0]
        print(f"{i:>3}  {r['phone']:<11} {str(r.get('name'))[:23]:<24} "
              f"{r.get('order_count', 1):<6} {'yes' if r.get('any_refund_posted') else 'no':<7} "
              f"{str(o0.get('order_id'))[:20]} · {o0.get('status')}")


# ---------------------------------------------------------------- status
def template_status():
    r = httpx.get(f"https://graph.facebook.com/{API_VER}/{WABA}/message_templates",
                  params={"access_token": TOKEN, "limit": 200,
                          "fields": "name,status,category,language"}, timeout=30)
    r.raise_for_status()
    for t in r.json().get("data", []):
        if t.get("name") == TEMPLATE:
            return t
    return None


def cmd_status(args):
    t = template_status()
    if not t:
        print(f"template {TEMPLATE}: NOT FOUND on WABA")
    else:
        print(f"template {TEMPLATE}: status={t.get('status')} category={t.get('category')} lang={t.get('language')}")


# ---------------------------------------------------------------- send
def _send_template(phone10, first_name):
    """Send the approved template to one 10-digit number. Returns (ok, wamid, detail)."""
    to = phone10 if len(re.sub(r"\D", "", phone10)) > 10 else "91" + phone10
    payload = {
        "messaging_product": "whatsapp", "to": to, "type": "template",
        "template": {"name": TEMPLATE, "language": {"code": LANG},
                     "components": [{"type": "body",
                                     "parameters": [{"type": "text", "text": first_name}]}]},
    }
    try:
        r = httpx.post(f"https://graph.facebook.com/{API_VER}/{PHONE_ID}/messages",
                       params={"access_token": TOKEN}, json=payload, timeout=25)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code >= 400:
            return False, None, str(data.get("error", data))[:200]
        wamid = ((data.get("messages") or [{}])[0]).get("id")
        return True, wamid, "ok"
    except Exception as e:
        return False, None, str(e)[:200]


def cmd_send(args):
    t = template_status()
    if not t or t.get("status") != "APPROVED":
        print(f"REFUSING TO SEND — template {TEMPLATE} is "
              f"{t.get('status') if t else 'MISSING'} (need APPROVED).")
        sys.exit(2)

    pending = list(db[COLL].find({"campaign": CAMPAIGN, "whatsapp_status": {"$in": [None]}})
                   .sort("created_at", 1))
    if args.limit:
        pending = pending[:args.limit]
    print(f"template APPROVED. {len(pending)} customer(s) pending"
          + (f" (limited to {args.limit})" if args.limit else "") + ".")

    if not args.confirm:
        print("\nDRY-RUN (no messages sent). Re-run with --confirm to send. Recipients:")
        for r in pending[:50]:
            print(f"  {r['phone']}  {str(r.get('name'))[:28]:<28} ({r.get('order_count',1)} order(s))")
        if len(pending) > 50:
            print(f"  …+{len(pending) - 50} more")
        return

    sent, failed = 0, 0
    now = datetime.now(timezone.utc).isoformat()
    for r in pending:
        first = (str(r.get("name") or "Customer").strip().split() or ["Customer"])[0]
        ok, wamid, detail = _send_template(r["phone"], first)
        db[COLL].update_one({"_id": r["_id"]}, {"$set": {
            "whatsapp_status": "sent" if ok else "failed", "sent_at": now,
            "wamid": wamid, "send_detail": detail, "status": "sent" if ok else "send_failed"}})
        if ok:
            # mirror to the unified conversation log
            db.whatsapp_cloud_messages.insert_one({
                "direction": "outgoing", "phone": r["phone"], "text": f"[template:{TEMPLATE}]",
                "msg_type": "template", "wamid": wamid, "ts": now, "source": "cod_rescue",
                "campaign": CAMPAIGN})
            sent += 1
        else:
            failed += 1
            print(f"  FAIL {r['phone']} — {detail}")
        time.sleep(args.pace)
    print(f"\nsend complete: sent={sent} failed={failed}")


# ---------------------------------------------------------------- report
def classify_reply(text):
    if not text:
        return None, None
    if NO_RX.search(text) and not YES_RX.search(text):
        return text, False
    if YES_RX.search(text):
        return text, True
    return text, None  # replied something ambiguous → needs human read


def cmd_report(args):
    rows = list(db[COLL].find({"campaign": CAMPAIGN}).sort("sent_at", 1))
    out = []
    for r in rows:
        reply_text, accepted = r.get("reply_text"), r.get("cod_accepted")
        # (re)scan inbound messages from this phone after we sent
        if r.get("whatsapp_status") == "sent":
            sent_at = r.get("sent_at") or ""
            inbound = list(db.whatsapp_cloud_messages.find(
                {"phone": r["phone"], "direction": "incoming"}).sort("received_at", 1))
            picked = None
            for m in inbound:
                if (m.get("received_at") or m.get("ts") or "") >= sent_at and m.get("text"):
                    picked = m.get("text")
                    txt, acc = classify_reply(m.get("text"))
                    if acc is not None:   # first decisive yes/no wins
                        picked, accepted = txt, acc
                        break
            if picked is not None:
                reply_text = picked
                if accepted is None:
                    _, accepted = classify_reply(picked)
            db[COLL].update_one({"_id": r["_id"]}, {"$set": {
                "reply_text": reply_text, "cod_accepted": accepted,
                "reply_at": datetime.now(timezone.utc).isoformat() if reply_text else None}})
        ws = {"sent": "Sent", "failed": "Failed"}.get(r.get("whatsapp_status"), "Not sent")
        cod = "Yes" if accepted is True else "No" if accepted is False else (
            "Replied (unclear)" if reply_text else "")
        out.append({
            "Order ID": str(r.get("order_id") or "—") + (f" (+{r.get('order_count',1)-1})" if r.get("order_count", 1) > 1 else ""),
            "Customer Name": r.get("name"), "Phone Number": r["phone"],
            "WhatsApp Status": ws, "Customer Reply": (reply_text or "")[:60],
            "COD Accepted": cod})

    # print full report
    cols = ["Order ID", "Customer Name", "Phone Number", "WhatsApp Status", "Customer Reply", "COD Accepted"]
    print("=== COD RE-DELIVERY REPORT ===")
    print(f"{'Order ID':<26} {'Name':<22} {'Phone':<11} {'WA':<9} {'COD':<8} Reply")
    for o in out:
        print(f"{str(o['Order ID'])[:25]:<26} {str(o['Customer Name'])[:21]:<22} "
              f"{o['Phone Number']:<11} {o['WhatsApp Status']:<9} {o['COD Accepted']:<8} "
              f"{o['Customer Reply']}")
    n_sent = sum(1 for o in out if o["WhatsApp Status"] == "Sent")
    n_yes = sum(1 for o in out if o["COD Accepted"] == "Yes")
    n_no = sum(1 for o in out if o["COD Accepted"] == "No")
    print(f"\ntotals: queued={len(out)} sent={n_sent} COD-yes={n_yes} COD-no={n_no}")

    if n_yes:
        print("\n=== AGREED TO COD — review before reshipping (NO order placed) ===")
        for o in out:
            if o["COD Accepted"] == "Yes":
                print(f"  {o['Phone Number']}  {o['Customer Name']}  ·  {o['Order ID']}")

    if args.csv:
        with open(args.csv, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            w.writerows(out)
        print(f"\nCSV written: {args.csv}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("scan"); s.add_argument("--days", type=int, default=60); s.set_defaults(fn=cmd_scan)
    s = sub.add_parser("preview"); s.add_argument("--all", action="store_true"); s.set_defaults(fn=cmd_preview)
    s = sub.add_parser("status"); s.set_defaults(fn=cmd_status)
    s = sub.add_parser("send"); s.add_argument("--confirm", action="store_true")
    s.add_argument("--limit", type=int, default=0); s.add_argument("--pace", type=float, default=1.0)
    s.set_defaults(fn=cmd_send)
    s = sub.add_parser("report"); s.add_argument("--csv", default=""); s.set_defaults(fn=cmd_report)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()

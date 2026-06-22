#!/usr/bin/env python3
"""Send the approved `purchase_feedback` WhatsApp template to Amazon customers who received a
shipment but never registered warranty. Paced in daily batches to protect the number's quality
rating. Idempotent (db.amazon_feedback_sent by phone); re-checks warranties each run so anyone who
registers in the meantime is dropped. Happy replies flow into the existing review drive.

Usage:
  amazon_feedback_whatsapp.py                 # preview cohort + today's batch
  amazon_feedback_whatsapp.py --test          # one to founder
  amazon_feedback_whatsapp.py --send [--limit N]   # send a batch (default 500)
"""
import os, sys, re, uuid, asyncio
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
LIMIT = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 500
NOW = datetime.now(timezone.utc).isoformat()
TEMPLATE = "purchase_feedback"           # {{1}}=name {{2}}=product
FOUNDER = "9560377363"


def nph(p):
    d = re.sub(r"\D", "", str(p or ""))[-10:]
    return d if (len(d) == 10 and d[0] in "6789" and d != FOUNDER and len(set(d)) > 2) else ""


def low(o, *f):
    return " ".join(str(o.get(k) or "").lower() for k in f)


def product_of(o):
    it = (o.get("items") or [{}])
    it = it[0] if it else {}
    t = it.get("title") or it.get("Title") or it.get("product_name") or ""
    t = re.sub(r"\s+", " ", str(t)).strip()
    return (t[:55] or "MuscleGrid product")


def build_cohort():
    reg = set()
    for w in db.warranties.find({}, {"phone": 1}):
        p = nph(w.get("phone"))
        if p:
            reg.add(p)
    sent = {d["phone"] for d in db.amazon_feedback_sent.find({}, {"phone": 1})}
    optout = ("whatsapp_optouts" in db.list_collection_names())
    seen, out = set(), []
    for o in db.amazon_orders.find({}, {"amazon_order_id": 1, "phone": 1, "phone_manual": 1,
                                        "buyer_name": 1, "customer_name_manual": 1, "fulfillment_truth": 1,
                                        "order_status": 1, "amazon_status": 1, "items": 1, "purchase_date": 1}):
        if "cancel" in low(o, "order_status", "amazon_status"):
            continue
        if not (o.get("fulfillment_truth") == "shipped" or "shipped" in low(o, "amazon_status", "order_status")):
            continue
        p = nph(o.get("phone") or o.get("phone_manual"))
        if not p or p in seen or p in reg or p in sent:
            continue
        if optout and db.whatsapp_optouts.count_documents({"phone": p}):
            continue
        seen.add(p)
        nm = (o.get("buyer_name") or o.get("customer_name_manual") or "").strip()
        out.append({"phone": p, "name": nm, "product": product_of(o), "purchase_date": o.get("purchase_date")})
    # newest purchases first
    out.sort(key=lambda x: str(x.get("purchase_date") or ""), reverse=True)
    return out


cohort = build_cohort()
print(f"Amazon no-warranty feedback cohort remaining: {len(cohort)}  | template={TEMPLATE} | batch={LIMIT}")


async def send_batch(targets):
    ok = 0
    for t in targets:
        first = (t["name"].split() or ["ji"])[0][:60]
        comps = [{"type": "body", "parameters": [
            {"type": "text", "text": first}, {"type": "text", "text": t["product"][:60]}]}]
        res = await whatsapp_cloud.send_template(t["phone"], template=TEMPLATE, components=comps)
        if res.get("wamid"):
            ok += 1
            db.amazon_feedback_sent.insert_one({"phone": t["phone"], "name": t["name"],
                "wamid": res["wamid"], "sent_at": NOW, "product": t["product"]})
            db.whatsapp_cloud_messages.insert_one({
                "id": str(uuid.uuid4()), "direction": "outgoing", "phone": t["phone"],
                "text": f"[{TEMPLATE} — amazon no-warranty feedback]", "msg_type": "template",
                "wamid": res["wamid"], "ts": NOW, "received_at": NOW, "source": "whatsapp_cloud",
                "kind": "amazon_feedback"})
        await asyncio.sleep(0.4)
    return ok


async def main():
    if TEST:
        comps = [{"type": "body", "parameters": [
            {"type": "text", "text": "Pawan"}, {"type": "text", "text": "MuscleGrid Inverter"}]}]
        r = await whatsapp_cloud.send_template(FOUNDER, template=TEMPLATE, components=comps)
        print("TEST ->", "OK " + r["wamid"] if r.get("wamid") else "FAIL " + str(r.get("response")))
        return
    if not SEND:
        print("\nToday's batch preview (first 8):")
        for t in cohort[:8]:
            print(f"  +91-XXXXXX{t['phone'][-4:]}  {t['name'][:20]:20} {t['product'][:34]}")
        print(f"\nTotal sent so far: {db.amazon_feedback_sent.count_documents({})}")
        print("Run with --send to send today's batch.")
        return
    batch = cohort[:LIMIT]
    print(f"Sending {len(batch)}...")
    ok = await send_batch(batch)
    print(f"Done: {ok}/{len(batch)} sent. Remaining after batch: {len(cohort) - ok}")


asyncio.run(main())

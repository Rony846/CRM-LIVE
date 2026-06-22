#!/usr/bin/env python3
"""Send the approved `feedback_request` WhatsApp template to May-2026 DIRECT-sale
customers. Preview by default; pass --send to actually transmit. --limit N caps count.

Amazon orders are excluded on purpose: their stored phone is a placeholder
(founder's number / 0000000000), not a real buyer number.
"""
import asyncio, os, re, sys, uuid
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

sys.path.insert(0, "/var/www/crm/backend")

ENV = dotenv_values("/var/www/crm/backend/.env")
# whatsapp_cloud reads os.environ — make sure the .env creds are present there.
for k, v in ENV.items():
    os.environ.setdefault(k, v or "")

from utils import whatsapp_cloud  # standalone Cloud API client (reads os.environ)
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
TEMPLATE = "purchase_feedback"  # purchase-worded; {{1}}=name {{2}}=product (needs Meta approval)
FOUNDER = "9560377363"
BAD = {"0000000000", "9999999999", "1111111111", FOUNDER}

SEND = "--send" in sys.argv
LIMIT = 5
for a in sys.argv:
    if a.startswith("--limit"):
        LIMIT = int(a.split("=")[1]) if "=" in a else int(sys.argv[sys.argv.index(a) + 1])


def pick():
    q = {"created_at": {"$gte": "2026-05-01", "$lt": "2026-06-01"}, "order_source": "direct"}
    seen, out = set(), []
    for r in db.sales_orders.find(q, {"_id": 0, "phone": 1, "customer_name": 1, "order_number": 1, "master_sku_name": 1}):
        d = re.sub(r"\D", "", str(r.get("phone") or ""))[-10:]
        if len(d) != 10 or d[0] not in "6789" or d in BAD or d in seen:
            continue
        # skip internal staff numbers if that collection exists
        if db.whatsapp_optouts.count_documents({"phone": d}) if "whatsapp_optouts" in db.list_collection_names() else 0:
            continue
        seen.add(d)
        out.append({"phone": d, "name": r.get("customer_name") or "",
                    "order": r.get("order_number"), "product": r.get("master_sku_name") or "product"})
        if len(out) >= LIMIT:
            break
    return out


async def main():
    targets = pick()
    print(f"Selected {len(targets)} direct-sale customers (template={TEMPLATE}, send={SEND}):")
    for t in targets:
        first = (t["name"].split() or ["ji"])[0]
        print(f"  {t['order']:20} {t['name'][:24]:24} +91-XXXXXX{t['phone'][-4:]}  -> body=[{first!r}, {t['product'][:30]!r}]")
    if not SEND:
        print("\nPREVIEW ONLY — re-run with --send to transmit.")
        return
    if not whatsapp_cloud.enabled():
        print("Cloud API not configured; aborting."); return
    print("\nSending...")
    now = datetime.now(timezone.utc).isoformat()
    ok = 0
    for t in targets:
        first = (t["name"].split() or ["ji"])[0]
        comps = [{"type": "body", "parameters": [
            {"type": "text", "text": first[:60]},
            {"type": "text", "text": str(t["product"])[:60]}]}]
        res = await whatsapp_cloud.send_template(t["phone"], template=TEMPLATE, components=comps)
        wamid = res.get("wamid")
        if wamid:
            ok += 1
            db.whatsapp_cloud_messages.insert_one({
                "id": str(uuid.uuid4()), "direction": "outgoing", "phone": t["phone"],
                "text": f"[{TEMPLATE} template — May purchase feedback]", "msg_type": "template",
                "wamid": wamid, "ts": now, "received_at": now, "source": "whatsapp_cloud",
                "kind": "purchase_feedback"})
        print(f"  +91-XXXXXX{t['phone'][-4:]}: {'OK ' + wamid if wamid else 'FAIL ' + str(res.get('error') or res)}")
    print(f"\nDone: {ok}/{len(targets)} sent.")


asyncio.run(main())

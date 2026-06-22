#!/usr/bin/env python3
"""One-shot, fires 2026-06-18 ~09:00 IST (via cron): ask Vijay Verma for his
delivery address so we can dispatch his approved stabilizer PCB. Verma is the
pre-existing case with no invoice/address on file (going forward, invoice-first
captures this up front, so no asking needed).

Idempotent: sets ticket flag pcb_address_asked and exits if already done.
"""
import os, sys, uuid, asyncio
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
for k, v in ENV.items():
    os.environ.setdefault(k, v or "")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
sys.path.insert(0, "/var/www/crm/backend")

TICKET = "MG-R-20260519-78894"
PHONE = "9259272054"
MODEL = "MG2410090AM 10KVA"
PCB_PRODUCT_NAME = "10kva stabilizer 90-300v PCB"  # per founder's naming convention
NOW = datetime.now(timezone.utc).isoformat()

t = db.tickets.find_one({"ticket_number": TICKET}, {"_id": 0, "pcb_address_asked": 1})
if not t:
    print("ticket not found; abort"); sys.exit(0)
if t.get("pcb_address_asked"):
    print("already asked; skip"); sys.exit(0)

# Stamp the ticket so the inbound handler / dispatch knows what's pending.
db.tickets.update_one({"ticket_number": TICKET}, {"$set": {
    "pcb_dispatch_pending": True, "pcb_address_asked": NOW,
    "pcb_model": MODEL, "pcb_product_name": PCB_PRODUCT_NAME, "updated_at": NOW}})


async def main():
    from utils import whatsapp_cloud
    msg = ("Namaste Mr. Verma \U0001f64f Aapke stabilizer ke liye replacement PCB ready hai dispatch ke liye. "
           "Kripya apna *pura delivery address* with *pincode* (aur receiver ka naam) bhej dijiye, "
           "taaki hum PCB aaj hi courier kar dein. Dhanyavaad!")
    res = await whatsapp_cloud.send_text(PHONE, msg)
    ok = bool(res.get("wamid"))
    if ok:
        db.whatsapp_cloud_messages.insert_one({
            "id": str(uuid.uuid4()), "direction": "outgoing", "phone": PHONE, "text": msg,
            "msg_type": "text", "wamid": res["wamid"], "ts": NOW, "received_at": NOW,
            "source": "whatsapp_cloud", "kind": "pcb_address_request"})
    print(f"asked Verma for address: {'OK ' + res['wamid'] if ok else 'FAIL ' + str(res.get('error') or res)}")
    # Alert the founder/group so it isn't dropped.
    db.notifications.insert_one({
        "id": str(uuid.uuid4()), "title": "\U0001f527 PCB — asked Verma for address",
        "message": f"Asked Vijay Verma ({PHONE}) for his delivery address to dispatch the {MODEL} PCB (ticket {TICKET}). "
                   f"Will book the Bigship label on his reply.",
        "type": "service", "link": "/supervisor/tickets",
        "target_roles": ["admin", "supervisor"], "target_user_ids": None,
        "priority": "high", "read_by": [], "data": {"ticket": TICKET}, "created_by": None,
        "created_by_name": "PCB dispatch", "created_at": NOW})

asyncio.run(main())

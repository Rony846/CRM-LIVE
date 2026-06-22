#!/usr/bin/env python3
"""One-off correction for the 2026-06-17 PCB mis-route.
A "pcb" reply matched the NEWEST open decision (F50897 / Kuldeep Mistry, an
inverter battery case) instead of the intended one (6776E4 / Vijay Verma,
stabilizer). This reverts Kuldeep, voids the wrong ops notification, and routes
the PCB to Verma.

Data fixes run by default. Customer WhatsApp messages require --send-messages.
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

SEND_MSGS = "--send-messages" in sys.argv
NOW = datetime.now(timezone.utc).isoformat()
KULDEEP = "9416517209"
VERMA = "9259272054"

VERMA_MSG = ("Mr. Verma \U0001f64f achhi khabar — aapke stabilizer ke liye replacement PCB approve ho gaya hai "
             "aur hum jaldi dispatch kar rahe hain. PCB aane par use khud ya kisi electrician se fit karwa lijiye, "
             "phir check kijiye ki problem theek hui ya nahi — mujhe yahin update kar dijiyega. Agar PCB ke baad bhi "
             "issue rahe to hum unit pickup karke repair kar denge.")
KULDEEP_MSG = ("Mr. Kuldeep \U0001f64f ek chhoti si correction — pichhla PCB wala message galti se aapko chala gaya tha, "
               "woh aapke case ke liye nahi tha. Aapke battery/charging (Code 04) wale case ko humari team review kar "
               "rahi hai aur sahi solution ke saath main jaldi aapko update karungi. Is asuvidha ke liye maafi \U0001f64f")


def data_fixes():
    db.repair_decisions.update_one({"ref": "F50897"},
        {"$set": {"status": "open",
                  "correction_note": "PCB decision mis-routed here (meant for Verma/6776E4); reverted. Battery deep-discharge case still needs repair/replace/technician.",
                  "corrected_at": NOW},
         "$unset": {"decision": "", "resolved_at": ""}})
    print("1) F50897 (Kuldeep) reopened:", db.repair_decisions.find_one({"ref": "F50897"}, {"_id": 0, "status": 1, "decision": 1}))

    db.notifications.update_one({"id": "83aaf711-057d-450a-8611-78bfbbc4720b"},
        {"$set": {"title": "⚠️ [CANCELLED – mis-routed] PCB dispatch",
                  "message": f"IGNORE — mis-routed & CANCELLED. Do NOT send any PCB to Kuldeep Mistry ({KULDEEP}). His inverter battery case is being re-decided.",
                  "priority": "low", "cancelled": True, "cancelled_at": NOW}})
    print("2) wrong Kuldeep PCB notification voided")

    dec = db.repair_decisions.find_one({"ref": "6776E4"}, {"_id": 0})
    db.repair_decisions.update_one({"ref": "6776E4"},
        {"$set": {"status": "resolved", "decision": "pcb",
                  "decided_by": "33165771059423@c.us (corrected via Claude)", "resolved_at": NOW,
                  "correction_note": "Re-routed here from the mis-matched F50897; founder-confirmed intended customer."}})
    print("3) 6776E4 (Verma) resolved:", db.repair_decisions.find_one({"ref": "6776E4"}, {"_id": 0, "status": 1, "decision": 1}))

    db.notifications.insert_one({
        "id": str(uuid.uuid4()), "title": "\U0001f527 Dispatch stabilizer PCB",
        "message": f"Approved: dispatch a replacement PCB to {dec.get('customer_name')} ({dec.get('customer_phone')}) (Voltage Stabilizer) — ticket {dec.get('ticket_number')}. If it doesn't resolve, we'll reverse-pickup the unit.",
        "type": "service", "link": "/operations/courier-shipping",
        "target_roles": ["admin", "accountant", "supervisor"], "target_user_ids": None,
        "priority": "high", "read_by": [], "data": {"ref": "6776E4", "corrected": True},
        "created_by": None, "created_by_name": "Correction (Claude)", "created_at": NOW})
    print("4) correct Verma PCB ops notification created")
    print("\nOpen decisions now:", [(d["ref"], d.get("customer_name")) for d in
          db.repair_decisions.find({"status": "open"}, {"_id": 0, "ref": 1, "customer_name": 1}).sort("created_at", -1)])


async def send_messages():
    from utils import whatsapp_cloud
    for who, digits, msg in [("Verma", VERMA, VERMA_MSG), ("Kuldeep", KULDEEP, KULDEEP_MSG)]:
        res = await whatsapp_cloud.send_text(digits, msg)
        wamid = res.get("wamid")
        if wamid:
            db.whatsapp_cloud_messages.insert_one({
                "id": str(uuid.uuid4()), "direction": "outgoing", "phone": digits, "text": msg,
                "msg_type": "text", "wamid": wamid, "ts": NOW, "received_at": NOW,
                "source": "whatsapp_cloud", "kind": "pcb_misroute_correction"})
        print(f"   {who} ({digits}): {'OK ' + wamid if wamid else 'FAIL ' + str(res.get('error') or res)}")


print("=== DATA FIXES ===")
data_fixes()
if SEND_MSGS:
    print("\n=== CUSTOMER MESSAGES ===")
    asyncio.run(send_messages())
else:
    print("\n(messages NOT sent — re-run with --send-messages to notify Verma + Kuldeep)")

#!/usr/bin/env python3
"""Watcher: scan Verma's incoming WhatsApp for a delivery address (6-digit pincode) that arrived
AFTER our address-ask, and auto-book the PCB the moment one lands. Idempotent — exits as a no-op
once DB315B is dispatched. Derives city/state from the pincode (India Post API) so the booking
has the required fields; notifies the founder (bridge) with the parsed address right after booking.

Run on a schedule. Prints one of: BOOKED / FOUND-BUT-INCOMPLETE / no-address-yet / already-dispatched.
"""
import re, json, subprocess, urllib.request
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
PH = "9259272054"
BRIDGE = "http://127.0.0.1:3011/send"
FOUNDER = "919560377363@c.us"

dec = db.repair_decisions.find_one({"ref": "DB315B"}, {"_id": 0, "status": 1})
if dec and dec.get("status") == "dispatched":
    print("already-dispatched"); raise SystemExit(0)

ask = db.whatsapp_cloud_messages.find_one({"phone": PH, "kind": "pcb_address_request"}, sort=[("ts", -1)])
if not ask:
    print("no address-ask on record"); raise SystemExit(0)
ask_dt = datetime.fromisoformat(ask["ts"])


def to_dt(ts):
    try:
        return datetime.fromisoformat(ts)
    except Exception:
        try:
            return datetime.fromtimestamp(int(float(ts)), tz=timezone.utc)
        except Exception:
            return None


# newest first; consider only messages after the ask
cand = None
for m in db.whatsapp_cloud_messages.find({"phone": PH, "direction": "incoming"}).sort("ts", -1).limit(15):
    dt = to_dt(m.get("ts"))
    if not dt or dt <= ask_dt:
        continue
    txt = str(m.get("text") or "")
    pin = re.search(r"\b([1-9]\d{5})\b", txt)
    # require a pincode AND some address-like length (not just "how much to pay")
    if pin and len(re.sub(r"\s", "", txt)) >= 20:
        cand = {"text": txt, "pincode": pin.group(1)}
        break

if not cand:
    print("no-address-yet"); raise SystemExit(0)

pincode = cand["pincode"]
# India Post pincode -> city/state
city = state = ""
try:
    with urllib.request.urlopen(f"https://api.postalpincode.in/pincode/{pincode}", timeout=15) as r:
        j = json.loads(r.read().decode())
    po = (j[0].get("PostOffice") or [{}])[0]
    city = po.get("District") or po.get("Division") or ""
    state = po.get("State") or ""
except Exception as e:
    print(f"pincode lookup failed: {e}")

if not (city and state):
    print(f"FOUND-BUT-INCOMPLETE pincode={pincode} (city/state unresolved) text={cand['text'][:120]}")
    try:
        urllib.request.urlopen(urllib.request.Request(BRIDGE,
            data=json.dumps({"to": FOUNDER, "message":
                f"⚠️ Verma sent an address but I couldn't resolve city/state for pincode {pincode}. "
                f"Address text:\n{cand['text'][:300]}\nBook manually if it looks right."}).encode(),
            headers={"Content-Type": "application/json"}), timeout=20).read()
    except Exception:
        pass
    raise SystemExit(0)

# address_line1 = the message minus the pincode, trimmed
addr1 = re.sub(r"\b" + pincode + r"\b", "", cand["text"]).strip().strip(",").strip()[:50] or "As per WhatsApp"

print(f"BOOKING: addr1={addr1!r} city={city!r} state={state!r} pincode={pincode}")
out = subprocess.run(
    ["/var/www/crm/backend/venv/bin/python", "/var/www/crm/backend/scripts/book_verma_pcb.py",
     "--addr1", addr1, "--city", city, "--state", state, "--pincode", pincode, "--send"],
    capture_output=True, text=True, cwd="/var/www/crm/backend")
print(out.stdout[-1500:])
if out.returncode != 0:
    print("BOOK FAILED:\n", out.stderr[-800:])

#!/usr/bin/env python3
"""Book Vijay Verma's replacement-PCB shipment via Bigship and deliver the label to the founder.

STAGED: fill --addr1/--city/--state/--pincode (and optional --addr2/--receiver/--rphone) from
Verma's WhatsApp reply, then run with --send. Dry-run prints the exact request and exits.

Spec (founder): 5×5×5 cm, 100 g, product "8KVA 90-300V Stabilizer PCB", PREPAID, origin = MuscleGrid
Meerut warehouse (Bigship id 229862). On success: logs pratibha_shipments, stamps decision DB315B
dispatched, emails the founder the AWB+label link, and WhatsApps the founder the label PDF via the bridge.

Usage:
  venv/bin/python scripts/book_verma_pcb.py --addr1 "..." --city "..." --state "..." --pincode "###" [--send]
"""
import sys, argparse, json, uuid, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
import jwt, httpx
from pymongo import MongoClient
from dotenv import dotenv_values

sys.path.insert(0, "/var/www/crm/backend")   # so `from zoho_email_service import zoho_mail` resolves

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
NOW = datetime.now(timezone.utc).isoformat()
BASE = "http://127.0.0.1:8001"
ADMIN_ID = "15511c11-f2bc-480c-8364-6a1208f0b015"   # founder@musclegrid.in (admin)
ORIGIN_WAREHOUSE = 229862                            # SUDARSHAN, Meerut 250002 (primary forward origin)
FOUNDER_EMAIL = "pawan846@outlook.com"
FOUNDER_WA = "9560377363"
BRIDGE = "http://127.0.0.1:3011/send"
DECISION_REF = "DB315B"

p = argparse.ArgumentParser()
p.add_argument("--addr1", default=""); p.add_argument("--addr2", default="")
p.add_argument("--city", default=""); p.add_argument("--state", default="")
p.add_argument("--pincode", default=""); p.add_argument("--landmark", default="")
p.add_argument("--receiver", default="Vijay Vikas Verma"); p.add_argument("--rphone", default="9259272054")
p.add_argument("--send", action="store_true")
a = p.parse_args()

import re as _re
def _clean(s):
    # Bigship allows only alphanumeric, spaces and . , - /  — strip the rest, collapse whitespace.
    s = _re.sub(r"[\r\n\t]+", " ", str(s or ""))
    s = _re.sub(r"[^A-Za-z0-9 .,\-/]", " ", s)
    return _re.sub(r"\s+", " ", s).strip(" ,")

# sanitize + split overflow across the two 50-char address lines
_full = _clean(a.addr1)
addr1, addr2 = _full[:50].strip(" ,"), (_clean(a.addr2) or _full[50:]).strip(" ,")[:50]

first, _, last = a.receiver.partition(" ")
req = {
    "shipment_type": "b2c", "warehouse_id": ORIGIN_WAREHOUSE,
    "first_name": first or "Vijay", "last_name": (last or "Verma"),
    "phone": a.rphone, "address_line1": addr1, "address_line2": addr2,
    "city": a.city, "state": a.state, "pincode": str(a.pincode), "landmark": a.landmark[:50],
    "product_name": "8KVA 90-300V Stabilizer PCB", "product_category": "Others",
    "product_sub_category": "General", "quantity": 1,
    "weight_kg": 0.1, "length_cm": 5, "width_cm": 5, "height_cm": 5,
    "invoice_number": f"PCB-VERMA-{NOW[:10].replace('-','')}",
    "invoice_amount": 100.0, "payment_type": "Prepaid", "cod_amount": 0,
}

missing = [k for k in ("address_line1", "city", "state", "pincode") if not req[k]]
print("=== Verma PCB shipment request ===")
print(json.dumps(req, indent=2, ensure_ascii=False))
if missing:
    print(f"\n⚠ MISSING (fill from Verma's reply): {missing}")
if not a.send:
    print("\nDRY-RUN — re-run with --send (and all address fields) to book.")
    sys.exit(0)
if missing:
    print("\nRefusing to book with missing address fields."); sys.exit(1)

tok = jwt.encode({"user_id": ADMIN_ID, "role": "admin",
                  "exp": datetime.now(timezone.utc) + timedelta(hours=2)}, ENV["JWT_SECRET"], algorithm="HS256")
H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

r = httpx.post(f"{BASE}/api/courier/shipments/create", json=req, headers=H, timeout=90)
resp = r.json()
print("\nbooking status:", r.status_code, "| success:", resp.get("success"), "| msg:", resp.get("message"))
awb = resp.get("awb_number"); soid = resp.get("system_order_id"); label_url = resp.get("label_url")
courier = resp.get("courier_name")
print(f"AWB={awb} courier={courier} label_url={label_url} system_order_id={soid}")

db.pratibha_shipments.insert_one({
    "id": str(uuid.uuid4()), "phone": a.rphone, "pincode": str(a.pincode), "amount": 100.0,
    "product": "8KVA 90-300V Stabilizer PCB", "awb": awb, "order_id": req["invoice_number"],
    "amazon_order_id": None, "courier": courier, "label_url": label_url,
    "success": bool(resp.get("success")), "by": "claude:verma pcb", "created_at": NOW,
    "system_order_id": soid, "kind": "pcb_dispatch"})

if not (resp.get("success") and awb):
    print("\nBooking did not complete — not delivering label."); sys.exit(1)

# success → only now mark the decision dispatched
db.repair_decisions.update_one({"ref": DECISION_REF}, {"$set": {
    "status": "dispatched", "pcb_dispatch_pending": False, "awb": awb, "courier": courier,
    "label_url": label_url, "dispatched_at": NOW}})

# fetch label PDF bytes from the live label endpoint
pdf = None
try:
    lr = httpx.get(f"{BASE}{label_url}" if label_url.startswith("/") else label_url, headers=H, timeout=60)
    if lr.status_code < 400 and lr.content[:4] == b"%PDF":
        pdf = lr.content
except Exception as e:
    print("label fetch error:", e)

track = f"https://api.bigship.in/tracking?awb={awb}"
# email the founder
try:
    from zoho_email_service import zoho_mail
    html = (f"<p>Verma's replacement PCB is booked.</p><ul>"
            f"<li><b>AWB:</b> {awb}</li><li><b>Courier:</b> {courier}</li>"
            f"<li><b>Product:</b> 8KVA 90-300V Stabilizer PCB (5×5×5, 100g, Prepaid)</li>"
            f"<li><b>Label:</b> {BASE}{label_url}</li></ul>")
    er = zoho_mail.send_email(to_address=FOUNDER_EMAIL, subject=f"Verma PCB booked — AWB {awb}", content=html)
    print("email ->", "OK" if er.get("success") else "FAIL " + str(er.get("error")))
except Exception as e:
    print("email error:", e)

# WhatsApp the founder via the bridge (PDF if we have it, else text)
try:
    payload = {"to": f"91{FOUNDER_WA}@c.us",
               "message": f"📦 Verma PCB booked\nAWB: {awb}\nCourier: {courier}\nLabel: {BASE}{label_url}"}
    urllib.request.urlopen(urllib.request.Request(BRIDGE, data=json.dumps(payload).encode(),
                           headers={"Content-Type": "application/json"}), timeout=25).read()
    print("bridge WA -> sent")
except Exception as e:
    print("bridge WA error:", e)

print(f"\nDONE. AWB {awb} via {courier}. Label: {BASE}{label_url}")

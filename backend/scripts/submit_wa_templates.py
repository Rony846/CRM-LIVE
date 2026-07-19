#!/usr/bin/env python3
"""One-off: submit the CRM's WhatsApp message templates to Meta for approval.

Usage:  venv/bin/python scripts/submit_wa_templates.py <WABA_ID> [--list-only]

Reads WHATSAPP_CLOUD_TOKEN from backend/.env. The token already carries the
whatsapp_business_management scope, so it can both LIST and CREATE templates —
all it lacks is the WhatsApp Business Account (WABA) id, which is passed in.

Each template's name / parameter count / language MUST match exactly what
server.py sends (see _wa_notify_or_template call sites), or the live sends fail.
"""
import sys
import httpx
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
TOKEN = (ENV.get("WHATSAPP_CLOUD_TOKEN") or "").strip()
API = "https://graph.facebook.com/v21.0"
LANG = "en"  # must match WHATSAPP_TEMPLATE_LANG default in whatsapp_cloud.py

# name -> (category, body_text, example_params)
# {{1}}, {{2}} positions match params=[...] order at each server.py call site.
TEMPLATES = [
    ("service_followup", "UTILITY",
     "Namaste {{1}} \U0001f64f Main Kalpana, MuscleGrid support se. Aapne recently humse "
     "contact kiya tha. Aapki problem ab resolve ho gayi ya abhi bhi koi issue hai? "
     "Yahin reply kijiye — main turant help karti hoon.",
     ["Rahul"]),

    ("repair_dispatched", "UTILITY",
     "Aapka {{1}} repair hokar wapas dispatch ho gaya hai \U0001f4e6 Tracking/AWB: {{2}}. "
     "Delivery me 3-5 din lag sakte hain. Koi sawal ho to yahin reply kijiye.",
     ["Inverter 1100VA", "BIG123456789"]),

    ("pickup_scheduled", "UTILITY",
     "Aapke {{1}} ke liye reverse pickup schedule ho gaya hai. Pickup details: {{2}}. "
     "Kripya unit ko pack karke ready rakhein. Dhanyavaad \U0001f64f",
     ["Inverter 1100VA", "Pickup on 20 Jun, AWB BIG123456789"]),

    ("feedback_request", "UTILITY",
     "Namaste {{1}} \U0001f64f Aapka service request resolve ho gaya hai. Kya sab kuch "
     "theek chal raha hai? Apna experience humein batayein — aapka feedback humare "
     "liye bahut important hai.",
     ["Rahul"]),

    ("warranty_reminder", "MARKETING",
     "Namaste \U0001f64f Aapke {{1}} ki warranty {{2}} me expire ho rahi hai. Renewal ya "
     "kisi bhi help ke liye humein reply kijiye — MuscleGrid aapke saath hai.",
     ["Inverter 1100VA", "15 din"]),

    ("amc_visit_reminder", "UTILITY",
     "Namaste {{1}} \U0001f64f Aapki AMC service visit {{2}} ko scheduled hai. Kripya "
     "confirm karein ya reschedule ke liye reply kijiye. Dhanyavaad.",
     ["Rahul", "20 Jun, 11am-1pm"]),

    # Voice-agent decision outcomes → customer (reach cold customers outside the 24h window).
    # {{1}} = customer first name, {{2}} = product. Used by _voice_decision_cloud_reply.
    ("service_pcb_dispatch", "UTILITY",
     "Namaste {{1}} \U0001f64f MuscleGrid se. Aapke {{2}} ke liye hum ek replacement PCB courier "
     "se bhej rahe hain. Milne par use lagwakar batayein — aksar isse problem theek ho jaati hai. "
     "Koi sawal ho to yahin reply kijiye.",
     ["Rahul", "5 kVA Stabilizer"]),

    ("service_replacement_approved", "UTILITY",
     "Namaste {{1}} \U0001f64f MuscleGrid se. Aapke {{2}} ka replacement approve ho gaya hai. "
     "Hamari team aage ki jaankari jaldi bhejegi. Dhanyavaad.",
     ["Rahul", "Inverter 1100VA"]),

    ("service_repair_pickup_request", "UTILITY",
     "Namaste {{1}} \U0001f64f MuscleGrid se. Hum aapke {{2}} ki repair ke liye pickup arrange kar "
     "rahe hain. Kripya apna poora address aur pincode yahin reply karke bhej dijiye. Dhanyavaad.",
     ["Rahul", "Inverter 1100VA"]),

    # Post-PURCHASE feedback (distinct from the service-worded feedback_request).
    # {{1}} = customer first name, {{2}} = product purchased.
    ("purchase_feedback", "UTILITY",
     "Namaste {{1}} \U0001f64f MuscleGrid se aapki {{2}} ki recent purchase ke liye "
     "dhanyavaad! Kya product sahi-salamat mila aur sab theek chal raha hai? Apna "
     "experience humein yahin reply karke batayein — aapka feedback humare liye bahut "
     "important hai.",
     ["Deepak", "Inverter 1100VA"]),
]

# Templates WITH a dynamic URL button. The button suffix ({{1}} on the URL) is the product serial, so
# the button opens the prefilled warranty-activation page /warranty/<serial>. server.py sends body
# params [first_name, order_ref] and a button URL param [serial] — MUST match this exactly.
# Set DISPATCH_WA_TEMPLATE=order_dispatched in .env once this is APPROVED to switch the auto-send on.
BASE = "https://newcrm.musclegrid.in"
BUTTON_TEMPLATES = [
    ("order_dispatched", "UTILITY",
     "Namaste {{1}} \U0001f64f Aapka MuscleGrid order {{2}} dispatch ho gaya hai aur jald aapke "
     "paas pahunchega! \U0001f389 Neeche button dabakar apni warranty abhi activate karein aur "
     "apna product app unlock karein — sirf 1 minute lagega.",
     ["Deepak", "404-1234567-1234567"],
     {"text": "Activate Warranty", "url": BASE + "/warranty/{{1}}",
      "example": [BASE + "/warranty/MGLIB2607000123"]}),
]


def list_templates(waba):
    r = httpx.get(f"{API}/{waba}/message_templates",
                  params={"access_token": TOKEN, "limit": 200,
                          "fields": "name,status,category,language"}, timeout=30)
    r.raise_for_status()
    return r.json().get("data", [])


def create(waba, name, category, body, example, button=None):
    components = [{"type": "BODY", "text": body, "example": {"body_text": [example]}}]
    if button:
        components.append({"type": "BUTTONS", "buttons": [
            {"type": "URL", "text": button["text"], "url": button["url"],
             "example": button["example"]}]})
    payload = {"name": name, "language": LANG, "category": category, "components": components}
    r = httpx.post(f"{API}/{waba}/message_templates",
                   params={"access_token": TOKEN}, json=payload, timeout=30)
    return r.status_code, r.json()


def main():
    if not TOKEN:
        sys.exit("No WHATSAPP_CLOUD_TOKEN in .env")
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    waba = sys.argv[1].strip()
    list_only = "--list-only" in sys.argv

    print(f"== Existing templates on WABA {waba} ==")
    try:
        existing = list_templates(waba)
    except httpx.HTTPStatusError as e:
        sys.exit(f"List failed: {e.response.status_code} {e.response.text}")
    by_name = {t["name"]: t for t in existing}
    for t in existing:
        print(f"  {t['name']:24} {t.get('language'):6} {t.get('category'):10} {t.get('status')}")
    if not existing:
        print("  (none)")

    if list_only:
        return

    print("\n== Submitting missing templates ==")
    for name, category, body, example in TEMPLATES:
        if name in by_name:
            print(f"  SKIP  {name:24} already exists ({by_name[name].get('status')})")
            continue
        code, resp = create(waba, name, category, body, example)
        if code == 200 and resp.get("id"):
            print(f"  OK    {name:24} -> id={resp['id']} status={resp.get('status')}")
        else:
            print(f"  FAIL  {name:24} [{code}] {resp.get('error', resp)}")
    for name, category, body, example, button in BUTTON_TEMPLATES:
        if name in by_name:
            print(f"  SKIP  {name:24} already exists ({by_name[name].get('status')})")
            continue
        code, resp = create(waba, name, category, body, example, button)
        if code == 200 and resp.get("id"):
            print(f"  OK    {name:24} -> id={resp['id']} status={resp.get('status')}  (set DISPATCH_WA_TEMPLATE={name} once APPROVED)")
        else:
            print(f"  FAIL  {name:24} [{code}] {resp.get('error', resp)}")


if __name__ == "__main__":
    main()

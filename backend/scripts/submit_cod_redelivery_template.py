#!/usr/bin/env python3
"""Submit the COD re-delivery offer template (for RTO/undelivered prepaid orders).

Usage:  venv/bin/python scripts/submit_cod_redelivery_template.py [--list-only]

Reads WHATSAPP_CLOUD_TOKEN + WHATSAPP_WABA_ID from backend/.env.
Body var {{1}} = customer first name. Two quick-reply buttons; the "YES" button
text comes back verbatim in the inbound webhook so consent is captured cleanly.
Submitted as UTILITY (a post-purchase order/refund update); Meta may auto-
recategorise to MARKETING, which is fine — the send pipeline honours opt-outs.
"""
import sys
import httpx
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
TOKEN = (ENV.get("WHATSAPP_CLOUD_TOKEN") or "").strip()
WABA = (ENV.get("WHATSAPP_WABA_ID") or "").strip()
API = "https://graph.facebook.com/v21.0"
LANG = "en"

NAME = "cod_redelivery_offer"
CATEGORY = "UTILITY"
BODY = (
    "Hello {{1}} \U0001f64f Unfortunately your prepaid MuscleGrid order could not be "
    "delivered by the courier and is being refunded. If you still want the product, we "
    "can dispatch it again on Cash on Delivery (COD) — you pay only when the parcel "
    "reaches you. Tap YES below (or reply YES) and we'll resend it on COD."
)
EXAMPLE_NAME = "Rahul"
BUTTONS = ["YES, resend on COD", "No thanks"]


def list_templates():
    r = httpx.get(f"{API}/{WABA}/message_templates",
                  params={"access_token": TOKEN, "limit": 200,
                          "fields": "name,status,category,language"}, timeout=30)
    r.raise_for_status()
    return r.json().get("data", [])


def create():
    payload = {
        "name": NAME, "language": LANG, "category": CATEGORY,
        "components": [
            {"type": "BODY", "text": BODY,
             "example": {"body_text": [[EXAMPLE_NAME]]}},
            {"type": "BUTTONS",
             "buttons": [{"type": "QUICK_REPLY", "text": t} for t in BUTTONS]},
        ],
    }
    r = httpx.post(f"{API}/{WABA}/message_templates",
                   params={"access_token": TOKEN}, json=payload, timeout=30)
    return r.status_code, r.json()


def main():
    if not TOKEN or not WABA:
        sys.exit("Need WHATSAPP_CLOUD_TOKEN and WHATSAPP_WABA_ID in .env")
    existing = {t["name"]: t for t in list_templates()}
    if NAME in existing:
        print(f"Already exists: {NAME} -> status={existing[NAME].get('status')} "
              f"category={existing[NAME].get('category')}")
        if "--list-only" in sys.argv:
            return
        print("(not resubmitting)")
        return
    if "--list-only" in sys.argv:
        print(f"{NAME}: NOT YET SUBMITTED")
        return
    code, resp = create()
    if code == 200 and resp.get("id"):
        print(f"OK  submitted {NAME} -> id={resp['id']} status={resp.get('status')} "
              f"category={resp.get('category')}")
    else:
        print(f"FAIL [{code}] {resp.get('error', resp)}")


if __name__ == "__main__":
    main()

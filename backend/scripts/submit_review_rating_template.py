#!/usr/bin/env python3
"""Submit the `review_rating_request` template — a post-purchase feedback ask with
three tappable star-rating QUICK_REPLY buttons. Tapping a button sends its label back
as an inbound message; the live gating reads the star count (5★ → Google review link,
lower → support, no public link). {{1}}=first name, {{2}}=product.

Usage:  venv/bin/python scripts/submit_review_rating_template.py [--list-only]
"""
import sys
import httpx
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
TOKEN = (ENV.get("WHATSAPP_CLOUD_TOKEN") or "").strip()
WABA = (ENV.get("WHATSAPP_WABA_ID") or "").strip()
API = "https://graph.facebook.com/v21.0"
LANG = "en"

NAME = "review_rating_request"
CATEGORY = "UTILITY"
BODY = ("Namaste {{1}} \U0001f64f MuscleGrid se aapki {{2}} ki recent purchase ke liye "
        "dhanyavaad! Aapka experience kaisa raha? ⭐⭐⭐⭐⭐ = sabse accha. "
        "Neeche apni rating tap karein \U0001f447")
EXAMPLE = ["Pawan", "MG 5kVA Voltage Stabilizer"]
# Quick-reply button labels: NO emoji/formatting allowed by Meta — plain text, <=25 chars.
# The label comes back verbatim on tap; the gating parses the leading star number.
BUTTONS = ["5 Star - Excellent", "3 Star - Average", "1 Star - Problem"]


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
            {"type": "BODY", "text": BODY, "example": {"body_text": [EXAMPLE]}},
            {"type": "BUTTONS", "buttons": [{"type": "QUICK_REPLY", "text": t} for t in BUTTONS]},
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
        print(f"{NAME}: status={existing[NAME].get('status')} category={existing[NAME].get('category')}")
        return
    if "--list-only" in sys.argv:
        print(f"{NAME}: NOT YET SUBMITTED")
        return
    code, resp = create()
    if code == 200 and resp.get("id"):
        print(f"OK submitted {NAME} -> id={resp['id']} status={resp.get('status')} category={resp.get('category')}")
    else:
        print(f"FAIL [{code}] {resp.get('error', resp)}")


if __name__ == "__main__":
    main()

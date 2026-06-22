#!/usr/bin/env python3
"""Send a feedback email to lithium-battery customers (from warranty registrations — the only
lithium cohort with real emails on file: 123 of 125). Personalised, idempotent, opt-out-safe.

The ₹200 cashback is framed as PRIVATE feedback ("share your experience") — compliant. It is
NOT tied to posting a public review (which would breach Amazon/Google policy).

Usage:
  venv/bin/python scripts/lithium_feedback_email.py            # dry-run (preview + count)
  venv/bin/python scripts/lithium_feedback_email.py --test     # send ONE to founder (pawan846@outlook.com)
  venv/bin/python scripts/lithium_feedback_email.py --send     # send to all eligible customers
"""
import sys, re
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

sys.path.insert(0, "/var/www/crm/backend")
ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
SEND = "--send" in sys.argv
TEST = "--test" in sys.argv
TEST_TO = "pawan846@outlook.com"     # founder test inbox (never real customers in test)
LITH = re.compile(r"lithium|lifepo|lfp", re.I)
NOW = datetime.now(timezone.utc).isoformat()
SUPPORT = "service@musclegrid.in"

SUBJECT = "How's your MuscleGrid Lithium Battery performing? (₹200 cashback inside)"

def body(first, product):
    name = (first or "there").title()
    return f"""<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.6;max-width:560px">
<p>Namaste {name},</p>
<p>Thank you for choosing your <b>MuscleGrid {product}</b>. As a registered owner, your honest
experience matters a lot to us.</p>
<p>Could you share a quick note on how your battery is performing — what's working well, and
anything we could do better?</p>
<p><b>As a thank-you, share your experience (a short note or a photo of your setup) and we'll
send you ₹200 cashback.</b></p>
<p>Just reply to this email, or WhatsApp/contact us at <a href="mailto:{SUPPORT}">{SUPPORT}</a>.</p>
<p>Warm regards,<br/>Team MuscleGrid</p>
</div>"""

# eligible: lithium warranties with a usable, non-internal email; dedup by email; skip already-sent
seen = set()
targets = []
for w in db.warranties.find({}, {"_id": 0, "id": 1, "first_name": 1, "email": 1, "product_name": 1,
                                 "device_type": 1, "feedback_email_sent_at": 1}):
    if not LITH.search(" ".join(str(w.get(k) or "") for k in ("product_name", "device_type"))):
        continue
    em = (w.get("email") or "").strip().lower()
    if "@" not in em or em.endswith("@musclegrid.in"):
        continue
    if em in seen or w.get("feedback_email_sent_at"):
        continue
    if db.email_optouts.count_documents({"email": em}) if "email_optouts" in db.list_collection_names() else 0:
        continue
    seen.add(em)
    targets.append({"id": w["id"], "email": em, "first": w.get("first_name"),
                    "product": w.get("product_name") or "Lithium Battery"})

print(f"Eligible lithium-warranty customers (dedup, with email): {len(targets)}")
print(f"Subject: {SUBJECT}\n")

if TEST:
    from zoho_email_service import zoho_mail
    r = zoho_mail.send_email(to_address=TEST_TO, subject="[TEST] " + SUBJECT,
                             content=body("Pawan", "Thunder Pro 24V LiFePO4 Battery"))
    print(f"TEST email → {TEST_TO}: {'OK ' + str(r.get('message_id')) if r.get('success') else 'FAIL ' + str(r.get('error'))}")
elif SEND:
    from zoho_email_service import zoho_mail
    import time
    ok = 0
    for t in targets:
        r = zoho_mail.send_email(to_address=t["email"], subject=SUBJECT,
                                 content=body(t["first"], t["product"]))
        if r.get("success"):
            ok += 1
            db.warranties.update_one({"id": t["id"]}, {"$set": {"feedback_email_sent_at": NOW}})
        print(f"  {t['email']}: {'OK' if r.get('success') else 'FAIL ' + str(r.get('error'))}")
        time.sleep(0.5)
    print(f"\nDone: {ok}/{len(targets)} sent.")
else:
    print("PREVIEW (dry-run) — sample recipients:")
    for t in targets[:8]:
        print(f"  {t['first'] or '?':14} {t['email']:32} {t['product'][:36]}")
    print(f"\n--- email body preview (HTML rendered as text) ---")
    print(re.sub(r"<[^>]+>", "", body("Manish", "Thunder Pro 24V LiFePO4 Battery")).strip())
    print("\nRe-run with --test (one to founder) or --send (all).")

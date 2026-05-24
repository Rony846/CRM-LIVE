"""
Phase A: read-only verification of Amazon orders in pending_fulfillment.

For each PF entry that is Amazon-sourced, has a tracking_id, and is in a
non-terminal status (pending_dispatch / ready_to_dispatch / in_dispatch_queue):

  1. Call POST /api/amazon/scrape-and-save-pii/{order_id}?firm_id=X&dry_run=true
     (read-only scrape via the singleton browser agent — does not write PII).
  2. Compare pincode + phone against the PF entry. Match = both exact.
  3. Append a doc to the new `amazon_verifications` collection.

NO writes to pending_fulfillment / dispatches / inventory / sales.
"""
import os
import sys
import asyncio
import json
import uuid
from datetime import datetime, timezone

import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/var/www/crm/backend/.env")

API = "http://127.0.0.1:8001/api"
TOKEN_PATH = "/tmp/admin_jwt"


def norm_phone(s):
    digits = "".join(c for c in (s or "") if c.isdigit())
    # Strip leading country code variants
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[-10:]
    return digits[-10:] if len(digits) >= 10 else digits


def norm_pin(s):
    return "".join(c for c in (s or "") if c.isdigit())[:6]


async def fetch_candidates(db):
    """All Amazon PF entries that have tracking and are in flight."""
    cur = db.pending_fulfillment.find(
        {
            "$or": [
                {"type": "amazon_order"},
                {"order_source": "amazon"},
                {"amazon_order_id": {"$ne": None}},
            ],
            "status": {"$in": ["pending_dispatch", "ready_to_dispatch", "in_dispatch_queue"]},
            "$and": [
                {"$or": [{"tracking_id": {"$nin": [None, ""]}}, {"tracking_number": {"$nin": [None, ""]}}]}
            ],
        },
        {"_id": 0},
    )
    return await cur.to_list(5000)


async def scrape_dry_run(client: httpx.AsyncClient, token: str, order_id: str, firm_id: str):
    r = await client.post(
        f"{API}/amazon/scrape-and-save-pii/{order_id}",
        params={"firm_id": firm_id, "dry_run": "true"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=60.0,
    )
    if r.status_code != 200:
        return {"_error": f"HTTP {r.status_code}: {r.text[:200]}"}
    return r.json()


async def main():
    token = open(TOKEN_PATH).read().strip()
    db_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = db_client[os.environ["DB_NAME"]]

    candidates = await fetch_candidates(db)
    total = len(candidates)
    print(f"VERIFY START n={total}", flush=True)

    # Resume-safe: skip orders we've already verified in this run
    already = set()
    async for v in db.amazon_verifications.find(
        {"run_tag": "phaseA_2026-05-19"}, {"_id": 0, "amazon_order_id": 1}
    ):
        already.add(v["amazon_order_id"])
    if already:
        print(f"  resuming, already verified: {len(already)}", flush=True)

    counts = {"matched": 0, "mismatched": 0, "cancelled_on_amazon": 0, "scrape_failed": 0, "skipped_no_order_id": 0}
    async with httpx.AsyncClient() as client:
        for i, pf in enumerate(candidates, 1):
            order_id = pf.get("amazon_order_id") or pf.get("order_id")
            if not order_id:
                counts["skipped_no_order_id"] += 1
                continue
            if order_id in already:
                continue

            firm_id = pf.get("firm_id")
            pf_phone = norm_phone(pf.get("phone_manual") or pf.get("phone") or pf.get("customer_phone"))
            pf_pin = norm_pin(pf.get("pincode_manual") or pf.get("pincode"))

            result = await scrape_dry_run(client, token, order_id, firm_id)
            now = datetime.now(timezone.utc).isoformat()

            doc = {
                "id": str(uuid.uuid4()),
                "run_tag": "phaseA_2026-05-19",
                "pending_fulfillment_id": pf.get("id"),
                "amazon_order_id": order_id,
                "firm_id": firm_id,
                "verified_at": now,
                "pf_snapshot": {
                    "customer_name": pf.get("customer_name") or pf.get("customer_name_manual"),
                    "phone": pf.get("phone_manual") or pf.get("phone"),
                    "address": pf.get("address_manual") or pf.get("address"),
                    "city": pf.get("city_manual") or pf.get("city"),
                    "state": pf.get("state_manual") or pf.get("state"),
                    "pincode": pf.get("pincode_manual") or pf.get("pincode"),
                },
            }

            if "_error" in result:
                doc.update({"matched": False, "scrape_failed": True, "scrape_error": result["_error"]})
                counts["scrape_failed"] += 1
            else:
                scraped = result.get("scraped") or {}
                doc["scraped"] = scraped
                if scraped.get("cancelled_on_amazon"):
                    doc.update({"matched": False, "cancelled_on_amazon": True})
                    counts["cancelled_on_amazon"] += 1
                else:
                    az_phone = norm_phone(scraped.get("phone"))
                    az_pin = norm_pin(scraped.get("pincode"))
                    pin_ok = bool(pf_pin) and pf_pin == az_pin
                    phone_ok = bool(pf_phone) and pf_phone == az_phone
                    matched = pin_ok and phone_ok
                    diffs = {}
                    if not pin_ok:
                        diffs["pincode"] = {"pf": pf_pin, "amazon": az_pin}
                    if not phone_ok:
                        diffs["phone"] = {"pf": pf_phone, "amazon": az_phone}
                    # Informational diffs (don't fail verification on these per user's rule)
                    for k_src, k_az in [("city", "city"), ("state", "state")]:
                        pv = (doc["pf_snapshot"].get(k_src) or "").strip().lower()
                        av = (scraped.get(k_az) or "").strip().lower()
                        if pv and av and pv != av:
                            diffs.setdefault("info", {})[k_src] = {"pf": pv, "amazon": av}
                    doc.update({"matched": matched, "diffs": diffs})
                    counts["matched" if matched else "mismatched"] += 1

            await db.amazon_verifications.insert_one(doc)

            if i % 5 == 0 or i == total:
                print(
                    f"  [{i}/{total}] {order_id}  matched={counts['matched']} "
                    f"mismatched={counts['mismatched']} cancelled={counts['cancelled_on_amazon']} "
                    f"errors={counts['scrape_failed']}",
                    flush=True,
                )

    print(f"VERIFY DONE total={total} {json.dumps(counts)}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())

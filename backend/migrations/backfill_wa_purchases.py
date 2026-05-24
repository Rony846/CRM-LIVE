"""
Backfill purchases created by the WhatsApp agent so their items match the
canonical shape the accountant UI expects.

Older WA-agent purchases shipped items in a half-canonical shape:
  - field names: name / sku / amount (canonical: item_name / sku_code / total)
  - no per-line GST split (gst_rate / taxable_value / igst / cgst / sgst / total)
  - item_type hard-coded to "raw_material" even when the SKU actually lives
    in master_skus, which made the canonical /api/purchases/{id} update path
    404 on item lookup

This script rebuilds those items in place, preserving qty/rate/invoice info
and the existing doc_status="draft" so the accountant still finalises by hand.

Run once:
    cd backend && ./venv/bin/python -m migrations.backfill_wa_purchases
"""

import asyncio
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(ROOT / ".env")


def _is_canonical(item: dict) -> bool:
    return all(k in item for k in ("item_name", "sku_code", "gst_rate", "taxable_value", "total"))


async def _resolve_item(db, name: str):
    """Look up (item_doc, item_type) by name. raw_materials first, then master_skus."""
    if not name:
        return None, "raw_material"
    doc = await db.raw_materials.find_one(
        {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}
    )
    if doc:
        return doc, "raw_material"
    doc = await db.master_skus.find_one(
        {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}
    )
    if doc:
        return doc, "master_sku"
    return None, "raw_material"


def _rebuild_item(item: dict, item_doc: dict | None, item_type: str, is_inter_state: bool) -> dict:
    qty = float(item.get("quantity") or item.get("qty") or 1)
    rate = float(item.get("rate") or item.get("price") or item.get("unit_price") or 0)

    gst_rate = item.get("gst_rate")
    if gst_rate is None:
        gst_rate = (item_doc or {}).get("gst_rate", 18)
    gst_rate = float(gst_rate)

    taxable_value = round(qty * rate, 2)
    line_gst = round(taxable_value * gst_rate / 100, 2)
    return {
        "item_type": item_type,
        "item_id": (item_doc or {}).get("id") or item.get("item_id"),
        "item_name": (item_doc or {}).get("name") or item.get("item_name") or item.get("name") or "Unknown",
        "sku_code": (item_doc or {}).get("sku_code") or (item_doc or {}).get("sku") or item.get("sku_code") or item.get("sku") or "",
        "hsn_code": (item_doc or {}).get("hsn_code") or item.get("hsn_code") or "",
        "quantity": qty,
        "rate": rate,
        "gst_rate": gst_rate,
        "taxable_value": taxable_value,
        "igst": line_gst if is_inter_state else 0,
        "cgst": 0 if is_inter_state else round(line_gst / 2, 2),
        "sgst": 0 if is_inter_state else round(line_gst / 2, 2),
        "total": round(taxable_value + line_gst, 2),
    }


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    cursor = db.purchases.find({"source": "whatsapp_agent"})
    repaired = skipped = 0
    async for purchase in cursor:
        items = purchase.get("items") or []
        if items and all(_is_canonical(i) for i in items):
            skipped += 1
            continue

        is_inter_state = bool(purchase.get("is_inter_state"))
        new_items = []
        for item in items:
            name = item.get("item_name") or item.get("name") or ""
            item_doc, item_type = await _resolve_item(db, name)
            new_items.append(_rebuild_item(item, item_doc, item_type, is_inter_state))

        total_taxable = round(sum(i["taxable_value"] for i in new_items), 2)
        total_igst = round(sum(i["igst"] for i in new_items), 2)
        total_cgst = round(sum(i["cgst"] for i in new_items), 2)
        total_sgst = round(sum(i["sgst"] for i in new_items), 2)
        total_gst = round(total_igst + total_cgst + total_sgst, 2)
        grand_total = round(total_taxable + total_gst, 2)

        await db.purchases.update_one(
            {"id": purchase["id"]},
            {"$set": {
                "items": new_items,
                "total_taxable": total_taxable,
                "total_igst": total_igst,
                "total_cgst": total_cgst,
                "total_sgst": total_sgst,
                "total_gst": total_gst,
                "total_amount": grand_total,
                "gst_amount": total_gst,
                "balance_due": grand_total - float(purchase.get("amount_paid") or 0),
                "totals": {
                    "grand_total": grand_total,
                    "taxable_value": total_taxable,
                    "total_gst": total_gst,
                },
            }},
        )
        repaired += 1
        print(f"  repaired {purchase.get('purchase_number')} ({len(new_items)} items, grand_total={grand_total})")

    print(f"\nDone. repaired={repaired}, skipped(already canonical)={skipped}")


if __name__ == "__main__":
    asyncio.run(main())

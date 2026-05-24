"""
Process the EBAY UP Amazon GST backlog: drive un-invoiced May-2026 Amazon orders
through the full CRM pipeline so each produces a GST sales invoice.

Per order:
  1. Scrape buyer PII off Seller Central (skipped if already captured).
  2. Generate reconciliation serials for manufactured items (EBAY UP holds none
     — the physical units shipped via Amazon weeks ago and were never recorded).
  3. POST /amazon/update-tracking      -> creates the pending_fulfillment entry
  4. PUT  /pending-fulfillment/{id}/mark-ready
  5. POST /pending-fulfillment/{id}/dispatch        (serials for manufactured)
  6. POST /dispatcher/dispatches/{id}/finalize      -> sales_invoice (the GST row)

The run is fully resumable: state is read from the pending_fulfillment entry,
so re-running picks each order up wherever it stopped. Every order's outcome is
written to the `amazon_backlog_run` collection for audit.

Usage:
  python3 process_amazon_backlog.py --dry-run            # list what would run
  python3 process_amazon_backlog.py --limit 5            # process 5 orders
  python3 process_amazon_backlog.py --order-ids a,b,c    # explicit orders
  python3 process_amazon_backlog.py                      # process the whole backlog
"""
import argparse
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/var/www/crm/backend/.env")

API = "http://127.0.0.1:8001/api"
# Defaults — overridable via CLI (--firm-id, --month). Originally hardcoded
# to EBAY UP / May-2026; left as defaults so existing invocations still work.
FIRM_ID = "a9b65de0-ef07-47d7-b778-2a9f63ef52ab"  # EBAY UP
FIRM_NAME = "EBAY UP"
MONTH_START = "2026-05-01"
MONTH_END = "2026-06-01"
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"
RECON_SOURCE = "amazon_gst_backlog_2026-05"

_db = None


def db():
    return _db


async def login() -> str:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        r.raise_for_status()
        return r.json()["access_token"]


async def select_backlog(limit=None, order_ids=None):
    """Backlog = May-2026 non-cancelled EBAY UP Amazon orders with no invoice yet."""
    invoiced = set()
    async for i in db().sales_invoices.find(
            {"firm_id": FIRM_ID, "marketplace_order_id": {"$exists": True, "$ne": None}},
            {"marketplace_order_id": 1}):
        invoiced.add(i["marketplace_order_id"])

    if order_ids:
        q = {"firm_id": FIRM_ID, "amazon_order_id": {"$in": order_ids}}
    else:
        q = {"firm_id": FIRM_ID,
             "purchase_date": {"$gte": MONTH_START, "$lt": MONTH_END},
             "crm_status": {"$ne": "cancelled"}}

    orders = []
    async for o in db().amazon_orders.find(q, {"_id": 0}):
        if o["amazon_order_id"] in invoiced:
            continue
        orders.append(o)
    orders.sort(key=lambda o: o["amazon_order_id"])
    if limit:
        orders = orders[:limit]
    return orders


async def check_unmapped(order):
    """Return list of Amazon SKUs in this order that have no master-SKU mapping."""
    unmapped = []
    for it in order.get("items", []):
        sk = it.get("amazon_sku") or it.get("seller_sku")
        if not sk:
            continue
        m = await db().amazon_sku_mappings.find_one({"firm_id": FIRM_ID, "amazon_sku": sk})
        if not m:
            unmapped.append(sk)
    return unmapped


async def resolve_items(order):
    """Enrich order items with master_sku doc; flag manufactured ones."""
    out = []
    for it in order.get("items", []):
        sk = it.get("amazon_sku") or it.get("seller_sku")
        m = await db().amazon_sku_mappings.find_one({"firm_id": FIRM_ID, "amazon_sku": sk})
        msid = (m or {}).get("master_sku_id") or it.get("master_sku_id")
        ms = await db().master_skus.find_one({"id": msid}, {"_id": 0}) if msid else None
        out.append({
            "amazon_sku": sk,
            "master_sku_id": msid,
            "master_sku": ms,
            "quantity": it.get("quantity") or 1,
            "is_manufactured": bool(ms and ms.get("product_type") == "manufactured"),
        })
    return out


async def ensure_serials(order_id, resolved):
    """Generate reconciliation serials for every manufactured unit in the order.

    Idempotent: reuses RECON serials already created for this order. Returns the
    serial-number list ordered to match the dispatch endpoint's item iteration.
    """
    now = datetime.now(timezone.utc).isoformat()
    serials = []
    for idx, item in enumerate(resolved):
        if not item["is_manufactured"]:
            continue
        ms = item["master_sku"]
        need = item["quantity"]
        existing = await db().finished_good_serials.find(
            {"recon_amazon_order_id": order_id, "master_sku_id": item["master_sku_id"],
             "status": "in_stock"},
            {"_id": 0, "serial_number": 1}).to_list(100)
        have = [e["serial_number"] for e in existing]
        for n in range(len(have), need):
            sn = f"RECON-{order_id}-{idx}-{n}"
            await db().finished_good_serials.update_one(
                {"serial_number": sn},
                {"$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "serial_number": sn,
                    "master_sku_id": item["master_sku_id"],
                    "master_sku_name": ms.get("name"),
                    "master_sku_code": ms.get("sku_code"),
                    "firm_id": FIRM_ID,
                    "firm_name": FIRM_NAME,
                    "status": "in_stock",
                    "manufactured_at": now,
                    "received_at": now,
                    "created_at": now,
                    "updated_at": now,
                    "notes": "Reconciliation serial - Amazon GST backlog May 2026",
                    "reconciliation": True,
                    "recon_source": RECON_SOURCE,
                    "recon_amazon_order_id": order_id,
                }},
                upsert=True,
            )
            have.append(sn)
        serials.extend(have[:need])
    return serials


def _has_items(o):
    its = o.get("items") or []
    return any((it.get("amazon_sku") or it.get("seller_sku")) for it in its)


async def process_order(client, headers, order):
    """Drive one order through the pipeline. Returns a result dict."""
    oid = order["amazon_order_id"]
    res = {"amazon_order_id": oid, "order_total": order.get("order_total"),
           "steps": [], "status": "ok", "error": None}

    order = await db().amazon_orders.find_one({"amazon_order_id": oid}, {"_id": 0})

    # ---- step 0: refresh line items if the sync never captured them ----
    if not _has_items(order):
        try:
            r = await client.post(
                f"{API}/amazon/refresh-order-items/{oid}?firm_id={FIRM_ID}",
                headers=headers, timeout=90)
        except Exception as e:
            res["status"] = "failed"
            res["error"] = f"refresh-items error: {e}"
            return res
        if r.status_code != 200:
            res["status"] = "failed"
            res["error"] = f"refresh-items HTTP {r.status_code}: {r.text[:200]}"
            return res
        res["steps"].append("items-refreshed")
        order = await db().amazon_orders.find_one({"amazon_order_id": oid}, {"_id": 0})
        if not _has_items(order):
            res["status"] = "skipped"
            res["error"] = "no line items even after refresh"
            return res

    # ---- guard: unmapped SKU ----
    unmapped = await check_unmapped(order)
    if unmapped:
        res["status"] = "skipped"
        res["error"] = f"unmapped SKU(s): {', '.join(unmapped)}"
        return res

    resolved = await resolve_items(order)
    if any(it["master_sku_id"] is None for it in resolved):
        res["status"] = "skipped"
        res["error"] = "item with no master_sku_id"
        return res

    # ---- resume point: existing pending_fulfillment ----
    pf = await db().pending_fulfillment.find_one({"amazon_order_id": oid}, {"_id": 0})
    # A PF left behind by a prior failed run (no resolvable SKU, not yet dispatched)
    # is unrecoverable in place — drop it so update-tracking can rebuild it cleanly.
    if pf and pf.get("status") in ("pending_dispatch", "collecting_info") \
            and not pf.get("master_sku_id") \
            and not any(i.get("master_sku_id") for i in (pf.get("items") or [])):
        await db().pending_fulfillment.delete_one({"id": pf["id"]})
        res["steps"].append("dropped-broken-pf")
        pf = None

    # ---- step 1: PII scrape (only if not captured and no PF yet) ----
    if not pf:
        fresh = await db().amazon_orders.find_one({"amazon_order_id": oid}, {"_id": 0})
        has_pii = bool(fresh.get("phone_manual") and fresh.get("city_manual"))
        if not has_pii:
            try:
                r = await client.post(
                    f"{API}/amazon/scrape-and-save-pii/{oid}?firm_id={FIRM_ID}",
                    headers=headers, timeout=120)
                if r.status_code != 200:
                    res["status"] = "failed"
                    res["error"] = f"scrape HTTP {r.status_code}: {r.text[:200]}"
                    return res
                res["steps"].append("scraped")
            except Exception as e:
                res["status"] = "failed"
                res["error"] = f"scrape error: {e}"
                return res
            fresh = await db().amazon_orders.find_one({"amazon_order_id": oid}, {"_id": 0})
            if fresh.get("crm_status") == "cancelled":
                res["status"] = "skipped"
                res["error"] = "cancelled on Amazon (detected during scrape)"
                return res
        else:
            res["steps"].append("pii-already-present")

    # ---- step 2: reconciliation serials ----
    serials = await ensure_serials(oid, resolved)
    if serials:
        res["steps"].append(f"serials:{len(serials)}")

    # ---- step 3: update-tracking -> pending_fulfillment ----
    if not pf:
        # Preserve real Amazon tracking if the auto-fill scrape already
        # captured it on the order. Only fall back to a synthetic
        # RECON-XXX label when no real tracking exists — otherwise we'd
        # overwrite Amazon's actual AWB with our reconciliation tag.
        fresh_for_tracking = await db().amazon_orders.find_one(
            {"amazon_order_id": oid},
            {"_id": 0, "tracking_number": 1, "carrier_code": 1},
        )
        real_tracking = (fresh_for_tracking or {}).get("tracking_number") or ""
        real_carrier  = (fresh_for_tracking or {}).get("carrier_code")  or ""
        body = {
            "amazon_order_id": oid,
            "tracking_number": real_tracking if real_tracking else f"RECON-{oid}",
            "carrier_code": real_carrier if real_carrier else "other",
            "is_history_order": True,
        }
        if real_tracking:
            res["steps"].append("tracking-preserved")
        r = await client.post(f"{API}/amazon/update-tracking?firm_id={FIRM_ID}",
                               headers=headers, json=body, timeout=60)
        if r.status_code != 200:
            res["status"] = "failed"
            res["error"] = f"update-tracking HTTP {r.status_code}: {r.text[:200]}"
            return res
        fid = r.json()["fulfillment_id"]
        res["steps"].append("tracking-added")
        pf = await db().pending_fulfillment.find_one({"id": fid}, {"_id": 0})
    fid = pf["id"]

    # ---- step 4: mark-ready ----
    if pf.get("status") in ("pending_dispatch", "collecting_info", "awaiting_stock", None):
        r = await client.put(f"{API}/pending-fulfillment/{fid}/mark-ready",
                              headers=headers, timeout=60)
        if r.status_code != 200 and "already ready" not in r.text.lower():
            res["status"] = "failed"
            res["error"] = f"mark-ready HTTP {r.status_code}: {r.text[:200]}"
            return res
        res["steps"].append("marked-ready")

    # ---- step 5: dispatch ----
    dispatch_id = pf.get("dispatch_id")
    if pf.get("status") != "dispatched" and not dispatch_id:
        form = {"notes": "Amazon GST backlog reconciliation"}
        if serials:
            form["serial_numbers"] = ",".join(serials)
        r = await client.post(f"{API}/pending-fulfillment/{fid}/dispatch",
                               headers=headers, data=form, timeout=90)
        if r.status_code != 200:
            res["status"] = "failed"
            res["error"] = f"dispatch HTTP {r.status_code}: {r.text[:200]}"
            return res
        dispatch_id = r.json()["dispatch_id"]
        res["steps"].append("dispatched")
    elif pf.get("status") == "dispatched":
        dispatch_id = pf.get("dispatch_id")

    # ---- step 6: finalize -> sales_invoice ----
    if dispatch_id:
        # Outward gate scan is required for normal dispatches (audit #3 fix,
        # commit 60c2aba). Backlog reconciliation orders shipped weeks ago
        # via Amazon — there's no scan event to wait for. Admin override
        # bypasses the gate gate with a documented reason.
        r = await client.post(
            # override_gate_scan is a query param (not Form); override_reason
            # and notes are form fields. Endpoint signature in server.py:9649.
            f"{API}/dispatcher/dispatches/{dispatch_id}/finalize?override_gate_scan=true",
            headers=headers,
            data={
                "notes": "Amazon GST backlog",
                "override_reason": "Amazon GST backlog reconciliation: order shipped via Amazon weeks ago, no gate scan exists",
            },
            timeout=90,
        )
        if r.status_code != 200:
            res["status"] = "failed"
            res["error"] = f"finalize HTTP {r.status_code}: {r.text[:200]}"
            return res
        res["steps"].append("finalized")

    # ---- verify invoice ----
    inv = await db().sales_invoices.find_one({"dispatch_id": dispatch_id}, {"_id": 0})
    if not inv:
        res["status"] = "failed"
        res["error"] = "finalize ok but no sales_invoice found"
        return res
    res["invoice_number"] = inv.get("invoice_number")
    res["invoice_date"] = inv.get("invoice_date")
    res["grand_total"] = inv.get("grand_total")
    res["taxable_value"] = inv.get("taxable_value")
    res["total_gst"] = inv.get("total_gst")
    res["dispatch_id"] = dispatch_id
    return res


async def main():
    global _db, FIRM_ID, FIRM_NAME, MONTH_START, MONTH_END, RECON_SOURCE
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--order-ids", type=str, default=None)
    ap.add_argument("--firm-id", type=str, default=None,
                    help="Target firm id (default: EBAY UP)")
    ap.add_argument("--month", type=str, default=None,
                    help="YYYY-MM window (default: 2026-05)")
    args = ap.parse_args()

    _db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

    if args.firm_id:
        FIRM_ID = args.firm_id
        firm_doc = await _db.firms.find_one({"id": FIRM_ID}, {"_id": 0, "name": 1})
        if not firm_doc:
            print(f"ERROR: firm_id {FIRM_ID} not found")
            return
        FIRM_NAME = firm_doc.get("name", FIRM_ID)

    if args.month:
        y, m = map(int, args.month.split("-"))
        MONTH_START = f"{y:04d}-{m:02d}-01"
        next_y, next_m = (y, m + 1) if m < 12 else (y + 1, 1)
        MONTH_END = f"{next_y:04d}-{next_m:02d}-01"
        RECON_SOURCE = f"amazon_gst_backlog_{args.month}"

    print(f"Firm: {FIRM_NAME} ({FIRM_ID})  Month: {MONTH_START} → {MONTH_END}  Recon: {RECON_SOURCE}")

    order_ids = [s.strip() for s in args.order_ids.split(",")] if args.order_ids else None
    orders = await select_backlog(limit=args.limit, order_ids=order_ids)

    print(f"Backlog selected: {len(orders)} orders")
    if args.dry_run:
        # order_total can be a plain number OR an SP-API dict {Amount, CurrencyCode}.
        def _num(v):
            if isinstance(v, dict):
                return float(v.get("Amount") or 0)
            try:
                return float(v or 0)
            except (TypeError, ValueError):
                return 0.0
        tot = sum(_num(o.get("order_total")) for o in orders)
        with_tracking = sum(1 for o in orders if (o.get("tracking_number") or "").strip())
        for o in orders[:20]:
            t = (o.get("tracking_number") or "").strip()
            tag = f"[trk: {t}]" if t else "[no-trk]"
            print(f"  {o['amazon_order_id']}  Rs {_num(o.get('order_total')):>10,.0f}  {o.get('crm_status'):<18} {tag}")
        if len(orders) > 20:
            print(f"  ... +{len(orders)-20} more")
        print(f"Total value: Rs {tot:,.0f}")
        print(f"Already have real tracking: {with_tracking}/{len(orders)} (will be preserved)")
        return

    token = await login()
    headers = {"Authorization": f"Bearer {token}"}
    run_id = str(uuid.uuid4())
    ok = failed = skipped = 0
    inv_total = 0.0

    async with httpx.AsyncClient() as client:
        for i, order in enumerate(orders, 1):
            try:
                res = await process_order(client, headers, order)
            except Exception as e:
                res = {"amazon_order_id": order["amazon_order_id"],
                       "status": "failed", "error": f"unhandled: {e}", "steps": []}
            res["run_id"] = run_id
            res["processed_at"] = datetime.now(timezone.utc).isoformat()
            await db().amazon_backlog_run.update_one(
                {"run_id": run_id, "amazon_order_id": res["amazon_order_id"]},
                {"$set": res}, upsert=True)

            if res["status"] == "ok":
                ok += 1
                inv_total += res.get("grand_total") or 0
                tag = f"INV {res.get('invoice_number')} Rs {res.get('grand_total')}"
            elif res["status"] == "skipped":
                skipped += 1
                tag = f"SKIP {res.get('error')}"
            else:
                failed += 1
                tag = f"FAIL {res.get('error')}"
            print(f"[{i}/{len(orders)}] {res['amazon_order_id']}  {tag}")

    print(f"\n=== run {run_id} ===")
    print(f"ok={ok}  failed={failed}  skipped={skipped}")
    print(f"invoiced value (grand_total sum): Rs {inv_total:,.0f}")


if __name__ == "__main__":
    asyncio.run(main())

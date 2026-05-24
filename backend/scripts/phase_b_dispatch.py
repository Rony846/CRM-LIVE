"""
Phase B: drive verified Amazon PF entries through mark-ready → dispatch → finalize.

Inputs:
  /tmp/phase_b_can.json    list of {pf_id, order_id, reason} that pre-flight passed
  /tmp/admin_jwt           admin JWT

Per PF:
  - Pre-allocate serial numbers FIFO from finished_good_serials for manufactured items.
  - Branch by current status:
      pending_dispatch    → PUT  /pending-fulfillment/{id}/mark-ready
                          → POST /pending-fulfillment/{id}/dispatch (serials)
                          → POST /dispatcher/dispatches/{dispatch_id}/finalize
      ready_to_dispatch   → POST /pending-fulfillment/{id}/dispatch (serials)
                          → POST /dispatcher/dispatches/{dispatch_id}/finalize
      in_dispatch_queue   → POST /dispatcher/dispatches/{dispatch_id}/finalize
  - 400s like "already ready", "already dispatched", "duplicate" are treated as OK.

Writes a row per PF to phase_b_results collection so the run is fully audit-traceable.
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
TOKEN = open("/tmp/admin_jwt").read().strip()
HDR = {"Authorization": f"Bearer {TOKEN}"}
RUN_TAG = "phaseB_2026-05-19"


async def allocate_serials_fifo(db):
    """Pre-walk the candidate list and pick concrete serial_numbers per PF for manufactured items."""
    candidates = json.loads(open("/tmp/phase_b_can.json").read())
    pf_ids = [c["pf_id"] for c in candidates]

    pf_docs = {d["id"]: d async for d in db.pending_fulfillment.find({"id": {"$in": pf_ids}}, {"_id": 0})}

    # Group demand by (sku, firm)
    sku_demand = {}  # (sku, firm) -> list of (pf_id, qty)
    for c in candidates:
        pf = pf_docs.get(c["pf_id"])
        if not pf:
            continue
        items = pf.get("items") or (
            [{"master_sku_id": pf["master_sku_id"], "quantity": pf.get("quantity", 1)}]
            if pf.get("master_sku_id")
            else []
        )
        for it in items:
            sid = it.get("master_sku_id")
            qty = it.get("quantity", 1)
            if not sid:
                continue
            key = (sid, pf.get("firm_id"))
            sku_demand.setdefault(key, []).append((c["pf_id"], qty))

    # For each (sku, firm), check if manufactured and pull serials FIFO
    pf_serials = {}  # pf_id -> [serial_number, ...]
    for (sid, firm), demand in sku_demand.items():
        master = await db.master_skus.find_one({"id": sid}, {"_id": 0, "product_type": 1})
        if not master or master.get("product_type") != "manufactured":
            continue
        total_needed = sum(q for _, q in demand)
        serials = await (
            db.finished_good_serials.find(
                {"master_sku_id": sid, "firm_id": firm, "status": "in_stock"},
                {"_id": 0, "serial_number": 1, "created_at": 1},
            )
            .sort("created_at", 1)
            .to_list(total_needed)
        )
        serial_list = [s["serial_number"] for s in serials]
        idx = 0
        for pf_id, qty in demand:
            pf_serials.setdefault(pf_id, []).extend(serial_list[idx : idx + qty])
            idx += qty

    return candidates, pf_docs, pf_serials


def is_ok_409(status_code: int, text: str) -> bool:
    """Treat 'already in this state' responses as idempotent success."""
    if status_code in (200, 201):
        return True
    if status_code == 400 and any(
        s in text.lower()
        for s in (
            "already ready",
            "already dispatched",
            "already in",
            "duplicate",
            "in_dispatch_queue",
        )
    ):
        return True
    return False


async def run_one(client: httpx.AsyncClient, pf, serials):
    pf_id = pf["id"]
    order_id = pf.get("amazon_order_id") or pf.get("order_id")
    status = pf.get("status")
    result = {
        "pf_id": pf_id,
        "amazon_order_id": order_id,
        "started_status": status,
        "steps": [],
        "ok": False,
        "error": None,
        "dispatch_id": pf.get("dispatch_id"),
    }

    # 1. mark-ready (only if currently pending_dispatch)
    if status == "pending_dispatch":
        r = await client.put(
            f"{API}/pending-fulfillment/{pf_id}/mark-ready", headers=HDR, timeout=30.0
        )
        result["steps"].append({"step": "mark_ready", "status": r.status_code, "text": r.text[:200]})
        if not is_ok_409(r.status_code, r.text):
            result["error"] = f"mark-ready failed: {r.text[:200]}"
            return result

    # 2. dispatch (only if NOT yet in dispatch queue)
    if status != "in_dispatch_queue":
        files_form = {}
        data = {}
        if serials:
            data["serial_numbers"] = ",".join(serials)
        data["notes"] = f"Phase B batch auto-dispatch | run_tag={RUN_TAG}"
        r = await client.post(
            f"{API}/pending-fulfillment/{pf_id}/dispatch",
            data=data,
            headers=HDR,
            timeout=60.0,
        )
        result["steps"].append({"step": "dispatch", "status": r.status_code, "text": r.text[:200]})
        if not is_ok_409(r.status_code, r.text):
            result["error"] = f"dispatch failed: {r.text[:200]}"
            return result
        try:
            body = r.json()
            result["dispatch_id"] = body.get("dispatch_id") or result["dispatch_id"]
        except Exception:
            pass

    dispatch_id = result["dispatch_id"]
    if not dispatch_id:
        # Try to find it from PF (in case status was already in_dispatch_queue)
        pass

    # 3. finalize
    if not dispatch_id:
        result["error"] = "no dispatch_id available"
        return result
    r = await client.post(
        f"{API}/dispatcher/dispatches/{dispatch_id}/finalize",
        data={"notes": f"Phase B batch finalize | run_tag={RUN_TAG}"},
        headers=HDR,
        timeout=60.0,
    )
    result["steps"].append({"step": "finalize", "status": r.status_code, "text": r.text[:200]})
    if not is_ok_409(r.status_code, r.text):
        result["error"] = f"finalize failed: {r.text[:200]}"
        return result

    result["ok"] = True
    return result


async def main():
    db_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = db_client[os.environ["DB_NAME"]]

    candidates, pf_docs, pf_serials = await allocate_serials_fifo(db)
    total = len(candidates)
    print(f"PHASE B START n={total}", flush=True)
    succeeded = 0
    failed = 0

    async with httpx.AsyncClient() as client:
        for i, c in enumerate(candidates, 1):
            pf = pf_docs.get(c["pf_id"])
            if not pf:
                failed += 1
                continue
            serials = pf_serials.get(c["pf_id"], [])
            try:
                res = await run_one(client, pf, serials)
            except Exception as e:
                res = {
                    "pf_id": c["pf_id"],
                    "amazon_order_id": pf.get("amazon_order_id"),
                    "ok": False,
                    "error": f"exception: {e}",
                }
            res["run_tag"] = RUN_TAG
            res["timestamp"] = datetime.now(timezone.utc).isoformat()
            res["id"] = str(uuid.uuid4())
            await db.phase_b_results.insert_one(res)
            if res.get("ok"):
                succeeded += 1
            else:
                failed += 1
                print(f"  FAIL [{i}/{total}] {res.get('amazon_order_id')}: {res.get('error')}", flush=True)
            if i % 5 == 0 or i == total:
                print(f"  [{i}/{total}] ok={succeeded} fail={failed}", flush=True)

    print(f"PHASE B DONE total={total} ok={succeeded} fail={failed}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())

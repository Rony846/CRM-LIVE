"""Shared split-dispatch classifier — used by both server.py and the Amazon browser-agent so the
inverter→technician / battery+rest→supervisor logic stays in ONE place.

A parcel's INVERTER lines go to the technician (service_agent); the BATTERY + everything else
(stabilizer/solar/spare/unmapped) go to the supervisor. Classification is by master_skus.category.
"""
import os

SPLIT_DISPATCH_ENABLED = (os.environ.get("SPLIT_DISPATCH_ENABLED", "true").lower() == "true")
SPLIT_INVERTER_ROLE = "service_agent"   # technician dispatches the inverter
SPLIT_REST_ROLE = "supervisor"          # supervisor dispatches the battery + everything else
SPLIT_STATUS_AWAITING = "awaiting_dispatch_tasks"


async def classify_dispatch_split(db, items: list):
    """Group items into an INVERTER task (technician) and a REST task (supervisor) by
    master_skus.category. Returns (split_tasks, present). Items with no SKU/category fall to rest."""
    if not SPLIT_DISPATCH_ENABLED or not items:
        return [], False
    sku_ids = [it.get("master_sku_id") for it in items if it.get("master_sku_id")]
    cat_by_id = {}
    if sku_ids:
        async for s in db.master_skus.find({"id": {"$in": sku_ids}}, {"id": 1, "category": 1}):
            cat_by_id[s["id"]] = (s.get("category") or "").strip().lower()
    inv_idx, rest_idx = [], []
    for i, it in enumerate(items):
        cat = cat_by_id.get(it.get("master_sku_id"), "")
        (inv_idx if "inverter" in cat else rest_idx).append(i)
    tasks = []
    if inv_idx:
        tasks.append({"group": "inverter", "label": "Inverter", "role": SPLIT_INVERTER_ROLE,
                      "item_indexes": inv_idx, "status": "pending",
                      "completed_by": None, "completed_by_name": None, "completed_at": None})
    if rest_idx:
        tasks.append({"group": "rest", "label": "Battery & other", "role": SPLIT_REST_ROLE,
                      "item_indexes": rest_idx, "status": "pending",
                      "completed_by": None, "completed_by_name": None, "completed_at": None})
    return tasks, bool(tasks)

"""Shared split-dispatch classifier — used by both server.py and the Amazon browser-agent so the
inverter→technician / battery+rest→supervisor logic stays in ONE place.

A parcel's INVERTER lines go to the technician (service_agent); the BATTERY + everything else
(stabilizer/solar/spare/unmapped) go to the supervisor. Classification is by master_skus.category.
"""
import os

SPLIT_DISPATCH_ENABLED = (os.environ.get("SPLIT_DISPATCH_ENABLED", "true").lower() == "true")
# Phase-1 make-to-order fulfilment (combo→both, serial-at-dispatch, BOM consume). OFF until the
# whole new flow is built + the founder flips it, so production behaviour is unchanged meanwhile.
FULFILLMENT_V2 = (os.environ.get("FULFILLMENT_V2", "false").lower() == "true")
SPLIT_INVERTER_ROLE = "service_agent"   # technician dispatches the inverter
SPLIT_REST_ROLE = "supervisor"          # supervisor dispatches the battery + everything else
SPLIT_STATUS_AWAITING = "awaiting_dispatch_tasks"


def item_class(cat, ptype):
    """Derive (is_inverter, is_combo, is_manufactured) from a SKU's category + product_type.
    Make-to-order model: inverters & batteries are manufactured (need a serial at dispatch);
    stabilizers / solar / spares are traded (no serial). Combo = one bundle that needs BOTH an
    inverter half (technician/Gaurav) and a battery half (supervisor/Angad)."""
    cat = (cat or "").strip().lower()
    ptype = (ptype or "").strip().lower()
    is_combo = "combo" in cat
    is_inverter = "inverter" in cat
    is_manufactured = (ptype == "manufactured") or is_inverter or ("battery" in cat)
    return is_inverter, is_combo, is_manufactured


async def classify_dispatch_split(db, items: list):
    """Group items into an INVERTER task (technician/Gaurav) and a REST task (supervisor/Angad) by
    master_skus.category. A COMBO line goes to BOTH. Each task also carries `serial_indexes` — the
    item indexes that are manufactured make-to-order and therefore need a serial captured when that
    owner marks the task dispatched. Returns (split_tasks, present)."""
    if not SPLIT_DISPATCH_ENABLED or not items:
        return [], False
    sku_ids = [it.get("master_sku_id") for it in items if it.get("master_sku_id")]
    meta = {}
    if sku_ids:
        async for s in db.master_skus.find({"id": {"$in": sku_ids}}, {"id": 1, "category": 1, "product_type": 1}):
            meta[s["id"]] = (s.get("category"), s.get("product_type"))
    inv_idx, rest_idx, serial_set = [], [], set()
    for i, it in enumerate(items):
        cat, ptype = meta.get(it.get("master_sku_id"), ("", ""))
        is_inverter, is_combo, is_manufactured = item_class(cat, ptype)
        if is_combo and FULFILLMENT_V2:
            inv_idx.append(i); rest_idx.append(i)          # both owners handle their half (V2)
        elif is_inverter:
            inv_idx.append(i)
        else:
            rest_idx.append(i)                             # combo falls here pre-V2 (old behaviour)
        if is_manufactured or is_combo:
            serial_set.add(i)

    def _serial_items(idxs):
        """Self-contained list of the manufactured lines in a task that need a serial at dispatch —
        so the completion step never has to re-index back into the dispatch's items."""
        out = []
        for i in idxs:
            if i not in serial_set:
                continue
            it = items[i]
            out.append({"master_sku_id": it.get("master_sku_id"),
                        "product_name": it.get("product_name") or it.get("master_sku_name") or it.get("title"),
                        "sku": it.get("sku") or it.get("master_sku_code"),
                        "quantity": int(it.get("quantity") or 1)})
        return out

    tasks = []
    if inv_idx:
        tasks.append({"group": "inverter", "label": "Inverter", "role": SPLIT_INVERTER_ROLE,
                      "item_indexes": inv_idx, "serial_indexes": [i for i in inv_idx if i in serial_set],
                      "serial_items": _serial_items(inv_idx),
                      "status": "pending", "completed_by": None, "completed_by_name": None, "completed_at": None})
    if rest_idx:
        tasks.append({"group": "rest", "label": "Battery & other", "role": SPLIT_REST_ROLE,
                      "item_indexes": rest_idx, "serial_indexes": [i for i in rest_idx if i in serial_set],
                      "serial_items": _serial_items(rest_idx),
                      "status": "pending", "completed_by": None, "completed_by_name": None, "completed_at": None})
    return tasks, bool(tasks)

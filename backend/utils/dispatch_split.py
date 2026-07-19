"""Shared split-dispatch classifier — used by both server.py and the Amazon browser-agent so the
inverter→technician / battery+rest→supervisor logic stays in ONE place.

A parcel's INVERTER lines go to the technician (service_agent); the BATTERY + everything else
(stabilizer/solar/spare/unmapped) go to the supervisor. Classification is by master_skus.category.
"""
import os
import re

SPLIT_DISPATCH_ENABLED = (os.environ.get("SPLIT_DISPATCH_ENABLED", "true").lower() == "true")
# Phase-1 make-to-order fulfilment (combo→both, serial-at-dispatch, BOM consume). OFF until the
# whole new flow is built + the founder flips it, so production behaviour is unchanged meanwhile.
FULFILLMENT_V2 = (os.environ.get("FULFILLMENT_V2", "false").strip().lower() in ("1", "true", "yes", "on"))
SPLIT_INVERTER_ROLE = "service_agent"   # technician dispatches the inverter
SPLIT_REST_ROLE = "supervisor"          # supervisor dispatches the battery + everything else
SPLIT_STATUS_AWAITING = "awaiting_dispatch_tasks"


def rest_label(cats):
    """Human label for the supervisor's 'rest' task, built from the ACTUAL categories it holds
    (e.g. 'Battery + Stabilizer', 'Stabilizer', 'Battery + Solar') so it never mis-reads as just
    'Battery'. Unmapped / other lines show as 'Accessories'; empty falls back to an explicit
    catch-all. The supervisor dispatches EVERYTHING that isn't the inverter."""
    cls = [(c or "").strip().lower() for c in cats]
    present = [disp for key, disp in (("battery", "Battery"), ("stabilizer", "Stabilizer"), ("solar", "Solar"))
               if any(key in c for c in cls)]
    known = ("battery", "stabilizer", "solar", "inverter")
    if any((not c) or not any(k in c for k in known) for c in cls):
        present.append("Accessories")
    return " + ".join(present) if present else "Battery, Stabilizer & Rest"


def item_class(cat, ptype, name=""):
    """Derive (is_inverter, is_combo, is_manufactured) from a SKU's category + product_type (+ name).
    Make-to-order model: inverters & batteries are manufactured (need a serial at dispatch);
    stabilizers / solar / spares are traded (no serial). Combo = one bundle that needs BOTH an
    inverter half (technician/Gaurav) and a battery half (supervisor/Angad).

    Routing is by category, but MANY inverter SKUs have a blank/loose category (e.g. '6.2 kW True Hybrid
    Solar Inverter' with category unset) and were silently falling to the supervisor (Angad). So when the
    category doesn't decide it, fall back to product_type / NAME — BUT an explicit battery / stabilizer /
    solar-panel / spare category is authoritative and never re-read as an inverter, even if its name says
    'inverter' (e.g. a lithium 'Solar Inverter Battery' stays with the supervisor)."""
    cat = (cat or "").strip().lower()
    ptype = (ptype or "").strip().lower()
    name = (name or "").strip().lower()
    explicit_other = any(k in cat for k in ("battery", "stabilizer", "solar panel", "spare", "accessor"))
    # A battery's name often mentions 'inverter' ("Lithium Battery for Solar Inverter") — so when falling
    # back to the name, treat any battery signal (battery/lithium/LiFePO4/cells/'…Ah') as NOT an inverter.
    name_battery = any(k in name for k in ("battery", "lifepo4", "lifepo", "lithium", "cells")) \
        or bool(re.search(r"\d+\s*ah\b", name))
    # Stabilizers are rated in kVA and usually say 'stabilizer'/'servo' — NEVER an inverter, even if the
    # name also carries a kW-ish token. Checked before the inverter signals so kVA can't be mis-read.
    name_stabilizer = ("stabilizer" in name) or ("servo" in name) or bool(re.search(r"\d+\s*kva\b", name))
    # Inverter naming frequently OMITS the word 'inverter' — the Bigship panel abbreviates to things like
    # 'MG 6.2KW TRUE HYBRID' or 'Focus 5kW … MPPT'. So treat 'hybrid'/'mppt' and a kW power rating as
    # inverter signals too (stabilizers are kVA, batteries are Ah/V — both already guarded above).
    name_inverter = (("inverter" in name) or ("mppt" in name) or ("hybrid" in name)
                     or bool(re.search(r"\d+(?:\.\d+)?\s*kw\b", name))) and not name_stabilizer
    is_combo = ("combo" in cat) or (("combo" in name) and not explicit_other)
    is_inverter = ("inverter" in cat) or (
        not explicit_other and not name_battery and not name_stabilizer
        and (ptype == "inverter" or name_inverter))
    is_manufactured = (ptype == "manufactured") or is_inverter or ("battery" in cat) or name_battery
    return is_inverter, is_combo, is_manufactured


async def classify_dispatch_split(db, items: list, category_override: str = None):
    """Group items into an INVERTER task (technician/Gaurav) and a REST task (supervisor/Angad) by
    master_skus.category. A COMBO line goes to BOTH. Each task also carries `serial_indexes` — the
    item indexes that are manufactured make-to-order and therefore need a serial captured when that
    owner marks the task dispatched. `category_override` (inverter|battery|stabilizer|combo) is the
    accountant's explicit Ship-Desk pick and forces the routing + serial requirement for all lines.
    Returns (split_tasks, present)."""
    if not SPLIT_DISPATCH_ENABLED or not items:
        return [], False
    sku_ids = [it.get("master_sku_id") for it in items if it.get("master_sku_id")]
    meta = {}
    if sku_ids:
        async for s in db.master_skus.find({"id": {"$in": sku_ids}}, {"id": 1, "category": 1, "product_type": 1, "name": 1}):
            meta[s["id"]] = (s.get("category"), s.get("product_type"), s.get("name"))
    ov = (category_override or "").strip().lower()
    inv_idx, rest_idx, serial_set = [], [], set()
    for i, it in enumerate(items):
        cat, ptype, nm = meta.get(it.get("master_sku_id"), ("", "", ""))
        # fall back to the line's own name if the SKU record has none (free-text ship-desk lines)
        nm = nm or it.get("product_name") or it.get("master_sku_name") or it.get("title") or ""
        is_inverter, is_combo, is_manufactured = item_class(cat, ptype, nm)
        if ov:                                             # accountant Ship-Desk override
            if ov == "inverter":
                inv_idx.append(i); serial_set.add(i)
            elif ov == "combo":
                inv_idx.append(i); rest_idx.append(i); serial_set.add(i)
            elif ov == "battery":
                rest_idx.append(i); serial_set.add(i)
            else:                                          # stabilizer / traded / other → Angad, no serial
                rest_idx.append(i)
            continue
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
        _rest_cats = [meta.get(items[i].get("master_sku_id"), ("", ""))[0] for i in rest_idx]
        tasks.append({"group": "rest", "label": rest_label(_rest_cats), "role": SPLIT_REST_ROLE,
                      "item_indexes": rest_idx, "serial_indexes": [i for i in rest_idx if i in serial_set],
                      "serial_items": _serial_items(rest_idx),
                      "status": "pending", "completed_by": None, "completed_by_name": None, "completed_at": None})
    return tasks, bool(tasks)

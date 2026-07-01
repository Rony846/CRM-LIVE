"""Shiprocket API client — read access to shipments the CRM is otherwise blind to.

Why: PCBs / replacements are sometimes dispatched via Shiprocket (Shopify orders carry
Fastrr/Shiprocket `SR_*` tags), but the CRM only ever recorded Bigship. That blind spot
made ~224 hardware tickets look abandoned when some may actually be resolved-via-Shiprocket.
This client lets us pull Shiprocket orders/shipments in so we can reconcile.

Pure API client (auth + fetch + track). The DB sync + reconcile + endpoints live in
server.py (where `db` is), mirroring how Bigship is wired. OFF until SHIPROCKET_EMAIL /
SHIPROCKET_PASSWORD are set in .env — every entrypoint fails safe (returns empty / False)
so nothing breaks while it's unconfigured.

Shiprocket auth: POST /auth/login {email,password} -> token valid ~10 days. We cache it and
refresh on expiry or a 401.
"""
import os
import logging
from datetime import datetime, timezone, timedelta

import httpx

logger = logging.getLogger(__name__)

SHIPROCKET_API_URL = os.environ.get("SHIPROCKET_API_URL", "https://apiv2.shiprocket.in/v1/external").rstrip("/")

_token_cache = {"token": None, "expires_at": None}


def enabled() -> bool:
    return bool(os.environ.get("SHIPROCKET_EMAIL", "").strip()
               and os.environ.get("SHIPROCKET_PASSWORD", "").strip())


async def get_token(force: bool = False) -> str | None:
    """Return a cached Shiprocket token, logging in if needed. None if not configured."""
    if not enabled():
        return None
    now = datetime.now(timezone.utc)
    if not force and _token_cache["token"] and _token_cache["expires_at"] and now < _token_cache["expires_at"]:
        return _token_cache["token"]
    try:
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(f"{SHIPROCKET_API_URL}/auth/login", json={
                "email": os.environ["SHIPROCKET_EMAIL"].strip(),
                "password": os.environ["SHIPROCKET_PASSWORD"].strip(),
            })
        r.raise_for_status()
        tok = r.json().get("token")
        if not tok:
            logger.error("Shiprocket login returned no token: %s", str(r.text)[:200])
            return None
        _token_cache["token"] = tok
        _token_cache["expires_at"] = now + timedelta(days=9)  # token lives ~10d; refresh early
        return tok
    except Exception as e:
        logger.error("Shiprocket login failed: %s", e)
        return None


async def _get(path: str, params: dict | None = None) -> dict | None:
    """Authed GET with one 401-retry (token re-login)."""
    if not enabled():
        return None
    for attempt in (1, 2):
        token = await get_token(force=(attempt == 2))
        if not token:
            return None
        try:
            async with httpx.AsyncClient(timeout=45.0) as c:
                r = await c.get(f"{SHIPROCKET_API_URL}{path}", params=params or {},
                                headers={"Authorization": f"Bearer {token}"})
            if r.status_code == 401 and attempt == 1:
                continue  # token expired → re-login and retry once
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if attempt == 2:
                logger.error("Shiprocket GET %s failed: %s", path, e)
            # else loop to retry with a fresh token
    return None


async def fetch_orders(page: int = 1, per_page: int = 50, **filters) -> list:
    """One page of Shiprocket orders (each carries customer, products, AWB, status).
    Optional filters: from/to (YYYY-MM-DD), search, etc. Returns [] on failure."""
    params = {"page": page, "per_page": per_page, **filters}
    data = await _get("/orders", params)
    if not data:
        return []
    return data.get("data") or []


async def fetch_orders_meta(per_page: int = 50, **filters) -> dict:
    """Return Shiprocket's pagination meta for /orders (total, last_page) so the sync
    knows how many pages to walk."""
    data = await _get("/orders", {"page": 1, "per_page": per_page, **filters})
    if not data:
        return {}
    return data.get("meta", {}).get("pagination", {}) or {}


async def track_awb(awb: str) -> dict | None:
    """Live tracking for one AWB."""
    if not awb:
        return None
    return await _get(f"/courier/track/awb/{awb}")


async def _post(path: str, body: dict) -> dict | None:
    """Authed POST with one 401-retry. Returns {"status", "data"} or None."""
    if not enabled():
        return None
    for attempt in (1, 2):
        token = await get_token(force=(attempt == 2))
        if not token:
            return None
        try:
            async with httpx.AsyncClient(timeout=60.0) as c:
                r = await c.post(f"{SHIPROCKET_API_URL}{path}", json=body,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
            if r.status_code == 401 and attempt == 1:
                continue
            try:
                data = r.json()
            except Exception:
                data = {"raw": str(r.text)[:400]}
            return {"status": r.status_code, "data": data}
        except Exception as e:
            if attempt == 2:
                logger.error("Shiprocket POST %s failed: %s", path, e)
    return None


async def pickup_locations() -> list:
    """The pickup-location nicknames registered on the SR account (needed to create an order)."""
    d = await _get("/settings/company/pickup")
    if not d:
        return []
    addrs = (d.get("data") or {}).get("shipping_address") or d.get("shipping_address") or []
    return [{"name": a.get("pickup_location"), "city": a.get("city"), "pincode": a.get("pin_code")} for a in addrs]


async def create_shipment(*, order_id, first_name, last_name, phone, address, city, state, pincode,
                          product_name, sku, qty, unit_price, weight_kg, length_cm, width_cm, height_cm,
                          payment_method="Prepaid", order_date, pickup_location=None) -> dict:
    """Create an adhoc SR order → assign AWB (recommended courier) → generate label.
    Returns {ok, awb, courier, label_url, order_id, shipment_id, error}. Never raises."""
    if not enabled():
        return {"ok": False, "error": "shiprocket_not_configured"}
    pickup = pickup_location or os.environ.get("SHIPROCKET_PICKUP_LOCATION", "").strip()
    if not pickup:
        locs = await pickup_locations()
        meerut = next((l for l in locs if str(l.get("city", "")).lower().startswith("meerut")), None)
        pickup = (meerut or (locs[0] if locs else {})).get("name")
    if not pickup:
        return {"ok": False, "error": "no_pickup_location"}
    sub_total = round(float(unit_price) * int(qty), 2)
    body = {
        "order_id": str(order_id), "order_date": order_date, "pickup_location": pickup,
        "billing_customer_name": first_name, "billing_last_name": last_name or first_name,
        "billing_address": address, "billing_city": city, "billing_pincode": pincode,
        "billing_state": state, "billing_country": "India", "billing_email": "",
        "billing_phone": phone, "shipping_is_billing": True,
        "order_items": [{"name": product_name[:100], "sku": (sku or product_name)[:50],
                         "units": int(qty), "selling_price": float(unit_price)}],
        "payment_method": "COD" if str(payment_method).upper() == "COD" else "Prepaid",
        "sub_total": sub_total, "length": length_cm, "breadth": width_cm, "height": height_cm,
        "weight": weight_kg,
    }
    resp = await _post("/orders/create/adhoc", body)
    if not resp or resp.get("status", 500) >= 400:
        return {"ok": False, "error": (resp or {}).get("data", "create_failed")}
    d = resp["data"] or {}
    ship_id = d.get("shipment_id")
    sr_oid = d.get("order_id")
    if not ship_id:
        return {"ok": False, "error": d}
    # assign AWB (recommended courier)
    awb = courier = None
    aw = await _post("/courier/assign/awb", {"shipment_id": ship_id})
    if aw and aw.get("status", 500) < 400:
        node = (aw["data"].get("response") or {}).get("data") or aw["data"].get("data") or aw["data"]
        if isinstance(node, dict):
            awb = node.get("awb_code")
            courier = node.get("courier_name")
    # generate label (best-effort)
    label = None
    lb = await _post("/courier/generate/label", {"shipment_id": [ship_id]})
    if lb and lb.get("status", 500) < 400:
        label = (lb["data"] or {}).get("label_url")
    return {"ok": bool(awb), "awb": awb, "courier": courier, "label_url": label,
            "order_id": sr_oid, "shipment_id": ship_id,
            "error": None if awb else "awb_not_assigned"}

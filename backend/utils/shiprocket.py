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

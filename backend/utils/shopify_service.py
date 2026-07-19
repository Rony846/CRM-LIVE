"""Shopify Admin API integration — pull orders + customers into the CRM.

Real-time capture is via webhooks (HMAC-verified in server.py); this module provides the
Admin-API client used for the nightly reconcile + manual backfill, the HMAC verifier, the
webhook registrar, and the order normaliser.

Config via env (integration is OFF until SHOPIFY_STORE + SHOPIFY_ADMIN_TOKEN are set):
  SHOPIFY_STORE          e.g. musclegrid.myshopify.com  (the *.myshopify.com domain)
  SHOPIFY_ADMIN_TOKEN    Admin API access token from a custom app (shpat_...)
  SHOPIFY_API_VERSION    e.g. 2024-10 (default)
  SHOPIFY_WEBHOOK_SECRET the custom app's API secret key (HMAC-verifies inbound webhooks)
  SHOPIFY_DEFAULT_FIRM_ID firm to attribute Shopify orders to (optional)
"""
import os
import hmac
import hashlib
import base64
import logging

import httpx

logger = logging.getLogger(__name__)

DEFAULT_TOPICS = ["orders/create", "orders/updated", "orders/paid", "orders/cancelled", "orders/fulfilled"]


# Multi-store: each store key maps to an env prefix. "in" = the original India store (SHOPIFY_*),
# "hk" = MuscleGrid Industries HK Limited (SHOPIFY_HK_*). Add a new store here + its *_STORE/*_ADMIN_TOKEN
# env vars and it flows through the webhook router, reconcile loop, and registrar automatically.
STORE_ENV = {"in": "SHOPIFY", "hk": "SHOPIFY_HK"}
DEFAULT_STORE = "in"


def cfg(store: str = DEFAULT_STORE) -> dict:
    p = STORE_ENV.get(store, "SHOPIFY")
    dom = (os.environ.get(f"{p}_STORE", "") or "").strip()
    dom = dom.replace("https://", "").replace("http://", "").strip("/")
    # Webhooks from a custom app are HMAC-signed with the app's API secret key. India has a dedicated
    # SHOPIFY_WEBHOOK_SECRET; other stores fall back to their *_CLIENT_SECRET (the app secret).
    wsecret = ((os.environ.get(f"{p}_WEBHOOK_SECRET", "") or "").strip()
               or (os.environ.get(f"{p}_CLIENT_SECRET", "") or "").strip())
    return {
        "store_key": store,
        "store": dom,
        "token": (os.environ.get(f"{p}_ADMIN_TOKEN", "") or "").strip(),
        "api_version": (os.environ.get(f"{p}_API_VERSION", "") or "").strip() or "2024-10",
        "webhook_secret": wsecret,
        "default_firm_id": (os.environ.get(f"{p}_DEFAULT_FIRM_ID", "") or "").strip() or None,
    }


def is_configured(store: str = DEFAULT_STORE) -> bool:
    c = cfg(store)
    return bool(c["store"] and c["token"])


def configured_stores() -> list:
    """Store keys that have both a domain and an admin token set (ready for live sync)."""
    return [s for s in STORE_ENV if is_configured(s)]


def store_for_domain(domain: str):
    """Map an inbound X-Shopify-Shop-Domain to its store key (None if unknown)."""
    d = (domain or "").strip().lower()
    if not d:
        return None
    for s in STORE_ENV:
        if cfg(s)["store"].lower() == d:
            return s
    return None


def _base(store: str = DEFAULT_STORE) -> str:
    c = cfg(store)
    return f"https://{c['store']}/admin/api/{c['api_version']}"


def _headers(store: str = DEFAULT_STORE) -> dict:
    return {"X-Shopify-Access-Token": cfg(store)["token"], "Content-Type": "application/json"}


def verify_webhook(raw_body: bytes, hmac_header: str, store: str = DEFAULT_STORE) -> bool:
    """Verify the X-Shopify-Hmac-Sha256 header against the raw request body (per-store secret)."""
    secret = cfg(store)["webhook_secret"]
    if not secret or not hmac_header:
        return False
    digest = hmac.new(secret.encode("utf-8"), raw_body or b"", hashlib.sha256).digest()
    computed = base64.b64encode(digest).decode()
    return hmac.compare_digest(computed, hmac_header)


async def fetch_orders(updated_at_min=None, status="any", limit=250, store: str = DEFAULT_STORE) -> list:
    """Pull orders via the Admin API, following Link-header cursor pagination."""
    if not is_configured(store):
        return []
    params = {"status": status, "limit": min(int(limit), 250)}
    if updated_at_min:
        params["updated_at_min"] = updated_at_min
    url = f"{_base(store)}/orders.json"
    out = []
    async with httpx.AsyncClient(timeout=60) as client:
        while url:
            r = await client.get(url, headers=_headers(store), params=params)
            r.raise_for_status()
            out.extend(r.json().get("orders", []))
            # Cursor pagination: the next page URL is in the Link header (rel="next").
            link = r.headers.get("Link") or r.headers.get("link") or ""
            nxt = None
            for part in link.split(","):
                if 'rel="next"' in part and "<" in part and ">" in part:
                    nxt = part[part.find("<") + 1:part.find(">")]
            url, params = nxt, None  # page_info travels in the next URL itself
    return out


async def register_webhooks(callback_url: str, topics=None, store: str = DEFAULT_STORE) -> dict:
    """Idempotently register the order webhooks to point at the CRM callback URL."""
    if not is_configured(store):
        return {"error": "not configured"}
    topics = topics or DEFAULT_TOPICS
    results = {}
    async with httpx.AsyncClient(timeout=60) as client:
        existing = (await client.get(f"{_base(store)}/webhooks.json", headers=_headers(store))).json().get("webhooks", [])
        have = {(w.get("topic"), w.get("address")) for w in existing}
        for t in topics:
            if (t, callback_url) in have:
                results[t] = "exists"
                continue
            r = await client.post(f"{_base(store)}/webhooks.json", headers=_headers(store),
                                  json={"webhook": {"topic": t, "address": callback_url, "format": "json"}})
            results[t] = "created" if r.status_code in (200, 201) else f"err {r.status_code}: {r.text[:140]}"
    return results


def normalize_order(o: dict) -> dict:
    """Map a Shopify order payload to the CRM's `shopify_orders` shape."""
    cust = o.get("customer") or {}
    ship = o.get("shipping_address") or {}
    bill = o.get("billing_address") or {}
    addr = ship or bill
    phone = (o.get("phone") or addr.get("phone") or cust.get("phone") or "").strip()
    name = " ".join(x for x in [addr.get("first_name") or cust.get("first_name"),
                                addr.get("last_name") or cust.get("last_name")] if x).strip()
    items = [{
        "title": li.get("title"), "sku": li.get("sku"), "variant": li.get("variant_title"),
        "quantity": li.get("quantity"), "price": float(li.get("price") or 0),
    } for li in (o.get("line_items") or [])]
    return {
        "shopify_order_id": str(o.get("id")) if o.get("id") is not None else None,
        "order_number": o.get("name") or (f"#{o.get('order_number')}" if o.get("order_number") else None),
        "email": o.get("email") or cust.get("email"),
        "phone": phone,
        "customer_name": name or (o.get("email") or "Shopify Customer"),
        "financial_status": o.get("financial_status"),
        "fulfillment_status": o.get("fulfillment_status"),
        "currency": o.get("currency"),
        "total_price": float(o.get("total_price") or 0),
        "subtotal_price": float(o.get("subtotal_price") or 0),
        "total_tax": float(o.get("total_tax") or 0),
        "line_items": items,
        "shipping_address": {
            "address1": addr.get("address1"), "address2": addr.get("address2"),
            "city": addr.get("city"), "province": addr.get("province"),
            "zip": addr.get("zip"), "country": addr.get("country"), "phone": addr.get("phone"),
        },
        "tags": o.get("tags"),
        "cancelled_at": o.get("cancelled_at"),
        "shopify_created_at": o.get("created_at"),
        "shopify_updated_at": o.get("updated_at"),
    }

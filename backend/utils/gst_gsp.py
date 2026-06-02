"""GSP (GST Suvidha Provider) connector — provider-agnostic scaffold.

The GST portal (gst.gov.in) has NO open API; programmatic access to GSTR-1 / GSTR-2B / GSTR-3B and
GSTIN validation is only via a licensed GSP/ASP. This module is the adapter the audit engine calls.
It stays DORMANT (raises GSPNotConfigured) until these env vars are set — so the rest of the app runs
fine without it (mirrors how the codebase tolerates missing keys):

    GSP_PROVIDER       e.g. "cleartax" | "mastersindia" | "iris"   (selects request shapes)
    GSP_BASE_URL       provider API base
    GSP_CLIENT_ID, GSP_CLIENT_SECRET, GSP_API_KEY   provider app credentials
  Per-firm auth (GST portal username + OTP-derived session token, ~6h TTL) is supplied at call time.

Once a provider is chosen and credentials are in .env, implement the request/response mapping for that
provider inside the marked methods (each provider's payloads differ slightly) and the audit engine will
start pulling live returns. Until then, audits run on imported data and flag the GSP-only gaps.
"""
import os


class GSPNotConfigured(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(os.environ.get("GSP_BASE_URL") and os.environ.get("GSP_CLIENT_ID")
                and os.environ.get("GSP_CLIENT_SECRET"))


def _cfg():
    if not is_configured():
        raise GSPNotConfigured(
            "GSP not configured. Set GSP_PROVIDER, GSP_BASE_URL, GSP_CLIENT_ID, GSP_CLIENT_SECRET, "
            "GSP_API_KEY in backend/.env, and supply per-firm GST-portal session auth.")
    return {"provider": os.environ.get("GSP_PROVIDER", ""),
            "base_url": os.environ["GSP_BASE_URL"].rstrip("/"),
            "client_id": os.environ["GSP_CLIENT_ID"],
            "client_secret": os.environ["GSP_CLIENT_SECRET"],
            "api_key": os.environ.get("GSP_API_KEY", "")}


async def authenticate_firm(gstin: str, portal_username: str, otp: str) -> dict:
    """Exchange a GST-portal OTP for a session token for one firm (TTL ~6h). Provider-specific."""
    _cfg()
    raise GSPNotConfigured("authenticate_firm not implemented — wire the chosen provider's auth endpoint.")


async def fetch_gstr1(gstin: str, period: str, session) -> list:
    """Filed outward supplies (GSTR-1) for a firm+period (e.g. period '042026')."""
    _cfg()
    raise GSPNotConfigured("fetch_gstr1 not implemented — wire the chosen provider's GSTR-1 endpoint.")


async def fetch_gstr2b(gstin: str, period: str, session) -> list:
    """Auto-drafted inward credit (GSTR-2B) for ITC reconciliation."""
    _cfg()
    raise GSPNotConfigured("fetch_gstr2b not implemented — wire the chosen provider's GSTR-2B endpoint.")


async def fetch_gstr3b(gstin: str, period: str, session) -> dict:
    """Summary return (GSTR-3B) — liability + ITC + payment."""
    _cfg()
    raise GSPNotConfigured("fetch_gstr3b not implemented — wire the chosen provider's GSTR-3B endpoint.")


async def validate_gstin(gstin: str) -> dict:
    """Live GSTIN status (active/cancelled, legal name) via the GSP. Offline checksum is in gst_audit."""
    _cfg()
    raise GSPNotConfigured("validate_gstin not implemented — wire the chosen provider's taxpayer API.")

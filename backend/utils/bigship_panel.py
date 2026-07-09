"""Bigship PANEL reader — pulls the All-Shipments report from Bigship's INTERNAL
api (appapinew.bigship.in/api/Orders/OrderReport), which the panel's own UI uses.

WHY: Bigship's PUBLIC api (api.bigship.in) has NO list-orders endpoint, so labels
created in the panel (bypassing the CRM) are invisible. The panel's internal API
*does* list them — with FULL, untruncated data (full userOrderId incl. the Amazon
order id when entered, real AWB, full buyer name+phone+address). We use the saved
browser session only to grab the JWT, then call the JSON API directly (robust — no
DOM scraping, survives UI restyles).

Headless, server-side. Shares the persisted 'bigship' browser profile/session.
"""
import asyncio
import logging
import re

import httpx
from dotenv import dotenv_values

logger = logging.getLogger("bigship_panel")

_ENV = dotenv_values("/var/www/crm/backend/.env")
PROFILE_DIR = "/var/www/crm/backend/browser_profiles/16abb602-875d-4283-bed9-f8789e688a17"
ALL_SHIPMENTS_URL = "https://app.bigship.in/reports/all-shipment"
ORDER_REPORT_API = "https://appapinew.bigship.in/api/Orders/OrderReport"
_ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process', '--disable-setuid-sandbox']
_AMZ = re.compile(r"^\d{3}-\d{7}-\d{7}$")


async def _logged_in(page) -> bool:
    return "authentication/login" not in page.url and not await page.query_selector('input[type=password]')


async def _attempt_login(page) -> str:
    """Fill username+password and submit. Returns 'ok' | 'otp' | 'failed'.
    This account has NO 2FA today (verified), so 'ok' is the normal path — but if Bigship
    ever puts up an OTP wall we detect it and return 'otp' so we ALERT instead of hanging."""
    user, pwd = _ENV.get("BIGSHIP_USER_ID", ""), _ENV.get("BIGSHIP_PASSWORD", "")
    if not (user and pwd):
        return "failed"
    for sel in ['input[type=email]', 'input[name=email]', 'input[name=user_name]', 'input[type=text]']:
        el = await page.query_selector(sel)
        if el:
            await el.fill(user); break
    p = await page.query_selector('input[type=password]')
    if p:
        await p.fill(pwd)
    b = await page.query_selector('button[type=submit]') or await page.query_selector('button:has-text("Login")')
    if b:
        await b.click()
    else:
        await page.keyboard.press("Enter")
    await asyncio.sleep(7)
    if await page.query_selector('input[name*="otp" i], input[placeholder*="otp" i], input[id*="otp" i], input[autocomplete="one-time-code"]'):
        return "otp"
    return "ok" if await _logged_in(page) else "failed"


async def _capture_token() -> tuple:
    """Drive the saved Bigship session to the report page and intercept the JWT + userId from the
    panel's own OrderReport request. Re-logs-in automatically if the session expired (retry once).
    Returns (token, user_id, error) — error is None on success, else 'otp_required'/'login_failed'."""
    from playwright.async_api import async_playwright
    grab = {"tok": None, "uid": None}
    pw = ctx = None
    try:
        pw = await async_playwright().start()
        ctx = await pw.chromium.launch_persistent_context(PROFILE_DIR, headless=True, args=_ARGS)
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()

        def on_req(r):
            if "OrderReport" in r.url and not grab["tok"]:
                grab["tok"] = r.headers.get("authorization")
                try:
                    import json
                    grab["uid"] = json.loads(r.post_data or "{}").get("userId")
                except Exception:
                    pass
        page.on("request", on_req)

        await page.goto(ALL_SHIPMENTS_URL, wait_until="domcontentloaded", timeout=45000)
        await asyncio.sleep(4)

        # Session expired → re-login (up to 2 attempts). Persistent profile keeps us logged in
        # between runs, so this only fires occasionally.
        if not await _logged_in(page):
            status = "failed"
            for attempt in range(2):
                status = await _attempt_login(page)
                if status == "ok":
                    break
                if status == "otp":
                    return None, None, "otp_required"
                await page.goto(ALL_SHIPMENTS_URL, wait_until="domcontentloaded", timeout=45000)
                await asyncio.sleep(3)
            if status != "ok":
                return None, None, "login_failed"
            await page.goto(ALL_SHIPMENTS_URL, wait_until="domcontentloaded", timeout=45000)

        try:
            await page.wait_for_selector("table tbody tr", timeout=30000)
        except Exception:
            pass
        await asyncio.sleep(2)
        if not grab["tok"]:
            return None, None, "token_not_captured"
        return grab["tok"], grab["uid"], None
    finally:
        try:
            if ctx:
                await ctx.close()
            if pw:
                await pw.stop()
        except Exception:
            pass


def _product_str(pds) -> str:
    """Join the panel's productDetails into one description, e.g. 'MG 6.2KW Inverter ×2; MG Battery'."""
    parts = []
    for p in pds or []:
        nm = (p.get("productName") or "").strip()
        if not nm:
            continue
        q = p.get("productQty") or 1
        parts.append(f"{nm} ×{q}" if str(q) not in ("1", "", "None") else nm)
    return "; ".join(parts)


def _parse(rec: dict) -> dict:
    sd = rec.get("shipmentDetail") or {}
    od = sd.get("orderDetail") or {}
    bd = rec.get("buyerDetail") or {}
    pds = sd.get("productDetails") or []
    phone = re.sub(r"\D", "", str(bd.get("mobile1") or ""))[-10:]
    name = " ".join(x for x in [bd.get("fname"), bd.get("lname")] if x) or (bd.get("companyName") or "")
    ref = (od.get("userOrderId") or "").strip()
    return {
        "order_ref": ref,
        "product": _product_str(pds),
        "products": [{"name": p.get("productName"), "qty": p.get("productQty")} for p in pds if p.get("productName")],
        "is_amazon_order": bool(_AMZ.match(ref)),
        "awb": str(od.get("awb") or od.get("lrNumber") or "").strip(),
        "lr_number": str(od.get("lrNumber") or "").strip(),
        "bigship_order_id": od.get("orderId"),
        "courier": od.get("courierName") or "",
        "status": od.get("orderStatus") or "",
        "customer_name": name,
        "phone": phone,
        "email": bd.get("emailId") or "",
        "address1": bd.get("address1") or "", "address2": bd.get("address2") or "",
        "landmark": bd.get("landmark") or "", "pincode": str(bd.get("pinCode") or ""),
        "city": bd.get("city") or "", "state": bd.get("state") or "",
        "order_value": od.get("orderValue"), "payment_type": od.get("paymentmode") or "",
        "is_manual": od.get("isManualShipment"),
        "event_date": rec.get("eventDate"),
    }


async def scrape_all_shipments(max_pages: int = 3, page_size: int = 50) -> dict:
    """Return {ok, count, shipments, error}. Pulls the most-recent `max_pages*page_size`
    shipments from the panel's internal OrderReport API. Read-only (no DB writes)."""
    try:
        token, uid, err = await _capture_token()
        if not token:
            return {"ok": False, "count": 0, "shipments": [], "error": err or "login_or_token_failed"}
        headers = {"Authorization": token, "Content-Type": "application/json", "Referer": "https://app.bigship.in/"}
        ships = []
        async with httpx.AsyncClient(timeout=30) as client:
            for pg in range(1, max_pages + 1):
                body = {"userId": uid, "pageIndex": pg, "pageSize": page_size, "courierIds": [],
                        "orderStatusIds": [], "startDate": None, "endDate": None, "searchValue": "", "search_Id": ""}
                r = await client.post(ORDER_REPORT_API, headers=headers, json=body)
                if r.status_code != 200:
                    if pg == 1:
                        return {"ok": False, "count": 0, "shipments": [], "error": f"api_{r.status_code}"}
                    break
                result = ((r.json() or {}).get("data") or {}).get("result") or []
                if not result:
                    break
                ships.extend(_parse(x) for x in result)
                if len(result) < page_size:
                    break
        ships = [s for s in ships if s.get("awb")]
        return {"ok": True, "count": len(ships), "shipments": ships, "error": None}
    except Exception as e:
        logger.error(f"bigship panel read failed: {e}")
        return {"ok": False, "count": 0, "shipments": [], "error": str(e)[:200]}


if __name__ == "__main__":
    import json
    r = asyncio.run(scrape_all_shipments(max_pages=2, page_size=20))
    print("ok:", r["ok"], "| count:", r["count"], "| error:", r["error"])
    amz = sum(1 for s in r["shipments"] if s["is_amazon_order"])
    print("with full Amazon order id:", amz)
    for s in r["shipments"][:6]:
        print(" ", json.dumps({k: s[k] for k in ("order_ref", "is_amazon_order", "awb", "customer_name", "phone", "city", "status")}, ensure_ascii=False))

"""E-Way Bill API client — generate real NIC e-way bills via Masters India (GSP).

Why: B2B / inter-state movements above ₹50,000 legally need an e-way bill before the
truck rolls. Today staff key these into ewaybillgst.gov.in by hand. This client lets the
CRM generate the SAME government e-way bill straight off a sales invoice + dispatch.

How: Masters India is a licensed GSP. They wrap the NIC e-way bill API and handle the
NIC RSA/AES encryption internally, so we exchange plain JSON. We authenticate with the
Masters India account (username/password -> JWT), then post the e-way bill payload. The
per-GSTIN NIC "API user" (created on the EWB portal under Registration -> For GSP ->
Masters India) is registered once inside the Masters India dashboard, not here.

Two environments (NOTE the word "sandbox" = TEST, not the company sandbox.co.in):
  • sandbox  -> https://sandb-api.edoc.mastersindia.co  -> FAKE bills, free, for testing.
  • production-> https://router.mastersindia.co          -> REAL, legally-valid bills.

Pure API client (auth + the EWB verbs). The invoice->payload assembly that needs `db`
lives in server.py, mirroring how shiprocket.py / bigship are wired. OFF until the
EWAY_* keys are set in .env — every entrypoint fails safe (returns None / {ok: False})
so nothing breaks while it's unconfigured. Never fabricates a bill: callers only ever
pass a real invoice.
"""
import os
import logging
from datetime import datetime, timezone, timedelta

import httpx

logger = logging.getLogger(__name__)

# --- environment selection -------------------------------------------------
_ENVS = {
    "sandbox": "https://sandb-api.edoc.mastersindia.co",
    "production": "https://router.mastersindia.co",
}
EWAY_ENV = (os.environ.get("EWAY_ENV", "sandbox") or "sandbox").strip().lower()
EWAY_BASE_URL = (os.environ.get("EWAY_BASE_URL", "").strip()
                 or _ENVS.get(EWAY_ENV, _ENVS["sandbox"])).rstrip("/")

# Masters India endpoint paths. token-auth + ewayBillsGenerate are confirmed from their
# docs; the rest follow their naming — verify the exact slugs in your MI dashboard's API
# reference and adjust here if a 404 comes back (single source of truth, easy to fix).
EWB_ENDPOINTS = {
    "auth":        "/api/v1/token-auth/",
    "generate":    "/api/v1/ewayBillsGenerate/",
    "cancel":      "/api/v1/ewayBillsCancel/",
    "get":         "/api/v1/getEwayBill/",
    "update_part_b": "/api/v1/ewayBillsUpdatePartB/",
    "extend":      "/api/v1/ewayBillsExtend/",
}

_token_cache = {"token": None, "expires_at": None}

# NIC transport-mode + vehicle-type codes (handy for the caller / UI)
TRANS_MODE = {"road": "1", "rail": "2", "air": "3", "ship": "4"}
VEHICLE_TYPE = {"regular": "R", "over_dimensional": "O"}


def enabled() -> bool:
    """True only when the minimum Masters India creds are present."""
    return bool(
        os.environ.get("EWAY_ENABLED", "").strip() in ("1", "true", "True")
        and os.environ.get("EWAY_MI_USERNAME", "").strip()
        and os.environ.get("EWAY_MI_PASSWORD", "").strip()
        and os.environ.get("EWAY_MI_API_KEY", "").strip()
    )


def is_production() -> bool:
    return EWAY_ENV == "production"


async def get_token(force: bool = False) -> str | None:
    """Return a cached Masters India JWT, logging in if needed. None if not configured."""
    if not enabled():
        return None
    now = datetime.now(timezone.utc)
    if not force and _token_cache["token"] and _token_cache["expires_at"] and now < _token_cache["expires_at"]:
        return _token_cache["token"]
    try:
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(f"{EWAY_BASE_URL}{EWB_ENDPOINTS['auth']}", json={
                "username": os.environ["EWAY_MI_USERNAME"].strip(),
                "password": os.environ["EWAY_MI_PASSWORD"].strip(),
            })
        r.raise_for_status()
        body = r.json() or {}
        # MI has returned the token under a few shapes across versions — accept all.
        tok = (body.get("access_token")
               or body.get("token")
               or (body.get("results") or {}).get("access_token")
               or (body.get("data") or {}).get("access_token"))
        if not tok:
            logger.error("E-way bill auth returned no token: %s", str(r.text)[:200])
            return None
        _token_cache["token"] = tok
        # MI JWTs are short-ish; refresh conservatively every ~20 min, plus 401-retry.
        _token_cache["expires_at"] = now + timedelta(minutes=20)
        return tok
    except Exception as e:
        logger.error("E-way bill auth failed: %s", e)
        return None


def _headers(token: str) -> dict:
    """Masters India expects the JWT + api_key (+ client_id/gstin when issued)."""
    h = {
        "Content-Type": "application/json",
        "Authorization": f"JWT {token}",
        "api_key": os.environ.get("EWAY_MI_API_KEY", "").strip(),
    }
    cid = os.environ.get("EWAY_MI_CLIENT_ID", "").strip()
    if cid:
        h["client_id"] = cid
    cs = os.environ.get("EWAY_MI_CLIENT_SECRET", "").strip()
    if cs:
        h["client_secret"] = cs
    gstin = os.environ.get("EWAY_GSTIN", "").strip()
    if gstin:
        h["gstin"] = gstin
    return h


async def _post(key: str, payload: dict) -> dict:
    """POST a payload to an EWB endpoint with token caching + one 401 re-login retry.

    Returns {"ok": bool, "data"/"error": ..., "status": int} — never raises.
    """
    if not enabled():
        return {"ok": False, "error": "eway_not_configured"}
    path = EWB_ENDPOINTS[key]
    for attempt in (1, 2):
        token = await get_token(force=(attempt == 2))
        if not token:
            return {"ok": False, "error": "auth_failed"}
        try:
            async with httpx.AsyncClient(timeout=45.0) as c:
                r = await c.post(f"{EWAY_BASE_URL}{path}", json=payload, headers=_headers(token))
        except Exception as e:
            logger.error("E-way bill %s request error: %s", key, e)
            return {"ok": False, "error": f"request_error: {e}"}
        if r.status_code == 401 and attempt == 1:
            continue  # stale token -> re-login once
        try:
            body = r.json()
        except Exception:
            body = {"raw": str(r.text)[:500]}
        # MI nests the NIC result; surface NIC error codes when present.
        if r.status_code >= 400 or (isinstance(body, dict) and body.get("error")):
            logger.warning("E-way bill %s failed (%s): %s", key, r.status_code, str(body)[:300])
            return {"ok": False, "status": r.status_code, "error": body}
        return {"ok": True, "status": r.status_code, "data": body}
    return {"ok": False, "error": "retry_exhausted"}


def build_ewb_payload(inv: dict) -> dict:
    """Map a normalized invoice dict (assembled in server.py from sales_invoice + dispatch
    + firm) into the NIC/MI e-way bill request body.

    Expected keys on `inv` (the server-side assembler is responsible for filling these):
        doc_no, doc_date (DD/MM/YYYY), supply_type ('O'=outward),
        from_gstin, from_name, from_addr1, from_place, from_pincode, from_state_code,
        to_gstin (or 'URP'), to_name, to_addr1, to_place, to_pincode, to_state_code,
        ship_to_gstin (new 1-Aug-2026 rule; 'URP' if unregistered),
        items: [{name, hsn, qty, unit, taxable, cgst_rate, sgst_rate, igst_rate, cess_rate}],
        total_taxable, cgst, sgst, igst, cess, total_value,
        trans_mode ('road'/'rail'/...), transporter_id, transporter_name,
        trans_doc_no, trans_doc_date, vehicle_no, vehicle_type ('regular'),
        distance_km.
    """
    items = []
    for it in inv.get("items", []):
        items.append({
            "productName": it.get("name", "")[:100],
            "productDesc": it.get("name", "")[:100],
            "hsnCode": str(it.get("hsn", "") or ""),
            "quantity": it.get("qty", 0),
            "qtyUnit": (it.get("unit") or "NOS").upper(),
            "taxableAmount": round(float(it.get("taxable", 0)), 2),
            "cgstRate": float(it.get("cgst_rate", 0) or 0),
            "sgstRate": float(it.get("sgst_rate", 0) or 0),
            "igstRate": float(it.get("igst_rate", 0) or 0),
            "cessRate": float(it.get("cess_rate", 0) or 0),
        })
    return {
        "userGstin": inv.get("from_gstin"),
        "email": os.environ.get("EWAY_MI_EMAIL", "").strip(),
        "supplyType": inv.get("supply_type", "O"),
        "subSupplyType": str(inv.get("sub_supply_type", "1")),  # 1 = Supply
        "docType": inv.get("doc_type", "INV"),
        "docNo": inv.get("doc_no"),
        "docDate": inv.get("doc_date"),  # DD/MM/YYYY
        "transactionType": inv.get("transaction_type", 1),  # 1 = regular
        # consignor (dispatch-from)
        "fromGstin": inv.get("from_gstin"),
        "fromTrdName": inv.get("from_name"),
        "fromAddr1": inv.get("from_addr1", ""),
        "fromAddr2": inv.get("from_addr2", ""),
        "fromPlace": inv.get("from_place", ""),
        "fromPincode": inv.get("from_pincode"),
        "fromStateCode": inv.get("from_state_code"),
        "actFromStateCode": inv.get("from_state_code"),
        # consignee (bill-to)
        "toGstin": inv.get("to_gstin", "URP"),
        "toTrdName": inv.get("to_name"),
        "toAddr1": inv.get("to_addr1", ""),
        "toAddr2": inv.get("to_addr2", ""),
        "toPlace": inv.get("to_place", ""),
        "toPincode": inv.get("to_pincode"),
        "toStateCode": inv.get("to_state_code"),
        "actToStateCode": inv.get("ship_to_state_code", inv.get("to_state_code")),
        # ship-to GSTIN — mandatory on Bill-To/Ship-To from 1 Aug 2026 ('URP' if unregistered)
        "shipToGstin": inv.get("ship_to_gstin"),
        "itemList": items,
        "totalValue": round(float(inv.get("total_taxable", 0)), 2),
        "cgstValue": round(float(inv.get("cgst", 0)), 2),
        "sgstValue": round(float(inv.get("sgst", 0)), 2),
        "igstValue": round(float(inv.get("igst", 0)), 2),
        "cessValue": round(float(inv.get("cess", 0)), 2),
        "totInvValue": round(float(inv.get("total_value", 0)), 2),
        # transport
        "transMode": TRANS_MODE.get((inv.get("trans_mode") or "road").lower(), "1"),
        "transporterId": inv.get("transporter_id", ""),
        "transporterName": inv.get("transporter_name", ""),
        "transDocNo": inv.get("trans_doc_no", ""),
        "transDocDate": inv.get("trans_doc_date", ""),
        "vehicleNo": (inv.get("vehicle_no", "") or "").replace(" ", "").upper(),
        "vehicleType": VEHICLE_TYPE.get((inv.get("vehicle_type") or "regular").lower(), "R"),
        "transDistance": str(inv.get("distance_km", 0)),
    }


async def generate_ewb(inv: dict) -> dict:
    """Generate a real e-way bill from a normalized invoice dict.

    On success returns {"ok": True, "ewb_no": "...", "ewb_date": "...", "valid_upto": "...",
    "data": <raw>}; otherwise {"ok": False, "error": ...}.
    """
    res = await _post("generate", build_ewb_payload(inv))
    if not res.get("ok"):
        return res
    body = res["data"] or {}
    # MI nests the NIC fields under results/data depending on version.
    node = body.get("results") or body.get("data") or body
    ewb_no = node.get("ewayBillNo") or node.get("ewbNo") or node.get("EwbNo")
    if not ewb_no:
        return {"ok": False, "error": body}
    return {
        "ok": True,
        "ewb_no": str(ewb_no),
        "ewb_date": node.get("ewayBillDate") or node.get("ewbDate"),
        "valid_upto": node.get("validUpto") or node.get("validUpTo"),
        "data": body,
    }


async def cancel_ewb(ewb_no: str, gstin: str, reason_code: int = 2, remark: str = "Order cancelled") -> dict:
    """Cancel an e-way bill (only within 24h of generation, per NIC rules).

    reason_code: 1=Duplicate, 2=Order Cancelled, 3=Data Entry mistake, 4=Others.
    """
    return await _post("cancel", {
        "userGstin": gstin,
        "ewbNo": int(str(ewb_no)),
        "cancelRsnCode": reason_code,
        "cancelRmrk": remark[:100],
    })


async def get_ewb(ewb_no: str, gstin: str) -> dict:
    """Fetch a single e-way bill's current status/details."""
    return await _post("get", {"userGstin": gstin, "ewbNo": int(str(ewb_no))})


async def update_vehicle(ewb_no: str, gstin: str, vehicle_no: str, from_place: str,
                         from_state_code, reason_code: int = 1, remark: str = "",
                         trans_mode: str = "road", trans_doc_no: str = "",
                         trans_doc_date: str = "") -> dict:
    """Update Part-B (vehicle / transport doc) on an existing e-way bill.

    reason_code: 1=Due to Break Down, 2=Due to Transhipment, 3=Others, 4=First Time.
    """
    return await _post("update_part_b", {
        "userGstin": gstin,
        "ewbNo": int(str(ewb_no)),
        "vehicleNo": (vehicle_no or "").replace(" ", "").upper(),
        "fromPlace": from_place,
        "fromState": from_state_code,
        "reasonCode": reason_code,
        "reasonRem": (remark or "")[:100],
        "transMode": TRANS_MODE.get((trans_mode or "road").lower(), "1"),
        "transDocNo": trans_doc_no,
        "transDocDate": trans_doc_date,
        "vehicleType": "R",
    })


async def extend_validity(ewb_no: str, gstin: str, remaining_distance_km, vehicle_no: str,
                          from_place: str, from_pincode, from_state_code,
                          reason_code: int = 1, remark: str = "Transit delay") -> dict:
    """Extend an e-way bill's validity (allowed from 8h before to 8h after expiry).

    reason_code: 1=Natural Calamity, 2=Law & Order, 4=Transhipment, 5=Accident, 99=Others.
    """
    return await _post("extend", {
        "userGstin": gstin,
        "ewbNo": int(str(ewb_no)),
        "vehicleNo": (vehicle_no or "").replace(" ", "").upper(),
        "fromPlace": from_place,
        "fromPincode": from_pincode,
        "fromState": from_state_code,
        "remainingDistance": str(remaining_distance_km),
        "extnRsnCode": reason_code,
        "extnRemarks": remark[:100],
        "transMode": "1",
        "vehicleType": "R",
    })

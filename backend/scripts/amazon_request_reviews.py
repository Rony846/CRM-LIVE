#!/usr/bin/env python3
"""Amazon "Request a Review" (SP-API Solicitations) for shipped orders in the
eligible window. The COMPLIANT way to get Amazon feedback — Amazon sends its own
review / seller-feedback request to the buyer on-platform (no buyer phone/email
needed, no WhatsApp, no policy risk).

Preview by default; pass --send to actually call Amazon. --limit N caps count,
--firm <id> restricts to one firm.

Amazon enforces the 5–30-days-after-DELIVERY window server-side: ineligible
orders just come back rejected (recorded, skipped). We target Shipped orders
purchased ~6–32 days ago and let Amazon gate the rest.
"""
import asyncio, hashlib, hmac, sys, aiohttp
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values("/var/www/crm/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]

SEND = "--send" in sys.argv
LIMIT = None
FIRM = None
for i, a in enumerate(sys.argv):
    if a.startswith("--limit"):
        LIMIT = int(a.split("=")[1]) if "=" in a else int(sys.argv[i + 1])
    if a.startswith("--firm"):
        FIRM = a.split("=")[1] if "=" in a else sys.argv[i + 1]

REGION, HOST, SERVICE = "eu-west-1", "sellingpartnerapi-eu.amazon.com", "execute-api"
TODAY = datetime.now(timezone.utc)
WIN_LO = (TODAY - timedelta(days=32)).isoformat()   # purchased no earlier than ~32d ago
WIN_HI = (TODAY - timedelta(days=6)).isoformat()    # and at least ~6d ago


def _sig_key(key, ds):
    def s(k, m): return hmac.new(k, m.encode(), hashlib.sha256).digest()
    return s(s(s(s(("AWS4" + key).encode(), ds), REGION), SERVICE), "aws4_request")


async def _token(session, c):
    async with session.post("https://api.amazon.com/auth/o2/token", data={
        "grant_type": "refresh_token", "refresh_token": c["refresh_token"],
        "client_id": c["lwa_client_id"], "client_secret": c["lwa_client_secret"],
    }) as r:
        if r.status != 200:
            raise RuntimeError(f"LWA token failed: {r.status} {await r.text()}")
        return (await r.json())["access_token"]


async def _solicit(session, c, token, amazon_order_id, mkt):
    """POST the productReviewAndSellerFeedback solicitation. Returns (status, data)."""
    uri = f"/solicitations/v1/orders/{amazon_order_id}/solicitations/productReviewAndSellerFeedback"
    qs = f"marketplaceIds={mkt}"
    body = ""
    t = datetime.now(timezone.utc)
    amz_date, ds = t.strftime('%Y%m%dT%H%M%SZ'), t.strftime('%Y%m%d')
    ch = f"host:{HOST}\nx-amz-access-token:{token}\nx-amz-date:{amz_date}\n"
    sh = "host;x-amz-access-token;x-amz-date"
    ph = hashlib.sha256(body.encode()).hexdigest()
    creq = f"POST\n{uri}\n{qs}\n{ch}\n{sh}\n{ph}"
    scope = f"{ds}/{REGION}/{SERVICE}/aws4_request"
    sts = f"AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{hashlib.sha256(creq.encode()).hexdigest()}"
    sig = hmac.new(_sig_key(c["aws_secret_key"], ds), sts.encode(), hashlib.sha256).hexdigest()
    auth = (f"AWS4-HMAC-SHA256 Credential={c['aws_access_key']}/{scope}, "
            f"SignedHeaders={sh}, Signature={sig}")
    headers = {"host": HOST, "x-amz-access-token": token, "x-amz-date": amz_date,
               "Authorization": auth, "Content-Type": "application/json"}
    async with session.post(f"https://{HOST}{uri}?{qs}", headers=headers, data=body) as r:
        try:
            data = await r.json()
        except Exception:
            data = {"raw": await r.text()}
        return r.status, data


def eligible(firm_id):
    q = {"order_status": "Shipped",
         "purchase_date": {"$gte": WIN_LO, "$lte": WIN_HI},
         "amazon_order_id": {"$regex": r"^\d{3}-\d{7}-\d{7}$"},
         "solicitation_sent_at": {"$in": [None, False]},
         "firm_id": firm_id}
    cur = db.amazon_orders.find(q, {"_id": 0, "id": 1, "amazon_order_id": 1, "purchase_date": 1})
    return list(cur)


async def main():
    firms = list(db.marketplace_credentials.find(
        {"platform": "amazon", "is_active": True} | ({"firm_id": FIRM} if FIRM else {}),
        {"_id": 0}))
    print(f"window: purchased {WIN_LO[:10]}..{WIN_HI[:10]} | status=Shipped | send={SEND}")
    print(f"active amazon firms: {len(firms)}\n")

    total_targets = []
    for c in firms:
        orders = eligible(c["firm_id"])
        fname = db.firms.find_one({"id": c["firm_id"]}, {"_id": 0, "name": 1}) if "firms" in db.list_collection_names() else None
        print(f"firm {c['firm_id']} ({(fname or {}).get('name','?')}): {len(orders)} eligible")
        for o in orders:
            total_targets.append((c, o))

    if LIMIT:
        total_targets = total_targets[:LIMIT]
    print(f"\nTOTAL to solicit: {len(total_targets)}" + (f" (capped at {LIMIT})" if LIMIT else ""))

    if not SEND:
        for c, o in total_targets[:10]:
            print(f"  would solicit {o['amazon_order_id']}  (purchased {o['purchase_date'][:10]})")
        if len(total_targets) > 10:
            print(f"  ... +{len(total_targets)-10} more")
        print("\nPREVIEW ONLY — re-run with --send to call Amazon. Use --limit N to start small.")
        return

    mkt_default = "A21TJRUUN4KGV"
    sent = skipped = failed = 0
    async with aiohttp.ClientSession() as session:
        tokens = {}
        for c, o in total_targets:
            fid = c["firm_id"]
            if fid not in tokens:
                tokens[fid] = await _token(session, c)
            mkt = c.get("marketplace_id") or mkt_default
            try:
                status, data = await _solicit(session, c, tokens[fid], o["amazon_order_id"], mkt)
            except Exception as e:
                status, data = 0, {"error": str(e)}
            now = datetime.now(timezone.utc).isoformat()
            if status in (200, 201, 204):
                sent += 1
                st = "sent"
            elif status in (400, 404) and "eligib" in str(data).lower() or "INVALID" in str(data):
                skipped += 1
                st = "ineligible"
            else:
                failed += 1
                st = "failed"
            db.amazon_orders.update_one({"id": o["id"]}, {"$set": {
                "solicitation_sent_at": now if st == "sent" else None,
                "solicitation_status": st, "solicitation_http": status,
                "solicitation_detail": str(data)[:300], "solicitation_attempt_at": now}})
            print(f"  {o['amazon_order_id']}: {status} {st}" + (f" — {str(data)[:90]}" if st != 'sent' else ""))
            await asyncio.sleep(1.1)  # Solicitations API ~1 req/sec
    print(f"\nDone: sent={sent} ineligible={skipped} failed={failed} of {len(total_targets)}")


asyncio.run(main())

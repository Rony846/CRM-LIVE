import asyncio, sys, re
from datetime import datetime, timezone
sys.path.insert(0, '/var/www/crm/backend'); import server

COMMIT = "--commit" in sys.argv
GEN = re.compile(r"-(OFF|SD)-\d{8}-[A-Z0-9]{4}$")


async def m():
    db = server.db
    now = datetime.now(timezone.utc).isoformat()
    cand = []
    async for e in db.pending_fulfillment.find(
            {"$or": [{"source": "accountant_offline"}, {"type": "offline_order"}, {"order_id_generated": True}]},
            {"_id": 0, "id": 1, "order_id": 1, "tracking_id": 1, "invoice_number": 1}):
        oid = str(e.get("order_id") or "")
        if GEN.search(oid) or e.get("order_id_generated"):
            cand.append(e)
    awbs = [e.get("tracking_id") for e in cand if e.get("tracking_id")]
    real = {}
    async for cs in db.courier_shipments.find({"awb_number": {"$in": awbs}},
            {"_id": 0, "awb_number": 1, "invoice_number": 1, "panel_order_ref": 1}):
        rr = server._clean_ship_ref(cs.get("invoice_number"), cs.get("panel_order_ref"))
        if rr and not server._AMZ_OID_RE.search(rr):
            real[cs["awb_number"]] = rr

    done = skipped = serials_moved = 0
    for e in cand:
        rr = real.get(e.get("tracking_id"))
        old = e.get("order_id")
        if not rr or rr == old:
            continue
        # dup guard: don't collide with an existing DIFFERENT order
        clash = await db.pending_fulfillment.find_one({"order_id": rr, "id": {"$ne": e["id"]}}, {"_id": 1})
        if clash:
            print(f"  SKIP {old} → {rr} (order_id already exists on another order)")
            skipped += 1
            continue
        print(f"  {old} → {rr}")
        if COMMIT:
            await db.pending_fulfillment.update_one({"id": e["id"]}, {"$set": {
                "order_id": rr, "order_id_internal": old, "invoice_number": rr,
                "order_id_backfilled_at": now}})
            sm = await db.finished_good_serials.update_many({"order_id": old}, {"$set": {"order_id": rr, "order_id_prev": old}})
            serials_moved += sm.modified_count
            await db.dispatches.update_many({"order_id": old}, {"$set": {"order_id": rr, "order_id_prev": old}})
        done += 1
    print(f"\n{'BACKFILLED' if COMMIT else 'WOULD backfill'}: {done} | skipped(clash): {skipped} | serials moved: {serials_moved}")
    if not COMMIT:
        print("DRY RUN — pass --commit")

asyncio.run(m())

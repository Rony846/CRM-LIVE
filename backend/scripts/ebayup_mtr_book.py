import asyncio, sys, uuid
from datetime import datetime, timezone
sys.path.insert(0, '/var/www/crm/backend'); import server

FIRM = "a9b65de0-ef07-47d7-b778-2a9f63ef52ab"
PERIOD = "2026-06"
SOURCE = "amazon_ebayup_mtr_2026-06"   # unique + reversible (delete this source to undo)
SELLER_GSTIN = "09BLDPR5944R1Z3"
COMMIT = "--commit" in sys.argv

def num(x):
    try: return round(float(x or 0), 2)
    except: return 0.0

async def m():
    db = server.db
    firm = await db.firms.find_one({"id": FIRM}, {"_id": 0, "name": 1})
    now = datetime.now(timezone.utc).isoformat()
    rows = [e async for e in db.amazon_mtr.find({"firm_id": FIRM, "period_key": PERIOD}, {"_id": 0})]

    # already booked under this source? (idempotent re-run)
    prior = await db.sales_invoices.count_documents({"firm_id": FIRM, "source": SOURCE})

    docs, danger = [], []
    net_taxable = net_gst = 0.0
    for e in rows:
        refund = bool(e.get("is_refund"))
        sgn = -1.0 if refund else 1.0
        orig = str(e.get("invoice_number") or "").strip()
        inv_no = (f"EBU-CN-2606-{orig[3:]}" if refund and orig.startswith("IN-")
                  else f"EBU-CN-2606-{orig}") if refund else f"EBU-{orig}"
        taxable = sgn * abs(num(e.get("taxable")))
        cgst = sgn * abs(num(e.get("cgst"))); sgst = sgn * abs(num(e.get("sgst"))); igst = sgn * abs(num(e.get("igst")))
        gst = round(cgst + sgst + igst, 2); grand = round(taxable + gst, 2)
        net_taxable += taxable; net_gst += gst
        # DANGER guard: a SALES invoice number must not already exist
        if not refund:
            danger.append(inv_no)
        idate = str(e.get("invoice_date") or "")[:10] or "2026-06-30"
        docs.append({
            "id": str(uuid.uuid4()), "invoice_number": inv_no, "amazon_invoice_number": orig,
            "invoice_date": idate, "invoice_month": PERIOD, "period_key": "2627",
            "invoice_type": "credit_note" if refund else "sales",
            "firm_id": FIRM, "firm_name": (firm or {}).get("name"), "source": SOURCE,
            "seller_gstin": SELLER_GSTIN, "channel": "amazon", "order_source": "amazon",
            "order_id": e.get("order_id"), "transaction_type": e.get("transaction_type"),
            "state": e.get("ship_state"), "party_name": "Amazon (B2B)" if e.get("is_b2b") else "Amazon (B2C)",
            "taxable_value": taxable, "cgst": cgst, "sgst": sgst, "igst": igst,
            "total_gst": gst, "grand_total": grand, "total": grand,
            "product_name": "Amazon MTR line", "hsn": "", "sku": "", "asin": "",
            "payment_status": "paid", "status": "final",
            "created_at": now, "created_by": "claude_import", "created_by_name": "Amazon MTR import (June 2026)",
        })

    # collision check against existing sales invoices (only sales numbers are dangerous)
    existing = set()
    if danger:
        async for si in db.sales_invoices.find({"invoice_number": {"$in": danger}}, {"_id": 0, "invoice_number": 1}):
            existing.add(si["invoice_number"])

    ship = [d for d in docs if d["invoice_type"] == "sales"]
    cn = [d for d in docs if d["invoice_type"] == "credit_note"]
    print(f"prior rows under source {SOURCE}: {prior}")
    print(f"to book: {len(ship)} sales + {len(cn)} credit notes = {len(docs)}")
    print(f"NET taxable ₹{net_taxable:,.2f} | NET output GST ₹{net_gst:,.2f}")
    print(f"expected (from amazon_mtr): NET GST ₹1,407,194  NET taxable ₹10,548,968")
    print(f"DANGEROUS sales-number collisions: {len(existing)} -> {list(existing)[:5]}")
    # internal uniqueness of generated numbers
    allnos = [d["invoice_number"] for d in docs]
    print(f"generated-number internal dups: {len(allnos)-len(set(allnos))}")

    if existing:
        print("ABORT: sales invoice number already exists — refusing to overwrite a real sale."); return
    if (len(allnos) - len(set(allnos))) != 0:
        print("ABORT: generated invoice numbers not unique."); return

    if not COMMIT:
        print("\nDRY RUN — pass --commit to write."); return
    if prior:
        await db.sales_invoices.delete_many({"firm_id": FIRM, "source": SOURCE})
        print(f"cleared {prior} prior rows under this source (idempotent re-run)")
    await db.sales_invoices.insert_many(docs)
    # verify from DB
    agg = [x async for x in db.sales_invoices.aggregate([
        {"$match": {"firm_id": FIRM, "source": SOURCE}},
        {"$group": {"_id": None, "tax": {"$sum": "$taxable_value"}, "gst": {"$sum": "$total_gst"}, "n": {"$sum": 1}}}])]
    print("INSERTED. DB verify:", agg)

asyncio.run(m())

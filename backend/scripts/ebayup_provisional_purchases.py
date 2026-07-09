import asyncio, sys, uuid
from datetime import datetime, timezone
sys.path.insert(0, '/var/www/crm/backend'); import server

EBU = "a9b65de0-ef07-47d7-b778-2a9f63ef52ab"          # EBAY UP (buyer)
EBU_GSTIN = "09BLDPR5944R1Z3"
MGIPL = "16abb602-875d-4283-bed9-f8789e688a17"          # MGIPL (supplier)
MGIPL_GSTIN = "07AATCM1213F1ZM"
PERIOD = "2026-06"
COMMIT = "--commit" in sys.argv

# Amazon June fee invoices (from FOC #226 PDFs) — supplier Amazon Seller Services (KA 29), inter-state IGST
AMZ_FEES = [
    ("ADS-2627-178718", 91245.52, 16424.18, False),
    ("KA-2627-833323", 1045524.54, 188194.95, False),
    ("KA-2627-949071", 36548.00, 6578.64, False),
    ("KA-C-27-524135", -161415.16, -29054.69, True),
    ("KA-C-27-524144", -6593.00, -1186.74, True),
    ("KA-C-27-717662", -2913.60, -524.45, True),
]
AMZ_GSTIN = "29AAICA3918J1ZE"

def num(x):
    try: return round(float(x or 0), 2)
    except: return 0.0

async def m():
    db = server.db
    now = datetime.now(timezone.utc).isoformat()
    docs = []

    # 1) INTERCOMPANY: MGIPL sold to eBay-UP — derive from MGIPL's filed GSTR-1 B2B (real tax doc).
    #    Aggregate per invoice number (multi-rate lines → one purchase). MGIPL(07)→eBU(09) = inter-state IGST.
    ml = [r async for r in db.gst_report_data.find(
        {"firm_id": MGIPL, "period_key": PERIOD, "source": "vyapar", "section": "b2b", "gstin": EBU_GSTIN},
        {"_id": 0})]
    inv = {}
    for r in ml:
        n = str(r.get("invoice_number") or "").strip()
        d = inv.setdefault(n, {"tax": 0.0, "igst": 0.0, "date": r.get("invoice_date"), "val": 0.0})
        d["tax"] += num(r.get("taxable_value"))
        d["igst"] += num(r.get("igst")) + num(r.get("cgst")) + num(r.get("sgst"))
        d["val"] += num(r.get("invoice_value")) / max(1, sum(1 for x in ml if x.get("invoice_number") == n))
    for n, d in inv.items():
        tot = round(d["tax"] + d["igst"], 2)
        docs.append({
            "id": str(uuid.uuid4()), "purchase_number": f"PROV-EBU-{n.replace('/', '-')}",
            "firm_id": EBU, "firm_name": "EBAY UP", "firm_gstin": EBU_GSTIN,
            "supplier_name": "MGIPL (Musclegrid Industries Pvt Ltd)", "supplier_gstin": MGIPL_GSTIN,
            "supplier_state": "Delhi", "invoice_number": n, "invoice_date": str(d["date"] or "")[:10] or "2026-06-30",
            "period_key": PERIOD, "is_inter_state": True,
            "items": [{"item_name": "Goods purchased from MGIPL (intercompany)", "qty": "1", "rate": d["tax"], "amount": d["tax"]}],
            "total_taxable": round(d["tax"], 2), "taxable_value": round(d["tax"], 2), "subtotal": round(d["tax"], 2),
            "total_igst": round(d["igst"], 2), "total_cgst": 0.0, "total_sgst": 0.0,
            "igst": round(d["igst"], 2), "cgst": 0.0, "sgst": 0.0, "total_gst": round(d["igst"], 2),
            "gst_amount": round(d["igst"], 2), "total_amount": tot, "grand_total": tot,
            "category": "intercompany_goods", "is_credit_note": False, "itc_eligible": True,
            "status": "provisional", "doc_status": "provisional", "payment_status": "unpaid",
            "provisional": True, "awaiting_2b": True, "source": "intercompany_mgipl_gstr1",
            "notes": f"Provisional — derived from MGIPL filed GSTR-1 invoice {n}; confirm on eBay-UP GSTR-2B.",
            "created_at": now, "created_by_name": "Claude (provisional)"})

    # 2) Amazon marketplace fee invoices (input ITC)
    for n, fee, gst, is_cn in AMZ_FEES:
        tot = round(fee + gst, 2)
        docs.append({
            "id": str(uuid.uuid4()), "purchase_number": f"PROV-AMZFEE-{n}",
            "firm_id": EBU, "firm_name": "EBAY UP", "firm_gstin": EBU_GSTIN,
            "supplier_name": "Amazon Seller Services Private Limited", "supplier_gstin": AMZ_GSTIN,
            "supplier_state": "Karnataka", "invoice_number": n, "invoice_date": "2026-06-30",
            "period_key": PERIOD, "is_inter_state": True,
            "items": [{"item_name": "Amazon marketplace fees — June 2026", "qty": "1", "rate": fee, "amount": fee}],
            "total_taxable": num(fee), "taxable_value": num(fee), "subtotal": num(fee),
            "total_igst": num(gst), "total_cgst": 0.0, "total_sgst": 0.0,
            "igst": num(gst), "cgst": 0.0, "sgst": 0.0, "total_gst": num(gst), "gst_amount": num(gst),
            "total_amount": tot, "grand_total": tot, "category": "marketplace_fee",
            "is_credit_note": is_cn, "itc_eligible": True,
            "status": "provisional", "doc_status": "provisional", "payment_status": "paid",
            "provisional": True, "awaiting_2b": True, "source": "amazon_fee_invoice", "claude_file_number": 226,
            "notes": f"Provisional — Amazon fee {'credit note' if is_cn else 'invoice'} {n}; confirm on GSTR-2B.",
            "created_at": now, "created_by_name": "Claude (provisional)"})

    ic_itc = round(sum(d["total_gst"] for d in docs if d["category"] == "intercompany_goods"), 2)
    fee_itc = round(sum(d["total_gst"] for d in docs if d["category"] == "marketplace_fee"), 2)
    print(f"intercompany purchases: {len(inv)} invoices, ITC ₹{ic_itc:,.2f}")
    print(f"amazon fee purchases:   {len(AMZ_FEES)} docs, net ITC ₹{fee_itc:,.2f}")
    print(f"TOTAL provisional ITC: ₹{ic_itc + fee_itc:,.2f}  ({len(docs)} purchase docs)")

    if not COMMIT:
        print("\nDRY RUN — pass --commit to write."); return
    # idempotent: clear prior provisional eBay-UP June rows
    d = await db.purchases.delete_many({"firm_id": EBU, "period_key": PERIOD, "provisional": True})
    if d.deleted_count: print(f"cleared {d.deleted_count} prior provisional rows")
    await db.purchases.insert_many(docs)
    agg = [x async for x in db.purchases.aggregate([
        {"$match": {"firm_id": EBU, "period_key": PERIOD, "provisional": True}},
        {"$group": {"_id": None, "itc": {"$sum": "$total_gst"}, "n": {"$sum": 1}}}])]
    print("INSERTED. DB verify:", agg)

asyncio.run(m())

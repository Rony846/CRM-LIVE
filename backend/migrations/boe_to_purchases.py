"""Backfill: turn ingested BoE import_shipments into material-purchase register entries.

For each import_shipment with source='boe_email_ingest', create one purchase (source='boe_import')
with line items broken out from the BoE PDF (HSN + qty, assessable/duty allocated proportionally so
the line sum reconciles to the validated customs summary). Money is taken from the shipment's
validated totals: landed cost = assessable + BCD + SWS (IGST is creditable ITC, not landed cost).
Marks the shipment finalized. Dedup-safe (skips BoEs already converted).

BoE-only: item names are generic per HSN (the BoE carries customs descriptions, not SKUs) and there
are no separate freight/clearing expense lines (those need the CHA invoice).

    ./venv/bin/python migrations/boe_to_purchases.py [--write]
"""
import os, sys, asyncio, uuid, datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
from utils import storage
from utils.boe_ingest import parse_boe_items

WRITE = '--write' in sys.argv


def f(x):
    try:
        return float(x or 0)
    except (TypeError, ValueError):
        return 0.0


async def main():
    c = AsyncIOMotorClient(os.environ['MONGO_URL']); db = c[os.environ['DB_NAME']]
    exist = set()
    async for p in db.purchases.find({'source': 'boe_import'}, {'invoice_number': 1}):
        exist.add(p.get('invoice_number'))
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    pdocs = []; ship_updates = []; tot_mat = tot_duty = tot_igst = tot_land = 0; nitems = 0
    async for s in db.import_shipments.find({'source': 'boe_email_ingest'}):
        bno = s.get('boe_number')
        if bno in exist:
            continue
        t = s.get('totals', {})
        assess = f(t.get('total_assessable_value')); bcd = f(t.get('total_bcd'))
        sws = f(t.get('total_sws')); igst = f(t.get('total_igst_customs'))
        landed = assess + bcd + sws  # IGST is ITC (recoverable), not landed cost
        items = []
        try:
            blob = await storage.download_file(s.get('boe_file')) if s.get('boe_file') else None
            if blob:
                items = parse_boe_items(blob)
        except Exception:
            items = []
        rsum = sum(f(i['assess']) for i in items)
        if items and rsum > 0:
            lines = [{'item_type': 'raw_material', 'master_sku_id': None,
                      'name': f"Imported material (HSN {it.get('hsn') or 'NA'})", 'sku_code': None,
                      'hsn_code': it.get('hsn'), 'quantity': f(it.get('qty')) or 0,
                      'assessable_value': round(assess * (f(it['assess']) / rsum), 2),
                      'bcd_amount': round(bcd * (f(it['assess']) / rsum), 2),
                      'sws_amount': round(sws * (f(it['assess']) / rsum), 2),
                      'igst_rate': 18.0, 'igst_amount': round(igst * (f(it['assess']) / rsum), 2),
                      'landed_cost': round((assess + bcd + sws) * (f(it['assess']) / rsum), 2)}
                     for it in items]
        else:
            lines = [{'item_type': 'raw_material', 'master_sku_id': None,
                      'name': 'Imported goods (consolidated)', 'sku_code': None, 'hsn_code': None,
                      'quantity': 0, 'assessable_value': round(assess, 2), 'bcd_amount': round(bcd, 2),
                      'sws_amount': round(sws, 2), 'igst_rate': 18.0, 'igst_amount': round(igst, 2),
                      'landed_cost': round(landed, 2)}]
        nitems += len(lines)
        pdocs.append({'id': str(uuid.uuid4()), 'purchase_number': f"PUR-IMP-{bno}",
                      'firm_id': s.get('firm_id'), 'firm_name': s.get('firm_name'), 'firm_gstin': '07AATCM1213F1ZM',
                      'supplier_name': s.get('supplier_name') or 'Import (China)',
                      'supplier_country': s.get('supplier_country') or 'China',
                      'invoice_number': bno, 'invoice_date': s.get('boe_date'), 'period_key': s.get('period_key'),
                      'is_import': True, 'is_inter_state': False, 'boe_number': bno, 'boe_date': s.get('boe_date'),
                      'import_shipment_id': s.get('id'), 'items': lines,
                      'total_taxable': round(assess, 2), 'taxable_value': round(assess, 2), 'subtotal': round(assess, 2),
                      'total_bcd': round(bcd, 2), 'total_sws': round(sws, 2), 'total_duties': round(bcd + sws + igst, 2),
                      'total_igst': round(igst, 2), 'total_cgst': 0, 'total_sgst': 0,
                      'total_gst': round(igst, 2), 'gst_amount': round(igst, 2),
                      'total_amount': round(landed, 2), 'grand_total': round(landed, 2),
                      'totals': {'grand_total': round(landed, 2), 'taxable_value': round(assess, 2),
                                 'total_gst': round(igst, 2), 'landed_cost': round(landed, 2)},
                      'status': 'final', 'doc_status': 'complete', 'payment_status': 'paid', 'source': 'boe_import',
                      'notes': 'Material purchase from customs Bill of Entry (BoE-only; duty in landed cost, IGST=ITC). Items generic per HSN.',
                      'created_by_name': 'BoE import (Claude)', 'created_at': now})
        ship_updates.append(s.get('id'))
        tot_mat += assess; tot_duty += bcd + sws; tot_igst += igst; tot_land += landed
    print(f"{'WRITE' if WRITE else 'DRY-RUN'}: {len(pdocs)} material purchases from BoEs ({nitems} line items)")
    print(f"  Material (assessable):                 Rs {tot_mat:,.0f}")
    print(f"  Customs duty (BCD+SWS) in landed cost:  Rs {tot_duty:,.0f}")
    print(f"  Landed cost (material+duty, ex-IGST):   Rs {tot_land:,.0f}")
    print(f"  IGST (ITC, recoverable):                Rs {tot_igst:,.0f}")
    if WRITE and pdocs:
        await db.purchases.insert_many(pdocs, ordered=False)
        for sid in ship_updates:
            await db.import_shipments.update_one({'id': sid},
                                                 {'$set': {'status': 'finalized', 'finalized_via': 'boe_import_backfill'}})
        print(f"\n*** WROTE {len(pdocs)} purchases; marked {len(ship_updates)} shipments finalized ***")
    elif not WRITE:
        print("\n(dry-run — add --write)")

asyncio.run(main())

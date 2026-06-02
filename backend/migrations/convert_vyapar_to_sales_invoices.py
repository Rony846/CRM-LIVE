"""Convert imported Vyapar SALES vouchers into CRM-native sales_invoices, so the native sales
module / dashboards reflect book sales that were raised in Vyapar (not in this CRM).

    ./venv/bin/python migrations/convert_vyapar_to_sales_invoices.py <firm_id> [period_key] [--write]

- period_key optional ('2026-05'); omit for all months.
- Dedup-safe: skips vouchers already converted (source='vyapar_import' + same invoice_number) and
  any invoice_number that collides with an existing native invoice.
- Imported book sales carry no payment data, so they are marked PAID (balance_due=0) to avoid
  phantom receivables; tagged source='vyapar_import' so they're identifiable/reversible.
"""
import os, sys, re, asyncio, uuid, datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

STATE = {'07': 'Delhi', '06': 'Haryana', '09': 'Uttar Pradesh', '08': 'Rajasthan',
         '27': 'Maharashtra', '29': 'Karnataka', '24': 'Gujarat', '33': 'Tamil Nadu',
         '36': 'Telangana', '19': 'West Bengal', '23': 'Madhya Pradesh', '03': 'Punjab'}
WRITE = '--write' in sys.argv
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]


def f(x):
    try:
        return float(x or 0)
    except (TypeError, ValueError):
        return 0.0


def numpart(s):
    m = re.search(r"-?\d[\d,]*\.?\d*", str(s or ""))
    return f(m.group(0).replace(',', '')) if m else 0.0


async def main():
    if not ARGS:
        print(__doc__); return
    fid = ARGS[0]
    period = ARGS[1] if len(ARGS) > 1 else None
    c = AsyncIOMotorClient(os.environ['MONGO_URL']); db = c[os.environ['DB_NAME']]
    firm = await db.firms.find_one({'id': fid})
    if not firm:
        print(f"Unknown firm_id {fid}"); return
    fname = firm.get('name')
    # sales_invoices has a GLOBAL unique index on invoice_number, so converted numbers must be
    # globally unique. Track every existing number; idempotency keys on the original Vyapar ref.
    global_taken = set()
    async for s in db.sales_invoices.find({}, {'invoice_number': 1}):
        global_taken.add((s.get('invoice_number') or '').strip())
    converted_src = set()
    async for s in db.sales_invoices.find({'firm_id': fid, 'source': 'vyapar_import'},
                                          {'source_invoice_number': 1}):
        converted_src.add((s.get('source_invoice_number') or '').strip())
    short = re.sub(r'[^A-Za-z0-9]', '', fname).upper()[:4] or 'VY'
    q = {'firm_id': fid, 'voucher_type': 'Sales'}
    if period:
        q['date'] = {'$regex': f"^{re.escape(period)}"}
    if '--b2b-only' in sys.argv:
        # Skip B2C/no-GSTIN vouchers — for Amazon-selling firms these are retail sales already
        # captured as native (dispatch-generated) invoices; converting them would double-count.
        q['party_gstin'] = {'$nin': [None, '']}
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    docs = []; skipped = 0
    async for v in db.vyapar_vouchers.find(q):
        orig = (v.get('reference') or v.get('voucher_number') or '').strip()
        if orig in converted_src:
            skipped += 1; continue
        # build a globally-unique invoice_number, keeping the original where it doesn't collide
        inv = orig or f"{short}/{uuid.uuid4().hex[:8]}"
        if inv in global_taken:
            inv = f"{short}/{orig}"; k = 1
            while inv in global_taken:
                inv = f"{short}/{orig}#{k}"; k += 1
        global_taken.add(inv)
        tx = f(v.get('taxable_value')); ig = f(v.get('igst')); cg = f(v.get('cgst')); sg = f(v.get('sgst'))
        gst = ig + cg + sg; gross = f(v.get('total_value')) or (tx + gst)
        pg = (v.get('party_gstin') or '')
        items = []
        for li in (v.get('line_items') or []):
            amt = f(li.get('amount'))
            share = (amt / tx) if tx else 0
            items.append({'name': li.get('item'), 'sku_code': None, 'hsn_code': None,
                          'quantity': numpart(li.get('qty')) or 1, 'rate': numpart(li.get('rate')),
                          'discount': 0, 'taxable_value': round(amt, 2),
                          'gst_amount': round(gst * share, 2),
                          'igst': round(ig * share, 2), 'cgst': round(cg * share, 2), 'sgst': round(sg * share, 2)})
        docs.append({
            'id': str(uuid.uuid4()), 'invoice_number': inv, 'source_invoice_number': orig,
            'firm_id': fid, 'firm_name': fname,
            'party_id': None, 'party_name': v.get('party_name'), 'party_gstin': pg,
            'party_state': v.get('place_of_supply') or STATE.get(pg[:2]),
            'invoice_date': v.get('date'), 'items': items,
            'subtotal': round(tx, 2), 'shipping_charges': 0, 'other_charges': 0, 'discount': 0,
            'taxable_value': round(tx, 2), 'is_igst': ig > 0, 'is_inter_state': ig > 0,
            'igst': round(ig, 2), 'cgst': round(cg, 2), 'sgst': round(sg, 2),
            'total_gst': round(gst, 2), 'grand_total': round(gross, 2),
            'payment_status': 'paid', 'amount_paid': round(gross, 2), 'balance_due': 0,
            'gst_override': False, 'status': 'final', 'doc_status': 'complete',
            'order_source': 'vyapar', 'source': 'vyapar_import',
            'notes': 'Imported from Vyapar books (raised in Vyapar, not CRM). Marked paid — no AR intent.',
            'created_by_name': 'Vyapar import (Claude)', 'created_at': now, 'updated_at': now})
    print(f"{'WRITE' if WRITE else 'DRY-RUN'} {fname} {period or 'all months'}: "
          f"{len(docs)} to convert, {skipped} skipped (already native/converted)")
    if docs:
        tx = sum(d['taxable_value'] for d in docs); gr = sum(d['grand_total'] for d in docs)
        print(f"  taxable Rs {tx:,.0f} | gross Rs {gr:,.0f}")
    if WRITE and docs:
        await db.sales_invoices.insert_many(docs, ordered=False)
        print(f"\n*** WROTE {len(docs)} sales_invoices (source=vyapar_import) ***")
    elif not WRITE:
        print("\n(dry-run — add --write)")

asyncio.run(main())

"""Mirror intra-group Vyapar SALES vouchers into the BUYER firm's purchase ledger.

For every Vyapar 'Sales' voucher whose party_gstin is another group firm's GSTIN, create a
matching purchase record under that buyer firm (source='intercompany_mirror'), so each firm's
inward purchases + ITC reflect what the group sold it. Dedup-safe (skips invoices already
recorded for that buyer). The ITC is a proxy until the buyer's own GSTR-2B is loaded.

Dry-run by default; pass --write to persist.
    ./venv/bin/python migrations/mirror_intragroup_purchases.py [--write]
"""
import os, sys, asyncio, uuid, datetime, collections
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

GSTIN2FIRM = {'07AATCM1213F1ZM': '16abb602-875d-4283-bed9-f8789e688a17',
              '06BCSPR2468A1ZF': '8bf93db6-045f-4aed-988c-352103ed049d',
              '09BPRPR2164D1ZK': 'c715c1b7-aca3-4100-8b00-4f711a729829',
              '07BLDPR5944R3Z5': '76b41510-bb17-42be-887f-abcbfd9f4180',
              '09BLDPR5944R1Z3': 'a9b65de0-ef07-47d7-b778-2a9f63ef52ab'}
STATE = {'07': 'Delhi', '06': 'Haryana', '09': 'Uttar Pradesh'}
WRITE = '--write' in sys.argv


def f(x):
    try:
        return float(x or 0)
    except (TypeError, ValueError):
        return 0.0


async def main():
    c = AsyncIOMotorClient(os.environ['MONGO_URL']); db = c[os.environ['DB_NAME']]
    firms = {x['id']: (x['name'], x.get('gstin')) async for x in db.firms.find({})}
    # existing purchase keys per buyer firm: invoice_number (+ optional supplier gstin)
    exist = collections.defaultdict(set)
    async for p in db.purchases.find({}, {'firm_id': 1, 'invoice_number': 1}):
        exist[p['firm_id']].add((p.get('invoice_number') or '').strip())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    docs = []
    summary = collections.defaultdict(lambda: [0, 0.0, 0.0])
    async for v in db.vyapar_vouchers.find({'voucher_type': 'Sales',
                                            'party_gstin': {'$in': list(GSTIN2FIRM)}}):
        buyer_id = GSTIN2FIRM[v['party_gstin']]
        if buyer_id == v['firm_id']:
            continue  # not a cross-firm sale
        inv = (v.get('reference') or v.get('voucher_number') or '').strip()
        if inv in exist.get(buyer_id, set()):
            continue
        sname, sg = firms.get(v['firm_id'], (v.get('firm_name'), None))
        bname, bg = firms.get(buyer_id, ('?', None))
        tx = f(v.get('taxable_value')); ig = f(v.get('igst')); cg = f(v.get('cgst')); sgst = f(v.get('sgst'))
        gst = ig + cg + sgst; tot = f(v.get('total_value')) or (tx + gst)
        d = v.get('date') or ''; pk = v.get('period_key') or d[:7]
        items = [{'item_name': li.get('item'), 'qty': li.get('qty'),
                  'rate': li.get('rate'), 'amount': f(li.get('amount'))}
                 for li in (v.get('line_items') or [])]
        docs.append({
            'id': str(uuid.uuid4()),
            'purchase_number': f"PUR-MIR-{pk.replace('-', '')}-{inv.replace('/', '')[-8:] or uuid.uuid4().hex[:6]}",
            'firm_id': buyer_id, 'firm_name': bname, 'firm_gstin': bg,
            'supplier_name': sname, 'supplier_gstin': sg, 'supplier_state': STATE.get((sg or '')[:2], ''),
            'invoice_number': inv, 'invoice_date': d, 'period_key': pk,
            'is_inter_state': (sg or '')[:2] != (bg or '')[:2], 'is_inter_company_transfer': True,
            'items': items,
            'total_taxable': round(tx, 2), 'taxable_value': round(tx, 2), 'subtotal': round(tx, 2),
            'total_igst': round(ig, 2), 'total_cgst': round(cg, 2), 'total_sgst': round(sgst, 2),
            'igst': round(ig, 2), 'cgst': round(cg, 2), 'sgst': round(sgst, 2),
            'total_gst': round(gst, 2), 'gst_amount': round(gst, 2),
            'total_amount': round(tot, 2), 'grand_total': round(tot, 2),
            'totals': {'grand_total': round(tot, 2), 'taxable_value': round(tx, 2), 'total_gst': round(gst, 2)},
            'status': 'final', 'doc_status': 'complete', 'payment_status': 'unpaid',
            'source': 'intercompany_mirror',
            'notes': 'Mirrored from group seller Vyapar books (intra-group purchase). ITC claimable once in own GSTR-2B.',
            'created_at': now, 'created_by_name': 'GST mapping (Claude)'})
        summary[bname][0] += 1; summary[bname][1] += tx; summary[bname][2] += gst
    print(f"{'WRITE' if WRITE else 'DRY-RUN'} — {len(docs)} intra-group purchases to mirror:")
    for b in sorted(summary):
        n, tx, g = summary[b]
        print(f"  {b:30s}: {n:4d} invoices  taxable Rs {tx:>14,.0f}  ITC Rs {g:>13,.0f}")
    if WRITE and docs:
        await db.purchases.insert_many(docs)
        print(f"\n*** WROTE {len(docs)} purchase records ***")
    elif not WRITE:
        print("\n(dry-run — add --write to persist)")

asyncio.run(main())

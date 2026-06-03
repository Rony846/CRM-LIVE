"""Flag CRM leads/parties who were Amazon-refunded AND are chatting on Kommo (WhatsApp).

Matches refunded-order customer phones against Kommo contact phones, then sets
refunded_customer=true (+ refund_amount, refund_reason) on the matching CRM `leads` and
`parties`. Re-runnable as new refunds/Kommo contacts arrive.

Phone resolution for a refunded order is pulled, in order, from:
  amazon_orders.phone / phone_manual  ->  amazon_order_processing.customer_phone
  ->  courier_shipments.phone (the real consignee number on the shipment).
(The Amazon MTR has no phone numbers; ~38% of refunded orders resolve — the rest were never
shipped by us / FBA, so no phone was ever captured.)

    ./venv/bin/python migrations/kommo_tag_refunded.py            # dry-run (counts)
    ./venv/bin/python migrations/kommo_tag_refunded.py --write    # apply tags
"""
import os, sys, re, datetime, asyncio, collections
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
WRITE = '--write' in sys.argv


def norm(p):
    d = re.sub(r'\D', '', str(p or ''))
    if len(d) == 12 and d.startswith('91'):
        return d[2:]
    if len(d) == 11 and d.startswith('0'):
        return d[1:]
    return d


def _f(x):
    try:
        return float(x or 0)
    except (TypeError, ValueError):
        return 0.0


async def main():
    c = AsyncIOMotorClient(os.environ['MONGO_URL']); db = c[os.environ['DB_NAME']]
    # refund total + reasons per order
    rinfo = collections.defaultdict(lambda: {'amt': 0.0, 'reasons': set()})
    async for r in db.amazon_refunds.find({}):
        oid = r.get('amazon_order_id')
        if oid:
            rinfo[oid]['amt'] += _f(r.get('refund_amount'))
            rinfo[oid]['reasons'].add(str(r.get('refund_reason') or '')[:40])
    rorders = list(rinfo)

    # resolve order -> phone from the three sources (first hit wins)
    ophone = {}
    async for o in db.amazon_orders.find({'amazon_order_id': {'$in': rorders}},
                                         {'amazon_order_id': 1, 'phone': 1, 'phone_manual': 1}):
        for k in ('phone', 'phone_manual'):
            if o.get(k):
                ophone.setdefault(o['amazon_order_id'], norm(o[k]))
    async for o in db.amazon_order_processing.find({'order_id': {'$in': rorders}},
                                                   {'order_id': 1, 'customer_phone': 1}):
        if o.get('customer_phone'):
            ophone.setdefault(o['order_id'], norm(o['customer_phone']))
    async for s in db.courier_shipments.find({'order_id': {'$in': rorders}},
                                             {'order_id': 1, 'phone': 1}):
        if s.get('phone'):
            ophone.setdefault(s['order_id'], norm(s['phone']))

    # phone -> aggregated refund info
    pinfo = collections.defaultdict(lambda: {'amt': 0.0, 'reasons': set()})
    for oid, inf in rinfo.items():
        ph = ophone.get(oid)
        if ph:
            pinfo[ph]['amt'] += inf['amt']
            pinfo[ph]['reasons'] |= inf['reasons']
    pinfo.pop('', None)

    # Kommo contact phones
    kph = set()
    async for ct in db.kommo_contacts.find({}, {'custom_fields_values': 1}):
        for cf in (ct.get('custom_fields_values') or []):
            if cf.get('field_code') == 'PHONE':
                for v in (cf.get('values') or []):
                    if v.get('value'):
                        kph.add(norm(v['value']))

    match = set(pinfo) & kph
    resolved = len({p for p in ophone.values() if p})
    print(f"refunded orders: {len(rorders)} | phones resolved: {resolved} | Kommo phones: {len(kph)}")
    print(f">>> Refunded customers on Kommo: {len(match)} <<<")

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    tag_l = tag_p = 0
    for ph in match:
        info = pinfo[ph]
        setd = {'refunded_customer': True, 'refund_amount': round(info['amt'], 2),
                'refund_reason': '; '.join(sorted(x for x in info['reasons'] if x))[:120],
                'refunded_tagged_at': now}
        has_lead = await db.leads.count_documents({'phone': ph})
        if has_lead:
            if WRITE:
                await db.leads.update_many({'phone': ph}, {'$set': setd})
            tag_l += 1
        else:
            if WRITE:
                await db.parties.update_many({'phone': ph}, {'$set': {**setd, 'on_kommo': True}})
            tag_p += 1
    print(f"{'TAGGED' if WRITE else 'WOULD TAG'}: {tag_l} via leads + {tag_p} via parties = {tag_l + tag_p}")
    if not WRITE:
        print("\n(dry-run — add --write to apply tags)")

asyncio.run(main())

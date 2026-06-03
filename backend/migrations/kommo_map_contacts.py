"""Map pulled Kommo contacts (kommo_contacts) into CRM `leads`, deduped by phone against existing
leads AND parties (customers). New contacts become source='kommo' leads; enriched with the linked
Kommo lead's pipeline stage + value when present. Idempotent (skips contacts already mapped).

    ./venv/bin/python migrations/kommo_map_contacts.py            # dry-run (counts + sample)
    ./venv/bin/python migrations/kommo_map_contacts.py --write    # create the leads
"""
import os, sys, re, uuid, datetime, asyncio, collections
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
WRITE = '--write' in sys.argv


def norm_phone(p):
    d = re.sub(r'\D', '', str(p or ''))
    if len(d) == 12 and d.startswith('91'):
        return d[2:]
    if len(d) == 11 and d.startswith('0'):
        return d[1:]
    return d  # 10-digit as-is; odd lengths kept for dedup consistency


def cf_vals(ct, code):
    out = []
    for cf in (ct.get('custom_fields_values') or []):
        if cf.get('field_code') == code:
            out += [v.get('value') for v in (cf.get('values') or []) if v.get('value')]
    return out


async def main():
    c = AsyncIOMotorClient(os.environ['MONGO_URL']); db = c[os.environ['DB_NAME']]
    # dedup set: existing phones from leads + parties (normalized)
    existing = set()
    async for l in db.leads.find({}, {'phone': 1}):
        existing.add(norm_phone(l.get('phone')))
    async for p in db.parties.find({}, {'phone': 1, 'phone2': 1, 'mobile': 1}):
        for k in ('phone', 'phone2', 'mobile'):
            if p.get(k):
                existing.add(norm_phone(p.get(k)))
    existing.discard('')
    # already-mapped kommo contact ids (idempotency)
    mapped = set()
    async for l in db.leads.find({'source': 'kommo'}, {'kommo_contact_id': 1}):
        if l.get('kommo_contact_id'):
            mapped.add(l['kommo_contact_id'])
    # pipeline stage-id -> name (for enrichment)
    stage = {}
    async for pl in db.kommo_pipelines.find({}):
        for s in (pl.get('_embedded', {}) or {}).get('statuses', []):
            stage[s.get('id')] = s.get('name')
    # kommo lead id -> (stage_name, price)
    klead = {}
    async for kl in db.kommo_leads.find({}, {'id': 1, 'status_id': 1, 'price': 1}):
        klead[kl.get('id')] = (stage.get(kl.get('status_id'), ''), kl.get('price') or 0)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_docs = []
    skip_dup = skip_nophone = skip_mapped = 0
    seen_batch = set()
    async for ct in db.kommo_contacts.find({}):
        cid = ct.get('id')
        if cid in mapped:
            skip_mapped += 1; continue
        phones = cf_vals(ct, 'PHONE')
        if not phones:
            skip_nophone += 1; continue
        ph = norm_phone(phones[0])
        if not ph:
            skip_nophone += 1; continue
        if ph in existing or ph in seen_batch:
            skip_dup += 1; continue
        seen_batch.add(ph)
        emails = cf_vals(ct, 'EMAIL')
        name = (ct.get('name') or '').strip() or ph
        # enrich from a linked kommo lead
        linked = [l.get('id') for l in (ct.get('_embedded', {}) or {}).get('leads', [])]
        stg, price = '', 0
        for lid in linked:
            if lid in klead:
                stg, price = klead[lid]; break
        note = f"Imported from Kommo (WhatsApp)." + (f" Stage: {stg}." if stg else "") + (f" Value: Rs {price}." if price else "")
        new_docs.append({
            'id': str(uuid.uuid4()), 'phone': ph, 'name': name,
            'email': (emails[0] if emails else ''), 'product_interest': '',
            'source': 'kommo', 'status': 'new', 'notes': note,
            'assigned_to': None, 'assigned_to_name': None, 'follow_up_date': '',
            'interactions': [], 'kommo_contact_id': cid, 'kommo_lead_ids': linked,
            'kommo_stage': stg, 'created_by': 'kommo_import', 'created_at': now, 'updated_at': now,
        })
    print(f"{'WRITE' if WRITE else 'DRY-RUN'} — Kommo contacts -> CRM leads")
    print(f"  total kommo_contacts scanned: {await db.kommo_contacts.count_documents({})}")
    print(f"  NEW leads to create: {len(new_docs)}")
    print(f"  skipped (already a lead/party phone): {skip_dup}")
    print(f"  skipped (no phone): {skip_nophone}")
    print(f"  skipped (already mapped from kommo): {skip_mapped}")
    if new_docs:
        print("  sample:", [(d['name'][:20], d['phone'], d['kommo_stage']) for d in new_docs[:5]])
    if WRITE and new_docs:
        for i in range(0, len(new_docs), 1000):
            await db.leads.insert_many(new_docs[i:i+1000], ordered=False)
        print(f"\n*** WROTE {len(new_docs)} leads (source=kommo) ***  total leads now: {await db.leads.count_documents({})}")
    elif not WRITE:
        print("\n(dry-run — add --write)")

asyncio.run(main())

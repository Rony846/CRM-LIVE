"""Map Kommo *leads* (sales opportunities) onto CRM leads. A Kommo lead is tied to a contact that
was already mapped by kommo_map_contacts, so this ENRICHES the matching CRM lead with the deal's
pipeline stage, status (won/lost/active), and value — rather than duplicating it. Where the lead's
contact wasn't mapped (deduped to a party / no phone), a new CRM lead is created if a phone exists.

Idempotent (re-running re-applies the same enrichment, keyed on kommo_lead_id / kommo_contact_id).

    ./venv/bin/python migrations/kommo_map_leads.py            # dry-run
    ./venv/bin/python migrations/kommo_map_leads.py --write
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
    return d


def cf_phone(ct):
    for cf in (ct.get('custom_fields_values') or []):
        if cf.get('field_code') == 'PHONE':
            for v in (cf.get('values') or []):
                if v.get('value'):
                    return norm_phone(v.get('value'))
    return ''


def status_for(status_id, stage_type):
    if status_id == 142:
        return 'converted'
    if status_id == 143:
        return 'lost'
    if stage_type == 1:   # "Incoming leads" entry stage
        return 'new'
    return 'qualified'     # somewhere in the active funnel


async def main():
    c = AsyncIOMotorClient(os.environ['MONGO_URL']); db = c[os.environ['DB_NAME']]
    # stage_id -> (name, type)
    stage = {}
    async for pl in db.kommo_pipelines.find({}):
        for s in (pl.get('_embedded', {}) or {}).get('statuses', []):
            stage[s.get('id')] = (s.get('name'), s.get('type'))
    # kommo contact_id -> phone
    cphone = {}
    async for ct in db.kommo_contacts.find({}, {'id': 1, 'custom_fields_values': 1}):
        cphone[ct.get('id')] = cf_phone(ct)
    # CRM lead by kommo_contact_id (the ones from contact-mapping)
    crm_by_contact = {}
    async for l in db.leads.find({'source': {'$in': ['kommo', 'kommo_lead']}, 'kommo_contact_id': {'$ne': None}},
                                 {'id': 1, 'kommo_contact_id': 1}):
        crm_by_contact[l['kommo_contact_id']] = l['id']
    # phones already present (any lead/party) — to dedup new creates
    existing_phone = set()
    async for l in db.leads.find({}, {'phone': 1}):
        existing_phone.add(norm_phone(l.get('phone')))
    async for p in db.parties.find({}, {'phone': 1}):
        existing_phone.add(norm_phone(p.get('phone')))

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    enrich = 0; new_docs = []; no_phone = 0
    new_seen = set()
    statbreak = collections.Counter()
    async for kl in db.kommo_leads.find({}):
        sid = kl.get('status_id')
        sname, stype = stage.get(sid, ('', 0))
        st = status_for(sid, stype)
        statbreak[st] += 1
        price = kl.get('price') or 0
        contacts = [ct.get('id') for ct in (kl.get('_embedded', {}) or {}).get('contacts', [])]
        cid = contacts[0] if contacts else None
        upd = {'kommo_lead_id': kl.get('id'), 'kommo_stage': sname, 'kommo_pipeline_id': kl.get('pipeline_id'),
               'lead_value': price, 'status': st, 'updated_at': now,
               'notes': f"Kommo deal '{kl.get('name')}' — stage: {sname}" + (f", value Rs {price}" if price else "")}
        if cid and cid in crm_by_contact:
            enrich += 1
            if WRITE:
                await db.leads.update_one({'id': crm_by_contact[cid]}, {'$set': upd})
        else:
            ph = cphone.get(cid, '') if cid else ''
            if not ph:
                no_phone += 1; continue
            if ph in existing_phone or ph in new_seen:
                # phone exists (likely a party/customer) but no kommo lead record — create one so the
                # active deal is visible in the pipeline, deduped within this batch.
                if ph in new_seen:
                    continue
            new_seen.add(ph)
            new_docs.append({'id': str(uuid.uuid4()), 'phone': ph, 'name': (kl.get('name') or ph),
                             'email': '', 'product_interest': '', 'source': 'kommo_lead', 'status': st,
                             'notes': upd['notes'], 'assigned_to': None, 'assigned_to_name': None,
                             'follow_up_date': '', 'interactions': [], 'kommo_contact_id': cid,
                             'kommo_lead_id': kl.get('id'), 'kommo_stage': sname, 'lead_value': price,
                             'created_by': 'kommo_import', 'created_at': now, 'updated_at': now})
    print(f"{'WRITE' if WRITE else 'DRY-RUN'} — Kommo leads -> CRM")
    print(f"  kommo_leads: {await db.kommo_leads.count_documents({})}")
    print(f"  ENRICHED existing CRM leads (deal stage attached): {enrich}")
    print(f"  NEW CRM leads (contact not previously mapped): {len(new_docs)}")
    print(f"  skipped (lead had no phone): {no_phone}")
    print(f"  status breakdown: {dict(statbreak)}")
    if WRITE and new_docs:
        for i in range(0, len(new_docs), 1000):
            await db.leads.insert_many(new_docs[i:i+1000], ordered=False)
        print(f"\n*** ENRICHED {enrich} + CREATED {len(new_docs)} ***  total leads now: {await db.leads.count_documents({})}")
    elif not WRITE:
        print("\n(dry-run — add --write)")

asyncio.run(main())

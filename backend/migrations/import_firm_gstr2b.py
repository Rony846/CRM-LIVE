"""Import a firm's own GSTR-2B (portal 'credit page') into gst_report_data as section '2b_itc'.

Drop the portal 2B zip(s)/json(s) anywhere under a folder and run:
    ./venv/bin/python migrations/import_firm_gstr2b.py <GSTIN> <path-to-folder-or-zip> [--write]

It auto-detects GSTR-2B JSON (handles both portal formats via utils.gst_import), keeps only files
whose owner GSTIN matches <GSTIN>, maps to the firm by GSTIN, and (with --write) replaces that
firm's existing 2b_itc rows. This is the authoritative ITC source — once loaded it supersedes the
intra-group purchase mirror for that firm.
"""
import os, sys, glob, json, zipfile, io, asyncio, uuid, datetime, collections
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils import gst_import as gi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

GSTIN2FIRM = {'07AATCM1213F1ZM': '16abb602-875d-4283-bed9-f8789e688a17',
              '06BCSPR2468A1ZF': '8bf93db6-045f-4aed-988c-352103ed049d',
              '09BPRPR2164D1ZK': 'c715c1b7-aca3-4100-8b00-4f711a729829',
              '07BLDPR5944R3Z5': '76b41510-bb17-42be-887f-abcbfd9f4180',
              '09BLDPR5944R1Z3': 'a9b65de0-ef07-47d7-b778-2a9f63ef52ab',
              '07BCSPR2468A1ZD': '45f6f868-58f0-4b3b-87d8-9289755fb062'}


def f(x):
    try:
        return float(x or 0)
    except (TypeError, ValueError):
        return 0.0


async def main():
    if len(sys.argv) < 3:
        print(__doc__); return
    gstin = sys.argv[1].strip().upper()
    path = sys.argv[2]
    write = '--write' in sys.argv
    fid = GSTIN2FIRM.get(gstin)
    if not fid:
        print(f"Unknown GSTIN {gstin} — not a known group firm."); return
    twob = {}  # period -> rows

    def consider(b):
        try:
            data = json.loads(b.decode('utf-8', 'replace'))
        except Exception:
            return
        if gi.detect_return_type(data) != 'gstr2b':
            return
        owner = data.get('gstin') or (data.get('data') or {}).get('gstin')
        if owner != gstin:
            return
        per = gi._find_period(data)
        d = data.get('data') if isinstance(data.get('data'), dict) else data
        rows = gi.parse_gstr2b(d, fid, per)
        if per and rows is not None:
            twob[per] = rows

    def walk(b):
        try:
            zf = zipfile.ZipFile(io.BytesIO(b))
        except Exception:
            return
        for n in zf.namelist():
            if n.endswith('/'):
                continue
            x = zf.read(n)
            if n.lower().endswith('.json'):
                consider(x)
            elif n.lower().endswith('.zip'):
                walk(x)

    targets = [path] if os.path.isfile(path) else glob.glob(os.path.join(path, '**', '*'), recursive=True)
    for p in targets:
        if p.lower().endswith('.zip'):
            walk(open(p, 'rb').read())
        elif p.lower().endswith('.json'):
            consider(open(p, 'rb').read())

    print(f"GSTR-2B for {gstin}: found {len(twob)} periods")
    for per in sorted(twob):
        tax = sum(f(r.get('igst')) + f(r.get('cgst')) + f(r.get('sgst')) for r in twob[per])
        print(f"  {per}: {len(twob[per])} invoices, ITC Rs {tax:,.0f}")
    if write and twob:
        c = AsyncIOMotorClient(os.environ['MONGO_URL']); db = c[os.environ['DB_NAME']]
        now = datetime.datetime.now(datetime.timezone.utc).isoformat(); rid = str(uuid.uuid4()); ins = []
        for per, rows in twob.items():
            for r in rows:
                r.update({'id': str(uuid.uuid4()), 'report_id': rid, 'firm_id': fid,
                          'period_key': per, 'source': 'portal_import', 'created_at': now})
                ins.append(r)
        await db.gst_report_data.delete_many({'firm_id': fid, 'section': '2b_itc'})
        if ins:
            await db.gst_report_data.insert_many(ins)
        print(f"\n*** WROTE {len(ins)} 2b_itc rows for {gstin} ***")
        print("    Tip: this firm's real ITC is now portal-sourced; the intra-group mirror can be retired.")
    elif not write:
        print("\n(dry-run — add --write to persist)")

asyncio.run(main())

"""Import a firm's GSTR-1 (portal JSON) + GSTR-3B (portal PDF) into gst_report_data.

    ./venv/bin/python migrations/import_firm_gstr1_3b.py <GSTIN> <folder> [--write]

GSTR-1: recurses the folder for JSON (incl. inside zips), keeps only files whose owner GSTIN
matches, parses via utils.gst_import. GSTR-3B: reads each PDF, derives the period from its
Year+Period fields, and pulls 3.1(a) outward tax + 4A(5) ITC. Idempotent: with --write it
replaces that firm's portal_import GSTR-1/3B/4_itc rows (2b_itc untouched — use import_firm_gstr2b).
"""
import os, sys, glob, json, zipfile, io, re, uuid, datetime, asyncio
import fitz
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils import gst_import as gi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

GSTIN2FIRM = {'07AATCM1213F1ZM': '16abb602-875d-4283-bed9-f8789e688a17',
              '06BCSPR2468A1ZF': '8bf93db6-045f-4aed-988c-352103ed049d',
              '09BPRPR2164D1ZK': 'c715c1b7-aca3-4100-8b00-4f711a729829',
              '07BLDPR5944R3Z5': '76b41510-bb17-42be-887f-abcbfd9f4180',
              '09BLDPR5944R1Z3': 'a9b65de0-ef07-47d7-b778-2a9f63ef52ab'}
MON = {'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7,
       'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12}
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
WRITE = '--write' in sys.argv


def num(s):
    try:
        return float(str(s).replace(',', '').strip())
    except (TypeError, ValueError):
        return 0.0


def period_from_3b(txt):
    fy = re.search(r'Year\s*\n?\s*(20\d\d)-(\d\d)', txt)
    fy_start = int(fy.group(1)) if fy else None
    pm = re.search(r'Period\s*\n?\s*([A-Za-z][A-Za-z\-]*)', txt)
    per = (pm.group(1).strip().lower() if pm else '').replace('june', 'jun').replace('july', 'jul').replace('march', 'mar').replace('april', 'apr')
    if not fy_start or not per:
        return None
    if '-' in per:  # quarter, keyed to end-month
        q = {'apr-jun': (6, fy_start), 'jul-sep': (9, fy_start),
             'oct-dec': (12, fy_start), 'jan-mar': (3, fy_start + 1)}.get(per)
        if not q:
            return None
        return f"{q[1]}-{q[0]:02d}"
    mo = MON.get(per[:3])
    if not mo:
        return None
    yr = fy_start if mo >= 4 else fy_start + 1
    return f"{yr}-{mo:02d}"


async def main():
    if len(ARGS) < 2:
        print(__doc__); return
    gstin, folder = ARGS[0].upper(), ARGS[1]
    fid = GSTIN2FIRM.get(gstin)
    if not fid:
        print(f"Unknown GSTIN {gstin}"); return
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(); rid = str(uuid.uuid4())

    # ---- GSTR-1 (JSON, recursing zips) ----
    g1 = []; g1_periods = {}

    def consider_json(b):
        try:
            data = json.loads(b.decode('utf-8', 'replace'))
        except Exception:
            return
        if gi.detect_return_type(data) != 'gstr1':
            return
        if (data.get('gstin') or '') != gstin:
            return
        p = gi._find_period(data)
        if not p or p in g1_periods:
            return
        rows = gi.parse_gstr1(data, fid, p)
        for r in rows:
            r.update({'id': str(uuid.uuid4()), 'report_id': rid, 'firm_id': fid,
                      'period_key': p, 'source': 'portal_import', 'created_at': now})
        g1.extend(rows); g1_periods[p] = len(rows)

    for path in glob.glob(os.path.join(folder, '**', '*'), recursive=True):
        if path.lower().endswith('.json'):
            consider_json(open(path, 'rb').read())
        elif path.lower().endswith('.zip'):
            try:
                with zipfile.ZipFile(path) as zf:
                    for n in zf.namelist():
                        if n.lower().endswith('.json'):
                            consider_json(zf.read(n))
            except Exception:
                pass

    # ---- GSTR-3B (PDF) ----
    b3 = []
    for pdf in glob.glob(os.path.join(folder, '**', '*.pdf'), recursive=True):
        try:
            txt = "\n".join(p.get_text() for p in fitz.open(pdf))
        except Exception:
            continue
        if (gstin not in txt) or ('GSTR-3B' not in txt and 'GSTR3B' not in txt):
            continue
        pk = period_from_3b(txt)
        seg = lambda anc, k: [num(x) for x in re.findall(r'-?[\d,]+\.\d{2}', txt[txt.find(anc):txt.find(anc) + 260])][:k] if anc in txt else []
        a = seg('(a) Outward taxable supplies', 4)
        itc = seg('All other ITC', 4)
        if not pk or len(a) < 4:
            print(f"  3B parse miss: {os.path.basename(pdf)} (pk={pk})"); continue
        b3.append({'id': str(uuid.uuid4()), 'report_id': rid, 'firm_id': fid, 'period_key': pk,
                   'source': 'portal_import', 'section': '3b_summary', 'nature_of_supplies': '3.1(a) Outward',
                   'taxable_value': a[0], 'igst': a[1], 'cgst': a[2], 'sgst': a[3],
                   'outward_tax': round(a[1] + a[2] + a[3], 2), 'pdf': os.path.basename(pdf), 'created_at': now})
        if len(itc) >= 3:
            b3.append({'id': str(uuid.uuid4()), 'report_id': rid, 'firm_id': fid, 'period_key': pk,
                       'source': 'portal_import', 'section': '4_itc', 'details': '(A)(5) All other ITC',
                       'igst': itc[0], 'cgst': itc[1], 'sgst': itc[2], 'cess': 0.0, 'created_at': now})

    n3 = sum(1 for r in b3 if r['section'] == '3b_summary')
    print(f"{'WRITE' if WRITE else 'DRY-RUN'} {gstin}:")
    print(f"  GSTR-1: {len(g1)} rows across {len(g1_periods)} periods {sorted(g1_periods)}")
    print(f"          total filed tax Rs {sum(r['igst']+r['cgst']+r['sgst'] for r in g1):,.0f}")
    print(f"  GSTR-3B: {n3} periods")
    for r in [x for x in b3 if x['section'] == '3b_summary']:
        print(f"     {r['pdf'][:18]:18s} -> {r['period_key']:9s} outward tax Rs {r['outward_tax']:>11,.0f}")
    if WRITE and (g1 or b3):
        c = AsyncIOMotorClient(os.environ['MONGO_URL']); db = c[os.environ['DB_NAME']]
        await db.gst_report_data.delete_many({'firm_id': fid, 'source': 'portal_import',
                                              'section': {'$in': ['b2b', 'b2cs', 'b2cl', '3b_summary', '4_itc']}})
        if g1:
            await db.gst_report_data.insert_many(g1)
        if b3:
            await db.gst_report_data.insert_many(b3)
        print(f"\n*** WROTE {len(g1)} GSTR-1 rows + {len(b3)} GSTR-3B rows ***")
    elif not WRITE:
        print("\n(dry-run — add --write)")

asyncio.run(main())

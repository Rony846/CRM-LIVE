"""Parse an Income-Tax AIS into the figures needed to reconcile GST <-> ITR.

The portal's AIS *JSON* download is encrypted (needs the AIS Utility); the practical input is the
password-protected **AIS PDF**. This reads that PDF and extracts each Information Code's aggregate
AMOUNT (GST turnover via EXC-GSTR3B, GST purchases via EXC-GSTR1(P), TDS/TCS, SFT, interest, etc.),
plus the per-GSTIN GST turnover breakdown, keyed to PAN + AY.

    ./venv/bin/python migrations/import_ais.py <ais.pdf> --password <pwd> [--write]
    ./venv/bin/python migrations/import_ais.py <ais.json> [--write]      # if you have decrypted JSON
"""
import os, sys, re, datetime, asyncio, collections
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

PAN_RE = re.compile(r'\b([A-Z]{5}[0-9]{4}[A-Z])\b')
GSTIN_RE = re.compile(r'\b(\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b')
WRITE = '--write' in sys.argv
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
PWD = None
if '--password' in sys.argv:
    PWD = sys.argv[sys.argv.index('--password') + 1]

INFO_CODES = re.compile(r'^(EXC-GSTR3B|EXC-GSTR1\(P\)|TDS-[\w/]+|TCS-[\w/]+|SFT-\d+|INT-\w+|SAL-\w+|DIV-\w+|[A-Z]{2,4}-[\w()/]+)$')


def inr(s):
    s = str(s).replace(',', '').strip()
    try:
        return float(s)
    except ValueError:
        return None


def categorize(code, desc):
    c = code.upper(); d = (desc or '').lower()
    if 'GSTR3B' in c:
        return 'gst_turnover'
    if 'GSTR1' in c:
        return 'gst_purchases'
    if c.startswith(('TDS', 'TCS')):
        return 'tds_tcs'
    if c.startswith('SFT'):
        return 'sft'
    if 'INT' in c or 'interest' in d:
        return 'interest'
    if 'SAL' in c or 'salary' in d:
        return 'salary'
    if 'DIV' in c or 'dividend' in d:
        return 'dividend'
    return 'other'


def parse_pdf(path):
    import fitz
    doc = fitz.open(path)
    if doc.needs_pass:
        if not PWD or not doc.authenticate(PWD):
            return {'err': 'wrong/missing --password'}
    txt = "\n".join(p.get_text() for p in doc)
    lines = [l.strip() for l in txt.split('\n')]
    pan = (PAN_RE.findall(txt) or [None])
    pan = collections.Counter(PAN_RE.findall(txt)).most_common(1)[0][0] if PAN_RE.findall(txt) else None
    aym = re.search(r'\b(20\d\d)-(\d\d)\b', txt)
    ay = f"{aym.group(1)}-{aym.group(2)}" if aym else None
    cats = collections.defaultdict(float); samples = collections.defaultdict(list)
    # An info record is: [SR]\n[CODE]\n[DESC]\n[SOURCE]\n[COUNT]\n[AMOUNT]; amount is 4 lines after the code.
    MONTH_RE = re.compile(r'^[A-Z]{3}-20\d\d$')  # FEB-2026 etc. are period labels, not info codes
    for i, ln in enumerate(lines):
        if INFO_CODES.match(ln) and not MONTH_RE.match(ln) and not ln.startswith(('TDS-', 'TCS-')) and i + 4 < len(lines):
            desc = lines[i + 1]
            amt = inr(lines[i + 4])
            if amt is None:
                continue
            cat = categorize(ln, desc)
            cats[cat] += amt
            if len(samples[cat]) < 3:
                samples[cat].append(f"{ln}:{desc[:28]}={amt:,.0f}")
    # per-GSTIN GST-3B turnover (TOTAL TURNOVER column) — sum amounts on lines following a GSTIN
    gstin_tot = collections.defaultdict(float)
    for i, ln in enumerate(lines):
        g = GSTIN_RE.match(ln)
        if g and i + 2 < len(lines):
            v = inr(lines[i + 2])  # GSTIN \n period \n total-turnover
            if v is not None:
                gstin_tot[g.group(1)] += v
    return {'pan': pan, 'ay': ay, 'cats': dict(cats), 'samples': dict(samples), 'gstin_turnover': dict(gstin_tot)}


async def main():
    if not ARGS:
        print(__doc__); return
    path = ARGS[0]
    if path.lower().endswith('.pdf'):
        r = parse_pdf(path)
    else:
        print("Only PDF supported here (JSON from portal is encrypted)."); return
    if r.get('err'):
        print("ERROR:", r['err']); return
    print(f"=== AIS {os.path.basename(path)} | PAN {r['pan']} | AY {r['ay']} ===")
    for c in sorted(r['cats'], key=lambda x: -r['cats'][x]):
        print(f"  {c:14s}: Rs {r['cats'][c]:>14,.0f}   e.g. {r['samples'].get(c, [])[:2]}")
    print("  per-GSTIN GST-3B total turnover:")
    for g, v in r['gstin_turnover'].items():
        print(f"     {g}: Rs {v:,.0f}")
    if WRITE and r['pan']:
        from motor.motor_asyncio import AsyncIOMotorClient
        db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
        await db.ais_data.update_one(
            {"pan": r['pan'], "ay": r['ay']},
            {"$set": {"pan": r['pan'], "ay": r['ay'], "categories": r['cats'],
                      "gst_turnover": r['cats'].get('gst_turnover', 0),
                      "tds_tcs": r['cats'].get('tds_tcs', 0),
                      "gstin_turnover": r['gstin_turnover'], "source_file": os.path.basename(path),
                      "imported_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}},
            upsert=True)
        print("\n*** WROTE to ais_data ***")
    elif not WRITE:
        print("\n(dry-run — add --write)")

asyncio.run(main())

"""Import Electronics Bay (Delhi) Amazon MTR reports for 2024 + 2025 into db.amazon_mtr.

Reuses utils.amazon_mtr.parse_mtr_csv (same parser the /gst-audit importer uses). Merges the B2B and B2C
file for each month into one period, tags a reversible import_batch, and is idempotent per (firm, period, batch).

Run:   venv/bin/python scripts/import_ebdelhi_mtr_2024_2025.py            # DRY (parse + report, no writes)
       venv/bin/python scripts/import_ebdelhi_mtr_2024_2025.py --write   # write to db.amazon_mtr
       venv/bin/python scripts/import_ebdelhi_mtr_2024_2025.py --rollback # remove this batch
"""
import asyncio, glob, os, re, sys, uuid
from datetime import datetime, timezone
import motor.motor_asyncio
from dotenv import dotenv_values
sys.path.insert(0, "/var/www/crm/backend")
from utils import amazon_mtr as mtr

_MONTHS = {"JANUARY": "01", "FEBRUARY": "02", "MARCH": "03", "APRIL": "04", "MAY": "05", "JUNE": "06",
           "JULY": "07", "AUGUST": "08", "SEPTEMBER": "09", "OCTOBER": "10", "NOVEMBER": "11", "DECEMBER": "12"}


def _period_from_filename(fname):
    """MTR_B2C-JULY-2024-XXXX.csv -> '2024-07'. The Amazon file name IS the filing month (authoritative);
    parse_mtr_csv's mode-of-dates mislabels files that carry prior-month returns."""
    m = re.search(r"-([A-Z]+)-(\d{4})-", os.path.basename(fname).upper())
    if m and m.group(1) in _MONTHS:
        return f"{m.group(2)}-{_MONTHS[m.group(1)]}"
    return None

ENV = dotenv_values("/var/www/crm/backend/.env")
db = motor.motor_asyncio.AsyncIOMotorClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
FIRM = "76b41510-bb17-42be-887f-abcbfd9f4180"          # Electronics Bay (Delhi), GSTIN 07BLDPR5944R3Z5
BATCH = "amazon_ebdelhi_2024_2025"
SCR = "/tmp/claude-0/-var-www-crm/8e3bae77-2830-40dc-a44a-6335950d1f7c/scratchpad"
DIRS = [f"{SCR}/gootu2024", f"{SCR}/gootu2025"]
WRITE = "--write" in sys.argv
ROLLBACK = "--rollback" in sys.argv


async def rollback():
    r = await db.amazon_mtr.delete_many({"firm_id": FIRM, "import_batch": BATCH})
    print(f"rollback: removed {r.deleted_count} amazon_mtr rows (batch {BATCH})")


async def main():
    if ROLLBACK:
        return await rollback()
    csvs = []
    for d in DIRS:
        csvs += glob.glob(f"{d}/**/*.csv", recursive=True)
    csvs = [c for c in csvs if "MTR_" in os.path.basename(c).upper()]
    print(f"found {len(csvs)} MTR CSV files\n")

    # period_key -> {invoice_number: invoice_dict}   (merge B2B + B2C; invoice numbers don't overlap)
    per_period = {}
    file_rows = 0
    for f in sorted(csvs):
        with open(f, "rb") as fh:
            raw = fh.read()
        try:
            parsed = mtr.parse_mtr_csv(raw)
        except Exception as e:
            print(f"  ! skip {os.path.basename(f)}: {e}")
            continue
        pk = _period_from_filename(f) or parsed.get("period_key") or ""
        if not pk:
            print(f"  ! no period for {os.path.basename(f)}"); continue
        file_rows += parsed["line_count"]
        bucket = per_period.setdefault(pk, {})
        for invno, e in parsed["invoices"].items():
            bucket[invno] = e   # same invoice can't appear in both b2b and b2c
        typ = "B2B" if "B2B" in os.path.basename(f).upper() else "B2C"
        print(f"  {os.path.basename(f):40} period={pk} {typ}  invoices={len(parsed['invoices'])} lines={parsed['line_count']}")

    now = datetime.now(timezone.utc).isoformat()
    tot_inv = tot_b2b = 0
    tot_taxable = tot_tax = 0.0
    for pk, invs in sorted(per_period.items()):
        docs = [{"id": str(uuid.uuid4()), "firm_id": FIRM, "period_key": pk, "created_at": now,
                 "import_batch": BATCH, **e} for e in invs.values()]
        tot_inv += len(docs)
        tot_b2b += sum(1 for d in docs if d.get("is_b2b"))
        tot_taxable += sum(d.get("taxable", 0) for d in docs)
        tot_tax += sum(d.get("igst", 0) + d.get("cgst", 0) + d.get("sgst", 0) for d in docs)
        if WRITE:
            await db.amazon_mtr.delete_many({"firm_id": FIRM, "period_key": pk, "import_batch": BATCH})
            if docs:
                await db.amazon_mtr.insert_many(docs)

    print(f"\n{'WROTE' if WRITE else 'DRY (no writes)'} — periods={len(per_period)}  invoices={tot_inv}  "
          f"b2b={tot_b2b}  b2c={tot_inv - tot_b2b}")
    print(f"  net taxable ≈ ₹{tot_taxable:,.0f}   net GST ≈ ₹{tot_tax:,.0f}   (source rows parsed: {file_rows})")
    print("  periods:", ", ".join(sorted(per_period)))


asyncio.run(main())

"""Ingest customs Bill of Entry (OOC copy) PDFs from the service@ mailbox into import_shipments.

ICEGATE (noreply@icegate.gov.in) emails an "Electronic Final OOC copy of BoE" with the final
Bill of Entry PDF attached once goods are cleared. This module:
  - fetches those OOC emails over IMAP (read-only PEEK, never marks seen),
  - parses each BoE PDF's PART-I summary by coordinate (BCD / SWS / IGST / assessable / total duty),
  - maps the importer GSTIN to a firm,
  - creates an import_shipments record (dedup by boe_number) with the totals the GST audit reads
    (total_igst_customs = creditable import ITC), storing the PDF via storage.upload_file.

Used by the one-off backfill (migrations) and the scheduled poller (server.py startup, behind
BOE_INGEST_ENABLED). Pure IMAP + local PDF parse — no external API.
"""
import os, re, imaplib, email, uuid, datetime, asyncio, collections
from email.header import decode_header, make_header

import fitz  # PyMuPDF

GSTIN2FIRM = {'07AATCM1213F1ZM': ('16abb602-875d-4283-bed9-f8789e688a17', 'MGIPL'),
              '06BCSPR2468A1ZF': ('8bf93db6-045f-4aed-988c-352103ed049d', 'MuscleGrid Industries Gurgaon'),
              '09BPRPR2164D1ZK': ('c715c1b7-aca3-4100-8b00-4f711a729829', 'SPV Industries'),
              '07BLDPR5944R3Z5': ('76b41510-bb17-42be-887f-abcbfd9f4180', 'Electronics Bay'),
              '09BLDPR5944R1Z3': ('a9b65de0-ef07-47d7-b778-2a9f63ef52ab', 'EBAY UP')}
_LABELS = {'1.BCD': 'bcd', '3.SWS': 'sws', '7.IGST': 'igst', '18.TOT.ASS': 'assess', '14.TOTAL': 'total_duty'}
_GSTIN_RE = re.compile(r'\b(\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b')


def _dh(s):
    try:
        return str(make_header(decode_header(s or "")))
    except Exception:
        return s or ""


def _num(t):
    try:
        return float(str(t).replace(',', ''))
    except (TypeError, ValueError):
        return None


def parse_boe(pdf_bytes: bytes) -> dict:
    """Parse a BoE OOC PDF -> {boe_no, boe_date(ISO), gstin, assess, bcd, sws, igst, total_duty,
    country, verified}. Returns {'err': ...} on failure/encryption."""
    try:
        d = fitz.open(stream=pdf_bytes, filetype='pdf')
    except Exception as e:
        return {'err': f'open:{e}'}
    if d.needs_pass:
        return {'err': 'encrypted'}
    pg = d[0]
    full = pg.get_text()
    words = [(w[0], w[1], w[4]) for w in pg.get_text("words")]
    out = {}
    m = re.search(r'\b(\d{7})\b', full); out['boe_no'] = m.group(1) if m else None
    dm = re.search(r'\b(\d{2})/(\d{2})/(\d{4})\b', full)
    out['boe_date'] = f"{dm.group(3)}-{dm.group(2)}-{dm.group(1)}" if dm else None
    g = _GSTIN_RE.search(full); out['gstin'] = g.group(1) if g else None
    co = re.search(r'COUNTRY OF ORIGIN[\s\S]{0,40}?([A-Z]{4,})', full)
    out['country'] = co.group(1).title() if co else None
    # coordinate column mapping: value = nearest numeric word in the row(s) just below each label
    for x, y, t in words:
        for lab, fld in _LABELS.items():
            if t == lab or t.startswith(lab):
                cands = [(abs(wx - x), _num(wt)) for wx, wy, wt in words
                         if y < wy <= y + 14 and _num(wt) is not None]
                if cands:
                    out[fld] = min(cands, key=lambda z: z[0])[1]
    bcd, sws, igst, td = (out.get(k) or 0 for k in ('bcd', 'sws', 'igst', 'total_duty'))
    out['verified'] = bool(igst and td and abs((bcd + sws + igst) - td) < 2)
    return out


def _imap_conn():
    host = os.environ.get('EMAIL_AGENT_IMAP_HOST', 'imappro.zoho.in').strip()
    port = int(os.environ.get('EMAIL_AGENT_IMAP_PORT', '993'))
    box = imaplib.IMAP4_SSL(host, port)
    box.login(os.environ['EMAIL_AGENT_EMAIL'], os.environ['EMAIL_AGENT_PASSWORD'])
    box.select("INBOX", readonly=True)
    return box


def _fetch_ooc_blocking(limit: int = 500) -> list:
    """Return [{uid, subject, date, pdf}] for OOC-copy emails from ICEGATE."""
    box = _imap_conn()
    try:
        typ, data = box.uid("search", None, '(FROM "icegate" SUBJECT "OOC")')
        uids = [u.decode() if isinstance(u, bytes) else u
                for u in (data[0].split() if data and data[0] else [])][-limit:]
        out = []
        for u in uids:
            typ, md = box.uid("fetch", u, "(BODY.PEEK[])")
            if typ != 'OK' or not md or not md[0]:
                continue
            msg = email.message_from_bytes(md[0][1])
            pdf = None
            for part in msg.walk():
                fn = _dh(part.get_filename() or '')
                if part.get_content_type() == 'application/pdf' or fn.lower().endswith('.pdf'):
                    pdf = part.get_payload(decode=True); break
            if pdf:
                out.append({'uid': u, 'subject': _dh(msg.get('Subject', '')).replace('\n', ' '),
                            'date': msg.get('Date', ''), 'pdf': pdf})
        return out
    finally:
        try:
            box.logout()
        except Exception:
            pass


async def ingest(db, write: bool = False, store_pdf: bool = True, limit: int = 500) -> dict:
    """Fetch OOC emails, parse, and (if write) create import_shipments deduped by boe_number.
    Returns a summary dict."""
    mails = await asyncio.to_thread(_fetch_ooc_blocking, limit)
    existing = set()
    async for s in db.import_shipments.find({}, {'boe_number': 1}):
        if s.get('boe_number'):
            existing.add(str(s['boe_number']).strip())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    seen = set()
    created, skipped, failed, by_firm = 0, 0, 0, collections.defaultdict(lambda: [0, 0.0])
    docs = []
    for mail in mails:
        r = parse_boe(mail['pdf'])
        bno = r.get('boe_no')
        if r.get('err') or not bno:
            failed += 1; continue
        if bno in existing or bno in seen:
            skipped += 1; continue
        seen.add(bno)
        firm_id, firm_name = GSTIN2FIRM.get(r.get('gstin'), (None, r.get('gstin') or 'UNKNOWN'))
        assess = r.get('assess') or 0; bcd = r.get('bcd') or 0
        sws = r.get('sws') or 0; igst = r.get('igst') or 0
        total_duty = r.get('total_duty') or (bcd + sws + igst)
        pdf_path = None
        if write and store_pdf:
            try:
                from utils import storage
                pdf_path, _ = await storage.upload_file(mail['pdf'], "import_boe",
                                                        f"BOE_{bno}.pdf", filename_prefix=f"{bno}_")
            except Exception:
                pdf_path = None
        doc = {
            'id': str(uuid.uuid4()), 'shipment_number': bno, 'firm_id': firm_id, 'firm_name': firm_name,
            'boe_number': bno, 'boe_date': r.get('boe_date'),
            'period_key': (r.get('boe_date') or '')[:7] or None,
            'supplier_name': 'Import (China)' if (r.get('country') or '').lower().startswith('chin') else 'Import',
            'supplier_country': r.get('country') or 'China',
            'items': [], 'expenses': [],
            'totals': {
                'total_assessable_value': round(assess, 2), 'total_bcd': round(bcd, 2),
                'total_sws': round(sws, 2), 'total_igst_customs': round(igst, 2),
                'total_duties': round(total_duty, 2), 'total_gst_claimable': round(igst, 2),
            },
            'boe_file': pdf_path, 'invoice_file': pdf_path,
            'status': 'draft', 'source': 'boe_email_ingest', 'parse_verified': r.get('verified'),
            'email_subject': mail['subject'], 'email_date': mail['date'],
            'notes': 'Auto-ingested from ICEGATE OOC-copy email. Customs IGST is creditable ITC.',
            'created_by_name': 'BoE email ingest', 'created_at': now,
        }
        docs.append(doc)
        created += 1
        by_firm[firm_name][0] += 1; by_firm[firm_name][1] += igst
    if write and docs:
        await db.import_shipments.insert_many(docs, ordered=False)
    return {'emails': len(mails), 'created': created, 'skipped': skipped, 'failed': failed,
            'wrote': bool(write and docs), 'by_firm': {k: {'boes': v[0], 'igst_itc': round(v[1], 2)}
                                                       for k, v in by_firm.items()}}


async def scheduled_boe_ingest():
    """Scheduler entrypoint: ingest new OOC BoEs (write=True). Guarded by BOE_INGEST_ENABLED in server."""
    import logging
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    try:
        res = await ingest(db, write=True, store_pdf=True)
        logging.getLogger("boe_ingest").info("BoE ingest: %s", res)
    finally:
        client.close()

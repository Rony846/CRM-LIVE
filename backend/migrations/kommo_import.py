"""Pull leads / contacts / companies / pipelines / notes from a Kommo (amoCRM) account into
raw mirror collections (kommo_leads, kommo_contacts, kommo_companies, kommo_pipelines,
kommo_lead_notes, kommo_contact_notes). Read-only against Kommo.

Requires in backend/.env:
    KOMMO_SUBDOMAIN=yourcompany           # the part before .kommo.com
    KOMMO_ACCESS_TOKEN=<long-lived token> # Settings -> Integrations -> long-lived token (read scopes)

Usage:
    ./venv/bin/python migrations/kommo_import.py            # dry-run (counts only, page 1 of each)
    ./venv/bin/python migrations/kommo_import.py --write    # pull everything and persist

Chats caveat: WhatsApp message transcripts are not in /api/v4. This pulls all NOTES (lead +
contact), which is where message text shows up when it does; full chat history lives behind
Kommo's Chats/amojo API (separate channel integration) and is reported as a gap if absent.
"""
import os, sys, json, time, urllib.request, urllib.parse, urllib.error, asyncio, datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

SUB = os.environ.get('KOMMO_SUBDOMAIN', '').strip()
TOKEN = os.environ.get('KOMMO_ACCESS_TOKEN', '').strip()
BASE = f"https://{SUB}.kommo.com"
WRITE = '--write' in sys.argv


def kommo_get(path, params=None, retries=3):
    url = f"{BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                if r.status == 204:
                    return None
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 204:
                return None
            if e.code == 429 and attempt < retries - 1:
                time.sleep(2 * (attempt + 1)); continue
            body = ''
            try:
                body = e.read().decode()[:200]
            except Exception:
                pass
            raise RuntimeError(f"Kommo {e.code} on {path}: {body}")
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1); continue
            raise


def paginate(path, embedded_key, page_limit=None):
    """Yield all items from a paginated Kommo v4 endpoint."""
    page = 1
    while True:
        data = kommo_get(path, {"page": page, "limit": 250})
        if not data:
            break
        items = (data.get("_embedded", {}) or {}).get(embedded_key, []) or []
        if not items:
            break
        for it in items:
            yield it
        if page_limit and page >= page_limit:
            break
        if not (data.get("_links", {}) or {}).get("next"):
            break
        page += 1
        time.sleep(0.2)  # be gentle on the ~7 req/s limit


async def main():
    if not SUB or not TOKEN:
        print("KOMMO_SUBDOMAIN / KOMMO_ACCESS_TOKEN not set in backend/.env — add them and re-run.")
        return
    # connectivity check
    try:
        me = kommo_get("/api/v4/account")
        print(f"Connected to Kommo: {me.get('name')} (id {me.get('id')}, {BASE})")
    except Exception as e:
        print("Auth/connection failed:", e); return

    c = AsyncIOMotorClient(os.environ['MONGO_URL']); db = c[os.environ['DB_NAME']]
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    plan = [
        ("/api/v4/leads/pipelines", "pipelines", "kommo_pipelines"),
        ("/api/v4/leads", "leads", "kommo_leads"),
        ("/api/v4/contacts", "contacts", "kommo_contacts"),
        ("/api/v4/companies", "companies", "kommo_companies"),
        ("/api/v4/leads/notes", "notes", "kommo_lead_notes"),
        ("/api/v4/contacts/notes", "notes", "kommo_contact_notes"),
    ]
    summary = {}
    for path, key, coll in plan:
        try:
            items = list(paginate(path, key, page_limit=None if WRITE else 1))
        except Exception as e:
            print(f"  {coll}: FETCH ERROR — {e}"); summary[coll] = "error"; continue
        summary[coll] = len(items)
        if WRITE and items:
            docs = []
            for it in items:
                it["_kommo_pulled_at"] = now
                it["id"] = it.get("id")
                docs.append(it)
            await db[coll].delete_many({})
            # insert in chunks
            for i in range(0, len(docs), 1000):
                await db[coll].insert_many(docs[i:i+1000], ordered=False)
        print(f"  {coll}: {len(items)}{' (page-1 sample, dry-run)' if not WRITE else ' WRITTEN'}")

    # chat / message diagnostics: how many notes carry message text
    if WRITE:
        msg_notes = 0
        async for n in db.kommo_lead_notes.find({"note_type": {"$regex": "message|chat|sms|whats", "$options": "i"}}, {"id": 1}):
            msg_notes += 1
        print(f"\nMessage-type notes (chat content reachable via notes): {msg_notes}")
        types = {}
        async for n in db.kommo_lead_notes.find({}, {"note_type": 1}):
            types[n.get("note_type")] = types.get(n.get("note_type"), 0) + 1
        print("lead note_type breakdown:", dict(sorted(types.items(), key=lambda x: -x[1])[:12]))

    print(f"\n{'WROTE to kommo_* collections' if WRITE else 'DRY-RUN — add --write to persist'}. Summary:", summary)

asyncio.run(main())

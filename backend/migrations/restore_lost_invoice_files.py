"""One-off: restore the 2 pre-29-Mar invoice files that still have local copies.

These tickets' invoices were never persisted to the file API (it went live ~29 Mar),
so the stored /api/files/... reference 404s. For the 2 tickets whose original upload
still survives in backend/uploads/invoices/, we re-upload the bytes to the file API
and repoint the ticket's invoice_file at the new path. (The other 11 lost invoices
have no surviving copy and can only be re-collected from the source.)

Run:  cd /var/www/crm/backend && ./venv/bin/python migrations/restore_lost_invoice_files.py
"""
import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from utils.storage import upload_file  # noqa: E402

db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
LOCAL_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "invoices")

# ticket_number -> local filename (verified present on disk earlier)
TARGETS = {
    "MG-R-20260321-03255": "c9a15b9f-4e00-4e55-aea0-5c23a1b2f7a7.pdf",  # Amit Kumar
    "MG-R-20260321-17469": "17b06add-0ae7-4e10-8572-abfff25e6b04.pdf",  # Electronics Bay
}


async def main():
    for ticket_number, filename in TARGETS.items():
        path = os.path.join(LOCAL_DIR, filename)
        if not os.path.exists(path):
            print(f"  {ticket_number}: local copy {filename} not found — SKIP")
            continue
        with open(path, "rb") as fh:
            data = fh.read()

        rel_path, storage_type = await upload_file(
            file_data=data, folder="invoices", original_filename=filename
        )
        new_url = f"/api/files/{rel_path}"
        res = await db.tickets.update_one(
            {"ticket_number": ticket_number},
            {"$set": {"invoice_file": new_url,
                      "invoice_file_restored": True,
                      "invoice_file_restored_note": "Re-uploaded from local copy 2026-05-29 (pre-29-Mar file-API gap)"}},
        )
        print(f"  {ticket_number}: uploaded {len(data)}b -> {rel_path} "
              f"({storage_type}); ticket updated={res.modified_count}")


asyncio.run(main())

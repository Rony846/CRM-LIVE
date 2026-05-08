"""
Generate jobcard PDFs for all existing tickets
"""
import asyncio
import os
import sys
os.chdir('/app/backend')
sys.path.insert(0, '/app/backend')

from dotenv import load_dotenv
load_dotenv('.env')

from motor.motor_asyncio import AsyncIOMotorClient
from utils.jobcard import create_and_upload_jobcard
from utils.storage import download_file

import logging
logging.getLogger('fontTools').setLevel(logging.WARNING)
logging.getLogger('weasyprint').setLevel(logging.WARNING)

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

async def generate_all_jobcards():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get all tickets
    tickets = await db.tickets.find({}, {"_id": 0}).to_list(length=1000)
    print(f"Found {len(tickets)} tickets")
    
    success = 0
    failed = 0
    
    for i, ticket in enumerate(tickets, 1):
        ticket_id = ticket.get("id", "unknown")
        ticket_number = ticket.get("ticket_number", ticket_id[:8])
        
        print(f"[{i}/{len(tickets)}] {ticket_number}...", end=" ", flush=True)
        
        # Try to get invoice data
        invoice_data = None
        invoice_path = ticket.get("invoice_file")
        if invoice_path:
            try:
                relative_path = invoice_path.replace("/api/files/", "")
                invoice_data = await download_file(relative_path)
            except:
                pass
        
        try:
            jobcard_path = await create_and_upload_jobcard(ticket, invoice_data)
            await db.tickets.update_one(
                {"id": ticket_id},
                {"$set": {"jobcard_path": f"/api/files/{jobcard_path}"}}
            )
            print(f"OK")
            success += 1
        except Exception as e:
            print(f"FAILED: {e}")
            failed += 1
    
    client.close()
    print(f"\nComplete: {success} success, {failed} failed")

if __name__ == "__main__":
    asyncio.run(generate_all_jobcards())

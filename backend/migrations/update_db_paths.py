"""
MuscleGrid CRM - Production Database Path Updater
Updates file path references in database from old format to new NAS format

This script is for updating paths in your PRODUCTION database after you've
manually uploaded files to the NAS.

Usage:
    python update_db_paths.py --mongo-url "mongodb://..." --db-name "crm_prod" --dry-run
    python update_db_paths.py --mongo-url "mongodb://..." --db-name "crm_prod"

This handles paths like:
    /api/files/pickup_labels/xxx.pdf -> /api/files/tickets/xxx.pdf
    /uploads/invoices/xxx.pdf -> /api/files/invoices/xxx.pdf
"""

import os
import sys
import asyncio
import argparse
import json
import re
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List

from motor.motor_asyncio import AsyncIOMotorClient

# Folder mapping (old folder -> new NAS folder)
FOLDER_MAPPING = {
    "pickup_labels": "tickets",
    "dispatch_labels": "tickets",
    "labels": "tickets",
    "service_invoices": "invoices",
    "warranty_invoices": "invoices",
    "purchase_invoices": "invoices",
    "payment_proofs": "payments",
    "deposits": "payments",
    "dealer_deposits": "payments",
    "dealer_payments": "payments",
    "feedback_screenshots": "tickets",
    "reviews": "tickets",
    "dealer_tickets": "tickets",
    "dealer_documents": "tickets",
    "quotations": "invoices",
    "general": "tickets",
    # Keep these as-is
    "invoices": "invoices",
    "tickets": "tickets",
    "payments": "payments",
    "certificates": "certificates"
}

# Database collections and their file path fields
DB_FILE_FIELDS = {
    "tickets": [
        "invoice_file",
        "pickup_label",
        "service_invoice",
        "return_label"
    ],
    "warranties": [
        "invoice_file",
        "admin_invoice_file",
        "extension_review_file"
    ],
    "dispatches": [
        "label_file",
        "invoice_file"
    ],
    "purchases": [
        "invoice_file"
    ],
    "dealers": [
        "security_deposit_proof_path"
    ],
    "dealer_orders": [
        "payment_proof_path"
    ],
    "dealer_tickets": [
        "attachment_path"
    ],
    "feedback_calls": [
        "feedback_screenshot"
    ]
}


def transform_path(old_path: str) -> str:
    """Transform old path format to new NAS format"""
    if not old_path:
        return old_path
    
    # Extract the relative path
    # /api/files/pickup_labels/file.pdf -> pickup_labels/file.pdf
    # /uploads/invoices/file.pdf -> invoices/file.pdf
    
    relative_path = old_path
    if old_path.startswith("/api/files/"):
        relative_path = old_path[11:]
    elif old_path.startswith("/uploads/"):
        relative_path = old_path[9:]
    
    # Split into folder and filename
    parts = relative_path.split("/", 1)
    if len(parts) != 2:
        return old_path  # Can't transform, return as-is
    
    old_folder, filename = parts
    
    # Map to new folder
    new_folder = FOLDER_MAPPING.get(old_folder, old_folder)
    
    # Return new path format
    return f"/api/files/{new_folder}/{filename}"


async def update_database_paths(mongo_url: str, db_name: str, dry_run: bool = False):
    """Update all file path references in database"""
    
    print("=" * 60)
    print("MuscleGrid CRM - Database Path Updater")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE UPDATE'}")
    print(f"Database: {db_name}")
    print("=" * 60)
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    total_updated = 0
    total_errors = 0
    changes = []
    
    for collection_name, fields in DB_FILE_FIELDS.items():
        print(f"\nProcessing {collection_name}...")
        collection = db[collection_name]
        
        for field in fields:
            # Find documents with file paths
            query = {
                "$or": [
                    {field: {"$regex": "^/api/files/"}},
                    {field: {"$regex": "^/uploads/"}}
                ]
            }
            
            cursor = collection.find(query)
            
            async for doc in cursor:
                old_path = doc.get(field)
                if not old_path:
                    continue
                
                new_path = transform_path(old_path)
                
                if old_path != new_path:
                    doc_id = str(doc.get("id", doc["_id"]))
                    change = {
                        "collection": collection_name,
                        "doc_id": doc_id,
                        "field": field,
                        "old_path": old_path,
                        "new_path": new_path
                    }
                    changes.append(change)
                    
                    if dry_run:
                        print(f"  [DRY-RUN] {collection_name}.{field}: {old_path} -> {new_path}")
                    else:
                        try:
                            await collection.update_one(
                                {"_id": doc["_id"]},
                                {"$set": {field: new_path}}
                            )
                            total_updated += 1
                            print(f"  Updated {collection_name}.{field}: {old_path} -> {new_path}")
                        except Exception as e:
                            total_errors += 1
                            print(f"  ERROR updating {doc_id}: {e}")
    
    client.close()
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total paths to update: {len(changes)}")
    print(f"Records updated: {total_updated}")
    print(f"Errors: {total_errors}")
    
    # Save changes report
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_name,
        "dry_run": dry_run,
        "total_changes": len(changes),
        "changes": changes
    }
    
    report_path = f"path_update_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to: {report_path}")
    
    if dry_run:
        print("\nDRY RUN COMPLETE - No changes were made")
        print("Run without --dry-run to apply changes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update database file paths for NAS migration")
    parser.add_argument("--mongo-url", required=True, help="MongoDB connection URL")
    parser.add_argument("--db-name", required=True, help="Database name")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without executing")
    args = parser.parse_args()
    
    asyncio.run(update_database_paths(args.mongo_url, args.db_name, args.dry_run))

"""
MuscleGrid CRM - File Migration Script
Migrates all local files to Synology NAS and updates database references

Usage:
    python migrate_files_to_nas.py --dry-run    # Preview changes without executing
    python migrate_files_to_nas.py              # Execute migration

This script:
1. Scans /app/backend/uploads/ for all files
2. Uploads each file to NAS via File API
3. Updates all database references to new paths
4. Generates a detailed migration report
"""

import os
import sys
import asyncio
import argparse
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Tuple, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

import requests
from motor.motor_asyncio import AsyncIOMotorClient

# Configuration
FILE_API_URL = os.environ.get("FILE_API_URL", "https://files.musclegrid.in")
FILE_API_KEY = os.environ.get("FILE_API_KEY", "")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
LOCAL_UPLOAD_DIR = Path(__file__).parent.parent / "uploads"

# Folder mapping (local folder -> NAS folder)
FOLDER_MAPPING = {
    "invoices": "invoices",
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


class MigrationReport:
    def __init__(self):
        self.start_time = datetime.now(timezone.utc)
        self.files_found = 0
        self.files_uploaded = 0
        self.files_failed = []
        self.files_skipped = []
        self.db_records_updated = 0
        self.db_update_errors = []
        self.path_mappings = {}  # old_path -> new_path
        
    def to_dict(self):
        return {
            "start_time": self.start_time.isoformat(),
            "end_time": datetime.now(timezone.utc).isoformat(),
            "summary": {
                "files_found": self.files_found,
                "files_uploaded": self.files_uploaded,
                "files_failed": len(self.files_failed),
                "files_skipped": len(self.files_skipped),
                "db_records_updated": self.db_records_updated,
                "db_update_errors": len(self.db_update_errors)
            },
            "failed_files": self.files_failed,
            "skipped_files": self.files_skipped,
            "db_errors": self.db_update_errors,
            "path_mappings": self.path_mappings
        }
    
    def save(self, filepath: str):
        with open(filepath, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)
        print(f"\nReport saved to: {filepath}")


def get_api_headers():
    return {"x-api-key": FILE_API_KEY}


def upload_file_to_nas(file_path: Path, folder: str) -> Tuple[bool, str, str]:
    """
    Upload a file to NAS
    Returns: (success, new_path, error_message)
    """
    nas_folder = FOLDER_MAPPING.get(folder, "tickets")
    
    try:
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        url = f"{FILE_API_URL}/upload/{nas_folder}"
        files = {"file": (file_path.name, file_data)}
        
        response = requests.post(url, headers=get_api_headers(), files=files, timeout=120)
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success") and result.get("file"):
                new_path = f"{nas_folder}/{result['file']}"
                return True, new_path, ""
            return False, "", f"Unexpected response: {result}"
        else:
            return False, "", f"HTTP {response.status_code}: {response.text[:200]}"
            
    except Exception as e:
        return False, "", str(e)


def scan_local_files() -> List[Tuple[Path, str]]:
    """Scan local uploads directory and return list of (file_path, folder_name)"""
    files = []
    
    if not LOCAL_UPLOAD_DIR.exists():
        print(f"Upload directory not found: {LOCAL_UPLOAD_DIR}")
        return files
    
    for folder in LOCAL_UPLOAD_DIR.iterdir():
        if folder.is_dir():
            for file_path in folder.iterdir():
                if file_path.is_file():
                    files.append((file_path, folder.name))
    
    return files


async def update_database_references(db, report: MigrationReport, dry_run: bool):
    """Update all database references from old paths to new paths"""
    
    for collection_name, fields in DB_FILE_FIELDS.items():
        collection = db[collection_name]
        
        for field in fields:
            # Find all documents with this field containing /api/files/ or /uploads/
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
                
                # Extract relative path from old path
                # /api/files/invoices/filename.pdf -> invoices/filename.pdf
                # /uploads/invoices/filename.pdf -> invoices/filename.pdf
                relative_path = old_path
                if old_path.startswith("/api/files/"):
                    relative_path = old_path[11:]  # Remove /api/files/
                elif old_path.startswith("/uploads/"):
                    relative_path = old_path[9:]   # Remove /uploads/
                
                # Check if we have a new path mapping
                new_path = report.path_mappings.get(relative_path)
                
                if new_path:
                    new_api_path = f"/api/files/{new_path}"
                    
                    if dry_run:
                        print(f"  [DRY-RUN] Would update {collection_name}.{field}: {old_path} -> {new_api_path}")
                    else:
                        try:
                            await collection.update_one(
                                {"_id": doc["_id"]},
                                {"$set": {field: new_api_path}}
                            )
                            report.db_records_updated += 1
                        except Exception as e:
                            report.db_update_errors.append({
                                "collection": collection_name,
                                "field": field,
                                "doc_id": str(doc.get("id", doc["_id"])),
                                "error": str(e)
                            })


async def run_migration(dry_run: bool = False):
    """Main migration function"""
    
    print("=" * 60)
    print("MuscleGrid CRM - File Migration to NAS")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (no changes will be made)' if dry_run else 'LIVE MIGRATION'}")
    print(f"Source: {LOCAL_UPLOAD_DIR}")
    print(f"Destination: {FILE_API_URL}")
    print(f"Database: {DB_NAME}")
    print("=" * 60)
    
    if not FILE_API_KEY:
        print("ERROR: FILE_API_KEY not configured in .env")
        return
    
    report = MigrationReport()
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Phase 1: Scan and upload files
    print("\n[Phase 1] Scanning local files...")
    files = scan_local_files()
    report.files_found = len(files)
    print(f"Found {len(files)} files to migrate")
    
    if len(files) == 0:
        print("No files found to migrate.")
    else:
        print("\n[Phase 2] Uploading files to NAS...")
        for i, (file_path, folder) in enumerate(files, 1):
            relative_path = f"{folder}/{file_path.name}"
            print(f"  [{i}/{len(files)}] {relative_path}...", end=" ")
            
            if dry_run:
                print("[DRY-RUN] Would upload")
                # Create a mock mapping for dry run
                nas_folder = FOLDER_MAPPING.get(folder, "tickets")
                report.path_mappings[relative_path] = f"{nas_folder}/{file_path.name}"
            else:
                success, new_path, error = upload_file_to_nas(file_path, folder)
                
                if success:
                    print(f"OK -> {new_path}")
                    report.files_uploaded += 1
                    report.path_mappings[relative_path] = new_path
                else:
                    print(f"FAILED: {error}")
                    report.files_failed.append({
                        "file": relative_path,
                        "error": error
                    })
    
    # Phase 3: Update database references
    print("\n[Phase 3] Updating database references...")
    await update_database_references(db, report, dry_run)
    
    # Close MongoDB connection
    client.close()
    
    # Print summary
    print("\n" + "=" * 60)
    print("MIGRATION SUMMARY")
    print("=" * 60)
    print(f"Files found:      {report.files_found}")
    print(f"Files uploaded:   {report.files_uploaded}")
    print(f"Files failed:     {len(report.files_failed)}")
    print(f"Files skipped:    {len(report.files_skipped)}")
    print(f"DB records updated: {report.db_records_updated}")
    print(f"DB update errors: {len(report.db_update_errors)}")
    
    if report.files_failed:
        print("\nFailed files:")
        for item in report.files_failed[:10]:
            print(f"  - {item['file']}: {item['error']}")
        if len(report.files_failed) > 10:
            print(f"  ... and {len(report.files_failed) - 10} more")
    
    # Save report
    report_path = Path(__file__).parent / f"migration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    report.save(str(report_path))
    
    print("\n" + "=" * 60)
    if dry_run:
        print("DRY RUN COMPLETE - No changes were made")
        print("Run without --dry-run to execute the migration")
    else:
        print("MIGRATION COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate files from local storage to NAS")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without executing")
    args = parser.parse_args()
    
    asyncio.run(run_migration(dry_run=args.dry_run))

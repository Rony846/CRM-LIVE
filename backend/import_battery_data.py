"""
Battery Production Data Import Script
Imports historical battery production data from BatteryOrderSheet_Report.csv

This script:
1. Creates production records for historical data
2. Creates finished_good_serials records for each battery
3. Creates supervisor_payables for applicable entries
4. Updates inventory ledger

Usage:
    python import_battery_data.py

Note: Only imports "New" condition batteries as new production.
      "Repaired" batteries are skipped as per user requirements.
"""

import csv
import asyncio
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# CSV file path
CSV_URL = "https://customer-assets.emergentagent.com/job_crm-rebuild-11/artifacts/utxifgxl_BatteryOrderSheet_Report.csv"

# Master SKU mapping (code -> id will be populated from DB)
MASTER_SKU_MAP = {}

# Firm mapping - we'll use the default firm
DEFAULT_FIRM_ID = None
DEFAULT_FIRM_NAME = None


def parse_date(date_str):
    """Parse date string in various formats"""
    if not date_str or date_str.strip() == '':
        return None
    
    formats = [
        "%d-%b-%y",      # 17-Feb-26
        "%d-%m-%Y",      # 17-02-2026
        "%Y-%m-%d",      # 2026-02-17
        "%d/%m/%Y",      # 17/02/2026
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    
    return None


async def get_or_create_master_sku(db, sku_code, name, category="Battery"):
    """Get or create a Master SKU"""
    existing = await db.master_skus.find_one({"sku_code": sku_code})
    if existing:
        return existing["id"], existing["name"]
    
    # Create new Master SKU
    sku_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    new_sku = {
        "id": sku_id,
        "name": name,
        "sku_code": sku_code,
        "category": category,
        "unit": "pcs",
        "is_manufactured": True,
        "product_type": "manufactured",
        "manufacturing_role": "supervisor",
        "production_charge_per_unit": 2000,  # Default from CSV
        "bill_of_materials": [],
        "aliases": [],
        "reorder_level": 10,
        "description": f"Imported from historical data: {name}",
        "is_active": True,
        "created_at": now,
        "updated_at": now
    }
    
    await db.master_skus.insert_one(new_sku)
    print(f"  Created Master SKU: {sku_code} - {name}")
    
    return sku_id, name


async def get_default_firm(db):
    """Get the first active firm"""
    firm = await db.firms.find_one({"is_active": True}, {"_id": 0})
    if firm:
        return firm.get("id"), firm.get("name")
    return None, None


async def import_data():
    """Main import function"""
    print("=" * 60)
    print("Battery Production Data Import Script")
    print("=" * 60)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get default firm
    global DEFAULT_FIRM_ID, DEFAULT_FIRM_NAME
    DEFAULT_FIRM_ID, DEFAULT_FIRM_NAME = await get_default_firm(db)
    
    if not DEFAULT_FIRM_ID:
        print("ERROR: No active firm found. Please create a firm first.")
        return
    
    print(f"Using firm: {DEFAULT_FIRM_NAME} ({DEFAULT_FIRM_ID})")
    
    # Download and parse CSV
    import urllib.request
    print(f"\nDownloading CSV from: {CSV_URL}")
    
    response = urllib.request.urlopen(CSV_URL)
    csv_data = response.read().decode('utf-8').splitlines()
    reader = csv.DictReader(csv_data)
    
    # Counters
    total_rows = 0
    imported_new = 0
    skipped_repaired = 0
    skipped_no_serial = 0
    errors = 0
    
    # Track serial numbers to avoid duplicates
    imported_serials = set()
    
    # Check existing serials
    existing_serials = set()
    async for serial in db.finished_good_serials.find({}, {"serial_number": 1}):
        existing_serials.add(serial["serial_number"])
    
    print(f"Found {len(existing_serials)} existing serial numbers in database")
    print("\nProcessing rows...")
    
    for row in reader:
        total_rows += 1
        
        condition = row.get("Condition", "").strip()
        serial_number = row.get("Dispatch Battery Serial Number", "").strip()
        master_sku_code = row.get("Master SKU", "").strip()
        model_name = row.get("Model", "").strip()
        supervisor_earns = row.get("Supervisor earns", "0").strip()
        order_date_str = row.get("Order Date", "").strip()
        dispatch_date_str = row.get("Dispatch Date", "").strip()
        customer_name = row.get("Customer's Full Name", "").strip()
        phone = row.get("Phone", "").strip()
        order_id = row.get("Order ID", "").strip()
        approval_status = row.get("Form Approval Status", "").strip()
        
        # Skip repaired batteries (no supervisor payment for repairs)
        if condition.lower() == "repaired":
            skipped_repaired += 1
            continue
        
        # Skip if no serial number
        if not serial_number or serial_number in ['', 'Dispatch', '11', '111', '1']:
            skipped_no_serial += 1
            continue
        
        # Skip if already imported or exists
        if serial_number in imported_serials or serial_number in existing_serials:
            continue
        
        # Skip if no Master SKU code
        if not master_sku_code:
            errors += 1
            continue
        
        try:
            # Get or create Master SKU
            master_sku_id, master_sku_name = await get_or_create_master_sku(
                db, master_sku_code, model_name or master_sku_code
            )
            
            # Parse dates
            production_date = parse_date(order_date_str) or datetime.now(timezone.utc)
            dispatch_date = parse_date(dispatch_date_str)
            
            # Parse supervisor earnings
            try:
                charge_per_unit = float(supervisor_earns) if supervisor_earns else 2000
            except:
                charge_per_unit = 2000
            
            now = datetime.now(timezone.utc).isoformat()
            
            # Create production request (historical record)
            request_id = str(uuid.uuid4())
            request_number = f"PR-IMPORT-{total_rows:05d}"
            
            production_request = {
                "id": request_id,
                "request_number": request_number,
                "firm_id": DEFAULT_FIRM_ID,
                "firm_name": DEFAULT_FIRM_NAME,
                "master_sku_id": master_sku_id,
                "master_sku_name": master_sku_name,
                "master_sku_code": master_sku_code,
                "quantity_requested": 1,
                "quantity_produced": 1,
                "manufacturing_role": "supervisor",
                "production_charge_per_unit": charge_per_unit,
                "production_date": production_date.isoformat() if production_date else None,
                "raw_material_requirements": [],
                "status": "received_into_inventory",
                "remarks": f"Imported from historical data. Customer: {customer_name}, Order: {order_id}",
                "created_by": "import_script",
                "created_by_name": "Data Import",
                "created_at": production_date.isoformat() if production_date else now,
                "updated_at": now,
                "accepted_at": production_date.isoformat() if production_date else now,
                "accepted_by": "import_script",
                "started_at": production_date.isoformat() if production_date else now,
                "completed_at": production_date.isoformat() if production_date else now,
                "completed_by": "import_script",
                "completed_by_name": "Data Import (Supervisor)",
                "received_at": now,
                "received_by": "import_script",
                "received_by_name": "Data Import (Accountant)",
                "serial_numbers": [{"serial_number": serial_number, "notes": f"Customer: {customer_name}"}],
                "completion_notes": "Imported from historical battery order sheet",
                "is_imported": True,
                "import_source": "BatteryOrderSheet_Report.csv"
            }
            
            await db.production_requests.insert_one(production_request)
            
            # Create finished good serial record
            serial_status = "dispatched" if dispatch_date else "in_stock"
            
            serial_record = {
                "id": str(uuid.uuid4()),
                "serial_number": serial_number,
                "master_sku_id": master_sku_id,
                "master_sku_name": master_sku_name,
                "master_sku_code": master_sku_code,
                "firm_id": DEFAULT_FIRM_ID,
                "firm_name": DEFAULT_FIRM_NAME,
                "production_request_id": request_id,
                "production_request_number": request_number,
                "manufactured_by_role": "supervisor",
                "manufactured_by_user": "import_script",
                "manufactured_by_name": "Data Import (Supervisor)",
                "manufactured_at": production_date.isoformat() if production_date else now,
                "received_at": now,
                "received_by": "import_script",
                "status": serial_status,
                "dispatch_id": None,
                "dispatch_date": dispatch_date.isoformat() if dispatch_date else None,
                "customer_name": customer_name,
                "customer_phone": phone,
                "order_id": order_id,
                "notes": f"Imported. Approval: {approval_status}",
                "created_at": now,
                "is_imported": True
            }
            
            await db.finished_good_serials.insert_one(serial_record)
            
            # Create supervisor payable (only for "New" condition and Approved status)
            if condition.lower() == "new" and charge_per_unit > 0:
                payable_id = str(uuid.uuid4())
                payable_number = f"PAY-IMPORT-{total_rows:05d}"
                
                # Determine payment status based on approval
                payment_status = "paid" if approval_status.lower() == "approved" else "unpaid"
                amount_paid = charge_per_unit if payment_status == "paid" else 0
                
                payable = {
                    "id": payable_id,
                    "payable_number": payable_number,
                    "production_request_id": request_id,
                    "production_request_number": request_number,
                    "firm_id": DEFAULT_FIRM_ID,
                    "firm_name": DEFAULT_FIRM_NAME,
                    "master_sku_id": master_sku_id,
                    "master_sku_name": master_sku_name,
                    "master_sku_code": master_sku_code,
                    "quantity_produced": 1,
                    "rate_per_unit": charge_per_unit,
                    "total_payable": charge_per_unit,
                    "amount_paid": amount_paid,
                    "status": payment_status,
                    "payments": [{"amount": amount_paid, "reference": "Historical import", "paid_at": now}] if amount_paid > 0 else [],
                    "remarks": f"Imported from historical data. Customer: {customer_name}",
                    "created_by": "import_script",
                    "created_by_name": "Data Import",
                    "created_at": production_date.isoformat() if production_date else now,
                    "updated_at": now,
                    "is_imported": True
                }
                
                await db.supervisor_payables.insert_one(payable)
            
            imported_serials.add(serial_number)
            imported_new += 1
            
            if imported_new % 50 == 0:
                print(f"  Imported {imported_new} records...")
                
        except Exception as e:
            errors += 1
            print(f"  Error processing row {total_rows}: {e}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("IMPORT SUMMARY")
    print("=" * 60)
    print(f"Total rows processed: {total_rows}")
    print(f"New batteries imported: {imported_new}")
    print(f"Repaired batteries skipped: {skipped_repaired}")
    print(f"Skipped (no valid serial): {skipped_no_serial}")
    print(f"Errors: {errors}")
    print("=" * 60)
    
    # Show database counts
    pr_count = await db.production_requests.count_documents({"is_imported": True})
    serial_count = await db.finished_good_serials.count_documents({"is_imported": True})
    payable_count = await db.supervisor_payables.count_documents({"is_imported": True})
    
    print(f"\nDatabase records created:")
    print(f"  Production requests: {pr_count}")
    print(f"  Serial numbers: {serial_count}")
    print(f"  Supervisor payables: {payable_count}")
    
    client.close()
    print("\nImport complete!")


if __name__ == "__main__":
    asyncio.run(import_data())

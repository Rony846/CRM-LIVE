"""
Import Battery Production Data from CSV
- Excludes Repaired batteries
- Excludes entries without valid serial numbers (must start with MG and be >5 chars)
- Excludes duplicates (keeps first occurrence)
"""

import csv
from pymongo import MongoClient
from datetime import datetime, timezone
import uuid

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017')
db = client['test_database']

def parse_date(date_str):
    """Parse various date formats from CSV"""
    if not date_str or date_str.strip() == '':
        return None
    
    formats = [
        '%d-%b-%y',      # 17-Feb-26
        '%d-%m-%Y',      # 17-02-2026
        '%d/%m/%Y',      # 17/02/2026
        '%Y-%m-%d',      # 2026-02-17
    ]
    
    date_str = date_str.strip()
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None

def normalize_serial(serial):
    """Normalize serial number for comparison"""
    if not serial:
        return None
    return serial.strip().upper().replace(' ', '')

def is_valid_serial(serial):
    """Check if serial number is valid (starts with MG and length > 5)"""
    normalized = normalize_serial(serial)
    if not normalized:
        return False
    return normalized.startswith('MG') and len(normalized) > 5

def import_production_data():
    print("Starting production data import...")
    
    # Read CSV
    with open('/app/BatteryOrderSheet_Report.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    print(f"Total rows in CSV: {len(rows)}")
    
    # Filter: New only, valid serial numbers
    new_batteries = []
    for row in rows:
        condition = row.get('Condition', '').strip()
        serial = row.get('Dispatch Battery Serial Number', '').strip()
        
        # Skip repaired batteries
        if condition != 'New':
            continue
        
        # Skip invalid serials
        if not is_valid_serial(serial):
            continue
        
        new_batteries.append(row)
    
    print(f"New batteries with valid serial: {len(new_batteries)}")
    
    # Remove duplicates (keep first occurrence)
    seen_serials = set()
    unique_batteries = []
    for row in new_batteries:
        serial = normalize_serial(row.get('Dispatch Battery Serial Number', ''))
        if serial not in seen_serials:
            seen_serials.add(serial)
            unique_batteries.append(row)
    
    print(f"Unique new batteries: {len(unique_batteries)}")
    
    # Get existing serials in database
    existing = list(db.finished_good_serials.find({}, {'serial_number': 1}))
    existing_serials = set(normalize_serial(s['serial_number']) for s in existing)
    print(f"Existing serials in DB: {len(existing_serials)}")
    
    # Find batteries to add (not already in DB)
    to_add = []
    for row in unique_batteries:
        serial = normalize_serial(row.get('Dispatch Battery Serial Number', ''))
        if serial not in existing_serials:
            to_add.append(row)
    
    print(f"New batteries to add: {len(to_add)}")
    
    # Get default firm
    firm = db.firms.find_one({'is_active': True})
    firm_id = firm['id'] if firm else None
    firm_name = firm['name'] if firm else 'MuscleGrid'
    
    # Get master SKUs mapping
    master_skus = list(db.master_skus.find({}, {'_id': 0, 'id': 1, 'sku_code': 1, 'name': 1, 'production_charge_per_unit': 1}))
    sku_map = {s['sku_code']: s for s in master_skus}
    
    # Get supervisor user for assignment
    supervisor = db.users.find_one({'role': 'supervisor'})
    supervisor_id = supervisor['id'] if supervisor else None
    supervisor_name = f"{supervisor['first_name']} {supervisor['last_name']}" if supervisor else 'Supervisor'
    
    # Import serials and create payables
    serials_added = 0
    payables_added = 0
    now = datetime.now(timezone.utc).isoformat()
    
    for row in to_add:
        serial_number = normalize_serial(row.get('Dispatch Battery Serial Number', ''))
        master_sku_code = row.get('Master SKU', '').strip()
        model_name = row.get('Model', '').strip()
        customer_name = row.get("Customer's Full Name", '').strip()
        order_id = row.get('Order ID', '').strip()
        dispatch_date = parse_date(row.get('Dispatch Date', ''))
        order_date = parse_date(row.get('Order Date', ''))
        supervisor_earns = row.get('Supervisor earns', '0').strip()
        
        try:
            production_charge = int(supervisor_earns) if supervisor_earns else 2000
        except:
            production_charge = 2000
        
        # Get master SKU details
        master_sku = sku_map.get(master_sku_code, {})
        master_sku_id = master_sku.get('id')
        master_sku_name = master_sku.get('name', model_name)
        
        production_date = dispatch_date or order_date or datetime.now(timezone.utc)
        if isinstance(production_date, datetime):
            production_date = production_date.isoformat()
        
        # Create serial record
        serial_record = {
            'id': str(uuid.uuid4()),
            'serial_number': serial_number,
            'master_sku_id': master_sku_id,
            'master_sku_code': master_sku_code,
            'master_sku_name': master_sku_name,
            'firm_id': firm_id,
            'firm_name': firm_name,
            'production_request_id': None,
            'produced_by': supervisor_id,
            'produced_by_name': supervisor_name,
            'production_date': production_date,
            'status': 'dispatched',  # Already dispatched from CSV
            'condition': 'New',
            'dispatch_id': None,
            'customer_name': customer_name,
            'order_id': order_id,
            'created_at': now,
            'source': 'csv_import'
        }
        
        db.finished_good_serials.insert_one(serial_record)
        serials_added += 1
        
        # Create supervisor payable for new batteries
        payable_number = f"PAY-IMPORT-{serials_added:05d}"
        payable = {
            'id': str(uuid.uuid4()),
            'payable_number': payable_number,
            'production_request_id': None,
            'production_request_number': f"IMPORT-{serial_number}",
            'supervisor_id': supervisor_id,
            'supervisor_name': supervisor_name,
            'master_sku_id': master_sku_id,
            'master_sku_code': master_sku_code,
            'master_sku_name': master_sku_name,
            'firm_id': firm_id,
            'firm_name': firm_name,
            'quantity_produced': 1,
            'rate_per_unit': production_charge,
            'total_payable': production_charge,
            'amount_paid': 0,
            'status': 'unpaid',
            'payment_history': [],
            'serial_number': serial_number,
            'condition': 'New',
            'created_at': production_date,
            'source': 'csv_import'
        }
        
        db.supervisor_payables.insert_one(payable)
        payables_added += 1
    
    print(f"\n=== Import Complete ===")
    print(f"Serials added: {serials_added}")
    print(f"Payables created: {payables_added}")
    print(f"Total serials in DB: {db.finished_good_serials.count_documents({})}")
    print(f"Total payables in DB: {db.supervisor_payables.count_documents({})}")

if __name__ == '__main__':
    import_production_data()

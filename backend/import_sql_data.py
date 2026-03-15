"""
SQL Data Import Script for MuscleGrid CRM
Imports tickets from the old PHP/MySQL system into MongoDB

Key Requirements:
- Use customer phone number as unique identifier to prevent duplicates
- One phone number may have multiple tickets - stack them (don't auto-close)
- Preserve legacy ticket ID for reference
"""

import re
import os
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Status mapping from old system to new
STATUS_MAP = {
    'Pickup Arranged': 'awaiting_label',
    'Pickup Scheduled': 'pickup_scheduled',
    'Closed by Agent': 'closed_by_agent',
    'Resolved on Call': 'resolved_on_call',
    'Hardware Service – Awaiting Label': 'hardware_service',
    'In Repair': 'in_repair',
    'Repair Completed': 'repair_completed',
    'Dispatched': 'dispatched',
    'Delivered': 'delivered',
    # Default
    None: 'new_request',
    '': 'new_request'
}

def parse_sql_values(sql_file_path):
    """Parse INSERT statements and extract repair_tickets data"""
    with open(sql_file_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    # Find the start of repair_tickets INSERT section
    start_marker = "INSERT INTO `repair_tickets`"
    
    tickets = []
    
    # Find all INSERT statements for repair_tickets
    idx = 0
    while True:
        start_idx = content.find(start_marker, idx)
        if start_idx == -1:
            break
        
        # Find VALUES keyword
        values_idx = content.find("VALUES", start_idx)
        if values_idx == -1:
            idx = start_idx + 1
            continue
        
        # Find the end of this INSERT statement (ends with semicolon)
        end_idx = content.find(";", values_idx)
        if end_idx == -1:
            end_idx = len(content)
        
        # Extract the VALUES section
        values_section = content[values_idx + 6:end_idx].strip()
        
        # Parse each row - rows are enclosed in parentheses
        row_start = 0
        while True:
            # Find opening parenthesis
            paren_start = values_section.find("(", row_start)
            if paren_start == -1:
                break
            
            # Find matching closing parenthesis
            paren_depth = 0
            in_string = False
            escape_next = False
            paren_end = paren_start
            
            for i in range(paren_start, len(values_section)):
                char = values_section[i]
                
                if escape_next:
                    escape_next = False
                    continue
                
                if char == '\\':
                    escape_next = True
                    continue
                
                if char == "'" and not in_string:
                    in_string = True
                elif char == "'" and in_string:
                    in_string = False
                elif not in_string:
                    if char == '(':
                        paren_depth += 1
                    elif char == ')':
                        paren_depth -= 1
                        if paren_depth == 0:
                            paren_end = i
                            break
            
            if paren_end > paren_start:
                row_content = values_section[paren_start + 1:paren_end]
                try:
                    values = parse_row_values(row_content)
                    if values and len(values) >= 25:
                        ticket = map_to_ticket(values)
                        if ticket:
                            tickets.append(ticket)
                except Exception as e:
                    print(f"Error parsing row: {e}")
            
            row_start = paren_end + 1
        
        idx = end_idx + 1
    
    return tickets

def parse_row_values(row_content):
    """Parse a single row of SQL VALUES into a list of Python values"""
    values = []
    current_value = ""
    in_string = False
    escape_next = False
    string_char = None
    
    i = 0
    while i < len(row_content):
        char = row_content[i]
        
        if escape_next:
            current_value += char
            escape_next = False
        elif char == '\\':
            escape_next = True
            current_value += char
        elif not in_string and char in ("'", '"'):
            in_string = True
            string_char = char
        elif in_string and char == string_char:
            # Check for doubled quotes (SQL escape)
            if i + 1 < len(row_content) and row_content[i + 1] == string_char:
                current_value += char
                i += 1
            else:
                in_string = False
                string_char = None
        elif not in_string and char == ',':
            values.append(clean_value(current_value.strip()))
            current_value = ""
        else:
            current_value += char
        
        i += 1
    
    # Don't forget the last value
    if current_value.strip():
        values.append(clean_value(current_value.strip()))
    
    return values

def clean_value(val):
    """Clean a SQL value - handle NULL, quotes, escapes"""
    if val.upper() == 'NULL':
        return None
    # Remove surrounding quotes
    if (val.startswith("'") and val.endswith("'")) or (val.startswith('"') and val.endswith('"')):
        val = val[1:-1]
    # Unescape
    val = val.replace("\\'", "'").replace('\\"', '"').replace("\\r\\n", "\n").replace("\\n", "\n").replace("\\r", "\n")
    return val

def map_to_ticket(values):
    """Map SQL row values to CRM ticket format"""
    # Column mapping (0-indexed):
    # 0: id, 1: customer_id, 2: warranty_id, 3: ticket_code, 4: customer_name,
    # 5: customer_phone, 6: customer_email, 7: product_name, 8: serial_number,
    # 9: invoice_number, 10: original_invoice_file, 11: invoice_date, 12: invoice_file,
    # 13: issue_category, 14: support_type, 15: assigned_to, 16: sla_due_at,
    # 17: sla_owner_id, 18: issue_description, 19: repair_photo_file, 20: pickup_address,
    # 21: pickup_city, 22: pickup_pincode, 23: preferred_pickup_date, 24: current_status,
    # 25: pickup_courier, 26: pickup_tracking, 27: return_courier, 28: return_tracking,
    # 29: dispatched_at, 30: closure_due_at, 31: closed_at, 32: created_at, 33: updated_at
    
    try:
        legacy_id = int(values[0]) if values[0] else None
        customer_phone = values[5] if len(values) > 5 else None
        
        if not customer_phone:
            return None
        
        # Clean phone number - remove spaces, keep only digits
        customer_phone = ''.join(filter(str.isdigit, str(customer_phone)))
        
        if len(customer_phone) < 10:
            return None
        
        status = values[24] if len(values) > 24 else None
        mapped_status = STATUS_MAP.get(status, 'new_request')
        
        support_type = values[14] if len(values) > 14 else None
        if support_type == 'hardware':
            support_type = 'hardware'
        else:
            support_type = 'phone'
        
        # Parse dates
        created_at = parse_date(values[32] if len(values) > 32 else None)
        updated_at = parse_date(values[33] if len(values) > 33 else None)
        closed_at = parse_date(values[31] if len(values) > 31 else None)
        dispatched_at = parse_date(values[29] if len(values) > 29 else None)
        
        return {
            'legacy_id': legacy_id,
            'ticket_code': values[3] if len(values) > 3 else None,
            'customer_name': values[4] if len(values) > 4 else 'Unknown',
            'customer_phone': customer_phone,
            'customer_email': values[6] if len(values) > 6 else None,
            'product_name': values[7] if len(values) > 7 else None,
            'serial_number': values[8] if len(values) > 8 else None,
            'invoice_number': values[9] if len(values) > 9 else None,
            'issue_description': values[18] if len(values) > 18 else 'Imported from legacy system',
            'pickup_address': values[20] if len(values) > 20 else None,
            'pickup_city': values[21] if len(values) > 21 else None,
            'pickup_pincode': values[22] if len(values) > 22 else None,
            'support_type': support_type,
            'status': mapped_status,
            'pickup_courier': values[25] if len(values) > 25 else None,
            'pickup_tracking': values[26] if len(values) > 26 else None,
            'return_courier': values[27] if len(values) > 27 else None,
            'return_tracking': values[28] if len(values) > 28 else None,
            'created_at': created_at,
            'updated_at': updated_at,
            'closed_at': closed_at,
            'dispatched_at': dispatched_at
        }
    except Exception as e:
        print(f"Error mapping values: {e}")
        return None

def parse_date(date_str):
    """Parse date string to ISO format"""
    if not date_str or date_str == '0000-00-00' or date_str == '0000-00-00 00:00:00':
        return None
    try:
        # Try different formats
        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d']:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.replace(tzinfo=timezone.utc).isoformat()
            except:
                continue
        return None
    except:
        return None

def generate_ticket_number():
    """Generate ticket number: MG-R-YYYYMMDD-XXXXX"""
    import random
    import string
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = ''.join(random.choices(string.digits, k=5))
    return f"MG-R-{date_str}-{random_part}"

async def find_or_create_customer(phone: str, name: str, email: str, address: str = None, city: str = None):
    """Find existing customer by phone or create new one"""
    # Search by phone (unique identifier)
    existing = await db.users.find_one({"phone": phone}, {"_id": 0})
    
    if existing:
        return existing['id']
    
    # Create new customer
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Split name into first/last
    name_parts = (name or 'Imported Customer').split(' ', 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ''
    
    # If email is provided, check if it's already used
    # If so, generate a unique email based on phone
    final_email = email.lower() if email else f"imported_{phone}@musclegrid.in"
    if email:
        existing_email = await db.users.find_one({"email": email.lower()})
        if existing_email:
            final_email = f"imported_{phone}@musclegrid.in"
    
    user_doc = {
        "id": user_id,
        "email": final_email,
        "first_name": first_name,
        "last_name": last_name,
        "phone": phone,
        "role": "customer",
        "password_hash": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.B9sMfVzFhHnOQS",  # customer123
        "address": address,
        "city": city,
        "state": None,
        "pincode": None,
        "created_at": now,
        "updated_at": now,
        "source": "sql_import"
    }
    
    try:
        await db.users.insert_one(user_doc)
        print(f"  Created new customer: {first_name} {last_name} ({phone})")
    except Exception as e:
        # If there's still a duplicate error, try to find by phone again
        existing = await db.users.find_one({"phone": phone}, {"_id": 0})
        if existing:
            return existing['id']
        raise e
    
    return user_id

async def import_tickets(tickets):
    """Import tickets into MongoDB"""
    imported = 0
    skipped = 0
    errors = 0
    customers_created = 0
    
    for idx, ticket in enumerate(tickets):
        try:
            # Check if ticket with this legacy_id already exists
            existing = await db.tickets.find_one({"legacy_id": ticket['legacy_id']}, {"_id": 0})
            if existing:
                skipped += 1
                continue
            
            # Also check by ticket_code if provided
            if ticket.get('ticket_code'):
                existing = await db.tickets.find_one({"ticket_number": ticket['ticket_code']}, {"_id": 0})
                if existing:
                    skipped += 1
                    continue
            
            # Find or create customer by phone
            customer_id = await find_or_create_customer(
                phone=ticket['customer_phone'],
                name=ticket['customer_name'],
                email=ticket.get('customer_email'),
                address=ticket.get('pickup_address'),
                city=ticket.get('pickup_city')
            )
            
            # Generate new ticket ID and number
            ticket_id = str(uuid.uuid4())
            # Use legacy ticket code if available, otherwise generate new
            ticket_number = ticket.get('ticket_code') or generate_ticket_number()
            
            now = datetime.now(timezone.utc)
            
            ticket_doc = {
                "id": ticket_id,
                "ticket_number": ticket_number,
                "legacy_id": ticket['legacy_id'],
                "customer_id": customer_id,
                "customer_name": ticket['customer_name'],
                "customer_phone": ticket['customer_phone'],
                "customer_email": ticket.get('customer_email') or '',
                "customer_address": ticket.get('pickup_address'),
                "customer_city": ticket.get('pickup_city'),
                "device_type": "Inverter",  # Default device type
                "product_name": ticket.get('product_name'),
                "serial_number": ticket.get('serial_number'),
                "invoice_number": ticket.get('invoice_number'),
                "order_id": None,
                "invoice_file": None,
                "issue_description": ticket.get('issue_description') or 'Imported from legacy system',
                "support_type": ticket.get('support_type', 'phone'),
                "status": ticket.get('status', 'closed'),
                "diagnosis": None,
                "agent_notes": f"Imported from legacy system (ID: {ticket['legacy_id']})",
                "repair_notes": None,
                "escalation_notes": None,
                "supervisor_notes": None,
                "supervisor_action": None,
                "supervisor_sku": None,
                "assigned_to": None,
                "assigned_to_name": None,
                "pickup_label": None,
                "pickup_courier": ticket.get('pickup_courier'),
                "pickup_tracking": ticket.get('pickup_tracking'),
                "return_label": None,
                "return_courier": ticket.get('return_courier'),
                "return_tracking": ticket.get('return_tracking'),
                "service_charges": None,
                "service_invoice": None,
                "sla_due": (now + timedelta(hours=48)).isoformat(),
                "sla_breached": False,
                "created_at": ticket.get('created_at') or now.isoformat(),
                "updated_at": ticket.get('updated_at') or now.isoformat(),
                "closed_at": ticket.get('closed_at'),
                "received_at": None,
                "repaired_at": None,
                "dispatched_at": ticket.get('dispatched_at'),
                "source": "sql_import",
                "history": [{
                    "action": "Ticket imported from legacy system",
                    "by": "System Import",
                    "by_id": "system",
                    "by_role": "system",
                    "timestamp": now.isoformat(),
                    "details": {"legacy_id": ticket['legacy_id']}
                }]
            }
            
            await db.tickets.insert_one(ticket_doc)
            imported += 1
            
            if imported % 50 == 0:
                print(f"Progress: {imported} tickets imported...")
            
        except Exception as e:
            print(f"Error importing ticket {ticket.get('legacy_id')}: {e}")
            errors += 1
    
    return imported, skipped, errors

async def main():
    """Main import function"""
    print("=" * 60)
    print("MuscleGrid CRM - SQL Data Import")
    print("=" * 60)
    
    sql_file = ROOT_DIR / "repair_data.sql"
    
    if not sql_file.exists():
        print(f"ERROR: SQL file not found at {sql_file}")
        return
    
    print(f"\n1. Parsing SQL file: {sql_file}")
    tickets = parse_sql_values(sql_file)
    print(f"   Found {len(tickets)} tickets in SQL file")
    
    if not tickets:
        print("No tickets found to import!")
        return
    
    # Show sample ticket
    print("\n2. Sample ticket data:")
    sample = tickets[0]
    for key, value in list(sample.items())[:10]:
        print(f"   {key}: {value}")
    
    print(f"\n3. Starting import...")
    imported, skipped, errors = await import_tickets(tickets)
    
    print("\n" + "=" * 60)
    print("IMPORT COMPLETE")
    print("=" * 60)
    print(f"  Tickets imported: {imported}")
    print(f"  Tickets skipped (duplicates): {skipped}")
    print(f"  Errors: {errors}")
    
    # Count customers
    customer_count = await db.users.count_documents({"role": "customer"})
    ticket_count = await db.tickets.count_documents({})
    
    print(f"\n  Total customers in DB: {customer_count}")
    print(f"  Total tickets in DB: {ticket_count}")

if __name__ == "__main__":
    asyncio.run(main())

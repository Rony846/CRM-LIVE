#!/usr/bin/env python3
"""
Import dealers from SQL file and set up pricing structure
"""
import asyncio
import re
import uuid
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

def parse_sql_value(val):
    """Parse SQL value, handling NULL and quoted strings"""
    val = val.strip()
    if val.upper() == 'NULL':
        return None
    if val.startswith("'") and val.endswith("'"):
        return val[1:-1].replace("''", "'").replace("\\'", "'")
    return val

def split_sql_row(row_str):
    """Split SQL row values, handling quoted strings with commas"""
    values = []
    current = ""
    in_quote = False
    i = 0
    while i < len(row_str):
        char = row_str[i]
        if char == "'" and (i == 0 or row_str[i-1] != "\\"):
            in_quote = not in_quote
            current += char
        elif char == ',' and not in_quote:
            values.append(parse_sql_value(current.strip()))
            current = ""
        else:
            current += char
        i += 1
    if current.strip():
        values.append(parse_sql_value(current.strip()))
    return values

async def import_dealers():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client[os.environ.get('DB_NAME', 'musclegrid')]
    
    # Read SQL file
    with open('/tmp/dealers.sql', 'r') as f:
        sql_content = f.read()
    
    # Find all row patterns in dealers INSERT
    # Each row starts with (number, and ends with ),\n or );
    row_pattern = r"\((\d+,\s*\d+,\s*'.*?')\)"
    
    # Better approach: find the VALUES section and parse rows
    dealers_section = sql_content[sql_content.find("INSERT INTO `dealers`"):sql_content.find("INSERT INTO `dealers`")+50000]
    
    # Extract rows between parentheses
    dealers_to_import = []
    now = datetime.now(timezone.utc).isoformat()
    
    # Find all row data
    in_values = False
    rows = []
    current_row = ""
    paren_depth = 0
    
    for i, char in enumerate(dealers_section):
        if dealers_section[i:i+6].upper() == "VALUES":
            in_values = True
            continue
        if not in_values:
            continue
        
        if char == '(':
            paren_depth += 1
            if paren_depth == 1:
                current_row = ""
                continue
        elif char == ')':
            paren_depth -= 1
            if paren_depth == 0 and current_row.strip():
                rows.append(current_row)
                current_row = ""
                continue
        
        if paren_depth > 0:
            current_row += char
    
    print(f"Found {len(rows)} dealer rows to parse")
    
    for row in rows:
        try:
            values = split_sql_row(row)
            if len(values) < 17:
                continue
            
            sql_id = int(values[0])
            user_id = int(values[1])
            firm_name = values[2] or ""
            contact_person = values[3] or ""
            phone = values[4] or ""
            gst_number = values[5]
            address_line1 = values[6] or ""
            address_line2 = values[7] or ""
            city = values[8] or ""
            district = values[9] or ""
            state = values[10] or ""
            pincode = values[11] or ""
            status = values[12] or "pending"
            created_at = values[13] or now
            security_deposit_amount = float(values[14]) if values[14] else 100000.0
            security_deposit_status = values[15] or "not_paid"
            
            # Generate unique ID
            dealer_id = str(uuid.uuid4())
            
            # Create user document for dealer login
            user_doc = {
                "id": str(uuid.uuid4()),
                "email": f"dealer_{sql_id}@musclegrid.in",
                "phone": phone,
                "first_name": contact_person.split()[0] if contact_person else firm_name.split()[0] if firm_name else "Dealer",
                "last_name": " ".join(contact_person.split()[1:]) if contact_person and len(contact_person.split()) > 1 else "",
                "role": "dealer",
                "is_active": status == "approved",
                "dealer_id": dealer_id,
                "created_at": now
            }
            
            # Default discount percentage based on status
            discount_percent = 15 if status == "approved" else 10
            
            dealer_doc = {
                "id": dealer_id,
                "sql_id": sql_id,
                "user_id": user_doc["id"],
                "firm_name": firm_name,
                "contact_person": contact_person,
                "phone": phone,
                "gst_number": gst_number,
                "address_line1": address_line1,
                "address_line2": address_line2,
                "city": city,
                "district": district,
                "state": state,
                "pincode": pincode,
                "status": status,
                "discount_percent": discount_percent,
                "security_deposit_amount": security_deposit_amount,
                "security_deposit_status": security_deposit_status,
                "created_at": created_at,
                "imported_at": now
            }
            
            dealers_to_import.append((dealer_doc, user_doc))
            
        except Exception as e:
            print(f"  Error parsing row: {e}")
            continue
    
    print(f"Parsed {len(dealers_to_import)} dealers successfully")
    
    # Import dealers
    imported_count = 0
    skipped_count = 0
    for dealer_doc, user_doc in dealers_to_import:
        # Check if dealer already exists by phone
        existing = await db.dealers.find_one({"phone": dealer_doc["phone"]})
        if existing:
            skipped_count += 1
            continue
        
        # Insert user
        await db.users.insert_one(user_doc)
        
        # Insert dealer
        await db.dealers.insert_one(dealer_doc)
        imported_count += 1
    
    print(f"\nImported {imported_count} new dealers, skipped {skipped_count} existing")
    
    # Verify
    total = await db.dealers.count_documents({})
    approved = await db.dealers.count_documents({"status": "approved"})
    print(f"Total dealers in DB: {total} ({approved} approved)")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(import_dealers())

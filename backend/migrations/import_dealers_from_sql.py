#!/usr/bin/env python3
"""
Import dealers, users, orders, and products from MySQL SQL dump into MongoDB.
Dealer ID format: MGIPLDEL{original_id}
"""

import re
import json
import uuid
import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'crm_db')

# Parse SQL INSERT statements
def parse_sql_insert(sql_content, table_name):
    """Parse INSERT INTO statements from SQL dump"""
    records = []
    
    # Find the INSERT statement for this table
    pattern = rf"INSERT INTO `{table_name}` \([^)]+\) VALUES\s*"
    match = re.search(pattern, sql_content)
    if not match:
        print(f"No INSERT found for {table_name}")
        return records
    
    # Get column names
    cols_pattern = rf"INSERT INTO `{table_name}` \(([^)]+)\)"
    cols_match = re.search(cols_pattern, sql_content)
    if not cols_match:
        return records
    
    columns = [c.strip().replace('`', '') for c in cols_match.group(1).split(',')]
    
    # Find the VALUES section
    start_pos = match.end()
    values_text = sql_content[start_pos:]
    
    # Find the end (next CREATE TABLE or end of file)
    end_match = re.search(r';\s*\n\s*--|\s*;\s*$', values_text)
    if end_match:
        values_text = values_text[:end_match.start()]
    
    # Parse each row - handle complex cases with nested parentheses and quotes
    current_row = ""
    in_string = False
    escape_next = False
    paren_depth = 0
    
    for char in values_text:
        if escape_next:
            current_row += char
            escape_next = False
            continue
        
        if char == '\\':
            current_row += char
            escape_next = True
            continue
        
        if char == "'" and not escape_next:
            in_string = not in_string
            current_row += char
            continue
        
        if not in_string:
            if char == '(':
                if paren_depth == 0:
                    current_row = ""
                else:
                    current_row += char
                paren_depth += 1
                continue
            elif char == ')':
                paren_depth -= 1
                if paren_depth == 0:
                    # Parse this row
                    row_data = parse_row_values(current_row, columns)
                    if row_data:
                        records.append(row_data)
                    current_row = ""
                else:
                    current_row += char
                continue
        
        if paren_depth > 0:
            current_row += char
    
    return records


def parse_row_values(row_text, columns):
    """Parse a single row of values"""
    values = []
    current_value = ""
    in_string = False
    escape_next = False
    
    for char in row_text:
        if escape_next:
            current_value += char
            escape_next = False
            continue
        
        if char == '\\':
            escape_next = True
            continue
        
        if char == "'" and not escape_next:
            in_string = not in_string
            continue
        
        if char == ',' and not in_string:
            values.append(current_value.strip())
            current_value = ""
            continue
        
        current_value += char
    
    # Don't forget the last value
    if current_value.strip():
        values.append(current_value.strip())
    
    # Create dict
    if len(values) != len(columns):
        print(f"Column mismatch: {len(columns)} columns, {len(values)} values")
        return None
    
    row_dict = {}
    for col, val in zip(columns, values):
        if val == 'NULL' or val == '':
            row_dict[col] = None
        elif val.isdigit():
            row_dict[col] = int(val)
        elif re.match(r'^-?\d+\.?\d*$', val):
            row_dict[col] = float(val)
        else:
            row_dict[col] = val
    
    return row_dict


async def import_data():
    """Main import function"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Read SQL file
    with open('/tmp/dealers_import.sql', 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # Parse all tables
    dealers_data = parse_sql_insert(sql_content, 'dealers')
    users_data = parse_sql_insert(sql_content, 'users')
    orders_data = parse_sql_insert(sql_content, 'orders')
    order_items_data = parse_sql_insert(sql_content, 'order_items')
    products_data = parse_sql_insert(sql_content, 'products')
    
    print(f"Parsed: {len(dealers_data)} dealers, {len(users_data)} users, {len(orders_data)} orders, {len(order_items_data)} order items, {len(products_data)} products")
    
    # Create user mapping (old_user_id -> email)
    user_email_map = {}
    user_name_map = {}
    for u in users_data:
        user_email_map[u['id']] = u['email']
        user_name_map[u['id']] = u['name']
    
    # Create dealer mapping (old_dealer_id -> new_dealer_id format MGIPLDEL{id})
    dealer_id_map = {}
    
    # Track stats
    imported_dealers = 0
    updated_dealers = 0
    imported_orders = 0
    updated_orders = 0
    
    # Import/update dealers
    print("\n=== Importing Dealers ===")
    for dealer in dealers_data:
        old_id = dealer['id']
        new_dealer_id = f"MGIPLDEL{old_id}"
        dealer_id_map[old_id] = new_dealer_id
        
        # Get email from user
        user_id = dealer.get('user_id')
        email = user_email_map.get(user_id, f"dealer{old_id}@musclegrid.in")
        contact_name = str(user_name_map.get(user_id, dealer.get('contact_person', '')))
        
        # Build dealer document
        dealer_doc = {
            "id": new_dealer_id,
            "user_id": str(user_id) if user_id else None,
            "firm_name": str(dealer.get('firm_name', '')),
            "firm_type": "Proprietorship",  # Default
            "gst_number": dealer.get('gst_number'),
            "pan_number": None,
            "contact_person": str(dealer.get('contact_person') or contact_name),
            "phone": str(dealer.get('phone', '')),
            "email": email,
            "address": f"{dealer.get('address_line1', '') or ''} {dealer.get('address_line2', '') or ''}".strip(),
            "city": str(dealer.get('city', '') or ''),
            "district": str(dealer.get('district', '') or ''),
            "state": str(dealer.get('state', '') or ''),
            "pincode": str(dealer.get('pincode', '') or ''),
            "tier": "silver",  # Will be calculated based on orders
            "status": dealer.get('status', 'pending'),
            "security_deposit_amount": float(dealer.get('security_deposit_amount', 100000) or 100000),
            "security_deposit_status": dealer.get('security_deposit_status', 'not_paid') or 'not_paid',
            "security_deposit_proof_path": dealer.get('security_deposit_proof_path'),
            "created_at": dealer.get('created_at') or datetime.now(timezone.utc).isoformat(),
            "legacy_id": old_id  # Keep reference to old ID
        }
        
        # Check if dealer exists
        existing = await db.dealers.find_one({"id": new_dealer_id})
        if existing:
            await db.dealers.update_one({"id": new_dealer_id}, {"$set": dealer_doc})
            updated_dealers += 1
        else:
            await db.dealers.insert_one(dealer_doc)
            imported_dealers += 1
        
        # Also create/update user account for the dealer
        contact_name_str = str(contact_name) if contact_name else ''
        user_doc = {
            "id": str(uuid.uuid4()) if not existing else existing.get('user_id', str(uuid.uuid4())),
            "email": email,
            "first_name": contact_name_str.split()[0] if contact_name_str else dealer.get('firm_name', ''),
            "last_name": ' '.join(contact_name_str.split()[1:]) if contact_name_str and len(contact_name_str.split()) > 1 else '',
            "phone": dealer.get('phone', ''),
            "role": "dealer",
            "address": dealer_doc['address'],
            "city": dealer_doc['city'],
            "state": dealer_doc['state'],
            "pincode": dealer_doc['pincode'],
            "created_at": dealer_doc['created_at'],
            "dealer_id": new_dealer_id
        }
        
        existing_user = await db.users.find_one({"email": email})
        if not existing_user:
            await db.users.insert_one(user_doc)
    
    print(f"Dealers: {imported_dealers} imported, {updated_dealers} updated")
    
    # Import/update orders with order items
    print("\n=== Importing Orders ===")
    
    # Group order items by order_id
    order_items_by_order = {}
    for item in order_items_data:
        order_id = item['order_id']
        if order_id not in order_items_by_order:
            order_items_by_order[order_id] = []
        order_items_by_order[order_id].append(item)
    
    for order in orders_data:
        old_order_id = order['id']
        old_dealer_id = order.get('dealer_id')
        new_dealer_id = dealer_id_map.get(old_dealer_id)
        
        if not new_dealer_id:
            print(f"  Skipping order {old_order_id}: dealer {old_dealer_id} not found")
            continue
        
        # Get order items
        items = order_items_by_order.get(old_order_id, [])
        items_list = []
        for item in items:
            items_list.append({
                "product_id": item.get('product_id'),
                "quantity": item.get('quantity', 1),
                "unit_price": float(item.get('unit_price', 0)),
                "line_total": float(item.get('line_total', 0))
            })
        
        # Build order document
        order_doc = {
            "id": str(uuid.uuid4()),
            "dealer_id": new_dealer_id,
            "order_number": order.get('order_number', f"MGPO-{old_order_id}"),
            "items": items_list,
            "total_amount": float(order.get('total_amount', 0)),
            "payment_status": order.get('payment_status', 'pending'),
            "order_status": order.get('status', 'pending'),
            "payment_received_at": order.get('payment_received_at'),
            "dispatch_due_date": order.get('dispatch_due_date'),
            "dispatch_date": order.get('dispatch_date'),
            "dispatch_courier": order.get('dispatch_courier'),
            "dispatch_awb": order.get('dispatch_awb'),
            "dispatch_remarks": order.get('dispatch_remarks'),
            "payment_proof_path": order.get('payment_proof_path'),
            "proforma_number": order.get('proforma_number'),
            "proforma_date": order.get('proforma_date'),
            "final_invoice_number": order.get('final_invoice_number'),
            "final_invoice_date": order.get('final_invoice_date'),
            "final_invoice_file_path": order.get('final_invoice_file_path'),
            "created_at": order.get('created_at') or datetime.now(timezone.utc).isoformat(),
            "notes": "",
            "legacy_order_id": old_order_id
        }
        
        # Check if order exists by order_number
        existing = await db.dealer_orders.find_one({"order_number": order_doc['order_number']})
        if existing:
            await db.dealer_orders.update_one({"order_number": order_doc['order_number']}, {"$set": order_doc})
            updated_orders += 1
        else:
            await db.dealer_orders.insert_one(order_doc)
            imported_orders += 1
    
    print(f"Orders: {imported_orders} imported, {updated_orders} updated")
    
    # Import products to master_skus
    print("\n=== Importing Products to Master SKUs ===")
    imported_skus = 0
    for product in products_data:
        sku_doc = {
            "id": str(uuid.uuid4()),
            "sku_code": product.get('sku', f"MG-{product['id']}"),
            "name": product.get('name', ''),
            "description": product.get('name', ''),
            "category": product.get('category', 'Solar Inverter'),
            "subcategory": "",
            "hsn_code": "",
            "mrp": float(product.get('mrp', 0)),
            "dealer_price": float(product.get('dealer_price', 0)),
            "gst_rate": float(product.get('gst_rate', 18)),
            "warranty_months": product.get('warranty_months', 24),
            "unit": "Pcs",
            "min_stock": 5,
            "is_active": bool(product.get('is_active', 1)),
            "created_at": product.get('created_at') or datetime.now(timezone.utc).isoformat(),
            "legacy_product_id": product['id']
        }
        
        existing = await db.master_skus.find_one({"sku_code": sku_doc['sku_code']})
        if not existing:
            await db.master_skus.insert_one(sku_doc)
            imported_skus += 1
    
    print(f"Products/SKUs: {imported_skus} imported")
    
    # Summary
    print("\n=== Import Summary ===")
    print(f"Total Dealers: {imported_dealers + updated_dealers} ({imported_dealers} new, {updated_dealers} updated)")
    print(f"Total Orders: {imported_orders + updated_orders} ({imported_orders} new, {updated_orders} updated)")
    print(f"Total Products: {imported_skus} new")
    
    # Verify counts
    dealer_count = await db.dealers.count_documents({})
    order_count = await db.dealer_orders.count_documents({})
    sku_count = await db.master_skus.count_documents({})
    print(f"\nDatabase Counts:")
    print(f"  Dealers: {dealer_count}")
    print(f"  Orders: {order_count}")
    print(f"  Master SKUs: {sku_count}")
    
    client.close()
    print("\nImport completed successfully!")


if __name__ == "__main__":
    asyncio.run(import_data())

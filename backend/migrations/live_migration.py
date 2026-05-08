"""
MuscleGrid Dealer Portal - LIVE Migration Script
Migrates data from MySQL dump to MongoDB (PRODUCTION)
Target: newcrm.musclegrid.in

Date: March 27, 2026
"""

import asyncio
import re
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os

# PRODUCTION MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'musclegrid_crm')

# Parse MySQL dump file
SQL_DUMP_PATH = '/app/backend/migrations/live_partners_dump.sql'

def parse_insert_statements(sql_content, table_name):
    """Parse INSERT statements for a specific table"""
    pattern = rf"INSERT INTO `{table_name}`.*?VALUES\s*\n?(.*?);\s*(?=\n\n|--|ALTER|$)"
    matches = re.findall(pattern, sql_content, re.DOTALL | re.IGNORECASE)
    
    records = []
    for match in matches:
        # Split by ),( while being careful about nested parentheses
        rows = re.findall(r'\(([^)]+(?:\([^)]*\)[^)]*)*)\)', match)
        for row in rows:
            # Parse individual values
            values = []
            current = ''
            in_quotes = False
            quote_char = None
            
            for char in row + ',':
                if char in ("'", '"') and not in_quotes:
                    in_quotes = True
                    quote_char = char
                    current += char
                elif char == quote_char and in_quotes:
                    in_quotes = False
                    current += char
                elif char == ',' and not in_quotes:
                    val = current.strip()
                    if val == 'NULL':
                        values.append(None)
                    elif val.startswith("'") and val.endswith("'"):
                        values.append(val[1:-1].replace("\\'", "'").replace("\\n", "\n"))
                    elif val.startswith('"') and val.endswith('"'):
                        values.append(val[1:-1])
                    else:
                        try:
                            if '.' in val:
                                values.append(float(val))
                            else:
                                values.append(int(val))
                        except:
                            values.append(val)
                    current = ''
                else:
                    current += char
            
            records.append(values)
    
    return records


def parse_column_names(sql_content, table_name):
    """Extract column names from INSERT statement"""
    pattern = rf"INSERT INTO `{table_name}` \(([^)]+)\)"
    match = re.search(pattern, sql_content)
    if match:
        cols = match.group(1)
        return [c.strip().strip('`') for c in cols.split(',')]
    return []


async def run_migration():
    print("=" * 60)
    print("LIVE MIGRATION - MuscleGrid Dealer Portal")
    print("Target: newcrm.musclegrid.in")
    print("=" * 60)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Read SQL dump
    with open(SQL_DUMP_PATH, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    now = datetime.now(timezone.utc)
    migration_tag = f"live_migration_{now.strftime('%Y%m%d_%H%M%S')}"
    
    stats = {
        "users_created": 0,
        "users_linked": 0,
        "dealers_created": 0,
        "parties_created": 0,
        "orders_created": 0,
        "products_created": 0,
        "applications_migrated": 0,
        "errors": []
    }
    
    # User ID mapping (old_id -> new_id)
    user_id_map = {}
    dealer_id_map = {}
    product_id_map = {}
    
    # ==================== 1. MIGRATE USERS ====================
    print("\n[1/6] Migrating Users...")
    
    user_cols = parse_column_names(sql_content, 'users')
    user_rows = parse_insert_statements(sql_content, 'users')
    
    for row in user_rows:
        if len(row) != len(user_cols):
            continue
        
        user_data = dict(zip(user_cols, row))
        
        # Skip admin users
        if user_data.get('role') == 'admin':
            continue
        
        old_user_id = user_data['id']
        email = user_data.get('email', '').lower()
        
        # Check if user exists by email
        existing = await db.users.find_one({"email": email})
        
        if existing:
            user_id_map[old_user_id] = existing.get('id', str(existing['_id']))
            stats["users_linked"] += 1
            print(f"  Linked existing user: {email}")
        else:
            new_user_id = str(uuid.uuid4())
            user_doc = {
                "id": new_user_id,
                "legacy_user_id": old_user_id,
                "email": email,
                "phone": user_data.get('phone'),
                "first_name": user_data.get('name', '').split()[0] if user_data.get('name') else '',
                "last_name": ' '.join(user_data.get('name', '').split()[1:]) if user_data.get('name') else '',
                "password_hash": user_data.get('password', ''),  # PHP bcrypt compatible
                "role": "dealer",
                "is_active": True,
                "created_at": now,
                "source": "live_migration",
                "migration_tag": migration_tag
            }
            
            await db.users.insert_one(user_doc)
            user_id_map[old_user_id] = new_user_id
            stats["users_created"] += 1
            print(f"  Created user: {email}")
    
    print(f"  Users: {stats['users_created']} created, {stats['users_linked']} linked")
    
    # ==================== 2. MIGRATE PRODUCTS ====================
    print("\n[2/6] Migrating Products...")
    
    product_cols = parse_column_names(sql_content, 'products')
    product_rows = parse_insert_statements(sql_content, 'products')
    
    for row in product_rows:
        if len(row) != len(product_cols):
            continue
        
        prod_data = dict(zip(product_cols, row))
        old_prod_id = prod_data['id']
        sku = prod_data.get('sku', '')
        
        # Check if product exists
        existing = await db.dealer_products.find_one({"sku": sku})
        
        if existing:
            product_id_map[old_prod_id] = existing.get('id', str(existing['_id']))
        else:
            new_prod_id = str(uuid.uuid4())
            prod_doc = {
                "id": new_prod_id,
                "legacy_product_id": old_prod_id,
                "name": prod_data.get('name'),
                "sku": sku,
                "category": prod_data.get('category'),
                "mrp": float(prod_data.get('mrp', 0)),
                "dealer_price": float(prod_data.get('dealer_price', 0)),
                "gst_rate": float(prod_data.get('gst_rate', 18)),
                "warranty_months": int(prod_data.get('warranty_months', 0)),
                "is_active": bool(prod_data.get('is_active', 1)),
                "master_sku_id": None,
                "created_at": now.isoformat(),
                "source": "live_migration",
                "migration_tag": migration_tag
            }
            
            await db.dealer_products.insert_one(prod_doc)
            product_id_map[old_prod_id] = new_prod_id
            stats["products_created"] += 1
            print(f"  Created product: {prod_data.get('name')}")
    
    print(f"  Products: {stats['products_created']} created")
    
    # ==================== 3. MIGRATE DEALERS ====================
    print("\n[3/6] Migrating Dealers...")
    
    dealer_cols = parse_column_names(sql_content, 'dealers')
    dealer_rows = parse_insert_statements(sql_content, 'dealers')
    
    for row in dealer_rows:
        if len(row) != len(dealer_cols):
            continue
        
        dealer_data = dict(zip(dealer_cols, row))
        old_dealer_id = dealer_data['id']
        old_user_id = dealer_data['user_id']
        
        new_user_id = user_id_map.get(old_user_id)
        if not new_user_id:
            stats["errors"].append(f"Dealer {old_dealer_id}: No user mapping found")
            continue
        
        new_dealer_id = str(uuid.uuid4())
        
        # Get user email and phone for dealer record
        user = await db.users.find_one({"id": new_user_id})
        user_email = user.get('email') if user else dealer_data.get('email')
        user_phone = user.get('phone') if user else dealer_data.get('phone')
        
        dealer_doc = {
            "id": new_dealer_id,
            "legacy_dealer_id": old_dealer_id,
            "user_id": new_user_id,
            "firm_name": dealer_data.get('firm_name'),
            "contact_person": dealer_data.get('contact_person'),
            "phone": user_phone or dealer_data.get('phone'),
            "email": user_email,
            "gst_number": dealer_data.get('gst_number'),
            "address": {
                "line1": dealer_data.get('address_line1'),
                "line2": dealer_data.get('address_line2'),
                "city": dealer_data.get('city'),
                "district": dealer_data.get('district'),
                "state": dealer_data.get('state'),
                "pincode": dealer_data.get('pincode')
            },
            "city": dealer_data.get('city'),
            "state": dealer_data.get('state'),
            "status": dealer_data.get('status', 'pending'),
            "security_deposit": {
                "amount": float(dealer_data.get('security_deposit_amount', 100000)),
                "status": dealer_data.get('security_deposit_status', 'not_paid'),
                "proof_path": dealer_data.get('security_deposit_proof_path'),
                "uploaded_at": dealer_data.get('security_deposit_uploaded_at'),
                "approved_at": dealer_data.get('security_deposit_approved_at'),
                "remarks": dealer_data.get('security_deposit_remarks')
            },
            "created_at": now,
            "source": "live_migration",
            "migration_tag": migration_tag
        }
        
        await db.dealers.insert_one(dealer_doc)
        dealer_id_map[old_dealer_id] = new_dealer_id
        stats["dealers_created"] += 1
        print(f"  Created dealer: {dealer_data.get('firm_name')}")
        
        # ==================== CREATE PARTY ====================
        party_doc = {
            "id": str(uuid.uuid4()),
            "name": dealer_data.get('firm_name'),
            "type": "dealer",
            "dealer_id": new_dealer_id,
            "contact_person": dealer_data.get('contact_person'),
            "phone": user_phone or dealer_data.get('phone'),
            "email": user_email,
            "gst_number": dealer_data.get('gst_number'),
            "address": dealer_doc["address"],
            "current_balance": 0,
            "credit_limit": 0,
            "payment_terms": "advance",
            "is_active": dealer_data.get('status') == 'approved',
            "created_at": now.isoformat(),
            "source": "live_migration",
            "migration_tag": migration_tag
        }
        
        await db.parties.insert_one(party_doc)
        stats["parties_created"] += 1
    
    print(f"  Dealers: {stats['dealers_created']} created")
    print(f"  Parties: {stats['parties_created']} created")
    
    # ==================== 4. MIGRATE ORDER ITEMS (Pre-fetch) ====================
    print("\n[4/6] Processing Order Items...")
    
    item_cols = parse_column_names(sql_content, 'order_items')
    item_rows = parse_insert_statements(sql_content, 'order_items')
    
    order_items_map = {}  # order_id -> [items]
    for row in item_rows:
        if len(row) != len(item_cols):
            continue
        
        item_data = dict(zip(item_cols, row))
        order_id = item_data['order_id']
        
        if order_id not in order_items_map:
            order_items_map[order_id] = []
        
        # Get product info
        old_prod_id = item_data['product_id']
        new_prod_id = product_id_map.get(old_prod_id)
        
        product = None
        if new_prod_id:
            product = await db.dealer_products.find_one({"id": new_prod_id})
        
        order_items_map[order_id].append({
            "product_id": new_prod_id,
            "product_name": product.get('name') if product else f"Product #{old_prod_id}",
            "sku": product.get('sku') if product else None,
            "quantity": int(item_data.get('quantity', 1)),
            "unit_price": float(item_data.get('unit_price', 0)),
            "line_total": float(item_data.get('line_total', 0))
        })
    
    # ==================== 5. MIGRATE ORDERS ====================
    print("\n[5/6] Migrating Orders...")
    
    order_cols = parse_column_names(sql_content, 'orders')
    order_rows = parse_insert_statements(sql_content, 'orders')
    
    for row in order_rows:
        if len(row) != len(order_cols):
            continue
        
        order_data = dict(zip(order_cols, row))
        old_order_id = order_data['id']
        old_dealer_id = order_data['dealer_id']
        
        new_dealer_id = dealer_id_map.get(old_dealer_id)
        if not new_dealer_id:
            stats["errors"].append(f"Order {old_order_id}: No dealer mapping")
            continue
        
        # Get dealer name
        dealer = await db.dealers.find_one({"id": new_dealer_id})
        dealer_name = dealer.get('firm_name') if dealer else 'Unknown'
        
        new_order_id = str(uuid.uuid4())
        items = order_items_map.get(old_order_id, [])
        
        order_doc = {
            "id": new_order_id,
            "legacy_order_id": old_order_id,
            "dealer_id": new_dealer_id,
            "dealer_name": dealer_name,
            "order_number": order_data.get('order_number'),
            "status": order_data.get('status') or 'pending',
            "payment_status": order_data.get('payment_status') or 'pending',
            "total_amount": float(order_data.get('total_amount', 0)),
            "items": items,
            "payment_proof_path": order_data.get('payment_proof_path'),
            "proforma": {
                "number": order_data.get('proforma_number'),
                "date": order_data.get('proforma_date')
            } if order_data.get('proforma_number') else None,
            "final_invoice": {
                "number": order_data.get('final_invoice_number'),
                "date": order_data.get('final_invoice_date'),
                "file_path": order_data.get('final_invoice_file_path')
            } if order_data.get('final_invoice_number') else None,
            "dispatch": {
                "date": order_data.get('dispatch_date'),
                "courier": order_data.get('dispatch_courier'),
                "awb": order_data.get('dispatch_awb'),
                "remarks": order_data.get('dispatch_remarks')
            } if order_data.get('dispatch_date') or order_data.get('dispatch_awb') else None,
            "is_historical": True,
            "inventory_impacted": False,
            "accounting_impacted": False,
            "created_at": order_data.get('created_at') or now.isoformat(),
            "source": "live_migration",
            "migration_tag": migration_tag
        }
        
        await db.dealer_orders.insert_one(order_doc)
        stats["orders_created"] += 1
        print(f"  Created order: {order_data.get('order_number')}")
    
    print(f"  Orders: {stats['orders_created']} created")
    
    # ==================== 6. MIGRATE DEALER APPLICATIONS ====================
    print("\n[6/6] Migrating Dealer Applications...")
    
    app_cols = parse_column_names(sql_content, 'dealer_applications')
    app_rows = parse_insert_statements(sql_content, 'dealer_applications')
    
    for row in app_rows:
        if len(row) != len(app_cols):
            continue
        
        app_data = dict(zip(app_cols, row))
        
        app_doc = {
            "id": str(uuid.uuid4()),
            "legacy_application_id": app_data.get('id'),
            "application_number": f"MG-DA-LEGACY-{app_data.get('id')}",
            "firm_name": app_data.get('firm_name'),
            "contact_person": app_data.get('contact_name'),
            "email": app_data.get('email'),
            "phone": app_data.get('mobile') or app_data.get('phone'),
            "address": {
                "line1": app_data.get('address_line1'),
                "line2": app_data.get('address_line2'),
                "city": app_data.get('city'),
                "district": app_data.get('district'),
                "state": app_data.get('state'),
                "pincode": app_data.get('pincode')
            },
            "gst_number": app_data.get('gst_number'),
            "business_type": app_data.get('business_type'),
            "status": app_data.get('status', 'new'),
            "admin_notes": app_data.get('admin_notes'),
            "created_at": app_data.get('created_at') or now.isoformat(),
            "source": "live_migration",
            "migration_tag": migration_tag
        }
        
        await db.dealer_applications.insert_one(app_doc)
        stats["applications_migrated"] += 1
    
    print(f"  Applications: {stats['applications_migrated']} migrated")
    
    # ==================== MIGRATION COMPLETE ====================
    print("\n" + "=" * 60)
    print("LIVE MIGRATION COMPLETE")
    print("=" * 60)
    print(f"""
    Migration Summary:
    ------------------
    Users Created:       {stats['users_created']}
    Users Linked:        {stats['users_linked']}
    Products Created:    {stats['products_created']}
    Dealers Created:     {stats['dealers_created']}
    Parties Created:     {stats['parties_created']}
    Orders Created:      {stats['orders_created']}
    Applications:        {stats['applications_migrated']}
    
    Errors: {len(stats['errors'])}
    Migration Tag: {migration_tag}
    """)
    
    if stats["errors"]:
        print("Errors:")
        for err in stats["errors"][:10]:
            print(f"  - {err}")
    
    # Save migration report
    report = {
        "id": str(uuid.uuid4()),
        "migration_tag": migration_tag,
        "target": "newcrm.musclegrid.in",
        "executed_at": now.isoformat(),
        "stats": stats,
        "source_file": SQL_DUMP_PATH
    }
    
    await db.migration_reports.insert_one(report)
    
    # Save to file
    import json
    report_path = f"/app/backend/migrations/live_migration_report_{now.strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w') as f:
        json.dump({**stats, "migration_tag": migration_tag, "executed_at": now.isoformat()}, f, indent=2, default=str)
    
    print(f"\nReport saved to: {report_path}")
    
    client.close()
    return stats


if __name__ == "__main__":
    asyncio.run(run_migration())

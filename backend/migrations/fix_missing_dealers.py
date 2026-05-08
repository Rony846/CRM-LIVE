#!/usr/bin/env python3
"""
Fix missing dealers and orders that weren't imported due to parsing issues.
"""

import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'crm_db')

# Missing dealers data (manually extracted from SQL)
MISSING_DEALERS = [
    {
        "id": 7, "user_id": 8, "firm_name": "Bernard & Singpu", "contact_person": "Bernard Kamliansanga",
        "phone": "7629971576", "gst_number": None, "address_line1": "Vengthar", "address_line2": "Near Cemetery",
        "city": "Champhai", "district": "Champhai", "state": "Mizoram", "pincode": "796321",
        "status": "approved", "created_at": "2026-01-07 09:30:24", "security_deposit_amount": 100000.00,
        "security_deposit_status": "approved", "email": "dksingpu3@gmail.com"
    },
    {
        "id": 10, "user_id": 11, "firm_name": "JDMP Tech Private Limited", "contact_person": "Mukhjit singh",
        "phone": "9270532195", "gst_number": "27AAECJ1579N1Z0", "address_line1": "Plot no. 507, Southcity, Cidco Mahanagar-2,",
        "address_line2": "Chh. Sambhajinagar", "city": "Chh. Sambhajinagar", "district": "Chh. Sambhajinagar",
        "state": "Maharashtra", "pincode": "431136", "status": "approved", "created_at": "2026-01-20 07:51:24",
        "security_deposit_amount": 100000.00, "security_deposit_status": "approved", "email": "jdmptechpvtltd@gmail.com"
    },
    {
        "id": 14, "user_id": 15, "firm_name": "GANIYAR SOLAR POWER", "contact_person": "SANJIT KUMAR",
        "phone": "9416282457", "gst_number": None, "address_line1": "CHANPURA GANIYAR ROAD NEAR GURUKUL",
        "address_line2": "VPO GANIYAR", "city": "GANIYAR", "district": "MAHENDER GARH",
        "state": "HARYANA", "pincode": "123021", "status": "approved", "created_at": "2026-01-23 05:10:30",
        "security_deposit_amount": 100000.00, "security_deposit_status": "approved", "email": "pawan4587@gmail.com"
    },
    {
        "id": 20, "user_id": 21, "firm_name": "Zinam valley power pvt ltd", "contact_person": "Asab Uddin",
        "phone": "9101708036", "gst_number": None, "address_line1": "", "address_line2": "",
        "city": "", "district": "", "state": "Assam", "pincode": "782446", "status": "approved",
        "created_at": "2026-01-28 08:27:32", "security_deposit_amount": 100000.00,
        "security_deposit_status": "approved", "email": "asabuddin1408@gmail.com"
    },
    {
        "id": 30, "user_id": 31, "firm_name": "Alak Debbarma", "contact_person": "9612680103",
        "phone": "9612680103", "gst_number": None, "address_line1": "Kathal Bagan, Gourkha basti",
        "address_line2": "Green Heritage complex", "city": "Agartala", "district": "West Tripura",
        "state": "Tripura", "pincode": "799006", "status": "approved", "created_at": "2026-02-10 05:19:16",
        "security_deposit_amount": 100000.00, "security_deposit_status": "approved", "email": "alak78@gmail.com"
    },
    {
        "id": 37, "user_id": 38, "firm_name": "S.K Computer Services and Electricals", "contact_person": "Santosh Khaire",
        "phone": "7218070450", "gst_number": None, "address_line1": "AT.Khairewadi Po. Kanhur Mesai Tal.Shirur Dist. Pune",
        "address_line2": "", "city": "Shirur", "district": "Pune", "state": "Maharashtra", "pincode": "412218",
        "status": "approved", "created_at": "2026-02-21 05:26:38", "security_deposit_amount": 100000.00,
        "security_deposit_status": "approved", "email": "santoshkhaire6259@gmail.com"
    },
    {
        "id": 40, "user_id": 41, "firm_name": "Vedika Power", "contact_person": "Dilip Kumar Singh",
        "phone": "8638454043", "gst_number": None, "address_line1": "Bhitorsuti, Kaliabhomora",
        "address_line2": "No 1 Dolabari", "city": "Tezpur", "district": "Sonitpur",
        "state": "Assam", "pincode": "784027", "status": "approved", "created_at": "2026-02-26 05:59:32",
        "security_deposit_amount": 100000.00, "security_deposit_status": "approved", "email": "ved4power@gmail.com"
    },
    {
        "id": 47, "user_id": 48, "firm_name": "Bhati Enterprises", "contact_person": "Rahul bhati",
        "phone": "9548359974", "gst_number": None, "address_line1": "Village Falaida teh jewar",
        "address_line2": "", "city": "Greater noida", "district": "Gautam budhh nagar",
        "state": "Uttar pradesh", "pincode": "203135", "status": "approved", "created_at": "2026-03-14 06:52:56",
        "security_deposit_amount": 100000.00, "security_deposit_status": "approved", "email": "rahulbhati1514@gmail.com"
    }
]

# Missing orders (referencing the missing dealers)
MISSING_ORDERS = [
    {"id": 34, "dealer_id": 10, "order_number": "MGPO-1769276215", "total_amount": 106082.00, "payment_status": "pending", "status": "pending", "created_at": "2026-01-24 17:36:55", "items": [{"product_id": 7, "quantity": 2, "unit_price": 44950.00, "line_total": 106082.00}]},
    {"id": 35, "dealer_id": 10, "order_number": "MGPO-1769276281", "total_amount": 59020.50, "payment_status": "pending", "status": "pending", "created_at": "2026-01-24 17:38:01", "items": [{"product_id": 3, "quantity": 1, "unit_price": 56210.00, "line_total": 59020.50}]},
    {"id": 36, "dealer_id": 10, "order_number": "MGPO-1769508280", "total_amount": 165102.50, "payment_status": "pending", "status": "pending", "created_at": "2026-01-27 10:04:40", "items": [{"product_id": 7, "quantity": 2, "unit_price": 44950.00, "line_total": 106082.00}, {"product_id": 3, "quantity": 1, "unit_price": 56210.00, "line_total": 59020.50}]},
    {"id": 39, "dealer_id": 7, "order_number": "MGPO-1769664055", "total_amount": 53041.00, "payment_status": "pending", "status": "pending", "created_at": "2026-01-29 05:20:55", "items": [{"product_id": 7, "quantity": 1, "unit_price": 44950.00, "line_total": 53041.00}]},
    {"id": 40, "dealer_id": 7, "order_number": "MGPO-1769669518", "total_amount": 241679.50, "payment_status": "pending", "status": "pending", "created_at": "2026-01-29 06:51:58", "items": [{"product_id": 7, "quantity": 4, "unit_price": 44950.00, "line_total": 212164.00}, {"product_id": 4, "quantity": 1, "unit_price": 28110.00, "line_total": 29515.50}]},
    {"id": 41, "dealer_id": 20, "order_number": "MGPO-1770122423", "total_amount": 193461.00, "payment_status": "pending", "status": "pending", "created_at": "2026-02-03 12:40:23", "items": [{"product_id": 5, "quantity": 6, "unit_price": 27325.00, "line_total": 193461.00}]},
    {"id": 42, "dealer_id": 20, "order_number": "MGPO-1770197359", "total_amount": 193461.00, "payment_status": "paid", "status": "completed", "created_at": "2026-02-04 09:29:19", "payment_received_at": "2026-02-06", "items": [{"product_id": 5, "quantity": 6, "unit_price": 27325.00, "line_total": 193461.00}]},
    {"id": 43, "dealer_id": 10, "order_number": "MGPO-1770358427", "total_amount": 124661.50, "payment_status": "pending", "status": "pending", "created_at": "2026-02-06 06:13:47", "items": [{"product_id": 8, "quantity": 1, "unit_price": 68210.00, "line_total": 71620.50}, {"product_id": 7, "quantity": 1, "unit_price": 44950.00, "line_total": 53041.00}]},
    {"id": 44, "dealer_id": 14, "order_number": "MGPO-1770725529", "total_amount": 124661.50, "payment_status": "paid", "status": "completed", "created_at": "2026-02-10 12:12:09", "payment_received_at": "2026-02-10", "items": [{"product_id": 8, "quantity": 1, "unit_price": 68210.00, "line_total": 71620.50}, {"product_id": 7, "quantity": 1, "unit_price": 44950.00, "line_total": 53041.00}]},
    {"id": 45, "dealer_id": 14, "order_number": "MGPO-1770725726", "total_amount": 130641.00, "payment_status": "pending", "status": "pending", "created_at": "2026-02-10 12:15:26", "items": [{"product_id": 8, "quantity": 1, "unit_price": 68210.00, "line_total": 71620.50}, {"product_id": 3, "quantity": 1, "unit_price": 56210.00, "line_total": 59020.50}]},
    {"id": 46, "dealer_id": 30, "order_number": "MGPO-1770982372", "total_amount": 82556.50, "payment_status": "pending", "status": "pending", "created_at": "2026-02-13 11:32:52", "items": [{"product_id": 7, "quantity": 1, "unit_price": 44950.00, "line_total": 53041.00}, {"product_id": 4, "quantity": 1, "unit_price": 28110.00, "line_total": 29515.50}]},
    {"id": 48, "dealer_id": 7, "order_number": "MGPO-1771674140", "total_amount": 389767.00, "payment_status": "pending", "status": "pending", "created_at": "2026-02-21 11:42:20", "items": [{"product_id": 10, "quantity": 2, "unit_price": 21500.00, "line_total": 45150.00}, {"product_id": 7, "quantity": 2, "unit_price": 44950.00, "line_total": 106082.00}, {"product_id": 5, "quantity": 2, "unit_price": 27325.00, "line_total": 64487.00}, {"product_id": 4, "quantity": 5, "unit_price": 28110.00, "line_total": 147577.50}, {"product_id": 2, "quantity": 1, "unit_price": 25210.00, "line_total": 26470.50}]},
    {"id": 49, "dealer_id": 7, "order_number": "MGPO-1772862841", "total_amount": 412782.50, "payment_status": "pending", "status": "pending", "created_at": "2026-03-07 05:54:01", "items": [{"product_id": 7, "quantity": 5, "unit_price": 44950.00, "line_total": 265205.00}, {"product_id": 4, "quantity": 5, "unit_price": 28110.00, "line_total": 147577.50}]},
    {"id": 50, "dealer_id": 37, "order_number": "MGPO-1773834752", "total_amount": 90340.80, "payment_status": "paid", "status": "completed", "created_at": "2026-03-18 11:52:32", "payment_received_at": "2026-03-19", "items": [{"product_id": 15, "quantity": 1, "unit_price": 31610.00, "line_total": 37299.80}, {"product_id": 7, "quantity": 1, "unit_price": 44950.00, "line_total": 53041.00}]},
    {"id": 51, "dealer_id": 37, "order_number": "MGPO-1774158025", "total_amount": 137363.80, "payment_status": "paid", "status": "pending", "created_at": "2026-03-22 05:40:25", "payment_received_at": "2026-03-23", "items": [{"product_id": 14, "quantity": 1, "unit_price": 30610.00, "line_total": 36119.80}, {"product_id": 6, "quantity": 2, "unit_price": 42900.00, "line_total": 101244.00}]},
    {"id": 52, "dealer_id": 7, "order_number": "MGPO-1774258897", "total_amount": 530410.00, "payment_status": "pending", "status": "pending", "created_at": "2026-03-23 09:41:37", "items": [{"product_id": 7, "quantity": 10, "unit_price": 44950.00, "line_total": 530410.00}]},
]


async def fix_missing_data():
    """Import missing dealers and orders"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=== Importing Missing Dealers ===")
    imported_dealers = 0
    
    for dealer in MISSING_DEALERS:
        old_id = dealer['id']
        new_dealer_id = f"MGIPLDEL{old_id}"
        
        # Check if already exists
        existing = await db.dealers.find_one({"id": new_dealer_id})
        if existing:
            print(f"  Dealer {new_dealer_id} already exists, skipping")
            continue
        
        dealer_doc = {
            "id": new_dealer_id,
            "user_id": str(dealer.get('user_id')),
            "firm_name": dealer.get('firm_name', ''),
            "firm_type": "Proprietorship",
            "gst_number": dealer.get('gst_number'),
            "pan_number": None,
            "contact_person": dealer.get('contact_person', ''),
            "phone": dealer.get('phone', ''),
            "email": dealer.get('email', ''),
            "address": f"{dealer.get('address_line1', '')} {dealer.get('address_line2', '')}".strip(),
            "city": dealer.get('city', ''),
            "district": dealer.get('district', ''),
            "state": dealer.get('state', ''),
            "pincode": dealer.get('pincode', ''),
            "tier": "silver",
            "status": dealer.get('status', 'pending'),
            "security_deposit_amount": float(dealer.get('security_deposit_amount', 100000)),
            "security_deposit_status": dealer.get('security_deposit_status', 'not_paid'),
            "created_at": dealer.get('created_at'),
            "legacy_id": old_id
        }
        
        await db.dealers.insert_one(dealer_doc)
        imported_dealers += 1
        print(f"  Imported {new_dealer_id}: {dealer.get('firm_name')}")
        
        # Also create user account
        user_doc = {
            "id": str(uuid.uuid4()),
            "email": dealer.get('email', ''),
            "first_name": dealer.get('contact_person', '').split()[0] if dealer.get('contact_person') else dealer.get('firm_name', ''),
            "last_name": ' '.join(dealer.get('contact_person', '').split()[1:]) if dealer.get('contact_person') else '',
            "phone": dealer.get('phone', ''),
            "role": "dealer",
            "address": dealer_doc['address'],
            "city": dealer_doc['city'],
            "state": dealer_doc['state'],
            "pincode": dealer_doc['pincode'],
            "created_at": dealer_doc['created_at'],
            "dealer_id": new_dealer_id
        }
        
        existing_user = await db.users.find_one({"email": dealer.get('email')})
        if not existing_user:
            await db.users.insert_one(user_doc)
    
    print(f"Imported {imported_dealers} missing dealers")
    
    print("\n=== Importing Missing Orders ===")
    imported_orders = 0
    
    for order in MISSING_ORDERS:
        old_dealer_id = order['dealer_id']
        new_dealer_id = f"MGIPLDEL{old_dealer_id}"
        order_number = order['order_number']
        
        # Check if already exists
        existing = await db.dealer_orders.find_one({"order_number": order_number})
        if existing:
            print(f"  Order {order_number} already exists, skipping")
            continue
        
        order_doc = {
            "id": str(uuid.uuid4()),
            "dealer_id": new_dealer_id,
            "order_number": order_number,
            "items": order.get('items', []),
            "total_amount": float(order.get('total_amount', 0)),
            "payment_status": order.get('payment_status', 'pending'),
            "order_status": order.get('status', 'pending'),
            "payment_received_at": order.get('payment_received_at'),
            "created_at": order.get('created_at'),
            "notes": "",
            "legacy_order_id": order['id']
        }
        
        await db.dealer_orders.insert_one(order_doc)
        imported_orders += 1
        print(f"  Imported {order_number} for dealer {new_dealer_id}")
    
    print(f"Imported {imported_orders} missing orders")
    
    # Final counts
    dealer_count = await db.dealers.count_documents({})
    order_count = await db.dealer_orders.count_documents({})
    
    print(f"\n=== Final Counts ===")
    print(f"Total Dealers: {dealer_count}")
    print(f"Total Orders: {order_count}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(fix_missing_data())

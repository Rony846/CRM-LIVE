"""
MuscleGrid CRM - Add More Test Data
Adds realistic volume of test data to match production numbers
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import random
import string
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Product names
PRODUCTS = [
    "MuscleGrid 6.2kW Heavy Duty Hybrid Solar Inverter",
    "MuscleGrid 10.2kW Heavy Duty Solar Hybrid Inverter",
    "MuscleGrid 3kW Solar Inverter Set",
    "MuscleGrid 4.2kW True Hybrid Triple MPPT",
    "MuscleGrid 8KVA Voltage Stabilizer",
    "MuscleGrid 15 kVA Main Line Voltage Stabilizer",
    "MuscleGrid 10kVA Automatic Voltage Stabilizer",
    "Gootu 6.2kW Hybrid Solar Inverter",
    "MuscleGrid 48V 120Ah Lithium Battery",
    "MuscleGrid 24V 100Ah Lead Acid Battery"
]

ISSUES = [
    "Error code showing on display",
    "Inverter not starting",
    "Battery not charging properly",
    "Low output voltage",
    "Display not working",
    "Strange noise from unit",
    "Solar charging not working",
    "Overheating issue",
    "Auto shutdown problem",
    "Output fluctuation",
    "Fan not working",
    "MPPT not tracking",
    "Battery draining fast",
    "No backup during power cut",
    "Red light blinking continuously"
]

CITIES = [
    "Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Pune",
    "Ahmedabad", "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal",
    "Patna", "Vadodara", "Ghaziabad", "Ludhiana", "Agra", "Nashik"
]

COURIERS = ["Delhivery", "BlueDart", "DTDC", "FedEx", "Ecom Express"]

STATUSES_PHONE = ["new_request", "call_support_followup", "resolved_on_call", "closed_by_agent"]
STATUSES_HARDWARE = ["hardware_service", "awaiting_label", "label_uploaded", "received_at_factory", "in_repair", "repair_completed", "ready_for_dispatch", "dispatched"]

def generate_ticket_number(date):
    random_part = ''.join(random.choices(string.digits, k=5))
    return f"MG-R-{date.strftime('%Y%m%d')}-{random_part}"

def generate_phone():
    return f"9{random.randint(100000000, 999999999)}"

def generate_serial():
    return f"MG{random.randint(10000000, 99999999)}"

async def add_bulk_tickets():
    print("Adding bulk tickets...")
    
    # Get existing users
    support_users = await db.users.find({"role": "call_support"}, {"_id": 0}).to_list(10)
    tech_users = await db.users.find({"role": "service_agent"}, {"_id": 0}).to_list(10)
    customers = await db.users.find({"role": "customer"}, {"_id": 0}).to_list(100)
    
    # Create 300 more tickets to reach ~329 total
    tickets_to_create = 315
    phone_count = 0
    hardware_count = 0
    
    now = datetime.now(timezone.utc)
    
    for i in range(tickets_to_create):
        # Random date in last 90 days
        days_ago = random.randint(0, 90)
        created_at = now - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        
        # Determine support type (60% phone, 40% hardware to get ~197 phone, ~126 hardware)
        is_hardware = random.random() < 0.38
        
        if is_hardware:
            hardware_count += 1
            support_type = "hardware"
            status = random.choice(STATUSES_HARDWARE)
        else:
            phone_count += 1
            support_type = "phone"
            status = random.choice(STATUSES_PHONE)
        
        # Calculate SLA
        sla_hours = 168 if is_hardware else 24
        sla_due = created_at + timedelta(hours=sla_hours)
        
        # 40% chance of SLA breach for open tickets
        sla_breached = False
        if status not in ["closed", "closed_by_agent", "resolved_on_call", "delivered", "dispatched"]:
            sla_breached = random.random() < 0.40
        
        # Random customer
        if customers and random.random() < 0.7:
            customer = random.choice(customers)
            customer_name = f"{customer['first_name']} {customer['last_name']}"
            customer_phone = customer["phone"]
            customer_email = customer["email"]
            customer_id = customer["id"]
            customer_city = customer.get("city") or random.choice(CITIES)
        else:
            customer_name = f"Customer {random.randint(1000, 9999)}"
            customer_phone = generate_phone()
            customer_email = f"customer{random.randint(1000, 9999)}@email.com"
            customer_id = None
            customer_city = random.choice(CITIES)
        
        # Device type
        product = random.choice(PRODUCTS)
        if "battery" in product.lower():
            device_type = "Battery"
        elif "stabilizer" in product.lower():
            device_type = "Stabilizer"
        else:
            device_type = "Inverter"
        
        # Assigned to
        assigned_to = None
        assigned_to_name = None
        if status in ["in_repair", "repair_completed"] and tech_users:
            tech = random.choice(tech_users)
            assigned_to = tech["id"]
            assigned_to_name = f"{tech['first_name']} {tech['last_name']}"
        elif status in ["call_support_followup"] and support_users:
            agent = random.choice(support_users)
            assigned_to = agent["id"]
            assigned_to_name = f"{agent['first_name']} {agent['last_name']}"
        
        # Timestamps
        closed_at = None
        received_at = None
        repaired_at = None
        dispatched_at = None
        
        if status in ["closed", "closed_by_agent", "resolved_on_call"]:
            closed_at = (created_at + timedelta(hours=random.randint(1, 48))).isoformat()
        
        if status in ["received_at_factory", "in_repair", "repair_completed", "ready_for_dispatch", "dispatched"]:
            received_at = (created_at + timedelta(days=random.randint(2, 5))).isoformat()
        
        if status in ["repair_completed", "ready_for_dispatch", "dispatched"]:
            repaired_at = (created_at + timedelta(days=random.randint(4, 7))).isoformat()
        
        if status == "dispatched":
            dispatched_at = (created_at + timedelta(days=random.randint(6, 10))).isoformat()
        
        ticket_doc = {
            "id": str(uuid.uuid4()),
            "ticket_number": generate_ticket_number(created_at),
            "customer_id": customer_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_email": customer_email,
            "customer_address": f"Address {random.randint(100, 999)}, {customer_city}",
            "customer_city": customer_city,
            "device_type": device_type,
            "product_name": product,
            "serial_number": generate_serial(),
            "invoice_number": f"INV-{random.randint(100000, 999999)}",
            "order_id": f"AMZ-{random.randint(100000, 999999)}",
            "invoice_file": None,
            "issue_description": random.choice(ISSUES),
            "support_type": support_type,
            "status": status,
            "diagnosis": "Diagnosed" if status not in ["new_request"] else None,
            "agent_notes": "Agent notes here" if random.random() < 0.5 else None,
            "repair_notes": "Repaired and tested" if status in ["repair_completed", "ready_for_dispatch", "dispatched"] else None,
            "assigned_to": assigned_to,
            "assigned_to_name": assigned_to_name,
            "pickup_label": "/api/files/labels/sample.pdf" if status in ["label_uploaded", "received_at_factory", "in_repair", "repair_completed", "ready_for_dispatch", "dispatched"] else None,
            "pickup_courier": random.choice(COURIERS) if status in ["label_uploaded", "received_at_factory", "in_repair", "repair_completed", "ready_for_dispatch", "dispatched"] else None,
            "pickup_tracking": f"{random.choice(['DL', 'BD', 'DT'])}{random.randint(100000000, 999999999)}" if status in ["label_uploaded", "received_at_factory", "in_repair", "repair_completed", "ready_for_dispatch", "dispatched"] else None,
            "return_label": "/api/files/labels/return.pdf" if status in ["ready_for_dispatch", "dispatched"] else None,
            "return_courier": random.choice(COURIERS) if status in ["ready_for_dispatch", "dispatched"] else None,
            "return_tracking": f"{random.choice(['DL', 'BD', 'DT'])}{random.randint(100000000, 999999999)}" if status in ["ready_for_dispatch", "dispatched"] else None,
            "service_charges": float(random.randint(500, 5000)) if status in ["ready_for_dispatch", "dispatched"] else None,
            "service_invoice": "/api/files/service_invoices/sample.pdf" if status in ["ready_for_dispatch", "dispatched"] else None,
            "sla_due": sla_due.isoformat(),
            "sla_breached": sla_breached,
            "created_by": None,
            "created_at": created_at.isoformat(),
            "updated_at": now.isoformat(),
            "closed_at": closed_at,
            "received_at": received_at,
            "repaired_at": repaired_at,
            "dispatched_at": dispatched_at,
            "history": [{
                "action": "Ticket created",
                "by": "System",
                "by_id": "system",
                "by_role": "system",
                "timestamp": created_at.isoformat(),
                "details": {}
            }]
        }
        
        try:
            await db.tickets.insert_one(ticket_doc)
        except Exception as e:
            print(f"  Error creating ticket: {e}")
        
        if (i + 1) % 50 == 0:
            print(f"  Created {i + 1} tickets...")
    
    print(f"  Created {tickets_to_create} tickets (Phone: {phone_count}, Hardware: {hardware_count})")

async def add_sample_dispatches():
    print("Adding sample dispatches...")
    
    accountant = await db.users.find_one({"role": "accountant"}, {"_id": 0})
    
    for i in range(20):
        now = datetime.now(timezone.utc)
        created_at = now - timedelta(days=random.randint(1, 30))
        
        status = random.choice(["pending_label", "ready_for_dispatch", "dispatched"])
        
        dispatch_doc = {
            "id": str(uuid.uuid4()),
            "dispatch_number": f"MG-D-{created_at.strftime('%Y%m%d')}-{str(i+1).zfill(5)}",
            "dispatch_type": random.choice(["outbound", "reverse_pickup", "return_dispatch"]),
            "ticket_id": None,
            "ticket_number": None,
            "sku": f"SKU-{random.randint(1000, 9999)}",
            "customer_name": f"Customer {random.randint(100, 999)}",
            "phone": generate_phone(),
            "address": f"Address {random.randint(100, 999)}, {random.choice(CITIES)}",
            "city": random.choice(CITIES),
            "state": "State",
            "pincode": str(random.randint(100000, 999999)),
            "reason": random.choice(["Replacement", "Spare part", "New order"]),
            "note": "Sample dispatch",
            "courier": random.choice(COURIERS) if status != "pending_label" else None,
            "tracking_id": f"TRK{random.randint(100000000, 999999999)}" if status != "pending_label" else None,
            "label_file": "/api/files/labels/sample.pdf" if status != "pending_label" else None,
            "status": status,
            "service_charges": None,
            "service_invoice": None,
            "created_by": accountant["id"] if accountant else None,
            "created_by_name": f"{accountant['first_name']} {accountant['last_name']}" if accountant else None,
            "created_at": created_at.isoformat(),
            "updated_at": now.isoformat(),
            "scanned_in_at": None,
            "scanned_out_at": now.isoformat() if status == "dispatched" else None
        }
        
        await db.dispatches.insert_one(dispatch_doc)
    
    print("  Created 20 dispatches")

async def add_more_gate_logs():
    print("Adding more gate logs...")
    
    gate_user = await db.users.find_one({"role": "gate"}, {"_id": 0})
    if not gate_user:
        gate_user = await db.users.find_one({"role": "dispatcher"}, {"_id": 0})
    
    if not gate_user:
        print("  Skipped - no gate/dispatcher user")
        return
    
    now = datetime.now(timezone.utc)
    
    for i in range(50):
        scanned_at = now - timedelta(hours=random.randint(1, 168))
        
        gate_log = {
            "id": str(uuid.uuid4()),
            "scan_type": random.choice(["inward", "outward"]),
            "tracking_id": f"{random.choice(['DL', 'BD', 'DT', 'FX'])}{random.randint(100000000, 999999999)}",
            "courier": random.choice(COURIERS),
            "ticket_id": None,
            "ticket_number": None,
            "dispatch_id": None,
            "dispatch_number": None,
            "customer_name": f"Customer {random.randint(100, 999)}",
            "scanned_by": gate_user["id"],
            "scanned_by_name": f"{gate_user['first_name']} {gate_user['last_name']}",
            "notes": None,
            "scanned_at": scanned_at.isoformat()
        }
        
        await db.gate_logs.insert_one(gate_log)
    
    print("  Created 50 gate logs")

async def print_stats():
    print("\n" + "="*60)
    print("DATABASE STATS")
    print("="*60)
    
    total_tickets = await db.tickets.count_documents({})
    open_tickets = await db.tickets.count_documents({"status": {"$nin": ["closed", "closed_by_agent", "resolved_on_call", "delivered", "dispatched"]}})
    hardware_tickets = await db.tickets.count_documents({"support_type": "hardware"})
    phone_tickets = await db.tickets.count_documents({"support_type": "phone"})
    sla_breached = await db.tickets.count_documents({"sla_breached": True, "status": {"$nin": ["closed", "closed_by_agent", "resolved_on_call", "delivered", "dispatched"]}})
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_tickets = await db.tickets.count_documents({"created_at": {"$gte": today_start.isoformat()}})
    
    total_dispatches = await db.dispatches.count_documents({})
    total_gate_logs = await db.gate_logs.count_documents({})
    
    print(f"\nTickets:")
    print(f"  Total: {total_tickets}")
    print(f"  Open: {open_tickets}")
    print(f"  Today's: {today_tickets}")
    print(f"  Hardware: {hardware_tickets}")
    print(f"  Phone: {phone_tickets}")
    print(f"  SLA Breached: {sla_breached}")
    print(f"\nDispatches: {total_dispatches}")
    print(f"Gate Logs: {total_gate_logs}")
    print("="*60)

async def main():
    print("="*60)
    print("Adding More Test Data")
    print("="*60)
    
    await add_bulk_tickets()
    await add_sample_dispatches()
    await add_more_gate_logs()
    await print_stats()

if __name__ == "__main__":
    asyncio.run(main())

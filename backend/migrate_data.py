"""
MuscleGrid CRM - Enterprise Data Migration Script
Migrates data from old MySQL database + creates test data for all workflows
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import os
import random
import string
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def generate_ticket_number():
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = ''.join(random.choices(string.digits, k=5))
    return f"MG-R-{date_str}-{random_part}"

# ====================== OLD DATA FROM SQL ======================

OLD_CUSTOMERS = [
    {"id": 1, "name": "Aj kumar Sachan", "phone": "6005409722", "email": "aj.sachan@rediffmail.com", "address": "ABHISHEK SOLAR SHOP, PATEL COWK, NEAR ANAND LAWN,TOWN- PUKHRAYAN, KANPUR DEHAT, UP. PIN-209111", "city": "Kanpur Dehat"},
    {"id": 2, "name": "Praveen kumar", "phone": "6201775807", "email": "pratapkumarujjwal@gmail.com", "address": "shivpuri, mantubabu chowk, (maa ambey garnel store)", "city": "Shivpuri"},
    {"id": 3, "name": "Divya Raj Jeevan Verma", "phone": "6387483366", "email": "jayramdev273@gmail.com", "address": "C-57 , Growth Centre Bijouli Bijauli Jhansi - 284135", "city": "Jhansi"},
    {"id": 4, "name": "SK HABIB AL RASHID", "phone": "7003916944", "email": "habibalrashid@gmail.com", "address": "Village: Dakshin Baguan, Post: Chanserpur, Police STN: Tamluk, District: Purba Medinipur, West Bengal, PIN: 721653", "city": "Purba Medinipur"},
    {"id": 5, "name": "Rajiv kumar", "phone": "7015607503", "email": "rajivsaini101@gmail.com", "address": "Vpo saran", "city": "Saran"},
    {"id": 6, "name": "siddharth rastogi", "phone": "7060512741", "email": "siddharth.mask@gmail.com", "address": "308 Shraddha nursing home Moh Anta", "city": "Anta"},
    {"id": 7, "name": "Shis Pal Jangra", "phone": "7063083313", "email": "shispalsingh64@gmail.com", "address": "SHIS PAL SINGH VPO BIGOWA DIST. CHARKHI DADRI HARYANA PIN 127307", "city": "Charkhi Dadri"},
    {"id": 8, "name": "Akash Bar", "phone": "7074355950", "email": "akashbar420@gmail.com", "address": "Vill+P.O- Katkadebi Chak,P.S-Khejuri,Dist-Purba Medinipur,Pin-721431", "city": "Purba Medinipur"},
    {"id": 9, "name": "Sujan Das", "phone": "7099228820", "email": None, "address": "JURAPUKURI", "city": "Jurapukuri"},
    {"id": 10, "name": "Santosh Khaire", "phone": "7218070450", "email": "santoshkhaire6259@gmail.com", "address": "AP. Mukhai Tal.Shirur Dist. Pune 412208", "city": "Pune"},
    {"id": 11, "name": "Saurabh Mule", "phone": "7262951319", "email": "saurabhmule101@gmail.com", "address": "Sr no 386 plot no 43 shiv shrusti park kaljewadi tajne mala charoli pimpri Chinchwad Maharashtra 412105", "city": "Pimpri Chinchwad"},
    {"id": 12, "name": "ANKUR GOYAL", "phone": "7300607837", "email": "gangahandicraftexports@gmail.com", "address": "Plot No 1, Mayur Vihar, Chamrauli", "city": "Agra"},
    {"id": 13, "name": "Manoj Kumar", "phone": "7500072290", "email": "manojkuch1971@gmail.com", "address": "Near Om Farm House Shiv Vihar Colony Dhampur Dist. Bijnor", "city": "Bijnor"},
    {"id": 14, "name": "Pankaj Kumar", "phone": "7503507441", "email": "pkpk10289@gmail.com", "address": "3010 Naipura,Loni Ghaziabad.UP, near (S.B.S.G) inter College", "city": "Ghaziabad"},
    {"id": 15, "name": "Jayesh Salve", "phone": "7744996608", "email": "salvejayesh777@gmail.com", "address": "Plot 10, Near Trilokeshwar Mahadev Temple, Shiv Colony, Amalner, Tal. Amalner, Dist. Jalgaon, Maharashtra", "city": "Jalgaon"},
    {"id": 16, "name": "Shubham Jadhav", "phone": "7773911639", "email": None, "address": "Ashirwad Niwas, Yamai nagar near behind Datt Trailor, Babhulgaon, Pandharpur 413304", "city": "Pandharpur"},
    {"id": 17, "name": "Craftworks", "phone": "7795853059", "email": "office.surama@gmail.com", "address": "Surama Textiles Durgigudi Main road", "city": "Durgigudi"},
    {"id": 18, "name": "Manas Gupta", "phone": "7798309792", "email": "manas.cdac@gmail.com", "address": "7B Azad Nagar Madhoganj District Hardoi Uttar Pradesh Pin 241302", "city": "Hardoi"},
    {"id": 19, "name": "Dhoop singh", "phone": "8052219124", "email": "dhoopsinghbundela96@gmail.com", "address": "19 paraun lalitpur Uttar Pradesh", "city": "Lalitpur"},
    {"id": 20, "name": "Manjeet", "phone": "8058240668", "email": "manjeetkhileri1998@gmail.com", "address": "Manjeet Khileri, Durga sadan, Jato ka bass, Panchroliya Merta City, 341510", "city": "Merta City"},
    {"id": 21, "name": "yogesh", "phone": "8076783598", "email": "tomar_boyz@rediffmail.com", "address": "19k ram vihar colony near puch enclave chauprola noida -201009", "city": "Noida"},
    {"id": 22, "name": "YOGESH GOYAL", "phone": "8103745558", "email": None, "address": "SAI NAGAR GAIS GODAM KE PAS RAJA COACHING WALI GALI MORAR GWALIOR", "city": "Gwalior"},
    {"id": 23, "name": "Nirav karsanbhai patel", "phone": "8140894473", "email": "patelniravk@gmail.com", "address": "223,padar faliyu, at. Sherdi, ta. Olpad, surat", "city": "Surat"},
    {"id": 24, "name": "Tirath Singh", "phone": "8195036400", "email": None, "address": "Tirath Singh 513 Lakhan ke patte Kapurthala City Hamira Punjab 144802", "city": "Kapurthala"},
    {"id": 25, "name": "Pawan patwa", "phone": "8208278437", "email": "patwamayra@gmail.com", "address": "At Mahalaxmi post charoti taluka Dahanu district Palghar Maharashtra 401602 India", "city": "Palghar"},
    {"id": 26, "name": "Kundan Kumar jaiswal", "phone": "8340580561", "email": "jaiswalkundan92@gmail.com", "address": "At laxmipur babhaniya po laxmipur babhaniya ps kahalgaon distt bhagalpur", "city": "Bhagalpur"},
    {"id": 27, "name": "Ravi deswal", "phone": "8397813434", "email": None, "address": "V.p.o surehti dist- jhajjar haryaya pin cod 124109", "city": "Jhajjar"},
    {"id": 28, "name": "Chandrakant sah", "phone": "8409345457", "email": "chandrakantsahgodda@gmail.com", "address": "At post deobandha district godda jharkhand", "city": "Godda"},
    {"id": 29, "name": "Balaji enterprises", "phone": "8445842727", "email": None, "address": "Vill nagla pachauri Post naugaon", "city": "Naugaon"},
    {"id": 30, "name": "Aryaman Kavadia", "phone": "8452001030", "email": "info@idesignlab.us", "address": "Sevalaya NGO, Kasuva Village, Pakkam Post, Tiruninravur, Tiruvallur, Tamil Nadu - 602024", "city": "Tiruvallur"},
    {"id": 31, "name": "Amit Kumar", "phone": "9996055014", "email": "ami_t@live.com", "address": "Amit Kumar Vpo. Neerpur, Tish. Narnaul Dist. Mahendragrah 123001 Narnaul HR India", "city": "Narnaul"},
    {"id": 32, "name": "VIPIN NB", "phone": "9746803327", "email": "Vipin4guys@gmail.com", "address": "MWRA 35,NERIYAMKOTTU HOUSE, PEREPARAMBU ROAD, MAMANGALAM, PALARIVATTOM P.O,KOCHI-682025", "city": "Kochi"},
    {"id": 33, "name": "Haraprasad Mallick", "phone": "9153131557", "email": "debjyotimallickonrage@gmail.com", "address": "Gobindanagar Sarada Pally, Bankura PO: Kenduadihi P.S : Bankura District- Bankura PIN - 722102 (W.B)", "city": "Bankura"},
    {"id": 34, "name": "Anoob g b", "phone": "8907818307", "email": "anoobgb007@gmail.com", "address": "Anugraha 85a, Ranni Lane, Peroorkada.p.o, Trivandrum-695005", "city": "Trivandrum"},
    {"id": 35, "name": "AUDIITER", "phone": "9940698695", "email": "audiiterstaff@gmail.com", "address": "AUDIITER 3RD FLOOR, BALAJI CONSULTING SERVICES, 27/34 MADHA CHURCH RD, MANDAVELI, MYLAPORE CHENNAI, TAMIL NADU, 600028", "city": "Chennai"},
    {"id": 36, "name": "Prabhu bisht", "phone": "9897035677", "email": None, "address": "Rawat cottage talla cheenakhan almora uttrakhand -263601", "city": "Almora"},
    {"id": 37, "name": "Rajconstruction", "phone": "9893583788", "email": "rajit50@gmail.com", "address": "Ratlam", "city": "Ratlam"},
    {"id": 38, "name": "Sachin", "phone": "9518635268", "email": "sachinbhar42@gmail.com", "address": "Meham", "city": "Meham"},
    {"id": 39, "name": "Bharti Limba", "phone": "9785012667", "email": "bhartilimba@gmail.com", "address": "Ridmalsar", "city": "Ridmalsar"},
    {"id": 40, "name": "Kamta Nath Patel", "phone": "9399131619", "email": "pushpendra200091@gmail.com", "address": "Raigarh", "city": "Raigarh"},
]

# Migrated tickets with full lifecycle data
OLD_TICKETS = [
    {
        "id": 1, "customer_name": "Rajconstruction", "customer_phone": "9893583788", "customer_email": "rajit50@gmail.com",
        "product_name": "6.2kv", "serial_number": "92062241230030", "invoice_number": "IN-69",
        "issue_description": "Error \"9\" appearing on the screen", "city": "Ratlam",
        "status": "call_support_followup", "support_type": "phone", "assigned_to_name": "Angad"
    },
    {
        "id": 2, "customer_name": "Sachin", "customer_phone": "9518635268", "customer_email": "sachinbhar42@gmail.com",
        "product_name": "Musclegrid 5 kva (90-300v) 2 ton ac stablizer", "serial_number": "MG2405090AC450", "invoice_number": "M009408062501864",
        "issue_description": "Stabilizer not working properly", "city": "Meham",
        "status": "new_request", "support_type": None, "assigned_to_name": None
    },
    {
        "id": 3, "customer_name": "Bharti Limba", "customer_phone": "9785012667", "customer_email": "bhartilimba@gmail.com",
        "product_name": "Musclegrid 10.2 kva inverter", "serial_number": "MG-H48102E160-D", "invoice_number": "DL-10442526",
        "issue_description": "Inverter not charging battery", "city": "Ridmalsar",
        "status": "awaiting_label", "support_type": "hardware", "assigned_to_name": "Aman"
    },
    {
        "id": 4, "customer_name": "Amit Kumar", "customer_phone": "9996055014", "customer_email": "ami_t@live.com",
        "product_name": "JSN-02430E80", "serial_number": "920302408290008", "invoice_number": "AMZ-001234",
        "issue_description": "Error \"9\" appearing on the screen", "city": "Narnaul",
        "status": "received_at_factory", "support_type": "hardware", "assigned_to_name": None
    },
    {
        "id": 5, "customer_name": "VIPIN NB", "customer_phone": "9746803327", "customer_email": "Vipin4guys@gmail.com",
        "product_name": "MG-H4862E120-D", "serial_number": "92060231201089", "invoice_number": "KER-98765",
        "issue_description": "Battery charging and Battery load not taking error code showing bp", "city": "Kochi",
        "status": "closed_by_agent", "support_type": "phone", "assigned_to_name": None
    },
    {
        "id": 6, "customer_name": "Anoob g b", "customer_phone": "8907818307", "customer_email": "anoobgb007@gmail.com",
        "product_name": "Gootu 6.2kW", "serial_number": "GOOTU6-6248-003", "invoice_number": "TVM-55443",
        "issue_description": "This hybrid inverter 6.2KW is not turning on when supply power of 230V is given", "city": "Trivandrum",
        "status": "resolved_on_call", "support_type": "phone", "assigned_to_name": None
    },
    {
        "id": 7, "customer_name": "ANKUR GOYAL", "customer_phone": "7300607837", "customer_email": "gangahandicraftexports@gmail.com",
        "product_name": "MG2410090AM", "serial_number": "MG2410100AM035", "invoice_number": "AGR-112233",
        "issue_description": "Stabilizer red light is continuously blinking and stabilizer is not giving power output", "city": "Agra",
        "status": "closed_by_agent", "support_type": "phone", "assigned_to_name": None
    },
    {
        "id": 8, "customer_name": "Haraprasad Mallick", "customer_phone": "9153131557", "customer_email": "debjyotimallickonrage@gmail.com",
        "product_name": "MuscleGrid 10.2KW Heavy Duty Solar Hybrid Inverter", "serial_number": "85044010", "invoice_number": "WB-998877",
        "issue_description": "Lithium battery cell no 6 and 14 voltage low", "city": "Bankura",
        "status": "in_repair", "support_type": "hardware", "assigned_to_name": "Tech1"
    },
    {
        "id": 9, "customer_name": "Haraprasad Mallick", "customer_phone": "9153131557", "customer_email": "debjyotimallickonrage@gmail.com",
        "product_name": "MuscleGrid India 6.2 KW True Hybrid Heavy Duty Triple MPPT", "serial_number": "4263567", "invoice_number": "WB-665544",
        "issue_description": "No power is coming from both AC outputs. Please advise on how to fix.", "city": "Bankura",
        "status": "repair_completed", "support_type": "hardware", "assigned_to_name": "Tech1"
    },
    {
        "id": 10, "customer_name": "Prabhu bisht", "customer_phone": "9897035677", "customer_email": "",
        "product_name": "6.2 True Hybrid Heavy Duty Batteryless Triple MPPT Solar Inverter", "serial_number": "MG25010044", "invoice_number": "UTK-443322",
        "issue_description": "No display", "city": "Almora",
        "status": "resolved_on_call", "support_type": "phone", "assigned_to_name": None
    },
    {
        "id": 11, "customer_name": "Dhoop singh", "customer_phone": "8052219124", "customer_email": "dhoopsinghbundela96@gmail.com",
        "product_name": "24V Battery", "serial_number": "12345", "invoice_number": "UP-554433",
        "issue_description": "Battery not taking load", "city": "Lalitpur",
        "status": "ready_for_dispatch", "support_type": "hardware", "assigned_to_name": None
    },
    {
        "id": 12, "customer_name": "Divya Raj Jeevan Verma", "customer_phone": "6387483366", "customer_email": "jayramdev273@gmail.com",
        "product_name": "MG3KWSET", "serial_number": "B0CGQ359GS", "invoice_number": "JHS-776655",
        "issue_description": "Solar Charging section not working. Burning smell observed along with black smoke", "city": "Jhansi",
        "status": "dispatched", "support_type": "hardware", "assigned_to_name": None
    },
    {
        "id": 13, "customer_name": "AUDIITER", "customer_phone": "9940698695", "customer_email": "audiiterstaff@gmail.com",
        "product_name": "Muscle Grid Inverter", "serial_number": "NA", "invoice_number": "CHE-889900",
        "issue_description": "Need tech help", "city": "Chennai",
        "status": "resolved_on_call", "support_type": "phone", "assigned_to_name": None
    },
    {
        "id": 14, "customer_name": "Kamta Nath Patel", "customer_phone": "9399131619", "customer_email": "pushpendra200091@gmail.com",
        "product_name": "MuscleGrid", "serial_number": "MG8KVA90CAML", "invoice_number": "FAQWFQ2600000135",
        "issue_description": "Display not working", "city": "Raigarh",
        "status": "closed_by_agent", "support_type": "phone", "assigned_to_name": None
    },
]

OLD_SKUS = [
    {"sku_code": "MG-H4862E120-D", "model_name": "MuscleGrid 6.2kW Heavy Duty Hybrid Solar Inverter with 120Ah 48V Lithium Battery"},
    {"sku_code": "MG-H48102E160", "model_name": "MuscleGrid 10.2kW Heavy Duty Hybrid Solar Inverter with 160Ah 48V Lithium Battery"},
    {"sku_code": "MG3KWSET", "model_name": "MuscleGrid 3kW Solar Inverter Set"},
    {"sku_code": "MG-6.2KW", "model_name": "MuscleGrid 6.2kW True Hybrid Heavy Duty Triple MPPT Battery Less Solar Inverter"},
    {"sku_code": "MG-4.2KW", "model_name": "MuscleGrid 4.2kW True Hybrid Heavy Duty Triple MPPT Battery Less Solar Inverter"},
    {"sku_code": "MG-10.2KW", "model_name": "MuscleGrid 10.2kW Heavy Duty Solar Hybrid Inverter"},
    {"sku_code": "MG8KVA90V", "model_name": "MuscleGrid 8KVA (90v to 300v) 6400W Copper Wired Heavy Duty Voltage Stabilizer"},
    {"sku_code": "MG15KVA130V", "model_name": "MuscleGrid 15 kVA 130 - 280 V 12000 W Main Line Voltage Stabilizer"},
    {"sku_code": "MG2410090AM", "model_name": "MuscleGrid 10kVA 90-280V Automatic Voltage Stabilizer"},
    {"sku_code": "MG-GOOTU-6.2KW", "model_name": "Gootu 6.2kW Hybrid Solar Inverter"},
]

async def clear_existing_data():
    print("Clearing existing data...")
    await db.users.delete_many({})
    await db.tickets.delete_many({})
    await db.warranties.delete_many({})
    await db.dispatches.delete_many({})
    await db.gate_logs.delete_many({})
    await db.products.delete_many({})
    print("Cleared all collections.")

async def create_system_users():
    print("\nCreating system users...")
    
    system_users = [
        {"email": "admin@musclegrid.in", "password": "admin123", "first_name": "Admin", "last_name": "User", "role": "admin", "phone": "9999999901"},
        {"email": "support@musclegrid.in", "password": "support123", "first_name": "Angad", "last_name": "Singh", "role": "call_support", "phone": "9999999902"},
        {"email": "support2@musclegrid.in", "password": "support123", "first_name": "Rahul", "last_name": "Sharma", "role": "call_support", "phone": "9999999903"},
        {"email": "accountant@musclegrid.in", "password": "accountant123", "first_name": "Priya", "last_name": "Gupta", "role": "accountant", "phone": "9999999904"},
        {"email": "dispatcher@musclegrid.in", "password": "dispatch123", "first_name": "Vikram", "last_name": "Kumar", "role": "dispatcher", "phone": "9999999905"},
        {"email": "technician@musclegrid.in", "password": "tech123", "first_name": "Aman", "last_name": "Verma", "role": "service_agent", "phone": "9999999906"},
        {"email": "technician2@musclegrid.in", "password": "tech123", "first_name": "Suresh", "last_name": "Yadav", "role": "service_agent", "phone": "9999999907"},
        {"email": "gate@musclegrid.in", "password": "gate123", "first_name": "Gate", "last_name": "Operator", "role": "gate", "phone": "9999999908"},
    ]
    
    created_users = {}
    for user in system_users:
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        user_doc = {
            "id": user_id,
            "email": user["email"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "phone": user["phone"],
            "role": user["role"],
            "password_hash": hash_password(user["password"]),
            "address": "MuscleGrid Office, Delhi",
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "110001",
            "created_at": now,
            "updated_at": now
        }
        
        await db.users.insert_one(user_doc)
        created_users[user["role"]] = user_id
        created_users[user["first_name"]] = user_id
        print(f"  Created {user['role']}: {user['email']}")
    
    return created_users

async def migrate_customers():
    print("\nMigrating customers...")
    
    customer_id_map = {}
    migrated = 0
    
    for old_customer in OLD_CUSTOMERS:
        if not old_customer.get("name") or not old_customer.get("phone"):
            continue
            
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        name_parts = old_customer["name"].split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""
        
        email = old_customer.get("email")
        if not email:
            email = f"customer_{old_customer['phone']}@musclegrid.in"
        
        user_doc = {
            "id": user_id,
            "legacy_id": old_customer["id"],
            "email": email.lower(),
            "first_name": first_name,
            "last_name": last_name,
            "phone": old_customer["phone"],
            "role": "customer",
            "password_hash": hash_password("customer123"),
            "address": old_customer.get("address", ""),
            "city": old_customer.get("city"),
            "state": None,
            "pincode": None,
            "created_at": now,
            "updated_at": now
        }
        
        try:
            await db.users.insert_one(user_doc)
            customer_id_map[old_customer["name"]] = user_id
            customer_id_map[old_customer["phone"]] = user_id
            migrated += 1
        except Exception as e:
            print(f"  Skipped duplicate: {email}")
    
    print(f"  Migrated {migrated} customers")
    return customer_id_map

async def migrate_tickets(customer_id_map, system_users):
    print("\nMigrating tickets...")
    
    # Get technician IDs
    tech1 = await db.users.find_one({"email": "technician@musclegrid.in"}, {"_id": 0})
    support1 = await db.users.find_one({"email": "support@musclegrid.in"}, {"_id": 0})
    
    migrated = 0
    for old_ticket in OLD_TICKETS:
        ticket_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        # Calculate dates based on status
        created_at = now - timedelta(days=random.randint(1, 30))
        sla_due = created_at + timedelta(hours=168 if old_ticket.get("support_type") == "hardware" else 24)
        
        # Determine if SLA is breached
        sla_breached = now > sla_due and old_ticket["status"] not in ["closed", "closed_by_agent", "resolved_on_call", "delivered"]
        
        # Get customer ID
        customer_id = customer_id_map.get(old_ticket["customer_name"]) or customer_id_map.get(old_ticket["customer_phone"])
        
        # Assign to technician for in_repair status
        assigned_to = None
        assigned_to_name = None
        if old_ticket["status"] in ["in_repair", "repair_completed"] and tech1:
            assigned_to = tech1["id"]
            assigned_to_name = f"{tech1['first_name']} {tech1['last_name']}"
        elif old_ticket.get("assigned_to_name") == "Angad" and support1:
            assigned_to = support1["id"]
            assigned_to_name = f"{support1['first_name']} {support1['last_name']}"
        
        ticket_doc = {
            "id": ticket_id,
            "ticket_number": f"MG-R-{created_at.strftime('%Y%m%d')}-{str(old_ticket['id']).zfill(5)}",
            "legacy_id": old_ticket["id"],
            "customer_id": customer_id,
            "customer_name": old_ticket["customer_name"],
            "customer_phone": old_ticket["customer_phone"],
            "customer_email": old_ticket.get("customer_email", ""),
            "customer_address": None,
            "customer_city": old_ticket.get("city"),
            "device_type": "Inverter" if "inverter" in old_ticket.get("product_name", "").lower() else ("Stabilizer" if "stab" in old_ticket.get("product_name", "").lower() else ("Battery" if "battery" in old_ticket.get("product_name", "").lower() else "Others")),
            "product_name": old_ticket.get("product_name"),
            "serial_number": old_ticket.get("serial_number"),
            "invoice_number": old_ticket.get("invoice_number"),
            "order_id": old_ticket.get("invoice_number"),
            "invoice_file": None,
            "issue_description": old_ticket.get("issue_description", "Migrated ticket"),
            "support_type": old_ticket.get("support_type"),
            "status": old_ticket["status"],
            "diagnosis": None,
            "agent_notes": None,
            "repair_notes": "Replaced faulty capacitor and tested" if old_ticket["status"] == "repair_completed" else None,
            "assigned_to": assigned_to,
            "assigned_to_name": assigned_to_name,
            "pickup_label": "/api/files/labels/sample.pdf" if old_ticket["status"] in ["label_uploaded", "received_at_factory", "in_repair", "repair_completed", "ready_for_dispatch", "dispatched"] else None,
            "pickup_courier": "Delhivery" if old_ticket["status"] in ["label_uploaded", "received_at_factory", "in_repair", "repair_completed", "ready_for_dispatch", "dispatched"] else None,
            "pickup_tracking": f"DL{random.randint(100000000, 999999999)}" if old_ticket["status"] in ["label_uploaded", "received_at_factory", "in_repair", "repair_completed", "ready_for_dispatch", "dispatched"] else None,
            "return_label": "/api/files/labels/return_sample.pdf" if old_ticket["status"] in ["ready_for_dispatch", "dispatched"] else None,
            "return_courier": "BlueDart" if old_ticket["status"] in ["ready_for_dispatch", "dispatched"] else None,
            "return_tracking": f"BD{random.randint(100000000, 999999999)}" if old_ticket["status"] in ["ready_for_dispatch", "dispatched"] else None,
            "service_charges": 1500.0 if old_ticket["status"] in ["ready_for_dispatch", "dispatched"] else None,
            "service_invoice": "/api/files/service_invoices/sample.pdf" if old_ticket["status"] in ["ready_for_dispatch", "dispatched"] else None,
            "sla_due": sla_due.isoformat(),
            "sla_breached": sla_breached,
            "created_by": system_users.get("admin"),
            "created_at": created_at.isoformat(),
            "updated_at": now.isoformat(),
            "closed_at": now.isoformat() if old_ticket["status"] in ["closed", "closed_by_agent", "resolved_on_call"] else None,
            "received_at": (created_at + timedelta(days=3)).isoformat() if old_ticket["status"] in ["received_at_factory", "in_repair", "repair_completed", "ready_for_dispatch", "dispatched"] else None,
            "repaired_at": (created_at + timedelta(days=5)).isoformat() if old_ticket["status"] in ["repair_completed", "ready_for_dispatch", "dispatched"] else None,
            "dispatched_at": (created_at + timedelta(days=6)).isoformat() if old_ticket["status"] == "dispatched" else None,
            "history": [{
                "action": "Ticket migrated from legacy system",
                "by": "System Migration",
                "by_id": "system",
                "by_role": "admin",
                "timestamp": now.isoformat(),
                "details": {}
            }]
        }
        
        await db.tickets.insert_one(ticket_doc)
        migrated += 1
    
    print(f"  Migrated {migrated} tickets")

async def create_products():
    print("\nCreating product catalog...")
    
    for sku in OLD_SKUS:
        product_doc = {
            "id": str(uuid.uuid4()),
            "sku_code": sku["sku_code"],
            "model_name": sku["model_name"],
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.products.insert_one(product_doc)
    
    print(f"  Created {len(OLD_SKUS)} products")

async def create_sample_warranties(customer_id_map, system_users):
    print("\nCreating sample warranties...")
    
    customers = list(customer_id_map.items())[:15]
    count = 0
    
    for name, customer_id in customers:
        if "@" in name or name.isdigit():
            continue
            
        customer = await db.users.find_one({"id": customer_id}, {"_id": 0})
        if not customer:
            continue
        
        warranty_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        warranty_end = now + timedelta(days=random.randint(180, 730))
        
        warranty_doc = {
            "id": warranty_id,
            "warranty_number": f"MG-W-{now.strftime('%Y%m%d')}-{str(count+1).zfill(5)}",
            "customer_id": customer_id,
            "first_name": customer["first_name"],
            "last_name": customer["last_name"],
            "phone": customer["phone"],
            "email": customer["email"],
            "device_type": random.choice(["Inverter", "Battery", "Stabilizer"]),
            "product_name": random.choice([s["model_name"] for s in OLD_SKUS]),
            "serial_number": f"SN{random.randint(100000, 999999)}",
            "invoice_date": (now - timedelta(days=random.randint(30, 180))).date().isoformat(),
            "invoice_amount": float(random.randint(15000, 85000)),
            "order_id": f"AMZ-{random.randint(100000, 999999)}",
            "invoice_file": None,
            "status": "approved",
            "warranty_end_date": warranty_end.date().isoformat(),
            "admin_notes": "Migrated from legacy system",
            "extension_requested": False,
            "extension_status": None,
            "extension_review_file": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.warranties.insert_one(warranty_doc)
        count += 1
    
    print(f"  Created {count} warranty records")

async def create_sample_gate_logs(system_users):
    print("\nCreating sample gate logs...")
    
    gate_user = await db.users.find_one({"role": "gate"}, {"_id": 0})
    if not gate_user:
        print("  Skipped - no gate user")
        return
    
    for i in range(10):
        now = datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 72))
        
        gate_log = {
            "id": str(uuid.uuid4()),
            "scan_type": random.choice(["inward", "outward"]),
            "tracking_id": f"DL{random.randint(100000000, 999999999)}",
            "courier": random.choice(["Delhivery", "BlueDart", "DTDC", "FedEx"]),
            "ticket_id": None,
            "ticket_number": None,
            "dispatch_id": None,
            "dispatch_number": None,
            "customer_name": random.choice([c["name"] for c in OLD_CUSTOMERS[:10]]),
            "scanned_by": gate_user["id"],
            "scanned_by_name": f"{gate_user['first_name']} {gate_user['last_name']}",
            "notes": None,
            "scanned_at": now.isoformat()
        }
        
        await db.gate_logs.insert_one(gate_log)
    
    print("  Created 10 gate log entries")

async def create_indexes():
    print("\nCreating database indexes...")
    
    await db.users.create_index("email", unique=True)
    await db.users.create_index("phone")
    await db.users.create_index("role")
    
    await db.tickets.create_index("ticket_number", unique=True)
    await db.tickets.create_index("customer_id")
    await db.tickets.create_index("status")
    await db.tickets.create_index("support_type")
    await db.tickets.create_index("sla_breached")
    await db.tickets.create_index("created_at")
    await db.tickets.create_index("assigned_to")
    
    await db.warranties.create_index("customer_id")
    await db.warranties.create_index("status")
    
    await db.dispatches.create_index("status")
    await db.dispatches.create_index("ticket_id")
    
    await db.gate_logs.create_index("scanned_at")
    await db.gate_logs.create_index("tracking_id")
    
    print("  Indexes created")

async def print_summary():
    print("\n" + "="*60)
    print("MIGRATION COMPLETE - ENTERPRISE CRM")
    print("="*60)
    
    users_count = await db.users.count_documents({})
    customers_count = await db.users.count_documents({"role": "customer"})
    tickets_count = await db.tickets.count_documents({})
    warranties_count = await db.warranties.count_documents({})
    products_count = await db.products.count_documents({})
    gate_logs_count = await db.gate_logs.count_documents({})
    
    # Ticket breakdown
    open_tickets = await db.tickets.count_documents({"status": {"$nin": ["closed", "closed_by_agent", "resolved_on_call", "delivered"]}})
    hardware_tickets = await db.tickets.count_documents({"support_type": "hardware"})
    phone_tickets = await db.tickets.count_documents({"support_type": "phone"})
    sla_breached = await db.tickets.count_documents({"sla_breached": True})
    
    print(f"\n📊 Database Stats:")
    print(f"  Total Users: {users_count}")
    print(f"    - Customers: {customers_count}")
    print(f"    - Staff: {users_count - customers_count}")
    print(f"  Tickets: {tickets_count}")
    print(f"    - Open: {open_tickets}")
    print(f"    - Hardware: {hardware_tickets}")
    print(f"    - Phone: {phone_tickets}")
    print(f"    - SLA Breached: {sla_breached}")
    print(f"  Warranties: {warranties_count}")
    print(f"  Products: {products_count}")
    print(f"  Gate Logs: {gate_logs_count}")
    
    print("\n" + "="*60)
    print("🔐 LOGIN CREDENTIALS")
    print("="*60)
    print("\n👔 Staff Accounts:")
    print("  Admin:       admin@musclegrid.in / admin123")
    print("  Support 1:   support@musclegrid.in / support123")
    print("  Support 2:   support2@musclegrid.in / support123")
    print("  Accountant:  accountant@musclegrid.in / accountant123")
    print("  Dispatcher:  dispatcher@musclegrid.in / dispatch123")
    print("  Technician:  technician@musclegrid.in / tech123")
    print("  Technician2: technician2@musclegrid.in / tech123")
    print("  Gate:        gate@musclegrid.in / gate123")
    print("\n👤 Customer Accounts (sample):")
    print("  ami_t@live.com / customer123")
    print("  manas.cdac@gmail.com / customer123")
    print("  (All migrated customers use password: customer123)")
    print("="*60)

async def run_migration():
    print("="*60)
    print("MuscleGrid CRM - Enterprise Data Migration")
    print("="*60)
    
    await clear_existing_data()
    system_users = await create_system_users()
    customer_id_map = await migrate_customers()
    await migrate_tickets(customer_id_map, system_users)
    await create_products()
    await create_sample_warranties(customer_id_map, system_users)
    await create_sample_gate_logs(system_users)
    await create_indexes()
    await print_summary()

if __name__ == "__main__":
    asyncio.run(run_migration())

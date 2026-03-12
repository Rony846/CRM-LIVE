"""
MuscleGrid CRM - Enterprise Grade Support System
Version 2.0 - Full Featured Production Ready
"""

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import base64
import shutil
import asyncio
import json
import random
import string

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'musclegrid-crm-secret-key-2024-enterprise')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Email Configuration (Resend)
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
EMAIL_ENABLED = bool(RESEND_API_KEY)

if EMAIL_ENABLED:
    try:
        import resend
        resend.api_key = RESEND_API_KEY
    except ImportError:
        EMAIL_ENABLED = False

# Create uploads directories
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
for subdir in ["invoices", "labels", "reviews", "service_invoices", "pickup_labels"]:
    (UPLOAD_DIR / subdir).mkdir(exist_ok=True)

app = FastAPI(title="MuscleGrid CRM API - Enterprise Edition")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== CONSTANTS ====================

# User Roles
ROLES = ["customer", "call_support", "service_agent", "accountant", "dispatcher", "admin", "gate"]

# Support Types
SUPPORT_TYPES = ["phone", "hardware"]

# Ticket Statuses with full lifecycle
TICKET_STATUSES = [
    "new_request",           # Just created
    "call_support_followup", # Call support is handling
    "resolved_on_call",      # Resolved via phone
    "closed_by_agent",       # Closed without hardware
    "hardware_service",      # Marked for hardware
    "awaiting_label",        # Waiting for pickup label
    "label_uploaded",        # Pickup label ready
    "pickup_scheduled",      # Customer has label, waiting
    "received_at_factory",   # Gate scanned incoming
    "in_repair",            # Technician working
    "repair_completed",      # Fixed, ready for dispatch
    "service_invoice_added", # Accountant added charges
    "ready_for_dispatch",    # Ready to ship back
    "dispatched",           # Shipped out
    "delivered",            # Delivered to customer
    "closed"                # Fully resolved
]

# SLA Configuration (in hours)
SLA_CONFIG = {
    "phone": {
        "first_response": 4,
        "resolution": 24
    },
    "hardware": {
        "first_response": 24,
        "repair": 72,
        "total": 168  # 7 days
    }
}

DEVICE_TYPES = ["Inverter", "Battery", "Stabilizer", "Others"]
WARRANTY_STATUSES = ["pending", "approved", "rejected"]
DISPATCH_TYPES = ["outbound", "reverse_pickup", "return_dispatch"]
GATE_SCAN_TYPES = ["inward", "outward"]

# ==================== MODELS ====================

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: str
    role: str = "customer"
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    phone: str
    role: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Enhanced Ticket Models
class TicketCreate(BaseModel):
    device_type: str
    product_name: Optional[str] = None
    serial_number: Optional[str] = None
    invoice_number: Optional[str] = None
    order_id: Optional[str] = None
    issue_description: str
    customer_id: Optional[str] = None  # For agents creating on behalf

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    support_type: Optional[str] = None
    diagnosis: Optional[str] = None
    agent_notes: Optional[str] = None
    assigned_to: Optional[str] = None
    repair_notes: Optional[str] = None
    service_charges: Optional[float] = None

class TicketResponse(BaseModel):
    id: str
    ticket_number: str
    legacy_id: Optional[int] = None
    customer_id: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_email: str
    customer_address: Optional[str] = None
    customer_city: Optional[str] = None
    device_type: str
    product_name: Optional[str] = None
    serial_number: Optional[str] = None
    invoice_number: Optional[str] = None
    order_id: Optional[str] = None
    invoice_file: Optional[str] = None
    issue_description: str
    support_type: Optional[str] = None
    status: str
    diagnosis: Optional[str] = None
    agent_notes: Optional[str] = None
    repair_notes: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    pickup_label: Optional[str] = None
    pickup_courier: Optional[str] = None
    pickup_tracking: Optional[str] = None
    return_label: Optional[str] = None
    return_courier: Optional[str] = None
    return_tracking: Optional[str] = None
    service_charges: Optional[float] = None
    service_invoice: Optional[str] = None
    sla_due: Optional[str] = None
    sla_breached: bool = False
    created_at: str
    updated_at: str
    closed_at: Optional[str] = None
    received_at: Optional[str] = None
    repaired_at: Optional[str] = None
    dispatched_at: Optional[str] = None
    history: List[dict] = []

# Warranty Models
class WarrantyCreate(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: EmailStr
    device_type: str
    product_name: Optional[str] = None
    serial_number: Optional[str] = None
    invoice_date: str
    invoice_amount: float
    order_id: str

class WarrantyApproval(BaseModel):
    warranty_end_date: str
    notes: Optional[str] = None

class WarrantyResponse(BaseModel):
    id: str
    warranty_number: Optional[str] = None
    customer_id: str
    first_name: str
    last_name: str
    phone: str
    email: str
    device_type: str
    product_name: Optional[str] = None
    serial_number: Optional[str] = None
    invoice_date: str
    invoice_amount: float
    order_id: str
    invoice_file: Optional[str] = None
    status: str
    warranty_end_date: Optional[str] = None
    admin_notes: Optional[str] = None
    created_at: str
    updated_at: str
    extension_requested: bool = False
    extension_status: Optional[str] = None
    extension_review_file: Optional[str] = None

# Dispatch Models
class DispatchCreate(BaseModel):
    dispatch_type: str
    ticket_id: Optional[str] = None
    sku: Optional[str] = None
    customer_name: str
    phone: str
    address: str
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    reason: Optional[str] = None
    note: Optional[str] = None

class DispatchResponse(BaseModel):
    id: str
    dispatch_number: str
    dispatch_type: str
    ticket_id: Optional[str] = None
    ticket_number: Optional[str] = None
    sku: Optional[str] = None
    customer_name: str
    phone: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    reason: Optional[str] = None
    note: Optional[str] = None
    courier: Optional[str] = None
    tracking_id: Optional[str] = None
    label_file: Optional[str] = None
    status: str
    service_charges: Optional[float] = None
    service_invoice: Optional[str] = None
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str
    updated_at: str
    scanned_in_at: Optional[str] = None
    scanned_out_at: Optional[str] = None

# Gate Scan Models
class GateScanCreate(BaseModel):
    scan_type: str  # inward or outward
    tracking_id: str
    courier: Optional[str] = None
    notes: Optional[str] = None

class GateScanResponse(BaseModel):
    id: str
    scan_type: str
    tracking_id: str
    courier: Optional[str] = None
    ticket_id: Optional[str] = None
    ticket_number: Optional[str] = None
    dispatch_id: Optional[str] = None
    dispatch_number: Optional[str] = None
    customer_name: Optional[str] = None
    scanned_by: str
    scanned_by_name: Optional[str] = None
    notes: Optional[str] = None
    scanned_at: str

# Agent Performance Models
class AgentPerformance(BaseModel):
    agent_id: str
    agent_name: str
    total_tickets: int = 0
    closed_tickets: int = 0
    hardware_tickets: int = 0
    phone_tickets: int = 0
    sla_breaches: int = 0
    avg_resolution_hours: float = 0
    sla_compliance_rate: float = 0

# ==================== HELPER FUNCTIONS ====================

def generate_ticket_number():
    """Generate ticket number: MG-R-YYYYMMDD-XXXXX"""
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = ''.join(random.choices(string.digits, k=5))
    return f"MG-R-{date_str}-{random_part}"

def generate_dispatch_number():
    """Generate dispatch number: MG-D-YYYYMMDD-XXXXX"""
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = ''.join(random.choices(string.digits, k=5))
    return f"MG-D-{date_str}-{random_part}"

def generate_warranty_number():
    """Generate warranty number: MG-W-YYYYMMDD-XXXXX"""
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = ''.join(random.choices(string.digits, k=5))
    return f"MG-W-{date_str}-{random_part}"

def calculate_sla_due(support_type: str, created_at: datetime) -> datetime:
    """Calculate SLA due date based on support type"""
    if support_type == "hardware":
        hours = SLA_CONFIG["hardware"]["total"]
    else:
        hours = SLA_CONFIG["phone"]["resolution"]
    return created_at + timedelta(hours=hours)

def is_sla_breached(sla_due: datetime, status: str) -> bool:
    """Check if ticket has breached SLA"""
    if status in ["closed", "closed_by_agent", "resolved_on_call", "delivered"]:
        return False
    return datetime.now(timezone.utc) > sla_due

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_roles(allowed_roles: List[str]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

async def add_ticket_history(ticket_id: str, action: str, by_user: dict, details: dict = None):
    """Add entry to ticket history"""
    history_entry = {
        "action": action,
        "by": f"{by_user['first_name']} {by_user['last_name']}",
        "by_id": by_user["id"],
        "by_role": by_user["role"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": details or {}
    }
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$push": {"history": history_entry}}
    )

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Only allow customer registration via public endpoint
    if user_data.role != "customer":
        raise HTTPException(status_code=400, detail="Invalid registration")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email.lower(),
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "phone": user_data.phone,
        "role": "customer",
        "password_hash": hash_password(user_data.password),
        "address": user_data.address,
        "city": user_data.city,
        "state": user_data.state,
        "pincode": user_data.pincode,
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_doc)
    token = create_token(user_id, "customer")
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(**{k: v for k, v in user_doc.items() if k != "password_hash" and k != "_id"})
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email.lower()}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["role"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(**{k: v for k, v in user.items() if k != "password_hash"})
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(**{k: v for k, v in user.items() if k != "password_hash"})

@api_router.patch("/auth/me", response_model=UserResponse)
async def update_me(update_data: UserUpdate, user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one({"id": user["id"]}, {"$set": update_dict})
    
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return UserResponse(**{k: v for k, v in updated_user.items() if k != "password_hash"})

# ==================== TICKET ENDPOINTS ====================

@api_router.post("/tickets", response_model=TicketResponse)
async def create_ticket(
    background_tasks: BackgroundTasks,
    device_type: str = Form(...),
    issue_description: str = Form(...),
    product_name: Optional[str] = Form(None),
    serial_number: Optional[str] = Form(None),
    invoice_number: Optional[str] = Form(None),
    order_id: Optional[str] = Form(None),
    customer_id: Optional[str] = Form(None),
    invoice_file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user)
):
    """Create support ticket - Customer or Agent"""
    now = datetime.now(timezone.utc)
    ticket_id = str(uuid.uuid4())
    ticket_number = generate_ticket_number()
    
    # Determine customer info
    if user["role"] == "customer":
        customer = user
        cust_id = user["id"]
    elif customer_id and user["role"] in ["call_support", "admin"]:
        customer = await db.users.find_one({"id": customer_id}, {"_id": 0})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        cust_id = customer_id
    else:
        customer = user
        cust_id = user["id"]
    
    # Handle invoice file upload
    invoice_path = None
    if invoice_file:
        ext = Path(invoice_file.filename).suffix
        filename = f"{ticket_id}{ext}"
        file_path = UPLOAD_DIR / "invoices" / filename
        with open(file_path, "wb") as f:
            content = await invoice_file.read()
            f.write(content)
        invoice_path = f"/api/files/invoices/{filename}"
    
    # Calculate SLA
    sla_due = calculate_sla_due("phone", now)
    
    ticket_doc = {
        "id": ticket_id,
        "ticket_number": ticket_number,
        "customer_id": cust_id,
        "customer_name": f"{customer['first_name']} {customer['last_name']}",
        "customer_phone": customer["phone"],
        "customer_email": customer["email"],
        "customer_address": customer.get("address"),
        "customer_city": customer.get("city"),
        "device_type": device_type,
        "product_name": product_name,
        "serial_number": serial_number,
        "invoice_number": invoice_number,
        "order_id": order_id,
        "invoice_file": invoice_path,
        "issue_description": issue_description,
        "support_type": "phone",  # Default to phone support
        "status": "new_request",
        "diagnosis": None,
        "agent_notes": None,
        "repair_notes": None,
        "assigned_to": None,
        "assigned_to_name": None,
        "pickup_label": None,
        "pickup_courier": None,
        "pickup_tracking": None,
        "return_label": None,
        "return_courier": None,
        "return_tracking": None,
        "service_charges": None,
        "service_invoice": None,
        "sla_due": sla_due.isoformat(),
        "sla_breached": False,
        "created_by": user["id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "closed_at": None,
        "received_at": None,
        "repaired_at": None,
        "dispatched_at": None,
        "history": [{
            "action": "Ticket created",
            "by": f"{user['first_name']} {user['last_name']}",
            "by_id": user["id"],
            "by_role": user["role"],
            "timestamp": now.isoformat(),
            "details": {"status": "new_request"}
        }]
    }
    
    await db.tickets.insert_one(ticket_doc)
    
    # Remove _id before returning
    ticket_doc.pop("_id", None)
    return TicketResponse(**ticket_doc)

@api_router.get("/tickets", response_model=List[TicketResponse])
async def list_tickets(
    search: Optional[str] = None,
    status: Optional[str] = None,
    support_type: Optional[str] = None,
    device_type: Optional[str] = None,
    assigned_to: Optional[str] = None,
    sla_breached: Optional[bool] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    user: dict = Depends(get_current_user)
):
    """List tickets with filters"""
    query = {}
    
    # Role-based filtering
    if user["role"] == "customer":
        query["customer_id"] = user["id"]
    elif user["role"] == "service_agent":
        query["assigned_to"] = user["id"]
    elif user["role"] == "call_support":
        query["support_type"] = "phone"
    elif user["role"] == "accountant":
        query["status"] = {"$in": ["hardware_service", "awaiting_label", "repair_completed", "service_invoice_added"]}
    
    # Apply filters
    if search:
        query["$or"] = [
            {"ticket_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}},
            {"customer_email": {"$regex": search, "$options": "i"}},
            {"serial_number": {"$regex": search, "$options": "i"}},
            {"invoice_number": {"$regex": search, "$options": "i"}}
        ]
    
    if status:
        query["status"] = status
    if support_type:
        query["support_type"] = support_type
    if device_type:
        query["device_type"] = device_type
    if assigned_to:
        query["assigned_to"] = assigned_to
    if sla_breached is not None:
        query["sla_breached"] = sla_breached
    
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = to_date
        else:
            query["created_at"] = {"$lte": to_date}
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Update SLA breach status
    for ticket in tickets:
        if ticket.get("sla_due"):
            sla_due = datetime.fromisoformat(ticket["sla_due"].replace('Z', '+00:00'))
            ticket["sla_breached"] = is_sla_breached(sla_due, ticket["status"])
    
    return [TicketResponse(**t) for t in tickets]

@api_router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    """Get ticket details"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Permission check
    if user["role"] == "customer" and ticket.get("customer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update SLA breach status
    if ticket.get("sla_due"):
        sla_due = datetime.fromisoformat(ticket["sla_due"].replace('Z', '+00:00'))
        ticket["sla_breached"] = is_sla_breached(sla_due, ticket["status"])
    
    return TicketResponse(**ticket)

@api_router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    update_data: TicketUpdate,
    user: dict = Depends(require_roles(["call_support", "service_agent", "accountant", "admin"]))
):
    """Update ticket - Support agents, Technicians, Accountants"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc)
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = now.isoformat()
    
    # Track status changes
    old_status = ticket["status"]
    new_status = update_dict.get("status", old_status)
    
    # Handle assigned_to name
    if "assigned_to" in update_dict:
        assignee = await db.users.find_one({"id": update_dict["assigned_to"]}, {"_id": 0})
        if assignee:
            update_dict["assigned_to_name"] = f"{assignee['first_name']} {assignee['last_name']}"
    
    # Handle status-specific timestamps
    if new_status == "closed" or new_status == "closed_by_agent" or new_status == "resolved_on_call":
        update_dict["closed_at"] = now.isoformat()
    
    await db.tickets.update_one({"id": ticket_id}, {"$set": update_dict})
    
    # Add to history
    if old_status != new_status:
        await add_ticket_history(ticket_id, f"Status changed from {old_status} to {new_status}", user, {"old_status": old_status, "new_status": new_status})
    
    if update_data.agent_notes:
        await add_ticket_history(ticket_id, "Agent notes updated", user)
    
    updated_ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    return TicketResponse(**updated_ticket)

@api_router.post("/tickets/{ticket_id}/route-to-hardware")
async def route_to_hardware(
    ticket_id: str,
    notes: Optional[str] = None,
    user: dict = Depends(require_roles(["call_support", "admin"]))
):
    """Route ticket to hardware service"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc)
    # Recalculate SLA for hardware
    sla_due = calculate_sla_due("hardware", now)
    
    update_dict = {
        "support_type": "hardware",
        "status": "hardware_service",
        "sla_due": sla_due.isoformat(),
        "updated_at": now.isoformat()
    }
    if notes:
        update_dict["agent_notes"] = notes
    
    await db.tickets.update_one({"id": ticket_id}, {"$set": update_dict})
    await add_ticket_history(ticket_id, "Routed to hardware service", user, {"notes": notes})
    
    return {"message": "Ticket routed to hardware service", "new_status": "hardware_service"}

@api_router.post("/tickets/{ticket_id}/upload-pickup-label")
async def upload_pickup_label(
    ticket_id: str,
    courier: str = Form(...),
    tracking_id: str = Form(...),
    label_file: UploadFile = File(...),
    user: dict = Depends(require_roles(["accountant", "admin"]))
):
    """Accountant uploads reverse pickup label"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Save label file
    ext = Path(label_file.filename).suffix
    filename = f"pickup_{ticket_id}{ext}"
    file_path = UPLOAD_DIR / "pickup_labels" / filename
    with open(file_path, "wb") as f:
        content = await label_file.read()
        f.write(content)
    
    label_url = f"/api/files/pickup_labels/{filename}"
    now = datetime.now(timezone.utc)
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "pickup_label": label_url,
            "pickup_courier": courier,
            "pickup_tracking": tracking_id,
            "status": "label_uploaded",
            "updated_at": now.isoformat()
        }}
    )
    
    await add_ticket_history(ticket_id, "Pickup label uploaded", user, {
        "courier": courier,
        "tracking_id": tracking_id
    })
    
    return {"message": "Pickup label uploaded", "label_url": label_url}

@api_router.post("/tickets/{ticket_id}/mark-received")
async def mark_ticket_received(
    ticket_id: str,
    notes: Optional[str] = None,
    user: dict = Depends(require_roles(["gate", "dispatcher", "admin"]))
):
    """Gate/Dispatcher marks product as received at factory"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc)
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "status": "received_at_factory",
            "received_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    await add_ticket_history(ticket_id, "Product received at factory (Gate scan)", user, {"notes": notes})
    
    # Create gate log
    gate_log = {
        "id": str(uuid.uuid4()),
        "scan_type": "inward",
        "tracking_id": ticket.get("pickup_tracking", "MANUAL"),
        "courier": ticket.get("pickup_courier"),
        "ticket_id": ticket_id,
        "ticket_number": ticket["ticket_number"],
        "customer_name": ticket["customer_name"],
        "scanned_by": user["id"],
        "scanned_by_name": f"{user['first_name']} {user['last_name']}",
        "notes": notes,
        "scanned_at": now.isoformat()
    }
    await db.gate_logs.insert_one(gate_log)
    
    return {"message": "Product marked as received"}

@api_router.post("/tickets/{ticket_id}/start-repair")
async def start_repair(
    ticket_id: str,
    user: dict = Depends(require_roles(["service_agent", "admin"]))
):
    """Technician starts repair"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc)
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "status": "in_repair",
            "assigned_to": user["id"],
            "assigned_to_name": f"{user['first_name']} {user['last_name']}",
            "updated_at": now.isoformat()
        }}
    )
    
    await add_ticket_history(ticket_id, "Repair started", user)
    return {"message": "Repair started"}

@api_router.post("/tickets/{ticket_id}/complete-repair")
async def complete_repair(
    ticket_id: str,
    repair_notes: str = Form(...),
    user: dict = Depends(require_roles(["service_agent", "admin"]))
):
    """Technician completes repair"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc)
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "status": "repair_completed",
            "repair_notes": repair_notes,
            "repaired_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    await add_ticket_history(ticket_id, "Repair completed", user, {"repair_notes": repair_notes})
    return {"message": "Repair marked as completed"}

@api_router.post("/tickets/{ticket_id}/add-service-invoice")
async def add_service_invoice(
    ticket_id: str,
    service_charges: float = Form(...),
    service_invoice: UploadFile = File(...),
    user: dict = Depends(require_roles(["accountant", "admin"]))
):
    """Accountant adds service charges and invoice"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Save invoice file
    ext = Path(service_invoice.filename).suffix
    filename = f"service_{ticket_id}{ext}"
    file_path = UPLOAD_DIR / "service_invoices" / filename
    with open(file_path, "wb") as f:
        content = await service_invoice.read()
        f.write(content)
    
    invoice_url = f"/api/files/service_invoices/{filename}"
    now = datetime.now(timezone.utc)
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "service_charges": service_charges,
            "service_invoice": invoice_url,
            "status": "service_invoice_added",
            "updated_at": now.isoformat()
        }}
    )
    
    await add_ticket_history(ticket_id, "Service invoice added", user, {"charges": service_charges})
    return {"message": "Service invoice added", "invoice_url": invoice_url}

@api_router.post("/tickets/{ticket_id}/upload-return-label")
async def upload_return_label(
    ticket_id: str,
    courier: str = Form(...),
    tracking_id: str = Form(...),
    label_file: UploadFile = File(...),
    user: dict = Depends(require_roles(["accountant", "admin"]))
):
    """Accountant uploads return dispatch label"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Save label file
    ext = Path(label_file.filename).suffix
    filename = f"return_{ticket_id}{ext}"
    file_path = UPLOAD_DIR / "labels" / filename
    with open(file_path, "wb") as f:
        content = await label_file.read()
        f.write(content)
    
    label_url = f"/api/files/labels/{filename}"
    now = datetime.now(timezone.utc)
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "return_label": label_url,
            "return_courier": courier,
            "return_tracking": tracking_id,
            "status": "ready_for_dispatch",
            "updated_at": now.isoformat()
        }}
    )
    
    await add_ticket_history(ticket_id, "Return label uploaded", user, {
        "courier": courier,
        "tracking_id": tracking_id
    })
    
    return {"message": "Return label uploaded", "label_url": label_url}

@api_router.post("/tickets/{ticket_id}/mark-dispatched")
async def mark_ticket_dispatched(
    ticket_id: str,
    user: dict = Depends(require_roles(["dispatcher", "gate", "admin"]))
):
    """Dispatcher marks product as dispatched"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc)
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "status": "dispatched",
            "dispatched_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    await add_ticket_history(ticket_id, "Product dispatched", user)
    
    # Create gate log
    gate_log = {
        "id": str(uuid.uuid4()),
        "scan_type": "outward",
        "tracking_id": ticket.get("return_tracking", "MANUAL"),
        "courier": ticket.get("return_courier"),
        "ticket_id": ticket_id,
        "ticket_number": ticket["ticket_number"],
        "customer_name": ticket["customer_name"],
        "scanned_by": user["id"],
        "scanned_by_name": f"{user['first_name']} {user['last_name']}",
        "scanned_at": now.isoformat()
    }
    await db.gate_logs.insert_one(gate_log)
    
    return {"message": "Product marked as dispatched"}

# ==================== WARRANTY ENDPOINTS ====================

@api_router.post("/warranties")
async def create_warranty(
    first_name: str = Form(...),
    last_name: str = Form(...),
    phone: str = Form(...),
    email: str = Form(...),
    device_type: str = Form(...),
    product_name: Optional[str] = Form(None),
    serial_number: Optional[str] = Form(None),
    invoice_date: str = Form(...),
    invoice_amount: float = Form(...),
    order_id: str = Form(...),
    invoice_file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user)
):
    """Register warranty"""
    warranty_id = str(uuid.uuid4())
    warranty_number = generate_warranty_number()
    now = datetime.now(timezone.utc).isoformat()
    
    # Handle file upload
    invoice_path = None
    if invoice_file:
        ext = Path(invoice_file.filename).suffix
        filename = f"{warranty_id}{ext}"
        file_path = UPLOAD_DIR / "invoices" / filename
        with open(file_path, "wb") as f:
            content = await invoice_file.read()
            f.write(content)
        invoice_path = f"/api/files/invoices/{filename}"
    
    warranty_doc = {
        "id": warranty_id,
        "warranty_number": warranty_number,
        "customer_id": user["id"],
        "first_name": first_name,
        "last_name": last_name,
        "phone": phone,
        "email": email.lower(),
        "device_type": device_type,
        "product_name": product_name,
        "serial_number": serial_number,
        "invoice_date": invoice_date,
        "invoice_amount": invoice_amount,
        "order_id": order_id,
        "invoice_file": invoice_path,
        "status": "pending",
        "warranty_end_date": None,
        "admin_notes": None,
        "extension_requested": False,
        "extension_status": None,
        "extension_review_file": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.warranties.insert_one(warranty_doc)
    del warranty_doc["_id"]
    return warranty_doc

@api_router.get("/warranties", response_model=List[WarrantyResponse])
async def list_warranties(
    search: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """List warranties"""
    query = {}
    
    if user["role"] == "customer":
        query["customer_id"] = user["id"]
    
    if search:
        query["$or"] = [
            {"warranty_number": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"order_id": {"$regex": search, "$options": "i"}}
        ]
    
    if status:
        query["status"] = status
    
    warranties = await db.warranties.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [WarrantyResponse(**w) for w in warranties]

@api_router.get("/warranties/{warranty_id}", response_model=WarrantyResponse)
async def get_warranty(warranty_id: str, user: dict = Depends(get_current_user)):
    """Get warranty details"""
    warranty = await db.warranties.find_one({"id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    if user["role"] == "customer" and warranty["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return WarrantyResponse(**warranty)

@api_router.patch("/warranties/{warranty_id}/approve")
async def approve_warranty(
    warranty_id: str,
    approval: WarrantyApproval,
    user: dict = Depends(require_roles(["admin"]))
):
    """Admin approves warranty"""
    warranty = await db.warranties.find_one({"id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.warranties.update_one(
        {"id": warranty_id},
        {"$set": {
            "status": "approved",
            "warranty_end_date": approval.warranty_end_date,
            "admin_notes": approval.notes,
            "updated_at": now
        }}
    )
    
    return {"message": "Warranty approved"}

@api_router.patch("/warranties/{warranty_id}/reject")
async def reject_warranty(
    warranty_id: str,
    reason: str,
    user: dict = Depends(require_roles(["admin"]))
):
    """Admin rejects warranty"""
    now = datetime.now(timezone.utc).isoformat()
    await db.warranties.update_one(
        {"id": warranty_id},
        {"$set": {
            "status": "rejected",
            "admin_notes": reason,
            "updated_at": now
        }}
    )
    
    return {"message": "Warranty rejected"}

@api_router.post("/warranties/{warranty_id}/request-extension")
async def request_warranty_extension(
    warranty_id: str,
    review_file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Customer requests warranty extension with Amazon review screenshot"""
    warranty = await db.warranties.find_one({"id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    if warranty["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Save review file
    ext = Path(review_file.filename).suffix
    filename = f"review_{warranty_id}{ext}"
    file_path = UPLOAD_DIR / "reviews" / filename
    with open(file_path, "wb") as f:
        content = await review_file.read()
        f.write(content)
    
    review_url = f"/api/files/reviews/{filename}"
    now = datetime.now(timezone.utc).isoformat()
    
    await db.warranties.update_one(
        {"id": warranty_id},
        {"$set": {
            "extension_requested": True,
            "extension_status": "pending",
            "extension_review_file": review_url,
            "updated_at": now
        }}
    )
    
    return {"message": "Extension request submitted"}

# ==================== DISPATCH ENDPOINTS ====================

@api_router.post("/dispatches", response_model=DispatchResponse)
async def create_dispatch(
    dispatch_data: DispatchCreate,
    user: dict = Depends(require_roles(["accountant", "admin"]))
):
    """Create dispatch (outbound or from ticket)"""
    dispatch_id = str(uuid.uuid4())
    dispatch_number = generate_dispatch_number()
    now = datetime.now(timezone.utc).isoformat()
    
    # Get ticket number if linked
    ticket_number = None
    if dispatch_data.ticket_id:
        ticket = await db.tickets.find_one({"id": dispatch_data.ticket_id}, {"_id": 0})
        if ticket:
            ticket_number = ticket["ticket_number"]
    
    dispatch_doc = {
        "id": dispatch_id,
        "dispatch_number": dispatch_number,
        "dispatch_type": dispatch_data.dispatch_type,
        "ticket_id": dispatch_data.ticket_id,
        "ticket_number": ticket_number,
        "sku": dispatch_data.sku,
        "customer_name": dispatch_data.customer_name,
        "phone": dispatch_data.phone,
        "address": dispatch_data.address,
        "city": dispatch_data.city,
        "state": dispatch_data.state,
        "pincode": dispatch_data.pincode,
        "reason": dispatch_data.reason,
        "note": dispatch_data.note,
        "courier": None,
        "tracking_id": None,
        "label_file": None,
        "status": "pending_label",
        "service_charges": None,
        "service_invoice": None,
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "created_at": now,
        "updated_at": now,
        "scanned_in_at": None,
        "scanned_out_at": None
    }
    
    await db.dispatches.insert_one(dispatch_doc)
    del dispatch_doc["_id"]
    return DispatchResponse(**dispatch_doc)

@api_router.get("/dispatches", response_model=List[DispatchResponse])
async def list_dispatches(
    status: Optional[str] = None,
    dispatch_type: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(require_roles(["accountant", "dispatcher", "gate", "admin"]))
):
    """List dispatches"""
    query = {}
    
    if status:
        query["status"] = status
    if dispatch_type:
        query["dispatch_type"] = dispatch_type
    if search:
        query["$or"] = [
            {"dispatch_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"tracking_id": {"$regex": search, "$options": "i"}}
        ]
    
    dispatches = await db.dispatches.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [DispatchResponse(**d) for d in dispatches]

@api_router.patch("/dispatches/{dispatch_id}/label")
async def upload_dispatch_label(
    dispatch_id: str,
    courier: str = Form(...),
    tracking_id: str = Form(...),
    label_file: UploadFile = File(...),
    user: dict = Depends(require_roles(["accountant", "admin"]))
):
    """Upload shipping label for dispatch"""
    dispatch = await db.dispatches.find_one({"id": dispatch_id}, {"_id": 0})
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    
    ext = Path(label_file.filename).suffix
    filename = f"{dispatch_id}{ext}"
    file_path = UPLOAD_DIR / "labels" / filename
    with open(file_path, "wb") as f:
        content = await label_file.read()
        f.write(content)
    
    label_url = f"/api/files/labels/{filename}"
    now = datetime.now(timezone.utc).isoformat()
    
    await db.dispatches.update_one(
        {"id": dispatch_id},
        {"$set": {
            "courier": courier,
            "tracking_id": tracking_id,
            "label_file": label_url,
            "status": "ready_for_dispatch",
            "updated_at": now
        }}
    )
    
    return {"message": "Label uploaded", "label_url": label_url}

@api_router.patch("/dispatches/{dispatch_id}/status")
async def update_dispatch_status(
    dispatch_id: str,
    status: str,
    user: dict = Depends(require_roles(["dispatcher", "gate", "admin"]))
):
    """Update dispatch status"""
    now = datetime.now(timezone.utc).isoformat()
    update = {"status": status, "updated_at": now}
    
    if status == "dispatched":
        update["scanned_out_at"] = now
    
    await db.dispatches.update_one({"id": dispatch_id}, {"$set": update})
    return {"message": f"Status updated to {status}"}

@api_router.get("/dispatcher/queue", response_model=List[DispatchResponse])
async def get_dispatcher_queue(
    user: dict = Depends(require_roles(["dispatcher", "gate", "admin"]))
):
    """Get dispatcher queue - items ready to ship"""
    dispatches = await db.dispatches.find(
        {"status": "ready_for_dispatch"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # Also get tickets ready for dispatch
    tickets = await db.tickets.find(
        {"status": "ready_for_dispatch"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # Convert tickets to dispatch-like format
    for ticket in tickets:
        dispatch_item = {
            "id": ticket["id"],
            "dispatch_number": ticket["ticket_number"],
            "dispatch_type": "return_dispatch",
            "ticket_id": ticket["id"],
            "ticket_number": ticket["ticket_number"],
            "sku": None,
            "customer_name": ticket["customer_name"],
            "phone": ticket["customer_phone"],
            "address": ticket.get("customer_address", ""),
            "city": ticket.get("customer_city"),
            "state": None,
            "pincode": None,
            "reason": "Hardware repair return",
            "note": ticket.get("repair_notes"),
            "courier": ticket.get("return_courier"),
            "tracking_id": ticket.get("return_tracking"),
            "label_file": ticket.get("return_label"),
            "status": "ready_for_dispatch",
            "service_charges": ticket.get("service_charges"),
            "service_invoice": ticket.get("service_invoice"),
            "created_by": ticket.get("created_by", ""),
            "created_by_name": None,
            "created_at": ticket["created_at"],
            "updated_at": ticket["updated_at"],
            "scanned_in_at": ticket.get("received_at"),
            "scanned_out_at": None
        }
        dispatches.append(dispatch_item)
    
    return [DispatchResponse(**d) for d in dispatches]

# ==================== GATE SCAN ENDPOINTS ====================

@api_router.post("/gate/scan", response_model=GateScanResponse)
async def gate_scan(
    scan_data: GateScanCreate,
    user: dict = Depends(require_roles(["gate", "dispatcher", "admin"]))
):
    """Record gate scan (inward or outward)"""
    now = datetime.now(timezone.utc)
    scan_id = str(uuid.uuid4())
    
    # Try to find associated ticket or dispatch
    ticket = await db.tickets.find_one(
        {"$or": [
            {"pickup_tracking": scan_data.tracking_id},
            {"return_tracking": scan_data.tracking_id}
        ]},
        {"_id": 0}
    )
    
    dispatch = await db.dispatches.find_one(
        {"tracking_id": scan_data.tracking_id},
        {"_id": 0}
    )
    
    gate_log = {
        "id": scan_id,
        "scan_type": scan_data.scan_type,
        "tracking_id": scan_data.tracking_id,
        "courier": scan_data.courier,
        "ticket_id": ticket["id"] if ticket else None,
        "ticket_number": ticket["ticket_number"] if ticket else None,
        "dispatch_id": dispatch["id"] if dispatch else None,
        "dispatch_number": dispatch["dispatch_number"] if dispatch else None,
        "customer_name": ticket["customer_name"] if ticket else (dispatch["customer_name"] if dispatch else None),
        "scanned_by": user["id"],
        "scanned_by_name": f"{user['first_name']} {user['last_name']}",
        "notes": scan_data.notes,
        "scanned_at": now.isoformat()
    }
    
    await db.gate_logs.insert_one(gate_log)
    
    # Update ticket/dispatch status based on scan type
    if scan_data.scan_type == "inward" and ticket:
        await db.tickets.update_one(
            {"id": ticket["id"]},
            {"$set": {"status": "received_at_factory", "received_at": now.isoformat(), "updated_at": now.isoformat()}}
        )
        await add_ticket_history(ticket["id"], "Gate scan - Inward", user, {"tracking_id": scan_data.tracking_id})
    
    elif scan_data.scan_type == "outward":
        if ticket:
            await db.tickets.update_one(
                {"id": ticket["id"]},
                {"$set": {"status": "dispatched", "dispatched_at": now.isoformat(), "updated_at": now.isoformat()}}
            )
            await add_ticket_history(ticket["id"], "Gate scan - Outward", user, {"tracking_id": scan_data.tracking_id})
        if dispatch:
            await db.dispatches.update_one(
                {"id": dispatch["id"]},
                {"$set": {"status": "dispatched", "scanned_out_at": now.isoformat(), "updated_at": now.isoformat()}}
            )
    
    del gate_log["_id"]
    return GateScanResponse(**gate_log)

@api_router.get("/gate/logs", response_model=List[GateScanResponse])
async def get_gate_logs(
    scan_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    user: dict = Depends(require_roles(["gate", "dispatcher", "admin"]))
):
    """Get gate scan logs"""
    query = {}
    
    if scan_type:
        query["scan_type"] = scan_type
    if search:
        query["$or"] = [
            {"tracking_id": {"$regex": search, "$options": "i"}},
            {"ticket_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}}
        ]
    if from_date:
        query["scanned_at"] = {"$gte": from_date}
    if to_date:
        if "scanned_at" in query:
            query["scanned_at"]["$lte"] = to_date
        else:
            query["scanned_at"] = {"$lte": to_date}
    
    logs = await db.gate_logs.find(query, {"_id": 0}).sort("scanned_at", -1).limit(limit).to_list(limit)
    return [GateScanResponse(**log) for log in logs]

@api_router.get("/gate/scheduled")
async def get_scheduled_parcels(
    user: dict = Depends(require_roles(["gate", "dispatcher", "admin"]))
):
    """Get scheduled incoming and outgoing parcels"""
    # Scheduled incoming - tickets with pickup label but not yet received
    incoming = await db.tickets.find(
        {"status": {"$in": ["label_uploaded", "pickup_scheduled"]}, "pickup_tracking": {"$ne": None}},
        {"_id": 0, "ticket_number": 1, "customer_name": 1, "pickup_courier": 1, "pickup_tracking": 1, "updated_at": 1}
    ).to_list(50)
    
    # Scheduled outgoing - ready for dispatch
    outgoing_tickets = await db.tickets.find(
        {"status": "ready_for_dispatch", "return_tracking": {"$ne": None}},
        {"_id": 0, "ticket_number": 1, "customer_name": 1, "return_courier": 1, "return_tracking": 1, "updated_at": 1}
    ).to_list(50)
    
    outgoing_dispatches = await db.dispatches.find(
        {"status": "ready_for_dispatch", "tracking_id": {"$ne": None}},
        {"_id": 0, "dispatch_number": 1, "customer_name": 1, "courier": 1, "tracking_id": 1, "updated_at": 1}
    ).to_list(50)
    
    return {
        "scheduled_incoming": incoming,
        "scheduled_outgoing": outgoing_tickets + outgoing_dispatches
    }

# ==================== ADMIN ENDPOINTS ====================

@api_router.get("/admin/stats")
async def get_admin_stats(user: dict = Depends(require_roles(["admin"]))):
    """Get comprehensive admin dashboard stats"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Ticket stats
    total_tickets = await db.tickets.count_documents({})
    open_tickets = await db.tickets.count_documents({"status": {"$nin": ["closed", "closed_by_agent", "resolved_on_call", "delivered"]}})
    today_tickets = await db.tickets.count_documents({"created_at": {"$gte": today_start}})
    hardware_tickets = await db.tickets.count_documents({"support_type": "hardware"})
    phone_tickets = await db.tickets.count_documents({"support_type": "phone"})
    
    # SLA breached tickets
    sla_breached = await db.tickets.count_documents({
        "status": {"$nin": ["closed", "closed_by_agent", "resolved_on_call", "delivered"]},
        "sla_due": {"$lt": now.isoformat()}
    })
    
    # Other stats
    total_customers = await db.users.count_documents({"role": "customer"})
    pending_warranties = await db.warranties.count_documents({"status": "pending"})
    pending_dispatches = await db.dispatches.count_documents({"status": {"$in": ["pending_label", "ready_for_dispatch"]}})
    
    # Tickets by status for charts
    status_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.tickets.aggregate(status_pipeline).to_list(20)
    
    return {
        "total_tickets": total_tickets,
        "open_tickets": open_tickets,
        "today_tickets": today_tickets,
        "hardware_tickets": hardware_tickets,
        "phone_tickets": phone_tickets,
        "sla_breaches": sla_breached,
        "total_customers": total_customers,
        "pending_warranties": pending_warranties,
        "pending_dispatches": pending_dispatches,
        "tickets_by_status": {s["_id"]: s["count"] for s in status_counts}
    }

@api_router.get("/admin/customers")
async def get_admin_customers(
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    user: dict = Depends(require_roles(["admin"]))
):
    """Get all customers with their tickets and warranties"""
    query = {"role": "customer"}
    
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    customers = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with tickets and warranties count
    for customer in customers:
        customer["tickets"] = await db.tickets.find(
            {"customer_id": customer["id"]},
            {"_id": 0, "id": 1, "ticket_number": 1, "status": 1, "device_type": 1, "created_at": 1}
        ).to_list(50)
        customer["warranties"] = await db.warranties.find(
            {"customer_id": customer["id"]},
            {"_id": 0, "id": 1, "warranty_number": 1, "status": 1, "device_type": 1, "warranty_end_date": 1}
        ).to_list(50)
    
    return customers

@api_router.get("/admin/users")
async def get_admin_users(user: dict = Depends(require_roles(["admin"]))):
    """Get all internal users"""
    users = await db.users.find(
        {"role": {"$ne": "customer"}},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    return users

@api_router.post("/admin/users")
async def create_admin_user(user_data: UserCreate, user: dict = Depends(require_roles(["admin"]))):
    """Create internal user"""
    if user_data.role not in ROLES or user_data.role == "customer":
        raise HTTPException(status_code=400, detail="Invalid role")
    
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email.lower(),
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "phone": user_data.phone,
        "role": user_data.role,
        "password_hash": hash_password(user_data.password),
        "address": user_data.address,
        "city": user_data.city,
        "state": user_data.state,
        "pincode": user_data.pincode,
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_doc)
    del user_doc["password_hash"]
    del user_doc["_id"]
    return user_doc

@api_router.get("/admin/agent-performance")
async def get_agent_performance(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user: dict = Depends(require_roles(["admin"]))
):
    """Get agent performance analytics"""
    # Get all support agents
    agents = await db.users.find(
        {"role": {"$in": ["call_support", "service_agent"]}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "role": 1}
    ).to_list(50)
    
    performance = []
    now = datetime.now(timezone.utc)
    
    for agent in agents:
        # Build query
        query = {"assigned_to": agent["id"]}
        if from_date:
            query["created_at"] = {"$gte": from_date}
        if to_date:
            if "created_at" in query:
                query["created_at"]["$lte"] = to_date
            else:
                query["created_at"] = {"$lte": to_date}
        
        # Get ticket stats
        total = await db.tickets.count_documents(query)
        closed = await db.tickets.count_documents({**query, "status": {"$in": ["closed", "closed_by_agent", "resolved_on_call"]}})
        hardware = await db.tickets.count_documents({**query, "support_type": "hardware"})
        phone = await db.tickets.count_documents({**query, "support_type": "phone"})
        sla_breached = await db.tickets.count_documents({**query, "sla_due": {"$lt": now.isoformat()}, "status": {"$nin": ["closed", "closed_by_agent", "resolved_on_call"]}})
        
        # Calculate average resolution time
        closed_tickets = await db.tickets.find(
            {**query, "closed_at": {"$ne": None}},
            {"_id": 0, "created_at": 1, "closed_at": 1}
        ).to_list(1000)
        
        avg_hours = 0
        if closed_tickets:
            total_hours = 0
            for t in closed_tickets:
                try:
                    created = datetime.fromisoformat(t["created_at"].replace('Z', '+00:00'))
                    closed_time = datetime.fromisoformat(t["closed_at"].replace('Z', '+00:00'))
                    total_hours += (closed_time - created).total_seconds() / 3600
                except:
                    pass
            avg_hours = total_hours / len(closed_tickets) if closed_tickets else 0
        
        sla_compliance = ((total - sla_breached) / total * 100) if total > 0 else 100
        
        performance.append(AgentPerformance(
            agent_id=agent["id"],
            agent_name=f"{agent['first_name']} {agent['last_name']}",
            total_tickets=total,
            closed_tickets=closed,
            hardware_tickets=hardware,
            phone_tickets=phone,
            sla_breaches=sla_breached,
            avg_resolution_hours=round(avg_hours, 2),
            sla_compliance_rate=round(sla_compliance, 2)
        ))
    
    return performance

@api_router.get("/admin/tickets")
async def get_all_tickets_admin(
    search: Optional[str] = None,
    status: Optional[str] = None,
    support_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    user: dict = Depends(require_roles(["admin"]))
):
    """Get all tickets for admin view"""
    query = {}
    
    if search:
        query["$or"] = [
            {"ticket_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}},
            {"serial_number": {"$regex": search, "$options": "i"}}
        ]
    if status:
        query["status"] = status
    if support_type:
        query["support_type"] = support_type
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = to_date
        else:
            query["created_at"] = {"$lte": to_date}
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Update SLA status
    now = datetime.now(timezone.utc)
    for ticket in tickets:
        if ticket.get("sla_due"):
            try:
                sla_due = datetime.fromisoformat(ticket["sla_due"].replace('Z', '+00:00'))
                ticket["sla_breached"] = is_sla_breached(sla_due, ticket["status"])
            except:
                pass
    
    return tickets

# ==================== TECHNICIAN ENDPOINTS ====================

@api_router.get("/technician/queue")
async def get_technician_queue(user: dict = Depends(require_roles(["service_agent", "admin"]))):
    """Get tickets received at factory awaiting repair"""
    tickets = await db.tickets.find(
        {"status": {"$in": ["received_at_factory", "in_repair"]}},
        {"_id": 0}
    ).sort("received_at", 1).to_list(100)
    
    # Calculate 72-hour SLA for each
    now = datetime.now(timezone.utc)
    for ticket in tickets:
        if ticket.get("received_at"):
            received = datetime.fromisoformat(ticket["received_at"].replace('Z', '+00:00'))
            repair_sla_due = received + timedelta(hours=72)
            ticket["repair_sla_due"] = repair_sla_due.isoformat()
            ticket["repair_sla_breached"] = now > repair_sla_due
            hours_remaining = (repair_sla_due - now).total_seconds() / 3600
            ticket["repair_hours_remaining"] = max(0, round(hours_remaining, 1))
    
    return tickets

@api_router.get("/technician/my-repairs")
async def get_my_repairs(user: dict = Depends(require_roles(["service_agent"]))):
    """Get tickets assigned to current technician"""
    tickets = await db.tickets.find(
        {"assigned_to": user["id"], "status": {"$in": ["in_repair", "repair_completed"]}},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    return tickets

# ==================== CUSTOMER PORTAL ENDPOINTS ====================

@api_router.get("/customer/timeline/{ticket_id}")
async def get_ticket_timeline(ticket_id: str, user: dict = Depends(get_current_user)):
    """Get detailed timeline for customer ticket"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if user["role"] == "customer" and ticket.get("customer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Build timeline
    timeline = []
    
    # Created
    timeline.append({
        "stage": "created",
        "title": "Ticket Created",
        "status": "completed",
        "timestamp": ticket["created_at"],
        "description": f"Support request created for {ticket['device_type']}"
    })
    
    # Call Support
    if ticket.get("support_type"):
        timeline.append({
            "stage": "diagnosed",
            "title": "Issue Diagnosed",
            "status": "completed" if ticket["status"] not in ["new_request"] else "pending",
            "timestamp": ticket.get("updated_at"),
            "description": f"Classified as {ticket['support_type']} support"
        })
    
    # Hardware flow
    if ticket.get("support_type") == "hardware":
        # Pickup label
        timeline.append({
            "stage": "pickup_label",
            "title": "Pickup Label Generated",
            "status": "completed" if ticket.get("pickup_label") else "pending",
            "timestamp": None,
            "description": "Download label and ship product",
            "action": {"type": "download", "url": ticket.get("pickup_label")} if ticket.get("pickup_label") else None
        })
        
        # Received
        timeline.append({
            "stage": "received",
            "title": "Received at Service Center",
            "status": "completed" if ticket.get("received_at") else "pending",
            "timestamp": ticket.get("received_at"),
            "description": "Product received for repair"
        })
        
        # Repair
        timeline.append({
            "stage": "repair",
            "title": "Repair in Progress",
            "status": "completed" if ticket.get("repaired_at") else ("in_progress" if ticket["status"] == "in_repair" else "pending"),
            "timestamp": ticket.get("repaired_at"),
            "description": ticket.get("repair_notes", "Being repaired by technician")
        })
        
        # Service invoice
        if ticket.get("service_charges"):
            timeline.append({
                "stage": "invoice",
                "title": "Service Charges",
                "status": "completed",
                "timestamp": None,
                "description": f"Service charge: ₹{ticket['service_charges']}",
                "action": {"type": "download", "url": ticket.get("service_invoice")} if ticket.get("service_invoice") else None
            })
        
        # Dispatched
        timeline.append({
            "stage": "dispatched",
            "title": "Product Dispatched",
            "status": "completed" if ticket.get("dispatched_at") else "pending",
            "timestamp": ticket.get("dispatched_at"),
            "description": f"Shipped via {ticket.get('return_courier', 'courier')}" if ticket.get("return_tracking") else "Ready to ship",
            "tracking": {"courier": ticket.get("return_courier"), "tracking_id": ticket.get("return_tracking")} if ticket.get("return_tracking") else None
        })
    
    # Closed
    if ticket["status"] in ["closed", "closed_by_agent", "resolved_on_call", "delivered"]:
        timeline.append({
            "stage": "closed",
            "title": "Ticket Closed",
            "status": "completed",
            "timestamp": ticket.get("closed_at"),
            "description": "Issue resolved"
        })
    
    return {"ticket": ticket, "timeline": timeline}

@api_router.get("/stats")
async def get_customer_stats(user: dict = Depends(get_current_user)):
    """Get stats for customer dashboard"""
    if user["role"] != "customer":
        raise HTTPException(status_code=403, detail="Customer only")
    
    my_tickets = await db.tickets.count_documents({"customer_id": user["id"]})
    open_tickets = await db.tickets.count_documents({
        "customer_id": user["id"],
        "status": {"$nin": ["closed", "closed_by_agent", "resolved_on_call", "delivered"]}
    })
    my_warranties = await db.warranties.count_documents({"customer_id": user["id"]})
    approved_warranties = await db.warranties.count_documents({"customer_id": user["id"], "status": "approved"})
    
    return {
        "my_tickets": my_tickets,
        "open_tickets": open_tickets,
        "my_warranties": my_warranties,
        "approved_warranties": approved_warranties
    }

# ==================== FILE SERVING ====================

@api_router.get("/files/{folder}/{filename}")
async def serve_file(folder: str, filename: str):
    """Serve uploaded files"""
    file_path = UPLOAD_DIR / folder / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0", "edition": "enterprise"}

# ==================== APP SETUP ====================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

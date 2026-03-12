from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import base64
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'musclegrid-crm-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "invoices").mkdir(exist_ok=True)
(UPLOAD_DIR / "labels").mkdir(exist_ok=True)
(UPLOAD_DIR / "reviews").mkdir(exist_ok=True)

app = FastAPI(title="MuscleGrid CRM API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== MODELS ====================

# User Roles
ROLES = ["customer", "call_support", "service_agent", "accountant", "dispatcher", "admin"]

# Ticket Statuses
TICKET_STATUSES = ["open", "in_progress", "diagnosed", "hardware_required", "software_issue", "pending_pickup", "pending_dispatch", "dispatched", "resolved", "closed"]

# Device Types
DEVICE_TYPES = ["Inverter", "Battery", "Stabilizer", "Others"]

# Warranty Statuses
WARRANTY_STATUSES = ["pending", "approved", "rejected"]

# Dispatch Types
DISPATCH_TYPES = ["outbound", "reverse_pickup", "part_dispatch"]

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: str
    role: str = "customer"

class UserCreate(UserBase):
    password: str

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
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Ticket Models
class TicketCreate(BaseModel):
    device_type: str
    order_id: Optional[str] = None
    issue_description: str
    customer_id: Optional[str] = None  # For agents creating on behalf

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    diagnosis: Optional[str] = None
    issue_type: Optional[str] = None  # software or hardware
    agent_notes: Optional[str] = None
    assigned_to: Optional[str] = None

class TicketResponse(BaseModel):
    id: str
    ticket_number: str
    customer_id: str
    customer_name: str
    customer_phone: str
    customer_email: str
    device_type: str
    order_id: Optional[str]
    issue_description: str
    status: str
    diagnosis: Optional[str]
    issue_type: Optional[str]
    agent_notes: Optional[str]
    assigned_to: Optional[str]
    created_at: str
    updated_at: str
    history: List[dict]

# Warranty Models
class WarrantyCreate(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: EmailStr
    device_type: str
    invoice_date: str
    invoice_amount: float
    order_id: str

class WarrantyApproval(BaseModel):
    warranty_end_date: str
    notes: Optional[str] = None

class WarrantyResponse(BaseModel):
    id: str
    customer_id: str
    first_name: str
    last_name: str
    phone: str
    email: str
    device_type: str
    invoice_date: str
    invoice_amount: float
    order_id: str
    invoice_file: Optional[str]
    status: str
    warranty_end_date: Optional[str]
    admin_notes: Optional[str]
    created_at: str
    updated_at: str

# Dispatch Models
class OutboundDispatchCreate(BaseModel):
    sku: str
    customer_name: str
    phone: str
    address: str
    reason: str
    note: Optional[str] = None

class DispatchLabelUpdate(BaseModel):
    courier: str
    tracking_id: str

class DispatchResponse(BaseModel):
    id: str
    dispatch_number: str
    dispatch_type: str
    sku: Optional[str]
    customer_name: str
    phone: str
    address: str
    reason: Optional[str]
    note: Optional[str]
    courier: Optional[str]
    tracking_id: Optional[str]
    label_file: Optional[str]
    status: str
    ticket_id: Optional[str]
    created_by: str
    created_at: str
    updated_at: str

# Customer CRM Model
class CustomerResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str
    phone: str
    warranties: List[dict]
    tickets: List[dict]
    created_at: str

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_roles(allowed_roles: List[str]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

def generate_ticket_number():
    return f"TKT-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

def generate_dispatch_number():
    return f"DSP-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

def generate_warranty_id():
    return f"WRN-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role
    if user_data.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {ROLES}")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "phone": user_data.phone,
        "role": user_data.role,
        "password_hash": hash_password(user_data.password),
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email, user_data.role)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone,
            role=user_data.role,
            created_at=now
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["id"], user["email"], user["role"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            first_name=user["first_name"],
            last_name=user["last_name"],
            phone=user["phone"],
            role=user["role"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        first_name=user["first_name"],
        last_name=user["last_name"],
        phone=user["phone"],
        role=user["role"],
        created_at=user["created_at"]
    )

# ==================== TICKET ROUTES ====================

@api_router.post("/tickets", response_model=TicketResponse)
async def create_ticket(ticket_data: TicketCreate, user: dict = Depends(get_current_user)):
    # Determine customer info
    if user["role"] == "customer":
        customer_id = user["id"]
        customer_name = f"{user['first_name']} {user['last_name']}"
        customer_phone = user["phone"]
        customer_email = user["email"]
    elif ticket_data.customer_id and user["role"] in ["call_support", "admin"]:
        customer = await db.users.find_one({"id": ticket_data.customer_id}, {"_id": 0})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        customer_id = customer["id"]
        customer_name = f"{customer['first_name']} {customer['last_name']}"
        customer_phone = customer["phone"]
        customer_email = customer["email"]
    else:
        customer_id = user["id"]
        customer_name = f"{user['first_name']} {user['last_name']}"
        customer_phone = user["phone"]
        customer_email = user["email"]
    
    ticket_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    ticket_number = generate_ticket_number()
    
    ticket_doc = {
        "id": ticket_id,
        "ticket_number": ticket_number,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "customer_email": customer_email,
        "device_type": ticket_data.device_type,
        "order_id": ticket_data.order_id,
        "issue_description": ticket_data.issue_description,
        "status": "open",
        "diagnosis": None,
        "issue_type": None,
        "agent_notes": None,
        "assigned_to": None,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
        "history": [{
            "action": "Ticket created",
            "by": f"{user['first_name']} {user['last_name']}",
            "by_role": user["role"],
            "timestamp": now
        }]
    }
    
    await db.tickets.insert_one(ticket_doc)
    
    return TicketResponse(**{k: v for k, v in ticket_doc.items() if k != "_id"})

@api_router.get("/tickets", response_model=List[TicketResponse])
async def get_tickets(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    
    # Role-based filtering
    if user["role"] == "customer":
        query["customer_id"] = user["id"]
    elif user["role"] == "service_agent":
        query["assigned_to"] = user["id"]
    elif user["role"] == "call_support":
        # Show open tickets and tickets they're working on
        query["$or"] = [
            {"status": {"$in": ["open", "in_progress", "diagnosed"]}},
            {"created_by": user["id"]}
        ]
    elif user["role"] == "accountant":
        query["status"] = {"$in": ["hardware_required", "pending_pickup", "pending_dispatch"]}
    
    if status:
        query["status"] = status
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [TicketResponse(**t) for t in tickets]

@api_router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Access control
    if user["role"] == "customer" and ticket["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return TicketResponse(**ticket)

@api_router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    update_data: TicketUpdate,
    user: dict = Depends(require_roles(["call_support", "service_agent", "accountant", "admin"]))
):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc).isoformat()
    updates = {"updated_at": now}
    history_entries = []
    
    if update_data.status:
        updates["status"] = update_data.status
        history_entries.append({
            "action": f"Status changed to {update_data.status}",
            "by": f"{user['first_name']} {user['last_name']}",
            "by_role": user["role"],
            "timestamp": now
        })
    
    if update_data.diagnosis:
        updates["diagnosis"] = update_data.diagnosis
        history_entries.append({
            "action": f"Diagnosis added: {update_data.diagnosis[:50]}...",
            "by": f"{user['first_name']} {user['last_name']}",
            "by_role": user["role"],
            "timestamp": now
        })
    
    if update_data.issue_type:
        updates["issue_type"] = update_data.issue_type
        history_entries.append({
            "action": f"Issue type set to {update_data.issue_type}",
            "by": f"{user['first_name']} {user['last_name']}",
            "by_role": user["role"],
            "timestamp": now
        })
    
    if update_data.agent_notes:
        updates["agent_notes"] = update_data.agent_notes
        history_entries.append({
            "action": "Agent notes updated",
            "by": f"{user['first_name']} {user['last_name']}",
            "by_role": user["role"],
            "timestamp": now
        })
    
    if update_data.assigned_to:
        updates["assigned_to"] = update_data.assigned_to
        assignee = await db.users.find_one({"id": update_data.assigned_to}, {"_id": 0})
        assignee_name = f"{assignee['first_name']} {assignee['last_name']}" if assignee else "Unknown"
        history_entries.append({
            "action": f"Assigned to {assignee_name}",
            "by": f"{user['first_name']} {user['last_name']}",
            "by_role": user["role"],
            "timestamp": now
        })
    
    if history_entries:
        await db.tickets.update_one(
            {"id": ticket_id},
            {
                "$set": updates,
                "$push": {"history": {"$each": history_entries}}
            }
        )
    
    updated_ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    return TicketResponse(**updated_ticket)

# Route ticket to hardware (creates dispatch entry)
@api_router.post("/tickets/{ticket_id}/route-to-hardware")
async def route_to_hardware(
    ticket_id: str,
    agent_notes: str = Form(...),
    user: dict = Depends(require_roles(["call_support", "service_agent", "admin"]))
):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update ticket status
    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$set": {
                "status": "hardware_required",
                "issue_type": "hardware",
                "agent_notes": agent_notes,
                "updated_at": now
            },
            "$push": {
                "history": {
                    "action": f"Routed to hardware service with notes: {agent_notes}",
                    "by": f"{user['first_name']} {user['last_name']}",
                    "by_role": user["role"],
                    "timestamp": now
                }
            }
        }
    )
    
    return {"message": "Ticket routed to hardware service", "ticket_id": ticket_id}

# ==================== WARRANTY ROUTES ====================

@api_router.post("/warranties")
async def create_warranty(
    first_name: str = Form(...),
    last_name: str = Form(...),
    phone: str = Form(...),
    email: str = Form(...),
    device_type: str = Form(...),
    invoice_date: str = Form(...),
    invoice_amount: float = Form(...),
    order_id: str = Form(...),
    invoice_file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    warranty_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Save invoice file
    file_ext = invoice_file.filename.split('.')[-1] if invoice_file.filename else 'pdf'
    file_name = f"{warranty_id}.{file_ext}"
    file_path = UPLOAD_DIR / "invoices" / file_name
    
    with open(file_path, "wb") as f:
        content = await invoice_file.read()
        f.write(content)
    
    warranty_doc = {
        "id": warranty_id,
        "warranty_number": generate_warranty_id(),
        "customer_id": user["id"],
        "first_name": first_name,
        "last_name": last_name,
        "phone": phone,
        "email": email,
        "device_type": device_type,
        "invoice_date": invoice_date,
        "invoice_amount": invoice_amount,
        "order_id": order_id,
        "invoice_file": file_name,
        "status": "pending",
        "warranty_end_date": None,
        "admin_notes": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.warranties.insert_one(warranty_doc)
    
    return {"message": "Warranty registration submitted", "warranty_id": warranty_id}

@api_router.get("/warranties", response_model=List[WarrantyResponse])
async def get_warranties(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    
    if user["role"] == "customer":
        query["customer_id"] = user["id"]
    
    if status:
        query["status"] = status
    
    warranties = await db.warranties.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [WarrantyResponse(**w) for w in warranties]

@api_router.get("/warranties/{warranty_id}", response_model=WarrantyResponse)
async def get_warranty(warranty_id: str, user: dict = Depends(get_current_user)):
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
    warranty = await db.warranties.find_one({"id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.warranties.update_one(
        {"id": warranty_id},
        {
            "$set": {
                "status": "approved",
                "warranty_end_date": approval.warranty_end_date,
                "admin_notes": approval.notes,
                "approved_by": user["id"],
                "updated_at": now
            }
        }
    )
    
    return {"message": "Warranty approved", "warranty_id": warranty_id}

@api_router.patch("/warranties/{warranty_id}/reject")
async def reject_warranty(
    warranty_id: str,
    notes: str = Form(...),
    user: dict = Depends(require_roles(["admin"]))
):
    warranty = await db.warranties.find_one({"id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.warranties.update_one(
        {"id": warranty_id},
        {
            "$set": {
                "status": "rejected",
                "admin_notes": notes,
                "updated_at": now
            }
        }
    )
    
    return {"message": "Warranty rejected", "warranty_id": warranty_id}

# ==================== DISPATCH ROUTES ====================

@api_router.post("/dispatches/outbound")
async def create_outbound_dispatch(
    dispatch_data: OutboundDispatchCreate,
    user: dict = Depends(get_current_user)
):
    dispatch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    dispatch_doc = {
        "id": dispatch_id,
        "dispatch_number": generate_dispatch_number(),
        "dispatch_type": "outbound",
        "sku": dispatch_data.sku,
        "customer_name": dispatch_data.customer_name,
        "phone": dispatch_data.phone,
        "address": dispatch_data.address,
        "reason": dispatch_data.reason,
        "note": dispatch_data.note,
        "courier": None,
        "tracking_id": None,
        "label_file": None,
        "status": "pending_label",
        "ticket_id": None,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.dispatches.insert_one(dispatch_doc)
    
    return {"message": "Outbound dispatch request created", "dispatch_id": dispatch_id}

@api_router.post("/dispatches/from-ticket/{ticket_id}")
async def create_dispatch_from_ticket(
    ticket_id: str,
    dispatch_type: str = Form(...),  # reverse_pickup or part_dispatch
    sku: Optional[str] = Form(None),
    user: dict = Depends(require_roles(["accountant", "admin"]))
):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Get customer details
    customer = await db.users.find_one({"id": ticket["customer_id"]}, {"_id": 0})
    
    dispatch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    dispatch_doc = {
        "id": dispatch_id,
        "dispatch_number": generate_dispatch_number(),
        "dispatch_type": dispatch_type,
        "sku": sku,
        "customer_name": ticket["customer_name"],
        "phone": ticket["customer_phone"],
        "address": customer.get("address", "Address not provided") if customer else "Address not provided",
        "reason": f"Hardware service for ticket {ticket['ticket_number']}",
        "note": ticket.get("agent_notes", ""),
        "courier": None,
        "tracking_id": None,
        "label_file": None,
        "status": "pending_label",
        "ticket_id": ticket_id,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.dispatches.insert_one(dispatch_doc)
    
    # Update ticket status
    new_status = "pending_pickup" if dispatch_type == "reverse_pickup" else "pending_dispatch"
    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$set": {"status": new_status, "updated_at": now},
            "$push": {
                "history": {
                    "action": f"Dispatch created: {dispatch_type}",
                    "by": f"{user['first_name']} {user['last_name']}",
                    "by_role": user["role"],
                    "timestamp": now
                }
            }
        }
    )
    
    return {"message": f"{dispatch_type} dispatch created", "dispatch_id": dispatch_id}

@api_router.get("/dispatches", response_model=List[DispatchResponse])
async def get_dispatches(
    dispatch_type: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    
    if dispatch_type:
        query["dispatch_type"] = dispatch_type
    
    if status:
        query["status"] = status
    
    dispatches = await db.dispatches.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [DispatchResponse(**d) for d in dispatches]

@api_router.patch("/dispatches/{dispatch_id}/label")
async def upload_dispatch_label(
    dispatch_id: str,
    courier: str = Form(...),
    tracking_id: str = Form(...),
    label_file: UploadFile = File(...),
    user: dict = Depends(require_roles(["accountant", "admin"]))
):
    dispatch = await db.dispatches.find_one({"id": dispatch_id}, {"_id": 0})
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    
    # Save label file
    file_ext = label_file.filename.split('.')[-1] if label_file.filename else 'pdf'
    file_name = f"{dispatch_id}.{file_ext}"
    file_path = UPLOAD_DIR / "labels" / file_name
    
    with open(file_path, "wb") as f:
        content = await label_file.read()
        f.write(content)
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.dispatches.update_one(
        {"id": dispatch_id},
        {
            "$set": {
                "courier": courier,
                "tracking_id": tracking_id,
                "label_file": file_name,
                "status": "ready_to_dispatch",
                "updated_at": now
            }
        }
    )
    
    return {"message": "Label uploaded", "dispatch_id": dispatch_id}

@api_router.patch("/dispatches/{dispatch_id}/status")
async def update_dispatch_status(
    dispatch_id: str,
    status: str = Form(...),
    user: dict = Depends(require_roles(["accountant", "dispatcher", "admin"]))
):
    dispatch = await db.dispatches.find_one({"id": dispatch_id}, {"_id": 0})
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.dispatches.update_one(
        {"id": dispatch_id},
        {
            "$set": {
                "status": status,
                "updated_at": now
            }
        }
    )
    
    # If dispatch is linked to a ticket and marked as dispatched, update ticket
    if dispatch.get("ticket_id") and status == "dispatched":
        await db.tickets.update_one(
            {"id": dispatch["ticket_id"]},
            {
                "$set": {"status": "dispatched", "updated_at": now},
                "$push": {
                    "history": {
                        "action": f"Item dispatched via {dispatch.get('courier', 'courier')} - {dispatch.get('tracking_id', '')}",
                        "by": f"{user['first_name']} {user['last_name']}",
                        "by_role": user["role"],
                        "timestamp": now
                    }
                }
            }
        )
    
    return {"message": f"Dispatch status updated to {status}", "dispatch_id": dispatch_id}

# Dispatcher Dashboard - Queue for TV/Mobile view
@api_router.get("/dispatcher/queue")
async def get_dispatcher_queue(user: dict = Depends(get_current_user)):
    # Get dispatches ready to be shipped
    dispatches = await db.dispatches.find(
        {"status": {"$in": ["ready_to_dispatch", "dispatched"]}},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    return dispatches

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/customers")
async def get_all_customers(
    search: Optional[str] = None,
    user: dict = Depends(require_roles(["admin"]))
):
    query = {"role": "customer"}
    
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    customers = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with warranty and ticket data
    result = []
    for customer in customers:
        warranties = await db.warranties.find(
            {"customer_id": customer["id"]},
            {"_id": 0, "id": 1, "device_type": 1, "status": 1, "warranty_end_date": 1}
        ).to_list(100)
        
        tickets = await db.tickets.find(
            {"customer_id": customer["id"]},
            {"_id": 0, "id": 1, "ticket_number": 1, "status": 1, "device_type": 1}
        ).to_list(100)
        
        result.append({
            **customer,
            "warranties": warranties,
            "tickets": tickets
        })
    
    return result

@api_router.get("/admin/users")
async def get_all_users(
    role: Optional[str] = None,
    user: dict = Depends(require_roles(["admin"]))
):
    query = {}
    if role:
        query["role"] = role
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return users

@api_router.post("/admin/users")
async def create_internal_user(
    user_data: UserCreate,
    admin: dict = Depends(require_roles(["admin"]))
):
    if user_data.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {ROLES}")
    
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "phone": user_data.phone,
        "role": user_data.role,
        "password_hash": hash_password(user_data.password),
        "created_by": admin["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    return {"message": "User created", "user_id": user_id}

# Dashboard Stats
@api_router.get("/admin/stats")
async def get_admin_stats(user: dict = Depends(require_roles(["admin"]))):
    total_customers = await db.users.count_documents({"role": "customer"})
    total_tickets = await db.tickets.count_documents({})
    open_tickets = await db.tickets.count_documents({"status": {"$in": ["open", "in_progress"]}})
    pending_warranties = await db.warranties.count_documents({"status": "pending"})
    pending_dispatches = await db.dispatches.count_documents({"status": "pending_label"})
    
    return {
        "total_customers": total_customers,
        "total_tickets": total_tickets,
        "open_tickets": open_tickets,
        "pending_warranties": pending_warranties,
        "pending_dispatches": pending_dispatches
    }

# Stats for different roles
@api_router.get("/stats")
async def get_role_stats(user: dict = Depends(get_current_user)):
    stats = {}
    
    if user["role"] == "customer":
        stats["my_tickets"] = await db.tickets.count_documents({"customer_id": user["id"]})
        stats["open_tickets"] = await db.tickets.count_documents({"customer_id": user["id"], "status": {"$nin": ["resolved", "closed"]}})
        stats["my_warranties"] = await db.warranties.count_documents({"customer_id": user["id"]})
        stats["approved_warranties"] = await db.warranties.count_documents({"customer_id": user["id"], "status": "approved"})
    
    elif user["role"] == "call_support":
        stats["open_tickets"] = await db.tickets.count_documents({"status": "open"})
        stats["in_progress"] = await db.tickets.count_documents({"status": "in_progress"})
        stats["diagnosed_today"] = await db.tickets.count_documents({"status": "diagnosed"})
        stats["hardware_routed"] = await db.tickets.count_documents({"status": "hardware_required"})
    
    elif user["role"] == "service_agent":
        stats["assigned_tickets"] = await db.tickets.count_documents({"assigned_to": user["id"]})
        stats["pending_service"] = await db.tickets.count_documents({"assigned_to": user["id"], "status": {"$nin": ["resolved", "closed"]}})
    
    elif user["role"] == "accountant":
        stats["pending_labels"] = await db.dispatches.count_documents({"status": "pending_label"})
        stats["hardware_tickets"] = await db.tickets.count_documents({"status": "hardware_required"})
        stats["ready_to_dispatch"] = await db.dispatches.count_documents({"status": "ready_to_dispatch"})
    
    elif user["role"] == "dispatcher":
        stats["ready_to_dispatch"] = await db.dispatches.count_documents({"status": "ready_to_dispatch"})
        stats["dispatched_today"] = await db.dispatches.count_documents({"status": "dispatched"})
    
    return stats

# File serving endpoint
@api_router.get("/files/{folder}/{filename}")
async def get_file(folder: str, filename: str, user: dict = Depends(get_current_user)):
    file_path = UPLOAD_DIR / folder / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    with open(file_path, "rb") as f:
        content = f.read()
    
    # Return base64 encoded content
    return {
        "filename": filename,
        "content": base64.b64encode(content).decode('utf-8'),
        "content_type": "application/pdf" if filename.endswith('.pdf') else "image/png"
    }

# Service Agents list for assignment
@api_router.get("/users/service-agents")
async def get_service_agents(user: dict = Depends(require_roles(["call_support", "admin"]))):
    agents = await db.users.find(
        {"role": "service_agent"},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1}
    ).to_list(100)
    return agents

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

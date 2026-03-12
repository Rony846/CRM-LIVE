from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, BackgroundTasks
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
import asyncio
import csv
import io

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

# Email Configuration (Resend)
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
EMAIL_ENABLED = bool(RESEND_API_KEY)

# Initialize Resend if available
if EMAIL_ENABLED:
    try:
        import resend
        resend.api_key = RESEND_API_KEY
    except ImportError:
        EMAIL_ENABLED = False

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "invoices").mkdir(exist_ok=True)
(UPLOAD_DIR / "labels").mkdir(exist_ok=True)
(UPLOAD_DIR / "reviews").mkdir(exist_ok=True)

app = FastAPI(title="MuscleGrid CRM API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

# Campaign Statuses
CAMPAIGN_STATUSES = ["running", "completed", "stopped", "expired"]

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: str
    role: str = "customer"
    # Address fields
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

# Ticket Models
class TicketCreate(BaseModel):
    device_type: str
    order_id: Optional[str] = None
    issue_description: str
    customer_id: Optional[str] = None

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    diagnosis: Optional[str] = None
    issue_type: Optional[str] = None
    agent_notes: Optional[str] = None
    assigned_to: Optional[str] = None

class TicketResponse(BaseModel):
    id: str
    ticket_number: str
    customer_id: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_email: str
    customer_address: Optional[str] = None
    device_type: str
    order_id: Optional[str]
    issue_description: str
    status: str
    diagnosis: Optional[str]
    issue_type: Optional[str]
    agent_notes: Optional[str]
    assigned_to: Optional[str]
    assigned_to_name: Optional[str] = None
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
    extension_requested: Optional[bool] = False
    extension_status: Optional[str] = None

# Dispatch Models
class OutboundDispatchCreate(BaseModel):
    sku: str
    customer_name: str
    phone: str
    address: str
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    reason: str
    note: Optional[str] = None

class DispatchResponse(BaseModel):
    id: str
    dispatch_number: str
    dispatch_type: str
    sku: Optional[str]
    customer_name: str
    phone: str
    address: str
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
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

# Campaign Models
class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_device_types: Optional[List[str]] = None
    max_sends: int = 3

class CampaignResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    target_device_types: Optional[List[str]]
    max_sends: int
    created_at: str
    total_customers: int = 0
    pending_reviews: int = 0
    approved_reviews: int = 0

# ==================== EMAIL SERVICE ====================

async def send_email_async(to_email: str, subject: str, html_content: str):
    """Send email asynchronously using Resend"""
    if not EMAIL_ENABLED:
        logger.info(f"Email disabled. Would send to {to_email}: {subject}")
        return None
    
    try:
        import resend
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}: {subject}")
        return result
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return None

def get_email_template(template_type: str, data: dict) -> tuple:
    """Generate email subject and HTML content based on template type"""
    base_style = """
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563EB; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f8f9fa; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        .button { display: inline-block; padding: 12px 24px; background: #2563EB; color: white; text-decoration: none; border-radius: 6px; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; }
        .status-open { background: #DBEAFE; color: #1E40AF; }
        .status-resolved { background: #D1FAE5; color: #065F46; }
        .status-approved { background: #D1FAE5; color: #065F46; }
        .status-rejected { background: #FEE2E2; color: #991B1B; }
    </style>
    """
    
    templates = {
        "ticket_created": (
            f"Ticket Created - {data.get('ticket_number', '')}",
            f"""
            {base_style}
            <div class="container">
                <div class="header"><h1>MuscleGrid Support</h1></div>
                <div class="content">
                    <h2>Your Support Ticket Has Been Created</h2>
                    <p>Dear {data.get('customer_name', 'Customer')},</p>
                    <p>We have received your support request. Here are the details:</p>
                    <table style="width:100%; border-collapse: collapse;">
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Ticket Number:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('ticket_number', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Device Type:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('device_type', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Issue:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('issue_description', '')[:100]}...</td></tr>
                    </table>
                    <p>Our support team will review your ticket and get back to you soon.</p>
                </div>
                <div class="footer">MuscleGrid CRM • Customer Support</div>
            </div>
            """
        ),
        "ticket_updated": (
            f"Ticket Update - {data.get('ticket_number', '')}",
            f"""
            {base_style}
            <div class="container">
                <div class="header"><h1>MuscleGrid Support</h1></div>
                <div class="content">
                    <h2>Your Ticket Has Been Updated</h2>
                    <p>Dear {data.get('customer_name', 'Customer')},</p>
                    <p>Your support ticket <strong>{data.get('ticket_number', '')}</strong> has been updated.</p>
                    <p><strong>New Status:</strong> <span class="status status-{data.get('status', 'open')}">{data.get('status', '').replace('_', ' ').title()}</span></p>
                    {f"<p><strong>Diagnosis:</strong> {data.get('diagnosis', '')}</p>" if data.get('diagnosis') else ''}
                    {f"<p><strong>Notes:</strong> {data.get('agent_notes', '')}</p>" if data.get('agent_notes') else ''}
                </div>
                <div class="footer">MuscleGrid CRM • Customer Support</div>
            </div>
            """
        ),
        "hardware_service": (
            f"Hardware Service Required - {data.get('ticket_number', '')}",
            f"""
            {base_style}
            <div class="container">
                <div class="header"><h1>MuscleGrid Support</h1></div>
                <div class="content">
                    <h2>Hardware Service Required</h2>
                    <p>Dear {data.get('customer_name', 'Customer')},</p>
                    <p>After diagnosing your issue, we have determined that your {data.get('device_type', 'device')} requires hardware service.</p>
                    <p><strong>Ticket:</strong> {data.get('ticket_number', '')}</p>
                    <p><strong>Notes:</strong> {data.get('agent_notes', 'Our team will arrange for pickup/part dispatch.')}</p>
                    <p>Our logistics team will contact you shortly regarding the next steps.</p>
                </div>
                <div class="footer">MuscleGrid CRM • Customer Support</div>
            </div>
            """
        ),
        "dispatch_tracking": (
            f"Dispatch Update - {data.get('dispatch_number', '')}",
            f"""
            {base_style}
            <div class="container">
                <div class="header"><h1>MuscleGrid Logistics</h1></div>
                <div class="content">
                    <h2>Your Shipment is on the Way!</h2>
                    <p>Dear {data.get('customer_name', 'Customer')},</p>
                    <p>Your package has been dispatched. Here are the tracking details:</p>
                    <table style="width:100%; border-collapse: collapse;">
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Dispatch Number:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('dispatch_number', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Courier:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('courier', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Tracking ID:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('tracking_id', '')}</td></tr>
                    </table>
                    <p>You can track your shipment using the tracking ID above on the courier's website.</p>
                </div>
                <div class="footer">MuscleGrid CRM • Logistics</div>
            </div>
            """
        ),
        "warranty_approved": (
            "Warranty Approved - MuscleGrid",
            f"""
            {base_style}
            <div class="container">
                <div class="header"><h1>MuscleGrid</h1></div>
                <div class="content">
                    <h2>Your Warranty Has Been Approved!</h2>
                    <p>Dear {data.get('customer_name', 'Customer')},</p>
                    <p>Great news! Your warranty registration has been approved.</p>
                    <table style="width:100%; border-collapse: collapse;">
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Device:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('device_type', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Warranty Valid Until:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('warranty_end_date', '')}</td></tr>
                    </table>
                    <p>You can view your warranty details in your customer portal.</p>
                </div>
                <div class="footer">MuscleGrid CRM</div>
            </div>
            """
        ),
        "warranty_rejected": (
            "Warranty Registration Update - MuscleGrid",
            f"""
            {base_style}
            <div class="container">
                <div class="header"><h1>MuscleGrid</h1></div>
                <div class="content">
                    <h2>Warranty Registration Update</h2>
                    <p>Dear {data.get('customer_name', 'Customer')},</p>
                    <p>Unfortunately, we were unable to approve your warranty registration at this time.</p>
                    <p><strong>Reason:</strong> {data.get('admin_notes', 'Please contact support for more details.')}</p>
                    <p>If you believe this was in error, please contact our support team.</p>
                </div>
                <div class="footer">MuscleGrid CRM</div>
            </div>
            """
        ),
        "warranty_extension": (
            "Extend Your Warranty - Leave a Review!",
            f"""
            {base_style}
            <div class="container">
                <div class="header"><h1>MuscleGrid</h1></div>
                <div class="content">
                    <h2>Get 3 Extra Months of Warranty!</h2>
                    <p>Dear {data.get('customer_name', 'Customer')},</p>
                    <p>Thank you for being a valued MuscleGrid customer! We'd love to hear about your experience.</p>
                    <p>Leave a review on Amazon and get <strong>3 months extra warranty</strong> on your {data.get('device_type', 'product')}!</p>
                    <p><strong>How it works:</strong></p>
                    <ol>
                        <li>Leave a review on Amazon for your MuscleGrid product</li>
                        <li>Take a screenshot of your review</li>
                        <li>Upload the screenshot in your customer portal</li>
                        <li>Get 3 months added to your warranty!</li>
                    </ol>
                    <p>Your current warranty expires: <strong>{data.get('warranty_end_date', 'N/A')}</strong></p>
                </div>
                <div class="footer">MuscleGrid CRM</div>
            </div>
            """
        ),
        "internal_hardware_ticket": (
            f"[Internal] Hardware Ticket - {data.get('ticket_number', '')}",
            f"""
            {base_style}
            <div class="container">
                <div class="header" style="background:#F97316;"><h1>Hardware Service Required</h1></div>
                <div class="content">
                    <h2>New Hardware Ticket for Processing</h2>
                    <table style="width:100%; border-collapse: collapse;">
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Ticket:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('ticket_number', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Customer:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('customer_name', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Phone:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('customer_phone', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Device:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('device_type', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Agent Notes:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('agent_notes', '')}</td></tr>
                    </table>
                </div>
                <div class="footer">MuscleGrid CRM - Internal Notification</div>
            </div>
            """
        ),
        "internal_label_uploaded": (
            f"[Internal] Label Uploaded - {data.get('dispatch_number', '')}",
            f"""
            {base_style}
            <div class="container">
                <div class="header" style="background:#16A34A;"><h1>Label Ready for Dispatch</h1></div>
                <div class="content">
                    <h2>Dispatch Ready</h2>
                    <table style="width:100%; border-collapse: collapse;">
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Dispatch:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('dispatch_number', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Customer:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('customer_name', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Courier:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('courier', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Tracking:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('tracking_id', '')}</td></tr>
                    </table>
                </div>
                <div class="footer">MuscleGrid CRM - Internal Notification</div>
            </div>
            """
        ),
        "internal_warranty_submitted": (
            f"[Internal] New Warranty Registration",
            f"""
            {base_style}
            <div class="container">
                <div class="header" style="background:#3B82F6;"><h1>New Warranty Registration</h1></div>
                <div class="content">
                    <h2>Warranty Pending Approval</h2>
                    <table style="width:100%; border-collapse: collapse;">
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Customer:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('customer_name', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Email:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('email', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Phone:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('phone', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Device:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('device_type', '')}</td></tr>
                        <tr><td style="padding:8px; border-bottom:1px solid #ddd;"><strong>Order ID:</strong></td><td style="padding:8px; border-bottom:1px solid #ddd;">{data.get('order_id', '')}</td></tr>
                    </table>
                </div>
                <div class="footer">MuscleGrid CRM - Internal Notification</div>
            </div>
            """
        ),
    }
    
    return templates.get(template_type, ("Notification", "<p>You have a new notification.</p>"))

async def notify_customer(email: str, template_type: str, data: dict, background_tasks: BackgroundTasks = None):
    """Send notification email to customer"""
    subject, html = get_email_template(template_type, data)
    if background_tasks:
        background_tasks.add_task(send_email_async, email, subject, html)
    else:
        await send_email_async(email, subject, html)

async def notify_internal(role: str, template_type: str, data: dict, background_tasks: BackgroundTasks = None):
    """Send notification to internal staff by role"""
    # Get all users with the specified role
    users = await db.users.find({"role": role}, {"_id": 0, "email": 1}).to_list(100)
    subject, html = get_email_template(template_type, data)
    
    for user in users:
        if background_tasks:
            background_tasks.add_task(send_email_async, user["email"], subject, html)
        else:
            await send_email_async(user["email"], subject, html)

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

def generate_campaign_id():
    return f"CMP-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
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
        "address": user_data.address,
        "city": user_data.city,
        "state": user_data.state,
        "pincode": user_data.pincode,
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
            address=user_data.address,
            city=user_data.city,
            state=user_data.state,
            pincode=user_data.pincode,
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
            address=user.get("address"),
            city=user.get("city"),
            state=user.get("state"),
            pincode=user.get("pincode"),
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
        address=user.get("address"),
        city=user.get("city"),
        state=user.get("state"),
        pincode=user.get("pincode"),
        created_at=user["created_at"]
    )

@api_router.patch("/auth/me")
async def update_profile(update_data: UserUpdate, user: dict = Depends(get_current_user)):
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field in ["first_name", "last_name", "phone", "address", "city", "state", "pincode"]:
        value = getattr(update_data, field)
        if value is not None:
            updates[field] = value
    
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated_user

# ==================== TICKET ROUTES ====================

@api_router.post("/tickets", response_model=TicketResponse)
async def create_ticket(ticket_data: TicketCreate, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    # Determine customer info
    if user["role"] == "customer":
        customer_id = user["id"]
        customer_name = f"{user['first_name']} {user['last_name']}"
        customer_phone = user["phone"]
        customer_email = user["email"]
        customer_address = f"{user.get('address', '')}, {user.get('city', '')}, {user.get('state', '')} - {user.get('pincode', '')}".strip(", -")
    elif ticket_data.customer_id and user["role"] in ["call_support", "admin"]:
        customer = await db.users.find_one({"id": ticket_data.customer_id}, {"_id": 0})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        customer_id = customer["id"]
        customer_name = f"{customer['first_name']} {customer['last_name']}"
        customer_phone = customer["phone"]
        customer_email = customer["email"]
        customer_address = f"{customer.get('address', '')}, {customer.get('city', '')}, {customer.get('state', '')} - {customer.get('pincode', '')}".strip(", -")
    else:
        customer_id = user["id"]
        customer_name = f"{user['first_name']} {user['last_name']}"
        customer_phone = user["phone"]
        customer_email = user["email"]
        customer_address = f"{user.get('address', '')}, {user.get('city', '')}, {user.get('state', '')} - {user.get('pincode', '')}".strip(", -")
    
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
        "customer_address": customer_address if customer_address else None,
        "device_type": ticket_data.device_type,
        "order_id": ticket_data.order_id,
        "issue_description": ticket_data.issue_description,
        "status": "open",
        "diagnosis": None,
        "issue_type": None,
        "agent_notes": None,
        "assigned_to": None,
        "assigned_to_name": None,
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
    
    # Send email notification to customer
    await notify_customer(customer_email, "ticket_created", {
        "customer_name": customer_name,
        "ticket_number": ticket_number,
        "device_type": ticket_data.device_type,
        "issue_description": ticket_data.issue_description
    }, background_tasks)
    
    return TicketResponse(**{k: v for k, v in ticket_doc.items() if k not in ["_id", "created_by"]})

@api_router.get("/tickets", response_model=List[TicketResponse])
async def get_tickets(
    status: Optional[str] = None,
    device_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    
    # Role-based filtering
    if user["role"] == "customer":
        query["customer_id"] = user["id"]
    elif user["role"] == "service_agent":
        query["assigned_to"] = user["id"]
    elif user["role"] == "call_support":
        query["$or"] = [
            {"status": {"$in": ["open", "in_progress", "diagnosed"]}},
            {"created_by": user["id"]}
        ]
    elif user["role"] == "accountant":
        query["status"] = {"$in": ["hardware_required", "pending_pickup", "pending_dispatch"]}
    
    # Apply filters
    if status:
        query["status"] = status
    if device_type:
        query["device_type"] = device_type
    if assigned_to:
        query["assigned_to"] = assigned_to
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to + "T23:59:59"
        else:
            query["created_at"] = {"$lte": date_to + "T23:59:59"}
    if search:
        query["$or"] = [
            {"ticket_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}},
            {"issue_description": {"$regex": search, "$options": "i"}}
        ]
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [TicketResponse(**t) for t in tickets]

@api_router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if user["role"] == "customer" and ticket["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return TicketResponse(**ticket)

@api_router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    update_data: TicketUpdate,
    background_tasks: BackgroundTasks,
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
        updates["assigned_to_name"] = assignee_name
        history_entries.append({
            "action": f"Assigned to {assignee_name}",
            "by": f"{user['first_name']} {user['last_name']}",
            "by_role": user["role"],
            "timestamp": now
        })
    
    if history_entries:
        await db.tickets.update_one(
            {"id": ticket_id},
            {"$set": updates, "$push": {"history": {"$each": history_entries}}}
        )
    
    # Send email notification to customer about update
    if update_data.status:
        await notify_customer(ticket["customer_email"], "ticket_updated", {
            "customer_name": ticket["customer_name"],
            "ticket_number": ticket["ticket_number"],
            "status": update_data.status,
            "diagnosis": update_data.diagnosis or ticket.get("diagnosis"),
            "agent_notes": update_data.agent_notes or ticket.get("agent_notes")
        }, background_tasks)
    
    updated_ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    return TicketResponse(**updated_ticket)

@api_router.post("/tickets/{ticket_id}/route-to-hardware")
async def route_to_hardware(
    ticket_id: str,
    background_tasks: BackgroundTasks,
    agent_notes: str = Form(...),
    user: dict = Depends(require_roles(["call_support", "service_agent", "admin"]))
):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
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
    
    # Notify customer
    await notify_customer(ticket["customer_email"], "hardware_service", {
        "customer_name": ticket["customer_name"],
        "ticket_number": ticket["ticket_number"],
        "device_type": ticket["device_type"],
        "agent_notes": agent_notes
    }, background_tasks)
    
    # Notify accountant
    await notify_internal("accountant", "internal_hardware_ticket", {
        "ticket_number": ticket["ticket_number"],
        "customer_name": ticket["customer_name"],
        "customer_phone": ticket["customer_phone"],
        "device_type": ticket["device_type"],
        "agent_notes": agent_notes
    }, background_tasks)
    
    return {"message": "Ticket routed to hardware service", "ticket_id": ticket_id}

# ==================== WARRANTY ROUTES ====================

@api_router.post("/warranties")
async def create_warranty(
    background_tasks: BackgroundTasks,
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
        "extension_requested": False,
        "extension_status": None,
        "extension_review_file": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.warranties.insert_one(warranty_doc)
    
    # Notify admin about new warranty registration
    await notify_internal("admin", "internal_warranty_submitted", {
        "customer_name": f"{first_name} {last_name}",
        "email": email,
        "phone": phone,
        "device_type": device_type,
        "order_id": order_id
    }, background_tasks)
    
    return {"message": "Warranty registration submitted", "warranty_id": warranty_id}

@api_router.get("/warranties", response_model=List[WarrantyResponse])
async def get_warranties(
    status: Optional[str] = None,
    device_type: Optional[str] = None,
    search: Optional[str] = None,
    warranty_expired: Optional[bool] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    
    if user["role"] == "customer":
        query["customer_id"] = user["id"]
    
    if status:
        query["status"] = status
    if device_type:
        query["device_type"] = device_type
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"order_id": {"$regex": search, "$options": "i"}}
        ]
    
    warranties = await db.warranties.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Filter by warranty expiry if requested
    if warranty_expired is not None:
        today = datetime.now(timezone.utc).date().isoformat()
        if warranty_expired:
            warranties = [w for w in warranties if w.get("warranty_end_date") and w["warranty_end_date"] < today]
        else:
            warranties = [w for w in warranties if w.get("warranty_end_date") and w["warranty_end_date"] >= today]
    
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
    background_tasks: BackgroundTasks,
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
    
    # Notify customer
    await notify_customer(warranty["email"], "warranty_approved", {
        "customer_name": f"{warranty['first_name']} {warranty['last_name']}",
        "device_type": warranty["device_type"],
        "warranty_end_date": approval.warranty_end_date
    }, background_tasks)
    
    return {"message": "Warranty approved", "warranty_id": warranty_id}

@api_router.patch("/warranties/{warranty_id}/reject")
async def reject_warranty(
    warranty_id: str,
    background_tasks: BackgroundTasks,
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
    
    # Notify customer
    await notify_customer(warranty["email"], "warranty_rejected", {
        "customer_name": f"{warranty['first_name']} {warranty['last_name']}",
        "admin_notes": notes
    }, background_tasks)
    
    return {"message": "Warranty rejected", "warranty_id": warranty_id}

# Warranty Extension - Upload Review Screenshot
@api_router.post("/warranties/{warranty_id}/request-extension")
async def request_warranty_extension(
    warranty_id: str,
    review_file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    warranty = await db.warranties.find_one({"id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    if user["role"] == "customer" and warranty["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if warranty["status"] != "approved":
        raise HTTPException(status_code=400, detail="Warranty must be approved before requesting extension")
    
    # Save review screenshot
    file_ext = review_file.filename.split('.')[-1] if review_file.filename else 'png'
    file_name = f"review_{warranty_id}.{file_ext}"
    file_path = UPLOAD_DIR / "reviews" / file_name
    
    with open(file_path, "wb") as f:
        content = await review_file.read()
        f.write(content)
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.warranties.update_one(
        {"id": warranty_id},
        {
            "$set": {
                "extension_requested": True,
                "extension_status": "pending",
                "extension_review_file": file_name,
                "extension_requested_at": now,
                "updated_at": now
            }
        }
    )
    
    return {"message": "Extension request submitted", "warranty_id": warranty_id}

@api_router.patch("/warranties/{warranty_id}/approve-extension")
async def approve_warranty_extension(
    warranty_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_roles(["admin"]))
):
    warranty = await db.warranties.find_one({"id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    if not warranty.get("extension_requested"):
        raise HTTPException(status_code=400, detail="No extension request pending")
    
    # Add 3 months to warranty
    current_end = datetime.fromisoformat(warranty["warranty_end_date"]) if warranty.get("warranty_end_date") else datetime.now(timezone.utc)
    new_end = current_end + timedelta(days=90)
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.warranties.update_one(
        {"id": warranty_id},
        {
            "$set": {
                "warranty_end_date": new_end.date().isoformat(),
                "extension_status": "approved",
                "extension_approved_at": now,
                "extension_approved_by": user["id"],
                "updated_at": now
            }
        }
    )
    
    # Notify customer
    await notify_customer(warranty["email"], "warranty_approved", {
        "customer_name": f"{warranty['first_name']} {warranty['last_name']}",
        "device_type": warranty["device_type"],
        "warranty_end_date": new_end.date().isoformat()
    }, background_tasks)
    
    return {"message": "Warranty extended by 3 months", "new_end_date": new_end.date().isoformat()}

@api_router.patch("/warranties/{warranty_id}/reject-extension")
async def reject_warranty_extension(
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
                "extension_status": "rejected",
                "extension_rejection_notes": notes,
                "updated_at": now
            }
        }
    )
    
    return {"message": "Extension rejected", "warranty_id": warranty_id}

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
        "city": dispatch_data.city,
        "state": dispatch_data.state,
        "pincode": dispatch_data.pincode,
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
    dispatch_type: str = Form(...),
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
    
    # Build address from customer or ticket
    address = ticket.get("customer_address") or ""
    if customer:
        if not address:
            address = f"{customer.get('address', '')}, {customer.get('city', '')}, {customer.get('state', '')} - {customer.get('pincode', '')}".strip(", -")
    
    dispatch_doc = {
        "id": dispatch_id,
        "dispatch_number": generate_dispatch_number(),
        "dispatch_type": dispatch_type,
        "sku": sku,
        "customer_name": ticket["customer_name"],
        "phone": ticket["customer_phone"],
        "address": address or "Address not provided",
        "city": customer.get("city") if customer else None,
        "state": customer.get("state") if customer else None,
        "pincode": customer.get("pincode") if customer else None,
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
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    
    if dispatch_type:
        query["dispatch_type"] = dispatch_type
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"dispatch_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"tracking_id": {"$regex": search, "$options": "i"}}
        ]
    
    dispatches = await db.dispatches.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [DispatchResponse(**d) for d in dispatches]

@api_router.patch("/dispatches/{dispatch_id}/label")
async def upload_dispatch_label(
    dispatch_id: str,
    background_tasks: BackgroundTasks,
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
    
    # Notify dispatcher
    await notify_internal("dispatcher", "internal_label_uploaded", {
        "dispatch_number": dispatch["dispatch_number"],
        "customer_name": dispatch["customer_name"],
        "courier": courier,
        "tracking_id": tracking_id
    }, background_tasks)
    
    return {"message": "Label uploaded", "dispatch_id": dispatch_id}

@api_router.patch("/dispatches/{dispatch_id}/status")
async def update_dispatch_status(
    dispatch_id: str,
    background_tasks: BackgroundTasks,
    status: str = Form(...),
    user: dict = Depends(require_roles(["accountant", "dispatcher", "admin"]))
):
    dispatch = await db.dispatches.find_one({"id": dispatch_id}, {"_id": 0})
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.dispatches.update_one(
        {"id": dispatch_id},
        {"$set": {"status": status, "updated_at": now}}
    )
    
    # If dispatched, update ticket and notify customer
    if status == "dispatched":
        if dispatch.get("ticket_id"):
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
        
        # Get customer email from ticket or dispatch
        customer_email = None
        if dispatch.get("ticket_id"):
            ticket = await db.tickets.find_one({"id": dispatch["ticket_id"]}, {"_id": 0, "customer_email": 1})
            if ticket:
                customer_email = ticket.get("customer_email")
        
        if customer_email:
            await notify_customer(customer_email, "dispatch_tracking", {
                "customer_name": dispatch["customer_name"],
                "dispatch_number": dispatch["dispatch_number"],
                "courier": dispatch.get("courier", ""),
                "tracking_id": dispatch.get("tracking_id", "")
            }, background_tasks)
    
    return {"message": f"Dispatch status updated to {status}", "dispatch_id": dispatch_id}

# Dispatcher Dashboard - Queue
@api_router.get("/dispatcher/queue")
async def get_dispatcher_queue(user: dict = Depends(get_current_user)):
    dispatches = await db.dispatches.find(
        {"status": {"$in": ["ready_to_dispatch", "dispatched"]}},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    return dispatches

# ==================== WARRANTY EXTENSION CAMPAIGN ROUTES ====================

@api_router.post("/campaigns")
async def create_campaign(
    campaign_data: CampaignCreate,
    user: dict = Depends(require_roles(["admin"]))
):
    campaign_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    campaign_doc = {
        "id": campaign_id,
        "campaign_code": generate_campaign_id(),
        "name": campaign_data.name,
        "description": campaign_data.description,
        "target_device_types": campaign_data.target_device_types,
        "max_sends": campaign_data.max_sends,
        "status": "running",
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.campaigns.insert_one(campaign_doc)
    
    return {"message": "Campaign created", "campaign_id": campaign_id}

@api_router.get("/campaigns")
async def get_campaigns(user: dict = Depends(require_roles(["admin"]))):
    campaigns = await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with stats
    result = []
    for campaign in campaigns:
        # Count warranties with extension pending
        query = {"status": "approved"}
        if campaign.get("target_device_types"):
            query["device_type"] = {"$in": campaign["target_device_types"]}
        
        total = await db.warranties.count_documents(query)
        pending = await db.warranties.count_documents({**query, "extension_status": "pending"})
        approved = await db.warranties.count_documents({**query, "extension_status": "approved"})
        
        result.append({
            **campaign,
            "total_customers": total,
            "pending_reviews": pending,
            "approved_reviews": approved
        })
    
    return result

@api_router.post("/campaigns/{campaign_id}/send-emails")
async def send_campaign_emails(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_roles(["admin"]))
):
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get approved warranties that haven't requested extension yet
    query = {
        "status": "approved",
        "extension_requested": {"$ne": True}
    }
    if campaign.get("target_device_types"):
        query["device_type"] = {"$in": campaign["target_device_types"]}
    
    warranties = await db.warranties.find(query, {"_id": 0}).to_list(1000)
    
    sent_count = 0
    for warranty in warranties:
        await notify_customer(warranty["email"], "warranty_extension", {
            "customer_name": f"{warranty['first_name']} {warranty['last_name']}",
            "device_type": warranty["device_type"],
            "warranty_end_date": warranty.get("warranty_end_date", "N/A")
        }, background_tasks)
        sent_count += 1
    
    return {"message": f"Campaign emails queued", "sent_count": sent_count}

@api_router.get("/campaigns/extension-requests")
async def get_extension_requests(user: dict = Depends(require_roles(["admin"]))):
    """Get all warranty extension requests pending review"""
    warranties = await db.warranties.find(
        {"extension_requested": True, "extension_status": "pending"},
        {"_id": 0}
    ).to_list(1000)
    
    return warranties

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/customers")
async def get_all_customers(
    search: Optional[str] = None,
    warranty_registered: Optional[bool] = None,
    warranty_expired: Optional[bool] = None,
    device_type: Optional[str] = None,
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
    today = datetime.now(timezone.utc).date().isoformat()
    
    for customer in customers:
        warranties = await db.warranties.find(
            {"customer_id": customer["id"]},
            {"_id": 0, "id": 1, "device_type": 1, "status": 1, "warranty_end_date": 1}
        ).to_list(100)
        
        tickets = await db.tickets.find(
            {"customer_id": customer["id"]},
            {"_id": 0, "id": 1, "ticket_number": 1, "status": 1, "device_type": 1}
        ).to_list(100)
        
        # Apply warranty filters
        if warranty_registered is not None:
            if warranty_registered and len(warranties) == 0:
                continue
            if not warranty_registered and len(warranties) > 0:
                continue
        
        if device_type:
            device_match = any(w.get("device_type") == device_type for w in warranties)
            if not device_match:
                continue
        
        if warranty_expired is not None:
            has_expired = any(
                w.get("warranty_end_date") and w["warranty_end_date"] < today 
                for w in warranties if w.get("status") == "approved"
            )
            if warranty_expired and not has_expired:
                continue
            if not warranty_expired and has_expired:
                continue
        
        result.append({
            **customer,
            "warranties": warranties,
            "tickets": tickets
        })
    
    return result

@api_router.patch("/admin/customers/{customer_id}")
async def update_customer(
    customer_id: str,
    update_data: UserUpdate,
    user: dict = Depends(require_roles(["admin"]))
):
    customer = await db.users.find_one({"id": customer_id, "role": "customer"}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field in ["first_name", "last_name", "phone", "address", "city", "state", "pincode"]:
        value = getattr(update_data, field)
        if value is not None:
            updates[field] = value
    
    await db.users.update_one({"id": customer_id}, {"$set": updates})
    
    return {"message": "Customer updated", "customer_id": customer_id}

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
        "address": user_data.address,
        "city": user_data.city,
        "state": user_data.state,
        "pincode": user_data.pincode,
        "password_hash": hash_password(user_data.password),
        "created_by": admin["id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    return {"message": "User created", "user_id": user_id}

# Customer Import from CSV
@api_router.post("/admin/customers/import")
async def import_customers(
    csv_file: UploadFile = File(...),
    user: dict = Depends(require_roles(["admin"]))
):
    content = await csv_file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    skipped = 0
    errors = []
    
    now = datetime.now(timezone.utc).isoformat()
    
    for row in reader:
        try:
            # Check for duplicate phone
            phone = row.get('phone', row.get('Phone', '')).strip()
            if not phone:
                errors.append(f"Row missing phone number")
                skipped += 1
                continue
            
            existing = await db.users.find_one({"phone": phone})
            if existing:
                skipped += 1
                continue
            
            # Create customer
            user_id = str(uuid.uuid4())
            
            # Try to get name parts
            name = row.get('name', row.get('Name', '')).strip()
            first_name = row.get('first_name', row.get('First Name', '')).strip()
            last_name = row.get('last_name', row.get('Last Name', '')).strip()
            
            if not first_name and name:
                parts = name.split(' ', 1)
                first_name = parts[0]
                last_name = parts[1] if len(parts) > 1 else ''
            
            user_doc = {
                "id": user_id,
                "email": row.get('email', row.get('Email', '')).strip() or f"imported_{user_id[:8]}@temp.local",
                "first_name": first_name or "Customer",
                "last_name": last_name or "",
                "phone": phone,
                "role": "customer",
                "address": row.get('address', row.get('Address', '')).strip(),
                "city": row.get('city', row.get('City', '')).strip(),
                "state": row.get('state', row.get('State', '')).strip(),
                "pincode": row.get('pincode', row.get('Pincode', row.get('PIN', ''))).strip(),
                "password_hash": hash_password("imported123"),
                "source": "csv_import",
                "created_at": now,
                "updated_at": now
            }
            
            await db.users.insert_one(user_doc)
            imported += 1
            
        except Exception as e:
            errors.append(str(e))
            skipped += 1
    
    return {
        "message": "Import completed",
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:10]  # Return first 10 errors
    }

# Dashboard Stats
@api_router.get("/admin/stats")
async def get_admin_stats(user: dict = Depends(require_roles(["admin"]))):
    total_customers = await db.users.count_documents({"role": "customer"})
    total_tickets = await db.tickets.count_documents({})
    open_tickets = await db.tickets.count_documents({"status": {"$in": ["open", "in_progress"]}})
    pending_warranties = await db.warranties.count_documents({"status": "pending"})
    pending_dispatches = await db.dispatches.count_documents({"status": "pending_label"})
    pending_extensions = await db.warranties.count_documents({"extension_status": "pending"})
    
    return {
        "total_customers": total_customers,
        "total_tickets": total_tickets,
        "open_tickets": open_tickets,
        "pending_warranties": pending_warranties,
        "pending_dispatches": pending_dispatches,
        "pending_extensions": pending_extensions
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

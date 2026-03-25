"""
MuscleGrid CRM - Enterprise Grade Support System
Version 2.0 - Full Featured Production Ready
"""

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from io import BytesIO
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
import secrets
from starlette.requests import Request

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ['JWT_SECRET']
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

# User Roles (added supervisor)
ROLES = ["customer", "call_support", "supervisor", "service_agent", "accountant", "dispatcher", "admin", "gate", "technician"]

# Support Types
SUPPORT_TYPES = ["phone", "hardware"]

# Ticket Statuses with full lifecycle (added supervisor statuses)
TICKET_STATUSES = [
    "new_request",           # Just created
    "call_support_followup", # Call support is handling
    "escalated_to_supervisor", # Escalated to supervisor
    "supervisor_followup",   # Supervisor is handling
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
    "closed",               # Fully resolved
    "customer_escalated"    # Customer escalated due to no update
]

# SLA Configuration (in hours)
SLA_CONFIG = {
    "support": 48,      # Support agent SLA
    "supervisor": 48,   # Supervisor SLA
    "accountant": 48,   # Accountant SLA
    "technician": 72,   # Technician SLA (repair)
    "phone": {
        "first_response": 4,
        "resolution": 48
    },
    "hardware": {
        "first_response": 24,
        "repair": 72,
        "total": 48  # 48 hours for accountant to arrange pickup
    }
}

DEVICE_TYPES = ["Inverter", "Battery", "Stabilizer", "Others"]
WARRANTY_STATUSES = ["pending", "approved", "rejected"]
DISPATCH_TYPES = ["outbound", "reverse_pickup", "return_dispatch", "spare_dispatch", "new_order", "amazon_order", "part_dispatch"]
GATE_SCAN_TYPES = ["inward", "outward"]

# Minimum notes length for escalation
MIN_NOTES_LENGTH = 100

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
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    customer_city: Optional[str] = None
    device_type: Optional[str] = None
    product_name: Optional[str] = None
    serial_number: Optional[str] = None
    invoice_number: Optional[str] = None
    order_id: Optional[str] = None
    invoice_file: Optional[str] = None
    issue_description: Optional[str] = None
    support_type: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    diagnosis: Optional[str] = None
    agent_notes: Optional[str] = None
    repair_notes: Optional[str] = None
    escalation_notes: Optional[str] = None
    supervisor_notes: Optional[str] = None
    supervisor_action: Optional[str] = None
    supervisor_sku: Optional[str] = None
    accountant_decision: Optional[str] = None
    escalated_by: Optional[str] = None
    escalated_by_name: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    pickup_label: Optional[str] = None
    pickup_label_url: Optional[str] = None
    pickup_courier: Optional[str] = None
    pickup_tracking: Optional[str] = None
    return_label: Optional[str] = None
    return_courier: Optional[str] = None
    return_tracking: Optional[str] = None
    service_charges: Optional[float] = None
    service_invoice: Optional[str] = None
    sla_due: Optional[str] = None
    sla_breached: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
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
    customer_id: Optional[str] = None
    user_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    device_type: Optional[str] = None
    product_name: Optional[str] = None
    serial_number: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_amount: Optional[float] = None
    order_id: Optional[str] = None
    invoice_file: Optional[str] = None
    status: Optional[str] = None
    warranty_end_date: Optional[str] = None
    admin_notes: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
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
    order_id: Optional[str] = None
    payment_reference: Optional[str] = None

class DispatchResponse(BaseModel):
    id: str
    dispatch_number: str
    dispatch_type: str
    ticket_id: Optional[str] = None
    ticket_number: Optional[str] = None
    sku: Optional[str] = None
    sku_name: Optional[str] = None
    firm_id: Optional[str] = None
    firm_name: Optional[str] = None
    is_manufactured_item: Optional[bool] = False
    master_sku_id: Optional[str] = None
    master_sku_name: Optional[str] = None
    serial_number: Optional[str] = None
    customer_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    reason: Optional[str] = None
    note: Optional[str] = None
    order_id: Optional[str] = None
    payment_reference: Optional[str] = None
    invoice_url: Optional[str] = None
    courier: Optional[str] = None
    tracking_id: Optional[str] = None
    label_file: Optional[str] = None
    status: str
    pending_fulfillment_id: Optional[str] = None
    service_charges: Optional[float] = None
    service_invoice: Optional[str] = None
    stock_deducted: Optional[bool] = False
    ledger_entry_id: Optional[str] = None
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    scanned_in_at: Optional[str] = None
    scanned_out_at: Optional[str] = None
    original_ticket_info: Optional[dict] = None
    courier_update_count: Optional[int] = 0

# SKU/Inventory Models
class SKUCreate(BaseModel):
    sku_code: str
    model_name: str
    category: str  # Inverter, Battery, Stabilizer, Spare Part
    stock_quantity: int = 0
    min_stock_alert: int = 5
    firm_id: Optional[str] = None  # Link to firm for multi-firm inventory

class SKUUpdate(BaseModel):
    model_name: Optional[str] = None
    category: Optional[str] = None
    stock_quantity: Optional[int] = None
    min_stock_alert: Optional[int] = None
    active: Optional[bool] = None
    firm_id: Optional[str] = None

class SKUResponse(BaseModel):
    id: str
    sku_code: str
    model_name: str
    category: str
    stock_quantity: int
    min_stock_alert: int
    active: bool
    firm_id: Optional[str] = None
    firm_name: Optional[str] = None
    created_at: str
    updated_at: str

# ==================== MULTI-FIRM INVENTORY MODELS ====================

# Firm Models
class FirmCreate(BaseModel):
    name: str
    gstin: str
    address: str
    state: str
    pincode: str
    contact_person: str
    phone: Optional[str] = None
    email: Optional[str] = None

class FirmUpdate(BaseModel):
    name: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None

class FirmResponse(BaseModel):
    id: str
    name: str
    gstin: str
    address: str
    state: str
    pincode: str
    contact_person: str
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str

# Raw Material Models (Global definitions - stock tracked per-firm via ledger)
class RawMaterialCreate(BaseModel):
    name: str
    sku_code: str
    unit: str  # pcs, kg, litre, etc.
    hsn_code: str  # Made mandatory
    gst_rate: float  # Mandatory: 0, 5, 12, 18, 28
    cost_price: float  # Mandatory: unit cost for valuation
    reorder_level: int = 10
    description: Optional[str] = None

class RawMaterialUpdate(BaseModel):
    name: Optional[str] = None
    sku_code: Optional[str] = None
    unit: Optional[str] = None
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None
    cost_price: Optional[float] = None
    reorder_level: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class RawMaterialResponse(BaseModel):
    id: str
    name: str
    sku_code: str
    unit: str
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None
    cost_price: Optional[float] = None
    reorder_level: int
    description: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str
    # Stock per firm (computed)
    stock_by_firm: Optional[List[dict]] = None
    total_stock: Optional[int] = None

# Master SKU Models (Company-wide product definition)
class SKUAlias(BaseModel):
    alias_code: str        # Platform-specific SKU code (e.g., AMZ-INV-001)
    platform: str          # Platform name (Amazon, Flipkart, Website, etc.)
    notes: Optional[str] = None

class BOMItem(BaseModel):
    raw_material_id: str
    quantity: int          # Quantity needed per unit of finished good

class MasterSKUCreate(BaseModel):
    name: str                          # Product name
    sku_code: str                      # Primary/internal SKU code
    category: str                      # Inverter, Battery, Stabilizer, Spare Part
    hsn_code: str                      # Mandatory HSN code
    gst_rate: float                    # Mandatory: 0, 5, 12, 18, 28
    cost_price: float                  # Mandatory: unit cost for valuation
    unit: str = "pcs"
    is_manufactured: bool = False      # True if made from raw materials
    product_type: Optional[str] = None  # "manufactured" or "traded"
    manufacturing_role: Optional[str] = None  # "supervisor", "technician", or "none"
    production_charge_per_unit: Optional[float] = None  # Contractor charge for supervisor-made SKUs
    bill_of_materials: Optional[List[BOMItem]] = None  # Recipe for manufacturing
    aliases: Optional[List[SKUAlias]] = None           # Platform-specific SKU codes
    reorder_level: int = 10
    description: Optional[str] = None

class MasterSKUUpdate(BaseModel):
    name: Optional[str] = None
    sku_code: Optional[str] = None
    category: Optional[str] = None
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None   # GST rate: 0, 5, 12, 18, 28
    unit: Optional[str] = None
    is_manufactured: Optional[bool] = None
    product_type: Optional[str] = None  # "manufactured" or "traded"
    manufacturing_role: Optional[str] = None  # "supervisor", "technician", or "none"
    production_charge_per_unit: Optional[float] = None
    bill_of_materials: Optional[List[BOMItem]] = None
    aliases: Optional[List[SKUAlias]] = None
    reorder_level: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    cost_price: Optional[float] = None  # For WAC calculation

class MasterSKUResponse(BaseModel):
    id: str
    name: str
    sku_code: str
    category: str
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = 18.0
    unit: str
    is_manufactured: bool
    product_type: Optional[str] = None
    manufacturing_role: Optional[str] = None
    production_charge_per_unit: Optional[float] = None
    bill_of_materials: Optional[List[dict]] = None
    aliases: Optional[List[dict]] = None
    reorder_level: int
    description: Optional[str] = None
    is_active: bool
    cost_price: Optional[float] = None
    created_at: str
    updated_at: str

# Inventory Ledger Models
LEDGER_ENTRY_TYPES = [
    "purchase",
    "transfer_in",
    "transfer_out",
    "adjustment_in",
    "adjustment_out",
    "dispatch_out",      # Stock deduction when dispatch is marked as dispatched
    "return_in",         # Stock increment when return is classified and received
    "repair_yard_in",    # Controlled inward for recovered/repair-yard stock
    "production_consume", # Raw material consumed for production
    "production_output"   # Finished good produced
]

# Incoming Queue Classification Types
INCOMING_CLASSIFICATION_TYPES = [
    "repair_item",       # Link to ticket, send to technician queue, no stock
    "return_inventory",  # Assign firm, SKU, qty -> return_in ledger entry
    "repair_yard",       # Assign firm, SKU, qty, reason -> repair_yard_in ledger entry
    "scrap"              # Mark as scrap, no inventory addition
]

# Production Request Statuses
PRODUCTION_REQUEST_STATUSES = [
    "requested",           # Accountant created the request
    "accepted",            # Manufacturer accepted the job
    "in_progress",         # Manufacturing started
    "completed",           # Manufacturing done, serial numbers submitted
    "received_into_inventory",  # Accountant confirmed receipt, inventory updated
    "cancelled"            # Request cancelled
]

# ==================== PRODUCTION MODULE MODELS ====================

class ProductionRequestCreate(BaseModel):
    firm_id: str
    master_sku_id: str
    quantity_requested: int
    production_date: Optional[str] = None  # Target date
    remarks: Optional[str] = None

class ProductionRequestUpdate(BaseModel):
    status: Optional[str] = None
    remarks: Optional[str] = None
    completion_notes: Optional[str] = None

class SerialNumberEntry(BaseModel):
    serial_number: str
    notes: Optional[str] = None

class ProductionCompletionData(BaseModel):
    serial_numbers: List[SerialNumberEntry]
    completion_notes: Optional[str] = None

class SupervisorPayableUpdate(BaseModel):
    status: str  # "unpaid", "part_paid", "paid"
    amount_paid: Optional[float] = None
    payment_reference: Optional[str] = None
    remarks: Optional[str] = None

# Pending Fulfillment Queue Models (for Amazon orders awaiting stock)
PENDING_FULFILLMENT_STATUSES = [
    "awaiting_stock",     # Label created, waiting for stock
    "ready_to_dispatch",  # Stock available, can dispatch
    "dispatched",         # Item dispatched
    "cancelled",          # Order cancelled
    "expired"             # Label expired
]

class PendingFulfillmentCreate(BaseModel):
    order_id: str
    tracking_id: str
    firm_id: str
    master_sku_id: str
    quantity: int = 1
    label_expiry_days: int = 5  # Default 5 days
    notes: Optional[str] = None

class PendingFulfillmentUpdate(BaseModel):
    tracking_id: Optional[str] = None  # For regeneration
    notes: Optional[str] = None

class TrackingHistoryEntry(BaseModel):
    tracking_id: str
    created_at: str
    expired_at: Optional[str] = None
    status: str  # "active", "expired", "replaced"

class PendingFulfillmentResponse(BaseModel):
    id: str
    order_id: str
    tracking_id: str
    firm_id: str
    firm_name: Optional[str] = None
    master_sku_id: str
    master_sku_name: Optional[str] = None
    sku_code: Optional[str] = None
    quantity: int
    label_created_at: str
    label_expiry_date: str
    status: str
    current_stock: Optional[int] = None
    is_label_expired: bool = False
    is_label_expiring_soon: bool = False  # Within 24 hours
    tracking_history: Optional[List[dict]] = None
    dispatched_at: Optional[str] = None
    dispatch_id: Optional[str] = None
    created_by: str
    created_by_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str

class LedgerEntryCreate(BaseModel):
    entry_type: str  # One of LEDGER_ENTRY_TYPES
    item_type: str  # "raw_material" or "finished_good"
    item_id: str
    firm_id: str
    quantity: int
    unit_price: Optional[float] = None
    invoice_number: Optional[str] = None
    reason: Optional[str] = None
    reference_id: Optional[str] = None  # For transfers, link to related entry
    notes: Optional[str] = None

class LedgerEntryResponse(BaseModel):
    id: str
    entry_number: str
    entry_type: str
    item_type: str
    item_id: str
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    firm_id: str
    firm_name: Optional[str] = None
    quantity: int
    running_balance: int
    unit_price: Optional[float] = None
    total_value: Optional[float] = None
    invoice_number: Optional[str] = None
    reason: Optional[str] = None
    reference_id: Optional[str] = None
    notes: Optional[str] = None
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str

# Stock Transfer Models
class StockTransferCreate(BaseModel):
    item_type: str  # "raw_material", "finished_good", or "master_sku"
    item_id: str
    from_firm_id: str
    to_firm_id: str
    quantity: int
    invoice_number: str  # MANDATORY for GST compliance
    notes: Optional[str] = None
    serial_numbers: Optional[List[str]] = None  # For manufactured items

class StockTransferResponse(BaseModel):
    id: str
    transfer_number: str
    item_type: str
    item_id: str
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    from_firm_id: str
    from_firm_name: Optional[str] = None
    to_firm_id: str
    to_firm_name: Optional[str] = None
    quantity: int
    invoice_number: str
    notes: Optional[str] = None
    ledger_out_id: str
    ledger_in_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str

# Production Models
class ProductionMaterialInput(BaseModel):
    material_id: str  # Raw material ID
    quantity: int     # Quantity to consume

class ProductionCreate(BaseModel):
    firm_id: str
    output_sku_id: str           # Master SKU ID to produce (must have is_manufactured=true)
    output_quantity: int         # Quantity of finished good to produce
    use_bom: bool = True         # If true, auto-calculate materials from BOM
    materials: Optional[List[ProductionMaterialInput]] = None  # Only needed if use_bom=false
    batch_number: Optional[str] = None
    notes: Optional[str] = None

class ProductionResponse(BaseModel):
    id: str
    production_number: str
    firm_id: str
    firm_name: Optional[str] = None
    output_sku_id: str
    output_sku_name: Optional[str] = None
    output_sku_code: Optional[str] = None
    output_quantity: int
    materials_consumed: List[dict]
    batch_number: Optional[str] = None
    notes: Optional[str] = None
    ledger_entries: List[str]   # IDs of all ledger entries created
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str

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

# ==================== INCOMING INVENTORY QUEUE MODELS ====================

class IncomingQueueCreate(BaseModel):
    tracking_id: str
    courier: Optional[str] = None
    notes: Optional[str] = None
    source: str = "gate_scan"  # gate_scan, manual_entry

class IncomingQueueClassify(BaseModel):
    classification_type: str  # repair_item, return_inventory, repair_yard, scrap
    # For repair_item
    ticket_id: Optional[str] = None
    # For return_inventory and repair_yard
    firm_id: Optional[str] = None
    item_type: Optional[str] = None  # raw_material or finished_good
    item_id: Optional[str] = None
    sku_code: Optional[str] = None  # Alternative to item_id
    quantity: Optional[int] = 1
    # For return_inventory - link to original dispatch
    original_dispatch_id: Optional[str] = None
    # For repair_yard
    reason: Optional[str] = None
    reference_number: Optional[str] = None
    # For scrap
    scrap_reason: Optional[str] = None
    # Common
    remarks: Optional[str] = None

class IncomingQueueResponse(BaseModel):
    id: str
    queue_number: str
    tracking_id: Optional[str] = None
    courier: Optional[str] = None
    source: str
    gate_log_id: Optional[str] = None
    # Linked references from gate scan
    linked_ticket_id: Optional[str] = None
    linked_ticket_number: Optional[str] = None
    linked_dispatch_id: Optional[str] = None
    linked_dispatch_number: Optional[str] = None
    customer_name: Optional[str] = None
    # Classification
    status: str  # pending, classified, processed
    classification_type: Optional[str] = None
    # Classification details
    classified_firm_id: Optional[str] = None
    classified_firm_name: Optional[str] = None
    classified_item_type: Optional[str] = None
    classified_item_id: Optional[str] = None
    classified_item_name: Optional[str] = None
    classified_item_sku: Optional[str] = None
    classified_quantity: Optional[int] = None
    classified_ticket_id: Optional[str] = None
    original_dispatch_id: Optional[str] = None
    original_dispatch_number: Optional[str] = None
    reason: Optional[str] = None
    reference_number: Optional[str] = None
    scrap_reason: Optional[str] = None
    remarks: Optional[str] = None
    # Ledger reference
    ledger_entry_id: Optional[str] = None
    ledger_entry_number: Optional[str] = None
    # Audit
    scanned_by: Optional[str] = None
    scanned_by_name: Optional[str] = None
    scanned_at: Optional[str] = None
    classified_by: Optional[str] = None
    classified_by_name: Optional[str] = None
    classified_at: Optional[str] = None
    created_at: str
    updated_at: str

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

# ==================== APPOINTMENT BOOKING MODELS ====================

class AppointmentCreate(BaseModel):
    date: str  # YYYY-MM-DD
    time_slot: str  # HH:MM (e.g., "09:00", "09:30")
    reason: str
    warranty_id: Optional[str] = None

class AppointmentResponse(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    supervisor_id: str
    supervisor_name: str
    date: str
    time_slot: str
    end_time: str
    reason: str
    warranty_id: Optional[str] = None
    status: str  # pending, confirmed, completed, cancelled, no_show
    notes: Optional[str] = None
    created_at: str
    updated_at: str

class AvailabilitySlot(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    is_available: bool = True

class SupervisorAvailabilityUpdate(BaseModel):
    slots: List[AvailabilitySlot]
    blocked_dates: Optional[List[str]] = []  # List of YYYY-MM-DD dates

# ==================== FEEDBACK SURVEY MODELS ====================

class FeedbackSubmit(BaseModel):
    ticket_id: Optional[str] = None
    appointment_id: Optional[str] = None
    communication: int  # 1-10
    resolution_speed: int  # 1-10
    professionalism: int  # 1-10
    overall: int  # 1-10
    comments: Optional[str] = None

class FeedbackResponse(BaseModel):
    id: str
    ticket_id: Optional[str] = None
    ticket_number: Optional[str] = None
    appointment_id: Optional[str] = None
    customer_id: str
    customer_name: str
    staff_id: Optional[str] = None
    staff_name: Optional[str] = None
    staff_role: Optional[str] = None
    communication: int
    resolution_speed: int
    professionalism: int
    overall: int
    average_score: float
    comments: Optional[str] = None
    feedback_type: str  # ticket, appointment
    created_at: str

# Notification Models
class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "info"  # info, success, warning, error, action_required
    link: Optional[str] = None
    target_roles: Optional[List[str]] = None  # If None, all roles
    target_user_ids: Optional[List[str]] = None  # Specific users
    priority: str = "normal"  # low, normal, high, urgent

class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    type: str
    link: Optional[str] = None
    priority: str
    is_read: bool = False
    created_at: str
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None

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

def generate_ledger_entry_number():
    """Generate ledger entry number: MG-L-YYYYMMDD-XXXXX"""
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = ''.join(random.choices(string.digits, k=5))
    return f"MG-L-{date_str}-{random_part}"

def generate_transfer_number():
    """Generate transfer number: MG-T-YYYYMMDD-XXXXX"""
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = ''.join(random.choices(string.digits, k=5))
    return f"MG-T-{date_str}-{random_part}"

def generate_firm_code():
    """Generate firm code: FIRM-XXXXX"""
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"FIRM-{random_part}"

def generate_queue_number():
    """Generate incoming queue number: MG-IQ-YYYYMMDD-XXXXX"""
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = ''.join(random.choices(string.digits, k=5))
    return f"MG-IQ-{date_str}-{random_part}"

async def create_notification(
    title: str,
    message: str,
    notification_type: str = "info",
    link: Optional[str] = None,
    target_roles: Optional[List[str]] = None,
    target_user_ids: Optional[List[str]] = None,
    priority: str = "normal",
    created_by: Optional[str] = None,
    created_by_name: Optional[str] = None
):
    """Create a notification for users"""
    now = datetime.now(timezone.utc).isoformat()
    notification_id = str(uuid.uuid4())
    
    notification_doc = {
        "id": notification_id,
        "title": title,
        "message": message,
        "type": notification_type,
        "link": link,
        "target_roles": target_roles,  # None means all
        "target_user_ids": target_user_ids,  # Specific users
        "priority": priority,
        "read_by": [],  # List of user IDs who have read this
        "created_by": created_by,
        "created_by_name": created_by_name,
        "created_at": now
    }
    
    await db.notifications.insert_one(notification_doc)
    return notification_id

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

async def log_activity(action: str, entity_type: str, entity_id: str, user: dict, details: dict = None):
    """Log activity to audit_logs collection"""
    now = datetime.now(timezone.utc)
    log_entry = {
        "id": str(uuid.uuid4()),
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "user_id": user["id"],
        "user_name": f"{user['first_name']} {user['last_name']}",
        "user_role": user["role"],
        "details": details or {},
        "created_at": now.isoformat()
    }
    await db.audit_logs.insert_one(log_entry)

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

@api_router.get("/tickets/check-duplicate")
async def check_duplicate_ticket(
    serial_number: Optional[str] = None,
    order_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Check if customer has an existing open ticket for the same product"""
    if not serial_number and not order_id:
        return {"has_duplicate": False}
    
    cust_id = user["id"] if user["role"] == "customer" else None
    if not cust_id:
        return {"has_duplicate": False}
    
    open_statuses = ["new_request", "call_support_followup", "escalated_to_supervisor", 
                    "supervisor_followup", "hardware_service", "awaiting_label", 
                    "label_uploaded", "pickup_scheduled", "received_at_factory", 
                    "in_repair", "repair_completed", "service_invoice_added", "ready_for_dispatch"]
    
    query = {"customer_id": cust_id, "status": {"$in": open_statuses}}
    
    if serial_number:
        query["serial_number"] = serial_number
        existing = await db.tickets.find_one(query, {"_id": 0, "ticket_number": 1, "status": 1})
        if existing:
            return {
                "has_duplicate": True,
                "ticket_number": existing["ticket_number"],
                "status": existing["status"],
                "message": f"You already have an open ticket ({existing['ticket_number']}) for this serial number."
            }
    
    if order_id:
        query.pop("serial_number", None)
        query["order_id"] = order_id
        existing = await db.tickets.find_one(query, {"_id": 0, "ticket_number": 1, "status": 1})
        if existing:
            return {
                "has_duplicate": True,
                "ticket_number": existing["ticket_number"],
                "status": existing["status"],
                "message": f"You already have an open ticket ({existing['ticket_number']}) for this order."
            }
    
    return {"has_duplicate": False}

@api_router.post("/tickets")
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
    
    # DUPLICATE TICKET PREVENTION
    # Check if customer already has an open ticket for the same serial number or order_id
    if serial_number or order_id:
        open_statuses = ["new_request", "call_support_followup", "escalated_to_supervisor", 
                        "supervisor_followup", "hardware_service", "awaiting_label", 
                        "label_uploaded", "pickup_scheduled", "received_at_factory", 
                        "in_repair", "repair_completed", "service_invoice_added", "ready_for_dispatch"]
        
        duplicate_query = {
            "customer_id": cust_id,
            "status": {"$in": open_statuses}
        }
        
        # Check by serial number or order_id
        if serial_number:
            duplicate_query["serial_number"] = serial_number
            existing = await db.tickets.find_one(duplicate_query, {"_id": 0})
            if existing:
                raise HTTPException(
                    status_code=400, 
                    detail=f"You already have an open ticket ({existing['ticket_number']}) for this serial number. Please wait for it to be resolved."
                )
        
        if order_id:
            duplicate_query.pop("serial_number", None)
            duplicate_query["order_id"] = order_id
            existing = await db.tickets.find_one(duplicate_query, {"_id": 0})
            if existing:
                raise HTTPException(
                    status_code=400, 
                    detail=f"You already have an open ticket ({existing['ticket_number']}) for this order. Please wait for it to be resolved."
                )
    
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
    
    # Create notification for new ticket
    await create_notification(
        title="New Ticket Created",
        message=f"Ticket {ticket_number} created for {ticket_doc['customer_name']} ({ticket_doc['support_type']})",
        notification_type="info",
        link=f"/support/ticket/{ticket_id}",
        target_roles=["call_support", "admin", "supervisor"],
        priority="normal"
    )
    
    # Remove _id before returning
    ticket_doc.pop("_id", None)
    return ticket_doc

@api_router.get("/tickets")
async def list_tickets(
    search: Optional[str] = None,
    status: Optional[str] = None,
    support_type: Optional[str] = None,
    device_type: Optional[str] = None,
    assigned_to: Optional[str] = None,
    sla_breached: Optional[bool] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    view_as: Optional[str] = None,  # Allow admin to view as specific role
    limit: int = 100,
    skip: int = 0,
    user: dict = Depends(get_current_user)
):
    """List tickets with filters"""
    query = {}
    
    # Determine effective role (admin can view as other roles)
    effective_role = user["role"]
    if user["role"] == "admin" and view_as:
        effective_role = view_as
    
    # Role-based filtering (admin sees all without default filters)
    if effective_role == "customer":
        query["customer_id"] = user["id"]
    elif effective_role == "service_agent":
        if user["role"] != "admin":
            query["assigned_to"] = user["id"]
    elif effective_role == "call_support":
        # Call support should see ALL tickets for customer communication
        # No default filter - they need visibility across all departments
        pass
    elif effective_role == "accountant":
        # Accountant sees tickets needing their action and tickets they've worked on
        query["status"] = {"$in": [
            "hardware_service",      # Needs decision (reverse pickup or spare)
            "awaiting_label",        # Needs pickup label upload
            "label_uploaded",        # Label uploaded, waiting for pickup
            "repair_completed",      # Repair done, needs invoice
            "service_invoice_added"  # Invoice added, ready for dispatch
        ]}
    # admin role has no default filter - sees all tickets
    
    # Apply filters
    if search:
        query["$or"] = [
            {"ticket_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}},
            {"customer_email": {"$regex": search, "$options": "i"}},
            {"serial_number": {"$regex": search, "$options": "i"}},
            {"invoice_number": {"$regex": search, "$options": "i"}},
            {"order_id": {"$regex": search, "$options": "i"}}
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
    
    # Update SLA breach status and convert datetime objects to strings
    for ticket in tickets:
        # Convert datetime objects to ISO strings for JSON serialization
        for key in ["created_at", "updated_at", "closed_at", "received_at", "repaired_at", "dispatched_at", "sla_due"]:
            if key in ticket and ticket[key] is not None:
                if hasattr(ticket[key], 'isoformat'):
                    ticket[key] = ticket[key].isoformat()
        
        if ticket.get("sla_due"):
            try:
                sla_due = datetime.fromisoformat(str(ticket["sla_due"]).replace('Z', '+00:00'))
                ticket["sla_breached"] = is_sla_breached(sla_due, ticket.get("status", ""))
            except:
                pass
    
    return tickets

@api_router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    """Get ticket details"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Permission check
    if user["role"] == "customer" and ticket.get("customer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Convert datetime objects to ISO strings for JSON serialization
    for key in ["created_at", "updated_at", "closed_at", "received_at", "repaired_at", "dispatched_at", "sla_due"]:
        if key in ticket and ticket[key] is not None:
            if hasattr(ticket[key], 'isoformat'):
                ticket[key] = ticket[key].isoformat()
    
    # Convert datetime in history entries
    if "history" in ticket:
        for entry in ticket["history"]:
            if "timestamp" in entry and hasattr(entry["timestamp"], 'isoformat'):
                entry["timestamp"] = entry["timestamp"].isoformat()
    
    # Update SLA breach status
    if ticket.get("sla_due"):
        try:
            sla_due = datetime.fromisoformat(str(ticket["sla_due"]).replace('Z', '+00:00'))
            ticket["sla_breached"] = is_sla_breached(sla_due, ticket.get("status", ""))
        except:
            pass
    
    return ticket

@api_router.patch("/tickets/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    update_data: TicketUpdate,
    user: dict = Depends(require_roles(["call_support", "supervisor", "service_agent", "accountant", "admin"]))
):
    """Update ticket - Support agents, Supervisor, Technicians, Accountants"""
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
    return updated_ticket

@api_router.post("/tickets/{ticket_id}/escalate-to-supervisor")
async def escalate_to_supervisor(
    ticket_id: str,
    notes: str = Form(...),
    user: dict = Depends(require_roles(["call_support", "admin"]))
):
    """Support agent escalates ticket to supervisor - notes must be 100+ chars"""
    if len(notes) < MIN_NOTES_LENGTH:
        raise HTTPException(status_code=400, detail=f"Notes must be at least {MIN_NOTES_LENGTH} characters")
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc)
    sla_due = now + timedelta(hours=SLA_CONFIG["supervisor"])
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "status": "escalated_to_supervisor",
            "escalation_notes": notes,
            "escalated_by": user["id"],
            "escalated_by_name": f"{user['first_name']} {user['last_name']}",
            "escalated_at": now.isoformat(),
            "sla_due": sla_due.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    await add_ticket_history(ticket_id, "Escalated to supervisor", user, {"notes": notes})
    
    return {"message": "Ticket escalated to supervisor", "new_status": "escalated_to_supervisor"}

@api_router.post("/tickets/{ticket_id}/supervisor-action")
async def supervisor_action(
    ticket_id: str,
    action: str = Form(...),  # resolve, spare_dispatch, reverse_pickup, in_process, close_ticket
    notes: str = Form(...),
    sku: Optional[str] = Form(None),
    user: dict = Depends(require_roles(["supervisor", "admin"]))
):
    """Supervisor takes action on escalated ticket - notes must be 100+ chars"""
    if len(notes) < MIN_NOTES_LENGTH:
        raise HTTPException(status_code=400, detail=f"Notes must be at least {MIN_NOTES_LENGTH} characters")
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc)
    
    if action == "in_process":
        # Mark ticket as in process - needs followup
        sla_due = now + timedelta(hours=SLA_CONFIG["supervisor"])
        await db.tickets.update_one(
            {"id": ticket_id},
            {"$set": {
                "status": "supervisor_followup",
                "supervisor_notes": notes,
                "sla_due": sla_due.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        await add_ticket_history(ticket_id, "Marked in-process by supervisor (followup required)", user, {"notes": notes})
        return {"message": "Ticket marked in-process - followup required"}
    
    elif action == "close_ticket":
        # Supervisor closes ticket
        await db.tickets.update_one(
            {"id": ticket_id},
            {"$set": {
                "status": "closed",
                "supervisor_notes": notes,
                "closed_by": user["id"],
                "closed_by_name": f"{user['first_name']} {user['last_name']}",
                "closed_at": now.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        await add_ticket_history(ticket_id, "Ticket closed by supervisor", user, {"notes": notes})
        return {"message": "Ticket closed by supervisor"}
    
    elif action == "resolve":
        await db.tickets.update_one(
            {"id": ticket_id},
            {"$set": {
                "status": "resolved_on_call",
                "supervisor_notes": notes,
                "resolved_by": user["id"],
                "resolved_by_name": f"{user['first_name']} {user['last_name']}",
                "closed_at": now.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        await add_ticket_history(ticket_id, "Resolved by supervisor", user, {"notes": notes})
        return {"message": "Ticket resolved by supervisor"}
    
    elif action in ["spare_dispatch", "reverse_pickup"]:
        sla_due = now + timedelta(hours=SLA_CONFIG["accountant"])
        
        await db.tickets.update_one(
            {"id": ticket_id},
            {"$set": {
                "status": "hardware_service" if action == "reverse_pickup" else "awaiting_label",
                "support_type": "hardware",
                "supervisor_notes": notes,
                "supervisor_action": action,
                "supervisor_sku": sku,
                "sla_due": sla_due.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        
        action_name = "Reverse pickup requested" if action == "reverse_pickup" else "Spare dispatch requested"
        await add_ticket_history(ticket_id, f"Supervisor: {action_name}", user, {"notes": notes, "sku": sku})
        
        return {"message": f"{action_name} - sent to accountant"}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@api_router.post("/tickets/{ticket_id}/customer-escalate")
async def customer_escalate_ticket(
    ticket_id: str,
    user: dict = Depends(get_current_user)
):
    """Customer escalates ticket if no update for 48 hours"""
    if user["role"] != "customer":
        raise HTTPException(status_code=403, detail="Only customers can escalate")
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if ticket.get("customer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if ticket is already resolved
    if ticket["status"] in ["closed", "closed_by_agent", "resolved_on_call", "delivered"]:
        raise HTTPException(status_code=400, detail="Ticket is already resolved")
    
    # Check if 48 hours have passed since last update
    last_update = datetime.fromisoformat(ticket["updated_at"].replace('Z', '+00:00'))
    hours_since_update = (datetime.now(timezone.utc) - last_update).total_seconds() / 3600
    
    if hours_since_update < 48:
        remaining = int(48 - hours_since_update)
        raise HTTPException(status_code=400, detail=f"You can escalate after {remaining} hours of no update")
    
    now = datetime.now(timezone.utc)
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "status": "customer_escalated",
            "customer_escalated": True,
            "customer_escalated_at": now.isoformat(),
            "sla_breached": True,
            "updated_at": now.isoformat()
        }}
    )
    
    await add_ticket_history(ticket_id, "CUSTOMER ESCALATED - Missed SLA, needs immediate action", user)
    
    return {"message": "Ticket escalated to supervisor for immediate attention"}

@api_router.post("/tickets/{ticket_id}/route-to-hardware")
async def route_to_hardware(
    ticket_id: str,
    notes: str = Form(...),
    user: dict = Depends(require_roles(["call_support", "supervisor", "admin"]))
):
    """Route ticket to hardware service - notes must be 100+ chars"""
    if len(notes) < MIN_NOTES_LENGTH:
        raise HTTPException(status_code=400, detail=f"Notes must be at least {MIN_NOTES_LENGTH} characters")
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

class AccountantDecision(BaseModel):
    decision: str  # 'reverse_pickup' or 'spare_dispatch'

@api_router.patch("/tickets/{ticket_id}/accountant-decision")
async def set_accountant_decision(
    ticket_id: str,
    body: AccountantDecision,
    user: dict = Depends(require_roles(["accountant", "admin"]))
):
    """Accountant decides whether to do reverse pickup or spare dispatch for direct hardware tickets"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if ticket.get("supervisor_action"):
        raise HTTPException(status_code=400, detail="Decision already made by supervisor")
    
    if body.decision not in ["reverse_pickup", "spare_dispatch"]:
        raise HTTPException(status_code=400, detail="Invalid decision. Use 'reverse_pickup' or 'spare_dispatch'")
    
    now = datetime.now(timezone.utc)
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "accountant_decision": body.decision,
            "accountant_decided_by": user["id"],
            "accountant_decided_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    action_name = "Spare Dispatch" if body.decision == "spare_dispatch" else "Reverse Pickup"
    await add_ticket_history(ticket_id, f"Accountant decided: {action_name}", user, {
        "decision": body.decision
    })
    
    return {"message": f"Decision recorded: {action_name}"}

@api_router.post("/tickets/{ticket_id}/upload-pickup-label")
async def upload_pickup_label(
    ticket_id: str,
    courier: str = Form(...),
    tracking_id: str = Form(...),
    label_file: UploadFile = File(...),
    reason: Optional[str] = Form(None),  # Reason for re-upload
    user: dict = Depends(require_roles(["accountant", "admin"]))
):
    """Accountant uploads or re-uploads reverse pickup label"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Check if this is a re-upload
    is_reupload = ticket.get("pickup_label") is not None
    
    # Save label file with timestamp to keep history
    ext = Path(label_file.filename).suffix
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"pickup_{ticket_id}_{timestamp}{ext}"
    file_path = UPLOAD_DIR / "pickup_labels" / filename
    with open(file_path, "wb") as f:
        content = await label_file.read()
        f.write(content)
    
    label_url = f"/api/files/pickup_labels/{filename}"
    now = datetime.now(timezone.utc)
    
    # Store previous label info in history
    previous_labels = ticket.get("pickup_label_history", [])
    if is_reupload and ticket.get("pickup_label"):
        previous_labels.append({
            "label_url": ticket.get("pickup_label"),
            "courier": ticket.get("pickup_courier"),
            "tracking_id": ticket.get("pickup_tracking"),
            "uploaded_at": ticket.get("updated_at"),
            "failed_reason": reason
        })
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "pickup_label": label_url,
            "pickup_courier": courier,
            "pickup_tracking": tracking_id,
            "pickup_label_history": previous_labels,
            "status": "label_uploaded",
            "pickup_attempt": len(previous_labels) + 1,
            "updated_at": now.isoformat()
        }}
    )
    
    action_msg = "Pickup label re-uploaded (previous attempt failed)" if is_reupload else "Pickup label uploaded"
    history_details = {
        "courier": courier,
        "tracking_id": tracking_id,
        "attempt": len(previous_labels) + 1
    }
    if reason:
        history_details["reason_for_reupload"] = reason
    
    await add_ticket_history(ticket_id, action_msg, user, history_details)
    
    return {
        "message": "Pickup label uploaded" if not is_reupload else "Pickup label re-uploaded",
        "label_url": label_url,
        "attempt": len(previous_labels) + 1
    }

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
    board_serial_number: str = Form(...),
    device_serial_number: str = Form(...),
    user: dict = Depends(require_roles(["service_agent", "admin"]))
):
    """Technician completes repair - requires board and device serial numbers"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc)
    
    # Check if this is a walk-in ticket - skip accountant, go to dispatcher directly
    is_walkin = ticket.get("is_walkin", False)
    new_status = "ready_for_dispatch" if is_walkin else "repair_completed"
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "status": new_status,
            "repair_notes": repair_notes,
            "board_serial_number": board_serial_number,
            "device_serial_number": device_serial_number,
            "repaired_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    history_msg = "Repair completed" if not is_walkin else "Repair completed (Walk-in: skipping to dispatch)"
    await add_ticket_history(ticket_id, history_msg, user, {
        "repair_notes": repair_notes,
        "board_serial_number": board_serial_number,
        "device_serial_number": device_serial_number
    })
    
    return {"message": "Repair marked as completed", "status": new_status}

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


# ==================== CUSTOMER HISTORY (FOR CALL SUPPORT) ====================

@api_router.get("/tickets/{ticket_id}/customer-history")
async def get_customer_history_for_ticket(
    ticket_id: str,
    user: dict = Depends(require_roles(["call_support", "admin", "supervisor", "accountant"]))
):
    """Get customer history for a ticket - shows all tickets from same customer/phone/serial"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Find related tickets by phone, email, or serial number
    or_conditions = []
    if ticket.get("customer_phone"):
        or_conditions.append({"customer_phone": ticket["customer_phone"]})
    if ticket.get("customer_email"):
        or_conditions.append({"customer_email": ticket["customer_email"]})
    if ticket.get("serial_number"):
        or_conditions.append({"serial_number": ticket["serial_number"]})
    
    if not or_conditions:
        return {"related_tickets": [], "warranties": [], "dispatches": []}
    
    # Get related tickets (excluding current)
    related_tickets = await db.tickets.find(
        {"$or": or_conditions, "id": {"$ne": ticket_id}},
        {"_id": 0, "id": 1, "ticket_number": 1, "status": 1, "issue_description": 1, 
         "created_at": 1, "closed_at": 1, "serial_number": 1}
    ).sort("created_at", -1).to_list(50)
    
    # Get warranties for this customer
    warranty_query = []
    if ticket.get("customer_phone"):
        warranty_query.append({"phone": ticket["customer_phone"]})
    if ticket.get("customer_email"):
        warranty_query.append({"email": {"$regex": f"^{ticket['customer_email']}$", "$options": "i"}})
    
    warranties = []
    if warranty_query:
        warranties = await db.warranties.find(
            {"$or": warranty_query},
            {"_id": 0, "id": 1, "warranty_number": 1, "device_type": 1, "status": 1, 
             "warranty_end_date": 1, "order_id": 1}
        ).to_list(20)
    
    # Get dispatches for this customer
    dispatches = await db.dispatches.find(
        {"$or": or_conditions},
        {"_id": 0, "id": 1, "dispatch_number": 1, "status": 1, "tracking_id": 1, 
         "created_at": 1, "product_name": 1}
    ).sort("created_at", -1).to_list(20)
    
    return {
        "customer_name": ticket.get("customer_name"),
        "customer_phone": ticket.get("customer_phone"),
        "customer_email": ticket.get("customer_email"),
        "related_tickets": related_tickets,
        "warranties": warranties,
        "dispatches": dispatches,
        "total_tickets": len(related_tickets) + 1,
        "total_warranties": len(warranties)
    }

@api_router.get("/customers/search")
async def search_customer_history(
    phone: Optional[str] = None,
    email: Optional[str] = None,
    serial_number: Optional[str] = None,
    order_id: Optional[str] = None,
    user: dict = Depends(require_roles(["call_support", "admin", "supervisor", "accountant"]))
):
    """Global search for customer history by phone/email/serial/order_id"""
    if not any([phone, email, serial_number, order_id]):
        raise HTTPException(status_code=400, detail="Please provide at least one search parameter")
    
    or_conditions = []
    if phone:
        or_conditions.append({"customer_phone": {"$regex": phone, "$options": "i"}})
    if email:
        or_conditions.append({"customer_email": {"$regex": email, "$options": "i"}})
    if serial_number:
        or_conditions.append({"serial_number": {"$regex": serial_number, "$options": "i"}})
    if order_id:
        or_conditions.append({"order_id": {"$regex": order_id, "$options": "i"}})
    
    # Get tickets
    tickets = await db.tickets.find(
        {"$or": or_conditions},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get warranties
    warranty_conditions = []
    if phone:
        warranty_conditions.append({"phone": {"$regex": phone, "$options": "i"}})
    if email:
        warranty_conditions.append({"email": {"$regex": email, "$options": "i"}})
    if order_id:
        warranty_conditions.append({"order_id": {"$regex": order_id, "$options": "i"}})
    
    warranties = []
    if warranty_conditions:
        warranties = await db.warranties.find(
            {"$or": warranty_conditions},
            {"_id": 0}
        ).to_list(50)
    
    # Get dispatches
    dispatches = await db.dispatches.find(
        {"$or": or_conditions},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {
        "tickets": tickets,
        "warranties": warranties,
        "dispatches": dispatches,
        "total_tickets": len(tickets),
        "total_warranties": len(warranties),
        "total_dispatches": len(dispatches)
    }



# ==================== VOLTDOCTOR TICKET REPLY ====================

class TicketReply(BaseModel):
    message: str
    change_status: Optional[str] = None

@api_router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: str,
    reply: TicketReply,
    user: dict = Depends(require_roles(["call_support", "admin", "supervisor"]))
):
    """Support agent replies to a ticket."""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc).isoformat()
    responder_name = f"{user['first_name']} {user['last_name']}"
    
    # Add reply to ticket history
    await add_ticket_history(ticket_id, f"Support reply: {reply.message[:100]}...", user, {
        "full_message": reply.message
    })
    
    # Update agent notes if exists
    current_notes = ticket.get("agent_notes", "")
    new_notes = f"{current_notes}\n\n[{now[:10]} - {responder_name}]: {reply.message}".strip()
    
    update_data = {
        "agent_notes": new_notes,
        "updated_at": now
    }
    
    # Update status if requested
    if reply.change_status:
        update_data["status"] = reply.change_status
    
    await db.tickets.update_one({"id": ticket_id}, {"$set": update_data})
    
    return {"message": "Reply sent successfully"}

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

@api_router.get("/warranties")
async def list_warranties(
    search: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """List warranties"""
    query = {}
    
    if user["role"] == "customer":
        # Match by customer_id OR by email/phone (for imported warranties)
        query["$or"] = [
            {"customer_id": user["id"]},
            {"email": {"$regex": f"^{user.get('email', '')}$", "$options": "i"}},
            {"phone": user.get("phone", "")}
        ]
    
    if search:
        search_query = [
            {"warranty_number": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"order_id": {"$regex": search, "$options": "i"}}
        ]
        if "$or" in query:
            query = {"$and": [query, {"$or": search_query}]}
        else:
            query["$or"] = search_query
    
    if status:
        if "$and" in query:
            query["$and"].append({"status": status})
        elif "$or" in query and user["role"] == "customer":
            query = {"$and": [query, {"status": status}]}
        else:
            query["status"] = status
    
    warranties = await db.warranties.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    return warranties

@api_router.get("/warranties/{warranty_id}")
async def get_warranty(warranty_id: str, user: dict = Depends(get_current_user)):
    """Get warranty details"""
    warranty = await db.warranties.find_one({"id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    if user["role"] == "customer":
        customer_id = warranty.get("customer_id") or warranty.get("user_id")
        if customer_id != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return warranty

@api_router.patch("/warranties/{warranty_id}/approve")
async def approve_warranty(
    warranty_id: str,
    approval: WarrantyApproval,
    user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Admin/Supervisor approves warranty"""
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
    user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Admin/Supervisor rejects warranty"""
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

@api_router.get("/admin/warranty-extensions")
async def get_warranty_extensions(
    user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Get all warranties with pending extension requests"""
    warranties = await db.warranties.find(
        {"extension_requested": True},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(10000)
    
    return warranties

class ExtensionReview(BaseModel):
    action: str  # approve or reject
    extension_months: Optional[int] = 3  # Default 3 months extension
    notes: Optional[str] = None

@api_router.patch("/admin/warranties/{warranty_id}/review-extension")
async def review_warranty_extension(
    warranty_id: str,
    review: ExtensionReview,
    user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Admin/Supervisor approves or rejects warranty extension request"""
    warranty = await db.warranties.find_one({"id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    if not warranty.get("extension_requested"):
        raise HTTPException(status_code=400, detail="No extension request pending")
    
    now = datetime.now(timezone.utc).isoformat()
    
    if review.action == "approve":
        # Calculate new warranty end date
        current_end = warranty.get("warranty_end_date")
        if current_end:
            end_date = datetime.fromisoformat(current_end.replace('Z', '+00:00'))
        else:
            end_date = datetime.now(timezone.utc)
        
        # Add extension months
        new_end_date = end_date + timedelta(days=review.extension_months * 30)
        
        await db.warranties.update_one(
            {"id": warranty_id},
            {"$set": {
                "extension_status": "approved",
                "warranty_end_date": new_end_date.isoformat()[:10],  # Just the date part
                "extension_notes": review.notes,
                "extension_months_granted": review.extension_months,
                "extension_reviewed_at": now,
                "extension_reviewed_by": user["id"],
                "updated_at": now
            }}
        )
        
        return {
            "message": f"Extension approved - {review.extension_months} months added",
            "new_warranty_end_date": new_end_date.isoformat()[:10]
        }
    
    elif review.action == "reject":
        await db.warranties.update_one(
            {"id": warranty_id},
            {"$set": {
                "extension_status": "rejected",
                "extension_notes": review.notes,
                "extension_reviewed_at": now,
                "extension_reviewed_by": user["id"],
                "updated_at": now
            }}
        )
        
        return {"message": "Extension request rejected"}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'reject'")

# ==================== WARRANTY INVOICE MANAGEMENT ====================

@api_router.post("/warranties/{warranty_id}/upload-invoice")
async def upload_warranty_invoice(
    warranty_id: str,
    invoice_file: UploadFile = File(...),
    user: dict = Depends(require_roles(["admin", "supervisor", "call_support"]))
):
    """Admin, Supervisor or Support uploads invoice PDF for a warranty"""
    warranty = await db.warranties.find_one({"id": warranty_id}, {"_id": 0})
    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")
    
    # Ensure warranty_invoices directory exists
    invoice_dir = UPLOAD_DIR / "warranty_invoices"
    invoice_dir.mkdir(exist_ok=True)
    
    # Save invoice file
    ext = Path(invoice_file.filename).suffix
    filename = f"warranty_invoice_{warranty_id}{ext}"
    file_path = invoice_dir / filename
    
    with open(file_path, "wb") as f:
        content = await invoice_file.read()
        f.write(content)
    
    invoice_url = f"/api/files/warranty_invoices/{filename}"
    now = datetime.now(timezone.utc).isoformat()
    
    await db.warranties.update_one(
        {"id": warranty_id},
        {"$set": {
            "admin_invoice_file": invoice_url,
            "admin_invoice_uploaded_at": now,
            "admin_invoice_uploaded_by": user["id"],
            "updated_at": now
        }}
    )
    
    return {"message": "Invoice uploaded successfully", "invoice_url": invoice_url}

# ==================== CUSTOMER EDIT (For Admin/Support) ====================

class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None

@api_router.patch("/admin/customers/{user_id}")
async def update_customer_info(
    user_id: str,
    update_data: CustomerUpdate,
    user: dict = Depends(require_roles(["admin", "call_support"]))
):
    """Admin or Support updates customer information. Phone cannot be changed (unique ID)."""
    customer = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    if customer.get("role") != "customer":
        raise HTTPException(status_code=400, detail="Can only edit customer accounts")
    
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if update_data.first_name is not None:
        update_dict["first_name"] = update_data.first_name
    if update_data.last_name is not None:
        update_dict["last_name"] = update_data.last_name
    if update_data.email is not None:
        # Check if email is taken by another user
        existing = await db.users.find_one({"email": update_data.email.lower(), "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use by another user")
        update_dict["email"] = update_data.email.lower()
    if update_data.address is not None:
        update_dict["address"] = update_data.address
    if update_data.city is not None:
        update_dict["city"] = update_data.city
    if update_data.state is not None:
        update_dict["state"] = update_data.state
    if update_data.pincode is not None:
        update_dict["pincode"] = update_data.pincode
    
    await db.users.update_one({"id": user_id}, {"$set": update_dict})
    
    # Also update customer info in related tickets
    ticket_update = {}
    new_name = None
    if update_data.first_name is not None or update_data.last_name is not None:
        # Get updated user to construct new name
        updated_user = await db.users.find_one({"id": user_id}, {"_id": 0})
        new_name = f"{updated_user.get('first_name', '')} {updated_user.get('last_name', '')}".strip()
        ticket_update["customer_name"] = new_name
    if update_data.email is not None:
        ticket_update["customer_email"] = update_data.email.lower()
    if update_data.address is not None:
        ticket_update["customer_address"] = update_data.address
    if update_data.city is not None:
        ticket_update["customer_city"] = update_data.city
    
    if ticket_update:
        await db.tickets.update_many(
            {"customer_id": user_id},
            {"$set": ticket_update}
        )
    
    updated_customer = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated_customer

@api_router.get("/admin/customers/{user_id}")
async def get_customer_detail(
    user_id: str,
    user: dict = Depends(require_roles(["admin", "call_support"]))
):
    """Get detailed customer information"""
    customer = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return customer

# ==================== ADMIN TICKET CLOSE ====================

class AdminCloseTicket(BaseModel):
    notes: str

@api_router.post("/admin/tickets/{ticket_id}/close")
async def admin_close_ticket(
    ticket_id: str,
    close_data: AdminCloseTicket,
    user: dict = Depends(require_roles(["admin"]))
):
    """Admin closes any ticket with notes - regardless of current status"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if not close_data.notes or len(close_data.notes.strip()) < 5:
        raise HTTPException(status_code=400, detail="Closing notes must be at least 5 characters")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update ticket status to closed
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "status": "closed",
            "admin_close_notes": close_data.notes,
            "closed_at": now,
            "closed_by": user["id"],
            "closed_by_name": f"{user['first_name']} {user['last_name']}",
            "updated_at": now
        }}
    )
    
    # Add to ticket history
    await add_ticket_history(ticket_id, f"Ticket closed by Admin: {close_data.notes[:100]}...", user, {
        "full_notes": close_data.notes,
        "previous_status": ticket.get("status")
    })
    
    return {"message": "Ticket closed successfully"}

# ==================== ADMIN DISPATCH MANAGEMENT ====================

class DispatchUpdate(BaseModel):
    customer_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    reason: Optional[str] = None
    order_id: Optional[str] = None
    payment_reference: Optional[str] = None
    status: Optional[str] = None
    courier: Optional[str] = None
    tracking_id: Optional[str] = None

@api_router.patch("/admin/dispatches/{dispatch_id}")
async def admin_update_dispatch(
    dispatch_id: str,
    update_data: DispatchUpdate,
    user: dict = Depends(require_roles(["admin"]))
):
    """Admin updates dispatch/order information"""
    dispatch = await db.dispatches.find_one({"id": dispatch_id}, {"_id": 0})
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    
    update_dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field in ["customer_name", "phone", "address", "reason", "order_id", 
                  "payment_reference", "status", "courier", "tracking_id"]:
        value = getattr(update_data, field, None)
        if value is not None:
            update_dict[field] = value
    
    await db.dispatches.update_one({"id": dispatch_id}, {"$set": update_dict})
    
    updated = await db.dispatches.find_one({"id": dispatch_id}, {"_id": 0})
    return updated

@api_router.delete("/admin/dispatches/{dispatch_id}")
async def admin_delete_dispatch(
    dispatch_id: str,
    user: dict = Depends(require_roles(["admin"]))
):
    """Admin deletes a dispatch/order"""
    dispatch = await db.dispatches.find_one({"id": dispatch_id}, {"_id": 0})
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    
    await db.dispatches.delete_one({"id": dispatch_id})
    return {"message": "Dispatch deleted successfully"}

# ==================== DISPATCH ENDPOINTS ====================

@api_router.post("/dispatches", response_model=DispatchResponse)
async def create_dispatch(
    dispatch_type: str = Form(...),
    sku: str = Form(...),
    customer_name: str = Form(...),
    phone: str = Form(...),
    address: str = Form(...),
    reason: str = Form(...),
    order_id: str = Form(...),
    payment_reference: str = Form(...),
    invoice_file: UploadFile = File(...),
    firm_id: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    pincode: Optional[str] = Form(None),
    note: Optional[str] = Form(None),
    ticket_id: Optional[str] = Form(None),
    serial_number: Optional[str] = Form(None),  # For manufactured items
    pending_fulfillment_id: Optional[str] = Form(None),  # For pending fulfillment dispatch
    tracking_id: Optional[str] = Form(None),  # Pre-set tracking ID from pending fulfillment
    user: dict = Depends(require_roles(["accountant", "admin"]))
):
    """Create dispatch with mandatory invoice/challan upload and firm selection"""
    dispatch_id = str(uuid.uuid4())
    dispatch_number = generate_dispatch_number()
    now = datetime.now(timezone.utc).isoformat()
    
    # Validate firm if provided
    firm_name = None
    master_sku_info = None
    is_manufactured_item = False
    
    if firm_id:
        firm = await db.firms.find_one({"id": firm_id, "is_active": True})
        if not firm:
            raise HTTPException(status_code=400, detail="Invalid or inactive firm")
        firm_name = firm.get("name")
        
        # Check if this is a manufactured Master SKU
        master_sku = await db.master_skus.find_one({
            "$or": [
                {"sku_code": sku},
                {"aliases.alias_code": sku}
            ],
            "is_active": True
        })
        
        if master_sku and master_sku.get("product_type") == "manufactured":
            is_manufactured_item = True
            master_sku_info = {
                "id": master_sku["id"],
                "name": master_sku["name"],
                "sku_code": master_sku["sku_code"]
            }
            
            # For manufactured items, serial number is REQUIRED
            if not serial_number:
                raise HTTPException(status_code=400, detail="Serial number is required for manufactured items")
            
            # Verify serial number exists and is in_stock for this firm/SKU
            serial_record = await db.finished_good_serials.find_one({
                "serial_number": serial_number,
                "master_sku_id": master_sku["id"],
                "firm_id": firm_id,
                "status": "in_stock"
            })
            
            if not serial_record:
                raise HTTPException(status_code=400, detail=f"Serial number {serial_number} not found or not available in stock")
            
            # Reserve the serial number (mark as dispatched)
            await db.finished_good_serials.update_one(
                {"serial_number": serial_number},
                {"$set": {
                    "status": "dispatched",
                    "dispatch_date": now,
                    "updated_at": now
                }}
            )
        else:
            # For non-manufactured items, check regular SKU stock
            sku_item = await db.skus.find_one({"sku_code": sku, "firm_id": firm_id, "active": True})
            if not sku_item:
                # Check if SKU exists at all
                sku_exists = await db.skus.find_one({"sku_code": sku, "active": True})
                if not sku_exists:
                    # Also check Master SKUs inventory
                    if not master_sku:
                        raise HTTPException(status_code=400, detail=f"SKU {sku} not found")
                
                if not master_sku:
                    raise HTTPException(status_code=400, detail=f"SKU {sku} not available in selected firm")
            
            if sku_item and sku_item.get("stock_quantity", 0) <= 0:
                raise HTTPException(status_code=400, detail=f"SKU {sku} is out of stock in selected firm")
    
    # Save invoice file
    ext = Path(invoice_file.filename).suffix
    invoice_filename = f"invoice_{dispatch_id}{ext}"
    invoice_path = UPLOAD_DIR / "invoices" / invoice_filename
    (UPLOAD_DIR / "invoices").mkdir(parents=True, exist_ok=True)
    with open(invoice_path, "wb") as f:
        content = await invoice_file.read()
        f.write(content)
    invoice_url = f"/api/files/invoices/{invoice_filename}"
    
    # Get ticket number if linked
    ticket_number = None
    if ticket_id:
        ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
        if ticket:
            ticket_number = ticket["ticket_number"]
    
    # ====== COMPLIANCE VALIDATION FOR DISPATCH ======
    compliance_data = {
        "dispatch_type": dispatch_type,
        "customer_name": customer_name,
        "phone": phone,
        "address": address,
        "order_id": order_id,
        "firm_id": firm_id,
        "sku": sku,
        "tracking_id": tracking_id
    }
    
    files_present = {"invoice_file": invoice_url if invoice_file else None}
    
    compliance_result = validate_document_compliance(
        "dispatch",
        compliance_data,
        files_present,
        0  # No monetary value for dispatch compliance
    )
    
    doc_status = compliance_result["status"]
    
    dispatch_doc = {
        "id": dispatch_id,
        "dispatch_number": dispatch_number,
        "dispatch_type": dispatch_type,
        "ticket_id": ticket_id,
        "ticket_number": ticket_number,
        "sku": sku,
        "firm_id": firm_id,
        "firm_name": firm_name,
        "is_manufactured_item": is_manufactured_item,
        "master_sku_id": master_sku_info["id"] if master_sku_info else None,
        "master_sku_name": master_sku_info["name"] if master_sku_info else None,
        "serial_number": serial_number if is_manufactured_item else None,
        "customer_name": customer_name,
        "phone": phone,
        "address": address,
        "city": city,
        "state": state,
        "pincode": pincode,
        "reason": reason,
        "note": note,
        "order_id": order_id,
        "payment_reference": payment_reference,
        "invoice_url": invoice_url,
        "courier": None,
        "tracking_id": tracking_id,  # Pre-filled if from pending fulfillment
        "label_file": None,
        "status": "pending_label",
        "doc_status": doc_status,
        "compliance_score": compliance_result["compliance_score"],
        "compliance_issues": compliance_result.get("soft_blocks", []) + compliance_result.get("warnings", []),
        "pending_fulfillment_id": pending_fulfillment_id,  # Link to pending fulfillment entry
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
    dispatch_doc.pop("_id", None)
    
    # Create compliance exception if there are issues
    if doc_status == "pending" and (compliance_result["soft_blocks"] or compliance_result["missing_important"]):
        severity = "important" if compliance_result["missing_important"] else "minor"
        await create_compliance_exception(
            transaction_type="dispatch",
            transaction_id=dispatch_id,
            transaction_ref=dispatch_number,
            firm_id=firm_id or "default",
            issues=compliance_result["soft_blocks"] + [f"Missing: {m['label']}" for m in compliance_result.get("missing_important", [])],
            severity=severity,
            user=user
        )
    
    # Mark pending fulfillment entry as dispatched if applicable
    if pending_fulfillment_id:
        await db.pending_fulfillment.update_one(
            {"id": pending_fulfillment_id},
            {"$set": {
                "status": "dispatched",
                "dispatch_id": dispatch_id,
                "dispatched_at": now,
                "updated_at": now
            }}
        )
        
        # Create audit log for pending fulfillment dispatch
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "pending_fulfillment_dispatched",
            "entity_type": "pending_fulfillment",
            "entity_id": pending_fulfillment_id,
            "entity_name": order_id,
            "performed_by": user["id"],
            "performed_by_name": f"{user['first_name']} {user['last_name']}",
            "details": {"dispatch_id": dispatch_id, "tracking_id": tracking_id, "serial_number": serial_number},
            "timestamp": now
        })
    
    # Create notification for new dispatch
    await create_notification(
        title="New Dispatch Created",
        message=f"Dispatch {dispatch_number} created for {customer_name} - {dispatch_type.replace('_', ' ')}",
        notification_type="info",
        link=f"/accountant",
        target_roles=["accountant", "dispatcher", "admin"],
        priority="normal"
    )
    
    return DispatchResponse(**dispatch_doc)

@api_router.post("/dispatches/from-ticket/{ticket_id}", response_model=DispatchResponse)
async def create_dispatch_from_ticket(
    ticket_id: str,
    dispatch_type: str = Form(...),
    sku: Optional[str] = Form(None),
    firm_id: Optional[str] = Form(None),
    user: dict = Depends(require_roles(["accountant", "admin"]))
):
    """Create dispatch from a hardware ticket"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Get firm name if firm_id provided
    firm_name = None
    if firm_id:
        firm = await db.firms.find_one({"id": firm_id}, {"_id": 0})
        firm_name = firm.get("name") if firm else None
    
    dispatch_id = str(uuid.uuid4())
    dispatch_number = generate_dispatch_number()
    now = datetime.now(timezone.utc).isoformat()
    
    dispatch_doc = {
        "id": dispatch_id,
        "dispatch_number": dispatch_number,
        "dispatch_type": dispatch_type,
        "ticket_id": ticket_id,
        "ticket_number": ticket["ticket_number"],
        "sku": sku,
        "firm_id": firm_id,
        "firm_name": firm_name,
        "customer_name": ticket["customer_name"],
        "phone": ticket["customer_phone"],
        "address": ticket.get("customer_address") or "",
        "city": ticket.get("customer_city"),
        "state": None,
        "pincode": None,
        "reason": f"Hardware service - {dispatch_type.replace('_', ' ')}",
        "note": ticket.get("agent_notes"),
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
    
    # Update ticket status
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": "awaiting_label", "updated_at": now}}
    )
    await add_ticket_history(ticket_id, f"Dispatch created ({dispatch_type})", user, {"dispatch_number": dispatch_number})
    
    dispatch_doc.pop("_id", None)
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
    
    dispatches = await db.dispatches.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
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
    status: str = Form(...),
    user: dict = Depends(require_roles(["dispatcher", "gate", "admin"]))
):
    """Update dispatch status - handles both dispatches and tickets"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Try to find in dispatches first
    dispatch = await db.dispatches.find_one({"id": dispatch_id}, {"_id": 0})
    
    if dispatch:
        # It's a regular dispatch
        update = {"status": status, "updated_at": now}
        if status == "dispatched":
            update["scanned_out_at"] = now
            
            # ============ STOCK DEDUCTION ON DISPATCH ============
            # Only deduct stock if dispatch has firm_id and sku
            firm_id = dispatch.get("firm_id")
            sku_code = dispatch.get("sku")
            
            if firm_id and sku_code:
                # Find the SKU with this firm_id
                sku_item = await db.skus.find_one({
                    "sku_code": sku_code,
                    "firm_id": firm_id,
                    "active": True
                })
                
                if sku_item:
                    # Check if stock is available
                    current_stock = sku_item.get("stock_quantity", 0)
                    if current_stock < 1:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Insufficient stock for {sku_code} in this firm. Available: {current_stock}"
                        )
                    
                    # Create dispatch_out ledger entry
                    ledger_entry_id = str(uuid.uuid4())
                    running_balance = current_stock - 1
                    
                    ledger_entry = {
                        "id": ledger_entry_id,
                        "entry_number": generate_ledger_entry_number(),
                        "entry_type": "dispatch_out",
                        "item_type": "finished_good",
                        "item_id": sku_item["id"],
                        "item_name": sku_item.get("model_name"),
                        "item_sku": sku_code,
                        "firm_id": firm_id,
                        "firm_name": dispatch.get("firm_name"),
                        "quantity": 1,
                        "running_balance": running_balance,
                        "unit_price": None,
                        "total_value": None,
                        "invoice_number": dispatch.get("invoice_url"),  # Link to invoice if available
                        "reason": f"Dispatch #{dispatch.get('dispatch_number')} - {dispatch.get('dispatch_type', 'sale')}",
                        "reference_id": dispatch_id,
                        "notes": f"Customer: {dispatch.get('customer_name')}, Order: {dispatch.get('order_id')}",
                        "created_by": user["id"],
                        "created_by_name": f"{user['first_name']} {user['last_name']}",
                        "created_at": now,
                        # Additional dispatch-specific fields
                        "dispatch_id": dispatch_id,
                        "dispatch_number": dispatch.get("dispatch_number")
                    }
                    
                    await db.inventory_ledger.insert_one(ledger_entry)
                    
                    # Update SKU stock
                    await db.skus.update_one(
                        {"id": sku_item["id"]},
                        {"$set": {"stock_quantity": running_balance, "updated_at": now}}
                    )
                    
                    # Create audit log for stock deduction
                    await db.audit_logs.insert_one({
                        "id": str(uuid.uuid4()),
                        "action": "dispatch_stock_deducted",
                        "entity_type": "dispatch",
                        "entity_id": dispatch_id,
                        "entity_name": dispatch.get("dispatch_number"),
                        "performed_by": user["id"],
                        "performed_by_name": f"{user['first_name']} {user['last_name']}",
                        "details": {
                            "sku": sku_code,
                            "firm_id": firm_id,
                            "quantity_deducted": 1,
                            "previous_stock": current_stock,
                            "new_stock": running_balance,
                            "ledger_entry_id": ledger_entry_id
                        },
                        "timestamp": now
                    })
                    
                    # Mark dispatch as stock_deducted
                    update["stock_deducted"] = True
                    update["ledger_entry_id"] = ledger_entry_id
            # ============ END STOCK DEDUCTION ============
            
            # If this is an amazon_order, create a feedback call task for call support
            if dispatch.get("dispatch_type") == "amazon_order":
                feedback_call_id = str(uuid.uuid4())
                feedback_call = {
                    "id": feedback_call_id,
                    "dispatch_id": dispatch_id,
                    "dispatch_number": dispatch.get("dispatch_number"),
                    "order_id": dispatch.get("order_id"),
                    "customer_name": dispatch.get("customer_name"),
                    "phone": dispatch.get("phone"),
                    "sku": dispatch.get("sku"),
                    "status": "pending",  # pending, completed, no_answer
                    "call_attempts": 0,
                    "feedback_screenshot": None,
                    "notes": None,
                    "assigned_to": None,
                    "completed_by": None,
                    "completed_at": None,
                    "created_at": now,
                    "updated_at": now
                }
                await db.feedback_calls.insert_one(feedback_call)
        
        await db.dispatches.update_one({"id": dispatch_id}, {"$set": update})
        return {"message": f"Dispatch status updated to {status}"}
    
    # Not found in dispatches, check tickets (for return dispatches)
    ticket = await db.tickets.find_one({"id": dispatch_id}, {"_id": 0})
    
    if ticket:
        # It's a ticket return dispatch
        update = {"status": status, "updated_at": now}
        if status == "dispatched":
            update["dispatched_at"] = now
            update["status"] = "dispatched"
        await db.tickets.update_one({"id": dispatch_id}, {"$set": update})
        
        # Add to ticket history
        history_entry = {
            "action": f"Status changed to {status}",
            "by": f"{user['first_name']} {user['last_name']}",
            "by_id": user["id"],
            "by_role": user["role"],
            "timestamp": now,
            "details": {}
        }
        await db.tickets.update_one({"id": dispatch_id}, {"$push": {"history": history_entry}})
        
        return {"message": f"Ticket return dispatch status updated to {status}"}
    
    raise HTTPException(status_code=404, detail="Dispatch not found")

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
            "dispatch_type": "walkin_return" if ticket.get("is_walkin") else "return_dispatch",
            "ticket_id": ticket["id"],
            "ticket_number": ticket["ticket_number"],
            "sku": None,
            "customer_name": ticket["customer_name"],
            "phone": ticket["customer_phone"],
            "address": ticket.get("address") or ticket.get("customer_address", ""),
            "city": ticket.get("city") or ticket.get("customer_city"),
            "state": ticket.get("state"),
            "pincode": ticket.get("pincode"),
            "reason": "Walk-in repair return" if ticket.get("is_walkin") else "Hardware repair return",
            "note": ticket.get("repair_notes"),
            "courier": ticket.get("return_courier"),
            "tracking_id": ticket.get("return_tracking"),
            "label_file": ticket.get("return_label"),
            "status": "ready_for_dispatch",
            "service_charges": ticket.get("service_charges"),
            "service_invoice": ticket.get("service_invoice"),
            "is_walkin": ticket.get("is_walkin", False),
            "board_serial_number": ticket.get("board_serial_number"),
            "device_serial_number": ticket.get("device_serial_number"),
            "created_by": ticket.get("created_by", ""),
            "created_by_name": None,
            "created_at": ticket["created_at"],
            "updated_at": ticket["updated_at"],
            "scanned_in_at": ticket.get("received_at"),
            "scanned_out_at": None
        }
        dispatches.append(dispatch_item)
    
    return [DispatchResponse(**d) for d in dispatches]

@api_router.patch("/dispatcher/dispatches/{dispatch_id}/update-courier")
async def dispatcher_update_courier(
    dispatch_id: str,
    courier: str = Form(...),
    tracking_id: str = Form(...),
    reason: Optional[str] = Form(None),
    label_file: Optional[UploadFile] = File(None),
    user: dict = Depends(require_roles(["dispatcher", "admin"]))
):
    """Dispatcher updates courier details before dispatch - for when courier didn't arrive"""
    # Check if this is a dispatch or a ticket
    dispatch = await db.dispatches.find_one({"id": dispatch_id}, {"_id": 0})
    is_ticket = False
    
    if not dispatch:
        # Check if it's a ticket
        dispatch = await db.tickets.find_one({"id": dispatch_id}, {"_id": 0})
        is_ticket = True
        if not dispatch:
            raise HTTPException(status_code=404, detail="Dispatch not found")
    
    now = datetime.now(timezone.utc)
    collection = db.tickets if is_ticket else db.dispatches
    
    # Store previous courier info in history
    courier_history = dispatch.get("courier_history", [])
    if dispatch.get("courier") or dispatch.get("return_courier"):
        old_courier = dispatch.get("return_courier") if is_ticket else dispatch.get("courier")
        old_tracking = dispatch.get("return_tracking") if is_ticket else dispatch.get("tracking_id")
        if old_courier:
            courier_history.append({
                "courier": old_courier,
                "tracking_id": old_tracking,
                "label_file": dispatch.get("return_label") if is_ticket else dispatch.get("label_file"),
                "updated_at": dispatch.get("updated_at"),
                "failed_reason": reason
            })
    
    # Handle label file upload
    label_url = None
    if label_file:
        ext = Path(label_file.filename).suffix
        timestamp = now.strftime("%Y%m%d%H%M%S")
        filename = f"dispatch_label_{dispatch_id}_{timestamp}{ext}"
        file_path = UPLOAD_DIR / "labels" / filename
        with open(file_path, "wb") as f:
            content = await label_file.read()
            f.write(content)
        label_url = f"/api/files/labels/{filename}"
    
    # Update fields based on collection type
    if is_ticket:
        update_data = {
            "return_courier": courier,
            "return_tracking": tracking_id,
            "courier_history": courier_history,
            "courier_update_count": len(courier_history),
            "updated_at": now.isoformat()
        }
        if label_url:
            update_data["return_label"] = label_url
    else:
        update_data = {
            "courier": courier,
            "tracking_id": tracking_id,
            "courier_history": courier_history,
            "courier_update_count": len(courier_history),
            "updated_at": now.isoformat()
        }
        if label_url:
            update_data["label_file"] = label_url
    
    await collection.update_one({"id": dispatch_id}, {"$set": update_data})
    
    # Add to history
    if is_ticket:
        await add_ticket_history(dispatch_id, f"Courier updated by dispatcher: {courier} ({tracking_id})", user, {
            "reason": reason,
            "attempt": len(courier_history) + 1
        })
    
    return {
        "message": "Courier details updated",
        "courier": courier,
        "tracking_id": tracking_id,
        "attempt": len(courier_history) + 1
    }

@api_router.get("/dispatcher/recent")
async def get_recent_dispatches(
    user: dict = Depends(require_roles(["dispatcher", "admin"]))
):
    """Get recently dispatched items"""
    # Get dispatches that have been dispatched (outbound)
    dispatched = await db.dispatches.find(
        {"status": "dispatched"},
        {"_id": 0}
    ).sort("scanned_out_at", -1).to_list(50)
    
    # Also get tickets that have been dispatched
    dispatched_tickets = await db.tickets.find(
        {"status": "dispatched"},
        {"_id": 0}
    ).sort("dispatched_at", -1).to_list(50)
    
    # Convert tickets to dispatch format
    for ticket in dispatched_tickets:
        dispatch_item = {
            "id": ticket["id"],
            "dispatch_number": ticket["ticket_number"],
            "dispatch_type": "walkin_return" if ticket.get("is_walkin") else "return_dispatch",
            "ticket_id": ticket["id"],
            "ticket_number": ticket["ticket_number"],
            "customer_name": ticket["customer_name"],
            "phone": ticket["customer_phone"],
            "courier": ticket.get("return_courier"),
            "tracking_id": ticket.get("return_tracking"),
            "status": "dispatched",
            "is_walkin": ticket.get("is_walkin", False),
            "dispatched_at": ticket.get("dispatched_at"),
            "created_at": ticket["created_at"]
        }
        dispatched.append(dispatch_item)
    
    # Sort by dispatch time
    dispatched.sort(key=lambda x: x.get("scanned_out_at") or x.get("dispatched_at") or x.get("created_at"), reverse=True)
    
    return dispatched[:50]

# ==================== GATE SCAN ENDPOINTS ====================

@api_router.post("/gate/scan", response_model=GateScanResponse)
async def gate_scan(
    scan_data: GateScanCreate,
    user: dict = Depends(require_roles(["gate", "dispatcher", "admin", "accountant"]))
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
    
    # Handle based on scan type
    if scan_data.scan_type == "inward":
        # ============ CREATE INCOMING QUEUE ENTRY ============
        # For INWARD scans, create an entry in incoming_queue for classification
        # NO direct stock impact at this stage
        queue_id = str(uuid.uuid4())
        queue_entry = {
            "id": queue_id,
            "queue_number": generate_queue_number(),
            "tracking_id": scan_data.tracking_id,
            "courier": scan_data.courier,
            "source": "gate_scan",
            "gate_log_id": scan_id,
            # Link to ticket/dispatch if found
            "linked_ticket_id": ticket["id"] if ticket else None,
            "linked_ticket_number": ticket["ticket_number"] if ticket else None,
            "linked_dispatch_id": dispatch["id"] if dispatch else None,
            "linked_dispatch_number": dispatch["dispatch_number"] if dispatch else None,
            "customer_name": ticket["customer_name"] if ticket else (dispatch["customer_name"] if dispatch else None),
            # Status
            "status": "pending",  # pending, classified, processed
            "classification_type": None,
            # Classification details (filled later)
            "classified_firm_id": None,
            "classified_firm_name": None,
            "classified_item_type": None,
            "classified_item_id": None,
            "classified_item_name": None,
            "classified_item_sku": None,
            "classified_quantity": None,
            "classified_ticket_id": None,
            "original_dispatch_id": None,
            "original_dispatch_number": None,
            "reason": None,
            "reference_number": None,
            "scrap_reason": None,
            "remarks": None,
            "ledger_entry_id": None,
            "ledger_entry_number": None,
            # Audit
            "scanned_by": user["id"],
            "scanned_by_name": f"{user['first_name']} {user['last_name']}",
            "scanned_at": now.isoformat(),
            "classified_by": None,
            "classified_by_name": None,
            "classified_at": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        await db.incoming_queue.insert_one(queue_entry)
        
        # Update ticket status to indicate gate received (but not inventory added)
        if ticket:
            await db.tickets.update_one(
                {"id": ticket["id"]},
                {"$set": {"status": "received_at_factory", "received_at": now.isoformat(), "updated_at": now.isoformat()}}
            )
            await add_ticket_history(ticket["id"], "Gate scan - Inward (pending classification)", user, {
                "tracking_id": scan_data.tracking_id,
                "queue_id": queue_id,
                "queue_number": queue_entry["queue_number"]
            })
        # ============ END INCOMING QUEUE ENTRY ============
    
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
        # Notification for outward scan
        await create_notification(
            title="Package Dispatched",
            message=f"Package {scan_data.tracking_id} scanned outward - dispatched to customer",
            notification_type="success",
            target_roles=["accountant", "dispatcher", "admin"],
            priority="normal"
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
    user: dict = Depends(require_roles(["gate", "dispatcher", "admin", "accountant"]))
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
    user: dict = Depends(require_roles(["gate", "dispatcher", "admin", "accountant"]))
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

# ==================== INCOMING INVENTORY QUEUE ====================

@api_router.get("/incoming-queue", response_model=List[IncomingQueueResponse])
async def get_incoming_queue(
    status: Optional[str] = None,
    classification_type: Optional[str] = None,
    limit: int = Query(100, le=500),
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get incoming inventory queue entries for classification"""
    query = {}
    if status:
        query["status"] = status
    if classification_type:
        query["classification_type"] = classification_type
    
    entries = await db.incoming_queue.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [IncomingQueueResponse(**e) for e in entries]

@api_router.get("/incoming-queue/pending-count")
async def get_pending_queue_count(
    user: dict = Depends(require_roles(["admin", "accountant", "gate"]))
):
    """Get count of pending incoming queue entries"""
    count = await db.incoming_queue.count_documents({"status": "pending"})
    return {"pending_count": count}

@api_router.get("/incoming-queue/{queue_id}", response_model=IncomingQueueResponse)
async def get_incoming_queue_entry(
    queue_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get a specific incoming queue entry"""
    entry = await db.incoming_queue.find_one({"id": queue_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")
    return IncomingQueueResponse(**entry)

@api_router.post("/incoming-queue", response_model=IncomingQueueResponse)
async def create_incoming_queue_entry(
    entry_data: IncomingQueueCreate,
    user: dict = Depends(require_roles(["admin", "accountant", "gate"]))
):
    """Manually create an incoming queue entry (for items without tracking)"""
    now = datetime.now(timezone.utc)
    queue_id = str(uuid.uuid4())
    
    queue_entry = {
        "id": queue_id,
        "queue_number": generate_queue_number(),
        "tracking_id": entry_data.tracking_id,
        "courier": entry_data.courier,
        "source": entry_data.source or "manual_entry",
        "gate_log_id": None,
        "linked_ticket_id": None,
        "linked_ticket_number": None,
        "linked_dispatch_id": None,
        "linked_dispatch_number": None,
        "customer_name": None,
        "status": "pending",
        "classification_type": None,
        "classified_firm_id": None,
        "classified_firm_name": None,
        "classified_item_type": None,
        "classified_item_id": None,
        "classified_item_name": None,
        "classified_item_sku": None,
        "classified_quantity": None,
        "classified_ticket_id": None,
        "original_dispatch_id": None,
        "original_dispatch_number": None,
        "reason": None,
        "reference_number": None,
        "scrap_reason": None,
        "remarks": entry_data.notes,
        "ledger_entry_id": None,
        "ledger_entry_number": None,
        "scanned_by": user["id"],
        "scanned_by_name": f"{user['first_name']} {user['last_name']}",
        "scanned_at": now.isoformat(),
        "classified_by": None,
        "classified_by_name": None,
        "classified_at": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.incoming_queue.insert_one(queue_entry)
    queue_entry.pop("_id", None)
    return IncomingQueueResponse(**queue_entry)

@api_router.post("/incoming-queue/{queue_id}/classify", response_model=IncomingQueueResponse)
async def classify_incoming_queue_entry(
    queue_id: str,
    classify_data: IncomingQueueClassify,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Classify an incoming queue entry.
    This is where stock impact happens based on classification type.
    """
    now = datetime.now(timezone.utc)
    
    # Get the queue entry
    queue_entry = await db.incoming_queue.find_one({"id": queue_id})
    if not queue_entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")
    
    if queue_entry.get("status") == "processed":
        raise HTTPException(status_code=400, detail="This entry has already been processed")
    
    # Validate classification type
    if classify_data.classification_type not in INCOMING_CLASSIFICATION_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid classification type. Must be one of: {INCOMING_CLASSIFICATION_TYPES}")
    
    update_data = {
        "status": "classified",
        "classification_type": classify_data.classification_type,
        "classified_by": user["id"],
        "classified_by_name": f"{user['first_name']} {user['last_name']}",
        "classified_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "remarks": classify_data.remarks
    }
    
    ledger_entry_id = None
    ledger_entry_number = None
    
    # ============ CLASSIFICATION LOGIC ============
    
    if classify_data.classification_type == "repair_item":
        # Link to ticket, send to technician queue, NO stock impact
        if not classify_data.ticket_id:
            raise HTTPException(status_code=400, detail="ticket_id is required for repair_item classification")
        
        ticket = await db.tickets.find_one({"id": classify_data.ticket_id})
        if not ticket:
            raise HTTPException(status_code=400, detail="Ticket not found")
        
        update_data["classified_ticket_id"] = classify_data.ticket_id
        update_data["status"] = "processed"
        
        # Update ticket status to indicate item received for repair
        await db.tickets.update_one(
            {"id": classify_data.ticket_id},
            {"$set": {"status": "in_repair_queue", "updated_at": now.isoformat()}}
        )
        await add_ticket_history(classify_data.ticket_id, "Item received - Sent to repair queue", user, {
            "queue_id": queue_id,
            "queue_number": queue_entry.get("queue_number")
        })
        
    elif classify_data.classification_type == "return_inventory":
        # Return to inventory - create return_in ledger entry
        if not classify_data.firm_id:
            raise HTTPException(status_code=400, detail="firm_id is required for return_inventory classification")
        if not classify_data.item_id and not classify_data.sku_code:
            raise HTTPException(status_code=400, detail="item_id or sku_code is required for return_inventory classification")
        
        # Validate firm
        firm = await db.firms.find_one({"id": classify_data.firm_id, "is_active": True})
        if not firm:
            raise HTTPException(status_code=400, detail="Invalid or inactive firm")
        
        # Get item details
        item_type = classify_data.item_type or "finished_good"
        if item_type == "raw_material":
            if classify_data.item_id:
                item = await db.raw_materials.find_one({"id": classify_data.item_id})
            else:
                item = await db.raw_materials.find_one({"sku_code": classify_data.sku_code.upper()})
            if not item:
                raise HTTPException(status_code=400, detail="Raw material not found")
            item_id = item["id"]
            item_name = item.get("name")
            item_sku = item.get("sku_code")
            # Get stock from ledger for this firm
            last_entry = await db.inventory_ledger.find_one(
                {"item_id": item_id, "firm_id": classify_data.firm_id, "item_type": "raw_material"},
                sort=[("created_at", -1)]
            )
            current_stock = last_entry.get("running_balance", 0) if last_entry else 0
        else:  # finished_good
            if classify_data.item_id:
                item = await db.skus.find_one({"id": classify_data.item_id, "firm_id": classify_data.firm_id})
            else:
                item = await db.skus.find_one({"sku_code": classify_data.sku_code, "firm_id": classify_data.firm_id})
            if not item:
                raise HTTPException(status_code=400, detail="SKU not found for this firm")
            item_id = item["id"]
            item_name = item.get("model_name")
            item_sku = item.get("sku_code")
            current_stock = item.get("stock_quantity", 0)
        
        quantity = classify_data.quantity or 1
        
        # Validate against original dispatch if linked
        original_dispatch = None
        original_dispatch_number = None
        if classify_data.original_dispatch_id:
            original_dispatch = await db.dispatches.find_one({"id": classify_data.original_dispatch_id})
            if original_dispatch:
                original_dispatch_number = original_dispatch.get("dispatch_number")
                # Check if already received
                existing_return = await db.inventory_ledger.find_one({
                    "entry_type": "return_in",
                    "reference_id": classify_data.original_dispatch_id
                })
                if existing_return:
                    raise HTTPException(status_code=400, detail="This dispatch has already been received back. Duplicate receipt not allowed.")
                
                # Validate quantity doesn't exceed original dispatch
                # Original dispatch quantity is 1 per dispatch
                if quantity > 1:
                    raise HTTPException(status_code=400, detail="Cannot receive more quantity than originally dispatched (1 per dispatch)")
        
        # Create return_in ledger entry
        ledger_entry_id = str(uuid.uuid4())
        ledger_entry_number = generate_ledger_entry_number()
        running_balance = current_stock + quantity
        
        ledger_entry = {
            "id": ledger_entry_id,
            "entry_number": ledger_entry_number,
            "entry_type": "return_in",
            "item_type": item_type,
            "item_id": item_id,
            "item_name": item_name,
            "item_sku": item_sku,
            "firm_id": classify_data.firm_id,
            "firm_name": firm.get("name"),
            "quantity": quantity,
            "running_balance": running_balance,
            "unit_price": None,
            "total_value": None,
            "invoice_number": None,
            "reason": f"Return from {queue_entry.get('customer_name') or 'customer'}",
            "reference_id": classify_data.original_dispatch_id or queue_id,
            "notes": f"Queue: {queue_entry.get('queue_number')}, Tracking: {queue_entry.get('tracking_id')}",
            "created_by": user["id"],
            "created_by_name": f"{user['first_name']} {user['last_name']}",
            "created_at": now.isoformat(),
            "dispatch_id": classify_data.original_dispatch_id,
            "dispatch_number": original_dispatch_number,
            "queue_id": queue_id,
            "queue_number": queue_entry.get("queue_number")
        }
        await db.inventory_ledger.insert_one(ledger_entry)
        
        # Update stock
        if item_type == "raw_material":
            await db.raw_materials.update_one(
                {"id": item_id},
                {"$set": {"current_stock": running_balance, "updated_at": now.isoformat()}}
            )
        else:
            await db.skus.update_one(
                {"id": item_id},
                {"$set": {"stock_quantity": running_balance, "updated_at": now.isoformat()}}
            )
        
        # Create audit log
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "return_stock_added",
            "entity_type": "incoming_queue",
            "entity_id": queue_id,
            "entity_name": queue_entry.get("queue_number"),
            "performed_by": user["id"],
            "performed_by_name": f"{user['first_name']} {user['last_name']}",
            "details": {
                "classification": "return_inventory",
                "item_sku": item_sku,
                "firm_id": classify_data.firm_id,
                "quantity": quantity,
                "previous_stock": current_stock,
                "new_stock": running_balance,
                "ledger_entry_id": ledger_entry_id,
                "original_dispatch_id": classify_data.original_dispatch_id
            },
            "timestamp": now.isoformat()
        })
        
        update_data.update({
            "classified_firm_id": classify_data.firm_id,
            "classified_firm_name": firm.get("name"),
            "classified_item_type": item_type,
            "classified_item_id": item_id,
            "classified_item_name": item_name,
            "classified_item_sku": item_sku,
            "classified_quantity": quantity,
            "original_dispatch_id": classify_data.original_dispatch_id,
            "original_dispatch_number": original_dispatch_number,
            "ledger_entry_id": ledger_entry_id,
            "ledger_entry_number": ledger_entry_number,
            "status": "processed"
        })
        
    elif classify_data.classification_type == "repair_yard":
        # Repair yard / recovered stock - create repair_yard_in ledger entry
        if not classify_data.firm_id:
            raise HTTPException(status_code=400, detail="firm_id is required for repair_yard classification")
        if not classify_data.item_id and not classify_data.sku_code:
            raise HTTPException(status_code=400, detail="item_id or sku_code is required for repair_yard classification")
        if not classify_data.reason:
            raise HTTPException(status_code=400, detail="reason is MANDATORY for repair_yard stock addition")
        
        # Validate firm
        firm = await db.firms.find_one({"id": classify_data.firm_id, "is_active": True})
        if not firm:
            raise HTTPException(status_code=400, detail="Invalid or inactive firm")
        
        # Get item details
        item_type = classify_data.item_type or "finished_good"
        if item_type == "raw_material":
            if classify_data.item_id:
                item = await db.raw_materials.find_one({"id": classify_data.item_id})
            else:
                item = await db.raw_materials.find_one({"sku_code": classify_data.sku_code.upper()})
            if not item:
                raise HTTPException(status_code=400, detail="Raw material not found")
            item_id = item["id"]
            item_name = item.get("name")
            item_sku = item.get("sku_code")
            # Get stock from ledger for this firm
            last_entry = await db.inventory_ledger.find_one(
                {"item_id": item_id, "firm_id": classify_data.firm_id, "item_type": "raw_material"},
                sort=[("created_at", -1)]
            )
            current_stock = last_entry.get("running_balance", 0) if last_entry else 0
        else:  # finished_good
            if classify_data.item_id:
                item = await db.skus.find_one({"id": classify_data.item_id, "firm_id": classify_data.firm_id})
            else:
                item = await db.skus.find_one({"sku_code": classify_data.sku_code, "firm_id": classify_data.firm_id})
            if not item:
                raise HTTPException(status_code=400, detail="SKU not found for this firm")
            item_id = item["id"]
            item_name = item.get("model_name")
            item_sku = item.get("sku_code")
            current_stock = item.get("stock_quantity", 0)
        
        quantity = classify_data.quantity or 1
        
        # Create repair_yard_in ledger entry
        ledger_entry_id = str(uuid.uuid4())
        ledger_entry_number = generate_ledger_entry_number()
        running_balance = current_stock + quantity
        
        ledger_entry = {
            "id": ledger_entry_id,
            "entry_number": ledger_entry_number,
            "entry_type": "repair_yard_in",
            "item_type": item_type,
            "item_id": item_id,
            "item_name": item_name,
            "item_sku": item_sku,
            "firm_id": classify_data.firm_id,
            "firm_name": firm.get("name"),
            "quantity": quantity,
            "running_balance": running_balance,
            "unit_price": None,
            "total_value": None,
            "invoice_number": classify_data.reference_number,
            "reason": classify_data.reason,
            "reference_id": queue_id,
            "notes": f"Source: Repair Yard. Queue: {queue_entry.get('queue_number')}. {classify_data.remarks or ''}",
            "created_by": user["id"],
            "created_by_name": f"{user['first_name']} {user['last_name']}",
            "created_at": now.isoformat(),
            "source": "repair_yard",
            "reference_number": classify_data.reference_number,
            "queue_id": queue_id,
            "queue_number": queue_entry.get("queue_number")
        }
        await db.inventory_ledger.insert_one(ledger_entry)
        
        # Update stock
        if item_type == "raw_material":
            await db.raw_materials.update_one(
                {"id": item_id},
                {"$set": {"current_stock": running_balance, "updated_at": now.isoformat()}}
            )
        else:
            await db.skus.update_one(
                {"id": item_id},
                {"$set": {"stock_quantity": running_balance, "updated_at": now.isoformat()}}
            )
        
        # Create audit log
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "repair_yard_stock_added",
            "entity_type": "incoming_queue",
            "entity_id": queue_id,
            "entity_name": queue_entry.get("queue_number"),
            "performed_by": user["id"],
            "performed_by_name": f"{user['first_name']} {user['last_name']}",
            "details": {
                "classification": "repair_yard",
                "item_sku": item_sku,
                "firm_id": classify_data.firm_id,
                "quantity": quantity,
                "previous_stock": current_stock,
                "new_stock": running_balance,
                "reason": classify_data.reason,
                "reference_number": classify_data.reference_number,
                "ledger_entry_id": ledger_entry_id
            },
            "timestamp": now.isoformat()
        })
        
        update_data.update({
            "classified_firm_id": classify_data.firm_id,
            "classified_firm_name": firm.get("name"),
            "classified_item_type": item_type,
            "classified_item_id": item_id,
            "classified_item_name": item_name,
            "classified_item_sku": item_sku,
            "classified_quantity": quantity,
            "reason": classify_data.reason,
            "reference_number": classify_data.reference_number,
            "ledger_entry_id": ledger_entry_id,
            "ledger_entry_number": ledger_entry_number,
            "status": "processed"
        })
        
    elif classify_data.classification_type == "scrap":
        # Mark as scrap - NO stock impact
        if not classify_data.scrap_reason:
            raise HTTPException(status_code=400, detail="scrap_reason is required for scrap classification")
        
        update_data.update({
            "scrap_reason": classify_data.scrap_reason,
            "status": "processed"
        })
        
        # Create audit log
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "incoming_marked_scrap",
            "entity_type": "incoming_queue",
            "entity_id": queue_id,
            "entity_name": queue_entry.get("queue_number"),
            "performed_by": user["id"],
            "performed_by_name": f"{user['first_name']} {user['last_name']}",
            "details": {
                "classification": "scrap",
                "scrap_reason": classify_data.scrap_reason,
                "tracking_id": queue_entry.get("tracking_id")
            },
            "timestamp": now.isoformat()
        })
    
    # ============ END CLASSIFICATION LOGIC ============
    
    # Update the queue entry
    await db.incoming_queue.update_one({"id": queue_id}, {"$set": update_data})
    
    # Fetch and return updated entry
    updated_entry = await db.incoming_queue.find_one({"id": queue_id}, {"_id": 0})
    return IncomingQueueResponse(**updated_entry)

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
    pending_extensions = await db.warranties.count_documents({"extension_status": "pending"})
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
        "pending_extensions": pending_extensions,
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
async def get_admin_users(
    include_customers: bool = False,
    user: dict = Depends(require_roles(["admin"]))
):
    """Get all users (staff only by default, or all if include_customers=true)"""
    query = {} if include_customers else {"role": {"$ne": "customer"}}
    users = await db.users.find(
        query,
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(10000)
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

@api_router.patch("/admin/users/{user_id}")
async def update_user(
    user_id: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    role: Optional[str] = None,
    password: Optional[str] = None,
    user: dict = Depends(require_roles(["admin"]))
):
    """Update user details"""
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if first_name:
        update_data["first_name"] = first_name
    if last_name:
        update_data["last_name"] = last_name
    if email:
        # Check if email is already taken by another user
        existing = await db.users.find_one({"email": email.lower(), "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_data["email"] = email.lower()
    if phone:
        update_data["phone"] = phone
    if role:
        if role not in ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        update_data["role"] = role
    if password:
        if len(password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        update_data["password_hash"] = hash_password(password)
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated_user

@api_router.get("/admin/agent-performance")
async def get_agent_performance(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user: dict = Depends(require_roles(["admin"]))
):
    """Get detailed agent performance analytics for team meetings"""
    # Get all agents (support, supervisor, technicians, accountants)
    agents = await db.users.find(
        {"role": {"$in": ["call_support", "supervisor", "service_agent", "accountant"]}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "role": 1, "email": 1}
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

# ==================== SKU/INVENTORY MANAGEMENT ====================

@api_router.get("/admin/skus")
async def get_skus(
    search: Optional[str] = None,
    category: Optional[str] = None,
    firm_id: Optional[str] = None,
    active_only: bool = True,
    in_stock_only: bool = False,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get all SKUs for inventory management, optionally filtered by firm"""
    query = {}
    if active_only:
        query["active"] = True
    if category:
        query["category"] = category
    if firm_id:
        query["firm_id"] = firm_id
    if in_stock_only:
        query["stock_quantity"] = {"$gt": 0}
    if search:
        query["$or"] = [
            {"sku_code": {"$regex": search, "$options": "i"}},
            {"model_name": {"$regex": search, "$options": "i"}}
        ]
    
    skus = await db.skus.find(query, {"_id": 0}).sort("sku_code", 1).to_list(10000)
    
    # If filtering by firm, enrich with firm names
    if firm_id:
        firm = await db.firms.find_one({"id": firm_id}, {"_id": 0, "name": 1})
        for sku in skus:
            sku["firm_name"] = firm.get("name") if firm else None
    
    return skus

@api_router.post("/admin/skus")
async def create_sku(sku_data: SKUCreate, user: dict = Depends(require_roles(["admin"]))):
    """Create new SKU"""
    # Check for duplicate SKU code within the same firm (or globally if no firm)
    dup_query = {"sku_code": sku_data.sku_code}
    if sku_data.firm_id:
        dup_query["firm_id"] = sku_data.firm_id
    existing = await db.skus.find_one(dup_query)
    if existing:
        raise HTTPException(status_code=400, detail="SKU code already exists" + (" for this firm" if sku_data.firm_id else ""))
    
    # Validate firm if provided
    firm_name = None
    if sku_data.firm_id:
        firm = await db.firms.find_one({"id": sku_data.firm_id, "is_active": True})
        if not firm:
            raise HTTPException(status_code=400, detail="Invalid or inactive firm")
        firm_name = firm.get("name")
    
    now = datetime.now(timezone.utc).isoformat()
    sku_doc = {
        "id": str(uuid.uuid4()),
        "sku_code": sku_data.sku_code,
        "model_name": sku_data.model_name,
        "category": sku_data.category,
        "stock_quantity": sku_data.stock_quantity,
        "min_stock_alert": sku_data.min_stock_alert,
        "firm_id": sku_data.firm_id,
        "firm_name": firm_name,
        "active": True,
        "created_at": now,
        "updated_at": now
    }
    
    await db.skus.insert_one(sku_doc)
    sku_doc.pop("_id", None)
    return sku_doc

@api_router.patch("/admin/skus/{sku_id}")
async def update_sku(sku_id: str, sku_data: SKUUpdate, user: dict = Depends(require_roles(["admin"]))):
    """Update SKU"""
    sku = await db.skus.find_one({"id": sku_id})
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    update_dict = {k: v for k, v in sku_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.skus.update_one({"id": sku_id}, {"$set": update_dict})
    
    updated = await db.skus.find_one({"id": sku_id}, {"_id": 0})
    return updated

@api_router.post("/admin/skus/{sku_id}/adjust-stock")
async def adjust_sku_stock(
    sku_id: str,
    adjustment: int,
    reason: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Adjust SKU stock quantity with compliance validation"""
    sku = await db.skus.find_one({"id": sku_id})
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    new_quantity = sku["stock_quantity"] + adjustment
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")
    
    # ====== COMPLIANCE VALIDATION FOR STOCK ADJUSTMENT ======
    adjustment_value = abs(adjustment * (sku.get("cost_price", 0) or 0))
    compliance_data = {
        "sku_code": sku["sku_code"],
        "adjustment": adjustment,
        "reason": reason,
        "firm_id": sku.get("firm_id"),
        "user_id": user["id"]
    }
    
    compliance_result = validate_document_compliance(
        "stock_adjustment",
        compliance_data,
        {},  # No files for stock adjustment
        adjustment_value
    )
    
    # Hard block for stock adjustments without reason
    if not reason or len(reason.strip()) < 5:
        raise HTTPException(status_code=400, detail="Reason is MANDATORY for stock adjustments (minimum 5 characters)")
    
    now = datetime.now(timezone.utc).isoformat()
    adjustment_id = str(uuid.uuid4())
    
    await db.skus.update_one(
        {"id": sku_id},
        {"$set": {"stock_quantity": new_quantity, "updated_at": now}}
    )
    
    # Log the adjustment with compliance info
    log_doc = {
        "id": adjustment_id,
        "sku_id": sku_id,
        "sku_code": sku["sku_code"],
        "firm_id": sku.get("firm_id"),
        "adjustment": adjustment,
        "new_quantity": new_quantity,
        "reason": reason,
        "value": adjustment_value,
        "doc_status": compliance_result["status"],
        "compliance_score": compliance_result["compliance_score"],
        "compliance_issues": compliance_result.get("warnings", []),
        "adjusted_by": user["id"],
        "adjusted_by_name": f"{user['first_name']} {user['last_name']}",
        "adjusted_at": now
    }
    await db.stock_logs.insert_one(log_doc)
    
    # Create compliance exception for high-value adjustments with issues
    if compliance_result["status"] == "pending" and (compliance_result["soft_blocks"] or compliance_result["warnings"]):
        await create_compliance_exception(
            transaction_type="stock_adjustment",
            transaction_id=adjustment_id,
            transaction_ref=f"ADJ-{sku['sku_code']}-{adjustment_id[:8]}",
            firm_id=sku.get("firm_id", "default"),
            issues=compliance_result.get("soft_blocks", []) + compliance_result.get("warnings", []),
            severity="important" if adjustment_value > 50000 else "minor",
            user=user
        )
    
    return {"message": "Stock adjusted", "new_quantity": new_quantity, "doc_status": compliance_result["status"]}

# ==================== SUPERVISOR ENDPOINTS ====================

@api_router.get("/supervisor/queue")
async def get_supervisor_queue(user: dict = Depends(require_roles(["supervisor", "admin"]))):
    """Get tickets escalated to supervisor"""
    tickets = await db.tickets.find(
        {"status": {"$in": ["escalated_to_supervisor", "supervisor_followup", "customer_escalated"]}},
        {"_id": 0}
    ).sort("escalated_at", 1).to_list(100)
    
    # Calculate 48-hour SLA for each
    now = datetime.now(timezone.utc)
    for ticket in tickets:
        if ticket.get("escalated_at"):
            escalated = datetime.fromisoformat(ticket["escalated_at"].replace('Z', '+00:00'))
            supervisor_sla_due = escalated + timedelta(hours=SLA_CONFIG["supervisor"])
            ticket["supervisor_sla_due"] = supervisor_sla_due.isoformat()
            ticket["supervisor_sla_breached"] = now > supervisor_sla_due
            hours_remaining = (supervisor_sla_due - now).total_seconds() / 3600
            ticket["supervisor_hours_remaining"] = max(0, round(hours_remaining, 1))
        
        # Mark customer escalated tickets as urgent
        if ticket.get("status") == "customer_escalated":
            ticket["is_urgent"] = True
    
    return tickets

@api_router.get("/supervisor/stats")
async def get_supervisor_stats(user: dict = Depends(require_roles(["supervisor", "admin"]))):
    """Get supervisor dashboard stats"""
    escalated = await db.tickets.count_documents({"status": {"$in": ["escalated_to_supervisor", "supervisor_followup"]}})
    customer_escalated = await db.tickets.count_documents({"status": "customer_escalated"})
    resolved_today = await db.tickets.count_documents({
        "resolved_by": user["id"] if user["role"] == "supervisor" else {"$exists": True},
        "closed_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()}
    })
    
    return {
        "escalated_tickets": escalated,
        "customer_escalated": customer_escalated,
        "urgent_tickets": customer_escalated,
        "resolved_today": resolved_today
    }

@api_router.get("/supervisor/customer-warranties")
async def get_customer_warranties_for_supervisor(
    customer_id: Optional[str] = None,
    phone: Optional[str] = None,
    user: dict = Depends(require_roles(["supervisor", "admin"]))
):
    """Get all warranties for a customer - supervisor can see all customer data"""
    if not customer_id and not phone:
        return []
    
    query = {}
    if customer_id:
        query["$or"] = [{"customer_id": customer_id}, {"user_id": customer_id}]
    if phone:
        if "$or" in query:
            query["$or"].extend([{"phone": phone}, {"customer_phone": phone}])
        else:
            query["$or"] = [{"phone": phone}, {"customer_phone": phone}]
    
    warranties = await db.warranties.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return warranties

@api_router.get("/supervisor/customer-tickets")
async def get_customer_tickets_for_supervisor(
    customer_id: Optional[str] = None,
    phone: Optional[str] = None,
    user: dict = Depends(require_roles(["supervisor", "admin"]))
):
    """Get all tickets for a customer - supervisor can see full customer history"""
    if not customer_id and not phone:
        return []
    
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    elif phone:
        query["customer_phone"] = phone
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return tickets

# ==================== DETAILED PERFORMANCE REPORTS ====================

@api_router.get("/admin/detailed-performance")
async def get_detailed_performance(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user: dict = Depends(require_roles(["admin"]))
):
    """Get detailed performance report for team meetings"""
    now = datetime.now(timezone.utc)
    
    # Default to last 30 days
    if not from_date:
        from_date = (now - timedelta(days=30)).isoformat()
    if not to_date:
        to_date = now.isoformat()
    
    # Get all agents
    agents = await db.users.find(
        {"role": {"$in": ["call_support", "supervisor", "service_agent", "accountant"]}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "role": 1, "email": 1}
    ).to_list(50)
    
    performance_data = []
    
    for agent in agents:
        agent_id = agent["id"]
        
        # Tickets handled (assigned_to or escalated_by or resolved_by)
        tickets_handled = await db.tickets.count_documents({
            "$or": [
                {"assigned_to": agent_id},
                {"escalated_by": agent_id},
                {"resolved_by": agent_id}
            ],
            "created_at": {"$gte": from_date, "$lte": to_date}
        })
        
        # Tickets closed
        tickets_closed = await db.tickets.count_documents({
            "$or": [{"assigned_to": agent_id}, {"resolved_by": agent_id}],
            "status": {"$in": ["closed", "closed_by_agent", "resolved_on_call"]},
            "closed_at": {"$gte": from_date, "$lte": to_date}
        })
        
        # SLA breaches
        sla_breaches = await db.tickets.count_documents({
            "assigned_to": agent_id,
            "sla_breached": True,
            "created_at": {"$gte": from_date, "$lte": to_date}
        })
        
        # Escalations made (for support agents)
        escalations_made = await db.tickets.count_documents({
            "escalated_by": agent_id,
            "escalated_at": {"$gte": from_date, "$lte": to_date}
        })
        
        # Average resolution time
        closed_tickets = await db.tickets.find(
            {
                "$or": [{"assigned_to": agent_id}, {"resolved_by": agent_id}],
                "closed_at": {"$ne": None, "$gte": from_date, "$lte": to_date}
            },
            {"_id": 0, "created_at": 1, "closed_at": 1}
        ).to_list(1000)
        
        avg_resolution_hours = 0
        if closed_tickets:
            total_hours = 0
            valid_count = 0
            for t in closed_tickets:
                try:
                    created = datetime.fromisoformat(t["created_at"].replace('Z', '+00:00'))
                    closed = datetime.fromisoformat(t["closed_at"].replace('Z', '+00:00'))
                    total_hours += (closed - created).total_seconds() / 3600
                    valid_count += 1
                except:
                    pass
            if valid_count > 0:
                avg_resolution_hours = round(total_hours / valid_count, 1)
        
        # Calculate performance score (0-100)
        sla_compliance = ((tickets_handled - sla_breaches) / tickets_handled * 100) if tickets_handled > 0 else 100
        closure_rate = (tickets_closed / tickets_handled * 100) if tickets_handled > 0 else 0
        performance_score = round((sla_compliance * 0.6 + closure_rate * 0.4), 1)
        
        performance_data.append({
            "agent_id": agent_id,
            "agent_name": f"{agent['first_name']} {agent['last_name']}",
            "email": agent["email"],
            "role": agent["role"],
            "tickets_handled": tickets_handled,
            "tickets_closed": tickets_closed,
            "sla_breaches": sla_breaches,
            "escalations_made": escalations_made,
            "avg_resolution_hours": avg_resolution_hours,
            "sla_compliance_rate": round(sla_compliance, 1),
            "closure_rate": round(closure_rate, 1),
            "performance_score": performance_score
        })
    
    # Sort by performance score descending
    performance_data.sort(key=lambda x: x["performance_score"], reverse=True)
    
    # Calculate team totals
    team_totals = {
        "total_tickets": sum(p["tickets_handled"] for p in performance_data),
        "total_closed": sum(p["tickets_closed"] for p in performance_data),
        "total_sla_breaches": sum(p["sla_breaches"] for p in performance_data),
        "avg_team_score": round(sum(p["performance_score"] for p in performance_data) / len(performance_data), 1) if performance_data else 0
    }
    
    # Breakdown by role
    role_breakdown = {}
    for role in ["call_support", "supervisor", "service_agent", "accountant"]:
        role_agents = [p for p in performance_data if p["role"] == role]
        if role_agents:
            role_breakdown[role] = {
                "agent_count": len(role_agents),
                "total_tickets": sum(p["tickets_handled"] for p in role_agents),
                "avg_score": round(sum(p["performance_score"] for p in role_agents) / len(role_agents), 1)
            }
    
    return {
        "period": {"from": from_date, "to": to_date},
        "agents": performance_data,
        "team_totals": team_totals,
        "role_breakdown": role_breakdown
    }

# ==================== TECHNICIAN ENDPOINTS ====================

@api_router.post("/technician/walkin-ticket")
async def create_walkin_ticket(
    customer_name: str = Form(...),
    customer_phone: str = Form(...),
    customer_email: Optional[str] = Form(None),
    device_type: str = Form(...),
    issue_description: str = Form(...),
    serial_number: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    pincode: Optional[str] = Form(None),
    user: dict = Depends(require_roles(["service_agent", "admin"]))
):
    """Technician creates walk-in customer ticket - goes direct to repair, skips accountant after repair"""
    now = datetime.now(timezone.utc)
    
    # Find or create customer
    customer = await db.users.find_one({"phone": customer_phone, "role": "customer"}, {"_id": 0})
    
    if not customer:
        customer_id = str(uuid.uuid4())
        customer = {
            "id": customer_id,
            "email": customer_email or f"walkin_{customer_phone}@musclegrid.in",
            "first_name": customer_name.split()[0] if customer_name else "Walk-in",
            "last_name": " ".join(customer_name.split()[1:]) if len(customer_name.split()) > 1 else "Customer",
            "phone": customer_phone,
            "address": address,
            "city": city,
            "state": state,
            "pincode": pincode,
            "role": "customer",
            "password_hash": "",  # Walk-in customers can't login initially
            "created_at": now.isoformat(),
            "is_walkin_customer": True
        }
        await db.users.insert_one(customer)
    else:
        customer_id = customer["id"]
    
    # Generate ticket number
    date_str = now.strftime("%Y%m%d")
    random_suffix = str(random.randint(10000, 99999))
    ticket_number = f"MG-W-{date_str}-{random_suffix}"  # W for Walk-in
    
    ticket = {
        "id": str(uuid.uuid4()),
        "ticket_number": ticket_number,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "customer_email": customer_email,
        "device_type": device_type,
        "serial_number": serial_number,
        "issue_description": issue_description,
        "support_type": "hardware",
        "status": "received_at_factory",  # Start directly at factory
        "priority": "medium",
        "is_walkin": True,  # Flag for walk-in
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "assigned_to": user["id"],  # Auto-assign to technician who created it
        "address": address,
        "city": city,
        "state": state,
        "pincode": pincode,
        "received_at": now.isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.tickets.insert_one(ticket)
    
    await add_ticket_history(ticket["id"], "Walk-in ticket created by technician", user, {
        "device_type": device_type,
        "issue": issue_description
    })
    
    return {
        "message": "Walk-in ticket created successfully",
        "ticket_number": ticket_number,
        "ticket_id": ticket["id"]
    }

@api_router.get("/technician/queue")
async def get_technician_queue(user: dict = Depends(require_roles(["service_agent", "admin"]))):
    """Get tickets received at factory awaiting repair"""
    tickets = await db.tickets.find(
        {"status": {"$in": ["received_at_factory", "in_repair_queue", "in_repair"]}},
        {"_id": 0}
    ).sort("received_at", 1).to_list(100)
    
    # Calculate 72-hour SLA for each and collect notes
    now = datetime.now(timezone.utc)
    for ticket in tickets:
        if ticket.get("received_at"):
            received = datetime.fromisoformat(ticket["received_at"].replace('Z', '+00:00'))
            repair_sla_due = received + timedelta(hours=72)
            ticket["repair_sla_due"] = repair_sla_due.isoformat()
            ticket["repair_sla_breached"] = now > repair_sla_due
            hours_remaining = (repair_sla_due - now).total_seconds() / 3600
            ticket["repair_hours_remaining"] = max(0, round(hours_remaining, 1))
        
        # Collect all notes for technician view
        all_notes = []
        
        # Customer issue description
        if ticket.get("issue_description"):
            all_notes.append({
                "source": "Customer",
                "type": "issue",
                "content": ticket["issue_description"]
            })
        
        # Call support diagnosis/notes
        if ticket.get("diagnosis"):
            all_notes.append({
                "source": "Call Support",
                "type": "diagnosis",
                "content": ticket["diagnosis"]
            })
        if ticket.get("agent_notes"):
            all_notes.append({
                "source": "Call Support",
                "type": "notes",
                "content": ticket["agent_notes"]
            })
        
        # Supervisor notes
        if ticket.get("supervisor_notes"):
            all_notes.append({
                "source": "Supervisor",
                "type": "notes",
                "content": ticket["supervisor_notes"]
            })
        
        # Supervisor followup notes
        if ticket.get("supervisor_followup_notes"):
            for note in ticket["supervisor_followup_notes"]:
                all_notes.append({
                    "source": "Supervisor",
                    "type": "followup",
                    "content": note.get("notes", ""),
                    "timestamp": note.get("created_at")
                })
        
        ticket["all_notes"] = all_notes
    
    return tickets

@api_router.get("/technician/my-repairs")
async def get_my_repairs(user: dict = Depends(require_roles(["service_agent", "admin"]))):
    """Get tickets assigned to current technician (admin sees all)"""
    # Include ready_for_dispatch for walk-in tickets that skip accountant
    query = {"status": {"$in": ["in_repair", "repair_completed", "ready_for_dispatch"]}}
    if user["role"] == "service_agent":
        query["assigned_to"] = user["id"]
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return tickets

@api_router.get("/admin/all-repairs")
async def get_all_repairs(user: dict = Depends(require_roles(["admin"]))):
    """Admin gets all repair activities with full details including dispatched"""
    # Get all tickets that went through repair process (hardware support type or is_walkin)
    # Include dispatched status to track completed repairs
    tickets = await db.tickets.find(
        {"$or": [
            {"status": {"$in": [
                "received_at_factory", "in_repair", "repair_completed", 
                "service_invoice_added", "ready_for_dispatch", "dispatched"
            ]}},
            {"support_type": "hardware", "status": "dispatched"},
            {"is_walkin": True}
        ]},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(1000)
    
    # Dedupe by ID (since $or might return duplicates)
    seen_ids = set()
    unique_tickets = []
    for t in tickets:
        if t["id"] not in seen_ids:
            seen_ids.add(t["id"])
            unique_tickets.append(t)
    
    tickets = unique_tickets
    
    # Calculate stats
    stats = {
        "total": len(tickets),
        "awaiting_repair": len([t for t in tickets if t.get("status") == "received_at_factory"]),
        "in_repair": len([t for t in tickets if t.get("status") == "in_repair"]),
        "repair_completed": len([t for t in tickets if t.get("status") == "repair_completed"]),
        "awaiting_invoice": len([t for t in tickets if t.get("status") == "service_invoice_added"]),
        "ready_for_dispatch": len([t for t in tickets if t.get("status") == "ready_for_dispatch"]),
        "dispatched": len([t for t in tickets if t.get("status") == "dispatched"]),
        "walkin_count": len([t for t in tickets if t.get("is_walkin")])
    }
    
    return {"tickets": tickets, "stats": stats}

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

# ==================== APPOINTMENT BOOKING ENDPOINTS ====================

@api_router.get("/supervisor/availability")
async def get_supervisor_availability(
    user: dict = Depends(get_current_user)
):
    """Get supervisor availability for booking"""
    # Get the supervisor user
    supervisor = await db.users.find_one({"role": "supervisor"}, {"_id": 0})
    if not supervisor:
        raise HTTPException(status_code=404, detail="No supervisor found")
    
    # Get availability settings
    availability = await db.supervisor_availability.find_one(
        {"supervisor_id": supervisor["id"]}, {"_id": 0}
    )
    
    # Default availability: Mon-Sat 9am-7pm, 30-min slots
    if not availability:
        default_slots = []
        for day in range(6):  # Mon-Sat
            default_slots.append({
                "day_of_week": day,
                "start_time": "09:00",
                "end_time": "19:00",
                "is_available": True
            })
        availability = {
            "supervisor_id": supervisor["id"],
            "supervisor_name": f"{supervisor['first_name']} {supervisor['last_name']}",
            "slots": default_slots,
            "blocked_dates": [],
            "slot_duration": 30  # minutes
        }
    
    return availability

@api_router.post("/supervisor/availability")
async def update_supervisor_availability(
    update: SupervisorAvailabilityUpdate,
    user: dict = Depends(require_roles(["supervisor", "admin"]))
):
    """Supervisor updates their availability"""
    supervisor_id = user["id"] if user["role"] == "supervisor" else None
    
    if not supervisor_id:
        # Admin updating - get the supervisor
        supervisor = await db.users.find_one({"role": "supervisor"}, {"_id": 0})
        if supervisor:
            supervisor_id = supervisor["id"]
    
    if not supervisor_id:
        raise HTTPException(status_code=404, detail="No supervisor found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    availability_doc = {
        "supervisor_id": supervisor_id,
        "supervisor_name": f"{user['first_name']} {user['last_name']}",
        "slots": [s.dict() for s in update.slots],
        "blocked_dates": update.blocked_dates or [],
        "slot_duration": 30,
        "updated_at": now
    }
    
    await db.supervisor_availability.update_one(
        {"supervisor_id": supervisor_id},
        {"$set": availability_doc},
        upsert=True
    )
    
    return {"message": "Availability updated"}

@api_router.get("/appointments/available-slots")
async def get_available_slots(
    date: str,  # YYYY-MM-DD
    user: dict = Depends(get_current_user)
):
    """Get available appointment slots for a specific date"""
    from datetime import datetime as dt
    
    try:
        target_date = dt.strptime(date, "%Y-%m-%d")
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    day_of_week = target_date.weekday()
    
    # Get supervisor availability
    supervisor = await db.users.find_one({"role": "supervisor"}, {"_id": 0})
    if not supervisor:
        return {"slots": [], "message": "No supervisor available"}
    
    availability = await db.supervisor_availability.find_one(
        {"supervisor_id": supervisor["id"]}, {"_id": 0}
    )
    
    # Check if date is blocked
    if availability and date in availability.get("blocked_dates", []):
        return {"slots": [], "message": "This date is blocked"}
    
    # Get the slot for this day
    day_slot = None
    if availability:
        for slot in availability.get("slots", []):
            if slot["day_of_week"] == day_of_week and slot["is_available"]:
                day_slot = slot
                break
    
    # Default: Mon-Sat 9am-7pm
    if not day_slot:
        if day_of_week < 6:  # Mon-Sat
            day_slot = {"start_time": "09:00", "end_time": "19:00"}
        else:
            return {"slots": [], "message": "No availability on this day"}
    
    # Generate 30-minute slots
    start_hour, start_min = map(int, day_slot["start_time"].split(":"))
    end_hour, end_min = map(int, day_slot["end_time"].split(":"))
    
    all_slots = []
    current = start_hour * 60 + start_min
    end = end_hour * 60 + end_min
    
    while current + 30 <= end:
        slot_time = f"{current // 60:02d}:{current % 60:02d}"
        all_slots.append(slot_time)
        current += 30
    
    # Get existing appointments for this date
    existing = await db.appointments.find(
        {"date": date, "status": {"$in": ["pending", "confirmed"]}},
        {"_id": 0, "time_slot": 1}
    ).to_list(100)
    
    booked_slots = [a["time_slot"] for a in existing]
    
    # Filter out booked slots
    available_slots = [s for s in all_slots if s not in booked_slots]
    
    return {
        "date": date,
        "day_of_week": day_of_week,
        "supervisor_name": f"{supervisor['first_name']} {supervisor['last_name']}",
        "slots": available_slots,
        "booked_count": len(booked_slots),
        "total_slots": len(all_slots)
    }

@api_router.post("/appointments")
async def book_appointment(
    appointment: AppointmentCreate,
    user: dict = Depends(require_roles(["customer"]))
):
    """Customer books an appointment with supervisor"""
    # Verify customer has registered warranty
    warranty = await db.warranties.find_one({
        "$or": [{"customer_id": user["id"]}, {"user_id": user["id"]}],
        "status": "approved"
    }, {"_id": 0})
    
    if not warranty:
        raise HTTPException(status_code=403, detail="You must have an approved warranty to book appointments")
    
    # Get supervisor
    supervisor = await db.users.find_one({"role": "supervisor"}, {"_id": 0})
    if not supervisor:
        raise HTTPException(status_code=404, detail="No supervisor available")
    
    # Check slot availability
    existing = await db.appointments.find_one({
        "date": appointment.date,
        "time_slot": appointment.time_slot,
        "status": {"$in": ["pending", "confirmed"]}
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="This slot is already booked")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Calculate end time
    start_parts = appointment.time_slot.split(":")
    end_minutes = int(start_parts[0]) * 60 + int(start_parts[1]) + 30
    end_time = f"{end_minutes // 60:02d}:{end_minutes % 60:02d}"
    
    appointment_doc = {
        "id": str(uuid.uuid4()),
        "customer_id": user["id"],
        "customer_name": f"{user['first_name']} {user['last_name']}",
        "customer_phone": user.get("phone", ""),
        "customer_email": user.get("email", ""),
        "supervisor_id": supervisor["id"],
        "supervisor_name": f"{supervisor['first_name']} {supervisor['last_name']}",
        "date": appointment.date,
        "time_slot": appointment.time_slot,
        "end_time": end_time,
        "reason": appointment.reason,
        "warranty_id": appointment.warranty_id or (warranty.get("id") if warranty else None),
        "status": "pending",
        "notes": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.appointments.insert_one(appointment_doc)
    
    return {"message": "Appointment booked successfully", "appointment_id": appointment_doc["id"]}

@api_router.get("/appointments")
async def get_appointments(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Get appointments - filtered by role"""
    query = {}
    
    if user["role"] == "customer":
        query["customer_id"] = user["id"]
    elif user["role"] == "supervisor":
        query["supervisor_id"] = user["id"]
    # Admin sees all
    
    if status:
        query["status"] = status
    
    appointments = await db.appointments.find(query, {"_id": 0}).sort("date", -1).to_list(200)
    return appointments

@api_router.patch("/appointments/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: str,
    status: str,
    notes: Optional[str] = None,
    user: dict = Depends(require_roles(["supervisor", "admin"]))
):
    """Supervisor updates appointment status"""
    valid_statuses = ["confirmed", "completed", "cancelled", "no_show"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use: {valid_statuses}")
    
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    update_data = {"status": status, "updated_at": now}
    if notes:
        update_data["notes"] = notes
    if status == "completed":
        update_data["completed_at"] = now
        update_data["completed_by"] = user["id"]
    
    await db.appointments.update_one({"id": appointment_id}, {"$set": update_data})
    
    return {"message": f"Appointment marked as {status}"}

@api_router.delete("/appointments/{appointment_id}")
async def cancel_appointment(
    appointment_id: str,
    user: dict = Depends(get_current_user)
):
    """Customer or supervisor cancels appointment"""
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Verify ownership
    if user["role"] == "customer" and appointment["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if appointment["status"] in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this appointment")
    
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {"status": "cancelled", "cancelled_by": user["id"], "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Appointment cancelled"}

# ==================== FEEDBACK SURVEY ENDPOINTS ====================

@api_router.post("/feedback")
async def submit_feedback(
    feedback: FeedbackSubmit,
    user: dict = Depends(require_roles(["customer"]))
):
    """Customer submits feedback for ticket or appointment"""
    if not feedback.ticket_id and not feedback.appointment_id:
        raise HTTPException(status_code=400, detail="Must provide ticket_id or appointment_id")
    
    # Validate ratings
    for rating in [feedback.communication, feedback.resolution_speed, feedback.professionalism, feedback.overall]:
        if rating < 1 or rating > 10:
            raise HTTPException(status_code=400, detail="Ratings must be between 1 and 10")
    
    now = datetime.now(timezone.utc).isoformat()
    staff_id = None
    staff_name = None
    staff_role = None
    ticket_number = None
    feedback_type = "ticket"
    
    if feedback.ticket_id:
        # Check ticket exists and is closed
        ticket = await db.tickets.find_one({"id": feedback.ticket_id}, {"_id": 0})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Check if feedback already submitted
        existing = await db.feedback.find_one({"ticket_id": feedback.ticket_id}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Feedback already submitted for this ticket")
        
        ticket_number = ticket.get("ticket_number")
        # Get the last person who worked on ticket
        if ticket.get("closed_by"):
            staff_user = await db.users.find_one({"id": ticket["closed_by"]}, {"_id": 0})
            if staff_user:
                staff_id = staff_user["id"]
                staff_name = f"{staff_user['first_name']} {staff_user['last_name']}"
                staff_role = staff_user["role"]
        elif ticket.get("assigned_to"):
            staff_user = await db.users.find_one({"id": ticket["assigned_to"]}, {"_id": 0})
            if staff_user:
                staff_id = staff_user["id"]
                staff_name = f"{staff_user['first_name']} {staff_user['last_name']}"
                staff_role = staff_user["role"]
    
    if feedback.appointment_id:
        feedback_type = "appointment"
        appointment = await db.appointments.find_one({"id": feedback.appointment_id}, {"_id": 0})
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        existing = await db.feedback.find_one({"appointment_id": feedback.appointment_id}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Feedback already submitted for this appointment")
        
        staff_id = appointment.get("supervisor_id")
        staff_name = appointment.get("supervisor_name")
        staff_role = "supervisor"
    
    average_score = (feedback.communication + feedback.resolution_speed + feedback.professionalism + feedback.overall) / 4
    
    feedback_doc = {
        "id": str(uuid.uuid4()),
        "ticket_id": feedback.ticket_id,
        "ticket_number": ticket_number,
        "appointment_id": feedback.appointment_id,
        "customer_id": user["id"],
        "customer_name": f"{user['first_name']} {user['last_name']}",
        "staff_id": staff_id,
        "staff_name": staff_name,
        "staff_role": staff_role,
        "communication": feedback.communication,
        "resolution_speed": feedback.resolution_speed,
        "professionalism": feedback.professionalism,
        "overall": feedback.overall,
        "average_score": round(average_score, 2),
        "comments": feedback.comments,
        "feedback_type": feedback_type,
        "created_at": now
    }
    
    await db.feedback.insert_one(feedback_doc)
    
    # Update ticket with feedback_submitted flag
    if feedback.ticket_id:
        await db.tickets.update_one(
            {"id": feedback.ticket_id},
            {"$set": {"feedback_submitted": True, "feedback_score": average_score}}
        )
    
    return {"message": "Thank you for your feedback!", "feedback_id": feedback_doc["id"]}

@api_router.get("/feedback/pending")
async def get_pending_feedback(
    user: dict = Depends(require_roles(["customer"]))
):
    """Get tickets/appointments needing feedback from customer"""
    # Closed tickets without feedback
    closed_tickets = await db.tickets.find({
        "customer_id": user["id"],
        "status": {"$in": ["closed", "resolved", "resolved_on_call"]},
        "feedback_submitted": {"$ne": True}
    }, {"_id": 0, "id": 1, "ticket_number": 1, "issue_description": 1, "closed_at": 1}).to_list(50)
    
    # Completed appointments without feedback
    completed_appointments = await db.appointments.find({
        "customer_id": user["id"],
        "status": "completed"
    }, {"_id": 0}).to_list(50)
    
    # Filter appointments that don't have feedback
    appointment_ids = [a["id"] for a in completed_appointments]
    existing_feedback = await db.feedback.find(
        {"appointment_id": {"$in": appointment_ids}},
        {"_id": 0, "appointment_id": 1}
    ).to_list(100)
    feedback_appointment_ids = [f["appointment_id"] for f in existing_feedback]
    
    pending_appointments = [a for a in completed_appointments if a["id"] not in feedback_appointment_ids]
    
    return {
        "pending_ticket_feedback": closed_tickets,
        "pending_appointment_feedback": pending_appointments
    }

@api_router.get("/admin/feedback")
async def get_all_feedback(
    staff_id: Optional[str] = None,
    feedback_type: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Admin gets all feedback with optional filters"""
    query = {}
    if staff_id:
        query["staff_id"] = staff_id
    if feedback_type:
        query["feedback_type"] = feedback_type
    
    feedback_list = await db.feedback.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    return feedback_list

@api_router.get("/admin/performance-metrics")
async def get_performance_metrics(
    user: dict = Depends(require_roles(["admin"]))
):
    """Admin gets comprehensive performance metrics for all staff"""
    # Get all staff users (include admin too if they handle tickets)
    staff = await db.users.find(
        {"role": {"$in": ["call_support", "supervisor", "service_technician", "accountant", "dispatcher", "admin"]}},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    metrics = []
    
    for member in staff:
        staff_id = member["id"]
        staff_name = f"{member['first_name']} {member['last_name']}"
        
        # Get feedback for this staff member
        feedback_list = await db.feedback.find({"staff_id": staff_id}, {"_id": 0}).to_list(1000)
        
        total_feedback = len(feedback_list)
        avg_communication = 0
        avg_resolution = 0
        avg_professionalism = 0
        avg_overall = 0
        
        if total_feedback > 0:
            avg_communication = sum(f["communication"] for f in feedback_list) / total_feedback
            avg_resolution = sum(f["resolution_speed"] for f in feedback_list) / total_feedback
            avg_professionalism = sum(f["professionalism"] for f in feedback_list) / total_feedback
            avg_overall = sum(f["overall"] for f in feedback_list) / total_feedback
        
        # Get tickets handled
        tickets_closed = await db.tickets.count_documents({"closed_by": staff_id})
        tickets_assigned = await db.tickets.count_documents({"assigned_to": staff_id})
        
        # Get feedback calls completed (for call_support)
        feedback_calls_completed = 0
        if member["role"] in ["call_support", "admin"]:
            feedback_calls_completed = await db.feedback_calls.count_documents({
                "completed_by": staff_id,
                "status": "completed"
            })
        
        # Calculate avg resolution time
        closed_tickets = await db.tickets.find(
            {"closed_by": staff_id, "closed_at": {"$exists": True}, "created_at": {"$exists": True}},
            {"_id": 0, "created_at": 1, "closed_at": 1}
        ).to_list(1000)
        
        avg_resolution_hours = 0
        if closed_tickets:
            total_hours = 0
            count = 0
            for t in closed_tickets:
                try:
                    created = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))
                    closed = datetime.fromisoformat(t["closed_at"].replace("Z", "+00:00"))
                    hours = (closed - created).total_seconds() / 3600
                    total_hours += hours
                    count += 1
                except:
                    pass
            if count > 0:
                avg_resolution_hours = total_hours / count
        
        # Appointments (for supervisor)
        appointments_completed = 0
        appointments_total = 0
        if member["role"] == "supervisor":
            appointments_total = await db.appointments.count_documents({"supervisor_id": staff_id})
            appointments_completed = await db.appointments.count_documents({"supervisor_id": staff_id, "status": "completed"})
        
        # Calculate performance score (weighted composite)
        # Weights: feedback rating (40%), tickets closed (30%), resolution speed (20%), feedback calls (10%)
        performance_score = 0
        if avg_overall > 0:
            performance_score += avg_overall * 4  # 40% weight, scale 0-40
        if tickets_closed > 0:
            performance_score += min(tickets_closed, 100) * 0.3  # 30% weight, max 30 points
        if avg_resolution_hours > 0 and avg_resolution_hours < 72:
            # Lower is better - invert the scale
            resolution_score = (72 - avg_resolution_hours) / 72 * 20  # 20% weight, max 20 points
            performance_score += max(0, resolution_score)
        if feedback_calls_completed > 0:
            performance_score += min(feedback_calls_completed, 50) * 0.2  # 10% weight, max 10 points
        
        metrics.append({
            "staff_id": staff_id,
            "staff_name": staff_name,
            "role": member["role"],
            "total_feedback": total_feedback,
            "avg_communication": round(avg_communication, 2),
            "avg_resolution_speed": round(avg_resolution, 2),
            "avg_professionalism": round(avg_professionalism, 2),
            "avg_overall": round(avg_overall, 2),
            "tickets_closed": tickets_closed,
            "tickets_assigned": tickets_assigned,
            "feedback_calls_completed": feedback_calls_completed,
            "avg_resolution_hours": round(avg_resolution_hours, 1),
            "appointments_total": appointments_total,
            "appointments_completed": appointments_completed,
            "performance_score": round(performance_score, 1)
        })
    
    # Sort by performance score (highest first)
    metrics.sort(key=lambda x: x["performance_score"], reverse=True)
    
    # Overall stats
    total_feedback = await db.feedback.count_documents({})
    all_feedback = await db.feedback.find({}, {"_id": 0}).to_list(5000)
    
    company_avg = 0
    if all_feedback:
        company_avg = sum(f["average_score"] for f in all_feedback) / len(all_feedback)
    
    return {
        "staff_metrics": metrics,
        "company_stats": {
            "total_feedback_received": total_feedback,
            "company_average_score": round(company_avg, 2),
            "total_staff": len(staff)
        }
    }

@api_router.get("/supervisor/appointments")
async def get_supervisor_appointments(
    date: Optional[str] = None,
    user: dict = Depends(require_roles(["supervisor", "admin"]))
):
    """Get supervisor's appointments with stats"""
    supervisor_id = user["id"] if user["role"] == "supervisor" else None
    
    if not supervisor_id:
        supervisor = await db.users.find_one({"role": "supervisor"}, {"_id": 0})
        if supervisor:
            supervisor_id = supervisor["id"]
    
    query = {}
    if supervisor_id:
        query["supervisor_id"] = supervisor_id
    if date:
        query["date"] = date
    
    appointments = await db.appointments.find(query, {"_id": 0}).sort([("date", 1), ("time_slot", 1)]).to_list(10000)
    
    # Stats
    total = len(appointments)
    pending = sum(1 for a in appointments if a["status"] == "pending")
    confirmed = sum(1 for a in appointments if a["status"] == "confirmed")
    completed = sum(1 for a in appointments if a["status"] == "completed")
    cancelled = sum(1 for a in appointments if a["status"] == "cancelled")
    no_show = sum(1 for a in appointments if a["status"] == "no_show")
    
    return {
        "appointments": appointments,
        "stats": {
            "total": total,
            "pending": pending,
            "confirmed": confirmed,
            "completed": completed,
            "cancelled": cancelled,
            "no_show": no_show
        }
    }

# ==================== FEEDBACK CALLS (Amazon Orders) ====================

@api_router.get("/feedback-calls")
async def get_feedback_calls(
    status: Optional[str] = None,
    user: dict = Depends(require_roles(["call_support", "admin"]))
):
    """Get feedback calls for call support agents"""
    query = {}
    if status:
        query["status"] = status
    
    calls = await db.feedback_calls.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    
    # Stats
    total = await db.feedback_calls.count_documents({})
    pending = await db.feedback_calls.count_documents({"status": "pending"})
    completed = await db.feedback_calls.count_documents({"status": "completed"})
    no_answer = await db.feedback_calls.count_documents({"status": "no_answer"})
    
    return {
        "calls": calls,
        "stats": {
            "total": total,
            "pending": pending,
            "completed": completed,
            "no_answer": no_answer
        }
    }

@api_router.patch("/feedback-calls/{call_id}")
async def update_feedback_call(
    call_id: str,
    status: str = Form(...),
    notes: Optional[str] = Form(None),
    screenshot: Optional[UploadFile] = File(None),
    user: dict = Depends(require_roles(["call_support", "admin"]))
):
    """Update feedback call - complete with screenshot or mark no answer"""
    call = await db.feedback_calls.find_one({"id": call_id}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Feedback call not found")
    
    now = datetime.now(timezone.utc).isoformat()
    update = {
        "status": status,
        "notes": notes,
        "call_attempts": call.get("call_attempts", 0) + 1,
        "updated_at": now
    }
    
    if status == "completed":
        # Screenshot is required for completed status
        if not screenshot and not call.get("feedback_screenshot"):
            raise HTTPException(status_code=400, detail="Screenshot is required to complete feedback call")
        
        if screenshot:
            ext = Path(screenshot.filename).suffix
            screenshot_filename = f"feedback_{call_id}{ext}"
            screenshot_path = UPLOAD_DIR / "feedback_screenshots" / screenshot_filename
            (UPLOAD_DIR / "feedback_screenshots").mkdir(parents=True, exist_ok=True)
            with open(screenshot_path, "wb") as f:
                content = await screenshot.read()
                f.write(content)
            update["feedback_screenshot"] = f"/api/files/feedback_screenshots/{screenshot_filename}"
        
        update["completed_by"] = user["id"]
        update["completed_by_name"] = f"{user['first_name']} {user['last_name']}"
        update["completed_at"] = now
    
    await db.feedback_calls.update_one({"id": call_id}, {"$set": update})
    return {"message": f"Feedback call updated to {status}"}

@api_router.get("/call-support/stats")
async def get_call_support_stats(
    user: dict = Depends(require_roles(["call_support", "admin"]))
):
    """Get call support dashboard stats including pending feedback calls"""
    # Pending feedback calls count
    pending_feedback_calls = await db.feedback_calls.count_documents({"status": "pending"})
    
    # Get agent-specific completed calls
    agent_completed_calls = await db.feedback_calls.count_documents({
        "completed_by": user["id"],
        "status": "completed"
    })
    
    return {
        "pending_feedback_calls": pending_feedback_calls,
        "my_completed_feedback_calls": agent_completed_calls
    }

@api_router.get("/admin/feedback-call-performance")
async def get_feedback_call_performance(
    user: dict = Depends(require_roles(["admin"]))
):
    """Get feedback call performance for all call support agents"""
    # Get all call support agents
    agents = await db.users.find(
        {"role": "call_support"},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    performance = []
    for agent in agents:
        completed = await db.feedback_calls.count_documents({
            "completed_by": agent["id"],
            "status": "completed"
        })
        performance.append({
            "agent_id": agent["id"],
            "agent_name": f"{agent['first_name']} {agent['last_name']}",
            "completed_feedback_calls": completed
        })
    
    # Sort by completed calls descending
    performance.sort(key=lambda x: x["completed_feedback_calls"], reverse=True)
    
    total_pending = await db.feedback_calls.count_documents({"status": "pending"})
    total_completed = await db.feedback_calls.count_documents({"status": "completed"})
    
    return {
        "agents": performance,
        "totals": {
            "pending": total_pending,
            "completed": total_completed
        }
    }

# ==================== FILE SERVING ====================

@api_router.get("/files/{folder}/{filename}")
async def serve_file(folder: str, filename: str):
    """Serve uploaded files with proper headers for download"""
    file_path = UPLOAD_DIR / folder / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine media type
    ext = Path(filename).suffix.lower()
    media_types = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif'
    }
    media_type = media_types.get(ext, 'application/octet-stream')
    
    return FileResponse(
        file_path, 
        media_type=media_type,
        filename=filename,
        headers={
            "Content-Disposition": f"inline; filename=\"{filename}\"",
            "Access-Control-Allow-Origin": "*"
        }
    )

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0", "edition": "enterprise"}

# ==================== MULTI-FIRM INVENTORY MANAGEMENT ====================

# ==================== FIRM ENDPOINTS ====================

@api_router.get("/firms", response_model=List[FirmResponse])
async def list_firms(
    is_active: Optional[bool] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """List all firms"""
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    firms = await db.firms.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    return firms

@api_router.get("/firms/{firm_id}", response_model=FirmResponse)
async def get_firm(
    firm_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get a specific firm"""
    firm = await db.firms.find_one({"id": firm_id}, {"_id": 0})
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")
    return firm

@api_router.post("/firms", response_model=FirmResponse)
async def create_firm(
    firm_data: FirmCreate,
    user: dict = Depends(require_roles(["admin"]))
):
    """Create a new firm (Admin only)"""
    # Check for duplicate GSTIN
    existing = await db.firms.find_one({"gstin": firm_data.gstin.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Firm with this GSTIN already exists")
    
    firm_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    firm_doc = {
        "id": firm_id,
        "name": firm_data.name,
        "gstin": firm_data.gstin.upper(),
        "address": firm_data.address,
        "state": firm_data.state,
        "pincode": firm_data.pincode,
        "contact_person": firm_data.contact_person,
        "phone": firm_data.phone,
        "email": firm_data.email,
        "is_active": True,
        "created_at": now,
        "updated_at": now
    }
    
    await db.firms.insert_one(firm_doc)
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "firm_created",
        "entity_type": "firm",
        "entity_id": firm_id,
        "entity_name": firm_data.name,
        "performed_by": user["id"],
        "performed_by_name": f"{user['first_name']} {user['last_name']}",
        "details": {"gstin": firm_data.gstin.upper()},
        "timestamp": now
    })
    
    return FirmResponse(**{k: v for k, v in firm_doc.items() if k != "_id"})

@api_router.patch("/firms/{firm_id}", response_model=FirmResponse)
async def update_firm(
    firm_id: str,
    firm_data: FirmUpdate,
    user: dict = Depends(require_roles(["admin"]))
):
    """Update a firm (Admin only)"""
    firm = await db.firms.find_one({"id": firm_id})
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")
    
    # Check for duplicate GSTIN if updating
    if firm_data.gstin and firm_data.gstin.upper() != firm["gstin"]:
        existing = await db.firms.find_one({"gstin": firm_data.gstin.upper(), "id": {"$ne": firm_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Another firm with this GSTIN already exists")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = {k: v for k, v in firm_data.dict().items() if v is not None}
    if "gstin" in update_data:
        update_data["gstin"] = update_data["gstin"].upper()
    update_data["updated_at"] = now
    
    await db.firms.update_one({"id": firm_id}, {"$set": update_data})
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "firm_updated",
        "entity_type": "firm",
        "entity_id": firm_id,
        "entity_name": firm.get("name"),
        "performed_by": user["id"],
        "performed_by_name": f"{user['first_name']} {user['last_name']}",
        "details": {"changes": update_data},
        "timestamp": now
    })
    
    updated_firm = await db.firms.find_one({"id": firm_id}, {"_id": 0})
    return FirmResponse(**updated_firm)

@api_router.delete("/firms/{firm_id}")
async def delete_firm(
    firm_id: str,
    user: dict = Depends(require_roles(["admin"]))
):
    """Soft delete a firm by deactivating it (Admin only)"""
    firm = await db.firms.find_one({"id": firm_id})
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")
    
    # Check if firm has inventory
    inventory_count = await db.inventory_ledger.count_documents({"firm_id": firm_id})
    if inventory_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete firm with inventory records. Deactivate instead.")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.firms.update_one({"id": firm_id}, {"$set": {"is_active": False, "updated_at": now}})
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "firm_deactivated",
        "entity_type": "firm",
        "entity_id": firm_id,
        "entity_name": firm.get("name"),
        "performed_by": user["id"],
        "performed_by_name": f"{user['first_name']} {user['last_name']}",
        "details": {},
        "timestamp": now
    })
    
    return {"message": "Firm deactivated successfully"}

# ==================== MASTER SKU ENDPOINTS ====================

@api_router.get("/master-skus")
async def list_master_skus(
    category: Optional[str] = None,
    is_manufactured: Optional[bool] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """List all Master SKUs with optional filters"""
    query = {}
    if category:
        query["category"] = category
    if is_manufactured is not None:
        query["is_manufactured"] = is_manufactured
    if is_active is not None:
        query["is_active"] = is_active
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku_code": {"$regex": search, "$options": "i"}},
            {"aliases.alias_code": {"$regex": search, "$options": "i"}}
        ]
    
    master_skus = await db.master_skus.find(query, {"_id": 0}).sort("name", 1).to_list(10000)
    return master_skus


@api_router.get("/master-skus/lookup")
async def lookup_master_sku(
    code: str,
    firm_id: str,
    user: dict = Depends(require_roles(["admin", "accountant", "dispatcher"]))
):
    """
    Lookup a Master SKU or Raw Material by its primary SKU code or any alias code.
    Returns the item with stock info for the specified firm.
    """
    if not code or not firm_id:
        raise HTTPException(status_code=400, detail="Both code and firm_id are required")
    
    code_upper = code.strip().upper()
    
    # First search in Master SKUs
    master_sku = await db.master_skus.find_one(
        {"sku_code": {"$regex": f"^{code_upper}$", "$options": "i"}, "is_active": True},
        {"_id": 0}
    )
    
    # If not found by primary code, search by alias code
    if not master_sku:
        master_sku = await db.master_skus.find_one(
            {"aliases.alias_code": {"$regex": f"^{code_upper}$", "$options": "i"}, "is_active": True},
            {"_id": 0}
        )
    
    # If found a Master SKU
    if master_sku:
        firm = await db.firms.find_one({"id": firm_id, "is_active": True}, {"_id": 0})
        if not firm:
            raise HTTPException(status_code=400, detail="Firm not found or inactive")
        
        # Get stock for this SKU at this firm
        # For manufactured items, count in_stock serial numbers
        if master_sku.get("product_type") == "manufactured":
            stock = await db.finished_good_serials.count_documents({
                "master_sku_id": master_sku["id"],
                "firm_id": firm_id,
                "status": "in_stock"
            })
        else:
            # For non-manufactured items, check inventory ledger
            last_entry = await db.inventory_ledger.find_one(
                {"item_id": master_sku["id"], "firm_id": firm_id, "item_type": "master_sku"},
                sort=[("created_at", -1)]
            )
            stock = last_entry.get("running_balance", 0) if last_entry else 0
        
        # Determine which code was matched
        matched_by = "sku_code"
        matched_alias = None
        if master_sku.get("sku_code", "").upper() != code_upper:
            matched_by = "alias"
            for alias in master_sku.get("aliases", []):
                if alias.get("alias_code", "").upper() == code_upper:
                    matched_alias = alias
                    break
        
        return {
            "found": True,
            "item_type": "master_sku",
            "master_sku": master_sku,
            "matched_by": matched_by,
            "matched_alias": matched_alias,
            "firm_id": firm_id,
            "firm_name": firm.get("name"),
            "current_stock": stock,
            "can_dispatch": stock > 0,
            "stock_message": (
                f"✓ Stock available: {stock} units at {firm.get('name')}" if stock > 0
                else f"✗ No stock available at {firm.get('name')}. Please transfer, produce, or purchase first."
            )
        }
    
    # Search in Raw Materials if not found in Master SKUs
    raw_material = await db.raw_materials.find_one(
        {"sku_code": {"$regex": f"^{code_upper}$", "$options": "i"}, "is_active": True},
        {"_id": 0}
    )
    
    if raw_material:
        firm = await db.firms.find_one({"id": firm_id, "is_active": True}, {"_id": 0})
        if not firm:
            raise HTTPException(status_code=400, detail="Firm not found or inactive")
        
        # Get stock for this raw material at this firm
        last_entry = await db.inventory_ledger.find_one(
            {"item_id": raw_material["id"], "firm_id": firm_id, "item_type": "raw_material"},
            sort=[("created_at", -1)]
        )
        stock = last_entry.get("running_balance", 0) if last_entry else raw_material.get("current_stock", 0)
        
        return {
            "found": True,
            "item_type": "raw_material",
            "raw_material": raw_material,
            "matched_by": "sku_code",
            "matched_alias": None,
            "firm_id": firm_id,
            "firm_name": firm.get("name"),
            "current_stock": stock,
            "can_dispatch": stock > 0,
            "stock_message": (
                f"✓ Stock available: {stock} {raw_material.get('unit', 'units')} at {firm.get('name')}" if stock > 0
                else f"✗ No stock available at {firm.get('name')}. Please transfer, produce, or purchase first."
            )
        }
    
    # Not found in either collection
    return {
        "found": False,
        "message": f"No product found with code '{code}'. Check spelling or create a new Master SKU / Raw Material.",
        "suggestions": []
    }


@api_router.get("/master-skus/search-for-dispatch")
async def search_master_skus_for_dispatch(
    firm_id: str,
    search: Optional[str] = None,
    in_stock_only: bool = True,
    category: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant", "dispatcher"]))
):
    """
    Search Master SKUs for dispatch with stock info.
    Returns SKUs that have stock at the specified firm.
    Optional category filter for spare parts, etc.
    """
    if not firm_id:
        raise HTTPException(status_code=400, detail="firm_id is required")
    
    firm = await db.firms.find_one({"id": firm_id, "is_active": True}, {"_id": 0})
    if not firm:
        raise HTTPException(status_code=400, detail="Firm not found or inactive")
    
    # Build query
    query = {"is_active": True}
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"name": search_regex},
            {"sku_code": search_regex},
            {"aliases.alias_code": search_regex}
        ]
    
    # Category filter (case-insensitive)
    if category:
        query["category"] = {"$regex": f"^{category}$", "$options": "i"}
    
    master_skus = await db.master_skus.find(query, {"_id": 0}).to_list(100)
    
    result = []
    for sku in master_skus:
        # Get stock at this firm
        # For manufactured items, count in_stock serial numbers
        if sku.get("product_type") == "manufactured":
            stock = await db.finished_good_serials.count_documents({
                "master_sku_id": sku["id"],
                "firm_id": firm_id,
                "status": "in_stock"
            })
        else:
            # For non-manufactured items, check inventory ledger
            last_entry = await db.inventory_ledger.find_one(
                {"item_id": sku["id"], "firm_id": firm_id, "item_type": "master_sku"},
                sort=[("created_at", -1)]
            )
            stock = last_entry.get("running_balance", 0) if last_entry else 0
        
        if in_stock_only and stock <= 0:
            continue
        
        result.append({
            "id": sku["id"],
            "name": sku.get("name"),
            "sku_code": sku.get("sku_code"),
            "category": sku.get("category"),
            "aliases": sku.get("aliases", []),
            "is_manufactured": sku.get("is_manufactured", False),
            "product_type": sku.get("product_type"),
            "firm_id": firm_id,
            "firm_name": firm.get("name"),
            "current_stock": stock
        })
    
    return {
        "skus": result,
        "firm_name": firm.get("name"),
        "total_found": len(result),
        "message": f"Found {len(result)} SKU(s) with stock at {firm.get('name')}" if result else f"No SKUs with stock at {firm.get('name')}. Transfer, produce, or purchase stock first."
    }


@api_router.get("/master-skus/stock/all")
async def get_all_master_sku_stock(
    firm_id: Optional[str] = None,
    category: Optional[str] = None,
    is_manufactured: Optional[bool] = None,
    in_stock_only: bool = False,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get stock levels for all Master SKUs, optionally filtered by firm"""
    query = {"is_active": True}
    if category:
        query["category"] = category
    if is_manufactured is not None:
        query["is_manufactured"] = is_manufactured
    
    master_skus = await db.master_skus.find(query, {"_id": 0}).to_list(10000)
    
    result = []
    for sku in master_skus:
        if firm_id:
            # Get stock for specific firm
            last_entry = await db.inventory_ledger.find_one(
                {"item_id": sku["id"], "firm_id": firm_id, "item_type": "master_sku"},
                sort=[("created_at", -1)]
            )
            stock = last_entry.get("running_balance", 0) if last_entry else 0
            
            if in_stock_only and stock <= 0:
                continue
            
            result.append({
                **sku,
                "stock": stock,
                "firm_id": firm_id
            })
        else:
            # Get total stock across all firms
            pipeline = [
                {"$match": {"item_id": sku["id"], "item_type": "master_sku"}},
                {"$sort": {"firm_id": 1, "created_at": -1}},
                {"$group": {"_id": "$firm_id", "latest_balance": {"$first": "$running_balance"}}},
                {"$group": {"_id": None, "total_stock": {"$sum": "$latest_balance"}}}
            ]
            agg_result = await db.inventory_ledger.aggregate(pipeline).to_list(1)
            total_stock = agg_result[0]["total_stock"] if agg_result else 0
            
            if in_stock_only and total_stock <= 0:
                continue
            
            result.append({
                **sku,
                "stock": total_stock
            })
    
    return result


@api_router.get("/master-skus/{sku_id}")
async def get_master_sku(
    sku_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get a specific Master SKU"""
    sku = await db.master_skus.find_one({"id": sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail="Master SKU not found")
    return sku


@api_router.post("/master-skus", response_model=MasterSKUResponse)
async def create_master_sku(
    sku_data: MasterSKUCreate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Create a new Master SKU"""
    # Check for duplicate SKU code
    existing = await db.master_skus.find_one({"sku_code": sku_data.sku_code})
    if existing:
        raise HTTPException(status_code=400, detail="SKU code already exists")
    
    # Check for duplicate alias codes
    if sku_data.aliases:
        for alias in sku_data.aliases:
            existing_alias = await db.master_skus.find_one({
                "aliases.alias_code": alias.alias_code
            })
            if existing_alias:
                raise HTTPException(status_code=400, detail=f"Alias code {alias.alias_code} already exists")
    
    # Validate BOM if is_manufactured
    if sku_data.is_manufactured and sku_data.bill_of_materials:
        for bom_item in sku_data.bill_of_materials:
            rm = await db.raw_materials.find_one({"id": bom_item.raw_material_id})
            if not rm:
                raise HTTPException(status_code=400, detail=f"Raw material {bom_item.raw_material_id} not found")
    
    now = datetime.now(timezone.utc).isoformat()
    sku_record = {
        "id": str(uuid.uuid4()),
        "name": sku_data.name,
        "sku_code": sku_data.sku_code,
        "category": sku_data.category,
        "hsn_code": sku_data.hsn_code,
        "gst_rate": sku_data.gst_rate or 18.0,
        "unit": sku_data.unit,
        "is_manufactured": sku_data.is_manufactured,
        "product_type": sku_data.product_type,
        "manufacturing_role": sku_data.manufacturing_role,
        "production_charge_per_unit": sku_data.production_charge_per_unit,
        "bill_of_materials": [bom.dict() for bom in sku_data.bill_of_materials] if sku_data.bill_of_materials else [],
        "aliases": [alias.dict() for alias in sku_data.aliases] if sku_data.aliases else [],
        "reorder_level": sku_data.reorder_level,
        "description": sku_data.description,
        "cost_price": sku_data.cost_price,
        "is_active": True,
        "created_at": now,
        "updated_at": now
    }
    
    await db.master_skus.insert_one(sku_record)
    return MasterSKUResponse(**{k: v for k, v in sku_record.items() if k != "_id"})


@api_router.patch("/master-skus/{sku_id}", response_model=MasterSKUResponse)
async def update_master_sku(
    sku_id: str,
    sku_data: MasterSKUUpdate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Update a Master SKU"""
    existing = await db.master_skus.find_one({"id": sku_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Master SKU not found")
    
    update_data = {k: v for k, v in sku_data.dict().items() if v is not None}
    
    # Check for duplicate SKU code if updating
    if "sku_code" in update_data and update_data["sku_code"] != existing.get("sku_code"):
        dup = await db.master_skus.find_one({"sku_code": update_data["sku_code"], "id": {"$ne": sku_id}})
        if dup:
            raise HTTPException(status_code=400, detail="SKU code already exists")
    
    # Validate BOM if updating
    if "bill_of_materials" in update_data and update_data["bill_of_materials"]:
        update_data["bill_of_materials"] = [bom.dict() if hasattr(bom, 'dict') else bom for bom in update_data["bill_of_materials"]]
        for bom_item in update_data["bill_of_materials"]:
            rm = await db.raw_materials.find_one({"id": bom_item["raw_material_id"]})
            if not rm:
                raise HTTPException(status_code=400, detail=f"Raw material {bom_item['raw_material_id']} not found")
    
    # Convert aliases to dict if present
    if "aliases" in update_data and update_data["aliases"]:
        update_data["aliases"] = [alias.dict() if hasattr(alias, 'dict') else alias for alias in update_data["aliases"]]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.master_skus.update_one({"id": sku_id}, {"$set": update_data})
    
    updated = await db.master_skus.find_one({"id": sku_id}, {"_id": 0})
    return MasterSKUResponse(**updated)


@api_router.post("/master-skus/{sku_id}/aliases")
async def add_sku_alias(
    sku_id: str,
    alias: SKUAlias,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Add an alias to a Master SKU"""
    existing = await db.master_skus.find_one({"id": sku_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Master SKU not found")
    
    # Check for duplicate alias code
    dup = await db.master_skus.find_one({"aliases.alias_code": alias.alias_code})
    if dup:
        raise HTTPException(status_code=400, detail=f"Alias code {alias.alias_code} already exists")
    
    await db.master_skus.update_one(
        {"id": sku_id},
        {
            "$push": {"aliases": alias.dict()},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Alias added successfully"}


@api_router.delete("/master-skus/{sku_id}/aliases/{alias_code}")
async def remove_sku_alias(
    sku_id: str,
    alias_code: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Remove an alias from a Master SKU"""
    existing = await db.master_skus.find_one({"id": sku_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Master SKU not found")
    
    await db.master_skus.update_one(
        {"id": sku_id},
        {
            "$pull": {"aliases": {"alias_code": alias_code}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Alias removed successfully"}


@api_router.get("/master-skus/{sku_id}/stock")
async def get_master_sku_stock(
    sku_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get stock levels for a Master SKU across all firms"""
    sku = await db.master_skus.find_one({"id": sku_id}, {"_id": 0})
    if not sku:
        raise HTTPException(status_code=404, detail="Master SKU not found")
    
    # Get all firms
    firms = await db.firms.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    stock_by_firm = []
    total_stock = 0
    
    for firm in firms:
        # Get latest ledger entry for this SKU at this firm
        last_entry = await db.inventory_ledger.find_one(
            {"item_id": sku_id, "firm_id": firm["id"], "item_type": "master_sku"},
            sort=[("created_at", -1)]
        )
        stock = last_entry.get("running_balance", 0) if last_entry else 0
        total_stock += stock
        
        stock_by_firm.append({
            "firm_id": firm["id"],
            "firm_name": firm["name"],
            "stock": stock
        })
    
    return {
        "master_sku": sku,
        "total_stock": total_stock,
        "stock_by_firm": stock_by_firm
    }


# ==================== RAW MATERIAL ENDPOINTS (GLOBAL - FIRM AGNOSTIC) ====================

@api_router.get("/raw-materials")
async def list_raw_materials(
    is_active: Optional[bool] = None,
    include_stock: bool = True,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """List all raw materials (global definitions, stock per firm via ledger)"""
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    raw_materials = await db.raw_materials.find(query, {"_id": 0}).sort("name", 1).to_list(10000)
    
    if include_stock:
        # Get all active firms
        firms = await db.firms.find({"is_active": True}, {"_id": 0}).to_list(100)
        
        for rm in raw_materials:
            stock_by_firm = []
            total_stock = 0
            
            for firm in firms:
                # Get stock from ledger
                last_entry = await db.inventory_ledger.find_one(
                    {"item_id": rm["id"], "firm_id": firm["id"], "item_type": "raw_material"},
                    sort=[("created_at", -1)]
                )
                stock = last_entry.get("running_balance", 0) if last_entry else 0
                
                stock_by_firm.append({
                    "firm_id": firm["id"],
                    "firm_name": firm.get("name"),
                    "stock": stock
                })
                total_stock += stock
            
            rm["stock_by_firm"] = stock_by_firm
            rm["total_stock"] = total_stock
    
    return raw_materials

@api_router.get("/raw-materials/{material_id}")
async def get_raw_material(
    material_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get a specific raw material with per-firm stock"""
    material = await db.raw_materials.find_one({"id": material_id}, {"_id": 0})
    if not material:
        raise HTTPException(status_code=404, detail="Raw material not found")
    
    # Get all active firms and their stock
    firms = await db.firms.find({"is_active": True}, {"_id": 0}).to_list(100)
    stock_by_firm = []
    total_stock = 0
    
    for firm in firms:
        last_entry = await db.inventory_ledger.find_one(
            {"item_id": material["id"], "firm_id": firm["id"], "item_type": "raw_material"},
            sort=[("created_at", -1)]
        )
        stock = last_entry.get("running_balance", 0) if last_entry else 0
        
        stock_by_firm.append({
            "firm_id": firm["id"],
            "firm_name": firm.get("name"),
            "stock": stock
        })
        total_stock += stock
    
    material["stock_by_firm"] = stock_by_firm
    material["total_stock"] = total_stock
    
    return material

@api_router.post("/raw-materials")
async def create_raw_material(
    material_data: RawMaterialCreate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Create a new raw material (global definition)"""
    # Check for duplicate SKU code globally
    existing = await db.raw_materials.find_one({
        "sku_code": material_data.sku_code.upper()
    })
    if existing:
        raise HTTPException(status_code=400, detail="Raw material with this SKU code already exists")
    
    material_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    material_doc = {
        "id": material_id,
        "name": material_data.name,
        "sku_code": material_data.sku_code.upper(),
        "unit": material_data.unit,
        "hsn_code": material_data.hsn_code,
        "gst_rate": material_data.gst_rate,
        "cost_price": material_data.cost_price,
        "reorder_level": material_data.reorder_level,
        "description": material_data.description,
        "is_active": True,
        "created_at": now,
        "updated_at": now
    }
    
    await db.raw_materials.insert_one(material_doc)
    
    # Remove MongoDB _id before returning
    material_doc.pop("_id", None)
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "raw_material_created",
        "entity_type": "raw_material",
        "entity_id": material_id,
        "entity_name": material_data.name,
        "performed_by": user["id"],
        "performed_by_name": f"{user['first_name']} {user['last_name']}",
        "details": {"sku_code": material_data.sku_code.upper()},
        "timestamp": now
    })
    
    # Return with empty stock info
    material_doc["stock_by_firm"] = []
    material_doc["total_stock"] = 0
    return material_doc

@api_router.patch("/raw-materials/{material_id}")
async def update_raw_material(
    material_id: str,
    material_data: RawMaterialUpdate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Update a raw material definition (cannot change stock directly)"""
    material = await db.raw_materials.find_one({"id": material_id})
    if not material:
        raise HTTPException(status_code=404, detail="Raw material not found")
    
    # Check for duplicate SKU code if updating
    if material_data.sku_code:
        existing = await db.raw_materials.find_one({
            "sku_code": material_data.sku_code.upper(),
            "id": {"$ne": material_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Another raw material with this SKU code already exists")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = {k: v for k, v in material_data.dict().items() if v is not None}
    if "sku_code" in update_data:
        update_data["sku_code"] = update_data["sku_code"].upper()
    update_data["updated_at"] = now
    
    await db.raw_materials.update_one({"id": material_id}, {"$set": update_data})
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "raw_material_updated",
        "entity_type": "raw_material",
        "entity_id": material_id,
        "entity_name": material.get("name"),
        "performed_by": user["id"],
        "performed_by_name": f"{user['first_name']} {user['last_name']}",
        "details": {"changes": update_data},
        "timestamp": now
    })
    
    updated_material = await db.raw_materials.find_one({"id": material_id}, {"_id": 0})
    
    # Get stock info
    firms = await db.firms.find({"is_active": True}, {"_id": 0}).to_list(100)
    stock_by_firm = []
    total_stock = 0
    
    for firm in firms:
        last_entry = await db.inventory_ledger.find_one(
            {"item_id": material_id, "firm_id": firm["id"], "item_type": "raw_material"},
            sort=[("created_at", -1)]
        )
        stock = last_entry.get("running_balance", 0) if last_entry else 0
        stock_by_firm.append({
            "firm_id": firm["id"],
            "firm_name": firm.get("name"),
            "stock": stock
        })
        total_stock += stock
    
    updated_material["stock_by_firm"] = stock_by_firm
    updated_material["total_stock"] = total_stock
    
    return updated_material

# ==================== INVENTORY LEDGER ENDPOINTS ====================

async def get_current_stock(item_type: str, item_id: str, firm_id: str) -> int:
    """Calculate current stock from ledger entries"""
    pipeline = [
        {"$match": {"item_type": item_type, "item_id": item_id, "firm_id": firm_id}},
        {"$group": {
            "_id": None,
            "total_in": {"$sum": {"$cond": [
                {"$in": ["$entry_type", ["purchase", "transfer_in", "adjustment_in", "return_in", "repair_yard_in", "production_output"]]},
                "$quantity",
                0
            ]}},
            "total_out": {"$sum": {"$cond": [
                {"$in": ["$entry_type", ["transfer_out", "adjustment_out", "dispatch_out", "production_consume"]]},
                {"$abs": "$quantity"},  # Use absolute value since some entries have negative quantities
                0
            ]}}
        }}
    ]
    
    result = await db.inventory_ledger.aggregate(pipeline).to_list(1)
    if result:
        return result[0].get("total_in", 0) - result[0].get("total_out", 0)
    return 0

async def update_stock_from_ledger(item_type: str, item_id: str, firm_id: str):
    """Update the current_stock field based on ledger entries"""
    current_stock = await get_current_stock(item_type, item_id, firm_id)
    
    if item_type == "raw_material":
        await db.raw_materials.update_one(
            {"id": item_id},
            {"$set": {"current_stock": current_stock, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif item_type == "master_sku":
        # For master_skus, we don't update a stock field directly - stock is calculated from ledger
        # But we can update a cache field if needed
        await db.master_skus.update_one(
            {"id": item_id},
            {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:  # finished_good (legacy SKU)
        await db.skus.update_one(
            {"id": item_id, "firm_id": firm_id},
            {"$set": {"stock_quantity": current_stock, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

@api_router.post("/inventory/ledger", response_model=LedgerEntryResponse)
async def create_ledger_entry(
    entry_data: LedgerEntryCreate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Create a new inventory ledger entry (the ONLY way to change stock)"""
    # Validate entry type
    if entry_data.entry_type not in LEDGER_ENTRY_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid entry type. Must be one of: {LEDGER_ENTRY_TYPES}")
    
    # Validate item type - now supports master_sku
    if entry_data.item_type not in ["raw_material", "finished_good", "master_sku"]:
        raise HTTPException(status_code=400, detail="Item type must be 'raw_material', 'finished_good', or 'master_sku'")
    
    # MANDATORY: Reason is required for adjustments
    if entry_data.entry_type in ["adjustment_in", "adjustment_out"]:
        if not entry_data.reason or not entry_data.reason.strip():
            raise HTTPException(status_code=400, detail="Reason is MANDATORY for stock adjustments")
    
    # Verify firm exists
    firm = await db.firms.find_one({"id": entry_data.firm_id, "is_active": True})
    if not firm:
        raise HTTPException(status_code=400, detail="Invalid or inactive firm")
    
    # Get item details based on type
    if entry_data.item_type == "raw_material":
        item = await db.raw_materials.find_one({"id": entry_data.item_id, "firm_id": entry_data.firm_id})
        if not item:
            # Also check without firm_id filter (raw material might be global)
            item = await db.raw_materials.find_one({"id": entry_data.item_id})
        if not item:
            raise HTTPException(status_code=400, detail="Raw material not found")
        item_name = item.get("name")
        item_sku = item.get("sku_code")
    elif entry_data.item_type == "master_sku":
        item = await db.master_skus.find_one({"id": entry_data.item_id, "is_active": True})
        if not item:
            raise HTTPException(status_code=400, detail="Master SKU not found or inactive")
        item_name = item.get("name")
        item_sku = item.get("sku_code")
        
        # BLOCK: Manufactured items cannot have stock added via ledger entry
        # They MUST go through production request workflow
        if item.get("product_type") == "manufactured":
            if entry_data.entry_type in ["purchase", "transfer_in", "adjustment_in", "return_in"]:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Manufactured items cannot be added to stock via ledger entry. "
                           f"Use the Production Request workflow to produce '{item_name}' and receive it with serial numbers."
                )
    else:  # finished_good (legacy SKU)
        item = await db.skus.find_one({"id": entry_data.item_id})
        if not item:
            raise HTTPException(status_code=400, detail="SKU not found")
        item_name = item.get("model_name") or item.get("name")
        item_sku = item.get("sku_code")
    
    # For outgoing entries, check if sufficient stock exists
    if entry_data.entry_type in ["transfer_out", "adjustment_out", "dispatch_out"]:
        current_stock = await get_current_stock(entry_data.item_type, entry_data.item_id, entry_data.firm_id)
        if current_stock < entry_data.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock. Current stock: {current_stock}, Requested: {entry_data.quantity}"
            )
    
    # Calculate running balance
    current_stock = await get_current_stock(entry_data.item_type, entry_data.item_id, entry_data.firm_id)
    if entry_data.entry_type in ["purchase", "transfer_in", "adjustment_in", "return_in", "repair_yard_in", "production_output"]:
        running_balance = current_stock + entry_data.quantity
    else:
        running_balance = current_stock - entry_data.quantity
    
    entry_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    entry_doc = {
        "id": entry_id,
        "entry_number": generate_ledger_entry_number(),
        "entry_type": entry_data.entry_type,
        "item_type": entry_data.item_type,
        "item_id": entry_data.item_id,
        "item_name": item_name,
        "item_sku": item_sku,
        "firm_id": entry_data.firm_id,
        "firm_name": firm.get("name"),
        "quantity": entry_data.quantity,
        "running_balance": running_balance,
        "unit_price": entry_data.unit_price,
        "total_value": (entry_data.unit_price * entry_data.quantity) if entry_data.unit_price else None,
        "invoice_number": entry_data.invoice_number,
        "reason": entry_data.reason,
        "reference_id": entry_data.reference_id,
        "notes": entry_data.notes,
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "created_at": now
    }
    
    await db.inventory_ledger.insert_one(entry_doc)
    
    # Update the item's current stock (only for raw_material and finished_good)
    if entry_data.item_type in ["raw_material", "finished_good"]:
        await update_stock_from_ledger(entry_data.item_type, entry_data.item_id, entry_data.firm_id)
    # Master SKU stock is always derived from ledger, no need to update a separate field
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": f"ledger_entry_{entry_data.entry_type}",
        "entity_type": "inventory_ledger",
        "entity_id": entry_id,
        "entity_name": entry_doc["entry_number"],
        "performed_by": user["id"],
        "performed_by_name": f"{user['first_name']} {user['last_name']}",
        "details": {
            "item_type": entry_data.item_type,
            "item_name": item_name,
            "quantity": entry_data.quantity,
            "firm_id": entry_data.firm_id,
            "invoice_number": entry_data.invoice_number
        },
        "timestamp": now
    })
    
    return LedgerEntryResponse(**{k: v for k, v in entry_doc.items() if k != "_id"})

@api_router.get("/inventory/ledger", response_model=List[LedgerEntryResponse])
async def list_ledger_entries(
    firm_id: Optional[str] = None,
    item_type: Optional[str] = None,
    item_id: Optional[str] = None,
    entry_type: Optional[str] = None,
    limit: int = Query(100, le=500),
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """List inventory ledger entries with filters"""
    query = {}
    if firm_id:
        query["firm_id"] = firm_id
    if item_type:
        query["item_type"] = item_type
    if item_id:
        query["item_id"] = item_id
    if entry_type:
        query["entry_type"] = entry_type
    
    entries = await db.inventory_ledger.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return entries

@api_router.get("/inventory/ledger/{entry_id}", response_model=LedgerEntryResponse)
async def get_ledger_entry(
    entry_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get a specific ledger entry"""
    entry = await db.inventory_ledger.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")
    return entry

# ==================== STOCK TRANSFER ENDPOINTS ====================

@api_router.post("/inventory/transfer", response_model=StockTransferResponse)
async def create_stock_transfer(
    transfer_data: StockTransferCreate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Create an inter-firm stock transfer.
    This creates two ledger entries: transfer_out from source firm, transfer_in to destination firm.
    Invoice number is MANDATORY for GST compliance.
    """
    # Validate invoice number (MANDATORY)
    if not transfer_data.invoice_number or not transfer_data.invoice_number.strip():
        raise HTTPException(status_code=400, detail="Invoice number is MANDATORY for inter-firm transfers (GST compliance)")
    
    # Validate item type
    if transfer_data.item_type not in ["raw_material", "finished_good", "master_sku"]:
        raise HTTPException(status_code=400, detail="Item type must be 'raw_material', 'finished_good', or 'master_sku'")
    
    # Verify both firms exist and are active
    from_firm = await db.firms.find_one({"id": transfer_data.from_firm_id, "is_active": True})
    if not from_firm:
        raise HTTPException(status_code=400, detail="Source firm not found or inactive")
    
    to_firm = await db.firms.find_one({"id": transfer_data.to_firm_id, "is_active": True})
    if not to_firm:
        raise HTTPException(status_code=400, detail="Destination firm not found or inactive")
    
    if transfer_data.from_firm_id == transfer_data.to_firm_id:
        raise HTTPException(status_code=400, detail="Source and destination firm cannot be the same")
    
    # Get item details
    if transfer_data.item_type == "raw_material":
        # Raw materials are now global, no firm_id check
        item = await db.raw_materials.find_one({"id": transfer_data.item_id})
        if not item:
            raise HTTPException(status_code=400, detail="Raw material not found")
        item_name = item.get("name")
        item_sku = item.get("sku_code")
        dest_item_id = transfer_data.item_id  # Same item ID since raw materials are global
    elif transfer_data.item_type == "master_sku":
        item = await db.master_skus.find_one({"id": transfer_data.item_id})
        if not item:
            raise HTTPException(status_code=400, detail="Master SKU not found")
        item_name = item.get("name")
        item_sku = item.get("sku_code")
        dest_item_id = transfer_data.item_id
    else:  # finished_good
        item = await db.skus.find_one({"id": transfer_data.item_id})
        if not item:
            raise HTTPException(status_code=400, detail="SKU not found")
        item_name = item.get("model_name")
        item_sku = item.get("sku_code")
        dest_item_id = transfer_data.item_id  # Same SKU ID for finished goods
    
    # Check if source firm has sufficient stock
    current_stock = await get_current_stock(transfer_data.item_type, transfer_data.item_id, transfer_data.from_firm_id)
    if current_stock < transfer_data.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock in source firm. Available: {current_stock}, Requested: {transfer_data.quantity}"
        )
    
    # For manufactured items (master_sku with product_type='manufactured'), handle serial numbers
    serial_numbers_to_transfer = []
    if transfer_data.item_type == "master_sku" and item.get("product_type") == "manufactured":
        # Serial numbers are required for manufactured items
        if not transfer_data.serial_numbers or len(transfer_data.serial_numbers) == 0:
            raise HTTPException(
                status_code=400,
                detail="Serial numbers are required for manufactured item transfers"
            )
        if len(transfer_data.serial_numbers) != transfer_data.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Number of serial numbers ({len(transfer_data.serial_numbers)}) must match quantity ({transfer_data.quantity})"
            )
        
        # Verify all serial numbers exist and belong to source firm
        for serial in transfer_data.serial_numbers:
            serial_record = await db.finished_good_serials.find_one({
                "serial_number": serial,
                "master_sku_id": transfer_data.item_id,
                "firm_id": transfer_data.from_firm_id,
                "status": "in_stock"
            })
            if not serial_record:
                raise HTTPException(
                    status_code=400,
                    detail=f"Serial number {serial} not found in stock at source firm or not available"
                )
            serial_numbers_to_transfer.append(serial_record)
    
    transfer_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    transfer_number = generate_transfer_number()
    
    # Create transfer_out entry for source firm
    out_entry_id = str(uuid.uuid4())
    out_running_balance = current_stock - transfer_data.quantity
    out_entry = {
        "id": out_entry_id,
        "entry_number": generate_ledger_entry_number(),
        "entry_type": "transfer_out",
        "item_type": transfer_data.item_type,
        "item_id": transfer_data.item_id,
        "item_name": item_name,
        "item_sku": item_sku,
        "firm_id": transfer_data.from_firm_id,
        "firm_name": from_firm.get("name"),
        "quantity": transfer_data.quantity,
        "running_balance": out_running_balance,
        "unit_price": None,
        "total_value": None,
        "invoice_number": transfer_data.invoice_number,
        "reason": f"Transfer to {to_firm.get('name')}",
        "reference_id": transfer_id,
        "notes": transfer_data.notes,
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "created_at": now
    }
    await db.inventory_ledger.insert_one(out_entry)
    
    # Update source firm stock
    await update_stock_from_ledger(transfer_data.item_type, transfer_data.item_id, transfer_data.from_firm_id)
    
    # Create transfer_in entry for destination firm
    dest_current_stock = await get_current_stock(transfer_data.item_type, dest_item_id, transfer_data.to_firm_id)
    in_entry_id = str(uuid.uuid4())
    in_running_balance = dest_current_stock + transfer_data.quantity
    in_entry = {
        "id": in_entry_id,
        "entry_number": generate_ledger_entry_number(),
        "entry_type": "transfer_in",
        "item_type": transfer_data.item_type,
        "item_id": dest_item_id,
        "item_name": item_name,
        "item_sku": item_sku,
        "firm_id": transfer_data.to_firm_id,
        "firm_name": to_firm.get("name"),
        "quantity": transfer_data.quantity,
        "running_balance": in_running_balance,
        "unit_price": None,
        "total_value": None,
        "invoice_number": transfer_data.invoice_number,
        "reason": f"Transfer from {from_firm.get('name')}",
        "reference_id": transfer_id,
        "notes": transfer_data.notes,
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "created_at": now
    }
    await db.inventory_ledger.insert_one(in_entry)
    
    # Update destination firm stock
    await update_stock_from_ledger(transfer_data.item_type, dest_item_id, transfer_data.to_firm_id)
    
    # Update serial numbers for manufactured items
    if serial_numbers_to_transfer:
        for serial_record in serial_numbers_to_transfer:
            await db.finished_good_serials.update_one(
                {"id": serial_record["id"]},
                {"$set": {
                    "firm_id": transfer_data.to_firm_id,
                    "firm_name": to_firm.get("name"),
                    "updated_at": now
                }}
            )
    
    # Create transfer record
    transfer_doc = {
        "id": transfer_id,
        "transfer_number": transfer_number,
        "item_type": transfer_data.item_type,
        "item_id": transfer_data.item_id,
        "item_name": item_name,
        "item_sku": item_sku,
        "from_firm_id": transfer_data.from_firm_id,
        "from_firm_name": from_firm.get("name"),
        "to_firm_id": transfer_data.to_firm_id,
        "to_firm_name": to_firm.get("name"),
        "quantity": transfer_data.quantity,
        "serial_numbers": transfer_data.serial_numbers if transfer_data.serial_numbers else [],
        "invoice_number": transfer_data.invoice_number,
        "notes": transfer_data.notes,
        "ledger_out_id": out_entry_id,
        "ledger_in_id": in_entry_id,
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "created_at": now
    }
    await db.stock_transfers.insert_one(transfer_doc)
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "stock_transfer",
        "entity_type": "stock_transfer",
        "entity_id": transfer_id,
        "entity_name": transfer_number,
        "performed_by": user["id"],
        "performed_by_name": f"{user['first_name']} {user['last_name']}",
        "performed_by_role": user.get("role"),
        "details": {
            "item_name": item_name,
            "quantity": transfer_data.quantity,
            "from_firm": from_firm.get("name"),
            "to_firm": to_firm.get("name"),
            "invoice_number": transfer_data.invoice_number,
            "serial_numbers": transfer_data.serial_numbers if transfer_data.serial_numbers else []
        },
        "timestamp": now
    })
    
    return StockTransferResponse(**{k: v for k, v in transfer_doc.items() if k != "_id"})

@api_router.get("/inventory/transfers", response_model=List[StockTransferResponse])
async def list_stock_transfers(
    firm_id: Optional[str] = None,
    limit: int = Query(100, le=500),
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """List stock transfers"""
    query = {}
    if firm_id:
        query["$or"] = [{"from_firm_id": firm_id}, {"to_firm_id": firm_id}]
    
    transfers = await db.stock_transfers.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return transfers

@api_router.get("/inventory/transfers/{transfer_id}", response_model=StockTransferResponse)
async def get_stock_transfer(
    transfer_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get a specific stock transfer"""
    transfer = await db.stock_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer not found")
    return transfer

# ==================== PRODUCTION MODULE ENDPOINTS ====================

@api_router.post("/production", response_model=ProductionResponse)
async def create_production_entry(
    production_data: ProductionCreate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Create a production entry that:
    1. Uses Master SKU with BOM (Bill of Materials) if use_bom=true
    2. Validates raw material stock is sufficient
    3. Creates production_consume ledger entries for each raw material
    4. Creates production_output ledger entry for the finished good (Master SKU)
    """
    # Validate firm exists
    firm = await db.firms.find_one({"id": production_data.firm_id, "is_active": True})
    if not firm:
        raise HTTPException(status_code=400, detail="Firm not found or inactive")
    
    # Validate output SKU exists - check both master_skus and skus collections
    output_sku = await db.master_skus.find_one({"id": production_data.output_sku_id, "is_active": True})
    is_master_sku = True
    
    if not output_sku:
        # Fallback to old skus collection for backward compatibility
        output_sku = await db.skus.find_one({"id": production_data.output_sku_id})
        is_master_sku = False
    
    if not output_sku:
        raise HTTPException(status_code=400, detail="Output SKU not found")
    
    if production_data.output_quantity < 1:
        raise HTTPException(status_code=400, detail="Output quantity must be at least 1")
    
    # Determine materials to consume
    materials_to_consume = []
    
    if production_data.use_bom and is_master_sku:
        # Use BOM from Master SKU
        if not output_sku.get("is_manufactured"):
            raise HTTPException(status_code=400, detail="This product is not marked as manufactured. Enable is_manufactured or provide materials manually.")
        
        bom = output_sku.get("bill_of_materials", [])
        if not bom:
            raise HTTPException(status_code=400, detail="No Bill of Materials defined for this product. Add BOM or provide materials manually.")
        
        # Calculate required quantities based on output quantity
        for bom_item in bom:
            materials_to_consume.append({
                "material_id": bom_item["raw_material_id"],
                "quantity": bom_item["quantity"] * production_data.output_quantity
            })
    else:
        # Use manually provided materials
        if not production_data.materials:
            raise HTTPException(status_code=400, detail="Materials must be provided when use_bom is false")
        
        for mat in production_data.materials:
            materials_to_consume.append({
                "material_id": mat.material_id,
                "quantity": mat.quantity
            })
    
    # Validate materials and check stock
    materials_info = []
    for material in materials_to_consume:
        rm = await db.raw_materials.find_one({"id": material["material_id"]})
        if not rm:
            raise HTTPException(status_code=400, detail=f"Raw material {material['material_id']} not found")
        
        if material["quantity"] < 1:
            raise HTTPException(status_code=400, detail=f"Quantity for {rm.get('name', 'material')} must be at least 1")
        
        # Get current stock for this material at this firm
        last_entry = await db.inventory_ledger.find_one(
            {"item_id": material["material_id"], "firm_id": production_data.firm_id},
            sort=[("created_at", -1)]
        )
        current_stock = last_entry.get("running_balance", 0) if last_entry else 0
        
        if current_stock < material["quantity"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for {rm.get('name', 'material')}. Available: {current_stock}, Required: {material['quantity']}"
            )
        
        materials_info.append({
            "material_id": material["material_id"],
            "material_name": rm.get("name"),
            "material_sku": rm.get("sku_code"),
            "quantity": material["quantity"],
            "current_stock": current_stock
        })
    
    # Generate production number
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    production_number = f"PROD-{timestamp}-{str(uuid.uuid4())[:4].upper()}"
    production_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    
    ledger_entries = []
    
    # Create ledger entries for consumed raw materials
    for mat_info in materials_info:
        entry_number = f"MG-L-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:5].upper()}"
        
        # Get updated current balance for this material
        last_entry = await db.inventory_ledger.find_one(
            {"item_id": mat_info["material_id"], "firm_id": production_data.firm_id},
            sort=[("created_at", -1)]
        )
        current_balance = last_entry.get("running_balance", 0) if last_entry else 0
        new_balance = current_balance - mat_info["quantity"]
        
        ledger_entry = {
            "id": str(uuid.uuid4()),
            "entry_number": entry_number,
            "entry_type": "production_consume",
            "item_type": "raw_material",
            "item_id": mat_info["material_id"],
            "item_name": mat_info["material_name"],
            "item_sku": mat_info["material_sku"],
            "firm_id": production_data.firm_id,
            "firm_name": firm.get("name"),
            "quantity": mat_info["quantity"],
            "running_balance": new_balance,
            "production_id": production_id,
            "production_number": production_number,
            "notes": f"Consumed for production {production_number}" + (f": {production_data.notes}" if production_data.notes else ""),
            "created_by": user["id"],
            "created_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "created_at": created_at
        }
        await db.inventory_ledger.insert_one(ledger_entry)
        ledger_entries.append(ledger_entry["id"])
        
        # Update raw material current_stock
        await db.raw_materials.update_one(
            {"id": mat_info["material_id"]},
            {"$inc": {"current_stock": -mat_info["quantity"]}}
        )
    
    # Create ledger entry for output finished good
    output_entry_number = f"MG-L-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:5].upper()}"
    
    # Get current balance for output SKU (check both master_sku and finished_good types)
    item_type = "master_sku" if is_master_sku else "finished_good"
    last_output_entry = await db.inventory_ledger.find_one(
        {"item_id": production_data.output_sku_id, "firm_id": production_data.firm_id, "item_type": item_type},
        sort=[("created_at", -1)]
    )
    if not last_output_entry:
        # Try without item_type filter for backward compatibility
        last_output_entry = await db.inventory_ledger.find_one(
            {"item_id": production_data.output_sku_id, "firm_id": production_data.firm_id},
            sort=[("created_at", -1)]
        )
    output_current_balance = last_output_entry.get("running_balance", 0) if last_output_entry else 0
    output_new_balance = output_current_balance + production_data.output_quantity
    
    output_ledger_entry = {
        "id": str(uuid.uuid4()),
        "entry_number": output_entry_number,
        "entry_type": "production_output",
        "item_type": item_type,
        "item_id": production_data.output_sku_id,
        "item_name": output_sku.get("name") or output_sku.get("model_name"),
        "item_sku": output_sku.get("sku_code"),
        "firm_id": production_data.firm_id,
        "firm_name": firm.get("name"),
        "quantity": production_data.output_quantity,
        "running_balance": output_new_balance,
        "production_id": production_id,
        "production_number": production_number,
        "batch_number": production_data.batch_number,
        "notes": f"Produced in batch {production_number}" + (f": {production_data.notes}" if production_data.notes else ""),
        "created_by": user["id"],
        "created_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "created_at": created_at
    }
    await db.inventory_ledger.insert_one(output_ledger_entry)
    ledger_entries.append(output_ledger_entry["id"])
    
    # Update SKU stock (for backward compatibility with old skus collection)
    if not is_master_sku:
        await db.skus.update_one(
            {"id": production_data.output_sku_id},
            {"$inc": {"stock": production_data.output_quantity}}
        )
    
    # Create production record
    production_record = {
        "id": production_id,
        "production_number": production_number,
        "firm_id": production_data.firm_id,
        "firm_name": firm.get("name"),
        "output_sku_id": production_data.output_sku_id,
        "output_sku_name": output_sku.get("name") or output_sku.get("model_name"),
        "output_sku_code": output_sku.get("sku_code"),
        "output_quantity": production_data.output_quantity,
        "is_master_sku": is_master_sku,
        "used_bom": production_data.use_bom and is_master_sku,
        "materials_consumed": [
            {
                "material_id": mi["material_id"],
                "material_name": mi["material_name"],
                "material_sku": mi["material_sku"],
                "quantity_consumed": mi["quantity"]
            }
            for mi in materials_info
        ],
        "batch_number": production_data.batch_number,
        "notes": production_data.notes,
        "ledger_entries": ledger_entries,
        "created_by": user["id"],
        "created_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "created_at": created_at
    }
    await db.productions.insert_one(production_record)
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "production_created",
        "entity_type": "production",
        "entity_id": production_id,
        "user_id": user["id"],
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "details": {
            "production_number": production_number,
            "firm": firm.get("name"),
            "output": f"{output_sku.get('sku_code')} x {production_data.output_quantity}",
            "materials_count": len(materials_info),
            "used_bom": production_data.use_bom and is_master_sku
        },
        "timestamp": created_at
    })
    
    return ProductionResponse(**{k: v for k, v in production_record.items() if k != "_id" and k not in ["is_master_sku", "used_bom"]})


@api_router.get("/productions")
async def list_productions(
    firm_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 100,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """List production records with filters"""
    query = {}
    
    if firm_id:
        query["firm_id"] = firm_id
    
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    productions = await db.productions.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Calculate totals
    totals = {
        "total_productions": len(productions),
        "total_output": sum(p.get("output_quantity", 0) for p in productions),
        "total_materials_consumed": sum(
            sum(m.get("quantity_consumed", 0) for m in p.get("materials_consumed", []))
            for p in productions
        )
    }
    
    return {"productions": productions, "totals": totals}


@api_router.get("/productions/{production_id}")
async def get_production(
    production_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get a specific production record"""
    production = await db.productions.find_one({"id": production_id}, {"_id": 0})
    if not production:
        raise HTTPException(status_code=404, detail="Production record not found")
    return production


# ==================== PRODUCTION REQUEST WORKFLOW ENDPOINTS ====================

@api_router.post("/production-requests")
async def create_production_request(
    request_data: ProductionRequestCreate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Accountant creates a production request for a manufactured Master SKU.
    The request is routed to Supervisor or Technician based on manufacturing_role.
    """
    # Validate firm
    firm = await db.firms.find_one({"id": request_data.firm_id, "is_active": True})
    if not firm:
        raise HTTPException(status_code=400, detail="Firm not found or inactive")
    
    # Validate Master SKU
    master_sku = await db.master_skus.find_one({"id": request_data.master_sku_id, "is_active": True})
    if not master_sku:
        raise HTTPException(status_code=400, detail="Master SKU not found or inactive")
    
    # Check if product is manufactured
    if master_sku.get("product_type") != "manufactured":
        raise HTTPException(status_code=400, detail="Only manufactured products can have production requests. This SKU is marked as traded or unclassified.")
    
    # Get manufacturing role
    manufacturing_role = master_sku.get("manufacturing_role")
    if not manufacturing_role or manufacturing_role == "none":
        raise HTTPException(status_code=400, detail="Manufacturing role not set for this SKU. Please configure it in Master SKU settings.")
    
    if request_data.quantity_requested < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")
    
    # Validate BOM exists for this product
    bom = master_sku.get("bill_of_materials", [])
    if not bom:
        raise HTTPException(status_code=400, detail="No Bill of Materials defined for this product. Cannot create production request.")
    
    # Generate request number
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.production_requests.count_documents({})
    request_number = f"PR-{timestamp}-{count + 1:04d}"
    request_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Calculate raw material requirements
    raw_material_requirements = []
    for bom_item in bom:
        rm = await db.raw_materials.find_one({"id": bom_item["raw_material_id"]})
        if rm:
            required_qty = bom_item["quantity"] * request_data.quantity_requested
            # Get current stock
            last_entry = await db.inventory_ledger.find_one(
                {"item_id": bom_item["raw_material_id"], "firm_id": request_data.firm_id},
                sort=[("created_at", -1)]
            )
            current_stock = last_entry.get("running_balance", 0) if last_entry else 0
            raw_material_requirements.append({
                "raw_material_id": bom_item["raw_material_id"],
                "raw_material_name": rm.get("name"),
                "raw_material_sku": rm.get("sku_code"),
                "quantity_per_unit": bom_item["quantity"],
                "total_required": required_qty,
                "current_stock": current_stock,
                "sufficient": current_stock >= required_qty
            })
    
    production_request = {
        "id": request_id,
        "request_number": request_number,
        "firm_id": request_data.firm_id,
        "firm_name": firm.get("name"),
        "master_sku_id": request_data.master_sku_id,
        "master_sku_name": master_sku.get("name"),
        "master_sku_code": master_sku.get("sku_code"),
        "quantity_requested": request_data.quantity_requested,
        "quantity_produced": 0,
        "manufacturing_role": manufacturing_role,
        "production_charge_per_unit": master_sku.get("production_charge_per_unit"),
        "production_date": request_data.production_date,
        "raw_material_requirements": raw_material_requirements,
        "status": "requested",
        "remarks": request_data.remarks,
        "created_by": user["id"],
        "created_by_name": user.get("name", user.get("email")),
        "created_at": now,
        "updated_at": now,
        "accepted_at": None,
        "accepted_by": None,
        "started_at": None,
        "completed_at": None,
        "completed_by": None,
        "received_at": None,
        "received_by": None,
        "serial_numbers": [],
        "completion_notes": None
    }
    
    await db.production_requests.insert_one(production_request)
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "production_request_created",
        "entity_type": "production_request",
        "entity_id": request_id,
        "user_id": user["id"],
        "user_name": user.get("name", user.get("email")),
        "details": {
            "request_number": request_number,
            "firm": firm.get("name"),
            "master_sku": master_sku.get("name"),
            "quantity": request_data.quantity_requested,
            "assigned_to": manufacturing_role
        },
        "created_at": now
    })
    
    del production_request["_id"]
    return production_request


@api_router.get("/production-requests")
async def list_production_requests(
    status: Optional[str] = None,
    firm_id: Optional[str] = None,
    manufacturing_role: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant", "supervisor", "service_agent"]))
):
    """
    List production requests.
    - Accountant/Admin: see all requests
    - Supervisor: see only supervisor-assigned requests
    - Technician (service_agent): see only technician-assigned requests
    """
    query = {}
    
    # Role-based filtering
    if user["role"] == "supervisor":
        query["manufacturing_role"] = "supervisor"
    elif user["role"] == "service_agent":
        query["manufacturing_role"] = "technician"
    
    # Additional filters
    if status:
        query["status"] = status
    if firm_id:
        query["firm_id"] = firm_id
    if manufacturing_role and user["role"] in ["admin", "accountant"]:
        query["manufacturing_role"] = manufacturing_role
    
    requests = await db.production_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return requests


@api_router.get("/production-requests/{request_id}")
async def get_production_request(
    request_id: str,
    user: dict = Depends(require_roles(["admin", "accountant", "supervisor", "service_agent"]))
):
    """Get a specific production request"""
    request = await db.production_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Production request not found")
    
    # Role-based access check
    if user["role"] == "supervisor" and request.get("manufacturing_role") != "supervisor":
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "service_agent" and request.get("manufacturing_role") != "technician":
        raise HTTPException(status_code=403, detail="Access denied")
    
    return request


@api_router.put("/production-requests/{request_id}/accept")
async def accept_production_request(
    request_id: str,
    user: dict = Depends(require_roles(["supervisor", "service_agent"]))
):
    """Manufacturer accepts the production request"""
    request = await db.production_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Production request not found")
    
    # Role-based access check
    if user["role"] == "supervisor" and request.get("manufacturing_role") != "supervisor":
        raise HTTPException(status_code=403, detail="This request is assigned to technician, not supervisor")
    if user["role"] == "service_agent" and request.get("manufacturing_role") != "technician":
        raise HTTPException(status_code=403, detail="This request is assigned to supervisor, not technician")
    
    if request.get("status") != "requested":
        raise HTTPException(status_code=400, detail=f"Cannot accept request in '{request.get('status')}' status")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.production_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "accepted",
            "accepted_at": now,
            "accepted_by": user["id"],
            "accepted_by_name": user.get("name", user.get("email")),
            "updated_at": now
        }}
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "production_request_accepted",
        "entity_type": "production_request",
        "entity_id": request_id,
        "user_id": user["id"],
        "user_name": user.get("name", user.get("email")),
        "details": {"request_number": request.get("request_number")},
        "created_at": now
    })
    
    return {"message": "Production request accepted", "status": "accepted"}


@api_router.put("/production-requests/{request_id}/start")
async def start_production_request(
    request_id: str,
    user: dict = Depends(require_roles(["supervisor", "service_agent"]))
):
    """Manufacturer starts production"""
    request = await db.production_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Production request not found")
    
    # Role-based access check
    if user["role"] == "supervisor" and request.get("manufacturing_role") != "supervisor":
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "service_agent" and request.get("manufacturing_role") != "technician":
        raise HTTPException(status_code=403, detail="Access denied")
    
    if request.get("status") != "accepted":
        raise HTTPException(status_code=400, detail=f"Cannot start request in '{request.get('status')}' status. Must accept first.")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.production_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "in_progress",
            "started_at": now,
            "updated_at": now
        }}
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "production_started",
        "entity_type": "production_request",
        "entity_id": request_id,
        "user_id": user["id"],
        "user_name": user.get("name", user.get("email")),
        "details": {"request_number": request.get("request_number")},
        "created_at": now
    })
    
    return {"message": "Production started", "status": "in_progress"}


@api_router.put("/production-requests/{request_id}/complete")
async def complete_production_request(
    request_id: str,
    completion_data: ProductionCompletionData,
    user: dict = Depends(require_roles(["supervisor", "service_agent"]))
):
    """
    Manufacturer completes production and submits serial numbers.
    Does NOT update inventory yet - accountant must confirm receipt.
    """
    request = await db.production_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Production request not found")
    
    # Role-based access check
    if user["role"] == "supervisor" and request.get("manufacturing_role") != "supervisor":
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "service_agent" and request.get("manufacturing_role") != "technician":
        raise HTTPException(status_code=403, detail="Access denied")
    
    if request.get("status") not in ["accepted", "in_progress"]:
        raise HTTPException(status_code=400, detail=f"Cannot complete request in '{request.get('status')}' status")
    
    # Validate serial numbers count matches requested quantity
    if len(completion_data.serial_numbers) != request.get("quantity_requested"):
        raise HTTPException(
            status_code=400, 
            detail=f"Number of serial numbers ({len(completion_data.serial_numbers)}) must match requested quantity ({request.get('quantity_requested')})"
        )
    
    # Validate serial numbers are unique
    serial_list = [sn.serial_number for sn in completion_data.serial_numbers]
    if len(serial_list) != len(set(serial_list)):
        raise HTTPException(status_code=400, detail="Duplicate serial numbers found. Each serial number must be unique.")
    
    # Check for existing serial numbers in the system
    existing = await db.finished_good_serials.find_one({"serial_number": {"$in": serial_list}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Serial number '{existing.get('serial_number')}' already exists in the system")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Prepare serial number records
    serial_records = []
    for sn in completion_data.serial_numbers:
        serial_records.append({
            "serial_number": sn.serial_number,
            "notes": sn.notes,
            "entered_at": now
        })
    
    await db.production_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "completed",
            "completed_at": now,
            "completed_by": user["id"],
            "completed_by_name": user.get("name", user.get("email")),
            "quantity_produced": len(completion_data.serial_numbers),
            "serial_numbers": serial_records,
            "completion_notes": completion_data.completion_notes,
            "updated_at": now
        }}
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "production_completed",
        "entity_type": "production_request",
        "entity_id": request_id,
        "user_id": user["id"],
        "user_name": user.get("name", user.get("email")),
        "details": {
            "request_number": request.get("request_number"),
            "quantity_produced": len(completion_data.serial_numbers),
            "serial_numbers": serial_list
        },
        "created_at": now
    })
    
    return {"message": "Production completed. Awaiting accountant confirmation.", "status": "completed"}


@api_router.put("/production-requests/{request_id}/receive")
async def receive_production_into_inventory(
    request_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Accountant confirms receipt of produced goods into inventory.
    This triggers:
    1. Raw material consumption ledger entries
    2. Finished goods production output ledger entries
    3. Finished good serial records
    4. Supervisor payable creation (if supervisor-made)
    """
    request = await db.production_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Production request not found")
    
    if request.get("status") != "completed":
        raise HTTPException(status_code=400, detail=f"Cannot receive request in '{request.get('status')}' status. Must be completed first.")
    
    # Get Master SKU and validate BOM
    master_sku = await db.master_skus.find_one({"id": request.get("master_sku_id")})
    if not master_sku:
        raise HTTPException(status_code=400, detail="Master SKU not found")
    
    bom = master_sku.get("bill_of_materials", [])
    if not bom:
        raise HTTPException(status_code=400, detail="No Bill of Materials for this product")
    
    firm_id = request.get("firm_id")
    quantity_produced = request.get("quantity_produced", 0)
    now = datetime.now(timezone.utc).isoformat()
    
    # 1. Consume raw materials
    for bom_item in bom:
        rm = await db.raw_materials.find_one({"id": bom_item["raw_material_id"]})
        if not rm:
            raise HTTPException(status_code=400, detail=f"Raw material {bom_item['raw_material_id']} not found")
        
        consume_qty = bom_item["quantity"] * quantity_produced
        
        # Get current balance
        last_entry = await db.inventory_ledger.find_one(
            {"item_id": bom_item["raw_material_id"], "firm_id": firm_id},
            sort=[("created_at", -1)]
        )
        current_balance = last_entry.get("running_balance", 0) if last_entry else 0
        
        if current_balance < consume_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {rm.get('name')}. Available: {current_balance}, Required: {consume_qty}"
            )
        
        new_balance = current_balance - consume_qty
        
        # Create consumption ledger entry
        entry_number = f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:4].upper()}"
        ledger_entry = {
            "id": str(uuid.uuid4()),
            "entry_number": entry_number,
            "entry_type": "production_consume",
            "item_type": "raw_material",
            "item_id": bom_item["raw_material_id"],
            "item_name": rm.get("name"),
            "item_sku": rm.get("sku_code"),
            "firm_id": firm_id,
            "firm_name": request.get("firm_name"),
            "quantity": -consume_qty,
            "running_balance": new_balance,
            "reference_id": request_id,
            "notes": f"Production request {request.get('request_number')}",
            "created_by": user["id"],
            "created_by_name": user.get("name", user.get("email")),
            "created_at": now
        }
        await db.inventory_ledger.insert_one(ledger_entry)
    
    # 2. Create production output ledger entry for Master SKU
    last_output_entry = await db.inventory_ledger.find_one(
        {"item_id": request.get("master_sku_id"), "item_type": "master_sku", "firm_id": firm_id},
        sort=[("created_at", -1)]
    )
    output_balance = last_output_entry.get("running_balance", 0) if last_output_entry else 0
    new_output_balance = output_balance + quantity_produced
    
    output_entry_number = f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:4].upper()}"
    output_ledger_entry = {
        "id": str(uuid.uuid4()),
        "entry_number": output_entry_number,
        "entry_type": "production_output",
        "item_type": "master_sku",
        "item_id": request.get("master_sku_id"),
        "item_name": request.get("master_sku_name"),
        "item_sku": request.get("master_sku_code"),
        "firm_id": firm_id,
        "firm_name": request.get("firm_name"),
        "quantity": quantity_produced,
        "running_balance": new_output_balance,
        "reference_id": request_id,
        "notes": f"Production request {request.get('request_number')}",
        "created_by": user["id"],
        "created_by_name": user.get("name", user.get("email")),
        "created_at": now
    }
    await db.inventory_ledger.insert_one(output_ledger_entry)
    
    # 3. Create finished good serial records
    for sn in request.get("serial_numbers", []):
        serial_record = {
            "id": str(uuid.uuid4()),
            "serial_number": sn.get("serial_number"),
            "master_sku_id": request.get("master_sku_id"),
            "master_sku_name": request.get("master_sku_name"),
            "master_sku_code": request.get("master_sku_code"),
            "firm_id": firm_id,
            "firm_name": request.get("firm_name"),
            "production_request_id": request_id,
            "production_request_number": request.get("request_number"),
            "manufactured_by_role": request.get("manufacturing_role"),
            "manufactured_by_user": request.get("completed_by"),
            "manufactured_by_name": request.get("completed_by_name"),
            "manufactured_at": request.get("completed_at"),
            "received_at": now,
            "received_by": user["id"],
            "status": "in_stock",  # in_stock, dispatched, returned
            "dispatch_id": None,
            "dispatch_date": None,
            "notes": sn.get("notes"),
            "created_at": now
        }
        await db.finished_good_serials.insert_one(serial_record)
    
    # 4. Create supervisor payable if supervisor-made
    payable_id = None
    if request.get("manufacturing_role") == "supervisor":
        charge_per_unit = request.get("production_charge_per_unit") or 0
        total_payable = charge_per_unit * quantity_produced
        
        payable_id = str(uuid.uuid4())
        payable_number = f"PAY-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{await db.supervisor_payables.count_documents({}) + 1:04d}"
        
        payable = {
            "id": payable_id,
            "payable_number": payable_number,
            "production_request_id": request_id,
            "production_request_number": request.get("request_number"),
            "firm_id": firm_id,
            "firm_name": request.get("firm_name"),
            "master_sku_id": request.get("master_sku_id"),
            "master_sku_name": request.get("master_sku_name"),
            "master_sku_code": request.get("master_sku_code"),
            "quantity_produced": quantity_produced,
            "rate_per_unit": charge_per_unit,
            "total_payable": total_payable,
            "amount_paid": 0,
            "status": "unpaid",  # unpaid, part_paid, paid
            "payments": [],
            "remarks": None,
            "created_by": user["id"],
            "created_by_name": user.get("name", user.get("email")),
            "created_at": now,
            "updated_at": now
        }
        await db.supervisor_payables.insert_one(payable)
        
        # Audit log for payable
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "supervisor_payable_created",
            "entity_type": "supervisor_payable",
            "entity_id": payable_id,
            "user_id": user["id"],
            "user_name": user.get("name", user.get("email")),
            "details": {
                "payable_number": payable_number,
                "production_request": request.get("request_number"),
                "total_payable": total_payable
            },
            "created_at": now
        })
    
    # Update production request status
    await db.production_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "received_into_inventory",
            "received_at": now,
            "received_by": user["id"],
            "received_by_name": user.get("name", user.get("email")),
            "payable_id": payable_id,
            "updated_at": now
        }}
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "production_received_into_inventory",
        "entity_type": "production_request",
        "entity_id": request_id,
        "user_id": user["id"],
        "user_name": user.get("name", user.get("email")),
        "details": {
            "request_number": request.get("request_number"),
            "quantity_received": quantity_produced,
            "serial_numbers": [sn.get("serial_number") for sn in request.get("serial_numbers", [])]
        },
        "created_at": now
    })
    
    # Create notification for production completion
    await create_notification(
        title="Production Completed",
        message=f"Production {request.get('request_number')} completed: {quantity_produced} units of {request.get('master_sku_name')} received into inventory",
        notification_type="success",
        link="/accountant/production",
        target_roles=["accountant", "admin"],
        priority="normal"
    )
    
    return {
        "message": "Production received into inventory",
        "status": "received_into_inventory",
        "quantity_received": quantity_produced,
        "payable_created": payable_id is not None,
        "payable_id": payable_id
    }


@api_router.put("/production-requests/{request_id}/cancel")
async def cancel_production_request(
    request_id: str,
    remarks: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Cancel a production request (only if not yet completed)"""
    request = await db.production_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Production request not found")
    
    if request.get("status") in ["completed", "received_into_inventory"]:
        raise HTTPException(status_code=400, detail="Cannot cancel a completed or received request")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.production_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": now,
            "cancelled_by": user["id"],
            "cancelled_by_name": user.get("name", user.get("email")),
            "cancellation_remarks": remarks,
            "updated_at": now
        }}
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "production_request_cancelled",
        "entity_type": "production_request",
        "entity_id": request_id,
        "user_id": user["id"],
        "user_name": user.get("name", user.get("email")),
        "details": {"request_number": request.get("request_number"), "remarks": remarks},
        "created_at": now
    })
    
    return {"message": "Production request cancelled", "status": "cancelled"}


# ==================== SUPERVISOR PAYABLE ENDPOINTS ====================

@api_router.get("/supervisor-payables")
async def list_supervisor_payables(
    status: Optional[str] = None,
    firm_id: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant", "supervisor"]))
):
    """List supervisor payables"""
    query = {}
    if status:
        query["status"] = status
    if firm_id:
        query["firm_id"] = firm_id
    
    payables = await db.supervisor_payables.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    
    # Calculate totals
    total_payable = sum(p.get("total_payable", 0) for p in payables)
    total_paid = sum(p.get("amount_paid", 0) for p in payables)
    total_pending = total_payable - total_paid
    
    return {
        "payables": payables,
        "summary": {
            "total_payable": total_payable,
            "total_paid": total_paid,
            "total_pending": total_pending,
            "count": len(payables)
        }
    }


@api_router.get("/supervisor-payables/{payable_id}")
async def get_supervisor_payable(
    payable_id: str,
    user: dict = Depends(require_roles(["admin", "accountant", "supervisor"]))
):
    """Get a specific supervisor payable"""
    payable = await db.supervisor_payables.find_one({"id": payable_id}, {"_id": 0})
    if not payable:
        raise HTTPException(status_code=404, detail="Payable not found")
    return payable


@api_router.put("/supervisor-payables/{payable_id}/payment")
async def record_payable_payment(
    payable_id: str,
    payment_data: SupervisorPayableUpdate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Record a payment against a supervisor payable"""
    payable = await db.supervisor_payables.find_one({"id": payable_id})
    if not payable:
        raise HTTPException(status_code=404, detail="Payable not found")
    
    if payable.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Payable is already fully paid")
    
    amount_paid = payment_data.amount_paid or 0
    if amount_paid <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than 0")
    
    current_paid = payable.get("amount_paid", 0)
    total_payable = payable.get("total_payable", 0)
    new_total_paid = current_paid + amount_paid
    
    if new_total_paid > total_payable:
        raise HTTPException(status_code=400, detail=f"Payment exceeds pending amount. Pending: {total_payable - current_paid}")
    
    # Determine new status
    if new_total_paid >= total_payable:
        new_status = "paid"
    elif new_total_paid > 0:
        new_status = "part_paid"
    else:
        new_status = "unpaid"
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Record payment
    payment_record = {
        "id": str(uuid.uuid4()),
        "amount": amount_paid,
        "reference": payment_data.payment_reference,
        "remarks": payment_data.remarks,
        "paid_by": user["id"],
        "paid_by_name": user.get("name", user.get("email")),
        "paid_at": now
    }
    
    await db.supervisor_payables.update_one(
        {"id": payable_id},
        {
            "$set": {
                "amount_paid": new_total_paid,
                "status": new_status,
                "updated_at": now
            },
            "$push": {"payments": payment_record}
        }
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "supervisor_payment_recorded",
        "entity_type": "supervisor_payable",
        "entity_id": payable_id,
        "user_id": user["id"],
        "user_name": user.get("name", user.get("email")),
        "details": {
            "payable_number": payable.get("payable_number"),
            "amount": amount_paid,
            "new_status": new_status,
            "reference": payment_data.payment_reference
        },
        "created_at": now
    })
    
    return {
        "message": "Payment recorded",
        "status": new_status,
        "total_paid": new_total_paid,
        "pending": total_payable - new_total_paid
    }


# ==================== FINISHED GOOD SERIAL ENDPOINTS ====================

@api_router.get("/finished-good-serials")
async def list_finished_good_serials(
    master_sku_id: Optional[str] = None,
    firm_id: Optional[str] = None,
    status: Optional[str] = None,
    condition: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 2000,
    user: dict = Depends(require_roles(["admin", "accountant", "supervisor", "service_agent", "dispatcher"]))
):
    """List finished good serial numbers with filtering"""
    query = {}
    if master_sku_id:
        query["master_sku_id"] = master_sku_id
    if firm_id:
        query["firm_id"] = firm_id
    if status:
        query["status"] = status
    if condition:
        query["condition"] = condition
    if search:
        query["$or"] = [
            {"serial_number": {"$regex": search, "$options": "i"}},
            {"master_sku_name": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"order_id": {"$regex": search, "$options": "i"}}
        ]
    
    serials = await db.finished_good_serials.find(query, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 5000))
    return serials


@api_router.get("/finished-good-serials/{serial_id}")
async def get_finished_good_serial(
    serial_id: str,
    user: dict = Depends(require_roles(["admin", "accountant", "supervisor", "service_agent", "dispatcher"]))
):
    """Get a specific serial number record"""
    serial = await db.finished_good_serials.find_one({"id": serial_id}, {"_id": 0})
    if not serial:
        raise HTTPException(status_code=404, detail="Serial number not found")
    return serial


@api_router.get("/finished-good-serials/lookup/{serial_number}")
async def lookup_serial_number(
    serial_number: str,
    user: dict = Depends(require_roles(["admin", "accountant", "supervisor", "service_agent", "dispatcher"]))
):
    """Look up a serial number by its value"""
    serial = await db.finished_good_serials.find_one({"serial_number": serial_number}, {"_id": 0})
    if not serial:
        raise HTTPException(status_code=404, detail="Serial number not found")
    return serial


@api_router.get("/finished-good-serials/available/{master_sku_id}")
async def get_available_serials_for_dispatch(
    master_sku_id: str,
    firm_id: str,
    user: dict = Depends(require_roles(["admin", "accountant", "dispatcher"]))
):
    """Get available (in_stock) serial numbers for a Master SKU at a firm - for dispatch selection"""
    serials = await db.finished_good_serials.find(
        {
            "master_sku_id": master_sku_id,
            "firm_id": firm_id,
            "status": "in_stock"
        },
        {"_id": 0}
    ).to_list(10000)
    return serials

@api_router.get("/inventory/stock")
async def get_inventory_stock(
    firm_id: Optional[str] = None,
    item_type: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get current stock levels across firms - includes all Master SKUs for all firms"""
    result = {
        "raw_materials": [],
        "finished_goods": [],
        "master_skus": [],  # New: Master SKUs with per-firm stock
        "summary": {
            "total_raw_materials": 0,
            "total_finished_goods": 0,
            "total_master_skus": 0,
            "low_stock_alerts": 0,
            "negative_stock_alerts": 0
        }
    }
    
    # Get all active firms
    firm_query = {"is_active": True}
    if firm_id:
        firm_query["id"] = firm_id
    firms = await db.firms.find(firm_query, {"_id": 0}).to_list(100)
    firm_map = {f["id"]: f for f in firms}
    
    # Get raw materials (now firm-agnostic, stock per firm from ledger)
    if not item_type or item_type == "raw_material":
        raw_materials = await db.raw_materials.find({"is_active": True}, {"_id": 0}).to_list(1000)
        
        for rm in raw_materials:
            # For each raw material, show stock per firm
            for firm in firms:
                last_entry = await db.inventory_ledger.find_one(
                    {"item_id": rm["id"], "firm_id": firm["id"], "item_type": "raw_material"},
                    sort=[("created_at", -1)]
                )
                stock = last_entry.get("running_balance", 0) if last_entry else 0
                
                is_low = stock <= rm.get("reorder_level", 0)
                is_negative = stock < 0
                
                result["raw_materials"].append({
                    "id": rm["id"],
                    "item_id": rm["id"],  # For consistency with ledger entries
                    "name": rm.get("name"),
                    "sku_code": rm.get("sku_code"),
                    "unit": rm.get("unit"),
                    "hsn_code": rm.get("hsn_code"),
                    "reorder_level": rm.get("reorder_level", 10),
                    "firm_id": firm["id"],
                    "firm_name": firm.get("name"),
                    "current_stock": stock,
                    "is_low_stock": is_low,
                    "is_negative": is_negative
                })
                
                if is_low:
                    result["summary"]["low_stock_alerts"] += 1
                if is_negative:
                    result["summary"]["negative_stock_alerts"] += 1
        
        result["summary"]["total_raw_materials"] = len(raw_materials)
    
    # Get finished goods (old SKUs - for backward compatibility)
    if not item_type or item_type == "finished_good":
        sku_query = {"active": True}
        if firm_id:
            sku_query["firm_id"] = firm_id
        skus = await db.skus.find(sku_query, {"_id": 0}).to_list(1000)
        
        for sku in skus:
            firm = firm_map.get(sku.get("firm_id"), {})
            sku["firm_name"] = firm.get("name")
            sku["is_low_stock"] = sku.get("stock_quantity", 0) <= sku.get("min_stock_alert", 0)
            sku["is_negative"] = sku.get("stock_quantity", 0) < 0
            result["finished_goods"].append(sku)
            
            if sku["is_low_stock"]:
                result["summary"]["low_stock_alerts"] += 1
            if sku["is_negative"]:
                result["summary"]["negative_stock_alerts"] += 1
        
        result["summary"]["total_finished_goods"] = len(skus)
    
    # Get Master SKUs - show ALL Master SKUs for ALL firms (even with zero stock)
    if not item_type or item_type == "master_sku":
        master_skus = await db.master_skus.find({"is_active": True}, {"_id": 0}).to_list(10000)
        
        for sku in master_skus:
            is_manufactured = sku.get("product_type") == "manufactured"
            
            # For each Master SKU, create an entry for each firm
            for firm in firms:
                if is_manufactured:
                    # For manufactured items, count stock from finished_good_serials
                    in_stock_serials = await db.finished_good_serials.find(
                        {"master_sku_id": sku["id"], "firm_id": firm["id"], "status": "in_stock"},
                        {"_id": 0, "serial_number": 1, "manufactured_at": 1, "notes": 1}
                    ).to_list(10000)
                    stock = len(in_stock_serials)
                    serial_numbers = [s["serial_number"] for s in in_stock_serials]
                else:
                    # For traded items, use ledger balance
                    last_entry = await db.inventory_ledger.find_one(
                        {"item_id": sku["id"], "firm_id": firm["id"], "item_type": "master_sku"},
                        sort=[("created_at", -1)]
                    )
                    stock = last_entry.get("running_balance", 0) if last_entry else 0
                    serial_numbers = []
                
                is_low = stock <= sku.get("reorder_level", 10)
                is_negative = stock < 0
                
                result["master_skus"].append({
                    "id": sku["id"],
                    "item_id": sku["id"],  # For consistency with ledger entries
                    "name": sku.get("name"),
                    "sku_code": sku.get("sku_code"),
                    "category": sku.get("category"),
                    "hsn_code": sku.get("hsn_code"),
                    "unit": sku.get("unit", "pcs"),
                    "is_manufactured": sku.get("is_manufactured", False),
                    "product_type": sku.get("product_type"),
                    "manufacturing_role": sku.get("manufacturing_role"),
                    "has_bom": len(sku.get("bill_of_materials", [])) > 0,
                    "aliases_count": len(sku.get("aliases", [])),
                    "reorder_level": sku.get("reorder_level", 10),
                    "firm_id": firm["id"],
                    "firm_name": firm.get("name"),
                    "current_stock": stock,
                    "serial_numbers": serial_numbers if is_manufactured else [],
                    "is_low_stock": is_low,
                    "is_negative": is_negative
                })
                
                if is_low:
                    result["summary"]["low_stock_alerts"] += 1
                if is_negative:
                    result["summary"]["negative_stock_alerts"] += 1
        
        result["summary"]["total_master_skus"] = len(master_skus)
    
    return result

@api_router.get("/inventory/stock-by-firm")
async def get_stock_by_firm(
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get stock summary grouped by firm"""
    firms = await db.firms.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    result = []
    for firm in firms:
        firm_data = {
            "firm_id": firm["id"],
            "firm_name": firm["name"],
            "gstin": firm["gstin"],
            "raw_materials_count": 0,
            "raw_materials_value": 0,
            "finished_goods_count": 0,
            "finished_goods_value": 0,
            "low_stock_items": 0
        }
        
        # Count raw materials
        rm_count = await db.raw_materials.count_documents({"firm_id": firm["id"], "is_active": True})
        firm_data["raw_materials_count"] = rm_count
        
        # Get raw materials stock
        raw_materials = await db.raw_materials.find(
            {"firm_id": firm["id"], "is_active": True},
            {"_id": 0, "current_stock": 1, "reorder_level": 1}
        ).to_list(1000)
        
        for rm in raw_materials:
            if rm.get("current_stock", 0) <= rm.get("reorder_level", 0):
                firm_data["low_stock_items"] += 1
        
        # Count finished goods for this firm
        fg_count = await db.skus.count_documents({"firm_id": firm["id"], "active": True})
        firm_data["finished_goods_count"] = fg_count
        
        skus = await db.skus.find(
            {"firm_id": firm["id"], "active": True},
            {"_id": 0, "stock_quantity": 1, "min_stock_alert": 1}
        ).to_list(1000)
        
        for sku in skus:
            if sku.get("stock_quantity", 0) <= sku.get("min_stock_alert", 0):
                firm_data["low_stock_items"] += 1
        
        result.append(firm_data)
    
    return result

# ==================== STOCK MOVEMENT REPORTS ====================

@api_router.get("/reports/stock-ledger")
async def get_stock_ledger_report(
    firm_id: Optional[str] = None,
    item_type: Optional[str] = None,
    item_id: Optional[str] = None,
    entry_type: Optional[str] = None,
    created_by: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(500, le=2000),
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Stock Ledger Report - All inventory movements
    Filters: date range, firm, item/SKU, ledger type, user
    """
    query = {}
    
    if firm_id:
        query["firm_id"] = firm_id
    if item_type:
        query["item_type"] = item_type
    if item_id:
        query["item_id"] = item_id
    if entry_type:
        query["entry_type"] = entry_type
    if created_by:
        query["created_by"] = created_by
    
    # Date range filter
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to + "T23:59:59"
        query["created_at"] = date_query
    
    entries = await db.inventory_ledger.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Calculate totals
    totals = {
        "total_entries": len(entries),
        "total_in": 0,
        "total_out": 0,
        "by_entry_type": {},
        "by_firm": {}
    }
    
    for entry in entries:
        qty = entry.get("quantity", 0)
        entry_type_val = entry.get("entry_type")
        firm_name = entry.get("firm_name", "Unknown")
        
        # Count by entry type
        if entry_type_val not in totals["by_entry_type"]:
            totals["by_entry_type"][entry_type_val] = {"count": 0, "quantity": 0}
        totals["by_entry_type"][entry_type_val]["count"] += 1
        totals["by_entry_type"][entry_type_val]["quantity"] += qty
        
        # Count by firm
        if firm_name not in totals["by_firm"]:
            totals["by_firm"][firm_name] = {"count": 0, "in_qty": 0, "out_qty": 0}
        totals["by_firm"][firm_name]["count"] += 1
        
        # In/Out totals
        if entry_type_val in ["purchase", "transfer_in", "adjustment_in", "return_in", "repair_yard_in"]:
            totals["total_in"] += qty
            totals["by_firm"][firm_name]["in_qty"] += qty
        else:
            totals["total_out"] += qty
            totals["by_firm"][firm_name]["out_qty"] += qty
    
    return {
        "entries": entries,
        "totals": totals,
        "filters_applied": {
            "firm_id": firm_id,
            "item_type": item_type,
            "item_id": item_id,
            "entry_type": entry_type,
            "created_by": created_by,
            "date_from": date_from,
            "date_to": date_to
        }
    }

@api_router.get("/reports/current-stock")
async def get_current_stock_report(
    firm_id: Optional[str] = None,
    item_type: Optional[str] = None,
    low_stock_only: bool = False,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Current Stock Report - Firm-wise stock levels
    Shows: raw materials and finished goods separately, low stock / reorder alerts
    """
    result = {
        "raw_materials": [],
        "finished_goods": [],
        "firms_summary": [],
        "totals": {
            "total_raw_materials": 0,
            "total_finished_goods": 0,
            "low_stock_count": 0,
            "negative_stock_count": 0
        }
    }
    
    # Get all active firms
    firm_query = {"is_active": True}
    if firm_id:
        firm_query["id"] = firm_id
    firms = await db.firms.find(firm_query, {"_id": 0}).to_list(100)
    firm_map = {f["id"]: f for f in firms}
    
    # Process each firm
    for firm in firms:
        firm_summary = {
            "firm_id": firm["id"],
            "firm_name": firm["name"],
            "gstin": firm["gstin"],
            "raw_materials_count": 0,
            "raw_materials_qty": 0,
            "finished_goods_count": 0,
            "finished_goods_qty": 0,
            "low_stock_items": [],
            "negative_stock_items": []
        }
        
        # Raw materials for this firm
        if not item_type or item_type == "raw_material":
            rm_query = {"firm_id": firm["id"], "is_active": True}
            raw_materials = await db.raw_materials.find(rm_query, {"_id": 0}).to_list(1000)
            
            for rm in raw_materials:
                rm["firm_name"] = firm["name"]
                rm["is_low_stock"] = rm.get("current_stock", 0) <= rm.get("reorder_level", 0)
                rm["is_negative"] = rm.get("current_stock", 0) < 0
                
                if low_stock_only and not (rm["is_low_stock"] or rm["is_negative"]):
                    continue
                
                result["raw_materials"].append(rm)
                firm_summary["raw_materials_count"] += 1
                firm_summary["raw_materials_qty"] += rm.get("current_stock", 0)
                
                if rm["is_low_stock"]:
                    firm_summary["low_stock_items"].append(rm["sku_code"])
                    result["totals"]["low_stock_count"] += 1
                if rm["is_negative"]:
                    firm_summary["negative_stock_items"].append(rm["sku_code"])
                    result["totals"]["negative_stock_count"] += 1
        
        # Finished goods for this firm
        if not item_type or item_type == "finished_good":
            sku_query = {"firm_id": firm["id"], "active": True}
            skus = await db.skus.find(sku_query, {"_id": 0}).to_list(1000)
            
            for sku in skus:
                sku["firm_name"] = firm["name"]
                sku["is_low_stock"] = sku.get("stock_quantity", 0) <= sku.get("min_stock_alert", 0)
                sku["is_negative"] = sku.get("stock_quantity", 0) < 0
                
                if low_stock_only and not (sku["is_low_stock"] or sku["is_negative"]):
                    continue
                
                result["finished_goods"].append(sku)
                firm_summary["finished_goods_count"] += 1
                firm_summary["finished_goods_qty"] += sku.get("stock_quantity", 0)
                
                if sku["is_low_stock"]:
                    firm_summary["low_stock_items"].append(sku["sku_code"])
                    result["totals"]["low_stock_count"] += 1
                if sku["is_negative"]:
                    firm_summary["negative_stock_items"].append(sku["sku_code"])
                    result["totals"]["negative_stock_count"] += 1
        
        result["firms_summary"].append(firm_summary)
    
    result["totals"]["total_raw_materials"] = len(result["raw_materials"])
    result["totals"]["total_finished_goods"] = len(result["finished_goods"])
    
    return result

@api_router.get("/reports/transfers")
async def get_transfer_report(
    from_firm_id: Optional[str] = None,
    to_firm_id: Optional[str] = None,
    item_id: Optional[str] = None,
    invoice_number: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(500, le=2000),
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Transfer Report - Inter-firm stock transfers
    Filters: source firm, destination firm, invoice number, item, date
    """
    query = {}
    
    if from_firm_id:
        query["from_firm_id"] = from_firm_id
    if to_firm_id:
        query["to_firm_id"] = to_firm_id
    if item_id:
        query["item_id"] = item_id
    if invoice_number:
        query["invoice_number"] = {"$regex": invoice_number, "$options": "i"}
    
    # Date range filter
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to + "T23:59:59"
        query["created_at"] = date_query
    
    transfers = await db.stock_transfers.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Calculate totals
    totals = {
        "total_transfers": len(transfers),
        "total_quantity": sum(t.get("quantity", 0) for t in transfers),
        "by_source_firm": {},
        "by_dest_firm": {}
    }
    
    for transfer in transfers:
        src = transfer.get("from_firm_name", "Unknown")
        dest = transfer.get("to_firm_name", "Unknown")
        qty = transfer.get("quantity", 0)
        
        if src not in totals["by_source_firm"]:
            totals["by_source_firm"][src] = {"count": 0, "quantity": 0}
        totals["by_source_firm"][src]["count"] += 1
        totals["by_source_firm"][src]["quantity"] += qty
        
        if dest not in totals["by_dest_firm"]:
            totals["by_dest_firm"][dest] = {"count": 0, "quantity": 0}
        totals["by_dest_firm"][dest]["count"] += 1
        totals["by_dest_firm"][dest]["quantity"] += qty
    
    return {
        "transfers": transfers,
        "totals": totals
    }

@api_router.get("/reports/dispatch-return")
async def get_dispatch_return_report(
    firm_id: Optional[str] = None,
    item_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(500, le=2000),
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Dispatch and Return Report
    Shows: dispatch_out and return_in entries with linked references
    """
    query = {"entry_type": {"$in": ["dispatch_out", "return_in"]}}
    
    if firm_id:
        query["firm_id"] = firm_id
    if item_id:
        query["item_id"] = item_id
    
    # Date range filter
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to + "T23:59:59"
        query["created_at"] = date_query
    
    entries = await db.inventory_ledger.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Separate dispatches and returns
    dispatches = [e for e in entries if e.get("entry_type") == "dispatch_out"]
    returns = [e for e in entries if e.get("entry_type") == "return_in"]
    
    totals = {
        "total_dispatched": sum(e.get("quantity", 0) for e in dispatches),
        "total_returned": sum(e.get("quantity", 0) for e in returns),
        "dispatch_count": len(dispatches),
        "return_count": len(returns),
        "net_out": sum(e.get("quantity", 0) for e in dispatches) - sum(e.get("quantity", 0) for e in returns)
    }
    
    return {
        "dispatches": dispatches,
        "returns": returns,
        "totals": totals
    }

@api_router.get("/reports/adjustments")
async def get_adjustment_report(
    firm_id: Optional[str] = None,
    item_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(500, le=2000),
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Adjustment and Repair-Yard Report
    Shows: adjustment_in, adjustment_out, repair_yard_in with mandatory reasons visible
    """
    query = {"entry_type": {"$in": ["adjustment_in", "adjustment_out", "repair_yard_in"]}}
    
    if firm_id:
        query["firm_id"] = firm_id
    if item_id:
        query["item_id"] = item_id
    
    # Date range filter
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to + "T23:59:59"
        query["created_at"] = date_query
    
    entries = await db.inventory_ledger.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Separate by type
    adjustments_in = [e for e in entries if e.get("entry_type") == "adjustment_in"]
    adjustments_out = [e for e in entries if e.get("entry_type") == "adjustment_out"]
    repair_yard = [e for e in entries if e.get("entry_type") == "repair_yard_in"]
    
    totals = {
        "adjustment_in_qty": sum(e.get("quantity", 0) for e in adjustments_in),
        "adjustment_out_qty": sum(e.get("quantity", 0) for e in adjustments_out),
        "repair_yard_qty": sum(e.get("quantity", 0) for e in repair_yard),
        "adjustment_in_count": len(adjustments_in),
        "adjustment_out_count": len(adjustments_out),
        "repair_yard_count": len(repair_yard),
        "net_adjustment": (
            sum(e.get("quantity", 0) for e in adjustments_in) + 
            sum(e.get("quantity", 0) for e in repair_yard) - 
            sum(e.get("quantity", 0) for e in adjustments_out)
        )
    }
    
    return {
        "adjustments_in": adjustments_in,
        "adjustments_out": adjustments_out,
        "repair_yard": repair_yard,
        "all_entries": entries,
        "totals": totals
    }

@api_router.get("/reports/export/csv")
async def export_report_csv(
    report_type: str = Query(..., description="ledger, stock, transfers, dispatch_return, adjustments"),
    firm_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Export report data as CSV"""
    import io
    import csv
    from fastapi.responses import StreamingResponse
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    if report_type == "ledger":
        # Get ledger data
        query = {}
        if firm_id:
            query["firm_id"] = firm_id
        if date_from or date_to:
            date_query = {}
            if date_from:
                date_query["$gte"] = date_from
            if date_to:
                date_query["$lte"] = date_to + "T23:59:59"
            query["created_at"] = date_query
        
        entries = await db.inventory_ledger.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
        
        # Write header
        writer.writerow([
            "Entry Number", "Date", "Type", "Item SKU", "Item Name", "Firm", 
            "Quantity", "Running Balance", "Unit Price", "Total Value",
            "Invoice/Ref", "Reason", "Created By"
        ])
        
        # Write data
        for e in entries:
            writer.writerow([
                e.get("entry_number"),
                e.get("created_at", "")[:10],
                e.get("entry_type"),
                e.get("item_sku"),
                e.get("item_name"),
                e.get("firm_name"),
                e.get("quantity"),
                e.get("running_balance"),
                e.get("unit_price", ""),
                e.get("total_value", ""),
                e.get("invoice_number", ""),
                e.get("reason", ""),
                e.get("created_by_name")
            ])
    
    elif report_type == "stock":
        # Current stock
        firms = await db.firms.find({"is_active": True}, {"_id": 0}).to_list(100)
        
        writer.writerow([
            "Firm", "GSTIN", "Item Type", "SKU Code", "Item Name", 
            "Current Stock", "Reorder Level", "Status"
        ])
        
        for firm in firms:
            # Raw materials
            rms = await db.raw_materials.find({"firm_id": firm["id"], "is_active": True}, {"_id": 0}).to_list(1000)
            for rm in rms:
                status = "OK"
                if rm.get("current_stock", 0) < 0:
                    status = "NEGATIVE"
                elif rm.get("current_stock", 0) <= rm.get("reorder_level", 0):
                    status = "LOW"
                writer.writerow([
                    firm["name"], firm["gstin"], "Raw Material",
                    rm.get("sku_code"), rm.get("name"),
                    rm.get("current_stock", 0), rm.get("reorder_level"),
                    status
                ])
            
            # SKUs
            skus = await db.skus.find({"firm_id": firm["id"], "active": True}, {"_id": 0}).to_list(1000)
            for sku in skus:
                status = "OK"
                if sku.get("stock_quantity", 0) < 0:
                    status = "NEGATIVE"
                elif sku.get("stock_quantity", 0) <= sku.get("min_stock_alert", 0):
                    status = "LOW"
                writer.writerow([
                    firm["name"], firm["gstin"], "Finished Good",
                    sku.get("sku_code"), sku.get("model_name"),
                    sku.get("stock_quantity", 0), sku.get("min_stock_alert"),
                    status
                ])
    
    elif report_type == "transfers":
        query = {}
        if firm_id:
            query["$or"] = [{"from_firm_id": firm_id}, {"to_firm_id": firm_id}]
        if date_from or date_to:
            date_query = {}
            if date_from:
                date_query["$gte"] = date_from
            if date_to:
                date_query["$lte"] = date_to + "T23:59:59"
            query["created_at"] = date_query
        
        transfers = await db.stock_transfers.find(query, {"_id": 0}).to_list(5000)
        
        writer.writerow([
            "Transfer Number", "Date", "Item SKU", "Item Name",
            "From Firm", "To Firm", "Quantity", "Invoice Number", "Created By"
        ])
        
        for t in transfers:
            writer.writerow([
                t.get("transfer_number"),
                t.get("created_at", "")[:10],
                t.get("item_sku"),
                t.get("item_name"),
                t.get("from_firm_name"),
                t.get("to_firm_name"),
                t.get("quantity"),
                t.get("invoice_number"),
                t.get("created_by_name")
            ])
    
    else:
        writer.writerow(["Error", "Invalid report type"])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={report_type}_report.csv"}
    )

# ==================== PENDING FULFILLMENT QUEUE (AMAZON ORDERS) ====================

@api_router.post("/pending-fulfillment")
async def create_pending_fulfillment(
    data: PendingFulfillmentCreate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Create a pending fulfillment entry for Amazon orders awaiting stock"""
    # Validate firm
    firm = await db.firms.find_one({"id": data.firm_id, "is_active": True})
    if not firm:
        raise HTTPException(status_code=400, detail="Invalid or inactive firm")
    
    # Validate Master SKU
    master_sku = await db.master_skus.find_one({"id": data.master_sku_id, "is_active": True})
    if not master_sku:
        raise HTTPException(status_code=400, detail="Invalid or inactive Master SKU")
    
    # Check for duplicate order_id
    existing = await db.pending_fulfillment.find_one({"order_id": data.order_id, "status": {"$nin": ["dispatched", "cancelled", "expired"]}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Order {data.order_id} already has an active pending fulfillment entry")
    
    fulfillment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expiry_date = now + timedelta(days=data.label_expiry_days)
    
    # Check current stock
    current_stock = await get_current_stock("master_sku", data.master_sku_id, data.firm_id)
    initial_status = "ready_to_dispatch" if current_stock >= data.quantity else "awaiting_stock"
    
    fulfillment_doc = {
        "id": fulfillment_id,
        "order_id": data.order_id,
        "tracking_id": data.tracking_id,
        "firm_id": data.firm_id,
        "master_sku_id": data.master_sku_id,
        "quantity": data.quantity,
        "label_created_at": now.isoformat(),
        "label_expiry_date": expiry_date.isoformat(),
        "status": initial_status,
        "tracking_history": [{
            "tracking_id": data.tracking_id,
            "created_at": now.isoformat(),
            "status": "active"
        }],
        "notes": data.notes,
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.pending_fulfillment.insert_one(fulfillment_doc)
    
    # Remove MongoDB's _id before returning (not JSON serializable)
    fulfillment_doc.pop("_id", None)
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "pending_fulfillment_created",
        "entity_type": "pending_fulfillment",
        "entity_id": fulfillment_id,
        "entity_name": data.order_id,
        "performed_by": user["id"],
        "performed_by_name": f"{user['first_name']} {user['last_name']}",
        "details": {"tracking_id": data.tracking_id, "sku": master_sku.get("sku_code"), "status": initial_status},
        "timestamp": now.isoformat()
    })
    
    # Enrich response
    fulfillment_doc["firm_name"] = firm.get("name")
    fulfillment_doc["master_sku_name"] = master_sku.get("name")
    fulfillment_doc["sku_code"] = master_sku.get("sku_code")
    fulfillment_doc["current_stock"] = current_stock
    fulfillment_doc["is_label_expired"] = False
    fulfillment_doc["is_label_expiring_soon"] = (expiry_date - now).total_seconds() < 86400
    
    return fulfillment_doc

@api_router.get("/pending-fulfillment")
async def list_pending_fulfillment(
    status: Optional[str] = None,
    firm_id: Optional[str] = None,
    include_expired: bool = False,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """List all pending fulfillment entries"""
    query = {}
    # Don't filter by status initially if status is ready_to_dispatch
    # We need to check awaiting_stock entries that might now have stock
    filter_for_ready = status == "ready_to_dispatch"
    
    if status and not filter_for_ready:
        query["status"] = status
    elif not include_expired and not filter_for_ready:
        query["status"] = {"$nin": ["expired", "cancelled", "dispatched"]}
    elif not include_expired:
        # For ready_to_dispatch filter, include awaiting_stock as well (they might have stock now)
        query["status"] = {"$in": ["awaiting_stock", "ready_to_dispatch"]}
    
    if firm_id:
        query["firm_id"] = firm_id
    
    entries = await db.pending_fulfillment.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get firms and SKUs for enrichment
    firm_ids = list(set(e.get("firm_id") for e in entries if e.get("firm_id")))
    sku_ids = list(set(e.get("master_sku_id") for e in entries if e.get("master_sku_id")))
    
    firms = await db.firms.find({"id": {"$in": firm_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    skus = await db.master_skus.find({"id": {"$in": sku_ids}}, {"_id": 0, "id": 1, "name": 1, "sku_code": 1}).to_list(1000)
    
    firm_map = {f["id"]: f["name"] for f in firms}
    sku_map = {s["id"]: {"name": s["name"], "sku_code": s.get("sku_code")} for s in skus}
    
    now = datetime.now(timezone.utc)
    
    for entry in entries:
        entry["firm_name"] = firm_map.get(entry.get("firm_id"))
        sku_info = sku_map.get(entry.get("master_sku_id"), {})
        entry["master_sku_name"] = sku_info.get("name")
        entry["sku_code"] = sku_info.get("sku_code")
        
        # Calculate stock and expiry status
        current_stock = await get_current_stock("master_sku", entry.get("master_sku_id"), entry.get("firm_id"))
        entry["current_stock"] = current_stock
        
        expiry_date = datetime.fromisoformat(entry.get("label_expiry_date").replace("Z", "+00:00")) if entry.get("label_expiry_date") else now
        entry["is_label_expired"] = now > expiry_date
        entry["is_label_expiring_soon"] = 0 < (expiry_date - now).total_seconds() < 86400
        
        # Auto-update status if needed
        if entry["status"] == "awaiting_stock" and current_stock >= entry.get("quantity", 1):
            entry["status"] = "ready_to_dispatch"
            await db.pending_fulfillment.update_one(
                {"id": entry["id"]},
                {"$set": {"status": "ready_to_dispatch", "updated_at": now.isoformat()}}
            )
            # Create notification for stock availability
            await create_notification(
                title="Order Ready for Dispatch",
                message=f"Order {entry.get('order_id')} now has stock available and is ready for dispatch",
                notification_type="success",
                link="/accountant/pending-fulfillment",
                target_roles=["accountant", "admin"],
                priority="high"
            )
    
    # Summary stats
    summary = {
        "total": len(entries),
        "awaiting_stock": len([e for e in entries if e.get("status") == "awaiting_stock"]),
        "ready_to_dispatch": len([e for e in entries if e.get("status") == "ready_to_dispatch"]),
        "expired_labels": len([e for e in entries if e.get("is_label_expired")]),
        "expiring_soon": len([e for e in entries if e.get("is_label_expiring_soon")])
    }
    
    # If filtering for ready_to_dispatch, filter out awaiting_stock entries
    if filter_for_ready:
        entries = [e for e in entries if e.get("status") == "ready_to_dispatch" and not e.get("is_label_expired")]
    
    return {"entries": entries, "summary": summary}

@api_router.get("/pending-fulfillment/{fulfillment_id}")
async def get_pending_fulfillment(
    fulfillment_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get a specific pending fulfillment entry"""
    entry = await db.pending_fulfillment.find_one({"id": fulfillment_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Pending fulfillment entry not found")
    
    # Enrich
    firm = await db.firms.find_one({"id": entry.get("firm_id")}, {"_id": 0, "name": 1})
    sku = await db.master_skus.find_one({"id": entry.get("master_sku_id")}, {"_id": 0, "name": 1, "sku_code": 1})
    
    entry["firm_name"] = firm.get("name") if firm else None
    entry["master_sku_name"] = sku.get("name") if sku else None
    entry["sku_code"] = sku.get("sku_code") if sku else None
    
    current_stock = await get_current_stock("master_sku", entry.get("master_sku_id"), entry.get("firm_id"))
    entry["current_stock"] = current_stock
    
    now = datetime.now(timezone.utc)
    expiry_date = datetime.fromisoformat(entry.get("label_expiry_date").replace("Z", "+00:00")) if entry.get("label_expiry_date") else now
    entry["is_label_expired"] = now > expiry_date
    entry["is_label_expiring_soon"] = 0 < (expiry_date - now).total_seconds() < 86400
    
    return entry

@api_router.put("/pending-fulfillment/{fulfillment_id}/regenerate-tracking")
async def regenerate_tracking_id(
    fulfillment_id: str,
    new_tracking_id: str = Form(...),
    expiry_days: int = Form(5),
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Regenerate tracking ID for a pending fulfillment (extends expiry)"""
    entry = await db.pending_fulfillment.find_one({"id": fulfillment_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Pending fulfillment entry not found")
    
    if entry.get("status") == "dispatched":
        raise HTTPException(status_code=400, detail="Cannot regenerate tracking for dispatched orders")
    
    now = datetime.now(timezone.utc)
    new_expiry = now + timedelta(days=expiry_days)
    
    # Mark old tracking as replaced in history
    tracking_history = entry.get("tracking_history", [])
    for th in tracking_history:
        if th.get("status") == "active":
            th["status"] = "replaced"
            th["expired_at"] = now.isoformat()
    
    # Add new tracking to history
    tracking_history.append({
        "tracking_id": new_tracking_id,
        "created_at": now.isoformat(),
        "status": "active"
    })
    
    await db.pending_fulfillment.update_one(
        {"id": fulfillment_id},
        {"$set": {
            "tracking_id": new_tracking_id,
            "label_created_at": now.isoformat(),
            "label_expiry_date": new_expiry.isoformat(),
            "tracking_history": tracking_history,
            "status": "awaiting_stock" if entry.get("status") == "expired" else entry.get("status"),
            "updated_at": now.isoformat()
        }}
    )
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "tracking_regenerated",
        "entity_type": "pending_fulfillment",
        "entity_id": fulfillment_id,
        "entity_name": entry.get("order_id"),
        "performed_by": user["id"],
        "performed_by_name": f"{user['first_name']} {user['last_name']}",
        "details": {"old_tracking": entry.get("tracking_id"), "new_tracking": new_tracking_id},
        "timestamp": now.isoformat()
    })
    
    return {"message": "Tracking ID regenerated", "new_tracking_id": new_tracking_id, "new_expiry_date": new_expiry.isoformat()}

@api_router.post("/pending-fulfillment/{fulfillment_id}/dispatch")
async def dispatch_pending_fulfillment(
    fulfillment_id: str,
    serial_number: Optional[str] = Form(None),  # Required for manufactured items
    notes: Optional[str] = Form(None),
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Dispatch a pending fulfillment order (deducts stock)"""
    entry = await db.pending_fulfillment.find_one({"id": fulfillment_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Pending fulfillment entry not found")
    
    if entry.get("status") == "dispatched":
        raise HTTPException(status_code=400, detail="Order already dispatched")
    
    if entry.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot dispatch cancelled order")
    
    # Check label expiry
    now = datetime.now(timezone.utc)
    expiry_date = datetime.fromisoformat(entry.get("label_expiry_date").replace("Z", "+00:00"))
    if now > expiry_date:
        raise HTTPException(status_code=400, detail="Label has expired. Please regenerate tracking ID first.")
    
    # Check stock
    master_sku = await db.master_skus.find_one({"id": entry.get("master_sku_id")})
    if not master_sku:
        raise HTTPException(status_code=400, detail="Master SKU not found")
    
    is_manufactured = master_sku.get("product_type") == "manufactured"
    
    if is_manufactured:
        # For manufactured items, must select a serial number
        if not serial_number:
            raise HTTPException(status_code=400, detail="Serial number is required for manufactured items")
        
        # Verify serial is available
        serial_entry = await db.finished_good_serials.find_one({
            "serial_number": serial_number,
            "master_sku_id": entry.get("master_sku_id"),
            "firm_id": entry.get("firm_id"),
            "status": "in_stock"
        })
        if not serial_entry:
            raise HTTPException(status_code=400, detail="Serial number not found or not in stock")
        
        # Mark serial as dispatched
        await db.finished_good_serials.update_one(
            {"id": serial_entry["id"]},
            {"$set": {"status": "dispatched", "dispatched_at": now.isoformat()}}
        )
    else:
        # For traded items, check ledger stock
        current_stock = await get_current_stock("master_sku", entry.get("master_sku_id"), entry.get("firm_id"))
        if current_stock < entry.get("quantity", 1):
            raise HTTPException(status_code=400, detail=f"Insufficient stock. Available: {current_stock}, Required: {entry.get('quantity')}")
    
    # Create dispatch entry
    dispatch_id = str(uuid.uuid4())
    dispatch_number = f"AMZ-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    firm = await db.firms.find_one({"id": entry.get("firm_id")})
    
    dispatch_doc = {
        "id": dispatch_id,
        "dispatch_number": dispatch_number,
        "dispatch_type": "amazon_fulfillment",
        "firm_id": entry.get("firm_id"),
        "firm_name": firm.get("name") if firm else None,
        "master_sku_id": entry.get("master_sku_id"),
        "master_sku_name": master_sku.get("name"),
        "sku_code": master_sku.get("sku_code"),
        "quantity": entry.get("quantity"),
        "serial_number": serial_number,
        "order_id": entry.get("order_id"),
        "tracking_id": entry.get("tracking_id"),
        "pending_fulfillment_id": fulfillment_id,
        "status": "dispatched",
        "notes": notes,
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "created_at": now.isoformat()
    }
    await db.dispatches.insert_one(dispatch_doc)
    
    # Create ledger entry for stock deduction (only for non-manufactured items)
    if not is_manufactured:
        ledger_id = str(uuid.uuid4())
        ledger_number = f"LED-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        
        current_stock = await get_current_stock("master_sku", entry.get("master_sku_id"), entry.get("firm_id"))
        new_balance = current_stock - entry.get("quantity", 1)
        
        ledger_entry = {
            "id": ledger_id,
            "entry_number": ledger_number,
            "entry_type": "dispatch_out",
            "item_type": "master_sku",
            "item_id": entry.get("master_sku_id"),
            "item_name": master_sku.get("name"),
            "item_sku": master_sku.get("sku_code"),
            "firm_id": entry.get("firm_id"),
            "firm_name": firm.get("name") if firm else None,
            "quantity": entry.get("quantity", 1),
            "running_balance": new_balance,
            "reference_id": dispatch_id,
            "notes": f"Amazon fulfillment dispatch - Order: {entry.get('order_id')}",
            "created_by": user["id"],
            "created_by_name": f"{user['first_name']} {user['last_name']}",
            "created_at": now.isoformat()
        }
        await db.inventory_ledger.insert_one(ledger_entry)
    
    # Update pending fulfillment status
    await db.pending_fulfillment.update_one(
        {"id": fulfillment_id},
        {"$set": {
            "status": "dispatched",
            "dispatched_at": now.isoformat(),
            "dispatch_id": dispatch_id,
            "updated_at": now.isoformat()
        }}
    )
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "pending_fulfillment_dispatched",
        "entity_type": "pending_fulfillment",
        "entity_id": fulfillment_id,
        "entity_name": entry.get("order_id"),
        "performed_by": user["id"],
        "performed_by_name": f"{user['first_name']} {user['last_name']}",
        "details": {"dispatch_id": dispatch_id, "tracking_id": entry.get("tracking_id"), "serial_number": serial_number},
        "timestamp": now.isoformat()
    })
    
    return {"message": "Order dispatched successfully", "dispatch_id": dispatch_id, "dispatch_number": dispatch_number}

@api_router.put("/pending-fulfillment/{fulfillment_id}/cancel")
async def cancel_pending_fulfillment(
    fulfillment_id: str,
    reason: str = Form(...),
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Cancel a pending fulfillment entry"""
    entry = await db.pending_fulfillment.find_one({"id": fulfillment_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Pending fulfillment entry not found")
    
    if entry.get("status") == "dispatched":
        raise HTTPException(status_code=400, detail="Cannot cancel dispatched orders")
    
    now = datetime.now(timezone.utc)
    
    await db.pending_fulfillment.update_one(
        {"id": fulfillment_id},
        {"$set": {
            "status": "cancelled",
            "cancellation_reason": reason,
            "cancelled_at": now.isoformat(),
            "cancelled_by": user["id"],
            "cancelled_by_name": f"{user['first_name']} {user['last_name']}",
            "updated_at": now.isoformat()
        }}
    )
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "pending_fulfillment_cancelled",
        "entity_type": "pending_fulfillment",
        "entity_id": fulfillment_id,
        "entity_name": entry.get("order_id"),
        "performed_by": user["id"],
        "performed_by_name": f"{user['first_name']} {user['last_name']}",
        "details": {"reason": reason},
        "timestamp": now.isoformat()
    })
    
    return {"message": "Order cancelled", "order_id": entry.get("order_id")}


# ==================== NOTIFICATIONS API ====================

@api_router.get("/notifications")
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get notifications for the current user"""
    user_role = user.get("role")
    user_id = user.get("id")
    
    # Build query - get notifications targeted to this user's role or specifically to them
    query = {
        "$or": [
            {"target_roles": None},  # Notifications for all
            {"target_roles": user_role},  # Notifications for this role
            {"target_roles": {"$in": [user_role]}},  # Role in list
            {"target_user_ids": user_id},  # Specifically for this user
            {"target_user_ids": {"$in": [user_id]}}  # User in list
        ]
    }
    
    if unread_only:
        query["read_by"] = {"$nin": [user_id]}
    
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Add is_read flag for each notification
    for n in notifications:
        n["is_read"] = user_id in n.get("read_by", [])
    
    # Get unread count
    unread_count = await db.notifications.count_documents({
        **query,
        "read_by": {"$nin": [user_id]}
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    user: dict = Depends(get_current_user)
):
    """Mark a notification as read"""
    user_id = user.get("id")
    
    result = await db.notifications.update_one(
        {"id": notification_id},
        {"$addToSet": {"read_by": user_id}}
    )
    
    if result.modified_count == 0:
        # Check if notification exists
        notification = await db.notifications.find_one({"id": notification_id})
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "message": "Notification marked as read"}

@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    """Mark all notifications as read for current user"""
    user_id = user.get("id")
    user_role = user.get("role")
    
    # Update all notifications visible to this user
    query = {
        "$or": [
            {"target_roles": None},
            {"target_roles": user_role},
            {"target_roles": {"$in": [user_role]}},
            {"target_user_ids": user_id},
            {"target_user_ids": {"$in": [user_id]}}
        ]
    }
    
    result = await db.notifications.update_many(
        query,
        {"$addToSet": {"read_by": user_id}}
    )
    
    return {"success": True, "marked_count": result.modified_count}

@api_router.post("/notifications", response_model=NotificationResponse)
async def create_notification_endpoint(
    data: NotificationCreate,
    user: dict = Depends(require_roles(["admin"]))
):
    """Create a new notification (admin only)"""
    notification_id = await create_notification(
        title=data.title,
        message=data.message,
        notification_type=data.type,
        link=data.link,
        target_roles=data.target_roles,
        target_user_ids=data.target_user_ids,
        priority=data.priority,
        created_by=user.get("id"),
        created_by_name=f"{user['first_name']} {user['last_name']}"
    )
    
    notification = await db.notifications.find_one({"id": notification_id}, {"_id": 0})
    notification["is_read"] = False
    return notification


# ==================== ACTIVITY LOGS ====================

@api_router.get("/admin/activity-logs")
async def get_activity_logs(
    action_type: Optional[str] = None,
    user_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 500,
    skip: int = 0,
    user: dict = Depends(require_roles(["admin"]))
):
    """Get comprehensive activity logs for admin"""
    query = {}
    
    if action_type:
        query["action"] = action_type
    if user_id:
        query["performed_by"] = user_id
    if entity_type:
        query["entity_type"] = entity_type
    if date_from:
        try:
            from_date = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            query["timestamp"] = {"$gte": from_date.isoformat()}
        except:
            pass
    if date_to:
        try:
            to_date = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            if "timestamp" in query:
                query["timestamp"]["$lte"] = to_date.isoformat()
            else:
                query["timestamp"] = {"$lte": to_date.isoformat()}
        except:
            pass
    if search:
        query["$or"] = [
            {"action": {"$regex": search, "$options": "i"}},
            {"performed_by_name": {"$regex": search, "$options": "i"}},
            {"entity_name": {"$regex": search, "$options": "i"}},
            {"entity_type": {"$regex": search, "$options": "i"}}
        ]
    
    # Get logs from audit_logs collection
    audit_logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    # Also collect logs from other sources to create a comprehensive view
    # Get gate scan logs
    gate_query = {}
    if date_from:
        gate_query["timestamp"] = {"$gte": date_from}
    if date_to:
        if "timestamp" in gate_query:
            gate_query["timestamp"]["$lte"] = date_to
        else:
            gate_query["timestamp"] = {"$lte": date_to}
    
    gate_logs = await db.gate_scans.find(gate_query, {"_id": 0}).sort("timestamp", -1).limit(200).to_list(200)
    
    # Transform gate logs to activity format
    for gl in gate_logs:
        gl["action"] = f"gate_scan_{gl.get('direction', 'unknown')}"
        gl["entity_type"] = "gate_scan"
        gl["entity_name"] = gl.get("ticket_number") or gl.get("dispatch_number") or gl.get("tracking_id", "Unknown")
        gl["performed_by_name"] = gl.get("scanned_by_name", "Gate Operator")
    
    # Combine and sort all logs
    all_logs = audit_logs + gate_logs
    all_logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    # Limit to requested amount
    all_logs = all_logs[:limit]
    
    # Get total count for pagination
    total_count = await db.audit_logs.count_documents(query)
    
    # Get unique action types for filter
    action_types = await db.audit_logs.distinct("action")
    entity_types = await db.audit_logs.distinct("entity_type")
    
    # Get users who have performed actions
    performers = await db.audit_logs.aggregate([
        {"$group": {"_id": {"id": "$performed_by", "name": "$performed_by_name"}}},
        {"$project": {"_id": 0, "id": "$_id.id", "name": "$_id.name"}}
    ]).to_list(100)
    
    return {
        "logs": all_logs,
        "total": total_count,
        "action_types": action_types,
        "entity_types": entity_types,
        "performers": [p for p in performers if p.get("id")]
    }

@api_router.post("/admin/activity-logs")
async def create_activity_log(
    action: str = Form(...),
    entity_type: str = Form(...),
    entity_id: str = Form(...),
    entity_name: str = Form(""),
    details: str = Form("{}"),
    user: dict = Depends(require_roles(["admin", "accountant", "supervisor", "call_support", "service_agent", "dispatcher", "gate"]))
):
    """Manually create an activity log entry"""
    now = datetime.now(timezone.utc).isoformat()
    
    try:
        details_dict = json.loads(details) if details else {}
    except:
        details_dict = {"raw": details}
    
    log_entry = {
        "id": str(uuid.uuid4()),
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_name": entity_name,
        "performed_by": user["id"],
        "performed_by_name": f"{user['first_name']} {user['last_name']}",
        "performed_by_role": user["role"],
        "details": details_dict,
        "timestamp": now
    }
    
    await db.audit_logs.insert_one(log_entry)
    if "_id" in log_entry:
        del log_entry["_id"]
    
    return log_entry


# ==================== DATA IMPORT/EXPORT ====================

@api_router.post("/admin/bulk-import")
async def bulk_import_data(
    file: UploadFile = File(...),
    clear_existing: bool = Form(False),
    user: dict = Depends(require_roles(["admin"]))
):
    """
    Import data from JSON export file.
    Use clear_existing=true to replace all data, false to merge/skip duplicates.
    """
    import json
    
    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")
    
    results = {}
    collections_order = [
        'firms',
        'users', 
        'master_skus',
        'raw_materials',
        'products',
        'skus',
        'warranties',
        'tickets',
        'dispatches',
        'production_requests',
        'productions',
        'supervisor_payables',
        'finished_good_serials',
        'inventory_ledger',
        'incoming_queue',
        'pending_fulfillment',
        'gate_logs',
        'audit_logs',
        'feedback',
        'appointments',
        'notifications',
        'stock_transfers',
        'supervisor_availability'
    ]
    
    for coll_name in collections_order:
        if coll_name not in data:
            continue
            
        docs = data[coll_name]
        if not docs:
            continue
        
        collection = db[coll_name]
        
        if clear_existing:
            # Clear and insert all
            await collection.delete_many({})
            if docs:
                await collection.insert_many(docs)
            results[coll_name] = {"imported": len(docs), "mode": "replaced"}
        else:
            # Merge - skip existing by id
            imported = 0
            skipped = 0
            for doc in docs:
                doc_id = doc.get('id')
                if doc_id:
                    existing = await collection.find_one({"id": doc_id})
                    if existing:
                        skipped += 1
                        continue
                await collection.insert_one(doc)
                imported += 1
            results[coll_name] = {"imported": imported, "skipped": skipped, "mode": "merged"}
    
    return {
        "success": True,
        "message": "Data import completed",
        "results": results
    }

@api_router.get("/admin/data-export")
async def export_all_data(
    user: dict = Depends(require_roles(["admin"]))
):
    """Export all data as JSON for backup/migration"""
    import json
    
    collections_to_export = [
        'users', 'firms', 'master_skus', 'raw_materials', 'products', 'skus',
        'warranties', 'tickets', 'dispatches', 'production_requests', 'productions',
        'supervisor_payables', 'finished_good_serials', 'inventory_ledger',
        'incoming_queue', 'pending_fulfillment', 'gate_logs', 'audit_logs',
        'feedback', 'appointments', 'notifications', 'stock_transfers', 'supervisor_availability'
    ]
    
    export_data = {}
    for coll_name in collections_to_export:
        docs = await db[coll_name].find({}, {"_id": 0}).to_list(100000)
        export_data[coll_name] = docs
    
    # Return as downloadable JSON
    from fastapi.responses import Response
    json_content = json.dumps(export_data, default=str, indent=2)
    
    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=crm_data_export.json"}
    )



# ==================== BOOTSTRAP / INITIAL SETUP ====================

@api_router.post("/setup/init")
async def bootstrap_system():
    """
    One-time setup endpoint to create initial admin user and default data.
    ONLY works if the database has ZERO users - for security.
    """
    # Check if any users exist
    user_count = await db.users.count_documents({})
    if user_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"System already initialized. {user_count} users exist. Use normal login."
        )
    
    now = datetime.now(timezone.utc).isoformat()
    created_users = []
    
    # Default users to create
    default_users = [
        {
            "role": "admin",
            "email": "admin@musclegrid.in",
            "first_name": "Admin",
            "last_name": "User",
            "phone": "9999999999"
        },
        {
            "role": "accountant",
            "email": "accountant@musclegrid.in",
            "first_name": "Accountant",
            "last_name": "User",
            "phone": "9999999998"
        },
        {
            "role": "supervisor",
            "email": "supervisor@musclegrid.in",
            "first_name": "Supervisor",
            "last_name": "User",
            "phone": "9999999997"
        },
        {
            "role": "call_support",
            "email": "support@musclegrid.in",
            "first_name": "Support",
            "last_name": "Agent",
            "phone": "9999999996"
        },
        {
            "role": "service_agent",
            "email": "service@musclegrid.in",
            "first_name": "Service",
            "last_name": "Agent",
            "phone": "9999999995"
        },
        {
            "role": "dispatcher",
            "email": "dispatcher@musclegrid.in",
            "first_name": "Dispatcher",
            "last_name": "User",
            "phone": "9999999994"
        },
        {
            "role": "gate",
            "email": "gate@musclegrid.in",
            "first_name": "Gate",
            "last_name": "Operator",
            "phone": "9999999993"
        },
        {
            "role": "technician",
            "email": "technician@musclegrid.in",
            "first_name": "Technician",
            "last_name": "User",
            "phone": "9999999992"
        }
    ]
    
    # Default password for all users (should be changed after first login)
    default_password = "Muscle@846"
    hashed_password = pwd_context.hash(default_password)
    
    for user_data in default_users:
        user_doc = {
            "id": str(uuid.uuid4()),
            "email": user_data["email"],
            "password": hashed_password,
            "first_name": user_data["first_name"],
            "last_name": user_data["last_name"],
            "phone": user_data["phone"],
            "role": user_data["role"],
            "is_active": True,
            "address": "",
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "110001",
            "created_at": now
        }
        await db.users.insert_one(user_doc)
        created_users.append({
            "email": user_data["email"],
            "role": user_data["role"],
            "name": f"{user_data['first_name']} {user_data['last_name']}"
        })
    
    # Create default firm
    firm_doc = {
        "id": str(uuid.uuid4()),
        "name": "MuscleGrid",
        "gst_number": "07AAACM1234A1Z5",
        "address": "Delhi, India",
        "is_active": True,
        "created_at": now
    }
    await db.firms.insert_one(firm_doc)
    
    return {
        "success": True,
        "message": "System initialized successfully!",
        "default_password": default_password,
        "users_created": created_users,
        "firm_created": firm_doc["name"],
        "next_steps": [
            "1. Login with any of the created users",
            "2. Go to /admin/data-management to import your data",
            "3. Change default passwords for security"
        ]
    }

@api_router.get("/setup/status")
async def check_setup_status():
    """Check if system has been initialized"""
    user_count = await db.users.count_documents({})
    firm_count = await db.firms.count_documents({})
    
    return {
        "initialized": user_count > 0,
        "user_count": user_count,
        "firm_count": firm_count,
        "message": "System initialized" if user_count > 0 else "System needs initialization. Call POST /api/setup/init"
    }


# ==================== FINANCE & GST PLANNING MODULE ====================

# Finance Models
class GSTITCEntry(BaseModel):
    firm_id: str
    month: str  # YYYY-MM format
    igst_balance: float = 0.0
    cgst_balance: float = 0.0
    sgst_balance: float = 0.0
    notes: Optional[str] = None

class DispatchInvoiceValue(BaseModel):
    taxable_value: float
    gst_rate: Optional[float] = None  # Override SKU rate if needed

class FinancialAuditLog(BaseModel):
    action: str
    entity_type: str
    entity_id: str
    details: dict

# Purchase Register Models
class PurchaseItem(BaseModel):
    item_type: str  # "raw_material" or "master_sku"
    item_id: str
    quantity: float
    rate: float  # Unit price before GST
    gst_rate: Optional[float] = None  # Override item's GST rate if needed

class PurchaseCreate(BaseModel):
    firm_id: str
    supplier_name: str
    supplier_gstin: Optional[str] = None
    supplier_state: str
    invoice_number: str
    invoice_date: str  # YYYY-MM-DD
    items: List[PurchaseItem]
    notes: Optional[str] = None
    gst_override: Optional[bool] = False  # Allow manual GST override
    save_as_draft: Optional[bool] = False  # If True, saves as draft even with validation errors
    supplier_invoice_file_url: Optional[str] = None  # URL of uploaded supplier invoice

# GSTIN validation helper
def validate_gstin(gstin: str) -> bool:
    """Validate GSTIN format: 2 digits state code + 10 char PAN + 1 digit + Z + 1 check digit"""
    if not gstin or len(gstin) != 15:
        return False
    import re
    pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
    return bool(re.match(pattern, gstin.upper()))

# State code mapping from GSTIN
INDIAN_STATES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
    "24": "Gujarat", "26": "Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
    "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman & Nicobar", "36": "Telangana", "37": "Andhra Pradesh"
}

def get_state_from_gstin(gstin: str) -> Optional[str]:
    """Extract state name from GSTIN"""
    if gstin and len(gstin) >= 2:
        state_code = gstin[:2]
        return INDIAN_STATES.get(state_code)
    return None

# Helper function to calculate Weighted Average Cost
async def calculate_wac(item_id: str, item_type: str, firm_id: str) -> float:
    """Calculate Weighted Average Cost for an item at a firm"""
    # Get all purchase and production entries for this item
    ledger_entries = await db.inventory_ledger.find({
        "item_id": item_id,
        "item_type": item_type,
        "firm_id": firm_id,
        "entry_type": {"$in": ["purchase", "production_output", "transfer_in"]}
    }).sort("created_at", 1).to_list(10000)
    
    total_qty = 0
    total_value = 0
    
    for entry in ledger_entries:
        qty = entry.get("quantity", 0)
        unit_cost = entry.get("unit_cost", 0)
        if qty > 0 and unit_cost > 0:
            total_qty += qty
            total_value += qty * unit_cost
    
    if total_qty > 0:
        return round(total_value / total_qty, 2)
    
    # Fallback to cost_price from master_sku
    if item_type == "master_sku":
        sku = await db.master_skus.find_one({"id": item_id})
        if sku and sku.get("cost_price"):
            return sku.get("cost_price")
    
    return 0.0

# Helper to log financial actions
async def log_financial_action(action: str, entity_type: str, entity_id: str, details: dict, user: dict):
    """Log financial audit entry"""
    log_entry = {
        "id": str(uuid.uuid4()),
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details,
        "user_id": user["id"],
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "user_role": user["role"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.financial_audit_logs.insert_one(log_entry)
    return log_entry

@api_router.get("/finance/dashboard")
async def get_finance_dashboard(
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get finance dashboard overview with firm-wise summary"""
    firms = await db.firms.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    firm_summaries = []
    total_inventory_value = 0
    total_receivables = 0
    total_gst_liability = 0
    
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    
    for firm in firms:
        firm_id = firm["id"]
        
        # Calculate inventory value (WAC method)
        inventory_value = 0
        
        # Get current stock for this firm
        stock_pipeline = [
            {"$match": {"firm_id": firm_id}},
            {"$group": {
                "_id": {"item_id": "$item_id", "item_type": "$item_type"},
                "total_qty": {"$sum": "$quantity"}
            }},
            {"$match": {"total_qty": {"$gt": 0}}}
        ]
        stock_items = await db.inventory_ledger.aggregate(stock_pipeline).to_list(1000)
        
        for item in stock_items:
            item_id = item["_id"]["item_id"]
            item_type = item["_id"]["item_type"]
            qty = item["total_qty"]
            
            # Get WAC for this item
            wac = await calculate_wac(item_id, item_type, firm_id)
            inventory_value += qty * wac
        
        # Get monthly sales (dispatched this month)
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        dispatches = await db.dispatches.find({
            "firm_id": firm_id,
            "status": "dispatched",
            "dispatched_at": {"$gte": month_start.isoformat()}
        }, {"_id": 0}).to_list(1000)
        
        monthly_sales = sum(d.get("invoice_value", 0) or 0 for d in dispatches)
        monthly_taxable = sum(d.get("taxable_value", 0) or 0 for d in dispatches)
        
        # Get GST ITC balance for this firm/month
        itc_entry = await db.gst_itc_balances.find_one({
            "firm_id": firm_id,
            "month": current_month
        }, {"_id": 0})
        
        itc_balance = 0
        if itc_entry:
            itc_balance = (itc_entry.get("igst_balance", 0) + 
                         itc_entry.get("cgst_balance", 0) + 
                         itc_entry.get("sgst_balance", 0))
        
        # Calculate estimated output GST from dispatches
        output_gst = 0
        for d in dispatches:
            taxable = d.get("taxable_value", 0) or 0
            gst_rate = d.get("gst_rate", 18) or 18
            output_gst += taxable * (gst_rate / 100)
        
        net_gst_payable = max(0, output_gst - itc_balance)
        
        firm_summary = {
            "firm_id": firm_id,
            "firm_name": firm["name"],
            "gstin": firm.get("gstin", firm.get("gst_number", "")),
            "inventory_value": round(inventory_value, 2),
            "monthly_sales": round(monthly_sales, 2),
            "monthly_taxable": round(monthly_taxable, 2),
            "itc_balance": round(itc_balance, 2),
            "output_gst": round(output_gst, 2),
            "net_gst_payable": round(net_gst_payable, 2)
        }
        firm_summaries.append(firm_summary)
        
        total_inventory_value += inventory_value
        total_gst_liability += net_gst_payable
    
    # Get pending dispatches (not yet invoiced)
    pending_dispatches = await db.dispatches.count_documents({
        "status": {"$in": ["pending_label", "ready_for_dispatch"]},
        "invoice_value": {"$exists": False}
    })
    
    # Get month-end alerts
    alerts = []
    if pending_dispatches > 0:
        alerts.append({
            "type": "warning",
            "message": f"{pending_dispatches} dispatches pending invoice value entry"
        })
    
    for summary in firm_summaries:
        if summary["net_gst_payable"] > 50000:
            alerts.append({
                "type": "info",
                "message": f"{summary['firm_name']}: High GST liability of Rs.{summary['net_gst_payable']:,.2f}"
            })
        if summary["itc_balance"] == 0:
            alerts.append({
                "type": "warning", 
                "message": f"{summary['firm_name']}: No ITC balance entered for {current_month}"
            })
    
    return {
        "current_month": current_month,
        "total_firms": len(firms),
        "total_inventory_value": round(total_inventory_value, 2),
        "total_gst_liability": round(total_gst_liability, 2),
        "firm_summaries": firm_summaries,
        "alerts": alerts,
        "pending_invoice_entries": pending_dispatches
    }

@api_router.get("/finance/firm/{firm_id}/summary")
async def get_firm_financial_summary(
    firm_id: str,
    month: Optional[str] = None,  # YYYY-MM format
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get detailed financial summary for a specific firm"""
    firm = await db.firms.find_one({"id": firm_id}, {"_id": 0})
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")
    
    target_month = month or datetime.now(timezone.utc).strftime("%Y-%m")
    year, month_num = map(int, target_month.split("-"))
    month_start = datetime(year, month_num, 1, tzinfo=timezone.utc)
    if month_num == 12:
        month_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        month_end = datetime(year, month_num + 1, 1, tzinfo=timezone.utc)
    
    # Sales (dispatches)
    dispatches = await db.dispatches.find({
        "firm_id": firm_id,
        "status": "dispatched",
        "dispatched_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    sales_value = sum(d.get("invoice_value", 0) or 0 for d in dispatches)
    sales_taxable = sum(d.get("taxable_value", 0) or 0 for d in dispatches)
    sales_count = len(dispatches)
    
    # Calculate GST breakup by rate
    gst_by_rate = {}
    for d in dispatches:
        rate = d.get("gst_rate", 18) or 18
        taxable = d.get("taxable_value", 0) or 0
        if rate not in gst_by_rate:
            gst_by_rate[rate] = {"taxable": 0, "gst": 0, "count": 0}
        gst_by_rate[rate]["taxable"] += taxable
        gst_by_rate[rate]["gst"] += taxable * (rate / 100)
        gst_by_rate[rate]["count"] += 1
    
    # Returns (incoming classified as return_inventory)
    returns = await db.inventory_ledger.find({
        "firm_id": firm_id,
        "entry_type": "return_in",
        "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    returns_value = sum(r.get("quantity", 0) * r.get("unit_cost", 0) for r in returns)
    returns_count = len(returns)
    
    # Transfers In
    transfers_in = await db.inventory_ledger.find({
        "firm_id": firm_id,
        "entry_type": "transfer_in",
        "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    transfers_in_value = sum(t.get("quantity", 0) * t.get("unit_cost", 0) for t in transfers_in)
    transfers_in_count = len(transfers_in)
    
    # Transfers Out
    transfers_out = await db.inventory_ledger.find({
        "firm_id": firm_id,
        "entry_type": "transfer_out",
        "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    transfers_out_value = sum(abs(t.get("quantity", 0)) * t.get("unit_cost", 0) for t in transfers_out)
    transfers_out_count = len(transfers_out)
    
    # Production Output
    production = await db.inventory_ledger.find({
        "firm_id": firm_id,
        "entry_type": "production_output",
        "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    production_value = sum(p.get("quantity", 0) * p.get("unit_cost", 0) for p in production)
    production_count = len(production)
    
    # Purchases
    purchases = await db.inventory_ledger.find({
        "firm_id": firm_id,
        "entry_type": "purchase",
        "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    purchases_value = sum(p.get("quantity", 0) * p.get("unit_cost", 0) for p in purchases)
    purchases_count = len(purchases)
    
    # Current Inventory Value
    inventory_value = 0
    stock_pipeline = [
        {"$match": {"firm_id": firm_id}},
        {"$group": {
            "_id": {"item_id": "$item_id", "item_type": "$item_type"},
            "total_qty": {"$sum": "$quantity"}
        }},
        {"$match": {"total_qty": {"$gt": 0}}}
    ]
    stock_items = await db.inventory_ledger.aggregate(stock_pipeline).to_list(1000)
    
    inventory_details = []
    for item in stock_items:
        item_id = item["_id"]["item_id"]
        item_type = item["_id"]["item_type"]
        qty = item["total_qty"]
        
        wac = await calculate_wac(item_id, item_type, firm_id)
        value = qty * wac
        inventory_value += value
        
        # Get item name
        if item_type == "master_sku":
            sku = await db.master_skus.find_one({"id": item_id}, {"_id": 0, "name": 1, "sku_code": 1})
            item_name = sku.get("name", "Unknown") if sku else "Unknown"
            sku_code = sku.get("sku_code", "") if sku else ""
        else:
            rm = await db.raw_materials.find_one({"id": item_id}, {"_id": 0, "name": 1, "sku_code": 1})
            item_name = rm.get("name", "Unknown") if rm else "Unknown"
            sku_code = rm.get("sku_code", "") if rm else ""
        
        inventory_details.append({
            "item_id": item_id,
            "item_type": item_type,
            "item_name": item_name,
            "sku_code": sku_code,
            "quantity": qty,
            "wac": wac,
            "value": round(value, 2)
        })
    
    # GST ITC Balance
    itc_entry = await db.gst_itc_balances.find_one({
        "firm_id": firm_id,
        "month": target_month
    }, {"_id": 0})
    
    itc_balance = {
        "igst": itc_entry.get("igst_balance", 0) if itc_entry else 0,
        "cgst": itc_entry.get("cgst_balance", 0) if itc_entry else 0,
        "sgst": itc_entry.get("sgst_balance", 0) if itc_entry else 0,
        "total": 0
    }
    itc_balance["total"] = itc_balance["igst"] + itc_balance["cgst"] + itc_balance["sgst"]
    
    # Output GST
    output_gst = sum(gst_by_rate[r]["gst"] for r in gst_by_rate)
    
    # Net GST Payable
    net_gst = max(0, output_gst - itc_balance["total"])
    
    return {
        "firm": {
            "id": firm_id,
            "name": firm["name"],
            "gstin": firm.get("gstin", firm.get("gst_number", ""))
        },
        "month": target_month,
        "sales": {
            "count": sales_count,
            "total_value": round(sales_value, 2),
            "taxable_value": round(sales_taxable, 2),
            "gst_by_rate": {str(k): {"taxable": round(v["taxable"], 2), "gst": round(v["gst"], 2), "count": v["count"]} for k, v in gst_by_rate.items()}
        },
        "returns": {
            "count": returns_count,
            "value": round(returns_value, 2)
        },
        "transfers": {
            "in": {"count": transfers_in_count, "value": round(transfers_in_value, 2)},
            "out": {"count": transfers_out_count, "value": round(transfers_out_value, 2)}
        },
        "production": {
            "count": production_count,
            "value": round(production_value, 2)
        },
        "purchases": {
            "count": purchases_count,
            "value": round(purchases_value, 2)
        },
        "inventory": {
            "total_value": round(inventory_value, 2),
            "item_count": len(inventory_details),
            "details": sorted(inventory_details, key=lambda x: x["value"], reverse=True)[:50]
        },
        "gst": {
            "output_gst": round(output_gst, 2),
            "itc_balance": itc_balance,
            "net_payable": round(net_gst, 2)
        }
    }

@api_router.post("/finance/gst-itc")
async def create_gst_itc_entry(
    entry: GSTITCEntry,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Create or update GST ITC balance entry for a firm/month"""
    # Validate firm
    firm = await db.firms.find_one({"id": entry.firm_id}, {"_id": 0})
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")
    
    # Check if entry exists for this firm/month
    existing = await db.gst_itc_balances.find_one({
        "firm_id": entry.firm_id,
        "month": entry.month
    })
    
    now = datetime.now(timezone.utc).isoformat()
    
    if existing:
        # Update existing entry
        old_values = {
            "igst": existing.get("igst_balance", 0),
            "cgst": existing.get("cgst_balance", 0),
            "sgst": existing.get("sgst_balance", 0)
        }
        
        await db.gst_itc_balances.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "igst_balance": entry.igst_balance,
                "cgst_balance": entry.cgst_balance,
                "sgst_balance": entry.sgst_balance,
                "notes": entry.notes,
                "updated_by": user["id"],
                "updated_at": now
            }}
        )
        
        # Log the update
        await log_financial_action(
            "gst_itc_updated",
            "gst_itc_balance",
            existing["id"],
            {
                "firm_id": entry.firm_id,
                "firm_name": firm["name"],
                "month": entry.month,
                "old_values": old_values,
                "new_values": {
                    "igst": entry.igst_balance,
                    "cgst": entry.cgst_balance,
                    "sgst": entry.sgst_balance
                },
                "notes": entry.notes
            },
            user
        )
        
        return {"success": True, "message": "ITC balance updated", "id": existing["id"]}
    else:
        # Create new entry
        entry_id = str(uuid.uuid4())
        entry_doc = {
            "id": entry_id,
            "firm_id": entry.firm_id,
            "firm_name": firm["name"],
            "month": entry.month,
            "igst_balance": entry.igst_balance,
            "cgst_balance": entry.cgst_balance,
            "sgst_balance": entry.sgst_balance,
            "notes": entry.notes,
            "created_by": user["id"],
            "created_at": now
        }
        
        await db.gst_itc_balances.insert_one(entry_doc)
        
        # Log the creation
        await log_financial_action(
            "gst_itc_created",
            "gst_itc_balance",
            entry_id,
            {
                "firm_id": entry.firm_id,
                "firm_name": firm["name"],
                "month": entry.month,
                "values": {
                    "igst": entry.igst_balance,
                    "cgst": entry.cgst_balance,
                    "sgst": entry.sgst_balance
                },
                "notes": entry.notes
            },
            user
        )
        
        return {"success": True, "message": "ITC balance created", "id": entry_id}

@api_router.get("/finance/gst-itc/{firm_id}")
async def get_gst_itc_history(
    firm_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get GST ITC balance history for a firm"""
    firm = await db.firms.find_one({"id": firm_id}, {"_id": 0})
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")
    
    entries = await db.gst_itc_balances.find(
        {"firm_id": firm_id},
        {"_id": 0}
    ).sort("month", -1).to_list(24)  # Last 2 years
    
    return {
        "firm": {"id": firm_id, "name": firm["name"]},
        "entries": entries
    }

@api_router.patch("/finance/dispatch/{dispatch_id}/invoice-value")
async def update_dispatch_invoice_value(
    dispatch_id: str,
    data: DispatchInvoiceValue,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Update invoice value for a dispatch (for GST calculation)"""
    dispatch = await db.dispatches.find_one({"id": dispatch_id}, {"_id": 0})
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    
    # Get GST rate from SKU if not provided
    gst_rate = data.gst_rate
    if gst_rate is None and dispatch.get("master_sku_id"):
        sku = await db.master_skus.find_one({"id": dispatch["master_sku_id"]}, {"_id": 0})
        gst_rate = sku.get("gst_rate", 18) if sku else 18
    elif gst_rate is None:
        gst_rate = 18
    
    gst_amount = data.taxable_value * (gst_rate / 100)
    invoice_value = data.taxable_value + gst_amount
    
    old_values = {
        "taxable_value": dispatch.get("taxable_value"),
        "gst_rate": dispatch.get("gst_rate"),
        "invoice_value": dispatch.get("invoice_value")
    }
    
    await db.dispatches.update_one(
        {"id": dispatch_id},
        {"$set": {
            "taxable_value": data.taxable_value,
            "gst_rate": gst_rate,
            "gst_amount": round(gst_amount, 2),
            "invoice_value": round(invoice_value, 2),
            "invoice_updated_by": user["id"],
            "invoice_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log the update
    await log_financial_action(
        "dispatch_invoice_updated",
        "dispatch",
        dispatch_id,
        {
            "dispatch_number": dispatch.get("dispatch_number"),
            "old_values": old_values,
            "new_values": {
                "taxable_value": data.taxable_value,
                "gst_rate": gst_rate,
                "gst_amount": round(gst_amount, 2),
                "invoice_value": round(invoice_value, 2)
            }
        },
        user
    )
    
    return {
        "success": True,
        "dispatch_id": dispatch_id,
        "taxable_value": data.taxable_value,
        "gst_rate": gst_rate,
        "gst_amount": round(gst_amount, 2),
        "invoice_value": round(invoice_value, 2)
    }

@api_router.get("/finance/transfer-recommendations")
async def get_transfer_recommendations(
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get smart transfer recommendations based on stock, sales velocity, and ITC"""
    firms = await db.firms.find({"is_active": True}, {"_id": 0}).to_list(100)
    if len(firms) < 2:
        return {"recommendations": [], "message": "Need at least 2 firms for transfer recommendations"}
    
    recommendations = []
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    
    # Get all SKUs
    skus = await db.master_skus.find({"is_active": True}, {"_id": 0}).to_list(1000)
    
    for sku in skus:
        sku_id = sku["id"]
        sku_code = sku["sku_code"]
        sku_name = sku["name"]
        reorder_level = sku.get("reorder_level", 10)
        
        firm_stock_data = []
        
        for firm in firms:
            firm_id = firm["id"]
            
            # Get current stock
            stock_result = await db.inventory_ledger.aggregate([
                {"$match": {"item_id": sku_id, "firm_id": firm_id}},
                {"$group": {"_id": None, "total": {"$sum": "$quantity"}}}
            ]).to_list(1)
            
            current_stock = stock_result[0]["total"] if stock_result else 0
            
            # Get sales velocity (dispatches in last 30 days)
            thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            dispatches = await db.dispatches.count_documents({
                "firm_id": firm_id,
                "master_sku_id": sku_id,
                "status": "dispatched",
                "dispatched_at": {"$gte": thirty_days_ago}
            })
            
            sales_velocity = dispatches  # Units sold in 30 days
            days_of_stock = (current_stock / sales_velocity * 30) if sales_velocity > 0 else 999
            
            # Get ITC balance
            itc_entry = await db.gst_itc_balances.find_one({
                "firm_id": firm_id,
                "month": current_month
            }, {"_id": 0})
            itc_balance = 0
            if itc_entry:
                itc_balance = (itc_entry.get("igst_balance", 0) + 
                             itc_entry.get("cgst_balance", 0) + 
                             itc_entry.get("sgst_balance", 0))
            
            firm_stock_data.append({
                "firm_id": firm_id,
                "firm_name": firm["name"],
                "current_stock": current_stock,
                "sales_velocity": sales_velocity,
                "days_of_stock": round(days_of_stock, 1),
                "itc_balance": itc_balance,
                "is_low_stock": current_stock < reorder_level,
                "is_surplus": current_stock > reorder_level * 3 and sales_velocity < current_stock / 90
            })
        
        # Find transfer opportunities
        low_stock_firms = [f for f in firm_stock_data if f["is_low_stock"] and f["sales_velocity"] > 0]
        surplus_firms = [f for f in firm_stock_data if f["is_surplus"]]
        
        for low_firm in low_stock_firms:
            for surplus_firm in surplus_firms:
                if low_firm["firm_id"] != surplus_firm["firm_id"]:
                    # Calculate recommended quantity
                    needed = max(reorder_level - low_firm["current_stock"], 0)
                    available = surplus_firm["current_stock"] - reorder_level
                    transfer_qty = min(needed, available)
                    
                    if transfer_qty > 0:
                        # ITC advisory (informational only)
                        itc_note = ""
                        if surplus_firm["itc_balance"] > low_firm["itc_balance"]:
                            itc_note = f"Note: {surplus_firm['firm_name']} has higher ITC (Rs.{surplus_firm['itc_balance']:,.0f}) - transfer may help balance"
                        
                        recommendations.append({
                            "sku_id": sku_id,
                            "sku_code": sku_code,
                            "sku_name": sku_name,
                            "from_firm": {
                                "id": surplus_firm["firm_id"],
                                "name": surplus_firm["firm_name"],
                                "current_stock": surplus_firm["current_stock"],
                                "days_of_stock": surplus_firm["days_of_stock"]
                            },
                            "to_firm": {
                                "id": low_firm["firm_id"],
                                "name": low_firm["firm_name"],
                                "current_stock": low_firm["current_stock"],
                                "days_of_stock": low_firm["days_of_stock"],
                                "sales_velocity": low_firm["sales_velocity"]
                            },
                            "recommended_qty": transfer_qty,
                            "reason": f"Low stock at {low_firm['firm_name']} ({low_firm['current_stock']} units, {low_firm['days_of_stock']} days), surplus at {surplus_firm['firm_name']} ({surplus_firm['current_stock']} units)",
                            "priority": "high" if low_firm["current_stock"] == 0 else "medium",
                            "itc_advisory": itc_note
                        })
    
    # Sort by priority
    recommendations.sort(key=lambda x: (0 if x["priority"] == "high" else 1, -x["recommended_qty"]))
    
    return {
        "recommendations": recommendations[:20],  # Top 20 recommendations
        "total_recommendations": len(recommendations),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/finance/inventory-valuation")
async def get_inventory_valuation(
    firm_id: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get detailed inventory valuation using WAC method"""
    query = {"is_active": True}
    if firm_id:
        query["id"] = firm_id
    
    firms = await db.firms.find(query, {"_id": 0}).to_list(100)
    
    result = []
    grand_total = 0
    
    for firm in firms:
        f_id = firm["id"]
        
        # Get stock by item
        stock_pipeline = [
            {"$match": {"firm_id": f_id}},
            {"$group": {
                "_id": {"item_id": "$item_id", "item_type": "$item_type"},
                "total_qty": {"$sum": "$quantity"}
            }},
            {"$match": {"total_qty": {"$gt": 0}}}
        ]
        stock_items = await db.inventory_ledger.aggregate(stock_pipeline).to_list(1000)
        
        firm_total = 0
        items = []
        
        for item in stock_items:
            item_id = item["_id"]["item_id"]
            item_type = item["_id"]["item_type"]
            qty = item["total_qty"]
            
            wac = await calculate_wac(item_id, item_type, f_id)
            value = qty * wac
            firm_total += value
            
            # Get item details
            if item_type == "master_sku":
                sku = await db.master_skus.find_one({"id": item_id}, {"_id": 0})
                item_name = sku.get("name", "Unknown") if sku else "Unknown"
                sku_code = sku.get("sku_code", "") if sku else ""
                hsn = sku.get("hsn_code", "") if sku else ""
                gst_rate = sku.get("gst_rate", 18) if sku else 18
            else:
                rm = await db.raw_materials.find_one({"id": item_id}, {"_id": 0})
                item_name = rm.get("name", "Unknown") if rm else "Unknown"
                sku_code = rm.get("sku_code", "") if rm else ""
                hsn = rm.get("hsn_code", "") if rm else ""
                gst_rate = 18
            
            items.append({
                "item_id": item_id,
                "item_type": item_type,
                "item_name": item_name,
                "sku_code": sku_code,
                "hsn_code": hsn,
                "gst_rate": gst_rate,
                "quantity": qty,
                "wac": round(wac, 2),
                "value": round(value, 2)
            })
        
        items.sort(key=lambda x: x["value"], reverse=True)
        grand_total += firm_total
        
        result.append({
            "firm_id": f_id,
            "firm_name": firm["name"],
            "gstin": firm.get("gstin", firm.get("gst_number", "")),
            "total_value": round(firm_total, 2),
            "item_count": len(items),
            "items": items
        })
    
    return {
        "valuation_method": "Weighted Average Cost (WAC)",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "grand_total": round(grand_total, 2),
        "firms": result
    }

@api_router.get("/finance/month-end-report")
async def get_month_end_report(
    month: str,  # YYYY-MM format
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get comprehensive month-end financial report"""
    year, month_num = map(int, month.split("-"))
    month_start = datetime(year, month_num, 1, tzinfo=timezone.utc)
    if month_num == 12:
        month_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        month_end = datetime(year, month_num + 1, 1, tzinfo=timezone.utc)
    
    firms = await db.firms.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    report = {
        "month": month,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "firms": [],
        "totals": {
            "sales": 0,
            "purchases": 0,
            "production": 0,
            "transfers": 0,
            "output_gst": 0,
            "itc_available": 0,
            "net_gst_payable": 0
        }
    }
    
    for firm in firms:
        firm_id = firm["id"]
        
        # Get detailed summary
        summary = await get_firm_financial_summary(firm_id, month, user)
        
        firm_report = {
            "firm_id": firm_id,
            "firm_name": firm["name"],
            "gstin": firm.get("gstin", firm.get("gst_number", "")),
            "sales": summary["sales"],
            "purchases": summary["purchases"],
            "production": summary["production"],
            "transfers": summary["transfers"],
            "returns": summary["returns"],
            "gst": summary["gst"],
            "inventory_value": summary["inventory"]["total_value"]
        }
        
        report["firms"].append(firm_report)
        
        # Update totals
        report["totals"]["sales"] += summary["sales"]["total_value"]
        report["totals"]["purchases"] += summary["purchases"]["value"]
        report["totals"]["production"] += summary["production"]["value"]
        report["totals"]["transfers"] += summary["transfers"]["in"]["value"]
        report["totals"]["output_gst"] += summary["gst"]["output_gst"]
        report["totals"]["itc_available"] += summary["gst"]["itc_balance"]["total"]
        report["totals"]["net_gst_payable"] += summary["gst"]["net_payable"]
    
    # Round totals
    for key in report["totals"]:
        report["totals"][key] = round(report["totals"][key], 2)
    
    return report

@api_router.get("/finance/export/{report_type}")
async def export_financial_report(
    report_type: str,  # inventory, gst, sales, month-end
    firm_id: Optional[str] = None,
    month: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Export financial reports as CSV"""
    import csv
    import io
    
    output = io.StringIO()
    
    if report_type == "inventory":
        valuation = await get_inventory_valuation(firm_id, user)
        
        writer = csv.writer(output)
        writer.writerow(["Firm", "GSTIN", "SKU Code", "Item Name", "HSN", "GST Rate", "Quantity", "WAC", "Value"])
        
        for firm in valuation["firms"]:
            for item in firm["items"]:
                writer.writerow([
                    firm["firm_name"],
                    firm["gstin"],
                    item["sku_code"],
                    item["item_name"],
                    item["hsn_code"],
                    item["gst_rate"],
                    item["quantity"],
                    item["wac"],
                    item["value"]
                ])
        
        writer.writerow([])
        writer.writerow(["Grand Total", "", "", "", "", "", "", "", valuation["grand_total"]])
        
    elif report_type == "gst":
        if not firm_id:
            raise HTTPException(status_code=400, detail="firm_id required for GST report")
        
        itc_history = await get_gst_itc_history(firm_id, user)
        
        writer = csv.writer(output)
        writer.writerow(["Month", "IGST Balance", "CGST Balance", "SGST Balance", "Total", "Notes"])
        
        for entry in itc_history["entries"]:
            total = entry.get("igst_balance", 0) + entry.get("cgst_balance", 0) + entry.get("sgst_balance", 0)
            writer.writerow([
                entry["month"],
                entry.get("igst_balance", 0),
                entry.get("cgst_balance", 0),
                entry.get("sgst_balance", 0),
                total,
                entry.get("notes", "")
            ])
    
    elif report_type == "month-end":
        if not month:
            month = datetime.now(timezone.utc).strftime("%Y-%m")
        
        report = await get_month_end_report(month, user)
        
        writer = csv.writer(output)
        writer.writerow(["Month-End Report:", month])
        writer.writerow([])
        writer.writerow(["Firm", "GSTIN", "Sales", "Purchases", "Production", "Transfers In", "Output GST", "ITC Available", "Net GST Payable"])
        
        for firm in report["firms"]:
            writer.writerow([
                firm["firm_name"],
                firm["gstin"],
                firm["sales"]["total_value"],
                firm["purchases"]["value"],
                firm["production"]["value"],
                firm["transfers"]["in"]["value"],
                firm["gst"]["output_gst"],
                firm["gst"]["itc_balance"]["total"],
                firm["gst"]["net_payable"]
            ])
        
        writer.writerow([])
        writer.writerow(["TOTALS", "", 
                        report["totals"]["sales"],
                        report["totals"]["purchases"],
                        report["totals"]["production"],
                        report["totals"]["transfers"],
                        report["totals"]["output_gst"],
                        report["totals"]["itc_available"],
                        report["totals"]["net_gst_payable"]])
    
    else:
        raise HTTPException(status_code=400, detail="Invalid report type. Use: inventory, gst, month-end")
    
    # Log export
    await log_financial_action(
        "report_exported",
        "financial_report",
        report_type,
        {"report_type": report_type, "firm_id": firm_id, "month": month},
        user
    )
    
    output.seek(0)
    
    from fastapi.responses import StreamingResponse
    
    filename = f"{report_type}_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api_router.get("/finance/audit-logs")
async def get_financial_audit_logs(
    entity_type: Optional[str] = None,
    firm_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get financial audit logs"""
    query = {}
    
    if entity_type:
        query["entity_type"] = entity_type
    if firm_id:
        query["details.firm_id"] = firm_id
    if from_date:
        query["timestamp"] = {"$gte": from_date}
    if to_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = to_date
        else:
            query["timestamp"] = {"$lte": to_date}
    
    logs = await db.financial_audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.financial_audit_logs.count_documents(query)
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "skip": skip
    }


# ==================== PURCHASE REGISTER MODULE ====================

@api_router.post("/purchases")
async def create_purchase(
    purchase: PurchaseCreate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Create a purchase entry with GST calculation and inventory update"""
    
    # Validate firm
    firm = await db.firms.find_one({"id": purchase.firm_id}, {"_id": 0})
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")
    
    firm_state = firm.get("state", "")
    firm_gstin = firm.get("gstin", firm.get("gst_number", ""))
    
    # Validate GSTIN if provided
    if purchase.supplier_gstin and not validate_gstin(purchase.supplier_gstin):
        raise HTTPException(status_code=400, detail="Invalid GSTIN format")
    
    # Validate invoice number uniqueness for this firm
    existing = await db.purchases.find_one({
        "firm_id": purchase.firm_id,
        "invoice_number": purchase.invoice_number
    })
    if existing:
        raise HTTPException(status_code=400, detail="Invoice number already exists for this firm")
    
    # Validate items
    if not purchase.items or len(purchase.items) == 0:
        raise HTTPException(status_code=400, detail="At least one item is required")
    
    # Determine GST type (IGST vs CGST+SGST)
    supplier_state = purchase.supplier_state.lower().strip()
    firm_state_lower = firm_state.lower().strip()
    is_inter_state = supplier_state != firm_state_lower
    
    now = datetime.now(timezone.utc).isoformat()
    purchase_id = str(uuid.uuid4())
    purchase_number = f"PUR-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:5].upper()}"
    
    # Process items and calculate GST
    processed_items = []
    total_taxable = 0
    total_igst = 0
    total_cgst = 0
    total_sgst = 0
    total_amount = 0
    
    ledger_entries = []
    
    for item in purchase.items:
        # Validate quantity
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Quantity must be positive")
        if item.rate <= 0:
            raise HTTPException(status_code=400, detail=f"Rate must be positive")
        
        # Get item details
        if item.item_type == "raw_material":
            item_doc = await db.raw_materials.find_one({"id": item.item_id}, {"_id": 0})
            if not item_doc:
                raise HTTPException(status_code=404, detail=f"Raw material not found: {item.item_id}")
        elif item.item_type == "master_sku":
            item_doc = await db.master_skus.find_one({"id": item.item_id}, {"_id": 0})
            if not item_doc:
                raise HTTPException(status_code=404, detail=f"Master SKU not found: {item.item_id}")
        else:
            raise HTTPException(status_code=400, detail="Invalid item type. Use 'raw_material' or 'master_sku'")
        
        # Get GST rate (from item or override)
        gst_rate = item.gst_rate if item.gst_rate is not None else item_doc.get("gst_rate", 18)
        
        # Calculate values
        taxable_value = item.quantity * item.rate
        gst_amount = taxable_value * (gst_rate / 100)
        
        if is_inter_state:
            igst = gst_amount
            cgst = 0
            sgst = 0
        else:
            igst = 0
            cgst = gst_amount / 2
            sgst = gst_amount / 2
        
        line_total = taxable_value + gst_amount
        
        processed_item = {
            "item_type": item.item_type,
            "item_id": item.item_id,
            "item_name": item_doc.get("name"),
            "sku_code": item_doc.get("sku_code"),
            "hsn_code": item_doc.get("hsn_code", ""),
            "quantity": item.quantity,
            "rate": item.rate,
            "gst_rate": gst_rate,
            "taxable_value": round(taxable_value, 2),
            "igst": round(igst, 2),
            "cgst": round(cgst, 2),
            "sgst": round(sgst, 2),
            "total": round(line_total, 2)
        }
        processed_items.append(processed_item)
        
        total_taxable += taxable_value
        total_igst += igst
        total_cgst += cgst
        total_sgst += sgst
        total_amount += line_total
        
        # Prepare ledger entry
        ledger_entry = {
            "id": str(uuid.uuid4()),
            "entry_number": f"LED-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:5].upper()}",
            "entry_type": "purchase",
            "item_type": item.item_type,
            "item_id": item.item_id,
            "item_name": item_doc.get("name"),
            "firm_id": purchase.firm_id,
            "firm_name": firm["name"],
            "quantity": item.quantity,
            "unit_cost": item.rate,
            "running_balance": 0,  # Will be calculated
            "invoice_number": purchase.invoice_number,
            "reference_id": purchase_id,
            "reason": f"Purchase from {purchase.supplier_name}",
            "created_by": user["id"],
            "created_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "created_at": now
        }
        ledger_entries.append(ledger_entry)
    
    # ====== COMPLIANCE VALIDATION ======
    compliance_data = {
        "supplier_name": purchase.supplier_name,
        "invoice_number": purchase.invoice_number,
        "invoice_date": purchase.invoice_date,
        "firm_id": purchase.firm_id,
        "items": processed_items,
        "totals": {
            "taxable_value": round(total_taxable, 2),
            "total_gst": round(total_igst + total_cgst + total_sgst, 2)
        }
    }
    
    # Check for files
    files_present = {"supplier_invoice_file": purchase.supplier_invoice_file_url}
    
    compliance_result = validate_document_compliance(
        "purchase_entry", 
        compliance_data, 
        files_present, 
        round(total_amount, 2)
    )
    
    # Determine status and doc_status
    if not compliance_result["can_proceed"] and not purchase.save_as_draft:
        # Hard block - cannot proceed
        raise HTTPException(
            status_code=400, 
            detail={
                "message": "Compliance validation failed - cannot post final entry",
                "hard_blocks": compliance_result["hard_blocks"],
                "missing_critical": compliance_result["missing_critical"],
                "suggestion": "Fix issues or save as draft"
            }
        )
    
    # Set status based on draft flag and compliance
    if purchase.save_as_draft:
        entry_status = "draft"
        doc_status = "pending" if compliance_result["soft_blocks"] or compliance_result["hard_blocks"] else "complete"
    else:
        entry_status = "final"
        doc_status = compliance_result["status"]
    
    # Create purchase record
    purchase_doc = {
        "id": purchase_id,
        "purchase_number": purchase_number,
        "firm_id": purchase.firm_id,
        "firm_name": firm["name"],
        "firm_gstin": firm_gstin,
        "supplier_name": purchase.supplier_name,
        "supplier_gstin": purchase.supplier_gstin,
        "supplier_state": purchase.supplier_state,
        "invoice_number": purchase.invoice_number,
        "invoice_date": purchase.invoice_date,
        "is_inter_state": is_inter_state,
        "items": processed_items,
        "total_taxable": round(total_taxable, 2),
        "total_igst": round(total_igst, 2),
        "total_cgst": round(total_cgst, 2),
        "total_sgst": round(total_sgst, 2),
        "total_gst": round(total_igst + total_cgst + total_sgst, 2),
        "total_amount": round(total_amount, 2),
        "totals": {
            "grand_total": round(total_amount, 2),
            "taxable_value": round(total_taxable, 2),
            "total_gst": round(total_igst + total_cgst + total_sgst, 2)
        },
        "notes": purchase.notes,
        "invoice_file": purchase.supplier_invoice_file_url,
        "status": entry_status,
        "doc_status": doc_status,
        "compliance_score": compliance_result["compliance_score"],
        "compliance_issues": compliance_result.get("soft_blocks", []) + compliance_result.get("warnings", []),
        "created_by": user["id"],
        "created_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "created_at": now
    }
    
    # Insert purchase
    await db.purchases.insert_one(purchase_doc)
    
    # Create compliance exception if there are issues (for non-draft entries)
    if entry_status == "final" and doc_status == "pending" and (compliance_result["soft_blocks"] or compliance_result["missing_important"]):
        severity = "critical" if compliance_result["missing_critical"] else "important"
        await create_compliance_exception(
            transaction_type="purchase_entry",
            transaction_id=purchase_id,
            transaction_ref=purchase_number,
            firm_id=purchase.firm_id,
            issues=compliance_result["soft_blocks"] + [f"Missing: {m['label']}" for m in compliance_result.get("missing_important", [])],
            severity=severity,
            user=user
        )
    
    # Insert ledger entries and update stock - ONLY for final entries
    ledger_entries_created = 0
    if entry_status == "final":
        for entry in ledger_entries:
            # Calculate running balance
            current_stock = await db.inventory_ledger.aggregate([
                {"$match": {
                    "item_id": entry["item_id"],
                    "item_type": entry["item_type"],
                    "firm_id": purchase.firm_id
                }},
                {"$group": {"_id": None, "total": {"$sum": "$quantity"}}}
            ]).to_list(1)
            
            current_balance = current_stock[0]["total"] if current_stock else 0
            entry["running_balance"] = current_balance + entry["quantity"]
            
            await db.inventory_ledger.insert_one(entry)
            ledger_entries_created += 1
    
    # Log financial action
    await log_financial_action(
        "purchase_created",
        "purchase",
        purchase_id,
        {
            "purchase_number": purchase_number,
            "firm_id": purchase.firm_id,
            "firm_name": firm["name"],
            "supplier_name": purchase.supplier_name,
            "invoice_number": purchase.invoice_number,
            "total_amount": round(total_amount, 2),
            "total_gst": round(total_igst + total_cgst + total_sgst, 2),
            "items_count": len(processed_items),
            "status": entry_status,
            "doc_status": doc_status
        },
        user
    )
    
    return {
        "success": True,
        "purchase_id": purchase_id,
        "purchase_number": purchase_number,
        "total_taxable": round(total_taxable, 2),
        "total_gst": round(total_igst + total_cgst + total_sgst, 2),
        "total_amount": round(total_amount, 2),
        "ledger_entries_created": ledger_entries_created,
        "status": entry_status,
        "doc_status": doc_status,
        "compliance_score": compliance_result["compliance_score"],
        "compliance_warnings": compliance_result.get("warnings", []),
        "compliance_soft_blocks": compliance_result.get("soft_blocks", [])
    }

@api_router.get("/purchases")
async def list_purchases(
    firm_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    supplier_name: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """List purchases with filters"""
    query = {}
    
    if firm_id:
        query["firm_id"] = firm_id
    if from_date:
        query["invoice_date"] = {"$gte": from_date}
    if to_date:
        if "invoice_date" in query:
            query["invoice_date"]["$lte"] = to_date
        else:
            query["invoice_date"] = {"$lte": to_date}
    if supplier_name:
        query["supplier_name"] = {"$regex": supplier_name, "$options": "i"}
    
    purchases = await db.purchases.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.purchases.count_documents(query)
    
    # Calculate summary
    summary_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "total_taxable": {"$sum": "$total_taxable"},
            "total_igst": {"$sum": "$total_igst"},
            "total_cgst": {"$sum": "$total_cgst"},
            "total_sgst": {"$sum": "$total_sgst"},
            "total_amount": {"$sum": "$total_amount"},
            "count": {"$sum": 1}
        }}
    ]
    summary_result = await db.purchases.aggregate(summary_pipeline).to_list(1)
    summary = summary_result[0] if summary_result else {
        "total_taxable": 0, "total_igst": 0, "total_cgst": 0, 
        "total_sgst": 0, "total_amount": 0, "count": 0
    }
    if "_id" in summary:
        del summary["_id"]
    
    return {
        "purchases": purchases,
        "total": total,
        "summary": summary,
        "limit": limit,
        "skip": skip
    }

@api_router.get("/purchases/{purchase_id}")
async def get_purchase(
    purchase_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get purchase details"""
    purchase = await db.purchases.find_one({"id": purchase_id}, {"_id": 0})
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return purchase

@api_router.post("/purchases/{purchase_id}/upload-invoice")
async def upload_purchase_invoice(
    purchase_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Upload invoice file for a purchase"""
    purchase = await db.purchases.find_one({"id": purchase_id})
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    
    # Save file
    file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
    filename = f"purchase_{purchase_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.{file_extension}"
    file_path = f"/app/backend/uploads/purchase_invoices/{filename}"
    
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Update purchase with file path
    await db.purchases.update_one(
        {"id": purchase_id},
        {"$set": {"invoice_file": f"/uploads/purchase_invoices/{filename}"}}
    )
    
    return {"success": True, "file_path": f"/uploads/purchase_invoices/{filename}"}

@api_router.get("/purchases/report/summary")
async def get_purchase_summary_report(
    firm_id: Optional[str] = None,
    month: Optional[str] = None,  # YYYY-MM
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get purchase summary for GST planning"""
    query = {}
    
    if firm_id:
        query["firm_id"] = firm_id
    
    if month:
        # Filter by month
        year, mon = month.split("-")
        start_date = f"{year}-{mon}-01"
        if int(mon) == 12:
            end_date = f"{int(year)+1}-01-01"
        else:
            end_date = f"{year}-{int(mon)+1:02d}-01"
        query["invoice_date"] = {"$gte": start_date, "$lt": end_date}
    
    # Get summary by firm
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$firm_id",
            "firm_name": {"$first": "$firm_name"},
            "purchase_count": {"$sum": 1},
            "total_taxable": {"$sum": "$total_taxable"},
            "total_igst": {"$sum": "$total_igst"},
            "total_cgst": {"$sum": "$total_cgst"},
            "total_sgst": {"$sum": "$total_sgst"},
            "total_gst": {"$sum": "$total_gst"},
            "total_amount": {"$sum": "$total_amount"}
        }},
        {"$sort": {"total_amount": -1}}
    ]
    
    summaries = await db.purchases.aggregate(pipeline).to_list(100)
    
    # Format response
    result = []
    grand_total = {
        "purchase_count": 0, "total_taxable": 0, "total_igst": 0,
        "total_cgst": 0, "total_sgst": 0, "total_gst": 0, "total_amount": 0
    }
    
    for s in summaries:
        firm_summary = {
            "firm_id": s["_id"],
            "firm_name": s["firm_name"],
            "purchase_count": s["purchase_count"],
            "total_taxable": round(s["total_taxable"], 2),
            "total_igst": round(s["total_igst"], 2),
            "total_cgst": round(s["total_cgst"], 2),
            "total_sgst": round(s["total_sgst"], 2),
            "total_gst": round(s["total_gst"], 2),
            "total_amount": round(s["total_amount"], 2),
            # ITC available from this purchase
            "itc_igst": round(s["total_igst"], 2),
            "itc_cgst": round(s["total_cgst"], 2),
            "itc_sgst": round(s["total_sgst"], 2)
        }
        result.append(firm_summary)
        
        for key in grand_total:
            grand_total[key] += s.get(key, 0)
    
    return {
        "month": month,
        "firms": result,
        "grand_total": {k: round(v, 2) for k, v in grand_total.items()},
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/purchases/export/csv")
async def export_purchases_csv(
    firm_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Export purchases to CSV"""
    import csv
    import io
    from fastapi.responses import StreamingResponse
    
    query = {}
    if firm_id:
        query["firm_id"] = firm_id
    if from_date:
        query["invoice_date"] = {"$gte": from_date}
    if to_date:
        if "invoice_date" in query:
            query["invoice_date"]["$lte"] = to_date
        else:
            query["invoice_date"] = {"$lte": to_date}
    
    purchases = await db.purchases.find(query, {"_id": 0}).sort("invoice_date", -1).to_list(10000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Purchase #", "Invoice Date", "Invoice #", "Firm", "Supplier", "Supplier GSTIN",
        "Supplier State", "Inter-State", "Taxable Value", "IGST", "CGST", "SGST", "Total GST", "Total Amount"
    ])
    
    for p in purchases:
        writer.writerow([
            p.get("purchase_number"),
            p.get("invoice_date"),
            p.get("invoice_number"),
            p.get("firm_name"),
            p.get("supplier_name"),
            p.get("supplier_gstin", ""),
            p.get("supplier_state"),
            "Yes" if p.get("is_inter_state") else "No",
            p.get("total_taxable"),
            p.get("total_igst"),
            p.get("total_cgst"),
            p.get("total_sgst"),
            p.get("total_gst"),
            p.get("total_amount")
        ])
    
    # Item details section
    writer.writerow([])
    writer.writerow(["ITEM DETAILS"])
    writer.writerow([
        "Purchase #", "Invoice #", "Item Type", "SKU Code", "Item Name", "HSN",
        "Qty", "Rate", "GST %", "Taxable", "IGST", "CGST", "SGST", "Total"
    ])
    
    for p in purchases:
        for item in p.get("items", []):
            writer.writerow([
                p.get("purchase_number"),
                p.get("invoice_number"),
                item.get("item_type"),
                item.get("sku_code"),
                item.get("item_name"),
                item.get("hsn_code"),
                item.get("quantity"),
                item.get("rate"),
                item.get("gst_rate"),
                item.get("taxable_value"),
                item.get("igst"),
                item.get("cgst"),
                item.get("sgst"),
                item.get("total")
            ])
    
    output.seek(0)
    filename = f"purchase_register_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Update finance dashboard to include purchase ITC
@api_router.get("/finance/itc-from-purchases")
async def get_itc_from_purchases(
    firm_id: Optional[str] = None,
    month: Optional[str] = None,  # YYYY-MM
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get ITC available from purchases"""
    query = {}
    
    if firm_id:
        query["firm_id"] = firm_id
    
    if month:
        year, mon = month.split("-")
        start_date = f"{year}-{mon}-01"
        if int(mon) == 12:
            end_date = f"{int(year)+1}-01-01"
        else:
            end_date = f"{year}-{int(mon)+1:02d}-01"
        query["invoice_date"] = {"$gte": start_date, "$lt": end_date}
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$firm_id",
            "firm_name": {"$first": "$firm_name"},
            "igst": {"$sum": "$total_igst"},
            "cgst": {"$sum": "$total_cgst"},
            "sgst": {"$sum": "$total_sgst"}
        }}
    ]
    
    results = await db.purchases.aggregate(pipeline).to_list(100)
    
    itc_by_firm = {}
    for r in results:
        itc_by_firm[r["_id"]] = {
            "firm_name": r["firm_name"],
            "igst": round(r["igst"], 2),
            "cgst": round(r["cgst"], 2),
            "sgst": round(r["sgst"], 2),
            "total": round(r["igst"] + r["cgst"] + r["sgst"], 2)
        }
    
    return {
        "month": month,
        "itc_by_firm": itc_by_firm
    }


# ==================== PARTY MASTER MODULE ====================

PARTY_TYPES = ["customer", "supplier", "contractor"]

class PartyCreate(BaseModel):
    name: str
    party_types: List[str]  # Can have multiple: ["customer", "supplier"]
    gstin: Optional[str] = None
    pan: Optional[str] = None
    state: str  # Required for GST calculation
    state_code: Optional[str] = None  # 2-digit state code for GSTIN
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_person: Optional[str] = None
    credit_limit: Optional[float] = 0
    opening_balance: Optional[float] = 0  # Positive = receivable, Negative = payable
    notes: Optional[str] = None

class PartyUpdate(BaseModel):
    name: Optional[str] = None
    party_types: Optional[List[str]] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_person: Optional[str] = None
    credit_limit: Optional[float] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class PartyResponse(BaseModel):
    id: str
    name: str
    party_types: List[str]
    gstin: Optional[str] = None
    pan: Optional[str] = None
    state: str
    state_code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_person: Optional[str] = None
    credit_limit: float
    opening_balance: float
    current_balance: Optional[float] = None  # Computed from ledger
    total_receivable: Optional[float] = None
    total_payable: Optional[float] = None
    last_transaction_date: Optional[str] = None
    notes: Optional[str] = None
    source: Optional[str] = None  # "manual" or "migrated_from_tickets"
    is_active: bool
    created_at: str
    updated_at: str


# State codes for GST
STATE_CODES = {
    "Andhra Pradesh": "37", "Arunachal Pradesh": "12", "Assam": "18", "Bihar": "10",
    "Chhattisgarh": "22", "Delhi": "07", "Goa": "30", "Gujarat": "24", "Haryana": "06",
    "Himachal Pradesh": "02", "Jharkhand": "20", "Karnataka": "29", "Kerala": "32",
    "Madhya Pradesh": "23", "Maharashtra": "27", "Manipur": "14", "Meghalaya": "17",
    "Mizoram": "15", "Nagaland": "13", "Odisha": "21", "Punjab": "03", "Rajasthan": "08",
    "Sikkim": "11", "Tamil Nadu": "33", "Telangana": "36", "Tripura": "16",
    "Uttar Pradesh": "09", "Uttarakhand": "05", "West Bengal": "19",
    "Andaman and Nicobar Islands": "35", "Chandigarh": "04", "Dadra and Nagar Haveli": "26",
    "Daman and Diu": "25", "Jammu and Kashmir": "01", "Ladakh": "38", "Lakshadweep": "31",
    "Puducherry": "34"
}


def get_state_code(state_name: str) -> str:
    """Get 2-digit state code from state name"""
    return STATE_CODES.get(state_name, "")


def get_financial_year() -> str:
    """Get current financial year in format 2526 (for 2025-26)"""
    now = datetime.now()
    if now.month >= 4:  # April onwards
        return f"{str(now.year)[2:]}{str(now.year + 1)[2:]}"
    else:  # Jan-March belongs to previous FY
        return f"{str(now.year - 1)[2:]}{str(now.year)[2:]}"


async def get_next_invoice_number(firm_id: str) -> str:
    """Generate next invoice number: INV/{FIRM_CODE}/{FY}/{RUNNING_NUMBER}"""
    firm = await db.firms.find_one({"id": firm_id})
    if not firm:
        raise HTTPException(status_code=400, detail="Invalid firm")
    
    # Generate firm code from name (first 3 chars of each word, max 3 words)
    name_parts = firm["name"].split()[:3]
    firm_code = "".join([p[0].upper() for p in name_parts if p])
    if len(firm_code) < 2:
        firm_code = firm["name"][:3].upper()
    
    fy = get_financial_year()
    prefix = f"INV/{firm_code}/{fy}/"
    
    # Get last invoice number for this firm and FY
    last_invoice = await db.sales_invoices.find_one(
        {"firm_id": firm_id, "invoice_number": {"$regex": f"^{prefix}"}},
        sort=[("created_at", -1)]
    )
    
    if last_invoice:
        try:
            last_num = int(last_invoice["invoice_number"].split("/")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    
    return f"{prefix}{str(next_num).zfill(5)}"


@api_router.get("/parties")
async def list_parties(
    party_type: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = True,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """List all parties with optional filters"""
    query = {}
    
    if is_active is not None:
        query["is_active"] = is_active
    
    if party_type:
        query["party_types"] = party_type
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"gstin": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    parties = await db.parties.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    
    # Compute balances for each party
    for party in parties:
        # Get latest ledger entry for balance
        last_entry = await db.party_ledger.find_one(
            {"party_id": party["id"]},
            sort=[("created_at", -1)]
        )
        party["current_balance"] = last_entry.get("running_balance", party.get("opening_balance", 0)) if last_entry else party.get("opening_balance", 0)
        
        # Calculate receivable/payable
        if party["current_balance"] > 0:
            party["total_receivable"] = party["current_balance"]
            party["total_payable"] = 0
        else:
            party["total_receivable"] = 0
            party["total_payable"] = abs(party["current_balance"])
        
        party["last_transaction_date"] = last_entry.get("created_at") if last_entry else None
    
    return parties


@api_router.get("/parties/{party_id}")
async def get_party(
    party_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get single party with full details"""
    party = await db.parties.find_one({"id": party_id}, {"_id": 0})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    
    # Get balance info
    last_entry = await db.party_ledger.find_one(
        {"party_id": party_id},
        sort=[("created_at", -1)]
    )
    party["current_balance"] = last_entry.get("running_balance", party.get("opening_balance", 0)) if last_entry else party.get("opening_balance", 0)
    
    if party["current_balance"] > 0:
        party["total_receivable"] = party["current_balance"]
        party["total_payable"] = 0
    else:
        party["total_receivable"] = 0
        party["total_payable"] = abs(party["current_balance"])
    
    party["last_transaction_date"] = last_entry.get("created_at") if last_entry else None
    
    return party


@api_router.post("/parties", response_model=PartyResponse)
async def create_party(
    party_data: PartyCreate,
    user: dict = Depends(require_roles(["admin"]))
):
    """Create a new party (Admin only)"""
    now = datetime.now(timezone.utc)
    
    # Validate party types
    for pt in party_data.party_types:
        if pt not in PARTY_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid party type: {pt}")
    
    # Check for duplicate GSTIN (if provided)
    if party_data.gstin:
        existing = await db.parties.find_one({"gstin": party_data.gstin.upper()})
        if existing:
            raise HTTPException(status_code=400, detail=f"Party with GSTIN {party_data.gstin} already exists: {existing['name']}")
    
    # Check for duplicate phone
    if party_data.phone:
        existing = await db.parties.find_one({"phone": party_data.phone})
        if existing:
            raise HTTPException(status_code=400, detail=f"Party with phone {party_data.phone} already exists: {existing['name']}")
    
    # Get state code
    state_code = party_data.state_code or get_state_code(party_data.state)
    
    party = {
        "id": str(uuid.uuid4()),
        "name": party_data.name,
        "party_types": party_data.party_types,
        "gstin": party_data.gstin.upper() if party_data.gstin else None,
        "pan": party_data.pan.upper() if party_data.pan else None,
        "state": party_data.state,
        "state_code": state_code,
        "address": party_data.address,
        "city": party_data.city,
        "pincode": party_data.pincode,
        "phone": party_data.phone,
        "email": party_data.email.lower() if party_data.email else None,
        "contact_person": party_data.contact_person,
        "credit_limit": party_data.credit_limit or 0,
        "opening_balance": party_data.opening_balance or 0,
        "notes": party_data.notes,
        "source": "manual",
        "is_active": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.parties.insert_one(party)
    
    # Create opening balance ledger entry if non-zero
    if party_data.opening_balance and party_data.opening_balance != 0:
        ledger_entry = {
            "id": str(uuid.uuid4()),
            "entry_number": f"OB-{party['id'][:8]}",
            "party_id": party["id"],
            "party_name": party["name"],
            "entry_type": "opening_balance",
            "debit": party_data.opening_balance if party_data.opening_balance > 0 else 0,
            "credit": abs(party_data.opening_balance) if party_data.opening_balance < 0 else 0,
            "running_balance": party_data.opening_balance,
            "narration": "Opening Balance",
            "reference_type": None,
            "reference_id": None,
            "created_by": user["id"],
            "created_by_name": f"{user['first_name']} {user['last_name']}",
            "created_at": now.isoformat()
        }
        await db.party_ledger.insert_one(ledger_entry)
    
    # Log activity
    await log_activity(
        action="party_created",
        entity_type="party",
        entity_id=party["id"],
        user=user,
        details={"name": party["name"], "party_types": party["party_types"]}
    )
    
    party["current_balance"] = party_data.opening_balance or 0
    party["total_receivable"] = party["current_balance"] if party["current_balance"] > 0 else 0
    party["total_payable"] = abs(party["current_balance"]) if party["current_balance"] < 0 else 0
    party["last_transaction_date"] = None
    
    return party


@api_router.patch("/parties/{party_id}", response_model=PartyResponse)
async def update_party(
    party_id: str,
    party_data: PartyUpdate,
    user: dict = Depends(require_roles(["admin"]))
):
    """Update a party (Admin only)"""
    now = datetime.now(timezone.utc)
    
    party = await db.parties.find_one({"id": party_id})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    
    update_data = {"updated_at": now.isoformat()}
    
    if party_data.party_types is not None:
        for pt in party_data.party_types:
            if pt not in PARTY_TYPES:
                raise HTTPException(status_code=400, detail=f"Invalid party type: {pt}")
        update_data["party_types"] = party_data.party_types
    
    if party_data.gstin is not None:
        if party_data.gstin:
            existing = await db.parties.find_one({"gstin": party_data.gstin.upper(), "id": {"$ne": party_id}})
            if existing:
                raise HTTPException(status_code=400, detail=f"GSTIN already exists for: {existing['name']}")
        update_data["gstin"] = party_data.gstin.upper() if party_data.gstin else None
    
    for field in ["name", "pan", "state", "state_code", "address", "city", "pincode", 
                  "phone", "email", "contact_person", "credit_limit", "notes", "is_active"]:
        value = getattr(party_data, field, None)
        if value is not None:
            if field == "email" and value:
                value = value.lower()
            if field == "pan" and value:
                value = value.upper()
            update_data[field] = value
    
    # Update state code if state changed
    if party_data.state and not party_data.state_code:
        update_data["state_code"] = get_state_code(party_data.state)
    
    await db.parties.update_one({"id": party_id}, {"$set": update_data})
    
    updated = await db.parties.find_one({"id": party_id}, {"_id": 0})
    
    # Get balance
    last_entry = await db.party_ledger.find_one({"party_id": party_id}, sort=[("created_at", -1)])
    updated["current_balance"] = last_entry.get("running_balance", updated.get("opening_balance", 0)) if last_entry else updated.get("opening_balance", 0)
    updated["total_receivable"] = updated["current_balance"] if updated["current_balance"] > 0 else 0
    updated["total_payable"] = abs(updated["current_balance"]) if updated["current_balance"] < 0 else 0
    updated["last_transaction_date"] = last_entry.get("created_at") if last_entry else None
    
    return updated


@api_router.post("/parties/migrate-customers")
async def migrate_customers_to_parties(
    user: dict = Depends(require_roles(["admin"]))
):
    """
    Migrate existing customers from tickets to party master.
    Deduplicates by phone (primary) and GSTIN.
    """
    now = datetime.now(timezone.utc)
    
    # Get all unique customers from tickets
    pipeline = [
        {"$match": {"customer_phone": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$customer_phone",
            "name": {"$first": "$customer_name"},
            "email": {"$first": "$customer_email"},
            "phone": {"$first": "$customer_phone"},
            "address": {"$first": "$customer_address"},
            "city": {"$first": "$customer_city"},
            "state": {"$first": "$customer_state"},
            "pincode": {"$first": "$customer_pincode"},
            "ticket_count": {"$sum": 1},
            "first_ticket_date": {"$min": "$created_at"}
        }}
    ]
    
    ticket_customers = await db.tickets.aggregate(pipeline).to_list(10000)
    
    # Also get from dispatches
    dispatch_pipeline = [
        {"$match": {"phone": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$phone",
            "name": {"$first": "$customer_name"},
            "email": {"$first": {"$ifNull": ["$email", None]}},
            "phone": {"$first": "$phone"},
            "address": {"$first": "$address"},
            "city": {"$first": "$city"},
            "state": {"$first": "$state"},
            "pincode": {"$first": "$pincode"},
            "dispatch_count": {"$sum": 1}
        }}
    ]
    
    dispatch_customers = await db.dispatches.aggregate(dispatch_pipeline).to_list(10000)
    
    # Merge by phone
    customers_by_phone = {}
    
    for c in ticket_customers:
        phone = c["phone"]
        if phone not in customers_by_phone:
            customers_by_phone[phone] = {
                "name": c["name"],
                "phone": phone,
                "email": c.get("email"),
                "address": c.get("address"),
                "city": c.get("city"),
                "state": c.get("state") or "Delhi",  # Default
                "pincode": c.get("pincode"),
                "ticket_count": c.get("ticket_count", 0),
                "dispatch_count": 0
            }
        else:
            customers_by_phone[phone]["ticket_count"] = c.get("ticket_count", 0)
    
    for c in dispatch_customers:
        phone = c["phone"]
        if phone not in customers_by_phone:
            customers_by_phone[phone] = {
                "name": c["name"],
                "phone": phone,
                "email": c.get("email"),
                "address": c.get("address"),
                "city": c.get("city"),
                "state": c.get("state") or "Delhi",
                "pincode": c.get("pincode"),
                "ticket_count": 0,
                "dispatch_count": c.get("dispatch_count", 0)
            }
        else:
            customers_by_phone[phone]["dispatch_count"] = c.get("dispatch_count", 0)
            # Update fields if missing
            if not customers_by_phone[phone].get("name"):
                customers_by_phone[phone]["name"] = c["name"]
            if not customers_by_phone[phone].get("address"):
                customers_by_phone[phone]["address"] = c.get("address")
    
    migrated = 0
    skipped = 0
    merged = 0
    
    for phone, cust in customers_by_phone.items():
        # Check if already exists
        existing = await db.parties.find_one({"phone": phone})
        if existing:
            skipped += 1
            continue
        
        # Create party
        state = cust.get("state") or "Delhi"
        party = {
            "id": str(uuid.uuid4()),
            "name": cust["name"] or f"Customer {phone}",
            "party_types": ["customer"],
            "gstin": None,
            "pan": None,
            "state": state,
            "state_code": get_state_code(state),
            "address": cust.get("address"),
            "city": cust.get("city"),
            "pincode": cust.get("pincode"),
            "phone": phone,
            "email": cust.get("email"),
            "contact_person": None,
            "credit_limit": 0,
            "opening_balance": 0,
            "notes": f"Tickets: {cust.get('ticket_count', 0)}, Dispatches: {cust.get('dispatch_count', 0)}",
            "source": "migrated_from_tickets",
            "is_active": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.parties.insert_one(party)
        migrated += 1
    
    await log_activity(
        action="customers_migrated",
        entity_type="party",
        entity_id="migration",
        user=user,
        details={"migrated": migrated, "skipped": skipped, "merged": merged}
    )
    
    return {
        "success": True,
        "migrated": migrated,
        "skipped": skipped,
        "merged": merged,
        "message": f"Migration complete. Created {migrated} parties, skipped {skipped} duplicates."
    }


# ==================== SALES REGISTER MODULE ====================

PAYMENT_STATUSES = ["unpaid", "partial", "paid"]

class SalesInvoiceItem(BaseModel):
    master_sku_id: str
    sku_code: str
    name: str
    hsn_code: Optional[str] = None
    quantity: int
    rate: float  # Unit rate
    gst_rate: float = 18  # 0, 5, 12, 18, 28
    discount: float = 0
    taxable_value: Optional[float] = None  # Computed
    gst_amount: Optional[float] = None  # Computed

class SalesInvoiceCreate(BaseModel):
    firm_id: str
    party_id: str
    dispatch_id: str  # Must link to dispatch
    invoice_date: str
    items: List[SalesInvoiceItem]
    shipping_charges: float = 0
    other_charges: float = 0
    discount: float = 0
    notes: Optional[str] = None
    gst_override: Optional[bool] = False  # Manual GST override
    override_igst: Optional[float] = None
    override_cgst: Optional[float] = None
    override_sgst: Optional[float] = None
    save_as_draft: Optional[bool] = False  # If True, saves as draft even with validation errors

class SalesInvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    firm_id: str
    firm_name: str
    party_id: str
    party_name: str
    party_gstin: Optional[str] = None
    dispatch_id: str
    dispatch_number: str
    invoice_date: str
    items: List[dict]
    subtotal: float
    shipping_charges: float
    other_charges: float
    discount: float
    taxable_value: float
    is_igst: bool  # True = IGST, False = CGST+SGST
    igst: float
    cgst: float
    sgst: float
    total_gst: float
    grand_total: float
    payment_status: str
    amount_paid: float
    balance_due: float
    gst_override: bool
    notes: Optional[str] = None
    created_by: str
    created_by_name: str
    created_at: str
    updated_at: str


@api_router.get("/sales-invoices")
async def list_sales_invoices(
    firm_id: Optional[str] = None,
    party_id: Optional[str] = None,
    payment_status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """List all sales invoices with filters"""
    query = {}
    
    if firm_id:
        query["firm_id"] = firm_id
    if party_id:
        query["party_id"] = party_id
    if payment_status:
        query["payment_status"] = payment_status
    if from_date:
        query["invoice_date"] = {"$gte": from_date}
    if to_date:
        query.setdefault("invoice_date", {})["$lte"] = to_date
    if search:
        query["$or"] = [
            {"invoice_number": {"$regex": search, "$options": "i"}},
            {"party_name": {"$regex": search, "$options": "i"}},
            {"dispatch_number": {"$regex": search, "$options": "i"}}
        ]
    
    invoices = await db.sales_invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return invoices


@api_router.get("/sales-invoices/{invoice_id}")
async def get_sales_invoice(
    invoice_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get single sales invoice"""
    invoice = await db.sales_invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@api_router.post("/sales-invoices", response_model=SalesInvoiceResponse)
async def create_sales_invoice(
    invoice_data: SalesInvoiceCreate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Create a sales invoice linked to dispatch"""
    now = datetime.now(timezone.utc)
    
    # Validate firm
    firm = await db.firms.find_one({"id": invoice_data.firm_id, "is_active": True})
    if not firm:
        raise HTTPException(status_code=400, detail="Invalid or inactive firm")
    
    # Validate party
    party = await db.parties.find_one({"id": invoice_data.party_id, "is_active": True})
    if not party:
        raise HTTPException(status_code=400, detail="Invalid or inactive party")
    
    if "customer" not in party.get("party_types", []):
        raise HTTPException(status_code=400, detail="Party must be a customer for sales invoice")
    
    # Validate dispatch
    dispatch = await db.dispatches.find_one({"id": invoice_data.dispatch_id})
    if not dispatch:
        raise HTTPException(status_code=400, detail="Dispatch not found")
    
    # Check if invoice already exists for this dispatch
    existing_invoice = await db.sales_invoices.find_one({"dispatch_id": invoice_data.dispatch_id})
    if existing_invoice:
        raise HTTPException(status_code=400, detail=f"Invoice {existing_invoice['invoice_number']} already exists for this dispatch")
    
    # Determine IGST vs CGST/SGST
    firm_state_code = firm.get("gstin", "")[:2] if firm.get("gstin") else get_state_code(firm.get("state", ""))
    party_state_code = party.get("state_code") or get_state_code(party.get("state", ""))
    is_igst = firm_state_code != party_state_code
    
    # Calculate item totals
    items = []
    subtotal = 0
    total_igst = 0
    total_cgst = 0
    total_sgst = 0
    
    for item in invoice_data.items:
        taxable = (item.quantity * item.rate) - item.discount
        gst_amount = taxable * (item.gst_rate / 100)
        
        item_dict = {
            "master_sku_id": item.master_sku_id,
            "sku_code": item.sku_code,
            "name": item.name,
            "hsn_code": item.hsn_code,
            "quantity": item.quantity,
            "rate": item.rate,
            "gst_rate": item.gst_rate,
            "discount": item.discount,
            "taxable_value": taxable,
            "gst_amount": gst_amount
        }
        items.append(item_dict)
        subtotal += taxable
        
        if is_igst:
            total_igst += gst_amount
        else:
            total_cgst += gst_amount / 2
            total_sgst += gst_amount / 2
    
    # Add other charges
    taxable_value = subtotal + invoice_data.shipping_charges + invoice_data.other_charges - invoice_data.discount
    total_gst = total_igst + total_cgst + total_sgst
    
    # Handle GST override
    if invoice_data.gst_override:
        total_igst = invoice_data.override_igst or 0
        total_cgst = invoice_data.override_cgst or 0
        total_sgst = invoice_data.override_sgst or 0
        total_gst = total_igst + total_cgst + total_sgst
        is_igst = total_igst > 0
    
    grand_total = round(taxable_value + total_gst, 2)
    
    # Generate invoice number
    invoice_number = await get_next_invoice_number(invoice_data.firm_id)
    
    # ====== COMPLIANCE VALIDATION ======
    compliance_data = {
        "dispatch_id": invoice_data.dispatch_id,
        "invoice_number": invoice_number,
        "invoice_date": invoice_data.invoice_date,
        "party_id": invoice_data.party_id,
        "taxable_value": round(taxable_value, 2),
        "total_gst": round(total_gst, 2)
    }
    
    compliance_result = validate_document_compliance(
        "sales_invoice",
        compliance_data,
        {},
        grand_total
    )
    
    # Determine status and doc_status
    if not compliance_result["can_proceed"] and not invoice_data.save_as_draft:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Compliance validation failed - cannot post final entry",
                "hard_blocks": compliance_result["hard_blocks"],
                "missing_critical": compliance_result["missing_critical"],
                "suggestion": "Fix issues or save as draft"
            }
        )
    
    # Set status based on draft flag and compliance
    if invoice_data.save_as_draft:
        entry_status = "draft"
        doc_status = "pending" if compliance_result["soft_blocks"] or compliance_result["hard_blocks"] else "complete"
    else:
        entry_status = "final"
        doc_status = compliance_result["status"]
    
    invoice_id = str(uuid.uuid4())
    
    invoice = {
        "id": invoice_id,
        "invoice_number": invoice_number,
        "firm_id": invoice_data.firm_id,
        "firm_name": firm["name"],
        "party_id": invoice_data.party_id,
        "party_name": party["name"],
        "party_gstin": party.get("gstin"),
        "dispatch_id": invoice_data.dispatch_id,
        "dispatch_number": dispatch.get("dispatch_number"),
        "invoice_date": invoice_data.invoice_date,
        "items": items,
        "subtotal": round(subtotal, 2),
        "shipping_charges": invoice_data.shipping_charges,
        "other_charges": invoice_data.other_charges,
        "discount": invoice_data.discount,
        "taxable_value": round(taxable_value, 2),
        "is_igst": is_igst,
        "igst": round(total_igst, 2),
        "cgst": round(total_cgst, 2),
        "sgst": round(total_sgst, 2),
        "total_gst": round(total_gst, 2),
        "grand_total": grand_total,
        "payment_status": "unpaid",
        "amount_paid": 0,
        "balance_due": grand_total,
        "gst_override": invoice_data.gst_override or False,
        "notes": invoice_data.notes,
        "status": entry_status,
        "doc_status": doc_status,
        "compliance_score": compliance_result["compliance_score"],
        "compliance_issues": compliance_result.get("soft_blocks", []) + compliance_result.get("warnings", []),
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.sales_invoices.insert_one(invoice)
    
    # Create compliance exception if there are issues (for non-draft entries)
    if entry_status == "final" and doc_status == "pending" and (compliance_result["soft_blocks"] or compliance_result["missing_important"]):
        severity = "critical" if compliance_result["missing_critical"] else "important"
        await create_compliance_exception(
            transaction_type="sales_invoice",
            transaction_id=invoice_id,
            transaction_ref=invoice_number,
            firm_id=invoice_data.firm_id,
            issues=compliance_result["soft_blocks"] + [f"Missing: {m['label']}" for m in compliance_result.get("missing_important", [])],
            severity=severity,
            user=user
        )
    
    # Create party ledger entry - ONLY for final entries
    if entry_status == "final":
        last_ledger = await db.party_ledger.find_one(
            {"party_id": invoice_data.party_id},
            sort=[("created_at", -1)]
        )
        running_balance = (last_ledger.get("running_balance", 0) if last_ledger else party.get("opening_balance", 0)) + grand_total
        
        ledger_entry = {
            "id": str(uuid.uuid4()),
            "entry_number": f"SI-{invoice_number}",
            "party_id": invoice_data.party_id,
            "party_name": party["name"],
            "entry_type": "sales_invoice",
            "debit": grand_total,  # Customer owes this
            "credit": 0,
            "running_balance": running_balance,
            "narration": f"Sales Invoice {invoice_number}",
            "reference_type": "sales_invoice",
            "reference_id": invoice["id"],
            "firm_id": invoice_data.firm_id,
            "created_by": user["id"],
            "created_by_name": f"{user['first_name']} {user['last_name']}",
            "created_at": now.isoformat()
        }
        await db.party_ledger.insert_one(ledger_entry)
        
        # Update dispatch with invoice reference
        await db.dispatches.update_one(
            {"id": invoice_data.dispatch_id},
            {"$set": {"sales_invoice_id": invoice["id"], "sales_invoice_number": invoice_number}}
        )
    
    # Log activity
    await log_activity(
        action="sales_invoice_created",
        entity_type="sales_invoice",
        entity_id=invoice["id"],
        user=user,
        details={
            "invoice_number": invoice_number,
            "party_name": party["name"],
            "grand_total": grand_total,
            "status": entry_status,
            "doc_status": doc_status
        }
    )
    
    return invoice


@api_router.get("/sales-invoices/by-dispatch/{dispatch_id}")
async def get_invoice_by_dispatch(
    dispatch_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get sales invoice for a dispatch if exists"""
    invoice = await db.sales_invoices.find_one({"dispatch_id": dispatch_id}, {"_id": 0})
    return invoice


@api_router.get("/dispatches-without-invoice")
async def get_dispatches_without_invoice(
    firm_id: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get dispatches that don't have a sales invoice yet"""
    query = {
        "status": "dispatched",
        "$or": [
            {"sales_invoice_id": {"$exists": False}},
            {"sales_invoice_id": None}
        ]
    }
    if firm_id:
        query["firm_id"] = firm_id
    
    dispatches = await db.dispatches.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return dispatches


# ==================== PARTY LEDGER ENDPOINTS ====================

@api_router.get("/party-ledger/{party_id}")
async def get_party_ledger(
    party_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 200,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get ledger entries for a party"""
    party = await db.parties.find_one({"id": party_id}, {"_id": 0})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    
    query = {"party_id": party_id}
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        query.setdefault("created_at", {})["$lte"] = to_date
    
    entries = await db.party_ledger.find(query, {"_id": 0}).sort("created_at", 1).to_list(limit)
    
    # Get current balance
    last_entry = entries[-1] if entries else None
    current_balance = last_entry.get("running_balance", party.get("opening_balance", 0)) if last_entry else party.get("opening_balance", 0)
    
    return {
        "party": party,
        "entries": entries,
        "current_balance": current_balance,
        "total_debit": sum(e.get("debit", 0) for e in entries),
        "total_credit": sum(e.get("credit", 0) for e in entries)
    }


# ==================== PAYMENT TRACKING MODULE (PHASE 2) ====================

PAYMENT_MODES = ["cash", "bank_transfer", "upi", "cheque", "card", "other"]
PAYMENT_TYPES = ["received", "made"]  # received = from customer, made = to supplier/contractor

class PaymentCreate(BaseModel):
    party_id: str
    payment_type: str  # "received" or "made"
    amount: float
    payment_date: str
    payment_mode: str  # cash, bank_transfer, upi, cheque, card, other
    reference_number: Optional[str] = None  # Cheque no, UTR, etc.
    invoice_id: Optional[str] = None  # Optional link to specific invoice
    firm_id: Optional[str] = None
    bank_name: Optional[str] = None
    notes: Optional[str] = None

class PaymentResponse(BaseModel):
    id: str
    payment_number: str
    party_id: str
    party_name: str
    payment_type: str
    amount: float
    payment_date: str
    payment_mode: str
    reference_number: Optional[str] = None
    invoice_id: Optional[str] = None
    invoice_number: Optional[str] = None
    firm_id: Optional[str] = None
    firm_name: Optional[str] = None
    bank_name: Optional[str] = None
    notes: Optional[str] = None
    created_by: str
    created_by_name: str
    created_at: str


async def get_next_payment_number(payment_type: str) -> str:
    """Generate payment number: REC/2526/00001 or PAY/2526/00001"""
    prefix = "REC" if payment_type == "received" else "PAY"
    fy = get_financial_year()
    full_prefix = f"{prefix}/{fy}/"
    
    last_payment = await db.payments.find_one(
        {"payment_number": {"$regex": f"^{full_prefix}"}},
        sort=[("created_at", -1)]
    )
    
    if last_payment:
        try:
            last_num = int(last_payment["payment_number"].split("/")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    
    return f"{full_prefix}{str(next_num).zfill(5)}"


@api_router.get("/payments")
async def list_payments(
    party_id: Optional[str] = None,
    payment_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """List all payments with filters"""
    query = {}
    
    if party_id:
        query["party_id"] = party_id
    if payment_type:
        query["payment_type"] = payment_type
    if from_date:
        query["payment_date"] = {"$gte": from_date}
    if to_date:
        query.setdefault("payment_date", {})["$lte"] = to_date
    
    payments = await db.payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return payments


@api_router.get("/payments/{payment_id}")
async def get_payment(
    payment_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get single payment"""
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@api_router.post("/payments", response_model=PaymentResponse)
async def create_payment(
    payment_data: PaymentCreate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Record a payment received or made"""
    now = datetime.now(timezone.utc)
    
    if payment_data.payment_type not in PAYMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid payment type. Must be: {PAYMENT_TYPES}")
    
    if payment_data.payment_mode not in PAYMENT_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid payment mode. Must be: {PAYMENT_MODES}")
    
    if payment_data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    
    # Validate party
    party = await db.parties.find_one({"id": payment_data.party_id, "is_active": True})
    if not party:
        raise HTTPException(status_code=400, detail="Invalid or inactive party")
    
    # Validate invoice if provided
    invoice = None
    if payment_data.invoice_id:
        invoice = await db.sales_invoices.find_one({"id": payment_data.invoice_id})
        if not invoice:
            # Check purchase invoices too
            invoice = await db.purchase_entries.find_one({"id": payment_data.invoice_id})
        if not invoice:
            raise HTTPException(status_code=400, detail="Invoice not found")
    
    # Get firm if provided
    firm = None
    if payment_data.firm_id:
        firm = await db.firms.find_one({"id": payment_data.firm_id})
    
    payment_number = await get_next_payment_number(payment_data.payment_type)
    
    payment = {
        "id": str(uuid.uuid4()),
        "payment_number": payment_number,
        "party_id": payment_data.party_id,
        "party_name": party["name"],
        "payment_type": payment_data.payment_type,
        "amount": payment_data.amount,
        "payment_date": payment_data.payment_date,
        "payment_mode": payment_data.payment_mode,
        "reference_number": payment_data.reference_number,
        "invoice_id": payment_data.invoice_id,
        "invoice_number": invoice.get("invoice_number") if invoice else None,
        "firm_id": payment_data.firm_id,
        "firm_name": firm["name"] if firm else None,
        "bank_name": payment_data.bank_name,
        "notes": payment_data.notes,
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "created_at": now.isoformat()
    }
    
    await db.payments.insert_one(payment)
    
    # Create party ledger entry
    last_ledger = await db.party_ledger.find_one(
        {"party_id": payment_data.party_id},
        sort=[("created_at", -1)]
    )
    current_balance = last_ledger.get("running_balance", 0) if last_ledger else party.get("opening_balance", 0)
    
    # For "received" payment: credit the party (reduces receivable)
    # For "made" payment: debit the party (reduces payable)
    if payment_data.payment_type == "received":
        debit = 0
        credit = payment_data.amount
        running_balance = current_balance - payment_data.amount
        narration = f"Payment received - {payment_data.payment_mode.upper()}"
    else:
        debit = payment_data.amount
        credit = 0
        running_balance = current_balance + payment_data.amount
        narration = f"Payment made - {payment_data.payment_mode.upper()}"
    
    if payment_data.reference_number:
        narration += f" (Ref: {payment_data.reference_number})"
    
    ledger_entry = {
        "id": str(uuid.uuid4()),
        "entry_number": f"PMT-{payment_number}",
        "party_id": payment_data.party_id,
        "party_name": party["name"],
        "entry_type": "payment_received" if payment_data.payment_type == "received" else "payment_made",
        "debit": debit,
        "credit": credit,
        "running_balance": running_balance,
        "narration": narration,
        "reference_type": "payment",
        "reference_id": payment["id"],
        "firm_id": payment_data.firm_id,
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "created_at": now.isoformat()
    }
    await db.party_ledger.insert_one(ledger_entry)
    
    # Update invoice payment status if linked
    if payment_data.invoice_id and invoice:
        new_amount_paid = invoice.get("amount_paid", 0) + payment_data.amount
        new_balance = invoice.get("grand_total", 0) - new_amount_paid
        
        if new_balance <= 0:
            new_status = "paid"
            new_balance = 0
        elif new_amount_paid > 0:
            new_status = "partial"
        else:
            new_status = "unpaid"
        
        # Update sales invoice
        await db.sales_invoices.update_one(
            {"id": payment_data.invoice_id},
            {"$set": {
                "amount_paid": new_amount_paid,
                "balance_due": max(0, new_balance),
                "payment_status": new_status,
                "updated_at": now.isoformat()
            }}
        )
    
    await log_activity(
        action="payment_created",
        entity_type="payment",
        entity_id=payment["id"],
        user=user,
        details={
            "payment_number": payment_number,
            "party_name": party["name"],
            "amount": payment_data.amount,
            "type": payment_data.payment_type
        }
    )
    
    return payment


@api_router.get("/party-outstanding/{party_id}")
async def get_party_outstanding(
    party_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get outstanding invoices for a party"""
    party = await db.parties.find_one({"id": party_id}, {"_id": 0})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    
    # Get unpaid/partial sales invoices (for customers)
    sales_outstanding = []
    if "customer" in party.get("party_types", []):
        sales_outstanding = await db.sales_invoices.find(
            {"party_id": party_id, "payment_status": {"$in": ["unpaid", "partial"]}},
            {"_id": 0}
        ).sort("invoice_date", 1).to_list(100)
    
    # Get unpaid purchase entries (for suppliers)
    purchase_outstanding = []
    if "supplier" in party.get("party_types", []):
        purchase_outstanding = await db.purchase_entries.find(
            {"supplier_gstin": party.get("gstin"), "payment_status": {"$in": ["unpaid", "partial"]}},
            {"_id": 0}
        ).sort("invoice_date", 1).to_list(100)
    
    total_receivable = sum(inv.get("balance_due", 0) for inv in sales_outstanding)
    total_payable = sum(inv.get("balance_due", inv.get("totals", {}).get("grand_total", 0)) for inv in purchase_outstanding)
    
    return {
        "party": party,
        "sales_outstanding": sales_outstanding,
        "purchase_outstanding": purchase_outstanding,
        "total_receivable": total_receivable,
        "total_payable": total_payable
    }


# ==================== CREDIT NOTES / RETURNS (PHASE 3) ====================

class CreditNoteItem(BaseModel):
    master_sku_id: Optional[str] = None
    sku_code: str
    name: str
    hsn_code: Optional[str] = None
    quantity: int
    rate: float
    gst_rate: float = 18
    reason: Optional[str] = None

class CreditNoteCreate(BaseModel):
    firm_id: str
    party_id: str
    original_invoice_id: Optional[str] = None  # Reference to original invoice
    credit_note_date: str
    items: List[CreditNoteItem]
    reason: str  # "sales_return", "discount", "price_difference", "damaged_goods", "other"
    notes: Optional[str] = None

class CreditNoteResponse(BaseModel):
    id: str
    credit_note_number: str
    firm_id: str
    firm_name: str
    party_id: str
    party_name: str
    original_invoice_id: Optional[str] = None
    original_invoice_number: Optional[str] = None
    credit_note_date: str
    items: List[dict]
    subtotal: float
    is_igst: bool
    igst: float
    cgst: float
    sgst: float
    total_gst: float
    grand_total: float
    reason: str
    notes: Optional[str] = None
    status: str  # "pending", "adjusted", "refunded"
    created_by: str
    created_by_name: str
    created_at: str


async def get_next_credit_note_number(firm_id: str) -> str:
    """Generate credit note number: CN/{FIRM_CODE}/{FY}/{RUNNING_NUMBER}"""
    firm = await db.firms.find_one({"id": firm_id})
    if not firm:
        raise HTTPException(status_code=400, detail="Invalid firm")
    
    name_parts = firm["name"].split()[:3]
    firm_code = "".join([p[0].upper() for p in name_parts if p])
    if len(firm_code) < 2:
        firm_code = firm["name"][:3].upper()
    
    fy = get_financial_year()
    prefix = f"CN/{firm_code}/{fy}/"
    
    last_cn = await db.credit_notes.find_one(
        {"firm_id": firm_id, "credit_note_number": {"$regex": f"^{prefix}"}},
        sort=[("created_at", -1)]
    )
    
    if last_cn:
        try:
            last_num = int(last_cn["credit_note_number"].split("/")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    
    return f"{prefix}{str(next_num).zfill(5)}"


@api_router.get("/credit-notes")
async def list_credit_notes(
    firm_id: Optional[str] = None,
    party_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """List all credit notes"""
    query = {}
    if firm_id:
        query["firm_id"] = firm_id
    if party_id:
        query["party_id"] = party_id
    if status:
        query["status"] = status
    
    notes = await db.credit_notes.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return notes


@api_router.post("/credit-notes", response_model=CreditNoteResponse)
async def create_credit_note(
    cn_data: CreditNoteCreate,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Create a credit note (sales return / adjustment)"""
    now = datetime.now(timezone.utc)
    
    firm = await db.firms.find_one({"id": cn_data.firm_id, "is_active": True})
    if not firm:
        raise HTTPException(status_code=400, detail="Invalid or inactive firm")
    
    party = await db.parties.find_one({"id": cn_data.party_id, "is_active": True})
    if not party:
        raise HTTPException(status_code=400, detail="Invalid or inactive party")
    
    original_invoice = None
    if cn_data.original_invoice_id:
        original_invoice = await db.sales_invoices.find_one({"id": cn_data.original_invoice_id})
    
    # Determine IGST vs CGST/SGST
    firm_state_code = firm.get("gstin", "")[:2] if firm.get("gstin") else get_state_code(firm.get("state", ""))
    party_state_code = party.get("state_code") or get_state_code(party.get("state", ""))
    is_igst = firm_state_code != party_state_code
    
    # Calculate totals
    items = []
    subtotal = 0
    total_igst = 0
    total_cgst = 0
    total_sgst = 0
    
    for item in cn_data.items:
        taxable = item.quantity * item.rate
        gst_amount = taxable * (item.gst_rate / 100)
        
        item_dict = {
            "master_sku_id": item.master_sku_id,
            "sku_code": item.sku_code,
            "name": item.name,
            "hsn_code": item.hsn_code,
            "quantity": item.quantity,
            "rate": item.rate,
            "gst_rate": item.gst_rate,
            "taxable_value": taxable,
            "gst_amount": gst_amount,
            "reason": item.reason
        }
        items.append(item_dict)
        subtotal += taxable
        
        if is_igst:
            total_igst += gst_amount
        else:
            total_cgst += gst_amount / 2
            total_sgst += gst_amount / 2
    
    total_gst = total_igst + total_cgst + total_sgst
    grand_total = round(subtotal + total_gst, 2)
    
    cn_number = await get_next_credit_note_number(cn_data.firm_id)
    
    credit_note = {
        "id": str(uuid.uuid4()),
        "credit_note_number": cn_number,
        "firm_id": cn_data.firm_id,
        "firm_name": firm["name"],
        "party_id": cn_data.party_id,
        "party_name": party["name"],
        "original_invoice_id": cn_data.original_invoice_id,
        "original_invoice_number": original_invoice.get("invoice_number") if original_invoice else None,
        "credit_note_date": cn_data.credit_note_date,
        "items": items,
        "subtotal": round(subtotal, 2),
        "is_igst": is_igst,
        "igst": round(total_igst, 2),
        "cgst": round(total_cgst, 2),
        "sgst": round(total_sgst, 2),
        "total_gst": round(total_gst, 2),
        "grand_total": grand_total,
        "reason": cn_data.reason,
        "notes": cn_data.notes,
        "status": "pending",
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "created_at": now.isoformat()
    }
    
    await db.credit_notes.insert_one(credit_note)
    
    # Create party ledger entry (Credit note reduces receivable)
    last_ledger = await db.party_ledger.find_one(
        {"party_id": cn_data.party_id},
        sort=[("created_at", -1)]
    )
    current_balance = last_ledger.get("running_balance", 0) if last_ledger else party.get("opening_balance", 0)
    running_balance = current_balance - grand_total  # Reduce receivable
    
    ledger_entry = {
        "id": str(uuid.uuid4()),
        "entry_number": f"CN-{cn_number}",
        "party_id": cn_data.party_id,
        "party_name": party["name"],
        "entry_type": "credit_note",
        "debit": 0,
        "credit": grand_total,
        "running_balance": running_balance,
        "narration": f"Credit Note {cn_number} - {cn_data.reason}",
        "reference_type": "credit_note",
        "reference_id": credit_note["id"],
        "firm_id": cn_data.firm_id,
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "created_at": now.isoformat()
    }
    await db.party_ledger.insert_one(ledger_entry)
    
    await log_activity(
        action="credit_note_created",
        entity_type="credit_note",
        entity_id=credit_note["id"],
        user=user,
        details={
            "credit_note_number": cn_number,
            "party_name": party["name"],
            "grand_total": grand_total,
            "reason": cn_data.reason
        }
    )
    
    return credit_note


# ==================== ACCOUNTING REPORTS (PHASE 3) ====================

@api_router.get("/reports/receivables")
async def get_receivables_report(
    firm_id: Optional[str] = None,
    as_of_date: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get receivables report - all outstanding from customers"""
    query = {"payment_status": {"$in": ["unpaid", "partial"]}}
    if firm_id:
        query["firm_id"] = firm_id
    if as_of_date:
        query["invoice_date"] = {"$lte": as_of_date}
    
    invoices = await db.sales_invoices.find(query, {"_id": 0}).sort("invoice_date", 1).to_list(500)
    
    # Group by party
    by_party = {}
    for inv in invoices:
        pid = inv["party_id"]
        if pid not in by_party:
            by_party[pid] = {
                "party_id": pid,
                "party_name": inv["party_name"],
                "invoices": [],
                "total_outstanding": 0
            }
        by_party[pid]["invoices"].append(inv)
        by_party[pid]["total_outstanding"] += inv.get("balance_due", 0)
    
    parties_list = sorted(by_party.values(), key=lambda x: -x["total_outstanding"])
    total_receivable = sum(p["total_outstanding"] for p in parties_list)
    
    # Age analysis
    today = datetime.now(timezone.utc).date()
    age_buckets = {"0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
    
    for inv in invoices:
        inv_date = datetime.fromisoformat(inv["invoice_date"].replace("Z", "+00:00")).date() if "T" in inv["invoice_date"] else datetime.strptime(inv["invoice_date"], "%Y-%m-%d").date()
        days = (today - inv_date).days
        balance = inv.get("balance_due", 0)
        
        if days <= 30:
            age_buckets["0-30"] += balance
        elif days <= 60:
            age_buckets["31-60"] += balance
        elif days <= 90:
            age_buckets["61-90"] += balance
        else:
            age_buckets["90+"] += balance
    
    return {
        "total_receivable": total_receivable,
        "invoice_count": len(invoices),
        "party_count": len(parties_list),
        "by_party": parties_list,
        "age_analysis": age_buckets,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/reports/payables")
async def get_payables_report(
    firm_id: Optional[str] = None,
    as_of_date: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get payables report - all outstanding to suppliers"""
    query = {"payment_status": {"$in": ["unpaid", "partial"]}}
    if firm_id:
        query["firm_id"] = firm_id
    if as_of_date:
        query["invoice_date"] = {"$lte": as_of_date}
    
    purchases = await db.purchase_entries.find(query, {"_id": 0}).sort("invoice_date", 1).to_list(500)
    
    # Group by supplier
    by_supplier = {}
    for pur in purchases:
        sid = pur.get("supplier_gstin") or pur.get("supplier_name", "Unknown")
        if sid not in by_supplier:
            by_supplier[sid] = {
                "supplier_id": sid,
                "supplier_name": pur.get("supplier_name", "Unknown"),
                "supplier_gstin": pur.get("supplier_gstin"),
                "purchases": [],
                "total_outstanding": 0
            }
        balance = pur.get("balance_due", pur.get("totals", {}).get("grand_total", 0))
        by_supplier[sid]["purchases"].append(pur)
        by_supplier[sid]["total_outstanding"] += balance
    
    suppliers_list = sorted(by_supplier.values(), key=lambda x: -x["total_outstanding"])
    total_payable = sum(s["total_outstanding"] for s in suppliers_list)
    
    return {
        "total_payable": total_payable,
        "purchase_count": len(purchases),
        "supplier_count": len(suppliers_list),
        "by_supplier": suppliers_list,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/reports/party-statement/{party_id}")
async def get_party_statement(
    party_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get detailed party statement with all transactions"""
    party = await db.parties.find_one({"id": party_id}, {"_id": 0})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    
    query = {"party_id": party_id}
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        query.setdefault("created_at", {})["$lte"] = to_date
    
    ledger_entries = await db.party_ledger.find(query, {"_id": 0}).sort("created_at", 1).to_list(500)
    
    # Calculate totals
    total_debit = sum(e.get("debit", 0) for e in ledger_entries)
    total_credit = sum(e.get("credit", 0) for e in ledger_entries)
    
    opening_balance = party.get("opening_balance", 0)
    closing_balance = ledger_entries[-1].get("running_balance", opening_balance) if ledger_entries else opening_balance
    
    return {
        "party": party,
        "period": {"from": from_date, "to": to_date},
        "opening_balance": opening_balance,
        "transactions": ledger_entries,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "closing_balance": closing_balance,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/reports/profit-summary")
async def get_profit_summary(
    firm_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get profit summary dashboard"""
    # Sales query
    sales_query = {}
    if firm_id:
        sales_query["firm_id"] = firm_id
    if from_date:
        sales_query["invoice_date"] = {"$gte": from_date}
    if to_date:
        sales_query.setdefault("invoice_date", {})["$lte"] = to_date
    
    sales_invoices = await db.sales_invoices.find(sales_query, {"_id": 0}).to_list(1000)
    
    # Purchase query
    purchase_query = {}
    if firm_id:
        purchase_query["firm_id"] = firm_id
    if from_date:
        purchase_query["invoice_date"] = {"$gte": from_date}
    if to_date:
        purchase_query.setdefault("invoice_date", {})["$lte"] = to_date
    
    purchases = await db.purchase_entries.find(purchase_query, {"_id": 0}).to_list(1000)
    
    # Credit notes
    cn_query = {}
    if firm_id:
        cn_query["firm_id"] = firm_id
    if from_date:
        cn_query["credit_note_date"] = {"$gte": from_date}
    if to_date:
        cn_query.setdefault("credit_note_date", {})["$lte"] = to_date
    
    credit_notes = await db.credit_notes.find(cn_query, {"_id": 0}).to_list(500)
    
    # Calculate totals
    total_sales = sum(inv.get("taxable_value", 0) for inv in sales_invoices)
    total_sales_gst = sum(inv.get("total_gst", 0) for inv in sales_invoices)
    total_purchases = sum(pur.get("totals", {}).get("taxable_value", 0) for pur in purchases)
    total_purchase_gst = sum(pur.get("totals", {}).get("total_gst", 0) for pur in purchases)
    total_credit_notes = sum(cn.get("grand_total", 0) for cn in credit_notes)
    
    net_sales = total_sales - total_credit_notes
    gross_profit = net_sales - total_purchases
    gst_liability = total_sales_gst - total_purchase_gst
    
    # Monthly breakdown
    monthly_data = {}
    for inv in sales_invoices:
        month = inv["invoice_date"][:7]  # YYYY-MM
        if month not in monthly_data:
            monthly_data[month] = {"sales": 0, "purchases": 0, "credit_notes": 0}
        monthly_data[month]["sales"] += inv.get("taxable_value", 0)
    
    for pur in purchases:
        month = pur["invoice_date"][:7]
        if month not in monthly_data:
            monthly_data[month] = {"sales": 0, "purchases": 0, "credit_notes": 0}
        monthly_data[month]["purchases"] += pur.get("totals", {}).get("taxable_value", 0)
    
    for cn in credit_notes:
        month = cn["credit_note_date"][:7]
        if month not in monthly_data:
            monthly_data[month] = {"sales": 0, "purchases": 0, "credit_notes": 0}
        monthly_data[month]["credit_notes"] += cn.get("grand_total", 0)
    
    return {
        "period": {"from": from_date, "to": to_date},
        "summary": {
            "total_sales": total_sales,
            "total_sales_gst": total_sales_gst,
            "total_credit_notes": total_credit_notes,
            "net_sales": net_sales,
            "total_purchases": total_purchases,
            "total_purchase_gst": total_purchase_gst,
            "gross_profit": gross_profit,
            "gross_margin_percent": round((gross_profit / net_sales * 100) if net_sales > 0 else 0, 2),
            "gst_liability": gst_liability
        },
        "counts": {
            "sales_invoices": len(sales_invoices),
            "purchases": len(purchases),
            "credit_notes": len(credit_notes)
        },
        "monthly_breakdown": dict(sorted(monthly_data.items())),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


# ==================== DOCUMENT COMPLIANCE SYSTEM ====================

"""
Document Compliance System - Ensures proper documentation for all movements
- Mandatory document matrix per transaction type
- Hard/Soft blocking rules
- Override workflow with audit
- Compliance scoring (weighted)
- Duplicate detection
- Exception dashboard
"""

# Document compliance statuses
DOC_STATUS = ["complete", "pending", "invalid", "overridden"]

# Blocking levels
BLOCK_LEVEL = {
    "hard": "hard",      # Cannot save without document
    "soft": "soft",      # Saves as pending
    "warning": "warning" # Saves with warning
}

# Document weights for compliance scoring
DOC_WEIGHTS = {
    "critical": 5,
    "important": 3,
    "optional": 1
}

# Age brackets for exceptions (in days)
AGE_BRACKETS = ["0-3", "4-7", "8-15", "15+"]

# ============= MANDATORY DOCUMENT MATRIX =============
DOCUMENT_MATRIX = {
    "sales_invoice": {
        "name": "Sales Invoice",
        "required_fields": [
            {"field": "dispatch_id", "label": "Linked Dispatch", "weight": "critical", "block": "hard"},
            {"field": "invoice_number", "label": "Invoice Number", "weight": "critical", "block": "hard"},
            {"field": "invoice_date", "label": "Invoice Date", "weight": "critical", "block": "hard"},
            {"field": "party_id", "label": "Party", "weight": "critical", "block": "hard"},
            {"field": "taxable_value", "label": "Taxable Value", "weight": "critical", "block": "hard"},
            {"field": "total_gst", "label": "GST Breakup", "weight": "critical", "block": "hard"},
        ],
        "required_files": [],
        "optional_files": [
            {"field": "invoice_pdf", "label": "Invoice PDF", "weight": "optional"}
        ],
        "override_approvers": ["admin"]
    },
    "purchase_entry": {
        "name": "Purchase Entry",
        "required_fields": [
            {"field": "supplier_name", "label": "Supplier", "weight": "critical", "block": "hard"},
            {"field": "invoice_number", "label": "Supplier Invoice Number", "weight": "critical", "block": "hard"},
            {"field": "invoice_date", "label": "Invoice Date", "weight": "critical", "block": "hard"},
            {"field": "firm_id", "label": "Firm", "weight": "critical", "block": "hard"},
            {"field": "items", "label": "Item Lines", "weight": "critical", "block": "hard"},
            {"field": "totals.taxable_value", "label": "Taxable Value", "weight": "critical", "block": "hard"},
            {"field": "totals.total_gst", "label": "GST Breakup", "weight": "critical", "block": "hard"},
        ],
        "required_files": [
            {"field": "supplier_invoice_file", "label": "Supplier Invoice Copy", "weight": "critical", "block": "hard"}
        ],
        "optional_files": [],
        "override_approvers": ["admin"]
    },
    "dispatch": {
        "name": "Dispatch",
        "required_fields": [
            {"field": "id", "label": "Dispatch Record", "weight": "critical", "block": "hard"},
            {"field": "tracking_id", "label": "Tracking ID / Label Reference", "weight": "important", "block": "soft"},
            {"field": "firm_id", "label": "Firm", "weight": "critical", "block": "hard"},
            {"field": "master_sku_id", "label": "Item", "weight": "critical", "block": "hard"},
            {"field": "quantity", "label": "Quantity", "weight": "critical", "block": "hard"},
        ],
        "required_files": [],
        "optional_files": [
            {"field": "packing_slip", "label": "Packing Slip", "weight": "optional"}
        ],
        "override_approvers": ["admin"]
    },
    "gate_receipt": {
        "name": "Gate Receipt",
        "required_fields": [
            {"field": "id", "label": "Inward Record", "weight": "critical", "block": "hard"},
            {"field": "classification", "label": "Classification Decision", "weight": "critical", "block": "hard"},
            {"field": "source_type", "label": "Source Type", "weight": "critical", "block": "hard"},
        ],
        "required_files": [],
        "optional_files": [
            {"field": "awb_document", "label": "Courier AWB / Supplier Document", "weight": "optional"}
        ],
        "override_approvers": ["admin", "accountant"]
    },
    "payment_received": {
        "name": "Payment Received",
        "required_fields": [
            {"field": "party_id", "label": "Party", "weight": "critical", "block": "hard"},
            {"field": "amount", "label": "Amount", "weight": "critical", "block": "hard"},
            {"field": "payment_date", "label": "Date", "weight": "critical", "block": "hard"},
            {"field": "payment_mode", "label": "Payment Mode", "weight": "critical", "block": "hard"},
            {"field": "reference_number", "label": "Reference Number", "weight": "important", "block": "soft"},
            {"field": "invoice_id_or_advance", "label": "Linked Invoice or Advance", "weight": "important", "block": "soft"},
        ],
        "required_files": [],
        "optional_files": [
            {"field": "bank_proof", "label": "Bank Proof / Receipt", "weight": "optional"}
        ],
        "override_approvers": ["admin", "accountant"]
    },
    "payment_made": {
        "name": "Payment Made",
        "required_fields": [
            {"field": "party_id", "label": "Party", "weight": "critical", "block": "hard"},
            {"field": "amount", "label": "Amount", "weight": "critical", "block": "hard"},
            {"field": "payment_date", "label": "Date", "weight": "critical", "block": "hard"},
            {"field": "payment_mode", "label": "Payment Mode", "weight": "critical", "block": "hard"},
            {"field": "reference_number", "label": "Reference Number", "weight": "important", "block": "soft"},
            {"field": "invoice_id", "label": "Linked Invoice / Payable", "weight": "important", "block": "soft"},
        ],
        "required_files": [],
        "optional_files": [
            {"field": "payment_proof", "label": "Payment Proof", "weight": "optional"}
        ],
        "override_approvers": ["admin", "accountant"]
    },
    "stock_adjustment": {
        "name": "Stock Adjustment",
        "required_fields": [
            {"field": "reason", "label": "Reason", "weight": "critical", "block": "hard"},
            {"field": "firm_id", "label": "Firm", "weight": "critical", "block": "hard"},
            {"field": "item_id", "label": "Item", "weight": "critical", "block": "hard"},
            {"field": "quantity", "label": "Quantity", "weight": "critical", "block": "hard"},
            {"field": "created_by", "label": "User", "weight": "critical", "block": "hard"},
        ],
        "required_files": [],
        "optional_files": [
            {"field": "adjustment_document", "label": "Adjustment Document", "weight": "optional"}
        ],
        "threshold_for_approval": 10000,  # Above this value requires approval
        "threshold_for_mandatory_file": 50000,  # Above this requires file
        "override_approvers": ["admin", "accountant"]
    },
    "inter_firm_transfer": {
        "name": "Inter-Firm Transfer",
        "required_fields": [
            {"field": "source_firm_id", "label": "Source Firm", "weight": "critical", "block": "hard"},
            {"field": "destination_firm_id", "label": "Destination Firm", "weight": "critical", "block": "hard"},
            {"field": "transfer_invoice_number", "label": "Transfer Invoice Number", "weight": "critical", "block": "hard"},
            {"field": "transfer_date", "label": "Transfer Date", "weight": "critical", "block": "hard"},
            {"field": "items", "label": "Item, Quantity, Value", "weight": "critical", "block": "hard"},
        ],
        "required_files": [
            {"field": "transfer_invoice_file", "label": "Transfer Invoice Copy", "weight": "critical", "block": "hard"}
        ],
        "optional_files": [],
        "override_approvers": ["admin"]
    },
    "production_completion": {
        "name": "Production Completion",
        "required_fields": [
            {"field": "production_request_id", "label": "Production Request", "weight": "critical", "block": "hard"},
            {"field": "serial_numbers", "label": "Serial Numbers (for manufactured)", "weight": "critical", "block": "hard"},
            {"field": "completion_note", "label": "Completion Note", "weight": "important", "block": "soft"},
            {"field": "bom_linkage", "label": "BOM Linkage", "weight": "important", "block": "soft"},
        ],
        "required_files": [],
        "optional_files": [
            {"field": "production_sheet", "label": "Production Sheet", "weight": "optional"}
        ],
        "override_approvers": ["admin"]
    },
    "repair_yard_inward": {
        "name": "Repair-yard Inward",
        "required_fields": [
            {"field": "reason", "label": "Reason", "weight": "critical", "block": "hard"},
            {"field": "classification", "label": "Classification", "weight": "critical", "block": "hard"},
            {"field": "firm_id", "label": "Firm", "weight": "critical", "block": "hard"},
            {"field": "item_id", "label": "Item", "weight": "critical", "block": "hard"},
            {"field": "quantity", "label": "Quantity", "weight": "critical", "block": "hard"},
        ],
        "required_files": [],
        "optional_files": [
            {"field": "inward_document", "label": "Inward Document", "weight": "optional"}
        ],
        "threshold_for_mandatory_file": 25000,
        "override_approvers": ["admin", "accountant"]
    },
    "return_in": {
        "name": "Return In",
        "required_fields": [
            {"field": "original_reference", "label": "Original Dispatch/Source Reference", "weight": "critical", "block": "hard"},
            {"field": "quantity", "label": "Quantity", "weight": "critical", "block": "hard"},
            {"field": "firm_id", "label": "Firm", "weight": "critical", "block": "hard"},
            {"field": "classification", "label": "Classification (reusable/scrap/repair)", "weight": "critical", "block": "hard"},
        ],
        "required_files": [],
        "optional_files": [
            {"field": "return_proof", "label": "Return Proof / Inward Note", "weight": "optional"}
        ],
        "override_approvers": ["admin", "accountant"]
    }
}


def get_nested_value(obj: dict, path: str):
    """Get nested value from dict using dot notation"""
    keys = path.split(".")
    value = obj
    for key in keys:
        if isinstance(value, dict):
            value = value.get(key)
        else:
            return None
    return value


def validate_document_compliance(transaction_type: str, data: dict, files: dict = None, value_amount: float = 0) -> dict:
    """
    Validate a transaction against the document matrix
    
    Returns:
    {
        "status": "complete" | "pending" | "invalid",
        "can_proceed": True | False,
        "hard_blocks": [...],
        "soft_blocks": [...],
        "warnings": [...],
        "missing_critical": [...],
        "missing_important": [...],
        "missing_optional": [...],
        "compliance_score": float,
        "max_score": float
    }
    """
    if transaction_type not in DOCUMENT_MATRIX:
        return {"status": "complete", "can_proceed": True, "compliance_score": 100, "max_score": 100}
    
    matrix = DOCUMENT_MATRIX[transaction_type]
    files = files or {}
    
    hard_blocks = []
    soft_blocks = []
    warnings = []
    missing_critical = []
    missing_important = []
    missing_optional = []
    
    earned_points = 0
    max_points = 0
    
    # Check required fields
    for field_spec in matrix.get("required_fields", []):
        field = field_spec["field"]
        label = field_spec["label"]
        weight = field_spec["weight"]
        block = field_spec.get("block", "warning")
        
        weight_value = DOC_WEIGHTS.get(weight, 1)
        max_points += weight_value
        
        value = get_nested_value(data, field)
        
        # Special handling for certain fields
        if field == "invoice_id_or_advance":
            value = data.get("invoice_id") or data.get("is_advance")
        
        if field == "serial_numbers":
            # Only required for manufactured items
            if data.get("is_manufactured", False):
                if not value or (isinstance(value, list) and len(value) == 0):
                    value = None
            else:
                value = True  # Not required for non-manufactured
        
        has_value = value is not None and value != "" and value != [] and value != {}
        
        if has_value:
            earned_points += weight_value
        else:
            issue = {"field": field, "label": label, "weight": weight}
            if weight == "critical":
                missing_critical.append(issue)
            elif weight == "important":
                missing_important.append(issue)
            else:
                missing_optional.append(issue)
            
            if block == "hard":
                hard_blocks.append(f"Missing required: {label}")
            elif block == "soft":
                soft_blocks.append(f"Missing: {label}")
            else:
                warnings.append(f"Recommended: {label}")
    
    # Check required files
    for file_spec in matrix.get("required_files", []):
        field = file_spec["field"]
        label = file_spec["label"]
        weight = file_spec["weight"]
        block = file_spec.get("block", "soft")
        
        weight_value = DOC_WEIGHTS.get(weight, 1)
        max_points += weight_value
        
        # Check threshold for mandatory file
        threshold = matrix.get("threshold_for_mandatory_file", 0)
        if threshold > 0 and value_amount < threshold:
            # File not mandatory below threshold
            earned_points += weight_value
            continue
        
        has_file = files.get(field) is not None
        
        if has_file:
            earned_points += weight_value
        else:
            issue = {"field": field, "label": label, "weight": weight, "is_file": True}
            missing_critical.append(issue)
            
            if block == "hard":
                hard_blocks.append(f"Missing required file: {label}")
            else:
                soft_blocks.append(f"Missing file: {label}")
    
    # Check optional files
    for file_spec in matrix.get("optional_files", []):
        field = file_spec["field"]
        label = file_spec["label"]
        weight = file_spec.get("weight", "optional")
        
        weight_value = DOC_WEIGHTS.get(weight, 1)
        max_points += weight_value
        
        has_file = files.get(field) is not None
        
        if has_file:
            earned_points += weight_value
        else:
            missing_optional.append({"field": field, "label": label, "weight": weight, "is_file": True})
            warnings.append(f"Optional: {label}")
    
    # Determine status and can_proceed
    if hard_blocks:
        status = "invalid"
        can_proceed = False
    elif soft_blocks:
        status = "pending"
        can_proceed = True
    elif warnings:
        status = "complete"
        can_proceed = True
    else:
        status = "complete"
        can_proceed = True
    
    compliance_score = round((earned_points / max_points * 100) if max_points > 0 else 100, 2)
    
    return {
        "status": status,
        "can_proceed": can_proceed,
        "hard_blocks": hard_blocks,
        "soft_blocks": soft_blocks,
        "warnings": warnings,
        "missing_critical": missing_critical,
        "missing_important": missing_important,
        "missing_optional": missing_optional,
        "compliance_score": compliance_score,
        "max_score": max_points,
        "earned_score": earned_points
    }


async def check_duplicate_document(doc_type: str, field: str, value: str, exclude_id: str = None) -> dict:
    """
    Check for duplicate documents
    
    Returns:
    {
        "is_duplicate": True | False,
        "existing_record": {...} | None
    }
    """
    if not value:
        return {"is_duplicate": False, "existing_record": None}
    
    collection_map = {
        "supplier_invoice": ("purchase_entries", "invoice_number"),
        "transfer_invoice": ("inter_firm_transfers", "transfer_invoice_number"),
        "sales_invoice": ("sales_invoices", "invoice_number"),
        "payment_reference": ("payments", "reference_number"),
        "serial_number": ("inventory_ledger", "serial_number")
    }
    
    if doc_type not in collection_map:
        return {"is_duplicate": False, "existing_record": None}
    
    collection_name, db_field = collection_map[doc_type]
    collection = getattr(db, collection_name)
    
    query = {db_field: value}
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    
    existing = await collection.find_one(query, {"_id": 0})
    
    return {
        "is_duplicate": existing is not None,
        "existing_record": existing
    }


async def create_compliance_exception(
    transaction_type: str,
    transaction_id: str,
    transaction_ref: str,
    firm_id: str,
    issues: list,
    severity: str,
    user: dict
) -> dict:
    """Create a compliance exception record"""
    now = datetime.now(timezone.utc)
    
    exception = {
        "id": str(uuid.uuid4()),
        "transaction_type": transaction_type,
        "transaction_id": transaction_id,
        "transaction_ref": transaction_ref,
        "firm_id": firm_id,
        "issues": issues,
        "severity": severity,  # "critical", "important", "minor"
        "status": "open",  # "open", "resolved", "overridden"
        "override_by": None,
        "override_reason": None,
        "override_at": None,
        "created_by": user["id"],
        "created_by_name": f"{user['first_name']} {user['last_name']}",
        "created_at": now.isoformat(),
        "resolved_at": None
    }
    
    await db.compliance_exceptions.insert_one(exception)
    return exception


async def process_compliance_override(
    exception_id: str,
    override_reason: str,
    user: dict
) -> dict:
    """Process an override for a compliance exception"""
    now = datetime.now(timezone.utc)
    
    exception = await db.compliance_exceptions.find_one({"id": exception_id})
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    
    # Check if user can approve override
    matrix = DOCUMENT_MATRIX.get(exception["transaction_type"], {})
    allowed_approvers = matrix.get("override_approvers", ["admin"])
    
    if user["role"] not in allowed_approvers:
        raise HTTPException(status_code=403, detail=f"Only {', '.join(allowed_approvers)} can override this exception")
    
    # Update exception
    await db.compliance_exceptions.update_one(
        {"id": exception_id},
        {"$set": {
            "status": "overridden",
            "override_by": user["id"],
            "override_by_name": f"{user['first_name']} {user['last_name']}",
            "override_reason": override_reason,
            "override_at": now.isoformat()
        }}
    )
    
    # Update transaction doc_status
    collection_map = {
        "sales_invoice": "sales_invoices",
        "purchase_entry": "purchase_entries",
        "dispatch": "dispatches",
        "payment_received": "payments",
        "payment_made": "payments",
        "stock_adjustment": "inventory_ledger",
        "inter_firm_transfer": "inter_firm_transfers"
    }
    
    collection_name = collection_map.get(exception["transaction_type"])
    if collection_name:
        collection = getattr(db, collection_name)
        await collection.update_one(
            {"id": exception["transaction_id"]},
            {"$set": {"doc_status": "overridden", "doc_status_updated_at": now.isoformat()}}
        )
    
    # Create audit log
    await log_activity(
        action="compliance_override",
        entity_type="compliance_exception",
        entity_id=exception_id,
        user=user,
        details={
            "transaction_type": exception["transaction_type"],
            "transaction_id": exception["transaction_id"],
            "override_reason": override_reason
        }
    )
    
    return await db.compliance_exceptions.find_one({"id": exception_id}, {"_id": 0})


def get_age_bracket(created_at: str) -> str:
    """Get age bracket for an exception"""
    created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    days = (now - created).days
    
    if days <= 3:
        return "0-3"
    elif days <= 7:
        return "4-7"
    elif days <= 15:
        return "8-15"
    else:
        return "15+"


# ============= COMPLIANCE API ENDPOINTS =============

@api_router.get("/drafts")
async def list_draft_transactions(
    firm_id: Optional[str] = None,
    transaction_type: Optional[str] = None,  # "purchase", "sales_invoice"
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """List all draft transactions pending finalization"""
    drafts = []
    
    # Get draft purchases
    if not transaction_type or transaction_type == "purchase":
        query = {"status": "draft"}
        if firm_id:
            query["firm_id"] = firm_id
        purchases = await db.purchases.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        for p in purchases:
            drafts.append({
                **p,
                "transaction_type": "purchase",
                "reference_number": p.get("purchase_number"),
                "value": p.get("total_amount", 0)
            })
    
    # Get draft sales invoices
    if not transaction_type or transaction_type == "sales_invoice":
        query = {"status": "draft"}
        if firm_id:
            query["firm_id"] = firm_id
        invoices = await db.sales_invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        for inv in invoices:
            drafts.append({
                **inv,
                "transaction_type": "sales_invoice",
                "reference_number": inv.get("invoice_number"),
                "value": inv.get("grand_total", 0)
            })
    
    return drafts


@api_router.post("/drafts/{transaction_type}/{transaction_id}/finalize")
async def finalize_draft_transaction(
    transaction_type: str,
    transaction_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Finalize a draft transaction - validates compliance and posts to ledger"""
    now = datetime.now(timezone.utc)
    
    if transaction_type == "purchase":
        # Get the draft purchase
        purchase = await db.purchases.find_one({"id": transaction_id, "status": "draft"})
        if not purchase:
            raise HTTPException(status_code=404, detail="Draft purchase not found")
        
        # Re-validate compliance
        compliance_data = {
            "supplier_name": purchase["supplier_name"],
            "invoice_number": purchase["invoice_number"],
            "invoice_date": purchase["invoice_date"],
            "firm_id": purchase["firm_id"],
            "items": purchase["items"],
            "totals": purchase.get("totals", {})
        }
        files_present = {"supplier_invoice_file": purchase.get("invoice_file")}
        
        compliance_result = validate_document_compliance(
            "purchase_entry", compliance_data, files_present, purchase.get("total_amount", 0)
        )
        
        if not compliance_result["can_proceed"]:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Cannot finalize - compliance validation failed",
                    "hard_blocks": compliance_result["hard_blocks"],
                    "missing_critical": compliance_result["missing_critical"]
                }
            )
        
        # Create ledger entries for inventory
        for item in purchase["items"]:
            entry = {
                "id": str(uuid.uuid4()),
                "entry_number": f"LED-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:5].upper()}",
                "entry_type": "purchase",
                "item_type": item.get("item_type", "raw_material"),
                "item_id": item["item_id"],
                "item_name": item.get("item_name"),
                "firm_id": purchase["firm_id"],
                "firm_name": purchase.get("firm_name"),
                "quantity": item["quantity"],
                "unit_cost": item.get("rate", 0),
                "running_balance": 0,
                "invoice_number": purchase["invoice_number"],
                "reference_id": transaction_id,
                "reason": f"Purchase from {purchase['supplier_name']}",
                "created_by": user["id"],
                "created_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                "created_at": now.isoformat()
            }
            
            # Calculate running balance
            current_stock = await db.inventory_ledger.aggregate([
                {"$match": {"item_id": item["item_id"], "item_type": item.get("item_type", "raw_material"), "firm_id": purchase["firm_id"]}},
                {"$group": {"_id": None, "total": {"$sum": "$quantity"}}}
            ]).to_list(1)
            current_balance = current_stock[0]["total"] if current_stock else 0
            entry["running_balance"] = current_balance + item["quantity"]
            
            await db.inventory_ledger.insert_one(entry)
        
        # Update purchase status
        await db.purchases.update_one(
            {"id": transaction_id},
            {"$set": {
                "status": "final",
                "doc_status": compliance_result["status"],
                "finalized_at": now.isoformat(),
                "finalized_by": user["id"],
                "finalized_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
            }}
        )
        
        return {"success": True, "message": "Purchase finalized and stock updated", "doc_status": compliance_result["status"]}
    
    elif transaction_type == "sales_invoice":
        # Get the draft invoice
        invoice = await db.sales_invoices.find_one({"id": transaction_id, "status": "draft"})
        if not invoice:
            raise HTTPException(status_code=404, detail="Draft sales invoice not found")
        
        # Re-validate compliance
        compliance_data = {
            "dispatch_id": invoice["dispatch_id"],
            "invoice_number": invoice["invoice_number"],
            "invoice_date": invoice["invoice_date"],
            "party_id": invoice["party_id"],
            "taxable_value": invoice.get("taxable_value", 0),
            "total_gst": invoice.get("total_gst", 0)
        }
        
        compliance_result = validate_document_compliance(
            "sales_invoice", compliance_data, {}, invoice.get("grand_total", 0)
        )
        
        if not compliance_result["can_proceed"]:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Cannot finalize - compliance validation failed",
                    "hard_blocks": compliance_result["hard_blocks"],
                    "missing_critical": compliance_result["missing_critical"]
                }
            )
        
        # Get party for ledger entry
        party = await db.parties.find_one({"id": invoice["party_id"]})
        
        # Create party ledger entry
        last_ledger = await db.party_ledger.find_one(
            {"party_id": invoice["party_id"]},
            sort=[("created_at", -1)]
        )
        running_balance = (last_ledger.get("running_balance", 0) if last_ledger else (party.get("opening_balance", 0) if party else 0)) + invoice["grand_total"]
        
        ledger_entry = {
            "id": str(uuid.uuid4()),
            "entry_number": f"SI-{invoice['invoice_number']}",
            "party_id": invoice["party_id"],
            "party_name": invoice.get("party_name"),
            "entry_type": "sales_invoice",
            "debit": invoice["grand_total"],
            "credit": 0,
            "running_balance": running_balance,
            "narration": f"Sales Invoice {invoice['invoice_number']}",
            "reference_type": "sales_invoice",
            "reference_id": transaction_id,
            "firm_id": invoice["firm_id"],
            "created_by": user["id"],
            "created_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "created_at": now.isoformat()
        }
        await db.party_ledger.insert_one(ledger_entry)
        
        # Update dispatch with invoice reference
        await db.dispatches.update_one(
            {"id": invoice["dispatch_id"]},
            {"$set": {"sales_invoice_id": transaction_id, "sales_invoice_number": invoice["invoice_number"]}}
        )
        
        # Update invoice status
        await db.sales_invoices.update_one(
            {"id": transaction_id},
            {"$set": {
                "status": "final",
                "doc_status": compliance_result["status"],
                "finalized_at": now.isoformat(),
                "finalized_by": user["id"],
                "finalized_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
            }}
        )
        
        return {"success": True, "message": "Sales invoice finalized and ledger updated", "doc_status": compliance_result["status"]}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid transaction type")


@api_router.get("/compliance/matrix")
async def get_document_matrix(
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get the full document compliance matrix"""
    return DOCUMENT_MATRIX


@api_router.post("/compliance/validate")
async def validate_transaction_compliance(
    transaction_type: str,
    data: dict,
    files: dict = None,
    value_amount: float = 0,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Validate a transaction against compliance rules before posting"""
    result = validate_document_compliance(transaction_type, data, files, value_amount)
    return result


@api_router.post("/compliance/check-duplicate")
async def check_duplicate(
    doc_type: str,
    value: str,
    exclude_id: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Check for duplicate documents"""
    return await check_duplicate_document(doc_type, "", value, exclude_id)


@api_router.get("/compliance/exceptions")
async def get_compliance_exceptions(
    firm_id: Optional[str] = None,
    transaction_type: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    age_bracket: Optional[str] = None,
    limit: int = 200,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get compliance exceptions with filters"""
    query = {}
    
    if firm_id:
        query["firm_id"] = firm_id
    if transaction_type:
        query["transaction_type"] = transaction_type
    if severity:
        query["severity"] = severity
    if status:
        query["status"] = status
    
    exceptions = await db.compliance_exceptions.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Add age bracket and filter if needed
    result = []
    for exc in exceptions:
        exc["age_bracket"] = get_age_bracket(exc["created_at"])
        if age_bracket and exc["age_bracket"] != age_bracket:
            continue
        result.append(exc)
    
    return result


@api_router.get("/compliance/exceptions/{exception_id}")
async def get_compliance_exception(
    exception_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get single compliance exception"""
    exception = await db.compliance_exceptions.find_one({"id": exception_id}, {"_id": 0})
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    
    exception["age_bracket"] = get_age_bracket(exception["created_at"])
    return exception


@api_router.post("/compliance/exceptions/{exception_id}/override")
async def override_compliance_exception(
    exception_id: str,
    override_reason: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Override a compliance exception with approval"""
    if not override_reason or len(override_reason.strip()) < 10:
        raise HTTPException(status_code=400, detail="Override reason must be at least 10 characters")
    
    return await process_compliance_override(exception_id, override_reason.strip(), user)


@api_router.post("/compliance/exceptions/{exception_id}/resolve")
async def resolve_compliance_exception(
    exception_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Mark exception as resolved (documents have been attached)"""
    now = datetime.now(timezone.utc)
    
    exception = await db.compliance_exceptions.find_one({"id": exception_id})
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    
    await db.compliance_exceptions.update_one(
        {"id": exception_id},
        {"$set": {
            "status": "resolved",
            "resolved_at": now.isoformat(),
            "resolved_by": user["id"],
            "resolved_by_name": f"{user['first_name']} {user['last_name']}"
        }}
    )
    
    # Update transaction doc_status
    collection_map = {
        "sales_invoice": "sales_invoices",
        "purchase_entry": "purchase_entries",
        "dispatch": "dispatches",
        "payment_received": "payments",
        "payment_made": "payments"
    }
    
    collection_name = collection_map.get(exception["transaction_type"])
    if collection_name:
        collection = getattr(db, collection_name)
        await collection.update_one(
            {"id": exception["transaction_id"]},
            {"$set": {"doc_status": "complete", "doc_status_updated_at": now.isoformat()}}
        )
    
    return {"success": True, "message": "Exception resolved"}


@api_router.get("/compliance/dashboard")
async def get_compliance_dashboard(
    firm_id: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get compliance dashboard summary"""
    query = {"status": "open"}
    if firm_id:
        query["firm_id"] = firm_id
    
    # Get all open exceptions
    exceptions = await db.compliance_exceptions.find(query, {"_id": 0}).to_list(1000)
    
    # Summary by severity
    by_severity = {"critical": 0, "important": 0, "minor": 0}
    for exc in exceptions:
        sev = exc.get("severity", "minor")
        by_severity[sev] = by_severity.get(sev, 0) + 1
    
    # Summary by transaction type
    by_type = {}
    for exc in exceptions:
        t = exc.get("transaction_type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1
    
    # Summary by age
    by_age = {"0-3": 0, "4-7": 0, "8-15": 0, "15+": 0}
    for exc in exceptions:
        bracket = get_age_bracket(exc["created_at"])
        by_age[bracket] = by_age.get(bracket, 0) + 1
    
    # Summary by firm
    by_firm = {}
    for exc in exceptions:
        fid = exc.get("firm_id", "unknown")
        by_firm[fid] = by_firm.get(fid, 0) + 1
    
    # Get firm names
    firm_ids = list(by_firm.keys())
    firms = await db.firms.find({"id": {"$in": firm_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    firm_names = {f["id"]: f["name"] for f in firms}
    
    by_firm_named = {firm_names.get(fid, fid): count for fid, count in by_firm.items()}
    
    # Overridden count
    overridden = await db.compliance_exceptions.count_documents({"status": "overridden"})
    
    # Resolved today count
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    resolved_today = await db.compliance_exceptions.count_documents({
        "status": "resolved",
        "resolved_at": {"$gte": today_start}
    })
    
    return {
        "total_open": len(exceptions),
        "by_severity": by_severity,
        "by_transaction_type": by_type,
        "by_age": by_age,
        "by_firm": by_firm_named,
        "overridden_count": overridden,
        "resolved_today": resolved_today,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/compliance/score")
async def get_compliance_score(
    firm_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get weighted compliance score by firm"""
    # Get all firms if no specific firm
    if firm_id:
        firms = [await db.firms.find_one({"id": firm_id}, {"_id": 0})]
    else:
        firms = await db.firms.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    result = []
    
    for firm in firms:
        if not firm:
            continue
        
        fid = firm["id"]
        
        # Count transactions with each doc_status
        date_query = {}
        if from_date:
            date_query["created_at"] = {"$gte": from_date}
        if to_date:
            date_query.setdefault("created_at", {})["$lte"] = to_date
        
        # Check sales invoices
        sales_query = {"firm_id": fid, **date_query}
        sales_total = await db.sales_invoices.count_documents(sales_query)
        sales_complete = await db.sales_invoices.count_documents({**sales_query, "doc_status": {"$in": ["complete", None]}})
        sales_pending = await db.sales_invoices.count_documents({**sales_query, "doc_status": "pending"})
        sales_overridden = await db.sales_invoices.count_documents({**sales_query, "doc_status": "overridden"})
        
        # Check purchase entries
        purchase_total = await db.purchase_entries.count_documents(sales_query)
        purchase_complete = await db.purchase_entries.count_documents({**sales_query, "doc_status": {"$in": ["complete", None]}})
        purchase_pending = await db.purchase_entries.count_documents({**sales_query, "doc_status": "pending"})
        
        # Check dispatches
        dispatch_total = await db.dispatches.count_documents(sales_query)
        dispatch_complete = await db.dispatches.count_documents({**sales_query, "doc_status": {"$in": ["complete", None]}})
        dispatch_pending = await db.dispatches.count_documents({**sales_query, "doc_status": "pending"})
        
        # Check payments
        payment_query = {"firm_id": fid, **date_query} if "firm_id" in str(db.payments.find_one()) else date_query
        payment_total = await db.payments.count_documents(date_query)
        
        # Calculate weighted score
        # Sales: weight 5, Purchase: weight 5, Dispatch: weight 3, Payment: weight 2
        total_weighted = (sales_total * 5) + (purchase_total * 5) + (dispatch_total * 3)
        complete_weighted = (sales_complete * 5) + (purchase_complete * 5) + (dispatch_complete * 3)
        
        score = round((complete_weighted / total_weighted * 100) if total_weighted > 0 else 100, 2)
        
        result.append({
            "firm_id": fid,
            "firm_name": firm["name"],
            "compliance_score": score,
            "breakdown": {
                "sales_invoices": {"total": sales_total, "complete": sales_complete, "pending": sales_pending, "overridden": sales_overridden},
                "purchase_entries": {"total": purchase_total, "complete": purchase_complete, "pending": purchase_pending},
                "dispatches": {"total": dispatch_total, "complete": dispatch_complete, "pending": dispatch_pending}
            },
            "total_transactions": sales_total + purchase_total + dispatch_total,
            "pending_count": sales_pending + purchase_pending + dispatch_pending
        })
    
    # Sort by score ascending (worst first)
    result.sort(key=lambda x: x["compliance_score"])
    
    return result


@api_router.get("/compliance/reconciliation")
async def get_reconciliation_report(
    firm_id: Optional[str] = None,
    month: Optional[str] = None,  # Format: YYYY-MM
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Monthly reconciliation reports:
    - Purchase register vs purchase stock inward
    - Sales register vs dispatch
    - Transfer register vs transfer ledger
    - Payments vs outstanding balances
    """
    now = datetime.now(timezone.utc)
    
    if not month:
        month = now.strftime("%Y-%m")
    
    # Date range for the month
    year, mon = month.split("-")
    start_date = f"{month}-01"
    if int(mon) == 12:
        end_date = f"{int(year)+1}-01-01"
    else:
        end_date = f"{year}-{str(int(mon)+1).zfill(2)}-01"
    
    date_query = {"$gte": start_date, "$lt": end_date}
    firm_query = {"firm_id": firm_id} if firm_id else {}
    
    # 1. Purchase Register vs Stock Inward
    purchase_query = {**firm_query, "invoice_date": date_query}
    purchases = await db.purchase_entries.find(purchase_query, {"_id": 0}).to_list(500)
    purchase_value = sum(p.get("totals", {}).get("grand_total", 0) for p in purchases)
    purchase_count = len(purchases)
    
    # Stock inward from purchases (inventory_ledger entries with type 'purchase')
    ledger_query = {**firm_query, "created_at": date_query, "entry_type": "purchase"}
    stock_inward = await db.inventory_ledger.find(ledger_query, {"_id": 0}).to_list(500)
    stock_inward_count = len(stock_inward)
    
    # 2. Sales Register vs Dispatch
    sales_query = {**firm_query, "invoice_date": date_query}
    sales = await db.sales_invoices.find(sales_query, {"_id": 0}).to_list(500)
    sales_value = sum(s.get("grand_total", 0) for s in sales)
    sales_count = len(sales)
    
    dispatch_query = {**firm_query, "created_at": date_query, "status": "dispatched"}
    dispatches = await db.dispatches.find(dispatch_query, {"_id": 0}).to_list(500)
    dispatch_count = len(dispatches)
    dispatches_without_invoice = len([d for d in dispatches if not d.get("sales_invoice_id")])
    
    # 3. Payments vs Outstanding
    payment_query = {"payment_date": date_query}
    payments_received = await db.payments.find({**payment_query, "payment_type": "received"}, {"_id": 0}).to_list(500)
    payments_made = await db.payments.find({**payment_query, "payment_type": "made"}, {"_id": 0}).to_list(500)
    
    total_received = sum(p.get("amount", 0) for p in payments_received)
    total_paid = sum(p.get("amount", 0) for p in payments_made)
    
    # Outstanding balances
    receivable_query = {**firm_query, "payment_status": {"$in": ["unpaid", "partial"]}}
    outstanding_receivable = await db.sales_invoices.find(receivable_query, {"_id": 0}).to_list(500)
    total_outstanding_receivable = sum(s.get("balance_due", 0) for s in outstanding_receivable)
    
    payable_query = {**firm_query, "payment_status": {"$in": ["unpaid", "partial"]}}
    outstanding_payable = await db.purchase_entries.find(payable_query, {"_id": 0}).to_list(500)
    total_outstanding_payable = sum(p.get("balance_due", p.get("totals", {}).get("grand_total", 0)) for p in outstanding_payable)
    
    # 4. GST Reconciliation
    sales_gst = sum(s.get("total_gst", 0) for s in sales)
    purchase_gst = sum(p.get("totals", {}).get("total_gst", 0) for p in purchases)
    net_gst_liability = sales_gst - purchase_gst
    
    # Discrepancies
    discrepancies = []
    
    if dispatches_without_invoice > 0:
        discrepancies.append({
            "type": "dispatch_without_invoice",
            "description": f"{dispatches_without_invoice} dispatches without sales invoice",
            "severity": "critical",
            "count": dispatches_without_invoice
        })
    
    if purchase_count != stock_inward_count:
        discrepancies.append({
            "type": "purchase_stock_mismatch",
            "description": f"Purchase entries ({purchase_count}) vs Stock inward ({stock_inward_count}) mismatch",
            "severity": "important",
            "purchase_count": purchase_count,
            "stock_count": stock_inward_count
        })
    
    return {
        "month": month,
        "firm_id": firm_id,
        "purchase_reconciliation": {
            "purchase_register_count": purchase_count,
            "purchase_register_value": purchase_value,
            "stock_inward_count": stock_inward_count,
            "match": purchase_count == stock_inward_count
        },
        "sales_reconciliation": {
            "sales_register_count": sales_count,
            "sales_register_value": sales_value,
            "dispatch_count": dispatch_count,
            "dispatches_without_invoice": dispatches_without_invoice,
            "match": dispatches_without_invoice == 0
        },
        "payment_reconciliation": {
            "payments_received_count": len(payments_received),
            "payments_received_value": total_received,
            "payments_made_count": len(payments_made),
            "payments_made_value": total_paid,
            "outstanding_receivable": total_outstanding_receivable,
            "outstanding_payable": total_outstanding_payable
        },
        "gst_reconciliation": {
            "sales_gst": sales_gst,
            "purchase_gst_itc": purchase_gst,
            "net_gst_liability": net_gst_liability,
            "note": "Compare with GST portal for final reconciliation"
        },
        "discrepancies": discrepancies,
        "discrepancy_count": len(discrepancies),
        "generated_at": now.isoformat()
    }


# ==================== APP SETUP ====================

# ============= PI / QUOTATION MODELS =============

class QuotationItemCreate(BaseModel):
    master_sku_id: str
    sku_code: Optional[str] = None
    name: str
    hsn_code: Optional[str] = None
    quantity: int
    rate: float
    gst_rate: float = 18.0
    discount_percent: float = 0.0
    discount_amount: float = 0.0

class QuotationCreate(BaseModel):
    firm_id: str
    party_id: Optional[str] = None  # Existing party
    # Or create new customer
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    customer_city: Optional[str] = None
    customer_state: Optional[str] = None
    customer_pincode: Optional[str] = None
    customer_gstin: Optional[str] = None
    items: List[QuotationItemCreate]
    validity_days: int = 15
    remarks: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    save_as_draft: bool = True

class QuotationUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    customer_city: Optional[str] = None
    customer_state: Optional[str] = None
    customer_pincode: Optional[str] = None
    customer_gstin: Optional[str] = None
    items: Optional[List[QuotationItemCreate]] = None
    validity_days: Optional[int] = None
    remarks: Optional[str] = None
    terms_and_conditions: Optional[str] = None


# ============= PI / QUOTATION HELPER FUNCTIONS =============

def generate_quotation_number(firm_code: str) -> str:
    """Generate unique quotation number: PI-FIRM-YYYYMMDD-XXXX"""
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_suffix = ''.join(random.choices('0123456789', k=4))
    return f"PI-{firm_code[:3].upper()}-{today}-{random_suffix}"

def generate_quotation_token() -> str:
    """Generate secure token for customer access"""
    return secrets.token_urlsafe(32)

def calculate_quotation_totals(items: List[dict], is_inter_state: bool) -> dict:
    """Calculate quotation totals with GST breakdown"""
    subtotal = 0
    total_discount = 0
    total_igst = 0
    total_cgst = 0
    total_sgst = 0
    
    processed_items = []
    
    for item in items:
        quantity = item.get("quantity", 0)
        rate = item.get("rate", 0)
        gst_rate = item.get("gst_rate", 18)
        discount_percent = item.get("discount_percent", 0)
        discount_amount = item.get("discount_amount", 0)
        
        line_total = quantity * rate
        line_discount = discount_amount if discount_amount > 0 else (line_total * discount_percent / 100)
        taxable_value = line_total - line_discount
        
        if is_inter_state:
            igst = taxable_value * gst_rate / 100
            cgst = 0
            sgst = 0
        else:
            igst = 0
            cgst = taxable_value * (gst_rate / 2) / 100
            sgst = taxable_value * (gst_rate / 2) / 100
        
        processed_items.append({
            **item,
            "line_total": round(line_total, 2),
            "discount": round(line_discount, 2),
            "taxable_value": round(taxable_value, 2),
            "igst": round(igst, 2),
            "cgst": round(cgst, 2),
            "sgst": round(sgst, 2),
            "total": round(taxable_value + igst + cgst + sgst, 2)
        })
        
        subtotal += line_total
        total_discount += line_discount
        total_igst += igst
        total_cgst += cgst
        total_sgst += sgst
    
    taxable_value = subtotal - total_discount
    grand_total = taxable_value + total_igst + total_cgst + total_sgst
    
    return {
        "items": processed_items,
        "subtotal": round(subtotal, 2),
        "total_discount": round(total_discount, 2),
        "taxable_value": round(taxable_value, 2),
        "igst": round(total_igst, 2),
        "cgst": round(total_cgst, 2),
        "sgst": round(total_sgst, 2),
        "total_gst": round(total_igst + total_cgst + total_sgst, 2),
        "grand_total": round(grand_total, 2),
        "is_inter_state": is_inter_state
    }


async def log_quotation_event(quotation_id: str, event_type: str, details: dict, user: dict = None, ip_address: str = None):
    """Log quotation audit events"""
    event = {
        "id": str(uuid.uuid4()),
        "quotation_id": quotation_id,
        "event_type": event_type,
        "details": details,
        "user_id": user.get("id") if user else None,
        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() if user else "Customer",
        "user_role": user.get("role") if user else "customer",
        "ip_address": ip_address,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.quotation_events.insert_one(event)
    return event


# ============= PI / QUOTATION API ENDPOINTS =============

@api_router.post("/quotations")
async def create_quotation(
    quotation: QuotationCreate,
    user: dict = Depends(require_roles(["call_support", "admin", "accountant"]))
):
    """Create a new PI/Quotation"""
    now = datetime.now(timezone.utc)
    
    # Get firm
    firm = await db.firms.find_one({"id": quotation.firm_id})
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")
    
    firm_state = firm.get("state_code", "")
    customer_state = quotation.customer_state or ""
    is_inter_state = firm_state.lower() != customer_state.lower() if firm_state and customer_state else False
    
    # Handle party/customer
    party_id = quotation.party_id
    if not party_id:
        # Search for existing customer by phone
        existing_customer = await db.customers.find_one({"phone": quotation.customer_phone})
        if existing_customer:
            # Check if party exists
            existing_party = await db.parties.find_one({"phone": quotation.customer_phone})
            if existing_party:
                party_id = existing_party["id"]
            else:
                # Create party from customer
                party_id = str(uuid.uuid4())
                await db.parties.insert_one({
                    "id": party_id,
                    "name": quotation.customer_name,
                    "phone": quotation.customer_phone,
                    "email": quotation.customer_email,
                    "address": quotation.customer_address,
                    "city": quotation.customer_city,
                    "state": quotation.customer_state,
                    "pincode": quotation.customer_pincode,
                    "gstin": quotation.customer_gstin,
                    "tags": ["customer"],
                    "opening_balance": 0,
                    "customer_id": existing_customer.get("id"),
                    "created_at": now.isoformat(),
                    "created_by": user["id"]
                })
    
    # Get stock info for items
    items_with_stock = []
    for item in quotation.items:
        master_sku = await db.master_skus.find_one({"id": item.master_sku_id})
        if not master_sku:
            raise HTTPException(status_code=404, detail=f"Master SKU {item.master_sku_id} not found")
        
        # Get current stock
        stock_query = {"master_sku_id": item.master_sku_id, "firm_id": quotation.firm_id}
        stock_record = await db.skus.find_one(stock_query)
        current_stock = stock_record.get("stock_quantity", 0) if stock_record else 0
        
        items_with_stock.append({
            "master_sku_id": item.master_sku_id,
            "sku_code": item.sku_code or master_sku.get("sku_code"),
            "name": item.name or master_sku.get("name"),
            "hsn_code": item.hsn_code or master_sku.get("hsn_code"),
            "quantity": item.quantity,
            "rate": item.rate,
            "gst_rate": item.gst_rate,
            "discount_percent": item.discount_percent,
            "discount_amount": item.discount_amount,
            "stock_at_creation": current_stock,
            "cost_price_snapshot": master_sku.get("cost_price", 0),
            "mrp_snapshot": master_sku.get("mrp", item.rate)
        })
    
    # Calculate totals
    totals = calculate_quotation_totals(items_with_stock, is_inter_state)
    
    # Generate quotation number and token
    quotation_id = str(uuid.uuid4())
    firm_code = firm.get("code", firm.get("name", "MG")[:3])
    quotation_number = generate_quotation_number(firm_code)
    access_token = generate_quotation_token()
    
    validity_date = (now + timedelta(days=quotation.validity_days)).isoformat()
    
    # Determine status
    status = "draft" if quotation.save_as_draft else "sent"
    
    quotation_doc = {
        "id": quotation_id,
        "quotation_number": quotation_number,
        "version": 1,
        "firm_id": quotation.firm_id,
        "firm_name": firm.get("name"),
        "firm_gstin": firm.get("gstin"),
        "firm_address": firm.get("address"),
        "firm_state": firm_state,
        "party_id": party_id,
        "customer_name": quotation.customer_name,
        "customer_phone": quotation.customer_phone,
        "customer_email": quotation.customer_email,
        "customer_address": quotation.customer_address,
        "customer_city": quotation.customer_city,
        "customer_state": quotation.customer_state,
        "customer_pincode": quotation.customer_pincode,
        "customer_gstin": quotation.customer_gstin,
        "items": totals["items"],
        "subtotal": totals["subtotal"],
        "total_discount": totals["total_discount"],
        "taxable_value": totals["taxable_value"],
        "igst": totals["igst"],
        "cgst": totals["cgst"],
        "sgst": totals["sgst"],
        "total_gst": totals["total_gst"],
        "grand_total": totals["grand_total"],
        "is_inter_state": is_inter_state,
        "validity_days": quotation.validity_days,
        "validity_date": validity_date,
        "remarks": quotation.remarks,
        "terms_and_conditions": quotation.terms_and_conditions or "1. Prices are subject to change without notice.\n2. Delivery within 7-10 working days.\n3. Payment terms: 100% advance.\n4. GST extra as applicable.\n5. Warranty as per product terms.",
        "access_token": access_token,
        "status": status,
        "is_locked": status != "draft",
        "sent_at": now.isoformat() if status == "sent" else None,
        "viewed_at": None,
        "view_count": 0,
        "approved_at": None,
        "rejected_at": None,
        "rejection_reason": None,
        "converted_at": None,
        "conversion_type": None,
        "conversion_reference_id": None,
        "expired_at": None,
        "cancelled_at": None,
        "cancellation_reason": None,
        "created_by": user["id"],
        "created_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.quotations.insert_one(quotation_doc)
    quotation_doc.pop("_id", None)
    
    # Log event
    await log_quotation_event(quotation_id, "created", {
        "quotation_number": quotation_number,
        "grand_total": totals["grand_total"],
        "status": status
    }, user)
    
    return quotation_doc


@api_router.get("/quotations")
async def list_quotations(
    status: Optional[str] = None,
    firm_id: Optional[str] = None,
    created_by: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(require_roles(["call_support", "admin", "accountant"]))
):
    """List quotations with filters"""
    query = {}
    
    # Role-based filtering
    if user["role"] == "call_support":
        query["created_by"] = user["id"]
    
    if status:
        if status == "pending_action":
            # Approved but not converted
            query["status"] = "approved"
            query["converted_at"] = None
        else:
            query["status"] = status
    
    if firm_id:
        query["firm_id"] = firm_id
    
    if created_by:
        query["created_by"] = created_by
    
    if from_date:
        query.setdefault("created_at", {})["$gte"] = from_date
    
    if to_date:
        query.setdefault("created_at", {})["$lte"] = to_date + "T23:59:59"
    
    if search:
        query["$or"] = [
            {"quotation_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}}
        ]
    
    quotations = await db.quotations.find(query, {"_id": 0, "access_token": 0}).sort("created_at", -1).to_list(500)
    
    # Check validity expiry
    now = datetime.now(timezone.utc)
    for q in quotations:
        if q.get("status") in ["sent", "viewed"] and q.get("validity_date"):
            validity = datetime.fromisoformat(q["validity_date"].replace("Z", "+00:00"))
            if now > validity:
                q["is_expired"] = True
    
    return quotations


# IMPORTANT: These specific routes must come BEFORE the {quotation_id} route
@api_router.get("/quotations/pending-action")
async def get_pending_action_quotations(
    bucket: Optional[str] = None,  # "stock_available", "pending_production", "pending_procurement", "pending_dispatch", "expired"
    firm_id: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get approved quotations pending action with stock status buckets"""
    now = datetime.now(timezone.utc)
    
    # Get approved but not converted quotations
    query = {"status": "approved", "converted_at": None}
    if firm_id:
        query["firm_id"] = firm_id
    
    quotations = await db.quotations.find(query, {"_id": 0, "access_token": 0}).sort("approved_at", 1).to_list(500)
    
    # Categorize by stock availability
    categorized = {
        "stock_available": [],
        "pending_production": [],
        "pending_procurement": [],
        "pending_dispatch": [],
        "expired": []
    }
    
    for q in quotations:
        # Check if expired
        if q.get("validity_date"):
            validity = datetime.fromisoformat(q["validity_date"].replace("Z", "+00:00"))
            if now > validity:
                categorized["expired"].append(q)
                continue
        
        # Check stock for all items
        all_in_stock = True
        any_manufactured = False
        
        for item in q.get("items", []):
            stock_query = {"master_sku_id": item["master_sku_id"], "firm_id": q["firm_id"]}
            stock_record = await db.skus.find_one(stock_query)
            current_stock = stock_record.get("stock_quantity", 0) if stock_record else 0
            item["current_stock"] = current_stock
            
            if current_stock < item["quantity"]:
                all_in_stock = False
            
            # Check if manufactured item
            master_sku = await db.master_skus.find_one({"id": item["master_sku_id"]})
            if master_sku and master_sku.get("is_manufactured"):
                any_manufactured = True
        
        if all_in_stock:
            categorized["stock_available"].append(q)
        elif any_manufactured:
            categorized["pending_production"].append(q)
        else:
            categorized["pending_procurement"].append(q)
    
    if bucket:
        return categorized.get(bucket, [])
    
    return {
        "buckets": categorized,
        "counts": {k: len(v) for k, v in categorized.items()},
        "total": sum(len(v) for v in categorized.values())
    }


@api_router.get("/quotations/reports")
async def get_quotation_reports(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    firm_id: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get quotation statistics and reports"""
    query = {}
    
    if from_date:
        query.setdefault("created_at", {})["$gte"] = from_date
    if to_date:
        query.setdefault("created_at", {})["$lte"] = to_date + "T23:59:59"
    if firm_id:
        query["firm_id"] = firm_id
    
    quotations = await db.quotations.find(query, {"_id": 0}).to_list(10000)
    
    # Calculate statistics
    total = len(quotations)
    by_status = {}
    by_agent = {}
    total_value = 0
    approved_value = 0
    converted_value = 0
    
    for q in quotations:
        status = q.get("status", "unknown")
        by_status[status] = by_status.get(status, 0) + 1
        
        agent = q.get("created_by_name", "Unknown")
        if agent not in by_agent:
            by_agent[agent] = {"total": 0, "approved": 0, "converted": 0, "value": 0}
        by_agent[agent]["total"] += 1
        by_agent[agent]["value"] += q.get("grand_total", 0)
        
        if status == "approved":
            by_agent[agent]["approved"] += 1
            approved_value += q.get("grand_total", 0)
        if status == "converted":
            by_agent[agent]["converted"] += 1
            converted_value += q.get("grand_total", 0)
        
        total_value += q.get("grand_total", 0)
    
    # Calculate conversion rates
    sent_viewed_approved = by_status.get("sent", 0) + by_status.get("viewed", 0) + by_status.get("approved", 0) + by_status.get("converted", 0)
    approved_converted = by_status.get("approved", 0) + by_status.get("converted", 0)
    
    conversion_rate = round((approved_converted / sent_viewed_approved * 100) if sent_viewed_approved > 0 else 0, 1)
    
    return {
        "total_quotations": total,
        "by_status": by_status,
        "total_value": round(total_value, 2),
        "approved_value": round(approved_value, 2),
        "converted_value": round(converted_value, 2),
        "conversion_rate": conversion_rate,
        "by_agent": by_agent,
        "pending_approval": by_status.get("sent", 0) + by_status.get("viewed", 0),
        "pending_conversion": by_status.get("approved", 0)
    }


@api_router.get("/quotations/{quotation_id}")
async def get_quotation(
    quotation_id: str,
    user: dict = Depends(require_roles(["call_support", "admin", "accountant"]))
):
    """Get quotation details"""
    quotation = await db.quotations.find_one({"id": quotation_id}, {"_id": 0})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    # Role-based access
    if user["role"] == "call_support" and quotation["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get audit events
    events = await db.quotation_events.find({"quotation_id": quotation_id}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    quotation["events"] = events
    
    return quotation


@api_router.put("/quotations/{quotation_id}")
async def update_quotation(
    quotation_id: str,
    update: QuotationUpdate,
    user: dict = Depends(require_roles(["call_support", "admin", "accountant"]))
):
    """Update a draft quotation (creates new version if locked)"""
    quotation = await db.quotations.find_one({"id": quotation_id})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    if quotation.get("is_locked"):
        raise HTTPException(status_code=400, detail="Quotation is locked. Create a new version instead.")
    
    if quotation["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft quotations can be edited")
    
    now = datetime.now(timezone.utc)
    update_data = {"updated_at": now.isoformat()}
    
    if update.customer_name:
        update_data["customer_name"] = update.customer_name
    if update.customer_phone:
        update_data["customer_phone"] = update.customer_phone
    if update.customer_email:
        update_data["customer_email"] = update.customer_email
    if update.customer_address:
        update_data["customer_address"] = update.customer_address
    if update.customer_city:
        update_data["customer_city"] = update.customer_city
    if update.customer_state:
        update_data["customer_state"] = update.customer_state
    if update.customer_pincode:
        update_data["customer_pincode"] = update.customer_pincode
    if update.customer_gstin:
        update_data["customer_gstin"] = update.customer_gstin
    if update.remarks:
        update_data["remarks"] = update.remarks
    if update.terms_and_conditions:
        update_data["terms_and_conditions"] = update.terms_and_conditions
    if update.validity_days:
        update_data["validity_days"] = update.validity_days
        update_data["validity_date"] = (now + timedelta(days=update.validity_days)).isoformat()
    
    if update.items:
        # Recalculate totals
        firm = await db.firms.find_one({"id": quotation["firm_id"]})
        firm_state = firm.get("state_code", "") if firm else ""
        customer_state = update.customer_state or quotation.get("customer_state", "")
        is_inter_state = firm_state.lower() != customer_state.lower() if firm_state and customer_state else False
        
        items_with_stock = []
        for item in update.items:
            master_sku = await db.master_skus.find_one({"id": item.master_sku_id})
            if not master_sku:
                raise HTTPException(status_code=404, detail=f"Master SKU {item.master_sku_id} not found")
            
            stock_query = {"master_sku_id": item.master_sku_id, "firm_id": quotation["firm_id"]}
            stock_record = await db.skus.find_one(stock_query)
            current_stock = stock_record.get("stock_quantity", 0) if stock_record else 0
            
            items_with_stock.append({
                "master_sku_id": item.master_sku_id,
                "sku_code": item.sku_code or master_sku.get("sku_code"),
                "name": item.name or master_sku.get("name"),
                "hsn_code": item.hsn_code or master_sku.get("hsn_code"),
                "quantity": item.quantity,
                "rate": item.rate,
                "gst_rate": item.gst_rate,
                "discount_percent": item.discount_percent,
                "discount_amount": item.discount_amount,
                "stock_at_creation": current_stock,
                "cost_price_snapshot": master_sku.get("cost_price", 0),
                "mrp_snapshot": master_sku.get("mrp", item.rate)
            })
        
        totals = calculate_quotation_totals(items_with_stock, is_inter_state)
        update_data.update({
            "items": totals["items"],
            "subtotal": totals["subtotal"],
            "total_discount": totals["total_discount"],
            "taxable_value": totals["taxable_value"],
            "igst": totals["igst"],
            "cgst": totals["cgst"],
            "sgst": totals["sgst"],
            "total_gst": totals["total_gst"],
            "grand_total": totals["grand_total"],
            "is_inter_state": is_inter_state
        })
    
    await db.quotations.update_one({"id": quotation_id}, {"$set": update_data})
    
    await log_quotation_event(quotation_id, "updated", {"fields_updated": list(update_data.keys())}, user)
    
    return {"success": True, "message": "Quotation updated"}


@api_router.post("/quotations/{quotation_id}/send")
async def send_quotation(
    quotation_id: str,
    user: dict = Depends(require_roles(["call_support", "admin", "accountant"]))
):
    """Send quotation to customer (locks the quotation)"""
    quotation = await db.quotations.find_one({"id": quotation_id})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    if quotation["status"] not in ["draft"]:
        raise HTTPException(status_code=400, detail="Only draft quotations can be sent")
    
    now = datetime.now(timezone.utc)
    
    # Lock and update status
    await db.quotations.update_one(
        {"id": quotation_id},
        {"$set": {
            "status": "sent",
            "is_locked": True,
            "sent_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    await log_quotation_event(quotation_id, "sent", {"sent_to": quotation["customer_phone"]}, user)
    
    # Generate shareable link
    base_url = os.environ.get("FRONTEND_URL", "https://crm.musclegrid.in")
    share_link = f"{base_url}/pi/{quotation['access_token']}"
    
    return {
        "success": True,
        "message": "Quotation sent and locked",
        "share_link": share_link,
        "quotation_number": quotation["quotation_number"]
    }


@api_router.post("/quotations/{quotation_id}/create-version")
async def create_quotation_version(
    quotation_id: str,
    user: dict = Depends(require_roles(["call_support", "admin", "accountant"]))
):
    """Create a new version of an existing quotation"""
    original = await db.quotations.find_one({"id": quotation_id})
    if not original:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    now = datetime.now(timezone.utc)
    new_id = str(uuid.uuid4())
    new_version = original.get("version", 1) + 1
    new_token = generate_quotation_token()
    
    # Copy quotation with new ID and version
    new_quotation = {
        **original,
        "id": new_id,
        "version": new_version,
        "access_token": new_token,
        "status": "draft",
        "is_locked": False,
        "sent_at": None,
        "viewed_at": None,
        "view_count": 0,
        "approved_at": None,
        "rejected_at": None,
        "rejection_reason": None,
        "converted_at": None,
        "conversion_type": None,
        "conversion_reference_id": None,
        "expired_at": None,
        "cancelled_at": None,
        "cancellation_reason": None,
        "previous_version_id": quotation_id,
        "created_by": user["id"],
        "created_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "validity_date": (now + timedelta(days=original.get("validity_days", 15))).isoformat()
    }
    new_quotation.pop("_id", None)
    
    await db.quotations.insert_one(new_quotation)
    
    await log_quotation_event(new_id, "version_created", {"from_version": original.get("version", 1), "original_id": quotation_id}, user)
    
    return {"success": True, "new_quotation_id": new_id, "version": new_version}


@api_router.post("/quotations/{quotation_id}/cancel")
async def cancel_quotation(
    quotation_id: str,
    reason: str,
    user: dict = Depends(require_roles(["call_support", "admin", "accountant"]))
):
    """Cancel a quotation"""
    quotation = await db.quotations.find_one({"id": quotation_id})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    if quotation["status"] in ["converted", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this quotation")
    
    now = datetime.now(timezone.utc)
    
    await db.quotations.update_one(
        {"id": quotation_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": now.isoformat(),
            "cancellation_reason": reason,
            "updated_at": now.isoformat()
        }}
    )
    
    await log_quotation_event(quotation_id, "cancelled", {"reason": reason}, user)
    
    return {"success": True, "message": "Quotation cancelled"}


# ============= CUSTOMER-FACING PI ENDPOINTS (PUBLIC) =============

@api_router.get("/pi/view/{token}")
async def view_quotation_public(token: str, request: Request):
    """Public endpoint for customers to view their quotation"""
    quotation = await db.quotations.find_one({"access_token": token}, {"_id": 0})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    if quotation["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="This quotation has been cancelled")
    
    now = datetime.now(timezone.utc)
    
    # Check expiry
    if quotation.get("validity_date"):
        validity = datetime.fromisoformat(quotation["validity_date"].replace("Z", "+00:00"))
        if now > validity and quotation["status"] in ["sent", "viewed"]:
            await db.quotations.update_one(
                {"access_token": token},
                {"$set": {"status": "expired", "expired_at": now.isoformat()}}
            )
            quotation["status"] = "expired"
    
    # Update view count and status
    if quotation["status"] == "sent":
        await db.quotations.update_one(
            {"access_token": token},
            {"$set": {
                "status": "viewed",
                "viewed_at": now.isoformat()
            },
            "$inc": {"view_count": 1}}
        )
        quotation["status"] = "viewed"
        quotation["viewed_at"] = now.isoformat()
        
        # Log view event
        client_ip = request.client.host if request.client else None
        await log_quotation_event(quotation["id"], "viewed", {"ip_address": client_ip})
    else:
        # Just increment view count
        await db.quotations.update_one(
            {"access_token": token},
            {"$inc": {"view_count": 1}}
        )
    
    # Remove sensitive fields
    quotation.pop("access_token", None)
    
    return quotation


@api_router.post("/pi/approve/{token}")
async def approve_quotation_public(token: str, request: Request):
    """Public endpoint for customers to approve quotation"""
    quotation = await db.quotations.find_one({"access_token": token})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    if quotation["status"] not in ["sent", "viewed"]:
        raise HTTPException(status_code=400, detail=f"Cannot approve quotation in '{quotation['status']}' status")
    
    now = datetime.now(timezone.utc)
    
    # Check expiry
    if quotation.get("validity_date"):
        validity = datetime.fromisoformat(quotation["validity_date"].replace("Z", "+00:00"))
        if now > validity:
            raise HTTPException(status_code=400, detail="This quotation has expired")
    
    await db.quotations.update_one(
        {"access_token": token},
        {"$set": {
            "status": "approved",
            "approved_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    client_ip = request.client.host if request.client else None
    await log_quotation_event(quotation["id"], "approved", {"ip_address": client_ip})
    
    return {"success": True, "message": "Quotation approved! Our team will contact you shortly."}


@api_router.post("/pi/reject/{token}")
async def reject_quotation_public(token: str, reason: Optional[str] = None, request: Request = None):
    """Public endpoint for customers to reject quotation"""
    quotation = await db.quotations.find_one({"access_token": token})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    if quotation["status"] not in ["sent", "viewed"]:
        raise HTTPException(status_code=400, detail=f"Cannot reject quotation in '{quotation['status']}' status")
    
    now = datetime.now(timezone.utc)
    
    await db.quotations.update_one(
        {"access_token": token},
        {"$set": {
            "status": "rejected",
            "rejected_at": now.isoformat(),
            "rejection_reason": reason,
            "updated_at": now.isoformat()
        }}
    )
    
    client_ip = request.client.host if request.client else None
    await log_quotation_event(quotation["id"], "rejected", {"reason": reason, "ip_address": client_ip})
    
    return {"success": True, "message": "Quotation rejected."}


# ============= PI CONVERSION ENDPOINTS =============

@api_router.post("/quotations/{quotation_id}/convert")
async def convert_quotation(
    quotation_id: str,
    conversion_type: str,  # "dispatch", "production", "pending_fulfillment", "procurement"
    notes: Optional[str] = None,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Convert approved quotation into business flow"""
    quotation = await db.quotations.find_one({"id": quotation_id})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    if quotation["status"] != "approved":
        raise HTTPException(status_code=400, detail="Only approved quotations can be converted")
    
    if quotation.get("converted_at"):
        raise HTTPException(status_code=400, detail="This quotation has already been converted")
    
    now = datetime.now(timezone.utc)
    reference_id = None
    
    if conversion_type == "dispatch":
        # Create dispatch entry for each item - check stock first
        for item in quotation["items"]:
            # Check stock
            stock_query = {"master_sku_id": item["master_sku_id"], "firm_id": quotation["firm_id"]}
            stock_record = await db.skus.find_one(stock_query)
            current_stock = stock_record.get("stock_quantity", 0) if stock_record else 0
            
            if current_stock < item["quantity"]:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Insufficient stock for {item['name']}. Available: {current_stock}, Required: {item['quantity']}"
                )
        
        # Create pending fulfillment entries
        for item in quotation["items"]:
            pf_id = str(uuid.uuid4())
            await db.pending_fulfillment.insert_one({
                "id": pf_id,
                "type": "pi_conversion",
                "quotation_id": quotation_id,
                "quotation_number": quotation["quotation_number"],
                "firm_id": quotation["firm_id"],
                "master_sku_id": item["master_sku_id"],
                "sku_name": item["name"],
                "quantity": item["quantity"],
                "rate": item["rate"],
                "customer_name": quotation["customer_name"],
                "customer_phone": quotation["customer_phone"],
                "customer_address": quotation["customer_address"],
                "customer_city": quotation["customer_city"],
                "customer_state": quotation["customer_state"],
                "customer_pincode": quotation["customer_pincode"],
                "status": "pending_dispatch",
                "notes": notes,
                "created_by": user["id"],
                "created_at": now.isoformat()
            })
        
        reference_id = quotation_id
        
    elif conversion_type == "production":
        # Create production requests
        for item in quotation["items"]:
            prod_id = str(uuid.uuid4())
            await db.production_requests.insert_one({
                "id": prod_id,
                "firm_id": quotation["firm_id"],
                "master_sku_id": item["master_sku_id"],
                "sku_name": item["name"],
                "quantity": item["quantity"],
                "priority": "high",
                "source": "pi_conversion",
                "quotation_id": quotation_id,
                "quotation_number": quotation["quotation_number"],
                "customer_name": quotation["customer_name"],
                "status": "pending",
                "notes": notes or f"PI Conversion: {quotation['quotation_number']}",
                "created_by": user["id"],
                "created_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                "created_at": now.isoformat()
            })
        
        reference_id = quotation_id
        
    elif conversion_type == "pending_fulfillment":
        # Add to pending fulfillment queue
        for item in quotation["items"]:
            pf_id = str(uuid.uuid4())
            await db.pending_fulfillment.insert_one({
                "id": pf_id,
                "type": "pi_conversion",
                "quotation_id": quotation_id,
                "quotation_number": quotation["quotation_number"],
                "firm_id": quotation["firm_id"],
                "master_sku_id": item["master_sku_id"],
                "sku_name": item["name"],
                "quantity": item["quantity"],
                "rate": item["rate"],
                "customer_name": quotation["customer_name"],
                "customer_phone": quotation["customer_phone"],
                "customer_address": quotation["customer_address"],
                "customer_city": quotation["customer_city"],
                "customer_state": quotation["customer_state"],
                "customer_pincode": quotation["customer_pincode"],
                "status": "pending_stock",
                "notes": notes,
                "created_by": user["id"],
                "created_at": now.isoformat()
            })
        
        reference_id = quotation_id
        
    elif conversion_type == "procurement":
        # Mark for procurement follow-up
        for item in quotation["items"]:
            proc_id = str(uuid.uuid4())
            await db.procurement_requests.insert_one({
                "id": proc_id,
                "firm_id": quotation["firm_id"],
                "master_sku_id": item["master_sku_id"],
                "sku_name": item["name"],
                "quantity": item["quantity"],
                "source": "pi_conversion",
                "quotation_id": quotation_id,
                "quotation_number": quotation["quotation_number"],
                "customer_name": quotation["customer_name"],
                "priority": "high",
                "status": "pending",
                "notes": notes,
                "created_by": user["id"],
                "created_at": now.isoformat()
            })
        
        reference_id = quotation_id
    
    else:
        raise HTTPException(status_code=400, detail="Invalid conversion type")
    
    # Update quotation status
    await db.quotations.update_one(
        {"id": quotation_id},
        {"$set": {
            "status": "converted",
            "converted_at": now.isoformat(),
            "conversion_type": conversion_type,
            "conversion_reference_id": reference_id,
            "converted_by": user["id"],
            "converted_by_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "updated_at": now.isoformat()
        }}
    )
    
    await log_quotation_event(quotation_id, "converted", {
        "conversion_type": conversion_type,
        "notes": notes
    }, user)
    
    # Create incentive record for the call support agent who created the PI
    incentive_record = await create_incentive_record(quotation, conversion_type, user)
    
    # If converting to dispatch/sale, customer now becomes a proper party
    if conversion_type == "dispatch" and not quotation.get("party_id"):
        # Create party from customer data
        party_id = str(uuid.uuid4())
        await db.parties.insert_one({
            "id": party_id,
            "name": quotation["customer_name"],
            "phone": quotation.get("customer_phone"),
            "email": quotation.get("customer_email"),
            "address": quotation.get("customer_address"),
            "city": quotation.get("customer_city"),
            "state": quotation.get("customer_state"),
            "pincode": quotation.get("customer_pincode"),
            "gstin": quotation.get("customer_gstin"),
            "tags": ["customer"],
            "opening_balance": 0,
            "source": "pi_conversion",
            "source_quotation_id": quotation_id,
            "created_at": now.isoformat(),
            "created_by": user["id"]
        })
        
        # Update quotation with party_id
        await db.quotations.update_one(
            {"id": quotation_id},
            {"$set": {"party_id": party_id}}
        )
    
    return {
        "success": True,
        "message": f"Quotation converted to {conversion_type}",
        "conversion_type": conversion_type,
        "reference_id": reference_id,
        "incentive_created": incentive_record is not None,
        "incentive_amount": incentive_record.get("incentive_amount", 0) if incentive_record else 0
    }


# ============= CUSTOMER QUOTATION REQUEST ENDPOINTS =============

@api_router.post("/customer/quotation-request")
async def create_quotation_request(
    master_sku_id: str,
    quantity: int = 1,
    notes: Optional[str] = None,
    user: dict = Depends(require_roles(["customer"]))
):
    """Customer requests a quotation for a product"""
    now = datetime.now(timezone.utc)
    
    # Get master SKU
    master_sku = await db.master_skus.find_one({"id": master_sku_id})
    if not master_sku:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get customer details
    customer = await db.customers.find_one({"email": user["email"]})
    
    request_id = str(uuid.uuid4())
    request_number = f"QR-{now.strftime('%Y%m%d')}-{request_id[:6].upper()}"
    
    request_doc = {
        "id": request_id,
        "request_number": request_number,
        "customer_id": user["id"],
        "customer_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "customer_email": user["email"],
        "customer_phone": customer.get("phone") if customer else None,
        "master_sku_id": master_sku_id,
        "sku_name": master_sku.get("name"),
        "sku_code": master_sku.get("sku_code"),
        "quantity": quantity,
        "notes": notes,
        "status": "pending",
        "quotation_id": None,
        "created_at": now.isoformat()
    }
    
    await db.quotation_requests.insert_one(request_doc)
    
    return {
        "success": True,
        "message": "Quotation request submitted! Our team will contact you shortly.",
        "request_number": request_number
    }


@api_router.get("/customer/quotations")
async def get_customer_quotations(user: dict = Depends(require_roles(["customer"]))):
    """Get quotations for the logged-in customer"""
    # Find by email or phone
    customer = await db.customers.find_one({"email": user["email"]})
    
    query = {"$or": [
        {"customer_email": user["email"]},
        {"customer_phone": customer.get("phone")} if customer else {}
    ]}
    
    quotations = await db.quotations.find(query, {"_id": 0, "access_token": 0}).sort("created_at", -1).to_list(100)
    
    return quotations


@api_router.get("/customer/quotation-requests")
async def get_customer_quotation_requests(user: dict = Depends(require_roles(["customer"]))):
    """Get quotation requests for the logged-in customer"""
    requests = await db.quotation_requests.find(
        {"customer_id": user["id"]}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return requests


@api_router.get("/quotation-requests")
async def list_quotation_requests(
    status: Optional[str] = None,
    user: dict = Depends(require_roles(["call_support", "admin", "accountant"]))
):
    """List all quotation requests for staff"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.quotation_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    return requests


@api_router.post("/quotation-requests/{request_id}/create-quotation")
async def create_quotation_from_request(
    request_id: str,
    firm_id: str,
    rate: float,
    gst_rate: float = 18.0,
    discount_percent: float = 0.0,
    validity_days: int = 15,
    remarks: Optional[str] = None,
    user: dict = Depends(require_roles(["call_support", "admin", "accountant"]))
):
    """Create quotation from customer request"""
    request = await db.quotation_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    # Get master SKU
    master_sku = await db.master_skus.find_one({"id": request["master_sku_id"]})
    if not master_sku:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Create quotation
    quotation_data = QuotationCreate(
        firm_id=firm_id,
        customer_name=request["customer_name"],
        customer_phone=request.get("customer_phone", ""),
        customer_email=request.get("customer_email"),
        items=[QuotationItemCreate(
            master_sku_id=request["master_sku_id"],
            name=request["sku_name"],
            quantity=request["quantity"],
            rate=rate,
            gst_rate=gst_rate,
            discount_percent=discount_percent
        )],
        validity_days=validity_days,
        remarks=remarks or request.get("notes"),
        save_as_draft=True
    )
    
    result = await create_quotation(quotation_data, user)
    
    # Update request
    await db.quotation_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "quotation_created",
            "quotation_id": result["id"],
            "processed_by": user["id"],
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return result


# ============= PDF GENERATION FOR QUOTATIONS =============

def generate_quotation_pdf_html(quotation: dict) -> str:
    """Generate HTML for quotation PDF"""
    def format_currency(amount):
        return f"₹{amount:,.2f}" if amount else "₹0.00"
    
    def format_date(date_str):
        if not date_str:
            return "-"
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.strftime("%d %b %Y")
        except:
            return date_str[:10] if date_str else "-"
    
    items_html = ""
    for idx, item in enumerate(quotation.get("items", []), 1):
        items_html += f"""
        <tr>
            <td style="border:1px solid #ddd;padding:8px;text-align:center;">{idx}</td>
            <td style="border:1px solid #ddd;padding:8px;">
                <strong>{item.get('name', '')}</strong>
                <br><small style="color:#666;">SKU: {item.get('sku_code', '')}</small>
                {f"<br><small style='color:#666;'>HSN: {item.get('hsn_code', '')}</small>" if item.get('hsn_code') else ""}
            </td>
            <td style="border:1px solid #ddd;padding:8px;text-align:center;">{item.get('quantity', 0)}</td>
            <td style="border:1px solid #ddd;padding:8px;text-align:right;">{format_currency(item.get('rate', 0))}</td>
            <td style="border:1px solid #ddd;padding:8px;text-align:right;">{format_currency(item.get('discount', 0))}</td>
            <td style="border:1px solid #ddd;padding:8px;text-align:right;">{format_currency(item.get('taxable_value', 0))}</td>
            <td style="border:1px solid #ddd;padding:8px;text-align:center;">{item.get('gst_rate', 18)}%</td>
            <td style="border:1px solid #ddd;padding:8px;text-align:right;"><strong>{format_currency(item.get('total', 0))}</strong></td>
        </tr>
        """
    
    is_inter_state = quotation.get("is_inter_state", False)
    
    gst_breakdown = ""
    if is_inter_state:
        gst_breakdown = f"""
        <tr>
            <td style="padding:5px;text-align:right;">IGST:</td>
            <td style="padding:5px;text-align:right;">{format_currency(quotation.get('igst', 0))}</td>
        </tr>
        """
    else:
        gst_breakdown = f"""
        <tr>
            <td style="padding:5px;text-align:right;">CGST:</td>
            <td style="padding:5px;text-align:right;">{format_currency(quotation.get('cgst', 0))}</td>
        </tr>
        <tr>
            <td style="padding:5px;text-align:right;">SGST:</td>
            <td style="padding:5px;text-align:right;">{format_currency(quotation.get('sgst', 0))}</td>
        </tr>
        """
    
    terms_html = ""
    if quotation.get("terms_and_conditions"):
        terms_lines = quotation["terms_and_conditions"].split("\n")
        terms_html = "<ul style='margin:0;padding-left:20px;'>"
        for line in terms_lines:
            if line.strip():
                terms_html += f"<li style='margin:3px 0;'>{line.strip()}</li>"
        terms_html += "</ul>"
    
    status_color = {
        "draft": "#6b7280",
        "sent": "#3b82f6",
        "viewed": "#8b5cf6",
        "approved": "#10b981",
        "rejected": "#ef4444",
        "converted": "#06b6d4",
        "expired": "#f97316",
        "cancelled": "#6b7280"
    }.get(quotation.get("status", "draft"), "#6b7280")
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page {{
                size: A4;
                margin: 15mm;
            }}
            body {{
                font-family: Arial, sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: #333;
                margin: 0;
                padding: 0;
            }}
            .header {{
                display: flex;
                justify-content: space-between;
                border-bottom: 2px solid #06b6d4;
                padding-bottom: 15px;
                margin-bottom: 20px;
            }}
            .company-info {{
                flex: 1;
            }}
            .pi-info {{
                text-align: right;
            }}
            .pi-number {{
                font-size: 24px;
                font-weight: bold;
                color: #06b6d4;
            }}
            .status-badge {{
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                color: white;
                font-size: 11px;
                font-weight: bold;
                background-color: {status_color};
                margin-top: 5px;
            }}
            .parties {{
                display: flex;
                gap: 30px;
                margin-bottom: 20px;
            }}
            .party-box {{
                flex: 1;
                padding: 15px;
                background: #f8fafc;
                border-radius: 8px;
                border-left: 4px solid #06b6d4;
            }}
            .party-title {{
                font-weight: bold;
                color: #06b6d4;
                margin-bottom: 8px;
                font-size: 11px;
                text-transform: uppercase;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
            }}
            th {{
                background: #06b6d4;
                color: white;
                padding: 10px 8px;
                text-align: left;
                font-weight: bold;
            }}
            .totals-table {{
                width: 300px;
                margin-left: auto;
            }}
            .totals-table td {{
                border: none;
            }}
            .grand-total {{
                font-size: 16px;
                font-weight: bold;
                background: #f0fdfa;
                border-top: 2px solid #06b6d4;
            }}
            .terms-box {{
                margin-top: 20px;
                padding: 15px;
                background: #f8fafc;
                border-radius: 8px;
            }}
            .footer {{
                margin-top: 30px;
                text-align: center;
                color: #666;
                font-size: 10px;
                border-top: 1px solid #ddd;
                padding-top: 15px;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-info">
                <h1 style="margin:0;color:#1e293b;font-size:24px;">{quotation.get('firm_name', 'Company')}</h1>
                {f"<p style='margin:5px 0;color:#666;'>GSTIN: {quotation.get('firm_gstin', '')}</p>" if quotation.get('firm_gstin') else ""}
                {f"<p style='margin:5px 0;color:#666;'>{quotation.get('firm_address', '')}</p>" if quotation.get('firm_address') else ""}
            </div>
            <div class="pi-info">
                <div class="pi-number">{quotation.get('quotation_number', '')}</div>
                <p style="margin:5px 0;">PROFORMA INVOICE</p>
                <span class="status-badge">{quotation.get('status', 'draft').upper()}</span>
                <p style="margin:10px 0 5px;">Date: {format_date(quotation.get('created_at'))}</p>
                <p style="margin:5px 0;">Valid Until: {format_date(quotation.get('validity_date'))}</p>
            </div>
        </div>

        <div class="parties">
            <div class="party-box">
                <div class="party-title">Bill To</div>
                <p style="margin:0;font-weight:bold;font-size:14px;">{quotation.get('customer_name', '')}</p>
                {f"<p style='margin:3px 0;'>Phone: {quotation.get('customer_phone', '')}</p>" if quotation.get('customer_phone') else ""}
                {f"<p style='margin:3px 0;'>Email: {quotation.get('customer_email', '')}</p>" if quotation.get('customer_email') else ""}
                {f"<p style='margin:3px 0;'>{', '.join(filter(None, [quotation.get('customer_address'), quotation.get('customer_city'), quotation.get('customer_state'), quotation.get('customer_pincode')]))}</p>" if any([quotation.get('customer_address'), quotation.get('customer_city')]) else ""}
                {f"<p style='margin:3px 0;font-family:monospace;'>GSTIN: {quotation.get('customer_gstin', '')}</p>" if quotation.get('customer_gstin') else ""}
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width:30px;text-align:center;">#</th>
                    <th>Item Description</th>
                    <th style="width:50px;text-align:center;">Qty</th>
                    <th style="width:80px;text-align:right;">Rate</th>
                    <th style="width:70px;text-align:right;">Discount</th>
                    <th style="width:90px;text-align:right;">Taxable</th>
                    <th style="width:50px;text-align:center;">GST</th>
                    <th style="width:90px;text-align:right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                {items_html}
            </tbody>
        </table>

        <table class="totals-table">
            <tr>
                <td style="padding:5px;text-align:right;">Subtotal:</td>
                <td style="padding:5px;text-align:right;">{format_currency(quotation.get('subtotal', 0))}</td>
            </tr>
            {"<tr><td style='padding:5px;text-align:right;'>Discount:</td><td style='padding:5px;text-align:right;color:#10b981;'>-" + format_currency(quotation.get('total_discount', 0)) + "</td></tr>" if quotation.get('total_discount', 0) > 0 else ""}
            <tr>
                <td style="padding:5px;text-align:right;">Taxable Value:</td>
                <td style="padding:5px;text-align:right;">{format_currency(quotation.get('taxable_value', 0))}</td>
            </tr>
            {gst_breakdown}
            <tr class="grand-total">
                <td style="padding:10px;text-align:right;">Grand Total:</td>
                <td style="padding:10px;text-align:right;color:#06b6d4;">{format_currency(quotation.get('grand_total', 0))}</td>
            </tr>
        </table>

        {f'<div class="terms-box"><strong>Terms & Conditions:</strong>{terms_html}</div>' if terms_html else ""}
        
        {f'<div style="margin-top:15px;padding:10px;background:#fef3c7;border-radius:8px;"><strong>Remarks:</strong> {quotation.get("remarks", "")}</div>' if quotation.get("remarks") else ""}

        <div class="footer">
            <p>This is a computer-generated document. No signature required.</p>
            <p>Thank you for your business!</p>
        </div>
    </body>
    </html>
    """
    return html


@api_router.get("/pi/pdf/{token}")
async def download_quotation_pdf(token: str):
    """Download quotation as PDF"""
    try:
        from weasyprint import HTML
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation not available")
    
    quotation = await db.quotations.find_one({"access_token": token}, {"_id": 0})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    # Generate HTML
    html_content = generate_quotation_pdf_html(quotation)
    
    # Generate PDF
    pdf_buffer = BytesIO()
    HTML(string=html_content).write_pdf(pdf_buffer)
    pdf_buffer.seek(0)
    
    filename = f"{quotation['quotation_number']}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@api_router.get("/quotations/{quotation_id}/pdf")
async def download_quotation_pdf_authenticated(
    quotation_id: str,
    user: dict = Depends(require_roles(["call_support", "admin", "accountant"]))
):
    """Download quotation PDF (authenticated endpoint)"""
    try:
        from weasyprint import HTML
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation not available")
    
    quotation = await db.quotations.find_one({"id": quotation_id}, {"_id": 0})
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    # Generate HTML
    html_content = generate_quotation_pdf_html(quotation)
    
    # Generate PDF
    pdf_buffer = BytesIO()
    HTML(string=html_content).write_pdf(pdf_buffer)
    pdf_buffer.seek(0)
    
    filename = f"{quotation['quotation_number']}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ============= INCENTIVE TRACKING SYSTEM =============

class IncentiveConfigCreate(BaseModel):
    month: str  # YYYY-MM format
    incentive_type: str  # "fixed" or "percentage"
    fixed_amount: Optional[float] = 0.0
    percentage: Optional[float] = 0.0  # Percentage of sale value
    min_sale_value: float = 0.0  # Minimum sale value for incentive
    max_incentive: Optional[float] = None  # Cap on percentage-based incentive
    notes: Optional[str] = None

class IncentiveConfigUpdate(BaseModel):
    incentive_type: Optional[str] = None
    fixed_amount: Optional[float] = None
    percentage: Optional[float] = None
    min_sale_value: Optional[float] = None
    max_incentive: Optional[float] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


async def calculate_incentive(quotation: dict, config: dict) -> float:
    """Calculate incentive amount based on configuration"""
    if not config or not config.get("is_active", True):
        return 0.0
    
    sale_value = quotation.get("grand_total", 0)
    
    # Check minimum sale value
    if sale_value < config.get("min_sale_value", 0):
        return 0.0
    
    incentive = 0.0
    
    if config.get("incentive_type") == "fixed":
        incentive = config.get("fixed_amount", 0)
    elif config.get("incentive_type") == "percentage":
        incentive = sale_value * (config.get("percentage", 0) / 100)
        # Apply cap if set
        if config.get("max_incentive") and incentive > config["max_incentive"]:
            incentive = config["max_incentive"]
    
    return round(incentive, 2)


async def create_incentive_record(quotation: dict, conversion_type: str, user: dict):
    """Create incentive record when PI is converted to sale"""
    now = datetime.now(timezone.utc)
    month = now.strftime("%Y-%m")
    
    # Get incentive config for this month
    config = await db.incentive_configs.find_one({"month": month, "is_active": True}, {"_id": 0})
    
    if not config:
        # Try default config
        config = await db.incentive_configs.find_one({"month": "default", "is_active": True}, {"_id": 0})
    
    if not config:
        return None  # No incentive configuration
    
    # Get the call support agent who created the PI
    created_by_id = quotation.get("created_by")
    if not created_by_id:
        return None
    
    agent = await db.users.find_one({"id": created_by_id}, {"_id": 0})
    if not agent or agent.get("role") != "call_support":
        return None  # Only call support agents get incentives
    
    # Calculate incentive amount
    incentive_amount = await calculate_incentive(quotation, config)
    
    if incentive_amount <= 0:
        return None
    
    incentive_id = str(uuid.uuid4())
    
    incentive_record = {
        "id": incentive_id,
        "agent_id": created_by_id,
        "agent_name": quotation.get("created_by_name", ""),
        "agent_email": agent.get("email", ""),
        "quotation_id": quotation.get("id"),
        "quotation_number": quotation.get("quotation_number"),
        "customer_name": quotation.get("customer_name"),
        "sale_value": quotation.get("grand_total", 0),
        "incentive_amount": incentive_amount,
        "incentive_type": config.get("incentive_type"),
        "config_id": config.get("id"),
        "conversion_type": conversion_type,
        "month": month,
        "status": "pending",  # pending, approved, paid, cancelled
        "created_at": now.isoformat(),
        "approved_at": None,
        "approved_by": None,
        "paid_at": None,
        "paid_by": None,
        "notes": None
    }
    
    await db.incentives.insert_one(incentive_record)
    
    # Update quotation with incentive info
    await db.quotations.update_one(
        {"id": quotation["id"]},
        {"$set": {
            "incentive_id": incentive_id,
            "incentive_amount": incentive_amount
        }}
    )
    
    return incentive_record


# Admin: Manage incentive configurations
@api_router.post("/admin/incentive-config")
async def create_incentive_config(
    config: IncentiveConfigCreate,
    user: dict = Depends(require_roles(["admin"]))
):
    """Create or update incentive configuration for a month"""
    now = datetime.now(timezone.utc)
    
    # Check if config already exists for this month
    existing = await db.incentive_configs.find_one({"month": config.month})
    
    config_id = str(uuid.uuid4())
    
    config_doc = {
        "id": config_id,
        "month": config.month,
        "incentive_type": config.incentive_type,
        "fixed_amount": config.fixed_amount or 0,
        "percentage": config.percentage or 0,
        "min_sale_value": config.min_sale_value,
        "max_incentive": config.max_incentive,
        "notes": config.notes,
        "is_active": True,
        "created_by": user["id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    if existing:
        # Update existing
        await db.incentive_configs.update_one(
            {"month": config.month},
            {"$set": {
                "incentive_type": config.incentive_type,
                "fixed_amount": config.fixed_amount or 0,
                "percentage": config.percentage or 0,
                "min_sale_value": config.min_sale_value,
                "max_incentive": config.max_incentive,
                "notes": config.notes,
                "updated_at": now.isoformat()
            }}
        )
        return {"success": True, "message": "Configuration updated", "id": existing["id"]}
    else:
        await db.incentive_configs.insert_one(config_doc)
        return {"success": True, "message": "Configuration created", "id": config_id}


@api_router.get("/admin/incentive-config")
async def list_incentive_configs(
    user: dict = Depends(require_roles(["admin"]))
):
    """List all incentive configurations"""
    configs = await db.incentive_configs.find({}, {"_id": 0}).sort("month", -1).to_list(100)
    return configs


@api_router.put("/admin/incentive-config/{config_id}")
async def update_incentive_config(
    config_id: str,
    update: IncentiveConfigUpdate,
    user: dict = Depends(require_roles(["admin"]))
):
    """Update incentive configuration"""
    config = await db.incentive_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if update.incentive_type is not None:
        update_data["incentive_type"] = update.incentive_type
    if update.fixed_amount is not None:
        update_data["fixed_amount"] = update.fixed_amount
    if update.percentage is not None:
        update_data["percentage"] = update.percentage
    if update.min_sale_value is not None:
        update_data["min_sale_value"] = update.min_sale_value
    if update.max_incentive is not None:
        update_data["max_incentive"] = update.max_incentive
    if update.notes is not None:
        update_data["notes"] = update.notes
    if update.is_active is not None:
        update_data["is_active"] = update.is_active
    
    await db.incentive_configs.update_one({"id": config_id}, {"$set": update_data})
    
    return {"success": True, "message": "Configuration updated"}


# Admin: View and manage all incentives
@api_router.get("/admin/incentives")
async def list_all_incentives(
    month: Optional[str] = None,
    agent_id: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(require_roles(["admin"]))
):
    """List all incentive records"""
    query = {}
    if month:
        query["month"] = month
    if agent_id:
        query["agent_id"] = agent_id
    if status:
        query["status"] = status
    
    incentives = await db.incentives.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Calculate summary
    total_amount = sum(i.get("incentive_amount", 0) for i in incentives)
    pending_amount = sum(i.get("incentive_amount", 0) for i in incentives if i.get("status") == "pending")
    paid_amount = sum(i.get("incentive_amount", 0) for i in incentives if i.get("status") == "paid")
    
    return {
        "incentives": incentives,
        "summary": {
            "total_count": len(incentives),
            "total_amount": round(total_amount, 2),
            "pending_amount": round(pending_amount, 2),
            "paid_amount": round(paid_amount, 2)
        }
    }


@api_router.get("/admin/incentives/summary")
async def get_incentives_summary(
    month: Optional[str] = None,
    user: dict = Depends(require_roles(["admin"]))
):
    """Get incentives summary by agent"""
    query = {}
    if month:
        query["month"] = month
    else:
        # Default to current month
        query["month"] = datetime.now(timezone.utc).strftime("%Y-%m")
    
    incentives = await db.incentives.find(query, {"_id": 0}).to_list(1000)
    
    # Group by agent
    by_agent = {}
    for inc in incentives:
        agent_id = inc.get("agent_id")
        if agent_id not in by_agent:
            by_agent[agent_id] = {
                "agent_id": agent_id,
                "agent_name": inc.get("agent_name", "Unknown"),
                "total_sales": 0,
                "total_incentive": 0,
                "pending_incentive": 0,
                "paid_incentive": 0,
                "conversions": 0
            }
        
        by_agent[agent_id]["total_sales"] += inc.get("sale_value", 0)
        by_agent[agent_id]["total_incentive"] += inc.get("incentive_amount", 0)
        by_agent[agent_id]["conversions"] += 1
        
        if inc.get("status") == "pending":
            by_agent[agent_id]["pending_incentive"] += inc.get("incentive_amount", 0)
        elif inc.get("status") == "paid":
            by_agent[agent_id]["paid_incentive"] += inc.get("incentive_amount", 0)
    
    # Sort by total incentive
    summary = sorted(by_agent.values(), key=lambda x: x["total_incentive"], reverse=True)
    
    return {
        "month": query["month"],
        "agents": summary,
        "totals": {
            "total_incentive": round(sum(a["total_incentive"] for a in summary), 2),
            "pending_incentive": round(sum(a["pending_incentive"] for a in summary), 2),
            "paid_incentive": round(sum(a["paid_incentive"] for a in summary), 2),
            "total_conversions": sum(a["conversions"] for a in summary)
        }
    }


@api_router.post("/admin/incentives/{incentive_id}/approve")
async def approve_incentive(
    incentive_id: str,
    user: dict = Depends(require_roles(["admin"]))
):
    """Approve an incentive for payment"""
    incentive = await db.incentives.find_one({"id": incentive_id})
    if not incentive:
        raise HTTPException(status_code=404, detail="Incentive not found")
    
    if incentive.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending incentives can be approved")
    
    now = datetime.now(timezone.utc)
    
    await db.incentives.update_one(
        {"id": incentive_id},
        {"$set": {
            "status": "approved",
            "approved_at": now.isoformat(),
            "approved_by": user["id"]
        }}
    )
    
    return {"success": True, "message": "Incentive approved"}


@api_router.post("/admin/incentives/{incentive_id}/mark-paid")
async def mark_incentive_paid(
    incentive_id: str,
    user: dict = Depends(require_roles(["admin"]))
):
    """Mark incentive as paid"""
    incentive = await db.incentives.find_one({"id": incentive_id})
    if not incentive:
        raise HTTPException(status_code=404, detail="Incentive not found")
    
    if incentive.get("status") not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail="Cannot mark as paid")
    
    now = datetime.now(timezone.utc)
    
    await db.incentives.update_one(
        {"id": incentive_id},
        {"$set": {
            "status": "paid",
            "paid_at": now.isoformat(),
            "paid_by": user["id"]
        }}
    )
    
    return {"success": True, "message": "Incentive marked as paid"}


@api_router.post("/admin/incentives/bulk-approve")
async def bulk_approve_incentives(
    agent_id: Optional[str] = None,
    month: Optional[str] = None,
    user: dict = Depends(require_roles(["admin"]))
):
    """Bulk approve pending incentives"""
    query = {"status": "pending"}
    if agent_id:
        query["agent_id"] = agent_id
    if month:
        query["month"] = month
    
    now = datetime.now(timezone.utc)
    
    result = await db.incentives.update_many(
        query,
        {"$set": {
            "status": "approved",
            "approved_at": now.isoformat(),
            "approved_by": user["id"]
        }}
    )
    
    return {"success": True, "message": f"Approved {result.modified_count} incentives"}


@api_router.post("/admin/incentives/bulk-paid")
async def bulk_mark_paid(
    agent_id: Optional[str] = None,
    month: Optional[str] = None,
    user: dict = Depends(require_roles(["admin"]))
):
    """Bulk mark incentives as paid"""
    query = {"status": {"$in": ["pending", "approved"]}}
    if agent_id:
        query["agent_id"] = agent_id
    if month:
        query["month"] = month
    
    now = datetime.now(timezone.utc)
    
    result = await db.incentives.update_many(
        query,
        {"$set": {
            "status": "paid",
            "paid_at": now.isoformat(),
            "paid_by": user["id"]
        }}
    )
    
    return {"success": True, "message": f"Marked {result.modified_count} incentives as paid"}


# Call Support: View own incentives
@api_router.get("/my-incentives")
async def get_my_incentives(
    month: Optional[str] = None,
    user: dict = Depends(require_roles(["call_support", "admin"]))
):
    """Get incentives for the logged-in call support agent"""
    query = {"agent_id": user["id"]}
    if month:
        query["month"] = month
    
    incentives = await db.incentives.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Calculate totals
    total_earned = sum(i.get("incentive_amount", 0) for i in incentives)
    pending = sum(i.get("incentive_amount", 0) for i in incentives if i.get("status") == "pending")
    paid = sum(i.get("incentive_amount", 0) for i in incentives if i.get("status") == "paid")
    
    # Get this month's stats
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    this_month_incentives = [i for i in incentives if i.get("month") == current_month]
    this_month_total = sum(i.get("incentive_amount", 0) for i in this_month_incentives)
    this_month_conversions = len(this_month_incentives)
    
    return {
        "incentives": incentives,
        "summary": {
            "total_earned": round(total_earned, 2),
            "pending_amount": round(pending, 2),
            "paid_amount": round(paid, 2),
            "this_month": {
                "total": round(this_month_total, 2),
                "conversions": this_month_conversions
            }
        }
    }


@api_router.get("/my-incentives/stats")
async def get_my_incentive_stats(
    user: dict = Depends(require_roles(["call_support", "admin"]))
):
    """Get detailed incentive statistics for call support agent"""
    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")
    
    # Get all quotations created by this user
    total_quotations = await db.quotations.count_documents({"created_by": user["id"]})
    converted_quotations = await db.quotations.count_documents({
        "created_by": user["id"],
        "status": "converted"
    })
    
    # Get monthly breakdown
    months = []
    for i in range(6):  # Last 6 months
        month_date = now - timedelta(days=30*i)
        month_str = month_date.strftime("%Y-%m")
        
        incentives = await db.incentives.find(
            {"agent_id": user["id"], "month": month_str}, 
            {"_id": 0}
        ).to_list(100)
        
        total = sum(inc.get("incentive_amount", 0) for inc in incentives)
        sales = sum(inc.get("sale_value", 0) for inc in incentives)
        
        months.append({
            "month": month_str,
            "conversions": len(incentives),
            "total_sales": round(sales, 2),
            "total_incentive": round(total, 2)
        })
    
    return {
        "total_quotations": total_quotations,
        "converted_quotations": converted_quotations,
        "conversion_rate": round((converted_quotations / total_quotations * 100) if total_quotations > 0 else 0, 1),
        "monthly_breakdown": months
    }


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

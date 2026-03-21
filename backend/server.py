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
ROLES = ["customer", "call_support", "supervisor", "service_agent", "accountant", "dispatcher", "admin", "gate"]

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
    # VoltDoctor integration fields
    source: Optional[str] = None
    voltdoctor_id: Optional[str] = None
    voltdoctor_ticket_number: Optional[str] = None

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
    source: Optional[str] = None  # For VoltDoctor integration
    voltdoctor_id: Optional[str] = None
    voltdoctor_warranty_number: Optional[str] = None

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
    customer_name: str
    phone: str
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
    service_charges: Optional[float] = None
    service_invoice: Optional[str] = None
    stock_deducted: Optional[bool] = False
    ledger_entry_id: Optional[str] = None
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: str
    updated_at: str
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
    hsn_code: Optional[str] = None
    reorder_level: int = 10
    description: Optional[str] = None

class RawMaterialUpdate(BaseModel):
    name: Optional[str] = None
    sku_code: Optional[str] = None
    unit: Optional[str] = None
    hsn_code: Optional[str] = None
    reorder_level: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class RawMaterialResponse(BaseModel):
    id: str
    name: str
    sku_code: str
    unit: str
    hsn_code: Optional[str] = None
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
    hsn_code: Optional[str] = None
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

class MasterSKUResponse(BaseModel):
    id: str
    name: str
    sku_code: str
    category: str
    hsn_code: Optional[str] = None
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
    item_type: str  # "raw_material" or "finished_good"
    item_id: str
    from_firm_id: str
    to_firm_id: str
    quantity: int
    invoice_number: str  # MANDATORY for GST compliance
    notes: Optional[str] = None

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
        # Call support sees phone tickets AND all VoltDoctor tickets (regardless of support_type)
        query["$or"] = [
            {"support_type": "phone"},
            {"source": "voltdoctor"}
        ]
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
            {"voltdoctor_ticket_number": {"$regex": search, "$options": "i"}},
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
    """Support agent replies to a ticket. If it's a VoltDoctor ticket, syncs the reply back."""
    import httpx
    
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
    
    # If this is a VoltDoctor ticket, sync the reply back
    if ticket.get("source") == "voltdoctor" and ticket.get("voltdoctor_id"):
        try:
            voltdoctor_ticket_id = ticket["voltdoctor_id"]
            
            # Call VoltDoctor's respond API
            voltdoctor_base_url = os.environ.get('VOLTDOCTOR_API_URL', 'https://voltdoctor.preview.emergentagent.com/api')
            voltdoctor_email = os.environ.get('VOLTDOCTOR_EMAIL', 'admin@voltdoctor.com')
            voltdoctor_password = os.environ.get('VOLTDOCTOR_PASSWORD', 'admin123')
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                # First login to get a token (using service account)
                login_response = await client.post(
                    f"{voltdoctor_base_url}/auth/login",
                    json={"email": voltdoctor_email, "password": voltdoctor_password}
                )
                
                if login_response.status_code == 200:
                    vd_token = login_response.json().get("token") or login_response.json().get("access_token")
                    
                    if vd_token:
                        # Send reply to VoltDoctor
                        respond_data = {
                            "content": reply.message,
                        }
                        if reply.change_status:
                            # Map CRM status to VoltDoctor status
                            status_map = {
                                "in_progress": "in_progress",
                                "awaiting_customer": "waiting_customer",
                                "resolved": "resolved",
                                "closed": "closed",
                            }
                            respond_data["change_status"] = status_map.get(reply.change_status, reply.change_status)
                        
                        await client.post(
                            f"{voltdoctor_base_url}/admin/support/tickets/{voltdoctor_ticket_id}/respond",
                            headers={"Authorization": f"Bearer {vd_token}"},
                            json=respond_data
                        )
                        logger.info(f"Reply synced to VoltDoctor ticket {voltdoctor_ticket_id}")
        except Exception as e:
            # Log error but don't fail the request - local reply is saved
            logger.error(f"Failed to sync reply to VoltDoctor: {e}")
    
    return {"message": "Reply sent successfully", "synced_to_voltdoctor": ticket.get("source") == "voltdoctor"}

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
        # For customers, check both customer_id and user_id (VoltDoctor uses user_id)
        query["$or"] = [
            {"customer_id": user["id"]},
            {"user_id": user["id"]}
        ]
    
    if search:
        search_query = [
            {"warranty_number": {"$regex": search, "$options": "i"}},
            {"voltdoctor_warranty_number": {"$regex": search, "$options": "i"}},
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
    dispatch_doc.pop("_id", None)
    return DispatchResponse(**dispatch_doc)

@api_router.post("/dispatches/from-ticket/{ticket_id}", response_model=DispatchResponse)
async def create_dispatch_from_ticket(
    ticket_id: str,
    dispatch_type: str = Form(...),
    sku: Optional[str] = Form(None),
    user: dict = Depends(require_roles(["accountant", "admin"]))
):
    """Create dispatch from a hardware ticket"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
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
    """Adjust SKU stock quantity"""
    sku = await db.skus.find_one({"id": sku_id})
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    new_quantity = sku["stock_quantity"] + adjustment
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")
    
    await db.skus.update_one(
        {"id": sku_id},
        {"$set": {"stock_quantity": new_quantity, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log the adjustment
    log_doc = {
        "id": str(uuid.uuid4()),
        "sku_id": sku_id,
        "sku_code": sku["sku_code"],
        "adjustment": adjustment,
        "new_quantity": new_quantity,
        "reason": reason,
        "adjusted_by": user["id"],
        "adjusted_by_name": f"{user['first_name']} {user['last_name']}",
        "adjusted_at": datetime.now(timezone.utc).isoformat()
    }
    await db.stock_logs.insert_one(log_doc)
    
    return {"message": "Stock adjusted", "new_quantity": new_quantity}

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
        {"status": {"$in": ["received_at_factory", "in_repair"]}},
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
    user: dict = Depends(require_roles(["admin", "accountant", "dispatcher"]))
):
    """
    Search Master SKUs for dispatch with stock info.
    Returns SKUs that have stock at the specified firm.
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
        "unit": sku_data.unit,
        "is_manufactured": sku_data.is_manufactured,
        "bill_of_materials": [bom.dict() for bom in sku_data.bill_of_materials] if sku_data.bill_of_materials else [],
        "aliases": [alias.dict() for alias in sku_data.aliases] if sku_data.aliases else [],
        "reorder_level": sku_data.reorder_level,
        "description": sku_data.description,
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
            {"id": item_id, "firm_id": firm_id},
            {"$set": {"current_stock": current_stock, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:  # finished_good (SKU)
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
    if transfer_data.item_type not in ["raw_material", "finished_good"]:
        raise HTTPException(status_code=400, detail="Item type must be 'raw_material' or 'finished_good'")
    
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
        "details": {
            "item_name": item_name,
            "quantity": transfer_data.quantity,
            "from_firm": from_firm.get("name"),
            "to_firm": to_firm.get("name"),
            "invoice_number": transfer_data.invoice_number
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
    search: Optional[str] = None,
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
    if search:
        query["serial_number"] = {"$regex": search, "$options": "i"}
    
    serials = await db.finished_good_serials.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
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

# ==================== VOLTDOCTOR INTEGRATION ====================

# Import VoltDoctor sync module
from voltdoctor_sync import (
    init_connections as vd_init_connections,
    run_full_sync as vd_run_full_sync,
    sync_warranties_from_voltdoctor,
    sync_tickets_from_voltdoctor,
    sync_status_to_voltdoctor
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
    if status:
        query["status"] = status
    if firm_id:
        query["firm_id"] = firm_id
    if not include_expired:
        query["status"] = {"$nin": ["expired", "cancelled"]}
    
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
    
    # Summary stats
    summary = {
        "total": len(entries),
        "awaiting_stock": len([e for e in entries if e.get("status") == "awaiting_stock"]),
        "ready_to_dispatch": len([e for e in entries if e.get("status") == "ready_to_dispatch"]),
        "expired_labels": len([e for e in entries if e.get("is_label_expired")]),
        "expiring_soon": len([e for e in entries if e.get("is_label_expiring_soon")])
    }
    
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


# Background sync task
sync_running = False
last_sync_result = None

async def background_voltdoctor_sync():
    """Background task to sync with VoltDoctor every 5 minutes"""
    global sync_running, last_sync_result
    
    while True:
        try:
            if not sync_running:
                sync_running = True
                logger.info("🔄 Starting VoltDoctor sync...")
                last_sync_result = await vd_run_full_sync()
                logger.info(f"✅ VoltDoctor sync complete: {last_sync_result}")
                sync_running = False
        except Exception as e:
            logger.error(f"❌ VoltDoctor sync error: {e}")
            sync_running = False
        
        # Wait 5 minutes before next sync
        await asyncio.sleep(300)

@api_router.get("/voltdoctor/sync/status")
async def get_voltdoctor_sync_status(user: dict = Depends(require_roles(["admin"]))):
    """Get VoltDoctor sync status"""
    return {
        "sync_running": sync_running,
        "last_sync": last_sync_result,
        "sync_interval_minutes": 5
    }

@api_router.post("/voltdoctor/sync/trigger")
async def trigger_voltdoctor_sync(
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_roles(["admin"]))
):
    """Manually trigger VoltDoctor sync"""
    global sync_running, last_sync_result
    
    if sync_running:
        return {"message": "Sync already in progress", "status": "running"}
    
    # Run sync in background
    async def do_sync():
        global sync_running, last_sync_result
        sync_running = True
        try:
            last_sync_result = await vd_run_full_sync()
        finally:
            sync_running = False
    
    background_tasks.add_task(do_sync)
    return {"message": "Sync triggered", "status": "started"}

@api_router.get("/voltdoctor/warranties")
async def get_voltdoctor_warranties(user: dict = Depends(require_roles(["admin"]))):
    """Get all warranties synced from VoltDoctor"""
    warranties = await db.warranties.find(
        {"source": "voltdoctor"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10000)
    return warranties

@api_router.get("/voltdoctor/tickets")
async def get_voltdoctor_tickets(user: dict = Depends(require_roles(["admin"]))):
    """Get all tickets synced from VoltDoctor"""
    tickets = await db.tickets.find(
        {"source": "voltdoctor"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10000)
    return tickets

# Start background sync on app startup
@app.on_event("startup")
async def start_voltdoctor_sync():
    """Initialize VoltDoctor sync on app startup"""
    try:
        await vd_init_connections()
        # Start background sync task
        asyncio.create_task(background_voltdoctor_sync())
        logger.info("🚀 VoltDoctor background sync started")
    except Exception as e:
        logger.error(f"❌ Failed to start VoltDoctor sync: {e}")

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

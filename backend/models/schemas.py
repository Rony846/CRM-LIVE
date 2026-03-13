"""
MuscleGrid CRM - Database Models
Pydantic models for MongoDB documents
"""

from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

# ==================== AUTH MODELS ====================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str
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

# ==================== TICKET MODELS ====================

class TicketCreate(BaseModel):
    device_type: str
    product_name: Optional[str] = None
    serial_number: Optional[str] = None
    invoice_number: Optional[str] = None
    order_id: Optional[str] = None
    issue_description: str

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
    escalation_notes: Optional[str] = None
    supervisor_notes: Optional[str] = None
    supervisor_action: Optional[str] = None
    supervisor_sku: Optional[str] = None
    escalated_by: Optional[str] = None
    escalated_by_name: Optional[str] = None
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

# ==================== WARRANTY MODELS ====================

class WarrantyResponse(BaseModel):
    id: str
    warranty_number: str
    customer_id: str
    first_name: str
    last_name: str
    phone: str
    email: str
    device_type: str
    product_name: Optional[str] = None
    serial_number: Optional[str] = None
    invoice_date: Optional[str] = None
    invoice_amount: Optional[float] = None
    order_id: Optional[str] = None
    invoice_file: Optional[str] = None
    status: str
    warranty_end_date: Optional[str] = None
    admin_notes: Optional[str] = None
    extension_requested: bool = False
    extension_status: Optional[str] = None
    extension_review_file: Optional[str] = None
    created_at: str
    updated_at: str

# ==================== DISPATCH MODELS ====================

class DispatchCreate(BaseModel):
    dispatch_type: str
    ticket_id: Optional[str] = None
    sku: Optional[str] = None
    customer_name: str
    phone: str
    address: Optional[str] = None
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
    sku_name: Optional[str] = None
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
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: str
    updated_at: str
    scanned_in_at: Optional[str] = None
    scanned_out_at: Optional[str] = None
    original_ticket_info: Optional[dict] = None

# ==================== GATE SCAN MODELS ====================

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
    scanned_by_name: str
    notes: Optional[str] = None
    scanned_at: str

# ==================== SKU / INVENTORY MODELS ====================

class SKUCreate(BaseModel):
    sku_code: str
    model_name: str
    category: str
    stock_quantity: int = 0
    min_stock_alert: int = 5

class SKUResponse(BaseModel):
    id: str
    sku_code: str
    model_name: str
    category: str
    stock_quantity: int
    min_stock_alert: int
    active: bool = True
    created_at: str
    updated_at: str

class InventoryLogResponse(BaseModel):
    id: str
    sku_id: str
    sku_code: str
    adjustment: int
    reason: str
    new_quantity: int
    created_by: str
    created_by_name: str
    created_at: str

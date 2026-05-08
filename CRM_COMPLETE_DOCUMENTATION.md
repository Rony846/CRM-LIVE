# MuscleGrid CRM - Complete System Documentation

**Version:** 2.0  
**Last Updated:** March 23, 2026  
**Domain:** crm.musclegrid.in  
**Status:** Production Ready

---

## Table of Contents
1. [Tech Stack & Architecture](#tech-stack--architecture)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Authentication System](#authentication-system)
4. [Ticket Management System](#ticket-management-system)
5. [Call Support Module](#call-support-module)
6. [Repair Workflow](#repair-workflow)
7. [Walk-in Customer Support](#walk-in-customer-support)
8. [Warranty Management](#warranty-management)
9. [Inventory & Production System](#inventory--production-system)
10. [Dispatch Management](#dispatch-management)
11. [Gate Scanning System](#gate-scanning-system)
12. [Incoming Queue & Classification](#incoming-queue--classification)
13. [Supervisor Module](#supervisor-module)
14. [Pending Fulfillment Queue](#pending-fulfillment-queue)
15. [Analytics & Reporting](#analytics--reporting)
16. [Appointment Booking System](#appointment-booking-system)
17. [Customer Feedback System](#customer-feedback-system)
18. [Data Management & Migration](#data-management--migration)
19. [Complete API Reference](#complete-api-reference)
20. [Database Schema](#database-schema)
21. [File Structure](#file-structure)
22. [Test Credentials](#test-credentials)

---

## Tech Stack & Architecture

### Frontend
- **Framework:** React 19
- **Styling:** Tailwind CSS
- **Component Library:** Shadcn/UI
- **State Management:** React Hooks (useState, useEffect)
- **HTTP Client:** Axios
- **Notifications:** Sonner (toast)
- **Icons:** Lucide React

### Backend
- **Framework:** FastAPI (Python)
- **Server:** Uvicorn with hot reload
- **Authentication:** JWT (JSON Web Tokens)
- **Password Hashing:** Bcrypt
- **File Uploads:** Multipart form data
- **CORS:** Enabled for frontend communication

### Database
- **Database:** MongoDB
- **Driver:** Motor (async MongoDB driver for Python)
- **Connection:** Via MONGO_URL environment variable
- **Database Name:** musclegrid_crm

### Infrastructure
- **Hosting:** Emergent Platform
- **Process Manager:** Supervisor
- **Frontend Port:** 3000
- **Backend Port:** 8001
- **API Prefix:** /api (routed via Kubernetes ingress)

---

## User Roles & Permissions

### Role Definitions

| Role | Code | Access Level |
|------|------|--------------|
| Admin | `admin` | Full system access, all dashboards, user management |
| Supervisor | `supervisor` | Escalations, warranties, appointments, calendar |
| Call Support | `call_support` | All tickets (read), create tickets, diagnose, route |
| Service Agent | `service_agent` | Assigned tickets only |
| Accountant | `accountant` | Inventory, dispatches, production, labels |
| Dispatcher | `dispatcher` | Dispatch queue, mark shipped, TV mode |
| Technician | `technician` | Repair queue, walk-in customers, production |
| Gate Operator | `gate` | Inward/outward scanning only |
| Customer | `customer` | Own tickets, warranties, appointments |

### Role-Based Route Access

```
/admin/*           → admin only
/supervisor/*      → supervisor, admin
/support/*         → call_support, admin
/accountant/*      → accountant, admin
/dispatcher/*      → dispatcher, admin
/technician/*      → technician, admin
/gate/*            → gate, admin
/customer/*        → customer only
```

### Admin Single Sign-On (SSO)
Admin users can access ALL internal dashboards without switching accounts:
- Call Support Dashboard
- Supervisor Dashboard
- Technician Dashboard
- Accountant Dashboard
- Dispatcher Dashboard
- Dispatcher TV Mode
- Gate Dashboard

---

## Authentication System

### JWT Configuration
- **Algorithm:** HS256
- **Token Expiry:** 24 hours
- **Secret Key:** Stored in backend/.env as SECRET_KEY

### Endpoints

#### Register (Customer Only)
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "customer@example.com",
  "password": "securepassword",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "9876543210",
  "address": "123 Main St",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001"
}

Response: { "id", "email", "role": "customer", ... }
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}

Response: {
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": { "id", "email", "role", ... }
}
```

#### Get Current User
```
GET /api/auth/me
Authorization: Bearer <token>

Response: { "id", "email", "first_name", "last_name", "role", ... }
```

#### Update Profile
```
PATCH /api/auth/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Updated",
  "phone": "9876543210"
}
```

---

## Ticket Management System

### Ticket Number Format
- **Regular Tickets:** `MG-R-YYYYMMDD-XXXXX` (e.g., MG-R-20260321-01602)
- **Walk-in Tickets:** `MG-W-YYYYMMDD-XXXXX` (e.g., MG-W-20260321-00001)

### Ticket Statuses

| Status | Description | Next Actions |
|--------|-------------|--------------|
| `new_request` | Just created | Call support picks up |
| `call_support_followup` | Support is handling | Diagnose, resolve, or route |
| `escalated_to_supervisor` | Escalated to supervisor | Supervisor action |
| `supervisor_followup` | Supervisor is handling | Resolution or hardware |
| `resolved_on_call` | Resolved via phone | Close |
| `closed_by_agent` | Closed without hardware | Done |
| `hardware_service` | Marked for hardware | Accountant decision |
| `awaiting_label` | Waiting for pickup label | Accountant uploads |
| `label_uploaded` | Pickup label ready | Customer ships |
| `pickup_scheduled` | Customer has label | Waiting for shipment |
| `received_at_factory` | Gate scanned incoming | Accountant classifies |
| `in_repair` | Technician working | 72-hour SLA |
| `repair_completed` | Fixed, ready for dispatch | Accountant invoice |
| `service_invoice_added` | Accountant added charges | Create dispatch |
| `ready_for_dispatch` | Ready to ship back | Dispatcher action |
| `dispatched` | Shipped out | Gate outward scan |
| `delivered` | Delivered to customer | Close |
| `closed` | Fully resolved | Done |
| `customer_escalated` | Customer escalated (48h no update) | Urgent handling |

### SLA Tracking

| Support Type | SLA Duration | Starts From |
|--------------|--------------|-------------|
| Phone Support | 24 hours | Ticket creation |
| Hardware Support | 168 hours (7 days) | Ticket creation |
| Repair SLA | 72 hours | Receipt at factory |

### Ticket Fields

```javascript
{
  "id": "uuid",
  "ticket_number": "MG-R-20260321-01602",
  "customer_id": "uuid",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "9876543210",
  "device_type": "Inverter|Battery|Stabilizer|Others",
  "serial_number": "MG-INV-001234",
  "order_id": "AMZ-123456",
  "invoice_number": "INV-001",
  "invoice_file": "/uploads/invoices/file.pdf",
  "issue_description": "Device not turning on",
  "diagnosis": "Power supply failure",
  "support_type": "phone|hardware",
  "status": "new_request",
  "assigned_to": "agent_uuid",
  "sla_due": "2026-03-22T10:00:00Z",
  "sla_breached": false,
  "source": "crm|walkin",
  "pickup_label": "/uploads/pickup_labels/label.pdf",
  "service_invoice": "/uploads/service_invoices/invoice.pdf",
  "board_serial_number": "BRD-001234",
  "inverter_serial_number": "INV-001234",
  "repair_notes": "Replaced capacitor C12",
  "agent_notes": "Customer reported issue after power surge",
  "supervisor_notes": "Approved for replacement",
  "history": [
    {
      "action": "Ticket created",
      "by": "Customer",
      "timestamp": "2026-03-21T10:00:00Z"
    }
  ],
  "created_at": "2026-03-21T10:00:00Z",
  "updated_at": "2026-03-21T12:00:00Z",
  "closed_at": null,
  "received_at": null,
  "repaired_at": null,
  "dispatched_at": null
}
```

---

## Call Support Module

### Dashboard Features

#### 1. Stats Cards
- Open Tickets (new_request + call_support_followup)
- In Progress
- Diagnosed
- Hardware Routed
- Pending Feedback Calls

#### 2. Tabs

**Ticket Queue Tab**
- Shows open tickets assigned to call support
- Actions: View, Work (opens action dialog)

**Working Tab**
- Shows in-progress tickets
- Actions: Update status, diagnosis, notes

**All Tickets Tab**
- View ALL tickets across ALL departments (1300+ tickets)
- Pagination: 100 tickets per page
- Status filter: All, Open, In Progress, Hardware Service, At Factory, In Repair, Repair Completed, Resolved, Closed
- Actions: View details, View customer history

**Search Tab**
- Global search by phone, email, serial number, or order ID
- Results show:
  - Summary cards (Tickets Found, Warranties, Dispatches)
  - Detailed tables for each category

**Feedback Calls Tab**
- Amazon order customers to call for feedback
- Upload screenshot proof of completed call
- Mark as "No Answer" to retry later

#### 3. Customer History Panel
When viewing any ticket, the right panel shows:
- Customer info (name, phone, email)
- Previous tickets (ticket number, status, issue)
- Warranties (warranty number, device, status, expiry)
- Dispatches (dispatch number, product, tracking)

#### 4. Actions Available
- Update ticket status
- Add diagnosis
- Add agent notes (min 100 chars for escalation/routing)
- Route to Hardware Service
- Escalate to Supervisor
- Create new ticket on behalf of customer

### API Endpoints

```
GET /api/tickets - List all tickets (call_support sees ALL)
GET /api/tickets/{id} - Get ticket details
PATCH /api/tickets/{id} - Update ticket
POST /api/tickets/{id}/route-to-hardware - Route to hardware (100+ char notes)
POST /api/tickets/{id}/escalate-to-supervisor - Escalate (100+ char notes)
GET /api/tickets/{id}/customer-history - Get customer's full history
GET /api/customers/search?phone=&email=&serial_number=&order_id= - Global search
```

---

## Repair Workflow

### Complete Flow

```
1. CUSTOMER CREATES TICKET
   └─> Status: new_request
   └─> Invoice upload mandatory

2. CALL SUPPORT DIAGNOSES
   ├─> Software issue → Resolve on call → Status: resolved_on_call
   └─> Hardware issue → Route to hardware → Status: hardware_service

3. ACCOUNTANT DECISION
   ├─> Send Spare Part → Create outbound dispatch
   └─> Arrange Reverse Pickup → Upload pickup label → Status: label_uploaded

4. CUSTOMER RECEIVES LABEL
   └─> Downloads and ships product
   └─> Status: pickup_scheduled

5. GATE SCANS INCOMING
   └─> Status: received_at_factory
   └─> Creates incoming_queue entry

6. ACCOUNTANT CLASSIFIES
   ├─> Repair Item → Links to ticket → Status: in_repair → Goes to technician
   ├─> Return Inventory → Creates return_in ledger entry
   ├─> Repair Yard → Creates repair_yard_in entry (reason mandatory)
   └─> Scrap → Marks as dead stock

7. TECHNICIAN REPAIRS
   └─> 72-hour SLA starts
   └─> Must enter board serial number + device serial number
   └─> Adds repair notes
   └─> Status: repair_completed

8. ACCOUNTANT PROCESSES
   └─> Adds service invoice
   └─> Creates return dispatch
   └─> Status: ready_for_dispatch

9. DISPATCHER SHIPS
   └─> Marks as dispatched
   └─> Status: dispatched

10. GATE SCANS OUTWARD
    └─> Records outward scan
    └─> Status: delivered → closed
```

### Ticket Source Indicator
- **CRM Tickets:** Blue badge - came through customer portal
- **Walk-in Tickets:** Purple badge - registered by technician

---

## Walk-in Customer Support

### Features
- Technicians can register walk-in customers directly
- Bypass the normal ticket creation flow
- Start at "received_at_factory" status (already at factory)
- After repair completion, skip accountant → go directly to dispatcher

### Walk-in Registration Form
```javascript
{
  "customer_name": "Walk-in Customer",
  "phone": "9876543210",
  "email": "optional@email.com",
  "device_type": "Inverter",
  "serial_number": "MG-INV-001234",
  "issue_description": "Device not working",
  "address": "Return shipping address",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001"
}
```

### Walk-in Ticket Number Format
`MG-W-YYYYMMDD-XXXXX`

---

## Warranty Management

### Warranty Registration
Customers register warranties with:
- Device type
- Serial number
- Purchase date
- Order ID (Amazon, Flipkart, etc.)
- Invoice upload (PDF/JPG/PNG)

### Warranty Number Format
`MG-W-YYYYMMDD-XXXXX`

### Warranty Statuses
- `pending` - Awaiting approval
- `approved` - Active warranty
- `rejected` - Rejected by admin
- `expired` - Past expiry date

### Warranty Extension
1. Customer requests extension
2. Uploads Amazon review screenshot as proof
3. Admin reviews and approves/rejects
4. Extension periods: 1, 2, 3, 6, or 12 months

### Warranty Fields
```javascript
{
  "id": "uuid",
  "warranty_number": "MG-W-20260321-00001",
  "customer_id": "uuid",
  "customer_name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "device_type": "Inverter",
  "serial_number": "MG-INV-001234",
  "order_id": "AMZ-123456",
  "purchase_date": "2026-01-15",
  "warranty_start_date": "2026-01-15",
  "warranty_end_date": "2027-01-15",
  "invoice_file": "/uploads/warranty_invoices/invoice.pdf",
  "status": "approved",
  "approved_by": "admin_uuid",
  "approved_at": "2026-01-16T10:00:00Z",
  "extension_requested": false,
  "extension_months": 0,
  "extension_status": null,
  "extension_review_file": null,
  "source": "crm|voltdoctor",
  "created_at": "2026-01-15T10:00:00Z"
}
```

### API Endpoints
```
POST /api/warranties - Register warranty (multipart)
GET /api/warranties - List warranties
GET /api/warranties/{id} - Get warranty details
PATCH /api/warranties/{id}/approve - Admin approves
PATCH /api/warranties/{id}/reject - Admin rejects
POST /api/warranties/{id}/request-extension - Customer requests extension
GET /api/admin/warranty-extensions - Get pending extension requests
PATCH /api/admin/warranties/{id}/review-extension - Approve/reject extension
```

---

## Inventory & Production System

### Multi-Firm Architecture
- Each firm has its own GSTIN, address, and contact
- Inventory tracked per-firm
- GST-compliant inter-firm transfers with mandatory invoice numbers

### Firm Model
```javascript
{
  "id": "uuid",
  "name": "MuscleGrid Energy Solutions",
  "gstin": "27AAAAA0000A1Z5",
  "address": "123 Industrial Area",
  "state": "Maharashtra",
  "pincode": "400001",
  "contact_person": "Manager Name",
  "phone": "9876543210",
  "email": "firm@musclegrid.in",
  "is_active": true,
  "created_at": "2026-01-01T00:00:00Z"
}
```

### Master SKU System
- Company-wide product definitions (not per-firm)
- Stock tracked per-firm at Master SKU level
- Platform aliases for multi-channel selling

### Master SKU Model
```javascript
{
  "id": "uuid",
  "name": "MuscleGrid 1000VA Inverter",
  "sku_code": "MG-INV-1000",
  "category": "Inverter|Battery|Stabilizer|Spare Part",
  "hsn_code": "85044090",
  "unit": "PCS",
  "description": "1000VA Pure Sine Wave Inverter",
  "product_type": "manufactured|traded",
  "manufacturing_role": "supervisor|technician|none",
  "production_charge_per_unit": 150.00,
  "is_manufactured": true,
  "bill_of_materials": [
    {"raw_material_id": "uuid", "quantity": 2}
  ],
  "aliases": [
    {"alias_code": "AMZ-INV-001", "platform": "Amazon", "notes": "FBA SKU"},
    {"alias_code": "FK-INV-001", "platform": "Flipkart", "notes": ""}
  ],
  "reorder_level": 10,
  "is_active": true,
  "created_at": "2026-01-01T00:00:00Z"
}
```

### Raw Materials
- Global definitions (no firm_id)
- Stock tracked per-firm via inventory ledger

### Raw Material Model
```javascript
{
  "id": "uuid",
  "name": "Transformer 100VA",
  "sku_code": "RM-TRANS-100",
  "unit": "PCS",
  "hsn_code": "85043100",
  "reorder_level": 50,
  "created_at": "2026-01-01T00:00:00Z"
}
```

### Inventory Ledger (Immutable)
All stock changes go through the ledger - no direct edits allowed.

### Ledger Entry Types
| Type | Description | Quantity |
|------|-------------|----------|
| `purchase` | Stock purchased | + |
| `transfer_in` | Received from another firm | + |
| `transfer_out` | Sent to another firm | - |
| `adjustment_in` | Manual addition (reason mandatory) | + |
| `adjustment_out` | Manual reduction (reason mandatory) | - |
| `dispatch_out` | Dispatched to customer | - |
| `return_in` | Returned from customer | + |
| `repair_yard_in` | Added to repair yard (reason mandatory) | + |
| `production_consume` | Raw material consumed in production | - |
| `production_output` | Finished goods produced | + |

### Inventory Ledger Model
```javascript
{
  "id": "uuid",
  "entry_number": "LED-20260321-00001",
  "entry_type": "purchase",
  "item_type": "raw_material|master_sku",
  "item_id": "uuid",
  "item_name": "Transformer 100VA",
  "firm_id": "uuid",
  "firm_name": "MuscleGrid Energy Solutions",
  "quantity": 100,
  "running_balance": 150,
  "invoice_number": "INV-001",
  "reference_id": "purchase_order_uuid",
  "reason": "Initial stock purchase",
  "created_by": "user_uuid",
  "created_by_name": "Admin User",
  "created_at": "2026-03-21T10:00:00Z"
}
```

### Stock Transfers
GST-compliant inter-firm transfers with mandatory invoice.

### Stock Transfer Model
```javascript
{
  "id": "uuid",
  "transfer_number": "TRF-20260321-00001",
  "item_type": "raw_material|master_sku",
  "item_id": "uuid",
  "item_name": "MG-INV-1000",
  "from_firm_id": "uuid",
  "from_firm_name": "Firm A",
  "to_firm_id": "uuid",
  "to_firm_name": "Firm B",
  "quantity": 10,
  "invoice_number": "GST-INV-001",
  "serial_numbers": ["MG-001", "MG-002"],
  "ledger_out_id": "uuid",
  "ledger_in_id": "uuid",
  "created_by": "user_uuid",
  "created_at": "2026-03-21T10:00:00Z"
}
```

### Production System

#### Production Request Workflow
1. **Accountant creates request** - Select firm, manufactured SKU, quantity
2. **Request routes to role** - Based on manufacturing_role (supervisor/technician)
3. **Manufacturer accepts** - Job appears in their queue
4. **Manufacturer starts** - Status: in_progress
5. **Manufacturer completes** - Must enter ALL serial numbers (unique)
6. **Accountant confirms receipt** - Triggers:
   - Raw material consumption ledger entries
   - Finished goods production output ledger entries
   - Serial number records in finished_good_serials
   - Supervisor payable creation (if supervisor-made)

### Production Request Model
```javascript
{
  "id": "uuid",
  "request_number": "PRD-20260321-00001",
  "firm_id": "uuid",
  "firm_name": "MuscleGrid Energy Solutions",
  "master_sku_id": "uuid",
  "sku_code": "MG-INV-1000",
  "product_name": "MuscleGrid 1000VA Inverter",
  "quantity": 10,
  "target_date": "2026-03-25",
  "status": "pending|accepted|in_progress|completed|received|cancelled",
  "assigned_to": "user_uuid",
  "assigned_to_name": "Supervisor Name",
  "manufacturing_role": "supervisor|technician",
  "serial_numbers": ["MG-001", "MG-002", ...],
  "use_bom": true,
  "materials_used": [
    {"raw_material_id": "uuid", "name": "Transformer", "quantity": 20}
  ],
  "notes": "Urgent order",
  "created_by": "user_uuid",
  "created_at": "2026-03-21T10:00:00Z",
  "accepted_at": null,
  "started_at": null,
  "completed_at": null,
  "received_at": null
}
```

### Finished Good Serials
Each manufactured unit gets a unique serial number.

```javascript
{
  "id": "uuid",
  "serial_number": "MG-INV-1000-20260321-001",
  "master_sku_id": "uuid",
  "sku_code": "MG-INV-1000",
  "product_name": "MuscleGrid 1000VA Inverter",
  "firm_id": "uuid",
  "firm_name": "MuscleGrid Energy Solutions",
  "production_request_id": "uuid",
  "produced_by": "user_uuid",
  "produced_by_name": "Supervisor Name",
  "condition": "new|repaired",
  "status": "in_stock|dispatched|returned",
  "dispatch_id": null,
  "created_at": "2026-03-21T10:00:00Z"
}
```

### Supervisor Payables
Automatic payment tracking for supervisor-manufactured items.

```javascript
{
  "id": "uuid",
  "supervisor_id": "uuid",
  "supervisor_name": "Supervisor Name",
  "production_request_id": "uuid",
  "sku_code": "MG-INV-1000",
  "product_name": "MuscleGrid 1000VA Inverter",
  "quantity": 10,
  "rate_per_unit": 150.00,
  "total_amount": 1500.00,
  "amount_paid": 0,
  "status": "unpaid|part_paid|paid",
  "payments": [
    {
      "amount": 500,
      "date": "2026-03-22",
      "reference": "CHQ-001",
      "notes": "Partial payment",
      "recorded_by": "admin_uuid",
      "recorded_at": "2026-03-22T10:00:00Z"
    }
  ],
  "created_at": "2026-03-21T10:00:00Z"
}
```

### Inventory API Endpoints
```
# Firms
GET /api/firms - List all firms
POST /api/firms - Create firm
PATCH /api/firms/{id} - Update firm

# Raw Materials
GET /api/raw-materials - List all raw materials
POST /api/raw-materials - Create raw material
PATCH /api/raw-materials/{id} - Update raw material

# Master SKUs
GET /api/master-skus - List all Master SKUs
GET /api/master-skus/{id} - Get specific Master SKU
POST /api/master-skus - Create Master SKU
PATCH /api/master-skus/{id} - Update Master SKU (including BOM)
POST /api/master-skus/{id}/aliases - Add platform alias
DELETE /api/master-skus/{id}/aliases/{code} - Remove alias
GET /api/master-skus/{id}/stock - Get stock by firm for specific SKU
GET /api/master-skus/stock/all - Get stock for all SKUs

# Inventory Ledger
POST /api/inventory/ledger - Create ledger entry (THE ONLY way to change stock)
GET /api/inventory/stock - Get current stock
GET /api/inventory/stock-by-firm - Get stock grouped by firm

# Stock Transfers
POST /api/inventory/transfer - Create inter-firm transfer (invoice mandatory)

# Production
POST /api/production-requests - Create production request
GET /api/production-requests - List with role-based filtering
GET /api/production-requests/{id} - Get specific request
PUT /api/production-requests/{id}/accept - Accept job
PUT /api/production-requests/{id}/start - Start production
PUT /api/production-requests/{id}/complete - Complete with serial numbers
PUT /api/production-requests/{id}/receive - Receive into inventory
PUT /api/production-requests/{id}/cancel - Cancel request

# Supervisor Payables
GET /api/supervisor-payables - List payables with summary
PUT /api/supervisor-payables/{id}/payment - Record payment

# Serial Numbers
GET /api/finished-good-serials - List serial numbers
GET /api/finished-good-serials/available/{master_sku_id} - Get available for dispatch
```

---

## Dispatch Management

### Dispatch Types
- `new_order` - Fresh sale to customer
- `spare_part` - Replacement part shipment
- `repair_return` - Repaired item returning to customer
- `reverse_pickup` - Pickup label for customer to ship item

### Dispatch Statuses
- `pending_label` - Waiting for shipping label
- `ready_for_dispatch` - Label uploaded, ready to ship
- `dispatched` - Shipped out
- `delivered` - Delivered to customer

### Dispatch Model
```javascript
{
  "id": "uuid",
  "dispatch_number": "DSP-20260321-00001",
  "dispatch_type": "new_order|spare_part|repair_return|reverse_pickup",
  "ticket_id": "uuid",
  "ticket_number": "MG-R-20260321-01602",
  "customer_id": "uuid",
  "customer_name": "John Doe",
  "customer_phone": "9876543210",
  "customer_email": "john@example.com",
  "shipping_address": "123 Main St, Mumbai",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "firm_id": "uuid",
  "master_sku_id": "uuid",
  "sku_code": "MG-INV-1000",
  "product_name": "MuscleGrid 1000VA Inverter",
  "serial_number": "MG-INV-1000-20260321-001",
  "order_id": "AMZ-123456",
  "is_amazon_order": true,
  "payment_reference": "PAY-001",
  "invoice_file": "/uploads/dispatches/invoice.pdf",
  "label_file": "/uploads/dispatches/label.pdf",
  "courier": "Delhivery|BlueDart|DTDC|FedEx|India Post",
  "tracking_id": "DEL123456789",
  "status": "pending_label",
  "dispatched_by": "user_uuid",
  "dispatched_at": null,
  "stock_deducted": false,
  "ledger_entry_id": null,
  "created_by": "user_uuid",
  "created_at": "2026-03-21T10:00:00Z"
}
```

### Stock Deduction Rule
- Stock deducts ONLY when dispatcher marks dispatch as "dispatched"
- Creates `dispatch_out` ledger entry
- Validates stock availability before dispatch

### Amazon Order Feedback
When an Amazon order is dispatched:
1. Feedback call task automatically created
2. Call support must call customer
3. Upload screenshot proof of feedback
4. Track call attempts

### Dispatcher TV Mode
- Large display mode for warehouse
- Auto-refresh every 10 seconds
- Shows ready-to-dispatch items
- Optimized for visibility from distance

### Dispatch API Endpoints
```
POST /api/dispatches - Create dispatch
GET /api/dispatches - List dispatches
GET /api/dispatches/{id} - Get dispatch details
PATCH /api/dispatches/{id}/label - Upload shipping label
PATCH /api/dispatches/{id}/status - Update status (dispatch triggers stock deduction)
GET /api/dispatcher/queue - Get dispatcher queue
GET /api/dispatcher/recent - Get recent dispatches
```

---

## Gate Scanning System

### Scan Types
- **Inward:** Parcel arriving at factory
- **Outward:** Parcel leaving factory

### Gate Scan Flow

#### Inward Scan
1. Gate operator scans tracking ID or selects from expected list
2. System creates `incoming_queue` entry
3. Status changes to "received_at_factory" for linked tickets
4. Accountant must classify the item

#### Outward Scan
1. Gate operator scans tracking ID or selects from ready list
2. System records outward scan
3. Status changes to "dispatched" for linked tickets

### Gate Log Model
```javascript
{
  "id": "uuid",
  "scan_type": "inward|outward",
  "tracking_id": "DEL123456789",
  "courier": "Delhivery",
  "ticket_id": "uuid",
  "ticket_number": "MG-R-20260321-01602",
  "dispatch_id": "uuid",
  "dispatch_number": "DSP-20260321-00001",
  "customer_name": "John Doe",
  "notes": "Package in good condition",
  "scanned_by": "user_uuid",
  "scanned_by_name": "Gate Operator",
  "scanned_at": "2026-03-21T10:00:00Z"
}
```

### Supported Couriers
- Delhivery
- BlueDart
- DTDC
- FedEx
- India Post
- Ekart
- Shadowfax
- Xpressbees

### Gate API Endpoints
```
POST /api/gate/scan - Record gate scan
GET /api/gate/logs - Get gate scan logs
GET /api/gate/scheduled - Get scheduled incoming/outgoing
```

---

## Incoming Queue & Classification

### Purpose
Gate scans create queue entries - stock only changes after accountant classification.

### Classification Types

| Type | Action | Stock Impact |
|------|--------|--------------|
| `repair_item` | Links to ticket, sends to technician | None |
| `return_inventory` | Creates `return_in` ledger entry | + Increase |
| `repair_yard` | Creates `repair_yard_in` entry | + Increase |
| `scrap` | Marks as dead stock | None |

### Incoming Queue Model
```javascript
{
  "id": "uuid",
  "gate_log_id": "uuid",
  "tracking_id": "DEL123456789",
  "courier": "Delhivery",
  "customer_name": "John Doe",
  "customer_phone": "9876543210",
  "ticket_id": "uuid",
  "ticket_number": "MG-R-20260321-01602",
  "status": "pending|processed",
  "classification": null,
  "classification_data": {
    "firm_id": "uuid",
    "item_type": "master_sku",
    "item_id": "uuid",
    "quantity": 1,
    "reason": "Customer return - defective"
  },
  "processed_by": null,
  "processed_at": null,
  "created_at": "2026-03-21T10:00:00Z"
}
```

### API Endpoints
```
GET /api/incoming-queue - List queue entries with filters
GET /api/incoming-queue/pending-count - Pending items count
POST /api/incoming-queue - Manual entry creation
POST /api/incoming-queue/{id}/classify - Process classification
```

---

## Supervisor Module

### Dashboard Features

#### Stats Cards
- Escalated tickets
- Customer escalated (urgent - 48h no update)
- Urgent (SLA breach)
- Resolved today

#### Escalated Tickets Queue
- Tickets escalated by call support
- SLA countdown timer
- Customer escalated tickets highlighted in red

#### Actions Available
- **Resolve:** Mark as resolved with notes
- **Send Spare Part:** Specify SKU, creates accountant task
- **Arrange Reverse Pickup:** Creates accountant task for pickup label

### Warranty Approval
- Review pending warranty registrations
- View customer invoice before approving
- Approve or reject with notes

### Appointment Management
See [Appointment Booking System](#appointment-booking-system)

### API Endpoints
```
GET /api/supervisor/queue - Get escalated tickets
GET /api/supervisor/stats - Supervisor dashboard stats
POST /api/tickets/{id}/supervisor-action - Take action (resolve, spare_dispatch, reverse_pickup)
```

---

## Pending Fulfillment Queue

### Purpose
Track Amazon orders where shipping labels are created before stock is available.

### Features
- Label expiry management (5-day expiry)
- Auto-detect when stock becomes available
- Tracking ID regeneration without losing history
- Prevent dispatch if no stock

### Status Flow
```
label_created → awaiting_stock → ready_to_dispatch → dispatched
```

### Pending Fulfillment Model
```javascript
{
  "id": "uuid",
  "order_id": "AMZ-123456",
  "customer_name": "John Doe",
  "customer_phone": "9876543210",
  "master_sku_id": "uuid",
  "sku_code": "MG-INV-1000",
  "product_name": "MuscleGrid 1000VA Inverter",
  "firm_id": "uuid",
  "quantity": 1,
  "status": "awaiting_stock",
  "label_file": "/uploads/labels/label.pdf",
  "label_created_at": "2026-03-21T10:00:00Z",
  "label_expires_at": "2026-03-26T10:00:00Z",
  "tracking_history": [
    {
      "tracking_id": "DEL123456789",
      "created_at": "2026-03-21T10:00:00Z",
      "expired": true
    }
  ],
  "current_tracking_id": "DEL987654321",
  "dispatch_id": null,
  "created_by": "user_uuid",
  "created_at": "2026-03-21T10:00:00Z"
}
```

---

## Analytics & Reporting

### Agent Performance Analytics

#### Metrics Tracked
- Total tickets handled
- Closed tickets count
- Phone vs Hardware breakdown
- SLA breaches per agent
- Average resolution time (hours)
- SLA compliance rate %
- Feedback calls completed
- Customer feedback ratings

#### Top Performers Leaderboard
Composite Performance Score (0-100):
- Customer feedback rating: 40% weight
- Tickets closed: 30% weight
- Resolution speed (faster is better): 20% weight
- Feedback calls completed: 10% weight

#### Charts
- Pie Chart: Support Type Distribution (Phone/Hardware/Escalated)
- Pie Chart: SLA Performance (Within SLA/Breached)
- Pie Chart: Team Workload (Tickets per Agent)
- Bar Chart: Tickets Handled by Agent
- Bar Chart: Avg Resolution Time (hours)

### Stock Reports

#### Report Types
1. **Stock Ledger** - All entries with Entry #, Date, Type, Item, Firm, Qty, Balance, Invoice/Ref, Reason, By
2. **Current Stock** - Raw Materials, Finished Goods by Firm with Low Stock alerts
3. **Transfers** - Inter-firm transfers with invoice numbers
4. **Dispatch & Returns** - Side-by-side comparison
5. **Adjustments** - With mandatory reasons

#### Filters
- Firm
- Entry Type
- Date Range

#### Export
- CSV export for all report types

### Activity Logs (Admin)
- Comprehensive audit trail of all organization actions
- Stats: Total logs, Today's activity, This week, Active users
- Action Types: Dispatch, Production, Inventory, Gate scans, Payments, etc.
- Filtering by action type, entity type, user, date range
- Expandable JSON details for each action

### Report API Endpoints
```
GET /api/reports/stock-ledger - Ledger entries with filters
GET /api/reports/current-stock - Current stock by firm
GET /api/reports/transfers - Inter-firm transfer report
GET /api/reports/dispatch-return - Dispatch and return report
GET /api/reports/adjustments - Adjustments report
GET /api/reports/export/csv - CSV export
GET /api/admin/agent-performance - Agent analytics
GET /api/admin/activity-logs - Activity logs with filters
```

---

## Appointment Booking System

### Customer Features
- Book 30-minute appointments with supervisors
- View calendar for date selection
- See available time slots
- Tabs: Book New | Upcoming | Past appointments
- Booking confirmation with reason field

### Supervisor Features
- Calendar view of appointments
- Manage availability (working hours per day, Mon-Sun)
- Default hours: 9am-7pm
- Confirm/cancel appointments
- Mark complete or no-show

### Appointment Model
```javascript
{
  "id": "uuid",
  "customer_id": "uuid",
  "customer_name": "John Doe",
  "customer_phone": "9876543210",
  "supervisor_id": "uuid",
  "supervisor_name": "Supervisor Name",
  "date": "2026-03-25",
  "time_slot": "10:00",
  "duration_minutes": 30,
  "reason": "Discuss warranty claim",
  "status": "pending|confirmed|completed|cancelled|no_show",
  "notes": "Customer has valid warranty",
  "created_at": "2026-03-21T10:00:00Z"
}
```

### Supervisor Availability Model
```javascript
{
  "supervisor_id": "uuid",
  "availability": {
    "monday": {"start": "09:00", "end": "19:00", "enabled": true},
    "tuesday": {"start": "09:00", "end": "19:00", "enabled": true},
    "wednesday": {"start": "09:00", "end": "19:00", "enabled": true},
    "thursday": {"start": "09:00", "end": "19:00", "enabled": true},
    "friday": {"start": "09:00", "end": "19:00", "enabled": true},
    "saturday": {"start": "09:00", "end": "13:00", "enabled": true},
    "sunday": {"start": "00:00", "end": "00:00", "enabled": false}
  }
}
```

---

## Customer Feedback System

### Feedback Survey
Triggered when ticket is closed/resolved:
- Communication rating (1-10 stars)
- Resolution Speed rating (1-10 stars)
- Professionalism rating (1-10 stars)
- Overall Experience rating (1-10 stars)
- Optional comments

### Feedback Model
```javascript
{
  "id": "uuid",
  "ticket_id": "uuid",
  "ticket_number": "MG-R-20260321-01602",
  "customer_id": "uuid",
  "customer_name": "John Doe",
  "staff_id": "uuid",
  "staff_name": "Support Agent",
  "staff_role": "call_support",
  "communication": 8,
  "resolution_speed": 9,
  "professionalism": 8,
  "overall": 9,
  "comments": "Great service, quick resolution!",
  "created_at": "2026-03-21T10:00:00Z"
}
```

### Amazon Feedback Calls
- Auto-created when Amazon order dispatched
- Call support must call customer
- Upload screenshot proof
- Track call attempts
- "No Answer" option to retry

### Feedback Call Model
```javascript
{
  "id": "uuid",
  "dispatch_id": "uuid",
  "dispatch_number": "DSP-20260321-00001",
  "order_id": "AMZ-123456",
  "customer_name": "John Doe",
  "phone": "9876543210",
  "sku": "MG-INV-1000",
  "status": "pending|completed|no_answer",
  "call_attempts": 1,
  "screenshot": "/uploads/feedback_calls/screenshot.jpg",
  "notes": "Customer satisfied with delivery",
  "completed_by": "user_uuid",
  "completed_at": "2026-03-22T10:00:00Z",
  "created_at": "2026-03-21T10:00:00Z"
}
```

---

## Data Management & Migration

### Admin Data Management Page
Located at `/admin/data-management`

### Features
- Full data export (all collections)
- Data import with validation
- Collection selection

### Bootstrap Endpoint
For fresh database setup:
```
GET /api/setup/initialize
```
Creates default users:
- Admin: admin@musclegrid.in
- Call Support: callsupport@musclegrid.in
- Dispatcher: dispatcher@musclegrid.in
- And other role users

### Export/Import API
```
GET /api/admin/export-data - Export all data as JSON
POST /api/admin/import-data - Import data from JSON
```

### CSV Import Scripts
Located in `/app/backend/`:
- `import_sql_data.py` - Import from legacy PHP/MySQL system
- `import_battery_data.py` - Import battery production records

---

## Complete API Reference

### Authentication
```
POST /api/auth/register - Register new customer
POST /api/auth/login - Login
GET /api/auth/me - Get current user
PATCH /api/auth/me - Update profile
```

### Tickets
```
POST /api/tickets - Create ticket (multipart with invoice)
GET /api/tickets - List tickets (role-filtered, with search, pagination)
GET /api/tickets/{id} - Get ticket details
PATCH /api/tickets/{id} - Update ticket
POST /api/tickets/{id}/route-to-hardware - Route to hardware service
POST /api/tickets/{id}/escalate-to-supervisor - Escalate to supervisor
POST /api/tickets/{id}/supervisor-action - Supervisor action
POST /api/tickets/{id}/customer-escalate - Customer escalates
POST /api/tickets/{id}/upload-pickup-label - Upload reverse pickup label
POST /api/tickets/{id}/mark-received - Gate marks as received
POST /api/tickets/{id}/start-repair - Technician starts repair
POST /api/tickets/{id}/complete-repair - Technician completes repair
POST /api/tickets/{id}/add-service-invoice - Accountant adds charges
POST /api/tickets/{id}/upload-return-label - Accountant uploads return label
POST /api/tickets/{id}/mark-dispatched - Dispatcher marks as shipped
GET /api/tickets/{id}/customer-history - Get customer's full history
POST /api/tickets/{id}/reply - Reply to ticket
```

### Warranties
```
POST /api/warranties - Register warranty
GET /api/warranties - List warranties
GET /api/warranties/{id} - Get warranty details
PATCH /api/warranties/{id}/approve - Admin approves
PATCH /api/warranties/{id}/reject - Admin rejects
POST /api/warranties/{id}/request-extension - Request extension
GET /api/admin/warranty-extensions - Get pending extensions
PATCH /api/admin/warranties/{id}/review-extension - Review extension
```

### Dispatches
```
POST /api/dispatches - Create dispatch
GET /api/dispatches - List dispatches
GET /api/dispatches/{id} - Get dispatch details
PATCH /api/dispatches/{id}/label - Upload label
PATCH /api/dispatches/{id}/status - Update status
GET /api/dispatcher/queue - Get dispatcher queue
GET /api/dispatcher/recent - Get recent dispatches
```

### Gate
```
POST /api/gate/scan - Record gate scan
GET /api/gate/logs - Get gate scan logs
GET /api/gate/scheduled - Get scheduled items
```

### Inventory
```
GET /api/firms - List firms
POST /api/firms - Create firm
PATCH /api/firms/{id} - Update firm
GET /api/raw-materials - List raw materials
POST /api/raw-materials - Create raw material
PATCH /api/raw-materials/{id} - Update raw material
GET /api/master-skus - List Master SKUs
POST /api/master-skus - Create Master SKU
PATCH /api/master-skus/{id} - Update Master SKU
POST /api/inventory/ledger - Create ledger entry
GET /api/inventory/stock - Get current stock
POST /api/inventory/transfer - Create transfer
```

### Production
```
POST /api/production-requests - Create request
GET /api/production-requests - List requests
PUT /api/production-requests/{id}/accept - Accept job
PUT /api/production-requests/{id}/start - Start production
PUT /api/production-requests/{id}/complete - Complete with serials
PUT /api/production-requests/{id}/receive - Receive into inventory
GET /api/supervisor-payables - List payables
PUT /api/supervisor-payables/{id}/payment - Record payment
GET /api/finished-good-serials - List serials
```

### Search
```
GET /api/customers/search - Global customer search
```

### Admin
```
GET /api/admin/stats - Dashboard statistics
GET /api/admin/customers - List all customers
GET /api/admin/users - List staff users
POST /api/admin/users - Create staff user
PATCH /api/admin/users/{id} - Update user
GET /api/admin/agent-performance - Agent analytics
GET /api/admin/activity-logs - Activity logs
GET /api/admin/export-data - Export all data
POST /api/admin/import-data - Import data
GET /api/admin/feedback-call-performance - Feedback call stats
```

### Reports
```
GET /api/reports/stock-ledger - Stock ledger
GET /api/reports/current-stock - Current stock
GET /api/reports/transfers - Transfer report
GET /api/reports/dispatch-return - Dispatch/return report
GET /api/reports/adjustments - Adjustments report
GET /api/reports/export/csv - CSV export
```

### Technician
```
GET /api/technician/queue - Repair queue
GET /api/technician/my-repairs - Assigned repairs
POST /api/technician/walkin - Create walk-in ticket
```

### Supervisor
```
GET /api/supervisor/queue - Escalated tickets
GET /api/supervisor/stats - Dashboard stats
```

### Customer
```
GET /api/customer/timeline/{ticket_id} - Ticket timeline
GET /api/stats - Customer stats
```

### Feedback
```
GET /api/feedback-calls - Get feedback calls
PATCH /api/feedback-calls/{id} - Update feedback call
POST /api/feedback - Submit feedback survey
```

### Appointments
```
GET /api/appointments - List appointments
POST /api/appointments - Book appointment
PATCH /api/appointments/{id} - Update appointment
GET /api/supervisor/availability - Get availability
PUT /api/supervisor/availability - Set availability
```

### Setup
```
GET /api/setup/initialize - Bootstrap database with default users
```

---

## Database Schema

### Collections

#### users
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  email: String (unique),
  password_hash: String,
  first_name: String,
  last_name: String,
  phone: String,
  role: String (enum: ROLES),
  address: String,
  city: String,
  state: String,
  pincode: String,
  is_active: Boolean,
  created_at: DateTime
}
```

#### tickets
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  ticket_number: String,
  customer_id: String,
  customer_name: String,
  customer_email: String,
  customer_phone: String,
  device_type: String,
  serial_number: String,
  order_id: String,
  invoice_number: String,
  invoice_file: String,
  issue_description: String,
  diagnosis: String,
  support_type: String,
  status: String,
  assigned_to: String,
  sla_due: DateTime,
  sla_breached: Boolean,
  source: String,
  pickup_label: String,
  service_invoice: String,
  board_serial_number: String,
  inverter_serial_number: String,
  repair_notes: String,
  agent_notes: String,
  supervisor_notes: String,
  history: Array,
  created_at: DateTime,
  updated_at: DateTime,
  closed_at: DateTime,
  received_at: DateTime,
  repaired_at: DateTime,
  dispatched_at: DateTime
}
```

#### warranties
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  warranty_number: String,
  customer_id: String,
  customer_name: String,
  email: String,
  phone: String,
  device_type: String,
  serial_number: String,
  order_id: String,
  purchase_date: String,
  warranty_start_date: String,
  warranty_end_date: String,
  invoice_file: String,
  status: String,
  approved_by: String,
  approved_at: DateTime,
  extension_requested: Boolean,
  extension_months: Number,
  extension_status: String,
  extension_review_file: String,
  source: String,
  created_at: DateTime
}
```

#### dispatches
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  dispatch_number: String,
  dispatch_type: String,
  ticket_id: String,
  ticket_number: String,
  customer_id: String,
  customer_name: String,
  customer_phone: String,
  customer_email: String,
  shipping_address: String,
  city: String,
  state: String,
  pincode: String,
  firm_id: String,
  master_sku_id: String,
  sku_code: String,
  product_name: String,
  serial_number: String,
  order_id: String,
  is_amazon_order: Boolean,
  payment_reference: String,
  invoice_file: String,
  label_file: String,
  courier: String,
  tracking_id: String,
  status: String,
  dispatched_by: String,
  dispatched_at: DateTime,
  stock_deducted: Boolean,
  ledger_entry_id: String,
  created_by: String,
  created_at: DateTime
}
```

#### gate_logs
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  scan_type: String,
  tracking_id: String,
  courier: String,
  ticket_id: String,
  ticket_number: String,
  dispatch_id: String,
  dispatch_number: String,
  customer_name: String,
  notes: String,
  scanned_by: String,
  scanned_by_name: String,
  scanned_at: DateTime
}
```

#### firms
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  name: String,
  gstin: String,
  address: String,
  state: String,
  pincode: String,
  contact_person: String,
  phone: String,
  email: String,
  is_active: Boolean,
  created_at: DateTime
}
```

#### raw_materials
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  name: String,
  sku_code: String,
  unit: String,
  hsn_code: String,
  reorder_level: Number,
  created_at: DateTime
}
```

#### master_skus
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  name: String,
  sku_code: String,
  category: String,
  hsn_code: String,
  unit: String,
  description: String,
  product_type: String,
  manufacturing_role: String,
  production_charge_per_unit: Number,
  is_manufactured: Boolean,
  bill_of_materials: Array,
  aliases: Array,
  reorder_level: Number,
  is_active: Boolean,
  created_at: DateTime
}
```

#### inventory_ledger
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  entry_number: String,
  entry_type: String,
  item_type: String,
  item_id: String,
  item_name: String,
  firm_id: String,
  firm_name: String,
  quantity: Number,
  running_balance: Number,
  invoice_number: String,
  reference_id: String,
  reason: String,
  created_by: String,
  created_by_name: String,
  created_at: DateTime
}
```

#### stock_transfers
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  transfer_number: String,
  item_type: String,
  item_id: String,
  item_name: String,
  from_firm_id: String,
  from_firm_name: String,
  to_firm_id: String,
  to_firm_name: String,
  quantity: Number,
  invoice_number: String,
  serial_numbers: Array,
  ledger_out_id: String,
  ledger_in_id: String,
  created_by: String,
  created_at: DateTime
}
```

#### production_requests
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  request_number: String,
  firm_id: String,
  firm_name: String,
  master_sku_id: String,
  sku_code: String,
  product_name: String,
  quantity: Number,
  target_date: String,
  status: String,
  assigned_to: String,
  assigned_to_name: String,
  manufacturing_role: String,
  serial_numbers: Array,
  use_bom: Boolean,
  materials_used: Array,
  notes: String,
  created_by: String,
  created_at: DateTime,
  accepted_at: DateTime,
  started_at: DateTime,
  completed_at: DateTime,
  received_at: DateTime
}
```

#### finished_good_serials
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  serial_number: String,
  master_sku_id: String,
  sku_code: String,
  product_name: String,
  firm_id: String,
  firm_name: String,
  production_request_id: String,
  produced_by: String,
  produced_by_name: String,
  condition: String,
  status: String,
  dispatch_id: String,
  created_at: DateTime
}
```

#### supervisor_payables
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  supervisor_id: String,
  supervisor_name: String,
  production_request_id: String,
  sku_code: String,
  product_name: String,
  quantity: Number,
  rate_per_unit: Number,
  total_amount: Number,
  amount_paid: Number,
  status: String,
  payments: Array,
  created_at: DateTime
}
```

#### feedback
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  ticket_id: String,
  ticket_number: String,
  customer_id: String,
  customer_name: String,
  staff_id: String,
  staff_name: String,
  staff_role: String,
  communication: Number,
  resolution_speed: Number,
  professionalism: Number,
  overall: Number,
  comments: String,
  created_at: DateTime
}
```

#### feedback_calls
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  dispatch_id: String,
  dispatch_number: String,
  order_id: String,
  customer_name: String,
  phone: String,
  sku: String,
  status: String,
  call_attempts: Number,
  screenshot: String,
  notes: String,
  completed_by: String,
  completed_at: DateTime,
  created_at: DateTime
}
```

#### appointments
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  customer_id: String,
  customer_name: String,
  customer_phone: String,
  supervisor_id: String,
  supervisor_name: String,
  date: String,
  time_slot: String,
  duration_minutes: Number,
  reason: String,
  status: String,
  notes: String,
  created_at: DateTime
}
```

#### supervisor_availability
```javascript
{
  _id: ObjectId,
  supervisor_id: String,
  availability: Object
}
```

#### audit_logs
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  action: String,
  entity_type: String,
  entity_id: String,
  user_id: String,
  user_name: String,
  user_role: String,
  details: Object,
  timestamp: DateTime
}
```

#### incoming_queue
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  gate_log_id: String,
  tracking_id: String,
  courier: String,
  customer_name: String,
  customer_phone: String,
  ticket_id: String,
  ticket_number: String,
  status: String,
  classification: String,
  classification_data: Object,
  processed_by: String,
  processed_at: DateTime,
  created_at: DateTime
}
```

#### pending_fulfillment
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  order_id: String,
  customer_name: String,
  customer_phone: String,
  master_sku_id: String,
  sku_code: String,
  product_name: String,
  firm_id: String,
  quantity: Number,
  status: String,
  label_file: String,
  label_created_at: DateTime,
  label_expires_at: DateTime,
  tracking_history: Array,
  current_tracking_id: String,
  dispatch_id: String,
  created_by: String,
  created_at: DateTime
}
```

---

## File Structure

```
/app/
├── backend/
│   ├── server.py                    # Main FastAPI application (9700+ lines)
│   ├── requirements.txt             # Python dependencies
│   ├── .env                         # Environment variables (MONGO_URL, SECRET_KEY)
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py               # Pydantic models
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── helpers.py               # JWT, password, SLA utilities
│   │   └── database.py              # MongoDB connection
│   ├── routers/                     # Ready for future route splitting
│   │   └── __init__.py
│   ├── tests/
│   │   ├── test_crm_api.py
│   │   └── test_call_support_features.py
│   ├── import_sql_data.py           # SQL import script
│   ├── import_battery_data.py       # Battery data import
│   ├── migrate_data.py              # Data migration script
│   └── uploads/
│       ├── invoices/
│       ├── labels/
│       ├── pickup_labels/
│       ├── reviews/
│       ├── service_invoices/
│       ├── warranty_invoices/
│       ├── dispatches/
│       └── feedback_calls/
│
├── frontend/
│   ├── src/
│   │   ├── App.js                   # Main router with role-based access
│   │   ├── components/
│   │   │   ├── ui/                  # Shadcn components
│   │   │   ├── layout/
│   │   │   │   └── DashboardLayout.jsx
│   │   │   └── dashboard/
│   │   │       └── StatCard.jsx
│   │   └── pages/
│   │       ├── admin/
│   │       │   ├── AdminDashboard.jsx
│   │       │   ├── AdminTickets.jsx
│   │       │   ├── AdminTicketDetail.jsx
│   │       │   ├── AdminGateLogs.jsx
│   │       │   ├── AdminAnalytics.jsx
│   │       │   ├── AdminCustomers.jsx
│   │       │   ├── AdminWarranties.jsx
│   │       │   ├── AdminUsers.jsx
│   │       │   ├── AdminFirms.jsx
│   │       │   ├── AdminMasterSKU.jsx
│   │       │   ├── AdminReports.jsx
│   │       │   ├── AdminRepairs.jsx
│   │       │   ├── AdminOrders.jsx
│   │       │   ├── AdminActivityLogs.jsx
│   │       │   └── AdminDataManagement.jsx
│   │       ├── customer/
│   │       │   ├── CustomerDashboard.jsx
│   │       │   ├── CustomerTickets.jsx
│   │       │   ├── CreateTicket.jsx
│   │       │   ├── CustomerWarranties.jsx
│   │       │   └── CustomerAppointments.jsx
│   │       ├── support/
│   │       │   └── CallSupportDashboard.jsx
│   │       ├── supervisor/
│   │       │   ├── SupervisorDashboard.jsx
│   │       │   ├── SupervisorWarranties.jsx
│   │       │   └── SupervisorCalendar.jsx
│   │       ├── accountant/
│   │       │   ├── AccountantDashboard.jsx
│   │       │   ├── AccountantInventory.jsx
│   │       │   ├── ProductionRequests.jsx
│   │       │   └── IncomingQueue.jsx
│   │       ├── dispatcher/
│   │       │   ├── DispatcherDashboard.jsx
│   │       │   └── DispatcherTV.jsx
│   │       ├── technician/
│   │       │   ├── TechnicianDashboard.jsx
│   │       │   └── TechnicianProduction.jsx
│   │       └── gate/
│   │           └── GateDashboard.jsx
│   ├── package.json
│   └── .env                         # REACT_APP_BACKEND_URL
│
├── memory/
│   └── PRD.md                       # Product Requirements Document
│
├── data_export/
│   └── full_export.json             # Data export for migration
│
└── test_reports/
    └── iteration_*.json             # Test reports
```

---

## Test Credentials

### Staff Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@musclegrid.in | Muscle@846 |
| Call Support | callsupport@musclegrid.in | Muscle@846 |
| Supervisor | supervisor@musclegrid.in | Muscle@846 |
| Accountant | accountant@musclegrid.in | Muscle@846 |
| Dispatcher | dispatcher@musclegrid.in | Muscle@846 |
| Technician | technician@musclegrid.in | Muscle@846 |
| Gate Operator | gate@musclegrid.in | Muscle@846 |

### Customer Accounts
All migrated customers use password: `customer123`

### API Base URL
- Preview: `https://crm-rebuild-11.preview.emergentagent.com`
- Production: `https://crm.musclegrid.in`

---

## Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=musclegrid_crm
SECRET_KEY=your-secret-key-here
RESEND_API_KEY=re_xxxxx (optional - for email)
SENDER_EMAIL=noreply@musclegrid.in (optional)
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://crm-rebuild-11.preview.emergentagent.com/api
```

---

## Notes for Integration

### Key Business Rules
1. **Immutable Ledger:** All inventory changes must go through ledger entries
2. **Mandatory Invoice:** Inter-firm transfers require invoice number
3. **SLA Tracking:** Automatic breach detection and alerts
4. **Serial Number Traceability:** Manufactured items tracked from production to dispatch
5. **Role-Based Access:** Strict separation of concerns between roles
6. **Audit Trail:** All actions logged for compliance

### Data Migration
1. Use `/api/setup/initialize` to bootstrap fresh database
2. Use `/admin/data-management` page to export/import data
3. CSV import scripts available for bulk data

### Email Notifications (Pending)
Email system ready but requires RESEND_API_KEY:
- Ticket created
- Ticket status updated
- Hardware service required
- Warranty approved/rejected
- Dispatch tracking info

---

*Document generated: March 23, 2026*
*MuscleGrid CRM v2.0*

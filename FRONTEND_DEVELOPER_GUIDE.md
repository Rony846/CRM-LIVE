# MuscleGrid CRM - Frontend Developer Guide

## Overview

MuscleGrid CRM is an enterprise-grade Customer Service & Logistics management system for MuscleGrid products (inverters, batteries, stabilizers). It handles the complete customer support lifecycle from ticket creation to product repair and delivery.

**Tech Stack:**
- **Backend:** FastAPI (Python)
- **Frontend:** React.js with Tailwind CSS + Shadcn/UI
- **Database:** MongoDB
- **Authentication:** JWT tokens

**Base API URL:** `${REACT_APP_BACKEND_URL}/api`

---

## User Roles (7 Roles)

| Role | Description |
|------|-------------|
| `customer` | End users who create tickets, register warranties, book appointments |
| `call_support` | First-line support agents handling phone/chat tickets |
| `supervisor` | Escalation handlers, approve warranties, manage appointments |
| `service_agent` (Technician) | Factory technicians who repair products |
| `accountant` | Manages shipping labels, invoices, dispatches |
| `dispatcher` | Handles outbound shipping and gate scanning |
| `admin` | Full system access, user management, analytics |

**Test Credentials (all use password: `Muscle@846`):**
- admin@musclegrid.in
- supervisor@musclegrid.in
- support@musclegrid.in (call_support)
- technician@musclegrid.in (service_agent)
- accountant@musclegrid.in
- dispatcher@musclegrid.in
- ami_t@live.com (customer)

---

## Authentication

### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "customer",
    "phone": "9876543210"
  }
}
```

### Register (Customer)
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "9876543210",
  "address": "123 Main St",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001"
}
```

### Get Current User
```
GET /api/auth/me
Authorization: Bearer <token>
```

**Important:** All API calls (except login/register) require the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## Ticket Management

### Ticket Statuses (Lifecycle)
```
new_request → open → in_progress → diagnosed → 
  → resolved_on_call (phone fix)
  → hardware_service → awaiting_label → label_uploaded → 
    → received_at_factory → in_repair → repair_completed → 
    → service_invoice_added → ready_for_dispatch → dispatched → delivered
```

### Create Ticket
```
POST /api/tickets
Authorization: Bearer <token>

{
  "device_type": "Inverter",  // Inverter, Battery, Stabilizer, Others
  "serial_number": "INV-2024-001",
  "order_id": "AMZ-123456",
  "issue_description": "Device not turning on",
  "support_type": "phone"  // phone, hardware
}
```

### List Tickets (Role-based)
```
GET /api/tickets
GET /api/tickets?status=open
GET /api/tickets?support_type=hardware
GET /api/tickets?search=INV-2024
GET /api/tickets?view_as=accountant  // Admin can view as other roles

Authorization: Bearer <token>
```

### Get Single Ticket
```
GET /api/tickets/{ticket_id}
Authorization: Bearer <token>
```

### Update Ticket (Agent Actions)
```
PATCH /api/tickets/{ticket_id}
Authorization: Bearer <token>

{
  "status": "in_progress",
  "diagnosis": "Battery cells damaged",
  "agent_notes": "Customer reported issue started after power surge"
}
```

---

## Role-Specific Endpoints

### Customer Endpoints

```
GET /api/tickets                          # My tickets
POST /api/tickets                         # Create ticket
GET /api/tickets/{id}                     # View ticket details
POST /api/tickets/{id}/customer-escalate  # Escalate if no response in 48hrs

GET /api/warranties                       # My warranties
POST /api/warranties                      # Register warranty

GET /api/appointments                     # My appointments
POST /api/appointments                    # Book appointment
GET /api/appointments/available-slots?date=2024-03-20  # Get available slots

POST /api/feedback                        # Submit feedback survey
GET /api/customer/timeline/{ticket_id}    # Ticket timeline for tracking
```

### Call Support Endpoints

```
GET /api/tickets                          # Queue (phone + VoltDoctor tickets)
PATCH /api/tickets/{id}                   # Update diagnosis/status
POST /api/tickets/{id}/escalate-to-supervisor
POST /api/tickets/{id}/route-to-hardware  # Send for physical repair
POST /api/tickets/{id}/reply              # Reply to VoltDoctor tickets

GET /api/feedback-calls                   # Amazon order feedback calls
PATCH /api/feedback-calls/{id}            # Complete feedback call
GET /api/call-support/stats               # Dashboard stats
```

### Supervisor Endpoints

```
GET /api/supervisor/queue                 # Escalated tickets
GET /api/supervisor/stats                 # Dashboard stats
POST /api/tickets/{id}/supervisor-action  # Approve/reject hardware

GET /api/supervisor/customer-warranties   # View customer warranty history
GET /api/supervisor/customer-tickets      # View customer ticket history

GET /api/supervisor/availability          # My availability settings
POST /api/supervisor/availability         # Set working hours
GET /api/supervisor/appointments          # My scheduled appointments
PATCH /api/appointments/{id}/status       # Confirm/complete appointments
```

### Technician (Service Agent) Endpoints

```
GET /api/technician/queue                 # Repair queue
GET /api/technician/my-repairs            # My completed repairs

POST /api/technician/walkin-ticket        # Register walk-in customer
POST /api/tickets/{id}/start-repair       # Start repair
POST /api/tickets/{id}/complete-repair    # Complete (requires serial numbers)
  - board_serial_number (required)
  - device_serial_number (required)
  - repair_notes
```

### Accountant Endpoints

```
GET /api/tickets?view_as=accountant       # Hardware tickets needing action
GET /api/dispatches                       # All dispatches

PATCH /api/tickets/{id}/accountant-decision  # reverse_pickup or spare_dispatch
POST /api/tickets/{id}/upload-pickup-label   # Upload pickup label PDF
POST /api/tickets/{id}/add-service-invoice   # Add service charges
POST /api/tickets/{id}/upload-return-label   # Upload return shipping label

POST /api/dispatches                      # Create new outbound dispatch
  - dispatch_type: "new_order" | "amazon_order" | "spare_dispatch"
POST /api/dispatches/from-ticket/{id}     # Create dispatch from ticket
```

### Dispatcher Endpoints

```
GET /api/dispatcher/queue                 # Items ready for dispatch
GET /api/dispatcher/recent                # Recently dispatched items

PATCH /api/dispatches/{id}/status         # Mark as dispatched
PATCH /api/dispatcher/dispatches/{id}/update-courier  # Update courier details

POST /api/gate/scan                       # Scan incoming/outgoing parcels
GET /api/gate/logs                        # Gate scan history
GET /api/gate/scheduled                   # Expected incoming/outgoing
```

### Admin Endpoints

```
# Dashboard & Stats
GET /api/admin/stats                      # System-wide statistics
GET /api/admin/agent-performance          # Agent performance metrics
GET /api/admin/performance-metrics        # Detailed metrics with scores
GET /api/admin/feedback                   # All customer feedback
GET /api/admin/feedback-call-performance  # Amazon feedback call stats

# User Management
GET /api/admin/users                      # All staff users
POST /api/admin/users                     # Create staff user
PATCH /api/admin/users/{id}               # Update user

# Customer Management
GET /api/admin/customers                  # All customers
PATCH /api/admin/customers/{id}           # Update customer info
GET /api/admin/customers/{id}             # Customer details

# Ticket Management
GET /api/admin/tickets                    # All tickets (no role filter)
POST /api/admin/tickets/{id}/close        # Force close any ticket

# Repair Tracking
GET /api/admin/all-repairs                # All repair activities

# Warranty Management
GET /api/admin/warranty-extensions        # Pending extension requests
PATCH /api/admin/warranties/{id}/review-extension

# SKU/Inventory
GET /api/admin/skus                       # Product catalog
POST /api/admin/skus                      # Add product
PATCH /api/admin/skus/{id}                # Update product
POST /api/admin/skus/{id}/adjust-stock    # Adjust inventory

# Dispatch Management
PATCH /api/admin/dispatches/{id}          # Update dispatch
DELETE /api/admin/dispatches/{id}         # Delete dispatch
```

---

## Key Data Models

### Ticket
```json
{
  "id": "uuid",
  "ticket_number": "MG-R-20240320-12345",
  "customer_id": "uuid",
  "customer_name": "John Doe",
  "customer_phone": "9876543210",
  "device_type": "Inverter",
  "serial_number": "INV-2024-001",
  "issue_description": "Device not working",
  "status": "open",
  "support_type": "phone",
  "priority": "medium",
  "diagnosis": "Battery issue",
  "agent_notes": "...",
  "supervisor_notes": "...",
  "repair_notes": "...",
  "board_serial_number": "BRD-001",
  "device_serial_number": "DEV-001",
  "pickup_label": "/api/files/labels/...",
  "pickup_tracking": "TRK123",
  "is_walkin": false,
  "feedback_submitted": false,
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T12:00:00Z"
}
```

### Warranty
```json
{
  "id": "uuid",
  "warranty_number": "WRN-2024-001",
  "customer_id": "uuid",
  "product_type": "Inverter",
  "serial_number": "INV-2024-001",
  "purchase_date": "2024-01-15",
  "expiry_date": "2026-01-15",
  "status": "approved",  // pending, approved, rejected, expired
  "invoice_file": "/api/files/invoices/...",
  "created_at": "2024-03-20T10:00:00Z"
}
```

### Dispatch
```json
{
  "id": "uuid",
  "dispatch_number": "DSP-20240320-001",
  "dispatch_type": "new_order",  // new_order, amazon_order, return_dispatch, walkin_return, reverse_pickup, spare_dispatch
  "customer_name": "John Doe",
  "phone": "9876543210",
  "address": "123 Main St",
  "city": "Mumbai",
  "sku": "INV-500VA",
  "courier": "Delhivery",
  "tracking_id": "DLV123456",
  "label_file": "/api/files/labels/...",
  "status": "pending",  // pending, label_uploaded, dispatched, delivered
  "is_walkin": false,
  "created_at": "2024-03-20T10:00:00Z"
}
```

### Appointment
```json
{
  "id": "uuid",
  "customer_id": "uuid",
  "customer_name": "John Doe",
  "supervisor_id": "uuid",
  "date": "2024-03-25",
  "time_slot": "10:00",
  "duration_minutes": 30,
  "reason": "Discuss warranty claim",
  "status": "pending",  // pending, confirmed, completed, cancelled, no_show
  "created_at": "2024-03-20T10:00:00Z"
}
```

### Feedback
```json
{
  "id": "uuid",
  "ticket_id": "uuid",
  "ticket_number": "MG-R-20240320-12345",
  "customer_id": "uuid",
  "customer_name": "John Doe",
  "staff_id": "uuid",
  "staff_name": "Agent Smith",
  "staff_role": "call_support",
  "communication": 9,
  "resolution_speed": 8,
  "professionalism": 9,
  "overall": 8,
  "average_score": 8.5,
  "comments": "Great service!",
  "created_at": "2024-03-20T10:00:00Z"
}
```

---

## File Uploads

Files are uploaded as `multipart/form-data` and served from:
```
GET /api/files/{folder}/{filename}
```

Folders:
- `invoices` - Warranty invoices
- `labels` - Shipping labels (pickup/return)
- `service_invoices` - Repair service invoices
- `feedback_screenshots` - Amazon feedback call screenshots
- `pickup_labels` - Reverse pickup labels

---

## WebSocket / Real-time

Currently no WebSocket implementation. Use polling for real-time updates:
- Dispatcher dashboard: 30-second auto-refresh
- VoltDoctor sync: Background job runs every 5 minutes

---

## SLA Rules

| Role | SLA Time |
|------|----------|
| Call Support | 48 hours |
| Supervisor | 48 hours |
| Technician | 72 hours |
| Accountant | 48 hours |
| Dispatcher | 48 hours |

Tickets show SLA breach warnings when time exceeds these limits.

---

## Special Features

### Walk-in Customers (Technician)
- Technician can register walk-in customers directly
- Ticket number format: `MG-W-YYYYMMDD-XXXXX`
- After repair, skips accountant → goes directly to dispatcher

### Amazon Orders (Accountant)
- When creating outbound dispatch, select "Amazon Order"
- Creates feedback call task for Call Support
- Call Support must call customer and upload screenshot

### VoltDoctor Integration
- External app syncs tickets/warranties via background job
- Tickets from VoltDoctor have `source: "voltdoctor"`
- Call Support can reply to VoltDoctor tickets

### Customer Feedback
- After ticket is closed, customer can submit feedback
- 4 rating categories (1-10): Communication, Resolution Speed, Professionalism, Overall
- Shows in Admin Analytics with customer name

---

## Error Handling

API returns standard HTTP status codes:
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (role not allowed)
- `404` - Not Found
- `500` - Server Error

Error response format:
```json
{
  "detail": "Error message here"
}
```

---

## Frontend File Structure

```
/app/frontend/src/
├── App.js                    # Routes & Auth Context
├── components/
│   ├── layout/
│   │   └── DashboardLayout.jsx  # Sidebar + Header
│   ├── ui/                   # Shadcn components
│   └── feedback/
│       └── FeedbackSurvey.jsx
├── pages/
│   ├── admin/
│   │   ├── AdminDashboard.jsx
│   │   ├── AdminTickets.jsx
│   │   ├── AdminCustomers.jsx
│   │   ├── AdminWarranties.jsx
│   │   ├── AdminOrders.jsx
│   │   ├── AdminRepairs.jsx
│   │   ├── AdminAnalytics.jsx
│   │   ├── AdminGateLogs.jsx
│   │   └── AdminUsers.jsx
│   ├── customer/
│   │   ├── CustomerDashboard.jsx
│   │   ├── CustomerTickets.jsx
│   │   ├── CustomerAppointments.jsx
│   │   └── MyWarranties.jsx
│   ├── support/
│   │   └── CallSupportDashboard.jsx
│   ├── supervisor/
│   │   ├── SupervisorDashboard.jsx
│   │   ├── SupervisorCalendar.jsx
│   │   └── SupervisorWarranties.jsx
│   ├── technician/
│   │   └── TechnicianDashboard.jsx
│   ├── accountant/
│   │   └── AccountantDashboard.jsx
│   └── dispatcher/
│       └── DispatcherDashboard.jsx
```

---

## Quick Start for Frontend Dev

1. **Setup:**
   ```bash
   cd /app/frontend
   yarn install
   yarn start
   ```

2. **API Base URL:** Check `/app/frontend/.env`
   ```
   REACT_APP_BACKEND_URL=https://crm-rebuild-11.preview.emergentagent.com
   ```

3. **Making API Calls:**
   ```javascript
   import axios from 'axios';
   
   const API = process.env.REACT_APP_BACKEND_URL + '/api';
   
   // Login
   const { data } = await axios.post(`${API}/auth/login`, {
     email: 'admin@musclegrid.in',
     password: 'Muscle@846'
   });
   
   // Store token
   const token = data.access_token;
   
   // Authenticated request
   const tickets = await axios.get(`${API}/tickets`, {
     headers: { Authorization: `Bearer ${token}` }
   });
   ```

4. **Auth Context (already implemented):**
   ```javascript
   import { useAuth, API } from '@/App';
   
   const { token, user, login, logout } = useAuth();
   ```

---

## Contact

For questions about the backend or data models, refer to:
- `/app/backend/server.py` - Main API file
- `/app/memory/PRD.md` - Product Requirements
- `/app/test_reports/` - Test results and API verification

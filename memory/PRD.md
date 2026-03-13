# MuscleGrid CRM - Enterprise Edition

## Overview
Enterprise-grade Customer Service & Logistics CRM for MuscleGrid products (inverters, batteries, stabilizers). Matches the original PHP/MySQL CRM functionality with modern React/FastAPI stack.

**Domain**: crm.musclegrid.in  
**Status**: Production Ready  
**Last Updated**: March 13, 2026

---

## Architecture

### Tech Stack
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Authentication**: JWT-based with 8 user roles
- **Hosting**: Emergent Platform (50 credits/month)

---

## User Roles & Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@musclegrid.in | admin123 |
| **Supervisor** | supervisor@musclegrid.in | supervisor123 |
| **Call Support** | support@musclegrid.in | support123 |
| **Call Support 2** | support2@musclegrid.in | support123 |
| **Accountant** | accountant@musclegrid.in | accountant123 |
| **Dispatcher** | dispatcher@musclegrid.in | dispatch123 |
| **Technician** | technician@musclegrid.in | tech123 |
| **Technician 2** | technician2@musclegrid.in | tech123 |
| **Gate Operator** | gate@musclegrid.in | gate123 |
| **Customer (sample)** | ami_t@live.com | customer123 |

All migrated customers use password: `customer123`

---

## Complete Feature List

### 1. Admin Dashboard
- ✅ 6 Stat Cards: Total tickets (lifetime), Open tickets, Today's new tickets, Hardware service, Phone support, SLA breaches
- ✅ Quick access to All Tickets, Agent Performance, Gate Logs, Warranty Approvals
- ✅ Internal dashboard links (Supervisor, Agent, Call Support, Technician, Accountant, Dispatcher, Gate)
- ✅ SKU / Inventory Management link
- ✅ Customer-facing section (CRM, Request Form, User Management)
- ✅ Alerts section for SLA breaches and pending warranties

### 2. All Tickets Page (Admin)
- ✅ Ticket format: MG-R-YYYYMMDD-XXXXX
- ✅ Columns: Ticket, Customer (name/phone/email/city), Product/Issue (serial/invoice#), Support/Status, Customer Invoice, Assigned To, Dates (Created/SLA due/Closed)
- ✅ Filters: Search, Support type, Status, Date range
- ✅ SLA breached tickets highlighted in red
- ✅ View customer invoice uploaded during ticket creation

### 3. SLA Tracking System
- ✅ Phone support SLA: 24 hours
- ✅ Hardware support SLA: 168 hours (7 days)
- ✅ Repair SLA: 72 hours from receipt
- ✅ Auto-calculate SLA due date
- ✅ Visual indicators for breached SLA
- ✅ SLA breach count on dashboard

### 4. Gate Scanning System
- ✅ Inward scan (parcel arriving at factory)
- ✅ Outward scan (parcel leaving factory)
- ✅ Expected Incoming list
- ✅ Ready to Ship list
- ✅ Quick-click scanning from scheduled items
- ✅ Courier selection (Delhivery, BlueDart, DTDC, FedEx, etc.)
- ✅ Gate logs with timestamps
- ✅ Admin view of all gate activity

### 5. Complete Repair Workflow
```
Customer creates ticket
    ↓
Call Support diagnoses (Phone or Hardware)
    ↓
Hardware fault → Accountant creates reverse pickup label
    ↓
Customer downloads label & ships product
    ↓
Gate scans incoming parcel → Status: "Received at Factory"
    ↓
Technician sees in queue → Starts repair (72-hour SLA begins)
    ↓
Technician completes repair with notes → Status: "Repair Completed"
    ↓
Accountant sees "Ready for dispatch" → Adds service charges invoice → Creates return label
    ↓
Dispatcher sees in queue
    ↓
Courier picks up → Gate scans outward → Status: "Dispatched"
    ↓
Ticket closed
```

### 6. Technician Dashboard
- ✅ Awaiting Repair queue
- ✅ In Progress repairs
- ✅ 72-hour SLA countdown from receipt
- ✅ SLA breached warnings
- ✅ Start repair button
- ✅ Complete repair with notes
- ✅ My Recent Repairs history

### 7. Agent Performance Analytics
- ✅ Per-agent stats table
- ✅ Total tickets handled
- ✅ Closed tickets count
- ✅ Phone vs Hardware breakdown
- ✅ SLA breaches per agent
- ✅ Average resolution time (hours)
- ✅ SLA compliance rate %
- ✅ Ticket distribution by status

### 8. Customer Portal
- ✅ Dashboard with personal stats
- ✅ Create support ticket with invoice upload
- ✅ View My Tickets with status
- ✅ Register warranty with invoice
- ✅ View My Warranties
- ✅ Request warranty extension (upload Amazon review)
- ✅ Download pickup label when hardware service required (visible in ticket details)
- ✅ Track repair journey timeline
- ✅ Escalate ticket if no update for 48+ hours

### 9. Call Support Dashboard
- ✅ Ticket queue for phone support
- ✅ Create ticket on behalf of customer
- ✅ Update ticket status and notes
- ✅ Route to hardware service (100+ char notes required)
- ✅ Escalate to Supervisor (100+ char notes required)
- ✅ Mark as resolved on call

### 10. Supervisor Dashboard (NEW)
- ✅ Stats: Escalated tickets, Customer escalated, Urgent (SLA breach), Resolved today
- ✅ Urgent tickets section (customer escalated - highlighted in red)
- ✅ Escalated tickets queue with SLA countdown
- ✅ Take Action dialog (Resolve, Send Spare Part, Arrange Reverse Pickup)
- ✅ SKU selection for spare part dispatch
- ✅ 100+ character notes required for all actions

### 11. Accountant Dashboard (Enhanced)
- ✅ Hardware Tickets tab with clear action guidance:
  - Issue description section
  - Support Agent Notes (purple section)
  - Escalation Notes with agent name (orange section)
  - Supervisor Decision with recommended SKU (blue section)
  - Recommended action badge (REVERSE PICKUP or SEND SPARE PART)
  - Clear "Create Pickup Label" or "Create Spare Dispatch" button
  - Warning if no supervisor decision yet
- ✅ Upload Labels tab (add courier/tracking/label file)
- ✅ Outbound Dispatch tab with mandatory fields:
  - Dispatch Type (New Order, Part Dispatch, Other)
  - Order ID (mandatory)
  - Payment Reference (mandatory)
  - Invoice/Delivery Challan upload (mandatory)
  - SKU, Customer details, Address
- ✅ Create reverse pickup for hardware tickets
- ✅ Add service charges and invoice before dispatch

### 12. Dispatcher Dashboard
- ✅ Dispatch queue (items ready to ship)
- ✅ Customer info, courier, tracking visible
- ✅ Mark as dispatched
- ✅ TV Mode for warehouse display (auto-refresh every 10s)

### 13. SKU / Inventory Management
- ✅ Stats: Total SKUs, Active SKUs, Low Stock Alert, Total Stock Units
- ✅ Product inventory table with categories (Inverter, Battery, Stabilizer, Spare Part)
- ✅ Add new SKU with code, model name, category, initial stock
- ✅ Adjust stock with reason tracking
- ✅ Edit SKU details and activate/deactivate
- ✅ Low stock alert threshold per SKU

### 14. Admin Single Sign-On (SSO)
- ✅ Admin can access ALL internal dashboards:
  - Call Support Dashboard (/support)
  - Supervisor Dashboard (/supervisor)
  - Technician Dashboard (/technician)
  - Accountant Dashboard (/accountant)
  - Dispatcher Dashboard (/dispatcher)
  - Dispatcher TV Mode (/dispatcher/tv)
  - Gate Dashboard (/gate)
- ✅ Admin User Management:
  - View all staff users
  - Create new users with any role
  - Edit user details (name, email, phone, role, password)
  - Filter users by role

---

## Data Migrated from Old System

| Data Type | Count |
|-----------|-------|
| Customers | 40+ |
| Tickets | 14+ |
| Products (SKUs) | 10 |
| Warranties | 10+ |
| Gate Logs | 10+ |

---

## Ticket Statuses

| Status | Description |
|--------|-------------|
| new_request | Just created |
| call_support_followup | Support is handling |
| escalated_to_supervisor | Escalated to supervisor |
| supervisor_followup | Supervisor is handling |
| resolved_on_call | Resolved via phone |
| closed_by_agent | Closed without hardware |
| hardware_service | Marked for hardware |
| awaiting_label | Waiting for pickup label |
| label_uploaded | Pickup label ready |
| pickup_scheduled | Customer has label, waiting |
| received_at_factory | Gate scanned incoming |
| in_repair | Technician working |
| repair_completed | Fixed, ready for dispatch |
| service_invoice_added | Accountant added charges |
| ready_for_dispatch | Ready to ship back |
| dispatched | Shipped out |
| delivered | Delivered to customer |
| closed | Fully resolved |
| customer_escalated | Customer escalated due to no update |

---

## API Endpoints

### Auth
- POST `/api/auth/register` - Register new customer
- POST `/api/auth/login` - Login
- GET `/api/auth/me` - Get current user
- PATCH `/api/auth/me` - Update profile

### Tickets
- POST `/api/tickets` - Create ticket (multipart with invoice)
- GET `/api/tickets` - List tickets (role-filtered, with search)
- GET `/api/tickets/{id}` - Get ticket details
- PATCH `/api/tickets/{id}` - Update ticket
- POST `/api/tickets/{id}/route-to-hardware` - Route to hardware service (100+ char notes)
- POST `/api/tickets/{id}/escalate-to-supervisor` - Escalate to supervisor (100+ char notes)
- POST `/api/tickets/{id}/supervisor-action` - Supervisor takes action (resolve, spare_dispatch, reverse_pickup)
- POST `/api/tickets/{id}/customer-escalate` - Customer escalates after 48h no update
- POST `/api/tickets/{id}/upload-pickup-label` - Accountant uploads reverse pickup label
- POST `/api/tickets/{id}/mark-received` - Gate marks as received
- POST `/api/tickets/{id}/start-repair` - Technician starts repair
- POST `/api/tickets/{id}/complete-repair` - Technician completes repair
- POST `/api/tickets/{id}/add-service-invoice` - Accountant adds service charges
- POST `/api/tickets/{id}/upload-return-label` - Accountant uploads return label
- POST `/api/tickets/{id}/mark-dispatched` - Dispatcher marks as shipped

### Warranties
- POST `/api/warranties` - Register warranty (multipart)
- GET `/api/warranties` - List warranties
- GET `/api/warranties/{id}` - Get warranty details
- PATCH `/api/warranties/{id}/approve` - Admin approves
- PATCH `/api/warranties/{id}/reject` - Admin rejects
- POST `/api/warranties/{id}/request-extension` - Customer requests extension

### Dispatches
- POST `/api/dispatches` - Create dispatch
- GET `/api/dispatches` - List dispatches
- PATCH `/api/dispatches/{id}/label` - Upload label
- PATCH `/api/dispatches/{id}/status` - Update status
- GET `/api/dispatcher/queue` - Get dispatcher queue

### Gate
- POST `/api/gate/scan` - Record gate scan
- GET `/api/gate/logs` - Get gate scan logs
- GET `/api/gate/scheduled` - Get scheduled incoming/outgoing

### Supervisor (NEW)
- GET `/api/supervisor/queue` - Get escalated tickets
- GET `/api/supervisor/stats` - Supervisor dashboard stats

### SKU Management (NEW)
- GET `/api/admin/skus` - List all SKUs
- POST `/api/admin/skus` - Create new SKU
- PATCH `/api/admin/skus/{id}` - Update SKU
- POST `/api/admin/skus/{id}/adjust-stock` - Adjust stock with reason

### Admin
- GET `/api/admin/stats` - Dashboard statistics
- GET `/api/admin/customers` - List all customers
- GET `/api/admin/users` - List staff users
- POST `/api/admin/users` - Create staff user
- GET `/api/admin/agent-performance` - Agent analytics
- GET `/api/admin/tickets` - All tickets (admin view)

### Technician
- GET `/api/technician/queue` - Repair queue with 72hr SLA
- GET `/api/technician/my-repairs` - Assigned repairs

### Customer
- GET `/api/customer/timeline/{ticket_id}` - Ticket journey timeline
- GET `/api/stats` - Customer stats

---

## Files Structure

```
/app/
├── backend/
│   ├── server.py              # Main FastAPI application (1800+ lines)
│   ├── migrate_data.py        # Data migration script
│   ├── requirements.txt
│   ├── .env
│   ├── tests/
│   │   └── test_crm_api.py    # API tests
│   └── uploads/
│       ├── invoices/
│       ├── labels/
│       ├── pickup_labels/
│       ├── reviews/
│       └── service_invoices/
├── frontend/
│   ├── src/
│   │   ├── App.js             # Main router
│   │   ├── components/
│   │   │   ├── ui/            # Shadcn components
│   │   │   └── layout/
│   │   │       └── DashboardLayout.jsx
│   │   └── pages/
│   │       ├── admin/
│   │       │   ├── AdminDashboard.jsx
│   │       │   ├── AdminTickets.jsx
│   │       │   ├── AdminGateLogs.jsx
│   │       │   ├── AdminAnalytics.jsx
│   │       │   ├── AdminCustomers.jsx
│   │       │   ├── AdminWarranties.jsx
│   │       │   └── AdminUsers.jsx
│   │       ├── customer/
│   │       ├── support/
│   │       ├── accountant/
│   │       ├── dispatcher/
│   │       ├── technician/
│   │       │   └── TechnicianDashboard.jsx
│   │       └── gate/
│   │           └── GateDashboard.jsx
│   └── package.json
├── memory/
│   └── PRD.md
└── test_reports/
    ├── iteration_1.json
    ├── iteration_2.json
    └── iteration_3.json
```

---

## Email Notifications (MOCKED)

Email templates ready but require Resend API key:
```
RESEND_API_KEY=re_xxxxx
SENDER_EMAIL=noreply@musclegrid.in
```

Events that trigger emails:
- Ticket created
- Ticket status updated
- Hardware service required (pickup label ready)
- Warranty approved/rejected
- Dispatch tracking info
- Ticket escalated to supervisor

---

## Deployment

1. Click "Deploy" in Emergent
2. Choose custom domain (crm.musclegrid.in)
3. 50 credits/month for hosting
4. Can export to GitHub anytime

---

## Testing

- Backend: 100% passing (14/14 tests for v4 features)
- Frontend: All dashboards functional (100%)
- Test reports: 
  - `/app/test_reports/iteration_4.json` (latest)
  - `/app/test_reports/iteration_3.json`
  - `/app/backend/tests/test_new_features_v4.py`

---

## Recent Changes (March 13, 2026)

### Session 2 Updates
1. **Admin SSO** - Admin can now access ALL internal dashboards (Support, Technician, Accountant, Dispatcher, Gate, Supervisor)
2. **Accountant Hardware Tab Redesigned** - Now shows:
   - Support Agent Notes (purple)
   - Escalation Notes with agent name (orange)  
   - Supervisor Decision with recommended SKU (blue)
   - Clear action badge (REVERSE PICKUP or SEND SPARE PART)
   - Appropriate action buttons based on recommendation
3. **Admin User Edit** - Full user editing (name, email, phone, role, password)
4. **Accountant Outbound Dispatch Enhanced** - Added mandatory fields:
   - Order ID, Payment Reference, Invoice/Challan upload
5. **Customer Pickup Label Download** - Customers can now download pickup label from ticket details

### Session 1 Updates
1. **Supervisor Dashboard** - Complete escalation workflow
2. **SKU/Inventory Management** - Full CRUD with stock adjustments
3. **Escalate to Supervisor** - Support agents can escalate complex cases
4. **Customer Escalation** - Customers can escalate after 48h no update
5. **100+ Character Notes** - Required for escalation and hardware routing
6. **Dispatcher TV Mode Fixed** - Status filter corrected

---

## Future Enhancements (Backlog)

- [ ] SMS automation for dispatch tracking
- [ ] Courier API integration for live tracking
- [ ] Service analytics dashboard with charts
- [ ] Mobile app (React Native)
- [ ] Warranty reminder campaigns
- [ ] Customer self-service knowledge base
- [ ] Bulk CSV import for customers
- [ ] Backend refactoring (split server.py into modules)
- [ ] Prevent duplicate tickets for same product

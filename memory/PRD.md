# MuscleGrid CRM - Enterprise Edition

## Overview
Enterprise-grade Customer Service & Logistics CRM for MuscleGrid products (inverters, batteries, stabilizers). Matches the original PHP/MySQL CRM functionality with modern React/FastAPI stack.

**Domain**: crm.musclegrid.in  
**Status**: Production Ready  
**Last Updated**: March 19, 2026

---

## Recent Changes (March 19, 2026)

### Customer Feedback Surveys Table (NEW)
- ✅ Added at bottom of Agent Performance Analytics page
- ✅ Shows staff who received feedback with:
  - Staff Name
  - Role (with color-coded badge)
  - Total Reviews count
  - Communication rating (1-10 stars)
  - Resolution Speed rating (1-10 stars)
  - Professionalism rating (1-10 stars)
  - Overall rating (1-10 stars)

### Technician Walk-in Customer Feature (NEW)
- ✅ "Walk-in Customer" button on technician dashboard
- ✅ Walk-in registration form with:
  - Customer Name, Phone, Email
  - Device Type, Serial Number
  - Issue Description
  - Address for return shipping (City, State, Pincode)
- ✅ Walk-in tickets get ticket number: `MG-W-YYYYMMDD-XXXXX`
- ✅ Walk-in tickets start directly at "received_at_factory" status
- ✅ After repair completion, walk-in tickets go to "ready_for_dispatch" (SKIPS accountant)

### Technician Serial Number Requirements (NEW)
- ✅ Complete Repair dialog now requires:
  - Board Serial Number (mandatory)
  - Inverter/Battery Serial Number (mandatory)
  - Repair Notes
- ✅ Serial numbers stored with ticket and visible in My Repairs

### Technician Notes Viewing (NEW)
- ✅ Notes column in repair queue shows count of available notes
- ✅ Clicking Notes/Eye opens ticket details dialog with:
  - Customer Information section
  - Notes & Information section showing:
    - Customer issue (blue badge)
    - Call Support diagnosis (green badge)
    - Call Support notes (green badge)
    - Supervisor notes (purple badge)
  - Status Information section

### Customer Feedback Now Visible in Admin Analytics (BUG FIX)
- ✅ Fixed issue where customer feedback wasn't appearing in admin performance metrics
- ✅ Admin role now included in staff metrics tracking
- ✅ Feedback correctly attributed to staff member who closed the ticket

### Top Performers Leaderboard (NEW)
- ✅ New leaderboard section at top of Agent Performance Analytics
- ✅ Employees ranked by composite Performance Score (0-100)
- ✅ Score calculated from:
  - Customer feedback rating (40% weight)
  - Tickets closed (30% weight)
  - Resolution speed - faster is better (20% weight)
  - Feedback calls completed (10% weight)
- ✅ Trophy/Medal/Award icons for top 3 performers
- ✅ Color-coded role badges (Admin, Supervisor, Call Support, etc.)
- ✅ Shows key metrics: Tickets Closed, Avg Resolution Time, Feedback Calls, Customer Rating

### Company Stats Cards (NEW)
- ✅ Company Avg Rating (out of 10)
- ✅ Total Feedback Received
- ✅ Total Staff Tracked

### Appointment Booking System (NEW)
- ✅ Customers with approved warranty can book 30-min appointments with supervisors
- ✅ Customer sidebar has "Book Appointment" link
- ✅ Customer dashboard has "Book Appointment" card with purple gradient
- ✅ Appointment page shows calendar for date selection + available time slots
- ✅ Tabs: Book New | Upcoming | Past appointments
- ✅ Booking confirmation dialog with reason field

### Supervisor Calendar (NEW)
- ✅ Supervisor sidebar has "Calendar" link
- ✅ Stats cards: Total Appointments, Pending, Confirmed, Completed, No Shows
- ✅ "Manage Availability" button to set working hours per day (Mon-Sun, 9am-7pm default)
- ✅ Calendar view showing appointments for selected date
- ✅ Pending confirmation queue with ability to confirm/cancel/mark complete/no show

### Customer Feedback Survey (NEW)
- ✅ Closed/resolved tickets show "Provide Feedback" button
- ✅ FeedbackSurvey modal with 4 rating categories (1-10 stars):
  - Communication
  - Resolution Speed
  - Professionalism
  - Overall Experience
- ✅ Optional comments field
- ✅ Feedback stored in `feedback` collection with staff_id for performance tracking

### Amazon Order Feedback Calls (NEW)
- ✅ Accountant outbound dispatch has "Amazon Order" option (separate from Non-Amazon)
- ✅ When Amazon order is dispatched, feedback call task created automatically
- ✅ Call Support dashboard shows "Pending Feedback Calls" stat card (highlighted when > 0)
- ✅ New "Feedback Calls" tab showing pending Amazon order customers to call
- ✅ Complete call requires uploading screenshot proof
- ✅ "No Answer" option to retry later
- ✅ Admin Analytics shows "Amazon Feedback Call Performance" section with leaderboard

### API Endpoints Added
- GET /api/feedback-calls - Get feedback calls for call support
- PATCH /api/feedback-calls/{id} - Update feedback call (complete with screenshot or mark no_answer)
- GET /api/call-support/stats - Get call support stats including pending feedback calls
- GET /api/admin/feedback-call-performance - Get feedback call performance for all agents

---

## Previous Changes (March 15, 2026)

### Admin Orders Tab
- ✅ Added "Orders" link in admin sidebar (between Warranties and Analytics)
- ✅ Admin can view all orders entered by accountant (dispatch_type: "new_order")
- ✅ Stats cards: Total Orders, Pending, Shipped, Delivered
- ✅ View order details dialog
- ✅ Edit order: Update customer info, status, order details
- ✅ Delete order with confirmation dialog

### Ticket Reply System (NEW)
- ✅ Support agents can reply to any ticket via POST /api/tickets/{id}/reply
- ✅ Replies added to ticket history and agent notes
- ✅ VoltDoctor ticket replies sync back to VoltDoctor API automatically

### Enhanced VoltDoctor Sync
- ✅ Updated ticket mapping to handle both field naming conventions:
  - `user_name` ↔ `customer_name`
  - `user_email` ↔ `customer_email`  
  - `user_phone` ↔ `customer_phone`
- ✅ Handles `responses[]` array (with is_admin flag) and `conversation[]` array
- ✅ Bi-directional reply sync to VoltDoctor

### SQL Data Import
- ✅ Imported 329 tickets from legacy PHP/MySQL system (`repair_data.sql`)
- ✅ Phone-based customer deduplication (241 unique customers created)
- ✅ Multiple tickets per phone allowed (admin can manage duplicates)
- ✅ Legacy IDs preserved for reference
- ✅ Import script: `/app/backend/import_sql_data.py`

### Edit Customer Information
- ✅ Admin/Support can edit customer details from ticket detail page
- ✅ Editable fields: First Name, Last Name, Email, Address, City, State, Pincode
- ✅ Phone number is READ-ONLY (unique customer ID)
- ✅ Changes sync to all related tickets

### Warranty Invoice Management
- ✅ Invoice column added to Approved warranties tab
- ✅ "View" link for warranties with invoices
- ✅ "Upload" button for warranties without invoices
- ✅ PDF/JPG/PNG uploads stored locally in `/uploads/warranty_invoices/`

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

### 7. Agent Performance Analytics (Enhanced)
- ✅ Per-agent stats table with all metrics
- ✅ Total tickets handled
- ✅ Closed tickets count
- ✅ Phone vs Hardware breakdown
- ✅ SLA breaches per agent
- ✅ Average resolution time (hours)
- ✅ SLA compliance rate %
- ✅ Ticket distribution by status (grid view)
- ✅ **Pie Charts:**
  - Support Type Distribution (Phone/Hardware/Escalated)
  - SLA Performance (Within SLA/Breached)
  - Team Workload (Tickets per Agent)
- ✅ **Bar Charts:**
  - Tickets Handled by Agent
  - Avg Resolution Time (hours)

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

### 11. Accountant Dashboard (Redesigned)
- ✅ **4 Tabs for clear workflow:**
  - **From Supervisor Tab**: Tickets with supervisor decisions
    - REVERSE PICKUP (orange badge) → Upload Pickup Label button
    - SEND SPARE PART (blue badge) → Create Spare Dispatch button
    - All notes visible: Support Agent (purple), Escalation (orange), Supervisor (blue)
  - **Repaired Tab**: Items from technician ready for return
    - "Create Return Dispatch" button for each repaired item
  - **Outbound Tab**: New orders / spare parts going OUT from service center
    - SKU dropdown (mandatory) from admin inventory
    - Order ID, Payment Reference, Invoice/Challan (mandatory)
  - **Upload Labels Tab**: Outbound dispatches needing shipping labels
- ✅ Reverse pickup label → Goes to CUSTOMER (not outbound)
- ✅ Stats: Reverse Pickup, Spare Dispatch, Repaired Items, Pending Labels, Ready to Ship

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
- GET `/api/admin/warranty-extensions` - Admin gets pending extension requests
- PATCH `/api/admin/warranties/{id}/review-extension` - Admin approves/rejects extension (customizable months: 1,2,3,6,12)

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

- Backend: 100% passing (14/14 tests in iteration_8)
- Frontend: All dashboards functional (100%)
- Test reports: 
  - `/app/test_reports/iteration_8.json` (latest - bug fixes)
  - `/app/test_reports/iteration_7.json` (accountant workflow)
  - `/app/test_reports/iteration_6.json` (E2E workflow)

---

## Recent Changes (March 15, 2026)

### Session 8 Updates - VoltDoctor Integration
1. **Background Sync Service Implemented**:
   - Connects to VoltDoctor MongoDB Atlas (`voltdoctor.82eukpe.mongodb.net`)
   - Syncs warranties and tickets from VoltDoctor app to CRM automatically
   - Bidirectional sync - status updates from CRM reflect back to VoltDoctor
   - Runs every 5 minutes in background
2. **New API Endpoints**:
   - `GET /api/voltdoctor/sync/status` - Check sync status
   - `POST /api/voltdoctor/sync/trigger` - Manually trigger sync
   - `GET /api/voltdoctor/warranties` - List synced warranties
   - `GET /api/voltdoctor/tickets` - List synced tickets
3. **Field Mapping**:
   - VoltDoctor `warranty_number` → CRM warranty with `source: "voltdoctor"`
   - VoltDoctor `support_tickets` → CRM tickets with `source: "voltdoctor"`
   - Status changes in CRM automatically sync back to VoltDoctor
4. **Initial Sync Results**:
   - 14 warranties synced from VoltDoctor
   - 8 tickets synced from VoltDoctor
   - Bidirectional status updates working

---

## Recent Changes (March 14, 2026)

### Session 7 Updates - Bug Fixes
1. **Direct Hardware Tickets Lost Bug Fixed**: 
   - Accountant now sees hardware tickets routed directly from Support Agent (without Supervisor escalation)
   - Added "NEEDS DECISION" badge for direct hardware tickets requiring accountant action
   - Accountant can choose between "Reverse Pickup" or "Spare Dispatch" using a new decision dialog
   - New backend endpoint: `PATCH /api/tickets/{id}/accountant-decision`
2. **Admin Ticket View Button Fixed**:
   - Created new `AdminTicketDetail.jsx` page with full ticket journey timeline
   - Shows complete history with timestamps, actions, and responsible team members
   - Includes: Current Status, Customer Info, Product Details, Issue Description, Timeline, Agent Notes
   - Added route `/admin/tickets/:ticketId`
3. **Accountant Outbound Dispatch Crash Fixed**:
   - Fixed React "Objects are not valid as React child" error when backend returns Pydantic validation errors
   - Added `getErrorMessage()` helper to properly extract error messages from validation error arrays
   - All toast.error calls now handle object/array errors gracefully

---

## Recent Changes (March 14, 2026)

### Session 6 Updates - Warranty Extension Approval Flow
1. **Warranty Extension Admin Interface** - Complete implementation:
   - New "Extension Requests" tab in Admin Warranties page
   - Admin can view customer's Amazon review screenshots
   - Customizable extension period selector (1, 2, 3, 6, or 12 months)
   - Approve/Reject with notes functionality
2. **New API Endpoints**:
   - `GET /api/admin/warranty-extensions` - Fetch pending extension requests
   - `PATCH /api/admin/warranties/{id}/review-extension` - Approve/reject extensions
3. **Customer Portal Updates**:
   - Extension status (pending/approved/rejected) now visible in My Warranties
   - Warranty expiry date updates when extension is approved
4. **Admin Dashboard**:
   - Added pending extensions count to alerts section

---

## Recent Changes (March 14, 2026)

### Session 5 Updates - Bug Fixes
1. **Accountant Dashboard React Error Fixed** - Added defensive array checks
2. **Dispatcher Confirm Dispatch Fixed** - Endpoint now accepts FormData, handles both dispatches and tickets
3. **Customer Pickup Label Download Fixed** - File serving with proper headers
4. **Repair Notes Visible to Customer** - Shows "Repair Completed" section with notes
5. **Ticket Number Consistency** - Verified stays same throughout workflow

---

## Recent Changes (March 13, 2026)

### Session 4 Updates - Workflow Fixes
1. **Accountant Dashboard Redesigned** with 4 tabs:
   - From Supervisor (REVERSE PICKUP / SEND SPARE PART badges)
   - Repaired (Create Return Dispatch for technician items)
   - Outbound (New Order / Spare Part with SKU dropdown)
   - Upload Labels (for outbound dispatches)
2. **Reverse Pickup Flow Fixed**:
   - Pickup label now goes to CUSTOMER (not outbound dispatch)
   - Customer can download and print label from ticket details
3. **Outbound Clarified**:
   - Only for items going OUT: New Order, Spare Part, Repaired Return
   - SKU dropdown mandatory for new/spare items
4. **Ticket Number Consistency** - Verified never changes throughout workflow

---

## Recent Changes (March 13, 2026)

### Session 3 Updates - ALL PHASES COMPLETE
1. **Full E2E Workflow** - Complete testing passed (Customer → Support → Supervisor → Accountant → Technician → Dispatcher)
2. **Admin Performance Analytics UI** - Added:
   - Pie Charts: Support Type Distribution, SLA Performance, Team Workload
   - Bar Charts: Tickets Handled by Agent, Avg Resolution Time
3. **Backend Modularization** - Created:
   - `/app/backend/models/schemas.py` - All Pydantic models
   - `/app/backend/utils/helpers.py` - Utility functions
   - `/app/backend/utils/database.py` - DB connection
4. **Duplicate Ticket Prevention** - Added:
   - API endpoint `/api/tickets/check-duplicate`
   - Frontend warning and blocked submission
   - Backend validation on ticket creation

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

- [ ] Backend route refactoring (server.py is 2800+ lines - split into routers/)
- [ ] SMS automation for dispatch tracking
- [ ] Courier API integration for live tracking
- [ ] Mobile app (React Native)
- [ ] Warranty reminder campaigns
- [ ] Customer self-service knowledge base
- [ ] RBAC security audit (verify role isolation)
- [ ] Email notifications via Resend integration

---

## Code Architecture

```
/app/backend/
├── server.py            # Main FastAPI app (2800+ lines - needs refactoring)
├── models/
│   ├── __init__.py
│   └── schemas.py       # Pydantic models
├── utils/
│   ├── __init__.py
│   ├── helpers.py       # JWT, password, SLA utilities
│   └── database.py      # MongoDB connection
├── routers/             # Ready for future route splitting
│   └── __init__.py
├── tests/               # Test files
├── voltdoctor_sync.py   # Background VoltDoctor bi-directional sync
├── import_sql_data.py   # SQL import script for legacy data
├── add_test_data.py
└── migrate_data.py

/app/frontend/src/pages/
├── admin/               # Admin dashboards (Users, Analytics, SKUs, Tickets)
│   └── AdminTicketDetail.jsx  # Includes Edit Customer modal
├── accountant/          # Accountant (Hardware, Labels, Outbound)
├── customer/            # Customer Portal (Tickets, Warranties)
├── dispatcher/          # Dispatcher + TV Mode
├── gate/                # Gate scanning
├── supervisor/          # Supervisor escalations
├── support/             # Call Support
└── technician/          # Technician repairs
```

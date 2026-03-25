# MuscleGrid CRM - Enterprise Edition

## Overview
Enterprise-grade Customer Service & Logistics CRM for MuscleGrid products (inverters, batteries, stabilizers). Matches the original PHP/MySQL CRM functionality with modern React/FastAPI stack.

**Domain**: crm.musclegrid.in  
**Status**: Production Ready  
**Last Updated**: March 25, 2026

---

## Recent Changes (March 25, 2026)

### PI / QUOTATION MODULE ✅ (NEW)

Full implementation of Proforma Invoice / Quotation management system.

#### Features:
- **Quotation Creation**: Call Support can create quotations with party search/creation, item selection with live stock visibility, all required fields (validity date, terms, GST, discounts)
- **Quotation List**: Dashboard with filters (status, date, party), role-based views and actions (edit, view, send, cancel)
- **Send & Lock**: PI is locked after sending, generates shareable link
- **Public View**: Customer-facing page with full quotation details and PDF download
- **PDF Generation**: Using WeasyPrint for professional PDF output
- **Customer Actions**: Approve/Reject via public link with status tracking
- **PI Pending Action Queue**: For accountants - shows approved PIs categorized by stock availability (Stock Available, Pending Production, Pending Procurement, Pending Dispatch, Expired)
- **Conversion**: Convert approved PIs to dispatch (if stock available) or production request (if stock unavailable)

#### Status Flow:
`draft` -> `sent` -> `viewed` -> `approved` / `rejected` -> `converted` / `expired` / `cancelled`

#### Pages:
- `/quotations` - Main quotation list and dashboard
- `/quotations/new` - Create new quotation
- `/quotations/edit/:id` - Edit draft quotation
- `/quotations/pending-action` - Accountant's action queue
- `/pi/:token` - Public customer view (no auth required)

---

### INCENTIVE TRACKING SYSTEM ✅ (NEW)

Complete incentive management for Call Support agents linked to PI conversions.

#### Features:
- **Automatic Incentive Creation**: Triggered when PI is converted to sale
- **Agent Linkage**: Incentive linked to Call Support agent who created the PI
- **Configuration Types**:
  - Fixed amount per conversion
  - Percentage of sale value (with optional cap)
  - Minimum sale value threshold
- **Status Tracking**: pending -> approved -> paid
- **Bulk Operations**: Admin can bulk approve and mark incentives as paid

#### Pages:
- `/my-incentives` - Call Support view of their own incentives with:
  - This month earnings
  - Total earned / Pending / Paid summary
  - Performance overview (conversion rate, monthly trend)
  - Full incentive history
- `/admin/incentives` - Admin management with:
  - Agent summary view with totals and actions
  - All transactions view
  - Configuration management (set up monthly incentive rules)

#### API Endpoints:
- `GET /api/my-incentives` - Agent's own incentives
- `GET /api/my-incentives/stats` - Agent's performance stats
- `GET /api/admin/incentives` - All incentive records
- `GET /api/admin/incentives/summary` - Summary by agent
- `POST /api/admin/incentive-config` - Create/update config
- `POST /api/admin/incentives/bulk-approve` - Bulk approve
- `POST /api/admin/incentives/bulk-paid` - Bulk mark paid

---

### ACCOUNTANT USER MANUAL ✅ (NEW)

Created comprehensive user manual for accountants at `/app/ACCOUNTANT_USER_MANUAL.md`.

#### Contents:
- Getting Started (Login, Navigation)
- Dashboard Overview
- Compliance Management
- Finance & GST
- Sales Register & Purchase Register
- Party Master & Party Ledger
- Payments & Credit Notes
- Accounting Reports
- Inventory & Production Management
- Dispatch & Fulfillment
- Gate Control (with barcode scanner instructions)
- Troubleshooting & Best Practices

---

### UI/UX IMPROVEMENTS ✅ (NEW)

#### Finance & GST Page:
- Added **Back button** for navigation
- Applied **dark theme** consistent with rest of app
- Wrapped in **DashboardLayout** for proper sidebar

#### Purchase Register Page:
- Added **Back button** for navigation
- Applied **dark theme** consistent with rest of app
- Wrapped in **DashboardLayout** for proper sidebar

---

### GATE CONTROL ENHANCEMENTS ✅ (NEW)

#### Accountant Access:
- Added full gate control access for **accountant** role
- Can perform: Inward scan, Outward scan, View logs, View scheduled

#### Custom Courier Name:
- When **"Other (Manual Entry)"** is selected, a new input field appears
- Allows manual entry of custom courier names

#### Barcode Scanner Support:
- Tracking ID input **auto-focuses** for scanner readiness
- **Enter key** triggers scan automatically
- **Auto-refocus** after each scan for continuous scanning

---

### MOBILE-FRIENDLY LAYOUTS ✅ (NEW)

#### Gate Control:
- Large **56px height** buttons (h-14)
- **Full-width** scan buttons
- **2-column** responsive grid for scheduled parcels
- Compact text and truncation for mobile screens

#### Technician Dashboard:
- **2-column stats grid** on mobile (grid-cols-2)
- Compact stat cards with smaller padding
- Full-width walk-in button on mobile

#### Supervisor Dashboard:
- **2-column stats grid** on mobile (grid-cols-2 lg:grid-cols-4)
- Responsive header layout

---

### REAL-TIME COMPLIANCE ALERTS ✅

Added notification banner for compliance attention on Admin and Accountant dashboards.

#### Features:
- **ComplianceAlertBanner Component**: Shows when there are open exceptions or pending drafts
- **Quick Actions**: Finalize drafts directly from the banner
- **Auto-refresh**: Refreshes compliance data every 60 seconds
- **Context-aware styling**: Red for critical issues, yellow for warnings, blue for drafts
- **Dismissible**: Users can dismiss the banner temporarily

#### Integration:
- Added to Admin Dashboard (Overview tab)
- Added to Accountant Dashboard

---

### COMPLIANCE EXTENDED TO DISPATCHES & STOCK ADJUSTMENTS ✅ (NEW)

Compliance validation now covers Dispatches and Stock Adjustments.

#### Dispatches:
- Added `doc_status` field to track documentation compliance
- Added `compliance_score` field
- Added `compliance_issues` field for tracking warnings
- Creates compliance exceptions for soft blocks

#### Stock Adjustments:
- Added compliance validation with mandatory reason (min 5 characters)
- Tracks adjustment value for threshold-based compliance
- Creates compliance exceptions for high-value adjustments (>₹50,000)
- Added `doc_status` and `compliance_score` to stock logs

---

### DOCUMENT COMPLIANCE SYSTEM COMPLETE ✅

A comprehensive documentation compliance layer that ensures all stock, accounting, and logistics movements are backed by proper documentation.

#### Core Features:
- **Centralized Compliance Validator**: Single validation service used by all transaction endpoints
- **Mandatory Document Matrix**: Configurable rules for 11 transaction types (purchase, sales, dispatch, stock adjustment, etc.)
- **Hard/Soft Blocking Rules**:
  - Hard blocks: Transaction cannot proceed (critical missing docs)
  - Soft blocks: Creates exception but allows transaction
  - Warnings: Informational only
- **Draft vs Final State**:
  - Draft: Can be saved with incomplete documentation
  - Final: Only possible when compliant
- **Compliance Score by Firm**: Weighted score based on pending issues
- **Override Workflow**: Admin-only with mandatory reason and audit logging

#### New Pages:
- **Compliance Dashboard (`/admin/compliance`)**: Central hub for compliance management
  - Stats cards: Open Exceptions, Critical Issues, Pending Drafts, Overridden, Resolved Today
  - Compliance Score by Firm with progress bars
  - Exceptions Tab: Filter by firm, type, status, severity, age bracket (0-3, 4-7, 8-15, 15+ days)
  - Pending Drafts Tab: View and finalize draft transactions
  - Compliance Matrix Tab: Visual reference for all transaction type requirements

#### Updated Pages:
- **Purchase Register**: Added Status column (draft/final), doc_status badges, save-as-draft option
- **Sidebar**: Added Compliance link for Admin and Accountant roles

#### New API Endpoints:
- `GET /api/compliance/dashboard` - Dashboard stats
- `GET /api/compliance/exceptions` - List exceptions with filters
- `GET /api/compliance/matrix` - Document requirements matrix
- `GET /api/compliance/score` - Compliance scores by firm
- `GET /api/drafts` - List draft transactions
- `POST /api/drafts/{type}/{id}/finalize` - Finalize a draft
- `POST /api/compliance/exceptions/{id}/override` - Override exception
- `POST /api/compliance/exceptions/{id}/resolve` - Resolve exception

#### New Database Fields:
- `purchases`: Added `status`, `doc_status`, `compliance_score`, `compliance_issues`
- `sales_invoices`: Added `status`, `doc_status`, `compliance_score`, `compliance_issues`

---

### FULL ACCOUNTING LAYER COMPLETE ✅

#### Phase 1: Party Master + Sales Register
- **Party Master (`/admin/parties`)**: Unified customer/supplier/contractor database with GSTIN tracking
- **Sales Register (`/accountant/sales`)**: Invoice creation linked to dispatches with GST auto-calculation

#### Phase 2: Ledger + Payments
- **Party Ledger (`/accountant/ledger`)**: View transaction history for any party with running balance
- **Payment Tracking (`/accountant/payments`)**: Record payments received/made with invoice linking
- Payment modes: Cash, Bank Transfer, UPI, Cheque, Card
- Auto-updates invoice payment status (unpaid → partial → paid)
- Immutable ledger entries (no edit/delete)

#### Phase 3: Reports + Credit Notes
- **Accounting Reports (`/accountant/reports`)**:
  - Receivables Report with age analysis (0-30, 31-60, 61-90, 90+ days)
  - Payables Report by supplier
  - Profit Summary with monthly breakdown, GST liability
- **Credit Notes (`/accountant/credit-notes`)**: Sales returns, discounts, adjustments
- Export to CSV for all reports

**New Collections:**
- `parties` - unified party master
- `sales_invoices` - sales register  
- `party_ledger` - immutable ledger entries
- `payments` - payment records
- `credit_notes` - credit notes/returns

**Invoice Numbering:**
- Sales: `INV/{FIRM}/{FY}/{NUM}` (e.g., INV/MGI/2526/00001)
- Payments: `REC/{FY}/{NUM}` or `PAY/{FY}/{NUM}`
- Credit Notes: `CN/{FIRM}/{FY}/{NUM}`

---

## Understanding the Sales Invoice → Dispatch Relationship

**What is a Dispatch?**
A "dispatch" in this CRM is an outbound shipment record created when goods are sent to a customer. It contains:
- Customer details (name, phone, address)
- Product/SKU being shipped
- Quantity and price
- Shipping/courier details
- Dispatch status

**Why Sales Invoice requires a Dispatch?**
The design enforces that every sales invoice MUST be linked to a physical dispatch. This ensures:
1. No invoice can be created without actual goods being shipped
2. Prevents double-invoicing (one dispatch = one invoice)
3. Maintains audit trail between shipment and billing

**"No dispatches without invoice" means:**
All existing dispatches already have invoices created for them. To create a new sales invoice, you need a dispatch that hasn't been invoiced yet.

**Workflow:**
1. Create dispatch in "Outbound Dispatch" page
2. Once dispatch is created → it appears in Sales Register
3. Create invoice by selecting the dispatch
4. Invoice auto-links to dispatch, dispatch marked as invoiced

---

## Previous Changes (March 23, 2026)

### Call Support Dashboard Enhancement (NEW - COMPLETE)
- Completed Call Support dashboard with All Tickets, Search, and Customer History features
- Pagination with 100 tickets per page

### Finance & GST Planning Dashboard (NEW - COMPLETE)
- **Overview Tab** - Firm-wise financial summary with inventory value, sales, output GST, ITC balance, and net GST payable
- **Inventory Valuation Tab** - WAC (Weighted Average Cost) method for all inventory items per firm
- **GST Planning Tab** - Monthly financial metrics with GST breakup by rate, ITC entry, and net payable calculation
- **Transfer Recommendations Tab** - Smart suggestions based on stock levels, sales velocity, and ITC balance (advisory only)
- **Audit Trail Tab** - All financial actions logged for audit purposes
- **Access:** Admin + Accountant roles only
- **New Collections:** `gst_itc_balances`, `financial_audit_logs`

### Purchase Register Module (NEW - COMPLETE)
- **Purchase Entry Form:**
  - Firm selection (with state for GST calculation)
  - Supplier details: name, GSTIN (validated format), state
  - Invoice number and date
  - Multi-item entry with raw materials or master SKUs
  - Quantity, rate, and GST rate per item
- **GST Automation:**
  - Auto-calculates IGST (inter-state) vs CGST+SGST (intra-state)
  - Based on supplier state vs firm state comparison
- **Inventory Integration:**
  - Creates ledger entries (purchase type) automatically
  - Increases stock for selected firm with unit_cost for WAC
- **ITC Tracking:**
  - Aggregates GST values per firm for GST Planning
  - Endpoint: `/api/finance/itc-from-purchases`
- **Validation:** GSTIN format, mandatory invoice number, positive quantities
- **Reports:** CSV export with purchase list + item details
- **Access:** Admin + Accountant roles
- **New Collection:** `purchases`

### Mandatory Fields Update
- **Master SKU:** `hsn_code`, `gst_rate`, `cost_price` now MANDATORY
- **Raw Material:** `hsn_code`, `gst_rate`, `cost_price` now MANDATORY

### Repair Flow (Confirmed Working)
- Accountant arranges reverse pickup → Label goes to customer
- Gate scans item (received at factory)
- Accountant classifies as repair item → Goes to technician dashboard

---

## Previous Changes (March 22, 2026)

### Production Data Import & UI Enhancement (COMPLETE)
- ✅ **CSV Data Import** - Imported 814 battery entries from BatteryOrderSheet_Report.csv
- ✅ **Data Filtering** - Excluded duplicates, non-serial number entries, and repaired batteries
- ✅ **Final Import Stats**: 748 serials (683 New, 65 Repaired), 686 supervisor payables (Rs. 25,08,000 pending)
- ✅ **Production Completed Tab** - New tab with serial number column and search functionality
- ✅ **Search Bar** - Filter by serial number, product name, customer, order ID
- ✅ **Condition Badge** - Shows New (green) or Repaired (yellow) status

### Admin Analytics - Ticket Linking (COMPLETE)
- ✅ **Clickable Ticket Numbers** - Survey feedback now shows clickable ticket links
- ✅ **Navigation** - Click ticket number to view full ticket details
- ✅ **External Link Icon** - Visual indicator for clickable links

### Admin Activity Logs System (NEW - COMPLETE)
- ✅ **New Activity Logs Page** - `/admin/activity-logs`
- ✅ **Comprehensive Logging** - Tracks all organization actions
- ✅ **Stats Cards** - Total logs, Today's activity, This week, Active users
- ✅ **Action Types** - Dispatch, Production, Inventory, Gate scans, Payments, etc.
- ✅ **Filtering** - By action type, entity type, user, date range
- ✅ **Search** - Search through all activity logs
- ✅ **Expandable Details** - Click to view JSON details for each action
- ✅ **109 existing audit entries** imported from previous activity
- ✅ **Sidebar Link** - Activity Logs link added to admin navigation

---

## Previous Changes (March 21, 2026)

### Pending Fulfillment Queue (NEW - COMPLETE)
- ✅ **Amazon Order Tracking** - Track orders where labels are created before stock is available
- ✅ **Label Expiry Management** - 5-day expiry with tracking history
- ✅ **Stock Status Detection** - Auto-detects when stock becomes available (awaiting_stock → ready_to_dispatch)
- ✅ **Tracking Regeneration** - Regenerate tracking ID without losing history
- ✅ **Dispatch Control** - Prevent dispatch if no stock, deduct stock only at actual dispatch
- ✅ **Full Audit Logs** - All actions logged for compliance
- ✅ **Status Flow**: label_created → awaiting_stock → ready_to_dispatch → dispatched

### Raw Material Inventory Math Fix (COMPLETE)
- ✅ **Fixed Aggregation Bug** - `production_consume` entries with negative quantities now handled correctly using `$abs`
- ✅ **Recalculated Running Balances** - All existing ledger entries corrected
- ✅ **Verified Stock Calculation** - HIGHSTAR100 now shows correct stock (30 @ Energy Solutions, 85 @ Pvt Ltd)

### Admin Dashboard Enhancements (COMPLETE)
- ✅ **Production Tab** - Shows all production requests with status, quantity, and role
- ✅ **Inventory Tab** - Shows stock summary cards and current stock table
- ✅ **Supervisor Payables Tab** - Full payment management with Pay button per record
- ✅ **Payment Dialog** - Admin can record payments with amount, date, reference, notes

### Dispatch Form Serial Selection Fix (COMPLETE)
- ✅ **Dropdown Selection** - Serial numbers now load when selecting manufactured item from dropdown
- ✅ **is_manufactured Flag** - Properly set when selecting from available products dropdown
- ✅ **Async Serial Fetch** - API call to fetch available serials after SKU selection

### Test Data Cleanup (COMPLETE)
- ✅ **Removed Test Users** - Deleted support@, support2@, accountant@, technician@, technician2@, supervisor@musclegrid.in
- ✅ **Removed Test Firms** - Deleted all firms starting with "TEST_"

### Raw Materials - Firm-Agnostic Refactor (COMPLETE)
- ✅ **Global Definitions** - Raw materials are now defined globally (no firm_id)
- ✅ **Per-Firm Stock** - Stock is tracked per firm via inventory ledger entries
- ✅ **Stock by Firm Display** - API returns stock_by_firm array and total_stock
- ✅ **Simplified Transfers** - Same item_id used for transfers between firms
- ✅ **Frontend Updated** - Raw Materials tab shows global materials with per-firm breakdown

### UI Improvements (COMPLETE)
- ✅ **Enhanced Serial Selection** - Table-based selection for >5 serials in dispatch form
- ✅ **Removed Old Production UI** - Cleaned up obsolete production tab from AccountantInventory
- ✅ **Removed Query Limits** - All `.to_list(500)` limits increased to 10000

### Supervisor Payables (COMPLETE)
- ✅ **Payment UI Implemented** - Admin can record payments in Admin Dashboard
- ✅ **Payment Status** - Tracks unpaid → part_paid → paid progression

---

### Manufactured Items - Serial Number Based Inventory (COMPLETE)

#### Key Rule: Manufactured Items ONLY Exist with Serial Numbers
- ✅ **Ledger Entry Blocks** - Cannot add stock for manufactured items via purchase/adjustment
- ✅ **Production Workflow Required** - Must use Production Request to produce manufactured items
- ✅ **Serial Numbers Mandatory** - Each unit requires unique serial number during production

#### Inventory View Enhancements
- ✅ **Serial Numbers Column** - Shows all serial numbers in stock for manufactured items
- ✅ **Manufactured Badge** - Clear visual indicator (purple badge)
- ✅ **Serial Count Display** - Shows first 3 serials + "X more" for larger quantities
- ✅ **Stock Based on Serials** - Count from `finished_good_serials` not ledger

#### Dispatch with Serial Selection
- ✅ **Serial Dropdown** - Lists available in_stock serials for manufactured SKU
- ✅ **Mandatory Selection** - Cannot dispatch without selecting a serial number
- ✅ **Status Update** - Serial automatically marked as "dispatched" after dispatch
- ✅ **Full Traceability** - Dispatch record includes serial_number, master_sku_id

#### Production Workflow (Full Test Completed)
1. ✅ Create Master SKU with `product_type=manufactured`, `manufacturing_role=technician/supervisor`
2. ✅ Add Bill of Materials (BOM) - specifies raw materials per unit
3. ✅ Accountant creates Production Request - shows raw material requirements with sufficiency check
4. ✅ Technician/Supervisor accepts job → starts → completes with serial numbers
5. ✅ Accountant receives into inventory - creates serial records, deducts raw materials
6. ✅ Items appear in inventory with serial numbers visible
7. ✅ Dispatch by selecting specific serial number

---

### Historical Data Import & Serial-Based Dispatch (COMPLETE)

#### Data Import Completed
- ✅ **689 battery production records** imported from BatteryOrderSheet_Report.csv
- ✅ **689 serial numbers** registered in `finished_good_serials` collection
- ✅ **688 supervisor payables** created (81 repaired batteries skipped as per requirement)
- ✅ **56 serial numbers currently in_stock** (rest already dispatched)
- ✅ Import script: `/app/backend/import_battery_data.py`

#### Serial-Based Dispatch for Manufactured Items
- ✅ **Mandatory serial selection** - Manufactured items MUST have serial number selected for dispatch
- ✅ **Serial number dropdown** - Shows available in_stock serials for selected firm/SKU
- ✅ **Stock validation** - Only in_stock serials can be dispatched
- ✅ **Serial status update** - Serial marked as "dispatched" when dispatch created
- ✅ **Full traceability** - Dispatch record includes serial_number and master_sku_id

#### Bug Fixes
- ✅ Fixed SKU lookup to count manufactured item stock from `finished_good_serials` collection
- ✅ Fixed search-for-dispatch endpoint for same issue

---

### Production Request & Serial-Based Manufacturing Module (COMPLETE)

#### Master SKU Enhancements
- ✅ **product_type**: `manufactured` or `traded` - Controls which products can use production workflow
- ✅ **manufacturing_role**: `supervisor`, `technician`, or `none` - Routes request to correct dashboard
- ✅ **production_charge_per_unit**: Contractor charge for supervisor-made products (auto-creates payable)

#### Production Request Workflow
1. ✅ **Accountant creates request** - Select firm, manufactured SKU, quantity, target date
2. ✅ **Request routes to role** - Battery SKUs → Supervisor, Inverter SKUs → Technician  
3. ✅ **Manufacturer accepts** - Job appears in their queue
4. ✅ **Manufacturer starts** - Status changes to "in_progress"
5. ✅ **Manufacturer completes** - Must enter all serial numbers (unique, validated)
6. ✅ **Accountant confirms receipt** - Triggers:
   - Raw material consumption ledger entries
   - Finished goods production output ledger entries
   - Serial number records in `finished_good_serials` collection
   - Supervisor payable creation (if supervisor-made)

#### Supervisor Payable Ledger
- ✅ **Automatic calculation** - Rate × Quantity = Total Payable
- ✅ **Payment tracking** - Record payments with reference, update status (unpaid → part_paid → paid)
- ✅ **Summary view** - Total earned, paid, pending amounts

#### Serial Number Tracking
- ✅ **Unique serials** - Each manufactured unit gets a unique serial number
- ✅ **Full traceability** - Serial linked to: Master SKU, firm, production request, manufacturer, date
- ✅ **Status tracking** - in_stock, dispatched, returned

#### Backend API Endpoints
- ✅ `POST /api/production-requests` - Create production request
- ✅ `GET /api/production-requests` - List with role-based filtering
- ✅ `GET /api/production-requests/{id}` - Get specific request
- ✅ `PUT /api/production-requests/{id}/accept` - Accept job
- ✅ `PUT /api/production-requests/{id}/start` - Start production
- ✅ `PUT /api/production-requests/{id}/complete` - Complete with serial numbers
- ✅ `PUT /api/production-requests/{id}/receive` - Receive into inventory
- ✅ `PUT /api/production-requests/{id}/cancel` - Cancel request
- ✅ `GET /api/supervisor-payables` - List payables with summary
- ✅ `PUT /api/supervisor-payables/{id}/payment` - Record payment
- ✅ `GET /api/finished-good-serials` - List serial numbers
- ✅ `GET /api/finished-good-serials/available/{master_sku_id}` - Get available for dispatch

#### Frontend Pages
- ✅ **Accountant Production** (`/accountant/production`)
  - Create Production Request dialog
  - Production Requests tab with status filter
  - Supervisor Payables tab with summary
  - Receive into inventory action
- ✅ **Supervisor Production** (`/supervisor/production`)
  - Production Queue (pending + in-progress jobs)
  - Accept Job / Start Production / Complete buttons
  - Serial number entry form
  - Completed history tab
  - My Earnings tab with payable summary
- ✅ **Technician Production** (`/technician/production`)
  - Production Queue (pending + in-progress jobs)
  - Accept Job / Start Production / Complete buttons  
  - Serial number entry form
  - Completed history tab (no earnings)

#### Files Created/Modified
- `/app/backend/server.py` - Added production request, payable, serial endpoints
- `/app/frontend/src/pages/accountant/ProductionRequests.jsx` - NEW
- `/app/frontend/src/pages/supervisor/SupervisorProduction.jsx` - NEW
- `/app/frontend/src/pages/technician/TechnicianProduction.jsx` - NEW
- `/app/frontend/src/pages/admin/AdminMasterSKU.jsx` - Added product_type, manufacturing_role, charge fields
- `/app/frontend/src/App.js` - Added routes
- `/app/frontend/src/components/layout/DashboardLayout.jsx` - Added navigation links

---

### Ticket Source Indicator & Mandatory Invoice Upload (COMPLETE)

#### Feature 1: Ticket Source Indicator
- ✅ **Technician Dashboard**: Shows "CRM" (blue badge) or "Walk-in" (purple badge) for each ticket in repair queue
- ✅ **My Recent Repairs**: Shows source badges on completed repairs
- ✅ **Ticket Details Dialog**: Shows "Source: CRM" or "Source: Walk-in" in Status Information
- ✅ **Accountant Dashboard**: Repaired Items tab shows CRM/Walk-in badges
- ✅ **Dispatcher Dashboard**: Dispatch queue shows CRM/Walk-in badges for repair dispatches

#### Feature 2: Mandatory Invoice Upload on Ticket Creation
- ✅ **Customer Create Ticket Page**: Added mandatory "Purchase Invoice" upload field
- ✅ **File Types Accepted**: PDF, JPG, JPEG, PNG
- ✅ **Validation**: Submit button disabled until invoice is uploaded
- ✅ **Upload UI**: Drag-drop style upload area with file name display

#### Invoice Visibility Across Roles
- ✅ **Call Support Dashboard**: "Customer Invoice" section in ticket details dialog with "View Invoice Document" link
- ✅ **Supervisor Dashboard**: Invoice link in ticket details
- ✅ **Supervisor Warranties**: Prominent "Customer Invoice (Review Before Approving)" section in warranty approval dialog
- ✅ **Accountant Dashboard**: "Invoice" column in Repaired Items tab with View link
- ✅ **Technician Dashboard**: "Customer Invoice" section in ticket details dialog
- ✅ **Dispatcher Dashboard**: "Invoice" column in dispatch queue with View link

#### Files Modified
- `/app/frontend/src/pages/customer/CreateTicket.jsx` - Added invoice upload field with validation
- `/app/frontend/src/pages/technician/TechnicianDashboard.jsx` - Added CRM/Walk-in badges, invoice link
- `/app/frontend/src/pages/support/CallSupportDashboard.jsx` - Added invoice link in details
- `/app/frontend/src/pages/accountant/AccountantDashboard.jsx` - Added CRM/Walk-in badges, invoice column
- `/app/frontend/src/pages/dispatcher/DispatcherDashboard.jsx` - Added CRM/Walk-in badges, invoice column
- `/app/frontend/src/pages/supervisor/SupervisorWarranties.jsx` - Prominent invoice display in approval dialog

### Master SKU System with Bill of Materials (NEW - COMPLETE)

#### Architecture
- ✅ **Master SKU** = Company-wide product definition (not per-firm)
- ✅ **Stock** = Tracked per-firm at Master SKU level via inventory_ledger
- ✅ **Platform Aliases** = One product can have multiple SKU codes (Amazon, Flipkart, Website, etc.)
- ✅ **Manufacturing Flag** = Mark products as "manufactured" vs "purchased"
- ✅ **Bill of Materials (BOM)** = Define raw materials + quantities needed per unit of finished product
- ✅ **Production** = Uses BOM to auto-calculate raw material consumption

#### Backend APIs
- ✅ `GET /api/master-skus` - List all Master SKUs with filters (category, is_manufactured, search)
- ✅ `GET /api/master-skus/{id}` - Get specific Master SKU
- ✅ `POST /api/master-skus` - Create Master SKU
- ✅ `PATCH /api/master-skus/{id}` - Update Master SKU (including BOM)
- ✅ `POST /api/master-skus/{id}/aliases` - Add platform alias
- ✅ `DELETE /api/master-skus/{id}/aliases/{code}` - Remove alias
- ✅ `GET /api/master-skus/{id}/stock` - Get stock by firm for specific SKU
- ✅ `GET /api/master-skus/stock/all` - Get stock for all SKUs (optional firm filter)

#### Data Model
```json
{
  "id": "uuid",
  "name": "MuscleGrid 1000VA Inverter",
  "sku_code": "MG-INV-1000",
  "category": "Inverter",
  "is_manufactured": true,
  "bill_of_materials": [
    {"raw_material_id": "uuid", "quantity": 2}
  ],
  "aliases": [
    {"alias_code": "AMZ-INV-001", "platform": "Amazon", "notes": "FBA SKU"}
  ],
  "reorder_level": 10
}
```

#### Frontend
- ✅ **Master SKU Management page** (`/admin/master-sku`)
  - Stats: Total SKUs, Manufactured Products, With BOM Defined, With Platform Aliases
  - Search and filters (Category, Type)
  - "Create Master SKU" button
  - Table with SKU Code, Name, Category, Type badge, BOM count, Aliases count, Status, Actions
- ✅ **Create Master SKU Dialog**
  - Name, SKU Code, Category, HSN Code, Unit, Reorder Level
  - "This product is Manufactured" toggle switch
  - Description
- ✅ **BOM Management Dialog** (Factory icon)
  - Add/remove raw materials with quantities per unit
  - "Save BOM" button
- ✅ **Alias Management Dialog** (Tag icon)
  - List current aliases with remove option
  - Add new alias form (Alias Code, Platform, Notes)

### Production Module Enhanced with BOM (UPDATED)

- ✅ Production now uses Master SKU with BOM
- ✅ `use_bom=true` (default) auto-calculates materials from BOM × quantity
- ✅ Production dropdown shows only `is_manufactured=true` Master SKUs
- ✅ BOM preview shows material needs and current stock
- ✅ Validation: BOM must be defined before production

### Stock Movement Reports (NEW - COMPLETE)

#### Frontend
- ✅ **Stock Reports page** (`/admin/reports`) - Admin only
- ✅ **Summary Header Cards**:
  - Total Inward (Purchases + Transfers In + Returns)
  - Total Outward (Dispatches + Transfers Out + Adjustments)
  - Inter-Firm Transfers (GST-compliant count)
  - Stock Adjustments (Manual + Repair Yard)
- ✅ **5 Report Tabs**:
  - Stock Ledger (all entries with Entry #, Date, Type, Item, Firm, Qty, Balance, Invoice/Ref, Reason, By)
  - Current Stock (Raw Materials, Finished Goods by Firm with Low Stock alerts)
  - Transfers (inter-firm transfers with invoice numbers)
  - Dispatch & Returns (side-by-side comparison)
  - Adjustments (with mandatory reasons)
- ✅ **Filters**: Firm, Entry Type, Date Range
- ✅ **Export CSV**: All report types exportable
- ✅ **Navigation**: Stock Reports link in Admin sidebar

#### Backend APIs
- ✅ `GET /api/reports/stock-ledger` - Ledger entries with filters
- ✅ `GET /api/reports/current-stock` - Current stock by firm
- ✅ `GET /api/reports/transfers` - Inter-firm transfer report
- ✅ `GET /api/reports/dispatch-return` - Dispatch and return report
- ✅ `GET /api/reports/adjustments` - Adjustments report
- ✅ `GET /api/reports/export/csv` - CSV export

### Production Module (NEW - COMPLETE)

#### Architecture
- ✅ Consume raw materials to produce finished goods
- ✅ All changes through immutable ledger entries
- ✅ Stock validation before production
- ✅ Full audit trail

#### Backend APIs
- ✅ `POST /api/production` - Create production entry
  - Validates firm exists and is active
  - Validates output SKU exists
  - Validates raw material stock is sufficient
  - Creates `production_consume` ledger entries for each raw material
  - Creates `production_output` ledger entry for finished good
  - Updates raw material and SKU stock
  - Creates audit log entry
- ✅ `GET /api/productions` - List production records with filters
- ✅ `GET /api/productions/{id}` - Get specific production record

#### Frontend
- ✅ **Production Tab** in Accountant Inventory page
- ✅ **Productions Stat Card** showing count
- ✅ **New Production Button** (emerald color)
- ✅ **Create Production Dialog**:
  - Firm selection
  - Raw Materials to Consume section (dynamic add/remove)
  - Output Finished Good section (SKU select + quantity)
  - Batch Number (optional)
  - Notes (optional)
  - Info text explaining stock changes
- ✅ **Production Records Table** showing Production #, Date, Firm, Output, Qty Produced, Materials Used, Batch #, Created By
- ✅ **Ledger Entry Badges**: production_consume (pink), production_output (emerald)

#### New Ledger Entry Types
- `production_consume` - Raw material consumed for production
- `production_output` - Finished good produced

### Incoming Inventory Queue - Gate Inward Classification (NEW)

#### Architecture
- ✅ **Gate Scan Behavior**: Inward scans create `incoming_queue` entry - NO direct stock impact
- ✅ **Classification Required**: Stock only changes after accountant/admin classification
- ✅ **Four Classification Types**:
  - `repair_item` → Links to ticket, sends to technician queue
  - `return_inventory` → Creates `return_in` ledger entry, increases stock
  - `repair_yard` → Creates `repair_yard_in` ledger entry (mandatory reason)
  - `scrap` → Marks as dead stock, no inventory impact

#### Backend APIs
- ✅ `GET /api/incoming-queue` - List queue entries with filters
- ✅ `GET /api/incoming-queue/pending-count` - Pending items count
- ✅ `POST /api/incoming-queue` - Manual entry creation
- ✅ `POST /api/incoming-queue/{id}/classify` - Process classification

#### Frontend
- ✅ **Incoming Inventory Queue page** (`/accountant/incoming-queue`)
  - Stats: Pending, Processed, Returns Added, Repair Yard Added
  - Tabs: Pending (with Classify button) / Processed (with details)
  - Classification dialog with 4 type options
  - Firm/Item/Quantity selection for inventory classifications
  - Mandatory reason for repair_yard entries

#### Compliance Rules Enforced
- ✅ No auto-increment on gate scan - classification required
- ✅ Duplicate processing blocked
- ✅ Full audit trail for all classifications
- ✅ Mandatory reason for repair_yard stock additions

### Stock Deduction on Dispatch

#### Backend Implementation
- ✅ **Stock Deduction Trigger**: Stock deducts ONLY when dispatcher marks dispatch as "dispatched"
- ✅ **New Ledger Entry Type**: `dispatch_out` added to LEDGER_ENTRY_TYPES
- ✅ **Insufficient Stock Blocking**: Returns 400 error if stock < 1 when trying to dispatch
- ✅ **Ledger Entry Fields**: Captures firm_id, sku_id, quantity, dispatch_id, dispatch_number, invoice_number, created_by, timestamp
- ✅ **Audit Log**: Creates `dispatch_stock_deducted` audit entry with before/after stock values
- ✅ **DispatchResponse Model**: Added `stock_deducted` and `ledger_entry_id` fields

#### Flow
1. Accountant creates dispatch → Status: `pending_label` → **NO stock deduction**
2. Accountant uploads label → Status: `ready_for_dispatch` → **NO stock deduction**
3. Dispatcher marks as `dispatched` → **STOCK DEDUCTED** via `dispatch_out` ledger entry

#### Frontend Display
- ✅ **Ledger Tab**: `dispatch_out` entries shown with purple "Dispatch (Sale)" badge
- ✅ **Quantity Display**: Shows -1 in red for deductions
- ✅ **Running Balance**: Displays correct balance after deduction

### Multi-Firm Inventory & Compliance System - Phase 2

#### Backend Enhancements
- ✅ **Mandatory Reason for Adjustments**: `adjustment_in` and `adjustment_out` ledger entries now REQUIRE a reason
- ✅ **Dispatch with Firm**: `POST /api/dispatches` now accepts `firm_id` parameter
  - Validates firm exists and is active
  - Validates SKU exists in selected firm with available stock
- ✅ **SKU Filtering**: `GET /api/admin/skus` enhanced with `firm_id` and `in_stock_only` parameters
- ✅ **SKU Creation with Firm**: SKUs can now be created with `firm_id` association

#### Frontend Enhancements
- ✅ **Create Outbound Dispatch**: Now requires firm selection FIRST
  - "Required for inventory tracking" label shown
  - SKU dropdown disabled until firm selected
  - Only shows SKUs with stock > 0 in selected firm
- ✅ **Add Stock Entry Dialog**: Shows mandatory indicator for reason when adjustment type selected
  - Orange text "* (Mandatory for adjustments)"
  - Orange border on empty reason field
  - Placeholder changes to "MANDATORY: Enter reason..."

### Multi-Firm Inventory & Compliance System - Phase 1

#### Backend APIs
- ✅ **Firm CRUD**: `GET/POST/PATCH /api/firms` - Manage legal entities with GSTIN
- ✅ **Raw Material CRUD**: `GET/POST/PATCH /api/raw-materials` - Manage raw materials per firm
- ✅ **Inventory Ledger**: `POST /api/inventory/ledger` - THE ONLY way to change stock
  - Entry types: purchase, transfer_in, transfer_out, adjustment_in, adjustment_out
- ✅ **Stock Transfer**: `POST /api/inventory/transfer` - GST-compliant inter-firm transfers
  - Creates dual ledger entries (transfer_out + transfer_in)
  - **Mandatory invoice number** for GST compliance
- ✅ **Stock Views**: `GET /api/inventory/stock`, `/api/inventory/stock-by-firm`

#### Frontend Pages
- ✅ **Admin Firms Management** (`/admin/firms`)
  - Stats: Total, Active, Inactive firms
  - Table with GSTIN, State, Contact, Status
  - Create/Edit/View/Deactivate firm dialogs
  - GSTIN validation
- ✅ **Accountant Inventory** (`/accountant/inventory`)
  - Stats: Total Raw Materials, Active Firms, Low Stock Alerts, Transfers
  - Tabs: Current Stock, Raw Materials, Ledger, Transfers
  - Add Raw Material dialog
  - Add Stock Entry dialog (Purchase, Adjustment +/-)
  - Transfer Stock dialog with mandatory invoice warning

#### Compliance Rules Enforced
1. ✅ **No Direct Stock Editing** - All changes through ledger entries
2. ✅ **Mandatory Invoice for Transfers** - API rejects without invoice
3. ✅ **Negative Stock Prevention** - Validates available quantity
4. ✅ **Firm-Level Isolation** - All records tagged with firm_id
5. ✅ **Immutable Ledger** - Entries cannot be deleted

#### Data Models Added
- `Firm`: id, name, gstin, address, state, pincode, contact_person, phone, email, is_active
- `RawMaterial`: id, name, sku_code, unit, hsn_code, reorder_level, current_stock, firm_id
- `InventoryLedger`: id, entry_number, entry_type, item_type, item_id, firm_id, quantity, running_balance, invoice_number, etc.
- `StockTransfer`: id, transfer_number, item_type, item_id, from_firm_id, to_firm_id, quantity, invoice_number, ledger_out_id, ledger_in_id

---

## Previous Changes (March 19, 2026)

### Bug Fixes (March 19, 2026)
- ✅ **Technician My Repairs not updating**: Fixed query to include `ready_for_dispatch` status for walk-in tickets
- ✅ **Dispatcher Recent Dispatches showing zero**: Added `/api/dispatcher/recent` endpoint and Recent Dispatches section
- ✅ **Admin Orders only showing new orders**: Added tabs for New Orders, Repairs, and Walk-ins

### Admin Repairs Page (NEW)
- ✅ New "Repairs" link in Admin sidebar
- ✅ Dedicated page showing all repair activities
- ✅ 7 stat cards: Total, Awaiting, In Repair, Completed, Awaiting Invoice, Ready to Ship, Walk-ins
- ✅ Full table with serial numbers (Board, Device), status, walk-in badges
- ✅ View dialog with complete repair details

### Admin Orders Tabs (NEW)
- ✅ Renamed to "Orders & Dispatches"
- ✅ 5 stat cards: Total, New Orders, Repairs, Walk-ins, Shipped
- ✅ 3 tabs: New Orders, Repairs, Walk-ins
- ✅ Each tab shows relevant dispatches with serial numbers

### Dispatcher Recent Dispatches (NEW)
- ✅ "Recent Dispatches" section showing last 50 dispatched items
- ✅ Type badges: Repair, Walk-in, new order, return, reverse pickup
- ✅ Shows courier, tracking ID, dispatch timestamp

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

# MuscleGrid CRM - Enterprise Edition

## Overview
Enterprise-grade Customer Service & Logistics CRM for MuscleGrid products (inverters, batteries, stabilizers). Matches the original PHP/MySQL CRM functionality with modern React/FastAPI stack.

**Domain**: crm.musclegrid.in  
**Company**: MuscleGrid Industries Private Limited  
**GST**: 07AATCM1213F1ZM  
**Address**: 24, B2, Neb Sarai, New Delhi 110068  
**Support Email**: service@musclegrid.in  
**Support Phone**: +91 98000 06416  
**Status**: Production Ready  
**Last Updated**: April 10, 2026

---

## New Features (April 10, 2026)

### 1. Enhanced "Fix Missing Invoice Data" UI ✅
The Sales Register page now provides a comprehensive UI to fix dispatches that have missing data required for invoice generation.

**Location**: Finance → Sales Register (orange alert card appears when dispatches have missing data)

**Features:**
- **Orange Alert Banner**: Shows count of dispatches with missing data
- **Table View**: Lists all problematic dispatches with Dispatch #, Customer, SKU, and Missing Fields
- **Fix Button**: Opens a dialog to enter missing information
- **Missing Field Types**:
  - `state` → State dropdown for customer's state
  - `customer_name` → Text input for customer name
  - `valid_sku` / `sku_price` → SKU selector dropdown showing only SKUs with valid prices
- **SKU Selector**: When SKU is invalid or has no price, user can select a valid SKU from master list
- **Selling Price Override**: Optional manual price override when selecting a different SKU

**Backend Updates:**
- `PATCH /api/admin/dispatches/{dispatch_id}` now accepts `master_sku_id` and `selling_price` fields
- Allows fixing dispatch data without navigating to separate SKU management pages

**Workflow:**
1. Click "Generate from Dispatches" to backfill invoices
2. If dispatches have missing data, they appear in the orange alert table
3. Click "Fix" on any dispatch to open the dialog
4. Fill in missing fields (state, customer name, or select valid SKU)
5. Click "Save & Retry" to update dispatch and retry invoice generation

---

## New Features (April 9, 2026)

### 1. Edit Import Shipments in Draft Stage ✅
- Draft import shipments can now be fully edited (tracking ID, supplier, amounts, items, expenses)
- Shipment number now uses Tracking ID instead of auto-generated IMP-xxxx format
- Edit button visible only for draft status shipments

### 2. Auto Sales Invoice from Dispatches ✅
- Every dispatch now automatically creates a corresponding sales invoice
- Invoices include proper GST breakdown (IGST or CGST/SGST based on state codes)
- Backfill API available to generate invoices for past dispatches: `POST /api/sales-invoices/backfill`

### 3. GST Reports (GSTR-1 & GSTR-3B) ✅
Added GST return export functionality:
- **GSTR-1 Export**: `GET /api/gst/gstr1/export?firm_id=xxx&month=YYYY-MM`
  - B2B Supplies (registered recipients with GSTIN)
  - B2C Large (inter-state > 2.5L)
  - B2C Small (other unregistered)
  - HSN Summary
  - Total GST breakdown
- **GSTR-3B Export**: `GET /api/gst/gstr3b/export?firm_id=xxx&month=YYYY-MM`
  - Outward supplies summary
  - ITC from purchases, imports, expenses
  - Net tax payable calculation
  - Tax payment summary

### 4. Bank Statement Reconciliation ✅
New comprehensive bank reconciliation tool at `/finance/bank-reconciliation`:
- **Supported Banks**: IDFC First Bank, HDFC Bank
- **Upload**: Excel statement upload with auto-parsing
- **Auto-Categorization**: Transactions auto-categorized into:
  - Export payments (SWIFT/TT/Foreign remittance)
  - Customs duty (ICEGATE/BOE payments)
  - Courier charges (FedEx/DHL/Delhivery)
  - Marketplace settlements (Amazon/Flipkart)
  - Salary payments
  - Bank charges
  - GST payments
  - Supplier payments (NEFT/RTGS debits)
  - Sales receipts (NEFT/RTGS/UPI credits)
- **Auto-Match**: Match transactions with CRM entries (import shipments, expenses, invoices)
- **Create Entries**: Create expense/receipt entries from unmatched transactions

**Backend Endpoints:**
- `POST /api/bank-statements/upload` - Upload Excel statement
- `GET /api/bank-statements` - List uploaded statements
- `GET /api/bank-statements/{id}` - Get statement with transactions
- `POST /api/bank-statements/{id}/auto-match` - Auto-match transactions
- `POST /api/bank-statements/{id}/match-transaction` - Manual match
- `POST /api/bank-statements/{id}/create-expense` - Create expense from transaction

---

### Export CSV Functionality Added to Financial Dashboards ✅

Added "Export CSV" buttons across all major financial dashboards for easy data export.

**Dashboards with Export CSV:**
1. **Sales Register** (`/accountant/sales-register`)
   - Exports all sales invoices with line item details
   - Fields: Invoice #, Date, Firm, Party, GSTIN, State, Taxable Value, IGST/CGST/SGST, Total, Payment Status
   
2. **Expenses & Tax Credits** (`/accountant/expenses`)
   - Exports all expenses from marketplace fees, salaries, and manual entries
   - Includes TCS/TDS credit entries from journal entries
   - Fields: Date, Description, Category, Firm, Reference, Gross Amount, GST, Net Amount, Source
   
3. **Import Costing Engine** (`/finance/import-costing`)
   - Exports all import shipments with item-level landed cost breakdown
   - Includes duty calculations (BCD, SWS, IGST) and expense proration
   - Fields: Shipment summary, item-wise landed costs, expense breakdown

**Note:** Purchase Register already had Export CSV functionality.

**Backend Endpoints Added:**
- `GET /api/sales-invoices/export/csv`
- `GET /api/expenses/export/csv`
- `GET /api/import-shipments/export/csv`

---

### Import Costing Engine ✅

A comprehensive tool for calculating landed costs of imported goods with full GST/ITC tracking.

**Features:**
- **Assessable Value Calculation (UPDATED April 9, 2026)**: Auto-calculates assessable value using standard customs rules
  - `Assessable Value = Invoice Value + Freight + Insurance`
  - **Freight**: Default 20% of invoice value (customs standard) OR manual USD entry
  - **Insurance**: Default 1.125% of invoice value (customs standard) OR manual USD entry
  - User can switch between "% of Invoice" or "Manual USD" for each
  - Real-time display showing Invoice + Freight + Insurance = Total USD → INR conversion
- **Exchange Rate Calculation**: Auto-calculates USD→INR rate from proforma USD amount vs bank INR debit
- **Multi-Item Support**: Multiple items with different HSN codes and BCD rates in single shipment
- **Duty Calculations**: BCD (variable %), SWS (10% of BCD), IGST (18% on assessable + BCD + SWS)
- **Expense Tracking**: Handling fees, shipping, bank charges - all with GST
- **Firm-wise Tracking**: Each import shipment is associated with a specific firm

**Outputs:**
1. **Landed Cost per SKU**: Total cost including assessable value + duties + prorated expenses
2. **Cost per Unit**: Per-unit landed cost
3. **Cost per Unit (without GST)**: Effective cost after ITC claim - this is the true procurement cost
4. **GST Input Total (ITC)**: IGST at customs + GST on expenses - claimable amount
5. **Effective Cost After ITC**: Grand total minus IGST (since IGST is recoverable)

**Integration:**
- On finalization, creates **Purchase Register** entry with full duty breakdown
- Creates **Expense Ledger** entries for each expense (with GST marked as claimable)

**Location:** Finance → Import Costing

---

## Bug Fixes (April 9, 2026)

### FIXED: Stock Transfer Entries Showing Blank Values in Registers ✅

**Issue**: Stock transfers created sales/purchase register entries with blank item names and no values (Taxable, GST, Total showed as empty).

**Root Cause**: The `create_stock_transfer` function in backend was creating `sales_invoices` and `purchases` with different field names than what the frontend expected:
- Sales: Used `subtotal`/`gst_amount`/`total_amount` instead of `taxable_value`/`total_gst`/`grand_total`
- Items: Used `description` instead of `name`, missing `rate`/`taxable_value`

**Fix Applied**:
1. **Backend (`server.py`)**: Updated stock transfer to create invoices/purchases with consistent field names:
   - Added `taxable_value`, `total_gst`, `grand_total` at top level
   - Added proper `name`, `rate`, `taxable_value` fields in items array
   - Added `total_taxable`, `total_gst` for purchases

2. **Frontend (`SalesRegister.jsx` & `PurchaseRegister.jsx`)**:
   - Added fallback field mappings (e.g., `taxable_value || subtotal || 0`)
   - Fixed item display to handle alternative field names
   - Fixed stats calculations to handle null values

**Verification**: Stock transfer entries now display correctly with proper item names and values.

---

### FIXED: Salary Payments Not Appearing in Expense Ledger ✅

**Issue**: When admin marked salaries as "Paid" via the Payroll module, the payments were not showing up in the Expenses & Tax Credits dashboard.

**Root Cause**: The `bulk_mark_payroll_paid` endpoint only updated the payroll status to "paid" but did NOT create corresponding entries in the `expense_ledger` collection. The single `mark_payroll_paid` endpoint correctly created expense entries, but bulk payments did not.

**Fix Applied**:
1. **Backend (`server.py`)**: Updated `bulk_mark_payroll_paid` function to:
   - Fetch all eligible payroll records before marking them paid
   - Create expense ledger entries for each payroll (matching the single payment logic)
   - Include full breakdown: fixed_salary, incentives, bonus, reimbursements, deductions
   - Also mark associated incentives as paid

2. **Frontend (`ExpensesDashboard.jsx`)**: 
   - Added fetch from `/admin/expenses` endpoint with `category: salary` filter
   - Combined salary expenses with regular expenses in the UI
   - Added "Salary Payments" stat card (cyan color)
   - Added "salary" category to `EXPENSE_CATEGORIES` with Users icon

**Verification**: Salary payments now appear in Expenses & Tax Credits dashboard with proper categorization.

---

## Recent Changes (April 8, 2026)

### NEW: Multi-Item Pending Fulfillment Entries ✅

**Feature**: Accountant can now add multiple products in a single pending fulfillment entry.

**Use Case**: Orders with multiple SKUs can now be tracked as a single entry with proper stock tracking for each item.

**UI Components**:
- **"Products" Section** - Border box with "Products *" label
- **"Add Product" Button** - Adds new product row
- **Product Row** - SKU dropdown + Quantity input + Remove button (trash icon)
- **Table Display** - Shows all items per entry with SKU code and quantity (e.g., "MG24V120AH x2")

**Backend Changes**:
- New `PendingFulfillmentItem` model: `{master_sku_id, quantity}`
- Updated `PendingFulfillmentCreate` to accept `items` array (multiple items) OR `master_sku_id` (backward compatibility)
- Each item stored with: `master_sku_id`, `master_sku_name`, `sku_code`, `hsn_code`, `gst_rate`, `quantity`, `current_stock`
- `all_items_in_stock` flag indicates if all items have sufficient stock
- Mark Ready checks stock for ALL items before proceeding

**Validation**:
- At least one item required
- Invalid SKU rejected
- Duplicate order_id / tracking_id rejected

---

### Amazon Historical Order Sync & Reconciliation ✅

**Feature**: Sync and process historical Amazon orders (already shipped on Amazon) for CRM reconciliation.

**Use Case**: Orders dispatched on Amazon before CRM integration can now be pulled and processed through the CRM dispatch flow.

**UI Components**:
- **"Amazon History" Stats Card** - Purple card showing count of shipped orders not yet processed in CRM
- **"Fetch Amazon History" Section** - Date picker (default: April 1, 2026) + "Fetch History" button
- **"Amazon History" Tab** - Lists orders with `crm_status: amazon_shipped`
- **"Process in CRM" Button** - Opens dialog for history orders requiring customer details
- **"Sync" Button** - For orders with missing items, refreshes items from Amazon API

**Items Display Enhancement**:
- Shows product name, SKU code, quantity
- **Green "Mapped" badge** - SKU is mapped to Master SKU
- **Red "Unmapped" badge** - SKU needs mapping before processing
- **"Sync" button** - Appears for orders with no items, calls `/api/amazon/refresh-order-items/{order_id}`

**Full Dispatch Workflow for History Orders**:
1. Accountant clicks "Fetch History" → Pulls `Shipped` status orders from Amazon (date filter)
2. Orders appear in "Amazon History" tab with "Process in CRM" button
3. Accountant clicks "Process in CRM" → Enters tracking + customer details (name, phone, city, state, pincode)
4. Order moves to **Pending Fulfillment Queue** (`pending_dispatch` status)
5. Accountant clicks "Mark Ready" → System checks stock via `get_current_stock()` → Status: `ready_to_dispatch`
6. Accountant dispatches from **Outbound Dispatch Queue** → Creates:
   - Dispatch entry with state/city/pincode (for state-wise sales)
   - Sales Order (`order_source: 'amazon'`)
   - Inventory Ledger entry (`dispatch_out` type)
7. Amazon order `crm_status` updates to `dispatched`

**API Endpoints Added/Updated**:
- `POST /api/amazon/fetch-orders/{firm_id}?order_status=Shipped&created_after_date=YYYY-MM-DD`
- `POST /api/amazon/refresh-order-items/{amazon_order_id}?firm_id={firm_id}` - NEW
- `GET /api/amazon/orders/{firm_id}` - Returns `amazon_shipped` in stats
- `POST /api/amazon/update-tracking` - Accepts `is_history_order` flag

**GST/HSN/Invoice Data**:
- Master SKU contains HSN code → flows to Sales Invoice
- Sales Invoice creation from dispatch captures: items, HSN, GST rate, taxable value
- State-wise sales reporting uses `state` field from dispatch/sales_order

---

## Previous Changes (April 5, 2026)

### ENHANCED: Amazon Order Flow - SKU Mapping Required ✅

**New Validation**: Cannot add tracking to Amazon orders until ALL SKUs are mapped to Master SKUs.

**UI Changes**:
- Banner: "12 Amazon SKU(s) need mapping" with "Map SKUs" button
- **"Map SKUs First"** badge (red) shown for orders with unmapped items
- **"Add Tracking"** button only enabled for orders with ALL SKUs mapped
- **"Unmapped"** badge (yellow) shown next to unmapped item names

**Backend Validation**:
- `POST /api/amazon/update-tracking` checks SKU mappings before allowing tracking
- Returns 400 error with list of unmapped SKUs if any are missing
- Pending fulfillment entry now includes `master_sku_id`, `sku_code`, `quantity` for inventory tracking

**Benefits**:
- Prevents inventory tracking issues (unmapped SKUs can't be checked against stock)
- Ensures proper sales order generation with correct product data
- Forces data hygiene before order processing

---

### ENHANCED: Push to Amazon - Better Error Handling ✅

**403 Permission Error**: Now provides helpful guidance:
> "Amazon API access denied. Please ensure your SP-API app has 'Direct-to-Consumer Shipping' role enabled in Seller Central and the refresh token has correct scopes."

**How to Fix 403**:
1. Go to Amazon Seller Central → Apps & Services → Develop Apps
2. Edit your SP-API app
3. Add "Direct-to-Consumer Shipping" role
4. Re-authorize and generate new refresh token

---

### FIX: Amazon Orders → Pending Fulfillment Status ✅

**Issue**: Amazon orders with tracking weren't showing in Pending Fulfillment Queue.

**Root Cause**: Status was `"pending"` but UI filters for `"pending_dispatch"`.

**Fix**: 
- Updated `amazon/update-tracking` to set `status: "pending_dispatch"`
- Added fix endpoint: `PUT /api/pending-fulfillment/fix-amazon-status`
- Existing orders fixed - now visible in queue

---

### FIX: GST/HSN Dashboard - Now Shows Correct Values ✅

**Issue**: GST/HSN Dashboard was showing ₹0 for taxable value and GST amounts.

**Root Cause**: Aggregation pipeline was using `$line_items` but sales invoices use `$items` array. Also needed to aggregate from dispatches for orders without invoices.

**Fix Applied**:
- Updated HSN summary aggregation to use `items` array from sales_invoices
- Added fallback aggregation from dispatches for orders without invoices
- Properly joins with `master_skus` collection for HSN code lookup

**Verification**: Dashboard now shows HSN 903290 (Stabilizer) with Taxable ₹2,900, IGST ₹522.

---

### FIX: Expenses Dashboard - Rent Amounts Now Display Correctly ✅

**Issue**: Rent entries showed ₹0 amount in Expenses & Tax Credits dashboard.

**Root Cause**: Dashboard used `e.amount` but manual expenses store in `gross_amount` field.

**Fix Applied**: Updated calculation to use `gross_amount || amount || 0` pattern.

**Verification**: Rent entries now display ₹50,000 correctly.

---

### CLARIFICATION: TDS Management vs Expenses (User Education)

**TDS Management shows 0 entries** - This is CORRECT behavior!

**Why**: TDS is only deducted when payment exceeds threshold:
- Section 194I (Rent): Threshold is ₹240,000/year
- User's rent entries (₹50,000) are below threshold, so no TDS deduction

**Key Distinction**:
- **TDS Management**: Shows TDS entries where company actually deducted TDS
- **Expenses & Tax Credits**: Shows ALL expenses regardless of TDS

If user wants TDS to be deducted on rent:
1. Create expense with amount > ₹240,000 (annual rent threshold)
2. OR accumulate rent payments and deduct TDS on last payment of year

---

### NEW: Amazon "Push to Amazon" Button ✅

**Feature**: Added ability to push tracking information to Amazon after adding it locally.

**Implementation**:
1. **Tracking Dialog** now has two buttons:
   - **Save & Queue Only**: Saves tracking locally, adds to Pending Fulfillment queue
   - **Save & Push to Amazon**: Saves tracking AND submits to Amazon SP-API

2. **New Endpoint**: `POST /api/amazon/push-tracking`
   - Uses Amazon SP-API Orders confirmShipment endpoint
   - Maps carrier codes to Amazon carrier names
   - Updates order with `amazon_tracking_pushed: true` on success

3. **Retry Capability**: Orders in "Tracking Added" status show "Push to Amazon" button if not already pushed

**Files Updated**:
- `/app/backend/server.py` - Added `/amazon/push-tracking` endpoint
- `/app/frontend/src/pages/operations/AmazonOrders.jsx` - Updated tracking dialog

---

### ENHANCED: TDS Calculation - Auto-Detect Section from Expense Type ✅

**Change**: TDS calculation now auto-detects TDS section from expense type even if party doesn't have `tds_applicable: true`.

**Benefit**: User doesn't need to pre-configure party with TDS settings. System will automatically:
1. Match expense type to TDS section (e.g., "rent" → 194I)
2. Check threshold requirements
3. Calculate TDS if applicable

---

### ENHANCED: Amazon MFN & Easy Ship Dispatch Flow ✅

**Complete Amazon Seller Integration Built:**

1. **Amazon Orders Page** (`/operations/amazon-orders`)
   - Sync orders from Amazon Seller Central with one click
   - Firm-based - each firm has separate Amazon credentials
   - Tabs: MFN Pending | Easy Ship | Tracking Added | Dispatched
   - SKU mapping alerts when Amazon SKUs don't match Master SKUs

2. **Order Flow:**
   - **MFN (Merchant Fulfilled)**: Add tracking → Goes to Pending Dispatch queue
   - **Easy Ship**: Amazon handles - no tracking needed from user

3. **SKU Mapping System:**
   - Auto-matches Amazon SKUs to Master SKUs where possible
   - Alerts for unmapped SKUs with mapping dialog
   - Once mapped, all orders with that SKU auto-link

4. **Master SKU Enhanced:**
   - Added LBH (Length, Breadth, Height) in centimeters
   - Added Weight in kilograms
   - For Amazon/Flipkart shipping compliance

**Backend Endpoints Added:**
- `POST /api/amazon/credentials` - Save Amazon API credentials per firm
- `GET /api/amazon/credentials/{firm_id}` - Check credentials status
- `POST /api/amazon/fetch-orders/{firm_id}` - Sync orders from Amazon
- `GET /api/amazon/orders/{firm_id}` - List synced orders with stats
- `POST /api/amazon/sku-mapping` - Map Amazon SKU to Master SKU
- `GET /api/amazon/unmapped-skus/{firm_id}` - Get unmapped SKUs
- `POST /api/amazon/update-tracking` - Add tracking to MFN order

**Files Created:**
- `/app/frontend/src/pages/operations/AmazonOrders.jsx`

**Test Results:**
- ✅ Connected to Ebay MRT Amazon account
- ✅ Synced 34 orders (16 MFN + 18 Easy Ship)
- ✅ 15 SKUs identified for mapping

---

### ENHANCED: Expenses with Firm Filter ✅

Added firm dropdown to Expenses & Tax Credits page for multi-firm filtering.

---

### NEW: Expenses & Tax Credits Dashboard ✅

Created a new **Expenses & Tax Credits** page accessible via Finance > Expenses & Tax Credits:

**Summary Cards:**
- Total Expenses
- Platform Fees
- Ad Spend  
- TCS Credit
- TDS Credit

**Two Tabs:**
1. **Expenses Tab**: Shows Platform/Commission Fees and Advertising/Ads expenses from marketplace statements
2. **TCS/TDS Credits Tab**: Shows journal entries for TCS and TDS credits deducted by marketplaces

**Files Created:**
- `/app/frontend/src/pages/accountant/ExpensesDashboard.jsx`

**Routes Added:**
- `/accountant/expenses` - Expenses & Tax Credits page

**Backend API Added:**
- `GET /api/journal-entries` - List journal entries for TCS/TDS credits

---

### VERIFIED: Complete E-commerce Reconciliation Flow ✅

**Finalize to Finance Button - Fully Working:**

After uploading Amazon/Flipkart statements and clicking "Finalize to Finance":

| Entry Type | Description | Created In |
|------------|-------------|------------|
| **Payment** | Marketplace Payout (Net amount) | Finance > Payments |
| **Expense** | Platform/Commission Fees | Finance > Expenses |
| **Expense** | Advertising/Ads (if any) | Finance > Expenses |
| **Journal** | TCS Credit (if any) | Journal Entries |
| **Journal** | TDS Credit (if any) | Journal Entries |

**Verified Entries:**
- Amazon Payout: ₹225,508.34 + Platform Fees: ₹16,936.99
- Flipkart Payout: ₹232,753.55 + Platform Fees: ₹47,386.73 + Ads: ₹10,517.50 + TCS: ₹1,274.22 + TDS: ₹256.18

**Party Master Bug Fixed:**
- Fixed `Cannot read properties of undefined (reading 'includes')` error
- Now handles both `party_types` (array) and legacy `party_type` (string) formats

---

### ENHANCED: Sales Invoice Auto-Fill from Dispatch ✅

**Feature Implemented:**

When creating a Sales Invoice and selecting a dispatch:
1. **Party/Customer auto-created**: 
   - For Amazon/Flipkart orders → Creates "Amazon Marketplace" or "Flipkart Marketplace" as party
   - For direct orders → Creates party with customer name from dispatch
   - Toast notification: "Auto-created party: [name]"

2. **Line Items auto-populated**:
   - SKU looked up from master_sku_id or by sku_code matching
   - HSN code from master SKU
   - GST rate from master SKU (default 18%)
   - Quantity from dispatch
   - Rate from dispatch invoice_value or SKU cost_price

3. **Dispatch details shown**: Customer name, phone displayed for reference

**Backend Updates:**
- `/api/dispatches-without-invoice` now enriches dispatches with HSN, GST rate from master SKU
- `DispatchResponse` model extended with `invoice_value`, `quantity`, `hsn_code`, `gst_rate`

**Files Updated:**
- `/app/frontend/src/pages/accountant/SalesRegister.jsx` - Auto-create party, auto-populate line items
- `/app/backend/server.py` - Enhanced dispatches-without-invoice endpoint, DispatchResponse model

---

### ENHANCED: Reconciliation Link & Marketplace Order Flow ✅

**Issues Fixed:**

1. **Reconciliation Link Dropdown Not Showing Orders**: 
   - Backend search now includes `order_id` and `marketplace_order_id` fields
   - Search auto-populates with marketplace order ID from transaction
   - Link dialog now has two tabs: "Search Dispatch" and "Manual Order ID"

2. **Manual Order ID Linking**:
   - Users can now enter a different order ID to link transactions
   - Backend API updated to support `manual_order_id` parameter

3. **Marketplace Orders - No Payment Reference Required**:
   - When Amazon/Flipkart is selected during dispatch, payment reference field is hidden
   - Shows info message: "Marketplace orders are marked as Unpaid until reconciled with statement"
   - Validation skips payment_reference for marketplace orders

4. **Order Source & Payment Status Columns Added to Sales > Orders**:
   - New "Source" column shows badge: Amazon (orange), Flipkart (yellow), Website (blue), Direct (gray)
   - New "Payment" column shows: "Unpaid" (red) for unreconciled marketplace, "Reconciled" (green) for linked, "Paid" (green) for direct

5. **BUG FIX: Matched/Unmatched Counts Not Updating After Linking**:
   - Backend now recalculates `matched_count` and `unmatched_count` on statement after each link
   - Frontend refreshes both statement details and main list after linking
   - Supports all transaction types: Order Payment, Refund, order_settlement (Flipkart)
   - Counts now show correctly on both statements list and details view

**Finalize to Finance Button Flow** (after uploading statement):
1. Click "Finalize to Finance" button on statement details
2. Creates Payment Entry for net payout in Finance > Payments
3. Creates Expense entries for platform fees in Finance > Expenses
4. Creates Expense entries for ads in Finance > Expenses
5. Creates Journal entries for TCS/TDS
6. Updates statement status to "finalized"
7. All linked orders marked as "Paid via Marketplace"

**Files Updated:**
- `/app/backend/server.py` - Search includes order_id/marketplace_order_id, link supports manual_order_id, matched/unmatched count updates
- `/app/frontend/src/pages/finance/EcommerceReconciliation.jsx` - Two-tab link dialog, refreshes list after link
- `/app/frontend/src/pages/accountant/AccountantDashboard.jsx` - Hide payment ref for marketplace
- `/app/frontend/src/pages/admin/AdminOrders.jsx` - Source and Payment columns

---

### BUG FIX: Orders Page Not Showing Amazon/Flipkart Dispatches ✅

**Issue**: User reported dispatched items (amazon_order, flipkart_order types) were not visible under Sales > Orders > New Orders tab.

**Root Cause**: The `AdminOrders.jsx` was filtering only `dispatch_type=new_order`, missing `amazon_order`, `flipkart_order`, `website_order` dispatch types.

**Fix Applied**: Updated `/app/frontend/src/pages/admin/AdminOrders.jsx` to include all new order dispatch types:
- `new_order`
- `amazon_order`
- `flipkart_order`
- `website_order`

**Test Status**: Verified - All 3 dispatches (YAMAN, Raman, jghgh) now appear correctly in New Orders tab ✅

---

### ENHANCED: E-COMMERCE RECONCILIATION WITH FLIPKART MULTI-SHEET PARSER (P1) ✅

Major enhancement to E-commerce Reconciliation module with firm-level reconciliation and comprehensive Flipkart Excel parser.

**NEW Features:**

1. **Firm-Level Reconciliation**:
   - Each firm has its own separate reconciliation
   - Firm selection required before uploading any statement
   - Statements filtered by firm in the dashboard
   - Order matching scoped to the selected firm's dispatches

2. **Flipkart Multi-Sheet Excel Parser**:
   - Supports 11 sheet types:
     - **Orders**: Order settlements with fees, taxes, shipping
     - **MP Fee Rebate**: Marketplace fee rebates
     - **Non_Order_SPF**: Seller Protection Fund claims
     - **Storage_Recall**: Storage and recall charges
     - **Value Added Services**: VAS charges
     - **Google Ads Services**: Google Ads expenses
     - **Ads**: Platform ads (wallet redeems/topups)
     - **TCS_Recovery**: TCS recovery entries
     - **TDS**: TDS deductions
     - **GST_Details**: GST breakdown (CGST, SGST, IGST)
   - Each sheet parsed separately with appropriate categorization
   - Non-order charges tracked separately from order settlements

3. **Tax Breakdown Panel (Flipkart)**:
   - Summary cards: Total TCS, Total TDS, GST on Fees, Total Taxes
   - Detailed tax entries table with CGST/SGST/IGST breakdown
   - Export tax details as Excel

4. **Non-Order Charges Tab (Flipkart)**:
   - Categories: rebate, ads, service, claim
   - Displays date, type, category, description, SKU/Order, amount
   - Color-coded badges by charge type
   - Export charges as Excel

5. **Platform-Specific Summary Cards**:
   - **Amazon**: Order Payments, Refunds, Platform Fees, Reserve Held, Reserve Released, Net Payout
   - **Flipkart**: Total Sales, Refunds, Platform Fees, Ad Spend, Service Charges, Net Payout

6. **Enhanced Dashboard Features**:
   - Firm filter dropdown in statements list
   - Platform filter dropdown
   - Conditional tabs: Charges & Tax Breakdown only for Flipkart
   - File accept changes based on platform (CSV for Amazon, XLSX for Flipkart)
   - Expected format info updates based on platform selection

**New Database Collections (Flipkart):**
- `payout_non_order_charges` - Non-order charges (ads, services, rebates)
- `payout_tax_entries` - Detailed tax entries (TCS, TDS, GST)

**Updated API Endpoints:**
- `POST /api/ecommerce/upload-payout?platform=flipkart&firm_id=xxx` - Upload Flipkart Excel
- `GET /api/ecommerce/statements?firm_id=xxx` - Filter by firm
- `GET /api/ecommerce/statements/{id}` - Now returns non_order_charges, tax_entries

**Test Status:** All 15 backend tests passed, UI verified ✅

---

### PREVIOUS: E-COMMERCE RECONCILIATION MODULE (P1) ✅

Implemented comprehensive E-commerce Reconciliation system for Amazon/Flipkart payout statement reconciliation with CRM dispatches.

**Components Built:**

1. **Statement Upload & Parsing** (`POST /api/ecommerce/upload-payout`):
   - Accepts Amazon/Flipkart payout CSV files
   - Flexible column mapping for platform-specific formats
   - Auto-detects statement period from dates
   - Supports multiple date formats and encodings

2. **Transaction Categorization**:
   - `order_payment` - Order settlement payments
   - `refund` - Customer refunds
   - `reserve_held` - Unavailable balance held
   - `reserve_released` - Previous reserve released
   - `other` - Other adjustments

3. **Order Matching** (`POST /api/dispatches` updated):
   - Primary key: `Order ID` / `marketplace_order_id`
   - Fallback: `order_id`, `external_order_id`
   - Added `order_source` field to dispatches (Amazon, Flipkart, Website, Walk-in, Direct, Other)
   - Added `marketplace_order_id` field for external order reference

4. **Reconciliation Alerts** (`GET /api/ecommerce/alerts`):
   - Unmatched orders (payout row with no CRM dispatch)
   - Unmatched refunds (refund without mapped CRM order)
   - High platform fees (>25% of sale value)
   - Missing payouts (CRM dispatch shipped but not in payout)

5. **Statement Management**:
   - `GET /api/ecommerce/statements` - List all statements
   - `GET /api/ecommerce/statements/{id}` - Statement details with transactions
   - `GET /api/ecommerce/order-reconciliation` - Order-level summaries
   - `PUT /api/ecommerce/transactions/{id}/link-crm` - Manual linking
   - `GET /api/ecommerce/export/{id}` - Export as Excel (summary, orders, transactions, refunds, unmatched)

6. **E-commerce Reconciliation Dashboard** (`/finance/ecommerce-reconciliation`):
   - Upload Statement button with platform selection
   - Statement list with Net Payout, Matched/Unmatched counts
   - Summary cards: Order Payments, Refunds, Platform Fees, Reserve Held/Released, Net Payout
   - Order Matching Progress bar
   - Transactions table with Link buttons for unmatched
   - Orders tab with finance status and CRM match
   - Alerts tab with severity-coded issues and Link to CRM actions
   - Export buttons for all views

7. **Order Source in Dispatch Form** (AccountantDashboard.jsx):
   - New "Order Source" dropdown: Amazon, Flipkart, Website, Walk-in, Direct Sale, Other
   - Conditional "Marketplace Order ID" field for Amazon/Flipkart orders
   - Helper text for reconciliation context

**New Database Collections:**
- `payout_statements` - Uploaded statement records with summaries
- `payout_transactions` - Individual transaction rows from CSV
- `payout_order_summaries` - Order-level aggregated data

**Navigation:** Finance → E-commerce Recon (`/finance/ecommerce-reconciliation`)

**Test Status:** All 16 backend tests passed, UI verified ✅

---

### FIX: PRODUCTION RECEIVE INVENTORY LEDGER BUG (P0) ✅

Fixed critical bug in Production Receive workflow where raw materials were being consumed incorrectly and manufactured items showed wrong quantities.

**Original Issues:**
1. Raw materials could be partially consumed if a later BOM item failed stock check (leading to duplicate consumption on retry)
2. Production Output entries showed `-1` (red/negative) in the inventory ledger dialog instead of `+1` (green/positive)

**Root Causes:**
1. Backend: The `receive_production_into_inventory` endpoint created ledger entries WHILE validating materials in the same loop. If material #3 failed validation, materials #1 and #2 were already consumed.
2. Frontend: The `production_output` entry type was missing from the positive entry types list in both the table and dialog display logic.

**Fixes Applied:**
1. **Backend** (`/app/backend/server.py` lines 9826-9885):
   - Separated validation phase from creation phase
   - First validates ALL BOM materials have sufficient stock
   - Only THEN creates consumption ledger entries
   - Atomic operation: all-or-nothing validation

2. **Frontend** (`AccountantInventory.jsx`):
   - Added `production_output`, `return_in`, `repair_yard_in` to positive entry types
   - Applied `Math.abs()` to quantity display for consistent rendering
   - Fixed dialog (lines 1723-1731) and table (lines 838-844)

3. **Frontend** (`StockReports.jsx`):
   - Same fix applied to stock ledger table (lines 445-451)

**Result:**
- Production Output entries now show `+1` in green (correct)
- Production Consumed entries show `-15` in red (correct)
- No more partial ledger entries on failed receive attempts
- Running balances calculate correctly

**Test Status:** All 10 backend tests passed, UI verified ✅

---

### NEW FEATURE: TDS DEDUCTION SYSTEM (P1) ✅

Implemented comprehensive Tax Deducted at Source (TDS) management system.

**Components Built:**

1. **TDS Sections Master** (`/app/backend/server.py` lines 16155-16300):
   - Pre-seeded sections: 194C, 194J, 194H, 194I, 194A
   - Section-based rates (e.g., 194C: 1% individual, 2% company)
   - Threshold-aware (per transaction and annual limits)
   - PAN-aware (20% default if PAN missing)
   - CRUD APIs for custom sections

2. **Party TDS Configuration** (`/app/frontend/src/pages/admin/PartyMaster.jsx`):
   - `tds_applicable` flag
   - `tds_section` (default section for party)
   - `tds_party_type` (individual/proprietor/firm/company/huf/aop/others)
   - PAN number field
   - Exemption certificate support

3. **TDS Calculation Engine** (`calculate_tds()` function):
   - Auto-detects applicable section from party or expense type
   - Checks thresholds before applying TDS
   - Returns gross, TDS amount, net payable breakdown

4. **Expense Entry with TDS** (`POST /expenses`):
   - Creates expense with automatic TDS calculation
   - Ledger entries: Expense Dr / Party Cr / TDS Payable Cr
   - Links TDS entry to expense

5. **TDS Dashboard** (`/app/frontend/src/pages/finance/TDSDashboard.jsx`):
   - Summary cards (Pending/Paid/Total TDS, Active Sections)
   - Section-wise summary
   - Pending/Paid entries with filters (Quarter, Section)
   - Mark as Paid workflow with challan details
   - Bulk payment support
   - CSV/Excel export

6. **TDS Entry Tracking** (`tds_entries` collection):
   - Entry number, reference, party details
   - Financial year, quarter, month
   - Status (pending/paid), challan info
   - Full audit trail

**Navigation:** Finance → TDS Management (`/finance/tds`)

**Test Status:** All 15 backend tests passed, UI verified ✅

---

### NEW FEATURE: GST HSN DASHBOARD (P1) ✅

Implemented HSN-wise sales/purchase reporting and data quality management.

**Components Built:**

1. **HSN Summary API** (`GET /gst/hsn-summary`):
   - HSN-wise sales with CGST/SGST/IGST breakdown
   - Automatic intra-state (CGST+SGST) vs inter-state (IGST) split
   - Company state configurable from firm settings
   - Purchase vs sales comparison

2. **State-wise Drilldown** (`GET /gst/hsn-drilldown/{hsn_code}`):
   - State-wise breakdown for specific HSN
   - Quantity, taxable value, GST components
   - Invoice count per state

3. **Missing Data Alerts** (`GET /gst/missing-data-alerts`):
   - Identifies dispatches missing customer state
   - Identifies Master SKUs missing HSN code or GST rate
   - Identifies parties missing state
   - Severity levels (high/medium/low)

4. **Correction Tools** (`POST /gst/correct-record`):
   - Fix missing HSN, GST rate, state
   - Full audit log (`gst_corrections_log` collection)
   - Reason required for each correction

5. **GST HSN Dashboard** (`/app/frontend/src/pages/finance/GSTHSNDashboard.jsx`):
   - Summary cards (Taxable Sales, GST Collected, IGST, Purchases, Alerts)
   - Tabs: HSN Summary, State-wise, Purchase vs Sales, Alerts
   - Clickable HSN rows for state drilldown
   - "Fix" buttons on alerts to open correction dialog
   - Date range filter
   - HSN Summary and Detailed export

6. **Export APIs** (`GET /gst/export/{export_type}`):
   - HSN Summary export with state-wise sheet
   - Detailed line-level export with GST columns

**Navigation:** Finance → GST / HSN (`/finance/gst-hsn`)

**Current Data Status:** 34 missing data alerts identified (expected - real data quality issues)

**Test Status:** All tests passed, UI verified ✅

---




## Recent Changes (April 3, 2026)

### FIX: SALES INVOICE CUSTOMER PARTY DROPDOWN ✅

Fixed empty Party/Customer dropdown in Sales Invoice creation by auto-creating customer parties.

**Root Cause:**
- Parties existed but didn't have `party_types: ["customer"]` set
- Dispatches weren't auto-creating customer party records

**Fixes Applied:**
1. Updated 51 existing parties to have `party_types: ["customer"]`
2. Added `ensure_customer_party()` helper function that creates customer party if not exists
3. Auto-creates customer party when dispatch is created (with phone, address, city, state)
4. Added `GET /sales-invoices/dispatch-details/{dispatch_id}` endpoint for auto-fill

**Result:**
- Party/Customer dropdown now shows 500+ customers
- Future dispatches will auto-create customer parties
- Sales invoice can be linked to correct party automatically

**Files Modified:**
- `/app/backend/server.py` (added ensure_customer_party, updated dispatch creation)

---

### FEATURE: COMPREHENSIVE DEALER DATA EXPORT/IMPORT ✅

Enhanced dealer data export to include ALL related data with multi-sheet Excel format.

**Export "Dealers Full" now includes:**
- **Sheet 1: dealers** - All dealer fields (22 columns including email, address, GST, etc.)
- **Sheet 2: dealer_orders** - All orders for dealers (18 columns)
- **Sheet 3: Field_Info** - Metadata explaining each field and requirements

**Import Improvements:**
- Multi-sheet import support for "dealers_full"
- Email validation made optional (dealers login via phone OTP)
- Unique field changed from email to phone
- Auto-generates IDs for new records
- Handles JSON fields (like items array)

**Tested Reimport:**
- Exported 57 dealers + 24 orders
- Reimported successfully with 0 errors

**Files Modified:**
- `/app/backend/server.py` (EXCEL_DATA_SOURCES, export/import handlers)

---

### DATA IMPORT: DEALER DATABASE UPDATE ✅

Imported latest dealer data from SQL file including emails.

**Import Summary:**
- **64 dealers** imported/updated with email addresses
- **27 orders** imported (5 new, 22 updated)
- Fixed email validation - now optional (dealers can login via phone OTP)

**Validation Fix:**
- Changed `required_fields` from `["firm_name", "phone", "email"]` to `["firm_name", "phone"]`
- Changed `unique_field` from `"email"` to `"phone"`

**Files Modified:**
- `/app/backend/server.py` (dealer export/import config)

---

### FEATURE: COMPREHENSIVE UNIQUENESS VALIDATION ✅

Expanded uniqueness checks across all CRM tables (pending_fulfillment, dispatches, tickets).

**Uniqueness Checks Now Cover:**
1. **Order ID** - Checks pending_fulfillment, dispatches, and tickets tables
2. **Tracking ID** - Checks pending_fulfillment, dispatches, and tickets (pickup/return tracking)
3. **Phone History** - Shows orders from pending_fulfillment, dispatches, AND tickets

**Serial Number Uniqueness:**
- Already enforced in `finished_good_serials` collection (existing)
- Added new endpoint `GET /serial-numbers/check-unique` for frontend validation

**Raw Material Check Before Production Receive:**
- Added `GET /production-requests/{id}/check-materials` endpoint
- Validates firm has sufficient raw materials based on BOM before receiving

**UI Updates:**
- Error messages now show the source table (e.g., "Order ID already exists in dispatches")
- Phone history shows source badge (pending_fulfillment, dispatch, ticket)
- Create Entry button disabled when validation errors exist

**Files Modified:**
- `/app/frontend/src/pages/accountant/PendingFulfillment.jsx`
- `/app/backend/server.py`

---

### FEATURE: UNIQUE ORDER/TRACKING ID VALIDATION + PHONE HISTORY ALERT ✅

Added duplicate prevention for Order ID and Tracking ID, plus phone number history lookup.

**New Features:**
1. **Order ID Uniqueness**: Real-time validation - blocks if order ID already exists in system
2. **Tracking ID Uniqueness**: Checks both pending_fulfillment and dispatches tables
3. **Phone History Alert**: Shows previous orders for the same phone number (soft warning, doesn't block)

**Backend Endpoints Added:**
- `GET /pending-fulfillment/check-unique?order_id=xxx` - Check if order/tracking exists
- `GET /pending-fulfillment/phone-history?phone=xxx` - Get previous orders for phone

**UI Improvements:**
- Red border + error message for duplicate order/tracking IDs
- Yellow alert box showing previous orders when phone number has history
- Loading spinners while checking
- "Create Entry" button disabled if validation errors exist

**Files Modified:**
- `/app/frontend/src/pages/accountant/PendingFulfillment.jsx`
- `/app/backend/server.py` (added validation endpoints)

---

### FEATURE: PENDING FULFILLMENT AUTO-FILL WORKFLOW ✅

Enhanced Pending Fulfillment queue to allow accountants to fill orders directly when stock is available.

**New Features:**
1. **"Fill All In-Stock" Button** - One-click to move all pending orders with sufficient stock to "Ready to Dispatch"
2. **Individual "Ready" Button** - Shown per row when stock >= required quantity
3. **Mark-Ready API Endpoint** - `PUT /pending-fulfillment/{id}/mark-ready` with stock validation
4. **Updated Workflow Instructions** - Clear step-by-step guide at bottom of page

**UI Fixes:**
- Fixed Create Dialog overflow for long SKU names (added `max-h-[90vh] overflow-y-auto`)
- Fixed SKU selector to truncate long product names (`[&>span]:truncate max-w-[90%]`)

**Files Modified:**
- `/app/frontend/src/pages/accountant/PendingFulfillment.jsx`
- `/app/backend/server.py` (added mark-ready endpoint)

---

### FEATURE: GATE DASHBOARD MOBILE ENHANCEMENTS ✅

Enhanced mobile Gate Dashboard with expected queues, pending uploads, and improved UX.

**New Features:**
1. **Tab Navigation**: Three tabs - Scan, Expected, Pending
2. **Expected Queues Tab**: 
   - Shows "Incoming Expected" (tickets with pickup tracking awaiting gate scan)
   - Shows "Ready to Ship" (dispatches awaiting outward scan)
   - Tap any item to auto-fill scan form
3. **Pending Uploads Tab**:
   - Lists all scans without required images (inward needs 2+, outward needs 1+)
   - Shows image count progress (e.g., "1/2")
   - Tap to add photos to any previous scan
4. **Skip Upload Option**: New "Skip - Upload Photos Later" button allows gate person to scan multiple packages first, then upload images later via Pending tab
5. **NAS Image Viewing Fixed**: Added token-based authentication for media downloads - Accountant can now view gate-uploaded images stored in NAS

**Files Modified:**
- `/app/frontend/src/pages/gate/GateDashboardMobile.jsx`
- `/app/frontend/src/pages/accountant/IncomingInventoryQueue.jsx`
- `/app/backend/server.py` (added query token support for media downloads)

**Verification:**
- Uploaded test image via API
- Confirmed storage at NAS path: `Returns/2026-04-03-TEST-NAS-UPLOAD-1775248824/images/`
- Verified accountant can view images in Incoming Queue media viewer

---

### BUG FIX: DIALOG UI OVERFLOW ✅

Fixed dialogs that exceeded page limits when dynamic content was added.

**Issue:** Transfer Stock and Master SKU Unit Alias dialogs would grow beyond the viewport when items were selected or multiple aliases added, making bottom buttons inaccessible.

**Fix:** Added `max-h-[90vh] overflow-y-auto` to:
- Transfer Stock dialog in `AccountantInventory.jsx`
- Alias Management dialog in `AdminMasterSKU.jsx`

**Files Modified:**
- `/app/frontend/src/pages/accountant/AccountantInventory.jsx`
- `/app/frontend/src/pages/admin/AdminMasterSKU.jsx`

---

### FEATURE: INTER-COMPANY PAYMENT ADJUSTMENT ✅

Added ability to knock off receivables and payables between firms without actual cash transfer.

**Use Case:**
- Firm A sells goods worth ₹1,00,000 to Firm B (inter-company transfer)
- Firm A has a receivable of ₹1,00,000 from Firm B
- Firm B has a payable of ₹1,00,000 to Firm A
- Instead of cash transfer, this adjustment clears both balances

**Features:**
1. New "Inter-Company Adjustment" button on Payments page
2. Dialog shows:
   - Selling Firm (Has Receivable) selector
   - Buying Firm (Has Payable) selector
   - Outstanding summary cards (Receivables, Payables, Suggested Adjustment)
   - Checkbox list of invoices to knock off
   - Amount and Date fields
3. Creates two payment records:
   - "Payment Received" in selling firm's books
   - "Payment Made" in buying firm's books
4. Updates invoice payment status automatically

**Backend Endpoints:**
- `GET /api/payments/inter-company-outstanding` - Get outstanding between two firms
- `POST /api/payments/inter-company-adjustment` - Create knock-off adjustment

**Files Modified:**
- `/app/backend/server.py` - Added adjustment endpoints
- `/app/frontend/src/pages/accountant/Payments.jsx` - Added ICA dialog UI

### BUG FIX: MASTER SKU EDIT ERROR ✅

Fixed "Input should be a valid string" error when saving Master SKU with Cost Price.

**Root Cause:** HSN Code field was being sent as a number instead of string
**Fix:** Added `String()` conversion for hsn_code in frontend

### BUG FIX: TRANSFER STOCK UI OVERFLOW ✅

Fixed layout distortion when selecting items with long names.

**Fix:** 
- Item dropdown now shows 2-line format
- Added max-width constraints and text truncation
- Added "Selected" info box showing full item details

---

### ENHANCEMENT: INTER-COMPANY STOCK TRANSFER WITH AUTO SALES/PURCHASE ✅

Enhanced stock transfer between firms to automatically create accounting entries.

**New Features:**
1. **Auto-Create Sales & Purchase Entries**: When transferring stock between firms:
   - Creates Sales Invoice for the selling (From) firm
   - Creates Purchase Entry for the receiving (To) firm
   - Creates Party records for inter-company transactions if they don't exist

2. **Margin-Based Pricing Suggestions**:
   - Shows item's cost price and last purchase price
   - Configurable margin % (default 15%)
   - Auto-calculates suggested transfer price with margin
   - Displays GST amount and grand total
   - Shows "Margin Earned by Selling Firm" amount

3. **Improved UI**:
   - New pricing summary card in transfer dialog
   - Real-time calculation as quantity/margin changes
   - Toggle to enable/disable auto-entry creation
   - Button text changes to "Transfer & Create Entries"

**Backend Endpoints Added:**
- `GET /api/inventory/transfer-pricing/{item_type}/{item_id}` - Get pricing suggestions with margin
- Updated `POST /api/inventory/transfer` - Now creates sales/purchase entries

**Business Logic:**
- Base Price = Last Purchase Price > Cost Price > 50% of MRP
- Transfer Price = Base Price × (1 + Margin%)
- GST calculated on Transfer Price
- Sales Invoice linked to selling firm, Purchase Entry to receiving firm
- Both entries marked as `is_inter_company_transfer: true`

**Files Modified:**
- `/app/backend/server.py` - Added pricing endpoint, updated transfer to create entries
- `/app/frontend/src/pages/accountant/AccountantInventory.jsx` - Enhanced transfer dialog UI

---

### BUG FIX: GATE MEDIA IMAGES NOT LOADING
**Status**: Production-specific issue
- The preview environment has separate NAS storage from production
- Gate media images uploaded in production won't display in preview
- Fix requires ensuring media paths match between environments
- This should work correctly in production where media was originally uploaded

### ENHANCEMENT: COMPLIANCE DASHBOARD - ALL ENTRIES VIEW ✅

Added new "All Entries" tab to Compliance Dashboard showing all financial entries with their compliance status.

**Features:**
- Shows all Purchases, Sales Invoices, and Dispatches in one view
- Filter by Firm, Entry Type (Purchase/Sales/Dispatch), Document Status
- Each entry displays:
  - Type badge (color-coded)
  - Entry number
  - Firm name
  - Party name with GSTIN
  - Date and Amount
  - Compliance Score (percentage)
  - Issues/Remarks column with specific warnings
  - Document Status badge

**Backend Endpoint:**
- `GET /api/compliance/all-entries` - Returns all entries with compliance issues

**Files Modified:**
- `/app/backend/server.py` - Added `/compliance/all-entries` endpoint
- `/app/frontend/src/pages/admin/ComplianceDashboard.jsx` - Added All Entries tab with table

### ENHANCEMENT: PAYMENT RECORDING WITH FIRM ACCOUNT ✅

Improved Record Payment dialog to require firm/account selection.

**Features:**
- New "Firm / Account *" dropdown field (required)
- Helper text shows if payment will be credited/debited from firm
- Outstanding balance now queries correct collection (`purchases` instead of `purchase_entries`)
- Supports firm-specific filtering for outstanding invoices

**Files Modified:**
- `/app/backend/server.py` - Fixed `/party-outstanding/{party_id}` endpoint to query correct collection
- `/app/frontend/src/pages/accountant/Payments.jsx` - Added firm selector, improved outstanding display

### BUG FIX: PAYABLES REPORT NOT SHOWING DATA ✅

Fixed the Accounting Reports > Payables tab showing ₹0 even when purchases exist.

**Root Cause:** The payables report was querying the wrong collection (`db.purchase_entries`) instead of `db.purchases` where purchase data is actually stored.

**Fix Applied:**
- Changed collection from `purchase_entries` to `purchases`
- Added filter for `status: 'final'` to only count finalized purchases
- Handle missing `payment_status` field (treat as unpaid)
- Added proper response keys to match frontend expectations

**Files Modified:**
- `/app/backend/server.py` - Line ~15194, fixed `get_payables_report` endpoint

---

### FEATURE: ADMIN TICKET STATUS OVERRIDE ✅

Admin can now change any ticket's status to roll it back through stages.

**Use Case Example:**
- Ticket went: Call Support → Supervisor → Reverse Pickup → Accountant
- Admin can roll it back to Supervisor queue for re-evaluation

**Implementation:**
- New "Change Status" button on Admin Ticket Detail page (yellow outlined button)
- Dialog shows current status and all available status options
- Requires mandatory notes (minimum 10 characters) explaining the reason
- Automatically updates related flags (escalation status, accountant decision, etc.)
- Full audit trail logged with old/new status and admin notes

**Backend Endpoint:**
- `POST /api/admin/tickets/{ticket_id}/change-status` - Changes ticket status with audit trail
- `GET /api/admin/tickets/status-options` - Returns all available status options

**Files Modified:**
- `/app/backend/server.py` - Added change-status endpoint with rollback logic
- `/app/frontend/src/pages/admin/AdminTicketDetail.jsx` - Added Change Status button and dialog

---

### FEATURE: TICKETS & CUSTOMERS UI ENHANCEMENTS ✅

Major UI improvements for Admin Tickets and Customers pages with pagination, filters, and CRUD operations.

**Tickets Page Enhancements:**
- **Pagination**: 50 tickets per page with First/Prev/Page Numbers/Next/Last controls
- **SLA Breach Filter**: New dropdown filter to show only SLA breached or within-SLA tickets  
- **Search State Preservation**: Search filters saved to sessionStorage, restored on back navigation
- **Visual Indicators**: SLA breached rows highlighted with red background tint

**Customers Page Enhancements:**
- **Pagination**: 50 customers per page with full pagination controls
- **Add Customer**: Admin can create new customers via dialog form
- **Edit Customer**: Admin can edit customer details (name, email, phone, address)
- **Delete Customer**: Admin can delete customers - BLOCKED if customer has existing tickets, warranties, or orders

**Backend Endpoints Added:**
- `POST /api/admin/customers` - Create new customer with email/phone uniqueness validation
- `PATCH /api/admin/customers/{id}` - Update customer details
- `DELETE /api/admin/customers/{id}` - Delete customer (with ticket/warranty/order protection)

**Files Modified:**
- `/app/backend/server.py` - Added Customer CRUD endpoints, enhanced pagination response structure
- `/app/frontend/src/pages/admin/AdminTickets.jsx` - Full rewrite with pagination, SLA filter, state preservation
- `/app/frontend/src/pages/admin/AdminCustomers.jsx` - Full rewrite with pagination, CRUD operations

### BUG FIX: WARRANTY REJECTION ✅

Fixed the warranty rejection feature that was not working from the frontend.

**Root Cause:** Frontend sends rejection reason as FormData field `notes`, but backend expected query parameter `reason`.

**Fix Applied:** Updated `/api/warranties/{warranty_id}/reject` endpoint to accept BOTH:
- Query parameter `reason` (original)
- FormData field `notes` (frontend sends this)

**Files Modified:**
- `/app/backend/server.py` - Line ~3249, enhanced reject_warranty endpoint

### ENHANCEMENT: SUPERVISOR NOTES DISPLAY ✅

Improved supervisor notes visibility throughout the application.

**Changes:**
- **Supervisor Dashboard Queue**: Notes now displayed in full with colored background boxes instead of truncated text
- **Escalation Notes**: Orange background box showing agent escalation notes
- **Supervisor Notes**: Purple background box showing supervisor decision and recommended SKU
- **Audit Trail Tab**: Enhanced timeline with:
  - Date/time stamps in readable format
  - User who performed each action
  - Optional notes for each action
  - Key dates section (Created, Escalated, Closed, SLA Due)

**Files Modified:**
- `/app/frontend/src/pages/supervisor/SupervisorDashboard.jsx` - Enhanced notes display and Audit Trail tab

---

## Recent Changes (April 2, 2026)

### FEATURE: MOBILE-FIRST GATE DASHBOARD ✅

Complete redesign of Gate Dashboard for mobile phone use with camera barcode scanning and mandatory media capture.

**New Components:**
- `/app/frontend/src/pages/gate/GateDashboardMobile.jsx` - Mobile-optimized gate dashboard

**Key Features:**
1. **Mobile Auto-Detection**: Automatically switches to mobile UI on phones/tablets
2. **Large Touch Buttons**: INWARD (green) and OUTWARD (blue) buttons for easy tapping
3. **Camera Barcode Scanner**: Uses `html5-qrcode` library for in-browser barcode/QR scanning
4. **Mandatory Media Capture**:
   - Outward: Requires minimum 1 image before completion
   - Inward: Requires minimum 2 images before completion
   - Optional video capture for both
5. **Image Compression**: Uses `browser-image-compression` to reduce image size while maintaining quality
6. **Progress Indicators**: Shows upload progress and media counter ("2/2 images uploaded")

**Backend Endpoints Added:**
- `POST /api/gate/media/upload` - Upload images/videos with proper folder structure
- `GET /api/gate/media/{gate_log_id}` - Get all media for a gate log
- `DELETE /api/gate/media/{media_id}` - Delete a media file
- `POST /api/gate/{gate_log_id}/complete` - Complete scan with validation
- `GET /api/gate/media/by-tracking/{tracking_id}` - Get media by tracking ID
- `GET /api/gate/media/download/{media_id}` - Download/stream media file

**Database Collection:** `gate_media`
- gate_log_id, tracking_id, movement_type, media_type
- relative_path, filename, original_filename
- capture_source (camera/gallery/file_upload)
- uploaded_by, uploaded_at, captured_at

**NAS Folder Structure:**
- Inward: `Returns/2026-04-02-TRK123456/images/TRK123456_01.jpg`
- Outward: `Dispatches/2026-04-02-TRK123456/images/TRK123456_01.jpg`

### FEATURE: ACCOUNTANT MEDIA VIEWER IN INCOMING QUEUE ✅

Accountants can now view all inward media directly from the Incoming Queue before classifying packets.

**UI Changes:**
- Added "Media" column to Incoming Queue table
- Shows image/video counts with clickable buttons
- "View" button opens Media Viewer modal
- Modal displays:
  - Large main image/video player
  - Navigation arrows for multiple media
  - Thumbnail strip for quick selection
  - File details (filename, type, captured timestamp, source)
  - Image and video count badges

### BUG FIX: MANUAL INCENTIVE ADDING NOT WORKING ✅

Fixed the "Failed to add incentive" error when adding manual incentives from the Incentives page.

**Root Cause:**
- `create_notification()` function was called with `target_user_id` (singular) instead of `target_user_ids` (list)

**Fix Applied:**
- Changed `target_user_id=user_id` to `target_user_ids=[user_id]` in `/app/backend/server.py` line 17871

### FEATURE: PAYSLIP DOWNLOAD ✅

Employees can now download their payslips as PDF. Payslips include firm name.

**Endpoints Added:**
- `GET /api/admin/payroll/{payroll_id}/payslip` - Admin downloads any payslip
- `GET /api/employee/payslip/{payroll_id}` - Employee downloads own payslip only
- `GET /api/employee/my-payroll` - Employee views their payroll history

**Payslip Features:**
- Firm name prominently displayed in header
- Employee details (name, designation, department)
- Earnings breakdown (fixed salary, incentives, bonus, reimbursements)
- Deductions section
- Net pay calculation
- Bank details (if configured)
- Signature sections
- PDF generation using WeasyPrint

### FEATURE: EXPENSE LEDGER ✅

Salary payments now automatically create entries in the Expense Ledger for monthly expense tracking.

**Endpoints Added:**
- `GET /api/admin/expenses` - View expense ledger with filters (month, year, category, firm)
- `POST /api/admin/expenses` - Create manual expense entry
- `GET /api/admin/expenses/summary` - Monthly expense summary for a year

**How It Works:**
- When admin clicks "Mark as Paid" on payroll, an expense entry is automatically created
- Category: "salary", Subcategory: "employee_salary"
- Includes breakdown: fixed_salary, incentives, bonus, reimbursements, deductions
- Links back to payroll record via reference_id

**Database Collection:** `expense_ledger`

### FEATURE: PENDING INCENTIVES ON PAYROLL PAGE ✅

The payroll table now shows a "Pending Inc." column displaying incentives awaiting approval.

**Changes:**
- Added `pending_incentives` field to payroll API response
- Added "Pending Inc." column to payroll table in AdminPayroll.jsx
- Shows yellow indicator with award icon for employees with pending incentives

### FEATURE: SUPPLIER DROPDOWN IN PURCHASE ENTRY ✅

Enhanced Purchase Register to require selecting supplier from Party Master dropdown instead of free text entry.

**Changes:**
1. **Supplier Dropdown**: Purchase Entry now shows a searchable dropdown of suppliers from Party Master
2. **Supplier Validation**: If supplier not in list, user must add them in Party Master first
3. **Auto-populate**: Selecting supplier auto-fills Name, GSTIN, and State
4. **Link to Party Master**: "Add in Party Master" link visible in the form

**Files Modified:**
- `/app/frontend/src/pages/accountant/PurchaseRegister.jsx` - Added supplier dropdown, fetchSuppliers(), handleSupplierSelect()

### FEATURE: PARTIES IN EXCEL DATA MANAGEMENT ✅

Added "Parties" as a data source in Admin Data Management for Excel import/export.

**Data Sources Now Available (7 total):**
- Customers (users with role=customer)
- **Parties (NEW)** - All parties (suppliers, customers, contractors)
- Dealers
- Orders
- Warranties
- Master SKUs
- Inventory

**Files Modified:**
- `/app/backend/server.py` - Added "parties" to EXCEL_DATA_SOURCES
- `/app/frontend/src/pages/admin/AdminDataManagement.jsx` - Added parties icon/color

### DATA IMPORT: DEALER DATA FROM MYSQL SQL DUMP ✅

Imported latest dealer data from MySQL SQL dump (`u713296379_partners.sql`) into MongoDB.

**Data Imported:**
- **63 Dealers** with ID format `MGIPLDEL{number}` (e.g., MGIPLDEL15)
- **25 Orders** with order items
- **12 Products/SKUs** to master_skus collection
- **63 Dealer User Accounts** for portal login

**Dealer ID Format:**
- New format: `MGIPLDEL{original_id}` (e.g., original ID 15 → MGIPLDEL15)
- This matches the requested format from user

**Files Created:**
- `/app/backend/migrations/import_dealers_from_sql.py` - Main import script
- `/app/backend/migrations/fix_missing_dealers.py` - Fix for dealers with parsing issues

**Data Preserved:**
- Firm names, contact persons, phone numbers, emails
- GST numbers, addresses, city/state/pincode
- Security deposit status and amounts
- Order history with order items and amounts
- Products with MRP, dealer price, GST rate

---

## Recent Changes (April 1, 2026)

### FEATURE: EXCEL IMPORT/EXPORT FOR DATA MANAGEMENT ✅

Enhanced Admin Data Management page with Excel import/export functionality for each data source separately.

**Data Sources Supported:**
- **Customers** (268 records) - User data filtered by role=customer
- **Dealers** (57 records) - Dealer firm information
- **Orders** (24 records) - Dealer orders
- **Warranties** (1211 records) - Warranty registrations
- **Master SKUs** (24 records) - Product master data
- **Inventory** (14 records) - Stock items

**Features:**
1. **Export to Excel** - Download existing data as .xlsx file with all fields
2. **Download Template** - Get empty template with sample row and Instructions sheet
3. **Import from Excel** - Upload modified Excel to add/update data
4. **Two Import Modes:**
   - **Merge** - Add new records, update existing (based on unique field)
   - **Replace** - Clear all data first, then import

**New API Endpoints:**
- `GET /api/admin/excel/sources` - List all data sources with record counts
- `GET /api/admin/excel/export/{source}` - Download data as Excel
- `GET /api/admin/excel/template/{source}` - Download empty template
- `POST /api/admin/excel/import/{source}` - Upload and import Excel file

**Files Modified:**
- `/app/backend/server.py` - Added EXCEL_DATA_SOURCES config and 4 new endpoints
- `/app/frontend/src/pages/admin/AdminDataManagement.jsx` - Complete UI redesign with tabs

**Testing:** 100% pass rate (29/29 backend tests)

---

## Recent Changes (March 31, 2026)

### BUG FIX: OTP LOGIN FRONTEND FIX ✅ (P0 - CRITICAL)

**Issue:** OTP login for customers and dealers was not working. Users would enter the correct OTP but get "Invalid OTP" error.

**Root Cause:** Three issues were identified:
1. **localStorage key mismatch:** `LoginPage.jsx` was using `localStorage.setItem('token', ...)` but `App.js` AuthContext was looking for `mg_token`
2. **Missing AuthContext exports:** `setToken` and `setUser` functions were not exported from `AuthContext.Provider`, causing `setToken is not a function` error
3. **Missing UserResponse fields:** The `UserResponse` Pydantic model was missing `profile_incomplete` and `missing_fields` fields, so after verification the frontend couldn't determine if user needed to complete their profile

**Fix:**
1. Changed `localStorage.setItem('token', ...)` to `localStorage.setItem('mg_token', ...)` in `LoginPage.jsx` and `DealerLogin.jsx`
2. Added `setUser` and `setToken` to the `AuthContext.Provider` value in `App.js`
3. Added `profile_incomplete: Optional[bool]` and `missing_fields: Optional[list]` to `UserResponse` model in `server.py`

**Files Modified:**
- `/app/frontend/src/pages/LoginPage.jsx` (line 77)
- `/app/frontend/src/pages/dealer/DealerLogin.jsx` (line 90)
- `/app/frontend/src/App.js` (line 153)
- `/app/backend/server.py` (lines 182-195)

**Testing:**
- ✅ Customer OTP login redirects to `/complete-profile` if profile incomplete
- ✅ Customer OTP login redirects to `/customer` if profile complete
- ✅ Admin email login redirects to `/admin`
- ✅ Backend OTP APIs return correct response with profile_incomplete field

---

## Recent Changes (March 27, 2026)

### PHASE 1: DEALER PORTAL PREMIUM FEATURES ✅ (NEW)

#### 1. DEALER TIER SYSTEM ✅
- **Three Tiers:** Silver (₹0-5L), Gold (₹5L-15L), Platinum (₹15L+)
- Automatic tier calculation based on lifetime purchase value
- Progress indicators showing amount remaining to reach next tier
- Tier badge prominently displayed on dashboard and certificate

#### 2. DEALER CERTIFICATE ✅
- Professional PDF certificate with QR verification
- Includes: MuscleGrid branding, dealer name, tier badge, location, dealer since date
- QR code links to public verification page
- Download available from Certificate page and Download Center

#### 3. DEALER PERFORMANCE DASHBOARD ✅
- Monthly, yearly, and all-time performance metrics
- Order status breakdown (Pending, Confirmed, Dispatched, Delivered, Cancelled)
- Monthly trend visualization with growth indicators
- Average order value tracking

#### 4. DEALER LEDGER ✅
- Integrated with existing Party Ledger system
- Shows current balance (Outstanding/Credit/Clear)
- Security deposit info with status
- Searchable transaction history

#### 5. DISPATCH TRACKING ✅
- AWB number display with tracking links
- Supported couriers: Delhivery, BlueDart, DTDC, FedEx, Ecom Express, Xpressbees, Shadowfax
- Status filters (All, In Transit, Delivered, Confirmed)
- Direct links to courier tracking pages

#### 6. DOWNLOAD CENTER ✅
- Centralized document access
- Available documents: Dealer Certificate, Security Deposit Receipt, Invoices, Proforma Invoices, Payment Receipts
- Categorized tabs with document counts
- Search functionality

**New API Endpoints:**
- `GET /api/dealer/tier` - Tier info with progress
- `GET /api/dealer/performance` - Performance metrics (monthly/yearly/all)
- `GET /api/dealer/ledger` - Ledger with deposit info
- `GET /api/dealer/dispatches` - Dispatch tracking
- `GET /api/dealer/documents` - Document list
- `GET /api/dealer/certificate/download` - PDF certificate generation
- `GET /api/verify-dealer/{token}` - Public certificate verification

**New Pages:**
- `/dealer/performance` - Performance Dashboard
- `/dealer/certificate` - Certificate preview & download
- `/dealer/ledger` - Account Ledger
- `/dealer/dispatches` - Dispatch Tracking
- `/dealer/documents` - Download Center
- `/verify-dealer/{token}` - Public verification page

**Updated Dashboard:**
- Tier badge in welcome card
- Tier progress card with remaining amount
- Monthly performance summary
- Quick action cards for all new features

---

### BUG FIXES (March 27, 2026)

#### 1. DEALER PORTAL NAVIGATION FIX ✅ (CRITICAL)
**Issue:** Dealer Portal sidebar links not working - clicking tabs showed no data and page refresh logged out the dealer.

**Root Cause:** The `/api/auth/me` endpoint was failing with a 500 error because migrated dealer users had `created_at` stored as a Python `datetime` object instead of an ISO string. The `UserResponse` Pydantic model expected a string, causing validation failure.

**Fix:** Updated `/api/auth/me` and `/api/auth/me` (PATCH) endpoints to convert `datetime` objects to ISO strings before returning the response.

**Files Modified:**
- `/app/backend/server.py` (lines 1349-1367)

**Verified Working:**
- ✅ Dashboard - Shows Total Orders, Pending Orders, Open Tickets, Outstanding
- ✅ Place Order - Product catalog with dealer pricing and cart
- ✅ My Orders - Order list with tabs (All, Pending, Confirmed, Dispatched, Delivered)
- ✅ My Profile - Dealer profile with firm info, security deposit status
- ✅ Deposit Status - Security deposit upload form
- ✅ Support Tickets - Ticket creation and list
- ✅ Promotions - Request promotional materials and schemes
- ✅ Page refresh - Session persists correctly (no logout on refresh)

#### 2. UI ROLE RESTRICTIONS ✅
- ShiftTimer hidden for Customer and Dealer roles
- PI Quotation Conversion restricted to Admin and Accountant only

---

### NEW FEATURES (March 27, 2026)

#### 1. DEALER PORTAL MODULE ✅

Full-featured Dealer Portal integrated into CRM, ready for migration from `partners.musclegrid.in`.

**Dealer Side Features:**
- Dealer Dashboard with status overview, order stats, and quick actions
- Security Deposit Workflow (upload proof → admin review → approval)
- Product Catalog with dealer pricing
- Order placement with cart functionality
- Payment proof upload for orders
- Support ticket creation
- Promotions/schemes requests
- Profile management

**Admin Side Features:**
- Dealer application queue with approve/reject workflow
- Security deposit approval queue
- Dealer orders management
- Payment verification queue
- Dealer products catalog management
- Dealer ledger (integrated with Party accounting)

**Business Logic Implemented:**
- Security deposit as hard gate for ordering
- Dealer → Party auto-creation in accounting
- Order payment proof workflow (no auto-confirm)
- Integration with CRM dispatch and accounting

**API Endpoints Added:**
- `POST /api/dealer-applications` - Public application submission
- `GET/POST /api/admin/dealer-applications/*` - Admin application management
- `GET/PATCH /api/dealer/profile` - Dealer profile
- `GET /api/dealer/dashboard` - Dashboard data
- `POST /api/dealer/deposit/upload-proof` - Deposit proof upload
- `GET/POST /api/admin/dealer-deposits/*` - Deposit approval
- `GET /api/dealer/products` - Product catalog
- `POST /api/dealer/orders` - Place order
- `GET /api/dealer/orders` - Order history
- `POST /api/dealer/orders/{id}/upload-payment` - Payment proof
- `GET/POST /api/admin/dealer-orders/*` - Order management
- `POST/GET /api/dealer/tickets` - Support tickets
- `POST/GET /api/dealer/promo-requests` - Promo requests

**Pages Added:**
- `/partners` - **NEW** Standalone Dealer Login Page (for `partners.musclegrid.in` redirect)
- `/dealer` - Dealer Dashboard
- `/dealer/deposit` - Security Deposit Status
- `/dealer/orders/new` - Place Order
- `/dealer/orders` - Order History
- `/dealer/tickets` - **NEW** Support Tickets
- `/dealer/promotions` - **NEW** Promotions & Schemes Requests
- `/admin/dealer-applications` - Application & Deposit Management

**DNS Configuration:**
- `partners.musclegrid.in` → `newcrm.musclegrid.in/partners`
- Dedicated dealer login page with dealer-specific branding
- Non-dealer users attempting to login get error message

**Migration Preparation:**
- Migration guide created at `/app/memory/DEALER_MIGRATION_GUIDE.md`
- Data mapping document complete
- Password compatibility verified (PHP bcrypt → Python bcrypt)
- **PREVIEW MIGRATION EXECUTED SUCCESSFULLY** (March 27, 2026):
  - 52 dealer users migrated
  - 56 dealers created with Party records (type: "dealer")
  - 60 dealer applications imported
  - 24 historical orders imported
  - 11 dealer products created
- Migration script ready for LIVE execution
- Live migration pending user approval

---

## Recent Changes (March 26, 2026)

### NEW FEATURES (March 26, 2026)

#### 1. GROUPED COLLAPSIBLE SIDEBAR MENU ✅
Reorganized the Admin and Accountant sidebar menus into collapsible groups for easier navigation:

**Admin Menu Groups:**
- Dashboard (Overview, Compliance)
- CRM (All Tickets, Repairs, Customers, Warranties)
- Sales (Orders, Quotations, PI Pending Action)
- Inventory (Master SKUs, Firms, Stock Reports)
- Finance (Finance & GST, Sales Register, Purchase Register, Party Master, Party Ledger, Payments, Credit Notes, Reports, Reconciliation)
- HR & Payroll (Salary & Payroll, Attendance, Incentives, Users)
- System (Analytics, Activity Logs, Data Management, Gate Logs)
- Quick Access (Dispatcher TV, Gate Control)

**Accountant Menu Groups:**
- Dashboard, Finance, Sales, Operations, Dispatch

#### 2. EMPLOYEE COMPENSATION & ATTENDANCE MODULE ✅

**Phase 1: Salary & Payroll Basis**
- Firm-wise employee salary master with:
  - Fixed monthly salary
  - Salary type (monthly/daily/hourly)
  - Incentive eligibility
  - Bank details (account, IFSC, PAN)
  - Active status
- Monthly payroll view showing:
  - Fixed salary
  - Incentives (auto-calculated from conversions)
  - Bonuses and deductions
  - Total payable
  - Days present
  - Paid/unpaid status
- Payroll adjustments (bonus, penalty, reimbursement, deduction) with reason and audit log

**Phase 2: Attendance / Session Tracking**
- Real-time shift timer in header (visible for all employees except customers)
- Shift controls:
  - Start Shift / Login
  - Start Break
  - End Break
  - End Shift / Logout
- Tracking:
  - Login time
  - Logout time
  - Break durations
  - Net working hours (automatically subtracts breaks)
- Employee "My Attendance" page with:
  - Today's status card with action buttons
  - Monthly summary (days present, total hours, avg hours/day)
  - Detailed attendance history
- Admin attendance dashboard with:
  - Employee summary table
  - Daily attendance log
  - Missing logouts alerts
  - Filter by month/year/employee

**API Endpoints Added:**
- `POST /api/attendance/login` - Start shift
- `POST /api/attendance/logout` - End shift
- `POST /api/attendance/break-start` - Start break
- `POST /api/attendance/break-end` - End break
- `GET /api/attendance/today` - Get today's attendance
- `GET /api/attendance/my` - Get user's attendance history
- `GET /api/admin/attendance` - Admin attendance view
- `GET /api/admin/salaries` - Get salary configurations
- `POST /api/admin/salaries` - Create salary config
- `PATCH /api/admin/salaries/{id}` - Update salary config
- `GET /api/admin/payroll` - Get/generate monthly payroll
- `POST /api/admin/payroll/generate` - Save payroll records
- `POST /api/admin/payroll/{id}/adjustment` - Add adjustment
- `POST /api/admin/payroll/{id}/mark-paid` - Mark as paid
- `POST /api/admin/payroll/bulk-pay` - Bulk mark paid

**Pages Added:**
- `/admin/payroll` - Salary & Payroll management
- `/admin/attendance` - Admin attendance dashboard
- `/my-attendance` - Employee attendance page

---

## Recent Changes (March 25, 2026)

### BUG FIXES (March 25, 2026)

1. **Phone-Based Quotation Matching (NEW)** - Fixed quotation visibility for new customers:
   - Previously: Quotations created by Call Support before customer registration weren't visible
   - Now: When a customer registers with the same phone number used in a quotation, they automatically see it
   - Fix: Updated `/api/customer/quotations` to look up phone from `users` collection instead of `customers` collection

2. **Call Support Quotation Access** - Fixed 403 errors when Call Support users try to access quotation features:
   - Added `call_support` role to `/api/firms` endpoint
   - Added `call_support` role to `/api/master-skus` endpoint
   - Added `call_support` role to `/api/parties` endpoint
   - Quotation creation form now works correctly for Call Support users

### CUSTOMER PORTAL QUOTATIONS ✅ (NEW)

Added quotations section to Customer Dashboard:
- Shows "Quotations" stat card with total count
- "My Quotations" section displays all quotations for the customer
- Pending quotations highlighted with badge ("X need response")
- Action buttons: "Review & Respond" for pending PIs, "View" for others
- Status badges for each quotation (Draft, Pending Review, Awaiting Response, Approved, Rejected, etc.)

### PI APPROVAL/REJECTION NOTIFICATIONS ✅ (NEW)

Portal notifications are now created when customers approve or reject quotations:
- Notification sent to the Call Support agent who created the PI
- Includes quotation number, customer name, and amount
- Shows in the notification bell in the header

### CONTRACTOR PAYABLES AUTOMATION ✅ (ENHANCED)

Enhanced the existing supervisor payables system:
- Auto-creates party for contractor/supervisor if not exists
- Creates party ledger entry (credit) when supervisor payable is created
- Tracks contractor_party_id and contractor_user_id in payable record
- Full audit trail in party_ledger for accounting reconciliation

### MONTHLY RECONCILIATION REPORTS ✅ (NEW)

New page at `/accountant/reconciliation` showing:
- **Purchase vs Stock Inward**: Compares purchase register with inventory ledger entries
- **Sales vs Dispatch**: Compares sales register with dispatch records, highlights dispatches without invoices
- **Payment Summary**: Payments received, payments made, outstanding receivables and payables
- **GST Reconciliation**: Output GST, Input Tax Credit, Net GST Liability
- **Discrepancies**: Lists all mismatches with severity levels (Critical, Important, Minor)
- Month and Firm filters

---

### PI / QUOTATION MODULE ✅ (COMPLETED)

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

---

## File Storage Migration - COMPLETED (March 29, 2026)

### Synology File API Integration
- Replaced WebDAV with custom File API hosted on Synology NAS
- Base URL: `https://files.musclegrid.in`
- Authentication: `x-api-key` header

### API Endpoints
- `POST /upload/:folder` - Upload file (multipart/form-data, field: "file")
- `GET /download/:folder/:filename` - Download file
- `GET /files/:folder` - List files in folder
- `DELETE /file/:folder/:filename` - Delete file

### Valid Folders
- tickets, invoices, payments, certificates

### Folder Mapping (Backwards Compatibility)
Legacy folder names are automatically mapped:
- pickup_labels, dispatch_labels, labels → tickets
- service_invoices, warranty_invoices, purchase_invoices, quotations → invoices
- payment_proofs, deposits, dealer_deposits, dealer_payments → payments
- feedback_screenshots, reviews, dealer_tickets, dealer_documents → tickets

### Configuration
```
FILE_API_URL=https://files.musclegrid.in
FILE_API_KEY=<configured in .env>
```

### Files Updated
- `/app/backend/utils/storage.py` - Complete rewrite for File API
- `/app/backend/server.py` - All upload endpoints use storage utility
- `/app/backend/.env` - FILE_API_URL and FILE_API_KEY configured

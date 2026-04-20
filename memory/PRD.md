# CRM E-commerce Reconciliation System - PRD

## Original Problem Statement
Implement E-commerce Reconciliation and Amazon/Flipkart statement integrations. Expand Operations Assistant Bot (OrderBot) for accountants handling inventory, stock transfers, and Amazon order processing. Add universal search. Introduce 4-5 beautiful bright themes with a universal theme switcher button. Build a Product Datasheet and Catalogue Generator for Batteries, Solar Inverters, Stabilizers, Servo, Solar Panels, and Accessories. Ensure datasheets have a beautiful, highly animated, public-facing showcase page.

## Core Architecture
- **Backend**: FastAPI + MongoDB (server.py ~45,000 lines - refactoring deferred)
- **Frontend**: React + TailwindCSS + Shadcn UI
- **Integrations**: Amazon SP-API, OpenAI (gpt-image-1), Bigship Courier, Tata Smartflo IVR, Zoho Mail

## Key Features Implemented

### Email-to-Ticket Automation (NEW - April 19, 2026)
- **Email Inbox UI**: Dedicated page at `/support/email-inbox` for support agents to review incoming emails
- **Email List**: Shows pending emails from `service@musclegrid.in` not yet converted to tickets
- **Ticket Creation Form**: Device Type, Order ID, Problem Description with email data pre-filled
- **Customer Linking**: 
  - "Find Existing" tab to search existing customers by name/phone/email
  - "Create New" tab to add new customers with email sender data pre-filled
- **Product & Warranty Linking**: Optional expandable sections to search and link products/warranties
- **Auto-Suggestions**: Customer email auto-matched to existing warranties
- **Navigation**: "Email Inbox" button added to Call Support Dashboard
- **Note**: Full email body requires extended Zoho API scopes (READ_CONTENT). Currently shows email summary with "Limited content available" warning.

### Zoho Email Integration (Phase 1, 2, 3 Complete)
- **Automated Emails**: Ticket creation/updates, Dispatch notifications, Warranty registration
- **Manual Emails**: Quotations, Invoices, Payment reminders, Dealer announcements
- **Email Templates**: 20+ professionally designed HTML email templates
- **API Endpoints**: `/api/email/send/quotation/{id}`, `/api/email/send/invoice/{id}`, etc.
- **Email Logging**: All sent emails logged to `email_logs` collection
- **Account**: service@musclegrid.in via Zoho Mail API

### Product Datasheet & Catalogue System
- Bulk import from StoreLink websites (aiohttp concurrent scraping)
- AI background removal using OpenAI gpt-image-1 (raw HTTP)
- Public-facing showcase pages (mobile-responsive)
- Master SKU linking to Proforma Invoices
- Amazon credentials management per Firm

### OrderBot (Operations Assistant)
- Universal search across CRM data
- Amazon order import to CRM workflow
- Dispatch preparation with compliance checks
- Troubleshooting and auto-fix capabilities
- SKU linking, firm assignment, customer data copy

### Theme System
- 4-5 bright themes with universal switcher
- Dark mode support

## Completed Work (December 2025)

### Session Latest (April 20, 2026) - Pending Fulfillment Bug Fixes
- ✅ **BUG 1 FIX**: Phone numbers now properly copied from Amazon orders
  - Fixed 4 code locations that create PF entries: bot file upload, move-to-pending-fulfillment (existing & new entries)
  - Added fallback chain: `customer_phone` → `buyer_phone` → `shipping_address.phone`
  - Created backfill migration `/app/backend/migrations/backfill_pf_customer_phone.py` - ran successfully (6 entries fixed)
- ✅ **BUG 2 FIX**: Bot no longer asks for invoice/label on dispatch-queue orders
  - `get_order_fields()` in bot_routes.py checks order status before flagging missing docs
  - Status list: `pending_dispatch`, `in_dispatch_queue`, `ready_for_dispatch`, `dispatched`, `delivered`, `tracking_added`
- ✅ **BUG 3 FIX**: Stock lookup now uses shared helper function
  - `bot_prepare_dispatch` now calls `get_stock_for_resolved_items()` for consistent stock checks
  - Added fallback from `master_sku_id` to `sku_code` lookup
  - Response now includes `per_item` stock breakdown

### Previous Session - Full Email Content Fix + Auto-Reply
- ✅ **ARCHITECTURE**: Centralized StateMachine Class
  - Single source of truth for all entity status transitions
  - `StateMachine.validate_transition()` method for reusable validation
  - Supports: tickets, dispatches, quotations, dealer_orders, warranties
  - Admins can bypass for emergency overrides

#### Batch 1 Fixes (Complete)
- ✅ **SECURITY FIX**: Ticket State-Machine Validation
  - Non-admin users now restricted to valid status transitions
  - Uses centralized StateMachine class
- ✅ **IDEMPOTENCY FIX**: Credit Note Duplicate Prevention
  - Creating CN for same original invoice returns 409 with existing CN number
- ✅ **IDEMPOTENCY FIX**: Bank Transaction Match
  - Re-matching already matched transaction returns "already matched" with reference info
- ✅ **UNIQUENESS FIX**: Warranty Serial Number
  - Creating warranty for same serial number returns 409 if active warranty exists
- ✅ **ATOMICITY FIX**: Quotation Double-Convert Prevention
  - Uses `findOneAndUpdate` with `converted_at` guard
- ✅ **RACE CONDITION FIX**: Gate Scan Stock Deduction
  - Uses atomic `findOneAndUpdate` with `stock_deducted` flag
- ✅ **SECURITY FIX**: Bot File Upload Path Traversal
  - Sanitizes file extensions with whitelist (pdf, png, jpg, jpeg, gif, webp)
  - Uses UUID-based filenames - no user input in file paths

#### Batch 2 Security Fixes (Complete)
- ✅ **SECURITY FIX**: Warranty IDOR Protection
  - Customers can only access their own warranties (by customer_id, email, or phone)
  - Dealers can only access warranties they registered
  - Returns 403 for unauthorized access
- ✅ **DEDUP FIX**: Smartflo Webhook Idempotency
  - Duplicate webhook calls with same uuid return "duplicate" status
  - Prevents double-processing of call records

#### Batch 3 Accuracy/UX Fixes (Complete)
- ✅ **ACCURACY FIX**: GST Precision
  - CGST/SGST now rounded to 2 decimals using `round(gst_amount / 2, 2)`
  - Applied to: sales invoices, credit notes, purchase invoices

### Previous Session (April 19, 2026) - Email-to-Ticket UI
- ✅ **FEATURE**: Email-to-Ticket Automation UI Complete
  - New `/support/email-inbox` page for support agents
  - Displays pending emails from `service@musclegrid.in` (50 emails shown)
  - Email details view with From, Subject, Body/Summary
  - Create Support Ticket form with Device Type, Order ID, Problem Description
  - Customer Information section with "Find Existing" and "Create New" tabs
  - Product and Warranty optional linking sections (expandable/collapsible)
  - Email sender name and email auto-filled in new customer form
  - "Email Inbox" button added to Call Support Dashboard
  - Graceful handling of limited email content (Zoho API scope limitation)

### Previous Session (January 19, 2026)
- ✅ **FEATURE**: Zoho Email Integration - ALL 3 PHASES Complete
  - **Phase 1 (High Priority)**: Ticket emails, Dispatch notifications, Quotation emails, Warranty registration emails
  - **Phase 2 (Medium Priority)**: Invoice emails, Payment receipts, Payment reminders, Dealer order emails, Feedback requests
  - **Phase 3 (Low Priority)**: Warranty expiry alerts, Dealer announcements, Password reset, Welcome emails
  - 20+ professional HTML email templates with MuscleGrid branding
  - Email button added to Quotation list for manual sending
  - All emails logged to database for tracking
  - Zoho tokens auto-refresh for seamless operation

### Previous Session (January 17, 2026)
- ✅ **FEATURE**: Dealer Portal Phase 2 & 3 Complete
  - Product Catalogue with live stock visibility (`/dealer/catalogue`)
  - Announcements system with admin management (`/dealer/announcements`)
  - Sales Targets with monthly/quarterly/yearly tracking and incentive slabs (`/dealer/targets`)
  - Warranty Registration for products sold by dealers (`/dealer/warranty`)
  - Smart Reorder Suggestions based on purchase history analysis (`/dealer/reorder-suggestions`)
  - Updated dealer dashboard with new quick access cards
  - Updated sidebar navigation with all new features

### Previous Session (January 14, 2026)
- ✅ **BUG FIX**: OrderBot "No Stock Available" false positive for manufactured items
  - Fixed `is_manufactured` check to use `product_type == "manufactured"` OR `is_manufactured` flag
  - Serial numbers now correctly shown for manufactured items with stock
- ✅ **BUG FIX**: Duplicate orders in Pending Fulfillment queue
  - Added unique MongoDB indexes on `amazon_order_id`, `order_id`, `tracking_id`
  - Added duplicate key error handling on insert
- ✅ **BUG FIX**: Outbound Dispatcher "tracking ID already used" when processing pending fulfillment
  - Fixed `validate_no_duplicates` to exclude pending_fulfillment entry when creating dispatch from it

### Earlier Sessions
- ✅ AI Background Removal for existing products (backend + UI button)
- ✅ Fixed OrderBot prepare_dispatch stuck bug (missing_fields conditional gap)
- ✅ Added shipping_label, serial_number, eway_bill handlers
- ✅ Missing Info alerts in Pending Fulfillment queue
- ✅ Bot ability to update dispatch queues
- ✅ GST ITC credit offset fixes (previous month's ITC against current month GST)
- ✅ Fixed Sales Data to read from `sales_invoices` instead of `dispatches`
- ✅ StoreLink scraper refactored to aiohttp (handles 2000+ items)
- ✅ Amazon Credentials UI (AmazonSettings.jsx)
- ✅ Master SKU dropdown and PI page integration
- ✅ Mobile-responsive AccessoriesDatasheet layout
- ✅ Dark text visibility fixes in forms
- ✅ "ARB" → "MG" string replacement during import

## Business Rules
- String replacement: "ARB" must be replaced with "MG" everywhere
- Background removal: Uses raw HTTP to OpenAI gpt-image-1 (not Python SDK)
- E-way bill required for orders > ₹50,000

## Prioritized Backlog

### P0 (Critical - Audit Fixes)
- ~~Batch 1 Fixes~~ ✅ COMPLETE (April 19, 2026)
- ~~Batch 2 Security Bugs~~ ✅ COMPLETE (April 19, 2026)
- ~~Batch 3 Accuracy/UX Bugs~~ ✅ COMPLETE (April 19, 2026)

### Remaining Security Improvements (P1)
- Accountant firm-scope enforcement (requires schema change to track assigned firm)
- User-scope search enforcement across all collections
- Ticket ownership IDORs for non-admin roles

### P1 (High)
- Backend Refactoring (DEFERRED by user request)
- Flipkart API Integration
- WhatsApp sharing + QR codes on PDFs linking to interactive showcase pages

### P2 (Medium)
- Password Reset via Email
- Email sending for quotations
- Bot state persistence in localStorage

### P3 (Low)
- Automated Weekly/Monthly Excel reports
- Incentive adjustment on refund/cancel

## Dealer Portal Features (Complete)
- `/dealer/catalogue` - Product datasheets with live stock visibility
- `/dealer/announcements` - Company announcements and updates
- `/dealer/targets` - Sales targets with incentive tracking
- `/dealer/warranty` - Warranty registration for products sold
- `/dealer/reorder-suggestions` - AI-powered reorder recommendations

## API Endpoints Reference

### Dealer Portal (Phase 2 & 3)
- `GET /api/dealer/catalogue` - Product datasheets with live stock
- `GET /api/dealer/announcements` - Dealer announcements
- `POST /api/dealer/announcements/{id}/read` - Mark announcement read
- `GET /api/dealer/targets` - Sales targets and incentives
- `GET /api/dealer/warranty-registrations` - List warranty registrations
- `POST /api/dealer/warranty-registrations` - Register new warranty
- `GET /api/dealer/reorder-suggestions` - Smart reorder suggestions
- `POST /api/admin/dealer-announcements` - Create announcement (admin)
- `POST /api/admin/dealer-targets` - Set dealer targets (admin)

### Catalogue
- `POST /api/catalogue/scrape-website` - Bulk scrape with aiohttp
- `POST /api/catalogue/import-product` - Import single product
- `POST /api/catalogue/reprocess-images/{id}` - AI background removal retry
- `GET /api/product-datasheets/public/{id}` - Public view (no auth)

### OrderBot
- `GET /api/bot/universal-search/{query}` - Search across all collections
- `POST /api/bot/import-amazon-to-crm` - Import Amazon order
- `GET /api/bot/prepare-dispatch/{order_id}` - Dispatch preparation
- `GET /api/bot/diagnose-order/{order_id}` - Troubleshoot stuck orders
- `POST /api/bot/fix-order/{order_id}` - Apply fixes

### Amazon
- `POST /api/amazon/credentials` - Save firm credentials
- `GET /api/amazon/firms-with-credentials` - List firms

### Email-to-Ticket (NEW)
- `GET /api/email/inbox` - Get recent emails from inbox
- `GET /api/email/inbox/{message_id}` - Get full email content
- `GET /api/email/ticket-inbox` - Get emails not yet converted to tickets
- `POST /api/email/inbox/{message_id}/create-ticket` - Create ticket from email
- `GET /api/email/inbox/{message_id}/suggestions` - Get AI suggestions for ticket creation
- `POST /api/email/inbox/{message_id}/mark-read` - Mark email as read

## Test Credentials
- Admin: `admin@musclegrid.in` / `Muscle@846`

## File References
- `/app/backend/server.py` - Main backend
- `/app/backend/zoho_email_service.py` - Zoho Mail API integration
- `/app/frontend/src/pages/support/EmailTicketInbox.jsx` - Email-to-Ticket UI (NEW)
- `/app/frontend/src/pages/support/CallSupportDashboard.jsx` - Support Dashboard
- `/app/frontend/src/pages/admin/ProductDatasheets.jsx` - Catalogue UI
- `/app/frontend/src/components/orderbot/OrderBotWidget.jsx` - OrderBot
- `/app/frontend/src/pages/admin/AmazonSettings.jsx` - Amazon credentials

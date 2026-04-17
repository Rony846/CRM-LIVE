# CRM E-commerce Reconciliation System - PRD

## Original Problem Statement
Implement E-commerce Reconciliation and Amazon/Flipkart statement integrations. Expand Operations Assistant Bot (OrderBot) for accountants handling inventory, stock transfers, and Amazon order processing. Add universal search. Introduce 4-5 beautiful bright themes with a universal theme switcher button. Build a Product Datasheet and Catalogue Generator for Batteries, Solar Inverters, Stabilizers, Servo, Solar Panels, and Accessories. Ensure datasheets have a beautiful, highly animated, public-facing showcase page.

## Core Architecture
- **Backend**: FastAPI + MongoDB (server.py ~43,000 lines - refactoring deferred)
- **Frontend**: React + TailwindCSS + Shadcn UI
- **Integrations**: Amazon SP-API, OpenAI (gpt-image-1), Bigship Courier, Tata Smartflo IVR

## Key Features Implemented

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

### Session Latest (January 14, 2026)
- ✅ **BUG FIX**: OrderBot "No Stock Available" false positive for manufactured items
  - Fixed `is_manufactured` check to use `product_type == "manufactured"` OR `is_manufactured` flag
  - Serial numbers now correctly shown for manufactured items with stock
- ✅ **BUG FIX**: Duplicate orders in Pending Fulfillment queue
  - Added unique MongoDB indexes on `amazon_order_id`, `order_id`, `tracking_id`
  - Added duplicate key error handling on insert
- ✅ **BUG FIX**: Outbound Dispatcher "tracking ID already used" when processing pending fulfillment
  - Fixed `validate_no_duplicates` to exclude pending_fulfillment entry when creating dispatch from it

### Previous Session
- ✅ AI Background Removal for existing products (backend + UI button)
- ✅ Fixed OrderBot prepare_dispatch stuck bug (missing_fields conditional gap)
- ✅ Added shipping_label, serial_number, eway_bill handlers
- ✅ Missing Info alerts in Pending Fulfillment queue
- ✅ Bot ability to update dispatch queues
- ✅ GST ITC credit offset fixes (previous month's ITC against current month GST)
- ✅ Fixed Sales Data to read from `sales_invoices` instead of `dispatches`

### Earlier Sessions
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

### P0 (Critical)
- Backend Refactoring (DEFERRED by user request)

### P1 (High)
- Flipkart API Integration
- AI Amazon Title/Description UI integration

### P2 (Medium)
- WhatsApp sharing + QR codes on PDFs
- Dealer Portal Phase 2 (Live stock, announcements)
- Password Reset via Email
- Email sending for quotations

### P3 (Low)
- Dealer Portal Phase 3 (Targets, warranty registration)
- Automated Weekly/Monthly Excel reports

## API Endpoints Reference

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

## Test Credentials
- Admin: `admin@musclegrid.in` / `Muscle@846`

## File References
- `/app/backend/server.py` - Main backend
- `/app/frontend/src/pages/admin/ProductDatasheets.jsx` - Catalogue UI
- `/app/frontend/src/components/orderbot/OrderBotWidget.jsx` - OrderBot
- `/app/frontend/src/pages/admin/AmazonSettings.jsx` - Amazon credentials

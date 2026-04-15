# MuscleGrid CRM - Product Requirements Document

## Original Problem Statement
Build an E-commerce Reconciliation system with Amazon/Flipkart integrations. Expand Operations Assistant Bot (OrderBot) for accountants. Add universal search, 6-theme system, and Product Datasheet/Catalogue Generator for Batteries, Solar Inverters, Stabilizers, Servo, Solar Panels, and Accessories with animated public-facing showcase pages.

## What's Been Implemented

### Core CRM Features
- Dynamic 6-theme system with theme switcher
- Admin Product Datasheet generator with multiple image uploads and ASIN auto-fill
- Public-facing animated Product Catalogue with category pages
- Interactive showcase pages for all categories (Inverters, Batteries, Stabilizers, Servo, Solar Panels, Accessories)
- PDF export using html2canvas + jsPDF
- Floating WhatsApp button (9999036254)
- Master SKU linking for Proforma Invoices
- SMS triggers via Smartflo IVR

### Recent Session (Dec 2025)
- Fixed 403 Error on public catalogue product counts
- Made all Datasheet specification tables mobile-responsive
- Removed "Made with Emergent" branding
- Added centered logo with rounded corners on showcase page headers
- Added WhatsApp floating button via SharedComponents.jsx
- **Fixed Servo animation mobile overflow** - diagram now fits within 375px viewport
- **Fixed OrderBot search issues:**
  - Order ID search now uses partial match (was exact match)
  - Phone search now shows numbered order list with dispatch options
  - Dispatch update uses correct entry ID field

### PI to Fulfillment Conversion (Apr 2026)
- Created new `/api/quotations/{id}/convert-to-fulfillment` endpoint with mandatory fields:
  - Customer first & last name
  - Full address with state, pincode
  - Tracking ID, Invoice number
  - Shipping label PDF and Invoice PDF uploads
- Updated PIPendingAction.jsx with comprehensive conversion modal

### Dealer Flow Fixes (Apr 2026)
- **Admin Edit Dealer:** Added Email and Pincode fields to edit modal
- **Dealer Product Master SKU Mapping:** Fixed backend to handle ObjectId queries, frontend now uses `/api/master-skus` endpoint
- **New Dealer Products Page:** Created `/dealer/products` route with full catalogue view
  - Shows product cards with images, pricing, specifications
  - Links to product datasheets via master_sku_id
  - Detail modal with full specs from linked datasheet

### Bigship Dimension Fix (Apr 2026)
- **Fixed hardcoded shipping dimensions:** Bot now validates weight and dimensions before Bigship rate calculation
- **Flow:** 
  1. Bot first checks Master SKU for weight_kg, length_cm, breadth_cm, height_cm
  2. If not available in Master SKU, prompts accountant to enter manually
  3. No more hardcoded defaults (was 1kg, 10x10x10cm)

### Dispatch Payment Reference Fix (Apr 2026)
- **Fixed "Field required" error** when creating dispatch from Pending Fulfillment Queue
- **Root cause:** `payment_reference` was mandatory (`Form(...)`) but not needed for marketplace/PF orders
- **Fix:** Made `payment_reference` optional with validation logic:
  - Required for direct orders only
  - Not required for pending fulfillment orders (payment already tracked)
  - Not required for marketplace orders (Amazon, Flipkart)

### OrderBot Troubleshoot Feature (Apr 2026)
- **New "Troubleshoot" button** appears when searching orders
- **Diagnose endpoint** (`GET /api/bot/diagnose-order/{order_id}`) identifies:
  - Missing firm assignment
  - Missing Master SKU link
  - Missing customer details
  - Missing tracking ID
  - Missing invoice
  - Duplicate entries (in both pending_fulfillment and dispatches)
  - Orders not in dispatcher queue
- **Fix endpoint** (`POST /api/bot/fix-order/{order_id}`) can:
  - Assign firm to order
  - Link SKU manually or from Amazon mapping
  - Copy customer data from Amazon order
  - Add order to dispatcher queue
  - Cleanup duplicate entries

### Intelligent Catalogue Import & Amazon Listing System (Apr 2026)
- **Import Wizard** in Product Datasheets page with 3-step flow:
  1. **Step 1 - Add Products** via three methods:
     - Bulk Scrape: Scrape multiple products from WooCommerce/Shopify/StoreLink stores
     - Single URL: Scrape one product from any e-commerce site (faster for individual products)
     - Manual Entry: Manually add product with name, price, description, image
  2. **Step 2 - Select & Price**: Set margin percentage, auto-calculate Amazon prices
  3. **Step 3 - Push to Amazon**: Select firm with credentials, push to Amazon SP-API
- **Pricing Formula**: Amazon Price = (Website Price + Margin%) + 18% GST
  - Default margin: 70%
  - Global margin can be applied to all products
  - Individual margins can be edited per product
- **StoreLink Website Support**: Added specialized scraper for store.arbaccessories.in-style websites
  - Extracts product links from category pages
  - Parses prices with ₹ symbol correctly
  - Fetches product images from galleries
- **AI Image Enhancement**: Background removal using OpenAI GPT-image-1 edit API
  - Uses raw HTTP API calls (SDK doesn't support gpt-image-1 edit mode)
  - Removes background and replaces with solid white
  - Processes up to 5 images per product
- **Brand White-labeling**: "ARB" → "MG" automatic sanitization
  - Applied during scraping and import
  - Covers product names, descriptions, and specifications
- **Amazon Credentials Management**:
  - Firm selection dropdown shows credential status (checkmark/warning)
  - "Add Keys" / "Edit Keys" button opens credentials dialog
  - Saves: Seller ID, LWA Client ID/Secret, Refresh Token, AWS Access/Secret Keys, Marketplace ID
  - Endpoint: `POST /api/amazon/credentials`, `GET /api/amazon/credentials/{firm_id}`
  - List firms with credentials: `GET /api/amazon/firms-with-credentials`
- **Backend Endpoints**:
  - `POST /api/catalogue/scrape-website` - Bulk scrape products (supports StoreLink, WooCommerce, Shopify)
  - `POST /api/catalogue/scrape-product-url` - Scrape single product
  - `POST /api/catalogue/import-product` - Import product to catalogue
  - `POST /api/catalogue/push-to-amazon/{id}` - Push to Amazon SP-API
  - `POST /api/catalogue/enhance-image` - AI image enhancement (GPT Image 1)
  - `POST /api/catalogue/generate-bullets` - AI bullet point generation

## Technical Architecture
```
/app/
├── backend/
│   ├── server.py          # MONOLITH: >40,000 lines - DO NOT REFACTOR
│   ├── tests/test_dealer_flow.py  # Dealer CRUD tests
├── frontend/
│   └── src/
│       ├── App.js
│       ├── pages/public/
│       │   ├── CatalogueHome.jsx
│       │   ├── CategoryListing.jsx
│       │   ├── *Showcase.jsx (all categories)
│       ├── pages/dealer/
│       │   ├── DealerProducts.jsx (NEW - catalogue view)
│       ├── pages/quotations/
│       │   ├── PIPendingAction.jsx (updated with conversion modal)
│       ├── components/public/
│       │   ├── SharedComponents.jsx (Logo3D, WhatsAppButton)
│       ├── components/datasheets/ (PDF templates)
│       ├── components/orderbot/
│       │   ├── OrderBotWidget.jsx
```

## Key API Endpoints
- `GET /api/product-datasheets/public` - Public product list with counts
- `GET /api/product-datasheets/by-sku/{master_sku_id}` - Fetch by SKU
- `POST /api/upload` - Generic file upload (images, PDFs)
- `GET /api/bot/universal-search/{query}` - Universal search across all CRM data
- `POST /api/bot/dispatch-order` - Prepare order for dispatch
- `POST /api/quotations/{id}/convert-to-fulfillment` - PI to fulfillment with mandatory fields
- `GET /api/dealer/products-catalogue` - Dealer products with linked datasheet info
- `PATCH /api/admin/dealer-products/{id}` - Update dealer product with master_sku_id
- `PATCH /api/admin/dealers/{id}` - Update dealer details including email
- `POST /api/catalogue/scrape-website` - Bulk scrape products from e-commerce sites
- `POST /api/catalogue/scrape-product-url` - Scrape single product URL
- `POST /api/catalogue/import-product` - Import product to catalogue with pricing
- `POST /api/catalogue/push-to-amazon/{id}` - Push product to Amazon SP-API

## Database Schema (MongoDB)
- `product_datasheets`: model_name, category, images[], specifications{}, master_sku_id, amazon_asin, amazon_fields{ website_price, mrp, selling_price, margin_percent, gst_percent, hsn_code, amazon_sku, amazon_status }
- `pending_fulfillment`: id, order_id, amazon_order_id, status, tracking_id, customer_name, customer_phone
- `dealer_products`: id, name, sku, category, mrp, dealer_price, master_sku_id, is_active
- `dealers`: id, firm_name, phone, email, status, portal_activated

## Prioritized Backlog

### P0 - Critical (Deferred)
- [ ] Backend Refactoring (server.py >40K lines) - **WAIT FOR USER AUTHORIZATION**

### P1 - High Priority
- [ ] Flipkart API Integration (direct order pull like Amazon SP-API)

### P2 - Medium Priority
- [ ] WhatsApp sharing button & QR codes on PDFs
- [ ] Dealer Portal Phase 2 (live stock, product knowledge center)
- [ ] Password Reset via Email
- [ ] Email sending for quotations

### P3 - Low Priority
- [ ] Dealer Portal Phase 3 (targets, warranty registration)
- [ ] Automated Weekly/Monthly Excel reports

## Third-Party Integrations
| Service | Status | Notes |
|---------|--------|-------|
| Tata Smartflo IVR | Requires User Keys | SMS triggers |
| Fast2SMS | Requires User Keys | SMS |
| Bigship Courier | Requires User Keys | Shipping |
| Amazon SP-API | Implemented | Order sync |
| OpenAI Whisper & GPT | Emergent LLM Key | AI features |

## Test Credentials
- Admin: admin@musclegrid.in / Muscle@846

## Known Issues & Notes
- Amazon-scraped product images may show 404 (hotlinking blocked)
- Showcase page headers use absolute positioning for centered logo
- Mobile servo animation scaled to fit 375px viewport
- OrderBot search now uses partial match for order IDs
- Dealer products require master_sku_id linking to show in catalogue with specs
- **Public Datasheet pages now hide**: Amazon pricing, margins, source URLs (for dealer-facing display)
- **ARB → MG sanitization only applies to NEW imports** - existing data unchanged

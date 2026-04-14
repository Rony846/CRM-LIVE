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

## Technical Architecture
```
/app/
├── backend/
│   ├── server.py          # MONOLITH: >40,000 lines - DO NOT REFACTOR
├── frontend/
│   └── src/
│       ├── App.js
│       ├── pages/public/
│       │   ├── CatalogueHome.jsx
│       │   ├── CategoryListing.jsx
│       │   ├── *Showcase.jsx (all categories)
│       ├── components/public/
│       │   ├── SharedComponents.jsx (Logo3D, WhatsAppButton)
│       ├── components/datasheets/ (PDF templates)
```

## Key API Endpoints
- `GET /api/product-datasheets/public` - Public product list with counts
- `GET /api/product-datasheets/by-sku/{master_sku_id}` - Fetch by SKU
- `POST /api/upload` - Generic file upload (images, PDFs)

## Database Schema (MongoDB)
- `product_datasheets`: model_name, category, images[], specifications{}, master_sku_id, amazon_asin

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

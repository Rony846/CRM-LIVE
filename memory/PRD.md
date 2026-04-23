# MuscleGrid CRM - Product Requirements Document

## Original Problem Statement
Build a comprehensive CRM system with:
- Dealer Portal Phase 2 and 3
- Email-to-Ticket automation
- Critical financial/accounting/state-machine/security bug fixes
- OrderBot with improved UX for pending fulfillment
- Real AI-powered CRM Assistant (GPT-4o) with full operational capabilities

## Core Features Implemented

### Authentication & Authorization
- JWT-based authentication with role-based access control
- Roles: admin, accountant, dealer, viewer

### OrderBot (Operations Bot)
- Universal search (order ID, tracking, serial, phone)
- Amazon order fetching via SP-API
- Import to CRM workflow with customer detail validation
- Mark as Dispatched wizard with full customer collection
- Bigship integration for label generation
- Serial number selection for manufactured items
- Dispatch queue management

### AI CRM Assistant
- GPT-4o powered chat interface (`ai_agent.py`)
- Tools: fetch Amazon orders, update customer details, reserve serials, generate Bigship labels
- Frontend: `AIChatWidget.jsx`

### Customer Detail Enforcement (Dec 2025)
- Comprehensive validation before any dispatch action
- Address must be 10-50 characters
- 6-digit pincode, 10-digit phone validation
- Confirmation summary before import
- Backend stores customer fields in dispatches AND pending_fulfillment

## Technical Architecture

### Backend
- FastAPI with MongoDB (Motor async driver)
- `/app/backend/server.py` - Main API (monolithic)
- `/app/backend/ai_agent.py` - AI CRM Assistant with OpenAI tools

### Frontend
- React with TailwindCSS
- `/app/frontend/src/components/orderbot/OrderBotWidget.jsx` - Main bot UI
- `/app/frontend/src/components/orderbot/AIChatWidget.jsx` - AI chat interface

### Third-Party Integrations
- Amazon SP-API (user credentials in DB)
- OpenAI GPT-4o (user API key in .env)
- Zoho Mail API (OAuth tokens)
- Bigship API (credentials in .env)

## Recent Updates (April 2026)

### Accountant Full Financial Access (April 23, 2026)
- Granted accountant role access to all financial endpoints:
  - `PATCH /parties/{party_id}` - Update parties
  - `PUT /sales-invoices/{invoice_id}` - Update sales invoices
  - `POST /sales-invoices/{invoice_id}/recalculate` - Recalculate invoices
  - `POST /sales-invoices/backfill` - Backfill invoices
  - `POST /tds/sections` - Create TDS sections
  - `PATCH /tds/sections/{section_id}` - Update TDS sections
  - `PATCH /parties/{party_id}/tds-config` - Update party TDS config
  - `PATCH /purchases/{purchase_id}` - Update purchases
- Test user: accountant.test@musclegrid.in / Test@123

### Dealer Portal Debugging (April 23, 2026)
- Added debug endpoint `GET /api/dealer/debug-status` to diagnose "Cannot Place Orders" issues
- Verified admin-created dealers receive `status: "approved"` and `security_deposit_status: "approved"`
- Test dealer: john.dealer@testmail.com / Dealer@123 (created via admin, can place orders)

### Fixed Dealer Status Not Persisting Bug (April 23, 2026)
- **Root Cause**: Data schema inconsistency - backend was writing to nested `security_deposit.status` while dashboard read from flat `security_deposit_status`
- **Fix Applied**:
  1. Backend `PATCH /admin/dealers/{dealer_id}` now writes to BOTH flat and nested fields
  2. Backend `GET /admin/dealers` normalizes data to include both formats
  3. Frontend `openEditDealer()` reads from both locations with fallback
- Status changes from admin panel now persist correctly

## Known Issues / Backlog

### P0 - Critical
- [x] Accountant Full Financial Access (COMPLETED Apr 23, 2026)

### P1 - High Priority  
- [ ] AI Agent Bigship label generation payload format error
- [ ] Accountant Firm-Scope Enforcement (DB schema)

### P2 - Medium Priority
- [ ] E-commerce statement upload deduplication
- [ ] Stock transfer atomicity (wrap in transactions)
- [ ] WhatsApp sharing & QR codes on PDFs
- [ ] Password Reset via Email

### P3 - Low Priority / Future
- [ ] Automated Weekly/Monthly Excel reports
- [ ] Flipkart API Integration

## Credentials
- Admin: admin@musclegrid.in / Muscle@846
- Accountant (Test): accountant.test@musclegrid.in / Test@123

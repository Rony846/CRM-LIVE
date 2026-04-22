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

## Known Issues / Backlog

### P0 - Critical
- [ ] AI Agent Bigship label generation payload format error

### P1 - High Priority
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

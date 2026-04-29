# MuscleGrid CRM - Product Requirements Document

## Original Problem Statement
Build a comprehensive CRM system for MuscleGrid with:
- Dealer Portal (Phase 2 & 3)
- Email-to-Ticket automation
- CRM Assistant
- Omnidim.io Voice Agent Integration
- Amazon Browser Automation Agent (Playwright)
- Smartflo call analytics

## Core Architecture
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + TailwindCSS + Shadcn UI
- **Database**: MongoDB with Motor async driver
- **File Storage**: External NAS via FILE_API
- **Auth**: JWT-based with role-based access control

## User Roles
- Customer, Call Support, Supervisor, Service Agent, Accountant, Dispatcher, Admin, Gate, Technician, Dealer

## What's Been Implemented

### Session: April 29, 2026

#### Browser Agent Hybrid Order Processing Fix
- **Fixed Critical Lint Errors**: Removed 21 orphaned code block errors (lines 1018-1067) from `/app/backend/utils/browser_agent/__init__.py`
- **Verified Hybrid Approach Implementation**:
  - Browser (Playwright) → Amazon order details extraction
  - API → Bigship shipment creation with Delhivery (courier_id=1)
  - API → Label PDF download
  - Browser → Amazon tracking update
- **Validated Bigship API Integration**: Authentication, warehouse lookup, and payload structure confirmed working

### Session: April 28, 2026

#### Amazon Browser Agent with AI Command Interface
- **AI Assistant Chat Interface**: ChatGPT-style command panel for natural language commands
  - Commands: "check login status", "fetch orders", "process top N orders", "process all orders", "help"
  - Backend endpoint: `POST /api/browser-agent/ai-command`
- **Improved Login Detection**: 7-method robust login detection for Amazon Seller Central
- **Shipping Rules Applied Automatically**:
  - Weight > 20KG OR Order value > ₹30,000 → B2B shipping
  - Otherwise → B2C shipping
- **Files Modified**:
  - `/app/backend/utils/browser_agent/__init__.py` - Enhanced `check_login_status()`
  - `/app/backend/server.py` - Added AI command endpoint
  - `/app/frontend/src/pages/admin/browser-agent/BrowserAgentPage.jsx` - New UI with AI chat

### Previous Sessions

#### Omnidim.io Voice Agent Integration (DONE)
- Customer lookup by phone: `GET /api/omnidim/customer/{phone}`
- Ticket creation: `POST /api/omnidim/tickets`
- Ticket status: `GET /api/omnidim/ticket/{ticket_number}`
- Leads creation: `POST /api/omnidim/leads`
- Phone number parsing with +91 support

#### Smartflo Call Analytics (DONE)
- Dashboard with answered call counts
- Department aliases (DEPT_ALIASES)
- Dismissible alerts with 7-day TTL
- Alert dismissal: `POST /api/smartflo/alerts/dismiss`

#### Frontend Pages Created (DONE)
- `/leads` - Leads management UI with light/dark theme
- `/admin/browser-agent` - Playwright browser automation UI
- `/admin/browser-agent/files` - File Repository UI

## Pending Issues (Priority Order)

### P1 - High Priority
1. **AI Agent Bigship Label Payload** (RECURRING)
   - Update `_generate_shipping_label` tool in `ai_agent.py`
   - Map `consignee_detail` at root, `box_details` contains `product_details`

### P2 - Medium Priority
2. **Accountant Firm-Scope Enforcement**
   - Implement strict DB schema for accountant to see only assigned firm data
3. **E-commerce Statement Upload Dedup**
4. **Stock Transfer Non-Atomic**

## Upcoming Tasks
- P1: Optimize Playwright for 200MB RAM limit
- P2: WhatsApp sharing + QR codes on PDFs
- P2: Password reset via email

## Future/Backlog
- P3: Automated Weekly/Monthly Excel reports
- P3: Flipkart API Integration

## 3rd Party Integrations
- **Amazon SP-API**: User credentials
- **Playwright**: Browser automation (RAM optimized)
- **Omnidim.io**: API Key for voice agent
- **Smartflo**: API Key for call center
- **Bigship**: Shipping label generation

## Key Technical Notes
- Server RAM: 200MB limit - use Playwright with `--disable-dev-shm-usage`, `--no-sandbox`, `--disable-gpu`
- No WebSockets for frontend streaming (K8s ingress blocks) - use HTTP polling
- MongoDB ObjectId must be excluded from responses (not JSON serializable)

## Test Credentials
- Admin: `admin@musclegrid.in` / `Muscle@846`
- Accountant: `accountant.test@musclegrid.in` / `Test@123`

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

### Session: December 2025

#### WhatsApp AI Agent - Conversation Memory & Tool Loop Fixed (P0 RESOLVED)
- **Problem**: Bot forgot context immediately, tool calls output as raw text instead of executing
- **Solution**: Implemented proper conversation memory and tool execution loop in `WhatsAppAIBrain`
- **Changes to `/app/backend/whatsapp_agent/__init__.py`**:
  - `get_or_create_context()` now loads conversation history from MongoDB on startup
  - Added `_build_history_text()` to prime LLM with conversation context
  - Tool execution loop now: execute tool → append result to context → call LLM again for natural response
  - Added `MAX_TOOL_ITERATIONS = 3` to prevent infinite tool loops
  - Made tool functions accept flexible parameter names (e.g., `name` or `query`) via `**kwargs`
  - Added `_clean_response()` to strip any TOOL_CALL syntax from final responses
- **Verification**: Tested with Python scripts confirming:
  - ✅ Authentication state persists across sessions
  - ✅ Messages stored and loaded from MongoDB `whatsapp_conversations`
  - ✅ Tool execution works with natural language responses
  - ✅ Follow-up questions correctly reference previous conversation

#### WhatsApp AI - Complex Document Processing (NEW)
- **Requirement**: Read complex PDF files like invoices and user manuals
- **Solution**: Implemented GPT-4 Vision document extraction with PyMuPDF
- **Features**:
  - **PDF Processing**: Converts PDF pages to images at 150 DPI for clear OCR
  - **Multi-page Support**: Processes up to 10 pages, sends each to GPT-4 Vision
  - **Image Processing**: Handles JPEG, PNG, WEBP with auto-resize for large images
  - **Smart Extraction**: 
    - Invoices: vendor, items, amounts, taxes, GST, bank details
    - User Manuals: specs, features, installation, troubleshooting, warranty
    - Any Document: structured text extraction with tables
- **Dependencies Added**: `PyMuPDF`, `pytesseract`, `pdf2image`
- **Verification**: 
  - ✅ Single-page invoice extraction (3 items, amounts, GST details)
  - ✅ Multi-page manual extraction (3 pages, specs, features, installation)

#### AI Agent Bigship Payload Fixed (P1 RESOLVED)
- **Problem**: `ai_agent.py` used outdated Bigship API payload structure
- **Solution**: Updated `_generate_shipping_label()` to match browser agent's working payload
- **Changes to `/app/backend/ai_agent.py`**:
  - `consignee_detail` moved to ROOT level (not inside `order_detail`)
  - `document_detail` placed INSIDE `order_detail`
  - Added `product_category: "Others"` enum
  - Added `product_details` array inside `box_details`
  - Added phone number cleaning (strips +91, validates 10 digits)
  - Added name validation (minimum 3 chars for first_name/last_name)
  - Added address line padding for minimum 10 chars
  - Added `invoice_id` length validation (max 25 chars, removes dashes)
- **Verification**: Python script confirms payload structure matches API spec

### Session: April 29, 2026

#### WhatsApp AI Agent - Full CRM Control from WhatsApp
- **WhatsApp Web Connection** (`/app/backend/whatsapp_agent/bridge/`):
  - Node.js bridge using `whatsapp-web.js` library
  - QR code generation for linking WhatsApp
  - Message relay to Python backend for AI processing
  - Supervisor-managed service (`whatsapp-bridge`)

- **AI Brain with GPT-4** (`/app/backend/whatsapp_agent/__init__.py`):
  - `CRMToolRegistry`: 20+ CRM operations as callable tools
    - Party/Ledger: search, create, get details, record payments
    - Products: search, stock check, create
    - Purchases: create entries, get recent
    - Sales: create entries, get recent
    - Orders: get pending, process Amazon orders
    - Reports: daily summary, low stock, outstanding payments
    - Files: extract invoice data from images/PDFs
  - `WhatsAppAIBrain`: GPT-powered conversation manager
    - Natural language understanding
    - Multi-turn conversation context
    - File processing (OCR, PDF parsing)
    - Tool execution based on user intent

- **Frontend Page** (`/app/frontend/src/pages/admin/whatsapp/WhatsAppAgentPage.jsx`):
  - QR code scanner interface
  - Connection status indicator
  - Recent conversations viewer
  - Manual message sender

- **API Endpoints** (in `server.py`):
  - `GET /api/whatsapp/status` - Connection status
  - `GET /api/whatsapp/qr` - QR code for scanning
  - `POST /api/whatsapp/message` - Incoming message webhook
  - `POST /api/whatsapp/send` - Send message
  - `GET /api/whatsapp/conversations` - Recent conversations

#### Hybrid Architecture Implementation (Background Jobs + GPT Error Analysis)
- **Background Job Processing System**:
  - Created `/app/backend/utils/browser_agent/jobs/__init__.py` with:
    - `JobQueue` class for MongoDB-persisted job management
    - `ProcessingStep` enum for checkpoint-based recovery (QUEUED → SCRAPING → CREATING_SHIPMENT → MANIFESTING → DOWNLOADING_LABEL → UPDATING_TRACKING → COMPLETED)
    - `GPTErrorAnalyzer` class for intelligent error analysis
  - Added API endpoints: `POST /api/browser-agent/jobs/create`, `GET /api/browser-agent/jobs/{job_id}`, `GET /api/browser-agent/jobs`
  - Jobs run in background - no more HTTP timeouts!
  
- **GPT-Powered Error Analysis**:
  - When pattern matching fails, the agent now calls GPT-4o-mini to analyze the error
  - GPT provides specific diagnosis and exact field fixes
  - Fixes are automatically applied to the payload and retry is attempted

- **Bigship API Payload Fixes**:
  - Fixed `product_category` to use valid enum `"Others"` instead of `"General"`
  - Fixed `document_detail` placement (inside `order_detail` for both B2C and B2B)
  - Added `invoice_id` length validation (1-25 chars, removes dashes if needed)
  - Added duplicate order detection and recovery

- **Frontend Updates** (`BrowserAgentPage.jsx`):
  - Active Job status panel with progress bar
  - Real-time AI Thinking Log updates via job polling
  - Commands like "process 5 orders" automatically use background jobs

#### Browser Agent Hybrid Order Processing Fix
- **Fixed Critical Lint Errors**: Removed 21 orphaned code block errors (lines 1018-1067) from `/app/backend/utils/browser_agent/__init__.py`
- **Verified Hybrid Approach Implementation**:
  - Browser (Playwright) → Amazon order details extraction
  - API → Bigship shipment creation with Delhivery (courier_id=1)
  - API → Label PDF download
  - Browser → Amazon tracking update
- **Validated Bigship API Integration**: Authentication, warehouse lookup, and payload structure confirmed working

#### Intelligent Self-Healing AI Agent (NEW)
- **IntelligentDataProcessor Class**: GPT-powered data validation and auto-correction
  - Auto-fixes phone numbers (removes +91 prefix, validates 10-digit format)
  - Auto-fixes names (removes numbers, cleans special characters)
  - Auto-fixes addresses (pads short addresses, truncates long ones)
  - Auto-fixes pincodes (validates 6-digit Indian format)
- **Self-Healing Error Recovery**: 
  - 3 automatic retries with intelligent payload fixes
  - Analyzes API validation errors and applies targeted fixes
  - Never gets stuck - always finds alternative approaches
- **Real-Time AI Thinking Logs**:
  - Shows step-by-step reasoning process in UI
  - Timestamped thinking entries with color-coded status
  - Purple "AI Thinking Process" panel in frontend
- **Files Modified**:
  - `/app/backend/utils/browser_agent/__init__.py` - Added `IntelligentDataProcessor` class
  - `/app/frontend/src/pages/admin/browser-agent/BrowserAgentPage.jsx` - Added thinking log panel

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

### Session: April 30, 2026

#### Quotation Conversion Strict Routing (P0 RESOLVED)
- **Problem**: Quotation conversions could bypass the pending fulfillment queue by using "Direct Dispatch" option
- **Requirement**: All quotation conversions must go through pending dispatch queue with mandatory fields (invoice number, tracking ID, file uploads)
- **Solution**: Removed direct dispatch option, enforced strict fulfillment-only flow
- **Changes to `/app/backend/server.py`**:
  - `convert_quotation()` endpoint now rejects `conversion_type="dispatch"` with error message
  - Instructs users to use `convert-to-fulfillment` endpoint which enforces mandatory fields
- **Changes to `/app/frontend/src/pages/quotations/QuotationList.jsx`**:
  - Removed "Dispatch Now" from CONVERSION_TYPES
  - Added "Add to Dispatch Queue" option that redirects to PI Pending Action page
  - Shows info message about mandatory fields when selecting dispatch queue option
  - Button text changes to "Go to PI Pending Action" for dispatch queue conversion
- **Verification**:
  - ✅ Backend blocks direct dispatch with clear error message
  - ✅ Frontend shows updated conversion options (no direct dispatch)
  - ✅ Selecting "Add to Dispatch Queue" redirects to PI Pending Action page
  - ✅ PI Pending Action modal enforces all mandatory fields

#### Quick Convert Bulk Feature (ENHANCEMENT DONE)
- **Request**: Speed up bulk quotation conversions with pre-filled forms
- **Solution**: Added multi-select checkbox and "Quick Convert" bulk conversion wizard
- **Changes to `/app/frontend/src/pages/quotations/PIPendingAction.jsx`**:
  - Added checkbox column for multi-select in quotation table
  - "Select All" checkbox in header row
  - "Quick Convert (N)" green button appears when items selected
  - Progress-based wizard modal: "1 of N" with progress bar
  - Streamlined form focuses on Tracking ID, Invoice Number, File Uploads
  - Customer details pre-filled and collapsed (expandable to edit)
  - "Skip This" to skip a PI, "Convert & Next" to proceed through batch
  - Row highlighting when selected (`bg-cyan-900/20`)
- **Features**:
  - ✅ Multi-select with checkbox column
  - ✅ Progress indicator during bulk conversion
  - ✅ Pre-filled customer details (collapsible)
  - ✅ Focus on mandatory fields (tracking, invoice, files)
  - ✅ Skip option for individual items
  - ✅ Cancel all option
- **Verification**: Screenshots confirm UI working correctly

#### Amazon MTR Report Upload Feature (NEW - DONE)
- **Problem**: GST/HSN Dashboard shows "Not Specified" for states because dispatches don't have state information from Amazon orders
- **Solution**: Created MTR (Monthly Transaction Report) upload feature to enrich existing dispatches with state and GST data
- **Backend Changes** (`/app/backend/server.py`):
  - `POST /api/ecommerce/upload-mtr` - Upload and process MTR CSV (B2B/B2C)
  - `GET /api/ecommerce/mtr-reports` - List all uploaded MTR reports
  - `DELETE /api/ecommerce/mtr-reports/{report_id}` - Delete MTR report record
  - Matches MTR orders with existing dispatches by `order_id` / `marketplace_order_id`
  - Updates `customer_state`, `state`, and `gst_data` fields on dispatches
  - Deduplication: Prevents re-uploading same filename
  - Tracks stats: total_rows, shipment_rows, matched_dispatches, state_updated, gst_updated
- **Frontend Changes** (`/app/frontend/src/pages/finance/EcommerceReconciliation.jsx`):
  - Added "MTR Reports" tab
  - Info box explaining what MTR is
  - Upload MTR Report dialog (firm selector, B2B/B2C type selector)
  - Table showing uploaded reports with stats
  - Delete action for report records
- **Key Features**:
  - ✅ Does NOT create duplicate entries (only enriches existing dispatches)
  - ✅ Extracts: Ship To State, CGST, SGST, IGST, HSN codes, Invoice Numbers
  - ✅ Duplicate file upload prevention
  - ✅ Supports both B2B and B2C MTR formats
- **Verification**: 
  - ✅ Backend tested with curl
  - ✅ B2C MTR (190 rows) uploaded successfully
  - ✅ B2B MTR (22 rows) uploaded successfully
  - ✅ Duplicate upload blocked correctly
  - ✅ UI shows uploaded reports with stats

#### Flipkart Sales Report Upload Integration (NEW - DONE)
- **Request**: Integrate Flipkart Sales Report upload similar to Amazon MTR
- **Solution**: Extended GST Data Reports feature to support Flipkart Excel files
- **Backend Changes** (`/app/backend/server.py`):
  - `POST /api/ecommerce/upload-flipkart-sales` - Upload Flipkart Sales Report (.xlsx)
  - Parses Excel files, automatically finds "Sales Report" sheet (skips Help sheet)
  - Extracts: Order ID, Customer's Delivery State, IGST/CGST/SGST amounts, HSN codes, Invoice details
  - Same deduplication and enrichment logic as Amazon MTR
- **Frontend Changes** (`/app/frontend/src/pages/finance/EcommerceReconciliation.jsx`):
  - Renamed tab to "GST Data Reports" 
  - Added platform selector: Amazon MTR / Flipkart Sales Report
  - Dynamic form changes based on platform (CSV vs Excel, B2B/B2C vs Sales/GST)
  - Info boxes for both Amazon and Flipkart with download instructions
  - Flipkart reports shown with yellow badge, Amazon with blue/purple
- **Key Features**:
  - ✅ Supports .xlsx Excel files from Flipkart Seller Hub
  - ✅ Auto-detects Sales Report sheet in multi-sheet workbooks
  - ✅ Same deduplication logic (prevents re-upload)
  - ✅ Platform-specific UI styling (orange for Amazon, yellow for Flipkart)
- **Verification**:
  - ✅ Flipkart Sales Report (75 rows) uploaded successfully
  - ✅ UI correctly shows platform type (Flipkart badge with SALES sub-label)
  - ✅ Platform dropdown works with both options

#### Vyapar GSTR Integration & Consolidated Report Download (NEW - DONE)
- **Request**: Upload Vyapar GSTR1/3B reports and generate consolidated GST reports combining Amazon, Flipkart, and Vyapar data
- **Solution**: Complete GST consolidation feature with 3-source merge
- **Backend Changes** (`/app/backend/server.py`):
  - `POST /api/ecommerce/upload-vyapar-gstr` - Upload Vyapar GSTR1/GSTR3B Excel files
  - Parses B2CS (state-wise sales), HSN summary sheets with proper Vyapar format handling
  - Stores parsed GST data in `gst_report_data` collection for consolidation
  - `GET /api/gst/consolidated-report` - Preview consolidated data from all 3 sources
  - `GET /api/gst/download-consolidated` - Download Excel with multiple sheets:
    - Summary (source-wise breakdown)
    - B2B-All Sources (combined B2B invoices)
    - State-wise Summary
    - HSN Summary
- **Frontend Changes**:
  - Added Vyapar as third platform option (green styling)
  - Period selector (Month/Year) for Vyapar reports
  - "Download Consolidated" button with preview dialog
  - Preview shows source-wise breakdown (Amazon, Flipkart, Vyapar)
  - Shows consolidated totals (Taxable Value, Total GST)
- **Verification**:
  - ✅ Vyapar GSTR1 uploaded: 16 B2C invoices, 22 HSN entries, ₹4,97,172 taxable
  - ✅ UI shows all 4 reports with platform badges
  - ✅ Download Consolidated dialog working

#### CRM Audit Critical Fixes (December 2025)
- **C1: Stock Transfer Atomicity** ✅ FIXED
  - Implemented MongoDB transaction for atomic stock transfers
  - Both ledger entries (transfer_out, transfer_in) and serial updates now execute atomically
  - Full rollback on any failure prevents stock inconsistency
- **C3: E-commerce Statement Deduplication** ✅ FIXED
  - Added dual dedup checks: filename+firm+platform AND content MD5 hash
  - Prevents duplicate payout statement uploads with clear error messages
- **C5: Accountant Firm-Scope Enforcement** ✅ FIXED
  - Added `get_user_firm_scope()` helper function
  - Enforced in: `list_dispatches`, `list_payments`, `list_sales_invoices`, `list_purchases`, `list_stock_transfers`
  - Accountants now only see data from their assigned firm
- **C2: Party Ledger Balance Race Condition** ✅ FIXED
  - Created `create_party_ledger_entry_atomic()` helper using `party_balance_tracker` collection
  - Uses `find_one_and_update` with `$inc` for atomic balance updates
  - Applied to: payments, sales invoices, expenses, purchases
  - Added unique index on `party_balance_tracker.party_id`

## Pending Issues (Priority Order)

### P1 - High Priority
1. ~~**E-commerce Statement Upload Dedup**~~ ✅ DONE
2. ~~**Stock Transfer Non-Atomic**~~ ✅ DONE
3. ~~**Accountant Firm-Scope Enforcement**~~ ✅ DONE
4. ~~**Party Ledger Balance Race Condition**~~ ✅ DONE
5. **Browser Agent RAM Limit Enforcement** (200MB max)
6. **GST Calculation Consistency** (C4 - carry forward from quotation)

## Upcoming Tasks
- P2: WhatsApp sharing + QR codes on PDFs
- P2: Password reset via email

## Future/Backlog
- P3: Automated Weekly/Monthly Excel reports
- P3: Flipkart API Integration
- P3: GST Calculation Consistency (carry forward from quotation)

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
- MongoDB transactions require replica set - verify cluster configuration

## Test Credentials
- Admin: `admin@musclegrid.in` / `Muscle@846`
- Accountant: `accountant.test@musclegrid.in` / `Test@123`

# MuscleGrid CRM - Product Requirements Document

## Original Problem Statement
Implement Dealer Portal Phase 2/3, WhatsApp CRM AI Assistant (with GPT memory and tool execution), and Browser Agent Hybrid Order Automation. Expose Claude AI integration APIs, audit Hardware Queue workflow, fix global UI form components, resolve AI web chatbot dispatch bugs, enforce strict quotation conversion flows, and integrate multi-platform e-commerce GST/MTR reports (Amazon, Flipkart, Vyapar).

**Product Requirements**: Robust, multi-tenant CRM with strict finance, dispatch, and SLA enforcement, UI text visibility, and AI-agent compatibility.

## Architecture Overview
- **Frontend**: React with Shadcn/UI components
- **Backend**: FastAPI (monolithic `server.py` - 54,000+ lines)
- **Database**: MongoDB
- **MCP Server**: Custom Python server at `/app/mcp-server/` exposing 51 CRM tools to Claude Desktop
- **Integrations**: BigShip API (Courier/Logistics), WhatsApp-Web.js, Amazon SP-API, OpenAI GPT-4o

## Key Endpoints
- `POST /api/dispatches` - Create dispatch with invoice upload
- `PATCH /api/dispatches/{dispatch_id}/status` - Update dispatch status (legacy, now sets dispatched_at/delivered_at)
- `PATCH /api/dispatches/{dispatch_id}/invoice` - Attach invoice to existing dispatch
- `POST /api/dispatcher/dispatches/{dispatch_id}/finalize-retroactive` - Retroactive finalize with stock deduction
- `POST /api/pending-fulfillment/{id}/dispatch` - Dispatch pending fulfillment (marketplace orders)
- `POST /api/pending-fulfillment/{id}/dispatch-with-invoice` - NEW: Dispatch with invoice in one call

## Database Schema (Key Collections)
- `dispatches`: Shipment documents with `status`, `invoice_url`, `tracking_id`, `courier`, `dispatched_at`, `delivered_at`
- `pending_fulfillment`: Pre-dispatch queue for marketplace orders
- `party_ledger`: Financial transactions
- `master_skus`: Product catalog

## What's Been Implemented (Latest Session - May 2026)

### AI Agent Bulk Dispatch API - May 15, 2026
Created a comprehensive API set for Claude AI to process pending Amazon orders in bulk:

1. **`GET /api/ai-agent/firms`** - List all active firms
2. **`GET /api/ai-agent/pending-orders/{firm_id}`** - Get pending orders for a firm (crm_status = pending or amazon_shipped)
3. **`POST /api/ai-agent/process-shipped-orders`** - Bulk process orders with tracking info
4. **`POST /api/ai-agent/process-single-order`** - Single order processing convenience endpoint

**What the API does:**
- Creates dispatch records with tracking info
- Deducts stock (allows negative - never blocks shipments)
- Creates Sales Order for GST reporting
- Creates Sales Invoice for accounting
- Updates Amazon order status to "dispatched"
- Logs all actions in audit_logs

**MCP Server Tools Added:**
- `ai_agent_get_firms`
- `ai_agent_get_pending_orders`
- `ai_agent_process_shipped_orders`
- `ai_agent_process_single_order`

**Documentation:** `/app/memory/AI_AGENT_API_DOCS.md`

### Previous Session Work - May 3, 2026
1. **Legacy `/status` endpoint timestamps** - Added `dispatched_at` when status → `dispatched`, `delivered_at` when status → `delivered`
2. **DispatchResponse model** - Added `dispatched_at` and `delivered_at` fields to API response
3. **`dispatch_pending_fulfillment_with_invoice`** - Endpoint + MCP tool to dispatch marketplace orders with invoice in single call
4. **Vyapar GSTR1 Parser Fix** - Now reads master summary sheet to capture exact totals (₹1.88 Cr)
5. **Hybrid GST Recording** - Decoupled GST from dispatch for Amazon orders
6. **PI Conversion Deadlock Fix** - Resolved "Quotation conversion already in progress" error
7. **Admin User Management** - Excluded dealers from staff count

### Earlier Work
- MCP Server deployment to Hostinger VPS with 50+ tools
- OAuth PKCE authentication for Claude Desktop
- BigShip B2B LTL support with address_line2 fix
- `FRONTEND_URL` fix for PI links
- New endpoints: `attach_dispatch_invoice`, `finalize_dispatch_retroactive`, `update_dispatch_customer_fields`

## Prioritized Backlog

### P0 (Blocker - Requires Deploy)
- Deploy to production to enable `finalize_dispatch_retroactive` for 223 dispatches

### P1 (High Priority)
- Browser Agent 200MB RAM constraints (`--disable-dev-shm-usage`, memory tracking)

### P2 (Medium Priority)
- WhatsApp sharing button and QR codes on generated PDFs
- Password Reset via Email

### P3 (Low Priority/Future)
- Automated Weekly/Monthly Excel reports
- Refactor `server.py` monolith into FastAPI Routers

## Technical Debt
- **Critical**: `/app/backend/server.py` is 54,000+ lines - needs to be split into domain-specific routers
- MCP Server connects to production (`newcrm.musclegrid.in`) not preview environment

## Test Credentials
- Admin: `admin@musclegrid.in` / `Muscle@846`
- Firm ID (MuscleGrid): `c715c1b7-aca3-4100-8b00-4f711a729829`

## Notes
- Dispatches can be created via multiple pathways:
  1. `POST /api/dispatches` - Requires invoice file upload (for direct orders)
  2. `POST /api/pending-fulfillment/{id}/dispatch` - No invoice required (marketplace orders)
  3. `POST /api/pending-fulfillment/{id}/dispatch-with-invoice` - NEW: With invoice attachment

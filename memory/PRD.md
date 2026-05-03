# MuscleGrid CRM - Product Requirements Document

## Original Problem Statement
Implement Dealer Portal Phase 2/3, WhatsApp CRM AI Assistant (with GPT memory and tool execution), and Browser Agent Hybrid Order Automation. Expose Claude AI integration APIs, audit Hardware Queue workflow, fix global UI form components, resolve AI web chatbot dispatch bugs, enforce strict quotation conversion flows, and integrate multi-platform e-commerce GST/MTR reports (Amazon, Flipkart, Vyapar).

**Product Requirements**: Robust, multi-tenant CRM with strict finance, dispatch, and SLA enforcement, UI text visibility, and AI-agent compatibility.

## Architecture Overview
- **Frontend**: React with Shadcn/UI components
- **Backend**: FastAPI (monolithic `server.py` - 54,000+ lines)
- **Database**: MongoDB
- **MCP Server**: Custom Python server at `/app/mcp-server/` exposing 50 CRM tools to Claude Desktop
- **Integrations**: BigShip API (Courier/Logistics), WhatsApp-Web.js, Amazon SP-API, OpenAI GPT-4o

## Key Endpoints
- `POST /api/dispatches` - Create dispatch with invoice upload
- `PATCH /api/dispatches/{dispatch_id}/status` - Update dispatch status (legacy)
- `PATCH /api/dispatches/{dispatch_id}/invoice` - Attach invoice to existing dispatch
- `POST /api/dispatcher/dispatches/{dispatch_id}/finalize-retroactive` - Retroactive finalize
- `POST /api/pending-fulfillment/{id}/dispatch` - Dispatch pending fulfillment (marketplace orders)

## Database Schema (Key Collections)
- `dispatches`: Shipment documents with `status`, `invoice_url`, `tracking_id`, `courier`, `dispatched_at`, `delivered_at`
- `pending_fulfillment`: Pre-dispatch queue for marketplace orders
- `party_ledger`: Financial transactions
- `master_skus`: Product catalog

## What's Been Implemented (Latest Session - May 2026)

### Bug Fixes - May 3, 2026
1. **Legacy `/status` endpoint timestamps** - Added `dispatched_at` when status changes to `dispatched`, `delivered_at` when status changes to `delivered`
2. **DispatchResponse model** - Added `dispatched_at` and `delivered_at` fields to API response

### Previous Session Work
- MCP Server deployment to Hostinger VPS with 50 tools
- OAuth PKCE authentication for Claude Desktop
- BigShip B2B LTL support with address_line2 fix
- `FRONTEND_URL` fix for PI links
- New endpoints: `attach_dispatch_invoice`, `finalize_dispatch_retroactive`, `update_dispatch_customer_fields`

## Prioritized Backlog

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
- Dispatches can be created via two pathways:
  1. `POST /api/dispatches` - Requires invoice file upload (for direct orders)
  2. `POST /api/pending-fulfillment/{id}/dispatch` - No invoice required (marketplace orders, can attach later)

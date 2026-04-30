# MuscleGrid CRM - Product Requirements Document

## Original Problem Statement
Implement Dealer Portal Phase 2/3, WhatsApp CRM AI Assistant (with GPT memory and tool execution), and Browser Agent Hybrid Order Automation. Expose Claude AI integration APIs, audit Hardware Queue workflow, fix global UI form components, resolve AI web chatbot dispatch bugs, enforce strict quotation conversion flows, and integrate multi-platform e-commerce GST/MTR reports (Amazon, Flipkart, Vyapar).

**Product Requirements:** Robust, multi-tenant CRM with strict finance, dispatch, and SLA enforcement, UI text visibility, and AI-agent compatibility.

---

## Core Architecture
- **Frontend:** React + TailwindCSS + Shadcn/UI + Recharts
- **Backend:** FastAPI (Python) - Monolithic `server.py` (~53,000 lines)
- **Database:** MongoDB
- **3rd Party Integrations:**
  - WhatsApp-Web.js (Node Bridge)
  - Amazon SP-API
  - Playwright (Browser Automation)
  - Bigship Courier API
  - OpenAI GPT-4o (via Emergent LLM Key)
  - Tata Smartflo Click-to-Call
  - Fast2SMS

---

## What's Been Implemented

### April 2025 - Session Complete

#### CRM Deep Audit Fixes (DONE)
- C1: Stock Transfer Atomicity - MongoDB transactions
- C2: Party Ledger Race Condition - `find_one_and_update` with `$inc`
- C3: E-commerce Order Deduplication
- C5: Accountant Scope - Firm-level isolation

#### High-Priority Logic Fixes (DONE)
- H1: Invoice Number Collision Prevention
- H2: Dealer Payment Tracking
- H3: Warranty Auto-registration on Invoice
- H4: SLA Auto-escalation via APScheduler
- H6: Credit Note Invoice Linkage

#### Premium UI/UX Redesign (DONE)
- 5 Apple-like "Pro" themes: Dark, Ocean, Forest, Sunset, Rose
- Robust text visibility across all themes
- ThemeSwitcher component

#### Zoho-Style Finance Analytics (DONE)
- Revenue Trends Charts
- Profit & Loss Statement
- Aging Reports (Receivables/Payables)
- GST Summary Dashboard
- Trial Balance
- Top Customers Report

#### API Documentation for AI Agents (DONE)
- Swagger UI at `/api/docs`
- ReDoc at `/api/redoc`
- Generated `API_DOCUMENTATION.md`
- Machine-readable `API_REFERENCE.json`

#### MCP Server for AI Agents (DONE - April 30, 2025)
- Created `/app/mcp-server/` with 32 CRM tools
- Supports REST API and MCP JSON-RPC protocol
- Tools: inventory, finance, orders, tickets, dealers, WhatsApp
- Ready for deployment to `mcp.musclegrid.in`

---

## Prioritized Backlog

### P0 - Critical (Deploy)
- [x] MCP Server built
- [ ] Deploy CRM to production (`newcrm.musclegrid.in`)
- [ ] Deploy MCP Server to `mcp.musclegrid.in`

### P1 - High Priority
- [ ] Browser Agent RAM optimization (200MB limit)
- [ ] Add API key authentication to MCP Server

### P2 - Medium Priority
- [ ] WhatsApp sharing button on PDFs
- [ ] QR codes linking to showcase page
- [ ] Password Reset via Email

### P3 - Low Priority / Technical Debt
- [ ] Refactor `server.py` monolith into API routers
- [ ] Automated Weekly/Monthly Excel reports
- [ ] Webhook events for external integrations

---

## Key API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user

### Finance
- `GET /api/finance/analytics/revenue-trends`
- `GET /api/finance/analytics/profit-loss`
- `GET /api/finance/analytics/aging-report`
- `GET /api/finance/analytics/gst-summary`

### Inventory
- `GET /api/inventory/stock`
- `POST /api/inventory/transfer` (Atomic)

### MCP Server
- `GET /mcp/tools` - List 32 available tools
- `POST /mcp/execute` - Execute tool (REST)
- `POST /mcp` - MCP JSON-RPC protocol

---

## Credentials
- Admin: `admin@musclegrid.in` / `Muscle@846`
- Production URL: `https://newcrm.musclegrid.in`
- MCP Server (after deploy): `https://mcp.musclegrid.in`

---

## Files of Reference
- `/app/backend/server.py` - Main backend
- `/app/frontend/src/index.css` - 5 Pro themes
- `/app/frontend/src/pages/finance/FinanceAnalytics.jsx` - Analytics UI
- `/app/mcp-server/server.py` - MCP Server
- `/app/docs/API_DOCUMENTATION.md` - API docs
- `/app/docs/CRM_AUDIT_REPORT.md` - Audit status

---

*Last Updated: April 30, 2025*

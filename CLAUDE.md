# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MuscleGrid CRM — enterprise CRM for a company selling batteries / inverters / stabilizers / solar. FastAPI + MongoDB backend, React 19 + Tailwind + shadcn/ui frontend. Originally bootstrapped on the Emergent platform; expect occasional Emergent-specific tooling (`@emergentbase/visual-edits`, `_stubs/emergentintegrations`, `.emergent/`).

## Running the stack

Backend (FastAPI on `:8001`, all routes prefixed `/api`):
```
cd backend && python server.py
# or: uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Backend requires `backend/.env` with at minimum `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS`. MongoDB runs locally as a systemd service (`mongod.service`).

Frontend (CRA + Craco on `:3000`, package manager is **yarn**):
```
cd frontend && yarn install && yarn start    # dev
cd frontend && yarn build                    # prod
cd frontend && yarn test                     # CRA test runner
```
The frontend reads `REACT_APP_BACKEND_URL` from `frontend/.env` and calls `${REACT_APP_BACKEND_URL}/api`. Webpack alias `@` → `frontend/src`.

MCP server (separate FastAPI on `:8002`, exposes ~32 CRM tools to AI agents):
```
cd mcp-server && pip install -r requirements.txt && python server.py
```

Backend tests use pytest (`pytest backend/tests/`), but most testing happens via the top-level `backend_test.py` script and the `test_result.md` protocol — see "Testing protocol" below.

## Architecture

**Backend is a monolith.** `backend/server.py` is ~54k lines and contains nearly every route, Pydantic model, business rule, and the FastAPI app itself. `models/schemas.py` duplicates a subset of the response models; `routers/` exists but is empty. Don't assume routes live in `routers/` — grep `server.py` first. A single `api_router = APIRouter(prefix="/api")` is mounted at the end (`app.include_router(api_router)`), and all routes are decorated `@api_router.<verb>(...)`. The browser-agent and WebSocket endpoints attach directly to `app` (not via `api_router`).

**MongoDB via Motor (async).** Connection at module load using `MONGO_URL` / `DB_NAME`. Collections are accessed directly as `db.<name>` — there is no ORM and no schema migration system; schema changes happen in code and historical data is repaired with the one-off scripts in `backend/migrations/` (those are imperative Python scripts run by hand, not an Alembic-style migration framework).

**Auth.** JWT (HS256, 24h) via `JWT_SECRET`. Roles are strings on the user document — `admin`, `supervisor`, `call_support`, `service_agent` (technician), `accountant`, `dispatcher`, `gate`, `customer`, `dealer`. Role-gating uses a `require_roles([...])` dependency. **Accountant scope:** accountants are firm-scoped — `get_user_firm_scope(user)` returns a `firm_id` filter for accountants and `None` (= see all) for admin. Any new collection query that an accountant can hit must respect this.

**Frontend routing.** `frontend/src/App.js` registers every route in one giant `<Routes>` block. Pages are organized by role under `src/pages/<role>/`. Admins have SSO-style access to every internal dashboard (call support, supervisor, technician, accountant, dispatcher, gate). When adding a page, register it in `App.js` and gate it with the same role check pattern already in use.

**External integrations** (configured via `backend/.env`, mostly optional — code tolerates missing keys):
- Zoho Mail (`zoho_email_service.py`) — transactional emails, templates already wired
- OpenAI (`ai_agent.py`) — `OPENAI_API_KEY`, used by the AI ops assistant
- Bigship / Amazon SP-API / Smartflo / Twilio / Razorpay / Stripe
- WhatsApp via Node bridge in `backend/whatsapp_agent/bridge/` (separate Node process)
- Browser automation via Playwright (`utils/browser_agent/`) for Amazon scraping

**Storage.** File uploads go through `utils/storage.py` (abstracts S3 / local / NAS). `app.mount("/api/uploads", ...)` serves uploaded files. Don't write directly to disk — use `storage_upload`.

## Conventions worth knowing

- Ticket numbers: `MG-R-YYYYMMDD-XXXXX` (regular), `MG-W-YYYYMMDD-XXXXX` (walk-in). State machine is in `server.py` (`class StateMachine`) — new statuses go there.
- Accounting uses Indian financial year ("2526" = FY 2025-26) and GST state codes. See `ACCOUNTING_LOGIC_DOCUMENTATION.md` for the full set of invariants — debits/credits, IGST vs CGST/SGST, payment status transitions.
- The `emergentintegrations` PyPI package is intentionally commented out in `requirements.txt`; a stub lives in `backend/_stubs/`. If you import it, make sure `_stubs/` ends up on `sys.path` or use the stub path.
- Don't enable `@emergentbase/visual-edits` in production — `craco.config.js` already restricts it to dev (`NODE_ENV !== "production"`).
- `backend/uploads/`, `frontend/build/`, `frontend/node_modules/`, large CSV exports at the repo root, and `merged_crm_export_with_dealers.json` are data artifacts — not code; don't reformat or restructure them.

## Testing protocol (preserve verbatim)

`test_result.md` is a structured handoff file between a "main agent" and a "testing agent". The block between `# START - Testing Protocol` and `# END - Testing Protocol` is contract — do not edit or remove it. When asked to run or coordinate tests, append YAML entries below that block following the documented schema (task name, working flag, status_history with agent attribution, etc.) rather than inventing a new format.

## Further reading

Heavy domain docs live at the repo root and are kept up to date enough to trust as a first stop:
- `CRM_COMPLETE_DOCUMENTATION.md` — full feature/role/endpoint catalog
- `ACCOUNTING_LOGIC_DOCUMENTATION.md` — accounting module invariants
- `DATABASE_API_DOCUMENTATION.md` — collection list and key fields
- `FRONTEND_DEVELOPER_GUIDE.md` — frontend conventions and test credentials
- `docs/CLAUDE_AI_AGENT_API.md`, `docs/WHATSAPP_AI_AGENT.md` — agent-facing APIs
- `mcp-server/README.md` — MCP tool catalog
- `memory/` — domain notes (dealer migration, dispatch flow, email touchpoints, PRD)

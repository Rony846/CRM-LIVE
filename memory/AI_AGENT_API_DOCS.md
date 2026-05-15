# AI Agent Bulk Dispatch API Documentation

## Overview
These APIs allow automated processing of Amazon orders with auto-generated packing slips.

## Base URL
- Production: `https://newcrm.musclegrid.in`

## Authentication
All endpoints require Bearer token authentication.
```
Authorization: Bearer <access_token>
```

---

## **NEW WORKFLOW: Auto-Create Dispatches with Packing Slips**

### Step 1: Fetch Orders from Amazon SP-API (Existing)
Orders are already synced to CRM via:
```
POST /api/amazon/fetch-orders?firm_id=xxx&days_back=30
```

### Step 2: Auto-Create Dispatches with Packing Slips
```
POST /api/ai-agent/auto-create-dispatches?firm_id=xxx&limit=5
```

**What this does:**
1. Gets pending Amazon orders (limit 5)
2. Generates PDF packing slips for each
3. Creates dispatch records with packing slips attached
4. Status = `pending_tracking` (ready for tracking entry)

**Response:**
```json
{
  "firm_id": "xxx",
  "firm_name": "MuscleGrid Pvt Ltd",
  "summary": {
    "total_orders_found": 5,
    "dispatches_created": 5,
    "errors": 0
  },
  "results": {
    "success": [
      {
        "amazon_order_id": "171-8887059-4476748",
        "dispatch_id": "48045d63-...",
        "dispatch_number": "DISP-20260515-00017",
        "packing_slip_file_id": "6b9bc1c7-...",
        "order_total": 4522.0,
        "status": "pending_tracking"
      }
    ]
  },
  "next_step": "Add tracking IDs via POST /api/dispatches/{dispatch_id}/add-tracking"
}
```

### Step 3: View Pending Tracking
```
GET /api/dispatches/pending-tracking?firm_id=xxx
```

Returns all dispatches waiting for tracking IDs.

### Step 4: Add Tracking ID (Manual Entry)
```
POST /api/dispatches/{dispatch_id}/add-tracking
Content-Type: multipart/form-data

tracking_id: DEL111222333
carrier: Delhivery
dispatched_at: 2026-05-15T10:00:00Z (optional)
```

**What this does:**
1. Adds tracking ID and carrier to dispatch
2. Deducts stock (allows negative)
3. Creates Sales Order for GST
4. Creates Sales Invoice
5. Marks dispatch as "dispatched"

---

## Packing Slip PDF Access

View/download packing slip:
```
GET /api/file-repo/{packing_slip_file_id}
```

---

## API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai-agent/firms` | GET | List active firms |
| `/api/ai-agent/pending-orders/{firm_id}` | GET | Get pending orders needing processing |
| `/api/ai-agent/auto-create-dispatches` | POST | Auto-create dispatches with packing slips |
| `/api/dispatches/pending-tracking` | GET | List dispatches awaiting tracking |
| `/api/dispatches/{id}/add-tracking` | POST | Add tracking and finalize dispatch |
| `/api/ai-agent/process-shipped-orders` | POST | Bulk process already-shipped orders with tracking |
| `/api/file-repo/{file_id}` | GET | Download packing slip PDF |

---

## Common Carriers
- `Delhivery`
- `BlueDart`
- `DTDC`
- `Ecom Express`
- `Amazon Easy Ship`
- `Xpressbees`

---

## Workflow Comparison

### Old Way (Manual):
1. Fetch Amazon orders ✓
2. Manually download packing slip from Amazon ❌
3. Manually create dispatch in CRM ❌
4. Manually add tracking ❌

### New Way (Automated):
1. Fetch Amazon orders ✓
2. Call `auto-create-dispatches` - generates packing slip + creates dispatch ✓ (AUTO)
3. Only add tracking ID ✓ (MANUAL)

---

## MCP Tools (Claude Desktop)

- `ai_agent_get_firms`
- `ai_agent_get_pending_orders`
- `ai_agent_auto_create_dispatches` (NEW)
- `ai_agent_process_shipped_orders`
- `ai_agent_process_single_order`

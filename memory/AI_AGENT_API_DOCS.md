# AI Agent Bulk Dispatch API Documentation

## Overview
These APIs allow Claude AI to process pending Amazon orders that have already been shipped but are stuck in the CRM. The APIs handle all financial compliance (stock deduction, GST, invoices) automatically.

## Base URL
- Production: `https://newcrm.musclegrid.in`
- Preview: Use REACT_APP_BACKEND_URL

## Authentication
All endpoints require Bearer token authentication.
```
Authorization: Bearer <access_token>
```

Get token via:
```
POST /api/auth/login
Content-Type: application/json
{"email": "admin@musclegrid.in", "password": "..."}
```

---

## API Endpoints

### 1. List Active Firms
Get all firms to know which ones to process.

**Endpoint:** `GET /api/ai-agent/firms`

**Response:**
```json
{
  "firms": [
    {
      "id": "c715c1b7-aca3-4100-8b00-4f711a729829",
      "name": "MuscleGrid Pvt Ltd",
      "gstin": "27AABCU9603R1ZM",
      "state": "Maharashtra"
    }
  ],
  "message": "Use firm_id to fetch pending orders for each firm"
}
```

---

### 2. Get Pending Orders for a Firm
Get all Amazon orders that need processing.

**Endpoint:** `GET /api/ai-agent/pending-orders/{firm_id}`

**Query Parameters:**
- `include_amazon_shipped` (boolean, default: true) - Include orders with amazon_shipped status
- `limit` (int, default: 500) - Max orders to return

**Response:**
```json
{
  "firm": {
    "id": "...",
    "name": "MuscleGrid Pvt Ltd",
    "gstin": "...",
    "state": "Maharashtra"
  },
  "stats": {
    "pending_count": 15,
    "amazon_shipped_count": 3,
    "total_need_processing": 18,
    "returned_in_response": 18
  },
  "orders": [
    {
      "amazon_order_id": "171-7798517-4641935",
      "purchase_date": "2026-05-01T10:00:00Z",
      "amazon_status": "Shipped",
      "crm_status": "pending",
      "is_easy_ship": false,
      "order_total": 4522.0,
      "buyer_name": "Customer Name",
      "city": "Delhi",
      "state": "Delhi",
      "items": [
        {
          "amazon_sku": "MGSKVA90AAC",
          "master_sku_id": null,
          "master_sku_code": null,
          "title": "MuscleGrid 5 kVA Voltage Stabilizer",
          "quantity": 1
        }
      ],
      "existing_tracking": null,
      "existing_carrier": null,
      "required_from_claude": {
        "tracking_id": "REQUIRED - AWB/tracking number from Amazon or courier",
        "carrier": "REQUIRED - Carrier name (Delhivery, BlueDart, DTDC, Ecom Express, Amazon Easy Ship, etc.)",
        "dispatched_at": "OPTIONAL - ISO date when shipped (e.g., 2026-05-01T10:00:00Z), defaults to now"
      }
    }
  ],
  "instructions": {
    "endpoint": "POST /api/ai-agent/process-shipped-orders",
    "description": "Use this endpoint to mark orders as dispatched with tracking info",
    "note": "Stock will be deducted (negative allowed). GST/financial records created automatically."
  }
}
```

---

### 3. Process Shipped Orders (Bulk)
Mark multiple orders as dispatched with their tracking info.

**Endpoint:** `POST /api/ai-agent/process-shipped-orders`

**Request Body:**
```json
{
  "firm_id": "c715c1b7-aca3-4100-8b00-4f711a729829",
  "orders": [
    {
      "amazon_order_id": "171-7798517-4641935",
      "tracking_id": "DEL123456789",
      "carrier": "Delhivery",
      "dispatched_at": "2026-05-01T12:00:00Z",  // Optional
      "invoice_number": "INV-CUSTOM-001",        // Optional
      "invoice_value": 4522.0                    // Optional override
    },
    {
      "amazon_order_id": "408-7963833-8365121",
      "tracking_id": "ECO987654321",
      "carrier": "Ecom Express"
    }
  ]
}
```

**Response:**
```json
{
  "firm_id": "c715c1b7-aca3-4100-8b00-4f711a729829",
  "firm_name": "MuscleGrid Pvt Ltd",
  "processed_at": "2026-05-15T10:53:17.606695+00:00",
  "summary": {
    "total_submitted": 2,
    "successful": 2,
    "skipped": 0,
    "errors": 0
  },
  "results": {
    "success": [
      {
        "amazon_order_id": "171-7798517-4641935",
        "dispatch_id": "01b985b7-8414-4c5e-91d7-14c46de5266a",
        "dispatch_number": "DISP-20260515-00016",
        "invoice_number": "INV-MUS-20260515-0006",
        "tracking_id": "DEL123456789",
        "carrier": "Delhivery",
        "order_total": 4522.0,
        "stock_entries_created": 1
      }
    ],
    "errors": [],
    "skipped": []
  }
}
```

---

### 4. Process Single Order
Convenience endpoint for one-at-a-time processing.

**Endpoint:** `POST /api/ai-agent/process-single-order`

**Query Parameters:**
- `firm_id` (required)
- `amazon_order_id` (required)
- `tracking_id` (required)
- `carrier` (required)
- `dispatched_at` (optional)
- `invoice_number` (optional)
- `invoice_value` (optional)

---

## Common Carriers
- `Delhivery`
- `BlueDart`
- `DTDC`
- `Ecom Express`
- `Amazon Easy Ship`
- `Xpressbees`
- `Shadowfax`
- `India Post`

---

## What Happens When You Process an Order

1. **Dispatch Record Created** - Full dispatch entry with tracking
2. **Stock Deducted** - Inventory reduced (negative allowed, never blocks)
3. **Sales Order Created** - For GST reporting
4. **Sales Invoice Created** - For accounting
5. **Amazon Order Updated** - Status set to "dispatched"
6. **Audit Log Created** - For compliance tracking

---

## Workflow for Claude AI

### Step 1: Get Firms
```
GET /api/ai-agent/firms
```

### Step 2: For Each Firm, Get Pending Orders
```
GET /api/ai-agent/pending-orders/{firm_id}
```

### Step 3: Pull Tracking Info from Amazon
For each order, get tracking ID and carrier from Amazon Seller Central.

### Step 4: Submit Processed Orders
```
POST /api/ai-agent/process-shipped-orders
{
  "firm_id": "...",
  "orders": [...]
}
```

---

## Error Handling

| Error | Meaning |
|-------|---------|
| "Order not found in CRM" | Need to fetch order from Amazon first |
| "Already dispatched" | Order was already processed (skipped) |
| "Order is cancelled" | Cancelled orders are skipped |

---

## MCP Tools (for Claude Desktop)

If using MCP Server, these tools are available:
- `ai_agent_get_firms`
- `ai_agent_get_pending_orders`
- `ai_agent_process_shipped_orders`
- `ai_agent_process_single_order`

MCP Server URL: `https://mcp.musclegrid.in`

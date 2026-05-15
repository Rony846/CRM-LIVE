# Amazon Order Processing Guide for Claude

## Overview
This guide explains how to process Amazon orders using Playwright and the MCP Server tools.

## Complete Workflow

### Step 1: Pull Orders from Amazon Seller Central (Playwright)
Use Playwright to:
1. Login to Amazon Seller Central
2. Navigate to Manage Orders
3. Filter for "Unshipped" orders
4. Extract order details:
   - Amazon Order ID (e.g., 408-1234567-8901234)
   - Customer Name
   - Phone Number
   - Shipping Address (Address, City, State, Pincode)
   - Product Name, ASIN, SKU
   - Order Total
   - Ship By Date

### Step 2: Sync Orders to CRM
Use the `sync_amazon_orders` tool:

```json
{
  "tool": "sync_amazon_orders",
  "arguments": {
    "firm_id": "<firm_id>",
    "orders": [
      {
        "amazon_order_id": "408-1234567-8901234",
        "customer_name": "John Doe",
        "phone": "9876543210",
        "address": "123 Main Street, Apartment 4B",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001",
        "product_name": "MuscleGrid 10KVA Stabilizer",
        "asin": "B08XYZ1234",
        "sku": "MG10KVA",
        "quantity": 1,
        "order_total": 15000,
        "ship_by_date": "2026-05-20"
      }
    ]
  }
}
```

### Step 3: Auto-Create Dispatches with Packing Slips
Use `ai_agent_auto_create_dispatches` to create dispatch records with auto-generated packing slip PDFs:

```json
{
  "tool": "ai_agent_auto_create_dispatches",
  "arguments": {
    "firm_id": "<firm_id>",
    "limit": 5
  }
}
```

This creates dispatches with status `pending_tracking`.

### Step 4: Get Tracking IDs from Courier Dashboard (Playwright)
Use Playwright to:
1. Login to Delhivery/courier dashboard
2. Find orders by customer name/phone
3. Extract AWB/Tracking numbers

### Step 5: Add Tracking to Dispatches
Option A - Single dispatch:
```json
{
  "tool": "add_tracking_to_dispatch",
  "arguments": {
    "dispatch_id": "<dispatch_id>",
    "tracking_id": "1234567890123",
    "carrier": "Delhivery"
  }
}
```

Option B - Bulk tracking:
```json
{
  "tool": "bulk_add_tracking",
  "arguments": {
    "dispatches": [
      {"dispatch_id": "abc123", "tracking_id": "1234567890123", "carrier": "Delhivery"},
      {"dispatch_id": "def456", "tracking_id": "1234567890124", "carrier": "Delhivery"}
    ]
  }
}
```

### Alternative: Process Orders with Known Tracking
If you already have tracking IDs from Amazon:

```json
{
  "tool": "ai_agent_process_shipped_orders",
  "arguments": {
    "firm_id": "<firm_id>",
    "orders": [
      {
        "amazon_order_id": "408-1234567-8901234",
        "tracking_id": "1234567890123",
        "carrier": "Delhivery"
      }
    ]
  }
}
```

---

## Key MCP Tools Reference

### Discovery Tools
| Tool | Purpose |
|------|---------|
| `ai_agent_get_firms` | Get list of firms (needed for firm_id) |
| `ai_agent_get_pending_orders` | Get pending Amazon orders for a firm |
| `get_amazon_order_status` | Check if an order is already processed |
| `get_dispatches_pending_tracking` | Get dispatches awaiting tracking |

### Sync Tools
| Tool | Purpose |
|------|---------|
| `sync_amazon_orders` | Import orders scraped from Amazon |
| `ai_agent_auto_create_dispatches` | Create dispatches with packing slips (max 5) |

### Processing Tools
| Tool | Purpose |
|------|---------|
| `add_tracking_to_dispatch` | Add tracking to single dispatch |
| `bulk_add_tracking` | Add tracking to multiple dispatches |
| `ai_agent_process_shipped_orders` | Bulk process orders with tracking |
| `ai_agent_process_single_order` | Process single order with tracking |

### Shipping Tools
| Tool | Purpose |
|------|---------|
| `calculate_shipping_rates` | Get courier rates before booking |
| `create_courier_shipment` | Book shipment with BigShip |
| `manifest_shipment` | Generate AWB |
| `get_shipping_label` | Download shipping label PDF |

---

## Firm IDs (for reference)
Call `ai_agent_get_firms` to get current firm IDs. Common firms:
- MuscleGrid Main
- MuscleGrid Amazon
- (Call the tool to get updated list)

---

## Error Handling

### Order Already Processed
If `get_amazon_order_status` returns `crm_status: "dispatched"`, skip that order.

### Stock Issues
Stock is automatically deducted (negative stock allowed) - orders are never blocked.

### Missing Customer Data
The `sync_amazon_orders` tool will update existing orders with new data if phone/address was missing.

---

## Example Complete Flow

```
1. ai_agent_get_firms → Get firm_id
2. [Playwright: Scrape Amazon orders]
3. sync_amazon_orders → Import orders to CRM
4. ai_agent_auto_create_dispatches → Create dispatches + packing slips
5. [Playwright: Get tracking from courier dashboard]
6. bulk_add_tracking → Finalize all dispatches
7. Done! Orders are marked dispatched with invoices created
```

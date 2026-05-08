# Amazon Order Processing Flow - Complete Path Documentation

## Overview
This document traces the complete lifecycle of an Amazon order from SP-API fetch to final dispatch, showing exactly where each data field is saved and ensuring no information is collected twice.

---

## STAGE 1: Amazon Order Sync (SP-API Fetch)
**Trigger**: Manual or scheduled sync from Amazon Seller Central  
**Collection**: `db.amazon_orders`

### Data Fetched from Amazon SP-API:
| Field | Amazon Source | Saved At |
|-------|--------------|----------|
| `amazon_order_id` | `AmazonOrderId` | `amazon_orders.amazon_order_id` |
| `buyer_name` | `BuyerInfo.BuyerName` | `amazon_orders.buyer_name` |
| `buyer_phone` | `BuyerInfo.BuyerPhone` | `amazon_orders.buyer_phone` |
| `order_total` | `OrderTotal.Amount` | `amazon_orders.order_total` |
| `items[]` | `OrderItems` | `amazon_orders.items[]` |
| `shipping_address` | `ShippingAddress` | `amazon_orders.shipping_address` |
| `fulfillment_channel` | `FulfillmentChannel` | `amazon_orders.fulfillment_channel` (AFN/MFN) |
| `purchase_date` | `PurchaseDate` | `amazon_orders.purchase_date` |
| `crm_status` | - | `amazon_orders.crm_status` (pending/in_pending_fulfillment/dispatched) |

### Easy Ship vs MFN Detection:
- **Easy Ship**: `fulfillment_channel === 'AFN'` or `is_easy_ship === true`
- **MFN**: `fulfillment_channel === 'MFN'` (requires manual label generation)

---

## STAGE 2: Bot Conversation / Manual Entry
**Trigger**: Accountant enters Amazon Order ID in AI Chat Bot  
**Actor**: AI Agent (`ai_agent.py`)  
**Tools Used**: `search_order`, `fetch_amazon_order`, `import_amazon_order_to_crm`

### 2A: Order Lookup
Bot first searches CRM for existing order:
```
db.pending_fulfillment.find({amazon_order_id: order_id})
db.dispatches.find({order_id: order_id})
db.amazon_orders.find({amazon_order_id: order_id})
```

### 2B: Import to CRM (if not exists)
**Function**: `_import_amazon_order_to_crm()` (ai_agent.py:1354)  
**Creates Record In**: `db.pending_fulfillment`

| Field | Source | Saved At |
|-------|--------|----------|
| `id` | Generated UUID | `pending_fulfillment.id` |
| `order_id` | Amazon Order ID | `pending_fulfillment.order_id` |
| `amazon_order_id` | Amazon Order ID | `pending_fulfillment.amazon_order_id` |
| `customer_name` | `shipping_address.Name` OR bot input | `pending_fulfillment.customer_name` |
| `customer_phone` | Bot asks user (MFN) | `pending_fulfillment.customer_phone` |
| `address` | `shipping_address.AddressLine1+2` | `pending_fulfillment.address` |
| `city` | `shipping_address.City` | `pending_fulfillment.city` |
| `state` | `shipping_address.StateOrRegion` | `pending_fulfillment.state` |
| `pincode` | `shipping_address.PostalCode` | `pending_fulfillment.pincode` |
| `order_value` | `order_total.Amount` | `pending_fulfillment.order_value` |
| `invoice_value` | `order_total.Amount` | `pending_fulfillment.invoice_value` |
| `master_sku_id` | SKU mapping lookup | `pending_fulfillment.master_sku_id` |
| `is_manufactured` | From `master_skus.product_type` | `pending_fulfillment.is_manufactured` |
| `is_easyship` | From Amazon data | `pending_fulfillment.is_easyship` |
| `status` | "pending_dispatch" | `pending_fulfillment.status` |

### 2C: Update Missing Customer Details (MFN Orders)
**Tool**: `update_pending_fulfillment`  
**Function**: `_update_pending_fulfillment()` (ai_agent.py:1446)

Bot asks for missing info ONLY if not already present:
- `customer_name` → `pending_fulfillment.customer_name`
- `customer_phone` → `pending_fulfillment.customer_phone`
- `address`, `city`, `state`, `pincode` → respective fields

**RULE**: Bot uses `_get_order_details()` to check what's already collected. Never re-asks for existing data.

---

## STAGE 3: Shipping Label Generation (MFN Only)
**Trigger**: Order needs tracking ID for dispatch  
**Tool**: `generate_shipping_label`  
**Function**: `_generate_shipping_label()` (ai_agent.py:1486)

### Prerequisites Checked:
```python
if not pf.get("customer_name"): missing.append("customer_name")
if not pf.get("customer_phone"): missing.append("customer_phone")
if not pf.get("address"): missing.append("address")
if not pf.get("pincode"): missing.append("pincode")
```

### BigShip API Integration:
1. Creates shipment with consignee details from `pending_fulfillment`
2. Auto-generates invoice PDF with order details
3. Gets courier rates and selects cheapest
4. Manifests shipment to get AWB

### Data Updated After Label Generation:
| Field | Source | Saved At |
|-------|--------|----------|
| `tracking_id` | BigShip AWB | `pending_fulfillment.tracking_id` |
| `courier` | BigShip courier name | `pending_fulfillment.courier` |
| `label_url` | BigShip label URL | `pending_fulfillment.label_url` |
| `bigship_order_id` | BigShip system_order_id | `pending_fulfillment.bigship_order_id` |

---

## STAGE 4: Stock Check & Serial Reservation
**Trigger**: Before dispatch creation  
**Tools**: `check_serial_availability`, `reserve_serial_for_order`

### 4A: Stock Check
**Function**: `_check_serial_availability()` (ai_agent.py:704)

Checks stock based on `master_sku_id` from `pending_fulfillment`:
```python
db.finished_good_serials.find({
    "master_sku_id": pf["master_sku_id"],
    "firm_id": pf["firm_id"],
    "status": "in_stock"
})
```

Bot informs user:
- If stock available: "X units in stock, proceeding..."
- If no stock: "No stock available for this SKU"

### 4B: Serial Reservation (Manufactured Items Only)
**Function**: `_reserve_serial_for_order()` (ai_agent.py:1831)

Only required if `pending_fulfillment.is_manufactured === true`:

| Field | Source | Saved At |
|-------|--------|----------|
| `serial_number` | Auto-selected or user-specified | `pending_fulfillment.serial_number` |
| `status` | "reserved" | `finished_good_serials.status` |
| `reserved_by_order_id` | PF ID | `finished_good_serials.reserved_by_order_id` |

**RULE**: If `is_manufactured === false`, bot skips serial reservation entirely.

---

## STAGE 5: Dispatch Creation (Move to Dispatcher Queue)
**Trigger**: All prerequisites met (tracking, serial if needed)  
**Tool**: `create_dispatch_for_order`  
**Function**: `_create_dispatch_for_order()` (ai_agent.py:1912)

### Prerequisites Validation:
```python
if pf.get("is_manufactured") and not pf.get("serial_number"):
    missing.append("serial_number")
if not pf.get("is_easyship") and not pf.get("tracking_id"):
    missing.append("tracking_id")
```

### Creates Record In: `db.dispatches`

| Field | Source | Saved At |
|-------|--------|----------|
| `id` | Generated UUID | `dispatches.id` |
| `dispatch_number` | Auto-generated | `dispatches.dispatch_number` |
| `pending_fulfillment_id` | From PF | `dispatches.pending_fulfillment_id` |
| `order_id` | From PF | `dispatches.order_id` |
| `amazon_order_id` | From PF | `dispatches.amazon_order_id` |
| `customer_name` | From PF | `dispatches.customer_name` |
| `phone` | From PF (`customer_phone`) | `dispatches.phone` |
| `address` | From PF | `dispatches.address` |
| `city` | From PF | `dispatches.city` |
| `state` | From PF | `dispatches.state` |
| `pincode` | From PF | `dispatches.pincode` |
| `tracking_id` | From PF | `dispatches.tracking_id` |
| `serial_number` | From PF | `dispatches.serial_number` |
| `master_sku_id` | From PF | `dispatches.master_sku_id` |
| `quantity` | From PF | `dispatches.quantity` |
| `firm_id` | From PF | `dispatches.firm_id` |
| `dispatch_type` | "amazon_easyship" or "amazon_mfn" | `dispatches.dispatch_type` |
| `status` | "ready_for_dispatch" | `dispatches.status` |

### Updates `pending_fulfillment`:
```python
{
    "status": "in_dispatch_queue",
    "dispatch_id": dispatch_record["id"],
    "updated_at": now_iso
}
```

---

## STAGE 6: Dispatcher Finalization (Physical Dispatch)
**Actor**: Dispatcher role  
**Endpoint**: `POST /api/dispatcher/dispatches/{dispatch_id}/finalize`

### What Happens:
1. Stock deduction (for non-manufactured) or serial marking (for manufactured)
2. Creates `stock_movements` entry
3. Creates `sales_orders` entry
4. Updates `dispatches.status` → "dispatched"
5. Sets `dispatches.dispatched_at` timestamp
6. Updates `pending_fulfillment.status` → "dispatched"

### Final Data State:

**dispatches collection:**
| Field | Value |
|-------|-------|
| `status` | "dispatched" |
| `dispatched_at` | ISO timestamp |
| `scanned_out_at` | ISO timestamp |
| `stock_deducted` | true |

**pending_fulfillment collection:**
| Field | Value |
|-------|-------|
| `status` | "dispatched" |

**finished_good_serials (if manufactured):**
| Field | Value |
|-------|-------|
| `status` | "dispatched" |
| `dispatch_id` | Dispatch ID |

---

## DATA FLOW SUMMARY

```
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 1: Amazon SP-API Sync                                         │
│ Collection: amazon_orders                                           │
│ Fields: amazon_order_id, buyer_name, order_total, shipping_address  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 2: Bot Import to CRM                                          │
│ Collection: pending_fulfillment                                     │
│ NEW: customer_phone (if MFN), invoice_value                         │
│ COPIED: customer_name, address, city, state, pincode, order_value   │
│ ENRICHED: master_sku_id, is_manufactured                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 3: Label Generation (MFN only)                                │
│ Collection: pending_fulfillment (update)                            │
│ NEW: tracking_id, courier, label_url, bigship_order_id              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 4: Stock Check & Serial Reservation                           │
│ Collections: finished_good_serials, pending_fulfillment             │
│ NEW: serial_number (if manufactured)                                │
│ STATUS: serial → "reserved"                                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 5: Dispatch Creation                                          │
│ Collection: dispatches (new), pending_fulfillment (update)          │
│ COPIED: ALL customer/shipping data from pending_fulfillment         │
│ STATUS: dispatch → "ready_for_dispatch", PF → "in_dispatch_queue"   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 6: Dispatcher Finalization                                    │
│ Collections: dispatches, pending_fulfillment, stock_movements,      │
│              sales_orders, finished_good_serials                    │
│ NEW: dispatched_at, delivered_at                                    │
│ STATUS: dispatch → "dispatched", PF → "dispatched"                  │
│ STOCK: deducted, serial → "dispatched"                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## NO-DUPLICATE DATA COLLECTION RULES

1. **customer_name**: Fetched from Amazon SP-API at Stage 1, never asked again
2. **customer_phone**: 
   - Easy Ship: Available from Amazon
   - MFN: Asked ONCE at Stage 2, stored in `pending_fulfillment.customer_phone`
3. **address/city/state/pincode**: From Amazon shipping_address, never asked again
4. **invoice_value**: Computed from `order_total` at Stage 2, flows through
5. **tracking_id**: 
   - Easy Ship: From Amazon
   - MFN: Generated at Stage 3 via BigShip, stored once
6. **serial_number**: Reserved ONCE at Stage 4, flows to dispatch
7. **master_sku_id**: Resolved at Stage 2 via SKU mapping, never asked again

---

## AI AGENT CONTEXT PRESERVATION

The bot uses `_get_order_details()` (ai_agent.py:651) before any action to check existing data:

```python
# Issues detected automatically:
if not pf.get("customer_phone"):
    issues.append("Missing customer phone")
if not pf.get("tracking_id"):
    issues.append("Missing tracking ID")
if not pf.get("invoice_url"):
    issues.append("Missing invoice")
if not pf.get("serial_number") and pf.get("is_manufactured"):
    issues.append("Missing serial number (manufactured item)")
```

This ensures the bot ONLY asks for what's missing, never repeating questions.

---

## ALTERNATIVE PATH: Amazon Tracking Add (server.py)

For orders synced via `/api/amazon/add-tracking`:
**Function**: `add_tracking_to_amazon_order()` (server.py:28350)

This path also creates `pending_fulfillment` records with the same field mapping, using:
- Manual customer details for MFN/History orders
- Amazon data for Easy Ship orders

Same data flow applies from Stage 3 onwards.

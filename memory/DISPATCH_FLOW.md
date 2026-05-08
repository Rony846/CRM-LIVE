# Dispatch Flow Documentation

## 1. Amazon Order Fetch Flow (Bot)

### Step 1: Search Order
- **Endpoint**: `GET /api/bot/universal-search/{query}`
- **Searches in**: `amazon_orders`, `pending_fulfillment`, `dispatches`, `quotations`
- **Returns**: Order details with current status and location

### Step 2: Import to CRM (if not in CRM)
- **Endpoint**: `POST /api/bot/import-amazon-to-crm`
- **Required Data**:
  - `amazon_order_id`
  - `customer_name`
  - `customer_phone`
  - `shipping_address`
  - `firm_id`
  - `invoice_file` (optional but recommended)
  - `tracking_id` (optional)
- **Creates entry in**: `pending_fulfillment` collection
- **Status set**: `pending_dispatch`

### Step 3: Troubleshoot/Diagnose Order
- **Endpoint**: `GET /api/bot/diagnose-order/{order_id}`
- **Checks for**:
  - Missing `master_sku_id` (product not linked)
  - Missing `customer_name`
  - Missing `customer_phone`
  - Missing `firm_id`
  - Missing `tracking_id`
  - Missing `invoice_url`
  - E-way bill requirement (if invoice > ₹50,000)
- **Returns**: List of issues and available fixes

### Step 4: Fix Issues (Bot Auto-Fix)
- **Endpoint**: `POST /api/bot/fix-order/{order_id}`
- **Fix Types**:
  - `link_sku` - Link Master SKU by code
  - `assign_firm` - Assign firm to order
  - `copy_customer_details` - Copy from Amazon order
  - `update_tracking` - Add tracking ID
- **Updates**: `pending_fulfillment` entry

### Step 5: Prepare Dispatch
- **Endpoint**: `GET /api/bot/prepare-dispatch/{order_id}`
- **Validates**:
  1. Order exists in `pending_fulfillment`
  2. Not already dispatched
  3. Master SKU linked
  4. Stock available (for serialized items)
  5. Invoice uploaded (for Amazon MFN)
  6. Tracking ID available
  7. E-way bill (if > ₹50,000)
- **Returns**: `ready_to_dispatch: true/false` with `missing_fields` list

### Step 6: Execute Dispatch (Bot)
- **Endpoint**: `POST /api/bot/dispatch`
- **Required Form Data**:
  - `order_id`
  - `confirmed: true`
  - `tracking_id` (if not already set)
  - `serial_numbers` (for manufactured items)
  - `invoice_value`
- **Compliance Checks** (for Amazon MFN):
  1. ✅ Tracking ID required
  2. ✅ Invoice must be uploaded
  3. ✅ Shipping label (or Bigship order)
  4. ✅ E-way bill (if > ₹50,000)
  5. ✅ Dispatch must be confirmed

### Step 7: Creates Dispatch Entry
- **Collection**: `dispatches`
- **Status**: `ready_for_dispatch`
- **Dispatch Number**: `DSP-YYYYMMDD-XXXX`
- **Updates `pending_fulfillment`**: status → `in_dispatch_queue`
- **Updates `amazon_orders`**: crm_status → `ready_for_dispatch`

---

## 2. Outbound Dispatch from Pending Fulfillment Queue

### Entry Points:
1. **PI → Import**: Quotation/PI converted to pending fulfillment
2. **Amazon Import**: Bot imports Amazon order
3. **Offline Order**: Manual order entry

### Pending Fulfillment Status Flow:
```
pending_dispatch → ready_to_dispatch → in_dispatch_queue → dispatched
```

### Dispatcher Queue Entry:
- **Collection**: `dispatches`
- **Status**: `ready_for_dispatch`
- **Displayed in**: Dispatcher Dashboard (`/dispatcher`)

### Dispatcher Actions:
1. **View Queue**: `GET /api/dispatcher/queue`
   - Returns items with `status: "ready_for_dispatch"`
2. **Mark Dispatched**: `PATCH /api/dispatcher/dispatches/{id}/update`
   - Sets `status: "dispatched"`
   - Sets `dispatched_at` timestamp
   - Updates `pending_fulfillment.status` → `dispatched`

---

## 3. Verification & Validation Points

### Before Adding to Pending Fulfillment:
- Customer details required
- Firm assignment required
- Items/SKU information required

### Before Prepare Dispatch:
| Field | Amazon MFN | EasyShip | FBA | Offline |
|-------|-----------|----------|-----|---------|
| Tracking ID | ✅ Required | ❌ Optional | ❌ Optional | ❌ Optional |
| Invoice Upload | ✅ Required | ❌ Optional | ❌ Optional | ❌ Optional |
| Shipping Label | ✅ Required | ❌ Optional | ❌ Optional | ❌ Optional |
| Master SKU | ✅ Required | ✅ Required | ✅ Required | ✅ Required |
| E-Way Bill (>₹50K) | ✅ Required | ✅ Required | ✅ Required | ❌ Optional |

### Bot Auto-Fix Capabilities:
1. **Link SKU from Mapping** - If Amazon ASIN has mapping to Master SKU
2. **Assign Firm** - Assign to default firm or selected firm
3. **Copy Customer Details** - From Amazon order to pending fulfillment
4. **Generate Tracking** - Via Bigship integration

---

## 4. Potential Issues & Fixes

### Issue 1: Dispatch not showing in Dispatcher Queue
**Possible Causes**:
- Dispatch created with wrong status (not `ready_for_dispatch`)
- Query filter not matching
- Collection mismatch

**Check**:
```javascript
db.dispatches.find({status: "ready_for_dispatch"})
```

### Issue 2: Duplicate Dispatch Prevention
**Check at line 37137-37154**:
- Checks by `pending_fulfillment_id`
- Checks by `order_id`
- Checks by `marketplace_order_id`
- Allows re-dispatch if previous was cancelled

### Issue 3: Status Mismatch
**Two different ready statuses**:
- `ready_for_dispatch` - For `dispatches` collection
- `ready_to_dispatch` - For `pending_fulfillment` collection

The Dispatcher Queue ONLY looks for `ready_for_dispatch` in `dispatches`.

---

## 5. Database Collections Involved

| Collection | Purpose |
|------------|---------|
| `amazon_orders` | Raw Amazon order data |
| `pending_fulfillment` | Orders awaiting dispatch |
| `dispatches` | Dispatch entries for Dispatcher |
| `master_skus` | Product catalog |
| `firms` | Company/seller entities |
| `audit_logs` | Action tracking |

---

## 6. Key Endpoints Reference

### Bot Endpoints:
- `GET /api/bot/universal-search/{query}` - Search orders
- `POST /api/bot/import-amazon-to-crm` - Import Amazon order
- `GET /api/bot/diagnose-order/{order_id}` - Check for issues
- `POST /api/bot/fix-order/{order_id}` - Fix issues
- `GET /api/bot/prepare-dispatch/{order_id}` - Validate for dispatch
- `POST /api/bot/dispatch` - Create dispatch entry
- `POST /api/bot/update-pending-fulfillment` - Update queue entry fields

### Dispatcher Endpoints:
- `GET /api/dispatcher/queue` - Get dispatch queue
- `PATCH /api/dispatcher/dispatches/{id}/update` - Update dispatch status
- `POST /api/dispatcher/dispatches/{id}/mark-dispatched` - Mark as dispatched

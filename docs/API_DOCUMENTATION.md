# MuscleGrid CRM - Complete API Documentation for AI Agents

> **Version**: 2.0.0  
> **Base URL**: `https://your-domain.com/api`  
> **Authentication**: JWT Bearer Token  
> **Swagger UI**: `/api/docs`  
> **OpenAPI JSON**: `/api/openapi.json`

---

## Quick Start for AI Agents

### 1. Authentication
```bash
# Login and get token
curl -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@musclegrid.in", "password": "your_password"}'

# Response: {"access_token": "eyJ...", "token_type": "bearer"}
```

### 2. Making Authenticated Requests
```bash
curl -X GET "$BASE_URL/api/tickets" \
  -H "Authorization: Bearer $TOKEN"
```

---

## API Categories

### 🔐 Authentication APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/register` | Register new user |
| GET | `/auth/me` | Get current user profile |
| PATCH | `/auth/me` | Update current user profile |
| POST | `/auth/otp/send` | Send OTP for phone auth |
| POST | `/auth/otp/verify` | Verify OTP |

**Login Request:**
```json
{
  "email": "admin@musclegrid.in",
  "password": "your_password"
}
```

**Login Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "admin@musclegrid.in",
    "role": "admin",
    "first_name": "Admin",
    "last_name": "User"
  }
}
```

---

### 🎫 Ticket Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tickets` | List all tickets with filters |
| POST | `/tickets` | Create new ticket |
| GET | `/tickets/{ticket_id}` | Get ticket details |
| PATCH | `/tickets/{ticket_id}` | Update ticket |
| POST | `/tickets/{ticket_id}/escalate-to-supervisor` | Escalate ticket |
| POST | `/tickets/{ticket_id}/route-to-hardware` | Route to hardware team |
| POST | `/tickets/{ticket_id}/start-repair` | Start repair process |
| POST | `/tickets/{ticket_id}/complete-repair` | Complete repair |
| POST | `/admin/tickets/{ticket_id}/close` | Close ticket |
| POST | `/admin/tickets/{ticket_id}/change-status` | Change ticket status |
| GET | `/admin/sla/breached-tickets` | Get SLA breached tickets |
| POST | `/admin/sla/check-breaches` | Trigger SLA breach check |

**Create Ticket Request:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "9876543210",
  "device_type": "inverter",
  "serial_number": "INV123456",
  "issue_description": "Device not turning on",
  "support_type": "hardware"
}
```

**List Tickets Query Parameters:**
- `status`: Filter by status (new_request, assigned, in_progress, resolved, closed)
- `support_type`: hardware, phone
- `search`: Search by phone, name, or serial
- `assigned_to`: Filter by assigned agent
- `limit`: Results limit (default: 100)

---

### 📦 Dispatch APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dispatches` | List all dispatches |
| POST | `/dispatches` | Create dispatch |
| PATCH | `/dispatches/{dispatch_id}/status` | Update dispatch status |
| PATCH | `/dispatches/{dispatch_id}/label` | Update shipping label |
| GET | `/dispatcher/queue` | Get dispatcher queue |
| POST | `/dispatcher/dispatches/{dispatch_id}/finalize` | Finalize dispatch |
| PUT | `/dispatcher/dispatches/{dispatch_id}/cancel` | Cancel dispatch |

**Create Dispatch Request:**
```json
{
  "customer_name": "John Doe",
  "phone": "9876543210",
  "address": "123 Main Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "firm_id": "firm_uuid",
  "dispatch_type": "ecommerce",
  "items": [
    {
      "master_sku_id": "sku_uuid",
      "quantity": 1,
      "unit_price": 15000
    }
  ]
}
```

**Dispatch Statuses:**
- `pending_fulfillment` - Awaiting processing
- `pending_dispatch` - Ready for shipping
- `dispatched` - Shipped
- `delivered` - Delivered
- `cancelled` - Cancelled

---

### 💰 Finance APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/finance/analytics/revenue-trends` | Revenue trend data |
| GET | `/finance/analytics/profit-loss` | P&L statement |
| GET | `/finance/analytics/cash-flow` | Cash flow analysis |
| GET | `/finance/analytics/expense-breakdown` | Expense by category |
| GET | `/finance/analytics/aging-report` | Receivables/Payables aging |
| GET | `/finance/analytics/trial-balance` | Trial balance |
| GET | `/finance/analytics/gst-summary` | GST/GSTR summary |
| GET | `/finance/analytics/top-customers` | Top customers by revenue |
| GET | `/sales-invoices` | List sales invoices |
| POST | `/sales-invoices` | Create sales invoice |
| GET | `/purchases` | List purchases |
| POST | `/purchases` | Create purchase |
| GET | `/payments` | List payments |
| POST | `/payments` | Record payment |
| GET | `/expenses` | List expenses |
| POST | `/expenses` | Create expense |
| GET | `/credit-notes` | List credit notes |
| POST | `/credit-notes` | Create credit note |

**Revenue Trends Query Parameters:**
- `period`: 3months, 6months, 12months, ytd
- `firm_id`: Filter by firm (optional)

**Aging Report Query Parameters:**
- `report_type`: receivables, payables
- `firm_id`: Filter by firm (optional)

**Record Payment Request:**
```json
{
  "party_id": "party_uuid",
  "firm_id": "firm_uuid",
  "payment_type": "received",
  "payment_mode": "upi",
  "amount": 15000,
  "payment_date": "2025-04-30",
  "reference_number": "UTR123456"
}
```

---

### 📊 Inventory APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/master-skus` | List all SKUs |
| POST | `/master-skus` | Create SKU |
| GET | `/master-skus/{sku_id}` | Get SKU details |
| PATCH | `/master-skus/{sku_id}` | Update SKU |
| GET | `/inventory/stock` | Get stock levels |
| POST | `/inventory/transfer` | Transfer stock between firms |
| GET | `/inventory/transfers` | List stock transfers |
| GET | `/inventory/ledger` | Get inventory ledger |
| POST | `/inventory/adjustment` | Adjust stock |
| GET | `/raw-materials` | List raw materials |
| POST | `/raw-materials` | Create raw material |
| GET | `/production-requests` | List production requests |
| POST | `/production-requests` | Create production request |

**Stock Transfer Request (ATOMIC):**
```json
{
  "from_firm_id": "source_firm_uuid",
  "to_firm_id": "dest_firm_uuid",
  "item_type": "finished_good",
  "item_id": "sku_uuid",
  "quantity": 10,
  "invoice_number": "TRF-001",
  "notes": "Inter-firm transfer"
}
```

---

### 🏪 Dealer Portal APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dealers` | List dealers |
| POST | `/admin/dealers/create` | Create dealer |
| GET | `/dealer/orders` | List dealer orders |
| POST | `/dealer/orders` | Create dealer order |
| POST | `/dealer/orders/{order_id}/upload-payment-proof` | Upload payment |
| GET | `/admin/dealer-orders` | Admin: list all dealer orders |
| POST | `/admin/dealer-orders/{order_id}/approve` | Approve order |
| POST | `/admin/dealer-orders/{order_id}/reject` | Reject order |
| POST | `/admin/dealer-orders/{order_id}/verify-payment` | Verify payment |
| GET | `/admin/dealer-orders/overdue-verifications` | Overdue payments |

**Create Dealer Order Request:**
```json
{
  "items": [
    {
      "master_sku_id": "sku_uuid",
      "quantity": 5
    }
  ],
  "shipping_address": "123 Dealer Street",
  "city": "Delhi",
  "state": "Delhi",
  "pincode": "110001",
  "notes": "Urgent order"
}
```

---

### 🛡️ Warranty APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/warranties` | List warranties |
| POST | `/warranties` | Register warranty |
| GET | `/warranties/{warranty_id}` | Get warranty details |
| PATCH | `/warranties/{warranty_id}/approve` | Approve warranty |
| PATCH | `/warranties/{warranty_id}/reject` | Reject warranty |
| POST | `/warranties/{warranty_id}/request-extension` | Request extension |
| GET | `/admin/warranty-extensions` | List extension requests |

**Register Warranty Request:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "9876543210",
  "email": "john@example.com",
  "device_type": "inverter",
  "product_name": "PowerMax 3000",
  "serial_number": "INV123456",
  "invoice_date": "2025-01-15",
  "invoice_amount": 25000
}
```

---

### 👥 Party (Customer/Supplier) APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/parties` | List parties |
| POST | `/parties` | Create party |
| GET | `/parties/{party_id}` | Get party details |
| PATCH | `/parties/{party_id}` | Update party |
| GET | `/party-ledger/{party_id}` | Get party ledger |
| GET | `/party-ledger/{party_id}/balance` | Get party balance |

**Create Party Request:**
```json
{
  "name": "ABC Electronics",
  "party_type": "customer",
  "gstin": "27AABCU9603R1ZM",
  "pan": "AABCU9603R",
  "phone": "9876543210",
  "email": "abc@example.com",
  "address": "123 Business Park",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "opening_balance": 0
}
```

---

### 🏢 Firm Management APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/firms` | List all firms |
| POST | `/firms` | Create firm |
| GET | `/firms/{firm_id}` | Get firm details |
| PATCH | `/firms/{firm_id}` | Update firm |
| DELETE | `/firms/{firm_id}` | Deactivate firm |

---

### 📱 WhatsApp Integration APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/whatsapp/status` | Get WhatsApp connection status |
| POST | `/whatsapp/send` | Send WhatsApp message |
| GET | `/whatsapp/conversations` | List conversations |
| POST | `/whatsapp/ai-agent/process` | Process message with AI |
| POST | `/whatsapp/logout` | Disconnect WhatsApp |

**Send Message Request:**
```json
{
  "phone": "919876543210",
  "message": "Your order has been shipped!"
}
```

---

### 🤖 Browser Agent APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/browser-agent/status` | Agent status |
| POST | `/browser-agent/start` | Start automation session |
| POST | `/browser-agent/stop` | Stop session |
| GET | `/browser-agent/orders` | Get scraped orders |
| POST | `/browser-agent/import-order` | Import order to CRM |
| POST | `/browser-agent/create-shipment` | Create shipment |

---

### 📈 E-commerce Reconciliation APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ecommerce/upload-mtr` | Upload Amazon/Flipkart MTR |
| POST | `/ecommerce/upload-payout` | Upload payout statement |
| GET | `/ecommerce/mtr-reports` | List uploaded reports |
| GET | `/ecommerce/consolidated-gst` | Download consolidated GST |

**Upload MTR Request:**
```bash
curl -X POST "$BASE_URL/api/ecommerce/upload-mtr" \
  -H "Authorization: Bearer $TOKEN" \
  -F "platform=amazon" \
  -F "firm_id=firm_uuid" \
  -F "file=@mtr_report.xlsx"
```

---

### 🔔 Notification APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | Get user notifications |
| PATCH | `/notifications/{id}/read` | Mark as read |
| POST | `/notifications/mark-all-read` | Mark all read |

---

### ⚙️ Admin APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats` | Dashboard statistics |
| GET | `/admin/users` | List users |
| POST | `/admin/users` | Create user |
| PATCH | `/admin/users/{user_id}` | Update user |
| DELETE | `/admin/users/{user_id}` | Delete user |
| GET | `/admin/agent-performance` | Agent performance metrics |
| GET | `/admin/activity-logs` | Activity logs |

---

## Scheduled Jobs (Automatic)

The system runs these jobs automatically:

| Job | Frequency | Description |
|-----|-----------|-------------|
| SLA Breach Check | Every 30 min | Auto-escalates breached tickets |
| Payment Verification Reminder | Every 1 hour | Alerts for overdue dealer payments |

---

## Common Workflows for AI Agents

### 1. Process New Customer Order
```python
# Step 1: Create party if new
party = POST /parties {...}

# Step 2: Create quotation
quotation = POST /quotations {...}

# Step 3: Convert to pending fulfillment
pf = POST /quotations/{id}/convert-to-pending-fulfillment

# Step 4: Create dispatch when ready
dispatch = POST /dispatches {...}

# Step 5: Generate invoice
invoice = POST /sales-invoices {...}
```

### 2. Handle Support Ticket
```python
# Step 1: Create ticket
ticket = POST /tickets {...}

# Step 2: Assign to agent
PATCH /tickets/{id} {"assigned_to": "agent_id"}

# Step 3: Route to hardware if needed
POST /tickets/{id}/route-to-hardware

# Step 4: Complete repair
POST /tickets/{id}/complete-repair

# Step 5: Create return dispatch
POST /dispatches {...}

# Step 6: Close ticket
POST /admin/tickets/{id}/close
```

### 3. Monthly GST Reconciliation
```python
# Step 1: Get GST summary
gst = GET /finance/analytics/gst-summary?period=last_month

# Step 2: Upload MTR reports
POST /ecommerce/upload-mtr (Amazon)
POST /ecommerce/upload-mtr (Flipkart)

# Step 3: Download consolidated report
GET /ecommerce/consolidated-gst
```

### 4. Daily Health Check
```python
# Check SLA breaches
breaches = GET /admin/sla/breached-tickets
if breaches.count > 0:
    POST /admin/sla/check-breaches  # Trigger escalation

# Check overdue payments
overdue = GET /admin/dealer-orders/overdue-verifications

# Get dashboard stats
stats = GET /admin/stats
```

---

## Error Handling

All errors return:
```json
{
  "detail": "Error message here"
}
```

**Common Error Codes:**
- `400`: Validation error - check request body
- `401`: Token expired - re-authenticate
- `403`: Permission denied - check user role
- `404`: Resource not found
- `409`: Duplicate resource (e.g., invoice number)
- `500`: Server error - retry with backoff

---

## Role-Based Access

| Role | Access Level |
|------|--------------|
| `admin` | Full access to all APIs |
| `accountant` | Finance + limited inventory (firm-scoped) |
| `dispatcher` | Dispatch queue + gate operations |
| `gate` | Gate scanning only |
| `supervisor` | Ticket oversight + escalations |
| `service_agent` | Ticket handling |
| `call_support` | Ticket creation only |
| `dealer` | Dealer portal only |

---

## Rate Limiting

- Standard endpoints: 100 req/min
- Report generation: 10 req/min
- File uploads: 20 req/min

---

## Webhook Events (Future)

Coming soon - webhook notifications for:
- New ticket created
- Order dispatched
- Payment received
- SLA breach detected

---

## Support

For API issues, check:
1. Swagger docs at `/api/docs`
2. OpenAPI spec at `/api/openapi.json`
3. Server logs for detailed errors

---

*Last Updated: April 2025*

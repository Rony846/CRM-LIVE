# MuscleGrid CRM - Database & API Documentation
## For New App Developers

**Application URL**: https://newcrm.musclegrid.in  
**Database**: MongoDB  
**Backend**: FastAPI (Python)  
**Authentication**: JWT Bearer Token  

---

## 1. DATABASE CONNECTION

### MongoDB Connection
```
Database Name: crm-rebuild-11-test_database (Production)
Connection: Use MONGO_URL environment variable
```

**Note**: For production access, you'll need the MongoDB connection string from the server administrator.

---

## 2. AUTHENTICATION

### Login Endpoint
```
POST /api/auth/login
Content-Type: application/json

Request:
{
  "email": "user@musclegrid.in",
  "password": "your_password"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1...",
  "user": { "id": "...", "role": "admin", ... }
}
```

### Using the Token
```
Authorization: Bearer <access_token>
```

### User Roles
- `admin` - Full access
- `accountant` - Financial operations
- `supervisor` - Team management
- `call_support` - Customer service
- `service_agent` - Field service
- `technician` - Repairs
- `gate` - Gate scanning
- `dispatcher` - Logistics
- `dealer` - Dealer portal

---

## 3. DATABASE COLLECTIONS (53 Collections)

### Core Business Collections

| Collection | Description | Key Fields |
|------------|-------------|------------|
| `users` | All system users (employees, dealers) | id, email, role, first_name, last_name, phone |
| `customers` | Customer records | id, name, phone, email, address, city, state |
| `tickets` | Service tickets | id, ticket_number, customer_id, status, device_type, issue_type |
| `warranties` | Warranty registrations | id, warranty_number, customer_id, product_type, serial_number |
| `dispatches` | Shipment records | id, dispatch_number, tracking_id, courier, status |

### Dealer Management

| Collection | Description | Key Fields |
|------------|-------------|------------|
| `dealers` | Dealer profiles (linked to users) | id, user_id, dealer_code, firm_name, gstin |
| `dealer_orders` | Orders placed by dealers | id, order_number, dealer_id, items, total_amount |
| `dealer_products` | Products available to dealers | id, sku, name, dealer_price, mrp |
| `dealer_tickets` | Dealer support tickets | id, ticket_number, dealer_id, issue_type |
| `dealer_applications` | New dealer applications | id, firm_name, status, documents |
| `dealer_promo_requests` | Promotional material requests | id, dealer_id, items, status |

### Inventory & Production

| Collection | Description | Key Fields |
|------------|-------------|------------|
| `master_skus` | Product master data | id, sku, name, category, hsn_code |
| `skus` | Stock keeping units (per firm) | id, sku, firm_id, quantity, warehouse |
| `finished_good_serials` | Serial numbers for products | id, serial_number, sku, firm_id, status |
| `raw_materials` | Raw material inventory | id, material_code, name, quantity, unit |
| `productions` | Production orders | id, production_number, sku, quantity, status |
| `production_requests` | Production requests | id, request_number, items, status |
| `inventory_ledger` | Inventory movement history | id, entry_number, type, sku, quantity |
| `stock_transfers` | Inter-warehouse transfers | id, transfer_number, from_firm, to_firm |
| `stock_logs` | Stock change logs | id, sku, change_type, quantity, timestamp |

### Financial Collections

| Collection | Description | Key Fields |
|------------|-------------|------------|
| `purchases` | Purchase orders | id, supplier_id, items, total_amount, status |
| `purchase_entries` | Individual purchase line items | id, purchase_id, sku, quantity, rate |
| `sales_invoices` | Sales invoices | id, invoice_number, customer_id, items, total |
| `quotations` | Price quotations | id, quotation_number, customer_id, items |
| `quotation_requests` | Quotation requests | id, customer_name, items, status |
| `quotation_events` | Quotation activity log | id, quotation_id, event_type, timestamp |
| `payments` | Payment records | id, payment_number, amount, mode, reference |
| `credit_notes` | Credit notes issued | id, credit_note_number, customer_id, amount |
| `parties` | Suppliers & customers (accounting) | id, name, type, gstin, balance |
| `party_ledger` | Party transaction history | id, party_id, debit, credit, balance |
| `expense_ledger` | Expense tracking | id, category, amount, description, month |
| `gst_itc_balances` | GST Input Tax Credit | id, firm_id, month, igst, cgst, sgst |
| `financial_audit_logs` | Financial change logs | id, action, collection, document_id |

### HR & Payroll

| Collection | Description | Key Fields |
|------------|-------------|------------|
| `employee_salaries` | Salary configurations | id, user_id, firm_id, fixed_salary |
| `payroll` | Monthly payroll records | id, user_id, month, year, total_payable |
| `attendance` | Employee attendance | id, user_id, date, check_in, check_out |
| `incentives` | Employee incentives | id, agent_id, amount, reason, status |
| `incentive_configs` | Incentive rules | id, conversion_type, percentage, min_order |

### Operations & Logistics

| Collection | Description | Key Fields |
|------------|-------------|------------|
| `gate_logs` | Gate entry/exit scans | id, scan_type, tracking_id, status |
| `gate_media` | Gate scan photos/videos | id, gate_log_id, media_type, relative_path |
| `incoming_queue` | Incoming packages queue | id, queue_number, tracking_id, status |
| `pending_fulfillment` | Orders awaiting fulfillment | id, order_id, items, status |
| `appointments` | Service appointments | id, customer_id, date, time_slot |
| `supervisor_availability` | Supervisor schedules | id, user_id, date, available |
| `supervisor_payables` | Supervisor payment tracking | id, supervisor_id, amount, status |

### Communication & Feedback

| Collection | Description | Key Fields |
|------------|-------------|------------|
| `notifications` | System notifications | id, user_id, title, message, read |
| `feedback` | Customer feedback | id, ticket_id, rating, comments |
| `feedback_calls` | Feedback call records | id, ticket_id, outcome, notes |

### Compliance & Audit

| Collection | Description | Key Fields |
|------------|-------------|------------|
| `audit_logs` | System audit trail | id, user_id, action, entity, timestamp |
| `compliance_exceptions` | Compliance exceptions | id, transaction_id, exception_type |

### Configuration

| Collection | Description | Key Fields |
|------------|-------------|------------|
| `firms` | Company/branch entities | id, name, address, gstin, state_code |

---

## 4. KEY API ENDPOINTS

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/register` | Register new user |
| GET | `/api/auth/me` | Get current user |

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List customers |
| POST | `/api/customers` | Create customer |
| GET | `/api/customers/{id}` | Get customer details |
| PUT | `/api/customers/{id}` | Update customer |

### Tickets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | List tickets (with filters) |
| POST | `/api/tickets` | Create ticket |
| GET | `/api/tickets/{id}` | Get ticket details |
| PUT | `/api/tickets/{id}` | Update ticket |
| POST | `/api/tickets/{id}/assign` | Assign to technician |
| POST | `/api/tickets/{id}/close` | Close ticket |

### Dispatches
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dispatches` | List dispatches |
| POST | `/api/dispatches` | Create dispatch |
| PUT | `/api/dispatches/{id}/status` | Update status |

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/master-skus` | List all SKUs |
| GET | `/api/inventory` | Get inventory levels |
| POST | `/api/inventory/adjust` | Adjust stock |

### Dealers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dealer/products` | Dealer product catalog |
| POST | `/api/dealer/orders` | Place dealer order |
| GET | `/api/dealer/orders` | List dealer orders |

### Financial
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchases` | List purchases |
| POST | `/api/purchases` | Create purchase |
| GET | `/api/sales-invoices` | List sales invoices |
| POST | `/api/sales-invoices` | Create invoice |
| GET | `/api/quotations` | List quotations |
| POST | `/api/quotations` | Create quotation |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/reports` | Generate reports |

### Gate Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/gate/scan` | Record gate scan |
| POST | `/api/gate/media/upload` | Upload scan media |
| POST | `/api/gate/{id}/complete` | Complete scan |

### Payroll
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/payroll` | Get payroll data |
| POST | `/api/admin/payroll/generate` | Generate payroll |
| GET | `/api/admin/payroll/{id}/payslip` | Download payslip |

---

## 5. FILE STORAGE

### NAS File API
```
Base URL: https://files.musclegrid.in
Authentication: x-api-key header

Endpoints:
- POST /mkdir/<folder-path>     - Create folder
- POST /upload/<folder-path>    - Upload file
- GET /files/<folder-path>      - List files
- GET /download/<file-path>     - Download file
- DELETE /file/<file-path>      - Delete file

Folder Structure:
- Returns/                      - Inward package media
- Dispatches/                   - Outward package media
- tickets/                      - Ticket attachments
- invoices/                     - Invoice files
- payments/                     - Payment proofs
- certificates/                 - Certificates
```

---

## 6. DATA STATISTICS (Current)

| Data Type | Count |
|-----------|-------|
| Total Tickets | 1,330 |
| Open Tickets | 23 |
| Hardware Tickets | 512 |
| Phone Tickets | 817 |
| Total Customers | 268 |
| Pending Warranties | 9 |
| Closed Tickets | 1,307 |

---

## 7. COMMON FIELD PATTERNS

### ID Fields
All documents use UUID format:
```
"id": "ba01d052-4a66-4e13-a6fb-32e644970e2d"
```

### Timestamps
ISO 8601 format with timezone:
```
"created_at": "2026-04-02T13:58:36.406463+00:00"
"updated_at": "2026-04-02T15:30:00.000000+00:00"
```

### Status Fields
Common status patterns:
- Tickets: `new_request`, `in_repair`, `ready_for_dispatch`, `dispatched`, `closed`
- Orders: `pending`, `confirmed`, `processing`, `shipped`, `delivered`
- Purchases: `draft`, `pending`, `approved`, `final`

### Amount Fields
All monetary values stored as floats:
```
"total_amount": 478726.12
"total_gst": 73026.02
```

---

## 8. GETTING STARTED

### For Frontend Developer:

1. **Base API URL**: `https://newcrm.musclegrid.in/api`

2. **Authentication Flow**:
   ```javascript
   // Login
   const response = await fetch('/api/auth/login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ email, password })
   });
   const { access_token } = await response.json();
   
   // Use token for subsequent requests
   const data = await fetch('/api/tickets', {
     headers: { 'Authorization': `Bearer ${access_token}` }
   });
   ```

3. **Environment Variables Needed**:
   ```
   API_URL=https://newcrm.musclegrid.in/api
   ```

### For Backend Developer:

1. **MongoDB Connection**:
   ```
   MONGO_URL=<provided by administrator>
   DB_NAME=crm-rebuild-11-test_database
   ```

2. **File API**:
   ```
   FILE_API_URL=https://files.musclegrid.in
   FILE_API_KEY=<provided by administrator>
   ```

---

## 9. CONTACT

For database access credentials and API keys, contact:
- **Email**: service@musclegrid.in
- **Phone**: +91 98000 06416

---

*Documentation generated: April 2, 2026*
*CRM Version: Enterprise Edition*

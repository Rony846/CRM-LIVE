# MuscleGrid CRM - Claude AI Agent Integration API

## Overview

This document describes the API endpoints available for Claude AI browsing agents to automate Amazon order processing and shipping workflows in MuscleGrid CRM.

**Base URL**: `https://newcrm.musclegrid.in` (Production)  
**Preview URL**: `https://crm-rebuild-11.preview.emergentagent.com` (Staging)

---

## Authentication

All API endpoints require Bearer token authentication.

### Getting a Token

```bash
curl -X POST "https://newcrm.musclegrid.in/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "your_email@domain.com", "password": "your_password"}'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "email": "...",
    "role": "admin"
  }
}
```

### Using the Token

Include the token in the `Authorization` header for all subsequent requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## API Endpoints

### 1. GET /api/products/skus

**Purpose**: Get all SKUs with dimensions for shipping calculations.

**Use Case**: Claude agent reads package dimensions automatically before creating a shipment.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| category | string | No | Filter by product category (e.g., "Inverter", "Battery") |
| has_dimensions | boolean | No | Only return SKUs that have dimensions populated |

**Request:**
```bash
curl -X GET "https://newcrm.musclegrid.in/api/products/skus" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
[
  {
    "sku_code": "INV-5KVA",
    "product_name": "Solar Inverter 5KVA",
    "weight_kg": 15.5,
    "length_cm": 40.0,
    "width_cm": 30.0,
    "height_cm": 20.0,
    "hsn_code": "85044090",
    "category": "Inverter",
    "gst_rate": 18.0
  },
  ...
]
```

---

### 2. GET /api/products/skus/{sku_code}

**Purpose**: Get a specific SKU by its code.

**Use Case**: Claude agent looks up dimensions for a specific product from an Amazon order.

**Request:**
```bash
curl -X GET "https://newcrm.musclegrid.in/api/products/skus/INV-5KVA" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "sku": {
    "sku_code": "INV-5KVA",
    "product_name": "Solar Inverter 5KVA",
    "category": "Inverter",
    "weight_kg": 15.5,
    "length_cm": 40.0,
    "width_cm": 30.0,
    "height_cm": 20.0,
    "hsn_code": "85044090",
    "gst_rate": 18.0,
    "cost_price": 12000.0,
    "selling_price": 18000.0,
    "aliases": [
      {"alias_code": "AMZ-INV-5K", "platform": "Amazon"},
      {"alias_code": "FK-INV5000", "platform": "Flipkart"}
    ]
  }
}
```

---

### 3. POST /api/courier/shipments/create

**Purpose**: Create a shipment via Bigship API programmatically.

**Use Case**: Claude agent creates shipments without browser form-filling.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| auto_manifest | boolean | true | Automatically manifest and get AWB after creation |
| preferred_courier_id | integer | null | Specific courier ID (uses cheapest if not specified) |

**Request Body:**
```json
{
  "shipment_type": "b2c",
  "warehouse_id": 12345,
  
  "first_name": "Rahul",
  "last_name": "Sharma",
  "company_name": "",
  "phone": "9876543210",
  "alt_phone": "",
  "email": "rahul@example.com",
  
  "address_line1": "123 MG Road, Near Metro Station",
  "address_line2": "Sector 15",
  "city": "Gurgaon",
  "state": "Haryana",
  "pincode": "122001",
  "landmark": "Opposite City Mall",
  
  "product_name": "Solar Inverter 5KVA",
  "product_category": "Others",
  "product_sub_category": "General",
  "quantity": 1,
  "hsn_code": "85044090",
  
  "weight_kg": 15.5,
  "length_cm": 40,
  "width_cm": 30,
  "height_cm": 20,
  
  "invoice_number": "407-1234567-8901234",
  "invoice_amount": 18000.00,
  "payment_type": "Prepaid",
  "cod_amount": 0,
  
  "amazon_order_id": "407-1234567-8901234",
  "ewaybill_number": "",
  "invoice_document_base64": null
}
```

**Request:**
```bash
curl -X POST "https://newcrm.musclegrid.in/api/courier/shipments/create?auto_manifest=true" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shipment_type": "b2c",
    "warehouse_id": 12345,
    "first_name": "Rahul",
    "last_name": "Sharma",
    "phone": "9876543210",
    "address_line1": "123 MG Road",
    "city": "Gurgaon",
    "state": "Haryana",
    "pincode": "122001",
    "product_name": "Solar Inverter 5KVA",
    "weight_kg": 15.5,
    "length_cm": 40,
    "width_cm": 30,
    "height_cm": 20,
    "invoice_number": "407-1234567-8901234",
    "invoice_amount": 18000,
    "payment_type": "Prepaid",
    "amazon_order_id": "407-1234567-8901234"
  }'
```

**Response (Success with auto_manifest=true):**
```json
{
  "success": true,
  "message": "Shipment created and manifested. AWB: 123456789012",
  "system_order_id": "98765",
  "shipment_id": "abc-123-def-456",
  "awb_number": "123456789012",
  "courier_name": "Delhivery",
  "label_url": "/api/courier/label/98765",
  "tracking_url": "https://bigship.in/track/123456789012"
}
```

**Response (Success without manifest):**
```json
{
  "success": true,
  "message": "Shipment created successfully",
  "system_order_id": "98765",
  "shipment_id": "abc-123-def-456",
  "awb_number": null,
  "courier_name": null,
  "label_url": null,
  "tracking_url": null
}
```

---

### 4. PUT /api/orders/{order_id}/tracking

**Purpose**: Update tracking information for an order.

**Use Case**: Claude agent updates tracking info back into CRM after shipment is booked.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| order_id | string | Amazon Order ID, Invoice Number, or internal Order ID |

**Request Body:**
```json
{
  "awb_number": "123456789012",
  "courier_name": "Delhivery",
  "tracking_url": "https://www.delhivery.com/track/package/123456789012",
  "shipped_date": "2026-04-29T10:30:00Z"
}
```

**Request:**
```bash
curl -X PUT "https://newcrm.musclegrid.in/api/orders/407-1234567-8901234/tracking" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "awb_number": "123456789012",
    "courier_name": "Delhivery"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Tracking updated for order 407-1234567-8901234",
  "awb_number": "123456789012",
  "courier_name": "Delhivery"
}
```

---

### 5. GET /api/courier/warehouses

**Purpose**: Get list of available Bigship warehouses.

**Use Case**: Claude agent gets warehouse IDs for shipment creation.

**Request:**
```bash
curl -X GET "https://newcrm.musclegrid.in/api/courier/warehouses" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "warehouses": [
    {
      "pickup_location_id": 12345,
      "contact_person": "John Doe",
      "contact_number": "9876543210",
      "address": "123 Industrial Area, Mumbai",
      "pincode": "400001",
      "city": "Mumbai",
      "state": "Maharashtra"
    }
  ]
}
```

---

### 6. GET /api/courier/shipments

**Purpose**: Get list of existing shipments.

**Request:**
```bash
curl -X GET "https://newcrm.musclegrid.in/api/courier/shipments?page=1&page_size=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Typical Workflow for Claude Agent

### Step 1: Get Authentication Token
```bash
TOKEN=$(curl -s -X POST "BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}' | jq -r '.access_token')
```

### Step 2: Get Available Warehouses
```bash
WAREHOUSE_ID=$(curl -s "BASE_URL/api/courier/warehouses" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.warehouses[0].pickup_location_id')
```

### Step 3: Lookup Product Dimensions (from Amazon order SKU)
```bash
PRODUCT_INFO=$(curl -s "BASE_URL/api/products/skus/PRODUCT_SKU" \
  -H "Authorization: Bearer $TOKEN")

WEIGHT=$(echo $PRODUCT_INFO | jq -r '.sku.weight_kg // 1')
LENGTH=$(echo $PRODUCT_INFO | jq -r '.sku.length_cm // 10')
WIDTH=$(echo $PRODUCT_INFO | jq -r '.sku.width_cm // 10')
HEIGHT=$(echo $PRODUCT_INFO | jq -r '.sku.height_cm // 10')
HSN=$(echo $PRODUCT_INFO | jq -r '.sku.hsn_code // ""')
```

### Step 4: Create Shipment
```bash
SHIPMENT_RESPONSE=$(curl -s -X POST "BASE_URL/api/courier/shipments/create?auto_manifest=true" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shipment_type": "b2c",
    "warehouse_id": '"$WAREHOUSE_ID"',
    "first_name": "Customer Name",
    "phone": "9876543210",
    "address_line1": "Customer Address",
    "city": "City",
    "state": "State",
    "pincode": "123456",
    "product_name": "Product Name",
    "weight_kg": '"$WEIGHT"',
    "length_cm": '"$LENGTH"',
    "width_cm": '"$WIDTH"',
    "height_cm": '"$HEIGHT"',
    "hsn_code": "'"$HSN"'",
    "invoice_number": "AMAZON_ORDER_ID",
    "invoice_amount": 18000,
    "payment_type": "Prepaid",
    "amazon_order_id": "AMAZON_ORDER_ID"
  }')

AWB=$(echo $SHIPMENT_RESPONSE | jq -r '.awb_number')
```

### Step 5: Update Order Tracking (if needed separately)
```bash
curl -X PUT "BASE_URL/api/orders/AMAZON_ORDER_ID/tracking" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "awb_number": "'"$AWB"'",
    "courier_name": "Delhivery"
  }'
```

---

## Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "detail": "Could not validate credentials"
}
```

**403 Forbidden:**
```json
{
  "detail": "Access denied"
}
```

**400 Bad Request:**
```json
{
  "success": false,
  "message": "E-way bill number is required for B2B shipments over ₹50,000"
}
```

**404 Not Found:**
```json
{
  "detail": "SKU 'INVALID_SKU' not found"
}
```

---

## Field Constraints

### Shipment Creation Constraints (Bigship API)

| Field | Constraint |
|-------|------------|
| first_name | Minimum 3 characters |
| last_name | Minimum 3 characters (if provided) |
| phone | Exactly 10 digits |
| address_line1 | 10-50 characters |
| address_line2 | Max 100 characters |
| pincode | Exactly 6 digits |
| invoice_number | Max 25 characters |
| product_name | Only alphanumeric, spaces, `-`, `/` allowed |
| weight_kg | Minimum 0.1 kg |

### B2B Shipments
- E-way bill number required for shipments over ₹50,000
- E-way bill document (PDF) required if e-way bill number is provided

---

## OpenAPI Documentation

Interactive API documentation is available at:
- **Swagger UI**: `https://newcrm.musclegrid.in/docs`
- **ReDoc**: `https://newcrm.musclegrid.in/redoc`
- **OpenAPI JSON**: `https://newcrm.musclegrid.in/openapi.json`

---

## Rate Limits

| Endpoint | Rate Limit |
|----------|------------|
| /api/products/skus | 100 requests/minute |
| /api/courier/shipments/create | 10 requests/minute |
| /api/orders/{id}/tracking | 50 requests/minute |

---

## Contact

For API support or issues, contact the MuscleGrid CRM development team.

---

*Document Version: 1.0*  
*Last Updated: April 29, 2026*

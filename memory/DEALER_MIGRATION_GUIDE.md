# MuscleGrid Dealer Portal Migration Guide

## Overview

This document outlines the migration strategy for moving data from the existing `partners.musclegrid.in` (MySQL/Hostinger) system to the new CRM-integrated Dealer Portal (MongoDB).

**Target URL:** `newcrm.musclegrid.in/partners` (DNS redirect from `partners.musclegrid.in`)

## Migration Status: **PREVIEW COMPLETE - READY FOR LIVE**

- [x] Dealer Portal module built and tested
- [x] Data models created
- [x] APIs implemented
- [x] Migration mapping reviewed by stakeholder
- [x] **Dealer → Party mapping rules defined** ✅ (Type: "dealer", avoid duplicates)
- [x] **Order → CRM flow integration defined** ✅ (Historical only, no impact)
- [x] **Payment → Ledger mapping defined** ✅ (Historical only, no auto-ledger)
- [x] Migration script tested on Preview environment
- [x] Preview migration executed successfully
- [ ] Staging environment prepared (for LIVE)
- [ ] Dry-run on staging
- [ ] Production migration executed

### Preview Migration Results (March 27, 2026)
```
Products created:         11
Users created:            52 (5 duplicates linked to existing)
Dealers created:          56
Parties created:          56 (type: "dealer")
Applications migrated:    60
Orders (historical):      24
```

---

## ⚠️ DECISIONS MADE (Stakeholder Approved)

### 1. Dealer → Party Mapping Rules ✅ RESOLVED
- **Decision:** Create dealers as Party type `"dealer"`
- **Duplicate Handling:**
  - GSTIN match → Skip and log for manual review
  - Email/Phone match → Create separate but flag for review
- **Reporting:** Maintained separate from customers

### 2. Order → CRM Flow Integration ✅ RESOLVED
- **Decision:** Treat all migrated dealer orders as **HISTORICAL ONLY**
- **Flags set:**
  - `is_historical: true`
  - `inventory_impacted: false`
  - `accounting_impacted: false`
- **Impact:** No stock deduction, no dispatch creation, no sales entries
- **Purpose:** Reference and dealer view only

### 3. Payment → Ledger Mapping ✅ RESOLVED
- **Decision:** Do NOT auto-create ledger entries
- **Storage:** Historical records only
- **New Payments:** Will follow normal accounting flow

### 4. Dealer Wallet ✅ DEFERRED
- **Decision:** Implement later after accounting stabilizes

---

## 1. Data Mapping

### 1.1 Users → users (MongoDB)

| Old MySQL Field | New MongoDB Field | Notes |
|-----------------|-------------------|-------|
| id | legacy_user_id | Preserve for reference |
| email | email | Direct mapping |
| password_hash | password_hash | PHP bcrypt ($2y$) compatible |
| first_name | first_name | Direct mapping |
| last_name | last_name | Direct mapping |
| phone | phone | Direct mapping |
| role | role | Map: 'dealer' → 'dealer', 'admin' → skip |
| is_active | is_active | Direct mapping |
| created_at | created_at | Convert to ISO8601 |

### 1.2 Dealers → dealers (MongoDB)

| Old MySQL Field | New MongoDB Field | Notes |
|-----------------|-------------------|-------|
| id | legacy_dealer_id | Preserve for reference |
| user_id | user_id | Map to new user ID |
| firm_name | firm_name | Direct mapping |
| contact_person | contact_person | Direct mapping |
| phone | phone | Direct mapping |
| email | email | Direct mapping |
| gst_number | gst_number | Direct mapping |
| address | address_line1 | Direct mapping |
| city | city | Direct mapping |
| district | district | Direct mapping |
| state | state | Direct mapping |
| pincode | pincode | Direct mapping |
| status | status | Map: 'approved'→'approved', etc. |
| security_deposit_amount | security_deposit_amount | Direct mapping |
| security_deposit_status | security_deposit_status | Map to new statuses |
| security_deposit_proof_path | security_deposit_proof_path | Mark as pending if file missing |
| created_at | created_at | Convert to ISO8601 |
| approved_at | security_deposit_approved_at | Convert to ISO8601 |

### 1.3 Dealer Applications → dealer_applications (MongoDB)

| Old MySQL Field | New MongoDB Field | Notes |
|-----------------|-------------------|-------|
| id | legacy_id | Preserve for reference |
| firm_name | firm_name | Direct mapping |
| contact_person | contact_person | Direct mapping |
| email | email | Direct mapping |
| mobile | mobile | Direct mapping |
| address_line1 | address_line1 | Direct mapping |
| address_line2 | address_line2 | Direct mapping |
| city | city | Direct mapping |
| district | district | Direct mapping |
| state | state | Direct mapping |
| pincode | pincode | Direct mapping |
| gstin | gstin | Direct mapping |
| business_type | business_type | Direct mapping |
| expected_monthly_volume | expected_monthly_volume | Direct mapping |
| primary_interest | primary_interest | Direct mapping |
| status | status | Map to new statuses |
| admin_notes | admin_notes | Direct mapping |
| created_at | created_at | Convert to ISO8601 |
| approved_at | approved_at | Convert to ISO8601 |

### 1.4 Orders → dealer_orders (MongoDB)

| Old MySQL Field | New MongoDB Field | Notes |
|-----------------|-------------------|-------|
| id | legacy_order_id | Preserve for reference |
| order_number | order_number | Direct mapping |
| dealer_id | dealer_id | Map to new dealer ID |
| total_amount | total_amount | Direct mapping |
| status | status | Map to new statuses |
| payment_status | payment_status | Direct mapping |
| payment_proof_path | payment_proof_path | Mark pending if missing |
| payment_received_at | payment_received_at | Convert to ISO8601 |
| dispatch_date | dispatch_date | Direct mapping |
| dispatch_courier | dispatch_courier | Direct mapping |
| dispatch_awb | dispatch_awb | Direct mapping |
| created_at | created_at | Convert to ISO8601 |
| **NEW** | source | Set to `"legacy_migration"` |
| **NEW** | is_historical | Set to `true` |

### 1.5 Order Items → Embedded in dealer_orders.items

| Old MySQL Field | New MongoDB Field | Notes |
|-----------------|-------------------|-------|
| id | (not needed) | Embedded document |
| product_id | product_id | Map to new product ID |
| product_name | product_name | Direct mapping |
| quantity | quantity | Direct mapping |
| unit_price | unit_price | Direct mapping |
| gst_rate | gst_rate | Direct mapping |
| line_total | line_total | Direct mapping |

### 1.6 Products → dealer_products (MongoDB)

| Old MySQL Field | New MongoDB Field | Notes |
|-----------------|-------------------|-------|
| id | legacy_product_id | Preserve for reference |
| name | name | Direct mapping |
| sku | sku | Direct mapping |
| category | category | Direct mapping |
| mrp | mrp | Direct mapping |
| dealer_price | dealer_price | Direct mapping |
| gst_rate | gst_rate | Direct mapping |
| warranty_months | warranty_months | Direct mapping |
| is_active | is_active | Direct mapping |

### 1.7 Tickets → dealer_tickets (MongoDB)

| Old MySQL Field | New MongoDB Field | Notes |
|-----------------|-------------------|-------|
| id | legacy_ticket_id | Preserve for reference |
| ticket_number | ticket_number | Generate if missing |
| dealer_id | dealer_id | Map to new dealer ID |
| product_id | product_id | Map to new product ID |
| issue_description | issue_description | Direct mapping |
| status | status | Map to new statuses |
| created_at | created_at | Convert to ISO8601 |

### 1.8 Promo Requests → dealer_promo_requests (MongoDB)

| Old MySQL Field | New MongoDB Field | Notes |
|-----------------|-------------------|-------|
| id | legacy_id | Preserve for reference |
| dealer_id | dealer_id | Map to new dealer ID |
| request_type | request_type | Direct mapping |
| subject | subject | Direct mapping |
| details | details | Direct mapping |
| status | status | Map to new statuses |
| created_at | created_at | Convert to ISO8601 |

---

## 2. Migration Strategy

### Phase 1: Preparation
1. Export MySQL data to JSON format
2. Validate data integrity
3. Create ID mapping tables
4. Prepare file migration list
5. **Define Dealer → Party mapping rules**
6. **Define Order → CRM flow rules**
7. **Define Payment → Ledger rules**

### Phase 2: Dry Run (Staging)
1. **Set up staging MongoDB database** (copy of production)
2. Run migration on staging database
3. Verify record counts
4. **Generate duplicate pre-check report**
5. Test dealer login with migrated credentials
6. Verify orders and transactions
7. **Generate comprehensive dry-run report**

### Phase 3: Live Migration
1. Put old portal in read-only mode
2. Export final data
3. **Create pre-migration backup**
4. Run migration script
5. Verify critical paths
6. Switch DNS to new portal

---

## 3. Password Handling

### Compatibility
- Old system: PHP `password_hash()` with bcrypt ($2y$ prefix)
- New system: Python `bcrypt` library

PHP's `$2y$` prefix is compatible with Python's bcrypt. The migration will:
1. Copy password hashes as-is
2. Users can login with existing passwords
3. Optionally set `force_password_change: true` for security

### Testing
```python
import bcrypt
# PHP hash: $2y$10$...
# Python verification: bcrypt.checkpw(password.encode(), hash.encode())
```

---

## 4. File Migration

### Files to Migrate
- `/uploads/security_deposits/` → `/uploads/dealer_deposits/`
- `/uploads/payment_proofs/` → `/uploads/dealer_payments/`
- `/uploads/ticket_attachments/` → `/uploads/dealer_tickets/`

### Missing File Handling
- Records with missing files will have `document_pending_migration: true`
- Files can be added later without blocking functionality

---

## 5. Duplicate Handling (ENHANCED)

### Pre-Migration Duplicate Check

**BEFORE migration runs**, generate a report showing:

```
=== DUPLICATE PRE-CHECK REPORT ===

📧 DUPLICATE EMAILS:
  - dealer1@example.com (Legacy ID: 12) → EXISTS in CRM users
  - dealer2@example.com (Legacy ID: 15) → EXISTS in CRM users

📱 DUPLICATE PHONES:
  - 9876543210 (Legacy ID: 8) → EXISTS in CRM (customer: John Doe)
  - 9123456789 (Legacy ID: 22) → EXISTS in CRM (party: ABC Trading)

🏢 DUPLICATE GSTIN:
  - 29ABCDE1234F1Z5 (Legacy ID: 5) → EXISTS in parties
  - 27XYZAB5678G2H6 (Legacy ID: 11) → EXISTS in parties

ACTION REQUIRED: Review above duplicates before proceeding.
```

### Duplicate Resolution Options

| Duplicate Type | Action | Result |
|----------------|--------|--------|
| Email exists | **SKIP** | Log to `migration_skipped.json` |
| Phone exists | **CREATE** | Flag for manual review |
| GSTIN exists | **SKIP** | Log for party linkage review |

### Post-Migration Review
- All skipped records saved to `/app/backend/migrations/skipped_records.json`
- Manual review required before re-attempting

---

## 6. Data Integrity Validation (NEW)

### Pre-Migration Checks

Run these validations on source data:

```python
# 1. Order total = sum(order_items)
for order in orders:
    calculated_total = sum(item.line_total for item in order.items)
    if abs(order.total_amount - calculated_total) > 0.01:
        log_error(f"Order {order.id}: Total mismatch")

# 2. GST consistency
for item in order_items:
    if item.gst_rate not in [0, 5, 12, 18, 28]:
        log_warning(f"Order item {item.id}: Invalid GST rate {item.gst_rate}")

# 3. Payment vs Order amount
for payment in payments:
    order = get_order(payment.order_id)
    if payment.amount > order.total_amount:
        log_warning(f"Payment {payment.id}: Exceeds order total")

# 4. Required fields
for dealer in dealers:
    if not dealer.phone or not dealer.email:
        log_error(f"Dealer {dealer.id}: Missing required field")
```

### Validation Report

```
=== DATA INTEGRITY REPORT ===

✅ Orders with correct totals: 48/52
❌ Orders with mismatched totals: 4 (see details)

✅ Valid GST rates: 70/71 items
⚠️ Invalid GST rates: 1 item (Order #45, Item: "Custom Battery")

✅ Payments within order amounts: 12/13
⚠️ Overpayments: 1 (Payment #8: ₹12,500 on ₹12,000 order)

✅ Dealers with complete data: 55/57
❌ Missing required fields: 2 dealers
```

---

## 7. Staging Environment (NEW)

### Setup Requirements

| Component | Staging | Production |
|-----------|---------|------------|
| MongoDB | `musclegrid_crm_staging` | `musclegrid_crm` |
| Backend | Same codebase, different DB | Same |
| Files | Copy subset for testing | Full |

### Staging Test Checklist

- [ ] Create staging database from production backup
- [ ] Point migration script to staging DB
- [ ] Run full migration
- [ ] Test 3 dealer logins
- [ ] Verify order history loads
- [ ] Check security deposit status
- [ ] Validate file links
- [ ] Check party ledger (if applicable)

### Staging Access

```bash
# Switch to staging (add to .env.staging)
MONGO_URL=mongodb://localhost:27017
DB_NAME=musclegrid_crm_staging
```

---

## 8. Rollback Plan

### If Migration Fails
1. Restore MongoDB from backup (pre-migration snapshot)
2. Keep old portal operational
3. Investigate failure cause
4. Retry migration after fixes

### Backup Commands
```bash
# Pre-migration backup
mongodump --db musclegrid_crm --out /backup/pre_dealer_migration_$(date +%Y%m%d)

# Restore if needed
mongorestore --db musclegrid_crm --drop /backup/pre_dealer_migration_YYYYMMDD
```

---

## 9. Migration Script

### Location
`/app/backend/migrations/dealer_portal_migration.py`

### Usage
```bash
# Step 1: Validate source data
python dealer_portal_migration.py --validate --source mysql_dump.sql

# Step 2: Check for duplicates
python dealer_portal_migration.py --check-duplicates --source mysql_dump.sql

# Step 3: Dry run (no changes, generates report)
python dealer_portal_migration.py --dry-run --source mysql_dump.sql

# Step 4: Actual migration (on staging first!)
python dealer_portal_migration.py --execute --source mysql_dump.sql --db musclegrid_crm_staging

# Step 5: Production migration (after staging approval)
python dealer_portal_migration.py --execute --source mysql_dump.sql --db musclegrid_crm
```

### Output Files
- `migration_report_YYYYMMDD.json` - Full migration report
- `skipped_records.json` - Records skipped due to duplicates
- `validation_errors.json` - Data integrity issues
- `id_mapping.json` - Legacy ID → New ID mapping

---

## 10. Post-Migration Checklist

### Critical Path Verification
- [ ] All dealer users can login
- [ ] Dealer dashboards load correctly
- [ ] Order history is visible and accurate
- [ ] Payment proofs are accessible
- [ ] Security deposit status is correct
- [ ] Tickets are visible (if any)
- [ ] Promo requests are visible (if any)

### Admin Verification
- [ ] Admin can view dealer list
- [ ] Admin can approve/reject applications
- [ ] Admin can manage security deposits
- [ ] Party ledger linked correctly (if enabled)

### Integration Verification
- [ ] New orders follow full CRM flow
- [ ] Dispatch notifications work
- [ ] Invoice generation works
- [ ] Payment recording works

---

## 11. Expected Record Counts (from SQL dump)

| Table | Records | Notes |
|-------|---------|-------|
| users | 58 | Filter to dealers only (~57 after admin exclusion) |
| dealers | 57 | All active dealers |
| dealer_applications | 60 | Historical applications |
| orders | 52 | All orders |
| order_items | 71 | Embedded in orders |
| products | 11 | Dealer-specific products |
| payments | 13 | Payment records |
| tickets | 1 | Support ticket |
| promo_requests | 3 | Marketing requests |
| security_deposits | 1 | Deposit transaction |

---

## 12. Timeline & Sign-off

### Migration Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Module Development | ✅ Complete | Done |
| Migration Planning | ✅ Complete | Done |
| Stakeholder Review | ✅ Complete | Done (this review) |
| **Gap Resolution** | Pending | Waiting for decisions |
| Staging Setup | ~1 day | Not started |
| Dry Run | ~2 hours | Not started |
| Dry Run Review | ~1 day | Not started |
| Production Migration | ~1 hour | Not started |
| DNS Switch | ~1 hour | Not started |

### Required Sign-offs

- [ ] **Technical Lead:** Approve migration script
- [ ] **Business Owner:** Approve Dealer→Party mapping
- [ ] **Accountant:** Approve Payment→Ledger mapping
- [ ] **Admin:** Final go-ahead for production

---

## 14. HOW TO RUN MIGRATION ON LIVE CRM

### Prerequisites
1. Access to Live CRM server with SSH
2. The SQL dump file (`dealer_data.sql`)
3. MongoDB backup taken (CRITICAL)

### Step-by-Step Instructions

#### Step 1: Backup Live Database
```bash
# SSH into live server
ssh root@your-live-server

# Backup MongoDB
mongodump --db musclegrid_crm --out /backup/pre_dealer_migration_$(date +%Y%m%d)
```

#### Step 2: Upload Migration Script
Copy these files to your live server:
- `/app/backend/migrations/dealer_portal_migration.py`
- `/app/backend/migrations/dealer_data.sql`

```bash
# On your local machine or from preview
scp /app/backend/migrations/dealer_portal_migration.py root@your-live-server:/app/backend/migrations/
scp /app/backend/migrations/dealer_data.sql root@your-live-server:/app/backend/migrations/
```

#### Step 3: Run Dry-Run on Live
```bash
cd /app/backend
python migrations/dealer_portal_migration.py --dry-run --source migrations/dealer_data.sql
```

Review the output:
- Check for unexpected duplicates
- Verify record counts match expected
- Review any warnings

#### Step 4: Execute Migration
```bash
cd /app/backend
python migrations/dealer_portal_migration.py --execute --source migrations/dealer_data.sql
```

Type `YES` when prompted to confirm.

#### Step 5: Verify Migration
```python
# In Python shell on live server
from pymongo import MongoClient
client = MongoClient("mongodb://localhost:27017")
db = client["musclegrid_crm"]

print(f"Dealers: {db.dealers.count_documents({'source': 'legacy_migration'})}")
print(f"Parties: {db.parties.count_documents({'party_type': 'dealer'})}")
print(f"Orders: {db.dealer_orders.count_documents({'source': 'legacy_migration'})}")
```

#### Step 6: Test Dealer Login
1. Go to `newcrm.musclegrid.in/partners`
2. Login with a known dealer email and their OLD password from partners.musclegrid.in
3. Verify dashboard loads with correct data

#### Step 7: DNS Cutover
Point `partners.musclegrid.in` to `newcrm.musclegrid.in/partners`

### Rollback (If Needed)
```bash
# Restore from backup
mongorestore --db musclegrid_crm --drop /backup/pre_dealer_migration_YYYYMMDD

# OR delete only migrated data
mongo musclegrid_crm --eval "db.users.deleteMany({source: 'legacy_migration'})"
mongo musclegrid_crm --eval "db.dealers.deleteMany({source: 'legacy_migration'})"
mongo musclegrid_crm --eval "db.parties.deleteMany({source: 'legacy_migration'})"
mongo musclegrid_crm --eval "db.dealer_orders.deleteMany({source: 'legacy_migration'})"
mongo musclegrid_crm --eval "db.dealer_applications.deleteMany({source: 'legacy_migration'})"
mongo musclegrid_crm --eval "db.dealer_products.deleteMany({source: 'legacy_migration'})"
```

---

## 15. Contact for Issues

For migration issues, contact the CRM development team.

**Document Version:** 3.0  
**Last Updated:** March 27, 2026  
**Status:** Preview migration complete, ready for Live migration

# MuscleGrid Dealer Portal Migration Guide

## Overview

This document outlines the migration strategy for moving data from the existing `partners.musclegrid.in` (MySQL/Hostinger) system to the new CRM-integrated Dealer Portal (MongoDB).

**Target URL:** `newcrm.musclegrid.in/partners` (DNS redirect from `partners.musclegrid.in`)

## Migration Status: **PLANNING COMPLETE - AWAITING DRY RUN APPROVAL**

- [x] Dealer Portal module built and tested
- [x] Data models created
- [x] APIs implemented
- [x] Migration mapping reviewed by stakeholder
- [ ] **Dealer → Party mapping rules defined** ⚠️
- [ ] **Order → CRM flow integration defined** ⚠️
- [ ] **Payment → Ledger mapping defined** ⚠️
- [ ] Staging environment prepared
- [ ] Dry-run executed with report
- [ ] Sample login verification
- [ ] Live migration executed

---

## ⚠️ CRITICAL: Missing Definitions (Must Be Resolved Before Migration)

### 🔴 1. Dealer → Party Mapping Rules

**Current Gap:** Migration document says "Map dealer → Party" but does NOT define HOW.

**Questions to Resolve:**

| Question | Options | Decision |
|----------|---------|----------|
| Party Type for Dealers? | a) New `dealer` party type | **TBD** |
|                         | b) Map to existing `customer` type |  |
|                         | c) Create as `supplier` type |  |
| If GSTIN already exists in CRM? | a) Link to existing party | **TBD** |
|                                  | b) Create duplicate with suffix |  |
|                                  | c) Skip and log for manual review |  |
| If Phone/Email already exists? | a) Merge accounts | **TBD** |
|                                 | b) Create separate dealer party |  |
|                                 | c) Skip and log |  |

**Proposed Default:**
- Create dealers as `party_type: "dealer"` (new type)
- If GSTIN exists → Log for manual review, skip auto-creation
- If Phone/Email exists → Create separate dealer party but flag for review

---

### 🔴 2. Order → CRM Flow Integration

**Current Gap:** Migrated orders are stored but NOT integrated with existing CRM flows.

**Questions to Resolve:**

| Integration Point | Options | Decision |
|-------------------|---------|----------|
| Dispatch Integration | a) Create dispatch records for migrated orders | **TBD** |
|                      | b) Mark as "historical" - no dispatch record |  |
| Inventory Impact | a) Deduct stock for migrated orders | **TBD** |
|                   | b) No stock impact (already dispatched) |  |
| Sales Register | a) Create sales entries | **TBD** |
|                 | b) No sales entries (historical) |  |
| Invoice Generation | a) Link to existing invoices if available | **TBD** |
|                     | b) Create placeholder invoices |  |
|                     | c) No invoice linkage |  |

**Proposed Default (RECOMMENDED):**
- ✅ Migrated orders marked as `source: "legacy_migration"`
- ✅ Do NOT affect current stock (already dispatched in old system)
- ✅ Do NOT create duplicate sales entries
- ✅ Remain as **historical records only**
- ✅ New orders placed post-migration will follow full CRM flow

---

### 🔴 3. Payment → Ledger Mapping

**Current Gap:** Payments listed but NOT linked to:
- Dealer ledger
- Invoices
- Orders

**Questions to Resolve:**

| Payment Mapping | Options | Decision |
|-----------------|---------|----------|
| Link to dealer ledger? | a) Yes - create ledger entries | **TBD** |
|                         | b) No - keep as payment records only |  |
| Link to invoices? | a) Yes - match by order/amount | **TBD** |
|                    | b) No - historical reference only |  |
| Opening balance? | a) Calculate from payment history | **TBD** |
|                   | b) Set to zero, fresh start |  |
|                   | c) Import closing balance from old system |  |

**Proposed Default:**
- Create payment records linked to `dealer_orders`
- Do NOT auto-create ledger entries (manual reconciliation needed)
- Opening balance: Import from old system OR set to zero with note

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

## 13. Contact for Issues

For migration issues, contact the CRM development team.

**Document Version:** 2.0  
**Last Updated:** March 2025  
**Status:** Awaiting gap resolution decisions before dry-run

# MuscleGrid Dealer Portal Migration Guide

## Overview

This document outlines the migration strategy for moving data from the existing `partners.musclegrid.in` (MySQL/Hostinger) system to the new CRM-integrated Dealer Portal (MongoDB).

## Migration Status: **READY FOR DRY-RUN**

- [x] Dealer Portal module built and tested
- [x] Data models created
- [x] APIs implemented
- [ ] Migration script tested on staging
- [ ] Dry-run executed
- [ ] Live migration executed

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

### Phase 2: Dry Run (Staging)
1. Run migration on staging database
2. Verify record counts
3. Test dealer login with migrated credentials
4. Verify orders and transactions
5. Generate dry-run report

### Phase 3: Live Migration
1. Put old portal in read-only mode
2. Export final data
3. Run migration script
4. Verify critical paths
5. Switch DNS to new portal

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

## 5. Duplicate Handling

### Phone Numbers
- If duplicate phone exists: Skip and log
- Manual resolution required

### Email Addresses
- If duplicate email exists: Skip and log
- Manual resolution required

### GSTIN
- If duplicate GSTIN exists: Log for review
- May indicate same dealer with different accounts

---

## 6. Rollback Plan

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

## 7. Migration Script Location

The migration script will be created at:
`/app/backend/migrations/dealer_portal_migration.py`

### Usage
```bash
# Dry run (no changes)
python dealer_portal_migration.py --dry-run --source mysql_dump.sql

# Actual migration
python dealer_portal_migration.py --execute --source mysql_dump.sql
```

---

## 8. Post-Migration Checklist

- [ ] All users can login
- [ ] Dealer dashboards load correctly
- [ ] Order history is visible
- [ ] Payment proofs are accessible
- [ ] Security deposit status is correct
- [ ] Tickets are visible
- [ ] Promo requests are visible
- [ ] Admin can manage dealers
- [ ] Party ledger is linked

---

## 9. Expected Record Counts (from SQL dump)

| Table | Records |
|-------|---------|
| users | 58 (filter to dealers only) |
| dealers | 57 |
| dealer_applications | 60 |
| orders | 52 |
| order_items | 71 |
| products | 11 |
| payments | 13 |
| tickets | 1 |
| promo_requests | 3 |
| security_deposits | 1 |

---

## 10. Contact for Issues

For migration issues, contact the CRM development team.

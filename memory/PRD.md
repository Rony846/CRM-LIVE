# MuscleGrid CRM - Product Requirements Document

## Overview
Customer Service & Logistics CRM for MuscleGrid products (inverters, batteries, stabilizers)

**Domain**: crm.musclegrid.in  
**Current Phase**: Phase 2 Complete - Production Ready  
**Last Updated**: March 12, 2026

---

## Architecture

### Tech Stack
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Authentication**: JWT-based with role-based access control (6 roles)

### Deployment
- Hosted on Emergent Platform
- Production URL: https://crm-rebuild-11.preview.emergentagent.com
- 50 credits/month for permanent hosting

---

## User Personas & Roles

### 1. Customer (External)
- Register warranty for products
- Create support tickets
- Track ticket status
- Upload Amazon review screenshots for warranty extension

### 2. Call Support Agent
- Handle incoming customer calls
- Create/update support tickets
- Diagnose issues (software vs hardware)
- Route hardware issues to Accountant

### 3. Service Agent / Technician
- Work on assigned tickets
- Update service progress
- Request hardware parts if needed

### 4. Accountant
- Manage outbound dispatch requests
- Upload shipping labels with courier/tracking
- Handle reverse pickup and part dispatch workflows

### 5. Dispatcher
- View dispatch queue on dashboard
- TV Mode for warehouse display (auto-refresh 10s)
- Mark items as dispatched

### 6. Admin
- Full system access
- Customer CRM management
- Warranty approvals/rejections (manual end-date setting)
- User management
- View all tickets
- Campaign management

---

## What's Been Implemented

### Phase 1 MVP (Complete - January 2026)
- [x] JWT-based authentication
- [x] 6 user roles with permissions
- [x] Role-based dashboard routing
- [x] Protected API endpoints
- [x] Customer Portal (dashboard, tickets, warranties)
- [x] Call Support Agent dashboard
- [x] Service Agent dashboard
- [x] Accountant dashboard (Outbound, Labels, Hardware tabs)
- [x] Dispatcher dashboard with TV Mode
- [x] Admin dashboard with Customer CRM, Warranties, Users, Tickets
- [x] File upload for invoices and labels
- [x] Ticket lifecycle management
- [x] Warranty approval workflow

### Phase 2 (Complete - March 2026)
- [x] Data migration from legacy MySQL database
  - 86 customers migrated
  - 10+ tickets migrated
  - 10 products in catalog
  - 10 warranty records
- [x] Search/filter capabilities on all tables
- [x] Email notification templates (ready for Resend integration)
- [x] Customer address fields in registration/profile
- [x] Warranty extension campaign structure
- [x] Admin Campaigns page

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@musclegrid.in | admin123 |
| Call Support | support@musclegrid.in | support123 |
| Call Support 2 | support2@musclegrid.in | support123 |
| Service Agent | service@musclegrid.in | service123 |
| Accountant | accountant@musclegrid.in | accountant123 |
| Dispatcher | dispatcher@musclegrid.in | dispatch123 |
| Customer (migrated) | ami_t@live.com | customer123 |
| Customer (migrated) | manas.cdac@gmail.com | customer123 |

All migrated customers can login with password: `customer123`

---

## API Endpoints

### Auth
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login
- GET `/api/auth/me` - Get current user
- PATCH `/api/auth/me` - Update profile

### Tickets
- POST `/api/tickets` - Create ticket
- GET `/api/tickets` - List tickets (role-filtered, with search)
- GET `/api/tickets/{id}` - Get ticket details
- PATCH `/api/tickets/{id}` - Update ticket
- POST `/api/tickets/{id}/route-to-hardware` - Route to hardware service

### Warranties
- POST `/api/warranties` - Register warranty (multipart)
- GET `/api/warranties` - List warranties (with search)
- GET `/api/warranties/{id}` - Get warranty details
- PATCH `/api/warranties/{id}/approve` - Approve warranty
- PATCH `/api/warranties/{id}/reject` - Reject warranty
- POST `/api/warranties/{id}/request-extension` - Request extension
- PATCH `/api/warranties/{id}/approve-extension` - Approve extension
- PATCH `/api/warranties/{id}/reject-extension` - Reject extension

### Dispatches
- POST `/api/dispatches/outbound` - Create outbound dispatch
- POST `/api/dispatches/from-ticket/{id}` - Create from ticket
- GET `/api/dispatches` - List dispatches
- PATCH `/api/dispatches/{id}/label` - Upload label
- PATCH `/api/dispatches/{id}/status` - Update status
- GET `/api/dispatcher/queue` - Get dispatcher queue

### Admin
- GET `/api/admin/stats` - Dashboard statistics
- GET `/api/admin/customers` - List all customers (with search)
- PATCH `/api/admin/customers/{id}` - Update customer
- GET `/api/admin/users` - List all users
- POST `/api/admin/users` - Create internal user
- GET `/api/campaigns` - List campaigns
- POST `/api/campaigns` - Create campaign
- POST `/api/campaigns/{id}/send-emails` - Send campaign emails
- GET `/api/campaigns/extension-requests` - Get extension requests

---

## Prioritized Backlog

### P0 - Critical (Immediate)
- [x] Data migration complete
- [ ] Configure Resend API key for email notifications
- [ ] Deploy to production

### P1 - High Priority
- [ ] Customer CSV import for bulk additions
- [ ] SMS notifications for dispatch tracking
- [ ] Warranty reminder campaigns

### P2 - Medium Priority
- [ ] Service analytics dashboard
- [ ] Automated follow-up reminders
- [ ] Report generation

### P3 - Nice to Have
- [ ] Mobile app (React Native)
- [ ] Integration with courier APIs for tracking
- [ ] Customer self-service knowledge base
- [ ] Bulk operations

---

## Database Collections

### users
- id, email, first_name, last_name, phone, role, password_hash
- address, city, state, pincode
- created_at, updated_at, legacy_id (for migrated)

### tickets
- id, ticket_number, customer_id, customer_name, customer_phone, customer_email
- customer_address, device_type, order_id, issue_description
- status, diagnosis, issue_type, agent_notes
- assigned_to, assigned_to_name, history[]
- created_at, updated_at, legacy_id (for migrated)

### warranties
- id, warranty_number, customer_id
- first_name, last_name, phone, email
- device_type, invoice_date, invoice_amount, order_id
- invoice_file, status, warranty_end_date, admin_notes
- extension_requested, extension_status, extension_review_file
- created_at, updated_at

### dispatches
- id, dispatch_number, dispatch_type, sku
- customer_name, phone, address, city, state, pincode
- reason, note, courier, tracking_id, label_file
- status, ticket_id, created_by
- created_at, updated_at

### products
- id, sku_code, model_name, active, created_at

### campaigns
- id, campaign_code, name, description
- target_device_types, max_sends, status
- created_at, updated_at

---

## Files Structure

```
/app/
├── backend/
│   ├── server.py          # Main FastAPI application
│   ├── migrate_data.py    # Data migration script
│   ├── requirements.txt
│   ├── .env
│   └── uploads/           # Uploaded files
│       ├── invoices/
│       ├── labels/
│       └── reviews/
├── frontend/
│   ├── src/
│   │   ├── App.js         # Main router
│   │   ├── components/    # Reusable components
│   │   │   ├── ui/        # Shadcn components
│   │   │   ├── layout/    # Layout components
│   │   │   └── dashboard/ # Dashboard components
│   │   └── pages/         # Page components
│   │       ├── admin/
│   │       ├── customer/
│   │       ├── support/
│   │       ├── service/
│   │       ├── accountant/
│   │       └── dispatcher/
│   └── package.json
├── memory/
│   └── PRD.md
└── test_reports/
    ├── iteration_1.json
    └── iteration_2.json
```

---

## Notes

### Email Notifications
Email notifications are implemented but require Resend API key configuration:
1. Get API key from https://resend.com
2. Add to `/app/backend/.env`: `RESEND_API_KEY=re_xxxxx`
3. Set sender email: `SENDER_EMAIL=noreply@yourdomain.com`

### Data Migration
Migration script at `/app/backend/migrate_data.py` imported:
- 86 customers from crm_customers table
- 10 repair tickets with status mapping
- 10 product SKUs
- 10 sample warranty records

Legacy IDs are preserved in `legacy_id` field for reference.

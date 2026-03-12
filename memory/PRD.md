# MuscleGrid CRM - Product Requirements Document

## Overview
Customer Service & Logistics CRM for MuscleGrid products (inverters, batteries, stabilizers)

**Domain**: crm.musclegrid.in  
**Current Phase**: Phase 1 MVP Complete  
**Last Updated**: January 2026

---

## Architecture

### Tech Stack (Development)
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Authentication**: JWT-based with role-based access control

### Deployment Note
For Hostinger deployment, the system is designed with clean API separation that can be migrated to PHP + MySQL. Database schema follows SQL-compatible patterns.

---

## User Personas

### 1. Customer (External)
- Register warranty for products
- Create support tickets
- Track ticket status
- Upload Amazon review screenshots (future: warranty extension)

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
- Warranty approvals/rejections
- User management
- View all tickets

---

## Core Requirements (Static)

### Authentication & Authorization
- [x] JWT-based authentication
- [x] 6 user roles with permissions
- [x] Role-based dashboard routing
- [x] Protected API endpoints

### Customer Portal
- [x] Dashboard with stats
- [x] Create support tickets
- [x] View ticket history and status
- [x] Register warranty with invoice upload
- [x] View warranty status

### Ticket System
- [x] Ticket creation by customer/agent
- [x] Ticket lifecycle (open → diagnosed → hardware/software → resolved)
- [x] Agent notes and diagnosis
- [x] Route to hardware service
- [x] History tracking

### Warranty System
- [x] Registration form with device type, invoice details
- [x] Invoice file upload
- [x] Admin approval/rejection workflow
- [x] Manual warranty end date setting
- [ ] Warranty extension via review screenshot

### Dispatch Management
- [x] Outbound dispatch requests
- [x] Label upload with courier/tracking
- [x] Reverse pickup workflow
- [x] Part dispatch workflow
- [x] Dispatcher queue

### Dispatcher Dashboard
- [x] Standard dashboard view
- [x] TV Mode (dark theme, large fonts)
- [x] Auto-refresh every 10 seconds
- [x] Mobile-friendly

---

## What's Been Implemented (Phase 1)

### January 2026 - Initial MVP
- Complete authentication system with 6 roles
- Customer Portal with dashboard, tickets, warranties
- Call Support Agent dashboard with ticket queue
- Service Agent dashboard
- Accountant dashboard (Outbound, Labels, Hardware tabs)
- Dispatcher dashboard with TV Mode
- Admin dashboard with Customer CRM, Warranties, Users, Tickets
- Role-based access control on all routes
- File upload for invoices and labels
- Ticket lifecycle management
- Warranty approval workflow

---

## Prioritized Backlog

### P0 - Critical (Next Sprint)
1. Customer address field in registration/profile
2. Email notifications for ticket updates
3. SMS notifications for dispatch tracking

### P1 - High Priority
1. Warranty extension campaign (review screenshots)
2. Customer data import (CSV upload)
3. Assign tickets to service agents
4. Search/filter on all data tables

### P2 - Medium Priority
1. Service analytics dashboard
2. Warranty reminder campaigns
3. Automated follow-up reminders
4. Report generation

### P3 - Nice to Have
1. Mobile app (React Native)
2. Integration with courier APIs for tracking
3. Customer self-service knowledge base
4. Bulk operations

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@musclegrid.in | admin123 |
| Call Support | support@musclegrid.in | support123 |
| Service Agent | service@musclegrid.in | service123 |
| Accountant | accountant@musclegrid.in | accountant123 |
| Dispatcher | dispatcher@musclegrid.in | dispatch123 |
| Customer | customer@example.com | customer123 |

---

## API Endpoints

### Auth
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login
- GET `/api/auth/me` - Get current user

### Tickets
- POST `/api/tickets` - Create ticket
- GET `/api/tickets` - List tickets (role-filtered)
- GET `/api/tickets/{id}` - Get ticket details
- PATCH `/api/tickets/{id}` - Update ticket
- POST `/api/tickets/{id}/route-to-hardware` - Route to hardware

### Warranties
- POST `/api/warranties` - Register warranty (multipart)
- GET `/api/warranties` - List warranties
- PATCH `/api/warranties/{id}/approve` - Approve warranty
- PATCH `/api/warranties/{id}/reject` - Reject warranty

### Dispatches
- POST `/api/dispatches/outbound` - Create outbound dispatch
- POST `/api/dispatches/from-ticket/{id}` - Create from ticket
- GET `/api/dispatches` - List dispatches
- PATCH `/api/dispatches/{id}/label` - Upload label
- PATCH `/api/dispatches/{id}/status` - Update status
- GET `/api/dispatcher/queue` - Get dispatcher queue

### Admin
- GET `/api/admin/customers` - List all customers
- GET `/api/admin/users` - List all users
- POST `/api/admin/users` - Create internal user
- GET `/api/admin/stats` - Dashboard statistics

---

## Next Tasks

1. **Add customer address field** - Required for dispatch
2. **Implement email notifications** - Using SendGrid/Resend
3. **Add search/filter to tables** - Better data management
4. **Customer import feature** - CSV upload for bulk customers
5. **Service agent ticket assignment** - From call support

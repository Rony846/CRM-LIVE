# MuscleGrid CRM - Email Integration Touchpoints

## Overview
This document lists all customer touchpoints where emails can/should be sent via Zoho Mail API integration.

---

## 📧 EMAIL TOUCHPOINTS BY MODULE

### 1. SUPPORT TICKETS (Service Center)
| Event | Recipient | Purpose | Priority |
|-------|-----------|---------|----------|
| Ticket Created | Customer | Confirmation with ticket number, expected timeline | HIGH |
| Ticket Status Update | Customer | Status change notifications (received, under repair, ready) | HIGH |
| Repair Completed | Customer | Notify repair is done, pickup/delivery options | HIGH |
| Ticket Closed | Customer | Summary of work done, warranty info, feedback request | MEDIUM |
| SLA Breach Warning | Internal | Alert when ticket is about to breach SLA | MEDIUM |

### 2. DISPATCHES (Shipments)
| Event | Recipient | Purpose | Priority |
|-------|-----------|---------|----------|
| Dispatch Created | Customer | Order shipped notification with tracking details | HIGH |
| Tracking Update | Customer | Shipment status updates (in transit, out for delivery) | MEDIUM |
| Delivery Confirmation | Customer | Delivery confirmed, request feedback | MEDIUM |
| Return Dispatch | Customer | Repaired item being shipped back | HIGH |

### 3. QUOTATIONS / PROFORMA INVOICES (PI)
| Event | Recipient | Purpose | Priority |
|-------|-----------|---------|----------|
| Quotation Created | Customer | Send quotation PDF with payment link | HIGH |
| Quotation Reminder | Customer | Follow-up on pending quotations | MEDIUM |
| Quotation Approved | Internal | Notify sales team of approval | LOW |
| Quotation Expired | Customer | Quotation validity expired, offer to renew | LOW |

### 4. WARRANTY REGISTRATIONS
| Event | Recipient | Purpose | Priority |
|-------|-----------|---------|----------|
| Warranty Registered | Customer | Confirmation with warranty details and certificate | HIGH |
| Warranty Expiring | Customer | 30-day warning before warranty expires | MEDIUM |
| Warranty Expired | Customer | Warranty ended, offer extended warranty | LOW |

### 5. DEALER ORDERS (B2B)
| Event | Recipient | Purpose | Priority |
|-------|-----------|---------|----------|
| Order Placed | Dealer | Order confirmation with details | HIGH |
| Order Confirmed | Dealer | Payment confirmed, processing started | HIGH |
| Order Dispatched | Dealer | Shipment details with tracking | HIGH |
| Order Delivered | Dealer | Delivery confirmation, invoice attached | MEDIUM |
| Payment Reminder | Dealer | Outstanding payment reminder | MEDIUM |

### 6. SALES INVOICES
| Event | Recipient | Purpose | Priority |
|-------|-----------|---------|----------|
| Invoice Generated | Customer | Send invoice PDF for records | HIGH |
| Payment Received | Customer | Payment confirmation receipt | MEDIUM |
| Payment Reminder | Customer | Outstanding payment reminder | MEDIUM |

### 7. AMAZON ORDERS (Marketplace)
| Event | Recipient | Purpose | Priority |
|-------|-----------|---------|----------|
| Order Imported | Internal | New Amazon order received | LOW |
| Dispatch Complete | Internal | Order fulfilled notification | LOW |

### 8. DEALER PORTAL
| Event | Recipient | Purpose | Priority |
|-------|-----------|---------|----------|
| Application Received | Dealer | Application confirmation | HIGH |
| Application Approved | Dealer | Welcome email with portal access | HIGH |
| Application Rejected | Dealer | Rejection with reason | MEDIUM |
| New Announcement | All Dealers | Company updates, promotions | MEDIUM |
| Target Achievement | Dealer | Congratulations on hitting targets | LOW |

### 9. USER MANAGEMENT
| Event | Recipient | Purpose | Priority |
|-------|-----------|---------|----------|
| Account Created | User | Welcome email with credentials | HIGH |
| Password Reset | User | Password reset link | HIGH |
| OTP Verification | User | Login OTP (currently via SMS) | HIGH |

---

## 🔧 IMPLEMENTATION PRIORITY

### Phase 1 (Immediate - HIGH Priority)
1. **Quotation/PI Emails** - Send quotations directly to customers
2. **Ticket Status Emails** - Keep customers informed about repairs
3. **Dispatch Notifications** - Shipping confirmations with tracking
4. **Warranty Registration** - Auto-send warranty certificates

### Phase 2 (Next Sprint - MEDIUM Priority)
5. **Payment Receipts** - Confirm payments received
6. **Dealer Order Updates** - B2B order lifecycle emails
7. **Payment Reminders** - Outstanding dues notifications
8. **Feedback Requests** - Post-service surveys

### Phase 3 (Future - LOW Priority)
9. **Marketing Campaigns** - Promotional emails
10. **Warranty Expiry Alerts** - Pre-expiry notifications
11. **Dealer Announcements** - Bulk dealer communications
12. **Reports & Summaries** - Weekly/monthly digests

---

## 📋 DATA AVAILABLE FOR EMAILS

### Customer Data Points
- `customer_name` - Full name
- `customer_email` - Email address
- `customer_phone` - Phone number
- `customer_address` - Full address

### Transaction Data
- `ticket_number` - Service ticket reference
- `dispatch_number` - Shipment reference
- `invoice_number` - Invoice reference
- `quotation_number` - Quotation reference
- `warranty_number` - Warranty reference
- `tracking_id` - Courier tracking number

### Document Attachments
- Invoice PDFs
- Quotation PDFs
- Warranty Certificates
- Jobcard PDFs
- Shipping Labels

---

## 🔑 ZOHO CREDENTIALS (Saved)
- **Account**: service@musclegrid.in
- **Region**: India (zoho.in)
- **Tokens**: `/app/backend/zoho_tokens.json`

---

## 📝 NOTES
- SMS notifications are already implemented via Fast2SMS
- In-app notifications exist for internal users
- Email will complement existing SMS for better reach
- Consider customer preference (email vs SMS) per communication

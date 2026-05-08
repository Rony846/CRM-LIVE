# MuscleGrid CRM - Accountant User Manual
## Complete Training Guide

**Version**: 1.0  
**Last Updated**: April 2, 2026  
**Application URL**: https://newcrm.musclegrid.in

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Daily Tasks Checklist](#3-daily-tasks-checklist)
4. [Incoming Queue - Package Processing](#4-incoming-queue---package-processing)
5. [Dispatch Workflow](#5-dispatch-workflow)
6. [Purchase Register](#6-purchase-register)
7. [Sales Register](#7-sales-register)
8. [Party Master & Ledger](#8-party-master--ledger)
9. [Payments Management](#9-payments-management)
10. [Credit Notes](#10-credit-notes)
11. [Inventory Management](#11-inventory-management)
12. [Production Requests](#12-production-requests)
13. [Pending Fulfillment](#13-pending-fulfillment)
14. [Quotations](#14-quotations)
15. [Finance & GST](#15-finance--gst)
16. [Compliance Dashboard](#16-compliance-dashboard)
17. [Reports](#17-reports)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. Getting Started

### 1.1 Logging In
1. Open browser and go to: `https://newcrm.musclegrid.in`
2. Enter your email address
3. Enter your password
4. Click "Login"

### 1.2 Navigation
After login, you'll see the sidebar menu on the left with these sections:
- **Dashboard** - Overview & Compliance
- **Finance** - All accounting functions
- **Sales** - Quotations management
- **Operations** - Inventory & Production
- **Dispatch** - Shipping & Gate control

### 1.3 Your Role Permissions
As an Accountant, you can:
- ✅ Process incoming packages and classify inventory
- ✅ Create and manage purchases
- ✅ Create and manage sales invoices
- ✅ Manage party accounts (suppliers/customers)
- ✅ Record payments
- ✅ Issue credit notes
- ✅ View and generate reports
- ✅ Manage dispatches
- ✅ Handle compliance drafts (Admin finalizes)

---

## 2. Dashboard Overview

### 2.1 Accessing Dashboard
Click **Dashboard** → **Overview** in the sidebar.

### 2.2 What You See
The dashboard shows key metrics:
- **Pending Incoming**: Packages waiting to be classified
- **Pending Dispatches**: Items ready to ship
- **Today's Transactions**: Sales/purchases today
- **Outstanding Balances**: Pending payments

### 2.3 Quick Actions
From dashboard, you can quickly jump to:
- Recent incoming packages
- Pending dispatches
- Today's invoices

---

## 3. Daily Tasks Checklist

### Morning Tasks (9:00 AM)
| # | Task | Location | Priority |
|---|------|----------|----------|
| 1 | Check Incoming Queue | Operations → Incoming Queue | HIGH |
| 2 | Process yesterday's gate scans | Operations → Incoming Queue | HIGH |
| 3 | Check Pending Fulfillment | Operations → Pending Fulfillment | MEDIUM |
| 4 | Review draft purchases | Finance → Purchase Register | MEDIUM |

### Throughout Day
| # | Task | When | Location |
|---|------|------|----------|
| 5 | Classify new packages | As they arrive | Incoming Queue |
| 6 | Create purchase entries | When goods received | Purchase Register |
| 7 | Create sales invoices | When goods dispatched | Sales Register |
| 8 | Record payments | When received/made | Payments |

### End of Day (5:00 PM)
| # | Task | Location | Priority |
|---|------|----------|----------|
| 9 | Verify day's dispatches | Dispatch → Outbound | HIGH |
| 10 | Check all drafts submitted | Compliance Dashboard | HIGH |
| 11 | Reconcile cash/bank | Finance → Reconciliation | MEDIUM |

---

## 4. Incoming Queue - Package Processing

### 4.1 What is Incoming Queue?
When the Gate team scans an incoming package (returns, new stock, etc.), it appears in your Incoming Queue. Your job is to **classify** what it is and where it should go.

### 4.2 Opening Incoming Queue
**Navigation**: Operations → Incoming Queue

### 4.3 Understanding the Queue
Each entry shows:
- **Queue #**: Unique identifier (e.g., MG-IQ-20260402-12345)
- **Tracking**: Courier tracking number
- **Linked To**: Associated ticket/dispatch (if any)
- **Customer**: Customer name (if known)
- **Media**: Photos/videos taken at gate (click to view)
- **Status**: Pending, Classified, Processed

### 4.4 Viewing Gate Media
**IMPORTANT**: Always review media before classifying!

1. Look at the **Media** column
2. Click the image/video count button
3. Review all photos taken at gate
4. Check package condition
5. Verify contents match tracking

### 4.5 Classifying a Package

**Step 1**: Click **"Classify"** button on the pending entry

**Step 2**: Select Classification Type:

| Type | When to Use | What Happens |
|------|-------------|--------------|
| **Good Inventory** | New stock received in good condition | Goes to inventory |
| **Return - Good** | Customer return, item is fine | Goes to inventory |
| **Return - Defective** | Customer return, item damaged | Goes to defective stock |
| **Service Return** | Item back from repair | Updates ticket status |
| **Scrap** | Item cannot be used | Written off |
| **Wrong Delivery** | Not our package | Mark for return to courier |

**Step 3**: Fill required details:
- Select **Firm** (which warehouse)
- Select **Item** (SKU)
- Enter **Quantity**
- Add **Remarks** (optional but recommended)

**Step 4**: Click **"Classify & Process"**

### 4.6 Creating New Ticket from Queue
If an incoming package needs a new service ticket:
1. Click **"Classify"** on the entry
2. Select **"Create New Ticket"**
3. Fill customer details
4. System creates ticket and links the package

### 4.7 Flow Diagram: Incoming Package
```
Gate Scan (Photo/Video)
        ↓
  Incoming Queue (Pending)
        ↓
  Accountant Reviews Media
        ↓
  Accountant Classifies
        ↓
    ┌───────┴───────┐
    ↓               ↓
Good Stock    Defective/Scrap
    ↓               ↓
Inventory      Write-off/
Updated        Repair Queue
```

---

## 5. Dispatch Workflow

### 5.1 Complete Dispatch Flow
```
Ticket Created → Repair Complete → Ready for Dispatch
                                          ↓
                              Accountant: Upload Label
                                          ↓
                              Gate: Scan Outward (Photo)
                                          ↓
                              Courier Picks Up
                                          ↓
                              Delivered to Customer
```

### 5.2 Step 1: Hardware Tickets (Ready for Dispatch)
**Navigation**: Dispatch → Hardware Tickets

This shows all tickets where:
- Repair is complete
- Item is ready to ship back to customer

**What you see**:
- Ticket number
- Customer name & address
- Device type
- Repair status
- Dispatch status

### 5.3 Step 2: Upload Shipping Label
**Navigation**: Dispatch → Upload Labels

**Process**:
1. Find the ticket in the list
2. Generate shipping label from courier website (Delhivery, BlueDart, etc.)
3. Click **"Upload Label"**
4. Select the PDF/image file
5. Enter tracking number
6. Select courier name
7. Click **"Submit"**

**Label Requirements**:
- Clear, readable barcode
- Correct customer address
- Proper weight mentioned

### 5.4 Step 3: Outbound Dispatch
**Navigation**: Dispatch → Outbound Dispatch

This shows items with labels uploaded, ready for gate scan.

**Process**:
1. Physically hand package to Gate team
2. Gate team scans outward
3. Gate team takes photo of package
4. Status updates to "Dispatched"

### 5.5 Step 4: Gate Control (Monitor)
**Navigation**: Dispatch → Gate Control

Here you can:
- See all gate scans (inward/outward)
- Monitor package movements
- View scan photos/videos

### 5.6 Dispatch Status Meanings

| Status | Meaning | Action Needed |
|--------|---------|---------------|
| `ready_for_dispatch` | Repair done, needs label | Upload label |
| `awaiting_label` | Waiting for you | Upload label now |
| `label_uploaded` | Has label, ready for gate | Give to gate team |
| `dispatched` | Scanned out, with courier | Track delivery |
| `delivered` | Customer received | Close ticket |

---

## 6. Purchase Register

### 6.1 What is Purchase Register?
Records all purchases from suppliers - raw materials, finished goods, services.

**Navigation**: Finance → Purchase Register

### 6.2 Creating a New Purchase

**Step 1**: Click **"New Purchase"** button

**Step 2**: Select Supplier
- Choose from Party Master dropdown
- If new supplier, create in Party Master first

**Step 3**: Enter Purchase Details
| Field | Description | Required |
|-------|-------------|----------|
| Supplier Invoice No. | Supplier's bill number | Yes |
| Invoice Date | Date on supplier bill | Yes |
| Firm | Which entity is buying | Yes |
| Due Date | Payment due date | No |

**Step 4**: Add Line Items
Click **"Add Item"** for each product:
- Select SKU/Item
- Enter Quantity
- Enter Rate (per unit)
- GST auto-calculates

**Step 5**: Upload Supplier Invoice
- Click **"Upload Invoice"**
- Select PDF/image of supplier bill
- **Required before finalizing**

**Step 6**: Save as Draft
Click **"Save Draft"** - purchase is saved but not posted

### 6.3 Editing a Draft Purchase
1. Find purchase in list (Status: Draft)
2. Click to open
3. Make changes
4. Click **"Update Draft"**

### 6.4 Finalizing Purchase (Admin Only)
- Only Admin can click **"Finalize"**
- Once finalized:
  - Inventory is updated
  - GST is recorded
  - Party ledger is updated
  - Cannot be edited

### 6.5 Purchase Entry Status

| Status | Meaning | Who Can Edit |
|--------|---------|--------------|
| `draft` | Saved, not posted | Accountant |
| `pending_approval` | Waiting for admin | Admin only |
| `final` | Posted to books | No one |

---

## 7. Sales Register

### 7.1 What is Sales Register?
Records all sales to customers - invoices, dispatch records.

**Navigation**: Finance → Sales Register

### 7.2 Creating a Sales Invoice

**Step 1**: Click **"New Invoice"**

**Step 2**: Select Customer/Party
- Choose from dropdown
- Or enter new customer details

**Step 3**: Enter Invoice Details
| Field | Description |
|-------|-------------|
| Invoice Date | Today's date |
| Firm | Selling entity |
| Place of Supply | Delivery state |
| Transport Mode | Road/Air/Rail |

**Step 4**: Add Line Items
For each product:
- Select SKU
- Enter Quantity
- Rate (auto-fills from master)
- GST (auto-calculates)

**Step 5**: Apply Discounts (if any)
- Item-level discount OR
- Invoice-level discount

**Step 6**: Generate Invoice
- Click **"Generate"**
- Download PDF for customer

### 7.3 Linking to Dispatch
Sales invoices can be linked to dispatches:
1. Create invoice
2. Go to dispatch
3. Link invoice number
4. Both records stay connected

---

## 8. Party Master & Ledger

### 8.1 Party Master
**Navigation**: Finance → Party Master

**What is a Party?**
Any entity you transact with:
- Suppliers (you buy from)
- Customers (you sell to)
- Both (some parties are both)

### 8.2 Creating a New Party

1. Click **"Add Party"**
2. Fill details:

| Field | Required | Description |
|-------|----------|-------------|
| Name | Yes | Company/person name |
| Type | Yes | Supplier/Customer/Both |
| GSTIN | If registered | 15-digit GST number |
| PAN | Recommended | 10-digit PAN |
| Address | Yes | Full address |
| State | Yes | For GST calculation |
| Contact Person | No | Primary contact |
| Phone | Yes | Contact number |
| Email | No | For sending invoices |

3. Click **"Save"**

### 8.3 Party Ledger
**Navigation**: Finance → Party Ledger

Shows all transactions with a party:
- Purchases (Credit to party)
- Payments (Debit to party)
- Sales (Debit to party)
- Receipts (Credit to party)

**Viewing Ledger**:
1. Select Party from dropdown
2. Select date range
3. View all transactions
4. See running balance

**Balance Meaning**:
- Positive balance = Party owes us
- Negative balance = We owe party

---

## 9. Payments Management

### 9.1 Recording a Payment (Outgoing)
**Navigation**: Finance → Payments

**When**: You pay a supplier

**Steps**:
1. Click **"Record Payment"**
2. Select Party (supplier)
3. Enter Amount
4. Select Payment Mode:
   - Cash
   - Bank Transfer (NEFT/RTGS/IMPS)
   - Cheque
   - UPI
5. Enter Reference Number
6. Select Date
7. Upload proof (bank statement/receipt)
8. Click **"Save"**

### 9.2 Recording a Receipt (Incoming)
**When**: Customer pays you

**Steps**:
1. Click **"Record Receipt"**
2. Select Party (customer)
3. Enter Amount
4. Select Payment Mode
5. Enter Reference
6. Link to Invoice (optional)
7. Click **"Save"**

### 9.3 Payment Modes

| Mode | Reference Required |
|------|-------------------|
| Cash | Receipt number |
| Bank Transfer | UTR/Transaction ID |
| Cheque | Cheque number + Bank |
| UPI | UPI Reference ID |

---

## 10. Credit Notes

### 10.1 What is a Credit Note?
Issued when:
- Customer returns goods
- Invoice amount was wrong
- Discount given after sale

**Navigation**: Finance → Credit Notes

### 10.2 Creating a Credit Note

1. Click **"New Credit Note"**
2. Select original invoice (or customer)
3. Enter reason:
   - Sales Return
   - Rate Difference
   - Discount
   - Defective Goods
4. Enter item details & amount
5. Generate credit note number
6. Click **"Save"**

### 10.3 Effect of Credit Note
- Reduces customer's outstanding
- Adjusts GST liability
- Links to original invoice

---

## 11. Inventory Management

### 11.1 Viewing Inventory
**Navigation**: Operations → Inventory

Shows stock levels across all firms/warehouses.

### 11.2 Understanding Stock

| Column | Meaning |
|--------|---------|
| SKU | Product code |
| Name | Product description |
| Firm | Warehouse location |
| Quantity | Current stock |
| Reserved | Allocated for orders |
| Available | Qty - Reserved |

### 11.3 Stock Adjustment
If physical stock ≠ system stock:
1. Click **"Adjust Stock"**
2. Select SKU
3. Enter new quantity
4. Select reason:
   - Physical Count
   - Damage
   - Sample
   - Other
5. Add remarks
6. Click **"Submit"**

⚠️ **Note**: All adjustments are logged and audited.

---

## 12. Production Requests

### 12.1 What is Production?
Manufacturing finished goods from raw materials.

**Navigation**: Operations → Production

### 12.2 Creating Production Request

1. Click **"New Production Request"**
2. Select finished good SKU
3. Enter quantity needed
4. System shows required raw materials
5. Verify materials available
6. Click **"Submit Request"**

### 12.3 Production Status

| Status | Meaning |
|--------|---------|
| `requested` | Waiting for materials |
| `in_progress` | Production started |
| `completed` | Finished goods ready |
| `cancelled` | Request cancelled |

---

## 13. Pending Fulfillment

### 13.1 What is Pending Fulfillment?
Orders that are confirmed but not yet shipped.

**Navigation**: Operations → Pending Fulfillment

### 13.2 Processing Fulfillment

1. View pending orders
2. Check stock availability
3. Click **"Process"** on order
4. System reserves stock
5. Create dispatch
6. Upload label
7. Gate scans outward

---

## 14. Quotations

### 14.1 Viewing Quotations
**Navigation**: Sales → Quotations

### 14.2 Your Role in Quotations
As accountant, you can:
- View all quotations
- Check pricing
- Convert approved quotations to invoices
- Track quotation status

### 14.3 PI Pending Action
**Navigation**: Sales → PI Pending Action

Shows quotations needing follow-up:
- Customer hasn't responded
- Payment pending
- Approval needed

---

## 15. Finance & GST

### 15.1 GST Dashboard
**Navigation**: Finance → Finance & GST

Shows:
- Monthly GST summary
- CGST, SGST, IGST breakup
- Input Tax Credit (ITC) available
- Tax payable

### 15.2 Monthly GST Tasks

| Task | When | How |
|------|------|-----|
| Reconcile purchases | 1st week | Compare with GSTR-2A |
| Verify sales | 1st week | Match with invoices |
| Calculate ITC | 10th | Check eligible credits |
| File GSTR-1 | 11th | Export and file |
| File GSTR-3B | 20th | Pay and file |

---

## 16. Compliance Dashboard

### 16.1 What is Compliance?
Ensuring all transactions have proper documentation before posting to books.

**Navigation**: Dashboard → Compliance

### 16.2 Draft Management

**Your Role**:
- Create drafts (purchases, sales, credit notes)
- Attach all required documents
- Submit for admin approval

**Admin Role**:
- Review drafts
- Verify documents
- Finalize (post to books)

### 16.3 Required Documents

| Transaction | Required Documents |
|-------------|-------------------|
| Purchase | Supplier invoice, PO |
| Sales | Delivery proof |
| Credit Note | Return document |
| Payment | Bank proof/receipt |

---

## 17. Reports

### 17.1 Available Reports
**Navigation**: Finance → Reports

| Report | Purpose |
|--------|---------|
| Sales Report | Period sales summary |
| Purchase Report | Period purchase summary |
| GST Report | Tax calculations |
| Stock Report | Inventory levels |
| Ledger Report | Party-wise transactions |
| Outstanding Report | Pending payments |
| Aging Report | Overdue amounts |

### 17.2 Generating Reports

1. Select report type
2. Choose date range
3. Select filters (firm, party, etc.)
4. Click **"Generate"**
5. Export to Excel/PDF

### 17.3 Reconciliation Reports
**Navigation**: Finance → Reconciliation

Compare:
- Bank statement vs books
- Physical stock vs system
- GST returns vs books

---

## 18. Troubleshooting

### Common Issues

#### "Cannot finalize purchase"
**Cause**: Missing supplier invoice
**Solution**: Upload invoice first, then ask admin to finalize

#### "Stock not updating"
**Cause**: Purchase not finalized
**Solution**: Ask admin to finalize the purchase

#### "Party not found"
**Cause**: Party not created
**Solution**: Create party in Party Master first

#### "GST mismatch"
**Cause**: Wrong place of supply
**Solution**: Check billing and shipping addresses

#### "Dispatch label rejected"
**Cause**: Tracking number wrong/duplicate
**Solution**: Verify tracking number, re-upload if needed

### Getting Help
- Contact Admin for finalization issues
- Contact IT for system errors
- Email: service@musclegrid.in

---

## Quick Reference Card

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Ctrl + N` | New entry |
| `Ctrl + S` | Save |
| `Ctrl + P` | Print |
| `Esc` | Close dialog |

### Daily Priorities
1. 🔴 **HIGH**: Incoming Queue, Pending Dispatches
2. 🟡 **MEDIUM**: Purchase entries, Sales invoices
3. 🟢 **LOW**: Reports, Reconciliation

### Status Color Codes
- 🟢 Green = Completed/Approved
- 🟡 Yellow = Pending/Draft
- 🔴 Red = Urgent/Overdue
- 🔵 Blue = In Progress

---

**Document End**

*For updates to this manual, contact the system administrator.*

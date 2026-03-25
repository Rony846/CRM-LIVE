# MuscleGrid CRM - Accountant User Manual

## Table of Contents
1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Compliance Management](#compliance-management)
4. [Finance & GST](#finance--gst)
5. [Sales Register](#sales-register)
6. [Purchase Register](#purchase-register)
7. [Party Master](#party-master)
8. [Party Ledger](#party-ledger)
9. [Payments](#payments)
10. [Credit Notes](#credit-notes)
11. [Accounting Reports](#accounting-reports)
12. [Inventory Management](#inventory-management)
13. [Production Management](#production-management)
14. [Dispatch & Fulfillment](#dispatch--fulfillment)
15. [Gate Control](#gate-control)
16. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Login
1. Navigate to the CRM login page
2. Enter your email address (provided by admin)
3. Enter your password
4. Click "Sign In"

### Navigation
- Use the **left sidebar** to navigate between different modules
- The sidebar shows all features available to your role
- Click on any menu item to access that feature

### Your Profile
- Your name appears at the bottom of the sidebar
- Click to access profile settings or logout

---

## Dashboard Overview

The Accountant Dashboard is your home screen showing key metrics at a glance.

### Stats Cards
- **Reverse Pickup**: Items waiting to be picked up from customers
- **Spare Dispatch**: Spare parts to be dispatched
- **Repaired Items**: Items repaired and ready for dispatch
- **Pending Labels**: Dispatches waiting for shipping labels
- **Ready to Ship**: Items ready for outbound shipment

### Compliance Alert Banner
If there are compliance issues, a banner will appear at the top showing:
- Number of open exceptions
- Number of critical issues
- Pending drafts
- Quick action buttons to finalize drafts

### Quick Actions
- View and manage incoming queue
- Process outbound dispatches
- Handle pending items

---

## Compliance Management

Access: **Sidebar > Compliance**

The Compliance Dashboard ensures all transactions have proper documentation.

### Tabs

#### Exceptions Tab
Shows transactions with documentation issues:
- **Filters**: Firm, Type, Status, Severity, Age
- **Actions**: 
  - **Resolve**: Mark an exception as fixed
  - **Override** (Admin only): Bypass compliance with mandatory reason

#### Pending Drafts Tab
Shows transactions saved as drafts:
- Click **Finalize** to complete a draft transaction
- Finalization only succeeds if all required documents are present

#### Compliance Matrix Tab
Reference guide showing required documents for each transaction type:
- Red = Hard block (mandatory)
- Yellow = Soft block (creates exception)
- Blue = Warning (optional)

### Compliance Status
Every transaction shows a compliance status:
- **Complete**: All documents present
- **Pending**: Missing some documents
- **Draft**: Not yet finalized

---

## Finance & GST

Access: **Sidebar > Finance & GST**

Comprehensive GST and financial management dashboard.

### Overview Tab
- **Net ITC Available**: Input Tax Credit available across all firms
- **Total Stock Value**: Current inventory valuation
- **Monthly Sales**: Sales performance
- **Monthly Purchases**: Purchase summary

### Firm Summary Tab
View detailed breakdown by firm:
1. Select a firm from the dropdown
2. View monthly GST liabilities (IGST, CGST, SGST)
3. Track ITC utilization

### Inventory Tab
View inventory valuation:
- Stock quantity by firm
- Cost price valuation
- Movement summary

### Stock Transfers Tab
Manage inter-firm stock transfers:
- View pending transfers
- Track completed transfers

### Actions
- **Record ITC Balance**: Update monthly ITC opening balance
- **Export Report**: Download GST summary as CSV

---

## Sales Register

Access: **Sidebar > Sales Register**

Create and manage sales invoices linked to dispatches.

### Creating a Sales Invoice

1. Click **"New Sales Invoice"** button
2. Fill in required fields:
   - **Firm**: Select the selling firm
   - **Party**: Select customer (must exist in Party Master)
   - **Dispatch**: Link to an existing dispatch
   - **Invoice Date**: Date of invoice
   
3. Add line items:
   - Select item from dispatch
   - Verify quantity and rate
   - GST is calculated automatically based on firm locations

4. Review totals:
   - Subtotal
   - GST breakdown (IGST or CGST+SGST)
   - Grand Total

5. Click **"Create Invoice"** to finalize

### Draft vs Final
- Check **"Save as Draft"** to save without compliance validation
- Drafts can be finalized later from Compliance Dashboard

### Viewing Invoices
- Use filters: Firm, Date Range
- Click the eye icon to view invoice details
- Status column shows: Draft (yellow) or Final (green)

---

## Purchase Register

Access: **Sidebar > Purchase Register**

Record purchases from suppliers with GST compliance.

### Creating a Purchase Entry

1. Click **"New Purchase"** button
2. Fill in supplier details:
   - **Firm**: Purchasing firm
   - **Supplier Name**: Vendor name
   - **Supplier GSTIN**: GST number (optional but recommended)
   - **Supplier State**: For GST calculation
   - **Invoice Number**: Supplier's invoice number
   - **Invoice Date**: Date on supplier invoice

3. Add items:
   - **Item Type**: Raw Material or Master SKU
   - **Item**: Select from dropdown
   - **Quantity**: Number of units
   - **Rate**: Unit price
   - **GST Rate**: 0%, 5%, 12%, 18%, or 28%

4. Add more items using **"+ Add Item"** button

5. Review totals at bottom:
   - Taxable Value
   - GST (IGST or CGST+SGST based on states)
   - Total Amount

6. Click **"Create Purchase"** to finalize

### Compliance Note
- Supplier invoice copy is MANDATORY for finalization
- Without it, you can only save as draft
- Upload invoice document before creating final entry

### Status Badges
- **Draft** (Yellow): Saved but not finalized
- **Final** (Green): Fully processed, stock updated
- **Pending** (Orange): Documentation incomplete

---

## Party Master

Access: **Sidebar > Party Master**

Manage all business parties (customers, suppliers, contractors).

### Creating a New Party

1. Click **"New Party"** button
2. Fill in details:
   - **Name**: Party name (required)
   - **Type**: Customer, Supplier, or Contractor (can select multiple)
   - **GSTIN**: GST registration number
   - **PAN**: PAN number
   - **State Code**: For GST compliance
   - **Contact Details**: Phone, email
   - **Address**: Full address with city, state, pincode

3. Set opening balance (if any existing receivable/payable)
4. Click **"Create Party"**

### Migrating Existing Customers
- Click **"Migrate Customers"** to import existing CRM customers
- This converts them into parties for the accounting system

### Party Types
- **Customer**: Parties you sell to (creates receivables)
- **Supplier**: Parties you buy from (creates payables)
- **Contractor**: Service providers (for repairs, manufacturing)

---

## Party Ledger

Access: **Sidebar > Party Ledger**

View complete transaction history for any party.

### Viewing a Ledger

1. Select a party from the dropdown
2. Optionally set date range filters
3. Click **"Apply Filter"**

### Understanding the Ledger
- **Debit**: Amount party owes you (sales, debit notes)
- **Credit**: Amount you owe party (payments received, credit notes)
- **Running Balance**: Current outstanding amount
- Positive balance = Party owes you
- Negative balance = You owe party

### Entry Types
- **SI-**: Sales Invoice
- **PMT-**: Payment Received
- **CN-**: Credit Note

---

## Payments

Access: **Sidebar > Payments**

Record payments received from customers and payments made to suppliers.

### Recording a Payment

1. Click **"Record Payment"** button
2. Select payment type:
   - **Received**: Payment from customer
   - **Made**: Payment to supplier
   
3. Fill in details:
   - **Party**: Select customer/supplier
   - **Amount**: Payment amount
   - **Payment Date**: Date of payment
   - **Payment Mode**: Cash, Bank Transfer, Cheque, UPI
   - **Reference Number**: UTR, cheque number, etc.
   - **Link to Invoice** (Optional): Connect to specific invoice

4. Add notes if needed
5. Click **"Record Payment"**

### Payment Tabs
- **All**: View all payments
- **Received**: Only payments from customers
- **Made**: Only payments to suppliers

### Stats
- Total payments count
- Payments received (count and total)
- Payments made (count and total)

---

## Credit Notes

Access: **Sidebar > Credit Notes**

Issue credit notes for returns, discounts, or corrections.

### Creating a Credit Note

1. Click **"New Credit Note"** button
2. Select party and firm
3. Enter credit note date
4. Link to original invoice (recommended)
5. Add line items:
   - Description
   - Quantity
   - Rate
   - GST Rate
6. Add reason for credit note
7. Click **"Create Credit Note"**

### When to Issue Credit Notes
- Customer returns goods
- Billing errors on original invoice
- Agreed discounts after invoice
- Quality issues

---

## Accounting Reports

Access: **Sidebar > Reports**

Generate financial reports for analysis and compliance.

### Receivables Report
Shows all outstanding customer payments:
- **Age Analysis**: 0-30, 31-60, 61-90, 90+ days
- **Party-wise breakdown**: Amount due from each customer
- Filter by firm and date range

### Payables Report
Shows all outstanding supplier payments:
- **Supplier-wise breakdown**: Amount due to each supplier
- **Age analysis**: Track overdue payments

### Profit Summary
Overview of financial performance:
- Net sales
- Cost of goods
- Gross profit
- Monthly trends

### Exporting Reports
- Click **"Export CSV"** to download any report
- Reports include all filtered data

---

## Inventory Management

Access: **Sidebar > Inventory**

Manage raw materials and track stock levels.

### Viewing Inventory
- Filter by firm
- See stock quantity, cost price, GST rate
- Track last updated date

### Creating Raw Materials

1. Click **"New Raw Material"** button
2. Fill in details:
   - Name
   - Description
   - Unit of measurement
   - Cost price
   - GST rate
   - Minimum stock level
3. Click **"Create"**

### Stock Adjustments
- Adjustments require a mandatory reason
- High-value adjustments (>₹50,000) create compliance alerts
- All adjustments are logged for audit

---

## Production Management

Access: **Sidebar > Production**

Manage production requests and track manufacturing.

### Production Requests
View all production requests:
- Pending
- In Progress
- Completed

### Creating Production Request
1. Select firm
2. Select Master SKU to produce
3. Enter quantity
4. Add priority and notes
5. Submit request

### Completing Production
When supervisor marks production complete:
- Stock is automatically updated
- Contractor payable may be created

---

## Dispatch & Fulfillment

### Pending Fulfillment
Access: **Sidebar > Pending Fulfillment**

View items ready to be dispatched:
- Items from production
- Items from repairs
- Third-party purchases

### Outbound Dispatch
Access: **Sidebar > Outbound Dispatch**

Process outgoing shipments:
1. Select items to dispatch
2. Upload shipping label
3. Assign courier and tracking ID
4. Complete dispatch

### Upload Labels
Access: **Sidebar > Upload Labels**

Bulk upload shipping labels:
1. Upload label file
2. Match with dispatch entries
3. Labels are attached to dispatches

---

## Gate Control

Access: **Sidebar > Gate Control**

Scan parcels entering and leaving the factory.

### Inward Scan
For parcels arriving at factory:
1. Select **"Inward"** scan type
2. Enter or scan tracking ID
3. Select courier
4. Click **"Scan Inward"**

This updates ticket status to "Received at Factory"

### Outward Scan
For parcels leaving factory:
1. Select **"Outward"** scan type
2. Enter or scan tracking ID
3. Select courier
4. Click **"Scan Outward"**

### Expected Parcels
The dashboard shows:
- **Expected Incoming**: Parcels scheduled to arrive
- **Scheduled Outgoing**: Parcels ready to ship

Click on any expected parcel to auto-fill the tracking ID.

### Recent Scans
View history of all gate scans for the day.

### Barcode Scanner
- The tracking ID field supports hardware barcode scanners
- Simply scan the barcode and it will auto-fill
- Press Enter or click scan button to record

---

## Troubleshooting

### Common Issues

#### "Compliance validation failed"
- Check if all required documents are uploaded
- Review the compliance matrix for that transaction type
- Save as draft if documents are pending

#### "Cannot finalize draft"
- Ensure all mandatory fields are filled
- Upload required documents
- Check for any hard-block compliance issues

#### "Party not found"
- Create the party in Party Master first
- Migrate customers if using existing CRM data

#### "Stock cannot be negative"
- Check current stock levels
- Verify purchase entries are recorded
- Check for pending production completions

### Getting Help

If you encounter issues not covered in this manual:
1. Note the exact error message
2. Note which page/action caused the error
3. Contact your administrator with these details

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Search | Ctrl + K |
| New Entry | Ctrl + N (on supported pages) |
| Save | Ctrl + S |
| Cancel | Escape |

---

## Best Practices

1. **Always verify GSTIN** before creating party entries
2. **Upload documents** before finalizing transactions
3. **Review compliance dashboard** daily
4. **Reconcile payments** weekly
5. **Export reports** monthly for backup
6. **Use draft mode** when documents are pending

---

*Last Updated: March 2026*
*Version: 1.0*

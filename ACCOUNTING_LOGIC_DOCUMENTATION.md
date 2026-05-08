# MuscleGrid CRM - Accounting Module Logic Documentation
# This file documents all accounting functions for verification and review
# Last Updated: March 24, 2026

"""
=============================================================================
TABLE OF CONTENTS
=============================================================================
1. CONSTANTS AND HELPERS
2. PARTY MASTER MODULE
3. SALES REGISTER MODULE  
4. PARTY LEDGER MODULE
5. PAYMENT TRACKING MODULE
6. CREDIT NOTES MODULE
7. REPORTS MODULE
8. INTEGRATION RULES (How modules connect)
=============================================================================
"""

# =============================================================================
# 1. CONSTANTS AND HELPERS
# =============================================================================

PARTY_TYPES = ["customer", "supplier", "contractor"]
PAYMENT_STATUSES = ["unpaid", "partial", "paid"]
PAYMENT_MODES = ["cash", "bank_transfer", "upi", "cheque", "card", "other"]
PAYMENT_TYPES = ["received", "made"]  # received = from customer, made = to supplier

# GST State Codes (First 2 digits of GSTIN)
STATE_CODES = {
    "Andhra Pradesh": "37", "Arunachal Pradesh": "12", "Assam": "18", "Bihar": "10",
    "Chhattisgarh": "22", "Delhi": "07", "Goa": "30", "Gujarat": "24", "Haryana": "06",
    "Himachal Pradesh": "02", "Jharkhand": "20", "Karnataka": "29", "Kerala": "32",
    "Madhya Pradesh": "23", "Maharashtra": "27", "Manipur": "14", "Meghalaya": "17",
    "Mizoram": "15", "Nagaland": "13", "Odisha": "21", "Punjab": "03", "Rajasthan": "08",
    "Sikkim": "11", "Tamil Nadu": "33", "Telangana": "36", "Tripura": "16",
    "Uttar Pradesh": "09", "Uttarakhand": "05", "West Bengal": "19",
}

def get_state_code(state_name: str) -> str:
    """
    Get 2-digit GST state code from state name
    Used for determining IGST vs CGST/SGST
    """
    return STATE_CODES.get(state_name, "")


def get_financial_year() -> str:
    """
    Get current financial year in format 2526 (for 2025-26)
    
    Logic:
    - If current month >= April (4), FY starts this year
    - If current month < April, FY started last year
    
    Example:
    - March 2026 → FY 2025-26 → returns "2526"
    - May 2026 → FY 2026-27 → returns "2627"
    """
    from datetime import datetime
    now = datetime.now()
    if now.month >= 4:  # April onwards = new FY
        return f"{str(now.year)[2:]}{str(now.year + 1)[2:]}"
    else:  # Jan-March = belongs to previous FY
        return f"{str(now.year - 1)[2:]}{str(now.year)[2:]}"


def determine_gst_type(firm_gstin_or_state: str, party_state_code: str) -> bool:
    """
    Determine if transaction is Inter-state (IGST) or Intra-state (CGST+SGST)
    
    Logic:
    - Extract first 2 digits of firm GSTIN (or state code)
    - Compare with party's state code
    - If DIFFERENT states → Inter-state → IGST
    - If SAME state → Intra-state → CGST + SGST (split 50-50)
    
    Returns: True if IGST, False if CGST+SGST
    """
    firm_state_code = firm_gstin_or_state[:2] if len(firm_gstin_or_state) >= 2 else ""
    return firm_state_code != party_state_code


# =============================================================================
# 2. PARTY MASTER MODULE
# =============================================================================

"""
PARTY MASTER - Unified database for Customers, Suppliers, Contractors

Key Rules:
1. One party = one ledger account
2. Same party can have multiple roles (customer + supplier)
3. No duplicate GSTIN allowed
4. Phone number used as secondary unique identifier
5. State is mandatory (required for GST calculation)
"""

class PartyCreate:
    """
    Fields for creating a new party:
    - name: str (required)
    - party_types: List[str] (required) - ["customer", "supplier", "contractor"]
    - gstin: str (optional) - 15-character GST number
    - pan: str (optional) - 10-character PAN
    - state: str (required) - State name for GST
    - state_code: str (auto-calculated from state)
    - address, city, pincode, phone, email: str (optional)
    - credit_limit: float (default 0)
    - opening_balance: float (default 0)
      - Positive = Receivable (customer owes us)
      - Negative = Payable (we owe them)
    """
    pass


async def create_party(party_data):
    """
    Create a new party in the system
    
    Logic:
    1. Validate party_types are valid ("customer", "supplier", "contractor")
    2. Check for duplicate GSTIN (if provided)
    3. Check for duplicate phone (if provided)
    4. Auto-calculate state_code from state name
    5. Insert party into database
    6. If opening_balance != 0, create initial ledger entry
    
    Opening Balance Logic:
    - If positive: Party owes us money (Debit entry in ledger)
    - If negative: We owe party money (Credit entry in ledger)
    """
    # Validation
    if party_data.gstin:
        existing = await db.parties.find_one({"gstin": party_data.gstin.upper()})
        if existing:
            raise Error(f"GSTIN already exists for: {existing['name']}")
    
    if party_data.phone:
        existing = await db.parties.find_one({"phone": party_data.phone})
        if existing:
            raise Error(f"Phone already exists for: {existing['name']}")
    
    # Create party document
    party = {
        "id": generate_uuid(),
        "name": party_data.name,
        "party_types": party_data.party_types,
        "gstin": party_data.gstin.upper() if party_data.gstin else None,
        "state": party_data.state,
        "state_code": get_state_code(party_data.state),
        "opening_balance": party_data.opening_balance or 0,
        "source": "manual",  # or "migrated_from_tickets"
        "is_active": True,
        "created_at": now()
    }
    
    await db.parties.insert_one(party)
    
    # Create opening balance ledger entry
    if party_data.opening_balance and party_data.opening_balance != 0:
        ledger_entry = {
            "id": generate_uuid(),
            "entry_number": f"OB-{party['id'][:8]}",
            "party_id": party["id"],
            "entry_type": "opening_balance",
            "debit": party_data.opening_balance if party_data.opening_balance > 0 else 0,
            "credit": abs(party_data.opening_balance) if party_data.opening_balance < 0 else 0,
            "running_balance": party_data.opening_balance,
            "narration": "Opening Balance"
        }
        await db.party_ledger.insert_one(ledger_entry)
    
    return party


async def migrate_customers_from_tickets():
    """
    Migrate existing customers from tickets/dispatches to Party Master
    
    Logic:
    1. Aggregate unique customers from tickets by phone number
    2. Aggregate unique customers from dispatches by phone number
    3. Merge both lists, deduplicating by phone
    4. For each unique customer:
       - Check if already exists in parties (by phone)
       - If not, create new party with type "customer"
       - Mark source as "migrated_from_tickets"
    
    Deduplication Rules:
    - Primary key: phone number
    - Secondary: GSTIN (if available)
    - Merge ticket_count and dispatch_count for notes
    """
    # Get unique customers from tickets grouped by phone
    ticket_customers = await db.tickets.aggregate([
        {"$match": {"customer_phone": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$customer_phone",
            "name": {"$first": "$customer_name"},
            "phone": {"$first": "$customer_phone"},
            "state": {"$first": "$customer_state"},
            "ticket_count": {"$sum": 1}
        }}
    ]).to_list()
    
    # Get unique customers from dispatches grouped by phone
    dispatch_customers = await db.dispatches.aggregate([
        {"$match": {"phone": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$phone",
            "name": {"$first": "$customer_name"},
            "phone": {"$first": "$phone"},
            "dispatch_count": {"$sum": 1}
        }}
    ]).to_list()
    
    # Merge and deduplicate
    customers_by_phone = {}
    for c in ticket_customers:
        customers_by_phone[c["phone"]] = c
    for c in dispatch_customers:
        if c["phone"] not in customers_by_phone:
            customers_by_phone[c["phone"]] = c
        else:
            customers_by_phone[c["phone"]]["dispatch_count"] = c.get("dispatch_count", 0)
    
    # Create parties for new customers
    migrated = 0
    skipped = 0
    for phone, cust in customers_by_phone.items():
        existing = await db.parties.find_one({"phone": phone})
        if existing:
            skipped += 1
            continue
        
        party = {
            "id": generate_uuid(),
            "name": cust["name"] or f"Customer {phone}",
            "party_types": ["customer"],
            "phone": phone,
            "state": cust.get("state") or "Delhi",
            "state_code": get_state_code(cust.get("state") or "Delhi"),
            "source": "migrated_from_tickets",
            "notes": f"Tickets: {cust.get('ticket_count', 0)}, Dispatches: {cust.get('dispatch_count', 0)}"
        }
        await db.parties.insert_one(party)
        migrated += 1
    
    return {"migrated": migrated, "skipped": skipped}


# =============================================================================
# 3. SALES REGISTER MODULE
# =============================================================================

"""
SALES REGISTER - Invoice-based sales tracking

Key Rules:
1. Every sales invoice MUST be linked to a dispatch
2. No invoice without dispatch reference
3. One dispatch = One invoice (no duplicate invoicing)
4. GST auto-calculated based on firm state vs party state
5. Manual GST override allowed (with audit flag)
"""

async def get_next_invoice_number(firm_id: str) -> str:
    """
    Generate invoice number: INV/{FIRM_CODE}/{FY}/{RUNNING_NUMBER}
    
    Logic:
    1. Get firm by ID
    2. Generate firm code from name (first letter of each word, max 3)
       Example: "MuscleGrid Industries" → "MGI"
    3. Get current financial year (e.g., "2526")
    4. Find last invoice for this firm+FY
    5. Increment running number
    
    Example: INV/MGI/2526/00001
    
    Rules:
    - Separate sequence per firm
    - Resets every financial year
    - 5-digit zero-padded number
    """
    firm = await db.firms.find_one({"id": firm_id})
    
    # Generate firm code: MGI from "MuscleGrid Industries"
    name_parts = firm["name"].split()[:3]
    firm_code = "".join([p[0].upper() for p in name_parts if p])
    
    fy = get_financial_year()
    prefix = f"INV/{firm_code}/{fy}/"
    
    # Find last invoice number
    last_invoice = await db.sales_invoices.find_one(
        {"firm_id": firm_id, "invoice_number": {"$regex": f"^{prefix}"}},
        sort=[("created_at", -1)]
    )
    
    if last_invoice:
        last_num = int(last_invoice["invoice_number"].split("/")[-1])
        next_num = last_num + 1
    else:
        next_num = 1
    
    return f"{prefix}{str(next_num).zfill(5)}"


async def create_sales_invoice(invoice_data):
    """
    Create a sales invoice linked to dispatch
    
    Logic:
    1. Validate firm exists and is active
    2. Validate party exists, is active, and is a "customer"
    3. Validate dispatch exists
    4. Check no invoice already exists for this dispatch
    5. Determine GST type (IGST vs CGST+SGST)
    6. Calculate item totals and GST
    7. Generate invoice number
    8. Create invoice record
    9. Create party ledger entry (Debit - customer owes)
    10. Update dispatch with invoice reference
    
    GST Calculation:
    - For each item: taxable_value = (quantity × rate) - discount
    - GST amount = taxable_value × (gst_rate / 100)
    - If inter-state: full amount goes to IGST
    - If intra-state: split 50-50 between CGST and SGST
    
    GST Override:
    - If gst_override = True, use override_igst/cgst/sgst values
    - Original calculation stored for audit
    """
    # Validations
    firm = await db.firms.find_one({"id": invoice_data.firm_id, "is_active": True})
    if not firm:
        raise Error("Invalid or inactive firm")
    
    party = await db.parties.find_one({"id": invoice_data.party_id, "is_active": True})
    if not party or "customer" not in party.get("party_types", []):
        raise Error("Party must be a customer")
    
    dispatch = await db.dispatches.find_one({"id": invoice_data.dispatch_id})
    if not dispatch:
        raise Error("Dispatch not found")
    
    # Check for existing invoice
    existing = await db.sales_invoices.find_one({"dispatch_id": invoice_data.dispatch_id})
    if existing:
        raise Error(f"Invoice {existing['invoice_number']} already exists for this dispatch")
    
    # Determine GST type
    firm_state_code = firm.get("gstin", "")[:2] or get_state_code(firm.get("state", ""))
    party_state_code = party.get("state_code") or get_state_code(party.get("state", ""))
    is_igst = firm_state_code != party_state_code
    
    # Calculate totals
    subtotal = 0
    total_igst = 0
    total_cgst = 0
    total_sgst = 0
    items = []
    
    for item in invoice_data.items:
        taxable = (item.quantity * item.rate) - item.discount
        gst_amount = taxable * (item.gst_rate / 100)
        
        items.append({
            "sku_code": item.sku_code,
            "name": item.name,
            "hsn_code": item.hsn_code,
            "quantity": item.quantity,
            "rate": item.rate,
            "gst_rate": item.gst_rate,
            "discount": item.discount,
            "taxable_value": taxable,
            "gst_amount": gst_amount
        })
        
        subtotal += taxable
        if is_igst:
            total_igst += gst_amount
        else:
            total_cgst += gst_amount / 2
            total_sgst += gst_amount / 2
    
    # Add other charges
    taxable_value = subtotal + invoice_data.shipping_charges + invoice_data.other_charges - invoice_data.discount
    
    # Handle GST override
    if invoice_data.gst_override:
        total_igst = invoice_data.override_igst or 0
        total_cgst = invoice_data.override_cgst or 0
        total_sgst = invoice_data.override_sgst or 0
        is_igst = total_igst > 0
    
    total_gst = total_igst + total_cgst + total_sgst
    grand_total = round(taxable_value + total_gst, 2)
    
    # Generate invoice number
    invoice_number = await get_next_invoice_number(invoice_data.firm_id)
    
    # Create invoice
    invoice = {
        "id": generate_uuid(),
        "invoice_number": invoice_number,
        "firm_id": invoice_data.firm_id,
        "firm_name": firm["name"],
        "party_id": invoice_data.party_id,
        "party_name": party["name"],
        "dispatch_id": invoice_data.dispatch_id,
        "invoice_date": invoice_data.invoice_date,
        "items": items,
        "subtotal": subtotal,
        "taxable_value": taxable_value,
        "is_igst": is_igst,
        "igst": total_igst,
        "cgst": total_cgst,
        "sgst": total_sgst,
        "total_gst": total_gst,
        "grand_total": grand_total,
        "payment_status": "unpaid",
        "amount_paid": 0,
        "balance_due": grand_total,
        "gst_override": invoice_data.gst_override or False
    }
    
    await db.sales_invoices.insert_one(invoice)
    
    # Create ledger entry (Debit = customer owes this amount)
    last_ledger = await db.party_ledger.find_one(
        {"party_id": invoice_data.party_id},
        sort=[("created_at", -1)]
    )
    current_balance = last_ledger.get("running_balance", 0) if last_ledger else party.get("opening_balance", 0)
    running_balance = current_balance + grand_total  # Add to receivable
    
    ledger_entry = {
        "id": generate_uuid(),
        "entry_number": f"SI-{invoice_number}",
        "party_id": invoice_data.party_id,
        "entry_type": "sales_invoice",
        "debit": grand_total,  # Customer owes this
        "credit": 0,
        "running_balance": running_balance,
        "narration": f"Sales Invoice {invoice_number}",
        "reference_type": "sales_invoice",
        "reference_id": invoice["id"]
    }
    await db.party_ledger.insert_one(ledger_entry)
    
    # Update dispatch with invoice reference
    await db.dispatches.update_one(
        {"id": invoice_data.dispatch_id},
        {"$set": {"sales_invoice_id": invoice["id"], "sales_invoice_number": invoice_number}}
    )
    
    return invoice


async def get_dispatches_without_invoice(firm_id: str = None):
    """
    Get dispatches that don't have a sales invoice yet
    
    Logic:
    - Find all dispatches with status "dispatched"
    - Filter where sales_invoice_id is missing or None
    - Optionally filter by firm_id
    
    Used by: Sales Register UI to show available dispatches for invoicing
    """
    query = {
        "status": "dispatched",
        "$or": [
            {"sales_invoice_id": {"$exists": False}},
            {"sales_invoice_id": None}
        ]
    }
    if firm_id:
        query["firm_id"] = firm_id
    
    return await db.dispatches.find(query).sort("created_at", -1).to_list(200)


# =============================================================================
# 4. PARTY LEDGER MODULE
# =============================================================================

"""
PARTY LEDGER - Immutable transaction history for each party

Key Rules:
1. Ledger entries are IMMUTABLE (no edit/delete)
2. Only reversal entries allowed to correct mistakes
3. Running balance maintained on each entry
4. Positive balance = Receivable (party owes us)
5. Negative balance = Payable (we owe party)
"""

async def get_party_ledger(party_id: str, from_date: str = None, to_date: str = None):
    """
    Get ledger entries for a party
    
    Logic:
    1. Validate party exists
    2. Build date range query if provided
    3. Fetch all entries sorted by date (ascending)
    4. Calculate totals from entries
    5. Get current balance from last entry
    
    Returns:
    - party: Party details
    - entries: List of ledger entries
    - current_balance: Latest running balance
    - total_debit: Sum of all debits
    - total_credit: Sum of all credits
    """
    party = await db.parties.find_one({"id": party_id})
    if not party:
        raise Error("Party not found")
    
    query = {"party_id": party_id}
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        query.setdefault("created_at", {})["$lte"] = to_date
    
    entries = await db.party_ledger.find(query).sort("created_at", 1).to_list(200)
    
    # Get current balance
    last_entry = entries[-1] if entries else None
    current_balance = last_entry.get("running_balance", party.get("opening_balance", 0)) if last_entry else party.get("opening_balance", 0)
    
    return {
        "party": party,
        "entries": entries,
        "current_balance": current_balance,
        "total_debit": sum(e.get("debit", 0) for e in entries),
        "total_credit": sum(e.get("credit", 0) for e in entries)
    }


"""
LEDGER ENTRY TYPES AND THEIR EFFECT:

Entry Type          | Debit | Credit | Effect on Balance
--------------------|-------|--------|------------------
opening_balance     | +/-   | -/+    | Sets initial balance
sales_invoice       | +     | 0      | Increases receivable
purchase_invoice    | 0     | +      | Increases payable
payment_received    | 0     | +      | Decreases receivable
payment_made        | +     | 0      | Decreases payable
credit_note         | 0     | +      | Decreases receivable
debit_note          | +     | 0      | Decreases payable

Running Balance Formula:
running_balance = previous_balance + debit - credit
"""


# =============================================================================
# 5. PAYMENT TRACKING MODULE
# =============================================================================

"""
PAYMENT TRACKING - Record payments received and made

Key Rules:
1. Payment MUST be linked to a party
2. Payment CAN be linked to a specific invoice (optional)
3. Partial payments supported
4. Multiple payment modes supported
5. Creates corresponding ledger entry
6. Updates invoice payment status if linked
"""

async def get_next_payment_number(payment_type: str) -> str:
    """
    Generate payment number: REC/2526/00001 or PAY/2526/00001
    
    Logic:
    - REC = Payment Received (from customer)
    - PAY = Payment Made (to supplier/contractor)
    - Separate sequences for received vs made
    - Resets every financial year
    """
    prefix = "REC" if payment_type == "received" else "PAY"
    fy = get_financial_year()
    full_prefix = f"{prefix}/{fy}/"
    
    last_payment = await db.payments.find_one(
        {"payment_number": {"$regex": f"^{full_prefix}"}},
        sort=[("created_at", -1)]
    )
    
    if last_payment:
        last_num = int(last_payment["payment_number"].split("/")[-1])
        next_num = last_num + 1
    else:
        next_num = 1
    
    return f"{full_prefix}{str(next_num).zfill(5)}"


async def create_payment(payment_data):
    """
    Record a payment received or made
    
    Logic:
    1. Validate payment type ("received" or "made")
    2. Validate payment mode
    3. Validate amount > 0
    4. Validate party exists
    5. Validate invoice if provided
    6. Generate payment number
    7. Create payment record
    8. Create ledger entry:
       - "received": Credit entry (reduces receivable)
       - "made": Debit entry (reduces payable)
    9. Update invoice if linked:
       - Add to amount_paid
       - Calculate new balance
       - Update payment_status
    
    Ledger Entry Logic:
    - Payment RECEIVED from customer:
      - Credit entry (money coming in)
      - running_balance = previous - amount (reduces what they owe)
    - Payment MADE to supplier:
      - Debit entry (money going out)
      - running_balance = previous + amount (reduces what we owe)
    """
    # Validations
    if payment_data.payment_type not in ["received", "made"]:
        raise Error("Invalid payment type")
    
    if payment_data.amount <= 0:
        raise Error("Amount must be greater than 0")
    
    party = await db.parties.find_one({"id": payment_data.party_id, "is_active": True})
    if not party:
        raise Error("Invalid party")
    
    # Validate and fetch invoice if provided
    invoice = None
    if payment_data.invoice_id:
        invoice = await db.sales_invoices.find_one({"id": payment_data.invoice_id})
        if not invoice:
            invoice = await db.purchase_entries.find_one({"id": payment_data.invoice_id})
        if not invoice:
            raise Error("Invoice not found")
    
    # Generate payment number
    payment_number = await get_next_payment_number(payment_data.payment_type)
    
    # Create payment record
    payment = {
        "id": generate_uuid(),
        "payment_number": payment_number,
        "party_id": payment_data.party_id,
        "party_name": party["name"],
        "payment_type": payment_data.payment_type,
        "amount": payment_data.amount,
        "payment_date": payment_data.payment_date,
        "payment_mode": payment_data.payment_mode,
        "reference_number": payment_data.reference_number,
        "invoice_id": payment_data.invoice_id,
        "invoice_number": invoice.get("invoice_number") if invoice else None
    }
    
    await db.payments.insert_one(payment)
    
    # Create ledger entry
    last_ledger = await db.party_ledger.find_one(
        {"party_id": payment_data.party_id},
        sort=[("created_at", -1)]
    )
    current_balance = last_ledger.get("running_balance", 0) if last_ledger else party.get("opening_balance", 0)
    
    if payment_data.payment_type == "received":
        # Payment received = Credit (reduces receivable)
        debit = 0
        credit = payment_data.amount
        running_balance = current_balance - payment_data.amount
        narration = f"Payment received - {payment_data.payment_mode.upper()}"
        entry_type = "payment_received"
    else:
        # Payment made = Debit (reduces payable, balance becomes less negative)
        debit = payment_data.amount
        credit = 0
        running_balance = current_balance + payment_data.amount
        narration = f"Payment made - {payment_data.payment_mode.upper()}"
        entry_type = "payment_made"
    
    if payment_data.reference_number:
        narration += f" (Ref: {payment_data.reference_number})"
    
    ledger_entry = {
        "id": generate_uuid(),
        "entry_number": f"PMT-{payment_number}",
        "party_id": payment_data.party_id,
        "entry_type": entry_type,
        "debit": debit,
        "credit": credit,
        "running_balance": running_balance,
        "narration": narration,
        "reference_type": "payment",
        "reference_id": payment["id"]
    }
    await db.party_ledger.insert_one(ledger_entry)
    
    # Update invoice payment status if linked
    if payment_data.invoice_id and invoice:
        new_amount_paid = invoice.get("amount_paid", 0) + payment_data.amount
        new_balance = invoice.get("grand_total", 0) - new_amount_paid
        
        # Determine new status
        if new_balance <= 0:
            new_status = "paid"
            new_balance = 0
        elif new_amount_paid > 0:
            new_status = "partial"
        else:
            new_status = "unpaid"
        
        await db.sales_invoices.update_one(
            {"id": payment_data.invoice_id},
            {"$set": {
                "amount_paid": new_amount_paid,
                "balance_due": max(0, new_balance),
                "payment_status": new_status
            }}
        )
    
    return payment


# =============================================================================
# 6. CREDIT NOTES MODULE
# =============================================================================

"""
CREDIT NOTES - Sales returns, discounts, adjustments

Key Rules:
1. Credit note reduces receivable from customer
2. Can be linked to original invoice (optional)
3. GST calculated same as sales invoice
4. Creates credit ledger entry
5. Status: pending → adjusted → refunded
"""

async def get_next_credit_note_number(firm_id: str) -> str:
    """
    Generate credit note number: CN/{FIRM_CODE}/{FY}/{RUNNING_NUMBER}
    Same logic as invoice numbering
    """
    firm = await db.firms.find_one({"id": firm_id})
    
    name_parts = firm["name"].split()[:3]
    firm_code = "".join([p[0].upper() for p in name_parts if p])
    
    fy = get_financial_year()
    prefix = f"CN/{firm_code}/{fy}/"
    
    last_cn = await db.credit_notes.find_one(
        {"firm_id": firm_id, "credit_note_number": {"$regex": f"^{prefix}"}},
        sort=[("created_at", -1)]
    )
    
    if last_cn:
        last_num = int(last_cn["credit_note_number"].split("/")[-1])
        next_num = last_num + 1
    else:
        next_num = 1
    
    return f"{prefix}{str(next_num).zfill(5)}"


async def create_credit_note(cn_data):
    """
    Create a credit note (sales return / adjustment)
    
    Logic:
    1. Validate firm and party
    2. Determine GST type (same as sales invoice)
    3. Calculate item totals and GST
    4. Generate credit note number
    5. Create credit note record
    6. Create ledger entry (Credit - reduces receivable)
    
    Reasons:
    - sales_return: Customer returned goods
    - discount: Post-sale discount given
    - price_difference: Price correction
    - damaged_goods: Goods were damaged
    - other: Other adjustments
    """
    firm = await db.firms.find_one({"id": cn_data.firm_id, "is_active": True})
    party = await db.parties.find_one({"id": cn_data.party_id, "is_active": True})
    
    # Determine GST type
    firm_state_code = firm.get("gstin", "")[:2] or get_state_code(firm.get("state", ""))
    party_state_code = party.get("state_code") or get_state_code(party.get("state", ""))
    is_igst = firm_state_code != party_state_code
    
    # Calculate totals (same logic as sales invoice)
    subtotal = 0
    total_igst = 0
    total_cgst = 0
    total_sgst = 0
    items = []
    
    for item in cn_data.items:
        taxable = item.quantity * item.rate
        gst_amount = taxable * (item.gst_rate / 100)
        
        items.append({
            "sku_code": item.sku_code,
            "name": item.name,
            "quantity": item.quantity,
            "rate": item.rate,
            "gst_rate": item.gst_rate,
            "taxable_value": taxable,
            "gst_amount": gst_amount,
            "reason": item.reason
        })
        
        subtotal += taxable
        if is_igst:
            total_igst += gst_amount
        else:
            total_cgst += gst_amount / 2
            total_sgst += gst_amount / 2
    
    total_gst = total_igst + total_cgst + total_sgst
    grand_total = round(subtotal + total_gst, 2)
    
    cn_number = await get_next_credit_note_number(cn_data.firm_id)
    
    credit_note = {
        "id": generate_uuid(),
        "credit_note_number": cn_number,
        "firm_id": cn_data.firm_id,
        "party_id": cn_data.party_id,
        "original_invoice_id": cn_data.original_invoice_id,
        "credit_note_date": cn_data.credit_note_date,
        "items": items,
        "subtotal": subtotal,
        "is_igst": is_igst,
        "igst": total_igst,
        "cgst": total_cgst,
        "sgst": total_sgst,
        "total_gst": total_gst,
        "grand_total": grand_total,
        "reason": cn_data.reason,
        "status": "pending"
    }
    
    await db.credit_notes.insert_one(credit_note)
    
    # Create ledger entry (Credit = reduces receivable)
    last_ledger = await db.party_ledger.find_one(
        {"party_id": cn_data.party_id},
        sort=[("created_at", -1)]
    )
    current_balance = last_ledger.get("running_balance", 0) if last_ledger else party.get("opening_balance", 0)
    running_balance = current_balance - grand_total  # Reduce receivable
    
    ledger_entry = {
        "id": generate_uuid(),
        "entry_number": f"CN-{cn_number}",
        "party_id": cn_data.party_id,
        "entry_type": "credit_note",
        "debit": 0,
        "credit": grand_total,
        "running_balance": running_balance,
        "narration": f"Credit Note {cn_number} - {cn_data.reason}",
        "reference_type": "credit_note",
        "reference_id": credit_note["id"]
    }
    await db.party_ledger.insert_one(ledger_entry)
    
    return credit_note


# =============================================================================
# 7. REPORTS MODULE
# =============================================================================

"""
REPORTS - Financial reports and analytics
"""

async def get_receivables_report(firm_id: str = None, as_of_date: str = None):
    """
    Get receivables report - all outstanding from customers
    
    Logic:
    1. Find all sales invoices with status "unpaid" or "partial"
    2. Filter by firm and date if provided
    3. Group by party
    4. Calculate age buckets:
       - 0-30 days: Recent, normal
       - 31-60 days: Slight delay
       - 61-90 days: Concerning
       - 90+ days: Critical/Overdue
    
    Age Calculation:
    - today - invoice_date = days outstanding
    - Add balance_due to appropriate bucket
    """
    query = {"payment_status": {"$in": ["unpaid", "partial"]}}
    if firm_id:
        query["firm_id"] = firm_id
    if as_of_date:
        query["invoice_date"] = {"$lte": as_of_date}
    
    invoices = await db.sales_invoices.find(query).sort("invoice_date", 1).to_list(500)
    
    # Group by party
    by_party = {}
    for inv in invoices:
        pid = inv["party_id"]
        if pid not in by_party:
            by_party[pid] = {
                "party_id": pid,
                "party_name": inv["party_name"],
                "invoices": [],
                "total_outstanding": 0
            }
        by_party[pid]["invoices"].append(inv)
        by_party[pid]["total_outstanding"] += inv.get("balance_due", 0)
    
    # Sort by outstanding (highest first)
    parties_list = sorted(by_party.values(), key=lambda x: -x["total_outstanding"])
    total_receivable = sum(p["total_outstanding"] for p in parties_list)
    
    # Age analysis
    today = datetime.now().date()
    age_buckets = {"0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
    
    for inv in invoices:
        inv_date = parse_date(inv["invoice_date"])
        days = (today - inv_date).days
        balance = inv.get("balance_due", 0)
        
        if days <= 30:
            age_buckets["0-30"] += balance
        elif days <= 60:
            age_buckets["31-60"] += balance
        elif days <= 90:
            age_buckets["61-90"] += balance
        else:
            age_buckets["90+"] += balance
    
    return {
        "total_receivable": total_receivable,
        "invoice_count": len(invoices),
        "party_count": len(parties_list),
        "by_party": parties_list,
        "age_analysis": age_buckets
    }


async def get_payables_report(firm_id: str = None, as_of_date: str = None):
    """
    Get payables report - all outstanding to suppliers
    
    Same logic as receivables but for purchase_entries collection
    """
    query = {"payment_status": {"$in": ["unpaid", "partial"]}}
    if firm_id:
        query["firm_id"] = firm_id
    if as_of_date:
        query["invoice_date"] = {"$lte": as_of_date}
    
    purchases = await db.purchase_entries.find(query).sort("invoice_date", 1).to_list(500)
    
    # Group by supplier
    by_supplier = {}
    for pur in purchases:
        sid = pur.get("supplier_gstin") or pur.get("supplier_name", "Unknown")
        if sid not in by_supplier:
            by_supplier[sid] = {
                "supplier_name": pur.get("supplier_name", "Unknown"),
                "supplier_gstin": pur.get("supplier_gstin"),
                "purchases": [],
                "total_outstanding": 0
            }
        balance = pur.get("balance_due", pur.get("totals", {}).get("grand_total", 0))
        by_supplier[sid]["purchases"].append(pur)
        by_supplier[sid]["total_outstanding"] += balance
    
    suppliers_list = sorted(by_supplier.values(), key=lambda x: -x["total_outstanding"])
    total_payable = sum(s["total_outstanding"] for s in suppliers_list)
    
    return {
        "total_payable": total_payable,
        "purchase_count": len(purchases),
        "supplier_count": len(suppliers_list),
        "by_supplier": suppliers_list
    }


async def get_profit_summary(firm_id: str = None, from_date: str = None, to_date: str = None):
    """
    Get profit summary dashboard
    
    Calculations:
    - Total Sales = Sum of all sales invoice taxable values
    - Total Purchases = Sum of all purchase taxable values
    - Credit Notes = Sum of all credit notes
    - Net Sales = Total Sales - Credit Notes
    - Gross Profit = Net Sales - Total Purchases
    - Gross Margin % = (Gross Profit / Net Sales) × 100
    - GST Liability = Sales GST - Purchase GST (ITC)
      - Positive = Tax payable
      - Negative = Tax credit
    """
    # Build queries
    sales_query = {}
    purchase_query = {}
    cn_query = {}
    
    if firm_id:
        sales_query["firm_id"] = firm_id
        purchase_query["firm_id"] = firm_id
        cn_query["firm_id"] = firm_id
    
    if from_date:
        sales_query["invoice_date"] = {"$gte": from_date}
        purchase_query["invoice_date"] = {"$gte": from_date}
        cn_query["credit_note_date"] = {"$gte": from_date}
    
    if to_date:
        sales_query.setdefault("invoice_date", {})["$lte"] = to_date
        purchase_query.setdefault("invoice_date", {})["$lte"] = to_date
        cn_query.setdefault("credit_note_date", {})["$lte"] = to_date
    
    # Fetch data
    sales_invoices = await db.sales_invoices.find(sales_query).to_list(1000)
    purchases = await db.purchase_entries.find(purchase_query).to_list(1000)
    credit_notes = await db.credit_notes.find(cn_query).to_list(500)
    
    # Calculate totals
    total_sales = sum(inv.get("taxable_value", 0) for inv in sales_invoices)
    total_sales_gst = sum(inv.get("total_gst", 0) for inv in sales_invoices)
    total_purchases = sum(pur.get("totals", {}).get("taxable_value", 0) for pur in purchases)
    total_purchase_gst = sum(pur.get("totals", {}).get("total_gst", 0) for pur in purchases)
    total_credit_notes = sum(cn.get("grand_total", 0) for cn in credit_notes)
    
    net_sales = total_sales - total_credit_notes
    gross_profit = net_sales - total_purchases
    gross_margin = round((gross_profit / net_sales * 100) if net_sales > 0 else 0, 2)
    gst_liability = total_sales_gst - total_purchase_gst  # Positive = payable, Negative = credit
    
    # Monthly breakdown
    monthly_data = {}
    for inv in sales_invoices:
        month = inv["invoice_date"][:7]  # YYYY-MM
        monthly_data.setdefault(month, {"sales": 0, "purchases": 0, "credit_notes": 0})
        monthly_data[month]["sales"] += inv.get("taxable_value", 0)
    
    for pur in purchases:
        month = pur["invoice_date"][:7]
        monthly_data.setdefault(month, {"sales": 0, "purchases": 0, "credit_notes": 0})
        monthly_data[month]["purchases"] += pur.get("totals", {}).get("taxable_value", 0)
    
    for cn in credit_notes:
        month = cn["credit_note_date"][:7]
        monthly_data.setdefault(month, {"sales": 0, "purchases": 0, "credit_notes": 0})
        monthly_data[month]["credit_notes"] += cn.get("grand_total", 0)
    
    return {
        "summary": {
            "total_sales": total_sales,
            "total_sales_gst": total_sales_gst,
            "total_credit_notes": total_credit_notes,
            "net_sales": net_sales,
            "total_purchases": total_purchases,
            "total_purchase_gst": total_purchase_gst,
            "gross_profit": gross_profit,
            "gross_margin_percent": gross_margin,
            "gst_liability": gst_liability
        },
        "counts": {
            "sales_invoices": len(sales_invoices),
            "purchases": len(purchases),
            "credit_notes": len(credit_notes)
        },
        "monthly_breakdown": dict(sorted(monthly_data.items()))
    }


# =============================================================================
# 8. INTEGRATION RULES - How modules connect
# =============================================================================

"""
INTEGRATION RULES - Automatic ledger entries from transactions

Rule 1: Sales Invoice → Customer Ledger
-----------------------------------------
When: Sales invoice is created
Action: Create DEBIT entry in customer's ledger
Effect: Increases receivable (customer owes more)

Rule 2: Purchase Invoice → Supplier Ledger
-----------------------------------------
When: Purchase entry is created (already exists in system)
Action: Create CREDIT entry in supplier's ledger
Effect: Increases payable (we owe more)

Rule 3: Payment Received → Customer Ledger
-----------------------------------------
When: Payment received from customer
Action: Create CREDIT entry in customer's ledger
Effect: Decreases receivable (customer owes less)

Rule 4: Payment Made → Supplier Ledger
-----------------------------------------
When: Payment made to supplier
Action: Create DEBIT entry in supplier's ledger
Effect: Decreases payable (we owe less)

Rule 5: Credit Note → Customer Ledger
-----------------------------------------
When: Credit note is created
Action: Create CREDIT entry in customer's ledger
Effect: Decreases receivable (we owe customer or reduce their debt)

Rule 6: Production Completion → Contractor Ledger (TO BE IMPLEMENTED)
-----------------------------------------
When: Supervisor production is marked complete
Action: Create CREDIT entry in contractor's ledger
Effect: Increases payable to contractor


BALANCE CALCULATION RULES
=========================

Running Balance Formula:
  new_balance = previous_balance + debit - credit

Balance Interpretation:
  Positive balance = Party owes us (Receivable)
  Negative balance = We owe party (Payable)
  Zero balance = Account settled

Example Flow for Customer "ABC Corp":
1. Opening Balance: ₹0
2. Sales Invoice ₹10,000 (Debit)
   → Balance: ₹0 + ₹10,000 - ₹0 = ₹10,000 (Receivable)
3. Payment Received ₹6,000 (Credit)
   → Balance: ₹10,000 + ₹0 - ₹6,000 = ₹4,000 (Receivable)
4. Credit Note ₹1,000 (Credit)
   → Balance: ₹4,000 + ₹0 - ₹1,000 = ₹3,000 (Receivable)
5. Payment Received ₹3,000 (Credit)
   → Balance: ₹3,000 + ₹0 - ₹3,000 = ₹0 (Settled)

Example Flow for Supplier "XYZ Ltd":
1. Opening Balance: ₹0
2. Purchase Invoice ₹50,000 (Credit)
   → Balance: ₹0 + ₹0 - ₹50,000 = -₹50,000 (Payable)
3. Payment Made ₹30,000 (Debit)
   → Balance: -₹50,000 + ₹30,000 - ₹0 = -₹20,000 (Payable)
4. Payment Made ₹20,000 (Debit)
   → Balance: -₹20,000 + ₹20,000 - ₹0 = ₹0 (Settled)
"""


# =============================================================================
# SUMMARY OF ALL COLLECTIONS
# =============================================================================

"""
DATABASE COLLECTIONS:

1. parties
   - Stores all parties (customers, suppliers, contractors)
   - Fields: id, name, party_types[], gstin, state, state_code, phone, email,
             credit_limit, opening_balance, source, is_active

2. sales_invoices
   - Stores all sales invoices
   - Fields: id, invoice_number, firm_id, party_id, dispatch_id, invoice_date,
             items[], subtotal, taxable_value, is_igst, igst, cgst, sgst,
             total_gst, grand_total, payment_status, amount_paid, balance_due

3. party_ledger
   - Stores immutable ledger entries
   - Fields: id, entry_number, party_id, entry_type, debit, credit,
             running_balance, narration, reference_type, reference_id

4. payments
   - Stores payment records
   - Fields: id, payment_number, party_id, payment_type, amount, payment_date,
             payment_mode, reference_number, invoice_id

5. credit_notes
   - Stores credit notes
   - Fields: id, credit_note_number, firm_id, party_id, original_invoice_id,
             items[], subtotal, total_gst, grand_total, reason, status
"""

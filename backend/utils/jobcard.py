"""
MuscleGrid CRM - Ticket Jobcard PDF Generator
Generates professional 2-page PDF jobcards for customer complaints/tickets
Page 1: Ticket/Jobcard details
Page 2: Customer uploaded invoice
"""

import os
import io
import base64
import logging
from datetime import datetime
from typing import Optional, Dict, Any

from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

logger = logging.getLogger("jobcard")

# Company details
COMPANY_NAME = "MuscleGrid Industries Private Limited"
COMPANY_ADDRESS = "24, B2, Neb Sarai, New Delhi 110068"
COMPANY_GST = "07AATCM1213F1ZM"
COMPANY_EMAIL = "service@musclegrid.in"
COMPANY_PHONE = "+91 98000 06416"


def generate_ticket_jobcard_pdf(
    ticket: Dict[str, Any],
    invoice_base64: Optional[str] = None
) -> bytes:
    """
    Generate a professional 2-page PDF jobcard for a ticket
    
    Args:
        ticket: Ticket document from database
        invoice_base64: Optional base64-encoded invoice image to embed on page 2
        
    Returns:
        PDF file as bytes
    """
    
    # Extract ticket details
    ticket_id = ticket.get("id", "N/A")
    ticket_number = ticket.get("ticket_number", ticket_id[:8].upper())
    created_at = ticket.get("created_at", "")
    if isinstance(created_at, str) and created_at:
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            created_date = dt.strftime("%d %b %Y, %I:%M %p")
        except:
            created_date = created_at[:10] if len(created_at) >= 10 else created_at
    else:
        created_date = str(created_at)[:10] if created_at else "N/A"
    
    # Customer details
    customer_name = ticket.get("customer_name", "N/A")
    customer_phone = ticket.get("customer_phone", "N/A")
    customer_email = ticket.get("customer_email", "N/A")
    customer_address = ticket.get("customer_address", "N/A")
    city = ticket.get("city", ticket.get("customer_city", ""))
    state = ticket.get("state", "")
    pincode = ticket.get("pincode", "")
    
    full_address = customer_address if customer_address else ""
    if city or state or pincode:
        full_address += f", {city} {state} {pincode}".strip()
    if not full_address:
        full_address = "N/A"
    
    # Product details
    product_name = ticket.get("product_name", "N/A")
    device_type = ticket.get("device_type", "N/A")
    serial_number = ticket.get("serial_number", "N/A")
    invoice_number = ticket.get("invoice_number", "N/A")
    
    # Issue details
    issue_description = ticket.get("issue_description", "N/A")
    status = ticket.get("status", "N/A").replace("_", " ").title()
    support_type = ticket.get("support_type", "phone").title()
    
    # Service details
    warranty_status = "Under Warranty" if ticket.get("is_under_warranty") else "Out of Warranty"
    
    # Page 2: Invoice section
    invoice_page = ""
    if invoice_base64:
        # Check if it's PDF or image
        if invoice_base64.startswith("data:application/pdf"):
            invoice_page = """
            <div class="page invoice-page">
                <div class="page-header">
                    <h2>CUSTOMER INVOICE</h2>
                    <p class="ticket-ref">Ticket: #{ticket_number}</p>
                </div>
                <div class="invoice-notice">
                    <p>The customer has uploaded a PDF invoice.</p>
                    <p>Please refer to the original invoice file attached to this ticket.</p>
                    <p class="file-note">File available at: /api/files/invoices/...</p>
                </div>
                <div class="page-footer">
                    <p>{company_name} | {company_phone} | {company_email}</p>
                </div>
            </div>
            """.format(
                ticket_number=ticket_number,
                company_name=COMPANY_NAME,
                company_phone=COMPANY_PHONE,
                company_email=COMPANY_EMAIL
            )
        else:
            # It's an image - embed it
            invoice_page = f"""
            <div class="page invoice-page">
                <div class="page-header">
                    <h2>CUSTOMER INVOICE</h2>
                    <p class="ticket-ref">Ticket: #{ticket_number}</p>
                </div>
                <div class="invoice-container">
                    <img src="{invoice_base64}" alt="Customer Invoice" class="invoice-image"/>
                </div>
                <div class="page-footer">
                    <p>{COMPANY_NAME} | {COMPANY_PHONE} | {COMPANY_EMAIL}</p>
                </div>
            </div>
            """
    else:
        # No invoice uploaded
        invoice_page = f"""
        <div class="page invoice-page">
            <div class="page-header">
                <h2>CUSTOMER INVOICE</h2>
                <p class="ticket-ref">Ticket: #{ticket_number}</p>
            </div>
            <div class="no-invoice">
                <p>No invoice was uploaded by the customer at the time of ticket creation.</p>
            </div>
            <div class="page-footer">
                <p>{COMPANY_NAME} | {COMPANY_PHONE} | {COMPANY_EMAIL}</p>
            </div>
        </div>
        """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Ticket Jobcard - {ticket_number}</title>
    </head>
    <body>
        <!-- PAGE 1: JOBCARD DETAILS -->
        <div class="page jobcard-page">
            <!-- Header -->
            <div class="header">
                <div class="logo-section">
                    <h1 class="company-name">MUSCLEGRID</h1>
                    <p class="company-full">{COMPANY_NAME}</p>
                </div>
                <div class="jobcard-title">
                    <h2>SERVICE JOBCARD</h2>
                    <p class="ticket-number">#{ticket_number}</p>
                </div>
            </div>
            
            <!-- Company Info Bar -->
            <div class="company-bar">
                <span>{COMPANY_ADDRESS}</span>
                <span>GST: {COMPANY_GST}</span>
                <span>{COMPANY_PHONE}</span>
            </div>
            
            <!-- Ticket Meta -->
            <div class="meta-row">
                <div class="meta-item">
                    <label>Date:</label>
                    <span>{created_date}</span>
                </div>
                <div class="meta-item">
                    <label>Status:</label>
                    <span class="status-badge">{status}</span>
                </div>
                <div class="meta-item">
                    <label>Support:</label>
                    <span>{support_type}</span>
                </div>
                <div class="meta-item">
                    <label>Warranty:</label>
                    <span>{warranty_status}</span>
                </div>
            </div>
            
            <!-- Two Column Layout -->
            <div class="two-columns">
                <!-- Customer Details -->
                <div class="column">
                    <h3 class="section-title">Customer Details</h3>
                    <table class="details-table">
                        <tr>
                            <td class="label">Name:</td>
                            <td>{customer_name}</td>
                        </tr>
                        <tr>
                            <td class="label">Phone:</td>
                            <td>{customer_phone}</td>
                        </tr>
                        <tr>
                            <td class="label">Email:</td>
                            <td>{customer_email}</td>
                        </tr>
                        <tr>
                            <td class="label">Address:</td>
                            <td>{full_address}</td>
                        </tr>
                    </table>
                </div>
                
                <!-- Product Details -->
                <div class="column">
                    <h3 class="section-title">Product Details</h3>
                    <table class="details-table">
                        <tr>
                            <td class="label">Product:</td>
                            <td>{product_name}</td>
                        </tr>
                        <tr>
                            <td class="label">Device:</td>
                            <td>{device_type}</td>
                        </tr>
                        <tr>
                            <td class="label">Serial No:</td>
                            <td>{serial_number}</td>
                        </tr>
                        <tr>
                            <td class="label">Invoice No:</td>
                            <td>{invoice_number}</td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <!-- Issue Details -->
            <div class="issue-section">
                <h3 class="section-title">Issue Description</h3>
                <div class="description-box">{issue_description}</div>
            </div>
            
            <!-- Service Notes Section (Empty for filling) -->
            <div class="notes-section">
                <h3 class="section-title">Service Notes</h3>
                <div class="notes-box"></div>
            </div>
            
            <!-- Signature Section -->
            <div class="signature-section">
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <p>Customer Signature</p>
                </div>
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <p>Technician Signature</p>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="page-footer">
                <p>This is a computer-generated document. For support, contact {COMPANY_EMAIL}</p>
                <p class="ticket-id">Ticket ID: {ticket_id}</p>
            </div>
        </div>
        
        <!-- PAGE 2: CUSTOMER INVOICE -->
        {invoice_page}
    </body>
    </html>
    """
    
    css = CSS(string="""
        @page {
            size: A4;
            margin: 12mm;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #333;
        }
        
        .page {
            page-break-after: always;
            min-height: 100%;
        }
        
        .page:last-child {
            page-break-after: auto;
        }
        
        /* Header Styles */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #1a1a2e;
            padding-bottom: 10px;
            margin-bottom: 10px;
        }
        
        .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #1a1a2e;
            letter-spacing: 2px;
        }
        
        .company-full {
            font-size: 9px;
            color: #666;
            margin-top: 2px;
        }
        
        .jobcard-title h2 {
            font-size: 16px;
            color: #1a1a2e;
            text-align: right;
        }
        
        .ticket-number {
            font-size: 22px;
            font-weight: bold;
            color: #e74c3c;
            text-align: right;
        }
        
        .company-bar {
            background: #f5f5f5;
            padding: 8px 15px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #666;
            margin-bottom: 12px;
            border-radius: 4px;
        }
        
        .meta-row {
            display: flex;
            justify-content: space-between;
            background: #1a1a2e;
            color: white;
            padding: 10px 15px;
            border-radius: 4px;
            margin-bottom: 15px;
        }
        
        .meta-item label {
            font-size: 9px;
            opacity: 0.8;
            display: block;
        }
        
        .meta-item span {
            font-weight: bold;
            font-size: 11px;
        }
        
        .status-badge {
            background: #27ae60;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 10px;
        }
        
        .two-columns {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
        }
        
        .column {
            flex: 1;
        }
        
        .section-title {
            font-size: 12px;
            font-weight: bold;
            color: #1a1a2e;
            border-bottom: 2px solid #e74c3c;
            padding-bottom: 5px;
            margin-bottom: 10px;
        }
        
        .details-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .details-table td {
            padding: 5px 0;
            border-bottom: 1px solid #eee;
            vertical-align: top;
        }
        
        .details-table .label {
            font-weight: bold;
            color: #666;
            width: 80px;
        }
        
        .issue-section {
            margin-bottom: 15px;
        }
        
        .description-box {
            background: #f9f9f9;
            padding: 10px;
            border-radius: 4px;
            min-height: 60px;
            border: 1px solid #eee;
            white-space: pre-wrap;
        }
        
        .notes-section {
            margin-bottom: 15px;
        }
        
        .notes-box {
            border: 1px solid #ccc;
            border-radius: 4px;
            min-height: 80px;
            background: #fafafa;
        }
        
        .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 25px;
            padding-top: 15px;
        }
        
        .signature-box {
            width: 45%;
            text-align: center;
        }
        
        .signature-line {
            border-bottom: 1px solid #333;
            height: 40px;
            margin-bottom: 5px;
        }
        
        .signature-box p {
            font-size: 10px;
            color: #666;
        }
        
        .page-footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 9px;
            color: #999;
        }
        
        .ticket-id {
            font-family: monospace;
            font-size: 8px;
            color: #ccc;
            margin-top: 5px;
        }
        
        /* Page 2 - Invoice Styles */
        .invoice-page {
            display: flex;
            flex-direction: column;
        }
        
        .page-header {
            text-align: center;
            border-bottom: 3px solid #1a1a2e;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        
        .page-header h2 {
            font-size: 24px;
            color: #1a1a2e;
            margin-bottom: 5px;
        }
        
        .ticket-ref {
            font-size: 14px;
            color: #e74c3c;
            font-weight: bold;
        }
        
        .invoice-container {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 10px;
        }
        
        .invoice-image {
            max-width: 100%;
            max-height: 700px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .invoice-notice {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 50px;
            background: #f9f9f9;
            border-radius: 8px;
            margin: 20px;
        }
        
        .invoice-notice p {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
        }
        
        .file-note {
            font-family: monospace;
            font-size: 11px;
            color: #999;
            background: #eee;
            padding: 8px 15px;
            border-radius: 4px;
            margin-top: 15px;
        }
        
        .no-invoice {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 50px;
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 8px;
            margin: 20px;
        }
        
        .no-invoice p {
            font-size: 14px;
            color: #856404;
        }
    """)
    
    font_config = FontConfiguration()
    html = HTML(string=html_content)
    pdf_bytes = html.write_pdf(stylesheets=[css], font_config=font_config)
    
    return pdf_bytes


async def create_and_upload_jobcard(ticket: Dict[str, Any], invoice_data: Optional[bytes] = None) -> str:
    """
    Create 2-page jobcard PDF and upload to NAS
    
    Args:
        ticket: Ticket document
        invoice_data: Optional invoice file bytes for page 2
        
    Returns:
        Path to uploaded jobcard on NAS
    """
    from utils.storage import upload_file
    
    # Convert invoice to base64 if provided
    invoice_base64 = None
    if invoice_data:
        # Detect file type and create data URL
        if invoice_data[:4] == b'%PDF':
            invoice_base64 = f"data:application/pdf;base64,{base64.b64encode(invoice_data).decode()}"
        elif invoice_data[:8] == b'\x89PNG\r\n\x1a\n':
            invoice_base64 = f"data:image/png;base64,{base64.b64encode(invoice_data).decode()}"
        elif invoice_data[:2] == b'\xff\xd8':
            invoice_base64 = f"data:image/jpeg;base64,{base64.b64encode(invoice_data).decode()}"
        else:
            # Try as generic image
            invoice_base64 = f"data:image/jpeg;base64,{base64.b64encode(invoice_data).decode()}"
    
    # Generate 2-page PDF
    pdf_bytes = generate_ticket_jobcard_pdf(ticket, invoice_base64)
    
    # Upload to NAS - stored in tickets folder with jobcard_ prefix
    ticket_id = ticket.get("id", "unknown")
    path, _ = await upload_file(
        file_data=pdf_bytes,
        folder="jobcards",  # Will be mapped to "tickets" folder
        original_filename=f"jobcard_{ticket_id}.pdf",
        filename_prefix="jobcard"
    )
    
    return path

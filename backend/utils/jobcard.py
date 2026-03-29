"""
MuscleGrid CRM - Ticket Jobcard PDF Generator
Generates professional PDF jobcards for customer complaints/tickets
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
    Generate a professional PDF jobcard for a ticket
    
    Args:
        ticket: Ticket document from database
        invoice_base64: Optional base64-encoded invoice image/PDF to embed
        
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
    city = ticket.get("city", "")
    state = ticket.get("state", "")
    pincode = ticket.get("pincode", "")
    
    full_address = customer_address
    if city or state or pincode:
        full_address += f", {city} {state} {pincode}".strip()
    
    # Product details
    product_name = ticket.get("product_name", "N/A")
    product_category = ticket.get("product_category", "N/A")
    serial_number = ticket.get("serial_number", "N/A")
    purchase_date = ticket.get("purchase_date", "N/A")
    
    # Issue details
    issue_type = ticket.get("issue_type", "N/A")
    issue_description = ticket.get("issue_description", "N/A")
    status = ticket.get("status", "N/A").replace("_", " ").title()
    priority = ticket.get("priority", "normal").title()
    
    # Service details
    warranty_status = "Under Warranty" if ticket.get("is_under_warranty") else "Out of Warranty"
    service_type = ticket.get("service_type", "N/A")
    
    # Invoice image section
    invoice_section = ""
    if invoice_base64:
        # Determine if it's a PDF or image
        if invoice_base64.startswith("data:application/pdf"):
            invoice_section = """
            <div class="invoice-section">
                <h3>Customer Invoice</h3>
                <p class="note">PDF invoice attached separately</p>
            </div>
            """
        else:
            # It's an image
            invoice_section = f"""
            <div class="invoice-section">
                <h3>Customer Invoice</h3>
                <img src="{invoice_base64}" alt="Customer Invoice" class="invoice-image"/>
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
        <div class="container">
            <!-- Header -->
            <div class="header">
                <div class="logo-section">
                    <h1 class="company-name">MUSCLEGRID</h1>
                    <p class="tagline">Power Solutions</p>
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
                    <label>Priority:</label>
                    <span class="priority-{priority.lower()}">{priority}</span>
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
                            <td class="label">Category:</td>
                            <td>{product_category}</td>
                        </tr>
                        <tr>
                            <td class="label">Serial No:</td>
                            <td>{serial_number}</td>
                        </tr>
                        <tr>
                            <td class="label">Purchase Date:</td>
                            <td>{purchase_date}</td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <!-- Issue Details -->
            <div class="issue-section">
                <h3 class="section-title">Issue Details</h3>
                <table class="details-table full-width">
                    <tr>
                        <td class="label" style="width: 120px;">Issue Type:</td>
                        <td>{issue_type}</td>
                    </tr>
                    <tr>
                        <td class="label">Service Type:</td>
                        <td>{service_type}</td>
                    </tr>
                    <tr>
                        <td class="label">Description:</td>
                        <td class="description">{issue_description}</td>
                    </tr>
                </table>
            </div>
            
            {invoice_section}
            
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
            <div class="footer">
                <p>This is a computer-generated document. For support, contact {COMPANY_EMAIL}</p>
                <p class="ticket-id">Ticket ID: {ticket_id}</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    css = CSS(string="""
        @page {
            size: A4;
            margin: 15mm;
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
        
        .container {
            width: 100%;
        }
        
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
        
        .tagline {
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 3px;
        }
        
        .jobcard-title h2 {
            font-size: 16px;
            color: #1a1a2e;
            text-align: right;
        }
        
        .ticket-number {
            font-size: 20px;
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
            margin-bottom: 15px;
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
        
        .priority-high { color: #e74c3c; }
        .priority-urgent { color: #e74c3c; font-weight: bold; }
        .priority-normal { color: #f39c12; }
        .priority-low { color: #27ae60; }
        
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
        
        .full-width {
            width: 100%;
        }
        
        .description {
            white-space: pre-wrap;
            background: #f9f9f9;
            padding: 8px;
            border-radius: 4px;
            min-height: 40px;
        }
        
        .issue-section {
            margin-bottom: 15px;
        }
        
        .invoice-section {
            margin-bottom: 15px;
            page-break-inside: avoid;
        }
        
        .invoice-section h3 {
            font-size: 12px;
            font-weight: bold;
            color: #1a1a2e;
            border-bottom: 2px solid #e74c3c;
            padding-bottom: 5px;
            margin-bottom: 10px;
        }
        
        .invoice-image {
            max-width: 100%;
            max-height: 250px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        
        .note {
            color: #666;
            font-style: italic;
        }
        
        .notes-section {
            margin-bottom: 20px;
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
            margin-top: 30px;
            padding-top: 20px;
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
        
        .footer {
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
    """)
    
    font_config = FontConfiguration()
    html = HTML(string=html_content)
    pdf_bytes = html.write_pdf(stylesheets=[css], font_config=font_config)
    
    return pdf_bytes


async def create_and_upload_jobcard(ticket: Dict[str, Any], invoice_data: Optional[bytes] = None) -> str:
    """
    Create jobcard PDF and upload to NAS
    
    Args:
        ticket: Ticket document
        invoice_data: Optional invoice file bytes to embed
        
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
    
    # Generate PDF
    pdf_bytes = generate_ticket_jobcard_pdf(ticket, invoice_base64)
    
    # Upload to NAS with ticket ID as filename
    ticket_id = ticket.get("id", "unknown")
    path, _ = await upload_file(
        file_data=pdf_bytes,
        folder="jobcards",
        original_filename=f"{ticket_id}.pdf",
        filename_prefix=""
    )
    
    return path

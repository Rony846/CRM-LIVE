"""
Amazon-style Packing Slip Generator
Generates PDF packing slips from Amazon order data
"""

import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.pdfgen import canvas


def generate_packing_slip(order_data: dict, firm_data: dict) -> bytes:
    """
    Generate a packing slip PDF from Amazon order data.
    
    Args:
        order_data: Dictionary containing Amazon order details
        firm_data: Dictionary containing firm/seller details
    
    Returns:
        PDF content as bytes
    """
    buffer = io.BytesIO()
    
    # Create the PDF document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15*mm,
        leftMargin=15*mm,
        topMargin=15*mm,
        bottomMargin=15*mm
    )
    
    # Styles
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=10,
        textColor=colors.HexColor('#232F3E')
    )
    
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#666666')
    )
    
    label_style = ParagraphStyle(
        'LabelStyle',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#666666'),
        spaceAfter=2
    )
    
    value_style = ParagraphStyle(
        'ValueStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.black,
        spaceAfter=5
    )
    
    bold_style = ParagraphStyle(
        'BoldStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.black,
        fontName='Helvetica-Bold'
    )
    
    small_style = ParagraphStyle(
        'SmallStyle',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#666666')
    )
    
    # Build content
    content = []
    
    # Extract order data
    amazon_order_id = order_data.get('amazon_order_id', 'N/A')
    order_date = order_data.get('purchase_date', '')
    buyer_name = order_data.get('buyer_name', 'Customer')
    address_line1 = order_data.get('address_line1', '')
    address_line2 = order_data.get('address_line2', '')
    city = order_data.get('city', '')
    state = order_data.get('state', '')
    postal_code = order_data.get('postal_code', '')
    phone = order_data.get('phone', '')
    order_total = order_data.get('order_total', 0)
    items = order_data.get('items', [])
    
    # Firm/Seller info
    seller_name = firm_data.get('name', 'MuscleGrid')
    seller_gstin = firm_data.get('gstin', '')
    
    # Current date/time
    now = datetime.now()
    date_str = now.strftime('%d/%m/%Y, %H:%M')
    
    # Format order date
    if order_date:
        try:
            if 'T' in order_date:
                od = datetime.fromisoformat(order_date.replace('Z', '+00:00'))
            else:
                od = datetime.strptime(order_date, '%Y-%m-%d')
            order_date_formatted = od.strftime('%a, %b %d, %Y')
        except:
            order_date_formatted = order_date
    else:
        order_date_formatted = now.strftime('%a, %b %d, %Y')
    
    # ========== HEADER ==========
    header_data = [
        [
            Paragraph(date_str, header_style),
            Paragraph('<b>PACKING SLIP</b>', ParagraphStyle('Right', parent=title_style, alignment=TA_RIGHT))
        ]
    ]
    header_table = Table(header_data, colWidths=[doc.width/2, doc.width/2])
    header_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    content.append(header_table)
    content.append(Spacer(1, 10*mm))
    
    # ========== SHIP TO SECTION ==========
    content.append(Paragraph('<b>Ship to:</b>', bold_style))
    content.append(Spacer(1, 2*mm))
    
    # Format address
    address_parts = [buyer_name]
    if address_line1:
        address_parts.append(address_line1)
    if address_line2:
        address_parts.append(address_line2)
    city_state_pin = ', '.join(filter(None, [city, state, postal_code]))
    if city_state_pin:
        address_parts.append(city_state_pin)
    if phone:
        address_parts.append(f"Phone: {phone}")
    
    for part in address_parts:
        content.append(Paragraph(part, value_style))
    
    content.append(Spacer(1, 8*mm))
    
    # ========== ORDER ID & THANK YOU ==========
    order_info_data = [
        [
            Paragraph(f'<b>Order ID:</b> {amazon_order_id}', bold_style),
            Paragraph(f'Thank you for buying from <b>{seller_name}</b>', 
                     ParagraphStyle('Right', parent=value_style, alignment=TA_RIGHT))
        ]
    ]
    order_info_table = Table(order_info_data, colWidths=[doc.width/2, doc.width/2])
    order_info_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F5F5F5')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    content.append(order_info_table)
    content.append(Spacer(1, 5*mm))
    
    # ========== ORDER DETAILS BOX ==========
    order_details_data = [
        ['Delivery address', 'Order date', 'Shipping Service', 'Buyer name', 'Seller name'],
        [
            Paragraph(f'{city}, {state} {postal_code}', small_style),
            Paragraph(order_date_formatted, small_style),
            Paragraph('Standard', small_style),
            Paragraph(buyer_name.split()[0] if buyer_name else '', small_style),
            Paragraph(seller_name, small_style)
        ]
    ]
    
    col_width = doc.width / 5
    order_details_table = Table(order_details_data, colWidths=[col_width]*5)
    order_details_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E8E8E8')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#333333')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
    ]))
    content.append(order_details_table)
    content.append(Spacer(1, 8*mm))
    
    # ========== ITEMS TABLE ==========
    # Calculate totals
    if items:
        total_qty = sum(item.get('quantity', 1) for item in items)
        # If we have item prices, calculate; otherwise use order_total
        item_subtotal = sum(item.get('item_price', 0) for item in items)
        if item_subtotal == 0:
            item_subtotal = order_total
    else:
        total_qty = 1
        item_subtotal = order_total
    
    # GST calculation (18% assumed, reverse calculate)
    gst_rate = 18
    taxable_value = round(item_subtotal / (1 + gst_rate/100), 2)
    tax_amount = round(item_subtotal - taxable_value, 2)
    
    # Table header
    items_header = ['Qty', 'Product Details', 'Unit price', 'Order Totals']
    
    # Build items rows
    items_data = [items_header]
    
    for idx, item in enumerate(items if items else [{'title': 'Product', 'quantity': 1, 'amazon_sku': 'N/A'}]):
        qty = item.get('quantity', 1)
        title = item.get('title', 'Product')
        amazon_sku = item.get('amazon_sku', 'N/A')
        asin = item.get('asin', 'N/A')
        unit_price = item.get('item_price', order_total) if item.get('item_price') else order_total / total_qty
        
        # Product details cell
        product_details = f"""<b>{title}</b><br/>
SKU: {amazon_sku}<br/>
ASIN: {asin}<br/>
Condition: New"""
        
        # Order totals cell (only show on first row)
        if idx == 0:
            order_totals = f"""Item subtotal: ₹{taxable_value:,.2f}<br/>
Tax (GST {gst_rate}%): ₹{tax_amount:,.2f}<br/>
<b>Item total: ₹{item_subtotal:,.2f}</b>"""
        else:
            order_totals = ''
        
        items_data.append([
            str(qty),
            Paragraph(product_details, small_style),
            f'₹{unit_price:,.2f}',
            Paragraph(order_totals, small_style)
        ])
    
    # Calculate column widths
    col_widths = [15*mm, doc.width - 15*mm - 35*mm - 45*mm, 35*mm, 45*mm]
    
    items_table = Table(items_data, colWidths=col_widths)
    items_table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#232F3E')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        # Data rows
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('ALIGN', (2, 1), (2, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        # Padding
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#232F3E')),
    ]))
    content.append(items_table)
    content.append(Spacer(1, 5*mm))
    
    # ========== GRAND TOTAL ==========
    grand_total_data = [[
        '',
        '',
        Paragraph('<b>Grand total:</b>', ParagraphStyle('Right', parent=bold_style, alignment=TA_RIGHT)),
        Paragraph(f'<b>₹{order_total:,.2f}</b>', ParagraphStyle('Right', parent=bold_style, alignment=TA_RIGHT))
    ]]
    grand_total_table = Table(grand_total_data, colWidths=col_widths)
    grand_total_table.setStyle(TableStyle([
        ('BACKGROUND', (2, 0), (-1, 0), colors.HexColor('#F5F5F5')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    content.append(grand_total_table)
    content.append(Spacer(1, 10*mm))
    
    # ========== FOOTER ==========
    footer_text = f"""
    <b>Seller:</b> {seller_name}<br/>
    <b>GSTIN:</b> {seller_gstin}<br/><br/>
    For any queries regarding this order, please contact us through Amazon Seller Central.
    """
    content.append(Paragraph(footer_text, small_style))
    content.append(Spacer(1, 10*mm))
    
    # ========== DECLARATION ==========
    declaration_text = f"""
    <b>Declaration</b><br/><br/>
    I, <b>{buyer_name}</b>, hereby declare that the goods ordered under Order ID: <b>{amazon_order_id}</b> 
    are for my internal or personal purpose and not for re-sale. I agree to the Terms and Conditions 
    of Amazon.in and confirm that the information provided is accurate.
    """
    content.append(Paragraph(declaration_text, small_style))
    
    # Build PDF
    doc.build(content)
    
    # Get PDF bytes
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes


def generate_packing_slip_for_order(amazon_order: dict, firm: dict) -> tuple:
    """
    Generate packing slip and return (pdf_bytes, filename)
    """
    pdf_bytes = generate_packing_slip(amazon_order, firm)
    filename = f"packing_slip_{amazon_order.get('amazon_order_id', 'order')}.pdf"
    return pdf_bytes, filename

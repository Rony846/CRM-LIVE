"""
Amazon Browser Agent - Automated Order Processing
Provides a live-streaming browser that can be controlled by admin
and automated by the agent for order processing.
"""

import os
import re
import asyncio
import base64
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger("browser_agent")

class AgentState(Enum):
    IDLE = "idle"
    STARTING = "starting"
    WAITING_LOGIN = "waiting_login"
    LOGGED_IN = "logged_in"
    PROCESSING = "processing"
    PAUSED = "paused"
    ERROR = "error"
    STOPPED = "stopped"

class ShippingType(Enum):
    B2B = "b2b"
    B2C = "b2c"

@dataclass
class OrderInfo:
    """Amazon order information"""
    order_id: str
    buyer_name: str
    address: str
    city: str
    state: str
    pincode: str
    phone: str
    items: List[Dict[str, Any]]
    total_amount: float
    order_type: str  # "self_ship" or "easy_ship"
    status: str

@dataclass
class SKUDimensions:
    """SKU shipping dimensions from CRM"""
    sku: str
    weight_kg: float
    length_cm: float
    width_cm: float
    height_cm: float

@dataclass
class ProcessingResult:
    """Result of processing an order"""
    order_id: str
    success: bool
    tracking_id: Optional[str] = None
    shipping_type: Optional[str] = None
    label_path: Optional[str] = None
    invoice_path: Optional[str] = None
    error: Optional[str] = None

class AmazonBrowserAgent:
    """
    Browser automation agent for Amazon Seller Central.
    Handles order processing with live streaming to admin.
    """
    
    def __init__(self, db, bigship_config: Dict[str, str]):
        self.db = db
        self.bigship_config = bigship_config
        self.browser = None
        self.context = None
        self.page = None
        self.state = AgentState.IDLE
        self.current_order = None
        self.processing_queue = []
        self.screenshot_callback = None
        self.status_callback = None
        self.cookies_path = Path("/app/backend/data/amazon_cookies.json")
        self.cookies_path.parent.mkdir(parents=True, exist_ok=True)
        
    async def start(self):
        """Start the browser with optimized settings for low RAM"""
        from playwright.async_api import async_playwright
        
        self.state = AgentState.STARTING
        await self._notify_status("Starting browser...")
        
        self.playwright = await async_playwright().start()
        
        # Optimized launch args for low RAM (200MB target)
        launch_args = [
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-setuid-sandbox",
            "--no-sandbox",
            "--single-process",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-default-apps",
            "--disable-sync",
            "--disable-translate",
            "--mute-audio",
            "--no-first-run",
            "--safebrowsing-disable-auto-update",
            "--js-flags=--max-old-space-size=128",
        ]
        
        self.browser = await self.playwright.chromium.launch(
            headless=True,  # Headless for lower RAM
            args=launch_args
        )
        
        # Create context with viewport
        self.context = await self.browser.new_context(
            viewport={"width": 1366, "height": 768},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        # Load saved cookies if available
        if await self._load_cookies():
            await self._notify_status("Loaded saved session")
        
        self.page = await self.context.new_page()
        
        # Set up screenshot streaming
        self.page.on("load", lambda: asyncio.create_task(self._capture_screenshot()))
        
        self.state = AgentState.WAITING_LOGIN
        await self._notify_status("Browser ready - navigate to Amazon")
        
    async def stop(self):
        """Stop the browser and cleanup"""
        self.state = AgentState.STOPPED
        
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()
            
        await self._notify_status("Browser stopped")
        
    async def navigate(self, url: str):
        """Navigate to a URL"""
        if self.page:
            await self.page.goto(url, wait_until="domcontentloaded")
            await self._capture_screenshot()
            
    async def click(self, x: int, y: int):
        """Handle admin click input"""
        if self.page:
            await self.page.mouse.click(x, y)
            await asyncio.sleep(0.5)
            await self._capture_screenshot()
            
    async def type_text(self, text: str):
        """Handle admin keyboard input"""
        if self.page:
            await self.page.keyboard.type(text)
            await self._capture_screenshot()
            
    async def press_key(self, key: str):
        """Handle admin key press"""
        if self.page:
            await self.page.keyboard.press(key)
            await self._capture_screenshot()
    
    async def go_to_seller_central(self):
        """Navigate to Amazon Seller Central"""
        await self.navigate("https://sellercentral.amazon.in/")
        await self._capture_screenshot()
        
    async def check_login_status(self) -> bool:
        """Check if logged into Amazon Seller Central"""
        if not self.page:
            return False
            
        try:
            # Check for logged-in indicators - multiple methods for robustness
            logged_in = await self.page.evaluate("""
                () => {
                    // Method 1: Check for seller name in navbar
                    const sellerName = document.querySelector('[data-testid="seller-name"]');
                    if (sellerName) return true;
                    
                    // Method 2: Check for account name displayed (e.g., "MuscleGrid Retail")
                    const accountNameElements = document.querySelectorAll('.sc-mkt-picker-switcher-txt, .navbar-title, [class*="merchant-name"]');
                    for (const el of accountNameElements) {
                        if (el.textContent && el.textContent.length > 2) return true;
                    }
                    
                    // Method 3: Check for main content container (orders page, etc.)
                    const dashboard = document.querySelector('.sc-content-container');
                    if (dashboard) return true;
                    
                    // Method 4: Check for navbar account button
                    const navAccount = document.querySelector('#sc-navbar-account');
                    if (navAccount) return true;
                    
                    // Method 5: Check for "Manage Orders" text which indicates logged in state
                    const manageOrders = document.body.innerText.includes('Manage Orders');
                    if (manageOrders) return true;
                    
                    // Method 6: Check for Self Ship / Easy Ship tabs (only visible when logged in)
                    const shipTabs = document.querySelector('[data-testid*="ship"], .ship-tab, a[href*="mfn"]');
                    if (shipTabs) return true;
                    
                    // Method 7: Check URL - if we're on orders page, we're logged in
                    if (window.location.href.includes('sellercentral') && 
                        (window.location.href.includes('orders') || 
                         window.location.href.includes('inventory') ||
                         window.location.href.includes('dashboard'))) {
                        return true;
                    }
                    
                    return false;
                }
            """)
            
            if logged_in:
                self.state = AgentState.LOGGED_IN
                await self._save_cookies()
                await self._notify_status("Logged in to Amazon Seller Central")
            else:
                await self._notify_status("Not logged in - please sign in manually")
                
            return logged_in
        except Exception as e:
            logger.error(f"Error checking login: {e}")
            return False
    
    async def get_unshipped_orders(self) -> List[Dict[str, Any]]:
        """Navigate to and fetch unshipped self-ship orders"""
        if self.state != AgentState.LOGGED_IN:
            raise Exception("Not logged in")
            
        await self._notify_status("Fetching unshipped orders...")
        
        # Navigate to orders page if not already there
        current_url = self.page.url
        if "orders-v3/mfn/unshipped" not in current_url:
            await self.page.goto(
                "https://sellercentral.amazon.in/orders-v3/mfn/unshipped",
                wait_until="domcontentloaded"
            )
            await asyncio.sleep(3)
        
        await self._capture_screenshot()
        
        # Extract orders from page using multiple selector strategies
        orders = await self.page.evaluate("""
            () => {
                const orders = [];
                
                // Strategy 1: Look for order rows in the table
                // Amazon uses different table structures - try multiple selectors
                
                // Look for order ID links which contain the order number
                const orderLinks = document.querySelectorAll('a[href*="/orders-v3/order/"]');
                const seenOrderIds = new Set();
                
                orderLinks.forEach(link => {
                    const href = link.getAttribute('href') || '';
                    const match = href.match(/order\\/([0-9-]+)/);
                    if (match && match[1]) {
                        const orderId = match[1];
                        if (!seenOrderIds.has(orderId)) {
                            seenOrderIds.add(orderId);
                            orders.push({
                                order_id: orderId,
                                link: href
                            });
                        }
                    }
                });
                
                // Strategy 2: Look for order IDs in text (format: XXX-XXXXXXX-XXXXXXX)
                if (orders.length === 0) {
                    const allText = document.body.innerText;
                    const orderIdPattern = /\\d{3}-\\d{7}-\\d{7}/g;
                    const matches = allText.match(orderIdPattern) || [];
                    
                    matches.forEach(orderId => {
                        if (!seenOrderIds.has(orderId)) {
                            seenOrderIds.add(orderId);
                            orders.push({
                                order_id: orderId
                            });
                        }
                    });
                }
                
                // Strategy 3: Look for table rows with order data
                if (orders.length === 0) {
                    const tableRows = document.querySelectorAll('table tbody tr, .orders-table tr');
                    tableRows.forEach(row => {
                        const text = row.textContent || '';
                        const match = text.match(/\\d{3}-\\d{7}-\\d{7}/);
                        if (match) {
                            const orderId = match[0];
                            if (!seenOrderIds.has(orderId)) {
                                seenOrderIds.add(orderId);
                                orders.push({
                                    order_id: orderId
                                });
                            }
                        }
                    });
                }
                
                // Strategy 4: Look for checkboxes with order IDs
                const checkboxes = document.querySelectorAll('input[type="checkbox"][name*="order"], input[type="checkbox"][id*="order"]');
                checkboxes.forEach(cb => {
                    const name = cb.getAttribute('name') || cb.getAttribute('id') || '';
                    const match = name.match(/\\d{3}-\\d{7}-\\d{7}/);
                    if (match) {
                        const orderId = match[0];
                        if (!seenOrderIds.has(orderId)) {
                            seenOrderIds.add(orderId);
                            orders.push({
                                order_id: orderId
                            });
                        }
                    }
                });
                
                return orders;
            }
        """)
        
        await self._notify_status(f"Found {len(orders)} unshipped self-ship orders")
        return orders
    
    async def get_order_details(self, order_id: str) -> Optional[OrderInfo]:
        """Get detailed information for a specific order"""
        await self._notify_status(f"Fetching details for order {order_id}...")
        
        # Navigate to order details
        await self.page.goto(
            f"https://sellercentral.amazon.in/orders-v3/order/{order_id}",
            wait_until="domcontentloaded"
        )
        await asyncio.sleep(3)
        await self._capture_screenshot()
        
        # Extract order details with multiple strategies
        details = await self.page.evaluate("""
            () => {
                const result = {
                    buyer_name: '',
                    address: '',
                    city: '',
                    state: '',
                    pincode: '',
                    phone: '',
                    items: [],
                    total: 0,
                    is_self_ship: true
                };
                
                // Get all text content for pattern matching
                const pageText = document.body.innerText;
                
                // Strategy 1: Find phone number first (most reliable pattern)
                // Look for "Phone:" followed by number
                const phonePatterns = [
                    /Phone[:\\s]*([6-9]\\d{9})/i,
                    /Contact[:\\s]*([6-9]\\d{9})/i,
                    /Mobile[:\\s]*([6-9]\\d{9})/i,
                    /\\b([6-9]\\d{9})\\b/
                ];
                
                for (const pattern of phonePatterns) {
                    const match = pageText.match(pattern);
                    if (match) {
                        result.phone = match[1];
                        break;
                    }
                }
                
                // Strategy 2: Find shipping address section - look for "Ship to" section
                const shipToSection = document.body.innerText.match(/Ship\\s*to[\\s\\S]*?(?=Order\\s*contents|Seller\\s*notes|$)/i);
                if (shipToSection) {
                    const shipText = shipToSection[0];
                    result.address = shipText;
                    
                    // Extract buyer name (usually first line after "Ship to")
                    const nameMatch = shipText.match(/Ship\\s*to[\\s\\n]+([A-Z][A-Z\\s]+)/i);
                    if (nameMatch) {
                        result.buyer_name = nameMatch[1].trim();
                    }
                    
                    // Extract pincode (6 digits)
                    const pincodeMatch = shipText.match(/\\b(\\d{6})\\b/);
                    if (pincodeMatch) {
                        result.pincode = pincodeMatch[1];
                    }
                }
                
                // Strategy 3: Find buyer name from Contact Buyer section
                if (!result.buyer_name) {
                    const contactBuyer = pageText.match(/Contact\\s*Buyer[:\\s]*([A-Z][A-Za-z\\s]+)/i);
                    if (contactBuyer) {
                        result.buyer_name = contactBuyer[1].trim();
                    }
                }
                
                // Fallback: Find any name-like pattern near Ship to
                if (!result.buyer_name) {
                    const addressSection = document.querySelector('.ship-address, .shipping-address, [class*="ship-to"]') ||
                                           document.querySelector('[class*="address"]');
                    if (addressSection) {
                        const addressText = addressSection.innerText;
                        result.address = addressText;
                        
                        // First line is usually the name
                        const lines = addressText.split('\\n').filter(l => l.trim());
                        if (lines.length > 0) {
                            const firstLine = lines[0].trim();
                            if (!firstLine.match(/^\\d/) && !firstLine.match(/ship\\s*to/i)) {
                                result.buyer_name = firstLine;
                            }
                        }
                    }
                }
                
                // Strategy 4: Find order items - look for SKU pattern
                const skuMatches = pageText.match(/SKU[:\\s]*([A-Z0-9]+)/gi);
                if (skuMatches) {
                    skuMatches.forEach(match => {
                        const sku = match.replace(/SKU[:\\s]*/i, '');
                        result.items.push({
                            sku: sku,
                            title: 'Product',
                            quantity: 1
                        });
                    });
                }
                
                // Strategy 5: Find order total
                const totalPatterns = [
                    /Item\\s*subtotal[:\\s]*[₹Rs\\.\\s]*(\\d[\\d,]*\\.?\\d*)/i,
                    /Grand\\s*total[:\\s]*[₹Rs\\.\\s]*(\\d[\\d,]*\\.?\\d*)/i,
                    /Item\\s*total[:\\s]*[₹Rs\\.\\s]*(\\d[\\d,]*\\.?\\d*)/i
                ];
                
                for (const pattern of totalPatterns) {
                    const match = pageText.match(pattern);
                    if (match) {
                        result.total = parseFloat(match[1].replace(/,/g, ''));
                        break;
                    }
                }
                
                // Strategy 6: Check if Self Ship
                const fulfillmentText = pageText.toLowerCase();
                result.is_self_ship = fulfillmentText.includes('seller') && 
                                      fulfillmentText.includes('fulfillment') &&
                                      !fulfillmentText.includes('easy ship');
                
                // Default to self_ship if "Self Deliver" button is visible
                if (pageText.includes('Self Deliver')) {
                    result.is_self_ship = true;
                }
                
                // Parse state from address
                const statePatterns = [
                    /\\b(DELHI|MAHARASHTRA|KARNATAKA|TAMIL NADU|UTTAR PRADESH|WEST BENGAL|GUJARAT|RAJASTHAN|ANDHRA PRADESH|TELANGANA|KERALA|BIHAR|MADHYA PRADESH|PUNJAB|HARYANA|ODISHA|CHHATTISGARH|JHARKHAND|ASSAM|UTTARAKHAND)\\b/i
                ];
                for (const pattern of statePatterns) {
                    const stateMatch = (result.address + ' ' + pageText).match(pattern);
                    if (stateMatch) {
                        result.state = stateMatch[1].toUpperCase();
                        break;
                    }
                }
                
                return result;
            }
        """)
        
        if not details:
            return None
        
        # Parse city from address (line before pincode typically)
        address_lines = details.get('address', '').split('\n')
        city = ''
        for i, line in enumerate(address_lines):
            if details.get('pincode') and details['pincode'] in line and i > 0:
                city = address_lines[i-1].strip().replace(',', '')
                break
        
        # Fallback city extraction
        if not city:
            # Try to find city from address text near pincode
            address_text = details.get('address', '')
            city_match = re.search(r'([A-Z][A-Za-z\s]+),?\s*' + str(details.get('pincode', '')), address_text, re.IGNORECASE)
            if city_match:
                city = city_match.group(1).strip()
        
        return OrderInfo(
            order_id=order_id,
            buyer_name=details.get('buyer_name', 'Customer'),
            address=details.get('address', ''),
            city=city or 'Unknown',
            state=details.get('state', 'Unknown'),
            pincode=details.get('pincode', '110001'),
            phone=details.get('phone', ''),
            items=details.get('items', []),
            total_amount=details.get('total', 0),
            order_type='self_ship' if details.get('is_self_ship') else 'easy_ship',
            status='unshipped'
        )
    
    def determine_shipping_type(self, total_weight_kg: float, order_value: float) -> ShippingType:
        """
        Determine B2B or B2C shipping based on rules:
        - Weight > 20KG → B2B
        - Order value > ₹30,000 → B2B (regardless of weight)
        - Otherwise → B2C
        """
        if order_value > 30000:
            return ShippingType.B2B
        if total_weight_kg > 20:
            return ShippingType.B2B
        return ShippingType.B2C
    
    async def lookup_sku_dimensions(self, sku: str) -> Optional[SKUDimensions]:
        """Look up SKU weight and dimensions from CRM database"""
        product = await self.db.products.find_one(
            {"sku": {"$regex": f"^{sku}$", "$options": "i"}},
            {"_id": 0, "sku": 1, "weight_kg": 1, "length_cm": 1, "width_cm": 1, "height_cm": 1}
        )
        
        if not product:
            return None
            
        return SKUDimensions(
            sku=product.get('sku', sku),
            weight_kg=product.get('weight_kg', 0.5),
            length_cm=product.get('length_cm', 20),
            width_cm=product.get('width_cm', 15),
            height_cm=product.get('height_cm', 10)
        )
    
    async def download_amazon_invoice(self, order_id: str) -> Optional[bytes]:
        """Download invoice PDF from Amazon"""
        await self._notify_status(f"Downloading invoice for {order_id}...")
        
        # Navigate to invoice/packing slip page
        await self.page.goto(
            f"https://sellercentral.amazon.in/orders-v3/packing-slip/{order_id}",
            wait_until="domcontentloaded"
        )
        await asyncio.sleep(2)
        
        # Print to PDF
        pdf_bytes = await self.page.pdf(
            format="A4",
            print_background=True,
            margin={"top": "1cm", "bottom": "1cm", "left": "1cm", "right": "1cm"}
        )
        
        return pdf_bytes
    
    async def update_tracking_on_amazon(self, order_id: str, tracking_id: str, courier: str) -> bool:
        """Update tracking ID on Amazon Seller Central"""
        await self._notify_status(f"Updating tracking for {order_id}...")
        
        try:
            # Navigate to confirm shipment page
            await self.page.goto(
                f"https://sellercentral.amazon.in/orders-v3/order/{order_id}",
                wait_until="domcontentloaded"
            )
            await asyncio.sleep(2)
            await self._capture_screenshot()
            
            # Click "Confirm shipment" button
            confirm_btn = await self.page.query_selector('button:has-text("Confirm shipment"), [data-test-id="confirm-shipment"]')
            if confirm_btn:
                await confirm_btn.click()
                await asyncio.sleep(2)
                await self._capture_screenshot()
            
            # Fill in tracking details
            # Select carrier
            carrier_input = await self.page.query_selector('[data-test-id="carrier-input"], #carrier-name')
            if carrier_input:
                await carrier_input.fill(courier)
                await asyncio.sleep(0.5)
            
            # Enter tracking number
            tracking_input = await self.page.query_selector('[data-test-id="tracking-id"], #tracking-id')
            if tracking_input:
                await tracking_input.fill(tracking_id)
                await asyncio.sleep(0.5)
            
            await self._capture_screenshot()
            
            # Submit
            submit_btn = await self.page.query_selector('button:has-text("Confirm"), [data-test-id="submit-shipment"]')
            if submit_btn:
                await submit_btn.click()
                await asyncio.sleep(3)
                await self._capture_screenshot()
            
            await self._notify_status(f"Tracking updated for {order_id}: {tracking_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating tracking: {e}")
            await self._notify_status(f"Error updating tracking: {e}")
            return False
    
    async def process_order(self, order_id: str) -> ProcessingResult:
        """
        Process a single order:
        1. Get order details from Amazon
        2. Lookup SKU dimensions from CRM
        3. Create Bigship shipment with Delhivery courier (B2B or B2C based on rules)
        4. Update tracking on Amazon
        5. Download invoice and label
        6. Save to storage (NAS)
        """
        self.state = AgentState.PROCESSING
        self.current_order = order_id
        await self._notify_status(f"Processing order {order_id}...")
        
        try:
            # Step 1: Get order details
            order = await self.get_order_details(order_id)
            if not order:
                return ProcessingResult(order_id=order_id, success=False, error="Could not fetch order details")
            
            if order.order_type != "self_ship":
                return ProcessingResult(order_id=order_id, success=False, error="Order is not self-ship")
            
            # Step 2: Lookup SKU dimensions and calculate total weight
            total_weight = 0.0
            max_length = 20.0
            max_width = 15.0
            max_height = 10.0
            product_name = "Amazon Product"
            
            for item in order.items:
                dims = await self.lookup_sku_dimensions(item.get('sku', ''))
                if dims:
                    item_weight = dims.weight_kg * item.get('quantity', 1)
                    total_weight += item_weight
                    max_length = max(max_length, dims.length_cm)
                    max_width = max(max_width, dims.width_cm)
                    max_height = max(max_height, dims.height_cm)
                    product_name = item.get('title', product_name)
                else:
                    # Default weight if SKU not found
                    total_weight += 2.0 * item.get('quantity', 1)
                    product_name = item.get('title', product_name)
                    await self._notify_status(f"Warning: SKU {item.get('sku', 'unknown')} not found in CRM, using default weight 2kg")
            
            # Ensure minimum weight
            if total_weight < 0.5:
                total_weight = 0.5
            
            # Step 3: Determine shipping type
            shipping_type = self.determine_shipping_type(total_weight, order.total_amount)
            await self._notify_status(f"Shipping type: {shipping_type.value.upper()} (Weight: {total_weight}kg, Value: ₹{order.total_amount})")
            
            # Step 4: Create Bigship shipment with Delhivery
            await self._notify_status("Creating Bigship shipment with Delhivery courier...")
            
            bigship_result = await self._create_bigship_shipment(
                order=order,
                total_weight=total_weight,
                length=max_length,
                width=max_width,
                height=max_height,
                shipping_type=shipping_type,
                product_name=product_name
            )
            
            if not bigship_result.get("success"):
                return ProcessingResult(
                    order_id=order_id, 
                    success=False, 
                    error=f"Bigship error: {bigship_result.get('error', 'Unknown error')}"
                )
            
            tracking_id = bigship_result.get("awb_number", "")
            system_order_id = bigship_result.get("system_order_id", "")
            courier_name = bigship_result.get("courier_name", "Delhivery")
            
            await self._notify_status(f"✅ Bigship shipment created! AWB: {tracking_id}")
            
            # Step 5: Update tracking on Amazon
            await self._notify_status(f"Updating tracking on Amazon: {tracking_id}")
            await self.update_tracking_on_amazon(order_id, tracking_id, courier_name)
            
            # Step 6: Download Amazon invoice
            await self._notify_status("Downloading Amazon invoice...")
            invoice_pdf = await self.download_amazon_invoice(order_id)
            
            # Step 7: Download Bigship label
            await self._notify_status("Downloading shipping label from Bigship...")
            label_pdf = await self._download_bigship_label(system_order_id)
            
            # Step 8: Save to storage (NAS)
            date_path = datetime.now().strftime("%Y/%m-%B/%d")
            folder_path = f"amazon_orders/{date_path}/{order_id}"
            
            invoice_path = None
            label_path = None
            
            # Save invoice
            if invoice_pdf:
                invoice_path = await self._save_to_storage(
                    invoice_pdf, 
                    f"{folder_path}/amazon_invoice_{order_id}.pdf"
                )
                await self._notify_status(f"📄 Invoice saved: {invoice_path}")
            
            # Save label
            if label_pdf:
                label_path = await self._save_to_storage(
                    label_pdf, 
                    f"{folder_path}/shipping_label_{tracking_id}.pdf"
                )
                await self._notify_status(f"🏷️ Label saved: {label_path}")
            
            # Record in database
            await self.db.amazon_order_processing.insert_one({
                "order_id": order_id,
                "amazon_order_id": order_id,
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "shipping_type": shipping_type.value,
                "tracking_id": tracking_id,
                "awb_number": tracking_id,
                "system_order_id": system_order_id,
                "courier_name": courier_name,
                "total_weight_kg": total_weight,
                "order_value": order.total_amount,
                "invoice_path": invoice_path,
                "label_path": label_path,
                "folder_path": folder_path,
                "status": "completed",
                "customer_name": order.buyer_name,
                "customer_address": order.address,
                "customer_city": order.city,
                "customer_pincode": order.pincode
            })
            
            await self._notify_status(f"✅ Order {order_id} processed successfully! Tracking: {tracking_id}")
            
            return ProcessingResult(
                order_id=order_id,
                success=True,
                tracking_id=tracking_id,
                shipping_type=shipping_type.value,
                invoice_path=invoice_path,
                label_path=label_path
            )
            
        except Exception as e:
            logger.error(f"Error processing order {order_id}: {e}")
            return ProcessingResult(order_id=order_id, success=False, error=str(e))
        finally:
            self.current_order = None
    
    async def _create_bigship_shipment(
        self, 
        order: OrderInfo, 
        total_weight: float,
        length: float,
        width: float,
        height: float,
        shipping_type: ShippingType,
        product_name: str
    ) -> dict:
        """Create a Bigship shipment and manifest with Delhivery courier"""
        import httpx
        import re
        
        BIGSHIP_API_URL = os.environ.get("BIGSHIP_API_URL", "https://api.bigship.in/api")
        
        try:
            # Get Bigship token
            token = await self._get_bigship_token()
            if not token:
                return {"success": False, "error": "Failed to authenticate with Bigship"}
            
            # Get warehouse ID (first available)
            warehouse_id = await self._get_warehouse_id(token)
            if not warehouse_id:
                return {"success": False, "error": "No warehouse configured in Bigship"}
            
            # Determine shipment category
            shipment_category = "b2b" if shipping_type == ShippingType.B2B else "b2c"
            
            # Parse customer name - ensure both first and last name are present
            raw_name = order.buyer_name.strip() if order.buyer_name else "Customer Name"
            name_parts = raw_name.split()
            
            if len(name_parts) >= 2:
                first_name = name_parts[0]
                last_name = " ".join(name_parts[1:])
            elif len(name_parts) == 1:
                # Only one name part - use it as first name, duplicate for last name
                first_name = name_parts[0]
                last_name = name_parts[0]  # Bigship requires last_name
            else:
                first_name = "Customer"
                last_name = "Name"
            
            # Ensure names meet Bigship requirements (3-25 chars, only alphabets, dots, spaces)
            first_name = re.sub(r'[^a-zA-Z.\s]', '', first_name)[:25]
            last_name = re.sub(r'[^a-zA-Z.\s]', '', last_name)[:25]
            
            # Ensure minimum length
            if len(first_name) < 3:
                first_name = first_name + "Customer"[:3-len(first_name)]
            if len(last_name) < 3:
                last_name = last_name + "Name"[:3-len(last_name)]
            
            # Sanitize phone number - ensure it's valid and not all same digits
            phone = order.phone or ""
            phone = re.sub(r'[^0-9]', '', phone)  # Remove non-digits
            if len(phone) == 10 and phone[0] in "6789":
                # Check if all digits are the same
                if len(set(phone)) == 1:
                    phone = "9876543210"  # Fallback
            else:
                phone = "9876543210"  # Default fallback
            
            # Sanitize product name
            sanitized_product_name = re.sub(r'[^a-zA-Z0-9\s\-/]', '', product_name or "Product")[:100]
            if not sanitized_product_name.strip():
                sanitized_product_name = "Product"
            
            # Build address - ensure proper length
            address_line1 = (order.address or "Address")[:50]
            if len(address_line1) < 10:
                address_line1 = f"{address_line1} {order.city}"[:50]
            address_line2 = f"{order.city} {order.state}"[:100]
            
            # Build payload
            payload = {
                "shipment_category": shipment_category,
                "warehouse_detail": {
                    "pickup_location_id": warehouse_id,
                    "return_location_id": warehouse_id
                },
                "consignee_detail": {
                    "first_name": first_name,
                    "last_name": last_name,
                    "company_name": "",
                    "contact_number_primary": phone,
                    "contact_number_secondary": "",
                    "consignee_address": {
                        "address_line1": address_line1,
                        "address_line2": address_line2,
                        "address_landmark": "",
                        "pincode": str(order.pincode or "110001")
                    }
                },
                "order_detail": {
                    "invoice_date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                    "invoice_id": order.order_id,
                    "payment_type": "Prepaid",
                    "total_collectable_amount": 0,
                    "shipment_invoice_amount": order.total_amount,
                    "box_details": [{
                        "each_box_dead_weight": total_weight,
                        "each_box_length": int(length),
                        "each_box_width": int(width),
                        "each_box_height": int(height),
                        "each_box_invoice_amount": 0 if shipment_category == "b2b" else order.total_amount,
                        "each_box_collectable_amount": 0,
                        "box_count": 1,
                        "product_details": [{
                            "product_category": "Electronics",
                            "product_sub_category": "General",
                            "product_name": sanitized_product_name,
                            "product_quantity": 1,
                            "each_product_invoice_amount": 0 if shipment_category == "b2b" else order.total_amount,
                            "each_product_collectable_amount": 0,
                            "hsn": ""
                        }]
                    }],
                    "ewaybill_number": "",
                    "document_detail": {}
                }
            }
            
            # Generate placeholder invoice PDF for Bigship
            invoice_doc = await self._generate_invoice_pdf(order, total_weight)
            if invoice_doc:
                payload["order_detail"]["document_detail"]["invoice_document_file"] = invoice_doc
            
            # Create shipment
            endpoint = "/order/add/heavy" if shipment_category == "b2b" else "/order/add/single"
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{BIGSHIP_API_URL}{endpoint}",
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                data = response.json()
                logger.info(f"Bigship create response: {data}")
                
                if not data.get("success"):
                    error_msg = data.get("message", "Failed to create shipment")
                    if data.get("validationErrors"):
                        errors = [f"{e.get('propertyName', '')}: {e.get('errorMessage', '')}" for e in data.get("validationErrors", [])]
                        error_msg = "; ".join(errors)
                    return {"success": False, "error": error_msg}
                
                # Extract system_order_id
                order_id_match = data.get("data", "")
                system_order_id = None
                if isinstance(order_id_match, str) and "system_order_id is" in order_id_match:
                    system_order_id = order_id_match.split("system_order_id is ")[-1].strip()
                
                if not system_order_id:
                    return {"success": False, "error": "No system_order_id returned from Bigship"}
                
                # Now manifest with Delhivery courier (courier_id = 1 for Delhivery)
                await self._notify_status("Manifesting with Delhivery courier...")
                
                manifest_endpoint = "/order/manifest/heavy" if shipment_category == "b2b" else "/order/manifest/single"
                manifest_payload = {
                    "system_order_id": int(system_order_id),
                    "courier_id": 1  # Delhivery (ID from Bigship calculator API)
                }
                
                if shipment_category == "b2b":
                    manifest_payload["risk_type"] = "OwnerRisk"
                
                manifest_response = await client.post(
                    f"{BIGSHIP_API_URL}{manifest_endpoint}",
                    json=manifest_payload,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                manifest_data = manifest_response.json()
                logger.info(f"Bigship manifest response: {manifest_data}")
                
                if not manifest_data.get("success"):
                    return {"success": False, "error": f"Manifest failed: {manifest_data.get('message', 'Unknown error')}"}
                
                # Get AWB/tracking details
                awb_response = await client.post(
                    f"{BIGSHIP_API_URL}/shipment/data",
                    params={"shipment_data_id": 1, "system_order_id": system_order_id},
                    json={},
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                awb_data = awb_response.json()
                awb_info = awb_data.get("data", {}) if awb_data.get("success") else {}
                
                return {
                    "success": True,
                    "system_order_id": system_order_id,
                    "awb_number": awb_info.get("master_awb") or awb_info.get("lr_number", f"AWB{system_order_id}"),
                    "courier_name": awb_info.get("courier_name", "Delhivery"),
                    "courier_id": awb_info.get("courier_id", 1)
                }
                
        except Exception as e:
            logger.error(f"Bigship shipment error: {e}")
            return {"success": False, "error": str(e)}
    
    async def _get_bigship_token(self) -> Optional[str]:
        """Get Bigship API token"""
        import httpx
        
        BIGSHIP_API_URL = os.environ.get("BIGSHIP_API_URL", "https://api.bigship.in/api")
        BIGSHIP_USER_ID = os.environ.get("BIGSHIP_USER_ID")
        BIGSHIP_PASSWORD = os.environ.get("BIGSHIP_PASSWORD")
        BIGSHIP_ACCESS_KEY = os.environ.get("BIGSHIP_ACCESS_KEY")
        
        if not all([BIGSHIP_USER_ID, BIGSHIP_PASSWORD, BIGSHIP_ACCESS_KEY]):
            logger.error("Bigship credentials not configured")
            return None
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{BIGSHIP_API_URL}/login/user",
                    json={
                        "user_name": BIGSHIP_USER_ID,
                        "password": BIGSHIP_PASSWORD,
                        "access_key": BIGSHIP_ACCESS_KEY
                    }
                )
                data = response.json()
                if data.get("success"):
                    return data.get("data", {}).get("token")
                logger.error(f"Bigship auth failed: {data}")
                return None
        except Exception as e:
            logger.error(f"Bigship token error: {e}")
            return None
    
    async def _get_warehouse_id(self, token: str) -> Optional[int]:
        """Get first available warehouse ID from Bigship"""
        import httpx
        
        BIGSHIP_API_URL = os.environ.get("BIGSHIP_API_URL", "https://api.bigship.in/api")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{BIGSHIP_API_URL}/warehouse/get/list",
                    params={"page_index": 1, "page_size": 10},
                    headers={"Authorization": f"Bearer {token}"}
                )
                data = response.json()
                if data.get("success") and data.get("data"):
                    warehouses = data["data"].get("result_data", [])
                    if warehouses:
                        # Return first warehouse_id
                        return warehouses[0].get("warehouse_id")
                return None
        except Exception as e:
            logger.error(f"Warehouse list error: {e}")
            return None
    
    async def _generate_invoice_pdf(self, order: OrderInfo, weight: float) -> Optional[str]:
        """Generate a minimal invoice PDF for Bigship"""
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.pdfgen import canvas as pdf_canvas
            import io
            import base64
            
            buffer = io.BytesIO()
            c = pdf_canvas.Canvas(buffer, pagesize=A4)
            c.setFont("Helvetica-Bold", 16)
            c.drawString(200, 800, "SHIPPING INVOICE")
            c.setFont("Helvetica", 12)
            c.drawString(50, 750, f"Order ID: {order.order_id}")
            c.drawString(50, 730, f"Date: {datetime.now().strftime('%d-%m-%Y')}")
            c.drawString(50, 700, f"Customer: {order.buyer_name}")
            c.drawString(50, 680, f"Address: {order.address[:60] if order.address else 'N/A'}")
            c.drawString(50, 660, f"City: {order.city}, {order.state}")
            c.drawString(50, 640, f"Pincode: {order.pincode}")
            c.drawString(50, 610, f"Weight: {weight} kg")
            c.drawString(50, 590, f"Invoice Amount: Rs. {order.total_amount}")
            c.drawString(50, 560, "Payment Type: Prepaid")
            c.save()
            
            pdf_bytes = buffer.getvalue()
            pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
            return f"data:application/pdf;base64,{pdf_base64}"
        except Exception as e:
            logger.error(f"Invoice PDF generation error: {e}")
            return None
    
    async def _download_bigship_label(self, system_order_id: str) -> Optional[bytes]:
        """Download shipping label from Bigship"""
        import httpx
        import base64
        
        if not system_order_id:
            return None
        
        BIGSHIP_API_URL = os.environ.get("BIGSHIP_API_URL", "https://api.bigship.in/api")
        
        try:
            token = await self._get_bigship_token()
            if not token:
                return None
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{BIGSHIP_API_URL}/shipment/data",
                    params={"shipment_data_id": 2, "system_order_id": system_order_id},
                    json={},
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                data = response.json()
                if data.get("success") and data.get("data"):
                    label_data = data["data"]
                    # Label may be base64 encoded or a URL
                    if isinstance(label_data, str):
                        if label_data.startswith("data:"):
                            # Base64 data URI
                            base64_part = label_data.split(",")[1] if "," in label_data else label_data
                            return base64.b64decode(base64_part)
                        elif label_data.startswith("http"):
                            # URL - download it
                            label_response = await client.get(label_data)
                            return label_response.content
                    elif isinstance(label_data, dict) and label_data.get("label_url"):
                        label_response = await client.get(label_data["label_url"])
                        return label_response.content
                
                logger.warning(f"No label data returned for order {system_order_id}")
                return None
                
        except Exception as e:
            logger.error(f"Label download error: {e}")
            return None
    
    async def process_all_orders(self):
        """Process all unshipped self-ship orders"""
        orders = await self.get_unshipped_orders()
        results = []
        
        for order in orders:
            result = await self.process_order(order['order_id'])
            results.append(result)
            
            # Small delay between orders
            await asyncio.sleep(2)
        
        return results
    
    async def _capture_screenshot(self):
        """Capture screenshot and send to callback"""
        if self.page and self.screenshot_callback:
            try:
                screenshot = await self.page.screenshot(type="jpeg", quality=50)
                screenshot_b64 = base64.b64encode(screenshot).decode('utf-8')
                await self.screenshot_callback(screenshot_b64)
            except Exception as e:
                logger.error(f"Screenshot error: {e}")
    
    async def _notify_status(self, message: str):
        """Send status update to callback"""
        logger.info(f"Agent: {message}")
        if self.status_callback:
            await self.status_callback({
                "state": self.state.value,
                "message": message,
                "current_order": self.current_order,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
    
    async def _save_cookies(self):
        """Save browser cookies for session persistence"""
        if self.context:
            cookies = await self.context.cookies()
            self.cookies_path.write_text(json.dumps(cookies))
            logger.info("Saved Amazon session cookies")
    
    async def _load_cookies(self) -> bool:
        """Load saved cookies"""
        if self.cookies_path.exists():
            try:
                cookies = json.loads(self.cookies_path.read_text())
                await self.context.add_cookies(cookies)
                logger.info("Loaded saved Amazon session cookies")
                return True
            except Exception as e:
                logger.error(f"Error loading cookies: {e}")
        return False
    
    async def _save_to_storage(self, data: bytes, path: str) -> Optional[str]:
        """Save file to NAS storage"""
        try:
            from utils.storage import upload_file as storage_upload
            
            # Create a file-like object
            from io import BytesIO
            file_obj = BytesIO(data)
            file_obj.name = path.split('/')[-1]
            
            await asyncio.to_thread(
                storage_upload,
                file_obj,
                path.rsplit('/', 1)[0],  # folder
                path.rsplit('/', 1)[1]   # filename
            )
            
            return f"/api/files/{path}"
        except Exception as e:
            logger.error(f"Error saving to storage: {e}")
            return None

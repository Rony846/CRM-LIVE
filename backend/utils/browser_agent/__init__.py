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
        Process a single order using BROWSER AUTOMATION:
        1. Get order details from Amazon
        2. Open Bigship portal in new tab
        3. Create shipment via web form
        4. Select Delhivery courier
        5. Get tracking ID and download label
        6. Update tracking on Amazon
        7. Save files to storage
        """
        self.state = AgentState.PROCESSING
        self.current_order = order_id
        await self._notify_status(f"Processing order {order_id}...")
        
        # Store original page reference (Amazon)
        amazon_page = self.page
        bigship_page = None
        
        try:
            # Step 1: Get order details from Amazon
            order = await self.get_order_details(order_id)
            if not order:
                return ProcessingResult(order_id=order_id, success=False, error="Could not fetch order details")
            
            if order.order_type != "self_ship":
                return ProcessingResult(order_id=order_id, success=False, error="Order is not self-ship")
            
            await self._notify_status(f"Order details: {order.buyer_name}, {order.city}, ₹{order.total_amount}")
            
            # Step 2: Calculate weight
            total_weight = 0.0
            for item in order.items:
                dims = await self.lookup_sku_dimensions(item.get('sku', ''))
                if dims:
                    total_weight += dims.weight_kg * item.get('quantity', 1)
                else:
                    total_weight += 2.0 * item.get('quantity', 1)
            
            if total_weight < 0.5:
                total_weight = 0.5
            
            # Determine shipping type
            shipping_type = self.determine_shipping_type(total_weight, order.total_amount)
            await self._notify_status(f"Shipping: {shipping_type.value.upper()} (Weight: {total_weight}kg)")
            
            # Step 3: Open Bigship portal in new tab
            await self._notify_status("Opening Bigship portal in new tab...")
            bigship_page = await self.context.new_page()
            
            # Navigate to Bigship
            await bigship_page.goto("https://app.bigship.in/", wait_until="domcontentloaded")
            await asyncio.sleep(3)
            
            # Take screenshot of Bigship login page
            self.page = bigship_page  # Switch to Bigship for screenshots
            await self._capture_screenshot()
            
            # Check if already logged in or need to login
            is_logged_in = await self._check_bigship_login(bigship_page)
            
            if not is_logged_in:
                await self._notify_status("Logging into Bigship...")
                login_success = await self._login_to_bigship(bigship_page)
                if not login_success:
                    self.page = amazon_page  # Switch back
                    await bigship_page.close()
                    return ProcessingResult(order_id=order_id, success=False, error="Failed to login to Bigship")
            
            await self._notify_status("Logged into Bigship. Creating shipment...")
            
            # Step 4: Create shipment via web form
            shipment_result = await self._create_shipment_via_browser(
                bigship_page, 
                order, 
                total_weight, 
                shipping_type
            )
            
            if not shipment_result.get("success"):
                self.page = amazon_page
                await bigship_page.close()
                return ProcessingResult(
                    order_id=order_id, 
                    success=False, 
                    error=f"Shipment creation failed: {shipment_result.get('error')}"
                )
            
            tracking_id = shipment_result.get("tracking_id", "")
            await self._notify_status(f"✅ Shipment created! AWB: {tracking_id}")
            
            # Step 5: Download label
            label_path = None
            if shipment_result.get("system_order_id"):
                await self._notify_status("Downloading shipping label...")
                label_pdf = await self._download_label_via_browser(bigship_page, shipment_result.get("system_order_id"))
                if label_pdf:
                    date_path = datetime.now().strftime("%Y/%m-%B/%d")
                    folder_path = f"amazon_orders/{date_path}/{order_id}"
                    label_path = await self._save_to_storage(label_pdf, f"{folder_path}/label_{tracking_id}.pdf")
                    await self._notify_status(f"🏷️ Label saved: {label_path}")
            
            # Close Bigship tab and switch back to Amazon
            await bigship_page.close()
            self.page = amazon_page
            bigship_page = None
            
            # Step 6: Update tracking on Amazon
            await self._notify_status("Updating tracking on Amazon...")
            await self.update_tracking_on_amazon(order_id, tracking_id, "Delhivery")
            
            # Step 7: Download Amazon invoice
            await self._notify_status("Downloading Amazon invoice...")
            invoice_pdf = await self.download_amazon_invoice(order_id)
            invoice_path = None
            if invoice_pdf:
                date_path = datetime.now().strftime("%Y/%m-%B/%d")
                folder_path = f"amazon_orders/{date_path}/{order_id}"
                invoice_path = await self._save_to_storage(invoice_pdf, f"{folder_path}/invoice_{order_id}.pdf")
                await self._notify_status(f"📄 Invoice saved: {invoice_path}")
            
            # Record in database
            await self.db.amazon_order_processing.insert_one({
                "order_id": order_id,
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "shipping_type": shipping_type.value,
                "tracking_id": tracking_id,
                "courier_name": "Delhivery",
                "total_weight_kg": total_weight,
                "order_value": order.total_amount,
                "invoice_path": invoice_path,
                "label_path": label_path,
                "customer_name": order.buyer_name,
                "status": "completed"
            })
            
            await self._notify_status(f"✅ Order {order_id} completed! AWB: {tracking_id}")
            
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
            # Make sure we switch back to Amazon page
            if bigship_page:
                try:
                    await bigship_page.close()
                except Exception:
                    pass
            self.page = amazon_page
            return ProcessingResult(order_id=order_id, success=False, error=str(e))
        finally:
            self.current_order = None
    
    async def _check_bigship_login(self, page) -> bool:
        """Check if already logged into Bigship"""
        try:
            # Look for elements that indicate logged in state
            dashboard = await page.query_selector('[class*="dashboard"], [class*="sidebar"], .main-content')
            if dashboard:
                return True
            
            # Check URL
            if "/dashboard" in page.url or "/orders" in page.url:
                return True
            
            # Look for login form
            login_form = await page.query_selector('input[type="password"], form[class*="login"]')
            if login_form:
                return False
            
            return False
        except Exception:
            return False
    
    async def _login_to_bigship(self, page) -> bool:
        """Login to Bigship portal"""
        BIGSHIP_USER = os.environ.get("BIGSHIP_USER_ID", "")
        BIGSHIP_PASS = os.environ.get("BIGSHIP_PASSWORD", "")
        
        if not BIGSHIP_USER or not BIGSHIP_PASS:
            await self._notify_status("Error: Bigship credentials not configured")
            return False
        
        try:
            await asyncio.sleep(2)
            
            # Fill username/email
            username_input = await page.query_selector('input[type="text"], input[name="username"], input[name="email"], input[placeholder*="email"], input[placeholder*="user"]')
            if username_input:
                await username_input.fill(BIGSHIP_USER)
                await asyncio.sleep(0.5)
            
            # Fill password
            password_input = await page.query_selector('input[type="password"]')
            if password_input:
                await password_input.fill(BIGSHIP_PASS)
                await asyncio.sleep(0.5)
            
            await self._capture_screenshot()
            
            # Click login button
            login_btn = await page.query_selector('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), .login-btn')
            if login_btn:
                await login_btn.click()
                await asyncio.sleep(5)
            else:
                # Try pressing Enter
                await page.keyboard.press("Enter")
                await asyncio.sleep(5)
            
            await self._capture_screenshot()
            
            # Check if login successful
            return await self._check_bigship_login(page)
            
        except Exception as e:
            logger.error(f"Bigship login error: {e}")
            return False
    
    async def _create_shipment_via_browser(self, page, order: OrderInfo, weight: float, shipping_type: ShippingType) -> dict:
        """Create shipment on Bigship via browser automation"""
        try:
            # Navigate to add order page
            await self._notify_status("Navigating to Add Order page...")
            
            # Try to find Add Order / Create Shipment link
            add_order_link = await page.query_selector('a:has-text("Add Order"), a:has-text("Create"), a[href*="add"], a[href*="create"], button:has-text("Add Order")')
            
            if add_order_link:
                await add_order_link.click()
                await asyncio.sleep(3)
            else:
                # Try direct navigation
                shipment_type = "heavy" if shipping_type == ShippingType.B2B else "single"
                await page.goto(f"https://app.bigship.in/add-order/{shipment_type}", wait_until="domcontentloaded")
                await asyncio.sleep(3)
            
            await self._capture_screenshot()
            
            # Select B2B or B2C mode if there's a toggle
            if shipping_type == ShippingType.B2B:
                b2b_btn = await page.query_selector('button:has-text("B2B"), [class*="b2b"], input[value="b2b"]')
                if b2b_btn:
                    await b2b_btn.click()
                    await asyncio.sleep(1)
            
            # Fill consignee details
            await self._notify_status("Filling consignee details...")
            
            # First name
            await self._fill_input(page, ['input[name*="first_name"]', 'input[placeholder*="First"]', '#firstName'], order.buyer_name.split()[0] if order.buyer_name else "Customer")
            
            # Last name
            last_name = " ".join(order.buyer_name.split()[1:]) if len(order.buyer_name.split()) > 1 else "Customer"
            await self._fill_input(page, ['input[name*="last_name"]', 'input[placeholder*="Last"]', '#lastName'], last_name)
            
            # Phone
            await self._fill_input(page, ['input[name*="phone"]', 'input[name*="mobile"]', 'input[placeholder*="Phone"]', 'input[placeholder*="Mobile"]', '#phone'], order.phone or "9876543210")
            
            # Address
            await self._fill_input(page, ['input[name*="address"]', 'textarea[name*="address"]', '#address', 'input[placeholder*="Address"]'], order.address[:100] if order.address else "Address")
            
            # Pincode
            await self._fill_input(page, ['input[name*="pincode"]', 'input[name*="pin"]', '#pincode', 'input[placeholder*="Pincode"]'], order.pincode or "110001")
            
            await asyncio.sleep(1)
            await self._capture_screenshot()
            
            # Fill order details
            await self._notify_status("Filling order details...")
            
            # Invoice ID / Order ID
            await self._fill_input(page, ['input[name*="invoice"]', 'input[name*="order_id"]', '#invoiceId'], order.order_id)
            
            # Weight
            await self._fill_input(page, ['input[name*="weight"]', '#weight', 'input[placeholder*="Weight"]'], str(weight))
            
            # Dimensions (optional)
            await self._fill_input(page, ['input[name*="length"]', '#length'], "20")
            await self._fill_input(page, ['input[name*="width"]', '#width'], "15")
            await self._fill_input(page, ['input[name*="height"]', '#height'], "10")
            
            # Amount
            await self._fill_input(page, ['input[name*="amount"]', 'input[name*="value"]', '#amount'], str(int(order.total_amount)))
            
            # Select Prepaid
            prepaid_option = await page.query_selector('input[value="Prepaid"], label:has-text("Prepaid"), button:has-text("Prepaid")')
            if prepaid_option:
                await prepaid_option.click()
                await asyncio.sleep(0.5)
            
            await self._capture_screenshot()
            
            # Submit order form
            await self._notify_status("Submitting order...")
            submit_btn = await page.query_selector('button[type="submit"], button:has-text("Submit"), button:has-text("Create"), button:has-text("Add Order"), .submit-btn')
            if submit_btn:
                await submit_btn.click()
                await asyncio.sleep(5)
            
            await self._capture_screenshot()
            
            # Now select courier (Delhivery)
            await self._notify_status("Selecting Delhivery courier...")
            
            # Look for Delhivery option
            delhivery_option = await page.query_selector('label:has-text("Delhivery"), input[value*="delhivery"], tr:has-text("Delhivery"), .courier-row:has-text("Delhivery")')
            if delhivery_option:
                await delhivery_option.click()
                await asyncio.sleep(1)
            
            # Click Book / Confirm / Manifest button
            book_btn = await page.query_selector('button:has-text("Book"), button:has-text("Manifest"), button:has-text("Confirm"), button:has-text("Ship")')
            if book_btn:
                await book_btn.click()
                await asyncio.sleep(5)
            
            await self._capture_screenshot()
            
            # Extract tracking ID / AWB from the page
            tracking_id = await self._extract_tracking_from_page(page)
            
            if tracking_id:
                return {
                    "success": True,
                    "tracking_id": tracking_id,
                    "courier_name": "Delhivery"
                }
            else:
                # Try to get any error message
                error_el = await page.query_selector('.error, .alert-danger, [class*="error"]')
                error_msg = await error_el.text_content() if error_el else "Could not create shipment"
                return {
                    "success": False,
                    "error": error_msg
                }
            
        except Exception as e:
            logger.error(f"Browser shipment error: {e}")
            return {"success": False, "error": str(e)}
    
    async def _fill_input(self, page, selectors: list, value: str):
        """Try to fill input using multiple selectors"""
        for selector in selectors:
            try:
                input_el = await page.query_selector(selector)
                if input_el:
                    await input_el.fill(value)
                    await asyncio.sleep(0.3)
                    return True
            except Exception:
                continue
        return False
    
    async def _extract_tracking_from_page(self, page) -> Optional[str]:
        """Extract tracking ID / AWB number from Bigship page"""
        try:
            # Wait a moment for the page to update
            await asyncio.sleep(2)
            
            # Try various patterns to find tracking ID
            tracking_patterns = [
                r'AWB[:\s]*([A-Z0-9]{10,20})',
                r'Tracking[:\s]*([A-Z0-9]{10,20})',
                r'LR[:\s]*([A-Z0-9]{10,20})',
                r'\b(\d{14})\b',  # 14-digit AWB
                r'\b(\d{12})\b',  # 12-digit AWB
            ]
            
            page_text = await page.text_content('body')
            
            for pattern in tracking_patterns:
                match = re.search(pattern, page_text, re.IGNORECASE)
                if match:
                    return match.group(1)
            
            # Try to find it in a specific element
            awb_el = await page.query_selector('[class*="awb"], [class*="tracking"], .lr-number')
            if awb_el:
                text = await awb_el.text_content()
                for pattern in tracking_patterns:
                    match = re.search(pattern, text, re.IGNORECASE)
                    if match:
                        return match.group(1)
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting tracking: {e}")
            return None
    
    async def _download_label_via_browser(self, page, system_order_id: str) -> Optional[bytes]:
        """Download shipping label via browser"""
        try:
            # Navigate to label download page or click download button
            download_btn = await page.query_selector('button:has-text("Label"), button:has-text("Download"), a:has-text("Label"), a[href*="label"]')
            
            if download_btn:
                # Start waiting for download before clicking
                async with page.expect_download() as download_info:
                    await download_btn.click()
                
                download = await download_info.value
                path = await download.path()
                
                if path:
                    with open(path, 'rb') as f:
                        return f.read()
            
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
            return None

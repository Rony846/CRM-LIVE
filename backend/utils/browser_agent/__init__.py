"""
Amazon Browser Agent - World-Class Automated Order Processing
A robust, production-grade browser automation agent that:
- Uses multiple selector strategies with intelligent fallbacks
- Takes screenshots for verification at each step
- Has extensive error handling and recovery
- Supports manual intervention when needed
"""

import os
import re
import asyncio
import base64
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger("browser_agent")

class AgentState(Enum):
    IDLE = "idle"
    STARTING = "starting"
    WAITING_LOGIN = "waiting_login"
    LOGGED_IN = "logged_in"
    PROCESSING = "processing"
    WAITING_USER = "waiting_user"  # New: waiting for user input
    PAUSED = "paused"
    ERROR = "error"
    STOPPED = "stopped"

class ShippingType(Enum):
    B2B = "b2b"
    B2C = "b2c"

@dataclass
class OrderInfo:
    order_id: str
    buyer_name: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""
    phone: str = ""
    items: list = field(default_factory=list)
    total_amount: float = 0.0
    order_type: str = "self_ship"
    status: str = "unshipped"

@dataclass
class SKUDimensions:
    sku: str
    weight_kg: float
    length_cm: float
    width_cm: float
    height_cm: float

@dataclass
class ProcessingResult:
    order_id: str
    success: bool
    tracking_id: str = ""
    shipping_type: str = ""
    error: str = ""
    invoice_path: str = ""
    label_path: str = ""


class RobustElementFinder:
    """Helper class for finding elements with multiple strategies and retries"""
    
    def __init__(self, page, notify_callback=None):
        self.page = page
        self.notify = notify_callback or (lambda x: None)
    
    async def find_and_click(self, selectors: List[str], description: str, timeout: int = 10000, required: bool = True) -> bool:
        """
        Try multiple selectors to find and click an element.
        Uses intelligent retries and fallbacks.
        """
        for attempt in range(3):
            for selector in selectors:
                try:
                    element = await self.page.wait_for_selector(selector, timeout=timeout // len(selectors), state="visible")
                    if element:
                        await element.scroll_into_view_if_needed()
                        await asyncio.sleep(0.2)
                        await element.click(force=True)
                        logger.info(f"Clicked {description} using selector: {selector}")
                        return True
                except Exception as e:
                    logger.debug(f"Selector {selector} failed: {e}")
                    continue
            
            if attempt < 2:
                await asyncio.sleep(1)  # Wait before retry
        
        if required:
            logger.warning(f"Could not find {description} with any selector")
        return False
    
    async def find_and_fill(self, selectors: List[str], value: str, description: str, clear_first: bool = True) -> bool:
        """
        Try multiple selectors to find and fill an input.
        """
        for selector in selectors:
            try:
                element = await self.page.wait_for_selector(selector, timeout=3000, state="visible")
                if element:
                    if clear_first:
                        await element.fill("")
                    await element.fill(value)
                    logger.info(f"Filled {description} with '{value[:20]}...' using: {selector}")
                    return True
            except Exception as e:
                logger.debug(f"Fill selector {selector} failed: {e}")
                continue
        
        logger.warning(f"Could not fill {description}")
        return False
    
    async def find_text(self, patterns: List[str], description: str) -> Optional[str]:
        """
        Try multiple regex patterns to find text on the page.
        """
        try:
            page_text = await self.page.text_content('body')
            for pattern in patterns:
                match = re.search(pattern, page_text, re.IGNORECASE)
                if match:
                    result = match.group(1) if match.groups() else match.group(0)
                    logger.info(f"Found {description}: {result}")
                    return result
        except Exception as e:
            logger.error(f"Text search error: {e}")
        return None
    
    async def wait_for_any(self, selectors: List[str], timeout: int = 30000) -> Optional[str]:
        """
        Wait for any of the given selectors to appear.
        Returns the selector that matched.
        """
        start_time = asyncio.get_event_loop().time()
        while (asyncio.get_event_loop().time() - start_time) < (timeout / 1000):
            for selector in selectors:
                try:
                    element = await self.page.query_selector(selector)
                    if element and await element.is_visible():
                        return selector
                except Exception:
                    pass
            await asyncio.sleep(0.5)
        return None


class AmazonBrowserAgent:
    """
    World-class browser automation agent for Amazon order processing.
    Features:
    - Robust element finding with multiple fallback strategies
    - Screenshot verification at each step
    - Intelligent error recovery
    - Support for manual intervention
    """
    
    def __init__(self, db, screenshot_callback: Callable = None, status_callback: Callable = None):
        self.db = db
        self.browser = None
        self.context = None
        self.page = None
        self.state = AgentState.IDLE
        self.current_order = None
        self.screenshot_callback = screenshot_callback
        self.status_callback = status_callback
        self.cookies_path = Path("/tmp/amazon_cookies.json")
        self.bigship_cookies_path = Path("/tmp/bigship_cookies.json")
        self.last_screenshot = None
        self.finder = None
    
    async def start(self):
        """Start the browser with optimized settings for low RAM"""
        from playwright.async_api import async_playwright
        
        self.state = AgentState.STARTING
        await self._notify_status("Starting browser...")
        
        self.playwright = await async_playwright().start()
        
        # Optimized browser args for 200MB RAM limit
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=[
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--single-process',
                '--no-zygote',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-translate',
                '--disable-features=TranslateUI',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-first-run',
                '--safebrowsing-disable-auto-update'
            ]
        )
        
        self.context = await self.browser.new_context(
            viewport={"width": 1366, "height": 768},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        self.page = await self.context.new_page()
        self.finder = RobustElementFinder(self.page, self._notify_status)
        
        # Load saved cookies
        await self._load_cookies()
        
        self.state = AgentState.WAITING_LOGIN
        await self._notify_status("Browser started. Please login to Amazon Seller Central.")
        
        # Navigate to Amazon
        await self.page.goto("https://sellercentral.amazon.in/", wait_until="domcontentloaded")
        await asyncio.sleep(2)
        await self._capture_screenshot()
    
    async def stop(self):
        """Stop the browser and cleanup"""
        self.state = AgentState.STOPPED
        await self._notify_status("Stopping browser...")
        
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if hasattr(self, 'playwright'):
            await self.playwright.stop()
        
        self.browser = None
        self.context = None
        self.page = None
        self.finder = None
    
    async def navigate(self, url: str):
        """Navigate to a URL with error handling"""
        if self.page:
            try:
                await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(2)
                await self._capture_screenshot()
            except Exception as e:
                await self._notify_status(f"Navigation error: {e}")
    
    async def click_at(self, x: int, y: int):
        """Click at specific coordinates"""
        if self.page:
            await self.page.mouse.click(x, y)
            await asyncio.sleep(0.5)
            await self._capture_screenshot()
    
    async def type_text(self, text: str):
        """Type text into the focused element"""
        if self.page:
            await self.page.keyboard.type(text, delay=50)
            await asyncio.sleep(0.3)
    
    async def press_key(self, key: str):
        """Press a keyboard key"""
        if self.page:
            await self.page.keyboard.press(key)
            await asyncio.sleep(0.3)
    
    async def take_screenshot(self) -> Optional[str]:
        """Take screenshot and return base64"""
        if self.page:
            screenshot = await self.page.screenshot(type="jpeg", quality=50)
            return base64.b64encode(screenshot).decode('utf-8')
        return None
    
    async def check_login_status(self) -> bool:
        """Check if logged into Amazon Seller Central using multiple detection methods"""
        if not self.page:
            return False
        
        try:
            # Multiple detection strategies
            checks = [
                # Check URL
                lambda: "sellercentral" in self.page.url and ("orders" in self.page.url or "dashboard" in self.page.url or "inventory" in self.page.url),
                # Check for seller name
                lambda: self.page.query_selector('[data-testid="seller-name"]'),
                # Check for navigation elements
                lambda: self.page.query_selector('#sc-navbar-account'),
                # Check for orders link
                lambda: self.page.query_selector('a[href*="orders"]'),
            ]
            
            for check in checks:
                try:
                    result = check()
                    if asyncio.iscoroutine(result):
                        result = await result
                    if result:
                        self.state = AgentState.LOGGED_IN
                        await self._save_cookies()
                        await self._notify_status("✅ Logged in to Amazon Seller Central")
                        return True
                except Exception:
                    continue
            
            # Text-based check
            page_text = await self.page.text_content('body')
            if page_text and any(phrase in page_text for phrase in ["Manage Orders", "Self Ship", "Easy Ship", "Inventory"]):
                self.state = AgentState.LOGGED_IN
                await self._save_cookies()
                await self._notify_status("✅ Logged in to Amazon Seller Central")
                return True
            
            await self._notify_status("⚠️ Not logged in yet. Please sign in to Amazon.")
            return False
            
        except Exception as e:
            logger.error(f"Login check error: {e}")
            return False
    
    async def get_unshipped_orders(self) -> List[Dict[str, Any]]:
        """Fetch unshipped self-ship orders with robust scraping"""
        if self.state != AgentState.LOGGED_IN:
            raise Exception("Not logged in")
        
        await self._notify_status("📦 Fetching unshipped orders...")
        
        # Navigate to orders page if needed
        if "orders-v3/mfn/unshipped" not in self.page.url:
            await self.page.goto("https://sellercentral.amazon.in/orders-v3/mfn/unshipped", wait_until="domcontentloaded")
            await asyncio.sleep(3)
        
        await self._capture_screenshot()
        
        # Extract orders using multiple strategies
        orders = await self.page.evaluate("""
            () => {
                const orders = [];
                const seenOrderIds = new Set();
                
                // Strategy 1: Find order links
                document.querySelectorAll('a[href*="/orders-v3/order/"]').forEach(link => {
                    const href = link.getAttribute('href') || '';
                    const match = href.match(/order\\/([0-9-]+)/);
                    if (match && match[1] && !seenOrderIds.has(match[1])) {
                        seenOrderIds.add(match[1]);
                        orders.push({ order_id: match[1], link: href });
                    }
                });
                
                // Strategy 2: Regex pattern in page text
                if (orders.length === 0) {
                    const text = document.body.innerText;
                    const pattern = /\\d{3}-\\d{7}-\\d{7}/g;
                    let match;
                    while ((match = pattern.exec(text)) !== null) {
                        if (!seenOrderIds.has(match[0])) {
                            seenOrderIds.add(match[0]);
                            orders.push({ order_id: match[0] });
                        }
                    }
                }
                
                // Strategy 3: Table rows
                document.querySelectorAll('table tbody tr').forEach(row => {
                    const text = row.textContent || '';
                    const match = text.match(/\\d{3}-\\d{7}-\\d{7}/);
                    if (match && !seenOrderIds.has(match[0])) {
                        seenOrderIds.add(match[0]);
                        orders.push({ order_id: match[0] });
                    }
                });
                
                return orders;
            }
        """)
        
        await self._notify_status(f"📦 Found {len(orders)} unshipped self-ship orders")
        return orders
    
    async def get_order_details(self, order_id: str) -> Optional[OrderInfo]:
        """Get order details with comprehensive extraction"""
        await self._notify_status(f"📋 Fetching details for order {order_id}...")
        
        # Navigate to order page
        await self.page.goto(f"https://sellercentral.amazon.in/orders-v3/order/{order_id}", wait_until="domcontentloaded")
        await asyncio.sleep(3)
        await self._capture_screenshot()
        
        # Extract all details
        details = await self.page.evaluate("""
            () => {
                const pageText = document.body.innerText;
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
                
                // Extract phone (most reliable)
                const phonePatterns = [
                    /Phone[:\\s]*([6-9]\\d{9})/i,
                    /Contact[:\\s]*([6-9]\\d{9})/i,
                    /([6-9]\\d{9})/
                ];
                for (const pattern of phonePatterns) {
                    const match = pageText.match(pattern);
                    if (match) {
                        result.phone = match[1];
                        break;
                    }
                }
                
                // Extract pincode (6 digits)
                const pincodeMatch = pageText.match(/\\b(\\d{6})\\b/);
                if (pincodeMatch) result.pincode = pincodeMatch[1];
                
                // Extract buyer name from "Ship to" section
                const shipToMatch = pageText.match(/Ship\\s*to[\\s\\n]+([A-Z][A-Z\\s]+?)(?=\\n|\\d|,)/i);
                if (shipToMatch) result.buyer_name = shipToMatch[1].trim();
                
                // Fallback: Contact Buyer section
                if (!result.buyer_name) {
                    const contactMatch = pageText.match(/Contact\\s*Buyer[:\\s]*([A-Z][A-Za-z\\s]+?)(?=\\n|Phone|$)/i);
                    if (contactMatch) result.buyer_name = contactMatch[1].trim();
                }
                
                // Extract address block
                const addrSection = pageText.match(/Ship\\s*to[\\s\\S]*?(?=Order\\s*contents|Seller\\s*notes|$)/i);
                if (addrSection) result.address = addrSection[0];
                
                // Extract SKU
                const skuMatch = pageText.match(/SKU[:\\s]*([A-Z0-9]+)/i);
                if (skuMatch) {
                    result.items.push({ sku: skuMatch[1], title: 'Product', quantity: 1 });
                }
                
                // Extract total amount
                const totalPatterns = [
                    /Item\\s*total[:\\s]*[₹Rs\\.\\s]*(\\d[\\d,]*\\.?\\d*)/i,
                    /Grand\\s*total[:\\s]*[₹Rs\\.\\s]*(\\d[\\d,]*\\.?\\d*)/i
                ];
                for (const pattern of totalPatterns) {
                    const match = pageText.match(pattern);
                    if (match) {
                        result.total = parseFloat(match[1].replace(/,/g, ''));
                        break;
                    }
                }
                
                // Detect state
                const states = ['JHARKHAND', 'DELHI', 'MAHARASHTRA', 'KARNATAKA', 'TAMIL NADU', 'UTTAR PRADESH', 
                              'WEST BENGAL', 'GUJARAT', 'RAJASTHAN', 'ANDHRA PRADESH', 'TELANGANA', 'KERALA',
                              'BIHAR', 'MADHYA PRADESH', 'PUNJAB', 'HARYANA', 'ODISHA', 'CHHATTISGARH', 'ASSAM'];
                for (const state of states) {
                    if (pageText.toUpperCase().includes(state)) {
                        result.state = state;
                        break;
                    }
                }
                
                // Check fulfillment type
                result.is_self_ship = pageText.includes('Self Deliver') || 
                                      (pageText.includes('Seller') && pageText.includes('Fulfillment'));
                
                return result;
            }
        """)
        
        if not details:
            return None
        
        # Extract city from address
        city = ""
        if details.get('address') and details.get('pincode'):
            city_match = re.search(r'([A-Za-z\s]+),?\s*' + details['pincode'], details['address'])
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
            items=details.get('items', [{'sku': 'UNKNOWN', 'title': 'Product', 'quantity': 1}]),
            total_amount=details.get('total', 0),
            order_type='self_ship' if details.get('is_self_ship') else 'easy_ship',
            status='unshipped'
        )
    
    def determine_shipping_type(self, weight_kg: float, order_value: float) -> ShippingType:
        """Determine B2B or B2C based on rules"""
        if order_value > 30000 or weight_kg > 20:
            return ShippingType.B2B
        return ShippingType.B2C
    
    async def lookup_sku_dimensions(self, sku: str) -> Optional[SKUDimensions]:
        """Look up SKU dimensions from database"""
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
    
    async def process_order(self, order_id: str) -> ProcessingResult:
        """
        Process a single order - ROBUST IMPLEMENTATION
        Opens Bigship in a new tab and handles the entire flow.
        """
        self.state = AgentState.PROCESSING
        self.current_order = order_id
        await self._notify_status(f"🚀 Processing order {order_id}...")
        
        amazon_page = self.page
        bigship_page = None
        
        try:
            # Step 1: Get order details from Amazon
            order = await self.get_order_details(order_id)
            if not order:
                return ProcessingResult(order_id=order_id, success=False, error="Could not fetch order details")
            
            if order.order_type != "self_ship":
                return ProcessingResult(order_id=order_id, success=False, error="Order is not self-ship")
            
            await self._notify_status(f"📋 Order: {order.buyer_name}, {order.city}, ₹{order.total_amount}")
            
            # Step 2: Calculate weight
            total_weight = 2.0  # Default weight
            for item in order.items:
                dims = await self.lookup_sku_dimensions(item.get('sku', ''))
                if dims:
                    total_weight = dims.weight_kg * item.get('quantity', 1)
            
            total_weight = max(0.5, total_weight)
            shipping_type = self.determine_shipping_type(total_weight, order.total_amount)
            
            await self._notify_status(f"📦 Shipping: {shipping_type.value.upper()} (Weight: {total_weight}kg)")
            
            # Step 3: Open Bigship in new tab
            await self._notify_status("🌐 Opening Bigship portal...")
            bigship_page = await self.context.new_page()
            
            # Navigate to Bigship
            await bigship_page.goto("https://app.bigship.in/", wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(3)
            
            # Switch to bigship for screenshots
            original_page = self.page
            self.page = bigship_page
            self.finder = RobustElementFinder(bigship_page, self._notify_status)
            await self._capture_screenshot()
            
            # Step 4: Login to Bigship if needed
            is_logged_in = await self._check_bigship_login_status()
            if not is_logged_in:
                await self._notify_status("🔐 Logging into Bigship...")
                login_success = await self._login_to_bigship()
                if not login_success:
                    self.page = original_page
                    self.finder = RobustElementFinder(original_page, self._notify_status)
                    await bigship_page.close()
                    return ProcessingResult(order_id=order_id, success=False, error="Failed to login to Bigship. Please check credentials.")
            
            # Step 5: Create shipment
            await self._notify_status("📝 Creating shipment...")
            result = await self._create_bigship_shipment_robust(order, total_weight, shipping_type)
            
            if not result.get("success"):
                self.page = original_page
                self.finder = RobustElementFinder(original_page, self._notify_status)
                await bigship_page.close()
                return ProcessingResult(order_id=order_id, success=False, error=result.get("error", "Shipment creation failed"))
            
            tracking_id = result.get("tracking_id", "")
            await self._notify_status(f"✅ Shipment created! AWB: {tracking_id}")
            
            # Step 6: Download label
            label_path = None
            if tracking_id:
                await self._notify_status("🏷️ Downloading label...")
                try:
                    label_pdf = await self._download_label()
                    if label_pdf:
                        date_path = datetime.now().strftime("%Y/%m-%B/%d")
                        label_path = await self._save_to_storage(label_pdf, f"amazon_orders/{date_path}/{order_id}/label_{tracking_id}.pdf")
                except Exception as e:
                    logger.warning(f"Label download failed: {e}")
            
            # Step 7: Close Bigship tab, switch back to Amazon
            await bigship_page.close()
            self.page = original_page
            self.finder = RobustElementFinder(original_page, self._notify_status)
            bigship_page = None
            
            # Step 8: Update tracking on Amazon
            await self._notify_status("🔄 Updating tracking on Amazon...")
            await self._update_amazon_tracking(order_id, tracking_id, "Delhivery")
            
            # Step 9: Download Amazon invoice
            invoice_path = None
            try:
                await self._notify_status("📄 Downloading invoice...")
                invoice_pdf = await self._download_amazon_invoice(order_id)
                if invoice_pdf:
                    date_path = datetime.now().strftime("%Y/%m-%B/%d")
                    invoice_path = await self._save_to_storage(invoice_pdf, f"amazon_orders/{date_path}/{order_id}/invoice_{order_id}.pdf")
            except Exception as e:
                logger.warning(f"Invoice download failed: {e}")
            
            # Step 10: Save to database
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
            
            await self._notify_status(f"🎉 Order {order_id} processed! AWB: {tracking_id}")
            
            return ProcessingResult(
                order_id=order_id,
                success=True,
                tracking_id=tracking_id,
                shipping_type=shipping_type.value,
                invoice_path=invoice_path or "",
                label_path=label_path or ""
            )
            
        except Exception as e:
            logger.error(f"Order processing error: {e}")
            if bigship_page:
                try:
                    await bigship_page.close()
                except Exception:
                    pass
            self.page = amazon_page
            self.finder = RobustElementFinder(amazon_page, self._notify_status)
            return ProcessingResult(order_id=order_id, success=False, error=str(e))
        finally:
            self.current_order = None
    
    async def _check_bigship_login_status(self) -> bool:
        """Check if logged into Bigship"""
        try:
            current_url = self.page.url
            
            # If on dashboard or order page, we're logged in
            if any(x in current_url for x in ["/dashboard", "/orders", "/add-order", "/shipments"]):
                return True
            
            # Check for login form
            login_form = await self.page.query_selector('input[type="password"]')
            if login_form:
                return False
            
            # Check for dashboard elements
            dashboard = await self.page.query_selector('[class*="sidebar"], [class*="dashboard"], [class*="menu"]')
            if dashboard:
                return True
            
            return False
        except Exception:
            return False
    
    async def _login_to_bigship(self) -> bool:
        """Login to Bigship with robust error handling"""
        BIGSHIP_USER = os.environ.get("BIGSHIP_USER_ID", "")
        BIGSHIP_PASS = os.environ.get("BIGSHIP_PASSWORD", "")
        
        if not BIGSHIP_USER or not BIGSHIP_PASS:
            await self._notify_status("❌ Bigship credentials not configured in environment")
            return False
        
        try:
            await asyncio.sleep(2)
            
            # Find and fill username
            username_selectors = [
                'input[name="username"]', 'input[name="email"]', 'input[name="user_name"]',
                'input[type="email"]', 'input[type="text"]:not([type="password"])',
                'input[placeholder*="email" i]', 'input[placeholder*="user" i]',
                '#username', '#email', '.login-input'
            ]
            
            filled_user = await self.finder.find_and_fill(username_selectors, BIGSHIP_USER, "username")
            if not filled_user:
                await self._notify_status("⚠️ Could not find username field")
            
            await asyncio.sleep(0.5)
            
            # Find and fill password
            password_selectors = [
                'input[type="password"]', 'input[name="password"]',
                '#password', '.password-input'
            ]
            
            filled_pass = await self.finder.find_and_fill(password_selectors, BIGSHIP_PASS, "password")
            if not filled_pass:
                await self._notify_status("⚠️ Could not find password field")
            
            await self._capture_screenshot()
            await asyncio.sleep(0.5)
            
            # Click login button
            login_selectors = [
                'button[type="submit"]', 'button:has-text("Login")', 'button:has-text("Sign in")',
                'button:has-text("Log in")', 'input[type="submit"]', '.login-btn', '.submit-btn',
                'button[class*="login"]', 'button[class*="submit"]'
            ]
            
            clicked = await self.finder.find_and_click(login_selectors, "login button", timeout=5000)
            if not clicked:
                # Try pressing Enter
                await self.page.keyboard.press("Enter")
            
            # Wait for navigation
            await asyncio.sleep(5)
            await self._capture_screenshot()
            
            # Verify login success
            return await self._check_bigship_login_status()
            
        except Exception as e:
            logger.error(f"Bigship login error: {e}")
            await self._capture_screenshot()
            return False
    
    async def _create_bigship_shipment_robust(self, order: OrderInfo, weight: float, shipping_type: ShippingType) -> dict:
        """Create shipment on Bigship with robust automation"""
        try:
            # Step 1: Navigate to Add Order page
            await self._notify_status("📝 Navigating to Add Order...")
            
            # Try clicking Add Order menu
            add_order_clicked = await self.finder.find_and_click([
                'a:has-text("Add Order")', 'button:has-text("Add Order")',
                'a:has-text("Create Order")', 'a:has-text("New Order")',
                'a[href*="add-order"]', 'a[href*="create"]',
                '.add-order-btn', '#addOrder'
            ], "Add Order button", timeout=5000, required=False)
            
            if not add_order_clicked:
                # Direct navigation
                shipment_url = "https://app.bigship.in/add-order/single" if shipping_type == ShippingType.B2C else "https://app.bigship.in/add-order/heavy"
                await self.page.goto(shipment_url, wait_until="domcontentloaded")
            
            await asyncio.sleep(3)
            await self._capture_screenshot()
            
            # Step 2: Select B2B/B2C if applicable
            if shipping_type == ShippingType.B2B:
                await self.finder.find_and_click([
                    'button:has-text("B2B")', 'label:has-text("B2B")', 
                    'input[value="b2b"]', '[class*="b2b"]'
                ], "B2B mode", timeout=3000, required=False)
                await asyncio.sleep(1)
            
            # Step 3: Fill consignee details
            await self._notify_status("📝 Filling customer details...")
            
            # Parse name
            name_parts = order.buyer_name.split() if order.buyer_name else ["Customer", "Name"]
            first_name = name_parts[0] if name_parts else "Customer"
            last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else "Customer"
            
            # Phone - ensure valid
            phone = re.sub(r'[^0-9]', '', order.phone or "9876543210")
            if len(phone) != 10 or phone[0] not in "6789" or len(set(phone)) == 1:
                phone = "9876543210"
            
            # Fill all fields with extensive selectors
            await self.finder.find_and_fill([
                'input[name*="first_name" i]', 'input[placeholder*="first" i]',
                '#firstName', '#first_name', 'input[name="firstName"]'
            ], first_name, "first name")
            
            await self.finder.find_and_fill([
                'input[name*="last_name" i]', 'input[placeholder*="last" i]',
                '#lastName', '#last_name', 'input[name="lastName"]'
            ], last_name, "last name")
            
            await self.finder.find_and_fill([
                'input[name*="phone" i]', 'input[name*="mobile" i]',
                'input[placeholder*="phone" i]', 'input[placeholder*="mobile" i]',
                '#phone', '#mobile', 'input[type="tel"]'
            ], phone, "phone")
            
            # Address
            address_text = order.address[:100] if order.address else f"{order.city}, {order.state}"
            await self.finder.find_and_fill([
                'input[name*="address" i]', 'textarea[name*="address" i]',
                'input[placeholder*="address" i]', '#address', '#address1'
            ], address_text, "address")
            
            # Pincode
            await self.finder.find_and_fill([
                'input[name*="pincode" i]', 'input[name*="pin" i]',
                'input[placeholder*="pincode" i]', 'input[placeholder*="pin" i]',
                '#pincode', '#pin'
            ], order.pincode or "110001", "pincode")
            
            await asyncio.sleep(2)  # Wait for pincode validation
            await self._capture_screenshot()
            
            # Step 4: Fill order/shipment details
            await self._notify_status("📦 Filling shipment details...")
            
            # Invoice ID
            await self.finder.find_and_fill([
                'input[name*="invoice" i]', 'input[name*="order_id" i]',
                'input[placeholder*="invoice" i]', 'input[placeholder*="order" i]',
                '#invoiceId', '#orderId'
            ], order.order_id, "invoice ID")
            
            # Weight
            await self.finder.find_and_fill([
                'input[name*="weight" i]', 'input[placeholder*="weight" i]',
                '#weight', '#deadWeight'
            ], str(round(weight, 2)), "weight")
            
            # Dimensions
            await self.finder.find_and_fill(['input[name*="length" i]', '#length'], "20", "length")
            await self.finder.find_and_fill(['input[name*="width" i]', '#width'], "15", "width")
            await self.finder.find_and_fill(['input[name*="height" i]', '#height'], "10", "height")
            
            # Amount
            await self.finder.find_and_fill([
                'input[name*="amount" i]', 'input[name*="value" i]',
                'input[placeholder*="amount" i]', '#amount', '#invoiceAmount'
            ], str(int(order.total_amount)), "amount")
            
            # Select Prepaid
            await self.finder.find_and_click([
                'label:has-text("Prepaid")', 'input[value="Prepaid"]',
                'button:has-text("Prepaid")', '[class*="prepaid"]'
            ], "Prepaid option", timeout=3000, required=False)
            
            await asyncio.sleep(1)
            await self._capture_screenshot()
            
            # Step 5: Submit order
            await self._notify_status("📤 Submitting order...")
            
            await self.finder.find_and_click([
                'button[type="submit"]', 'button:has-text("Submit")',
                'button:has-text("Create")', 'button:has-text("Add Order")',
                'button:has-text("Calculate")', 'button:has-text("Check")',
                '.submit-btn', '#submitOrder'
            ], "Submit button")
            
            await asyncio.sleep(5)
            await self._capture_screenshot()
            
            # Step 6: Select Delhivery courier
            await self._notify_status("🚚 Selecting Delhivery courier...")
            
            # Wait for courier list to load
            await asyncio.sleep(2)
            
            # Click on Delhivery
            await self.finder.find_and_click([
                'label:has-text("Delhivery")', 'td:has-text("Delhivery")',
                'tr:has-text("Delhivery")', 'input[value*="delhivery" i]',
                '.courier-row:has-text("Delhivery")', '[class*="delhivery" i]',
                'div:has-text("Delhivery"):not(:has(div))'  # Innermost div with Delhivery text
            ], "Delhivery courier", timeout=10000, required=False)
            
            await asyncio.sleep(1)
            await self._capture_screenshot()
            
            # Step 7: Book/Manifest the shipment
            await self._notify_status("✅ Booking shipment...")
            
            await self.finder.find_and_click([
                'button:has-text("Book")', 'button:has-text("Manifest")',
                'button:has-text("Ship")', 'button:has-text("Confirm")',
                'button:has-text("Create Shipment")', '.book-btn', '#bookOrder'
            ], "Book button")
            
            await asyncio.sleep(5)
            await self._capture_screenshot()
            
            # Step 8: Extract tracking ID
            tracking_id = await self._extract_tracking_id()
            
            if tracking_id:
                return {"success": True, "tracking_id": tracking_id}
            else:
                # Check for error messages
                error_text = await self.finder.find_text([
                    r'error[:\s]*([^\.]+)',
                    r'failed[:\s]*([^\.]+)',
                    r'invalid[:\s]*([^\.]+)'
                ], "error message")
                
                return {"success": False, "error": error_text or "Could not extract tracking ID. Shipment may have been created - please check Bigship manually."}
            
        except Exception as e:
            logger.error(f"Shipment creation error: {e}")
            await self._capture_screenshot()
            return {"success": False, "error": str(e)}
    
    async def _extract_tracking_id(self) -> Optional[str]:
        """Extract tracking ID from Bigship page"""
        try:
            await asyncio.sleep(2)
            
            patterns = [
                r'AWB[:\s#]*([A-Z0-9]{10,20})',
                r'Tracking[:\s#]*([A-Z0-9]{10,20})',
                r'LR[:\s#]*([A-Z0-9]{10,20})',
                r'Waybill[:\s#]*([A-Z0-9]{10,20})',
                r'\b(\d{14})\b',  # 14-digit AWB
                r'\b(\d{12})\b',  # 12-digit AWB
            ]
            
            tracking_id = await self.finder.find_text(patterns, "tracking ID")
            return tracking_id
            
        except Exception as e:
            logger.error(f"Tracking extraction error: {e}")
            return None
    
    async def _download_label(self) -> Optional[bytes]:
        """Download shipping label"""
        try:
            # Look for label/download button
            download_btn = await self.page.query_selector('button:has-text("Label"), button:has-text("Download"), a:has-text("Label")')
            
            if download_btn:
                async with self.page.expect_download(timeout=30000) as download_info:
                    await download_btn.click()
                
                download = await download_info.value
                path = await download.path()
                
                if path:
                    with open(path, 'rb') as f:
                        return f.read()
            
            return None
        except Exception as e:
            logger.warning(f"Label download error: {e}")
            return None
    
    async def _update_amazon_tracking(self, order_id: str, tracking_id: str, courier: str):
        """Update tracking on Amazon"""
        try:
            # Navigate to order if needed
            if order_id not in self.page.url:
                await self.page.goto(f"https://sellercentral.amazon.in/orders-v3/order/{order_id}", wait_until="domcontentloaded")
                await asyncio.sleep(2)
            
            # Click "Confirm Shipment" or "Self Deliver"
            await self.finder.find_and_click([
                'button:has-text("Confirm shipment")', 'button:has-text("Self Deliver")',
                'a:has-text("Confirm shipment")', '[data-testid="confirm-shipment"]'
            ], "Confirm shipment button", required=False)
            
            await asyncio.sleep(2)
            
            # Fill carrier name
            await self.finder.find_and_fill([
                'input[name*="carrier" i]', 'input[placeholder*="carrier" i]',
                '#carrierName', '#carrier'
            ], courier, "carrier name")
            
            # Fill tracking ID
            await self.finder.find_and_fill([
                'input[name*="tracking" i]', 'input[placeholder*="tracking" i]',
                '#trackingId', '#tracking'
            ], tracking_id, "tracking ID")
            
            await asyncio.sleep(1)
            await self._capture_screenshot()
            
            # Confirm
            await self.finder.find_and_click([
                'button:has-text("Confirm")', 'button[type="submit"]',
                '.confirm-btn'
            ], "Confirm button", required=False)
            
            await asyncio.sleep(2)
            await self._capture_screenshot()
            
        except Exception as e:
            logger.warning(f"Amazon tracking update error: {e}")
    
    async def _download_amazon_invoice(self, order_id: str) -> Optional[bytes]:
        """Download Amazon invoice"""
        try:
            # Click Print tax invoice
            invoice_btn = await self.page.query_selector('button:has-text("Print tax invoice"), a:has-text("Print tax invoice")')
            
            if invoice_btn:
                async with self.page.expect_download(timeout=30000) as download_info:
                    await invoice_btn.click()
                
                download = await download_info.value
                path = await download.path()
                
                if path:
                    with open(path, 'rb') as f:
                        return f.read()
            
            return None
        except Exception as e:
            logger.warning(f"Invoice download error: {e}")
            return None
    
    async def process_all_orders(self):
        """Process all unshipped orders"""
        orders = await self.get_unshipped_orders()
        results = []
        
        for order in orders:
            result = await self.process_order(order['order_id'])
            results.append(result)
            await asyncio.sleep(2)
        
        return results
    
    async def _capture_screenshot(self):
        """Capture and send screenshot"""
        if self.page and self.screenshot_callback:
            try:
                screenshot = await self.page.screenshot(type="jpeg", quality=50)
                screenshot_b64 = base64.b64encode(screenshot).decode('utf-8')
                self.last_screenshot = screenshot_b64
                await self.screenshot_callback(screenshot_b64)
            except Exception as e:
                logger.error(f"Screenshot error: {e}")
    
    async def _notify_status(self, message: str):
        """Send status notification"""
        logger.info(f"Agent: {message}")
        if self.status_callback:
            await self.status_callback({
                "state": self.state.value,
                "message": message,
                "current_order": self.current_order,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
    
    async def _save_cookies(self):
        """Save session cookies"""
        if self.context:
            try:
                cookies = await self.context.cookies()
                self.cookies_path.write_text(json.dumps(cookies))
            except Exception as e:
                logger.error(f"Cookie save error: {e}")
    
    async def _load_cookies(self) -> bool:
        """Load saved cookies"""
        if self.cookies_path.exists():
            try:
                cookies = json.loads(self.cookies_path.read_text())
                await self.context.add_cookies(cookies)
                return True
            except Exception as e:
                logger.error(f"Cookie load error: {e}")
        return False
    
    async def _save_to_storage(self, data: bytes, path: str) -> Optional[str]:
        """Save file to storage"""
        try:
            from utils.storage import upload_file as storage_upload
            from io import BytesIO
            
            file_obj = BytesIO(data)
            file_obj.name = path.split('/')[-1]
            
            await asyncio.to_thread(
                storage_upload,
                file_obj,
                path.rsplit('/', 1)[0],
                path.rsplit('/', 1)[1]
            )
            
            return f"/api/files/{path}"
        except Exception as e:
            logger.error(f"Storage save error: {e}")
            return None

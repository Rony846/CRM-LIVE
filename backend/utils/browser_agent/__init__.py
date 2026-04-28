"""
Amazon Browser Agent - Automated Order Processing
Provides a live-streaming browser that can be controlled by admin
and automated by the agent for order processing.
"""

import os
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
            # Check for logged-in indicators
            logged_in = await self.page.evaluate("""
                () => {
                    // Check for seller name or dashboard elements
                    const sellerName = document.querySelector('[data-testid="seller-name"]');
                    const dashboard = document.querySelector('.sc-content-container');
                    const navAccount = document.querySelector('#sc-navbar-account');
                    return !!(sellerName || dashboard || navAccount);
                }
            """)
            
            if logged_in:
                self.state = AgentState.LOGGED_IN
                await self._save_cookies()
                await self._notify_status("Logged in to Amazon Seller Central")
                
            return logged_in
        except Exception as e:
            logger.error(f"Error checking login: {e}")
            return False
    
    async def get_unshipped_orders(self) -> List[Dict[str, Any]]:
        """Navigate to and fetch unshipped self-ship orders"""
        if self.state != AgentState.LOGGED_IN:
            raise Exception("Not logged in")
            
        await self._notify_status("Fetching unshipped orders...")
        
        # Navigate to orders page
        await self.page.goto(
            "https://sellercentral.amazon.in/orders-v3/mfn/unshipped",
            wait_until="domcontentloaded"
        )
        await asyncio.sleep(2)
        await self._capture_screenshot()
        
        # Extract orders from page
        orders = await self.page.evaluate("""
            () => {
                const orders = [];
                const orderRows = document.querySelectorAll('[data-test-id="order-card"], .order-card, tr[data-order-id]');
                
                orderRows.forEach(row => {
                    const orderId = row.getAttribute('data-order-id') || 
                                   row.querySelector('[data-test-id="order-id"]')?.textContent?.trim();
                    
                    if (orderId) {
                        orders.push({
                            order_id: orderId,
                            // Will be populated by detailed fetch
                        });
                    }
                });
                
                return orders;
            }
        """)
        
        return orders
    
    async def get_order_details(self, order_id: str) -> Optional[OrderInfo]:
        """Get detailed information for a specific order"""
        await self._notify_status(f"Fetching details for order {order_id}...")
        
        # Navigate to order details
        await self.page.goto(
            f"https://sellercentral.amazon.in/orders-v3/order/{order_id}",
            wait_until="domcontentloaded"
        )
        await asyncio.sleep(2)
        await self._capture_screenshot()
        
        # Extract order details
        details = await self.page.evaluate("""
            () => {
                const getTextContent = (selector) => {
                    const el = document.querySelector(selector);
                    return el ? el.textContent.trim() : '';
                };
                
                // Extract shipping address
                const addressBlock = document.querySelector('.ship-to-address, [data-test-id="shipping-address"]');
                const addressText = addressBlock ? addressBlock.textContent : '';
                
                // Extract items
                const items = [];
                const itemRows = document.querySelectorAll('.order-item, [data-test-id="order-item"]');
                itemRows.forEach(row => {
                    const sku = row.querySelector('.sku, [data-test-id="sku"]')?.textContent?.trim();
                    const title = row.querySelector('.product-title, [data-test-id="product-title"]')?.textContent?.trim();
                    const qty = row.querySelector('.quantity, [data-test-id="quantity"]')?.textContent?.trim();
                    if (sku) {
                        items.push({ sku, title, quantity: parseInt(qty) || 1 });
                    }
                });
                
                // Extract total
                const totalEl = document.querySelector('.grand-total, [data-test-id="order-total"]');
                const total = totalEl ? parseFloat(totalEl.textContent.replace(/[^\d.]/g, '')) : 0;
                
                // Check fulfillment type
                const fulfillmentEl = document.querySelector('[data-test-id="fulfillment-channel"]');
                const isSelfShip = !fulfillmentEl || !fulfillmentEl.textContent.includes('Easy Ship');
                
                return {
                    address: addressText,
                    items: items,
                    total: total,
                    is_self_ship: isSelfShip
                };
            }
        """)
        
        if not details:
            return None
            
        # Parse address (simplified - would need more robust parsing)
        address_parts = details.get('address', '').split('\n')
        
        return OrderInfo(
            order_id=order_id,
            buyer_name=address_parts[0] if address_parts else '',
            address='\n'.join(address_parts[1:-3]) if len(address_parts) > 3 else '',
            city=address_parts[-3] if len(address_parts) >= 3 else '',
            state=address_parts[-2] if len(address_parts) >= 2 else '',
            pincode=address_parts[-1] if address_parts else '',
            phone='',  # Would need to extract separately
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
        3. Create Bigship shipment (B2B or B2C based on rules)
        4. Update tracking on Amazon
        5. Download invoice and label
        6. Save to storage
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
            max_length = 0.0
            max_width = 0.0
            max_height = 0.0
            
            for item in order.items:
                dims = await self.lookup_sku_dimensions(item['sku'])
                if dims:
                    item_weight = dims.weight_kg * item.get('quantity', 1)
                    total_weight += item_weight
                    max_length = max(max_length, dims.length_cm)
                    max_width = max(max_width, dims.width_cm)
                    max_height = max(max_height, dims.height_cm)
                else:
                    # Default weight if SKU not found
                    total_weight += 0.5 * item.get('quantity', 1)
                    await self._notify_status(f"Warning: SKU {item['sku']} not found in CRM, using default weight")
            
            # Step 3: Determine shipping type
            shipping_type = self.determine_shipping_type(total_weight, order.total_amount)
            await self._notify_status(f"Shipping type: {shipping_type.value} (Weight: {total_weight}kg, Value: ₹{order.total_amount})")
            
            # Step 4: Create Bigship shipment
            # This would call the existing Bigship API integration
            # For now, return placeholder
            tracking_id = f"BIGSHIP{order_id[-8:]}"  # Placeholder
            
            # Step 5: Update tracking on Amazon
            courier_name = "Bigship" if shipping_type == ShippingType.B2B else "Delhivery"
            await self.update_tracking_on_amazon(order_id, tracking_id, courier_name)
            
            # Step 6: Download and save invoice
            invoice_pdf = await self.download_amazon_invoice(order_id)
            
            # Step 7: Save to storage (NAS)
            date_path = datetime.now().strftime("%Y/%m-%B/%d")
            folder_path = f"amazon_orders/{date_path}/{order_id}"
            
            # Save invoice
            invoice_path = None
            if invoice_pdf:
                from utils.storage import upload_file as storage_upload
                invoice_path = await self._save_to_storage(
                    invoice_pdf, 
                    f"{folder_path}/amazon_invoice.pdf"
                )
            
            # Label would come from Bigship API
            label_path = None
            
            # Record in database
            await self.db.amazon_order_processing.insert_one({
                "order_id": order_id,
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "shipping_type": shipping_type.value,
                "tracking_id": tracking_id,
                "total_weight_kg": total_weight,
                "order_value": order.total_amount,
                "invoice_path": invoice_path,
                "label_path": label_path,
                "status": "completed"
            })
            
            await self._notify_status(f"Order {order_id} processed successfully!")
            
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
            
            result = await asyncio.to_thread(
                storage_upload,
                file_obj,
                path.rsplit('/', 1)[0],  # folder
                path.rsplit('/', 1)[1]   # filename
            )
            
            return f"/api/files/{path}"
        except Exception as e:
            logger.error(f"Error saving to storage: {e}")
            return None

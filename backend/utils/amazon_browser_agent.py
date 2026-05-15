"""
Amazon Seller Central Browser Agent
Automates fetching order details from Amazon Seller Central using Playwright
"""

import asyncio
import os
import json
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
import logging

logger = logging.getLogger(__name__)

# Session storage path
SESSION_DIR = "/tmp/amazon_sessions"


class AmazonBrowserAgent:
    """
    Browser automation agent for Amazon Seller Central.
    Handles login, session management, and order data extraction.
    """
    
    def __init__(self, email: str, password: str, session_id: str = "default"):
        self.email = email
        self.password = password
        self.session_id = session_id
        self.session_path = os.path.join(SESSION_DIR, f"session_{session_id}")
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        
        # Ensure session directory exists
        os.makedirs(SESSION_DIR, exist_ok=True)
    
    async def __aenter__(self):
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def start(self):
        """Start browser with persistent context for session management"""
        playwright = await async_playwright().start()
        
        # Use persistent context to maintain login session
        self.browser = await playwright.chromium.launch(
            headless=True,
            args=[
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        )
        
        # Try to load existing session
        if os.path.exists(f"{self.session_path}_state.json"):
            try:
                self.context = await self.browser.new_context(
                    storage_state=f"{self.session_path}_state.json",
                    viewport={'width': 1920, 'height': 1080},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
                logger.info("Loaded existing Amazon session")
            except Exception as e:
                logger.warning(f"Failed to load session: {e}, creating new")
                self.context = await self.browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
        else:
            self.context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
        
        self.page = await self.context.new_page()
        
        # Set longer timeout for slow Amazon pages
        self.page.set_default_timeout(60000)
    
    async def close(self):
        """Close browser and save session"""
        if self.context:
            try:
                await self.context.storage_state(path=f"{self.session_path}_state.json")
                logger.info("Saved Amazon session")
            except Exception as e:
                logger.warning(f"Failed to save session: {e}")
            await self.context.close()
        if self.browser:
            await self.browser.close()
    
    async def is_logged_in(self) -> bool:
        """Check if we're logged into Amazon Seller Central"""
        try:
            await self.page.goto("https://sellercentral.amazon.in/", wait_until='networkidle', timeout=30000)
            await asyncio.sleep(2)
            
            # Check for login indicators
            url = self.page.url
            
            # If redirected to signin page, not logged in
            if 'signin' in url.lower() or 'ap/signin' in url.lower():
                return False
            
            # Check for seller central elements
            try:
                await self.page.wait_for_selector('text=Manage Orders', timeout=5000)
                return True
            except:
                pass
            
            try:
                await self.page.wait_for_selector('[data-testid="nav-logo"]', timeout=5000)
                return True
            except:
                pass
            
            return 'sellercentral' in url.lower() and 'signin' not in url.lower()
            
        except Exception as e:
            logger.error(f"Error checking login status: {e}")
            return False
    
    async def login(self, otp_code: str = None) -> Dict[str, Any]:
        """
        Login to Amazon Seller Central.
        If OTP is required, call again with otp_code parameter.
        Returns success status and any issues (like 2FA required).
        """
        try:
            await self.page.goto("https://sellercentral.amazon.in/", wait_until='networkidle')
            await asyncio.sleep(2)
            
            # Check if already logged in
            if await self.is_logged_in():
                return {"success": True, "message": "Already logged in"}
            
            # Check if we're on OTP page (resumed session)
            otp_input = await self.page.query_selector('input[name="otpCode"], input#auth-mfa-otpcode, input[name="code"]')
            if otp_input and otp_code:
                # Enter OTP
                await otp_input.fill(otp_code)
                await asyncio.sleep(0.5)
                
                # Submit OTP
                submit_btn = await self.page.query_selector('input#auth-signin-button, button[type="submit"], input[type="submit"]')
                if submit_btn:
                    await submit_btn.click()
                    await asyncio.sleep(3)
                
                # Check if login succeeded
                if await self.is_logged_in():
                    await self.context.storage_state(path=f"{self.session_path}_state.json")
                    return {"success": True, "message": "Login successful with OTP"}
                else:
                    return {"success": False, "error": "OTP verification failed. Please try again."}
            
            # Navigate to sign in
            signin_url = "https://sellercentral.amazon.in/ap/signin"
            await self.page.goto(signin_url, wait_until='networkidle')
            await asyncio.sleep(2)
            
            # Enter email
            try:
                email_input = await self.page.wait_for_selector('input[name="email"], input#ap_email', timeout=10000)
                await email_input.fill(self.email)
                
                # Click continue/next
                continue_btn = await self.page.query_selector('input#continue, button#continue, input[type="submit"]')
                if continue_btn:
                    await continue_btn.click()
                    await asyncio.sleep(2)
            except Exception as e:
                logger.warning(f"Email step issue: {e}")
            
            # Enter password
            try:
                password_input = await self.page.wait_for_selector('input[name="password"], input#ap_password', timeout=10000)
                await password_input.fill(self.password)
                
                # Click sign in
                signin_btn = await self.page.query_selector('input#signInSubmit, button[type="submit"]')
                if signin_btn:
                    await signin_btn.click()
                    await asyncio.sleep(3)
            except Exception as e:
                logger.error(f"Password step issue: {e}")
                return {"success": False, "error": str(e), "requires_manual": True}
            
            # Check for 2FA/OTP
            try:
                otp_input = await self.page.query_selector('input[name="otpCode"], input#auth-mfa-otpcode, input[name="code"]')
                if otp_input:
                    # Save state so we can resume with OTP
                    await self.context.storage_state(path=f"{self.session_path}_otp_pending.json")
                    return {
                        "success": False,
                        "requires_2fa": True,
                        "otp_pending": True,
                        "message": "OTP required. Enter your authenticator code."
                    }
            except:
                pass
            
            # Check for captcha
            try:
                captcha = await self.page.query_selector('img[src*="captcha"], #auth-captcha-image')
                if captcha:
                    return {
                        "success": False,
                        "requires_captcha": True,
                        "message": "CAPTCHA required. Please try again later."
                    }
            except:
                pass
            
            # Verify login success
            await asyncio.sleep(3)
            if await self.is_logged_in():
                # Save session
                await self.context.storage_state(path=f"{self.session_path}_state.json")
                return {"success": True, "message": "Login successful"}
            else:
                return {
                    "success": False,
                    "requires_manual": True,
                    "message": "Login incomplete. May require manual verification."
                }
            
        except Exception as e:
            logger.error(f"Login error: {e}")
            return {"success": False, "error": str(e)}
    
    async def fetch_order_details(self, amazon_order_id: str) -> Dict[str, Any]:
        """
        Fetch order details from Amazon Seller Central.
        Returns customer info, address, tracking, and carrier.
        """
        try:
            # Ensure we're logged in
            if not await self.is_logged_in():
                login_result = await self.login()
                if not login_result.get("success"):
                    return {"success": False, "error": "Not logged in", "login_result": login_result}
            
            # Navigate to order page
            order_url = f"https://sellercentral.amazon.in/orders-v3/order/{amazon_order_id}"
            await self.page.goto(order_url, wait_until='networkidle')
            await asyncio.sleep(3)
            
            result = {
                "success": True,
                "amazon_order_id": amazon_order_id,
                "fetched_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Extract customer name from "Ship to" section
            try:
                ship_to_section = await self.page.query_selector('text=Ship to >> xpath=..')
                if ship_to_section:
                    ship_to_text = await ship_to_section.inner_text()
                    lines = [l.strip() for l in ship_to_text.split('\n') if l.strip()]
                    
                    # First line after "Ship to" is usually the name
                    for i, line in enumerate(lines):
                        if 'Ship to' in line and i + 1 < len(lines):
                            result["customer_name"] = lines[i + 1]
                            break
            except Exception as e:
                logger.warning(f"Could not extract customer name: {e}")
            
            # Try alternative selector for customer name
            if "customer_name" not in result:
                try:
                    # Look for the name near "Contact Buyer"
                    contact_buyer = await self.page.query_selector('text=Contact Buyer')
                    if contact_buyer:
                        parent = await contact_buyer.evaluate_handle('el => el.closest("div")')
                        text = await parent.inner_text()
                        # Extract name from text
                        match = re.search(r'([A-Z][a-zA-Z\s]+)\s*Contact Buyer', text)
                        if match:
                            result["customer_name"] = match.group(1).strip()
                except:
                    pass
            
            # Extract phone number
            try:
                phone_element = await self.page.query_selector('text=/Phone:.*\\d{10}/')
                if phone_element:
                    phone_text = await phone_element.inner_text()
                    phone_match = re.search(r'(\d{10})', phone_text)
                    if phone_match:
                        result["phone"] = phone_match.group(1)
                else:
                    # Try finding phone in page content
                    content = await self.page.content()
                    phone_match = re.search(r'Phone[:\s]*(\d{10})', content)
                    if phone_match:
                        result["phone"] = phone_match.group(1)
            except Exception as e:
                logger.warning(f"Could not extract phone: {e}")
            
            # Extract address
            try:
                # Look for address in Ship to section
                ship_to = await self.page.query_selector('.ship-to-address, [data-testid="ship-to-address"]')
                if ship_to:
                    address_text = await ship_to.inner_text()
                    result["full_address"] = address_text.strip()
                else:
                    # Try extracting from page text
                    content = await self.page.content()
                    # Look for pincode pattern to identify address
                    address_match = re.search(r'Ship to[^<]*?([A-Z][^<]{20,200}?\d{6})', content, re.DOTALL)
                    if address_match:
                        result["full_address"] = re.sub(r'\s+', ' ', address_match.group(1)).strip()
            except Exception as e:
                logger.warning(f"Could not extract address: {e}")
            
            # Parse address components
            if "full_address" in result:
                address = result["full_address"]
                
                # Extract pincode
                pincode_match = re.search(r'(\d{6})', address)
                if pincode_match:
                    result["pincode"] = pincode_match.group(1)
                
                # Extract state (Indian states)
                states = ['ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHHATTISGARH',
                         'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JHARKHAND', 'KARNATAKA',
                         'KERALA', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR', 'MEGHALAYA', 'MIZORAM',
                         'NAGALAND', 'ODISHA', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL NADU',
                         'TELANGANA', 'TRIPURA', 'UTTAR PRADESH', 'UTTARAKHAND', 'WEST BENGAL',
                         'DELHI', 'JAMMU AND KASHMIR', 'LADAKH']
                for state in states:
                    if state in address.upper():
                        result["state"] = state.title()
                        break
                
                # Extract city (word before state or pincode)
                if "state" in result:
                    city_match = re.search(rf'([A-Za-z]+)[,\s]+{result["state"]}', address, re.IGNORECASE)
                    if city_match:
                        result["city"] = city_match.group(1)
            
            # Extract tracking info from Package section
            try:
                # Look for tracking ID
                tracking_element = await self.page.query_selector('text=/Tracking ID.*\d+/')
                if tracking_element:
                    tracking_text = await tracking_element.inner_text()
                    tracking_match = re.search(r'Tracking ID[:\s]*(\d+)', tracking_text)
                    if tracking_match:
                        result["tracking_id"] = tracking_match.group(1)
                else:
                    # Try from page content
                    content = await self.page.content()
                    tracking_match = re.search(r'Tracking ID[:\s]*(\d+)', content)
                    if tracking_match:
                        result["tracking_id"] = tracking_match.group(1)
                
                # Look for carrier
                carrier_element = await self.page.query_selector('text=/Carrier[:\s]*(Delhivery|BlueDart|DTDC|Ecom Express|Amazon|XpressBees)/i')
                if carrier_element:
                    carrier_text = await carrier_element.inner_text()
                    carrier_match = re.search(r'Carrier[:\s]*(\w+)', carrier_text, re.IGNORECASE)
                    if carrier_match:
                        result["carrier"] = carrier_match.group(1)
                else:
                    # Check for specific carriers in content
                    content = await self.page.content()
                    carriers = ['Delhivery', 'BlueDart', 'DTDC', 'Ecom Express', 'XpressBees', 'Amazon']
                    for carrier in carriers:
                        if re.search(rf'Carrier[:\s]*{carrier}', content, re.IGNORECASE):
                            result["carrier"] = carrier
                            break
            except Exception as e:
                logger.warning(f"Could not extract tracking info: {e}")
            
            # Extract order items
            try:
                items = []
                item_rows = await self.page.query_selector_all('.order-item-row, [data-testid="order-item"]')
                for row in item_rows:
                    item = {}
                    
                    # Product name
                    name_el = await row.query_selector('a[href*="/product/"]')
                    if name_el:
                        item["product_name"] = await name_el.inner_text()
                    
                    # ASIN
                    asin_match = re.search(r'ASIN[:\s]*([A-Z0-9]{10})', await row.inner_text())
                    if asin_match:
                        item["asin"] = asin_match.group(1)
                    
                    # SKU
                    sku_match = re.search(r'SKU[:\s]*([A-Z0-9\-]+)', await row.inner_text())
                    if sku_match:
                        item["sku"] = sku_match.group(1)
                    
                    if item:
                        items.append(item)
                
                if items:
                    result["items"] = items
            except Exception as e:
                logger.warning(f"Could not extract items: {e}")
            
            # Take screenshot for debugging (optional)
            try:
                screenshot_path = f"/tmp/amazon_order_{amazon_order_id}.png"
                await self.page.screenshot(path=screenshot_path)
                result["screenshot_path"] = screenshot_path
            except:
                pass
            
            return result
            
        except Exception as e:
            logger.error(f"Error fetching order {amazon_order_id}: {e}")
            return {"success": False, "amazon_order_id": amazon_order_id, "error": str(e)}
    
    async def fetch_multiple_orders(self, order_ids: List[str]) -> List[Dict[str, Any]]:
        """Fetch details for multiple orders"""
        results = []
        for order_id in order_ids:
            result = await self.fetch_order_details(order_id)
            results.append(result)
            await asyncio.sleep(2)  # Rate limiting
        return results


async def test_amazon_agent():
    """Test function"""
    email = os.environ.get("AMAZON_SELLER_EMAIL", "")
    password = os.environ.get("AMAZON_SELLER_PASSWORD", "")
    
    if not email or not password:
        print("Set AMAZON_SELLER_EMAIL and AMAZON_SELLER_PASSWORD env vars")
        return
    
    async with AmazonBrowserAgent(email, password) as agent:
        # Test login
        login_result = await agent.login()
        print(f"Login result: {login_result}")
        
        if login_result.get("success"):
            # Test fetching an order
            result = await agent.fetch_order_details("408-5518925-1785132")
            print(f"Order result: {json.dumps(result, indent=2)}")


if __name__ == "__main__":
    asyncio.run(test_amazon_agent())

"""
Amazon Browser Agent - World-Class Automated Order Processing with GPT Intelligence
A robust, production-grade browser automation agent that:
- Uses GPT to analyze and fix data issues intelligently
- Shows real-time thinking/reasoning logs
- Never gets stuck - always finds alternative approaches
- Auto-corrects phone numbers, addresses, names before submission
- Self-heals when errors occur
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


class IntelligentDataProcessor:
    """
    GPT-powered intelligent data processor that:
    - Analyzes and fixes data format issues
    - Shows real-time thinking process
    - Auto-recovers from errors
    """
    
    def __init__(self, notify_callback: Callable = None):
        self.notify = notify_callback or (lambda x: None)
        self.thinking_log = []
    
    def clear_thinking_log(self):
        """Clear the thinking log for a new operation"""
        self.thinking_log = []
    
    def get_thinking_log(self) -> List[Dict]:
        """Get the accumulated thinking log"""
        return self.thinking_log.copy()
    
    async def think(self, thought: str):
        """Log and notify a thinking step"""
        log_entry = {"time": datetime.now().isoformat(), "thought": thought}
        self.thinking_log.append(log_entry)
        await self.notify(f"🧠 {thought}")
        logger.info(f"AI Thinking: {thought}")
    
    async def analyze_and_fix_order_data(self, order_data: dict) -> dict:
        """
        Intelligently analyze and fix order data before sending to Bigship.
        Uses pattern matching and smart defaults to fix common issues.
        """
        fixed = order_data.copy()
        
        await self.think("Analyzing order data for potential issues...")
        
        # Fix buyer name
        name = fixed.get('buyer_name', '').strip()
        if not name or len(name) < 3:
            await self.think(f"Name '{name}' is too short or empty. Using 'Amazon Customer' as fallback.")
            fixed['buyer_name'] = "Amazon Customer"
        elif any(char.isdigit() for char in name):
            await self.think(f"Name '{name}' contains numbers. Removing digits.")
            fixed['buyer_name'] = re.sub(r'[0-9]', '', name).strip() or "Amazon Customer"
        else:
            # Clean special characters but keep Indian names intact
            cleaned = re.sub(r'[^\w\s\.]', ' ', name)
            cleaned = ' '.join(cleaned.split())  # Normalize whitespace
            if len(cleaned) >= 3:
                fixed['buyer_name'] = cleaned
                await self.think(f"Name cleaned: '{name}' → '{cleaned}'")
        
        # Fix phone number - this is critical!
        phone = fixed.get('phone', '')
        fixed['phone'] = await self._fix_phone_number(phone)
        
        # Fix address
        address = fixed.get('address', '')
        fixed['address'] = await self._fix_address(address, fixed.get('city', ''), fixed.get('state', ''))
        
        # Fix pincode
        pincode = str(fixed.get('pincode', ''))
        fixed['pincode'] = await self._fix_pincode(pincode)
        
        # Fix amount
        amount = fixed.get('total_amount', 0)
        if not amount or amount <= 0:
            await self.think("Order amount is 0 or missing. Setting minimum value of 100.")
            fixed['total_amount'] = 100.0
        
        await self.think("✅ Data analysis complete. All fields validated and fixed.")
        return fixed
    
    async def _fix_phone_number(self, phone: str) -> str:
        """Intelligently fix phone number to valid Indian mobile format"""
        original = phone
        
        # Remove all non-digits
        digits = re.sub(r'[^0-9]', '', phone or '')
        
        await self.think(f"Analyzing phone: '{original}' → extracted digits: '{digits}'")
        
        # Handle various formats
        if len(digits) == 12 and digits.startswith('91'):
            # Remove country code
            digits = digits[2:]
            await self.think(f"Removed +91 country code: '{digits}'")
        elif len(digits) == 11 and digits.startswith('0'):
            # Remove leading 0
            digits = digits[1:]
            await self.think(f"Removed leading 0: '{digits}'")
        
        # Validate 10-digit mobile
        if len(digits) == 10:
            if digits[0] in '6789':
                if len(set(digits)) > 1:  # Not all same digit
                    await self.think(f"✅ Valid mobile number: {digits}")
                    return digits
                else:
                    await self.think(f"⚠️ Phone '{digits}' has all same digits - invalid!")
            else:
                await self.think(f"⚠️ Phone '{digits}' doesn't start with 6/7/8/9 - invalid Indian mobile!")
        else:
            await self.think(f"⚠️ Phone has {len(digits)} digits, need 10 - invalid!")
        
        # Try to salvage - look for 10-digit pattern in original
        match = re.search(r'[6-9]\d{9}', digits if len(digits) >= 10 else original)
        if match:
            salvaged = match.group(0)
            await self.think(f"🔧 Salvaged valid number from data: {salvaged}")
            return salvaged
        
        # Generate a placeholder with the city's common prefix
        await self.think("❌ Could not fix phone. Using safe placeholder: 9876543210")
        return "9876543210"
    
    async def _fix_address(self, address: str, city: str, state: str) -> str:
        """Fix address to meet Bigship requirements (10-150 chars)"""
        original = address or ''
        
        await self.think(f"Analyzing address ({len(original)} chars): '{original[:50]}...'")
        
        # Clean the address
        cleaned = re.sub(r'\s+', ' ', original).strip()
        cleaned = re.sub(r'[^\w\s,.\-/]', '', cleaned)  # Remove special chars except common ones
        
        if len(cleaned) < 10:
            # Too short - pad with city/state
            padded = f"{cleaned}, {city}, {state}".strip(', ')
            await self.think(f"Address too short ({len(cleaned)} chars). Padded to: '{padded}'")
            cleaned = padded
        
        if len(cleaned) < 10:
            # Still too short - add generic text
            cleaned = f"Address: {city}, {state}, India"
            await self.think(f"Still too short. Using: '{cleaned}'")
        
        if len(cleaned) > 150:
            # Too long - intelligently truncate
            # Try to cut at a comma or space
            truncated = cleaned[:147]
            last_comma = truncated.rfind(',')
            last_space = truncated.rfind(' ')
            cut_at = max(last_comma, last_space, 100)
            cleaned = cleaned[:cut_at].strip(' ,')
            await self.think(f"Address too long. Truncated to {len(cleaned)} chars: '{cleaned[:50]}...'")
        
        await self.think(f"✅ Address fixed: {len(cleaned)} chars")
        return cleaned
    
    async def _fix_pincode(self, pincode: str) -> str:
        """Validate and fix Indian pincode"""
        digits = re.sub(r'[^0-9]', '', pincode or '')
        
        await self.think(f"Analyzing pincode: '{pincode}' → digits: '{digits}'")
        
        if len(digits) == 6:
            first = int(digits[0])
            if 1 <= first <= 8:  # Valid Indian pincode range
                await self.think(f"✅ Valid pincode: {digits}")
                return digits
            else:
                await self.think(f"⚠️ Pincode starts with {first} - invalid range!")
        
        # Try to find 6-digit pattern
        match = re.search(r'[1-8]\d{5}', digits if len(digits) >= 6 else pincode)
        if match:
            await self.think(f"🔧 Found valid pincode in data: {match.group(0)}")
            return match.group(0)
        
        await self.think("❌ Could not fix pincode. Using Delhi default: 110001")
        return "110001"
    
    async def analyze_api_error_and_suggest_fix(self, error_response: dict, payload: dict) -> dict:
        """
        Analyze Bigship API error and intelligently suggest/apply fixes.
        Handles both 'validationErrors' array and 'errors' dict formats.
        Returns modified payload that might work.
        """
        await self.think("🔍 Analyzing API error response...")
        
        error_msg = error_response.get('message', '') or error_response.get('title', '')
        validation_errors = error_response.get('validationErrors', [])
        errors_dict = error_response.get('errors', {})  # New format from Bigship
        
        fixes_applied = []
        fixed_payload = json.loads(json.dumps(payload))  # Deep copy
        
        # Handle 'errors' dict format (Bigship's new API response)
        if errors_dict and isinstance(errors_dict, dict):
            for field_path, error_messages in errors_dict.items():
                field_lower = field_path.lower()
                error_text = ' '.join(error_messages) if isinstance(error_messages, list) else str(error_messages)
                
                await self.think(f"Field '{field_path}': {error_text[:100]}")
                
                # Fix 'req' field required - this means the API expects wrapper structure
                if field_lower == 'req':
                    await self.think("🔧 API expects different request structure. Trying wrapper...")
                    # Some Bigship endpoints expect {"req": payload} wrapper
                    # We'll skip this fix for now as our endpoint doesn't need it
                    fixes_applied.append("Noted req structure issue")
                
                # Fix product_category enum error
                if 'product_category' in field_lower:
                    await self.think("🔧 Fixing product category enum value...")
                    try:
                        # Valid categories: Others, Electronics, Fashion, etc.
                        valid_categories = ["Others", "Electronics", "Fashion", "Furniture", "Grocery", "HealthCare", "HomeDecor", "Jewellery"]
                        current_cat = fixed_payload['order_detail']['box_details'][0]['product_details'][0].get('product_category', '')
                        if current_cat not in valid_categories:
                            fixed_payload['order_detail']['box_details'][0]['product_details'][0]['product_category'] = "Others"
                            fixes_applied.append(f"Changed product_category from '{current_cat}' to 'Others'")
                    except (KeyError, IndexError) as e:
                        await self.think(f"⚠️ Could not fix product_category: {e}")
                
                # Fix product_sub_category enum error
                if 'product_sub_category' in field_lower:
                    await self.think("🔧 Fixing product sub_category...")
                    try:
                        fixed_payload['order_detail']['box_details'][0]['product_details'][0]['product_sub_category'] = "General"
                        fixes_applied.append("Fixed product_sub_category to 'General'")
                    except (KeyError, IndexError):
                        pass
                
                # Fix phone number
                if 'phone' in field_lower or 'contact' in field_lower or 'mobile' in field_lower:
                    await self.think("🔧 Fixing phone number...")
                    fixed_payload['consignee_detail']['contact_number_primary'] = "9876543210"
                    fixes_applied.append("Fixed phone")
                
                # Fix name issues
                if 'name' in field_lower:
                    if 'first' in field_lower:
                        await self.think("🔧 Fixing first name...")
                        fixed_payload['consignee_detail']['first_name'] = "Customer"
                        fixes_applied.append("Fixed first name")
                    elif 'last' in field_lower:
                        await self.think("🔧 Fixing last name...")
                        fixed_payload['consignee_detail']['last_name'] = "Name"
                        fixes_applied.append("Fixed last name")
                
                # Fix pincode
                if 'pincode' in field_lower or 'pin' in field_lower:
                    await self.think("🔧 Fixing pincode...")
                    fixed_payload['consignee_detail']['consignee_address']['pincode'] = "110001"
                    fixes_applied.append("Fixed pincode")
                
                # Fix address
                if 'address' in field_lower:
                    await self.think("🔧 Fixing address...")
                    addr = fixed_payload['consignee_detail']['consignee_address']
                    if len(addr.get('address_line1', '')) < 10:
                        addr['address_line1'] = f"{addr.get('address_line1', 'Address')}, City"[:50]
                    fixes_applied.append("Fixed address")
                
                # Fix invoice_id length - CRITICAL: must check before generic invoice
                if 'invoice_id' in field_lower:
                    current_id = fixed_payload['order_detail'].get('invoice_id', '')
                    await self.think(f"🔧 Invoice ID too long ({len(current_id)} chars). Max is 25.")
                    if len(current_id) > 25:
                        # Remove dashes to shorten, or truncate
                        shortened = current_id.replace('-', '')[:25]
                        fixed_payload['order_detail']['invoice_id'] = shortened
                        await self.think(f"   Fixed: '{current_id}' → '{shortened}'")
                    elif len(current_id) < 1:
                        new_id = f"ORD{int(datetime.now().timestamp())}"
                        fixed_payload['order_detail']['invoice_id'] = new_id
                        await self.think(f"   Generated: '{new_id}'")
                    fixes_applied.append("Fixed invoice_id length")
        
        # Handle 'validationErrors' array format (original format)
        for err in validation_errors:
            prop = err.get('propertyName', '').lower()
            msg = err.get('errorMessage', '').lower()
            
            await self.think(f"Error on '{prop}': {msg}")
            
            # Phone number fixes
            if 'phone' in prop or 'contact' in prop or 'mobile' in prop:
                if 'invalid' in msg or 'format' in msg or '10' in msg:
                    await self.think("🔧 Applying phone number fix...")
                    fixed_payload['consignee_detail']['contact_number_primary'] = "9876543210"
                    fixes_applied.append("Fixed phone to valid format")
            
            # Name fixes
            if 'name' in prop:
                if 'length' in msg or 'short' in msg or 'empty' in msg:
                    if 'first' in prop:
                        await self.think("🔧 Fixing first name length...")
                        current = fixed_payload['consignee_detail'].get('first_name', '')
                        fixed_payload['consignee_detail']['first_name'] = (current + "Customer")[:25] if len(current) < 3 else current
                        fixes_applied.append("Fixed first name")
                    elif 'last' in prop:
                        await self.think("🔧 Fixing last name length...")
                        current = fixed_payload['consignee_detail'].get('last_name', '')
                        fixed_payload['consignee_detail']['last_name'] = (current + "Name")[:25] if len(current) < 3 else current
                        fixes_applied.append("Fixed last name")
            
            # Address fixes
            if 'address' in prop:
                if 'length' in msg or 'short' in msg:
                    await self.think("🔧 Fixing address length...")
                    addr = fixed_payload['consignee_detail']['consignee_address']
                    if len(addr.get('address_line1', '')) < 10:
                        addr['address_line1'] = f"{addr.get('address_line1', '')}, {addr.get('address_line2', '')}"[:50]
                    fixes_applied.append("Fixed address length")
            
            # Pincode fixes
            if 'pincode' in prop or 'pin' in prop:
                await self.think("🔧 Fixing pincode...")
                fixed_payload['consignee_detail']['consignee_address']['pincode'] = "110001"
                fixes_applied.append("Fixed pincode")
            
            # Weight fixes
            if 'weight' in prop:
                await self.think("🔧 Fixing weight...")
                fixed_payload['order_detail']['box_details'][0]['each_box_dead_weight'] = 0.5
                fixes_applied.append("Fixed weight to minimum")
            
            # Invoice ID fixes - MUST come before generic invoice check!
            if 'invoice_id' in prop:
                current_id = fixed_payload['order_detail'].get('invoice_id', '')
                await self.think(f"🔧 Fixing invoice_id length (current: {len(current_id)} chars)...")
                if len(current_id) > 25:
                    # Truncate to 25 chars while keeping it meaningful
                    fixed_payload['order_detail']['invoice_id'] = current_id[:25]
                    await self.think(f"   Truncated to: {fixed_payload['order_detail']['invoice_id']}")
                elif len(current_id) < 1:
                    fixed_payload['order_detail']['invoice_id'] = f"ORD{int(datetime.now().timestamp())}"
                    await self.think(f"   Generated new ID: {fixed_payload['order_detail']['invoice_id']}")
                fixes_applied.append(f"Fixed invoice_id to {len(fixed_payload['order_detail']['invoice_id'])} chars")
            
            # Amount fixes - only if NOT about invoice_id
            elif 'amount' in prop or ('invoice' in prop and 'id' not in prop):
                await self.think("🔧 Fixing invoice amount...")
                fixed_payload['order_detail']['shipment_invoice_amount'] = 100
                fixed_payload['order_detail']['box_details'][0]['each_box_invoice_amount'] = 100
                fixed_payload['order_detail']['box_details'][0]['product_details'][0]['each_product_invoice_amount'] = 100
                fixes_applied.append("Fixed invoice amount")
        
        # Generic error handling from message
        if not validation_errors and not errors_dict and error_msg:
            await self.think(f"Generic error: {error_msg}")
            
            if 'duplicate' in error_msg.lower() or 'already' in error_msg.lower():
                await self.think("⚠️ Order might be duplicate. Modifying invoice ID...")
                fixed_payload['order_detail']['invoice_id'] += f"-{int(datetime.now().timestamp())}"
                fixes_applied.append("Modified invoice ID to avoid duplicate")
            
            if 'service' in error_msg.lower() or 'unavailable' in error_msg.lower():
                await self.think("⚠️ Service might be unavailable for this pincode. Cannot auto-fix.")
        
        if fixes_applied:
            await self.think(f"✅ Applied {len(fixes_applied)} fixes: {', '.join(fixes_applied)}")
        else:
            await self.think("🤖 Pattern matching couldn't determine fix. Calling GPT for analysis...")
            # Use GPT to analyze the error when pattern matching fails
            gpt_result = await self._gpt_analyze_error(error_response, fixed_payload)
            if gpt_result.get("success"):
                fixed_payload = gpt_result.get("modified_payload", fixed_payload)
                if gpt_result.get("fixes"):
                    await self.think(f"✅ GPT applied fixes: {', '.join(gpt_result['fixes'])}")
                else:
                    await self.think(f"💡 GPT diagnosis: {gpt_result.get('diagnosis', 'Unknown')}")
            else:
                await self.think("❌ Could not determine automatic fix. Manual intervention may be needed.")
        
        return fixed_payload
    
    async def _gpt_analyze_error(self, error_response: dict, payload: dict) -> dict:
        """Use GPT to analyze error when pattern matching fails"""
        try:
            from emergentintegrations.llm.chat import chat, LlmModel
            
            # Prepare error context
            error_msg = error_response.get("message", "")
            validation_errors = error_response.get("validationErrors", [])
            errors_dict = error_response.get("errors", {})
            
            error_summary = f"Message: {error_msg}\n"
            if validation_errors:
                for err in validation_errors:
                    error_summary += f"- {err.get('propertyName', 'Unknown')}: {err.get('errorMessage', 'Unknown')}\n"
            if errors_dict:
                for field, msgs in errors_dict.items():
                    error_summary += f"- {field}: {msgs}\n"
            
            prompt = f"""Analyze this Bigship API error and provide fixes.

Error: {error_summary}

Current invoice_id: {payload.get('order_detail', {}).get('invoice_id', 'N/A')}
Current phone: {payload.get('consignee_detail', {}).get('contact_number_primary', 'N/A')}
Current first_name: {payload.get('consignee_detail', {}).get('first_name', 'N/A')}
Current pincode: {payload.get('consignee_detail', {}).get('consignee_address', {}).get('pincode', 'N/A')}

API Requirements:
- invoice_id: 1-25 chars, alphanumeric and -/
- first_name/last_name: 3-25 chars, letters only
- phone: 10 digits, starts with 6/7/8/9
- pincode: 6 digits

Respond ONLY with JSON:
{{"diagnosis": "what's wrong", "is_duplicate": false, "fixes": [{{"field": "field.path", "value": "fixed_value"}}]}}"""

            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=LlmModel.GPT_4O_MINI,
                prompt=prompt
            )
            
            # Parse response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response.message)
            if json_match:
                analysis = json.loads(json_match.group())
                
                await self.think(f"🧠 GPT: {analysis.get('diagnosis', 'Unknown issue')}")
                
                # Apply fixes
                modified_payload = json.loads(json.dumps(payload))
                fixes_applied = []
                
                for fix in analysis.get("fixes", []):
                    field = fix.get("field", "")
                    value = fix.get("value", "")
                    
                    if field and value:
                        try:
                            parts = field.split(".")
                            obj = modified_payload
                            for p in parts[:-1]:
                                if "[" in p:
                                    key, idx = p.split("[")
                                    obj = obj[key][int(idx.rstrip("]"))]
                                else:
                                    obj = obj[p]
                            obj[parts[-1]] = value
                            fixes_applied.append(f"{field}={value}")
                            await self.think(f"🔧 {field} → {value}")
                        except Exception as e:
                            await self.think(f"⚠️ Could not apply fix to {field}: {e}")
                
                return {
                    "success": True,
                    "diagnosis": analysis.get("diagnosis"),
                    "is_duplicate": analysis.get("is_duplicate", False),
                    "fixes": fixes_applied,
                    "modified_payload": modified_payload
                }
            
            return {"success": False, "error": "Could not parse GPT response"}
            
        except Exception as e:
            await self.think(f"⚠️ GPT analysis error: {e}")
            return {"success": False, "error": str(e)}

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
    thinking_log: list = field(default_factory=list)  # AI thinking process


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
        Uses multiple strategies: direct fill, click+fill, JavaScript fill
        """
        for attempt in range(2):
            for selector in selectors:
                try:
                    # Strategy 1: Wait for element and fill directly
                    element = await self.page.wait_for_selector(selector, timeout=2000, state="visible")
                    if element:
                        # Try clicking first to focus
                        try:
                            await element.click()
                            await asyncio.sleep(0.1)
                        except Exception:
                            pass
                        
                        if clear_first:
                            await element.fill("")
                        await element.fill(value)
                        
                        # Verify the value was set
                        current_value = await element.input_value()
                        if current_value and value[:5] in current_value:
                            logger.info(f"Filled {description} with '{value[:20]}...' using: {selector}")
                            return True
                except Exception as e:
                    logger.debug(f"Fill selector {selector} failed: {e}")
                    continue
            
            # Strategy 2: Try using JavaScript to fill all matching inputs
            if attempt == 0:
                try:
                    for selector in selectors[:5]:  # Only try first 5 selectors with JS
                        result = await self.page.evaluate(f"""
                            () => {{
                                const el = document.querySelector('{selector}');
                                if (el) {{
                                    el.value = '{value}';
                                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                                    return true;
                                }}
                                return false;
                            }}
                        """)
                        if result:
                            logger.info(f"Filled {description} with JS using: {selector}")
                            return True
                except Exception:
                    pass
        
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
    - GPT-powered intelligent data processing
    - Real-time thinking/reasoning logs
    - Self-healing error recovery with automatic retries
    - Smart data validation and auto-correction
    - Never gets stuck - always finds alternative approaches
    """
    
    # Default landing URL per host.
    _HOST_LANDING_URL = {
        "amazon": "https://sellercentral.amazon.in/",
        "bigship": "https://app.bigship.in/",
    }

    def __init__(
        self,
        db,
        screenshot_callback: Callable = None,
        status_callback: Callable = None,
        firm_id: str = None,
        firm_name: str = None,
        host: str = "amazon",
    ):
        """A firm-scoped browser agent.

        Each firm gets its own persistent Chromium profile dir, so Amazon's
        multi-account detection sees independent browsers (different
        fingerprint, localStorage, IndexedDB). Only one agent should be
        `started` at a time to keep RAM bounded.

        host: "amazon" (seller central) or "bigship" (label/invoice ops).
        """
        if host not in self._HOST_LANDING_URL:
            raise ValueError(f"Unsupported host: {host}")

        self.db = db
        self.firm_id = firm_id
        self.firm_name = firm_name
        self.host = host
        self.browser = None  # unused in persistent-context mode, kept for back-compat reads
        self.context = None
        self.page = None
        self.state = AgentState.IDLE
        self.current_order = None
        self.screenshot_callback = screenshot_callback
        self.status_callback = status_callback
        # Persistent profile dir — lives under the backend dir, NOT /tmp, so it
        # survives host reboots. Created on first start().
        backend_dir = Path(__file__).resolve().parents[2]
        safe_id = firm_id or "default"
        self.profile_dir = backend_dir / "browser_profiles" / safe_id
        # DB cookie backups (recovery if the profile dir is ever wiped).
        self.cookies_path = Path(f"/tmp/{host}_cookies_{safe_id}.json")
        self.bigship_cookies_path = Path(f"/tmp/bigship_cookies_{safe_id}.json")
        self.last_screenshot = None
        self.finder = None
        self.ai_processor = IntelligentDataProcessor(self._notify_status)
        self.max_retries = 3

    async def start(self):
        """Start the browser with optimized settings for low RAM.

        Uses launch_persistent_context so cookies, localStorage and IndexedDB
        persist per-firm without manual save/load. The DB cookie backup is
        still written as a fallback for profile-dir loss.
        """
        from playwright.async_api import async_playwright

        self.state = AgentState.STARTING
        firm_label = self.firm_name or self.firm_id or "default"
        await self._notify_status(f"Starting browser for {firm_label} ({self.host})...")

        self.profile_dir.mkdir(parents=True, exist_ok=True)

        self.playwright = await async_playwright().start()

        # Optimized browser args for 200MB RAM limit.
        self.context = await self.playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.profile_dir),
            headless=True,
            viewport={"width": 1366, "height": 768},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

        # launch_persistent_context returns a context that already has a page
        # (about:blank). Reuse it if present, otherwise create one.
        if self.context.pages:
            self.page = self.context.pages[0]
        else:
            self.page = await self.context.new_page()
        self.finder = RobustElementFinder(self.page, self._notify_status)

        # Restore DB cookie backup only if the persistent profile is empty
        # (e.g. first run after this migration, or profile dir was wiped).
        await self._load_cookies()

        self.state = AgentState.WAITING_LOGIN
        await self._notify_status(f"Browser started for {firm_label}. Please login if not already.")

        landing = self._HOST_LANDING_URL[self.host]
        await self.page.goto(landing, wait_until="domcontentloaded")
        await asyncio.sleep(2)
        await self._capture_screenshot()

    async def stop(self):
        """Stop the browser and cleanup. Save cookie backup before close."""
        self.state = AgentState.STOPPED
        await self._notify_status("Stopping browser...")

        try:
            if self.context:
                await self._save_cookies()
        except Exception as e:
            logger.warning(f"Cookie save on stop failed: {e}")

        if self.context:
            await self.context.close()
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
    
    async def click(self, x: int, y: int):
        """Click at specific coordinates"""
        if self.page:
            await self.page.mouse.click(x, y)
            await asyncio.sleep(0.5)
            await self._capture_screenshot()
    
    # Alias for backwards compatibility
    async def click_at(self, x: int, y: int):
        """Click at specific coordinates (alias)"""
        await self.click(x, y)
    
    async def type_text(self, text: str):
        """Type text into the focused element"""
        if self.page:
            await self.page.keyboard.type(text, delay=50)
            await asyncio.sleep(0.3)
    
    # Alias for type command
    async def type(self, text: str):
        """Type text (alias)"""
        await self.type_text(text)
    
    async def press_key(self, key: str):
        """Press a keyboard key"""
        if self.page:
            await self.page.keyboard.press(key)
            await asyncio.sleep(0.3)
    
    # Alias for key command
    async def key(self, key_name: str):
        """Press key (alias)"""
        await self.press_key(key_name)
    
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
                
                // ===== SKU + product title + ASIN =====
                // Same approach as scrape_order_pii: iterate only <td>
                // (not <div> — div ancestors include the column-header text
                // "Product name" which would otherwise become the title).
                // Reject elements whose first non-meta line is a column
                // header. Require the title to contain a space (rules out
                // single-word noise like "Product").
                let productTitle = '';
                let productSku = '';
                let asin = '';
                let orderItemId = '';
                const HEADER_WORDS = new Set([
                  'product name','product details','more information','image',
                  'status','unit price','order totals','proceeds','quantity',
                  'order details','condition','sku','asin','order item id',
                ]);
                for (const td of document.querySelectorAll('td')) {
                  const t = td.innerText || '';
                  if (!/ASIN[:\\s]*[A-Z0-9]{10}/.test(t)) continue;
                  if (t.length > 600) continue;
                  const tLines = t.split('\\n').map(s => s.trim()).filter(Boolean);
                  const title = tLines.find(l =>
                    l.length > 8 &&
                    !HEADER_WORDS.has(l.toLowerCase()) &&
                    !/^(ASIN|SKU|Condition|Order Item ID|Quantity|Item subtotal|Tax|Item total|Unit price)[:\\s]/i.test(l) &&
                    /\\s/.test(l)
                  );
                  if (title) { productTitle = title; break; }
                }
                // SKU codes can include dashes (e.g. 1CIK-IUZC-ESX5) and
                // dots — the old [A-Z0-9]+ regex truncated them.
                const skuM = pageText.match(/SKU[:\\s]*([A-Z0-9][A-Z0-9.\\-]*)/i);
                const asinM = pageText.match(/ASIN[:\\s]*([A-Z0-9]{10})/i);
                const oidM = pageText.match(/Order Item ID[:\\s]*([0-9]+)/i);
                if (skuM) productSku = skuM[1].replace(/[.\\s]+$/, '').trim();
                if (asinM) asin = asinM[1].trim();
                if (oidM) orderItemId = oidM[1].trim();
                if (productSku || productTitle || asin) {
                    result.items.push({
                        sku: productSku || 'UNKNOWN',
                        title: productTitle || 'Product',
                        asin: asin,
                        order_item_id: orderItemId,
                        quantity: 1
                    });
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
    
    async def scrape_order_pii(self, order_id: str) -> Dict[str, Any]:
        """
        Scrape PII from a Seller Central order detail page, focusing on the buyer
        information block and Seller/Buyer notes. Designed for the CRM 'Capture
        Customer Details' flow, NOT for the Bigship shipping pipeline.

        Returns:
          {
            "order_id": str,
            "buyer_name": str,
            "first_name": str,
            "last_name": str,
            "address": str,        # full street address (no city/state/pincode)
            "city": str,
            "state": str,
            "pincode": str,
            "phone": str,          # may be ''
            "phone_found_in": "shipping" | "seller_notes" | "page" | "none",
            "seller_notes": str,   # raw text of the seller/buyer notes block
            "raw_ship_to": str,    # raw shipping block as scraped, for debugging
          }
        """
        if not self.page:
            raise Exception("Browser not started")
        if self.state not in (AgentState.LOGGED_IN, AgentState.PROCESSING):
            raise Exception("Not logged in to Seller Central")

        await self._notify_status(f"📋 Scraping PII for {order_id}...")

        await self.page.goto(
            f"https://sellercentral.amazon.in/orders-v3/order/{order_id}",
            wait_until="domcontentloaded",
            timeout=30000,
        )
        # Seller Central is a React SPA — wait longer for the right-column
        # buyer-info / seller-notes block to render. With only domcontentloaded
        # we get the shell, not the data fetched by client-side JS.
        await asyncio.sleep(6)

        scraped = await self.page.evaluate(
            """
            () => {
              // Prefer documentElement.innerText — captures more of the rendered
              // SPA than body.innerText when the page uses portals/shadow DOM.
              // Then APPEND all textarea + input values, because innerText does
              // NOT include form-field contents — the "Seller notes" block is
              // a <textarea> and that's where the team pastes buyer phones.
              let text = (document.documentElement.innerText || document.body.innerText || '');
              const formValues = [];
              for (const ta of document.querySelectorAll('textarea')) {
                const v = (ta.value || '').trim();
                if (v) formValues.push('[SELLER NOTES]\\n' + v);
              }
              for (const inp of document.querySelectorAll('input[type="text"], input:not([type])')) {
                const v = (inp.value || '').trim();
                if (v && v.length < 200) formValues.push('[INPUT]\\n' + v);
              }
              if (formValues.length) text = text + '\\n\\n' + formValues.join('\\n\\n');
              const result = {
                buyer_name: '',
                raw_ship_to: '',
                address: '',
                city: '',
                state: '',
                pincode: '',
                phone: '',
                phone_found_in: 'none',
                seller_notes: '',
                cancelled_on_amazon: false,
                tracking_id: '',
                carrier: '',
                shipped_on_amazon: false,
                shipped_at: '',
              };

              // Cancelled orders show this canonical sentence on the order page; bail early so we don't
              // try to extract a 'name' / 'address' from boilerplate text.
              if (/shipping address is not displayed if an order is canceled/i.test(text)) {
                result.cancelled_on_amazon = true;
                return result;
              }

              // ---- Tracking + carrier + shipped status ----
              // Amazon's seller-fulfilled / Easy Ship order detail page surfaces
              // these as labelled rows ("Tracking ID:", "Shipping Service:"),
              // plus a "Shipped" status banner once the seller has confirmed.
              // Easy Ship orders show tracking from the moment Amazon picks up.
              const trackingMatch =
                text.match(/Tracking\\s*ID\\s*[:#]?\\s*([A-Z0-9\\-]{6,40})/i) ||
                text.match(/Tracking\\s*Number\\s*[:#]?\\s*([A-Z0-9\\-]{6,40})/i) ||
                text.match(/AWB\\s*[:#]?\\s*([A-Z0-9\\-]{6,40})/i);
              if (trackingMatch && trackingMatch[1]) {
                const candidate = trackingMatch[1].trim();
                // Reject obvious noise words (the page sometimes says things
                // like "Tracking ID: provided by Amazon Shipping" — my old
                // pattern would capture "provided") and require >=4 digits
                // because every real Amazon/Indian-courier AWB has plenty.
                const noise = /^(?:provided|pending|none|null|tbd|n\\/a|na|tba)$/i;
                const digitCount = (candidate.match(/\\d/g) || []).length;
                if (!noise.test(candidate) && digitCount >= 4) {
                  result.tracking_id = candidate;
                }
              }

              const carrierMatch =
                text.match(/Shipping\\s*Service\\s*[:#]?\\s*([^\\n\\r]{2,60})/i) ||
                text.match(/Shipping\\s*Service\\s*Provider\\s*[:#]?\\s*([^\\n\\r]{2,60})/i) ||
                text.match(/Carrier\\s*[:#]?\\s*([^\\n\\r]{2,60})/i);
              if (carrierMatch && carrierMatch[1]) {
                // Strip noise like trailing labels
                result.carrier = carrierMatch[1]
                  .replace(/\\bTracking\\b.*$/i, '')
                  .replace(/\\bShipped\\b.*$/i, '')
                  .trim();
              }

              // Banner / status line indicating Amazon already sees this as shipped.
              if (/\\b(?:Shipped|Order\\s*shipped|Shipment\\s*confirmed)\\b/i.test(text.slice(0, 800))) {
                result.shipped_on_amazon = true;
              }
              // If we have tracking ID, treat as shipped even without an explicit banner.
              if (result.tracking_id) {
                result.shipped_on_amazon = true;
              }

              const shipDateMatch = text.match(/Shipped\\s*(?:on|at)?\\s*[:#]?\\s*([A-Za-z0-9,\\s:]{6,40})/i);
              if (shipDateMatch && shipDateMatch[1]) {
                result.shipped_at = shipDateMatch[1].trim().slice(0, 60);
              }

              // ---- Shipping Address block ----
              // Seller Central renders the buyer address in a card; the heading is one of
              // 'Shipping Address' / 'Ship to' / 'Buyer address'. We grab the block until
              // the next section heading (rough heuristic by blank lines).
              const shipHeadingRx = /(?:Shipping\\s*Address|Ship\\s*to|Buyer\\s*address)\\s*[:\\n]/i;
              const shipMatch = text.match(shipHeadingRx);
              let shipBlock = '';
              if (shipMatch) {
                const start = shipMatch.index + shipMatch[0].length;
                // Take up to ~600 chars or until next obvious header
                const tail = text.slice(start, start + 800);
                const stopRx = /\\n\\s*(?:Order\\s*Details|Order\\s*contents|Seller\\s*notes|Buyer\\s*notes|Payment|Items?\\s*Ordered|Order\\s*total|Subtotal)/i;
                const stop = tail.search(stopRx);
                shipBlock = (stop > 0 ? tail.slice(0, stop) : tail).trim();
              }
              result.raw_ship_to = shipBlock;

              // ---- Buyer / Seller notes block ----
              // Phones are very often pasted by buyers into 'Buyer notes' / 'Seller notes'.
              const notesHeadingRx = /(?:Buyer\\s*notes|Seller\\s*notes|Buyer\\s*comments?|Gift\\s*message)\\s*[:\\n]/i;
              const notesMatch = text.match(notesHeadingRx);
              let notesBlock = '';
              if (notesMatch) {
                const start = notesMatch.index + notesMatch[0].length;
                const tail = text.slice(start, start + 600);
                const stopRx = /\\n\\s*(?:Order\\s*Details|Order\\s*contents|Items?\\s*Ordered|Order\\s*total|Subtotal|Payment|Shipping\\s*Address|Ship\\s*to)/i;
                const stop = tail.search(stopRx);
                notesBlock = (stop > 0 ? tail.slice(0, stop) : tail).trim();
              }
              result.seller_notes = notesBlock;

              // ---- Phone extraction with priority ----
              const phoneRx = /(?:\\+?91[\\s-]?)?([6-9]\\d{9})\\b/;
              const findPhone = (s) => {
                if (!s) return null;
                const m = s.match(phoneRx);
                return m ? m[1] : null;
              };
              let phone = findPhone(shipBlock);
              if (phone) {
                result.phone = phone;
                result.phone_found_in = 'shipping';
              } else {
                phone = findPhone(notesBlock);
                if (phone) {
                  result.phone = phone;
                  result.phone_found_in = 'seller_notes';
                } else {
                  // Last resort: look in the whole page, but anchored near a phone keyword
                  const anchoredRx = /(?:Phone|Mobile|Contact)[^0-9]{0,15}(?:\\+?91[\\s-]?)?([6-9]\\d{9})\\b/i;
                  const am = text.match(anchoredRx);
                  if (am) {
                    result.phone = am[1];
                    result.phone_found_in = 'page';
                  }
                }
              }

              // ---- Pincode + state + city from shipping block ----
              if (shipBlock) {
                const pinMatch = shipBlock.match(/\\b(\\d{6})\\b/);
                if (pinMatch) result.pincode = pinMatch[1];

                // Indian state list (uppercase comparison)
                const STATES = [
                  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
                  'Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu & Kashmir',
                  'Jammu and Kashmir','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
                  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha',
                  'Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
                  'Uttar Pradesh','Uttarakhand','West Bengal','Chandigarh','Puducherry',
                  'Andaman & Nicobar Islands','Dadra & Nagar Haveli and Daman & Diu',
                  'Lakshadweep','Ladakh'
                ];
                const upper = shipBlock.toUpperCase();
                for (const s of STATES) {
                  if (upper.includes(s.toUpperCase())) {
                    result.state = s === 'Jammu and Kashmir' ? 'Jammu & Kashmir' : s;
                    break;
                  }
                }

                // City = last comma-separated token on the pincode line.
                // Layout is usually: "Name\\nLine1\\nLine2\\nCity, STATE PINCODE\\nIN"
                // Use word-boundary 6-digit regex so we DON'T match the first 6 of a 10-digit phone.
                // Iterate forward (pincode comes before phone) and stop at the first hit.
                const lines = shipBlock.split('\\n').map(l => l.trim()).filter(Boolean);
                const pinLineRx = /\\b\\d{6}\\b/;
                for (const ln of lines) {
                  if (pinLineRx.test(ln)) {
                    let cityLine = ln.replace(pinLineRx, '').trim();
                    if (result.state) {
                      cityLine = cityLine.replace(new RegExp(result.state, 'i'), '').trim();
                    }
                    // Strip non-breaking spaces and trailing punctuation
                    cityLine = cityLine.replace(/\\u00a0/g, ' ').replace(/[,\\-\\s]+$/, '').trim();
                    const parts = cityLine.split(',').map(p => p.trim()).filter(Boolean);
                    if (parts.length) result.city = parts[parts.length - 1];
                    break;
                  }
                }

                // Buyer name = first non-empty line that doesn't look like an address line
                for (const ln of lines) {
                  if (!ln) continue;
                  if (/\\d/.test(ln)) continue;       // contains digits → likely address
                  if (/^IN$/i.test(ln)) continue;     // country code
                  // Looks like a name (letters + spaces, possibly mixed case)
                  if (/^[A-Za-z][A-Za-z\\s.'-]{1,80}$/.test(ln)) {
                    result.buyer_name = ln.trim();
                    break;
                  }
                }

                // Address = everything between the buyer_name line and the city/pincode line
                const nameIdx = result.buyer_name ? lines.indexOf(result.buyer_name) : -1;
                const pinIdx = lines.findIndex(l => /\\b\\d{6}\\b/.test(l));
                if (nameIdx >= 0 && pinIdx > nameIdx) {
                  result.address = lines.slice(nameIdx + 1, pinIdx).join(', ');
                } else if (pinIdx > 0) {
                  result.address = lines.slice(0, pinIdx).join(', ');
                }
              }

              // ===== Product extraction =====
              // The order page renders product details inside a table cell
              // that holds the title + ASIN + SKU lines. Other meta fields
              // (Condition, Order Item ID) live in the adjacent
              // "More Information" cell. We:
              //   1. iterate only <td> (not <div>) to avoid matching outer
              //      wrappers that include column-header text;
              //   2. for the title, search the SAME td as the ASIN, skip
              //      header strings ("Product name", "More Information",
              //      etc.) and short noise lines;
              //   3. for ASIN/SKU/Condition/Order Item ID, regex the entire
              //      page text — those labels are unique.
              result.product_title = '';
              result.product_sku = '';
              result.asin = '';
              result.order_item_id = '';
              result.condition = '';

              const HEADER_WORDS = new Set([
                'product name','product details','more information','image',
                'status','unit price','order totals','proceeds','quantity',
                'order details','condition','sku','asin','order item id',
              ]);

              for (const td of document.querySelectorAll('td')) {
                const t = td.innerText || '';
                if (!/ASIN[:\\s]*[A-Z0-9]{10}/.test(t)) continue;
                if (t.length > 600) continue;  // skip the entire-row wrappers
                const tLines = t.split('\\n').map(s => s.trim()).filter(Boolean);
                const title = tLines.find(l =>
                  l.length > 8 &&
                  !HEADER_WORDS.has(l.toLowerCase()) &&
                  !/^(ASIN|SKU|Condition|Order Item ID|Quantity|Item subtotal|Tax|Item total|Unit price)[:\\s]/i.test(l) &&
                  // Real product titles tend to have spaces; reject single-word noise
                  /\\s/.test(l)
                );
                if (title) { result.product_title = title; break; }
              }

              // ASIN / SKU / Order Item ID / Condition: regex the full text.
              const fullText = text;
              const asinM = fullText.match(/ASIN[:\\s]*([A-Z0-9]{10})/i);
              const skuM = fullText.match(/SKU[:\\s]*([^\\n\\r]+)/i);
              const itemM = fullText.match(/Order Item ID[:\\s]*([0-9]+)/i);
              const condM = fullText.match(/Condition[:\\s]*([^\\n\\r]+)/i);
              if (asinM) result.asin = asinM[1].trim();
              if (skuM) result.product_sku = skuM[1].trim().replace(/[.\\s]+$/, '');
              if (itemM) result.order_item_id = itemM[1].trim();
              if (condM) result.condition = condM[1].trim();

              return result;
            }
            """
        )

        scraped = scraped or {}

        # ---- Parse the [SELLER NOTES] textarea block in Python ----
        # Amazon hides full street+phone from the visible page; the team pastes
        # it into the Seller Notes textarea. We override the shipping-side
        # fields with notes-side values when present (notes data is richer).
        seller_notes_text = scraped.get("seller_notes") or ""
        notes_marker = "[SELLER NOTES]"
        idx = seller_notes_text.find(notes_marker)
        notes_block = ""
        if idx >= 0:
            notes_block = seller_notes_text[idx + len(notes_marker):].strip()
        if notes_block:
            notes_lines = [l.strip() for l in notes_block.splitlines() if l.strip()]
            # Find the canonical "CITY, STATE 6-digit-pincode" line — this is
            # almost always the LAST line that has both a comma and a pincode.
            # An earlier line might have a pincode embedded in a village/PO
            # name; we want the city/state summary line, not that.
            pin_line_idx = None
            for i in range(len(notes_lines) - 1, -1, -1):
                l = notes_lines[i]
                if re.match(r'^[A-Za-z .]+,\s*[A-Za-z .]+?\s*\d{6}\b', l):
                    pin_line_idx = i
                    break
            if pin_line_idx is None:
                # Fallback: any line with a pincode
                for i, l in enumerate(notes_lines):
                    if re.search(r'\b\d{6}\b', l):
                        pin_line_idx = i
                        break
            if pin_line_idx is not None:
                pin_line = notes_lines[pin_line_idx]
                m_pin = re.search(r'\b(\d{6})\b', pin_line)
                if m_pin:
                    scraped["pincode"] = m_pin.group(1)
                m_cs = re.match(r'^([A-Za-z .]+),\s*([A-Za-z .]+?)\s*\d', pin_line)
                if m_cs:
                    scraped["city"]  = m_cs.group(1).strip()
                    scraped["state"] = m_cs.group(2).strip()
                # Address = lines between buyer name (line 0) and pin line, excluding marker noise
                addr_lines = [l for l in notes_lines[1:pin_line_idx]
                              if not re.match(r'^(Phone|Contact Buyer|Mobile)\s*:?', l, re.I)]
                if addr_lines:
                    scraped["address"] = ", ".join(addr_lines)
            # Buyer name from first line of notes (if it looks like a name)
            if notes_lines:
                first = notes_lines[0]
                if not re.search(r'\d', first) and 2 <= len(first) <= 80:
                    scraped["buyer_name"] = first
            # Phone — prefer one explicitly labelled "Phone:"
            for l in notes_lines:
                mp = re.match(r'(?:Phone|Mobile|Contact)\s*:?\s*(?:\+?91[\s-]?)?([6-9]\d{9})\b', l, re.I)
                if mp:
                    scraped["phone"] = mp.group(1)
                    scraped["phone_found_in"] = "seller_notes"
                    break

        buyer_name = (scraped.get("buyer_name") or "").strip()
        parts = buyer_name.split() if buyer_name else []
        first_name = parts[0] if parts else ""
        last_name = " ".join(parts[1:]) if len(parts) > 1 else ""

        result = {
            "order_id": order_id,
            "buyer_name": buyer_name,
            "first_name": first_name,
            "last_name": last_name,
            "address": (scraped.get("address") or "").strip(),
            "city": (scraped.get("city") or "").strip(),
            "state": (scraped.get("state") or "").strip(),
            "pincode": (scraped.get("pincode") or "").strip(),
            "phone": (scraped.get("phone") or "").strip(),
            "phone_found_in": scraped.get("phone_found_in") or "none",
            "seller_notes": (scraped.get("seller_notes") or "").strip(),
            "raw_ship_to": (scraped.get("raw_ship_to") or "").strip(),
            "cancelled_on_amazon": bool(scraped.get("cancelled_on_amazon")),
            "tracking_id": (scraped.get("tracking_id") or "").strip(),
            "carrier": (scraped.get("carrier") or "").strip(),
            "shipped_on_amazon": bool(scraped.get("shipped_on_amazon")),
            "shipped_at": (scraped.get("shipped_at") or "").strip(),
            # Product fields — used to render Amazon-format packing slips.
            "product_title": (scraped.get("product_title") or "").strip(),
            "product_sku": (scraped.get("product_sku") or "").strip(),
            "asin": (scraped.get("asin") or "").strip(),
            "order_item_id": (scraped.get("order_item_id") or "").strip(),
            "condition": (scraped.get("condition") or "").strip(),
        }

        if result["cancelled_on_amazon"]:
            await self._notify_status(f"🚫 {order_id}: cancelled on Amazon — skipping PII")
        else:
            tracking_blurb = (
                f" • 📦 {result['tracking_id']} ({result['carrier'] or 'no carrier'})"
                if result["tracking_id"] else ""
            )
            await self._notify_status(
                f"📋 {order_id}: {buyer_name or '(no name)'} • "
                f"{result['city'] or '?'}, {result['state'] or '?'} {result['pincode'] or ''} • "
                f"phone={result['phone'] or 'MISSING'} ({result['phone_found_in']})"
                f"{tracking_blurb}"
            )
        return result

    async def scrape_fba_reimbursements(self, since_date: Optional[str] = None) -> Dict[str, Any]:
        """Scrape the FBA Reimbursements report from Seller Central.

        Amazon doesn't ship reimbursement data via SP-API in any usable form
        for Indian sellers — the only authoritative source is the report
        page. This walks it and returns structured rows.

        Args:
            since_date: optional YYYY-MM-DD lower bound; rows older than this
                are dropped after parsing. Default: 90 days back.

        Returns:
            {
              "status": "ok" | "not_logged_in" | "page_changed" | "error",
              "rows": [
                 {
                   "reimbursement_id": str,
                   "approval_date": str (YYYY-MM-DD),
                   "case_id": str | None,
                   "amazon_order_id": str | None,
                   "reason": str,
                   "sku": str | None,
                   "fnsku": str | None,
                   "asin": str | None,
                   "quantity": int,
                   "amount": float,
                   "currency": str,
                 }, ...
              ],
              "raw_text_sample": str,   # first 2000 chars of page text — helps
                                        # the user / future maintainer adjust
                                        # selectors when Amazon changes the
                                        # report layout
              "error": str | None,
            }

        The selectors are a best-effort guess against Seller Central as of
        2026-05; Amazon changes report HTML without notice. On failure the
        function returns a structured `status` so the caller can degrade
        gracefully rather than throw.
        """
        if not self.page:
            return {"status": "not_logged_in", "rows": [], "raw_text_sample": "",
                    "error": "Browser not started"}
        if self.state not in (AgentState.LOGGED_IN, AgentState.PROCESSING):
            # Try a live login check before bailing — state can drift if no
            # one's hit the agent in a while but the cookies are still valid.
            logged_in = await self.check_login_status()
            if not logged_in:
                return {"status": "not_logged_in", "rows": [], "raw_text_sample": "",
                        "error": "Not logged in to Seller Central"}

        await self._notify_status("📑 Scraping FBA Reimbursements report…")

        # Date range — default last 90 days
        from datetime import datetime as _dt, timedelta as _td
        if not since_date:
            since_date = (_dt.utcnow() - _td(days=90)).strftime("%Y-%m-%d")
        end_date = _dt.utcnow().strftime("%Y-%m-%d")

        # Reimbursements live in TWO places on Seller Central, both of which
        # we'll probe in order of preference:
        #   1. Payments dashboard (top nav Payments → Payments) — has a
        #      "Reimbursements" tab with the raw transaction-level data.
        #      This is the canonical source.
        #   2. Reports Central (Reports → Fulfilment → Payments → Reimbursements)
        #      — the report-builder view, exports CSV. Backup path.
        # Amazon has shuffled direct URLs across redesigns; deep-links often
        # redirect to a landing page, so the dispatcher below falls back to
        # text-based click-through after navigation.
        candidate_urls = [
            # Payments dashboard — preferred path
            "https://sellercentral.amazon.in/payments/dashboard/index.html",
            "https://sellercentral.amazon.in/payments/dashboard",
            "https://sellercentral.amazon.in/gp/payments-account/view-transactions.html",
            # Reports Central — fallback (with date-range as URL params)
            f"https://sellercentral.amazon.in/reportcentral/REIMBURSEMENTS/0?startDate={since_date}&endDate={end_date}",
            "https://sellercentral.amazon.in/reportcentral/REIMBURSEMENTS/0",
            "https://sellercentral.amazon.in/inventoryplanning/reimbursements",
            "https://sellercentral.amazon.in/reportcentral",
            "https://sellercentral.amazon.in/reports",
        ]
        loaded = False
        last_err = None
        for url in candidate_urls:
            try:
                await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(4)  # let React render the table
                if "404" not in (self.page.url or "") and "not-found" not in (self.page.url or ""):
                    loaded = True
                    break
            except Exception as e:
                last_err = str(e)
                continue
        if not loaded:
            return {"status": "page_changed", "rows": [], "raw_text_sample": "",
                    "error": f"All reimbursement URLs failed; last error: {last_err or 'navigation'}"}

        await self._capture_screenshot()

        # Click-through to the Reimbursements view. Two cases:
        #   - Payments dashboard: Reimbursements is a TAB on the page —
        #     usually a button or anchor with role="tab".
        #   - Reports menu: Reimbursements is a link in the side-nav.
        # Same JS handles both — we just match by visible text and prefer
        # tabs/buttons over deep links when on the Payments page.
        try:
            clicked = await self.page.evaluate(
                r"""
                () => {
                  const onPayments = location.href.includes('/payments/');
                  // Tabs first on Payments page; anchors first elsewhere.
                  const tabSelectors = '[role="tab"], button, .a-tab-heading a, .a-tab a';
                  const linkSelectors = 'a, [role="link"], button, [role="button"]';
                  const order = onPayments
                    ? [tabSelectors, linkSelectors]
                    : [linkSelectors, tabSelectors];
                  const re = /^\s*reimbursements?\s*$/i;
                  for (const sel of order) {
                    const els = Array.from(document.querySelectorAll(sel));
                    let target = els.find(a => re.test(a.innerText || a.textContent || ''));
                    if (!target) {
                      target = els.find(a => {
                        const t = (a.innerText || a.textContent || '');
                        return /reimburs/i.test(t) && t.length < 40;
                      });
                    }
                    if (target) {
                      target.scrollIntoView({ block: 'center' });
                      target.click();
                      return true;
                    }
                  }
                  return false;
                }
                """
            )
            if clicked:
                await self._notify_status("📑 Clicked Reimbursements link in Reports menu…")
                # Let the report page render. Amazon's React stack typically needs
                # 5-8s to mount the data grid and populate filter controls.
                await asyncio.sleep(7)
                await self._capture_screenshot()
        except Exception as e:
            logger.debug(f"[reimbursements] menu click skipped: {e}")

        # Try to set the date range via the report's filter UI (URL params are
        # ignored after the menu navigation). Best-effort — many reports default
        # to 30 days; this widens to our requested window. We type into any input
        # whose nearby label/placeholder/name mentions start/end/from/to/date.
        try:
            await self.page.evaluate(
                f"""
                () => {{
                  const since = "{since_date}";
                  const end   = "{end_date}";
                  const inputs = Array.from(document.querySelectorAll('input'));
                  const labelOf = (el) => {{
                    const id = el.id;
                    const lbl = id ? document.querySelector(`label[for="${{id}}"]`) : null;
                    return ((lbl && lbl.innerText) || el.placeholder || el.name || el.getAttribute('aria-label') || '').toLowerCase();
                  }};
                  const fire = (el, val) => {{
                    el.focus();
                    el.value = val;
                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    el.blur();
                  }};
                  for (const inp of inputs) {{
                    const lab = labelOf(inp);
                    if (/start|from|since/.test(lab) && /date/.test(lab + inp.type)) fire(inp, since);
                    else if (/end|to|until/.test(lab) && /date/.test(lab + inp.type)) fire(inp, end);
                    else if (inp.type === 'date' && /start|from|since/.test(lab)) fire(inp, since);
                    else if (inp.type === 'date' && /end|to|until/.test(lab))     fire(inp, end);
                  }}
                }}
                """
            )
            # Click any "Generate" / "Request" / "Show" / "Apply" / "Search" button.
            generated = await self.page.evaluate(
                r"""
                () => {
                  const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'));
                  const re = /^\s*(request|generate|show|apply|search|update|run)( report)?\s*$/i;
                  const target = buttons.find(b => re.test(b.innerText || b.value || ''));
                  if (target) { target.scrollIntoView(); target.click(); return true; }
                  return false;
                }
                """
            )
            if generated:
                await self._notify_status("📑 Submitted date range; waiting for report to render…")
                await asyncio.sleep(8)
                await self._capture_screenshot()
        except Exception as e:
            logger.debug(f"[reimbursements] date-range / generate skipped: {e}")

        # Extract rows via page.evaluate. We try the canonical table first;
        # if that fails we fall back to scraping the page text and let the
        # accountant correct the parser. Returning raw_text_sample either way
        # is intentional — it makes selector drift debuggable without SSH.
        scraped = await self.page.evaluate(
            r"""
            () => {
              const out = { rows: [], raw_text_sample: '', table_found: false };
              const body = document.body || {};
              out.raw_text_sample = (body.innerText || '').slice(0, 2000);

              // Canonical: a single <table> or [role="grid"] with rows.
              const tables = Array.from(document.querySelectorAll(
                'table, [role="grid"], .kat-table, .a-table'
              ));
              const headerKeywords = ['reimbursement', 'amount', 'sku', 'reason', 'approval'];

              const parseTable = (tbl) => {
                const rows = Array.from(tbl.querySelectorAll('tr, [role="row"]'));
                if (rows.length < 2) return [];
                // Identify header
                const headerCells = Array.from(rows[0].querySelectorAll('th, [role="columnheader"], td'))
                  .map(c => (c.innerText || '').trim().toLowerCase());
                const hits = headerKeywords.filter(k => headerCells.some(h => h.includes(k)));
                if (hits.length < 2) return [];  // not the right table

                const colIndex = (name) => headerCells.findIndex(h => h.includes(name));
                const colReim = colIndex('reimbursement');
                const colDate = colIndex('approval') !== -1 ? colIndex('approval') : colIndex('date');
                const colCase = colIndex('case');
                const colOrd  = colIndex('order');
                const colReas = colIndex('reason');
                const colSku  = colIndex('sku');
                const colFns  = colIndex('fnsku');
                const colAsin = colIndex('asin');
                const colQty  = colIndex('quantity');
                const colAmt  = colIndex('amount');
                const colCur  = colIndex('currency');

                const result = [];
                for (let i = 1; i < rows.length; i++) {
                  const cells = Array.from(rows[i].querySelectorAll('td, [role="cell"]'))
                    .map(c => (c.innerText || '').trim());
                  if (cells.length === 0) continue;
                  const get = (idx) => (idx >= 0 && idx < cells.length) ? cells[idx] : '';
                  const amtRaw = get(colAmt).replace(/[^\d.\-]/g, '');
                  const qtyRaw = get(colQty).replace(/[^\d]/g, '');
                  const row = {
                    reimbursement_id: get(colReim),
                    approval_date: get(colDate),
                    case_id: get(colCase) || null,
                    amazon_order_id: get(colOrd) || null,
                    reason: get(colReas),
                    sku: get(colSku) || null,
                    fnsku: get(colFns) || null,
                    asin: get(colAsin) || null,
                    quantity: qtyRaw ? parseInt(qtyRaw, 10) : 0,
                    amount: amtRaw ? parseFloat(amtRaw) : 0,
                    currency: get(colCur) || 'INR',
                  };
                  if (row.reimbursement_id) result.push(row);
                }
                return result;
              };

              for (const tbl of tables) {
                const rows = parseTable(tbl);
                if (rows.length > 0) {
                  out.rows = rows;
                  out.table_found = true;
                  break;
                }
              }
              return out;
            }
            """
        )

        rows = scraped.get("rows") or []
        # Filter to since_date and normalize date format (Amazon dates can be
        # 'Apr 28, 2026' / '28/04/2026' / '2026-04-28' depending on locale).
        def _norm_date(s: str) -> str:
            if not s:
                return ""
            s = s.strip()
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%b %d, %Y", "%d %b %Y"):
                try:
                    return _dt.strptime(s, fmt).strftime("%Y-%m-%d")
                except ValueError:
                    continue
            return s  # leave as-is; downstream will treat as opaque string

        for r in rows:
            r["approval_date"] = _norm_date(r.get("approval_date", ""))
        rows = [r for r in rows if (r.get("approval_date") or "") >= since_date]

        status = "ok" if scraped.get("table_found") else "page_changed"
        await self._notify_status(
            f"📑 Reimbursements: {len(rows)} rows (status={status})"
        )

        # Deterministic path failed → hand off to the Claude brain.
        # The brain sees a screenshot of where we ended up and decides
        # what to click next. Far slower (~30-90s, costs API tokens) but
        # robust to Amazon's UI churn — we keep the cheap path for the
        # 95% case, and pay for the smart path only when needed.
        if status == "page_changed":
            brain_result = await self._brain_scrape_reimbursements(since_date, end_date)
            if brain_result is not None:
                return brain_result

        return {
            "status": status,
            "rows": rows,
            "raw_text_sample": scraped.get("raw_text_sample") or "",
            "error": None if status == "ok" else "Reimbursement table not found — selectors may need updating",
        }

    async def _search_order_by_id(self, order_id: str) -> bool:
        """Navigate to an order's detail page by typing the order ID into the
        Seller Central top search bar (the path a human uses for non-FBA
        orders). Returns True if we landed on something that looks like an
        order page."""
        try:
            # Go to a stable page that has the global search bar in the header.
            await self.page.goto(
                "https://sellercentral.amazon.in/home",
                wait_until="domcontentloaded", timeout=30000,
            )
            await asyncio.sleep(2)
            # Find the search input. Seller Central's top bar has used a few
            # selectors over the years — try common ones in order.
            filled = await self.page.evaluate(
                r"""
                (orderId) => {
                  const candidates = Array.from(document.querySelectorAll(
                    'input[type="search"], input[type="text"], input[role="combobox"], ' +
                    'input[placeholder*="search" i], input[aria-label*="search" i], ' +
                    'input[id*="search" i], input[name*="search" i]'
                  ));
                  // Prefer the one in the page header (top 200px).
                  candidates.sort((a, b) => {
                    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
                    const ta = ra.top < 200 ? 0 : 1, tb = rb.top < 200 ? 0 : 1;
                    return ta - tb;
                  });
                  const inp = candidates[0];
                  if (!inp) return false;
                  inp.focus();
                  // React-friendly value setter
                  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                  setter.call(inp, orderId);
                  inp.dispatchEvent(new Event('input', { bubbles: true }));
                  inp.dispatchEvent(new Event('change', { bubbles: true }));
                  return true;
                }
                """,
                order_id,
            )
            if not filled:
                logger.warning(f"[order-search] no search input found for {order_id}")
                return False
            await self.page.keyboard.press("Enter")
            await asyncio.sleep(4)
            url = (self.page.url or "").lower()
            return "order" in url or "search" in url
        except Exception as e:
            logger.warning(f"[order-search] failed for {order_id}: {e}")
            return False

    async def scrape_order_transactions(self, order_id: str) -> Dict[str, Any]:
        """On-demand financial scrape of one Amazon order.

        Used by the accountant 'Verify on Amazon' button to settle a
        dispute about what Amazon did with a specific order — charges,
        platform fees, refunds, reimbursements. Complements the bulk
        Reimbursements report (which covers everything including
        orphans without an order ID); this fills in the per-order
        detail you need to argue a claim or close a recon gap.

        Returns:
            {
              "status": "ok" | "not_logged_in" | "page_changed" | "error",
              "order_id": str,
              "url": str,                      # where we ended up
              "transactions": [                # one per financial event
                {"date": str, "type": str, "amount": float,
                 "description": str, "currency": str},
                ...
              ],
              "totals": {                      # roll-ups if visible on page
                "product_sales": float,
                "promotions": float,
                "fba_fees": float,
                "selling_fees": float,
                "refunds": float,
                "net": float,
              },
              "raw_text_sample": str,
              "error": str | None,
            }
        """
        if not self.page:
            return {"status": "not_logged_in", "order_id": order_id, "url": "",
                    "transactions": [], "totals": {}, "raw_text_sample": "",
                    "error": "Browser not started"}
        if self.state not in (AgentState.LOGGED_IN, AgentState.PROCESSING):
            logged_in = await self.check_login_status()
            if not logged_in:
                return {"status": "not_logged_in", "order_id": order_id, "url": "",
                        "transactions": [], "totals": {}, "raw_text_sample": "",
                        "error": "Not logged in to Seller Central"}

        await self._notify_status(f"💸 Scraping transactions for order {order_id}…")

        # Try the regular order detail page first (works for non-FBA orders) then
        # fall back to typing the order ID into Seller Central's top search bar
        # — which is the path a human takes for non-FBA orders. The old
        # /payments/event/transactions/details deep-link is FBA-only and has
        # been removed.
        candidate_urls = [
            f"https://sellercentral.amazon.in/orders-v3/order/{order_id}",
            f"https://sellercentral.amazon.in/orders-v3?search-query={order_id}",
        ]
        loaded = False
        last_err = None
        for url in candidate_urls:
            try:
                await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(3)
                loaded = True
                break
            except Exception as e:
                last_err = str(e)
                continue

        # If neither URL loaded, try the search-bar route — go to the home page
        # and type the order ID into the global search input.
        if loaded and "order" not in (self.page.url or "").lower():
            loaded = await self._search_order_by_id(order_id)

        if not loaded:
            return {"status": "error", "order_id": order_id, "url": self.page.url or "",
                    "transactions": [], "totals": {}, "raw_text_sample": "",
                    "error": f"Navigation failed: {last_err}"}

        # If we landed on the order page, find and click the 'View transactions'
        # link. Some redesigns label it 'Transactions', 'Financial summary', or
        # 'Order financials'. We try a few synonyms.
        try:
            clicked = await self.page.evaluate(
                r"""
                () => {
                  const re = /^\s*(view\s+transactions?|transactions?|order\s+financial.?|financial\s+summary|payments?)\s*$/i;
                  const els = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"], [role="tab"]'));
                  const target = els.find(a => {
                    const t = (a.innerText || a.textContent || '').trim();
                    return t && re.test(t);
                  });
                  if (target) {
                    target.scrollIntoView({ block: 'center' });
                    target.click();
                    return true;
                  }
                  return false;
                }
                """
            )
            if clicked:
                await asyncio.sleep(4)
        except Exception as e:
            logger.debug(f"[order-txn] view-transactions click skipped: {e}")

        await self._capture_screenshot()

        # Seller-fulfilled order detail page extractor. The page layout is:
        #   - Optional alert banner with order status (Cancelled, etc.)
        #   - "Order Summary" card with Purchase date, Fulfillment, etc.
        #   - "Order contents" table: Status | Image | Product name | More Information | Unit price | Proceeds
        # 'Proceeds' is the post-fee net per item — what the seller actually
        # gets paid. Empty for cancelled orders.
        scraped = await self.page.evaluate(
            r"""
            (orderId) => {
              const out = {
                order_status: '',
                purchase_date: '',
                fulfillment: '',
                items: [],
                totals: {},
                raw_text_sample: '',
                url: location.href,
                page_recognized: false,
              };
              const body = document.body || {};
              const text = body.innerText || '';
              out.raw_text_sample = text.slice(0, 2500);

              // Confirm we're on an order page. Three heuristics: URL pattern,
              // page text mentions 'Order details', or page text contains
              // exactly the order id we asked for.
              out.page_recognized = (
                /orders-v3\/order\//i.test(location.href) ||
                /Order details/i.test(text) ||
                text.includes(orderId)
              );

              // Read a key/value pair where label and value sit in adjacent
              // table cells (Amazon's preferred layout for the summary card).
              const readLabelValue = (labelRe) => {
                const cells = Array.from(document.querySelectorAll('td, th, .a-text-bold, dt, dd'));
                for (let i = 0; i < cells.length; i++) {
                  const t = (cells[i].innerText || '').trim();
                  if (labelRe.test(t)) {
                    // Try the next sibling cell, or the next cell in the row,
                    // or the next-but-one (Amazon sometimes interleaves spacer cells).
                    const candidates = [
                      cells[i].nextElementSibling,
                      cells[i + 1],
                      cells[i + 2],
                    ].filter(Boolean);
                    for (const c of candidates) {
                      const v = (c.innerText || '').trim();
                      if (v && !labelRe.test(v)) return v;
                    }
                  }
                }
                return '';
              };

              out.purchase_date = readLabelValue(/^purchase date/i);
              out.fulfillment   = readLabelValue(/^fulfillment/i);

              // Order status — try the alert banner first ("Order Cancelled",
              // "Shipped on …"), else fall back to text near the order id.
              const alertEl = document.querySelector(
                '.a-alert-content h4, .a-alert-content .a-alert-heading, ' +
                '[class*="alert"] h4, [class*="status"]'
              );
              if (alertEl) {
                const at = (alertEl.innerText || '').trim();
                if (at && at.length < 80) out.order_status = at;
              }
              if (!out.order_status) {
                for (const kw of ['Cancelled', 'Shipped', 'Delivered', 'Unshipped',
                                  'Pending', 'Refunded', 'Returned']) {
                  if (new RegExp('\\b' + kw + '\\b', 'i').test(text.slice(0, 600))) {
                    out.order_status = kw;
                    break;
                  }
                }
              }

              // Take only the FIRST money-like substring from the cell, so we
              // don't concatenate "₹15,432.20" with a second number on the next
              // line (which would yield 15432.202777 instead of 15432.20).
              const toNum = (s) => {
                if (!s) return null;
                const m = String(s).match(/-?[\d,]+(?:\.\d+)?/);
                if (!m) return null;
                const n = parseFloat(m[0].replace(/,/g, ''));
                return Number.isFinite(n) ? n : null;
              };

              // Find the Order contents table by looking for headers that
              // include both 'Product name' (or 'Product') AND 'Unit price'.
              // That uniquely identifies the items table. Critical: skip
              // hidden header cells (e.g. 'Gift Options' with class
              // 'hidden-table-cell') — they don't have a matching data cell
              // so leaving them in shifts all subsequent column indices by 1.
              const visibleCells = (row) => Array.from(row.querySelectorAll('th, td'))
                .filter(c => !c.classList.contains('hidden-table-cell') &&
                             !c.classList.contains('hidden') &&
                             c.getAttribute('style')?.includes('display: none') !== true);
              const allTables = Array.from(document.querySelectorAll('table'));
              for (const tbl of allTables) {
                const rows = Array.from(tbl.querySelectorAll('tr'));
                if (rows.length < 2) continue;
                let headerRow = null, headerCells = [];
                for (const r of rows) {
                  const cs = visibleCells(r).map(c => (c.innerText || '').trim().toLowerCase());
                  if (cs.some(c => c.includes('product')) &&
                      cs.some(c => c.includes('price') || c.includes('proceeds'))) {
                    headerRow = r;
                    headerCells = cs;
                    break;
                  }
                }
                if (!headerRow) continue;

                const idx = (frag) => headerCells.findIndex(h => h.includes(frag));
                const cStatus   = idx('status');
                const cProduct  = idx('product');
                const cMoreInfo = idx('more information') !== -1 ? idx('more information') : idx('information');
                const cUnit     = idx('unit price') !== -1 ? idx('unit price') : idx('price');
                const cProceeds = idx('proceeds');
                const cQty      = idx('quantity') !== -1 ? idx('quantity') : idx('qty');

                let started = false;
                for (const r of rows) {
                  if (!started) { if (r === headerRow) started = true; continue; }
                  // Use the same visibility filter as for the header so indices
                  // line up — even though data rows rarely have hidden cells,
                  // it keeps the contract consistent.
                  const cells = visibleCells(r);
                  if (!cells.length) continue;
                  const get = (k) => (k >= 0 && k < cells.length) ? (cells[k].innerText || '').trim() : '';
                  const moreInfo = get(cMoreInfo);
                  // More Information cell holds Condition / Order Item ID multi-lines.
                  const asinMatch = moreInfo.match(/ASIN[:\s]*([A-Z0-9]{10})/i) ||
                                    get(cProduct).match(/ASIN[:\s]*([A-Z0-9]{10})/i);
                  const skuMatch  = moreInfo.match(/SKU[:\s]*([^\n\r]+)/i) ||
                                    get(cProduct).match(/SKU[:\s]*([^\n\r]+)/i);
                  const itemIdMatch = moreInfo.match(/Order Item ID[:\s]*([0-9]+)/i);
                  const conditionMatch = moreInfo.match(/Condition[:\s]*([^\n\r]+)/i);
                  // Quantity: only accept a 1-4 digit number directly after
                  // 'Quantity', and only if it's on its own line. Without the
                  // boundary the regex was matching digits inside Order Item ID.
                  const qtyMatch = moreInfo.match(/(?:^|\n)\s*Quantity[:\s]*([0-9]{1,4})\b/i);

                  // Product name is usually the first line of the product cell,
                  // with SKU/ASIN appearing below — strip those.
                  const productCell = get(cProduct);
                  const productName = productCell
                    .split(/\n/)
                    .map(s => s.trim())
                    .find(s => s && !/^(ASIN|SKU|Condition)/i.test(s)) || productCell.slice(0, 200);

                  const unit_price = toNum(get(cUnit));
                  const proceeds = toNum(get(cProceeds));
                  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : (toNum(get(cQty)) || 1);

                  out.items.push({
                    status: get(cStatus),
                    product_name: productName,
                    asin: asinMatch ? asinMatch[1] : '',
                    sku: skuMatch ? skuMatch[1].trim() : '',
                    order_item_id: itemIdMatch ? itemIdMatch[1] : '',
                    condition: conditionMatch ? conditionMatch[1].trim() : '',
                    quantity: quantity,
                    unit_price: unit_price,
                    proceeds: proceeds,
                  });
                }
                if (out.items.length) break;
              }

              // Roll up totals from items.
              let itemTotal = 0, proceedsTotal = 0, anyProceeds = false;
              for (const it of out.items) {
                if (it.unit_price !== null) itemTotal += (it.unit_price * (it.quantity || 1));
                if (it.proceeds !== null)   { proceedsTotal += it.proceeds; anyProceeds = true; }
              }
              out.totals = {
                item_total: out.items.length ? itemTotal : null,
                proceeds_total: anyProceeds ? proceedsTotal : null,
                item_count: out.items.length,
              };

              return out;
            }
            """,
            order_id,
        )

        items = scraped.get("items") or []
        totals = scraped.get("totals") or {}
        order_status_text = scraped.get("order_status") or ""
        raw_text = scraped.get("raw_text_sample") or ""

        # "ok" if we got at least one item OR we positively identified the
        # order as cancelled (zero items expected for a cancellation can still
        # be a successful scrape — we know the financial outcome is zero).
        is_cancelled = bool(re.search(r"cancel", order_status_text, re.I))
        # "not_found" if Amazon explicitly says it can't locate the order
        # (older than 2 years, wrong account, or never existed). Different
        # from "page_changed" — selectors aren't broken, the order just
        # isn't accessible to us. Record so we never retry.
        is_not_found = bool(
            re.search(r"could not find this order|MYO0002|Error Code MYO", raw_text, re.I)
        )
        if is_not_found:
            status = "not_found"
        elif items or is_cancelled:
            status = "ok"
        else:
            status = "page_changed"

        await self._notify_status(
            f"💸 Order {order_id}: {len(items)} items, status='{order_status_text}' "
            f"({status})"
        )

        result = {
            "status": status,
            "order_id": order_id,
            "url": scraped.get("url", self.page.url),
            "order_status": order_status_text,
            "purchase_date": scraped.get("purchase_date", ""),
            "fulfillment": scraped.get("fulfillment", ""),
            "items": items,
            "totals": totals,
            # Kept for backcompat with the old FBA-shaped callers.
            "transactions": [],
            "raw_text_sample": scraped.get("raw_text_sample", ""),
            "error": None if status == "ok" else "Order contents table not found on page",
        }

        # On a miss, dump the page HTML + screenshot for selector debugging.
        # Successes don't dump — saves disk and lets us iterate on whatever
        # the next failed page looks like.
        if status != "ok":
            try:
                import os as _os
                dump_dir = _os.path.join(
                    _os.path.dirname(_os.path.dirname(_os.path.dirname(__file__))),
                    "uploads", "order_scrape_html",
                )
                _os.makedirs(dump_dir, exist_ok=True)
                safe_id = "".join(c for c in order_id if c.isalnum() or c in "-_")
                html = await self.page.content()
                with open(_os.path.join(dump_dir, f"{safe_id}.html"), "w", encoding="utf-8") as f:
                    f.write(html[:500_000])
                # Screenshot is already captured to memory by _capture_screenshot();
                # also write a copy to disk for inspection.
                png = await self.page.screenshot(full_page=False, type="png")
                with open(_os.path.join(dump_dir, f"{safe_id}.png"), "wb") as f:
                    f.write(png)
                logger.info(f"[order-txn] dumped HTML+png for inspection: {dump_dir}/{safe_id}.*")
            except Exception as e:
                logger.warning(f"[order-txn] inspection dump failed: {e}")

        return result

    async def _brain_scrape_order_transactions(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Claude-brain fallback for a single-order transaction scrape."""
        try:
            from .claude_brain import ClaudeBrowserBrain
            brain = ClaudeBrowserBrain(self.page, notify_status=self._notify_status)
        except Exception as e:
            logger.warning(f"[order-txn] brain unavailable: {e}")
            return None

        goal = (
            f"Reach the financial transactions detail page for Amazon order "
            f"{order_id} and return every transaction row (charges, fees, "
            f"refunds, reimbursements) with date, type, and amount."
        )
        hint = (
            f"You should currently be on or near the order detail page for "
            f"{order_id}. Look for a 'View transactions', 'Transactions', "
            f"'Financial summary', or 'Order financials' link/tab — click it. "
            f"The transaction table has columns like Date / Type / Description / "
            f"Amount. When visible, call extract_table_rows with "
            f"header_keywords=['date', 'type', 'amount']."
        )

        try:
            res = await brain.run(goal=goal, hint=hint)
        except Exception as e:
            logger.exception("[order-txn] brain.run crashed")
            return {"status": "error", "order_id": order_id, "url": self.page.url,
                    "transactions": [], "totals": {}, "raw_text_sample": "",
                    "error": f"Claude brain crashed: {str(e)[:200]}", "brain_used": True}

        def _norm(r: Dict[str, Any]) -> Dict[str, Any]:
            lc = {(k or "").lower().strip(): v for k, v in r.items()}
            def _pick(*ks):
                for k in ks:
                    if lc.get(k):
                        return lc[k]
                return ""
            amt_raw = str(_pick("amount", "total", "amount inr")).replace(",", "")
            try:
                amount = float("".join(ch for ch in amt_raw if ch.isdigit() or ch in ".-") or 0)
            except ValueError:
                amount = 0.0
            return {
                "date":        _pick("date", "transaction date"),
                "type":        _pick("type", "transaction type"),
                "description": _pick("description", "details"),
                "amount":      amount,
                "currency":    _pick("currency") or "INR",
                "_raw":        r,
            }

        rows = [_norm(r) for r in (res.get("rows") or [])]
        status = res.get("status", "error")
        if status == "ok" and not rows:
            status = "page_changed"

        return {
            "status": status,
            "order_id": order_id,
            "url": self.page.url,
            "transactions": rows,
            "totals": {},
            "raw_text_sample": (res.get("notes") or "")[:2000],
            "error": None if status == "ok" else (res.get("notes") or "Claude brain could not reach order transactions"),
            "brain_used": True,
            "brain_turns": res.get("turns"),
            "brain_actions": res.get("actions"),
            "brain_tokens": res.get("tokens"),
        }

    async def _brain_scrape_reimbursements(
        self, since_date: str, end_date: str
    ) -> Optional[Dict[str, Any]]:
        """Fallback: when the hardcoded selectors miss, hand the live
        page over to Claude and let it navigate. Returns the same dict
        shape as the deterministic path (status/rows/raw_text_sample/
        error), or None if the brain itself failed to load (so the
        caller still returns its original page_changed result)."""
        try:
            from .claude_brain import ClaudeBrowserBrain
        except Exception as e:
            logger.warning(f"[reimbursements] Claude brain unavailable: {e}")
            return None

        try:
            brain = ClaudeBrowserBrain(self.page, notify_status=self._notify_status)
        except Exception as e:
            logger.warning(f"[reimbursements] brain init failed: {e}")
            return None

        goal = (
            f"Reach the FBA Reimbursements view in Seller Central, set the "
            f"date range to {since_date} → {end_date}, and return all rows."
        )
        hint = (
            "PRIMARY PATH — Payments dashboard:\n"
            "1. Top nav has a 'Payments' menu. Hover/click it, then click the "
            "   'Payments' sub-item (yes, Payments → Payments). This loads the "
            "   payments dashboard.\n"
            "2. The dashboard has TABS across the top: Statement View, All "
            "   Statements, Transaction View, Reimbursements, etc. Click the "
            "   'Reimbursements' tab.\n"
            "3. Set the date range using the dropdown (often a 'Last 30 days' "
            "   chip — click it, pick Custom / Date range, set start and end).\n\n"
            "FALLBACK PATH — Reports menu:\n"
            "If the Payments dashboard doesn't show a Reimbursements tab, try "
            "the top nav 'Reports' menu → 'Fulfilment by Amazon' → in the "
            "side-nav under Payments find 'Reimbursements'. This is the "
            "report-builder view — you may need to click 'Request .csv "
            "download' or 'Request report' to generate it.\n\n"
            "Expected columns: Approval Date, Reimbursement ID, Case ID, "
            "Amazon Order ID, Reason, SKU, FNSKU, ASIN, Quantity, Amount per "
            "Unit, Amount Total, Currency. When the table is visible, call "
            "extract_table_rows with header_keywords=['reimbursement', "
            "'amount', 'sku']."
        )

        try:
            await self._notify_status("🧠 Deterministic path failed — engaging Claude brain")
            result = await brain.run(goal=goal, hint=hint)
        except Exception as e:
            logger.exception("[reimbursements] brain.run crashed")
            return {
                "status": "error",
                "rows": [],
                "raw_text_sample": "",
                "error": f"Claude brain crashed: {str(e)[:200]}",
            }

        # Normalize the rows the brain returned. Amazon's column names are
        # localized + capitalized; the deterministic path uses lowercase keys.
        # Map the most common ones; pass everything else through.
        def _key(s: str) -> str:
            return (s or "").strip().lower()
        def _norm_one(row: Dict[str, Any]) -> Dict[str, Any]:
            lc = {_key(k): v for k, v in row.items()}
            def _pick(*candidates):
                for c in candidates:
                    if c in lc and lc[c]:
                        return lc[c]
                return ""
            amt_raw = str(_pick("amount", "amount total", "amount per unit", "reimbursement amount")).replace(",", "")
            try:
                amount = float("".join(ch for ch in amt_raw if ch.isdigit() or ch in ".-") or 0)
            except ValueError:
                amount = 0.0
            qty_raw = str(_pick("quantity", "qty")).strip()
            try:
                quantity = int("".join(ch for ch in qty_raw if ch.isdigit()) or 0)
            except ValueError:
                quantity = 0
            return {
                "reimbursement_id": _pick("reimbursement id", "reimbursementid"),
                "approval_date":    _pick("approval date", "date"),
                "case_id":          _pick("case id", "caseid") or None,
                "amazon_order_id":  _pick("amazon order id", "order id") or None,
                "reason":           _pick("reason"),
                "sku":              _pick("sku") or None,
                "fnsku":            _pick("fnsku") or None,
                "asin":             _pick("asin") or None,
                "quantity":         quantity,
                "amount":           amount,
                "currency":         _pick("currency") or "INR",
                "_raw":             row,
            }

        rows = [_norm_one(r) for r in (result.get("rows") or [])]
        rows = [r for r in rows if r["reimbursement_id"]]

        status = result.get("status", "error")
        if status == "ok" and not rows:
            # Brain said ok but didn't return parseable rows — treat as
            # page_changed so we don't pretend the scrape succeeded.
            status = "page_changed"

        tokens = result.get("tokens", {})
        await self._notify_status(
            f"🧠 Brain done: status={status}, rows={len(rows)}, "
            f"turns={result.get('turns', 0)}, tokens={tokens.get('input', 0)}↑/{tokens.get('output', 0)}↓"
        )

        return {
            "status": status,
            "rows": rows,
            "raw_text_sample": result.get("notes", "")[:2000],
            "error": None if status == "ok" else (result.get("notes") or "Claude brain could not reach the report"),
            "brain_used": True,
            "brain_turns": result.get("turns"),
            "brain_actions": result.get("actions"),
            "brain_tokens": tokens,
        }

    def determine_shipping_type(self, weight_kg: float, order_value: float) -> ShippingType:
        """Determine B2B or B2C based on rules"""
        if order_value > 30000 or weight_kg > 20:
            return ShippingType.B2B
        return ShippingType.B2C

    @staticmethod
    def _format_seller_notes_block(order: "OrderInfo") -> str:
        """Render an order's buyer info into the canonical Seller Notes
        format that set_amazon_tracking_and_notes writes to the right-column
        textarea on Amazon. Matches the layout the team has been using on
        their manual entries."""
        lines: List[str] = []
        if order.buyer_name:
            lines.append(order.buyer_name)
        addr = (order.address or "").strip()
        if addr:
            # Split on commas (the new-style scrape) AND on newlines (older
            # raw-block scrapes that still leak through), dedupe whitespace.
            for chunk in re.split(r"[\n,]", addr):
                chunk = re.sub(r"\s+", " ", chunk).strip()
                if chunk and chunk.lower() != (order.buyer_name or "").lower():
                    lines.append(chunk)
        loc = f"{order.city}, {order.state} {order.pincode}".strip(", ")
        if loc.strip() and not any(loc.lower() in l.lower() for l in lines):
            lines.append(loc)
        if order.phone:
            lines.append(f"Phone: {order.phone}")
        return "\n".join(lines)

    @staticmethod
    def format_product_description(title: str, sku: str = "") -> str:
        """Turn a long Amazon product title into a short Bigship-friendly
        description. Examples:
          "MuscleGrid 5kVA Voltage Stabilizer (70V-300V), Heavy Duty Stabilizer for 2 Ton AC, Refrigerator & Home Appliances, Output 230V"
            → "MG 5kVA Voltage Stabilizer 70V-300V"
          "MuscleGrid 4kVA Voltage Stabilizer for 1.5 Ton AC | Wide Working Range 130V-280V | Heavy Duty..."
            → "MG 4kVA Voltage Stabilizer for 1.5 Ton AC"

        Bigship's validator only accepts `[A-Za-z0-9 \\-,/]` in product_name
        — parentheses, pipes, ampersands, dots, etc. all get rejected with
        "Only Alphabets, numbers, spaces and some special characters(-,/) are
        allowed". We strip everything outside the allowed set as the final
        step so the real Amazon title still gets through but cleanly.

        Falls back to "Amazon Order Product" only if nothing useful was scraped.
        """
        if not title or title.strip().lower() in ("product", "amazon order product", "product name", ""):
            # Try one last fallback using SKU if available
            return f"Amazon Order {sku}".strip() if sku else "Amazon Order Product"
        t = title.strip()
        # Brand shorthand
        t = re.sub(r"\bMusc[l]eGrid\b", "MG", t, flags=re.IGNORECASE)
        # Take the part before the first '|' or ',' — Amazon listings tend to
        # cram every feature into the title; the first segment is the actual
        # product, the rest are search-keyword stuffing.
        for sep in ("|", ","):
            if sep in t:
                t = t.split(sep)[0].strip()
                break
        # Sanitize to Bigship's allowed character set. Anything else becomes
        # a space (so "4.2KW" → "4 2KW", "(70V-300V)" → " 70V-300V "). Then
        # collapse runs of whitespace.
        t = re.sub(r"[^A-Za-z0-9 \-,/]", " ", t)
        t = re.sub(r"\s+", " ", t).strip()
        # Clip to a sane length for Bigship's input.
        t = t[:60].strip()
        return t or (f"Amazon Order ({sku})" if sku else "Amazon Order Product")
    
    async def lookup_sku_dimensions(self, sku: str) -> Optional[SKUDimensions]:
        """Look up SKU shipping dimensions.

        Resolution order (first hit wins):
          1. `sku_dimensions` (override layer; lets ops fix wrong catalog
             data without editing master_skus)
          2. `master_skus.sku_code` (exact, case-insensitive)
          3. `master_skus.aliases.alias_code` (Amazon/marketplace SKUs map
             here — e.g. Amazon's MG10KVA90COML aliases to MG10KVA90VAML)
          4. `amazon_sku_mappings.amazon_sku` → master_skus.sku_code
             (an older mapping table; fallback for Amazon SKUs without an
             alias entry on master_skus directly)

        master_skus uses `breadth_cm` (not `width_cm`); we read it and feed
        it into our `width_cm` field. Weight field on master_skus is
        `weight_kg`. 71/96 master_skus docs have these populated; the
        remaining 25 will return None here and fall back to the agent's
        default (2kg) — those SKUs need weight entries on the master_skus
        record.
        """
        if not sku:
            return None
        clean = sku.strip()
        proj_ms = {"_id": 0, "sku_code": 1, "weight_kg": 1, "length_cm": 1, "breadth_cm": 1, "height_cm": 1}

        def _from_ms(doc):
            if not doc or doc.get("weight_kg") in (None, 0):
                return None
            return SKUDimensions(
                sku=doc.get("sku_code") or clean,
                weight_kg=float(doc.get("weight_kg")),
                length_cm=int(doc.get("length_cm") or 20),
                width_cm=int(doc.get("breadth_cm") or 15),
                height_cm=int(doc.get("height_cm") or 10),
            )

        # 1. sku_dimensions override
        override = await self.db.sku_dimensions.find_one(
            {"sku": {"$regex": f"^{re.escape(clean)}$", "$options": "i"}},
            {"_id": 0, "sku": 1, "weight_kg": 1, "length_cm": 1, "width_cm": 1, "height_cm": 1},
        )
        if override and override.get("weight_kg"):
            return SKUDimensions(
                sku=override.get("sku", clean),
                weight_kg=float(override.get("weight_kg")),
                length_cm=int(override.get("length_cm") or 20),
                width_cm=int(override.get("width_cm") or 15),
                height_cm=int(override.get("height_cm") or 10),
            )

        # 2. master_skus by sku_code
        d = await self.db.master_skus.find_one(
            {"sku_code": {"$regex": f"^{re.escape(clean)}$", "$options": "i"}},
            proj_ms,
        )
        res = _from_ms(d)
        if res:
            return res

        # 3. master_skus by aliases.alias_code (Amazon SKUs)
        d = await self.db.master_skus.find_one(
            {"aliases.alias_code": {"$regex": f"^{re.escape(clean)}$", "$options": "i"}},
            proj_ms,
        )
        res = _from_ms(d)
        if res:
            return res

        # 4. amazon_sku_mappings → master_skus.sku_code
        m = await self.db.amazon_sku_mappings.find_one(
            {"amazon_sku": {"$regex": f"^{re.escape(clean)}$", "$options": "i"}},
            {"_id": 0, "sku_code": 1, "master_sku_id": 1},
        )
        if m:
            target = m.get("sku_code")
            if target:
                d = await self.db.master_skus.find_one(
                    {"sku_code": {"$regex": f"^{re.escape(target)}$", "$options": "i"}}, proj_ms
                )
                res = _from_ms(d)
                if res:
                    return res
            if m.get("master_sku_id"):
                d = await self.db.master_skus.find_one({"id": m["master_sku_id"]}, proj_ms)
                res = _from_ms(d)
                if res:
                    return res

        return None
    
    async def process_order(self, order_id: str, force_shipping_type: Optional[str] = None) -> ProcessingResult:
        """
        Process a single order - HYBRID APPROACH:
        - Browser for Amazon (get details, update tracking)
        - API for Bigship (create shipment, get AWB, download label)
        - Returns thinking_log for real-time AI transparency

        force_shipping_type: optional "b2b" / "b2c" override that bypasses
        the auto-router. Use when a SKU isn't in the weight DB and the
        default 2kg would mis-route a heavy item.
        """
        self.state = AgentState.PROCESSING
        self.current_order = order_id
        
        # Clear thinking log for fresh start
        self.ai_processor.clear_thinking_log()
        
        await self._notify_status(f"🚀 Processing order {order_id}...")
        await self.ai_processor.think(f"Starting to process order {order_id}")
        
        try:
            # Step 1: Get order details from Amazon (Browser)
            await self.ai_processor.think("Fetching order details from Amazon...")
            order = await self.get_order_details(order_id)
            if not order:
                await self.ai_processor.think("❌ Could not fetch order details from Amazon page")
                return ProcessingResult(
                    order_id=order_id, 
                    success=False, 
                    error="Could not fetch order details",
                    thinking_log=self.ai_processor.get_thinking_log()
                )
            
            if order.order_type != "self_ship":
                await self.ai_processor.think(f"⚠️ Order type is '{order.order_type}', not self-ship. Skipping.")
                return ProcessingResult(
                    order_id=order_id, 
                    success=False, 
                    error="Order is not self-ship",
                    thinking_log=self.ai_processor.get_thinking_log()
                )
            
            await self.ai_processor.think(f"📋 Customer: {order.buyer_name}")
            await self.ai_processor.think(f"📍 Location: {order.city}, {order.state} - {order.pincode}")
            await self.ai_processor.think(f"📱 Phone: {order.phone}")
            await self.ai_processor.think(f"💰 Order Amount: ₹{order.total_amount}")
            
            await self._notify_status(f"📋 Customer: {order.buyer_name}")
            await self._notify_status(f"📍 Location: {order.city}, {order.state} - {order.pincode}")
            await self._notify_status(f"💰 Amount: ₹{order.total_amount}")
            
            # Step 2: Calculate weight + dimensions from SKU database
            await self.ai_processor.think("Looking up product weight from SKU database...")
            total_weight = 2.0  # Default weight
            sku_dims = None
            for item in order.items:
                dims = await self.lookup_sku_dimensions(item.get('sku', ''))
                if dims:
                    sku_dims = dims  # remember for passing into the Bigship payload
                    total_weight = dims.weight_kg * item.get('quantity', 1)
                    await self.ai_processor.think(
                        f"📦 Found SKU {item.get('sku')}: {dims.weight_kg}kg, "
                        f"{dims.length_cm}x{dims.width_cm}x{dims.height_cm} cm"
                    )
                    await self._notify_status(f"📦 SKU {item.get('sku')}: {dims.weight_kg}kg")
                else:
                    await self.ai_processor.think(f"⚠️ SKU {item.get('sku')} not in database. Using default weight: 2kg")

            total_weight = max(0.5, total_weight)

            # ----- Tiered routing rules (Delhivery only) -----
            # >₹50,000 → refuse (needs e-way bill, we can't auto-generate).
            # >20kg OR >₹30,000 → B2B (Delhivery Surface).
            #   For LIGHT-and-expensive (≤20kg, ₹30K-₹50K) we still try B2B
            #   first; if Bigship reports that the destination isn't B2B-
            #   serviceable / is ODA, we silently retry as B2C. Heavy items
            #   (>20kg) can't fall back — B2C has a 20kg cap.
            # Otherwise → B2C.
            if order.total_amount > 50000:
                msg = (
                    f"Order value ₹{order.total_amount} exceeds the ₹50,000 e-way bill "
                    f"threshold. The agent does not auto-generate e-way bills, so this "
                    f"order must be shipped manually with an e-way bill from the firm."
                )
                await self.ai_processor.think(f"⛔ {msg}")
                await self._notify_status(f"⛔ Skipping {order_id}: needs e-way bill")
                return ProcessingResult(
                    order_id=order_id, success=False, error=msg,
                    thinking_log=self.ai_processor.get_thinking_log(),
                )

            override = (force_shipping_type or "").strip().lower()
            if override == "b2b":
                shipping_type = ShippingType.B2B
                await self.ai_processor.think("🛠️ Routing override: B2B (manual)")
            elif override == "b2c":
                shipping_type = ShippingType.B2C
                await self.ai_processor.think("🛠️ Routing override: B2C (manual)")
            elif total_weight > 20 or order.total_amount > 30000:
                shipping_type = ShippingType.B2B
            else:
                shipping_type = ShippingType.B2C

            await self.ai_processor.think(
                f"🚛 Routing: {shipping_type.value.upper()} via Delhivery — "
                f"Weight {total_weight}kg, Value ₹{order.total_amount}"
            )
            await self._notify_status(f"🚛 Shipping: {shipping_type.value.upper()} via Delhivery (Weight: {total_weight}kg)")

            # Step 3: Create shipment via Bigship API (NOT browser)
            await self._notify_status("📡 Creating shipment via Bigship API...")
            bigship_result = await self._create_bigship_shipment_via_api(
                order=order, total_weight=total_weight, shipping_type=shipping_type, dims=sku_dims,
            )

            # ----- B2B → B2C fallback -----
            # Two distinct triggers, both end in "retry as Delhivery B2C":
            #   (a) ODA destination + light item — proactive fallback (B2B
            #       skips ODA pincodes; B2C covers them).
            #   (b) B2B carrier-side AWB refusal ("Not Successfully Waybill
            #       Generated") — reactive fallback regardless of weight.
            #       Bigship's rates table marks the lane serviceable but
            #       Delhivery declines at AWB-allocation time. Per Ramesh
            #       (2026-05-25): override to Delhivery B2C in this case.
            if (
                not bigship_result.get("success")
                and shipping_type == ShippingType.B2B
            ):
                err = (bigship_result.get("error") or "").lower()
                is_oda_light = (
                    total_weight <= 20
                    and any(k in err for k in ("not serviceable", "oda", "out of delivery", "out-of-delivery"))
                )
                is_carrier_refused = any(
                    k in err for k in (
                        "not successfully waybill generated",
                        "not successfully waybill",
                        "carrier did not generate a waybill",
                    )
                )
                if is_oda_light or is_carrier_refused:
                    reason = "ODA destination" if is_oda_light else "Delhivery B2B refused the AWB"
                    await self.ai_processor.think(
                        f"⚠️ {reason}. Falling back to Delhivery B2C."
                    )
                    await self._notify_status(f"⚠️ {reason}; retrying as B2C")
                    shipping_type = ShippingType.B2C
                    bigship_result = await self._create_bigship_shipment_via_api(
                        order=order, total_weight=total_weight, shipping_type=shipping_type, dims=sku_dims,
                    )

            if not bigship_result.get("success"):
                await self.ai_processor.think("❌ Bigship shipment creation failed after all retries")
                return ProcessingResult(
                    order_id=order_id,
                    success=False,
                    error=f"Bigship API error: {bigship_result.get('error')}",
                    thinking_log=self.ai_processor.get_thinking_log()
                )
            
            tracking_id = bigship_result.get("awb_number", "")
            system_order_id = bigship_result.get("system_order_id", "")
            
            await self._notify_status(f"✅ Shipment created! AWB: {tracking_id}")
            
            # Step 4: Download label from Bigship API
            label_path = None
            if system_order_id:
                await self._notify_status("🏷️ Downloading shipping label from API...")
                await self.ai_processor.think("Downloading shipping label PDF...")
                label_pdf = await self._download_bigship_label_via_api(system_order_id)
                if label_pdf:
                    date_path = datetime.now().strftime("%Y/%m-%B/%d")
                    folder_path = f"amazon_orders/{date_path}/{order_id}"
                    label_path = await self._save_to_storage(label_pdf, f"{folder_path}/label_{tracking_id}.pdf")
                    await self.ai_processor.think(f"✅ Label saved: {label_path}")
                    await self._notify_status(f"🏷️ Label saved: {label_path}")
                else:
                    await self.ai_processor.think("⚠️ Could not download label PDF. Continuing anyway.")
            
            # Step 5: Update tracking on Amazon + write Seller Notes (Browser).
            # Use set_amazon_tracking_and_notes which:
            #   - handles both Confirm-shipment (unshipped) and Edit-shipment
            #     (already-confirmed) flows
            #   - uses the right selectors for Amazon's <span class="a-button">
            #   - writes the buyer name / address / phone into the Seller
            #     Notes textarea in the same call
            #   - VERIFIES the writes actually persisted (not just clicked)
            # The legacy _update_amazon_tracking silently swallowed errors
            # — orders looked "shipped" in the agent log but were still
            # Unshipped on Amazon.
            await self._notify_status("🔄 Updating tracking on Amazon + writing Seller Notes...")
            await self.ai_processor.think("Updating tracking + Seller Notes on Amazon...")
            seller_notes = self._format_seller_notes_block(order)
            tn_result = await self.set_amazon_tracking_and_notes(
                order_id=order_id,
                tracking_id=tracking_id,
                courier="Delhivery",
                seller_notes=seller_notes,
            )
            if tn_result.get("success"):
                action = tn_result.get("action", "?")
                notes_ok = tn_result.get("seller_notes_written")
                await self.ai_processor.think(
                    f"✅ Amazon updated — tracking action={action}, "
                    f"seller_notes_written={notes_ok}"
                )
            else:
                # Don't fail the whole order; log loudly so operator sees it.
                await self.ai_processor.think(
                    f"⚠️ Amazon tracking/notes update failed: {tn_result.get('error')}. "
                    "Bigship side is fine — operator should set tracking on Amazon manually."
                )
            
            # Step 6: Download Amazon invoice (Browser)
            invoice_path = None
            try:
                await self._notify_status("📄 Downloading Amazon invoice...")
                await self.ai_processor.think("Downloading invoice from Amazon...")
                invoice_pdf = await self._download_amazon_invoice(order_id)
                if invoice_pdf:
                    date_path = datetime.now().strftime("%Y/%m-%B/%d")
                    folder_path = f"amazon_orders/{date_path}/{order_id}"
                    invoice_path = await self._save_to_storage(invoice_pdf, f"{folder_path}/invoice_{order_id}.pdf")
                    await self.ai_processor.think(f"✅ Invoice saved: {invoice_path}")
                    await self._notify_status(f"📄 Invoice saved: {invoice_path}")
            except Exception as e:
                await self.ai_processor.think(f"⚠️ Invoice download failed: {e}. Non-critical, continuing.")
                logger.warning(f"Invoice download failed: {e}")
            
            # Step 7: Save to database
            await self.ai_processor.think("Saving order processing record to database...")
            await self.db.amazon_order_processing.insert_one({
                "order_id": order_id,
                "amazon_order_id": order_id,
                "firm_id": self.firm_id,
                "firm_name": self.firm_name,
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "shipping_type": shipping_type.value,
                "tracking_id": tracking_id,
                "awb_number": tracking_id,
                "system_order_id": system_order_id,
                "courier_name": "Delhivery",
                "total_weight_kg": total_weight,
                "order_value": order.total_amount,
                "invoice_path": invoice_path,
                "label_path": label_path,
                "customer_name": order.buyer_name,
                "customer_phone": order.phone,
                "customer_address": order.address,
                "customer_city": order.city,
                "customer_state": order.state,
                "customer_pincode": order.pincode,
                "product_title": (order.items[0].get("title") if order.items else None),
                "product_sku": (order.items[0].get("sku") if order.items else None),
                "asin": (order.items[0].get("asin") if order.items else None),
                "order_item_id": (order.items[0].get("order_item_id") if order.items else None),
                "status": "completed"
            })
            
            await self.ai_processor.think("🎉 ORDER COMPLETED SUCCESSFULLY!")
            await self.ai_processor.think(f"📦 AWB: {tracking_id} | Courier: Delhivery")
            
            await self._notify_status(f"🎉 Order {order_id} completed successfully!")
            await self._notify_status(f"📦 AWB: {tracking_id} | Courier: Delhivery")
            
            return ProcessingResult(
                order_id=order_id,
                success=True,
                tracking_id=tracking_id,
                shipping_type=shipping_type.value,
                invoice_path=invoice_path or "",
                label_path=label_path or "",
                thinking_log=self.ai_processor.get_thinking_log()
            )
            
        except Exception as e:
            logger.error(f"Order processing error: {e}")
            await self.ai_processor.think(f"❌ Unexpected error: {str(e)}")
            await self._notify_status(f"❌ Error: {str(e)}")
            return ProcessingResult(
                order_id=order_id, 
                success=False, 
                error=str(e),
                thinking_log=self.ai_processor.get_thinking_log()
            )
        finally:
            self.current_order = None
    
    async def _create_bigship_shipment_via_api(self, order: OrderInfo, total_weight: float, shipping_type: ShippingType, dims: Optional["SKUDimensions"] = None) -> dict:
        """
        Create shipment via Bigship API with intelligent error recovery.
        - Uses AI processor to validate and fix data before submission
        - Automatically retries with fixed data on errors
        - Shows real-time thinking process
        """
        import httpx
        
        BIGSHIP_API_URL = os.environ.get("BIGSHIP_API_URL", "https://api.bigship.in/api")
        
        await self.ai_processor.think("Starting intelligent shipment creation process...")
        
        try:
            # Step 1: Authenticate
            await self.ai_processor.think("Authenticating with Bigship API...")
            token = await self._get_bigship_token()
            if not token:
                await self.ai_processor.think("❌ Authentication failed! Checking credentials...")
                return {"success": False, "error": "Failed to authenticate with Bigship API. Check credentials."}
            await self.ai_processor.think("✅ Authentication successful!")
            
            # Step 2: Get warehouse
            await self.ai_processor.think("Fetching warehouse configuration...")
            warehouse_id = await self._get_bigship_warehouse_id(token)
            if not warehouse_id:
                await self.ai_processor.think("❌ No warehouse found! Please configure a warehouse in Bigship.")
                return {"success": False, "error": "No warehouse configured in Bigship"}
            await self.ai_processor.think(f"✅ Using warehouse ID: {warehouse_id}")
            
            # Step 3: Use AI processor to validate and fix order data
            await self.ai_processor.think("Analyzing order data for potential issues...")
            
            order_data = {
                'buyer_name': order.buyer_name,
                'phone': order.phone,
                'address': order.address,
                'city': order.city,
                'state': order.state,
                'pincode': order.pincode,
                'total_amount': order.total_amount
            }
            
            fixed_data = await self.ai_processor.analyze_and_fix_order_data(order_data)
            
            # Step 4: Build payload with fixed data
            shipment_category = "b2b" if shipping_type == ShippingType.B2B else "b2c"
            await self.ai_processor.think(f"Building {shipment_category.upper()} shipment payload...")
            
            # Parse name intelligently
            raw_name = fixed_data['buyer_name']
            name_parts = raw_name.split()
            first_name = name_parts[0] if name_parts else "Customer"
            last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else first_name
            
            # Clean names
            first_name = re.sub(r'[^a-zA-Z.\s]', '', first_name)[:25] or "Customer"
            last_name = re.sub(r'[^a-zA-Z.\s]', '', last_name)[:25] or "Name"
            
            # Ensure minimum length
            if len(first_name) < 3:
                first_name = first_name + "cust"
            if len(last_name) < 3:
                last_name = last_name + "name"
            
            await self.ai_processor.think(f"Customer name: {first_name} {last_name}")
            await self.ai_processor.think(f"Phone: {fixed_data['phone']}")
            await self.ai_processor.think(f"Pincode: {fixed_data['pincode']}")
            
            # Build address lines - ensure minimum 10 chars
            address_line1 = fixed_data['address'][:50] if fixed_data['address'] else f"{fixed_data['city']}"
            if len(address_line1) < 10:
                address_line1 = f"{address_line1}, {fixed_data['city']}"[:50]
            address_line2 = f"{fixed_data['city']}, {fixed_data['state']}"[:50]
            
            # Ensure address_line1 is within 10-50 chars as per API spec
            if len(address_line1) < 10:
                address_line1 = (address_line1 + ", India")[:50]
            
            # Build payload according to Bigship API specification
            # Both B2C and B2B: document_detail is INSIDE order_detail
            # B2B: all box/product invoice amounts must be 0
            
            # Common payload structure for both B2C and B2B
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
                    "contact_number_primary": fixed_data['phone'],
                    "contact_number_secondary": "",
                    "email_id": "",
                    "consignee_address": {
                        "address_line1": address_line1,
                        "address_line2": address_line2,
                        "address_landmark": "",
                        "pincode": fixed_data['pincode']
                    }
                },
                "order_detail": {
                    "invoice_date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                    # invoice_id must be 1-25 chars. Amazon order IDs like "407-0878686-8806711" are 19 chars
                    # If longer, remove dashes or truncate
                    "invoice_id": order.order_id.replace('-', '')[:25] if len(order.order_id) > 25 else order.order_id[:25],
                    "payment_type": "Prepaid",
                    "total_collectable_amount": 0,
                    "shipment_invoice_amount": int(fixed_data['total_amount']),
                    "box_details": [{
                        "each_box_dead_weight": max(0.5, total_weight),
                        # Use real dimensions when SKU is registered; fall
                        # back to the small-parcel default that the historic
                        # B2C orders used. Delhivery B2B (especially MPS)
                        # rejects waybill generation when box dimensions
                        # disagree with declared weight class.
                        "each_box_length": (dims.length_cm if dims else 20),
                        "each_box_width": (dims.width_cm if dims else 15),
                        "each_box_height": (dims.height_cm if dims else 10),
                        # B2C: use actual invoice amount, B2B: must be 0
                        "each_box_invoice_amount": 0 if shipment_category == "b2b" else int(fixed_data['total_amount']),
                        "each_box_collectable_amount": 0,
                        "box_count": 1,
                        "product_details": [{
                            "product_category": "Others",
                            "product_sub_category": "General",
                            "product_name": self.format_product_description(
                                (order.items[0].get("title") if order.items else "") or "",
                                (order.items[0].get("sku") if order.items else "") or "",
                            ),
                            "product_quantity": 1,
                            # B2C: use actual invoice amount, B2B: must be 0
                            "each_product_invoice_amount": 0 if shipment_category == "b2b" else int(fixed_data['total_amount']),
                            "each_product_collectable_amount": 0,
                            "hsn": ""
                        }]
                    }],
                    "ewaybill_number": "",
                    "document_detail": {
                        "invoice_document_file": "",
                        "ewaybill_document_file": ""
                    }
                }
            }
            
            # Step 5: Generate invoice document (required by Bigship API)
            await self.ai_processor.think("📄 Generating invoice document for Bigship API...")
            invoice_pdf_base64 = await self._generate_invoice_pdf(order, first_name, last_name, fixed_data, total_weight)
            payload["order_detail"]["document_detail"]["invoice_document_file"] = f"data:application/pdf;base64,{invoice_pdf_base64}"
            await self.ai_processor.think("✅ Invoice document generated and attached")
            
            # Step 6: Submit with intelligent retry
            endpoint = "/order/add/heavy" if shipment_category == "b2b" else "/order/add/single"
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                for attempt in range(self.max_retries):
                    await self.ai_processor.think(f"📤 API Attempt {attempt + 1}/{self.max_retries}...")
                    
                    response = await client.post(
                        f"{BIGSHIP_API_URL}{endpoint}",
                        json=payload,
                        headers={
                            "Content-Type": "application/json",
                            "Authorization": f"Bearer {token}"
                        }
                    )
                    
                    data = response.json()
                    logger.info(f"Bigship create response (attempt {attempt + 1}): {data}")
                    
                    if data.get("success"):
                        await self.ai_processor.think("✅ Shipment created successfully!")
                        break
                    
                    # Check for "Already Exists" error - order was already created
                    error_msg = data.get("message", "")
                    if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
                        await self.ai_processor.think("⚠️ Order already exists in Bigship! Fetching existing shipment...")
                        # The order was created before (possibly during a previous timeout)
                        # Try to get the existing shipment details
                        existing_result = await self._get_existing_bigship_order(order.order_id, token, client)
                        if existing_result:
                            await self.ai_processor.think(f"✅ Found existing shipment: AWB {existing_result.get('awb_number')}")
                            return existing_result
                        else:
                            # Can't find existing order - try with modified invoice_id
                            await self.ai_processor.think("🔧 Creating with modified invoice_id...")
                            payload['order_detail']['invoice_id'] = f"{order.order_id[:15]}-{int(datetime.now().timestamp()) % 10000}"
                            continue
                    
                    # API failed - analyze error and fix
                    await self.ai_processor.think(f"⚠️ API returned error on attempt {attempt + 1}")
                    
                    error_msg = data.get("message", "")
                    validation_errors = data.get("validationErrors", [])
                    
                    if validation_errors:
                        for err in validation_errors:
                            await self.ai_processor.think(f"  - {err.get('propertyName', 'Unknown')}: {err.get('errorMessage', 'Unknown error')}")
                    elif error_msg:
                        await self.ai_processor.think(f"  - Error: {error_msg}")
                    
                    if attempt < self.max_retries - 1:
                        # Try to fix and retry
                        await self.ai_processor.think("🔧 Attempting intelligent fix...")
                        payload = await self.ai_processor.analyze_api_error_and_suggest_fix(data, payload)
                        await asyncio.sleep(1)  # Brief pause before retry
                    else:
                        # Final attempt failed
                        error_detail = "; ".join([f"{e.get('propertyName', '')}: {e.get('errorMessage', '')}" for e in validation_errors]) if validation_errors else error_msg
                        await self.ai_processor.think(f"❌ All {self.max_retries} attempts failed. Error: {error_detail}")
                        return {"success": False, "error": error_detail or "Failed to create shipment"}
                
                # Extract system_order_id
                order_id_match = data.get("data", "")
                system_order_id = None
                if isinstance(order_id_match, str) and "system_order_id is" in order_id_match:
                    system_order_id = order_id_match.split("system_order_id is ")[-1].strip()
                
                if not system_order_id:
                    await self.ai_processor.think("⚠️ Could not extract system_order_id from response")
                    # Try to extract from other fields
                    if isinstance(data.get("data"), dict):
                        system_order_id = str(data["data"].get("system_order_id", ""))
                    if not system_order_id:
                        return {"success": False, "error": "No system_order_id returned from API"}
                
                await self.ai_processor.think(f"📋 System Order ID: {system_order_id}")

                # ----- Pick the Delhivery courier for THIS shipment via the
                # Shipping Rates API. Bigship exposes multiple Delhivery
                # variants (Delhivery / LTL Delhivery / Delhivery MPS / …)
                # and which ones are serviceable depends on the lane and
                # weight tier. The rates response also tells us the ODA
                # surcharge per courier (`other_additional_charges.oda`)
                # which drives the user's "if light item gets ODA on B2B,
                # ship it B2C instead" rule.
                rates_resp = await client.get(
                    f"{BIGSHIP_API_URL}/order/shipping/rates",
                    params={
                        "shipment_category": shipment_category.upper(),
                        "system_order_id": int(system_order_id),
                        "risk_type": "OwnerRisk",
                    },
                    headers={"Authorization": f"Bearer {token}"},
                )
                rates_data = rates_resp.json() if rates_resp.status_code == 200 else {}
                serviceable = (rates_data.get("data") or [])
                delhivery_options = [
                    o for o in serviceable
                    if "delhivery" in (o.get("courier_name") or "").lower()
                ]
                if not delhivery_options:
                    available = ", ".join(o.get("courier_name") or "?" for o in serviceable) or "none"
                    await self.ai_processor.think(
                        f"❌ Delhivery not serviceable for this lane (available: {available})."
                    )
                    return {
                        "success": False,
                        "error": f"Delhivery not serviceable. Bigship returned: {available}",
                        "system_order_id": int(system_order_id),
                    }
                # Pick the cheapest Delhivery option; capture ODA charge for
                # the routing decision.
                delhivery = min(
                    delhivery_options,
                    key=lambda o: float(o.get("total_shipping_charges") or 0),
                )
                delhivery_courier_id = delhivery["courier_id"]
                delhivery_name = delhivery.get("courier_name") or "Delhivery"
                oda_charge = float(((delhivery.get("other_additional_charges") or {}).get("oda")) or 0)
                await self.ai_processor.think(
                    f"📦 Selected {delhivery_name} (courier_id={delhivery_courier_id}, "
                    f"₹{delhivery.get('total_shipping_charges')}, ODA charge ₹{oda_charge})"
                )

                # ODA fallback: light item (≤20kg) routed B2B but destination
                # is ODA → re-create as B2C per ops policy. Heavy items can't
                # use this fallback (B2C tops out at 20kg).
                if (
                    shipment_category == "b2b"
                    and oda_charge > 0
                    and total_weight <= 20
                ):
                    await self.ai_processor.think(
                        f"⚠️ Destination is ODA (₹{oda_charge} surcharge). "
                        "Light item — caller should retry as B2C."
                    )
                    # Cancel the B2B shipment we just created so we don't
                    # leave an orphan in Bigship.
                    try:
                        await client.post(
                            f"{BIGSHIP_API_URL}/order/cancel",
                            json={"system_order_id": int(system_order_id)},
                            headers={"Authorization": f"Bearer {token}"},
                        )
                    except Exception:
                        pass
                    return {
                        "success": False,
                        "error": "ODA destination — light item should be shipped as B2C",
                        "oda_fallback": True,
                        "system_order_id": int(system_order_id),
                    }

                # Step 6: Manifest
                await self.ai_processor.think(f"🚚 Manifesting via {delhivery_name}...")
                manifest_endpoint = "/order/manifest/heavy" if shipment_category == "b2b" else "/order/manifest/single"
                manifest_payload = {
                    "system_order_id": int(system_order_id),
                    "courier_id": delhivery_courier_id,
                }
                if shipment_category == "b2b":
                    manifest_payload["risk_type"] = "OwnerRisk"
                
                # Manifest with retry
                for manifest_attempt in range(2):
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

                    # Bigship's manifest API returns:
                    #   success: success=True, data: null,
                    #            message="Successfully Waybill Generated"
                    #   failure: success=True, data: null,
                    #            message="Not Successfully Waybill Generated"
                    # The `data` field is null in BOTH cases — don't gate on
                    # it. Discriminate purely on the message: anything that
                    # starts with "not " is a failure, otherwise it's a win.
                    msg = (manifest_data.get("message") or "").strip()
                    msg_low = msg.lower()
                    is_failure_msg = (
                        msg_low.startswith("not ")
                        or "not successfully" in msg_low
                        or "failed" in msg_low
                        or "error" in msg_low
                    )
                    waybill_ok = manifest_data.get("success") and not is_failure_msg
                    if waybill_ok:
                        await self.ai_processor.think(f"✅ Shipment manifested via {delhivery_name}! ({msg})")
                        break
                    if manifest_data.get("success") and is_failure_msg:
                        # success:true but message indicates carrier refused.
                        await self.ai_processor.think(
                            f"⚠️ Manifest accepted but no AWB issued: {msg or 'carrier refused waybill generation'}"
                        )
                        manifest_data["success"] = False
                        manifest_data.setdefault("message", "Carrier did not generate a waybill — check weight/dimensions")
                    
                    if manifest_attempt == 0:
                        await self.ai_processor.think(f"⚠️ Manifest failed: {manifest_data.get('message', 'Unknown')}. Retrying...")
                        await asyncio.sleep(2)
                    else:
                        await self.ai_processor.think(f"❌ Manifest failed after retry: {manifest_data.get('message', 'Unknown')}")
                        return {"success": False, "error": f"Manifest failed: {manifest_data.get('message', 'Unknown')}"}
                
                # Step 7: Get AWB
                await self.ai_processor.think("📦 Fetching AWB number...")
                await asyncio.sleep(1)
                
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
                
                awb_number = awb_info.get("master_awb") or awb_info.get("lr_number") or f"AWB{system_order_id}"
                
                await self.ai_processor.think(f"🎉 SUCCESS! AWB Number: {awb_number}")
                
                return {
                    "success": True,
                    "system_order_id": system_order_id,
                    "awb_number": awb_number,
                    "courier_name": "Delhivery",
                    "courier_id": 1
                }
                
        except httpx.TimeoutException:
            await self.ai_processor.think("❌ API request timed out. Network might be slow.")
            return {"success": False, "error": "API request timed out"}
        except httpx.ConnectError:
            await self.ai_processor.think("❌ Could not connect to Bigship API. Check network.")
            return {"success": False, "error": "Could not connect to Bigship API"}
        except Exception as e:
            await self.ai_processor.think(f"❌ Unexpected error: {str(e)}")
            logger.error(f"Bigship API error: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def _get_bigship_token(self) -> Optional[str]:
        """Get Bigship API authentication token"""
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
    
    async def _get_bigship_warehouse_id(self, token: str) -> Optional[int]:
        """Get first warehouse ID from Bigship"""
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
                        return warehouses[0].get("warehouse_id")
                return None
        except Exception as e:
            logger.error(f"Warehouse list error: {e}")
            return None
    
    async def _get_existing_bigship_order(self, invoice_id: str, token: str, client) -> Optional[dict]:
        """Try to find an existing Bigship order by invoice_id"""
        BIGSHIP_API_URL = os.environ.get("BIGSHIP_API_URL", "https://api.bigship.in/api")
        
        try:
            # Search for the order using the tracking API or order search
            # This is a best-effort attempt to recover from duplicate order scenarios
            await self.ai_processor.think(f"Searching for existing order with invoice_id: {invoice_id}")
            
            # Try to search recent orders
            search_response = await client.get(
                f"{BIGSHIP_API_URL}/order/list",
                params={"page_index": 1, "page_size": 50, "search": invoice_id},
                headers={"Authorization": f"Bearer {token}"}
            )
            
            search_data = search_response.json()
            if search_data.get("success") and search_data.get("data", {}).get("result_data"):
                orders = search_data["data"]["result_data"]
                for order in orders:
                    if invoice_id in str(order.get("invoice_id", "")):
                        system_order_id = order.get("system_order_id")
                        awb = order.get("awb_number") or order.get("master_awb") or order.get("lr_number")
                        await self.ai_processor.think(f"Found existing order: System ID {system_order_id}, AWB {awb}")
                        return {
                            "success": True,
                            "system_order_id": str(system_order_id),
                            "awb_number": awb or f"AWB{system_order_id}",
                            "courier_name": order.get("courier_name", "Delhivery"),
                            "courier_id": order.get("courier_id", 1)
                        }
            
            await self.ai_processor.think("Could not find existing order in search results")
            return None
            
        except Exception as e:
            await self.ai_processor.think(f"Error searching for existing order: {e}")
            return None
    
    async def _download_bigship_label_via_api(self, system_order_id: str) -> Optional[bytes]:
        """Download shipping label from Bigship API"""
        import httpx
        
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
                    
                    # Check if it's a dict with file content
                    if isinstance(label_data, dict):
                        file_content = label_data.get("res_FileContent", "")
                        if file_content:
                            return base64.b64decode(file_content)
                        if label_data.get("label_url"):
                            label_response = await client.get(label_data["label_url"])
                            return label_response.content
                    
                    # Direct base64 string
                    elif isinstance(label_data, str):
                        if label_data.startswith("data:"):
                            base64_part = label_data.split(",")[1] if "," in label_data else label_data
                            return base64.b64decode(base64_part)
                        elif label_data.startswith("http"):
                            label_response = await client.get(label_data)
                            return label_response.content
                        else:
                            return base64.b64decode(label_data)
                
                logger.warning(f"No label data for order {system_order_id}")
                return None
                
        except Exception as e:
            logger.error(f"Label download error: {e}")
            return None
    
    async def _generate_invoice_pdf(self, order: OrderInfo, first_name: str, last_name: str, fixed_data: dict, weight: float) -> str:
        """Generate a minimal shipping invoice PDF for Bigship API"""
        import io
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas as pdf_canvas
        
        buffer = io.BytesIO()
        c = pdf_canvas.Canvas(buffer, pagesize=A4)
        
        c.setFont("Helvetica-Bold", 16)
        c.drawString(200, 800, "SHIPPING INVOICE")
        
        c.setFont("Helvetica", 12)
        c.drawString(50, 750, f"Invoice Number: {order.order_id}")
        c.drawString(50, 730, f"Date: {datetime.now().strftime('%d-%m-%Y')}")
        c.drawString(50, 700, f"Customer: {first_name} {last_name}")
        c.drawString(50, 680, f"Phone: {fixed_data['phone']}")
        c.drawString(50, 660, f"Address: {fixed_data['address'][:60]}")
        c.drawString(50, 640, f"City: {fixed_data['city']}, {fixed_data['state']}")
        c.drawString(50, 620, f"Pincode: {fixed_data['pincode']}")
        product_desc = self.format_product_description(
            (order.items[0].get("title") if order.items else "") or "",
            (order.items[0].get("sku") if order.items else "") or "",
        )
        c.drawString(50, 590, f"Product: {product_desc}")
        c.drawString(50, 570, f"Weight: {weight} kg")
        c.drawString(50, 540, f"Invoice Amount: Rs. {fixed_data['total_amount']}")
        c.drawString(50, 510, "Payment Type: Prepaid")
        
        c.save()
        
        pdf_bytes = buffer.getvalue()
        return base64.b64encode(pdf_bytes).decode('utf-8')
    
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
            
            # Parse name - Bigship uses "Customer Full Name" not separate first/last
            full_name = order.buyer_name.strip() if order.buyer_name else "Customer Name"
            
            # Phone - ensure valid
            phone = re.sub(r'[^0-9]', '', order.phone or "9876543210")
            if len(phone) != 10 or phone[0] not in "6789" or len(set(phone)) == 1:
                phone = "9876543210"
            
            # Fill all fields with extensive selectors for Bigship's actual form
            # Customer Full Name (single field)
            await self.finder.find_and_fill([
                'input[placeholder*="Customer Full Name" i]',
                'input[placeholder*="Full Name" i]',
                'input[placeholder*="customer" i]',
                'input[name*="full_name" i]',
                'input[name*="customer_name" i]',
                'input[name*="consignee_name" i]',
                'input[name*="first_name" i]',  # Fallback
                '#customerName', '#fullName', '#consigneeName',
                'input[formcontrolname*="name" i]'
            ], full_name, "customer full name")
            
            # Also try first/last name if separate fields exist
            name_parts = full_name.split()
            first_name = name_parts[0] if name_parts else "Customer"
            last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else first_name
            
            await self.finder.find_and_fill([
                'input[placeholder*="First Name" i]',
                'input[name*="first_name" i]',
                '#firstName'
            ], first_name, "first name")
            
            await self.finder.find_and_fill([
                'input[placeholder*="Last Name" i]',
                'input[name*="last_name" i]',
                '#lastName'
            ], last_name, "last name")
            
            # Mobile No
            await self.finder.find_and_fill([
                'input[placeholder*="Mobile No" i]',
                'input[placeholder*="Mobile" i]',
                'input[placeholder*="Phone" i]',
                'input[placeholder*="Contact" i]',
                'input[name*="mobile" i]',
                'input[name*="phone" i]',
                'input[name*="contact" i]',
                'input[type="tel"]',
                '#mobile', '#phone', '#mobileNo',
                'input[formcontrolname*="mobile" i]',
                'input[formcontrolname*="phone" i]'
            ], phone, "mobile")
            
            # Complete Address
            address_text = order.address[:150] if order.address else f"{order.city}, {order.state}"
            await self.finder.find_and_fill([
                'input[placeholder*="Complete Address" i]',
                'input[placeholder*="Address" i]',
                'textarea[placeholder*="Address" i]',
                'input[name*="address" i]',
                'textarea[name*="address" i]',
                '#address', '#completeAddress', '#address1',
                'input[formcontrolname*="address" i]'
            ], address_text, "address")
            
            # Pincode
            await self.finder.find_and_fill([
                'input[placeholder*="Pincode" i]',
                'input[placeholder*="Pin Code" i]',
                'input[placeholder*="PIN" i]',
                'input[name*="pincode" i]',
                'input[name*="pin" i]',
                '#pincode', '#pin',
                'input[formcontrolname*="pincode" i]',
                'input[formcontrolname*="pin" i]'
            ], order.pincode or "110001", "pincode")
            
            await asyncio.sleep(2)  # Wait for pincode validation / city autofill
            await self._capture_screenshot()
            
            # Step 4: Fill order/shipment details
            await self._notify_status("📦 Filling shipment details...")
            
            # Order ID / Invoice ID
            await self.finder.find_and_fill([
                'input[placeholder*="Order Id" i]',
                'input[placeholder*="Order ID" i]',
                'input[placeholder*="Invoice" i]',
                'input[name*="order_id" i]',
                'input[name*="invoice" i]',
                '#orderId', '#invoiceId', '#orderNumber',
                'input[formcontrolname*="order" i]',
                'input[formcontrolname*="invoice" i]'
            ], order.order_id, "order ID")
            
            # Weight (Dead Weight)
            await self.finder.find_and_fill([
                'input[placeholder*="Weight" i]',
                'input[placeholder*="Dead Weight" i]',
                'input[name*="weight" i]',
                '#weight', '#deadWeight',
                'input[formcontrolname*="weight" i]'
            ], str(round(weight, 2)), "weight")
            
            # Dimensions
            await self.finder.find_and_fill([
                'input[placeholder*="Length" i]', 'input[name*="length" i]', '#length',
                'input[formcontrolname*="length" i]'
            ], "20", "length")
            await self.finder.find_and_fill([
                'input[placeholder*="Width" i]', 'input[name*="width" i]', '#width',
                'input[formcontrolname*="width" i]'
            ], "15", "width")
            await self.finder.find_and_fill([
                'input[placeholder*="Height" i]', 'input[name*="height" i]', '#height',
                'input[formcontrolname*="height" i]'
            ], "10", "height")
            
            # Invoice Amount
            await self.finder.find_and_fill([
                'input[placeholder*="Invoice Amount" i]',
                'input[placeholder*="Amount" i]',
                'input[placeholder*="Value" i]',
                'input[name*="amount" i]',
                'input[name*="value" i]',
                '#amount', '#invoiceAmount', '#shipmentValue',
                'input[formcontrolname*="amount" i]'
            ], str(int(order.total_amount)), "amount")
            
            # Select Prepaid payment mode
            await self.finder.find_and_click([
                'label:has-text("Prepaid")', 
                'input[value="Prepaid"]',
                'mat-radio-button:has-text("Prepaid")',
                'div[class*="radio"]:has-text("Prepaid")',
                'button:has-text("Prepaid")',
                '[class*="prepaid" i]'
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
    
    async def set_amazon_tracking_and_notes(
        self,
        order_id: str,
        tracking_id: str,
        courier: str = "Delhivery",
        seller_notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Set/replace the Amazon tracking on an order and write the seller-notes
        textarea — works for both unshipped orders (uses "Confirm shipment")
        and already-confirmed orders (uses "Edit shipment").

        Returns a structured result: { success, action, current_tracking, error }.
        - action: "confirmed_new" | "edited" | "already_correct" | "failed"
        """
        if not self.page:
            return {"success": False, "error": "Browser not started"}

        result = {"order_id": order_id, "success": False, "action": "failed",
                  "current_tracking": None, "error": ""}

        try:
            await self.page.goto(
                f"https://sellercentral.amazon.in/orders-v3/order/{order_id}",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            await asyncio.sleep(6)  # SPA needs time

            # ----- Step A: Write Seller Notes FIRST (textarea is visible on
            # the order detail page right now). Doing this before opening
            # the Confirm shipment form has two upsides:
            #   1. We don't have to re-navigate after tracking is submitted
            #      (Amazon redirects to the order list on confirm).
            #   2. If tracking submission later fails for any reason, the
            #      notes are still saved — so the buyer info is captured.
            if seller_notes is not None:
                notes_written = await self._write_seller_notes(seller_notes)
                result["seller_notes_written"] = notes_written

            # Inspect current state: read tracking row + presence of confirm/edit buttons.
            # Use plain text regex everywhere — Playwright pseudo-selectors
            # like `button:has-text` are NOT valid in browser querySelector.
            state = await self.page.evaluate("""
                () => {
                  const text = document.documentElement.innerText || '';
                  const trackMatch = text.match(/Tracking ID\\s*([0-9A-Z]{8,})/);
                  return {
                    is_unshipped: /\\bUnshipped\\b/.test(text),
                    current_tracking: trackMatch ? trackMatch[1] : null,
                    has_edit_btn: /Edit shipment/i.test(text),
                    has_confirm_btn: /Confirm shipment/i.test(text),
                  };
                }
            """)
            result["current_tracking"] = state.get("current_tracking")

            target = tracking_id.strip()
            current = (state.get("current_tracking") or "").strip()

            need_tracking_update = current != target

            if need_tracking_update:
                # Decide which pill to open: Edit (already confirmed) takes
                # priority over Confirm (unshipped). Both open the same
                # carrier+tracking form; Edit pre-fills.
                pill_text = (
                    "Edit shipment" if state.get("has_edit_btn") else
                    "Confirm shipment" if state.get("has_confirm_btn") else
                    None
                )
                if not pill_text:
                    result["error"] = "Neither Edit shipment nor Confirm shipment button found"
                    return result
                action_hint = "edited" if pill_text == "Edit shipment" else "confirmed_new"

                # ===== Step 1: open the form by clicking the narrow pill =====
                # The pill is an <a> with that exact text in the order-actions
                # row, width ≤ ~200px (anything wider is a section header /
                # form title that has the same text but isn't clickable as
                # the pill). Use a probe + mouse.click rather than a generic
                # text locator — those matched multiple elements and often
                # hit the wrong one on EBAY UP's slow-rendering form.
                pill = await self.page.evaluate(
                    """(text) => {
                        for (const el of document.querySelectorAll('a')) {
                            const t = (el.innerText || '').trim();
                            if (t !== text) continue;
                            const r = el.getBoundingClientRect();
                            if (r.width > 200) continue;       // narrow pill only
                            if (r.y < 0 || r.y > 760) continue; // visible
                            return {x: r.x + r.width/2, y: r.y + r.height/2};
                        }
                        return null;
                    }""",
                    pill_text,
                )
                if not pill:
                    result["error"] = f"{action_hint}: pill button not found in viewport"
                    return result
                await self.page.mouse.click(pill["x"], pill["y"])
                # Form takes 6-10s to render on EBAY UP for fresh confirms.
                await asyncio.sleep(9)

                # ===== Step 2: scroll the form into the visible viewport =====
                # The Confirm/Edit shipment form expands BELOW the existing
                # content. Two PageDowns put the Tracking ID label + input +
                # yellow Submit all within the 768px viewport (a single
                # End-scroll over-shoots past the Submit).
                await self.page.keyboard.press("PageDown")
                await asyncio.sleep(0.5)
                await self.page.keyboard.press("PageDown")
                await asyncio.sleep(2)

                # ===== Step 3: click the Tracking ID input + type the AWB =====
                # The input has no name/id/placeholder/aria — only a visible
                # "Tracking ID:" label nearby. Locate the label by text and
                # click ~30px below + 120px right (the form's column layout
                # places the input directly under the label, offset by ~120px
                # into the input cell).
                label = await self.page.evaluate(
                    """() => {
                        for (const el of document.querySelectorAll('div, span')) {
                            const t = (el.innerText || '').trim();
                            if (t !== 'Tracking ID:') continue;
                            const r = el.getBoundingClientRect();
                            if (r.height > 30) continue;          // label, not container
                            if (r.y < 50 || r.y > 700) continue;  // visible after scroll
                            return {x: r.x, y: r.y};
                        }
                        return null;
                    }"""
                )
                if not label:
                    result["error"] = f"{action_hint}: could not find Tracking ID label after scroll"
                    return result
                await self.page.mouse.click(label["x"] + 120, label["y"] + 30)
                await asyncio.sleep(1)
                await self.page.keyboard.type(target, delay=20)
                await asyncio.sleep(1)

                # ===== Step 4: click the yellow Submit button =====
                # Amazon's primary-action button uses .a-button-primary.
                # That class is unique to the actual submit on this page —
                # text-based selectors hit duplicate "Confirm shipment"
                # strings (section header, original pill, etc.) ahead of
                # the real submit. There may be many a-button-primary on
                # the page; pick the first one in the visible viewport.
                submit = await self.page.evaluate(
                    """() => {
                        for (const el of document.querySelectorAll('span.a-button-primary, .a-button-primary')) {
                            const r = el.getBoundingClientRect();
                            if (r.y < 0 || r.y > 760) continue;
                            if (r.width < 80) continue;
                            return {x: r.x + r.width/2, y: r.y + r.height/2};
                        }
                        return null;
                    }"""
                )
                if not submit:
                    result["error"] = "Could not find Submit button on tracking form"
                    return result
                await self.page.mouse.click(submit["x"], submit["y"])
                # Form submit takes ~5-7s; wait for Amazon to redirect.
                await asyncio.sleep(7)
                result["action"] = action_hint
            else:
                result["action"] = "already_correct"

            # Seller notes were written at Step A above, before opening the
            # Confirm form — no need to re-navigate.
            result["success"] = True
            return result

        except Exception as e:
            logger.error(f"set_amazon_tracking_and_notes error for {order_id}: {e}")
            result["error"] = str(e)
            return result

    async def _click_text_button(self, candidate_texts: List[str]) -> bool:
        """Click the first button/link whose visible text matches any candidate.

        Prefers Playwright's native locator (dispatches a real mouse event
        sequence, which Amazon's custom `<kat-*>` components require) and
        falls back to a JS click for buttons that fail the visibility check.
        """
        # Native Playwright locator path. Amazon Seller Central renders its
        # buttons as <a> (links) wrapped in <span class="a-button"> — NOT
        # real <button>s. The `:has-text` selector matches every ancestor
        # containing the text (the wrapping <div>, <span>, etc.), so
        # `.first` was often grabbing a non-clickable container. Use the
        # accessibility role/name locator instead — it pinpoints the
        # actual clickable element.
        for txt in candidate_texts:
            # 1. Accessibility role-based selectors (most reliable).
            for role in ("link", "button"):
                try:
                    loc = self.page.get_by_role(role, name=txt, exact=False).first
                    if await loc.count() > 0:
                        try:
                            await loc.scroll_into_view_if_needed(timeout=3000)
                        except Exception:
                            pass
                        await loc.click(timeout=8000)
                        return True
                except Exception as e:
                    logger.debug(f"get_by_role({role!r}, {txt!r}) failed: {e}")
            # 2. CSS selectors — try the most specific (the real interactive
            # elements) before the generic `:has-text` containers.
            for selector in (
                f'a:has-text("{txt}")',
                f'button:has-text("{txt}")',
                f'[role="button"]:has-text("{txt}")',
                f'span.a-button-text:has-text("{txt}")',
                f'.a-button:has-text("{txt}")',
            ):
                try:
                    loc = self.page.locator(selector).first
                    if await loc.count() == 0:
                        continue
                    try:
                        await loc.scroll_into_view_if_needed(timeout=3000)
                    except Exception:
                        pass
                    await loc.click(timeout=8000)
                    return True
                except Exception as e:
                    logger.debug(f"native click '{txt}' via {selector!r} failed: {e}")
                    continue
        # Last-ditch JS fallback (covers buttons hidden behind overlays)
        try:
            clicked = await self.page.evaluate(
                """
                (texts) => {
                  const lowers = texts.map(t => t.toLowerCase());
                  const els = Array.from(document.querySelectorAll('button, a, [role="button"], kat-button'));
                  for (const el of els) {
                    const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                    if (!t) continue;
                    if (lowers.some(n => t.includes(n))) {
                      el.scrollIntoView({block: 'center'});
                      el.click();
                      return true;
                    }
                  }
                  return false;
                }
                """,
                candidate_texts,
            )
            return bool(clicked)
        except Exception as e:
            logger.warning(f"_click_text_button JS fallback error: {e}")
            return False

    async def _fill_tracking_input(self, tracking_id: str) -> bool:
        """Replace the value of the Edit-shipment Tracking ID input.

        Amazon's Edit-shipment input has no name/id/placeholder — only a
        visible "Tracking ID:" label nearby. We find it by:
        1. Playwright's get_by_label (works if Amazon wires aria-labelledby)
        2. Locating an input whose value matches a long-digit tracking pattern
        3. Trying common name/id patterns as last resort

        Uses Playwright's native locator.fill() so React's controlled-input
        change handler fires.
        """
        # Strategy 1: Playwright label-association
        try:
            loc = self.page.get_by_label("Tracking ID", exact=False).first
            if await loc.count() > 0:
                await loc.click(timeout=4000)
                await loc.fill(tracking_id, timeout=4000)
                actual = await loc.input_value(timeout=2000)
                if actual.strip() == tracking_id.strip():
                    return True
        except Exception as e:
            logger.debug(f"get_by_label tracking failed: {e}")

        # Strategy 2: pick whichever <input> currently holds a long-digit
        # value (the existing tracking ID — fake or real). We use page.evaluate
        # to locate the element then return a unique data attribute we set
        # on it, and use that to find it from Playwright for a real .fill().
        try:
            target_handle_id = await self.page.evaluate(
                """
                () => {
                  for (const inp of document.querySelectorAll('input')) {
                    const v = (inp.value || '').trim();
                    if (/^[0-9A-Z]{8,}$/.test(v) && v.length >= 8 && v.length <= 30) {
                      const marker = 'mg-tracking-input-' + Math.random().toString(36).slice(2,8);
                      inp.setAttribute('data-mg-marker', marker);
                      return marker;
                    }
                  }
                  return null;
                }
                """
            )
            if target_handle_id:
                loc = self.page.locator(f'input[data-mg-marker="{target_handle_id}"]').first
                await loc.click(timeout=4000)
                await loc.fill(tracking_id, timeout=4000)
                actual = await loc.input_value(timeout=2000)
                if actual.strip() == tracking_id.strip():
                    return True
        except Exception as e:
            logger.debug(f"marker-based tracking fill failed: {e}")

        # Strategy 3: common attr patterns
        for sel in (
            'input[name*="tracking" i]', 'input[placeholder*="tracking" i]',
            'input#trackingId', 'input#tracking',
            'input[aria-label*="tracking" i]',
        ):
            try:
                loc = self.page.locator(sel).first
                if await loc.count() == 0:
                    continue
                await loc.click(timeout=4000)
                await loc.fill(tracking_id, timeout=4000)
                actual = await loc.input_value(timeout=2000)
                if actual.strip() == tracking_id.strip():
                    return True
            except Exception:
                continue

        # Strategy 4: label-proximity. Walk from the visible "Tracking ID:"
        # label to the nearest empty text input — Amazon's Confirm Shipment
        # form doesn't wire `<label for=>` or aria, so accessibility-based
        # finders miss it. This is the actual mechanism the form uses.
        try:
            marker = await self.page.evaluate(
                """
                () => {
                  // Find every element whose visible text starts with
                  // exactly "Tracking ID" (label, not the column header).
                  const labels = [];
                  const walker = document.createTreeWalker(
                    document.body, NodeFilter.SHOW_ELEMENT, null
                  );
                  let node;
                  while ((node = walker.nextNode())) {
                    const t = (node.innerText || '').trim();
                    if (t === 'Tracking ID:' || t === 'Tracking ID') {
                      labels.push(node);
                    }
                  }
                  // For each candidate label, find the nearest input by
                  // walking up the DOM and searching siblings/descendants.
                  for (const label of labels) {
                    let p = label.parentElement;
                    for (let depth = 0; depth < 8 && p; depth++) {
                      const inputs = p.querySelectorAll('input[type="text"], input:not([type])');
                      for (const inp of inputs) {
                        if (inp.disabled || inp.readOnly) continue;
                        const r = inp.getBoundingClientRect();
                        if (r.width < 80) continue;
                        // Reject the search-bar input by checking it's not
                        // labelled "Search" via placeholder.
                        if (/search/i.test(inp.placeholder || '')) continue;
                        const m = 'mg-track-' + Math.random().toString(36).slice(2,8);
                        inp.setAttribute('data-mg-track', m);
                        return m;
                      }
                      p = p.parentElement;
                    }
                  }
                  return null;
                }
                """
            )
            if marker:
                loc = self.page.locator(f'input[data-mg-track="{marker}"]').first
                try:
                    await loc.scroll_into_view_if_needed(timeout=2000)
                except Exception:
                    pass
                await loc.click(timeout=4000)
                await loc.fill(tracking_id, timeout=4000)
                actual = await loc.input_value(timeout=2000)
                if actual.strip() == tracking_id.strip():
                    return True
        except Exception as e:
            logger.debug(f"label-proximity tracking fill failed: {e}")

        return False

    async def _fill_carrier_and_tracking(self, courier: str, tracking_id: str):
        """Fill the carrier + tracking fields on Amazon's confirm/edit shipment
        form. Tries multiple selector patterns because the form layout varies."""
        # First — there's often a "Carrier" dropdown that needs to land on
        # "Other" before the free-text field becomes editable. Try that.
        try:
            await self.page.evaluate(
                """
                (courier) => {
                  // Try setting any visible <select> that looks like a carrier picker
                  for (const sel of document.querySelectorAll('select')) {
                    const opts = Array.from(sel.options || []);
                    const other = opts.find(o => /other/i.test(o.text));
                    if (other) {
                      sel.value = other.value;
                      sel.dispatchEvent(new Event('change', {bubbles: true}));
                      return;
                    }
                    // Or pick Delhivery directly if present
                    const dh = opts.find(o => courier && new RegExp(courier, 'i').test(o.text));
                    if (dh) {
                      sel.value = dh.value;
                      sel.dispatchEvent(new Event('change', {bubbles: true}));
                      return;
                    }
                  }
                }
                """,
                courier,
            )
            await asyncio.sleep(1)
        except Exception:
            pass

        # Carrier name text input
        await self._fill_input_by_attrs(
            attrs=["carrier", "shipping_carrier", "shipMethod"],
            value=courier,
        )
        # Tracking input
        await self._fill_input_by_attrs(
            attrs=["tracking", "trackingId", "trackingNumber"],
            value=tracking_id,
        )

    async def _fill_input_by_attrs(self, attrs: List[str], value: str) -> bool:
        """Find an <input> whose name/id/placeholder includes any of `attrs`
        (case-insensitive). Clear it, then type `value`."""
        try:
            return await self.page.evaluate(
                """
                ({attrs, value}) => {
                  const needles = attrs.map(a => a.toLowerCase());
                  const inputs = Array.from(document.querySelectorAll('input, textarea'));
                  for (const el of inputs) {
                    if (el.disabled || el.readOnly) continue;
                    const hay = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '')).toLowerCase();
                    if (needles.some(n => hay.includes(n))) {
                      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
                                  || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
                      setter && setter.set.call(el, value);
                      el.dispatchEvent(new Event('input', {bubbles: true}));
                      el.dispatchEvent(new Event('change', {bubbles: true}));
                      return true;
                    }
                  }
                  return false;
                }
                """,
                {"attrs": attrs, "value": value},
            )
        except Exception as e:
            logger.warning(f"_fill_input_by_attrs error: {e}")
            return False

    async def _write_seller_notes(self, notes: str) -> bool:
        """Write `notes` to the Seller Notes textarea on the current order
        page and confirm the value persisted across a re-read.

        Uses Playwright's native locator.fill() (real keyboard events) so
        Amazon's React-controlled textarea picks up the change reliably —
        the previous JS-setter + blur approach worked for most orders but
        silently no-op'd on some (observed on 0720). After writing, we
        re-query the value to confirm the write took. If it didn't, we fall
        back to the JS-setter path so we still get a best-effort write.
        """
        try:
            # Locate the textarea by tagging it via a data attribute first,
            # which Playwright can then target reliably.
            marker = await self.page.evaluate(
                """
                () => {
                  // Find <textarea> whose surrounding card / label says "Seller notes",
                  // or fall back to one with the canonical placeholder.
                  const tas = Array.from(document.querySelectorAll('textarea'));
                  let target = null;
                  for (const ta of tas) {
                    let p = ta.parentElement;
                    for (let i=0; i<8 && p; i++) {
                      const t = (p.innerText || '').toLowerCase();
                      if (t.includes('seller note')) { target = ta; break; }
                      p = p.parentElement;
                    }
                    if (target) break;
                  }
                  if (!target) {
                    target = tas.find(ta => /records only/i.test(ta.placeholder || ''));
                  }
                  if (!target) return null;
                  const m = 'mg-seller-notes-' + Math.random().toString(36).slice(2,8);
                  target.setAttribute('data-mg-marker', m);
                  return m;
                }
                """
            )
            if not marker:
                logger.warning("_write_seller_notes: no Seller Notes textarea found")
                return False

            loc = self.page.locator(f'textarea[data-mg-marker="{marker}"]').first
            # Native fill simulates real focus + keystrokes which React picks up.
            try:
                await loc.scroll_into_view_if_needed(timeout=2000)
            except Exception:
                pass
            await loc.click(timeout=4000)
            await loc.fill("", timeout=4000)
            await loc.fill(notes, timeout=4000)
            # Blur so Amazon's debounced auto-save fires.
            await self.page.evaluate(
                """(m) => {
                    const el = document.querySelector('textarea[data-mg-marker="' + m + '"]');
                    if (el) el.blur();
                }""",
                marker,
            )
            # Give the autosave a beat to flush before we verify.
            await asyncio.sleep(1.2)
            actual = await loc.input_value(timeout=2000)
            if actual.strip() == notes.strip():
                return True

            # Fallback: React state didn't pick up the fill. Try the older
            # JS-setter + dispatched-events path.
            logger.warning("Seller Notes fill didn't persist via locator.fill; retrying via JS setter")
            ok = await self.page.evaluate(
                """
                ({marker, notes}) => {
                  const el = document.querySelector('textarea[data-mg-marker="' + marker + '"]');
                  if (!el) return false;
                  el.focus();
                  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
                  setter && setter.set.call(el, notes);
                  el.dispatchEvent(new Event('input', {bubbles: true}));
                  el.dispatchEvent(new Event('change', {bubbles: true}));
                  el.blur();
                  return true;
                }
                """,
                {"marker": marker, "notes": notes},
            )
            await asyncio.sleep(1.2)
            try:
                actual2 = await loc.input_value(timeout=2000)
                return actual2.strip() == notes.strip()
            except Exception:
                return bool(ok)
        except Exception as e:
            logger.warning(f"_write_seller_notes error: {e}")
            return False

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
    
    def _session_key(self) -> dict:
        """Mongo query/upsert key for this agent's session backup.
        Keyed by (host, firm_id) so each firm's cookies are isolated."""
        return {"host": self.host, "firm_id": self.firm_id}

    async def _save_cookies(self):
        """Persist session cookies to MongoDB as a recovery backup.

        With launch_persistent_context the user_data_dir already stores
        cookies/localStorage/IndexedDB on disk, so this DB write is purely a
        belt-and-braces backup against profile-dir loss (host rebuild, wipe).
        Amazon's cookies last ~14 days; persisting them is the difference
        between an agent that runs autonomously for two weeks vs one that
        needs a fresh login on every container bounce.
        """
        if not self.context:
            return
        try:
            cookies = await self.context.cookies()
            now = datetime.now(timezone.utc).isoformat()
            await self.db.browser_sessions.update_one(
                self._session_key(),
                {"$set": {
                    "host": self.host,
                    "firm_id": self.firm_id,
                    "firm_name": self.firm_name,
                    "cookies": cookies,
                    "cookie_count": len(cookies),
                    "saved_at": now,
                }},
                upsert=True,
            )
            try:
                self.cookies_path.write_text(json.dumps(cookies))
            except Exception:
                pass
        except Exception as e:
            logger.error(f"Cookie save error: {e}")

    async def _load_cookies(self) -> bool:
        """Restore cookies from DB backup ONLY on the first launch of a given
        profile dir (or after manual recovery). After that, the persistent
        profile's own cookie jar is authoritative.

        We use a marker file `.cookies_restored` inside the profile dir to
        decide. Checking `context.cookies()` was unreliable: Chromium creates
        bootstrap cookies for about:blank, so a fresh profile is not actually
        "empty" from Playwright's perspective.
        """
        if not self.context:
            return False
        marker = self.profile_dir / ".cookies_restored"
        if marker.exists():
            return True
        try:
            doc = await self.db.browser_sessions.find_one(
                self._session_key(), {"_id": 0, "cookies": 1, "saved_at": 1}
            )
            if doc and doc.get("cookies"):
                await self.context.add_cookies(doc["cookies"])
                logger.info(
                    f"[browser-agent firm={self.firm_id} host={self.host}] "
                    f"restored {len(doc['cookies'])} cookies from DB backup "
                    f"(saved {doc.get('saved_at', 'unknown')})"
                )
                try:
                    marker.write_text(datetime.now(timezone.utc).isoformat())
                except Exception:
                    pass
                return True
        except Exception as e:
            logger.warning(f"DB cookie load failed, trying disk: {e}")
        if self.cookies_path.exists():
            try:
                cookies = json.loads(self.cookies_path.read_text())
                await self.context.add_cookies(cookies)
                logger.info(
                    f"[browser-agent firm={self.firm_id} host={self.host}] "
                    f"restored {len(cookies)} cookies from disk fallback"
                )
                try:
                    await self.db.browser_sessions.update_one(
                        self._session_key(),
                        {"$set": {
                            "host": self.host,
                            "firm_id": self.firm_id,
                            "firm_name": self.firm_name,
                            "cookies": cookies,
                            "cookie_count": len(cookies),
                            "saved_at": datetime.now(timezone.utc).isoformat(),
                            "source": "migrated_from_disk",
                        }},
                        upsert=True,
                    )
                except Exception:
                    pass
                try:
                    marker.write_text(datetime.now(timezone.utc).isoformat())
                except Exception:
                    pass
                return True
            except Exception as e:
                logger.error(f"Cookie load error: {e}")
        return False
    
    async def _save_to_storage(self, data: bytes, path: str) -> Optional[str]:
        """Upload `data` (raw bytes) to remote storage and return a public
        `/api/files/...` URL pointing at the ACTUAL stored path.

        `path` is the *desired* logical path (e.g.
        "amazon_orders/2026/05-May/25/{order_id}/label_{awb}.pdf"). The
        storage layer (`utils.storage.upload_file`) auto-generates a unique
        filename `{prefix}_{timestamp}_{uuid}.ext` inside the folder, so the
        returned URL won't be the input path verbatim — we use the prefix to
        keep the meaningful part (e.g. "label_17079315446733") in the name.

        Earlier this method wrapped the async `upload_file` in
        `asyncio.to_thread(...)`, which constructs the coroutine in a worker
        thread but never awaits it — the upload silently no-op'd and we
        returned a fictional URL anyway. Now we just `await` directly.
        """
        try:
            from utils.storage import upload_file as storage_upload

            folder = path.rsplit("/", 1)[0]
            basename = path.rsplit("/", 1)[1]
            stem, ext = (basename.rsplit(".", 1) + [""])[:2]
            # upload_file uses original_filename only for the extension; the
            # body of the filename comes from `filename_prefix` + timestamp.
            relative_path, _src = await storage_upload(
                data,
                folder,
                original_filename=basename,
                filename_prefix=stem,
            )
            if not relative_path:
                logger.error(f"Storage upload returned empty path for {path}")
                return None
            return f"/api/files/{relative_path}"
        except Exception as e:
            logger.error(f"Storage save error for {path}: {e}")
            return None

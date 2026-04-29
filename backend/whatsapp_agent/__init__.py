"""
WhatsApp AI Agent - Intelligent CRM Assistant
=============================================

A GPT-powered WhatsApp assistant that:
- Understands natural language and emotions
- Processes files (PDFs, images, invoices)
- Operates ALL CRM functions via conversation
- Maintains conversation context
- Asks clarifying questions when needed
- Never breaks the conversation flow

Architecture:
1. WhatsApp Connection (whatsapp-web.js via subprocess)
2. AI Brain (GPT-4 with tools/functions)
3. File Processor (OCR, PDF parsing)
4. CRM Tool Registry (all CRM operations as callable tools)
"""

import os
import json
import asyncio
import logging
import base64
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, field, asdict
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("whatsapp_agent")


@dataclass
class WhatsAppMessage:
    """Represents a WhatsApp message"""
    message_id: str
    from_number: str
    text: str
    timestamp: str
    has_media: bool = False
    media_type: Optional[str] = None  # image, document, audio, video
    media_url: Optional[str] = None
    media_data: Optional[bytes] = None
    quoted_message: Optional[str] = None


@dataclass
class ConversationContext:
    """Maintains conversation state and history"""
    user_number: str
    messages: List[Dict] = field(default_factory=list)
    current_task: Optional[str] = None
    pending_questions: List[str] = field(default_factory=list)
    extracted_data: Dict[str, Any] = field(default_factory=dict)
    last_activity: str = ""
    
    def add_message(self, role: str, content: str):
        self.messages.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        self.last_activity = datetime.now(timezone.utc).isoformat()
        # Keep last 50 messages for context
        if len(self.messages) > 50:
            self.messages = self.messages[-50:]
    
    def to_dict(self):
        return asdict(self)


class CRMToolRegistry:
    """
    Registry of all CRM operations that the AI can perform.
    Each tool is a callable function with description for GPT.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.tools = self._register_tools()
    
    def _register_tools(self) -> Dict[str, Dict]:
        """Register all CRM tools with their descriptions"""
        return {
            # Party/Ledger Management
            "search_party": {
                "description": "Search for a party/customer/supplier by name or phone",
                "parameters": {
                    "query": "Search term (name, phone, or GST number)",
                    "party_type": "Optional: 'customer', 'supplier', or 'both'"
                },
                "function": self._search_party
            },
            "create_party": {
                "description": "Create a new party (customer or supplier)",
                "parameters": {
                    "name": "Party name",
                    "party_type": "'customer' or 'supplier'",
                    "phone": "Phone number (optional)",
                    "email": "Email (optional)",
                    "gst_number": "GST number (optional)",
                    "address": "Address (optional)",
                    "tds_applicable": "Whether TDS is applicable (optional, default false)"
                },
                "function": self._create_party
            },
            "get_party_details": {
                "description": "Get full details of a party including balance and transactions",
                "parameters": {"party_id": "Party ID"},
                "function": self._get_party_details
            },
            
            # Product/SKU Management
            "search_product": {
                "description": "Search for a product/SKU by name or code",
                "parameters": {"query": "Search term (product name or SKU code)"},
                "function": self._search_product
            },
            "get_product_stock": {
                "description": "Get current stock of a product",
                "parameters": {"product_id": "Product ID or SKU"},
                "function": self._get_product_stock
            },
            "create_product": {
                "description": "Create a new product/SKU",
                "parameters": {
                    "name": "Product name",
                    "sku": "SKU code",
                    "category": "Category",
                    "unit": "Unit (pcs, kg, etc.)",
                    "purchase_price": "Purchase price",
                    "sale_price": "Sale price"
                },
                "function": self._create_product
            },
            
            # Purchase Management
            "create_purchase": {
                "description": "Create a purchase entry/bill",
                "parameters": {
                    "supplier_id": "Supplier party ID",
                    "invoice_number": "Supplier invoice number",
                    "invoice_date": "Invoice date (YYYY-MM-DD)",
                    "items": "List of items with product_id, quantity, rate",
                    "total_amount": "Total amount",
                    "gst_amount": "GST amount (optional)",
                    "notes": "Notes (optional)"
                },
                "function": self._create_purchase
            },
            "get_recent_purchases": {
                "description": "Get recent purchase entries",
                "parameters": {"limit": "Number of entries (default 10)"},
                "function": self._get_recent_purchases
            },
            
            # Sales Management
            "create_sale": {
                "description": "Create a sale entry/invoice",
                "parameters": {
                    "customer_id": "Customer party ID",
                    "items": "List of items with product_id, quantity, rate",
                    "total_amount": "Total amount"
                },
                "function": self._create_sale
            },
            "get_recent_sales": {
                "description": "Get recent sales",
                "parameters": {"limit": "Number of entries (default 10)"},
                "function": self._get_recent_sales
            },
            
            # Order Management (Amazon/E-commerce)
            "get_pending_orders": {
                "description": "Get pending/unshipped Amazon orders",
                "parameters": {},
                "function": self._get_pending_orders
            },
            "process_amazon_orders": {
                "description": "Process Amazon orders via browser agent",
                "parameters": {"count": "Number of orders to process"},
                "function": self._process_amazon_orders
            },
            
            # Reports & Analytics
            "get_daily_summary": {
                "description": "Get today's business summary (sales, purchases, orders)",
                "parameters": {},
                "function": self._get_daily_summary
            },
            "get_low_stock_items": {
                "description": "Get items with low stock",
                "parameters": {"threshold": "Stock threshold (default 10)"},
                "function": self._get_low_stock_items
            },
            "get_outstanding_payments": {
                "description": "Get outstanding payments from customers or to suppliers",
                "parameters": {"type": "'receivable' or 'payable'"},
                "function": self._get_outstanding_payments
            },
            
            # Ledger & Accounting
            "record_payment": {
                "description": "Record a payment received or made",
                "parameters": {
                    "party_id": "Party ID",
                    "amount": "Payment amount",
                    "payment_type": "'received' or 'made'",
                    "payment_mode": "'cash', 'bank', 'upi', etc.",
                    "reference": "Reference number (optional)"
                },
                "function": self._record_payment
            },
            "get_ledger_balance": {
                "description": "Get ledger balance for a party",
                "parameters": {"party_id": "Party ID"},
                "function": self._get_ledger_balance
            },
            
            # File Processing
            "extract_invoice_data": {
                "description": "Extract data from an invoice image or PDF",
                "parameters": {"file_data": "Base64 encoded file data", "file_type": "image or pdf"},
                "function": self._extract_invoice_data
            }
        }
    
    def get_tools_for_gpt(self) -> List[Dict]:
        """Get tool definitions in GPT function calling format"""
        gpt_tools = []
        for name, tool in self.tools.items():
            gpt_tools.append({
                "type": "function",
                "function": {
                    "name": name,
                    "description": tool["description"],
                    "parameters": {
                        "type": "object",
                        "properties": {
                            k: {"type": "string", "description": v}
                            for k, v in tool.get("parameters", {}).items()
                        },
                        "required": list(tool.get("parameters", {}).keys())
                    }
                }
            })
        return gpt_tools
    
    async def execute_tool(self, tool_name: str, parameters: Dict) -> Dict:
        """Execute a tool and return result"""
        if tool_name not in self.tools:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}
        
        try:
            result = await self.tools[tool_name]["function"](**parameters)
            return {"success": True, "data": result}
        except Exception as e:
            logger.error(f"Tool {tool_name} error: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== Tool Implementations ====================
    
    async def _search_party(self, query: str, party_type: str = "both") -> List[Dict]:
        """Search for parties"""
        filter_query = {
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"phone": {"$regex": query, "$options": "i"}},
                {"gst_number": {"$regex": query, "$options": "i"}}
            ]
        }
        if party_type != "both":
            filter_query["party_type"] = party_type
        
        cursor = self.db.parties.find(filter_query).limit(10)
        parties = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            parties.append(doc)
        return parties
    
    async def _create_party(self, name: str, party_type: str, phone: str = "", 
                           email: str = "", gst_number: str = "", address: str = "",
                           tds_applicable: bool = False) -> Dict:
        """Create a new party"""
        party = {
            "name": name,
            "party_type": party_type,
            "phone": phone,
            "email": email,
            "gst_number": gst_number,
            "address": address,
            "tds_applicable": tds_applicable,
            "balance": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        result = await self.db.parties.insert_one(party)
        party["_id"] = str(result.inserted_id)
        return party
    
    async def _get_party_details(self, party_id: str) -> Dict:
        """Get party details"""
        from bson import ObjectId
        party = await self.db.parties.find_one({"_id": ObjectId(party_id)})
        if party:
            party["_id"] = str(party["_id"])
        return party or {}
    
    async def _search_product(self, query: str) -> List[Dict]:
        """Search products"""
        cursor = self.db.master_skus.find({
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"sku": {"$regex": query, "$options": "i"}}
            ]
        }).limit(10)
        products = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            products.append(doc)
        return products
    
    async def _get_product_stock(self, product_id: str) -> Dict:
        """Get product stock"""
        from bson import ObjectId
        try:
            product = await self.db.master_skus.find_one({"_id": ObjectId(product_id)})
            if product:
                return {
                    "product_id": str(product["_id"]),
                    "name": product.get("name"),
                    "sku": product.get("sku"),
                    "current_stock": product.get("current_stock", 0),
                    "unit": product.get("unit", "pcs")
                }
        except Exception:
            pass
        return {}
    
    async def _create_product(self, name: str, sku: str, category: str = "",
                             unit: str = "pcs", purchase_price: float = 0,
                             sale_price: float = 0) -> Dict:
        """Create a new product"""
        product = {
            "name": name,
            "sku": sku,
            "category": category,
            "unit": unit,
            "purchase_price": float(purchase_price),
            "sale_price": float(sale_price),
            "current_stock": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        result = await self.db.master_skus.insert_one(product)
        product["_id"] = str(result.inserted_id)
        return product
    
    async def _create_purchase(self, supplier_id: str, invoice_number: str,
                              invoice_date: str, items: List[Dict],
                              total_amount: float, gst_amount: float = 0,
                              notes: str = "") -> Dict:
        """Create purchase entry"""
        from bson import ObjectId
        
        purchase = {
            "supplier_id": ObjectId(supplier_id),
            "invoice_number": invoice_number,
            "invoice_date": invoice_date,
            "items": items,
            "total_amount": float(total_amount),
            "gst_amount": float(gst_amount),
            "notes": notes,
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        result = await self.db.purchases.insert_one(purchase)
        purchase["_id"] = str(result.inserted_id)
        purchase["supplier_id"] = str(purchase["supplier_id"])
        return purchase
    
    async def _get_recent_purchases(self, limit: int = 10) -> List[Dict]:
        """Get recent purchases"""
        cursor = self.db.purchases.find().sort("created_at", -1).limit(int(limit))
        purchases = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "supplier_id" in doc:
                doc["supplier_id"] = str(doc["supplier_id"])
            purchases.append(doc)
        return purchases
    
    async def _create_sale(self, customer_id: str, items: List[Dict],
                          total_amount: float) -> Dict:
        """Create sale entry"""
        from bson import ObjectId
        
        sale = {
            "customer_id": ObjectId(customer_id),
            "items": items,
            "total_amount": float(total_amount),
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        result = await self.db.sales.insert_one(sale)
        sale["_id"] = str(result.inserted_id)
        sale["customer_id"] = str(sale["customer_id"])
        return sale
    
    async def _get_recent_sales(self, limit: int = 10) -> List[Dict]:
        """Get recent sales"""
        cursor = self.db.sales.find().sort("created_at", -1).limit(int(limit))
        sales = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "customer_id" in doc:
                doc["customer_id"] = str(doc["customer_id"])
            sales.append(doc)
        return sales
    
    async def _get_pending_orders(self) -> Dict:
        """Get pending Amazon orders"""
        cursor = self.db.amazon_orders.find({"status": "pending"}).limit(50)
        orders = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            orders.append(doc)
        return {"count": len(orders), "orders": orders}
    
    async def _process_amazon_orders(self, count: int = 1) -> Dict:
        """Trigger Amazon order processing"""
        # This will be connected to the browser agent
        return {"message": f"Started processing {count} orders. You'll receive updates as they complete."}
    
    async def _get_daily_summary(self) -> Dict:
        """Get today's summary"""
        from datetime import datetime, timedelta
        
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        
        # Count today's activities
        sales_count = await self.db.sales.count_documents({
            "created_at": {"$gte": today.isoformat(), "$lt": tomorrow.isoformat()}
        })
        purchases_count = await self.db.purchases.count_documents({
            "created_at": {"$gte": today.isoformat(), "$lt": tomorrow.isoformat()}
        })
        orders_processed = await self.db.amazon_order_processing.count_documents({
            "processed_at": {"$gte": today.isoformat(), "$lt": tomorrow.isoformat()}
        })
        
        return {
            "date": today.strftime("%Y-%m-%d"),
            "sales_count": sales_count,
            "purchases_count": purchases_count,
            "amazon_orders_processed": orders_processed
        }
    
    async def _get_low_stock_items(self, threshold: int = 10) -> List[Dict]:
        """Get low stock items"""
        cursor = self.db.master_skus.find({
            "current_stock": {"$lt": int(threshold)}
        }).limit(20)
        items = []
        async for doc in cursor:
            items.append({
                "name": doc.get("name"),
                "sku": doc.get("sku"),
                "current_stock": doc.get("current_stock", 0)
            })
        return items
    
    async def _get_outstanding_payments(self, type: str = "receivable") -> List[Dict]:
        """Get outstanding payments"""
        filter_query = {}
        if type == "receivable":
            filter_query = {"balance": {"$gt": 0}, "party_type": "customer"}
        else:
            filter_query = {"balance": {"$lt": 0}, "party_type": "supplier"}
        
        cursor = self.db.parties.find(filter_query).limit(20)
        parties = []
        async for doc in cursor:
            parties.append({
                "name": doc.get("name"),
                "balance": abs(doc.get("balance", 0)),
                "phone": doc.get("phone", "")
            })
        return parties
    
    async def _record_payment(self, party_id: str, amount: float, 
                             payment_type: str, payment_mode: str,
                             reference: str = "") -> Dict:
        """Record a payment"""
        from bson import ObjectId
        
        payment = {
            "party_id": ObjectId(party_id),
            "amount": float(amount),
            "payment_type": payment_type,
            "payment_mode": payment_mode,
            "reference": reference,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        result = await self.db.payments.insert_one(payment)
        
        # Update party balance
        balance_change = float(amount) if payment_type == "received" else -float(amount)
        await self.db.parties.update_one(
            {"_id": ObjectId(party_id)},
            {"$inc": {"balance": -balance_change}}
        )
        
        payment["_id"] = str(result.inserted_id)
        payment["party_id"] = str(payment["party_id"])
        return payment
    
    async def _get_ledger_balance(self, party_id: str) -> Dict:
        """Get ledger balance"""
        from bson import ObjectId
        party = await self.db.parties.find_one({"_id": ObjectId(party_id)})
        if party:
            return {
                "party_name": party.get("name"),
                "balance": party.get("balance", 0),
                "party_type": party.get("party_type")
            }
        return {}
    
    async def _extract_invoice_data(self, file_data: str, file_type: str) -> Dict:
        """Extract data from invoice using GPT Vision"""
        try:
            from emergentintegrations.llm.chat import chat, LlmModel
            
            prompt = """Analyze this invoice/bill image and extract:
1. Supplier/Vendor name
2. Invoice number
3. Invoice date
4. List of items with quantities and rates
5. Total amount
6. GST amount (if visible)
7. Supplier address
8. Supplier GST number (if visible)

Return as JSON:
{
    "supplier_name": "",
    "invoice_number": "",
    "invoice_date": "",
    "items": [{"name": "", "quantity": 0, "rate": 0, "amount": 0}],
    "total_amount": 0,
    "gst_amount": 0,
    "supplier_address": "",
    "supplier_gst": ""
}"""
            
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=LlmModel.GPT_4O_MINI,
                prompt=prompt,
                image_urls=[f"data:{file_type};base64,{file_data}"] if file_type.startswith("image") else None
            )
            
            # Parse JSON from response
            json_match = re.search(r'\{[\s\S]*\}', response.message)
            if json_match:
                return json.loads(json_match.group())
            
            return {"raw_text": response.message}
            
        except Exception as e:
            logger.error(f"Invoice extraction error: {e}")
            return {"error": str(e)}


class WhatsAppAIBrain:
    """
    The AI brain that processes messages and decides actions.
    Uses GPT-4 with function calling for intelligent responses.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, send_message_callback: Callable):
        self.db = db
        self.send_message = send_message_callback
        self.tools = CRMToolRegistry(db)
        self.conversations: Dict[str, ConversationContext] = {}
    
    def get_or_create_context(self, user_number: str) -> ConversationContext:
        """Get or create conversation context for a user"""
        if user_number not in self.conversations:
            self.conversations[user_number] = ConversationContext(user_number=user_number)
        return self.conversations[user_number]
    
    async def process_message(self, message: WhatsAppMessage) -> str:
        """Process an incoming message and generate response"""
        context = self.get_or_create_context(message.from_number)
        context.add_message("user", message.text)
        
        try:
            from emergentintegrations.llm.chat import chat, LlmModel
            
            # Build system prompt with CRM context
            system_prompt = self._build_system_prompt(context)
            
            # Build messages for GPT
            messages = [{"role": "system", "content": system_prompt}]
            for msg in context.messages[-10:]:  # Last 10 messages for context
                messages.append({"role": msg["role"], "content": msg["content"]})
            
            # Handle file if present
            image_urls = None
            if message.has_media and message.media_data:
                if message.media_type in ["image", "document"]:
                    # Extract data from file
                    context.add_message("assistant", "📄 Let me analyze this file...")
                    await self.send_message(message.from_number, "📄 Analyzing the file you sent...")
                    
                    file_data = base64.b64encode(message.media_data).decode('utf-8')
                    extracted = await self.tools.execute_tool("extract_invoice_data", {
                        "file_data": file_data,
                        "file_type": f"image/{message.media_type}" if message.media_type == "image" else "application/pdf"
                    })
                    
                    if extracted.get("success"):
                        context.extracted_data = extracted.get("data", {})
                        messages.append({
                            "role": "system",
                            "content": f"User sent a file. Extracted data: {json.dumps(context.extracted_data, indent=2)}"
                        })
            
            # Get GPT response with function calling
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=LlmModel.GPT_4O,  # Use GPT-4 for better understanding
                prompt=messages[-1]["content"],
                system_prompt=system_prompt,
                image_urls=image_urls
            )
            
            response_text = response.message
            
            # Check if GPT wants to call a function
            if "TOOL_CALL:" in response_text:
                response_text = await self._handle_tool_calls(response_text, context, message.from_number)
            
            # Save response to context
            context.add_message("assistant", response_text)
            
            # Save conversation to DB
            await self._save_conversation(context)
            
            return response_text
            
        except Exception as e:
            logger.error(f"AI processing error: {e}")
            return f"I encountered an error processing your message. Please try again. ({str(e)[:50]})"
    
    def _build_system_prompt(self, context: ConversationContext) -> str:
        """Build the system prompt with CRM context"""
        tools_desc = "\n".join([
            f"- {name}: {tool['description']}"
            for name, tool in self.tools.tools.items()
        ])
        
        return f"""You are an intelligent WhatsApp assistant for MuscleGrid CRM. You help manage all business operations through natural conversation.

## Your Capabilities:
{tools_desc}

## How to Use Tools:
When you need to perform an action, respond with:
TOOL_CALL: tool_name
PARAMETERS: {{"param1": "value1", "param2": "value2"}}
END_TOOL

## Important Guidelines:
1. Be conversational and friendly - this is WhatsApp, not a formal system
2. Understand emotions and respond appropriately (if user seems frustrated, be extra helpful)
3. Ask clarifying questions when information is incomplete
4. When creating entries, confirm details before proceeding
5. For purchases/sales, always verify party exists or offer to create
6. Match products by name intelligently (partial matches are OK)
7. Give brief status updates for long operations
8. Use emojis naturally to make conversation friendly
9. If user sends a file, analyze it and suggest appropriate actions
10. Keep responses concise but informative

## Current Context:
- Current task: {context.current_task or 'None'}
- Pending questions: {context.pending_questions or 'None'}
- Extracted data from files: {json.dumps(context.extracted_data) if context.extracted_data else 'None'}

## Example Interactions:

User: "register this purchase bill" (with image)
You: "📄 I've extracted the invoice details:
• Supplier: ABC Trading
• Invoice #: INV-2024-001  
• Amount: ₹15,000
• Items: 3 products

I couldn't find 'ABC Trading' in your suppliers. Should I:
1. Create a new supplier with this name?
2. Link to an existing supplier? (type the name)

Also, is TDS applicable for this supplier?"

User: "yes create it, no tds"
You: "✅ Created supplier 'ABC Trading'

Now matching items with your inventory:
• 'Whey Protein 1kg' → Matched to SKU: WP-1KG
• 'BCAA 300g' → Matched to SKU: BCAA-300
• 'Creatine 250g' → ⚠️ No match found

Should I create a new product for 'Creatine 250g' or link to existing?"

Remember: You're having a conversation, not filling a form. Be natural and helpful!"""
    
    async def _handle_tool_calls(self, response: str, context: ConversationContext, user_number: str) -> str:
        """Handle tool calls in the response"""
        # Parse tool calls
        tool_pattern = r'TOOL_CALL:\s*(\w+)\s*PARAMETERS:\s*(\{[^}]+\})\s*END_TOOL'
        matches = re.findall(tool_pattern, response, re.DOTALL)
        
        results = []
        for tool_name, params_str in matches:
            try:
                params = json.loads(params_str)
                await self.send_message(user_number, f"⏳ {tool_name.replace('_', ' ').title()}...")
                result = await self.tools.execute_tool(tool_name, params)
                results.append(f"{tool_name}: {json.dumps(result)}")
            except Exception as e:
                results.append(f"{tool_name}: Error - {str(e)}")
        
        # Remove tool calls from response and append results
        clean_response = re.sub(tool_pattern, '', response).strip()
        if results:
            clean_response += "\n\n📊 Results:\n" + "\n".join(results)
        
        return clean_response
    
    async def _save_conversation(self, context: ConversationContext):
        """Save conversation to database"""
        await self.db.whatsapp_conversations.update_one(
            {"user_number": context.user_number},
            {"$set": context.to_dict()},
            upsert=True
        )

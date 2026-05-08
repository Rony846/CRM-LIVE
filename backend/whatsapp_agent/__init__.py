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
    is_authenticated: bool = False  # Authentication state
    
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
                "description": "Extract data from an invoice image or PDF - works with complex multi-page documents",
                "parameters": {"file_data": "Base64 encoded file data", "file_type": "image or pdf"},
                "function": self._extract_invoice_data
            },
            "analyze_document": {
                "description": "Analyze any document (PDF, image) including user manuals, contracts, invoices. Extracts text, tables, specifications, and key information.",
                "parameters": {"file_data": "Base64 encoded file data", "file_type": "document type (pdf, image)"},
                "function": self._extract_invoice_data  # Same function handles all document types
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
    
    async def _search_party(self, query: str = "", party_type: str = "both", **kwargs) -> List[Dict]:
        """Search for parties - accepts query, name, search_term as parameter names"""
        # Handle different parameter names that LLM might use
        search_term = query or kwargs.get("name", "") or kwargs.get("search_term", "") or kwargs.get("search", "")
        if not search_term:
            return []
        
        filter_query = {
            "$or": [
                {"name": {"$regex": search_term, "$options": "i"}},
                {"phone": {"$regex": search_term, "$options": "i"}},
                {"gst_number": {"$regex": search_term, "$options": "i"}}
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
    
    async def _create_party(self, name: str = "", party_type: str = "", phone: str = "", 
                           email: str = "", gst_number: str = "", address: str = "",
                           tds_applicable: bool = False, **kwargs) -> Dict:
        """Create a new party - accepts flexible parameter names"""
        # Handle alternative parameter names
        party_name = name or kwargs.get("party_name", "") or kwargs.get("supplier_name", "") or kwargs.get("customer_name", "")
        ptype = party_type or kwargs.get("type", "") or kwargs.get("category", "supplier")
        
        if not party_name:
            return {"error": "Party name is required"}
        
        # Normalize party_type
        if ptype.lower() in ["supplier", "vendor"]:
            ptype = "supplier"
        elif ptype.lower() in ["customer", "buyer", "client"]:
            ptype = "customer"
        else:
            ptype = "supplier"  # Default to supplier
        
        party = {
            "name": party_name,
            "party_type": ptype,
            "phone": phone or kwargs.get("contact", "") or kwargs.get("mobile", ""),
            "email": email or kwargs.get("email_id", ""),
            "gst_number": gst_number or kwargs.get("gst", "") or kwargs.get("gstin", ""),
            "address": address or kwargs.get("addr", "") or kwargs.get("location", ""),
            "tds_applicable": tds_applicable if isinstance(tds_applicable, bool) else str(tds_applicable).lower() == "true",
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
    
    async def _search_product(self, query: str = "", **kwargs) -> List[Dict]:
        """Search products - accepts query, name, search_term as parameter names"""
        search_term = query or kwargs.get("name", "") or kwargs.get("search_term", "") or kwargs.get("product_name", "")
        if not search_term:
            return []
        
        cursor = self.db.master_skus.find({
            "$or": [
                {"name": {"$regex": search_term, "$options": "i"}},
                {"sku": {"$regex": search_term, "$options": "i"}}
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
    
    async def _create_purchase(self, supplier_id: str = "", invoice_number: str = "",
                              invoice_date: str = "", items: List[Dict] = None,
                              total_amount: float = 0, gst_amount: float = 0,
                              notes: str = "", **kwargs) -> Dict:
        """Create purchase entry - handles supplier_name by auto-creating supplier if needed"""
        from bson import ObjectId
        
        # Handle alternative parameter names
        sup_id = supplier_id or kwargs.get("party_id", "")
        supplier_name = kwargs.get("supplier_name", "") or kwargs.get("vendor_name", "") or kwargs.get("party_name", "")
        inv_number = invoice_number or kwargs.get("bill_number", "") or kwargs.get("invoice_no", "")
        inv_date = invoice_date or kwargs.get("bill_date", "") or kwargs.get("date", "")
        item_list = items or kwargs.get("line_items", []) or kwargs.get("products", [])
        amount = total_amount or kwargs.get("amount", 0) or kwargs.get("grand_total", 0)
        
        # If supplier_name is provided but no supplier_id, try to find or create the supplier
        if not sup_id and supplier_name:
            # Search for existing supplier
            existing = await self.db.parties.find_one({
                "name": {"$regex": f"^{supplier_name}$", "$options": "i"},
                "party_type": "supplier"
            })
            
            if existing:
                sup_id = str(existing["_id"])
            else:
                # Create new supplier
                new_supplier = await self._create_party(
                    name=supplier_name,
                    party_type="supplier",
                    gst_number=kwargs.get("supplier_gst", "") or kwargs.get("gst_number", ""),
                    address=kwargs.get("supplier_address", "") or kwargs.get("address", ""),
                    phone=kwargs.get("supplier_phone", "") or kwargs.get("phone", "")
                )
                if new_supplier.get("_id"):
                    sup_id = new_supplier["_id"]
                else:
                    return {"error": f"Failed to create supplier: {new_supplier.get('error', 'Unknown error')}"}
        
        if not sup_id:
            return {"error": "Supplier ID or supplier name is required"}
        
        if not inv_number:
            return {"error": "Invoice number is required"}
        
        # Validate items
        if not item_list:
            return {"error": "At least one item is required"}
        
        # Ensure items are in correct format
        processed_items = []
        for item in item_list:
            processed_items.append({
                "name": item.get("name", "") or item.get("product_name", "") or item.get("description", "Unknown"),
                "quantity": int(item.get("quantity", 1) or item.get("qty", 1)),
                "rate": float(item.get("rate", 0) or item.get("price", 0) or item.get("unit_price", 0)),
                "amount": float(item.get("amount", 0) or item.get("total", 0))
            })
        
        try:
            purchase = {
                "supplier_id": ObjectId(sup_id),
                "invoice_number": inv_number,
                "invoice_date": inv_date,
                "items": processed_items,
                "total_amount": float(amount),
                "gst_amount": float(gst_amount or kwargs.get("tax_amount", 0)),
                "notes": notes,
                "status": "completed",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            result = await self.db.purchases.insert_one(purchase)
            purchase["_id"] = str(result.inserted_id)
            purchase["supplier_id"] = str(purchase["supplier_id"])
            return purchase
        except Exception as e:
            return {"error": f"Failed to create purchase: {str(e)}"}
    
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
    
    async def _create_sale(self, customer_id: str = "", items: List[Dict] = None,
                          total_amount: float = 0, **kwargs) -> Dict:
        """Create sale entry - handles customer_name by auto-creating customer if needed"""
        from bson import ObjectId
        
        # Handle alternative parameter names
        cust_id = customer_id or kwargs.get("party_id", "")
        customer_name = kwargs.get("customer_name", "") or kwargs.get("buyer_name", "") or kwargs.get("party_name", "")
        item_list = items or kwargs.get("line_items", []) or kwargs.get("products", [])
        amount = total_amount or kwargs.get("amount", 0) or kwargs.get("grand_total", 0)
        
        # If customer_name is provided but no customer_id, try to find or create
        if not cust_id and customer_name:
            existing = await self.db.parties.find_one({
                "name": {"$regex": f"^{customer_name}$", "$options": "i"},
                "party_type": "customer"
            })
            
            if existing:
                cust_id = str(existing["_id"])
            else:
                new_customer = await self._create_party(
                    name=customer_name,
                    party_type="customer",
                    phone=kwargs.get("customer_phone", "") or kwargs.get("phone", "")
                )
                if new_customer.get("_id"):
                    cust_id = new_customer["_id"]
                else:
                    return {"error": f"Failed to create customer: {new_customer.get('error', 'Unknown error')}"}
        
        if not cust_id:
            return {"error": "Customer ID or customer name is required"}
        
        if not item_list:
            return {"error": "At least one item is required"}
        
        try:
            sale = {
                "customer_id": ObjectId(cust_id),
                "items": item_list,
                "total_amount": float(amount),
                "status": "completed",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            result = await self.db.sales.insert_one(sale)
            sale["_id"] = str(result.inserted_id)
            sale["customer_id"] = str(sale["customer_id"])
            return sale
        except Exception as e:
            return {"error": f"Failed to create sale: {str(e)}"}
    
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
    
    async def _get_pending_orders(self, **kwargs) -> Dict:
        """Get pending Amazon orders - no required parameters"""
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
    
    async def _get_daily_summary(self, **kwargs) -> Dict:
        """Get today's summary - no required parameters"""
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
    
    async def _get_low_stock_items(self, threshold: int = 10, **kwargs) -> List[Dict]:
        """Get low stock items"""
        # Handle alternative parameter names
        thresh = threshold or kwargs.get("limit", 10) or kwargs.get("min_stock", 10)
        cursor = self.db.master_skus.find({
            "current_stock": {"$lt": int(thresh)}
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
    
    async def _extract_invoice_data(self, file_data: str = "", file_type: str = "", **kwargs) -> Dict:
        """
        Extract data from invoices, PDFs, and user manuals using GPT-4 Vision.
        
        Supports:
        - PDF files (converts to images, analyzes each page)
        - Images (JPEG, PNG, WEBP)
        - Complex multi-page documents
        """
        import fitz  # PyMuPDF
        from PIL import Image
        import io
        
        # Handle different parameter names
        data = file_data or kwargs.get("data", "") or kwargs.get("image_data", "")
        ftype = file_type or kwargs.get("type", "") or kwargs.get("mime_type", "image")
        
        if not data:
            return {"error": "No file data provided"}
        
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
            
            # Decode base64 data
            try:
                file_bytes = base64.b64decode(data)
            except Exception as e:
                logger.error(f"Base64 decode error: {e}")
                return {"error": f"Invalid base64 data: {str(e)}"}
            
            # Determine file type and extract images
            images_base64 = []
            
            # Check if it's a PDF
            is_pdf = file_bytes[:4] == b'%PDF' or 'pdf' in ftype.lower()
            
            if is_pdf:
                logger.info("Processing PDF document...")
                try:
                    # Open PDF with PyMuPDF
                    pdf_doc = fitz.open(stream=file_bytes, filetype="pdf")
                    num_pages = len(pdf_doc)
                    logger.info(f"PDF has {num_pages} pages")
                    
                    # Process up to 10 pages (to avoid token limits)
                    max_pages = min(num_pages, 10)
                    
                    for page_num in range(max_pages):
                        page = pdf_doc[page_num]
                        # Render page to image at 150 DPI for good quality
                        mat = fitz.Matrix(150/72, 150/72)  # 150 DPI
                        pix = page.get_pixmap(matrix=mat)
                        
                        # Convert to PNG bytes
                        img_bytes = pix.tobytes("png")
                        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
                        images_base64.append({
                            "page": page_num + 1,
                            "data": img_base64
                        })
                    
                    pdf_doc.close()
                    logger.info(f"Extracted {len(images_base64)} page images from PDF")
                    
                except Exception as e:
                    logger.error(f"PDF processing error: {e}")
                    return {"error": f"Failed to process PDF: {str(e)}"}
            else:
                # It's an image - validate and process
                logger.info("Processing image file...")
                try:
                    img = Image.open(io.BytesIO(file_bytes))
                    
                    # Convert to RGB if necessary (for RGBA, P mode, etc.)
                    if img.mode in ('RGBA', 'P', 'LA'):
                        img = img.convert('RGB')
                    
                    # Resize if too large (max 2000px on longest side)
                    max_size = 2000
                    if max(img.size) > max_size:
                        ratio = max_size / max(img.size)
                        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                        img = img.resize(new_size, Image.Resampling.LANCZOS)
                    
                    # Convert to JPEG for smaller size
                    buffer = io.BytesIO()
                    img.save(buffer, format='JPEG', quality=85)
                    img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                    images_base64.append({"page": 1, "data": img_base64})
                    
                except Exception as e:
                    logger.error(f"Image processing error: {e}")
                    return {"error": f"Failed to process image: {str(e)}"}
            
            if not images_base64:
                return {"error": "No images could be extracted from the file"}
            
            # Initialize GPT-4 Vision chat
            chat = LlmChat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                session_id=f"doc_extraction_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
                system_message="""You are an expert document analyzer specializing in:
- Invoices and bills (extracting vendor, amounts, items, taxes)
- User manuals (extracting key instructions, specifications)
- Business documents (contracts, purchase orders)
- Any complex multi-page documents

Always extract structured data and return valid JSON. Be thorough and accurate."""
            ).with_model("openai", "gpt-4o")  # GPT-4 Vision
            
            # Build extraction prompt based on document type
            extraction_prompt = """Analyze this document thoroughly and extract ALL relevant information.

For INVOICES/BILLS, extract:
{
    "document_type": "invoice",
    "supplier_name": "",
    "supplier_address": "",
    "supplier_gst": "",
    "supplier_phone": "",
    "invoice_number": "",
    "invoice_date": "",
    "due_date": "",
    "customer_name": "",
    "customer_address": "",
    "items": [{"name": "", "description": "", "quantity": 0, "unit": "", "rate": 0, "amount": 0, "gst_rate": 0}],
    "subtotal": 0,
    "gst_amount": 0,
    "cgst": 0,
    "sgst": 0,
    "igst": 0,
    "total_amount": 0,
    "payment_terms": "",
    "bank_details": ""
}

For USER MANUALS/TECHNICAL DOCS, extract:
{
    "document_type": "manual",
    "product_name": "",
    "model_number": "",
    "manufacturer": "",
    "specifications": {},
    "key_features": [],
    "safety_warnings": [],
    "installation_steps": [],
    "troubleshooting": [],
    "warranty_info": ""
}

For OTHER DOCUMENTS, extract all visible text and structure it logically:
{
    "document_type": "other",
    "title": "",
    "content_summary": "",
    "key_points": [],
    "tables": [],
    "important_data": {}
}

Return ONLY valid JSON. Be comprehensive - extract everything visible."""

            # Process single image or first page
            first_image = images_base64[0]
            image_content = ImageContent(image_base64=first_image["data"])
            
            user_message = UserMessage(
                text=extraction_prompt,
                file_contents=[image_content]
            )
            
            response_text = await chat.send_message(user_message)
            logger.info(f"Vision API response received ({len(response_text)} chars)")
            
            # If multi-page, process additional pages
            if len(images_base64) > 1:
                additional_data = []
                for img_info in images_base64[1:]:
                    try:
                        page_content = ImageContent(image_base64=img_info["data"])
                        page_message = UserMessage(
                            text=f"This is page {img_info['page']} of the same document. Extract any additional information not already captured. Return JSON with new data only.",
                            file_contents=[page_content]
                        )
                        page_response = await chat.send_message(page_message)
                        additional_data.append({
                            "page": img_info["page"],
                            "data": page_response
                        })
                    except Exception as e:
                        logger.warning(f"Error processing page {img_info['page']}: {e}")
            
            # Parse main response
            try:
                # Try to extract JSON from response
                json_match = re.search(r'\{[\s\S]*\}', response_text)
                if json_match:
                    result = json.loads(json_match.group())
                    result["pages_processed"] = len(images_base64)
                    result["extraction_success"] = True
                    return result
                else:
                    return {
                        "extraction_success": True,
                        "raw_text": response_text,
                        "pages_processed": len(images_base64)
                    }
            except json.JSONDecodeError:
                return {
                    "extraction_success": True,
                    "raw_text": response_text,
                    "pages_processed": len(images_base64)
                }
            
        except Exception as e:
            logger.error(f"Document extraction error: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e), "extraction_success": False}


class WhatsAppAIBrain:
    """
    The AI brain that processes messages and decides actions.
    Uses GPT-4 with function calling for intelligent responses.
    Requires secret code authentication before proceeding.
    
    Features:
    - Persistent conversation memory (MongoDB)
    - Multi-turn tool execution with proper context continuation
    - Natural conversational responses after tool execution
    """
    
    SECRET_CODE = "Rony846"
    MAX_TOOL_ITERATIONS = 3  # Prevent infinite tool loops
    
    def __init__(self, db: AsyncIOMotorDatabase, send_message_callback: Callable):
        self.db = db
        self.send_message = send_message_callback
        self.tools = CRMToolRegistry(db)
        self.conversations: Dict[str, ConversationContext] = {}
    
    async def get_or_create_context(self, user_number: str) -> ConversationContext:
        """Get or create conversation context for a user - loads from DB if exists"""
        # Check in-memory cache first
        if user_number in self.conversations:
            return self.conversations[user_number]
        
        # Load from MongoDB
        db_conv = await self.db.whatsapp_conversations.find_one({"user_number": user_number})
        
        if db_conv:
            # Restore context from DB
            context = ConversationContext(
                user_number=user_number,
                messages=db_conv.get("messages", []),
                current_task=db_conv.get("current_task"),
                pending_questions=db_conv.get("pending_questions", []),
                extracted_data=db_conv.get("extracted_data", {}),
                last_activity=db_conv.get("last_activity", ""),
                is_authenticated=db_conv.get("is_authenticated", False)
            )
            logger.info(f"Loaded conversation for {user_number} with {len(context.messages)} messages, auth={context.is_authenticated}")
        else:
            # Create new context
            context = ConversationContext(user_number=user_number)
            logger.info(f"Created new conversation for {user_number}")
        
        self.conversations[user_number] = context
        return context
    
    async def process_message(self, message: WhatsAppMessage) -> str:
        """Process an incoming message and generate response with full memory"""
        context = await self.get_or_create_context(message.from_number)
        user_text = message.text.strip()
        
        # ============ AUTHENTICATION CHECK ============
        if not context.is_authenticated:
            # Check if this is the secret code
            if user_text == self.SECRET_CODE:
                context.is_authenticated = True
                context.add_message("user", "[AUTHENTICATED]")
                await self._save_conversation(context)
                return "✅ Access granted! Welcome to MuscleGrid CRM Assistant.\n\nI can help you with:\n• Managing parties, products & inventory\n• Creating purchases & sales\n• Processing Amazon orders\n• Checking reports & analytics\n• And much more!\n\nJust tell me what you need in natural language. For example:\n- \"Check stock of whey protein\"\n- \"Show today's sales summary\"\n- \"Process 3 Amazon orders\"\n\nHow can I assist you today?"
            else:
                # Ask for secret code
                return "🔐 *MuscleGrid CRM Assistant*\n\nThis is a secure business assistant. Please enter your access code to continue."
        
        # ============ AUTHENTICATED - PROCESS WITH AI ============
        context.add_message("user", user_text)
        
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
            
            # Handle file if present
            file_analysis_result = None
            if message.has_media and message.media_data:
                if message.media_type in ["image", "document", "pdf"]:
                    await self.send_message(message.from_number, "📄 Analyzing your document with AI Vision... This may take a moment for complex files.")
                    
                    file_data = base64.b64encode(message.media_data).decode('utf-8')
                    
                    # Determine file type
                    file_type = "application/pdf" if message.media_type in ["document", "pdf"] else f"image/{message.media_type}"
                    
                    # Use our enhanced document extraction
                    extracted = await self.tools.execute_tool("extract_invoice_data", {
                        "file_data": file_data,
                        "file_type": file_type
                    })
                    
                    if extracted.get("success") and extracted.get("data"):
                        extraction_data = extracted.get("data", {})
                        context.extracted_data = extraction_data
                        file_analysis_result = extraction_data
                        
                        # Store extraction in context for AI to reference
                        pages_info = f" ({extraction_data.get('pages_processed', 1)} pages analyzed)" if extraction_data.get('pages_processed', 1) > 1 else ""
                        context.add_message("system", f"[Document Analysis Complete{pages_info}]\n{json.dumps(extraction_data, indent=2, default=str)[:2000]}")
                        logger.info(f"Document extraction successful: {extraction_data.get('document_type', 'unknown')} with {extraction_data.get('pages_processed', 1)} pages")
                    else:
                        error_msg = extracted.get("data", {}).get("error", "Unknown error") if extracted.get("data") else "Extraction failed"
                        context.add_message("system", f"[Document Analysis Failed: {error_msg}]")
                        logger.warning(f"Document extraction failed: {error_msg}")
            
            # Build system prompt with context
            system_prompt = self._build_system_prompt(context)
            
            # Build conversation history for LLM
            # Include recent messages so the LLM has context
            history_text = self._build_history_text(context)
            
            # Create GPT chat instance with unique session
            chat = LlmChat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                session_id=f"whatsapp_{message.from_number}_{datetime.now(timezone.utc).strftime('%Y%m%d')}",
                system_message=system_prompt
            )
            
            # If we have conversation history, prime the chat with it
            if history_text:
                context_message = UserMessage(text=f"[CONVERSATION HISTORY - DO NOT RESPOND TO THIS, JUST ACKNOWLEDGE]\n{history_text}\n\n[END HISTORY - NOW RESPOND TO THE LATEST MESSAGE BELOW]")
                try:
                    # Prime the context silently
                    await chat.send_message(context_message)
                except Exception as e:
                    logger.warning(f"Failed to prime context: {e}")
            
            # Get AI response for current message
            user_message = UserMessage(text=user_text)
            response_text = await chat.send_message(user_message)
            
            # ============ HANDLE TOOL CALLS WITH PROPER LOOP ============
            # If GPT wants to call a tool, execute it and get clean response
            iteration = 0
            while "TOOL_CALL:" in response_text and iteration < self.MAX_TOOL_ITERATIONS:
                iteration += 1
                logger.info(f"Tool execution iteration {iteration}")
                response_text = await self._execute_tools_and_respond(response_text, context, message.from_number, chat)
            
            # Clean any remaining tool syntax from response
            response_text = self._clean_response(response_text)
            
            # Save response to context
            context.add_message("assistant", response_text)
            await self._save_conversation(context)
            
            return response_text
            
        except Exception as e:
            error_str = str(e).lower()
            logger.error(f"AI processing error: {e}")
            import traceback
            traceback.print_exc()
            
            # Handle specific errors with helpful messages
            if "budget" in error_str and "exceeded" in error_str:
                return "⚠️ *AI Service Temporarily Unavailable*\n\nThe AI assistant's usage budget has been reached. Please contact your admin to top up the balance.\n\n👉 Go to Profile → Universal Key → Add Balance\n\nI'll be back to help you once the balance is restored! 🙏"
            elif "rate limit" in error_str or "too many requests" in error_str:
                return "⏳ I'm getting a lot of requests right now! Please wait a moment and try again."
            else:
                return "Sorry, I encountered an issue. Please try again or rephrase your request."
    
    def _build_history_text(self, context: ConversationContext) -> str:
        """Build conversation history text for context priming"""
        history_parts = []
        # Use last 15 messages for better context
        for msg in context.messages[-15:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                history_parts.append(f"User: {content}")
            elif role == "assistant":
                # Truncate long assistant responses
                truncated = content[:500] + "..." if len(content) > 500 else content
                history_parts.append(f"Assistant: {truncated}")
            elif role == "system":
                history_parts.append(f"[System: {content[:200]}...]")
        return "\n".join(history_parts)
    
    def _clean_response(self, response: str) -> str:
        """Remove any remaining tool syntax from response"""
        # Remove TOOL_CALL blocks
        cleaned = re.sub(r'TOOL_CALL:.*?END_TOOL', '', response, flags=re.DOTALL).strip()
        # Remove any empty lines created
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        return cleaned if cleaned else "I've processed your request."
    
    async def _execute_tools_and_respond(self, response: str, context: ConversationContext, user_number: str, chat) -> str:
        """
        Execute tool calls and generate a clean response with results.
        
        CRITICAL: After executing tools, we append the result to context and call the LLM again
        to get a natural language response. This creates the proper conversation loop.
        """
        from emergentintegrations.llm.chat import UserMessage
        
        # Parse tool calls - improved regex to handle multi-line parameters
        tool_pattern = r'TOOL_CALL:\s*(\w+)\s*PARAMETERS:\s*(\{[\s\S]*?\})\s*END_TOOL'
        matches = re.findall(tool_pattern, response, re.DOTALL)
        
        if not matches:
            # No valid tool calls found, return cleaned response
            clean_response = re.sub(r'TOOL_CALL:.*?END_TOOL', '', response, flags=re.DOTALL).strip()
            return clean_response if clean_response else "I'm processing your request..."
        
        # Execute each tool
        tool_results = []
        for tool_name, params_str in matches:
            try:
                # Clean the params string - remove newlines and extra spaces
                params_str_clean = re.sub(r'\s+', ' ', params_str.strip())
                params = json.loads(params_str_clean) if params_str_clean and params_str_clean != '{}' else {}
                logger.info(f"Executing tool: {tool_name} with params: {params}")
                
                result = await self.tools.execute_tool(tool_name, params)
                tool_results.append({
                    "tool": tool_name,
                    "success": result.get("success", False),
                    "data": result.get("data", result.get("error", "No data"))
                })
                logger.info(f"Tool {tool_name} result: success={result.get('success')}")
                
                # Add tool result to context for memory
                context.add_message("system", f"[Tool {tool_name} executed: {json.dumps(result, default=str)[:500]}]")
                
            except json.JSONDecodeError as e:
                logger.error(f"JSON parse error for tool {tool_name}: {e}, params: {params_str[:100]}")
                tool_results.append({
                    "tool": tool_name,
                    "success": False,
                    "data": f"Parameter parsing error: {str(e)}"
                })
            except Exception as e:
                logger.error(f"Tool execution error: {e}")
                tool_results.append({
                    "tool": tool_name,
                    "success": False,
                    "data": str(e)
                })
        
        # Format results for the LLM to summarize
        results_summary = json.dumps(tool_results, indent=2, default=str)
        
        # CRITICAL: Ask LLM to provide a natural language summary of the results
        summary_prompt = f"""I just executed CRM tools to help with the user's request. Here are the results:

{results_summary}

Based on these results, please provide a friendly, conversational response to the user.

Guidelines:
- If data was found, present it clearly and concisely
- If no data found, let them know politely and suggest alternatives
- Use emojis naturally (but don't overdo it)
- Keep it brief but helpful
- If the user might want to take further action, suggest it
- NEVER include TOOL_CALL syntax in your response
- Respond as if you're talking to a friend on WhatsApp"""
        
        try:
            summary_message = UserMessage(text=summary_prompt)
            final_response = await chat.send_message(summary_message)
            
            # Return the response (may contain more tool calls for chained operations)
            return final_response
            
        except Exception as e:
            logger.error(f"Summary generation error: {e}")
            # Fallback: generate a simple summary ourselves
            return self._generate_fallback_summary(tool_results)
    
    def _generate_fallback_summary(self, tool_results: List[Dict]) -> str:
        """Generate a fallback summary when LLM fails"""
        if not tool_results:
            return "I processed your request but couldn't retrieve data."
        
        # Check first successful result
        for result in tool_results:
            if result.get("success"):
                data = result.get("data")
                tool_name = result.get("tool", "")
                
                if isinstance(data, list):
                    if len(data) == 0:
                        return "📋 No records found for your query."
                    count = len(data)
                    preview = json.dumps(data[:3], indent=2, default=str) if count > 0 else "No data"
                    return f"✅ Found {count} record(s):\n\n```\n{preview}\n```"
                elif isinstance(data, dict):
                    if "count" in data:
                        return f"📊 Summary: {data.get('count', 0)} items found."
                    return f"✅ Result:\n\n```\n{json.dumps(data, indent=2, default=str)[:800]}\n```"
                else:
                    return f"✅ {data}"
        
        # All tools failed
        errors = [r.get("data", "Unknown error") for r in tool_results if not r.get("success")]
        return f"⚠️ I encountered an issue: {errors[0] if errors else 'Unknown error'}. Please try again or rephrase your request."
    
    def _build_system_prompt(self, context: ConversationContext) -> str:
        """Build the system prompt with CRM context"""
        tools_desc = "\n".join([
            f"- {name}: {tool['description']}"
            for name, tool in self.tools.tools.items()
        ])
        
        return f"""You are an intelligent WhatsApp assistant for MuscleGrid CRM. You help manage all business operations through natural conversation.

## Your Capabilities:
{tools_desc}

## Document Processing (GPT-4 Vision):
You can analyze ANY document sent to you:
- **Invoices & Bills**: Extract vendor, items, amounts, taxes, GST details
- **User Manuals**: Extract specifications, features, installation steps, troubleshooting
- **Contracts & Purchase Orders**: Extract key terms, dates, parties involved
- **Any PDF/Image**: Multi-page support, tables, structured data extraction

When a user sends a file, the system automatically analyzes it and provides extracted data in the context.

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
9. **When user sends a file**: Summarize what you found, highlight key data, and suggest next actions
10. Keep responses concise but informative
11. For complex documents: Reference specific sections, page numbers if multi-page

## Current Context:
- Current task: {context.current_task or 'None'}
- Pending questions: {context.pending_questions or 'None'}
- Extracted data from files: {json.dumps(context.extracted_data, default=str)[:1500] if context.extracted_data else 'None'}

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

User: (sends a product manual PDF)
You: "📘 I've analyzed your product manual (5 pages):

**Product**: XYZ Inverter Model 5000
**Key Specs**:
• Power: 5000VA
• Battery: 150Ah compatible
• Warranty: 2 years

**Installation highlights**:
1. Mount on dry wall
2. Connect battery positive first
3. Allow 4-hour initial charge

Would you like me to:
1. Create this as a new product in inventory?
2. Search for matching SKUs?
3. Extract more details from specific sections?"

Remember: You're having a conversation, not filling a form. Be natural and helpful!"""
    
    async def _save_conversation(self, context: ConversationContext):
        """Save conversation to database"""
        await self.db.whatsapp_conversations.update_one(
            {"user_number": context.user_number},
            {"$set": context.to_dict()},
            upsert=True
        )

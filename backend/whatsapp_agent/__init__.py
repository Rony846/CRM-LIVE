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
                "description": (
                    "Create a new product/SKU. HSN code and GST rate are MANDATORY for "
                    "GSTR-3B compliance — ask the user for both before calling this tool "
                    "if they are not already provided."
                ),
                "parameters": {
                    "name": "Product name",
                    "sku": "SKU code",
                    "category": "Category (Inverter / Battery / Stabilizer / Spare Part / etc.)",
                    "hsn_code": "MANDATORY HSN code (4–8 digit string, e.g. '85044090')",
                    "gst_rate": "MANDATORY GST rate (one of 0, 5, 12, 18, 28)",
                    "unit": "Unit (pcs, kg, etc.)",
                    "purchase_price": "Purchase / cost price",
                    "sale_price": "Sale price"
                },
                "function": self._create_product
            },
            
            # Purchase Management
            "list_firms": {
                "description": (
                    "List our active firms (our own legal entities — MGIPL, SPV Industries, etc.). "
                    "Call this whenever you're booking a purchase or sale and need to know which firm "
                    "owns the transaction. Match by GSTIN whenever possible."
                ),
                "parameters": {},
                "function": self._list_firms
            },
            "create_purchase": {
                "description": (
                    "Create a purchase entry/bill. The firm (which of OUR legal entities is buying) "
                    "is mandatory. On a B2B invoice, the buyer GSTIN identifies it — read it from the "
                    "bill-to / buyer block and pass it as firm_gstin. If you can't find it, ask the "
                    "user. NEVER guess: a wrong firm corrupts GSTR-3B."
                ),
                "parameters": {
                    "firm_gstin": "Buyer GSTIN read off the invoice (preferred — matches firm by GSTIN exactly).",
                    "firm_id":    "Firm UUID if you already know it (overrides firm_gstin / firm_name).",
                    "firm_name":  "Firm name if GSTIN isn't visible. Fuzzy-matched, case-insensitive.",
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
    
    def get_tools_for_anthropic(self) -> List[Dict]:
        """Return tool definitions in Anthropic Messages API format.

        Maps each registered tool to {name, description, input_schema}. Most
        parameters are typed as `string` since the tool implementations are
        permissive (use **kwargs), but a few obvious cases are typed precisely.
        """
        # Per-tool input schemas — keyed by tool name. Anything not listed here
        # gets a default "all-strings, all-optional" schema (the tool itself
        # validates / coerces). This keeps the catalog easy to extend.
        precise_schemas: Dict[str, Dict] = {
            "search_party": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search term — name, phone, or GST number"},
                    "party_type": {"type": "string", "enum": ["customer", "supplier", "both"], "description": "Filter by party type"},
                },
                "required": ["query"],
            },
            "create_party": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "party_type": {"type": "string", "enum": ["customer", "supplier"]},
                    "phone": {"type": "string"}, "email": {"type": "string"},
                    "gst_number": {"type": "string"}, "address": {"type": "string"},
                    "tds_applicable": {"type": "boolean"},
                },
                "required": ["name", "party_type"],
            },
            "get_party_details": {
                "type": "object",
                "properties": {"party_id": {"type": "string"}},
                "required": ["party_id"],
            },
            "search_product": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Product name or SKU code"}},
                "required": ["query"],
            },
            "get_product_stock": {
                "type": "object",
                "properties": {"product_id": {"type": "string", "description": "Product ID or SKU"}},
                "required": ["product_id"],
            },
            "create_product": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "sku": {"type": "string"},
                    "category": {"type": "string"},
                    "hsn_code": {
                        "type": "string",
                        "description": "Mandatory HSN code (4–8 digits). Ask the user if unknown — do not invent."
                    },
                    "gst_rate": {
                        "type": "number",
                        "enum": [0, 5, 12, 18, 28],
                        "description": "Mandatory GST rate %. Most MuscleGrid items are 18 or 28 — confirm with user."
                    },
                    "unit": {"type": "string"},
                    "purchase_price": {"type": "number"},
                    "sale_price": {"type": "number"},
                },
                "required": ["name", "sku", "hsn_code", "gst_rate"],
            },
            "list_firms": {"type": "object", "properties": {}},
            "create_purchase": {
                "type": "object",
                "properties": {
                    "firm_gstin": {
                        "type": "string",
                        "description": "Buyer GSTIN exactly as printed on the invoice's bill-to / buyer block. Preferred way to pick the firm — GSTINs are unique."
                    },
                    "firm_id":   {"type": "string", "description": "Firm UUID (if you already know it)."},
                    "firm_name": {"type": "string", "description": "Firm name (fallback only — fuzzy-matched)."},
                    "supplier_id": {"type": "string"},
                    "invoice_number": {"type": "string"},
                    "invoice_date": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                    "items": {
                        "type": "array",
                        "description": (
                            "Line items from the invoice. Every line MUST include item_name and "
                            "quantity and rate — without item_name the line lands as 'Unknown' in "
                            "the Purchase Register. Include hsn_code and gst_rate when visible on "
                            "the invoice so the GST split is exact instead of defaulted."
                        ),
                        "items": {
                            "type": "object",
                            "properties": {
                                "item_name": {"type": "string", "description": "Product/material name as printed on the invoice (REQUIRED)."},
                                "hsn_code":  {"type": "string", "description": "HSN code from the invoice line (4–8 digits)."},
                                "quantity":  {"type": "number"},
                                "rate":      {"type": "number", "description": "Unit price (pre-GST)."},
                                "gst_rate":  {"type": "number", "enum": [0, 5, 12, 18, 28], "description": "GST % from the invoice line."},
                                "product_id": {"type": "string", "description": "Optional: master_skus / raw_materials UUID if already known."},
                            },
                            "required": ["item_name", "quantity", "rate"],
                        },
                    },
                    "total_amount": {"type": "number"},
                    "gst_amount": {"type": "number"},
                    "notes": {"type": "string"},
                },
                "required": ["supplier_id", "total_amount", "items"],
            },
            "get_recent_purchases": {
                "type": "object",
                "properties": {"limit": {"type": "number", "description": "Number of entries (default 10)"}},
            },
            "create_sale": {
                "type": "object",
                "properties": {
                    "customer_id": {"type": "string"},
                    "items": {"type": "array", "items": {"type": "object"}},
                    "total_amount": {"type": "number"},
                },
                "required": ["customer_id", "total_amount"],
            },
            "get_recent_sales": {
                "type": "object",
                "properties": {"limit": {"type": "number"}},
            },
            "get_pending_orders": {"type": "object", "properties": {}},
            "process_amazon_orders": {
                "type": "object",
                "properties": {"count": {"type": "number", "description": "Number of orders to process"}},
                "required": ["count"],
            },
            "get_daily_summary": {"type": "object", "properties": {}},
            "get_low_stock_items": {
                "type": "object",
                "properties": {"threshold": {"type": "number", "description": "Stock threshold (default 10)"}},
            },
            "get_outstanding_payments": {
                "type": "object",
                "properties": {"type": {"type": "string", "enum": ["receivable", "payable"]}},
                "required": ["type"],
            },
            "record_payment": {
                "type": "object",
                "properties": {
                    "party_id": {"type": "string"},
                    "amount": {"type": "number"},
                    "payment_type": {"type": "string", "enum": ["received", "made"]},
                    "payment_mode": {"type": "string", "description": "cash | bank | upi | cheque | other"},
                    "reference": {"type": "string"},
                },
                "required": ["party_id", "amount", "payment_type"],
            },
            "get_ledger_balance": {
                "type": "object",
                "properties": {"party_id": {"type": "string"}},
                "required": ["party_id"],
            },
            "extract_invoice_data": {
                "type": "object",
                "properties": {
                    "file_data": {"type": "string", "description": "Base64-encoded file"},
                    "file_type": {"type": "string", "description": "MIME type — application/pdf or image/jpeg etc."},
                },
                "required": ["file_data", "file_type"],
            },
            "analyze_document": {
                "type": "object",
                "properties": {
                    "file_data": {"type": "string", "description": "Base64-encoded file"},
                    "file_type": {"type": "string"},
                },
                "required": ["file_data", "file_type"],
            },
        }

        anthropic_tools = []
        for name, tool in self.tools.items():
            schema = precise_schemas.get(name)
            if not schema:
                # Fallback: best-effort from the legacy {param: str_description} dict
                params = tool.get("parameters", {})
                schema = {
                    "type": "object",
                    "properties": {k: {"type": "string", "description": v} for k, v in params.items()},
                }
            anthropic_tools.append({
                "name": name,
                "description": tool["description"],
                "input_schema": schema,
            })
        return anthropic_tools

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
        
        import uuid as _uuid
        # CRITICAL: rest of CRM looks up parties by `id` (UUID), not `_id`. Set both.
        gstin = gst_number or kwargs.get("gst", "") or kwargs.get("gstin", "")
        state = kwargs.get("state", "") or kwargs.get("supplier_state", "") or kwargs.get("customer_state", "")
        # If GSTIN provided and state missing, derive state from GST state code (first 2 chars)
        if gstin and not state:
            state = self._state_from_gstin(gstin[:2]) if hasattr(self, '_state_from_gstin') else ""
        party = {
            "id": str(_uuid.uuid4()),
            "name": party_name,
            "party_type": ptype,
            "phone": phone or kwargs.get("contact", "") or kwargs.get("mobile", ""),
            "email": email or kwargs.get("email_id", ""),
            "gst_number": gstin,
            "gstin": gstin,                       # both spellings — used by different modules
            "address": address or kwargs.get("addr", "") or kwargs.get("location", ""),
            "state": state,
            "tds_applicable": tds_applicable if isinstance(tds_applicable, bool) else str(tds_applicable).lower() == "true",
            "balance": 0,
            "source": "whatsapp_agent",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        result = await self.db.parties.insert_one(party)
        party["_id"] = str(result.inserted_id)
        return party

    @staticmethod
    def _state_from_gstin(state_code: str) -> str:
        """Map GST state code (first 2 chars) to state name. Indian Standard."""
        return {
            "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
            "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
            "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
            "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
            "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
            "16": "Tripura", "17": "Meghalaya", "18": "Assam",
            "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
            "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
            "25": "Daman and Diu", "26": "Dadra and Nagar Haveli",
            "27": "Maharashtra", "28": "Andhra Pradesh (Old)", "29": "Karnataka",
            "30": "Goa", "31": "Lakshadweep", "32": "Kerala",
            "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands",
            "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
        }.get(state_code, "")
    
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
                             sale_price: float = 0, hsn_code: str = "",
                             gst_rate: float = None, **kwargs) -> Dict:
        """Create a new product/SKU in master_skus.

        HSN and GST are mandatory for GSTR-3B compliance. If the LLM still tries
        to skip them, we refuse the write rather than silently inserting a
        non-compliant row the accountant will have to chase down later.
        """
        import uuid as _uuid

        hsn_code = (hsn_code or kwargs.get("hsn", "")).strip()
        if not hsn_code:
            return {"error": "hsn_code is required. Ask the user for the HSN code before creating the product."}
        if gst_rate is None:
            gst_rate = kwargs.get("gst")
        if gst_rate is None:
            return {"error": "gst_rate is required (one of 0, 5, 12, 18, 28). Ask the user before creating the product."}
        try:
            gst_rate = float(gst_rate)
        except (TypeError, ValueError):
            return {"error": f"gst_rate must be numeric (got {gst_rate!r})"}
        if gst_rate not in (0, 5, 12, 18, 28):
            return {"error": f"gst_rate {gst_rate} is not a valid Indian GST slab (0, 5, 12, 18, 28)"}

        cost_price = float(kwargs.get("cost_price") or purchase_price or 0)

        product = {
            "id": str(_uuid.uuid4()),
            "name": name,
            "sku_code": sku,                  # canonical field used across the CRM
            "sku": sku,                       # legacy alias for older callers
            "category": category,
            "unit": unit,
            "hsn_code": hsn_code,
            "gst_rate": gst_rate,
            "cost_price": cost_price,         # canonical field for WAC / valuation
            "purchase_price": float(purchase_price or cost_price),
            "sale_price": float(sale_price),
            "current_stock": 0,
            "is_active": True,
            "source": "whatsapp_agent",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        result = await self.db.master_skus.insert_one(product)
        product["_id"] = str(result.inserted_id)
        return product
    
    async def _create_purchase(self, supplier_id: str = "", invoice_number: str = "",
                              invoice_date: str = "", items: List[Dict] = None,
                              total_amount: float = 0, gst_amount: float = 0,
                              notes: str = "", firm_id: str = "",
                              firm_gstin: str = "", firm_name: str = "",
                              **kwargs) -> Dict:
        """Create a purchase entry that is fully populated to GSTR-compliance level.

        Produces the SAME shape that Accountant-module UI creates: id (UUID),
        purchase_number, firm denorms, supplier denorms, items with item_id +
        hsn_code + amount, is_inter_state, CGST/SGST/IGST split, doc_status.

        Marked `doc_status: "draft"` and `source: "whatsapp_agent"` so the
        accountant can review/finalize in the Finance → Purchases UI.
        """
        import uuid as _uuid
        import secrets

        # ---------- 1. Flexible parameter parsing ----------
        sup_id = supplier_id or kwargs.get("party_id", "") or kwargs.get("supplier_party_id", "")
        supplier_name = kwargs.get("supplier_name", "") or kwargs.get("vendor_name", "") or kwargs.get("party_name", "")
        inv_number = invoice_number or kwargs.get("bill_number", "") or kwargs.get("invoice_no", "")
        inv_date = invoice_date or kwargs.get("bill_date", "") or kwargs.get("date", "")
        item_list = items or kwargs.get("line_items", []) or kwargs.get("products", [])
        amount = float(total_amount or kwargs.get("amount", 0) or kwargs.get("grand_total", 0))
        gst_amt = float(gst_amount or kwargs.get("tax_amount", 0) or kwargs.get("gst", 0))

        # Firm hints — prefer GSTIN (exact + unique on a B2B invoice), then UUID,
        # then name (fuzzy). Track whether the LLM passed ANY hint so we can
        # distinguish "no info" (env default OK) from "told us wrong" (must error).
        f_id    = (firm_id    or kwargs.get("firm", "")).strip()
        f_gstin = (firm_gstin or kwargs.get("buyer_gstin", "") or kwargs.get("our_gstin", "")).strip().upper()
        f_name  = (firm_name  or kwargs.get("buyer_name", "")).strip()
        firm_hint_given = bool(f_id or f_gstin or f_name)

        # ---------- 2. Supplier resolution (find or create) ----------
        supplier_doc = None
        if sup_id:
            # Try lookup by UUID id first, then Mongo _id
            supplier_doc = await self.db.parties.find_one({"id": sup_id})
            if not supplier_doc:
                from bson import ObjectId
                try:
                    supplier_doc = await self.db.parties.find_one({"_id": ObjectId(sup_id)})
                except Exception:
                    supplier_doc = None
        if not supplier_doc and supplier_name:
            supplier_doc = await self.db.parties.find_one({
                "name": {"$regex": f"^{supplier_name}$", "$options": "i"},
                "party_type": "supplier",
            })
            if not supplier_doc:
                new_supplier = await self._create_party(
                    name=supplier_name,
                    party_type="supplier",
                    gst_number=kwargs.get("supplier_gst", "") or kwargs.get("gst_number", ""),
                    address=kwargs.get("supplier_address", "") or kwargs.get("address", ""),
                    phone=kwargs.get("supplier_phone", "") or kwargs.get("phone", ""),
                    state=kwargs.get("supplier_state", ""),
                )
                if "error" in new_supplier:
                    return {"error": f"Failed to create supplier: {new_supplier['error']}"}
                supplier_doc = new_supplier

        if not supplier_doc:
            return {"error": "Could not resolve supplier — pass supplier_id or supplier_name"}
        if not inv_number:
            return {"error": "Invoice number is required"}
        if not item_list:
            return {"error": "At least one item is required"}

        # Supplier denorms
        supplier_party_id = supplier_doc.get("id") or str(supplier_doc.get("_id"))
        supplier_name_final = supplier_doc.get("name", supplier_name)
        supplier_gstin = supplier_doc.get("gstin") or supplier_doc.get("gst_number", "")
        supplier_state = supplier_doc.get("state") or (
            self._state_from_gstin(supplier_gstin[:2]) if supplier_gstin else ""
        )

        # ---------- 3. Firm lookup + denorms ----------
        # Resolution order: GSTIN (exact) > UUID > name (case-insensitive, exact
        # then partial). If any hint was given but nothing matched, refuse —
        # the previous silent fallback caused us to book SPV Industries invoices
        # against MGIPL because no firm hint was ever passed. The env default is
        # only consulted when the LLM passed NOTHING at all.
        firm_doc = None
        resolution_warning = None

        if f_gstin:
            firm_doc = await self.db.firms.find_one(
                {"gstin": {"$regex": f"^{re.escape(f_gstin)}$", "$options": "i"}, "is_active": True},
                {"_id": 0},
            )
            if not firm_doc:
                return {"error": (
                    f"No active firm matches GSTIN {f_gstin}. "
                    f"Call list_firms to see available firms, or ask the user to confirm."
                )}
        if not firm_doc and f_id:
            firm_doc = await self.db.firms.find_one({"id": f_id, "is_active": True}, {"_id": 0})
            if not firm_doc:
                return {"error": f"No active firm with id={f_id}. Call list_firms."}
        if not firm_doc and f_name:
            firm_doc = await self.db.firms.find_one(
                {"name": {"$regex": f"^{re.escape(f_name)}$", "$options": "i"}, "is_active": True},
                {"_id": 0},
            )
            if not firm_doc:
                firm_doc = await self.db.firms.find_one(
                    {"name": {"$regex": re.escape(f_name), "$options": "i"}, "is_active": True},
                    {"_id": 0},
                )
            if not firm_doc:
                return {"error": (
                    f"No active firm name matches '{f_name}'. "
                    f"Call list_firms to see available firms."
                )}

        if not firm_doc:
            if firm_hint_given:
                # Defensive — earlier branches would have already returned.
                return {"error": "Could not resolve firm. Call list_firms and ask the user."}
            # No hint at all → fall back to the env default, but flag it loudly
            # so the LLM tells the user and the accountant sees it.
            default_id = os.environ.get("WHATSAPP_AGENT_DEFAULT_FIRM_ID", "")
            if default_id:
                firm_doc = await self.db.firms.find_one({"id": default_id, "is_active": True}, {"_id": 0})
                if firm_doc:
                    resolution_warning = (
                        f"No firm specified — used default '{firm_doc.get('name')}'. "
                        f"This may be wrong. Verify before finalizing."
                    )
            if not firm_doc:
                return {"error": (
                    "No firm specified and no usable default. "
                    "Call list_firms and ask the user which of our firms is the buyer."
                )}

        firm_denorms = {
            "firm_id":    firm_doc.get("id"),
            "firm_name":  firm_doc.get("name"),
            "firm_gstin": firm_doc.get("gstin"),
        }
        firm_state = firm_doc.get("state", "")

        # ---------- 4. Item enrichment ----------
        # Emit items in the canonical shape the accountant UI reads/edits:
        # item_type, item_id, item_name, sku_code, hsn_code, quantity, rate,
        # gst_rate, taxable_value, igst, cgst, sgst, total. item_type is
        # determined by which collection actually holds the SKU (raw_materials
        # vs master_skus) — hard-coding "raw_material" breaks the canonical
        # update_purchase lookup when the item lives in master_skus.
        is_inter_state = bool(firm_state and supplier_state and firm_state.strip().lower() != supplier_state.strip().lower())

        processed_items = []
        unresolved_names = []
        for it in item_list:
            # Accept the canonical `item_name` (what the tool schema now asks
            # the LLM to send) AND every other name-ish field we've seen the
            # model emit. Falling back to "Unknown" silently is what caused
            # the Aggarwal Transformers / Gera Foam purchases to land
            # nameless — never default; flag the line instead.
            it_name = (
                it.get("item_name")
                or it.get("name")
                or it.get("product_name")
                or it.get("description")
                or it.get("title")
                or ""
            ).strip()
            qty = float(it.get("quantity") or it.get("qty") or 1)
            rate = float(it.get("rate") or it.get("price") or it.get("unit_price") or it.get("purchase_price") or 0)

            # Resolve the item in raw_materials first, then master_skus.
            item_doc = None
            item_type = "raw_material"
            if it_name:
                item_doc = await self.db.raw_materials.find_one(
                    {"name": {"$regex": f"^{re.escape(it_name)}$", "$options": "i"}}
                )
                if not item_doc:
                    item_doc = await self.db.master_skus.find_one(
                        {"name": {"$regex": f"^{re.escape(it_name)}$", "$options": "i"}}
                    )
                    if item_doc:
                        item_type = "master_sku"

            # Per-line GST. Prefer explicit rate on input, then master doc, then 18%.
            gst_rate = it.get("gst_rate")
            if gst_rate is None:
                gst_rate = (item_doc or {}).get("gst_rate", 18)
            gst_rate = float(gst_rate)

            taxable_value = round(qty * rate, 2)
            line_gst = round(taxable_value * gst_rate / 100, 2)
            line_igst = line_gst if is_inter_state else 0
            line_cgst = 0 if is_inter_state else round(line_gst / 2, 2)
            line_sgst = 0 if is_inter_state else round(line_gst / 2, 2)
            line_total = round(taxable_value + line_gst, 2)

            resolved_name = (item_doc or {}).get("name") or it_name
            if not resolved_name:
                # Truly nothing — keep going so the GST math still produces
                # numbers, but record the line for the response warning so
                # the LLM tells the user instead of saving 'Unknown'.
                resolved_name = "Unknown"
                unresolved_names.append(f"line {len(processed_items) + 1}")
            # Prefer the HSN passed in by the LLM (read off the invoice line);
            # fall back to the master SKU's HSN. Same for sku_code.
            hsn = (it.get("hsn_code") or "").strip() or (item_doc or {}).get("hsn_code", "")
            sku = (it.get("sku_code") or it.get("sku") or "").strip() or (item_doc or {}).get("sku_code") or (item_doc or {}).get("sku", "")
            processed_items.append({
                "item_type": item_type,
                "item_id": (item_doc or {}).get("id") or (str(item_doc["_id"]) if item_doc else None),
                "item_name": resolved_name,
                "sku_code": sku,
                "hsn_code": hsn,
                "quantity": qty,
                "rate": rate,
                "gst_rate": gst_rate,
                "taxable_value": taxable_value,
                "igst": line_igst,
                "cgst": line_cgst,
                "sgst": line_sgst,
                "total": line_total,
            })

        # ---------- 5. GST totals (summed from per-line, not from a freeform input) ----------
        total_taxable = round(sum(p["taxable_value"] for p in processed_items), 2)
        total_igst = round(sum(p["igst"] for p in processed_items), 2)
        total_cgst = round(sum(p["cgst"] for p in processed_items), 2)
        total_sgst = round(sum(p["sgst"] for p in processed_items), 2)
        total_gst = round(total_igst + total_cgst + total_sgst, 2)
        # If caller passed an explicit gst_amount and our per-line math disagrees,
        # trust the per-line math — it's GSTR-3B compliant; the freeform amount isn't.

        # ---------- 6. Build the final doc ----------
        now_iso = datetime.now(timezone.utc).isoformat()
        purchase_id = str(_uuid.uuid4())
        date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
        purchase_number = f"PUR-{date_part}-{secrets.token_hex(3).upper()[:5]}"

        purchase = {
            "id": purchase_id,
            "purchase_number": purchase_number,
            **firm_denorms,                  # firm_id, firm_name, firm_gstin
            "supplier_party_id": supplier_party_id,
            "supplier_id": supplier_party_id,    # legacy alias for the agent tool
            "supplier_name": supplier_name_final,
            "supplier_gstin": supplier_gstin,
            "supplier_state": supplier_state,
            "invoice_number": inv_number,
            "invoice_date": inv_date,
            "items": processed_items,
            "is_inter_state": is_inter_state,
            "total_taxable": total_taxable,
            "total_gst": total_gst,
            "total_cgst": total_cgst,
            "total_sgst": total_sgst,
            "total_igst": total_igst,
            "totals": {
                "grand_total": round(total_taxable + total_gst, 2),
                "taxable_value": total_taxable,
                "total_gst": total_gst,
            },
            "total_amount": round(total_taxable + total_gst, 2),
            "gst_amount": total_gst,
            "amount_paid": 0,
            "balance_due": round(total_taxable + total_gst, 2),
            "payment_status": "unpaid",
            "notes": notes,
            "doc_status": "draft",            # → accountant must finalize
            "status": "draft",
            "source": "whatsapp_agent",
            "pending_review": True,
            "compliance_score": 0,
            "compliance_issues": [
                issue for issue in [
                    resolution_warning,
                    (f"{len(unresolved_names)} line(s) had no item_name — saved as 'Unknown' "
                     f"({', '.join(unresolved_names)}). Re-read the invoice and re-send those lines.")
                    if unresolved_names else None,
                    "Created by WhatsApp agent — needs accountant review.",
                    "Verify supplier GSTIN, item HSN codes, and totals before finalizing.",
                ] if issue
            ],
            "created_by": "whatsapp_agent",
            "created_by_name": "WhatsApp Agent",
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        try:
            result = await self.db.purchases.insert_one(purchase)
            purchase["_id"] = str(result.inserted_id)
            if resolution_warning:
                # Surface the warning at the top level so the LLM relays it to the user
                # instead of celebrating a wrongly-firmed purchase.
                purchase["_firm_warning"] = resolution_warning
            if unresolved_names:
                purchase["_items_warning"] = (
                    f"{len(unresolved_names)} line(s) saved as 'Unknown' — "
                    f"the input items had no item_name field. Tell the user which "
                    f"lines need re-reading and offer to update them."
                )
            return purchase
        except Exception as e:
            return {"error": f"Failed to create purchase: {str(e)}"}

    async def _list_firms(self, **kwargs) -> Dict:
        """Return our active firms so the LLM can match buyer GSTIN/name to firm_id."""
        cursor = self.db.firms.find(
            {"is_active": True},
            {"_id": 0, "id": 1, "name": 1, "gstin": 1, "state": 1, "short_name": 1},
        ).sort("name", 1)
        firms = await cursor.to_list(50)
        return {"firms": firms, "count": len(firms)}
    
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
            import uuid as _uuid
            now_iso = datetime.now(timezone.utc).isoformat()
            sale = {
                "id": str(_uuid.uuid4()),
                "customer_id": str(cust_id),
                "customer_party_id": str(cust_id),
                "items": item_list,
                "total_amount": float(amount),
                "doc_status": "draft",
                "status": "draft",
                "source": "whatsapp_agent",
                "pending_review": True,
                "compliance_score": 0,
                "compliance_issues": ["Created by WhatsApp agent — needs accountant review."],
                "created_by": "whatsapp_agent",
                "created_by_name": "WhatsApp Agent",
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            result = await self.db.sales.insert_one(sale)
            sale["_id"] = str(result.inserted_id)
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
        """Extract structured JSON from invoices, manuals, contracts via Claude vision.

        Claude accepts PDFs natively (no per-page rasterization needed) and images
        directly. This is a much simpler pipeline than the GPT-4-Vision-with-PyMuPDF
        approach we used to have.
        """
        # Resolve flexible parameter names
        data = file_data or kwargs.get("data", "") or kwargs.get("image_data", "")
        ftype = (file_type or kwargs.get("type", "") or kwargs.get("mime_type", "image")).lower()
        if not data:
            return {"error": "No file data provided", "extraction_success": False}

        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            return {"error": "ANTHROPIC_API_KEY not set", "extraction_success": False}

        try:
            import anthropic
        except ImportError:
            return {"error": "anthropic package not installed", "extraction_success": False}

        try:
            file_bytes = base64.b64decode(data)
        except Exception as e:
            return {"error": f"Invalid base64 data: {e}", "extraction_success": False}

        # Classify: PDF vs image
        is_pdf = (
            file_bytes[:4] == b"%PDF"
            or "pdf" in ftype
            or ftype == "document"
        )
        if is_pdf:
            source = {
                "type": "base64",
                "media_type": "application/pdf",
                "data": base64.b64encode(file_bytes).decode("ascii"),
            }
            content_type = "document"
        else:
            # Pick image mime
            if "/" in ftype:
                mime = ftype
            elif ftype in ("png",):
                mime = "image/png"
            elif ftype in ("webp",):
                mime = "image/webp"
            elif ftype in ("gif",):
                mime = "image/gif"
            else:
                mime = "image/jpeg"
            source = {
                "type": "base64",
                "media_type": mime,
                "data": base64.b64encode(file_bytes).decode("ascii"),
            }
            content_type = "image"

        extraction_prompt = """Analyze this document and extract ALL relevant information as a single JSON object.

Pick the most appropriate shape based on what the document is:

For INVOICES/BILLS:
{
  "document_type": "invoice",
  "supplier_name": "", "supplier_address": "", "supplier_gst": "", "supplier_phone": "",
  "invoice_number": "", "invoice_date": "", "due_date": "",
  "buyer_name": "", "buyer_address": "", "buyer_gstin": "", "buyer_state": "",
  "items": [{"name": "", "description": "", "quantity": 0, "unit": "", "hsn_code": "", "rate": 0, "amount": 0, "gst_rate": 0}],
  "subtotal": 0, "gst_amount": 0, "cgst": 0, "sgst": 0, "igst": 0, "total_amount": 0,
  "payment_terms": "", "bank_details": ""
}

CRITICAL for B2B GST invoices: the buyer's GSTIN is usually in the "Bill To" / "Buyer"
block (sometimes labelled "Consignee GSTIN" or "Receiver GSTIN"). It is a 15-character
alphanumeric like "07AATCM1213F1ZM". Extract it verbatim — uppercase, no spaces. This
is how downstream code identifies which of OUR firms is buying. Do NOT confuse it with
the supplier's GSTIN.

For USER MANUALS / TECHNICAL DOCS:
{
  "document_type": "manual",
  "product_name": "", "model_number": "", "manufacturer": "",
  "specifications": {}, "key_features": [], "safety_warnings": [],
  "installation_steps": [], "troubleshooting": [], "warranty_info": ""
}

For OTHER DOCUMENTS:
{
  "document_type": "other", "title": "", "content_summary": "",
  "key_points": [], "tables": [], "important_data": {}
}

Be comprehensive — capture every visible field. Return ONLY the JSON object (no prose, no markdown code fences)."""

        try:
            client = anthropic.AsyncAnthropic(api_key=api_key)
            model = os.environ.get("WHATSAPP_AGENT_MODEL", "claude-sonnet-4-6")
            response = await client.messages.create(
                model=model,
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": content_type, "source": source},
                        {"type": "text", "text": extraction_prompt},
                    ],
                }],
            )
            response_text = "".join(b.text for b in response.content if b.type == "text").strip()
            logger.info(f"Claude vision returned {len(response_text)} chars")

            # Parse JSON (be forgiving — the model may wrap in fences despite the instruction)
            json_match = re.search(r"\{[\s\S]*\}", response_text)
            if json_match:
                try:
                    parsed = json.loads(json_match.group())
                    parsed["extraction_success"] = True
                    parsed["pages_processed"] = 1   # Claude handles multi-page PDFs as one document
                    return parsed
                except json.JSONDecodeError:
                    pass
            return {
                "extraction_success": True,
                "raw_text": response_text,
                "pages_processed": 1,
            }
        except Exception as e:
            logger.error(f"Claude document extraction failed: {e}")
            return {"error": str(e), "extraction_success": False}

    async def _extract_invoice_data_legacy_unused(self, file_data: str = "", file_type: str = "", **kwargs) -> Dict:
        """Legacy GPT-4-Vision-based extractor — kept as a reference, not invoked.

        Left in the file deliberately so the historical approach (PyMuPDF rasterization
        + per-page GPT-4 vision) is recoverable if Claude is ever unavailable.
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
    """The AI brain — Claude (Anthropic) with native tool use + vision.

    Architecture (post-Anthropic refactor):
    - Loads conversation history from MongoDB (last 15 user/assistant turns)
    - Embeds incoming images / PDFs directly in the user message (no separate
      pre-extraction step — Claude reads them natively)
    - Drives a proper tool-use loop using Anthropic's structured content blocks
      (no fragile TOOL_CALL: text parsing)
    - Auth-gated by a secret code (see SECRET_CODE below)
    """

    SECRET_CODE = "Rony846"
    MAX_TOOL_ITERATIONS = 5  # Anthropic tool use is reliable; we give some headroom
    DEFAULT_MODEL = "claude-sonnet-4-6"
    MAX_OUTPUT_TOKENS = 2048
    MAX_TOOL_RESULT_CHARS = 8000   # truncate giant tool results before sending back
    # Sentinel returned by process_message when the sender is NOT on the
    # whitelist — the calling /api/whatsapp/message endpoint should NOT send
    # any reply when it sees this (silent drop).
    SILENT_DROP = "__SILENT_DROP__"

    def __init__(self, db: AsyncIOMotorDatabase, send_message_callback: Callable):
        self.db = db
        self.send_message = send_message_callback
        self.tools = CRMToolRegistry(db)
        self.conversations: Dict[str, ConversationContext] = {}
        self.model = os.environ.get("WHATSAPP_AGENT_MODEL", self.DEFAULT_MODEL)
        self._client = None  # lazy-init so missing key doesn't break import
        # Whitelist of senders allowed to chat with the agent (defense-in-depth
        # — the bridge already drops disallowed senders before they reach us).
        allowlist_raw = os.environ.get("WHATSAPP_AGENT_ALLOWLIST", "")
        self.allowlist = {
            ''.join(c for c in s if c.isdigit())
            for s in allowlist_raw.split(",")
            if len(''.join(c for c in s if c.isdigit())) >= 10
        }
        if self.allowlist:
            logger.info(f"WhatsApp agent allowlist: {len(self.allowlist)} sender(s)")
        else:
            logger.warning("WhatsApp agent allowlist is EMPTY — no one can chat with the agent")

    def _sender_digits(self, from_number: str) -> str:
        """Strip @c.us / @lid suffix and non-digits — returns the digit-only
        identifier we compare against the allowlist."""
        if not from_number:
            return ""
        head = str(from_number).split("@")[0]
        return "".join(c for c in head if c.isdigit())

    def _is_allowed(self, from_number: str) -> bool:
        digits = self._sender_digits(from_number)
        return bool(digits) and digits in self.allowlist

    # ----- client + history -----

    def _get_client(self):
        """Lazy-init the Anthropic client. Raises a friendly error if key missing."""
        if self._client is not None:
            return self._client
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY not set. Add an Anthropic API key to backend/.env "
                "(get one at https://console.anthropic.com)."
            )
        try:
            import anthropic
        except ImportError:
            raise RuntimeError("`anthropic` package not installed — run `pip install anthropic`.")
        self._client = anthropic.AsyncAnthropic(api_key=api_key)
        return self._client

    async def get_or_create_context(self, user_number: str) -> ConversationContext:
        """Get or create conversation context for a user — loads from DB if exists."""
        if user_number in self.conversations:
            return self.conversations[user_number]
        db_conv = await self.db.whatsapp_conversations.find_one({"user_number": user_number})
        if db_conv:
            context = ConversationContext(
                user_number=user_number,
                messages=db_conv.get("messages", []),
                current_task=db_conv.get("current_task"),
                pending_questions=db_conv.get("pending_questions", []),
                extracted_data=db_conv.get("extracted_data", {}),
                last_activity=db_conv.get("last_activity", ""),
                is_authenticated=db_conv.get("is_authenticated", False),
            )
            logger.info(f"Loaded conversation for {user_number} with {len(context.messages)} messages, auth={context.is_authenticated}")
        else:
            context = ConversationContext(user_number=user_number)
            logger.info(f"Created new conversation for {user_number}")
        self.conversations[user_number] = context
        return context

    # ----- message processing -----

    async def process_message(self, message: WhatsAppMessage) -> str:
        """Entry point — whitelist gate + dispatch to Claude with tool use.

        Returns `self.SILENT_DROP` if the sender is not on the allowlist. The
        caller (the /api/whatsapp/message endpoint) MUST check for this sentinel
        and NOT send any reply back — no auth prompt, no error message, nothing.
        """
        # ===== WHITELIST GATE (defense-in-depth — bridge already filters) =====
        if not self._is_allowed(message.from_number):
            logger.info(f"[whitelist] drop: {message.from_number}")
            return self.SILENT_DROP

        context = await self.get_or_create_context(message.from_number)
        user_text = (message.text or "").strip()

        # ---- Allow-listed senders are auto-authenticated on first message ----
        # The Rony846 code is preserved as a fallback for any sender we explicitly
        # allow but want to gate further (currently unused), but for the normal
        # case (Ramesh's own number) we skip the code prompt entirely.
        if not context.is_authenticated:
            context.is_authenticated = True
            context.add_message("system", f"[AUTO-AUTH whitelist sender {self._sender_digits(message.from_number)}]")
            await self._save_conversation(context)

        # ---- Authenticated — drive Claude ----
        try:
            client = self._get_client()
        except RuntimeError as e:
            logger.error(str(e))
            return "⚠️ AI assistant is not configured. Please ask the admin to set ANTHROPIC_API_KEY."

        # Build the current user turn: text + optional image/PDF content block
        user_content_blocks = self._build_user_content(message)

        # Tell user we're looking at the doc (long-running)
        if message.has_media and message.media_data:
            try:
                await self.send_message(
                    message.from_number,
                    "📄 Got your file — analyzing now…",
                )
            except Exception:
                pass

        # Conversation history (last 15 user/assistant turns) → Anthropic format
        messages = self._build_anthropic_history(context)
        messages.append({"role": "user", "content": user_content_blocks})

        # Record what the user said in our local history (text-only — full media is one-shot)
        context.add_message("user", user_text if user_text else "[Sent media]")

        # Run the tool-use loop
        try:
            final_text = await self._run_tool_loop(client, messages, context)
        except Exception as e:
            error_str = str(e).lower()
            logger.error(f"Anthropic processing error: {e}")
            import traceback
            traceback.print_exc()
            if "credit" in error_str or "balance" in error_str or "billing" in error_str:
                return (
                    "⚠️ *AI Service Temporarily Unavailable*\n\n"
                    "The Anthropic API balance has been reached. Please ask your admin to top up the balance at console.anthropic.com."
                )
            if "rate limit" in error_str or "429" in error_str:
                return "⏳ I'm getting a lot of requests — please try again in a few seconds."
            if "invalid" in error_str and "key" in error_str:
                return "⚠️ The Anthropic API key looks invalid. Please ask your admin to check it."
            return "Sorry, I hit an issue. Please try again or rephrase your request."

        # Persist
        context.add_message("assistant", final_text)
        await self._save_conversation(context)
        return final_text

    async def _run_tool_loop(self, client, messages: List[Dict], context: ConversationContext) -> str:
        """Drive Claude's tool-use loop until it returns a final text response."""
        system_prompt = self._build_system_prompt(context)
        tools_schema = self.tools.get_tools_for_anthropic()

        for iteration in range(self.MAX_TOOL_ITERATIONS):
            logger.info(f"Claude iteration {iteration + 1}/{self.MAX_TOOL_ITERATIONS}")
            response = await client.messages.create(
                model=self.model,
                max_tokens=self.MAX_OUTPUT_TOKENS,
                system=system_prompt,
                tools=tools_schema,
                messages=messages,
            )

            if response.stop_reason != "tool_use":
                # Final response — concatenate any text blocks
                final_text = "".join(
                    block.text for block in response.content if block.type == "text"
                ).strip()
                if not final_text:
                    final_text = "I've handled that. Anything else?"
                return final_text

            # tool_use — append the assistant's full content (incl. tool_use blocks)
            # NOTE: Anthropic requires the assistant message to be passed back verbatim
            # so the model can correlate tool_use_id → tool_result.
            assistant_content_for_history = []
            tool_use_blocks = []
            for block in response.content:
                if block.type == "text":
                    assistant_content_for_history.append({"type": "text", "text": block.text})
                elif block.type == "tool_use":
                    assistant_content_for_history.append({
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": block.input,
                    })
                    tool_use_blocks.append(block)
            messages.append({"role": "assistant", "content": assistant_content_for_history})

            # Execute each requested tool and collect tool_result blocks
            tool_results = []
            for tu in tool_use_blocks:
                logger.info(f"Tool call: {tu.name} input_keys={list(tu.input.keys())}")
                try:
                    result = await self.tools.execute_tool(tu.name, tu.input)
                except Exception as e:
                    result = {"success": False, "error": str(e)}
                # Serialize + cap size so we don't blow context
                payload = json.dumps(result, default=str)
                if len(payload) > self.MAX_TOOL_RESULT_CHARS:
                    payload = payload[: self.MAX_TOOL_RESULT_CHARS] + "…[truncated]"
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": payload,
                    "is_error": not result.get("success", False),
                })
                # Also record in our internal context for memory
                context.add_message("system", f"[{tu.name}] {payload[:300]}")

            messages.append({"role": "user", "content": tool_results})

        # Hit iteration cap
        return (
            "I needed several steps to handle that and ran into my safety limit. "
            "Could you rephrase it more directly, or break it into smaller asks?"
        )

    # ----- content construction -----

    def _build_user_content(self, message: WhatsAppMessage) -> List[Dict]:
        """Construct the multi-block user message content (text + optional media)."""
        blocks: List[Dict] = []
        if message.has_media and message.media_data:
            media_type = (message.media_type or "").lower()
            data_b64 = base64.b64encode(message.media_data).decode("ascii")
            # Sniff PDF magic if media_type is generic
            is_pdf = (
                media_type in {"document", "pdf", "application/pdf"}
                or message.media_data[:4] == b"%PDF"
            )
            if is_pdf:
                blocks.append({
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": data_b64,
                    },
                })
            else:
                # Default to image. Pick a reasonable media type.
                mime = "image/jpeg"
                if media_type.startswith("image/"):
                    mime = media_type
                elif media_type in {"png", "jpeg", "jpg", "webp"}:
                    mime = "image/png" if media_type == "png" else "image/jpeg"
                blocks.append({
                    "type": "image",
                    "source": {"type": "base64", "media_type": mime, "data": data_b64},
                })
        # Always end with the text turn (even if empty, Claude needs something)
        text = (message.text or "").strip() or "(no text — file attached)"
        blocks.append({"type": "text", "text": text})
        return blocks

    def _build_anthropic_history(self, context: ConversationContext) -> List[Dict]:
        """Convert our internal history → Anthropic messages list (last 15 turns,
        user+assistant only). System messages are internal-only, not sent to Claude."""
        messages = []
        for msg in context.messages[-15:]:
            role = msg.get("role")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": [{"type": "text", "text": str(content)}]})
        # Drop trailing user message if present — we'll append the fresh one
        if messages and messages[-1]["role"] == "user":
            messages.pop()
        return messages

    def _build_system_prompt(self, context: ConversationContext) -> str:
        return f"""You are an intelligent WhatsApp assistant for MuscleGrid CRM. You help the user manage all business operations through natural conversation.

You have access to {len(self.tools.tools)} CRM tools that you can call directly via Anthropic's tool-use API. Use them whenever the user asks about CRM data or wants to make a change — do not invent data.

## What you can do
- Manage parties (customers/suppliers), products & inventory
- Create purchase + sale entries, record payments
- Pull daily summaries, outstanding payments, low-stock items
- Process Amazon orders
- Analyze any invoice / manual / contract / image the user sends (they appear directly in your context — read them and respond)

## Conversation style
- This is WhatsApp — be friendly, brief, conversational.
- Use emojis sparingly but appropriately (✅, ⚠️, 📊, 📄).
- Ask clarifying questions when key information is missing instead of guessing.
- When creating entries (purchases, sales, parties), confirm key details before committing.
- After running a tool, summarize the result in plain language — do NOT dump raw JSON unless the user explicitly asks for it.
- If a search returns no results, say so plainly and offer next steps.

## Document handling
When the user sends an image or PDF, it's already in your context. Look at it directly, summarize what you found, and propose next actions. Use `extract_invoice_data` only if the user wants structured JSON output.

## Booking a purchase from an invoice
We run MULTIPLE legal firms (MGIPL, SPV Industries, Electronics Bay, EBAY UP, MuscleGrid Industries Gurgaon, …). On a B2B GST invoice, the BUYER block tells you which of OUR firms the bill belongs to.

Mandatory checklist before calling `create_purchase`:
1. Read the buyer GSTIN from the invoice's "Bill To" / "Buyer" / "Consignee" block (15 chars, e.g. `09BPRPR2164D1ZK`). Pass it as `firm_gstin`.
2. If the buyer GSTIN isn't visible, call `list_firms` and ask the user which firm to use — do NOT guess and do NOT let the system pick a default.
3. Confirm firm + supplier + total back to the user in one short message before committing.

Picking the wrong firm corrupts GSTR-3B and is much harder to undo than asking one extra question.

## Current internal context
- Current task: {context.current_task or 'None'}
- Pending questions: {context.pending_questions or 'None'}
- Recently extracted data: {json.dumps(context.extracted_data, default=str)[:800] if context.extracted_data else 'None'}

Remember: you're chatting, not filling a form."""

    async def _save_conversation(self, context: ConversationContext):
        """Persist conversation state to MongoDB."""
        await self.db.whatsapp_conversations.update_one(
            {"user_number": context.user_number},
            {"$set": context.to_dict()},
            upsert=True,
        )

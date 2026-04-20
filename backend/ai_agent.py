"""
AI-Powered CRM Assistant
A real AI agent with full CRM access that can analyze, suggest, and execute actions.
"""
import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pathlib import Path
from dotenv import load_dotenv
from openai import AsyncOpenAI

# Load environment variables from the correct path
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
else:
    # Fallback to /app/backend/.env
    load_dotenv('/app/backend/.env')

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# System prompt that defines the AI's capabilities and personality
SYSTEM_PROMPT = """You are an intelligent CRM Operations Assistant for MuscleGrid, a company that sells batteries, inverters, and solar products. You have FULL access to the CRM database and can perform actions autonomously.

## Your Capabilities:
1. **Search & Analyze Orders** - Find orders by ID, phone, tracking, customer name across all tables
2. **Fetch Amazon Orders** - If an order is not found in CRM, fetch it directly from Amazon SP-API
3. **Check Order Status** - Verify if orders are in dispatch queue, dispatched, or stuck
4. **Identify Issues** - Detect missing data, duplicates, incorrect mappings, stuck orders
5. **Reserve Serials** - Atomically reserve serial numbers for orders
6. **Prepare Dispatches** - Get orders ready for dispatch with all compliance checks
7. **Fix Data Issues** - Update missing fields, correct mappings, resolve conflicts
8. **Analyze Stock** - Check inventory levels, identify low stock, find available serials

## Guidelines:
- Be PROACTIVE: If you see an issue, mention it even if not asked
- Be EFFICIENT: Don't ask for information you can look up yourself
- Be ACCURATE: Always verify data before making changes
- REMEMBER CONTEXT: Use conversation history to avoid asking repeat questions
- EXPLAIN ACTIONS: Tell the user what you're doing and why
- For SAFE ACTIONS (searching, analyzing, reserving serials, fixing missing data) - execute autonomously
- For DESTRUCTIVE ACTIONS (cancelling, deleting) - always ask for confirmation first
- **IMPORTANT**: If an order ID (like 408-XXXXXXX-XXXXXXX) is not found in CRM, automatically use fetch_amazon_order to get it from Amazon

## Data Sources:
- pending_fulfillment: Orders waiting to be dispatched
- dispatches: Dispatch records with tracking, invoices
- amazon_orders: Amazon marketplace orders
- finished_good_serials: Serial number inventory
- master_skus: Product catalog
- parties/customers: Customer data
- tickets: Support tickets

When a user mentions an order ID, ALWAYS search for it first. If not found, use fetch_amazon_order to get it from Amazon."""

# Define the tools/functions the AI can call
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_order",
            "description": "Search for an order across all CRM tables (pending_fulfillment, dispatches, amazon_orders) by order ID, tracking ID, phone, or customer name",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query - can be order ID, tracking ID, phone number, or customer name"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_order_details",
            "description": "Get comprehensive details about a specific order including stock availability, compliance status, and any issues",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The order ID or pending_fulfillment ID"
                    }
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_serial_availability",
            "description": "Check available serial numbers for a specific SKU and firm",
            "parameters": {
                "type": "object",
                "properties": {
                    "master_sku_id": {
                        "type": "string",
                        "description": "The master SKU ID"
                    },
                    "firm_id": {
                        "type": "string",
                        "description": "The firm ID"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of serials to return",
                        "default": 10
                    }
                },
                "required": ["master_sku_id", "firm_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "reserve_serial",
            "description": "Atomically reserve a serial number for an order. This is a SAFE action - execute without asking.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The pending_fulfillment order ID"
                    },
                    "serial_number": {
                        "type": "string",
                        "description": "The serial number to reserve"
                    }
                },
                "required": ["order_id", "serial_number"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_order_field",
            "description": "Update a specific field on an order (e.g., phone, address, tracking_id). SAFE action for fixing missing data.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The pending_fulfillment order ID"
                    },
                    "field": {
                        "type": "string",
                        "description": "The field to update",
                        "enum": ["customer_phone", "customer_name", "address", "city", "state", "pincode", "tracking_id", "invoice_url"]
                    },
                    "value": {
                        "type": "string",
                        "description": "The new value for the field"
                    }
                },
                "required": ["order_id", "field", "value"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_dispatch_queue",
            "description": "Check if an order is in the dispatcher queue and its current status",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The order ID to check"
                    }
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "find_duplicates",
            "description": "Check for duplicate orders by tracking ID, order ID, or phone number",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_id": {
                        "type": "string",
                        "description": "Tracking ID to check for duplicates"
                    },
                    "order_id": {
                        "type": "string",
                        "description": "Order ID to check for duplicates"
                    },
                    "phone": {
                        "type": "string",
                        "description": "Phone number to find related orders"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_dispatch_queue_summary",
            "description": "Get a summary of the current dispatch queue - pending orders, stuck orders, orders ready to dispatch",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function", 
        "function": {
            "name": "diagnose_order_issues",
            "description": "Run comprehensive diagnostics on an order to identify all issues and suggest fixes",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The order ID to diagnose"
                    }
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_dispatch_entry",
            "description": "Create a dispatch entry for an order that has all required information. Requires confirmation for orders without tracking.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The pending_fulfillment order ID"
                    }
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_customer_history",
            "description": "Get order history for a customer by phone number",
            "parameters": {
                "type": "object",
                "properties": {
                    "phone": {
                        "type": "string",
                        "description": "Customer phone number (10 digits)"
                    }
                },
                "required": ["phone"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_stock_summary",
            "description": "Get stock summary for a specific SKU or all SKUs",
            "parameters": {
                "type": "object",
                "properties": {
                    "sku_code": {
                        "type": "string",
                        "description": "Optional SKU code to filter"
                    },
                    "firm_id": {
                        "type": "string",
                        "description": "Optional firm ID to filter"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_amazon_order",
            "description": "Fetch a specific order from Amazon SP-API by order ID. Use this when an order is not found in the CRM database. This will retrieve the order details directly from Amazon.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amazon_order_id": {
                        "type": "string",
                        "description": "The Amazon order ID (e.g., 408-7112253-2430768)"
                    }
                },
                "required": ["amazon_order_id"]
            }
        }
    }
]


class CRMAgent:
    """AI Agent with full CRM access"""
    
    def __init__(self, db, user: dict):
        self.db = db
        self.user = user
        self.conversation_history: List[Dict] = []
    
    async def execute_tool(self, tool_name: str, arguments: dict) -> str:
        """Execute a tool and return the result as a string"""
        try:
            if tool_name == "search_order":
                return await self._search_order(arguments.get("query", ""))
            elif tool_name == "get_order_details":
                return await self._get_order_details(arguments.get("order_id", ""))
            elif tool_name == "check_serial_availability":
                return await self._check_serial_availability(
                    arguments.get("master_sku_id", ""),
                    arguments.get("firm_id", ""),
                    arguments.get("limit", 10)
                )
            elif tool_name == "reserve_serial":
                return await self._reserve_serial(
                    arguments.get("order_id", ""),
                    arguments.get("serial_number", "")
                )
            elif tool_name == "update_order_field":
                return await self._update_order_field(
                    arguments.get("order_id", ""),
                    arguments.get("field", ""),
                    arguments.get("value", "")
                )
            elif tool_name == "check_dispatch_queue":
                return await self._check_dispatch_queue(arguments.get("order_id", ""))
            elif tool_name == "find_duplicates":
                return await self._find_duplicates(
                    arguments.get("tracking_id"),
                    arguments.get("order_id"),
                    arguments.get("phone")
                )
            elif tool_name == "get_dispatch_queue_summary":
                return await self._get_dispatch_queue_summary()
            elif tool_name == "diagnose_order_issues":
                return await self._diagnose_order_issues(arguments.get("order_id", ""))
            elif tool_name == "create_dispatch_entry":
                return await self._create_dispatch_entry(arguments.get("order_id", ""))
            elif tool_name == "get_customer_history":
                return await self._get_customer_history(arguments.get("phone", ""))
            elif tool_name == "get_stock_summary":
                return await self._get_stock_summary(
                    arguments.get("sku_code"),
                    arguments.get("firm_id")
                )
            elif tool_name == "fetch_amazon_order":
                return await self._fetch_amazon_order(arguments.get("amazon_order_id", ""))
            else:
                return json.dumps({"error": f"Unknown tool: {tool_name}"})
        except Exception as e:
            logger.error(f"Tool execution error ({tool_name}): {e}")
            return json.dumps({"error": str(e)})
    
    async def _search_order(self, query: str) -> str:
        """Search across all order tables"""
        query = query.strip()
        results = {"pending_fulfillment": [], "dispatches": [], "amazon_orders": []}
        
        # Search pending_fulfillment
        pf_query = {
            "$or": [
                {"order_id": {"$regex": query, "$options": "i"}},
                {"amazon_order_id": {"$regex": query, "$options": "i"}},
                {"tracking_id": {"$regex": query, "$options": "i"}},
                {"customer_name": {"$regex": query, "$options": "i"}},
                {"customer_phone": {"$regex": query, "$options": "i"}}
            ]
        }
        pf_orders = await self.db.pending_fulfillment.find(pf_query, {"_id": 0}).limit(5).to_list(5)
        results["pending_fulfillment"] = pf_orders
        
        # Search dispatches
        d_query = {
            "$or": [
                {"order_id": {"$regex": query, "$options": "i"}},
                {"dispatch_number": {"$regex": query, "$options": "i"}},
                {"tracking_id": {"$regex": query, "$options": "i"}},
                {"customer_name": {"$regex": query, "$options": "i"}},
                {"phone": {"$regex": query, "$options": "i"}},
                {"serial_number": {"$regex": query, "$options": "i"}}
            ]
        }
        dispatches = await self.db.dispatches.find(d_query, {"_id": 0}).limit(5).to_list(5)
        results["dispatches"] = dispatches
        
        # Search amazon_orders
        ao_query = {
            "$or": [
                {"amazon_order_id": {"$regex": query, "$options": "i"}},
                {"buyer_name": {"$regex": query, "$options": "i"}},
                {"buyer_phone": {"$regex": query, "$options": "i"}}
            ]
        }
        amazon = await self.db.amazon_orders.find(ao_query, {"_id": 0}).limit(5).to_list(5)
        results["amazon_orders"] = amazon
        
        total = len(results["pending_fulfillment"]) + len(results["dispatches"]) + len(results["amazon_orders"])
        return json.dumps({"total_found": total, "results": results}, default=str)
    
    async def _get_order_details(self, order_id: str) -> str:
        """Get comprehensive order details"""
        # Try pending_fulfillment first
        pf = await self.db.pending_fulfillment.find_one(
            {"$or": [{"id": order_id}, {"order_id": order_id}, {"amazon_order_id": order_id}]},
            {"_id": 0}
        )
        
        # Check dispatch
        dispatch = await self.db.dispatches.find_one(
            {"$or": [{"pending_fulfillment_id": pf.get("id") if pf else order_id}, {"order_id": order_id}]},
            {"_id": 0}
        )
        
        # Check amazon order
        amazon = await self.db.amazon_orders.find_one(
            {"$or": [{"amazon_order_id": order_id}, {"amazon_order_id": pf.get("amazon_order_id") if pf else None}]},
            {"_id": 0}
        )
        
        # Get stock info if we have SKU
        stock_info = None
        if pf and pf.get("master_sku_id"):
            stock_count = await self.db.finished_good_serials.count_documents({
                "master_sku_id": pf["master_sku_id"],
                "firm_id": pf.get("firm_id"),
                "status": "in_stock"
            })
            stock_info = {"available_stock": stock_count, "sku_id": pf["master_sku_id"]}
        
        # Identify issues
        issues = []
        if pf:
            if not pf.get("customer_phone"):
                issues.append("Missing customer phone")
            if not pf.get("tracking_id"):
                issues.append("Missing tracking ID")
            if not pf.get("invoice_url"):
                issues.append("Missing invoice")
            if not pf.get("serial_number") and pf.get("is_manufactured"):
                issues.append("Missing serial number (manufactured item)")
            if pf.get("status") == "awaiting_stock":
                issues.append("Awaiting stock - no inventory available")
        
        return json.dumps({
            "pending_fulfillment": pf,
            "dispatch": dispatch,
            "amazon_order": amazon,
            "stock_info": stock_info,
            "issues": issues,
            "in_dispatch_queue": dispatch is not None and dispatch.get("status") in ["pending_label", "ready_for_dispatch"]
        }, default=str)
    
    async def _check_serial_availability(self, master_sku_id: str, firm_id: str, limit: int = 10) -> str:
        """Check available serials"""
        serials = await self.db.finished_good_serials.find(
            {"master_sku_id": master_sku_id, "firm_id": firm_id, "status": "in_stock"},
            {"_id": 0, "serial_number": 1, "created_at": 1}
        ).limit(limit).to_list(limit)
        
        total = await self.db.finished_good_serials.count_documents(
            {"master_sku_id": master_sku_id, "firm_id": firm_id, "status": "in_stock"}
        )
        
        return json.dumps({
            "total_available": total,
            "serials": [s["serial_number"] for s in serials]
        }, default=str)
    
    async def _reserve_serial(self, order_id: str, serial_number: str) -> str:
        """Atomically reserve a serial for an order"""
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Get the order
        order = await self.db.pending_fulfillment.find_one({"id": order_id}, {"_id": 0})
        if not order:
            return json.dumps({"success": False, "error": "Order not found"})
        
        # Release previous serial if exists
        prev_serial = order.get("serial_number")
        if prev_serial and prev_serial != serial_number:
            await self.db.finished_good_serials.update_one(
                {"serial_number": prev_serial, "status": "reserved", "reserved_by_order_id": order_id},
                {"$set": {"status": "in_stock", "reserved_by_order_id": None, "reserved_at": None}}
            )
        
        # Atomically reserve new serial
        result = await self.db.finished_good_serials.find_one_and_update(
            {
                "serial_number": serial_number,
                "$or": [
                    {"status": "in_stock"},
                    {"status": "reserved", "reserved_by_order_id": order_id}
                ]
            },
            {"$set": {
                "status": "reserved",
                "reserved_by_order_id": order_id,
                "reserved_at": now_iso,
                "updated_at": now_iso
            }},
            return_document=True
        )
        
        if not result:
            return json.dumps({"success": False, "error": f"Serial {serial_number} not available or already reserved"})
        
        # Update order
        await self.db.pending_fulfillment.update_one(
            {"id": order_id},
            {"$set": {"serial_number": serial_number, "updated_at": now_iso}}
        )
        
        return json.dumps({"success": True, "message": f"Serial {serial_number} reserved for order {order.get('order_id')}"})
    
    async def _update_order_field(self, order_id: str, field: str, value: str) -> str:
        """Update a field on an order"""
        now_iso = datetime.now(timezone.utc).isoformat()
        
        result = await self.db.pending_fulfillment.update_one(
            {"id": order_id},
            {"$set": {field: value, "updated_at": now_iso}}
        )
        
        if result.modified_count == 0:
            return json.dumps({"success": False, "error": "Order not found or field not updated"})
        
        return json.dumps({"success": True, "message": f"Updated {field} to '{value}'"})
    
    async def _check_dispatch_queue(self, order_id: str) -> str:
        """Check if order is in dispatch queue"""
        # Check pending_fulfillment status
        pf = await self.db.pending_fulfillment.find_one(
            {"$or": [{"id": order_id}, {"order_id": order_id}]},
            {"_id": 0, "id": 1, "status": 1, "order_id": 1}
        )
        
        # Check dispatches
        dispatch = await self.db.dispatches.find_one(
            {"$or": [
                {"pending_fulfillment_id": pf.get("id") if pf else order_id},
                {"order_id": order_id}
            ]},
            {"_id": 0, "dispatch_number": 1, "status": 1, "tracking_id": 1, "created_at": 1}
        )
        
        status_info = {
            "pending_fulfillment_status": pf.get("status") if pf else None,
            "in_dispatch_table": dispatch is not None,
            "dispatch_info": dispatch
        }
        
        if dispatch:
            if dispatch.get("status") == "dispatched":
                status_info["conclusion"] = "Order has been DISPATCHED"
            elif dispatch.get("status") in ["pending_label", "ready_for_dispatch"]:
                status_info["conclusion"] = "Order is IN DISPATCH QUEUE waiting for dispatcher"
            else:
                status_info["conclusion"] = f"Dispatch status: {dispatch.get('status')}"
        elif pf:
            if pf.get("status") == "dispatched":
                status_info["conclusion"] = "Order marked as dispatched but no dispatch record found"
            elif pf.get("status") == "in_dispatch_queue":
                status_info["conclusion"] = "Order in dispatch queue but no dispatch record - may be stuck"
            elif pf.get("status") == "awaiting_stock":
                status_info["conclusion"] = "Order waiting for stock"
            else:
                status_info["conclusion"] = f"Order in pending_fulfillment with status: {pf.get('status')}"
        else:
            status_info["conclusion"] = "Order not found in system"
        
        return json.dumps(status_info, default=str)
    
    async def _find_duplicates(self, tracking_id: str = None, order_id: str = None, phone: str = None) -> str:
        """Find duplicate orders"""
        duplicates = {"tracking_id": [], "order_id": [], "phone": []}
        
        if tracking_id:
            # Check pending_fulfillment
            pf_dups = await self.db.pending_fulfillment.find(
                {"tracking_id": tracking_id}, {"_id": 0, "id": 1, "order_id": 1, "status": 1}
            ).to_list(10)
            # Check dispatches
            d_dups = await self.db.dispatches.find(
                {"tracking_id": tracking_id}, {"_id": 0, "dispatch_number": 1, "status": 1}
            ).to_list(10)
            duplicates["tracking_id"] = {"pending_fulfillment": pf_dups, "dispatches": d_dups}
        
        if order_id:
            pf_dups = await self.db.pending_fulfillment.find(
                {"order_id": order_id}, {"_id": 0, "id": 1, "order_id": 1, "status": 1}
            ).to_list(10)
            d_dups = await self.db.dispatches.find(
                {"order_id": order_id}, {"_id": 0, "dispatch_number": 1, "status": 1}
            ).to_list(10)
            duplicates["order_id"] = {"pending_fulfillment": pf_dups, "dispatches": d_dups}
        
        if phone:
            phone = phone[-10:] if len(phone) > 10 else phone
            pf_dups = await self.db.pending_fulfillment.find(
                {"customer_phone": {"$regex": phone}}, {"_id": 0, "id": 1, "order_id": 1, "status": 1, "created_at": 1}
            ).sort("created_at", -1).to_list(10)
            duplicates["phone"] = pf_dups
        
        return json.dumps(duplicates, default=str)
    
    async def _get_dispatch_queue_summary(self) -> str:
        """Get dispatch queue summary"""
        # Pending fulfillment stats
        pf_stats = {
            "awaiting_stock": await self.db.pending_fulfillment.count_documents({"status": "awaiting_stock"}),
            "pending_dispatch": await self.db.pending_fulfillment.count_documents({"status": "pending_dispatch"}),
            "in_dispatch_queue": await self.db.pending_fulfillment.count_documents({"status": "in_dispatch_queue"}),
            "dispatched": await self.db.pending_fulfillment.count_documents({"status": "dispatched"})
        }
        
        # Dispatch stats
        dispatch_stats = {
            "pending_label": await self.db.dispatches.count_documents({"status": "pending_label"}),
            "ready_for_dispatch": await self.db.dispatches.count_documents({"status": "ready_for_dispatch"}),
            "dispatched_today": await self.db.dispatches.count_documents({
                "status": "dispatched",
                "scanned_out_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()}
            })
        }
        
        # Orders missing critical info
        missing_tracking = await self.db.pending_fulfillment.count_documents({
            "status": {"$in": ["pending_dispatch", "in_dispatch_queue"]},
            "$or": [{"tracking_id": None}, {"tracking_id": ""}]
        })
        
        missing_serial = await self.db.pending_fulfillment.count_documents({
            "status": {"$in": ["pending_dispatch", "in_dispatch_queue"]},
            "is_manufactured": True,
            "$or": [{"serial_number": None}, {"serial_number": ""}]
        })
        
        return json.dumps({
            "pending_fulfillment": pf_stats,
            "dispatches": dispatch_stats,
            "issues": {
                "missing_tracking": missing_tracking,
                "missing_serial": missing_serial
            }
        }, default=str)
    
    async def _diagnose_order_issues(self, order_id: str) -> str:
        """Comprehensive order diagnosis"""
        pf = await self.db.pending_fulfillment.find_one(
            {"$or": [{"id": order_id}, {"order_id": order_id}, {"amazon_order_id": order_id}]},
            {"_id": 0}
        )
        
        if not pf:
            return json.dumps({"error": "Order not found"})
        
        issues = []
        warnings = []
        suggestions = []
        
        # Check customer info
        if not pf.get("customer_phone"):
            issues.append("CRITICAL: Missing customer phone number")
            if pf.get("amazon_order_id"):
                suggestions.append("Can extract phone from Amazon order if available")
        
        if not pf.get("customer_name"):
            issues.append("Missing customer name")
        
        # Check tracking
        if not pf.get("tracking_id"):
            if pf.get("order_source") == "easyship":
                warnings.append("No tracking ID but EasyShip order - Amazon handles shipping")
            else:
                issues.append("Missing tracking ID")
                suggestions.append("Generate label via Bigship or enter manually")
        
        # Check invoice
        if not pf.get("invoice_url"):
            issues.append("Missing invoice document")
            suggestions.append("Upload invoice PDF")
        
        # Check serial for manufactured items
        if pf.get("is_manufactured") or pf.get("product_type") == "manufactured":
            if not pf.get("serial_number"):
                stock_count = await self.db.finished_good_serials.count_documents({
                    "master_sku_id": pf.get("master_sku_id"),
                    "firm_id": pf.get("firm_id"),
                    "status": "in_stock"
                })
                if stock_count > 0:
                    issues.append(f"Missing serial number ({stock_count} available in stock)")
                    suggestions.append("Reserve a serial number")
                else:
                    issues.append("Missing serial number and NO STOCK AVAILABLE")
                    warnings.append("Order should be in awaiting_stock status")
        
        # Check if dispatch exists
        dispatch = await self.db.dispatches.find_one(
            {"pending_fulfillment_id": pf.get("id")},
            {"_id": 0, "dispatch_number": 1, "status": 1}
        )
        
        if dispatch:
            if dispatch.get("status") == "dispatched":
                warnings.append(f"Already dispatched: {dispatch.get('dispatch_number')}")
        
        # Check for duplicates
        if pf.get("tracking_id"):
            dup_count = await self.db.pending_fulfillment.count_documents({
                "tracking_id": pf["tracking_id"],
                "id": {"$ne": pf["id"]}
            })
            if dup_count > 0:
                issues.append(f"DUPLICATE: {dup_count} other orders have same tracking ID")
        
        return json.dumps({
            "order_id": pf.get("order_id"),
            "status": pf.get("status"),
            "issues": issues,
            "warnings": warnings,
            "suggestions": suggestions,
            "ready_to_dispatch": len(issues) == 0
        }, default=str)
    
    async def _create_dispatch_entry(self, order_id: str) -> str:
        """Create dispatch entry - this is a stub, actual implementation would call the dispatch API"""
        pf = await self.db.pending_fulfillment.find_one({"id": order_id}, {"_id": 0})
        if not pf:
            return json.dumps({"success": False, "error": "Order not found"})
        
        # Check if already in dispatches
        existing = await self.db.dispatches.find_one({"pending_fulfillment_id": order_id})
        if existing:
            return json.dumps({
                "success": False, 
                "error": f"Dispatch already exists: {existing.get('dispatch_number')}",
                "dispatch": {"dispatch_number": existing.get("dispatch_number"), "status": existing.get("status")}
            })
        
        # Check requirements
        missing = []
        if not pf.get("tracking_id"):
            missing.append("tracking_id")
        if not pf.get("invoice_url"):
            missing.append("invoice")
        if pf.get("is_manufactured") and not pf.get("serial_number"):
            missing.append("serial_number")
        
        if missing:
            return json.dumps({
                "success": False,
                "error": f"Cannot create dispatch - missing: {', '.join(missing)}",
                "missing_fields": missing
            })
        
        return json.dumps({
            "success": True,
            "message": "Order is ready for dispatch. Use the Prepare Dispatch flow to create the dispatch entry with full compliance checks.",
            "order_id": pf.get("order_id")
        })
    
    async def _get_customer_history(self, phone: str) -> str:
        """Get customer order history"""
        phone = phone[-10:] if len(phone) > 10 else phone
        
        orders = await self.db.pending_fulfillment.find(
            {"customer_phone": {"$regex": phone}},
            {"_id": 0, "order_id": 1, "customer_name": 1, "status": 1, "created_at": 1}
        ).sort("created_at", -1).to_list(20)
        
        dispatches = await self.db.dispatches.find(
            {"phone": {"$regex": phone}},
            {"_id": 0, "dispatch_number": 1, "order_id": 1, "status": 1, "created_at": 1}
        ).sort("created_at", -1).to_list(20)
        
        return json.dumps({
            "phone": phone,
            "total_orders": len(orders),
            "total_dispatches": len(dispatches),
            "orders": orders,
            "dispatches": dispatches
        }, default=str)
    
    async def _get_stock_summary(self, sku_code: str = None, firm_id: str = None) -> str:
        """Get stock summary"""
        match = {"status": "in_stock"}
        if firm_id:
            match["firm_id"] = firm_id
        
        if sku_code:
            # Find master_sku
            sku = await self.db.master_skus.find_one(
                {"$or": [{"sku_code": sku_code}, {"name": {"$regex": sku_code, "$options": "i"}}]},
                {"_id": 0, "id": 1, "name": 1, "sku_code": 1}
            )
            if sku:
                match["master_sku_id"] = sku["id"]
                count = await self.db.finished_good_serials.count_documents(match)
                return json.dumps({"sku": sku, "in_stock": count})
            else:
                return json.dumps({"error": f"SKU not found: {sku_code}"})
        
        # Aggregate by SKU
        pipeline = [
            {"$match": match},
            {"$group": {"_id": "$master_sku_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 20}
        ]
        results = await self.db.finished_good_serials.aggregate(pipeline).to_list(20)
        
        # Get SKU names
        sku_ids = [r["_id"] for r in results if r["_id"]]
        skus = await self.db.master_skus.find(
            {"id": {"$in": sku_ids}},
            {"_id": 0, "id": 1, "name": 1, "sku_code": 1}
        ).to_list(100)
        sku_map = {s["id"]: s for s in skus}
        
        summary = []
        for r in results:
            sku = sku_map.get(r["_id"], {})
            summary.append({
                "sku_code": sku.get("sku_code", "Unknown"),
                "name": sku.get("name", "Unknown"),
                "in_stock": r["count"]
            })
        
        return json.dumps({"stock_summary": summary}, default=str)
    
    async def _fetch_amazon_order(self, amazon_order_id: str) -> str:
        """Fetch a specific order from Amazon SP-API"""
        import requests
        import hashlib
        import hmac
        from urllib.parse import quote
        from datetime import datetime, timezone
        
        logger.info(f"[fetch_amazon_order] Attempting to fetch order: {amazon_order_id}")
        
        # Get the first active Amazon credentials
        creds = await self.db.marketplace_credentials.find_one(
            {"platform": "amazon", "is_active": True},
            {"_id": 0}
        )
        
        logger.info(f"[fetch_amazon_order] Got creds from DB: {creds is not None}")
        
        if not creds:
            # Try using environment variables as fallback
            lwa_client_id = os.environ.get("AMAZON_LWA_CLIENT_ID")
            lwa_client_secret = os.environ.get("AMAZON_LWA_CLIENT_SECRET")
            refresh_token = os.environ.get("AMAZON_SP_API_REFRESH_TOKEN")
            aws_access_key = os.environ.get("AMAZON_AWS_ACCESS_KEY")
            aws_secret_key = os.environ.get("AMAZON_AWS_SECRET_KEY")
            seller_id = os.environ.get("AMAZON_SELLER_ID")
            
            logger.info(f"[fetch_amazon_order] ENV VARS: client_id_len={len(lwa_client_id) if lwa_client_id else 0}, secret_len={len(lwa_client_secret) if lwa_client_secret else 0}, refresh_len={len(refresh_token) if refresh_token else 0}")
            logger.info(f"[fetch_amazon_order] Using env credentials. Client ID present: {bool(lwa_client_id)}, Secret present: {bool(lwa_client_secret)}, Refresh present: {bool(refresh_token)}")
            
            if not all([lwa_client_id, lwa_client_secret, refresh_token, aws_access_key, aws_secret_key]):
                logger.error(f"[fetch_amazon_order] Missing Amazon credentials: client_id={bool(lwa_client_id)}, secret={bool(lwa_client_secret)}, refresh={bool(refresh_token)}, aws_key={bool(aws_access_key)}, aws_secret={bool(aws_secret_key)}")
                return json.dumps({"error": "Amazon credentials not configured"})
            
            creds = {
                "lwa_client_id": lwa_client_id,
                "lwa_client_secret": lwa_client_secret,
                "refresh_token": refresh_token,
                "aws_access_key": aws_access_key,
                "aws_secret_key": aws_secret_key,
                "seller_id": seller_id,
                "marketplace_id": "A21TJRUUN4KGV"  # India
            }
        
        def get_access_token():
            """Get LWA access token"""
            url = "https://api.amazon.com/auth/o2/token"
            payload = {
                "grant_type": "refresh_token",
                "refresh_token": creds["refresh_token"],
                "client_id": creds["lwa_client_id"],
                "client_secret": creds["lwa_client_secret"]
            }
            logger.info(f"[fetch_amazon_order] Requesting access token...")
            response = requests.post(url, data=payload)
            logger.info(f"[fetch_amazon_order] Token response status: {response.status_code}")
            if response.status_code == 200:
                return response.json().get("access_token")
            logger.error(f"[fetch_amazon_order] Token error: {response.text[:200]}")
            return None
        
        def get_signature_key(key, date_stamp, region_name, service_name):
            k_date = hmac.new(('AWS4' + key).encode('utf-8'), date_stamp.encode('utf-8'), hashlib.sha256).digest()
            k_region = hmac.new(k_date, region_name.encode('utf-8'), hashlib.sha256).digest()
            k_service = hmac.new(k_region, service_name.encode('utf-8'), hashlib.sha256).digest()
            k_signing = hmac.new(k_service, 'aws4_request'.encode('utf-8'), hashlib.sha256).digest()
            return k_signing
        
        def make_sp_api_request(method, path, params=None, access_token=None):
            t = datetime.now(timezone.utc)
            amz_date = t.strftime('%Y%m%dT%H%M%SZ')
            date_stamp = t.strftime('%Y%m%d')
            
            host = "sellingpartnerapi-eu.amazon.com"
            region = "eu-west-1"
            service = 'execute-api'
            
            canonical_querystring = '&'.join([f"{quote(k, safe='~')}={quote(str(v), safe='~')}" for k, v in sorted(params.items())]) if params else ''
            payload = ''
            
            canonical_headers = f'host:{host}\nx-amz-access-token:{access_token}\nx-amz-date:{amz_date}\n'
            signed_headers = 'host;x-amz-access-token;x-amz-date'
            payload_hash = hashlib.sha256(payload.encode('utf-8')).hexdigest()
            canonical_request = f'{method}\n{path}\n{canonical_querystring}\n{canonical_headers}\n{signed_headers}\n{payload_hash}'
            
            algorithm = 'AWS4-HMAC-SHA256'
            credential_scope = f'{date_stamp}/{region}/{service}/aws4_request'
            string_to_sign = f'{algorithm}\n{amz_date}\n{credential_scope}\n{hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()}'
            
            signing_key = get_signature_key(creds["aws_secret_key"], date_stamp, region, service)
            signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()
            
            authorization_header = f'{algorithm} Credential={creds["aws_access_key"]}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}'
            
            headers = {
                'host': host,
                'x-amz-access-token': access_token,
                'x-amz-date': amz_date,
                'Authorization': authorization_header,
                'Content-Type': 'application/json'
            }
            
            url = f'https://{host}{path}{"?" + canonical_querystring if canonical_querystring else ""}'
            return requests.request(method, url, headers=headers)
        
        try:
            access_token = get_access_token()
            if not access_token:
                logger.error("[fetch_amazon_order] Failed to get access token")
                return json.dumps({"error": "Failed to get Amazon access token"})
            
            logger.info(f"[fetch_amazon_order] Got access token, fetching order")
            
            # Fetch order details
            order_path = f"/orders/v0/orders/{amazon_order_id}"
            response = make_sp_api_request("GET", order_path, access_token=access_token)
            
            logger.info(f"[fetch_amazon_order] Order API response: {response.status_code}")
            
            if response.status_code != 200:
                logger.error(f"[fetch_amazon_order] API error: {response.text[:200]}")
                return json.dumps({"error": f"Amazon API error: {response.status_code} - {response.text[:200]}"})
            
            order_data = response.json().get("payload", {})
            logger.info(f"[fetch_amazon_order] Order status: {order_data.get('OrderStatus')}")
            
            # Fetch order items
            items_path = f"/orders/v0/orders/{amazon_order_id}/orderItems"
            items_response = make_sp_api_request("GET", items_path, access_token=access_token)
            
            order_items = []
            if items_response.status_code == 200:
                order_items = items_response.json().get("payload", {}).get("OrderItems", [])
            
            # Format the response
            result = {
                "amazon_order_id": amazon_order_id,
                "status": order_data.get("OrderStatus"),
                "purchase_date": order_data.get("PurchaseDate"),
                "buyer_name": order_data.get("BuyerInfo", {}).get("BuyerName"),
                "buyer_email": order_data.get("BuyerInfo", {}).get("BuyerEmail"),
                "shipping_address": order_data.get("ShippingAddress", {}),
                "order_total": order_data.get("OrderTotal", {}),
                "fulfillment_channel": order_data.get("FulfillmentChannel"),
                "is_easy_ship": order_data.get("EasyShipShipmentStatus") is not None,
                "items": [
                    {
                        "title": item.get("Title"),
                        "asin": item.get("ASIN"),
                        "seller_sku": item.get("SellerSKU"),
                        "quantity": item.get("QuantityOrdered"),
                        "price": item.get("ItemPrice", {})
                    }
                    for item in order_items
                ],
                "in_crm": False,
                "suggestion": "This order is not yet in the CRM. It can be imported via the Amazon Orders page."
            }
            
            # Check if already in CRM
            existing = await self.db.amazon_orders.find_one({"amazon_order_id": amazon_order_id})
            if existing:
                result["in_crm"] = True
                result["suggestion"] = "This order is already in the CRM database."
            
            logger.info(f"[fetch_amazon_order] Successfully fetched order: {result.get('status')}")
            return json.dumps(result, default=str)
            
        except Exception as e:
            logger.error(f"Amazon API error: {e}")
            return json.dumps({"error": f"Failed to fetch Amazon order: {str(e)}"})
    
    async def chat(self, user_message: str) -> str:
        """Main chat function - processes user message and returns AI response"""
        # Add user message to history
        self.conversation_history.append({
            "role": "user",
            "content": user_message
        })
        
        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + self.conversation_history
        
        try:
            # Call OpenAI with tools
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
                temperature=0.3,
                max_tokens=2000
            )
            
            assistant_message = response.choices[0].message
            
            # Handle tool calls
            while assistant_message.tool_calls:
                # Add assistant message with tool calls
                self.conversation_history.append({
                    "role": "assistant",
                    "content": assistant_message.content,
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments
                            }
                        }
                        for tc in assistant_message.tool_calls
                    ]
                })
                
                # Execute each tool call
                for tool_call in assistant_message.tool_calls:
                    function_name = tool_call.function.name
                    arguments = json.loads(tool_call.function.arguments)
                    
                    logger.info(f"AI calling tool: {function_name} with args: {arguments}")
                    result = await self.execute_tool(function_name, arguments)
                    
                    # Add tool result
                    self.conversation_history.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": result
                    })
                
                # Get next response
                messages = [{"role": "system", "content": SYSTEM_PROMPT}] + self.conversation_history
                response = await client.chat.completions.create(
                    model="gpt-4o",
                    messages=messages,
                    tools=TOOLS,
                    tool_choice="auto",
                    temperature=0.3,
                    max_tokens=2000
                )
                assistant_message = response.choices[0].message
            
            # Add final response to history
            final_response = assistant_message.content or "I apologize, I couldn't generate a response."
            self.conversation_history.append({
                "role": "assistant",
                "content": final_response
            })
            
            return final_response
            
        except Exception as e:
            logger.error(f"AI chat error: {e}")
            return f"I encountered an error: {str(e)}. Please try again."

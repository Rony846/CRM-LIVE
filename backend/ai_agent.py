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
SYSTEM_PROMPT = """You are an intelligent CRM Operations Assistant for MuscleGrid, a company that sells batteries, inverters, and solar products. You have FULL access to the CRM database and can perform ALL actions autonomously.

## Your Capabilities:
1. **Search & Analyze Orders** - Find orders by ID, phone, tracking, customer name across all tables
2. **Fetch Amazon Orders** - If an order is not found in CRM, fetch it directly from Amazon SP-API
3. **Import Orders to CRM** - Import Amazon orders into the CRM pending_fulfillment queue
4. **Update Order Details** - Update customer name, phone, address, tracking on orders
5. **Check & Reserve Stock** - Check inventory and atomically reserve serial numbers
6. **Generate Shipping Labels** - Create labels via Bigship API (for MFN orders)
7. **Create Dispatches** - Add orders to dispatcher queue ready for physical dispatch
8. **Mark as Dispatched** - Complete dispatch for orders already in 'ready_to_dispatch' status
9. **Full Workflow** - Execute complete end-to-end dispatch workflow in one go
10. **Check Dispatcher Queue** - See what's waiting for the dispatcher

## Guidelines:
- Be PROACTIVE: If you see an issue, mention it even if not asked
- Be EFFICIENT: Don't ask for information you can look up yourself
- TAKE ACTION: When asked to dispatch/process an order, DO IT - don't just explain how
- REMEMBER CONTEXT: Use conversation history to avoid asking repeat questions
- EXPLAIN ACTIONS: Tell the user what you're doing and the results

## Workflow for Processing Orders:
1. If order not in CRM → use `import_amazon_order_to_crm`
2. If customer details missing → use `update_pending_fulfillment`
3. If manufactured item needs serial → use `reserve_serial_for_order`
4. If MFN order needs tracking → use `generate_shipping_label`
5. Create dispatch entry → use `create_dispatch_for_order`
6. **If order is ALREADY in 'ready_to_dispatch'** → use `mark_order_dispatched` to complete it

Or use `full_dispatch_workflow` to do all steps automatically!

## IMPORTANT - Order Status Flow:
- `pending` → Order just created, needs processing
- `in_dispatch_queue` / `ready_to_dispatch` / `ready_for_dispatch` → In dispatcher's queue, physically ready to ship
- `dispatched` → Handed over to courier, complete!

**When an order is ALREADY in 'ready_to_dispatch', don't recreate dispatch - just use `mark_order_dispatched` to complete it!**

## Important Rules:
- For EasyShip orders: Skip label generation (Amazon handles shipping)
- For MFN orders: Need phone number and generate Bigship label
- For manufactured items: MUST reserve a serial before dispatch
- Always check stock before promising dispatch

When a user mentions an order ID, ALWAYS search for it first. If not found, fetch from Amazon and offer to import it."""

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
            "name": "mark_order_dispatched",
            "description": "Mark an order as dispatched. Use this to complete an order that is already in 'ready_to_dispatch' or 'ready_for_dispatch' status in the dispatcher queue.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The order ID, amazon order ID, or dispatch number to mark as dispatched"
                    },
                    "courier_name": {
                        "type": "string",
                        "description": "Name of the courier/shipping company (optional)"
                    },
                    "notes": {
                        "type": "string", 
                        "description": "Any dispatch notes (optional)"
                    }
                },
                "required": ["order_id"]
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
    },
    {
        "type": "function",
        "function": {
            "name": "import_amazon_order_to_crm",
            "description": "Import an Amazon order into the CRM pending_fulfillment queue. Use this after fetching an order from Amazon to add it to the dispatch workflow.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amazon_order_id": {
                        "type": "string",
                        "description": "The Amazon order ID to import"
                    },
                    "customer_name": {
                        "type": "string",
                        "description": "Customer name (optional, will be fetched from Amazon if not provided)"
                    },
                    "customer_phone": {
                        "type": "string",
                        "description": "Customer phone number (10 digits)"
                    }
                },
                "required": ["amazon_order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_pending_fulfillment",
            "description": "Update fields on a pending_fulfillment order. Can update customer_name, customer_phone, address, city, state, pincode, tracking_id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The pending_fulfillment ID or amazon_order_id"
                    },
                    "customer_name": {
                        "type": "string",
                        "description": "New customer name"
                    },
                    "customer_phone": {
                        "type": "string",
                        "description": "New phone number (10 digits)"
                    },
                    "address": {
                        "type": "string",
                        "description": "New address"
                    },
                    "city": {
                        "type": "string",
                        "description": "New city"
                    },
                    "state": {
                        "type": "string",
                        "description": "New state"
                    },
                    "pincode": {
                        "type": "string",
                        "description": "New pincode"
                    }
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_shipping_label",
            "description": "Generate a shipping label via Bigship API for an order. Requires customer details and address to be complete.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The pending_fulfillment ID or amazon_order_id"
                    },
                    "courier_preference": {
                        "type": "string",
                        "description": "Preferred courier (optional)",
                        "enum": ["delhivery", "bluedart", "xpressbees", "ecom", "auto"]
                    }
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "reserve_serial_for_order",
            "description": "Reserve an available serial number for an order. Checks stock and atomically reserves the serial.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The pending_fulfillment ID"
                    },
                    "serial_number": {
                        "type": "string",
                        "description": "Specific serial to reserve (optional - if not provided, will auto-select)"
                    }
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_dispatch_for_order",
            "description": "Create a dispatch entry and add order to dispatcher queue. Requires tracking_id and serial_number (for manufactured items) to be set.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The pending_fulfillment ID"
                    }
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_dispatcher_queue",
            "description": "Get the current dispatcher queue showing all orders ready for dispatch.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of orders to return",
                        "default": 20
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "full_dispatch_workflow",
            "description": "Execute the complete dispatch workflow for an Amazon order: 1) Import to CRM, 2) Update customer details, 3) Check/reserve stock, 4) Generate label, 5) Create dispatch. Use this for end-to-end order processing.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amazon_order_id": {
                        "type": "string",
                        "description": "The Amazon order ID"
                    },
                    "customer_phone": {
                        "type": "string",
                        "description": "Customer phone number (required for MFN orders)"
                    },
                    "skip_label": {
                        "type": "boolean",
                        "description": "Skip label generation (for EasyShip orders)",
                        "default": False
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
            elif tool_name == "mark_order_dispatched":
                return await self._mark_order_dispatched(
                    arguments.get("order_id", ""),
                    arguments.get("courier_name"),
                    arguments.get("notes")
                )
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
            elif tool_name == "import_amazon_order_to_crm":
                return await self._import_amazon_order_to_crm(
                    arguments.get("amazon_order_id", ""),
                    arguments.get("customer_name"),
                    arguments.get("customer_phone")
                )
            elif tool_name == "update_pending_fulfillment":
                return await self._update_pending_fulfillment(
                    arguments.get("order_id", ""),
                    arguments
                )
            elif tool_name == "generate_shipping_label":
                return await self._generate_shipping_label(
                    arguments.get("order_id", ""),
                    arguments.get("courier_preference", "auto")
                )
            elif tool_name == "reserve_serial_for_order":
                return await self._reserve_serial_for_order(
                    arguments.get("order_id", ""),
                    arguments.get("serial_number")
                )
            elif tool_name == "create_dispatch_for_order":
                return await self._create_dispatch_for_order(arguments.get("order_id", ""))
            elif tool_name == "get_dispatcher_queue":
                return await self._get_dispatcher_queue(arguments.get("limit", 20))
            elif tool_name == "full_dispatch_workflow":
                return await self._full_dispatch_workflow(
                    arguments.get("amazon_order_id", ""),
                    arguments.get("customer_phone"),
                    arguments.get("skip_label", False)
                )
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
    
    async def _mark_order_dispatched(self, order_id: str, courier_name: str = None, notes: str = None) -> str:
        """Mark an order as dispatched - completes the dispatch workflow"""
        from datetime import datetime, timezone
        
        logger.info(f"[mark_dispatched] Marking order {order_id} as dispatched")
        
        # Find the dispatch record
        dispatch = await self.db.dispatches.find_one(
            {"$or": [
                {"pending_fulfillment_id": order_id},
                {"order_id": order_id},
                {"amazon_order_id": order_id},
                {"dispatch_number": order_id},
                {"id": order_id}
            ]},
            {"_id": 0}
        )
        
        if not dispatch:
            # Try finding via pending_fulfillment
            pf = await self.db.pending_fulfillment.find_one(
                {"$or": [{"id": order_id}, {"order_id": order_id}, {"amazon_order_id": order_id}]},
                {"_id": 0}
            )
            if pf and pf.get("dispatch_id"):
                dispatch = await self.db.dispatches.find_one(
                    {"id": pf["dispatch_id"]},
                    {"_id": 0}
                )
        
        if not dispatch:
            return json.dumps({
                "success": False,
                "error": f"No dispatch found for order {order_id}. Create a dispatch first using 'create_dispatch_entry' or process via the full workflow."
            })
        
        # Check if already dispatched
        if dispatch.get("status") == "dispatched":
            return json.dumps({
                "success": True,
                "message": "Order was already marked as dispatched",
                "dispatch_number": dispatch.get("dispatch_number"),
                "dispatched_at": dispatch.get("dispatched_at"),
                "already_dispatched": True
            })
        
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Update dispatch record
        update_data = {
            "status": "dispatched",
            "dispatched_at": now_iso,
            "dispatched_by": self.user.get("id"),
            "dispatched_by_name": f"{self.user.get('first_name', '')} {self.user.get('last_name', '')}",
            "updated_at": now_iso
        }
        
        if courier_name:
            update_data["courier_name"] = courier_name
        if notes:
            update_data["dispatch_notes"] = notes
        
        await self.db.dispatches.update_one(
            {"id": dispatch["id"]},
            {"$set": update_data}
        )
        
        # Update pending_fulfillment status
        await self.db.pending_fulfillment.update_one(
            {"id": dispatch.get("pending_fulfillment_id")},
            {"$set": {
                "status": "dispatched",
                "dispatched_at": now_iso,
                "updated_at": now_iso
            }}
        )
        
        # Update amazon_orders if applicable
        if dispatch.get("amazon_order_id"):
            await self.db.amazon_orders.update_one(
                {"amazon_order_id": dispatch["amazon_order_id"]},
                {"$set": {
                    "crm_status": "dispatched",
                    "dispatched_at": now_iso,
                    "updated_at": now_iso
                }}
            )
        
        logger.info(f"[mark_dispatched] Successfully dispatched: {dispatch.get('dispatch_number')}")
        
        return json.dumps({
            "success": True,
            "message": f"Order marked as dispatched! Dispatch #{dispatch.get('dispatch_number')}",
            "dispatch_number": dispatch.get("dispatch_number"),
            "dispatched_at": now_iso,
            "tracking_id": dispatch.get("tracking_id"),
            "customer_name": dispatch.get("customer_name")
        })
    
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
    
    async def _import_amazon_order_to_crm(self, amazon_order_id: str, customer_name: str = None, customer_phone: str = None) -> str:
        """Import an Amazon order into the CRM pending_fulfillment"""
        import uuid
        
        logger.info(f"[import_amazon_order] Importing order: {amazon_order_id}")
        
        # Check if already exists
        existing = await self.db.pending_fulfillment.find_one(
            {"$or": [{"amazon_order_id": amazon_order_id}, {"order_id": amazon_order_id}]},
            {"_id": 0}
        )
        if existing:
            return json.dumps({
                "success": False,
                "error": f"Order {amazon_order_id} already exists in CRM",
                "existing_id": existing.get("id"),
                "status": existing.get("status")
            })
        
        # Fetch from Amazon first
        amazon_result = await self._fetch_amazon_order(amazon_order_id)
        amazon_data = json.loads(amazon_result)
        
        if amazon_data.get("error"):
            return json.dumps({"success": False, "error": amazon_data.get("error")})
        
        # Get default firm
        default_firm = await self.db.firms.find_one({"is_default": True}, {"_id": 0})
        firm_id = default_firm.get("id") if default_firm else None
        
        # Extract shipping address
        shipping = amazon_data.get("shipping_address", {})
        
        # Try to match SKU
        master_sku = None
        is_manufactured = False
        items = amazon_data.get("items", [])
        if items:
            seller_sku = items[0].get("seller_sku")
            if seller_sku:
                master_sku = await self.db.master_skus.find_one(
                    {"$or": [{"sku_code": seller_sku}, {"amazon_sku": seller_sku}]},
                    {"_id": 0}
                )
                if master_sku:
                    is_manufactured = master_sku.get("is_manufactured", False)
        
        now_iso = datetime.now(timezone.utc).isoformat()
        pf_id = str(uuid.uuid4())
        
        pf_record = {
            "id": pf_id,
            "order_id": amazon_order_id,
            "amazon_order_id": amazon_order_id,
            "customer_name": customer_name or shipping.get("Name") or amazon_data.get("buyer_name"),
            "customer_phone": customer_phone or "",
            "address": shipping.get("AddressLine1", "") + " " + shipping.get("AddressLine2", ""),
            "city": shipping.get("City", ""),
            "state": shipping.get("StateOrRegion", ""),
            "pincode": shipping.get("PostalCode", ""),
            "order_source": "amazon",
            "is_easyship": amazon_data.get("is_easy_ship", False),
            "is_manufactured": is_manufactured,
            "master_sku_id": master_sku.get("id") if master_sku else None,
            "master_sku_code": master_sku.get("sku_code") if master_sku else None,
            "master_sku_name": master_sku.get("name") if master_sku else (items[0].get("title") if items else "Unknown"),
            "quantity": items[0].get("quantity", 1) if items else 1,
            "order_value": float(amazon_data.get("order_total", {}).get("Amount", 0)),
            "firm_id": firm_id,
            "status": "pending_dispatch",
            "created_at": now_iso,
            "updated_at": now_iso,
            "imported_by": self.user.get("id"),
            "imported_by_name": f"{self.user.get('first_name', '')} {self.user.get('last_name', '')}"
        }
        
        await self.db.pending_fulfillment.insert_one(pf_record)
        
        logger.info(f"[import_amazon_order] Created PF record: {pf_id}")
        
        return json.dumps({
            "success": True,
            "message": f"Order {amazon_order_id} imported to CRM",
            "pending_fulfillment_id": pf_id,
            "customer_name": pf_record["customer_name"],
            "is_manufactured": is_manufactured,
            "needs_serial": is_manufactured,
            "needs_phone": not pf_record["customer_phone"],
            "is_easyship": pf_record["is_easyship"]
        }, default=str)
    
    async def _update_pending_fulfillment(self, order_id: str, updates: dict) -> str:
        """Update fields on a pending_fulfillment order"""
        logger.info(f"[update_pf] Updating order: {order_id} with {updates}")
        
        # Find the order
        pf = await self.db.pending_fulfillment.find_one(
            {"$or": [{"id": order_id}, {"order_id": order_id}, {"amazon_order_id": order_id}]},
            {"_id": 0}
        )
        
        if not pf:
            return json.dumps({"success": False, "error": f"Order {order_id} not found"})
        
        # Build update dict
        update_fields = {}
        allowed_fields = ["customer_name", "customer_phone", "address", "city", "state", "pincode", "tracking_id"]
        
        for field in allowed_fields:
            if field in updates and updates[field]:
                update_fields[field] = updates[field]
        
        if not update_fields:
            return json.dumps({"success": False, "error": "No valid fields to update"})
        
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = await self.db.pending_fulfillment.update_one(
            {"id": pf["id"]},
            {"$set": update_fields}
        )
        
        logger.info(f"[update_pf] Updated {result.modified_count} documents")
        
        return json.dumps({
            "success": True,
            "message": f"Updated order {pf.get('order_id')}",
            "fields_updated": list(update_fields.keys()),
            "order_id": pf["id"]
        })
    
    async def _generate_shipping_label(self, order_id: str, courier_preference: str = "auto") -> str:
        """Generate shipping label via Bigship API using existing server functions"""
        import httpx
        import base64
        import io
        
        logger.info(f"[generate_label] Generating label for: {order_id}")
        
        # Find the order
        pf = await self.db.pending_fulfillment.find_one(
            {"$or": [{"id": order_id}, {"order_id": order_id}, {"amazon_order_id": order_id}]},
            {"_id": 0}
        )
        
        if not pf:
            return json.dumps({"success": False, "error": f"Order {order_id} not found"})
        
        # Check if already has tracking
        if pf.get("tracking_id"):
            return json.dumps({
                "success": True,
                "message": "Order already has tracking ID",
                "tracking_id": pf["tracking_id"],
                "already_generated": True
            })
        
        # Check required fields
        missing = []
        if not pf.get("customer_name"):
            missing.append("customer_name")
        if not pf.get("customer_phone") or pf.get("customer_phone") == "0000000000":
            missing.append("customer_phone (valid 10-digit number)")
        if not pf.get("address"):
            missing.append("address")
        if not pf.get("pincode"):
            missing.append("pincode")
        
        if missing:
            return json.dumps({
                "success": False,
                "error": f"Missing required fields: {', '.join(missing)}",
                "missing_fields": missing
            })
        
        # Import the existing Bigship functions from server
        try:
            from server import get_bigship_token, BIGSHIP_API_URL
        except ImportError:
            # Fallback to environment variables
            BIGSHIP_API_URL = os.environ.get("BIGSHIP_API_URL", "https://api.bigship.in/api")
            bigship_user_id = os.environ.get("BIGSHIP_USER_ID")
            bigship_password = os.environ.get("BIGSHIP_PASSWORD")
            bigship_access_key = os.environ.get("BIGSHIP_ACCESS_KEY")
            
            if not all([bigship_user_id, bigship_password, bigship_access_key]):
                return json.dumps({"success": False, "error": "Bigship credentials not configured"})
            
            # Get token manually
            async with httpx.AsyncClient(timeout=30.0) as client:
                token_response = await client.post(
                    f"{BIGSHIP_API_URL}/login/user",
                    json={
                        "user_name": bigship_user_id,
                        "password": bigship_password,
                        "access_key": bigship_access_key
                    },
                    headers={"Content-Type": "application/json"}
                )
                
                if token_response.status_code != 200:
                    return json.dumps({"success": False, "error": f"Bigship auth failed: {token_response.status_code}"})
                
                token_data = token_response.json()
                if not token_data.get("success"):
                    return json.dumps({"success": False, "error": f"Bigship auth error: {token_data.get('message')}"})
                
                token = token_data["data"]["token"]
        else:
            token = await get_bigship_token()
        
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.pdfgen import canvas as pdf_canvas
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                logger.info(f"[generate_label] Got Bigship token, fetching warehouses")
                
                # Get default warehouse
                wh_response = await client.get(
                    f"{BIGSHIP_API_URL}/warehouse/get/list",
                    params={"page_index": 1, "page_size": 10},
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
                )
                
                warehouse_id = None
                warehouse_pincode = 110001  # Default
                if wh_response.status_code == 200:
                    wh_data = wh_response.json()
                    logger.info(f"[generate_label] Warehouse response keys: {wh_data.keys()}")
                    
                    # Handle both raw Bigship response (data.result_data) and our wrapped response (warehouses)
                    warehouses = []
                    if wh_data.get("data", {}).get("result_data"):
                        warehouses = wh_data["data"]["result_data"]
                    elif wh_data.get("warehouses"):
                        warehouses = wh_data["warehouses"]
                    
                    if warehouses:
                        # Use first warehouse
                        wh = warehouses[0]
                        warehouse_id = wh.get("id") or wh.get("warehouse_id")
                        warehouse_pincode = int(wh.get("pincode") or wh.get("address_pincode") or 110001)
                        logger.info(f"[generate_label] Found warehouse: {wh.get('warehouse_name', wh.get('name', 'Unknown'))}, ID: {warehouse_id}")
                
                if not warehouse_id:
                    return json.dumps({"success": False, "error": "No warehouse configured in Bigship. Please add a pickup location in Bigship portal first."})
                
                logger.info(f"[generate_label] Using warehouse_id: {warehouse_id}, pincode: {warehouse_pincode}")
                
                # Generate invoice PDF
                buffer = io.BytesIO()
                c = pdf_canvas.Canvas(buffer, pagesize=A4)
                c.setFont("Helvetica-Bold", 16)
                c.drawString(200, 800, "SHIPPING INVOICE")
                c.setFont("Helvetica", 12)
                c.drawString(50, 750, f"Invoice Number: {pf.get('order_id', pf['id'])}")
                c.drawString(50, 730, f"Date: {datetime.now(timezone.utc).strftime('%d-%m-%Y')}")
                c.drawString(50, 700, f"Customer: {pf.get('customer_name', '')}")
                c.drawString(50, 680, f"Phone: {pf.get('customer_phone', '')}")
                c.drawString(50, 650, f"Product: {pf.get('master_sku_name', 'Battery/Inverter')}")
                c.drawString(50, 620, f"Amount: Rs. {pf.get('order_value', 0)}")
                c.save()
                
                pdf_bytes = buffer.getvalue()
                pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
                
                # Parse customer name - ensure min 3 chars per API spec
                customer_name = pf.get("customer_name", "Customer")
                name_parts = customer_name.split() if customer_name else ["Customer"]
                first_name = name_parts[0] if name_parts and len(name_parts[0]) >= 3 else "Customer"
                last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else "Name"
                if len(last_name) < 3:
                    last_name = "Name"
                
                # Clean phone number (10 digits only)
                phone = pf.get("customer_phone", "")
                if phone.startswith("+91"):
                    phone = phone[3:]
                phone = ''.join(filter(str.isdigit, phone))[-10:]
                if len(phone) != 10:
                    return json.dumps({"success": False, "error": f"Invalid phone number: {phone}. Must be 10 digits."})
                
                # Build address properly - ensure min 10 chars as per API spec
                address = pf.get("address", "")
                city = pf.get("city", "")
                state = pf.get("state", "")
                address_line1 = address[:50] if len(address) >= 10 else f"{address}, {city}"[:50]
                if len(address_line1) < 10:
                    address_line1 = f"{address_line1}, India"[:50]
                address_line2 = f"{city}, {state}"[:50] if city else state[:50]
                
                # invoice_id must be 1-25 chars - remove dashes if needed
                order_id = pf.get("order_id", pf["id"])
                invoice_id = order_id.replace('-', '')[:25] if len(order_id) > 25 else order_id[:25]
                
                # Get shipment amount
                shipment_amount = int(pf.get("order_value", 0)) or 1000
                
                # Create shipment payload - CORRECT STRUCTURE matching Bigship API
                # consignee_detail is at ROOT level, document_detail is INSIDE order_detail
                payload = {
                    "shipment_category": "b2c",
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
                        "email_id": "",
                        "consignee_address": {
                            "address_line1": address_line1,
                            "address_line2": address_line2,
                            "address_landmark": "",
                            "pincode": str(pf.get("pincode", "110001"))
                        }
                    },
                    "order_detail": {
                        "invoice_date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                        "invoice_id": invoice_id,
                        "payment_type": "Prepaid",
                        "total_collectable_amount": 0,
                        "shipment_invoice_amount": shipment_amount,
                        "box_details": [{
                            "each_box_dead_weight": 5.0,
                            "each_box_length": 30,
                            "each_box_width": 30,
                            "each_box_height": 30,
                            "each_box_invoice_amount": shipment_amount,
                            "each_box_collectable_amount": 0,
                            "box_count": 1,
                            "product_details": [{
                                "product_category": "Others",
                                "product_sub_category": "General",
                                "product_name": pf.get("master_sku_name", "Battery/Inverter")[:50],
                                "product_quantity": pf.get("quantity", 1),
                                "each_product_invoice_amount": shipment_amount,
                                "each_product_collectable_amount": 0,
                                "hsn": ""
                            }]
                        }],
                        "ewaybill_number": "",
                        "document_detail": {
                            "invoice_document_file": f"data:application/pdf;base64,{pdf_base64}",
                            "ewaybill_document_file": ""
                        }
                    }
                }
                
                logger.info(f"[generate_label] Creating shipment with payload keys: {payload.keys()}")
                
                order_response = await client.post(
                    f"{BIGSHIP_API_URL}/order/add/single",
                    json=payload,
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
                )
                
                order_data = order_response.json()
                logger.info(f"[generate_label] Create order response: {order_data}")
                
                if not order_data.get("success"):
                    error_msg = order_data.get("message", "Failed to create shipment")
                    if order_data.get("validationErrors"):
                        errors = [f"{e.get('propertyName', 'Field')}: {e.get('errorMessage', 'Error')}" for e in order_data["validationErrors"]]
                        error_msg = "; ".join(errors)
                    return json.dumps({"success": False, "error": f"Bigship error: {error_msg}"})
                
                # Extract system_order_id
                order_msg = order_data.get("data", "")
                system_order_id = None
                if isinstance(order_msg, str) and "system_order_id is" in order_msg:
                    system_order_id = order_msg.split("system_order_id is ")[-1].strip()
                
                if not system_order_id:
                    return json.dumps({"success": False, "error": "Could not get system_order_id from Bigship response"})
                
                logger.info(f"[generate_label] Got system_order_id: {system_order_id}")
                
                # Get courier rates (warehouse_pincode already set from warehouse lookup)
                rate_response = await client.post(
                    f"{BIGSHIP_API_URL}/courier/get/serviceability",
                    json={
                        "shipment_category": "b2c",
                        "payment_type": "Prepaid",
                        "pickup_pincode": warehouse_pincode,
                        "destination_pincode": int(pf.get("pincode", "110001")),
                        "shipment_invoice_amount": int(pf.get("order_value", 0)) or 1000,
                        "box_details": [{"each_box_dead_weight": 5.0, "each_box_length": 30, "each_box_width": 30, "each_box_height": 30}]
                    },
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
                )
                
                courier_id = None
                courier_name = None
                if rate_response.status_code == 200:
                    rate_data = rate_response.json()
                    logger.info(f"[generate_label] Rate response: {rate_data}")
                    if rate_data.get("success") and rate_data.get("data"):
                        couriers = rate_data["data"]
                        if couriers:
                            sorted_couriers = sorted(couriers, key=lambda x: float(x.get("totalCharges", 999999)))
                            courier_id = sorted_couriers[0].get("courierId")
                            courier_name = sorted_couriers[0].get("courierName")
                            logger.info(f"[generate_label] Selected courier: {courier_name} (ID: {courier_id})")
                
                if not courier_id:
                    return json.dumps({
                        "success": True,
                        "message": "Shipment created in Bigship but no courier serviceable for this pincode. Manual courier selection required.",
                        "system_order_id": system_order_id,
                        "needs_manual_courier_selection": True
                    })
                
                # Manifest - assign courier and get AWB
                manifest_response = await client.post(
                    f"{BIGSHIP_API_URL}/order/manifest/single",
                    json={
                        "system_order_id": int(system_order_id),
                        "courier_id": int(courier_id)
                    },
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
                )
                
                manifest_data = manifest_response.json()
                logger.info(f"[generate_label] Manifest response: {manifest_data}")
                
                if not manifest_data.get("success"):
                    return json.dumps({
                        "success": True,
                        "message": f"Shipment created but courier assignment failed: {manifest_data.get('message')}. System order ID: {system_order_id}",
                        "system_order_id": system_order_id
                    })
                
                # Get AWB from response
                awb_number = manifest_data.get("data", {}).get("awb_number")
                label_url = manifest_data.get("data", {}).get("label_url")
                
                if awb_number:
                    # Update order with tracking
                    await self.db.pending_fulfillment.update_one(
                        {"id": pf["id"]},
                        {"$set": {
                            "tracking_id": awb_number,
                            "courier": courier_name,
                            "label_url": label_url,
                            "bigship_order_id": system_order_id,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    logger.info(f"[generate_label] SUCCESS! AWB: {awb_number}")
                    
                    return json.dumps({
                        "success": True,
                        "message": f"Label generated! AWB: {awb_number} via {courier_name}",
                        "tracking_id": awb_number,
                        "courier": courier_name,
                        "label_url": label_url,
                        "system_order_id": system_order_id
                    })
                
                return json.dumps({
                    "success": True,
                    "message": "Shipment manifested but AWB pending. Check Bigship portal.",
                    "system_order_id": system_order_id,
                    "courier": courier_name
                })
                
        except Exception as e:
            logger.error(f"[generate_label] Error: {e}", exc_info=True)
            return json.dumps({"success": False, "error": str(e)})
    
    async def _reserve_serial_for_order(self, order_id: str, serial_number: str = None) -> str:
        """Reserve a serial number for an order"""
        logger.info(f"[reserve_serial] Order: {order_id}, Serial: {serial_number}")
        
        # Find the order
        pf = await self.db.pending_fulfillment.find_one(
            {"$or": [{"id": order_id}, {"order_id": order_id}, {"amazon_order_id": order_id}]},
            {"_id": 0}
        )
        
        if not pf:
            return json.dumps({"success": False, "error": f"Order {order_id} not found"})
        
        if not pf.get("is_manufactured"):
            return json.dumps({
                "success": True,
                "message": "Order is not for a manufactured item - no serial needed",
                "needs_serial": False
            })
        
        # If no serial specified, auto-select first available
        if not serial_number:
            available = await self.db.finished_good_serials.find_one({
                "master_sku_id": pf.get("master_sku_id"),
                "firm_id": pf.get("firm_id"),
                "status": "in_stock"
            }, {"_id": 0})
            
            if not available:
                return json.dumps({
                    "success": False,
                    "error": "No stock available for this SKU",
                    "master_sku_id": pf.get("master_sku_id")
                })
            
            serial_number = available["serial_number"]
        
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Atomically reserve
        result = await self.db.finished_good_serials.find_one_and_update(
            {
                "serial_number": serial_number,
                "$or": [
                    {"status": "in_stock"},
                    {"status": "reserved", "reserved_by_order_id": pf["id"]}
                ]
            },
            {"$set": {
                "status": "reserved",
                "reserved_by_order_id": pf["id"],
                "reserved_at": now_iso,
                "updated_at": now_iso
            }},
            return_document=True
        )
        
        if not result:
            return json.dumps({
                "success": False,
                "error": f"Serial {serial_number} not available or already reserved"
            })
        
        # Update order
        await self.db.pending_fulfillment.update_one(
            {"id": pf["id"]},
            {"$set": {
                "serial_number": serial_number,
                "updated_at": now_iso
            }}
        )
        
        logger.info(f"[reserve_serial] Reserved {serial_number} for {pf.get('order_id')}")
        
        return json.dumps({
            "success": True,
            "message": f"Serial {serial_number} reserved for order {pf.get('order_id')}",
            "serial_number": serial_number,
            "order_id": pf["id"]
        })
    
    async def _create_dispatch_for_order(self, order_id: str) -> str:
        """Create a dispatch entry and add to dispatcher queue"""
        import uuid
        
        logger.info(f"[create_dispatch] Creating dispatch for: {order_id}")
        
        # Find the order
        pf = await self.db.pending_fulfillment.find_one(
            {"$or": [{"id": order_id}, {"order_id": order_id}, {"amazon_order_id": order_id}]},
            {"_id": 0}
        )
        
        if not pf:
            return json.dumps({"success": False, "error": f"Order {order_id} not found"})
        
        # Check if dispatch already exists
        existing_dispatch = await self.db.dispatches.find_one(
            {"pending_fulfillment_id": pf["id"]},
            {"_id": 0}
        )
        if existing_dispatch:
            dispatch_status = existing_dispatch.get("status")
            
            # If already dispatched, just return info
            if dispatch_status == "dispatched":
                return json.dumps({
                    "success": True,
                    "message": "Order has already been dispatched",
                    "dispatch_number": existing_dispatch.get("dispatch_number"),
                    "status": dispatch_status,
                    "tracking_id": existing_dispatch.get("tracking_id"),
                    "already_dispatched": True
                })
            
            # If ready_to_dispatch or ready_for_dispatch, provide helpful info
            if dispatch_status in ["ready_to_dispatch", "ready_for_dispatch", "pending_label"]:
                return json.dumps({
                    "success": True,
                    "message": f"Dispatch already in queue with status: {dispatch_status}. Use 'mark_dispatched' tool or Dispatcher Dashboard to complete it.",
                    "dispatch_number": existing_dispatch.get("dispatch_number"),
                    "dispatch_id": existing_dispatch.get("id"),
                    "status": dispatch_status,
                    "tracking_id": existing_dispatch.get("tracking_id"),
                    "serial_number": existing_dispatch.get("serial_number"),
                    "already_in_queue": True,
                    "next_action": "mark_dispatched" if dispatch_status == "ready_for_dispatch" else "upload_label"
                })
            
            return json.dumps({
                "success": True,
                "message": "Dispatch already exists",
                "dispatch_number": existing_dispatch.get("dispatch_number"),
                "status": dispatch_status,
                "already_exists": True
            })
        
        # Check requirements
        missing = []
        if pf.get("is_manufactured") and not pf.get("serial_number"):
            missing.append("serial_number")
        if not pf.get("is_easyship") and not pf.get("tracking_id"):
            missing.append("tracking_id")
        # Invoice is optional - don't block dispatch for it
        
        if missing:
            return json.dumps({
                "success": False,
                "error": f"Cannot create dispatch - missing: {', '.join(missing)}",
                "missing_fields": missing
            })
        
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        
        # Generate dispatch number
        dispatch_count = await self.db.dispatches.count_documents({})
        dispatch_number = f"DSP-{now.strftime('%Y%m%d')}-{dispatch_count + 1:04d}"
        
        dispatch_record = {
            "id": str(uuid.uuid4()),
            "dispatch_number": dispatch_number,
            "pending_fulfillment_id": pf["id"],
            "order_id": pf.get("order_id"),
            "amazon_order_id": pf.get("amazon_order_id"),
            "customer_name": pf.get("customer_name"),
            "phone": pf.get("customer_phone"),
            "address": pf.get("address"),
            "city": pf.get("city"),
            "state": pf.get("state"),
            "pincode": pf.get("pincode"),
            "tracking_id": pf.get("tracking_id"),
            "serial_number": pf.get("serial_number"),
            "master_sku_id": pf.get("master_sku_id"),
            "master_sku_code": pf.get("master_sku_code"),
            "master_sku_name": pf.get("master_sku_name"),
            "quantity": pf.get("quantity", 1),
            "firm_id": pf.get("firm_id"),
            "status": "ready_for_dispatch",
            "dispatch_type": "amazon_easyship" if pf.get("is_easyship") else "amazon_mfn",
            "created_at": now_iso,
            "updated_at": now_iso,
            "created_by": self.user.get("id"),
            "created_by_name": f"{self.user.get('first_name', '')} {self.user.get('last_name', '')}"
        }
        
        await self.db.dispatches.insert_one(dispatch_record)
        
        # Update PF status
        await self.db.pending_fulfillment.update_one(
            {"id": pf["id"]},
            {"$set": {
                "status": "in_dispatch_queue",
                "dispatch_id": dispatch_record["id"],
                "updated_at": now_iso
            }}
        )
        
        # Mark serial as dispatched if exists
        if pf.get("serial_number"):
            await self.db.finished_good_serials.update_one(
                {"serial_number": pf["serial_number"]},
                {"$set": {
                    "status": "dispatched",
                    "dispatch_id": dispatch_record["id"],
                    "dispatch_date": now_iso,
                    "updated_at": now_iso
                }}
            )
        
        logger.info(f"[create_dispatch] Created dispatch: {dispatch_number}")
        
        return json.dumps({
            "success": True,
            "message": f"Dispatch {dispatch_number} created and added to queue",
            "dispatch_number": dispatch_number,
            "dispatch_id": dispatch_record["id"],
            "status": "ready_for_dispatch",
            "in_dispatcher_queue": True
        })
    
    async def _get_dispatcher_queue(self, limit: int = 20) -> str:
        """Get current dispatcher queue"""
        dispatches = await self.db.dispatches.find(
            {"status": {"$in": ["pending_label", "ready_for_dispatch", "ready_to_dispatch"]}},
            {"_id": 0}
        ).sort("created_at", 1).limit(limit).to_list(limit)
        
        return json.dumps({
            "total": len(dispatches),
            "dispatches": [
                {
                    "dispatch_number": d.get("dispatch_number"),
                    "order_id": d.get("order_id"),
                    "customer_name": d.get("customer_name"),
                    "tracking_id": d.get("tracking_id"),
                    "serial_number": d.get("serial_number"),
                    "status": d.get("status"),
                    "created_at": d.get("created_at")
                }
                for d in dispatches
            ]
        }, default=str)
    
    async def _full_dispatch_workflow(self, amazon_order_id: str, customer_phone: str = None, skip_label: bool = False) -> str:
        """Execute complete dispatch workflow for an order"""
        logger.info(f"[full_workflow] Starting for: {amazon_order_id}")
        
        results = {
            "amazon_order_id": amazon_order_id,
            "steps": [],
            "success": True
        }
        
        try:
            # Step 1: Check if already in CRM
            pf = await self.db.pending_fulfillment.find_one(
                {"$or": [{"amazon_order_id": amazon_order_id}, {"order_id": amazon_order_id}]},
                {"_id": 0}
            )
            
            if pf:
                results["steps"].append({"step": "check_crm", "status": "exists", "pf_id": pf["id"]})
                order_id = pf["id"]
            else:
                # Import from Amazon
                import_result = await self._import_amazon_order_to_crm(amazon_order_id, customer_phone=customer_phone)
                import_data = json.loads(import_result)
                
                if not import_data.get("success"):
                    results["success"] = False
                    results["error"] = import_data.get("error")
                    results["steps"].append({"step": "import", "status": "failed", "error": import_data.get("error")})
                    return json.dumps(results, default=str)
                
                results["steps"].append({"step": "import", "status": "success", "pf_id": import_data.get("pending_fulfillment_id")})
                order_id = import_data.get("pending_fulfillment_id")
                
                # Refresh PF data
                pf = await self.db.pending_fulfillment.find_one({"id": order_id}, {"_id": 0})
            
            # Step 2: Update phone if provided
            if customer_phone and (not pf.get("customer_phone") or pf.get("customer_phone") != customer_phone):
                update_result = await self._update_pending_fulfillment(order_id, {"customer_phone": customer_phone})
                results["steps"].append({"step": "update_phone", "status": "success"})
            
            # Step 3: Reserve serial if manufactured
            if pf.get("is_manufactured") and not pf.get("serial_number"):
                serial_result = await self._reserve_serial_for_order(order_id)
                serial_data = json.loads(serial_result)
                
                if serial_data.get("success"):
                    results["steps"].append({"step": "reserve_serial", "status": "success", "serial": serial_data.get("serial_number")})
                else:
                    results["steps"].append({"step": "reserve_serial", "status": "failed", "error": serial_data.get("error")})
                    results["success"] = False
                    results["error"] = f"No stock available"
                    return json.dumps(results, default=str)
            
            # Step 4: Generate label if not EasyShip
            if not pf.get("is_easyship") and not skip_label and not pf.get("tracking_id"):
                label_result = await self._generate_shipping_label(order_id)
                label_data = json.loads(label_result)
                
                if label_data.get("success"):
                    results["steps"].append({"step": "generate_label", "status": "success", "tracking_id": label_data.get("tracking_id")})
                else:
                    results["steps"].append({"step": "generate_label", "status": "failed", "error": label_data.get("error")})
                    # Don't fail the whole workflow for label issues
            elif pf.get("is_easyship"):
                results["steps"].append({"step": "generate_label", "status": "skipped", "reason": "EasyShip order"})
            
            # Step 5: Create dispatch
            dispatch_result = await self._create_dispatch_for_order(order_id)
            dispatch_data = json.loads(dispatch_result)
            
            if dispatch_data.get("success"):
                results["steps"].append({"step": "create_dispatch", "status": "success", "dispatch_number": dispatch_data.get("dispatch_number")})
                results["dispatch_number"] = dispatch_data.get("dispatch_number")
                results["in_dispatcher_queue"] = True
            else:
                results["steps"].append({"step": "create_dispatch", "status": "failed", "error": dispatch_data.get("error")})
                results["success"] = False
                results["error"] = dispatch_data.get("error")
            
            return json.dumps(results, default=str)
            
        except Exception as e:
            logger.error(f"[full_workflow] Error: {e}")
            results["success"] = False
            results["error"] = str(e)
            return json.dumps(results, default=str)
    
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

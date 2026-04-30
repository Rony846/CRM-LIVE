"""
MuscleGrid CRM - MCP Server
Exposes CRM functionality as MCP tools for AI agents
Supports both REST API and SSE-based MCP protocol
"""

import os
import json
import asyncio
import httpx
from datetime import datetime, timedelta
from typing import Any, Optional
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

load_dotenv()

# Configuration
CRM_BASE_URL = os.environ.get("CRM_BASE_URL", "https://newcrm.musclegrid.in")
CRM_EMAIL = os.environ.get("CRM_EMAIL")
CRM_PASSWORD = os.environ.get("CRM_PASSWORD")

app = FastAPI(
    title="MuscleGrid CRM MCP Server",
    description="Model Context Protocol server exposing CRM tools for AI agents",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Token cache
_token_cache = {
    "token": None,
    "expires_at": None
}

# ==================== CRM Authentication ====================

async def get_crm_token() -> str:
    """Get or refresh CRM authentication token"""
    now = datetime.utcnow()
    
    # Return cached token if still valid
    if _token_cache["token"] and _token_cache["expires_at"]:
        if now < _token_cache["expires_at"]:
            return _token_cache["token"]
    
    # Fetch new token
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{CRM_BASE_URL}/api/auth/login",
                json={"email": CRM_EMAIL, "password": CRM_PASSWORD}
            )
            response.raise_for_status()
            data = response.json()
            
            token = data.get("access_token") or data.get("token")
            if not token:
                raise Exception("No token in response")
            
            _token_cache["token"] = token
            _token_cache["expires_at"] = now + timedelta(hours=23)
            
            return token
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"CRM authentication failed: {str(e)}")

async def crm_request(method: str, endpoint: str, data: dict = None, params: dict = None) -> dict:
    """Make authenticated request to CRM API"""
    token = await get_crm_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        url = f"{CRM_BASE_URL}/api{endpoint}"
        
        try:
            if method == "GET":
                response = await client.get(url, headers=headers, params=params)
            elif method == "POST":
                response = await client.post(url, headers=headers, json=data)
            elif method == "PATCH":
                response = await client.patch(url, headers=headers, json=data)
            elif method == "PUT":
                response = await client.put(url, headers=headers, json=data)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            error_detail = e.response.text if e.response else str(e)
            return {"error": True, "status_code": e.response.status_code, "detail": error_detail}
        except Exception as e:
            return {"error": True, "detail": str(e)}

# ==================== MCP Tool Definitions ====================

MCP_TOOLS = [
    # Inventory Tools
    {
        "name": "get_inventory",
        "description": "Get current stock levels for all products. Returns SKU name, quantity, and firm.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "firm_id": {"type": "string", "description": "Optional firm ID to filter by"},
                "item_type": {"type": "string", "enum": ["finished_good", "raw_material"], "description": "Type of inventory item"}
            }
        }
    },
    {
        "name": "get_low_stock_items",
        "description": "Get items with stock below threshold. Useful for reorder alerts.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "threshold": {"type": "integer", "description": "Minimum stock level (default: 10)", "default": 10}
            }
        }
    },
    {
        "name": "get_sku_details",
        "description": "Get details of a specific SKU/product",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sku_id": {"type": "string", "description": "SKU ID to lookup"}
            },
            "required": ["sku_id"]
        }
    },
    {
        "name": "transfer_stock",
        "description": "Transfer stock between firms (warehouses). Atomic operation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "from_firm_id": {"type": "string", "description": "Source firm ID"},
                "to_firm_id": {"type": "string", "description": "Destination firm ID"},
                "item_id": {"type": "string", "description": "SKU ID to transfer"},
                "quantity": {"type": "integer", "description": "Quantity to transfer"},
                "notes": {"type": "string", "description": "Transfer notes"}
            },
            "required": ["from_firm_id", "to_firm_id", "item_id", "quantity"]
        }
    },
    
    # Finance Tools
    {
        "name": "get_sales_ledger",
        "description": "Get sales invoice list with totals and payment status",
        "inputSchema": {
            "type": "object",
            "properties": {
                "start_date": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
                "end_date": {"type": "string", "description": "End date (YYYY-MM-DD)"},
                "firm_id": {"type": "string", "description": "Filter by firm"}
            }
        }
    },
    {
        "name": "get_party_balance",
        "description": "Get outstanding balance for a customer/supplier",
        "inputSchema": {
            "type": "object",
            "properties": {
                "party_id": {"type": "string", "description": "Party ID to check"}
            },
            "required": ["party_id"]
        }
    },
    {
        "name": "get_aging_report",
        "description": "Get receivables or payables aging report (30/60/90 days buckets)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "report_type": {"type": "string", "enum": ["receivables", "payables"], "description": "Type of aging report"},
                "firm_id": {"type": "string", "description": "Filter by firm"}
            },
            "required": ["report_type"]
        }
    },
    {
        "name": "get_revenue_trends",
        "description": "Get monthly revenue trends for analysis",
        "inputSchema": {
            "type": "object",
            "properties": {
                "period": {"type": "string", "enum": ["3months", "6months", "12months", "ytd"], "description": "Time period"},
                "firm_id": {"type": "string", "description": "Filter by firm"}
            }
        }
    },
    {
        "name": "get_profit_loss",
        "description": "Get profit & loss statement",
        "inputSchema": {
            "type": "object",
            "properties": {
                "period": {"type": "string", "enum": ["this_month", "last_month", "this_quarter", "this_year"], "description": "Time period"},
                "firm_id": {"type": "string", "description": "Filter by firm"}
            }
        }
    },
    {
        "name": "get_gst_summary",
        "description": "Get GST summary for filing (GSTR-1, GSTR-3B data)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "period": {"type": "string", "description": "Period (this_month, last_month, etc.)"},
                "firm_id": {"type": "string", "description": "Filter by firm"}
            }
        }
    },
    {
        "name": "record_payment",
        "description": "Record a payment received or made",
        "inputSchema": {
            "type": "object",
            "properties": {
                "party_id": {"type": "string", "description": "Customer/Supplier ID"},
                "firm_id": {"type": "string", "description": "Your firm ID"},
                "amount": {"type": "number", "description": "Payment amount"},
                "payment_type": {"type": "string", "enum": ["received", "made"], "description": "Payment direction"},
                "payment_mode": {"type": "string", "enum": ["cash", "upi", "neft", "cheque", "card"], "description": "Payment method"},
                "reference_number": {"type": "string", "description": "UTR/Cheque/Reference number"},
                "payment_date": {"type": "string", "description": "Date (YYYY-MM-DD)"}
            },
            "required": ["party_id", "firm_id", "amount", "payment_type", "payment_mode"]
        }
    },
    
    # Order & Dispatch Tools
    {
        "name": "get_pending_orders",
        "description": "Get orders pending fulfillment/dispatch",
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "description": "Filter by status"}
            }
        }
    },
    {
        "name": "create_dispatch",
        "description": "Create a dispatch/shipment for an order",
        "inputSchema": {
            "type": "object",
            "properties": {
                "customer_name": {"type": "string", "description": "Customer name"},
                "phone": {"type": "string", "description": "Phone number"},
                "address": {"type": "string", "description": "Shipping address"},
                "city": {"type": "string", "description": "City"},
                "state": {"type": "string", "description": "State"},
                "pincode": {"type": "string", "description": "Pincode"},
                "firm_id": {"type": "string", "description": "Your firm ID"},
                "items": {"type": "array", "description": "Array of {master_sku_id, quantity, unit_price}"}
            },
            "required": ["customer_name", "phone", "address", "city", "state", "pincode", "firm_id", "items"]
        }
    },
    {
        "name": "get_dispatches",
        "description": "List dispatches with status",
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["pending_fulfillment", "pending_dispatch", "dispatched", "delivered", "cancelled"]},
                "search": {"type": "string", "description": "Search by name/phone/AWB"}
            }
        }
    },
    {
        "name": "update_dispatch_status",
        "description": "Update dispatch status (e.g., mark as shipped)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "dispatch_id": {"type": "string", "description": "Dispatch ID"},
                "status": {"type": "string", "enum": ["pending_dispatch", "dispatched", "delivered", "cancelled"]},
                "awb_number": {"type": "string", "description": "AWB/Tracking number"},
                "courier": {"type": "string", "description": "Courier partner name"}
            },
            "required": ["dispatch_id", "status"]
        }
    },
    
    # Support Ticket Tools
    {
        "name": "get_tickets",
        "description": "Get support tickets with filters",
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["new_request", "assigned", "in_progress", "resolved", "closed"]},
                "support_type": {"type": "string", "enum": ["hardware", "phone"]},
                "search": {"type": "string", "description": "Search by phone/name/serial"}
            }
        }
    },
    {
        "name": "create_ticket",
        "description": "Create a new support ticket",
        "inputSchema": {
            "type": "object",
            "properties": {
                "first_name": {"type": "string"},
                "last_name": {"type": "string"},
                "phone": {"type": "string"},
                "device_type": {"type": "string", "enum": ["inverter", "battery", "ups", "solar_panel", "other"]},
                "serial_number": {"type": "string"},
                "issue_description": {"type": "string"},
                "support_type": {"type": "string", "enum": ["hardware", "phone"]}
            },
            "required": ["first_name", "phone", "device_type", "issue_description"]
        }
    },
    {
        "name": "get_sla_breaches",
        "description": "Get tickets that have breached SLA",
        "inputSchema": {"type": "object", "properties": {}}
    },
    
    # Dealer Tools
    {
        "name": "get_dealer_orders",
        "description": "Get all dealer orders (admin view)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "description": "Filter by status"}
            }
        }
    },
    {
        "name": "approve_dealer_order",
        "description": "Approve a dealer order",
        "inputSchema": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string", "description": "Order ID to approve"}
            },
            "required": ["order_id"]
        }
    },
    {
        "name": "get_overdue_payments",
        "description": "Get dealer orders with overdue payment verification",
        "inputSchema": {"type": "object", "properties": {}}
    },
    
    # Party/Customer Tools
    {
        "name": "get_parties",
        "description": "List customers and suppliers",
        "inputSchema": {
            "type": "object",
            "properties": {
                "party_type": {"type": "string", "enum": ["customer", "supplier", "both"]},
                "search": {"type": "string", "description": "Search by name/phone/GSTIN"}
            }
        }
    },
    {
        "name": "create_party",
        "description": "Create a new customer or supplier",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Party name"},
                "party_type": {"type": "string", "enum": ["customer", "supplier"]},
                "phone": {"type": "string"},
                "email": {"type": "string"},
                "gstin": {"type": "string", "description": "GST number"},
                "address": {"type": "string"},
                "city": {"type": "string"},
                "state": {"type": "string"},
                "pincode": {"type": "string"}
            },
            "required": ["name", "party_type"]
        }
    },
    {
        "name": "get_party_ledger",
        "description": "Get transaction history for a party",
        "inputSchema": {
            "type": "object",
            "properties": {
                "party_id": {"type": "string", "description": "Party ID"}
            },
            "required": ["party_id"]
        }
    },
    
    # Admin/Dashboard Tools
    {
        "name": "get_dashboard_stats",
        "description": "Get overall CRM dashboard statistics",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "get_firms",
        "description": "List all firms/warehouses",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "get_top_customers",
        "description": "Get top customers by revenue",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Number of customers (default 10)"},
                "period": {"type": "string", "description": "Time period"}
            }
        }
    },
    
    # Warranty Tools
    {
        "name": "get_warranties",
        "description": "List warranty registrations",
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["pending", "approved", "rejected", "expired"]}
            }
        }
    },
    {
        "name": "register_warranty",
        "description": "Register a new warranty",
        "inputSchema": {
            "type": "object",
            "properties": {
                "first_name": {"type": "string"},
                "last_name": {"type": "string"},
                "phone": {"type": "string"},
                "email": {"type": "string"},
                "device_type": {"type": "string"},
                "product_name": {"type": "string"},
                "serial_number": {"type": "string"},
                "invoice_date": {"type": "string", "description": "YYYY-MM-DD"},
                "invoice_amount": {"type": "number"}
            },
            "required": ["first_name", "phone", "device_type", "serial_number", "invoice_date"]
        }
    },
    
    # E-commerce Tools
    {
        "name": "get_amazon_orders",
        "description": "Get scraped Amazon seller orders",
        "inputSchema": {"type": "object", "properties": {}}
    },
    
    # WhatsApp Tools
    {
        "name": "send_whatsapp_message",
        "description": "Send a WhatsApp message",
        "inputSchema": {
            "type": "object",
            "properties": {
                "phone": {"type": "string", "description": "Phone number with country code (e.g., 919876543210)"},
                "message": {"type": "string", "description": "Message text"}
            },
            "required": ["phone", "message"]
        }
    },
    {
        "name": "get_whatsapp_status",
        "description": "Check WhatsApp connection status",
        "inputSchema": {"type": "object", "properties": {}}
    },
    
    # Discovery Tools - Help AI find correct names/IDs
    {
        "name": "list_party_names",
        "description": "Get a list of all party (customer/supplier) names in the system. Use this FIRST to find exact party names before querying ledgers or balances.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "party_type": {"type": "string", "enum": ["customer", "supplier"], "description": "Filter by type (optional)"}
            }
        }
    },
    {
        "name": "list_sku_names",
        "description": "Get a list of all SKU/product names in inventory. Use this to find exact product names.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "list_firm_names",
        "description": "Get a list of all firm/warehouse names. Use this to find exact firm names for filtering.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "smart_search",
        "description": "Intelligent search across parties, SKUs, tickets, and dispatches. Returns matches from all categories. Use when unsure which category to search.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search term (name, phone, GSTIN, serial number, etc.)"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "find_party_by_name",
        "description": "Find a party by name with fuzzy matching. Returns party details including ID for ledger queries. More forgiving than exact search.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Party name to search (partial match supported)"}
            },
            "required": ["name"]
        }
    }
]

# ==================== Tool Execution ====================

async def execute_tool(tool_name: str, arguments: dict) -> dict:
    """Execute an MCP tool and return results"""
    
    try:
        # Inventory Tools
        if tool_name == "get_inventory":
            params = {}
            if arguments.get("firm_id"):
                params["firm_id"] = arguments["firm_id"]
            if arguments.get("item_type"):
                params["item_type"] = arguments["item_type"]
            return await crm_request("GET", "/inventory/stock", params=params)
        
        elif tool_name == "get_low_stock_items":
            threshold = arguments.get("threshold", 10)
            stock = await crm_request("GET", "/inventory/stock")
            if isinstance(stock, list):
                low_stock = [item for item in stock if item.get("quantity", 0) < threshold]
                return {"low_stock_items": low_stock, "count": len(low_stock), "threshold": threshold}
            return stock
        
        elif tool_name == "get_sku_details":
            return await crm_request("GET", f"/master-skus/{arguments['sku_id']}")
        
        elif tool_name == "transfer_stock":
            return await crm_request("POST", "/inventory/transfer", data={
                "from_firm_id": arguments["from_firm_id"],
                "to_firm_id": arguments["to_firm_id"],
                "item_type": "finished_good",
                "item_id": arguments["item_id"],
                "quantity": arguments["quantity"],
                "notes": arguments.get("notes", "MCP transfer")
            })
        
        # Finance Tools
        elif tool_name == "get_sales_ledger":
            params = {}
            if arguments.get("start_date"):
                params["start_date"] = arguments["start_date"]
            if arguments.get("end_date"):
                params["end_date"] = arguments["end_date"]
            if arguments.get("firm_id"):
                params["firm_id"] = arguments["firm_id"]
            return await crm_request("GET", "/sales-invoices", params=params)
        
        elif tool_name == "get_party_balance":
            return await crm_request("GET", f"/party-ledger/{arguments['party_id']}/balance")
        
        elif tool_name == "get_aging_report":
            params = {"report_type": arguments["report_type"]}
            if arguments.get("firm_id"):
                params["firm_id"] = arguments["firm_id"]
            return await crm_request("GET", "/finance/analytics/aging-report", params=params)
        
        elif tool_name == "get_revenue_trends":
            params = {"period": arguments.get("period", "6months")}
            if arguments.get("firm_id"):
                params["firm_id"] = arguments["firm_id"]
            return await crm_request("GET", "/finance/analytics/revenue-trends", params=params)
        
        elif tool_name == "get_profit_loss":
            params = {"period": arguments.get("period", "this_month")}
            if arguments.get("firm_id"):
                params["firm_id"] = arguments["firm_id"]
            return await crm_request("GET", "/finance/analytics/profit-loss", params=params)
        
        elif tool_name == "get_gst_summary":
            params = {}
            if arguments.get("period"):
                params["period"] = arguments["period"]
            if arguments.get("firm_id"):
                params["firm_id"] = arguments["firm_id"]
            return await crm_request("GET", "/finance/analytics/gst-summary", params=params)
        
        elif tool_name == "record_payment":
            return await crm_request("POST", "/payments", data=arguments)
        
        # Order & Dispatch Tools
        elif tool_name == "get_pending_orders":
            params = {}
            if arguments.get("status"):
                params["status"] = arguments["status"]
            return await crm_request("GET", "/pending-fulfillment", params=params)
        
        elif tool_name == "create_dispatch":
            return await crm_request("POST", "/dispatches", data=arguments)
        
        elif tool_name == "get_dispatches":
            params = {}
            if arguments.get("status"):
                params["status"] = arguments["status"]
            if arguments.get("search"):
                params["search"] = arguments["search"]
            return await crm_request("GET", "/dispatches", params=params)
        
        elif tool_name == "update_dispatch_status":
            data = {"status": arguments["status"]}
            if arguments.get("awb_number"):
                data["awb_number"] = arguments["awb_number"]
            if arguments.get("courier"):
                data["courier"] = arguments["courier"]
            return await crm_request("PATCH", f"/dispatches/{arguments['dispatch_id']}/status", data=data)
        
        # Support Ticket Tools
        elif tool_name == "get_tickets":
            params = {}
            if arguments.get("status"):
                params["status"] = arguments["status"]
            if arguments.get("support_type"):
                params["support_type"] = arguments["support_type"]
            if arguments.get("search"):
                params["search"] = arguments["search"]
            return await crm_request("GET", "/tickets", params=params)
        
        elif tool_name == "create_ticket":
            return await crm_request("POST", "/tickets", data=arguments)
        
        elif tool_name == "get_sla_breaches":
            return await crm_request("GET", "/admin/sla/breached-tickets")
        
        # Dealer Tools
        elif tool_name == "get_dealer_orders":
            params = {}
            if arguments.get("status"):
                params["status"] = arguments["status"]
            return await crm_request("GET", "/admin/dealer-orders", params=params)
        
        elif tool_name == "approve_dealer_order":
            return await crm_request("POST", f"/admin/dealer-orders/{arguments['order_id']}/approve")
        
        elif tool_name == "get_overdue_payments":
            return await crm_request("GET", "/admin/dealer-orders/overdue-verifications")
        
        # Party Tools
        elif tool_name == "get_parties":
            params = {}
            # Only pass party_type if it's a valid specific type (not "both" or empty)
            party_type = arguments.get("party_type")
            if party_type and party_type not in ["both", "all"]:
                params["party_type"] = party_type
            if arguments.get("search"):
                params["search"] = arguments["search"]
            return await crm_request("GET", "/parties", params=params)
        
        elif tool_name == "create_party":
            return await crm_request("POST", "/parties", data=arguments)
        
        elif tool_name == "get_party_ledger":
            return await crm_request("GET", f"/party-ledger/{arguments['party_id']}")
        
        # Admin Tools
        elif tool_name == "get_dashboard_stats":
            return await crm_request("GET", "/admin/stats")
        
        elif tool_name == "get_firms":
            return await crm_request("GET", "/firms")
        
        elif tool_name == "get_top_customers":
            params = {"limit": arguments.get("limit", 10)}
            if arguments.get("period"):
                params["period"] = arguments["period"]
            return await crm_request("GET", "/finance/analytics/top-customers", params=params)
        
        # Warranty Tools
        elif tool_name == "get_warranties":
            params = {}
            if arguments.get("status"):
                params["status"] = arguments["status"]
            return await crm_request("GET", "/warranties", params=params)
        
        elif tool_name == "register_warranty":
            return await crm_request("POST", "/warranties", data=arguments)
        
        # E-commerce Tools
        elif tool_name == "get_amazon_orders":
            return await crm_request("GET", "/browser-agent/orders")
        
        # WhatsApp Tools
        elif tool_name == "send_whatsapp_message":
            return await crm_request("POST", "/whatsapp/send", data={
                "phone": arguments["phone"],
                "message": arguments["message"]
            })
        
        elif tool_name == "get_whatsapp_status":
            return await crm_request("GET", "/whatsapp/status")
        
        # Discovery Tools - Help AI find correct names/IDs
        elif tool_name == "list_party_names":
            params = {}
            if arguments.get("party_type") and arguments["party_type"] not in ["both", "all"]:
                params["party_type"] = arguments["party_type"]
            parties = await crm_request("GET", "/parties", params=params)
            if isinstance(parties, list):
                return {
                    "count": len(parties),
                    "parties": [
                        {
                            "id": p.get("id"),
                            "name": p.get("name"),
                            "type": p.get("party_types", []),
                            "gstin": p.get("gstin"),
                            "balance": p.get("current_balance", 0)
                        }
                        for p in parties[:100]  # Limit to 100
                    ]
                }
            return parties
        
        elif tool_name == "list_sku_names":
            skus = await crm_request("GET", "/master-skus")
            if isinstance(skus, list):
                return {
                    "count": len(skus),
                    "skus": [
                        {
                            "id": s.get("id"),
                            "name": s.get("name"),
                            "sku_code": s.get("sku_code"),
                            "category": s.get("category")
                        }
                        for s in skus[:100]
                    ]
                }
            return skus
        
        elif tool_name == "list_firm_names":
            firms = await crm_request("GET", "/firms")
            if isinstance(firms, list):
                return {
                    "count": len(firms),
                    "firms": [{"id": f.get("id"), "name": f.get("name"), "gstin": f.get("gstin")} for f in firms]
                }
            return firms
        
        elif tool_name == "smart_search":
            query = arguments.get("query", "").lower()
            results = {"parties": [], "skus": [], "tickets": [], "dispatches": []}
            
            # Search parties
            parties = await crm_request("GET", "/parties", params={"search": query})
            if isinstance(parties, list):
                results["parties"] = [{"id": p.get("id"), "name": p.get("name"), "type": p.get("party_types")} for p in parties[:10]]
            
            # Search tickets
            tickets = await crm_request("GET", "/tickets", params={"search": query})
            if isinstance(tickets, list):
                results["tickets"] = [{"id": t.get("id"), "customer": t.get("first_name"), "phone": t.get("phone"), "status": t.get("status")} for t in tickets[:10]]
            
            # Search dispatches
            dispatches = await crm_request("GET", "/dispatches", params={"search": query})
            if isinstance(dispatches, list):
                results["dispatches"] = [{"id": d.get("id"), "customer": d.get("customer_name"), "status": d.get("status")} for d in dispatches[:10]]
            
            return results
        
        elif tool_name == "find_party_by_name":
            name = arguments.get("name", "")
            # Try exact search first
            parties = await crm_request("GET", "/parties", params={"search": name})
            
            if isinstance(parties, list) and len(parties) > 0:
                # Return all matches with details
                return {
                    "found": True,
                    "count": len(parties),
                    "matches": [
                        {
                            "id": p.get("id"),
                            "name": p.get("name"),
                            "type": p.get("party_types", []),
                            "gstin": p.get("gstin"),
                            "phone": p.get("phone"),
                            "email": p.get("email"),
                            "current_balance": p.get("current_balance", 0),
                            "total_receivable": p.get("total_receivable", 0),
                            "total_payable": p.get("total_payable", 0)
                        }
                        for p in parties
                    ],
                    "hint": "Use the 'id' field to query get_party_ledger or get_party_balance"
                }
            else:
                # No match - get all parties and suggest similar names
                all_parties = await crm_request("GET", "/parties")
                suggestions = []
                if isinstance(all_parties, list):
                    name_lower = name.lower()
                    for p in all_parties:
                        p_name = p.get("name", "").lower()
                        # Simple fuzzy match - contains or starts with
                        if name_lower in p_name or p_name.startswith(name_lower[:3]) if len(name_lower) >= 3 else False:
                            suggestions.append({"id": p.get("id"), "name": p.get("name")})
                
                return {
                    "found": False,
                    "message": f"No party found with name '{name}'",
                    "suggestions": suggestions[:10] if suggestions else "No similar names found. Use list_party_names to see all parties.",
                    "hint": "Try using list_party_names to see all available party names"
                }
        
        else:
            return {"error": True, "detail": f"Unknown tool: {tool_name}"}
    
    except Exception as e:
        return {"error": True, "detail": str(e)}

# ==================== REST API Endpoints ====================

class ToolCallRequest(BaseModel):
    tool_name: str = Field(..., description="Name of the tool to execute")
    arguments: dict = Field(default={}, description="Tool arguments")

@app.get("/")
async def root():
    """Server info"""
    return {
        "name": "MuscleGrid CRM MCP Server",
        "version": "1.0.0",
        "crm_url": CRM_BASE_URL,
        "tools_count": len(MCP_TOOLS),
        "endpoints": {
            "tools_list": "/mcp/tools",
            "execute_tool": "/mcp/execute",
            "sse_endpoint": "/mcp/sse"
        }
    }

@app.get("/health")
async def health():
    """Health check"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/mcp/tools")
async def list_tools():
    """List all available MCP tools"""
    return {"tools": MCP_TOOLS}

@app.post("/mcp/execute")
async def execute_tool_endpoint(request: ToolCallRequest):
    """Execute a tool (REST API style)"""
    result = await execute_tool(request.tool_name, request.arguments)
    return {"tool": request.tool_name, "result": result}

# ==================== MCP Protocol (SSE) ====================

class MCPRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: Optional[int] = None
    method: str
    params: Optional[dict] = None

@app.post("/mcp")
async def mcp_jsonrpc(request: MCPRequest):
    """
    MCP JSON-RPC endpoint for AI agent platforms
    Supports: initialize, tools/list, tools/call
    """
    
    if request.method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "musclegrid-crm-mcp",
                    "version": "1.0.0"
                }
            }
        }
    
    elif request.method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "result": {
                "tools": MCP_TOOLS
            }
        }
    
    elif request.method == "tools/call":
        params = request.params or {}
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        
        if not tool_name:
            return {
                "jsonrpc": "2.0",
                "id": request.id,
                "error": {"code": -32602, "message": "Missing tool name"}
            }
        
        result = await execute_tool(tool_name, arguments)
        
        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(result, indent=2, default=str)
                    }
                ]
            }
        }
    
    else:
        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "error": {"code": -32601, "message": f"Method not found: {request.method}"}
        }

@app.get("/mcp/sse")
async def mcp_sse(request: Request):
    """
    SSE endpoint for MCP protocol
    AI agents can connect here for real-time communication
    """
    async def event_generator():
        # Send initial connection event
        yield {
            "event": "endpoint",
            "data": json.dumps({
                "endpoint": "/mcp",
                "method": "POST"
            })
        }
        
        # Keep connection alive
        while True:
            if await request.is_disconnected():
                break
            yield {"event": "ping", "data": ""}
            await asyncio.sleep(30)
    
    return EventSourceResponse(event_generator())

# ==================== Convenience Endpoints ====================

@app.get("/inventory")
async def get_inventory_direct(firm_id: str = None):
    """Direct inventory endpoint"""
    return await execute_tool("get_inventory", {"firm_id": firm_id})

@app.get("/inventory/low-stock")
async def get_low_stock_direct(threshold: int = 10):
    """Direct low stock endpoint"""
    return await execute_tool("get_low_stock_items", {"threshold": threshold})

@app.get("/dashboard")
async def get_dashboard_direct():
    """Direct dashboard stats endpoint"""
    return await execute_tool("get_dashboard_stats", {})

@app.get("/tickets")
async def get_tickets_direct(status: str = None, search: str = None):
    """Direct tickets endpoint"""
    return await execute_tool("get_tickets", {"status": status, "search": search})

@app.get("/parties")
async def get_parties_direct(party_type: str = None, search: str = None):
    """Direct parties endpoint"""
    return await execute_tool("get_parties", {"party_type": party_type, "search": search})

@app.get("/dispatches")
async def get_dispatches_direct(status: str = None):
    """Direct dispatches endpoint"""
    return await execute_tool("get_dispatches", {"status": status})

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("MCP_PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=port)

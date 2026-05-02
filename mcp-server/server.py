"""
MuscleGrid CRM - MCP Server
Exposes CRM functionality as MCP tools for AI agents
Supports both REST API and SSE-based MCP protocol
"""

import os
import json
import asyncio
import httpx
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Any, Optional
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Request, Depends, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

load_dotenv()

# Configuration
CRM_BASE_URL = os.environ.get("CRM_BASE_URL", "https://newcrm.musclegrid.in")
CRM_EMAIL = os.environ.get("CRM_EMAIL")
CRM_PASSWORD = os.environ.get("CRM_PASSWORD")
MCP_API_KEY = os.environ.get("MCP_API_KEY", "mcp-musclegrid-secret-2024")

# OAuth Configuration
OAUTH_CLIENT_ID = os.environ.get("OAUTH_CLIENT_ID", "musclegrid-mcp-client")
OAUTH_CLIENT_SECRET = os.environ.get("OAUTH_CLIENT_SECRET", "mcp-secret-key-2024-musclegrid")

# Token store (in production, use Redis or database)
_oauth_tokens = {}

# Security
security = HTTPBearer(auto_error=False)

def generate_access_token():
    """Generate a secure access token"""
    return secrets.token_urlsafe(32)

def verify_oauth_token(token: str) -> bool:
    """Verify if OAuth token is valid and not expired"""
    if token in _oauth_tokens:
        token_data = _oauth_tokens[token]
        if datetime.utcnow() < token_data["expires_at"]:
            return True
        else:
            # Token expired, remove it
            del _oauth_tokens[token]
    return False

async def verify_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_api_key: str = Header(None, alias="X-API-Key")
):
    """Verify API key from Bearer token or X-API-Key header"""
    # Check Bearer token (could be API key or OAuth token)
    if credentials:
        token = credentials.credentials
        # Check if it's the static API key
        if token == MCP_API_KEY:
            return True
        # Check if it's a valid OAuth token
        if verify_oauth_token(token):
            return True
    # Check X-API-Key header
    if x_api_key and x_api_key == MCP_API_KEY:
        return True
    # Allow unauthenticated access to health and root endpoints
    return False

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

# ==================== OAuth Discovery Endpoints ====================

@app.get("/.well-known/oauth-authorization-server")
async def oauth_metadata():
    """OAuth 2.0 Authorization Server Metadata (RFC 8414)"""
    return {
        "issuer": "https://mcp.musclegrid.in",
        "authorization_endpoint": "https://mcp.musclegrid.in/authorize",
        "token_endpoint": "https://mcp.musclegrid.in/token",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "client_credentials"],
        "code_challenge_methods_supported": ["S256", "plain"],
        "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"]
    }

@app.get("/.well-known/oauth-protected-resource")
async def resource_metadata():
    """OAuth 2.0 Protected Resource Metadata"""
    return {
        "resource": "https://mcp.musclegrid.in",
        "authorization_servers": ["https://mcp.musclegrid.in"],
        "bearer_methods_supported": ["header"]
    }

# ==================== OAuth Endpoints ====================

# Store for authorization codes
_auth_codes = {}

@app.get("/authorize")
async def oauth_authorize(
    response_type: str,
    client_id: str,
    redirect_uri: str,
    state: str = None,
    scope: str = None,
    code_challenge: str = None,
    code_challenge_method: str = None
):
    """
    OAuth 2.0 Authorization Endpoint with PKCE support
    """
    # Validate client_id
    if client_id != OAUTH_CLIENT_ID:
        raise HTTPException(status_code=400, detail="invalid_client_id")
    
    if response_type != "code":
        raise HTTPException(status_code=400, detail="unsupported_response_type")
    
    # Generate authorization code
    auth_code = secrets.token_urlsafe(32)
    
    # Store the code with PKCE data (expires in 10 minutes)
    _auth_codes[auth_code] = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code_challenge": code_challenge,
        "code_challenge_method": code_challenge_method,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(minutes=10)
    }
    
    # Build redirect URL
    from urllib.parse import urlencode
    redirect_params = {"code": auth_code}
    if state:
        redirect_params["state"] = state
    
    separator = "&" if "?" in redirect_uri else "?"
    redirect_url = f"{redirect_uri}{separator}{urlencode(redirect_params)}"
    
    # Redirect to callback
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=redirect_url)

@app.post("/oauth/token")
async def oauth_token(
    grant_type: str = Form(...),
    client_id: str = Form(None),
    client_secret: str = Form(None),
    code: str = Form(None),
    redirect_uri: str = Form(None),
    code_verifier: str = Form(None)
):
    """
    OAuth 2.0 Token Endpoint with PKCE support
    Supports both authorization_code and client_credentials grants
    """
    import base64
    
    if grant_type == "authorization_code":
        # Authorization Code flow
        if not code:
            raise HTTPException(status_code=400, detail="code_required")
        
        # Validate authorization code
        if code not in _auth_codes:
            raise HTTPException(status_code=400, detail="invalid_code")
        
        code_data = _auth_codes[code]
        
        # Check expiration
        if datetime.utcnow() > code_data["expires_at"]:
            del _auth_codes[code]
            raise HTTPException(status_code=400, detail="code_expired")
        
        # Validate client (if provided)
        if client_id and client_id != code_data["client_id"]:
            raise HTTPException(status_code=400, detail="client_mismatch")
        
        # Verify PKCE code_verifier if code_challenge was provided
        if code_data.get("code_challenge"):
            if not code_verifier:
                raise HTTPException(status_code=400, detail="code_verifier_required")
            
            # Calculate challenge from verifier
            if code_data.get("code_challenge_method") == "S256":
                calculated_challenge = base64.urlsafe_b64encode(
                    hashlib.sha256(code_verifier.encode()).digest()
                ).decode().rstrip("=")
            else:
                calculated_challenge = code_verifier
            
            if calculated_challenge != code_data["code_challenge"]:
                del _auth_codes[code]
                raise HTTPException(status_code=400, detail="invalid_code_verifier")
        
        # Delete the code (one-time use)
        del _auth_codes[code]
        
    elif grant_type == "client_credentials":
        # Client Credentials flow
        if not client_id or not client_secret:
            raise HTTPException(status_code=400, detail="client_credentials_required")
        
        if client_id != OAUTH_CLIENT_ID or client_secret != OAUTH_CLIENT_SECRET:
            raise HTTPException(status_code=401, detail="invalid_client")
    
    else:
        raise HTTPException(status_code=400, detail="unsupported_grant_type")
    
    # Generate access token
    access_token = generate_access_token()
    expires_in = 86400  # 24 hours
    
    # Store token
    _oauth_tokens[access_token] = {
        "client_id": client_id or OAUTH_CLIENT_ID,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(seconds=expires_in)
    }
    
    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": expires_in
    }

@app.post("/token")
async def token_endpoint(
    grant_type: str = Form(...),
    client_id: str = Form(None),
    client_secret: str = Form(None),
    code: str = Form(None),
    redirect_uri: str = Form(None)
):
    """Alias for /oauth/token"""
    return await oauth_token(grant_type, client_id, client_secret, code, redirect_uri)

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
        "name": "get_sku_by_alias",
        "description": "Find SKU by platform-specific alias code (e.g., Amazon ASIN, Flipkart FSN). Returns full SKU details.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "alias_code": {"type": "string", "description": "Platform-specific product code (ASIN, FSN, etc.)"},
                "platform": {"type": "string", "enum": ["Amazon", "Flipkart", "Vyapar", "Other"], "description": "E-commerce platform (default: Amazon)"}
            },
            "required": ["alias_code"]
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
        "description": "Create a dispatch/shipment for an order. Sends multipart form data with invoice PDF to CRM backend.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "dispatch_type": {"type": "string", "enum": ["new_order", "amazon_order", "offline_order", "return_dispatch", "spare_dispatch"], "description": "Type of dispatch (e.g., 'amazon_order' for Amazon orders)"},
                "reason": {"type": "string", "description": "Reason for dispatch (e.g., 'Amazon order', 'Sale')"},
                "sku": {"type": "string", "description": "Single master SKU code (e.g., 'MG10KVA90VAML')"},
                "customer_name": {"type": "string", "description": "Customer name"},
                "phone": {"type": "string", "description": "Phone number (10 digits)"},
                "address": {"type": "string", "description": "Shipping address"},
                "city": {"type": "string", "description": "City"},
                "state": {"type": "string", "description": "State (required for GST)"},
                "pincode": {"type": "string", "description": "Pincode"},
                "firm_id": {"type": "string", "description": "Firm ID for invoice generation"},
                "order_id": {"type": "string", "description": "Order ID / Reference number"},
                "invoice_file_base64": {"type": "string", "description": "Base64-encoded PDF content of invoice/packing slip"},
                "invoice_file_name": {"type": "string", "description": "Filename for the invoice PDF (e.g., 'order_invoice.pdf')"},
                "payment_reference": {"type": "string", "description": "Payment reference (optional for marketplace orders)"},
                "order_source": {"type": "string", "enum": ["amazon", "flipkart", "website", "walkin", "direct", "other"], "description": "Order source platform"},
                "marketplace_order_id": {"type": "string", "description": "External marketplace order ID"},
                "note": {"type": "string", "description": "Additional notes"}
            },
            "required": ["dispatch_type", "reason", "sku", "customer_name", "phone", "address", "state", "firm_id", "order_id", "invoice_file_base64"]
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
        "description": "Update dispatch status. Sends as Form data to CRM backend.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "dispatch_id": {"type": "string", "description": "Dispatch ID"},
                "status": {"type": "string", "enum": ["pending_label", "ready_for_dispatch", "dispatched", "delivered", "cancelled"], "description": "New status value"}
            },
            "required": ["dispatch_id", "status"]
        }
    },
    {
        "name": "attach_dispatch_label",
        "description": "Upload shipping label for a dispatch. Sets status to ready_for_dispatch automatically.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "dispatch_id": {"type": "string", "description": "Dispatch ID"},
                "courier": {"type": "string", "description": "Courier partner name (e.g., 'Delhivery', 'BlueDart')"},
                "tracking_id": {"type": "string", "description": "AWB/Tracking number"},
                "label_file_base64": {"type": "string", "description": "Base64-encoded PDF of shipping label"},
                "label_file_name": {"type": "string", "description": "Filename for the label (e.g., 'order_label.pdf')"}
            },
            "required": ["dispatch_id", "courier", "tracking_id", "label_file_base64"]
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
    },
    
    # Bigship Courier Tools
    {
        "name": "get_courier_warehouses",
        "description": "Get list of registered pickup warehouses/locations for shipping",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "calculate_shipping_rates",
        "description": "Calculate shipping rates from multiple couriers for a shipment. Use this before creating shipment to compare prices.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pickup_pincode": {"type": "string", "description": "Warehouse/pickup pincode"},
                "delivery_pincode": {"type": "string", "description": "Customer delivery pincode"},
                "weight": {"type": "number", "description": "Package weight in kg"},
                "length": {"type": "number", "description": "Length in cm (default 10)"},
                "width": {"type": "number", "description": "Width in cm (default 10)"},
                "height": {"type": "number", "description": "Height in cm (default 10)"},
                "payment_type": {"type": "string", "enum": ["Prepaid", "COD"], "description": "Payment type"},
                "shipment_category": {"type": "string", "enum": ["b2c", "b2b"], "description": "B2C for individuals, B2B for business/heavy shipments"},
                "invoice_amount": {"type": "number", "description": "Invoice value for insurance"}
            },
            "required": ["pickup_pincode", "delivery_pincode", "weight"]
        }
    },
    {
        "name": "create_courier_shipment",
        "description": "Create a new courier shipment with Bigship. Returns system_order_id needed for manifesting.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "warehouse_id": {"type": "string", "description": "Pickup warehouse ID (get from get_courier_warehouses)"},
                "shipment_category": {"type": "string", "enum": ["b2c", "b2b"], "description": "B2C or B2B shipment"},
                "first_name": {"type": "string", "description": "Customer first name"},
                "last_name": {"type": "string", "description": "Customer last name"},
                "company_name": {"type": "string", "description": "Company name (for B2B)"},
                "phone": {"type": "string", "description": "Customer phone (10 digits)"},
                "email": {"type": "string", "description": "Customer email"},
                "address_line1": {"type": "string", "description": "Address line 1"},
                "address_line2": {"type": "string", "description": "Address line 2"},
                "pincode": {"type": "string", "description": "Delivery pincode"},
                "city": {"type": "string", "description": "City"},
                "state": {"type": "string", "description": "State"},
                "weight": {"type": "number", "description": "Weight in kg"},
                "length": {"type": "number", "description": "Length in cm"},
                "width": {"type": "number", "description": "Width in cm"},
                "height": {"type": "number", "description": "Height in cm"},
                "invoice_number": {"type": "string", "description": "Invoice number"},
                "invoice_amount": {"type": "number", "description": "Invoice amount"},
                "product_name": {"type": "string", "description": "Product description"},
                "payment_type": {"type": "string", "enum": ["Prepaid", "COD"], "description": "Payment type"},
                "ewaybill_number": {"type": "string", "description": "E-way bill number (for B2B > 50k)"},
                "invoice_document_file": {"type": "string", "description": "Base64 encoded PDF of invoice document (required for B2B shipments)"}
            },
            "required": ["warehouse_id", "first_name", "phone", "address_line1", "pincode", "city", "state", "weight", "invoice_amount", "product_name"]
        }
    },
    {
        "name": "manifest_shipment",
        "description": "Assign courier and generate AWB (tracking number) for a created shipment. Call this after create_courier_shipment.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "system_order_id": {"type": "string", "description": "System order ID from create_courier_shipment"},
                "courier_id": {"type": "integer", "description": "Courier ID from calculate_shipping_rates"},
                "shipment_category": {"type": "string", "enum": ["b2c", "b2b"], "description": "Must match the created shipment"},
                "risk_type": {"type": "string", "enum": ["OwnerRisk", "CarrierRisk"], "description": "For B2B shipments only"}
            },
            "required": ["system_order_id", "courier_id"]
        }
    },
    {
        "name": "get_shipping_label",
        "description": "Download shipping label PDF for a manifested shipment. Returns base64 encoded PDF or URL.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "system_order_id": {"type": "string", "description": "System order ID of the manifested shipment"}
            },
            "required": ["system_order_id"]
        }
    },
    {
        "name": "track_shipment",
        "description": "Track a shipment by AWB/tracking number",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tracking_number": {"type": "string", "description": "AWB or tracking number"}
            },
            "required": ["tracking_number"]
        }
    },
    {
        "name": "list_courier_shipments",
        "description": "List all courier shipments created through Bigship",
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "description": "Filter by status (created, manifested, in_transit, delivered)"},
                "search": {"type": "string", "description": "Search by AWB, phone, or name"}
            }
        }
    },
    {
        "name": "process_order_for_shipping",
        "description": "Complete workflow: Get a dispatch/order from CRM and create shipping label. Combines multiple steps into one.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "dispatch_id": {"type": "string", "description": "Dispatch ID from CRM"},
                "courier_id": {"type": "integer", "description": "Preferred courier ID (optional, will auto-select cheapest if not provided)"},
                "shipment_category": {"type": "string", "enum": ["b2c", "b2b"], "description": "B2B for business shipments"}
            },
            "required": ["dispatch_id"]
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
        
        elif tool_name == "get_sku_by_alias":
            alias_code = arguments.get("alias_code", "")
            platform = arguments.get("platform", "Amazon")
            
            # Get all SKUs and search for the alias
            skus = await crm_request("GET", "/master-skus")
            if isinstance(skus, list):
                alias_code_lower = alias_code.lower().strip()
                platform_lower = platform.lower() if platform else ""
                
                for sku in skus:
                    # Check in aliases array
                    aliases = sku.get("aliases", [])
                    for alias in aliases:
                        alias_code_value = alias.get("alias_code", "").lower().strip()
                        alias_platform = alias.get("platform", "").lower()
                        
                        if alias_code_value == alias_code_lower:
                            # If platform specified, match it; otherwise return first match
                            if not platform_lower or alias_platform == platform_lower:
                                return {"found": True, "sku": sku, "matched_alias": alias}
                    
                    # Also check sku_code directly
                    if sku.get("sku_code", "").lower().strip() == alias_code_lower:
                        return {"found": True, "sku": sku, "matched_on": "sku_code"}
                
                return {
                    "found": False,
                    "message": f"No SKU found with alias '{alias_code}' on platform '{platform}'",
                    "hint": "Use list_sku_names to see all available SKUs"
                }
            return {"error": True, "detail": "Failed to fetch SKUs"}
        
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
            # Special handling: decode base64 invoice and send as multipart/form-data
            import base64
            import io
            
            token = await get_crm_token()
            
            # Decode base64 invoice file
            invoice_base64 = arguments.get("invoice_file_base64", "")
            invoice_filename = arguments.get("invoice_file_name", "invoice.pdf")
            
            if not invoice_base64:
                return {"error": True, "detail": "invoice_file_base64 is required"}
            
            try:
                invoice_bytes = base64.b64decode(invoice_base64)
            except Exception as e:
                return {"error": True, "detail": f"Invalid base64 encoding: {str(e)}"}
            
            # Build form data
            form_data = {
                "dispatch_type": arguments.get("dispatch_type", "new_order"),
                "reason": arguments.get("reason", "Order"),
                "sku": arguments.get("sku", ""),
                "customer_name": arguments.get("customer_name", ""),
                "phone": arguments.get("phone", ""),
                "address": arguments.get("address", ""),
                "city": arguments.get("city", ""),
                "state": arguments.get("state", ""),
                "pincode": arguments.get("pincode", ""),
                "firm_id": arguments.get("firm_id", ""),
                "order_id": arguments.get("order_id", ""),
            }
            
            # Add optional fields if present
            if arguments.get("payment_reference"):
                form_data["payment_reference"] = arguments["payment_reference"]
            if arguments.get("order_source"):
                form_data["order_source"] = arguments["order_source"]
            if arguments.get("marketplace_order_id"):
                form_data["marketplace_order_id"] = arguments["marketplace_order_id"]
            if arguments.get("note"):
                form_data["note"] = arguments["note"]
            
            # Create multipart file
            files = {
                "invoice_file": (invoice_filename, io.BytesIO(invoice_bytes), "application/pdf")
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                try:
                    url = f"{CRM_BASE_URL}/api/dispatches"
                    response = await client.post(
                        url,
                        headers={"Authorization": f"Bearer {token}"},
                        data=form_data,
                        files=files
                    )
                    response.raise_for_status()
                    return response.json()
                except httpx.HTTPStatusError as e:
                    error_detail = e.response.text if e.response else str(e)
                    return {"error": True, "status_code": e.response.status_code, "detail": error_detail}
                except Exception as e:
                    return {"error": True, "detail": str(e)}
        
        elif tool_name == "get_dispatches":
            params = {}
            if arguments.get("status"):
                params["status"] = arguments["status"]
            if arguments.get("search"):
                params["search"] = arguments["search"]
            return await crm_request("GET", "/dispatches", params=params)
        
        elif tool_name == "update_dispatch_status":
            # Send as Form data (not JSON)
            import io
            
            token = await get_crm_token()
            dispatch_id = arguments.get("dispatch_id")
            status = arguments.get("status")
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                try:
                    url = f"{CRM_BASE_URL}/api/dispatches/{dispatch_id}/status"
                    response = await client.patch(
                        url,
                        headers={"Authorization": f"Bearer {token}"},
                        data={"status": status}  # Form data
                    )
                    response.raise_for_status()
                    return response.json()
                except httpx.HTTPStatusError as e:
                    error_detail = e.response.text if e.response else str(e)
                    return {"error": True, "status_code": e.response.status_code, "detail": error_detail}
                except Exception as e:
                    return {"error": True, "detail": str(e)}
        
        elif tool_name == "attach_dispatch_label":
            # Upload label as multipart/form-data
            import base64
            import io
            
            token = await get_crm_token()
            dispatch_id = arguments.get("dispatch_id")
            courier = arguments.get("courier")
            tracking_id = arguments.get("tracking_id")
            label_base64 = arguments.get("label_file_base64", "")
            label_filename = arguments.get("label_file_name", "label.pdf")
            
            if not label_base64:
                return {"error": True, "detail": "label_file_base64 is required"}
            
            try:
                label_bytes = base64.b64decode(label_base64)
            except Exception as e:
                return {"error": True, "detail": f"Invalid base64 encoding: {str(e)}"}
            
            files = {
                "label_file": (label_filename, io.BytesIO(label_bytes), "application/pdf")
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                try:
                    url = f"{CRM_BASE_URL}/api/dispatches/{dispatch_id}/label"
                    response = await client.patch(
                        url,
                        headers={"Authorization": f"Bearer {token}"},
                        data={"courier": courier, "tracking_id": tracking_id},
                        files=files
                    )
                    response.raise_for_status()
                    return response.json()
                except httpx.HTTPStatusError as e:
                    error_detail = e.response.text if e.response else str(e)
                    return {"error": True, "status_code": e.response.status_code, "detail": error_detail}
                except Exception as e:
                    return {"error": True, "detail": str(e)}
        
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
        
        # Bigship Courier Tools
        elif tool_name == "get_courier_warehouses":
            return await crm_request("GET", "/courier/warehouses")
        
        elif tool_name == "calculate_shipping_rates":
            payload = {
                "pickup_pincode": arguments.get("pickup_pincode"),
                "destination_pincode": arguments.get("delivery_pincode") or arguments.get("destination_pincode"),
                "weight": arguments.get("weight", 1),
                "length": arguments.get("length", 10),
                "width": arguments.get("width", 10),
                "height": arguments.get("height", 10),
                "payment_type": arguments.get("payment_type", "Prepaid"),
                "shipment_category": arguments.get("shipment_category", "b2c").upper(),
                "invoice_amount": arguments.get("invoice_amount", 1000)
            }
            return await crm_request("POST", "/courier/calculate-rates", data=payload)
        
        elif tool_name == "create_courier_shipment":
            return await crm_request("POST", "/courier/create-shipment", data=arguments)
        
        elif tool_name == "manifest_shipment":
            payload = {
                "system_order_id": arguments.get("system_order_id"),
                "courier_id": arguments.get("courier_id"),
                "shipment_category": arguments.get("shipment_category", "b2c"),
                "risk_type": arguments.get("risk_type", "OwnerRisk")
            }
            return await crm_request("POST", "/courier/manifest", data=payload)
        
        elif tool_name == "get_shipping_label":
            system_order_id = arguments.get("system_order_id")
            return await crm_request("GET", f"/courier/label/{system_order_id}")
        
        elif tool_name == "track_shipment":
            tracking_number = arguments.get("tracking_number")
            return await crm_request("GET", f"/courier/track/{tracking_number}")
        
        elif tool_name == "list_courier_shipments":
            params = {}
            if arguments.get("status"):
                params["status"] = arguments["status"]
            if arguments.get("search"):
                params["search"] = arguments["search"]
            return await crm_request("GET", "/courier/shipments", params=params)
        
        elif tool_name == "process_order_for_shipping":
            # Complete workflow: Get dispatch -> Create shipment -> Manifest -> Get label
            dispatch_id = arguments.get("dispatch_id")
            courier_id = arguments.get("courier_id")
            shipment_category = arguments.get("shipment_category", "b2c")
            
            # Step 1: Get dispatch details
            dispatch = await crm_request("GET", f"/dispatches/{dispatch_id}")
            if not dispatch or dispatch.get("error"):
                return {"error": True, "detail": f"Dispatch not found: {dispatch_id}"}
            
            # Step 2: Get warehouse info
            warehouses = await crm_request("GET", "/courier/warehouses")
            if not warehouses or not isinstance(warehouses, list) or len(warehouses) == 0:
                return {"error": True, "detail": "No warehouses configured"}
            warehouse = warehouses[0]  # Use first warehouse
            
            # Step 3: Calculate rates if no courier specified
            if not courier_id:
                rates = await crm_request("POST", "/courier/calculate-rates", data={
                    "pickup_pincode": warehouse.get("pincode", "110001"),
                    "delivery_pincode": dispatch.get("pincode"),
                    "weight": dispatch.get("total_weight", 1),
                    "payment_type": "Prepaid",
                    "shipment_category": shipment_category,
                    "invoice_amount": dispatch.get("total_amount", 1000)
                })
                if rates and isinstance(rates, list) and len(rates) > 0:
                    # Select cheapest courier
                    courier_id = rates[0].get("courier_id")
            
            if not courier_id:
                return {"error": True, "detail": "Could not determine courier. Please specify courier_id."}
            
            # Step 4: Create shipment
            items = dispatch.get("items", [])
            product_name = ", ".join([i.get("product_name", "Product") for i in items[:3]]) if items else "Products"
            
            shipment_data = {
                "warehouse_id": warehouse.get("id"),
                "shipment_category": shipment_category,
                "first_name": dispatch.get("customer_name", "").split()[0] if dispatch.get("customer_name") else "",
                "last_name": " ".join(dispatch.get("customer_name", "").split()[1:]) if dispatch.get("customer_name") else "",
                "phone": dispatch.get("phone", ""),
                "email": dispatch.get("email", ""),
                "address_line1": dispatch.get("address", ""),
                "address_line2": "",
                "pincode": dispatch.get("pincode", ""),
                "city": dispatch.get("city", ""),
                "state": dispatch.get("state", ""),
                "weight": dispatch.get("total_weight", 1),
                "length": 20,
                "width": 15,
                "height": 10,
                "invoice_number": dispatch.get("invoice_number", dispatch_id),
                "invoice_amount": dispatch.get("total_amount", 1000),
                "product_name": product_name,
                "payment_type": "Prepaid"
            }
            
            create_result = await crm_request("POST", "/courier/create-shipment", data=shipment_data)
            if not create_result or create_result.get("error") or not create_result.get("success"):
                return {"error": True, "detail": f"Failed to create shipment: {create_result}"}
            
            system_order_id = create_result.get("system_order_id")
            
            # Step 5: Manifest shipment
            manifest_result = await crm_request("POST", "/courier/manifest", data={
                "system_order_id": system_order_id,
                "courier_id": courier_id,
                "shipment_category": shipment_category
            })
            if not manifest_result or manifest_result.get("error") or not manifest_result.get("success"):
                return {
                    "partial_success": True,
                    "message": "Shipment created but manifesting failed",
                    "system_order_id": system_order_id,
                    "manifest_error": manifest_result
                }
            
            # Step 6: Get label
            label_result = await crm_request("GET", f"/courier/label/{system_order_id}")
            
            return {
                "success": True,
                "message": "Shipping label generated successfully",
                "dispatch_id": dispatch_id,
                "system_order_id": system_order_id,
                "awb_number": manifest_result.get("awb_number"),
                "courier_name": manifest_result.get("courier_name"),
                "tracking_url": f"https://bigship.in/track/{manifest_result.get('awb_number')}" if manifest_result.get("awb_number") else None,
                "label": label_result
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

# Root POST endpoint - Claude Desktop calls POST / for MCP
@app.post("/")
async def root_mcp_endpoint(request: Request):
    """Root POST endpoint for MCP JSON-RPC - Claude Desktop expects this"""
    try:
        body = await request.json()
        mcp_request = MCPRequest(**body)
        return await mcp_jsonrpc(mcp_request)
    except Exception as e:
        return {
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32700, "message": f"Parse error: {str(e)}"}
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

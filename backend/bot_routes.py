"""
Operations Assistant Bot Routes
Intelligent chatbot for accountants to process orders faster
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

bot_router = APIRouter(prefix="/bot", tags=["Operations Bot"])


# These will be set when importing from server
db = None
get_current_user = None
require_roles = None


def init_bot_routes(database, auth_func, roles_func):
    """Initialize bot routes with database and auth functions"""
    global db, get_current_user, require_roles
    db = database
    get_current_user = auth_func
    require_roles = roles_func


# ============== MODELS ==============

class ChatMessage(BaseModel):
    session_id: str
    message: str
    context: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    bot_message: str
    order_context: Optional[Dict[str, Any]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    suggestions: Optional[List[str]] = None


# ============== HELPER FUNCTIONS ==============

async def search_order(query: str) -> Dict[str, Any]:
    """Search for order by ID, phone, or customer name across all tables"""
    results = []
    
    # Clean the query
    query = query.strip()
    
    # Search in pending_fulfillment
    pf_query = {
        "$or": [
            {"order_id": {"$regex": query, "$options": "i"}},
            {"tracking_id": {"$regex": query, "$options": "i"}},
            {"customer_name": {"$regex": query, "$options": "i"}},
            {"customer_phone": {"$regex": query, "$options": "i"}},
            {"phone": {"$regex": query, "$options": "i"}}
        ]
    }
    pf_orders = await db.pending_fulfillment.find(pf_query, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    for order in pf_orders:
        order["_source"] = "pending_fulfillment"
        order["_source_display"] = "Pending Fulfillment" if order.get("status") == "awaiting_stock" else "Ready to Dispatch"
        results.append(order)
    
    # Search in dispatches (already dispatched)
    dispatch_query = {
        "$or": [
            {"order_id": {"$regex": query, "$options": "i"}},
            {"tracking_id": {"$regex": query, "$options": "i"}},
            {"customer_name": {"$regex": query, "$options": "i"}},
            {"phone": {"$regex": query, "$options": "i"}},
            {"marketplace_order_id": {"$regex": query, "$options": "i"}}
        ]
    }
    dispatches = await db.dispatches.find(dispatch_query, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    for order in dispatches:
        order["_source"] = "dispatches"
        order["_source_display"] = "Dispatched"
        results.append(order)
    
    # Search in amazon_orders (newly synced, not yet in pending fulfillment)
    amazon_query = {
        "$or": [
            {"amazon_order_id": {"$regex": query, "$options": "i"}},
            {"order_id": {"$regex": query, "$options": "i"}},
            {"buyer_name": {"$regex": query, "$options": "i"}},
            {"buyer_phone": {"$regex": query, "$options": "i"}}
        ],
        "crm_status": {"$nin": ["dispatched", "cancelled"]}
    }
    amazon_orders = await db.amazon_orders.find(amazon_query, {"_id": 0}).sort("purchase_date", -1).limit(10).to_list(10)
    for order in amazon_orders:
        order["_source"] = "amazon_orders"
        order["_source_display"] = "Amazon Order (New)"
        # Normalize field names
        order["customer_name"] = order.get("buyer_name")
        order["customer_phone"] = order.get("buyer_phone")
        order["order_id"] = order.get("amazon_order_id")
        results.append(order)
    
    return results


async def get_order_fields(order: Dict) -> Dict[str, Any]:
    """Analyze order and determine known vs missing fields"""
    source = order.get("_source", "")
    
    known_fields = {}
    missing_fields = []
    
    # Get order status for context
    order_status = order.get("status", "unknown")
    
    # Statuses where order is already in dispatch flow - don't need invoice/label uploads
    dispatch_flow_statuses = [
        "pending_dispatch", "in_dispatch_queue", "ready_for_dispatch", 
        "ready_to_dispatch", "dispatched", "delivered", "tracking_added"
    ]
    is_in_dispatch_flow = order_status in dispatch_flow_statuses
    
    # Order ID
    order_id = order.get("order_id") or order.get("amazon_order_id") or order.get("marketplace_order_id")
    if order_id:
        known_fields["order_id"] = order_id
    else:
        missing_fields.append("order_id")
    
    # Customer name
    customer_name = order.get("customer_name") or order.get("buyer_name")
    if customer_name:
        known_fields["customer_name"] = customer_name
    else:
        missing_fields.append("customer_name")
    
    # Phone - check multiple fields including Amazon-specific
    phone = (
        order.get("customer_phone") or order.get("phone") or 
        order.get("buyer_phone") or order.get("ship_phone") or
        order.get("shipping_phone") or order.get("recipient_phone")
    )
    if phone:
        known_fields["phone"] = phone
    else:
        missing_fields.append("phone")
    
    # Address
    address = order.get("address") or order.get("shipping_address")
    if address:
        known_fields["address"] = address
    else:
        missing_fields.append("address")
    
    # City
    city = order.get("city") or order.get("shipping_city")
    if city:
        known_fields["city"] = city
    
    # State
    state = order.get("state") or order.get("shipping_state")
    if state:
        known_fields["state"] = state
    else:
        missing_fields.append("state")
    
    # Pincode
    pincode = order.get("pincode") or order.get("shipping_pincode") or order.get("postal_code")
    if pincode:
        known_fields["pincode"] = pincode
    else:
        missing_fields.append("pincode")
    
    # Tracking ID
    tracking_id = order.get("tracking_id") or order.get("tracking_number")
    if tracking_id:
        known_fields["tracking_id"] = tracking_id
    elif not is_in_dispatch_flow:
        # Only flag as missing if not already in dispatch flow
        missing_fields.append("tracking_id")
    
    # Invoice - check if uploaded (only needed before dispatch flow)
    invoice_url = order.get("invoice_url") or order.get("invoice_file")
    if invoice_url:
        known_fields["invoice"] = "Uploaded"
    elif not is_in_dispatch_flow:
        # Only flag as missing if not already in dispatch flow
        missing_fields.append("invoice")
    
    # Shipping label (only needed before dispatch flow)
    label_url = order.get("label_url") or order.get("shipping_label")
    if label_url:
        known_fields["shipping_label"] = "Uploaded"
    elif not is_in_dispatch_flow:
        # Only flag as missing if not already in dispatch flow
        missing_fields.append("shipping_label")
    
    # Product info
    if order.get("items"):
        items_display = ", ".join([f"{i.get('master_sku_name') or i.get('title', 'Item')} x{i.get('quantity', 1)}" for i in order.get("items", [])])
        known_fields["product"] = items_display
    elif order.get("master_sku_name"):
        known_fields["product"] = f"{order.get('master_sku_name')} x{order.get('quantity', 1)}"
    
    # Amount
    if order.get("order_total") or order.get("amount"):
        known_fields["amount"] = order.get("order_total") or order.get("amount")
    
    return {
        "known": known_fields,
        "missing": missing_fields,
        "source": source,
        "status": order.get("status", "unknown")
    }


async def get_customer_history(phone: str) -> Dict[str, Any]:
    """Get customer's previous orders and address"""
    clean_phone = phone.replace("+91", "").replace("-", "").replace(" ", "").strip()
    if len(clean_phone) > 10:
        clean_phone = clean_phone[-10:]
    
    # Find previous orders
    previous_orders = await db.dispatches.find(
        {"phone": {"$regex": clean_phone}},
        {"_id": 0, "customer_name": 1, "address": 1, "city": 1, "state": 1, "pincode": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Also check pending fulfillment
    pf_orders = await db.pending_fulfillment.find(
        {"$or": [{"customer_phone": {"$regex": clean_phone}}, {"phone": {"$regex": clean_phone}}]},
        {"_id": 0, "customer_name": 1, "address": 1, "city": 1, "state": 1, "pincode": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    all_orders = previous_orders + pf_orders
    
    if all_orders:
        # Get most recent address
        latest = all_orders[0]
        return {
            "is_repeat_customer": True,
            "total_orders": len(all_orders),
            "last_address": {
                "address": latest.get("address"),
                "city": latest.get("city"),
                "state": latest.get("state"),
                "pincode": latest.get("pincode")
            },
            "customer_name": latest.get("customer_name")
        }
    
    return {"is_repeat_customer": False}


# ============== SCANNER ENDPOINTS ==============

@bot_router.get("/daily-briefing")
async def get_daily_briefing(user: dict = Depends(require_roles(["admin", "accountant"]))):
    """Get daily operations briefing for accountant"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    
    # Yesterday's performance
    dispatched_yesterday = await db.dispatches.count_documents({
        "created_at": {"$gte": yesterday_start.isoformat(), "$lt": today_start.isoformat()}
    })
    
    # Today's processed
    dispatched_today = await db.dispatches.count_documents({
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    # Stuck in ready to dispatch (> 3 days)
    three_days_ago = (now - timedelta(days=3)).isoformat()
    stuck_ready = await db.pending_fulfillment.find({
        "status": "ready_to_dispatch",
        "created_at": {"$lt": three_days_ago}
    }, {"_id": 0, "id": 1, "order_id": 1, "customer_name": 1, "created_at": 1}).to_list(100)
    
    # Awaiting stock (> 5 days)
    five_days_ago = (now - timedelta(days=5)).isoformat()
    stuck_awaiting = await db.pending_fulfillment.find({
        "status": "awaiting_stock",
        "created_at": {"$lt": five_days_ago}
    }, {"_id": 0, "id": 1, "order_id": 1, "customer_name": 1, "master_sku_name": 1, "created_at": 1}).to_list(100)
    
    # Missing invoices
    missing_invoices = await db.pending_fulfillment.find({
        "status": {"$in": ["ready_to_dispatch", "awaiting_stock"]},
        "$or": [{"invoice_url": {"$exists": False}}, {"invoice_url": None}, {"invoice_url": ""}]
    }, {"_id": 0, "id": 1, "order_id": 1, "customer_name": 1}).to_list(100)
    
    # Missing tracking
    missing_tracking = await db.pending_fulfillment.find({
        "status": {"$in": ["ready_to_dispatch", "awaiting_stock"]},
        "$or": [{"tracking_id": {"$exists": False}}, {"tracking_id": None}, {"tracking_id": ""}]
    }, {"_id": 0, "id": 1, "order_id": 1, "customer_name": 1}).to_list(100)
    
    # New amazon orders not processed
    new_amazon = await db.amazon_orders.count_documents({
        "crm_status": {"$nin": ["dispatched", "cancelled", "in_pending_fulfillment"]}
    })
    
    # Production needs - items with pending orders but low/no stock
    production_suggestions = []
    low_stock_items = await db.pending_fulfillment.aggregate([
        {"$match": {"status": "awaiting_stock"}},
        {"$group": {"_id": "$master_sku_id", "count": {"$sum": 1}, "sku_name": {"$first": "$master_sku_name"}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    for item in low_stock_items:
        if item.get("_id"):
            production_suggestions.append({
                "master_sku_id": item["_id"],
                "master_sku_name": item.get("sku_name", "Unknown"),
                "pending_orders": item["count"]
            })
    
    return {
        "date": now.isoformat(),
        "yesterday": {
            "dispatched": dispatched_yesterday
        },
        "today": {
            "dispatched": dispatched_today
        },
        "urgent": {
            "stuck_ready_to_dispatch": len(stuck_ready),
            "stuck_ready_list": stuck_ready[:5],
            "missing_invoices": len(missing_invoices),
            "missing_invoices_list": missing_invoices[:5],
            "missing_tracking": len(missing_tracking)
        },
        "attention": {
            "stuck_awaiting_stock": len(stuck_awaiting),
            "stuck_awaiting_list": stuck_awaiting[:5],
            "new_amazon_orders": new_amazon,
            "production_suggestions": production_suggestions[:5]
        }
    }


@bot_router.get("/queue-health")
async def get_queue_health(user: dict = Depends(require_roles(["admin", "accountant"]))):
    """Get health status of all queues"""
    now = datetime.now(timezone.utc)
    three_days_ago = (now - timedelta(days=3)).isoformat()
    five_days_ago = (now - timedelta(days=5)).isoformat()
    
    # Pending Fulfillment stats
    pf_total = await db.pending_fulfillment.count_documents({"status": {"$nin": ["dispatched", "cancelled"]}})
    pf_awaiting = await db.pending_fulfillment.count_documents({"status": "awaiting_stock"})
    pf_ready = await db.pending_fulfillment.count_documents({"status": "ready_to_dispatch"})
    pf_stuck = await db.pending_fulfillment.count_documents({
        "status": "ready_to_dispatch",
        "created_at": {"$lt": three_days_ago}
    })
    
    # Missing data counts
    missing_invoice = await db.pending_fulfillment.count_documents({
        "status": {"$nin": ["dispatched", "cancelled"]},
        "$or": [{"invoice_url": {"$exists": False}}, {"invoice_url": None}, {"invoice_url": ""}]
    })
    missing_tracking = await db.pending_fulfillment.count_documents({
        "status": {"$nin": ["dispatched", "cancelled"]},
        "$or": [{"tracking_id": {"$exists": False}}, {"tracking_id": None}, {"tracking_id": ""}]
    })
    missing_label = await db.pending_fulfillment.count_documents({
        "status": {"$nin": ["dispatched", "cancelled"]},
        "$or": [{"label_url": {"$exists": False}}, {"label_url": None}, {"label_url": ""}]
    })
    
    # Amazon orders
    amazon_new = await db.amazon_orders.count_documents({
        "crm_status": {"$nin": ["dispatched", "cancelled", "in_pending_fulfillment"]}
    })
    amazon_today = await db.amazon_orders.count_documents({
        "synced_at": {"$gte": now.replace(hour=0, minute=0, second=0).isoformat()}
    })
    
    # Dispatched today
    dispatched_today = await db.dispatches.count_documents({
        "created_at": {"$gte": now.replace(hour=0, minute=0, second=0).isoformat()}
    })
    
    return {
        "pending_fulfillment": {
            "total": pf_total,
            "awaiting_stock": pf_awaiting,
            "ready_to_dispatch": pf_ready,
            "stuck_over_3_days": pf_stuck
        },
        "missing_data": {
            "invoices": missing_invoice,
            "tracking_ids": missing_tracking,
            "shipping_labels": missing_label
        },
        "amazon_orders": {
            "new_unprocessed": amazon_new,
            "synced_today": amazon_today
        },
        "dispatched": {
            "today": dispatched_today
        }
    }


@bot_router.get("/stuck-orders")
async def get_stuck_orders(
    days: int = 3,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Get orders stuck for more than specified days"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Stuck in ready to dispatch
    stuck_ready = await db.pending_fulfillment.find({
        "status": "ready_to_dispatch",
        "created_at": {"$lt": cutoff}
    }, {"_id": 0}).sort("created_at", 1).to_list(50)
    
    # Analyze what's missing for each
    for order in stuck_ready:
        fields = await get_order_fields(order)
        order["missing_fields"] = fields["missing"]
        order["days_stuck"] = (datetime.now(timezone.utc) - datetime.fromisoformat(order["created_at"].replace("Z", "+00:00"))).days
    
    # Stuck awaiting stock
    stuck_awaiting = await db.pending_fulfillment.find({
        "status": "awaiting_stock",
        "created_at": {"$lt": cutoff}
    }, {"_id": 0}).sort("created_at", 1).to_list(50)
    
    for order in stuck_awaiting:
        order["days_stuck"] = (datetime.now(timezone.utc) - datetime.fromisoformat(order["created_at"].replace("Z", "+00:00"))).days
    
    return {
        "ready_to_dispatch": stuck_ready,
        "awaiting_stock": stuck_awaiting,
        "total_stuck": len(stuck_ready) + len(stuck_awaiting)
    }


@bot_router.get("/missing-data")
async def get_missing_data(user: dict = Depends(require_roles(["admin", "accountant"]))):
    """Get all orders with missing data"""
    
    # Missing invoices
    missing_invoices = await db.pending_fulfillment.find({
        "status": {"$nin": ["dispatched", "cancelled"]},
        "$or": [{"invoice_url": {"$exists": False}}, {"invoice_url": None}, {"invoice_url": ""}]
    }, {"_id": 0, "id": 1, "order_id": 1, "customer_name": 1, "customer_phone": 1, "created_at": 1, "status": 1}).to_list(100)
    
    # Missing tracking
    missing_tracking = await db.pending_fulfillment.find({
        "status": {"$nin": ["dispatched", "cancelled"]},
        "$or": [{"tracking_id": {"$exists": False}}, {"tracking_id": None}, {"tracking_id": ""}]
    }, {"_id": 0, "id": 1, "order_id": 1, "customer_name": 1, "customer_phone": 1, "created_at": 1, "status": 1}).to_list(100)
    
    # Missing shipping labels
    missing_labels = await db.pending_fulfillment.find({
        "status": {"$nin": ["dispatched", "cancelled"]},
        "$or": [{"label_url": {"$exists": False}}, {"label_url": None}, {"label_url": ""}]
    }, {"_id": 0, "id": 1, "order_id": 1, "customer_name": 1, "customer_phone": 1, "created_at": 1, "status": 1}).to_list(100)
    
    # Missing phone numbers
    missing_phones = await db.pending_fulfillment.find({
        "status": {"$nin": ["dispatched", "cancelled"]},
        "$and": [
            {"$or": [{"customer_phone": {"$exists": False}}, {"customer_phone": None}, {"customer_phone": ""}]},
            {"$or": [{"phone": {"$exists": False}}, {"phone": None}, {"phone": ""}]}
        ]
    }, {"_id": 0, "id": 1, "order_id": 1, "customer_name": 1, "created_at": 1, "status": 1}).to_list(100)
    
    # Missing addresses
    missing_addresses = await db.pending_fulfillment.find({
        "status": {"$nin": ["dispatched", "cancelled"]},
        "$or": [{"address": {"$exists": False}}, {"address": None}, {"address": ""}]
    }, {"_id": 0, "id": 1, "order_id": 1, "customer_name": 1, "customer_phone": 1, "created_at": 1, "status": 1}).to_list(100)
    
    return {
        "invoices": {"count": len(missing_invoices), "orders": missing_invoices},
        "tracking_ids": {"count": len(missing_tracking), "orders": missing_tracking},
        "shipping_labels": {"count": len(missing_labels), "orders": missing_labels},
        "phone_numbers": {"count": len(missing_phones), "orders": missing_phones},
        "addresses": {"count": len(missing_addresses), "orders": missing_addresses},
        "total_issues": len(missing_invoices) + len(missing_tracking) + len(missing_labels) + len(missing_phones) + len(missing_addresses)
    }


@bot_router.get("/production-suggestions")
async def get_production_suggestions(user: dict = Depends(require_roles(["admin", "accountant"]))):
    """Get production suggestions based on pending orders and stock levels"""
    
    # Get items with pending orders awaiting stock
    awaiting_items = await db.pending_fulfillment.aggregate([
        {"$match": {"status": "awaiting_stock"}},
        {"$group": {
            "_id": "$master_sku_id",
            "pending_orders": {"$sum": 1},
            "total_quantity": {"$sum": "$quantity"},
            "sku_name": {"$first": "$master_sku_name"},
            "sku_code": {"$first": "$sku_code"},
            "oldest_order": {"$min": "$created_at"},
            "customer_names": {"$push": "$customer_name"}
        }},
        {"$sort": {"pending_orders": -1}}
    ]).to_list(20)
    
    suggestions = []
    for item in awaiting_items:
        if not item.get("_id"):
            continue
            
        # Get current stock
        stock_entry = await db.inventory_ledger.find_one(
            {"item_id": item["_id"], "item_type": "master_sku"},
            sort=[("created_at", -1)]
        )
        current_stock = stock_entry.get("running_balance", 0) if stock_entry else 0
        
        # Calculate days waiting
        if item.get("oldest_order"):
            oldest = datetime.fromisoformat(item["oldest_order"].replace("Z", "+00:00"))
            days_waiting = (datetime.now(timezone.utc) - oldest).days
        else:
            days_waiting = 0
        
        severity = "critical" if current_stock == 0 and item["pending_orders"] > 0 else "warning" if current_stock < item["total_quantity"] else "info"
        
        suggestions.append({
            "master_sku_id": item["_id"],
            "master_sku_name": item.get("sku_name", "Unknown"),
            "sku_code": item.get("sku_code"),
            "current_stock": current_stock,
            "pending_orders": item["pending_orders"],
            "total_quantity_needed": item["total_quantity"],
            "days_waiting": days_waiting,
            "customers_waiting": item.get("customer_names", [])[:5],
            "severity": severity,
            "recommended_production": max(item["total_quantity"] - current_stock, 0) + 5  # Buffer
        })
    
    return {
        "suggestions": suggestions,
        "critical_count": len([s for s in suggestions if s["severity"] == "critical"]),
        "warning_count": len([s for s in suggestions if s["severity"] == "warning"])
    }


# ============== CHAT ENDPOINT ==============

@bot_router.post("/chat")
async def chat(
    message: str = Form(...),
    session_id: str = Form(...),
    context: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Main chat endpoint for operations assistant"""
    import json
    
    ctx = json.loads(context) if context else {}
    message_lower = message.lower().strip()
    
    # Parse quick commands
    if message_lower in ["status", "summary", "briefing"]:
        briefing = await get_daily_briefing(user)
        urgent = briefing["urgent"]
        attention = briefing["attention"]
        
        response = f"""📊 **Operations Summary**

🔴 **URGENT**
• {urgent['stuck_ready_to_dispatch']} orders stuck in Ready to Dispatch (3+ days)
• {urgent['missing_invoices']} orders missing invoices
• {urgent['missing_tracking']} orders missing tracking IDs

🟡 **ATTENTION**
• {attention['stuck_awaiting_stock']} orders waiting for stock (5+ days)
• {attention['new_amazon_orders']} new Amazon orders to process
• {len(attention['production_suggestions'])} items need production

🟢 **TODAY**
• Dispatched today: {briefing['today']['dispatched']}
• Yesterday: {briefing['yesterday']['dispatched']}

What would you like to do?"""
        
        return {
            "bot_message": response,
            "actions": [
                {"type": "button", "label": "Fix stuck orders", "command": "stuck"},
                {"type": "button", "label": "Complete missing data", "command": "missing"},
                {"type": "button", "label": "Process new order", "command": "new"}
            ]
        }
    
    elif message_lower in ["stuck", "stuck orders"]:
        stuck = await get_stuck_orders(3, user)
        
        if stuck["total_stuck"] == 0:
            return {"bot_message": "✅ Great news! No orders are stuck. Everything is flowing smoothly."}
        
        response = f"Found **{stuck['total_stuck']}** stuck orders:\n\n"
        
        if stuck["ready_to_dispatch"]:
            response += "🔴 **Ready to Dispatch (stuck 3+ days):**\n"
            for i, order in enumerate(stuck["ready_to_dispatch"][:5], 1):
                missing = ", ".join(order.get("missing_fields", [])[:3]) or "Complete"
                response += f"{i}. {order.get('order_id')} - {order.get('customer_name', 'Unknown')} ({order.get('days_stuck')}d)\n   Missing: {missing}\n"
        
        if stuck["awaiting_stock"]:
            response += "\n🟡 **Awaiting Stock (5+ days):**\n"
            for i, order in enumerate(stuck["awaiting_stock"][:5], 1):
                response += f"{i}. {order.get('order_id')} - {order.get('master_sku_name', 'Unknown')} ({order.get('days_stuck')}d)\n"
        
        response += "\nEnter order ID to fix, or type 'fix all' to process sequentially."
        
        return {
            "bot_message": response,
            "order_context": {"mode": "fix_stuck", "stuck_orders": stuck},
            "actions": [{"type": "text_input", "placeholder": "Enter order ID..."}]
        }
    
    elif message_lower in ["missing", "missing data"]:
        missing = await get_missing_data(user)
        
        if missing["total_issues"] == 0:
            return {"bot_message": "✅ All orders have complete data!"}
        
        response = f"Found **{missing['total_issues']}** data gaps:\n\n"
        
        if missing["invoices"]["count"] > 0:
            response += f"📄 **Missing Invoices:** {missing['invoices']['count']}\n"
        if missing["tracking_ids"]["count"] > 0:
            response += f"📦 **Missing Tracking IDs:** {missing['tracking_ids']['count']}\n"
        if missing["shipping_labels"]["count"] > 0:
            response += f"🏷️ **Missing Shipping Labels:** {missing['shipping_labels']['count']}\n"
        if missing["phone_numbers"]["count"] > 0:
            response += f"📞 **Missing Phone Numbers:** {missing['phone_numbers']['count']}\n"
        if missing["addresses"]["count"] > 0:
            response += f"📍 **Missing Addresses:** {missing['addresses']['count']}\n"
        
        response += "\nWhich category would you like to fix?"
        
        return {
            "bot_message": response,
            "order_context": {"mode": "fix_missing", "missing_data": missing},
            "actions": [
                {"type": "button", "label": "Fix Invoices", "command": "fix invoices"},
                {"type": "button", "label": "Fix Tracking", "command": "fix tracking"},
                {"type": "button", "label": "Fix All", "command": "fix all"}
            ]
        }
    
    elif message_lower in ["production", "production suggestions"]:
        suggestions = await get_production_suggestions(user)
        
        if not suggestions["suggestions"]:
            return {"bot_message": "✅ No production suggestions. Stock levels are adequate for pending orders."}
        
        response = "�icing **Production Recommendations:**\n\n"
        
        for s in suggestions["suggestions"][:5]:
            emoji = "🔴" if s["severity"] == "critical" else "🟡"
            response += f"{emoji} **{s['master_sku_name']}**\n"
            response += f"   Stock: {s['current_stock']} | Needed: {s['total_quantity_needed']} | Waiting: {s['days_waiting']}d\n"
            response += f"   Recommend: Produce {s['recommended_production']} units\n\n"
        
        return {
            "bot_message": response,
            "actions": [{"type": "button", "label": "Create Production Request", "command": "create production"}]
        }
    
    elif message_lower in ["help", "commands"]:
        return {
            "bot_message": """📖 **Available Commands:**

**Quick Status:**
• `status` - Daily operations summary
• `stuck` - View stuck orders
• `missing` - Find orders with missing data
• `production` - Production suggestions

**Order Processing:**
• Enter **Order ID** - Find and process specific order
• Enter **Phone Number** - Find customer's orders
• Enter **Customer Name** - Search by name

**During Processing:**
• `skip` - Skip current field
• `cancel` - Cancel current operation
• `done` - Finish session

Need help? Just ask!"""
        }
    
    # Handle file upload in context
    if file and ctx.get("awaiting_file"):
        field = ctx.get("awaiting_file")
        order_id = ctx.get("current_order_id")
        
        # Save file - ====== SECURITY: Sanitize filename to prevent path traversal ======
        file_content = await file.read()
        # Extract extension safely and generate UUID-based filename
        original_ext = ""
        if file.filename and "." in file.filename:
            original_ext = file.filename.rsplit(".", 1)[-1].lower()
            # Whitelist allowed extensions
            if original_ext not in ["pdf", "png", "jpg", "jpeg", "gif", "webp"]:
                original_ext = "pdf"
        else:
            original_ext = "pdf"
        # Use UUID to completely avoid path traversal - no user input in path
        file_name = f"{order_id}_{field}_{uuid.uuid4().hex[:8]}.{original_ext}"
        file_path = f"/app/uploads/bot/{file_name}"
        
        os.makedirs("/app/uploads/bot", exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Update order with file
        file_field = "invoice_url" if field == "invoice" else "label_url"
        await db.pending_fulfillment.update_one(
            {"id": order_id},
            {"$set": {file_field: file_path, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Check what's next
        order = await db.pending_fulfillment.find_one({"id": order_id}, {"_id": 0})
        fields = await get_order_fields(order)
        
        if not fields["missing"]:
            return {
                "bot_message": f"✅ {field.title()} uploaded!\n\n🎉 All data complete! Ready to dispatch.\n\nConfirm dispatch?",
                "order_context": {"current_order_id": order_id, "ready_to_dispatch": True},
                "actions": [
                    {"type": "button", "label": "✓ Dispatch Now", "command": "dispatch"},
                    {"type": "button", "label": "Cancel", "command": "cancel"}
                ]
            }
        
        next_field = fields["missing"][0]
        return {
            "bot_message": f"✅ {field.title()} uploaded!\n\nNext, please provide: **{next_field.replace('_', ' ').title()}**",
            "order_context": {"current_order_id": order_id, "next_field": next_field},
            "actions": get_field_actions(next_field)
        }
    
    # Handle dispatch confirmation
    if message_lower == "dispatch" and ctx.get("ready_to_dispatch"):
        order_id = ctx.get("current_order_id")
        
        try:
            # Call the existing dispatch API
            entry = await db.pending_fulfillment.find_one({"id": order_id})
            if not entry:
                return {"bot_message": "❌ Order not found. Please try again."}
            
            if entry.get("status") == "dispatched":
                return {"bot_message": "⚠️ This order has already been dispatched."}
            
            # Trigger dispatch
            from server import dispatch_pending_fulfillment
            result = await dispatch_pending_fulfillment(order_id, None, None, user)
            
            return {
                "bot_message": f"""✅ **Order Dispatched Successfully!**

📦 Dispatch Number: {result.get('dispatch_number')}
🆔 Order ID: {entry.get('order_id')}
👤 Customer: {entry.get('customer_name')}
📍 Tracking: {entry.get('tracking_id')}

The order is now in the Dispatcher Queue.

Process another order? Enter Order ID, Name, or Phone:""",
                "order_context": {},
                "actions": [{"type": "text_input", "placeholder": "Enter order ID, name, or phone..."}]
            }
        except Exception as e:
            return {"bot_message": f"❌ Dispatch failed: {str(e)}\n\nPlease check the order and try again."}
    
    # Search for order
    results = await search_order(message)
    
    if not results:
        return {
            "bot_message": f"🔍 No orders found for '{message}'.\n\nTry:\n• Full Order ID (e.g., 402-1234567-8901234)\n• Phone number (e.g., 9876543210)\n• Customer name",
            "actions": [{"type": "text_input", "placeholder": "Enter order ID, name, or phone..."}]
        }
    
    if len(results) == 1:
        order = results[0]
        return await format_order_response(order, user)
    
    # Multiple results
    response = f"Found **{len(results)}** orders:\n\n"
    for i, order in enumerate(results[:5], 1):
        status = order.get("_source_display", order.get("status", "Unknown"))
        response += f"{i}. **{order.get('order_id', 'N/A')}** - {order.get('customer_name', 'Unknown')}\n   Status: {status}\n"
    
    response += "\nEnter the number to select, or provide more specific search:"
    
    return {
        "bot_message": response,
        "order_context": {"search_results": results[:5]},
        "actions": [{"type": "text_input", "placeholder": "Enter 1-5 or more specific search..."}]
    }


async def format_order_response(order: Dict, user: dict) -> Dict:
    """Format response for a found order"""
    fields = await get_order_fields(order)
    source = order.get("_source_display", "Unknown")
    
    response = f"📦 **Order Found!**\nStatus: **{source}**\n\n"
    response += "─" * 30 + "\n"
    
    # Show known fields
    for key, value in fields["known"].items():
        emoji = "✓"
        response += f"{emoji} **{key.replace('_', ' ').title()}:** {value}\n"
    
    # Show missing fields
    for field in fields["missing"]:
        response += f"✗ **{field.replace('_', ' ').title()}:** Missing\n"
    
    response += "─" * 30 + "\n"
    
    # Check for repeat customer
    phone = fields["known"].get("phone")
    if phone and "address" in fields["missing"]:
        history = await get_customer_history(phone)
        if history.get("is_repeat_customer"):
            addr = history.get("last_address", {})
            response += f"\n💡 **Repeat Customer** ({history['total_orders']} previous orders)\n"
            response += f"Last address: {addr.get('address')}, {addr.get('city')} - {addr.get('pincode')}\n"
            response += "Use previous address? (yes/no)\n"
            
            return {
                "bot_message": response,
                "order_context": {
                    "current_order_id": order.get("id"),
                    "current_order": order,
                    "previous_address": addr,
                    "awaiting_address_confirm": True
                },
                "actions": [
                    {"type": "button", "label": "Yes, use this", "command": "yes"},
                    {"type": "button", "label": "No, different address", "command": "no"}
                ]
            }
    
    if not fields["missing"]:
        if order.get("_source") == "pending_fulfillment" and order.get("status") != "dispatched":
            response += "\n🎉 **All data complete!** Ready to dispatch.\n"
            return {
                "bot_message": response,
                "order_context": {"current_order_id": order.get("id"), "ready_to_dispatch": True},
                "actions": [
                    {"type": "button", "label": "✓ Dispatch Now", "command": "dispatch"},
                    {"type": "button", "label": "Cancel", "command": "cancel"}
                ]
            }
        else:
            response += "\n✅ This order is complete."
            return {"bot_message": response}
    
    # Ask for first missing field
    next_field = fields["missing"][0]
    response += f"\nLet me collect the missing details.\n**{next_field.replace('_', ' ').title()}?**"
    
    return {
        "bot_message": response,
        "order_context": {
            "current_order_id": order.get("id"),
            "current_order": order,
            "next_field": next_field,
            "missing_fields": fields["missing"]
        },
        "actions": get_field_actions(next_field)
    }


def get_field_actions(field: str) -> List[Dict]:
    """Get appropriate input actions for a field"""
    if field in ["invoice", "shipping_label"]:
        return [{"type": "file_upload", "field": field, "accept": ".pdf,.png,.jpg"}]
    elif field == "phone":
        return [{"type": "text_input", "placeholder": "Enter 10-digit phone number..."}]
    elif field == "pincode":
        return [{"type": "text_input", "placeholder": "Enter 6-digit PIN code..."}]
    else:
        return [{"type": "text_input", "placeholder": f"Enter {field.replace('_', ' ')}..."}]


# ============== UPDATE FIELD ENDPOINT ==============

@bot_router.post("/update-field")
async def update_order_field(
    order_id: str = Form(...),
    field: str = Form(...),
    value: str = Form(None),
    file: Optional[UploadFile] = File(None),
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """Update a specific field on an order"""
    
    # Find the order
    order = await db.pending_fulfillment.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if file:
        # Handle file upload
        file_content = await file.read()
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
        file_name = f"{order_id}_{field}_{uuid.uuid4().hex[:8]}.{file_ext}"
        file_path = f"/app/uploads/bot/{file_name}"
        
        os.makedirs("/app/uploads/bot", exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        field_map = {"invoice": "invoice_url", "shipping_label": "label_url"}
        update_data[field_map.get(field, field)] = file_path
    else:
        # Handle text value
        field_map = {
            "phone": "customer_phone",
            "customer_name": "customer_name",
            "address": "address",
            "city": "city",
            "state": "state",
            "pincode": "pincode",
            "tracking_id": "tracking_id"
        }
        db_field = field_map.get(field, field)
        update_data[db_field] = value
        
        # Also update phone field for compatibility
        if field == "phone":
            update_data["phone"] = value
    
    await db.pending_fulfillment.update_one(
        {"id": order_id},
        {"$set": update_data}
    )
    
    # Get updated order
    updated_order = await db.pending_fulfillment.find_one({"id": order_id}, {"_id": 0})
    fields = await get_order_fields(updated_order)
    
    return {
        "message": f"{field} updated successfully",
        "remaining_fields": fields["missing"],
        "is_complete": len(fields["missing"]) == 0
    }



# ============== FIX END-TO-END FEATURE ==============

class FixEndToEndRequest(BaseModel):
    """Request model for fix end-to-end"""
    order_id: str
    # Customer details
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    # SKU details
    master_sku_id: Optional[str] = None
    confirm_sku: Optional[bool] = False
    # Tracking
    tracking_id: Optional[str] = None
    create_tracking: Optional[bool] = False
    # Files
    invoice_url: Optional[str] = None
    label_url: Optional[str] = None


@bot_router.post("/diagnose-order")
async def bot_diagnose_order(
    order_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Comprehensive order diagnosis - checks ALL data requirements for dispatch.
    Returns detailed report of what's present, missing, and actionable fixes.
    """
    # Search for the order across all collections
    order = None
    source = None
    
    # Check dispatches first (dispatch queue)
    dispatch = await db.dispatches.find_one(
        {"$or": [
            {"id": order_id},
            {"order_id": order_id},
            {"tracking_id": order_id}
        ]},
        {"_id": 0}
    )
    if dispatch:
        order = dispatch
        source = "dispatches"
    
    # Check pending_fulfillment
    if not order:
        pf = await db.pending_fulfillment.find_one(
            {"$or": [
                {"id": order_id},
                {"order_id": order_id},
                {"amazon_order_id": order_id}
            ]},
            {"_id": 0}
        )
        if pf:
            order = pf
            source = "pending_fulfillment"
    
    # Check amazon_orders
    amazon_order = await db.amazon_orders.find_one(
        {"$or": [
            {"amazon_order_id": order_id},
            {"order_id": order_id}
        ]},
        {"_id": 0}
    )
    if not order and amazon_order:
        order = amazon_order
        source = "amazon_orders"
    
    if not order:
        return {
            "found": False,
            "message": f"Order {order_id} not found in any collection"
        }
    
    # Build comprehensive diagnosis
    diagnosis = {
        "found": True,
        "order_id": order.get("order_id") or order.get("amazon_order_id") or order.get("id"),
        "source": source,
        "status": order.get("status", "unknown"),
        "firm_id": order.get("firm_id"),
        "firm_name": order.get("firm_name"),
        "created_at": order.get("created_at"),
        "checks": {},
        "issues": [],
        "fixes_needed": [],
        "ready_for_dispatch": True
    }
    
    # 1. CUSTOMER DETAILS CHECK
    customer_check = {
        "name": order.get("customer_name") or order.get("buyer_name"),
        "phone": (order.get("customer_phone") or order.get("phone") or 
                  order.get("buyer_phone") or (amazon_order.get("buyer_phone") if amazon_order else None)),
        "address": order.get("address") or order.get("shipping_address"),
        "city": order.get("city"),
        "state": order.get("state"),
        "pincode": order.get("pincode") or order.get("postal_code"),
        "complete": True
    }
    
    missing_customer = []
    if not customer_check["name"]:
        missing_customer.append("customer_name")
        customer_check["complete"] = False
    if not customer_check["phone"]:
        missing_customer.append("phone")
        customer_check["complete"] = False
    if not customer_check["address"]:
        missing_customer.append("address")
        customer_check["complete"] = False
    if not customer_check["city"]:
        missing_customer.append("city")
        customer_check["complete"] = False
    if not customer_check["state"]:
        missing_customer.append("state")
        customer_check["complete"] = False
    if not customer_check["pincode"]:
        missing_customer.append("pincode")
        customer_check["complete"] = False
    
    customer_check["missing"] = missing_customer
    diagnosis["checks"]["customer"] = customer_check
    
    if not customer_check["complete"]:
        diagnosis["ready_for_dispatch"] = False
        diagnosis["issues"].append(f"Missing customer details: {', '.join(missing_customer)}")
        diagnosis["fixes_needed"].append({
            "type": "customer_details",
            "fields": missing_customer,
            "description": "Customer information incomplete"
        })
    
    # 2. SKU/PRODUCT CHECK
    sku_check = {
        "master_sku_id": order.get("master_sku_id"),
        "master_sku_name": order.get("master_sku_name"),
        "sku_code": order.get("sku_code"),
        "quantity": order.get("quantity", 1),
        "items": order.get("items", []),
        "mapped": False,
        "complete": True
    }
    
    if sku_check["master_sku_id"]:
        # Verify SKU exists
        master_sku = await db.master_skus.find_one({"id": sku_check["master_sku_id"]}, {"_id": 0})
        if master_sku:
            sku_check["mapped"] = True
            sku_check["master_sku_details"] = {
                "name": master_sku.get("name"),
                "sku_code": master_sku.get("sku_code"),
                "weight": master_sku.get("weight"),
                "dimensions": master_sku.get("dimensions"),
                "hsn_code": master_sku.get("hsn_code"),
                "is_manufactured": master_sku.get("product_type") == "manufactured"
            }
    elif sku_check["items"]:
        # Check if all items are mapped
        all_mapped = all(item.get("master_sku_id") for item in sku_check["items"])
        sku_check["mapped"] = all_mapped
    else:
        sku_check["complete"] = False
    
    if not sku_check["mapped"]:
        diagnosis["ready_for_dispatch"] = False
        diagnosis["issues"].append("SKU not mapped to master catalog")
        diagnosis["fixes_needed"].append({
            "type": "sku_mapping",
            "description": "Product needs to be mapped to Master SKU"
        })
    
    diagnosis["checks"]["sku"] = sku_check
    
    # 3. STOCK CHECK
    stock_check = {
        "available": 0,
        "required": order.get("quantity", 1),
        "in_stock": False,
        "firm_id": order.get("firm_id")
    }
    
    if sku_check["mapped"] and order.get("firm_id"):
        # Use shared stock helper
        from server import get_stock_for_resolved_items
        items_for_stock = order.get("items") or ([{
            "master_sku_id": order.get("master_sku_id"),
            "quantity": order.get("quantity", 1)
        }] if order.get("master_sku_id") else [])
        
        if items_for_stock:
            stock_result = await get_stock_for_resolved_items(items_for_stock, order["firm_id"], db)
            stock_check["available"] = stock_result.get("items", [{}])[0].get("available", 0) if stock_result.get("items") else 0
            stock_check["in_stock"] = stock_result.get("all_in_stock", False)
            stock_check["per_item"] = stock_result.get("items", [])
    
    if not stock_check["in_stock"] and sku_check["mapped"]:
        diagnosis["ready_for_dispatch"] = False
        diagnosis["issues"].append(f"Insufficient stock: {stock_check['available']} available, {stock_check['required']} needed")
        diagnosis["fixes_needed"].append({
            "type": "stock",
            "description": "Stock not available - check inventory or production"
        })
    
    diagnosis["checks"]["stock"] = stock_check
    
    # 4. TRACKING CHECK
    tracking_check = {
        "tracking_id": order.get("tracking_id") or order.get("tracking_number"),
        "has_tracking": bool(order.get("tracking_id") or order.get("tracking_number")),
        "courier": order.get("courier_partner") or order.get("courier"),
        "is_easy_ship": order.get("is_easy_ship", False) or order.get("fulfillment_channel") == "AMAZON_IN"
    }
    
    # For EasyShip orders, tracking comes from Amazon
    if not tracking_check["has_tracking"] and not tracking_check["is_easy_ship"]:
        diagnosis["issues"].append("No tracking ID assigned")
        diagnosis["fixes_needed"].append({
            "type": "tracking",
            "description": "Tracking ID needs to be created/assigned"
        })
    
    diagnosis["checks"]["tracking"] = tracking_check
    
    # 5. DOCUMENTS CHECK
    docs_check = {
        "invoice": bool(order.get("invoice_url") or order.get("invoice_file")),
        "invoice_url": order.get("invoice_url") or order.get("invoice_file"),
        "shipping_label": bool(order.get("label_url") or order.get("shipping_label")),
        "label_url": order.get("label_url") or order.get("shipping_label")
    }
    
    # For non-EasyShip, docs may be needed
    if not tracking_check["is_easy_ship"]:
        if not docs_check["invoice"]:
            diagnosis["issues"].append("Invoice not uploaded")
            diagnosis["fixes_needed"].append({
                "type": "invoice",
                "description": "Tax invoice needs to be generated/uploaded"
            })
        if not docs_check["shipping_label"]:
            diagnosis["issues"].append("Shipping label not uploaded")
            diagnosis["fixes_needed"].append({
                "type": "shipping_label", 
                "description": "Shipping label needs to be uploaded"
            })
    
    diagnosis["checks"]["documents"] = docs_check
    
    # 6. WEIGHT/DIMENSIONS CHECK (for shipping)
    weight_check = {
        "weight": order.get("weight") or (sku_check.get("master_sku_details", {}).get("weight") if sku_check.get("master_sku_details") else None),
        "dimensions": order.get("dimensions") or (sku_check.get("master_sku_details", {}).get("dimensions") if sku_check.get("master_sku_details") else None),
        "complete": True
    }
    
    if not weight_check["weight"]:
        weight_check["complete"] = False
        diagnosis["issues"].append("Weight not specified")
    
    diagnosis["checks"]["weight_dimensions"] = weight_check
    
    # Summary
    diagnosis["total_issues"] = len(diagnosis["issues"])
    diagnosis["can_fix_automatically"] = []
    
    # Determine what can be auto-fixed
    if amazon_order and not customer_check["complete"]:
        # Can pull customer data from amazon order
        shipping = amazon_order.get("shipping_address", {})
        if shipping:
            diagnosis["can_fix_automatically"].append({
                "type": "customer_from_amazon",
                "description": "Can copy customer details from Amazon order",
                "data": {
                    "customer_name": amazon_order.get("buyer_name") or shipping.get("name"),
                    "phone": amazon_order.get("buyer_phone") or shipping.get("phone"),
                    "address": shipping.get("address_line1"),
                    "city": shipping.get("city"),
                    "state": shipping.get("state"),
                    "pincode": shipping.get("postal_code")
                }
            })
    
    return diagnosis


@bot_router.post("/fix-end-to-end")
async def bot_fix_end_to_end(
    data: FixEndToEndRequest,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Fix all issues with an order end-to-end.
    Updates customer details, confirms SKU, checks stock, and ensures order is dispatch-ready.
    """
    now = datetime.now(timezone.utc)
    
    # Find the order
    order = None
    collection = None
    
    # Check dispatches
    dispatch = await db.dispatches.find_one(
        {"$or": [{"id": data.order_id}, {"order_id": data.order_id}]},
        {"_id": 0}
    )
    if dispatch:
        order = dispatch
        collection = "dispatches"
    
    # Check pending_fulfillment
    if not order:
        pf = await db.pending_fulfillment.find_one(
            {"$or": [
                {"id": data.order_id},
                {"order_id": data.order_id},
                {"amazon_order_id": data.order_id}
            ]},
            {"_id": 0}
        )
        if pf:
            order = pf
            collection = "pending_fulfillment"
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get amazon order data for fallbacks
    amazon_order = await db.amazon_orders.find_one(
        {"$or": [
            {"amazon_order_id": data.order_id},
            {"order_id": data.order_id},
            {"amazon_order_id": order.get("amazon_order_id")},
            {"order_id": order.get("order_id")}
        ]},
        {"_id": 0}
    )
    amazon_shipping = (amazon_order.get("shipping_address") or {}) if amazon_order else {}
    
    # Build update
    update_data = {"updated_at": now.isoformat()}
    fixes_applied = []
    
    # 1. FIX CUSTOMER DETAILS
    if data.customer_name or not order.get("customer_name"):
        name = data.customer_name or amazon_order.get("buyer_name") if amazon_order else None
        if name:
            update_data["customer_name"] = name
            fixes_applied.append(f"Customer name: {name}")
    
    if data.customer_phone or not (order.get("customer_phone") or order.get("phone")):
        phone = (data.customer_phone or 
                 (amazon_order.get("buyer_phone") if amazon_order else None) or
                 amazon_shipping.get("phone"))
        if phone:
            update_data["customer_phone"] = phone
            update_data["phone"] = phone
            fixes_applied.append(f"Phone: {phone}")
    
    if data.address or not order.get("address"):
        address = data.address or amazon_shipping.get("address_line1")
        if address:
            update_data["address"] = address
            fixes_applied.append(f"Address: {address[:50]}...")
    
    if data.city or not order.get("city"):
        city = data.city or amazon_shipping.get("city") or (amazon_order.get("city") if amazon_order else None)
        if city:
            update_data["city"] = city
            fixes_applied.append(f"City: {city}")
    
    if data.state or not order.get("state"):
        state = data.state or amazon_shipping.get("state") or (amazon_order.get("state") if amazon_order else None)
        if state:
            update_data["state"] = state
            fixes_applied.append(f"State: {state}")
    
    if data.pincode or not order.get("pincode"):
        pincode = data.pincode or amazon_shipping.get("postal_code") or (amazon_order.get("postal_code") if amazon_order else None)
        if pincode:
            update_data["pincode"] = pincode
            fixes_applied.append(f"Pincode: {pincode}")
    
    # 2. FIX SKU MAPPING
    if data.master_sku_id:
        master_sku = await db.master_skus.find_one({"id": data.master_sku_id}, {"_id": 0})
        if master_sku:
            update_data["master_sku_id"] = data.master_sku_id
            update_data["master_sku_name"] = master_sku.get("name")
            update_data["sku_code"] = master_sku.get("sku_code")
            # Also update weight/dimensions from SKU
            if master_sku.get("weight"):
                update_data["weight"] = master_sku.get("weight")
            if master_sku.get("dimensions"):
                update_data["dimensions"] = master_sku.get("dimensions")
            fixes_applied.append(f"SKU mapped: {master_sku.get('name')}")
    
    # 3. FIX TRACKING
    if data.tracking_id:
        update_data["tracking_id"] = data.tracking_id
        fixes_applied.append(f"Tracking ID: {data.tracking_id}")
    
    # 4. UPDATE FILES
    if data.invoice_url:
        update_data["invoice_url"] = data.invoice_url
        fixes_applied.append("Invoice uploaded")
    
    if data.label_url:
        update_data["label_url"] = data.label_url
        fixes_applied.append("Shipping label uploaded")
    
    # Apply update
    if collection == "dispatches":
        await db.dispatches.update_one(
            {"id": order.get("id")},
            {"$set": update_data}
        )
    else:
        await db.pending_fulfillment.update_one(
            {"id": order.get("id")},
            {"$set": update_data}
        )
    
    # Get updated order and run diagnosis
    if collection == "dispatches":
        updated_order = await db.dispatches.find_one({"id": order.get("id")}, {"_id": 0})
    else:
        updated_order = await db.pending_fulfillment.find_one({"id": order.get("id")}, {"_id": 0})
    
    # Re-run diagnosis to check remaining issues
    diagnosis = await bot_diagnose_order(data.order_id, user)
    
    return {
        "success": True,
        "message": f"Fixed {len(fixes_applied)} issues",
        "fixes_applied": fixes_applied,
        "remaining_issues": diagnosis.get("issues", []),
        "ready_for_dispatch": diagnosis.get("ready_for_dispatch", False),
        "diagnosis": diagnosis
    }


@bot_router.post("/auto-fix-from-amazon")
async def bot_auto_fix_from_amazon(
    order_id: str,
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Automatically fix order data by pulling from Amazon order.
    One-click fix for orders that have Amazon data available.
    """
    now = datetime.now(timezone.utc)
    
    # Find the order
    order = await db.pending_fulfillment.find_one(
        {"$or": [
            {"id": order_id},
            {"order_id": order_id},
            {"amazon_order_id": order_id}
        ]},
        {"_id": 0}
    )
    
    collection = "pending_fulfillment"
    if not order:
        order = await db.dispatches.find_one(
            {"$or": [{"id": order_id}, {"order_id": order_id}]},
            {"_id": 0}
        )
        collection = "dispatches"
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get Amazon order
    amazon_order = await db.amazon_orders.find_one(
        {"$or": [
            {"amazon_order_id": order.get("amazon_order_id") or order_id},
            {"order_id": order.get("order_id") or order_id}
        ]},
        {"_id": 0}
    )
    
    if not amazon_order:
        raise HTTPException(status_code=404, detail="Amazon order not found - cannot auto-fix")
    
    shipping = amazon_order.get("shipping_address") or {}
    
    # Build auto-fix update
    update_data = {
        "updated_at": now.isoformat(),
        "auto_fixed_at": now.isoformat(),
        "auto_fixed_by": user["id"]
    }
    fixes = []
    
    # Customer name
    if not order.get("customer_name"):
        name = amazon_order.get("buyer_name") or shipping.get("name")
        if name:
            update_data["customer_name"] = name
            fixes.append(f"Name: {name}")
    
    # Phone
    if not (order.get("customer_phone") or order.get("phone")):
        phone = amazon_order.get("buyer_phone") or shipping.get("phone")
        if phone:
            update_data["customer_phone"] = phone
            update_data["phone"] = phone
            fixes.append(f"Phone: {phone}")
    
    # Address
    if not order.get("address"):
        addr = shipping.get("address_line1")
        if shipping.get("address_line2"):
            addr = f"{addr}, {shipping.get('address_line2')}"
        if addr:
            update_data["address"] = addr
            fixes.append(f"Address: {addr[:40]}...")
    
    # City
    if not order.get("city"):
        city = shipping.get("city") or amazon_order.get("city")
        if city:
            update_data["city"] = city
            fixes.append(f"City: {city}")
    
    # State
    if not order.get("state"):
        state = shipping.get("state") or amazon_order.get("state")
        if state:
            update_data["state"] = state
            fixes.append(f"State: {state}")
    
    # Pincode
    if not order.get("pincode"):
        pincode = shipping.get("postal_code") or amazon_order.get("postal_code")
        if pincode:
            update_data["pincode"] = pincode
            fixes.append(f"Pincode: {pincode}")
    
    # Tracking (if Amazon has it)
    if not order.get("tracking_id") and amazon_order.get("tracking_id"):
        update_data["tracking_id"] = amazon_order.get("tracking_id")
        fixes.append(f"Tracking: {amazon_order.get('tracking_id')}")
    
    if not fixes:
        return {
            "success": True,
            "message": "No fixes needed - all data already present",
            "fixes_applied": []
        }
    
    # Apply update
    if collection == "dispatches":
        await db.dispatches.update_one({"id": order.get("id")}, {"$set": update_data})
    else:
        await db.pending_fulfillment.update_one({"id": order.get("id")}, {"$set": update_data})
    
    # Run diagnosis
    diagnosis = await bot_diagnose_order(order_id, user)
    
    return {
        "success": True,
        "message": f"Auto-fixed {len(fixes)} fields from Amazon data",
        "fixes_applied": fixes,
        "remaining_issues": diagnosis.get("issues", []),
        "ready_for_dispatch": diagnosis.get("ready_for_dispatch", False)
    }


@bot_router.get("/dispatch-queue-health")
async def get_dispatch_queue_health(
    user: dict = Depends(require_roles(["admin", "accountant"]))
):
    """
    Get health summary of all orders in dispatch queue.
    Shows how many have issues and what types of issues.
    """
    # Get all dispatch queue items
    dispatch_items = await db.dispatches.find(
        {"status": {"$in": ["ready_for_dispatch", "ready_to_dispatch", "pending_dispatch"]}},
        {"_id": 0}
    ).to_list(1000)
    
    # Also get pending fulfillment items
    pf_items = await db.pending_fulfillment.find(
        {"status": {"$in": ["pending_dispatch", "in_dispatch_queue", "approved"]}},
        {"_id": 0}
    ).to_list(1000)
    
    all_items = dispatch_items + pf_items
    
    summary = {
        "total_in_queue": len(all_items),
        "ready_to_dispatch": 0,
        "with_issues": 0,
        "issues_breakdown": {
            "missing_phone": 0,
            "missing_address": 0,
            "missing_sku": 0,
            "missing_tracking": 0,
            "missing_invoice": 0
        },
        "orders_needing_fix": []
    }
    
    for item in all_items:
        has_issue = False
        order_issues = []
        
        # Check phone
        if not (item.get("customer_phone") or item.get("phone") or item.get("buyer_phone")):
            summary["issues_breakdown"]["missing_phone"] += 1
            has_issue = True
            order_issues.append("phone")
        
        # Check address
        if not item.get("address"):
            summary["issues_breakdown"]["missing_address"] += 1
            has_issue = True
            order_issues.append("address")
        
        # Check SKU
        if not item.get("master_sku_id"):
            summary["issues_breakdown"]["missing_sku"] += 1
            has_issue = True
            order_issues.append("sku")
        
        # Check tracking (for non-EasyShip)
        if not item.get("is_easy_ship") and not item.get("tracking_id"):
            summary["issues_breakdown"]["missing_tracking"] += 1
            has_issue = True
            order_issues.append("tracking")
        
        # Check invoice
        if not item.get("invoice_url"):
            summary["issues_breakdown"]["missing_invoice"] += 1
            has_issue = True
            order_issues.append("invoice")
        
        if has_issue:
            summary["with_issues"] += 1
            summary["orders_needing_fix"].append({
                "order_id": item.get("order_id") or item.get("amazon_order_id") or item.get("id"),
                "customer": item.get("customer_name") or item.get("buyer_name") or "Unknown",
                "issues": order_issues,
                "has_amazon_data": bool(item.get("amazon_order_id"))
            })
        else:
            summary["ready_to_dispatch"] += 1
    
    # Limit orders_needing_fix to first 50
    summary["orders_needing_fix"] = summary["orders_needing_fix"][:50]
    
    return summary

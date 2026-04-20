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

"""
VoltDoctor Integration - Background Sync Service
Syncs warranties and tickets between VoltDoctor app and MuscleGrid CRM
"""

import os
import asyncio
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voltdoctor_sync")

# VoltDoctor MongoDB Atlas connection
VOLTDOCTOR_MONGO_URL = "mongodb+srv://voltdoctor:voltdoctor123@voltdoctor.82eukpe.mongodb.net/?appName=voltdoctor"
VOLTDOCTOR_DB_NAME = "test_database"

# CRM MongoDB connection (from environment)
CRM_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
CRM_DB_NAME = os.environ.get("DB_NAME", "test_database")

# Global database connections
voltdoctor_client: Optional[AsyncIOMotorClient] = None
voltdoctor_db = None
crm_client: Optional[AsyncIOMotorClient] = None
crm_db = None


async def init_connections():
    """Initialize database connections"""
    global voltdoctor_client, voltdoctor_db, crm_client, crm_db
    
    try:
        # Connect to VoltDoctor MongoDB Atlas
        voltdoctor_client = AsyncIOMotorClient(VOLTDOCTOR_MONGO_URL)
        voltdoctor_db = voltdoctor_client[VOLTDOCTOR_DB_NAME]
        
        # Connect to CRM MongoDB
        crm_client = AsyncIOMotorClient(CRM_MONGO_URL)
        crm_db = crm_client[CRM_DB_NAME]
        
        # Test connections
        await voltdoctor_db.command("ping")
        await crm_db.command("ping")
        
        logger.info("✅ Database connections established")
        return True
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        return False


def map_voltdoctor_warranty_to_crm(vd_warranty: dict) -> dict:
    """Map VoltDoctor warranty schema to CRM warranty schema"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Generate CRM-compatible warranty ID
    crm_id = str(uuid.uuid4())
    
    # Map product type
    device_type_map = {
        "solar_inverter": "Inverter",
        "lfp_battery": "Battery",
        "voltage_stabilizer": "Stabilizer",
    }
    device_type = device_type_map.get(vd_warranty.get("product_type", ""), "Other")
    
    # Map status
    status_map = {
        "submitted": "pending",
        "pending": "pending",
        "under_review": "pending",
        "more_info_required": "pending",
        "approved": "approved",
        "rejected": "rejected",
    }
    status = status_map.get(vd_warranty.get("status", "submitted"), "pending")
    
    # Calculate warranty end date
    warranty_years = vd_warranty.get("warranty_years", 1)
    purchase_date_str = vd_warranty.get("purchase_date", "")
    warranty_end_date = None
    if purchase_date_str:
        try:
            # Parse DD/MM/YYYY format
            parts = purchase_date_str.split("/")
            if len(parts) == 3:
                purchase_date = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                warranty_end_date = purchase_date.replace(year=purchase_date.year + warranty_years).strftime("%Y-%m-%d")
        except:
            pass
    
    return {
        "id": crm_id,
        "voltdoctor_id": vd_warranty.get("id"),  # Track original ID for sync
        "voltdoctor_warranty_number": vd_warranty.get("warranty_number"),
        "source": "voltdoctor",  # Mark source for tracking
        
        # Customer info
        "user_id": vd_warranty.get("user_id"),
        "first_name": vd_warranty.get("customer_name", "").split()[0] if vd_warranty.get("customer_name") else "",
        "last_name": " ".join(vd_warranty.get("customer_name", "").split()[1:]) if vd_warranty.get("customer_name") else "",
        "email": vd_warranty.get("customer_email") or vd_warranty.get("email", ""),
        "phone": vd_warranty.get("customer_phone") or vd_warranty.get("mobile", ""),
        "address": vd_warranty.get("address", ""),
        "pincode": vd_warranty.get("pincode", ""),
        
        # Product info
        "device_type": device_type,
        "product_name": vd_warranty.get("product_name", ""),
        "brand": vd_warranty.get("product_brand") or vd_warranty.get("brand", ""),
        "model": vd_warranty.get("product_model") or vd_warranty.get("model_number", ""),
        "serial_number": vd_warranty.get("serial_number", ""),
        "order_id": vd_warranty.get("invoice_number", ""),
        
        # Dates
        "purchase_date": purchase_date_str,
        "warranty_end_date": warranty_end_date,
        
        # Invoice - store reference (base64 too large for direct storage)
        "invoice_file": f"/api/voltdoctor/warranty/{vd_warranty.get('id')}/invoice" if vd_warranty.get("invoice_image") else None,
        "has_invoice_image": bool(vd_warranty.get("invoice_image")),
        
        # Status
        "status": status,
        "notes": vd_warranty.get("admin_notes") or "",
        
        # Timestamps
        "created_at": vd_warranty.get("created_at") or now,
        "updated_at": vd_warranty.get("updated_at") or now,
        "synced_at": now,
    }


def map_voltdoctor_ticket_to_crm(vd_ticket: dict) -> dict:
    """Map VoltDoctor support ticket schema to CRM ticket schema"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Generate CRM ticket number
    date_str = datetime.now().strftime("%Y%m%d")
    random_suffix = str(uuid.uuid4())[:4].upper()
    ticket_number = f"MG-VD-{date_str}-{random_suffix}"
    
    # Map product type
    device_type_map = {
        "solar_inverter": "Inverter",
        "lfp_battery": "Battery",
        "voltage_stabilizer": "Stabilizer",
    }
    device_type = device_type_map.get(vd_ticket.get("product_type", ""), "Other")
    
    # Map status
    status_map = {
        "open": "new",
        "in_progress": "in_progress",
        "waiting_customer": "awaiting_customer",
        "resolved": "resolved",
        "closed": "closed",
    }
    status = status_map.get(vd_ticket.get("status", "open"), "new")
    
    # Map priority
    priority_map = {
        "low": "low",
        "medium": "medium",
        "high": "high",
    }
    
    # Determine support type based on category
    category = vd_ticket.get("category", "")
    support_type = "phone"  # default
    if "technical" in category.lower() or "installation" in category.lower():
        support_type = "hardware"
    
    # Build history from VoltDoctor timeline
    history = []
    for conv in vd_ticket.get("conversation", []):
        history.append({
            "action": f"Message from {conv.get('from', 'unknown')}",
            "by": conv.get("from", "unknown"),
            "by_role": "customer" if conv.get("from") == "customer" else "support",
            "timestamp": conv.get("timestamp", now),
            "details": {"message": conv.get("message", "")}
        })
    
    return {
        "id": str(uuid.uuid4()),
        "voltdoctor_id": vd_ticket.get("id"),  # Track original ID for sync
        "voltdoctor_ticket_number": vd_ticket.get("ticket_number"),
        "source": "voltdoctor",  # Mark source for tracking
        
        "ticket_number": ticket_number,
        
        # Customer info
        "customer_id": vd_ticket.get("customer_id"),
        "customer_name": vd_ticket.get("customer_name", ""),
        "customer_email": vd_ticket.get("customer_email", ""),
        "customer_phone": vd_ticket.get("customer_phone", ""),
        
        # Product info
        "device_type": device_type,
        "product_name": f"{vd_ticket.get('product_brand', '')} {vd_ticket.get('product_model', '')}".strip(),
        
        # Ticket details
        "issue_description": f"{vd_ticket.get('subject', '')}\n\n{vd_ticket.get('description', '')}",
        "support_type": support_type,
        "category": category,
        
        # Status
        "status": status,
        "priority": priority_map.get(vd_ticket.get("priority", "medium"), "medium"),
        
        # History
        "history": history,
        "agent_notes": "",
        
        # SLA
        "sla_due": None,
        "sla_breached": False,
        
        # Timestamps
        "created_at": vd_ticket.get("created_at") or now,
        "updated_at": vd_ticket.get("updated_at") or now,
        "synced_at": now,
    }


def map_crm_status_to_voltdoctor_warranty(crm_status: str) -> str:
    """Map CRM warranty status back to VoltDoctor format"""
    status_map = {
        "pending": "under_review",
        "approved": "approved",
        "rejected": "rejected",
    }
    return status_map.get(crm_status, "pending")


def map_crm_status_to_voltdoctor_ticket(crm_status: str) -> str:
    """Map CRM ticket status back to VoltDoctor format"""
    status_map = {
        "new": "open",
        "assigned": "in_progress",
        "in_progress": "in_progress",
        "escalated": "in_progress",
        "hardware_service": "in_progress",
        "awaiting_label": "in_progress",
        "label_uploaded": "in_progress",
        "received_at_factory": "in_progress",
        "repair_in_progress": "in_progress",
        "repair_completed": "in_progress",
        "service_invoice_added": "in_progress",
        "dispatched": "in_progress",
        "awaiting_customer": "waiting_customer",
        "resolved": "resolved",
        "closed": "closed",
    }
    return status_map.get(crm_status, "open")


async def sync_warranties_from_voltdoctor():
    """Sync new warranties from VoltDoctor to CRM"""
    if voltdoctor_db is None or crm_db is None:
        logger.error("Database connections not initialized")
        return {"synced": 0, "errors": []}
    
    synced = 0
    errors = []
    
    try:
        # Get all warranties from VoltDoctor
        vd_warranties = await voltdoctor_db.warranties.find({}, {"_id": 0}).to_list(1000)
        logger.info(f"Found {len(vd_warranties)} warranties in VoltDoctor")
        
        for vd_warranty in vd_warranties:
            try:
                vd_id = vd_warranty.get("id")
                if not vd_id:
                    continue
                
                # Check if already synced
                existing = await crm_db.warranties.find_one({"voltdoctor_id": vd_id})
                if existing:
                    # Update status if changed in VoltDoctor
                    vd_status = vd_warranty.get("status", "")
                    if vd_status and vd_status != existing.get("voltdoctor_last_status"):
                        # VoltDoctor status changed, but don't overwrite CRM decisions
                        await crm_db.warranties.update_one(
                            {"voltdoctor_id": vd_id},
                            {"$set": {
                                "voltdoctor_last_status": vd_status,
                                "synced_at": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                    continue
                
                # Map and insert new warranty
                crm_warranty = map_voltdoctor_warranty_to_crm(vd_warranty)
                crm_warranty["voltdoctor_last_status"] = vd_warranty.get("status", "")
                await crm_db.warranties.insert_one(crm_warranty)
                synced += 1
                logger.info(f"✅ Synced warranty: {vd_warranty.get('warranty_number')}")
                
            except Exception as e:
                errors.append(f"Warranty {vd_warranty.get('warranty_number', 'unknown')}: {str(e)}")
                logger.error(f"Error syncing warranty: {e}")
        
    except Exception as e:
        errors.append(f"Warranty sync error: {str(e)}")
        logger.error(f"Warranty sync failed: {e}")
    
    return {"synced": synced, "errors": errors}


async def sync_tickets_from_voltdoctor():
    """Sync new support tickets from VoltDoctor to CRM"""
    if voltdoctor_db is None or crm_db is None:
        logger.error("Database connections not initialized")
        return {"synced": 0, "errors": []}
    
    synced = 0
    errors = []
    
    try:
        # Get all tickets from VoltDoctor
        vd_tickets = await voltdoctor_db.support_tickets.find({}, {"_id": 0}).to_list(1000)
        logger.info(f"Found {len(vd_tickets)} tickets in VoltDoctor")
        
        for vd_ticket in vd_tickets:
            try:
                vd_id = vd_ticket.get("id")
                if not vd_id:
                    continue
                
                # Check if already synced
                existing = await crm_db.tickets.find_one({"voltdoctor_id": vd_id})
                if existing:
                    # Sync conversation updates from VoltDoctor
                    vd_conversation = vd_ticket.get("conversation", [])
                    existing_conv_count = len(existing.get("history", []))
                    
                    if len(vd_conversation) > existing_conv_count:
                        # New messages in VoltDoctor, update history
                        new_history = existing.get("history", [])
                        for conv in vd_conversation[existing_conv_count:]:
                            new_history.append({
                                "action": f"Message from {conv.get('from', 'unknown')} (VoltDoctor)",
                                "by": conv.get("from", "unknown"),
                                "by_role": "customer" if conv.get("from") == "customer" else "support",
                                "timestamp": conv.get("timestamp", datetime.now(timezone.utc).isoformat()),
                                "details": {"message": conv.get("message", "")}
                            })
                        
                        await crm_db.tickets.update_one(
                            {"voltdoctor_id": vd_id},
                            {"$set": {
                                "history": new_history,
                                "synced_at": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                    continue
                
                # Map and insert new ticket
                crm_ticket = map_voltdoctor_ticket_to_crm(vd_ticket)
                await crm_db.tickets.insert_one(crm_ticket)
                synced += 1
                logger.info(f"✅ Synced ticket: {vd_ticket.get('ticket_number')}")
                
            except Exception as e:
                errors.append(f"Ticket {vd_ticket.get('ticket_number', 'unknown')}: {str(e)}")
                logger.error(f"Error syncing ticket: {e}")
        
    except Exception as e:
        errors.append(f"Ticket sync error: {str(e)}")
        logger.error(f"Ticket sync failed: {e}")
    
    return {"synced": synced, "errors": errors}


async def sync_status_to_voltdoctor():
    """Sync status updates from CRM back to VoltDoctor"""
    if voltdoctor_db is None or crm_db is None:
        logger.error("Database connections not initialized")
        return {"updated": 0, "errors": []}
    
    updated = 0
    errors = []
    
    try:
        # Find CRM warranties that originated from VoltDoctor and have status changes
        crm_warranties = await crm_db.warranties.find(
            {"source": "voltdoctor", "voltdoctor_id": {"$exists": True}},
            {"_id": 0}
        ).to_list(1000)
        
        for crm_warranty in crm_warranties:
            try:
                vd_id = crm_warranty.get("voltdoctor_id")
                crm_status = crm_warranty.get("status")
                vd_status = map_crm_status_to_voltdoctor_warranty(crm_status)
                
                # Check if status needs update in VoltDoctor
                vd_warranty = await voltdoctor_db.warranties.find_one({"id": vd_id})
                if vd_warranty and vd_warranty.get("status") != vd_status:
                    # Update VoltDoctor warranty status
                    now = datetime.now(timezone.utc).isoformat()
                    timeline_entry = {
                        "action": f"Status updated to {vd_status} (from MuscleGrid CRM)",
                        "by": "MuscleGrid CRM Sync",
                        "timestamp": now,
                        "details": f"CRM status: {crm_status}"
                    }
                    
                    await voltdoctor_db.warranties.update_one(
                        {"id": vd_id},
                        {
                            "$set": {
                                "status": vd_status,
                                "updated_at": now,
                                "reviewed_at": now if vd_status in ["approved", "rejected"] else None,
                            },
                            "$push": {"timeline": timeline_entry}
                        }
                    )
                    updated += 1
                    logger.info(f"✅ Updated VoltDoctor warranty {vd_id} status to {vd_status}")
                    
            except Exception as e:
                errors.append(f"Warranty status sync error: {str(e)}")
        
        # Find CRM tickets that originated from VoltDoctor and have status changes
        crm_tickets = await crm_db.tickets.find(
            {"source": "voltdoctor", "voltdoctor_id": {"$exists": True}},
            {"_id": 0}
        ).to_list(1000)
        
        for crm_ticket in crm_tickets:
            try:
                vd_id = crm_ticket.get("voltdoctor_id")
                crm_status = crm_ticket.get("status")
                vd_status = map_crm_status_to_voltdoctor_ticket(crm_status)
                
                # Check if status needs update in VoltDoctor
                vd_ticket = await voltdoctor_db.support_tickets.find_one({"id": vd_id})
                if vd_ticket and vd_ticket.get("status") != vd_status:
                    # Update VoltDoctor ticket status
                    now = datetime.now(timezone.utc).isoformat()
                    history_entry = {
                        "action": f"Status updated to {vd_status}",
                        "by": "MuscleGrid CRM Sync",
                        "timestamp": now,
                        "details": f"CRM status: {crm_status}"
                    }
                    
                    # Add CRM notes to conversation if any
                    conversation_updates = []
                    if crm_ticket.get("agent_notes") and crm_ticket.get("agent_notes") != vd_ticket.get("last_crm_notes"):
                        conversation_updates.append({
                            "from": "agent",
                            "message": f"[MuscleGrid CRM Update] {crm_ticket.get('agent_notes')}",
                            "timestamp": now,
                            "is_internal": False
                        })
                    
                    update_ops = {
                        "$set": {
                            "status": vd_status,
                            "updated_at": now,
                            "last_crm_notes": crm_ticket.get("agent_notes", "")
                        },
                        "$push": {"history": history_entry}
                    }
                    
                    if conversation_updates:
                        update_ops["$push"]["conversation"] = {"$each": conversation_updates}
                    
                    await voltdoctor_db.support_tickets.update_one({"id": vd_id}, update_ops)
                    updated += 1
                    logger.info(f"✅ Updated VoltDoctor ticket {vd_id} status to {vd_status}")
                    
            except Exception as e:
                errors.append(f"Ticket status sync error: {str(e)}")
        
    except Exception as e:
        errors.append(f"Status sync error: {str(e)}")
        logger.error(f"Status sync failed: {e}")
    
    return {"updated": updated, "errors": errors}


async def run_full_sync():
    """Run complete bidirectional sync"""
    logger.info("=" * 50)
    logger.info("Starting VoltDoctor <-> CRM Sync")
    logger.info("=" * 50)
    
    # Initialize connections if needed
    if voltdoctor_db is None or crm_db is None:
        success = await init_connections()
        if not success:
            return {"success": False, "error": "Failed to connect to databases"}
    
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "warranties_synced": 0,
        "tickets_synced": 0,
        "statuses_updated": 0,
        "errors": []
    }
    
    # Sync warranties from VoltDoctor to CRM
    warranty_result = await sync_warranties_from_voltdoctor()
    results["warranties_synced"] = warranty_result["synced"]
    results["errors"].extend(warranty_result["errors"])
    
    # Sync tickets from VoltDoctor to CRM
    ticket_result = await sync_tickets_from_voltdoctor()
    results["tickets_synced"] = ticket_result["synced"]
    results["errors"].extend(ticket_result["errors"])
    
    # Sync status updates back to VoltDoctor
    status_result = await sync_status_to_voltdoctor()
    results["statuses_updated"] = status_result["updated"]
    results["errors"].extend(status_result["errors"])
    
    results["success"] = len(results["errors"]) == 0
    
    logger.info(f"Sync complete: {results['warranties_synced']} warranties, {results['tickets_synced']} tickets, {results['statuses_updated']} status updates")
    if results["errors"]:
        logger.warning(f"Errors: {results['errors']}")
    
    return results


# For testing
if __name__ == "__main__":
    asyncio.run(run_full_sync())

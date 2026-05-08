"""
Background Job Processing System for Browser Agent
Provides reliable, resumable order processing with:
- Job queue with state persistence
- Checkpoint-based recovery
- GPT-powered error analysis
- Real-time progress updates
"""

import asyncio
import os
import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, asdict
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("browser_agent.jobs")


class JobStatus(str, Enum):
    """Job status states"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ProcessingStep(str, Enum):
    """Order processing checkpoint steps"""
    QUEUED = "queued"
    SCRAPING_ORDER = "scraping_order"
    VALIDATING_DATA = "validating_data"
    CREATING_SHIPMENT = "creating_shipment"
    MANIFESTING = "manifesting"
    FETCHING_AWB = "fetching_awb"
    DOWNLOADING_LABEL = "downloading_label"
    UPDATING_TRACKING = "updating_tracking"
    SAVING_RECORD = "saving_record"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class JobCheckpoint:
    """Checkpoint data for resumable processing"""
    step: ProcessingStep
    order_id: str
    data: Dict[str, Any]  # Step-specific data (AWB, system_order_id, etc.)
    error: Optional[str] = None
    timestamp: str = ""
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()


@dataclass
class ProcessingJob:
    """Represents a background processing job"""
    job_id: str
    order_ids: List[str]
    status: JobStatus
    created_at: str
    updated_at: str
    current_order_index: int = 0
    checkpoints: Dict[str, JobCheckpoint] = None  # order_id -> checkpoint
    results: List[Dict] = None
    error: Optional[str] = None
    thinking_log: List[Dict] = None
    
    def __post_init__(self):
        if self.checkpoints is None:
            self.checkpoints = {}
        if self.results is None:
            self.results = []
        if self.thinking_log is None:
            self.thinking_log = []
    
    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "order_ids": self.order_ids,
            "status": self.status.value if isinstance(self.status, JobStatus) else self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "current_order_index": self.current_order_index,
            "checkpoints": {k: asdict(v) if isinstance(v, JobCheckpoint) else v for k, v in self.checkpoints.items()},
            "results": self.results,
            "error": self.error,
            "thinking_log": self.thinking_log,
            "progress": {
                "total": len(self.order_ids),
                "completed": len(self.results),
                "current": self.current_order_index + 1 if self.status == JobStatus.RUNNING else 0
            }
        }


class JobQueue:
    """
    Background job queue with MongoDB persistence.
    Supports resumable processing and real-time updates.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, status_callback: Callable = None):
        self.db = db
        self.collection = db.browser_agent_jobs
        self.status_callback = status_callback or (lambda x: None)
        self._running_jobs: Dict[str, asyncio.Task] = {}
    
    async def create_job(self, order_ids: List[str]) -> ProcessingJob:
        """Create a new processing job"""
        import uuid
        
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        
        job = ProcessingJob(
            job_id=job_id,
            order_ids=order_ids,
            status=JobStatus.PENDING,
            created_at=now,
            updated_at=now
        )
        
        # Persist to database
        await self.collection.insert_one(job.to_dict())
        
        logger.info(f"Created job {job_id} with {len(order_ids)} orders")
        return job
    
    async def get_job(self, job_id: str) -> Optional[ProcessingJob]:
        """Get job by ID"""
        doc = await self.collection.find_one({"job_id": job_id})
        if not doc:
            return None
        
        return ProcessingJob(
            job_id=doc["job_id"],
            order_ids=doc["order_ids"],
            status=JobStatus(doc["status"]),
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
            current_order_index=doc.get("current_order_index", 0),
            checkpoints={k: JobCheckpoint(**v) if isinstance(v, dict) else v for k, v in doc.get("checkpoints", {}).items()},
            results=doc.get("results", []),
            error=doc.get("error"),
            thinking_log=doc.get("thinking_log", [])
        )
    
    async def update_job(self, job: ProcessingJob):
        """Update job in database"""
        job.updated_at = datetime.now(timezone.utc).isoformat()
        await self.collection.update_one(
            {"job_id": job.job_id},
            {"$set": job.to_dict()}
        )
    
    async def add_thinking_log(self, job_id: str, thought: str):
        """Add a thinking log entry"""
        entry = {
            "time": datetime.now(timezone.utc).isoformat(),
            "thought": thought
        }
        await self.collection.update_one(
            {"job_id": job_id},
            {
                "$push": {"thinking_log": entry},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        # Also notify via callback
        await self.status_callback(f"🧠 {thought}")
    
    async def set_checkpoint(self, job_id: str, order_id: str, checkpoint: JobCheckpoint):
        """Set a checkpoint for an order"""
        await self.collection.update_one(
            {"job_id": job_id},
            {
                "$set": {
                    f"checkpoints.{order_id}": asdict(checkpoint),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    async def get_checkpoint(self, job_id: str, order_id: str) -> Optional[JobCheckpoint]:
        """Get the last checkpoint for an order"""
        job = await self.get_job(job_id)
        if job and order_id in job.checkpoints:
            cp = job.checkpoints[order_id]
            if isinstance(cp, dict):
                return JobCheckpoint(**cp)
            return cp
        return None
    
    async def add_result(self, job_id: str, result: dict):
        """Add a processing result"""
        await self.collection.update_one(
            {"job_id": job_id},
            {
                "$push": {"results": result},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
    
    async def get_recent_jobs(self, limit: int = 10) -> List[dict]:
        """Get recent jobs"""
        cursor = self.collection.find().sort("created_at", -1).limit(limit)
        jobs = []
        async for doc in cursor:
            doc.pop("_id", None)
            jobs.append(doc)
        return jobs


class GPTErrorAnalyzer:
    """
    Uses GPT to analyze errors when pattern matching fails.
    Provides intelligent fix suggestions.
    """
    
    def __init__(self, notify_callback: Callable = None):
        self.notify = notify_callback or (lambda x: None)
    
    async def analyze_error(self, error_response: dict, payload: dict, context: str = "") -> dict:
        """
        Use GPT to analyze an API error and suggest fixes.
        Returns: {"success": bool, "fixes": [...], "explanation": str, "modified_payload": dict}
        """
        try:
            from emergentintegrations.llm.chat import chat, LlmModel
            
            await self.notify("🧠 Calling GPT to analyze this error...")
            
            # Prepare error context
            error_msg = error_response.get("message", "")
            validation_errors = error_response.get("validationErrors", [])
            errors_dict = error_response.get("errors", {})
            
            error_summary = f"Message: {error_msg}\n"
            if validation_errors:
                error_summary += "Validation Errors:\n"
                for err in validation_errors:
                    error_summary += f"  - {err.get('propertyName', 'Unknown')}: {err.get('errorMessage', 'Unknown')}\n"
            if errors_dict:
                error_summary += "Errors Dict:\n"
                for field, msgs in errors_dict.items():
                    error_summary += f"  - {field}: {msgs}\n"
            
            # Prepare payload summary (truncate large fields)
            payload_summary = json.dumps(payload, indent=2, default=str)
            if len(payload_summary) > 3000:
                payload_summary = payload_summary[:3000] + "\n... (truncated)"
            
            prompt = f"""You are an expert at debugging Bigship shipping API errors.

## Error Response:
{error_summary}

## Current Payload:
{payload_summary}

## Context:
{context}

## Bigship API Requirements:
- invoice_id: 1-25 characters, alphanumeric and -/
- first_name/last_name: 3-25 characters, letters, dots, spaces only
- contact_number_primary: 10-12 digits, starts with 0,6,7,8,9
- address_line1: 10-50 characters
- pincode: 6 digits
- product_category: Must be one of: Accessories, FashionClothing, BookStationary, Electronics, FMCG, Footwear, Toys, SportsEquipment, Others, Wellness, Medicines
- For B2B: each_box_invoice_amount and each_product_invoice_amount must be 0

Analyze the error and provide:
1. What exactly is wrong (be specific)
2. The exact fix needed (provide the corrected value)
3. If this looks like a duplicate order error

Respond in this exact JSON format:
{{
  "diagnosis": "Brief explanation of what's wrong",
  "is_duplicate": true/false,
  "fixes": [
    {{"field": "order_detail.invoice_id", "current": "current_value", "fixed": "fixed_value", "reason": "why"}}
  ]
}}"""

            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=LlmModel.GPT_4O_MINI,
                prompt=prompt
            )
            
            # Parse GPT response
            response_text = response.message.strip()
            
            # Extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                analysis = json.loads(json_match.group())
                
                await self.notify(f"🧠 GPT Analysis: {analysis.get('diagnosis', 'Unknown')}")
                
                # Apply fixes to payload
                modified_payload = json.loads(json.dumps(payload))
                fixes_applied = []
                
                for fix in analysis.get("fixes", []):
                    field_path = fix.get("field", "")
                    fixed_value = fix.get("fixed", "")
                    reason = fix.get("reason", "")
                    
                    if field_path and fixed_value:
                        # Apply the fix
                        if self._apply_fix(modified_payload, field_path, fixed_value):
                            fixes_applied.append(f"{field_path}: {reason}")
                            await self.notify(f"🔧 GPT Fix: {field_path} → {fixed_value}")
                
                return {
                    "success": True,
                    "is_duplicate": analysis.get("is_duplicate", False),
                    "diagnosis": analysis.get("diagnosis", ""),
                    "fixes": fixes_applied,
                    "modified_payload": modified_payload
                }
            else:
                await self.notify("⚠️ Could not parse GPT response")
                return {"success": False, "error": "Could not parse GPT response"}
                
        except Exception as e:
            await self.notify(f"⚠️ GPT analysis failed: {str(e)}")
            logger.error(f"GPT error analysis failed: {e}")
            return {"success": False, "error": str(e)}
    
    def _apply_fix(self, payload: dict, field_path: str, value: Any) -> bool:
        """Apply a fix to a nested field in the payload"""
        try:
            parts = field_path.split(".")
            obj = payload
            
            for i, part in enumerate(parts[:-1]):
                # Handle array notation like box_details[0]
                if "[" in part:
                    key = part.split("[")[0]
                    index = int(part.split("[")[1].rstrip("]"))
                    obj = obj[key][index]
                else:
                    obj = obj[part]
            
            # Set the final value
            final_key = parts[-1]
            if "[" in final_key:
                key = final_key.split("[")[0]
                index = int(final_key.split("[")[1].rstrip("]"))
                obj[key][index] = value
            else:
                obj[final_key] = value
            
            return True
        except Exception as e:
            logger.warning(f"Could not apply fix to {field_path}: {e}")
            return False

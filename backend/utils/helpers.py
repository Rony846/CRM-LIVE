"""
MuscleGrid CRM - Utility Functions
"""

from datetime import datetime, timezone, timedelta
import uuid
import bcrypt
import jwt
import random
import string
from typing import Optional

# JWT Configuration
JWT_SECRET = "musclegrid-crm-secret-key-2024-enterprise"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# User Roles
ROLES = ["customer", "call_support", "supervisor", "service_agent", "accountant", "dispatcher", "admin", "gate"]

# SLA Hours by Role
SLA_HOURS = {
    "support": 48,
    "supervisor": 48,
    "accountant": 48,
    "technician": 72,
    "dispatcher": 48
}

def generate_ticket_number(date: datetime = None) -> str:
    """Generate ticket number: MG-R-YYYYMMDD-NNNNN"""
    date = date or datetime.now(timezone.utc)
    random_suffix = ''.join(random.choices(string.digits, k=5))
    return f"MG-R-{date.strftime('%Y%m%d')}-{random_suffix}"

def generate_warranty_number(date: datetime = None) -> str:
    """Generate warranty number: MG-W-YYYYMMDD-NNNNN"""
    date = date or datetime.now(timezone.utc)
    random_suffix = ''.join(random.choices(string.digits, k=5))
    return f"MG-W-{date.strftime('%Y%m%d')}-{random_suffix}"

def generate_dispatch_number(date: datetime = None) -> str:
    """Generate dispatch number: MG-D-YYYYMMDD-NNNNN"""
    date = date or datetime.now(timezone.utc)
    random_suffix = ''.join(random.choices(string.digits, k=5))
    return f"MG-D-{date.strftime('%Y%m%d')}-{random_suffix}"

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    """Create JWT token"""
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    """Decode JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def calculate_sla_due(created_at: datetime, sla_hours: int = 48) -> str:
    """Calculate SLA due datetime"""
    return (created_at + timedelta(hours=sla_hours)).isoformat()

def check_sla_breached(sla_due: str) -> bool:
    """Check if SLA is breached"""
    try:
        due = datetime.fromisoformat(sla_due.replace('Z', '+00:00'))
        return datetime.now(timezone.utc) > due
    except:
        return False

def hours_remaining(sla_due: str) -> float:
    """Calculate hours remaining until SLA breach"""
    try:
        due = datetime.fromisoformat(sla_due.replace('Z', '+00:00'))
        diff = (due - datetime.now(timezone.utc)).total_seconds() / 3600
        return max(0, round(diff, 1))
    except:
        return 0

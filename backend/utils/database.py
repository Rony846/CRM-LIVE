"""
MuscleGrid CRM - Database accessor.

The actual Motor client is created in server.py at module load. This module
exposes a lazy accessor so utils.* can reuse the SAME client instead of
opening a second connection pool against the same MongoDB (which is what the
previous eager `AsyncIOMotorClient(...)` here was doing — double pool,
doubled cursor state, and divergent failure modes across the two clients).
"""

from typing import Any

_db: Any = None


def set_db(db_obj) -> None:
    """Called once by server.py at startup to share its Motor client."""
    global _db
    _db = db_obj


def get_db():
    """Return the shared Motor database. server.py registers it on startup."""
    if _db is None:
        # Lazy fallback for one-off scripts that import utils without server.py
        # — keep this path but make it explicit so production never silently
        # creates a second client.
        import os
        from dotenv import load_dotenv
        from pathlib import Path
        from motor.motor_asyncio import AsyncIOMotorClient
        ROOT_DIR = Path(__file__).parent.parent
        load_dotenv(ROOT_DIR / '.env')
        client = AsyncIOMotorClient(os.environ['MONGO_URL'])
        return client[os.environ['DB_NAME']]
    return _db


# Backwards-compatible attribute that resolves the shared db on access.
class _DBProxy:
    def __getattr__(self, name):
        return getattr(get_db(), name)

    def __getitem__(self, name):
        return get_db()[name]


db = _DBProxy()

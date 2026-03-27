"""
MuscleGrid CRM - Centralized Storage Utility
Handles all file storage operations via Synology WebDAV

Configuration:
    STORAGE_TYPE=webdav|local
    WEBDAV_URL=https://files.musclegrid.in
    WEBDAV_BASE_PATH=/crm_uploads
    WEBDAV_USERNAME=crm_service
    WEBDAV_PASSWORD=<password>
    
Folder Structure:
    /crm_uploads/invoices
    /crm_uploads/payment_proofs
    /crm_uploads/pickup_labels
    /crm_uploads/dispatch_labels
    /crm_uploads/certificates
    /crm_uploads/deposits
    /crm_uploads/quotations
    /crm_uploads/tickets
"""

import os
import uuid
import logging
from pathlib import Path
from typing import Optional, Tuple, BinaryIO
from datetime import datetime, timezone
from io import BytesIO

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("storage")

# Storage configuration from environment
STORAGE_TYPE = os.environ.get("STORAGE_TYPE", "local")
WEBDAV_URL = os.environ.get("WEBDAV_URL", "")
WEBDAV_BASE_PATH = os.environ.get("WEBDAV_BASE_PATH", "/crm_uploads")
WEBDAV_USERNAME = os.environ.get("WEBDAV_USERNAME", "")
WEBDAV_PASSWORD = os.environ.get("WEBDAV_PASSWORD", "")

# Local storage fallback path
LOCAL_UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
LOCAL_UPLOAD_DIR.mkdir(exist_ok=True)

# Valid folder names (whitelist)
VALID_FOLDERS = [
    "invoices",
    "payment_proofs", 
    "pickup_labels",
    "dispatch_labels",
    "certificates",
    "deposits",
    "quotations",
    "tickets",
    "general"
]

# WebDAV client instance (lazy initialization)
_webdav_client = None


class StorageError(Exception):
    """Custom exception for storage operations"""
    pass


def get_webdav_client():
    """Get or create WebDAV client instance"""
    global _webdav_client
    
    if _webdav_client is not None:
        return _webdav_client
    
    if not all([WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD]):
        raise StorageError(
            "WebDAV configuration incomplete. Required: WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD"
        )
    
    try:
        from webdav3.client import Client
        
        options = {
            'webdav_hostname': WEBDAV_URL,
            'webdav_login': WEBDAV_USERNAME,
            'webdav_password': WEBDAV_PASSWORD,
            'webdav_root': WEBDAV_BASE_PATH,
            'disable_check': True,  # Skip server check for performance
            'timeout': 30
        }
        
        _webdav_client = Client(options)
        logger.info(f"WebDAV client initialized: {WEBDAV_URL}{WEBDAV_BASE_PATH}")
        return _webdav_client
        
    except ImportError:
        raise StorageError("webdavclient3 package not installed. Run: pip install webdavclient3")
    except Exception as e:
        raise StorageError(f"Failed to initialize WebDAV client: {str(e)}")


def validate_folder(folder: str) -> str:
    """Validate and sanitize folder name"""
    folder = folder.strip().lower().replace(" ", "_")
    
    if folder not in VALID_FOLDERS:
        logger.warning(f"Invalid folder '{folder}', using 'general'")
        folder = "general"
    
    return folder


def generate_filename(original_filename: str, prefix: str = "") -> str:
    """Generate unique filename with timestamp and UUID"""
    # Extract extension
    ext = Path(original_filename).suffix.lower() if original_filename else ".bin"
    
    # Sanitize extension
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx']
    if ext not in allowed_extensions:
        ext = ".bin"
    
    # Generate unique name
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    
    if prefix:
        return f"{prefix}_{timestamp}_{unique_id}{ext}"
    return f"{timestamp}_{unique_id}{ext}"


def ensure_folder_exists(folder: str) -> bool:
    """Ensure folder exists on storage"""
    folder = validate_folder(folder)
    
    if STORAGE_TYPE == "webdav":
        try:
            client = get_webdav_client()
            remote_path = f"/{folder}"
            
            if not client.check(remote_path):
                client.mkdir(remote_path)
                logger.info(f"Created WebDAV folder: {remote_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create WebDAV folder '{folder}': {str(e)}")
            raise StorageError(f"Cannot create folder on NAS: {str(e)}")
    else:
        # Local storage
        local_path = LOCAL_UPLOAD_DIR / folder
        local_path.mkdir(parents=True, exist_ok=True)
        return True


async def upload_file(
    file_data: bytes,
    folder: str,
    original_filename: str,
    filename_prefix: str = ""
) -> Tuple[str, str]:
    """
    Upload file to storage
    
    Args:
        file_data: File content as bytes
        folder: Target folder (invoices, payment_proofs, etc.)
        original_filename: Original filename for extension detection
        filename_prefix: Optional prefix for the filename
        
    Returns:
        Tuple of (relative_path, storage_type)
        
    Raises:
        StorageError: If upload fails
    """
    folder = validate_folder(folder)
    filename = generate_filename(original_filename, filename_prefix)
    relative_path = f"{folder}/{filename}"
    
    logger.info(f"Uploading file: {relative_path} ({len(file_data)} bytes)")
    
    if STORAGE_TYPE == "webdav":
        try:
            client = get_webdav_client()
            
            # Ensure folder exists
            ensure_folder_exists(folder)
            
            # Create temp file for upload (webdavclient3 requires file path)
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(filename).suffix) as tmp:
                tmp.write(file_data)
                tmp_path = tmp.name
            
            try:
                # Upload to WebDAV
                remote_path = f"/{relative_path}"
                client.upload_sync(remote_path=remote_path, local_path=tmp_path)
                
                # Verify upload
                if not client.check(remote_path):
                    raise StorageError(f"Upload verification failed: file not found on NAS")
                
                logger.info(f"Successfully uploaded to WebDAV: {remote_path}")
                return relative_path, "webdav"
                
            finally:
                # Cleanup temp file
                os.unlink(tmp_path)
                
        except StorageError:
            raise
        except Exception as e:
            logger.error(f"WebDAV upload failed: {str(e)}")
            raise StorageError(f"Failed to upload file to NAS: {str(e)}")
    
    else:
        # Local storage
        try:
            local_path = LOCAL_UPLOAD_DIR / folder
            local_path.mkdir(parents=True, exist_ok=True)
            
            file_path = local_path / filename
            with open(file_path, 'wb') as f:
                f.write(file_data)
            
            logger.info(f"Successfully uploaded to local: {file_path}")
            return relative_path, "local"
            
        except Exception as e:
            logger.error(f"Local upload failed: {str(e)}")
            raise StorageError(f"Failed to upload file locally: {str(e)}")


async def upload_file_object(
    file_obj: BinaryIO,
    folder: str,
    original_filename: str,
    filename_prefix: str = ""
) -> Tuple[str, str]:
    """Upload file from file-like object"""
    file_data = file_obj.read()
    return await upload_file(file_data, folder, original_filename, filename_prefix)


async def download_file(relative_path: str) -> Optional[bytes]:
    """
    Download file from storage
    
    Args:
        relative_path: Relative path (e.g., "invoices/20260327_abc123.jpg")
        
    Returns:
        File content as bytes, or None if not found
        
    Raises:
        StorageError: If download fails (not for missing files)
    """
    if not relative_path:
        return None
    
    # Sanitize path
    relative_path = relative_path.lstrip("/")
    
    logger.info(f"Downloading file: {relative_path}")
    
    if STORAGE_TYPE == "webdav":
        try:
            client = get_webdav_client()
            remote_path = f"/{relative_path}"
            
            # Check if file exists
            if not client.check(remote_path):
                logger.warning(f"File not found on WebDAV: {remote_path}")
                return None
            
            # Download to temp file
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                tmp_path = tmp.name
            
            try:
                client.download_sync(remote_path=remote_path, local_path=tmp_path)
                
                with open(tmp_path, 'rb') as f:
                    file_data = f.read()
                
                logger.info(f"Successfully downloaded from WebDAV: {remote_path} ({len(file_data)} bytes)")
                return file_data
                
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                    
        except Exception as e:
            logger.error(f"WebDAV download failed: {str(e)}")
            raise StorageError(f"Failed to download file from NAS: {str(e)}")
    
    else:
        # Local storage
        try:
            file_path = LOCAL_UPLOAD_DIR / relative_path
            
            if not file_path.exists():
                logger.warning(f"File not found locally: {file_path}")
                return None
            
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            logger.info(f"Successfully downloaded from local: {file_path} ({len(file_data)} bytes)")
            return file_data
            
        except Exception as e:
            logger.error(f"Local download failed: {str(e)}")
            raise StorageError(f"Failed to download file locally: {str(e)}")


async def file_exists(relative_path: str) -> bool:
    """Check if file exists in storage"""
    if not relative_path:
        return False
    
    relative_path = relative_path.lstrip("/")
    
    if STORAGE_TYPE == "webdav":
        try:
            client = get_webdav_client()
            return client.check(f"/{relative_path}")
        except Exception as e:
            logger.error(f"WebDAV check failed: {str(e)}")
            return False
    else:
        return (LOCAL_UPLOAD_DIR / relative_path).exists()


async def delete_file(relative_path: str) -> bool:
    """
    Delete file from storage
    
    Returns:
        True if deleted, False if not found
    """
    if not relative_path:
        return False
    
    relative_path = relative_path.lstrip("/")
    logger.info(f"Deleting file: {relative_path}")
    
    if STORAGE_TYPE == "webdav":
        try:
            client = get_webdav_client()
            remote_path = f"/{relative_path}"
            
            if not client.check(remote_path):
                return False
            
            client.clean(remote_path)
            logger.info(f"Deleted from WebDAV: {remote_path}")
            return True
            
        except Exception as e:
            logger.error(f"WebDAV delete failed: {str(e)}")
            raise StorageError(f"Failed to delete file from NAS: {str(e)}")
    else:
        try:
            file_path = LOCAL_UPLOAD_DIR / relative_path
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Deleted locally: {file_path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Local delete failed: {str(e)}")
            raise StorageError(f"Failed to delete file locally: {str(e)}")


def get_file_url(relative_path: str) -> str:
    """
    Get the internal API URL for accessing a file
    Files are served through authenticated backend endpoints, not directly from NAS
    
    Args:
        relative_path: Relative path (e.g., "invoices/20260327_abc123.jpg")
        
    Returns:
        API endpoint URL (e.g., "/api/files/invoices/20260327_abc123.jpg")
    """
    if not relative_path:
        return ""
    
    relative_path = relative_path.lstrip("/")
    return f"/api/files/{relative_path}"


def get_storage_info() -> dict:
    """Get current storage configuration info (for debugging)"""
    return {
        "storage_type": STORAGE_TYPE,
        "webdav_url": WEBDAV_URL if STORAGE_TYPE == "webdav" else None,
        "webdav_base_path": WEBDAV_BASE_PATH if STORAGE_TYPE == "webdav" else None,
        "webdav_configured": bool(WEBDAV_URL and WEBDAV_USERNAME and WEBDAV_PASSWORD),
        "local_upload_dir": str(LOCAL_UPLOAD_DIR),
        "valid_folders": VALID_FOLDERS
    }


# Initialize folders on module load (for local storage)
if STORAGE_TYPE == "local":
    for folder in VALID_FOLDERS:
        (LOCAL_UPLOAD_DIR / folder).mkdir(parents=True, exist_ok=True)

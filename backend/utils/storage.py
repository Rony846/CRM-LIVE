"""
MuscleGrid CRM - Centralized Storage Utility
Handles all file storage operations via Synology File API

Configuration:
    FILE_API_URL=https://files.musclegrid.in
    FILE_API_KEY=<api-key>
    
Endpoints:
    POST /upload/:folder - Upload file (multipart/form-data, field: "file")
    GET /files/:folder - List files in folder
    GET /download/:folder/:filename - Download file
    DELETE /file/:folder/:filename - Delete file

Allowed folders:
    tickets, invoices, payments, certificates
"""

import os
import uuid
import logging
import requests
from pathlib import Path
from typing import Optional, Tuple, List
from datetime import datetime, timezone

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("storage")

# Storage configuration from environment
FILE_API_URL = os.environ.get("FILE_API_URL", "https://files.musclegrid.in")
FILE_API_KEY = os.environ.get("FILE_API_KEY", "")

# Local storage fallback path
LOCAL_UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
LOCAL_UPLOAD_DIR.mkdir(exist_ok=True)

# Valid folder names (whitelist)
VALID_FOLDERS = [
    "tickets",
    "invoices", 
    "payments",
    "certificates"
]

# Folder mapping for backwards compatibility with existing code
FOLDER_MAPPING = {
    "pickup_labels": "tickets",
    "dispatch_labels": "tickets",
    "labels": "tickets",
    "service_invoices": "invoices",
    "warranty_invoices": "invoices",
    "purchase_invoices": "invoices",
    "payment_proofs": "payments",
    "deposits": "payments",
    "dealer_deposits": "payments",
    "dealer_payments": "payments",
    "feedback_screenshots": "tickets",
    "reviews": "tickets",
    "dealer_tickets": "tickets",
    "dealer_documents": "tickets",
    "quotations": "invoices",
    "general": "tickets"
}


class StorageError(Exception):
    """Custom exception for storage operations"""
    pass


def get_api_headers():
    """Get API headers with authentication"""
    if not FILE_API_KEY:
        raise StorageError("FILE_API_KEY not configured")
    return {
        "x-api-key": FILE_API_KEY
    }


def map_folder(folder: str) -> str:
    """Map legacy folder names to allowed folders"""
    if folder in VALID_FOLDERS:
        return folder
    mapped = FOLDER_MAPPING.get(folder)
    if mapped:
        return mapped
    # Default fallback
    logger.warning(f"Unknown folder '{folder}', mapping to 'tickets'")
    return "tickets"


def validate_folder(folder: str) -> bool:
    """Validate folder name"""
    return folder in VALID_FOLDERS or folder in FOLDER_MAPPING


async def upload_file(
    file_data: bytes,
    folder: str,
    original_filename: str,
    filename_prefix: str = ""
) -> Tuple[str, str]:
    """
    Upload file to storage via File API
    
    Args:
        file_data: Raw file bytes
        folder: Target folder name
        original_filename: Original filename for extension
        filename_prefix: Optional prefix for the filename
        
    Returns:
        Tuple of (relative_path, storage_type)
        
    Raises:
        StorageError: If upload fails
    """
    # Map folder to allowed folder
    mapped_folder = map_folder(folder)
    
    # Generate unique filename
    ext = Path(original_filename).suffix.lower() if original_filename else ".bin"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    
    if filename_prefix:
        filename = f"{filename_prefix}_{timestamp}_{unique_id}{ext}"
    else:
        filename = f"{timestamp}_{unique_id}{ext}"
    
    logger.info(f"Uploading file: {mapped_folder}/{filename} ({len(file_data)} bytes)")
    
    try:
        headers = get_api_headers()
        url = f"{FILE_API_URL}/upload/{mapped_folder}"
        
        files = {
            "file": (filename, file_data)
        }
        
        response = requests.post(url, headers=headers, files=files, timeout=60)
        
        if response.status_code == 200:
            # Parse response to get actual filename
            try:
                result = response.json()
                if result.get("success") and result.get("file"):
                    actual_filename = result["file"]
                    actual_folder = result.get("folder", mapped_folder)
                    logger.info(f"Successfully uploaded: {actual_folder}/{actual_filename}")
                    return f"{actual_folder}/{actual_filename}", "file_api"
            except:
                pass
            # Fallback to generated filename
            logger.info(f"Successfully uploaded: {mapped_folder}/{filename}")
            return f"{mapped_folder}/{filename}", "file_api"
        else:
            error_msg = f"Upload failed: HTTP {response.status_code} - {response.text[:200]}"
            logger.error(error_msg)
            raise StorageError(error_msg)
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Upload request failed: {str(e)}")
        raise StorageError(f"Failed to upload file: {str(e)}")


async def download_file(relative_path: str) -> Optional[bytes]:
    """
    Download file from storage via File API
    
    Args:
        relative_path: Relative path (e.g., "invoices/20260327_abc123.pdf")
        
    Returns:
        File content as bytes, or None if not found
        
    Raises:
        StorageError: If download fails (not for missing files)
    """
    if not relative_path:
        return None
    
    # Sanitize path
    relative_path = relative_path.lstrip("/")
    
    # Parse folder and filename
    parts = relative_path.split("/", 1)
    if len(parts) != 2:
        logger.warning(f"Invalid path format: {relative_path}")
        return None
    
    folder, filename = parts
    mapped_folder = map_folder(folder)
    
    logger.info(f"Downloading file: {mapped_folder}/{filename}")
    
    try:
        headers = get_api_headers()
        url = f"{FILE_API_URL}/download/{mapped_folder}/{filename}"
        
        response = requests.get(url, headers=headers, timeout=60)
        
        if response.status_code == 404:
            logger.warning(f"File not found: {mapped_folder}/{filename}")
            return None
        
        if response.status_code != 200:
            logger.error(f"Download failed: HTTP {response.status_code}")
            raise StorageError(f"Failed to download file: HTTP {response.status_code}")
        
        file_data = response.content
        logger.info(f"Successfully downloaded: {mapped_folder}/{filename} ({len(file_data)} bytes)")
        return file_data
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Download request failed: {str(e)}")
        raise StorageError(f"Failed to download file: {str(e)}")


async def file_exists(relative_path: str) -> bool:
    """Check if file exists in storage"""
    if not relative_path:
        return False
    
    relative_path = relative_path.lstrip("/")
    parts = relative_path.split("/", 1)
    if len(parts) != 2:
        return False
    
    folder, filename = parts
    mapped_folder = map_folder(folder)
    
    try:
        headers = get_api_headers()
        url = f"{FILE_API_URL}/download/{mapped_folder}/{filename}"
        
        # Use HEAD request to check existence
        response = requests.head(url, headers=headers, timeout=30)
        return response.status_code == 200
    except Exception as e:
        logger.error(f"File exists check failed: {str(e)}")
        return False


async def delete_file(relative_path: str) -> bool:
    """
    Delete file from storage via File API
    
    Returns:
        True if deleted, False if not found
    """
    if not relative_path:
        return False
    
    relative_path = relative_path.lstrip("/")
    parts = relative_path.split("/", 1)
    if len(parts) != 2:
        return False
    
    folder, filename = parts
    mapped_folder = map_folder(folder)
    
    logger.info(f"Deleting file: {mapped_folder}/{filename}")
    
    try:
        headers = get_api_headers()
        url = f"{FILE_API_URL}/file/{mapped_folder}/{filename}"
        
        response = requests.delete(url, headers=headers, timeout=30)
        
        if response.status_code in [200, 204]:
            logger.info(f"Deleted: {mapped_folder}/{filename}")
            return True
        elif response.status_code == 404:
            return False
        else:
            raise StorageError(f"Delete failed: HTTP {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Delete request failed: {str(e)}")
        raise StorageError(f"Failed to delete file: {str(e)}")


async def list_files(folder: str) -> List[str]:
    """
    List files in a folder
    
    Args:
        folder: Folder name
        
    Returns:
        List of filenames
    """
    mapped_folder = map_folder(folder)
    
    try:
        headers = get_api_headers()
        url = f"{FILE_API_URL}/files/{mapped_folder}"
        
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            logger.error(f"List files failed: HTTP {response.status_code}")
            return []
        
        data = response.json()
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and "files" in data:
            return data["files"]
        return []
        
    except Exception as e:
        logger.error(f"List files failed: {str(e)}")
        return []


def get_file_url(relative_path: str) -> str:
    """Get the API URL for a file (for internal use)"""
    relative_path = relative_path.lstrip("/")
    parts = relative_path.split("/", 1)
    if len(parts) != 2:
        return f"/api/files/{relative_path}"
    
    folder, filename = parts
    mapped_folder = map_folder(folder)
    return f"/api/files/{mapped_folder}/{filename}"


def get_storage_info() -> dict:
    """Get current storage configuration info (for debugging)"""
    return {
        "storage_type": "file_api",
        "file_api_url": FILE_API_URL,
        "api_key_configured": bool(FILE_API_KEY),
        "valid_folders": VALID_FOLDERS,
        "folder_mappings": FOLDER_MAPPING
    }


def ensure_folder_exists(folder: str):
    """Ensure folder exists (no-op for API, folders are auto-created)"""
    pass

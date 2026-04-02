"""
MuscleGrid CRM - Centralized Storage Utility
Handles all file storage operations via Synology File API

Configuration:
    FILE_API_URL=https://files.musclegrid.in
    FILE_API_KEY=<api-key>
    
Endpoints (Dynamic folder paths supported):
    GET  /health - Health check
    POST /mkdir/<folder-path> - Create folder (supports nested paths)
    POST /upload/<folder-path> - Upload file (multipart/form-data, field: "file")
    GET  /files/<folder-path> - List contents of folder
    GET  /download/<full-relative-file-path> - Download file
    DELETE /file/<full-relative-file-path> - Delete file

Examples:
    POST /mkdir/tickets/2026/april
    POST /upload/tickets/Returns
    GET /files/tickets/Returns
    GET /download/tickets/Returns/filename.pdf
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

# Base folders (root level)
BASE_FOLDERS = [
    "tickets",
    "invoices", 
    "payments",
    "certificates"
]

# Folder mapping for backwards compatibility with existing code
# Maps legacy folder names to actual folder paths (can include subfolders)
FOLDER_MAPPING = {
    # Tickets and related
    "pickup_labels": "tickets",
    "dispatch_labels": "tickets",
    "labels": "tickets",
    "feedback_screenshots": "tickets",
    "reviews": "tickets",
    "dealer_tickets": "tickets",
    "dealer_documents": "tickets",
    "general": "tickets",
    "jobcards": "tickets",
    "returns": "tickets/Returns",  # Subfolder for returns
    
    # Invoices and related
    "service_invoices": "invoices",
    "warranty_invoices": "invoices",
    "purchase_invoices": "invoices",
    "sale_invoices": "invoices",
    "quotations": "invoices",
    
    # Payments and related
    "payment_proofs": "payments",
    "deposits": "payments",
    "dealer_deposits": "payments",
    "dealer_payments": "payments",
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


def normalize_folder_path(folder: str) -> str:
    """
    Normalize folder path - supports both legacy names and full paths.
    
    Args:
        folder: Folder name or path (e.g., "tickets", "tickets/Returns", "returns")
        
    Returns:
        Normalized folder path
    """
    # Remove leading/trailing slashes
    folder = folder.strip("/")
    
    # Check if it's a legacy mapping
    if folder.lower() in FOLDER_MAPPING:
        return FOLDER_MAPPING[folder.lower()]
    
    # Check if first part is a valid base folder
    parts = folder.split("/")
    if parts[0] in BASE_FOLDERS:
        return folder
    
    # Check legacy mapping for first part
    if parts[0].lower() in FOLDER_MAPPING:
        parts[0] = FOLDER_MAPPING[parts[0].lower()]
        return "/".join(parts)
    
    # Default fallback to tickets
    logger.warning(f"Unknown folder '{folder}', defaulting to 'tickets'")
    return "tickets"


def validate_folder(folder: str) -> bool:
    """Validate folder name or path"""
    normalized = normalize_folder_path(folder)
    parts = normalized.split("/")
    return parts[0] in BASE_FOLDERS


# Legacy function for backwards compatibility
def map_folder(folder: str) -> str:
    """Map legacy folder names to folder paths (backwards compatible)"""
    return normalize_folder_path(folder)


async def create_folder(folder_path: str) -> bool:
    """
    Create a folder (and any parent folders) via File API
    
    Args:
        folder_path: Full folder path (e.g., "tickets/Returns" or "tickets/2026/april")
        
    Returns:
        True if created successfully
        
    Raises:
        StorageError: If creation fails
    """
    normalized_path = normalize_folder_path(folder_path)
    
    logger.info(f"Creating folder: {normalized_path}")
    
    try:
        headers = get_api_headers()
        url = f"{FILE_API_URL}/mkdir/{normalized_path}"
        
        response = requests.post(url, headers=headers, timeout=30)
        
        if response.status_code in [200, 201]:
            logger.info(f"Successfully created folder: {normalized_path}")
            return True
        elif response.status_code == 409:  # Already exists
            logger.info(f"Folder already exists: {normalized_path}")
            return True
        else:
            error_msg = f"Create folder failed: HTTP {response.status_code} - {response.text[:200]}"
            logger.error(error_msg)
            raise StorageError(error_msg)
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Create folder request failed: {str(e)}")
        raise StorageError(f"Failed to create folder: {str(e)}")


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
        folder: Target folder name or path (e.g., "tickets", "tickets/Returns")
        original_filename: Original filename for extension
        filename_prefix: Optional prefix for the filename
        
    Returns:
        Tuple of (relative_path, storage_type)
        
    Raises:
        StorageError: If upload fails
    """
    # Normalize folder path (supports subfolders)
    folder_path = normalize_folder_path(folder)
    
    # Generate unique filename
    ext = Path(original_filename).suffix.lower() if original_filename else ".bin"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    
    if filename_prefix:
        filename = f"{filename_prefix}_{timestamp}_{unique_id}{ext}"
    else:
        filename = f"{timestamp}_{unique_id}{ext}"
    
    logger.info(f"Uploading file: {folder_path}/{filename} ({len(file_data)} bytes)")
    
    try:
        headers = get_api_headers()
        url = f"{FILE_API_URL}/upload/{folder_path}"
        
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
                    actual_folder = result.get("folder", folder_path)
                    logger.info(f"Successfully uploaded: {actual_folder}/{actual_filename}")
                    return f"{actual_folder}/{actual_filename}", "file_api"
            except:
                pass
            # Fallback to generated filename
            logger.info(f"Successfully uploaded: {folder_path}/{filename}")
            return f"{folder_path}/{filename}", "file_api"
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
        relative_path: Full relative path (e.g., "tickets/Returns/20260327_abc123.pdf")
        
    Returns:
        File content as bytes, or None if not found
        
    Raises:
        StorageError: If download fails (not for missing files)
    """
    if not relative_path:
        return None
    
    # Sanitize path
    relative_path = relative_path.strip("/")
    
    logger.info(f"Downloading file: {relative_path}")
    
    try:
        headers = get_api_headers()
        url = f"{FILE_API_URL}/download/{relative_path}"
        
        response = requests.get(url, headers=headers, timeout=60)
        
        if response.status_code == 404:
            logger.warning(f"File not found: {relative_path}")
            return None
        
        if response.status_code != 200:
            logger.error(f"Download failed: HTTP {response.status_code}")
            raise StorageError(f"Failed to download file: HTTP {response.status_code}")
        
        file_data = response.content
        logger.info(f"Successfully downloaded: {relative_path} ({len(file_data)} bytes)")
        return file_data
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Download request failed: {str(e)}")
        raise StorageError(f"Failed to download file: {str(e)}")


async def file_exists(relative_path: str) -> bool:
    """Check if file exists in storage"""
    if not relative_path:
        return False
    
    relative_path = relative_path.strip("/")
    
    try:
        headers = get_api_headers()
        url = f"{FILE_API_URL}/download/{relative_path}"
        
        # Use HEAD request to check existence
        response = requests.head(url, headers=headers, timeout=30)
        return response.status_code == 200
    except Exception as e:
        logger.error(f"File exists check failed: {str(e)}")
        return False


async def delete_file(relative_path: str) -> bool:
    """
    Delete file from storage via File API
    
    Args:
        relative_path: Full relative path (e.g., "tickets/Returns/filename.pdf")
    
    Returns:
        True if deleted, False if not found
    """
    if not relative_path:
        return False
    
    relative_path = relative_path.strip("/")
    
    logger.info(f"Deleting file: {relative_path}")
    
    try:
        headers = get_api_headers()
        url = f"{FILE_API_URL}/file/{relative_path}"
        
        response = requests.delete(url, headers=headers, timeout=30)
        
        if response.status_code in [200, 204]:
            logger.info(f"Deleted: {relative_path}")
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
    List files in a folder (supports subfolders)
    
    Args:
        folder: Folder name or path (e.g., "tickets", "tickets/Returns")
        
    Returns:
        List of filenames/items in the folder
    """
    folder_path = normalize_folder_path(folder)
    
    try:
        headers = get_api_headers()
        url = f"{FILE_API_URL}/files/{folder_path}"
        
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            logger.error(f"List files failed: HTTP {response.status_code}")
            return []
        
        data = response.json()
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and "files" in data:
            return data["files"]
        elif isinstance(data, dict) and "contents" in data:
            return data["contents"]
        return []
        
    except Exception as e:
        logger.error(f"List files failed: {str(e)}")
        return []


def get_file_url(relative_path: str) -> str:
    """Get the API URL for a file (for internal use)"""
    relative_path = relative_path.strip("/")
    return f"/api/files/{relative_path}"


def get_storage_info() -> dict:
    """Get current storage configuration info (for debugging)"""
    return {
        "storage_type": "file_api",
        "file_api_url": FILE_API_URL,
        "api_key_configured": bool(FILE_API_KEY),
        "base_folders": BASE_FOLDERS,
        "folder_mappings": FOLDER_MAPPING,
        "supports_subfolders": True
    }


async def ensure_folder_exists(folder: str) -> bool:
    """
    Ensure folder exists, creating it if necessary
    
    Args:
        folder: Folder path to ensure exists
        
    Returns:
        True if folder exists or was created
    """
    try:
        return await create_folder(folder)
    except StorageError:
        return False


async def health_check() -> bool:
    """Check if the File API is healthy"""
    try:
        headers = get_api_headers()
        response = requests.get(f"{FILE_API_URL}/health", headers=headers, timeout=10)
        return response.status_code == 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return False

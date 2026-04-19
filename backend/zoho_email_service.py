"""
Zoho Mail Integration Service for MuscleGrid CRM
Handles all email communications across the platform
"""

import os
import json
import logging
import requests
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)

# Zoho Configuration
ZOHO_TOKENS_FILE = Path(__file__).parent / "zoho_tokens.json"
ZOHO_ACCOUNTS_URL = "https://accounts.zoho.in"
ZOHO_MAIL_API_URL = "https://mail.zoho.in"

class ZohoMailService:
    """Service class for Zoho Mail API operations"""
    
    def __init__(self):
        self.tokens = self._load_tokens()
        self.account_id = None
        self.from_address = None
        self._initialized = False
    
    def _load_tokens(self) -> Dict:
        """Load tokens from file"""
        try:
            if ZOHO_TOKENS_FILE.exists():
                with open(ZOHO_TOKENS_FILE, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load Zoho tokens: {e}")
        return {}
    
    def _save_tokens(self, tokens: Dict):
        """Save tokens to file"""
        try:
            self.tokens.update(tokens)
            with open(ZOHO_TOKENS_FILE, 'w') as f:
                json.dump(self.tokens, f)
        except Exception as e:
            logger.error(f"Failed to save Zoho tokens: {e}")
    
    def _refresh_access_token(self) -> bool:
        """Refresh access token using refresh token"""
        if not self.tokens.get('refresh_token'):
            logger.error("No refresh token available")
            return False
        
        try:
            response = requests.post(
                f"{ZOHO_ACCOUNTS_URL}/oauth/v2/token",
                data={
                    'grant_type': 'refresh_token',
                    'client_id': self.tokens.get('client_id'),
                    'client_secret': self.tokens.get('client_secret'),
                    'refresh_token': self.tokens.get('refresh_token')
                }
            )
            
            if response.status_code == 200:
                new_tokens = response.json()
                self._save_tokens({
                    'access_token': new_tokens.get('access_token'),
                    'token_updated_at': datetime.now(timezone.utc).isoformat()
                })
                logger.info("Zoho access token refreshed successfully")
                return True
            else:
                logger.error(f"Failed to refresh token: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error refreshing token: {e}")
            return False
    
    def _get_headers(self) -> Dict[str, str]:
        """Get authorization headers"""
        return {
            'Authorization': f'Zoho-oauthtoken {self.tokens.get("access_token")}',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    
    def initialize(self) -> bool:
        """Initialize the service by getting account info"""
        if self._initialized:
            return True
        
        if not self.tokens.get('access_token'):
            logger.warning("Zoho Mail not configured - no access token")
            return False
        
        try:
            response = requests.get(
                f"{ZOHO_MAIL_API_URL}/api/accounts",
                headers=self._get_headers()
            )
            
            if response.status_code == 401:
                # Token expired, try to refresh
                if self._refresh_access_token():
                    response = requests.get(
                        f"{ZOHO_MAIL_API_URL}/api/accounts",
                        headers=self._get_headers()
                    )
            
            if response.status_code == 200:
                accounts = response.json().get('data', [])
                if accounts:
                    self.account_id = accounts[0].get('accountId')
                    self.from_address = accounts[0].get('primaryEmailAddress')
                    self._initialized = True
                    logger.info(f"Zoho Mail initialized: {self.from_address}")
                    return True
            
            logger.error(f"Failed to initialize Zoho Mail: {response.text}")
            return False
        except Exception as e:
            logger.error(f"Error initializing Zoho Mail: {e}")
            return False
    
    def send_email(
        self,
        to_address: str,
        subject: str,
        content: str,
        cc_address: Optional[str] = None,
        bcc_address: Optional[str] = None,
        mail_format: str = "html",
        attachments: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Send an email via Zoho Mail API
        
        Args:
            to_address: Recipient email address
            subject: Email subject
            content: Email body (HTML or plain text)
            cc_address: CC recipients (comma-separated)
            bcc_address: BCC recipients (comma-separated)
            mail_format: "html" or "plaintext"
            attachments: List of attachment dicts with 'name' and 'content' keys
        
        Returns:
            Dict with 'success' boolean and 'message_id' or 'error'
        """
        if not self.initialize():
            return {'success': False, 'error': 'Zoho Mail not initialized'}
        
        if not to_address:
            return {'success': False, 'error': 'No recipient address provided'}
        
        try:
            payload = {
                "fromAddress": self.from_address,
                "toAddress": to_address,
                "subject": subject,
                "content": content,
                "mailFormat": mail_format
            }
            
            if cc_address:
                payload["ccAddress"] = cc_address
            if bcc_address:
                payload["bccAddress"] = bcc_address
            
            response = requests.post(
                f"{ZOHO_MAIL_API_URL}/api/accounts/{self.account_id}/messages",
                json=payload,
                headers=self._get_headers()
            )
            
            if response.status_code == 401:
                # Token expired, refresh and retry
                if self._refresh_access_token():
                    response = requests.post(
                        f"{ZOHO_MAIL_API_URL}/api/accounts/{self.account_id}/messages",
                        json=payload,
                        headers=self._get_headers()
                    )
            
            if response.status_code == 200:
                result = response.json()
                message_id = result.get('data', {}).get('messageId')
                logger.info(f"Email sent to {to_address}: {subject}")
                return {'success': True, 'message_id': message_id}
            else:
                error = response.json().get('data', {}).get('errorCode', response.text)
                logger.error(f"Failed to send email: {error}")
                return {'success': False, 'error': str(error)}
                
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return {'success': False, 'error': str(e)}
    
    def is_configured(self) -> bool:
        """Check if Zoho Mail is properly configured"""
        return bool(self.tokens.get('access_token') and self.tokens.get('refresh_token'))
    
    def get_inbox_folder_id(self) -> Optional[str]:
        """Get the Inbox folder ID"""
        if not self.initialize():
            return None
        
        try:
            response = requests.get(
                f"{ZOHO_MAIL_API_URL}/api/accounts/{self.account_id}/folders",
                headers=self._get_headers()
            )
            
            if response.status_code == 401:
                if self._refresh_access_token():
                    response = requests.get(
                        f"{ZOHO_MAIL_API_URL}/api/accounts/{self.account_id}/folders",
                        headers=self._get_headers()
                    )
            
            if response.status_code == 200:
                folders = response.json().get('data', [])
                for folder in folders:
                    if folder.get('folderName') == 'Inbox':
                        return folder.get('folderId')
            
            return None
        except Exception as e:
            logger.error(f"Error getting folders: {e}")
            return None
    
    def get_unread_emails(self, limit: int = 20) -> List[Dict]:
        """Get unread emails from inbox"""
        if not self.initialize():
            return []
        
        folder_id = self.get_inbox_folder_id()
        if not folder_id:
            return []
        
        try:
            response = requests.get(
                f"{ZOHO_MAIL_API_URL}/api/accounts/{self.account_id}/messages/view",
                params={
                    'folderId': folder_id,
                    'limit': limit,
                    'status': 'unread'
                },
                headers=self._get_headers()
            )
            
            if response.status_code == 401:
                if self._refresh_access_token():
                    response = requests.get(
                        f"{ZOHO_MAIL_API_URL}/api/accounts/{self.account_id}/messages/view",
                        params={
                            'folderId': folder_id,
                            'limit': limit,
                            'status': 'unread'
                        },
                        headers=self._get_headers()
                    )
            
            if response.status_code == 200:
                return response.json().get('data', [])
            
            return []
        except Exception as e:
            logger.error(f"Error getting unread emails: {e}")
            return []
    
    def get_recent_emails(self, limit: int = 20, include_read: bool = True) -> List[Dict]:
        """Get recent emails from inbox"""
        if not self.initialize():
            return []
        
        folder_id = self.get_inbox_folder_id()
        if not folder_id:
            return []
        
        try:
            params = {'folderId': folder_id, 'limit': limit}
            if not include_read:
                params['status'] = 'unread'
            
            response = requests.get(
                f"{ZOHO_MAIL_API_URL}/api/accounts/{self.account_id}/messages/view",
                params=params,
                headers=self._get_headers()
            )
            
            if response.status_code == 401:
                if self._refresh_access_token():
                    response = requests.get(
                        f"{ZOHO_MAIL_API_URL}/api/accounts/{self.account_id}/messages/view",
                        params=params,
                        headers=self._get_headers()
                    )
            
            if response.status_code == 200:
                return response.json().get('data', [])
            
            return []
        except Exception as e:
            logger.error(f"Error getting emails: {e}")
            return []
    
    def get_email_content(self, message_id: str) -> Optional[Dict]:
        """Get full email content including body"""
        if not self.initialize():
            return None
        
        try:
            response = requests.get(
                f"{ZOHO_MAIL_API_URL}/api/accounts/{self.account_id}/messages/{message_id}/content",
                headers=self._get_headers()
            )
            
            if response.status_code == 401:
                if self._refresh_access_token():
                    response = requests.get(
                        f"{ZOHO_MAIL_API_URL}/api/accounts/{self.account_id}/messages/{message_id}/content",
                        headers=self._get_headers()
                    )
            
            if response.status_code == 200:
                return response.json().get('data', {})
            
            return None
        except Exception as e:
            logger.error(f"Error getting email content: {e}")
            return None
    
    def mark_as_read(self, message_id: str) -> bool:
        """Mark an email as read"""
        if not self.initialize():
            return False
        
        try:
            response = requests.put(
                f"{ZOHO_MAIL_API_URL}/api/accounts/{self.account_id}/updatemessage",
                json={
                    "messageId": [message_id],
                    "mode": "markAsRead"
                },
                headers=self._get_headers()
            )
            
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Error marking email as read: {e}")
            return False
    
    def move_to_folder(self, message_id: str, folder_name: str) -> bool:
        """Move email to a specific folder (e.g., 'Processed')"""
        if not self.initialize():
            return False
        
        try:
            # Get folder ID
            response = requests.get(
                f"{ZOHO_MAIL_API_URL}/api/accounts/{self.account_id}/folders",
                headers=self._get_headers()
            )
            
            if response.status_code == 200:
                folders = response.json().get('data', [])
                target_folder_id = None
                for folder in folders:
                    if folder.get('folderName') == folder_name:
                        target_folder_id = folder.get('folderId')
                        break
                
                if target_folder_id:
                    move_response = requests.put(
                        f"{ZOHO_MAIL_API_URL}/api/accounts/{self.account_id}/updatemessage",
                        json={
                            "messageId": [message_id],
                            "mode": "move",
                            "destfolderId": target_folder_id
                        },
                        headers=self._get_headers()
                    )
                    return move_response.status_code == 200
            
            return False
        except Exception as e:
            logger.error(f"Error moving email: {e}")
            return False


# Global instance
zoho_mail = ZohoMailService()


# ==================== EMAIL TEMPLATES ====================

def get_base_template(content: str, title: str = "MuscleGrid") -> str:
    """Wrap content in base email template"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 24px; text-align: center;">
                                <h1 style="margin: 0; color: #00d4ff; font-size: 28px; font-weight: bold;">MuscleGrid</h1>
                                <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px;">Power Solutions</p>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 32px 24px;">
                                {content}
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f8fafc; padding: 20px 24px; border-top: 1px solid #e2e8f0;">
                                <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; text-align: center;">
                                    MuscleGrid Industries Private Limited
                                </p>
                                <p style="margin: 0; color: #94a3b8; font-size: 11px; text-align: center;">
                                    24 B2, First Floor, Khasra 322, New Delhi - 110068<br>
                                    Phone: +91-9999036254 | Email: service@musclegrid.in
                                </p>
                                <p style="margin: 12px 0 0 0; color: #cbd5e1; font-size: 10px; text-align: center;">
                                    This is an automated message from MuscleGrid CRM. Please do not reply directly to this email.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


# ==================== TICKET EMAIL TEMPLATES ====================

def ticket_created_email(ticket: Dict) -> tuple:
    """Email template for ticket creation"""
    subject = f"Service Ticket Created - {ticket.get('ticket_number')}"
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">Service Ticket Confirmation</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{ticket.get('customer_name', 'Customer')}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Thank you for contacting MuscleGrid Service Center. Your service request has been registered successfully.
    </p>
    
    <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <h3 style="margin: 0 0 12px 0; color: #0369a1;">Ticket Details</h3>
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Ticket Number:</strong></td><td style="padding: 4px 0;">{ticket.get('ticket_number')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Product:</strong></td><td style="padding: 4px 0;">{ticket.get('product_name', ticket.get('device_type', 'N/A'))}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Issue:</strong></td><td style="padding: 4px 0;">{ticket.get('problem_description', 'N/A')[:100]}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Support Type:</strong></td><td style="padding: 4px 0;">{ticket.get('support_type', 'In-Warranty').replace('_', ' ').title()}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Created On:</strong></td><td style="padding: 4px 0;">{datetime.now().strftime('%d %b %Y, %I:%M %p')}</td></tr>
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        Our service team will review your request and contact you shortly. You can track your ticket status using the ticket number above.
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        For urgent queries, please call us at <strong>+91-9999036254</strong>.
    </p>
    """
    
    return subject, get_base_template(content, subject)


def ticket_status_update_email(ticket: Dict, old_status: str, new_status: str) -> tuple:
    """Email template for ticket status update"""
    subject = f"Ticket Update - {ticket.get('ticket_number')} - {new_status.replace('_', ' ').title()}"
    
    status_messages = {
        'received': 'Your product has been received at our service center.',
        'under_repair': 'Our technicians are currently working on your product.',
        'repair_completed': 'Great news! Your product has been repaired successfully.',
        'ready_for_dispatch': 'Your product is ready and will be dispatched soon.',
        'dispatched': 'Your repaired product has been shipped.',
        'quality_check': 'Your product is undergoing quality verification.',
        'pending_parts': 'We are waiting for spare parts to complete the repair.',
        'closed': 'Your service ticket has been closed.'
    }
    
    status_msg = status_messages.get(new_status, f'Your ticket status has been updated to: {new_status}')
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">Ticket Status Update</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{ticket.get('customer_name', 'Customer')}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        {status_msg}
    </p>
    
    <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Ticket Number:</strong></td><td style="padding: 4px 0;">{ticket.get('ticket_number')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Previous Status:</strong></td><td style="padding: 4px 0;">{old_status.replace('_', ' ').title()}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Current Status:</strong></td><td style="padding: 4px 0; color: #16a34a; font-weight: bold;">{new_status.replace('_', ' ').title()}</td></tr>
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        We'll keep you updated on any further progress.
    </p>
    """
    
    return subject, get_base_template(content, subject)


def ticket_closed_email(ticket: Dict) -> tuple:
    """Email template for ticket closure with feedback request"""
    subject = f"Service Completed - {ticket.get('ticket_number')}"
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">Service Completed</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{ticket.get('customer_name', 'Customer')}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Your service request <strong>{ticket.get('ticket_number')}</strong> has been completed and closed.
    </p>
    
    <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <h3 style="margin: 0 0 12px 0; color: #854d0e;">Service Summary</h3>
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Product:</strong></td><td style="padding: 4px 0;">{ticket.get('product_name', ticket.get('device_type', 'N/A'))}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Work Done:</strong></td><td style="padding: 4px 0;">{ticket.get('repair_notes', ticket.get('resolution_notes', 'Service completed'))}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Technician:</strong></td><td style="padding: 4px 0;">{ticket.get('technician_name', 'Service Team')}</td></tr>
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        <strong>We value your feedback!</strong> Please take a moment to rate our service. Your feedback helps us improve.
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Thank you for choosing MuscleGrid. We appreciate your business!
    </p>
    """
    
    return subject, get_base_template(content, subject)


# ==================== DISPATCH EMAIL TEMPLATES ====================

def dispatch_created_email(dispatch: Dict) -> tuple:
    """Email template for dispatch/shipment notification"""
    subject = f"Your Order Has Been Shipped - {dispatch.get('dispatch_number')}"
    
    tracking_info = ""
    if dispatch.get('tracking_id'):
        tracking_info = f"""
        <div style="background-color: #eff6ff; border: 2px dashed #3b82f6; padding: 16px; margin: 20px 0; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 12px; text-transform: uppercase;">Tracking Number</p>
            <p style="margin: 0; color: #1e3a8a; font-size: 24px; font-weight: bold; letter-spacing: 2px;">{dispatch.get('tracking_id')}</p>
            <p style="margin: 8px 0 0 0; color: #3b82f6; font-size: 13px;">Courier: {dispatch.get('courier', dispatch.get('courier_name', 'N/A'))}</p>
        </div>
        """
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">📦 Your Order Has Been Shipped!</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{dispatch.get('customer_name', 'Customer')}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Great news! Your order has been dispatched and is on its way to you.
    </p>
    
    {tracking_info}
    
    <div style="background-color: #f8fafc; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; color: #334155;">Shipment Details</h3>
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Dispatch Number:</strong></td><td style="padding: 4px 0;">{dispatch.get('dispatch_number')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Product:</strong></td><td style="padding: 4px 0;">{dispatch.get('product_name', dispatch.get('sku_name', 'N/A'))}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Dispatch Date:</strong></td><td style="padding: 4px 0;">{datetime.now().strftime('%d %b %Y')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Shipping To:</strong></td><td style="padding: 4px 0;">{dispatch.get('shipping_address', dispatch.get('address', 'N/A'))}</td></tr>
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        You can track your shipment using the tracking number above on the courier's website.
    </p>
    """
    
    return subject, get_base_template(content, subject)


def return_dispatch_email(dispatch: Dict, ticket: Dict) -> tuple:
    """Email template for repaired item return dispatch"""
    subject = f"Your Repaired Product Shipped - {ticket.get('ticket_number')}"
    
    tracking_info = ""
    if dispatch.get('tracking_id'):
        tracking_info = f"""
        <div style="background-color: #f0fdf4; border: 2px dashed #22c55e; padding: 16px; margin: 20px 0; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 8px 0; color: #166534; font-size: 12px; text-transform: uppercase;">Tracking Number</p>
            <p style="margin: 0; color: #14532d; font-size: 24px; font-weight: bold; letter-spacing: 2px;">{dispatch.get('tracking_id')}</p>
            <p style="margin: 8px 0 0 0; color: #22c55e; font-size: 13px;">Courier: {dispatch.get('courier', 'N/A')}</p>
        </div>
        """
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">✅ Your Repaired Product is on the Way!</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{ticket.get('customer_name', 'Customer')}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Your product has been repaired and shipped back to you.
    </p>
    
    {tracking_info}
    
    <div style="background-color: #f8fafc; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; color: #334155;">Repair Summary</h3>
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Ticket Number:</strong></td><td style="padding: 4px 0;">{ticket.get('ticket_number')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Product:</strong></td><td style="padding: 4px 0;">{ticket.get('product_name', ticket.get('device_type', 'N/A'))}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Work Done:</strong></td><td style="padding: 4px 0;">{ticket.get('repair_notes', 'Service completed')}</td></tr>
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        Thank you for your patience. We hope to serve you again!
    </p>
    """
    
    return subject, get_base_template(content, subject)


# ==================== QUOTATION EMAIL TEMPLATES ====================

def quotation_email(quotation: Dict, public_url: str = None) -> tuple:
    """Email template for sending quotation/proforma invoice"""
    subject = f"Quotation {quotation.get('quotation_number')} from MuscleGrid"
    
    items_html = ""
    for item in quotation.get('items', []):
        items_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{item.get('name', item.get('product_name', 'N/A'))}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">{item.get('quantity', 1)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹{item.get('rate', item.get('unit_price', 0)):,.2f}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹{item.get('amount', item.get('total', 0)):,.2f}</td>
        </tr>
        """
    
    view_button = ""
    if public_url:
        view_button = f"""
        <div style="text-align: center; margin: 24px 0;">
            <a href="{public_url}" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                View Full Quotation →
            </a>
        </div>
        """
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">Quotation from MuscleGrid</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{quotation.get('customer_name', quotation.get('party_name', 'Customer'))}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Thank you for your interest in MuscleGrid products. Please find below the quotation as per your requirement.
    </p>
    
    <div style="background-color: #f8fafc; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Quotation No:</strong></td><td style="padding: 4px 0;">{quotation.get('quotation_number')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Date:</strong></td><td style="padding: 4px 0;">{quotation.get('date', datetime.now().strftime('%d %b %Y'))}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Valid Until:</strong></td><td style="padding: 4px 0;">{quotation.get('valid_until', 'N/A')}</td></tr>
        </table>
    </div>
    
    <h3 style="color: #334155; margin: 20px 0 12px 0;">Items</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
            <tr style="background-color: #f1f5f9;">
                <th style="padding: 10px 8px; text-align: left; border-bottom: 2px solid #cbd5e1;">Product</th>
                <th style="padding: 10px 8px; text-align: center; border-bottom: 2px solid #cbd5e1;">Qty</th>
                <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid #cbd5e1;">Rate</th>
                <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid #cbd5e1;">Amount</th>
            </tr>
        </thead>
        <tbody>
            {items_html}
        </tbody>
    </table>
    
    <div style="background-color: #0f172a; color: white; padding: 16px; margin: 20px 0; border-radius: 8px; text-align: right;">
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #94a3b8;">Total Amount</p>
        <p style="margin: 0; font-size: 28px; font-weight: bold; color: #22d3ee;">₹{quotation.get('total_amount', quotation.get('grand_total', 0)):,.2f}</p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">(Inclusive of GST)</p>
    </div>
    
    {view_button}
    
    <p style="color: #475569; line-height: 1.6;">
        For any queries or to place an order, please contact us at <strong>+91-9999036254</strong> or reply to this email.
    </p>
    
    <p style="color: #64748b; font-size: 13px; line-height: 1.6;">
        <strong>Terms & Conditions:</strong><br>
        • Prices are valid for 7 days from the date of quotation<br>
        • Delivery: 3-5 business days after payment confirmation<br>
        • Payment: 100% advance or as per agreed terms
    </p>
    """
    
    return subject, get_base_template(content, subject)


# ==================== WARRANTY EMAIL TEMPLATES ====================

def warranty_registration_email(warranty: Dict) -> tuple:
    """Email template for warranty registration confirmation"""
    subject = f"Warranty Registered - {warranty.get('warranty_number', warranty.get('serial_number'))}"
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">🛡️ Warranty Registration Confirmed</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{warranty.get('customer_name', 'Customer')}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Congratulations! Your product warranty has been successfully registered with MuscleGrid.
    </p>
    
    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">Warranty Valid Until</p>
        <p style="margin: 0; font-size: 32px; font-weight: bold;">{warranty.get('warranty_end', warranty.get('warranty_expires', 'N/A'))}</p>
    </div>
    
    <div style="background-color: #f8fafc; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; color: #334155;">Product Details</h3>
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Product:</strong></td><td style="padding: 4px 0;">{warranty.get('product_name', 'N/A')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Serial Number:</strong></td><td style="padding: 4px 0;">{warranty.get('serial_number', 'N/A')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Purchase Date:</strong></td><td style="padding: 4px 0;">{warranty.get('purchase_date', warranty.get('warranty_start', 'N/A'))}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Warranty Period:</strong></td><td style="padding: 4px 0;">{warranty.get('warranty_months', 12)} months</td></tr>
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        <strong>What's Covered:</strong><br>
        Your warranty covers manufacturing defects and component failures under normal use conditions.
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        For warranty claims, please contact our service center with your serial number and proof of purchase.
    </p>
    """
    
    return subject, get_base_template(content, subject)


def warranty_expiry_reminder_email(warranty: Dict, days_remaining: int) -> tuple:
    """Email template for warranty expiry reminder"""
    subject = f"Warranty Expiring Soon - {warranty.get('product_name', 'Your Product')}"
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">⚠️ Warranty Expiry Reminder</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{warranty.get('customer_name', 'Customer')}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        This is a friendly reminder that your product warranty is expiring soon.
    </p>
    
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">Warranty Expires In</p>
        <p style="margin: 0; font-size: 48px; font-weight: bold;">{days_remaining}</p>
        <p style="margin: 0; font-size: 16px;">DAYS</p>
    </div>
    
    <div style="background-color: #f8fafc; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Product:</strong></td><td style="padding: 4px 0;">{warranty.get('product_name', 'N/A')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Serial Number:</strong></td><td style="padding: 4px 0;">{warranty.get('serial_number', 'N/A')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Expiry Date:</strong></td><td style="padding: 4px 0;">{warranty.get('warranty_end', 'N/A')}</td></tr>
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        <strong>Extend Your Protection!</strong><br>
        Contact us to learn about our extended warranty plans and keep your product protected.
    </p>
    
    <div style="text-align: center; margin: 24px 0;">
        <a href="tel:+919999036254" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold;">
            Call Now: +91-9999036254
        </a>
    </div>
    """
    
    return subject, get_base_template(content, subject)


# ==================== INVOICE EMAIL TEMPLATES ====================

def invoice_email(invoice: Dict) -> tuple:
    """Email template for sending invoice"""
    subject = f"Invoice {invoice.get('invoice_number')} from MuscleGrid"
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">Invoice from MuscleGrid</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{invoice.get('customer_name', invoice.get('party_name', 'Customer'))}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Please find attached your invoice for recent purchase/service.
    </p>
    
    <div style="background-color: #f8fafc; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Invoice Number:</strong></td><td style="padding: 4px 0;">{invoice.get('invoice_number')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Date:</strong></td><td style="padding: 4px 0;">{invoice.get('date', invoice.get('invoice_date', 'N/A'))}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Amount:</strong></td><td style="padding: 4px 0; color: #059669; font-weight: bold;">₹{invoice.get('total_amount', invoice.get('grand_total', 0)):,.2f}</td></tr>
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        Thank you for your business!
    </p>
    """
    
    return subject, get_base_template(content, subject)


def payment_receipt_email(payment: Dict) -> tuple:
    """Email template for payment receipt"""
    subject = f"Payment Received - Thank You!"
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">💳 Payment Received</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{payment.get('customer_name', payment.get('party_name', 'Customer'))}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Thank you! We have received your payment.
    </p>
    
    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">Amount Received</p>
        <p style="margin: 0; font-size: 36px; font-weight: bold;">₹{payment.get('amount', 0):,.2f}</p>
    </div>
    
    <div style="background-color: #f8fafc; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Payment Date:</strong></td><td style="padding: 4px 0;">{payment.get('date', datetime.now().strftime('%d %b %Y'))}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Payment Mode:</strong></td><td style="padding: 4px 0;">{payment.get('payment_mode', 'N/A')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Reference:</strong></td><td style="padding: 4px 0;">{payment.get('reference', payment.get('transaction_id', 'N/A'))}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Invoice:</strong></td><td style="padding: 4px 0;">{payment.get('invoice_number', 'N/A')}</td></tr>
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        This receipt confirms your payment has been processed successfully.
    </p>
    """
    
    return subject, get_base_template(content, subject)


def payment_reminder_email(invoice: Dict, days_overdue: int = 0) -> tuple:
    """Email template for payment reminder"""
    urgency = "Friendly" if days_overdue <= 7 else "Important" if days_overdue <= 30 else "Urgent"
    subject = f"{urgency} Payment Reminder - Invoice {invoice.get('invoice_number')}"
    
    urgency_color = "#0ea5e9" if days_overdue <= 7 else "#f59e0b" if days_overdue <= 30 else "#ef4444"
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">{urgency} Payment Reminder</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{invoice.get('customer_name', invoice.get('party_name', 'Customer'))}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        This is a reminder regarding the outstanding payment for the following invoice:
    </p>
    
    <div style="background-color: #fef2f2; border-left: 4px solid {urgency_color}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Invoice Number:</strong></td><td style="padding: 4px 0;">{invoice.get('invoice_number')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Invoice Date:</strong></td><td style="padding: 4px 0;">{invoice.get('date', 'N/A')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Amount Due:</strong></td><td style="padding: 4px 0; color: #dc2626; font-weight: bold;">₹{invoice.get('balance_due', invoice.get('total_amount', 0)):,.2f}</td></tr>
            {'<tr><td style="padding: 4px 0;"><strong>Days Overdue:</strong></td><td style="padding: 4px 0; color: #dc2626;">' + str(days_overdue) + ' days</td></tr>' if days_overdue > 0 else ''}
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        Please arrange for the payment at your earliest convenience. If you have already made the payment, please ignore this reminder.
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        For any queries regarding this invoice, please contact us at <strong>+91-9999036254</strong>.
    </p>
    """
    
    return subject, get_base_template(content, subject)


# ==================== DEALER EMAIL TEMPLATES ====================

def dealer_order_confirmation_email(order: Dict, dealer: Dict) -> tuple:
    """Email template for dealer order confirmation"""
    subject = f"Order Confirmed - {order.get('order_number')}"
    
    items_html = ""
    for item in order.get('items', []):
        items_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{item.get('name', 'N/A')}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">{item.get('quantity', 1)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹{item.get('price', 0):,.2f}</td>
        </tr>
        """
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">Order Confirmation</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{dealer.get('firm_name', dealer.get('contact_person', 'Partner'))}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Thank you for your order! We're pleased to confirm that your order has been received and is being processed.
    </p>
    
    <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <h3 style="margin: 0 0 12px 0; color: #0369a1;">Order Details</h3>
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Order Number:</strong></td><td style="padding: 4px 0;">{order.get('order_number')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Order Date:</strong></td><td style="padding: 4px 0;">{order.get('created_at', datetime.now().strftime('%d %b %Y'))[:10]}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Total Amount:</strong></td><td style="padding: 4px 0; color: #059669; font-weight: bold;">₹{order.get('total_amount', 0):,.2f}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Payment Status:</strong></td><td style="padding: 4px 0;">{order.get('payment_status', 'Pending').title()}</td></tr>
        </table>
    </div>
    
    <h3 style="color: #334155; margin: 20px 0 12px 0;">Order Items</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
            <tr style="background-color: #f1f5f9;">
                <th style="padding: 10px 8px; text-align: left;">Product</th>
                <th style="padding: 10px 8px; text-align: center;">Qty</th>
                <th style="padding: 10px 8px; text-align: right;">Price</th>
            </tr>
        </thead>
        <tbody>
            {items_html}
        </tbody>
    </table>
    
    <p style="color: #475569; line-height: 1.6; margin-top: 20px;">
        We will notify you once your order is dispatched. Expected dispatch within 2-3 business days.
    </p>
    """
    
    return subject, get_base_template(content, subject)


def dealer_order_dispatched_email(order: Dict, dealer: Dict) -> tuple:
    """Email template for dealer order dispatch notification"""
    subject = f"Order Shipped - {order.get('order_number')}"
    
    tracking_info = ""
    if order.get('dispatch_awb'):
        tracking_info = f"""
        <div style="background-color: #eff6ff; border: 2px dashed #3b82f6; padding: 16px; margin: 20px 0; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 12px; text-transform: uppercase;">Tracking Number</p>
            <p style="margin: 0; color: #1e3a8a; font-size: 24px; font-weight: bold; letter-spacing: 2px;">{order.get('dispatch_awb')}</p>
            <p style="margin: 8px 0 0 0; color: #3b82f6; font-size: 13px;">Courier: {order.get('dispatch_courier', 'N/A')}</p>
        </div>
        """
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">📦 Your Order Has Been Shipped!</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{dealer.get('firm_name', dealer.get('contact_person', 'Partner'))}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Great news! Your order <strong>{order.get('order_number')}</strong> has been dispatched.
    </p>
    
    {tracking_info}
    
    <div style="background-color: #f8fafc; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Order Number:</strong></td><td style="padding: 4px 0;">{order.get('order_number')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Dispatch Date:</strong></td><td style="padding: 4px 0;">{order.get('dispatch_date', datetime.now().strftime('%d %b %Y'))}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Expected Delivery:</strong></td><td style="padding: 4px 0;">3-5 business days</td></tr>
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        You can track your shipment using the tracking number above on the courier's website.
    </p>
    """
    
    return subject, get_base_template(content, subject)


def dealer_application_received_email(application: Dict) -> tuple:
    """Email for dealer application received"""
    subject = f"Application Received - {application.get('application_number', 'MuscleGrid Dealer')}"
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">Application Received</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{application.get('contact_person', application.get('firm_name', 'Applicant'))}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Thank you for your interest in becoming a MuscleGrid authorized dealer. We have received your application.
    </p>
    
    <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Application ID:</strong></td><td style="padding: 4px 0;">{application.get('application_number', application.get('id', 'N/A')[:8])}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Firm Name:</strong></td><td style="padding: 4px 0;">{application.get('firm_name', 'N/A')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Submitted On:</strong></td><td style="padding: 4px 0;">{datetime.now().strftime('%d %b %Y')}</td></tr>
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        <strong>What's Next?</strong><br>
        Our team will review your application and verify the details provided. You can expect to hear from us within 3-5 business days.
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        If you have any questions, please contact us at <strong>+91-9999036254</strong>.
    </p>
    """
    
    return subject, get_base_template(content, subject)


def dealer_application_approved_email(dealer: Dict) -> tuple:
    """Email for dealer application approval"""
    subject = "🎉 Congratulations! Your Dealer Application is Approved"
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">Welcome to MuscleGrid Family!</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{dealer.get('contact_person', dealer.get('firm_name', 'Partner'))}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Congratulations! We're pleased to inform you that your dealer application has been <strong style="color: #059669;">APPROVED</strong>.
    </p>
    
    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">Your Dealer Code</p>
        <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 4px;">{dealer.get('dealer_code', 'N/A')}</p>
    </div>
    
    <div style="background-color: #f8fafc; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; color: #334155;">Your Account Details</h3>
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Firm Name:</strong></td><td style="padding: 4px 0;">{dealer.get('firm_name', 'N/A')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Tier:</strong></td><td style="padding: 4px 0;">{dealer.get('tier', 'Silver').title()}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Credit Limit:</strong></td><td style="padding: 4px 0;">₹{dealer.get('credit_limit', 0):,.0f}</td></tr>
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        <strong>Getting Started:</strong><br>
        • Log in to your Dealer Portal at <a href="https://crm.musclegrid.in/dealer" style="color: #0ea5e9;">crm.musclegrid.in/dealer</a><br>
        • Browse our product catalogue<br>
        • Place your first order and avail exclusive dealer pricing
    </p>
    
    <div style="text-align: center; margin: 24px 0;">
        <a href="https://crm.musclegrid.in/dealer" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold;">
            Access Dealer Portal →
        </a>
    </div>
    """
    
    return subject, get_base_template(content, subject)


def dealer_announcement_email(announcement: Dict, dealer: Dict) -> tuple:
    """Email for dealer announcements"""
    subject = f"📢 {announcement.get('title', 'Announcement from MuscleGrid')}"
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">{announcement.get('title', 'Announcement')}</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{dealer.get('firm_name', 'Partner')}</strong>,
    </p>
    
    <div style="background-color: #f8fafc; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #0ea5e9;">
        <p style="color: #334155; line-height: 1.8; margin: 0; white-space: pre-wrap;">{announcement.get('content', '')}</p>
    </div>
    
    {'<p style="color: #475569;"><a href="' + announcement.get('action_url') + '" style="color: #0ea5e9;">' + announcement.get('action_text', 'Learn More') + ' →</a></p>' if announcement.get('action_url') else ''}
    
    <p style="color: #64748b; font-size: 13px; margin-top: 20px;">
        This announcement was sent to all MuscleGrid authorized dealers.
    </p>
    """
    
    return subject, get_base_template(content, subject)


# ==================== USER EMAIL TEMPLATES ====================

def password_reset_email(user: Dict, reset_link: str) -> tuple:
    """Email for password reset"""
    subject = "Reset Your MuscleGrid Password"
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">Password Reset Request</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{user.get('first_name', 'User')}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        We received a request to reset your password. Click the button below to create a new password:
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
        <a href="{reset_link}" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Reset Password
        </a>
    </div>
    
    <p style="color: #64748b; font-size: 13px; line-height: 1.6;">
        This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you have concerns.
    </p>
    
    <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="color: #64748b; word-break: break-all;">{reset_link}</span>
    </p>
    """
    
    return subject, get_base_template(content, subject)


def welcome_email(user: Dict) -> tuple:
    """Welcome email for new users"""
    subject = "Welcome to MuscleGrid!"
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">Welcome to MuscleGrid!</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{user.get('first_name', 'User')}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Your account has been created successfully. You can now access the MuscleGrid portal.
    </p>
    
    <div style="background-color: #f8fafc; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Email:</strong></td><td style="padding: 4px 0;">{user.get('email', 'N/A')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Role:</strong></td><td style="padding: 4px 0;">{user.get('role', 'User').replace('_', ' ').title()}</td></tr>
        </table>
    </div>
    
    <div style="text-align: center; margin: 24px 0;">
        <a href="https://crm.musclegrid.in/login" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold;">
            Login to Portal →
        </a>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        If you have any questions, please don't hesitate to contact us.
    </p>
    """
    
    return subject, get_base_template(content, subject)


# ==================== FEEDBACK EMAIL TEMPLATE ====================

def feedback_request_email(ticket: Dict) -> tuple:
    """Email requesting feedback after service"""
    subject = f"How was your experience? - {ticket.get('ticket_number')}"
    
    content = f"""
    <h2 style="color: #1e293b; margin: 0 0 16px 0;">We Value Your Feedback!</h2>
    
    <p style="color: #475569; line-height: 1.6;">
        Dear <strong>{ticket.get('customer_name', 'Customer')}</strong>,
    </p>
    
    <p style="color: #475569; line-height: 1.6;">
        Thank you for choosing MuscleGrid for your recent service. We hope you're satisfied with our service.
    </p>
    
    <div style="background-color: #f8fafc; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <table style="width: 100%; color: #334155; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Ticket:</strong></td><td style="padding: 4px 0;">{ticket.get('ticket_number')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Product:</strong></td><td style="padding: 4px 0;">{ticket.get('product_name', ticket.get('device_type', 'N/A'))}</td></tr>
        </table>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        <strong>How would you rate your experience?</strong>
    </p>
    
    <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; cursor: pointer;">⭐ ⭐ ⭐ ⭐ ⭐</span>
    </div>
    
    <p style="color: #475569; line-height: 1.6;">
        Your feedback helps us improve our services. Please take a moment to share your thoughts.
    </p>
    
    <p style="color: #64748b; font-size: 13px; margin-top: 20px;">
        You can also reach us at <strong>+91-9999036254</strong> for any concerns.
    </p>
    """
    
    return subject, get_base_template(content, subject)

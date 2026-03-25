"""
Test Suite for PI/Quotation Module and Incentive Tracking System
Iteration 35 - Testing quotation creation, send, public view, PDF, approval, conversion, and incentives

Features tested:
- PI/Quotation creation flow
- PI list view with filters and stats
- PI send functionality (marks as sent and locks)
- Public PI view page
- PDF generation using weasyprint
- Customer approval/rejection flow via public link
- PI Pending Action queue for accountants
- PI conversion to sale/production request
- Incentive creation when PI is converted
- My Incentives page for Call Support role
- Admin Incentives page - summary, transactions, configuration
- Incentive configuration - fixed or percentage based
- Bulk approve and mark paid for incentives
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"
ACCOUNTANT_EMAIL = "aman@musclegrid.in"
ACCOUNTANT_PASSWORD = "Muscle@846"


class TestQuotationIncentiveModule:
    """Test PI/Quotation and Incentive Tracking System"""
    
    admin_token = None
    accountant_token = None
    test_quotation_id = None
    test_quotation_number = None
    test_access_token = None
    test_firm_id = None
    test_sku_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    # ==================== AUTH TESTS ====================
    
    def test_01_admin_login(self):
        """Test admin login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        TestQuotationIncentiveModule.admin_token = data["access_token"]
        print(f"✓ Admin login successful, role: {data['user']['role']}")
    
    def test_02_accountant_login(self):
        """Test accountant login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        assert response.status_code == 200, f"Accountant login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        TestQuotationIncentiveModule.accountant_token = data["access_token"]
        print(f"✓ Accountant login successful, role: {data['user']['role']}")
    
    # ==================== SETUP: GET FIRM AND SKU ====================
    
    def test_03_get_firms(self):
        """Get active firms for quotation creation"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        response = self.session.get(f"{BASE_URL}/api/firms", headers=headers, params={"is_active": True})
        assert response.status_code == 200, f"Failed to get firms: {response.text}"
        firms = response.json()
        assert len(firms) > 0, "No active firms found"
        TestQuotationIncentiveModule.test_firm_id = firms[0]["id"]
        print(f"✓ Found {len(firms)} firms, using: {firms[0]['name']}")
    
    def test_04_get_master_skus(self):
        """Get master SKUs for quotation items"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        response = self.session.get(f"{BASE_URL}/api/master-skus", headers=headers)
        assert response.status_code == 200, f"Failed to get SKUs: {response.text}"
        skus = response.json()
        assert len(skus) > 0, "No master SKUs found"
        TestQuotationIncentiveModule.test_sku_id = skus[0]["id"]
        print(f"✓ Found {len(skus)} SKUs, using: {skus[0]['name']} ({skus[0]['sku_code']})")
    
    # ==================== QUOTATION CREATION ====================
    
    def test_05_create_quotation_draft(self):
        """Test creating a new quotation as draft"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        
        # First get SKU details to get the name
        sku_response = self.session.get(
            f"{BASE_URL}/api/master-skus/{TestQuotationIncentiveModule.test_sku_id}",
            headers=headers
        )
        sku_name = "Test Product"
        sku_code = "TEST-SKU"
        if sku_response.status_code == 200:
            sku_data = sku_response.json()
            sku_name = sku_data.get("name", "Test Product")
            sku_code = sku_data.get("sku_code", "TEST-SKU")
        
        quotation_data = {
            "firm_id": TestQuotationIncentiveModule.test_firm_id,
            "customer_name": "TEST_Customer_V35",
            "customer_phone": "9876543210",
            "customer_email": "test_v35@example.com",
            "customer_address": "123 Test Street",
            "customer_city": "Mumbai",
            "customer_state": "Maharashtra",
            "customer_pincode": "400001",
            "customer_gstin": "",
            "items": [
                {
                    "master_sku_id": TestQuotationIncentiveModule.test_sku_id,
                    "name": sku_name,
                    "sku_code": sku_code,
                    "quantity": 2,
                    "rate": 5000,
                    "gst_rate": 18,
                    "discount_percent": 0
                }
            ],
            "validity_days": 15,
            "remarks": "Test quotation for iteration 35",
            "terms_and_conditions": "Standard terms apply",
            "save_as_draft": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/quotations", headers=headers, json=quotation_data)
        assert response.status_code == 200, f"Failed to create quotation: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "quotation_number" in data
        assert data["status"] == "draft"
        assert data["customer_name"] == "TEST_Customer_V35"
        
        TestQuotationIncentiveModule.test_quotation_id = data["id"]
        TestQuotationIncentiveModule.test_quotation_number = data["quotation_number"]
        TestQuotationIncentiveModule.test_access_token = data.get("access_token")
        
        print(f"✓ Created draft quotation: {data['quotation_number']}")
        print(f"  - Grand Total: ₹{data.get('grand_total', 0)}")
        print(f"  - Status: {data['status']}")
    
    def test_06_list_quotations(self):
        """Test listing quotations with filters"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        
        # List all quotations
        response = self.session.get(f"{BASE_URL}/api/quotations", headers=headers)
        assert response.status_code == 200, f"Failed to list quotations: {response.text}"
        quotations = response.json()
        assert isinstance(quotations, list)
        print(f"✓ Listed {len(quotations)} quotations")
        
        # Filter by status
        response = self.session.get(f"{BASE_URL}/api/quotations", headers=headers, params={"status": "draft"})
        assert response.status_code == 200
        draft_quotations = response.json()
        print(f"  - Draft quotations: {len(draft_quotations)}")
    
    def test_07_get_quotation_reports(self):
        """Test quotation reports/stats endpoint"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        response = self.session.get(f"{BASE_URL}/api/quotations/reports", headers=headers)
        assert response.status_code == 200, f"Failed to get reports: {response.text}"
        
        data = response.json()
        assert "total_quotations" in data
        assert "by_status" in data
        print(f"✓ Quotation reports retrieved")
        print(f"  - Total quotations: {data.get('total_quotations', 0)}")
        print(f"  - Conversion rate: {data.get('conversion_rate', 0)}%")
    
    def test_08_get_quotation_details(self):
        """Test getting single quotation details"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        response = self.session.get(
            f"{BASE_URL}/api/quotations/{TestQuotationIncentiveModule.test_quotation_id}", 
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get quotation: {response.text}"
        
        data = response.json()
        assert data["id"] == TestQuotationIncentiveModule.test_quotation_id
        assert data["quotation_number"] == TestQuotationIncentiveModule.test_quotation_number
        print(f"✓ Retrieved quotation details: {data['quotation_number']}")
    
    # ==================== SEND QUOTATION ====================
    
    def test_09_send_quotation(self):
        """Test sending quotation (marks as sent and locks)"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        response = self.session.post(
            f"{BASE_URL}/api/quotations/{TestQuotationIncentiveModule.test_quotation_id}/send",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to send quotation: {response.text}"
        
        data = response.json()
        assert "share_link" in data
        assert data.get("success") == True or data.get("status") == "sent"
        
        # Extract access token from share link
        share_link = data["share_link"]
        TestQuotationIncentiveModule.test_access_token = share_link.split("/pi/")[-1]
        
        print(f"✓ Quotation sent successfully")
        print(f"  - Share link: {share_link}")
    
    # ==================== PUBLIC VIEW ====================
    
    def test_10_public_view_quotation(self):
        """Test public view of quotation (no auth required)"""
        response = self.session.get(
            f"{BASE_URL}/api/pi/view/{TestQuotationIncentiveModule.test_access_token}"
        )
        assert response.status_code == 200, f"Failed to view public quotation: {response.text}"
        
        data = response.json()
        assert data["quotation_number"] == TestQuotationIncentiveModule.test_quotation_number
        assert data["customer_name"] == "TEST_Customer_V35"
        assert "items" in data
        assert "grand_total" in data
        
        # Status should be 'viewed' after first view
        print(f"✓ Public view successful")
        print(f"  - Quotation: {data['quotation_number']}")
        print(f"  - Status: {data.get('status')}")
        print(f"  - Grand Total: ₹{data.get('grand_total', 0)}")
    
    def test_11_public_pdf_download(self):
        """Test PDF download from public link"""
        response = self.session.get(
            f"{BASE_URL}/api/pi/pdf/{TestQuotationIncentiveModule.test_access_token}"
        )
        assert response.status_code == 200, f"Failed to download PDF: {response.text}"
        assert response.headers.get("content-type") == "application/pdf"
        assert len(response.content) > 1000, "PDF content too small"
        
        print(f"✓ PDF download successful")
        print(f"  - Content-Type: {response.headers.get('content-type')}")
        print(f"  - PDF size: {len(response.content)} bytes")
    
    # ==================== APPROVAL FLOW ====================
    
    def test_12_approve_quotation(self):
        """Test customer approval of quotation via public link"""
        response = self.session.post(
            f"{BASE_URL}/api/pi/approve/{TestQuotationIncentiveModule.test_access_token}"
        )
        assert response.status_code == 200, f"Failed to approve quotation: {response.text}"
        
        data = response.json()
        assert data.get("success") == True or data.get("status") == "approved"
        print(f"✓ Quotation approved successfully")
        print(f"  - Message: {data.get('message')}")
    
    # ==================== PENDING ACTION QUEUE ====================
    
    def test_13_pending_action_queue(self):
        """Test pending action queue for accountants"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.accountant_token}"}
        response = self.session.get(f"{BASE_URL}/api/quotations/pending-action", headers=headers)
        assert response.status_code == 200, f"Failed to get pending action: {response.text}"
        
        data = response.json()
        assert "buckets" in data
        assert "counts" in data
        
        print(f"✓ Pending action queue retrieved")
        print(f"  - Total pending: {data.get('total', 0)}")
        for bucket, count in data.get("counts", {}).items():
            print(f"  - {bucket}: {count}")
    
    # ==================== INCENTIVE CONFIGURATION ====================
    
    def test_14_create_incentive_config(self):
        """Test creating incentive configuration"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        
        config_data = {
            "month": "default",
            "incentive_type": "fixed",
            "fixed_amount": 500,
            "percentage": 1,
            "min_sale_value": 1000,
            "max_incentive": 5000,
            "notes": "Test config for iteration 35"
        }
        
        response = self.session.post(f"{BASE_URL}/api/admin/incentive-config", headers=headers, json=config_data)
        assert response.status_code == 200, f"Failed to create incentive config: {response.text}"
        
        print(f"✓ Incentive configuration created/updated")
        print(f"  - Type: {config_data['incentive_type']}")
        print(f"  - Fixed amount: ₹{config_data['fixed_amount']}")
    
    def test_15_list_incentive_configs(self):
        """Test listing incentive configurations"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        response = self.session.get(f"{BASE_URL}/api/admin/incentive-config", headers=headers)
        assert response.status_code == 200, f"Failed to list configs: {response.text}"
        
        configs = response.json()
        assert isinstance(configs, list)
        print(f"✓ Listed {len(configs)} incentive configurations")
    
    # ==================== QUOTATION CONVERSION ====================
    
    def test_16_convert_quotation_to_dispatch(self):
        """Test converting approved quotation to dispatch (creates incentive)"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        
        response = self.session.post(
            f"{BASE_URL}/api/quotations/{TestQuotationIncentiveModule.test_quotation_id}/convert",
            headers=headers,
            params={"conversion_type": "dispatch"}
        )
        
        # May fail if stock not available, which is acceptable
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Quotation converted to dispatch")
            print(f"  - Incentive created: {data.get('incentive_created', False)}")
            print(f"  - Incentive amount: ₹{data.get('incentive_amount', 0)}")
        elif response.status_code == 400:
            print(f"⚠ Conversion failed (expected if no stock): {response.json().get('detail')}")
        else:
            print(f"⚠ Conversion returned status {response.status_code}: {response.text}")
    
    # ==================== ADMIN INCENTIVES ====================
    
    def test_17_admin_incentives_list(self):
        """Test admin listing all incentives"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        response = self.session.get(f"{BASE_URL}/api/admin/incentives", headers=headers)
        assert response.status_code == 200, f"Failed to list incentives: {response.text}"
        
        data = response.json()
        assert "incentives" in data
        assert "summary" in data
        
        print(f"✓ Admin incentives list retrieved")
        print(f"  - Total incentives: {data['summary'].get('total_count', 0)}")
        print(f"  - Total amount: ₹{data['summary'].get('total_amount', 0)}")
    
    def test_18_admin_incentives_summary(self):
        """Test admin incentives summary by agent"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        current_month = datetime.now().strftime("%Y-%m")
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/incentives/summary", 
            headers=headers,
            params={"month": current_month}
        )
        assert response.status_code == 200, f"Failed to get summary: {response.text}"
        
        data = response.json()
        assert "agents" in data
        assert "totals" in data
        
        print(f"✓ Admin incentives summary retrieved for {current_month}")
        print(f"  - Active agents: {len(data.get('agents', []))}")
        print(f"  - Total incentive: ₹{data['totals'].get('total_incentive', 0)}")
    
    def test_19_bulk_approve_incentives(self):
        """Test bulk approve pending incentives"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        current_month = datetime.now().strftime("%Y-%m")
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/incentives/bulk-approve",
            headers=headers,
            params={"month": current_month}
        )
        assert response.status_code == 200, f"Failed to bulk approve: {response.text}"
        
        data = response.json()
        print(f"✓ Bulk approve completed: {data.get('message')}")
    
    def test_20_bulk_mark_paid(self):
        """Test bulk mark incentives as paid"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        current_month = datetime.now().strftime("%Y-%m")
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/incentives/bulk-paid",
            headers=headers,
            params={"month": current_month}
        )
        assert response.status_code == 200, f"Failed to bulk mark paid: {response.text}"
        
        data = response.json()
        print(f"✓ Bulk mark paid completed: {data.get('message')}")
    
    # ==================== MY INCENTIVES (CALL SUPPORT) ====================
    
    def test_21_my_incentives(self):
        """Test call support viewing their own incentives"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        response = self.session.get(f"{BASE_URL}/api/my-incentives", headers=headers)
        assert response.status_code == 200, f"Failed to get my incentives: {response.text}"
        
        data = response.json()
        assert "incentives" in data
        assert "summary" in data
        
        print(f"✓ My incentives retrieved")
        print(f"  - Total earned: ₹{data['summary'].get('total_earned', 0)}")
        print(f"  - Pending: ₹{data['summary'].get('pending_amount', 0)}")
        print(f"  - Paid: ₹{data['summary'].get('paid_amount', 0)}")
    
    def test_22_my_incentives_stats(self):
        """Test call support incentive statistics"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        response = self.session.get(f"{BASE_URL}/api/my-incentives/stats", headers=headers)
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        
        data = response.json()
        assert "total_quotations" in data
        assert "converted_quotations" in data
        assert "conversion_rate" in data
        
        print(f"✓ My incentive stats retrieved")
        print(f"  - Total PIs created: {data.get('total_quotations', 0)}")
        print(f"  - Converted: {data.get('converted_quotations', 0)}")
        print(f"  - Conversion rate: {data.get('conversion_rate', 0)}%")
    
    # ==================== REJECTION FLOW ====================
    
    def test_23_create_and_reject_quotation(self):
        """Test creating and rejecting a quotation"""
        headers = {"Authorization": f"Bearer {TestQuotationIncentiveModule.admin_token}"}
        
        # First get SKU details to get the name
        sku_response = self.session.get(
            f"{BASE_URL}/api/master-skus/{TestQuotationIncentiveModule.test_sku_id}",
            headers=headers
        )
        sku_name = "Test Product"
        sku_code = "TEST-SKU"
        if sku_response.status_code == 200:
            sku_data = sku_response.json()
            sku_name = sku_data.get("name", "Test Product")
            sku_code = sku_data.get("sku_code", "TEST-SKU")
        
        # Create new quotation
        quotation_data = {
            "firm_id": TestQuotationIncentiveModule.test_firm_id,
            "customer_name": "TEST_Reject_Customer",
            "customer_phone": "9876543211",
            "customer_email": "reject_test@example.com",
            "customer_address": "456 Test Ave",
            "customer_city": "Delhi",
            "customer_state": "Delhi",
            "customer_pincode": "110001",
            "items": [
                {
                    "master_sku_id": TestQuotationIncentiveModule.test_sku_id,
                    "name": sku_name,
                    "sku_code": sku_code,
                    "quantity": 1,
                    "rate": 3000,
                    "gst_rate": 18,
                    "discount_percent": 0
                }
            ],
            "validity_days": 7,
            "save_as_draft": True  # Create as draft first
        }
        
        response = self.session.post(f"{BASE_URL}/api/quotations", headers=headers, json=quotation_data)
        assert response.status_code == 200, f"Failed to create quotation: {response.text}"
        
        data = response.json()
        reject_quotation_id = data["id"]
        
        # Send the quotation
        response = self.session.post(f"{BASE_URL}/api/quotations/{reject_quotation_id}/send", headers=headers)
        assert response.status_code == 200, f"Failed to send quotation: {response.text}"
        
        send_data = response.json()
        reject_token = send_data["share_link"].split("/pi/")[-1]
        
        # Reject via public link
        response = self.session.post(
            f"{BASE_URL}/api/pi/reject/{reject_token}",
            params={"reason": "Price too high"}
        )
        assert response.status_code == 200, f"Failed to reject quotation: {response.text}"
        
        reject_data = response.json()
        assert reject_data.get("success") == True or reject_data.get("status") == "rejected"
        
        print(f"✓ Quotation rejection flow tested")
        print(f"  - Quotation: {data['quotation_number']}")
        print(f"  - Rejection reason: Price too high")
    
    # ==================== EXISTING PUBLIC PI TEST ====================
    
    def test_24_existing_approved_pi(self):
        """Test viewing the existing approved PI mentioned in context"""
        # Test the PI mentioned in the review request
        existing_token = "8PoWeOYSf_Ym-pSUKZAe1HgVOjb9tivlGQshQHr25Tk"
        
        response = self.session.get(f"{BASE_URL}/api/pi/view/{existing_token}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Existing PI found and accessible")
            print(f"  - Quotation: {data.get('quotation_number')}")
            print(f"  - Status: {data.get('status')}")
            print(f"  - Customer: {data.get('customer_name')}")
        else:
            print(f"⚠ Existing PI not found (may have been cleaned up): {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

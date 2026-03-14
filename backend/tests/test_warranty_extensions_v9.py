"""
Test Suite for Warranty Extension Feature - Iteration 9
Tests: GET /api/admin/warranty-extensions, PATCH /api/admin/warranties/{id}/review-extension
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWarrantyExtensionFeature:
    """Tests for warranty extension approval/rejection workflow"""
    
    # Test credentials
    ADMIN_EMAIL = "admin@musclegrid.in"
    ADMIN_PASSWORD = "admin123"
    CUSTOMER_EMAIL = "ami_t@live.com"
    CUSTOMER_PASSWORD = "customer123"
    
    @pytest.fixture(autouse=True)
    def setup(self, request):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_admin_token(self):
        """Authenticate as admin"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.ADMIN_EMAIL,
            "password": self.ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def get_customer_token(self):
        """Authenticate as customer"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.CUSTOMER_EMAIL,
            "password": self.CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        return response.json()["access_token"]
    
    # ========== GET /api/admin/warranty-extensions tests ==========
    
    def test_get_warranty_extensions_endpoint_exists(self):
        """Test that GET /api/admin/warranty-extensions endpoint exists and returns 200"""
        token = self.get_admin_token()
        response = self.session.get(
            f"{BASE_URL}/api/admin/warranty-extensions",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: GET /api/admin/warranty-extensions returns {len(data)} warranties with extension requests")
        
    def test_warranty_extensions_returns_pending_requests(self):
        """Test that endpoint returns warranties with extension_requested=True"""
        token = self.get_admin_token()
        response = self.session.get(
            f"{BASE_URL}/api/admin/warranty-extensions",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned warranties should have extension_requested=True
        for warranty in data:
            assert warranty.get("extension_requested") == True, f"Warranty {warranty.get('id')} should have extension_requested=True"
        
        print(f"PASS: All {len(data)} warranties have extension_requested=True")
        
    def test_warranty_extensions_unauthorized(self):
        """Test that non-admin users cannot access warranty extensions"""
        token = self.get_customer_token()
        response = self.session.get(
            f"{BASE_URL}/api/admin/warranty-extensions",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, f"Expected 403 for customer, got {response.status_code}"
        print("PASS: Customer cannot access admin warranty extensions endpoint")
        
    # ========== PATCH /api/admin/warranties/{id}/review-extension tests ==========
    
    def test_review_extension_approve_with_months(self):
        """Test admin can approve extension with customizable months (1,2,3,6,12)"""
        token = self.get_admin_token()
        
        # First get a pending extension request
        response = self.session.get(
            f"{BASE_URL}/api/admin/warranty-extensions",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        extensions = response.json()
        pending = [e for e in extensions if e.get("extension_status") == "pending"]
        
        if not pending:
            pytest.skip("No pending extension requests to test approval")
            
        warranty = pending[0]
        warranty_id = warranty["id"]
        original_end_date = warranty.get("warranty_end_date")
        
        print(f"Testing approval for warranty: {warranty_id}")
        print(f"Original warranty end date: {original_end_date}")
        
        # Approve with 6 months extension
        response = self.session.patch(
            f"{BASE_URL}/api/admin/warranties/{warranty_id}/review-extension",
            json={
                "action": "approve",
                "extension_months": 6,
                "notes": "Verified Amazon review - granting 6 month extension"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Extension approval failed: {response.text}"
        result = response.json()
        assert "Extension approved" in result.get("message", ""), f"Unexpected message: {result}"
        assert result.get("new_warranty_end_date"), "Should return new warranty end date"
        
        print(f"PASS: Extension approved with 6 months - new end date: {result.get('new_warranty_end_date')}")
        
    def test_review_extension_reject_with_notes(self):
        """Test admin can reject extension with notes"""
        token = self.get_admin_token()
        
        # Get pending extensions
        response = self.session.get(
            f"{BASE_URL}/api/admin/warranty-extensions",
            headers={"Authorization": f"Bearer {token}"}
        )
        extensions = response.json()
        pending = [e for e in extensions if e.get("extension_status") == "pending"]
        
        if not pending:
            pytest.skip("No pending extension requests to test rejection")
            
        warranty = pending[0]
        warranty_id = warranty["id"]
        
        print(f"Testing rejection for warranty: {warranty_id}")
        
        response = self.session.patch(
            f"{BASE_URL}/api/admin/warranties/{warranty_id}/review-extension",
            json={
                "action": "reject",
                "notes": "Screenshot does not show a valid Amazon review"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Extension rejection failed: {response.text}"
        result = response.json()
        assert "rejected" in result.get("message", "").lower(), f"Unexpected message: {result}"
        
        print(f"PASS: Extension rejected with notes")
        
    def test_review_extension_invalid_action(self):
        """Test that invalid action is rejected"""
        token = self.get_admin_token()
        
        # Get any warranty with extension request
        response = self.session.get(
            f"{BASE_URL}/api/admin/warranty-extensions",
            headers={"Authorization": f"Bearer {token}"}
        )
        extensions = response.json()
        
        if not extensions:
            pytest.skip("No extension requests to test")
            
        warranty_id = extensions[0]["id"]
        
        response = self.session.patch(
            f"{BASE_URL}/api/admin/warranties/{warranty_id}/review-extension",
            json={
                "action": "invalid_action",
                "extension_months": 3
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid action, got {response.status_code}"
        print("PASS: Invalid action returns 400")
        
    def test_review_extension_without_pending_request(self):
        """Test that reviewing a warranty without extension request fails"""
        token = self.get_admin_token()
        
        # Get all warranties  
        response = self.session.get(
            f"{BASE_URL}/api/warranties",
            headers={"Authorization": f"Bearer {token}"}
        )
        warranties = response.json()
        
        # Find one without extension request
        no_extension = [w for w in warranties if not w.get("extension_requested")]
        
        if not no_extension:
            pytest.skip("All warranties have extension requests")
            
        warranty_id = no_extension[0]["id"]
        
        response = self.session.patch(
            f"{BASE_URL}/api/admin/warranties/{warranty_id}/review-extension",
            json={
                "action": "approve",
                "extension_months": 3
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400, f"Expected 400 for no pending extension, got {response.status_code}"
        print("PASS: Cannot review warranty without pending extension request")
        
    def test_review_extension_customer_cannot_review(self):
        """Test that customers cannot review extensions"""
        admin_token = self.get_admin_token()
        customer_token = self.get_customer_token()
        
        # Get extension requests as admin
        response = self.session.get(
            f"{BASE_URL}/api/admin/warranty-extensions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        extensions = response.json()
        
        if not extensions:
            pytest.skip("No extension requests to test")
            
        warranty_id = extensions[0]["id"]
        
        # Try to review as customer
        response = self.session.patch(
            f"{BASE_URL}/api/admin/warranties/{warranty_id}/review-extension",
            json={
                "action": "approve",
                "extension_months": 3
            },
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 403, f"Expected 403 for customer, got {response.status_code}"
        print("PASS: Customers cannot review extensions")


class TestCustomerWarrantyExtensionView:
    """Tests for customer viewing extension status"""
    
    CUSTOMER_EMAIL = "ami_t@live.com"
    CUSTOMER_PASSWORD = "customer123"
    
    @pytest.fixture(autouse=True)
    def setup(self, request):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_customer_token(self):
        """Authenticate as customer"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.CUSTOMER_EMAIL,
            "password": self.CUSTOMER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_customer_can_see_warranties(self):
        """Test customer can view their warranties"""
        token = self.get_customer_token()
        response = self.session.get(
            f"{BASE_URL}/api/warranties",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        warranties = response.json()
        assert isinstance(warranties, list)
        print(f"PASS: Customer can view {len(warranties)} warranties")
        
    def test_warranty_response_includes_extension_fields(self):
        """Test that warranty response includes extension_requested and extension_status fields"""
        token = self.get_customer_token()
        response = self.session.get(
            f"{BASE_URL}/api/warranties",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        warranties = response.json()
        
        if not warranties:
            pytest.skip("Customer has no warranties")
            
        warranty = warranties[0]
        
        # Check extension fields exist in response
        assert "extension_requested" in warranty, "Response should include extension_requested field"
        assert "extension_status" in warranty, "Response should include extension_status field"
        
        print(f"PASS: Warranty response includes extension fields")
        print(f"  - extension_requested: {warranty.get('extension_requested')}")
        print(f"  - extension_status: {warranty.get('extension_status')}")


class TestAdminDashboardStats:
    """Tests for admin dashboard pending extensions count"""
    
    ADMIN_EMAIL = "admin@musclegrid.in"
    ADMIN_PASSWORD = "admin123"
    
    @pytest.fixture(autouse=True)
    def setup(self, request):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_admin_token(self):
        """Authenticate as admin"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.ADMIN_EMAIL,
            "password": self.ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_admin_stats_includes_pending_extensions(self):
        """Test that admin stats endpoint includes pending_extensions count"""
        token = self.get_admin_token()
        response = self.session.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        stats = response.json()
        
        assert "pending_extensions" in stats, "Admin stats should include pending_extensions"
        assert isinstance(stats["pending_extensions"], int), "pending_extensions should be an integer"
        
        print(f"PASS: Admin stats includes pending_extensions: {stats['pending_extensions']}")
        
    def test_pending_extensions_count_matches_actual(self):
        """Test that pending_extensions count matches actual pending requests"""
        token = self.get_admin_token()
        
        # Get stats
        stats_response = self.session.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        stats = stats_response.json()
        
        # Get actual extension requests
        extensions_response = self.session.get(
            f"{BASE_URL}/api/admin/warranty-extensions",
            headers={"Authorization": f"Bearer {token}"}
        )
        extensions = extensions_response.json()
        pending_count = len([e for e in extensions if e.get("extension_status") == "pending"])
        
        assert stats.get("pending_extensions") == pending_count, \
            f"Stats says {stats.get('pending_extensions')} but actual pending is {pending_count}"
        
        print(f"PASS: Pending extensions count matches: {pending_count}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

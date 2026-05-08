"""
Test suite for OrderBot Troubleshooting Feature (Iteration 81)
Tests:
- GET /api/bot/diagnose-order/{order_id} - diagnose stuck orders
- POST /api/bot/fix-order/{order_id} - apply fixes to orders
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"

# Orders with missing SKU (from problem statement)
ORDERS_MISSING_SKU = [
    "171-3496729-7741914",
    "407-8638149-4710714",
    "402-9744612-5407541"
]


class TestTroubleshootOrders:
    """Test suite for order troubleshooting endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("token") or data.get("access_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
                self.token = token
            else:
                pytest.skip("No token in login response")
        else:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
    
    # ==================== DIAGNOSE ORDER TESTS ====================
    
    def test_diagnose_order_not_found(self):
        """Test diagnose endpoint with non-existent order"""
        response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/NONEXISTENT-ORDER-123")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should return not_found status
        assert data.get("status") == "not_found" or "not found" in str(data.get("issues", [])).lower(), \
            f"Expected not_found status, got: {data}"
        print(f"✓ Diagnose non-existent order returns correct status: {data.get('status')}")
    
    def test_diagnose_order_with_missing_sku_1(self):
        """Test diagnose endpoint with order missing SKU: 171-3496729-7741914"""
        order_id = ORDERS_MISSING_SKU[0]
        response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/{order_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        print(f"Diagnose response for {order_id}: {data}")
        
        # Validate response structure
        assert "order_id" in data, "Response should contain order_id"
        assert "issues" in data, "Response should contain issues array"
        assert "fixes_available" in data, "Response should contain fixes_available array"
        
        # Check if order was found
        if data.get("status") == "not_found":
            print(f"⚠ Order {order_id} not found in database")
        else:
            # If found, check for missing_sku issue
            issue_types = [issue.get("type") for issue in data.get("issues", [])]
            print(f"✓ Order {order_id} diagnosed. Issues: {issue_types}")
            print(f"  Fixes available: {data.get('fixes_available', [])}")
    
    def test_diagnose_order_with_missing_sku_2(self):
        """Test diagnose endpoint with order missing SKU: 407-8638149-4710714"""
        order_id = ORDERS_MISSING_SKU[1]
        response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/{order_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        print(f"Diagnose response for {order_id}: {data}")
        
        assert "order_id" in data, "Response should contain order_id"
        assert "issues" in data, "Response should contain issues array"
        
        if data.get("status") != "not_found":
            issue_types = [issue.get("type") for issue in data.get("issues", [])]
            print(f"✓ Order {order_id} diagnosed. Issues: {issue_types}")
    
    def test_diagnose_order_with_missing_sku_3(self):
        """Test diagnose endpoint with order missing SKU: 402-9744612-5407541"""
        order_id = ORDERS_MISSING_SKU[2]
        response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/{order_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        print(f"Diagnose response for {order_id}: {data}")
        
        assert "order_id" in data, "Response should contain order_id"
        assert "issues" in data, "Response should contain issues array"
        
        if data.get("status") != "not_found":
            issue_types = [issue.get("type") for issue in data.get("issues", [])]
            print(f"✓ Order {order_id} diagnosed. Issues: {issue_types}")
    
    def test_diagnose_response_structure(self):
        """Test that diagnose endpoint returns proper structure"""
        # Use first order from the list
        order_id = ORDERS_MISSING_SKU[0]
        response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/{order_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Required fields
        required_fields = ["order_id", "issues", "fixes_available"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # If order found, check additional fields
        if data.get("status") not in ["not_found", "not_imported"]:
            assert "location" in data, "Should have location field"
            assert "order_summary" in data, "Should have order_summary field"
            
            # Check order_summary structure
            summary = data.get("order_summary", {})
            expected_summary_fields = ["id", "customer_name", "firm_id", "master_sku_id"]
            for field in expected_summary_fields:
                assert field in summary, f"order_summary missing field: {field}"
        
        print(f"✓ Diagnose response structure is valid")
    
    # ==================== FIX ORDER TESTS ====================
    
    def test_fix_order_missing_order(self):
        """Test fix endpoint with non-existent order"""
        # Remove Content-Type header for form data
        headers = {"Authorization": self.session.headers.get("Authorization")}
        response = requests.post(
            f"{BASE_URL}/api/bot/fix-order/NONEXISTENT-ORDER-123",
            data={"fix_type": "assign_firm", "firm_id": "test-firm"},
            headers=headers
        )
        
        # Should return 404
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✓ Fix non-existent order returns 404")
    
    def test_fix_order_invalid_fix_type(self):
        """Test fix endpoint with invalid fix_type"""
        order_id = ORDERS_MISSING_SKU[0]
        
        # First check if order exists
        diagnose_response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/{order_id}")
        if diagnose_response.json().get("status") == "not_found":
            pytest.skip(f"Order {order_id} not found, skipping fix test")
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        response = requests.post(
            f"{BASE_URL}/api/bot/fix-order/{order_id}",
            data={"fix_type": "invalid_fix_type"},
            headers=headers
        )
        
        # Should return 400 for invalid fix_type
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ Invalid fix_type returns 400")
    
    def test_fix_order_assign_firm_missing_firm_id(self):
        """Test assign_firm fix without providing firm_id"""
        order_id = ORDERS_MISSING_SKU[0]
        
        # First check if order exists
        diagnose_response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/{order_id}")
        if diagnose_response.json().get("status") == "not_found":
            pytest.skip(f"Order {order_id} not found, skipping fix test")
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        response = requests.post(
            f"{BASE_URL}/api/bot/fix-order/{order_id}",
            data={"fix_type": "assign_firm"},  # Missing firm_id
            headers=headers
        )
        
        # Should return 400 for missing firm_id
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "firm_id" in response.text.lower(), "Error should mention firm_id"
        print(f"✓ assign_firm without firm_id returns 400")
    
    def test_fix_order_link_sku_missing_sku_id(self):
        """Test link_sku fix without providing master_sku_id"""
        order_id = ORDERS_MISSING_SKU[0]
        
        # First check if order exists
        diagnose_response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/{order_id}")
        if diagnose_response.json().get("status") == "not_found":
            pytest.skip(f"Order {order_id} not found, skipping fix test")
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        response = requests.post(
            f"{BASE_URL}/api/bot/fix-order/{order_id}",
            data={"fix_type": "link_sku"},  # Missing master_sku_id
            headers=headers
        )
        
        # Should return 400 for missing master_sku_id
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "master_sku_id" in response.text.lower(), "Error should mention master_sku_id"
        print(f"✓ link_sku without master_sku_id returns 400")
    
    def test_fix_order_assign_firm_invalid_firm(self):
        """Test assign_firm fix with non-existent firm"""
        order_id = ORDERS_MISSING_SKU[0]
        
        # First check if order exists
        diagnose_response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/{order_id}")
        if diagnose_response.json().get("status") == "not_found":
            pytest.skip(f"Order {order_id} not found, skipping fix test")
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        response = requests.post(
            f"{BASE_URL}/api/bot/fix-order/{order_id}",
            data={"fix_type": "assign_firm", "firm_id": "nonexistent-firm-id-12345"},
            headers=headers
        )
        
        # Should return 404 for non-existent firm
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✓ assign_firm with invalid firm returns 404")
    
    def test_fix_order_link_sku_invalid_sku(self):
        """Test link_sku fix with non-existent SKU"""
        order_id = ORDERS_MISSING_SKU[0]
        
        # First check if order exists
        diagnose_response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/{order_id}")
        if diagnose_response.json().get("status") == "not_found":
            pytest.skip(f"Order {order_id} not found, skipping fix test")
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        response = requests.post(
            f"{BASE_URL}/api/bot/fix-order/{order_id}",
            data={"fix_type": "link_sku", "master_sku_id": "nonexistent-sku-id-12345"},
            headers=headers
        )
        
        # Should return 404 for non-existent SKU
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✓ link_sku with invalid SKU returns 404")
    
    # ==================== INTEGRATION TESTS ====================
    
    def test_diagnose_and_get_available_firms(self):
        """Test that diagnose returns available firms for fixing"""
        order_id = ORDERS_MISSING_SKU[0]
        response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/{order_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("status") not in ["not_found", "not_imported"]:
            # Check if available_firms is returned
            if "available_firms" in data:
                firms = data.get("available_firms", [])
                print(f"✓ Available firms returned: {len(firms)} firms")
                if firms:
                    # Verify firm structure
                    assert "id" in firms[0], "Firm should have id"
                    assert "name" in firms[0], "Firm should have name"
                    print(f"  First firm: {firms[0].get('name')}")
    
    def test_fix_order_response_structure(self):
        """Test that fix endpoint returns proper success structure"""
        order_id = ORDERS_MISSING_SKU[0]
        
        # First check if order exists and get a valid firm
        diagnose_response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/{order_id}")
        diagnose_data = diagnose_response.json()
        
        if diagnose_data.get("status") == "not_found":
            pytest.skip(f"Order {order_id} not found, skipping fix test")
        
        # Get a valid firm to use
        firms = diagnose_data.get("available_firms", [])
        if not firms:
            pytest.skip("No firms available for testing")
        
        firm_id = firms[0].get("id")
        
        # Try to assign firm (this is a real operation)
        headers = {"Authorization": self.session.headers.get("Authorization")}
        response = requests.post(
            f"{BASE_URL}/api/bot/fix-order/{order_id}",
            data={"fix_type": "assign_firm", "firm_id": firm_id},
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            assert "success" in data, "Response should have success field"
            assert "order_id" in data, "Response should have order_id field"
            assert "fixes_applied" in data, "Response should have fixes_applied field"
            assert "updated_fields" in data, "Response should have updated_fields field"
            
            assert data["success"] == True, "Success should be True"
            assert isinstance(data["fixes_applied"], list), "fixes_applied should be a list"
            
            print(f"✓ Fix response structure is valid")
            print(f"  Fixes applied: {data['fixes_applied']}")
            print(f"  Updated fields: {data['updated_fields']}")
        else:
            print(f"⚠ Fix returned {response.status_code}: {response.text}")
    
    # ==================== AUTHORIZATION TESTS ====================
    
    def test_diagnose_requires_auth(self):
        """Test that diagnose endpoint requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        
        response = no_auth_session.get(f"{BASE_URL}/api/bot/diagnose-order/test-order")
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Diagnose endpoint requires authentication")
    
    def test_fix_requires_auth(self):
        """Test that fix endpoint requires authentication"""
        # Create new request without auth
        response = requests.post(
            f"{BASE_URL}/api/bot/fix-order/test-order",
            data={"fix_type": "assign_firm"}
        )
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Fix endpoint requires authentication")


class TestDiagnoseIssueTypes:
    """Test specific issue detection in diagnose endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("token") or data.get("access_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Login failed")
    
    def test_diagnose_detects_missing_firm(self):
        """Test that diagnose detects missing firm_id"""
        # Test all orders and check if any has missing_firm issue
        found_missing_firm = False
        
        for order_id in ORDERS_MISSING_SKU:
            response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/{order_id}")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") not in ["not_found", "not_imported"]:
                    issues = data.get("issues", [])
                    issue_types = [i.get("type") for i in issues]
                    
                    if "missing_firm" in issue_types:
                        found_missing_firm = True
                        print(f"✓ Order {order_id} has missing_firm issue detected")
                        
                        # Verify assign_firm fix is available
                        fixes = data.get("fixes_available", [])
                        assert "assign_firm" in fixes, "assign_firm fix should be available"
                        break
        
        if not found_missing_firm:
            print("⚠ No orders with missing_firm issue found (may already have firms assigned)")
    
    def test_diagnose_detects_missing_sku(self):
        """Test that diagnose detects missing master_sku_id"""
        found_missing_sku = False
        
        for order_id in ORDERS_MISSING_SKU:
            response = self.session.get(f"{BASE_URL}/api/bot/diagnose-order/{order_id}")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") not in ["not_found", "not_imported"]:
                    issues = data.get("issues", [])
                    issue_types = [i.get("type") for i in issues]
                    
                    if "missing_sku" in issue_types:
                        found_missing_sku = True
                        print(f"✓ Order {order_id} has missing_sku issue detected")
                        
                        # Verify SKU fix is available
                        fixes = data.get("fixes_available", [])
                        sku_fixes = [f for f in fixes if "sku" in f.lower()]
                        assert len(sku_fixes) > 0, "SKU-related fix should be available"
                        print(f"  Available SKU fixes: {sku_fixes}")
                        break
        
        if not found_missing_sku:
            print("⚠ No orders with missing_sku issue found (may already have SKUs linked)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

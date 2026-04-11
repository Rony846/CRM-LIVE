"""
Iteration 68: Test Universal Search and Bot Handler Endpoints
Tests for:
- GET /api/bot/universal-search/{query} - Searches all collections
- POST /api/bot/import-amazon-to-crm - Creates pending_fulfillment from Amazon order
- POST /api/bot/mark-amazon-dispatched - Creates dispatch record for already-shipped orders
- POST /api/bot/handle-rto - Handles RTO with actions: add_to_inventory, send_to_repair, etc.
- GET /api/bot/serial-info/{serial_number} - Returns full serial history
- POST /api/bot/update-serial - Updates serial number fields
- GET /api/bot/master-skus - Returns list of SKUs for selection
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"

# Test Amazon Order ID from user's screenshot
TEST_AMAZON_ORDER_ID = "407-8638149-4710714"


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    def test_admin_login(self):
        """Test admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"Admin login successful: {data['user']['email']}")


class TestUniversalSearch:
    """Test Universal Search endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_universal_search_endpoint_exists(self, auth_token):
        """Test that universal search endpoint exists and responds"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/bot/universal-search/test123", headers=headers)
        # Should return 200 even if nothing found
        assert response.status_code == 200, f"Endpoint error: {response.status_code} - {response.text}"
        data = response.json()
        assert "query" in data
        assert "found_in" in data
        assert "all_results" in data
        print(f"Universal search response structure: {list(data.keys())}")
    
    def test_universal_search_amazon_order(self, auth_token):
        """Test searching for Amazon order ID"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/bot/universal-search/{TEST_AMAZON_ORDER_ID}", headers=headers)
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        print(f"Search for {TEST_AMAZON_ORDER_ID}:")
        print(f"  Found in: {data.get('found_in', [])}")
        
        # If found in amazon_orders, verify structure
        if "amazon_orders" in data.get("found_in", []):
            amazon_result = data["all_results"].get("amazon_order", {})
            assert "data" in amazon_result, "Amazon order should have data field"
            assert "in_crm" in amazon_result, "Should indicate if in CRM"
            assert "actions" in amazon_result, "Should have available actions"
            
            # If not in CRM, should have import/dispatch actions
            if not amazon_result.get("in_crm"):
                actions = amazon_result.get("actions", [])
                assert "import_to_crm" in actions, f"Should have import_to_crm action, got: {actions}"
                assert "mark_already_dispatched" in actions, f"Should have mark_already_dispatched action, got: {actions}"
                print(f"  Actions available: {actions}")
            else:
                print(f"  Order already in CRM with status: {amazon_result.get('status')}")
        else:
            print(f"  Amazon order not found in amazon_orders collection")
    
    def test_universal_search_phone_number(self, auth_token):
        """Test searching by phone number"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # Use a test phone number
        response = requests.get(f"{BASE_URL}/api/bot/universal-search/9876543210", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"Phone search found in: {data.get('found_in', [])}")
    
    def test_universal_search_nonexistent(self, auth_token):
        """Test searching for non-existent query"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/bot/universal-search/NONEXISTENT12345", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("found_in") == [], "Should return empty found_in for non-existent query"
        print("Non-existent query correctly returns empty results")


class TestImportAmazonToCRM:
    """Test Import Amazon to CRM endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_import_amazon_endpoint_exists(self, auth_token):
        """Test that import endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # Test with invalid order ID to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/bot/import-amazon-to-crm",
            data={"amazon_order_id": "INVALID_ORDER_ID"},
            headers=headers
        )
        # Should return 404 for invalid order, not 405 (method not allowed)
        assert response.status_code in [404, 400], f"Unexpected status: {response.status_code}"
        print(f"Import endpoint exists, returns {response.status_code} for invalid order")
    
    def test_import_amazon_order(self, auth_token):
        """Test importing Amazon order to CRM"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First check if order exists and is not already imported
        search_response = requests.get(
            f"{BASE_URL}/api/bot/universal-search/{TEST_AMAZON_ORDER_ID}",
            headers=headers
        )
        
        if search_response.status_code != 200:
            pytest.skip("Cannot search for order")
        
        search_data = search_response.json()
        
        if "amazon_orders" not in search_data.get("found_in", []):
            pytest.skip(f"Amazon order {TEST_AMAZON_ORDER_ID} not found in database")
        
        amazon_result = search_data["all_results"].get("amazon_order", {})
        if amazon_result.get("in_crm"):
            print(f"Order {TEST_AMAZON_ORDER_ID} already in CRM, skipping import test")
            pytest.skip("Order already imported to CRM")
        
        # Try to import
        response = requests.post(
            f"{BASE_URL}/api/bot/import-amazon-to-crm",
            data={"amazon_order_id": TEST_AMAZON_ORDER_ID},
            headers=headers
        )
        
        if response.status_code == 400 and "already imported" in response.text.lower():
            print("Order was already imported")
            return
        
        assert response.status_code == 200, f"Import failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "pending_fulfillment_id" in data
        assert data.get("status") == "pending_dispatch"
        print(f"Order imported successfully: {data}")


class TestMarkAmazonDispatched:
    """Test Mark Amazon as Dispatched endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_mark_dispatched_endpoint_exists(self, auth_token):
        """Test that mark dispatched endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/bot/mark-amazon-dispatched",
            data={"amazon_order_id": "INVALID_ORDER_ID"},
            headers=headers
        )
        # Should return 404 for invalid order
        assert response.status_code in [404, 400], f"Unexpected status: {response.status_code}"
        print(f"Mark dispatched endpoint exists, returns {response.status_code} for invalid order")


class TestHandleRTO:
    """Test Handle RTO endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_handle_rto_endpoint_exists(self, auth_token):
        """Test that handle RTO endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/bot/handle-rto",
            data={
                "tracking_id": "INVALID_TRACKING",
                "action": "add_to_inventory"
            },
            headers=headers
        )
        # Should return 404 for invalid tracking
        assert response.status_code in [404, 400], f"Unexpected status: {response.status_code}"
        print(f"Handle RTO endpoint exists, returns {response.status_code} for invalid tracking")
    
    def test_handle_rto_invalid_action(self, auth_token):
        """Test that invalid action is rejected"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/bot/handle-rto",
            data={
                "tracking_id": "TEST123",
                "action": "invalid_action"
            },
            headers=headers
        )
        # Should return 400 or 404
        assert response.status_code in [400, 404], f"Should reject invalid action: {response.status_code}"
        print(f"Invalid action correctly rejected with status {response.status_code}")


class TestSerialInfo:
    """Test Serial Info endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_serial_info_endpoint_exists(self, auth_token):
        """Test that serial info endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/bot/serial-info/TEST123", headers=headers)
        assert response.status_code == 200, f"Endpoint error: {response.status_code}"
        data = response.json()
        assert "found" in data
        assert "serial_number" in data
        print(f"Serial info endpoint works, found={data.get('found')}")
    
    def test_serial_info_not_found(self, auth_token):
        """Test serial info for non-existent serial"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/bot/serial-info/NONEXISTENT12345", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("found") == False
        print("Non-existent serial correctly returns found=False")


class TestUpdateSerial:
    """Test Update Serial endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_update_serial_endpoint_exists(self, auth_token):
        """Test that update serial endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/bot/update-serial",
            data={
                "serial_number": "NONEXISTENT",
                "field": "notes",
                "value": "test"
            },
            headers=headers
        )
        # Should return 404 for non-existent serial
        assert response.status_code == 404, f"Unexpected status: {response.status_code}"
        print("Update serial endpoint exists")
    
    def test_update_serial_invalid_field(self, auth_token):
        """Test that invalid field is rejected"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/bot/update-serial",
            data={
                "serial_number": "TEST123",
                "field": "invalid_field",
                "value": "test"
            },
            headers=headers
        )
        # Should return 400 or 404
        assert response.status_code in [400, 404], f"Should reject invalid field: {response.status_code}"
        print(f"Invalid field correctly rejected with status {response.status_code}")


class TestMasterSkus:
    """Test Master SKUs endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_master_skus_endpoint_exists(self, auth_token):
        """Test that master SKUs endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/bot/master-skus", headers=headers)
        assert response.status_code == 200, f"Endpoint error: {response.status_code}"
        data = response.json()
        assert "skus" in data
        assert "count" in data
        print(f"Master SKUs endpoint works, count={data.get('count')}")
    
    def test_master_skus_with_search(self, auth_token):
        """Test master SKUs with search parameter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/bot/master-skus?search=inverter", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"Master SKUs search for 'inverter': count={data.get('count')}")
    
    def test_master_skus_with_limit(self, auth_token):
        """Test master SKUs with limit parameter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/bot/master-skus?limit=5", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data.get("skus", [])) <= 5
        print(f"Master SKUs with limit=5: count={data.get('count')}")


class TestDailyBriefing:
    """Test Daily Briefing endpoint (used by OrderBot)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_daily_briefing_endpoint(self, auth_token):
        """Test daily briefing endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/bot/daily-briefing", headers=headers)
        assert response.status_code == 200, f"Endpoint error: {response.status_code}"
        data = response.json()
        # Should have urgent and attention sections
        assert "urgent" in data or "today" in data, f"Missing expected fields: {list(data.keys())}"
        print(f"Daily briefing response: {list(data.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

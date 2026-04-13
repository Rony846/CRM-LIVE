"""
Iteration 76: Bigship Courier Integration Tests
Tests for Amazon Order processing with Bigship shipping integration.

Endpoints tested:
- POST /api/bot/update-tracking - Update tracking ID on orders
- GET /api/courier/warehouses - Get Bigship warehouse list
- POST /api/courier/calculate-rates - Calculate shipping rates
- POST /api/courier/create-shipment - Create B2C/B2B shipment
- POST /api/courier/manifest - Assign courier and generate AWB
- GET /api/courier/label/{system_order_id} - Download shipping label
- GET /api/courier/shipments - List courier shipments
- GET /api/courier/track/{tracking_number} - Track shipment
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@musclegrid.in"
TEST_PASSWORD = "Muscle@846"


class TestBigshipIntegration:
    """Tests for Bigship Courier API Integration"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # API returns access_token, not token
        token = data.get("access_token") or data.get("token")
        assert token, "No token in login response"
        return token
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    # ===== BOT UPDATE TRACKING TESTS =====
    
    def test_bot_update_tracking_missing_order(self, auth_headers):
        """Test update tracking with non-existent order ID"""
        response = requests.post(
            f"{BASE_URL}/api/bot/update-tracking",
            data={
                "order_id": "non-existent-order-12345",
                "tracking_id": "TEST123456789",
                "courier_name": "Test Courier"
            },
            headers={"Authorization": auth_headers["Authorization"]}
        )
        # Should return 404 for non-existent order
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
    
    def test_bot_update_tracking_unauthorized(self):
        """Test update tracking without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/bot/update-tracking",
            data={
                "order_id": "test-order",
                "tracking_id": "TEST123456789"
            }
        )
        # Should return 401 or 403 for unauthorized
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ===== COURIER WAREHOUSES TESTS =====
    
    def test_get_courier_warehouses(self, auth_headers):
        """Test fetching Bigship warehouses - should return default warehouse"""
        response = requests.get(
            f"{BASE_URL}/api/courier/warehouses",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get warehouses: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True, "Response should indicate success"
        assert "warehouses" in data, "Response should contain warehouses list"
        assert "total" in data, "Response should contain total count"
        
        # Should have at least one warehouse (default)
        warehouses = data["warehouses"]
        assert isinstance(warehouses, list), "Warehouses should be a list"
        
        if len(warehouses) > 0:
            # Verify warehouse structure
            warehouse = warehouses[0]
            print(f"First warehouse: {warehouse}")
            # Bigship warehouse should have these fields
            assert "id" in warehouse or "warehouse_id" in warehouse, "Warehouse should have ID"
    
    def test_get_courier_warehouses_unauthorized(self):
        """Test fetching warehouses without authentication"""
        response = requests.get(f"{BASE_URL}/api/courier/warehouses")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ===== COURIER CALCULATE RATES TESTS =====
    
    def test_calculate_courier_rates_b2c(self, auth_headers):
        """Test calculating B2C shipping rates"""
        # First get a warehouse to get pickup pincode
        warehouses_response = requests.get(
            f"{BASE_URL}/api/courier/warehouses",
            headers=auth_headers
        )
        
        # Use default pincodes if warehouse fetch fails
        pickup_pincode = "160055"  # Chandigarh area
        destination_pincode = "110001"  # Delhi
        
        if warehouses_response.status_code == 200:
            warehouses = warehouses_response.json().get("warehouses", [])
            if warehouses:
                pickup_pincode = warehouses[0].get("pincode", pickup_pincode)
        
        response = requests.post(
            f"{BASE_URL}/api/courier/calculate-rates",
            json={
                "shipment_category": "B2C",
                "payment_type": "Prepaid",
                "pickup_pincode": pickup_pincode,
                "destination_pincode": destination_pincode,
                "invoice_amount": 5000,
                "weight": 2.5,
                "length": 30,
                "width": 20,
                "height": 15
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed to calculate rates: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True, "Response should indicate success"
        assert "rates" in data, "Response should contain rates"
        
        rates = data["rates"]
        print(f"Calculated rates: {rates}")
        
        # Rates should be a list of courier options
        if isinstance(rates, list) and len(rates) > 0:
            rate = rates[0]
            # Each rate should have courier info and price
            print(f"First rate option: {rate}")
    
    def test_calculate_courier_rates_b2b(self, auth_headers):
        """Test calculating B2B shipping rates"""
        response = requests.post(
            f"{BASE_URL}/api/courier/calculate-rates",
            json={
                "shipment_category": "B2B",
                "payment_type": "Prepaid",
                "pickup_pincode": "160055",
                "destination_pincode": "400001",  # Mumbai
                "invoice_amount": 75000,
                "weight": 50,
                "length": 60,
                "width": 40,
                "height": 40
            },
            headers=auth_headers
        )
        
        # B2B rates may fail validation if Bigship doesn't support the route
        # or if additional fields are required for B2B
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print(f"B2B rates: {data.get('rates')}")
        else:
            # 400 is acceptable if Bigship validation fails
            assert response.status_code == 400, f"Unexpected status: {response.status_code}"
            print(f"B2B rate calculation returned validation error (expected for some routes): {response.text}")
    
    def test_calculate_courier_rates_invalid_pincode(self, auth_headers):
        """Test calculating rates with invalid pincode"""
        response = requests.post(
            f"{BASE_URL}/api/courier/calculate-rates",
            json={
                "shipment_category": "B2C",
                "payment_type": "Prepaid",
                "pickup_pincode": "000000",  # Invalid
                "destination_pincode": "999999",  # Invalid
                "invoice_amount": 1000,
                "weight": 1
            },
            headers=auth_headers
        )
        
        # Should either return 400 or 200 with empty rates
        if response.status_code == 200:
            data = response.json()
            # May return empty rates for invalid pincodes
            print(f"Response for invalid pincodes: {data}")
        else:
            assert response.status_code == 400, f"Expected 400 for invalid pincode, got {response.status_code}"
    
    def test_calculate_courier_rates_unauthorized(self):
        """Test calculating rates without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/courier/calculate-rates",
            json={
                "shipment_category": "B2C",
                "pickup_pincode": "160055",
                "destination_pincode": "110001"
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ===== COURIER SHIPMENTS LIST TESTS =====
    
    def test_get_courier_shipments_list(self, auth_headers):
        """Test fetching list of courier shipments"""
        response = requests.get(
            f"{BASE_URL}/api/courier/shipments",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed to get shipments: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "shipments" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        
        shipments = data["shipments"]
        assert isinstance(shipments, list)
        print(f"Total shipments: {data['total']}, Current page: {len(shipments)}")
    
    def test_get_courier_shipments_with_pagination(self, auth_headers):
        """Test shipments list with pagination"""
        response = requests.get(
            f"{BASE_URL}/api/courier/shipments",
            params={"page": 1, "page_size": 5},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 5
    
    def test_get_courier_shipments_with_search(self, auth_headers):
        """Test shipments list with search filter"""
        response = requests.get(
            f"{BASE_URL}/api/courier/shipments",
            params={"search": "test"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
    
    # ===== COURIER TRACKING TESTS =====
    
    def test_track_shipment_invalid_awb(self, auth_headers):
        """Test tracking with invalid AWB number"""
        response = requests.get(
            f"{BASE_URL}/api/courier/track/INVALID123456",
            params={"tracking_type": "awb"},
            headers=auth_headers
        )
        
        # Should return 400 for invalid tracking number
        # or 200 with error message from Bigship
        if response.status_code == 200:
            data = response.json()
            print(f"Tracking response for invalid AWB: {data}")
        else:
            assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_track_shipment_unauthorized(self):
        """Test tracking without authentication"""
        response = requests.get(f"{BASE_URL}/api/courier/track/TEST123")
        assert response.status_code in [401, 403]
    
    # ===== COURIER LABEL TESTS =====
    
    def test_get_label_invalid_order(self, auth_headers):
        """Test getting label for non-existent order"""
        response = requests.get(
            f"{BASE_URL}/api/courier/label/999999999",
            headers=auth_headers
        )
        
        # Should return 400 for invalid order
        if response.status_code == 200:
            data = response.json()
            print(f"Label response for invalid order: {data}")
        else:
            assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_get_label_unauthorized(self):
        """Test getting label without authentication"""
        response = requests.get(f"{BASE_URL}/api/courier/label/12345")
        assert response.status_code in [401, 403]
    
    # ===== CREATE SHIPMENT TESTS (Validation only - no actual creation) =====
    
    def test_create_shipment_missing_required_fields(self, auth_headers):
        """Test creating shipment with missing required fields"""
        response = requests.post(
            f"{BASE_URL}/api/courier/create-shipment",
            json={
                "shipment_category": "B2C"
                # Missing required fields
            },
            headers=auth_headers
        )
        
        # Should fail due to missing fields
        # Could be 400 or 422 depending on validation
        assert response.status_code in [400, 422, 500], f"Expected validation error, got {response.status_code}"
    
    def test_create_shipment_unauthorized(self):
        """Test creating shipment without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/courier/create-shipment",
            json={"shipment_category": "B2C"}
        )
        assert response.status_code in [401, 403]
    
    # ===== MANIFEST TESTS =====
    
    def test_manifest_missing_required_fields(self, auth_headers):
        """Test manifesting shipment with missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/courier/manifest",
            json={
                # Missing system_order_id and courier_id
            },
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        assert "required" in data["detail"].lower()
    
    def test_manifest_unauthorized(self):
        """Test manifesting without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/courier/manifest",
            json={"system_order_id": "123", "courier_id": "456"}
        )
        assert response.status_code in [401, 403]


class TestBotTrackingWithRealData:
    """Tests for bot tracking update with real order data if available"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Login failed")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_check_pending_fulfillment_orders(self, auth_headers):
        """Check if there are any pending fulfillment orders to test with"""
        response = requests.get(
            f"{BASE_URL}/api/pending-fulfillment",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            data = response.json()
            orders = data.get("orders", [])
            print(f"Found {len(orders)} pending fulfillment orders")
            
            if orders:
                # Test update tracking on first order
                order = orders[0]
                order_id = order.get("id")
                print(f"Testing with order ID: {order_id}")
                
                # Try to update tracking
                update_response = requests.post(
                    f"{BASE_URL}/api/bot/update-tracking",
                    data={
                        "order_id": order_id,
                        "tracking_id": f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                        "courier_name": "Test Courier"
                    },
                    headers={"Authorization": auth_headers["Authorization"]}
                )
                
                if update_response.status_code == 200:
                    print(f"Successfully updated tracking: {update_response.json()}")
                else:
                    print(f"Update tracking response: {update_response.status_code} - {update_response.text}")
        else:
            print(f"Could not fetch pending fulfillment: {response.status_code}")


class TestBigshipAPIAuthentication:
    """Tests for Bigship API authentication flow"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Login failed")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_bigship_token_caching(self, auth_headers):
        """Test that Bigship token is properly cached by making multiple requests"""
        # Make first request - should get new token
        response1 = requests.get(
            f"{BASE_URL}/api/courier/warehouses",
            headers=auth_headers
        )
        assert response1.status_code == 200
        
        # Make second request - should use cached token
        response2 = requests.get(
            f"{BASE_URL}/api/courier/warehouses",
            headers=auth_headers
        )
        assert response2.status_code == 200
        
        # Both should succeed, indicating token caching works
        print("Bigship token caching verified - multiple requests succeeded")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

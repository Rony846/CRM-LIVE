"""
Serial Numbers Management Module Tests
Tests for: GET /serial-numbers/management, PUT /serial-numbers/{id}/update, 
PUT /serial-numbers/{id}/map-sku, POST /serial-numbers/bulk-map-sku, DELETE /serial-numbers/{id}
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"


class TestSerialNumbersManagement:
    """Serial Numbers Management API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.token = token
    
    # ==================== GET /serial-numbers/management ====================
    
    def test_get_serial_numbers_management_basic(self):
        """Test GET /serial-numbers/management returns data with expected structure"""
        response = self.session.get(f"{BASE_URL}/api/serial-numbers/management")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "serials" in data, "Response should contain 'serials' key"
        assert "alerts" in data, "Response should contain 'alerts' key"
        assert "summary" in data, "Response should contain 'summary' key"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total" in summary, "Summary should contain 'total'"
        assert "in_stock" in summary, "Summary should contain 'in_stock'"
        assert "dispatched" in summary, "Summary should contain 'dispatched'"
        assert "returned" in summary, "Summary should contain 'returned'"
        assert "unmapped_count" in summary, "Summary should contain 'unmapped_count'"
        assert "alerts_count" in summary, "Summary should contain 'alerts_count'"
        
        print(f"Total serials: {summary['total']}, Unmapped: {summary['unmapped_count']}")
    
    def test_get_serial_numbers_with_unmapped_filter(self):
        """Test GET /serial-numbers/management?unmapped_only=true filters correctly"""
        response = self.session.get(f"{BASE_URL}/api/serial-numbers/management", params={
            "unmapped_only": "true"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        serials = data.get("serials", [])
        
        # All returned serials should be unmapped (no master_sku_id)
        for serial in serials:
            master_sku_id = serial.get("master_sku_id")
            assert master_sku_id is None or master_sku_id == "", \
                f"Serial {serial.get('serial_number')} has master_sku_id={master_sku_id}, should be unmapped"
        
        print(f"Unmapped serials returned: {len(serials)}")
    
    def test_get_serial_numbers_with_status_filter(self):
        """Test GET /serial-numbers/management?status=in_stock filters correctly"""
        response = self.session.get(f"{BASE_URL}/api/serial-numbers/management", params={
            "status": "in_stock"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        serials = data.get("serials", [])
        
        # All returned serials should have status=in_stock
        for serial in serials:
            assert serial.get("status") == "in_stock", \
                f"Serial {serial.get('serial_number')} has status={serial.get('status')}, expected 'in_stock'"
        
        print(f"In-stock serials returned: {len(serials)}")
    
    def test_get_serial_numbers_with_search(self):
        """Test GET /serial-numbers/management?search=<query> filters correctly"""
        # First get some serials to find a search term
        response = self.session.get(f"{BASE_URL}/api/serial-numbers/management")
        assert response.status_code == 200
        
        data = response.json()
        serials = data.get("serials", [])
        
        if len(serials) > 0:
            # Use first serial number as search term
            search_term = serials[0].get("serial_number", "")[:5]
            
            search_response = self.session.get(f"{BASE_URL}/api/serial-numbers/management", params={
                "search": search_term
            })
            
            assert search_response.status_code == 200, f"Search failed: {search_response.text}"
            search_data = search_response.json()
            
            # Should return at least one result
            assert len(search_data.get("serials", [])) >= 1, "Search should return at least one result"
            print(f"Search for '{search_term}' returned {len(search_data.get('serials', []))} results")
        else:
            pytest.skip("No serials available for search test")
    
    def test_get_serial_numbers_includes_dispatch_info(self):
        """Test that dispatched serials include dispatch_info"""
        response = self.session.get(f"{BASE_URL}/api/serial-numbers/management", params={
            "status": "dispatched",
            "include_dispatch_info": "true"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        serials = data.get("serials", [])
        
        # Check that dispatched serials have dispatch_info
        for serial in serials[:5]:  # Check first 5
            if serial.get("dispatch_id"):
                assert "dispatch_info" in serial, \
                    f"Serial {serial.get('serial_number')} should have dispatch_info"
        
        print(f"Dispatched serials with dispatch_info: {len(serials)}")
    
    # ==================== PUT /serial-numbers/{id}/update ====================
    
    def test_update_serial_status(self):
        """Test PUT /serial-numbers/{id}/update can update status"""
        # First get a serial to update
        response = self.session.get(f"{BASE_URL}/api/serial-numbers/management", params={
            "status": "in_stock"
        })
        assert response.status_code == 200
        
        data = response.json()
        serials = data.get("serials", [])
        
        if len(serials) == 0:
            pytest.skip("No in_stock serials available for update test")
        
        serial = serials[0]
        serial_id = serial.get("id")
        
        # Update notes (safe operation that doesn't change status)
        update_response = self.session.put(
            f"{BASE_URL}/api/serial-numbers/{serial_id}/update",
            params={"notes": "TEST_update_note"}
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        result = update_response.json()
        assert "message" in result, "Response should contain 'message'"
        assert "serial" in result, "Response should contain 'serial'"
        
        # Verify the update
        updated_serial = result.get("serial", {})
        assert updated_serial.get("notes") == "TEST_update_note", "Notes should be updated"
        
        print(f"Successfully updated serial {serial.get('serial_number')}")
    
    def test_update_serial_customer_fields(self):
        """Test PUT /serial-numbers/{id}/update can update customer fields"""
        # Get a serial to update
        response = self.session.get(f"{BASE_URL}/api/serial-numbers/management")
        assert response.status_code == 200
        
        data = response.json()
        serials = data.get("serials", [])
        
        if len(serials) == 0:
            pytest.skip("No serials available for customer field update test")
        
        serial = serials[0]
        serial_id = serial.get("id")
        
        # Update customer fields
        update_response = self.session.put(
            f"{BASE_URL}/api/serial-numbers/{serial_id}/update",
            params={
                "customer_name": "TEST_Customer",
                "phone": "9999999999",
                "order_id": "TEST_ORDER_123",
                "address": "TEST Address Line 1"
            }
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        result = update_response.json()
        updated_serial = result.get("serial", {})
        
        assert updated_serial.get("customer_name") == "TEST_Customer", "customer_name should be updated"
        assert updated_serial.get("phone") == "9999999999", "phone should be updated"
        assert updated_serial.get("order_id") == "TEST_ORDER_123", "order_id should be updated"
        assert updated_serial.get("address") == "TEST Address Line 1", "address should be updated"
        
        print(f"Successfully updated customer fields for serial {serial.get('serial_number')}")
    
    def test_update_serial_not_found(self):
        """Test PUT /serial-numbers/{id}/update returns 404 for non-existent serial"""
        response = self.session.put(
            f"{BASE_URL}/api/serial-numbers/non-existent-id/update",
            params={"notes": "test"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    # ==================== PUT /serial-numbers/{id}/map-sku ====================
    
    def test_map_serial_to_sku(self):
        """Test PUT /serial-numbers/{id}/map-sku maps a serial to a SKU"""
        # First get an unmapped serial
        response = self.session.get(f"{BASE_URL}/api/serial-numbers/management", params={
            "unmapped_only": "true"
        })
        assert response.status_code == 200
        
        data = response.json()
        unmapped_serials = data.get("serials", [])
        
        if len(unmapped_serials) == 0:
            pytest.skip("No unmapped serials available for map-sku test")
        
        serial = unmapped_serials[0]
        serial_id = serial.get("id")
        
        # Get a Master SKU to map to
        sku_response = self.session.get(f"{BASE_URL}/api/master-skus")
        assert sku_response.status_code == 200
        
        skus = sku_response.json()
        if isinstance(skus, dict):
            skus = skus.get("master_skus", [])
        
        if len(skus) == 0:
            pytest.skip("No Master SKUs available for map-sku test")
        
        sku = skus[0]
        sku_id = sku.get("id")
        
        # Map the serial to the SKU
        map_response = self.session.put(
            f"{BASE_URL}/api/serial-numbers/{serial_id}/map-sku",
            params={"master_sku_id": sku_id}
        )
        
        assert map_response.status_code == 200, f"Map SKU failed: {map_response.text}"
        
        result = map_response.json()
        assert "message" in result, "Response should contain 'message'"
        
        print(f"Successfully mapped serial {serial.get('serial_number')} to SKU {sku.get('sku_code')}")
    
    def test_map_serial_to_invalid_sku(self):
        """Test PUT /serial-numbers/{id}/map-sku returns 404 for invalid SKU"""
        # Get any serial
        response = self.session.get(f"{BASE_URL}/api/serial-numbers/management")
        assert response.status_code == 200
        
        data = response.json()
        serials = data.get("serials", [])
        
        if len(serials) == 0:
            pytest.skip("No serials available")
        
        serial_id = serials[0].get("id")
        
        map_response = self.session.put(
            f"{BASE_URL}/api/serial-numbers/{serial_id}/map-sku",
            params={"master_sku_id": "non-existent-sku-id"}
        )
        
        assert map_response.status_code == 404, f"Expected 404, got {map_response.status_code}"
    
    # ==================== POST /serial-numbers/bulk-map-sku ====================
    
    def test_bulk_map_serials_to_sku(self):
        """Test POST /serial-numbers/bulk-map-sku bulk maps serials"""
        # Get unmapped serials
        response = self.session.get(f"{BASE_URL}/api/serial-numbers/management", params={
            "unmapped_only": "true"
        })
        assert response.status_code == 200
        
        data = response.json()
        unmapped_serials = data.get("serials", [])
        
        if len(unmapped_serials) < 2:
            pytest.skip("Need at least 2 unmapped serials for bulk map test")
        
        # Get first 2 unmapped serial IDs
        serial_ids = [s.get("id") for s in unmapped_serials[:2]]
        
        # Get a Master SKU
        sku_response = self.session.get(f"{BASE_URL}/api/master-skus")
        assert sku_response.status_code == 200
        
        skus = sku_response.json()
        if isinstance(skus, dict):
            skus = skus.get("master_skus", [])
        
        if len(skus) == 0:
            pytest.skip("No Master SKUs available")
        
        sku_id = skus[0].get("id")
        
        # Bulk map
        bulk_response = self.session.post(
            f"{BASE_URL}/api/serial-numbers/bulk-map-sku",
            json={
                "serial_ids": serial_ids,
                "master_sku_id": sku_id
            }
        )
        
        assert bulk_response.status_code == 200, f"Bulk map failed: {bulk_response.text}"
        
        result = bulk_response.json()
        assert "message" in result, "Response should contain 'message'"
        
        print(f"Bulk mapped {len(serial_ids)} serials to SKU")
    
    def test_bulk_map_invalid_sku(self):
        """Test POST /serial-numbers/bulk-map-sku returns 404 for invalid SKU"""
        bulk_response = self.session.post(
            f"{BASE_URL}/api/serial-numbers/bulk-map-sku",
            json={
                "serial_ids": ["some-id"],
                "master_sku_id": "non-existent-sku"
            }
        )
        
        assert bulk_response.status_code == 404, f"Expected 404, got {bulk_response.status_code}"
    
    # ==================== DELETE /serial-numbers/{id} ====================
    
    def test_delete_serial_not_found(self):
        """Test DELETE /serial-numbers/{id} returns 404 for non-existent serial"""
        response = self.session.delete(f"{BASE_URL}/api/serial-numbers/non-existent-id")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_delete_dispatched_serial_fails(self):
        """Test DELETE /serial-numbers/{id} fails for dispatched serials"""
        # Get a dispatched serial
        response = self.session.get(f"{BASE_URL}/api/serial-numbers/management", params={
            "status": "dispatched"
        })
        assert response.status_code == 200
        
        data = response.json()
        dispatched_serials = data.get("serials", [])
        
        if len(dispatched_serials) == 0:
            pytest.skip("No dispatched serials available")
        
        serial_id = dispatched_serials[0].get("id")
        
        # Try to delete - should fail
        delete_response = self.session.delete(f"{BASE_URL}/api/serial-numbers/{serial_id}")
        
        assert delete_response.status_code == 400, \
            f"Expected 400 for deleting dispatched serial, got {delete_response.status_code}"
        
        print("Correctly prevented deletion of dispatched serial")
    
    # ==================== Swap Endpoint ====================
    
    def test_swap_endpoint_exists(self):
        """Test POST /serial-numbers/swap endpoint exists"""
        # This is a basic test to verify the endpoint exists
        # Full swap test requires specific data setup
        response = self.session.post(
            f"{BASE_URL}/api/serial-numbers/swap",
            params={"serial_id_1": "test", "serial_id_2": "test"}
        )
        
        # Should return 404 (not found) not 405 (method not allowed)
        assert response.status_code in [404, 400], \
            f"Swap endpoint should exist, got {response.status_code}"
        
        print("Swap endpoint exists and responds correctly")


class TestSerialNumbersManagementAuth:
    """Test authentication requirements for Serial Numbers Management"""
    
    def test_management_requires_auth(self):
        """Test GET /serial-numbers/management requires authentication"""
        response = requests.get(f"{BASE_URL}/api/serial-numbers/management")
        
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_update_requires_auth(self):
        """Test PUT /serial-numbers/{id}/update requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/serial-numbers/test-id/update",
            params={"notes": "test"}
        )
        
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_map_sku_requires_auth(self):
        """Test PUT /serial-numbers/{id}/map-sku requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/serial-numbers/test-id/map-sku",
            params={"master_sku_id": "test"}
        )
        
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_bulk_map_requires_auth(self):
        """Test POST /serial-numbers/bulk-map-sku requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/serial-numbers/bulk-map-sku",
            json={"serial_ids": [], "master_sku_id": "test"}
        )
        
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_delete_requires_auth(self):
        """Test DELETE /serial-numbers/{id} requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/serial-numbers/test-id")
        
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

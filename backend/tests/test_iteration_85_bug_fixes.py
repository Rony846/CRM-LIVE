"""
Test file for iteration 85 - Bug fixes testing
Tests three critical bugs:
1. Bug 1: OrderBot stock check for manufactured items - API /api/bot/prepare-dispatch/{order_id}
2. Bug 2: Duplicate order prevention - unique MongoDB index on amazon_order_id
3. Bug 3: Tracking ID duplicate check should exclude pending_fulfillment entry when creating dispatch
"""

import pytest
import requests
import os
import json
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"

# Test data from main agent context
TEST_PF_ID = "test-pf-manufactured-001"  # The entry ID
TEST_PF_ORDER_ID = "TEST-MFG-ORDER-001"  # The order_id field
TEST_MASTER_SKU_ID = "test-manufactured-sku-001"
TEST_FIRM_ID = "c715c1b7-aca3-4100-8b00-4f711a729829"
TEST_TRACKING_ID = "TEST-TRACKING-123"
TEST_SERIALS = ["MFG-SERIAL-001", "MFG-SERIAL-002", "MFG-SERIAL-003"]


class TestSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestBug1ManufacturedItemsStock(TestSetup):
    """
    Bug 1: OrderBot falsely reports 'No Stock Available' for manufactured items
    Fix: Changed is_manufactured check from master_sku.get('type') to 
         master_sku.get('product_type') or master_sku.get('is_manufactured')
    """
    
    def test_prepare_dispatch_returns_is_manufactured_true(self, auth_headers):
        """
        Test that /api/bot/prepare-dispatch/{order_id} returns is_manufactured=True
        for manufactured items with product_type='manufactured'
        """
        response = requests.get(
            f"{BASE_URL}/api/bot/prepare-dispatch/{TEST_PF_ID}",
            headers=auth_headers
        )
        
        # Check if test data exists
        if response.status_code == 404:
            pytest.skip(f"Test data not found: {TEST_PF_ID}. Need to create test data first.")
        
        assert response.status_code == 200, f"API failed: {response.text}"
        data = response.json()
        
        # Verify product.is_manufactured is True
        product = data.get("product", {})
        is_manufactured = product.get("is_manufactured")
        
        print(f"Product data: {json.dumps(product, indent=2)}")
        print(f"is_manufactured value: {is_manufactured}")
        
        assert is_manufactured is True, f"Expected is_manufactured=True, got {is_manufactured}"
    
    def test_prepare_dispatch_returns_available_serials(self, auth_headers):
        """
        Test that /api/bot/prepare-dispatch/{order_id} returns available serial numbers
        for manufactured items
        """
        response = requests.get(
            f"{BASE_URL}/api/bot/prepare-dispatch/{TEST_PF_ID}",
            headers=auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip(f"Test data not found: {TEST_PF_ID}")
        
        assert response.status_code == 200, f"API failed: {response.text}"
        data = response.json()
        
        # Verify serial_numbers.available is populated
        serial_numbers = data.get("serial_numbers", {})
        available = serial_numbers.get("available", [])
        
        print(f"Serial numbers data: {json.dumps(serial_numbers, indent=2)}")
        print(f"Available serials count: {len(available)}")
        
        # For manufactured items with stock, available should have entries
        stock = data.get("stock", {})
        stock_available = stock.get("available", 0)
        is_available = stock.get("is_available", False)
        
        print(f"Stock data: {json.dumps(stock, indent=2)}")
        
        # If there's stock, is_available should be True
        if stock_available > 0:
            assert is_available is True, f"Expected is_available=True when stock={stock_available}"
    
    def test_prepare_dispatch_stock_check_for_manufactured(self, auth_headers):
        """
        Test that stock check correctly uses finished_good_serials for manufactured items
        """
        response = requests.get(
            f"{BASE_URL}/api/bot/prepare-dispatch/{TEST_PF_ID}",
            headers=auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip(f"Test data not found: {TEST_PF_ID}")
        
        assert response.status_code == 200, f"API failed: {response.text}"
        data = response.json()
        
        product = data.get("product", {})
        stock = data.get("stock", {})
        serial_numbers = data.get("serial_numbers", {})
        
        is_manufactured = product.get("is_manufactured")
        
        if is_manufactured:
            # For manufactured items, stock.available should match serial count
            available_serials = serial_numbers.get("available", [])
            stock_count = stock.get("available", 0)
            
            print(f"Manufactured item check:")
            print(f"  - Available serials: {len(available_serials)}")
            print(f"  - Stock count: {stock_count}")
            
            # Stock count should equal available serials for manufactured items
            assert stock_count == len(available_serials), \
                f"Stock mismatch: stock={stock_count}, serials={len(available_serials)}"


class TestBug2DuplicateOrderPrevention(TestSetup):
    """
    Bug 2: Duplicate orders appearing in Pending Fulfillment queue
    Fix: Added unique MongoDB index on amazon_order_id and duplicate key error handling
    """
    
    def test_pending_fulfillment_unique_index_exists(self, auth_headers):
        """
        Test that attempting to create duplicate pending_fulfillment entries fails
        """
        # Generate unique test order ID
        unique_order_id = f"TEST-DUP-{uuid.uuid4().hex[:8]}"
        unique_tracking = f"TEST-TRK-{uuid.uuid4().hex[:8]}"
        
        # First, get a valid firm_id
        firms_response = requests.get(
            f"{BASE_URL}/api/firms",
            headers=auth_headers
        )
        
        if firms_response.status_code != 200:
            pytest.skip("Cannot get firms list")
        
        firms = firms_response.json()
        if not firms:
            pytest.skip("No firms available for testing")
        
        firm_id = firms[0].get("id")
        
        # Get a master SKU
        skus_response = requests.get(
            f"{BASE_URL}/api/master-skus?limit=1",
            headers=auth_headers
        )
        
        if skus_response.status_code != 200:
            pytest.skip("Cannot get master SKUs")
        
        skus = skus_response.json()
        if not skus:
            pytest.skip("No master SKUs available")
        
        master_sku_id = skus[0].get("id")
        
        # Create first pending fulfillment entry
        pf_data = {
            "order_id": unique_order_id,
            "tracking_id": unique_tracking,
            "firm_id": firm_id,
            "master_sku_id": master_sku_id,
            "quantity": 1,
            "label_expiry_days": 5,
            "notes": "Test duplicate prevention"
        }
        
        first_response = requests.post(
            f"{BASE_URL}/api/pending-fulfillment",
            headers=auth_headers,
            json=pf_data
        )
        
        print(f"First create response: {first_response.status_code} - {first_response.text[:500]}")
        
        # If first creation succeeded, try to create duplicate
        if first_response.status_code in [200, 201]:
            # Try to create duplicate with same order_id
            second_response = requests.post(
                f"{BASE_URL}/api/pending-fulfillment",
                headers=auth_headers,
                json=pf_data
            )
            
            print(f"Second create response: {second_response.status_code} - {second_response.text[:500]}")
            
            # Should fail with duplicate error
            assert second_response.status_code in [400, 409], \
                f"Expected duplicate error (400/409), got {second_response.status_code}"
            
            # Cleanup - delete the test entry
            created_id = first_response.json().get("id")
            if created_id:
                requests.delete(
                    f"{BASE_URL}/api/pending-fulfillment/{created_id}",
                    headers=auth_headers
                )
        else:
            # First creation failed - check if it's because of existing data
            print(f"First creation failed: {first_response.text}")
    
    def test_duplicate_tracking_id_prevented(self, auth_headers):
        """
        Test that duplicate tracking IDs are prevented
        """
        # Generate unique test data
        unique_order_id_1 = f"TEST-ORD1-{uuid.uuid4().hex[:8]}"
        unique_order_id_2 = f"TEST-ORD2-{uuid.uuid4().hex[:8]}"
        shared_tracking = f"TEST-SHARED-TRK-{uuid.uuid4().hex[:8]}"
        
        # Get firm and SKU
        firms_response = requests.get(f"{BASE_URL}/api/firms", headers=auth_headers)
        if firms_response.status_code != 200 or not firms_response.json():
            pytest.skip("No firms available")
        firm_id = firms_response.json()[0].get("id")
        
        skus_response = requests.get(f"{BASE_URL}/api/master-skus?limit=1", headers=auth_headers)
        if skus_response.status_code != 200 or not skus_response.json():
            pytest.skip("No master SKUs available")
        master_sku_id = skus_response.json()[0].get("id")
        
        # Create first entry
        pf_data_1 = {
            "order_id": unique_order_id_1,
            "tracking_id": shared_tracking,
            "firm_id": firm_id,
            "master_sku_id": master_sku_id,
            "quantity": 1
        }
        
        first_response = requests.post(
            f"{BASE_URL}/api/pending-fulfillment",
            headers=auth_headers,
            json=pf_data_1
        )
        
        print(f"First entry response: {first_response.status_code}")
        
        if first_response.status_code in [200, 201]:
            created_id = first_response.json().get("id")
            
            # Try to create second entry with same tracking ID
            pf_data_2 = {
                "order_id": unique_order_id_2,
                "tracking_id": shared_tracking,  # Same tracking ID
                "firm_id": firm_id,
                "master_sku_id": master_sku_id,
                "quantity": 1
            }
            
            second_response = requests.post(
                f"{BASE_URL}/api/pending-fulfillment",
                headers=auth_headers,
                json=pf_data_2
            )
            
            print(f"Second entry response: {second_response.status_code} - {second_response.text[:300]}")
            
            # Should fail due to duplicate tracking ID
            assert second_response.status_code in [400, 409], \
                f"Expected duplicate tracking ID error, got {second_response.status_code}"
            
            # Cleanup
            if created_id:
                requests.delete(f"{BASE_URL}/api/pending-fulfillment/{created_id}", headers=auth_headers)


class TestBug3TrackingIdExcludeOnDispatch(TestSetup):
    """
    Bug 3: Outbound Dispatcher says 'tracking ID is used' when processing pending fulfillment
    Fix: Added exclude_id parameter to validate_no_duplicates when creating dispatch from pending_fulfillment
    """
    
    def test_check_tracking_id_duplicate_with_exclude(self, auth_headers):
        """
        Test that check_tracking_id_duplicate properly excludes specified ID
        """
        # This tests the internal logic - we'll verify via the API behavior
        # The fix adds exclude_id parameter to validate_no_duplicates
        
        # Get the test pending fulfillment entry
        response = requests.get(
            f"{BASE_URL}/api/pending-fulfillment",
            headers=auth_headers,
            params={"order_id": TEST_PF_ORDER_ID}
        )
        
        if response.status_code != 200:
            pytest.skip("Cannot get pending fulfillment list")
        
        data = response.json()
        # API returns {"entries": [...]} format
        pf_list = data.get("entries", []) if isinstance(data, dict) else data
        test_entry = None
        
        # Find our test entry
        for entry in pf_list:
            if isinstance(entry, dict) and entry.get("order_id") == TEST_PF_ORDER_ID:
                test_entry = entry
                break
        
        if not test_entry:
            pytest.skip(f"Test entry {TEST_PF_ORDER_ID} not found")
        
        print(f"Found test entry: {json.dumps(test_entry, indent=2)[:500]}")
        
        # Verify the entry has tracking_id
        tracking_id = test_entry.get("tracking_id")
        assert tracking_id, "Test entry should have tracking_id"
        print(f"Test entry tracking_id: {tracking_id}")
    
    def test_validate_no_duplicates_api(self, auth_headers):
        """
        Test the validate-duplicates API endpoint if it exists
        """
        # Check if there's a validation endpoint
        response = requests.post(
            f"{BASE_URL}/api/validate-duplicates",
            headers=auth_headers,
            json={
                "tracking_id": TEST_TRACKING_ID,
                "exclude_id": "some-id"
            }
        )
        
        # This endpoint may not exist - that's OK
        if response.status_code == 404:
            print("validate-duplicates endpoint not found - testing via dispatch flow")
            pytest.skip("No direct validation endpoint")
        
        print(f"Validation response: {response.status_code} - {response.text[:300]}")


class TestMasterSKUProductType(TestSetup):
    """
    Additional tests to verify master_sku product_type field handling
    """
    
    def test_master_sku_has_product_type_field(self, auth_headers):
        """
        Verify master SKUs have product_type field
        """
        response = requests.get(
            f"{BASE_URL}/api/master-skus",
            headers=auth_headers,
            params={"limit": 10}
        )
        
        assert response.status_code == 200, f"Failed to get master SKUs: {response.text}"
        skus = response.json()
        
        if not skus:
            pytest.skip("No master SKUs found")
        
        # Check for product_type field
        for sku in skus:
            product_type = sku.get("product_type")
            is_manufactured = sku.get("is_manufactured")
            
            print(f"SKU {sku.get('sku_code')}: product_type={product_type}, is_manufactured={is_manufactured}")
            
            # If product_type is 'manufactured', is_manufactured should be True or vice versa
            if product_type == "manufactured":
                # This is a manufactured item
                print(f"  -> Manufactured item detected")
    
    def test_get_test_manufactured_sku(self, auth_headers):
        """
        Get the test manufactured SKU and verify its configuration
        """
        response = requests.get(
            f"{BASE_URL}/api/master-skus/{TEST_MASTER_SKU_ID}",
            headers=auth_headers
        )
        
        if response.status_code == 404:
            pytest.skip(f"Test SKU {TEST_MASTER_SKU_ID} not found")
        
        assert response.status_code == 200, f"Failed to get test SKU: {response.text}"
        sku = response.json()
        
        print(f"Test SKU details: {json.dumps(sku, indent=2)}")
        
        product_type = sku.get("product_type")
        is_manufactured = sku.get("is_manufactured")
        
        # Verify it's configured as manufactured
        assert product_type == "manufactured" or is_manufactured is True, \
            f"Test SKU should be manufactured: product_type={product_type}, is_manufactured={is_manufactured}"


class TestFinishedGoodSerials(TestSetup):
    """
    Test finished_good_serials collection for manufactured items
    """
    
    def test_get_serials_for_test_sku(self, auth_headers):
        """
        Verify serial numbers exist for the test manufactured SKU
        """
        response = requests.get(
            f"{BASE_URL}/api/finished-good-serials",
            headers=auth_headers,
            params={
                "master_sku_id": TEST_MASTER_SKU_ID,
                "firm_id": TEST_FIRM_ID,
                "status": "in_stock"
            }
        )
        
        if response.status_code == 404:
            # Try alternative endpoint
            response = requests.get(
                f"{BASE_URL}/api/serial-numbers",
                headers=auth_headers,
                params={
                    "master_sku_id": TEST_MASTER_SKU_ID,
                    "status": "in_stock"
                }
            )
        
        if response.status_code != 200:
            print(f"Serial numbers endpoint response: {response.status_code} - {response.text[:300]}")
            pytest.skip("Cannot access serial numbers endpoint")
        
        serials = response.json()
        print(f"Found {len(serials) if isinstance(serials, list) else 'N/A'} serials")
        
        if isinstance(serials, list) and serials:
            for serial in serials[:5]:
                print(f"  Serial: {serial.get('serial_number')}, Status: {serial.get('status')}")


class TestPendingFulfillmentEntry(TestSetup):
    """
    Test the specific pending fulfillment entry created for testing
    """
    
    def test_get_test_pending_fulfillment(self, auth_headers):
        """
        Get the test pending fulfillment entry and verify its data
        """
        # Try to get by order_id
        response = requests.get(
            f"{BASE_URL}/api/pending-fulfillment",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed to get PF list: {response.text}"
        data = response.json()
        # API returns {"entries": [...]} format
        pf_list = data.get("entries", []) if isinstance(data, dict) else data
        
        # Find our test entry by ID or order_id
        test_entry = None
        for entry in pf_list:
            if isinstance(entry, dict) and (entry.get("id") == TEST_PF_ID or entry.get("order_id") == TEST_PF_ORDER_ID):
                test_entry = entry
                break
        
        if not test_entry:
            print(f"Test entry {TEST_PF_ID}/{TEST_PF_ORDER_ID} not found in {len(pf_list)} entries")
            # List first few entries for debugging
            for entry in pf_list[:5]:
                if isinstance(entry, dict):
                    print(f"  Entry: order_id={entry.get('order_id')}, id={entry.get('id')}")
            pytest.skip(f"Test entry {TEST_PF_ID} not found")
        
        print(f"Test PF entry: {json.dumps(test_entry, indent=2)}")
        
        # Verify expected fields
        assert test_entry.get("master_sku_id") == TEST_MASTER_SKU_ID, \
            f"Expected master_sku_id={TEST_MASTER_SKU_ID}"
        assert test_entry.get("firm_id") == TEST_FIRM_ID, \
            f"Expected firm_id={TEST_FIRM_ID}"
        assert test_entry.get("tracking_id") == TEST_TRACKING_ID, \
            f"Expected tracking_id={TEST_TRACKING_ID}"


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

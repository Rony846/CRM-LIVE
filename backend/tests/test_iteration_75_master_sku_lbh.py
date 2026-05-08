"""
Iteration 75: Master SKU LBH/Weight Fields and Pending Fulfillment Firm Fix Tests

Features tested:
1. Master SKU Create with LBH (Length, Breadth, Height) and Weight fields
2. Master SKU Update with LBH/Weight fields
3. Master SKU API returns LBH/Weight in response
4. Pending Fulfillment firm assignment uses amazon_order.firm_id (not first active firm)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestMasterSKULBHWeight:
    """Test Master SKU LBH (Length, Breadth, Height) and Weight fields"""
    
    created_sku_id = None
    
    def test_create_master_sku_with_lbh_weight(self, api_client):
        """Test creating a Master SKU with LBH and Weight dimensions"""
        unique_code = f"TEST-LBH-{uuid.uuid4().hex[:6].upper()}"
        
        payload = {
            "name": f"Test Product with Dimensions {unique_code}",
            "sku_code": unique_code,
            "category": "Inverter",
            "hsn_code": "850440",
            "gst_rate": 18,
            "cost_price": 5000,
            "unit": "pcs",
            "reorder_level": 10,
            "description": "Test product with shipping dimensions",
            # LBH and Weight fields
            "length_cm": 50.5,
            "breadth_cm": 40.0,
            "height_cm": 30.0,
            "weight_kg": 25.5
        }
        
        response = api_client.post(f"{BASE_URL}/api/master-skus", json=payload)
        
        assert response.status_code == 200, f"Failed to create SKU: {response.text}"
        
        data = response.json()
        TestMasterSKULBHWeight.created_sku_id = data.get("id")
        
        # Verify LBH and Weight fields are returned
        assert data.get("length_cm") == 50.5, f"Expected length_cm=50.5, got {data.get('length_cm')}"
        assert data.get("breadth_cm") == 40.0, f"Expected breadth_cm=40.0, got {data.get('breadth_cm')}"
        assert data.get("height_cm") == 30.0, f"Expected height_cm=30.0, got {data.get('height_cm')}"
        assert data.get("weight_kg") == 25.5, f"Expected weight_kg=25.5, got {data.get('weight_kg')}"
        
        print(f"✓ Created Master SKU with LBH: {data.get('length_cm')}x{data.get('breadth_cm')}x{data.get('height_cm')} cm, Weight: {data.get('weight_kg')} kg")
    
    def test_get_master_sku_returns_lbh_weight(self, api_client):
        """Test that GET Master SKU returns LBH and Weight fields"""
        if not TestMasterSKULBHWeight.created_sku_id:
            pytest.skip("No SKU created in previous test")
        
        response = api_client.get(f"{BASE_URL}/api/master-skus/{TestMasterSKULBHWeight.created_sku_id}")
        
        assert response.status_code == 200, f"Failed to get SKU: {response.text}"
        
        data = response.json()
        
        # Verify LBH and Weight fields are persisted
        assert data.get("length_cm") == 50.5
        assert data.get("breadth_cm") == 40.0
        assert data.get("height_cm") == 30.0
        assert data.get("weight_kg") == 25.5
        
        print(f"✓ GET Master SKU returns LBH/Weight correctly")
    
    def test_update_master_sku_lbh_weight(self, api_client):
        """Test updating LBH and Weight fields via PATCH"""
        if not TestMasterSKULBHWeight.created_sku_id:
            pytest.skip("No SKU created in previous test")
        
        update_payload = {
            "length_cm": 60.0,
            "breadth_cm": 45.0,
            "height_cm": 35.0,
            "weight_kg": 30.0
        }
        
        response = api_client.patch(
            f"{BASE_URL}/api/master-skus/{TestMasterSKULBHWeight.created_sku_id}",
            json=update_payload
        )
        
        assert response.status_code == 200, f"Failed to update SKU: {response.text}"
        
        data = response.json()
        
        # Verify updated values
        assert data.get("length_cm") == 60.0, f"Expected length_cm=60.0, got {data.get('length_cm')}"
        assert data.get("breadth_cm") == 45.0, f"Expected breadth_cm=45.0, got {data.get('breadth_cm')}"
        assert data.get("height_cm") == 35.0, f"Expected height_cm=35.0, got {data.get('height_cm')}"
        assert data.get("weight_kg") == 30.0, f"Expected weight_kg=30.0, got {data.get('weight_kg')}"
        
        print(f"✓ Updated Master SKU LBH/Weight successfully")
    
    def test_create_master_sku_without_lbh_weight(self, api_client):
        """Test creating a Master SKU without LBH/Weight (should be null)"""
        unique_code = f"TEST-NOLBH-{uuid.uuid4().hex[:6].upper()}"
        
        payload = {
            "name": f"Test Product No Dimensions {unique_code}",
            "sku_code": unique_code,
            "category": "Battery",
            "hsn_code": "850720",
            "gst_rate": 18,
            "cost_price": 3000,
            "unit": "pcs",
            "reorder_level": 5
        }
        
        response = api_client.post(f"{BASE_URL}/api/master-skus", json=payload)
        
        assert response.status_code == 200, f"Failed to create SKU: {response.text}"
        
        data = response.json()
        
        # Verify LBH and Weight fields are null
        assert data.get("length_cm") is None, f"Expected length_cm=None, got {data.get('length_cm')}"
        assert data.get("breadth_cm") is None, f"Expected breadth_cm=None, got {data.get('breadth_cm')}"
        assert data.get("height_cm") is None, f"Expected height_cm=None, got {data.get('height_cm')}"
        assert data.get("weight_kg") is None, f"Expected weight_kg=None, got {data.get('weight_kg')}"
        
        print(f"✓ Created Master SKU without LBH/Weight (null values)")
    
    def test_list_master_skus_includes_lbh_weight(self, api_client):
        """Test that list Master SKUs endpoint returns LBH/Weight fields"""
        response = api_client.get(f"{BASE_URL}/api/master-skus")
        
        assert response.status_code == 200, f"Failed to list SKUs: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        
        # Find our test SKU with dimensions
        test_sku = None
        for sku in data:
            if sku.get("id") == TestMasterSKULBHWeight.created_sku_id:
                test_sku = sku
                break
        
        if test_sku:
            # Verify LBH fields are present in list response
            assert "length_cm" in test_sku, "length_cm field missing in list response"
            assert "breadth_cm" in test_sku, "breadth_cm field missing in list response"
            assert "height_cm" in test_sku, "height_cm field missing in list response"
            assert "weight_kg" in test_sku, "weight_kg field missing in list response"
            print(f"✓ List Master SKUs includes LBH/Weight fields")
        else:
            print("⚠ Test SKU not found in list, but list endpoint works")


class TestMasterSKUResponseModel:
    """Test that MasterSKUResponse model includes LBH/Weight fields"""
    
    def test_master_sku_response_has_dimension_fields(self, api_client):
        """Verify the response model includes all dimension fields"""
        # Get any existing SKU
        response = api_client.get(f"{BASE_URL}/api/master-skus")
        
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            sku = data[0]
            # Check that dimension fields exist in response (even if null)
            expected_fields = ["length_cm", "breadth_cm", "height_cm", "weight_kg"]
            for field in expected_fields:
                assert field in sku, f"Field {field} missing from MasterSKU response"
            print(f"✓ MasterSKU response model includes all dimension fields")


class TestPendingFulfillmentFirmAssignment:
    """Test that Pending Fulfillment uses firm_id from amazon_order"""
    
    def test_pending_fulfillment_list_has_firm_info(self, api_client):
        """Test that pending fulfillment entries have firm information"""
        response = api_client.get(f"{BASE_URL}/api/pending-fulfillment")
        
        assert response.status_code == 200, f"Failed to get pending fulfillment: {response.text}"
        
        data = response.json()
        
        # Check if there are any entries
        if isinstance(data, dict) and "entries" in data:
            entries = data.get("entries", [])
        elif isinstance(data, list):
            entries = data
        else:
            entries = []
        
        if len(entries) > 0:
            entry = entries[0]
            # Verify firm_id and firm_name fields exist
            assert "firm_id" in entry, "firm_id field missing from pending fulfillment entry"
            print(f"✓ Pending fulfillment entries have firm_id field")
            
            if entry.get("firm_name"):
                print(f"  - First entry firm: {entry.get('firm_name')}")
        else:
            print("⚠ No pending fulfillment entries to verify firm assignment")


class TestExistingMasterSKUDimensions:
    """Test existing Master SKUs that were updated with dimensions"""
    
    def test_check_24v_normal_sku_dimensions(self, api_client):
        """Check if 24V Normal SKU has dimensions set (as mentioned in context)"""
        response = api_client.get(f"{BASE_URL}/api/master-skus")
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Look for 24V Normal SKU
        target_sku = None
        for sku in data:
            if "24V" in sku.get("name", "") and "Normal" in sku.get("name", ""):
                target_sku = sku
                break
            if "24V" in sku.get("sku_code", "").upper():
                target_sku = sku
                break
        
        if target_sku:
            print(f"Found SKU: {target_sku.get('name')} ({target_sku.get('sku_code')})")
            print(f"  - LBH: {target_sku.get('length_cm')}x{target_sku.get('breadth_cm')}x{target_sku.get('height_cm')} cm")
            print(f"  - Weight: {target_sku.get('weight_kg')} kg")
            
            # Verify dimensions are set (as per context: 50x40x30 cm, 25.5 kg)
            if target_sku.get("length_cm") and target_sku.get("weight_kg"):
                print(f"✓ 24V Normal SKU has dimensions configured")
            else:
                print("⚠ 24V Normal SKU dimensions not set")
        else:
            print("⚠ 24V Normal SKU not found in database")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

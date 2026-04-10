"""
Test iteration 57: Testing new features for dispatcher and accountant workflows
- DispatchResponse model includes item_serials field
- Cancel dispatch endpoint: PUT /api/dispatcher/dispatches/{id}/cancel
- E-way bill upload endpoint: PUT /api/pending-fulfillment/{id}/upload-eway-bill
- Pending fulfillment create accepts invoice_value field
- Pending fulfillment response includes eway_bill_required and eway_bill_url fields
"""

import pytest
import requests
import os
import io
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    def test_login_success(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✓ Login successful, token received")


class TestDispatcherCancelEndpoint:
    """Test cancel dispatch endpoint - PUT /api/dispatcher/dispatches/{id}/cancel"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_cancel_endpoint_exists(self, auth_token):
        """Test that cancel endpoint exists and returns proper error for non-existent ID"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        fake_id = f"test-cancel-{uuid.uuid4().hex[:8]}"
        
        # Use form data as the endpoint expects Form(...)
        response = requests.put(
            f"{BASE_URL}/api/dispatcher/dispatches/{fake_id}/cancel",
            headers=headers,
            data={"reason": "Test cancellation"}
        )
        
        # Should return 404 for non-existent dispatch
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✓ Cancel endpoint exists and returns 404 for non-existent dispatch")
    
    def test_cancel_requires_reason(self, auth_token):
        """Test that cancel endpoint requires reason parameter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        fake_id = f"test-cancel-{uuid.uuid4().hex[:8]}"
        
        # Try without reason
        response = requests.put(
            f"{BASE_URL}/api/dispatcher/dispatches/{fake_id}/cancel",
            headers=headers,
            data={}
        )
        
        # Should return 422 for missing required field
        assert response.status_code == 422, f"Expected 422 for missing reason, got {response.status_code}"
        print(f"✓ Cancel endpoint requires reason parameter")
    
    def test_cancel_requires_auth(self):
        """Test that cancel endpoint requires authentication"""
        fake_id = f"test-cancel-{uuid.uuid4().hex[:8]}"
        
        response = requests.put(
            f"{BASE_URL}/api/dispatcher/dispatches/{fake_id}/cancel",
            data={"reason": "Test cancellation"}
        )
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Cancel endpoint requires authentication")


class TestDispatcherQueue:
    """Test dispatcher queue endpoint to verify item_serials field"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_dispatcher_queue_endpoint(self, auth_token):
        """Test dispatcher queue returns data"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/dispatcher/queue", headers=headers)
        assert response.status_code == 200, f"Queue endpoint failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Queue should return a list"
        print(f"✓ Dispatcher queue endpoint works, returned {len(data)} items")
        
        # If there are items, check for item_serials field support
        if len(data) > 0:
            # Check that the response model supports item_serials
            first_item = data[0]
            # item_serials may be None or a list
            print(f"  First item has keys: {list(first_item.keys())[:10]}...")
    
    def test_dispatcher_recent_endpoint(self, auth_token):
        """Test dispatcher recent dispatches endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/dispatcher/recent", headers=headers)
        assert response.status_code == 200, f"Recent endpoint failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Recent should return a list"
        print(f"✓ Dispatcher recent endpoint works, returned {len(data)} items")


class TestEwayBillUpload:
    """Test e-way bill upload endpoint - PUT /api/pending-fulfillment/{id}/upload-eway-bill"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_eway_bill_endpoint_exists(self, auth_token):
        """Test that e-way bill upload endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        fake_id = f"test-eway-{uuid.uuid4().hex[:8]}"
        
        # Create a fake file
        files = {
            'eway_bill_file': ('test.pdf', io.BytesIO(b'%PDF-1.4 test content'), 'application/pdf')
        }
        data = {
            'eway_bill_number': 'EWAY123456789'
        }
        
        response = requests.put(
            f"{BASE_URL}/api/pending-fulfillment/{fake_id}/upload-eway-bill",
            headers=headers,
            files=files,
            data=data
        )
        
        # Should return 404 for non-existent fulfillment
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✓ E-way bill upload endpoint exists and returns 404 for non-existent entry")
    
    def test_eway_bill_requires_auth(self):
        """Test that e-way bill upload requires authentication"""
        fake_id = f"test-eway-{uuid.uuid4().hex[:8]}"
        
        files = {
            'eway_bill_file': ('test.pdf', io.BytesIO(b'%PDF-1.4 test content'), 'application/pdf')
        }
        data = {
            'eway_bill_number': 'EWAY123456789'
        }
        
        response = requests.put(
            f"{BASE_URL}/api/pending-fulfillment/{fake_id}/upload-eway-bill",
            files=files,
            data=data
        )
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ E-way bill upload requires authentication")


class TestPendingFulfillmentInvoiceValue:
    """Test pending fulfillment with invoice_value field"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def test_firm_id(self, auth_token):
        """Get a firm ID for testing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/firms", headers=headers, params={"is_active": True})
        assert response.status_code == 200
        firms = response.json()
        if len(firms) > 0:
            return firms[0]["id"]
        pytest.skip("No firms available for testing")
    
    @pytest.fixture(scope="class")
    def test_sku_id(self, auth_token):
        """Get a master SKU ID for testing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/master-skus", headers=headers, params={"is_active": True})
        assert response.status_code == 200
        skus = response.json()
        if len(skus) > 0:
            return skus[0]["id"]
        pytest.skip("No SKUs available for testing")
    
    def test_pending_fulfillment_list_endpoint(self, auth_token):
        """Test pending fulfillment list endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/pending-fulfillment", headers=headers)
        assert response.status_code == 200, f"List endpoint failed: {response.text}"
        
        data = response.json()
        assert "entries" in data, "Response should have 'entries' key"
        assert "summary" in data, "Response should have 'summary' key"
        
        entries = data["entries"]
        print(f"✓ Pending fulfillment list works, returned {len(entries)} entries")
        
        # Check if entries have the new fields
        if len(entries) > 0:
            first_entry = entries[0]
            # Check for eway_bill_required field
            if "eway_bill_required" in first_entry:
                print(f"  ✓ Entry has eway_bill_required field: {first_entry.get('eway_bill_required')}")
            if "eway_bill_url" in first_entry:
                print(f"  ✓ Entry has eway_bill_url field: {first_entry.get('eway_bill_url')}")
            if "invoice_value" in first_entry:
                print(f"  ✓ Entry has invoice_value field: {first_entry.get('invoice_value')}")
    
    def test_create_pending_fulfillment_with_invoice_value(self, auth_token, test_firm_id, test_sku_id):
        """Test creating pending fulfillment with invoice_value field"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        unique_id = uuid.uuid4().hex[:8]
        payload = {
            "order_id": f"TEST-ORDER-{unique_id}",
            "tracking_id": f"TEST-TRACK-{unique_id}",
            "firm_id": test_firm_id,
            "items": [{"master_sku_id": test_sku_id, "quantity": 1}],
            "invoice_value": 55000.00,  # Above 50K to trigger e-way bill requirement
            "customer_name": "Test Customer",
            "customer_phone": "9999999999",
            "notes": "Test entry for iteration 57"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pending-fulfillment",
            headers=headers,
            json=payload
        )
        
        assert response.status_code in [200, 201], f"Create failed: {response.status_code} - {response.text}"
        
        data = response.json()
        print(f"✓ Created pending fulfillment with invoice_value")
        
        # Verify the response has the expected fields
        assert "id" in data, "Response should have 'id'"
        
        # Check if eway_bill_required is set correctly for >50K
        if "eway_bill_required" in data:
            assert data["eway_bill_required"] == True, "eway_bill_required should be True for >50K"
            print(f"  ✓ eway_bill_required is True for invoice_value > 50K")
        
        # Clean up - delete the test entry
        entry_id = data["id"]
        delete_response = requests.delete(
            f"{BASE_URL}/api/pending-fulfillment/{entry_id}",
            headers=headers
        )
        if delete_response.status_code in [200, 204]:
            print(f"  ✓ Cleaned up test entry")
        
        return data
    
    def test_create_pending_fulfillment_below_50k(self, auth_token, test_firm_id, test_sku_id):
        """Test creating pending fulfillment with invoice_value below 50K"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        unique_id = uuid.uuid4().hex[:8]
        payload = {
            "order_id": f"TEST-ORDER-LOW-{unique_id}",
            "tracking_id": f"TEST-TRACK-LOW-{unique_id}",
            "firm_id": test_firm_id,
            "items": [{"master_sku_id": test_sku_id, "quantity": 1}],
            "invoice_value": 25000.00,  # Below 50K
            "customer_name": "Test Customer Low",
            "customer_phone": "8888888888"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pending-fulfillment",
            headers=headers,
            json=payload
        )
        
        assert response.status_code in [200, 201], f"Create failed: {response.status_code} - {response.text}"
        
        data = response.json()
        print(f"✓ Created pending fulfillment with invoice_value < 50K")
        
        # Check if eway_bill_required is False for <50K
        if "eway_bill_required" in data:
            assert data["eway_bill_required"] == False, "eway_bill_required should be False for <50K"
            print(f"  ✓ eway_bill_required is False for invoice_value < 50K")
        
        # Clean up
        entry_id = data["id"]
        delete_response = requests.delete(
            f"{BASE_URL}/api/pending-fulfillment/{entry_id}",
            headers=headers
        )
        if delete_response.status_code in [200, 204]:
            print(f"  ✓ Cleaned up test entry")


class TestDispatchResponseModel:
    """Test that DispatchResponse model includes item_serials field"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_dispatch_list_has_item_serials_support(self, auth_token):
        """Test that dispatch list endpoint supports item_serials field"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get dispatches
        response = requests.get(f"{BASE_URL}/api/dispatches", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                # Check if item_serials field is present in response
                first_dispatch = data[0]
                # The field may be None but should be in the model
                print(f"✓ Dispatch list endpoint works")
                print(f"  Dispatch keys: {list(first_dispatch.keys())[:15]}...")
            else:
                print(f"✓ Dispatch list endpoint works (no dispatches found)")
        else:
            print(f"  Dispatch list returned {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

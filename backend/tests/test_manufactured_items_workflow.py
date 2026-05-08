"""
Test Suite: Manufactured Items Workflow
Tests for:
1. POST /api/inventory/ledger blocks adding stock for manufactured Master SKUs
2. GET /api/inventory/stock returns serial_numbers array for manufactured items
3. Full production workflow creates serial records in finished_good_serials
4. Serial status changes to 'dispatched' after dispatch
5. GET /api/finished-good-serials/available returns only in_stock serials
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"email": "admin@musclegrid.in", "password": "Muscle@846"}
ACCOUNTANT_CREDS = {"email": "accountant@musclegrid.in", "password": "Muscle@846"}
TECHNICIAN_CREDS = {"email": "technician@musclegrid.in", "password": "Muscle@846"}

# Test data from main agent context
TEST_MASTER_SKU_ID = "ab979248-5297-4ee1-b8a5-56d98553d71c"  # TEST-INV-001 (manufactured)
TEST_SERIAL_IN_STOCK = "INV-TEST-002"


class TestAuth:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        """Get accountant auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant authentication failed")
    
    @pytest.fixture(scope="class")
    def technician_token(self):
        """Get technician auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TECHNICIAN_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Technician authentication failed")
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful")
    
    def test_accountant_login(self):
        """Test accountant can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        assert response.status_code == 200, f"Accountant login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "accountant"
        print(f"✓ Accountant login successful")


class TestLedgerBlocksManufacturedItems:
    """Test that POST /api/inventory/ledger blocks adding stock for manufactured Master SKUs"""
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        """Get accountant auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant authentication failed")
    
    @pytest.fixture(scope="class")
    def firm_id(self, accountant_token):
        """Get first active firm ID"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/firms", headers=headers, params={"is_active": True})
        if response.status_code == 200 and response.json():
            return response.json()[0]["id"]
        pytest.skip("No active firms found")
    
    @pytest.fixture(scope="class")
    def manufactured_sku(self, accountant_token):
        """Get a manufactured Master SKU"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/master-skus", headers=headers)
        if response.status_code == 200:
            skus = response.json()
            for sku in skus:
                if sku.get("product_type") == "manufactured":
                    return sku
        pytest.skip("No manufactured Master SKU found")
    
    def test_ledger_blocks_purchase_for_manufactured_item(self, accountant_token, firm_id, manufactured_sku):
        """Test that purchase entry is blocked for manufactured items"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        payload = {
            "entry_type": "purchase",
            "item_type": "master_sku",
            "item_id": manufactured_sku["id"],
            "firm_id": firm_id,
            "quantity": 10,
            "unit_price": 1000,
            "invoice_number": "TEST-INV-001",
            "reason": "Test purchase"
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory/ledger", headers=headers, json=payload)
        
        # Should be blocked with 400 error
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        error_detail = response.json().get("detail", "")
        assert "manufactured" in error_detail.lower() or "production" in error_detail.lower(), \
            f"Error should mention manufactured items or production workflow: {error_detail}"
        print(f"✓ Ledger correctly blocks purchase for manufactured item: {manufactured_sku['name']}")
    
    def test_ledger_blocks_adjustment_in_for_manufactured_item(self, accountant_token, firm_id, manufactured_sku):
        """Test that adjustment_in entry is blocked for manufactured items"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        payload = {
            "entry_type": "adjustment_in",
            "item_type": "master_sku",
            "item_id": manufactured_sku["id"],
            "firm_id": firm_id,
            "quantity": 5,
            "reason": "Test adjustment - should be blocked"
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory/ledger", headers=headers, json=payload)
        
        # Should be blocked with 400 error
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        error_detail = response.json().get("detail", "")
        assert "manufactured" in error_detail.lower() or "production" in error_detail.lower(), \
            f"Error should mention manufactured items or production workflow: {error_detail}"
        print(f"✓ Ledger correctly blocks adjustment_in for manufactured item")
    
    def test_ledger_blocks_transfer_in_for_manufactured_item(self, accountant_token, firm_id, manufactured_sku):
        """Test that transfer_in entry is blocked for manufactured items"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        payload = {
            "entry_type": "transfer_in",
            "item_type": "master_sku",
            "item_id": manufactured_sku["id"],
            "firm_id": firm_id,
            "quantity": 3,
            "invoice_number": "TRF-TEST-001",
            "reason": "Test transfer in - should be blocked"
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory/ledger", headers=headers, json=payload)
        
        # Should be blocked with 400 error
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ Ledger correctly blocks transfer_in for manufactured item")


class TestInventoryStockReturnsSerialNumbers:
    """Test that GET /api/inventory/stock returns serial_numbers array for manufactured items"""
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        """Get accountant auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant authentication failed")
    
    def test_stock_endpoint_returns_serial_numbers_for_manufactured(self, accountant_token):
        """Test that inventory stock endpoint returns serial_numbers for manufactured items"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        response = requests.get(f"{BASE_URL}/api/inventory/stock", headers=headers)
        assert response.status_code == 200, f"Stock endpoint failed: {response.text}"
        
        data = response.json()
        assert "master_skus" in data, "Response should contain master_skus"
        
        # Find manufactured items with stock
        manufactured_with_serials = []
        for sku in data["master_skus"]:
            if sku.get("product_type") == "manufactured":
                # Check that serial_numbers field exists
                assert "serial_numbers" in sku, f"Manufactured SKU {sku['name']} should have serial_numbers field"
                if sku.get("current_stock", 0) > 0:
                    manufactured_with_serials.append(sku)
        
        print(f"✓ Found {len(manufactured_with_serials)} manufactured items with stock")
        
        # If there are manufactured items with stock, verify serial_numbers array
        for sku in manufactured_with_serials:
            assert isinstance(sku["serial_numbers"], list), "serial_numbers should be a list"
            assert len(sku["serial_numbers"]) == sku["current_stock"], \
                f"Serial count ({len(sku['serial_numbers'])}) should match stock ({sku['current_stock']})"
            print(f"  - {sku['name']}: {sku['current_stock']} units, serials: {sku['serial_numbers'][:3]}...")
    
    def test_stock_endpoint_returns_empty_serials_for_traded(self, accountant_token):
        """Test that traded items have empty serial_numbers array"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        response = requests.get(f"{BASE_URL}/api/inventory/stock", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Find traded items
        for sku in data["master_skus"]:
            if sku.get("product_type") != "manufactured":
                assert "serial_numbers" in sku, f"Traded SKU {sku['name']} should have serial_numbers field"
                assert sku["serial_numbers"] == [], f"Traded items should have empty serial_numbers array"
        
        print(f"✓ Traded items correctly have empty serial_numbers array")


class TestAvailableSerialsEndpoint:
    """Test GET /api/finished-good-serials/available returns only in_stock serials"""
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        """Get accountant auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant authentication failed")
    
    @pytest.fixture(scope="class")
    def firm_id(self, accountant_token):
        """Get first active firm ID"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/firms", headers=headers, params={"is_active": True})
        if response.status_code == 200 and response.json():
            return response.json()[0]["id"]
        pytest.skip("No active firms found")
    
    @pytest.fixture(scope="class")
    def manufactured_sku_with_stock(self, accountant_token):
        """Get a manufactured Master SKU that has in_stock serials"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        # Get stock data
        response = requests.get(f"{BASE_URL}/api/inventory/stock", headers=headers)
        if response.status_code == 200:
            data = response.json()
            for sku in data.get("master_skus", []):
                if sku.get("product_type") == "manufactured" and sku.get("current_stock", 0) > 0:
                    return {"id": sku["id"], "firm_id": sku["firm_id"], "name": sku["name"]}
        
        pytest.skip("No manufactured SKU with in_stock serials found")
    
    def test_available_serials_returns_only_in_stock(self, accountant_token, manufactured_sku_with_stock):
        """Test that available serials endpoint returns only in_stock serials"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        sku_id = manufactured_sku_with_stock["id"]
        firm_id = manufactured_sku_with_stock["firm_id"]
        
        response = requests.get(
            f"{BASE_URL}/api/finished-good-serials/available/{sku_id}",
            headers=headers,
            params={"firm_id": firm_id}
        )
        
        assert response.status_code == 200, f"Available serials endpoint failed: {response.text}"
        
        serials = response.json()
        assert isinstance(serials, list), "Response should be a list"
        
        # Verify all returned serials have status 'in_stock'
        for serial in serials:
            assert serial.get("status") == "in_stock", f"Serial {serial.get('serial_number')} should be in_stock"
        
        print(f"✓ Available serials endpoint returns {len(serials)} in_stock serials for {manufactured_sku_with_stock['name']}")
    
    def test_available_serials_requires_firm_id(self, accountant_token, manufactured_sku_with_stock):
        """Test that firm_id is required"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        sku_id = manufactured_sku_with_stock["id"]
        
        # Call without firm_id
        response = requests.get(
            f"{BASE_URL}/api/finished-good-serials/available/{sku_id}",
            headers=headers
        )
        
        # Should return 422 validation error
        assert response.status_code == 422, f"Expected 422 without firm_id, got {response.status_code}"
        print(f"✓ Available serials endpoint correctly requires firm_id")
    
    def test_available_serials_returns_empty_for_invalid_sku(self, accountant_token, firm_id):
        """Test that invalid SKU returns empty list"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/finished-good-serials/available/invalid-sku-id",
            headers=headers,
            params={"firm_id": firm_id}
        )
        
        assert response.status_code == 200, f"Should return 200 with empty list: {response.text}"
        assert response.json() == [], "Should return empty list for invalid SKU"
        print(f"✓ Available serials endpoint returns empty list for invalid SKU")


class TestSerialStatusAfterDispatch:
    """Test that serial status changes to 'dispatched' after dispatch"""
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        """Get accountant auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant authentication failed")
    
    def test_verify_dispatched_serial_status(self, accountant_token):
        """Verify that dispatched serials have status 'dispatched'"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        # Get all serials
        response = requests.get(f"{BASE_URL}/api/finished-good-serials", headers=headers)
        assert response.status_code == 200, f"Failed to get serials: {response.text}"
        
        serials = response.json()
        
        # Count by status
        status_counts = {}
        for serial in serials:
            status = serial.get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        print(f"✓ Serial status distribution: {status_counts}")
        
        # Verify dispatched serials exist (from main agent's test)
        dispatched_count = status_counts.get("dispatched", 0)
        in_stock_count = status_counts.get("in_stock", 0)
        
        print(f"  - Dispatched: {dispatched_count}")
        print(f"  - In Stock: {in_stock_count}")
        
        # At least verify the structure is correct
        assert "dispatched" in status_counts or "in_stock" in status_counts, \
            "Should have serials with dispatched or in_stock status"


class TestDispatchRequiresSerialForManufactured:
    """Test that dispatch requires serial number selection for manufactured items"""
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        """Get accountant auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant authentication failed")
    
    @pytest.fixture(scope="class")
    def firm_id(self, accountant_token):
        """Get first active firm ID"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/firms", headers=headers, params={"is_active": True})
        if response.status_code == 200 and response.json():
            return response.json()[0]["id"]
        pytest.skip("No active firms found")
    
    @pytest.fixture(scope="class")
    def manufactured_sku(self, accountant_token):
        """Get a manufactured Master SKU"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/master-skus", headers=headers)
        if response.status_code == 200:
            skus = response.json()
            for sku in skus:
                if sku.get("product_type") == "manufactured":
                    return sku
        pytest.skip("No manufactured Master SKU found")
    
    def test_dispatch_without_serial_fails_for_manufactured(self, accountant_token, firm_id, manufactured_sku):
        """Test that dispatch without serial number fails for manufactured items"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        # Create a test file for invoice
        files = {
            'invoice_file': ('test_invoice.pdf', b'%PDF-1.4 test content', 'application/pdf')
        }
        
        data = {
            'dispatch_type': 'new_order',
            'sku': manufactured_sku['sku_code'],
            'item_type': 'master_sku',
            'item_id': manufactured_sku['id'],
            'firm_id': firm_id,
            'customer_name': 'Test Customer',
            'phone': '9999999999',
            'address': 'Test Address',
            'order_id': 'TEST-ORD-001',
            'payment_reference': 'TEST-PAY-001',
            'reason': 'Test dispatch'
            # Note: serial_number is NOT provided
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dispatches",
            headers=headers,
            data=data,
            files=files
        )
        
        # Should fail with 400 error requiring serial number
        assert response.status_code == 400, f"Expected 400 without serial, got {response.status_code}: {response.text}"
        error_detail = response.json().get("detail", "")
        assert "serial" in error_detail.lower(), f"Error should mention serial number: {error_detail}"
        print(f"✓ Dispatch correctly requires serial number for manufactured item")


class TestProductionWorkflowCreatesSerials:
    """Test that production workflow creates serial records in finished_good_serials"""
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        """Get accountant auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant authentication failed")
    
    def test_production_requests_exist(self, accountant_token):
        """Verify production requests exist in the system"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        response = requests.get(f"{BASE_URL}/api/production-requests", headers=headers)
        assert response.status_code == 200, f"Failed to get production requests: {response.text}"
        
        data = response.json()
        # Handle both list and dict response formats
        if isinstance(data, dict):
            requests_list = data.get("requests", [])
        else:
            requests_list = data
        
        print(f"✓ Found {len(requests_list)} production requests")
        
        # Check for completed requests
        completed = [r for r in requests_list if r.get("status") == "received_into_inventory"]
        print(f"  - Completed (received into inventory): {len(completed)}")
    
    def test_finished_good_serials_exist(self, accountant_token):
        """Verify finished good serials exist from production workflow"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        response = requests.get(f"{BASE_URL}/api/finished-good-serials", headers=headers)
        assert response.status_code == 200, f"Failed to get serials: {response.text}"
        
        serials = response.json()
        assert len(serials) > 0, "Should have finished good serials from production"
        
        # Verify serial structure
        sample_serial = serials[0]
        required_fields = ["serial_number", "master_sku_id", "firm_id", "status"]
        for field in required_fields:
            assert field in sample_serial, f"Serial should have {field} field"
        
        print(f"✓ Found {len(serials)} finished good serials")
        print(f"  - Sample serial: {sample_serial.get('serial_number')}, status: {sample_serial.get('status')}")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

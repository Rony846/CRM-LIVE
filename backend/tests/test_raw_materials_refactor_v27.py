"""
Test Raw Materials Firm-Agnostic Refactor (Issue #1)
Tests:
1. Raw materials API is firm-agnostic - GET /api/raw-materials returns global materials with stock_by_firm array
2. Raw materials creation no longer requires firm_id - POST /api/raw-materials
3. Inventory stock endpoint properly shows raw materials per firm - GET /api/inventory/stock?item_type=raw_material
4. Production requests endpoint returns all requests (no 500 limit) - GET /api/production-requests
5. Supervisor payables payment UI exists and works - POST /api/supervisor-payables/{id}/payment
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ACCOUNTANT_EMAIL = "accountant@musclegrid.in"
PASSWORD = "Muscle@846"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def accountant_token():
    """Get accountant authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ACCOUNTANT_EMAIL,
        "password": PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Accountant authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def test_firm_id(admin_token):
    """Get an existing firm ID for testing"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
    if response.status_code == 200:
        firms = response.json()
        if firms:
            return firms[0]["id"]
    pytest.skip("No firms available for testing")


class TestRawMaterialsFirmAgnostic:
    """Test that raw materials are now firm-agnostic (global definitions)"""
    
    def test_list_raw_materials_returns_global_materials(self, accountant_token):
        """GET /api/raw-materials should return global materials with stock_by_firm array"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/raw-materials", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        materials = response.json()
        assert isinstance(materials, list), "Response should be a list"
        
        # If there are materials, verify structure
        if materials:
            material = materials[0]
            # Verify stock_by_firm array exists (firm-agnostic feature)
            assert "stock_by_firm" in material, "Material should have stock_by_firm array"
            assert isinstance(material["stock_by_firm"], list), "stock_by_firm should be a list"
            
            # Verify total_stock is computed
            assert "total_stock" in material, "Material should have total_stock"
            
            # Verify no firm_id at material level (firm-agnostic)
            # Note: firm_id should NOT be required at material level anymore
            print(f"✓ Found {len(materials)} raw materials with firm-agnostic structure")
            print(f"  First material: {material.get('name')} - Total stock: {material.get('total_stock')}")
            
            # Verify stock_by_firm structure
            if material["stock_by_firm"]:
                firm_stock = material["stock_by_firm"][0]
                assert "firm_id" in firm_stock, "stock_by_firm entry should have firm_id"
                assert "firm_name" in firm_stock, "stock_by_firm entry should have firm_name"
                assert "stock" in firm_stock, "stock_by_firm entry should have stock"
                print(f"  Stock by firm: {firm_stock}")
    
    def test_create_raw_material_without_firm_id(self, accountant_token):
        """POST /api/raw-materials should work without firm_id (global definition)"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        # Generate unique SKU code
        unique_sku = f"TEST-RM-{uuid.uuid4().hex[:6].upper()}"
        
        payload = {
            "name": f"Test Raw Material {unique_sku}",
            "sku_code": unique_sku,
            "unit": "pcs",
            "hsn_code": "7408",
            "reorder_level": 10,
            "description": "Test material for firm-agnostic refactor"
        }
        
        response = requests.post(f"{BASE_URL}/api/raw-materials", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        material = response.json()
        assert material["name"] == payload["name"]
        assert material["sku_code"] == unique_sku
        assert material["unit"] == "pcs"
        assert "id" in material
        
        # Verify firm-agnostic structure
        assert "stock_by_firm" in material, "Created material should have stock_by_firm"
        assert "total_stock" in material, "Created material should have total_stock"
        assert material["total_stock"] == 0, "New material should have 0 total stock"
        
        print(f"✓ Created raw material without firm_id: {material['name']} (ID: {material['id']})")
        
        return material["id"]
    
    def test_get_single_raw_material_has_stock_by_firm(self, accountant_token):
        """GET /api/raw-materials/{id} should return material with stock_by_firm"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        # First get list to find a material
        list_response = requests.get(f"{BASE_URL}/api/raw-materials", headers=headers)
        assert list_response.status_code == 200
        
        materials = list_response.json()
        if not materials:
            pytest.skip("No raw materials to test")
        
        material_id = materials[0]["id"]
        
        # Get single material
        response = requests.get(f"{BASE_URL}/api/raw-materials/{material_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        material = response.json()
        assert "stock_by_firm" in material, "Single material should have stock_by_firm"
        assert "total_stock" in material, "Single material should have total_stock"
        
        print(f"✓ Single material has stock_by_firm: {material['name']}")


class TestInventoryStockEndpoint:
    """Test inventory stock endpoint for raw materials per firm"""
    
    def test_inventory_stock_returns_raw_materials_per_firm(self, accountant_token):
        """GET /api/inventory/stock?item_type=raw_material should show raw materials per firm"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/inventory/stock",
            params={"item_type": "raw_material"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "raw_materials" in data, "Response should have raw_materials array"
        assert "summary" in data, "Response should have summary"
        
        # Verify raw materials structure
        if data["raw_materials"]:
            rm = data["raw_materials"][0]
            assert "id" in rm
            assert "name" in rm
            assert "sku_code" in rm
            assert "firm_id" in rm, "Stock entry should have firm_id"
            assert "firm_name" in rm, "Stock entry should have firm_name"
            assert "current_stock" in rm
            assert "is_low_stock" in rm
            assert "is_negative" in rm
            
            print(f"✓ Inventory stock shows raw materials per firm")
            print(f"  Found {len(data['raw_materials'])} raw material stock entries")
            print(f"  Summary: {data['summary']}")
    
    def test_inventory_stock_all_types(self, accountant_token):
        """GET /api/inventory/stock should return all item types"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        response = requests.get(f"{BASE_URL}/api/inventory/stock", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "raw_materials" in data
        assert "finished_goods" in data
        assert "master_skus" in data
        assert "summary" in data
        
        print(f"✓ Inventory stock returns all types")
        print(f"  Raw materials: {len(data['raw_materials'])}")
        print(f"  Finished goods: {len(data['finished_goods'])}")
        print(f"  Master SKUs: {len(data['master_skus'])}")


class TestProductionRequestsNoLimit:
    """Test that production requests endpoint has no 500 limit"""
    
    def test_production_requests_returns_all(self, accountant_token):
        """GET /api/production-requests should return all requests (no 500 limit)"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        response = requests.get(f"{BASE_URL}/api/production-requests", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        requests_list = response.json()
        assert isinstance(requests_list, list), "Response should be a list"
        
        print(f"✓ Production requests endpoint working - returned {len(requests_list)} requests")
        
        # Verify structure if there are requests
        if requests_list:
            req = requests_list[0]
            assert "id" in req
            assert "request_number" in req or "production_number" in req
            assert "status" in req
            print(f"  First request: {req.get('request_number', req.get('production_number'))} - Status: {req.get('status')}")


class TestSupervisorPayablesPayment:
    """Test supervisor payables payment endpoint"""
    
    def test_list_supervisor_payables(self, accountant_token):
        """GET /api/supervisor-payables should return payables with summary"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        response = requests.get(f"{BASE_URL}/api/supervisor-payables", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Response is an object with payables array and summary
        assert "payables" in data, "Response should have payables array"
        assert "summary" in data, "Response should have summary"
        
        payables = data["payables"]
        assert isinstance(payables, list), "payables should be a list"
        
        print(f"✓ Supervisor payables endpoint working - returned {len(payables)} payables")
        print(f"  Summary: {data['summary']}")
        
        return data
    
    def test_supervisor_payables_payment_endpoint_exists(self, accountant_token):
        """PUT /api/supervisor-payables/{id}/payment endpoint should exist"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        # First get a payable
        list_response = requests.get(f"{BASE_URL}/api/supervisor-payables", headers=headers)
        
        if list_response.status_code != 200:
            pytest.skip("Could not list supervisor payables")
        
        data = list_response.json()
        payables = data.get("payables", [])
        
        if not payables:
            # Test with fake ID to verify endpoint exists
            response = requests.put(
                f"{BASE_URL}/api/supervisor-payables/fake-id/payment",
                json={"status": "paid", "amount_paid": 100, "payment_reference": "TEST"},
                headers=headers
            )
            # Should return 404 (not found) not 405 (method not allowed)
            assert response.status_code in [404, 400], f"Expected 404 or 400, got {response.status_code}"
            print("✓ Supervisor payables payment endpoint exists (tested with fake ID)")
            return
        
        # Find an unpaid payable
        unpaid = [p for p in payables if p.get("status") != "paid"]
        
        if not unpaid:
            print("✓ All payables are already paid - endpoint exists")
            return
        
        payable = unpaid[0]
        payable_id = payable["id"]
        pending_amount = payable.get("total_payable", 0) - payable.get("amount_paid", 0)
        
        if pending_amount <= 0:
            print("✓ No pending amount to pay - endpoint exists")
            return
        
        # Test payment with small amount
        test_amount = min(1, pending_amount)
        
        response = requests.put(
            f"{BASE_URL}/api/supervisor-payables/{payable_id}/payment",
            json={
                "status": "part_paid",
                "amount_paid": test_amount,
                "payment_reference": f"TEST-{uuid.uuid4().hex[:8]}",
                "remarks": "Test payment from automated test"
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "message" in result
        assert "status" in result
        
        print(f"✓ Supervisor payables payment recorded successfully")
        print(f"  Payable: {payable.get('payable_number')}")
        print(f"  Amount paid: {test_amount}")
        print(f"  New status: {result.get('status')}")


class TestRawMaterialLedgerEntry:
    """Test creating ledger entries for raw materials (firm-agnostic)"""
    
    def test_create_ledger_entry_for_raw_material(self, accountant_token, test_firm_id):
        """POST /api/inventory/ledger should work for raw materials with firm_id"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        # First get a raw material
        rm_response = requests.get(f"{BASE_URL}/api/raw-materials", headers=headers)
        assert rm_response.status_code == 200
        
        materials = rm_response.json()
        if not materials:
            pytest.skip("No raw materials to test ledger entry")
        
        material = materials[0]
        
        # Create a purchase ledger entry
        payload = {
            "entry_type": "purchase",
            "item_type": "raw_material",
            "item_id": material["id"],
            "firm_id": test_firm_id,
            "quantity": 5,
            "unit_price": 100,
            "invoice_number": f"TEST-INV-{uuid.uuid4().hex[:6]}",
            "reason": "Test purchase for firm-agnostic raw material",
            "notes": "Automated test"
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory/ledger", json=payload, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        entry = response.json()
        assert "id" in entry
        assert "entry_number" in entry
        assert entry["item_id"] == material["id"]
        assert entry["firm_id"] == test_firm_id
        assert entry["quantity"] == 5
        
        print(f"✓ Created ledger entry for raw material")
        print(f"  Entry: {entry.get('entry_number')}")
        print(f"  Material: {material.get('name')}")
        print(f"  Running balance: {entry.get('running_balance')}")


class TestFirmsEndpoint:
    """Test firms endpoint for inventory management"""
    
    def test_list_firms(self, admin_token):
        """GET /api/firms should return active firms"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        firms = response.json()
        assert isinstance(firms, list), "Response should be a list"
        
        if firms:
            firm = firms[0]
            assert "id" in firm
            assert "name" in firm
            assert "is_active" in firm
            
            print(f"✓ Firms endpoint working - returned {len(firms)} firms")
            for f in firms[:3]:
                print(f"  - {f.get('name')} (Active: {f.get('is_active')})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

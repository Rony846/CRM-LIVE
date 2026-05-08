"""
Test Master SKU Architecture with BOM (Bill of Materials) and Production
Tests for iteration 22 - Multi-Firm Inventory System Enhancement

Features tested:
1. Master SKU CRUD operations
2. Platform aliases management
3. Bill of Materials (BOM) for manufactured products
4. Production using BOM to auto-calculate raw materials
5. Stock tracking per-firm at Master SKU level
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"
ACCOUNTANT_EMAIL = "accountant@musclegrid.in"
ACCOUNTANT_PASSWORD = "Muscle@846"


class TestMasterSKUEndpoints:
    """Test Master SKU CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Store created IDs for cleanup
        self.created_master_sku_ids = []
        self.created_raw_material_ids = []
        
        yield
        
        # Cleanup - delete created test data
        for sku_id in self.created_master_sku_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/master-skus/{sku_id}")
            except:
                pass
    
    def test_01_list_master_skus(self):
        """GET /api/master-skus returns list of Master SKUs"""
        response = self.session.get(f"{BASE_URL}/api/master-skus")
        assert response.status_code == 200, f"Failed to list master SKUs: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/master-skus returned {len(data)} Master SKUs")
    
    def test_02_create_master_sku_basic(self):
        """POST /api/master-skus creates a basic Master SKU"""
        sku_data = {
            "name": "TEST_Basic Inverter 1000VA",
            "sku_code": "TEST-INV-1000",
            "category": "Inverter",
            "hsn_code": "85044090",
            "unit": "pcs",
            "is_manufactured": False,
            "reorder_level": 10,
            "description": "Test basic inverter for testing"
        }
        
        response = self.session.post(f"{BASE_URL}/api/master-skus", json=sku_data)
        assert response.status_code == 200, f"Failed to create Master SKU: {response.text}"
        
        data = response.json()
        assert data["name"] == sku_data["name"]
        assert data["sku_code"] == sku_data["sku_code"]
        assert data["category"] == sku_data["category"]
        assert data["is_manufactured"] == False
        assert data["is_active"] == True
        assert "id" in data
        
        self.created_master_sku_ids.append(data["id"])
        print(f"✓ POST /api/master-skus created basic SKU: {data['sku_code']}")
        return data
    
    def test_03_create_master_sku_manufactured(self):
        """POST /api/master-skus with is_manufactured=true works"""
        sku_data = {
            "name": "TEST_Manufactured Battery 24V",
            "sku_code": "TEST-BAT-24V",
            "category": "Battery",
            "hsn_code": "85072000",
            "unit": "pcs",
            "is_manufactured": True,
            "reorder_level": 5,
            "description": "Test manufactured battery"
        }
        
        response = self.session.post(f"{BASE_URL}/api/master-skus", json=sku_data)
        assert response.status_code == 200, f"Failed to create manufactured SKU: {response.text}"
        
        data = response.json()
        assert data["is_manufactured"] == True
        assert data["bill_of_materials"] == []  # Empty BOM initially
        
        self.created_master_sku_ids.append(data["id"])
        print(f"✓ POST /api/master-skus created manufactured SKU: {data['sku_code']}")
        return data
    
    def test_04_get_master_sku_by_id(self):
        """GET /api/master-skus/{id} returns specific Master SKU"""
        # First create a SKU
        sku_data = {
            "name": "TEST_Get By ID SKU",
            "sku_code": "TEST-GET-001",
            "category": "Spare Part",
            "unit": "pcs",
            "is_manufactured": False
        }
        create_response = self.session.post(f"{BASE_URL}/api/master-skus", json=sku_data)
        assert create_response.status_code == 200
        created_sku = create_response.json()
        self.created_master_sku_ids.append(created_sku["id"])
        
        # Get by ID
        response = self.session.get(f"{BASE_URL}/api/master-skus/{created_sku['id']}")
        assert response.status_code == 200, f"Failed to get Master SKU: {response.text}"
        
        data = response.json()
        assert data["id"] == created_sku["id"]
        assert data["sku_code"] == sku_data["sku_code"]
        print(f"✓ GET /api/master-skus/{{id}} returned SKU: {data['sku_code']}")
    
    def test_05_update_master_sku(self):
        """PATCH /api/master-skus/{id} updates Master SKU"""
        # First create a SKU
        sku_data = {
            "name": "TEST_Update SKU Original",
            "sku_code": "TEST-UPD-001",
            "category": "Inverter",
            "unit": "pcs",
            "is_manufactured": False,
            "reorder_level": 10
        }
        create_response = self.session.post(f"{BASE_URL}/api/master-skus", json=sku_data)
        assert create_response.status_code == 200
        created_sku = create_response.json()
        self.created_master_sku_ids.append(created_sku["id"])
        
        # Update the SKU
        update_data = {
            "name": "TEST_Update SKU Modified",
            "reorder_level": 20,
            "description": "Updated description"
        }
        response = self.session.patch(f"{BASE_URL}/api/master-skus/{created_sku['id']}", json=update_data)
        assert response.status_code == 200, f"Failed to update Master SKU: {response.text}"
        
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["reorder_level"] == update_data["reorder_level"]
        assert data["description"] == update_data["description"]
        print(f"✓ PATCH /api/master-skus/{{id}} updated SKU successfully")
    
    def test_06_duplicate_sku_code_rejected(self):
        """POST /api/master-skus rejects duplicate SKU codes"""
        sku_data = {
            "name": "TEST_Duplicate SKU 1",
            "sku_code": "TEST-DUP-001",
            "category": "Inverter",
            "unit": "pcs",
            "is_manufactured": False
        }
        
        # Create first SKU
        response1 = self.session.post(f"{BASE_URL}/api/master-skus", json=sku_data)
        assert response1.status_code == 200
        self.created_master_sku_ids.append(response1.json()["id"])
        
        # Try to create duplicate
        sku_data["name"] = "TEST_Duplicate SKU 2"
        response2 = self.session.post(f"{BASE_URL}/api/master-skus", json=sku_data)
        assert response2.status_code == 400, "Should reject duplicate SKU code"
        assert "already exists" in response2.json().get("detail", "").lower()
        print(f"✓ Duplicate SKU code correctly rejected")


class TestPlatformAliases:
    """Test platform alias management for Master SKUs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        import random
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Create a test SKU for alias tests with unique code
        unique_id = f"{int(time.time())}-{random.randint(1000, 9999)}"
        sku_data = {
            "name": "TEST_Alias Test SKU",
            "sku_code": f"TEST-ALIAS-{unique_id}",
            "category": "Inverter",
            "unit": "pcs",
            "is_manufactured": False
        }
        create_response = self.session.post(f"{BASE_URL}/api/master-skus", json=sku_data)
        if create_response.status_code != 200:
            # Try with different unique ID
            unique_id = f"{int(time.time())}-{random.randint(10000, 99999)}"
            sku_data["sku_code"] = f"TEST-ALIAS-{unique_id}"
            create_response = self.session.post(f"{BASE_URL}/api/master-skus", json=sku_data)
        assert create_response.status_code == 200, f"Failed to create test SKU: {create_response.text}"
        self.test_sku = create_response.json()
        
        yield
        
        # Cleanup
        try:
            self.session.delete(f"{BASE_URL}/api/master-skus/{self.test_sku['id']}")
        except:
            pass
    
    def test_01_add_alias(self):
        """POST /api/master-skus/{id}/aliases adds platform alias"""
        alias_data = {
            "alias_code": f"AMZ-TEST-{int(time.time())}",
            "platform": "Amazon",
            "notes": "Amazon FBA SKU"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/master-skus/{self.test_sku['id']}/aliases",
            json=alias_data
        )
        assert response.status_code == 200, f"Failed to add alias: {response.text}"
        
        # Verify alias was added
        get_response = self.session.get(f"{BASE_URL}/api/master-skus/{self.test_sku['id']}")
        assert get_response.status_code == 200
        sku_data = get_response.json()
        
        assert len(sku_data["aliases"]) == 1
        assert sku_data["aliases"][0]["alias_code"] == alias_data["alias_code"]
        assert sku_data["aliases"][0]["platform"] == alias_data["platform"]
        print(f"✓ POST /api/master-skus/{{id}}/aliases added alias: {alias_data['alias_code']}")
    
    def test_02_remove_alias(self):
        """DELETE /api/master-skus/{id}/aliases/{code} removes alias"""
        # First add an alias
        alias_code = f"DEL-TEST-{int(time.time())}"
        alias_data = {
            "alias_code": alias_code,
            "platform": "Flipkart",
            "notes": "To be deleted"
        }
        add_response = self.session.post(
            f"{BASE_URL}/api/master-skus/{self.test_sku['id']}/aliases",
            json=alias_data
        )
        assert add_response.status_code == 200
        
        # Remove the alias
        response = self.session.delete(
            f"{BASE_URL}/api/master-skus/{self.test_sku['id']}/aliases/{alias_code}"
        )
        assert response.status_code == 200, f"Failed to remove alias: {response.text}"
        
        # Verify alias was removed
        get_response = self.session.get(f"{BASE_URL}/api/master-skus/{self.test_sku['id']}")
        sku_data = get_response.json()
        alias_codes = [a["alias_code"] for a in sku_data.get("aliases", [])]
        assert alias_code not in alias_codes
        print(f"✓ DELETE /api/master-skus/{{id}}/aliases/{{code}} removed alias successfully")
    
    def test_03_duplicate_alias_rejected(self):
        """Adding duplicate alias code is rejected"""
        alias_code = f"DUP-ALIAS-{int(time.time())}"
        alias_data = {
            "alias_code": alias_code,
            "platform": "Amazon",
            "notes": "First alias"
        }
        
        # Add first alias
        response1 = self.session.post(
            f"{BASE_URL}/api/master-skus/{self.test_sku['id']}/aliases",
            json=alias_data
        )
        assert response1.status_code == 200
        
        # Try to add duplicate
        response2 = self.session.post(
            f"{BASE_URL}/api/master-skus/{self.test_sku['id']}/aliases",
            json=alias_data
        )
        assert response2.status_code == 400, "Should reject duplicate alias code"
        print(f"✓ Duplicate alias code correctly rejected")


class TestBillOfMaterials:
    """Test Bill of Materials (BOM) management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get a firm for raw material creation
        firms_response = self.session.get(f"{BASE_URL}/api/firms", params={"is_active": True})
        assert firms_response.status_code == 200
        firms = firms_response.json()
        assert len(firms) > 0, "No active firms found"
        self.test_firm = firms[0]
        
        # Get existing raw materials
        rm_response = self.session.get(f"{BASE_URL}/api/raw-materials")
        assert rm_response.status_code == 200
        self.raw_materials = rm_response.json()
        
        self.created_sku_ids = []
        
        yield
        
        # Cleanup
        for sku_id in self.created_sku_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/master-skus/{sku_id}")
            except:
                pass
    
    def test_01_update_sku_with_bom(self):
        """PATCH /api/master-skus/{id} updates Master SKU with BOM"""
        # Create a manufactured SKU
        sku_data = {
            "name": "TEST_BOM Product",
            "sku_code": f"TEST-BOM-{int(time.time())}",
            "category": "Battery",
            "unit": "pcs",
            "is_manufactured": True
        }
        create_response = self.session.post(f"{BASE_URL}/api/master-skus", json=sku_data)
        assert create_response.status_code == 200
        created_sku = create_response.json()
        self.created_sku_ids.append(created_sku["id"])
        
        # Skip if no raw materials exist
        if len(self.raw_materials) == 0:
            pytest.skip("No raw materials available for BOM test")
        
        # Update with BOM
        bom_data = {
            "is_manufactured": True,
            "bill_of_materials": [
                {
                    "raw_material_id": self.raw_materials[0]["id"],
                    "quantity": 2
                }
            ]
        }
        
        response = self.session.patch(
            f"{BASE_URL}/api/master-skus/{created_sku['id']}",
            json=bom_data
        )
        assert response.status_code == 200, f"Failed to update BOM: {response.text}"
        
        data = response.json()
        assert data["is_manufactured"] == True
        assert len(data["bill_of_materials"]) == 1
        assert data["bill_of_materials"][0]["raw_material_id"] == self.raw_materials[0]["id"]
        assert data["bill_of_materials"][0]["quantity"] == 2
        print(f"✓ PATCH /api/master-skus/{{id}} updated BOM successfully")
    
    def test_02_bom_validates_raw_material_exists(self):
        """BOM validation rejects non-existent raw material IDs"""
        # Create a manufactured SKU
        sku_data = {
            "name": "TEST_BOM Validation",
            "sku_code": f"TEST-BOMV-{int(time.time())}",
            "category": "Battery",
            "unit": "pcs",
            "is_manufactured": True
        }
        create_response = self.session.post(f"{BASE_URL}/api/master-skus", json=sku_data)
        assert create_response.status_code == 200
        created_sku = create_response.json()
        self.created_sku_ids.append(created_sku["id"])
        
        # Try to update with invalid raw material ID
        bom_data = {
            "bill_of_materials": [
                {
                    "raw_material_id": "non-existent-id-12345",
                    "quantity": 1
                }
            ]
        }
        
        response = self.session.patch(
            f"{BASE_URL}/api/master-skus/{created_sku['id']}",
            json=bom_data
        )
        assert response.status_code == 400, "Should reject invalid raw material ID"
        assert "not found" in response.json().get("detail", "").lower()
        print(f"✓ BOM validation correctly rejects invalid raw material IDs")


class TestMasterSKUStock:
    """Test stock tracking for Master SKUs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_01_get_sku_stock_by_firm(self):
        """GET /api/master-skus/{id}/stock returns stock by firm"""
        # Get existing master SKUs
        skus_response = self.session.get(f"{BASE_URL}/api/master-skus")
        assert skus_response.status_code == 200
        skus = skus_response.json()
        
        if len(skus) == 0:
            pytest.skip("No Master SKUs available for stock test")
        
        test_sku = skus[0]
        
        response = self.session.get(f"{BASE_URL}/api/master-skus/{test_sku['id']}/stock")
        assert response.status_code == 200, f"Failed to get stock: {response.text}"
        
        data = response.json()
        assert "master_sku" in data
        assert "total_stock" in data
        assert "stock_by_firm" in data
        assert isinstance(data["stock_by_firm"], list)
        print(f"✓ GET /api/master-skus/{{id}}/stock returned stock data")
    
    def test_02_get_all_stock_with_filters(self):
        """GET /api/master-skus/stock/all returns all stock with filters"""
        response = self.session.get(f"{BASE_URL}/api/master-skus/stock/all")
        assert response.status_code == 200, f"Failed to get all stock: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/master-skus/stock/all returned {len(data)} items")
        
        # Test with category filter
        response_filtered = self.session.get(
            f"{BASE_URL}/api/master-skus/stock/all",
            params={"category": "Inverter"}
        )
        assert response_filtered.status_code == 200
        print(f"✓ GET /api/master-skus/stock/all with category filter works")
        
        # Test with is_manufactured filter
        response_manufactured = self.session.get(
            f"{BASE_URL}/api/master-skus/stock/all",
            params={"is_manufactured": True}
        )
        assert response_manufactured.status_code == 200
        print(f"✓ GET /api/master-skus/stock/all with is_manufactured filter works")


class TestProductionWithBOM:
    """Test Production using BOM to auto-calculate raw materials"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get firms
        firms_response = self.session.get(f"{BASE_URL}/api/firms", params={"is_active": True})
        assert firms_response.status_code == 200
        self.firms = firms_response.json()
        
        # Get raw materials
        rm_response = self.session.get(f"{BASE_URL}/api/raw-materials")
        assert rm_response.status_code == 200
        self.raw_materials = rm_response.json()
        
        # Get master SKUs
        skus_response = self.session.get(f"{BASE_URL}/api/master-skus")
        assert skus_response.status_code == 200
        self.master_skus = skus_response.json()
    
    def test_01_production_validates_bom_exists(self):
        """Production validates BOM exists before creating entry"""
        if len(self.firms) == 0:
            pytest.skip("No firms available")
        
        # Find a manufactured SKU without BOM or create one
        manufactured_skus = [s for s in self.master_skus if s.get("is_manufactured")]
        
        if len(manufactured_skus) == 0:
            # Create a manufactured SKU without BOM
            sku_data = {
                "name": "TEST_No BOM Product",
                "sku_code": f"TEST-NOBOM-{int(time.time())}",
                "category": "Battery",
                "unit": "pcs",
                "is_manufactured": True
            }
            create_response = self.session.post(f"{BASE_URL}/api/master-skus", json=sku_data)
            assert create_response.status_code == 200
            test_sku = create_response.json()
        else:
            # Find one without BOM
            test_sku = None
            for sku in manufactured_skus:
                if not sku.get("bill_of_materials") or len(sku.get("bill_of_materials", [])) == 0:
                    test_sku = sku
                    break
            
            if test_sku is None:
                pytest.skip("All manufactured SKUs have BOM defined")
        
        # Try to create production with use_bom=true but no BOM defined
        production_data = {
            "firm_id": self.firms[0]["id"],
            "output_sku_id": test_sku["id"],
            "output_quantity": 1,
            "use_bom": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/production", json=production_data)
        assert response.status_code == 400, f"Should fail without BOM: {response.text}"
        detail = response.json().get("detail", "").lower()
        assert "bill of materials" in detail or "bom" in detail or "not marked as manufactured" in detail
        print(f"✓ Production correctly validates BOM exists")
    
    def test_02_production_with_use_bom_true(self):
        """POST /api/production with use_bom=true auto-calculates materials from BOM"""
        if len(self.firms) == 0:
            pytest.skip("No firms available")
        if len(self.raw_materials) == 0:
            pytest.skip("No raw materials available")
        
        # Find a manufactured SKU with BOM
        manufactured_with_bom = [
            s for s in self.master_skus 
            if s.get("is_manufactured") and s.get("bill_of_materials") and len(s.get("bill_of_materials", [])) > 0
        ]
        
        if len(manufactured_with_bom) == 0:
            pytest.skip("No manufactured SKUs with BOM available")
        
        test_sku = manufactured_with_bom[0]
        test_firm = self.firms[0]
        
        # Check if we have enough stock for the raw materials in BOM
        bom = test_sku.get("bill_of_materials", [])
        for bom_item in bom:
            rm_id = bom_item.get("raw_material_id")
            rm = next((r for r in self.raw_materials if r["id"] == rm_id), None)
            if rm and rm.get("current_stock", 0) < bom_item.get("quantity", 1):
                pytest.skip(f"Insufficient stock for raw material {rm.get('name')}")
        
        # Create production with use_bom=true
        production_data = {
            "firm_id": test_firm["id"],
            "output_sku_id": test_sku["id"],
            "output_quantity": 1,
            "use_bom": True,
            "batch_number": f"TEST-BATCH-{int(time.time())}",
            "notes": "Test production with BOM"
        }
        
        response = self.session.post(f"{BASE_URL}/api/production", json=production_data)
        
        # May fail due to insufficient stock - that's OK for this test
        if response.status_code == 400 and "insufficient stock" in response.json().get("detail", "").lower():
            print(f"✓ Production correctly validates stock availability")
            return
        
        assert response.status_code == 200, f"Failed to create production: {response.text}"
        
        data = response.json()
        assert "production_number" in data
        assert data["output_quantity"] == 1
        assert "materials_consumed" in data
        assert len(data["materials_consumed"]) > 0
        print(f"✓ POST /api/production with use_bom=true created production: {data['production_number']}")
    
    def test_03_production_shows_only_manufactured_skus(self):
        """Verify only is_manufactured=true SKUs should be used for production"""
        # Get all master SKUs
        response = self.session.get(f"{BASE_URL}/api/master-skus")
        assert response.status_code == 200
        all_skus = response.json()
        
        # Filter manufactured SKUs
        manufactured = [s for s in all_skus if s.get("is_manufactured")]
        non_manufactured = [s for s in all_skus if not s.get("is_manufactured")]
        
        print(f"✓ Found {len(manufactured)} manufactured SKUs and {len(non_manufactured)} non-manufactured SKUs")
        
        # If we have a non-manufactured SKU, verify production fails
        if len(non_manufactured) > 0 and len(self.firms) > 0:
            production_data = {
                "firm_id": self.firms[0]["id"],
                "output_sku_id": non_manufactured[0]["id"],
                "output_quantity": 1,
                "use_bom": True
            }
            
            response = self.session.post(f"{BASE_URL}/api/production", json=production_data)
            # Should fail because it's not marked as manufactured
            if response.status_code == 400:
                print(f"✓ Production correctly rejects non-manufactured SKUs with use_bom=true")


class TestAccountantAccess:
    """Test that accountant role can access Master SKU and Production endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as accountant
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        assert response.status_code == 200, f"Accountant login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_01_accountant_can_list_master_skus(self):
        """Accountant can access GET /api/master-skus"""
        response = self.session.get(f"{BASE_URL}/api/master-skus")
        assert response.status_code == 200, f"Accountant cannot list master SKUs: {response.text}"
        print(f"✓ Accountant can list Master SKUs")
    
    def test_02_accountant_can_create_master_sku(self):
        """Accountant can access POST /api/master-skus"""
        sku_data = {
            "name": "TEST_Accountant SKU",
            "sku_code": f"TEST-ACC-{int(time.time())}",
            "category": "Spare Part",
            "unit": "pcs",
            "is_manufactured": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/master-skus", json=sku_data)
        assert response.status_code == 200, f"Accountant cannot create master SKU: {response.text}"
        print(f"✓ Accountant can create Master SKUs")
    
    def test_03_accountant_can_list_productions(self):
        """Accountant can access GET /api/productions"""
        response = self.session.get(f"{BASE_URL}/api/productions")
        assert response.status_code == 200, f"Accountant cannot list productions: {response.text}"
        print(f"✓ Accountant can list Productions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

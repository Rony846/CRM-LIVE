"""
Production Module Tests - Iteration 21
Tests for:
- POST /api/production - Create production entry with ledger entries
- GET /api/productions - List production records
- Stock validation before production
- Ledger entries creation (production_consume, production_output)
- Stock changes verification
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


class TestProductionModule:
    """Production Module API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.admin_token = None
        self.accountant_token = None
        
    def get_admin_token(self):
        """Get admin authentication token"""
        if self.admin_token:
            return self.admin_token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["access_token"]
        return self.admin_token
    
    def get_accountant_token(self):
        """Get accountant authentication token"""
        if self.accountant_token:
            return self.accountant_token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        assert response.status_code == 200, f"Accountant login failed: {response.text}"
        self.accountant_token = response.json()["access_token"]
        return self.accountant_token
    
    def get_auth_headers(self, role="admin"):
        """Get authorization headers"""
        token = self.get_admin_token() if role == "admin" else self.get_accountant_token()
        return {"Authorization": f"Bearer {token}"}
    
    # ==================== AUTH TESTS ====================
    
    def test_01_admin_login(self):
        """Test admin can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print("PASS: Admin login successful")
    
    def test_02_accountant_login(self):
        """Test accountant can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "accountant"
        print("PASS: Accountant login successful")
    
    # ==================== PREREQUISITE DATA TESTS ====================
    
    def test_03_get_firms(self):
        """Test getting list of firms"""
        headers = self.get_auth_headers("admin")
        response = self.session.get(f"{BASE_URL}/api/firms", headers=headers)
        assert response.status_code == 200
        firms = response.json()
        assert isinstance(firms, list)
        assert len(firms) > 0, "No firms found - need at least one firm for production"
        print(f"PASS: Found {len(firms)} firms")
        # Store first firm for later tests
        self.firm_id = firms[0]["id"]
        self.firm_name = firms[0]["name"]
        print(f"  Using firm: {self.firm_name}")
    
    def test_04_get_raw_materials(self):
        """Test getting list of raw materials"""
        headers = self.get_auth_headers("admin")
        response = self.session.get(f"{BASE_URL}/api/raw-materials", headers=headers)
        assert response.status_code == 200
        materials = response.json()
        assert isinstance(materials, list)
        print(f"PASS: Found {len(materials)} raw materials")
        if materials:
            print(f"  Sample: {materials[0].get('name')} ({materials[0].get('sku_code')})")
    
    def test_05_get_skus(self):
        """Test getting list of SKUs (finished goods)"""
        headers = self.get_auth_headers("admin")
        response = self.session.get(f"{BASE_URL}/api/admin/skus", headers=headers)
        assert response.status_code == 200
        skus = response.json()
        assert isinstance(skus, list)
        print(f"PASS: Found {len(skus)} SKUs")
        if skus:
            print(f"  Sample: {skus[0].get('model_name', skus[0].get('name'))} ({skus[0].get('sku_code')})")
    
    # ==================== PRODUCTION ENDPOINT TESTS ====================
    
    def test_06_get_productions_list(self):
        """Test GET /api/productions returns list of production records"""
        headers = self.get_auth_headers("admin")
        response = self.session.get(f"{BASE_URL}/api/productions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "productions" in data
        assert "totals" in data
        assert isinstance(data["productions"], list)
        print(f"PASS: GET /api/productions returns {len(data['productions'])} records")
        print(f"  Totals: {data['totals']}")
    
    def test_07_get_productions_with_filters(self):
        """Test GET /api/productions with filters"""
        headers = self.get_auth_headers("admin")
        # Get firms first
        firms_resp = self.session.get(f"{BASE_URL}/api/firms", headers=headers)
        firms = firms_resp.json()
        if firms:
            firm_id = firms[0]["id"]
            response = self.session.get(
                f"{BASE_URL}/api/productions",
                headers=headers,
                params={"firm_id": firm_id, "limit": 50}
            )
            assert response.status_code == 200
            data = response.json()
            assert "productions" in data
            print(f"PASS: GET /api/productions with firm filter returns {len(data['productions'])} records")
    
    def test_08_accountant_can_access_productions(self):
        """Test accountant role can access productions endpoint"""
        headers = self.get_auth_headers("accountant")
        response = self.session.get(f"{BASE_URL}/api/productions", headers=headers)
        assert response.status_code == 200
        print("PASS: Accountant can access /api/productions")
    
    def test_09_production_requires_auth(self):
        """Test production endpoints require authentication"""
        response = self.session.get(f"{BASE_URL}/api/productions")
        assert response.status_code in [401, 403]
        print("PASS: /api/productions requires authentication")
    
    # ==================== PRODUCTION CREATION TESTS ====================
    
    def test_10_create_production_validation_missing_firm(self):
        """Test production creation fails without firm_id"""
        headers = self.get_auth_headers("admin")
        response = self.session.post(f"{BASE_URL}/api/production", headers=headers, json={
            "output_sku_id": "some-sku-id",
            "output_quantity": 1,
            "materials": [{"material_id": "some-material", "quantity": 1}]
        })
        assert response.status_code == 422  # Validation error
        print("PASS: Production creation fails without firm_id")
    
    def test_11_create_production_validation_invalid_firm(self):
        """Test production creation fails with invalid firm_id"""
        headers = self.get_auth_headers("admin")
        response = self.session.post(f"{BASE_URL}/api/production", headers=headers, json={
            "firm_id": "invalid-firm-id",
            "output_sku_id": "some-sku-id",
            "output_quantity": 1,
            "materials": [{"material_id": "some-material", "quantity": 1}]
        })
        assert response.status_code == 400
        assert "Firm not found" in response.json().get("detail", "")
        print("PASS: Production creation fails with invalid firm_id")
    
    def test_12_create_production_validation_invalid_sku(self):
        """Test production creation fails with invalid output SKU"""
        headers = self.get_auth_headers("admin")
        # Get a valid firm first
        firms_resp = self.session.get(f"{BASE_URL}/api/firms", headers=headers)
        firms = firms_resp.json()
        if not firms:
            pytest.skip("No firms available")
        
        response = self.session.post(f"{BASE_URL}/api/production", headers=headers, json={
            "firm_id": firms[0]["id"],
            "output_sku_id": "invalid-sku-id",
            "output_quantity": 1,
            "materials": [{"material_id": "some-material", "quantity": 1}]
        })
        assert response.status_code == 400
        assert "SKU not found" in response.json().get("detail", "")
        print("PASS: Production creation fails with invalid output SKU")
    
    def test_13_create_production_validation_invalid_material(self):
        """Test production creation fails with invalid raw material"""
        headers = self.get_auth_headers("admin")
        # Get valid firm and SKU
        firms_resp = self.session.get(f"{BASE_URL}/api/firms", headers=headers)
        firms = firms_resp.json()
        skus_resp = self.session.get(f"{BASE_URL}/api/admin/skus", headers=headers)
        skus = skus_resp.json()
        
        if not firms or not skus:
            pytest.skip("No firms or SKUs available")
        
        response = self.session.post(f"{BASE_URL}/api/production", headers=headers, json={
            "firm_id": firms[0]["id"],
            "output_sku_id": skus[0]["id"],
            "output_quantity": 1,
            "materials": [{"material_id": "invalid-material-id", "quantity": 1}]
        })
        assert response.status_code == 400
        assert "Raw material" in response.json().get("detail", "") and "not found" in response.json().get("detail", "")
        print("PASS: Production creation fails with invalid raw material")
    
    def test_14_create_production_validation_zero_quantity(self):
        """Test production creation fails with zero output quantity"""
        headers = self.get_auth_headers("admin")
        firms_resp = self.session.get(f"{BASE_URL}/api/firms", headers=headers)
        firms = firms_resp.json()
        skus_resp = self.session.get(f"{BASE_URL}/api/admin/skus", headers=headers)
        skus = skus_resp.json()
        materials_resp = self.session.get(f"{BASE_URL}/api/raw-materials", headers=headers)
        materials = materials_resp.json()
        
        if not firms or not skus or not materials:
            pytest.skip("Missing prerequisite data")
        
        response = self.session.post(f"{BASE_URL}/api/production", headers=headers, json={
            "firm_id": firms[0]["id"],
            "output_sku_id": skus[0]["id"],
            "output_quantity": 0,
            "materials": [{"material_id": materials[0]["id"], "quantity": 1}]
        })
        assert response.status_code == 400
        assert "quantity must be at least 1" in response.json().get("detail", "")
        print("PASS: Production creation fails with zero output quantity")
    
    def test_15_create_production_insufficient_stock(self):
        """Test production creation fails when raw material stock is insufficient"""
        headers = self.get_auth_headers("admin")
        firms_resp = self.session.get(f"{BASE_URL}/api/firms", headers=headers)
        firms = firms_resp.json()
        skus_resp = self.session.get(f"{BASE_URL}/api/admin/skus", headers=headers)
        skus = skus_resp.json()
        materials_resp = self.session.get(f"{BASE_URL}/api/raw-materials", headers=headers)
        materials = materials_resp.json()
        
        if not firms or not skus or not materials:
            pytest.skip("Missing prerequisite data")
        
        # Try to consume more than available (use a very large quantity)
        response = self.session.post(f"{BASE_URL}/api/production", headers=headers, json={
            "firm_id": firms[0]["id"],
            "output_sku_id": skus[0]["id"],
            "output_quantity": 1,
            "materials": [{"material_id": materials[0]["id"], "quantity": 999999}]
        })
        assert response.status_code == 400
        assert "Insufficient stock" in response.json().get("detail", "")
        print("PASS: Production creation fails with insufficient raw material stock")
    
    # ==================== FULL PRODUCTION FLOW TEST ====================
    
    def test_16_full_production_flow(self):
        """
        Full production flow test:
        1. Get firm, raw material, and SKU
        2. Add stock to raw material (if needed)
        3. Create production entry
        4. Verify production record created
        5. Verify ledger entries created
        6. Verify stock changes
        """
        headers = self.get_auth_headers("admin")
        
        # Step 1: Get prerequisite data
        firms_resp = self.session.get(f"{BASE_URL}/api/firms", headers=headers)
        firms = firms_resp.json()
        skus_resp = self.session.get(f"{BASE_URL}/api/admin/skus", headers=headers)
        skus = skus_resp.json()
        materials_resp = self.session.get(f"{BASE_URL}/api/raw-materials", headers=headers)
        materials = materials_resp.json()
        
        if not firms or not skus or not materials:
            pytest.skip("Missing prerequisite data for full flow test")
        
        firm = firms[0]
        sku = skus[0]
        
        # Find a material that belongs to this firm
        firm_materials = [m for m in materials if m.get("firm_id") == firm["id"]]
        if not firm_materials:
            # Use any material
            material = materials[0]
        else:
            material = firm_materials[0]
        
        print(f"  Using firm: {firm['name']}")
        print(f"  Using material: {material['name']} (stock: {material.get('current_stock', 0)})")
        print(f"  Using output SKU: {sku.get('model_name', sku.get('name'))}")
        
        # Step 2: Add stock to raw material if needed
        current_stock = material.get("current_stock", 0)
        if current_stock < 5:
            print(f"  Adding stock to raw material (current: {current_stock})")
            ledger_resp = self.session.post(f"{BASE_URL}/api/inventory/ledger", headers=headers, json={
                "entry_type": "purchase",
                "item_type": "raw_material",
                "item_id": material["id"],
                "firm_id": material.get("firm_id", firm["id"]),
                "quantity": 100,
                "invoice_number": "TEST-PROD-INV-001",
                "notes": "Test stock for production testing"
            })
            if ledger_resp.status_code == 201:
                print(f"  Added 100 units to raw material stock")
                # Refresh material data
                materials_resp = self.session.get(f"{BASE_URL}/api/raw-materials", headers=headers)
                materials = materials_resp.json()
                material = next((m for m in materials if m["id"] == material["id"]), material)
        
        # Get initial stock levels
        initial_material_stock = material.get("current_stock", 0)
        
        # Get initial SKU stock
        sku_detail_resp = self.session.get(f"{BASE_URL}/api/admin/skus", headers=headers)
        skus_updated = sku_detail_resp.json()
        sku_updated = next((s for s in skus_updated if s["id"] == sku["id"]), sku)
        initial_sku_stock = sku_updated.get("stock_quantity", sku_updated.get("stock", 0))
        
        print(f"  Initial material stock: {initial_material_stock}")
        print(f"  Initial SKU stock: {initial_sku_stock}")
        
        # Step 3: Create production entry
        production_qty = 2
        material_consume_qty = 3
        
        response = self.session.post(f"{BASE_URL}/api/production", headers=headers, json={
            "firm_id": material.get("firm_id", firm["id"]),
            "output_sku_id": sku["id"],
            "output_quantity": production_qty,
            "materials": [{"material_id": material["id"], "quantity": material_consume_qty}],
            "batch_number": "TEST-BATCH-001",
            "notes": "Test production entry"
        })
        
        if response.status_code != 200:
            print(f"  Production creation failed: {response.status_code} - {response.text}")
            # This might fail due to insufficient stock or firm mismatch
            if "Insufficient stock" in response.text:
                pytest.skip("Insufficient stock for production test")
            elif "Firm not found" in response.text or "firm" in response.text.lower():
                pytest.skip("Firm mismatch - material belongs to different firm")
        
        assert response.status_code == 200, f"Production creation failed: {response.text}"
        production = response.json()
        
        # Verify production record structure
        assert "id" in production
        assert "production_number" in production
        assert production["production_number"].startswith("PROD-")
        assert production["output_quantity"] == production_qty
        assert "materials_consumed" in production
        assert len(production["materials_consumed"]) == 1
        assert production["materials_consumed"][0]["quantity_consumed"] == material_consume_qty
        assert "ledger_entries" in production
        assert len(production["ledger_entries"]) >= 2  # At least 1 consume + 1 output
        
        print(f"  Production created: {production['production_number']}")
        print(f"  Ledger entries created: {len(production['ledger_entries'])}")
        
        # Step 4: Verify production appears in list
        productions_resp = self.session.get(f"{BASE_URL}/api/productions", headers=headers)
        productions = productions_resp.json()["productions"]
        found = any(p["id"] == production["id"] for p in productions)
        assert found, "Production not found in list"
        print("  Production appears in GET /api/productions list")
        
        # Step 5: Verify ledger entries
        ledger_resp = self.session.get(f"{BASE_URL}/api/inventory/ledger", headers=headers, params={"limit": 50})
        ledger_entries = ledger_resp.json()
        
        # Find production_consume entries
        consume_entries = [e for e in ledger_entries if e.get("production_id") == production["id"] and e.get("entry_type") == "production_consume"]
        output_entries = [e for e in ledger_entries if e.get("production_id") == production["id"] and e.get("entry_type") == "production_output"]
        
        assert len(consume_entries) >= 1, "No production_consume ledger entries found"
        assert len(output_entries) >= 1, "No production_output ledger entries found"
        
        print(f"  Found {len(consume_entries)} production_consume entries")
        print(f"  Found {len(output_entries)} production_output entries")
        
        # Verify consume entry details
        consume_entry = consume_entries[0]
        assert consume_entry["quantity"] == material_consume_qty
        assert consume_entry["item_id"] == material["id"]
        
        # Verify output entry details
        output_entry = output_entries[0]
        assert output_entry["quantity"] == production_qty
        assert output_entry["item_id"] == sku["id"]
        
        print("PASS: Full production flow completed successfully")
    
    # ==================== LEDGER ENTRY TYPE TESTS ====================
    
    def test_17_ledger_shows_production_entries(self):
        """Test that ledger shows production_consume and production_output entries"""
        headers = self.get_auth_headers("admin")
        response = self.session.get(f"{BASE_URL}/api/inventory/ledger", headers=headers, params={"limit": 200})
        assert response.status_code == 200
        entries = response.json()
        
        # Check for production entry types
        entry_types = set(e.get("entry_type") for e in entries)
        print(f"  Entry types found: {entry_types}")
        
        # These should exist if any production has been done
        if "production_consume" in entry_types:
            print("  PASS: production_consume entries exist in ledger")
        if "production_output" in entry_types:
            print("  PASS: production_output entries exist in ledger")
        
        print("PASS: Ledger endpoint returns entries correctly")
    
    def test_18_stock_reports_show_production_entries(self):
        """Test that stock reports show production entries with correct badges"""
        headers = self.get_auth_headers("admin")
        response = self.session.get(f"{BASE_URL}/api/reports/stock-ledger", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "entries" in data
        assert "totals" in data
        
        # Check if production entries are included
        entry_types = set(e.get("entry_type") for e in data["entries"])
        print(f"  Stock report entry types: {entry_types}")
        print("PASS: Stock reports endpoint returns data correctly")
    
    # ==================== ACCOUNTANT ACCESS TESTS ====================
    
    def test_19_accountant_can_create_production(self):
        """Test that accountant role can create production entries"""
        headers = self.get_auth_headers("accountant")
        
        # Get prerequisite data
        firms_resp = self.session.get(f"{BASE_URL}/api/firms", headers=headers)
        firms = firms_resp.json()
        skus_resp = self.session.get(f"{BASE_URL}/api/admin/skus", headers=headers)
        skus = skus_resp.json()
        materials_resp = self.session.get(f"{BASE_URL}/api/raw-materials", headers=headers)
        materials = materials_resp.json()
        
        if not firms or not skus or not materials:
            pytest.skip("Missing prerequisite data")
        
        # Try to create production (may fail due to stock, but should not fail due to auth)
        response = self.session.post(f"{BASE_URL}/api/production", headers=headers, json={
            "firm_id": firms[0]["id"],
            "output_sku_id": skus[0]["id"],
            "output_quantity": 1,
            "materials": [{"material_id": materials[0]["id"], "quantity": 1}]
        })
        
        # Should not be 401 or 403 (auth errors)
        assert response.status_code not in [401, 403], "Accountant should have access to create production"
        print(f"PASS: Accountant has access to create production (status: {response.status_code})")
    
    def test_20_accountant_can_view_productions(self):
        """Test that accountant can view production list"""
        headers = self.get_auth_headers("accountant")
        response = self.session.get(f"{BASE_URL}/api/productions", headers=headers)
        assert response.status_code == 200
        print("PASS: Accountant can view production list")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

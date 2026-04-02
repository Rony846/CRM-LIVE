"""
Test Purchase Entry with Supplier from Party Master
Tests:
1. GET /api/parties - Returns suppliers when filtered
2. POST /api/purchases - Works with supplier from Party Master
3. GET /api/admin/excel/sources - Includes 'parties' data source
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"


class TestPurchaseSupplierParties:
    """Test Purchase Entry with Supplier from Party Master"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    # ==================== PARTIES API TESTS ====================
    
    def test_get_parties_returns_suppliers(self, auth_headers):
        """Test GET /api/parties returns suppliers when filtered"""
        response = requests.get(
            f"{BASE_URL}/api/parties",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get parties: {response.text}"
        
        parties = response.json()
        assert isinstance(parties, list), "Response should be a list"
        
        # Filter suppliers client-side (as frontend does)
        suppliers = [p for p in parties if p.get("party_types") and "supplier" in p.get("party_types", [])]
        print(f"Total parties: {len(parties)}, Suppliers: {len(suppliers)}")
        
        # Verify supplier structure
        if suppliers:
            supplier = suppliers[0]
            assert "id" in supplier, "Supplier should have id"
            assert "name" in supplier, "Supplier should have name"
            assert "party_types" in supplier, "Supplier should have party_types"
            assert "supplier" in supplier["party_types"], "Should be a supplier"
            print(f"Sample supplier: {supplier['name']}, GSTIN: {supplier.get('gstin')}, State: {supplier.get('state')}")
    
    def test_get_parties_with_party_type_filter(self, auth_headers):
        """Test GET /api/parties with party_type=supplier filter"""
        response = requests.get(
            f"{BASE_URL}/api/parties?party_type=supplier",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get suppliers: {response.text}"
        
        suppliers = response.json()
        print(f"Suppliers from API filter: {len(suppliers)}")
        
        # All returned should be suppliers
        for supplier in suppliers:
            assert "supplier" in supplier.get("party_types", []), f"Party {supplier.get('name')} is not a supplier"
    
    def test_get_specific_party(self, auth_headers):
        """Test GET /api/parties/{party_id}"""
        # First get list of parties
        response = requests.get(f"{BASE_URL}/api/parties", headers=auth_headers)
        assert response.status_code == 200
        
        parties = response.json()
        if parties:
            party_id = parties[0]["id"]
            
            # Get specific party
            response = requests.get(f"{BASE_URL}/api/parties/{party_id}", headers=auth_headers)
            assert response.status_code == 200, f"Failed to get party: {response.text}"
            
            party = response.json()
            assert party["id"] == party_id
            print(f"Got party: {party['name']}")
    
    # ==================== PURCHASES API TESTS ====================
    
    def test_get_purchases(self, auth_headers):
        """Test GET /api/purchases"""
        response = requests.get(
            f"{BASE_URL}/api/purchases",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get purchases: {response.text}"
        
        data = response.json()
        assert "purchases" in data, "Response should have purchases key"
        print(f"Total purchases: {len(data['purchases'])}")
        
        # Check if any purchase has supplier info
        if data["purchases"]:
            purchase = data["purchases"][0]
            print(f"Sample purchase: {purchase.get('purchase_number')}, Supplier: {purchase.get('supplier_name')}")
    
    def test_get_firms(self, auth_headers):
        """Test GET /api/firms - needed for purchase creation"""
        response = requests.get(f"{BASE_URL}/api/firms", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get firms: {response.text}"
        
        firms = response.json()
        assert isinstance(firms, list), "Response should be a list"
        print(f"Total firms: {len(firms)}")
        
        if firms:
            print(f"Sample firm: {firms[0].get('name')}, State: {firms[0].get('state')}")
    
    def test_get_raw_materials(self, auth_headers):
        """Test GET /api/raw-materials - needed for purchase items"""
        response = requests.get(f"{BASE_URL}/api/raw-materials", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get raw materials: {response.text}"
        
        materials = response.json()
        assert isinstance(materials, list), "Response should be a list"
        print(f"Total raw materials: {len(materials)}")
    
    def test_get_master_skus(self, auth_headers):
        """Test GET /api/master-skus - needed for purchase items"""
        response = requests.get(f"{BASE_URL}/api/master-skus", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get master SKUs: {response.text}"
        
        skus = response.json()
        assert isinstance(skus, list), "Response should be a list"
        print(f"Total master SKUs: {len(skus)}")
    
    # ==================== EXCEL DATA SOURCES TESTS ====================
    
    def test_excel_sources_includes_parties(self, auth_headers):
        """Test GET /api/admin/excel/sources includes 'parties'"""
        response = requests.get(
            f"{BASE_URL}/api/admin/excel/sources",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get excel sources: {response.text}"
        
        sources = response.json()
        assert isinstance(sources, list), "Response should be a list"
        
        # Find parties in sources
        source_names = [s.get("name") or s.get("key") for s in sources]
        print(f"Available data sources: {source_names}")
        
        # Check if parties is in the list
        parties_found = any("parties" in str(s).lower() for s in sources)
        assert parties_found, f"'parties' should be in excel data sources. Found: {source_names}"
        
        # Get parties source details
        parties_source = next((s for s in sources if s.get("name") == "parties" or s.get("key") == "parties"), None)
        if parties_source:
            print(f"Parties source: {parties_source}")
    
    def test_excel_export_parties(self, auth_headers):
        """Test GET /api/admin/excel/export/parties"""
        response = requests.get(
            f"{BASE_URL}/api/admin/excel/export/parties",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to export parties: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "excel" in content_type or "octet-stream" in content_type, \
            f"Expected Excel file, got: {content_type}"
        
        print(f"Parties export successful, size: {len(response.content)} bytes")
    
    def test_excel_template_parties(self, auth_headers):
        """Test GET /api/admin/excel/template/parties"""
        response = requests.get(
            f"{BASE_URL}/api/admin/excel/template/parties",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get parties template: {response.text}"
        
        print(f"Parties template successful, size: {len(response.content)} bytes")
    
    # ==================== PURCHASE CREATION TEST ====================
    
    def test_create_purchase_with_supplier(self, auth_headers):
        """Test POST /api/purchases with supplier from Party Master"""
        # Get a firm
        firms_response = requests.get(f"{BASE_URL}/api/firms", headers=auth_headers)
        firms = firms_response.json()
        if not firms:
            pytest.skip("No firms available for testing")
        firm = firms[0]
        
        # Get suppliers
        parties_response = requests.get(f"{BASE_URL}/api/parties?party_type=supplier", headers=auth_headers)
        suppliers = parties_response.json()
        if not suppliers:
            pytest.skip("No suppliers available for testing")
        supplier = suppliers[0]
        
        # Get raw materials
        materials_response = requests.get(f"{BASE_URL}/api/raw-materials", headers=auth_headers)
        materials = materials_response.json()
        if not materials:
            pytest.skip("No raw materials available for testing")
        material = materials[0]
        
        # Create purchase payload
        import uuid
        purchase_payload = {
            "firm_id": firm["id"],
            "supplier_id": supplier["id"],
            "supplier_name": supplier["name"],
            "supplier_gstin": supplier.get("gstin", ""),
            "supplier_state": supplier.get("state", "Delhi"),
            "invoice_number": f"TEST-INV-{uuid.uuid4().hex[:8].upper()}",
            "invoice_date": "2026-01-15",
            "items": [{
                "item_type": "raw_material",
                "item_id": material["id"],
                "quantity": 1,
                "rate": 100.0,
                "gst_rate": material.get("gst_rate", 18)
            }],
            "notes": "Test purchase from pytest",
            "save_as_draft": True  # Save as draft to avoid compliance issues
        }
        
        response = requests.post(
            f"{BASE_URL}/api/purchases",
            json=purchase_payload,
            headers=auth_headers
        )
        
        # Should succeed (201) or return compliance warning (200 with draft)
        assert response.status_code in [200, 201], f"Failed to create purchase: {response.text}"
        
        data = response.json()
        purchase_number = data.get('purchase_number')
        print(f"Created purchase: {purchase_number}, Status: {data.get('status')}")
        
        # Verify purchase was created by fetching it
        get_response = requests.get(f"{BASE_URL}/api/purchases", headers=auth_headers)
        assert get_response.status_code == 200
        
        purchases = get_response.json().get("purchases", [])
        created_purchase = next((p for p in purchases if p.get("purchase_number") == purchase_number), None)
        
        assert created_purchase is not None, f"Purchase {purchase_number} not found in list"
        assert created_purchase.get("supplier_name") == supplier["name"], "Supplier name should match"
        print(f"Verified purchase has supplier: {created_purchase.get('supplier_name')}")


class TestPartyMasterCRUD:
    """Test Party Master CRUD operations"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_create_supplier_party(self, auth_headers):
        """Test creating a new supplier in Party Master"""
        import uuid
        
        party_data = {
            "name": f"TEST Supplier {uuid.uuid4().hex[:6].upper()}",
            "party_types": ["supplier"],
            "gstin": None,  # Optional
            "state": "Maharashtra",
            "address": "Test Address",
            "city": "Mumbai",
            "pincode": "400001",
            "phone": f"98{uuid.uuid4().hex[:8][:8]}",
            "email": f"test.supplier.{uuid.uuid4().hex[:6]}@example.com",
            "contact_person": "Test Contact"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/parties",
            json=party_data,
            headers=auth_headers
        )
        
        assert response.status_code in [200, 201], f"Failed to create party: {response.text}"
        
        party = response.json()
        assert party["name"] == party_data["name"]
        assert "supplier" in party["party_types"]
        print(f"Created supplier party: {party['name']}, ID: {party['id']}")
        
        return party["id"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

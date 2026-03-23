"""
Test Suite for Master SKU, Raw Material Creation Forms and Purchase Workflow
Tests:
1. Master SKU creation with mandatory fields (hsn_code, gst_rate, cost_price)
2. Raw Material creation with mandatory fields (hsn_code, gst_rate, cost_price)
3. Form validation errors when mandatory fields are missing
4. Purchase Register - create a new purchase entry
5. Purchase entry updates inventory stock levels
6. Finance & GST Dashboard shows updated ITC values from purchases
"""

import pytest
import requests
import os
import time
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://crm-rebuild-11.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"
ACCOUNTANT_EMAIL = "aman@musclegrid.in"
ACCOUNTANT_PASSWORD = "Muscle@846"


def generate_unique_code(prefix="TEST"):
    """Generate unique code for test data"""
    return f"{prefix}-{random.randint(10000, 99999)}"


class TestAuthAndSetup:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"Admin login successful: {data['user']['email']}")
        return data["access_token"]
    
    def test_accountant_login(self):
        """Test accountant login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        assert response.status_code == 200, f"Accountant login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "accountant"
        print(f"Accountant login successful: {data['user']['email']}")
        return data["access_token"]


class TestMasterSKUCreation:
    """Test Master SKU creation with mandatory fields"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_create_master_sku_with_all_mandatory_fields(self, admin_token):
        """Test creating Master SKU with all mandatory fields (hsn_code, gst_rate, cost_price)"""
        sku_code = generate_unique_code("SKU")
        payload = {
            "name": f"Test Inverter {sku_code}",
            "sku_code": sku_code,
            "category": "Inverter",
            "hsn_code": "85044090",
            "gst_rate": 18.0,
            "cost_price": 5000.0,
            "unit": "pcs",
            "is_manufactured": False,
            "reorder_level": 10
        }
        
        response = requests.post(
            f"{BASE_URL}/api/master-skus",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to create Master SKU: {response.text}"
        data = response.json()
        assert data["sku_code"] == sku_code
        assert data["hsn_code"] == "85044090"
        assert data["gst_rate"] == 18.0
        assert data["cost_price"] == 5000.0
        print(f"Master SKU created successfully: {data['sku_code']} with HSN: {data['hsn_code']}, GST: {data['gst_rate']}%, Cost: {data['cost_price']}")
        return data
    
    def test_create_master_sku_missing_hsn_code(self, admin_token):
        """Test that Master SKU creation fails without hsn_code (validation at frontend level)"""
        # Note: Backend model has hsn_code as mandatory, so this should fail
        sku_code = generate_unique_code("SKU")
        payload = {
            "name": f"Test Inverter {sku_code}",
            "sku_code": sku_code,
            "category": "Inverter",
            # Missing hsn_code
            "gst_rate": 18.0,
            "cost_price": 5000.0,
            "unit": "pcs"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/master-skus",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should fail with 422 validation error
        assert response.status_code == 422, f"Expected 422 for missing hsn_code, got {response.status_code}: {response.text}"
        print("Correctly rejected Master SKU creation without hsn_code")
    
    def test_create_master_sku_missing_gst_rate(self, admin_token):
        """Test that Master SKU creation fails without gst_rate"""
        sku_code = generate_unique_code("SKU")
        payload = {
            "name": f"Test Inverter {sku_code}",
            "sku_code": sku_code,
            "category": "Inverter",
            "hsn_code": "85044090",
            # Missing gst_rate
            "cost_price": 5000.0,
            "unit": "pcs"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/master-skus",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should fail with 422 validation error
        assert response.status_code == 422, f"Expected 422 for missing gst_rate, got {response.status_code}: {response.text}"
        print("Correctly rejected Master SKU creation without gst_rate")
    
    def test_create_master_sku_missing_cost_price(self, admin_token):
        """Test that Master SKU creation fails without cost_price"""
        sku_code = generate_unique_code("SKU")
        payload = {
            "name": f"Test Inverter {sku_code}",
            "sku_code": sku_code,
            "category": "Inverter",
            "hsn_code": "85044090",
            "gst_rate": 18.0,
            # Missing cost_price
            "unit": "pcs"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/master-skus",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should fail with 422 validation error
        assert response.status_code == 422, f"Expected 422 for missing cost_price, got {response.status_code}: {response.text}"
        print("Correctly rejected Master SKU creation without cost_price")


class TestRawMaterialCreation:
    """Test Raw Material creation with mandatory fields"""
    
    @pytest.fixture
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_create_raw_material_with_all_mandatory_fields(self, accountant_token):
        """Test creating Raw Material with all mandatory fields (hsn_code, gst_rate, cost_price)"""
        sku_code = generate_unique_code("RM")
        payload = {
            "name": f"Test Copper Wire {sku_code}",
            "sku_code": sku_code,
            "unit": "kg",
            "hsn_code": "7408",
            "gst_rate": 18.0,
            "cost_price": 500.0,
            "reorder_level": 50
        }
        
        response = requests.post(
            f"{BASE_URL}/api/raw-materials",
            json=payload,
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        assert response.status_code == 200, f"Failed to create Raw Material: {response.text}"
        data = response.json()
        assert data["sku_code"] == sku_code
        assert data["hsn_code"] == "7408"
        assert data["gst_rate"] == 18.0
        assert data["cost_price"] == 500.0
        print(f"Raw Material created successfully: {data['sku_code']} with HSN: {data['hsn_code']}, GST: {data['gst_rate']}%, Cost: {data['cost_price']}")
        return data
    
    def test_create_raw_material_missing_hsn_code(self, accountant_token):
        """Test that Raw Material creation fails without hsn_code"""
        sku_code = generate_unique_code("RM")
        payload = {
            "name": f"Test Material {sku_code}",
            "sku_code": sku_code,
            "unit": "kg",
            # Missing hsn_code
            "gst_rate": 18.0,
            "cost_price": 500.0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/raw-materials",
            json=payload,
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        # Should fail with 422 validation error
        assert response.status_code == 422, f"Expected 422 for missing hsn_code, got {response.status_code}: {response.text}"
        print("Correctly rejected Raw Material creation without hsn_code")
    
    def test_create_raw_material_missing_gst_rate(self, accountant_token):
        """Test that Raw Material creation fails without gst_rate"""
        sku_code = generate_unique_code("RM")
        payload = {
            "name": f"Test Material {sku_code}",
            "sku_code": sku_code,
            "unit": "kg",
            "hsn_code": "7408",
            # Missing gst_rate
            "cost_price": 500.0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/raw-materials",
            json=payload,
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        # Should fail with 422 validation error
        assert response.status_code == 422, f"Expected 422 for missing gst_rate, got {response.status_code}: {response.text}"
        print("Correctly rejected Raw Material creation without gst_rate")
    
    def test_create_raw_material_missing_cost_price(self, accountant_token):
        """Test that Raw Material creation fails without cost_price"""
        sku_code = generate_unique_code("RM")
        payload = {
            "name": f"Test Material {sku_code}",
            "sku_code": sku_code,
            "unit": "kg",
            "hsn_code": "7408",
            "gst_rate": 18.0
            # Missing cost_price
        }
        
        response = requests.post(
            f"{BASE_URL}/api/raw-materials",
            json=payload,
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        # Should fail with 422 validation error
        assert response.status_code == 422, f"Expected 422 for missing cost_price, got {response.status_code}: {response.text}"
        print("Correctly rejected Raw Material creation without cost_price")


class TestPurchaseWorkflow:
    """Test Purchase Register workflow"""
    
    @pytest.fixture
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def setup_test_data(self, accountant_token):
        """Setup test data: firm and raw material"""
        # Get existing firms
        firms_response = requests.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        firms = firms_response.json()
        
        if not firms:
            pytest.skip("No firms available for testing")
        
        firm = firms[0]
        
        # Get existing raw materials
        rm_response = requests.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        raw_materials = rm_response.json()
        
        if not raw_materials:
            # Create a raw material for testing
            sku_code = generate_unique_code("RM")
            rm_payload = {
                "name": f"Test Material {sku_code}",
                "sku_code": sku_code,
                "unit": "pcs",
                "hsn_code": "7408",
                "gst_rate": 18.0,
                "cost_price": 100.0,
                "reorder_level": 10
            }
            rm_create_response = requests.post(
                f"{BASE_URL}/api/raw-materials",
                json=rm_payload,
                headers={"Authorization": f"Bearer {accountant_token}"}
            )
            raw_material = rm_create_response.json()
        else:
            raw_material = raw_materials[0]
        
        return {"firm": firm, "raw_material": raw_material}
    
    def test_create_purchase_entry(self, accountant_token, setup_test_data):
        """Test creating a purchase entry"""
        firm = setup_test_data["firm"]
        raw_material = setup_test_data["raw_material"]
        
        invoice_number = f"INV-{generate_unique_code('PUR')}"
        
        payload = {
            "firm_id": firm["id"],
            "supplier_name": "Test Supplier Pvt Ltd",
            "supplier_gstin": "27AAAAA0000A1Z5",
            "supplier_state": firm.get("state", "Maharashtra"),
            "invoice_number": invoice_number,
            "invoice_date": "2026-01-15",
            "items": [
                {
                    "item_type": "raw_material",
                    "item_id": raw_material["id"],
                    "quantity": 100,
                    "rate": 100.0,
                    "gst_rate": 18.0
                }
            ],
            "notes": "Test purchase for inventory testing"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/purchases",
            json=payload,
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        assert response.status_code == 200, f"Failed to create purchase: {response.text}"
        data = response.json()
        assert "purchase_number" in data
        assert data["invoice_number"] == invoice_number
        print(f"Purchase created successfully: {data['purchase_number']}")
        return data
    
    def test_list_purchases(self, accountant_token):
        """Test listing purchases"""
        response = requests.get(
            f"{BASE_URL}/api/purchases",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        assert response.status_code == 200, f"Failed to list purchases: {response.text}"
        data = response.json()
        assert "purchases" in data
        assert "summary" in data
        print(f"Listed {len(data['purchases'])} purchases. Summary: Total Amount = {data['summary'].get('total_amount', 0)}")
        return data
    
    def test_purchase_updates_inventory_stock(self, accountant_token, setup_test_data):
        """Test that purchase entry updates inventory stock levels"""
        firm = setup_test_data["firm"]
        raw_material = setup_test_data["raw_material"]
        
        # Get current stock before purchase
        stock_response_before = requests.get(
            f"{BASE_URL}/api/inventory/stock",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        stock_before = stock_response_before.json()
        
        # Find current stock for this raw material at this firm
        current_stock = 0
        for rm in stock_before.get("raw_materials", []):
            if rm.get("item_id") == raw_material["id"] and rm.get("firm_id") == firm["id"]:
                current_stock = rm.get("current_stock", 0)
                break
        
        # Create a purchase
        invoice_number = f"INV-{generate_unique_code('STK')}"
        purchase_qty = 50
        
        payload = {
            "firm_id": firm["id"],
            "supplier_name": "Stock Test Supplier",
            "supplier_gstin": "27BBBBB0000B1Z5",
            "supplier_state": firm.get("state", "Maharashtra"),
            "invoice_number": invoice_number,
            "invoice_date": "2026-01-15",
            "items": [
                {
                    "item_type": "raw_material",
                    "item_id": raw_material["id"],
                    "quantity": purchase_qty,
                    "rate": 100.0,
                    "gst_rate": 18.0
                }
            ]
        }
        
        purchase_response = requests.post(
            f"{BASE_URL}/api/purchases",
            json=payload,
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        assert purchase_response.status_code == 200, f"Failed to create purchase: {purchase_response.text}"
        
        # Get stock after purchase
        stock_response_after = requests.get(
            f"{BASE_URL}/api/inventory/stock",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        stock_after = stock_response_after.json()
        
        # Find new stock for this raw material at this firm
        new_stock = 0
        for rm in stock_after.get("raw_materials", []):
            if rm.get("item_id") == raw_material["id"] and rm.get("firm_id") == firm["id"]:
                new_stock = rm.get("current_stock", 0)
                break
        
        # Verify stock increased
        expected_stock = current_stock + purchase_qty
        assert new_stock == expected_stock, f"Stock not updated correctly. Expected {expected_stock}, got {new_stock}"
        print(f"Stock updated correctly: {current_stock} -> {new_stock} (added {purchase_qty})")


class TestFinanceDashboard:
    """Test Finance & GST Dashboard"""
    
    @pytest.fixture
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_finance_dashboard_loads(self, accountant_token):
        """Test that Finance Dashboard loads successfully"""
        response = requests.get(
            f"{BASE_URL}/api/finance/dashboard",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        assert response.status_code == 200, f"Failed to load finance dashboard: {response.text}"
        data = response.json()
        assert "total_inventory_value" in data
        assert "total_gst_liability" in data
        assert "firm_summaries" in data
        print(f"Finance Dashboard loaded. Total Inventory Value: {data.get('total_inventory_value', 0)}, GST Liability: {data.get('total_gst_liability', 0)}")
        return data
    
    def test_itc_from_purchases(self, accountant_token):
        """Test ITC calculation from purchases"""
        # Get firms first
        firms_response = requests.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        firms = firms_response.json()
        
        if not firms:
            pytest.skip("No firms available for testing")
        
        firm_id = firms[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/finance/itc-from-purchases?firm_id={firm_id}",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get ITC from purchases: {response.text}"
        data = response.json()
        print(f"ITC from purchases: {data}")
        return data
    
    def test_inventory_valuation(self, accountant_token):
        """Test inventory valuation endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/finance/inventory-valuation",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get inventory valuation: {response.text}"
        data = response.json()
        assert "firms" in data or "grand_total" in data
        print(f"Inventory Valuation: Grand Total = {data.get('grand_total', 0)}")
        return data


class TestExistingData:
    """Test existing data in the system"""
    
    @pytest.fixture
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_list_firms(self, accountant_token):
        """Test listing firms"""
        response = requests.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        assert response.status_code == 200, f"Failed to list firms: {response.text}"
        firms = response.json()
        print(f"Found {len(firms)} firms")
        for firm in firms[:3]:
            print(f"  - {firm.get('name')} ({firm.get('gstin')})")
        return firms
    
    def test_list_master_skus(self, accountant_token):
        """Test listing Master SKUs"""
        response = requests.get(
            f"{BASE_URL}/api/master-skus",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        assert response.status_code == 200, f"Failed to list Master SKUs: {response.text}"
        skus = response.json()
        print(f"Found {len(skus)} Master SKUs")
        for sku in skus[:3]:
            print(f"  - {sku.get('sku_code')}: {sku.get('name')} (HSN: {sku.get('hsn_code')}, GST: {sku.get('gst_rate')}%)")
        return skus
    
    def test_list_raw_materials(self, accountant_token):
        """Test listing Raw Materials"""
        response = requests.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        assert response.status_code == 200, f"Failed to list Raw Materials: {response.text}"
        materials = response.json()
        print(f"Found {len(materials)} Raw Materials")
        for rm in materials[:3]:
            print(f"  - {rm.get('sku_code')}: {rm.get('name')} (HSN: {rm.get('hsn_code')}, GST: {rm.get('gst_rate')}%)")
        return materials


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

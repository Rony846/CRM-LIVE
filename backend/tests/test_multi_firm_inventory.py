"""
Test Suite for Multi-Firm Inventory & Compliance System - Phase 1
Tests: Firm CRUD, Raw Material CRUD, Inventory Ledger, Stock Transfers, Stock Validation
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"
ACCOUNTANT_EMAIL = "accountant@musclegrid.in"
ACCOUNTANT_PASSWORD = "Muscle@846"


class TestAuthentication:
    """Authentication tests for admin and accountant"""
    
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
        print(f"✓ Admin login successful")
    
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
        print(f"✓ Accountant login successful")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def accountant_token():
    """Get accountant authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ACCOUNTANT_EMAIL,
        "password": ACCOUNTANT_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Accountant authentication failed")


class TestFirmCRUD:
    """Test Firm CRUD operations"""
    
    def test_list_firms(self, admin_token):
        """Test GET /api/firms - List all firms"""
        response = requests.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"List firms failed: {response.text}"
        firms = response.json()
        assert isinstance(firms, list)
        print(f"✓ Listed {len(firms)} firms")
        
        # Verify existing firms from context
        firm_names = [f["name"] for f in firms]
        assert any("MuscleGrid" in name for name in firm_names), "Expected MuscleGrid firms not found"
    
    def test_list_active_firms_only(self, admin_token):
        """Test GET /api/firms?is_active=true - List only active firms"""
        response = requests.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"is_active": True}
        )
        assert response.status_code == 200
        firms = response.json()
        for firm in firms:
            assert firm["is_active"] == True, f"Inactive firm returned: {firm['name']}"
        print(f"✓ Listed {len(firms)} active firms")
    
    def test_create_firm(self, admin_token):
        """Test POST /api/firms - Create a new firm"""
        unique_id = str(uuid.uuid4())[:8]
        firm_data = {
            "name": f"TEST_Firm_{unique_id}",
            "gstin": f"27AABCT{unique_id[:4].upper()}R1ZM",
            "address": "123 Test Street, Test City",
            "state": "Maharashtra",
            "pincode": "400001",
            "contact_person": "Test Contact",
            "phone": "9876543210",
            "email": f"test_{unique_id}@example.com"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=firm_data
        )
        assert response.status_code == 200, f"Create firm failed: {response.text}"
        
        created_firm = response.json()
        assert created_firm["name"] == firm_data["name"]
        assert created_firm["gstin"] == firm_data["gstin"].upper()
        assert created_firm["is_active"] == True
        assert "id" in created_firm
        print(f"✓ Created firm: {created_firm['name']} (ID: {created_firm['id']})")
        
        # Verify persistence with GET
        get_response = requests.get(
            f"{BASE_URL}/api/firms/{created_firm['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200
        fetched_firm = get_response.json()
        assert fetched_firm["name"] == firm_data["name"]
        print(f"✓ Verified firm persistence via GET")
        
        return created_firm["id"]
    
    def test_update_firm(self, admin_token):
        """Test PATCH /api/firms/{id} - Update a firm"""
        # First create a firm to update
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": f"TEST_UpdateFirm_{unique_id}",
                "gstin": f"07AABCU{unique_id[:4].upper()}F1ZP",
                "address": "Original Address",
                "state": "Delhi",
                "pincode": "110001",
                "contact_person": "Original Contact"
            }
        )
        assert create_response.status_code == 200
        firm_id = create_response.json()["id"]
        
        # Update the firm
        update_data = {
            "address": "Updated Address 456",
            "contact_person": "Updated Contact Person"
        }
        update_response = requests.patch(
            f"{BASE_URL}/api/firms/{firm_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=update_data
        )
        assert update_response.status_code == 200, f"Update firm failed: {update_response.text}"
        
        updated_firm = update_response.json()
        assert updated_firm["address"] == update_data["address"]
        assert updated_firm["contact_person"] == update_data["contact_person"]
        print(f"✓ Updated firm successfully")
        
        # Verify persistence
        get_response = requests.get(
            f"{BASE_URL}/api/firms/{firm_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200
        assert get_response.json()["address"] == update_data["address"]
        print(f"✓ Verified update persistence")
    
    def test_duplicate_gstin_rejected(self, admin_token):
        """Test that duplicate GSTIN is rejected"""
        # Get existing firm GSTIN
        firms_response = requests.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        firms = firms_response.json()
        if not firms:
            pytest.skip("No existing firms to test duplicate GSTIN")
        
        existing_gstin = firms[0]["gstin"]
        
        # Try to create firm with same GSTIN
        response = requests.post(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "TEST_DuplicateGSTIN",
                "gstin": existing_gstin,
                "address": "Test Address",
                "state": "Maharashtra",
                "pincode": "400001",
                "contact_person": "Test Contact"
            }
        )
        assert response.status_code == 400, "Duplicate GSTIN should be rejected"
        assert "GSTIN already exists" in response.json().get("detail", "")
        print(f"✓ Duplicate GSTIN correctly rejected")


class TestRawMaterialCRUD:
    """Test Raw Material CRUD operations"""
    
    def test_list_raw_materials(self, accountant_token):
        """Test GET /api/raw-materials - List all raw materials"""
        response = requests.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"List raw materials failed: {response.text}"
        materials = response.json()
        assert isinstance(materials, list)
        print(f"✓ Listed {len(materials)} raw materials")
        
        # Verify existing material from context (Copper Wire 1.5mm)
        if materials:
            material_names = [m["name"] for m in materials]
            print(f"  Materials: {material_names[:5]}...")
    
    def test_list_raw_materials_by_firm(self, accountant_token):
        """Test GET /api/raw-materials?firm_id=xxx - Filter by firm"""
        # Get firms first
        firms_response = requests.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"is_active": True}
        )
        firms = firms_response.json()
        if not firms:
            pytest.skip("No firms available")
        
        firm_id = firms[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"firm_id": firm_id}
        )
        assert response.status_code == 200
        materials = response.json()
        for material in materials:
            assert material["firm_id"] == firm_id
        print(f"✓ Filtered materials by firm: {len(materials)} found")
    
    def test_create_raw_material(self, accountant_token):
        """Test POST /api/raw-materials - Create a new raw material"""
        # Get a firm first
        firms_response = requests.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"is_active": True}
        )
        firms = firms_response.json()
        if not firms:
            pytest.skip("No firms available")
        
        firm_id = firms[0]["id"]
        unique_id = str(uuid.uuid4())[:8]
        
        material_data = {
            "name": f"TEST_Material_{unique_id}",
            "sku_code": f"RM-TEST-{unique_id}",
            "unit": "kg",
            "hsn_code": "7408",
            "reorder_level": 10,
            "firm_id": firm_id
        }
        
        response = requests.post(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"},
            json=material_data
        )
        assert response.status_code == 200, f"Create raw material failed: {response.text}"
        
        created_material = response.json()
        assert created_material["name"] == material_data["name"]
        assert created_material["sku_code"] == material_data["sku_code"].upper()
        assert created_material["current_stock"] == 0  # Stock starts at 0
        assert created_material["firm_id"] == firm_id
        print(f"✓ Created raw material: {created_material['name']} (SKU: {created_material['sku_code']})")
        
        # Verify persistence
        get_response = requests.get(
            f"{BASE_URL}/api/raw-materials/{created_material['id']}",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert get_response.status_code == 200
        assert get_response.json()["name"] == material_data["name"]
        print(f"✓ Verified raw material persistence")
        
        return created_material["id"]
    
    def test_update_raw_material(self, accountant_token):
        """Test PATCH /api/raw-materials/{id} - Update a raw material"""
        # Get existing materials
        materials_response = requests.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        materials = materials_response.json()
        if not materials:
            pytest.skip("No raw materials available")
        
        material_id = materials[0]["id"]
        
        update_data = {
            "reorder_level": 25
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/raw-materials/{material_id}",
            headers={"Authorization": f"Bearer {accountant_token}"},
            json=update_data
        )
        assert response.status_code == 200, f"Update raw material failed: {response.text}"
        
        updated_material = response.json()
        assert updated_material["reorder_level"] == 25
        print(f"✓ Updated raw material reorder level")


class TestInventoryLedger:
    """Test Inventory Ledger operations - the ONLY way to change stock"""
    
    def test_create_purchase_entry(self, accountant_token):
        """Test POST /api/inventory/ledger - Create purchase entry (adds stock)"""
        # Get a raw material
        materials_response = requests.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        materials = materials_response.json()
        if not materials:
            pytest.skip("No raw materials available")
        
        material = materials[0]
        initial_stock = material.get("current_stock", 0)
        
        entry_data = {
            "entry_type": "purchase",
            "item_type": "raw_material",
            "item_id": material["id"],
            "firm_id": material["firm_id"],
            "quantity": 50,
            "unit_price": 100.50,
            "invoice_number": f"TEST-INV-{str(uuid.uuid4())[:8]}",
            "reason": "Test purchase entry"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/inventory/ledger",
            headers={"Authorization": f"Bearer {accountant_token}"},
            json=entry_data
        )
        assert response.status_code == 200, f"Create ledger entry failed: {response.text}"
        
        entry = response.json()
        assert entry["entry_type"] == "purchase"
        assert entry["quantity"] == 50
        assert entry["running_balance"] == initial_stock + 50
        assert "entry_number" in entry
        print(f"✓ Created purchase entry: {entry['entry_number']}")
        print(f"  Running balance: {entry['running_balance']}")
        
        return entry["id"]
    
    def test_create_adjustment_in_entry(self, accountant_token):
        """Test POST /api/inventory/ledger - Create adjustment_in entry"""
        materials_response = requests.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        materials = materials_response.json()
        if not materials:
            pytest.skip("No raw materials available")
        
        material = materials[0]
        
        entry_data = {
            "entry_type": "adjustment_in",
            "item_type": "raw_material",
            "item_id": material["id"],
            "firm_id": material["firm_id"],
            "quantity": 10,
            "reason": "Test adjustment - found extra stock"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/inventory/ledger",
            headers={"Authorization": f"Bearer {accountant_token}"},
            json=entry_data
        )
        assert response.status_code == 200, f"Create adjustment_in failed: {response.text}"
        
        entry = response.json()
        assert entry["entry_type"] == "adjustment_in"
        print(f"✓ Created adjustment_in entry: {entry['entry_number']}")
    
    def test_create_adjustment_out_entry(self, accountant_token):
        """Test POST /api/inventory/ledger - Create adjustment_out entry"""
        materials_response = requests.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        materials = materials_response.json()
        if not materials:
            pytest.skip("No raw materials available")
        
        # Find material with stock
        material = None
        for m in materials:
            if m.get("current_stock", 0) > 5:
                material = m
                break
        
        if not material:
            pytest.skip("No material with sufficient stock")
        
        entry_data = {
            "entry_type": "adjustment_out",
            "item_type": "raw_material",
            "item_id": material["id"],
            "firm_id": material["firm_id"],
            "quantity": 5,
            "reason": "Test adjustment - damaged stock"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/inventory/ledger",
            headers={"Authorization": f"Bearer {accountant_token}"},
            json=entry_data
        )
        assert response.status_code == 200, f"Create adjustment_out failed: {response.text}"
        
        entry = response.json()
        assert entry["entry_type"] == "adjustment_out"
        print(f"✓ Created adjustment_out entry: {entry['entry_number']}")
    
    def test_prevent_negative_stock(self, accountant_token):
        """Test that adjustment_out is rejected when it would cause negative stock"""
        materials_response = requests.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        materials = materials_response.json()
        if not materials:
            pytest.skip("No raw materials available")
        
        material = materials[0]
        current_stock = material.get("current_stock", 0)
        
        # Try to remove more than available
        entry_data = {
            "entry_type": "adjustment_out",
            "item_type": "raw_material",
            "item_id": material["id"],
            "firm_id": material["firm_id"],
            "quantity": current_stock + 1000,  # More than available
            "reason": "Test - should fail"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/inventory/ledger",
            headers={"Authorization": f"Bearer {accountant_token}"},
            json=entry_data
        )
        assert response.status_code == 400, "Should reject negative stock"
        assert "Insufficient stock" in response.json().get("detail", "")
        print(f"✓ Negative stock correctly prevented")
    
    def test_list_ledger_entries(self, accountant_token):
        """Test GET /api/inventory/ledger - List ledger entries"""
        response = requests.get(
            f"{BASE_URL}/api/inventory/ledger",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"limit": 10}
        )
        assert response.status_code == 200, f"List ledger entries failed: {response.text}"
        entries = response.json()
        assert isinstance(entries, list)
        print(f"✓ Listed {len(entries)} ledger entries")
        
        if entries:
            # Verify entry structure
            entry = entries[0]
            assert "entry_number" in entry
            assert "entry_type" in entry
            assert "quantity" in entry
            assert "running_balance" in entry


class TestStockTransfer:
    """Test Stock Transfer operations with mandatory invoice validation"""
    
    def test_transfer_without_invoice_rejected(self, accountant_token):
        """Test that transfer without invoice number is rejected (GST compliance)"""
        # Get firms
        firms_response = requests.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"is_active": True}
        )
        firms = firms_response.json()
        if len(firms) < 2:
            pytest.skip("Need at least 2 firms for transfer test")
        
        # Get materials from first firm
        materials_response = requests.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"firm_id": firms[0]["id"]}
        )
        materials = materials_response.json()
        if not materials:
            pytest.skip("No materials in first firm")
        
        material = None
        for m in materials:
            if m.get("current_stock", 0) > 0:
                material = m
                break
        
        if not material:
            pytest.skip("No material with stock in first firm")
        
        # Try transfer WITHOUT invoice number
        transfer_data = {
            "item_type": "raw_material",
            "item_id": material["id"],
            "from_firm_id": firms[0]["id"],
            "to_firm_id": firms[1]["id"],
            "quantity": 1,
            "invoice_number": "",  # Empty invoice - should fail
            "notes": "Test transfer without invoice"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/inventory/transfer",
            headers={"Authorization": f"Bearer {accountant_token}"},
            json=transfer_data
        )
        assert response.status_code == 400, f"Transfer without invoice should be rejected. Got: {response.status_code}"
        assert "MANDATORY" in response.json().get("detail", "") or "invoice" in response.json().get("detail", "").lower()
        print(f"✓ Transfer without invoice correctly rejected (GST compliance)")
    
    def test_transfer_with_invoice_success(self, accountant_token):
        """Test successful stock transfer with mandatory invoice number"""
        # Get firms
        firms_response = requests.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"is_active": True}
        )
        firms = firms_response.json()
        if len(firms) < 2:
            pytest.skip("Need at least 2 firms for transfer test")
        
        from_firm = firms[0]
        to_firm = firms[1]
        
        # Get materials from source firm with stock
        materials_response = requests.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"firm_id": from_firm["id"]}
        )
        materials = materials_response.json()
        
        material = None
        for m in materials:
            if m.get("current_stock", 0) >= 10:
                material = m
                break
        
        if not material:
            pytest.skip("No material with sufficient stock (>=10) in source firm")
        
        initial_stock = material["current_stock"]
        transfer_qty = 5
        
        # Transfer WITH invoice number
        transfer_data = {
            "item_type": "raw_material",
            "item_id": material["id"],
            "from_firm_id": from_firm["id"],
            "to_firm_id": to_firm["id"],
            "quantity": transfer_qty,
            "invoice_number": f"GST/TRF/TEST/{str(uuid.uuid4())[:8]}",
            "notes": "Test transfer with invoice"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/inventory/transfer",
            headers={"Authorization": f"Bearer {accountant_token}"},
            json=transfer_data
        )
        assert response.status_code == 200, f"Transfer failed: {response.text}"
        
        transfer = response.json()
        assert "transfer_number" in transfer
        assert transfer["quantity"] == transfer_qty
        assert transfer["invoice_number"] == transfer_data["invoice_number"]
        assert transfer["from_firm_name"] == from_firm["name"]
        assert transfer["to_firm_name"] == to_firm["name"]
        print(f"✓ Stock transfer successful: {transfer['transfer_number']}")
        print(f"  From: {from_firm['name']} -> To: {to_firm['name']}")
        print(f"  Quantity: {transfer_qty}, Invoice: {transfer['invoice_number']}")
        
        # Verify dual ledger entries were created
        ledger_response = requests.get(
            f"{BASE_URL}/api/inventory/ledger",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"limit": 10}
        )
        ledger_entries = ledger_response.json()
        
        # Find transfer_out and transfer_in entries
        transfer_out = None
        transfer_in = None
        for entry in ledger_entries:
            if entry.get("reference_id") == transfer["id"]:
                if entry["entry_type"] == "transfer_out":
                    transfer_out = entry
                elif entry["entry_type"] == "transfer_in":
                    transfer_in = entry
        
        assert transfer_out is not None, "transfer_out ledger entry not found"
        assert transfer_in is not None, "transfer_in ledger entry not found"
        print(f"✓ Dual ledger entries created (transfer_out + transfer_in)")
        
        return transfer["id"]
    
    def test_transfer_same_firm_rejected(self, accountant_token):
        """Test that transfer to same firm is rejected"""
        firms_response = requests.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"is_active": True}
        )
        firms = firms_response.json()
        if not firms:
            pytest.skip("No firms available")
        
        firm = firms[0]
        
        materials_response = requests.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"firm_id": firm["id"]}
        )
        materials = materials_response.json()
        if not materials:
            pytest.skip("No materials available")
        
        material = materials[0]
        
        transfer_data = {
            "item_type": "raw_material",
            "item_id": material["id"],
            "from_firm_id": firm["id"],
            "to_firm_id": firm["id"],  # Same firm
            "quantity": 1,
            "invoice_number": "GST/TEST/001"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/inventory/transfer",
            headers={"Authorization": f"Bearer {accountant_token}"},
            json=transfer_data
        )
        assert response.status_code == 400
        assert "same" in response.json().get("detail", "").lower()
        print(f"✓ Transfer to same firm correctly rejected")
    
    def test_transfer_insufficient_stock_rejected(self, accountant_token):
        """Test that transfer with insufficient stock is rejected"""
        firms_response = requests.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"is_active": True}
        )
        firms = firms_response.json()
        if len(firms) < 2:
            pytest.skip("Need at least 2 firms")
        
        materials_response = requests.get(
            f"{BASE_URL}/api/raw-materials",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"firm_id": firms[0]["id"]}
        )
        materials = materials_response.json()
        if not materials:
            pytest.skip("No materials available")
        
        material = materials[0]
        current_stock = material.get("current_stock", 0)
        
        transfer_data = {
            "item_type": "raw_material",
            "item_id": material["id"],
            "from_firm_id": firms[0]["id"],
            "to_firm_id": firms[1]["id"],
            "quantity": current_stock + 10000,  # More than available
            "invoice_number": "GST/TEST/002"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/inventory/transfer",
            headers={"Authorization": f"Bearer {accountant_token}"},
            json=transfer_data
        )
        assert response.status_code == 400
        assert "Insufficient stock" in response.json().get("detail", "")
        print(f"✓ Transfer with insufficient stock correctly rejected")
    
    def test_list_transfers(self, accountant_token):
        """Test GET /api/inventory/transfers - List all transfers"""
        response = requests.get(
            f"{BASE_URL}/api/inventory/transfers",
            headers={"Authorization": f"Bearer {accountant_token}"},
            params={"limit": 10}
        )
        assert response.status_code == 200, f"List transfers failed: {response.text}"
        transfers = response.json()
        assert isinstance(transfers, list)
        print(f"✓ Listed {len(transfers)} stock transfers")
        
        if transfers:
            transfer = transfers[0]
            assert "transfer_number" in transfer
            assert "invoice_number" in transfer
            assert "from_firm_name" in transfer
            assert "to_firm_name" in transfer


class TestStockView:
    """Test Stock View APIs"""
    
    def test_get_inventory_stock(self, accountant_token):
        """Test GET /api/inventory/stock - Get current stock levels"""
        response = requests.get(
            f"{BASE_URL}/api/inventory/stock",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Get stock failed: {response.text}"
        
        data = response.json()
        assert "raw_materials" in data
        assert "finished_goods" in data
        assert "summary" in data
        
        summary = data["summary"]
        assert "total_raw_materials" in summary
        assert "low_stock_alerts" in summary
        print(f"✓ Stock summary: {summary['total_raw_materials']} raw materials, {summary['low_stock_alerts']} low stock alerts")
    
    def test_get_stock_by_firm(self, accountant_token):
        """Test GET /api/inventory/stock-by-firm - Get stock grouped by firm"""
        response = requests.get(
            f"{BASE_URL}/api/inventory/stock-by-firm",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Get stock by firm failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list) or isinstance(data, dict)
        print(f"✓ Stock by firm retrieved successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

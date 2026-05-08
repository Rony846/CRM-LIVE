"""
Test Suite for Party Master and Sales Register - Phase 1 Accounting Layer
Tests: Party CRUD, GSTIN deduplication, Customer migration, Sales Invoices, Party Ledger
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"
ACCOUNTANT_EMAIL = "aman@musclegrid.in"
ACCOUNTANT_PASSWORD = "Muscle@846"


class TestAuthSetup:
    """Authentication setup tests"""
    
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
    def accountant_token(self):
        """Get accountant authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        assert response.status_code == 200, f"Accountant login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_admin_login(self, admin_token):
        """Test admin can login"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print("PASS: Admin login successful")
    
    def test_accountant_login(self, accountant_token):
        """Test accountant can login"""
        assert accountant_token is not None
        assert len(accountant_token) > 0
        print("PASS: Accountant login successful")


class TestPartyMaster:
    """Party Master CRUD tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        """Get accountant authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_list_parties_empty_or_existing(self, admin_token):
        """Test listing parties - should return list (empty or with data)"""
        response = requests.get(
            f"{BASE_URL}/api/parties",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"List parties failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: List parties returned {len(data)} parties")
    
    def test_create_party_customer_type(self, admin_token):
        """Test creating a new party with customer type"""
        unique_id = str(uuid.uuid4())[:8]
        party_data = {
            "name": f"TEST_Customer_{unique_id}",
            "party_types": ["customer"],
            "state": "Delhi",
            "phone": f"98765{unique_id[:5]}",
            "email": f"test_customer_{unique_id}@test.com",
            "address": "Test Address 123",
            "city": "New Delhi",
            "pincode": "110001",
            "credit_limit": 50000,
            "opening_balance": 1000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/parties",
            json=party_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Create party failed: {response.text}"
        
        data = response.json()
        assert data["name"] == party_data["name"]
        assert "customer" in data["party_types"]
        assert data["state"] == "Delhi"
        assert data["credit_limit"] == 50000
        assert data["opening_balance"] == 1000
        assert "id" in data
        print(f"PASS: Created customer party: {data['name']} with ID: {data['id']}")
        return data
    
    def test_create_party_supplier_with_gstin(self, admin_token):
        """Test creating a supplier party with GSTIN"""
        unique_id = str(uuid.uuid4())[:8]
        # Valid GSTIN format: 2 digit state code + 10 char PAN + 1 char entity + Z + 1 check digit
        gstin = f"07AABCU{unique_id[:4].upper()}R1ZM"
        
        party_data = {
            "name": f"TEST_Supplier_{unique_id}",
            "party_types": ["supplier"],
            "gstin": gstin,
            "state": "Delhi",
            "phone": f"98764{unique_id[:5]}",
            "address": "Supplier Address 456",
            "city": "New Delhi",
            "pincode": "110002",
            "contact_person": "Test Contact"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/parties",
            json=party_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Create supplier failed: {response.text}"
        
        data = response.json()
        assert data["name"] == party_data["name"]
        assert "supplier" in data["party_types"]
        assert data["gstin"] == gstin.upper()
        print(f"PASS: Created supplier party with GSTIN: {data['gstin']}")
        return data
    
    def test_create_party_contractor_type(self, admin_token):
        """Test creating a contractor party"""
        unique_id = str(uuid.uuid4())[:8]
        party_data = {
            "name": f"TEST_Contractor_{unique_id}",
            "party_types": ["contractor"],
            "state": "Maharashtra",
            "phone": f"98763{unique_id[:5]}",
            "address": "Contractor Address 789",
            "city": "Mumbai"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/parties",
            json=party_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Create contractor failed: {response.text}"
        
        data = response.json()
        assert "contractor" in data["party_types"]
        print(f"PASS: Created contractor party: {data['name']}")
        return data
    
    def test_duplicate_gstin_prevention(self, admin_token):
        """Test that duplicate GSTIN is prevented"""
        unique_id = str(uuid.uuid4())[:8]
        gstin = f"27AABCD{unique_id[:4].upper()}E1ZK"
        
        # Create first party with GSTIN
        party_data1 = {
            "name": f"TEST_First_GSTIN_{unique_id}",
            "party_types": ["supplier"],
            "gstin": gstin,
            "state": "Maharashtra",
            "phone": f"98762{unique_id[:5]}"
        }
        
        response1 = requests.post(
            f"{BASE_URL}/api/parties",
            json=party_data1,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response1.status_code == 200, f"First party creation failed: {response1.text}"
        
        # Try to create second party with same GSTIN
        party_data2 = {
            "name": f"TEST_Second_GSTIN_{unique_id}",
            "party_types": ["supplier"],
            "gstin": gstin,
            "state": "Maharashtra",
            "phone": f"98761{unique_id[:5]}"
        }
        
        response2 = requests.post(
            f"{BASE_URL}/api/parties",
            json=party_data2,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should fail with 400 error for duplicate GSTIN
        assert response2.status_code == 400, f"Expected 400 for duplicate GSTIN, got {response2.status_code}"
        assert "already exists" in response2.text.lower() or "gstin" in response2.text.lower()
        print("PASS: Duplicate GSTIN correctly prevented")
    
    def test_view_party_details(self, admin_token):
        """Test viewing party details"""
        # First create a party
        unique_id = str(uuid.uuid4())[:8]
        party_data = {
            "name": f"TEST_View_{unique_id}",
            "party_types": ["customer"],
            "state": "Karnataka",
            "phone": f"98760{unique_id[:5]}",
            "opening_balance": 5000
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/parties",
            json=party_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200
        party_id = create_response.json()["id"]
        
        # Now view the party
        view_response = requests.get(
            f"{BASE_URL}/api/parties/{party_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert view_response.status_code == 200, f"View party failed: {view_response.text}"
        
        data = view_response.json()
        assert data["id"] == party_id
        assert data["name"] == party_data["name"]
        assert data["opening_balance"] == 5000
        assert "current_balance" in data
        print(f"PASS: Viewed party details for: {data['name']}")
    
    def test_edit_party_details(self, admin_token):
        """Test editing party details"""
        # First create a party
        unique_id = str(uuid.uuid4())[:8]
        party_data = {
            "name": f"TEST_Edit_{unique_id}",
            "party_types": ["customer"],
            "state": "Gujarat",
            "phone": f"98759{unique_id[:5]}"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/parties",
            json=party_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200
        party_id = create_response.json()["id"]
        
        # Update the party
        update_data = {
            "name": f"TEST_Edit_Updated_{unique_id}",
            "credit_limit": 100000,
            "city": "Ahmedabad"
        }
        
        update_response = requests.patch(
            f"{BASE_URL}/api/parties/{party_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert update_response.status_code == 200, f"Update party failed: {update_response.text}"
        
        data = update_response.json()
        assert data["name"] == update_data["name"]
        assert data["credit_limit"] == 100000
        assert data["city"] == "Ahmedabad"
        print(f"PASS: Updated party: {data['name']}")
    
    def test_filter_parties_by_type(self, admin_token):
        """Test filtering parties by type"""
        # Filter by customer type
        response = requests.get(
            f"{BASE_URL}/api/parties",
            params={"party_type": "customer"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        for party in data:
            assert "customer" in party["party_types"], f"Party {party['name']} is not a customer"
        print(f"PASS: Filtered {len(data)} customer parties")
    
    def test_accountant_can_list_parties(self, accountant_token):
        """Test that accountant can list parties"""
        response = requests.get(
            f"{BASE_URL}/api/parties",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Accountant list parties failed: {response.text}"
        print("PASS: Accountant can list parties")


class TestMigrateCustomers:
    """Test customer migration from tickets"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_migrate_customers_endpoint(self, admin_token):
        """Test the migrate customers endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/parties/migrate-customers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Migration failed: {response.text}"
        
        data = response.json()
        assert "migrated" in data
        assert "skipped" in data
        assert "message" in data
        print(f"PASS: Migration complete - Migrated: {data['migrated']}, Skipped: {data['skipped']}")


class TestSalesRegister:
    """Sales Register tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        """Get accountant authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_list_sales_invoices(self, accountant_token):
        """Test listing sales invoices (empty state or with data)"""
        response = requests.get(
            f"{BASE_URL}/api/sales-invoices",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"List invoices failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Listed {len(data)} sales invoices")
    
    def test_get_dispatches_without_invoice(self, accountant_token):
        """Test fetching dispatches without invoice"""
        response = requests.get(
            f"{BASE_URL}/api/dispatches-without-invoice",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Get dispatches failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Found {len(data)} dispatches without invoice")
        return data
    
    def test_get_firms_for_invoice(self, accountant_token):
        """Test getting firms list for invoice creation"""
        response = requests.get(
            f"{BASE_URL}/api/firms",
            params={"is_active": True},
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Get firms failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Found {len(data)} active firms")
        return data
    
    def test_get_parties_for_invoice(self, accountant_token):
        """Test getting customer parties for invoice creation"""
        response = requests.get(
            f"{BASE_URL}/api/parties",
            params={"party_type": "customer"},
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Get parties failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Found {len(data)} customer parties")
        return data
    
    def test_invoice_creation_validation(self, accountant_token):
        """Test invoice creation form validation - missing required fields"""
        # Try to create invoice without required fields
        invalid_data = {
            "firm_id": "",
            "party_id": "",
            "dispatch_id": "",
            "invoice_date": "2025-01-15",
            "items": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sales-invoices",
            json=invalid_data,
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        
        # Should fail with 400 or 422 for validation error
        assert response.status_code in [400, 422], f"Expected validation error, got {response.status_code}"
        print("PASS: Invoice creation validation working - rejects invalid data")


class TestPartyLedger:
    """Party Ledger tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_party_ledger_with_opening_balance(self, admin_token):
        """Test party ledger shows opening balance entry"""
        # Create a party with opening balance
        unique_id = str(uuid.uuid4())[:8]
        party_data = {
            "name": f"TEST_Ledger_{unique_id}",
            "party_types": ["customer"],
            "state": "Tamil Nadu",
            "phone": f"98758{unique_id[:5]}",
            "opening_balance": 10000  # Positive = receivable
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/parties",
            json=party_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200
        party_id = create_response.json()["id"]
        
        # Get party ledger
        ledger_response = requests.get(
            f"{BASE_URL}/api/party-ledger/{party_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert ledger_response.status_code == 200, f"Get ledger failed: {ledger_response.text}"
        
        data = ledger_response.json()
        assert "party" in data
        assert "entries" in data
        assert "current_balance" in data
        
        # Should have opening balance entry
        if party_data["opening_balance"] != 0:
            assert len(data["entries"]) > 0, "Expected opening balance entry in ledger"
            # Check if opening balance entry exists
            ob_entry = next((e for e in data["entries"] if "OB-" in e.get("entry_number", "")), None)
            if ob_entry:
                assert ob_entry["debit"] == 10000 or ob_entry["running_balance"] == 10000
        
        print(f"PASS: Party ledger retrieved with {len(data['entries'])} entries, balance: {data['current_balance']}")
    
    def test_party_ledger_not_found(self, admin_token):
        """Test party ledger returns 404 for non-existent party"""
        response = requests.get(
            f"{BASE_URL}/api/party-ledger/non-existent-party-id",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
        print("PASS: Party ledger returns 404 for non-existent party")


class TestMasterSKUsForInvoice:
    """Test Master SKUs endpoint for invoice item selection"""
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        """Get accountant authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_get_master_skus(self, accountant_token):
        """Test getting master SKUs for invoice items"""
        response = requests.get(
            f"{BASE_URL}/api/master-skus",
            params={"is_active": True},
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Get SKUs failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Found {len(data)} active master SKUs")


# Cleanup fixture to remove test data
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_parties():
    """Cleanup test parties after all tests"""
    yield
    # Note: In production, you'd want to clean up TEST_ prefixed parties
    # For now, we leave them as they don't affect functionality


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

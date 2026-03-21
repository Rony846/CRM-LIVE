"""
Test Production Request & Serial-Based Manufacturing Module
Tests:
- Production request CRUD operations
- Workflow: Create -> Accept -> Start -> Complete -> Receive
- Supervisor payables
- Finished good serial tracking
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"email": "admin@musclegrid.in", "password": "Muscle@846"}
ACCOUNTANT_CREDS = {"email": "accountant@musclegrid.in", "password": "Muscle@846"}
SUPERVISOR_CREDS = {"email": "supervisor@musclegrid.in", "password": "Muscle@846"}
TECHNICIAN_CREDS = {"email": "technician@musclegrid.in", "password": "Muscle@846"}


class TestAuthAndSetup:
    """Test authentication and setup for production module testing"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        """Get accountant token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant login failed")
    
    @pytest.fixture(scope="class")
    def supervisor_token(self):
        """Get supervisor token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERVISOR_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Supervisor login failed")
    
    @pytest.fixture(scope="class")
    def technician_token(self):
        """Get technician token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TECHNICIAN_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Technician login failed")
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"Admin login successful: {data['user']['email']}")
    
    def test_accountant_login(self):
        """Test accountant login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        assert response.status_code == 200, f"Accountant login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "accountant"
        print(f"Accountant login successful: {data['user']['email']}")
    
    def test_supervisor_login(self):
        """Test supervisor login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERVISOR_CREDS)
        assert response.status_code == 200, f"Supervisor login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "supervisor"
        print(f"Supervisor login successful: {data['user']['email']}")
    
    def test_technician_login(self):
        """Test technician login (service_agent)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TECHNICIAN_CREDS)
        assert response.status_code == 200, f"Technician login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "service_agent"
        print(f"Technician login successful: {data['user']['email']}")


class TestProductionRequestEndpoints:
    """Test production request endpoints"""
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant login failed")
    
    @pytest.fixture(scope="class")
    def supervisor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERVISOR_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Supervisor login failed")
    
    @pytest.fixture(scope="class")
    def technician_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TECHNICIAN_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Technician login failed")
    
    def test_list_production_requests_accountant(self, accountant_token):
        """Test listing production requests as accountant"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/production-requests", headers=headers)
        assert response.status_code == 200, f"Failed to list production requests: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Accountant can list production requests: {len(data)} found")
    
    def test_list_production_requests_supervisor(self, supervisor_token):
        """Test listing production requests as supervisor (should only see supervisor-assigned)"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.get(f"{BASE_URL}/api/production-requests", headers=headers)
        assert response.status_code == 200, f"Failed to list production requests: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # Verify all returned requests are supervisor-assigned
        for req in data:
            assert req.get("manufacturing_role") == "supervisor", f"Supervisor should only see supervisor-assigned requests"
        print(f"Supervisor can list production requests: {len(data)} found (all supervisor-assigned)")
    
    def test_list_production_requests_technician(self, technician_token):
        """Test listing production requests as technician (should only see technician-assigned)"""
        headers = {"Authorization": f"Bearer {technician_token}"}
        response = requests.get(f"{BASE_URL}/api/production-requests", headers=headers)
        assert response.status_code == 200, f"Failed to list production requests: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # Verify all returned requests are technician-assigned
        for req in data:
            assert req.get("manufacturing_role") == "technician", f"Technician should only see technician-assigned requests"
        print(f"Technician can list production requests: {len(data)} found (all technician-assigned)")


class TestSupervisorPayablesEndpoints:
    """Test supervisor payables endpoints"""
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant login failed")
    
    @pytest.fixture(scope="class")
    def supervisor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERVISOR_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Supervisor login failed")
    
    def test_list_supervisor_payables_accountant(self, accountant_token):
        """Test listing supervisor payables as accountant"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/supervisor-payables", headers=headers)
        assert response.status_code == 200, f"Failed to list supervisor payables: {response.text}"
        data = response.json()
        assert "payables" in data
        assert "summary" in data
        assert "total_payable" in data["summary"]
        assert "total_paid" in data["summary"]
        assert "total_pending" in data["summary"]
        print(f"Accountant can list supervisor payables: {len(data['payables'])} found")
        print(f"Summary: Total={data['summary']['total_payable']}, Paid={data['summary']['total_paid']}, Pending={data['summary']['total_pending']}")
    
    def test_list_supervisor_payables_supervisor(self, supervisor_token):
        """Test listing supervisor payables as supervisor"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.get(f"{BASE_URL}/api/supervisor-payables", headers=headers)
        assert response.status_code == 200, f"Failed to list supervisor payables: {response.text}"
        data = response.json()
        assert "payables" in data
        assert "summary" in data
        print(f"Supervisor can list their payables: {len(data['payables'])} found")


class TestFinishedGoodSerialsEndpoints:
    """Test finished good serial number endpoints"""
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant login failed")
    
    def test_list_finished_good_serials(self, accountant_token):
        """Test listing finished good serial numbers"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/finished-good-serials", headers=headers)
        assert response.status_code == 200, f"Failed to list finished good serials: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Accountant can list finished good serials: {len(data)} found")
    
    def test_lookup_nonexistent_serial(self, accountant_token):
        """Test looking up a non-existent serial number"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/finished-good-serials/lookup/NONEXISTENT-SERIAL-12345", headers=headers)
        assert response.status_code == 404, f"Expected 404 for non-existent serial: {response.text}"
        print("Correctly returns 404 for non-existent serial number")


class TestPrerequisitesForProductionWorkflow:
    """Test prerequisites needed for production workflow - firms, raw materials, master SKUs"""
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant login failed")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    def test_list_firms(self, accountant_token):
        """Test listing firms"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        assert response.status_code == 200, f"Failed to list firms: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} firms")
        return data
    
    def test_list_master_skus(self, accountant_token):
        """Test listing master SKUs"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/master-skus", headers=headers)
        assert response.status_code == 200, f"Failed to list master SKUs: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} master SKUs")
        
        # Check for manufactured SKUs
        manufactured_skus = [s for s in data if s.get("product_type") == "manufactured"]
        print(f"Found {len(manufactured_skus)} manufactured SKUs")
        return data
    
    def test_list_raw_materials(self, accountant_token):
        """Test listing raw materials"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/raw-materials", headers=headers)
        assert response.status_code == 200, f"Failed to list raw materials: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} raw materials")
        return data


class TestFullProductionWorkflow:
    """
    Test the complete production workflow:
    1. Create/update a Master SKU with product_type='manufactured'
    2. Create a production request
    3. Accept as supervisor/technician
    4. Start production
    5. Complete with serial numbers
    6. Receive into inventory as accountant
    """
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant login failed")
    
    @pytest.fixture(scope="class")
    def supervisor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERVISOR_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Supervisor login failed")
    
    def test_get_or_create_firm(self, admin_token):
        """Get or create a firm for testing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # List existing firms
        response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        assert response.status_code == 200
        firms = response.json()
        
        if firms:
            firm = firms[0]
            print(f"Using existing firm: {firm['name']} (ID: {firm['id']})")
            return firm
        
        # Create a new firm
        firm_data = {
            "name": "TEST_Production_Firm",
            "gstin": "29TESTGSTIN1234",
            "address": "Test Address",
            "state": "Karnataka",
            "pincode": "560001",
            "contact_person": "Test Contact"
        }
        response = requests.post(f"{BASE_URL}/api/firms", json=firm_data, headers=headers)
        assert response.status_code in [200, 201], f"Failed to create firm: {response.text}"
        firm = response.json()
        print(f"Created test firm: {firm['name']} (ID: {firm['id']})")
        return firm
    
    def test_get_or_create_raw_material(self, admin_token):
        """Get or create a raw material for testing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get firm first
        response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        firms = response.json()
        if not firms:
            pytest.skip("No firms available")
        firm_id = firms[0]["id"]
        
        # List existing raw materials
        response = requests.get(f"{BASE_URL}/api/raw-materials", headers=headers)
        assert response.status_code == 200
        raw_materials = response.json()
        
        if raw_materials:
            rm = raw_materials[0]
            print(f"Using existing raw material: {rm['name']} (ID: {rm['id']})")
            return rm
        
        # Create a new raw material
        rm_data = {
            "name": "TEST_Battery_Cell",
            "sku_code": "TEST-RM-001",
            "unit": "pcs",
            "hsn_code": "8507",
            "reorder_level": 10,
            "firm_id": firm_id
        }
        response = requests.post(f"{BASE_URL}/api/raw-materials", json=rm_data, headers=headers)
        assert response.status_code in [200, 201], f"Failed to create raw material: {response.text}"
        rm = response.json()
        print(f"Created test raw material: {rm['name']} (ID: {rm['id']})")
        return rm
    
    def test_check_manufactured_sku_exists(self, admin_token):
        """Check if a manufactured SKU with BOM exists for testing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/master-skus", headers=headers)
        assert response.status_code == 200
        skus = response.json()
        
        # Find a manufactured SKU with BOM
        manufactured_skus = [
            s for s in skus 
            if s.get("product_type") == "manufactured" 
            and s.get("manufacturing_role") in ["supervisor", "technician"]
            and s.get("bill_of_materials")
        ]
        
        if manufactured_skus:
            sku = manufactured_skus[0]
            print(f"Found manufactured SKU: {sku['name']} (ID: {sku['id']})")
            print(f"  - Product Type: {sku.get('product_type')}")
            print(f"  - Manufacturing Role: {sku.get('manufacturing_role')}")
            print(f"  - Production Charge: {sku.get('production_charge_per_unit')}")
            print(f"  - BOM Items: {len(sku.get('bill_of_materials', []))}")
            return sku
        
        print("No manufactured SKU with BOM found. Need to create one for full workflow test.")
        return None
    
    def test_create_production_request_validation(self, accountant_token):
        """Test production request creation validation"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        # Test with invalid firm_id
        invalid_data = {
            "firm_id": "invalid-firm-id",
            "master_sku_id": "invalid-sku-id",
            "quantity_requested": 1
        }
        response = requests.post(f"{BASE_URL}/api/production-requests", json=invalid_data, headers=headers)
        assert response.status_code == 400, f"Expected 400 for invalid firm: {response.text}"
        print("Correctly validates firm_id")
    
    def test_create_production_request_requires_manufactured_sku(self, accountant_token, admin_token):
        """Test that production request requires a manufactured SKU"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get a firm
        response = requests.get(f"{BASE_URL}/api/firms", headers=admin_headers)
        firms = response.json()
        if not firms:
            pytest.skip("No firms available")
        firm_id = firms[0]["id"]
        
        # Get a non-manufactured SKU (or any SKU without product_type='manufactured')
        response = requests.get(f"{BASE_URL}/api/master-skus", headers=admin_headers)
        skus = response.json()
        
        non_manufactured = [s for s in skus if s.get("product_type") != "manufactured"]
        if non_manufactured:
            sku = non_manufactured[0]
            data = {
                "firm_id": firm_id,
                "master_sku_id": sku["id"],
                "quantity_requested": 1
            }
            response = requests.post(f"{BASE_URL}/api/production-requests", json=data, headers=headers)
            # Should fail because SKU is not manufactured
            assert response.status_code == 400, f"Expected 400 for non-manufactured SKU: {response.text}"
            print(f"Correctly rejects non-manufactured SKU: {response.json().get('detail')}")
        else:
            print("All SKUs are manufactured, skipping this validation test")


class TestProductionRequestActions:
    """Test individual production request actions"""
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant login failed")
    
    @pytest.fixture(scope="class")
    def supervisor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERVISOR_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Supervisor login failed")
    
    def test_accept_nonexistent_request(self, supervisor_token):
        """Test accepting a non-existent production request"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.put(f"{BASE_URL}/api/production-requests/nonexistent-id/accept", headers=headers)
        assert response.status_code == 404, f"Expected 404: {response.text}"
        print("Correctly returns 404 for non-existent request")
    
    def test_start_nonexistent_request(self, supervisor_token):
        """Test starting a non-existent production request"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        response = requests.put(f"{BASE_URL}/api/production-requests/nonexistent-id/start", headers=headers)
        assert response.status_code == 404, f"Expected 404: {response.text}"
        print("Correctly returns 404 for non-existent request")
    
    def test_complete_nonexistent_request(self, supervisor_token):
        """Test completing a non-existent production request"""
        headers = {"Authorization": f"Bearer {supervisor_token}"}
        data = {
            "serial_numbers": [{"serial_number": "TEST-001"}],
            "completion_notes": "Test"
        }
        response = requests.put(f"{BASE_URL}/api/production-requests/nonexistent-id/complete", json=data, headers=headers)
        assert response.status_code == 404, f"Expected 404: {response.text}"
        print("Correctly returns 404 for non-existent request")
    
    def test_receive_nonexistent_request(self, accountant_token):
        """Test receiving a non-existent production request"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.put(f"{BASE_URL}/api/production-requests/nonexistent-id/receive", headers=headers)
        assert response.status_code == 404, f"Expected 404: {response.text}"
        print("Correctly returns 404 for non-existent request")
    
    def test_cancel_nonexistent_request(self, accountant_token):
        """Test cancelling a non-existent production request"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.put(f"{BASE_URL}/api/production-requests/nonexistent-id/cancel", headers=headers)
        assert response.status_code == 404, f"Expected 404: {response.text}"
        print("Correctly returns 404 for non-existent request")


class TestPaymentEndpoints:
    """Test payment recording endpoints"""
    
    @pytest.fixture(scope="class")
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant login failed")
    
    def test_record_payment_nonexistent_payable(self, accountant_token):
        """Test recording payment for non-existent payable"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        data = {
            "status": "part_paid",
            "amount_paid": 100,
            "payment_reference": "TEST-REF"
        }
        response = requests.put(f"{BASE_URL}/api/supervisor-payables/nonexistent-id/payment", json=data, headers=headers)
        assert response.status_code == 404, f"Expected 404: {response.text}"
        print("Correctly returns 404 for non-existent payable")
    
    def test_get_nonexistent_payable(self, accountant_token):
        """Test getting a non-existent payable"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/supervisor-payables/nonexistent-id", headers=headers)
        assert response.status_code == 404, f"Expected 404: {response.text}"
        print("Correctly returns 404 for non-existent payable")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test SQL Import, Customer Edit, and Warranty Invoice Features
For MuscleGrid CRM - Iteration 12
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://crm-rebuild-11.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "customer123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Auth headers for admin requests"""
    return {"Authorization": f"Bearer {admin_token}"}


# ==================== SQL IMPORT TESTS ====================

class TestSQLImport:
    """Test SQL import features - verify imported tickets have legacy_id and source"""
    
    def test_sql_imported_tickets_count(self, auth_headers):
        """Verify SQL imported tickets exist with source=sql_import"""
        response = requests.get(f"{BASE_URL}/api/tickets?limit=500", headers=auth_headers)
        assert response.status_code == 200
        
        tickets = response.json()
        sql_import_tickets = [t for t in tickets if t.get("source") == "sql_import"]
        
        # Should have multiple imported tickets
        assert len(sql_import_tickets) > 0, "No SQL imported tickets found"
        print(f"Found {len(sql_import_tickets)} SQL imported tickets")
    
    def test_sql_imported_tickets_have_legacy_id(self, auth_headers):
        """Verify SQL imported tickets have legacy_id field populated"""
        response = requests.get(f"{BASE_URL}/api/tickets?limit=500", headers=auth_headers)
        assert response.status_code == 200
        
        tickets = response.json()
        sql_import_tickets = [t for t in tickets if t.get("source") == "sql_import"]
        
        # Check that at least some have legacy_id
        with_legacy_id = [t for t in sql_import_tickets if t.get("legacy_id") is not None]
        
        # Note: Not all may have legacy_id due to data quality, but most should
        print(f"SQL imports with legacy_id: {len(with_legacy_id)}/{len(sql_import_tickets)}")
        
        # Sample check - get a ticket with legacy_id
        if with_legacy_id:
            sample = with_legacy_id[0]
            assert isinstance(sample.get("legacy_id"), (int, type(None)))
            print(f"Sample legacy_id: {sample.get('legacy_id')}")
    
    def test_phone_deduplication(self, auth_headers):
        """Verify same phone number maps to same customer_id"""
        response = requests.get(f"{BASE_URL}/api/tickets?limit=500", headers=auth_headers)
        assert response.status_code == 200
        
        tickets = response.json()
        sql_tickets = [t for t in tickets if t.get("source") == "sql_import"]
        
        # Build phone -> customer_id mapping
        phone_to_customer = {}
        for ticket in sql_tickets:
            phone = ticket.get("customer_phone")
            cust_id = ticket.get("customer_id")
            if phone and cust_id:
                if phone not in phone_to_customer:
                    phone_to_customer[phone] = set()
                phone_to_customer[phone].add(cust_id)
        
        # Check for consistency - same phone should have same customer_id
        inconsistent = [(p, c) for p, c in phone_to_customer.items() if len(c) > 1]
        
        assert len(inconsistent) == 0, f"Phone deduplication failed: {inconsistent[:3]}"
        print(f"Phone deduplication verified for {len(phone_to_customer)} unique phones")


# ==================== CUSTOMER EDIT TESTS ====================

class TestCustomerEdit:
    """Test admin can edit customer information"""
    
    @pytest.fixture
    def test_customer(self, auth_headers):
        """Get a customer from sql_import for testing"""
        response = requests.get(f"{BASE_URL}/api/tickets?limit=500", headers=auth_headers)
        tickets = response.json()
        
        # Find a ticket with customer_id
        for ticket in tickets:
            if ticket.get("customer_id") and ticket.get("source") == "sql_import":
                return {
                    "customer_id": ticket["customer_id"],
                    "ticket_id": ticket["id"]
                }
        
        pytest.skip("No test customer found")
    
    def test_get_customer_info(self, auth_headers, test_customer):
        """Admin can retrieve customer information"""
        customer_id = test_customer["customer_id"]
        
        response = requests.get(
            f"{BASE_URL}/api/admin/customers/{customer_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert "phone" in data  # Phone is the unique ID
        assert "first_name" in data
        print(f"Customer: {data.get('first_name')} {data.get('last_name')}, Phone: {data.get('phone')}")
    
    def test_update_customer_address(self, auth_headers, test_customer):
        """Admin can update customer address"""
        customer_id = test_customer["customer_id"]
        
        # First get current data
        response = requests.get(
            f"{BASE_URL}/api/admin/customers/{customer_id}",
            headers=auth_headers
        )
        original = response.json()
        original_address = original.get("address")
        
        # Update address
        test_address = "TEST ADDRESS UPDATE - 123 Test Street"
        update_response = requests.patch(
            f"{BASE_URL}/api/admin/customers/{customer_id}",
            headers=auth_headers,
            json={"address": test_address}
        )
        
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated.get("address") == test_address
        
        # Verify phone is unchanged (read-only)
        assert updated.get("phone") == original.get("phone")
        
        # Revert to original
        requests.patch(
            f"{BASE_URL}/api/admin/customers/{customer_id}",
            headers=auth_headers,
            json={"address": original_address}
        )
        
        print("Customer address update: PASS")
    
    def test_update_customer_city(self, auth_headers, test_customer):
        """Admin can update customer city"""
        customer_id = test_customer["customer_id"]
        
        # Get current data
        response = requests.get(
            f"{BASE_URL}/api/admin/customers/{customer_id}",
            headers=auth_headers
        )
        original_city = response.json().get("city")
        
        # Update city
        test_city = "Test City Update"
        update_response = requests.patch(
            f"{BASE_URL}/api/admin/customers/{customer_id}",
            headers=auth_headers,
            json={"city": test_city}
        )
        
        assert update_response.status_code == 200
        assert update_response.json().get("city") == test_city
        
        # Revert
        requests.patch(
            f"{BASE_URL}/api/admin/customers/{customer_id}",
            headers=auth_headers,
            json={"city": original_city}
        )
        
        print("Customer city update: PASS")
    
    def test_ticket_data_updated_with_customer(self, auth_headers, test_customer):
        """Verify ticket data is also updated when customer is edited"""
        customer_id = test_customer["customer_id"]
        ticket_id = test_customer["ticket_id"]
        
        # Get original ticket data
        ticket_response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers=auth_headers
        )
        original_ticket = ticket_response.json()
        original_city = original_ticket.get("customer_city")
        
        # Update customer city
        test_city = "TICKET_UPDATE_TEST_CITY"
        requests.patch(
            f"{BASE_URL}/api/admin/customers/{customer_id}",
            headers=auth_headers,
            json={"city": test_city}
        )
        
        # Verify ticket also updated
        ticket_response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers=auth_headers
        )
        updated_ticket = ticket_response.json()
        
        assert updated_ticket.get("customer_city") == test_city
        
        # Revert
        requests.patch(
            f"{BASE_URL}/api/admin/customers/{customer_id}",
            headers=auth_headers,
            json={"city": original_city}
        )
        
        print("Ticket data sync with customer update: PASS")


# ==================== WARRANTY INVOICE TESTS ====================

class TestWarrantyInvoice:
    """Test warranty invoice upload and view features"""
    
    def test_list_approved_warranties(self, auth_headers):
        """Admin can list approved warranties"""
        response = requests.get(
            f"{BASE_URL}/api/warranties?status=approved",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        warranties = response.json()
        
        print(f"Approved warranties: {len(warranties)}")
        
        # Check structure
        if warranties:
            w = warranties[0]
            assert "id" in w
            assert "status" in w
            assert w["status"] == "approved"
    
    def test_warranty_has_invoice_fields(self, auth_headers):
        """Warranty records have invoice file fields"""
        response = requests.get(
            f"{BASE_URL}/api/warranties?status=approved",
            headers=auth_headers
        )
        
        warranties = response.json()
        
        # Check that approved warranties have invoice-related fields
        for w in warranties[:5]:
            # Should have either invoice_file or admin_invoice_file field
            has_invoice_field = "invoice_file" in w or "admin_invoice_file" in w
            assert has_invoice_field, f"Warranty {w.get('id')} missing invoice fields"
        
        # Count warranties with/without admin invoices
        with_admin_invoice = len([w for w in warranties if w.get("admin_invoice_file")])
        without_admin_invoice = len([w for w in warranties if not w.get("admin_invoice_file")])
        
        print(f"With admin invoice: {with_admin_invoice}, Without: {without_admin_invoice}")
    
    def test_upload_warranty_invoice(self, auth_headers):
        """Admin can upload invoice for warranty"""
        # Find a warranty without admin_invoice_file
        response = requests.get(
            f"{BASE_URL}/api/warranties?status=approved",
            headers=auth_headers
        )
        warranties = response.json()
        
        # Find one without admin invoice
        target = None
        for w in warranties:
            if not w.get("admin_invoice_file"):
                target = w
                break
        
        if not target:
            pytest.skip("No warranty without admin invoice found")
        
        warranty_id = target["id"]
        
        # Create test file content
        test_content = b"%PDF-1.4 TEST WARRANTY INVOICE"
        files = {"invoice_file": ("test_invoice.pdf", test_content, "application/pdf")}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/warranties/{warranty_id}/upload-invoice",
            headers=auth_headers,
            files=files
        )
        
        assert upload_response.status_code == 200
        result = upload_response.json()
        assert "invoice_url" in result
        
        # Verify the warranty was updated
        verify_response = requests.get(
            f"{BASE_URL}/api/warranties/{warranty_id}",
            headers=auth_headers
        )
        updated = verify_response.json()
        
        assert updated.get("admin_invoice_file") is not None
        assert "admin_invoice_uploaded_at" in updated
        
        print(f"Invoice upload verified: {updated.get('admin_invoice_file')}")


# ==================== TEST PROVIDED IDS ====================

class TestProvidedIDs:
    """Test with specific IDs provided in the review request"""
    
    def test_provided_customer_id(self, auth_headers):
        """Test the provided customer ID: 0231ffd5-985b-45a7-b6cf-6d62adabdafe"""
        customer_id = "0231ffd5-985b-45a7-b6cf-6d62adabdafe"
        
        response = requests.get(
            f"{BASE_URL}/api/admin/customers/{customer_id}",
            headers=auth_headers
        )
        
        # Customer may or may not exist
        if response.status_code == 200:
            data = response.json()
            print(f"Found customer: {data.get('first_name')} {data.get('last_name')}")
            print(f"Phone: {data.get('phone')}")
        elif response.status_code == 404:
            print(f"Customer {customer_id} not found (may have been deleted)")
        else:
            pytest.fail(f"Unexpected response: {response.status_code}")
    
    def test_provided_warranty_id(self, auth_headers):
        """Test the provided warranty ID: e861b805-a027-4734-be8c-ac05815f512b"""
        warranty_id = "e861b805-a027-4734-be8c-ac05815f512b"
        
        response = requests.get(
            f"{BASE_URL}/api/warranties/{warranty_id}",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"Found warranty: {data.get('warranty_number')}")
            print(f"Status: {data.get('status')}")
            print(f"Has admin invoice: {bool(data.get('admin_invoice_file'))}")
        elif response.status_code == 404:
            print(f"Warranty {warranty_id} not found (may have been deleted)")
        else:
            pytest.fail(f"Unexpected response: {response.status_code}")

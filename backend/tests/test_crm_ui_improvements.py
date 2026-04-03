"""
Test CRM and Dealer Portal UI Improvements
- Pagination for Tickets and Customers (50/page)
- SLA breach filter for Tickets
- Customer CRUD (Add/Edit/Delete with deletion blocking)
- Warranty rejection with FormData
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"


class TestAdminAuth:
    """Get admin token for authenticated tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Return headers with auth token"""
        return {"Authorization": f"Bearer {admin_token}"}


class TestTicketsPagination(TestAdminAuth):
    """Test GET /api/admin/tickets pagination"""
    
    def test_tickets_returns_paginated_response(self, auth_headers):
        """Verify tickets endpoint returns paginated structure"""
        response = requests.get(f"{BASE_URL}/api/admin/tickets", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        # Verify paginated response structure
        assert "tickets" in data, "Response should have 'tickets' key"
        assert "total" in data, "Response should have 'total' key"
        assert "page" in data, "Response should have 'page' key"
        assert "limit" in data, "Response should have 'limit' key"
        assert "total_pages" in data, "Response should have 'total_pages' key"
        
        # Verify types
        assert isinstance(data["tickets"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["page"], int)
        assert isinstance(data["limit"], int)
        assert isinstance(data["total_pages"], int)
        
        print(f"Tickets pagination: total={data['total']}, page={data['page']}, limit={data['limit']}, total_pages={data['total_pages']}")
    
    def test_tickets_default_limit_is_50(self, auth_headers):
        """Verify default limit is 50"""
        response = requests.get(f"{BASE_URL}/api/admin/tickets", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["limit"] == 50, f"Default limit should be 50, got {data['limit']}"
        assert len(data["tickets"]) <= 50, "Should return at most 50 tickets"
    
    def test_tickets_page_parameter(self, auth_headers):
        """Verify page parameter works"""
        response = requests.get(f"{BASE_URL}/api/admin/tickets?page=1&limit=10", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 10
        assert len(data["tickets"]) <= 10
    
    def test_tickets_sla_breached_filter_true(self, auth_headers):
        """Verify SLA breached filter works for true"""
        response = requests.get(f"{BASE_URL}/api/admin/tickets?sla_breached=true", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "tickets" in data
        # All returned tickets should have sla_breached=True
        for ticket in data["tickets"]:
            assert ticket.get("sla_breached") == True, f"Ticket {ticket.get('ticket_number')} should have sla_breached=True"
        
        print(f"SLA breached tickets: {len(data['tickets'])}")
    
    def test_tickets_sla_breached_filter_false(self, auth_headers):
        """Verify SLA breached filter works for false"""
        response = requests.get(f"{BASE_URL}/api/admin/tickets?sla_breached=false", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "tickets" in data
        # All returned tickets should have sla_breached=False
        for ticket in data["tickets"]:
            assert ticket.get("sla_breached") == False, f"Ticket {ticket.get('ticket_number')} should have sla_breached=False"
        
        print(f"Within SLA tickets: {len(data['tickets'])}")
    
    def test_tickets_search_preserves_pagination(self, auth_headers):
        """Verify search works with pagination"""
        response = requests.get(f"{BASE_URL}/api/admin/tickets?search=MG&page=1&limit=10", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "tickets" in data
        assert "total" in data
        assert data["page"] == 1
        assert data["limit"] == 10


class TestCustomersPagination(TestAdminAuth):
    """Test GET /api/admin/customers pagination"""
    
    def test_customers_returns_paginated_response(self, auth_headers):
        """Verify customers endpoint returns paginated structure"""
        response = requests.get(f"{BASE_URL}/api/admin/customers", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        # Verify paginated response structure
        assert "customers" in data, "Response should have 'customers' key"
        assert "total" in data, "Response should have 'total' key"
        assert "page" in data, "Response should have 'page' key"
        assert "limit" in data, "Response should have 'limit' key"
        assert "total_pages" in data, "Response should have 'total_pages' key"
        
        # Verify types
        assert isinstance(data["customers"], list)
        assert isinstance(data["total"], int)
        
        print(f"Customers pagination: total={data['total']}, page={data['page']}, limit={data['limit']}, total_pages={data['total_pages']}")
    
    def test_customers_default_limit_is_50(self, auth_headers):
        """Verify default limit is 50"""
        response = requests.get(f"{BASE_URL}/api/admin/customers", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["limit"] == 50, f"Default limit should be 50, got {data['limit']}"
        assert len(data["customers"]) <= 50
    
    def test_customers_search_with_pagination(self, auth_headers):
        """Verify search works with pagination"""
        response = requests.get(f"{BASE_URL}/api/admin/customers?search=test&page=1&limit=10", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "customers" in data
        assert data["page"] == 1
        assert data["limit"] == 10


class TestCustomerCRUD(TestAdminAuth):
    """Test Customer CRUD operations"""
    
    @pytest.fixture(scope="class")
    def test_customer_data(self):
        """Generate unique test customer data"""
        unique_id = str(uuid.uuid4())[:8]
        return {
            "first_name": f"TEST_Customer_{unique_id}",
            "last_name": "TestLast",
            "email": f"test_customer_{unique_id}@test.com",
            "phone": f"99{unique_id[:8].replace('-', '0')[:8]}",
            "address": "123 Test Street",
            "city": "TestCity",
            "state": "TestState",
            "pincode": "123456"
        }
    
    def test_create_customer(self, auth_headers, test_customer_data):
        """Test POST /api/admin/customers creates a new customer"""
        response = requests.post(
            f"{BASE_URL}/api/admin/customers",
            json=test_customer_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create customer failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should have customer id"
        assert data["first_name"] == test_customer_data["first_name"]
        assert data["email"] == test_customer_data["email"].lower()
        assert data["phone"] == test_customer_data["phone"]
        assert data["role"] == "customer"
        
        # Store customer_id for later tests
        test_customer_data["id"] = data["id"]
        print(f"Created customer: {data['id']}")
        return data["id"]
    
    def test_update_customer(self, auth_headers, test_customer_data):
        """Test PATCH /api/admin/customers/{id} updates customer"""
        # First create a customer
        unique_id = str(uuid.uuid4())[:8]
        create_data = {
            "first_name": f"TEST_Update_{unique_id}",
            "last_name": "Original",
            "email": f"test_update_{unique_id}@test.com",
            "phone": f"88{unique_id[:8].replace('-', '0')[:8]}"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/admin/customers",
            json=create_data,
            headers=auth_headers
        )
        assert create_response.status_code == 200
        customer_id = create_response.json()["id"]
        
        # Update the customer
        update_data = {
            "first_name": "TEST_Updated",
            "city": "UpdatedCity"
        }
        
        update_response = requests.patch(
            f"{BASE_URL}/api/admin/customers/{customer_id}",
            json=update_data,
            headers=auth_headers
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated = update_response.json()
        assert updated["first_name"] == "TEST_Updated"
        assert updated["city"] == "UpdatedCity"
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/admin/customers?search={customer_id}", headers=auth_headers)
        assert get_response.status_code == 200
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/customers/{customer_id}", headers=auth_headers)
        print(f"Updated and cleaned up customer: {customer_id}")
    
    def test_delete_customer_without_tickets(self, auth_headers):
        """Test DELETE /api/admin/customers/{id} succeeds for customer without tickets"""
        # Create a fresh customer
        unique_id = str(uuid.uuid4())[:8]
        create_data = {
            "first_name": f"TEST_Delete_{unique_id}",
            "last_name": "ToDelete",
            "email": f"test_delete_{unique_id}@test.com",
            "phone": f"77{unique_id[:8].replace('-', '0')[:8]}"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/admin/customers",
            json=create_data,
            headers=auth_headers
        )
        assert create_response.status_code == 200
        customer_id = create_response.json()["id"]
        
        # Delete the customer
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/customers/{customer_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        data = delete_response.json()
        assert "message" in data
        assert "deleted" in data["message"].lower()
        
        print(f"Successfully deleted customer: {customer_id}")
    
    def test_delete_customer_with_tickets_blocked(self, auth_headers):
        """Test DELETE /api/admin/customers/{id} returns 400 for customer with tickets"""
        # Find a customer with tickets
        customers_response = requests.get(f"{BASE_URL}/api/admin/customers?limit=100", headers=auth_headers)
        assert customers_response.status_code == 200
        
        customers = customers_response.json()["customers"]
        customer_with_tickets = None
        
        for customer in customers:
            if customer.get("tickets") and len(customer["tickets"]) > 0:
                customer_with_tickets = customer
                break
        
        if customer_with_tickets:
            # Try to delete - should fail
            delete_response = requests.delete(
                f"{BASE_URL}/api/admin/customers/{customer_with_tickets['id']}",
                headers=auth_headers
            )
            assert delete_response.status_code == 400, f"Should return 400 for customer with tickets, got {delete_response.status_code}"
            
            data = delete_response.json()
            assert "detail" in data
            assert "ticket" in data["detail"].lower()
            
            print(f"Correctly blocked deletion of customer with tickets: {customer_with_tickets['id']}")
        else:
            pytest.skip("No customer with tickets found to test deletion blocking")


class TestWarrantyRejection(TestAdminAuth):
    """Test warranty rejection with FormData"""
    
    def test_warranty_reject_with_formdata_notes(self, auth_headers):
        """Test PATCH /api/warranties/{id}/reject accepts FormData with 'notes' field"""
        # First get a pending warranty
        warranties_response = requests.get(f"{BASE_URL}/api/warranties?status=pending", headers=auth_headers)
        
        if warranties_response.status_code != 200:
            pytest.skip("Could not fetch warranties")
        
        warranties = warranties_response.json()
        pending_warranty = None
        
        if isinstance(warranties, list):
            for w in warranties:
                if w.get("status") == "pending":
                    pending_warranty = w
                    break
        
        if not pending_warranty:
            # Create a test warranty to reject
            pytest.skip("No pending warranty found to test rejection")
        
        warranty_id = pending_warranty["id"]
        
        # Reject with FormData (notes field)
        reject_response = requests.patch(
            f"{BASE_URL}/api/warranties/{warranty_id}/reject",
            data={"notes": "TEST rejection reason via FormData"},
            headers=auth_headers
        )
        
        assert reject_response.status_code == 200, f"Warranty rejection failed: {reject_response.text}"
        
        data = reject_response.json()
        assert "message" in data
        assert "rejected" in data["message"].lower()
        
        print(f"Successfully rejected warranty: {warranty_id}")
    
    def test_warranty_reject_with_query_param_reason(self, auth_headers):
        """Test PATCH /api/warranties/{id}/reject accepts query param 'reason'"""
        # Get another pending warranty
        warranties_response = requests.get(f"{BASE_URL}/api/warranties?status=pending", headers=auth_headers)
        
        if warranties_response.status_code != 200:
            pytest.skip("Could not fetch warranties")
        
        warranties = warranties_response.json()
        pending_warranty = None
        
        if isinstance(warranties, list):
            for w in warranties:
                if w.get("status") == "pending":
                    pending_warranty = w
                    break
        
        if not pending_warranty:
            pytest.skip("No pending warranty found to test rejection")
        
        warranty_id = pending_warranty["id"]
        
        # Reject with query param
        reject_response = requests.patch(
            f"{BASE_URL}/api/warranties/{warranty_id}/reject?reason=TEST rejection via query param",
            headers=auth_headers
        )
        
        assert reject_response.status_code == 200, f"Warranty rejection failed: {reject_response.text}"
        
        data = reject_response.json()
        assert "message" in data
        
        print(f"Successfully rejected warranty with query param: {warranty_id}")
    
    def test_warranty_reject_requires_reason(self, auth_headers):
        """Test PATCH /api/warranties/{id}/reject requires reason"""
        # Get a pending warranty
        warranties_response = requests.get(f"{BASE_URL}/api/warranties?status=pending", headers=auth_headers)
        
        if warranties_response.status_code != 200:
            pytest.skip("Could not fetch warranties")
        
        warranties = warranties_response.json()
        pending_warranty = None
        
        if isinstance(warranties, list):
            for w in warranties:
                if w.get("status") == "pending":
                    pending_warranty = w
                    break
        
        if not pending_warranty:
            pytest.skip("No pending warranty found to test")
        
        warranty_id = pending_warranty["id"]
        
        # Try to reject without reason
        reject_response = requests.patch(
            f"{BASE_URL}/api/warranties/{warranty_id}/reject",
            headers=auth_headers
        )
        
        assert reject_response.status_code == 400, f"Should return 400 without reason, got {reject_response.status_code}"
        
        data = reject_response.json()
        assert "detail" in data
        assert "reason" in data["detail"].lower() or "required" in data["detail"].lower()
        
        print("Correctly requires rejection reason")


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    
    # Login as admin
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if login_response.status_code == 200:
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get all customers and delete TEST_ prefixed ones
        customers_response = requests.get(f"{BASE_URL}/api/admin/customers?search=TEST_&limit=100", headers=headers)
        if customers_response.status_code == 200:
            customers = customers_response.json().get("customers", [])
            for customer in customers:
                if customer.get("first_name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/admin/customers/{customer['id']}", headers=headers)
                    print(f"Cleaned up test customer: {customer['id']}")

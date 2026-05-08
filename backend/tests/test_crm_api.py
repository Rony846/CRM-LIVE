"""
MuscleGrid CRM API Tests
Tests all user roles, authentication, and CRUD operations
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://crm-rebuild-11.preview.emergentagent.com').rstrip('/')

# Test credentials from migration
TEST_CREDENTIALS = {
    "admin": {"email": "admin@musclegrid.in", "password": "admin123"},
    "support": {"email": "support@musclegrid.in", "password": "support123"},
    "accountant": {"email": "accountant@musclegrid.in", "password": "accountant123"},
    "dispatcher": {"email": "dispatcher@musclegrid.in", "password": "dispatch123"},
    "technician": {"email": "technician@musclegrid.in", "password": "tech123"},
    "gate": {"email": "gate@musclegrid.in", "password": "gate123"},
    "customer_ami_t": {"email": "ami_t@live.com", "password": "customer123"},
    "customer_manas": {"email": "manas.cdac@gmail.com", "password": "customer123"},
}

@pytest.fixture(scope="module")
def api_session():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestAdminAuthentication:
    """Admin login and dashboard tests"""
    
    def test_admin_login_success(self, api_session):
        """Admin: admin@musclegrid.in / admin123 can login"""
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CREDENTIALS["admin"]["email"],
            "password": TEST_CREDENTIALS["admin"]["password"]
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Token not in response"
        assert data["user"]["role"] == "admin", f"Expected admin role, got {data['user']['role']}"
        assert data["user"]["email"] == "admin@musclegrid.in"
        print(f"✓ Admin login successful: {data['user']['email']}")
        
    def test_admin_login_invalid_password(self, api_session):
        """Admin login with wrong password fails"""
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CREDENTIALS["admin"]["email"],
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Admin invalid password correctly rejected")
        
    def test_admin_dashboard_stats(self, api_session):
        """Admin dashboard shows correct stats (40 customers, 14 tickets from migration)"""
        # Login first
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["admin"])
        token = login_resp.json()["access_token"]
        
        # Get admin stats
        response = api_session.get(f"{BASE_URL}/api/admin/stats", 
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200, f"Stats request failed: {response.text}"
        
        stats = response.json()
        assert "total_customers" in stats, "total_customers not in stats"
        assert "total_tickets" in stats, "total_tickets not in stats"
        
        # Verify data migration numbers (40 customers, 14 tickets from latest migration)
        assert stats["total_customers"] >= 35, f"Expected ~40 customers, got {stats['total_customers']}"
        assert stats["total_tickets"] >= 10, f"Expected ~14 tickets, got {stats['total_tickets']}"
        print(f"✓ Admin stats: {stats['total_customers']} customers, {stats['total_tickets']} tickets")
        

class TestAdminCustomerManagement:
    """Admin customer CRM tests"""
    
    def test_admin_view_all_customers(self, api_session):
        """Admin can view all customers list"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["admin"])
        token = login_resp.json()["access_token"]
        
        response = api_session.get(f"{BASE_URL}/api/admin/customers",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200, f"Failed to get customers: {response.text}"
        
        customers = response.json()
        assert isinstance(customers, list), "Response should be list"
        assert len(customers) >= 35, f"Expected ~40 customers, got {len(customers)}"
        print(f"✓ Admin retrieved {len(customers)} customers")
        
    def test_admin_search_customers(self, api_session):
        """Admin can search customers"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["admin"])
        token = login_resp.json()["access_token"]
        
        # Search for known customer
        response = api_session.get(f"{BASE_URL}/api/admin/customers?search=Amit",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        
        customers = response.json()
        assert len(customers) > 0, "Expected to find customer named Amit"
        
        # Verify search results contain search term
        found_amit = any("amit" in c.get("first_name", "").lower() or "amit" in c.get("last_name", "").lower() for c in customers)
        assert found_amit, "Search results should contain Amit"
        print(f"✓ Admin search found {len(customers)} matching customers")
        
    def test_admin_customer_details_with_warranties_and_tickets(self, api_session):
        """Admin can view customer details with warranties and tickets"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["admin"])
        token = login_resp.json()["access_token"]
        
        # Get customers list
        response = api_session.get(f"{BASE_URL}/api/admin/customers",
            headers={"Authorization": f"Bearer {token}"})
        customers = response.json()
        
        # Find first customer with warranty data
        customer_with_data = None
        for c in customers:
            if c.get("warranties") and len(c.get("warranties", [])) > 0:
                customer_with_data = c
                break
        
        if customer_with_data:
            assert "warranties" in customer_with_data, "Customer should have warranties list"
            assert "tickets" in customer_with_data, "Customer should have tickets list"
            print(f"✓ Customer details include warranties ({len(customer_with_data.get('warranties', []))}) and tickets ({len(customer_with_data.get('tickets', []))})")
        else:
            print("✓ Customer list retrieved (no warranty data found)")


class TestCustomerAuthentication:
    """Customer login tests using migrated customer accounts"""
    
    def test_customer_login_ami_t(self, api_session):
        """Migrated customer ami_t@live.com can login with customer123"""
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CREDENTIALS["customer_ami_t"]["email"],
            "password": TEST_CREDENTIALS["customer_ami_t"]["password"]
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "customer", f"Expected customer role, got {data['user']['role']}"
        assert data["user"]["email"] == "ami_t@live.com"
        print(f"✓ Customer login successful: {data['user']['email']}")
        
    def test_customer_login_manas(self, api_session):
        """Migrated customer manas.cdac@gmail.com can login with customer123"""
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CREDENTIALS["customer_manas"]["email"],
            "password": TEST_CREDENTIALS["customer_manas"]["password"]
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "customer"
        print(f"✓ Customer manas login successful")


class TestCustomerDashboard:
    """Customer dashboard and operations tests"""
    
    def test_customer_dashboard_stats(self, api_session):
        """Customer dashboard shows their tickets and warranties"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["customer_ami_t"])
        token = login_resp.json()["access_token"]
        
        # Get customer stats
        response = api_session.get(f"{BASE_URL}/api/stats",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200, f"Stats failed: {response.text}"
        
        stats = response.json()
        assert "my_tickets" in stats, "my_tickets not in customer stats"
        assert "my_warranties" in stats, "my_warranties not in customer stats"
        print(f"✓ Customer stats: {stats.get('my_tickets', 0)} tickets, {stats.get('my_warranties', 0)} warranties")
        
    def test_customer_view_tickets(self, api_session):
        """Customer can view their tickets"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["customer_ami_t"])
        token = login_resp.json()["access_token"]
        
        response = api_session.get(f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        tickets = response.json()
        assert isinstance(tickets, list)
        print(f"✓ Customer can view tickets: {len(tickets)} found")
        
    def test_customer_view_warranties(self, api_session):
        """Customer can view their warranties"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["customer_ami_t"])
        token = login_resp.json()["access_token"]
        
        response = api_session.get(f"{BASE_URL}/api/warranties",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        warranties = response.json()
        assert isinstance(warranties, list)
        print(f"✓ Customer can view warranties: {len(warranties)} found")
        
    def test_customer_create_ticket(self, api_session):
        """Customer can create a new support ticket (using multipart form)"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["customer_ami_t"])
        token = login_resp.json()["access_token"]
        
        # Ticket creation uses multipart Form data - use fresh requests to avoid Content-Type issues
        import requests
        ticket_data = {
            "device_type": (None, "Inverter"),
            "order_id": (None, "TEST-ORDER-123"),
            "issue_description": (None, "Test ticket created by pytest - inverter not turning on")
        }
        
        response = requests.post(f"{BASE_URL}/api/tickets", 
            files=ticket_data,
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200, f"Create ticket failed: {response.text}"
        
        ticket = response.json()
        assert "id" in ticket, "Ticket should have id"
        assert "ticket_number" in ticket, "Ticket should have ticket_number"
        assert ticket["status"] == "new_request" or ticket["status"] == "open", f"New ticket should be new_request/open, got {ticket['status']}"
        assert ticket["device_type"] == "Inverter"
        print(f"✓ Customer created ticket: {ticket['ticket_number']}")


class TestCallSupportRole:
    """Call support agent login and access tests"""
    
    def test_support_login(self, api_session):
        """Call support: support@musclegrid.in / support123 can login"""
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CREDENTIALS["support"]["email"],
            "password": TEST_CREDENTIALS["support"]["password"]
        })
        assert response.status_code == 200, f"Support login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "call_support"
        print(f"✓ Support login successful")
        
    def test_support_view_tickets(self, api_session):
        """Support agent can view support tickets"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["support"])
        token = login_resp.json()["access_token"]
        
        response = api_session.get(f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        print(f"✓ Support can view tickets: {len(response.json())} found")


class TestDispatcherRole:
    """Dispatcher login and access tests"""
    
    def test_dispatcher_login(self, api_session):
        """Dispatcher: dispatcher@musclegrid.in / dispatch123 can login"""
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CREDENTIALS["dispatcher"]["email"],
            "password": TEST_CREDENTIALS["dispatcher"]["password"]
        })
        assert response.status_code == 200, f"Dispatcher login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "dispatcher"
        print(f"✓ Dispatcher login successful")
        
    def test_dispatcher_view_queue(self, api_session):
        """Dispatcher can view dispatch queue"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["dispatcher"])
        token = login_resp.json()["access_token"]
        
        response = api_session.get(f"{BASE_URL}/api/dispatcher/queue",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        print(f"✓ Dispatcher can view queue: {len(response.json())} items")


class TestAccountantRole:
    """Accountant login and access tests"""
    
    def test_accountant_login(self, api_session):
        """Accountant: accountant@musclegrid.in / accountant123 can login"""
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CREDENTIALS["accountant"]["email"],
            "password": TEST_CREDENTIALS["accountant"]["password"]
        })
        assert response.status_code == 200, f"Accountant login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "accountant"
        print(f"✓ Accountant login successful")
        
    def test_accountant_view_dispatches(self, api_session):
        """Accountant can view dispatches"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["accountant"])
        token = login_resp.json()["access_token"]
        
        response = api_session.get(f"{BASE_URL}/api/dispatches",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        print(f"✓ Accountant can view dispatches: {len(response.json())} found")


class TestTechnicianRole:
    """Technician login and access tests"""
    
    def test_technician_login(self, api_session):
        """Technician: technician@musclegrid.in / tech123 can login"""
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CREDENTIALS["technician"]["email"],
            "password": TEST_CREDENTIALS["technician"]["password"]
        })
        assert response.status_code == 200, f"Technician login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "service_agent", f"Expected service_agent role, got {data['user']['role']}"
        print(f"✓ Technician login successful")
        
    def test_technician_view_repair_queue(self, api_session):
        """Technician can view repair queue"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["technician"])
        token = login_resp.json()["access_token"]
        
        response = api_session.get(f"{BASE_URL}/api/technician/queue",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        print(f"✓ Technician can view repair queue: {len(response.json())} items")


class TestGateRole:
    """Gate control login and access tests"""
    
    def test_gate_login(self, api_session):
        """Gate: gate@musclegrid.in / gate123 can login"""
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CREDENTIALS["gate"]["email"],
            "password": TEST_CREDENTIALS["gate"]["password"]
        })
        assert response.status_code == 200, f"Gate login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "gate"
        print(f"✓ Gate login successful")
        
    def test_gate_view_expected(self, api_session):
        """Gate can view expected incoming"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["gate"])
        token = login_resp.json()["access_token"]
        
        response = api_session.get(f"{BASE_URL}/api/gate/scheduled",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        print(f"✓ Gate can view scheduled items")


class TestRoleBasedAccessControl:
    """Role-based access control tests"""
    
    def test_customer_cannot_access_admin_stats(self, api_session):
        """Customer role cannot access admin endpoints"""
        # Login as customer
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["customer_ami_t"])
        token = login_resp.json()["access_token"]
        
        # Try to access admin stats
        response = api_session.get(f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403, f"Customer should not access admin stats, got {response.status_code}"
        print(f"✓ Customer correctly blocked from admin stats (403)")
        
    def test_customer_cannot_access_admin_customers(self, api_session):
        """Customer cannot access admin customer list"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["customer_ami_t"])
        token = login_resp.json()["access_token"]
        
        response = api_session.get(f"{BASE_URL}/api/admin/customers",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403, f"Customer should not access admin customers, got {response.status_code}"
        print(f"✓ Customer correctly blocked from admin customers (403)")
        
    def test_support_can_access_tickets(self, api_session):
        """Support agent can access tickets"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["support"])
        token = login_resp.json()["access_token"]
        
        response = api_session.get(f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        print(f"✓ Support agent can access tickets")
        

class TestWarrantyEndpoints:
    """Warranty management tests"""
    
    def test_admin_view_warranties(self, api_session):
        """Admin can view all warranties"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["admin"])
        token = login_resp.json()["access_token"]
        
        response = api_session.get(f"{BASE_URL}/api/warranties",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        warranties = response.json()
        assert isinstance(warranties, list)
        print(f"✓ Admin can view {len(warranties)} warranties")


class TestTicketManagement:
    """Ticket management tests"""
    
    def test_admin_view_all_tickets(self, api_session):
        """Admin can view all tickets"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["admin"])
        token = login_resp.json()["access_token"]
        
        response = api_session.get(f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        tickets = response.json()
        assert isinstance(tickets, list)
        assert len(tickets) >= 10, f"Expected at least 10 migrated tickets, got {len(tickets)}"
        print(f"✓ Admin can view {len(tickets)} tickets")
        
    def test_ticket_has_required_fields(self, api_session):
        """Tickets have required fields"""
        login_resp = api_session.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["admin"])
        token = login_resp.json()["access_token"]
        
        response = api_session.get(f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"})
        tickets = response.json()
        
        if len(tickets) > 0:
            ticket = tickets[0]
            required_fields = ["id", "ticket_number", "status", "device_type", "issue_description"]
            for field in required_fields:
                assert field in ticket, f"Ticket missing required field: {field}"
            print(f"✓ Tickets have all required fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

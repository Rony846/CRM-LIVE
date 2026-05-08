"""
Test Call Support Dashboard Features:
- Call Support login and dashboard access
- All Tickets tab (shows tickets from ALL departments)
- Status filter on All Tickets tab
- Global Search by phone number
- Global Search by email
- Customer history endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CALL_SUPPORT_EMAIL = "callsupport@musclegrid.in"
CALL_SUPPORT_PASSWORD = "Muscle@846"


class TestCallSupportLogin:
    """Test Call Support login and authentication"""
    
    def test_call_support_login_success(self):
        """Test that call support user can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CALL_SUPPORT_EMAIL,
            "password": CALL_SUPPORT_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["role"] == "call_support", f"Expected role 'call_support', got '{data['user']['role']}'"
        assert data["user"]["email"] == CALL_SUPPORT_EMAIL
        
        print(f"✓ Call Support login successful - User: {data['user']['first_name']} {data['user']['last_name']}")
    
    def test_call_support_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CALL_SUPPORT_EMAIL,
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")


class TestAllTicketsVisibility:
    """Test that Call Support can see ALL tickets across all departments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CALL_SUPPORT_EMAIL,
            "password": CALL_SUPPORT_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_all_tickets_no_filter(self):
        """Test that call support can get all tickets without any filter"""
        response = requests.get(f"{BASE_URL}/api/tickets", headers=self.headers)
        
        assert response.status_code == 200, f"Failed to get tickets: {response.text}"
        tickets = response.json()
        
        assert isinstance(tickets, list), "Expected list of tickets"
        print(f"✓ Retrieved {len(tickets)} tickets")
        
        # Verify we get tickets from different statuses (showing all departments)
        if len(tickets) > 0:
            statuses = set(t.get("status") for t in tickets)
            print(f"  Statuses found: {statuses}")
            
            # Check for various support types
            support_types = set(t.get("support_type") for t in tickets if t.get("support_type"))
            print(f"  Support types found: {support_types}")
    
    def test_filter_tickets_by_status_open(self):
        """Test filtering tickets by open status"""
        response = requests.get(f"{BASE_URL}/api/tickets?status=open", headers=self.headers)
        
        assert response.status_code == 200, f"Failed to filter tickets: {response.text}"
        tickets = response.json()
        
        # All returned tickets should have status 'open'
        for ticket in tickets:
            assert ticket.get("status") == "open", f"Expected status 'open', got '{ticket.get('status')}'"
        
        print(f"✓ Filtered by status 'open': {len(tickets)} tickets")
    
    def test_filter_tickets_by_status_hardware_service(self):
        """Test filtering tickets by hardware_service status"""
        response = requests.get(f"{BASE_URL}/api/tickets?status=hardware_service", headers=self.headers)
        
        assert response.status_code == 200, f"Failed to filter tickets: {response.text}"
        tickets = response.json()
        
        for ticket in tickets:
            assert ticket.get("status") == "hardware_service", f"Expected status 'hardware_service', got '{ticket.get('status')}'"
        
        print(f"✓ Filtered by status 'hardware_service': {len(tickets)} tickets")
    
    def test_filter_tickets_by_status_in_progress(self):
        """Test filtering tickets by in_progress status"""
        response = requests.get(f"{BASE_URL}/api/tickets?status=in_progress", headers=self.headers)
        
        assert response.status_code == 200, f"Failed to filter tickets: {response.text}"
        tickets = response.json()
        
        for ticket in tickets:
            assert ticket.get("status") == "in_progress", f"Expected status 'in_progress', got '{ticket.get('status')}'"
        
        print(f"✓ Filtered by status 'in_progress': {len(tickets)} tickets")
    
    def test_filter_tickets_by_status_resolved(self):
        """Test filtering tickets by resolved status"""
        response = requests.get(f"{BASE_URL}/api/tickets?status=resolved", headers=self.headers)
        
        assert response.status_code == 200, f"Failed to filter tickets: {response.text}"
        tickets = response.json()
        
        for ticket in tickets:
            assert ticket.get("status") == "resolved", f"Expected status 'resolved', got '{ticket.get('status')}'"
        
        print(f"✓ Filtered by status 'resolved': {len(tickets)} tickets")


class TestGlobalSearch:
    """Test Global Search functionality for Call Support"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CALL_SUPPORT_EMAIL,
            "password": CALL_SUPPORT_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get a sample ticket to use for search tests
        tickets_response = requests.get(f"{BASE_URL}/api/tickets?limit=10", headers=self.headers)
        if tickets_response.status_code == 200:
            tickets = tickets_response.json()
            if tickets:
                self.sample_ticket = tickets[0]
            else:
                self.sample_ticket = None
        else:
            self.sample_ticket = None
    
    def test_search_by_phone_number(self):
        """Test global search by phone number"""
        if not self.sample_ticket or not self.sample_ticket.get("customer_phone"):
            pytest.skip("No sample ticket with phone number available")
        
        phone = self.sample_ticket["customer_phone"]
        response = requests.get(f"{BASE_URL}/api/customers/search?phone={phone}", headers=self.headers)
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "tickets" in data, "Missing 'tickets' in response"
        assert "warranties" in data, "Missing 'warranties' in response"
        assert "dispatches" in data, "Missing 'dispatches' in response"
        assert "total_tickets" in data, "Missing 'total_tickets' in response"
        assert "total_warranties" in data, "Missing 'total_warranties' in response"
        assert "total_dispatches" in data, "Missing 'total_dispatches' in response"
        
        print(f"✓ Search by phone '{phone}': {data['total_tickets']} tickets, {data['total_warranties']} warranties, {data['total_dispatches']} dispatches")
    
    def test_search_by_email(self):
        """Test global search by email"""
        if not self.sample_ticket or not self.sample_ticket.get("customer_email"):
            pytest.skip("No sample ticket with email available")
        
        email = self.sample_ticket["customer_email"]
        response = requests.get(f"{BASE_URL}/api/customers/search?email={email}", headers=self.headers)
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "tickets" in data, "Missing 'tickets' in response"
        assert "total_tickets" in data, "Missing 'total_tickets' in response"
        
        print(f"✓ Search by email '{email}': {data['total_tickets']} tickets, {data['total_warranties']} warranties, {data['total_dispatches']} dispatches")
    
    def test_search_requires_parameter(self):
        """Test that search requires at least one parameter"""
        response = requests.get(f"{BASE_URL}/api/customers/search", headers=self.headers)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Search correctly requires at least one parameter")
    
    def test_search_by_order_id(self):
        """Test global search by order ID"""
        if not self.sample_ticket or not self.sample_ticket.get("order_id"):
            # Try to find a ticket with order_id
            tickets_response = requests.get(f"{BASE_URL}/api/tickets?limit=50", headers=self.headers)
            if tickets_response.status_code == 200:
                tickets = tickets_response.json()
                ticket_with_order = next((t for t in tickets if t.get("order_id")), None)
                if ticket_with_order:
                    order_id = ticket_with_order["order_id"]
                else:
                    pytest.skip("No ticket with order_id available")
            else:
                pytest.skip("Could not fetch tickets")
        else:
            order_id = self.sample_ticket["order_id"]
        
        response = requests.get(f"{BASE_URL}/api/customers/search?order_id={order_id}", headers=self.headers)
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        assert "tickets" in data, "Missing 'tickets' in response"
        print(f"✓ Search by order_id '{order_id}': {data['total_tickets']} tickets")


class TestCustomerHistory:
    """Test Customer History endpoint for Call Support"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CALL_SUPPORT_EMAIL,
            "password": CALL_SUPPORT_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get a sample ticket
        tickets_response = requests.get(f"{BASE_URL}/api/tickets?limit=10", headers=self.headers)
        if tickets_response.status_code == 200:
            tickets = tickets_response.json()
            if tickets:
                self.sample_ticket = tickets[0]
            else:
                self.sample_ticket = None
        else:
            self.sample_ticket = None
    
    def test_get_customer_history_for_ticket(self):
        """Test getting customer history for a specific ticket"""
        if not self.sample_ticket:
            pytest.skip("No sample ticket available")
        
        ticket_id = self.sample_ticket["id"]
        response = requests.get(f"{BASE_URL}/api/tickets/{ticket_id}/customer-history", headers=self.headers)
        
        assert response.status_code == 200, f"Failed to get customer history: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "customer_name" in data, "Missing 'customer_name' in response"
        assert "customer_phone" in data, "Missing 'customer_phone' in response"
        assert "related_tickets" in data, "Missing 'related_tickets' in response"
        assert "warranties" in data, "Missing 'warranties' in response"
        assert "dispatches" in data, "Missing 'dispatches' in response"
        assert "total_tickets" in data, "Missing 'total_tickets' in response"
        
        print(f"✓ Customer history for ticket {self.sample_ticket['ticket_number']}:")
        print(f"  Customer: {data['customer_name']} ({data['customer_phone']})")
        print(f"  Related tickets: {len(data['related_tickets'])}")
        print(f"  Warranties: {len(data['warranties'])}")
        print(f"  Dispatches: {len(data['dispatches'])}")
    
    def test_customer_history_invalid_ticket(self):
        """Test customer history with invalid ticket ID"""
        response = requests.get(f"{BASE_URL}/api/tickets/invalid-ticket-id/customer-history", headers=self.headers)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid ticket ID correctly returns 404")


class TestTicketDetails:
    """Test viewing ticket details"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CALL_SUPPORT_EMAIL,
            "password": CALL_SUPPORT_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_ticket_details(self):
        """Test getting full ticket details"""
        # First get a ticket
        tickets_response = requests.get(f"{BASE_URL}/api/tickets?limit=1", headers=self.headers)
        assert tickets_response.status_code == 200
        tickets = tickets_response.json()
        
        if not tickets:
            pytest.skip("No tickets available")
        
        ticket_id = tickets[0]["id"]
        response = requests.get(f"{BASE_URL}/api/tickets/{ticket_id}", headers=self.headers)
        
        assert response.status_code == 200, f"Failed to get ticket details: {response.text}"
        ticket = response.json()
        
        # Verify essential fields
        assert "id" in ticket, "Missing 'id' in ticket"
        assert "ticket_number" in ticket, "Missing 'ticket_number' in ticket"
        assert "customer_name" in ticket, "Missing 'customer_name' in ticket"
        assert "customer_phone" in ticket, "Missing 'customer_phone' in ticket"
        assert "status" in ticket, "Missing 'status' in ticket"
        assert "history" in ticket, "Missing 'history' in ticket"
        
        print(f"✓ Ticket details retrieved: {ticket['ticket_number']} - {ticket['status']}")
        print(f"  Customer: {ticket['customer_name']}")
        print(f"  History entries: {len(ticket.get('history', []))}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

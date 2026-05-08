"""
MuscleGrid CRM - Iteration 8 Test Cases
Tests for: Accountant Dashboard, Dispatcher Confirm, Customer Pickup Label Download, Ticket Number Consistency

Test credentials:
- Accountant: accountant@musclegrid.in / accountant123
- Dispatcher: dispatcher@musclegrid.in / dispatch123
- Customer: ami_t@live.com / customer123
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def accountant_token():
    """Get accountant authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "accountant@musclegrid.in",
        "password": "accountant123"
    })
    assert response.status_code == 200, f"Accountant login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture
def dispatcher_token():
    """Get dispatcher authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "dispatcher@musclegrid.in",
        "password": "dispatch123"
    })
    assert response.status_code == 200, f"Dispatcher login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture
def customer_token():
    """Get customer authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ami_t@live.com",
        "password": "customer123"
    })
    assert response.status_code == 200, f"Customer login failed: {response.text}"
    return response.json()["access_token"]


class TestAccountantDashboard:
    """Test Accountant Dashboard endpoints - ensures no React errors by verifying APIs return proper data"""
    
    def test_accountant_login_success(self, accountant_token):
        """Accountant can login successfully"""
        assert accountant_token is not None
        assert len(accountant_token) > 0
        print("✅ Accountant login successful")
    
    def test_accountant_get_dispatches(self, accountant_token):
        """Accountant can fetch dispatches list - returns array (not object)"""
        response = requests.get(
            f"{BASE_URL}/api/dispatches",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Dispatches should return a list, not object"
        print(f"✅ Dispatches endpoint returns list with {len(data)} items")
    
    def test_accountant_get_tickets(self, accountant_token):
        """Accountant can fetch tickets list - returns array (not object)"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Tickets should return a list, not object"
        print(f"✅ Tickets endpoint returns list with {len(data)} items")
    
    def test_accountant_get_skus(self, accountant_token):
        """Accountant can fetch SKUs list - returns array (not object)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/skus",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        # SKUs endpoint might return empty or might not be accessible
        assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list), "SKUs should return a list"
            print(f"✅ SKUs endpoint returns list with {len(data)} items")
        else:
            print("⚠️ SKUs endpoint not accessible to accountant (might be admin only)")


class TestDispatcherConfirmDispatch:
    """Test Dispatcher can click 'Dispatch' button to confirm dispatch"""
    
    def test_dispatcher_login_success(self, dispatcher_token):
        """Dispatcher can login successfully"""
        assert dispatcher_token is not None
        assert len(dispatcher_token) > 0
        print("✅ Dispatcher login successful")
    
    def test_dispatcher_get_queue(self, dispatcher_token):
        """Dispatcher can fetch dispatch queue"""
        response = requests.get(
            f"{BASE_URL}/api/dispatcher/queue",
            headers={"Authorization": f"Bearer {dispatcher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Dispatcher queue returns {len(data)} items")
        return data
    
    def test_dispatcher_confirm_dispatch(self, dispatcher_token):
        """Dispatcher can confirm dispatch using PATCH with FormData"""
        # First get the queue
        queue_response = requests.get(
            f"{BASE_URL}/api/dispatcher/queue",
            headers={"Authorization": f"Bearer {dispatcher_token}"}
        )
        assert queue_response.status_code == 200
        queue = queue_response.json()
        
        if len(queue) == 0:
            pytest.skip("No items in dispatch queue to test")
        
        # Get first item
        item = queue[0]
        item_id = item["id"]
        
        # Confirm dispatch using FormData (matching frontend behavior)
        response = requests.patch(
            f"{BASE_URL}/api/dispatches/{item_id}/status",
            headers={"Authorization": f"Bearer {dispatcher_token}"},
            data={"status": "dispatched"}  # Form data, not JSON
        )
        
        assert response.status_code == 200, f"Failed to confirm dispatch: {response.text}"
        result = response.json()
        assert "message" in result
        assert "dispatched" in result["message"].lower()
        print(f"✅ Dispatch confirmed: {result['message']}")


class TestCustomerPickupLabel:
    """Test Customer can see and download pickup label from ticket details"""
    
    def test_customer_login_success(self, customer_token):
        """Customer can login successfully"""
        assert customer_token is not None
        assert len(customer_token) > 0
        print("✅ Customer login successful")
    
    def test_customer_get_tickets(self, customer_token):
        """Customer can fetch their tickets"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Customer has {len(data)} tickets")
        return data
    
    def test_customer_ticket_has_pickup_label(self, customer_token):
        """Customer ticket with pickup_label shows label info"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        tickets = response.json()
        
        # Find tickets with pickup_label
        tickets_with_label = [t for t in tickets if t.get("pickup_label")]
        
        if len(tickets_with_label) == 0:
            pytest.skip("No tickets with pickup labels found")
        
        ticket = tickets_with_label[0]
        assert "pickup_label" in ticket
        assert "pickup_courier" in ticket
        assert "pickup_tracking" in ticket
        assert ticket["pickup_label"] is not None
        
        print(f"✅ Ticket {ticket['ticket_number']} has pickup label:")
        print(f"   - Label URL: {ticket['pickup_label']}")
        print(f"   - Courier: {ticket['pickup_courier']}")
        print(f"   - Tracking: {ticket['pickup_tracking']}")
    
    def test_pickup_label_download(self, customer_token):
        """Customer can download pickup label file"""
        # Get tickets first
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        tickets = response.json()
        tickets_with_label = [t for t in tickets if t.get("pickup_label")]
        
        if len(tickets_with_label) == 0:
            pytest.skip("No tickets with pickup labels found")
        
        label_url = tickets_with_label[0]["pickup_label"]
        full_url = f"{BASE_URL}{label_url}" if label_url.startswith("/") else label_url
        
        # Try to download the file
        download_response = requests.get(full_url)
        assert download_response.status_code == 200, f"Failed to download label: {download_response.status_code}"
        assert len(download_response.content) > 0, "Downloaded file is empty"
        print(f"✅ Pickup label downloaded successfully ({len(download_response.content)} bytes)")


class TestTicketNumberConsistency:
    """Test ticket number stays same throughout workflow"""
    
    def test_ticket_number_format(self, customer_token):
        """Ticket numbers follow MG-R-YYYYMMDD-XXXXX format"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        tickets = response.json()
        
        if len(tickets) == 0:
            pytest.skip("No tickets found")
        
        import re
        pattern = r"MG-R-\d{8}-\d{5}"
        
        for ticket in tickets[:5]:  # Check first 5 tickets
            ticket_number = ticket["ticket_number"]
            assert re.match(pattern, ticket_number), f"Invalid ticket number format: {ticket_number}"
        
        print(f"✅ All ticket numbers follow correct format")
    
    def test_ticket_number_in_history(self, customer_token):
        """Ticket number remains consistent in ticket history"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        tickets = response.json()
        
        # Find ticket with history
        tickets_with_history = [t for t in tickets if len(t.get("history", [])) > 1]
        
        if len(tickets_with_history) == 0:
            pytest.skip("No tickets with history found")
        
        ticket = tickets_with_history[0]
        ticket_id = ticket["id"]
        ticket_number = ticket["ticket_number"]
        
        # Fetch ticket details
        detail_response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert detail_response.status_code == 200
        detail = detail_response.json()
        
        # Verify ticket number is same
        assert detail["ticket_number"] == ticket_number
        print(f"✅ Ticket {ticket_number} maintains consistent number throughout workflow")


class TestRepairNotesVisibility:
    """Test repair status visible to customer in ticket history"""
    
    def test_customer_can_see_repair_notes(self, customer_token):
        """Customer can see repair_notes in ticket details"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        tickets = response.json()
        
        # Find tickets with repair_notes
        repaired_tickets = [t for t in tickets if t.get("repair_notes")]
        
        if len(repaired_tickets) == 0:
            pytest.skip("No repaired tickets found")
        
        ticket = repaired_tickets[0]
        assert "repair_notes" in ticket
        assert ticket["repair_notes"] is not None
        assert len(ticket["repair_notes"]) > 0
        
        print(f"✅ Customer can see repair notes for ticket {ticket['ticket_number']}")
        print(f"   - Status: {ticket['status']}")
        print(f"   - Repair Notes: {ticket['repair_notes']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

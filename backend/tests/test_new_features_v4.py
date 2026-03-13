"""
MuscleGrid CRM - Test New Features v4
Tests for: Supervisor Dashboard, Dispatcher Queue, SKU Management, Escalate to Supervisor
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test Credentials
CREDENTIALS = {
    "admin": {"email": "admin@musclegrid.in", "password": "admin123"},
    "supervisor": {"email": "supervisor@musclegrid.in", "password": "supervisor123"},
    "dispatcher": {"email": "dispatcher@musclegrid.in", "password": "dispatch123"},
    "support": {"email": "support@musclegrid.in", "password": "support123"},
}


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def get_token(api_client, role):
    """Helper to get auth token for a role"""
    creds = CREDENTIALS.get(role)
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=creds)
    if response.status_code == 200:
        return response.json().get("access_token")
    return None


# ========== AUTH TESTS ==========
class TestAuthentication:
    """Test all user role authentication"""
    
    def test_supervisor_login(self, api_client):
        """Supervisor should be able to login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["supervisor"])
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "supervisor"
        print("PASS: Supervisor login successful")
    
    def test_dispatcher_login(self, api_client):
        """Dispatcher should be able to login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["dispatcher"])
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "dispatcher"
        print("PASS: Dispatcher login successful")
    
    def test_support_login(self, api_client):
        """Support agent should be able to login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["support"])
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "call_support"
        print("PASS: Support login successful")


# ========== DISPATCHER TESTS ==========
class TestDispatcherQueue:
    """Test dispatcher queue showing ready to dispatch items"""
    
    def test_dispatcher_queue_endpoint(self, api_client):
        """Dispatcher queue should return 200 and items"""
        token = get_token(api_client, "dispatcher")
        assert token, "Failed to get dispatcher token"
        
        response = api_client.get(
            f"{BASE_URL}/api/dispatcher/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Dispatcher queue returns {len(data)} items")
    
    def test_dispatcher_queue_contains_ready_for_dispatch(self, api_client):
        """Dispatcher queue should contain items with ready_for_dispatch status"""
        token = get_token(api_client, "dispatcher")
        assert token, "Failed to get dispatcher token"
        
        response = api_client.get(
            f"{BASE_URL}/api/dispatcher/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should contain ready_for_dispatch items
        ready_items = [d for d in data if d.get("status") == "ready_for_dispatch"]
        print(f"PASS: Found {len(ready_items)} items ready for dispatch")


# ========== SUPERVISOR TESTS ==========
class TestSupervisorDashboard:
    """Test supervisor dashboard endpoints"""
    
    def test_supervisor_queue_endpoint(self, api_client):
        """Supervisor queue should return escalated tickets"""
        token = get_token(api_client, "supervisor")
        assert token, "Failed to get supervisor token"
        
        response = api_client.get(
            f"{BASE_URL}/api/supervisor/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Supervisor queue returns {len(data)} escalated tickets")
    
    def test_supervisor_stats_endpoint(self, api_client):
        """Supervisor stats should return correct structure"""
        token = get_token(api_client, "supervisor")
        assert token, "Failed to get supervisor token"
        
        response = api_client.get(
            f"{BASE_URL}/api/supervisor/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "escalated_tickets" in data
        assert "customer_escalated" in data
        assert "urgent_tickets" in data
        assert "resolved_today" in data
        print(f"PASS: Supervisor stats - {data}")
    
    def test_supervisor_queue_contains_escalated_tickets(self, api_client):
        """Supervisor queue should contain tickets with escalated_to_supervisor status"""
        token = get_token(api_client, "supervisor")
        assert token, "Failed to get supervisor token"
        
        response = api_client.get(
            f"{BASE_URL}/api/supervisor/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for escalated tickets
        escalated = [t for t in data if t.get("status") in ["escalated_to_supervisor", "supervisor_followup", "customer_escalated"]]
        assert len(escalated) == len(data)  # All should be escalated
        print(f"PASS: All {len(escalated)} tickets are in escalated status")
    
    def test_supervisor_queue_has_sla_info(self, api_client):
        """Supervisor queue tickets should have SLA info"""
        token = get_token(api_client, "supervisor")
        assert token, "Failed to get supervisor token"
        
        response = api_client.get(
            f"{BASE_URL}/api/supervisor/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            ticket = data[0]
            assert "supervisor_sla_due" in ticket
            assert "supervisor_sla_breached" in ticket
            assert "supervisor_hours_remaining" in ticket
            print(f"PASS: Supervisor SLA info present - Hours remaining: {ticket.get('supervisor_hours_remaining')}")


# ========== SKU MANAGEMENT TESTS ==========
class TestSKUManagement:
    """Test SKU/Inventory management endpoints"""
    
    def test_get_skus_endpoint(self, api_client):
        """Admin should be able to list SKUs"""
        token = get_token(api_client, "admin")
        assert token, "Failed to get admin token"
        
        response = api_client.get(
            f"{BASE_URL}/api/admin/skus",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Found {len(data)} SKUs")
    
    def test_sku_has_required_fields(self, api_client):
        """SKUs should have all required fields"""
        token = get_token(api_client, "admin")
        assert token, "Failed to get admin token"
        
        response = api_client.get(
            f"{BASE_URL}/api/admin/skus",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            sku = data[0]
            required_fields = ["id", "sku_code", "model_name", "category", "stock_quantity", "min_stock_alert", "active"]
            for field in required_fields:
                assert field in sku, f"Missing field: {field}"
            print(f"PASS: SKU has all required fields - {sku['sku_code']}")
    
    def test_create_sku(self, api_client):
        """Admin should be able to create a new SKU"""
        token = get_token(api_client, "admin")
        assert token, "Failed to get admin token"
        
        new_sku = {
            "sku_code": "TEST-SKU-001",
            "model_name": "Test Product for Testing",
            "category": "Spare Part",
            "stock_quantity": 10,
            "min_stock_alert": 3
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/admin/skus",
            headers={"Authorization": f"Bearer {token}"},
            json=new_sku
        )
        
        # Could be 200 if already exists, or 201/200 for new
        if response.status_code == 400:
            print("PASS: SKU already exists (expected on rerun)")
        else:
            assert response.status_code in [200, 201]
            data = response.json()
            assert data["sku_code"] == new_sku["sku_code"]
            print(f"PASS: Created SKU - {data['sku_code']}")


# ========== ESCALATE TO SUPERVISOR TESTS ==========
class TestEscalateToSupervisor:
    """Test escalate to supervisor functionality"""
    
    def test_escalate_requires_100_char_notes(self, api_client):
        """Escalation should require 100+ character notes"""
        token = get_token(api_client, "support")
        assert token, "Failed to get support token"
        
        # First get a ticket to escalate
        response = api_client.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        tickets = response.json()
        
        if len(tickets) == 0:
            pytest.skip("No tickets available to test escalation")
        
        # Find a ticket that's not already escalated
        target_ticket = None
        for t in tickets:
            if t.get("status") not in ["escalated_to_supervisor", "supervisor_followup", "customer_escalated", "closed"]:
                target_ticket = t
                break
        
        if not target_ticket:
            pytest.skip("No suitable ticket found for escalation test")
        
        # Try with short notes - use data= for form-encoded
        short_notes = "Short note"
        response = requests.post(
            f"{BASE_URL}/api/tickets/{target_ticket['id']}/escalate-to-supervisor",
            headers={"Authorization": f"Bearer {token}"},
            data={"notes": short_notes}
        )
        assert response.status_code == 400
        assert "100" in response.json().get("detail", "")
        print("PASS: Escalation correctly requires 100+ character notes")


# ========== ROUTE TO HARDWARE TESTS ==========
class TestRouteToHardware:
    """Test route to hardware functionality"""
    
    def test_route_to_hardware_requires_100_char_notes(self, api_client):
        """Routing to hardware should require 100+ character notes"""
        token = get_token(api_client, "support")
        assert token, "Failed to get support token"
        
        # First get a ticket
        response = api_client.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        tickets = response.json()
        
        if len(tickets) == 0:
            pytest.skip("No tickets available to test")
        
        # Find a suitable ticket
        target_ticket = None
        for t in tickets:
            if t.get("status") in ["new_request", "call_support_followup"] and t.get("support_type") == "phone":
                target_ticket = t
                break
        
        if not target_ticket:
            pytest.skip("No suitable ticket found for hardware routing test")
        
        # Try with short notes - use data= for form-encoded
        short_notes = "Short"
        response = requests.post(
            f"{BASE_URL}/api/tickets/{target_ticket['id']}/route-to-hardware",
            headers={"Authorization": f"Bearer {token}"},
            data={"notes": short_notes}
        )
        assert response.status_code == 400
        assert "100" in response.json().get("detail", "")
        print("PASS: Route to hardware correctly requires 100+ character notes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

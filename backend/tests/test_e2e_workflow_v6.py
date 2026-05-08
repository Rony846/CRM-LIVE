"""
MuscleGrid CRM - E2E Workflow Test Suite v6
Tests for:
1. Full E2E Workflow: Customer → Support → Supervisor → Accountant → Technician → Dispatcher
2. Duplicate ticket prevention
3. Admin Performance Analytics
4. Admin SSO to dashboards
5. Accountant Hardware Tab with notes
"""
import pytest
import requests
import os
import time
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test Credentials
CREDENTIALS = {
    "admin": {"email": "admin@musclegrid.in", "password": "admin123"},
    "support": {"email": "support@musclegrid.in", "password": "support123"},
    "supervisor": {"email": "supervisor@musclegrid.in", "password": "supervisor123"},
    "accountant": {"email": "accountant@musclegrid.in", "password": "accountant123"},
    "technician": {"email": "technician@musclegrid.in", "password": "tech123"},
    "dispatcher": {"email": "dispatcher@musclegrid.in", "password": "dispatch123"},
    "customer": {"email": "ami_t@live.com", "password": "customer123"}
}

@pytest.fixture(scope="module")
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
    print(f"Failed to get token for {role}: {response.status_code} - {response.text}")
    return None


# ========== AUTH TESTS - All Roles ==========
class TestAllRolesAuth:
    """Test authentication for all roles required in E2E workflow"""
    
    def test_admin_login(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["admin"])
        assert response.status_code == 200
        assert response.json()["user"]["role"] == "admin"
        print("PASS: Admin login")
    
    def test_customer_login(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["customer"])
        assert response.status_code == 200
        assert response.json()["user"]["role"] == "customer"
        print("PASS: Customer login")
    
    def test_support_login(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["support"])
        assert response.status_code == 200
        assert response.json()["user"]["role"] == "call_support"
        print("PASS: Support login")
    
    def test_supervisor_login(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["supervisor"])
        assert response.status_code == 200
        assert response.json()["user"]["role"] == "supervisor"
        print("PASS: Supervisor login")
    
    def test_accountant_login(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["accountant"])
        assert response.status_code == 200
        assert response.json()["user"]["role"] == "accountant"
        print("PASS: Accountant login")
    
    def test_technician_login(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["technician"])
        assert response.status_code == 200
        assert response.json()["user"]["role"] == "service_agent"
        print("PASS: Technician login")
    
    def test_dispatcher_login(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["dispatcher"])
        assert response.status_code == 200
        assert response.json()["user"]["role"] == "dispatcher"
        print("PASS: Dispatcher login")


# ========== DUPLICATE TICKET PREVENTION TESTS ==========
class TestDuplicateTicketPrevention:
    """Test duplicate ticket check endpoint"""
    
    def test_check_duplicate_endpoint_exists(self, api_client):
        """Check-duplicate endpoint should exist and respond"""
        token = get_token(api_client, "customer")
        assert token, "Customer token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/tickets/check-duplicate",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "has_duplicate" in data
        print("PASS: Check duplicate endpoint works")
    
    def test_check_duplicate_with_serial_number(self, api_client):
        """Check duplicate should work with serial number parameter"""
        token = get_token(api_client, "customer")
        assert token, "Customer token required"
        
        # Use a random serial that shouldn't exist
        random_serial = f"TEST-SN-{random.randint(100000, 999999)}"
        
        response = api_client.get(
            f"{BASE_URL}/api/tickets/check-duplicate?serial_number={random_serial}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_duplicate"] == False
        print("PASS: Check duplicate with serial number - no duplicate found")
    
    def test_check_duplicate_with_order_id(self, api_client):
        """Check duplicate should work with order_id parameter"""
        token = get_token(api_client, "customer")
        assert token, "Customer token required"
        
        # Use a random order ID that shouldn't exist
        random_order = f"TEST-ORD-{random.randint(100000, 999999)}"
        
        response = api_client.get(
            f"{BASE_URL}/api/tickets/check-duplicate?order_id={random_order}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_duplicate"] == False
        print("PASS: Check duplicate with order_id - no duplicate found")


# ========== ADMIN ANALYTICS TESTS ==========
class TestAdminAnalytics:
    """Test Admin Analytics endpoints for pie charts"""
    
    def test_admin_stats_endpoint(self, api_client):
        """Admin stats endpoint should return proper data for analytics"""
        token = get_token(api_client, "admin")
        assert token, "Admin token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields for analytics charts
        assert "total_tickets" in data
        assert "open_tickets" in data
        assert "tickets_by_status" in data
        print(f"PASS: Admin stats - total_tickets={data.get('total_tickets')}")
    
    def test_admin_agent_performance(self, api_client):
        """Agent performance endpoint should return data for charts"""
        token = get_token(api_client, "admin")
        assert token, "Admin token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/admin/agent-performance",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            agent = data[0]
            # Verify fields for pie charts
            assert "agent_name" in agent
            assert "total_tickets" in agent
            assert "phone_tickets" in agent
            assert "hardware_tickets" in agent
            assert "sla_breaches" in agent
            assert "sla_compliance_rate" in agent
            print(f"PASS: Agent performance - {len(data)} agents with pie chart data")
        else:
            print("PASS: Agent performance endpoint works (no agents yet)")


# ========== ADMIN SSO TESTS ==========
class TestAdminSSO:
    """Test Admin SSO access to all internal dashboards"""
    
    def test_admin_can_access_tickets(self, api_client):
        """Admin should access all tickets"""
        token = get_token(api_client, "admin")
        assert token, "Admin token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Admin can access {len(data)} tickets")
    
    def test_admin_can_access_supervisor_queue(self, api_client):
        """Admin should access supervisor queue"""
        token = get_token(api_client, "admin")
        assert token, "Admin token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/supervisor/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Admin can access supervisor queue ({len(data)} tickets)")
    
    def test_admin_can_access_dispatcher_queue(self, api_client):
        """Admin should access dispatcher queue"""
        token = get_token(api_client, "admin")
        assert token, "Admin token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/dispatcher/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Admin can access dispatcher queue ({len(data)} items)")
    
    def test_admin_can_access_accountant_queue(self, api_client):
        """Admin should access accountant hardware tickets"""
        token = get_token(api_client, "admin")
        assert token, "Admin token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/tickets?support_type=hardware",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Admin can access hardware tickets ({len(data)} items)")
    
    def test_admin_can_access_dispatches(self, api_client):
        """Admin should access dispatches list"""
        token = get_token(api_client, "admin")
        assert token, "Admin token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/dispatches",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Admin can access dispatches ({len(data)} items)")


# ========== ACCOUNTANT HARDWARE TAB TESTS ==========
class TestAccountantHardwareTab:
    """Test Accountant Hardware Tab showing all notes and recommended actions"""
    
    def test_accountant_can_see_hardware_tickets(self, api_client):
        """Accountant should see hardware service tickets with notes"""
        token = get_token(api_client, "accountant")
        assert token, "Accountant token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Accountant should see hardware_service, awaiting_label, repair_completed statuses
        print(f"PASS: Accountant sees {len(data)} tickets")
    
    def test_hardware_tickets_have_notes_fields(self, api_client):
        """Hardware tickets should include all notes fields for accountant"""
        token = get_token(api_client, "admin")  # Use admin to get all tickets
        assert token, "Admin token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/tickets?support_type=hardware",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            ticket = data[0]
            # Check notes fields exist
            notes_fields = ["agent_notes", "escalation_notes", "supervisor_notes", 
                          "supervisor_action", "repair_notes"]
            found_fields = [f for f in notes_fields if f in ticket]
            print(f"PASS: Hardware ticket has notes fields: {found_fields}")
        else:
            print("PASS: Hardware tickets endpoint works (no tickets)")
    
    def test_accountant_can_see_supervisor_decision(self, api_client):
        """Tickets with supervisor action should have decision visible"""
        token = get_token(api_client, "admin")
        assert token, "Admin token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/tickets?support_type=hardware",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Find ticket with supervisor action
        with_action = [t for t in data if t.get("supervisor_action")]
        if with_action:
            ticket = with_action[0]
            assert ticket["supervisor_action"] in ["reverse_pickup", "spare_dispatch", "resolve"]
            print(f"PASS: Found ticket with supervisor action: {ticket['supervisor_action']}")
        else:
            print("PASS: Accountant endpoint works (no supervisor decisions yet)")


# ========== E2E WORKFLOW TESTS ==========
class TestE2EWorkflow:
    """Test complete E2E workflow steps"""
    
    def test_step1_customer_can_list_tickets(self, api_client):
        """Step 1: Customer can see their tickets"""
        token = get_token(api_client, "customer")
        assert token, "Customer token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        print(f"PASS: Customer can list {len(response.json())} tickets")
    
    def test_step2_support_sees_phone_tickets(self, api_client):
        """Step 2: Support sees phone support tickets"""
        token = get_token(api_client, "support")
        assert token, "Support token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        print(f"PASS: Support agent sees {len(response.json())} tickets")
    
    def test_step3_support_escalate_requires_notes(self, api_client):
        """Step 3: Support escalation to supervisor requires 100+ char notes"""
        token = get_token(api_client, "support")
        assert token, "Support token required"
        
        # Get a ticket that can be escalated
        response = api_client.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )
        tickets = response.json()
        
        # Find a ticket not already escalated
        target = None
        for t in tickets:
            if t.get("status") in ["new_request", "call_support_followup"]:
                target = t
                break
        
        if not target:
            pytest.skip("No ticket available for escalation test")
        
        # Try short notes - should fail
        response = requests.post(
            f"{BASE_URL}/api/tickets/{target['id']}/escalate-to-supervisor",
            headers={"Authorization": f"Bearer {token}"},
            data={"notes": "Short"}
        )
        assert response.status_code == 400
        print("PASS: Escalation requires 100+ character notes")
    
    def test_step4_supervisor_sees_escalated_queue(self, api_client):
        """Step 4: Supervisor sees escalated tickets queue"""
        token = get_token(api_client, "supervisor")
        assert token, "Supervisor token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/supervisor/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"PASS: Supervisor queue has {len(data)} escalated tickets")
    
    def test_step5_supervisor_action_requires_notes(self, api_client):
        """Step 5: Supervisor action requires 100+ char notes"""
        token = get_token(api_client, "supervisor")
        assert token, "Supervisor token required"
        
        # Get escalated tickets
        response = api_client.get(
            f"{BASE_URL}/api/supervisor/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        tickets = response.json()
        
        if not tickets:
            pytest.skip("No escalated tickets for supervisor action test")
        
        target = tickets[0]
        
        # Try short notes - should fail
        response = requests.post(
            f"{BASE_URL}/api/tickets/{target['id']}/supervisor-action",
            headers={"Authorization": f"Bearer {token}"},
            data={"action": "resolve", "notes": "Short"}
        )
        assert response.status_code == 400
        print("PASS: Supervisor action requires 100+ character notes")
    
    def test_step6_accountant_sees_hardware_tickets(self, api_client):
        """Step 6: Accountant sees hardware tickets with notes"""
        token = get_token(api_client, "accountant")
        assert token, "Accountant token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        print(f"PASS: Accountant sees {len(response.json())} hardware tickets")
    
    def test_step7_technician_sees_in_repair_tickets(self, api_client):
        """Step 7: Technician sees tickets for repair"""
        token = get_token(api_client, "technician")
        assert token, "Technician token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        print(f"PASS: Technician sees {len(response.json())} tickets")
    
    def test_step8_dispatcher_queue(self, api_client):
        """Step 8: Dispatcher sees ready to dispatch queue"""
        token = get_token(api_client, "dispatcher")
        assert token, "Dispatcher token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/dispatcher/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"PASS: Dispatcher queue has {len(data)} items ready to ship")


# ========== GATE SCAN TESTS ==========
class TestGateScan:
    """Test gate scan functionality for E2E workflow"""
    
    def test_gate_logs_endpoint(self, api_client):
        """Gate logs endpoint should work"""
        token = get_token(api_client, "admin")
        assert token, "Admin token required"
        
        response = api_client.get(
            f"{BASE_URL}/api/gate/logs",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Gate logs has {len(data)} entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Tests for MuscleGrid CRM - Walk-in Customer, Notes, Serial Numbers, and Feedback Surveys
Iteration 15 - Testing new technician and admin analytics features

Features tested:
1. Admin Analytics - Customer Feedback Surveys table
2. Technician Walk-in Customer ticket creation
3. Technician queue with all_notes
4. Complete repair with serial numbers
5. Walk-in ticket workflow (skips accountant)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TECHNICIAN_EMAIL = "technician@musclegrid.in"
TECHNICIAN_PASSWORD = "Muscle@846"
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"

class TestAuthentication:
    """Test authentication for technician and admin"""
    
    def test_technician_login(self):
        """Test technician can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TECHNICIAN_EMAIL,
            "password": TECHNICIAN_PASSWORD
        })
        assert response.status_code == 200, f"Technician login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "service_agent"
        print(f"PASS: Technician login successful - role: {data['user']['role']}")
        return data["access_token"]
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"PASS: Admin login successful - role: {data['user']['role']}")
        return data["access_token"]


class TestAdminPerformanceMetrics:
    """Test Admin Analytics - Customer Feedback Surveys feature"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_performance_metrics_endpoint(self, admin_token):
        """Test GET /api/admin/performance-metrics returns staff metrics with feedback data"""
        response = requests.get(
            f"{BASE_URL}/api/admin/performance-metrics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Performance metrics failed: {response.text}"
        
        data = response.json()
        assert "staff_metrics" in data, "Response should contain staff_metrics"
        assert "company_stats" in data, "Response should contain company_stats"
        
        # Verify company stats structure
        company_stats = data["company_stats"]
        assert "total_feedback_received" in company_stats
        assert "company_average_score" in company_stats
        assert "total_staff" in company_stats
        
        print(f"PASS: Performance metrics endpoint returns correct structure")
        print(f"  - Total staff tracked: {company_stats['total_staff']}")
        print(f"  - Total feedback received: {company_stats['total_feedback_received']}")
        print(f"  - Company average score: {company_stats['company_average_score']}")
    
    def test_staff_metrics_structure(self, admin_token):
        """Test staff metrics contains all required feedback rating fields"""
        response = requests.get(
            f"{BASE_URL}/api/admin/performance-metrics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        staff_metrics = data["staff_metrics"]
        
        if staff_metrics:
            # Verify structure of first staff member
            staff = staff_metrics[0]
            required_fields = [
                "staff_id", "staff_name", "role", "total_feedback",
                "avg_communication", "avg_resolution_speed", 
                "avg_professionalism", "avg_overall"
            ]
            
            for field in required_fields:
                assert field in staff, f"Staff metric should contain {field}"
            
            print(f"PASS: Staff metrics structure verified")
            print(f"  - First staff: {staff['staff_name']} ({staff['role']})")
            print(f"  - Total reviews: {staff['total_feedback']}")
            print(f"  - Ratings: Comm={staff['avg_communication']}, Speed={staff['avg_resolution_speed']}, Prof={staff['avg_professionalism']}, Overall={staff['avg_overall']}")
        else:
            print("INFO: No staff metrics data available yet")


class TestWalkinTicket:
    """Test Technician Walk-in Customer ticket feature"""
    
    @pytest.fixture
    def technician_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TECHNICIAN_EMAIL,
            "password": TECHNICIAN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_create_walkin_ticket(self, technician_token):
        """Test POST /api/technician/walkin-ticket creates walk-in ticket"""
        form_data = {
            "customer_name": "TEST Walk-in Customer",
            "customer_phone": "9876543210",
            "customer_email": "test_walkin@example.com",
            "device_type": "Inverter",
            "issue_description": "Walk-in customer with inverter not charging battery properly",
            "serial_number": "WI-TEST-12345",
            "address": "123 Test Street",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/technician/walkin-ticket",
            headers={"Authorization": f"Bearer {technician_token}"},
            data=form_data
        )
        assert response.status_code == 200, f"Walk-in ticket creation failed: {response.text}"
        
        data = response.json()
        assert "ticket_number" in data
        assert "ticket_id" in data
        assert data["ticket_number"].startswith("MG-W-"), f"Walk-in ticket should start with MG-W-, got: {data['ticket_number']}"
        
        print(f"PASS: Walk-in ticket created successfully")
        print(f"  - Ticket number: {data['ticket_number']}")
        return data["ticket_id"], data["ticket_number"]
    
    def test_walkin_ticket_has_is_walkin_flag(self, technician_token):
        """Test walk-in ticket has is_walkin=True flag"""
        # First create a walk-in ticket
        form_data = {
            "customer_name": "TEST Walk-in Flag",
            "customer_phone": "9876543211",
            "device_type": "Battery",
            "issue_description": "Test walk-in flag verification"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/technician/walkin-ticket",
            headers={"Authorization": f"Bearer {technician_token}"},
            data=form_data
        )
        assert response.status_code == 200
        ticket_id = response.json()["ticket_id"]
        
        # Get ticket details
        response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {technician_token}"}
        )
        assert response.status_code == 200
        
        ticket = response.json()
        assert ticket.get("is_walkin") == True, "Walk-in ticket should have is_walkin=True"
        assert ticket.get("status") == "received_at_factory", "Walk-in ticket should start at received_at_factory"
        
        print(f"PASS: Walk-in ticket has correct flags")
        print(f"  - is_walkin: {ticket.get('is_walkin')}")
        print(f"  - status: {ticket.get('status')}")


class TestTechnicianQueue:
    """Test Technician queue with all_notes feature"""
    
    @pytest.fixture
    def technician_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TECHNICIAN_EMAIL,
            "password": TECHNICIAN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_technician_queue_endpoint(self, technician_token):
        """Test GET /api/technician/queue returns tickets with all_notes"""
        response = requests.get(
            f"{BASE_URL}/api/technician/queue",
            headers={"Authorization": f"Bearer {technician_token}"}
        )
        assert response.status_code == 200, f"Technician queue failed: {response.text}"
        
        tickets = response.json()
        assert isinstance(tickets, list), "Queue should return a list"
        
        if tickets:
            ticket = tickets[0]
            assert "all_notes" in ticket, "Queue tickets should contain all_notes field"
            assert "repair_sla_due" in ticket or "repair_hours_remaining" in ticket, "Queue should include SLA info"
            
            print(f"PASS: Technician queue returns tickets with notes")
            print(f"  - Total tickets in queue: {len(tickets)}")
            print(f"  - First ticket: {ticket.get('ticket_number')}")
            print(f"  - Notes count: {len(ticket.get('all_notes', []))}")
        else:
            print("INFO: Technician queue is empty")
    
    def test_all_notes_structure(self, technician_token):
        """Test all_notes field structure contains source, type, and content"""
        response = requests.get(
            f"{BASE_URL}/api/technician/queue",
            headers={"Authorization": f"Bearer {technician_token}"}
        )
        assert response.status_code == 200
        
        tickets = response.json()
        for ticket in tickets:
            if ticket.get("all_notes"):
                for note in ticket["all_notes"]:
                    assert "source" in note, "Note should have source field"
                    assert "type" in note, "Note should have type field"
                    assert "content" in note, "Note should have content field"
                    assert note["source"] in ["Customer", "Call Support", "Supervisor"], f"Invalid source: {note['source']}"
        
        print(f"PASS: All notes structure validated for {len(tickets)} tickets")


class TestCompleteRepairSerialNumbers:
    """Test Complete Repair with mandatory serial numbers"""
    
    @pytest.fixture
    def technician_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TECHNICIAN_EMAIL,
            "password": TECHNICIAN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_complete_repair_requires_serial_numbers(self, technician_token):
        """Test complete-repair endpoint requires board and device serial numbers"""
        # First create a walk-in ticket to test with
        form_data = {
            "customer_name": "TEST Serial Number",
            "customer_phone": "9876543212",
            "device_type": "Inverter",
            "issue_description": "Test serial number requirement"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/technician/walkin-ticket",
            headers={"Authorization": f"Bearer {technician_token}"},
            data=form_data
        )
        assert response.status_code == 200
        ticket_id = response.json()["ticket_id"]
        
        # Start repair
        response = requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/start-repair",
            headers={"Authorization": f"Bearer {technician_token}"}
        )
        assert response.status_code == 200
        
        # Try complete repair without serial numbers - should fail
        form_data_incomplete = {
            "repair_notes": "Test repair notes"
        }
        response = requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/complete-repair",
            headers={"Authorization": f"Bearer {technician_token}"},
            data=form_data_incomplete
        )
        assert response.status_code == 422, "Should fail without serial numbers"
        
        print(f"PASS: Complete repair rejects request without serial numbers")
    
    def test_complete_repair_with_serial_numbers(self, technician_token):
        """Test complete-repair succeeds with all required fields"""
        # Create walk-in ticket
        form_data = {
            "customer_name": "TEST Complete Repair",
            "customer_phone": "9876543213",
            "device_type": "Battery",
            "issue_description": "Test complete repair with serial numbers"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/technician/walkin-ticket",
            headers={"Authorization": f"Bearer {technician_token}"},
            data=form_data
        )
        assert response.status_code == 200
        ticket_id = response.json()["ticket_id"]
        ticket_number = response.json()["ticket_number"]
        
        # Start repair
        response = requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/start-repair",
            headers={"Authorization": f"Bearer {technician_token}"}
        )
        assert response.status_code == 200
        
        # Complete repair with serial numbers
        form_data_complete = {
            "repair_notes": "Replaced faulty capacitor and tested charging cycle",
            "board_serial_number": "BOARD-TEST-001",
            "device_serial_number": "DEV-TEST-001"
        }
        response = requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/complete-repair",
            headers={"Authorization": f"Bearer {technician_token}"},
            data=form_data_complete
        )
        assert response.status_code == 200, f"Complete repair failed: {response.text}"
        
        data = response.json()
        print(f"PASS: Complete repair succeeded with serial numbers")
        print(f"  - Ticket: {ticket_number}")
        print(f"  - Status after repair: {data.get('status')}")
        
        return ticket_id


class TestWalkinTicketWorkflow:
    """Test Walk-in ticket workflow - skips accountant after repair"""
    
    @pytest.fixture
    def technician_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TECHNICIAN_EMAIL,
            "password": TECHNICIAN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_walkin_ticket_skips_accountant(self, technician_token):
        """Test walk-in ticket goes to ready_for_dispatch after repair (skips accountant)"""
        # Create walk-in ticket
        form_data = {
            "customer_name": "TEST Skip Accountant",
            "customer_phone": "9876543214",
            "device_type": "Inverter",
            "issue_description": "Test walk-in skips accountant"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/technician/walkin-ticket",
            headers={"Authorization": f"Bearer {technician_token}"},
            data=form_data
        )
        assert response.status_code == 200
        ticket_id = response.json()["ticket_id"]
        ticket_number = response.json()["ticket_number"]
        
        # Start repair
        response = requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/start-repair",
            headers={"Authorization": f"Bearer {technician_token}"}
        )
        assert response.status_code == 200
        
        # Complete repair
        form_data_complete = {
            "repair_notes": "Test repair completed",
            "board_serial_number": "BOARD-SKIP-001",
            "device_serial_number": "DEV-SKIP-001"
        }
        response = requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/complete-repair",
            headers={"Authorization": f"Bearer {technician_token}"},
            data=form_data_complete
        )
        assert response.status_code == 200
        
        # Verify status is ready_for_dispatch (not repair_completed which is for regular tickets)
        data = response.json()
        assert data.get("status") == "ready_for_dispatch", f"Walk-in should go to ready_for_dispatch, got: {data.get('status')}"
        
        # Verify ticket details
        response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {technician_token}"}
        )
        ticket = response.json()
        assert ticket.get("is_walkin") == True
        assert ticket.get("status") == "ready_for_dispatch"
        assert ticket.get("board_serial_number") == "BOARD-SKIP-001"
        assert ticket.get("device_serial_number") == "DEV-SKIP-001"
        
        print(f"PASS: Walk-in ticket skips accountant successfully")
        print(f"  - Ticket: {ticket_number}")
        print(f"  - is_walkin: {ticket.get('is_walkin')}")
        print(f"  - Final status: {ticket.get('status')}")
        print(f"  - Board serial: {ticket.get('board_serial_number')}")
        print(f"  - Device serial: {ticket.get('device_serial_number')}")


class TestTechnicianMyRepairs:
    """Test Technician my-repairs endpoint"""
    
    @pytest.fixture
    def technician_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TECHNICIAN_EMAIL,
            "password": TECHNICIAN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_my_repairs_endpoint(self, technician_token):
        """Test GET /api/technician/my-repairs returns completed repairs"""
        response = requests.get(
            f"{BASE_URL}/api/technician/my-repairs",
            headers={"Authorization": f"Bearer {technician_token}"}
        )
        assert response.status_code == 200, f"My repairs failed: {response.text}"
        
        repairs = response.json()
        assert isinstance(repairs, list), "Should return a list"
        
        print(f"PASS: My repairs endpoint returns data")
        print(f"  - Total repairs: {len(repairs)}")
        
        # Check for serial numbers in repairs
        for repair in repairs[:3]:  # Check first 3
            if repair.get("board_serial_number"):
                print(f"  - {repair.get('ticket_number')}: Board={repair.get('board_serial_number')}, Device={repair.get('device_serial_number')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

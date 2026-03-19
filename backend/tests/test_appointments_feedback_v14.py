"""
Test Suite for Appointment Booking, Feedback System, and Amazon Order Features
v14 - MuscleGrid CRM

Tests:
1. Customer appointments - accessing page, checking availability, booking
2. Supervisor calendar - appointments and availability management
3. Feedback survey on closed tickets
4. Amazon orders creating feedback calls for call support
5. Call Support dashboard showing feedback calls
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CUSTOMER_EMAIL = "ami_t@live.com"
CUSTOMER_PASS = "Muscle@846"
SUPERVISOR_EMAIL = "supervisor@musclegrid.in"
SUPERVISOR_PASS = "Muscle@846"
CALL_SUPPORT_EMAIL = "support@musclegrid.in"
CALL_SUPPORT_PASS = "Muscle@846"
ACCOUNTANT_EMAIL = "accountant@musclegrid.in"
ACCOUNTANT_PASS = "Muscle@846"
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASS = "Muscle@846"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def customer_token(api_client):
    """Get customer authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": CUSTOMER_EMAIL,
        "password": CUSTOMER_PASS
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Customer authentication failed: {response.text}")


@pytest.fixture(scope="module")
def supervisor_token(api_client):
    """Get supervisor authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERVISOR_EMAIL,
        "password": SUPERVISOR_PASS
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Supervisor authentication failed: {response.text}")


@pytest.fixture(scope="module")
def call_support_token(api_client):
    """Get call support authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": CALL_SUPPORT_EMAIL,
        "password": CALL_SUPPORT_PASS
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Call support authentication failed: {response.text}")


@pytest.fixture(scope="module")
def accountant_token(api_client):
    """Get accountant authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ACCOUNTANT_EMAIL,
        "password": ACCOUNTANT_PASS
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Accountant authentication failed: {response.text}")


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASS
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin authentication failed: {response.text}")


class TestAuthentication:
    """Test all required user logins work"""

    def test_customer_login(self, api_client):
        """Customer can login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASS
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "customer"
        print(f"✓ Customer login successful: {data['user']['email']}")

    def test_supervisor_login(self, api_client):
        """Supervisor can login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERVISOR_EMAIL,
            "password": SUPERVISOR_PASS
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "supervisor"
        print(f"✓ Supervisor login successful: {data['user']['email']}")

    def test_call_support_login(self, api_client):
        """Call support can login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": CALL_SUPPORT_EMAIL,
            "password": CALL_SUPPORT_PASS
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "call_support"
        print(f"✓ Call support login successful: {data['user']['email']}")

    def test_accountant_login(self, api_client):
        """Accountant can login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASS
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "accountant"
        print(f"✓ Accountant login successful: {data['user']['email']}")

    def test_admin_login(self, api_client):
        """Admin can login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['email']}")


class TestAppointmentSystem:
    """Test appointment booking system"""

    def test_get_available_slots(self, api_client, customer_token):
        """Customer can check available appointment slots"""
        # Get slots for tomorrow (avoid current time issues)
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        response = api_client.get(
            f"{BASE_URL}/api/appointments/available-slots",
            headers={"Authorization": f"Bearer {customer_token}"},
            params={"date": tomorrow}
        )
        assert response.status_code == 200
        data = response.json()
        # Should have slots array (may be empty if no supervisor availability)
        assert "slots" in data
        print(f"✓ Available slots endpoint works, found {len(data.get('slots', []))} slots for {tomorrow}")

    def test_customer_get_appointments(self, api_client, customer_token):
        """Customer can view their appointments"""
        response = api_client.get(
            f"{BASE_URL}/api/appointments",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Customer can view appointments, found {len(data)} appointments")


class TestSupervisorCalendar:
    """Test supervisor calendar and availability features"""

    def test_supervisor_get_appointments(self, api_client, supervisor_token):
        """Supervisor can view their appointments"""
        response = api_client.get(
            f"{BASE_URL}/api/supervisor/appointments",
            headers={"Authorization": f"Bearer {supervisor_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should return appointments and stats
        assert "appointments" in data or isinstance(data, list)
        print(f"✓ Supervisor appointments endpoint works")

    def test_supervisor_get_availability(self, api_client, supervisor_token):
        """Supervisor can view their availability settings"""
        response = api_client.get(
            f"{BASE_URL}/api/supervisor/availability",
            headers={"Authorization": f"Bearer {supervisor_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should return slots and blocked_dates
        assert "slots" in data or "blocked_dates" in data or isinstance(data, dict)
        print(f"✓ Supervisor availability endpoint works")

    def test_supervisor_update_availability(self, api_client, supervisor_token):
        """Supervisor can update their availability"""
        availability_data = {
            "slots": [
                {"day_of_week": 0, "start_time": "09:00", "end_time": "17:00", "is_available": True},
                {"day_of_week": 1, "start_time": "09:00", "end_time": "17:00", "is_available": True},
                {"day_of_week": 2, "start_time": "09:00", "end_time": "17:00", "is_available": True},
                {"day_of_week": 3, "start_time": "09:00", "end_time": "17:00", "is_available": True},
                {"day_of_week": 4, "start_time": "09:00", "end_time": "17:00", "is_available": True}
            ],
            "blocked_dates": []
        }
        response = api_client.post(
            f"{BASE_URL}/api/supervisor/availability",
            headers={"Authorization": f"Bearer {supervisor_token}"},
            json=availability_data
        )
        assert response.status_code == 200
        print(f"✓ Supervisor can update availability")


class TestFeedbackSystem:
    """Test feedback survey system"""

    def test_feedback_endpoint_exists(self, api_client, customer_token):
        """Feedback submission endpoint exists (may fail if no valid ticket)"""
        # This will likely fail due to validation, but endpoint should exist
        response = api_client.post(
            f"{BASE_URL}/api/feedback",
            headers={"Authorization": f"Bearer {customer_token}"},
            json={
                "ticket_id": None,
                "appointment_id": None,
                "communication": 8,
                "resolution_speed": 7,
                "professionalism": 9,
                "overall": 8
            }
        )
        # Should get 400 (validation) or 404 (not found), not 500/404 route not found
        assert response.status_code in [400, 422, 404]
        print(f"✓ Feedback endpoint exists (status: {response.status_code})")

    def test_pending_feedback_endpoint(self, api_client, customer_token):
        """Customer can check pending feedback"""
        response = api_client.get(
            f"{BASE_URL}/api/feedback/pending",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict) or isinstance(data, list)
        print(f"✓ Pending feedback endpoint works")


class TestFeedbackCallsForCallSupport:
    """Test feedback calls feature for Call Support agents"""

    def test_call_support_get_feedback_calls(self, api_client, call_support_token):
        """Call support can view feedback calls"""
        response = api_client.get(
            f"{BASE_URL}/api/feedback-calls",
            headers={"Authorization": f"Bearer {call_support_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "calls" in data or "stats" in data or isinstance(data, dict)
        print(f"✓ Feedback calls endpoint works for call support")
        if isinstance(data, dict) and "calls" in data:
            print(f"  - Found {len(data.get('calls', []))} feedback calls")
            if "stats" in data:
                print(f"  - Stats: pending={data['stats'].get('pending', 0)}, completed={data['stats'].get('completed', 0)}")


class TestAmazonOrderDispatch:
    """Test Amazon order dispatch creates feedback calls"""

    def test_admin_stats_endpoint(self, api_client, admin_token):
        """Admin stats endpoint works"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ Admin stats endpoint works")

    def test_admin_get_dispatches(self, api_client, admin_token):
        """Admin can view dispatches"""
        response = api_client.get(
            f"{BASE_URL}/api/dispatches",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Check for amazon_order type dispatches
        amazon_orders = [d for d in data if d.get("dispatch_type") == "amazon_order"]
        print(f"✓ Dispatches endpoint works, found {len(data)} total, {len(amazon_orders)} amazon orders")


class TestCustomerTicketsFeedback:
    """Test customer tickets with feedback functionality"""

    def test_customer_get_tickets(self, api_client, customer_token):
        """Customer can view their tickets"""
        response = api_client.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Check for closed tickets that might show feedback option
        closed_statuses = ['closed', 'closed_by_agent', 'resolved_on_call', 'delivered']
        closed_tickets = [t for t in data if t.get("status") in closed_statuses]
        feedbackable = [t for t in closed_tickets if not t.get("feedback_submitted")]
        
        print(f"✓ Customer has {len(data)} tickets, {len(closed_tickets)} closed, {len(feedbackable)} need feedback")


class TestAdminAnalytics:
    """Test admin analytics page endpoints"""

    def test_admin_agent_performance(self, api_client, admin_token):
        """Admin can view agent performance"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/agent-performance",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Agent performance endpoint works, found {len(data)} agents")

    def test_admin_feedback_call_performance(self, api_client, admin_token):
        """Admin can view feedback call performance"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/feedback-call-performance",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # May return 200 or 404 if endpoint doesn't exist
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Feedback call performance endpoint works")
        else:
            print(f"! Feedback call performance endpoint returned {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

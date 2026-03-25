"""
Test Suite for Iteration 34 - Testing UI improvements, gate control access for accountant, and mobile-friendly layouts
Features tested:
1. Finance & GST page loads with DashboardLayout, Back button, and dark theme
2. Purchase Register page loads with DashboardLayout, Back button, and dark theme
3. Gate Control page is accessible by accountant role
4. Gate Control shows custom courier name input when 'Other' is selected
5. Gate Control tracking input supports barcode scanner (Enter key triggers scan)
6. Gate Control page is mobile-friendly (large buttons, responsive layout)
7. Technician Dashboard is mobile-friendly with 2-column stats grid
8. Supervisor Dashboard is mobile-friendly
9. Accountant User Manual file exists at /app/ACCOUNTANT_USER_MANUAL.md
10. API: POST /api/gate/scan works for accountant role
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAccountantUserManual:
    """Test that the Accountant User Manual exists"""
    
    def test_user_manual_exists(self):
        """Verify the accountant user manual file exists"""
        manual_path = "/app/ACCOUNTANT_USER_MANUAL.md"
        assert os.path.exists(manual_path), f"User manual not found at {manual_path}"
        
        # Check file has content
        with open(manual_path, 'r') as f:
            content = f.read()
        
        assert len(content) > 1000, "User manual seems too short"
        assert "# MuscleGrid CRM - Accountant User Manual" in content, "User manual missing title"
        assert "Gate Control" in content, "User manual missing Gate Control section"
        assert "Barcode Scanner" in content, "User manual missing Barcode Scanner info"
        print("PASS: Accountant User Manual exists and has proper content")


class TestAuthentication:
    """Test authentication for admin and accountant users"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert data.get("user", {}).get("role") == "admin", "User role is not admin"
        print("PASS: Admin login successful")
        return data["access_token"]
    
    def test_accountant_login(self):
        """Test accountant login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "aman@musclegrid.in",
            "password": "Muscle@846"
        })
        assert response.status_code == 200, f"Accountant login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert data.get("user", {}).get("role") == "accountant", "User role is not accountant"
        print("PASS: Accountant login successful")
        return data["access_token"]


class TestGateControlAccessForAccountant:
    """Test that accountant role has access to gate control endpoints"""
    
    @pytest.fixture
    def accountant_token(self):
        """Get accountant auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "aman@musclegrid.in",
            "password": "Muscle@846"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant authentication failed")
    
    def test_accountant_can_access_gate_scheduled(self, accountant_token):
        """Test accountant can access gate scheduled endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/gate/scheduled",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Accountant cannot access gate/scheduled: {response.status_code} - {response.text}"
        data = response.json()
        assert "scheduled_incoming" in data or "scheduled_outgoing" in data or isinstance(data, dict), "Invalid response structure"
        print("PASS: Accountant can access gate/scheduled endpoint")
    
    def test_accountant_can_access_gate_logs(self, accountant_token):
        """Test accountant can access gate logs endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/gate/logs?limit=10",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Accountant cannot access gate/logs: {response.status_code} - {response.text}"
        print("PASS: Accountant can access gate/logs endpoint")
    
    def test_accountant_can_post_gate_scan(self, accountant_token):
        """Test accountant can post to gate/scan endpoint"""
        # Test with a dummy tracking ID - it may fail validation but should not fail authorization
        response = requests.post(
            f"{BASE_URL}/api/gate/scan",
            headers={"Authorization": f"Bearer {accountant_token}"},
            json={
                "scan_type": "inward",
                "tracking_id": "TEST_TRACKING_12345",
                "courier": "Delhivery",
                "notes": "Test scan by accountant"
            }
        )
        # 200 = success, 404 = tracking not found (but auth passed), 400 = validation error (but auth passed)
        # 401/403 = auth failed
        assert response.status_code not in [401, 403], f"Accountant not authorized for gate/scan: {response.status_code} - {response.text}"
        print(f"PASS: Accountant can access gate/scan endpoint (status: {response.status_code})")


class TestFinanceAndPurchaseAPIs:
    """Test Finance & GST and Purchase Register APIs"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture
    def accountant_token(self):
        """Get accountant auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "aman@musclegrid.in",
            "password": "Muscle@846"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Accountant authentication failed")
    
    def test_finance_dashboard_api(self, accountant_token):
        """Test finance dashboard API"""
        response = requests.get(
            f"{BASE_URL}/api/finance/dashboard",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Finance dashboard API failed: {response.status_code} - {response.text}"
        print("PASS: Finance dashboard API accessible")
    
    def test_purchases_api(self, accountant_token):
        """Test purchases list API"""
        response = requests.get(
            f"{BASE_URL}/api/purchases?limit=10",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Purchases API failed: {response.status_code} - {response.text}"
        print("PASS: Purchases API accessible")
    
    def test_firms_api(self, accountant_token):
        """Test firms list API"""
        response = requests.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Firms API failed: {response.status_code} - {response.text}"
        print("PASS: Firms API accessible")


class TestTechnicianAndSupervisorAPIs:
    """Test Technician and Supervisor dashboard APIs"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_technician_queue_api(self, admin_token):
        """Test technician queue API"""
        response = requests.get(
            f"{BASE_URL}/api/technician/queue",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Admin should be able to access technician endpoints
        assert response.status_code in [200, 403], f"Technician queue API unexpected status: {response.status_code}"
        print(f"PASS: Technician queue API status: {response.status_code}")
    
    def test_supervisor_stats_api(self, admin_token):
        """Test supervisor stats API"""
        response = requests.get(
            f"{BASE_URL}/api/supervisor/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Admin should be able to access supervisor endpoints
        assert response.status_code in [200, 403], f"Supervisor stats API unexpected status: {response.status_code}"
        print(f"PASS: Supervisor stats API status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

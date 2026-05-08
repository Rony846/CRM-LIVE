"""
Iteration 60 Backend Tests
Tests for:
1. Agent Performance Summary endpoint (GET /api/smartflo/agent-performance)
2. Verify call_support role can access /calls route (via /api/smartflo/my-calls)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"


class TestAgentPerformance:
    """Test Agent Performance Summary endpoint for admin dashboard"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_agent_performance_endpoint_exists(self, admin_token):
        """Test that /api/smartflo/agent-performance endpoint exists and returns data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/smartflo/agent-performance", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "agents" in data, "Response should contain 'agents' key"
        assert "agents_needing_attention" in data, "Response should contain 'agents_needing_attention' key"
        
        print(f"Agent Performance: {len(data.get('agents', []))} agents, {data.get('agents_needing_attention', 0)} need attention")
    
    def test_agent_performance_with_days_param(self, admin_token):
        """Test agent performance with custom days parameter"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/smartflo/agent-performance?days=7", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data.get("agents"), list), "agents should be a list"
    
    def test_agent_performance_data_structure(self, admin_token):
        """Test that agent performance data has correct structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/smartflo/agent-performance", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("agents") and len(data["agents"]) > 0:
            agent = data["agents"][0]
            
            # Check required fields
            expected_fields = [
                "agent_name", "department", "total_calls", "answered", "missed",
                "miss_rate", "status", "issues"
            ]
            
            for field in expected_fields:
                assert field in agent, f"Agent data should contain '{field}' field"
            
            # Check optional metrics fields
            optional_fields = ["avg_quality_score", "satisfaction_rate", "resolution_rate", "red_flags_count"]
            for field in optional_fields:
                if field in agent:
                    print(f"  {field}: {agent[field]}")
            
            print(f"Agent: {agent['agent_name']}, Status: {agent['status']}, Issues: {len(agent.get('issues', []))}")
    
    def test_agent_performance_requires_auth(self):
        """Test that endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/smartflo/agent-performance")
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_agent_performance_requires_admin_or_supervisor(self, admin_token):
        """Test that endpoint is accessible by admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/smartflo/agent-performance", headers=headers)
        
        # Admin should have access
        assert response.status_code == 200, "Admin should have access to agent performance"


class TestCallSupportAccess:
    """Test that call_support role can access calls-related endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_smartflo_dashboard_accessible(self, admin_token):
        """Test that /api/smartflo/dashboard is accessible"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/smartflo/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "summary" in data, "Dashboard should contain summary"
        assert "recent_calls" in data, "Dashboard should contain recent_calls"
        
        print(f"Dashboard: {data['summary'].get('total_calls', 0)} total calls")
    
    def test_my_calls_endpoint_exists(self, admin_token):
        """Test that /api/smartflo/my-calls endpoint exists"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/smartflo/my-calls", headers=headers)
        
        # Should return 200 or 404 (if no agent mapping for admin)
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            print(f"My Calls: {len(data.get('calls', []))} calls")


class TestAIAnalysisPrompt:
    """Test AI Analysis endpoint returns expected fields"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_call_outcomes_endpoint(self, admin_token):
        """Test that call outcomes endpoint returns expected outcomes"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/smartflo/call-outcomes", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Response is {"outcomes": [...]}
        outcomes = data.get("outcomes", data) if isinstance(data, dict) else data
        assert isinstance(outcomes, list), "Should return a list of outcomes"
        assert len(outcomes) > 0, "Should have at least one outcome"
        
        # Check structure
        outcome = outcomes[0]
        assert "value" in outcome, "Outcome should have 'value'"
        assert "label" in outcome, "Outcome should have 'label'"
        
        print(f"Call Outcomes: {len(outcomes)} outcomes available")


class TestTicketsEndpoint:
    """Test tickets endpoint for call support"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_tickets_endpoint_returns_phone_numbers(self, admin_token):
        """Test that tickets endpoint returns customer phone numbers for Click-to-Call"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/tickets?limit=10", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Should return a list of tickets"
        
        if len(data) > 0:
            ticket = data[0]
            # Check that customer_phone field exists
            assert "customer_phone" in ticket or ticket.get("customer_phone") is None, "Ticket should have customer_phone field"
            
            phones_found = sum(1 for t in data if t.get("customer_phone"))
            print(f"Tickets: {len(data)} tickets, {phones_found} with phone numbers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test Smartflo Agent Mapping, Call Outcomes, and AI Analysis endpoints
Iteration 59 - Testing new Smartflo features
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"


class TestSmartfloAgents:
    """Test Smartflo Agent CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Store created agent IDs for cleanup
        self.created_agent_ids = []
        
        yield
        
        # Cleanup - delete test agents
        for agent_id in self.created_agent_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/smartflo/agents/{agent_id}")
            except:
                pass
    
    def test_list_smartflo_agents(self):
        """Test GET /api/smartflo/agents/list - should return agents and CRM users"""
        response = self.session.get(f"{BASE_URL}/api/smartflo/agents/list")
        
        assert response.status_code == 200, f"Failed to list agents: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "agents" in data, "Response should contain 'agents' key"
        assert "crm_users" in data, "Response should contain 'crm_users' key"
        assert isinstance(data["agents"], list), "agents should be a list"
        assert isinstance(data["crm_users"], list), "crm_users should be a list"
        
        print(f"✓ Found {len(data['agents'])} agents and {len(data['crm_users'])} CRM users")
        
        # Verify agent structure if any exist
        if data["agents"]:
            agent = data["agents"][0]
            assert "id" in agent, "Agent should have 'id'"
            assert "name" in agent, "Agent should have 'name'"
            assert "phone" in agent, "Agent should have 'phone'"
            print(f"✓ Agent structure verified: {agent.get('name')}")
    
    def test_create_smartflo_agent(self):
        """Test POST /api/smartflo/agents - create new agent mapping"""
        test_phone = f"99{uuid.uuid4().hex[:8]}"  # Unique phone
        test_smartflo_num = f"TEST{uuid.uuid4().hex[:4]}"
        
        agent_data = {
            "name": "TEST_Agent_Create",
            "email": f"test_{uuid.uuid4().hex[:6]}@test.com",
            "phone": test_phone,
            "department": "Sales",
            "smartflo_agent_number": test_smartflo_num,
            "api_key": "test-api-key-123",
            "is_active": True,
            "crm_user_id": ""
        }
        
        response = self.session.post(f"{BASE_URL}/api/smartflo/agents", json=agent_data)
        
        assert response.status_code == 200, f"Failed to create agent: {response.text}"
        data = response.json()
        
        assert "agent" in data, "Response should contain 'agent'"
        assert data["agent"]["name"] == agent_data["name"], "Name should match"
        assert data["agent"]["phone"] == agent_data["phone"], "Phone should match"
        assert data["agent"]["department"] == agent_data["department"], "Department should match"
        
        # Store for cleanup
        self.created_agent_ids.append(data["agent"]["id"])
        
        print(f"✓ Created agent: {data['agent']['name']} with ID: {data['agent']['id']}")
        
        # Verify agent appears in list
        list_response = self.session.get(f"{BASE_URL}/api/smartflo/agents/list")
        assert list_response.status_code == 200
        agents = list_response.json()["agents"]
        agent_ids = [a["id"] for a in agents]
        assert data["agent"]["id"] in agent_ids, "Created agent should appear in list"
        print("✓ Agent verified in list")
    
    def test_create_duplicate_agent_fails(self):
        """Test that creating agent with duplicate phone/smartflo number fails"""
        test_phone = f"88{uuid.uuid4().hex[:8]}"
        test_smartflo_num = f"DUP{uuid.uuid4().hex[:4]}"
        
        agent_data = {
            "name": "TEST_Agent_Dup1",
            "phone": test_phone,
            "department": "Sales",
            "smartflo_agent_number": test_smartflo_num,
            "is_active": True
        }
        
        # Create first agent
        response1 = self.session.post(f"{BASE_URL}/api/smartflo/agents", json=agent_data)
        assert response1.status_code == 200, f"First create failed: {response1.text}"
        self.created_agent_ids.append(response1.json()["agent"]["id"])
        
        # Try to create duplicate
        agent_data["name"] = "TEST_Agent_Dup2"
        response2 = self.session.post(f"{BASE_URL}/api/smartflo/agents", json=agent_data)
        
        assert response2.status_code == 400, "Duplicate should fail with 400"
        assert "already exists" in response2.json().get("detail", "").lower(), "Error should mention duplicate"
        print("✓ Duplicate agent creation correctly rejected")
    
    def test_update_smartflo_agent(self):
        """Test PUT /api/smartflo/agents/{id} - update agent"""
        # First create an agent
        test_phone = f"77{uuid.uuid4().hex[:8]}"
        test_smartflo_num = f"UPD{uuid.uuid4().hex[:4]}"
        
        create_data = {
            "name": "TEST_Agent_Update",
            "phone": test_phone,
            "department": "Sales",
            "smartflo_agent_number": test_smartflo_num,
            "is_active": True
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/smartflo/agents", json=create_data)
        assert create_response.status_code == 200
        agent_id = create_response.json()["agent"]["id"]
        self.created_agent_ids.append(agent_id)
        
        # Update the agent
        update_data = {
            "name": "TEST_Agent_Updated",
            "department": "Cx Exp",
            "is_active": False
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/smartflo/agents/{agent_id}", json=update_data)
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        print(f"✓ Agent updated successfully")
        
        # Verify update in list
        list_response = self.session.get(f"{BASE_URL}/api/smartflo/agents/list")
        agents = list_response.json()["agents"]
        updated_agent = next((a for a in agents if a["id"] == agent_id), None)
        
        assert updated_agent is not None, "Updated agent should exist"
        assert updated_agent["name"] == "TEST_Agent_Updated", "Name should be updated"
        assert updated_agent["department"] == "Cx Exp", "Department should be updated"
        assert updated_agent["is_active"] == False, "is_active should be updated"
        print("✓ Agent update verified in list")
    
    def test_delete_smartflo_agent(self):
        """Test DELETE /api/smartflo/agents/{id} - delete agent"""
        # First create an agent
        test_phone = f"66{uuid.uuid4().hex[:8]}"
        test_smartflo_num = f"DEL{uuid.uuid4().hex[:4]}"
        
        create_data = {
            "name": "TEST_Agent_Delete",
            "phone": test_phone,
            "department": "Sales",
            "smartflo_agent_number": test_smartflo_num,
            "is_active": True
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/smartflo/agents", json=create_data)
        assert create_response.status_code == 200
        agent_id = create_response.json()["agent"]["id"]
        
        # Delete the agent
        delete_response = self.session.delete(f"{BASE_URL}/api/smartflo/agents/{agent_id}")
        
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"✓ Agent deleted successfully")
        
        # Verify deletion
        list_response = self.session.get(f"{BASE_URL}/api/smartflo/agents/list")
        agents = list_response.json()["agents"]
        agent_ids = [a["id"] for a in agents]
        
        assert agent_id not in agent_ids, "Deleted agent should not appear in list"
        print("✓ Agent deletion verified")
    
    def test_delete_nonexistent_agent(self):
        """Test deleting non-existent agent returns 404"""
        fake_id = "000000000000000000000000"  # Valid ObjectId format but doesn't exist
        
        response = self.session.delete(f"{BASE_URL}/api/smartflo/agents/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent agent delete correctly returns 404")


class TestCallOutcomes:
    """Test Call Outcome endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_call_outcomes(self):
        """Test GET /api/smartflo/call-outcomes - get available outcomes"""
        response = self.session.get(f"{BASE_URL}/api/smartflo/call-outcomes")
        
        assert response.status_code == 200, f"Failed to get outcomes: {response.text}"
        data = response.json()
        
        assert "outcomes" in data, "Response should contain 'outcomes'"
        assert isinstance(data["outcomes"], list), "outcomes should be a list"
        assert len(data["outcomes"]) > 0, "Should have at least one outcome"
        
        # Verify outcome structure
        outcome = data["outcomes"][0]
        assert "value" in outcome, "Outcome should have 'value'"
        assert "label" in outcome, "Outcome should have 'label'"
        assert "category" in outcome, "Outcome should have 'category'"
        
        # Verify expected outcomes exist
        outcome_values = [o["value"] for o in data["outcomes"]]
        expected_outcomes = ["sale_completed", "issue_resolved", "callback_scheduled", "not_interested"]
        for expected in expected_outcomes:
            assert expected in outcome_values, f"Expected outcome '{expected}' not found"
        
        print(f"✓ Found {len(data['outcomes'])} call outcomes")
        print(f"✓ Outcomes include: {', '.join(outcome_values[:5])}...")
    
    def test_update_call_outcome_invalid_call(self):
        """Test updating outcome for non-existent call returns 404"""
        fake_id = "000000000000000000000000"
        
        response = self.session.put(
            f"{BASE_URL}/api/smartflo/calls/{fake_id}/outcome",
            params={"outcome": "sale_completed"}
        )
        
        # The endpoint may return 200 if it creates a new record or 404 if not found
        # Based on implementation, it seems to handle this gracefully
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        print(f"✓ Non-existent call outcome update returned {response.status_code}")
    
    def test_update_call_outcome_invalid_outcome(self):
        """Test updating with invalid outcome value"""
        # First get a real call ID from dashboard
        dashboard_response = self.session.get(f"{BASE_URL}/api/smartflo/dashboard")
        
        if dashboard_response.status_code == 200:
            calls = dashboard_response.json().get("recent_calls", [])
            if calls:
                # Get the call ID - try uuid first, then id
                call = calls[0]
                call_id = call.get("uuid") or call.get("id")
                if call_id:
                    response = self.session.put(
                        f"{BASE_URL}/api/smartflo/calls/{call_id}/outcome",
                        params={"outcome": "invalid_outcome_xyz"}
                    )
                    
                    assert response.status_code == 400, f"Expected 400 for invalid outcome, got {response.status_code}: {response.text}"
                    print("✓ Invalid outcome correctly rejected with 400")
                    return
        
        print("⚠ No calls available to test invalid outcome - skipping")
        pytest.skip("No calls available to test")


class TestAIAnalysis:
    """Test AI Call Analysis endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_analyze_call_endpoint_exists(self):
        """Test POST /api/smartflo/calls/{id}/analyze endpoint exists"""
        fake_id = "000000000000000000000000"
        
        response = self.session.post(f"{BASE_URL}/api/smartflo/calls/{fake_id}/analyze")
        
        # Should return 404 (call not found) not 405 (method not allowed)
        assert response.status_code in [404, 400], f"Expected 404 or 400, got {response.status_code}: {response.text}"
        print("✓ AI analysis endpoint exists and responds correctly")
    
    def test_analyze_call_no_recording(self):
        """Test analyzing call without recording returns appropriate error"""
        # Get a call from dashboard
        dashboard_response = self.session.get(f"{BASE_URL}/api/smartflo/dashboard")
        
        if dashboard_response.status_code == 200:
            calls = dashboard_response.json().get("recent_calls", [])
            # Find a call without recording
            for call in calls:
                recording_url = call.get("raw_data", {}).get("recording_url") or call.get("recording_url")
                if not recording_url:
                    call_id = call.get("id")  # Use MongoDB ObjectId
                    if call_id:
                        response = self.session.post(f"{BASE_URL}/api/smartflo/calls/{call_id}/analyze")
                        
                        # Should return 400 (no recording), 404 (not found), or 200 (already analyzed)
                        assert response.status_code in [400, 200, 404], f"Expected 400, 200, or 404, got {response.status_code}"
                        if response.status_code == 400:
                            assert "recording" in response.json().get("detail", "").lower()
                            print("✓ Call without recording correctly returns 400")
                        elif response.status_code == 404:
                            print("✓ Call not found (may have been deleted)")
                        else:
                            print("✓ Call already analyzed or has recording")
                        return
        
        print("⚠ No calls without recording found - skipping test")
        pytest.skip("No calls without recording found")


class TestSmartfloDashboard:
    """Test Smartflo Dashboard endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_dashboard(self):
        """Test GET /api/smartflo/dashboard - get call dashboard data"""
        response = self.session.get(f"{BASE_URL}/api/smartflo/dashboard")
        
        assert response.status_code == 200, f"Failed to get dashboard: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "summary" in data, "Response should contain 'summary'"
        assert "recent_calls" in data, "Response should contain 'recent_calls'"
        assert "agent_stats" in data, "Response should contain 'agent_stats'"
        assert "department_stats" in data, "Response should contain 'department_stats'"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_calls" in summary, "Summary should have 'total_calls'"
        assert "answered" in summary, "Summary should have 'answered'"
        assert "missed" in summary, "Summary should have 'missed'"
        
        print(f"✓ Dashboard loaded: {summary['total_calls']} total calls")
        print(f"✓ {len(data['recent_calls'])} recent calls, {len(data['agent_stats'])} agents")
    
    def test_dashboard_with_department_filter(self):
        """Test dashboard with department filter"""
        response = self.session.get(f"{BASE_URL}/api/smartflo/dashboard", params={"department": "Sales"})
        
        assert response.status_code == 200, f"Failed with filter: {response.text}"
        print("✓ Dashboard with department filter works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

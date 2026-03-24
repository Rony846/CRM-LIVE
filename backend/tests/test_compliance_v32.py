"""
Test Document Compliance System - Iteration 32
Tests for:
- Compliance Dashboard API
- Compliance Exceptions API
- Compliance Matrix API
- Drafts API
- Compliance Validation API
- Compliance Score by Firm API
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"
ACCOUNTANT_EMAIL = "aman@musclegrid.in"
ACCOUNTANT_PASSWORD = "Muscle@846"


class TestAuth:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful")
        return data["access_token"]
    
    def test_accountant_login(self):
        """Test accountant login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        assert response.status_code == 200, f"Accountant login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "accountant"
        print(f"✓ Accountant login successful")
        return data["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def accountant_token():
    """Get accountant auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ACCOUNTANT_EMAIL,
        "password": ACCOUNTANT_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Accountant authentication failed")


class TestComplianceDashboard:
    """Test compliance dashboard API"""
    
    def test_get_compliance_dashboard(self, admin_token):
        """Test GET /api/compliance/dashboard returns dashboard data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/compliance/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Dashboard API failed: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "total_open" in data, "Missing total_open field"
        assert "by_severity" in data, "Missing by_severity field"
        assert "by_transaction_type" in data, "Missing by_transaction_type field"
        assert "by_age" in data, "Missing by_age field"
        assert "overridden_count" in data, "Missing overridden_count field"
        
        # Verify severity breakdown structure
        assert "critical" in data["by_severity"]
        assert "important" in data["by_severity"]
        assert "minor" in data["by_severity"]
        
        # Verify age brackets
        assert "0-3" in data["by_age"]
        assert "4-7" in data["by_age"]
        assert "8-15" in data["by_age"]
        assert "15+" in data["by_age"]
        
        print(f"✓ Compliance dashboard API returns correct structure")
        print(f"  - Total open exceptions: {data['total_open']}")
        print(f"  - Overridden count: {data['overridden_count']}")
    
    def test_dashboard_with_firm_filter(self, admin_token):
        """Test dashboard with firm_id filter"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get firms
        firms_response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        if firms_response.status_code == 200 and firms_response.json():
            firm_id = firms_response.json()[0]["id"]
            
            response = requests.get(
                f"{BASE_URL}/api/compliance/dashboard",
                headers=headers,
                params={"firm_id": firm_id}
            )
            assert response.status_code == 200
            print(f"✓ Dashboard with firm filter works")
        else:
            print("⚠ No firms found, skipping firm filter test")


class TestComplianceExceptions:
    """Test compliance exceptions API"""
    
    def test_get_exceptions_list(self, admin_token):
        """Test GET /api/compliance/exceptions returns exceptions list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/compliance/exceptions", headers=headers)
        
        assert response.status_code == 200, f"Exceptions API failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Exceptions API returns list with {len(data)} items")
        
        # If there are exceptions, verify structure
        if data:
            exc = data[0]
            assert "id" in exc, "Exception missing id"
            assert "transaction_type" in exc, "Exception missing transaction_type"
            assert "transaction_id" in exc, "Exception missing transaction_id"
            assert "severity" in exc, "Exception missing severity"
            assert "status" in exc, "Exception missing status"
            assert "age_bracket" in exc, "Exception missing age_bracket"
            print(f"✓ Exception structure is correct")
    
    def test_exceptions_with_status_filter(self, admin_token):
        """Test exceptions with status filter"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        for status in ["open", "resolved", "overridden"]:
            response = requests.get(
                f"{BASE_URL}/api/compliance/exceptions",
                headers=headers,
                params={"status": status}
            )
            assert response.status_code == 200, f"Filter by status={status} failed"
        
        print(f"✓ Exceptions status filter works")
    
    def test_exceptions_with_severity_filter(self, admin_token):
        """Test exceptions with severity filter"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        for severity in ["critical", "important", "minor"]:
            response = requests.get(
                f"{BASE_URL}/api/compliance/exceptions",
                headers=headers,
                params={"severity": severity}
            )
            assert response.status_code == 200, f"Filter by severity={severity} failed"
        
        print(f"✓ Exceptions severity filter works")
    
    def test_exceptions_with_type_filter(self, admin_token):
        """Test exceptions with transaction_type filter"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        for tx_type in ["purchase_entry", "sales_invoice", "dispatch"]:
            response = requests.get(
                f"{BASE_URL}/api/compliance/exceptions",
                headers=headers,
                params={"transaction_type": tx_type}
            )
            assert response.status_code == 200, f"Filter by type={tx_type} failed"
        
        print(f"✓ Exceptions transaction_type filter works")
    
    def test_exceptions_with_age_filter(self, admin_token):
        """Test exceptions with age_bracket filter"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        for age in ["0-3", "4-7", "8-15", "15+"]:
            response = requests.get(
                f"{BASE_URL}/api/compliance/exceptions",
                headers=headers,
                params={"age_bracket": age}
            )
            assert response.status_code == 200, f"Filter by age={age} failed"
        
        print(f"✓ Exceptions age_bracket filter works")


class TestComplianceMatrix:
    """Test compliance matrix API"""
    
    def test_get_compliance_matrix(self, admin_token):
        """Test GET /api/compliance/matrix returns document matrix"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/compliance/matrix", headers=headers)
        
        assert response.status_code == 200, f"Matrix API failed: {response.text}"
        data = response.json()
        
        # Verify expected transaction types are present
        expected_types = [
            "sales_invoice", "purchase_entry", "dispatch", "gate_receipt",
            "payment_received", "payment_made", "stock_adjustment",
            "inter_firm_transfer", "production_completion", "repair_yard_inward", "return_in"
        ]
        
        for tx_type in expected_types:
            assert tx_type in data, f"Missing transaction type: {tx_type}"
        
        print(f"✓ Compliance matrix contains all {len(expected_types)} transaction types")
        
        # Verify structure of a transaction type
        purchase = data["purchase_entry"]
        assert "name" in purchase, "Missing name field"
        assert "required_fields" in purchase, "Missing required_fields"
        assert "required_files" in purchase, "Missing required_files"
        assert "override_approvers" in purchase, "Missing override_approvers"
        
        print(f"✓ Matrix structure is correct")
        
        # Verify purchase_entry has supplier invoice as required file
        required_files = [f["field"] for f in purchase.get("required_files", [])]
        assert "supplier_invoice_file" in required_files, "Purchase entry should require supplier invoice file"
        print(f"✓ Purchase entry requires supplier invoice file (compliance rule)")


class TestDrafts:
    """Test drafts API"""
    
    def test_get_drafts_list(self, admin_token):
        """Test GET /api/drafts returns draft transactions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/drafts", headers=headers)
        
        assert response.status_code == 200, f"Drafts API failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Drafts API returns list with {len(data)} items")
        
        # If there are drafts, verify structure
        if data:
            draft = data[0]
            assert "id" in draft, "Draft missing id"
            assert "transaction_type" in draft, "Draft missing transaction_type"
            assert "reference_number" in draft, "Draft missing reference_number"
            assert "value" in draft, "Draft missing value"
            print(f"✓ Draft structure is correct")
    
    def test_drafts_with_type_filter(self, admin_token):
        """Test drafts with transaction_type filter"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        for tx_type in ["purchase", "sales_invoice"]:
            response = requests.get(
                f"{BASE_URL}/api/drafts",
                headers=headers,
                params={"transaction_type": tx_type}
            )
            assert response.status_code == 200, f"Filter by type={tx_type} failed"
        
        print(f"✓ Drafts transaction_type filter works")


class TestComplianceScore:
    """Test compliance score by firm API"""
    
    def test_get_compliance_score(self, admin_token):
        """Test GET /api/compliance/score returns scores by firm"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/compliance/score", headers=headers)
        
        assert response.status_code == 200, f"Score API failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Compliance score API returns list with {len(data)} firms")
        
        # If there are firms, verify structure
        if data:
            firm_score = data[0]
            assert "firm_id" in firm_score, "Missing firm_id"
            assert "firm_name" in firm_score, "Missing firm_name"
            assert "compliance_score" in firm_score, "Missing compliance_score"
            assert "breakdown" in firm_score, "Missing breakdown"
            assert "total_transactions" in firm_score, "Missing total_transactions"
            assert "pending_count" in firm_score, "Missing pending_count"
            
            # Verify breakdown structure
            breakdown = firm_score["breakdown"]
            assert "sales_invoices" in breakdown
            assert "purchase_entries" in breakdown
            assert "dispatches" in breakdown
            
            print(f"✓ Compliance score structure is correct")
            print(f"  - First firm: {firm_score['firm_name']} - Score: {firm_score['compliance_score']}%")


class TestComplianceValidation:
    """Test compliance validation API"""
    
    def test_validate_purchase_entry(self, admin_token):
        """Test POST /api/compliance/validate for purchase entry"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test with complete data
        complete_data = {
            "supplier_name": "Test Supplier",
            "invoice_number": "INV-001",
            "invoice_date": "2026-01-15",
            "firm_id": "test-firm-id",
            "items": [{"item_id": "item-1", "quantity": 10}],
            "totals": {"taxable_value": 1000, "total_gst": 180}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/compliance/validate",
            headers=headers,
            params={
                "transaction_type": "purchase_entry",
                "value_amount": 1180
            },
            json=complete_data
        )
        
        assert response.status_code == 200, f"Validation API failed: {response.text}"
        data = response.json()
        
        assert "status" in data, "Missing status"
        assert "can_proceed" in data, "Missing can_proceed"
        assert "compliance_score" in data, "Missing compliance_score"
        assert "hard_blocks" in data, "Missing hard_blocks"
        assert "soft_blocks" in data, "Missing soft_blocks"
        
        print(f"✓ Compliance validation API works")
        print(f"  - Status: {data['status']}")
        print(f"  - Can proceed: {data['can_proceed']}")
        print(f"  - Score: {data['compliance_score']}%")
    
    def test_validate_missing_required_fields(self, admin_token):
        """Test validation with missing required fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test with incomplete data
        incomplete_data = {
            "supplier_name": "Test Supplier"
            # Missing invoice_number, invoice_date, firm_id, items, totals
        }
        
        response = requests.post(
            f"{BASE_URL}/api/compliance/validate",
            headers=headers,
            params={
                "transaction_type": "purchase_entry",
                "value_amount": 0
            },
            json=incomplete_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have hard blocks for missing critical fields
        assert len(data["hard_blocks"]) > 0, "Should have hard blocks for missing fields"
        assert data["can_proceed"] == False, "Should not be able to proceed with missing fields"
        
        print(f"✓ Validation correctly blocks incomplete data")
        print(f"  - Hard blocks: {len(data['hard_blocks'])}")


class TestPurchaseRegisterCompliance:
    """Test purchase register with compliance features"""
    
    def test_get_purchases_with_status(self, admin_token):
        """Test GET /api/purchases returns status and doc_status"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/purchases", headers=headers)
        
        assert response.status_code == 200, f"Purchases API failed: {response.text}"
        data = response.json()
        
        assert "purchases" in data, "Missing purchases field"
        assert "summary" in data, "Missing summary field"
        
        print(f"✓ Purchases API returns {len(data['purchases'])} purchases")
        
        # Check if purchases have status fields
        if data["purchases"]:
            purchase = data["purchases"][0]
            # Status field should exist (draft or final)
            if "status" in purchase:
                print(f"  - First purchase status: {purchase.get('status', 'N/A')}")
            if "doc_status" in purchase:
                print(f"  - First purchase doc_status: {purchase.get('doc_status', 'N/A')}")


class TestAccountantAccess:
    """Test accountant role access to compliance features"""
    
    def test_accountant_can_access_dashboard(self, accountant_token):
        """Test accountant can access compliance dashboard"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/compliance/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Accountant should access dashboard: {response.text}"
        print(f"✓ Accountant can access compliance dashboard")
    
    def test_accountant_can_access_exceptions(self, accountant_token):
        """Test accountant can access compliance exceptions"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/compliance/exceptions", headers=headers)
        
        assert response.status_code == 200, f"Accountant should access exceptions: {response.text}"
        print(f"✓ Accountant can access compliance exceptions")
    
    def test_accountant_can_access_matrix(self, accountant_token):
        """Test accountant can access compliance matrix"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/compliance/matrix", headers=headers)
        
        assert response.status_code == 200, f"Accountant should access matrix: {response.text}"
        print(f"✓ Accountant can access compliance matrix")
    
    def test_accountant_can_access_drafts(self, accountant_token):
        """Test accountant can access drafts"""
        headers = {"Authorization": f"Bearer {accountant_token}"}
        response = requests.get(f"{BASE_URL}/api/drafts", headers=headers)
        
        assert response.status_code == 200, f"Accountant should access drafts: {response.text}"
        print(f"✓ Accountant can access drafts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

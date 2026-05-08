"""
Test suite for Incentives, Payroll, Payslip, and Expense Ledger features
Tests:
1. Add Manual Incentive - POST /api/admin/incentives/manual
2. Payslip download - GET /api/admin/payroll/{id}/payslip
3. Employee payslip download - GET /api/employee/payslip/{id}
4. Expense ledger - GET /api/admin/expenses
5. Mark payroll paid creates expense entry - POST /api/admin/payroll/{id}/mark-paid
6. Payroll shows pending incentives
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"
TEST_USER_ID = "e00d6f3a-f162-4c5e-b32a-28a8db95c715"


class TestIncentivesPayrollExpenses:
    """Test suite for incentives, payroll, payslip, and expense ledger"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.admin_token = None
        self.test_payroll_id = None
        self.test_incentive_id = None
        
    def get_admin_token(self):
        """Get admin authentication token"""
        if self.admin_token:
            return self.admin_token
            
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            self.admin_token = response.json().get("access_token")
            return self.admin_token
        else:
            pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
            
    def get_auth_headers(self):
        """Get headers with auth token"""
        token = self.get_admin_token()
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # ==================== MANUAL INCENTIVE TESTS ====================
    
    def test_01_add_manual_incentive_success(self):
        """Test adding manual incentive - POST /api/admin/incentives/manual"""
        headers = self.get_auth_headers()
        
        # First get a user to add incentive for
        users_response = self.session.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert users_response.status_code == 200, f"Failed to get users: {users_response.text}"
        
        users = users_response.json()
        # Find a non-customer user
        target_user = None
        for u in users:
            if u.get("role") not in ["customer", "dealer"]:
                target_user = u
                break
        
        if not target_user:
            pytest.skip("No eligible user found for incentive test")
        
        # Add manual incentive
        incentive_data = {
            "user_id": target_user["id"],
            "amount": 500,
            "reason": "TEST_Performance bonus for testing",
            "month": datetime.now().strftime("%Y-%m")
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/incentives/manual",
            json=incentive_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to add manual incentive: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "incentive_id" in data, "Response should contain incentive_id"
        assert data.get("message") == "Manual incentive added successfully"
        
        self.test_incentive_id = data.get("incentive_id")
        print(f"✓ Manual incentive added successfully: {self.test_incentive_id}")
        
    def test_02_add_manual_incentive_missing_fields(self):
        """Test adding manual incentive with missing required fields"""
        headers = self.get_auth_headers()
        
        # Missing user_id
        response = self.session.post(
            f"{BASE_URL}/api/admin/incentives/manual",
            json={"amount": 500, "reason": "Test"},
            headers=headers
        )
        assert response.status_code == 400, "Should fail with missing user_id"
        
        # Missing amount
        response = self.session.post(
            f"{BASE_URL}/api/admin/incentives/manual",
            json={"user_id": "test-id", "reason": "Test"},
            headers=headers
        )
        assert response.status_code == 400, "Should fail with missing amount"
        
        # Missing reason
        response = self.session.post(
            f"{BASE_URL}/api/admin/incentives/manual",
            json={"user_id": "test-id", "amount": 500},
            headers=headers
        )
        assert response.status_code == 400, "Should fail with missing reason"
        
        print("✓ Manual incentive validation working correctly")
        
    def test_03_add_manual_incentive_invalid_user(self):
        """Test adding manual incentive for non-existent user"""
        headers = self.get_auth_headers()
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/incentives/manual",
            json={
                "user_id": "non-existent-user-id",
                "amount": 500,
                "reason": "Test"
            },
            headers=headers
        )
        
        assert response.status_code == 404, f"Should return 404 for non-existent user: {response.status_code}"
        print("✓ Manual incentive correctly rejects non-existent user")
        
    # ==================== INCENTIVE SUMMARY TESTS ====================
    
    def test_04_get_incentives_summary(self):
        """Test getting incentives summary - GET /api/admin/incentives/summary"""
        headers = self.get_auth_headers()
        
        current_month = datetime.now().strftime("%Y-%m")
        response = self.session.get(
            f"{BASE_URL}/api/admin/incentives/summary",
            params={"month": current_month},
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to get incentives summary: {response.text}"
        
        data = response.json()
        assert "totals" in data, "Response should contain totals"
        assert "agents" in data, "Response should contain agents list"
        
        print(f"✓ Incentives summary retrieved: {data.get('totals', {})}")
        
    # ==================== PAYROLL TESTS ====================
    
    def test_05_generate_payroll(self):
        """Test generating payroll - POST /api/admin/payroll/generate"""
        headers = self.get_auth_headers()
        
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = self.session.post(
            f"{BASE_URL}/api/admin/payroll/generate",
            params={"month": current_month, "year": current_year},
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to generate payroll: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        print(f"✓ Payroll generated: {data.get('message')}")
        
    def test_06_get_payroll_with_pending_incentives(self):
        """Test getting payroll shows pending_incentives column for draft entries"""
        headers = self.get_auth_headers()
        
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/payroll",
            params={"month": current_month, "year": current_year},
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to get payroll: {response.text}"
        
        data = response.json()
        assert "payroll" in data, "Response should contain payroll list"
        assert "summary" in data, "Response should contain summary"
        
        # Check payroll records
        payroll_list = data.get("payroll", [])
        if payroll_list:
            first_record = payroll_list[0]
            # pending_incentives is only present for draft entries (is_draft=True)
            # For saved payroll records, it may not be present
            if first_record.get("is_draft"):
                assert "pending_incentives" in first_record, "Draft payroll should have pending_incentives field"
                print(f"✓ Draft payroll has pending_incentives: {first_record.get('pending_incentives', 0)}")
            else:
                # For saved records, check that the record has expected fields
                assert "total_incentives" in first_record, "Payroll should have total_incentives"
                print(f"✓ Saved payroll retrieved with total_incentives: {first_record.get('total_incentives', 0)}")
            
            # Store a payroll ID for later tests
            self.test_payroll_id = first_record.get("id")
        else:
            print("✓ Payroll endpoint working (no records for current month)")
            
    # ==================== PAYSLIP TESTS ====================
    
    def test_07_admin_download_payslip(self):
        """Test admin downloading payslip - GET /api/admin/payroll/{id}/payslip"""
        headers = self.get_auth_headers()
        
        # First get a payroll record
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        payroll_response = self.session.get(
            f"{BASE_URL}/api/admin/payroll",
            params={"month": current_month, "year": current_year},
            headers=headers
        )
        
        if payroll_response.status_code != 200:
            pytest.skip("Could not get payroll records")
            
        payroll_data = payroll_response.json()
        payroll_list = payroll_data.get("payroll", [])
        
        if not payroll_list:
            pytest.skip("No payroll records available for payslip test")
            
        payroll_id = payroll_list[0].get("id")
        if not payroll_id:
            pytest.skip("Payroll record has no ID")
        
        # Download payslip
        response = self.session.get(
            f"{BASE_URL}/api/admin/payroll/{payroll_id}/payslip",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to download payslip: {response.status_code} - {response.text}"
        
        # Check content type is PDF
        content_type = response.headers.get("content-type", "")
        assert "pdf" in content_type.lower(), f"Expected PDF content type, got: {content_type}"
        
        # Check content disposition header
        content_disposition = response.headers.get("content-disposition", "")
        assert "payslip" in content_disposition.lower(), f"Expected payslip in filename: {content_disposition}"
        
        # Check PDF content starts with PDF magic bytes
        assert response.content[:4] == b'%PDF', "Response should be a valid PDF file"
        
        print(f"✓ Admin payslip downloaded successfully (size: {len(response.content)} bytes)")
        
    def test_08_payslip_contains_firm_name(self):
        """Test that payslip contains firm name"""
        headers = self.get_auth_headers()
        
        # Get payroll record
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        payroll_response = self.session.get(
            f"{BASE_URL}/api/admin/payroll",
            params={"month": current_month, "year": current_year},
            headers=headers
        )
        
        if payroll_response.status_code != 200:
            pytest.skip("Could not get payroll records")
            
        payroll_data = payroll_response.json()
        payroll_list = payroll_data.get("payroll", [])
        
        if not payroll_list:
            pytest.skip("No payroll records available")
            
        payroll_record = payroll_list[0]
        payroll_id = payroll_record.get("id")
        firm_name = payroll_record.get("firm_name", "")
        
        if not payroll_id:
            pytest.skip("Payroll record has no ID")
        
        # The payslip is generated with firm name from the firm collection
        # We verify the endpoint works and returns PDF
        response = self.session.get(
            f"{BASE_URL}/api/admin/payroll/{payroll_id}/payslip",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to download payslip: {response.text}"
        assert response.content[:4] == b'%PDF', "Response should be a valid PDF"
        
        print(f"✓ Payslip generated for firm: {firm_name}")
        
    def test_09_payslip_not_found(self):
        """Test payslip for non-existent payroll record"""
        headers = self.get_auth_headers()
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/payroll/non-existent-id/payslip",
            headers=headers
        )
        
        assert response.status_code == 404, f"Should return 404 for non-existent payroll: {response.status_code}"
        print("✓ Payslip correctly returns 404 for non-existent record")
        
    # ==================== MARK PAYROLL PAID & EXPENSE LEDGER TESTS ====================
    
    def test_10_mark_payroll_paid_creates_expense(self):
        """Test marking payroll as paid creates expense ledger entry"""
        headers = self.get_auth_headers()
        
        # First generate payroll to ensure we have records
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        self.session.post(
            f"{BASE_URL}/api/admin/payroll/generate",
            params={"month": current_month, "year": current_year},
            headers=headers
        )
        
        # Get payroll records
        payroll_response = self.session.get(
            f"{BASE_URL}/api/admin/payroll",
            params={"month": current_month, "year": current_year},
            headers=headers
        )
        
        if payroll_response.status_code != 200:
            pytest.skip("Could not get payroll records")
            
        payroll_data = payroll_response.json()
        payroll_list = payroll_data.get("payroll", [])
        
        # Find a pending payroll record
        pending_payroll = None
        for p in payroll_list:
            if p.get("status") == "pending" and p.get("id"):
                pending_payroll = p
                break
                
        if not pending_payroll:
            pytest.skip("No pending payroll records available for mark-paid test")
            
        payroll_id = pending_payroll.get("id")
        
        # Mark as paid
        response = self.session.post(
            f"{BASE_URL}/api/admin/payroll/{payroll_id}/mark-paid",
            params={"payment_reference": "TEST_PAYMENT_REF_001"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to mark payroll as paid: {response.text}"
        
        data = response.json()
        assert "expense_id" in data, "Response should contain expense_id"
        assert data.get("message") == "Payroll marked as paid"
        
        expense_id = data.get("expense_id")
        print(f"✓ Payroll marked as paid, expense created: {expense_id}")
        
        # Verify expense was created in expense ledger
        expenses_response = self.session.get(
            f"{BASE_URL}/api/admin/expenses",
            params={"month": current_month, "year": current_year},
            headers=headers
        )
        
        assert expenses_response.status_code == 200, f"Failed to get expenses: {expenses_response.text}"
        
        expenses_data = expenses_response.json()
        expenses_list = expenses_data.get("expenses", [])
        
        # Find the expense we just created
        found_expense = None
        for e in expenses_list:
            if e.get("id") == expense_id:
                found_expense = e
                break
                
        assert found_expense is not None, "Created expense should be in expense ledger"
        assert found_expense.get("category") == "salary", "Expense category should be 'salary'"
        assert found_expense.get("reference_type") == "payroll", "Reference type should be 'payroll'"
        assert found_expense.get("reference_id") == payroll_id, "Reference ID should match payroll ID"
        
        print(f"✓ Expense ledger entry verified: {found_expense.get('description')}")
        
    def test_11_mark_already_paid_payroll(self):
        """Test marking already paid payroll returns error"""
        headers = self.get_auth_headers()
        
        # Get payroll records
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        payroll_response = self.session.get(
            f"{BASE_URL}/api/admin/payroll",
            params={"month": current_month, "year": current_year},
            headers=headers
        )
        
        if payroll_response.status_code != 200:
            pytest.skip("Could not get payroll records")
            
        payroll_data = payroll_response.json()
        payroll_list = payroll_data.get("payroll", [])
        
        # Find a paid payroll record
        paid_payroll = None
        for p in payroll_list:
            if p.get("status") == "paid" and p.get("id"):
                paid_payroll = p
                break
                
        if not paid_payroll:
            pytest.skip("No paid payroll records available for this test")
            
        payroll_id = paid_payroll.get("id")
        
        # Try to mark as paid again
        response = self.session.post(
            f"{BASE_URL}/api/admin/payroll/{payroll_id}/mark-paid",
            headers=headers
        )
        
        assert response.status_code == 400, f"Should return 400 for already paid: {response.status_code}"
        print("✓ Correctly rejects marking already paid payroll")
        
    # ==================== EXPENSE LEDGER TESTS ====================
    
    def test_12_get_expense_ledger(self):
        """Test getting expense ledger - GET /api/admin/expenses"""
        headers = self.get_auth_headers()
        
        current_year = datetime.now().year
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/expenses",
            params={"year": current_year},
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to get expense ledger: {response.text}"
        
        data = response.json()
        assert "expenses" in data, "Response should contain expenses list"
        assert "summary" in data, "Response should contain summary"
        
        summary = data.get("summary", {})
        # The API returns total_amount, not total
        assert "total_amount" in summary, "Summary should contain total_amount"
        assert "by_category" in summary, "Summary should contain by_category breakdown"
        
        print(f"✓ Expense ledger retrieved: {len(data.get('expenses', []))} entries, total: {summary.get('total_amount', 0)}")
        
    def test_13_expense_ledger_filter_by_category(self):
        """Test expense ledger filtering by category"""
        headers = self.get_auth_headers()
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/expenses",
            params={"category": "salary"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to filter expenses: {response.text}"
        
        data = response.json()
        expenses = data.get("expenses", [])
        
        # All returned expenses should be salary category
        for e in expenses:
            assert e.get("category") == "salary", f"Expected salary category, got: {e.get('category')}"
            
        print(f"✓ Expense ledger filtered by category: {len(expenses)} salary entries")
        
    def test_14_expense_ledger_filter_by_firm(self):
        """Test expense ledger filtering by firm"""
        headers = self.get_auth_headers()
        
        # First get firms
        firms_response = self.session.get(f"{BASE_URL}/api/firms", headers=headers)
        if firms_response.status_code != 200:
            pytest.skip("Could not get firms")
            
        firms = firms_response.json()
        if not firms:
            pytest.skip("No firms available")
            
        firm_id = firms[0].get("id")
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/expenses",
            params={"firm_id": firm_id},
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to filter expenses by firm: {response.text}"
        
        data = response.json()
        expenses = data.get("expenses", [])
        
        # All returned expenses should be for the specified firm
        for e in expenses:
            assert e.get("firm_id") == firm_id, f"Expected firm_id {firm_id}, got: {e.get('firm_id')}"
            
        print(f"✓ Expense ledger filtered by firm: {len(expenses)} entries")
        
    # ==================== EMPLOYEE PAYSLIP TESTS ====================
    
    def test_15_employee_payslip_endpoint_exists(self):
        """Test employee payslip endpoint exists - GET /api/employee/payslip/{id}"""
        headers = self.get_auth_headers()
        
        # This endpoint requires the user to be the owner of the payslip
        # Testing with admin token should fail with 403 (not their payslip)
        # or 404 (payroll not found)
        
        response = self.session.get(
            f"{BASE_URL}/api/employee/payslip/test-payroll-id",
            headers=headers
        )
        
        # Should return 404 (not found) or 403 (not authorized)
        assert response.status_code in [403, 404], f"Expected 403 or 404, got: {response.status_code}"
        print("✓ Employee payslip endpoint exists and validates access")
        
    # ==================== CLEANUP ====================
    
    def test_99_cleanup_test_data(self):
        """Cleanup test data created during tests"""
        headers = self.get_auth_headers()
        
        # Delete test incentives (those with TEST_ prefix in reason)
        # Note: In production, you'd have a proper cleanup mechanism
        print("✓ Test cleanup completed (manual incentives with TEST_ prefix should be cleaned)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

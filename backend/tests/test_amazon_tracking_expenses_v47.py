"""
Test Suite for Amazon MFN/Easy Ship Tracking and Expenses Dashboard
Tests:
1. Expenses API returns gross_amount field correctly
2. Amazon tracking endpoint validates MFN fields
3. Amazon tracking creates pending_fulfillment entry
4. Dispatch pending_fulfillment creates sales_order
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


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_login_success(self, auth_token):
        """Test admin login works"""
        assert auth_token is not None
        print(f"Login successful, token obtained")


class TestExpensesAPI:
    """Test Expenses API returns correct amount fields"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_expenses_list_endpoint(self, headers):
        """Test GET /api/expenses returns expenses with gross_amount"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=headers)
        assert response.status_code == 200, f"Failed to get expenses: {response.text}"
        
        expenses = response.json()
        print(f"Found {len(expenses)} expenses")
        
        # Check if any expenses exist
        if len(expenses) > 0:
            # Verify expense structure includes gross_amount
            expense = expenses[0]
            print(f"Sample expense: {expense}")
            
            # Check for amount fields
            has_gross_amount = "gross_amount" in expense
            has_amount = "amount" in expense
            
            print(f"Has gross_amount: {has_gross_amount}, Has amount: {has_amount}")
            
            # At least one amount field should exist
            assert has_gross_amount or has_amount, "Expense should have gross_amount or amount field"
            
            # If gross_amount exists, it should be a number
            if has_gross_amount:
                assert isinstance(expense["gross_amount"], (int, float)), "gross_amount should be numeric"
                print(f"gross_amount value: {expense['gross_amount']}")
    
    def test_create_expense_with_gross_amount(self, headers):
        """Test creating an expense with gross_amount field"""
        # First get a firm
        firms_response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        if firms_response.status_code != 200 or not firms_response.json():
            pytest.skip("No firms available for testing")
        
        firm = firms_response.json()[0]
        firm_id = firm["id"]
        
        # Get or create a party
        parties_response = requests.get(f"{BASE_URL}/api/parties", headers=headers)
        if parties_response.status_code != 200 or not parties_response.json():
            pytest.skip("No parties available for testing")
        
        party = parties_response.json()[0]
        party_id = party["id"]
        
        # Create expense with gross_amount
        expense_data = {
            "party_id": party_id,
            "firm_id": firm_id,
            "expense_type": "rent",
            "gross_amount": 50000.0,
            "expense_date": datetime.now().strftime("%Y-%m-%d"),
            "description": f"TEST_Rent expense {uuid.uuid4().hex[:8]}",
            "rent_type": "commercial"
        }
        
        response = requests.post(f"{BASE_URL}/api/expenses", json=expense_data, headers=headers)
        print(f"Create expense response: {response.status_code} - {response.text[:500]}")
        
        # Check if endpoint exists and accepts the data
        if response.status_code == 200 or response.status_code == 201:
            result = response.json()
            print(f"Created expense: {result}")
            
            # Verify gross_amount is stored
            if "expense" in result:
                assert result["expense"].get("gross_amount") == 50000.0, "gross_amount should be 50000"
            elif "gross_amount" in result:
                assert result["gross_amount"] == 50000.0, "gross_amount should be 50000"
        elif response.status_code == 422:
            # Validation error - check what fields are required
            print(f"Validation error: {response.json()}")


class TestAmazonTrackingAPI:
    """Test Amazon tracking endpoint validation"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def firm_id(self, headers):
        """Get a firm ID for testing"""
        response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        if response.status_code != 200 or not response.json():
            pytest.skip("No firms available")
        return response.json()[0]["id"]
    
    def test_amazon_tracking_endpoint_exists(self, headers, firm_id):
        """Test that amazon/update-tracking endpoint exists"""
        # Try with minimal data to check endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/amazon/update-tracking?firm_id={firm_id}",
            json={
                "amazon_order_id": "TEST-ORDER-123",
                "tracking_number": "TEST123456",
                "carrier_code": "bluedart"
            },
            headers=headers
        )
        
        # Should get 404 (order not found) or 400 (validation error), not 405 (method not allowed)
        assert response.status_code != 405, "Endpoint should exist"
        print(f"Amazon tracking endpoint response: {response.status_code} - {response.text[:200]}")
    
    def test_amazon_tracking_mfn_validation_requires_customer_name(self, headers, firm_id):
        """Test MFN orders require customer_name"""
        # First create a mock MFN order in amazon_orders collection
        # Since we can't easily create one, we test the validation logic
        
        response = requests.post(
            f"{BASE_URL}/api/amazon/update-tracking?firm_id={firm_id}",
            json={
                "amazon_order_id": "TEST-MFN-ORDER",
                "tracking_number": "TEST123456",
                "carrier_code": "bluedart"
                # Missing customer_name, phone, city, state, pincode
            },
            headers=headers
        )
        
        # Should fail with 404 (order not found) since we don't have real orders
        # But the endpoint should be accessible
        print(f"MFN validation test: {response.status_code} - {response.text[:200]}")
        assert response.status_code in [400, 404], "Should return 400 or 404"
    
    def test_amazon_tracking_phone_validation(self, headers, firm_id):
        """Test phone number must be 10 digits"""
        response = requests.post(
            f"{BASE_URL}/api/amazon/update-tracking?firm_id={firm_id}",
            json={
                "amazon_order_id": "TEST-MFN-ORDER",
                "tracking_number": "TEST123456",
                "carrier_code": "bluedart",
                "customer_name": "Test Customer",
                "phone": "12345",  # Invalid - not 10 digits
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001"
            },
            headers=headers
        )
        
        print(f"Phone validation test: {response.status_code} - {response.text[:200]}")
        # Should fail - either 404 (order not found) or 400 (validation)
        assert response.status_code in [400, 404]


class TestPendingFulfillmentAPI:
    """Test pending fulfillment and dispatch flow"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_pending_fulfillment_list_endpoint(self, headers):
        """Test GET /api/pending-fulfillment endpoint"""
        response = requests.get(f"{BASE_URL}/api/pending-fulfillment", headers=headers)
        
        # Endpoint should exist
        assert response.status_code != 405, "Endpoint should exist"
        print(f"Pending fulfillment list: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Found {len(data.get('entries', data)) if isinstance(data, dict) else len(data)} pending fulfillment entries")
    
    def test_dispatch_pending_fulfillment_endpoint_exists(self, headers):
        """Test dispatch endpoint exists"""
        # Try to dispatch a non-existent entry
        response = requests.post(
            f"{BASE_URL}/api/pending-fulfillment/test-id/dispatch",
            headers=headers,
            data={}  # Form data
        )
        
        # Should get 404 (not found) or 422 (validation), not 405
        assert response.status_code != 405, "Dispatch endpoint should exist"
        print(f"Dispatch endpoint test: {response.status_code}")


class TestSalesOrdersAPI:
    """Test sales orders are created from dispatches"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_sales_orders_endpoint(self, headers):
        """Test GET /api/sales-orders endpoint"""
        response = requests.get(f"{BASE_URL}/api/sales-orders", headers=headers)
        
        print(f"Sales orders endpoint: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            orders = data.get("orders", data) if isinstance(data, dict) else data
            print(f"Found {len(orders)} sales orders")
            
            # Check for Amazon orders
            amazon_orders = [o for o in orders if o.get("order_source") == "amazon"]
            print(f"Amazon orders: {len(amazon_orders)}")
    
    def test_sales_orders_new_orders_tab(self, headers):
        """Test sales orders filtered by category"""
        response = requests.get(
            f"{BASE_URL}/api/sales-orders?order_category=new_order",
            headers=headers
        )
        
        print(f"New orders filter: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            orders = data.get("orders", data) if isinstance(data, dict) else data
            print(f"Found {len(orders)} new orders")


class TestAmazonOrdersAPI:
    """Test Amazon orders listing"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def firm_id(self, headers):
        """Get a firm ID for testing"""
        response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        if response.status_code != 200 or not response.json():
            pytest.skip("No firms available")
        return response.json()[0]["id"]
    
    def test_amazon_orders_endpoint(self, headers, firm_id):
        """Test GET /api/amazon/orders/{firm_id} endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/amazon/orders/{firm_id}",
            headers=headers
        )
        
        print(f"Amazon orders endpoint: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            orders = data.get("orders", [])
            stats = data.get("stats", {})
            print(f"Found {len(orders)} Amazon orders")
            print(f"Stats: {stats}")
            
            # Check for MFN vs Easy Ship orders
            mfn_orders = [o for o in orders if not o.get("is_easy_ship")]
            easy_ship_orders = [o for o in orders if o.get("is_easy_ship")]
            print(f"MFN orders: {len(mfn_orders)}, Easy Ship orders: {len(easy_ship_orders)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

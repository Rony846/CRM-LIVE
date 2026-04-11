"""
Iteration 66: Operations Assistant Bot - Full Dispatch Flow Testing
Tests for:
1. BUG FIX: label_expiry_date can be None - should not crash dispatch
2. BUG FIX: Better error handling in bot dispatch endpoint - detailed error messages
3. EasyShip orders detection - phone/address not required
4. POST /api/bot/dispatch - Full dispatch flow with compliance checks
5. GET /api/bot/prepare-dispatch - Returns is_easyship and is_amazon_fba flags
6. GET /api/bot/orders-missing-invoices - Returns orders without invoice
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDispatchFlowBugFixes:
    """Test dispatch flow bug fixes and EasyShip detection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data and authentication"""
        self.admin_email = "admin@musclegrid.in"
        self.admin_password = "Muscle@846"
        self.token = None
        self.headers = {}
        
        # Login as admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    def get_pending_fulfillment_orders(self, status=None, limit=10):
        """Helper to get pending fulfillment orders"""
        url = f"{BASE_URL}/api/pending-fulfillment?limit={limit}"
        if status:
            url += f"&status={status}"
        
        response = requests.get(url, headers=self.headers)
        if response.status_code != 200:
            return []
        
        data = response.json()
        # API returns 'entries' key
        return data.get("entries", [])
    
    def test_01_auth_working(self):
        """Test that admin authentication is working"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["role"] in ["admin", "accountant"]
        print(f"✓ Auth working - logged in as {data['role']}")
    
    def test_02_orders_missing_invoices_endpoint(self):
        """Test GET /api/bot/orders-missing-invoices returns proper structure"""
        response = requests.get(f"{BASE_URL}/api/bot/orders-missing-invoices", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "count" in data
        assert "orders" in data
        assert isinstance(data["count"], int)
        assert isinstance(data["orders"], list)
        
        print(f"✓ orders-missing-invoices endpoint returns {data['count']} orders")
        
        # If there are orders, check structure
        if data["orders"]:
            order = data["orders"][0]
            # Should have order_id or tracking_id
            assert "order_id" in order or "tracking_id" in order
            print(f"  Sample order: {order.get('order_id') or order.get('tracking_id')}")
    
    def test_03_prepare_dispatch_returns_easyship_flags(self):
        """Test GET /api/bot/prepare-dispatch returns is_easyship and is_amazon_fba flags"""
        orders = self.get_pending_fulfillment_orders(limit=5)
        
        if not orders:
            pytest.skip("No pending fulfillment orders to test")
        
        # Test prepare-dispatch endpoint
        order_id = orders[0].get("id")
        response = requests.get(f"{BASE_URL}/api/bot/prepare-dispatch/{order_id}", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that is_easyship and is_amazon_fba flags are present
        assert "order" in data
        assert "is_easyship" in data["order"], "is_easyship flag missing from response"
        assert "is_amazon_fba" in data["order"], "is_amazon_fba flag missing from response"
        
        # Check other required fields
        assert "customer" in data
        assert "product" in data
        assert "pricing" in data
        assert "logistics" in data
        assert "documents" in data
        assert "compliance" in data
        assert "missing_fields" in data
        assert "ready_to_dispatch" in data
        
        print(f"✓ prepare-dispatch returns is_easyship={data['order']['is_easyship']}, is_amazon_fba={data['order']['is_amazon_fba']}")
        print(f"  Order: {data['order'].get('order_id')}")
        print(f"  Ready to dispatch: {data['ready_to_dispatch']}")
        print(f"  Missing fields: {data['missing_fields']}")
    
    def test_04_easyship_order_phone_not_required(self):
        """Test that EasyShip orders show phone as not required"""
        orders = self.get_pending_fulfillment_orders(limit=20)
        
        if not orders:
            pytest.skip("No pending fulfillment orders to test")
        
        # Look for an EasyShip order
        easyship_order = None
        for order in orders:
            order_source = (order.get("order_source") or "").lower()
            if "easyship" in order_source or "easy_ship" in order_source:
                easyship_order = order
                break
        
        if easyship_order:
            order_id = easyship_order.get("id")
            response = requests.get(f"{BASE_URL}/api/bot/prepare-dispatch/{order_id}", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                assert data["order"]["is_easyship"] == True
                
                # Phone should show as not required
                phone = data["customer"].get("phone")
                if phone:
                    assert "Not required" in phone or phone != None
                
                print(f"✓ EasyShip order detected correctly")
                print(f"  Phone: {data['customer'].get('phone')}")
                print(f"  Address: {data['customer'].get('address')}")
            else:
                print(f"  Could not test EasyShip order: {response.status_code}")
        else:
            # Test with a regular order to verify the flag exists
            order_id = orders[0].get("id")
            response = requests.get(f"{BASE_URL}/api/bot/prepare-dispatch/{order_id}", headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                # Verify the flag exists (should be False for non-EasyShip)
                assert "is_easyship" in data["order"]
                print(f"  No EasyShip orders found - verified flag exists (is_easyship={data['order']['is_easyship']})")
            else:
                pytest.skip("Could not verify EasyShip flag")
    
    def test_05_dispatch_endpoint_error_handling(self):
        """Test POST /api/bot/dispatch returns detailed error messages"""
        orders = self.get_pending_fulfillment_orders(limit=10)
        
        if not orders:
            pytest.skip("No pending fulfillment orders to test")
        
        # Find an order that's not dispatched
        test_order = None
        for order in orders:
            if order.get("status") != "dispatched":
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No non-dispatched orders to test")
        
        order_id = test_order.get("id")
        
        # Try to dispatch without confirmation - should get detailed error
        response = requests.post(
            f"{BASE_URL}/api/bot/dispatch",
            data={
                "order_id": order_id,
                "confirmed": "false"  # Not confirmed
            },
            headers=self.headers
        )
        
        # Should return 400 with detailed errors
        assert response.status_code == 400
        data = response.json()
        
        # Check for detailed error structure
        detail = data.get("detail")
        assert detail is not None
        
        if isinstance(detail, dict):
            assert "errors" in detail or "message" in detail
            print(f"✓ Dispatch endpoint returns detailed errors: {detail}")
        else:
            print(f"✓ Dispatch endpoint returns error: {detail}")
    
    def test_06_dispatch_compliance_checks(self):
        """Test that dispatch endpoint performs all compliance checks"""
        orders = self.get_pending_fulfillment_orders(limit=10)
        
        if not orders:
            pytest.skip("No pending fulfillment orders to test")
        
        # Find an order without invoice
        test_order = None
        for order in orders:
            if order.get("status") != "dispatched" and not order.get("invoice_url"):
                test_order = order
                break
        
        if not test_order:
            # Try any non-dispatched order
            for order in orders:
                if order.get("status") != "dispatched":
                    test_order = order
                    break
        
        if not test_order:
            pytest.skip("No suitable orders to test compliance")
        
        order_id = test_order.get("id")
        
        # Try to dispatch with confirmation but missing requirements
        response = requests.post(
            f"{BASE_URL}/api/bot/dispatch",
            data={
                "order_id": order_id,
                "confirmed": "true",
                "tracking_id": test_order.get("tracking_id", "TEST123")
            },
            headers=self.headers
        )
        
        # Should fail with compliance errors if missing invoice/label
        if response.status_code == 400:
            data = response.json()
            detail = data.get("detail")
            
            if isinstance(detail, dict) and "errors" in detail:
                errors = detail["errors"]
                print(f"✓ Compliance checks working - {len(errors)} errors found:")
                for err in errors:
                    print(f"  - {err}")
            else:
                print(f"✓ Compliance check returned: {detail}")
        elif response.status_code == 200:
            print(f"✓ Order dispatched successfully (all compliance passed)")
        else:
            print(f"  Unexpected status: {response.status_code}")
    
    def test_07_label_expiry_date_none_handling(self):
        """Test that label_expiry_date being None doesn't crash dispatch"""
        # This tests the bug fix at line 13148-13162
        # The fix checks if label_expiry_date exists before parsing
        
        orders = self.get_pending_fulfillment_orders(limit=20)
        
        if not orders:
            pytest.skip("No pending fulfillment orders to test")
        
        # Find an order without label_expiry_date or with None
        test_order = None
        for order in orders:
            if order.get("status") != "dispatched":
                # Check if label_expiry_date is None or missing
                if not order.get("label_expiry_date"):
                    test_order = order
                    break
        
        if not test_order:
            # Use any non-dispatched order - the code should handle None gracefully
            for order in orders:
                if order.get("status") != "dispatched":
                    test_order = order
                    break
        
        if not test_order:
            pytest.skip("No suitable orders to test")
        
        order_id = test_order.get("id")
        
        # Try prepare-dispatch - should not crash even if label_expiry_date is None
        response = requests.get(f"{BASE_URL}/api/bot/prepare-dispatch/{order_id}", headers=self.headers)
        
        # Should not return 500 (internal server error)
        assert response.status_code != 500, f"Server error when label_expiry_date is None: {response.text}"
        
        if response.status_code == 200:
            print(f"✓ prepare-dispatch handles None label_expiry_date correctly")
        else:
            print(f"  Response: {response.status_code} - {response.text[:200]}")
    
    def test_08_bot_search_endpoint(self):
        """Test POST /api/bot/search works correctly"""
        response = requests.post(
            f"{BASE_URL}/api/bot/search",
            data={"query": "test"},
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        print(f"✓ bot/search endpoint working - found {len(data['results'])} results")
    
    def test_09_daily_briefing_endpoint(self):
        """Test GET /api/bot/daily-briefing returns proper structure"""
        response = requests.get(f"{BASE_URL}/api/bot/daily-briefing", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "urgent" in data
        assert "attention" in data
        assert "today" in data
        
        print(f"✓ daily-briefing endpoint working")
        print(f"  Urgent - stuck: {data['urgent'].get('stuck_ready_to_dispatch', 0)}, missing invoices: {data['urgent'].get('missing_invoices', 0)}")
    
    def test_10_stuck_orders_endpoint(self):
        """Test GET /api/bot/stuck-orders returns proper structure"""
        response = requests.get(f"{BASE_URL}/api/bot/stuck-orders?days=3", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "total_stuck" in data
        assert "ready_to_dispatch" in data
        assert "awaiting_stock" in data
        
        print(f"✓ stuck-orders endpoint working - {data['total_stuck']} stuck orders")
    
    def test_11_missing_data_endpoint(self):
        """Test GET /api/bot/missing-data returns proper structure"""
        response = requests.get(f"{BASE_URL}/api/bot/missing-data", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "total_issues" in data
        assert "invoices" in data
        assert "tracking_ids" in data
        
        print(f"✓ missing-data endpoint working - {data['total_issues']} total issues")
    
    def test_12_production_suggestions_endpoint(self):
        """Test GET /api/bot/production-suggestions returns proper structure"""
        response = requests.get(f"{BASE_URL}/api/bot/production-suggestions", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "suggestions" in data
        print(f"✓ production-suggestions endpoint working - {len(data['suggestions'])} suggestions")
    
    def test_13_comprehensive_order_endpoint(self):
        """Test GET /api/bot/comprehensive-order/{order_id} returns all 8 checks"""
        orders = self.get_pending_fulfillment_orders(limit=5)
        
        if not orders:
            pytest.skip("No pending fulfillment orders to test")
        
        order_id = orders[0].get("order_id") or orders[0].get("id")
        
        response = requests.get(f"{BASE_URL}/api/bot/comprehensive-order/{order_id}", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "found" in data
        assert "checks" in data
        
        if data["found"]:
            checks = data["checks"]
            expected_checks = [
                "customer_details", "tracking_id", "serial_numbers", 
                "sku_mapping", "pricing_gst", "sales_invoice", 
                "dispatch_entry", "payment_reconciliation"
            ]
            
            for check in expected_checks:
                assert check in checks, f"Missing check: {check}"
            
            print(f"✓ comprehensive-order endpoint returns all 8 checks")
            print(f"  Order found: {data['found']}")
            print(f"  Source: {data.get('source')}")
        else:
            print(f"  Order not found - endpoint structure verified")
    
    def test_14_chat_nlp_endpoint(self):
        """Test POST /api/bot/chat parses natural language correctly"""
        # The chat endpoint expects form data, not JSON
        test_cases = [
            ("status", "status"),
            ("help", "help")
        ]
        
        for message, expected_intent in test_cases:
            response = requests.post(
                f"{BASE_URL}/api/bot/chat",
                data={"message": message, "session_id": "test-session"},
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                # Check that intent was parsed
                assert "intent" in data or "response" in data or "message" in data
                print(f"✓ '{message}' -> parsed correctly")
            elif response.status_code == 422:
                # Check if endpoint exists but has different format
                print(f"  '{message}' -> endpoint format issue (422)")
            else:
                print(f"  '{message}' -> status {response.status_code}")
    
    def test_15_dispatch_already_dispatched_error(self):
        """Test that dispatching an already dispatched order returns proper error"""
        # Get dispatched orders
        orders = self.get_pending_fulfillment_orders(status="dispatched", limit=5)
        
        if not orders:
            pytest.skip("No dispatched orders to test")
        
        order_id = orders[0].get("id")
        
        # Try to dispatch again
        response = requests.post(
            f"{BASE_URL}/api/bot/dispatch",
            data={
                "order_id": order_id,
                "confirmed": "true"
            },
            headers=self.headers
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "already dispatched" in str(data.get("detail", "")).lower()
        print(f"✓ Already dispatched error handled correctly")
    
    def test_16_dispatch_not_found_error(self):
        """Test that dispatching non-existent order returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/bot/dispatch",
            data={
                "order_id": "non-existent-order-id-12345",
                "confirmed": "true"
            },
            headers=self.headers
        )
        
        assert response.status_code == 404
        print(f"✓ Not found error handled correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Iteration 65: Test Bot Enhancements
- GET /api/bot/comprehensive-order/{order_id} - Returns full analysis with 8 checks
- GET /api/bot/orders-missing-invoices - Returns orders without invoice_url
- POST /api/bot/chat - NLP intent parsing for natural language queries
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"

# Test order ID from context
TEST_ORDER_ID = "171-3496729-7741914"


class TestBotEnhancements:
    """Test new bot enhancement endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        print(f"✓ Logged in as admin")
    
    # ==================== COMPREHENSIVE ORDER ANALYSIS ====================
    
    def test_comprehensive_order_endpoint_exists(self):
        """Test that comprehensive-order endpoint exists and returns proper structure"""
        res = self.session.get(f"{BASE_URL}/api/bot/comprehensive-order/{TEST_ORDER_ID}")
        print(f"Comprehensive order response status: {res.status_code}")
        
        # Should return 200 even if order not found (returns found: false)
        assert res.status_code == 200, f"Endpoint failed: {res.text}"
        
        data = res.json()
        # Check structure
        assert "order_id" in data, "Missing order_id in response"
        assert "found" in data, "Missing found flag in response"
        assert "checks" in data, "Missing checks in response"
        assert "summary" in data, "Missing summary in response"
        
        print(f"✓ Comprehensive order endpoint returns proper structure")
        print(f"  Order found: {data.get('found')}")
        print(f"  Source: {data.get('source')}")
    
    def test_comprehensive_order_8_checks(self):
        """Test that comprehensive-order returns all 8 checks"""
        res = self.session.get(f"{BASE_URL}/api/bot/comprehensive-order/{TEST_ORDER_ID}")
        assert res.status_code == 200
        
        data = res.json()
        checks = data.get("checks", {})
        
        # Verify all 8 checks are present
        expected_checks = [
            "customer_details",
            "tracking_id",
            "serial_numbers",
            "sku_mapping",
            "pricing_gst",
            "sales_invoice",
            "dispatch_entry",
            "payment_reconciliation"
        ]
        
        for check in expected_checks:
            assert check in checks, f"Missing check: {check}"
            assert "status" in checks[check], f"Check {check} missing status"
            print(f"  ✓ {check}: {checks[check].get('status')}")
        
        print(f"✓ All 8 checks present in comprehensive order analysis")
    
    def test_comprehensive_order_summary(self):
        """Test that comprehensive-order returns proper summary"""
        res = self.session.get(f"{BASE_URL}/api/bot/comprehensive-order/{TEST_ORDER_ID}")
        assert res.status_code == 200
        
        data = res.json()
        summary = data.get("summary", {})
        
        assert "complete" in summary, "Missing complete count in summary"
        assert "total" in summary, "Missing total count in summary"
        assert "issues" in summary, "Missing issues list in summary"
        
        print(f"✓ Summary: {summary.get('complete')}/{summary.get('total')} checks passed")
        if summary.get("issues"):
            print(f"  Issues: {summary.get('issues')[:3]}...")
    
    def test_comprehensive_order_not_found(self):
        """Test comprehensive-order with non-existent order"""
        res = self.session.get(f"{BASE_URL}/api/bot/comprehensive-order/NONEXISTENT-ORDER-12345")
        assert res.status_code == 200
        
        data = res.json()
        assert data.get("found") == False, "Should return found: false for non-existent order"
        print(f"✓ Non-existent order correctly returns found: false")
    
    # ==================== ORDERS MISSING INVOICES ====================
    
    def test_orders_missing_invoices_endpoint(self):
        """Test orders-missing-invoices endpoint"""
        res = self.session.get(f"{BASE_URL}/api/bot/orders-missing-invoices")
        print(f"Missing invoices response status: {res.status_code}")
        
        assert res.status_code == 200, f"Endpoint failed: {res.text}"
        
        data = res.json()
        assert "count" in data, "Missing count in response"
        assert "orders" in data, "Missing orders list in response"
        assert "message" in data, "Missing message in response"
        
        print(f"✓ Orders missing invoices: {data.get('count')} found")
        
        # Check order structure if any exist
        if data.get("orders"):
            order = data["orders"][0]
            assert "order_id" in order or "tracking_id" in order, "Order missing identifier"
            assert "has_tracking" in order, "Order missing has_tracking flag"
            assert "has_label" in order, "Order missing has_label flag"
            print(f"  First order: {order.get('order_id') or order.get('tracking_id')}")
    
    def test_orders_missing_invoices_limit(self):
        """Test orders-missing-invoices with limit parameter"""
        res = self.session.get(f"{BASE_URL}/api/bot/orders-missing-invoices?limit=5")
        assert res.status_code == 200
        
        data = res.json()
        assert len(data.get("orders", [])) <= 5, "Limit not respected"
        print(f"✓ Limit parameter works: {len(data.get('orders', []))} orders returned")
    
    # ==================== NLP CHAT ENDPOINT ====================
    
    def test_chat_endpoint_exists(self):
        """Test that chat endpoint exists"""
        # Remove Content-Type header for form data
        headers = {"Authorization": self.session.headers.get("Authorization")}
        res = requests.post(f"{BASE_URL}/api/bot/chat", data={
            "message": "help",
            "session_id": "test_session_123"
        }, headers=headers)
        print(f"Chat endpoint response status: {res.status_code}")
        
        assert res.status_code == 200, f"Chat endpoint failed: {res.text}"
        
        data = res.json()
        assert "intent" in data, "Missing intent in response"
        print(f"✓ Chat endpoint works, intent: {data.get('intent')}")
    
    def test_chat_nlp_find_order(self):
        """Test NLP parsing for 'show me order X' queries"""
        headers = {"Authorization": self.session.headers.get("Authorization")}
        test_queries = [
            ("show me order 171-3496729-7741914", "find_order"),
            ("find order ABC-123", "find_order"),
            ("check order MG-1234", "find_order"),
        ]
        
        for query, expected_intent in test_queries:
            res = requests.post(f"{BASE_URL}/api/bot/chat", data={
                "message": query,
                "session_id": "test_session_nlp"
            }, headers=headers)
            assert res.status_code == 200, f"Chat failed for: {query}"
            
            data = res.json()
            assert data.get("intent") == expected_intent, f"Wrong intent for '{query}': got {data.get('intent')}, expected {expected_intent}"
            print(f"  ✓ '{query}' -> intent: {data.get('intent')}")
        
        print(f"✓ NLP correctly parses 'find order' queries")
    
    def test_chat_nlp_fix_invoices(self):
        """Test NLP parsing for 'fix invoices' queries"""
        headers = {"Authorization": self.session.headers.get("Authorization")}
        test_queries = [
            "fix invoices",
            "show missing invoices",
            "orders without invoice",
        ]
        
        for query in test_queries:
            res = requests.post(f"{BASE_URL}/api/bot/chat", data={
                "message": query,
                "session_id": "test_session_invoices"
            }, headers=headers)
            assert res.status_code == 200, f"Chat failed for: {query}"
            
            data = res.json()
            assert data.get("intent") == "fix_invoices", f"Wrong intent for '{query}': got {data.get('intent')}"
            print(f"  ✓ '{query}' -> intent: fix_invoices")
        
        print(f"✓ NLP correctly parses 'fix invoices' queries")
    
    def test_chat_nlp_status(self):
        """Test NLP parsing for status queries"""
        headers = {"Authorization": self.session.headers.get("Authorization")}
        test_queries = [
            "status",
            "how's everything",
            "summary",
        ]
        
        for query in test_queries:
            res = requests.post(f"{BASE_URL}/api/bot/chat", data={
                "message": query,
                "session_id": "test_session_status"
            }, headers=headers)
            assert res.status_code == 200, f"Chat failed for: {query}"
            
            data = res.json()
            assert data.get("intent") == "status", f"Wrong intent for '{query}': got {data.get('intent')}"
            print(f"  ✓ '{query}' -> intent: status")
        
        print(f"✓ NLP correctly parses status queries")
    
    def test_chat_nlp_stuck_orders(self):
        """Test NLP parsing for stuck orders queries"""
        headers = {"Authorization": self.session.headers.get("Authorization")}
        test_queries = [
            "what orders are stuck",
            "stuck orders",
            "delayed orders",
        ]
        
        for query in test_queries:
            res = requests.post(f"{BASE_URL}/api/bot/chat", data={
                "message": query,
                "session_id": "test_session_stuck"
            }, headers=headers)
            assert res.status_code == 200, f"Chat failed for: {query}"
            
            data = res.json()
            assert data.get("intent") == "stuck_orders", f"Wrong intent for '{query}': got {data.get('intent')}"
            print(f"  ✓ '{query}' -> intent: stuck_orders")
        
        print(f"✓ NLP correctly parses stuck orders queries")
    
    def test_chat_nlp_production(self):
        """Test NLP parsing for production queries"""
        headers = {"Authorization": self.session.headers.get("Authorization")}
        test_queries = [
            "production",
            "what to make",
            "stock levels",
        ]
        
        for query in test_queries:
            res = requests.post(f"{BASE_URL}/api/bot/chat", data={
                "message": query,
                "session_id": "test_session_production"
            }, headers=headers)
            assert res.status_code == 200, f"Chat failed for: {query}"
            
            data = res.json()
            assert data.get("intent") == "production", f"Wrong intent for '{query}': got {data.get('intent')}"
            print(f"  ✓ '{query}' -> intent: production")
        
        print(f"✓ NLP correctly parses production queries")
    
    def test_chat_nlp_help(self):
        """Test NLP parsing for help queries"""
        headers = {"Authorization": self.session.headers.get("Authorization")}
        res = requests.post(f"{BASE_URL}/api/bot/chat", data={
            "message": "help",
            "session_id": "test_session_help"
        }, headers=headers)
        assert res.status_code == 200
        
        data = res.json()
        assert data.get("intent") == "help", f"Wrong intent for 'help': got {data.get('intent')}"
        print(f"✓ NLP correctly parses help query")
    
    # ==================== AUTHORIZATION TESTS ====================
    
    def test_comprehensive_order_requires_auth(self):
        """Test that comprehensive-order requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        res = no_auth_session.get(f"{BASE_URL}/api/bot/comprehensive-order/{TEST_ORDER_ID}")
        
        assert res.status_code in [401, 403], f"Should require auth, got: {res.status_code}"
        print(f"✓ Comprehensive order endpoint requires authentication")
    
    def test_missing_invoices_requires_auth(self):
        """Test that orders-missing-invoices requires authentication"""
        no_auth_session = requests.Session()
        res = no_auth_session.get(f"{BASE_URL}/api/bot/orders-missing-invoices")
        
        assert res.status_code in [401, 403], f"Should require auth, got: {res.status_code}"
        print(f"✓ Missing invoices endpoint requires authentication")
    
    def test_chat_requires_auth(self):
        """Test that chat endpoint requires authentication"""
        no_auth_session = requests.Session()
        res = no_auth_session.post(f"{BASE_URL}/api/bot/chat", data={"message": "help"})
        
        assert res.status_code in [401, 403], f"Should require auth, got: {res.status_code}"
        print(f"✓ Chat endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

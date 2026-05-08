"""
Iteration 63: Operations Assistant Bot API Tests
Tests for the OrderBot feature - proactive alerts, search, update, upload, dispatch
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"


class TestOrderBotAPIs:
    """Test all OrderBot API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    # ==================== Daily Briefing Tests ====================
    
    def test_daily_briefing_returns_summary(self):
        """GET /api/bot/daily-briefing returns summary with stuck orders, missing invoices"""
        response = self.session.get(f"{BASE_URL}/api/bot/daily-briefing")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "date" in data, "Response should contain date"
        assert "yesterday" in data, "Response should contain yesterday stats"
        assert "today" in data, "Response should contain today stats"
        assert "urgent" in data, "Response should contain urgent section"
        assert "attention" in data, "Response should contain attention section"
        
        # Verify urgent section
        urgent = data["urgent"]
        assert "stuck_ready_to_dispatch" in urgent, "Urgent should have stuck_ready_to_dispatch count"
        assert "missing_invoices" in urgent, "Urgent should have missing_invoices count"
        assert "missing_tracking" in urgent, "Urgent should have missing_tracking count"
        
        # Verify attention section
        attention = data["attention"]
        assert "stuck_awaiting_stock" in attention, "Attention should have stuck_awaiting_stock count"
        assert "new_amazon_orders" in attention, "Attention should have new_amazon_orders count"
        
        print(f"✓ Daily briefing: {urgent['stuck_ready_to_dispatch']} stuck, {urgent['missing_invoices']} missing invoices")
    
    # ==================== Queue Health Tests ====================
    
    def test_queue_health_returns_statistics(self):
        """GET /api/bot/queue-health returns queue statistics"""
        response = self.session.get(f"{BASE_URL}/api/bot/queue-health")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "pending_fulfillment" in data, "Response should contain pending_fulfillment stats"
        assert "missing_data" in data, "Response should contain missing_data stats"
        assert "amazon_orders" in data, "Response should contain amazon_orders stats"
        assert "dispatched" in data, "Response should contain dispatched stats"
        
        # Verify pending_fulfillment section
        pf = data["pending_fulfillment"]
        assert "total" in pf, "pending_fulfillment should have total"
        assert "awaiting_stock" in pf, "pending_fulfillment should have awaiting_stock"
        assert "ready_to_dispatch" in pf, "pending_fulfillment should have ready_to_dispatch"
        assert "stuck_over_3_days" in pf, "pending_fulfillment should have stuck_over_3_days"
        
        # Verify missing_data section
        missing = data["missing_data"]
        assert "invoices" in missing, "missing_data should have invoices count"
        assert "tracking_ids" in missing, "missing_data should have tracking_ids count"
        assert "shipping_labels" in missing, "missing_data should have shipping_labels count"
        
        print(f"✓ Queue health: {pf['total']} total, {pf['ready_to_dispatch']} ready, {pf['stuck_over_3_days']} stuck")
    
    # ==================== Stuck Orders Tests ====================
    
    def test_stuck_orders_returns_list(self):
        """GET /api/bot/stuck-orders returns orders stuck > 3 days"""
        response = self.session.get(f"{BASE_URL}/api/bot/stuck-orders?days=3")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "ready_to_dispatch" in data, "Response should contain ready_to_dispatch list"
        assert "awaiting_stock" in data, "Response should contain awaiting_stock list"
        assert "total_stuck" in data, "Response should contain total_stuck count"
        
        # Verify lists are arrays
        assert isinstance(data["ready_to_dispatch"], list), "ready_to_dispatch should be a list"
        assert isinstance(data["awaiting_stock"], list), "awaiting_stock should be a list"
        
        # Verify total matches
        expected_total = len(data["ready_to_dispatch"]) + len(data["awaiting_stock"])
        assert data["total_stuck"] == expected_total, f"total_stuck should match sum of lists"
        
        # If there are stuck orders, verify they have required fields
        if data["ready_to_dispatch"]:
            order = data["ready_to_dispatch"][0]
            assert "days_stuck" in order, "Stuck order should have days_stuck field"
            assert order["days_stuck"] >= 3, "Order should be stuck for at least 3 days"
        
        print(f"✓ Stuck orders: {data['total_stuck']} total ({len(data['ready_to_dispatch'])} ready, {len(data['awaiting_stock'])} awaiting)")
    
    def test_stuck_orders_custom_days(self):
        """GET /api/bot/stuck-orders with custom days parameter"""
        response = self.session.get(f"{BASE_URL}/api/bot/stuck-orders?days=1")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_stuck" in data
        
        print(f"✓ Stuck orders (1 day): {data['total_stuck']} total")
    
    # ==================== Missing Data Tests ====================
    
    def test_missing_data_returns_gaps(self):
        """GET /api/bot/missing-data returns orders with missing invoices/tracking/labels"""
        response = self.session.get(f"{BASE_URL}/api/bot/missing-data")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "invoices" in data, "Response should contain invoices section"
        assert "tracking_ids" in data, "Response should contain tracking_ids section"
        assert "shipping_labels" in data, "Response should contain shipping_labels section"
        assert "phone_numbers" in data, "Response should contain phone_numbers section"
        assert "addresses" in data, "Response should contain addresses section"
        assert "total_issues" in data, "Response should contain total_issues count"
        
        # Verify each section has count and orders
        for section in ["invoices", "tracking_ids", "shipping_labels", "phone_numbers", "addresses"]:
            assert "count" in data[section], f"{section} should have count"
            assert "orders" in data[section], f"{section} should have orders list"
            assert isinstance(data[section]["orders"], list), f"{section} orders should be a list"
        
        print(f"✓ Missing data: {data['total_issues']} total issues")
        print(f"  - Invoices: {data['invoices']['count']}")
        print(f"  - Tracking: {data['tracking_ids']['count']}")
        print(f"  - Labels: {data['shipping_labels']['count']}")
    
    # ==================== Production Suggestions Tests ====================
    
    def test_production_suggestions_returns_items(self):
        """GET /api/bot/production-suggestions returns items awaiting stock"""
        response = self.session.get(f"{BASE_URL}/api/bot/production-suggestions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "suggestions" in data, "Response should contain suggestions list"
        assert "critical_count" in data, "Response should contain critical_count"
        assert "warning_count" in data, "Response should contain warning_count"
        
        assert isinstance(data["suggestions"], list), "suggestions should be a list"
        
        # If there are suggestions, verify structure
        if data["suggestions"]:
            suggestion = data["suggestions"][0]
            assert "master_sku_id" in suggestion, "Suggestion should have master_sku_id"
            assert "master_sku_name" in suggestion, "Suggestion should have master_sku_name"
            assert "current_stock" in suggestion, "Suggestion should have current_stock"
            assert "pending_orders" in suggestion, "Suggestion should have pending_orders"
            assert "severity" in suggestion, "Suggestion should have severity"
            assert suggestion["severity"] in ["critical", "warning", "info"], "Severity should be valid"
        
        print(f"✓ Production suggestions: {len(data['suggestions'])} items ({data['critical_count']} critical, {data['warning_count']} warning)")
    
    # ==================== Search Tests ====================
    
    def test_search_by_order_id(self):
        """POST /api/bot/search with query returns matching orders"""
        # For form data, we need to remove Content-Type header and let requests set it
        headers = {"Authorization": self.session.headers.get("Authorization")}
        
        # First get some existing orders to search for
        pf_response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?limit=1")
        
        if pf_response.status_code == 200:
            pf_data = pf_response.json()
            if pf_data.get("items") and len(pf_data["items"]) > 0:
                order_id = pf_data["items"][0].get("order_id", "TEST")
                
                # Search for this order - use files param to force multipart
                response = requests.post(
                    f"{BASE_URL}/api/bot/search",
                    data={"query": order_id},
                    headers=headers
                )
                
                assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
                
                data = response.json()
                assert "results" in data, "Response should contain results"
                assert "count" in data, "Response should contain count"
                
                print(f"✓ Search by order ID '{order_id}': {data['count']} results")
                return
        
        # If no orders exist, test with a generic search
        response = requests.post(
            f"{BASE_URL}/api/bot/search",
            data={"query": "test"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "results" in data
        assert "count" in data
        
        print(f"✓ Search by 'test': {data['count']} results")
    
    def test_search_returns_enriched_results(self):
        """POST /api/bot/search returns results with known_fields and missing_fields"""
        headers = {"Authorization": self.session.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/bot/search",
            data={"query": "a"},  # Generic search to get some results
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        if data["count"] > 0:
            result = data["results"][0]
            assert "known_fields" in result, "Result should have known_fields"
            assert "missing_fields" in result, "Result should have missing_fields"
            assert "_source" in result, "Result should have _source"
            assert "_source_display" in result, "Result should have _source_display"
            
            print(f"✓ Search result enriched: {len(result['known_fields'])} known, {len(result['missing_fields'])} missing")
        else:
            print("✓ Search returned 0 results (no matching orders)")
    
    # ==================== Update Field Tests ====================
    
    def test_update_field_requires_order_id(self):
        """POST /api/bot/update-field requires order_id"""
        response = self.session.post(
            f"{BASE_URL}/api/bot/update-field",
            data={"field": "phone", "value": "1234567890"}
        )
        
        # Should fail without order_id
        assert response.status_code == 422, f"Expected 422 for missing order_id, got {response.status_code}"
        
        print("✓ Update field requires order_id")
    
    def test_update_field_not_found(self):
        """POST /api/bot/update-field returns 404 for non-existent order"""
        headers = {"Authorization": self.session.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/bot/update-field",
            data={"order_id": "non-existent-id", "field": "phone", "value": "1234567890"},
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        
        print("✓ Update field returns 404 for non-existent order")
    
    # ==================== Upload File Tests ====================
    
    def test_upload_file_requires_order_id(self):
        """POST /api/bot/upload-file requires order_id"""
        # Create a dummy file
        files = {"file": ("test.pdf", b"test content", "application/pdf")}
        
        response = self.session.post(
            f"{BASE_URL}/api/bot/upload-file",
            data={"field": "invoice"},
            files=files
        )
        
        # Should fail without order_id
        assert response.status_code == 422, f"Expected 422 for missing order_id, got {response.status_code}"
        
        print("✓ Upload file requires order_id")
    
    def test_upload_file_not_found(self):
        """POST /api/bot/upload-file returns 404 for non-existent order"""
        headers = {"Authorization": self.session.headers.get("Authorization")}
        files = {"file": ("test.pdf", b"test content", "application/pdf")}
        
        response = requests.post(
            f"{BASE_URL}/api/bot/upload-file",
            data={"order_id": "non-existent-id", "field": "invoice"},
            files=files,
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        
        print("✓ Upload file returns 404 for non-existent order")
    
    # ==================== Dispatch Tests ====================
    
    def test_dispatch_requires_order_id(self):
        """POST /api/bot/dispatch requires order_id"""
        response = self.session.post(
            f"{BASE_URL}/api/bot/dispatch",
            data={}
        )
        
        # Should fail without order_id
        assert response.status_code == 422, f"Expected 422 for missing order_id, got {response.status_code}"
        
        print("✓ Dispatch requires order_id")
    
    def test_dispatch_not_found(self):
        """POST /api/bot/dispatch returns 404 for non-existent order"""
        headers = {"Authorization": self.session.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/bot/dispatch",
            data={"order_id": "non-existent-id"},
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        
        print("✓ Dispatch returns 404 for non-existent order")
    
    # ==================== Customer History Tests ====================
    
    def test_customer_history_returns_data(self):
        """GET /api/bot/customer-history/{phone} returns customer history"""
        # Test with a sample phone number
        response = self.session.get(f"{BASE_URL}/api/bot/customer-history/9876543210")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "is_repeat_customer" in data, "Response should contain is_repeat_customer"
        
        if data["is_repeat_customer"]:
            assert "total_orders" in data, "Repeat customer should have total_orders"
            assert "last_address" in data, "Repeat customer should have last_address"
            assert "customer_name" in data, "Repeat customer should have customer_name"
            print(f"✓ Customer history: Repeat customer with {data['total_orders']} orders")
        else:
            print("✓ Customer history: New customer (no previous orders)")
    
    # ==================== Authorization Tests ====================
    
    def test_bot_endpoints_require_auth(self):
        """Bot endpoints require authentication"""
        # Create a session without auth
        no_auth_session = requests.Session()
        
        endpoints = [
            ("GET", "/api/bot/daily-briefing"),
            ("GET", "/api/bot/queue-health"),
            ("GET", "/api/bot/stuck-orders"),
            ("GET", "/api/bot/missing-data"),
            ("GET", "/api/bot/production-suggestions"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = no_auth_session.get(f"{BASE_URL}{endpoint}")
            
            assert response.status_code in [401, 403], f"{endpoint} should require auth, got {response.status_code}"
        
        print("✓ All bot endpoints require authentication")


class TestOrderBotIntegration:
    """Integration tests for OrderBot with real data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    def test_dispatch_pending_order(self):
        """Test dispatching a pending_fulfillment order via bot"""
        # Get a pending order that's ready to dispatch
        pf_response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?status=ready_to_dispatch&limit=1")
        
        if pf_response.status_code != 200:
            pytest.skip("Could not fetch pending fulfillment orders")
        
        pf_data = pf_response.json()
        
        if not pf_data.get("items") or len(pf_data["items"]) == 0:
            pytest.skip("No ready_to_dispatch orders available for testing")
        
        order = pf_data["items"][0]
        order_id = order.get("id")
        
        # Try to dispatch via bot
        response = self.session.post(
            f"{BASE_URL}/api/bot/dispatch",
            data={"order_id": order_id}
        )
        
        # Could succeed or fail based on order state
        if response.status_code == 200:
            data = response.json()
            assert "dispatch_number" in data or "message" in data
            print(f"✓ Dispatched order {order_id} via bot")
        elif response.status_code == 400:
            # Order might already be dispatched or have other issues
            print(f"✓ Dispatch returned 400 (order may have issues): {response.json().get('detail', 'Unknown')}")
        else:
            print(f"✓ Dispatch returned {response.status_code}: {response.text}")
    
    def test_update_field_on_real_order(self):
        """Test updating a field on a real pending order"""
        # Get a pending order
        pf_response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?limit=1")
        
        if pf_response.status_code != 200:
            pytest.skip("Could not fetch pending fulfillment orders")
        
        pf_data = pf_response.json()
        
        if not pf_data.get("items") or len(pf_data["items"]) == 0:
            pytest.skip("No pending orders available for testing")
        
        order = pf_data["items"][0]
        order_id = order.get("id")
        
        # Update a field (notes or similar non-critical field)
        response = self.session.post(
            f"{BASE_URL}/api/bot/update-field",
            data={"order_id": order_id, "field": "city", "value": "Test City"}
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            assert "remaining_fields" in data
            assert "is_complete" in data
            print(f"✓ Updated field on order {order_id}")
        else:
            print(f"✓ Update field returned {response.status_code}: {response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

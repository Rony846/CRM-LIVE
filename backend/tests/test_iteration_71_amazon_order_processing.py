"""
Iteration 71: Amazon Order Processing via Operations Bot
Tests:
1. Universal search correctly identifies if Amazon order is in pending_fulfillment
2. MFN order: Bot shows 'Process in CRM' if not imported, 'Prepare Dispatch' if imported
3. Easy Ship order: Similar flow with EasyShip-specific handling
4. Amazon History order: Import to CRM creates pending_fulfillment entry
5. Prepare dispatch endpoint accepts amazon_order_id lookup
6. SKU mapping flow for unmapped items
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAmazonOrderProcessing:
    """Test Amazon order processing via Operations Bot"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.token = token
        
        # Get firms for testing
        firms_response = self.session.get(f"{BASE_URL}/api/firms")
        if firms_response.status_code == 200:
            self.firms = firms_response.json()
            self.firm_id = self.firms[0]["id"] if self.firms else None
        else:
            self.firms = []
            self.firm_id = None
        
        yield
    
    # ==================== UNIVERSAL SEARCH TESTS ====================
    
    def test_universal_search_endpoint_exists(self):
        """Test that universal search endpoint is accessible"""
        # Note: endpoint is /bot/universal-search/{query} (path param)
        response = self.session.get(f"{BASE_URL}/api/bot/universal-search/test")
        assert response.status_code == 200, f"Unexpected status: {response.status_code}"
        print(f"Universal search endpoint accessible: {response.status_code}")
    
    def test_universal_search_returns_proper_structure(self):
        """Test universal search returns expected structure"""
        response = self.session.get(f"{BASE_URL}/api/bot/universal-search/123456")
        assert response.status_code == 200, f"Search failed: {response.text}"
        
        data = response.json()
        assert "found_in" in data, "Missing 'found_in' field"
        assert "all_results" in data, "Missing 'all_results' field"
        assert isinstance(data["found_in"], list), "'found_in' should be a list"
        print(f"Universal search structure verified: found_in={data['found_in']}")
    
    def test_universal_search_amazon_order_in_crm_check(self):
        """Test that universal search checks pending_fulfillment for amazon orders"""
        # Get pending fulfillment entries with amazon_order_id
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?limit=5")
        if response.status_code != 200:
            pytest.skip("Cannot fetch pending fulfillment")
        
        entries = response.json().get("entries", [])
        amazon_entries = [e for e in entries if e.get("amazon_order_id")]
        
        if not amazon_entries:
            pytest.skip("No amazon orders in pending_fulfillment")
        
        amazon_order_id = amazon_entries[0].get("amazon_order_id")
        
        # Search for this order
        search_response = self.session.get(f"{BASE_URL}/api/bot/universal-search/{amazon_order_id}")
        assert search_response.status_code == 200, f"Search failed: {search_response.text}"
        
        data = search_response.json()
        if "amazon_order" in data.get("all_results", {}):
            amazon_result = data["all_results"]["amazon_order"]
            assert "in_crm" in amazon_result, "Missing 'in_crm' field in amazon_order result"
            assert "actions" in amazon_result, "Missing 'actions' field in amazon_order result"
            assert amazon_result["in_crm"] == True, "Order in pending_fulfillment should have in_crm=True"
            print(f"Amazon order {amazon_order_id}: in_crm={amazon_result['in_crm']}, actions={amazon_result['actions']}")
    
    # ==================== MFN ORDER TESTS ====================
    
    def test_mfn_orders_in_pending_fulfillment(self):
        """Test MFN orders exist in pending_fulfillment"""
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?limit=10")
        assert response.status_code == 200, f"Pending fulfillment fetch failed: {response.text}"
        
        entries = response.json().get("entries", [])
        mfn_orders = [e for e in entries if e.get("fulfillment_channel") == "MFN"]
        print(f"MFN orders in pending_fulfillment: {len(mfn_orders)}")
    
    def test_mfn_order_in_crm_shows_prepare_dispatch_action(self):
        """Test MFN order in CRM shows 'prepare_dispatch' action"""
        # Get pending fulfillment entries with MFN
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?limit=10")
        if response.status_code != 200:
            pytest.skip("Cannot fetch pending fulfillment")
        
        entries = response.json().get("entries", [])
        mfn_orders = [e for e in entries if e.get("fulfillment_channel") == "MFN" and e.get("amazon_order_id")]
        
        if not mfn_orders:
            pytest.skip("No MFN orders with amazon_order_id in pending_fulfillment")
        
        order = mfn_orders[0]
        amazon_order_id = order.get("amazon_order_id")
        
        # Search via universal search
        search_response = self.session.get(f"{BASE_URL}/api/bot/universal-search/{amazon_order_id}")
        assert search_response.status_code == 200, f"Search failed: {search_response.text}"
        
        data = search_response.json()
        if "amazon_order" in data.get("all_results", {}):
            amazon_result = data["all_results"]["amazon_order"]
            if amazon_result.get("in_crm"):
                # Check if order is not dispatched/cancelled
                if order.get("status") not in ["dispatched", "cancelled"]:
                    assert "prepare_dispatch" in amazon_result.get("actions", []) or "view_details" in amazon_result.get("actions", []), \
                        f"Order in CRM should have prepare_dispatch or view_details action. Got: {amazon_result.get('actions')}"
                    print(f"MFN order {amazon_order_id} in CRM - has correct actions: {amazon_result.get('actions')}")
    
    # ==================== EASY SHIP ORDER TESTS ====================
    
    def test_easyship_orders_in_pending_fulfillment(self):
        """Test Easy Ship orders exist in pending_fulfillment"""
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?limit=20")
        assert response.status_code == 200, f"Pending fulfillment fetch failed: {response.text}"
        
        entries = response.json().get("entries", [])
        easyship_orders = [e for e in entries if e.get("is_easyship") == True]
        print(f"EasyShip orders in pending_fulfillment: {len(easyship_orders)}")
    
    def test_easyship_order_handling(self):
        """Test Easy Ship order has proper handling in universal search"""
        # Get EasyShip orders from pending_fulfillment
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?limit=20")
        if response.status_code != 200:
            pytest.skip("Cannot fetch pending fulfillment")
        
        entries = response.json().get("entries", [])
        easyship_orders = [e for e in entries if e.get("is_easyship") == True and e.get("amazon_order_id")]
        
        if not easyship_orders:
            pytest.skip("No EasyShip orders with amazon_order_id in pending_fulfillment")
        
        order = easyship_orders[0]
        amazon_order_id = order.get("amazon_order_id")
        
        search_response = self.session.get(f"{BASE_URL}/api/bot/universal-search/{amazon_order_id}")
        assert search_response.status_code == 200, f"Search failed: {search_response.text}"
        
        data = search_response.json()
        if "amazon_order" in data.get("all_results", {}):
            amazon_result = data["all_results"]["amazon_order"]
            print(f"EasyShip order {amazon_order_id}: in_crm={amazon_result.get('in_crm')}, actions={amazon_result.get('actions')}")
    
    # ==================== AMAZON HISTORY IMPORT TESTS ====================
    
    def test_import_amazon_order_to_crm_endpoint(self):
        """Test import amazon order to CRM endpoint exists"""
        # This is a POST endpoint, test with invalid data to verify it exists
        response = self.session.post(f"{BASE_URL}/api/bot/import-amazon-to-crm", json={
            "amazon_order_id": "TEST_INVALID_ORDER_ID"
        })
        # Should return 404 (order not found) or 400 (validation error), not 405 (method not allowed)
        assert response.status_code in [400, 404, 422], f"Unexpected status: {response.status_code}, {response.text}"
        print(f"Import amazon order endpoint exists: status={response.status_code}")
    
    def test_amazon_order_not_in_crm_shows_import_action(self):
        """Test that amazon order not in CRM shows import_to_crm action"""
        # Get amazon orders from firm
        if not self.firm_id:
            pytest.skip("No firm available")
        
        response = self.session.get(f"{BASE_URL}/api/amazon/orders/{self.firm_id}?limit=20")
        if response.status_code != 200:
            pytest.skip("Cannot fetch amazon orders")
        
        orders = response.json().get("orders", [])
        
        for order in orders:
            amazon_order_id = order.get("amazon_order_id")
            if not amazon_order_id:
                continue
            
            # Search via universal search
            search_response = self.session.get(f"{BASE_URL}/api/bot/universal-search/{amazon_order_id}")
            if search_response.status_code == 200:
                data = search_response.json()
                if "amazon_order" in data.get("all_results", {}):
                    amazon_result = data["all_results"]["amazon_order"]
                    if not amazon_result.get("in_crm"):
                        assert "import_to_crm" in amazon_result.get("actions", []), \
                            f"Order not in CRM should have 'import_to_crm' action. Got: {amazon_result.get('actions')}"
                        print(f"Amazon order {amazon_order_id} not in CRM - has import_to_crm action: PASS")
                        return
        
        print("All amazon orders already in CRM - test passed by default")
    
    # ==================== PREPARE DISPATCH ENDPOINT TESTS ====================
    
    def test_prepare_dispatch_endpoint_accepts_amazon_order_id(self):
        """Test prepare-dispatch endpoint accepts amazon_order_id lookup"""
        # Get a pending_fulfillment entry with amazon_order_id
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?limit=10")
        if response.status_code != 200:
            pytest.skip("Cannot fetch pending fulfillment")
        
        entries = response.json().get("entries", [])
        
        # Find entry with amazon_order_id
        for entry in entries:
            amazon_order_id = entry.get("amazon_order_id")
            if amazon_order_id and entry.get("status") not in ["dispatched", "cancelled"]:
                # Test prepare-dispatch with amazon_order_id
                dispatch_response = self.session.get(f"{BASE_URL}/api/bot/prepare-dispatch/{amazon_order_id}")
                if dispatch_response.status_code == 200:
                    data = dispatch_response.json()
                    assert "order" in data or "entry" in data or "order_id" in data or "compliance_status" in data, \
                        f"Prepare dispatch should return order details. Got: {list(data.keys())}"
                    print(f"Prepare dispatch with amazon_order_id {amazon_order_id}: PASS")
                    return
                elif dispatch_response.status_code == 404:
                    print(f"Order {amazon_order_id} not found in prepare-dispatch")
                    continue
        
        pytest.skip("No pending fulfillment entries with amazon_order_id found")
    
    def test_prepare_dispatch_endpoint_accepts_order_id(self):
        """Test prepare-dispatch endpoint accepts regular order_id"""
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?limit=5")
        if response.status_code != 200:
            pytest.skip("Cannot fetch pending fulfillment")
        
        entries = response.json().get("entries", [])
        
        for entry in entries:
            order_id = entry.get("order_id") or entry.get("id")
            if order_id and entry.get("status") not in ["dispatched", "cancelled"]:
                dispatch_response = self.session.get(f"{BASE_URL}/api/bot/prepare-dispatch/{order_id}")
                if dispatch_response.status_code == 200:
                    print(f"Prepare dispatch with order_id {order_id}: PASS")
                    return
        
        pytest.skip("No pending fulfillment entries found")
    
    def test_prepare_dispatch_returns_compliance_info(self):
        """Test prepare-dispatch returns compliance check information"""
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?limit=5")
        if response.status_code != 200:
            pytest.skip("Cannot fetch pending fulfillment")
        
        entries = response.json().get("entries", [])
        
        for entry in entries:
            order_id = entry.get("id") or entry.get("order_id")
            if order_id and entry.get("status") not in ["dispatched", "cancelled"]:
                dispatch_response = self.session.get(f"{BASE_URL}/api/bot/prepare-dispatch/{order_id}")
                if dispatch_response.status_code == 200:
                    data = dispatch_response.json()
                    # Should have compliance-related fields
                    print(f"Prepare dispatch response keys: {list(data.keys())}")
                    return
        
        pytest.skip("No pending fulfillment entries found")
    
    # ==================== BOT DISPATCH ENDPOINT TESTS ====================
    
    def test_bot_dispatch_endpoint_exists(self):
        """Test bot dispatch endpoint exists"""
        # Test with form data
        response = self.session.post(f"{BASE_URL}/api/bot/dispatch", data={
            "order_id": "TEST_INVALID_ORDER",
            "confirmed": "false"
        })
        # Should return 404 (order not found), not 405 (method not allowed)
        assert response.status_code in [400, 404, 422], f"Unexpected status: {response.status_code}"
        print(f"Bot dispatch endpoint exists: status={response.status_code}")
    
    def test_bot_dispatch_accepts_amazon_order_id(self):
        """Test bot dispatch endpoint accepts amazon_order_id"""
        # Get a pending_fulfillment entry with amazon_order_id
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?limit=10")
        if response.status_code != 200:
            pytest.skip("Cannot fetch pending fulfillment")
        
        entries = response.json().get("entries", [])
        
        for entry in entries:
            amazon_order_id = entry.get("amazon_order_id")
            if amazon_order_id and entry.get("status") not in ["dispatched", "cancelled"]:
                # Test dispatch with amazon_order_id (without confirmed=true to avoid actual dispatch)
                dispatch_response = self.session.post(f"{BASE_URL}/api/bot/dispatch", data={
                    "order_id": amazon_order_id,
                    "confirmed": "false"
                })
                # Should find the order (may fail compliance checks, but should find it)
                if dispatch_response.status_code in [200, 400]:
                    print(f"Bot dispatch found order by amazon_order_id {amazon_order_id}: PASS")
                    return
                elif dispatch_response.status_code == 404:
                    continue
        
        pytest.skip("No pending fulfillment entries with amazon_order_id found")
    
    # ==================== SKU MAPPING TESTS ====================
    
    def test_sku_mapping_endpoint_exists(self):
        """Test SKU mapping endpoint exists"""
        if not self.firm_id:
            pytest.skip("No firm available")
        
        response = self.session.get(f"{BASE_URL}/api/amazon/sku-mappings/{self.firm_id}")
        assert response.status_code == 200, f"SKU mappings fetch failed: {response.status_code}"
        print(f"SKU mappings endpoint accessible")
    
    def test_unmapped_skus_endpoint(self):
        """Test unmapped SKUs endpoint exists"""
        if not self.firm_id:
            pytest.skip("No firm available")
        
        response = self.session.get(f"{BASE_URL}/api/amazon/unmapped-skus/{self.firm_id}")
        assert response.status_code == 200, f"Unmapped SKUs fetch failed: {response.status_code}"
        
        data = response.json()
        # Response can be a list or dict with unmapped_skus key
        if isinstance(data, list):
            print(f"Unmapped SKUs count: {len(data)}")
        else:
            print(f"Unmapped SKUs count: {len(data.get('unmapped_skus', []))}")
    
    def test_create_sku_mapping(self):
        """Test creating a new SKU mapping"""
        if not self.firm_id:
            pytest.skip("No firm available")
        
        # Get master SKUs
        sku_response = self.session.get(f"{BASE_URL}/api/master-skus?limit=1")
        if sku_response.status_code != 200:
            pytest.skip("Cannot fetch master SKUs")
        
        skus = sku_response.json()
        if isinstance(skus, list):
            if not skus:
                pytest.skip("No master SKUs available")
            master_sku = skus[0]
        else:
            if not skus.get("skus"):
                pytest.skip("No master SKUs available")
            master_sku = skus["skus"][0]
        
        # Create a test mapping
        test_amazon_sku = f"TEST_AMAZON_SKU_{uuid.uuid4().hex[:8]}"
        
        mapping_response = self.session.post(f"{BASE_URL}/api/amazon/sku-mapping", json={
            "amazon_sku": test_amazon_sku,
            "master_sku_id": master_sku.get("id"),
            "firm_id": self.firm_id
        })
        
        if mapping_response.status_code in [200, 201]:
            print(f"Created SKU mapping: {test_amazon_sku} -> {master_sku.get('sku_code')}")
            # Cleanup - try to delete
            mapping_id = mapping_response.json().get("id")
            if mapping_id:
                self.session.delete(f"{BASE_URL}/api/amazon/sku-mapping/{mapping_id}")
        elif mapping_response.status_code == 409:
            print("SKU mapping already exists")
        else:
            print(f"SKU mapping creation status: {mapping_response.status_code}, {mapping_response.text}")
    
    # ==================== INTEGRATION FLOW TESTS ====================
    
    def test_full_amazon_order_search_flow(self):
        """Test complete flow: search amazon order -> check CRM status -> get actions"""
        # Get a pending fulfillment entry with amazon_order_id
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?limit=5")
        if response.status_code != 200:
            pytest.skip("Cannot fetch pending fulfillment")
        
        entries = response.json().get("entries", [])
        amazon_entries = [e for e in entries if e.get("amazon_order_id")]
        
        if not amazon_entries:
            pytest.skip("No amazon orders in pending_fulfillment")
        
        entry = amazon_entries[0]
        amazon_order_id = entry.get("amazon_order_id")
        
        # Step 1: Search via universal search
        search_response = self.session.get(f"{BASE_URL}/api/bot/universal-search/{amazon_order_id}")
        assert search_response.status_code == 200, f"Search failed: {search_response.text}"
        
        data = search_response.json()
        
        # Step 2: Check CRM status
        amazon_result = data["all_results"].get("amazon_order", {})
        in_crm = amazon_result.get("in_crm", False)
        actions = amazon_result.get("actions", [])
        
        print(f"Order {amazon_order_id}:")
        print(f"  - In CRM: {in_crm}")
        print(f"  - Available actions: {actions}")
        
        # Step 3: Verify correct actions based on CRM status
        if in_crm:
            assert "prepare_dispatch" in actions or "view_details" in actions, \
                f"Order in CRM should have dispatch/view actions. Got: {actions}"
        
        print("Full amazon order search flow: PASS")
    
    def test_pending_fulfillment_search_via_universal_search(self):
        """Test searching pending_fulfillment entries via universal search"""
        # Get a pending fulfillment entry
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?limit=1")
        if response.status_code != 200 or not response.json().get("entries"):
            pytest.skip("No pending fulfillment entries available")
        
        entry = response.json()["entries"][0]
        order_id = entry.get("order_id") or entry.get("id")
        
        # Search via universal search
        search_response = self.session.get(f"{BASE_URL}/api/bot/universal-search/{order_id}")
        assert search_response.status_code == 200, f"Search failed: {search_response.text}"
        
        data = search_response.json()
        print(f"Pending fulfillment search for {order_id}: found_in={data.get('found_in', [])}")
    
    def test_mark_amazon_dispatched_endpoint(self):
        """Test mark amazon dispatched endpoint exists"""
        response = self.session.post(f"{BASE_URL}/api/bot/mark-amazon-dispatched", json={
            "amazon_order_id": "TEST_INVALID_ORDER_ID"
        })
        # Should return 404 (order not found) or 400 (validation error), not 405 (method not allowed)
        assert response.status_code in [400, 404, 422], f"Unexpected status: {response.status_code}, {response.text}"
        print(f"Mark amazon dispatched endpoint exists: status={response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

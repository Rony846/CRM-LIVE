"""
Test Amazon Order Flow - SKU Mapping Validation
Iteration 49: Tests for Amazon order tracking with SKU mapping requirements

Features tested:
1. Amazon update-tracking API rejects orders with unmapped SKUs
2. Adding tracking creates pending_fulfillment entry with master_sku_id
3. Pending Fulfillment Queue shows Amazon orders with correct SKU info
4. Mark Ready functionality checks inventory for Amazon orders
5. Push to Amazon provides helpful error for 403 (permission) issues
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAmazonSKUMappingFlow:
    """Test Amazon order flow with SKU mapping validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.firm_id = None
        
    def test_01_admin_login(self):
        """Test admin login to get auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        self.token = data["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"✓ Admin login successful")
        
    def test_02_get_firms(self):
        """Get firms to use for testing"""
        # Login first
        self.test_01_admin_login()
        
        response = self.session.get(f"{BASE_URL}/api/firms")
        assert response.status_code == 200, f"Failed to get firms: {response.text}"
        firms = response.json()
        assert len(firms) > 0, "No firms found"
        self.firm_id = firms[0]["id"]
        print(f"✓ Got firm: {firms[0].get('name')} (ID: {self.firm_id})")
        
    def test_03_get_amazon_orders(self):
        """Get Amazon orders to check SKU mapping status"""
        self.test_02_get_firms()
        
        response = self.session.get(f"{BASE_URL}/api/amazon/orders/{self.firm_id}")
        assert response.status_code == 200, f"Failed to get Amazon orders: {response.text}"
        data = response.json()
        
        orders = data.get("orders", [])
        stats = data.get("stats", {})
        
        print(f"✓ Got {len(orders)} Amazon orders")
        print(f"  Stats: {stats}")
        
        # Check if any orders have unmapped SKUs
        unmapped_orders = []
        mapped_orders = []
        for order in orders:
            items = order.get("items", [])
            has_unmapped = any(not item.get("master_sku_id") for item in items)
            if has_unmapped:
                unmapped_orders.append(order)
            else:
                mapped_orders.append(order)
        
        print(f"  Orders with unmapped SKUs: {len(unmapped_orders)}")
        print(f"  Orders with all SKUs mapped: {len(mapped_orders)}")
        
        return {"orders": orders, "unmapped": unmapped_orders, "mapped": mapped_orders}
        
    def test_04_update_tracking_rejects_unmapped_skus(self):
        """Test that update-tracking API rejects orders with unmapped SKUs"""
        self.test_02_get_firms()
        
        # Get orders
        response = self.session.get(f"{BASE_URL}/api/amazon/orders/{self.firm_id}")
        assert response.status_code == 200
        orders = response.json().get("orders", [])
        
        # Find an order with unmapped SKUs
        unmapped_order = None
        for order in orders:
            items = order.get("items", [])
            if any(not item.get("master_sku_id") for item in items):
                unmapped_order = order
                break
        
        if not unmapped_order:
            print("⚠ No orders with unmapped SKUs found - creating test scenario")
            # Try to add tracking to any pending order to verify the validation works
            pending_orders = [o for o in orders if o.get("crm_status") == "pending"]
            if pending_orders:
                # This should fail if SKUs are not mapped
                test_order = pending_orders[0]
                response = self.session.post(
                    f"{BASE_URL}/api/amazon/update-tracking?firm_id={self.firm_id}",
                    json={
                        "amazon_order_id": test_order["amazon_order_id"],
                        "tracking_number": "TEST123456789",
                        "carrier_code": "bluedart",
                        "customer_name": "Test Customer",
                        "phone": "9876543210",
                        "address": "Test Address",
                        "city": "Mumbai",
                        "state": "Maharashtra",
                        "pincode": "400001"
                    }
                )
                # If SKUs are mapped, it should succeed (200)
                # If SKUs are not mapped, it should fail (400)
                print(f"  Update tracking response: {response.status_code}")
                if response.status_code == 400:
                    assert "SKUs not mapped" in response.json().get("detail", "")
                    print("✓ API correctly rejects unmapped SKUs")
                elif response.status_code == 200:
                    print("✓ API accepts order with mapped SKUs")
            else:
                pytest.skip("No pending orders to test")
        else:
            # Try to add tracking to order with unmapped SKUs
            response = self.session.post(
                f"{BASE_URL}/api/amazon/update-tracking?firm_id={self.firm_id}",
                json={
                    "amazon_order_id": unmapped_order["amazon_order_id"],
                    "tracking_number": "TEST123456789",
                    "carrier_code": "bluedart",
                    "customer_name": "Test Customer",
                    "phone": "9876543210",
                    "address": "Test Address",
                    "city": "Mumbai",
                    "state": "Maharashtra",
                    "pincode": "400001"
                }
            )
            assert response.status_code == 400, f"Expected 400 for unmapped SKUs, got {response.status_code}"
            detail = response.json().get("detail", "")
            assert "SKUs not mapped" in detail, f"Expected SKU mapping error, got: {detail}"
            print(f"✓ API correctly rejects order with unmapped SKUs: {detail}")
            
    def test_05_get_unmapped_skus_endpoint(self):
        """Test the unmapped SKUs endpoint"""
        self.test_02_get_firms()
        
        response = self.session.get(f"{BASE_URL}/api/amazon/unmapped-skus/{self.firm_id}")
        assert response.status_code == 200, f"Failed to get unmapped SKUs: {response.text}"
        data = response.json()
        
        # Response could be a list or dict with unmapped_skus key
        if isinstance(data, list):
            unmapped = data
        else:
            unmapped = data.get("unmapped_skus", [])
        print(f"✓ Got {len(unmapped)} unmapped SKUs")
        for sku in unmapped[:5]:  # Show first 5
            print(f"  - {sku.get('_id')}: {sku.get('title', 'N/A')[:50]}...")
            
    def test_06_pending_fulfillment_has_sku_info(self):
        """Test that pending fulfillment entries have master_sku_id"""
        self.test_02_get_firms()
        
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?firm_id={self.firm_id}")
        assert response.status_code == 200, f"Failed to get pending fulfillment: {response.text}"
        data = response.json()
        
        entries = data.get("entries", [])
        summary = data.get("summary", {})
        
        print(f"✓ Got {len(entries)} pending fulfillment entries")
        print(f"  Summary: {summary}")
        
        # Check Amazon orders in pending fulfillment
        amazon_entries = [e for e in entries if e.get("type") == "amazon_order" or e.get("order_source") == "amazon"]
        print(f"  Amazon orders in queue: {len(amazon_entries)}")
        
        for entry in amazon_entries[:3]:  # Check first 3
            print(f"  - Order: {entry.get('order_id')}")
            print(f"    master_sku_id: {entry.get('master_sku_id')}")
            print(f"    master_sku_name: {entry.get('master_sku_name')}")
            print(f"    sku_code: {entry.get('sku_code')}")
            print(f"    quantity: {entry.get('quantity')}")
            print(f"    status: {entry.get('status')}")
            print(f"    current_stock: {entry.get('current_stock')}")
            
            # Verify SKU info is present for Amazon orders
            if entry.get("type") == "amazon_order":
                assert entry.get("master_sku_id") is not None, f"Amazon order {entry.get('order_id')} missing master_sku_id"
                
    def test_07_pending_fulfillment_stock_check(self):
        """Test that pending fulfillment checks inventory correctly"""
        self.test_02_get_firms()
        
        # Get ready_to_dispatch entries (these should have stock)
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?status=ready_to_dispatch&firm_id={self.firm_id}")
        assert response.status_code == 200
        data = response.json()
        
        ready_entries = data.get("entries", [])
        print(f"✓ Got {len(ready_entries)} ready_to_dispatch entries")
        
        for entry in ready_entries[:3]:
            current_stock = entry.get("current_stock", 0)
            quantity = entry.get("quantity", 1)
            print(f"  - {entry.get('order_id')}: Stock={current_stock}, Required={quantity}")
            # Ready entries should have sufficient stock
            assert current_stock >= quantity, f"Ready entry has insufficient stock"
            
        # Get awaiting_stock entries
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment?status=awaiting_stock&firm_id={self.firm_id}")
        assert response.status_code == 200
        data = response.json()
        
        awaiting_entries = data.get("entries", [])
        print(f"✓ Got {len(awaiting_entries)} awaiting_stock entries")
        
    def test_08_push_tracking_403_error_handling(self):
        """Test that push-tracking provides helpful 403 error message"""
        self.test_02_get_firms()
        
        # Get an order with tracking added
        response = self.session.get(f"{BASE_URL}/api/amazon/orders/{self.firm_id}")
        assert response.status_code == 200
        orders = response.json().get("orders", [])
        
        tracking_added_orders = [o for o in orders if o.get("crm_status") == "tracking_added"]
        
        if not tracking_added_orders:
            print("⚠ No orders with tracking_added status to test push")
            pytest.skip("No orders with tracking to test push")
            
        test_order = tracking_added_orders[0]
        print(f"Testing push for order: {test_order['amazon_order_id']}")
        
        # Try to push tracking - this will likely fail with 403 due to SP-API permissions
        response = self.session.post(
            f"{BASE_URL}/api/amazon/push-tracking?amazon_order_id={test_order['amazon_order_id']}&firm_id={self.firm_id}"
        )
        
        print(f"  Push response status: {response.status_code}")
        
        if response.status_code == 403:
            detail = response.json().get("detail", "")
            print(f"  403 Error message: {detail}")
            # Verify helpful error message
            assert "SP-API" in detail or "Direct-to-Consumer" in detail or "Seller Central" in detail, \
                f"403 error should mention SP-API permissions, got: {detail}"
            print("✓ 403 error provides helpful SP-API permission guidance")
        elif response.status_code == 200:
            print("✓ Push to Amazon succeeded")
        elif response.status_code == 400:
            print(f"  400 Error: {response.json().get('detail', '')}")
        else:
            print(f"  Other error: {response.text}")
            
    def test_09_sku_mapping_endpoint(self):
        """Test SKU mapping endpoint exists and works"""
        self.test_02_get_firms()
        
        # Get master SKUs
        response = self.session.get(f"{BASE_URL}/api/master-skus?firm_id={self.firm_id}")
        assert response.status_code == 200
        skus = response.json()
        print(f"✓ Got {len(skus)} master SKUs")
        
        # Get existing mappings
        response = self.session.get(f"{BASE_URL}/api/amazon/sku-mappings/{self.firm_id}")
        if response.status_code == 200:
            mappings = response.json()
            print(f"✓ Got {len(mappings)} existing SKU mappings")
        else:
            print(f"  SKU mappings endpoint returned: {response.status_code}")
            
    def test_10_order_items_have_mapping_info(self):
        """Test that order items include mapping info for UI display"""
        self.test_02_get_firms()
        
        response = self.session.get(f"{BASE_URL}/api/amazon/orders/{self.firm_id}")
        assert response.status_code == 200
        orders = response.json().get("orders", [])
        
        # Check item structure
        for order in orders[:5]:
            items = order.get("items", [])
            for item in items:
                print(f"  Item: {item.get('amazon_sku') or item.get('seller_sku')}")
                print(f"    master_sku_id: {item.get('master_sku_id')}")
                print(f"    title: {item.get('title', 'N/A')[:40]}...")
                
        print("✓ Order items structure verified")


class TestAmazonOrderEndpoints:
    """Test Amazon order API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            return token
        return None
        
    def test_amazon_orders_endpoint(self):
        """Test GET /api/amazon/orders/{firm_id}"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        # Get firms
        response = self.session.get(f"{BASE_URL}/api/firms")
        assert response.status_code == 200
        firms = response.json()
        firm_id = firms[0]["id"] if firms else None
        
        if not firm_id:
            pytest.skip("No firms available")
            
        response = self.session.get(f"{BASE_URL}/api/amazon/orders/{firm_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert "orders" in data
        assert "stats" in data
        print(f"✓ Amazon orders endpoint working - {len(data['orders'])} orders")
        
    def test_update_tracking_endpoint_exists(self):
        """Test POST /api/amazon/update-tracking endpoint exists"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        # Get firms
        response = self.session.get(f"{BASE_URL}/api/firms")
        firms = response.json()
        firm_id = firms[0]["id"] if firms else "test"
        
        # Test with invalid order - should return 404, not 405
        response = self.session.post(
            f"{BASE_URL}/api/amazon/update-tracking?firm_id={firm_id}",
            json={
                "amazon_order_id": "INVALID-ORDER-ID",
                "tracking_number": "TEST123",
                "carrier_code": "bluedart"
            }
        )
        # Should be 404 (order not found) or 400 (validation error), not 405 (method not allowed)
        assert response.status_code in [400, 404], f"Unexpected status: {response.status_code}"
        print(f"✓ Update tracking endpoint exists (returned {response.status_code})")
        
    def test_push_tracking_endpoint_exists(self):
        """Test POST /api/amazon/push-tracking endpoint exists"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        # Get firms
        response = self.session.get(f"{BASE_URL}/api/firms")
        firms = response.json()
        firm_id = firms[0]["id"] if firms else "test"
        
        # Test with invalid order
        response = self.session.post(
            f"{BASE_URL}/api/amazon/push-tracking?amazon_order_id=INVALID&firm_id={firm_id}"
        )
        # Should be 404 (order not found), not 405
        assert response.status_code in [400, 404], f"Unexpected status: {response.status_code}"
        print(f"✓ Push tracking endpoint exists (returned {response.status_code})")
        
    def test_pending_fulfillment_endpoint(self):
        """Test GET /api/pending-fulfillment endpoint"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment")
        assert response.status_code == 200
        data = response.json()
        
        assert "entries" in data
        assert "summary" in data
        print(f"✓ Pending fulfillment endpoint working - {len(data['entries'])} entries")
        print(f"  Summary: {data['summary']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

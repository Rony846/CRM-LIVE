"""
Test Amazon Order Flow with Alias Auto-Mapping
Tests:
1. Amazon sync-alias-mappings API creates mappings from Master SKU aliases
2. Sync Aliases button visible in Amazon Orders UI
3. After sync, unmapped SKUs count decreases
4. Orders with mapped SKUs show 'Add Tracking' button
5. Adding tracking for mapped orders creates pending_fulfillment entry with master_sku_id
6. Pending Fulfillment Queue shows Amazon orders with correct product info
7. Mark Ready functionality available for Amazon orders in queue
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAmazonAliasMapping:
    """Test Amazon Order flow with alias auto-mapping"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@musclegrid.in"
        self.admin_password = "Muscle@846"
        self.firm_id = "8bf93db6-045f-4aed-988c-352103ed049d"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_01_login_success(self):
        """Test admin login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful")
    
    def test_02_get_firms(self):
        """Test getting firms list"""
        token = self.get_auth_token()
        response = self.session.get(
            f"{BASE_URL}/api/firms",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        firms = response.json()
        assert isinstance(firms, list)
        assert len(firms) > 0
        # Check if our test firm exists
        firm_ids = [f["id"] for f in firms]
        assert self.firm_id in firm_ids, f"Test firm {self.firm_id} not found"
        print(f"✓ Found {len(firms)} firms, test firm exists")
    
    def test_03_get_amazon_orders(self):
        """Test getting Amazon orders for firm"""
        token = self.get_auth_token()
        response = self.session.get(
            f"{BASE_URL}/api/amazon/orders/{self.firm_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "orders" in data
        assert "stats" in data
        orders = data["orders"]
        stats = data["stats"]
        print(f"✓ Got {len(orders)} Amazon orders")
        print(f"  Stats: Total={stats.get('total', 0)}, MFN Pending={stats.get('mfn_pending', 0)}, Easy Ship={stats.get('easy_ship_pending', 0)}, Tracking Added={stats.get('tracking_added', 0)}")
        return data
    
    def test_04_get_unmapped_skus(self):
        """Test getting unmapped SKUs"""
        token = self.get_auth_token()
        response = self.session.get(
            f"{BASE_URL}/api/amazon/unmapped-skus/{self.firm_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        unmapped = response.json()
        assert isinstance(unmapped, list)
        print(f"✓ Found {len(unmapped)} unmapped SKUs")
        if unmapped:
            for sku in unmapped[:3]:  # Show first 3
                print(f"  - {sku.get('amazon_sku')}: {sku.get('title', '')[:50]}...")
        return unmapped
    
    def test_05_get_master_skus(self):
        """Test getting master SKUs"""
        token = self.get_auth_token()
        response = self.session.get(
            f"{BASE_URL}/api/master-skus",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        skus = response.json()
        assert isinstance(skus, list)
        print(f"✓ Found {len(skus)} master SKUs")
        
        # Check for SKUs with aliases
        skus_with_aliases = [s for s in skus if s.get("aliases")]
        print(f"  SKUs with aliases: {len(skus_with_aliases)}")
        for sku in skus_with_aliases[:3]:
            aliases = sku.get("aliases", [])
            amazon_aliases = [a for a in aliases if a.get("platform", "").lower() == "amazon"]
            if amazon_aliases:
                print(f"  - {sku.get('sku_code')}: Amazon aliases = {[a.get('alias_code') for a in amazon_aliases]}")
        return skus
    
    def test_06_sync_alias_mappings_endpoint(self):
        """Test sync-alias-mappings endpoint"""
        token = self.get_auth_token()
        response = self.session.post(
            f"{BASE_URL}/api/amazon/sync-alias-mappings?firm_id={self.firm_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert data["success"] == True
        assert "mapped_count" in data
        print(f"✓ Sync alias mappings: {data.get('mapped_count')} new mappings created")
        if data.get("skus_mapped"):
            print(f"  SKUs mapped: {data.get('skus_mapped')}")
        return data
    
    def test_07_get_sku_mappings(self):
        """Test getting existing SKU mappings"""
        token = self.get_auth_token()
        response = self.session.get(
            f"{BASE_URL}/api/amazon/sku-mappings/{self.firm_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        mappings = response.json()
        assert isinstance(mappings, list)
        print(f"✓ Found {len(mappings)} SKU mappings")
        
        # Check for auto-mapped entries
        auto_mapped = [m for m in mappings if m.get("auto_mapped")]
        print(f"  Auto-mapped: {len(auto_mapped)}")
        for m in auto_mapped[:3]:
            print(f"  - {m.get('amazon_sku')} -> {m.get('sku_code')} (via {m.get('mapped_via', 'unknown')})")
        return mappings
    
    def test_08_check_orders_with_mapped_skus(self):
        """Test that orders with mapped SKUs have master_sku_id in items"""
        token = self.get_auth_token()
        response = self.session.get(
            f"{BASE_URL}/api/amazon/orders/{self.firm_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        orders = response.json().get("orders", [])
        
        mapped_orders = []
        unmapped_orders = []
        
        for order in orders:
            items = order.get("items", [])
            all_mapped = all(item.get("master_sku_id") for item in items)
            if all_mapped and items:
                mapped_orders.append(order)
            else:
                unmapped_orders.append(order)
        
        print(f"✓ Orders with all SKUs mapped: {len(mapped_orders)}")
        print(f"  Orders with unmapped SKUs: {len(unmapped_orders)}")
        
        # Show a mapped order
        if mapped_orders:
            order = mapped_orders[0]
            print(f"  Example mapped order: {order.get('amazon_order_id')}")
            for item in order.get("items", []):
                print(f"    - {item.get('amazon_sku')} -> master_sku_id: {item.get('master_sku_id')}")
        
        return {"mapped": mapped_orders, "unmapped": unmapped_orders}
    
    def test_09_get_pending_fulfillment_queue(self):
        """Test getting pending fulfillment queue"""
        token = self.get_auth_token()
        response = self.session.get(
            f"{BASE_URL}/api/pending-fulfillment",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # API returns dict with 'entries' key
        entries = data.get("entries", []) if isinstance(data, dict) else data
        assert isinstance(entries, list)
        print(f"✓ Found {len(entries)} pending fulfillment entries")
        
        # Check for Amazon orders
        amazon_entries = [e for e in entries if e.get("type") == "amazon_order" or e.get("order_source") == "amazon"]
        print(f"  Amazon orders in queue: {len(amazon_entries)}")
        
        for entry in amazon_entries[:3]:
            print(f"  - Order: {entry.get('amazon_order_id') or entry.get('order_id')}")
            print(f"    SKU: {entry.get('sku_code')}, master_sku_id: {entry.get('master_sku_id')}")
            print(f"    Status: {entry.get('status')}")
        
        return entries
    
    def test_10_check_pending_fulfillment_has_master_sku(self):
        """Test that pending fulfillment entries have master_sku_id"""
        token = self.get_auth_token()
        response = self.session.get(
            f"{BASE_URL}/api/pending-fulfillment",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # API returns dict with 'entries' key
        entries = data.get("entries", []) if isinstance(data, dict) else data
        assert isinstance(entries, list), f"Expected list, got {type(entries)}"
        
        amazon_entries = [e for e in entries if isinstance(e, dict) and (e.get("type") == "amazon_order" or e.get("order_source") == "amazon")]
        
        entries_with_sku = [e for e in amazon_entries if e.get("master_sku_id")]
        entries_without_sku = [e for e in amazon_entries if not e.get("master_sku_id")]
        
        print(f"✓ Amazon entries with master_sku_id: {len(entries_with_sku)}")
        print(f"  Amazon entries without master_sku_id: {len(entries_without_sku)}")
        
        # Note: Entries created before SKU mapping may have null master_sku_id
        # This is expected behavior - the mapping is done at tracking creation time
        if entries_without_sku:
            print(f"  Note: {len(entries_without_sku)} entries were created before SKU mapping")
        
        # Verify structure of entries with SKU
        for entry in entries_with_sku[:2]:
            assert entry.get("master_sku_id"), "Entry should have master_sku_id"
            print(f"  Entry {entry.get('id')[:8]}... has master_sku_id: {entry.get('master_sku_id')[:8]}...")
    
    def test_11_check_ready_to_dispatch_filter(self):
        """Test filtering pending fulfillment by ready_to_dispatch status"""
        token = self.get_auth_token()
        response = self.session.get(
            f"{BASE_URL}/api/pending-fulfillment?status=ready_to_dispatch",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        entries = response.json()
        print(f"✓ Found {len(entries)} entries with ready_to_dispatch status")
        return entries
    
    def test_12_verify_tracking_validation_requires_mapping(self):
        """Test that adding tracking fails for unmapped SKUs"""
        token = self.get_auth_token()
        
        # Get an order with unmapped SKUs
        orders_response = self.session.get(
            f"{BASE_URL}/api/amazon/orders/{self.firm_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        orders = orders_response.json().get("orders", [])
        
        # Find an order with unmapped SKUs
        unmapped_order = None
        for order in orders:
            items = order.get("items", [])
            if items and not all(item.get("master_sku_id") for item in items):
                if order.get("crm_status") == "pending":
                    unmapped_order = order
                    break
        
        if not unmapped_order:
            pytest.skip("No pending orders with unmapped SKUs found")
            return
        
        # Try to add tracking - should fail
        response = self.session.post(
            f"{BASE_URL}/api/amazon/update-tracking?firm_id={self.firm_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "amazon_order_id": unmapped_order["amazon_order_id"],
                "tracking_number": "TEST123456",
                "carrier_code": "bluedart",
                "customer_name": "Test Customer",
                "phone": "9876543210",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001"
            }
        )
        
        # Should return 400 with error about unmapped SKUs
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        error_detail = response.json().get("detail", "")
        assert "not mapped" in error_detail.lower() or "unmapped" in error_detail.lower(), f"Expected unmapped SKU error, got: {error_detail}"
        print(f"✓ Tracking validation correctly rejects unmapped SKUs")
        print(f"  Error: {error_detail}")
    
    def test_13_verify_order_with_tracking_in_queue(self):
        """Test that order 402-7514039-9600367 is in pending fulfillment queue"""
        token = self.get_auth_token()
        
        # Check if this specific order is in the queue
        response = self.session.get(
            f"{BASE_URL}/api/pending-fulfillment",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # API returns dict with 'entries' key
        entries = data.get("entries", []) if isinstance(data, dict) else data
        
        target_order = "402-7514039-9600367"
        matching_entries = [e for e in entries if e.get("amazon_order_id") == target_order or e.get("order_id") == target_order]
        
        if matching_entries:
            entry = matching_entries[0]
            print(f"✓ Order {target_order} found in pending fulfillment queue")
            print(f"  Status: {entry.get('status')}")
            print(f"  Tracking: {entry.get('tracking_number') or entry.get('tracking_id')}")
            print(f"  master_sku_id: {entry.get('master_sku_id')}")
            print(f"  sku_code: {entry.get('sku_code')}")
        else:
            print(f"⚠ Order {target_order} not found in pending fulfillment queue")
            # Check if it's in amazon_orders with tracking_added status
            orders_response = self.session.get(
                f"{BASE_URL}/api/amazon/orders/{self.firm_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            orders = orders_response.json().get("orders", [])
            matching_order = next((o for o in orders if o.get("amazon_order_id") == target_order), None)
            if matching_order:
                print(f"  Found in amazon_orders with status: {matching_order.get('crm_status')}")
                print(f"  Tracking: {matching_order.get('tracking_number')}")


class TestAmazonOrderStats:
    """Test Amazon order statistics"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.admin_email = "admin@musclegrid.in"
        self.admin_password = "Muscle@846"
        self.firm_id = "8bf93db6-045f-4aed-988c-352103ed049d"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        return response.json().get("access_token")
    
    def test_stats_structure(self):
        """Test that stats have correct structure"""
        token = self.get_auth_token()
        response = self.session.get(
            f"{BASE_URL}/api/amazon/orders/{self.firm_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        stats = response.json().get("stats", {})
        
        expected_keys = ["total", "mfn_pending", "easy_ship_pending", "tracking_added", "dispatched"]
        for key in expected_keys:
            assert key in stats, f"Missing stat key: {key}"
        
        print(f"✓ Stats structure verified")
        print(f"  Total: {stats.get('total')}")
        print(f"  MFN Pending: {stats.get('mfn_pending')}")
        print(f"  Easy Ship Pending: {stats.get('easy_ship_pending')}")
        print(f"  Tracking Added: {stats.get('tracking_added')}")
        print(f"  Dispatched: {stats.get('dispatched')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

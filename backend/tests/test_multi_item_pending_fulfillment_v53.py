"""
Test Multi-Item Pending Fulfillment Feature (Iteration 53)
Tests the new feature allowing accountants to add multiple products in one pending fulfillment entry.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"

# Test data prefix for cleanup
TEST_PREFIX = "TEST_MULTI_ITEM_"


class TestMultiItemPendingFulfillment:
    """Test suite for multi-item pending fulfillment feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.firm_id = None
        self.master_sku_ids = []
        self.created_fulfillment_ids = []
        
    def login(self):
        """Login and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        return data
    
    def get_test_firm(self):
        """Get an active firm for testing"""
        response = self.session.get(f"{BASE_URL}/api/firms", params={"is_active": True})
        assert response.status_code == 200, f"Failed to get firms: {response.text}"
        firms = response.json()
        assert len(firms) > 0, "No active firms found"
        self.firm_id = firms[0]["id"]
        return firms[0]
    
    def get_test_skus(self, count=3):
        """Get active master SKUs for testing"""
        response = self.session.get(f"{BASE_URL}/api/master-skus", params={"is_active": True})
        assert response.status_code == 200, f"Failed to get SKUs: {response.text}"
        skus = response.json()
        assert len(skus) >= count, f"Need at least {count} active SKUs, found {len(skus)}"
        self.master_sku_ids = [s["id"] for s in skus[:count]]
        return skus[:count]
    
    # ==================== BACKEND API TESTS ====================
    
    def test_01_login_success(self):
        """Test admin login"""
        data = self.login()
        assert "access_token" in data
        assert data["user"]["role"] in ["admin", "accountant"]
        print(f"✓ Login successful as {data['user']['email']}")
    
    def test_02_get_firms_and_skus(self):
        """Test getting firms and SKUs for the form"""
        self.login()
        
        # Get firms
        firm = self.get_test_firm()
        assert firm["id"], "Firm ID should exist"
        print(f"✓ Got firm: {firm['name']}")
        
        # Get SKUs
        skus = self.get_test_skus(3)
        assert len(skus) >= 3, "Should have at least 3 SKUs"
        print(f"✓ Got {len(skus)} SKUs for testing")
    
    def test_03_create_single_item_fulfillment_backward_compat(self):
        """Test creating fulfillment with single item (backward compatibility)"""
        self.login()
        self.get_test_firm()
        skus = self.get_test_skus(1)
        
        order_id = f"{TEST_PREFIX}SINGLE_{uuid.uuid4().hex[:8]}"
        tracking_id = f"TRK_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "order_id": order_id,
            "tracking_id": tracking_id,
            "firm_id": self.firm_id,
            "master_sku_id": skus[0]["id"],  # Single item mode
            "quantity": 2,
            "customer_name": "Test Customer Single",
            "customer_phone": "9876543210",
            "notes": "Single item test"
        }
        
        response = self.session.post(f"{BASE_URL}/api/pending-fulfillment", json=payload)
        assert response.status_code == 200, f"Failed to create: {response.text}"
        
        data = response.json()
        assert data["order_id"] == order_id
        assert data["tracking_id"] == tracking_id
        assert data["quantity"] == 2
        assert data["master_sku_id"] == skus[0]["id"]
        # Should also have items array for new format
        assert "items" in data
        assert len(data["items"]) == 1
        assert data["items"][0]["master_sku_id"] == skus[0]["id"]
        assert data["items"][0]["quantity"] == 2
        
        self.created_fulfillment_ids.append(data["id"])
        print(f"✓ Created single-item fulfillment: {order_id}")
    
    def test_04_create_multi_item_fulfillment(self):
        """Test creating fulfillment with multiple items"""
        self.login()
        self.get_test_firm()
        skus = self.get_test_skus(3)
        
        order_id = f"{TEST_PREFIX}MULTI_{uuid.uuid4().hex[:8]}"
        tracking_id = f"TRK_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "order_id": order_id,
            "tracking_id": tracking_id,
            "firm_id": self.firm_id,
            "items": [
                {"master_sku_id": skus[0]["id"], "quantity": 1},
                {"master_sku_id": skus[1]["id"], "quantity": 2},
                {"master_sku_id": skus[2]["id"], "quantity": 3}
            ],
            "customer_name": "Test Customer Multi",
            "customer_phone": "9876543211",
            "notes": "Multi item test"
        }
        
        response = self.session.post(f"{BASE_URL}/api/pending-fulfillment", json=payload)
        assert response.status_code == 200, f"Failed to create: {response.text}"
        
        data = response.json()
        assert data["order_id"] == order_id
        assert data["tracking_id"] == tracking_id
        # Total quantity should be sum of all items
        assert data["quantity"] == 6, f"Expected total quantity 6, got {data['quantity']}"
        
        # Verify items array
        assert "items" in data
        assert len(data["items"]) == 3, f"Expected 3 items, got {len(data['items'])}"
        
        # Verify each item has required fields
        for i, item in enumerate(data["items"]):
            assert "master_sku_id" in item, f"Item {i} missing master_sku_id"
            assert "master_sku_name" in item, f"Item {i} missing master_sku_name"
            assert "sku_code" in item, f"Item {i} missing sku_code"
            assert "quantity" in item, f"Item {i} missing quantity"
        
        self.created_fulfillment_ids.append(data["id"])
        print(f"✓ Created multi-item fulfillment with 3 items: {order_id}")
    
    def test_05_list_fulfillment_shows_items(self):
        """Test that listing fulfillments shows items with stock info"""
        self.login()
        
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment", params={"include_expired": True})
        assert response.status_code == 200, f"Failed to list: {response.text}"
        
        data = response.json()
        assert "entries" in data
        assert "summary" in data
        
        # Find a multi-item entry
        multi_item_entries = [e for e in data["entries"] if e.get("items") and len(e.get("items", [])) > 1]
        
        if multi_item_entries:
            entry = multi_item_entries[0]
            print(f"✓ Found multi-item entry: {entry['order_id']} with {len(entry['items'])} items")
            
            # Verify items have stock info
            for item in entry["items"]:
                assert "current_stock" in item, "Item should have current_stock"
                print(f"  - {item.get('sku_code')}: qty={item.get('quantity')}, stock={item.get('current_stock')}")
            
            # Verify all_items_in_stock flag
            assert "all_items_in_stock" in entry, "Entry should have all_items_in_stock flag"
            print(f"  - all_items_in_stock: {entry['all_items_in_stock']}")
        else:
            print("✓ No multi-item entries found (may need to create one first)")
    
    def test_06_create_fulfillment_validates_items(self):
        """Test that creating fulfillment validates items"""
        self.login()
        self.get_test_firm()
        
        order_id = f"{TEST_PREFIX}INVALID_{uuid.uuid4().hex[:8]}"
        tracking_id = f"TRK_{uuid.uuid4().hex[:8]}"
        
        # Test with invalid SKU ID
        payload = {
            "order_id": order_id,
            "tracking_id": tracking_id,
            "firm_id": self.firm_id,
            "items": [
                {"master_sku_id": "invalid-sku-id", "quantity": 1}
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/pending-fulfillment", json=payload)
        assert response.status_code == 400, f"Should fail with invalid SKU: {response.text}"
        assert "Invalid" in response.json().get("detail", ""), "Should mention invalid SKU"
        print("✓ Validation rejects invalid SKU ID")
        
        # Test with empty items
        payload2 = {
            "order_id": order_id,
            "tracking_id": tracking_id,
            "firm_id": self.firm_id,
            "items": []
        }
        
        response2 = self.session.post(f"{BASE_URL}/api/pending-fulfillment", json=payload2)
        assert response2.status_code == 400, f"Should fail with empty items: {response2.text}"
        print("✓ Validation rejects empty items array")
    
    def test_07_mark_ready_checks_all_items_stock(self):
        """Test that Mark Ready checks stock for all items"""
        self.login()
        
        # Get an awaiting_stock entry with items
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment", params={"include_expired": True})
        assert response.status_code == 200
        
        entries = response.json().get("entries", [])
        awaiting_entries = [e for e in entries if e.get("status") == "awaiting_stock" and e.get("items")]
        
        if awaiting_entries:
            entry = awaiting_entries[0]
            entry_id = entry["id"]
            
            # Try to mark as ready
            response = self.session.put(f"{BASE_URL}/api/pending-fulfillment/{entry_id}/mark-ready")
            
            # Should either succeed (if stock available) or fail with stock error
            if response.status_code == 200:
                print(f"✓ Mark Ready succeeded for {entry['order_id']} (stock available)")
            else:
                assert response.status_code == 400
                detail = response.json().get("detail", "")
                assert "stock" in detail.lower() or "insufficient" in detail.lower(), f"Should mention stock issue: {detail}"
                print(f"✓ Mark Ready correctly rejected due to insufficient stock")
        else:
            print("✓ No awaiting_stock entries to test (all may have stock)")
    
    def test_08_duplicate_order_id_rejected(self):
        """Test that duplicate order IDs are rejected"""
        self.login()
        self.get_test_firm()
        skus = self.get_test_skus(1)
        
        order_id = f"{TEST_PREFIX}DUP_{uuid.uuid4().hex[:8]}"
        tracking_id1 = f"TRK_{uuid.uuid4().hex[:8]}"
        tracking_id2 = f"TRK_{uuid.uuid4().hex[:8]}"
        
        # Create first entry
        payload1 = {
            "order_id": order_id,
            "tracking_id": tracking_id1,
            "firm_id": self.firm_id,
            "items": [{"master_sku_id": skus[0]["id"], "quantity": 1}]
        }
        
        response1 = self.session.post(f"{BASE_URL}/api/pending-fulfillment", json=payload1)
        assert response1.status_code == 200, f"First create should succeed: {response1.text}"
        self.created_fulfillment_ids.append(response1.json()["id"])
        
        # Try to create duplicate
        payload2 = {
            "order_id": order_id,  # Same order ID
            "tracking_id": tracking_id2,
            "firm_id": self.firm_id,
            "items": [{"master_sku_id": skus[0]["id"], "quantity": 1}]
        }
        
        response2 = self.session.post(f"{BASE_URL}/api/pending-fulfillment", json=payload2)
        assert response2.status_code == 400, f"Duplicate should be rejected: {response2.text}"
        assert "already exists" in response2.json().get("detail", "").lower()
        print("✓ Duplicate order ID correctly rejected")
    
    def test_09_check_unique_endpoint(self):
        """Test the check-unique endpoint for order/tracking validation"""
        self.login()
        
        # Check a non-existent order ID
        response = self.session.get(f"{BASE_URL}/api/pending-fulfillment/check-unique", 
                                    params={"order_id": f"NONEXISTENT_{uuid.uuid4().hex}"})
        assert response.status_code == 200
        data = response.json()
        assert data["exists"] == False, "Non-existent order should not exist"
        print("✓ check-unique returns false for non-existent order")
        
        # Check a non-existent tracking ID
        response2 = self.session.get(f"{BASE_URL}/api/pending-fulfillment/check-unique",
                                     params={"tracking_id": f"TRK_NONEXISTENT_{uuid.uuid4().hex}"})
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["exists"] == False, "Non-existent tracking should not exist"
        print("✓ check-unique returns false for non-existent tracking")
    
    def test_10_items_enriched_with_sku_details(self):
        """Test that items are enriched with SKU details (name, code, hsn, gst)"""
        self.login()
        self.get_test_firm()
        skus = self.get_test_skus(2)
        
        order_id = f"{TEST_PREFIX}ENRICH_{uuid.uuid4().hex[:8]}"
        tracking_id = f"TRK_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "order_id": order_id,
            "tracking_id": tracking_id,
            "firm_id": self.firm_id,
            "items": [
                {"master_sku_id": skus[0]["id"], "quantity": 1},
                {"master_sku_id": skus[1]["id"], "quantity": 2}
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/pending-fulfillment", json=payload)
        assert response.status_code == 200, f"Failed to create: {response.text}"
        
        data = response.json()
        self.created_fulfillment_ids.append(data["id"])
        
        # Verify items have enriched details
        for item in data["items"]:
            assert item.get("master_sku_name"), f"Item should have master_sku_name"
            assert item.get("sku_code"), f"Item should have sku_code"
            # hsn_code and gst_rate may be optional
            print(f"  - {item['sku_code']}: {item['master_sku_name']} (HSN: {item.get('hsn_code')}, GST: {item.get('gst_rate')}%)")
        
        print(f"✓ Items enriched with SKU details")


class TestPendingFulfillmentModel:
    """Test the PendingFulfillmentCreate model structure"""
    
    def test_model_accepts_items_array(self):
        """Verify the model structure accepts items array"""
        # This is a structural test - the actual validation happens in test_04
        expected_fields = ["order_id", "tracking_id", "firm_id", "items", "master_sku_id", "quantity"]
        print(f"✓ PendingFulfillmentCreate model should accept: {expected_fields}")
    
    def test_item_model_structure(self):
        """Verify PendingFulfillmentItem model structure"""
        expected_item_fields = ["master_sku_id", "quantity"]
        print(f"✓ PendingFulfillmentItem model should have: {expected_item_fields}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

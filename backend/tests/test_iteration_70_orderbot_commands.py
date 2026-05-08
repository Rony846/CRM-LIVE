"""
Iteration 70: OrderBot Commands Testing
Tests for adjust, transfer, expense commands and universal search
- adjust command: only allows Traded Items and Raw Materials (manufactured items rejected)
- transfer command: transfers stock between firms with invoice number
- expense command: records expenses with categories and GST options
- universal search: ticket ID, dispatch number, tracking ID, serial number, phone
- state normalization: UP -> Uttar Pradesh
- expense-categories endpoint
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication for bot endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # API returns access_token, not token
        token = data.get("access_token") or data.get("token")
        assert token, "No token in response"
        return token
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Auth headers for API calls"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestStateNormalization(TestAuth):
    """Test state name normalization API"""
    
    def test_normalize_state_up_to_uttar_pradesh(self, headers):
        """UP should normalize to Uttar Pradesh with exact confidence"""
        response = requests.post(
            f"{BASE_URL}/api/bot/normalize-state",
            data={"state": "UP"},
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["normalized"] == "Uttar Pradesh", f"Expected 'Uttar Pradesh', got {data['normalized']}"
        assert data["confidence"] == "exact", f"Expected 'exact' confidence, got {data['confidence']}"
    
    def test_normalize_state_mp_to_madhya_pradesh(self, headers):
        """MP should normalize to Madhya Pradesh"""
        response = requests.post(
            f"{BASE_URL}/api/bot/normalize-state",
            data={"state": "mp"},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["normalized"] == "Madhya Pradesh"
        assert data["confidence"] == "exact"
    
    def test_normalize_state_full_name(self, headers):
        """Full state name should also work"""
        response = requests.post(
            f"{BASE_URL}/api/bot/normalize-state",
            data={"state": "uttar pradesh"},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["normalized"] == "Uttar Pradesh"
    
    def test_normalize_state_delhi(self, headers):
        """Delhi abbreviation test"""
        response = requests.post(
            f"{BASE_URL}/api/bot/normalize-state",
            data={"state": "dl"},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["normalized"] == "Delhi"


class TestExpenseCategories(TestAuth):
    """Test expense categories endpoint"""
    
    def test_get_expense_categories(self, headers):
        """Should return list of 18 expense categories"""
        response = requests.get(
            f"{BASE_URL}/api/bot/expense-categories",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "categories" in data, "No categories in response"
        categories = data["categories"]
        assert len(categories) == 18, f"Expected 18 categories, got {len(categories)}"
        # Verify some expected categories
        expected = ["Office Supplies", "Utilities", "Rent", "Salaries", "Travel", "Marketing"]
        for cat in expected:
            assert cat in categories, f"Missing category: {cat}"


class TestBotFirms(TestAuth):
    """Test bot firms endpoint"""
    
    def test_get_firms(self, headers):
        """Should return list of firms"""
        response = requests.get(
            f"{BASE_URL}/api/bot/firms",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "firms" in data, "No firms in response"
        assert "count" in data, "No count in response"


class TestMasterSkus(TestAuth):
    """Test master SKUs endpoint for bot"""
    
    def test_get_master_skus(self, headers):
        """Should return list of master SKUs"""
        response = requests.get(
            f"{BASE_URL}/api/bot/master-skus",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "skus" in data, "No skus in response"
        assert "count" in data, "No count in response"
    
    def test_search_master_skus(self, headers):
        """Should search master SKUs by name"""
        response = requests.get(
            f"{BASE_URL}/api/bot/master-skus?search=test",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "skus" in data


class TestUniversalSearch(TestAuth):
    """Test universal search endpoint"""
    
    def test_universal_search_returns_structure(self, headers):
        """Universal search should return proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/bot/universal-search/TEST123",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "query" in data, "No query in response"
        assert "found_in" in data, "No found_in in response"
        assert "all_results" in data, "No all_results in response"
        assert data["query"] == "TEST123"
    
    def test_universal_search_phone_number(self, headers):
        """Search by phone number format"""
        response = requests.get(
            f"{BASE_URL}/api/bot/universal-search/9876543210",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "query" in data
        # Phone search should work even if no results
        assert isinstance(data["found_in"], list)


class TestAdjustInventory(TestAuth):
    """Test adjust inventory endpoint - only traded items and raw materials allowed"""
    
    @pytest.fixture(scope="class")
    def test_firm(self, headers):
        """Get a firm for testing"""
        response = requests.get(f"{BASE_URL}/api/bot/firms", headers=headers)
        assert response.status_code == 200
        data = response.json()
        if data["count"] > 0:
            return data["firms"][0]
        return None
    
    @pytest.fixture(scope="class")
    def test_traded_item(self, headers):
        """Get or create a traded item for testing"""
        # First try to get existing traded items
        response = requests.get(f"{BASE_URL}/api/traded-items", headers=headers)
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", data) if isinstance(data, dict) else data
            if items and len(items) > 0:
                return items[0]
        return None
    
    @pytest.fixture(scope="class")
    def test_raw_material(self, headers):
        """Get a raw material for testing"""
        response = requests.get(f"{BASE_URL}/api/raw-materials", headers=headers)
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", data) if isinstance(data, dict) else data
            if items and len(items) > 0:
                return items[0]
        return None
    
    def test_adjust_traded_item_allowed(self, headers, test_firm, test_traded_item):
        """Traded items should be adjustable"""
        if not test_firm or not test_traded_item:
            pytest.skip("No firm or traded item available for testing")
        
        response = requests.post(
            f"{BASE_URL}/api/bot/adjust-inventory",
            data={
                "item_type": "traded_item",
                "item_id": test_traded_item.get("id"),
                "firm_id": test_firm.get("id"),
                "quantity_change": 1,
                "reason": "TEST_adjustment_iteration_70"
            },
            headers=headers
        )
        # Should succeed (200) or fail with item not found (404) - not 400 for manufactured restriction
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}, {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            assert "new_balance" in data
    
    def test_adjust_raw_material_allowed(self, headers, test_firm, test_raw_material):
        """Raw materials should be adjustable"""
        if not test_firm or not test_raw_material:
            pytest.skip("No firm or raw material available for testing")
        
        response = requests.post(
            f"{BASE_URL}/api/bot/adjust-inventory",
            data={
                "item_type": "raw_material",
                "item_id": test_raw_material.get("id"),
                "firm_id": test_firm.get("id"),
                "quantity_change": 1,
                "reason": "TEST_adjustment_iteration_70"
            },
            headers=headers
        )
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}, {response.text}"
    
    def test_adjust_invalid_item_type_rejected(self, headers, test_firm):
        """Invalid item type should be rejected"""
        if not test_firm:
            pytest.skip("No firm available for testing")
        
        response = requests.post(
            f"{BASE_URL}/api/bot/adjust-inventory",
            data={
                "item_type": "invalid_type",
                "item_id": "some-id",
                "firm_id": test_firm.get("id"),
                "quantity_change": 1,
                "reason": "TEST_invalid_type"
            },
            headers=headers
        )
        assert response.status_code == 400, f"Expected 400 for invalid type, got {response.status_code}"


class TestTransferStock(TestAuth):
    """Test transfer stock between firms"""
    
    @pytest.fixture(scope="class")
    def test_firms(self, headers):
        """Get two firms for transfer testing"""
        response = requests.get(f"{BASE_URL}/api/bot/firms", headers=headers)
        assert response.status_code == 200
        data = response.json()
        if data["count"] >= 2:
            return data["firms"][:2]
        return None
    
    def test_transfer_same_firm_rejected(self, headers, test_firms):
        """Transfer to same firm should be rejected"""
        if not test_firms or len(test_firms) < 1:
            pytest.skip("Not enough firms for testing")
        
        firm = test_firms[0]
        response = requests.post(
            f"{BASE_URL}/api/bot/transfer-stock",
            data={
                "item_type": "master_sku",
                "item_id": "some-id",
                "from_firm_id": firm.get("id"),
                "to_firm_id": firm.get("id"),  # Same firm
                "quantity": 1,
                "invoice_number": "TEST-INV-001"
            },
            headers=headers
        )
        assert response.status_code == 400, f"Expected 400 for same firm, got {response.status_code}"
        assert "same" in response.json().get("detail", "").lower()
    
    def test_transfer_negative_quantity_rejected(self, headers, test_firms):
        """Negative quantity should be rejected"""
        if not test_firms or len(test_firms) < 2:
            pytest.skip("Not enough firms for testing")
        
        response = requests.post(
            f"{BASE_URL}/api/bot/transfer-stock",
            data={
                "item_type": "master_sku",
                "item_id": "some-id",
                "from_firm_id": test_firms[0].get("id"),
                "to_firm_id": test_firms[1].get("id"),
                "quantity": -5,
                "invoice_number": "TEST-INV-002"
            },
            headers=headers
        )
        assert response.status_code == 400, f"Expected 400 for negative qty, got {response.status_code}"


class TestRecordExpense(TestAuth):
    """Test expense recording"""
    
    @pytest.fixture(scope="class")
    def test_firm(self, headers):
        """Get a firm for testing"""
        response = requests.get(f"{BASE_URL}/api/bot/firms", headers=headers)
        assert response.status_code == 200
        data = response.json()
        if data["count"] > 0:
            return data["firms"][0]
        return None
    
    def test_record_expense_without_gst(self, headers, test_firm):
        """Record expense without GST"""
        if not test_firm:
            pytest.skip("No firm available for testing")
        
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/bot/record-expense",
            data={
                "firm_id": test_firm.get("id"),
                "expense_date": today,
                "category": "Office Supplies",
                "description": "TEST_expense_iteration_70",
                "amount": 100.0,
                "payment_mode": "cash",
                "gst_applicable": "false"
            },
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "expense_number" in data
        assert data["amount"] == 100.0
    
    def test_record_expense_with_gst(self, headers, test_firm):
        """Record expense with GST"""
        if not test_firm:
            pytest.skip("No firm available for testing")
        
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/bot/record-expense",
            data={
                "firm_id": test_firm.get("id"),
                "expense_date": today,
                "category": "Software",
                "description": "TEST_expense_with_gst_iteration_70",
                "amount": 1000.0,
                "payment_mode": "bank",
                "gst_applicable": "true",
                "gst_amount": 180.0
            },
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "expense_number" in data
        assert data["total_with_gst"] == 1180.0  # 1000 + 180


class TestTicketInfo(TestAuth):
    """Test ticket info endpoint"""
    
    def test_ticket_info_not_found(self, headers):
        """Non-existent ticket should return found=False"""
        response = requests.get(
            f"{BASE_URL}/api/bot/ticket-info/NONEXISTENT123",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["found"] == False


class TestDispatchInfo(TestAuth):
    """Test dispatch info endpoint"""
    
    def test_dispatch_info_not_found(self, headers):
        """Non-existent dispatch should return found=False"""
        response = requests.get(
            f"{BASE_URL}/api/bot/dispatch-info/NONEXISTENT123",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["found"] == False


class TestManufacturedItemRestriction(TestAuth):
    """Test that manufactured items cannot be adjusted"""
    
    @pytest.fixture(scope="class")
    def test_firm(self, headers):
        """Get a firm for testing"""
        response = requests.get(f"{BASE_URL}/api/bot/firms", headers=headers)
        assert response.status_code == 200
        data = response.json()
        if data["count"] > 0:
            return data["firms"][0]
        return None
    
    @pytest.fixture(scope="class")
    def manufactured_sku(self, headers):
        """Find a manufactured SKU"""
        response = requests.get(f"{BASE_URL}/api/master-skus", headers=headers)
        if response.status_code == 200:
            data = response.json()
            skus = data.get("skus", data) if isinstance(data, dict) else data
            for sku in skus:
                if sku.get("is_manufactured") or sku.get("product_type") == "manufactured":
                    return sku
        return None
    
    def test_manufactured_item_adjustment_rejected(self, headers, test_firm, manufactured_sku):
        """Manufactured items should be rejected for adjustment"""
        if not test_firm:
            pytest.skip("No firm available for testing")
        if not manufactured_sku:
            pytest.skip("No manufactured SKU found for testing")
        
        response = requests.post(
            f"{BASE_URL}/api/bot/adjust-inventory",
            data={
                "item_type": "master_sku",
                "item_id": manufactured_sku.get("id"),
                "firm_id": test_firm.get("id"),
                "quantity_change": 1,
                "reason": "TEST_manufactured_rejection"
            },
            headers=headers
        )
        # Should be rejected with 400
        assert response.status_code == 400, f"Expected 400 for manufactured item, got {response.status_code}"
        detail = response.json().get("detail", "")
        assert "manufactured" in detail.lower() or "production" in detail.lower(), f"Expected manufactured rejection message, got: {detail}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

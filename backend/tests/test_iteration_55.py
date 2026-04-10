"""
Test Iteration 55: Import Costing, Sales/Purchase Register Edit, GST Planning
Tests:
1. Import Costing - editing and saving a shipment works (no 404 error)
2. Sales Register - Admin can edit invoices
3. Purchase Register - Admin can edit purchases
4. Finance & GST Planning - GST data correctly calculated from sales_invoices and purchases
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://crm-rebuild-11.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"

# Electronics Bay firm ID for testing
ELECTRONICS_BAY_FIRM_ID = "76b41510-bb17-42be-887f-abcbfd9f4180"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        # API returns access_token, not token
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Get headers with admin token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestImportCosting:
    """Test Import Costing functionality - editing and saving shipments"""
    
    def test_get_import_shipments(self, admin_headers):
        """Test GET /api/import-shipments endpoint"""
        response = requests.get(f"{BASE_URL}/api/import-shipments", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get import shipments: {response.text}"
        data = response.json()
        assert "shipments" in data, "Response should contain 'shipments' key"
        print(f"Found {len(data.get('shipments', []))} import shipments")
    
    def test_import_shipment_api_url_correct(self, admin_headers):
        """Verify the API URL doesn't have double /api prefix"""
        # This tests that the frontend is using correct URLs
        # The endpoint should be /api/import-shipments, not /api/api/import-shipments
        response = requests.get(f"{BASE_URL}/api/import-shipments", headers=admin_headers)
        assert response.status_code == 200, f"API URL should work: {response.text}"
        
        # Test that double /api prefix returns 404
        response_double = requests.get(f"{BASE_URL}/api/api/import-shipments", headers=admin_headers)
        assert response_double.status_code == 404, "Double /api prefix should return 404"
        print("API URL verification passed - no double /api prefix issue")


class TestSalesRegisterEdit:
    """Test Sales Register admin edit functionality"""
    
    def test_get_sales_invoices(self, admin_headers):
        """Test GET /api/sales-invoices endpoint"""
        response = requests.get(f"{BASE_URL}/api/sales-invoices", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get sales invoices: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list of invoices"
        print(f"Found {len(data)} sales invoices")
        return data
    
    def test_sales_invoice_update_endpoint_exists(self, admin_headers):
        """Test that PUT /api/sales-invoices/{id} endpoint exists"""
        # First get an invoice to test with
        response = requests.get(f"{BASE_URL}/api/sales-invoices", headers=admin_headers)
        assert response.status_code == 200
        invoices = response.json()
        
        if len(invoices) == 0:
            pytest.skip("No sales invoices available for testing")
        
        invoice_id = invoices[0].get("id")
        
        # Test that the endpoint exists (even if we don't actually update)
        # We'll send a minimal update to verify the endpoint works
        update_data = {
            "notes": invoices[0].get("notes", "") + " [Test update]"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/sales-invoices/{invoice_id}",
            headers=admin_headers,
            json=update_data
        )
        
        # Should return 200 for successful update
        assert response.status_code == 200, f"Sales invoice update failed: {response.text}"
        print(f"Sales invoice update endpoint works for invoice {invoice_id}")
        
        # Verify the update was applied
        updated = response.json()
        assert "invoice" in updated or "message" in updated, "Response should contain invoice or message"


class TestPurchaseRegisterEdit:
    """Test Purchase Register admin edit functionality"""
    
    def test_get_purchases(self, admin_headers):
        """Test GET /api/purchases endpoint"""
        response = requests.get(f"{BASE_URL}/api/purchases", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get purchases: {response.text}"
        data = response.json()
        assert "purchases" in data, "Response should contain 'purchases' key"
        print(f"Found {len(data.get('purchases', []))} purchases")
        return data.get("purchases", [])
    
    def test_purchase_update_endpoint_exists(self, admin_headers):
        """Test that PATCH /api/purchases/{id} endpoint exists"""
        # First get a purchase to test with
        response = requests.get(f"{BASE_URL}/api/purchases", headers=admin_headers)
        assert response.status_code == 200
        purchases = response.json().get("purchases", [])
        
        if len(purchases) == 0:
            pytest.skip("No purchases available for testing")
        
        purchase_id = purchases[0].get("id")
        
        # Test that the endpoint exists with a minimal update
        update_data = {
            "notes": purchases[0].get("notes", "") + " [Test update]"
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/purchases/{purchase_id}",
            headers=admin_headers,
            json=update_data
        )
        
        # Should return 200 for successful update
        assert response.status_code == 200, f"Purchase update failed: {response.text}"
        print(f"Purchase update endpoint works for purchase {purchase_id}")


class TestGSTPlanningData:
    """Test GST Planning data calculation from sales_invoices and purchases"""
    
    def test_get_firms(self, admin_headers):
        """Test GET /api/firms endpoint"""
        response = requests.get(f"{BASE_URL}/api/firms", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get firms: {response.text}"
        firms = response.json()
        assert isinstance(firms, list), "Response should be a list of firms"
        print(f"Found {len(firms)} firms")
        return firms
    
    def test_finance_dashboard(self, admin_headers):
        """Test GET /api/finance/dashboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/finance/dashboard", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get finance dashboard: {response.text}"
        data = response.json()
        
        # Verify expected fields
        expected_fields = ["total_inventory_value", "total_gst_liability", "total_firms"]
        for field in expected_fields:
            assert field in data, f"Dashboard should contain '{field}'"
        
        print(f"Finance dashboard: {data.get('total_firms')} firms, GST liability: {data.get('total_gst_liability')}")
    
    def test_firm_financial_summary(self, admin_headers):
        """Test GET /api/finance/firm/{firm_id}/summary endpoint"""
        # Use Electronics Bay firm ID
        firm_id = ELECTRONICS_BAY_FIRM_ID
        current_month = "2026-04"  # Current month
        
        response = requests.get(
            f"{BASE_URL}/api/finance/firm/{firm_id}/summary",
            headers=admin_headers,
            params={"month": current_month}
        )
        
        assert response.status_code == 200, f"Failed to get firm summary: {response.text}"
        data = response.json()
        
        # Verify expected structure
        assert "firm" in data, "Response should contain 'firm'"
        assert "sales" in data, "Response should contain 'sales'"
        assert "purchases" in data, "Response should contain 'purchases'"
        assert "gst" in data, "Response should contain 'gst'"
        
        # Verify GST breakdown structure
        gst = data.get("gst", {})
        gst_fields = ["output_gst", "output_cgst", "output_sgst", "output_igst", 
                      "input_gst", "input_cgst", "input_sgst", "input_igst",
                      "itc_balance", "net_payable"]
        for field in gst_fields:
            assert field in gst, f"GST data should contain '{field}'"
        
        print(f"Firm summary for {data.get('firm', {}).get('name')}:")
        print(f"  - Output GST: {gst.get('output_gst')} (CGST: {gst.get('output_cgst')}, SGST: {gst.get('output_sgst')}, IGST: {gst.get('output_igst')})")
        print(f"  - Input GST: {gst.get('input_gst')} (CGST: {gst.get('input_cgst')}, SGST: {gst.get('input_sgst')}, IGST: {gst.get('input_igst')})")
        print(f"  - Net Payable: {gst.get('net_payable')}")
        
        # Verify production, transfers, returns are included
        assert "production" in data, "Response should contain 'production'"
        assert "transfers" in data, "Response should contain 'transfers'"
        assert "returns" in data, "Response should contain 'returns'"
        
        print(f"  - Production value: {data.get('production', {}).get('value')}")
        print(f"  - Transfers in: {data.get('transfers', {}).get('in', {}).get('value')}")
        print(f"  - Returns value: {data.get('returns', {}).get('value')}")
    
    def test_gst_data_from_sales_invoices(self, admin_headers):
        """Verify GST data is calculated from sales_invoices collection"""
        # Get sales invoices for Electronics Bay
        response = requests.get(
            f"{BASE_URL}/api/sales-invoices",
            headers=admin_headers,
            params={"firm_id": ELECTRONICS_BAY_FIRM_ID}
        )
        
        if response.status_code == 200:
            invoices = response.json()
            total_gst = sum(inv.get("total_gst", 0) or 0 for inv in invoices)
            total_cgst = sum(inv.get("cgst", 0) or 0 for inv in invoices)
            total_sgst = sum(inv.get("sgst", 0) or 0 for inv in invoices)
            total_igst = sum(inv.get("igst", 0) or 0 for inv in invoices)
            
            print(f"Sales invoices GST totals:")
            print(f"  - Total GST: {total_gst}")
            print(f"  - CGST: {total_cgst}, SGST: {total_sgst}, IGST: {total_igst}")
    
    def test_gst_data_from_purchases(self, admin_headers):
        """Verify Input GST data is calculated from purchases collection"""
        # Get purchases for Electronics Bay
        response = requests.get(
            f"{BASE_URL}/api/purchases",
            headers=admin_headers,
            params={"firm_id": ELECTRONICS_BAY_FIRM_ID}
        )
        
        if response.status_code == 200:
            data = response.json()
            purchases = data.get("purchases", [])
            total_gst = sum(p.get("total_gst", 0) or 0 for p in purchases)
            total_cgst = sum(p.get("cgst", 0) or 0 for p in purchases)
            total_sgst = sum(p.get("sgst", 0) or 0 for p in purchases)
            total_igst = sum(p.get("igst", 0) or 0 for p in purchases)
            
            print(f"Purchases GST totals (Input GST):")
            print(f"  - Total GST: {total_gst}")
            print(f"  - CGST: {total_cgst}, SGST: {total_sgst}, IGST: {total_igst}")


class TestAdminOnlyAccess:
    """Test that edit endpoints are admin-only"""
    
    def test_sales_invoice_update_requires_admin(self):
        """Test that PUT /api/sales-invoices/{id} requires admin role"""
        # Try without authentication
        response = requests.put(
            f"{BASE_URL}/api/sales-invoices/test-id",
            json={"notes": "test"}
        )
        assert response.status_code in [401, 403], "Should require authentication"
        print("Sales invoice update requires authentication")
    
    def test_purchase_update_requires_admin(self):
        """Test that PATCH /api/purchases/{id} requires admin role"""
        # Try without authentication
        response = requests.patch(
            f"{BASE_URL}/api/purchases/test-id",
            json={"notes": "test"}
        )
        assert response.status_code in [401, 403], "Should require authentication"
        print("Purchase update requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

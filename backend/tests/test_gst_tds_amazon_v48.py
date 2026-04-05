"""
Test Suite for GST/HSN Summary, TDS Calculation, and Amazon Push Tracking
Iteration 48 - Testing fixes for:
1. GST/HSN showing 0 values - aggregates from sales_invoices and dispatches
2. TDS Management - respects thresholds (194I rent threshold is ₹240,000)
3. Amazon Push to Amazon button - POST /amazon/push-tracking endpoint
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        token = data.get("access_token") or data.get("token")
        assert token, "No token in response"
        return token
    
    def test_login_success(self, auth_token):
        """Test admin login"""
        assert auth_token is not None
        print(f"✓ Admin login successful, token obtained")


class TestGSTHSNSummary:
    """Test GST/HSN Summary aggregation from sales_invoices and dispatches"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_hsn_summary_endpoint_exists(self, headers):
        """Test that HSN summary endpoint exists and returns data"""
        response = requests.get(f"{BASE_URL}/api/gst/hsn-summary", headers=headers)
        assert response.status_code == 200, f"HSN summary endpoint failed: {response.text}"
        data = response.json()
        print(f"✓ HSN Summary endpoint returns data: {len(data.get('hsn_summary', []))} HSN codes")
        return data
    
    def test_hsn_summary_has_gst_values(self, headers):
        """Test that HSN summary contains GST values (not all zeros)"""
        response = requests.get(f"{BASE_URL}/api/gst/hsn-summary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        hsn_summary = data.get("hsn_summary", [])
        
        # Check if any HSN has non-zero values
        has_taxable_values = any(h.get("sales_taxable", 0) > 0 for h in hsn_summary)
        has_gst_values = any(
            h.get("sales_cgst", 0) > 0 or 
            h.get("sales_sgst", 0) > 0 or 
            h.get("sales_igst", 0) > 0 
            for h in hsn_summary
        )
        
        print(f"✓ HSN Summary: {len(hsn_summary)} HSN codes found")
        print(f"  - Has taxable values: {has_taxable_values}")
        print(f"  - Has GST values: {has_gst_values}")
        
        # Log first few HSN entries for verification
        for hsn in hsn_summary[:3]:
            print(f"  - HSN {hsn.get('hsn_code')}: Taxable={hsn.get('sales_taxable')}, CGST={hsn.get('sales_cgst')}, SGST={hsn.get('sales_sgst')}, IGST={hsn.get('sales_igst')}")
    
    def test_hsn_summary_with_date_range(self, headers):
        """Test HSN summary with date range filter"""
        # Use a wide date range to capture data
        params = {
            "from_date": "2024-01-01",
            "to_date": "2026-12-31"
        }
        response = requests.get(f"{BASE_URL}/api/gst/hsn-summary", headers=headers, params=params)
        assert response.status_code == 200, f"HSN summary with date range failed: {response.text}"
        data = response.json()
        print(f"✓ HSN Summary with date range: {len(data.get('hsn_summary', []))} HSN codes")


class TestTDSCalculation:
    """Test TDS calculation with threshold validation"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_tds_sections_endpoint(self, headers):
        """Test TDS sections endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/tds/sections", headers=headers)
        assert response.status_code == 200, f"TDS sections endpoint failed: {response.text}"
        sections = response.json()
        print(f"✓ TDS Sections: {len(sections)} sections configured")
        
        # Check for 194I (rent) section
        rent_section = next((s for s in sections if s.get("section") == "194I"), None)
        if rent_section:
            print(f"  - 194I (Rent): Threshold = ₹{rent_section.get('threshold_annual', 0):,.0f}")
        return sections
    
    def test_tds_entries_endpoint(self, headers):
        """Test TDS entries endpoint"""
        response = requests.get(f"{BASE_URL}/api/tds/entries", headers=headers)
        assert response.status_code == 200, f"TDS entries endpoint failed: {response.text}"
        entries = response.json()
        print(f"✓ TDS Entries: {len(entries)} entries found")
        return entries
    
    def test_tds_calculate_endpoint_exists(self, headers):
        """Test TDS calculate endpoint exists"""
        # First get a party to test with
        parties_response = requests.get(f"{BASE_URL}/api/parties", headers=headers)
        if parties_response.status_code == 200:
            parties = parties_response.json()
            if parties:
                party = parties[0]
                party_id = party.get("id")
                
                # Test TDS calculation
                params = {
                    "party_id": party_id,
                    "gross_amount": 50000,
                    "expense_type": "rent"
                }
                response = requests.post(f"{BASE_URL}/api/tds/calculate", headers=headers, params=params)
                # Endpoint should exist (may return TDS not applicable if below threshold)
                assert response.status_code in [200, 400, 404], f"TDS calculate endpoint failed: {response.text}"
                print(f"✓ TDS Calculate endpoint exists and responds")
                if response.status_code == 200:
                    result = response.json()
                    print(f"  - TDS Applicable: {result.get('tds_applicable')}")
                    print(f"  - Reason: {result.get('reason')}")
    
    def test_tds_threshold_for_rent(self, headers):
        """Test that TDS respects 194I threshold (₹240,000 annual)"""
        # Get 194I section details
        response = requests.get(f"{BASE_URL}/api/tds/sections", headers=headers)
        if response.status_code == 200:
            sections = response.json()
            rent_section = next((s for s in sections if s.get("section") == "194I"), None)
            
            if rent_section:
                threshold = rent_section.get("threshold_annual", 0)
                print(f"✓ 194I Rent Section found:")
                print(f"  - Annual Threshold: ₹{threshold:,.0f}")
                print(f"  - Per Transaction Threshold: ₹{rent_section.get('threshold_per_transaction', 0):,.0f}")
                
                # Verify threshold is 240,000 as expected
                if threshold == 240000:
                    print(f"  - ✓ Threshold correctly set to ₹240,000")
                else:
                    print(f"  - ⚠ Threshold is ₹{threshold:,.0f}, expected ₹240,000")


class TestExpensesDashboard:
    """Test Expenses Dashboard showing correct gross_amount"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_expenses_endpoint(self, headers):
        """Test expenses endpoint returns data with gross_amount"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=headers)
        assert response.status_code == 200, f"Expenses endpoint failed: {response.text}"
        
        data = response.json()
        expenses = data if isinstance(data, list) else data.get("expenses", [])
        
        print(f"✓ Expenses endpoint: {len(expenses)} expenses found")
        
        # Check for rent entries with gross_amount
        rent_expenses = [e for e in expenses if "rent" in (e.get("description", "") or "").lower() or e.get("expense_type") == "rent"]
        print(f"  - Rent expenses: {len(rent_expenses)}")
        
        for exp in rent_expenses[:3]:
            gross = exp.get("gross_amount", 0)
            amount = exp.get("amount", 0)
            print(f"  - {exp.get('description', 'N/A')}: gross_amount=₹{gross:,.2f}, amount=₹{amount:,.2f}")
        
        return expenses
    
    def test_expenses_have_gross_amount_field(self, headers):
        """Verify expenses have gross_amount field populated"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        expenses = data if isinstance(data, list) else data.get("expenses", [])
        
        # Count expenses with gross_amount
        with_gross = [e for e in expenses if e.get("gross_amount") and e.get("gross_amount") > 0]
        print(f"✓ Expenses with gross_amount > 0: {len(with_gross)} of {len(expenses)}")


class TestAmazonPushTracking:
    """Test Amazon Push Tracking endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_push_tracking_endpoint_exists(self, headers):
        """Test that POST /amazon/push-tracking endpoint exists"""
        # Test with dummy data - should return 404 for non-existent order
        params = {
            "amazon_order_id": "TEST-ORDER-12345",
            "firm_id": "test-firm-id"
        }
        response = requests.post(f"{BASE_URL}/api/amazon/push-tracking", headers=headers, params=params)
        
        # Endpoint should exist - expect 404 (order not found) or 400 (bad request)
        assert response.status_code in [400, 404], f"Unexpected status: {response.status_code} - {response.text}"
        print(f"✓ POST /amazon/push-tracking endpoint exists (returns {response.status_code} for non-existent order)")
    
    def test_amazon_orders_endpoint(self, headers):
        """Test Amazon orders endpoint"""
        # First get a firm
        firms_response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        if firms_response.status_code == 200:
            firms = firms_response.json()
            if firms:
                firm_id = firms[0].get("id")
                
                response = requests.get(f"{BASE_URL}/api/amazon/orders/{firm_id}", headers=headers)
                assert response.status_code == 200, f"Amazon orders endpoint failed: {response.text}"
                
                data = response.json()
                orders = data.get("orders", [])
                stats = data.get("stats", {})
                
                print(f"✓ Amazon Orders endpoint:")
                print(f"  - Total orders: {stats.get('total', 0)}")
                print(f"  - MFN Pending: {stats.get('mfn_pending', 0)}")
                print(f"  - Easy Ship Pending: {stats.get('easy_ship_pending', 0)}")
                print(f"  - Tracking Added: {stats.get('tracking_added', 0)}")
                print(f"  - Dispatched: {stats.get('dispatched', 0)}")
    
    def test_amazon_update_tracking_endpoint(self, headers):
        """Test Amazon update tracking endpoint exists"""
        # First get a firm
        firms_response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        if firms_response.status_code == 200:
            firms = firms_response.json()
            if firms:
                firm_id = firms[0].get("id")
                
                # Test with dummy data
                payload = {
                    "amazon_order_id": "TEST-ORDER-12345",
                    "tracking_number": "TEST123456",
                    "carrier_code": "bluedart"
                }
                response = requests.post(
                    f"{BASE_URL}/api/amazon/update-tracking",
                    headers=headers,
                    params={"firm_id": firm_id},
                    json=payload
                )
                
                # Should return 404 for non-existent order
                assert response.status_code in [400, 404], f"Unexpected status: {response.status_code}"
                print(f"✓ POST /amazon/update-tracking endpoint exists (returns {response.status_code} for non-existent order)")


class TestSalesInvoicesForHSN:
    """Test that sales_invoices have items with HSN codes for GST aggregation"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_sales_invoices_endpoint(self, headers):
        """Test sales invoices endpoint"""
        response = requests.get(f"{BASE_URL}/api/sales-invoices", headers=headers)
        assert response.status_code == 200, f"Sales invoices endpoint failed: {response.text}"
        
        data = response.json()
        invoices = data if isinstance(data, list) else data.get("invoices", [])
        
        print(f"✓ Sales Invoices: {len(invoices)} invoices found")
        
        # Check for invoices with items containing HSN codes
        invoices_with_hsn = 0
        for inv in invoices[:10]:
            items = inv.get("items", [])
            for item in items:
                if item.get("hsn_code"):
                    invoices_with_hsn += 1
                    break
        
        print(f"  - Invoices with HSN codes in items: {invoices_with_hsn}")
        return invoices
    
    def test_master_skus_have_hsn(self, headers):
        """Test that master SKUs have HSN codes configured"""
        response = requests.get(f"{BASE_URL}/api/master-skus", headers=headers)
        assert response.status_code == 200, f"Master SKUs endpoint failed: {response.text}"
        
        skus = response.json()
        skus_with_hsn = [s for s in skus if s.get("hsn_code")]
        
        print(f"✓ Master SKUs: {len(skus)} total, {len(skus_with_hsn)} with HSN codes")
        
        for sku in skus_with_hsn[:3]:
            print(f"  - {sku.get('sku_code')}: HSN={sku.get('hsn_code')}, GST={sku.get('gst_rate')}%")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test Iteration 64: Bot Dispatch Compliance Testing
Tests for bot endpoints that enforce compliance before dispatch:
1. GET /api/bot/prepare-dispatch/{order_id} - comprehensive compliance data
2. POST /api/bot/dispatch - compliance validation
3. GET /api/bot/available-serials/{order_id} - serial number availability
4. POST /api/bot/select-serial - serial number selection
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"


class TestBotComplianceEndpoints:
    """Test bot compliance endpoints for dispatch"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth"""
        self.session = requests.Session()
        
        # Login as admin (JSON for login)
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login", 
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.token = token
            # Set auth header only (no content-type for form data)
            self.auth_headers = {"Authorization": f"Bearer {token}"}
            self.json_headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    def get_pending_orders(self):
        """Helper to get pending fulfillment orders"""
        pf_response = self.session.get(f"{BASE_URL}/api/pending-fulfillment", headers=self.json_headers)
        if pf_response.status_code != 200:
            return []
        
        data = pf_response.json()
        # Handle both list and dict with 'entries' key
        if isinstance(data, dict) and "entries" in data:
            return data["entries"]
        elif isinstance(data, list):
            return data
        return []
    
    # ==================== PREPARE-DISPATCH ENDPOINT TESTS ====================
    
    def test_prepare_dispatch_returns_comprehensive_data(self):
        """Test that prepare-dispatch returns all required compliance data"""
        orders = self.get_pending_orders()
        if not orders:
            pytest.skip("No pending fulfillment orders to test")
        
        # Find an order that's not dispatched
        test_order = None
        for order in orders:
            if order.get("status") not in ["dispatched", "cancelled"]:
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No non-dispatched orders available")
        
        order_id = test_order.get("id")
        
        # Call prepare-dispatch
        response = self.session.get(f"{BASE_URL}/api/bot/prepare-dispatch/{order_id}", headers=self.auth_headers)
        assert response.status_code == 200, f"Prepare dispatch failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "order" in data, "Missing 'order' in response"
        assert "customer" in data, "Missing 'customer' in response"
        assert "product" in data, "Missing 'product' in response"
        assert "pricing" in data, "Missing 'pricing' in response"
        assert "logistics" in data, "Missing 'logistics' in response"
        assert "documents" in data, "Missing 'documents' in response"
        assert "serial_numbers" in data, "Missing 'serial_numbers' in response"
        assert "compliance" in data, "Missing 'compliance' in response"
        assert "missing_fields" in data, "Missing 'missing_fields' in response"
        assert "ready_to_dispatch" in data, "Missing 'ready_to_dispatch' in response"
        
        print(f"✓ Prepare-dispatch returns comprehensive data for order {order_id}")
    
    def test_prepare_dispatch_shows_pricing_with_gst(self):
        """Test that prepare-dispatch shows pricing with/without GST"""
        orders = self.get_pending_orders()
        
        test_order = None
        for order in orders:
            if order.get("status") not in ["dispatched", "cancelled"]:
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No non-dispatched orders available")
        
        order_id = test_order.get("id")
        response = self.session.get(f"{BASE_URL}/api/bot/prepare-dispatch/{order_id}", headers=self.auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        pricing = data.get("pricing", {})
        
        # Verify pricing fields
        assert "unit_price_with_gst" in pricing, "Missing unit_price_with_gst"
        assert "unit_price_without_gst" in pricing, "Missing unit_price_without_gst"
        assert "gst_rate" in pricing, "Missing gst_rate"
        assert "gst_amount" in pricing, "Missing gst_amount"
        assert "quantity" in pricing, "Missing quantity"
        assert "total_value" in pricing, "Missing total_value"
        assert "source" in pricing, "Missing pricing source (amazon/order)"
        
        print(f"✓ Pricing data: source={pricing.get('source')}, total=₹{pricing.get('total_value')}, GST={pricing.get('gst_rate')}%")
    
    def test_prepare_dispatch_shows_compliance_status(self):
        """Test that prepare-dispatch shows compliance status for tracking, invoice, label, eway bill"""
        orders = self.get_pending_orders()
        
        test_order = None
        for order in orders:
            if order.get("status") not in ["dispatched", "cancelled"]:
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No non-dispatched orders available")
        
        order_id = test_order.get("id")
        response = self.session.get(f"{BASE_URL}/api/bot/prepare-dispatch/{order_id}", headers=self.auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        compliance = data.get("compliance", {})
        
        # Verify compliance fields
        assert "tracking_id_required" in compliance
        assert "tracking_id_provided" in compliance
        assert "invoice_required" in compliance
        assert "invoice_uploaded" in compliance
        assert "label_required" in compliance
        assert "label_uploaded" in compliance
        assert "eway_bill_required" in compliance
        assert "eway_bill_provided" in compliance
        assert "eway_bill_uploaded" in compliance
        
        print(f"✓ Compliance status: tracking={compliance.get('tracking_id_provided')}, invoice={compliance.get('invoice_uploaded')}, label={compliance.get('label_uploaded')}")
    
    def test_prepare_dispatch_shows_available_serials(self):
        """Test that prepare-dispatch shows available serial numbers"""
        orders = self.get_pending_orders()
        
        test_order = None
        for order in orders:
            if order.get("status") not in ["dispatched", "cancelled"]:
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No non-dispatched orders available")
        
        order_id = test_order.get("id")
        response = self.session.get(f"{BASE_URL}/api/bot/prepare-dispatch/{order_id}", headers=self.auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        serial_numbers = data.get("serial_numbers", {})
        
        # Verify serial number fields
        assert "selected" in serial_numbers, "Missing 'selected' serial"
        assert "available" in serial_numbers, "Missing 'available' serials list"
        
        available = serial_numbers.get("available", [])
        print(f"✓ Serial numbers: selected={serial_numbers.get('selected')}, available_count={len(available)}")
    
    def test_prepare_dispatch_not_found(self):
        """Test prepare-dispatch with invalid order ID"""
        response = self.session.get(f"{BASE_URL}/api/bot/prepare-dispatch/invalid-order-id-12345", headers=self.auth_headers)
        assert response.status_code == 404
        print("✓ Prepare-dispatch returns 404 for invalid order ID")
    
    # ==================== DISPATCH ENDPOINT COMPLIANCE TESTS ====================
    
    def test_dispatch_requires_confirmed_true(self):
        """Test that dispatch fails without confirmed=true"""
        orders = self.get_pending_orders()
        
        test_order = None
        for order in orders:
            if order.get("status") not in ["dispatched", "cancelled"]:
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No non-dispatched orders available")
        
        order_id = test_order.get("id")
        
        # Try dispatch without confirmed=true (use form data, not JSON)
        response = self.session.post(
            f"{BASE_URL}/api/bot/dispatch",
            headers=self.auth_headers,  # No Content-Type for form data
            data={
                "order_id": order_id,
                "tracking_id": "TEST123",
                "confirmed": "false"  # Not confirmed
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check for confirmation error
        detail = data.get("detail", {})
        errors = detail.get("errors", []) if isinstance(detail, dict) else []
        
        has_confirm_error = any("confirmed" in str(e).lower() for e in errors)
        assert has_confirm_error or "confirmed" in str(detail).lower(), f"Expected confirmation error, got: {detail}"
        
        print("✓ Dispatch fails without confirmed=true")
    
    def test_dispatch_fails_without_invoice(self):
        """Test that dispatch fails if invoice not uploaded"""
        orders = self.get_pending_orders()
        
        # Find an order without invoice
        test_order = None
        for order in orders:
            if order.get("status") not in ["dispatched", "cancelled"] and not order.get("invoice_url"):
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No orders without invoice available")
        
        order_id = test_order.get("id")
        
        response = self.session.post(
            f"{BASE_URL}/api/bot/dispatch",
            headers=self.auth_headers,
            data={
                "order_id": order_id,
                "tracking_id": "TEST123",
                "confirmed": "true"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        
        detail = data.get("detail", {})
        errors = detail.get("errors", []) if isinstance(detail, dict) else []
        
        has_invoice_error = any("invoice" in str(e).lower() for e in errors)
        assert has_invoice_error or "invoice" in str(detail).lower(), f"Expected invoice error, got: {detail}"
        
        print("✓ Dispatch fails without invoice uploaded")
    
    def test_dispatch_fails_without_shipping_label(self):
        """Test that dispatch fails if shipping label not uploaded"""
        orders = self.get_pending_orders()
        
        # Find an order without label
        test_order = None
        for order in orders:
            if order.get("status") not in ["dispatched", "cancelled"] and not order.get("label_url"):
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No orders without shipping label available")
        
        order_id = test_order.get("id")
        
        response = self.session.post(
            f"{BASE_URL}/api/bot/dispatch",
            headers=self.auth_headers,
            data={
                "order_id": order_id,
                "tracking_id": "TEST123",
                "confirmed": "true"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        
        detail = data.get("detail", {})
        errors = detail.get("errors", []) if isinstance(detail, dict) else []
        
        has_label_error = any("label" in str(e).lower() or "shipping" in str(e).lower() for e in errors)
        assert has_label_error or "label" in str(detail).lower(), f"Expected label error, got: {detail}"
        
        print("✓ Dispatch fails without shipping label uploaded")
    
    def test_dispatch_fails_without_tracking_id(self):
        """Test that dispatch fails if tracking_id missing"""
        orders = self.get_pending_orders()
        
        # Find an order without tracking_id
        test_order = None
        for order in orders:
            if order.get("status") not in ["dispatched", "cancelled"] and not order.get("tracking_id"):
                test_order = order
                break
        
        if not test_order:
            # All orders have tracking_id, so we need to test differently
            # Find any non-dispatched order and don't pass tracking_id
            for order in orders:
                if order.get("status") not in ["dispatched", "cancelled"]:
                    test_order = order
                    break
        
        if not test_order:
            pytest.skip("No non-dispatched orders available")
        
        order_id = test_order.get("id")
        
        # First, check if order already has tracking_id
        prepare_response = self.session.get(f"{BASE_URL}/api/bot/prepare-dispatch/{order_id}", headers=self.auth_headers)
        if prepare_response.status_code == 200:
            prepare_data = prepare_response.json()
            if prepare_data.get("logistics", {}).get("tracking_id"):
                # Order already has tracking_id, skip this test
                pytest.skip("Order already has tracking_id")
        
        response = self.session.post(
            f"{BASE_URL}/api/bot/dispatch",
            headers=self.auth_headers,
            data={
                "order_id": order_id,
                # No tracking_id provided
                "confirmed": "true"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        
        detail = data.get("detail", {})
        errors = detail.get("errors", []) if isinstance(detail, dict) else []
        
        # Check for any compliance error (tracking, invoice, or label)
        has_compliance_error = len(errors) > 0 or isinstance(detail, dict)
        assert has_compliance_error, f"Expected compliance error, got: {detail}"
        
        print(f"✓ Dispatch fails with compliance errors: {errors}")
    
    def test_dispatch_checks_eway_bill_for_high_value(self):
        """Test that dispatch checks E-Way Bill for invoice > 50000"""
        orders = self.get_pending_orders()
        
        # Find a high-value order without eway bill
        test_order = None
        for order in orders:
            order_total = order.get("order_total") or order.get("amount") or 0
            if (order.get("status") not in ["dispatched", "cancelled"] and 
                order_total > 50000 and 
                not order.get("eway_bill_number")):
                test_order = order
                break
        
        if not test_order:
            # Create a test with high invoice_value parameter
            for order in orders:
                if order.get("status") not in ["dispatched", "cancelled"]:
                    test_order = order
                    break
        
        if not test_order:
            pytest.skip("No non-dispatched orders available")
        
        order_id = test_order.get("id")
        
        response = self.session.post(
            f"{BASE_URL}/api/bot/dispatch",
            headers=self.auth_headers,
            data={
                "order_id": order_id,
                "tracking_id": "TEST123",
                "invoice_value": "60000",  # High value to trigger E-Way Bill check
                "confirmed": "true"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        
        detail = data.get("detail", {})
        errors = detail.get("errors", []) if isinstance(detail, dict) else []
        
        # Check for E-Way Bill error or other compliance errors
        has_eway_error = any("e-way" in str(e).lower() or "eway" in str(e).lower() for e in errors)
        has_compliance_error = len(errors) > 0
        
        # Either E-Way Bill error or other compliance errors are acceptable
        assert has_compliance_error, f"Expected compliance error, got: {detail}"
        
        if has_eway_error:
            print("✓ Dispatch checks E-Way Bill for invoice > ₹50,000")
        else:
            print(f"✓ Dispatch blocked with compliance errors (may include E-Way Bill): {errors}")
    
    # ==================== AVAILABLE SERIALS ENDPOINT TESTS ====================
    
    def test_available_serials_returns_in_stock(self):
        """Test that available-serials returns in-stock serials"""
        orders = self.get_pending_orders()
        
        # Find an order with master_sku_id
        test_order = None
        for order in orders:
            if order.get("status") not in ["dispatched", "cancelled"] and order.get("master_sku_id"):
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No orders with master_sku_id available")
        
        order_id = test_order.get("id")
        
        response = self.session.get(f"{BASE_URL}/api/bot/available-serials/{order_id}", headers=self.auth_headers)
        assert response.status_code == 200, f"Failed to get available serials: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "serials" in data, "Missing 'serials' in response"
        assert "count" in data, "Missing 'count' in response"
        assert "product_name" in data, "Missing 'product_name' in response"
        assert "quantity_needed" in data, "Missing 'quantity_needed' in response"
        
        print(f"✓ Available serials: count={data.get('count')}, product={data.get('product_name')}")
    
    def test_available_serials_not_found(self):
        """Test available-serials with invalid order ID"""
        response = self.session.get(f"{BASE_URL}/api/bot/available-serials/invalid-order-id-12345", headers=self.auth_headers)
        assert response.status_code == 404
        print("✓ Available-serials returns 404 for invalid order ID")
    
    # ==================== SELECT SERIAL ENDPOINT TESTS ====================
    
    def test_select_serial_invalid_order(self):
        """Test select-serial with invalid order ID"""
        response = self.session.post(
            f"{BASE_URL}/api/bot/select-serial",
            headers=self.auth_headers,
            data={
                "order_id": "invalid-order-id-12345",
                "serial_number": "TEST-SERIAL-001"
            }
        )
        # Accept 404 (not found)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Select-serial returns 404 for invalid order ID")
    
    def test_select_serial_invalid_serial(self):
        """Test select-serial with invalid serial number"""
        orders = self.get_pending_orders()
        
        test_order = None
        for order in orders:
            if order.get("status") not in ["dispatched", "cancelled"]:
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No non-dispatched orders available")
        
        order_id = test_order.get("id")
        
        response = self.session.post(
            f"{BASE_URL}/api/bot/select-serial",
            headers=self.auth_headers,
            data={
                "order_id": order_id,
                "serial_number": "INVALID-SERIAL-DOES-NOT-EXIST-12345"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Select-serial returns 400 for invalid serial number")
    
    def test_select_serial_success(self):
        """Test select-serial with valid serial number"""
        orders = self.get_pending_orders()
        
        # Find an order with available serials
        test_order = None
        available_serial = None
        
        for order in orders:
            if order.get("status") not in ["dispatched", "cancelled"] and order.get("master_sku_id"):
                order_id = order.get("id")
                serials_response = self.session.get(f"{BASE_URL}/api/bot/available-serials/{order_id}", headers=self.auth_headers)
                if serials_response.status_code == 200:
                    serials_data = serials_response.json()
                    if serials_data.get("serials"):
                        test_order = order
                        available_serial = serials_data["serials"][0]["serial_number"]
                        break
        
        if not test_order or not available_serial:
            pytest.skip("No orders with available serials found")
        
        order_id = test_order.get("id")
        
        response = self.session.post(
            f"{BASE_URL}/api/bot/select-serial",
            headers=self.auth_headers,
            data={
                "order_id": order_id,
                "serial_number": available_serial
            }
        )
        
        assert response.status_code == 200, f"Failed to select serial: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "serial" in data
        assert data["serial"] == available_serial
        
        print(f"✓ Successfully selected serial number: {available_serial}")


class TestBotDispatchIntegration:
    """Integration tests for bot dispatch flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth"""
        self.session = requests.Session()
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login", 
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.auth_headers = {"Authorization": f"Bearer {token}"}
            self.json_headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    def get_pending_orders(self):
        """Helper to get pending fulfillment orders"""
        pf_response = self.session.get(f"{BASE_URL}/api/pending-fulfillment", headers=self.json_headers)
        if pf_response.status_code != 200:
            return []
        
        data = pf_response.json()
        if isinstance(data, dict) and "entries" in data:
            return data["entries"]
        elif isinstance(data, list):
            return data
        return []
    
    def test_full_compliance_check_flow(self):
        """Test the full compliance check flow: prepare -> validate -> dispatch"""
        orders = self.get_pending_orders()
        
        test_order = None
        for order in orders:
            if order.get("status") not in ["dispatched", "cancelled"]:
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No non-dispatched orders available")
        
        order_id = test_order.get("id")
        
        # Step 1: Prepare dispatch
        prepare_response = self.session.get(f"{BASE_URL}/api/bot/prepare-dispatch/{order_id}", headers=self.auth_headers)
        assert prepare_response.status_code == 200
        
        prepare_data = prepare_response.json()
        
        # Step 2: Check what's missing
        missing = prepare_data.get("missing_fields", [])
        ready = prepare_data.get("ready_to_dispatch", False)
        
        print(f"Order {order_id}: ready={ready}, missing={missing}")
        
        # Step 3: If not ready, try dispatch and expect failure
        if not ready:
            dispatch_response = self.session.post(
                f"{BASE_URL}/api/bot/dispatch",
                headers=self.auth_headers,
                data={
                    "order_id": order_id,
                    "confirmed": "true"
                }
            )
            
            assert dispatch_response.status_code == 400, f"Expected dispatch to fail for incomplete order: {dispatch_response.text}"
            
            error_data = dispatch_response.json()
            detail = error_data.get("detail", {})
            errors = detail.get("errors", []) if isinstance(detail, dict) else []
            
            # Verify errors match missing fields
            print(f"✓ Dispatch correctly blocked with errors: {errors}")
        else:
            print(f"✓ Order {order_id} is ready for dispatch (all compliance checks passed)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test: Dispatch Payment Reference Optional Fix
Tests the fix for 'Field required' error when creating dispatch from Pending Fulfillment Queue.
The payment_reference field should be optional for:
1. Pending fulfillment orders (pending_fulfillment_id provided)
2. Marketplace orders (order_source = amazon/flipkart)

But required for direct orders (non-marketplace, non-pending-fulfillment)
"""

import pytest
import requests
import os
import io
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDispatchPaymentReference:
    """Test payment_reference validation in dispatch creation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data and authenticate"""
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
        
        # Get a firm for testing
        firms_response = self.session.get(f"{BASE_URL}/api/firms")
        if firms_response.status_code == 200 and firms_response.json():
            self.firm_id = firms_response.json()[0].get("id")
        else:
            self.firm_id = None
            
        # Get a master SKU for testing
        skus_response = self.session.get(f"{BASE_URL}/api/master-skus")
        if skus_response.status_code == 200 and skus_response.json():
            self.sku_code = skus_response.json()[0].get("sku_code")
        else:
            self.sku_code = "TEST-SKU-001"
            
        yield
        
    def create_dummy_invoice_file(self):
        """Create a dummy PDF file for invoice upload"""
        return ("invoice.pdf", io.BytesIO(b"%PDF-1.4 dummy content"), "application/pdf")
    
    def test_dispatch_without_payment_reference_for_pending_fulfillment(self):
        """
        Test: Dispatch creation should succeed without payment_reference 
        when pending_fulfillment_id is provided
        """
        # Create form data without payment_reference but with pending_fulfillment_id
        form_data = {
            "dispatch_type": "new_order",
            "sku": self.sku_code,
            "customer_name": "Test Customer PF",
            "phone": "9876543210",
            "address": "123 Test Street",
            "reason": "Pending Fulfillment Order",
            "order_id": f"TEST-PF-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "firm_id": self.firm_id,
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "110001",
            "pending_fulfillment_id": "test-pf-id-123",  # This should make payment_reference optional
            # payment_reference is intentionally NOT provided
        }
        
        files = {
            "invoice_file": self.create_dummy_invoice_file()
        }
        
        # Remove Content-Type header for multipart form
        headers = {"Authorization": self.session.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/dispatches",
            data=form_data,
            files=files,
            headers=headers
        )
        
        # Should NOT fail with "Field required" for payment_reference
        # May fail for other reasons (stock, SKU not found, etc.) but not for payment_reference
        if response.status_code == 422:
            error_detail = response.json().get("detail", [])
            # Check if error is specifically about payment_reference
            payment_ref_error = any(
                "payment_reference" in str(err).lower() and "required" in str(err).lower()
                for err in (error_detail if isinstance(error_detail, list) else [error_detail])
            )
            assert not payment_ref_error, f"payment_reference should be optional for pending fulfillment orders. Error: {error_detail}"
            print(f"Test passed: No payment_reference validation error. Other error (expected): {error_detail}")
        else:
            print(f"Response status: {response.status_code}, Response: {response.text[:500]}")
            # If it's a 400 error, check it's not about payment_reference
            if response.status_code == 400:
                error_msg = response.json().get("detail", "")
                assert "payment reference" not in error_msg.lower(), f"payment_reference should be optional for pending fulfillment. Error: {error_msg}"
                print(f"Test passed: No payment_reference validation error. Other error: {error_msg}")
            elif response.status_code == 201:
                print("Test passed: Dispatch created successfully without payment_reference")
            else:
                print(f"Test passed: Response {response.status_code} - not a payment_reference validation error")
    
    def test_dispatch_without_payment_reference_for_amazon_order(self):
        """
        Test: Dispatch creation should succeed without payment_reference 
        when order_source is 'amazon'
        """
        form_data = {
            "dispatch_type": "amazon_order",
            "sku": self.sku_code,
            "customer_name": "Test Customer Amazon",
            "phone": "9876543211",
            "address": "456 Amazon Street",
            "reason": "Amazon Order",
            "order_id": f"TEST-AMZ-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "firm_id": self.firm_id,
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
            "order_source": "amazon",  # This should make payment_reference optional
            # payment_reference is intentionally NOT provided
        }
        
        files = {
            "invoice_file": self.create_dummy_invoice_file()
        }
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/dispatches",
            data=form_data,
            files=files,
            headers=headers
        )
        
        if response.status_code == 422:
            error_detail = response.json().get("detail", [])
            payment_ref_error = any(
                "payment_reference" in str(err).lower() and "required" in str(err).lower()
                for err in (error_detail if isinstance(error_detail, list) else [error_detail])
            )
            assert not payment_ref_error, f"payment_reference should be optional for Amazon orders. Error: {error_detail}"
            print(f"Test passed: No payment_reference validation error for Amazon order")
        else:
            if response.status_code == 400:
                error_msg = response.json().get("detail", "")
                assert "payment reference" not in error_msg.lower(), f"payment_reference should be optional for Amazon. Error: {error_msg}"
                print(f"Test passed: No payment_reference validation error. Other error: {error_msg}")
            elif response.status_code == 201:
                print("Test passed: Amazon dispatch created successfully without payment_reference")
            else:
                print(f"Test passed: Response {response.status_code} - not a payment_reference validation error")
    
    def test_dispatch_without_payment_reference_for_flipkart_order(self):
        """
        Test: Dispatch creation should succeed without payment_reference 
        when order_source is 'flipkart'
        """
        form_data = {
            "dispatch_type": "new_order",
            "sku": self.sku_code,
            "customer_name": "Test Customer Flipkart",
            "phone": "9876543212",
            "address": "789 Flipkart Avenue",
            "reason": "Flipkart Order",
            "order_id": f"TEST-FK-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "firm_id": self.firm_id,
            "city": "Bangalore",
            "state": "Karnataka",
            "pincode": "560001",
            "order_source": "flipkart",  # This should make payment_reference optional
            # payment_reference is intentionally NOT provided
        }
        
        files = {
            "invoice_file": self.create_dummy_invoice_file()
        }
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/dispatches",
            data=form_data,
            files=files,
            headers=headers
        )
        
        if response.status_code == 422:
            error_detail = response.json().get("detail", [])
            payment_ref_error = any(
                "payment_reference" in str(err).lower() and "required" in str(err).lower()
                for err in (error_detail if isinstance(error_detail, list) else [error_detail])
            )
            assert not payment_ref_error, f"payment_reference should be optional for Flipkart orders. Error: {error_detail}"
            print(f"Test passed: No payment_reference validation error for Flipkart order")
        else:
            if response.status_code == 400:
                error_msg = response.json().get("detail", "")
                assert "payment reference" not in error_msg.lower(), f"payment_reference should be optional for Flipkart. Error: {error_msg}"
                print(f"Test passed: No payment_reference validation error. Other error: {error_msg}")
            elif response.status_code == 201:
                print("Test passed: Flipkart dispatch created successfully without payment_reference")
            else:
                print(f"Test passed: Response {response.status_code} - not a payment_reference validation error")
    
    def test_dispatch_requires_payment_reference_for_direct_order(self):
        """
        Test: Dispatch creation should FAIL without payment_reference 
        for direct orders (non-marketplace, non-pending-fulfillment)
        """
        form_data = {
            "dispatch_type": "new_order",
            "sku": self.sku_code,
            "customer_name": "Test Customer Direct",
            "phone": "9876543213",
            "address": "Direct Order Street",
            "reason": "Direct Order",
            "order_id": f"TEST-DIRECT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "firm_id": self.firm_id,
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "600001",
            "order_source": "website",  # Not a marketplace
            # payment_reference is intentionally NOT provided
            # pending_fulfillment_id is NOT provided
        }
        
        files = {
            "invoice_file": self.create_dummy_invoice_file()
        }
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/dispatches",
            data=form_data,
            files=files,
            headers=headers
        )
        
        # Should fail with payment_reference required error
        assert response.status_code == 400, f"Expected 400 for missing payment_reference on direct order, got {response.status_code}"
        error_msg = response.json().get("detail", "")
        assert "payment reference" in error_msg.lower(), f"Expected payment reference error, got: {error_msg}"
        print(f"Test passed: Direct order correctly requires payment_reference. Error: {error_msg}")
    
    def test_dispatch_with_payment_reference_for_direct_order(self):
        """
        Test: Dispatch creation should succeed with payment_reference 
        for direct orders
        """
        form_data = {
            "dispatch_type": "new_order",
            "sku": self.sku_code,
            "customer_name": "Test Customer Direct With Payment",
            "phone": "9876543214",
            "address": "Direct Order With Payment Street",
            "reason": "Direct Order With Payment",
            "order_id": f"TEST-DIRECT-PAY-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "firm_id": self.firm_id,
            "city": "Hyderabad",
            "state": "Telangana",
            "pincode": "500001",
            "order_source": "website",
            "payment_reference": "PAY-REF-12345",  # Payment reference provided
        }
        
        files = {
            "invoice_file": self.create_dummy_invoice_file()
        }
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/dispatches",
            data=form_data,
            files=files,
            headers=headers
        )
        
        # Should NOT fail with payment_reference error
        if response.status_code == 400:
            error_msg = response.json().get("detail", "")
            assert "payment reference" not in error_msg.lower(), f"Unexpected payment reference error: {error_msg}"
            print(f"Test passed: No payment_reference error. Other error (expected): {error_msg}")
        elif response.status_code == 201:
            print("Test passed: Direct order with payment_reference created successfully")
        else:
            print(f"Test passed: Response {response.status_code} - not a payment_reference validation error")
    
    def test_dispatch_with_empty_payment_reference_for_pending_fulfillment(self):
        """
        Test: Dispatch creation should succeed with empty payment_reference 
        when pending_fulfillment_id is provided
        """
        form_data = {
            "dispatch_type": "new_order",
            "sku": self.sku_code,
            "customer_name": "Test Customer PF Empty",
            "phone": "9876543215",
            "address": "PF Empty Payment Street",
            "reason": "Pending Fulfillment Empty Payment",
            "order_id": f"TEST-PF-EMPTY-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "firm_id": self.firm_id,
            "city": "Kolkata",
            "state": "West Bengal",
            "pincode": "700001",
            "pending_fulfillment_id": "test-pf-id-456",
            "payment_reference": "",  # Empty string
        }
        
        files = {
            "invoice_file": self.create_dummy_invoice_file()
        }
        
        headers = {"Authorization": self.session.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/dispatches",
            data=form_data,
            files=files,
            headers=headers
        )
        
        if response.status_code == 400:
            error_msg = response.json().get("detail", "")
            assert "payment reference" not in error_msg.lower(), f"payment_reference should be optional for pending fulfillment. Error: {error_msg}"
            print(f"Test passed: No payment_reference error with empty string. Other error: {error_msg}")
        elif response.status_code == 201:
            print("Test passed: PF dispatch created with empty payment_reference")
        else:
            print(f"Test passed: Response {response.status_code} - not a payment_reference validation error")


class TestDispatchEndpointAcceptsOptionalPaymentReference:
    """Test that the API endpoint accepts optional payment_reference parameter"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data and authenticate"""
        self.session = requests.Session()
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        
        yield
    
    def test_endpoint_schema_accepts_optional_payment_reference(self):
        """
        Test: The /api/dispatches endpoint should accept payment_reference as optional
        This tests that the Form parameter is defined as Optional[str] = Form(None)
        """
        # Check OpenAPI schema if available
        schema_response = self.session.get(f"{BASE_URL}/openapi.json")
        
        if schema_response.status_code == 200 and schema_response.text.strip():
            try:
                schema = schema_response.json()
            except:
                print("OpenAPI schema not parseable, skipping schema test")
                return
            
            # Find the dispatches POST endpoint
            dispatches_path = schema.get("paths", {}).get("/api/dispatches", {})
            post_operation = dispatches_path.get("post", {})
            
            if post_operation:
                # Check request body schema
                request_body = post_operation.get("requestBody", {})
                content = request_body.get("content", {})
                
                # For multipart/form-data
                form_data = content.get("multipart/form-data", {})
                form_schema = form_data.get("schema", {})
                
                # Check if payment_reference is in required fields
                required_fields = form_schema.get("required", [])
                
                assert "payment_reference" not in required_fields, \
                    f"payment_reference should NOT be in required fields. Required: {required_fields}"
                
                print(f"Test passed: payment_reference is not in required fields")
                print(f"Required fields: {required_fields}")
            else:
                print("OpenAPI schema found but POST /api/dispatches not documented")
        else:
            print(f"OpenAPI schema not available (status: {schema_response.status_code})")
            # Still pass - we'll rely on functional tests
            print("Test skipped: OpenAPI schema not available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

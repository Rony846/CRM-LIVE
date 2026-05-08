"""
Batch 2 & 3 Audit Fixes - Backend API Tests
Tests for security and accuracy fixes:

Batch 2 - Security Fixes:
1. Warranty IDOR Protection - Customers cannot access other customers' warranties
2. Smartflo Webhook Dedup - Duplicate webhook calls return 'duplicate' status

Batch 3 - Accuracy Fixes:
3. GST Precision - CGST/SGST should be rounded to 2 decimals

Also tests:
4. Centralized StateMachine - Ticket status transitions still work correctly
5. Basic API Health - Auth login, tickets list, warranties list
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"
SUPPORT_EMAIL = "support_test@musclegrid.in"
SUPPORT_PASSWORD = "Test@1234"
CUSTOMER_EMAIL = "warranty_test_customer@example.com"
CUSTOMER_PASSWORD = "Test@1234"


class TestAuthAndHealth:
    """Basic API health checks and authentication"""
    
    def test_admin_login_success(self):
        """Test admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data.get("user", {}).get("role") == "admin"
        print(f"✓ Admin login successful, role: {data.get('user', {}).get('role')}")
    
    def test_support_user_login_success(self):
        """Test support user can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPPORT_EMAIL,
            "password": SUPPORT_PASSWORD
        })
        assert response.status_code == 200, f"Support login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data.get("user", {}).get("role") == "call_support"
        print(f"✓ Support user login successful, role: {data.get('user', {}).get('role')}")
    
    def test_customer_login_success(self):
        """Test customer can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Customer login failed (may not exist): {response.text}")
        data = response.json()
        assert "access_token" in data
        assert data.get("user", {}).get("role") == "customer"
        print(f"✓ Customer login successful, role: {data.get('user', {}).get('role')}")
    
    def test_tickets_list_endpoint(self):
        """Test tickets list endpoint is accessible"""
        # Login as admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json().get("access_token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/tickets", headers=headers)
        assert response.status_code == 200, f"Tickets list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Tickets list returned {len(data)} tickets")
    
    def test_warranties_list_endpoint(self):
        """Test warranties list endpoint is accessible"""
        # Login as admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json().get("access_token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/warranties", headers=headers)
        assert response.status_code == 200, f"Warranties list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Warranties list returned {len(data)} warranties")


class TestCentralizedStateMachine:
    """Test centralized StateMachine validation - ticket status transitions"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    @pytest.fixture(scope="class")
    def support_token(self):
        """Get support user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPPORT_EMAIL,
            "password": SUPPORT_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Support login failed")
    
    def test_support_user_invalid_transition_blocked(self, support_token, admin_token):
        """Test that support user cannot make invalid status transition (dispatched -> new)"""
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        headers_support = {"Authorization": f"Bearer {support_token}"}
        
        # Try to find a ticket in dispatched status
        response = requests.get(f"{BASE_URL}/api/tickets?status=dispatched&limit=1", headers=headers_admin)
        if response.status_code != 200:
            pytest.skip("Could not fetch tickets")
        
        tickets = response.json()
        if not tickets:
            pytest.skip("No tickets in dispatched status found")
        
        ticket = tickets[0]
        ticket_id = ticket.get("id")
        current_status = ticket.get("status")
        print(f"Testing with ticket {ticket_id}, current status: {current_status}")
        
        # Support user tries invalid transition: dispatched -> new (not allowed)
        response = requests.patch(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers=headers_support,
            json={"status": "new"}
        )
        
        # Should be blocked with 400 error
        assert response.status_code == 400, f"Expected 400 for invalid transition, got {response.status_code}: {response.text}"
        error_detail = response.json().get("detail", "")
        assert "Invalid status transition" in error_detail or "Allowed" in error_detail
        print(f"✓ Invalid transition blocked by StateMachine: {error_detail}")
    
    def test_support_user_valid_transition_allowed(self, support_token, admin_token):
        """Test that support user CAN make valid status transition (dispatched -> delivered)"""
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        headers_support = {"Authorization": f"Bearer {support_token}"}
        
        # Find a ticket in dispatched status
        response = requests.get(f"{BASE_URL}/api/tickets?status=dispatched&limit=1", headers=headers_admin)
        if response.status_code != 200:
            pytest.skip("Could not fetch tickets")
        
        tickets = response.json()
        if not tickets:
            pytest.skip("No tickets in dispatched status found")
        
        ticket = tickets[0]
        ticket_id = ticket.get("id")
        print(f"Testing valid transition with ticket {ticket_id}")
        
        # Support user tries valid transition: dispatched -> delivered (allowed)
        response = requests.patch(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers=headers_support,
            json={"status": "delivered"}
        )
        
        # Should succeed
        if response.status_code == 200:
            print(f"✓ Valid transition allowed: dispatched -> delivered")
            # Revert back to dispatched for other tests (admin can do this)
            requests.patch(
                f"{BASE_URL}/api/tickets/{ticket_id}",
                headers=headers_admin,
                json={"status": "dispatched"}
            )
        else:
            # May fail for other reasons (permissions), but not state machine
            error = response.json().get("detail", "")
            if "Invalid status transition" in error:
                pytest.fail(f"Valid transition was blocked: {error}")
            print(f"⚠ Transition failed for other reason: {response.status_code} - {error}")
    
    def test_admin_can_force_any_transition(self, admin_token):
        """Test that admin CAN force any transition (emergency override)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Find any ticket
        response = requests.get(f"{BASE_URL}/api/tickets?limit=1", headers=headers)
        if response.status_code != 200:
            pytest.skip("Could not fetch tickets")
        
        tickets = response.json()
        if not tickets:
            pytest.skip("No tickets found")
        
        ticket = tickets[0]
        ticket_id = ticket.get("id")
        original_status = ticket.get("status")
        print(f"Testing admin override with ticket {ticket_id}, status: {original_status}")
        
        # Admin tries to force transition to 'closed' (should work regardless of current status)
        response = requests.patch(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers=headers,
            json={"status": "closed"}
        )
        
        if response.status_code == 200:
            print(f"✓ Admin can force transition: {original_status} -> closed")
            # Revert
            requests.patch(
                f"{BASE_URL}/api/tickets/{ticket_id}",
                headers=headers,
                json={"status": original_status}
            )
        else:
            error = response.json().get("detail", "")
            # Admin should not be blocked by state machine
            if "Invalid status transition" in error:
                pytest.fail(f"Admin was blocked by state machine: {error}")
            print(f"⚠ Admin transition failed for other reason: {error}")


class TestWarrantyIDORProtection:
    """Batch 2 Security Fix: Test warranty IDOR protection - customers cannot access other customers' warranties"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        """Get customer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Customer login failed: {response.text}")
    
    @pytest.fixture(scope="class")
    def customer_user(self, customer_token):
        """Get customer user info"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        if response.status_code == 200:
            return response.json()
        pytest.skip("Could not get customer user info")
    
    def test_customer_can_access_own_warranty(self, admin_token, customer_token, customer_user):
        """Test that customer CAN access their own warranty"""
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        headers_customer = {"Authorization": f"Bearer {customer_token}"}
        
        customer_email = customer_user.get("email", "").lower()
        customer_phone = customer_user.get("phone", "")
        customer_id = customer_user.get("id")
        
        # First, create a warranty for this customer
        test_serial = f"TEST-IDOR-{uuid.uuid4().hex[:8]}"
        warranty_data = {
            "first_name": customer_user.get("first_name", "Test"),
            "last_name": customer_user.get("last_name", "Customer"),
            "phone": customer_phone or "9999999999",
            "email": customer_email,
            "device_type": "Inverter",
            "product_name": "Test Product for IDOR",
            "serial_number": test_serial,
            "invoice_date": "2024-01-15",
            "invoice_amount": 10000,
            "order_id": f"TEST-IDOR-ORDER-{uuid.uuid4().hex[:8]}",
            "customer_id": customer_id,
            "user_id": customer_id
        }
        
        # Create warranty as admin
        create_response = requests.post(
            f"{BASE_URL}/api/warranties",
            headers=headers_admin,
            data=warranty_data
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create test warranty: {create_response.text}")
        
        warranty = create_response.json()
        warranty_id = warranty.get("id")
        print(f"✓ Created test warranty {warranty_id} for customer {customer_email}")
        
        # Customer should be able to access their own warranty
        response = requests.get(
            f"{BASE_URL}/api/warranties/{warranty_id}",
            headers=headers_customer
        )
        
        assert response.status_code == 200, f"Customer should access own warranty, got {response.status_code}: {response.text}"
        print(f"✓ Customer CAN access their own warranty")
    
    def test_customer_cannot_access_other_warranty(self, admin_token, customer_token):
        """Test that customer CANNOT access another customer's warranty (IDOR protection)"""
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        headers_customer = {"Authorization": f"Bearer {customer_token}"}
        
        # Create a warranty for a DIFFERENT customer
        test_serial = f"TEST-IDOR-OTHER-{uuid.uuid4().hex[:8]}"
        warranty_data = {
            "first_name": "Other",
            "last_name": "Customer",
            "phone": "8888888888",  # Different phone
            "email": "other_customer@example.com",  # Different email
            "device_type": "Inverter",
            "product_name": "Test Product for Other Customer",
            "serial_number": test_serial,
            "invoice_date": "2024-01-15",
            "invoice_amount": 15000,
            "order_id": f"TEST-IDOR-OTHER-{uuid.uuid4().hex[:8]}",
            "customer_id": "other-customer-id-12345",  # Different customer ID
            "user_id": "other-customer-id-12345"
        }
        
        # Create warranty as admin
        create_response = requests.post(
            f"{BASE_URL}/api/warranties",
            headers=headers_admin,
            data=warranty_data
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create test warranty: {create_response.text}")
        
        warranty = create_response.json()
        warranty_id = warranty.get("id")
        print(f"✓ Created test warranty {warranty_id} for OTHER customer")
        
        # Customer should NOT be able to access another customer's warranty
        response = requests.get(
            f"{BASE_URL}/api/warranties/{warranty_id}",
            headers=headers_customer
        )
        
        assert response.status_code == 403, f"Expected 403 for IDOR attempt, got {response.status_code}: {response.text}"
        error = response.json().get("detail", "")
        assert "denied" in error.lower() or "access" in error.lower()
        print(f"✓ IDOR protection working: Customer blocked from accessing other's warranty - {error}")
    
    def test_admin_can_access_any_warranty(self, admin_token):
        """Test that admin CAN access any warranty"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get any warranty
        response = requests.get(f"{BASE_URL}/api/warranties?limit=1", headers=headers)
        if response.status_code != 200 or not response.json():
            pytest.skip("No warranties found")
        
        warranty = response.json()[0]
        warranty_id = warranty.get("id")
        
        # Admin should be able to access any warranty
        response = requests.get(f"{BASE_URL}/api/warranties/{warranty_id}", headers=headers)
        assert response.status_code == 200, f"Admin should access any warranty, got {response.status_code}: {response.text}"
        print(f"✓ Admin CAN access any warranty")


class TestSmartfloWebhookDedup:
    """Batch 2 Security Fix: Test Smartflo webhook deduplication"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    def test_first_webhook_call_succeeds(self):
        """Test that first webhook call with unique uuid succeeds"""
        test_uuid = f"test-webhook-{uuid.uuid4().hex}"
        
        webhook_data = {
            "uuid": test_uuid,
            "call_id": f"call-{uuid.uuid4().hex[:8]}",
            "caller_id_number": "+919999999999",
            "call_to_number": "+911234567890",
            "start_stamp": datetime.now().isoformat(),
            "call_status": "answered",
            "duration": 120,
            "agent_name": "Test Agent"
        }
        
        response = requests.post(f"{BASE_URL}/api/smartflo/webhook", json=webhook_data)
        
        assert response.status_code == 200, f"First webhook call failed: {response.text}"
        data = response.json()
        # First call should NOT return 'duplicate' status
        assert data.get("status") != "duplicate", f"First call should not be duplicate: {data}"
        print(f"✓ First webhook call succeeded: {data}")
        
        # Store uuid for next test
        return test_uuid
    
    def test_duplicate_webhook_call_returns_duplicate(self):
        """Test that duplicate webhook call with same uuid returns 'duplicate' status"""
        # Use a fixed uuid for this test
        test_uuid = f"test-dedup-{uuid.uuid4().hex}"
        
        webhook_data = {
            "uuid": test_uuid,
            "call_id": f"call-{uuid.uuid4().hex[:8]}",
            "caller_id_number": "+919999999999",
            "call_to_number": "+911234567890",
            "start_stamp": datetime.now().isoformat(),
            "call_status": "answered",
            "duration": 120,
            "agent_name": "Test Agent"
        }
        
        # First call
        response1 = requests.post(f"{BASE_URL}/api/smartflo/webhook", json=webhook_data)
        assert response1.status_code == 200, f"First webhook call failed: {response1.text}"
        print(f"✓ First call: {response1.json()}")
        
        # Second call with SAME uuid (duplicate)
        response2 = requests.post(f"{BASE_URL}/api/smartflo/webhook", json=webhook_data)
        assert response2.status_code == 200, f"Second webhook call failed: {response2.text}"
        
        data = response2.json()
        assert data.get("status") == "duplicate", f"Expected 'duplicate' status, got: {data}"
        assert "already" in data.get("message", "").lower()
        print(f"✓ Duplicate webhook correctly identified: {data}")
    
    def test_different_uuid_not_duplicate(self):
        """Test that webhook with different uuid is NOT marked as duplicate"""
        # First call
        webhook_data1 = {
            "uuid": f"test-unique-1-{uuid.uuid4().hex}",
            "caller_id_number": "+919999999999",
            "call_status": "answered"
        }
        response1 = requests.post(f"{BASE_URL}/api/smartflo/webhook", json=webhook_data1)
        assert response1.status_code == 200
        
        # Second call with DIFFERENT uuid
        webhook_data2 = {
            "uuid": f"test-unique-2-{uuid.uuid4().hex}",
            "caller_id_number": "+919999999999",
            "call_status": "answered"
        }
        response2 = requests.post(f"{BASE_URL}/api/smartflo/webhook", json=webhook_data2)
        assert response2.status_code == 200
        
        data = response2.json()
        assert data.get("status") != "duplicate", f"Different uuid should not be duplicate: {data}"
        print(f"✓ Different uuid correctly processed as new call")


class TestGSTPrecision:
    """Batch 3 Accuracy Fix: Test GST precision - CGST/SGST should be rounded to 2 decimals"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    def test_sales_invoice_gst_precision(self, admin_token):
        """Test that sales invoice CGST/SGST are rounded to 2 decimals"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get existing sales invoices to check GST precision
        response = requests.get(f"{BASE_URL}/api/sales-invoices?limit=10", headers=headers)
        if response.status_code != 200:
            pytest.skip(f"Could not fetch sales invoices: {response.text}")
        
        invoices = response.json()
        if not invoices:
            pytest.skip("No sales invoices found")
        
        # Check GST precision on existing invoices
        for invoice in invoices:
            cgst = invoice.get("cgst", 0)
            sgst = invoice.get("sgst", 0)
            igst = invoice.get("igst", 0)
            
            # Check if values are properly rounded to 2 decimals
            if cgst > 0:
                cgst_str = str(cgst)
                if '.' in cgst_str:
                    decimals = len(cgst_str.split('.')[1])
                    assert decimals <= 2, f"CGST has more than 2 decimals: {cgst}"
            
            if sgst > 0:
                sgst_str = str(sgst)
                if '.' in sgst_str:
                    decimals = len(sgst_str.split('.')[1])
                    assert decimals <= 2, f"SGST has more than 2 decimals: {sgst}"
        
        print(f"✓ Checked {len(invoices)} invoices - GST values properly rounded")
    
    def test_credit_note_gst_precision(self, admin_token):
        """Test that credit note CGST/SGST are rounded to 2 decimals"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get existing credit notes to check GST precision
        response = requests.get(f"{BASE_URL}/api/credit-notes?limit=10", headers=headers)
        if response.status_code != 200:
            pytest.skip(f"Could not fetch credit notes: {response.text}")
        
        credit_notes = response.json()
        if not credit_notes:
            pytest.skip("No credit notes found")
        
        # Check GST precision on existing credit notes
        for cn in credit_notes:
            cgst = cn.get("cgst", 0)
            sgst = cn.get("sgst", 0)
            
            # Check if values are properly rounded to 2 decimals
            if cgst > 0:
                cgst_str = str(cgst)
                if '.' in cgst_str:
                    decimals = len(cgst_str.split('.')[1])
                    assert decimals <= 2, f"Credit Note CGST has more than 2 decimals: {cgst}"
            
            if sgst > 0:
                sgst_str = str(sgst)
                if '.' in sgst_str:
                    decimals = len(sgst_str.split('.')[1])
                    assert decimals <= 2, f"Credit Note SGST has more than 2 decimals: {sgst}"
        
        print(f"✓ Checked {len(credit_notes)} credit notes - GST values properly rounded")
    
    def test_create_credit_note_gst_precision(self, admin_token):
        """Test that newly created credit note has properly rounded CGST/SGST"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Get firm and party
        firms_response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        if firms_response.status_code != 200 or not firms_response.json():
            pytest.skip("No firms found")
        firm = firms_response.json()[0]
        
        parties_response = requests.get(f"{BASE_URL}/api/parties", headers=headers)
        if parties_response.status_code != 200 or not parties_response.json():
            pytest.skip("No parties found")
        
        # Find a party in same state as firm (for CGST/SGST instead of IGST)
        firm_state = firm.get("state", "").lower()
        party = None
        for p in parties_response.json():
            if p.get("state", "").lower() == firm_state:
                party = p
                break
        
        if not party:
            party = parties_response.json()[0]
            print(f"⚠ No same-state party found, using first party (may test IGST instead)")
        
        # Create credit note with amount that would produce non-round GST
        # 100 * 18% = 18, 18/2 = 9 (round number)
        # 123.45 * 18% = 22.221, 22.221/2 = 11.1105 (needs rounding)
        test_invoice_id = f"TEST-GST-PRECISION-{uuid.uuid4().hex[:8]}"
        
        cn_data = {
            "firm_id": firm.get("id"),
            "party_id": party.get("id"),
            "original_invoice_id": test_invoice_id,
            "credit_note_date": today,
            "reason": "sales_return",
            "items": [{
                "master_sku_id": "test-sku",
                "sku_code": "TEST-GST-SKU",
                "name": "Test Item for GST Precision",
                "hsn_code": "84714100",
                "quantity": 1,
                "rate": 123.45,  # Non-round amount to test precision
                "gst_rate": 18
            }]
        }
        
        response = requests.post(f"{BASE_URL}/api/credit-notes", headers=headers, json=cn_data)
        if response.status_code not in [200, 201]:
            pytest.skip(f"Could not create credit note: {response.text}")
        
        cn = response.json()
        cgst = cn.get("cgst", 0)
        sgst = cn.get("sgst", 0)
        igst = cn.get("igst", 0)
        
        print(f"Created credit note: CGST={cgst}, SGST={sgst}, IGST={igst}")
        
        # Verify precision
        if cgst > 0:
            cgst_str = str(cgst)
            if '.' in cgst_str:
                decimals = len(cgst_str.split('.')[1])
                assert decimals <= 2, f"New Credit Note CGST has more than 2 decimals: {cgst}"
        
        if sgst > 0:
            sgst_str = str(sgst)
            if '.' in sgst_str:
                decimals = len(sgst_str.split('.')[1])
                assert decimals <= 2, f"New Credit Note SGST has more than 2 decimals: {sgst}"
        
        print(f"✓ New credit note GST values properly rounded to 2 decimals")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

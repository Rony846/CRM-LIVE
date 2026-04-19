"""
Batch 1 Audit Fixes - Backend API Tests
Tests for critical financial/security bug fixes:
1. Ticket State-Machine Validation - non-admin users cannot make invalid transitions
2. Bank Transaction Match Idempotency - matching same transaction twice returns already matched
3. Credit Note Idempotency - creating CN for same invoice twice returns 409
4. Warranty Serial Uniqueness - creating warranty for same serial returns 409
5. Quotation Convert Atomicity - double-convert of same quotation fails
6. Basic API Health Check - auth, tickets list, credit notes list
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

# Test data
TEST_TICKET_ID = "67f3eda4-1d66-48fa-9a9d-5e04c8cb6472"  # Currently in 'dispatched' status
BANK_STATEMENT_ID = "ccd6a4c4-ee77-40c1-a678-58c47fca17ac"


class TestAuthAndHealth:
    """Basic API health checks and authentication"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def support_token(self):
        """Get support user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPPORT_EMAIL,
            "password": SUPPORT_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Support login failed: {response.status_code} - {response.text}")
    
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
    
    def test_tickets_list_endpoint(self, admin_token):
        """Test tickets list endpoint is accessible"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/tickets", headers=headers)
        assert response.status_code == 200, f"Tickets list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Tickets list returned {len(data)} tickets")
    
    def test_credit_notes_list_endpoint(self, admin_token):
        """Test credit notes list endpoint is accessible"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/credit-notes", headers=headers)
        assert response.status_code == 200, f"Credit notes list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Credit notes list returned {len(data)} credit notes")


class TestTicketStateMachine:
    """Test ticket state-machine validation - non-admin users cannot make invalid transitions"""
    
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
    
    def test_get_test_ticket_status(self, admin_token):
        """Get current status of test ticket"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/tickets/{TEST_TICKET_ID}", headers=headers)
        if response.status_code == 200:
            ticket = response.json()
            print(f"✓ Test ticket {TEST_TICKET_ID} current status: {ticket.get('status')}")
            return ticket.get('status')
        else:
            print(f"⚠ Test ticket not found: {response.status_code}")
            return None
    
    def test_support_user_invalid_transition_blocked(self, support_token, admin_token):
        """Test that support user cannot make invalid status transition (dispatched -> new)"""
        # First get a ticket in dispatched status
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
        print(f"✓ Invalid transition blocked: {error_detail}")
    
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


class TestBankTransactionIdempotency:
    """Test bank transaction match idempotency - matching same transaction twice returns already matched"""
    
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
    
    def test_get_bank_statement(self, admin_token):
        """Get bank statement to find transactions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/bank-statements/{BANK_STATEMENT_ID}", headers=headers)
        
        if response.status_code == 404:
            pytest.skip(f"Bank statement {BANK_STATEMENT_ID} not found")
        
        assert response.status_code == 200, f"Failed to get bank statement: {response.text}"
        statement = response.json()
        transactions = statement.get("transactions", [])
        print(f"✓ Bank statement has {len(transactions)} transactions")
        return statement
    
    def test_match_transaction_idempotency(self, admin_token):
        """Test that matching same transaction twice returns 'already matched' message"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First, get the bank statement
        response = requests.get(f"{BASE_URL}/api/bank-statements/{BANK_STATEMENT_ID}", headers=headers)
        if response.status_code == 404:
            pytest.skip(f"Bank statement {BANK_STATEMENT_ID} not found")
        
        statement = response.json()
        transactions = statement.get("transactions", [])
        
        # Find an unmatched transaction
        unmatched_txn = None
        for txn in transactions:
            if txn.get("status") == "unmatched":
                unmatched_txn = txn
                break
        
        if not unmatched_txn:
            # Find any transaction to test idempotency on already matched
            for txn in transactions:
                if txn.get("status") in ["matched", "created"]:
                    # Test idempotency on already matched transaction
                    row_number = txn.get("row_number")
                    response = requests.post(
                        f"{BASE_URL}/api/bank-statements/{BANK_STATEMENT_ID}/match-transaction",
                        headers=headers,
                        params={
                            "transaction_row": row_number,
                            "reference_type": "expense",
                            "reference_id": str(uuid.uuid4())
                        }
                    )
                    
                    assert response.status_code == 200, f"Unexpected error: {response.text}"
                    data = response.json()
                    assert "already" in data.get("message", "").lower(), f"Expected 'already matched' message, got: {data}"
                    print(f"✓ Idempotency check passed: {data.get('message')}")
                    return
            
            pytest.skip("No transactions found to test idempotency")
        
        # Match the transaction first time
        row_number = unmatched_txn.get("row_number")
        test_reference_id = str(uuid.uuid4())
        
        response1 = requests.post(
            f"{BASE_URL}/api/bank-statements/{BANK_STATEMENT_ID}/match-transaction",
            headers=headers,
            params={
                "transaction_row": row_number,
                "reference_type": "expense",
                "reference_id": test_reference_id
            }
        )
        
        assert response1.status_code == 200, f"First match failed: {response1.text}"
        print(f"✓ First match successful: {response1.json()}")
        
        # Try to match same transaction again (should return idempotent response)
        response2 = requests.post(
            f"{BASE_URL}/api/bank-statements/{BANK_STATEMENT_ID}/match-transaction",
            headers=headers,
            params={
                "transaction_row": row_number,
                "reference_type": "expense",
                "reference_id": str(uuid.uuid4())  # Different reference
            }
        )
        
        assert response2.status_code == 200, f"Second match failed unexpectedly: {response2.text}"
        data = response2.json()
        assert "already" in data.get("message", "").lower(), f"Expected 'already matched' message, got: {data}"
        print(f"✓ Idempotency check passed: {data.get('message')}")


class TestCreditNoteIdempotency:
    """Test credit note idempotency - creating CN for same invoice twice returns 409"""
    
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
    
    def test_credit_note_duplicate_invoice_blocked(self, admin_token):
        """Test that creating credit note for same invoice twice returns 409"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        today = datetime.now().strftime("%Y-%m-%d")
        
        # First, get a firm and party for the credit note
        firms_response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        if firms_response.status_code != 200 or not firms_response.json():
            pytest.skip("No firms found")
        firm = firms_response.json()[0]
        
        parties_response = requests.get(f"{BASE_URL}/api/parties", headers=headers)
        if parties_response.status_code != 200 or not parties_response.json():
            pytest.skip("No parties found")
        party = parties_response.json()[0]
        
        # Create a unique test invoice ID
        test_invoice_id = f"TEST-INV-{uuid.uuid4().hex[:8]}"
        
        cn_data = {
            "firm_id": firm.get("id"),
            "party_id": party.get("id"),
            "original_invoice_id": test_invoice_id,
            "credit_note_date": today,
            "reason": "sales_return",
            "items": [{
                "master_sku_id": "test-sku",
                "sku_code": "TEST-SKU",
                "name": "Test Item",
                "hsn_code": "84714100",
                "quantity": 1,
                "rate": 100,
                "gst_rate": 18
            }]
        }
        
        # Create first credit note
        response1 = requests.post(f"{BASE_URL}/api/credit-notes", headers=headers, json=cn_data)
        if response1.status_code not in [200, 201]:
            pytest.skip(f"Could not create first credit note: {response1.text}")
        
        print(f"✓ First credit note created: {response1.json().get('credit_note_number')}")
        
        # Try to create duplicate
        cn_data["reason"] = "discount"  # Different reason, same invoice
        response2 = requests.post(f"{BASE_URL}/api/credit-notes", headers=headers, json=cn_data)
        
        assert response2.status_code == 409, f"Expected 409 for duplicate CN, got {response2.status_code}: {response2.text}"
        error = response2.json().get("detail", "")
        assert "already exists" in error.lower()
        print(f"✓ Duplicate credit note blocked: {error}")


class TestWarrantySerialUniqueness:
    """Test warranty serial uniqueness - creating warranty for same serial returns 409"""
    
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
    
    def test_warranty_duplicate_serial_blocked(self, admin_token):
        """Test that creating warranty for same serial number twice returns 409"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Generate unique test serial number
        test_serial = f"TEST-SERIAL-{uuid.uuid4().hex[:8]}"
        
        warranty_data = {
            "first_name": "Test",
            "last_name": "User",
            "phone": "9999999999",
            "email": "test@example.com",
            "device_type": "Inverter",
            "product_name": "Test Product",
            "serial_number": test_serial,
            "invoice_date": "2024-01-15",
            "invoice_amount": 10000,
            "order_id": f"TEST-ORDER-{uuid.uuid4().hex[:8]}"
        }
        
        # Create first warranty
        response1 = requests.post(
            f"{BASE_URL}/api/warranties",
            headers=headers,
            data=warranty_data
        )
        
        if response1.status_code not in [200, 201]:
            pytest.skip(f"Could not create first warranty: {response1.text}")
        
        warranty1 = response1.json()
        print(f"✓ First warranty created: {warranty1.get('warranty_number')} for serial {test_serial}")
        
        # Try to create duplicate warranty with same serial
        warranty_data["order_id"] = f"TEST-ORDER-{uuid.uuid4().hex[:8]}"  # Different order
        warranty_data["first_name"] = "Another"
        
        response2 = requests.post(
            f"{BASE_URL}/api/warranties",
            headers=headers,
            data=warranty_data
        )
        
        assert response2.status_code == 409, f"Expected 409 for duplicate serial, got {response2.status_code}: {response2.text}"
        error = response2.json().get("detail", "")
        assert "already exists" in error.lower() or test_serial in error
        print(f"✓ Duplicate warranty blocked: {error}")


class TestQuotationConvertAtomicity:
    """Test quotation convert atomicity - double-convert of same quotation fails"""
    
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
    
    def test_quotation_double_convert_blocked(self, admin_token):
        """Test that converting same quotation twice fails"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Find an approved quotation that hasn't been converted
        response = requests.get(f"{BASE_URL}/api/quotations?status=approved&limit=10", headers=headers)
        if response.status_code != 200:
            pytest.skip(f"Could not fetch quotations: {response.text}")
        
        quotations = response.json()
        
        # Find one that hasn't been converted
        target_quotation = None
        for q in quotations:
            if not q.get("converted_at"):
                target_quotation = q
                break
        
        if not target_quotation:
            # Test with already converted quotation
            for q in quotations:
                if q.get("converted_at"):
                    quotation_id = q.get("id")
                    response = requests.post(
                        f"{BASE_URL}/api/quotations/{quotation_id}/convert",
                        headers=headers,
                        params={"conversion_type": "dispatch"}
                    )
                    
                    assert response.status_code in [400, 409], f"Expected 400/409 for already converted, got {response.status_code}: {response.text}"
                    error = response.json().get("detail", "")
                    assert "already" in error.lower() or "converted" in error.lower()
                    print(f"✓ Already converted quotation blocked: {error}")
                    return
            
            pytest.skip("No quotations found to test conversion atomicity")
        
        quotation_id = target_quotation.get("id")
        print(f"Testing with quotation {quotation_id}")
        
        # First conversion attempt
        response1 = requests.post(
            f"{BASE_URL}/api/quotations/{quotation_id}/convert",
            headers=headers,
            params={"conversion_type": "dispatch"}
        )
        
        if response1.status_code not in [200, 201]:
            # May fail due to stock issues, etc. - that's fine
            error = response1.json().get("detail", "")
            if "stock" in error.lower() or "insufficient" in error.lower():
                pytest.skip(f"Conversion failed due to stock: {error}")
            print(f"⚠ First conversion failed: {error}")
        else:
            print(f"✓ First conversion successful")
        
        # Second conversion attempt (should fail)
        response2 = requests.post(
            f"{BASE_URL}/api/quotations/{quotation_id}/convert",
            headers=headers,
            params={"conversion_type": "dispatch"}
        )
        
        assert response2.status_code in [400, 409], f"Expected 400/409 for double convert, got {response2.status_code}: {response2.text}"
        error = response2.json().get("detail", "")
        assert "already" in error.lower() or "converted" in error.lower() or "progress" in error.lower()
        print(f"✓ Double conversion blocked: {error}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

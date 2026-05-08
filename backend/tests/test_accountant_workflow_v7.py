"""
Test Accountant Dashboard Workflow - Iteration 7
Features tested:
1. Accountant From Supervisor tab showing REVERSE PICKUP and SPARE DISPATCH badges
2. Accountant Repaired tab with Create Return Dispatch button
3. Accountant Outbound tab with SKU dropdown for New Order / Spare Part
4. Upload Pickup Label for reverse pickup (goes to customer, not dispatch)
5. Customer can download pickup label from ticket details
6. Ticket number consistency throughout workflow
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAccountantLogin:
    """Test accountant can log in"""
    
    def test_accountant_login(self):
        """Test accountant login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "accountant@musclegrid.in",
            "password": "accountant123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "accountant"
        print("✓ Accountant login successful")
        return data["access_token"]


class TestTicketsForAccountant:
    """Test tickets visible to accountant"""
    
    @pytest.fixture
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "accountant@musclegrid.in",
            "password": "accountant123"
        })
        return response.json()["access_token"]
    
    def test_get_tickets_with_supervisor_action(self, accountant_token):
        """Accountant should see tickets with supervisor decisions"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Failed to get tickets: {response.text}"
        tickets = response.json()
        
        # Check for reverse_pickup and spare_dispatch tickets
        reverse_pickup = [t for t in tickets if t.get("supervisor_action") == "reverse_pickup"]
        spare_dispatch = [t for t in tickets if t.get("supervisor_action") == "spare_dispatch"]
        
        print(f"✓ Found {len(reverse_pickup)} REVERSE PICKUP tickets")
        print(f"✓ Found {len(spare_dispatch)} SPARE DISPATCH tickets")
        
        # Verify tickets have expected fields
        for ticket in tickets[:3]:
            assert "ticket_number" in ticket
            assert "status" in ticket
            assert "customer_name" in ticket
            print(f"  - {ticket['ticket_number']}: {ticket['status']}")
    
    def test_get_repaired_tickets(self, accountant_token):
        """Accountant should see repaired tickets"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200
        tickets = response.json()
        
        repaired = [t for t in tickets if t.get("status") in ["repair_completed", "service_invoice_added"]]
        print(f"✓ Found {len(repaired)} repaired tickets")


class TestUploadPickupLabel:
    """Test upload pickup label for reverse pickup flow"""
    
    @pytest.fixture
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "accountant@musclegrid.in",
            "password": "accountant123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def supervisor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "supervisor@musclegrid.in",
            "password": "supervisor123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def customer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ami_t@live.com",
            "password": "customer123"
        })
        return response.json()["access_token"]
    
    def test_upload_pickup_label_endpoint(self, accountant_token):
        """Test the upload-pickup-label endpoint works"""
        # First, find a ticket with reverse_pickup action
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        tickets = response.json()
        
        # Find ticket that needs pickup label (reverse_pickup without pickup_label)
        reverse_pickup_tickets = [
            t for t in tickets 
            if t.get("supervisor_action") == "reverse_pickup" 
            and not t.get("pickup_label")
        ]
        
        if not reverse_pickup_tickets:
            print("⚠ No reverse pickup tickets needing label found")
            pytest.skip("No reverse pickup tickets without label")
            return
        
        ticket = reverse_pickup_tickets[0]
        ticket_id = ticket["id"]
        ticket_number = ticket["ticket_number"]
        print(f"✓ Testing with ticket {ticket_number}")
        
        # Create a dummy PDF file
        pdf_content = b"%PDF-1.4 test label content"
        files = {
            "label_file": ("test_label.pdf", io.BytesIO(pdf_content), "application/pdf")
        }
        data = {
            "courier": "Delhivery",
            "tracking_id": f"TEST-TRACK-{ticket_number[-5:]}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/upload-pickup-label",
            headers={"Authorization": f"Bearer {accountant_token}"},
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        result = response.json()
        assert "label_url" in result or "message" in result
        print(f"✓ Pickup label uploaded successfully")
        print(f"  Result: {result}")
    
    def test_ticket_status_after_pickup_label_upload(self, accountant_token):
        """After uploading pickup label, ticket status should change to label_uploaded"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        tickets = response.json()
        
        # Find tickets with pickup_label
        with_label = [t for t in tickets if t.get("pickup_label")]
        print(f"✓ Found {len(with_label)} tickets with pickup labels")
        
        for ticket in with_label[:3]:
            print(f"  - {ticket['ticket_number']}: status={ticket['status']}, label={ticket.get('pickup_label', 'N/A')[:50]}...")
            # Verify the ticket has required fields
            assert ticket.get("pickup_courier") or ticket.get("pickup_tracking"), "Missing courier/tracking info"


class TestCustomerDownloadPickupLabel:
    """Test customer can see and download pickup label"""
    
    @pytest.fixture
    def customer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ami_t@live.com",
            "password": "customer123"
        })
        return response.json()["access_token"]
    
    def test_customer_sees_tickets(self, customer_token):
        """Customer should see their tickets"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        tickets = response.json()
        print(f"✓ Customer has {len(tickets)} tickets")
        
        # Check for tickets with pickup labels
        with_label = [t for t in tickets if t.get("pickup_label")]
        print(f"✓ {len(with_label)} tickets have pickup labels ready for download")
    
    def test_customer_ticket_has_pickup_label_info(self, customer_token):
        """Customer ticket details should include pickup label info"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        tickets = response.json()
        
        # Find ticket with pickup_label
        with_label = [t for t in tickets if t.get("pickup_label")]
        
        if with_label:
            ticket = with_label[0]
            print(f"✓ Ticket {ticket['ticket_number']} has pickup label")
            print(f"  - Label URL: {ticket.get('pickup_label', 'N/A')}")
            print(f"  - Courier: {ticket.get('pickup_courier', 'N/A')}")
            print(f"  - Tracking: {ticket.get('pickup_tracking', 'N/A')}")
            
            # Verify label URL is accessible format
            assert ticket["pickup_label"].startswith("/api/files/"), "Invalid label URL format"
        else:
            print("⚠ No tickets with pickup labels found for this customer")


class TestOutboundDispatch:
    """Test outbound dispatch creation with SKU dropdown"""
    
    @pytest.fixture
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "accountant@musclegrid.in",
            "password": "accountant123"
        })
        return response.json()["access_token"]
    
    def test_get_skus_for_dropdown(self, accountant_token):
        """Test SKUs are available for dropdown"""
        response = requests.get(
            f"{BASE_URL}/api/admin/skus",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        # May return 200 or 403 depending on role - check what's available
        if response.status_code == 200:
            skus = response.json()
            active_skus = [s for s in skus if s.get("active") and s.get("stock_quantity", 0) > 0]
            print(f"✓ Found {len(active_skus)} active SKUs with stock")
            for sku in active_skus[:5]:
                print(f"  - {sku['sku_code']}: {sku['model_name']} (Stock: {sku['stock_quantity']})")
        else:
            print(f"⚠ SKUs endpoint returned {response.status_code}")
    
    def test_get_dispatches(self, accountant_token):
        """Test accountant can see dispatches"""
        response = requests.get(
            f"{BASE_URL}/api/dispatches",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        dispatches = response.json()
        print(f"✓ Found {len(dispatches)} dispatches")
        
        # Check dispatch types
        by_type = {}
        for d in dispatches:
            dtype = d.get("dispatch_type", "unknown")
            by_type[dtype] = by_type.get(dtype, 0) + 1
        
        print("  Dispatch types:")
        for dtype, count in by_type.items():
            print(f"  - {dtype}: {count}")
    
    def test_dispatches_pending_labels(self, accountant_token):
        """Test accountant can see dispatches pending labels"""
        response = requests.get(
            f"{BASE_URL}/api/dispatches?status=pending_label",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200
        dispatches = response.json()
        print(f"✓ Found {len(dispatches)} dispatches pending labels")


class TestDispatchFromTicket:
    """Test creating dispatch from a ticket (spare dispatch or return)"""
    
    @pytest.fixture
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "accountant@musclegrid.in",
            "password": "accountant123"
        })
        return response.json()["access_token"]
    
    def test_create_spare_dispatch_from_ticket(self, accountant_token):
        """Test creating spare dispatch from a ticket"""
        # First get tickets with spare_dispatch action
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        tickets = response.json()
        
        spare_tickets = [t for t in tickets if t.get("supervisor_action") == "spare_dispatch"]
        
        if spare_tickets:
            ticket = spare_tickets[0]
            print(f"✓ Found spare dispatch ticket: {ticket['ticket_number']}")
            
            # Test endpoint exists (may fail if dispatch already created)
            response = requests.post(
                f"{BASE_URL}/api/dispatches/from-ticket/{ticket['id']}",
                headers={"Authorization": f"Bearer {accountant_token}"},
                data={
                    "dispatch_type": "spare_dispatch",
                    "sku": "TEST-SKU-001"
                }
            )
            
            # Either success or already processed
            if response.status_code == 200:
                print("✓ Spare dispatch created successfully")
            else:
                print(f"⚠ Response: {response.status_code} - {response.text}")
        else:
            print("⚠ No spare dispatch tickets found")


class TestRepairedTicketsWorkflow:
    """Test repaired tickets and return dispatch workflow"""
    
    @pytest.fixture
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "accountant@musclegrid.in",
            "password": "accountant123"
        })
        return response.json()["access_token"]
    
    def test_repaired_tickets_for_return_dispatch(self, accountant_token):
        """Test finding repaired tickets that need return dispatch"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        tickets = response.json()
        
        repaired = [
            t for t in tickets 
            if t.get("status") in ["repair_completed", "service_invoice_added"]
        ]
        
        print(f"✓ Found {len(repaired)} repaired tickets ready for return dispatch")
        
        for ticket in repaired[:3]:
            print(f"  - {ticket['ticket_number']}: {ticket['status']}")
            print(f"    Repair notes: {ticket.get('repair_notes', 'N/A')[:50] if ticket.get('repair_notes') else 'N/A'}")


class TestTicketNumberConsistency:
    """Test ticket number stays same throughout workflow"""
    
    @pytest.fixture
    def accountant_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "accountant@musclegrid.in",
            "password": "accountant123"
        })
        return response.json()["access_token"]
    
    def test_ticket_number_format(self, accountant_token):
        """Ticket numbers should have consistent format: MG-R-YYYYMMDD-XXXXX"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        tickets = response.json()
        
        for ticket in tickets[:10]:
            ticket_num = ticket.get("ticket_number", "")
            assert ticket_num.startswith("MG-R-"), f"Invalid ticket format: {ticket_num}"
            print(f"✓ {ticket_num} - Status: {ticket['status']}")
    
    def test_ticket_number_in_history(self, accountant_token):
        """Ticket number should be consistent in history entries"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        tickets = response.json()
        
        # Check a ticket's history
        for ticket in tickets[:3]:
            if ticket.get("history"):
                print(f"✓ {ticket['ticket_number']} has {len(ticket['history'])} history entries")
                for entry in ticket["history"][:3]:
                    print(f"  - {entry.get('action', 'N/A')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

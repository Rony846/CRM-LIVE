"""
Test Suite for Admin Orders and Ticket Reply Features - Iteration 13
Tests:
1. Admin Orders Tab - GET /api/dispatches?dispatch_type=new_order
2. Admin Orders Tab - PATCH /api/admin/dispatches/{id} (edit order)
3. Admin Orders Tab - DELETE /api/admin/dispatches/{id} (delete order)
4. Ticket Reply - POST /api/tickets/{id}/reply
5. VoltDoctor ticket mapping with user_*/customer_* field naming
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://crm-rebuild-11.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "customer123"
SUPPORT_EMAIL = "support@musclegrid.in"
SUPPORT_PASSWORD = "customer123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def support_token():
    """Get support agent authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPPORT_EMAIL,
        "password": SUPPORT_PASSWORD
    })
    assert response.status_code == 200, f"Support login failed: {response.text}"
    return response.json()["access_token"]


class TestAdminOrders:
    """Test Admin Orders Tab functionality"""
    
    def test_get_new_orders(self, admin_token):
        """Test fetching orders with dispatch_type=new_order"""
        response = requests.get(
            f"{BASE_URL}/api/dispatches?dispatch_type=new_order",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        orders = response.json()
        assert isinstance(orders, list), "Response should be a list"
        print(f"✅ Found {len(orders)} new orders")
        
        # Verify orders have dispatch_type=new_order
        for order in orders:
            assert order.get("dispatch_type") == "new_order", f"Order {order.get('id')} has wrong dispatch_type"
            print(f"  - Order: {order.get('dispatch_number')} | Customer: {order.get('customer_name')} | Status: {order.get('status')}")
        return orders
    
    def test_order_has_required_fields(self, admin_token):
        """Test that orders have all required fields for display"""
        response = requests.get(
            f"{BASE_URL}/api/dispatches?dispatch_type=new_order",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        orders = response.json()
        
        if len(orders) > 0:
            order = orders[0]
            required_fields = ["id", "dispatch_number", "customer_name", "phone", "status", "created_at"]
            for field in required_fields:
                assert field in order, f"Missing required field: {field}"
            print(f"✅ Order has all required fields: {required_fields}")
        else:
            print("⚠️ No orders found to test fields")
    
    def test_admin_edit_order(self, admin_token):
        """Test PATCH /api/admin/dispatches/{id} - Edit order"""
        # First get an order to edit
        response = requests.get(
            f"{BASE_URL}/api/dispatches?dispatch_type=new_order",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        orders = response.json()
        
        if len(orders) == 0:
            pytest.skip("No orders available to test edit")
        
        order = orders[0]
        order_id = order["id"]
        original_name = order.get("customer_name", "")
        
        # Try to update customer_name
        test_name = "Test Customer Updated"
        response = requests.patch(
            f"{BASE_URL}/api/admin/dispatches/{order_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"customer_name": test_name}
        )
        assert response.status_code == 200, f"Edit failed: {response.text}"
        updated = response.json()
        assert updated.get("customer_name") == test_name, "Customer name not updated"
        print(f"✅ Order edit successful: customer_name updated to '{test_name}'")
        
        # Restore original name
        requests.patch(
            f"{BASE_URL}/api/admin/dispatches/{order_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"customer_name": original_name}
        )
        print(f"✅ Restored original customer name: '{original_name}'")
    
    def test_admin_edit_order_status(self, admin_token):
        """Test updating order status via PATCH"""
        response = requests.get(
            f"{BASE_URL}/api/dispatches?dispatch_type=new_order",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        orders = response.json()
        
        if len(orders) == 0:
            pytest.skip("No orders available to test status update")
        
        order = orders[0]
        order_id = order["id"]
        original_status = order.get("status", "pending")
        
        # Update status to shipped
        response = requests.patch(
            f"{BASE_URL}/api/admin/dispatches/{order_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"status": "shipped"}
        )
        assert response.status_code == 200, f"Status update failed: {response.text}"
        updated = response.json()
        assert updated.get("status") == "shipped", "Status not updated"
        print(f"✅ Order status updated to 'shipped'")
        
        # Restore original status
        requests.patch(
            f"{BASE_URL}/api/admin/dispatches/{order_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"status": original_status}
        )
        print(f"✅ Restored original status: '{original_status}'")


class TestAdminDeleteOrder:
    """Test Admin Delete Order functionality"""
    
    def test_admin_delete_order_flow(self, admin_token):
        """Test DELETE /api/admin/dispatches/{id}"""
        # First, create a test order if none exists
        # For now, just test that the endpoint exists and returns proper error for non-existent
        fake_id = "non-existent-order-id-12345"
        response = requests.delete(
            f"{BASE_URL}/api/admin/dispatches/{fake_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should return 404 for non-existent order
        assert response.status_code == 404, f"Expected 404 for non-existent order, got {response.status_code}"
        print(f"✅ Delete endpoint returns 404 for non-existent order (correct behavior)")


class TestTicketReply:
    """Test Ticket Reply functionality"""
    
    def test_support_can_reply_to_ticket(self, admin_token):
        """Test POST /api/tickets/{id}/reply - Support agent reply"""
        # First get a ticket
        response = requests.get(
            f"{BASE_URL}/api/tickets?limit=1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        tickets = response.json()
        
        if len(tickets) == 0:
            pytest.skip("No tickets available to test reply")
        
        ticket = tickets[0]
        ticket_id = ticket["id"]
        
        # Send a reply
        reply_message = "Test reply from API testing - this is a test message for verification purposes."
        response = requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/reply",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"message": reply_message}
        )
        assert response.status_code == 200, f"Reply failed: {response.text}"
        result = response.json()
        assert "message" in result, "Response should have message field"
        print(f"✅ Ticket reply successful: {result.get('message')}")
    
    def test_reply_with_status_change(self, admin_token):
        """Test reply with status change"""
        response = requests.get(
            f"{BASE_URL}/api/tickets?limit=1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        tickets = response.json()
        
        if len(tickets) == 0:
            pytest.skip("No tickets available to test reply")
        
        ticket = tickets[0]
        ticket_id = ticket["id"]
        
        # Send reply with status change
        response = requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/reply",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "message": "Following up on your issue. Please provide more details.",
                "change_status": "call_support_followup"
            }
        )
        assert response.status_code == 200, f"Reply with status change failed: {response.text}"
        print(f"✅ Ticket reply with status change successful")
    
    def test_reply_adds_to_history(self, admin_token):
        """Test that reply is added to ticket history"""
        response = requests.get(
            f"{BASE_URL}/api/tickets?limit=1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        tickets = response.json()
        
        if len(tickets) == 0:
            pytest.skip("No tickets available")
        
        ticket = tickets[0]
        ticket_id = ticket["id"]
        
        # Get ticket before reply
        response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        ticket_before = response.json()
        history_count_before = len(ticket_before.get("history", []))
        
        # Send reply
        unique_msg = f"Test reply verification {os.urandom(4).hex()}"
        response = requests.post(
            f"{BASE_URL}/api/tickets/{ticket_id}/reply",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"message": unique_msg}
        )
        assert response.status_code == 200
        
        # Get ticket after reply
        response = requests.get(
            f"{BASE_URL}/api/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        ticket_after = response.json()
        history_count_after = len(ticket_after.get("history", []))
        
        assert history_count_after > history_count_before, "History should have new entry"
        print(f"✅ Reply added to ticket history (before: {history_count_before}, after: {history_count_after})")


class TestVoltDoctorTickets:
    """Test VoltDoctor ticket functionality"""
    
    def test_voltdoctor_tickets_visible(self, admin_token):
        """Test that VoltDoctor tickets are synced and visible"""
        response = requests.get(
            f"{BASE_URL}/api/tickets?limit=100",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        tickets = response.json()
        
        # Check for VoltDoctor tickets
        vd_tickets = [t for t in tickets if t.get("source") == "voltdoctor"]
        print(f"✅ Found {len(vd_tickets)} VoltDoctor tickets out of {len(tickets)} total")
        
        # Verify VoltDoctor tickets have proper source and voltdoctor_id
        for ticket in vd_tickets[:3]:  # Check first 3
            customer_name = ticket.get("customer_name", "")
            customer_phone = ticket.get("customer_phone", "")
            customer_email = ticket.get("customer_email", "")
            voltdoctor_id = ticket.get("voltdoctor_id", "")
            print(f"  - {ticket.get('ticket_number')}: VD_ID={voltdoctor_id}, Name={customer_name}, Phone={customer_phone}")
            # VoltDoctor tickets should have voltdoctor_id
            assert voltdoctor_id, "VoltDoctor ticket missing voltdoctor_id"
        
        print(f"✅ VoltDoctor tickets properly synced with voltdoctor_id tracking")


class TestDispatchStats:
    """Test dispatch statistics for Admin Orders page"""
    
    def test_orders_stats_calculation(self, admin_token):
        """Test that orders can be used to calculate stats"""
        response = requests.get(
            f"{BASE_URL}/api/dispatches?dispatch_type=new_order",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        orders = response.json()
        
        # Calculate stats like the frontend does
        total = len(orders)
        pending = len([o for o in orders if o.get("status") == "pending"])
        shipped = len([o for o in orders if o.get("status") in ["shipped", "dispatched"]])
        delivered = len([o for o in orders if o.get("status") == "delivered"])
        
        print(f"✅ Order Stats - Total: {total}, Pending: {pending}, Shipped: {shipped}, Delivered: {delivered}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

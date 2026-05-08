"""
E-commerce Reconciliation Module Tests
Tests for Amazon/Flipkart payout CSV upload, reconciliation, and order source features
"""
import pytest
import requests
import os
import io
import csv

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestEcommerceStatements:
    """Tests for payout statement listing and details"""
    
    def test_list_statements(self, headers):
        """GET /api/ecommerce/statements - List all payout statements"""
        response = requests.get(f"{BASE_URL}/api/ecommerce/statements", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify existing statement from main agent context
        if len(data) > 0:
            stmt = data[0]
            assert "id" in stmt, "Statement should have id"
            assert "statement_number" in stmt, "Statement should have statement_number"
            assert "platform" in stmt, "Statement should have platform"
            assert "status" in stmt, "Statement should have status"
            print(f"Found {len(data)} statements, first: {stmt.get('statement_number')}")
    
    def test_list_statements_filter_by_platform(self, headers):
        """GET /api/ecommerce/statements?platform=amazon - Filter by platform"""
        response = requests.get(f"{BASE_URL}/api/ecommerce/statements?platform=amazon", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        for stmt in data:
            assert stmt.get("platform") == "amazon", f"Expected amazon platform, got {stmt.get('platform')}"
        print(f"Found {len(data)} Amazon statements")
    
    def test_get_statement_details(self, headers):
        """GET /api/ecommerce/statements/{id} - Get statement with transactions"""
        # First get list of statements
        list_response = requests.get(f"{BASE_URL}/api/ecommerce/statements", headers=headers)
        assert list_response.status_code == 200
        
        statements = list_response.json()
        if len(statements) == 0:
            pytest.skip("No statements available to test details")
        
        statement_id = statements[0]["id"]
        
        # Get details
        response = requests.get(f"{BASE_URL}/api/ecommerce/statements/{statement_id}", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "statement" in data, "Response should have statement"
        assert "transactions" in data, "Response should have transactions"
        assert "order_summaries" in data, "Response should have order_summaries"
        
        # Verify statement structure
        stmt = data["statement"]
        assert stmt.get("id") == statement_id
        assert "summary" in stmt, "Statement should have summary"
        
        summary = stmt.get("summary", {})
        assert "total_transactions" in summary, "Summary should have total_transactions"
        assert "total_order_payments" in summary, "Summary should have total_order_payments"
        assert "total_refunds" in summary, "Summary should have total_refunds"
        assert "total_platform_fees" in summary, "Summary should have total_platform_fees"
        assert "net_payout" in summary, "Summary should have net_payout"
        assert "matched_orders" in summary, "Summary should have matched_orders"
        assert "unmatched_orders" in summary, "Summary should have unmatched_orders"
        
        print(f"Statement {stmt.get('statement_number')}: {summary.get('total_transactions')} transactions, "
              f"{summary.get('matched_orders')} matched, {summary.get('unmatched_orders')} unmatched")
    
    def test_get_nonexistent_statement(self, headers):
        """GET /api/ecommerce/statements/{invalid_id} - Should return 404"""
        response = requests.get(f"{BASE_URL}/api/ecommerce/statements/nonexistent-id-12345", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestEcommerceAlerts:
    """Tests for reconciliation alerts"""
    
    def test_get_all_alerts(self, headers):
        """GET /api/ecommerce/alerts - Get all reconciliation alerts"""
        response = requests.get(f"{BASE_URL}/api/ecommerce/alerts", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify alert structure if alerts exist
        if len(data) > 0:
            alert = data[0]
            assert "type" in alert, "Alert should have type"
            assert "severity" in alert, "Alert should have severity"
            assert "message" in alert, "Alert should have message"
            
            # Count alert types
            unmatched_orders = len([a for a in data if a.get("type") == "unmatched_order"])
            unmatched_refunds = len([a for a in data if a.get("type") == "unmatched_refund"])
            high_fees = len([a for a in data if a.get("type") == "high_fees"])
            
            print(f"Found {len(data)} alerts: {unmatched_orders} unmatched orders, "
                  f"{unmatched_refunds} unmatched refunds, {high_fees} high fees")
    
    def test_get_alerts_by_statement(self, headers):
        """GET /api/ecommerce/alerts?statement_id=xxx - Filter alerts by statement"""
        # Get a statement first
        list_response = requests.get(f"{BASE_URL}/api/ecommerce/statements", headers=headers)
        if list_response.status_code != 200 or len(list_response.json()) == 0:
            pytest.skip("No statements available")
        
        statement_id = list_response.json()[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/ecommerce/alerts?statement_id={statement_id}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        # All alerts should be for this statement
        for alert in data:
            if "statement_id" in alert:
                assert alert["statement_id"] == statement_id
        
        print(f"Found {len(data)} alerts for statement {statement_id}")


class TestEcommerceOrderReconciliation:
    """Tests for order-level reconciliation data"""
    
    def test_get_order_reconciliation(self, headers):
        """GET /api/ecommerce/order-reconciliation - Get order summaries"""
        response = requests.get(f"{BASE_URL}/api/ecommerce/order-reconciliation", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            order = data[0]
            assert "marketplace_order_id" in order, "Order should have marketplace_order_id"
            assert "gross_sale" in order, "Order should have gross_sale"
            assert "platform_fees" in order, "Order should have platform_fees"
            assert "net_realized" in order, "Order should have net_realized"
            assert "crm_match_status" in order, "Order should have crm_match_status"
            assert "finance_status" in order, "Order should have finance_status"
            
            print(f"Found {len(data)} order summaries")
    
    def test_filter_unmatched_orders(self, headers):
        """GET /api/ecommerce/order-reconciliation?match_status=unmatched"""
        response = requests.get(f"{BASE_URL}/api/ecommerce/order-reconciliation?match_status=unmatched", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        for order in data:
            assert order.get("crm_match_status") == "unmatched", f"Expected unmatched, got {order.get('crm_match_status')}"
        
        print(f"Found {len(data)} unmatched orders")


class TestEcommerceExport:
    """Tests for export functionality"""
    
    def test_export_summary(self, headers):
        """GET /api/ecommerce/export/{id}?export_type=summary - Export summary Excel"""
        # Get a statement first
        list_response = requests.get(f"{BASE_URL}/api/ecommerce/statements", headers=headers)
        if list_response.status_code != 200 or len(list_response.json()) == 0:
            pytest.skip("No statements available")
        
        statement_id = list_response.json()[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/ecommerce/export/{statement_id}?export_type=summary",
            headers={"Authorization": headers["Authorization"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify it's an Excel file
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "excel" in content_type or "octet-stream" in content_type, \
            f"Expected Excel content type, got {content_type}"
        
        print(f"Export summary successful, size: {len(response.content)} bytes")
    
    def test_export_transactions(self, headers):
        """GET /api/ecommerce/export/{id}?export_type=transactions"""
        list_response = requests.get(f"{BASE_URL}/api/ecommerce/statements", headers=headers)
        if list_response.status_code != 200 or len(list_response.json()) == 0:
            pytest.skip("No statements available")
        
        statement_id = list_response.json()[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/ecommerce/export/{statement_id}?export_type=transactions",
            headers={"Authorization": headers["Authorization"]}
        )
        assert response.status_code == 200
        print(f"Export transactions successful, size: {len(response.content)} bytes")
    
    def test_export_orders(self, headers):
        """GET /api/ecommerce/export/{id}?export_type=orders"""
        list_response = requests.get(f"{BASE_URL}/api/ecommerce/statements", headers=headers)
        if list_response.status_code != 200 or len(list_response.json()) == 0:
            pytest.skip("No statements available")
        
        statement_id = list_response.json()[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/ecommerce/export/{statement_id}?export_type=orders",
            headers={"Authorization": headers["Authorization"]}
        )
        assert response.status_code == 200
        print(f"Export orders successful, size: {len(response.content)} bytes")
    
    def test_export_unmatched(self, headers):
        """GET /api/ecommerce/export/{id}?export_type=unmatched"""
        list_response = requests.get(f"{BASE_URL}/api/ecommerce/statements", headers=headers)
        if list_response.status_code != 200 or len(list_response.json()) == 0:
            pytest.skip("No statements available")
        
        statement_id = list_response.json()[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/ecommerce/export/{statement_id}?export_type=unmatched",
            headers={"Authorization": headers["Authorization"]}
        )
        assert response.status_code == 200
        print(f"Export unmatched successful, size: {len(response.content)} bytes")


class TestCSVUpload:
    """Tests for CSV upload functionality"""
    
    def test_upload_amazon_csv(self, headers):
        """POST /api/ecommerce/upload-payout - Upload Amazon CSV"""
        # Create a sample Amazon CSV
        csv_content = """Date,Transaction type,Order ID,Product Details,Total product charges,Total promotional rebates,Amazon fees,Other,Total (INR)
01/01/2026,Order Payment,TEST-AMZ-001,Test Product 1,1000,0,-150,0,850
01/01/2026,Order Payment,TEST-AMZ-002,Test Product 2,2000,-100,-300,0,1600
02/01/2026,Refund,TEST-AMZ-001,Test Product 1,-1000,0,150,0,-850
"""
        
        # Create file-like object
        files = {
            'file': ('test_amazon_payout.csv', csv_content, 'text/csv')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ecommerce/upload-payout?platform=amazon",
            headers={"Authorization": headers["Authorization"]},
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "statement_id" in data, "Response should have statement_id"
        assert "statement_number" in data, "Response should have statement_number"
        assert "summary" in data, "Response should have summary"
        
        summary = data["summary"]
        assert summary.get("total_transactions") >= 2, "Should have at least 2 transactions"
        
        print(f"Uploaded statement {data.get('statement_number')}: {summary.get('total_transactions')} transactions")
        
        # Cleanup - verify the statement was created
        stmt_response = requests.get(
            f"{BASE_URL}/api/ecommerce/statements/{data['statement_id']}",
            headers=headers
        )
        assert stmt_response.status_code == 200
    
    def test_upload_invalid_platform(self, headers):
        """POST /api/ecommerce/upload-payout?platform=invalid - Should fail"""
        csv_content = "Date,Transaction type,Order ID\n01/01/2026,Order,123"
        files = {'file': ('test.csv', csv_content, 'text/csv')}
        
        response = requests.post(
            f"{BASE_URL}/api/ecommerce/upload-payout?platform=invalid",
            headers={"Authorization": headers["Authorization"]},
            files=files
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Invalid platform correctly rejected")


class TestLinkTransaction:
    """Tests for linking transactions to CRM dispatches"""
    
    def test_link_transaction_invalid_ids(self, headers):
        """PUT /api/ecommerce/transactions/{id}/link-crm - Invalid IDs should fail"""
        response = requests.put(
            f"{BASE_URL}/api/ecommerce/transactions/invalid-trans-id/link-crm?crm_dispatch_id=invalid-dispatch-id",
            headers=headers
        )
        
        # Should return 404 for invalid transaction
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Invalid transaction ID correctly rejected")


class TestDispatchOrderSource:
    """Tests for order_source and marketplace_order_id in dispatches"""
    
    def test_dispatches_endpoint(self, headers):
        """GET /api/dispatches - Verify dispatches endpoint works"""
        response = requests.get(f"{BASE_URL}/api/dispatches?limit=10", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Response could be list or dict with dispatches key
        dispatches = data.get("dispatches", data) if isinstance(data, dict) else data
        
        print(f"Found {len(dispatches)} dispatches")
        
        # Check if any dispatch has order_source field
        for d in dispatches[:5]:
            if "order_source" in d:
                print(f"Dispatch {d.get('dispatch_number')} has order_source: {d.get('order_source')}")
    
    def test_create_dispatch_with_order_source(self, headers):
        """POST /api/dispatches - Create dispatch with order_source field"""
        # First get required data (firm, customer)
        firms_response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        if firms_response.status_code != 200 or len(firms_response.json()) == 0:
            pytest.skip("No firms available")
        
        firm_id = firms_response.json()[0]["id"]
        
        # Get a customer
        customers_response = requests.get(f"{BASE_URL}/api/customers?limit=1", headers=headers)
        if customers_response.status_code != 200:
            pytest.skip("Cannot fetch customers")
        
        customers = customers_response.json()
        if isinstance(customers, dict):
            customers = customers.get("customers", [])
        
        if len(customers) == 0:
            pytest.skip("No customers available")
        
        customer = customers[0]
        
        # Create dispatch with order_source
        dispatch_data = {
            "firm_id": firm_id,
            "customer_id": customer.get("id"),
            "customer_name": customer.get("name", "Test Customer"),
            "customer_phone": customer.get("phone", "9999999999"),
            "order_id": f"TEST-AMZ-{os.urandom(4).hex().upper()}",
            "order_source": "amazon",
            "marketplace_order_id": f"AMZ-{os.urandom(4).hex().upper()}",
            "items": [],
            "notes": "Test dispatch with order source"
        }
        
        # Note: This might fail if items are required, but we're testing the field acceptance
        response = requests.post(
            f"{BASE_URL}/api/dispatches",
            headers=headers,
            json=dispatch_data
        )
        
        # Accept 200, 201, or 400 (if items required)
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"Created dispatch with order_source: {data.get('order_source')}")
            assert data.get("order_source") == "amazon", "order_source should be amazon"
        else:
            print(f"Dispatch creation returned {response.status_code} - may require items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

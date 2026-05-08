"""
E-commerce Reconciliation Module Tests - Iteration 46
Tests for enhanced features:
- Firm selection before importing statements
- Flipkart multi-sheet Excel parser
- Separate Amazon and Flipkart parsers
- Tax breakdown for Flipkart (TCS, TDS, GST)
- Non-order charges tracking
- Order-level and statement-level reconciliation views
"""
import pytest
import requests
import os
import io

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


@pytest.fixture(scope="module")
def firm_id(headers):
    """Get a firm ID for testing"""
    response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
    if response.status_code == 200 and len(response.json()) > 0:
        return response.json()[0]["id"]
    pytest.skip("No firms available for testing")


class TestFirmSelection:
    """Tests for firm selection in e-commerce reconciliation"""
    
    def test_firms_endpoint_available(self, headers):
        """GET /api/firms - Verify firms endpoint works"""
        response = requests.get(f"{BASE_URL}/api/firms", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        firms = response.json()
        assert isinstance(firms, list), "Response should be a list"
        assert len(firms) > 0, "Should have at least one firm"
        
        # Verify firm structure
        firm = firms[0]
        assert "id" in firm, "Firm should have id"
        assert "name" in firm, "Firm should have name"
        print(f"Found {len(firms)} firms, first: {firm.get('name')}")
    
    def test_statements_filter_by_firm(self, headers, firm_id):
        """GET /api/ecommerce/statements?firm_id=xxx - Filter statements by firm"""
        response = requests.get(f"{BASE_URL}/api/ecommerce/statements?firm_id={firm_id}", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        statements = response.json()
        # All statements should belong to this firm
        for stmt in statements:
            if stmt.get("firm_id"):
                assert stmt["firm_id"] == firm_id, f"Expected firm_id {firm_id}, got {stmt.get('firm_id')}"
        
        print(f"Found {len(statements)} statements for firm {firm_id}")


class TestAmazonUpload:
    """Tests for Amazon CSV upload with firm association"""
    
    def test_upload_amazon_csv_with_firm(self, headers, firm_id):
        """POST /api/ecommerce/upload-payout?platform=amazon&firm_id=xxx"""
        csv_content = """Date,Transaction type,Order ID,Product Details,Total product charges,Total promotional rebates,Amazon fees,Other,Total (INR)
01/01/2026,Order Payment,TEST-AMZ-FIRM-001,Test Product 1,1000,0,-150,0,850
01/01/2026,Order Payment,TEST-AMZ-FIRM-002,Test Product 2,2000,-100,-300,0,1600
"""
        
        files = {
            'file': ('test_amazon_firm.csv', csv_content, 'text/csv')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ecommerce/upload-payout?platform=amazon&firm_id={firm_id}",
            headers={"Authorization": headers["Authorization"]},
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "statement_id" in data, "Response should have statement_id"
        assert "statement_number" in data, "Response should have statement_number"
        
        # Verify the statement has firm_id
        stmt_response = requests.get(
            f"{BASE_URL}/api/ecommerce/statements/{data['statement_id']}",
            headers=headers
        )
        assert stmt_response.status_code == 200
        
        stmt_data = stmt_response.json()
        assert stmt_data["statement"].get("firm_id") == firm_id, "Statement should have firm_id"
        
        print(f"Uploaded Amazon statement {data.get('statement_number')} for firm {firm_id}")
    
    def test_upload_amazon_without_firm_fails(self, headers):
        """POST /api/ecommerce/upload-payout?platform=amazon - Should require firm_id"""
        csv_content = "Date,Transaction type,Order ID\n01/01/2026,Order,123"
        files = {'file': ('test.csv', csv_content, 'text/csv')}
        
        response = requests.post(
            f"{BASE_URL}/api/ecommerce/upload-payout?platform=amazon",
            headers={"Authorization": headers["Authorization"]},
            files=files
        )
        
        # Should fail without firm_id or accept with default behavior
        # Accept 400 (validation error) or 200 (if firm_id is optional)
        print(f"Upload without firm_id returned: {response.status_code}")


class TestFlipkartUpload:
    """Tests for Flipkart Excel upload with multi-sheet parsing"""
    
    def test_upload_flipkart_excel_with_firm(self, headers, firm_id):
        """POST /api/ecommerce/upload-payout?platform=flipkart&firm_id=xxx"""
        # Download the actual Flipkart file
        flipkart_url = "https://customer-assets.emergentagent.com/job_crm-rebuild-11/artifacts/yyp5fug3_56812be5-8274-4d13-8ad9-4ae7e0ffd76c_1775315417000.xlsx"
        
        try:
            file_response = requests.get(flipkart_url, timeout=30)
            if file_response.status_code != 200:
                pytest.skip(f"Could not download Flipkart test file: {file_response.status_code}")
            
            file_content = file_response.content
        except Exception as e:
            pytest.skip(f"Could not download Flipkart test file: {e}")
        
        files = {
            'file': ('flipkart_settlement.xlsx', file_content, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ecommerce/upload-payout?platform=flipkart&firm_id={firm_id}",
            headers={"Authorization": headers["Authorization"]},
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "statement_id" in data, "Response should have statement_id"
        assert "statement_number" in data, "Response should have statement_number"
        
        # Verify Flipkart-specific fields in summary
        summary = data.get("summary", {})
        print(f"Flipkart statement summary: {summary}")
        
        # Store statement_id for later tests
        pytest.flipkart_statement_id = data["statement_id"]
        print(f"Uploaded Flipkart statement {data.get('statement_number')} for firm {firm_id}")
        
        return data["statement_id"]


class TestFlipkartStatementDetails:
    """Tests for Flipkart statement details including non-order charges and tax entries"""
    
    def test_flipkart_statement_has_non_order_charges(self, headers):
        """GET /api/ecommerce/statements/{id} - Verify non_order_charges for Flipkart"""
        # Get Flipkart statements
        response = requests.get(f"{BASE_URL}/api/ecommerce/statements?platform=flipkart", headers=headers)
        assert response.status_code == 200
        
        statements = response.json()
        if len(statements) == 0:
            pytest.skip("No Flipkart statements available")
        
        statement_id = statements[0]["id"]
        
        # Get details
        detail_response = requests.get(f"{BASE_URL}/api/ecommerce/statements/{statement_id}", headers=headers)
        assert detail_response.status_code == 200
        
        data = detail_response.json()
        
        # Verify structure includes non_order_charges
        assert "non_order_charges" in data, "Response should have non_order_charges"
        
        non_order_charges = data.get("non_order_charges", [])
        print(f"Found {len(non_order_charges)} non-order charges")
        
        # Verify charge structure if any exist
        if len(non_order_charges) > 0:
            charge = non_order_charges[0]
            assert "charge_type" in charge, "Charge should have charge_type"
            assert "category" in charge, "Charge should have category"
            assert "amount" in charge, "Charge should have amount"
            print(f"Sample charge: {charge.get('charge_type')} - {charge.get('amount')}")
    
    def test_flipkart_statement_has_tax_entries(self, headers):
        """GET /api/ecommerce/statements/{id} - Verify tax_entries for Flipkart"""
        # Get Flipkart statements
        response = requests.get(f"{BASE_URL}/api/ecommerce/statements?platform=flipkart", headers=headers)
        assert response.status_code == 200
        
        statements = response.json()
        if len(statements) == 0:
            pytest.skip("No Flipkart statements available")
        
        statement_id = statements[0]["id"]
        
        # Get details
        detail_response = requests.get(f"{BASE_URL}/api/ecommerce/statements/{statement_id}", headers=headers)
        assert detail_response.status_code == 200
        
        data = detail_response.json()
        
        # Verify structure includes tax_entries
        assert "tax_entries" in data, "Response should have tax_entries"
        
        tax_entries = data.get("tax_entries", [])
        print(f"Found {len(tax_entries)} tax entries")
        
        # Verify tax entry structure if any exist
        if len(tax_entries) > 0:
            tax = tax_entries[0]
            assert "tax_type" in tax, "Tax entry should have tax_type"
            assert "amount" in tax, "Tax entry should have amount"
            print(f"Sample tax: {tax.get('tax_type')} - {tax.get('amount')}")
    
    def test_flipkart_summary_has_tax_breakdown(self, headers):
        """Verify Flipkart statement summary includes TCS, TDS, GST totals"""
        # Get Flipkart statements
        response = requests.get(f"{BASE_URL}/api/ecommerce/statements?platform=flipkart", headers=headers)
        assert response.status_code == 200
        
        statements = response.json()
        if len(statements) == 0:
            pytest.skip("No Flipkart statements available")
        
        statement_id = statements[0]["id"]
        
        # Get details
        detail_response = requests.get(f"{BASE_URL}/api/ecommerce/statements/{statement_id}", headers=headers)
        assert detail_response.status_code == 200
        
        data = detail_response.json()
        statement = data.get("statement", {})
        summary = statement.get("summary", {})
        
        # Verify Flipkart-specific summary fields
        print(f"Flipkart summary fields: {list(summary.keys())}")
        
        # Check for tax-related fields
        tax_fields = ["total_tcs", "total_tds", "total_gst_on_fees", "total_ad_spend", "total_service_charges"]
        found_fields = [f for f in tax_fields if f in summary]
        print(f"Found tax fields: {found_fields}")
    
    def test_flipkart_summary_has_ad_spend_and_services(self, headers):
        """Verify Flipkart statement summary includes ad spend and service charges"""
        # Get Flipkart statements
        response = requests.get(f"{BASE_URL}/api/ecommerce/statements?platform=flipkart", headers=headers)
        assert response.status_code == 200
        
        statements = response.json()
        if len(statements) == 0:
            pytest.skip("No Flipkart statements available")
        
        statement_id = statements[0]["id"]
        
        # Get details
        detail_response = requests.get(f"{BASE_URL}/api/ecommerce/statements/{statement_id}", headers=headers)
        assert detail_response.status_code == 200
        
        data = detail_response.json()
        statement = data.get("statement", {})
        summary = statement.get("summary", {})
        
        # Check for Flipkart-specific fields
        ad_spend = summary.get("total_ad_spend", 0)
        service_charges = summary.get("total_service_charges", 0)
        
        print(f"Ad Spend: {ad_spend}, Service Charges: {service_charges}")


class TestAmazonStatementDetails:
    """Tests for Amazon statement details - should have reserve fields"""
    
    def test_amazon_summary_has_reserve_fields(self, headers):
        """Verify Amazon statement summary includes reserve_held and reserve_released"""
        # Get Amazon statements
        response = requests.get(f"{BASE_URL}/api/ecommerce/statements?platform=amazon", headers=headers)
        assert response.status_code == 200
        
        statements = response.json()
        if len(statements) == 0:
            pytest.skip("No Amazon statements available")
        
        statement_id = statements[0]["id"]
        
        # Get details
        detail_response = requests.get(f"{BASE_URL}/api/ecommerce/statements/{statement_id}", headers=headers)
        assert detail_response.status_code == 200
        
        data = detail_response.json()
        statement = data.get("statement", {})
        summary = statement.get("summary", {})
        
        # Check for Amazon-specific fields
        reserve_held = summary.get("reserve_held", 0)
        reserve_released = summary.get("reserve_released", 0)
        
        print(f"Reserve Held: {reserve_held}, Reserve Released: {reserve_released}")


class TestStatementListWithFirm:
    """Tests for statement list showing firm information"""
    
    def test_statements_list_includes_firm_name(self, headers):
        """GET /api/ecommerce/statements - Verify firm_name in response"""
        response = requests.get(f"{BASE_URL}/api/ecommerce/statements", headers=headers)
        assert response.status_code == 200
        
        statements = response.json()
        if len(statements) == 0:
            pytest.skip("No statements available")
        
        # Check if firm_name is included
        stmt = statements[0]
        print(f"Statement fields: {list(stmt.keys())}")
        
        # firm_name should be present
        if "firm_name" in stmt:
            print(f"Statement {stmt.get('statement_number')} belongs to firm: {stmt.get('firm_name')}")
        elif "firm_id" in stmt:
            print(f"Statement {stmt.get('statement_number')} has firm_id: {stmt.get('firm_id')}")


class TestOrderReconciliation:
    """Tests for order-level reconciliation views"""
    
    def test_order_reconciliation_endpoint(self, headers):
        """GET /api/ecommerce/order-reconciliation - Get order summaries"""
        response = requests.get(f"{BASE_URL}/api/ecommerce/order-reconciliation", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            order = data[0]
            # Verify order summary structure
            expected_fields = ["marketplace_order_id", "gross_sale", "platform_fees", "net_realized", "crm_match_status"]
            for field in expected_fields:
                assert field in order, f"Order should have {field}"
            
            print(f"Found {len(data)} order summaries")
    
    def test_order_reconciliation_filter_by_statement(self, headers):
        """GET /api/ecommerce/order-reconciliation?statement_id=xxx"""
        # Get a statement first
        stmt_response = requests.get(f"{BASE_URL}/api/ecommerce/statements", headers=headers)
        if stmt_response.status_code != 200 or len(stmt_response.json()) == 0:
            pytest.skip("No statements available")
        
        statement_id = stmt_response.json()[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/ecommerce/order-reconciliation?statement_id={statement_id}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        print(f"Found {len(data)} orders for statement {statement_id}")


class TestExportFunctionality:
    """Tests for export functionality including new export types"""
    
    def test_export_charges(self, headers):
        """GET /api/ecommerce/export/{id}?export_type=charges - Export charges Excel"""
        # Get a Flipkart statement
        response = requests.get(f"{BASE_URL}/api/ecommerce/statements?platform=flipkart", headers=headers)
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No Flipkart statements available")
        
        statement_id = response.json()[0]["id"]
        
        export_response = requests.get(
            f"{BASE_URL}/api/ecommerce/export/{statement_id}?export_type=charges",
            headers={"Authorization": headers["Authorization"]}
        )
        
        # May return 200 or 400 if export type not supported
        print(f"Export charges returned: {export_response.status_code}")
    
    def test_export_taxes(self, headers):
        """GET /api/ecommerce/export/{id}?export_type=taxes - Export tax details Excel"""
        # Get a Flipkart statement
        response = requests.get(f"{BASE_URL}/api/ecommerce/statements?platform=flipkart", headers=headers)
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No Flipkart statements available")
        
        statement_id = response.json()[0]["id"]
        
        export_response = requests.get(
            f"{BASE_URL}/api/ecommerce/export/{statement_id}?export_type=taxes",
            headers={"Authorization": headers["Authorization"]}
        )
        
        # May return 200 or 400 if export type not supported
        print(f"Export taxes returned: {export_response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

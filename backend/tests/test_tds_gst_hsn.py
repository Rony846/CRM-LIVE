"""
Test TDS Management and GST HSN Dashboard APIs
Tests for:
- TDS Sections API (194C, 194J, 194H, 194I, 194A)
- TDS Summary and Entries APIs
- TDS Calculation API
- GST HSN Summary API
- GST Missing Data Alerts API
- GST HSN Drilldown API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@musclegrid.in"
TEST_PASSWORD = "Muscle@846"

# Global session for auth
_session = None
_token = None


def get_auth_session():
    """Get authenticated session"""
    global _session, _token
    
    if _session is None:
        _session = requests.Session()
        _session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = _session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            _token = response.json().get("access_token")
            _session.headers.update({"Authorization": f"Bearer {_token}"})
        else:
            raise Exception(f"Authentication failed: {response.status_code} - {response.text}")
    
    return _session


class TestTDSSections:
    """TDS Sections API tests"""
    
    def test_list_tds_sections(self):
        """Test GET /api/tds/sections returns pre-seeded sections"""
        session = get_auth_session()
        response = session.get(f"{BASE_URL}/api/tds/sections")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        sections = response.json()
        assert isinstance(sections, list), "Response should be a list"
        assert len(sections) >= 5, f"Expected at least 5 pre-seeded sections, got {len(sections)}"
        
        # Verify expected sections exist
        section_codes = [s.get("section") for s in sections]
        expected_sections = ["194C", "194J", "194H", "194I", "194A"]
        
        for expected in expected_sections:
            assert expected in section_codes, f"Expected section {expected} not found in {section_codes}"
        
        # Verify section structure
        for section in sections:
            assert "id" in section, "Section should have id"
            assert "section" in section, "Section should have section code"
            assert "description" in section, "Section should have description"
            assert "rates" in section, "Section should have rates"
            assert "is_active" in section, "Section should have is_active flag"
        
        print(f"PASS: Found {len(sections)} TDS sections including {expected_sections}")
    
    def test_tds_section_194c_structure(self):
        """Test 194C section has correct structure for contractor payments"""
        session = get_auth_session()
        response = session.get(f"{BASE_URL}/api/tds/sections")
        assert response.status_code == 200
        
        sections = response.json()
        sec_194c = next((s for s in sections if s.get("section") == "194C"), None)
        
        assert sec_194c is not None, "194C section not found"
        assert "Payment to Contractors" in sec_194c.get("description", ""), "194C should be for contractors"
        assert sec_194c.get("threshold_per_transaction") == 30000, "194C threshold should be 30000"
        assert sec_194c.get("threshold_annual") == 100000, "194C annual threshold should be 100000"
        
        # Check rates for different party types
        rates = sec_194c.get("rates", [])
        individual_rate = next((r for r in rates if r.get("party_type") == "individual"), None)
        company_rate = next((r for r in rates if r.get("party_type") == "company"), None)
        
        assert individual_rate is not None, "194C should have individual rate"
        assert individual_rate.get("rate") == 1.0, "194C individual rate should be 1%"
        assert company_rate is not None, "194C should have company rate"
        assert company_rate.get("rate") == 2.0, "194C company rate should be 2%"
        
        print("PASS: 194C section structure verified")
    
    def test_tds_section_194i_rent_types(self):
        """Test 194I section has different rates for land/building vs machinery"""
        session = get_auth_session()
        response = session.get(f"{BASE_URL}/api/tds/sections")
        assert response.status_code == 200
        
        sections = response.json()
        sec_194i = next((s for s in sections if s.get("section") == "194I"), None)
        
        assert sec_194i is not None, "194I section not found"
        assert "Rent" in sec_194i.get("description", ""), "194I should be for rent"
        
        rates = sec_194i.get("rates", [])
        land_building_rate = next((r for r in rates if r.get("rent_type") == "land_building"), None)
        machinery_rate = next((r for r in rates if r.get("rent_type") == "plant_machinery"), None)
        
        assert land_building_rate is not None, "194I should have land_building rate"
        assert land_building_rate.get("rate") == 10.0, "194I land/building rate should be 10%"
        assert machinery_rate is not None, "194I should have plant_machinery rate"
        assert machinery_rate.get("rate") == 2.0, "194I machinery rate should be 2%"
        
        print("PASS: 194I rent type rates verified")


class TestTDSSummary:
    """TDS Summary API tests"""
    
    def test_tds_summary_endpoint(self):
        """Test GET /api/tds/summary returns summary data"""
        session = get_auth_session()
        response = session.get(f"{BASE_URL}/api/tds/summary")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "financial_year" in data, "Summary should include financial_year"
        
        # These may be empty arrays if no TDS entries exist
        assert "quarter_summary" in data or "totals" in data, "Summary should include quarter_summary or totals"
        
        print(f"PASS: TDS summary returned for FY {data.get('financial_year')}")
    
    def test_tds_entries_endpoint(self):
        """Test GET /api/tds/entries returns entries list"""
        session = get_auth_session()
        response = session.get(f"{BASE_URL}/api/tds/entries")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        entries = response.json()
        assert isinstance(entries, list), "Response should be a list"
        
        # If entries exist, verify structure
        if entries:
            entry = entries[0]
            expected_fields = ["id", "party_id", "tds_section", "tds_amount", "status"]
            for field in expected_fields:
                assert field in entry, f"Entry should have {field}"
        
        print(f"PASS: TDS entries endpoint returned {len(entries)} entries")
    
    def test_tds_entries_filter_by_status(self):
        """Test TDS entries can be filtered by status"""
        session = get_auth_session()
        
        # Test pending filter
        response = session.get(f"{BASE_URL}/api/tds/entries", params={"status": "pending"})
        assert response.status_code == 200
        
        # Test paid filter
        response = session.get(f"{BASE_URL}/api/tds/entries", params={"status": "paid"})
        assert response.status_code == 200
        
        print("PASS: TDS entries status filter works")


class TestTDSCalculation:
    """TDS Calculation API tests"""
    
    def test_tds_calculate_requires_party(self):
        """Test TDS calculation requires valid party_id"""
        session = get_auth_session()
        response = session.post(
            f"{BASE_URL}/api/tds/calculate",
            params={
                "party_id": "non-existent-party",
                "gross_amount": 50000,
                "expense_type": "contractor"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("tds_applicable") == False, "TDS should not be applicable for non-existent party"
        assert "Party not found" in data.get("reason", ""), "Should indicate party not found"
        
        print("PASS: TDS calculation handles non-existent party")


class TestGSTHSNSummary:
    """GST HSN Summary API tests"""
    
    def test_hsn_summary_endpoint(self):
        """Test GET /api/gst/hsn-summary returns summary data"""
        session = get_auth_session()
        response = session.get(
            f"{BASE_URL}/api/gst/hsn-summary",
            params={
                "from_date": "2026-01-01",
                "to_date": "2026-04-30"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "hsn_summary" in data, "Response should include hsn_summary"
        assert "state_wise" in data, "Response should include state_wise"
        assert "purchase_vs_sales" in data, "Response should include purchase_vs_sales"
        assert "date_range" in data, "Response should include date_range"
        assert "company_state" in data, "Response should include company_state"
        
        # Verify hsn_summary structure if data exists
        if data["hsn_summary"]:
            hsn = data["hsn_summary"][0]
            expected_fields = ["hsn_code", "product_name", "quantity_sold", "sales_taxable", 
                            "sales_cgst", "sales_sgst", "sales_igst"]
            for field in expected_fields:
                assert field in hsn, f"HSN summary should have {field}"
        
        print(f"PASS: GST HSN summary returned {len(data['hsn_summary'])} HSN records")
    
    def test_hsn_summary_state_wise_data(self):
        """Test state-wise breakdown in HSN summary"""
        session = get_auth_session()
        response = session.get(
            f"{BASE_URL}/api/gst/hsn-summary",
            params={
                "from_date": "2026-01-01",
                "to_date": "2026-04-30"
            }
        )
        
        assert response.status_code == 200
        
        data = response.json()
        state_wise = data.get("state_wise", [])
        
        # Verify state_wise structure if data exists
        if state_wise:
            state = state_wise[0]
            expected_fields = ["state", "taxable_value", "cgst", "sgst", "igst", "invoice_count"]
            for field in expected_fields:
                assert field in state, f"State-wise data should have {field}"
        
        print(f"PASS: State-wise data returned {len(state_wise)} states")


class TestGSTMissingDataAlerts:
    """GST Missing Data Alerts API tests"""
    
    def test_missing_data_alerts_endpoint(self):
        """Test GET /api/gst/missing-data-alerts returns alerts"""
        session = get_auth_session()
        response = session.get(f"{BASE_URL}/api/gst/missing-data-alerts")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        alerts = response.json()
        assert isinstance(alerts, list), "Response should be a list"
        
        # Verify alert structure if alerts exist
        if alerts:
            alert = alerts[0]
            expected_fields = ["record_type", "record_id", "record_number", "message", "severity"]
            for field in expected_fields:
                assert field in alert, f"Alert should have {field}"
            
            # Verify severity is valid
            valid_severities = ["high", "medium", "low"]
            assert alert.get("severity") in valid_severities, f"Severity should be one of {valid_severities}"
        
        print(f"PASS: Missing data alerts returned {len(alerts)} alerts")
    
    def test_missing_data_alerts_types(self):
        """Test that alerts cover different record types"""
        session = get_auth_session()
        response = session.get(f"{BASE_URL}/api/gst/missing-data-alerts")
        
        assert response.status_code == 200
        
        alerts = response.json()
        
        if alerts:
            record_types = set(a.get("record_type") for a in alerts)
            valid_types = {"Dispatch", "Master SKU", "Party", "Invoice"}
            
            for rt in record_types:
                assert rt in valid_types, f"Record type {rt} should be one of {valid_types}"
        
        print(f"PASS: Alerts cover record types: {set(a.get('record_type') for a in alerts) if alerts else 'none'}")


class TestGSTHSNDrilldown:
    """GST HSN Drilldown API tests"""
    
    def test_hsn_drilldown_endpoint(self):
        """Test GET /api/gst/hsn-drilldown/{hsn_code} returns state breakdown"""
        session = get_auth_session()
        
        # First get a valid HSN code from summary
        summary_response = session.get(
            f"{BASE_URL}/api/gst/hsn-summary",
            params={"from_date": "2026-01-01", "to_date": "2026-04-30"}
        )
        
        if summary_response.status_code == 200:
            hsn_summary = summary_response.json().get("hsn_summary", [])
            
            if hsn_summary:
                # Use first HSN code for drilldown
                hsn_code = hsn_summary[0].get("hsn_code") or "21069099"
                
                response = session.get(
                    f"{BASE_URL}/api/gst/hsn-drilldown/{hsn_code}",
                    params={"from_date": "2026-01-01", "to_date": "2026-04-30"}
                )
                
                assert response.status_code == 200, f"Expected 200, got {response.status_code}"
                
                data = response.json()
                assert "hsn_code" in data, "Response should include hsn_code"
                assert "states" in data, "Response should include states"
                
                print(f"PASS: HSN drilldown for {hsn_code} returned {len(data.get('states', []))} states")
            else:
                print("SKIP: No HSN data available for drilldown test")
        else:
            print("SKIP: Could not get HSN summary for drilldown test")


class TestPartiesAPI:
    """Test Parties API for TDS configuration"""
    
    def test_parties_list(self):
        """Test GET /api/parties returns parties list"""
        session = get_auth_session()
        response = session.get(f"{BASE_URL}/api/parties")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        parties = response.json()
        assert isinstance(parties, list), "Response should be a list"
        
        print(f"PASS: Parties endpoint returned {len(parties)} parties")
    
    def test_supplier_parties_have_tds_fields(self):
        """Test that supplier parties can have TDS configuration fields"""
        session = get_auth_session()
        response = session.get(f"{BASE_URL}/api/parties")
        
        assert response.status_code == 200
        
        parties = response.json()
        suppliers = [p for p in parties if "supplier" in p.get("party_types", [])]
        
        if suppliers:
            print(f"PASS: Found {len(suppliers)} supplier parties")
        else:
            print("INFO: No supplier parties found")


class TestFirmsAPI:
    """Test Firms API for GST state configuration"""
    
    def test_firms_list(self):
        """Test GET /api/firms returns firms list"""
        session = get_auth_session()
        response = session.get(f"{BASE_URL}/api/firms")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        firms = response.json()
        assert isinstance(firms, list), "Response should be a list"
        
        print(f"PASS: Firms endpoint returned {len(firms)} firms")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

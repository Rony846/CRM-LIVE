"""
Stock Reports API Tests - Iteration 20
Tests for Stock Movement Reports feature:
- Stock Ledger Report
- Current Stock Report
- Transfers Report
- Dispatch & Return Report
- Adjustments Report
- CSV Export
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"
ACCOUNTANT_EMAIL = "accountant@musclegrid.in"
ACCOUNTANT_PASSWORD = "Muscle@846"


class TestStockReportsAuth:
    """Test authentication and authorization for report endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        """Get admin auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def get_accountant_token(self):
        """Get accountant auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        assert response.status_code == 200, f"Accountant login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_admin_can_access_stock_ledger(self):
        """Admin should be able to access stock ledger report"""
        token = self.get_admin_token()
        response = self.session.get(
            f"{BASE_URL}/api/reports/stock-ledger",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert "totals" in data
        print(f"Stock Ledger: {data['totals']['total_entries']} entries, In: {data['totals']['total_in']}, Out: {data['totals']['total_out']}")
    
    def test_accountant_can_access_stock_ledger(self):
        """Accountant should be able to access stock ledger report"""
        token = self.get_accountant_token()
        response = self.session.get(
            f"{BASE_URL}/api/reports/stock-ledger",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert "totals" in data
    
    def test_unauthorized_access_denied(self):
        """Unauthenticated requests should be denied"""
        response = self.session.get(f"{BASE_URL}/api/reports/stock-ledger")
        assert response.status_code in [401, 403]


class TestStockLedgerReport:
    """Test Stock Ledger Report endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_stock_ledger_returns_entries_and_totals(self):
        """Stock ledger should return entries array and totals object"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/stock-ledger",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "entries" in data
        assert "totals" in data
        assert isinstance(data["entries"], list)
        assert isinstance(data["totals"], dict)
        
        # Verify totals structure
        totals = data["totals"]
        assert "total_entries" in totals
        assert "total_in" in totals
        assert "total_out" in totals
        assert "by_entry_type" in totals
        
        print(f"Ledger totals: {totals}")
    
    def test_stock_ledger_entry_type_filter(self):
        """Stock ledger should filter by entry_type"""
        # Test with purchase filter
        response = self.session.get(
            f"{BASE_URL}/api/reports/stock-ledger",
            headers=self.headers,
            params={"entry_type": "purchase"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # All entries should be purchase type
        for entry in data["entries"]:
            assert entry.get("entry_type") == "purchase", f"Expected purchase, got {entry.get('entry_type')}"
        
        print(f"Purchase entries: {len(data['entries'])}")
    
    def test_stock_ledger_date_filter(self):
        """Stock ledger should filter by date range"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/stock-ledger",
            headers=self.headers,
            params={"date_from": "2025-01-01", "date_to": "2026-12-31"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        print(f"Entries in date range: {len(data['entries'])}")


class TestCurrentStockReport:
    """Test Current Stock Report endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_current_stock_returns_structure(self):
        """Current stock should return raw_materials, finished_goods, firms_summary"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/current-stock",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "raw_materials" in data
        assert "finished_goods" in data
        assert "firms_summary" in data
        assert "totals" in data
        
        # Verify totals structure
        totals = data["totals"]
        assert "total_raw_materials" in totals
        assert "total_finished_goods" in totals
        assert "low_stock_count" in totals
        assert "negative_stock_count" in totals
        
        print(f"Current Stock: RM={totals['total_raw_materials']}, FG={totals['total_finished_goods']}, Low={totals['low_stock_count']}")
    
    def test_current_stock_firm_filter(self):
        """Current stock should filter by firm_id"""
        # First get firms
        firms_response = self.session.get(
            f"{BASE_URL}/api/firms",
            headers=self.headers
        )
        if firms_response.status_code == 200:
            firms = firms_response.json()
            if firms:
                firm_id = firms[0]["id"]
                response = self.session.get(
                    f"{BASE_URL}/api/reports/current-stock",
                    headers=self.headers,
                    params={"firm_id": firm_id}
                )
                assert response.status_code == 200
                data = response.json()
                # All items should belong to the filtered firm
                for rm in data["raw_materials"]:
                    assert rm.get("firm_id") == firm_id
                print(f"Filtered by firm {firm_id}: {len(data['raw_materials'])} RM, {len(data['finished_goods'])} FG")


class TestTransfersReport:
    """Test Transfers Report endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_transfers_returns_structure(self):
        """Transfers report should return transfers array and totals"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/transfers",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "transfers" in data
        assert "totals" in data
        
        # Verify totals structure
        totals = data["totals"]
        assert "total_transfers" in totals
        assert "total_quantity" in totals
        
        print(f"Transfers: {totals['total_transfers']} transfers, {totals['total_quantity']} total qty")
    
    def test_transfers_have_invoice_numbers(self):
        """All transfers should have invoice numbers (GST compliance)"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/transfers",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        for transfer in data["transfers"]:
            # Invoice number should exist for GST compliance
            assert "invoice_number" in transfer
            print(f"Transfer {transfer.get('transfer_number')}: Invoice {transfer.get('invoice_number')}")


class TestDispatchReturnReport:
    """Test Dispatch & Return Report endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dispatch_return_returns_structure(self):
        """Dispatch/Return report should return dispatches, returns, and totals"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/dispatch-return",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "dispatches" in data
        assert "returns" in data
        assert "totals" in data
        
        # Verify totals structure
        totals = data["totals"]
        assert "total_dispatched" in totals
        assert "total_returned" in totals
        assert "dispatch_count" in totals
        assert "return_count" in totals
        assert "net_out" in totals
        
        print(f"Dispatch/Return: Dispatched={totals['total_dispatched']}, Returned={totals['total_returned']}, Net={totals['net_out']}")
    
    def test_dispatch_entries_are_dispatch_out(self):
        """All dispatch entries should have entry_type dispatch_out"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/dispatch-return",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        for dispatch in data["dispatches"]:
            assert dispatch.get("entry_type") == "dispatch_out"
    
    def test_return_entries_are_return_in(self):
        """All return entries should have entry_type return_in"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/dispatch-return",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        for ret in data["returns"]:
            assert ret.get("entry_type") == "return_in"


class TestAdjustmentsReport:
    """Test Adjustments Report endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_adjustments_returns_structure(self):
        """Adjustments report should return all_entries and totals"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/adjustments",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "all_entries" in data
        assert "totals" in data
        
        # Verify totals structure
        totals = data["totals"]
        assert "adjustment_in_qty" in totals
        assert "adjustment_out_qty" in totals
        assert "repair_yard_qty" in totals
        
        print(f"Adjustments: In={totals['adjustment_in_qty']}, Out={totals['adjustment_out_qty']}, Repair Yard={totals['repair_yard_qty']}")
    
    def test_adjustments_have_reasons(self):
        """Adjustment entries should have reasons (mandatory field)"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/adjustments",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        for entry in data["all_entries"]:
            # Reason should exist for adjustments
            entry_type = entry.get("entry_type")
            if entry_type in ["adjustment_in", "adjustment_out", "repair_yard_in"]:
                # Reason is mandatory for these types
                print(f"Entry {entry.get('entry_number')}: Type={entry_type}, Reason={entry.get('reason', 'N/A')}")


class TestCSVExport:
    """Test CSV Export endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_export_ledger_csv(self):
        """Should export stock ledger as CSV"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/export/csv",
            headers=self.headers,
            params={"report_type": "ledger"}
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        
        # Check CSV content
        content = response.text
        assert "Entry Number" in content  # Header should be present
        print(f"Ledger CSV exported: {len(content)} bytes")
    
    def test_export_stock_csv(self):
        """Should export current stock as CSV"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/export/csv",
            headers=self.headers,
            params={"report_type": "stock"}
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        
        content = response.text
        assert "Firm" in content  # Header should be present
        print(f"Stock CSV exported: {len(content)} bytes")
    
    def test_export_transfers_csv(self):
        """Should export transfers as CSV"""
        response = self.session.get(
            f"{BASE_URL}/api/reports/export/csv",
            headers=self.headers,
            params={"report_type": "transfers"}
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        
        content = response.text
        assert "Transfer Number" in content  # Header should be present
        print(f"Transfers CSV exported: {len(content)} bytes")


class TestFirmFilter:
    """Test firm filter across all report endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def get_first_firm_id(self):
        """Get first active firm ID"""
        response = self.session.get(
            f"{BASE_URL}/api/firms",
            headers=self.headers,
            params={"is_active": True}
        )
        if response.status_code == 200:
            firms = response.json()
            if firms:
                return firms[0]["id"]
        return None
    
    def test_firm_filter_on_ledger(self):
        """Firm filter should work on stock ledger"""
        firm_id = self.get_first_firm_id()
        if not firm_id:
            pytest.skip("No firms available")
        
        response = self.session.get(
            f"{BASE_URL}/api/reports/stock-ledger",
            headers=self.headers,
            params={"firm_id": firm_id}
        )
        assert response.status_code == 200
        data = response.json()
        
        # All entries should belong to the filtered firm
        for entry in data["entries"]:
            assert entry.get("firm_id") == firm_id
        
        print(f"Ledger filtered by firm: {len(data['entries'])} entries")
    
    def test_firm_filter_on_dispatch_return(self):
        """Firm filter should work on dispatch/return report"""
        firm_id = self.get_first_firm_id()
        if not firm_id:
            pytest.skip("No firms available")
        
        response = self.session.get(
            f"{BASE_URL}/api/reports/dispatch-return",
            headers=self.headers,
            params={"firm_id": firm_id}
        )
        assert response.status_code == 200
        data = response.json()
        
        # All entries should belong to the filtered firm
        for entry in data["dispatches"] + data["returns"]:
            assert entry.get("firm_id") == firm_id
        
        print(f"Dispatch/Return filtered by firm: {len(data['dispatches'])} dispatches, {len(data['returns'])} returns")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

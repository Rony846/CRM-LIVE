"""
Test Serial Number Based Dispatch for Manufactured Items
Tests the new features:
1. Historical data import (production requests, serial numbers, supervisor payables)
2. GET /api/finished-good-serials/available/{master_sku_id} - returns in_stock serials
3. POST /api/dispatches - requires serial_number for manufactured items
4. Serial number status changes to 'dispatched' after dispatch creation
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


class TestHistoricalDataImport:
    """Test that historical battery data was imported correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_production_requests_imported(self):
        """Verify production requests were imported"""
        response = requests.get(
            f"{BASE_URL}/api/production-requests",
            headers=self.headers,
            params={"limit": 10}
        )
        assert response.status_code == 200, f"Failed to get production requests: {response.text}"
        data = response.json()
        
        # Should have imported records
        requests_list = data.get("requests", data) if isinstance(data, dict) else data
        assert len(requests_list) > 0, "No production requests found"
        print(f"✓ Found {len(requests_list)} production requests")
    
    def test_serial_numbers_imported(self):
        """Verify serial numbers were imported"""
        response = requests.get(
            f"{BASE_URL}/api/finished-good-serials",
            headers=self.headers,
            params={"limit": 100}
        )
        assert response.status_code == 200, f"Failed to get serials: {response.text}"
        serials = response.json()
        
        assert len(serials) > 0, "No serial numbers found"
        print(f"✓ Found {len(serials)} serial numbers")
        
        # Check that some are in_stock
        in_stock = [s for s in serials if s.get("status") == "in_stock"]
        print(f"✓ {len(in_stock)} serial numbers are in_stock")
    
    def test_supervisor_payables_imported(self):
        """Verify supervisor payables were imported"""
        response = requests.get(
            f"{BASE_URL}/api/supervisor-payables",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get payables: {response.text}"
        data = response.json()
        
        payables = data.get("payables", [])
        assert len(payables) > 0, "No supervisor payables found"
        print(f"✓ Found {len(payables)} supervisor payables")


class TestAvailableSerialsEndpoint:
    """Test GET /api/finished-good-serials/available/{master_sku_id}"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and find a manufactured SKU with in_stock serials"""
        # Login as accountant
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get a serial that's in_stock to find its master_sku_id and firm_id
        response = requests.get(
            f"{BASE_URL}/api/finished-good-serials",
            headers=self.headers,
            params={"status": "in_stock", "limit": 1}
        )
        assert response.status_code == 200
        serials = response.json()
        
        if serials:
            self.test_serial = serials[0]
            self.master_sku_id = self.test_serial.get("master_sku_id")
            self.firm_id = self.test_serial.get("firm_id")
        else:
            self.test_serial = None
            self.master_sku_id = None
            self.firm_id = None
    
    def test_get_available_serials_success(self):
        """Test getting available serials for a manufactured SKU"""
        if not self.master_sku_id or not self.firm_id:
            pytest.skip("No in_stock serials available for testing")
        
        response = requests.get(
            f"{BASE_URL}/api/finished-good-serials/available/{self.master_sku_id}",
            headers=self.headers,
            params={"firm_id": self.firm_id}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        serials = response.json()
        
        assert isinstance(serials, list), "Response should be a list"
        assert len(serials) > 0, "Should have at least one available serial"
        
        # Verify all returned serials are in_stock
        for serial in serials:
            assert serial.get("status") == "in_stock", f"Serial {serial.get('serial_number')} is not in_stock"
            assert serial.get("master_sku_id") == self.master_sku_id
            assert serial.get("firm_id") == self.firm_id
        
        print(f"✓ Found {len(serials)} available serials for SKU {self.master_sku_id}")
    
    def test_get_available_serials_missing_firm_id(self):
        """Test that firm_id is required"""
        if not self.master_sku_id:
            pytest.skip("No master_sku_id available for testing")
        
        response = requests.get(
            f"{BASE_URL}/api/finished-good-serials/available/{self.master_sku_id}",
            headers=self.headers
            # Missing firm_id
        )
        # Should fail with 422 (validation error) since firm_id is required
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Correctly requires firm_id parameter")
    
    def test_get_available_serials_invalid_sku(self):
        """Test with non-existent SKU ID"""
        response = requests.get(
            f"{BASE_URL}/api/finished-good-serials/available/non-existent-sku-id",
            headers=self.headers,
            params={"firm_id": self.firm_id or "some-firm-id"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        serials = response.json()
        assert serials == [], "Should return empty list for non-existent SKU"
        print("✓ Returns empty list for non-existent SKU")


class TestDispatchWithSerialNumber:
    """Test POST /api/dispatches with serial_number for manufactured items"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and find test data"""
        # Login as accountant
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get an in_stock serial for testing
        response = requests.get(
            f"{BASE_URL}/api/finished-good-serials",
            headers=self.headers,
            params={"status": "in_stock", "limit": 5}
        )
        assert response.status_code == 200
        serials = response.json()
        
        if serials:
            self.test_serial = serials[0]
            self.serial_number = self.test_serial.get("serial_number")
            self.master_sku_id = self.test_serial.get("master_sku_id")
            self.master_sku_code = self.test_serial.get("master_sku_code")
            self.firm_id = self.test_serial.get("firm_id")
        else:
            self.test_serial = None
            self.serial_number = None
            self.master_sku_id = None
            self.master_sku_code = None
            self.firm_id = None
    
    def test_dispatch_manufactured_item_requires_serial(self):
        """Test that dispatch of manufactured item fails without serial_number"""
        if not self.master_sku_code or not self.firm_id:
            pytest.skip("No manufactured SKU available for testing")
        
        # Create a test invoice file
        files = {
            'invoice_file': ('test_invoice.pdf', b'%PDF-1.4 test content', 'application/pdf')
        }
        data = {
            'dispatch_type': 'new_order',
            'sku': self.master_sku_code,
            'firm_id': self.firm_id,
            'customer_name': 'TEST_Serial_Customer',
            'phone': '9999999999',
            'address': 'Test Address',
            'reason': 'Test dispatch without serial',
            'order_id': 'TEST-ORD-001',
            'payment_reference': 'TEST-PAY-001'
            # Missing serial_number
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dispatches",
            headers=self.headers,
            data=data,
            files=files
        )
        
        # Should fail because serial_number is required for manufactured items
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "serial number" in response.text.lower() or "serial_number" in response.text.lower(), \
            f"Error should mention serial number: {response.text}"
        print("✓ Correctly rejects dispatch without serial_number for manufactured item")
    
    def test_dispatch_manufactured_item_with_invalid_serial(self):
        """Test that dispatch fails with non-existent serial number"""
        if not self.master_sku_code or not self.firm_id:
            pytest.skip("No manufactured SKU available for testing")
        
        files = {
            'invoice_file': ('test_invoice.pdf', b'%PDF-1.4 test content', 'application/pdf')
        }
        data = {
            'dispatch_type': 'new_order',
            'sku': self.master_sku_code,
            'firm_id': self.firm_id,
            'customer_name': 'TEST_Serial_Customer',
            'phone': '9999999999',
            'address': 'Test Address',
            'reason': 'Test dispatch with invalid serial',
            'order_id': 'TEST-ORD-002',
            'payment_reference': 'TEST-PAY-002',
            'serial_number': 'INVALID-SERIAL-12345'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dispatches",
            headers=self.headers,
            data=data,
            files=files
        )
        
        # Should fail because serial doesn't exist
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "not found" in response.text.lower() or "not available" in response.text.lower(), \
            f"Error should mention serial not found: {response.text}"
        print("✓ Correctly rejects dispatch with invalid serial number")
    
    def test_dispatch_manufactured_item_success(self):
        """Test successful dispatch with valid serial number"""
        if not self.serial_number or not self.master_sku_code or not self.firm_id:
            pytest.skip("No in_stock serial available for testing")
        
        # Verify serial is in_stock before dispatch
        response = requests.get(
            f"{BASE_URL}/api/finished-good-serials/lookup/{self.serial_number}",
            headers=self.headers
        )
        assert response.status_code == 200
        serial_before = response.json()
        assert serial_before.get("status") == "in_stock", f"Serial should be in_stock, got {serial_before.get('status')}"
        
        # Create dispatch with serial number
        files = {
            'invoice_file': ('test_invoice.pdf', b'%PDF-1.4 test content', 'application/pdf')
        }
        data = {
            'dispatch_type': 'new_order',
            'sku': self.master_sku_code,
            'firm_id': self.firm_id,
            'customer_name': 'TEST_Serial_Dispatch_Customer',
            'phone': '9999999999',
            'address': 'Test Address for Serial Dispatch',
            'reason': 'Test dispatch with valid serial',
            'order_id': f'TEST-ORD-{self.serial_number[:8]}',
            'payment_reference': f'TEST-PAY-{self.serial_number[:8]}',
            'serial_number': self.serial_number
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dispatches",
            headers=self.headers,
            data=data,
            files=files
        )
        
        assert response.status_code == 200 or response.status_code == 201, \
            f"Dispatch creation failed: {response.status_code} - {response.text}"
        
        dispatch = response.json()
        assert dispatch.get("serial_number") == self.serial_number, "Dispatch should have serial_number"
        assert dispatch.get("is_manufactured_item") == True, "Should be marked as manufactured item"
        print(f"✓ Successfully created dispatch {dispatch.get('dispatch_number')} with serial {self.serial_number}")
        
        # Verify serial status changed to 'dispatched'
        response = requests.get(
            f"{BASE_URL}/api/finished-good-serials/lookup/{self.serial_number}",
            headers=self.headers
        )
        assert response.status_code == 200
        serial_after = response.json()
        assert serial_after.get("status") == "dispatched", \
            f"Serial status should be 'dispatched', got '{serial_after.get('status')}'"
        print(f"✓ Serial number status changed to 'dispatched'")


class TestMasterSKULookupForDispatch:
    """Test the SKU lookup endpoint used by dispatch form"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTANT_EMAIL,
            "password": ACCOUNTANT_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get a firm
        response = requests.get(f"{BASE_URL}/api/firms", headers=self.headers)
        firms = response.json()
        self.firm_id = firms[0]["id"] if firms else None
    
    def test_lookup_manufactured_sku(self):
        """Test looking up a manufactured SKU returns product_type info"""
        if not self.firm_id:
            pytest.skip("No firm available")
        
        # Get a manufactured SKU code
        response = requests.get(
            f"{BASE_URL}/api/master-skus",
            headers=self.headers,
            params={"product_type": "manufactured", "limit": 1}
        )
        assert response.status_code == 200
        skus = response.json()
        
        if not skus:
            pytest.skip("No manufactured SKUs available")
        
        sku_code = skus[0].get("sku_code")
        
        # Lookup the SKU
        response = requests.get(
            f"{BASE_URL}/api/master-skus/lookup",
            headers=self.headers,
            params={"code": sku_code, "firm_id": self.firm_id}
        )
        assert response.status_code == 200, f"Lookup failed: {response.text}"
        result = response.json()
        
        assert result.get("found") == True, "SKU should be found"
        assert result.get("item_type") == "master_sku", "Should be a master_sku"
        
        master_sku = result.get("master_sku", {})
        assert master_sku.get("product_type") == "manufactured", "Should be manufactured type"
        print(f"✓ Lookup returns product_type='manufactured' for {sku_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
